// Script to check user information in the database
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

async function checkUser(email) {
  try {
    const result = await pool.query(
      'SELECT id, email, username, password_hash, display_name, role, wallet_address FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      console.log(`User with email ${email} not found in the database.`);
      return;
    }

    const user = result.rows[0];
    console.log('User found:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Username:', user.username);
    console.log('Display Name:', user.display_name);
    console.log('Role:', user.role);
    console.log('Wallet Address:', user.wallet_address || 'None');
    console.log('Password Hash:', user.password_hash || 'None');
  } catch (error) {
    console.error('Error checking user:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Check the user with email dwainabrown@gmail.com
checkUser('dwainabrown@gmail.com');
