import { getDatabase } from './db';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
import { readingTexts, readingQuestions, readingAttempts, vocabulary } from '../schema/comprehensible-input';
import { getUserProficiency } from './comprehensible-input';
import { generateNewsBasedText, generateComprehensionQuestions, evaluateFreeTextAnswer } from './openai-reading';
import type { ReadingText, ReadingQuestion, ReadingAttempt } from '../schema/comprehensible-input';

export interface DailyReadingTask {
  id: string;
  title: string;
  difficulty_level: string;
  is_completed: boolean;
  completed_at: Date | null;
  order_index: number;
  questions?: ReadingQuestion[];
  content?: string;
  source_topic?: string;
  vocabulary_used?: string[];
}

export interface ReadingStats {
  totalTextsCompleted: number;
  textsCompletedToday: number;
  totalQuestionsAnswered: number;
  correctAnswers: number;
  accuracyRate: number;
  averageScore: number;
  currentStreak: number;
}

/**
 * Get or generate 3 daily reading texts for a user
 */
export async function getDailyReadingTexts(userId: string): Promise<DailyReadingTask[]> {
  const db = await getDatabase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if user already has texts for today
  const existingTexts = await db
    .select()
    .from(readingTexts)
    .where(
      and(
        eq(readingTexts.user_id, userId),
        gte(readingTexts.generated_date, today)
      )
    )
    .orderBy(readingTexts.created_at);
  
  // If we have 3 texts for today, return them
  if (existingTexts.length >= 3) {
    return existingTexts.map((text, index) => ({
      id: text.id,
      title: text.title,
      difficulty_level: text.difficulty_level,
      is_completed: text.is_completed,
      completed_at: text.completed_at,
      order_index: index,
    }));
  }
  
  // Generate new texts for today
  const proficiency = await getUserProficiency(userId);
  
  // Get recently learned vocabulary (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentVocab = await db
    .select()
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.user_id, userId),
        gte(vocabulary.last_encountered, thirtyDaysAgo)
      )
    )
    .orderBy(desc(vocabulary.last_encountered))
    .limit(15);
  
  const vocabularyList = recentVocab.map(v => v.word_original);
  
  // Generate 3 texts
  const generatedTexts: DailyReadingTask[] = [];
  
  for (let i = 0; i < 3; i++) {
    try {
      const generatedText = await generateNewsBasedText({
        level: proficiency.level,
        vocabularyList,
      });
      
      // Save text to database
      const textId = `reading-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      await db.insert(readingTexts).values({
        id: textId,
        user_id: userId,
        title: generatedText.title,
        content: generatedText.content,
        source_topic: generatedText.sourceTopic,
        difficulty_level: proficiency.level,
        generated_date: today,
        vocabulary_used: generatedText.vocabularyUsed,
        is_completed: false,
      });
      
      // Generate questions for this text
      const questions = await generateComprehensionQuestions(
        generatedText.content,
        proficiency.level
      );
      
      // Save questions to database
      for (const question of questions) {
        const questionId = `question-${textId}-${question.orderIndex}-${Math.random().toString(36).substring(2, 9)}`;
        
        await db.insert(readingQuestions).values({
          id: questionId,
          reading_text_id: textId,
          question_type: question.questionType,
          question_text: question.questionText,
          correct_answer: question.correctAnswer,
          options: question.options || null,
          order_index: question.orderIndex,
        });
      }
      
      generatedTexts.push({
        id: textId,
        title: generatedText.title,
        difficulty_level: proficiency.level,
        is_completed: false,
        completed_at: null,
        order_index: i,
      });
      
    } catch (error) {
      console.error(`Error generating reading text ${i + 1}:`, error);
      // Continue generating remaining texts
    }
  }
  
  // Return all texts for today (existing + newly generated)
  const allTexts = await db
    .select()
    .from(readingTexts)
    .where(
      and(
        eq(readingTexts.user_id, userId),
        gte(readingTexts.generated_date, today)
      )
    )
    .orderBy(readingTexts.created_at);
  
  return allTexts.map((text, index) => ({
    id: text.id,
    title: text.title,
    difficulty_level: text.difficulty_level,
    is_completed: text.is_completed,
    completed_at: text.completed_at,
    order_index: index,
  }));
}

/**
 * Get a specific reading text with its questions
 */
export async function getReadingTextById(
  textId: string,
  userId: string
): Promise<ReadingText & { questions: ReadingQuestion[] }> {
  const db = await getDatabase();
  
  // Get the text
  const texts = await db
    .select()
    .from(readingTexts)
    .where(
      and(
        eq(readingTexts.id, textId),
        eq(readingTexts.user_id, userId)
      )
    )
    .limit(1);
  
  if (texts.length === 0) {
    throw new Error('Reading text not found');
  }
  
  const text = texts[0];
  
  // Get the questions
  const questions = await db
    .select()
    .from(readingQuestions)
    .where(eq(readingQuestions.reading_text_id, textId))
    .orderBy(readingQuestions.order_index);
  
  return {
    ...text,
    questions,
  };
}

/**
 * Save a user's answer to a reading question
 */
export async function saveReadingAttempt(
  userId: string,
  textId: string,
  questionId: string,
  userAnswer: string,
  sessionId?: string
): Promise<ReadingAttempt & { evaluation?: { isCorrect: boolean; feedback: string; score: number } }> {
  const db = await getDatabase();
  
  // Get the question
  const questions = await db
    .select()
    .from(readingQuestions)
    .where(eq(readingQuestions.id, questionId))
    .limit(1);
  
  if (questions.length === 0) {
    throw new Error('Question not found');
  }
  
  const question = questions[0];
  
  // Evaluate the answer
  let isCorrect = false;
  let aiFeedback: string | null = null;
  let score = 0;
  
  if (question.question_type === 'multiple_choice') {
    // Simple string comparison for multiple choice
    isCorrect = userAnswer.trim() === question.correct_answer.trim();
    score = isCorrect ? 1 : 0;
  } else {
    // Use AI to evaluate free-text answers
    const evaluation = await evaluateFreeTextAnswer(
      question.question_text,
      question.correct_answer,
      userAnswer
    );
    isCorrect = evaluation.isCorrect;
    aiFeedback = evaluation.feedback;
    score = evaluation.score;
  }
  
  // Save the attempt
  const attemptId = `attempt-${userId}-${questionId}-${Date.now()}`;
  
  await db.insert(readingAttempts).values({
    id: attemptId,
    user_id: userId,
    reading_text_id: textId,
    question_id: questionId,
    user_answer: userAnswer,
    is_correct: isCorrect,
    score: score, // Save partial credit score
    ai_feedback: aiFeedback,
    session_id: sessionId || null,
  });
  
  // Get the saved attempt
  const attempts = await db
    .select()
    .from(readingAttempts)
    .where(eq(readingAttempts.id, attemptId))
    .limit(1);
  
  return {
    ...attempts[0],
    evaluation: {
      isCorrect,
      feedback: aiFeedback || (isCorrect ? 'Correct!' : 'Incorrect'),
      score,
    },
  };
}

/**
 * Mark a reading text as completed
 */
export async function completeReadingText(
  userId: string,
  textId: string
): Promise<void> {
  const db = await getDatabase();
  
  await db
    .update(readingTexts)
    .set({
      is_completed: true,
      completed_at: new Date(),
    })
    .where(
      and(
        eq(readingTexts.id, textId),
        eq(readingTexts.user_id, userId)
      )
    );
}

/**
 * Get reading comprehension statistics for a user
 */
export async function getReadingStats(userId: string): Promise<ReadingStats> {
  const db = await getDatabase();
  
  // Get total texts completed
  const completedTextsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(readingTexts)
    .where(
      and(
        eq(readingTexts.user_id, userId),
        eq(readingTexts.is_completed, true)
      )
    );
  
  const totalTextsCompleted = Number(completedTextsResult[0]?.count || 0);
  
  // Get texts completed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayTextsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(readingTexts)
    .where(
      and(
        eq(readingTexts.user_id, userId),
        eq(readingTexts.is_completed, true),
        gte(readingTexts.completed_at, today)
      )
    );
  
  const textsCompletedToday = Number(todayTextsResult[0]?.count || 0);
  
  // Get total questions answered
  const attemptsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(readingAttempts)
    .where(eq(readingAttempts.user_id, userId));
  
  const totalQuestionsAnswered = Number(attemptsResult[0]?.count || 0);
  
  // Get correct answers count
  const correctResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(readingAttempts)
    .where(
      and(
        eq(readingAttempts.user_id, userId),
        eq(readingAttempts.is_correct, true)
      )
    );
  
  const correctAnswers = Number(correctResult[0]?.count || 0);
  
  // Calculate accuracy rate
  const accuracyRate = totalQuestionsAnswered > 0
    ? correctAnswers / totalQuestionsAnswered
    : 0;
  
  // Calculate average score (including partial credit from free-text questions)
  // For simplicity, we'll use accuracy rate as average score
  const averageScore = accuracyRate;
  
  // Calculate current streak (consecutive days with at least 1 completed text)
  const recentTexts = await db
    .select()
    .from(readingTexts)
    .where(
      and(
        eq(readingTexts.user_id, userId),
        eq(readingTexts.is_completed, true)
      )
    )
    .orderBy(desc(readingTexts.completed_at));
  
  let currentStreak = 0;
  if (recentTexts.length > 0) {
    const completionDates = new Set<string>();
    for (const text of recentTexts) {
      if (text.completed_at) {
        const dateStr = text.completed_at.toISOString().split('T')[0];
        completionDates.add(dateStr);
      }
    }
    
    // Check consecutive days from today backwards
    const dateArray = Array.from(completionDates).sort().reverse();
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (dateArray.includes(todayStr)) {
      currentStreak = 1;
      let checkDate = new Date();
      
      for (let i = 1; i < 365; i++) {
        checkDate.setDate(checkDate.getDate() - 1);
        const checkStr = checkDate.toISOString().split('T')[0];
        
        if (dateArray.includes(checkStr)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }
  
  return {
    totalTextsCompleted,
    textsCompletedToday,
    totalQuestionsAnswered,
    correctAnswers,
    accuracyRate,
    averageScore,
    currentStreak,
  };
}

/**
 * Get reading history for a user
 */
export async function getReadingHistory(
  userId: string,
  limit: number = 20
): Promise<ReadingText[]> {
  const db = await getDatabase();
  
  const history = await db
    .select()
    .from(readingTexts)
    .where(
      and(
        eq(readingTexts.user_id, userId),
        eq(readingTexts.is_completed, true)
      )
    )
    .orderBy(desc(readingTexts.completed_at))
    .limit(limit);
  
  return history;
}

/**
 * Get user's attempts for a specific reading text
 */
export async function getAttemptsForText(
  userId: string,
  textId: string
): Promise<ReadingAttempt[]> {
  const db = await getDatabase();
  
  const attempts = await db
    .select()
    .from(readingAttempts)
    .where(
      and(
        eq(readingAttempts.user_id, userId),
        eq(readingAttempts.reading_text_id, textId)
      )
    )
    .orderBy(readingAttempts.created_at);
  
  return attempts;
}

