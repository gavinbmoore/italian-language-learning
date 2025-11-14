-- Migration: Add Reading Comprehension System
-- Created: 2024-11-13
-- Description: Adds tables for daily reading comprehension tasks with AI-generated texts

-- Reading texts table - stores generated passages
CREATE TABLE IF NOT EXISTS app.reading_texts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- The Italian text to read
  source_topic TEXT, -- The news topic/source it's based on
  difficulty_level TEXT NOT NULL, -- CEFR level: A1, A2, B1, B2, C1, C2
  generated_date DATE NOT NULL, -- Date text was generated (for daily reset)
  vocabulary_used JSONB, -- Array of vocabulary words used from user's recent learning
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Reading questions table - stores comprehension questions for each text
CREATE TABLE IF NOT EXISTS app.reading_questions (
  id TEXT PRIMARY KEY,
  reading_text_id TEXT NOT NULL REFERENCES app.reading_texts(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL, -- 'multiple_choice' or 'free_text'
  question_text TEXT NOT NULL, -- The question in Italian or English
  correct_answer TEXT NOT NULL, -- Correct answer
  options JSONB, -- For multiple choice: array of answer options
  order_index INTEGER NOT NULL, -- Order to display questions
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Reading attempts table - tracks user answers and progress
CREATE TABLE IF NOT EXISTS app.reading_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  reading_text_id TEXT NOT NULL REFERENCES app.reading_texts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES app.reading_questions(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN,
  score REAL, -- Partial credit score (0.0 to 1.0) for nuanced evaluation
  ai_feedback TEXT, -- For free-text answers: AI evaluation feedback
  session_id TEXT REFERENCES app.learning_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reading_texts_user_date ON app.reading_texts(user_id, generated_date);
CREATE INDEX IF NOT EXISTS idx_reading_texts_user_completed ON app.reading_texts(user_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_reading_questions_text ON app.reading_questions(reading_text_id);
CREATE INDEX IF NOT EXISTS idx_reading_attempts_user ON app.reading_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_attempts_text ON app.reading_attempts(reading_text_id);
CREATE INDEX IF NOT EXISTS idx_reading_attempts_session ON app.reading_attempts(session_id);

