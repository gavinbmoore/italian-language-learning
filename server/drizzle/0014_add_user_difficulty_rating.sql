-- Add user difficulty rating to grammar practice sessions
ALTER TABLE app.grammar_practice_sessions
ADD COLUMN IF NOT EXISTS user_difficulty_rating TEXT CHECK (user_difficulty_rating IN ('easy', 'medium', 'difficult'));

-- Add column to store previous session summaries for context
ALTER TABLE app.grammar_practice_sessions
ADD COLUMN IF NOT EXISTS previous_session_context TEXT;

