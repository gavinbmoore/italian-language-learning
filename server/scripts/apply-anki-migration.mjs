#!/usr/bin/env node

/**
 * Apply the Anki deck import migration
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
    console.log('📖 Reading Anki migration file...');
    const migrationPath = join(__dirname, '../drizzle/0016_add_anki_decks.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('🔧 Applying Anki migration (creating 5 new tables)...');
    console.log('   - anki_decks');
    console.log('   - anki_notes');
    console.log('   - anki_cards');
    console.log('   - anki_card_state');
    console.log('   - anki_media');
    
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Anki migration applied successfully!');
    console.log('🎉 You can now import Anki decks!');

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

