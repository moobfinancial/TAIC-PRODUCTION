-- Migration: Treasury Wallet System with Multi-Signature Capabilities
-- Adds comprehensive treasury management infrastructure for Phase 3, Item 2
-- Run as superuser to avoid permission issues

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check if this migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM migrations WHERE name = '20250706000001_treasury_wallet_system_multisig') THEN
        
        -- Create treasury_wallets table
        CREATE TABLE IF NOT EXISTS treasury_wallets (
            id VARCHAR(255) PRIMARY KEY,
            wallet_type VARCHAR(50) NOT NULL CHECK (wallet_type IN ('MAIN_TREASURY', 'PAYOUT_RESERVE', 'STAKING_REWARDS', 'EMERGENCY_RESERVE', 'OPERATIONAL')),
            network VARCHAR(20) NOT NULL CHECK (network IN ('FANTOM', 'ETHEREUM', 'POLYGON', 'BSC', 'BITCOIN')),
            address VARCHAR(255) NOT NULL,
            is_multi_sig BOOLEAN NOT NULL DEFAULT true,
            required_signatures INTEGER NOT NULL DEFAULT 2,
            total_signers INTEGER NOT NULL DEFAULT 3,
            signers JSONB NOT NULL DEFAULT '[]',
            status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'EMERGENCY_LOCKED')),
            security_level VARCHAR(20) NOT NULL DEFAULT 'HIGH' CHECK (security_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
            daily_limit DECIMAL(20,8) NOT NULL DEFAULT 1000000,
            monthly_limit DECIMAL(20,8) NOT NULL DEFAULT 10000000,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(wallet_type, network, status) DEFERRABLE INITIALLY DEFERRED
        );

        -- Create multisig_transactions table
        CREATE TABLE IF NOT EXISTS multisig_transactions (
            id VARCHAR(255) PRIMARY KEY,
            treasury_wallet_id VARCHAR(255) NOT NULL REFERENCES treasury_wallets(id) ON DELETE CASCADE,
            transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('PAYOUT', 'TRANSFER', 'EMERGENCY', 'MAINTENANCE', 'REBALANCE')),
            from_address VARCHAR(255) NOT NULL,
            to_address VARCHAR(255) NOT NULL,
            amount DECIMAL(20,8) NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'TAIC',
            network VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_SIGNED', 'FULLY_SIGNED', 'EXECUTED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
            required_signatures INTEGER NOT NULL,
            current_signatures INTEGER NOT NULL DEFAULT 0,
            transaction_data TEXT,
            nonce INTEGER NOT NULL DEFAULT 0,
            gas_limit VARCHAR(50) NOT NULL DEFAULT '21000',
            gas_price VARCHAR(50) NOT NULL DEFAULT '0',
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_by VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            executed_at TIMESTAMP WITH TIME ZONE,
            transaction_hash VARCHAR(255),
            block_number BIGINT,
            reason TEXT NOT NULL,
            metadata JSONB DEFAULT '{}'
        );

        -- Create multisig_signatures table
        CREATE TABLE IF NOT EXISTS multisig_signatures (
            id SERIAL PRIMARY KEY,
            transaction_id VARCHAR(255) NOT NULL REFERENCES multisig_transactions(id) ON DELETE CASCADE,
            signer_id VARCHAR(255) NOT NULL,
            signer_address VARCHAR(255) NOT NULL,
            signature TEXT NOT NULL,
            signed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            ip_address INET,
            user_agent TEXT,
            UNIQUE(transaction_id, signer_address)
        );

        -- Create treasury_operations table
        CREATE TABLE IF NOT EXISTS treasury_operations (
            id VARCHAR(255) PRIMARY KEY,
            operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'REBALANCE', 'EMERGENCY_ACTION')),
            treasury_wallet_id VARCHAR(255) NOT NULL REFERENCES treasury_wallets(id) ON DELETE CASCADE,
            multisig_transaction_id VARCHAR(255) REFERENCES multisig_transactions(id),
            amount DECIMAL(20,8) NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'TAIC',
            network VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
            priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
            initiated_by VARCHAR(255) NOT NULL,
            approved_by JSONB DEFAULT '[]',
            reason TEXT NOT NULL,
            risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP WITH TIME ZONE
        );

        -- Create treasury_audit_log table
        CREATE TABLE IF NOT EXISTS treasury_audit_log (
            id SERIAL PRIMARY KEY,
            treasury_wallet_id VARCHAR(255) REFERENCES treasury_wallets(id) ON DELETE CASCADE,
            action VARCHAR(100) NOT NULL,
            performed_by VARCHAR(255) NOT NULL,
            details JSONB DEFAULT '{}',
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create treasury_emergency_locks table
        CREATE TABLE IF NOT EXISTS treasury_emergency_locks (
            id SERIAL PRIMARY KEY,
            treasury_wallet_id VARCHAR(255) NOT NULL REFERENCES treasury_wallets(id) ON DELETE CASCADE,
            reason TEXT NOT NULL,
            lock_duration_hours INTEGER NOT NULL,
            locked_by VARCHAR(255) NOT NULL,
            locked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            unlock_at TIMESTAMP WITH TIME ZONE NOT NULL,
            unlocked_at TIMESTAMP WITH TIME ZONE,
            unlocked_by VARCHAR(255),
            is_active BOOLEAN DEFAULT true
        );

        -- Create treasury_compliance_checks table
        CREATE TABLE IF NOT EXISTS treasury_compliance_checks (
            id SERIAL PRIMARY KEY,
            treasury_operation_id VARCHAR(255) REFERENCES treasury_operations(id) ON DELETE CASCADE,
            check_type VARCHAR(20) NOT NULL CHECK (check_type IN ('AML', 'KYC', 'SANCTIONS', 'RISK_ASSESSMENT', 'REGULATORY')),
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PASSED', 'FAILED', 'MANUAL_REVIEW')),
            score INTEGER CHECK (score >= 0 AND score <= 100),
            details TEXT,
            checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            checked_by VARCHAR(255) NOT NULL
        );

        -- Create treasury_balances table for tracking wallet balances
        CREATE TABLE IF NOT EXISTS treasury_balances (
            id SERIAL PRIMARY KEY,
            treasury_wallet_id VARCHAR(255) NOT NULL REFERENCES treasury_wallets(id) ON DELETE CASCADE,
            currency VARCHAR(10) NOT NULL,
            balance DECIMAL(20,8) NOT NULL DEFAULT 0,
            reserved_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
            available_balance DECIMAL(20,8) GENERATED ALWAYS AS (balance - reserved_balance) STORED,
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(treasury_wallet_id, currency)
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_treasury_wallets_type_network ON treasury_wallets(wallet_type, network);
        CREATE INDEX IF NOT EXISTS idx_treasury_wallets_status ON treasury_wallets(status);
        CREATE INDEX IF NOT EXISTS idx_treasury_wallets_security_level ON treasury_wallets(security_level);

        CREATE INDEX IF NOT EXISTS idx_multisig_transactions_wallet_id ON multisig_transactions(treasury_wallet_id);
        CREATE INDEX IF NOT EXISTS idx_multisig_transactions_status ON multisig_transactions(status);
        CREATE INDEX IF NOT EXISTS idx_multisig_transactions_expires_at ON multisig_transactions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_multisig_transactions_created_at ON multisig_transactions(created_at);
        CREATE INDEX IF NOT EXISTS idx_multisig_transactions_type_status ON multisig_transactions(transaction_type, status);

        CREATE INDEX IF NOT EXISTS idx_multisig_signatures_transaction_id ON multisig_signatures(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_multisig_signatures_signer ON multisig_signatures(signer_address);

        CREATE INDEX IF NOT EXISTS idx_treasury_operations_wallet_id ON treasury_operations(treasury_wallet_id);
        CREATE INDEX IF NOT EXISTS idx_treasury_operations_status ON treasury_operations(status);
        CREATE INDEX IF NOT EXISTS idx_treasury_operations_priority ON treasury_operations(priority);
        CREATE INDEX IF NOT EXISTS idx_treasury_operations_created_at ON treasury_operations(created_at);

        CREATE INDEX IF NOT EXISTS idx_treasury_audit_log_wallet_id ON treasury_audit_log(treasury_wallet_id);
        CREATE INDEX IF NOT EXISTS idx_treasury_audit_log_action ON treasury_audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_treasury_audit_log_created_at ON treasury_audit_log(created_at);

        CREATE INDEX IF NOT EXISTS idx_treasury_emergency_locks_wallet_id ON treasury_emergency_locks(treasury_wallet_id);
        CREATE INDEX IF NOT EXISTS idx_treasury_emergency_locks_active ON treasury_emergency_locks(is_active);

        CREATE INDEX IF NOT EXISTS idx_treasury_balances_wallet_currency ON treasury_balances(treasury_wallet_id, currency);

        -- Create view for treasury dashboard summary
        CREATE OR REPLACE VIEW treasury_dashboard_summary AS
        SELECT 
            tw.wallet_type,
            tw.network,
            tw.status,
            tw.security_level,
            COUNT(*) as wallet_count,
            SUM(CASE WHEN tb.currency = 'TAIC' THEN tb.balance ELSE 0 END) as total_taic_balance,
            SUM(CASE WHEN tb.currency != 'TAIC' THEN tb.balance ELSE 0 END) as total_native_balance,
            COUNT(CASE WHEN mst.status = 'PENDING' THEN 1 END) as pending_transactions,
            COUNT(CASE WHEN mst.status = 'FULLY_SIGNED' THEN 1 END) as ready_for_execution
        FROM treasury_wallets tw
        LEFT JOIN treasury_balances tb ON tw.id = tb.treasury_wallet_id
        LEFT JOIN multisig_transactions mst ON tw.id = mst.treasury_wallet_id
        GROUP BY tw.wallet_type, tw.network, tw.status, tw.security_level;

        -- Create view for pending multi-sig transactions with priority
        CREATE OR REPLACE VIEW pending_multisig_transactions AS
        SELECT 
            mst.*,
            tw.wallet_type,
            tw.security_level,
            tw.required_signatures,
            tw.total_signers,
            EXTRACT(EPOCH FROM (NOW() - mst.created_at)) / 3600 as hours_pending,
            CASE 
                WHEN mst.transaction_type = 'EMERGENCY' THEN 100
                WHEN mst.transaction_type = 'PAYOUT' AND mst.amount > 100000 THEN 80
                WHEN mst.transaction_type = 'TRANSFER' AND mst.amount > 50000 THEN 60
                WHEN EXTRACT(EPOCH FROM (NOW() - mst.created_at)) / 3600 > 24 THEN 70
                ELSE 40
            END as priority_score
        FROM multisig_transactions mst
        JOIN treasury_wallets tw ON mst.treasury_wallet_id = tw.id
        WHERE mst.status IN ('PENDING', 'PARTIALLY_SIGNED', 'FULLY_SIGNED')
        ORDER BY priority_score DESC, mst.created_at ASC;

        -- Create function to automatically expire old transactions
        CREATE OR REPLACE FUNCTION expire_old_multisig_transactions()
        RETURNS INTEGER AS $$
        DECLARE
            expired_count INTEGER;
        BEGIN
            UPDATE multisig_transactions
            SET status = 'EXPIRED', updated_at = NOW()
            WHERE status IN ('PENDING', 'PARTIALLY_SIGNED') 
            AND expires_at < NOW();
            
            GET DIAGNOSTICS expired_count = ROW_COUNT;
            
            -- Log expired transactions
            INSERT INTO treasury_audit_log (action, performed_by, details, created_at)
            VALUES ('AUTO_EXPIRE_TRANSACTIONS', 'SYSTEM', 
                    jsonb_build_object('expired_count', expired_count), NOW());
            
            RETURN expired_count;
        END;
        $$ LANGUAGE plpgsql;

        -- Create function to calculate treasury wallet risk score
        CREATE OR REPLACE FUNCTION calculate_treasury_risk_score(wallet_id VARCHAR(255))
        RETURNS INTEGER AS $$
        DECLARE
            risk_score INTEGER := 0;
            wallet_info RECORD;
            recent_transactions INTEGER;
            large_transactions INTEGER;
        BEGIN
            -- Get wallet information
            SELECT * INTO wallet_info FROM treasury_wallets WHERE id = wallet_id;
            
            IF NOT FOUND THEN
                RETURN 0;
            END IF;
            
            -- Base risk by security level
            CASE wallet_info.security_level
                WHEN 'CRITICAL' THEN risk_score := risk_score + 10;
                WHEN 'HIGH' THEN risk_score := risk_score + 20;
                WHEN 'MEDIUM' THEN risk_score := risk_score + 40;
                WHEN 'LOW' THEN risk_score := risk_score + 60;
            END CASE;
            
            -- Risk by wallet type
            CASE wallet_info.wallet_type
                WHEN 'MAIN_TREASURY' THEN risk_score := risk_score + 5;
                WHEN 'EMERGENCY_RESERVE' THEN risk_score := risk_score + 10;
                WHEN 'OPERATIONAL' THEN risk_score := risk_score + 30;
            END CASE;
            
            -- Recent transaction volume risk
            SELECT COUNT(*) INTO recent_transactions
            FROM multisig_transactions
            WHERE treasury_wallet_id = wallet_id
            AND created_at > NOW() - INTERVAL '24 hours';
            
            IF recent_transactions > 10 THEN
                risk_score := risk_score + 20;
            ELSIF recent_transactions > 5 THEN
                risk_score := risk_score + 10;
            END IF;
            
            -- Large transaction risk
            SELECT COUNT(*) INTO large_transactions
            FROM multisig_transactions
            WHERE treasury_wallet_id = wallet_id
            AND amount > 100000
            AND created_at > NOW() - INTERVAL '7 days';
            
            IF large_transactions > 3 THEN
                risk_score := risk_score + 15;
            ELSIF large_transactions > 1 THEN
                risk_score := risk_score + 5;
            END IF;
            
            RETURN LEAST(risk_score, 100);
        END;
        $$ LANGUAGE plpgsql;

        -- Create function to update treasury wallet balances
        CREATE OR REPLACE FUNCTION update_treasury_balance(
            wallet_id VARCHAR(255),
            currency_code VARCHAR(10),
            new_balance DECIMAL(20,8)
        ) RETURNS BOOLEAN AS $$
        BEGIN
            INSERT INTO treasury_balances (treasury_wallet_id, currency, balance, last_updated)
            VALUES (wallet_id, currency_code, new_balance, NOW())
            ON CONFLICT (treasury_wallet_id, currency)
            DO UPDATE SET 
                balance = EXCLUDED.balance,
                last_updated = EXCLUDED.last_updated;
            
            RETURN TRUE;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN FALSE;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger to update treasury wallet updated_at timestamp
        CREATE OR REPLACE FUNCTION update_treasury_wallet_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_update_treasury_wallet_timestamp
            BEFORE UPDATE ON treasury_wallets
            FOR EACH ROW
            EXECUTE FUNCTION update_treasury_wallet_timestamp();

        -- Create trigger to update multisig transaction timestamp
        CREATE OR REPLACE FUNCTION update_multisig_transaction_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_update_multisig_transaction_timestamp
            BEFORE UPDATE ON multisig_transactions
            FOR EACH ROW
            EXECUTE FUNCTION update_multisig_transaction_timestamp();

        RAISE NOTICE 'Treasury Wallet System with Multi-Signature Capabilities migration completed successfully';
        
        -- Record migration
        INSERT INTO migrations (name) VALUES ('20250706000001_treasury_wallet_system_multisig');
        
    ELSE
        RAISE NOTICE 'Treasury Wallet System migration already applied, skipping';
    END IF;
END$$;

-- Grant necessary permissions for the treasury system
GRANT SELECT, INSERT, UPDATE, DELETE ON treasury_wallets TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON multisig_transactions TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON multisig_signatures TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON treasury_operations TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON treasury_audit_log TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON treasury_emergency_locks TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON treasury_compliance_checks TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON treasury_balances TO moobuser;

GRANT SELECT ON treasury_dashboard_summary TO moobuser;
GRANT SELECT ON pending_multisig_transactions TO moobuser;

GRANT EXECUTE ON FUNCTION expire_old_multisig_transactions() TO moobuser;
GRANT EXECUTE ON FUNCTION calculate_treasury_risk_score(VARCHAR(255)) TO moobuser;
GRANT EXECUTE ON FUNCTION update_treasury_balance(VARCHAR(255), VARCHAR(10), DECIMAL(20,8)) TO moobuser;

-- Note: Run this migration as superuser with:
-- PGPASSWORD=userfortaicweb psql -U postgres -d moobfinancial -f migrations/20250706000001_treasury_wallet_system_multisig.sql
