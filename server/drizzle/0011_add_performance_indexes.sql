-- Migration: Add Performance Indexes
-- Created: 2025-11-13
-- Purpose: Add critical database indexes for performance optimization

-- =====================================================
-- VOCABULARY INDEXES (most critical - heavily queried)
-- =====================================================

-- Index for fetching user's known vocabulary
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_known 
ON app.vocabulary(user_id, is_known);

-- Index for SRS flashcard review queries
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_review 
ON app.vocabulary(user_id, next_review_date) 
WHERE is_flashcard = true AND next_review_date IS NOT NULL;

-- Index for word lookups (vocabulary checking)
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_word 
ON app.vocabulary(user_id, word);

-- Index for flashcard queries
CREATE INDEX IF NOT EXISTS idx_vocabulary_flashcard 
ON app.vocabulary(user_id, is_flashcard, learning_step);

-- =====================================================
-- CONVERSATION & SESSION INDEXES
-- =====================================================

-- Index for fetching user's conversation history
CREATE INDEX IF NOT EXISTS idx_conversations_user_created 
ON app.conversations(user_id, created_at DESC);

-- Index for session-based conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_session 
ON app.conversations(session_id);

-- Index for active learning sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_active 
ON app.learning_sessions(user_id, is_active);

-- Index for session history queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_time 
ON app.learning_sessions(user_id, start_time DESC);

-- =====================================================
-- MEMORY SYSTEM INDEXES
-- =====================================================

-- Index for fetching memories by type
CREATE INDEX IF NOT EXISTS idx_memory_user_type 
ON app.conversation_memory(user_id, memory_type);

-- Index for fetching recent memories
CREATE INDEX IF NOT EXISTS idx_memory_user_recent 
ON app.conversation_memory(user_id, last_used_at DESC);

-- Index for importance-based memory retrieval
CREATE INDEX IF NOT EXISTS idx_memory_user_importance 
ON app.conversation_memory(user_id, importance DESC);

-- =====================================================
-- GRAMMAR SYSTEM INDEXES
-- =====================================================

-- Index for user progress queries
CREATE INDEX IF NOT EXISTS idx_grammar_progress_user_concept 
ON app.user_grammar_progress(user_id, concept_id);

-- Index for SRS grammar review queries
CREATE INDEX IF NOT EXISTS idx_grammar_progress_review 
ON app.user_grammar_progress(user_id, next_review_date) 
WHERE next_review_date IS NOT NULL;

-- Index for mastery level queries
CREATE INDEX IF NOT EXISTS idx_grammar_progress_mastery 
ON app.user_grammar_progress(user_id, mastery_level);

-- Index for grammar errors by user
CREATE INDEX IF NOT EXISTS idx_grammar_errors_user 
ON app.grammar_errors(user_id, created_at DESC);

-- Index for grammar errors by concept
CREATE INDEX IF NOT EXISTS idx_grammar_errors_concept 
ON app.grammar_errors(concept_id, created_at DESC);

-- Index for exercise queries
CREATE INDEX IF NOT EXISTS idx_grammar_exercises_user_concept 
ON app.grammar_exercises(user_id, concept_id);

-- Index for exercise completion tracking
CREATE INDEX IF NOT EXISTS idx_grammar_exercises_user_completed 
ON app.grammar_exercises(user_id, is_correct, attempted_at DESC);

-- Index for video watch status
CREATE INDEX IF NOT EXISTS idx_watched_videos_user_concept 
ON app.watched_grammar_videos(user_id, concept_id);

-- Index for video ID lookups
CREATE INDEX IF NOT EXISTS idx_watched_videos_video 
ON app.watched_grammar_videos(video_id);

-- =====================================================
-- READING COMPREHENSION INDEXES
-- =====================================================

-- Index for daily reading text queries
CREATE INDEX IF NOT EXISTS idx_reading_texts_user_date 
ON app.reading_texts(user_id, generated_date DESC);

-- Index for completion tracking
CREATE INDEX IF NOT EXISTS idx_reading_texts_completed 
ON app.reading_texts(user_id, is_completed);

-- Index for reading attempts
CREATE INDEX IF NOT EXISTS idx_reading_attempts_user 
ON app.reading_attempts(user_id, created_at DESC);

-- Index for question-specific attempts
CREATE INDEX IF NOT EXISTS idx_reading_attempts_question 
ON app.reading_attempts(reading_text_id, question_id);

-- Index for reading questions by text
CREATE INDEX IF NOT EXISTS idx_reading_questions_text 
ON app.reading_questions(reading_text_id, order_index);

-- =====================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- =====================================================

-- Compound index for vocabulary SRS algorithm
CREATE INDEX IF NOT EXISTS idx_vocabulary_srs_compound 
ON app.vocabulary(user_id, is_flashcard, next_review_date, learning_step);

-- Compound index for grammar concept filtering
CREATE INDEX IF NOT EXISTS idx_grammar_concepts_level_category 
ON app.grammar_concepts(cefr_level, category, importance DESC);

-- Compound index for session-based vocabulary tracking
CREATE INDEX IF NOT EXISTS idx_vocabulary_session_tracking 
ON app.vocabulary(user_id, last_encountered DESC, is_known);

-- =====================================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- =====================================================

-- Partial index for new vocabulary (not yet known)
CREATE INDEX IF NOT EXISTS idx_vocabulary_unknown 
ON app.vocabulary(user_id, times_encountered DESC) 
WHERE is_known = false;

-- Partial index for due flashcards (removed date comparison as it's not immutable)
CREATE INDEX IF NOT EXISTS idx_vocabulary_due_flashcards 
ON app.vocabulary(user_id, next_review_date ASC) 
WHERE is_flashcard = true;

-- Partial index for incomplete reading texts
CREATE INDEX IF NOT EXISTS idx_reading_incomplete 
ON app.reading_texts(user_id, generated_date DESC) 
WHERE is_completed = false;

-- Partial index for active learning sessions
CREATE INDEX IF NOT EXISTS idx_sessions_active_only 
ON app.learning_sessions(user_id, start_time DESC) 
WHERE is_active = true;

-- =====================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- =====================================================

ANALYZE app.vocabulary;
ANALYZE app.conversations;
ANALYZE app.learning_sessions;
ANALYZE app.conversation_memory;
ANALYZE app.user_grammar_progress;
ANALYZE app.grammar_errors;
ANALYZE app.grammar_exercises;
ANALYZE app.watched_grammar_videos;
ANALYZE app.reading_texts;
ANALYZE app.reading_questions;
ANALYZE app.reading_attempts;

-- Add comment for documentation
COMMENT ON INDEX app.idx_vocabulary_user_review IS 'Critical for SRS flashcard review queries - retrieves cards due for review';
COMMENT ON INDEX app.idx_grammar_progress_review IS 'Critical for grammar SRS review queries - retrieves concepts due for review';
COMMENT ON INDEX app.idx_vocabulary_due_flashcards IS 'Partial index optimized for due flashcard queries';

