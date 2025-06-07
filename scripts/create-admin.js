const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
});

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function createAdminUser() {
  const apiKey = process.env.ADMIN_API_KEY || 'supersecretadminkey';
  const username = 'admin';
  const hashedApiKey = hashApiKey(apiKey);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete any existing admin user to avoid duplicates
    await client.query('DELETE FROM admin_users WHERE username = $1', [username]);
    
    // Insert the new admin user
    const result = await client.query(
      'INSERT INTO admin_users (username, hashed_api_key) VALUES ($1, $2) RETURNING id',
      [username, hashedApiKey]
    );
    
    await client.query('COMMIT');
    
    console.log('Admin user created successfully!');
    console.log(`Username: ${username}`);
    console.log(`API Key: ${apiKey}`);
    console.log('\nIMPORTANT: Keep this API key secure. It will not be shown again.\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating admin user:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Initialize database and create admin user
async function main() {
  try {
    // First run the init-db script
    const { execSync } = require('child_process');
    console.log('Initializing database...');
    execSync('node scripts/init-db.js', { stdio: 'inherit' });
    
    // Then create admin user
    console.log('\nCreating admin user...');
    await createAdminUser();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
