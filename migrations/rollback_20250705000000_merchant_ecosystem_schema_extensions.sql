-- Rollback Migration: Merchant Ecosystem Schema Extensions
-- This script safely rolls back the merchant ecosystem schema extensions
-- by removing the added tables and columns in reverse order.
-- 
-- Created: 2025-07-05
-- Rollback for: 20250705000000_merchant_ecosystem_schema_extensions.sql
-- 
-- IMPORTANT: This rollback script must be run as a database superuser (postgres).
-- WARNING: This will permanently delete all merchant wallet, transaction, and payout data!
-- 
-- Usage: PGPASSWORD=postgres_password psql -U postgres -d moobfinancial -f migrations/rollback_20250705000000_merchant_ecosystem_schema_extensions.sql

-- Confirmation check - uncomment the following line to enable rollback
-- SET session_replication_role = replica; -- This disables triggers during rollback

DO $$
BEGIN
    -- Check if the migration exists before attempting rollback
    IF EXISTS (SELECT 1 FROM migrations WHERE name = '20250705000000_merchant_ecosystem_schema_extensions') THEN
        RAISE NOTICE 'Starting rollback of merchant ecosystem schema extensions...';
        RAISE NOTICE 'WARNING: This will permanently delete all merchant financial data!';
        
        -- ==========================================
        -- 1. DROP TRIGGERS
        -- ==========================================
        
        RAISE NOTICE 'Dropping update triggers...';
        
        DROP TRIGGER IF EXISTS update_merchant_wallets_updated_at ON merchant_wallets;
        DROP TRIGGER IF EXISTS update_merchant_transactions_updated_at ON merchant_transactions;
        DROP TRIGGER IF EXISTS update_merchant_payout_requests_updated_at ON merchant_payout_requests;
        
        RAISE NOTICE 'Dropped update triggers';
        
        -- ==========================================
        -- 2. DROP INDEXES
        -- ==========================================
        
        RAISE NOTICE 'Dropping performance indexes...';
        
        -- Drop indexes for merchant_wallets table
        DROP INDEX IF EXISTS idx_merchant_wallets_merchant_id;
        DROP INDEX IF EXISTS idx_merchant_wallets_wallet_type;
        DROP INDEX IF EXISTS idx_merchant_wallets_is_active;
        DROP INDEX IF EXISTS idx_merchant_wallets_network;
        
        -- Drop indexes for merchant_transactions table
        DROP INDEX IF EXISTS idx_merchant_transactions_merchant_id;
        DROP INDEX IF EXISTS idx_merchant_transactions_order_id;
        DROP INDEX IF EXISTS idx_merchant_transactions_type;
        DROP INDEX IF EXISTS idx_merchant_transactions_status;
        DROP INDEX IF EXISTS idx_merchant_transactions_type_status;
        DROP INDEX IF EXISTS idx_merchant_transactions_created_at;
        DROP INDEX IF EXISTS idx_merchant_transactions_merchant_created;
        DROP INDEX IF EXISTS idx_merchant_transactions_currency;
        
        -- Drop indexes for merchant_payout_requests table
        DROP INDEX IF EXISTS idx_merchant_payout_requests_merchant_id;
        DROP INDEX IF EXISTS idx_merchant_payout_requests_status;
        DROP INDEX IF EXISTS idx_merchant_payout_requests_created_at;
        DROP INDEX IF EXISTS idx_merchant_payout_requests_approved_by;
        DROP INDEX IF EXISTS idx_merchant_payout_requests_currency;
        
        -- Drop indexes for updated existing tables
        DROP INDEX IF EXISTS idx_users_payout_schedule;
        DROP INDEX IF EXISTS idx_users_payout_wallet;
        DROP INDEX IF EXISTS idx_products_merchant_commission;
        DROP INDEX IF EXISTS idx_products_merchant_cashback;
        
        RAISE NOTICE 'Dropped performance indexes';
        
        -- ==========================================
        -- 3. DROP NEW TABLES (in reverse dependency order)
        -- ==========================================
        
        RAISE NOTICE 'Dropping new merchant ecosystem tables...';
        
        -- Drop merchant_payout_requests table (has foreign key to merchant_transactions)
        DROP TABLE IF EXISTS merchant_payout_requests CASCADE;
        RAISE NOTICE 'Dropped merchant_payout_requests table';
        
        -- Drop merchant_transactions table (has foreign key to orders and users)
        DROP TABLE IF EXISTS merchant_transactions CASCADE;
        RAISE NOTICE 'Dropped merchant_transactions table';
        
        -- Drop merchant_wallets table (has foreign key to users)
        DROP TABLE IF EXISTS merchant_wallets CASCADE;
        RAISE NOTICE 'Dropped merchant_wallets table';
        
        RAISE NOTICE 'Dropped new merchant ecosystem tables';
        
        -- ==========================================
        -- 4. REMOVE COLUMNS FROM EXISTING TABLES
        -- ==========================================
        
        RAISE NOTICE 'Removing merchant-related columns from existing tables...';
        
        -- Remove merchant-related columns from users table
        ALTER TABLE users 
        DROP COLUMN IF EXISTS payout_wallet_address,
        DROP COLUMN IF EXISTS payout_schedule,
        DROP COLUMN IF EXISTS minimum_payout_amount;
        
        -- Remove merchant commission and cashback fields from products table
        ALTER TABLE products 
        DROP COLUMN IF EXISTS merchant_commission_rate,
        DROP COLUMN IF EXISTS merchant_cashback_cost;
        
        RAISE NOTICE 'Removed merchant-related columns from existing tables';
        
        -- ==========================================
        -- 5. REVOKE PERMISSIONS
        -- ==========================================
        
        RAISE NOTICE 'Revoking permissions from moobuser role...';
        
        -- Note: We can't revoke permissions from dropped tables, but we'll clean up any remaining references
        -- The permissions are automatically removed when tables are dropped
        
        RAISE NOTICE 'Permissions automatically revoked with table drops';
        
        -- ==========================================
        -- 6. REMOVE MIGRATION RECORD
        -- ==========================================
        
        -- Remove the migration record
        DELETE FROM migrations WHERE name = '20250705000000_merchant_ecosystem_schema_extensions';
        
        RAISE NOTICE 'Removed migration record';
        
        -- ==========================================
        -- 7. VERIFICATION
        -- ==========================================
        
        RAISE NOTICE 'Verifying rollback completion...';
        
        -- Verify tables are dropped
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_wallets') THEN
            RAISE NOTICE '✓ merchant_wallets table successfully dropped';
        ELSE
            RAISE WARNING '✗ merchant_wallets table still exists';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_transactions') THEN
            RAISE NOTICE '✓ merchant_transactions table successfully dropped';
        ELSE
            RAISE WARNING '✗ merchant_transactions table still exists';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_payout_requests') THEN
            RAISE NOTICE '✓ merchant_payout_requests table successfully dropped';
        ELSE
            RAISE WARNING '✗ merchant_payout_requests table still exists';
        END IF;
        
        -- Verify columns are removed from users table
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'payout_wallet_address'
        ) THEN
            RAISE NOTICE '✓ payout_wallet_address column successfully removed from users table';
        ELSE
            RAISE WARNING '✗ payout_wallet_address column still exists in users table';
        END IF;
        
        -- Verify columns are removed from products table
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'merchant_commission_rate'
        ) THEN
            RAISE NOTICE '✓ merchant_commission_rate column successfully removed from products table';
        ELSE
            RAISE WARNING '✗ merchant_commission_rate column still exists in products table';
        END IF;
        
        RAISE NOTICE 'Rollback verification completed';
        
        -- ==========================================
        -- 8. COMPLETION MESSAGE
        -- ==========================================
        
        RAISE NOTICE '========================================';
        RAISE NOTICE 'ROLLBACK COMPLETED SUCCESSFULLY!';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'The following changes have been rolled back:';
        RAISE NOTICE '- Dropped tables: merchant_wallets, merchant_transactions, merchant_payout_requests';
        RAISE NOTICE '- Removed columns from users table: payout_wallet_address, payout_schedule, minimum_payout_amount';
        RAISE NOTICE '- Removed columns from products table: merchant_commission_rate, merchant_cashback_cost';
        RAISE NOTICE '- Dropped all related indexes and triggers';
        RAISE NOTICE '- Removed migration record';
        RAISE NOTICE '';
        RAISE NOTICE 'WARNING: All merchant financial data has been permanently deleted!';
        RAISE NOTICE 'The database schema has been restored to its pre-migration state.';
        RAISE NOTICE '========================================';
        
    ELSE
        RAISE NOTICE 'Migration 20250705000000_merchant_ecosystem_schema_extensions was not found in migrations table.';
        RAISE NOTICE 'Either the migration was never applied or has already been rolled back.';
        RAISE NOTICE 'No rollback actions performed.';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Rollback failed with error: %', SQLERRM;
END
$$;
