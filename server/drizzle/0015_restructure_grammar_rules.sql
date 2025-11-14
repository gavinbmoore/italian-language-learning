-- Restructure grammar rules from TEXT to JSONB for structured content
-- This allows for headings, lists, notes, and tables in grammar rules

-- First, backup any existing text rules to a temporary column
ALTER TABLE app.grammar_concepts
ADD COLUMN IF NOT EXISTS rules_backup TEXT;

UPDATE app.grammar_concepts
SET rules_backup = rules
WHERE rules IS NOT NULL AND rules_backup IS NULL;

-- Change the rules column type from TEXT to JSONB
ALTER TABLE app.grammar_concepts
ALTER COLUMN rules TYPE JSONB USING 
  CASE 
    WHEN rules IS NULL THEN NULL
    -- Convert existing text to a simple paragraph structure
    WHEN rules IS NOT NULL THEN jsonb_build_array(
      jsonb_build_object(
        'type', 'paragraph',
        'content', rules
      )
    )
  END;

-- The rules_backup column will remain for reference and can be dropped after verification

