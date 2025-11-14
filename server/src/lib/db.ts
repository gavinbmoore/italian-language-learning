import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as createDrizzlePostgres } from 'drizzle-orm/postgres-js';
import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';
import * as schema from '../schema/users';
import * as comprehensibleInputSchema from '../schema/comprehensible-input';
import * as grammarSchema from '../schema/grammar';

type DatabaseConnection = ReturnType<typeof drizzle> | ReturnType<typeof createDrizzlePostgres>;

// Use Map to cache connections per connection string (fixes race condition)
const connectionCache = new Map<string, DatabaseConnection>();

const isNeonDatabase = (connectionString: string): boolean => {
  return connectionString.includes('neon.tech') || connectionString.includes('neon.database');
};

const createConnection = async (connectionString: string): Promise<DatabaseConnection> => {
  const allSchemas = { ...schema, ...comprehensibleInputSchema, ...grammarSchema };
  
  if (isNeonDatabase(connectionString)) {
    const sql = neon(connectionString);
    return drizzle(sql, { schema: allSchemas });
  }

  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

  return createDrizzlePostgres(client, { schema: allSchemas });
};

// Get default connection string from environment
const getDefaultConnectionString = (): string => {
  // Note: Avoid hardcoded passwords in production
  return process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
};

export const getDatabase = async (connectionString?: string): Promise<DatabaseConnection> => {
  // Use default local database connection if no external connection string provided
  const connStr = connectionString || getDefaultConnectionString();

  if (!connStr) {
    throw new Error('No database connection available. Ensure database server is running or provide a connection string.');
  }

  // Check cache first
  if (connectionCache.has(connStr)) {
    return connectionCache.get(connStr)!;
  }

  // Create new connection and cache it
  const connection = await createConnection(connStr);
  connectionCache.set(connStr, connection);

  return connection;
};

export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const db = await getDatabase();
    await db.select().from(schema.users).limit(1);
    return true;
  } catch {
    return false;
  }
};

export const clearConnectionCache = (): void => {
  connectionCache.clear();
};