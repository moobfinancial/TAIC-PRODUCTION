-- SQL script to add wallet_address and auth_nonce columns to the users table
-- Run this AFTER the grant_permissions.sql script has been executed by a database administrator

-- Add wallet_address column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'wallet_address'
    ) THEN
        ALTER TABLE users
        ADD COLUMN wallet_address VARCHAR(255) UNIQUE;
        
        RAISE NOTICE 'Added wallet_address column to users table';
    ELSE
        RAISE NOTICE 'wallet_address column already exists in users table';
    END IF;
END $$;

-- Add auth_nonce column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'auth_nonce'
    ) THEN
        ALTER TABLE users
        ADD COLUMN auth_nonce VARCHAR(255);
        
        RAISE NOTICE 'Added auth_nonce column to users table';
    ELSE
        RAISE NOTICE 'auth_nonce column already exists in users table';
    END IF;
END $$;

-- Create index on wallet_address column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 'users' AND indexname = 'idx_users_wallet_address'
    ) THEN
        CREATE INDEX idx_users_wallet_address ON users(wallet_address);
        
        RAISE NOTICE 'Created index on wallet_address column';
    ELSE
        RAISE NOTICE 'Index on wallet_address column already exists';
    END IF;
END $$;
