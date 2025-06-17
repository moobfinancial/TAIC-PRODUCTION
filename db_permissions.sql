-- Grant permissions to create tables and modify schema
-- Replace 'your_db_user' with your actual database user name

-- Grant permissions on the database
GRANT CREATE, CONNECT ON DATABASE your_database TO your_db_user;

-- Grant permissions on the schema
GRANT USAGE, CREATE ON SCHEMA public TO your_db_user;

-- Grant permissions on all tables in the schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_db_user;

-- Grant permissions on all sequences in the schema
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_db_user;

-- Make sure future tables and sequences get the same permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO your_db_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO your_db_user;

-- If you need to grant permissions to execute functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_db_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO your_db_user;
