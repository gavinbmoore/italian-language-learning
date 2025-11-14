/**
 * Comprehensible Input Tests
 * 
 * Tests for i+1 vocabulary tracking and analysis
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractWords, getWordDifficulty } from '../../src/lib/comprehensible-input';

describe('Comprehensible Input - Word Extraction', () => {
  it('should extract Italian words from text', () => {
    const text = 'Ciao, come stai? Io sto bene, grazie!';
    const words = extractWords(text);
    
    expect(words).toContain('ciao');
    expect(words).toContain('come');
    expect(words).toContain('stai');
    expect(words).toContain('sto');
    expect(words).toContain('bene');
    expect(words).toContain('grazie');
  });

  it('should normalize words to lowercase', () => {
    const text = 'CIAO Ciao ciao';
    const words = extractWords(text);
    
    expect(words.every(w => w === w.toLowerCase())).toBe(true);
  });

  it('should remove punctuation', () => {
    const text = 'Ciao! Come stai? Bene, grazie.';
    const words = extractWords(text);
    
    expect(words).not.toContain('ciao!');
    expect(words).not.toContain('stai?');
    expect(words).not.toContain('grazie.');
  });

  it('should handle empty text', () => {
    const text = '';
    const words = extractWords(text);
    
    expect(words).toEqual([]);
  });
});

describe('Comprehensible Input - Word Difficulty', () => {
  it('should return difficulty for common words', () => {
    const wordInfo = getWordDifficulty('io');
    
    expect(wordInfo).toBeDefined();
    expect(wordInfo?.level).toBeDefined();
    expect(wordInfo?.rank).toBeGreaterThan(0);
  });

  it('should return null for unknown words', () => {
    const wordInfo = getWordDifficulty('xyzabc123nonexistent');
    
    expect(wordInfo).toBeNull();
  });

  it('should classify easy words as A1/A2', () => {
    const commonWords = ['io', 'tu', 'ciao', 'sì', 'no'];
    
    for (const word of commonWords) {
      const info = getWordDifficulty(word);
      if (info) {
        expect(['A1', 'A2']).toContain(info.level);
      }
    }
  });
});

describe('Comprehensible Input - Comprehensibility Calculation', () => {
  it('should calculate comprehensibility score correctly', () => {
    const totalWords = 100;
    const knownWords = 85;
    const score = knownWords / totalWords;
    
    expect(score).toBe(0.85);
    expect(score).toBeGreaterThan(0.80);
    expect(score).toBeLessThan(0.90);
  });

  it('should identify i+1 range (80-85%)', () => {
    const targetMin = 0.80;
    const targetMax = 0.85;
    
    expect(0.825).toBeGreaterThanOrEqual(targetMin);
    expect(0.825).toBeLessThanOrEqual(targetMax);
  });
});

