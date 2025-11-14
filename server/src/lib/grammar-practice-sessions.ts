import { getDatabase } from './db';
import { grammarPracticeSessions, grammarExercises } from '../schema/grammar';
import type { DifficultyLevel, DifficultyAdjustment } from '../schema/grammar';
import { eq, and, desc } from 'drizzle-orm';
import { getOpenAIClient } from './openai-client';

/**
 * Create a new adaptive practice session
 */
export async function createPracticeSession(
  userId: string,
  conceptId: string,
  initialDifficulty: DifficultyLevel = 'easy'
): Promise<string> {
  const db = await getDatabase();
  
  const sessionId = `${userId}-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  await db.insert(grammarPracticeSessions).values({
    id: sessionId,
    user_id: userId,
    concept_id: conceptId,
    current_difficulty: initialDifficulty,
    difficulty_adjustments: JSON.stringify([]),
  });
  
  console.log(`✨ Created practice session ${sessionId} for concept ${conceptId} at ${initialDifficulty} difficulty`);
  
  return sessionId;
}

/**
 * Update session performance after an exercise is completed
 */
export async function updateSessionPerformance(
  sessionId: string,
  isCorrect: boolean
): Promise<void> {
  const db = await getDatabase();
  
  const sessions = await db
    .select()
    .from(grammarPracticeSessions)
    .where(eq(grammarPracticeSessions.id, sessionId))
    .limit(1);
  
  if (sessions.length === 0) {
    throw new Error('Session not found');
  }
  
  const session = sessions[0];
  
  await db
    .update(grammarPracticeSessions)
    .set({
      total_exercises_attempted: session.total_exercises_attempted + 1,
      total_correct: session.total_correct + (isCorrect ? 1 : 0),
      total_incorrect: session.total_incorrect + (isCorrect ? 0 : 1),
      updated_at: new Date(),
    })
    .where(eq(grammarPracticeSessions.id, sessionId));
}

/**
 * Check if difficulty should be adjusted and update if needed
 * Called after completing a batch of exercises
 */
export async function checkAndAdjustDifficulty(
  sessionId: string,
  batchSize: number = 10
): Promise<{ adjusted: boolean; newDifficulty?: DifficultyLevel; reason?: string }> {
  const db = await getDatabase();
  
  const sessions = await db
    .select()
    .from(grammarPracticeSessions)
    .where(eq(grammarPracticeSessions.id, sessionId))
    .limit(1);
  
  if (sessions.length === 0) {
    throw new Error('Session not found');
  }
  
  const session = sessions[0];
  
  // Only adjust after completing a full batch
  if (session.total_exercises_attempted % batchSize !== 0) {
    return { adjusted: false };
  }
  
  // Calculate performance for the last batch
  const lastBatchExercises = await db
    .select()
    .from(grammarExercises)
    .where(eq(grammarExercises.session_id, sessionId))
    .orderBy(desc(grammarExercises.attempted_at))
    .limit(batchSize);
  
  const batchCorrect = lastBatchExercises.filter(ex => ex.is_correct).length;
  const batchScore = batchCorrect / batchSize;
  
  const currentDifficulty = session.current_difficulty as DifficultyLevel;
  let newDifficulty: DifficultyLevel | null = null;
  let reason = '';
  
  // Difficulty adjustment logic
  if (batchScore >= 0.8 && currentDifficulty !== 'hard') {
    // Increase difficulty if scoring 80% or higher
    if (currentDifficulty === 'easy') {
      newDifficulty = 'medium';
      reason = `Excellent performance (${(batchScore * 100).toFixed(0)}%) - advancing to medium difficulty`;
    } else if (currentDifficulty === 'medium') {
      newDifficulty = 'hard';
      reason = `Great mastery (${(batchScore * 100).toFixed(0)}%) - advancing to hard difficulty`;
    }
  } else if (batchScore < 0.6 && currentDifficulty !== 'easy') {
    // Decrease difficulty if scoring below 60%
    if (currentDifficulty === 'hard') {
      newDifficulty = 'medium';
      reason = `Needs more practice (${(batchScore * 100).toFixed(0)}%) - adjusting to medium difficulty`;
    } else if (currentDifficulty === 'medium') {
      newDifficulty = 'easy';
      reason = `Solidifying fundamentals (${(batchScore * 100).toFixed(0)}%) - adjusting to easy difficulty`;
    }
  }
  
  if (newDifficulty) {
    const adjustments = typeof session.difficulty_adjustments === 'string'
      ? JSON.parse(session.difficulty_adjustments)
      : session.difficulty_adjustments || [];
    
    const adjustment: DifficultyAdjustment = {
      timestamp: new Date().toISOString(),
      from: currentDifficulty,
      to: newDifficulty,
      reason,
      performanceScore: batchScore,
    };
    
    adjustments.push(adjustment);
    
    await db
      .update(grammarPracticeSessions)
      .set({
        current_difficulty: newDifficulty,
        difficulty_adjustments: JSON.stringify(adjustments),
        updated_at: new Date(),
      })
      .where(eq(grammarPracticeSessions.id, sessionId));
    
    console.log(`📊 Adjusted difficulty: ${currentDifficulty} → ${newDifficulty} (${reason})`);
    
    return { adjusted: true, newDifficulty, reason };
  }
  
  return { adjusted: false };
}

/**
 * Complete a practice session and generate a summary
 */
export async function completePracticeSession(
  sessionId: string
): Promise<void> {
  const db = await getDatabase();
  const client = getOpenAIClient();
  
  // Get session data
  const sessions = await db
    .select()
    .from(grammarPracticeSessions)
    .where(eq(grammarPracticeSessions.id, sessionId))
    .limit(1);
  
  if (sessions.length === 0) {
    throw new Error('Session not found');
  }
  
  const session = sessions[0];
  
  // Get all exercises from this session
  const exercises = await db
    .select()
    .from(grammarExercises)
    .where(eq(grammarExercises.session_id, sessionId));
  
  // Analyze performance by exercise type
  const performanceByType: Record<string, { correct: number; total: number }> = {};
  
  for (const exercise of exercises) {
    if (!performanceByType[exercise.exercise_type]) {
      performanceByType[exercise.exercise_type] = { correct: 0, total: 0 };
    }
    performanceByType[exercise.exercise_type].total++;
    if (exercise.is_correct) {
      performanceByType[exercise.exercise_type].correct++;
    }
  }
  
  // Generate AI summary
  const overallScore = session.total_exercises_attempted > 0
    ? (session.total_correct / session.total_exercises_attempted) * 100
    : 0;
  
  const performanceSummary = Object.entries(performanceByType)
    .map(([type, stats]) => `${type}: ${stats.correct}/${stats.total} (${((stats.correct / stats.total) * 100).toFixed(0)}%)`)
    .join(', ');
  
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are summarizing a grammar practice session. Create an encouraging, constructive summary.
          
Session stats:
- Total exercises: ${session.total_exercises_attempted}
- Correct: ${session.total_correct}
- Overall score: ${overallScore.toFixed(0)}%
- Performance by type: ${performanceSummary}
- Difficulty adjustments: ${session.difficulty_adjustments ? JSON.parse(session.difficulty_adjustments as any).length : 0}

Create a brief, encouraging summary (2-3 sentences) highlighting progress and areas to focus on next.
Also identify 2-3 areas of strength and 2-3 areas for improvement.

Return ONLY valid JSON:
{
  "summary": "overall session summary",
  "areasOfStrength": ["strength1", "strength2"],
  "areasForImprovement": ["area1", "area2"]
}`,
        },
        {
          role: 'user',
          content: 'Generate session summary',
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });
    
    const responseContent = completion.choices[0]?.message?.content || '{}';
    const summary = JSON.parse(responseContent);
    
    await db
      .update(grammarPracticeSessions)
      .set({
        is_active: false,
        completed_at: new Date(),
        session_summary: summary.summary,
        areas_of_strength: summary.areasOfStrength || [],
        areas_for_improvement: summary.areasForImprovement || [],
        updated_at: new Date(),
      })
      .where(eq(grammarPracticeSessions.id, sessionId));
    
    console.log(`✅ Completed practice session ${sessionId} with summary`);
  } catch (error) {
    console.error('Error generating session summary:', error);
    
    // Fallback: just mark as complete without summary
    await db
      .update(grammarPracticeSessions)
      .set({
        is_active: false,
        completed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(grammarPracticeSessions.id, sessionId));
  }
}

/**
 * Get the current active session for a user and concept
 */
export async function getActiveSession(
  userId: string,
  conceptId: string
): Promise<string | null> {
  const db = await getDatabase();
  
  const sessions = await db
    .select()
    .from(grammarPracticeSessions)
    .where(
      and(
        eq(grammarPracticeSessions.user_id, userId),
        eq(grammarPracticeSessions.concept_id, conceptId),
        eq(grammarPracticeSessions.is_active, true)
      )
    )
    .orderBy(desc(grammarPracticeSessions.started_at))
    .limit(1);
  
  return sessions.length > 0 ? sessions[0].id : null;
}

/**
 * Get session details
 */
export async function getSessionDetails(sessionId: string) {
  const db = await getDatabase();
  
  const sessions = await db
    .select()
    .from(grammarPracticeSessions)
    .where(eq(grammarPracticeSessions.id, sessionId))
    .limit(1);
  
  if (sessions.length === 0) {
    throw new Error('Session not found');
  }
  
  return sessions[0];
}

/**
 * Get recent completed sessions for a user and concept (for context)
 */
export async function getRecentSessions(
  userId: string,
  conceptId: string,
  limit: number = 3
) {
  const db = await getDatabase();
  
  const sessions = await db
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
    .limit(limit);
  
  return sessions;
}

