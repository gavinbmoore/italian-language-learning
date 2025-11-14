import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './api';
import { getEnv, getDatabaseUrl, isLocalEmbeddedPostgres, validateEnvironment } from './lib/env';

// Parse CLI arguments
const parseCliArgs = () => {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  
  return {
    port: portIndex !== -1 ? parseInt(args[portIndex + 1]) : parseInt(getEnv('PORT', '8787')!),
  };
};

const { port } = parseCliArgs();

// Extract PostgreSQL port from DATABASE_URL if it's a local embedded postgres connection
const getPostgresPortFromDatabaseUrl = (): number => {
  const dbUrl = getDatabaseUrl();
  if (dbUrl && dbUrl.includes('localhost:')) {
    const match = dbUrl.match(/localhost:(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
  }
  return 5433; // fallback default
};

const startServer = async () => {
  // Validate environment variables before starting
  try {
    console.log('🔍 Validating environment variables...');
    validateEnvironment();
    
    // Confirm OpenAI API key is loaded (without exposing the full key)
    const openaiKey = getEnv('OPENAI_API_KEY');
    if (openaiKey) {
      console.log(`✅ OPENAI_API_KEY loaded (${openaiKey.substring(0, 8)}...)`);
    } else {
      console.error('⚠️  OPENAI_API_KEY not found in environment');
    }
  } catch (error) {
    console.error('❌ Environment validation failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
  
  console.log(`🚀 Starting backend server on port ${port}`);
  
  if (!getDatabaseUrl() || isLocalEmbeddedPostgres()) {
    console.log('🔗 Using local database connection (expecting database server on dynamic port)');
  } else {
    console.log('🔗 Using external database connection');
  }

  serve({
    fetch: app.fetch,
    port,
  });
};

// Graceful shutdown
const shutdown = async () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer(); 