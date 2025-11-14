#!/usr/bin/env node

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

console.log('🔗 Connecting to database...');
const sql = postgres(DATABASE_URL, { max: 1 });

async function main() {
  try {
    const drizzlePath = join(__dirname, '../drizzle');
    const files = readdirSync(drizzlePath)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`📖 Found ${files.length} migration files\n`);

    for (const file of files) {
      console.log(`⚙️  Applying ${file}...`);
      const migrationSQL = readFileSync(join(drizzlePath, file), 'utf-8');
      
      try {
        await sql.unsafe(migrationSQL);
        console.log(`   ✅ ${file} applied\n`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ⏭️  ${file} already applied\n`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations completed!');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

