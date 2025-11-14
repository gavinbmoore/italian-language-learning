/**
 * Grammar Exercises Library
 * 
 * AI-powered grammar exercise generation, evaluation, and difficulty adaptation.
 * Creates personalized practice based on user's weak areas and vocabulary knowledge.
 */

import { getDatabase } from './db';
import { getUserProficiency, getKnownWords } from './comprehensible-input';
import { getOpenAIClient, OPENAI_MODELS, OPENAI_TEMPERATURES } from './openai-client';
import { 
  grammarExercises, 
  grammarConcepts,
  userGrammarProgress,
  type GrammarExercise,
  type NewGrammarExercise,
  type ExerciseType,
  type DifficultyLevel,
  type MasteryLevel
} from '../schema/grammar';
import { eq, desc, and, sql } from 'drizzle-orm';

/**
 * Exercise generation result
 */
export interface GeneratedExercise {
  type: ExerciseType;
  question: string;
  correctAnswer: string;
  // Type-specific fields
  options?: string[]; // For multiple_choice
  scrambledWords?: string[]; // For sentence_building
  errors?: Array<{ position: number; incorrect: string; correct: string }>; // For error_spotting
  scenario?: string; // For contextual_usage
  dialogue?: Array<{ speaker: string; text: string }>; // For dialogue_completion
  // Common fields
  explanation: string;
  hints?: string[];
  difficulty: DifficultyLevel;
  relatedVocabulary?: string[];
}

/**
 * Exercise evaluation result
 */
export interface ExerciseEvaluation {
  isCorrect: boolean;
  feedback: string;
  correctAnswer: string;
  explanation: string;
  encouragement: string;
}

/**
 * Generate exercises for a specific grammar concept
 */
export async function generateExercises(
  userId: string,
  conceptId: string,
  count: number = 5,
  exerciseTypes?: ExerciseType[],
  difficultyOverride?: DifficultyLevel
): Promise<GeneratedExercise[]> {
  try {
    const db = await getDatabase();
    
    // Get concept details
    const concepts = await db
      .select()
      .from(grammarConcepts)
      .where(eq(grammarConcepts.id, conceptId))
      .limit(1);
    
    if (concepts.length === 0) {
      throw new Error(`Grammar concept not found: ${conceptId}`);
    }
    
    const concept = concepts[0];
    console.log(`📝 Generating ${count} exercises for concept: ${concept.name} (${conceptId})`);
    
    // Get OpenAI client (now inside try-catch)
    const client = getOpenAIClient();
    
    // Get user's proficiency and known words
    const proficiency = await getUserProficiency(userId);
    const knownWords = await getKnownWords(userId, 100);
    const knownWordList = knownWords.map(w => w.word_original).join(', ');
    
    // Determine difficulty based on user's mastery of this concept (or use override)
    const difficulty = difficultyOverride || await determineExerciseDifficulty(userId, conceptId);
    
    // Default exercise types if not specified
    const types = exerciseTypes || ['fill_blank', 'multiple_choice', 'translation', 'conjugation', 'correction', 'sentence_building', 'error_spotting', 'contextual_usage'];
    
    // Build the system prompt - use custom prompt if available, otherwise use generic
    let systemPrompt: string;
    
    if (concept.exercise_generation_prompt) {
      // Custom prompt exists - merge it with user context
      console.log(`✨ Using custom prompt for concept: ${concept.name}`);
      systemPrompt = concept.exercise_generation_prompt
        .replace('{level}', proficiency.level)
        .replace('{knownWords}', knownWordList || 'basic vocabulary')
        .replace('{difficulty}', difficulty)
        .replace('{count}', count.toString());
    } else {
      // Use generic prompt
      console.log(`📋 Using generic prompt for concept: ${concept.name}`);
      systemPrompt = `You are an expert Italian language teacher creating practice exercises.

Student level: ${proficiency.level}
Grammar concept: ${concept.name} (${concept.name_italian})
Description: ${concept.description}
Difficulty: ${difficulty}

Student's known words (use these when possible): ${knownWordList}

Create ${count} varied exercises to practice this concept. Use these exercise types: ${types.join(', ')}

EXERCISE TYPE DESCRIPTIONS:
1. fill_blank: Sentence with ___ where student fills in the correct grammar form
   - "question" should contain the full sentence with ___
   - "correctAnswer" should contain ONLY the word/phrase that fills the blank (NOT the full sentence)
2. multiple_choice: Question with 4 options where student selects the correct one
3. translation: English sentence to translate to Italian using the grammar concept
4. conjugation: Verb form to conjugate in specific tense/person
5. correction: Sentence with an error that student must identify and fix
6. sentence_building: Scrambled words that student must arrange into correct sentence
7. error_spotting: Paragraph with 2-3 errors that student must identify
8. contextual_usage: Short scenario where student must use the grammar concept appropriately
9. dialogue_completion: Dialogue with missing responses student must fill in

Return ONLY valid JSON with this structure:
{
  "exercises": [
    {
      "type": "fill_blank" | "multiple_choice" | "translation" | "conjugation" | "correction" | "sentence_building" | "error_spotting" | "contextual_usage" | "dialogue_completion",
      "question": "the exercise question/prompt",
      "correctAnswer": "the correct answer (for fill_blank: ONLY the blank portion, not full sentence)",
      "options": ["option1", "option2", "option3", "option4"], // for multiple_choice
      "scrambledWords": ["word1", "word2", "word3"], // for sentence_building
      "errors": [{"position": 0, "incorrect": "...", "correct": "..."}], // for error_spotting
      "scenario": "brief scenario description", // for contextual_usage
      "dialogue": [{"speaker": "A", "text": "..."}, {"speaker": "B", "text": "___"}], // for dialogue_completion
      "explanation": "why this is the correct answer and how it demonstrates the concept",
      "hints": ["hint1", "hint2", "hint3"], // 2-3 progressive hints
      "difficulty": "${difficulty}",
      "relatedVocabulary": ["word1", "word2"] // words from user's vocabulary used
    }
  ]
}

GUIDELINES:
- Vary exercise types for engagement
- Make exercises contextual and interesting with real-world scenarios
- Use vocabulary the student knows when possible
- For fill_blank, use "___" for the blank
- For multiple_choice, include 4 plausible but distinct options
- For sentence_building, provide 5-8 scrambled words
- For error_spotting, include 2-3 errors in a short paragraph
- For contextual_usage, provide a brief scenario (1-2 sentences) and ask for response
- For dialogue_completion, create natural conversation flow
- Progressively increase difficulty within the set
- Make exercises practical and relevant to real conversations
- Include clear explanations that teach the grammar concept, not just correct
- Focus explanations on WHY the answer is correct and how it applies the grammar rule`;
    }
    
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Generate ${count} exercises for: ${concept.name}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content || '{"exercises": []}';
    const result = JSON.parse(responseContent);
    
    const exerciseCount = result.exercises?.length || 0;
    console.log(`✅ Generated ${exerciseCount} exercises for concept ${conceptId}`);
    
    if (exerciseCount === 0) {
      throw new Error('OpenAI returned no exercises. Please check your API key and try again.');
    }
    
    return result.exercises || [];
  } catch (error) {
    // Log detailed error information
    console.error('❌ Error generating exercises:', {
      conceptId,
      userId,
      count,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Re-throw the error so it propagates to the API endpoint
    if (error instanceof Error) {
      throw new Error(`Failed to generate exercises: ${error.message}`);
    }
    throw new Error('Failed to generate exercises: Unknown error');
  }
}

/**
 * Determine appropriate difficulty level for exercises
 */
async function determineExerciseDifficulty(
  userId: string,
  conceptId: string
): Promise<DifficultyLevel> {
  const db = await getDatabase();
  
  // Check user's progress with this concept
  const progress = await db
    .select()
    .from(userGrammarProgress)
    .where(
      and(
        eq(userGrammarProgress.user_id, userId),
        eq(userGrammarProgress.concept_id, conceptId)
      )
    )
    .limit(1);
  
  if (progress.length === 0 || progress[0].mastery_level === 'new') {
    return 'easy';
  }
  
  const masteryLevel = progress[0].mastery_level as MasteryLevel;
  const correctRate = progress[0].total_exercises_completed > 0
    ? (progress[0].correct_exercises || 0) / progress[0].total_exercises_completed
    : 0;
  
  // Determine difficulty based on mastery and performance
  if (masteryLevel === 'mastered' || correctRate > 0.85) {
    return 'hard';
  } else if (masteryLevel === 'practicing' || correctRate > 0.65) {
    return 'medium';
  } else {
    return 'easy';
  }
}

/**
 * Save generated exercise to database
 */
export async function saveExercise(
  userId: string,
  conceptId: string,
  exercise: GeneratedExercise,
  sessionId?: string
): Promise<string> {
  const db = await getDatabase();
  
  const exerciseId = `${userId}-exercise-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  await db.insert(grammarExercises).values({
    id: exerciseId,
    user_id: userId,
    concept_id: conceptId,
    session_id: sessionId || null,
    exercise_type: exercise.type,
    question: exercise.question,
    correct_answer: exercise.correctAnswer,
    options: exercise.options ? JSON.stringify(exercise.options) : null,
    explanation: exercise.explanation,
    difficulty: exercise.difficulty,
    hints: exercise.hints ? JSON.stringify(exercise.hints) : null,
    related_vocabulary: exercise.relatedVocabulary || null,
  });
  
  return exerciseId;
}

/**
 * Evaluate user's answer to an exercise
 */
export async function evaluateExerciseAnswer(
  exerciseId: string,
  userId: string,
  userAnswer: string,
  timeSpentSeconds?: number
): Promise<ExerciseEvaluation> {
  const client = getOpenAIClient();
  const db = await getDatabase();
  
  // Get exercise details
  const exercises = await db
    .select()
    .from(grammarExercises)
    .where(
      and(
        eq(grammarExercises.id, exerciseId),
        eq(grammarExercises.user_id, userId)
      )
    )
    .limit(1);
  
  if (exercises.length === 0) {
    throw new Error('Exercise not found');
  }
  
  const exercise = exercises[0];
  
  // Use AI to evaluate the answer (handles variations and near-correct answers)
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are evaluating a student's answer to an Italian grammar exercise.

Exercise type: ${exercise.exercise_type}
Exercise question: ${exercise.question}
Correct answer: ${exercise.correct_answer}
Student's answer: ${userAnswer}
Explanation: ${exercise.explanation}

EVALUATION RULES:
1. For fill_blank exercises: The student should provide ONLY the word/phrase that fills the blank, not the full sentence.
   - Compare the student's answer to the correct answer (which is just the blank portion)
   - Be lenient with capitalization (e.g., "io" vs "Io" are both correct)
   - Be lenient with minor spelling/accent errors if the grammar is correct
   - Accept variations that are grammatically equivalent
   
2. For other exercise types: Evaluate the full answer as provided

3. General rules:
   - Be lenient with minor spelling/accent errors if the grammar concept is demonstrated correctly
   - Accept reasonable variations in word order or phrasing that are still correct
   - Focus on whether the student understands the grammar concept

Return ONLY valid JSON:
{
  "isCorrect": boolean,
  "feedback": "specific feedback on their answer",
  "correctAnswer": "${exercise.correct_answer}",
  "explanation": "explanation of the correct answer",
  "encouragement": "encouraging message"
}`,
        },
        {
          role: 'user',
          content: `Evaluate: "${userAnswer}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content || '{}';
    const evaluation: ExerciseEvaluation = JSON.parse(responseContent);
    
    // Update exercise in database
    await db
      .update(grammarExercises)
      .set({
        user_answer: userAnswer,
        is_correct: evaluation.isCorrect,
        attempted_at: new Date(),
        completed_at: new Date(),
        time_spent_seconds: timeSpentSeconds || null,
      })
      .where(eq(grammarExercises.id, exerciseId));
    
    // Update user progress
    await updateProgressFromExercise(userId, exercise.concept_id, evaluation.isCorrect);
    
    // Update session performance if exercise is part of a session
    if (exercise.session_id) {
      const { updateSessionPerformance } = await import('./grammar-practice-sessions');
      await updateSessionPerformance(exercise.session_id, evaluation.isCorrect);
    }
    
    return evaluation;
  } catch (error) {
    console.error('Error evaluating exercise:', error);
    // Fallback to simple comparison
    const isCorrect = userAnswer.trim().toLowerCase() === exercise.correct_answer.toLowerCase();
    
    await db
      .update(grammarExercises)
      .set({
        user_answer: userAnswer,
        is_correct: isCorrect,
        attempted_at: new Date(),
        completed_at: new Date(),
        time_spent_seconds: timeSpentSeconds || null,
      })
      .where(eq(grammarExercises.id, exerciseId));
    
    await updateProgressFromExercise(userId, exercise.concept_id, isCorrect);
    
    // Update session performance if exercise is part of a session
    if (exercise.session_id) {
      const { updateSessionPerformance } = await import('./grammar-practice-sessions');
      await updateSessionPerformance(exercise.session_id, isCorrect);
    }
    
    return {
      isCorrect,
      feedback: isCorrect ? 'Correct!' : 'Not quite right.',
      correctAnswer: exercise.correct_answer,
      explanation: exercise.explanation || '',
      encouragement: isCorrect ? 'Great job!' : 'Keep practicing!',
    };
  }
}

/**
 * Check and update completion status for a grammar concept
 * A concept is complete when: video watched AND 5+ exercises completed
 */
export async function checkAndUpdateCompletion(
  userId: string,
  conceptId: string
): Promise<boolean> {
  const db = await getDatabase();
  
  // Get current progress
  const existing = await db
    .select()
    .from(userGrammarProgress)
    .where(
      and(
        eq(userGrammarProgress.user_id, userId),
        eq(userGrammarProgress.concept_id, conceptId)
      )
    )
    .limit(1);
  
  if (existing.length === 0) {
    return false;
  }
  
  const progress = existing[0];
  const hasWatchedVideo = progress.has_watched_video || false;
  const exercisesCompleted = progress.total_exercises_completed || 0;
  const isComplete = hasWatchedVideo && exercisesCompleted >= 5;
  
  // If complete and not yet marked, update the completed_at timestamp
  if (isComplete && !progress.completed_at) {
    await db
      .update(userGrammarProgress)
      .set({
        completed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(userGrammarProgress.id, progress.id));
    
    console.log(`Grammar concept ${conceptId} marked as complete for user ${userId}`);
    return true;
  }
  
  return isComplete;
}

/**
 * Update user's grammar progress based on exercise performance
 */
async function updateProgressFromExercise(
  userId: string,
  conceptId: string,
  isCorrect: boolean
): Promise<void> {
  const db = await getDatabase();
  
  // Get or create progress record
  const existing = await db
    .select()
    .from(userGrammarProgress)
    .where(
      and(
        eq(userGrammarProgress.user_id, userId),
        eq(userGrammarProgress.concept_id, conceptId)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    const progress = existing[0];
    const totalExercises = (progress.total_exercises_completed || 0) + 1;
    const correctExercises = (progress.correct_exercises || 0) + (isCorrect ? 1 : 0);
    const correctRate = correctExercises / totalExercises;
    
    // Determine new mastery level
    let newMasteryLevel = progress.mastery_level;
    if (totalExercises >= 10 && correctRate >= 0.9) {
      newMasteryLevel = 'mastered';
    } else if (totalExercises >= 5 && correctRate >= 0.7) {
      newMasteryLevel = 'practicing';
    } else if (totalExercises >= 2) {
      newMasteryLevel = 'learning';
    }
    
    await db
      .update(userGrammarProgress)
      .set({
        total_exercises_completed: totalExercises,
        correct_exercises: correctExercises,
        mastery_level: newMasteryLevel,
        updated_at: new Date(),
      })
      .where(eq(userGrammarProgress.id, progress.id));
    
    // Check if concept is now complete (video watched + 5 exercises)
    await checkAndUpdateCompletion(userId, conceptId);
  } else {
    // Create new progress record
    const progressId = `${userId}-progress-${conceptId}`;
    await db.insert(userGrammarProgress).values({
      id: progressId,
      user_id: userId,
      concept_id: conceptId,
      total_exercises_completed: 1,
      correct_exercises: isCorrect ? 1 : 0,
      mastery_level: 'learning',
    });
  }
}

/**
 * Create a personalized practice drill based on weak concepts
 */
export async function createPersonalizedDrill(
  userId: string,
  exerciseCount: number = 10
): Promise<Array<{ conceptId: string; conceptName: string; exercises: GeneratedExercise[] }>> {
  const db = await getDatabase();
  
  // Get user's weak concepts (concepts with errors or low mastery)
  const weakConcepts = await db
    .select({
      concept: grammarConcepts,
      progress: userGrammarProgress,
    })
    .from(userGrammarProgress)
    .innerJoin(grammarConcepts, eq(grammarConcepts.id, userGrammarProgress.concept_id))
    .where(
      and(
        eq(userGrammarProgress.user_id, userId),
        sql`(
          ${userGrammarProgress.error_count} > 0 
          OR ${userGrammarProgress.mastery_level} IN ('new', 'learning')
        )`
      )
    )
    .orderBy(
      desc(userGrammarProgress.error_count),
      desc(userGrammarProgress.last_error_date)
    )
    .limit(3); // Focus on top 3 weak concepts
  
  if (weakConcepts.length === 0) {
    return [];
  }
  
  const drill: Array<{ conceptId: string; conceptName: string; exercises: GeneratedExercise[] }> = [];
  
  // Generate exercises for each weak concept
  const exercisesPerConcept = Math.ceil(exerciseCount / weakConcepts.length);
  
  for (const item of weakConcepts) {
    const exercises = await generateExercises(
      userId,
      item.concept.id,
      exercisesPerConcept
    );
    
    drill.push({
      conceptId: item.concept.id,
      conceptName: item.concept.name,
      exercises,
    });
  }
  
  return drill;
}

/**
 * Get exercise history for a user
 */
export async function getExerciseHistory(
  userId: string,
  limit: number = 20
): Promise<GrammarExercise[]> {
  const db = await getDatabase();
  
  const exercises = await db
    .select()
    .from(grammarExercises)
    .where(
      and(
        eq(grammarExercises.user_id, userId),
        sql`${grammarExercises.completed_at} IS NOT NULL`
      )
    )
    .orderBy(desc(grammarExercises.completed_at))
    .limit(limit);
  
  return exercises as GrammarExercise[];
}

/**
 * Get exercises for a specific concept
 */
export async function getExercisesByConcept(
  userId: string,
  conceptId: string,
  includeCompleted: boolean = false
): Promise<GrammarExercise[]> {
  const db = await getDatabase();
  
  let query = db
    .select()
    .from(grammarExercises)
    .where(
      and(
        eq(grammarExercises.user_id, userId),
        eq(grammarExercises.concept_id, conceptId)
      )
    );
  
  if (!includeCompleted) {
    query = query.where(sql`${grammarExercises.completed_at} IS NULL`);
  }
  
  const exercises = await query
    .orderBy(desc(grammarExercises.created_at))
    .limit(20);
  
  return exercises as GrammarExercise[];
}

/**
 * Get exercise statistics for a user
 */
export async function getExerciseStats(userId: string): Promise<{
  totalCompleted: number;
  correctCount: number;
  averageAccuracy: number;
  exercisesByDifficulty: Record<string, number>;
  recentPerformance: number; // accuracy in last 10 exercises
}> {
  const db = await getDatabase();
  
  // Total completed exercises
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(grammarExercises)
    .where(
      and(
        eq(grammarExercises.user_id, userId),
        sql`${grammarExercises.completed_at} IS NOT NULL`
      )
    );
  const totalCompleted = Number(totalResult[0]?.count || 0);
  
  // Correct exercises
  const correctResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(grammarExercises)
    .where(
      and(
        eq(grammarExercises.user_id, userId),
        eq(grammarExercises.is_correct, true),
        sql`${grammarExercises.completed_at} IS NOT NULL`
      )
    );
  const correctCount = Number(correctResult[0]?.count || 0);
  
  const averageAccuracy = totalCompleted > 0 ? correctCount / totalCompleted : 0;
  
  // Exercises by difficulty
  const difficultyResult = await db
    .select({
      difficulty: grammarExercises.difficulty,
      count: sql<number>`count(*)`,
    })
    .from(grammarExercises)
    .where(
      and(
        eq(grammarExercises.user_id, userId),
        sql`${grammarExercises.completed_at} IS NOT NULL`
      )
    )
    .groupBy(grammarExercises.difficulty);
  
  const exercisesByDifficulty: Record<string, number> = {};
  difficultyResult.forEach(row => {
    exercisesByDifficulty[row.difficulty as string] = Number(row.count);
  });
  
  // Recent performance (last 10 exercises)
  const recentExercises = await db
    .select()
    .from(grammarExercises)
    .where(
      and(
        eq(grammarExercises.user_id, userId),
        sql`${grammarExercises.completed_at} IS NOT NULL`
      )
    )
    .orderBy(desc(grammarExercises.completed_at))
    .limit(10);
  
  const recentCorrect = recentExercises.filter(ex => ex.is_correct).length;
  const recentPerformance = recentExercises.length > 0 ? recentCorrect / recentExercises.length : 0;
  
  return {
    totalCompleted,
    correctCount,
    averageAccuracy,
    exercisesByDifficulty,
    recentPerformance,
  };
}

/**
 * Adapt exercise difficulty based on user performance
 */
export async function adaptDifficulty(
  userId: string,
  conceptId: string
): Promise<DifficultyLevel> {
  const db = await getDatabase();
  
  // Get recent exercises for this concept
  const recentExercises = await db
    .select()
    .from(grammarExercises)
    .where(
      and(
        eq(grammarExercises.user_id, userId),
        eq(grammarExercises.concept_id, conceptId),
        sql`${grammarExercises.completed_at} IS NOT NULL`
      )
    )
    .orderBy(desc(grammarExercises.completed_at))
    .limit(5);
  
  if (recentExercises.length < 3) {
    return 'easy'; // Not enough data, start easy
  }
  
  const correctCount = recentExercises.filter(ex => ex.is_correct).length;
  const accuracy = correctCount / recentExercises.length;
  
  // Adapt difficulty based on recent performance
  if (accuracy >= 0.9) {
    return 'hard'; // Doing great, increase challenge
  } else if (accuracy >= 0.7) {
    return 'medium'; // Good progress, maintain medium difficulty
  } else {
    return 'easy'; // Struggling, make it easier
  }
}

