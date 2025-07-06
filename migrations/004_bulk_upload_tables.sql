-- Migration: 004_bulk_upload_tables.sql
-- Description: Create tables for bulk upload functionality
-- Date: 2025-01-15

-- Create bulk upload session tracking table
CREATE TABLE IF NOT EXISTS bulk_upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64), -- SHA-256 hash for duplicate detection
    expected_rows INTEGER,
    actual_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN (
        'created', 'validating', 'processing', 'completed', 'failed', 'cancelled'
    )),
    validation_errors JSONB,
    processing_options JSONB,
    performance_metrics JSONB,
    error_summary JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bulk upload errors table for detailed error tracking
CREATE TABLE IF NOT EXISTS bulk_upload_errors (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES bulk_upload_sessions(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    error_code VARCHAR(20),
    error_message TEXT NOT NULL,
    field_name VARCHAR(100),
    field_value TEXT,
    expected_format VARCHAR(100),
    severity VARCHAR(10) NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'info')),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolution_action VARCHAR(100),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bulk upload templates for merchants
CREATE TABLE IF NOT EXISTS bulk_upload_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id VARCHAR(255) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    template_description TEXT,
    category_filter VARCHAR(100),
    column_mappings JSONB NOT NULL,
    default_values JSONB,
    validation_rules JSONB,
    is_default BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_bulk_upload_sessions_merchant ON bulk_upload_sessions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_sessions_status ON bulk_upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_sessions_created ON bulk_upload_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_errors_session ON bulk_upload_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_errors_type ON bulk_upload_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_templates_merchant ON bulk_upload_templates(merchant_id);

-- Create view for bulk upload success rates
CREATE OR REPLACE VIEW bulk_upload_success_rates AS
SELECT 
    merchant_id,
    COUNT(*) as total_uploads,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_uploads,
    ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate,
    SUM(successful_rows) as total_products_uploaded,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_processing_time_seconds
FROM bulk_upload_sessions
WHERE started_at IS NOT NULL
GROUP BY merchant_id;

-- Insert default template for comprehensive uploads
INSERT INTO bulk_upload_templates (
    merchant_id, 
    template_name, 
    template_description, 
    column_mappings, 
    is_default
) VALUES (
    'default',
    'Comprehensive Product Template',
    'Complete template with all available product and variant fields',
    '{
        "required": ["product_handle", "variant_sku", "variant_stock_quantity"],
        "optional": ["product_name", "product_description", "product_category", "product_base_price", "product_image_url", "variant_specific_price", "variant_image_url", "variant_attribute_1_name", "variant_attribute_1_value", "variant_attribute_2_name", "variant_attribute_2_value", "cashback_percentage", "is_active"]
    }',
    true
) ON CONFLICT DO NOTHING;

-- =====================================================
-- AI OPTIMIZATION SYSTEM TABLES
-- =====================================================

-- AI optimization requests and results
CREATE TABLE IF NOT EXISTS ai_optimization_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id VARCHAR(255) NOT NULL,
    product_id VARCHAR(255),
    optimization_type VARCHAR(50) NOT NULL CHECK (optimization_type IN (
        'title_optimization', 'description_enhancement', 'pricing_suggestion',
        'category_optimization', 'image_optimization', 'seo_optimization'
    )),
    input_data JSONB NOT NULL,
    ai_model_used VARCHAR(50) DEFAULT 'gpt-4',
    processing_time_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled'
    )),
    results JSONB,
    confidence_score DECIMAL(5,2),
    applied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI-generated content and suggestions
CREATE TABLE IF NOT EXISTS ai_content_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    optimization_request_id UUID REFERENCES ai_optimization_requests(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(50) NOT NULL,
    original_content TEXT,
    suggested_content TEXT NOT NULL,
    improvement_score DECIMAL(5,2),
    reasoning TEXT,
    keywords_targeted TEXT[],
    is_applied BOOLEAN DEFAULT FALSE,
    merchant_feedback VARCHAR(20) CHECK (merchant_feedback IN ('accepted', 'rejected', 'modified')),
    feedback_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for AI optimization tables
CREATE INDEX IF NOT EXISTS idx_ai_optimization_merchant ON ai_optimization_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ai_optimization_product ON ai_optimization_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_ai_optimization_type ON ai_optimization_requests(optimization_type);
CREATE INDEX IF NOT EXISTS idx_ai_optimization_status ON ai_optimization_requests(status);
CREATE INDEX IF NOT EXISTS idx_ai_content_suggestions_request ON ai_content_suggestions(optimization_request_id);

-- Create view for merchant AI usage summary
CREATE OR REPLACE VIEW merchant_ai_usage_summary AS
SELECT
    merchant_id,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_requests,
    COUNT(CASE WHEN optimization_type = 'title_optimization' THEN 1 END) as title_optimizations,
    COUNT(CASE WHEN optimization_type = 'description_enhancement' THEN 1 END) as description_enhancements,
    COUNT(CASE WHEN optimization_type = 'pricing_suggestion' THEN 1 END) as pricing_suggestions,
    AVG(confidence_score) as avg_confidence_score,
    AVG(processing_time_ms) as avg_processing_time,
    MAX(created_at) as last_request_at
FROM ai_optimization_requests
GROUP BY merchant_id;

-- Add comments for documentation
COMMENT ON TABLE bulk_upload_sessions IS 'Tracks bulk product upload sessions with progress and results';
COMMENT ON TABLE bulk_upload_errors IS 'Stores detailed error information for failed upload rows';
COMMENT ON TABLE bulk_upload_templates IS 'Merchant-specific CSV templates for bulk uploads';
COMMENT ON TABLE ai_optimization_requests IS 'Tracks AI optimization requests and results for merchant products';
COMMENT ON TABLE ai_content_suggestions IS 'Stores AI-generated content suggestions and merchant feedback';
COMMENT ON VIEW bulk_upload_success_rates IS 'Aggregated success metrics for merchant bulk uploads';
COMMENT ON VIEW merchant_ai_usage_summary IS 'Summary of AI tool usage by merchants';
