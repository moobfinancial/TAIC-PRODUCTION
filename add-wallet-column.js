// Script to add wallet_address and auth_nonce columns to users table
const { Pool } = require('pg');
require('dotenv').config({ path: './.env.local' });

// Parse connection string or use individual parameters
const connectionString = process.env.POSTGRES_URL;

let pool;

if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: (new URL(connectionString).hostname === 'localhost' || new URL(connectionString).hostname === '127.0.0.1') 
      ? false 
      : { rejectUnauthorized: false },
  });
} else {
  pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE,
    ssl: (process.env.PGHOST === 'localhost' || process.env.PGHOST === '127.0.0.1') 
      ? false 
      : { rejectUnauthorized: false },
  });
}

async function addWalletAddressColumn() {
  const client = await pool.connect();
  
  try {
    // Check if wallet_address column exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'wallet_address';
    `;
    
    const { rows } = await client.query(checkColumnQuery);
    
    if (rows.length === 0) {
      console.log('wallet_address column does not exist. Adding it now...');
      
      // Add wallet_address and auth_nonce columns
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN wallet_address VARCHAR(255) UNIQUE,
        ADD COLUMN auth_nonce VARCHAR(255);
      `);
      
      // Add index for wallet_address
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
      `);
      
      console.log('Successfully added wallet_address and auth_nonce columns to users table');
    } else {
      console.log('wallet_address column already exists in users table');
    }
    
    // Check if auth_nonce column exists
    const checkNonceQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'auth_nonce';
    `;
    
    const nonceResult = await client.query(checkNonceQuery);
    
    if (nonceResult.rows.length === 0) {
      console.log('auth_nonce column does not exist. Adding it now...');
      
      // Add auth_nonce column
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN auth_nonce VARCHAR(255);
      `);
      
      console.log('Successfully added auth_nonce column to users table');
    } else {
      console.log('auth_nonce column already exists in users table');
    }
    
  } catch (err) {
    console.error('Error adding columns:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addWalletAddressColumn();
