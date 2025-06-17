-- Migration: Comprehensive Schema Alignment
-- This migration ensures all tables match the updated schema.sql definitions
-- It adds missing columns, adjusts data types, and ensures constraints are properly applied.
-- 
-- Note: This migration must be run as a superuser (postgres) to ensure proper permissions.
-- Example: PGPASSWORD=postgres_password psql -U postgres -d moobfinancial -f migrations/20250616200000_comprehensive_schema_alignment.sql

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check if this migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM migrations WHERE name = '20250616200000_comprehensive_schema_alignment') THEN
        RAISE NOTICE 'Starting comprehensive schema alignment migration...';
        
        -- ==========================================
        -- Users Table Alignment
        -- ==========================================
        
        -- Ensure users.id is UUID type with gen_random_uuid() default
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'id' 
            AND data_type != 'uuid'
        ) THEN
            -- This is a complex operation that might require data migration
            -- We'll need to handle this carefully if needed
            RAISE NOTICE 'WARNING: users.id is not UUID type. Manual intervention may be required.';
        END IF;
        
        -- Add username column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'username'
        ) THEN
            ALTER TABLE users ADD COLUMN username VARCHAR(50);
            ALTER TABLE users ALTER COLUMN username SET NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
            RAISE NOTICE 'Added username column to users table';
        END IF;
        
        -- Add business_name column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'business_name'
        ) THEN
            ALTER TABLE users ADD COLUMN business_name VARCHAR(100);
            RAISE NOTICE 'Added business_name column to users table';
        END IF;
        
        -- Add business_description column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'business_description'
        ) THEN
            ALTER TABLE users ADD COLUMN business_description TEXT;
            RAISE NOTICE 'Added business_description column to users table';
        END IF;
        
        -- Add is_superuser column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'is_superuser'
        ) THEN
            ALTER TABLE users ADD COLUMN is_superuser BOOLEAN DEFAULT FALSE;
            RAISE NOTICE 'Added is_superuser column to users table';
        END IF;
        
        -- ==========================================
        -- Products Table Alignment
        -- ==========================================
        
        -- Ensure products.id is SERIAL/INTEGER type
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'id' 
            AND data_type NOT IN ('integer', 'bigint')
        ) THEN
            -- This is a complex operation that might require data migration
            RAISE NOTICE 'WARNING: products.id is not INTEGER type. Manual intervention may be required.';
        END IF;
        
        -- Add stock_quantity column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'stock_quantity'
        ) THEN
            ALTER TABLE products ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;
            RAISE NOTICE 'Added stock_quantity column to products table';
        END IF;
        
        -- Add category column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'category'
        ) THEN
            ALTER TABLE products ADD COLUMN category VARCHAR(100);
            RAISE NOTICE 'Added category column to products table';
        END IF;
        
        -- Add platform_category_id column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'platform_category_id'
        ) THEN
            ALTER TABLE products ADD COLUMN platform_category_id INTEGER;
            ALTER TABLE products ADD CONSTRAINT fk_products_platform_category 
                FOREIGN KEY (platform_category_id) REFERENCES categories(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_products_platform_category_id ON products(platform_category_id);
            RAISE NOTICE 'Added platform_category_id column to products table';
        END IF;
        
        -- Add data_ai_hint column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'data_ai_hint'
        ) THEN
            ALTER TABLE products ADD COLUMN data_ai_hint TEXT;
            RAISE NOTICE 'Added data_ai_hint column to products table';
        END IF;
        
        -- Add approval_status column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'approval_status'
        ) THEN
            ALTER TABLE products ADD COLUMN approval_status VARCHAR(50) DEFAULT 'pending';
            CREATE INDEX IF NOT EXISTS idx_products_approval_status ON products(approval_status);
            RAISE NOTICE 'Added approval_status column to products table';
        END IF;
        
        -- Add default_variant_id column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'default_variant_id'
        ) THEN
            ALTER TABLE products ADD COLUMN default_variant_id INTEGER;
            CREATE INDEX IF NOT EXISTS idx_products_default_variant_id ON products(default_variant_id);
            RAISE NOTICE 'Added default_variant_id column to products table';
            
            -- Add foreign key constraint if not exists
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_products_default_variant'
            ) THEN
                ALTER TABLE products ADD CONSTRAINT fk_products_default_variant 
                    FOREIGN KEY (default_variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;
                RAISE NOTICE 'Added foreign key constraint for default_variant_id';
            END IF;
        END IF;
        
        -- Add merchant_id column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'merchant_id'
        ) THEN
            ALTER TABLE products ADD COLUMN merchant_id UUID;
            ALTER TABLE products ADD CONSTRAINT fk_products_merchant_id 
                FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON products(merchant_id);
            RAISE NOTICE 'Added merchant_id column to products table';
        END IF;
        
        -- ==========================================
        -- Product_Variants Table Alignment
        -- ==========================================
        
        -- Ensure product_variants.product_id is INTEGER type
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'product_variants' AND column_name = 'product_id' 
            AND data_type NOT IN ('integer', 'bigint')
        ) THEN
            -- This is a complex operation that might require data migration
            RAISE NOTICE 'WARNING: product_variants.product_id is not INTEGER type. Manual intervention may be required.';
        END IF;
        
        -- Add specific_price column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'product_variants' AND column_name = 'specific_price'
        ) THEN
            ALTER TABLE product_variants ADD COLUMN specific_price DECIMAL(10, 2);
            RAISE NOTICE 'Added specific_price column to product_variants table';
        END IF;
        
        -- Add price column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'product_variants' AND column_name = 'price'
        ) THEN
            ALTER TABLE product_variants ADD COLUMN price DECIMAL(10, 2) NOT NULL DEFAULT 0;
            -- Copy values from specific_price to price if specific_price exists
            UPDATE product_variants SET price = specific_price WHERE specific_price IS NOT NULL;
            RAISE NOTICE 'Added price column to product_variants table';
        END IF;
        
        -- ==========================================
        -- Categories Table Alignment
        -- ==========================================
        
        -- Add slug column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'categories' AND column_name = 'slug'
        ) THEN
            ALTER TABLE categories ADD COLUMN slug VARCHAR(100);
            -- Generate slugs from names for existing records
            UPDATE categories SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;
            ALTER TABLE categories ALTER COLUMN slug SET NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories(slug);
            RAISE NOTICE 'Added slug column to categories table';
        END IF;
        
        -- Add parent_category_id column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'categories' AND column_name = 'parent_category_id'
        ) THEN
            ALTER TABLE categories ADD COLUMN parent_category_id INTEGER;
            ALTER TABLE categories ADD CONSTRAINT categories_parent_category_id_fkey 
                FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_categories_parent_category_id ON categories(parent_category_id);
            RAISE NOTICE 'Added parent_category_id column to categories table';
        END IF;
        
        -- ==========================================
        -- CJ_Products Table Alignment
        -- ==========================================
        
        -- Add original_name column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cj_products' AND column_name = 'original_name'
        ) THEN
            ALTER TABLE cj_products ADD COLUMN original_name TEXT;
            RAISE NOTICE 'Added original_name column to cj_products table';
        END IF;
        
        -- Add original_description column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cj_products' AND column_name = 'original_description'
        ) THEN
            ALTER TABLE cj_products ADD COLUMN original_description TEXT;
            RAISE NOTICE 'Added original_description column to cj_products table';
        END IF;
        
        -- Add approval_status column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cj_products' AND column_name = 'approval_status'
        ) THEN
            ALTER TABLE cj_products ADD COLUMN approval_status TEXT DEFAULT 'pending';
            RAISE NOTICE 'Added approval_status column to cj_products table';
        END IF;
        
        -- ==========================================
        -- Grant Permissions
        -- ==========================================
        
        -- Grant permissions to moobuser role for all tables
        GRANT SELECT, INSERT, UPDATE, DELETE ON users TO moobuser;
        GRANT SELECT, INSERT, UPDATE, DELETE ON products TO moobuser;
        GRANT SELECT, INSERT, UPDATE, DELETE ON product_variants TO moobuser;
        GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO moobuser;
        GRANT SELECT, INSERT, UPDATE, DELETE ON cj_products TO moobuser;
        GRANT SELECT, INSERT, UPDATE, DELETE ON migrations TO moobuser;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO moobuser;
        
        RAISE NOTICE 'Granted permissions to moobuser role';
        
        -- Record that this migration has been applied
        INSERT INTO migrations (name) VALUES ('20250616200000_comprehensive_schema_alignment');
        RAISE NOTICE 'Migration 20250616200000_comprehensive_schema_alignment applied successfully';
    ELSE
        RAISE NOTICE 'Migration 20250616200000_comprehensive_schema_alignment has already been applied';
    END IF;
END $$;
