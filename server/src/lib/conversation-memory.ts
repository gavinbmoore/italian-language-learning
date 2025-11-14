/**
 * Conversation Memory Management
 * 
 * Handles long-term conversation context through:
 * - Automatic summarization of conversation history
 * - Extraction of key facts, topics, and preferences
 * - Intelligent retrieval of relevant memories for context
 */

import { eq, desc, and, sql, inArray, gt } from 'drizzle-orm';
import { getDatabase } from './db';
import { conversationMemory, conversations, type MemoryType } from '../schema/comprehensible-input';
import { getEnv } from './env';
import { getOpenAIClient, OPENAI_MODELS, OPENAI_TEMPERATURES } from './openai-client';

/**
 * Configuration for memory generation
 */
const MEMORY_CONFIG = {
  SUMMARY_INTERVAL: parseInt(getEnv('MEMORY_GENERATION_INTERVAL') || '20'), // Generate summary every N messages
  MAX_MEMORIES_PER_REQUEST: parseInt(getEnv('MAX_MEMORIES_PER_REQUEST') || '3'), // How many memories to include in context
  SUMMARY_MAX_TOKENS: 250, // Max tokens for generating summaries
  FACT_EXTRACTION_MAX_TOKENS: 150, // Max tokens for extracting facts
};

/**
 * Generate a summary of recent conversations
 */
export async function generateConversationSummary(
  userId: string,
  messageCount: number = 20
): Promise<string> {
  const db = await getDatabase();
  
  // Get recent conversation messages
  const recentMessages = await db
    .select()
    .from(conversations)
    .where(eq(conversations.user_id, userId))
    .orderBy(desc(conversations.created_at))
    .limit(messageCount);
  
  if (recentMessages.length === 0) {
    return '';
  }
  
  // Build conversation text
  const conversationText = recentMessages
    .reverse() // Oldest first
    .map(msg => `${msg.message_type === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');
  
  // Use GPT to generate a concise summary
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are summarizing an Italian language learning conversation. Create a brief summary (2-3 sentences) covering:
1. Main topics discussed
2. Key vocabulary or grammar points practiced
3. Any notable progress or patterns

Keep it concise and focus on what would be useful context for future conversations.`,
      },
      {
        role: 'user',
        content: `Summarize this conversation:\n\n${conversationText}`,
      },
    ],
    max_tokens: MEMORY_CONFIG.SUMMARY_MAX_TOKENS,
    temperature: 0.3,
  });
  
  return completion.choices[0]?.message?.content || '';
}

/**
 * Extract key facts from conversation text
 */
export async function extractKeyFacts(
  userId: string,
  conversationText: string
): Promise<Array<{ type: MemoryType; content: string; importance: number }>> {
  const client = getOpenAIClient();
  
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are extracting key facts from an Italian language learning conversation. Extract:
- User preferences (topics they enjoy, learning goals)
- Personal information the user shared (name, interests, profession)
- Topics discussed
- Common mistakes or corrections

Format as JSON object with a "facts" array: {"facts": [{"type": "fact|topic|preference|correction", "content": "the fact", "importance": 1-10}]}
Only extract genuinely useful information for future conversations. Be selective.`,
      },
      {
        role: 'user',
        content: `Extract key facts from:\n\n${conversationText}`,
      },
    ],
    max_tokens: MEMORY_CONFIG.FACT_EXTRACTION_MAX_TOKENS,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });
  
  try {
    const response = completion.choices[0]?.message?.content || '{"facts":[]}';
    const parsed = JSON.parse(response);
    const facts = parsed.facts || [];
    console.log(`Extracted ${facts.length} facts from conversation`);
    return facts;
  } catch (error) {
    console.error('Failed to parse extracted facts:', error);
    console.error('Response was:', completion.choices[0]?.message?.content);
    return [];
  }
}

/**
 * Store a memory in the database
 */
export async function storeMemory(
  userId: string,
  memoryType: MemoryType,
  content: string,
  importance: number = 5,
  context?: string,
  metadata?: any
): Promise<string> {
  const db = await getDatabase();
  const memoryId = `${userId}-memory-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  await db.insert(conversationMemory).values({
    id: memoryId,
    user_id: userId,
    memory_type: memoryType,
    content,
    importance: Math.max(1, Math.min(10, importance)), // Clamp to 1-10
    context,
    metadata,
  });
  
  return memoryId;
}

/**
 * Get relevant memories for a user
 * Returns most important and recently used memories
 */
export async function getRelevantMemories(
  userId: string,
  limit: number = MEMORY_CONFIG.MAX_MEMORIES_PER_REQUEST
): Promise<Array<{ type: MemoryType; content: string; importance: number }>> {
  try {
    const db = await getDatabase();
    
    // Fetch memories prioritized by importance and recency
    const memories = await db
      .select()
      .from(conversationMemory)
      .where(eq(conversationMemory.user_id, userId))
      .orderBy(
        desc(conversationMemory.importance),
        desc(conversationMemory.last_used_at)
      )
      .limit(limit);
    
    // Update last_used_at for retrieved memories
    if (memories.length > 0) {
      const memoryIds = memories.map(m => m.id);
      await db
        .update(conversationMemory)
        .set({ last_used_at: new Date() })
        .where(inArray(conversationMemory.id, memoryIds));
    }
    
    return memories.map(m => ({
      type: m.memory_type as MemoryType,
      content: m.content,
      importance: m.importance,
    }));
  } catch (error) {
    console.warn('Failed to retrieve memories (table may not exist yet):', error instanceof Error ? error.message : 'Unknown error');
    return []; // Return empty array if table doesn't exist yet
  }
}

/**
 * Get all memories for a user (for debugging/UI)
 */
export async function getAllMemories(userId: string, limit: number = 50) {
  const db = await getDatabase();
  
  return await db
    .select()
    .from(conversationMemory)
    .where(eq(conversationMemory.user_id, userId))
    .orderBy(desc(conversationMemory.created_at))
    .limit(limit);
}

/**
 * Delete a specific memory
 */
export async function deleteMemory(userId: string, memoryId: string): Promise<boolean> {
  const db = await getDatabase();
  
  const result = await db
    .delete(conversationMemory)
    .where(
      and(
        eq(conversationMemory.id, memoryId),
        eq(conversationMemory.user_id, userId)
      )
    );
  
  return true;
}

/**
 * Check if it's time to generate a new summary
 * Returns true if user has X+ messages since last summary
 */
export async function shouldGenerateSummary(userId: string): Promise<boolean> {
  try {
    const db = await getDatabase();
    
    // Get last summary time
    const lastSummary = await db
      .select()
      .from(conversationMemory)
      .where(
        and(
          eq(conversationMemory.user_id, userId),
          eq(conversationMemory.memory_type, 'summary')
        )
      )
      .orderBy(desc(conversationMemory.created_at))
      .limit(1);
    
    const lastSummaryTime = lastSummary[0]?.created_at || new Date(0);
    
    // Count messages since last summary
    const messagesSince = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(
        and(
          eq(conversations.user_id, userId),
          gt(conversations.created_at, lastSummaryTime)
        )
      );
    
    const count = Number(messagesSince[0]?.count || 0);
    return count >= MEMORY_CONFIG.SUMMARY_INTERVAL;
  } catch (error) {
    console.warn('Failed to check for summary generation (table may not exist yet):', error instanceof Error ? error.message : 'Unknown error');
    return false; // Don't generate if we can't check
  }
}

/**
 * Generate and store conversation summary and facts
 * Call this periodically (e.g., every 20 messages)
 */
export async function generateAndStoreMemories(userId: string): Promise<void> {
  try {
    // Generate summary
    const summary = await generateConversationSummary(userId, MEMORY_CONFIG.SUMMARY_INTERVAL);
    
    if (summary) {
      await storeMemory(userId, 'summary', summary, 7); // Summaries are fairly important
    }
    
    // Get recent messages for fact extraction
    const db = await getDatabase();
    const recentMessages = await db
      .select()
      .from(conversations)
      .where(eq(conversations.user_id, userId))
      .orderBy(desc(conversations.created_at))
      .limit(MEMORY_CONFIG.SUMMARY_INTERVAL);
    
    const conversationText = recentMessages
      .reverse()
      .map(msg => `${msg.message_type === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
    
    // Extract and store facts
    const facts = await extractKeyFacts(userId, conversationText);
    
    for (const fact of facts) {
      await storeMemory(userId, fact.type, fact.content, fact.importance);
    }
    
    console.log(`Generated memories for user ${userId}: 1 summary, ${facts.length} facts`);
  } catch (error) {
    console.error('Failed to generate memories:', error);
    // Don't throw - memory generation is non-critical
  }
}

/**
 * Format memories for inclusion in AI prompt
 */
export function formatMemoriesForPrompt(
  memories: Array<{ type: MemoryType; content: string; importance: number }>,
  lastSessionSummary?: string | null
): string {
  const sections: string[] = [];
  
  // Add last session summary at the top (highest priority)
  if (lastSessionSummary) {
    sections.push(`🔄 LAST SESSION RECAP (Continue from here):\n${lastSessionSummary}`);
  }
  
  if (memories.length === 0 && !lastSessionSummary) {
    return '';
  }
  
  // Group by type
  const summaries = memories.filter(m => m.type === 'summary');
  const lastSessionSummaries = memories.filter(m => m.type === 'last_session_summary');
  const facts = memories.filter(m => m.type === 'fact');
  const topics = memories.filter(m => m.type === 'topic');
  const preferences = memories.filter(m => m.type === 'preference');
  const corrections = memories.filter(m => m.type === 'correction');
  
  // Don't add last_session_summary from memories if we already have it from parameter
  if (!lastSessionSummary && lastSessionSummaries.length > 0) {
    sections.push(`🔄 LAST SESSION RECAP (Continue from here):\n${lastSessionSummaries[0].content}`);
  }
  
  if (summaries.length > 0) {
    sections.push(`Previous Conversation Context:\n${summaries.map(m => `- ${m.content}`).join('\n')}`);
  }
  
  if (facts.length > 0) {
    sections.push(`Known Facts About User:\n${facts.map(m => `- ${m.content}`).join('\n')}`);
  }
  
  if (topics.length > 0) {
    sections.push(`Topics Discussed:\n${topics.map(m => `- ${m.content}`).join('\n')}`);
  }
  
  if (preferences.length > 0) {
    sections.push(`User Preferences:\n${preferences.map(m => `- ${m.content}`).join('\n')}`);
  }
  
  if (corrections.length > 0) {
    sections.push(`Common Mistakes to Watch:\n${corrections.map(m => `- ${m.content}`).join('\n')}`);
  }
  
  // Add grammar weaknesses if available
  const grammarWeaknesses = memories.filter(m => m.type === 'grammar_weakness');
  if (grammarWeaknesses.length > 0) {
    sections.push(`Grammar Areas to Practice:\n${grammarWeaknesses.map(m => `- ${m.content}`).join('\n')}`);
  }
  
  return sections.join('\n\n');
}

/**
 * Get previously explored topics for a user
 * Returns topics with their depth of exploration
 */
export async function getExploredTopics(userId: string, limit: number = 10) {
  try {
    const db = await getDatabase();
    
    const exploredTopics = await db
      .select()
      .from(conversationMemory)
      .where(
        and(
          eq(conversationMemory.user_id, userId),
          eq(conversationMemory.memory_type, 'explored_topic')
        )
      )
      .orderBy(desc(conversationMemory.last_used_at))
      .limit(limit);
    
    return exploredTopics.map(topic => ({
      id: topic.id,
      content: topic.content,
      depth: (topic.metadata as any)?.depth || 1,
      engagement: (topic.metadata as any)?.engagement || 'medium',
      lastUsed: topic.last_used_at,
      createdAt: topic.created_at,
    }));
  } catch (error) {
    console.warn('Failed to retrieve explored topics:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Store or update an explored topic
 * If topic already exists, increment depth
 */
export async function storeExploredTopic(
  userId: string,
  topic: string,
  engagement: 'low' | 'medium' | 'high' = 'medium'
): Promise<void> {
  try {
    const db = await getDatabase();
    
    // Check if topic already exists
    const existing = await db
      .select()
      .from(conversationMemory)
      .where(
        and(
          eq(conversationMemory.user_id, userId),
          eq(conversationMemory.memory_type, 'explored_topic'),
          eq(conversationMemory.content, topic)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing topic - increment depth
      const currentDepth = (existing[0].metadata as any)?.depth || 1;
      await db
        .update(conversationMemory)
        .set({
          last_used_at: new Date(),
          metadata: { depth: currentDepth + 1, engagement },
        })
        .where(eq(conversationMemory.id, existing[0].id));
      
      console.log(`Updated explored topic "${topic}" - depth now ${currentDepth + 1}`);
    } else {
      // Create new topic
      await storeMemory(userId, 'explored_topic', topic, 6, undefined, {
        depth: 1,
        engagement,
      });
      
      console.log(`Stored new explored topic: "${topic}"`);
    }
  } catch (error) {
    console.error('Failed to store explored topic:', error);
  }
}

/**
 * Generate a topic suggestion based on user's history and context
 * Uses OpenAI to suggest a relevant, engaging topic
 */
export async function generateTopicSuggestion(
  userId: string,
  userMessage: string
): Promise<string | null> {
  try {
    const client = getOpenAIClient();
    
    // Get user's memories and explored topics
    const memories = await getRelevantMemories(userId, 5);
    const exploredTopics = await getExploredTopics(userId, 10);
    
    // Get user's proficiency level
    const { getUserProficiency } = await import('./comprehensible-input');
    const proficiency = await getUserProficiency(userId);
    
    // Build context for topic suggestion
    const memoryContext = formatMemoriesForPrompt(memories);
    const exploredTopicsText = exploredTopics.length > 0
      ? `Previously explored topics:\n${exploredTopics.map(t => `- ${t.content} (explored ${t.depth} time${t.depth > 1 ? 's' : ''})`).join('\n')}`
      : 'No topics explored yet - this is a great opportunity for a fresh start!';
    
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are suggesting a new Italian language learning topic for a student at CEFR level ${proficiency.level}.

Your task: Suggest ONE specific, engaging topic the user might enjoy exploring today.

Guidelines:
1. Consider their proficiency level (${proficiency.level}) - suggest age-appropriate topics
2. Reference their interests and memories if available
3. Avoid recently explored topics unless suggesting a deeper angle
4. Make it conversational and culturally relevant to Italian life/culture
5. Keep the suggestion brief (1-2 sentences max)
6. Return ONLY the topic suggestion in Italian, nothing else

The topic should be something specific they can have a conversation about, not too broad.

Examples (adjust complexity for level):
- A1/A2: "la colazione italiana" (Italian breakfast), "i mezzi di trasporto" (transportation)
- B1/B2: "le tradizioni regionali italiane" (regional traditions), "il sistema scolastico italiano" (Italian school system)
- C1/C2: "l'influenza della politica sulla società" (political influence on society), "le sfide ambientali in Italia" (environmental challenges in Italy)

User context:
${memoryContext}

${exploredTopicsText}`,
        },
        {
          role: 'user',
          content: `The user just said: "${userMessage}"

Suggest an engaging topic for today's conversation that would interest them.`,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });
    
    const suggestion = completion.choices[0]?.message?.content?.trim() || null;
    
    if (suggestion) {
      console.log(`Generated topic suggestion for user ${userId}: "${suggestion}"`);
    }
    
    return suggestion;
  } catch (error) {
    console.error('Failed to generate topic suggestion:', error);
    return null;
  }
}

/**
 * Store grammar weakness insights in conversation memory
 * Called periodically to track patterns in user's grammar errors
 */
export async function storeGrammarWeaknesses(userId: string): Promise<void> {
  try {
    const { getGrammarInsightsForMemory } = await import('./grammar-analysis');
    const insights = await getGrammarInsightsForMemory(userId);
    
    if (insights.length === 0) {
      return;
    }
    
    // Store each insight as a grammar_weakness memory
    for (const insight of insights) {
      await storeMemory(userId, 'grammar_weakness' as MemoryType, insight, 7);
    }
    
    console.log(`Stored ${insights.length} grammar weakness insights for user ${userId}`);
  } catch (error) {
    console.error('Failed to store grammar weaknesses:', error);
  }
}

/**
 * Get a summary of the user's last completed learning session
 * Returns a brief contextual summary to help maintain conversation continuity
 */
export async function getLastSessionSummary(userId: string): Promise<string | null> {
  try {
    const db = await getDatabase();
    const { learningSessions } = await import('../schema/comprehensible-input');
    
    // Get the most recent completed (non-active) session
    const recentSessions = await db
      .select()
      .from(learningSessions)
      .where(
        and(
          eq(learningSessions.user_id, userId),
          eq(learningSessions.is_active, false)
        )
      )
      .orderBy(desc(learningSessions.end_time))
      .limit(1);
    
    if (recentSessions.length === 0) {
      return null; // No completed sessions yet
    }
    
    const lastSession = recentSessions[0];
    
    // Check if we already have a cached summary for this session
    const existingSummary = await db
      .select()
      .from(conversationMemory)
      .where(
        and(
          eq(conversationMemory.user_id, userId),
          eq(conversationMemory.memory_type, 'last_session_summary'),
          sql`${conversationMemory.metadata}->>'sessionId' = ${lastSession.id}`
        )
      )
      .limit(1);
    
    if (existingSummary.length > 0 && existingSummary[0].content) {
      // Update last_used_at and return cached summary
      await db
        .update(conversationMemory)
        .set({ last_used_at: new Date() })
        .where(eq(conversationMemory.id, existingSummary[0].id));
      
      return existingSummary[0].content;
    }
    
    // No cached summary - generate one
    const sessionMessages = await db
      .select()
      .from(conversations)
      .where(eq(conversations.session_id, lastSession.id))
      .orderBy(conversations.created_at)
      .limit(20); // Get up to 20 messages from the session
    
    if (sessionMessages.length === 0) {
      return null;
    }
    
    // Build conversation text for summarization
    const conversationText = sessionMessages
      .map(msg => `${msg.message_type === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
    
    // Generate summary using OpenAI
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Create a brief 2-3 sentence summary of this Italian learning conversation that will help continue the conversation naturally next time.

Focus on:
1. Main topics discussed
2. Key vocabulary or concepts practiced
3. What could be explored next

Write in a way that can be directly used to provide context for the next conversation. Be specific and actionable.`,
        },
        {
          role: 'user',
          content: `Summarize this conversation:\n\n${conversationText}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });
    
    const summary = completion.choices[0]?.message?.content?.trim() || null;
    
    // Cache the summary in the database
    if (summary) {
      await storeMemory(
        userId,
        'last_session_summary',
        summary,
        10, // High importance - this is crucial for continuity
        undefined,
        { sessionId: lastSession.id }
      );
    }
    
    return summary;
  } catch (error) {
    console.error('Failed to get last session summary:', error);
    return null;
  }
}

