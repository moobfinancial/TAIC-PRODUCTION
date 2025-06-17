// Script to check the users table schema
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

// Query to get table schema
const query = `
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'users'
  ORDER BY ordinal_position;
`;

// Execute the query
pool.query(query)
  .then(res => {
    console.log('Users table schema:');
    console.table(res.rows);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error fetching schema:', err);
    process.exit(1);
  });
