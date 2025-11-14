#!/usr/bin/env node
/**
 * Verify comprehensive grammar data was loaded
 */

import postgres from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';

const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
});

try {
  console.log('🔍 Verifying comprehensive grammar data...\n');
  
  // Check if rules column exists and has data
  const conceptsWithRules = await sql`
    SELECT COUNT(*) as count 
    FROM app.grammar_concepts 
    WHERE rules IS NOT NULL AND rules != ''
  `;
  
  const conceptsWithPracticeFocus = await sql`
    SELECT COUNT(*) as count 
    FROM app.grammar_concepts 
    WHERE practice_focus IS NOT NULL AND array_length(practice_focus, 1) > 0
  `;
  
  const totalConcepts = await sql`
    SELECT COUNT(*) as count FROM app.grammar_concepts
  `;
  
  console.log(`📊 Total concepts: ${totalConcepts[0].count}`);
  console.log(`📝 Concepts with rules: ${conceptsWithRules[0].count}`);
  console.log(`🎯 Concepts with practice focus: ${conceptsWithPracticeFocus[0].count}`);
  
  // Sample a concept to verify data quality
  const sample = await sql`
    SELECT id, name, 
           LEFT(rules, 150) as rules_preview,
           practice_focus
    FROM app.grammar_concepts 
    WHERE rules IS NOT NULL 
    LIMIT 1
  `;
  
  if (sample.length > 0) {
    console.log('\n✅ Sample concept verification:');
    console.log(`   ID: ${sample[0].id}`);
    console.log(`   Name: ${sample[0].name}`);
    console.log(`   Rules preview: ${sample[0].rules_preview}...`);
    console.log(`   Practice focus: ${sample[0].practice_focus?.join(', ')}`);
  }
  
  console.log('\n🎉 Verification complete!');

} catch (error) {
  console.error('❌ Error verifying data:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}

