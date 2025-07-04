const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Database connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migration...');
    
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/20250703000000_create_conversation_threads.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Check if migration has already been run
    const existingMigration = await client.query(
      'SELECT name FROM migrations WHERE name = $1',
      ['20250703000000_create_conversation_threads']
    );
    
    if (existingMigration.rows.length > 0) {
      console.log('✅ Migration already applied: 20250703000000_create_conversation_threads');
      return;
    }
    
    // Run the migration
    console.log('📝 Applying migration: 20250703000000_create_conversation_threads');
    await client.query(migrationSQL);
    
    // Record the migration
    await client.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      ['20250703000000_create_conversation_threads']
    );
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Created tables:');
    console.log('   - conversation_threads');
    console.log('   - conversation_messages');
    console.log('🔧 Created functions:');
    console.log('   - link_guest_conversations_to_user()');
    console.log('   - cleanup_expired_conversations()');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🎉 Database migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
