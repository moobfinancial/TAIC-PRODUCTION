-- Migration: Enhanced Product Approval Workflow
-- Adds necessary columns and indexes for Phase 2, Item 3: Enhanced Product Approval Workflow
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
    IF NOT EXISTS (SELECT 1 FROM migrations WHERE name = '20250706000000_enhanced_product_approval_workflow') THEN
        
        -- Ensure admin_review_notes column exists in products table
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'admin_review_notes'
        ) THEN
            ALTER TABLE products ADD COLUMN admin_review_notes TEXT;
            RAISE NOTICE 'Added admin_review_notes column to products table';
        END IF;
        
        -- Ensure approval_status has proper constraint
        DO $constraint_check$
        BEGIN
            -- Drop existing constraint if it exists
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_name = 'products' AND constraint_name = 'check_products_approval_status'
            ) THEN
                ALTER TABLE products DROP CONSTRAINT check_products_approval_status;
            END IF;
            
            -- Add updated constraint with all valid statuses
            ALTER TABLE products ADD CONSTRAINT check_products_approval_status 
                CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected', 'needs_revision'));
            
            RAISE NOTICE 'Updated approval_status constraint on products table';
        END $constraint_check$;
        
        -- Ensure proper indexes exist for approval workflow
        CREATE INDEX IF NOT EXISTS idx_products_approval_status_merchant ON products(approval_status, merchant_id);
        CREATE INDEX IF NOT EXISTS idx_products_merchant_approval ON products(merchant_id, approval_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_products_pending_priority ON products(approval_status, created_at) WHERE approval_status = 'pending';
        
        -- Add index for admin review efficiency
        CREATE INDEX IF NOT EXISTS idx_products_admin_review ON products(approval_status, created_at, merchant_id) WHERE approval_status = 'pending';
        
        -- Ensure merchant_transactions table has proper indexes for approval tracking
        CREATE INDEX IF NOT EXISTS idx_merchant_transactions_reference_type ON merchant_transactions(reference_id, transaction_type);
        CREATE INDEX IF NOT EXISTS idx_merchant_transactions_merchant_type_created ON merchant_transactions(merchant_id, transaction_type, created_at);
        
        -- Create a view for admin approval queue with priority scoring
        CREATE OR REPLACE VIEW admin_approval_queue AS
        WITH merchant_stats AS (
            SELECT 
                merchant_id,
                COUNT(*) as total_submissions,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_submissions,
                CASE 
                    WHEN COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) > 10 THEN 2
                    WHEN COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) > 5 THEN 1
                    ELSE 0
                END as submission_frequency_score
            FROM products
            WHERE approval_status IN ('pending', 'approved', 'rejected')
            GROUP BY merchant_id
        )
        SELECT 
            p.id,
            p.name,
            p.description,
            p.price,
            p.image_url,
            p.merchant_id,
            p.approval_status,
            p.is_active,
            p.admin_review_notes,
            p.created_at,
            p.updated_at,
            p.has_variants,
            p.stock_quantity,
            c.name as category_name,
            u.username as merchant_name,
            u.email as merchant_email,
            u.business_name as merchant_business_name,
            -- Calculate days pending
            EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400 as days_pending,
            -- Priority score calculation
            (
                EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400 * 3 +  -- Days pending * 3
                CASE WHEN p.has_variants THEN 1 ELSE 0 END +               -- Has variants bonus
                CASE 
                    WHEN p.price > 100 THEN 2 
                    WHEN p.price > 50 THEN 1 
                    ELSE 0 
                END +                                                      -- Price tier bonus
                COALESCE(ms.submission_frequency_score, 0)                 -- Merchant activity score
            ) as priority_score,
            -- Variant count
            COALESCE(vc.variant_count, 0) as variant_count
        FROM products p
        LEFT JOIN categories c ON p.platform_category_id = c.id
        LEFT JOIN users u ON p.merchant_id = u.id
        LEFT JOIN merchant_stats ms ON p.merchant_id = ms.merchant_id
        LEFT JOIN (
            SELECT product_id, COUNT(*) as variant_count
            FROM product_variants
            GROUP BY product_id
        ) vc ON p.id = vc.product_id
        WHERE p.approval_status = 'pending';
        
        -- Create a function to update product approval status with audit trail
        CREATE OR REPLACE FUNCTION update_product_approval_status(
            p_product_id TEXT,
            p_new_status TEXT,
            p_admin_id TEXT,
            p_admin_notes TEXT DEFAULT NULL,
            p_set_active BOOLEAN DEFAULT TRUE
        ) RETURNS BOOLEAN AS $func$
        DECLARE
            v_old_status TEXT;
            v_merchant_id UUID;
            v_product_name TEXT;
        BEGIN
            -- Get current product info
            SELECT approval_status, merchant_id, name 
            INTO v_old_status, v_merchant_id, v_product_name
            FROM products 
            WHERE id = p_product_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Product not found: %', p_product_id;
            END IF;
            
            -- Update product status
            UPDATE products 
            SET 
                approval_status = p_new_status,
                is_active = CASE 
                    WHEN p_new_status = 'approved' THEN p_set_active 
                    ELSE FALSE 
                END,
                admin_review_notes = p_admin_notes,
                updated_at = NOW()
            WHERE id = p_product_id;
            
            -- Log the approval action in merchant_transactions
            INSERT INTO merchant_transactions (
                merchant_id, 
                transaction_type, 
                amount, 
                currency, 
                status, 
                description, 
                reference_id, 
                metadata, 
                created_at
            ) VALUES (
                v_merchant_id,
                CASE 
                    WHEN p_new_status = 'approved' THEN 'PRODUCT_APPROVED'
                    WHEN p_new_status = 'rejected' THEN 'PRODUCT_REJECTED'
                    ELSE 'PRODUCT_STATUS_CHANGED'
                END,
                0,
                'TAIC',
                'COMPLETED',
                format('Product "%s" %s by admin %s. %s', 
                    v_product_name, 
                    p_new_status, 
                    p_admin_id,
                    COALESCE('Notes: ' || p_admin_notes, '')
                ),
                format('product_%s_%s_%s', p_new_status, p_product_id, EXTRACT(EPOCH FROM NOW())),
                jsonb_build_object(
                    'productId', p_product_id,
                    'productName', v_product_name,
                    'oldStatus', v_old_status,
                    'newStatus', p_new_status,
                    'adminId', p_admin_id,
                    'adminNotes', p_admin_notes,
                    'setActive', p_set_active,
                    'processedAt', NOW()
                ),
                NOW()
            );
            
            RETURN TRUE;
        END;
        $func$ LANGUAGE plpgsql;
        
        -- Create a function to get approval queue summary
        CREATE OR REPLACE FUNCTION get_approval_queue_summary()
        RETURNS TABLE (
            total_pending BIGINT,
            high_priority_count BIGINT,
            overdue_pending BIGINT,
            avg_pending_days NUMERIC,
            today_submissions BIGINT,
            weekly_submissions BIGINT,
            merchants_with_pending BIGINT
        ) AS $func$
        BEGIN
            RETURN QUERY
            WITH pending_stats AS (
                SELECT 
                    COUNT(*) as total_pending,
                    COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 > 3 THEN 1 END) as overdue_pending,
                    AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) as avg_pending_days,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_submissions,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as weekly_submissions,
                    COUNT(DISTINCT merchant_id) as merchants_with_pending
                FROM products
                WHERE approval_status = 'pending'
            ),
            priority_stats AS (
                SELECT 
                    COUNT(*) as high_priority_count
                FROM admin_approval_queue
                WHERE priority_score > 10
            )
            SELECT 
                ps.total_pending,
                prs.high_priority_count,
                ps.overdue_pending,
                ps.avg_pending_days,
                ps.today_submissions,
                ps.weekly_submissions,
                ps.merchants_with_pending
            FROM pending_stats ps, priority_stats prs;
        END;
        $func$ LANGUAGE plpgsql;
        
        -- Update any existing products with NULL approval_status to 'draft'
        UPDATE products 
        SET approval_status = 'draft' 
        WHERE approval_status IS NULL;
        
        -- Ensure approval_status is NOT NULL
        ALTER TABLE products ALTER COLUMN approval_status SET NOT NULL;
        
        RAISE NOTICE 'Enhanced Product Approval Workflow migration completed successfully';
        
        -- Record migration
        INSERT INTO migrations (name) VALUES ('20250706000000_enhanced_product_approval_workflow');
        
    ELSE
        RAISE NOTICE 'Enhanced Product Approval Workflow migration already applied, skipping';
    END IF;
END$$;

-- Grant necessary permissions for the approval workflow
GRANT SELECT, INSERT, UPDATE ON products TO moobuser;
GRANT SELECT, INSERT ON merchant_transactions TO moobuser;
GRANT SELECT ON admin_approval_queue TO moobuser;
GRANT EXECUTE ON FUNCTION update_product_approval_status(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO moobuser;
GRANT EXECUTE ON FUNCTION get_approval_queue_summary() TO moobuser;

-- Note: Run this migration as superuser with:
-- PGPASSWORD=userfortaicweb psql -U postgres -d moobfinancial -f migrations/20250706000000_enhanced_product_approval_workflow.sql
