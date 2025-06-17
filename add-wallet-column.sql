-- Add wallet_address column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'wallet_address'
    ) THEN
        ALTER TABLE users
        ADD COLUMN wallet_address VARCHAR(255) UNIQUE,
        ADD COLUMN auth_nonce VARCHAR(255);
        
        -- Add index for wallet_address
        CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
        
        RAISE NOTICE 'Added wallet_address and auth_nonce columns to users table';
    ELSE
        RAISE NOTICE 'wallet_address column already exists in users table';
    END IF;
END $$;
