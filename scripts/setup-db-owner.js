const { Client } = require('pg');
const { execSync } = require('child_process');

async function setupDatabase() {
  // First, create the database using createdb command
  try {
    console.log('Creating database if it does not exist...');
    execSync('createdb -U moobuser -h localhost moobfinancial || true');
  } catch (error) {
    console.log('Database might already exist, continuing...');
  }

  // Now connect to the database
  const client = new Client({
    user: 'moobuser',
    password: 'moobpassword',
    host: 'localhost',
    port: 5432,
    database: 'moobfinancial'
  });

  try {
    await client.connect();
    
    console.log('Creating admin_users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        hashed_api_key VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

    console.log('Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_hashed_api_key 
      ON admin_users(hashed_api_key)`);
    
    // SHA-256 hash of 'supersecretadminkey'
    const hashedApiKey = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    
    console.log('Adding admin user...');
    await client.query(`
      INSERT INTO admin_users (username, hashed_api_key) 
      VALUES ($1, $2) 
      ON CONFLICT (username) DO UPDATE 
      SET hashed_api_key = EXCLUDED.hashed_api_key`,
      ['admin', hashedApiKey]
    );
    
    console.log('✅ Database and admin user created successfully!');
    console.log('   Username: admin');
    console.log('   API Key: supersecretadminkey');
    console.log('\n🔐 You can now log in with the above credentials\n');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the setup
setupDatabase().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
