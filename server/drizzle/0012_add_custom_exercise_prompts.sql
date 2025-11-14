-- Add custom exercise generation prompt field to grammar concepts
-- This allows each grammar concept to have a tailored AI prompt for exercise generation

ALTER TABLE app.grammar_concepts 
ADD COLUMN IF NOT EXISTS exercise_generation_prompt TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN app.grammar_concepts.exercise_generation_prompt IS 'Custom AI prompt for generating exercises specific to this grammar concept. If null, uses generic prompt.';

