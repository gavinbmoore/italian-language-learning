#!/usr/bin/env node
/**
 * Apply reading comprehension schema migration
 * Creates tables: reading_texts, reading_questions, reading_attempts
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';

console.log('🔧 Applying reading comprehension schema...');
console.log(`📍 Connecting to: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
});

try {
  // Read the migration file
  const migrationPath = join(__dirname, '../drizzle/0007_add_reading_comprehension.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf8');
  
  console.log('📝 Applying reading comprehension migration...');
  
  // Execute the migration
  await sql.unsafe(migrationSQL);
  
  console.log('✅ Reading comprehension schema applied successfully!');
  console.log('\n📚 Tables created:');
  console.log('  - app.reading_texts');
  console.log('  - app.reading_questions');
  console.log('  - app.reading_attempts');
  console.log('\n✅ You can now use the reading comprehension feature!');

} catch (error) {
  console.error('❌ Error applying migration:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  await sql.end();
}

