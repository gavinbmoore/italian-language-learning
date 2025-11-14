#!/usr/bin/env node

/**
 * Reset all flashcard review dates to be due now
 * Useful after changing the interval system from daily to 12-hour
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

async function resetFlashcardDates() {
  try {
    console.log('🔄 Resetting flashcard review dates...\n');
    
    const userId = 'demo-user-123';
    
    // First, check how many cards will be affected
    const cards = await sql`
      SELECT 
        id,
        word,
        next_review_date
      FROM app.vocabulary
      WHERE user_id = ${userId}
        AND is_flashcard = true
        AND next_review_date > now()
      ORDER BY next_review_date
    `;
    
    if (cards.length === 0) {
      console.log('✅ No cards need to be reset - all are already due!');
      await sql.end();
      return;
    }
    
    console.log(`Found ${cards.length} card(s) with future review dates:\n`);
    cards.forEach(card => {
      const reviewDate = new Date(card.next_review_date);
      console.log(`  - ${card.word} (was due: ${reviewDate.toISOString()})`);
    });
    
    console.log('\n⏳ Resetting to current time...\n');
    
    // Update all flashcards to be due now
    const result = await sql`
      UPDATE app.vocabulary
      SET next_review_date = now()
      WHERE user_id = ${userId}
        AND is_flashcard = true
    `;
    
    console.log(`✅ Successfully reset ${cards.length} flashcard(s)!`);
    console.log('   All cards are now due for review.');
    console.log('   Refresh your app to see them!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

resetFlashcardDates();
