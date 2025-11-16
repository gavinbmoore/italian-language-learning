#!/usr/bin/env node

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

async function main() {
  try {
    const migrationsDir = join(__dirname, '../drizzle');
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📦 Applying ${files.length} migrations...`);

    for (const file of files) {
      console.log(`   → ${file}`);
      const migrationSQL = readFileSync(join(migrationsDir, file), 'utf-8');
      try {
        await sql.unsafe(migrationSQL);
        console.log(`   ✅ ${file}`);
      } catch (error) {
        if (error.message?.includes('already exists')) {
          console.log(`   ⏭️  ${file} (already applied)`);
        } else {
          console.error(`   ❌ ${file}: ${error.message}`);
        }
      }
    }

    console.log('✅ All migrations applied!');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

