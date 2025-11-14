#!/usr/bin/env node

/**
 * Transform Grammar Rules to Structured Format
 * 
 * Converts text-based rules to structured RuleBlock arrays
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Transform a text rules string into structured RuleBlock array
 * This is a heuristic-based transformation
 */
function transformRules(rulesText) {
  if (!rulesText || typeof rulesText !== 'string') {
    return null;
  }

  const rules = [];
  
  // Split by sentence endings to get paragraphs
  const sentences = rulesText.split(/\.\s+/).filter(s => s.trim());
  
  let currentParagraph = [];
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    
    // Check if this looks like a list item pattern (contains : or specific indicators)
    if (trimmed.includes(':') && (trimmed.toLowerCase().includes('pattern') || 
                                   trimmed.toLowerCase().includes('example') ||
                                   trimmed.toLowerCase().includes('conjugation'))) {
      // Flush current paragraph
      if (currentParagraph.length > 0) {
        rules.push({
          type: 'paragraph',
          content: currentParagraph.join('. ') + '.'
        });
        currentParagraph = [];
      }
      
      // Extract list items if present
      const parts = trimmed.split(':');
      if (parts.length >= 2) {
        const header = parts[0].trim();
        const content = parts.slice(1).join(':').trim();
        
        rules.push({
          type: 'heading',
          content: header,
          level: 3
        });
        
        // Check if content has list-like structure
        if (content.includes(',') && content.length > 100) {
          const items = content.split(/[,;]\s*/).filter(i => i.trim() && i.length > 3);
          if (items.length > 2) {
            rules.push({
              type: 'list',
              ordered: false,
              content: items.map(i => i.trim() + (i.endsWith('.') ? '' : ''))
            });
          } else {
            rules.push({
              type: 'paragraph',
              content: content + (content.endsWith('.') ? '' : '.')
            });
          }
        } else {
          rules.push({
            type: 'paragraph',
            content: content + (content.endsWith('.') ? '' : '.')
          });
        }
      }
    } else {
      // Add to current paragraph
      currentParagraph.push(trimmed);
    }
  }
  
  // Flush remaining paragraph
  if (currentParagraph.length > 0) {
    rules.push({
      type: 'paragraph',
      content: currentParagraph.join('. ') + '.'
    });
  }
  
  // If we ended up with just one paragraph, keep it simple
  if (rules.length === 1 && rules[0].type === 'paragraph') {
    return rules;
  }
  
  // If no rules were created, return simple paragraph
  if (rules.length === 0) {
    return [{
      type: 'paragraph',
      content: rulesText
    }];
  }
  
  return rules;
}

async function main() {
  try {
    console.log('📖 Reading exported grammar concepts...');
    const inputPath = join(__dirname, '../src/data/grammar-concepts-exported.json');
    const concepts = JSON.parse(readFileSync(inputPath, 'utf-8'));
    
    console.log(`📝 Processing ${concepts.length} grammar concepts...`);

    // Transform each concept
    const transformed = concepts.map(concept => {
      // Parse examples and common_mistakes if they're strings
      let examples = concept.examples;
      let common_mistakes = concept.common_mistakes;
      
      if (typeof examples === 'string') {
        try {
          examples = JSON.parse(examples);
        } catch (e) {
          console.warn(`Warning: Could not parse examples for ${concept.id}`);
        }
      }
      
      if (typeof common_mistakes === 'string') {
        try {
          common_mistakes = JSON.parse(common_mistakes);
        } catch (e) {
          console.warn(`Warning: Could not parse common_mistakes for ${concept.id}`);
        }
      }
      
      return {
        ...concept,
        rules: transformRules(concept.rules),
        examples,
        common_mistakes
      };
    });

    const outputPath = join(__dirname, '../src/data/grammar-concepts-seed.json');
    writeFileSync(outputPath, JSON.stringify(transformed, null, 2), 'utf-8');

    console.log(`✅ Transformed and saved ${transformed.length} concepts to grammar-concepts-seed.json`);
    console.log(`   Note: This is an automatic transformation. Manual review and enhancement is recommended.`);

  } catch (error) {
    console.error('❌ Error transforming grammar concepts:', error);
    process.exit(1);
  }
}

main();

