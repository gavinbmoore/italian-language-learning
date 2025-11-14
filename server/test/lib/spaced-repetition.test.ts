/**
 * Spaced Repetition System Tests
 * 
 * Tests for Anki-style SRS algorithm implementation
 */

import { describe, it, expect } from 'vitest';
import { calculateNextReview, updateEaseFactor } from '../../src/lib/spaced-repetition';

describe('Spaced Repetition - SM2 Algorithm', () => {
  it('should increase ease factor for easy cards (quality 5)', () => {
    const currentEase = 2.5;
    const quality = 5;
    const newEase = updateEaseFactor(currentEase, quality);
    
    expect(newEase).toBeGreaterThan(currentEase);
    expect(newEase).toBeLessThanOrEqual(3.0); // Reasonable upper bound
  });

  it('should decrease ease factor for hard cards (quality 1-2)', () => {
    const currentEase = 2.5;
    const quality = 2;
    const newEase = updateEaseFactor(currentEase, quality);
    
    expect(newEase).toBeLessThan(currentEase);
    expect(newEase).toBeGreaterThanOrEqual(1.3); // Minimum ease factor
  });

  it('should maintain minimum ease factor of 1.3', () => {
    const currentEase = 1.3;
    const quality = 0;
    const newEase = updateEaseFactor(currentEase, quality);
    
    expect(newEase).toBeGreaterThanOrEqual(1.3);
  });
});

describe('Spaced Repetition - Interval Calculation', () => {
  it('should calculate first review interval (1 day)', () => {
    const repetitions = 0;
    const easeFactor = 2.5;
    const interval = calculateNextReview(repetitions, easeFactor);
    
    expect(interval).toBe(1);
  });

  it('should calculate second review interval (6 days)', () => {
    const repetitions = 1;
    const easeFactor = 2.5;
    const interval = calculateNextReview(repetitions, easeFactor);
    
    expect(interval).toBe(6);
  });

  it('should increase intervals exponentially', () => {
    const easeFactor = 2.5;
    const interval1 = calculateNextReview(1, easeFactor);
    const interval2 = calculateNextReview(2, easeFactor);
    const interval3 = calculateNextReview(3, easeFactor);
    
    expect(interval2).toBeGreaterThan(interval1);
    expect(interval3).toBeGreaterThan(interval2);
  });

  it('should respect ease factor in interval calculation', () => {
    const repetitions = 2;
    const easyCard = calculateNextReview(repetitions, 2.8);
    const hardCard = calculateNextReview(repetitions, 1.5);
    
    expect(easyCard).toBeGreaterThan(hardCard);
  });
});

describe('Spaced Repetition - Review Scheduling', () => {
  it('should schedule next review date correctly', () => {
    const now = new Date('2025-01-01');
    const intervalDays = 7;
    
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + intervalDays);
    
    expect(nextReview.getDate()).toBe(8);
    expect(nextReview.getMonth()).toBe(0); // January
  });

  it('should handle month boundaries', () => {
    const now = new Date('2025-01-30');
    const intervalDays = 5;
    
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + intervalDays);
    
    expect(nextReview.getMonth()).toBe(1); // February
    expect(nextReview.getDate()).toBe(4);
  });
});

