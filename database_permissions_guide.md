# PostgreSQL Database Permissions Guide

This guide explains how to properly set up and manage database permissions for application users in PostgreSQL, allowing them to perform schema changes when needed.

## Understanding PostgreSQL Permissions

PostgreSQL has a robust role-based access control system. For an application user to modify table structures, they need specific permissions:

- `CREATE` on the database or schema
- `ALTER` on tables they need to modify
- `CREATE INDEX` for creating indexes

## Initial Setup by Database Administrator

These steps should be performed by a database administrator (superuser) to grant the necessary permissions to your application user:

```sql
-- Connect as superuser (postgres)
-- psql postgresql://postgres@localhost:5432/moobfinancial

-- Grant schema modification permissions to application user
GRANT CREATE ON SCHEMA public TO moobuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO moobuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO moobuser;

-- Make the user an owner of specific tables (alternative to ALTER ANY)
ALTER TABLE users OWNER TO moobuser;
ALTER TABLE products OWNER TO moobuser;
-- Repeat for other tables as needed

-- For future tables, set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO moobuser;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON SEQUENCES TO moobuser;
```

## Creating a Migration User

For better security, consider creating a dedicated migration user with elevated privileges:

```sql
-- Create migration user
CREATE USER moob_migrations WITH PASSWORD 'secure_password';

-- Grant necessary permissions
GRANT CREATE ON SCHEMA public TO moob_migrations;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO moob_migrations;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO moob_migrations;

-- Make migration user an owner of all tables
-- This script generates ALTER TABLE statements for all tables
SELECT 'ALTER TABLE ' || tablename || ' OWNER TO moob_migrations;'
FROM pg_tables
WHERE schemaname = 'public';
```

## Running Migrations Safely

### Option 1: Using a Migration Tool

Tools like Prisma, TypeORM, or Sequelize can manage migrations with proper credentials:

```javascript
// Example with TypeORM
const dataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "moob_migrations", // Migration user
  password: "secure_password",
  database: "moobfinancial",
  entities: [...],
  migrations: [...],
});
```

### Option 2: Separate Migration Scripts

Create migration scripts that connect with elevated privileges:

```javascript
// migration-runner.js
const { Pool } = require('pg');

const migrationPool = new Pool({
  connectionString: process.env.MIGRATION_DATABASE_URL, // Contains migration user credentials
});

async function runMigration() {
  const client = await migrationPool.connect();
  try {
    await client.query('BEGIN');
    
    // Run your migration queries
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN wallet_address VARCHAR(255) UNIQUE;
    `);
    
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

## Best Practices

1. **Separate Concerns**: Use different database users for:
   - Application (read/write data only)
   - Migrations (schema changes)
   - Admin operations

2. **Environment Variables**: Store connection strings securely:
   ```
   # .env.local
   POSTGRES_URL=postgresql://moobuser:moobpassword@localhost:5432/moobfinancial
   MIGRATION_DATABASE_URL=postgresql://moob_migrations:secure_password@localhost:5432/moobfinancial
   ```

3. **Least Privilege**: Grant only necessary permissions to each user

4. **Version Control**: Track all schema changes in migration files

5. **Transactions**: Always wrap migrations in transactions

## Troubleshooting Common Permission Issues

### "Must be owner of table" Error

This occurs when a user tries to alter a table they don't own:

```sql
-- Solution: Transfer ownership (as superuser)
ALTER TABLE users OWNER TO moobuser;
```

### "Permission denied" for Sequences

If you can't update auto-incrementing IDs:

```sql
-- Grant sequence permissions
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO moobuser;
```

### "Permission denied" for Schema

If you can't create new tables:

```sql
-- Grant schema create permission
GRANT CREATE ON SCHEMA public TO moobuser;
```

## Security Considerations

- Never use superuser credentials in application code
- Rotate migration user passwords regularly
- Consider using SSL for database connections
- Audit database access periodically

By following these guidelines, you can manage database schema changes without requiring superuser intervention for every modification.
