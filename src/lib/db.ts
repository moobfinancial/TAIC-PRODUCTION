import { Pool } from 'pg';

// Parse connection string or use individual parameters
const connectionString = process.env.POSTGRES_URL;

let pool: Pool;

if (connectionString) {
  // If connection string is provided, use it
  pool = new Pool({
    connectionString,
    ssl: (new URL(connectionString).hostname === 'localhost' || new URL(connectionString).hostname === '127.0.0.1') ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  });
} else {
  // Otherwise, use individual parameters
  pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE,
    ssl: (process.env.PGHOST === 'localhost' || process.env.PGHOST === '127.0.0.1') ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  });
}

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

export { pool };
