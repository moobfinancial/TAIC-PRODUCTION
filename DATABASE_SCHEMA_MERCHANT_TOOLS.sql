-- TAIC Merchant Tools Database Schema
-- Advanced Merchant Empowerment & AI-Powered Tools
-- Version: 4.0 - Phase 4 Implementation

-- =====================================================
-- BULK UPLOAD SYSTEM TABLES
-- =====================================================

-- Bulk upload session tracking
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

-- Detailed error tracking for bulk uploads
CREATE TABLE bulk_upload_errors (
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

-- Bulk upload templates for merchants
CREATE TABLE bulk_upload_templates (
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

-- =====================================================
-- AI OPTIMIZATION SYSTEM TABLES
-- =====================================================

-- AI optimization requests and results
CREATE TABLE ai_optimization_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id VARCHAR(255) NOT NULL,
    product_id VARCHAR(255),
    optimization_type VARCHAR(50) NOT NULL CHECK (optimization_type IN (
        'title_optimization', 'description_enhancement', 'pricing_suggestion',
        'category_optimization', 'image_optimization', 'seo_optimization'
    )),
    input_data JSONB NOT NULL,
    ai_model_used VARCHAR(50),
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
CREATE TABLE ai_content_suggestions (
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

-- Product optimization history
CREATE TABLE product_optimization_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(255) NOT NULL,
    merchant_id VARCHAR(255) NOT NULL,
    optimization_type VARCHAR(50) NOT NULL,
    before_data JSONB NOT NULL,
    after_data JSONB NOT NULL,
    performance_impact JSONB,
    ai_confidence DECIMAL(5,2),
    applied_by VARCHAR(255),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MARKET INTELLIGENCE SYSTEM TABLES
-- =====================================================

-- Market trend data and analysis
CREATE TABLE market_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    trend_type VARCHAR(50) NOT NULL CHECK (trend_type IN (
        'search_volume', 'social_mentions', 'price_trends', 'demand_forecast'
    )),
    data_source VARCHAR(50) NOT NULL,
    trend_data JSONB NOT NULL,
    trend_score DECIMAL(5,2),
    confidence_level DECIMAL(5,2),
    geographic_scope VARCHAR(50) DEFAULT 'global',
    time_period_start DATE NOT NULL,
    time_period_end DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Competitor analysis data
CREATE TABLE competitor_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    competitor_name VARCHAR(255),
    competitor_url VARCHAR(500),
    competitor_price DECIMAL(10,2),
    competitor_rating DECIMAL(3,2),
    competitor_reviews_count INTEGER,
    feature_comparison JSONB,
    market_position VARCHAR(50),
    data_collected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seasonal demand patterns
CREATE TABLE seasonal_demand_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    month_of_year INTEGER CHECK (month_of_year BETWEEN 1 AND 12),
    week_of_year INTEGER CHECK (week_of_year BETWEEN 1 AND 53),
    demand_multiplier DECIMAL(5,2) NOT NULL,
    historical_data_years INTEGER NOT NULL,
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ADVERTISING PLATFORM TABLES
-- =====================================================

-- Advertising campaigns
CREATE TABLE advertising_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id VARCHAR(255) NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL CHECK (campaign_type IN (
        'sponsored_product', 'featured_merchant', 'category_boost', 'search_ads'
    )),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'active', 'paused', 'completed', 'cancelled'
    )),
    budget_type VARCHAR(20) NOT NULL CHECK (budget_type IN ('daily', 'total', 'unlimited')),
    daily_budget DECIMAL(10,2),
    total_budget DECIMAL(10,2),
    current_spend DECIMAL(10,2) DEFAULT 0,
    bid_strategy VARCHAR(50) NOT NULL CHECK (bid_strategy IN (
        'manual_cpc', 'auto_cpc', 'target_roas', 'maximize_clicks'
    )),
    default_bid DECIMAL(10,2),
    target_roas DECIMAL(5,2),
    targeting_criteria JSONB,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaign products (for sponsored product campaigns)
CREATE TABLE campaign_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    bid_amount DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    performance_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ad placements and impressions
CREATE TABLE ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
    product_id VARCHAR(255),
    placement_type VARCHAR(50) NOT NULL CHECK (placement_type IN (
        'homepage_featured', 'category_top', 'search_results', 'product_recommendations'
    )),
    placement_position INTEGER,
    user_id VARCHAR(255),
    user_session_id VARCHAR(255),
    impression_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    click_timestamp TIMESTAMP WITH TIME ZONE,
    conversion_timestamp TIMESTAMP WITH TIME ZONE,
    conversion_value DECIMAL(10,2),
    cost_per_click DECIMAL(10,4),
    quality_score DECIMAL(5,2)
);

-- Campaign performance metrics
CREATE TABLE campaign_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    conversion_value DECIMAL(10,2) DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    click_through_rate DECIMAL(5,4),
    conversion_rate DECIMAL(5,4),
    cost_per_click DECIMAL(10,4),
    cost_per_conversion DECIMAL(10,2),
    return_on_ad_spend DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, metric_date)
);

-- =====================================================
-- MERCHANT TIER AND RECOGNITION SYSTEM
-- =====================================================

-- Featured merchant programs
CREATE TABLE featured_merchant_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_name VARCHAR(255) NOT NULL,
    program_type VARCHAR(50) NOT NULL CHECK (program_type IN (
        'merchant_of_month', 'new_merchant_spotlight', 'top_performer', 'rising_star'
    )),
    description TEXT,
    eligibility_criteria JSONB NOT NULL,
    benefits JSONB,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Merchant program participation
CREATE TABLE merchant_program_participation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id VARCHAR(255) NOT NULL,
    program_id UUID REFERENCES featured_merchant_programs(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'nominated' CHECK (status IN (
        'nominated', 'selected', 'active', 'completed', 'disqualified'
    )),
    nomination_reason TEXT,
    selection_criteria_met JSONB,
    participation_start DATE,
    participation_end DATE,
    performance_during_program JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Merchant badges and achievements
CREATE TABLE merchant_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_name VARCHAR(255) NOT NULL,
    badge_type VARCHAR(50) NOT NULL CHECK (badge_type IN (
        'performance', 'milestone', 'quality', 'innovation', 'community'
    )),
    description TEXT,
    icon_url VARCHAR(500),
    criteria JSONB NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Merchant badge awards
CREATE TABLE merchant_badge_awards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id VARCHAR(255) NOT NULL,
    badge_id UUID REFERENCES merchant_badges(id) ON DELETE CASCADE,
    awarded_for TEXT,
    criteria_met JSONB,
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_visible BOOLEAN DEFAULT TRUE,
    UNIQUE(merchant_id, badge_id)
);

-- =====================================================
-- CONTENT GENERATION AND MANAGEMENT
-- =====================================================

-- AI-generated content library
CREATE TABLE ai_generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id VARCHAR(255) NOT NULL,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN (
        'product_description', 'marketing_copy', 'social_media_post', 
        'email_campaign', 'blog_post', 'seo_content'
    )),
    target_product_id VARCHAR(255),
    content_title VARCHAR(255),
    content_body TEXT NOT NULL,
    content_metadata JSONB,
    ai_model_used VARCHAR(50),
    generation_prompt TEXT,
    quality_score DECIMAL(5,2),
    usage_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Content performance tracking
CREATE TABLE content_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES ai_generated_content(id) ON DELETE CASCADE,
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    measurement_date DATE NOT NULL,
    context_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =====================================================

-- Bulk upload indexes
CREATE INDEX idx_bulk_upload_sessions_merchant ON bulk_upload_sessions(merchant_id);
CREATE INDEX idx_bulk_upload_sessions_status ON bulk_upload_sessions(status);
CREATE INDEX idx_bulk_upload_sessions_created ON bulk_upload_sessions(created_at);
CREATE INDEX idx_bulk_upload_errors_session ON bulk_upload_errors(session_id);
CREATE INDEX idx_bulk_upload_errors_type ON bulk_upload_errors(error_type);

-- AI optimization indexes
CREATE INDEX idx_ai_optimization_merchant ON ai_optimization_requests(merchant_id);
CREATE INDEX idx_ai_optimization_product ON ai_optimization_requests(product_id);
CREATE INDEX idx_ai_optimization_type ON ai_optimization_requests(optimization_type);
CREATE INDEX idx_ai_optimization_status ON ai_optimization_requests(status);
CREATE INDEX idx_ai_content_suggestions_request ON ai_content_suggestions(optimization_request_id);

-- Market intelligence indexes
CREATE INDEX idx_market_trends_category ON market_trends(category);
CREATE INDEX idx_market_trends_type ON market_trends(trend_type);
CREATE INDEX idx_market_trends_period ON market_trends(time_period_start, time_period_end);
CREATE INDEX idx_competitor_analysis_product ON competitor_analysis(product_name);
CREATE INDEX idx_competitor_analysis_category ON competitor_analysis(category);
CREATE INDEX idx_seasonal_patterns_category ON seasonal_demand_patterns(category);

-- Advertising indexes
CREATE INDEX idx_campaigns_merchant ON advertising_campaigns(merchant_id);
CREATE INDEX idx_campaigns_status ON advertising_campaigns(status);
CREATE INDEX idx_campaigns_type ON advertising_campaigns(campaign_type);
CREATE INDEX idx_campaign_products_campaign ON campaign_products(campaign_id);
CREATE INDEX idx_campaign_products_product ON campaign_products(product_id);
CREATE INDEX idx_ad_impressions_campaign ON ad_impressions(campaign_id);
CREATE INDEX idx_ad_impressions_timestamp ON ad_impressions(impression_timestamp);
CREATE INDEX idx_campaign_metrics_campaign ON campaign_performance_metrics(campaign_id);
CREATE INDEX idx_campaign_metrics_date ON campaign_performance_metrics(metric_date);

-- Merchant program indexes
CREATE INDEX idx_merchant_programs_type ON featured_merchant_programs(program_type);
CREATE INDEX idx_merchant_participation_merchant ON merchant_program_participation(merchant_id);
CREATE INDEX idx_merchant_participation_program ON merchant_program_participation(program_id);
CREATE INDEX idx_merchant_badges_type ON merchant_badges(badge_type);
CREATE INDEX idx_merchant_badge_awards_merchant ON merchant_badge_awards(merchant_id);

-- Content indexes
CREATE INDEX idx_ai_content_merchant ON ai_generated_content(merchant_id);
CREATE INDEX idx_ai_content_type ON ai_generated_content(content_type);
CREATE INDEX idx_ai_content_product ON ai_generated_content(target_product_id);
CREATE INDEX idx_content_performance_content ON content_performance(content_id);

-- =====================================================
-- VIEWS FOR ANALYTICS AND REPORTING
-- =====================================================

-- Merchant AI usage summary
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

-- Campaign performance dashboard
CREATE OR REPLACE VIEW campaign_performance_dashboard AS
SELECT 
    c.id as campaign_id,
    c.merchant_id,
    c.campaign_name,
    c.campaign_type,
    c.status,
    c.current_spend,
    c.daily_budget,
    c.total_budget,
    COALESCE(SUM(m.impressions), 0) as total_impressions,
    COALESCE(SUM(m.clicks), 0) as total_clicks,
    COALESCE(SUM(m.conversions), 0) as total_conversions,
    COALESCE(SUM(m.conversion_value), 0) as total_conversion_value,
    COALESCE(AVG(m.click_through_rate), 0) as avg_ctr,
    COALESCE(AVG(m.conversion_rate), 0) as avg_conversion_rate,
    COALESCE(AVG(m.return_on_ad_spend), 0) as avg_roas
FROM advertising_campaigns c
LEFT JOIN campaign_performance_metrics m ON c.id = m.campaign_id
GROUP BY c.id, c.merchant_id, c.campaign_name, c.campaign_type, c.status, 
         c.current_spend, c.daily_budget, c.total_budget;

-- Bulk upload success rates
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
