/**
 * Test Setup File
 * 
 * Runs before all tests to set up the testing environment
 */

import { beforeAll, afterAll, vi } from 'vitest';
import 'dotenv/config';

// Mock environment variables for testing
beforeAll(() => {
  // Ensure we have test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  
  // Mock OpenAI API key if not present
  if (!process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = 'sk-test-mock-api-key-for-testing';
  }
  
  console.log('🧪 Test environment initialized');
});

afterAll(() => {
  console.log('✅ Test suite completed');
});

// Global test utilities
export function mockOpenAIResponse(response: any) {
  return vi.fn().mockResolvedValue(response);
}

export function mockDatabaseQuery(result: any) {
  return vi.fn().mockResolvedValue(result);
}

