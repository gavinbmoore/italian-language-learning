// import 'dotenv/config'; // Disabled for Vercel - uses environment variables directly
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { getDatabase, testDatabaseConnection } from './lib/db';
import { setEnvContext, clearEnvContext, getDatabaseUrl, getEnv } from './lib/env';
import * as schema from './schema/users';
import {
  analyzeComprehensibility,
  trackVocabulary,
  getUserProficiency,
  updateUserProficiency,
  shouldAdjustComplexity,
  saveConversation,
  autoLearnVocabulary,
  inferUserLevelFromMessage,
  bootstrapVocabularyForLevel,
  getConversationsBySession,
  getRecentSessions,
  deleteOldSessions,
} from './lib/comprehensible-input';
import {
  startLearningSession,
  updateLearningSession,
  endLearningSession,
  getTotalLearningTime,
  getActiveSession,
  getLearningStats,
  getLearningSessionHistory,
  isFirstMessageAfterSessionEnd,
  getDailyActivityStats,
} from './lib/learning-time';
import { generateChatResponse, testOpenAIConnection, translateItalianWords } from './lib/openai-chat';
import {
  shouldGenerateSummary,
  generateAndStoreMemories,
  getAllMemories,
  deleteMemory,
  generateTopicSuggestion,
  storeExploredTopic,
  getLastSessionSummary,
} from './lib/conversation-memory';
import {
  getCardsDueForReview,
  getAllFlashcards,
  getHardFlashcards,
  getDueCardCount,
  reviewCard,
  getFlashcardStats,
  getLearnedWordsStats,
} from './lib/spaced-repetition';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { conversations, vocabulary } from './schema/comprehensible-input';

type Env = {
  RUNTIME?: string;
  [key: string]: any;
};

const app = new Hono<{ Bindings: Env }>();

// Utility function to get authenticated user (with dev mode fallback)
function getAuthenticatedUser(c: any): { id: string; email?: string; display_name?: string } {
  const user = c.get('user');
  
  // In development, if no user is authenticated, use demo user as fallback
  if (!user || !user.id) {
    const isDev = getEnv('NODE_ENV') !== 'production';
    
    if (isDev) {
      console.warn('⚠️  No authenticated user found, using demo user for development');
      return {
        id: 'demo-user-123',
        email: 'demo@example.com',
        display_name: 'Demo User',
      };
    }
    
    throw new Error('Authentication required');
  }
  
  return user;
}

// Utility function to format error responses safely
function formatErrorResponse(error: unknown, customMessage: string = 'An error occurred') {
  const isDev = getEnv('NODE_ENV') === 'development';
  
  if (isDev) {
    return {
      error: customMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    };
  }
  
  return {
    error: customMessage,
  };
}

// Rate limiting implementation
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function createRateLimiter(maxRequests: number, windowMs: number) {
  return async (c: any, next: any) => {
    // Get identifier (IP address or user ID)
    const identifier = c.req.header('x-forwarded-for') || 
                      c.req.header('x-real-ip') || 
                      'unknown';
    
    const key = `${identifier}:${c.req.path}`;
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    
    // Create new record or reset if window expired
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, record);
    }
    
    // Increment count
    record.count++;
    
    // Check if limit exceeded
    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return c.json(
        { 
          error: 'Too many requests',
          retryAfter: retryAfter,
        },
        429,
        {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': record.resetTime.toString(),
        }
      );
    }
    
    // Set rate limit headers
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    c.header('X-RateLimit-Reset', record.resetTime.toString());
    
    await next();
  };
}

// Input validation utilities
function validateString(value: unknown, fieldName: string, minLength: number = 1, maxLength: number = 10000): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} character(s)`);
  }
  
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must not exceed ${maxLength} characters`);
  }
  
  return trimmed;
}

function validateStringArray(value: unknown, fieldName: string, maxItems: number = 100, maxItemLength: number = 100): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  
  if (value.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  
  if (value.length > maxItems) {
    throw new Error(`${fieldName} cannot exceed ${maxItems} items`);
  }
  
  const validated: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== 'string') {
      throw new Error(`${fieldName}[${i}] must be a string`);
    }
    
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      throw new Error(`${fieldName}[${i}] cannot be empty`);
    }
    
    if (trimmed.length > maxItemLength) {
      throw new Error(`${fieldName}[${i}] must not exceed ${maxItemLength} characters`);
    }
    
    validated.push(trimmed);
  }
  
  return validated;
}

function validateNumber(value: unknown, fieldName: string, min?: number, max?: number): number {
  const num = Number(value);
  
  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  
  if (min !== undefined && num < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }
  
  if (max !== undefined && num > max) {
    throw new Error(`${fieldName} must not exceed ${max}`);
  }
  
  return num;
}

// In Node.js environment, set environment context from process.env
if (typeof process !== 'undefined' && process.env) {
  setEnvContext(process.env);
}

// Environment context middleware - detect runtime using RUNTIME env var
app.use('*', async (c, next) => {
  if (c.env?.RUNTIME === 'cloudflare') {
    setEnvContext(c.env);
  }
  
  await next();
  // No need to clear context - env vars are the same for all requests
  // In fact, clearing the context would cause the env vars to potentially be unset for parallel requests
});

// Middleware
app.use('*', logger());
app.use('*', cors());

// Global rate limiting: 100 requests per 15 minutes per IP
app.use('/api/*', createRateLimiter(100, 15 * 60 * 1000));

// Health check route - public
app.get('/', (c) => c.json({ status: 'ok', message: 'API is running' }));

// API routes
const api = new Hono();

// Public routes go here (if any)
api.get('/hello', (c) => {
  return c.json({
    message: 'Hello from Hono!',
  });
});

// Database test route - public for testing
api.get('/db-test', async (c) => {
  try {
    // Use external DB URL if available, otherwise use local PostgreSQL database server
    // Note: In development, the port is dynamically allocated by port-manager.js
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    
    const db = await getDatabase(dbUrl);
    const isHealthy = await testDatabaseConnection();
    
    if (!isHealthy) {
      return c.json({
        error: 'Database connection is not healthy',
        timestamp: new Date().toISOString(),
      }, 500);
    }
    
    const result = await db.select().from(schema.users).limit(5);
    
    return c.json({
      message: 'Database connection successful!',
      users: result,
      connectionHealthy: isHealthy,
      usingLocalDatabase: !getDatabaseUrl(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database test error:', error);
    return c.json({
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// Protected routes - require authentication
const protectedRoutes = new Hono();

protectedRoutes.use('*', authMiddleware);

protectedRoutes.get('/me', (c) => {
  const user = c.get('user');
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      photo_url: user.photo_url,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    message: 'You are authenticated!',
  });
});

// Comprehensible Input (i+1) endpoints
const comprehensibleInputRoutes = new Hono();
// TODO: Re-enable auth middleware when authentication is working
// comprehensibleInputRoutes.use('*', authMiddleware);

// Stricter rate limiting for AI generation endpoints: 20 requests per 5 minutes
const aiGenerationRateLimit = createRateLimiter(20, 5 * 60 * 1000);

// Get user proficiency level with smart fallbacks
comprehensibleInputRoutes.get('/proficiency', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    // Get proficiency from database
    let proficiency = await getUserProficiency(userId);
    
    // If new user with 0 vocabulary, try to infer level from recent messages
    if (proficiency.vocabulary_size === 0) {
      const db = await getDatabase();
      const recentUserMessages = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.user_id, userId),
            eq(conversations.message_type, 'user')
          )
        )
        .orderBy(desc(conversations.created_at))
        .limit(5);
      
      // If user has sent messages, infer their level
      if (recentUserMessages.length > 0) {
        const combinedText = recentUserMessages.map((m: any) => m.content).join(' ');
        const inferred = inferUserLevelFromMessage(combinedText);
        
        // Only bootstrap if confidence is reasonable
        if (inferred.confidence >= 0.5) {
          console.log(`Inferring level ${inferred.level} for user ${userId} with confidence ${inferred.confidence}`);
          
          // Bootstrap vocabulary based on inferred level
          await bootstrapVocabularyForLevel(userId, inferred.level);
          
          // Reload proficiency after bootstrapping
          proficiency = await getUserProficiency(userId);
        }
      }
    }
    
    return c.json({ proficiency });
  } catch (error) {
    console.error('Error fetching proficiency:', error);
    return c.json(
      { error: 'Failed to fetch proficiency', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Analyze text for comprehensibility
comprehensibleInputRoutes.post('/analyze', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return c.json({ error: 'Text is required' }, 400);
    }

    // For demo mode, return mock analysis without database operations
    const wordCount = text.split(/\s+/).length;
    const mockAnalysis = {
      comprehensibilityScore: 0.85,
      newWords: [],
      knownWords: [],
      newWordList: [],
      knownWordList: [],
      totalWords: wordCount,
      difficulty: 'appropriate',
      suggestion: 'Good comprehensibility level!',
    };

    return c.json({
      analysis: mockAnalysis,
      adjustment: 'maintain',
      targetComprehensibility: 0.825,
    });
  } catch (error) {
    console.error('Error analyzing text:', error);
    return c.json(
      { error: 'Failed to analyze text', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Send a message (user input)
comprehensibleInputRoutes.post('/conversation/message', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Message is required' }, 400);
    }

    // For demo mode, return mock analysis without database operations
    const mockAnalysis = {
      comprehensibilityScore: 0.85,
      newWords: [],
      knownWords: [],
      newWordList: [],
      knownWordList: [],
      totalWords: message.split(/\s+/).length,
    };

    return c.json({
      conversationId: 'demo-conv-' + Date.now(),
      analysis: mockAnalysis,
      message: 'Message saved successfully',
    });
  } catch (error) {
    console.error('Error saving message:', error);
    return c.json(
      { error: 'Failed to save message', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Generate AI response using ChatGPT with i+1 adjustment and memory system
comprehensibleInputRoutes.post('/conversation/generate', aiGenerationRateLimit, async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const body = await c.req.json();
    
    // Validate input
    const userMessage = validateString(body.userMessage, 'userMessage', 1, 5000);
    const sessionId = body.sessionId ? validateString(body.sessionId, 'sessionId', 1, 100) : undefined;

    // Save user message to conversation history with session ID
    const userConversationId = await saveConversation(user.id, 'user', userMessage, undefined, sessionId);

    // Get recent conversation history for context
    const db = await getDatabase();
    const history = await db
      .select()
      .from(conversations)
      .where(eq(conversations.user_id, user.id))
      .orderBy(desc(conversations.created_at))
      .limit(10);

    // Track vocabulary from user's message (mark as understood since they produced it)
    const userAnalysis = await analyzeComprehensibility(user.id, userMessage);
    await trackVocabulary(user.id, userAnalysis.newWordList, true);

    // Determine conversation state based on message count
    const totalMessages = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(eq(conversations.user_id, user.id));
    const messageCount = Number(totalMessages[0]?.count || 0);
    
    // Determine if we should skip greetings (after first 2 messages ever)
    const shouldSkipGreetings = messageCount > 2;

    // Check if this is the first message after a session ended
    const isNewSession = await isFirstMessageAfterSessionEnd(user.id);
    let topicSuggestion: string | null = null;
    
    if (isNewSession && shouldSkipGreetings) {
      console.log(`🎯 New session detected for user ${user.id} - generating topic suggestion...`);
      topicSuggestion = await generateTopicSuggestion(user.id, userMessage);
      
      if (topicSuggestion) {
        console.log(`✨ Topic suggestion: "${topicSuggestion}"`);
      }
    }

    // Determine conversation state for this message
    let conversationState = 'in_topic';
    if (messageCount <= 2 && !shouldSkipGreetings) {
      conversationState = 'initial_greeting';
    }

    // Analyze user message for grammar errors (async, don't block conversation)
    // This will happen in parallel with the AI response generation
    const grammarAnalysisPromise = (async () => {
      try {
        const { analyzeGrammarErrors, trackGrammarInConversation } = await import('./lib/grammar-analysis');
        const grammarAnalysis = await analyzeGrammarErrors(user.id, userMessage);
        
        if (grammarAnalysis.hasErrors && grammarAnalysis.errors.length > 0) {
          console.log(`📝 Found ${grammarAnalysis.errorCount} grammar errors in user message`);
          
          // Track errors in database
          await trackGrammarInConversation(
            user.id,
            userConversationId,
            sessionId || null,
            userMessage,
            grammarAnalysis.errors
          );
        }
        
        return grammarAnalysis;
      } catch (error) {
        console.error('Error analyzing grammar:', error);
        return null;
      }
    })();

    // Generate AI response with comprehensible input and memory context
    const generatedResponse = await generateChatResponse(
      user.id,
      userMessage,
      history.reverse(), // Oldest first for context
      topicSuggestion || undefined,
      conversationState as 'initial_greeting' | 'in_topic' | 'transitioning'
    );

    // Track new vocabulary from AI response (initially not understood)
    const analysis = await analyzeComprehensibility(user.id, generatedResponse.content);
    await trackVocabulary(user.id, analysis.newWordList, false);

    // Auto-learn vocabulary based on patterns
    const learnedCount = await autoLearnVocabulary(user.id);
    if (learnedCount > 0) {
      console.log(`Auto-learned ${learnedCount} words for user ${user.id}`);
    }

    // Save assistant response with session ID
    const conversationId = await saveConversation(user.id, 'assistant', generatedResponse.content, {
      comprehensibilityScore: analysis.comprehensibilityScore,
      newWords: analysis.newWordList,
      knownWords: analysis.knownWordList,
      totalWords: analysis.totalWords,
    }, sessionId);

    // Update proficiency
    await updateUserProficiency(user.id);

    // Store the suggested topic if one was generated
    if (topicSuggestion && isNewSession) {
      await storeExploredTopic(user.id, topicSuggestion, 'medium');
    }

    // Auto-generate memories if threshold reached (async, don't wait)
    shouldGenerateSummary(user.id).then(async (should) => {
      if (should) {
        console.log(`🧠 Auto-generating memories for user ${user.id}...`);
        try {
          await generateAndStoreMemories(user.id);
          console.log(`✅ Memories generated for user ${user.id}`);
        } catch (error) {
          console.error(`❌ Failed to auto-generate memories for user ${user.id}:`, error);
        }
      }
    }).catch(err => {
      console.error('Error checking if memories should be generated:', err);
    });

    // Wait for grammar analysis to complete (but don't block if it takes too long)
    const grammarAnalysis = await Promise.race([
      grammarAnalysisPromise,
      new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3s timeout
    ]);

    return c.json({
      conversationId,
      response: generatedResponse.content,
      comprehensibilityScore: analysis.comprehensibilityScore,
      adjustment: generatedResponse.adjustment,
      tokensUsed: generatedResponse.tokensUsed,
      analysis,
      isNewSession,
      suggestedTopic: topicSuggestion,
      grammarAnalysis: grammarAnalysis || undefined, // Include grammar analysis if available
      message: 'AI response generated successfully',
    });
  } catch (error) {
    console.error('Error generating AI response:', error);
    console.error('Full error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return validation errors with 400 status
    if (error instanceof Error && error.message.includes('must')) {
      return c.json({ error: error.message }, 400);
    }
    
    return c.json(formatErrorResponse(error, 'Failed to generate AI response'), 500);
  }
});

// Get AI response (assistant response with i+1 adjustment)
comprehensibleInputRoutes.post('/conversation/response', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const { userMessage, assistantResponse } = body;

    if (!assistantResponse || typeof assistantResponse !== 'string') {
      return c.json({ error: 'Assistant response is required' }, 400);
    }

    // Analyze assistant response
    const analysis = await analyzeComprehensibility(userId, assistantResponse);
    const adjustment = shouldAdjustComplexity(analysis.comprehensibilityScore);

    // Track new vocabulary
    await trackVocabulary(userId, analysis.newWordList, false); // Not yet understood

    // Save assistant response
    const conversationId = await saveConversation(userId, 'assistant', assistantResponse, {
      comprehensibilityScore: analysis.comprehensibilityScore,
      newWords: analysis.newWordList,
      knownWords: analysis.knownWordList,
      totalWords: analysis.totalWords,
    });

    // Update proficiency
    await updateUserProficiency(userId);

    return c.json({
      conversationId,
      analysis,
      adjustment,
      response: assistantResponse,
      message: 'Response saved successfully',
    });
  } catch (error) {
    console.error('Error saving response:', error);
    return c.json(
      { error: 'Failed to save response', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Mark words as known
comprehensibleInputRoutes.post('/vocabulary/mark-known', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const { words } = body;

    if (!Array.isArray(words)) {
      return c.json({ error: 'Words array is required' }, 400);
    }

    const db = await getDatabase();
    const updatedWords = [];

    for (const word of words) {
      const normalized = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      
      await db
        .update(vocabulary)
        .set({ is_known: true })
        .where(and(eq(vocabulary.word, normalized), eq(vocabulary.user_id, userId)));

      updatedWords.push(normalized);
    }

    // Update proficiency after marking words
    await updateUserProficiency(userId);

    return c.json({
      message: 'Words marked as known',
      words: updatedWords,
    });
  } catch (error) {
    console.error('Error marking words:', error);
    return c.json(
      { error: 'Failed to mark words', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get conversation history
comprehensibleInputRoutes.get('/conversation/history', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    // Return empty history for demo mode (no database query)
    return c.json({ history: [], count: 0 });
  } catch (error) {
    console.error('Error fetching history:', error);
    return c.json(
      { error: 'Failed to fetch history', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get recent conversation sessions
comprehensibleInputRoutes.get('/sessions/recent', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const limit = parseInt(c.req.query('limit') || '5');
    
    const sessions = await getRecentSessions(user.id, limit);
    
    return c.json({
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error('Error fetching recent sessions:', error);
    return c.json(
      { error: 'Failed to fetch recent sessions', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get messages for a specific session
comprehensibleInputRoutes.get('/sessions/:sessionId/messages', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    
    if (!sessionId) {
      return c.json({ error: 'Session ID is required' }, 400);
    }
    
    const messages = await getConversationsBySession(sessionId);
    
    return c.json({
      messages,
      count: messages.length,
      sessionId,
    });
  } catch (error) {
    console.error('Error fetching session messages:', error);
    return c.json(
      { error: 'Failed to fetch session messages', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// End current session and cleanup old sessions
comprehensibleInputRoutes.post('/sessions/end', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const body = await c.req.json();
    const { sessionId } = body;
    
    if (!sessionId) {
      return c.json({ error: 'Session ID is required' }, 400);
    }
    
    // End the current session
    await endLearningSession(user.id, sessionId);
    
    // Delete old sessions (keep only 5 most recent)
    const deletedCount = await deleteOldSessions(user.id, 5);
    
    console.log(`Session ${sessionId} ended. Deleted ${deletedCount} old sessions.`);
    
    return c.json({
      success: true,
      sessionEnded: sessionId,
      oldSessionsDeleted: deletedCount,
    });
  } catch (error) {
    console.error('Error ending session:', error);
    return c.json(
      { error: 'Failed to end session', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get vocabulary list
comprehensibleInputRoutes.get('/vocabulary', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const known = c.req.query('known'); // 'true', 'false', or undefined for all
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    // Return empty vocabulary for demo mode (no database query)
    return c.json({ vocabulary: [], count: 0 });
  } catch (error) {
    console.error('Error fetching vocabulary:', error);
    return c.json(
      { error: 'Failed to fetch vocabulary', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Translate Italian words to English
comprehensibleInputRoutes.post('/vocabulary/translate', aiGenerationRateLimit, async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const body = await c.req.json();
    
    // Validate input
    const words = validateStringArray(body.words, 'words', 50, 100);

    const translations = await translateItalianWords(words);

    return c.json({
      translations,
      count: translations.length,
    });
  } catch (error) {
    console.error('Error translating words:', error);
    
    // Return validation errors with 400 status
    if (error instanceof Error && error.message.includes('must')) {
      return c.json({ error: error.message }, 400);
    }
    
    return c.json(formatErrorResponse(error, 'Failed to translate words'), 500);
  }
});

// Save unknown words to vocabulary
comprehensibleInputRoutes.post('/vocabulary/save-unknown', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const body = await c.req.json();
    const { words, sessionId } = body;

    if (!Array.isArray(words) || words.length === 0) {
      return c.json({ error: 'Words array is required' }, 400);
    }

    const db = await getDatabase();
    const savedWords: string[] = [];
    
    // Prepare word data (FIX: eliminate N+1 pattern)
    const normalizedWords = words.map((w: any) => w.word.toLowerCase().trim());
    const wordMap = new Map(words.map((w: any) => [w.word.toLowerCase().trim(), w]));
    
    // Fetch all existing words in one query
    const existingWords = await db
      .select()
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.user_id, user.id),
          inArray(vocabulary.word, normalizedWords)
        )
      );
    
    const existingWordMap = new Map(existingWords.map(w => [w.word, w]));
    
    // Calculate initial next review date (1 day from now)
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + 1);
    const now = new Date();
    
    // Prepare batch operations
    const wordsToUpdate: Array<{id: string; sentence: string; translation: string | null}> = [];
    const wordsToInsert: any[] = [];
    
    for (const wordObj of words) {
      const { word, sentence, translation } = wordObj;
      const normalized = word.toLowerCase().trim();
      const existing = existingWordMap.get(normalized);
      
      if (existing) {
        wordsToUpdate.push({
          id: existing.id,
          sentence,
          translation: translation || null
        });
        savedWords.push(normalized);
      } else {
        wordsToInsert.push({
          id: `${user.id}-${normalized}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          user_id: user.id,
          word: normalized,
          word_original: word,
          frequency_rank: 99999,
          difficulty_level: 'A1',
          times_encountered: 1,
          times_understood: 0,
          is_known: false,
          last_encountered: now,
          is_flashcard: true,
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          next_review_date: nextReviewDate,
          example_sentence: sentence,
          translation: translation || null,
        });
        savedWords.push(normalized);
      }
    }
    
    // Batch update existing words in parallel
    if (wordsToUpdate.length > 0) {
      await Promise.all(
        wordsToUpdate.map(item =>
          db
            .update(vocabulary)
            .set({
              times_encountered: sql`${vocabulary.times_encountered} + 1`,
              last_encountered: now,
              example_sentence: item.sentence,
              translation: item.translation,
              is_flashcard: true,
              ease_factor: 2.5,
              interval_days: 0,
              repetitions: 0,
              next_review_date: nextReviewDate,
            })
            .where(eq(vocabulary.id, item.id))
        )
      );
    }
    
    // Batch insert new words
    if (wordsToInsert.length > 0) {
      await db.insert(vocabulary).values(wordsToInsert);
    }

    // Update user proficiency after adding vocabulary
    await updateUserProficiency(user.id);

    // End the current session if sessionId is provided
    let sessionEnded = false;
    let oldSessionsDeleted = 0;
    
    if (sessionId) {
      try {
        await endLearningSession(user.id, sessionId);
        sessionEnded = true;
        
        // Delete old sessions (keep only 5 most recent)
        oldSessionsDeleted = await deleteOldSessions(user.id, 5);
        
        console.log(`Session ${sessionId} ended after saving vocabulary. Deleted ${oldSessionsDeleted} old sessions.`);
      } catch (sessionError) {
        console.error('Error ending session:', sessionError);
        // Don't fail the whole request if session ending fails
      }
    }

    return c.json({
      message: 'Unknown words saved successfully',
      savedWords,
      count: savedWords.length,
      sessionEnded,
      oldSessionsDeleted,
    });
  } catch (error) {
    console.error('Error saving unknown words:', error);
    return c.json(
      { error: 'Failed to save unknown words', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Memory Management Endpoints

// Generate memories manually (for testing/debugging)
comprehensibleInputRoutes.post('/memory/generate', aiGenerationRateLimit, async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    await generateAndStoreMemories(userId);
    
    return c.json({
      message: 'Memories generated successfully',
    });
  } catch (error) {
    console.error('Error generating memories:', error);
    return c.json(
      { error: 'Failed to generate memories', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get all stored memories for the user
comprehensibleInputRoutes.get('/memory', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const limit = parseInt(c.req.query('limit') || '50');
    
    const memories = await getAllMemories(userId, limit);
    
    return c.json({
      memories,
      count: memories.length,
    });
  } catch (error) {
    console.error('Error fetching memories:', error);
    return c.json(
      { error: 'Failed to fetch memories', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Delete a specific memory
comprehensibleInputRoutes.delete('/memory/:memoryId', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const memoryId = c.req.param('memoryId');
    
    if (!memoryId) {
      return c.json({ error: 'Memory ID is required' }, 400);
    }
    
    await deleteMemory(userId, memoryId);
    
    return c.json({
      message: 'Memory deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting memory:', error);
    return c.json(
      { error: 'Failed to delete memory', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get last session summary for conversation continuity
comprehensibleInputRoutes.get('/memory/last-session-summary', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    
    const summary = await getLastSessionSummary(user.id);
    
    return c.json({
      summary,
      hasSummary: summary !== null,
    });
  } catch (error) {
    console.error('Error fetching last session summary:', error);
    return c.json(
      { error: 'Failed to fetch last session summary', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Mount comprehensible input routes (directly under api, no auth required for dev)
// protectedRoutes.route('/comprehensible-input', comprehensibleInputRoutes);
api.route('/protected/comprehensible-input', comprehensibleInputRoutes);

// Learning Timer endpoints
const learningTimerRoutes = new Hono();
// TODO: Re-enable auth middleware when authentication is working
// learningTimerRoutes.use('*', authMiddleware);

// Start a learning session
learningTimerRoutes.post('/session/start', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const { pageContext } = body;

    const session = await startLearningSession(userId, pageContext || 'general');
    
    return c.json({
      session,
      message: 'Learning session started',
    });
  } catch (error) {
    console.error('Error starting learning session:', error);
    return c.json(
      { error: 'Failed to start session', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Update learning session (heartbeat)
learningTimerRoutes.post('/session/update', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const { sessionId, durationSeconds } = body;

    if (!sessionId || typeof durationSeconds !== 'number') {
      return c.json({ error: 'sessionId and durationSeconds are required' }, 400);
    }

    const result = await updateLearningSession(userId, sessionId, durationSeconds);
    
    return c.json({
      result,
      message: 'Learning session updated',
    });
  } catch (error) {
    console.error('Error updating learning session:', error);
    return c.json(
      { error: 'Failed to update session', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// End learning session
learningTimerRoutes.post('/session/end', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return c.json({ error: 'sessionId is required' }, 400);
    }

    const result = await endLearningSession(userId, sessionId);
    
    return c.json({
      result,
      message: 'Learning session ended',
    });
  } catch (error) {
    console.error('Error ending learning session:', error);
    return c.json(
      { error: 'Failed to end session', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get active session
learningTimerRoutes.get('/session/active', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const session = await getActiveSession(userId);
    
    return c.json({
      session,
      hasActiveSession: session !== null,
    });
  } catch (error) {
    console.error('Error fetching active session:', error);
    return c.json(
      { error: 'Failed to fetch active session', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get total learning time
learningTimerRoutes.get('/time/total', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const days = c.req.query('days') ? parseInt(c.req.query('days')!) : undefined;
    
    const timeData = await getTotalLearningTime(userId, days);
    
    return c.json(timeData);
  } catch (error) {
    console.error('Error fetching total time:', error);
    return c.json(
      { error: 'Failed to fetch total time', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get learning statistics
learningTimerRoutes.get('/stats', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const stats = await getLearningStats(userId);
    
    return c.json({ stats });
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    return c.json(
      { error: 'Failed to fetch learning stats', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get session history
learningTimerRoutes.get('/sessions', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const sessions = await getLearningSessionHistory(userId, limit, offset);
    
    return c.json({
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error('Error fetching session history:', error);
    return c.json(
      { error: 'Failed to fetch session history', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get activity data for heatmap
learningTimerRoutes.get('/activity', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const startDateStr = c.req.query('startDate');
    const endDateStr = c.req.query('endDate');

    if (!startDateStr || !endDateStr) {
      return c.json({ error: 'startDate and endDate query parameters are required' }, 400);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return c.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
    }

    const activityData = await getDailyActivityStats(userId, startDate, endDate);

    return c.json({
      activity: activityData,
    });
  } catch (error) {
    console.error('Error fetching activity data:', error);
    return c.json(
      { error: 'Failed to fetch activity data', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Flashcard / Spaced Repetition Routes
const flashcardRoutes = new Hono();

// Get cards due for review
flashcardRoutes.get('/due', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const dueCards = await getCardsDueForReview(userId);
    const dueCount = await getDueCardCount(userId);

    return c.json({
      cards: dueCards,
      count: dueCount,
    });
  } catch (error) {
    console.error('Error fetching due cards:', error);
    return c.json(
      { error: 'Failed to fetch due cards', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get all flashcards (for practice mode - not just due)
flashcardRoutes.get('/all', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const limit = parseInt(c.req.query('limit') || '20');
    
    const allCards = await getAllFlashcards(userId, limit);

    return c.json({
      cards: allCards,
      count: allCards.length,
    });
  } catch (error) {
    console.error('Error fetching all cards:', error);
    return c.json(
      { error: 'Failed to fetch cards', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get hard flashcards (struggled with in the past)
flashcardRoutes.get('/hard', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const limit = parseInt(c.req.query('limit') || '20');
    
    const hardCards = await getHardFlashcards(userId, limit);

    return c.json({
      cards: hardCards,
      count: hardCards.length,
    });
  } catch (error) {
    console.error('Error fetching hard cards:', error);
    return c.json(
      { error: 'Failed to fetch hard cards', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Review a flashcard
flashcardRoutes.post('/review', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    
    // Validate input
    const cardId = validateString(body.cardId, 'cardId', 1, 200);
    const quality = validateNumber(body.quality, 'quality', 0, 5);

    const result = await reviewCard(cardId, userId, quality);

    return c.json({
      message: 'Card reviewed successfully',
      result,
    });
  } catch (error) {
    console.error('Error reviewing card:', error);
    
    // Return validation errors with 400 status
    if (error instanceof Error && error.message.includes('must')) {
      return c.json({ error: error.message }, 400);
    }
    
    return c.json(formatErrorResponse(error, 'Failed to review card'), 500);
  }
});

// Get flashcard statistics
flashcardRoutes.get('/stats', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const stats = await getFlashcardStats(userId);

    return c.json({
      stats,
    });
  } catch (error) {
    console.error('Error fetching flashcard stats:', error);
    return c.json(
      { error: 'Failed to fetch flashcard stats', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Get learned words statistics (graduated flashcards)
flashcardRoutes.get('/learned-stats', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const stats = await getLearnedWordsStats(userId);

    return c.json({
      stats,
    });
  } catch (error) {
    console.error('Error fetching learned words stats:', error);
    return c.json(
      { error: 'Failed to fetch learned words stats', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// ========================================
// GRAMMAR ROUTES
// ========================================
const grammarRoutes = new Hono<{ Bindings: Env }>();

// Import grammar functions
import {
  analyzeGrammarErrors,
  identifyWeakConcepts,
  getRecentErrors,
  getGrammarStats,
  getErrorsByConceptId,
} from './lib/grammar-analysis';
import {
  generateExercises,
  saveExercise,
  evaluateExerciseAnswer,
  createPersonalizedDrill,
  getExerciseHistory,
  getExercisesByConcept,
  getExerciseStats,
} from './lib/grammar-exercises';
import {
  getGrammarConceptsDueForReview,
  getDueGrammarConceptCount,
  reviewGrammarConcept,
  initializeGrammarConceptReview,
  getGrammarMasteryStats,
} from './lib/spaced-repetition';

// Get all grammar concepts
grammarRoutes.get('/concepts', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const level = c.req.query('level'); // Filter by CEFR level
    const category = c.req.query('category'); // Filter by category
    
    const db = await getDatabase();
    const { grammarConcepts } = await import('./schema/grammar');
    
    // Build query with filters
    let query: any = db.select().from(grammarConcepts);
    
    if (level) {
      query = query.where(eq(grammarConcepts.cefr_level, level));
    }
    
    if (category) {
      query = query.where(eq(grammarConcepts.category, category));
    }
    
    const concepts = await query.orderBy(grammarConcepts.importance, grammarConcepts.cefr_level);
    
    return c.json({ concepts });
  } catch (error) {
    console.error('Error fetching grammar concepts:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch grammar concepts'), 500);
  }
});

// Get specific grammar concept by ID
grammarRoutes.get('/concepts/:id', async (c) => {
  try {
    const conceptId = c.req.param('id');
    const db = await getDatabase();
    const { grammarConcepts } = await import('./schema/grammar');
    
    const concepts = await db
      .select()
      .from(grammarConcepts)
      .where(eq(grammarConcepts.id, conceptId))
      .limit(1);
    
    if (concepts.length === 0) {
      return c.json({ error: 'Grammar concept not found' }, 404);
    }
    
    return c.json({ concept: concepts[0] });
  } catch (error) {
    console.error('Error fetching grammar concept:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch grammar concept'), 500);
  }
});

// Get grammar learning path - all concepts ordered by CEFR level with user progress
grammarRoutes.get('/learning-path', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const db = await getDatabase();
    const { grammarConcepts, userGrammarProgress } = await import('./schema/grammar');
    const { sql: drizzleSql } = await import('drizzle-orm');
    
    // Define CEFR level order
    const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    
    // Get all concepts ordered by CEFR level
    const allConcepts = await db
      .select()
      .from(grammarConcepts)
      .orderBy(grammarConcepts.cefr_level, grammarConcepts.importance);
    
    // Get user progress for all concepts
    const userProgress = await db
      .select()
      .from(userGrammarProgress)
      .where(eq(userGrammarProgress.user_id, userId));
    
    // Create a map of concept progress
    const progressMap = new Map(
      userProgress.map(p => [p.concept_id, p])
    );
    
    // Combine concepts with progress and add completion status
    const conceptsWithProgress = allConcepts.map(concept => {
      const progress = progressMap.get(concept.id);
      const hasWatchedVideo = progress?.has_watched_video || false;
      const exercisesCompleted = progress?.total_exercises_completed || 0;
      const isComplete = hasWatchedVideo && exercisesCompleted >= 5;
      
      return {
        ...concept,
        progress: progress ? {
          masteryLevel: progress.mastery_level,
          totalExercisesCompleted: progress.total_exercises_completed || 0,
          correctExercises: progress.correct_exercises || 0,
          errorCount: progress.error_count || 0,
          hasWatchedVideo: progress.has_watched_video || false,
          completedAt: progress.completed_at,
          lastReviewed: progress.last_reviewed,
        } : null,
        isComplete,
        hasWatchedVideo,
        exercisesCompleted,
        needsVideo: !hasWatchedVideo,
        needsExercises: exercisesCompleted < 5,
      };
    });
    
    // Group by CEFR level in proper order
    const groupedByLevel = cefrOrder.map(level => ({
      level,
      concepts: conceptsWithProgress.filter(c => c.cefr_level === level),
      completedCount: conceptsWithProgress.filter(c => c.cefr_level === level && c.isComplete).length,
      totalCount: conceptsWithProgress.filter(c => c.cefr_level === level).length,
    })).filter(group => group.totalCount > 0);
    
    // Calculate overall statistics
    const totalConcepts = allConcepts.length;
    const completedConcepts = conceptsWithProgress.filter(c => c.isComplete).length;
    const completionPercentage = totalConcepts > 0 ? (completedConcepts / totalConcepts) * 100 : 0;
    
    return c.json({
      learningPath: groupedByLevel,
      statistics: {
        totalConcepts,
        completedConcepts,
        completionPercentage: Math.round(completionPercentage),
        inProgress: conceptsWithProgress.filter(c => !c.isComplete && (c.hasWatchedVideo || c.exercisesCompleted > 0)).length,
        notStarted: conceptsWithProgress.filter(c => !c.hasWatchedVideo && c.exercisesCompleted === 0).length,
      },
    });
  } catch (error) {
    console.error('Error fetching grammar learning path:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch learning path'), 500);
  }
});

// Get YouTube videos for a grammar concept
grammarRoutes.get('/concepts/:id/videos', async (c) => {
  try {
    const conceptId = c.req.param('id');
    const db = await getDatabase();
    const { grammarConcepts } = await import('./schema/grammar');
    
    // Fetch the concept to get its name
    const concepts = await db
      .select()
      .from(grammarConcepts)
      .where(eq(grammarConcepts.id, conceptId))
      .limit(1);
    
    if (concepts.length === 0) {
      return c.json({ error: 'Grammar concept not found' }, 404);
    }
    
    const concept = concepts[0];
    
    // Search YouTube for videos
    const { searchYouTubeVideos } = await import('./lib/youtube-search');
    const videos = await searchYouTubeVideos(
      concept.name,
      concept.name_italian,
      { maxResults: 3 }
    );
    
    return c.json({ 
      videos,
      conceptName: concept.name,
      conceptNameItalian: concept.name_italian,
    });
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch YouTube videos'), 500);
  }
});

// Get user's weak grammar areas
grammarRoutes.get('/weak-areas', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const limit = parseInt(c.req.query('limit') || '10');
    
    const weakConcepts = await identifyWeakConcepts(userId, limit);
    
    return c.json({ weakConcepts });
  } catch (error) {
    console.error('Error fetching weak areas:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch weak areas'), 500);
  }
});

// Get recent grammar errors
grammarRoutes.get('/errors', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const limit = parseInt(c.req.query('limit') || '20');
    
    const errors = await getRecentErrors(userId, limit);
    
    return c.json({ errors });
  } catch (error) {
    console.error('Error fetching grammar errors:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch grammar errors'), 500);
  }
});

// Get errors for specific concept
grammarRoutes.get('/errors/concept/:conceptId', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const conceptId = c.req.param('conceptId');
    const limit = parseInt(c.req.query('limit') || '10');
    
    const errors = await getErrorsByConceptId(userId, conceptId, limit);
    
    return c.json({ errors });
  } catch (error) {
    console.error('Error fetching concept errors:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch concept errors'), 500);
  }
});

// Get grammar statistics
grammarRoutes.get('/stats', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const stats = await getGrammarStats(userId);
    
    return c.json({ stats });
  } catch (error) {
    console.error('Error fetching grammar stats:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch grammar stats'), 500);
  }
});

// Generate exercises for a concept
grammarRoutes.post('/exercises/generate', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const conceptId = validateString(body.conceptId, 'conceptId');
    const count = body.count ? parseInt(body.count) : 5;
    
    console.log(`📚 API: Generating ${count} exercises for concept ${conceptId}`);
    
    const exercises = await generateExercises(userId, conceptId, count);
    
    console.log(`✅ API: Generated ${exercises.length} exercises, now saving to database...`);
    
    // Save exercises to database
    const savedExercises = [];
    for (const exercise of exercises) {
      const exerciseId = await saveExercise(userId, conceptId, exercise);
      savedExercises.push({ ...exercise, id: exerciseId });
    }
    
    console.log(`✅ API: Saved ${savedExercises.length} exercises to database`);
    
    return c.json({ exercises: savedExercises });
  } catch (error) {
    console.error('❌ API: Error generating exercises:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return c.json(formatErrorResponse(error, 'Failed to generate exercises'), 500);
  }
});

// Submit exercise answer
grammarRoutes.post('/exercises/submit', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const exerciseId = validateString(body.exerciseId, 'exerciseId');
    const userAnswer = validateString(body.userAnswer, 'userAnswer');
    const timeSpent = body.timeSpentSeconds ? parseInt(body.timeSpentSeconds) : undefined;
    
    const evaluation = await evaluateExerciseAnswer(exerciseId, userId, userAnswer, timeSpent);
    
    return c.json({ evaluation });
  } catch (error) {
    console.error('Error submitting exercise:', error);
    return c.json(formatErrorResponse(error, 'Failed to submit exercise'), 500);
  }
});

// ========================================
// ADAPTIVE PRACTICE SESSION ROUTES
// ========================================

// Start or resume adaptive practice session
grammarRoutes.post('/practice-session/start', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const conceptId = validateString(body.conceptId, 'conceptId');
    
    const { 
      createPracticeSession, 
      getActiveSession, 
      getSessionDetails 
    } = await import('./lib/grammar-practice-sessions');
    
    // Check if there's already an active session
    let sessionId = await getActiveSession(userId, conceptId);
    
    if (!sessionId) {
      // Create new session
      sessionId = await createPracticeSession(userId, conceptId);
    }
    
    const session = await getSessionDetails(sessionId);
    
    // Generate initial batch of exercises
    const exercises = await generateExercises(userId, conceptId, 10, undefined, session.current_difficulty as 'easy' | 'medium' | 'hard');
    
    // Save exercises to database
    const savedExercises = [];
    for (const exercise of exercises) {
      const exerciseId = await saveExercise(userId, conceptId, exercise, sessionId);
      savedExercises.push({ ...exercise, id: exerciseId });
    }
    
    return c.json({ 
      sessionId,
      exercises: savedExercises,
      session: {
        totalAttempted: session.total_exercises_attempted,
        totalCorrect: session.total_correct,
        currentDifficulty: session.current_difficulty,
      }
    });
  } catch (error) {
    console.error('Error starting practice session:', error);
    return c.json(formatErrorResponse(error, 'Failed to start practice session'), 500);
  }
});

// Generate next batch of exercises for active session
grammarRoutes.post('/practice-session/next-batch', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const sessionId = validateString(body.sessionId, 'sessionId');
    
    const { 
      getSessionDetails,
      checkAndAdjustDifficulty 
    } = await import('./lib/grammar-practice-sessions');
    
    // Check if difficulty should be adjusted
    const adjustment = await checkAndAdjustDifficulty(sessionId, 10);
    
    const session = await getSessionDetails(sessionId);
    
    // Generate next batch with current (possibly adjusted) difficulty
    const exercises = await generateExercises(
      userId, 
      session.concept_id, 
      10, 
      undefined, 
      session.current_difficulty as 'easy' | 'medium' | 'hard'
    );
    
    // Save exercises to database
    const savedExercises = [];
    for (const exercise of exercises) {
      const exerciseId = await saveExercise(userId, session.concept_id, exercise, sessionId);
      savedExercises.push({ ...exercise, id: exerciseId });
    }
    
    return c.json({ 
      exercises: savedExercises,
      session: {
        totalAttempted: session.total_exercises_attempted,
        totalCorrect: session.total_correct,
        currentDifficulty: session.current_difficulty,
      },
      difficultyAdjustment: adjustment.adjusted ? {
        newDifficulty: adjustment.newDifficulty,
        reason: adjustment.reason,
      } : null,
    });
  } catch (error) {
    console.error('Error generating next batch:', error);
    return c.json(formatErrorResponse(error, 'Failed to generate next batch'), 500);
  }
});

// Complete practice session
grammarRoutes.post('/practice-session/complete', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const sessionId = validateString(body.sessionId, 'sessionId');
    
    const { 
      completePracticeSession,
      getSessionDetails 
    } = await import('./lib/grammar-practice-sessions');
    
    await completePracticeSession(sessionId);
    const session = await getSessionDetails(sessionId);
    
    return c.json({ 
      message: 'Practice session completed',
      session: {
        totalAttempted: session.total_exercises_attempted,
        totalCorrect: session.total_correct,
        totalIncorrect: session.total_incorrect,
        summary: session.session_summary,
        areasOfStrength: session.areas_of_strength,
        areasForImprovement: session.areas_for_improvement,
        difficultyAdjustments: session.difficulty_adjustments,
      }
    });
  } catch (error) {
    console.error('Error completing practice session:', error);
    return c.json(formatErrorResponse(error, 'Failed to complete practice session'), 500);
  }
});

// Get recent practice sessions for context
grammarRoutes.get('/practice-session/recent/:conceptId', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const conceptId = c.req.param('conceptId');
    
    const { getRecentSessions } = await import('./lib/grammar-practice-sessions');
    
    const sessions = await getRecentSessions(userId, conceptId, 3);
    
    return c.json({ sessions });
  } catch (error) {
    console.error('Error fetching recent sessions:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch recent sessions'), 500);
  }
});

// ========================================
// CONVERSATIONAL GRAMMAR TUTOR ROUTES
// ========================================

// Start conversational grammar practice
grammarRoutes.post('/conversation/start', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const conceptId = validateString(body.conceptId, 'conceptId');
    
    console.log(`🎙️ Starting conversation for user ${userId}, concept ${conceptId}`);
    
    const { createPracticeSession, getActiveSession } = await import('./lib/grammar-practice-sessions');
    const { startGrammarConversation } = await import('./lib/conversational-grammar-tutor');
    const { getDatabase } = await import('./lib/db');
    const { grammarPracticeSessions } = await import('./schema/grammar');
    const { eq, and, desc } = await import('drizzle-orm');
    
    // Check if there's already an active session
    let sessionId = await getActiveSession(userId, conceptId);
    
    if (!sessionId) {
      console.log('📝 Creating new practice session');
      
      // Check previous session to determine starting difficulty
      const db = await getDatabase();
      const previousSessions = await db
        .select()
        .from(grammarPracticeSessions)
        .where(
          and(
            eq(grammarPracticeSessions.user_id, userId),
            eq(grammarPracticeSessions.concept_id, conceptId),
            eq(grammarPracticeSessions.is_active, false)
          )
        )
        .orderBy(desc(grammarPracticeSessions.completed_at))
        .limit(1);
      
      let initialDifficulty: 'easy' | 'medium' | 'hard' = 'easy';
      
      if (previousSessions.length > 0) {
        const previousRating = previousSessions[0].user_difficulty_rating;
        const previousDifficulty = previousSessions[0].current_difficulty as 'easy' | 'medium' | 'hard';
        console.log(`📊 Previous session rating: ${previousRating}, difficulty: ${previousDifficulty}`);
        
        if (previousRating === 'easy') {
          // User found it too easy - bump up one level
          if (previousDifficulty === 'easy') {
            initialDifficulty = 'medium';
            console.log('⬆️ Starting at MEDIUM difficulty (previous easy was too easy)');
          } else if (previousDifficulty === 'medium') {
            initialDifficulty = 'hard';
            console.log('⬆️⬆️ Starting at HARD difficulty (previous medium was too easy)');
          } else {
            // Already at hard
            initialDifficulty = 'hard';
            console.log('🔥 Staying at HARD difficulty (maximum)');
          }
        } else if (previousRating === 'difficult') {
          // User found it too hard - bump down one level
          if (previousDifficulty === 'hard') {
            initialDifficulty = 'medium';
            console.log('⬇️ Starting at MEDIUM difficulty (previous hard was too difficult)');
          } else if (previousDifficulty === 'medium') {
            initialDifficulty = 'easy';
            console.log('⬇️⬇️ Starting at EASY difficulty (previous medium was too difficult)');
          } else {
            // Already at easy
            initialDifficulty = 'easy';
            console.log('📚 Staying at EASY difficulty (minimum)');
          }
        } else {
          // User said it was just right - keep at same level
          initialDifficulty = previousDifficulty || 'easy';
          console.log(`➡️ Starting at ${initialDifficulty.toUpperCase()} difficulty (previous was just right)`);
        }
      }
      
      sessionId = await createPracticeSession(userId, conceptId, initialDifficulty);
    } else {
      console.log(`♻️ Resuming existing session: ${sessionId}`);
    }
    
    console.log('🤖 Starting grammar conversation');
    // Start the conversation
    const result = await startGrammarConversation(userId, conceptId, sessionId);
    
    console.log('✅ Conversation started successfully');
    
    return c.json({
      sessionId,
      message: result.message,
      context: result.context,
    });
  } catch (error) {
    console.error('❌ Error starting conversation:', error);
    console.error('Error details:', error instanceof Error ? error.stack : error);
    return c.json(formatErrorResponse(error, 'Failed to start conversation'), 500);
  }
});

// Continue conversational grammar practice
grammarRoutes.post('/conversation/continue', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const conceptId = validateString(body.conceptId, 'conceptId');
    const sessionId = validateString(body.sessionId, 'sessionId');
    const studentMessage = validateString(body.message, 'message');
    const conversationState = body.context;
    
    const { continueGrammarConversation } = await import('./lib/conversational-grammar-tutor');
    
    const result = await continueGrammarConversation(
      userId,
      conceptId,
      sessionId,
      studentMessage,
      conversationState
    );
    
    return c.json({
      message: result.tutorMessage,
      correction: result.correction,
      wasCorrect: result.wasCorrect,
      context: result.context,
      difficultyAdjusted: result.difficultyAdjusted,
    });
  } catch (error) {
    console.error('Error continuing conversation:', error);
    return c.json(formatErrorResponse(error, 'Failed to continue conversation'), 500);
  }
});

// End conversational session and get summary
grammarRoutes.post('/conversation/end', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const conceptId = validateString(body.conceptId, 'conceptId');
    const sessionId = validateString(body.sessionId, 'sessionId');
    const conversationState = body.context;
    const userDifficultyRating = body.userDifficultyRating as 'easy' | 'medium' | 'difficult' | undefined;
    
    const { analyzeGrammarSession } = await import('./lib/conversational-grammar-tutor');
    const { getSessionDetails } = await import('./lib/grammar-practice-sessions');
    const { getDatabase } = await import('./lib/db');
    const { grammarPracticeSessions } = await import('./schema/grammar');
    const { eq } = await import('drizzle-orm');
    
    // Generate detailed AI analysis
    const analysis = await analyzeGrammarSession(conceptId, conversationState);
    
    // Create context summary for next session
    const topicsCovered = conversationState.topicsCovered?.join(', ') || 'general practice';
    const contextSummary = `Last session covered: ${topicsCovered}. Performance: ${conversationState.correctCount}/${conversationState.totalExchanges} correct. Areas practiced: ${analysis.areasOfStrength.slice(0, 2).join(', ')}. Areas that need work: ${analysis.areasForImprovement.slice(0, 2).join(', ')}.`;
    
    // Save analysis to session
    const db = await getDatabase();
    await db
      .update(grammarPracticeSessions)
      .set({
        session_summary: analysis.summary,
        areas_of_strength: analysis.areasOfStrength,
        areas_for_improvement: analysis.areasForImprovement,
        user_difficulty_rating: userDifficultyRating,
        previous_session_context: contextSummary,
        completed_at: new Date(),
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(grammarPracticeSessions.id, sessionId));
    
    // Get final session details
    const session = await getSessionDetails(sessionId);
    
    return c.json({
      summary: analysis.summary,
      areasOfStrength: analysis.areasOfStrength,
      areasForImprovement: analysis.areasForImprovement,
      specificRecommendations: analysis.specificRecommendations,
      errorPatterns: analysis.errorPatterns,
      session: {
        totalExchanges: session.total_exercises_attempted,
        correctCount: session.total_correct,
        accuracy: session.total_exercises_attempted > 0
          ? ((session.total_correct / session.total_exercises_attempted) * 100).toFixed(0)
          : 0,
      },
    });
  } catch (error) {
    console.error('Error ending conversation:', error);
    return c.json(formatErrorResponse(error, 'Failed to end conversation'), 500);
  }
});

// Get personalized practice drill
grammarRoutes.get('/exercises/personalized', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const count = parseInt(c.req.query('count') || '10');
    
    const drill = await createPersonalizedDrill(userId, count);
    
    return c.json({ drill });
  } catch (error) {
    console.error('Error creating personalized drill:', error);
    return c.json(formatErrorResponse(error, 'Failed to create personalized drill'), 500);
  }
});

// Get exercise history
grammarRoutes.get('/exercises/history', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const limit = parseInt(c.req.query('limit') || '20');
    
    const history = await getExerciseHistory(userId, limit);
    
    return c.json({ history });
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch exercise history'), 500);
  }
});

// Get exercise statistics
grammarRoutes.get('/exercises/stats', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const stats = await getExerciseStats(userId);
    
    return c.json({ stats });
  } catch (error) {
    console.error('Error fetching exercise stats:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch exercise stats'), 500);
  }
});

// Get grammar concepts due for SRS review
grammarRoutes.get('/review/due', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const concepts = await getGrammarConceptsDueForReview(userId);
    const dueCount = await getDueGrammarConceptCount(userId);
    
    return c.json({ concepts, count: dueCount });
  } catch (error) {
    console.error('Error fetching due concepts:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch due concepts'), 500);
  }
});

// Review a grammar concept (SRS)
grammarRoutes.post('/review', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const conceptId = validateString(body.conceptId, 'conceptId');
    const quality = parseInt(body.quality);
    
    const result = await reviewGrammarConcept(userId, conceptId, quality);
    
    return c.json({ result });
  } catch (error) {
    console.error('Error reviewing concept:', error);
    return c.json(formatErrorResponse(error, 'Failed to review concept'), 500);
  }
});

// Initialize concept for SRS tracking
grammarRoutes.post('/review/initialize', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const body = await c.req.json();
    const conceptId = validateString(body.conceptId, 'conceptId');
    
    const initialized = await initializeGrammarConceptReview(userId, conceptId);
    
    return c.json({ initialized });
  } catch (error) {
    console.error('Error initializing concept:', error);
    return c.json(formatErrorResponse(error, 'Failed to initialize concept'), 500);
  }
});

// Get grammar mastery statistics
grammarRoutes.get('/mastery/stats', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const stats = await getGrammarMasteryStats(userId);
    
    return c.json({ stats });
  } catch (error) {
    console.error('Error fetching mastery stats:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch mastery stats'), 500);
  }
});

// ========================================
// VIDEO TRACKING ROUTES
// ========================================
import {
  markVideoAsWatched,
  getVideoAnalysis,
  getWatchedVideosForConcept,
  hasWatchedVideo,
  triggerVideoAnalysis,
} from './lib/video-analysis';

// Mark a video as watched
grammarRoutes.post('/videos/:videoId/mark-watched', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const videoId = c.req.param('videoId');
    const body = await c.req.json();
    const conceptId = validateString(body.conceptId, 'conceptId');
    const videoTitle = body.videoTitle;
    const videoDuration = body.videoDuration;
    
    const watchRecordId = await markVideoAsWatched(
      userId,
      videoId,
      conceptId,
      videoTitle,
      videoDuration,
      true // Analyze in background
    );
    
    // Update user grammar progress to mark video as watched
    const db = await getDatabase();
    const { userGrammarProgress } = await import('./schema/grammar');
    const { checkAndUpdateCompletion } = await import('./lib/grammar-exercises');
    
    // Get or create progress record
    const existing = await db
      .select()
      .from(userGrammarProgress)
      .where(
        and(
          eq(userGrammarProgress.user_id, userId),
          eq(userGrammarProgress.concept_id, conceptId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      await db
        .update(userGrammarProgress)
        .set({
          has_watched_video: true,
          updated_at: new Date(),
        })
        .where(eq(userGrammarProgress.id, existing[0].id));
    } else {
      // Create new progress record
      const progressId = `${userId}-progress-${conceptId}`;
      await db.insert(userGrammarProgress).values({
        id: progressId,
        user_id: userId,
        concept_id: conceptId,
        has_watched_video: true,
        mastery_level: 'new',
      });
    }
    
    // Check if concept is now complete (video + 5 exercises)
    const isComplete = await checkAndUpdateCompletion(userId, conceptId);
    
    return c.json({ 
      success: true,
      watchRecordId,
      isComplete,
      message: isComplete 
        ? 'Video marked as watched. Concept completed! 🎉'
        : 'Video marked as watched. Analysis in progress...'
    });
  } catch (error) {
    console.error('Error marking video as watched:', error);
    return c.json(formatErrorResponse(error, 'Failed to mark video as watched'), 500);
  }
});

// Get video analysis (transcript and AI-extracted lessons)
grammarRoutes.get('/videos/:videoId/analysis', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const videoId = c.req.param('videoId');
    const conceptId = c.req.query('conceptId');
    
    const result = await getVideoAnalysis(userId, videoId, conceptId);
    
    return c.json({
      analysis: result.analysis,
      transcript: result.transcript,
      hasTranscript: !!result.transcript,
      watchRecord: result.watchRecord,
    });
  } catch (error) {
    console.error('Error fetching video analysis:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch video analysis'), 500);
  }
});

// Get all watched videos for a concept
grammarRoutes.get('/concepts/:conceptId/watched-videos', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const conceptId = c.req.param('conceptId');
    
    const watchedVideos = await getWatchedVideosForConcept(userId, conceptId);
    
    return c.json({ 
      watchedVideos,
      count: watchedVideos.length
    });
  } catch (error) {
    console.error('Error fetching watched videos:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch watched videos'), 500);
  }
});

// Check if a video has been watched
grammarRoutes.get('/videos/:videoId/watched-status', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const videoId = c.req.param('videoId');
    
    const watched = await hasWatchedVideo(userId, videoId);
    
    return c.json({ watched });
  } catch (error) {
    console.error('Error checking watched status:', error);
    return c.json(formatErrorResponse(error, 'Failed to check watched status'), 500);
  }
});

// Trigger analysis for a watched video (manual)
grammarRoutes.post('/videos/:videoId/analyze', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const videoId = c.req.param('videoId');
    const body = await c.req.json();
    const conceptId = validateString(body.conceptId, 'conceptId');
    
    await triggerVideoAnalysis(userId, videoId, conceptId);
    
    return c.json({ 
      success: true,
      message: 'Analysis triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering analysis:', error);
    return c.json(formatErrorResponse(error, 'Failed to trigger analysis'), 500);
  }
});

// Mount learning timer routes (directly under api, no auth required for dev)
// protectedRoutes.route('/learning-timer', learningTimerRoutes);
api.route('/protected/learning-timer', learningTimerRoutes);

// Mount flashcard routes (directly under api, no auth required for dev)
api.route('/protected/flashcards', flashcardRoutes);

// Mount grammar routes
api.route('/protected/grammar', grammarRoutes);

// ========================================
// READING COMPREHENSION ROUTES
// ========================================
const readingRoutes = new Hono<{ Bindings: Env }>();

// Import reading comprehension functions
import {
  getDailyReadingTexts,
  getReadingTextById,
  saveReadingAttempt,
  completeReadingText,
  getReadingStats,
  getReadingHistory,
  getAttemptsForText,
} from './lib/reading-comprehension';

// Get daily reading tasks (3 per day)
readingRoutes.get('/daily', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const texts = await getDailyReadingTexts(userId);
    
    return c.json({
      texts,
      count: texts.length,
    });
  } catch (error) {
    console.error('Error fetching daily reading tasks:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch daily reading tasks'), 500);
  }
});

// Get reading comprehension statistics (must be before /:textId route)
readingRoutes.get('/stats', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const stats = await getReadingStats(userId);
    
    return c.json({ stats });
  } catch (error) {
    console.error('Error fetching reading stats:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch reading stats'), 500);
  }
});

// Get reading history (must be before /:textId route)
readingRoutes.get('/history', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const limit = parseInt(c.req.query('limit') || '20');
    
    const history = await getReadingHistory(userId, limit);
    
    return c.json({
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error fetching reading history:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch reading history'), 500);
  }
});

// Get specific reading text with questions
readingRoutes.get('/:textId', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const textId = c.req.param('textId');
    
    if (!textId) {
      return c.json({ error: 'Text ID is required' }, 400);
    }
    
    const text = await getReadingTextById(textId, userId);
    
    // Check if user has already attempted this text
    const attempts = await getAttemptsForText(userId, textId);
    
    return c.json({
      text,
      attempts,
      hasAttempted: attempts.length > 0,
    });
  } catch (error) {
    console.error('Error fetching reading text:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch reading text'), 500);
  }
});

// Submit answer to a question
readingRoutes.post('/:textId/answer', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const textId = c.req.param('textId');
    const body = await c.req.json();
    
    const questionId = validateString(body.questionId, 'questionId');
    const userAnswer = validateString(body.userAnswer, 'userAnswer', 1, 1000);
    const sessionId = body.sessionId ? validateString(body.sessionId, 'sessionId', 1, 100) : undefined;
    
    const attempt = await saveReadingAttempt(userId, textId, questionId, userAnswer, sessionId);
    
    return c.json({
      attempt,
      message: 'Answer submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    
    // Return validation errors with 400 status
    if (error instanceof Error && error.message.includes('must')) {
      return c.json({ error: error.message }, 400);
    }
    
    return c.json(formatErrorResponse(error, 'Failed to submit answer'), 500);
  }
});

// Complete a reading text (mark as done)
readingRoutes.post('/:textId/complete', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const textId = c.req.param('textId');
    
    if (!textId) {
      return c.json({ error: 'Text ID is required' }, 400);
    }
    
    await completeReadingText(userId, textId);
    
    return c.json({
      message: 'Reading text completed successfully',
      textId,
    });
  } catch (error) {
    console.error('Error completing reading text:', error);
    return c.json(formatErrorResponse(error, 'Failed to complete reading text'), 500);
  }
});

// Mount reading routes
api.route('/protected/reading', readingRoutes);

// ========================================
// ANKI DECK IMPORT ROUTES
// ========================================
const ankiRoutes = new Hono<{ Bindings: Env }>();

// Import Anki functions
import {
  importDeck,
  deleteDeck,
  getUserDecks,
  getDeck,
} from './lib/anki-import';
import {
  getAnkiStudyCards,
  reviewAnkiCard,
  getAnkiDeckStats,
  updateDeckLastStudied,
  getTotalAnkiDueCount,
} from './lib/anki-deck-review';
import { ankiMedia, ankiDecks } from './schema/anki';

// Import Anki deck from .apkg file
ankiRoutes.post('/import', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    console.log('📥 Import request received');
    
    // Parse multipart form data
    const body = await c.req.parseBody();
    const file = body['file'] as File;
    const customName = body['name'] as string | undefined;
    
    if (!file) {
      console.error('❌ No file provided');
      return c.json({ error: 'No file provided' }, 400);
    }
    
    // Check file extension
    if (!file.name.endsWith('.apkg')) {
      console.error('❌ Invalid file extension:', file.name);
      return c.json({ error: 'File must be an .apkg file' }, 400);
    }
    
    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`📦 Importing deck from file: ${file.name} (${buffer.length} bytes)`);
    console.log(`👤 User: ${userId}`);
    
    // Import the deck
    const result = await importDeck(userId, buffer, customName);
    
    console.log('✅ Import successful:', result.deckId);
    
    return c.json({
      success: true,
      deck: result,
    });
  } catch (error) {
    console.error('❌ Error importing Anki deck:');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    return c.json(formatErrorResponse(error, 'Failed to import deck'), 500);
  }
});

// Get all decks for user
ankiRoutes.get('/decks', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const decks = await getUserDecks(userId);
    
    // Get due count for each deck
    const decksWithStats = await Promise.all(
      decks.map(async (deck) => {
        const stats = await getAnkiDeckStats(userId, deck.id);
        return {
          ...deck,
          stats,
        };
      })
    );
    
    return c.json({
      decks: decksWithStats,
      count: decksWithStats.length,
    });
  } catch (error) {
    console.error('Error fetching Anki decks:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch decks'), 500);
  }
});

// Get total due count across all decks
ankiRoutes.get('/due-count', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    
    const dueCount = await getTotalAnkiDueCount(userId);
    
    return c.json({ dueCount });
  } catch (error) {
    console.error('Error fetching due count:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch due count'), 500);
  }
});

// Get single deck details
ankiRoutes.get('/decks/:deckId', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const deckId = c.req.param('deckId');
    
    if (!deckId) {
      return c.json({ error: 'Deck ID is required' }, 400);
    }
    
    const deck = await getDeck(userId, deckId);
    const stats = await getAnkiDeckStats(userId, deckId);
    
    return c.json({
      deck: {
        ...deck,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching deck:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch deck'), 500);
  }
});

// Delete a deck
ankiRoutes.delete('/decks/:deckId', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const deckId = c.req.param('deckId');
    
    if (!deckId) {
      return c.json({ error: 'Deck ID is required' }, 400);
    }
    
    await deleteDeck(userId, deckId);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting deck:', error);
    return c.json(formatErrorResponse(error, 'Failed to delete deck'), 500);
  }
});

// Get cards to study from a deck
ankiRoutes.get('/decks/:deckId/study', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const deckId = c.req.param('deckId');
    
    if (!deckId) {
      return c.json({ error: 'Deck ID is required' }, 400);
    }
    
    const maxNew = parseInt(c.req.query('maxNew') || '20');
    const maxReview = parseInt(c.req.query('maxReview') || '50');
    
    const cards = await getAnkiStudyCards(userId, deckId, maxNew, maxReview);
    
    return c.json({
      cards,
      count: cards.length,
    });
  } catch (error) {
    console.error('Error fetching study cards:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch study cards'), 500);
  }
});

// Get deck statistics
ankiRoutes.get('/decks/:deckId/stats', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const deckId = c.req.param('deckId');
    
    if (!deckId) {
      return c.json({ error: 'Deck ID is required' }, 400);
    }
    
    const stats = await getAnkiDeckStats(userId, deckId);
    
    return c.json({ stats });
  } catch (error) {
    console.error('Error fetching deck stats:', error);
    return c.json(formatErrorResponse(error, 'Failed to fetch deck stats'), 500);
  }
});

// Review a card
ankiRoutes.post('/decks/:deckId/review', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const userId = user.id;
    const deckId = c.req.param('deckId');
    
    if (!deckId) {
      return c.json({ error: 'Deck ID is required' }, 400);
    }
    
    const body = await c.req.json();
    const { cardId, quality } = body;
    
    if (!cardId || quality === undefined) {
      return c.json({ error: 'cardId and quality are required' }, 400);
    }
    
    const result = await reviewAnkiCard(userId, cardId, quality);
    
    // Update deck last studied timestamp
    await updateDeckLastStudied(deckId);
    
    return c.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error reviewing card:', error);
    return c.json(formatErrorResponse(error, 'Failed to review card'), 500);
  }
});

// Serve media files by deck and filename
ankiRoutes.get('/decks/:deckId/media/:filename', async (c) => {
  try {
    const user = getAuthenticatedUser(c);
    const deckId = c.req.param('deckId');
    const filename = c.req.param('filename');
    
    if (!deckId || !filename) {
      return c.json({ error: 'Deck ID and filename are required' }, 400);
    }
    
    const db = await getDatabase();
    
    // Verify deck belongs to user
    const decks = await db
      .select()
      .from(ankiDecks)
      .where(
        and(
          eq(ankiDecks.id, deckId),
          eq(ankiDecks.user_id, user.id)
        )
      )
      .limit(1);
    
    if (decks.length === 0) {
      return c.json({ error: 'Deck not found' }, 404);
    }
    
    // Get media file by deck and filename
    const media = await db
      .select()
      .from(ankiMedia)
      .where(
        and(
          eq(ankiMedia.deck_id, deckId),
          eq(ankiMedia.filename, decodeURIComponent(filename))
        )
      )
      .limit(1);
    
    if (media.length === 0) {
      return c.json({ error: 'Media not found' }, 404);
    }
    
    const mediaFile = media[0];
    
    // Decode base64 data
    const buffer = Buffer.from(mediaFile.file_data, 'base64');
    
    // Set appropriate content type
    c.header('Content-Type', mediaFile.mime_type || 'application/octet-stream');
    c.header('Content-Length', buffer.length.toString());
    c.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    return c.body(buffer);
  } catch (error) {
    console.error('Error serving media:', error);
    return c.json(formatErrorResponse(error, 'Failed to serve media'), 500);
  }
});

// Mount Anki routes
api.route('/protected/anki', ankiRoutes);

// Mount the protected routes under /protected
api.route('/protected', protectedRoutes);

// Mount the API router
app.route('/api/v1', api);

export default app; 