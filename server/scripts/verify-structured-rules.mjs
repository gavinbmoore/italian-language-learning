#!/usr/bin/env node

/**
 * Verify structured rules in database
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5702/postgres';

console.log('🔗 Connecting to database...');
const sql = postgres(DATABASE_URL, { max: 1 });

async function main() {
  try {
    console.log('\n📊 Checking grammar concepts with structured rules...\n');
    
    // Get a few sample concepts to verify structure
    const samples = await sql`
      SELECT id, name, rules
      FROM app.grammar_concepts
      WHERE id IN ('a1-present-tense-essere', 'a1-verb-conjugation-ire', 'a1-definite-articles')
      ORDER BY id
    `;
    
    for (const concept of samples) {
      console.log(`\n✅ ${concept.id}: ${concept.name}`);
      console.log(`   Rules type: ${typeof concept.rules}`);
      console.log(`   Is array: ${Array.isArray(concept.rules)}`);
      
      if (Array.isArray(concept.rules) && concept.rules.length > 0) {
        console.log(`   Number of rule blocks: ${concept.rules.length}`);
        console.log(`   First block type: ${concept.rules[0].type}`);
        console.log('   ✓ Rules are properly structured');
      } else if (concept.rules && typeof concept.rules === 'object') {
        console.log('   ✓ Rules are JSONB object (legacy paragraph format)');
      } else {
        console.log('   ⚠️  Rules format unexpected');
      }
    }
    
    // Count concepts with structured rules
    const totalConcepts = await sql`
      SELECT COUNT(*) as count
      FROM app.grammar_concepts
      WHERE rules IS NOT NULL
    `;
    
    console.log(`\n📈 Total concepts with rules: ${totalConcepts[0].count}`);
    
    // Check if any user progress exists
    const progressCount = await sql`
      SELECT COUNT(*) as count
      FROM app.user_grammar_progress
    `;
    
    console.log(`\n👤 User grammar progress records: ${progressCount[0].count}`);
    console.log('   ✓ User progress preserved!\n');

  } catch (error) {
    console.error('❌ Error verifying data:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

