-- Grammar Concepts: Core grammar topics organized by CEFR level
CREATE TABLE IF NOT EXISTS app.grammar_concepts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, -- e.g., "Passato Prossimo", "Subjunctive Mood"
  name_italian TEXT NOT NULL, -- Italian name of concept
  category TEXT NOT NULL, -- 'verbs', 'articles', 'prepositions', 'pronouns', 'adjectives', 'nouns', 'syntax', 'other'
  cefr_level TEXT NOT NULL, -- 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
  description TEXT NOT NULL, -- English explanation of the concept
  explanation_italian TEXT, -- Italian explanation (for advanced learners)
  examples JSONB, -- Array of example objects: [{italian: "...", english: "...", highlight: "..."}]
  common_mistakes JSONB, -- Array of common mistakes: [{wrong: "...", correct: "...", explanation: "..."}]
  related_concepts TEXT[], -- Array of related concept IDs
  importance INTEGER NOT NULL DEFAULT 5, -- 1-10, used for prioritization
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- User Grammar Progress: Track user's mastery of each grammar concept (SRS-based)
CREATE TABLE IF NOT EXISTS app.user_grammar_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL REFERENCES app.grammar_concepts(id) ON DELETE CASCADE,
  
  -- Spaced Repetition System fields (similar to vocabulary)
  ease_factor REAL DEFAULT 2.5,
  interval_days REAL DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review_date TIMESTAMP,
  last_reviewed TIMESTAMP,
  learning_step INTEGER DEFAULT 0, -- Anki-style: 0=new, 1+=learning, -1=graduated
  
  -- Mastery tracking
  mastery_level TEXT DEFAULT 'new', -- 'new', 'learning', 'practicing', 'mastered'
  total_exercises_completed INTEGER DEFAULT 0,
  correct_exercises INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0, -- Number of times user made errors with this concept
  last_error_date TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id, concept_id)
);

-- Grammar Errors: Log detected grammar errors from conversations
CREATE TABLE IF NOT EXISTS app.grammar_errors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  concept_id TEXT REFERENCES app.grammar_concepts(id) ON DELETE SET NULL,
  conversation_id TEXT REFERENCES app.conversations(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES app.learning_sessions(id) ON DELETE CASCADE,
  
  -- Error details
  original_text TEXT NOT NULL, -- User's original text with error
  corrected_text TEXT NOT NULL, -- Corrected version
  error_type TEXT NOT NULL, -- Specific error type within the concept
  explanation TEXT NOT NULL, -- Why it's wrong and how to fix it
  severity TEXT DEFAULT 'medium', -- 'minor', 'medium', 'major'
  
  -- Context
  full_sentence TEXT, -- Full sentence where error occurred
  position_start INTEGER, -- Character position of error start
  position_end INTEGER, -- Character position of error end
  
  -- User interaction
  was_corrected_in_conversation BOOLEAN DEFAULT FALSE,
  user_acknowledged BOOLEAN DEFAULT FALSE, -- Did user see/acknowledge this error?
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Grammar Exercises: Store generated and completed exercises
CREATE TABLE IF NOT EXISTS app.grammar_exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL REFERENCES app.grammar_concepts(id) ON DELETE CASCADE,
  
  -- Exercise content
  exercise_type TEXT NOT NULL, -- 'fill_blank', 'multiple_choice', 'translation', 'conjugation', 'correction'
  question TEXT NOT NULL, -- The exercise question/prompt
  correct_answer TEXT NOT NULL, -- The correct answer
  options JSONB, -- For multiple choice: array of options
  explanation TEXT, -- Explanation of the answer
  difficulty TEXT DEFAULT 'medium', -- 'easy', 'medium', 'hard'
  
  -- User's attempt
  user_answer TEXT, -- User's submitted answer
  is_correct BOOLEAN, -- Was the answer correct?
  attempted_at TIMESTAMP,
  time_spent_seconds INTEGER, -- How long user took to answer
  
  -- Context
  hints JSONB, -- Array of progressive hints
  related_vocabulary TEXT[], -- Words from user's vocabulary used in exercise
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_grammar_concepts_level ON app.grammar_concepts(cefr_level);
CREATE INDEX IF NOT EXISTS idx_grammar_concepts_category ON app.grammar_concepts(category);
CREATE INDEX IF NOT EXISTS idx_user_grammar_progress_user ON app.user_grammar_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_grammar_progress_review ON app.user_grammar_progress(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_grammar_errors_user ON app.grammar_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_grammar_errors_concept ON app.grammar_errors(concept_id);
CREATE INDEX IF NOT EXISTS idx_grammar_errors_session ON app.grammar_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_grammar_exercises_user ON app.grammar_exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_grammar_exercises_concept ON app.grammar_exercises(concept_id);
CREATE INDEX IF NOT EXISTS idx_grammar_exercises_completed ON app.grammar_exercises(user_id, completed_at);

