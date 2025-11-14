/**
 * Grammar Analysis Library
 * 
 * AI-powered grammar error detection and classification for Italian language learning.
 * Analyzes user messages, identifies errors, suggests corrections, and tracks patterns.
 */

import { getDatabase } from './db';
import { getUserProficiency } from './comprehensible-input';
import { getOpenAIClient, OPENAI_MODELS, OPENAI_TEMPERATURES } from './openai-client';
import { 
  grammarErrors, 
  grammarConcepts, 
  userGrammarProgress,
  type GrammarError,
  type NewGrammarError,
  type CEFRLevel,
  type ErrorSeverity
} from '../schema/grammar';
import { eq, desc, and, sql, count, inArray } from 'drizzle-orm';

/**
 * Structure for detected grammar errors
 */
export interface DetectedError {
  originalText: string;
  correctedText: string;
  errorType: string;
  explanation: string;
  severity: ErrorSeverity;
  conceptId?: string;
  conceptName?: string;
  positionStart?: number;
  positionEnd?: number;
}

/**
 * Result from grammar analysis
 */
export interface GrammarAnalysisResult {
  hasErrors: boolean;
  errorCount: number;
  errors: DetectedError[];
  overallAssessment: string;
  suggestedFocus?: string[];
}

/**
 * Analyze Italian text for grammar errors using AI
 */
export async function analyzeGrammarErrors(
  userId: string,
  userMessage: string
): Promise<GrammarAnalysisResult> {
  const client = getOpenAIClient();
  
  // Get user's proficiency level for context
  const proficiency = await getUserProficiency(userId);
  
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert Italian grammar teacher analyzing student text for errors.

The student is at CEFR level ${proficiency.level}.

Your task:
1. Identify ALL grammar errors in the Italian text
2. Categorize each error by grammar concept (e.g., "verb conjugation", "article agreement", "preposition usage")
3. Provide the corrected version
4. Explain each error clearly in English
5. Rate severity: "minor", "medium", or "major"

Return ONLY valid JSON with this structure:
{
  "hasErrors": boolean,
  "errorCount": number,
  "errors": [
    {
      "originalText": "the incorrect part",
      "correctedText": "the correct version",
      "errorType": "specific grammar point (e.g., Present Tense - Essere)",
      "explanation": "why it's wrong and how to fix it",
      "severity": "minor" | "medium" | "major",
      "conceptName": "the broader concept name",
      "positionStart": number (character position in original text),
      "positionEnd": number (character position in original text)
    }
  ],
  "overallAssessment": "brief summary of the student's grammar level in this message",
  "suggestedFocus": ["concept1", "concept2"] (up to 3 areas to focus on)
}

Guidelines:
- Be thorough but not pedantic - focus on errors that impede understanding or are repeated patterns
- For beginners (A1/A2), be more lenient with advanced concepts
- For advanced learners (C1/C2), catch subtle errors
- If text is perfect, return hasErrors: false and empty errors array
- Be encouraging in assessments`,
        },
        {
          role: 'user',
          content: `Analyze this Italian text for grammar errors:\n\n"${userMessage}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content || '{"hasErrors": false, "errorCount": 0, "errors": []}';
    const analysis: GrammarAnalysisResult = JSON.parse(responseContent);
    
    console.log(`Grammar analysis complete for user ${userId}: ${analysis.errorCount} errors found`);
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing grammar:', error);
    // Return safe default
    return {
      hasErrors: false,
      errorCount: 0,
      errors: [],
      overallAssessment: 'Unable to analyze grammar at this time.',
    };
  }
}

/**
 * Match detected errors to grammar concepts in database
 */
export async function matchErrorsToConcepts(
  errors: DetectedError[]
): Promise<DetectedError[]> {
  if (errors.length === 0) {
    return errors;
  }

  const db = await getDatabase();
  
  // Get all grammar concepts
  const concepts = await db
    .select()
    .from(grammarConcepts)
    .execute();
  
  // Create a map of concept names to IDs (case-insensitive)
  const conceptMap = new Map<string, string>();
  concepts.forEach(concept => {
    conceptMap.set(concept.name.toLowerCase(), concept.id);
    conceptMap.set(concept.name_italian.toLowerCase(), concept.id);
  });
  
  // Try to match each error to a concept
  const matchedErrors = errors.map(error => {
    // Try exact match first
    let conceptId = conceptMap.get(error.errorType.toLowerCase());
    
    // If no exact match, try partial matching
    if (!conceptId && error.conceptName) {
      conceptId = conceptMap.get(error.conceptName.toLowerCase());
    }
    
    // If still no match, try fuzzy matching on key terms
    if (!conceptId) {
      const errorTypeLower = error.errorType.toLowerCase();
      for (const [name, id] of conceptMap.entries()) {
        if (errorTypeLower.includes(name) || name.includes(errorTypeLower)) {
          conceptId = id;
          break;
        }
      }
    }
    
    return {
      ...error,
      conceptId,
    };
  });
  
  return matchedErrors;
}

/**
 * Save detected errors to database for tracking
 */
export async function trackGrammarInConversation(
  userId: string,
  conversationId: string,
  sessionId: string | null,
  fullSentence: string,
  errors: DetectedError[]
): Promise<void> {
  if (errors.length === 0) {
    return;
  }

  const db = await getDatabase();
  
  // Match errors to concepts
  const matchedErrors = await matchErrorsToConcepts(errors);
  
  // Save each error to database
  const errorRecords: NewGrammarError[] = matchedErrors.map(error => ({
    id: `${userId}-error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    user_id: userId,
    concept_id: error.conceptId || null,
    conversation_id: conversationId,
    session_id: sessionId,
    original_text: error.originalText,
    corrected_text: error.correctedText,
    error_type: error.errorType,
    explanation: error.explanation,
    severity: error.severity,
    full_sentence: fullSentence,
    position_start: error.positionStart || null,
    position_end: error.positionEnd || null,
    was_corrected_in_conversation: false,
    user_acknowledged: false,
  }));
  
  await db.insert(grammarErrors).values(errorRecords);
  
  // Update user grammar progress for each concept
  for (const error of matchedErrors) {
    if (error.conceptId) {
      await incrementErrorCount(userId, error.conceptId);
    }
  }
  
  console.log(`Tracked ${errors.length} grammar errors for user ${userId}`);
}

/**
 * Increment error count for a grammar concept
 */
async function incrementErrorCount(userId: string, conceptId: string): Promise<void> {
  const db = await getDatabase();
  
  // Check if progress record exists
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
        error_count: sql`${userGrammarProgress.error_count} + 1`,
        last_error_date: new Date(),
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
      error_count: 1,
      last_error_date: new Date(),
      mastery_level: 'new',
    });
  }
}

/**
 * Get user's weak grammar concepts (most errors)
 */
export async function identifyWeakConcepts(
  userId: string,
  limit: number = 10
): Promise<Array<{
  concept: any;
  errorCount: number;
  lastErrorDate: Date | null;
  masteryLevel: string;
}>> {
  const db = await getDatabase();
  
  const weakConcepts = await db
    .select({
      concept: grammarConcepts,
      progress: userGrammarProgress,
    })
    .from(userGrammarProgress)
    .innerJoin(grammarConcepts, eq(grammarConcepts.id, userGrammarProgress.concept_id))
    .where(
      and(
        eq(userGrammarProgress.user_id, userId),
        sql`${userGrammarProgress.error_count} > 0`
      )
    )
    .orderBy(desc(userGrammarProgress.error_count), desc(userGrammarProgress.last_error_date))
    .limit(limit);
  
  return weakConcepts.map(item => ({
    concept: item.concept,
    errorCount: item.progress.error_count || 0,
    lastErrorDate: item.progress.last_error_date,
    masteryLevel: item.progress.mastery_level || 'new',
  }));
}

/**
 * Get recent grammar errors for a user
 */
export async function getRecentErrors(
  userId: string,
  limit: number = 20
): Promise<GrammarError[]> {
  const db = await getDatabase();
  
  const errors = await db
    .select()
    .from(grammarErrors)
    .where(eq(grammarErrors.user_id, userId))
    .orderBy(desc(grammarErrors.created_at))
    .limit(limit);
  
  return errors as GrammarError[];
}

/**
 * Get errors for a specific grammar concept
 */
export async function getErrorsByConceptId(
  userId: string,
  conceptId: string,
  limit: number = 10
): Promise<GrammarError[]> {
  const db = await getDatabase();
  
  const errors = await db
    .select()
    .from(grammarErrors)
    .where(
      and(
        eq(grammarErrors.user_id, userId),
        eq(grammarErrors.concept_id, conceptId)
      )
    )
    .orderBy(desc(grammarErrors.created_at))
    .limit(limit);
  
  return errors as GrammarError[];
}

/**
 * Get grammar statistics for a user
 */
export async function getGrammarStats(userId: string): Promise<{
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByCategory: Record<string, number>;
  weakConceptsCount: number;
  recentErrorRate: number; // errors per message in last 10 messages
}> {
  const db = await getDatabase();
  
  // Total errors
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(grammarErrors)
    .where(eq(grammarErrors.user_id, userId));
  const totalErrors = Number(totalResult[0]?.count || 0);
  
  // Errors by CEFR level (from concepts)
  const errorsByLevelResult = await db
    .select({
      level: grammarConcepts.cefr_level,
      count: sql<number>`count(*)`,
    })
    .from(grammarErrors)
    .innerJoin(grammarConcepts, eq(grammarConcepts.id, grammarErrors.concept_id))
    .where(eq(grammarErrors.user_id, userId))
    .groupBy(grammarConcepts.cefr_level);
  
  const errorsByLevel: Record<string, number> = {};
  errorsByLevelResult.forEach(row => {
    errorsByLevel[row.level as string] = Number(row.count);
  });
  
  // Errors by category
  const errorsByCategoryResult = await db
    .select({
      category: grammarConcepts.category,
      count: sql<number>`count(*)`,
    })
    .from(grammarErrors)
    .innerJoin(grammarConcepts, eq(grammarConcepts.id, grammarErrors.concept_id))
    .where(eq(grammarErrors.user_id, userId))
    .groupBy(grammarConcepts.category);
  
  const errorsByCategory: Record<string, number> = {};
  errorsByCategoryResult.forEach(row => {
    errorsByCategory[row.category as string] = Number(row.count);
  });
  
  // Weak concepts count (concepts with errors)
  const weakConceptsResult = await db
    .select({ count: sql<number>`count(distinct ${userGrammarProgress.concept_id})` })
    .from(userGrammarProgress)
    .where(
      and(
        eq(userGrammarProgress.user_id, userId),
        sql`${userGrammarProgress.error_count} > 0`
      )
    );
  const weakConceptsCount = Number(weakConceptsResult[0]?.count || 0);
  
  // Recent error rate (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentErrorsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(grammarErrors)
    .where(
      and(
        eq(grammarErrors.user_id, userId),
        sql`${grammarErrors.created_at} >= ${sevenDaysAgo.toISOString()}`
      )
    );
  const recentErrors = Number(recentErrorsResult[0]?.count || 0);
  
  // Estimate recent error rate (errors per conversation)
  // This is simplified - you might want to count actual conversations
  const recentErrorRate = recentErrors > 0 ? recentErrors / 10 : 0;
  
  return {
    totalErrors,
    errorsByLevel,
    errorsByCategory,
    weakConceptsCount,
    recentErrorRate,
  };
}

/**
 * Generate a gentle correction message for conversation context
 */
export async function generateCorrection(
  error: DetectedError,
  conversationContext: string
): Promise<string> {
  const client = getOpenAIClient();
  
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a friendly Italian tutor providing gentle corrections in conversation.

Your correction should:
1. Be natural and encouraging
2. Gently show the correct form
3. Be brief (1-2 sentences max)
4. Continue the conversation naturally
5. Be entirely in Italian

Format: Start with a gentle correction phrase like "Ah, vuoi dire..." or "Piccola correzione:" and then continue the conversation.

DO NOT be pedantic or interrupt the flow of conversation too much.`,
        },
        {
          role: 'user',
          content: `Error: "${error.originalText}" should be "${error.correctedText}"
Explanation: ${error.explanation}
Context: ${conversationContext}

Generate a gentle correction in Italian:`,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating correction:', error);
    return '';
  }
}

/**
 * Mark error as corrected in conversation
 */
export async function markErrorAsCorrected(errorId: string): Promise<void> {
  const db = await getDatabase();
  
  await db
    .update(grammarErrors)
    .set({
      was_corrected_in_conversation: true,
    })
    .where(eq(grammarErrors.id, errorId));
}

/**
 * Mark error as acknowledged by user
 */
export async function acknowledgeError(errorId: string): Promise<void> {
  const db = await getDatabase();
  
  await db
    .update(grammarErrors)
    .set({
      user_acknowledged: true,
    })
    .where(eq(grammarErrors.id, errorId));
}

/**
 * Get grammar insights for conversation memory integration
 */
export async function getGrammarInsightsForMemory(userId: string): Promise<string[]> {
  const weakConcepts = await identifyWeakConcepts(userId, 3);
  
  if (weakConcepts.length === 0) {
    return [];
  }
  
  const insights = weakConcepts.map(item => {
    const conceptName = item.concept.name;
    const errorCount = item.errorCount;
    return `User frequently struggles with ${conceptName} (${errorCount} errors)`;
  });
  
  return insights;
}

