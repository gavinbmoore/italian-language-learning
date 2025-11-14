#!/usr/bin/env node

/**
 * Diagnostic script to check flashcard review dates
 * Helps debug why cards aren't showing as due for review
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

async function checkFlashcards() {
  try {
    console.log('🔍 Checking flashcard dates in database...\n');
    
    const userId = 'demo-user-123';
    const now = new Date();
    
    // Get all flashcards
    const cards = await sql`
      SELECT 
        id,
        word,
        next_review_date,
        last_reviewed,
        repetitions,
        interval_days,
        ease_factor,
        is_flashcard
      FROM app.vocabulary
      WHERE user_id = ${userId}
        AND is_flashcard = true
      ORDER BY next_review_date
    `;
    
    if (cards.length === 0) {
      console.log('❌ No flashcards found in database!');
      console.log('   Make sure you have created some flashcards first.');
      console.log('   Try going to Comprehensible Input and saving some words.');
      await sql.end();
      return;
    }
    
    console.log(`✅ Found ${cards.length} flashcard(s)\n`);
    console.log(`Current time: ${now.toISOString()}\n`);
    
    let dueCount = 0;
    let futureCount = 0;
    
    cards.forEach((card, index) => {
      const nextReview = card.next_review_date ? new Date(card.next_review_date) : null;
      const isDue = nextReview ? nextReview <= now : false;
      
      if (isDue) dueCount++;
      else futureCount++;
      
      console.log(`Card ${index + 1}: ${card.word}`);
      console.log(`  Next Review: ${nextReview ? nextReview.toISOString() : 'NULL'}`);
      console.log(`  Status: ${isDue ? '✅ DUE NOW' : '⏰ Not due yet'}`);
      
      if (nextReview && !isDue) {
        const hoursUntilDue = Math.round((nextReview - now) / (1000 * 60 * 60) * 10) / 10;
        console.log(`  Time until due: ${hoursUntilDue} hours`);
      }
      
      console.log(`  Last Reviewed: ${card.last_reviewed ? new Date(card.last_reviewed).toISOString() : 'Never'}`);
      console.log(`  Repetitions: ${card.repetitions || 0}`);
      console.log(`  Interval: ${card.interval_days || 0} days`);
      console.log(`  Ease Factor: ${card.ease_factor || 2.5}`);
      console.log('');
    });
    
    console.log('\n📊 Summary:');
    console.log(`  Due now: ${dueCount}`);
    console.log(`  Not due yet: ${futureCount}`);
    
    if (futureCount > 0) {
      console.log('\n💡 Solution:');
      console.log('  Your cards have future review dates from the old daily system.');
      console.log('  To make them available for review immediately, run:');
      console.log('  \n  node server/scripts/reset-flashcard-dates.mjs\n');
    } else if (dueCount > 0) {
      console.log('\n✅ All your cards are due for review!');
      console.log('   Click "Review Due Cards" in the app to start reviewing.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

checkFlashcards();
