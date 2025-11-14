#!/usr/bin/env node

/**
 * Export Grammar Concepts from Database
 * 
 * Exports Italian grammar concepts from the database back to JSON
 */

import { writeFileSync } from 'fs';
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
  max: 1,
});

async function main() {
  try {
    console.log('📖 Reading grammar concepts from database...');
    
    const concepts = await sql`
      SELECT 
        id, name, name_italian, category, cefr_level,
        description, rules, explanation_italian, examples, common_mistakes,
        practice_focus, related_concepts, importance, exercise_generation_prompt
      FROM app.grammar_concepts
      ORDER BY cefr_level, category, id
    `;
    
    console.log(`📝 Found ${concepts.length} grammar concepts in database`);

    if (concepts.length === 0) {
      console.log('⚠️  No concepts found in database');
      process.exit(0);
    }

    // Convert to JSON format
    const jsonData = concepts.map(c => ({
      id: c.id,
      name: c.name,
      name_italian: c.name_italian,
      category: c.category,
      cefr_level: c.cefr_level,
      description: c.description,
      rules: c.rules,
      explanation_italian: c.explanation_italian || undefined,
      examples: c.examples || [],
      common_mistakes: c.common_mistakes || [],
      practice_focus: c.practice_focus || [],
      related_concepts: c.related_concepts || [],
      exercise_generation_prompt: c.exercise_generation_prompt || undefined,
      importance: c.importance
    }));

    const outputPath = join(__dirname, '../src/data/grammar-concepts-exported.json');
    writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');

    console.log(`✅ Exported ${jsonData.length} concepts to grammar-concepts-exported.json`);

  } catch (error) {
    console.error('❌ Error exporting grammar concepts:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

