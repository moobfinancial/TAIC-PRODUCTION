// Script to find users with the 'user' role who have password authentication
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Use the same connection logic as in src/lib/db.ts
const connectionString = process.env.POSTGRES_URL;

let pool;

if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: (new URL(connectionString).hostname === 'localhost' || new URL(connectionString).hostname === '127.0.0.1') ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  });
} else {
  pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE,
    ssl: (process.env.PGHOST === 'localhost' || process.env.PGHOST === '127.0.0.1') ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  });
}

async function findUsers() {
  try {
    // Find users with role 'user' and who have a password_hash (not wallet_auth)
    const result = await pool.query(
      `SELECT id, email, username, password_hash, display_name, role, wallet_address 
       FROM users 
       WHERE role = 'user' 
       AND password_hash IS NOT NULL 
       AND password_hash != 'wallet_auth'`
    );

    if (result.rows.length === 0) {
      console.log('No users found with password authentication.');
      return;
    }

    console.log(`Found ${result.rows.length} users with password authentication:`);
    
    result.rows.forEach((user, index) => {
      console.log(`\nUser #${index + 1}:`);
      console.log('ID:', user.id);
      console.log('Email:', user.email);
      console.log('Username:', user.username);
      console.log('Display Name:', user.display_name);
      console.log('Role:', user.role);
      console.log('Wallet Address:', user.wallet_address || 'None');
      // Only show that password hash exists, not the actual hash for security
      console.log('Has Password Hash:', !!user.password_hash);
    });
  } catch (error) {
    console.error('Error finding users:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Find users
findUsers();
