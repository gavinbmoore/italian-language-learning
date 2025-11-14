-- Add Grammar Practice Sessions table to track long-form adaptive practice
CREATE TABLE IF NOT EXISTS app.grammar_practice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL REFERENCES app.grammar_concepts(id) ON DELETE CASCADE,
  
  -- Session metadata
  started_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true NOT NULL,
  
  -- Performance tracking
  total_exercises_attempted INTEGER DEFAULT 0 NOT NULL,
  total_correct INTEGER DEFAULT 0 NOT NULL,
  total_incorrect INTEGER DEFAULT 0 NOT NULL,
  current_difficulty TEXT DEFAULT 'easy' NOT NULL, -- 'easy', 'medium', 'hard'
  
  -- Difficulty adjustment tracking
  difficulty_adjustments JSONB DEFAULT '[]'::jsonb, -- Array of {timestamp, from, to, reason}
  
  -- Session summary (for future reference)
  session_summary TEXT, -- AI-generated summary of what was learned
  areas_of_strength TEXT[], -- Topics the user did well on
  areas_for_improvement TEXT[], -- Topics that need more work
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add session_id to grammar_exercises to link exercises to practice sessions
ALTER TABLE app.grammar_exercises 
ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES app.grammar_practice_sessions(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_grammar_practice_sessions_user ON app.grammar_practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_grammar_practice_sessions_concept ON app.grammar_practice_sessions(concept_id);
CREATE INDEX IF NOT EXISTS idx_grammar_practice_sessions_active ON app.grammar_practice_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_grammar_exercises_session ON app.grammar_exercises(session_id);

