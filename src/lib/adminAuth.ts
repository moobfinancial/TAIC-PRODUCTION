import { Pool } from 'pg';
import { sha256 } from './cryptoUtils';

// Initialize a connection pool for Node.js runtime only
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
  // Add SSL configuration if required for your DB
  // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Validate admin API key - this function is designed to run in Node.js runtime
export async function validateAdminApiKey(apiKey: string | null): Promise<{ valid: boolean; userId?: string; username?: string }> {
  if (!apiKey) {
    console.log('[AdminAuth] Admin API Key missing.');
    return { valid: false };
  }

  try {
    const hashedApiKey = await sha256(apiKey);
    const client = await pool.connect();
    
    try {
      const { rows } = await client.query(
        'SELECT id, username FROM admin_users WHERE hashed_api_key = $1',
        [hashedApiKey]
      );

      if (rows.length > 0) {
        console.log(`[AdminAuth] Admin API Key validated for user: ${rows[0].username}`);
        return { 
          valid: true,
          userId: rows[0].id,
          username: rows[0].username
        };
      } else {
        console.log('[AdminAuth] Invalid Admin API Key.');
        return { valid: false };
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[AdminAuth] Error validating API key:', error);
    return { valid: false };
  }
}
