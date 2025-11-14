import { getOpenAIClient, OPENAI_MODELS, OPENAI_TEMPERATURES } from './openai-client';

export interface ReadingTextOptions {
  level: string; // CEFR level (A1-C2)
  vocabularyList: string[]; // Recently learned words to incorporate
  newsTopics?: string[]; // Optional pre-selected news topics
}

export interface GeneratedReadingText {
  title: string;
  content: string;
  sourceTopic: string;
  vocabularyUsed: string[];
}

export interface ComprehensionQuestion {
  questionType: 'multiple_choice' | 'free_text';
  questionText: string;
  correctAnswer: string;
  options?: string[]; // For multiple choice
  orderIndex: number;
}

export interface AnswerEvaluation {
  isCorrect: boolean;
  feedback: string;
  score: number; // 0-1 for partial credit
}

/**
 * Get trending positive news topics using simple prompting
 */
async function getPositiveNewsTopics(): Promise<string[]> {
  const client = getOpenAIClient();
  
  const prompt = `List 5 current positive news topics from around the world. Focus on:
- Scientific discoveries and breakthroughs
- Environmental progress and conservation success stories
- Cultural achievements and celebrations
- Technological innovations improving lives
- Human interest stories with uplifting outcomes
- Community initiatives and social progress

Return ONLY a JSON array of topics as strings, no additional text:
["topic1", "topic2", "topic3", "topic4", "topic5"]

Each topic should be 3-8 words describing a specific positive event or development.`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a news curator specializing in positive, educational stories. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const responseContent = completion.choices[0]?.message?.content || '[]';
    
    // Extract JSON from response
    const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON found in news topics response:', responseContent);
      return [
        'Scientific breakthrough in renewable energy',
        'Community initiative helps local environment',
        'Cultural festival celebrates diversity',
        'Technology improves accessibility for everyone',
        'Wildlife conservation success story'
      ];
    }

    const topics = JSON.parse(jsonMatch[0]) as string[];
    return topics.filter(t => t && t.length > 0).slice(0, 5);
  } catch (error) {
    console.error('Error fetching news topics:', error);
    // Return fallback topics
    return [
      'Scientific breakthrough in renewable energy',
      'Community initiative helps local environment',
      'Cultural festival celebrates diversity',
      'Technology improves accessibility for everyone',
      'Wildlife conservation success story'
    ];
  }
}

/**
 * Generate an Italian reading text based on news topics and user's level
 */
export async function generateNewsBasedText(
  options: ReadingTextOptions
): Promise<GeneratedReadingText> {
  const { level, vocabularyList, newsTopics } = options;
  const client = getOpenAIClient();
  
  // Get news topics if not provided
  const topics = newsTopics && newsTopics.length > 0 
    ? newsTopics 
    : await getPositiveNewsTopics();
  
  // Select one random topic
  const selectedTopic = topics[Math.floor(Math.random() * topics.length)];
  
  // Build vocabulary instruction
  const vocabInstruction = vocabularyList.length > 0
    ? `\n\nIMPORTANT - VOCABULARY INTEGRATION:
Try to naturally incorporate 3-5 of these recently learned words:
${vocabularyList.slice(0, 10).join(', ')}

Only use them if they fit naturally in the context. Don't force them.`
    : '';
  
  // Level-specific guidance
  const levelGuidance: Record<string, string> = {
    A1: 'Use very simple vocabulary and only present tense. Short, basic sentences.',
    A2: 'Use simple vocabulary and mostly present tense. Keep sentences straightforward.',
    B1: 'Use intermediate vocabulary. Mix present and past tense. Some compound sentences.',
    B2: 'Use varied vocabulary. Multiple tenses. More complex sentence structures.',
    C1: 'Use advanced vocabulary. All tenses. Complex and nuanced sentence structures.',
    C2: 'Use sophisticated vocabulary. Advanced structures. Literary and idiomatic expressions.',
  };
  
  const prompt = `Write a short Italian news story about this topic: "${selectedTopic}"

REQUIREMENTS:
1. Write entirely in ITALIAN with proper accents (è, é, à, ò, ù, ì)
2. CEFR level: ${level} - ${levelGuidance[level] || levelGuidance.B1}
3. Length: 150-250 words (approximately 8-12 sentences)
4. Make it positive, interesting, and culturally relevant
5. Include specific details that make it feel like a real news story
6. Use clear, correct Italian grammar and spelling${vocabInstruction}

Return ONLY a JSON object with this exact format, no additional text:
{
  "title": "Engaging Italian title for the story (5-10 words)",
  "content": "The full Italian text of the story",
  "sourceTopic": "Brief description of the news topic",
  "vocabularyUsed": ["list", "of", "Italian", "words", "from", "recent", "vocabulary"]
}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Italian language teacher and news writer. You create engaging, accurate Italian content for language learners. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const responseContent = completion.choices[0]?.message?.content || '{}';
    
    // Extract JSON from response
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in reading text response');
    }

    const result = JSON.parse(jsonMatch[0]) as GeneratedReadingText;
    
    // Validate result
    if (!result.title || !result.content || !result.sourceTopic) {
      throw new Error('Invalid reading text format');
    }
    
    return result;
  } catch (error) {
    console.error('Error generating reading text:', error);
    throw new Error(`Failed to generate reading text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate comprehension questions for a reading text
 */
export async function generateComprehensionQuestions(
  text: string,
  level: string
): Promise<ComprehensionQuestion[]> {
  const client = getOpenAIClient();
  
  const prompt = `Generate 4 comprehension questions for this Italian text. The questions should test understanding at CEFR level ${level}.

TEXT TO ANALYZE:
"${text}"

QUESTION REQUIREMENTS:
- Generate EXACTLY 4 questions
- Mix of 2 multiple choice + 2 free-text questions
- Questions can be in English or Italian (use English for A1-A2, Italian for B1+)
- Test different skills: main idea, specific details, inference, vocabulary
- Multiple choice: 4 options each, only one correct
- Free-text: Questions that require 1-2 sentence answers in Italian
- Difficulty appropriate for ${level} level

Return ONLY a JSON array with this exact format, no additional text:
[
  {
    "questionType": "multiple_choice",
    "questionText": "What is the main topic of the text?",
    "correctAnswer": "Option A text",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "orderIndex": 0
  },
  {
    "questionType": "free_text",
    "questionText": "Describe in Italian what happened in the story.",
    "correctAnswer": "Expected answer in Italian",
    "orderIndex": 1
  }
]`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Italian language teacher who creates effective comprehension questions. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseContent = completion.choices[0]?.message?.content || '[]';
    
    // Extract JSON from response
    const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON found in questions response');
    }

    const questions = JSON.parse(jsonMatch[0]) as ComprehensionQuestion[];
    
    // Validate and ensure correct order
    if (!Array.isArray(questions) || questions.length !== 4) {
      throw new Error('Expected exactly 4 questions');
    }
    
    // Ensure order indices are correct
    questions.forEach((q, idx) => {
      q.orderIndex = idx;
    });
    
    return questions;
  } catch (error) {
    console.error('Error generating questions:', error);
    throw new Error(`Failed to generate comprehension questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Evaluate a free-text answer using AI
 */
export async function evaluateFreeTextAnswer(
  questionText: string,
  correctAnswer: string,
  userAnswer: string
): Promise<AnswerEvaluation> {
  const client = getOpenAIClient();
  
  const prompt = `Evaluate this Italian language learner's answer to a comprehension question.

QUESTION: ${questionText}
EXPECTED ANSWER: ${correctAnswer}
USER'S ANSWER: ${userAnswer}

Evaluate based on:
1. Content accuracy - Does the answer capture the key information?
2. Italian language quality - Is the Italian grammatically correct and understandable?
3. Completeness - Does it fully address the question?

Be lenient with minor grammar errors. Focus on comprehension and communication.

Return ONLY a JSON object with this exact format, no additional text:
{
  "isCorrect": true or false (true if answer demonstrates understanding),
  "feedback": "Encouraging feedback in Italian explaining what was good and what could improve",
  "score": 0.0 to 1.0 (partial credit allowed: 0=wrong, 0.5=partially correct, 1.0=fully correct)
}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a supportive Italian language teacher who evaluates student answers fairly and provides constructive feedback. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent evaluation
      max_tokens: 300,
    });

    const responseContent = completion.choices[0]?.message?.content || '{}';
    
    // Extract JSON from response
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in evaluation response');
    }

    const evaluation = JSON.parse(jsonMatch[0]) as AnswerEvaluation;
    
    // Validate result
    if (typeof evaluation.isCorrect !== 'boolean' || 
        typeof evaluation.feedback !== 'string' || 
        typeof evaluation.score !== 'number') {
      throw new Error('Invalid evaluation format');
    }
    
    // Ensure score is in valid range
    evaluation.score = Math.max(0, Math.min(1, evaluation.score));
    
    return evaluation;
  } catch (error) {
    console.error('Error evaluating answer:', error);
    // Return a neutral evaluation on error
    return {
      isCorrect: false,
      feedback: 'Non sono riuscito a valutare la tua risposta. Riprova più tardi.',
      score: 0,
    };
  }
}

