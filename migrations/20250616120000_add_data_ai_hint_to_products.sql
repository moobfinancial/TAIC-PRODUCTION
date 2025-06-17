-- Migration to add data_ai_hint column to products table
-- Created: 2025-06-16

-- Add data_ai_hint to products table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'data_ai_hint'
    ) THEN
        ALTER TABLE products ADD COLUMN data_ai_hint TEXT;
        RAISE NOTICE 'Added data_ai_hint column to products table';
    ELSE
        RAISE NOTICE 'data_ai_hint column already exists in products table';
    END IF;
END
$$;

-- Log migration completion if migrations table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'migrations') THEN
        INSERT INTO migrations (name, applied_at) VALUES ('20250616120000_add_data_ai_hint_to_products', NOW())
        ON CONFLICT (name) DO NOTHING;
    END IF;
END
$$;

COMMIT;
