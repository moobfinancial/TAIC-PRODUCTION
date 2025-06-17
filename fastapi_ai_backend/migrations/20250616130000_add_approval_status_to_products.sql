-- Migration: Add approval_status column to products table
-- Run as superuser to avoid permission issues

-- Check if migrations table exists and create if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'migrations') THEN
        CREATE TABLE migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END$$;

-- Add approval_status to products table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'products' 
                   AND column_name = 'approval_status') THEN
        ALTER TABLE products ADD COLUMN approval_status VARCHAR(50);
    END IF;
END$$;

-- Insert migration record
INSERT INTO migrations (name) VALUES ('20250616130000_add_approval_status_to_products');

-- Note: Run as superuser (postgres) to avoid permission issues with:
-- PGPASSWORD=noel112171 psql -U postgres -d moobfinancial -f /path/to/this/migration.sql
