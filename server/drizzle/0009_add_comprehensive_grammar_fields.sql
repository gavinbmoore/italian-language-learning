-- Migration: Add comprehensive grammar lesson fields
-- Add 'rules' and 'practice_focus' fields to grammar_concepts table

ALTER TABLE app.grammar_concepts 
ADD COLUMN IF NOT EXISTS rules TEXT,
ADD COLUMN IF NOT EXISTS practice_focus TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN app.grammar_concepts.rules IS 'Comprehensive 2-4 paragraph explanation of grammar rules';
COMMENT ON COLUMN app.grammar_concepts.practice_focus IS 'Array of 3-5 key practice focus areas for this concept';

