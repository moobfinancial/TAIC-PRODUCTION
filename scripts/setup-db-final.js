const { Client } = require('pg');
const { execSync } = require('child_process');

// Configuration
const config = {
  dbName: 'moobfinancial',
  dbUser: 'moobuser',
  dbPassword: 'moobpassword',
  adminUsername: 'admin',
  adminApiKey: 'supersecretadminkey',
  // SHA-256 hash of 'supersecretadminkey'
  hashedApiKey: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
};

async function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    const result = execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error.message);
    return false;
  }
}

async function setupDatabase() {
  let client;
  
  try {
    // Try to connect as moobuser first
    client = new Client({
      user: config.dbUser,
      password: config.dbPassword,
      host: 'localhost',
      port: 5432,
      database: 'postgres'
    });
    
    await client.connect();
    console.log('✅ Connected to PostgreSQL as moobuser');
    
    // Create database if it doesn't exist
    await client.query(`SELECT 1`);
    
  } catch (error) {
    console.log('Could not connect as moobuser, trying as postgres...');
    
    // If that fails, try connecting as postgres (might not have a password)
    try {
      if (client) await client.end();
      
      client = new Client({
        user: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'postgres'
      });
      
      await client.connect();
      console.log('✅ Connected to PostgreSQL as postgres');
      
    } catch (error) {
      console.error('❌ Could not connect to PostgreSQL. Please make sure PostgreSQL is running.');
      console.error('You might need to run this script with sudo or as the postgres user.');
      throw error;
    }
  }
  
  try {
    // Create database if it doesn't exist
    console.log('Creating database...');
    await client.query(`CREATE DATABASE ${config.dbName}`);
    console.log('✅ Database created');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('Database already exists');
    } else {
      throw error;
    }
  }
  
  try {
    // Create user if it doesn't exist
    console.log('Creating user...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${config.dbUser}') THEN
          CREATE USER ${config.dbUser} WITH PASSWORD '${config.dbPassword}';
        END IF;
      END
      $$`);
    console.log('✅ User created');
    
    // Grant privileges
    await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${config.dbName} TO ${config.dbUser};`);
    console.log('✅ Privileges granted');
    
  } catch (error) {
    console.error('Error creating user or granting privileges:', error.message);
    throw error;
  } finally {
    await client.end();
  }
  
  // Now connect to the new database as the new user
  const dbClient = new Client({
    user: config.dbUser,
    password: config.dbPassword,
    host: 'localhost',
    port: 5432,
    database: config.dbName
  });
  
  try {
    await dbClient.connect();
    
    // Create admin_users table
    console.log('Creating admin_users table...');
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        hashed_api_key VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    
    // Create index
    console.log('Creating index...');
    await dbClient.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_hashed_api_key 
      ON admin_users(hashed_api_key)`);
    
    // Add admin user
    console.log('Adding admin user...');
    await dbClient.query(
      `INSERT INTO admin_users (username, hashed_api_key) 
       VALUES ($1, $2) 
       ON CONFLICT (username) DO UPDATE 
       SET hashed_api_key = EXCLUDED.hashed_api_key`,
      [config.adminUsername, config.hashedApiKey]
    );
    
    console.log('\n✅ Setup completed successfully!');
    console.log('\nAdmin login details:');
    console.log('-----------------');
    console.log(`Username: ${config.adminUsername}`);
    console.log(`API Key: ${config.adminApiKey}`);
    console.log('\n🔐 You can now log in with the above credentials\n');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    throw error;
  } finally {
    await dbClient.end();
  }
}

// Run the setup
setupDatabase().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
