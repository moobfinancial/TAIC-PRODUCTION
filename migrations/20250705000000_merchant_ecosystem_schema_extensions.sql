-- Migration: Merchant Ecosystem Schema Extensions
-- This migration adds the required database tables and columns for the TAIC merchant ecosystem
-- including merchant wallets, transactions, payout requests, and enhanced merchant functionality.
-- 
-- Created: 2025-07-05
-- Phase: 1, Item 3 - Database Schema Extensions
-- 
-- IMPORTANT: This migration must be run as a database superuser (postgres) to ensure proper permissions.
-- Example: PGPASSWORD=postgres_password psql -U postgres -d moobfinancial -f migrations/20250705000000_merchant_ecosystem_schema_extensions.sql

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check if this migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM migrations WHERE name = '20250705000000_merchant_ecosystem_schema_extensions') THEN
        RAISE NOTICE 'Starting merchant ecosystem schema extensions migration...';
        
        -- ==========================================
        -- 1. UPDATE EXISTING TABLES
        -- ==========================================
        
        RAISE NOTICE 'Updating existing tables with merchant-related columns...';
        
        -- Add merchant-related columns to users table
        -- These columns support merchant payout configuration and wallet management
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS payout_wallet_address VARCHAR(255),
        ADD COLUMN IF NOT EXISTS payout_schedule VARCHAR(20) DEFAULT 'WEEKLY' CHECK (payout_schedule IN ('DAILY', 'WEEKLY', 'MONTHLY')),
        ADD COLUMN IF NOT EXISTS minimum_payout_amount DECIMAL(10,2) DEFAULT 50.00 CHECK (minimum_payout_amount >= 0);
        
        -- Add merchant commission and cashback fields to products table
        -- These fields support merchant-specific pricing and cashback configuration
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS merchant_commission_rate DECIMAL(5,2) DEFAULT 5.00 CHECK (merchant_commission_rate >= 0 AND merchant_commission_rate <= 100),
        ADD COLUMN IF NOT EXISTS merchant_cashback_cost DECIMAL(10,2) DEFAULT 0.00 CHECK (merchant_cashback_cost >= 0);
        
        RAISE NOTICE 'Updated existing tables with merchant columns';
        
        -- ==========================================
        -- 2. CREATE NEW MERCHANT TABLES
        -- ==========================================
        
        RAISE NOTICE 'Creating new merchant ecosystem tables...';
        
        -- Merchant Wallets Table
        -- Stores merchant crypto wallet addresses and configuration for payouts
        CREATE TABLE IF NOT EXISTS merchant_wallets (
            id SERIAL PRIMARY KEY,
            merchant_id UUID NOT NULL,
            wallet_address VARCHAR(255) NOT NULL,
            wallet_type VARCHAR(50) NOT NULL DEFAULT 'TAIC_PAYOUT' CHECK (wallet_type IN ('TAIC_PAYOUT', 'ETHEREUM', 'BITCOIN', 'OTHER')),
            network VARCHAR(50) NOT NULL DEFAULT 'FANTOM' CHECK (network IN ('FANTOM', 'ETHEREUM', 'BITCOIN', 'POLYGON', 'BSC')),
            is_active BOOLEAN DEFAULT TRUE,
            is_verified BOOLEAN DEFAULT FALSE,
            verification_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            -- Constraints
            CONSTRAINT fk_merchant_wallets_merchant_id FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT unique_merchant_wallet_address UNIQUE (wallet_address),
            CONSTRAINT unique_active_wallet_per_merchant UNIQUE (merchant_id, wallet_type, is_active) DEFERRABLE INITIALLY DEFERRED
        );
        
        -- Merchant Transactions Table
        -- Tracks all merchant financial transactions including sales, commissions, payouts, and cashback costs
        CREATE TABLE IF NOT EXISTS merchant_transactions (
            id SERIAL PRIMARY KEY,
            merchant_id UUID NOT NULL,
            order_id INTEGER,
            transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('SALE', 'COMMISSION', 'PAYOUT', 'CASHBACK_COST', 'REFUND', 'ADJUSTMENT')),
            amount DECIMAL(20, 8) NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'TAIC',
            status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PROCESSING')),
            description TEXT,
            reference_id VARCHAR(255), -- External transaction reference (e.g., blockchain transaction hash)
            transaction_hash VARCHAR(255), -- Blockchain transaction hash for crypto transactions
            metadata JSONB, -- Additional transaction metadata
            processed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            -- Constraints
            CONSTRAINT fk_merchant_transactions_merchant_id FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_merchant_transactions_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
            CONSTRAINT check_amount_sign CHECK (
                (transaction_type IN ('SALE', 'REFUND', 'ADJUSTMENT') AND amount != 0) OR
                (transaction_type IN ('COMMISSION', 'CASHBACK_COST', 'PAYOUT') AND amount <= 0)
            )
        );
        
        -- Merchant Payout Requests Table
        -- Manages merchant payout requests and approval workflow
        CREATE TABLE IF NOT EXISTS merchant_payout_requests (
            id SERIAL PRIMARY KEY,
            merchant_id UUID NOT NULL,
            requested_amount DECIMAL(20, 8) NOT NULL CHECK (requested_amount > 0),
            currency VARCHAR(10) NOT NULL DEFAULT 'TAIC',
            destination_wallet VARCHAR(255) NOT NULL,
            destination_network VARCHAR(50) NOT NULL DEFAULT 'FANTOM',
            status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED')),
            admin_notes TEXT,
            rejection_reason TEXT,
            approved_by UUID, -- Admin user who approved the request
            approved_at TIMESTAMP WITH TIME ZONE,
            processed_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            transaction_hash VARCHAR(255), -- Blockchain transaction hash when payout is completed
            fee_amount DECIMAL(20, 8) DEFAULT 0.00, -- Transaction fee deducted from payout
            net_amount DECIMAL(20, 8), -- Actual amount sent after fees
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            -- Constraints
            CONSTRAINT fk_merchant_payout_requests_merchant_id FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_merchant_payout_requests_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT check_net_amount CHECK (net_amount IS NULL OR net_amount <= requested_amount)
        );
        
        RAISE NOTICE 'Created new merchant ecosystem tables';
        
        -- ==========================================
        -- 3. CREATE INDEXES FOR PERFORMANCE
        -- ==========================================
        
        RAISE NOTICE 'Creating performance indexes...';
        
        -- Indexes for merchant_wallets table
        CREATE INDEX IF NOT EXISTS idx_merchant_wallets_merchant_id ON merchant_wallets(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_merchant_wallets_wallet_type ON merchant_wallets(wallet_type);
        CREATE INDEX IF NOT EXISTS idx_merchant_wallets_is_active ON merchant_wallets(is_active);
        CREATE INDEX IF NOT EXISTS idx_merchant_wallets_network ON merchant_wallets(network);
        
        -- Indexes for merchant_transactions table
        CREATE INDEX IF NOT EXISTS idx_merchant_transactions_merchant_id ON merchant_transactions(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_merchant_transactions_order_id ON merchant_transactions(order_id);
        CREATE INDEX IF NOT EXISTS idx_merchant_transactions_type ON merchant_transactions(transaction_type);
        CREATE INDEX IF NOT EXISTS idx_merchant_transactions_status ON merchant_transactions(status);
        CREATE INDEX IF NOT EXISTS idx_merchant_transactions_type_status ON merchant_transactions(transaction_type, status);
        CREATE INDEX IF NOT EXISTS idx_merchant_transactions_created_at ON merchant_transactions(created_at);
        CREATE INDEX IF NOT EXISTS idx_merchant_transactions_merchant_created ON merchant_transactions(merchant_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_merchant_transactions_currency ON merchant_transactions(currency);
        
        -- Indexes for merchant_payout_requests table
        CREATE INDEX IF NOT EXISTS idx_merchant_payout_requests_merchant_id ON merchant_payout_requests(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_merchant_payout_requests_status ON merchant_payout_requests(status);
        CREATE INDEX IF NOT EXISTS idx_merchant_payout_requests_created_at ON merchant_payout_requests(created_at);
        CREATE INDEX IF NOT EXISTS idx_merchant_payout_requests_approved_by ON merchant_payout_requests(approved_by);
        CREATE INDEX IF NOT EXISTS idx_merchant_payout_requests_currency ON merchant_payout_requests(currency);
        
        -- Indexes for updated existing tables
        CREATE INDEX IF NOT EXISTS idx_users_payout_schedule ON users(payout_schedule) WHERE role = 'MERCHANT';
        CREATE INDEX IF NOT EXISTS idx_users_payout_wallet ON users(payout_wallet_address) WHERE payout_wallet_address IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_products_merchant_commission ON products(merchant_commission_rate);
        CREATE INDEX IF NOT EXISTS idx_products_merchant_cashback ON products(merchant_cashback_cost);
        
        RAISE NOTICE 'Created performance indexes';
        
        -- ==========================================
        -- 4. CREATE UPDATE TRIGGERS
        -- ==========================================
        
        RAISE NOTICE 'Creating update triggers...';
        
        -- Create or replace the update_updated_at_column function if it doesn't exist
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        
        -- Add update triggers for new tables
        CREATE TRIGGER update_merchant_wallets_updated_at
            BEFORE UPDATE ON merchant_wallets
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
            
        CREATE TRIGGER update_merchant_transactions_updated_at
            BEFORE UPDATE ON merchant_transactions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
            
        CREATE TRIGGER update_merchant_payout_requests_updated_at
            BEFORE UPDATE ON merchant_payout_requests
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'Created update triggers';
        
        -- ==========================================
        -- 5. GRANT PERMISSIONS
        -- ==========================================
        
        RAISE NOTICE 'Granting permissions to moobuser role...';
        
        -- Grant permissions to moobuser role for new tables
        GRANT SELECT, INSERT, UPDATE, DELETE ON merchant_wallets TO moobuser;
        GRANT SELECT, INSERT, UPDATE, DELETE ON merchant_transactions TO moobuser;
        GRANT SELECT, INSERT, UPDATE, DELETE ON merchant_payout_requests TO moobuser;
        
        -- Grant sequence permissions
        GRANT USAGE, SELECT ON SEQUENCE merchant_wallets_id_seq TO moobuser;
        GRANT USAGE, SELECT ON SEQUENCE merchant_transactions_id_seq TO moobuser;
        GRANT USAGE, SELECT ON SEQUENCE merchant_payout_requests_id_seq TO moobuser;
        
        RAISE NOTICE 'Granted permissions to moobuser role';
        
        -- ==========================================
        -- 6. INSERT SAMPLE DATA (OPTIONAL)
        -- ==========================================
        
        -- Uncomment the following section to insert sample data for testing
        /*
        RAISE NOTICE 'Inserting sample merchant data for testing...';
        
        -- Insert sample merchant wallet (only if there are existing merchants)
        INSERT INTO merchant_wallets (merchant_id, wallet_address, wallet_type, network, is_active, is_verified)
        SELECT id, '0x1234567890abcdef1234567890abcdef12345678', 'TAIC_PAYOUT', 'FANTOM', true, false
        FROM users 
        WHERE role = 'MERCHANT' 
        LIMIT 1
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Inserted sample merchant data';
        */
        
        -- ==========================================
        -- 7. RECORD MIGRATION COMPLETION
        -- ==========================================
        
        -- Record that this migration has been applied
        INSERT INTO migrations (name) VALUES ('20250705000000_merchant_ecosystem_schema_extensions');
        
        RAISE NOTICE 'Merchant ecosystem schema extensions migration completed successfully!';
        RAISE NOTICE 'New tables created: merchant_wallets, merchant_transactions, merchant_payout_requests';
        RAISE NOTICE 'Updated tables: users (payout fields), products (commission/cashback fields)';
        RAISE NOTICE 'Created indexes for optimal query performance';
        RAISE NOTICE 'Granted permissions to moobuser role';
        
    ELSE
        RAISE NOTICE 'Migration 20250705000000_merchant_ecosystem_schema_extensions has already been applied, skipping...';
    END IF;
END
$$;
