-- Migration: Add merchant_id column to products table
-- This migration adds the merchant_id column to the products table
-- which is required by the storefront product detail API endpoint.
-- 
-- Note: This migration must be run as a superuser (postgres) to ensure proper permissions.
-- Example: PGPASSWORD=postgres_password psql -U postgres -d moobfinancial -f migrations/20250616190000_add_merchant_id_to_products.sql

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check if this migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM migrations WHERE name = '20250616190000_add_merchant_id_to_products') THEN
        -- Add merchant_id column to products table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'products' AND column_name = 'merchant_id') THEN
            ALTER TABLE products ADD COLUMN merchant_id UUID;
            
            -- Add foreign key constraint to users table (merchant_id references users.id which is UUID type)
            ALTER TABLE products ADD CONSTRAINT fk_products_merchant_id 
                FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE SET NULL;
                
            -- Add index for performance
            CREATE INDEX idx_products_merchant_id ON products(merchant_id);
            
            -- Grant permissions to moobuser
            GRANT SELECT, INSERT, UPDATE, DELETE ON products TO moobuser;
            
            -- Record that this migration has been applied
            INSERT INTO migrations (name) VALUES ('20250616190000_add_merchant_id_to_products');
            
            RAISE NOTICE 'Migration 20250616190000_add_merchant_id_to_products applied successfully';
        ELSE
            RAISE NOTICE 'Column merchant_id already exists in products table';
        END IF;
    ELSE
        RAISE NOTICE 'Migration 20250616190000_add_merchant_id_to_products has already been applied';
    END IF;
END $$;
