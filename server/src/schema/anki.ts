import { text, integer, timestamp, real, jsonb } from 'drizzle-orm/pg-core';
import { users, appSchema } from './users';

// Anki Decks - Store deck metadata
export const ankiDecks = appSchema.table('anki_decks', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  original_deck_id: integer('original_deck_id'), // bigint stored as number (JS limitation)
  card_count: integer('card_count').notNull().default(0),
  new_count: integer('new_count').notNull().default(0),
  learning_count: integer('learning_count').notNull().default(0),
  review_count: integer('review_count').notNull().default(0),
  imported_at: timestamp('imported_at').notNull().defaultNow(),
  last_studied_at: timestamp('last_studied_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

// Anki Notes - Store note data
export const ankiNotes = appSchema.table('anki_notes', {
  id: text('id').primaryKey(),
  deck_id: text('deck_id').notNull().references(() => ankiDecks.id, { onDelete: 'cascade' }),
  original_note_id: integer('original_note_id').notNull(), // bigint stored as number
  model_name: text('model_name').notNull(),
  fields: jsonb('fields').notNull(), // Array of field values
  tags: text('tags').array(), // Array of tags
  sort_field: text('sort_field'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

// Anki Cards - Store individual cards
export const ankiCards = appSchema.table('anki_cards', {
  id: text('id').primaryKey(),
  deck_id: text('deck_id').notNull().references(() => ankiDecks.id, { onDelete: 'cascade' }),
  note_id: text('note_id').notNull().references(() => ankiNotes.id, { onDelete: 'cascade' }),
  original_card_id: integer('original_card_id').notNull(), // bigint stored as number
  card_type: text('card_type').notNull(), // 'basic', 'basic_reverse', 'cloze'
  template_name: text('template_name'),
  front_content: text('front_content').notNull(),
  back_content: text('back_content').notNull(),
  front_audio: text('front_audio').array(),
  back_audio: text('back_audio').array(),
  ordinal: integer('ordinal').notNull().default(0),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

// Anki Card State - Track user's SRS state per card
export const ankiCardState = appSchema.table('anki_card_state', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  card_id: text('card_id').notNull().references(() => ankiCards.id, { onDelete: 'cascade' }),
  ease_factor: real('ease_factor').notNull().default(2.5),
  interval_days: real('interval_days').notNull().default(0),
  repetitions: integer('repetitions').notNull().default(0),
  learning_step: integer('learning_step').notNull().default(0),
  next_review_date: timestamp('next_review_date'),
  last_reviewed: timestamp('last_reviewed'),
  lapses: integer('lapses').notNull().default(0),
  total_reviews: integer('total_reviews').notNull().default(0),
  state: text('state').notNull().default('new'), // 'new', 'learning', 'review', 'relearning'
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

// Anki Media - Store media files
export const ankiMedia = appSchema.table('anki_media', {
  id: text('id').primaryKey(),
  deck_id: text('deck_id').notNull().references(() => ankiDecks.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  media_type: text('media_type').notNull(), // 'image', 'audio', 'other'
  mime_type: text('mime_type'),
  file_data: text('file_data').notNull(), // bytea in DB, will be handled as Buffer
  file_size: integer('file_size').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

// Type exports
export type AnkiDeck = typeof ankiDecks.$inferSelect;
export type NewAnkiDeck = typeof ankiDecks.$inferInsert;
export type AnkiNote = typeof ankiNotes.$inferSelect;
export type NewAnkiNote = typeof ankiNotes.$inferInsert;
export type AnkiCard = typeof ankiCards.$inferSelect;
export type NewAnkiCard = typeof ankiCards.$inferInsert;
export type AnkiCardState = typeof ankiCardState.$inferSelect;
export type NewAnkiCardState = typeof ankiCardState.$inferInsert;
export type AnkiMedia = typeof ankiMedia.$inferSelect;
export type NewAnkiMedia = typeof ankiMedia.$inferInsert;

