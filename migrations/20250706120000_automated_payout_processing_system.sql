-- Migration: Automated Payout Processing and Scheduling System
-- Adds comprehensive automation infrastructure for Phase 3, Item 3
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
    IF NOT EXISTS (SELECT 1 FROM migrations WHERE name = '20250706120000_automated_payout_processing_system') THEN
        
        -- Create merchant_risk_scores table
        CREATE TABLE IF NOT EXISTS merchant_risk_scores (
            id SERIAL PRIMARY KEY,
            merchant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            overall_score INTEGER NOT NULL DEFAULT 50 CHECK (overall_score >= 0 AND overall_score <= 100),
            transaction_history_score INTEGER NOT NULL DEFAULT 15 CHECK (transaction_history_score >= 0 AND transaction_history_score <= 25),
            chargeback_rate_score INTEGER NOT NULL DEFAULT 15 CHECK (chargeback_rate_score >= 0 AND chargeback_rate_score <= 25),
            account_age_score INTEGER NOT NULL DEFAULT 8 CHECK (account_age_score >= 0 AND account_age_score <= 15),
            verification_level_score INTEGER NOT NULL DEFAULT 8 CHECK (verification_level_score >= 0 AND verification_level_score <= 15),
            recent_activity_score INTEGER NOT NULL DEFAULT 10 CHECK (recent_activity_score >= 0 AND recent_activity_score <= 20),
            automation_level VARCHAR(20) NOT NULL DEFAULT 'PARTIAL' CHECK (automation_level IN ('FULL', 'PARTIAL', 'MANUAL_REVIEW')),
            daily_limit DECIMAL(20,8) NOT NULL DEFAULT 5000.00,
            weekly_limit DECIMAL(20,8) NOT NULL DEFAULT 25000.00,
            monthly_limit DECIMAL(20,8) NOT NULL DEFAULT 100000.00,
            single_transaction_limit DECIMAL(20,8) NOT NULL DEFAULT 2500.00,
            requires_approval_above DECIMAL(20,8) NOT NULL DEFAULT 5000.00,
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(merchant_id)
        );

        -- Create payout_schedule_configs table
        CREATE TABLE IF NOT EXISTS payout_schedule_configs (
            id SERIAL PRIMARY KEY,
            merchant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            schedule_type VARCHAR(20) NOT NULL DEFAULT 'FIXED' CHECK (schedule_type IN ('FIXED', 'THRESHOLD', 'HYBRID', 'REAL_TIME')),
            frequency_type VARCHAR(20) NOT NULL DEFAULT 'WEEKLY' CHECK (frequency_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'THRESHOLD_BASED', 'REAL_TIME')),
            frequency_interval INTEGER NOT NULL DEFAULT 1,
            day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
            day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
            preferred_time TIME DEFAULT '09:00:00',
            time_zone VARCHAR(50) DEFAULT 'UTC',
            minimum_threshold DECIMAL(20,8) NOT NULL DEFAULT 100.00,
            maximum_threshold DECIMAL(20,8) NOT NULL DEFAULT 50000.00,
            threshold_amount DECIMAL(20,8),
            max_daily_payouts INTEGER DEFAULT 5,
            business_days_only BOOLEAN DEFAULT true,
            blackout_dates JSONB DEFAULT '[]',
            emergency_override BOOLEAN DEFAULT false,
            automation_level VARCHAR(20) NOT NULL DEFAULT 'PARTIAL' CHECK (automation_level IN ('FULL', 'PARTIAL', 'MANUAL_REVIEW')),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(merchant_id)
        );

        -- Create automated_payout_requests table
        CREATE TABLE IF NOT EXISTS automated_payout_requests (
            id VARCHAR(255) PRIMARY KEY,
            merchant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            original_payout_request_id INTEGER REFERENCES merchant_payout_requests(id),
            amount DECIMAL(20,8) NOT NULL CHECK (amount > 0),
            currency VARCHAR(10) NOT NULL DEFAULT 'TAIC',
            destination_wallet VARCHAR(255) NOT NULL,
            destination_network VARCHAR(50) NOT NULL DEFAULT 'FANTOM',
            schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('SCHEDULED', 'THRESHOLD_TRIGGERED', 'REAL_TIME', 'MANUAL_OVERRIDE')),
            scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
            priority VARCHAR(10) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'APPROVED', 'EXECUTED', 'FAILED', 'CANCELLED')),
            risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
            automation_decision VARCHAR(20) NOT NULL CHECK (automation_decision IN ('AUTO_APPROVE', 'MANUAL_REVIEW', 'AUTO_REJECT')),
            processing_attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 3,
            last_attempt_at TIMESTAMP WITH TIME ZONE,
            executed_at TIMESTAMP WITH TIME ZONE,
            transaction_hash VARCHAR(255),
            failure_reason TEXT,
            treasury_transaction_id VARCHAR(255),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create processing_queues table
        CREATE TABLE IF NOT EXISTS processing_queues (
            id VARCHAR(255) PRIMARY KEY,
            queue_type VARCHAR(20) NOT NULL CHECK (queue_type IN ('SCHEDULED', 'THRESHOLD', 'REAL_TIME', 'MANUAL', 'EMERGENCY')),
            priority INTEGER NOT NULL DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
            estimated_processing_time INTEGER NOT NULL DEFAULT 0, -- seconds
            scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
            request_count INTEGER NOT NULL DEFAULT 0,
            processed_count INTEGER NOT NULL DEFAULT 0,
            failed_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create automation_audit_log table
        CREATE TABLE IF NOT EXISTS automation_audit_log (
            id SERIAL PRIMARY KEY,
            event_type VARCHAR(50) NOT NULL,
            performed_by VARCHAR(255) NOT NULL,
            details JSONB DEFAULT '{}',
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create admin_notifications table
        CREATE TABLE IF NOT EXISTS admin_notifications (
            id SERIAL PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            priority VARCHAR(10) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
            status VARCHAR(20) NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ', 'DISMISSED', 'ARCHIVED')),
            data JSONB DEFAULT '{}',
            assigned_to UUID REFERENCES users(id),
            read_at TIMESTAMP WITH TIME ZONE,
            read_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create automation_metrics table for performance tracking
        CREATE TABLE IF NOT EXISTS automation_metrics (
            id SERIAL PRIMARY KEY,
            metric_date DATE NOT NULL,
            timeframe VARCHAR(10) NOT NULL CHECK (timeframe IN ('DAILY', 'WEEKLY', 'MONTHLY')),
            total_processed INTEGER NOT NULL DEFAULT 0,
            successful_payouts INTEGER NOT NULL DEFAULT 0,
            failed_payouts INTEGER NOT NULL DEFAULT 0,
            average_processing_time DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_volume DECIMAL(20,8) NOT NULL DEFAULT 0,
            automation_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            error_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            cost_savings DECIMAL(10,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(metric_date, timeframe)
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_merchant_risk_scores_merchant_id ON merchant_risk_scores(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_merchant_risk_scores_automation_level ON merchant_risk_scores(automation_level);
        CREATE INDEX IF NOT EXISTS idx_merchant_risk_scores_overall_score ON merchant_risk_scores(overall_score);
        CREATE INDEX IF NOT EXISTS idx_merchant_risk_scores_active ON merchant_risk_scores(is_active);

        CREATE INDEX IF NOT EXISTS idx_payout_schedule_configs_merchant_id ON payout_schedule_configs(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_payout_schedule_configs_schedule_type ON payout_schedule_configs(schedule_type);
        CREATE INDEX IF NOT EXISTS idx_payout_schedule_configs_active ON payout_schedule_configs(is_active);

        CREATE INDEX IF NOT EXISTS idx_automated_payout_requests_merchant_id ON automated_payout_requests(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_automated_payout_requests_status ON automated_payout_requests(status);
        CREATE INDEX IF NOT EXISTS idx_automated_payout_requests_scheduled_for ON automated_payout_requests(scheduled_for);
        CREATE INDEX IF NOT EXISTS idx_automated_payout_requests_priority ON automated_payout_requests(priority);
        CREATE INDEX IF NOT EXISTS idx_automated_payout_requests_automation_decision ON automated_payout_requests(automation_decision);
        CREATE INDEX IF NOT EXISTS idx_automated_payout_requests_created_at ON automated_payout_requests(created_at);
        CREATE INDEX IF NOT EXISTS idx_automated_payout_requests_original_id ON automated_payout_requests(original_payout_request_id);

        CREATE INDEX IF NOT EXISTS idx_processing_queues_status ON processing_queues(status);
        CREATE INDEX IF NOT EXISTS idx_processing_queues_scheduled_for ON processing_queues(scheduled_for);
        CREATE INDEX IF NOT EXISTS idx_processing_queues_priority ON processing_queues(priority);
        CREATE INDEX IF NOT EXISTS idx_processing_queues_queue_type ON processing_queues(queue_type);

        CREATE INDEX IF NOT EXISTS idx_automation_audit_log_event_type ON automation_audit_log(event_type);
        CREATE INDEX IF NOT EXISTS idx_automation_audit_log_performed_by ON automation_audit_log(performed_by);
        CREATE INDEX IF NOT EXISTS idx_automation_audit_log_created_at ON automation_audit_log(created_at);

        CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
        CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON admin_notifications(status);
        CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON admin_notifications(priority);
        CREATE INDEX IF NOT EXISTS idx_admin_notifications_assigned_to ON admin_notifications(assigned_to);
        CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);

        CREATE INDEX IF NOT EXISTS idx_automation_metrics_date_timeframe ON automation_metrics(metric_date, timeframe);

        -- Create view for automation dashboard
        CREATE OR REPLACE VIEW automation_dashboard_summary AS
        SELECT 
            COUNT(CASE WHEN apr.status = 'PENDING' THEN 1 END) as pending_requests,
            COUNT(CASE WHEN apr.status = 'PROCESSING' THEN 1 END) as processing_requests,
            COUNT(CASE WHEN apr.status = 'EXECUTED' THEN 1 END) as executed_today,
            COUNT(CASE WHEN apr.status = 'FAILED' THEN 1 END) as failed_today,
            COUNT(CASE WHEN apr.automation_decision = 'MANUAL_REVIEW' AND apr.status = 'PENDING' THEN 1 END) as manual_review_queue,
            AVG(CASE WHEN apr.status = 'EXECUTED' THEN EXTRACT(EPOCH FROM (apr.executed_at - apr.created_at)) END) as avg_processing_time,
            SUM(CASE WHEN apr.status = 'EXECUTED' AND apr.created_at > CURRENT_DATE THEN apr.amount ELSE 0 END) as daily_volume,
            COUNT(CASE WHEN mrs.automation_level = 'FULL' THEN 1 END) as full_automation_merchants,
            COUNT(CASE WHEN mrs.automation_level = 'PARTIAL' THEN 1 END) as partial_automation_merchants,
            COUNT(CASE WHEN mrs.automation_level = 'MANUAL_REVIEW' THEN 1 END) as manual_review_merchants
        FROM automated_payout_requests apr
        LEFT JOIN merchant_risk_scores mrs ON apr.merchant_id = mrs.merchant_id
        WHERE apr.created_at > CURRENT_DATE - INTERVAL '7 days';

        -- Create view for pending automation queue
        CREATE OR REPLACE VIEW pending_automation_queue AS
        SELECT 
            apr.*,
            mrs.automation_level,
            mrs.overall_score as merchant_risk_score,
            psc.schedule_type,
            psc.frequency_type,
            CASE 
                WHEN apr.priority = 'URGENT' THEN 100
                WHEN apr.priority = 'HIGH' THEN 80
                WHEN apr.automation_decision = 'MANUAL_REVIEW' THEN 60
                WHEN apr.risk_score > 70 THEN 50
                WHEN apr.priority = 'NORMAL' THEN 40
                ELSE 20
            END as queue_priority,
            EXTRACT(EPOCH FROM (NOW() - apr.created_at)) / 3600 as hours_pending
        FROM automated_payout_requests apr
        LEFT JOIN merchant_risk_scores mrs ON apr.merchant_id = mrs.merchant_id
        LEFT JOIN payout_schedule_configs psc ON apr.merchant_id = psc.merchant_id
        WHERE apr.status IN ('PENDING', 'PROCESSING')
        ORDER BY queue_priority DESC, apr.created_at ASC;

        -- Create function to calculate merchant automation eligibility
        CREATE OR REPLACE FUNCTION calculate_merchant_automation_eligibility(merchant_uuid UUID)
        RETURNS TABLE(
            eligible BOOLEAN,
            automation_level VARCHAR(20),
            daily_limit DECIMAL(20,8),
            risk_score INTEGER,
            reason TEXT
        ) AS $$
        DECLARE
            merchant_data RECORD;
            risk_data RECORD;
        BEGIN
            -- Get merchant data
            SELECT 
                u.created_at,
                u.email_verified,
                u.phone_verified,
                COUNT(DISTINCT o.id) as total_orders,
                COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total_amount ELSE 0 END), 0) as total_revenue,
                COUNT(CASE WHEN o.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_orders
            INTO merchant_data
            FROM users u
            LEFT JOIN orders o ON u.id = o.merchant_id
            WHERE u.id = merchant_uuid AND u.role = 'MERCHANT'
            GROUP BY u.id, u.created_at, u.email_verified, u.phone_verified;
            
            IF NOT FOUND THEN
                RETURN QUERY SELECT false, 'MANUAL_REVIEW'::VARCHAR(20), 0::DECIMAL(20,8), 100, 'Merchant not found';
                RETURN;
            END IF;
            
            -- Get or calculate risk score
            SELECT * INTO risk_data FROM merchant_risk_scores WHERE merchant_id = merchant_uuid;
            
            IF NOT FOUND THEN
                -- Calculate basic eligibility
                IF merchant_data.total_orders >= 10 AND merchant_data.email_verified AND merchant_data.phone_verified THEN
                    RETURN QUERY SELECT true, 'PARTIAL'::VARCHAR(20), 2500::DECIMAL(20,8), 50, 'New merchant - partial automation eligible';
                ELSE
                    RETURN QUERY SELECT false, 'MANUAL_REVIEW'::VARCHAR(20), 500::DECIMAL(20,8), 80, 'Insufficient verification or order history';
                END IF;
            ELSE
                -- Use existing risk assessment
                RETURN QUERY SELECT 
                    risk_data.automation_level != 'MANUAL_REVIEW',
                    risk_data.automation_level,
                    risk_data.daily_limit,
                    risk_data.overall_score,
                    CASE 
                        WHEN risk_data.automation_level = 'FULL' THEN 'Full automation approved'
                        WHEN risk_data.automation_level = 'PARTIAL' THEN 'Partial automation approved'
                        ELSE 'Manual review required'
                    END;
            END IF;
        END;
        $$ LANGUAGE plpgsql;

        -- Create function to auto-expire old pending requests
        CREATE OR REPLACE FUNCTION expire_old_automation_requests()
        RETURNS INTEGER AS $$
        DECLARE
            expired_count INTEGER;
        BEGIN
            UPDATE automated_payout_requests
            SET 
                status = 'CANCELLED',
                failure_reason = 'Automatically expired after 7 days',
                updated_at = NOW()
            WHERE status = 'PENDING' 
            AND created_at < NOW() - INTERVAL '7 days';
            
            GET DIAGNOSTICS expired_count = ROW_COUNT;
            
            -- Log expired requests
            INSERT INTO automation_audit_log (event_type, performed_by, details, created_at)
            VALUES ('AUTO_EXPIRE_REQUESTS', 'SYSTEM', 
                    jsonb_build_object('expired_count', expired_count), NOW());
            
            RETURN expired_count;
        END;
        $$ LANGUAGE plpgsql;

        -- Create function to update automation metrics
        CREATE OR REPLACE FUNCTION update_automation_metrics(metric_date_param DATE, timeframe_param VARCHAR(10))
        RETURNS VOID AS $$
        DECLARE
            interval_clause TEXT;
            metrics_data RECORD;
        BEGIN
            -- Determine interval based on timeframe
            CASE timeframe_param
                WHEN 'DAILY' THEN interval_clause := '24 hours';
                WHEN 'WEEKLY' THEN interval_clause := '7 days';
                WHEN 'MONTHLY' THEN interval_clause := '30 days';
                ELSE interval_clause := '24 hours';
            END CASE;
            
            -- Calculate metrics
            SELECT 
                COUNT(*) as total_processed,
                COUNT(CASE WHEN status = 'EXECUTED' THEN 1 END) as successful_payouts,
                COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_payouts,
                AVG(EXTRACT(EPOCH FROM (executed_at - created_at))) as avg_processing_time,
                SUM(CASE WHEN status = 'EXECUTED' THEN amount ELSE 0 END) as total_volume,
                COUNT(CASE WHEN automation_decision = 'AUTO_APPROVE' AND status = 'EXECUTED' THEN 1 END)::float / 
                  NULLIF(COUNT(*), 0) * 100 as automation_rate
            INTO metrics_data
            FROM automated_payout_requests
            WHERE created_at > metric_date_param - INTERVAL interval_clause;
            
            -- Insert or update metrics
            INSERT INTO automation_metrics (
                metric_date, timeframe, total_processed, successful_payouts, failed_payouts,
                average_processing_time, total_volume, automation_rate, 
                error_rate, cost_savings
            ) VALUES (
                metric_date_param, timeframe_param, 
                COALESCE(metrics_data.total_processed, 0),
                COALESCE(metrics_data.successful_payouts, 0),
                COALESCE(metrics_data.failed_payouts, 0),
                COALESCE(metrics_data.avg_processing_time, 0),
                COALESCE(metrics_data.total_volume, 0),
                COALESCE(metrics_data.automation_rate, 0),
                CASE WHEN metrics_data.total_processed > 0 
                     THEN (metrics_data.failed_payouts::float / metrics_data.total_processed * 100)
                     ELSE 0 END,
                COALESCE(metrics_data.successful_payouts, 0) * 5 -- $5 saved per automated payout
            )
            ON CONFLICT (metric_date, timeframe) DO UPDATE SET
                total_processed = EXCLUDED.total_processed,
                successful_payouts = EXCLUDED.successful_payouts,
                failed_payouts = EXCLUDED.failed_payouts,
                average_processing_time = EXCLUDED.average_processing_time,
                total_volume = EXCLUDED.total_volume,
                automation_rate = EXCLUDED.automation_rate,
                error_rate = EXCLUDED.error_rate,
                cost_savings = EXCLUDED.cost_savings,
                created_at = NOW();
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger to update automation request timestamps
        CREATE OR REPLACE FUNCTION update_automation_request_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_update_automation_request_timestamp
            BEFORE UPDATE ON automated_payout_requests
            FOR EACH ROW
            EXECUTE FUNCTION update_automation_request_timestamp();

        -- Create trigger to update payout schedule config timestamps
        CREATE OR REPLACE FUNCTION update_payout_schedule_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_update_payout_schedule_timestamp
            BEFORE UPDATE ON payout_schedule_configs
            FOR EACH ROW
            EXECUTE FUNCTION update_payout_schedule_timestamp();

        RAISE NOTICE 'Automated Payout Processing and Scheduling System migration completed successfully';
        
        -- Record migration
        INSERT INTO migrations (name) VALUES ('20250706120000_automated_payout_processing_system');
        
    ELSE
        RAISE NOTICE 'Automated Payout Processing System migration already applied, skipping';
    END IF;
END$$;

-- Grant necessary permissions for the automation system
GRANT SELECT, INSERT, UPDATE, DELETE ON merchant_risk_scores TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON payout_schedule_configs TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON automated_payout_requests TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON processing_queues TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON automation_audit_log TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_notifications TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON automation_metrics TO moobuser;

GRANT SELECT ON automation_dashboard_summary TO moobuser;
GRANT SELECT ON pending_automation_queue TO moobuser;

GRANT EXECUTE ON FUNCTION calculate_merchant_automation_eligibility(UUID) TO moobuser;
GRANT EXECUTE ON FUNCTION expire_old_automation_requests() TO moobuser;
GRANT EXECUTE ON FUNCTION update_automation_metrics(DATE, VARCHAR(10)) TO moobuser;

-- Note: Run this migration as superuser with:
-- PGPASSWORD=userfortaicweb psql -U postgres -d moobfinancial -f migrations/20250706120000_automated_payout_processing_system.sql
