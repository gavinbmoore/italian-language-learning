#!/usr/bin/env node

/**
 * Review Vocabulary Status Script
 * 
 * This script provides a comprehensive review of learned words and their status
 * including SRS (Spaced Repetition System) statistics.
 */

import postgres from 'postgres';

// Try to get connection string from environment or use default local setup
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';

console.log('🔌 Connecting to database...');

const sql = postgres(connectionString, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 5
});

// Default user ID (you can change this or pass as argument)
const DEFAULT_USER_ID = 'demo-user-123';

/**
 * Get vocabulary statistics
 */
async function getVocabularyStats(userId) {
  // Total vocabulary count (all words encountered)
  const totalVocabResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
  `;
  const totalVocabulary = Number(totalVocabResult[0]?.count ?? 0);

  // Known words (marked as known)
  const knownWordsResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
      AND is_known = true
  `;
  const knownWords = Number(knownWordsResult[0]?.count ?? 0);

  // Unknown words (not marked as known)
  const unknownWords = totalVocabulary - knownWords;

  // Flashcard words
  const flashcardWordsResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
      AND is_flashcard = true
  `;
  const flashcardWords = Number(flashcardWordsResult[0]?.count ?? 0);

  return {
    totalVocabulary,
    knownWords,
    unknownWords,
    flashcardWords,
  };
}

/**
 * Get flashcard statistics (SRS-based)
 */
async function getFlashcardStats(userId) {
  const now = new Date();

  // Due cards (cards that need review)
  const dueCardsResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
      AND is_flashcard = true
      AND next_review_date IS NOT NULL
      AND next_review_date <= ${now}
  `;
  const dueCards = Number(dueCardsResult[0]?.count ?? 0);

  // New cards (not yet reviewed)
  const newCardsResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
      AND is_flashcard = true
      AND repetitions = 0
  `;
  const newCards = Number(newCardsResult[0]?.count ?? 0);

  // Learning cards (interval < 21 days)
  const learningCardsResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
      AND is_flashcard = true
      AND repetitions > 0
      AND interval_days < 21
  `;
  const learningCards = Number(learningCardsResult[0]?.count ?? 0);

  // Mature cards (interval >= 21 days)
  const matureCardsResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
      AND is_flashcard = true
      AND interval_days >= 21
  `;
  const matureCards = Number(matureCardsResult[0]?.count ?? 0);

  // Graduated cards (learning_step = -1, fully learned)
  const graduatedCardsResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
      AND is_flashcard = true
      AND learning_step = -1
  `;
  const graduatedCards = Number(graduatedCardsResult[0]?.count ?? 0);

  return {
    dueCards,
    newCards,
    learningCards,
    matureCards,
    graduatedCards,
  };
}

/**
 * Get learned words timeline
 */
async function getLearnedWordsTimeline(userId) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // All time graduated
  const allTimeResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
      AND is_flashcard = true
      AND learning_step = -1
  `;
  const allTime = Number(allTimeResult[0]?.count ?? 0);

  // This month
  const thisMonthResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
      AND is_flashcard = true
      AND learning_step = -1
      AND last_reviewed IS NOT NULL
      AND last_reviewed >= ${monthStart}
  `;
  const thisMonth = Number(thisMonthResult[0]?.count ?? 0);

  // This week
  const thisWeekResult = await sql`
    SELECT COUNT(*) as count
    FROM app.vocabulary
    WHERE user_id = ${userId}
      AND is_flashcard = true
      AND learning_step = -1
      AND last_reviewed IS NOT NULL
      AND last_reviewed >= ${weekAgo}
  `;
  const thisWeek = Number(thisWeekResult[0]?.count ?? 0);

  return {
    allTime,
    thisMonth,
    thisWeek,
  };
}

/**
 * Get detailed word list
 */
async function getDetailedWordList(userId, limit = 50) {
  const words = await sql`
    SELECT 
      word_original,
      word,
      translation,
      is_known,
      is_flashcard,
      times_encountered,
      times_understood,
      difficulty_level,
      ease_factor,
      interval_days,
      repetitions,
      learning_step,
      next_review_date,
      last_reviewed,
      last_encountered,
      example_sentence
    FROM app.vocabulary
    WHERE user_id = ${userId}
    ORDER BY last_encountered DESC
    LIMIT ${limit}
  `;

  return words;
}

/**
 * Format word status
 */
function getWordStatus(word) {
  if (!word.is_flashcard) {
    return word.is_known ? '✓ Known' : '✗ Unknown';
  }

  if (word.learning_step === -1) {
    return '🎓 Graduated';
  } else if (word.learning_step === 0 && word.repetitions === 0) {
    return '🆕 New';
  } else if (word.interval_days < 21) {
    return '📚 Learning';
  } else {
    return '🌟 Mature';
  }
}

/**
 * Format next review date
 */
function formatNextReview(date) {
  if (!date) return 'N/A';
  const now = new Date();
  const reviewDate = new Date(date);
  const diffMs = reviewDate - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `Due (${Math.abs(diffDays)} days ago)`;
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return 'Due tomorrow';
  } else {
    return `In ${diffDays} days`;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const userId = process.argv[2] || DEFAULT_USER_ID;

    console.log('\n='.repeat(70));
    console.log('📚 VOCABULARY STATUS REVIEW');
    console.log('='.repeat(70));
    console.log(`User ID: ${userId}\n`);

    // Get overall stats
    console.log('📊 OVERALL VOCABULARY STATISTICS');
    console.log('-'.repeat(70));
    const vocabStats = await getVocabularyStats(userId);
    console.log(`Total Words Encountered:     ${vocabStats.totalVocabulary}`);
    console.log(`Known Words:                 ${vocabStats.knownWords}`);
    console.log(`Unknown Words:               ${vocabStats.unknownWords}`);
    console.log(`Flashcard Words:             ${vocabStats.flashcardWords}`);
    console.log();

    // Get flashcard stats
    if (vocabStats.flashcardWords > 0) {
      console.log('🎴 FLASHCARD STATISTICS (SRS)');
      console.log('-'.repeat(70));
      const flashcardStats = await getFlashcardStats(userId);
      console.log(`Due for Review:              ${flashcardStats.dueCards}`);
      console.log(`New Cards:                   ${flashcardStats.newCards}`);
      console.log(`Learning Cards:              ${flashcardStats.learningCards}`);
      console.log(`Mature Cards (21+ days):     ${flashcardStats.matureCards}`);
      console.log(`Graduated (Fully Learned):   ${flashcardStats.graduatedCards}`);
      console.log();

      // Get learned words timeline
      console.log('📈 LEARNING PROGRESS');
      console.log('-'.repeat(70));
      const timeline = await getLearnedWordsTimeline(userId);
      console.log(`All Time Graduated:          ${timeline.allTime}`);
      console.log(`This Month:                  ${timeline.thisMonth}`);
      console.log(`This Week:                   ${timeline.thisWeek}`);
      console.log();
    }

    // Get detailed word list
    console.log('📝 RECENT WORDS (Last 50)');
    console.log('-'.repeat(70));
    const words = await getDetailedWordList(userId, 50);

    if (words.length === 0) {
      console.log('No words found. Start learning to build your vocabulary!\n');
    } else {
      console.log(
        `${'Word'.padEnd(20)} ${'Status'.padEnd(15)} ${'Encountered'.padEnd(12)} ${'Interval'.padEnd(10)} ${'Next Review'.padEnd(20)}`
      );
      console.log('-'.repeat(70));

      for (const word of words) {
        const wordDisplay = (word.word_original || word.word).substring(0, 18).padEnd(20);
        const status = getWordStatus(word).padEnd(15);
        const encountered = `${word.times_encountered}x`.padEnd(12);
        const interval = word.interval_days 
          ? `${Math.round(word.interval_days)} days`.padEnd(10)
          : 'N/A'.padEnd(10);
        const nextReview = word.is_flashcard 
          ? formatNextReview(word.next_review_date).substring(0, 18)
          : 'N/A';

        console.log(`${wordDisplay} ${status} ${encountered} ${interval} ${nextReview}`);
      }
      console.log();
    }

    // Summary
    console.log('='.repeat(70));
    console.log('💡 TIP: Focus on reviewing due cards and learning new flashcards!');
    console.log('='.repeat(70));
    console.log();

  } catch (error) {
    console.error('Error reviewing vocabulary:', error);
    await sql.end();
    process.exit(1);
  }
  
  await sql.end();
}

main();

