/**
 * Cross-platform environment variable utilities
 * Works with both Node.js (process.env) and Cloudflare Workers (c.env)
 */

type EnvLike = Record<string, string | undefined>;

let contextEnv: EnvLike | null = null;

export function setEnvContext(env: any) {
  contextEnv = env;
}

export function clearEnvContext() {
  contextEnv = null;
}

function getEnvSource(): EnvLike {
  // Always fallback to process.env if contextEnv is not set
  // This ensures environment variables are accessible even before middleware runs
  return contextEnv || (typeof process !== 'undefined' ? process.env : {});
}

/**
 * Get environment variable with fallback support
 * Works in both Node.js and Cloudflare Workers environments
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  const value = getEnvSource()[key];
  return value !== undefined ? value : defaultValue;
}

/**
 * Get required environment variable, throws if missing
 */
export function getRequiredEnv(key: string): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Check if we're in development mode
 * Works across Node.js and Cloudflare Workers
 */
export function isDevelopment(): boolean {
  return getEnv('NODE_ENV') === 'development' || 
         getEnv('FIREBASE_AUTH_EMULATOR_HOST') !== undefined;
}

/**
 * Get database URL from environment
 */
export function getDatabaseUrl(): string | undefined {
  return getEnv('DATABASE_URL');
}

/**
 * Check if DATABASE_URL points to local PostgreSQL database server
 */
export function isLocalEmbeddedPostgres(): boolean {
  const dbUrl = getDatabaseUrl();
  // Check if it's a localhost PostgreSQL connection (local database server)
  return dbUrl ? (dbUrl.includes('localhost:') && dbUrl.includes('postgres:password')) : false;
}

/**
 * Get Firebase project ID from environment
 */
export function getFirebaseProjectId(): string {
  return getRequiredEnv('FIREBASE_PROJECT_ID');
}

/**
 * Check if anonymous users are allowed
 * Defaults to true if not explicitly set to 'false'
 */
export function getAllowAnonymousUsers(): boolean {
  return getEnv('ALLOW_ANONYMOUS_USERS') !== 'false';
}

/**
 * For Node.js environments - get process.env
 */
export function getNodeEnv() {
  return process.env;
}

/**
 * Type guard to check if we're in a Cloudflare Workers environment
 */
export function isCloudflareEnv(source: EnvLike): boolean {
  // In Cloudflare Workers, process.env is not available or is empty
  return typeof process === 'undefined' || Object.keys(process.env).length === 0;
}

/**
 * Validate required environment variables at startup
 * Throws an error if any required variables are missing
 */
export function validateEnvironment(): void {
  const requiredVars = [
    'OPENAI_API_KEY',
    'FIREBASE_PROJECT_ID',
  ] as const;
  
  const missing: string[] = [];
  
  for (const varName of requiredVars) {
    if (!getEnv(varName)) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  - ${missing.join('\n  - ')}\n\n` +
      'Please ensure these variables are set in your .env file or environment.'
    );
  }
  
  // Warn about missing optional but recommended variables
  const recommendedVars = ['DATABASE_URL'] as const;
  const missingRecommended: string[] = [];
  
  for (const varName of recommendedVars) {
    if (!getEnv(varName)) {
      missingRecommended.push(varName);
    }
  }
  
  if (missingRecommended.length > 0) {
    console.warn(
      `⚠️  Missing recommended environment variables:\n  - ${missingRecommended.join('\n  - ')}\n` +
      'The application will use default values, which may not be suitable for production.'
    );
  }
  
  console.log('✅ Environment variables validated successfully');
} 