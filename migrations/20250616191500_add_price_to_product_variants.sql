-- Migration: Add price column to product_variants table
-- This migration adds the price column to the product_variants table
-- to match what the storefront product detail API endpoint expects.
-- 
-- Note: This migration must be run as a superuser (postgres) to ensure proper permissions.
-- Example: PGPASSWORD=postgres_password psql -U postgres -d moobfinancial -f migrations/20250616191500_add_price_to_product_variants.sql

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check if this migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM migrations WHERE name = '20250616191500_add_price_to_product_variants') THEN
        -- Add price column to product_variants table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'product_variants' AND column_name = 'price') THEN
            -- Add price column as a copy of specific_price
            ALTER TABLE product_variants ADD COLUMN price DECIMAL(10, 2);
            
            -- Copy values from specific_price to price
            UPDATE product_variants SET price = specific_price;
            
            -- Make price NOT NULL with default 0
            ALTER TABLE product_variants ALTER COLUMN price SET NOT NULL;
            ALTER TABLE product_variants ALTER COLUMN price SET DEFAULT 0;
            
            -- Grant permissions to moobuser
            GRANT SELECT, INSERT, UPDATE, DELETE ON product_variants TO moobuser;
            
            -- Record that this migration has been applied
            INSERT INTO migrations (name) VALUES ('20250616191500_add_price_to_product_variants');
            
            RAISE NOTICE 'Migration 20250616191500_add_price_to_product_variants applied successfully';
        ELSE
            RAISE NOTICE 'Column price already exists in product_variants table';
        END IF;
    ELSE
        RAISE NOTICE 'Migration 20250616191500_add_price_to_product_variants has already been applied';
    END IF;
END $$;
