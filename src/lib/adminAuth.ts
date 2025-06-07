import { Pool } from 'pg';
import { createHash } from 'crypto';

// This module is primarily used server-side, so direct imports are appropriate.
// The serverOnly() call and serverRequire were likely causing bundling issues for 'pg'.

// Log database connection details (without password)
const dbConfig = {
  user: process.env.PGUSER || 'moobuser',
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || '5432',
  database: process.env.PGDATABASE || 'moobfinancial'
};

console.log('[AdminAuth] Database config:', {
  ...dbConfig,
  // Don't log the actual password
  password: process.env.PGPASSWORD ? '***' : 'not set'
});

// Initialize a connection pool for Node.js runtime only
const connectionString = process.env.POSTGRES_URL ||
  `postgresql://${process.env.PGUSER || 'moobuser'}:${process.env.PGPASSWORD || 'moobpassword'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'moobfinancial'}`;

console.log('[AdminAuth] Creating database connection pool...');
console.log(`[AdminAuth] Connection string: ${connectionString.replace(/:([^:]*?)@/, ':***@')}`);

const pool = new Pool({
  connectionString,
  // Add SSL configuration if required for your DB
  // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Log pool events for debugging
pool.on('connect', () => {
  console.log('[AdminAuth] Database client connected');
});

pool.on('error', (err) => {
  console.error('[AdminAuth] Database pool error:', err);
});

// Simple synchronous SHA-256 hashing using Node.js crypto
function hashApiKey(apiKey: string): string {
  console.log(`[AdminAuth] Hashing API key (first 4 chars: ${apiKey.substring(0, 4)}...)`);
  const hash = createHash('sha256').update(apiKey).digest('hex');
  console.log(`[AdminAuth] Hashed API key: ${hash.substring(0, 8)}...`);
  return hash;
}

// Validate admin API key - this function is designed to run in Node.js runtime
export async function validateAdminApiKey(apiKey: string | null): Promise<{ valid: boolean; userId?: string; username?: string }> {
  console.log('[AdminAuth] ===== Starting API key validation =====');
  console.log(`[AdminAuth] API key provided: ${apiKey ? 'Yes' : 'No'}`);
  
  if (!apiKey) {
    console.log('[AdminAuth] Error: No API key provided');
    return { valid: false };
  }

  try {
    const hashedApiKey = hashApiKey(apiKey);
    console.log(`[AdminAuth] API key hashed successfully: ${hashedApiKey.substring(0, 8)}...`);
    
    console.log('[AdminAuth] Attempting to get a client from the pool...');
    const client = await pool.connect();
    console.log('[AdminAuth] Successfully acquired client from pool');
    
    try {
      console.log('[AdminAuth] Executing query to find admin user...');
      const query = 'SELECT id, username FROM admin_users WHERE hashed_api_key = $1';
      console.log(`[AdminAuth] Query: ${query}`);
      console.log(`[AdminAuth] Parameter count: 1`);
      console.log(`[AdminAuth] Parameter 1 (hashed_api_key): ${hashedApiKey}`);
      
      const { rows } = await client.query(query, [hashedApiKey]);
      console.log(`[AdminAuth] Query returned ${rows.length} rows`);

      if (rows.length > 0) {
        console.log(`[AdminAuth] ✅ Valid API key for user: ${rows[0].username}`);
        return { 
          valid: true,
          userId: rows[0].id,
          username: rows[0].username
        };
      } else {
        console.log('[AdminAuth] ❌ Invalid API key - no matching user found');
        // Let's check if there are any users in the table at all
        const countResult = await client.query('SELECT COUNT(*) FROM admin_users');
        console.log(`[AdminAuth] Total admin users in database: ${countResult.rows[0].count}`);
        return { valid: false };
      }
    } catch (error) {
      console.error('[AdminAuth] ❌ Database query error:', error);
      throw error; // Re-throw to be caught by the outer catch
    } finally {
      client.release();
      console.log('[AdminAuth] Database connection released');
    }
  } catch (error) {
    console.error('[AdminAuth] ❌ Error validating API key:', error);
    return { valid: false };
  }
}
