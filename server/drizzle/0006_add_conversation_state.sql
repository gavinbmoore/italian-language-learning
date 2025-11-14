-- Add conversation_state field to conversations table to track conversation flow
-- This helps determine when to skip greetings and jump into content

ALTER TABLE "app"."conversations" 
ADD COLUMN IF NOT EXISTS "conversation_state" text DEFAULT 'in_topic';

-- Create an index for efficient state queries
CREATE INDEX IF NOT EXISTS "conversations_state_idx" ON "app"."conversations" ("conversation_state");

-- Add comment explaining the field
COMMENT ON COLUMN "app"."conversations"."conversation_state" IS 'Tracks conversation flow: initial_greeting (first 1-2 messages), in_topic (discussing content), transitioning (changing topics)';

