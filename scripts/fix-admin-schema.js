const { Client } = require('pg');

async function fixSchema() {
  const client = new Client({
    connectionString: 'postgresql://moobuser:moobpassword@localhost:5432/moobfinancial'
  });

  try {
    await client.connect();
    
    // Check the current schema of admin_users
    console.log('Checking admin_users schema...');
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'admin_users'
      ORDER BY ordinal_position
    `);
    
    console.log('\nCurrent admin_users schema:');
    console.table(columns);
    
    // Check if updated_at has a default value
    const updatedAtColumn = columns.find(col => col.column_name === 'updated_at');
    if (updatedAtColumn && !updatedAtColumn.column_default) {
      console.log('\nFixing updated_at column...');
      await client.query(`
        ALTER TABLE admin_users 
        ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN updated_at SET NOT NULL;
      `);
      console.log('✅ Updated updated_at column with DEFAULT and NOT NULL constraints');
    }
    
    // Check if we need to update any existing rows
    const { rows: nullUpdatedAt } = await client.query(
      "SELECT COUNT(*) as count FROM admin_users WHERE updated_at IS NULL"
    );
    
    if (parseInt(nullUpdatedAt[0].count) > 0) {
      console.log(`\nFound ${nullUpdatedAt[0].count} rows with NULL updated_at, updating...`);
      await client.query(
        "UPDATE admin_users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"
      );
      console.log('✅ Updated NULL updated_at values');
    }
    
    // Verify the fix
    const { rows: adminUsers } = await client.query('SELECT * FROM admin_users');
    console.log('\nAdmin users after fix:');
    console.table(adminUsers.map(user => ({
      id: user.id,
      username: user.username,
      hashed_api_key: user.hashed_api_key.substring(0, 8) + '...',
      created_at: user.created_at,
      updated_at: user.updated_at
    })));
    
  } catch (error) {
    console.error('❌ Error fixing schema:', error.message);
  } finally {
    await client.end();
  }
}

fixSchema().catch(console.error);
