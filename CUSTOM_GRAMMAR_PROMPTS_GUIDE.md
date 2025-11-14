# Custom Grammar Exercise Prompts Guide

## Overview

This system allows each grammar concept to have a **custom AI prompt** for generating exercises. This ensures exercises are highly targeted to the specific grammar point being practiced, rather than generic.

## How It Works

1. **Database Field**: `grammar_concepts.exercise_generation_prompt` stores the custom prompt
2. **Fallback**: If no custom prompt exists, the system uses a generic prompt
3. **Variable Substitution**: Custom prompts can use placeholders that are automatically replaced:
   - `{level}` - Student's CEFR level (A1, A2, etc.)
   - `{knownWords}` - Comma-separated list of student's known vocabulary
   - `{difficulty}` - Exercise difficulty (easy, medium, hard)
   - `{count}` - Number of exercises to generate

## Implementation Status

### ✅ Completed
- **Subject Pronouns** (`a1-subject-pronouns`) - Fully implemented with custom prompt
  - Focuses on when to use/omit pronouns
  - Targets common errors like overuse and wrong conjugations
  - Emphasizes contrast, emphasis, and formal Lei usage

### 📝 Ready to Implement
All other grammar concepts (50+) can now have custom prompts added following the same pattern.

## How to Add Custom Prompts to Other Concepts

### Step 1: Design the Custom Prompt

Create a prompt that:
1. **Identifies the specific grammar point** being taught
2. **Lists critical teaching points** for that concept
3. **Targets common student errors** specific to that grammar point
4. **Provides exercise design requirements** tailored to the concept
5. **Specifies which exercise types** work best
6. **Includes what to AVOID** (e.g., testing unrelated grammar)

### Step 2: Add to Seed Data

Edit `/server/src/data/grammar-concepts-seed.json`:

```json
{
  "id": "your-concept-id",
  "name": "Your Grammar Concept",
  "name_italian": "Il Tuo Concetto",
  // ... other fields ...
  "exercise_generation_prompt": "Your custom prompt here with {level}, {knownWords}, {difficulty}, and {count} placeholders",
  "related_concepts": ["concept1", "concept2"],
  "importance": 8
}
```

### Step 3: Update Database

Run the update script:

```bash
cd learning-app/server
node scripts/update-grammar-prompts.mjs
```

This will:
- Run the migration (if not already done)
- Update all concepts with custom prompts from seed data

### Step 4: Test

1. Go to Grammar section in the app
2. Select the concept you added a prompt for
3. Generate exercises
4. Verify exercises focus on the specific grammar point

## Example: Subject Pronouns Custom Prompt

Here's the complete custom prompt for Subject Pronouns as a template:

```
You are an expert Italian language teacher specializing in subject pronouns (Pronomi Soggetto). 
You're creating practice exercises for a student at CEFR level {level}.

GRAMMAR CONCEPT: Subject Pronouns (io, tu, lui/lei/Lei, noi, voi, loro)

CRITICAL TEACHING POINTS FOR THIS CONCEPT:
1. Italian subject pronouns are OPTIONAL - verb endings show the subject
2. USE pronouns for: emphasis, contrast, or clarity
3. OMIT pronouns in normal, non-emphatic statements
4. Formal "Lei" (you-formal) always capitalized, uses 3rd person singular verbs
5. After prepositions, use stressed forms: me, te, lui, lei, noi, voi, loro
6. Modern Italian avoids "esso/essa/essi/esse" - just use the verb alone for things

COMMON STUDENT ERRORS TO TARGET:
- Overusing pronouns (saying "io" too much like in English)
- Wrong verb conjugation with pronouns (io parlano ✗ → io parlo ✓)
- Not capitalizing formal Lei
- Using subject pronouns after prepositions (io ✗ → me ✓)
- Not using pronouns when contrast/emphasis is needed

EXERCISE DESIGN REQUIREMENTS:
1. Create exercises that specifically test WHEN to use vs omit pronouns
2. Include emphasis/contrast scenarios: "Io parlo italiano, tu parli francese"
3. Test formal vs informal: Lei vs tu situations
4. Include real-world contexts: introductions, contrasting actions, clarifications
5. Vary between: recognition, production, and correction exercises
6. Use vocabulary the student knows: {knownWords}
7. Difficulty: {difficulty}

EXERCISE TYPES TO PRIORITIZE:
- fill_blank: Sentences where student decides whether to include pronoun or not
- multiple_choice: Choose between versions with/without pronouns
- correction: Fix sentences with pronoun overuse or wrong forms
- contextual_usage: Real scenarios requiring emphasis or contrast
- translation: English → Italian emphasizing when pronouns are needed
- dialogue_completion: Conversations showing natural pronoun usage

AVOID:
- Exercises that only test verb conjugation (that's a different concept)
- Overly complex vocabulary that distracts from pronoun usage
- Unnatural sentences that wouldn't occur in real conversation
- Exercises without clear context about why a pronoun is/isn't needed

For each exercise, your explanation must focus on THE PRONOUN CHOICE, 
not just the grammar in general.

Student level: {level}
Student's known words: {knownWords}
Difficulty: {difficulty}

Create {count} varied exercises following these guidelines.

Return ONLY valid JSON with this structure:
{
  "exercises": [
    {
      "type": "fill_blank" | "multiple_choice" | "translation" | ...,
      "question": "the exercise question/prompt",
      "correctAnswer": "the correct answer",
      "options": ["option1", "option2", "option3", "option4"],
      "explanation": "why this is correct, focusing on PRONOUN usage rules",
      "hints": ["hint1", "hint2"],
      "difficulty": "{difficulty}",
      "relatedVocabulary": ["word1", "word2"]
    }
  ]
}
```

## Recommendations for Other Concepts

### High Priority Concepts to Add Custom Prompts

1. **Articles (Definite/Indefinite)**
   - Focus on: when to use il/lo/la/l', gender agreement, special cases
   - Target errors: wrong article choice, missing articles with general concepts

2. **Passato Prossimo**
   - Focus on: essere vs avere auxiliary choice, past participle agreement
   - Target errors: wrong auxiliary, forgetting agreement with essere

3. **Prepositions (Simple & Articulated)**
   - Focus on: which preposition to use, when to combine with articles
   - Target errors: English-influenced preposition choice, wrong articulated forms

4. **Direct/Indirect Object Pronouns**
   - Focus on: which pronoun form, position before verb, combined pronouns
   - Target errors: wrong pronoun choice, wrong position, mixing up direct/indirect

5. **Subjunctive Mood**
   - Focus on: when subjunctive is required, which tense to use
   - Target errors: using indicative instead of subjunctive, wrong subjunctive tense

## Benefits of Custom Prompts

✅ **Targeted Practice** - Exercises focus on the specific grammar point, not generic grammar
✅ **Common Error Coverage** - Addresses typical mistakes students make with that concept
✅ **Contextual Learning** - Creates realistic scenarios where the grammar is naturally used
✅ **Progressive Difficulty** - Adapts to student's level and mastery of the concept
✅ **Clear Explanations** - Focuses explanations on WHY, not just WHAT is correct

## Technical Details

### Database Schema

```sql
ALTER TABLE app.grammar_concepts 
ADD COLUMN IF NOT EXISTS exercise_generation_prompt TEXT;
```

### Code Implementation

The `generateExercises()` function in `/server/src/lib/grammar-exercises.ts` now:

1. Checks if concept has `exercise_generation_prompt`
2. If yes: Uses custom prompt with variable substitution
3. If no: Falls back to generic prompt
4. Logs which type of prompt is being used

### Logging

When generating exercises, you'll see:
- `✨ Using custom prompt for concept: Subject Pronouns` - Custom prompt found
- `📋 Using generic prompt for concept: ...` - No custom prompt, using fallback

## Troubleshooting

### Exercises still seem generic?
- Check if the custom prompt was added to seed data correctly
- Run `node scripts/update-grammar-prompts.mjs` to update database
- Check server logs to confirm custom prompt is being used
- Verify placeholders `{level}`, `{knownWords}`, etc. are in the prompt

### Update script fails?
- Ensure DATABASE_URL environment variable is set correctly
- Check that the concept ID in seed data matches database
- Verify JSON syntax is valid in seed file

### Exercises not being generated at all?
- Check OpenAI API key is configured in `.env`
- Look at server console for detailed error messages
- Verify concept exists in database with correct ID

## Next Steps

1. **Identify concepts** that would benefit most from custom prompts
2. **Design custom prompts** following the template above
3. **Add to seed data** in grammar-concepts-seed.json
4. **Run update script** to apply to database
5. **Test exercises** to ensure they're targeted and effective
6. **Iterate** based on exercise quality and student feedback

---

For questions or issues, check the server logs for detailed error messages.

