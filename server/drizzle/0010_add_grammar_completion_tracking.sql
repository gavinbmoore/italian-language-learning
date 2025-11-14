-- Add completion tracking fields to user_grammar_progress table
-- This allows tracking when users have watched videos and completed the concept

ALTER TABLE app.user_grammar_progress 
ADD COLUMN IF NOT EXISTS has_watched_video BOOLEAN DEFAULT FALSE;

ALTER TABLE app.user_grammar_progress 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Create index for efficient completion queries
CREATE INDEX IF NOT EXISTS idx_user_grammar_progress_completed 
ON app.user_grammar_progress(user_id, completed_at) 
WHERE completed_at IS NOT NULL;

-- Create index for video watching queries
CREATE INDEX IF NOT EXISTS idx_user_grammar_progress_video_watched 
ON app.user_grammar_progress(user_id, has_watched_video) 
WHERE has_watched_video = TRUE;

