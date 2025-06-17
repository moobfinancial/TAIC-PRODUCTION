// Script to create a new shopper user with email/password authentication
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
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

async function createShopperUser() {
  try {
    // User details
    const id = uuidv4();
    const email = 'test.shopper@example.com';
    const username = 'testshopper';
    const displayName = 'Test Shopper';
    const role = 'shopper';
    const password = 'Password123!'; // Clear text password
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Check if user already exists
    const checkResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (checkResult.rows.length > 0) {
      console.log(`User with email ${email} already exists. Updating password...`);
      
      // Update existing user
      await pool.query(
        'UPDATE users SET password_hash = $1, username = $2, display_name = $3, role = $4 WHERE email = $5',
        [passwordHash, username, displayName, role, email]
      );
      
      console.log('User updated successfully!');
    } else {
      // Insert new user
      await pool.query(
        'INSERT INTO users (id, email, username, password_hash, display_name, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
        [id, email, username, passwordHash, displayName, role]
      );
      
      console.log('New shopper user created successfully!');
    }
    
    console.log('\nShopper User Details:');
    console.log('Email:', email);
    console.log('Username:', username);
    console.log('Password:', password);
    console.log('Role:', role);
    console.log('\nYou can now test login with these credentials.');
    
  } catch (error) {
    console.error('Error creating shopper user:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Create a new shopper user
createShopperUser();
