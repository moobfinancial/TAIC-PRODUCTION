// Simple script to test database connection
const { Pool } = require('pg');
require('dotenv').config({ path: './.env.local' });

// Log environment variables (without sensitive values)
console.log('Environment variables:');
console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
console.log('PGHOST:', process.env.PGHOST);
console.log('PGPORT:', process.env.PGPORT);
console.log('PGDATABASE:', process.env.PGDATABASE);
console.log('PGUSER:', process.env.PGUSER);
console.log('PGPASSWORD exists:', !!process.env.PGPASSWORD);

// Parse connection string or use individual parameters
const connectionString = process.env.POSTGRES_URL;

let pool;

if (connectionString) {
  // If connection string is provided, use it
  console.log('Using connection string');
  pool = new Pool({
    connectionString,
    ssl: (new URL(connectionString).hostname === 'localhost' || new URL(connectionString).hostname === '127.0.0.1') 
      ? false 
      : { rejectUnauthorized: false },
  });
} else {
  // Otherwise, use individual parameters
  console.log('Using individual parameters');
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

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
    process.exit(0);
  }
});
