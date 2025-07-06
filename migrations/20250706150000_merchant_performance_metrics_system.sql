-- Migration: Merchant Performance Metrics and Reporting System
-- Adds comprehensive analytics infrastructure for Phase 2, Item 4
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
    IF NOT EXISTS (SELECT 1 FROM migrations WHERE name = '20250706150000_merchant_performance_metrics_system') THEN
        
        -- Create merchant_performance_metrics table for aggregated daily metrics
        CREATE TABLE IF NOT EXISTS merchant_performance_metrics (
            id SERIAL PRIMARY KEY,
            merchant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            metric_date DATE NOT NULL,
            
            -- Financial metrics
            total_revenue DECIMAL(20,8) NOT NULL DEFAULT 0,
            total_commissions DECIMAL(20,8) NOT NULL DEFAULT 0,
            net_earnings DECIMAL(20,8) NOT NULL DEFAULT 0,
            available_balance DECIMAL(20,8) NOT NULL DEFAULT 0,
            average_order_value DECIMAL(20,8) NOT NULL DEFAULT 0,
            commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            
            -- Order metrics
            total_orders INTEGER NOT NULL DEFAULT 0,
            fulfilled_orders INTEGER NOT NULL DEFAULT 0,
            cancelled_orders INTEGER NOT NULL DEFAULT 0,
            fulfillment_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            cancellation_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            average_processing_time DECIMAL(10,2) NOT NULL DEFAULT 0, -- hours
            
            -- Product metrics
            total_products INTEGER NOT NULL DEFAULT 0,
            active_products INTEGER NOT NULL DEFAULT 0,
            approved_products INTEGER NOT NULL DEFAULT 0,
            approval_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            inventory_health DECIMAL(5,2) NOT NULL DEFAULT 100,
            low_stock_alerts INTEGER NOT NULL DEFAULT 0,
            out_of_stock_alerts INTEGER NOT NULL DEFAULT 0,
            
            -- Automation metrics
            risk_score INTEGER NOT NULL DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
            automation_level VARCHAR(20) NOT NULL DEFAULT 'PARTIAL' CHECK (automation_level IN ('FULL', 'PARTIAL', 'MANUAL_REVIEW')),
            automation_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            payout_efficiency DECIMAL(5,2) NOT NULL DEFAULT 0,
            total_automated_payouts INTEGER NOT NULL DEFAULT 0,
            automation_savings DECIMAL(10,2) NOT NULL DEFAULT 0,
            
            -- Payout metrics
            total_payouts INTEGER NOT NULL DEFAULT 0,
            total_payout_amount DECIMAL(20,8) NOT NULL DEFAULT 0,
            successful_payouts INTEGER NOT NULL DEFAULT 0,
            payout_success_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            average_payout_amount DECIMAL(20,8) NOT NULL DEFAULT 0,
            
            -- Performance metrics
            performance_score DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (performance_score >= 0 AND performance_score <= 100),
            platform_rank INTEGER NOT NULL DEFAULT 1,
            merchant_tier VARCHAR(10) NOT NULL DEFAULT 'BRONZE' CHECK (merchant_tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND')),
            
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            UNIQUE(merchant_id, metric_date)
        );

        -- Create merchant_performance_insights table for AI-generated insights
        CREATE TABLE IF NOT EXISTS merchant_performance_insights (
            id SERIAL PRIMARY KEY,
            merchant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            insight_type VARCHAR(20) NOT NULL CHECK (insight_type IN ('OPPORTUNITY', 'WARNING', 'SUCCESS', 'RECOMMENDATION')),
            category VARCHAR(20) NOT NULL CHECK (category IN ('REVENUE', 'ORDERS', 'PRODUCTS', 'AUTOMATION', 'PAYOUTS')),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            impact VARCHAR(10) NOT NULL CHECK (impact IN ('HIGH', 'MEDIUM', 'LOW')),
            actionable BOOLEAN NOT NULL DEFAULT false,
            recommendation TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            acknowledged_at TIMESTAMP WITH TIME ZONE,
            acknowledged_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create merchant_performance_comparisons table for benchmarking
        CREATE TABLE IF NOT EXISTS merchant_performance_comparisons (
            id SERIAL PRIMARY KEY,
            merchant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            comparison_date DATE NOT NULL,
            metric_name VARCHAR(100) NOT NULL,
            merchant_value DECIMAL(20,8) NOT NULL,
            platform_average DECIMAL(20,8) NOT NULL,
            percentile DECIMAL(5,2) NOT NULL DEFAULT 50,
            trend VARCHAR(10) NOT NULL CHECK (trend IN ('ABOVE', 'BELOW', 'AVERAGE')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            UNIQUE(merchant_id, comparison_date, metric_name)
        );

        -- Create platform_analytics table for platform-wide metrics
        CREATE TABLE IF NOT EXISTS platform_analytics (
            id SERIAL PRIMARY KEY,
            metric_date DATE NOT NULL,
            timeframe VARCHAR(10) NOT NULL CHECK (timeframe IN ('DAILY', 'WEEKLY', 'MONTHLY')),
            
            -- Platform overview
            total_merchants INTEGER NOT NULL DEFAULT 0,
            active_merchants INTEGER NOT NULL DEFAULT 0,
            new_merchants INTEGER NOT NULL DEFAULT 0,
            total_revenue DECIMAL(20,8) NOT NULL DEFAULT 0,
            total_orders INTEGER NOT NULL DEFAULT 0,
            average_performance_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            
            -- Growth metrics
            revenue_growth DECIMAL(5,2) NOT NULL DEFAULT 0,
            merchant_growth DECIMAL(5,2) NOT NULL DEFAULT 0,
            order_growth DECIMAL(5,2) NOT NULL DEFAULT 0,
            automation_adoption DECIMAL(5,2) NOT NULL DEFAULT 0,
            
            -- Distribution metrics
            tier_distribution JSONB DEFAULT '{}',
            automation_distribution JSONB DEFAULT '{}',
            performance_distribution JSONB DEFAULT '{}',
            
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            UNIQUE(metric_date, timeframe)
        );

        -- Create merchant_reports table for custom report generation
        CREATE TABLE IF NOT EXISTS merchant_reports (
            id SERIAL PRIMARY KEY,
            merchant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            report_name VARCHAR(255) NOT NULL,
            report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('PERFORMANCE', 'FINANCIAL', 'ORDERS', 'PRODUCTS', 'CUSTOM')),
            date_range_start DATE NOT NULL,
            date_range_end DATE NOT NULL,
            filters JSONB DEFAULT '{}',
            report_data JSONB NOT NULL,
            generated_by UUID REFERENCES users(id),
            is_scheduled BOOLEAN DEFAULT false,
            schedule_frequency VARCHAR(20) CHECK (schedule_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
            next_generation_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create performance_benchmarks table for industry benchmarks
        CREATE TABLE IF NOT EXISTS performance_benchmarks (
            id SERIAL PRIMARY KEY,
            benchmark_name VARCHAR(100) NOT NULL,
            category VARCHAR(50) NOT NULL,
            metric_name VARCHAR(100) NOT NULL,
            benchmark_value DECIMAL(20,8) NOT NULL,
            benchmark_type VARCHAR(20) NOT NULL CHECK (benchmark_type IN ('MINIMUM', 'AVERAGE', 'EXCELLENT', 'TARGET')),
            industry VARCHAR(100),
            merchant_tier VARCHAR(10) CHECK (merchant_tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND')),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            UNIQUE(benchmark_name, metric_name, benchmark_type)
        );

        -- Create indexes for performance optimization
        CREATE INDEX IF NOT EXISTS idx_merchant_performance_metrics_merchant_date ON merchant_performance_metrics(merchant_id, metric_date);
        CREATE INDEX IF NOT EXISTS idx_merchant_performance_metrics_date ON merchant_performance_metrics(metric_date);
        CREATE INDEX IF NOT EXISTS idx_merchant_performance_metrics_score ON merchant_performance_metrics(performance_score);
        CREATE INDEX IF NOT EXISTS idx_merchant_performance_metrics_tier ON merchant_performance_metrics(merchant_tier);
        CREATE INDEX IF NOT EXISTS idx_merchant_performance_metrics_rank ON merchant_performance_metrics(platform_rank);

        CREATE INDEX IF NOT EXISTS idx_merchant_performance_insights_merchant_id ON merchant_performance_insights(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_merchant_performance_insights_type ON merchant_performance_insights(insight_type);
        CREATE INDEX IF NOT EXISTS idx_merchant_performance_insights_category ON merchant_performance_insights(category);
        CREATE INDEX IF NOT EXISTS idx_merchant_performance_insights_active ON merchant_performance_insights(is_active);
        CREATE INDEX IF NOT EXISTS idx_merchant_performance_insights_created_at ON merchant_performance_insights(created_at);

        CREATE INDEX IF NOT EXISTS idx_merchant_performance_comparisons_merchant_date ON merchant_performance_comparisons(merchant_id, comparison_date);
        CREATE INDEX IF NOT EXISTS idx_merchant_performance_comparisons_metric ON merchant_performance_comparisons(metric_name);

        CREATE INDEX IF NOT EXISTS idx_platform_analytics_date_timeframe ON platform_analytics(metric_date, timeframe);

        CREATE INDEX IF NOT EXISTS idx_merchant_reports_merchant_id ON merchant_reports(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_merchant_reports_type ON merchant_reports(report_type);
        CREATE INDEX IF NOT EXISTS idx_merchant_reports_scheduled ON merchant_reports(is_scheduled);
        CREATE INDEX IF NOT EXISTS idx_merchant_reports_next_generation ON merchant_reports(next_generation_date);

        CREATE INDEX IF NOT EXISTS idx_performance_benchmarks_category ON performance_benchmarks(category);
        CREATE INDEX IF NOT EXISTS idx_performance_benchmarks_metric ON performance_benchmarks(metric_name);
        CREATE INDEX IF NOT EXISTS idx_performance_benchmarks_tier ON performance_benchmarks(merchant_tier);
        CREATE INDEX IF NOT EXISTS idx_performance_benchmarks_active ON performance_benchmarks(is_active);

        -- Create view for merchant performance dashboard
        CREATE OR REPLACE VIEW merchant_performance_dashboard AS
        SELECT 
            mpm.*,
            u.email as merchant_email,
            u.business_name,
            u.created_at as account_created_at,
            EXTRACT(DAYS FROM (CURRENT_DATE - u.created_at::date)) as account_age_days,
            u.email_verified,
            u.wallet_verified,
            mrs.daily_limit,
            mrs.weekly_limit,
            mrs.monthly_limit,
            CASE 
                WHEN mpm.performance_score >= 80 THEN 'DIAMOND'
                WHEN mpm.performance_score >= 65 THEN 'PLATINUM'
                WHEN mpm.performance_score >= 50 THEN 'GOLD'
                WHEN mpm.performance_score >= 35 THEN 'SILVER'
                ELSE 'BRONZE'
            END as calculated_tier,
            ROW_NUMBER() OVER (ORDER BY mpm.performance_score DESC) as current_rank
        FROM merchant_performance_metrics mpm
        JOIN users u ON mpm.merchant_id = u.id
        LEFT JOIN merchant_risk_scores mrs ON mpm.merchant_id = mrs.merchant_id
        WHERE mpm.metric_date = CURRENT_DATE - INTERVAL '1 day'
        AND u.role = 'MERCHANT';

        -- Create view for top performing merchants
        CREATE OR REPLACE VIEW top_performing_merchants AS
        SELECT 
            mpm.merchant_id,
            u.business_name,
            u.email,
            mpm.performance_score,
            mpm.total_revenue,
            mpm.total_orders,
            mpm.fulfillment_rate,
            mpm.automation_rate,
            mpm.merchant_tier,
            mpm.platform_rank,
            EXTRACT(DAYS FROM (CURRENT_DATE - u.created_at::date)) as account_age_days
        FROM merchant_performance_metrics mpm
        JOIN users u ON mpm.merchant_id = u.id
        WHERE mpm.metric_date = CURRENT_DATE - INTERVAL '1 day'
        AND u.role = 'MERCHANT'
        AND mpm.performance_score >= 70
        ORDER BY mpm.performance_score DESC, mpm.total_revenue DESC
        LIMIT 50;

        -- Create view for merchant insights summary
        CREATE OR REPLACE VIEW merchant_insights_summary AS
        SELECT 
            merchant_id,
            COUNT(*) as total_insights,
            COUNT(CASE WHEN insight_type = 'WARNING' THEN 1 END) as warnings,
            COUNT(CASE WHEN insight_type = 'OPPORTUNITY' THEN 1 END) as opportunities,
            COUNT(CASE WHEN insight_type = 'SUCCESS' THEN 1 END) as successes,
            COUNT(CASE WHEN insight_type = 'RECOMMENDATION' THEN 1 END) as recommendations,
            COUNT(CASE WHEN impact = 'HIGH' THEN 1 END) as high_impact,
            COUNT(CASE WHEN impact = 'MEDIUM' THEN 1 END) as medium_impact,
            COUNT(CASE WHEN impact = 'LOW' THEN 1 END) as low_impact,
            COUNT(CASE WHEN actionable = true THEN 1 END) as actionable_insights,
            COUNT(CASE WHEN acknowledged_at IS NULL THEN 1 END) as unacknowledged
        FROM merchant_performance_insights
        WHERE is_active = true
        GROUP BY merchant_id;

        -- Create function to calculate daily performance metrics
        CREATE OR REPLACE FUNCTION calculate_daily_performance_metrics(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
        RETURNS INTEGER AS $$
        DECLARE
            merchant_record RECORD;
            metrics_count INTEGER := 0;
        BEGIN
            -- Loop through all merchants
            FOR merchant_record IN 
                SELECT id FROM users WHERE role = 'MERCHANT' AND is_active = true
            LOOP
                -- Calculate and insert/update metrics for each merchant
                INSERT INTO merchant_performance_metrics (
                    merchant_id, metric_date, total_revenue, total_commissions, net_earnings,
                    total_orders, fulfilled_orders, cancelled_orders, fulfillment_rate, cancellation_rate,
                    total_products, active_products, approved_products, approval_rate,
                    risk_score, automation_level, automation_rate, total_automated_payouts,
                    total_payouts, successful_payouts, payout_success_rate, performance_score
                )
                SELECT 
                    merchant_record.id,
                    target_date,
                    COALESCE(financial.total_revenue, 0),
                    COALESCE(financial.total_commissions, 0),
                    COALESCE(financial.total_revenue, 0) - COALESCE(financial.total_commissions, 0),
                    COALESCE(orders.total_orders, 0),
                    COALESCE(orders.fulfilled_orders, 0),
                    COALESCE(orders.cancelled_orders, 0),
                    CASE WHEN COALESCE(orders.total_orders, 0) > 0 
                         THEN (COALESCE(orders.fulfilled_orders, 0)::float / orders.total_orders * 100)
                         ELSE 0 END,
                    CASE WHEN COALESCE(orders.total_orders, 0) > 0 
                         THEN (COALESCE(orders.cancelled_orders, 0)::float / orders.total_orders * 100)
                         ELSE 0 END,
                    COALESCE(products.total_products, 0),
                    COALESCE(products.active_products, 0),
                    COALESCE(products.approved_products, 0),
                    CASE WHEN COALESCE(products.total_products, 0) > 0 
                         THEN (COALESCE(products.approved_products, 0)::float / products.total_products * 100)
                         ELSE 0 END,
                    COALESCE(risk.overall_score, 50),
                    COALESCE(risk.automation_level, 'PARTIAL'),
                    COALESCE(automation.automation_rate, 0),
                    COALESCE(automation.total_automated, 0),
                    COALESCE(payouts.total_payouts, 0),
                    COALESCE(payouts.successful_payouts, 0),
                    CASE WHEN COALESCE(payouts.total_payouts, 0) > 0 
                         THEN (COALESCE(payouts.successful_payouts, 0)::float / payouts.total_payouts * 100)
                         ELSE 0 END,
                    -- Simple performance score calculation
                    LEAST(100, (
                        COALESCE(financial.total_revenue, 0) / 1000 * 0.3 +
                        COALESCE(orders.total_orders, 0) * 2 * 0.25 +
                        (100 - COALESCE(risk.overall_score, 50)) * 0.2 +
                        COALESCE(products.approved_products, 0) * 5 * 0.15 +
                        COALESCE(payouts.successful_payouts, 0) * 10 * 0.1
                    ))
                FROM (
                    SELECT 
                        SUM(CASE WHEN transaction_type = 'SALE' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_revenue,
                        SUM(CASE WHEN transaction_type = 'COMMISSION' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_commissions
                    FROM merchant_transactions 
                    WHERE merchant_id = merchant_record.id
                ) financial
                CROSS JOIN (
                    SELECT 
                        COUNT(DISTINCT o.id) as total_orders,
                        COUNT(CASE WHEN o.status IN ('delivered', 'completed') THEN 1 END) as fulfilled_orders,
                        COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders
                    FROM products p
                    LEFT JOIN order_items oi ON p.id = oi.product_id
                    LEFT JOIN orders o ON oi.order_id = o.id
                    WHERE p.merchant_id = merchant_record.id
                ) orders
                CROSS JOIN (
                    SELECT 
                        COUNT(*) as total_products,
                        COUNT(CASE WHEN approval_status = 'approved' AND stock_quantity > 0 THEN 1 END) as active_products,
                        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_products
                    FROM products 
                    WHERE merchant_id = merchant_record.id
                ) products
                LEFT JOIN merchant_risk_scores risk ON risk.merchant_id = merchant_record.id
                LEFT JOIN (
                    SELECT 
                        CASE WHEN COUNT(*) > 0 
                             THEN COUNT(CASE WHEN automation_decision = 'AUTO_APPROVE' THEN 1 END)::float / COUNT(*) * 100 
                             ELSE 0 END as automation_rate,
                        COUNT(*) as total_automated
                    FROM automated_payout_requests 
                    WHERE merchant_id = merchant_record.id
                ) automation ON true
                LEFT JOIN (
                    SELECT 
                        COUNT(*) as total_payouts,
                        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as successful_payouts
                    FROM merchant_payout_requests 
                    WHERE merchant_id = merchant_record.id
                ) payouts ON true
                
                ON CONFLICT (merchant_id, metric_date) DO UPDATE SET
                    total_revenue = EXCLUDED.total_revenue,
                    total_commissions = EXCLUDED.total_commissions,
                    net_earnings = EXCLUDED.net_earnings,
                    total_orders = EXCLUDED.total_orders,
                    fulfilled_orders = EXCLUDED.fulfilled_orders,
                    cancelled_orders = EXCLUDED.cancelled_orders,
                    fulfillment_rate = EXCLUDED.fulfillment_rate,
                    cancellation_rate = EXCLUDED.cancellation_rate,
                    total_products = EXCLUDED.total_products,
                    active_products = EXCLUDED.active_products,
                    approved_products = EXCLUDED.approved_products,
                    approval_rate = EXCLUDED.approval_rate,
                    risk_score = EXCLUDED.risk_score,
                    automation_level = EXCLUDED.automation_level,
                    automation_rate = EXCLUDED.automation_rate,
                    total_automated_payouts = EXCLUDED.total_automated_payouts,
                    total_payouts = EXCLUDED.total_payouts,
                    successful_payouts = EXCLUDED.successful_payouts,
                    payout_success_rate = EXCLUDED.payout_success_rate,
                    performance_score = EXCLUDED.performance_score,
                    updated_at = NOW();
                
                metrics_count := metrics_count + 1;
            END LOOP;
            
            -- Update platform rankings
            UPDATE merchant_performance_metrics 
            SET platform_rank = ranked.rank
            FROM (
                SELECT 
                    merchant_id,
                    ROW_NUMBER() OVER (ORDER BY performance_score DESC, total_revenue DESC) as rank
                FROM merchant_performance_metrics
                WHERE metric_date = target_date
            ) ranked
            WHERE merchant_performance_metrics.merchant_id = ranked.merchant_id
            AND merchant_performance_metrics.metric_date = target_date;
            
            RETURN metrics_count;
        END;
        $$ LANGUAGE plpgsql;

        -- Create function to update platform analytics
        CREATE OR REPLACE FUNCTION update_platform_analytics(target_date DATE DEFAULT CURRENT_DATE, timeframe_param VARCHAR(10) DEFAULT 'DAILY')
        RETURNS VOID AS $$
        DECLARE
            interval_clause TEXT;
            analytics_data RECORD;
        BEGIN
            -- Determine interval based on timeframe
            CASE timeframe_param
                WHEN 'DAILY' THEN interval_clause := '1 day';
                WHEN 'WEEKLY' THEN interval_clause := '7 days';
                WHEN 'MONTHLY' THEN interval_clause := '30 days';
                ELSE interval_clause := '1 day';
            END CASE;
            
            -- Calculate platform analytics
            SELECT 
                COUNT(DISTINCT u.id) as total_merchants,
                COUNT(DISTINCT CASE WHEN mpm.merchant_id IS NOT NULL THEN u.id END) as active_merchants,
                COUNT(DISTINCT CASE WHEN u.created_at > target_date - INTERVAL interval_clause THEN u.id END) as new_merchants,
                COALESCE(SUM(mpm.total_revenue), 0) as total_revenue,
                COALESCE(SUM(mpm.total_orders), 0) as total_orders,
                COALESCE(AVG(mpm.performance_score), 0) as avg_performance_score
            INTO analytics_data
            FROM users u
            LEFT JOIN merchant_performance_metrics mpm ON u.id = mpm.merchant_id 
                AND mpm.metric_date = target_date - INTERVAL '1 day'
            WHERE u.role = 'MERCHANT';
            
            -- Insert or update platform analytics
            INSERT INTO platform_analytics (
                metric_date, timeframe, total_merchants, active_merchants, new_merchants,
                total_revenue, total_orders, average_performance_score,
                revenue_growth, merchant_growth, order_growth, automation_adoption
            ) VALUES (
                target_date, timeframe_param,
                analytics_data.total_merchants,
                analytics_data.active_merchants,
                analytics_data.new_merchants,
                analytics_data.total_revenue,
                analytics_data.total_orders,
                analytics_data.avg_performance_score,
                0, -- Would calculate from previous period
                0, -- Would calculate from previous period
                0, -- Would calculate from previous period
                0  -- Would calculate automation adoption rate
            )
            ON CONFLICT (metric_date, timeframe) DO UPDATE SET
                total_merchants = EXCLUDED.total_merchants,
                active_merchants = EXCLUDED.active_merchants,
                new_merchants = EXCLUDED.new_merchants,
                total_revenue = EXCLUDED.total_revenue,
                total_orders = EXCLUDED.total_orders,
                average_performance_score = EXCLUDED.average_performance_score,
                updated_at = NOW();
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger to update performance metrics timestamps
        CREATE OR REPLACE FUNCTION update_performance_metrics_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_update_performance_metrics_timestamp
            BEFORE UPDATE ON merchant_performance_metrics
            FOR EACH ROW
            EXECUTE FUNCTION update_performance_metrics_timestamp();

        CREATE TRIGGER trigger_update_performance_insights_timestamp
            BEFORE UPDATE ON merchant_performance_insights
            FOR EACH ROW
            EXECUTE FUNCTION update_performance_metrics_timestamp();

        CREATE TRIGGER trigger_update_merchant_reports_timestamp
            BEFORE UPDATE ON merchant_reports
            FOR EACH ROW
            EXECUTE FUNCTION update_performance_metrics_timestamp();

        RAISE NOTICE 'Merchant Performance Metrics and Reporting System migration completed successfully';
        
        -- Record migration
        INSERT INTO migrations (name) VALUES ('20250706150000_merchant_performance_metrics_system');
        
    ELSE
        RAISE NOTICE 'Merchant Performance Metrics System migration already applied, skipping';
    END IF;
END$$;

-- Grant necessary permissions for the performance system
GRANT SELECT, INSERT, UPDATE, DELETE ON merchant_performance_metrics TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON merchant_performance_insights TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON merchant_performance_comparisons TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_analytics TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON merchant_reports TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_benchmarks TO moobuser;

GRANT SELECT ON merchant_performance_dashboard TO moobuser;
GRANT SELECT ON top_performing_merchants TO moobuser;
GRANT SELECT ON merchant_insights_summary TO moobuser;

GRANT EXECUTE ON FUNCTION calculate_daily_performance_metrics(DATE) TO moobuser;
GRANT EXECUTE ON FUNCTION update_platform_analytics(DATE, VARCHAR(10)) TO moobuser;

-- Note: Run this migration as superuser with:
-- PGPASSWORD=userfortaicweb psql -U postgres -d moobfinancial -f migrations/20250706150000_merchant_performance_metrics_system.sql
