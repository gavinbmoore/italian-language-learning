-- Migration: Add conversation_memory table for long-term context storage
-- Created: 2025-11-11

CREATE TABLE IF NOT EXISTS "app"."conversation_memory" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "memory_type" text NOT NULL,
  "content" text NOT NULL,
  "context" text,
  "importance" integer DEFAULT 5 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp DEFAULT now() NOT NULL,
  "metadata" jsonb
);

-- Add foreign key constraint
ALTER TABLE "app"."conversation_memory" 
  ADD CONSTRAINT "conversation_memory_user_id_users_id_fk" 
  FOREIGN KEY ("user_id") 
  REFERENCES "app"."users"("id") 
  ON DELETE CASCADE;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "conversation_memory_user_id_idx" ON "app"."conversation_memory" ("user_id");
CREATE INDEX IF NOT EXISTS "conversation_memory_type_idx" ON "app"."conversation_memory" ("memory_type");
CREATE INDEX IF NOT EXISTS "conversation_memory_importance_idx" ON "app"."conversation_memory" ("importance" DESC);
CREATE INDEX IF NOT EXISTS "conversation_memory_last_used_idx" ON "app"."conversation_memory" ("last_used_at" DESC);

-- Create composite index for common queries (user + importance + last_used)
CREATE INDEX IF NOT EXISTS "conversation_memory_user_priority_idx" 
  ON "app"."conversation_memory" ("user_id", "importance" DESC, "last_used_at" DESC);

