const { Pool } = require('pg');
const crypto = require('crypto');

// Database connection configuration from .env.local
const dbConfig = {
  connectionString: 'postgresql://moobuser:moobpassword@localhost:5432/moobfinancial'
};

const pool = new Pool(dbConfig);

async function setupAdmin() {
  const client = await pool.connect();
  
  try {
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

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_hashed_api_key 
      ON admin_users(hashed_api_key);
    `);

    // Insert admin user with the API key from .env
    const apiKey = 'supersecretadminkey';
    const username = 'admin';
    const hashedApiKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Delete any existing admin user to avoid duplicates
    await client.query('DELETE FROM admin_users WHERE username = $1', [username]);
    
    // Insert the new admin user
    await client.query(
      'INSERT INTO admin_users (username, hashed_api_key) VALUES ($1, $2)',
      [username, hashedApiKey]
    );

    console.log('✅ Admin user created successfully!');
    console.log('   Username: admin');
    console.log('   API Key: supersecretadminkey');
    console.log('\n🔐 IMPORTANT: Keep this API key secure. It will not be shown again.\n');
    
  } catch (error) {
    console.error('❌ Error setting up admin:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup
setupAdmin().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
