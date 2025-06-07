const { Client } = require('pg');

async function addUpdatedAt() {
  // Connect as postgres user to ensure we have the necessary permissions
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'moobfinancial'
  });

  try {
    await client.connect();
    
    // Add updated_at column if it doesn't exist
    console.log('Adding updated_at column...');
    await client.query(`
      ALTER TABLE admin_users 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);
    
    console.log('✅ Added updated_at column');
    
    // Verify the schema
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'admin_users'
      ORDER BY ordinal_position
    `);
    
    console.log('\nUpdated admin_users schema:');
    console.table(columns);
    
    // Verify the data
    const { rows: adminUsers } = await client.query('SELECT * FROM admin_users');
    console.log('\nAdmin users:');
    console.table(adminUsers.map(user => ({
      id: user.id,
      username: user.username,
      hashed_api_key: user.hashed_api_key.substring(0, 8) + '...',
      created_at: user.created_at,
      updated_at: user.updated_at || 'NULL'
    })));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

addUpdatedAt().catch(console.error);
