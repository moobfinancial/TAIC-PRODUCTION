// Script to check all available roles in the database
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

async function checkRoles() {
  try {
    // Get all distinct roles
    const rolesResult = await pool.query('SELECT DISTINCT role FROM users');
    
    console.log('Available roles in the database:');
    rolesResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.role || 'NULL'}`);
    });
    
    // Count users by role
    const countResult = await pool.query('SELECT role, COUNT(*) FROM users GROUP BY role');
    
    console.log('\nUser count by role:');
    countResult.rows.forEach(row => {
      console.log(`${row.role || 'NULL'}: ${row.count} users`);
    });
    
    // Check for users with password authentication by role
    const passwordAuthResult = await pool.query(`
      SELECT role, COUNT(*) 
      FROM users 
      WHERE password_hash IS NOT NULL 
      AND password_hash != 'wallet_auth'
      GROUP BY role
    `);
    
    console.log('\nUsers with password authentication by role:');
    passwordAuthResult.rows.forEach(row => {
      console.log(`${row.role || 'NULL'}: ${row.count} users`);
    });
    
    // Get a sample of users with password authentication
    const sampleResult = await pool.query(`
      SELECT id, email, username, role, password_hash IS NOT NULL AS has_password
      FROM users
      WHERE password_hash IS NOT NULL 
      AND password_hash != 'wallet_auth'
      LIMIT 5
    `);
    
    if (sampleResult.rows.length > 0) {
      console.log('\nSample users with password authentication:');
      sampleResult.rows.forEach((user, index) => {
        console.log(`\nUser #${index + 1}:`);
        console.log('Email:', user.email);
        console.log('Username:', user.username);
        console.log('Role:', user.role);
        console.log('Has Password:', user.has_password);
      });
    }
    
  } catch (error) {
    console.error('Error checking roles:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Check roles
checkRoles();
