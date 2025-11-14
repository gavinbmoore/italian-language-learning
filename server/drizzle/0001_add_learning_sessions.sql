-- Create learning_sessions table to track active learning time
CREATE TABLE IF NOT EXISTS "app"."learning_sessions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "start_time" timestamp NOT NULL,
  "end_time" timestamp,
  "duration_seconds" integer NOT NULL DEFAULT 0,
  "page_context" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "learning_sessions_user_id_idx" ON "app"."learning_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "learning_sessions_is_active_idx" ON "app"."learning_sessions" ("is_active");
CREATE INDEX IF NOT EXISTS "learning_sessions_start_time_idx" ON "app"."learning_sessions" ("start_time");

