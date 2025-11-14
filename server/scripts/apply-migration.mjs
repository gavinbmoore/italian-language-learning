#!/usr/bin/env node

/**
 * Apply the grammar rules migration
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5702/postgres';

console.log('🔗 Connecting to database...');
const sql = postgres(DATABASE_URL, { max: 1 });

async function main() {
  try {
    console.log('📖 Reading migration file...');
    const migrationPath = join(__dirname, '../drizzle/0015_restructure_grammar_rules.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('🔧 Applying migration...');
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration applied successfully!');

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

