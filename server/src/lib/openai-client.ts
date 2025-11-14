/**
 * Shared OpenAI Client
 * 
 * Single source of truth for OpenAI API client initialization.
 * All OpenAI interactions should use this shared client to ensure:
 * - Consistent configuration
 * - No duplicate initialization
 * - Centralized error handling
 * - Easy testing and mocking
 */

import OpenAI from 'openai';
import { getEnv } from './env';

// Singleton OpenAI client instance
let openaiClient: OpenAI | null = null;

/**
 * Get the shared OpenAI client instance
 * Creates the client lazily on first use
 * 
 * @throws {Error} If OPENAI_API_KEY is not set in environment
 * @returns {OpenAI} The OpenAI client instance
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    // Try getEnv first, then fallback to process.env directly
    const apiKey = getEnv('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not found in environment variables');
      console.error('Available env keys:', Object.keys(process.env).filter(k => k.includes('OPENAI')));
      throw new Error('OPENAI_API_KEY environment variable is not set. Please add it to your .env file.');
    }
    
    console.log('✅ OpenAI API key loaded successfully');
    openaiClient = new OpenAI({ apiKey });
  }
  
  return openaiClient;
}

/**
 * Reset the OpenAI client (useful for testing)
 * This allows tests to reinitialize the client with mock credentials
 */
export function resetOpenAIClient(): void {
  openaiClient = null;
}

/**
 * Test OpenAI connection
 * Sends a minimal API call to verify the client is working
 * 
 * @returns {Promise<boolean>} True if connection successful, false otherwise
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5,
    });
    
    return !!response.choices[0]?.message;
  } catch (error) {
    console.error('❌ OpenAI connection test failed:', error);
    return false;
  }
}

/**
 * Common OpenAI model configurations
 * Use these constants for consistency across the application
 */
export const OPENAI_MODELS = {
  /**
   * GPT-4o Mini - Fast and cost-effective
   * Best for: Conversation, simple translations, flashcard generation
   */
  FAST: 'gpt-4o-mini',
  
  /**
   * GPT-4o - Highest quality
   * Best for: Complex grammar analysis, detailed explanations, content generation
   */
  QUALITY: 'gpt-4o',
} as const;

/**
 * Common temperature settings for different use cases
 */
export const OPENAI_TEMPERATURES = {
  /**
   * Precise and deterministic (0.2-0.4)
   * Use for: Grammar correction, translation, factual responses
   */
  PRECISE: 0.3,
  
  /**
   * Balanced creativity and consistency (0.5-0.7)
   * Use for: Conversation, content generation, explanations
   */
  BALANCED: 0.6,
  
  /**
   * Creative and varied (0.8-1.0)
   * Use for: Story generation, diverse examples, creative exercises
   */
  CREATIVE: 0.8,
} as const;

