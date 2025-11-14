import { getOpenAIClient, OPENAI_MODELS, OPENAI_TEMPERATURES } from './openai-client';
import { analyzeComprehensibility, getUserProficiency, shouldAdjustComplexity, getRecentlyLearnedWords, trackWordReinforcement, type WordForReinforcement } from './comprehensible-input';
import { getRelevantMemories, formatMemoriesForPrompt, getLastSessionSummary } from './conversation-memory';
import { getDatabase } from './db';
import { eq, sql } from 'drizzle-orm';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GenerateResponseOptions {
  userId: string;
  userMessage: string;
  conversationHistory?: ChatMessage[];
  targetLanguage?: string;
  maxRetries?: number;
  topicSuggestion?: string;
  conversationState?: 'initial_greeting' | 'in_topic' | 'transitioning';
}

interface GeneratedResponse {
  content: string;
  comprehensibilityScore: number;
  adjustment: 'simplify' | 'increase' | 'maintain';
  tokensUsed: number;
}

/**
 * Generate a ChatGPT response that maintains comprehensible input (i+1)
 * The response should be at 80-85% comprehensibility for the user
 */
export async function generateComprehensibleResponse(
  options: GenerateResponseOptions
): Promise<GeneratedResponse> {
  const {
    userId,
    userMessage,
    conversationHistory = [],
    targetLanguage = 'Italian',
    maxRetries = 3,
    topicSuggestion,
    conversationState = 'in_topic',
  } = options;

  const client = getOpenAIClient();
  
  // Get user's current proficiency
  const proficiency = await getUserProficiency(userId);
  
  // Get last session summary for continuity
  const lastSessionSummary = await getLastSessionSummary(userId);
  
  // Get relevant memories for context
  const memories = await getRelevantMemories(userId);
  const memoryContext = formatMemoriesForPrompt(memories, lastSessionSummary);
  
  // Get recently learned words for reinforcement
  const recentWords = await getRecentlyLearnedWords(userId);
  
  // Get recent comprehensibility trends
  const db = await getDatabase();
  const { conversations: conversationsTable } = await import('../schema/comprehensible-input');
  const recentConversations = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.user_id, userId))
    .where(eq(conversationsTable.message_type, 'assistant'))
    .orderBy(sql`${conversationsTable.created_at} DESC`)
    .limit(5);
  
  const comprehensibilityTrends = recentConversations
    .reverse()
    .map(c => c.comprehensibility_score || 0)
    .filter(score => score > 0);
  
  // Build system prompt based on user's level and trends
  const systemPrompt = buildSystemPrompt(
    targetLanguage,
    proficiency.level,
    proficiency.vocabulary_size,
    proficiency.comprehension_score,
    memoryContext,
    comprehensibilityTrends,
    recentWords,
    topicSuggestion,
    conversationState
  );

  // Prepare messages for OpenAI
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    { role: 'user', content: userMessage },
  ];

  let attempt = 0;
  let bestResponse: GeneratedResponse | null = null;

  while (attempt < maxRetries) {
    attempt++;

    try {
      // Call OpenAI API
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini', // Use gpt-4o-mini for cost-effectiveness, or 'gpt-4o' for better quality
        messages: messages as any,
        temperature: 0.4, // Lower temperature for more accurate, consistent spelling and grammar
        max_tokens: 300,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
      });

      const responseContent = completion.choices[0]?.message?.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;

      // Check for repetitive patterns
      const isRepetitive = detectRepetitivePatterns(responseContent, conversationHistory);
      
      if (isRepetitive && attempt < maxRetries) {
        console.log(`🔄 Detected repetitive pattern, retrying with stronger instruction (attempt ${attempt}/${maxRetries})`);
        // Add stronger anti-repetition instruction
        messages[0].content += '\n\n⚠️ CRITICAL: Your last response contained repetitive/generic questions. DO NOT use phrases like "Come stai?", "Cosa fai oggi?", etc. Jump directly into meaningful content based on conversation context.';
        continue; // Skip to next attempt
      }

      // Analyze the response for comprehensibility
      const analysis = await analyzeComprehensibility(userId, responseContent);
      const adjustment = shouldAdjustComplexity(analysis.comprehensibilityScore);

      const response: GeneratedResponse = {
        content: responseContent,
        comprehensibilityScore: analysis.comprehensibilityScore,
        adjustment,
        tokensUsed,
      };

      // Check if response is within target range (80-85%)
      const score = analysis.comprehensibilityScore;
      const isInRange = score >= 0.75 && score <= 0.90; // Allow 75-90% range

      if (isInRange || attempt === maxRetries) {
        // Track word reinforcement
        const allRecentWords = [
          ...recentWords.last7Days,
          ...recentWords.last30Days,
          ...recentWords.older
        ];
        if (allRecentWords.length > 0) {
          await trackWordReinforcement(userId, responseContent, allRecentWords);
        }
        
        return response;
      }

      // Store best response in case we don't find a perfect one
      if (!bestResponse || Math.abs(score - 0.825) < Math.abs(bestResponse.comprehensibilityScore - 0.825)) {
        bestResponse = response;
      }

      // Adjust the system prompt based on the result
      if (score < 0.75) {
        messages[0].content = adjustSystemPromptForSimplification(systemPrompt);
      } else if (score > 0.90) {
        messages[0].content = adjustSystemPromptForComplexity(systemPrompt);
      }

    } catch (error) {
      console.error(`Error generating response (attempt ${attempt}):`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to generate response after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // Return best response if we have one
  if (bestResponse) {
    // Track word reinforcement for best response
    const allRecentWords = [
      ...recentWords.last7Days,
      ...recentWords.last30Days,
      ...recentWords.older
    ];
    if (allRecentWords.length > 0 && bestResponse.content) {
      await trackWordReinforcement(userId, bestResponse.content, allRecentWords);
    }
    
    return bestResponse;
  }

  throw new Error('Failed to generate a suitable response');
}

/**
 * Common repetitive phrases that should be avoided in AI responses
 */
const REPETITIVE_PATTERNS = [
  /come\s+stai\?/i,
  /come\s+va\?/i,
  /cosa\s+fai\s+oggi\?/i,
  /come\s+ti\s+senti\?/i,
  /tutto\s+bene\?/i,
  /come\s+è\s+andata\s+la\s+giornata\?/i,
  /cosa\s+hai\s+fatto\s+oggi\?/i,
  /dimmi\s+di\s+te/i,
];

/**
 * Detect if AI response contains repetitive patterns that should be avoided
 * Returns true if repetitive patterns are found
 */
function detectRepetitivePatterns(
  responseContent: string,
  recentConversationHistory?: Array<{ message_type: string; content: string }>
): boolean {
  // Check for forbidden repetitive phrases
  for (const pattern of REPETITIVE_PATTERNS) {
    if (pattern.test(responseContent)) {
      console.log(`⚠️ Detected repetitive pattern: ${pattern.source}`);
      return true;
    }
  }
  
  // Check if response is very similar to recent AI responses
  if (recentConversationHistory && recentConversationHistory.length > 0) {
    const recentAIResponses = recentConversationHistory
      .filter(msg => msg.message_type === 'assistant')
      .slice(-3) // Check last 3 AI responses
      .map(msg => msg.content.toLowerCase());
    
    const currentLower = responseContent.toLowerCase();
    
    for (const recentResponse of recentAIResponses) {
      // Calculate simple similarity - if first 30 characters are very similar, it's repetitive
      const current30 = currentLower.substring(0, 30);
      const recent30 = recentResponse.substring(0, 30);
      
      if (current30 && recent30 && current30 === recent30) {
        console.log(`⚠️ Detected very similar opening to recent response`);
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Format recently learned words for inclusion in the system prompt
 */
function formatWordsForReinforcement(
  last7Days: WordForReinforcement[],
  last30Days: WordForReinforcement[],
  older: WordForReinforcement[]
): string {
  const totalWords = last7Days.length + last30Days.length + older.length;
  
  if (totalWords === 0) {
    return '';
  }

  let section = '\n\n--- VOCABULARY REINFORCEMENT ---\n';
  section += 'Try to naturally incorporate 2-3 of these words in your response when contextually appropriate.\n';
  section += 'IMPORTANT: Only use these words if they fit naturally in the conversation. Never force them.\n\n';

  if (last7Days.length > 0) {
    section += 'HIGH PRIORITY (Recently learned - last 7 days):\n';
    for (const word of last7Days.slice(0, 5)) {
      const translation = word.translation ? ` (${word.translation})` : '';
      const example = word.exampleSentence ? ` - e.g., "${word.exampleSentence}"` : '';
      const mastery = word.masteryLevel === 'learning' ? ' [NEW]' : word.masteryLevel === 'practicing' ? ' [PRACTICING]' : '';
      section += `- ${word.wordOriginal}${translation}${mastery}${example}\n`;
    }
    section += '\n';
  }

  if (last30Days.length > 0) {
    section += 'MEDIUM PRIORITY (Last 30 days):\n';
    for (const word of last30Days.slice(0, 4)) {
      const translation = word.translation ? ` (${word.translation})` : '';
      const example = word.exampleSentence ? ` - e.g., "${word.exampleSentence}"` : '';
      section += `- ${word.wordOriginal}${translation}${example}\n`;
    }
    section += '\n';
  }

  if (older.length > 0) {
    section += 'BACKGROUND VOCABULARY (Earlier learning):\n';
    const words = older.slice(0, 6).map(w => w.wordOriginal).join(', ');
    section += `${words}\n`;
  }

  return section;
}

/**
 * Build system prompt for ChatGPT based on user's proficiency and recent trends
 */
function buildSystemPrompt(
  language: string,
  level: string,
  vocabularySize: number,
  comprehensionScore: number,
  memoryContext?: string,
  comprehensibilityTrends?: number[],
  recentWords?: { last7Days: WordForReinforcement[]; last30Days: WordForReinforcement[]; older: WordForReinforcement[] },
  topicSuggestion?: string,
  conversationState: 'initial_greeting' | 'in_topic' | 'transitioning' = 'in_topic'
): string {
  const targetPercentage = 82.5;
  
  let prompt = `You are an AI assistant designed to help people learn ${language}. Your goal is to have a natural conversation in ${language} while maintaining the principle of "comprehensible input" (i+1).

CRITICAL INSTRUCTIONS:
1. Write ALL responses in ${language} only - never use English except for this instruction
2. ALWAYS use correct spelling, grammar, and punctuation - you are a language teacher, so accuracy is essential
3. For Italian: ALWAYS use proper accented characters (è, é, à, ò, ù, ì) - never omit accents
4. ALWAYS include all necessary words (articles, verbs, prepositions) - do not skip words
5. The user is at CEFR level ${level} with approximately ${vocabularySize} known words
6. Your responses should be at ${targetPercentage}% comprehensibility - meaning the user should understand about 82-83% of the words
7. Use mostly words the user already knows, but introduce 1-3 new words naturally in context
8. Keep responses conversational, natural, and contextually relevant
9. Use simple, clear sentence structures appropriate for ${level} level
10. If introducing new words, use them in context where their meaning can be inferred
11. Be engaging, friendly, and supportive
12. Keep responses to 2-4 sentences maximum
13. Focus on practical, everyday conversation topics

FORBIDDEN BEHAVIORS - DO NOT DO THESE:
❌ NEVER ask repetitive generic questions like "Come stai?", "Come va?", "Cosa fai oggi?", "Come ti senti?"
❌ NEVER start with small talk if you have conversation history or memory context
❌ NEVER repeat the same greeting patterns in consecutive sessions
❌ NEVER ignore the conversation memory - if you know what we discussed before, reference it
❌ NEVER ask questions you should already know the answer to based on previous conversations

CONVERSATION CONTINUITY RULES:
✓ If memory context is provided, USE IT to continue naturally from where we left off
✓ Reference previous topics, interests, or learning goals when relevant
✓ Jump directly into meaningful content rather than starting with pleasantries
✓ Treat ongoing conversations as continuous learning journeys, not isolated sessions
✓ When greeting, make it specific and contextual (e.g., reference what we discussed last time)

LANGUAGE LEVEL GUIDELINES:
- A1/A2: Very simple sentences, present tense, basic vocabulary, everyday topics
- B1/B2: More varied tenses, compound sentences, intermediate vocabulary, broader topics
- C1/C2: Complex structures, advanced vocabulary, nuanced expressions, abstract topics

Remember: Maintain a natural conversation while keeping comprehensibility around ${targetPercentage}%. Quality of learning comes from understanding most of what you read while being challenged by a few new elements.`;

  // Add conversation state specific instructions
  if (conversationState !== 'initial_greeting') {
    prompt += `\n\n🔥 CONVERSATION STATE: Beyond Initial Greeting
This is NOT the user's first interaction. You have conversation history and/or memory context.

ABSOLUTE REQUIREMENTS:
- DO NOT greet with "Ciao! Come stai?" or similar basic greetings
- DO NOT ask "Cosa fai oggi?" or other generic check-in questions
- IMMEDIATELY dive into meaningful content based on context
- Reference previous conversations, topics, or learning progress
- Act as if this is a continuation of an ongoing learning journey

If you violate these rules, the response will be rejected and you'll be asked to retry.`;
  }

  // Add comprehensibility trend analysis
  if (comprehensibilityTrends && comprehensibilityTrends.length > 0) {
    const avgRecent = comprehensibilityTrends.reduce((a, b) => a + b, 0) / comprehensibilityTrends.length;
    const percentages = comprehensibilityTrends.map(s => Math.round(s * 100)).join('%, ');
    
    prompt += `\n\n--- COMPREHENSIBILITY FEEDBACK ---\n`;
    prompt += `Recent comprehensibility scores: ${percentages}%\n`;
    prompt += `Average: ${Math.round(avgRecent * 100)}%\n`;
    
    if (avgRecent < 0.75) {
      prompt += `⚠️ ADJUST: Your recent responses have been too difficult. Please SIMPLIFY your language:\n`;
      prompt += `- Use more basic vocabulary\n`;
      prompt += `- Shorter, simpler sentences\n`;
      prompt += `- Fewer new words per response\n`;
      prompt += `- Stick to present tense when possible\n`;
    } else if (avgRecent > 0.90) {
      prompt += `⚠️ ADJUST: Your recent responses have been too easy. Please INCREASE complexity:\n`;
      prompt += `- Introduce more challenging vocabulary\n`;
      prompt += `- Use more varied sentence structures\n`;
      prompt += `- Include 2-3 new words in context\n`;
      prompt += `- Use a wider range of verb tenses\n`;
    } else {
      prompt += `✓ GOOD: Your comprehensibility is in the target range. Keep it up!\n`;
    }
  }

  // Add memory context if available
  if (memoryContext && memoryContext.trim()) {
    prompt += `\n\n--- CONVERSATION MEMORY ---\nUse this context to make the conversation more personalized and relevant:\n\n${memoryContext}`;
  }
  
  // Add vocabulary reinforcement section
  if (recentWords) {
    const reinforcementSection = formatWordsForReinforcement(
      recentWords.last7Days,
      recentWords.last30Days,
      recentWords.older
    );
    if (reinforcementSection) {
      prompt += reinforcementSection;
    }
  }
  
  // Add topic suggestion instructions
  if (topicSuggestion) {
    prompt += `\n\n--- NEW SESSION: TOPIC DIRECTIVE ---
This is the first message after a learning session ended. You MUST immediately start discussing this topic:

Topic: ${topicSuggestion}

DO NOT ask if they want to discuss it - jump directly into the topic with engaging content.
Use direct, immediate engagement like:
- "Parliamo di..." (Let's talk about...)
- "Oggi esploriamo..." (Today we're exploring...)
- Start with an interesting fact or question about the topic

Be enthusiastic and dive right in. NO pleasantries or "would you like to..." - just start the conversation about this topic naturally.`;
  }
  
  return prompt;
}

/**
 * Adjust prompt to make responses simpler
 */
function adjustSystemPromptForSimplification(originalPrompt: string): string {
  return originalPrompt + '\n\nIMPORTANT: Your last response was too difficult. Please simplify your language:\n- Use even more basic vocabulary\n- Use shorter sentences\n- Reduce the number of new words\n- Stick to present tense when possible\n- MAINTAIN correct spelling and grammar';
}

/**
 * Adjust prompt to make responses more complex
 */
function adjustSystemPromptForComplexity(originalPrompt: string): string {
  return originalPrompt + '\n\nIMPORTANT: Your last response was too easy. Please increase complexity:\n- Introduce more vocabulary slightly above their level\n- Use more varied sentence structures\n- Include 2-3 new challenging words in context\n- Use a wider range of tenses\n- MAINTAIN correct spelling and grammar';
}

/**
 * Generate a chat response with conversation context
 */
export async function generateChatResponse(
  userId: string,
  userMessage: string,
  conversationHistory: Array<{ message_type: string; content: string }>,
  topicSuggestion?: string,
  conversationState?: 'initial_greeting' | 'in_topic' | 'transitioning'
): Promise<GeneratedResponse> {
  // Convert conversation history to ChatMessage format
  const history: ChatMessage[] = conversationHistory.map((msg) => ({
    role: msg.message_type === 'user' ? 'user' : 'assistant',
    content: msg.content,
  }));

  return generateComprehensibleResponse({
    userId,
    userMessage,
    conversationHistory: history,
    targetLanguage: 'Italian',
    topicSuggestion,
    conversationState,
  });
}

/**
 * Translate Italian words to English using OpenAI
 */
export async function translateItalianWords(
  words: string[]
): Promise<Array<{ word: string; translation: string; wordType?: string }>> {
  if (words.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  
  const prompt = `Translate the following Italian words to English. For each word, provide:
1. The Italian word (normalized/lowercase)
2. The English translation
3. The word type (noun, verb, adjective, etc.)

Return ONLY a JSON array with this exact format, no additional text:
[{"word": "italian_word", "translation": "english_translation", "wordType": "type"}]

Italian words to translate:
${words.join(', ')}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful Italian-English translator. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const responseContent = completion.choices[0]?.message?.content || '[]';
    
    // Try to extract JSON from the response
    let jsonMatch = responseContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseContent);
      return words.map(word => ({ word, translation: 'Translation unavailable', wordType: 'unknown' }));
    }

    const translations = JSON.parse(jsonMatch[0]) as Array<{ word: string; translation: string; wordType?: string }>;
    
    // Ensure all words are included
    const translationMap = new Map<string, { word: string; translation: string; wordType?: string }>(
      translations.map((t) => [
        t.word.toLowerCase(), 
        { word: t.word.toLowerCase(), translation: t.translation, wordType: t.wordType }
      ])
    );
    return words.map(word => {
      const normalized = word.toLowerCase();
      return translationMap.get(normalized) || { 
        word: normalized, 
        translation: 'Translation unavailable',
        wordType: 'unknown'
      };
    });
  } catch (error) {
    console.error('Error translating words:', error);
    // Return fallback translations
    return words.map(word => ({ 
      word: word.toLowerCase(), 
      translation: 'Translation unavailable',
      wordType: 'unknown'
    }));
  }
}

/**
 * Test OpenAI connection
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10,
    });
    return !!response.choices[0]?.message?.content;
  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    return false;
  }
}

