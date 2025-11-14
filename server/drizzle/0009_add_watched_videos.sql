-- Add watched grammar videos tracking table
-- This table stores information about videos users have watched in the grammar section

CREATE TABLE IF NOT EXISTS "app"."watched_grammar_videos" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "video_id" TEXT NOT NULL,
  "concept_id" TEXT NOT NULL REFERENCES "app"."grammar_concepts"("id") ON DELETE CASCADE,
  "watched_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "watch_status" TEXT NOT NULL DEFAULT 'watched', -- 'watched' | 'in_progress'
  
  -- Cached transcript and analysis data
  "transcript" TEXT,
  "transcript_language" TEXT,
  
  -- AI-generated analysis (stored as JSONB)
  "analysis" JSONB, -- { coreLessons, examples, keyTakeaways, practiceRecommendations }
  
  -- Metadata
  "video_title" TEXT,
  "video_duration" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "idx_watched_videos_user" ON "app"."watched_grammar_videos"("user_id");
CREATE INDEX IF NOT EXISTS "idx_watched_videos_concept" ON "app"."watched_grammar_videos"("concept_id");
CREATE INDEX IF NOT EXISTS "idx_watched_videos_user_concept" ON "app"."watched_grammar_videos"("user_id", "concept_id");
CREATE INDEX IF NOT EXISTS "idx_watched_videos_video_id" ON "app"."watched_grammar_videos"("video_id");

-- Ensure unique constraint: one watch record per user-video combination
CREATE UNIQUE INDEX IF NOT EXISTS "idx_watched_videos_unique" ON "app"."watched_grammar_videos"("user_id", "video_id");

