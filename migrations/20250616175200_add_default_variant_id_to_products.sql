-- Migration: Add default_variant_id column to products table
-- This migration adds a foreign key column to link products with their default variant

-- Note: This migration must be run as a database superuser or the owner of the products table
-- Run with: PGPASSWORD=postgres psql -U postgres -d moobfinancial -f migrations/20250616175200_add_default_variant_id_to_products.sql

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check if migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migrations WHERE name = '20250616175200_add_default_variant_id_to_products') THEN
        RAISE NOTICE 'Migration 20250616175200_add_default_variant_id_to_products already applied, skipping';
    ELSE
        -- Add default_variant_id column to products table if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'default_variant_id'
        ) THEN
            ALTER TABLE products ADD COLUMN default_variant_id INTEGER;
            
            -- Add foreign key constraint - note that the referenced table must exist
            -- This will reference product_variants(id)
            ALTER TABLE products 
            ADD CONSTRAINT fk_products_default_variant 
            FOREIGN KEY (default_variant_id) 
            REFERENCES product_variants(id) 
            ON DELETE SET NULL;
            
            -- Add index for better performance
            CREATE INDEX idx_products_default_variant_id ON products(default_variant_id);
            
            RAISE NOTICE 'Added default_variant_id column to products table';
        ELSE
            RAISE NOTICE 'Column default_variant_id already exists in products table';
        END IF;
        
        -- Record that this migration has been applied
        INSERT INTO migrations (name) VALUES ('20250616175200_add_default_variant_id_to_products');
        RAISE NOTICE 'Migration 20250616175200_add_default_variant_id_to_products applied successfully';
    END IF;
END $$;
