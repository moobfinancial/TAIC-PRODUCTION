-- Migration to add missing columns to categories and products tables
-- Created: 2025-06-16
-- IMPORTANT: This script must be run as a database superuser (postgres)

-- Check if migrations table exists, create it if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'migrations') THEN
        CREATE TABLE migrations (
            name VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
    END IF;
END
$$;

-- Add parent_category_id to categories table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'categories' AND column_name = 'parent_category_id'
    ) THEN
        ALTER TABLE categories ADD COLUMN parent_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_categories_parent_category_id ON categories(parent_category_id);
        RAISE NOTICE 'Added parent_category_id column to categories table';
    ELSE
        RAISE NOTICE 'parent_category_id column already exists in categories table';
    END IF;
END
$$;

-- Add category column to products table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'category'
    ) THEN
        ALTER TABLE products ADD COLUMN category VARCHAR(100);
        RAISE NOTICE 'Added category column to products table';
    ELSE
        RAISE NOTICE 'category column already exists in products table';
    END IF;
END
$$;

-- Log migration completion
INSERT INTO migrations (name, applied_at) VALUES ('20250616114800_add_missing_columns_categories_products', NOW())
ON CONFLICT (name) DO NOTHING;

COMMIT;
