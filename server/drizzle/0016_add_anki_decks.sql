-- Add Anki deck import system
-- Allows users to import .apkg files and study them separately from vocabulary flashcards

-- Anki Decks table: Store deck metadata
CREATE TABLE IF NOT EXISTS app.anki_decks (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  original_deck_id bigint, -- Original Anki deck ID from the .apkg file
  card_count integer NOT NULL DEFAULT 0,
  new_count integer NOT NULL DEFAULT 0,
  learning_count integer NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  imported_at timestamp NOT NULL DEFAULT now(),
  last_studied_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Anki Notes table: Store note data (a note can generate multiple cards)
CREATE TABLE IF NOT EXISTS app.anki_notes (
  id text PRIMARY KEY,
  deck_id text NOT NULL REFERENCES app.anki_decks(id) ON DELETE CASCADE,
  original_note_id bigint NOT NULL, -- Original Anki note ID
  model_name text NOT NULL, -- Note type name (e.g., "Basic", "Cloze")
  fields jsonb NOT NULL, -- Array of field values ["Front", "Back", ...]
  tags text[], -- Array of tags
  sort_field text, -- Field used for sorting (usually first field)
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Anki Cards table: Store individual cards (generated from notes)
CREATE TABLE IF NOT EXISTS app.anki_cards (
  id text PRIMARY KEY,
  deck_id text NOT NULL REFERENCES app.anki_decks(id) ON DELETE CASCADE,
  note_id text NOT NULL REFERENCES app.anki_notes(id) ON DELETE CASCADE,
  original_card_id bigint NOT NULL, -- Original Anki card ID
  card_type text NOT NULL, -- 'basic', 'basic_reverse', 'cloze'
  template_name text, -- Card template name
  front_content text NOT NULL, -- Rendered front of card (HTML)
  back_content text NOT NULL, -- Rendered back of card (HTML)
  front_audio text[], -- Array of audio file references
  back_audio text[], -- Array of audio file references
  ordinal integer NOT NULL DEFAULT 0, -- Card order within note
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Anki Card State table: Track user's SRS state per card
CREATE TABLE IF NOT EXISTS app.anki_card_state (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  card_id text NOT NULL REFERENCES app.anki_cards(id) ON DELETE CASCADE,
  -- SRS fields (compatible with existing spaced-repetition system)
  ease_factor real NOT NULL DEFAULT 2.5,
  interval_days real NOT NULL DEFAULT 0,
  repetitions integer NOT NULL DEFAULT 0,
  learning_step integer NOT NULL DEFAULT 0, -- 0=new, 1+=learning, -1=graduated
  next_review_date timestamp,
  last_reviewed timestamp,
  -- Anki-specific tracking
  lapses integer NOT NULL DEFAULT 0, -- Number of times card was forgotten
  total_reviews integer NOT NULL DEFAULT 0,
  -- State
  state text NOT NULL DEFAULT 'new', -- 'new', 'learning', 'review', 'relearning'
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(user_id, card_id)
);

-- Anki Media table: Store media files (images, audio)
CREATE TABLE IF NOT EXISTS app.anki_media (
  id text PRIMARY KEY,
  deck_id text NOT NULL REFERENCES app.anki_decks(id) ON DELETE CASCADE,
  filename text NOT NULL, -- Original filename from Anki
  media_type text NOT NULL, -- 'image', 'audio', 'other'
  mime_type text,
  file_data bytea NOT NULL, -- Binary data (can migrate to S3 later)
  file_size integer NOT NULL, -- Size in bytes
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(deck_id, filename)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_anki_decks_user_id ON app.anki_decks(user_id);
CREATE INDEX IF NOT EXISTS idx_anki_notes_deck_id ON app.anki_notes(deck_id);
CREATE INDEX IF NOT EXISTS idx_anki_cards_deck_id ON app.anki_cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_anki_cards_note_id ON app.anki_cards(note_id);
CREATE INDEX IF NOT EXISTS idx_anki_card_state_user_card ON app.anki_card_state(user_id, card_id);
CREATE INDEX IF NOT EXISTS idx_anki_card_state_next_review ON app.anki_card_state(user_id, next_review_date) WHERE state != 'new';
CREATE INDEX IF NOT EXISTS idx_anki_media_deck_filename ON app.anki_media(deck_id, filename);

