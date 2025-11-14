#!/usr/bin/env node

/**
 * Update Grammar Concepts with Custom Exercise Prompts
 * 
 * This script updates existing grammar concepts in the database
 * with custom exercise generation prompts from the seed data.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';

async function updateGrammarPrompts() {
  console.log('🔄 Updating grammar concepts with custom exercise prompts...\n');

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    // First, run the migration to add the column if it doesn't exist
    console.log('📝 Running migration to add exercise_generation_prompt column...');
    const migrationSQL = readFileSync(
      join(__dirname, '../drizzle/0012_add_custom_exercise_prompts.sql'),
      'utf-8'
    );
    await client.unsafe(migrationSQL);
    console.log('✅ Migration completed\n');

    // Load seed data
    console.log('📚 Loading grammar concepts seed data...');
    const seedDataPath = join(__dirname, '../src/data/grammar-concepts-seed.json');
    const seedData = JSON.parse(readFileSync(seedDataPath, 'utf-8'));
    console.log(`✅ Loaded ${seedData.length} concepts from seed data\n`);

    // Update concepts that have custom prompts
    let updatedCount = 0;
    let skippedCount = 0;

    for (const concept of seedData) {
      if (concept.exercise_generation_prompt) {
        console.log(`📝 Updating ${concept.name} (${concept.id})...`);
        
        const result = await client`
          UPDATE app.grammar_concepts
          SET 
            exercise_generation_prompt = ${concept.exercise_generation_prompt},
            updated_at = NOW()
          WHERE id = ${concept.id}
        `;

        if (result.count > 0) {
          console.log(`✅ Updated ${concept.name}`);
          updatedCount++;
        } else {
          console.log(`⚠️  Concept ${concept.id} not found in database`);
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log('\n📊 Update Summary:');
    console.log(`   ✅ Updated: ${updatedCount} concepts`);
    console.log(`   ⏭️  Skipped: ${skippedCount} concepts (no custom prompt)`);
    console.log('\n✨ Done! Custom exercise prompts have been updated.');

  } catch (error) {
    console.error('❌ Error updating grammar prompts:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the update
updateGrammarPrompts()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });

