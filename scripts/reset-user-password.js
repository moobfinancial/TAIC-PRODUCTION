// Script to reset the password for a user account
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
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

async function resetUserPassword(email, newPassword) {
  try {
    // Check if user exists
    const checkResult = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (checkResult.rows.length === 0) {
      console.log(`User with email ${email} not found in the database.`);
      return;
    }
    
    const user = checkResult.rows[0];
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    
    // Update the user's password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [passwordHash, email.toLowerCase()]
    );
    
    console.log(`Password reset successful for user ${email} (${user.role} role).`);
    console.log('\nNew login credentials:');
    console.log('Email:', email);
    console.log('Password:', newPassword);
    console.log('\nYou can now test login with these credentials.');
    
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Reset password for a user with role 'user'
// Replace with the email of the user you want to reset and the new password
resetUserPassword('dwainabrown24@gmail.com', 'Password123!');
