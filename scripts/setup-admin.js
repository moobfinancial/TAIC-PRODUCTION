const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

// Database connection configuration
const dbConfig = {
  user: 'moobuser',
  password: 'moobpassword',
  host: 'localhost',
  port: 5432,
  database: 'moobfinancial'
};

const pool = new Pool(dbConfig);

async function initDb() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create admin_users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        hashed_api_key VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Create index on hashed_api_key for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_hashed_api_key 
      ON admin_users(hashed_api_key);
    `);

    await client.query('COMMIT');
    console.log('✅ Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function createAdminUser() {
  const apiKey = 'supersecretadminkey'; // Using the same key from .env.local
  const username = 'admin';
  const hashedApiKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete any existing admin user to avoid duplicates
    await client.query('DELETE FROM admin_users WHERE username = $1', [username]);
    
    // Insert the new admin user
    await client.query(
      'INSERT INTO admin_users (username, hashed_api_key) VALUES ($1, $2) RETURNING id',
      [username, hashedApiKey]
    );
    
    await client.query('COMMIT');
    
    console.log('✅ Admin user created successfully!');
    console.log(`   Username: ${username}`);
    console.log(`   API Key: ${apiKey}`);
    console.log('\n🔐 IMPORTANT: Keep this API key secure. It will not be shown again.\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating admin user:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🚀 Starting admin setup...');
    
    // Initialize database
    await initDb();
    
    // Create admin user
    await createAdminUser();
    
    console.log('✨ Setup completed successfully!');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the setup
main().catch(console.error);
