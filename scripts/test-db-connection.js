const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    connectionString: 'postgresql://moobuser:moobpassword@localhost:5432/moobfinancial'
  });

  try {
    console.log('Attempting to connect to the database...');
    await client.connect();
    console.log('✅ Successfully connected to the database');

    // Test query
    console.log('Running test query...');
    const result = await client.query('SELECT NOW() as now');
    console.log('✅ Test query successful. Current time:', result.rows[0].now);

    // Check admin_users table
    console.log('Checking admin_users table...');
    const adminResult = await client.query('SELECT * FROM admin_users');
    console.log(`✅ Found ${adminResult.rows.length} admin users`);
    
    if (adminResult.rows.length > 0) {
      console.log('Admin users:', JSON.stringify(adminResult.rows, null, 2));
    }

  } catch (error) {
    console.error('❌ Error connecting to the database:', error);
  } finally {
    await client.end();
    console.log('Connection closed');
  }
}

testConnection().catch(console.error);
