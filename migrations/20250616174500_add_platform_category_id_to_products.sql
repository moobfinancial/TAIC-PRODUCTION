-- Migration: Add platform_category_id column to products table
-- This migration adds a foreign key column to link products with platform categories

-- Note: This migration must be run as a database superuser or the owner of the products table
-- Run with: PGPASSWORD=your_password psql -U postgres -d moobfinancial -f migrations/20250616174500_add_platform_category_id_to_products.sql

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check if migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migrations WHERE name = '20250616174500_add_platform_category_id_to_products') THEN
        RAISE NOTICE 'Migration 20250616174500_add_platform_category_id_to_products already applied, skipping';
    ELSE
        -- Add platform_category_id column to products table if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'platform_category_id'
        ) THEN
            ALTER TABLE products ADD COLUMN platform_category_id INTEGER;
            
            -- Add foreign key constraint
            ALTER TABLE products 
            ADD CONSTRAINT fk_products_platform_category 
            FOREIGN KEY (platform_category_id) 
            REFERENCES categories(id) 
            ON DELETE SET NULL;
            
            RAISE NOTICE 'Added platform_category_id column to products table';
        ELSE
            RAISE NOTICE 'Column platform_category_id already exists in products table';
        END IF;
        
        -- Record that this migration has been applied
        INSERT INTO migrations (name) VALUES ('20250616174500_add_platform_category_id_to_products');
        RAISE NOTICE 'Migration 20250616174500_add_platform_category_id_to_products applied successfully';
    END IF;
END $$;
