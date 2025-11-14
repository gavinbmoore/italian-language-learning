/**
 * Create test flashcards for immediate review
 * This script adds some Italian vocabulary words as flashcards with review dates set to now
 */

import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';

async function createTestFlashcards() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');

    const userId = 'demo-user-123'; // Demo user ID

    // Test flashcards with Italian words
    const testWords = [
      {
        word: 'ciao',
        word_original: 'ciao',
        translation: 'hello / goodbye',
        example_sentence: 'Ciao! Come stai oggi?',
      },
      {
        word: 'grazie',
        word_original: 'grazie',
        translation: 'thank you',
        example_sentence: 'Grazie mille per il tuo aiuto!',
      },
      {
        word: 'bello',
        word_original: 'bello',
        translation: 'beautiful',
        example_sentence: 'Che bel giorno oggi!',
      },
      {
        word: 'mangiare',
        word_original: 'mangiare',
        translation: 'to eat',
        example_sentence: 'Mi piace mangiare la pizza.',
      },
      {
        word: 'casa',
        word_original: 'casa',
        translation: 'house / home',
        example_sentence: 'Vado a casa dopo il lavoro.',
      },
    ];

    // Set review date to now (so they appear immediately)
    const now = new Date();

    for (const wordData of testWords) {
      const id = `${userId}-${wordData.word}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      await client.query(`
        INSERT INTO app.vocabulary (
          id, user_id, word, word_original, 
          translation, example_sentence,
          frequency_rank, difficulty_level,
          times_encountered, times_understood, is_known,
          last_encountered, created_at,
          is_flashcard, ease_factor, interval_days, repetitions, next_review_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
        ON CONFLICT (id) DO NOTHING
      `, [
        id,
        userId,
        wordData.word,
        wordData.word_original,
        wordData.translation,
        wordData.example_sentence,
        99999, // frequency_rank
        'A1', // difficulty_level
        1, // times_encountered
        0, // times_understood
        false, // is_known
        now, // last_encountered
        now, // created_at
        true, // is_flashcard
        2.5, // ease_factor (Anki default)
        0, // interval_days
        0, // repetitions
        now, // next_review_date (set to NOW for immediate review)
      ]);

      console.log(`✅ Created flashcard: ${wordData.word_original} (${wordData.translation})`);
    }

    console.log('\n🎉 Successfully created test flashcards!');
    console.log('📝 Refresh your app to see the flashcard review modal appear automatically.\n');

  } catch (error) {
    console.error('❌ Error creating test flashcards:', error);
    throw error;
  } finally {
    await client.end();
  }
}

createTestFlashcards();

