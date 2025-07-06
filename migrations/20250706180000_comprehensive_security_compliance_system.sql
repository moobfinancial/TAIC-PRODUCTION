-- Migration: Comprehensive Security and Compliance System
-- Adds enterprise-grade security monitoring, threat detection, and regulatory compliance
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
    IF NOT EXISTS (SELECT 1 FROM migrations WHERE name = '20250706180000_comprehensive_security_compliance_system') THEN
        
        -- Create security_events table for comprehensive security monitoring
        CREATE TABLE IF NOT EXISTS security_events (
            id VARCHAR(255) PRIMARY KEY,
            event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
                'LOGIN_ATTEMPT', 'FAILED_LOGIN', 'SUSPICIOUS_ACTIVITY', 'UNAUTHORIZED_ACCESS',
                'DATA_ACCESS', 'PRIVILEGE_ESCALATION', 'SYSTEM_BREACH', 'COMPLIANCE_VIOLATION'
            )),
            severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            ip_address INET NOT NULL,
            user_agent TEXT,
            details JSONB NOT NULL DEFAULT '{}',
            resolved BOOLEAN NOT NULL DEFAULT false,
            resolved_by VARCHAR(255),
            resolved_at TIMESTAMP WITH TIME ZONE,
            actions JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create compliance_rules table for regulatory compliance management
        CREATE TABLE IF NOT EXISTS compliance_rules (
            id VARCHAR(255) PRIMARY KEY,
            rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('AML', 'KYC', 'GDPR', 'PCI_DSS', 'SOX', 'CCPA', 'CUSTOM')),
            name VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
            enabled BOOLEAN NOT NULL DEFAULT true,
            conditions JSONB NOT NULL DEFAULT '[]',
            actions JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create compliance_violations table for tracking violations
        CREATE TABLE IF NOT EXISTS compliance_violations (
            id VARCHAR(255) PRIMARY KEY,
            rule_id VARCHAR(255) NOT NULL REFERENCES compliance_rules(id) ON DELETE CASCADE,
            rule_name VARCHAR(255) NOT NULL,
            violation_type VARCHAR(20) NOT NULL,
            severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
            entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('USER', 'TRANSACTION', 'MERCHANT', 'SYSTEM')),
            entity_id VARCHAR(255) NOT NULL,
            details JSONB NOT NULL DEFAULT '{}',
            status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE')),
            assigned_to VARCHAR(255),
            resolution TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP WITH TIME ZONE
        );

        -- Create comprehensive_audit_trail table for complete audit logging
        CREATE TABLE IF NOT EXISTS comprehensive_audit_trail (
            id VARCHAR(255) PRIMARY KEY,
            entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('USER', 'TRANSACTION', 'SYSTEM', 'ADMIN', 'MERCHANT')),
            entity_id VARCHAR(255) NOT NULL,
            action VARCHAR(100) NOT NULL,
            performed_by VARCHAR(255) NOT NULL,
            ip_address INET NOT NULL,
            user_agent TEXT,
            details JSONB NOT NULL DEFAULT '{}',
            data_changes JSONB, -- Before/after data for changes
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create security_policies table for configurable security policies
        CREATE TABLE IF NOT EXISTS security_policies (
            id VARCHAR(255) PRIMARY KEY,
            policy_name VARCHAR(255) NOT NULL UNIQUE,
            policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN (
                'PASSWORD_POLICY', 'SESSION_POLICY', 'ACCESS_CONTROL', 'DATA_RETENTION',
                'ENCRYPTION_POLICY', 'BACKUP_POLICY', 'INCIDENT_RESPONSE'
            )),
            description TEXT NOT NULL,
            configuration JSONB NOT NULL DEFAULT '{}',
            enabled BOOLEAN NOT NULL DEFAULT true,
            enforcement_level VARCHAR(20) NOT NULL DEFAULT 'STRICT' CHECK (enforcement_level IN ('ADVISORY', 'STRICT', 'CRITICAL')),
            created_by VARCHAR(255) NOT NULL,
            approved_by VARCHAR(255),
            effective_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            expiry_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create threat_intelligence table for threat detection
        CREATE TABLE IF NOT EXISTS threat_intelligence (
            id SERIAL PRIMARY KEY,
            threat_type VARCHAR(50) NOT NULL CHECK (threat_type IN (
                'MALICIOUS_IP', 'SUSPICIOUS_USER_AGENT', 'KNOWN_ATTACKER', 'COMPROMISED_CREDENTIAL',
                'PHISHING_DOMAIN', 'MALWARE_SIGNATURE', 'BEHAVIORAL_ANOMALY'
            )),
            indicator_value VARCHAR(500) NOT NULL,
            confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
            severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
            source VARCHAR(100) NOT NULL,
            description TEXT,
            first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB DEFAULT '{}'
        );

        -- Create data_classification table for data protection
        CREATE TABLE IF NOT EXISTS data_classification (
            id SERIAL PRIMARY KEY,
            table_name VARCHAR(100) NOT NULL,
            column_name VARCHAR(100) NOT NULL,
            classification_level VARCHAR(20) NOT NULL CHECK (classification_level IN (
                'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'TOP_SECRET'
            )),
            data_type VARCHAR(50) NOT NULL CHECK (data_type IN (
                'PII', 'PHI', 'FINANCIAL', 'AUTHENTICATION', 'BUSINESS_CRITICAL', 'OPERATIONAL'
            )),
            retention_period_days INTEGER,
            encryption_required BOOLEAN NOT NULL DEFAULT false,
            access_restrictions JSONB DEFAULT '{}',
            compliance_requirements TEXT[],
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(table_name, column_name)
        );

        -- Create security_incidents table for incident management
        CREATE TABLE IF NOT EXISTS security_incidents (
            id VARCHAR(255) PRIMARY KEY,
            incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN (
                'DATA_BREACH', 'UNAUTHORIZED_ACCESS', 'SYSTEM_COMPROMISE', 'MALWARE_DETECTION',
                'PHISHING_ATTACK', 'INSIDER_THREAT', 'SERVICE_DISRUPTION', 'COMPLIANCE_VIOLATION'
            )),
            severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
            status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN (
                'OPEN', 'INVESTIGATING', 'CONTAINED', 'ERADICATED', 'RECOVERED', 'CLOSED'
            )),
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            affected_systems TEXT[],
            affected_users TEXT[],
            impact_assessment TEXT,
            containment_actions TEXT,
            eradication_actions TEXT,
            recovery_actions TEXT,
            lessons_learned TEXT,
            reported_by VARCHAR(255) NOT NULL,
            assigned_to VARCHAR(255),
            discovered_at TIMESTAMP WITH TIME ZONE NOT NULL,
            contained_at TIMESTAMP WITH TIME ZONE,
            resolved_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create compliance_reports table for regulatory reporting
        CREATE TABLE IF NOT EXISTS compliance_reports (
            id VARCHAR(255) PRIMARY KEY,
            report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
                'AML_SUSPICIOUS_ACTIVITY', 'GDPR_DATA_BREACH', 'PCI_DSS_COMPLIANCE',
                'SOX_FINANCIAL_CONTROLS', 'CCPA_DATA_PROCESSING', 'CUSTOM_COMPLIANCE'
            )),
            report_period_start DATE NOT NULL,
            report_period_end DATE NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED', 'SUBMITTED')),
            report_data JSONB NOT NULL DEFAULT '{}',
            generated_by VARCHAR(255) NOT NULL,
            reviewed_by VARCHAR(255),
            approved_by VARCHAR(255),
            submitted_to VARCHAR(255),
            submission_deadline DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            submitted_at TIMESTAMP WITH TIME ZONE
        );

        -- Create user_access_logs table for detailed access tracking
        CREATE TABLE IF NOT EXISTS user_access_logs (
            id SERIAL PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            session_id VARCHAR(255),
            access_type VARCHAR(50) NOT NULL CHECK (access_type IN (
                'LOGIN', 'LOGOUT', 'PAGE_VIEW', 'API_CALL', 'DATA_ACCESS', 'ADMIN_ACTION',
                'TRANSACTION', 'DOWNLOAD', 'UPLOAD', 'CONFIGURATION_CHANGE'
            )),
            resource_accessed VARCHAR(255),
            ip_address INET NOT NULL,
            user_agent TEXT,
            geolocation JSONB,
            success BOOLEAN NOT NULL DEFAULT true,
            failure_reason VARCHAR(255),
            risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for performance optimization
        CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON security_events(event_type, severity);
        CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
        CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);

        CREATE INDEX IF NOT EXISTS idx_compliance_violations_rule_id ON compliance_violations(rule_id);
        CREATE INDEX IF NOT EXISTS idx_compliance_violations_entity ON compliance_violations(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_compliance_violations_status ON compliance_violations(status);
        CREATE INDEX IF NOT EXISTS idx_compliance_violations_severity ON compliance_violations(severity);
        CREATE INDEX IF NOT EXISTS idx_compliance_violations_created_at ON compliance_violations(created_at);

        CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON comprehensive_audit_trail(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_trail_performed_by ON comprehensive_audit_trail(performed_by);
        CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON comprehensive_audit_trail(action);
        CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON comprehensive_audit_trail(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_trail_ip_address ON comprehensive_audit_trail(ip_address);

        CREATE INDEX IF NOT EXISTS idx_security_policies_type ON security_policies(policy_type);
        CREATE INDEX IF NOT EXISTS idx_security_policies_enabled ON security_policies(enabled);
        CREATE INDEX IF NOT EXISTS idx_security_policies_effective_date ON security_policies(effective_date);

        CREATE INDEX IF NOT EXISTS idx_threat_intelligence_type ON threat_intelligence(threat_type);
        CREATE INDEX IF NOT EXISTS idx_threat_intelligence_indicator ON threat_intelligence(indicator_value);
        CREATE INDEX IF NOT EXISTS idx_threat_intelligence_active ON threat_intelligence(is_active);
        CREATE INDEX IF NOT EXISTS idx_threat_intelligence_severity ON threat_intelligence(severity);

        CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(incident_type);
        CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(status);
        CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
        CREATE INDEX IF NOT EXISTS idx_security_incidents_discovered_at ON security_incidents(discovered_at);

        CREATE INDEX IF NOT EXISTS idx_compliance_reports_type ON compliance_reports(report_type);
        CREATE INDEX IF NOT EXISTS idx_compliance_reports_status ON compliance_reports(status);
        CREATE INDEX IF NOT EXISTS idx_compliance_reports_period ON compliance_reports(report_period_start, report_period_end);

        CREATE INDEX IF NOT EXISTS idx_user_access_logs_user_id ON user_access_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_access_logs_access_type ON user_access_logs(access_type);
        CREATE INDEX IF NOT EXISTS idx_user_access_logs_ip_address ON user_access_logs(ip_address);
        CREATE INDEX IF NOT EXISTS idx_user_access_logs_created_at ON user_access_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_user_access_logs_risk_score ON user_access_logs(risk_score);

        -- Create views for security dashboard
        CREATE OR REPLACE VIEW security_dashboard_summary AS
        SELECT 
            COUNT(*) as total_events,
            COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_events,
            COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_events,
            COUNT(CASE WHEN resolved = true THEN 1 END) as resolved_events,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as events_24h,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as events_7d,
            AVG(CASE WHEN resolved = true THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600 END) as avg_resolution_hours
        FROM security_events
        WHERE created_at > NOW() - INTERVAL '30 days';

        CREATE OR REPLACE VIEW compliance_dashboard_summary AS
        SELECT 
            COUNT(*) as total_violations,
            COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_violations,
            COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_violations,
            COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open_violations,
            COUNT(CASE WHEN status = 'INVESTIGATING' THEN 1 END) as investigating_violations,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as violations_24h,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as violations_7d
        FROM compliance_violations
        WHERE created_at > NOW() - INTERVAL '30 days';

        CREATE OR REPLACE VIEW threat_intelligence_summary AS
        SELECT 
            threat_type,
            COUNT(*) as total_indicators,
            COUNT(CASE WHEN is_active = true THEN 1 END) as active_indicators,
            COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_threats,
            AVG(confidence_score) as avg_confidence
        FROM threat_intelligence
        GROUP BY threat_type
        ORDER BY total_indicators DESC;

        CREATE OR REPLACE VIEW recent_security_activity AS
        SELECT 
            'SECURITY_EVENT' as activity_type,
            id as activity_id,
            event_type as activity_subtype,
            severity,
            user_id,
            ip_address,
            created_at,
            details
        FROM security_events
        WHERE created_at > NOW() - INTERVAL '24 hours'
        
        UNION ALL
        
        SELECT 
            'COMPLIANCE_VIOLATION' as activity_type,
            id as activity_id,
            violation_type as activity_subtype,
            severity,
            CASE WHEN entity_type = 'USER' THEN entity_id::UUID ELSE NULL END as user_id,
            NULL as ip_address,
            created_at,
            details
        FROM compliance_violations
        WHERE created_at > NOW() - INTERVAL '24 hours'
        
        ORDER BY created_at DESC
        LIMIT 100;

        -- Create function to calculate security score
        CREATE OR REPLACE FUNCTION calculate_security_score()
        RETURNS INTEGER AS $$
        DECLARE
            base_score INTEGER := 100;
            critical_events INTEGER;
            high_events INTEGER;
            open_violations INTEGER;
            recent_incidents INTEGER;
        BEGIN
            -- Get recent security metrics
            SELECT 
                COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END),
                COUNT(CASE WHEN severity = 'HIGH' THEN 1 END)
            INTO critical_events, high_events
            FROM security_events
            WHERE created_at > NOW() - INTERVAL '7 days' AND resolved = false;
            
            SELECT COUNT(*)
            INTO open_violations
            FROM compliance_violations
            WHERE status IN ('OPEN', 'INVESTIGATING');
            
            SELECT COUNT(*)
            INTO recent_incidents
            FROM security_incidents
            WHERE status NOT IN ('CLOSED') AND discovered_at > NOW() - INTERVAL '30 days';
            
            -- Calculate score deductions
            base_score := base_score - (critical_events * 20);
            base_score := base_score - (high_events * 10);
            base_score := base_score - (open_violations * 5);
            base_score := base_score - (recent_incidents * 15);
            
            -- Ensure score is between 0 and 100
            RETURN GREATEST(0, LEAST(100, base_score));
        END;
        $$ LANGUAGE plpgsql;

        -- Create function to generate compliance report data
        CREATE OR REPLACE FUNCTION generate_compliance_report_data(
            report_type_param VARCHAR(50),
            start_date DATE,
            end_date DATE
        )
        RETURNS JSONB AS $$
        DECLARE
            report_data JSONB := '{}';
            violation_count INTEGER;
            incident_count INTEGER;
            audit_count INTEGER;
        BEGIN
            -- Get violation statistics
            SELECT COUNT(*)
            INTO violation_count
            FROM compliance_violations
            WHERE violation_type = report_type_param
            AND created_at::date BETWEEN start_date AND end_date;
            
            -- Get incident statistics
            SELECT COUNT(*)
            INTO incident_count
            FROM security_incidents
            WHERE incident_type LIKE '%' || report_type_param || '%'
            AND discovered_at::date BETWEEN start_date AND end_date;
            
            -- Get audit trail count
            SELECT COUNT(*)
            INTO audit_count
            FROM comprehensive_audit_trail
            WHERE created_at::date BETWEEN start_date AND end_date;
            
            -- Build report data
            report_data := jsonb_build_object(
                'period', jsonb_build_object(
                    'start_date', start_date,
                    'end_date', end_date
                ),
                'statistics', jsonb_build_object(
                    'total_violations', violation_count,
                    'total_incidents', incident_count,
                    'total_audit_entries', audit_count
                ),
                'generated_at', NOW()
            );
            
            RETURN report_data;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger to update timestamps
        CREATE OR REPLACE FUNCTION update_security_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_update_security_events_timestamp
            BEFORE UPDATE ON security_events
            FOR EACH ROW
            EXECUTE FUNCTION update_security_timestamp();

        CREATE TRIGGER trigger_update_compliance_rules_timestamp
            BEFORE UPDATE ON compliance_rules
            FOR EACH ROW
            EXECUTE FUNCTION update_security_timestamp();

        CREATE TRIGGER trigger_update_security_policies_timestamp
            BEFORE UPDATE ON security_policies
            FOR EACH ROW
            EXECUTE FUNCTION update_security_timestamp();

        CREATE TRIGGER trigger_update_security_incidents_timestamp
            BEFORE UPDATE ON security_incidents
            FOR EACH ROW
            EXECUTE FUNCTION update_security_timestamp();

        CREATE TRIGGER trigger_update_compliance_reports_timestamp
            BEFORE UPDATE ON compliance_reports
            FOR EACH ROW
            EXECUTE FUNCTION update_security_timestamp();

        -- Insert default security policies
        INSERT INTO security_policies (id, policy_name, policy_type, description, configuration, created_by) VALUES
        ('POL_PASSWORD_001', 'Strong Password Policy', 'PASSWORD_POLICY', 'Enforce strong password requirements', 
         '{"min_length": 12, "require_uppercase": true, "require_lowercase": true, "require_numbers": true, "require_symbols": true, "max_age_days": 90}', 'system'),
        ('POL_SESSION_001', 'Session Management Policy', 'SESSION_POLICY', 'Manage user session security',
         '{"max_session_duration": 28800, "idle_timeout": 3600, "concurrent_sessions": 3, "require_reauth_sensitive": true}', 'system'),
        ('POL_ACCESS_001', 'Access Control Policy', 'ACCESS_CONTROL', 'Role-based access control',
         '{"principle": "least_privilege", "review_frequency_days": 90, "auto_disable_inactive_days": 30}', 'system'),
        ('POL_RETENTION_001', 'Data Retention Policy', 'DATA_RETENTION', 'Data retention and disposal',
         '{"default_retention_years": 7, "pii_retention_years": 3, "audit_retention_years": 10, "secure_disposal": true}', 'system'),
        ('POL_ENCRYPTION_001', 'Encryption Policy', 'ENCRYPTION_POLICY', 'Data encryption requirements',
         '{"data_at_rest": "AES-256", "data_in_transit": "TLS-1.3", "key_rotation_days": 365, "hsm_required": true}', 'system');

        -- Insert default data classifications
        INSERT INTO data_classification (table_name, column_name, classification_level, data_type, retention_period_days, encryption_required, compliance_requirements) VALUES
        ('users', 'email', 'CONFIDENTIAL', 'PII', 2555, true, ARRAY['GDPR', 'CCPA']),
        ('users', 'password_hash', 'RESTRICTED', 'AUTHENTICATION', 2555, true, ARRAY['PCI_DSS']),
        ('users', 'wallet_address', 'CONFIDENTIAL', 'FINANCIAL', 2555, true, ARRAY['AML', 'KYC']),
        ('merchant_transactions', 'amount', 'CONFIDENTIAL', 'FINANCIAL', 2555, true, ARRAY['AML', 'SOX']),
        ('orders', 'shipping_address', 'CONFIDENTIAL', 'PII', 2555, true, ARRAY['GDPR', 'CCPA']),
        ('treasury_wallets', 'private_key_encrypted', 'TOP_SECRET', 'AUTHENTICATION', 3650, true, ARRAY['PCI_DSS', 'SOX']),
        ('multisig_signatures', 'signature_data', 'RESTRICTED', 'AUTHENTICATION', 3650, true, ARRAY['SOX']);

        -- Insert default compliance rules
        INSERT INTO compliance_rules (id, rule_type, name, description, severity, conditions, actions) VALUES
        ('RULE_AML_001', 'AML', 'Large Transaction Monitoring', 'Monitor transactions above $10,000 for AML compliance', 'HIGH',
         '[{"field": "amount", "operator": "GREATER_THAN", "value": 10000}]',
         '[{"actionType": "REQUIRE_APPROVAL", "parameters": {"approvalLevel": "COMPLIANCE_OFFICER"}}, {"actionType": "GENERATE_REPORT", "parameters": {"reportType": "AML_SUSPICIOUS_ACTIVITY"}}]'),
        ('RULE_KYC_001', 'KYC', 'Unverified User Limit', 'Limit transactions for unverified users', 'MEDIUM',
         '[{"field": "userVerified", "operator": "EQUALS", "value": false, "logicalOperator": "AND"}, {"field": "amount", "operator": "GREATER_THAN", "value": 1000}]',
         '[{"actionType": "BLOCK_TRANSACTION", "parameters": {"reason": "KYC_VERIFICATION_REQUIRED"}}, {"actionType": "REQUEST_DOCUMENTATION", "parameters": {"documentType": "IDENTITY_VERIFICATION"}}]'),
        ('RULE_GDPR_001', 'GDPR', 'Personal Data Access Logging', 'Log all access to personal data', 'MEDIUM',
         '[{"field": "dataType", "operator": "CONTAINS", "value": "PERSONAL"}]',
         '[{"actionType": "GENERATE_REPORT", "parameters": {"reportType": "GDPR_DATA_ACCESS"}}]'),
        ('RULE_SEC_001', 'CUSTOM', 'Failed Login Monitoring', 'Monitor multiple failed login attempts', 'HIGH',
         '[{"field": "failedAttempts", "operator": "GREATER_THAN", "value": 5}]',
         '[{"actionType": "FREEZE_ACCOUNT", "parameters": {"duration": "24h"}}, {"actionType": "NOTIFY_ADMIN", "parameters": {"alertType": "SECURITY_BREACH"}}]');

        RAISE NOTICE 'Comprehensive Security and Compliance System migration completed successfully';
        
        -- Record migration
        INSERT INTO migrations (name) VALUES ('20250706180000_comprehensive_security_compliance_system');
        
    ELSE
        RAISE NOTICE 'Comprehensive Security and Compliance System migration already applied, skipping';
    END IF;
END$$;

-- Grant necessary permissions for the security system
GRANT SELECT, INSERT, UPDATE, DELETE ON security_events TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_rules TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_violations TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON comprehensive_audit_trail TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON security_policies TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON threat_intelligence TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON data_classification TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON security_incidents TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_reports TO moobuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_access_logs TO moobuser;

GRANT SELECT ON security_dashboard_summary TO moobuser;
GRANT SELECT ON compliance_dashboard_summary TO moobuser;
GRANT SELECT ON threat_intelligence_summary TO moobuser;
GRANT SELECT ON recent_security_activity TO moobuser;

GRANT EXECUTE ON FUNCTION calculate_security_score() TO moobuser;
GRANT EXECUTE ON FUNCTION generate_compliance_report_data(VARCHAR(50), DATE, DATE) TO moobuser;

-- Note: Run this migration as superuser with:
-- PGPASSWORD=userfortaicweb psql -U postgres -d moobfinancial -f migrations/20250706180000_comprehensive_security_compliance_system.sql
