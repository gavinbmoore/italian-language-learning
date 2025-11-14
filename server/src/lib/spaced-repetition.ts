/**
 * Anki-style Spaced Repetition System (SRS)
 * Implements learning phase where cards repeat in-session until graduated
 * 
 * Learning Phase (cards repeat in session):
 * - Step 0: New card → 12 hours
 * - Step 1: → 3 days
 * - Graduated: Moves to review phase with longer intervals
 * 
 * Quality scale:
 * 1: Again (resets to step 0)
 * 4: Good (advances to next step or graduates)
 * 5: Easy (immediately graduates, skips steps)
 */

import { eq, and as drizzleAnd, lte, gte, sql } from 'drizzle-orm';
import { getDatabase } from './db';
import { vocabulary } from '../schema/comprehensible-input';

export interface CardReviewData {
  id: string;
  word: string;
  word_original: string;
  translation: string | null;
  example_sentence: string | null;
  ease_factor: number | null;
  interval_days: number | null;
  repetitions: number | null;
  next_review_date: Date | null;
  last_reviewed: Date | null;
  learning_step: number | null;
}

export interface SRSUpdateResult {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: Date;
  learning_step: number;
  in_session: boolean; // Whether card should repeat in current session
}

// Learning steps configuration (Anki-style)
const LEARNING_STEPS = [0.5, 3]; // 12 hours, 3 days
const GRADUATING_INTERVAL = 7.5; // First interval after graduating (days)
const GRADUATED_MARKER = -1; // learning_step value indicating graduated card

/**
 * Calculate next review parameters using Anki-style learning algorithm
 * @param quality - Rating: 1 (Again), 4 (Good), or 5 (Easy)
 * @param currentCard - Current card data
 * @returns Updated SRS parameters including in_session flag
 */
export function calculateNextReview(
  quality: number,
  currentCard: {
    ease_factor: number | null;
    interval_days: number | null;
    repetitions: number | null;
    learning_step: number | null;
  }
): SRSUpdateResult {
  // Initialize defaults
  let easeFactor = currentCard.ease_factor ?? 2.5;
  let intervalDays = currentCard.interval_days ?? 0;
  let repetitions = currentCard.repetitions ?? 0;
  let learningStep = currentCard.learning_step ?? 0;
  let inSession = false;

  // Validate quality - only 1 (Again), 4 (Good), or 5 (Easy)
  if (quality !== 1 && quality !== 4 && quality !== 5) {
    throw new Error('Quality must be 1 (Again), 4 (Good), or 5 (Easy)');
  }

  // LEARNING PHASE: Card is still in learning (not graduated yet)
  if (learningStep >= 0 && learningStep < LEARNING_STEPS.length) {
    
    if (quality === 1) {
      // Again: Reset to step 0, stays in session
      learningStep = 0;
      intervalDays = LEARNING_STEPS[0];
      inSession = true; // Keep in session for immediate re-review
      
    } else if (quality === 4) {
      // Good: Advance to next learning step
      learningStep += 1;
      
      if (learningStep >= LEARNING_STEPS.length) {
        // Graduated! Move to review phase
        learningStep = GRADUATED_MARKER;
        intervalDays = GRADUATING_INTERVAL;
        repetitions = 1;
        inSession = false; // Exit session, schedule for future
      } else {
        // Still in learning, advance to next step
        intervalDays = LEARNING_STEPS[learningStep];
        inSession = true; // Keep in session
      }
      
    } else if (quality === 5) {
      // Easy: Immediately graduate, skip remaining steps
      learningStep = GRADUATED_MARKER;
      intervalDays = GRADUATING_INTERVAL;
      repetitions = 1;
      inSession = false; // Exit session
    }
  }
  
  // REVIEW PHASE: Card has graduated
  else if (learningStep === GRADUATED_MARKER) {
    
    if (quality === 1) {
      // Again: Failed review, back to learning
      learningStep = 0;
      intervalDays = LEARNING_STEPS[0];
      repetitions = 0;
      easeFactor = Math.max(1.3, easeFactor - 0.2); // Decrease ease
      inSession = true; // Re-enter learning in session
      
    } else if (quality === 4 || quality === 5) {
      // Good or Easy: Continue with graduated intervals
      repetitions += 1;
      
      // Adjust ease factor
      if (quality === 5) {
        easeFactor = Math.min(3.0, easeFactor + 0.15); // Increase for Easy
      }
      
      // Calculate next interval based on ease factor
      intervalDays = Math.round(intervalDays * easeFactor * 10) / 10;
      inSession = false; // Stays out of session
    }
  }

  // Calculate next review date (using hours for precision)
  const nextReviewDate = new Date();
  const hoursToAdd = intervalDays * 24;
  nextReviewDate.setTime(nextReviewDate.getTime() + hoursToAdd * 60 * 60 * 1000);

  return {
    ease_factor: easeFactor,
    interval_days: intervalDays,
    repetitions,
    next_review_date: nextReviewDate,
    learning_step: learningStep,
    in_session: inSession,
  };
}

/**
 * Get all flashcards due for review for a user
 * @param userId - User ID
 * @returns Array of cards due for review
 */
export async function getCardsDueForReview(userId: string): Promise<CardReviewData[]> {
  const db = await getDatabase();

  const cards = await db
    .select({
      id: vocabulary.id,
      word: vocabulary.word,
      word_original: vocabulary.word_original,
      translation: vocabulary.translation,
      example_sentence: vocabulary.example_sentence,
      ease_factor: vocabulary.ease_factor,
      interval_days: vocabulary.interval_days,
      repetitions: vocabulary.repetitions,
      next_review_date: vocabulary.next_review_date,
      last_reviewed: vocabulary.last_reviewed,
      learning_step: vocabulary.learning_step,
    })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true),
        sql`${vocabulary.next_review_date} <= now()`
      )
    )
    .orderBy(vocabulary.next_review_date);

  return cards as CardReviewData[];
}

/**
 * Get all flashcards for a user (not just due ones) for practice
 * @param userId - User ID
 * @param limit - Maximum number of cards to return (default 20)
 * @returns Array of all flashcards
 */
export async function getAllFlashcards(userId: string, limit: number = 20): Promise<CardReviewData[]> {
  const db = await getDatabase();

  const cards = await db
    .select({
      id: vocabulary.id,
      word: vocabulary.word,
      word_original: vocabulary.word_original,
      translation: vocabulary.translation,
      example_sentence: vocabulary.example_sentence,
      ease_factor: vocabulary.ease_factor,
      interval_days: vocabulary.interval_days,
      repetitions: vocabulary.repetitions,
      next_review_date: vocabulary.next_review_date,
      last_reviewed: vocabulary.last_reviewed,
      learning_step: vocabulary.learning_step,
    })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true)
      )
    )
    .orderBy(vocabulary.next_review_date)
    .limit(limit);

  return cards as CardReviewData[];
}

/**
 * Get hard flashcards (cards with low ease factor or in learning phase)
 * These are cards the user has struggled with and could benefit from extra practice
 * @param userId - User ID
 * @param limit - Maximum number of cards to return (default 20)
 * @returns Array of hard flashcards ordered by difficulty
 */
export async function getHardFlashcards(userId: string, limit: number = 20): Promise<CardReviewData[]> {
  const db = await getDatabase();

  // Hard cards are:
  // 1. Ease factor < 2.3 (struggled multiple times)
  // 2. OR still in learning phase (learning_step >= 0 and < 2)
  // 3. AND has been reviewed at least once (last_reviewed IS NOT NULL)
  const cards = await db
    .select({
      id: vocabulary.id,
      word: vocabulary.word,
      word_original: vocabulary.word_original,
      translation: vocabulary.translation,
      example_sentence: vocabulary.example_sentence,
      ease_factor: vocabulary.ease_factor,
      interval_days: vocabulary.interval_days,
      repetitions: vocabulary.repetitions,
      next_review_date: vocabulary.next_review_date,
      last_reviewed: vocabulary.last_reviewed,
      learning_step: vocabulary.learning_step,
    })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true),
        sql`${vocabulary.last_reviewed} IS NOT NULL`, // Has been reviewed
        sql`(${vocabulary.ease_factor} < 2.3 OR (${vocabulary.learning_step} >= 0 AND ${vocabulary.learning_step} < 2))` // Hard criteria
      )
    )
    .orderBy(vocabulary.ease_factor) // Hardest first (lowest ease factor)
    .limit(limit);

  return cards as CardReviewData[];
}

/**
 * Get count of cards due for review
 * @param userId - User ID
 * @returns Count of due cards
 */
export async function getDueCardCount(userId: string): Promise<number> {
  const db = await getDatabase();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true),
        sql`${vocabulary.next_review_date} <= now()`
      )
    );

  return Number(result[0]?.count ?? 0);
}

/**
 * Get total flashcard count for a user
 * @param userId - User ID
 * @returns Total number of flashcards
 */
export async function getTotalFlashcardCount(userId: string): Promise<number> {
  const db = await getDatabase();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true)
      )
    );

  return Number(result[0]?.count ?? 0);
}

/**
 * Review a flashcard and update its SRS parameters
 * @param cardId - Card/vocabulary ID
 * @param userId - User ID (for security)
 * @param quality - Quality rating (0-5)
 * @returns Updated card data
 */
export async function reviewCard(
  cardId: string,
  userId: string,
  quality: number
): Promise<SRSUpdateResult> {
  const db = await getDatabase();

  // Validate quality (1, 4, or 5 allowed)
  if (quality !== 1 && quality !== 4 && quality !== 5) {
    throw new Error('Quality must be 1 (Again), 4 (Good), or 5 (Easy)');
  }

  // Get current card data
  const cards = await db
    .select()
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.id, cardId),
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true)
      )
    )
    .limit(1);

  if (cards.length === 0) {
    throw new Error('Card not found or not a flashcard');
  }

  const currentCard = cards[0];

  // Calculate next review parameters
  const srsUpdate = calculateNextReview(quality, {
    ease_factor: currentCard.ease_factor,
    interval_days: currentCard.interval_days,
    repetitions: currentCard.repetitions,
    learning_step: currentCard.learning_step,
  });

  // Update the card in database
  await db
    .update(vocabulary)
    .set({
      ease_factor: srsUpdate.ease_factor,
      interval_days: srsUpdate.interval_days,
      repetitions: srsUpdate.repetitions,
      next_review_date: srsUpdate.next_review_date,
      learning_step: srsUpdate.learning_step,
      last_reviewed: new Date(),
    })
    .where(eq(vocabulary.id, cardId));

  return srsUpdate;
}

/**
 * Initialize a vocabulary word as a flashcard with initial SRS values
 * @param wordId - Vocabulary word ID
 * @param userId - User ID (for security)
 * @returns Success boolean
 */
export async function createFlashcardFromWord(
  wordId: string,
  userId: string
): Promise<boolean> {
  const db = await getDatabase();

  // Calculate initial next review date (12 hours from now)
  const nextReviewDate = new Date();
  nextReviewDate.setTime(nextReviewDate.getTime() + 12 * 60 * 60 * 1000);

  // Update the vocabulary entry to be a flashcard (starts in learning phase)
  const result = await db
    .update(vocabulary)
    .set({
      is_flashcard: true,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      learning_step: 0, // Start in learning phase
      next_review_date: nextReviewDate,
      last_reviewed: null,
    })
    .where(
      drizzleAnd(
        eq(vocabulary.id, wordId),
        eq(vocabulary.user_id, userId)
      )
    );

  return true;
}

/**
 * Get flashcard statistics for a user
 * @param userId - User ID
 * @returns Statistics object
 */
export async function getFlashcardStats(userId: string): Promise<{
  dueCount: number;
  totalCards: number;
  newCards: number;
  learningCards: number;
  matureCards: number;
}> {
  const db = await getDatabase();
  const now = new Date();

  const dueCount = await getDueCardCount(userId);
  const totalCards = await getTotalFlashcardCount(userId);

  // New cards: repetitions = 0
  const newCardsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true),
        eq(vocabulary.repetitions, 0)
      )
    );
  const newCards = Number(newCardsResult[0]?.count ?? 0);

  // Learning cards: repetitions > 0 and interval < 21 days
  const learningCardsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true),
        sql`${vocabulary.repetitions} > 0`,
        sql`${vocabulary.interval_days} < 21`
      )
    );
  const learningCards = Number(learningCardsResult[0]?.count ?? 0);

  // Mature cards: interval >= 21 days
  const matureCardsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true),
        sql`${vocabulary.interval_days} >= 21`
      )
    );
  const matureCards = Number(matureCardsResult[0]?.count ?? 0);

  return {
    dueCount,
    totalCards,
    newCards,
    learningCards,
    matureCards,
  };
}

/**
 * Get learned words statistics (graduated flashcards) for a user
 * @param userId - User ID
 * @returns Statistics for learned words by time period
 */
export async function getLearnedWordsStats(userId: string): Promise<{
  allTime: number;
  thisMonth: number;
  thisWeek: number;
}> {
  const db = await getDatabase();
  const now = new Date();

  // Calculate date boundaries
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // All time: Count all graduated cards (learning_step = -1)
  const allTimeResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true),
        eq(vocabulary.learning_step, GRADUATED_MARKER)
      )
    );
  const allTime = Number(allTimeResult[0]?.count ?? 0);

  // This month: Graduated cards with last_reviewed in current month
  const thisMonthResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true),
        eq(vocabulary.learning_step, GRADUATED_MARKER),
        sql`${vocabulary.last_reviewed} IS NOT NULL`,
        gte(vocabulary.last_reviewed, monthStart)
      )
    );
  const thisMonth = Number(thisMonthResult[0]?.count ?? 0);

  // This week: Graduated cards with last_reviewed in last 7 days
  const thisWeekResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      drizzleAnd(
        eq(vocabulary.user_id, userId),
        eq(vocabulary.is_flashcard, true),
        eq(vocabulary.learning_step, GRADUATED_MARKER),
        sql`${vocabulary.last_reviewed} IS NOT NULL`,
        gte(vocabulary.last_reviewed, weekAgo)
      )
    );
  const thisWeek = Number(thisWeekResult[0]?.count ?? 0);

  return {
    allTime,
    thisMonth,
    thisWeek,
  };
}

/**
 * ========================================
 * GRAMMAR CONCEPT SRS FUNCTIONS
 * ========================================
 * Similar to vocabulary flashcards, but for grammar concepts
 */

import { 
  grammarConcepts, 
  userGrammarProgress,
  type UserGrammarProgress 
} from '../schema/grammar';

export interface GrammarConceptReviewData {
  id: string;
  conceptId: string;
  conceptName: string;
  conceptNameItalian: string;
  category: string;
  cefrLevel: string;
  description: string;
  examples: any;
  ease_factor: number | null;
  interval_days: number | null;
  repetitions: number | null;
  next_review_date: Date | null;
  last_reviewed: Date | null;
  learning_step: number | null;
  mastery_level: string;
  error_count: number;
}

/**
 * Get grammar concepts due for review (SRS-based)
 */
export async function getGrammarConceptsDueForReview(userId: string): Promise<GrammarConceptReviewData[]> {
  const db = await getDatabase();

  const concepts = await db
    .select({
      progress: userGrammarProgress,
      concept: grammarConcepts,
    })
    .from(userGrammarProgress)
    .innerJoin(grammarConcepts, eq(grammarConcepts.id, userGrammarProgress.concept_id))
    .where(
      drizzleAnd(
        eq(userGrammarProgress.user_id, userId),
        sql`${userGrammarProgress.next_review_date} <= now()`
      )
    )
    .orderBy(userGrammarProgress.next_review_date);

  return concepts.map(item => ({
    id: item.progress.id,
    conceptId: item.concept.id,
    conceptName: item.concept.name,
    conceptNameItalian: item.concept.name_italian,
    category: item.concept.category,
    cefrLevel: item.concept.cefr_level,
    description: item.concept.description,
    examples: item.concept.examples,
    ease_factor: item.progress.ease_factor,
    interval_days: item.progress.interval_days,
    repetitions: item.progress.repetitions,
    next_review_date: item.progress.next_review_date,
    last_reviewed: item.progress.last_reviewed,
    learning_step: item.progress.learning_step,
    mastery_level: item.progress.mastery_level || 'new',
    error_count: item.progress.error_count || 0,
  }));
}

/**
 * Get count of grammar concepts due for review
 */
export async function getDueGrammarConceptCount(userId: string): Promise<number> {
  const db = await getDatabase();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(userGrammarProgress)
    .where(
      drizzleAnd(
        eq(userGrammarProgress.user_id, userId),
        sql`${userGrammarProgress.next_review_date} <= now()`
      )
    );

  return Number(result[0]?.count ?? 0);
}

/**
 * Review a grammar concept and update SRS parameters
 */
export async function reviewGrammarConcept(
  userId: string,
  conceptId: string,
  quality: number
): Promise<SRSUpdateResult> {
  const db = await getDatabase();

  // Validate quality (1, 4, or 5)
  if (quality !== 1 && quality !== 4 && quality !== 5) {
    throw new Error('Quality must be 1 (Again), 4 (Good), or 5 (Easy)');
  }

  // Get current progress
  const progressRecords = await db
    .select()
    .from(userGrammarProgress)
    .where(
      drizzleAnd(
        eq(userGrammarProgress.user_id, userId),
        eq(userGrammarProgress.concept_id, conceptId)
      )
    )
    .limit(1);

  let currentProgress: UserGrammarProgress;
  let progressId: string;

  if (progressRecords.length === 0) {
    // Create new progress record if it doesn't exist
    progressId = `${userId}-progress-${conceptId}`;
    await db.insert(userGrammarProgress).values({
      id: progressId,
      user_id: userId,
      concept_id: conceptId,
      mastery_level: 'new',
    });
    
    currentProgress = {
      id: progressId,
      user_id: userId,
      concept_id: conceptId,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      learning_step: 0,
      mastery_level: 'new',
      total_exercises_completed: 0,
      correct_exercises: 0,
      error_count: 0,
      next_review_date: null,
      last_reviewed: null,
      last_error_date: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as UserGrammarProgress;
  } else {
    currentProgress = progressRecords[0];
    progressId = currentProgress.id;
  }

  // Calculate next review parameters using the same algorithm as vocabulary
  const srsUpdate = calculateNextReview(quality, {
    ease_factor: currentProgress.ease_factor,
    interval_days: currentProgress.interval_days,
    repetitions: currentProgress.repetitions,
    learning_step: currentProgress.learning_step,
  });

  // Determine mastery level based on SRS progress
  let masteryLevel = currentProgress.mastery_level || 'new';
  if (srsUpdate.learning_step === -1 && srsUpdate.repetitions >= 5) {
    masteryLevel = 'mastered';
  } else if (srsUpdate.learning_step === -1) {
    masteryLevel = 'practicing';
  } else if (srsUpdate.repetitions > 0) {
    masteryLevel = 'learning';
  }

  // Update progress in database
  await db
    .update(userGrammarProgress)
    .set({
      ease_factor: srsUpdate.ease_factor,
      interval_days: srsUpdate.interval_days,
      repetitions: srsUpdate.repetitions,
      next_review_date: srsUpdate.next_review_date,
      learning_step: srsUpdate.learning_step,
      last_reviewed: new Date(),
      mastery_level: masteryLevel,
      updated_at: new Date(),
    })
    .where(eq(userGrammarProgress.id, progressId));

  return srsUpdate;
}

/**
 * Initialize a grammar concept for SRS tracking
 */
export async function initializeGrammarConceptReview(
  userId: string,
  conceptId: string
): Promise<boolean> {
  const db = await getDatabase();

  // Check if already exists
  const existing = await db
    .select()
    .from(userGrammarProgress)
    .where(
      drizzleAnd(
        eq(userGrammarProgress.user_id, userId),
        eq(userGrammarProgress.concept_id, conceptId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return false; // Already initialized
  }

  // Calculate initial next review date (12 hours from now)
  const nextReviewDate = new Date();
  nextReviewDate.setTime(nextReviewDate.getTime() + 12 * 60 * 60 * 1000);

  // Create progress record
  const progressId = `${userId}-progress-${conceptId}`;
  await db.insert(userGrammarProgress).values({
    id: progressId,
    user_id: userId,
    concept_id: conceptId,
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    learning_step: 0,
    next_review_date: nextReviewDate,
    mastery_level: 'new',
  });

  return true;
}

/**
 * Get grammar mastery statistics for a user
 */
export async function getGrammarMasteryStats(userId: string): Promise<{
  dueCount: number;
  totalConcepts: number;
  newConcepts: number;
  learningConcepts: number;
  practicingConcepts: number;
  masteredConcepts: number;
  weakConcepts: number; // Concepts with errors
}> {
  const db = await getDatabase();

  const dueCount = await getDueGrammarConceptCount(userId);

  // Total concepts being tracked
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userGrammarProgress)
    .where(eq(userGrammarProgress.user_id, userId));
  const totalConcepts = Number(totalResult[0]?.count ?? 0);

  // New concepts
  const newResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userGrammarProgress)
    .where(
      drizzleAnd(
        eq(userGrammarProgress.user_id, userId),
        eq(userGrammarProgress.mastery_level, 'new')
      )
    );
  const newConcepts = Number(newResult[0]?.count ?? 0);

  // Learning concepts
  const learningResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userGrammarProgress)
    .where(
      drizzleAnd(
        eq(userGrammarProgress.user_id, userId),
        eq(userGrammarProgress.mastery_level, 'learning')
      )
    );
  const learningConcepts = Number(learningResult[0]?.count ?? 0);

  // Practicing concepts
  const practicingResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userGrammarProgress)
    .where(
      drizzleAnd(
        eq(userGrammarProgress.user_id, userId),
        eq(userGrammarProgress.mastery_level, 'practicing')
      )
    );
  const practicingConcepts = Number(practicingResult[0]?.count ?? 0);

  // Mastered concepts
  const masteredResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userGrammarProgress)
    .where(
      drizzleAnd(
        eq(userGrammarProgress.user_id, userId),
        eq(userGrammarProgress.mastery_level, 'mastered')
      )
    );
  const masteredConcepts = Number(masteredResult[0]?.count ?? 0);

  // Weak concepts (with errors)
  const weakResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userGrammarProgress)
    .where(
      drizzleAnd(
        eq(userGrammarProgress.user_id, userId),
        sql`${userGrammarProgress.error_count} > 0`
      )
    );
  const weakConcepts = Number(weakResult[0]?.count ?? 0);

  return {
    dueCount,
    totalConcepts,
    newConcepts,
    learningConcepts,
    practicingConcepts,
    masteredConcepts,
    weakConcepts,
  };
}

