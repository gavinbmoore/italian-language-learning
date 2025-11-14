-- Migration: Add score column to reading_attempts
-- Created: 2024-11-13
-- Description: Adds score field to store partial credit (0.0-1.0) for reading comprehension answers

-- Add score column to reading_attempts table
ALTER TABLE app.reading_attempts 
ADD COLUMN IF NOT EXISTS score REAL;

-- Update existing records to have score based on is_correct
-- (For backward compatibility with any existing data)
UPDATE app.reading_attempts 
SET score = CASE WHEN is_correct = true THEN 1.0 ELSE 0.0 END 
WHERE score IS NULL;

