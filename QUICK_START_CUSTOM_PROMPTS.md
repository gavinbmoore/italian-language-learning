# Quick Start: Custom Grammar Prompts

## ✅ What Was Done

I've implemented a **custom AI prompt system** for grammar exercises. This allows each grammar concept to have tailored exercises instead of generic ones.

**Subject Pronouns** now has a custom prompt that:
- Focuses on when to use vs omit pronouns
- Tests emphasis and contrast usage
- Addresses common errors (overuse, wrong conjugations)
- Creates realistic contextual scenarios

## 🚀 Run These Commands Now

### 1. Apply the Database Changes

```bash
cd learning-app/server
node scripts/update-grammar-prompts.mjs
```

**Expected Output:**
```
✅ Migration completed
✅ Updated Subject Pronouns
📊 Update Summary: ✅ Updated: 1 concepts
```

### 2. Restart Your Server

If your server is already running, restart it:
```bash
# Stop the current server (Ctrl+C)
# Then start it again
npm run dev
```

### 3. Test Subject Pronouns

1. Open your app
2. Go to **Grammar** section
3. Click on **Subject Pronouns**
4. Click **Practice** to generate exercises

**Watch the server console** - you should see:
```
✨ Using custom prompt for concept: Subject Pronouns
```

## 📋 Verification Checklist

- [ ] Migration script completed successfully
- [ ] Server restarts without errors
- [ ] No 500 errors when generating exercises
- [ ] Server console shows "Using custom prompt for concept: Subject Pronouns"
- [ ] Exercises focus on pronoun usage (not just verb conjugation)
- [ ] Exercises test when to use/omit pronouns

## 🎯 The Custom Prompt Display

Here's the custom prompt that was implemented for Subject Pronouns:

```
You are an expert Italian language teacher specializing in subject pronouns 
(Pronomi Soggetto). You're creating practice exercises for a student at 
CEFR level {level}.

GRAMMAR CONCEPT: Subject Pronouns (io, tu, lui/lei/Lei, noi, voi, loro)

CRITICAL TEACHING POINTS:
1. Italian subject pronouns are OPTIONAL - verb endings show the subject
2. USE pronouns for: emphasis, contrast, or clarity
3. OMIT pronouns in normal, non-emphatic statements
4. Formal "Lei" (you-formal) always capitalized, uses 3rd person singular
5. After prepositions, use stressed forms: me, te, lui, lei, noi, voi, loro
6. Avoid "esso/essa/essi/esse" - just use the verb alone for things

COMMON STUDENT ERRORS TO TARGET:
- Overusing pronouns (like in English)
- Wrong verb conjugation with pronouns
- Not capitalizing formal Lei
- Using subject pronouns after prepositions
- Not using pronouns when contrast/emphasis needed

EXERCISE DESIGN:
- Test WHEN to use vs omit pronouns
- Include emphasis/contrast scenarios
- Test formal vs informal situations
- Use real-world contexts
- Focus explanations on PRONOUN CHOICE

EXERCISE TYPES TO USE:
- fill_blank: deciding whether to include pronoun
- multiple_choice: with/without pronoun versions
- correction: fixing overuse or wrong forms
- contextual_usage: scenarios requiring emphasis
- translation: emphasizing when pronouns needed
- dialogue_completion: natural pronoun usage

AVOID:
- Testing only verb conjugation
- Complex vocabulary that distracts
- Unnatural sentences
- Exercises without clear context for pronoun usage

For each exercise, explain WHY the pronoun is used or omitted.
```

This prompt ensures exercises are **targeted** and **relevant** to Subject Pronouns specifically.

## 📖 Documentation

- **Full Guide**: See `CUSTOM_GRAMMAR_PROMPTS_GUIDE.md` for how to add custom prompts to other concepts
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY_CUSTOM_PROMPTS.md` for technical details

## 🔧 Troubleshooting

### Still getting 500 errors?
Check `/server/.env` has:
```
OPENAI_API_KEY=sk-your-key-here
```

### Migration fails?
Ensure PostgreSQL is running and DATABASE_URL is correct in `.env`

### Exercises still seem generic?
1. Check server console confirms "Using custom prompt"
2. Verify migration ran successfully
3. Restart server

## 📊 What to Expect

### Before
- Generic grammar exercises
- No focus on specific pronoun issues
- Generic explanations

### After
- Exercises specifically test pronoun usage rules
- Addresses common student errors (overuse, etc.)
- Explanations focus on WHY pronouns are used/omitted
- Contextual scenarios requiring emphasis/contrast
- Tests formal vs informal appropriately

## 🎓 Next: Add to Other Concepts

Once Subject Pronouns works well, you can add custom prompts to other concepts:

1. Edit `/server/src/data/grammar-concepts-seed.json`
2. Add `"exercise_generation_prompt": "your prompt here"` to any concept
3. Run `node scripts/update-grammar-prompts.mjs`
4. Test the exercises

See `CUSTOM_GRAMMAR_PROMPTS_GUIDE.md` for the complete template and best practices.

---

**Questions?** Check the server console for detailed error messages. The error handling has been significantly improved to help debug issues.

