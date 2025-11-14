-- Add spaced repetition system (SRS) fields to vocabulary table for Anki-style flashcards

ALTER TABLE app.vocabulary 
ADD COLUMN IF NOT EXISTS next_review_date timestamp,
ADD COLUMN IF NOT EXISTS ease_factor real DEFAULT 2.5,
ADD COLUMN IF NOT EXISTS interval_days real DEFAULT 0,
ADD COLUMN IF NOT EXISTS repetitions integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reviewed timestamp,
ADD COLUMN IF NOT EXISTS is_flashcard boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS example_sentence text,
ADD COLUMN IF NOT EXISTS translation text;

-- Create index on next_review_date for efficient queries of due cards
CREATE INDEX IF NOT EXISTS idx_vocabulary_next_review_date ON app.vocabulary(next_review_date) WHERE is_flashcard = true;

-- Create index on user_id and is_flashcard for efficient flashcard queries
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_flashcard ON app.vocabulary(user_id, is_flashcard) WHERE is_flashcard = true;

