#!/usr/bin/env node
/**
 * Manually apply session_id column to conversations table
 * Run this script if db:push fails
 */

import postgres from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';

console.log('🔧 Applying session_id schema changes...');
console.log(`📍 Connecting to: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
});

try {
  // Add session_id column
  console.log('📝 Adding session_id column to conversations table...');
  await sql`
    ALTER TABLE app.conversations 
    ADD COLUMN IF NOT EXISTS session_id TEXT 
    REFERENCES app.learning_sessions(id) ON DELETE CASCADE
  `;
  console.log('✅ Added session_id column');

  // Create indexes for performance
  console.log('📝 Creating indexes...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_conversations_session_id 
    ON app.conversations(session_id)
  `;
  console.log('✅ Created idx_conversations_session_id');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_session 
    ON app.conversations(user_id, session_id)
  `;
  console.log('✅ Created idx_conversations_user_session');

  console.log('\n🎉 Schema changes applied successfully!');
  console.log('✅ You can now use the conversation session management feature');

} catch (error) {
  console.error('❌ Error applying schema changes:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

