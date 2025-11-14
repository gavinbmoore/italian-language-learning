# Adaptive Grammar Practice System

## Overview

The adaptive practice system provides long-form, personalized grammar practice sessions that:
- Generate exercises in batches of 10
- Automatically adjust difficulty based on performance
- Track session progress and save for future reference
- Provide AI-generated summaries after completion

## Key Features

### 1. **Progressive Exercise Generation**
- Exercises are generated in batches of 10 as the user progresses
- No need to decide upfront how many exercises to complete
- User can practice as long as they want

### 2. **Adaptive Difficulty Adjustment**
- After each batch of 10 exercises, the system evaluates performance:
  - **≥80% correct**: Difficulty increases (easy → medium → hard)
  - **<60% correct**: Difficulty decreases (hard → medium → easy)
  - **60-79% correct**: Difficulty stays the same
- Users see a notification when difficulty changes

### 3. **Session Tracking**
- Each practice session is saved with:
  - Total exercises attempted
  - Correct/incorrect counts
  - Difficulty progression
  - Timestamp and duration
- Sessions can be resumed if interrupted

### 4. **AI-Generated Summaries**
- When a session is completed, AI generates:
  - Overall performance summary
  - Areas of strength
  - Areas for improvement
- This context is saved for future sessions

### 5. **Fill-in-the-Blank Fix**
- Fixed the issue where fill-blank exercises expected full sentences
- Now correctly accepts just the word/phrase that fills the blank
- More lenient with capitalization and minor variations

## Database Schema

### New Table: `grammar_practice_sessions`
```sql
CREATE TABLE app.grammar_practice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  total_exercises_attempted INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_incorrect INTEGER DEFAULT 0,
  current_difficulty TEXT DEFAULT 'easy',
  difficulty_adjustments JSONB,
  session_summary TEXT,
  areas_of_strength TEXT[],
  areas_for_improvement TEXT[],
  ...
);
```

### Modified: `grammar_exercises`
- Added `session_id` field to link exercises to practice sessions

## API Endpoints

### Start/Resume Session
```
POST /api/v1/protected/grammar/practice-session/start
Body: { conceptId: string }
Returns: { sessionId, exercises, session }
```
- Creates new session or resumes active session
- Returns first batch of 10 exercises

### Load Next Batch
```
POST /api/v1/protected/grammar/practice-session/next-batch
Body: { sessionId: string }
Returns: { exercises, session, difficultyAdjustment? }
```
- Checks if difficulty should adjust
- Generates next 10 exercises at current difficulty
- Returns adjustment info if difficulty changed

### Complete Session
```
POST /api/v1/protected/grammar/practice-session/complete
Body: { sessionId: string }
Returns: { session with summary }
```
- Generates AI summary of performance
- Marks session as complete
- Returns areas of strength/improvement

### Get Recent Sessions
```
GET /api/v1/protected/grammar/practice-session/recent/:conceptId
Returns: { sessions: [...] }
```
- Returns last 3 completed sessions for context

## User Experience

### Starting Practice
1. User clicks "Practice" on a grammar concept
2. System starts or resumes a practice session
3. First batch of 10 exercises loads at appropriate difficulty

### During Practice
1. User answers exercises one by one
2. After each batch of 10:
   - Performance is evaluated
   - Difficulty may adjust
   - Next batch auto-loads seamlessly
3. UI shows:
   - Current question number
   - Session score (total correct/attempted)
   - Current difficulty level
   - Batch number
   - Difficulty change notifications

### Ending Practice
1. User can click "Finish Session" at any time
2. AI generates a summary:
   - Total performance stats
   - What they did well
   - What to focus on next
3. Session is saved for future reference

## Implementation Files

### Backend
- **`/server/drizzle/0013_add_grammar_practice_sessions.sql`** - Database migration
- **`/server/src/schema/grammar.ts`** - Schema definitions
- **`/server/src/lib/grammar-practice-sessions.ts`** - Session management logic
- **`/server/src/lib/grammar-exercises.ts`** - Updated exercise generation/evaluation
- **`/server/src/api.ts`** - API endpoints for adaptive practice

### Frontend
- **`/ui/src/lib/serverComm.ts`** - API client methods
- **`/ui/src/components/grammar-practice.tsx`** - Updated practice UI

## Running the Migration

To enable this feature, the database migration needs to be run:

```bash
# Start your dev environment
cd learning-app
node scripts/run-dev.js

# Or if database is running separately:
psql -h localhost -p 5502 -U postgres -d postgres < server/drizzle/0013_add_grammar_practice_sessions.sql
```

Alternatively, the migration will run automatically the next time you start the development environment.

## Testing the Feature

1. Start the development environment
2. Navigate to Grammar Practice
3. Select a concept (e.g., Subject Pronouns)
4. Complete 10 exercises:
   - If you score ≥80%, difficulty should increase
   - If you score <60%, difficulty should decrease
5. Continue practicing through multiple batches
6. Click "Finish Session" to see your summary

## Benefits

### For Users
- ✅ **Personalized difficulty**: Adapts to skill level
- ✅ **Unlimited practice**: No artificial limits
- ✅ **Clear progress tracking**: See improvement over time
- ✅ **Actionable feedback**: Know what to focus on
- ✅ **Better fill-blank UX**: Only fill the blank, not full sentence

### For Learning
- ✅ **Progressive challenge**: Prevents boredom and frustration
- ✅ **Spaced retrieval**: Different exercises each session
- ✅ **Performance insights**: Data-driven practice recommendations
- ✅ **Session continuity**: Remember where you left off

## Future Enhancements

Potential improvements:
- [ ] Show difficulty adjustment graph over time
- [ ] Compare current session to previous sessions
- [ ] Recommend when to practice again (spaced repetition)
- [ ] Export session history
- [ ] Practice multiple concepts in one session
- [ ] Add timed challenges
- [ ] Leaderboards/achievements

## Troubleshooting

### Issue: Exercises not loading
- Check console for API errors
- Verify database migration ran successfully
- Ensure OpenAI API key is configured

### Issue: Difficulty not adjusting
- Check that 10 exercises have been completed
- Verify performance scores (must be <60% or ≥80%)
- Look at session logs for adjustment messages

### Issue: Fill-blank still expecting full sentence
- Run the update script: `node server/scripts/update-grammar-prompts.mjs`
- This updates the Subject Pronouns custom prompt in database
- Future exercises will be generated correctly

## Notes

- Sessions auto-save progress, so users can close and resume later
- Only one active session per concept at a time
- Completed sessions are kept indefinitely for analysis
- Exercise generation uses the same AI quality as before, just in batches

