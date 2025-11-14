#!/usr/bin/env node
/**
 * Apply watched grammar videos schema
 * Creates table for tracking video watch history and AI analysis
 */

import postgres from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';

console.log('🔧 Applying watched videos schema...');
console.log(`📍 Connecting to: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
});

try {
  // Create watched_grammar_videos table
  console.log('📝 Creating watched_grammar_videos table...');
  await sql`
    CREATE TABLE IF NOT EXISTS app.watched_grammar_videos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL,
      concept_id TEXT NOT NULL REFERENCES app.grammar_concepts(id) ON DELETE CASCADE,
      watched_at TIMESTAMP NOT NULL DEFAULT NOW(),
      watch_status TEXT NOT NULL DEFAULT 'watched',
      
      transcript TEXT,
      transcript_language TEXT,
      analysis JSONB,
      
      video_title TEXT,
      video_duration TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log('✅ Created watched_grammar_videos table');

  // Create indexes for performance
  console.log('📝 Creating indexes...');
  
  await sql`
    CREATE INDEX IF NOT EXISTS idx_watched_videos_user 
    ON app.watched_grammar_videos(user_id)
  `;
  console.log('✅ Created idx_watched_videos_user');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_watched_videos_concept 
    ON app.watched_grammar_videos(concept_id)
  `;
  console.log('✅ Created idx_watched_videos_concept');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_watched_videos_user_concept 
    ON app.watched_grammar_videos(user_id, concept_id)
  `;
  console.log('✅ Created idx_watched_videos_user_concept');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_watched_videos_video_id 
    ON app.watched_grammar_videos(video_id)
  `;
  console.log('✅ Created idx_watched_videos_video_id');

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_watched_videos_unique 
    ON app.watched_grammar_videos(user_id, video_id)
  `;
  console.log('✅ Created idx_watched_videos_unique');

  console.log('\n🎉 Watched videos schema applied successfully!');
  console.log('✅ You can now track video watch history and AI analysis');

} catch (error) {
  console.error('❌ Error applying schema changes:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  await sql.end();
}

