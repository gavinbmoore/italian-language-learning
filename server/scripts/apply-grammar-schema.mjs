#!/usr/bin/env node
/**
 * Apply comprehensive grammar fields to grammar_concepts table
 * Adds 'rules' and 'practice_focus' columns
 */

import postgres from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';

console.log('🔧 Applying comprehensive grammar schema changes...');
console.log(`📍 Connecting to: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
});

try {
  // Add rules column
  console.log('📝 Adding rules column to grammar_concepts table...');
  await sql`
    ALTER TABLE app.grammar_concepts 
    ADD COLUMN IF NOT EXISTS rules TEXT
  `;
  console.log('✅ Added rules column');

  // Add practice_focus column
  console.log('📝 Adding practice_focus column to grammar_concepts table...');
  await sql`
    ALTER TABLE app.grammar_concepts 
    ADD COLUMN IF NOT EXISTS practice_focus TEXT[]
  `;
  console.log('✅ Added practice_focus column');

  console.log('\n🎉 Schema changes applied successfully!');
  console.log('✅ You can now use comprehensive grammar lessons');
  console.log('💡 Next step: Run seed-grammar-concepts.mjs to populate the data');

} catch (error) {
  console.error('❌ Error applying schema changes:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

