-- Migration: Add learning_step field for Anki-style learning phase
-- This enables cards to repeat within a session until they graduate

ALTER TABLE app.vocabulary 
ADD COLUMN learning_step INTEGER DEFAULT 0;

-- learning_step values:
-- 0: New card (not started learning)
-- 1, 2, etc.: Current position in learning steps
-- -1: Graduated (in review phase, uses standard SRS intervals)

COMMENT ON COLUMN app.vocabulary.learning_step IS 'Anki-style learning phase tracker: 0=new, 1+=learning step position, -1=graduated';

