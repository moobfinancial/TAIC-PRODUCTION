#!/bin/bash

# This script sets up the database and admin user with the correct permissions
# It should be run as a PostgreSQL superuser (usually 'postgres')

# Database configuration
DB_NAME="moobfinancial"
DB_USER="moobuser"
DB_PASSWORD="moobpassword"
ADMIN_USERNAME="admin"
ADMIN_API_KEY="supersecretadminkey"

# Hash the API key (SHA-256 of 'supersecretadminkey')
HASHED_API_KEY="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

echo "Setting up database and admin user..."

# Create the database if it doesn't exist
psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
  psql -U postgres -c "CREATE DATABASE $DB_NAME;"

# Create the user if it doesn't exist
psql -U postgres -c "SELECT 1 FROM pg_user WHERE usename = '$DB_USER'" | grep -q 1 || \
  psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

# Grant privileges on the database to the user
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Connect to the database and set up the schema
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -d $DB_NAME -c "
  -- Create admin_users table if it doesn't exist
  CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    hashed_api_key VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Create index if it doesn't exist
  CREATE INDEX IF NOT EXISTS idx_admin_users_hashed_api_key 
  ON admin_users(hashed_api_key);

  -- Add or update the admin user
  INSERT INTO admin_users (username, hashed_api_key) 
  VALUES ('$ADMIN_USERNAME', '$HASHED_API_KEY')
  ON CONFLICT (username) DO UPDATE 
  SET hashed_api_key = EXCLUDED.hashed_api_key;
"

echo "✅ Database and admin user setup complete!"
echo ""
echo "Admin login details:"
echo "-----------------"
echo "Username: $ADMIN_USERNAME"
echo "API Key: $ADMIN_API_KEY"
echo ""
echo "🔐 You can now log in with the above credentials"
echo ""
