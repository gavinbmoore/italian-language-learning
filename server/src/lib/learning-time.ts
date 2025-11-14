import { getDatabase } from './db';
import { learningSessions, vocabulary } from '../schema/comprehensible-input';
import { eq, and as drizzleAnd, desc, sum, sql, gte, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * Start a new learning session
 */
export async function startLearningSession(userId: string, pageContext: string = 'general') {
  const db = await getDatabase();
  
  // Check if there's already an active session
  const activeSessions = await db
    .select()
    .from(learningSessions)
    .where(drizzleAnd(eq(learningSessions.user_id, userId), eq(learningSessions.is_active, true)));
  
  // End any active sessions first (shouldn't happen, but just in case)
  for (const session of activeSessions) {
    await endLearningSession(userId, session.id);
  }
  
  // Create new session
  const sessionId = randomUUID();
  const now = new Date();
  
  await db.insert(learningSessions).values({
    id: sessionId,
    user_id: userId,
    start_time: now,
    duration_seconds: 0,
    page_context: pageContext,
    is_active: true,
    created_at: now,
    updated_at: now,
  });
  
  return {
    sessionId,
    startTime: now.toISOString(),
    pageContext,
  };
}

/**
 * Update an active learning session with current duration
 */
export async function updateLearningSession(userId: string, sessionId: string, durationSeconds: number) {
  const db = await getDatabase();
  
  await db
    .update(learningSessions)
    .set({
      duration_seconds: durationSeconds,
      updated_at: new Date(),
    })
    .where(drizzleAnd(eq(learningSessions.id, sessionId), eq(learningSessions.user_id, userId)));
  
  return {
    sessionId,
    durationSeconds,
  };
}

/**
 * End a learning session
 */
export async function endLearningSession(userId: string, sessionId: string) {
  const db = await getDatabase();
  
  const now = new Date();
  
  await db
    .update(learningSessions)
    .set({
      is_active: false,
      end_time: now,
      updated_at: now,
    })
    .where(drizzleAnd(eq(learningSessions.id, sessionId), eq(learningSessions.user_id, userId)));
  
  return {
    sessionId,
    endTime: now.toISOString(),
  };
}

/**
 * Get total learning time for a user
 */
export async function getTotalLearningTime(userId: string, days?: number) {
  const db = await getDatabase();
  
  let whereCondition;
  
  // If days is specified, filter by date range
  if (days !== undefined && days > 0) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    whereCondition = drizzleAnd(
      eq(learningSessions.user_id, userId),
      gte(learningSessions.start_time, startDate)
    );
  } else {
    whereCondition = eq(learningSessions.user_id, userId);
  }
  
  const result = await db
    .select({
      totalSeconds: sum(learningSessions.duration_seconds),
    })
    .from(learningSessions)
    .where(whereCondition);
  
  const totalSeconds = Number(result[0]?.totalSeconds || 0);
  
  return {
    totalSeconds,
    totalMinutes: Math.floor(totalSeconds / 60),
    totalHours: Math.floor(totalSeconds / 3600),
    formattedTime: formatDuration(totalSeconds),
  };
}

/**
 * Get active session for a user
 */
export async function getActiveSession(userId: string) {
  const db = await getDatabase();
  
  const activeSessions = await db
    .select()
    .from(learningSessions)
    .where(drizzleAnd(eq(learningSessions.user_id, userId), eq(learningSessions.is_active, true)))
    .limit(1);
  
  return activeSessions.length > 0 ? activeSessions[0] : null;
}

/**
 * Get learning session history
 */
export async function getLearningSessionHistory(userId: string, limit: number = 50, offset: number = 0) {
  const db = await getDatabase();
  
  const sessions = await db
    .select()
    .from(learningSessions)
    .where(eq(learningSessions.user_id, userId))
    .orderBy(desc(learningSessions.start_time))
    .limit(limit)
    .offset(offset);
  
  return sessions;
}

/**
 * Get learning statistics
 */
export async function getLearningStats(userId: string) {
  const db = await getDatabase();
  
  // Get total time
  const totalTime = await getTotalLearningTime(userId);
  
  // Get time for last 7 days
  const last7Days = await getTotalLearningTime(userId, 7);
  
  // Get time for last 30 days
  const last30Days = await getTotalLearningTime(userId, 30);
  
  // Get session count
  const sessions = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(learningSessions)
    .where(eq(learningSessions.user_id, userId));
  
  const sessionCount = Number(sessions[0]?.count || 0);
  
  return {
    totalTime,
    last7Days,
    last30Days,
    sessionCount,
  };
}

/**
 * Check if this is the first message after a session has ended
 * Used to determine if we should suggest a new topic
 */
export async function isFirstMessageAfterSessionEnd(userId: string): Promise<boolean> {
  try {
    const db = await getDatabase();
    
    // Get the most recent session
    const recentSessions = await db
      .select()
      .from(learningSessions)
      .where(eq(learningSessions.user_id, userId))
      .orderBy(desc(learningSessions.start_time))
      .limit(1);
    
    if (recentSessions.length === 0) {
      // No sessions yet - not a "new session start"
      return false;
    }
    
    const lastSession = recentSessions[0];
    
    // If there's an active session, this is not the first message after session end
    if (lastSession.is_active) {
      return false;
    }
    
    // Check if there have been any messages since the session ended
    const { conversations } = await import('../schema/comprehensible-input');
    
    const sessionEndTime = lastSession.end_time || lastSession.updated_at;
    
    const messagesSinceEnd = await db
      .select()
      .from(conversations)
      .where(
        drizzleAnd(
          eq(conversations.user_id, userId),
          gte(conversations.created_at, sessionEndTime)
        )
      )
      .limit(1);
    
    // If no messages since session end, this is the first message
    return messagesSinceEnd.length === 0;
  } catch (error) {
    console.error('Error checking if first message after session end:', error);
    return false;
  }
}

/**
 * Get daily activity statistics for heatmap visualization
 * Returns activity data (study time + flashcard reviews) for each day in the date range
 */
export async function getDailyActivityStats(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; durationSeconds: number; flashcardReviews: number }>> {
  const db = await getDatabase();
  
  // Query 1: Get total duration per day from learning_sessions
  const sessionStats = await db
    .select({
      date: sql<string>`DATE(${learningSessions.start_time})`,
      totalSeconds: sum(learningSessions.duration_seconds),
    })
    .from(learningSessions)
    .where(
      drizzleAnd(
        eq(learningSessions.user_id, userId),
        gte(learningSessions.start_time, startDate),
        lte(learningSessions.start_time, endDate)
      )
    )
    .groupBy(sql`DATE(${learningSessions.start_time})`);
  
  // Query 2: Get flashcard review count per day from vocabulary
  const flashcardStats = await db
    .select({
      date: sql<string>`DATE(${vocabulary.last_reviewed})`,
      count: sql<number>`count(*)`,
    })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true),
        sql`${vocabulary.last_reviewed} IS NOT NULL`,
        gte(vocabulary.last_reviewed, startDate),
        lte(vocabulary.last_reviewed, endDate)
      )
    )
    .groupBy(sql`DATE(${vocabulary.last_reviewed})`);
  
  // Create a map to combine both datasets
  const activityMap = new Map<string, { durationSeconds: number; flashcardReviews: number }>();
  
  // Add session data
  for (const session of sessionStats) {
    activityMap.set(session.date, {
      durationSeconds: Number(session.totalSeconds || 0),
      flashcardReviews: 0,
    });
  }
  
  // Add flashcard review data
  for (const flashcard of flashcardStats) {
    const existing = activityMap.get(flashcard.date);
    if (existing) {
      existing.flashcardReviews = Number(flashcard.count || 0);
    } else {
      activityMap.set(flashcard.date, {
        durationSeconds: 0,
        flashcardReviews: Number(flashcard.count || 0),
      });
    }
  }
  
  // Convert map to array and sort by date
  const result = Array.from(activityMap.entries())
    .map(([date, stats]) => ({
      date,
      durationSeconds: stats.durationSeconds,
      flashcardReviews: stats.flashcardReviews,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return result;
}

/**
 * Format duration in seconds to a readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

