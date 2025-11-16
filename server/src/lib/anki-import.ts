/**
 * Anki deck import logic
 * Handles storing parsed Anki decks into the database
 */

import { getDatabase } from './db';
import { ankiDecks, ankiNotes, ankiCards, ankiCardState, ankiMedia } from '../schema/anki';
import type { ParsedAnkiDeck, ParsedAnkiNote, ParsedAnkiCard, ParsedMedia } from './anki-parser';
import { parseApkgFile } from './anki-parser';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export interface ImportResult {
  deckId: string;
  name: string;
  cardCount: number;
  noteCount: number;
  mediaCount: number;
}

/**
 * Import an Anki deck from .apkg file buffer
 */
export async function importDeck(
  userId: string,
  apkgBuffer: Buffer,
  customDeckName?: string
): Promise<ImportResult> {
  console.log('🚀 Starting Anki deck import...');
  
  // Parse the .apkg file
  const parsedDeck = parseApkgFile(apkgBuffer);
  
  // Store in database
  const deckId = `anki-deck-${userId}-${crypto.randomBytes(8).toString('hex')}`;
  const name = customDeckName || parsedDeck.name;
  
  console.log(`💾 Storing deck: ${name}`);
  
  // Store deck metadata
  await storeDeck(userId, deckId, parsedDeck, name);
  
  // Store notes and cards
  let totalCards = 0;
  for (const note of parsedDeck.notes) {
    await storeNote(deckId, note);
    totalCards += note.cards.length;
  }
  
  // Store media files
  await storeMediaFiles(deckId, parsedDeck.media);
  
  // Initialize card states for the user
  await initializeCardStates(userId, deckId, parsedDeck);
  
  // Update deck card counts
  await updateDeckCounts(userId, deckId);
  
  console.log(`✅ Import complete: ${totalCards} cards, ${parsedDeck.notes.length} notes, ${parsedDeck.media.length} media files`);
  
  return {
    deckId,
    name,
    cardCount: totalCards,
    noteCount: parsedDeck.notes.length,
    mediaCount: parsedDeck.media.length,
  };
}

/**
 * Store deck metadata
 */
async function storeDeck(
  userId: string,
  deckId: string,
  parsedDeck: ParsedAnkiDeck,
  name: string
): Promise<void> {
  const db = await getDatabase();
  
  await db.insert(ankiDecks).values({
    id: deckId,
    user_id: userId,
    name,
    description: parsedDeck.description,
    original_deck_id: parsedDeck.originalDeckId,
    card_count: 0, // Will be updated later
    new_count: 0,
    learning_count: 0,
    review_count: 0,
  });
  
  console.log(`✓ Stored deck: ${deckId}`);
}

/**
 * Store a note and its cards
 */
async function storeNote(deckId: string, note: ParsedAnkiNote): Promise<void> {
  const db = await getDatabase();
  
  const noteId = `anki-note-${deckId}-${note.originalNoteId}`;
  
  // Store note
  await db.insert(ankiNotes).values({
    id: noteId,
    deck_id: deckId,
    original_note_id: note.originalNoteId,
    model_name: note.modelName,
    fields: note.fields,
    tags: note.tags,
    sort_field: note.sortField,
  });
  
  // Store cards for this note
  for (const card of note.cards) {
    const cardId = `anki-card-${deckId}-${card.originalCardId}`;
    
    await db.insert(ankiCards).values({
      id: cardId,
      deck_id: deckId,
      note_id: noteId,
      original_card_id: card.originalCardId,
      card_type: card.cardType,
      template_name: card.templateName,
      front_content: card.frontContent,
      back_content: card.backContent,
      front_audio: card.frontAudio,
      back_audio: card.backAudio,
      ordinal: card.ordinal,
    });
  }
}

/**
 * Store media files
 */
async function storeMediaFiles(deckId: string, mediaFiles: ParsedMedia[]): Promise<void> {
  if (mediaFiles.length === 0) return;
  
  const db = await getDatabase();
  
  console.log(`📁 Storing ${mediaFiles.length} media files...`);
  
  for (const media of mediaFiles) {
    const mediaId = `anki-media-${deckId}-${crypto.randomBytes(8).toString('hex')}`;
    
    await db.insert(ankiMedia).values({
      id: mediaId,
      deck_id: deckId,
      filename: media.filename,
      media_type: media.mediaType,
      mime_type: media.mimeType,
      file_data: media.data.toString('base64'), // Store as base64 string for PostgreSQL
      file_size: media.data.length,
    });
  }
  
  console.log(`✓ Stored ${mediaFiles.length} media files`);
}

/**
 * Initialize card states for user
 */
async function initializeCardStates(
  userId: string,
  deckId: string,
  parsedDeck: ParsedAnkiDeck
): Promise<void> {
  const db = await getDatabase();
  
  console.log('🎴 Initializing card states...');
  
  for (const note of parsedDeck.notes) {
    for (const card of note.cards) {
      const cardId = `anki-card-${deckId}-${card.originalCardId}`;
      const stateId = `anki-state-${userId}-${cardId}`;
      
      // Convert Anki scheduling to our system
      const { ease_factor, interval_days, learning_step, next_review_date } = 
        convertAnkiSchedule(card);
      
      await db.insert(ankiCardState).values({
        id: stateId,
        user_id: userId,
        card_id: cardId,
        ease_factor,
        interval_days,
        repetitions: card.repetitions,
        learning_step,
        next_review_date,
        last_reviewed: null,
        lapses: card.lapses,
        total_reviews: card.repetitions,
        state: card.state,
      });
    }
  }
  
  console.log('✓ Card states initialized');
}

/**
 * Convert Anki scheduling data to our format
 */
function convertAnkiSchedule(card: ParsedAnkiCard): {
  ease_factor: number;
  interval_days: number;
  learning_step: number;
  next_review_date: Date | null;
} {
  let ease_factor = card.easeFactor;
  let interval_days = card.interval;
  let learning_step = 0;
  let next_review_date: Date | null = null;
  
  if (card.state === 'new') {
    // New card: Start fresh in learning phase
    ease_factor = 2.5;
    interval_days = 0;
    learning_step = 0;
    next_review_date = null; // Will be set when user starts studying
  } else if (card.state === 'learning') {
    // Learning card: Keep in learning phase
    learning_step = interval_days < 1 ? 0 : 1;
    next_review_date = new Date(Date.now() + interval_days * 24 * 60 * 60 * 1000);
  } else if (card.state === 'review') {
    // Review card: Graduated
    learning_step = -1; // Graduated marker
    next_review_date = new Date(Date.now() + interval_days * 24 * 60 * 60 * 1000);
  }
  
  return { ease_factor, interval_days, learning_step, next_review_date };
}

/**
 * Update deck card counts
 */
async function updateDeckCounts(userId: string, deckId: string): Promise<void> {
  const db = await getDatabase();
  
  // Get all cards in this deck
  const cards = await db
    .select({
      state: ankiCardState.state,
    })
    .from(ankiCardState)
    .innerJoin(ankiCards, eq(ankiCards.id, ankiCardState.card_id))
    .where(
      and(
        eq(ankiCardState.user_id, userId),
        eq(ankiCards.deck_id, deckId)
      )
    );
  
  const cardCount = cards.length;
  const newCount = cards.filter(c => c.state === 'new').length;
  const learningCount = cards.filter(c => c.state === 'learning').length;
  const reviewCount = cards.filter(c => c.state === 'review').length;
  
  await db
    .update(ankiDecks)
    .set({
      card_count: cardCount,
      new_count: newCount,
      learning_count: learningCount,
      review_count: reviewCount,
      updated_at: new Date(),
    })
    .where(eq(ankiDecks.id, deckId));
  
  console.log(`✓ Updated counts: ${cardCount} total (${newCount} new, ${learningCount} learning, ${reviewCount} review)`);
}

/**
 * Delete a deck and all associated data
 */
export async function deleteDeck(userId: string, deckId: string): Promise<void> {
  const db = await getDatabase();
  
  // Verify deck belongs to user
  const decks = await db
    .select()
    .from(ankiDecks)
    .where(
      and(
        eq(ankiDecks.id, deckId),
        eq(ankiDecks.user_id, userId)
      )
    )
    .limit(1);
  
  if (decks.length === 0) {
    throw new Error('Deck not found or does not belong to user');
  }
  
  // Delete deck (cascade will delete notes, cards, states, media)
  await db.delete(ankiDecks).where(eq(ankiDecks.id, deckId));
  
  console.log(`🗑️  Deleted deck: ${deckId}`);
}

/**
 * Get all decks for a user with statistics
 */
export async function getUserDecks(userId: string): Promise<any[]> {
  const db = await getDatabase();
  
  const decks = await db
    .select()
    .from(ankiDecks)
    .where(eq(ankiDecks.user_id, userId))
    .orderBy(ankiDecks.imported_at);
  
  return decks;
}

/**
 * Get a single deck with details
 */
export async function getDeck(userId: string, deckId: string): Promise<any> {
  const db = await getDatabase();
  
  const decks = await db
    .select()
    .from(ankiDecks)
    .where(
      and(
        eq(ankiDecks.id, deckId),
        eq(ankiDecks.user_id, userId)
      )
    )
    .limit(1);
  
  if (decks.length === 0) {
    throw new Error('Deck not found');
  }
  
  return decks[0];
}

