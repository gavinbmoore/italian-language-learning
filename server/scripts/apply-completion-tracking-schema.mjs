#!/usr/bin/env node
/**
 * Apply the grammar completion tracking schema
 * Adds has_watched_video and completed_at fields to user_grammar_progress table
 */

import postgres from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';

console.log('🔧 Applying grammar completion tracking schema...');
console.log(`📍 Connecting to: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
});

try {
  // Add has_watched_video column
  console.log('📝 Adding has_watched_video column to user_grammar_progress table...');
  await sql`
    ALTER TABLE app.user_grammar_progress 
    ADD COLUMN IF NOT EXISTS has_watched_video BOOLEAN DEFAULT FALSE
  `;
  console.log('✅ Added has_watched_video column');

  // Add completed_at column
  console.log('📝 Adding completed_at column to user_grammar_progress table...');
  await sql`
    ALTER TABLE app.user_grammar_progress 
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP
  `;
  console.log('✅ Added completed_at column');

  // Create index for completed concepts
  console.log('📝 Creating index for completed concepts...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_grammar_progress_completed 
    ON app.user_grammar_progress(user_id, completed_at) 
    WHERE completed_at IS NOT NULL
  `;
  console.log('✅ Created idx_user_grammar_progress_completed index');

  // Create index for video watching
  console.log('📝 Creating index for video watching...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_grammar_progress_video_watched 
    ON app.user_grammar_progress(user_id, has_watched_video) 
    WHERE has_watched_video = TRUE
  `;
  console.log('✅ Created idx_user_grammar_progress_video_watched index');

  console.log('\n🎉 Schema changes applied successfully!');
  console.log('✅ Grammar completion tracking is now enabled');
  console.log('💡 Concepts will be marked complete when:');
  console.log('   - User watches a video AND');
  console.log('   - User completes at least 5 exercises');

} catch (error) {
  console.error('❌ Error applying schema changes:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}


