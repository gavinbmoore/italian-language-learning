#!/usr/bin/env node

/**
 * Seed Grammar Concepts
 * 
 * Loads Italian grammar concepts from JSON into the database
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or POSTGRES_URL environment variable not set');
  process.exit(1);
}

console.log('🔗 Connecting to database...');
const sql = postgres(DATABASE_URL, {
  max: 1, // Single connection for seeding
});

async function main() {
  try {
    console.log('📖 Reading grammar concepts seed data...');
    const seedDataPath = join(__dirname, '../src/data/grammar-concepts-seed.json');
    const seedData = JSON.parse(readFileSync(seedDataPath, 'utf-8'));
    
    console.log(`📝 Found ${seedData.length} grammar concepts to seed`);

    // Check if concepts already exist
    const existing = await sql`
      SELECT COUNT(*) as count FROM app.grammar_concepts
    `;
    
    const existingCount = parseInt(existing[0].count);
    
    if (existingCount > 0) {
      console.log(`⚠️  Database already contains ${existingCount} grammar concepts`);
      console.log('   This script will add new concepts and update existing ones.');
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('   Continue? (y/n): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Aborted');
        process.exit(0);
      }
    }

    console.log('💾 Inserting grammar concepts...');
    let insertedCount = 0;
    let updatedCount = 0;

    for (const concept of seedData) {
      try {
        // Try to insert, or update if exists
        const result = await sql`
          INSERT INTO app.grammar_concepts (
            id, name, name_italian, category, cefr_level,
            description, rules, explanation_italian, examples, common_mistakes,
            practice_focus, related_concepts, importance, exercise_generation_prompt, created_at, updated_at
          ) VALUES (
            ${concept.id},
            ${concept.name},
            ${concept.name_italian},
            ${concept.category},
            ${concept.cefr_level},
            ${concept.description},
            ${concept.rules || null},
            ${concept.explanation_italian || null},
            ${JSON.stringify(concept.examples || [])}::jsonb,
            ${JSON.stringify(concept.common_mistakes || [])}::jsonb,
            ${concept.practice_focus || []}::text[],
            ${concept.related_concepts || []}::text[],
            ${concept.importance || 5},
            ${concept.exercise_generation_prompt || null},
            NOW(),
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            name_italian = EXCLUDED.name_italian,
            category = EXCLUDED.category,
            cefr_level = EXCLUDED.cefr_level,
            description = EXCLUDED.description,
            rules = EXCLUDED.rules,
            explanation_italian = EXCLUDED.explanation_italian,
            examples = EXCLUDED.examples,
            common_mistakes = EXCLUDED.common_mistakes,
            practice_focus = EXCLUDED.practice_focus,
            related_concepts = EXCLUDED.related_concepts,
            importance = EXCLUDED.importance,
            exercise_generation_prompt = EXCLUDED.exercise_generation_prompt,
            updated_at = NOW()
          RETURNING (xmax = 0) as inserted
        `;
        
        if (result[0].inserted) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing concept ${concept.id}:`, error.message);
      }
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   📊 Inserted: ${insertedCount} new concepts`);
    console.log(`   🔄 Updated: ${updatedCount} existing concepts`);
    console.log(`   📝 Total: ${insertedCount + updatedCount} concepts in database`);

    // Verify by counting
    const final = await sql`
      SELECT COUNT(*) as count FROM app.grammar_concepts
    `;
    console.log(`   ✓ Verified: ${final[0].count} total concepts in database`);

  } catch (error) {
    console.error('❌ Error seeding grammar concepts:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

