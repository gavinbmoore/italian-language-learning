/**
 * Anki deck review and SRS algorithm
 * Reuses the spaced-repetition logic but applies to Anki cards
 */

import { eq, and as drizzleAnd, sql, desc } from 'drizzle-orm';
import { getDatabase } from './db';
import { ankiDecks, ankiCards, ankiCardState, ankiNotes } from '../schema/anki';
import { calculateNextReview, type SRSUpdateResult } from './spaced-repetition';

export interface AnkiCardReviewData {
  cardId: string;
  noteId: string;
  cardType: 'basic' | 'basic_reverse' | 'cloze';
  frontContent: string;
  backContent: string;
  frontAudio: string[];
  backAudio: string[];
  // SRS data
  ease_factor: number | null;
  interval_days: number | null;
  repetitions: number | null;
  learning_step: number | null;
  next_review_date: Date | null;
  last_reviewed: Date | null;
  state: string;
  // Note data
  modelName: string;
  tags: string[];
}

/**
 * Get cards due for review in a deck
 */
export async function getAnkiCardsDue(
  userId: string,
  deckId: string,
  limit: number = 50
): Promise<AnkiCardReviewData[]> {
  const db = await getDatabase();
  
  const cards = await db
    .select({
      cardId: ankiCards.id,
      noteId: ankiCards.note_id,
      cardType: ankiCards.card_type,
      frontContent: ankiCards.front_content,
      backContent: ankiCards.back_content,
      frontAudio: ankiCards.front_audio,
      backAudio: ankiCards.back_audio,
      ease_factor: ankiCardState.ease_factor,
      interval_days: ankiCardState.interval_days,
      repetitions: ankiCardState.repetitions,
      learning_step: ankiCardState.learning_step,
      next_review_date: ankiCardState.next_review_date,
      last_reviewed: ankiCardState.last_reviewed,
      state: ankiCardState.state,
      modelName: ankiNotes.model_name,
      tags: ankiNotes.tags,
    })
    .from(ankiCards)
    .innerJoin(ankiCardState, eq(ankiCards.id, ankiCardState.card_id))
    .innerJoin(ankiNotes, eq(ankiCards.note_id, ankiNotes.id))
    .where(
      drizzleAnd(
        eq(ankiCards.deck_id, deckId),
        eq(ankiCardState.user_id, userId),
        sql`${ankiCardState.next_review_date} <= now()`,
        sql`${ankiCardState.state} != 'new'`
      )
    )
    .orderBy(ankiCardState.next_review_date)
    .limit(limit);
  
  return cards as AnkiCardReviewData[];
}

/**
 * Get new cards from a deck (not yet started)
 */
export async function getAnkiNewCards(
  userId: string,
  deckId: string,
  limit: number = 20
): Promise<AnkiCardReviewData[]> {
  const db = await getDatabase();
  
  const cards = await db
    .select({
      cardId: ankiCards.id,
      noteId: ankiCards.note_id,
      cardType: ankiCards.card_type,
      frontContent: ankiCards.front_content,
      backContent: ankiCards.back_content,
      frontAudio: ankiCards.front_audio,
      backAudio: ankiCards.back_audio,
      ease_factor: ankiCardState.ease_factor,
      interval_days: ankiCardState.interval_days,
      repetitions: ankiCardState.repetitions,
      learning_step: ankiCardState.learning_step,
      next_review_date: ankiCardState.next_review_date,
      last_reviewed: ankiCardState.last_reviewed,
      state: ankiCardState.state,
      modelName: ankiNotes.model_name,
      tags: ankiNotes.tags,
    })
    .from(ankiCards)
    .innerJoin(ankiCardState, eq(ankiCards.id, ankiCardState.card_id))
    .innerJoin(ankiNotes, eq(ankiCards.note_id, ankiNotes.id))
    .where(
      drizzleAnd(
        eq(ankiCards.deck_id, deckId),
        eq(ankiCardState.user_id, userId),
        eq(ankiCardState.state, 'new')
      )
    )
    .orderBy(ankiCards.ordinal)
    .limit(limit);
  
  return cards as AnkiCardReviewData[];
}

/**
 * Get all cards for review/study (mix of due and new)
 */
export async function getAnkiStudyCards(
  userId: string,
  deckId: string,
  maxNew: number = 20,
  maxReview: number = 50
): Promise<AnkiCardReviewData[]> {
  const dueCards = await getAnkiCardsDue(userId, deckId, maxReview);
  const newCards = await getAnkiNewCards(userId, deckId, maxNew);
  
  // Mix new and due cards (Anki typically shows new cards first, then reviews)
  return [...newCards, ...dueCards];
}

/**
 * Review an Anki card and update SRS state
 */
export async function reviewAnkiCard(
  userId: string,
  cardId: string,
  quality: number
): Promise<SRSUpdateResult> {
  const db = await getDatabase();
  
  // Validate quality (1, 4, or 5)
  if (quality !== 1 && quality !== 4 && quality !== 5) {
    throw new Error('Quality must be 1 (Again), 4 (Good), or 5 (Easy)');
  }
  
  // Get current card state
  const states = await db
    .select()
    .from(ankiCardState)
    .where(
      drizzleAnd(
        eq(ankiCardState.card_id, cardId),
        eq(ankiCardState.user_id, userId)
      )
    )
    .limit(1);
  
  if (states.length === 0) {
    throw new Error('Card state not found');
  }
  
  const currentState = states[0];
  
  // Calculate next review using existing SRS algorithm
  const srsUpdate = calculateNextReview(quality, {
    ease_factor: currentState.ease_factor,
    interval_days: currentState.interval_days,
    repetitions: currentState.repetitions,
    learning_step: currentState.learning_step,
  });
  
  // Determine card state
  let cardState = currentState.state;
  if (srsUpdate.learning_step >= 0 && srsUpdate.learning_step < 2) {
    cardState = 'learning';
  } else if (srsUpdate.learning_step === -1) {
    cardState = 'review';
  }
  
  // Update lapses if card failed
  const lapses = quality === 1 ? currentState.lapses + 1 : currentState.lapses;
  
  // Update card state in database
  await db
    .update(ankiCardState)
    .set({
      ease_factor: srsUpdate.ease_factor,
      interval_days: srsUpdate.interval_days,
      repetitions: srsUpdate.repetitions,
      learning_step: srsUpdate.learning_step,
      next_review_date: srsUpdate.next_review_date,
      last_reviewed: new Date(),
      state: cardState,
      lapses,
      total_reviews: currentState.total_reviews + 1,
      updated_at: new Date(),
    })
    .where(eq(ankiCardState.id, currentState.id));
  
  return srsUpdate;
}

/**
 * Get deck statistics
 */
export async function getAnkiDeckStats(
  userId: string,
  deckId: string
): Promise<{
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  dueCards: number;
  masteredCards: number;
}> {
  const db = await getDatabase();
  
  // Get all card states for this deck
  const states = await db
    .select({
      state: ankiCardState.state,
      next_review_date: ankiCardState.next_review_date,
      interval_days: ankiCardState.interval_days,
    })
    .from(ankiCardState)
    .innerJoin(ankiCards, eq(ankiCards.id, ankiCardState.card_id))
    .where(
      drizzleAnd(
        eq(ankiCards.deck_id, deckId),
        eq(ankiCardState.user_id, userId)
      )
    );
  
  const totalCards = states.length;
  const newCards = states.filter(s => s.state === 'new').length;
  const learningCards = states.filter(s => s.state === 'learning').length;
  const reviewCards = states.filter(s => s.state === 'review').length;
  
  // Due cards: cards with next_review_date in the past
  const now = new Date();
  const dueCards = states.filter(s => 
    s.next_review_date && new Date(s.next_review_date) <= now
  ).length;
  
  // Mastered: review cards with interval >= 21 days
  const masteredCards = states.filter(s => 
    s.state === 'review' && (s.interval_days || 0) >= 21
  ).length;
  
  return {
    totalCards,
    newCards,
    learningCards,
    reviewCards,
    dueCards,
    masteredCards,
  };
}

/**
 * Update deck last_studied_at timestamp
 */
export async function updateDeckLastStudied(deckId: string): Promise<void> {
  const db = await getDatabase();
  
  await db
    .update(ankiDecks)
    .set({
      last_studied_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(ankiDecks.id, deckId));
}

/**
 * Get count of due cards in a deck
 */
export async function getAnkiDueCount(
  userId: string,
  deckId: string
): Promise<number> {
  const db = await getDatabase();
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(ankiCardState)
    .innerJoin(ankiCards, eq(ankiCards.id, ankiCardState.card_id))
    .where(
      drizzleAnd(
        eq(ankiCards.deck_id, deckId),
        eq(ankiCardState.user_id, userId),
        sql`${ankiCardState.next_review_date} <= now()`,
        sql`${ankiCardState.state} != 'new'`
      )
    );
  
  return Number(result[0]?.count ?? 0);
}

/**
 * Get total count of due cards across all decks for a user
 */
export async function getTotalAnkiDueCount(userId: string): Promise<number> {
  const db = await getDatabase();
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(ankiCardState)
    .innerJoin(ankiCards, eq(ankiCards.id, ankiCardState.card_id))
    .innerJoin(ankiDecks, eq(ankiDecks.id, ankiCards.deck_id))
    .where(
      drizzleAnd(
        eq(ankiDecks.user_id, userId),
        eq(ankiCardState.user_id, userId),
        sql`${ankiCardState.next_review_date} <= now()`,
        sql`${ankiCardState.state} != 'new'`
      )
    );
  
  return Number(result[0]?.count ?? 0);
}

