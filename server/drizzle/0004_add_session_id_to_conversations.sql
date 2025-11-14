-- Add session_id column to conversations table to link conversations with learning sessions

ALTER TABLE app.conversations 
ADD COLUMN IF NOT EXISTS session_id text;

-- Add foreign key constraint
ALTER TABLE app.conversations 
ADD CONSTRAINT conversations_session_id_fkey 
FOREIGN KEY (session_id) REFERENCES app.learning_sessions(id) ON DELETE CASCADE;

-- Create index for efficient session-based queries
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON app.conversations(session_id);

