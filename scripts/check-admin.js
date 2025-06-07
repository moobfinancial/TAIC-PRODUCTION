const { Client } = require('pg');

async function checkAdmin() {
  const client = new Client({
    connectionString: 'postgresql://moobuser:moobpassword@localhost:5432/moobfinancial'
  });

  try {
    await client.connect();
    
    // Check if the admin_users table exists
    const tableExists = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_users')"
    );
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ admin_users table does not exist');
      return;
    }
    
    console.log('✅ admin_users table exists');
    
    // Get all admin users
    const { rows } = await client.query('SELECT * FROM admin_users');
    
    if (rows.length === 0) {
      console.log('❌ No admin users found');
    } else {
      console.log('\nAdmin Users:');
      console.log('------------');
      rows.forEach((user, index) => {
        console.log(`\nUser #${index + 1}:`);
        console.log(`ID: ${user.id}`);
        console.log(`Username: ${user.username}`);
        console.log(`Hashed API Key: ${user.hashed_api_key.substring(0, 8)}...`);
        console.log(`Created At: ${user.created_at}`);
        console.log(`Updated At: ${user.updated_at}`);
      });
    }
    
    // Check the hash of the expected API key
    const crypto = require('crypto');
    const expectedApiKey = 'supersecretadminkey';
    const expectedHash = crypto.createHash('sha256').update(expectedApiKey).digest('hex');
    
    console.log('\nExpected hash for "supersecretadminkey":');
    console.log(expectedHash);
    
  } catch (error) {
    console.error('❌ Error checking admin users:', error.message);
  } finally {
    await client.end();
  }
}

checkAdmin().catch(console.error);
