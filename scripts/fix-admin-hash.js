const { Client } = require('pg');
const crypto = require('crypto');

// Configuration
const config = {
  dbUrl: 'postgresql://moobuser:moobpassword@localhost:5432/moobfinancial',
  adminUsername: 'admin',
  adminApiKey: 'supersecretadminkey'
};

// Hash the API key
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function fixAdminHash() {
  const client = new Client({
    connectionString: config.dbUrl
  });

  try {
    await client.connect();
    
    // Get the current hash for the admin user
    const { rows } = await client.query(
      'SELECT hashed_api_key FROM admin_users WHERE username = $1',
      [config.adminUsername]
    );
    
    if (rows.length === 0) {
      console.error('Admin user not found');
      return;
    }
    
    const currentHash = rows[0].hashed_api_key;
    const correctHash = hashApiKey(config.adminApiKey);
    
    if (currentHash === correctHash) {
      console.log('✅ Admin API key hash is already correct');
      return;
    }
    
    console.log('Updating admin API key hash...');
    
    // Update the hash
    await client.query(
      'UPDATE admin_users SET hashed_api_key = $1 WHERE username = $2',
      [correctHash, config.adminUsername]
    );
    
    console.log('✅ Admin API key hash updated successfully!');
    console.log(`Old hash: ${currentHash}`);
    console.log(`New hash: ${correctHash}`);
    
  } catch (error) {
    console.error('❌ Error updating admin hash:', error.message);
  } finally {
    await client.end();
  }
}

fixAdminHash().catch(console.error);
