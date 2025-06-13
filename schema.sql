-- Users Table (Comprehensive)
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY, -- Application-generated unique ID (e.g., UUID)
    email VARCHAR(255) UNIQUE, -- Nullable if user signs up with wallet only
    hashed_password VARCHAR(255), -- Nullable if user signs up with wallet only
    password_salt VARCHAR(255), -- Companion to hashed_password
    wallet_address VARCHAR(255) UNIQUE, -- Nullable if user signs up with email only. Wallet addresses are typically case-sensitive or mixed-case checksummed. Store as received or normalize if appropriate for the specific blockchain.
    role VARCHAR(50) NOT NULL DEFAULT 'SHOPPER' CHECK (role IN ('SHOPPER', 'MERCHANT', 'ADMIN')),
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    wallet_verified BOOLEAN DEFAULT FALSE NOT NULL, -- If wallet ownership verification is planned
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Function to update updated_at timestamp (if not already defined)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NULL, -- Changed from INTEGER to VARCHAR(255), kept NULLABLE for ON DELETE SET NULL
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_payment', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'failed')), -- Added CHECK constraint
    shipping_address_summary TEXT NULLABLE,
    tracking_number VARCHAR(255) NULLABLE,
    carrier_name VARCHAR(100) NULLABLE,
    CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order Items Table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL, 
    variant_id INTEGER NULL, 
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_item DECIMAL(10, 2) NOT NULL, 
    product_name_snapshot VARCHAR(255) NOT NULL, 
    variant_attributes_snapshot JSONB NULLABLE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);

CREATE TRIGGER update_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) NOT NULL,
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount_received DECIMAL(10, 2),
    currency VARCHAR(3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Categories Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    category_type VARCHAR(10) DEFAULT 'PRODUCT' NOT NULL,
    custom_attributes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT categories_name_parent_id_unique UNIQUE (name, parent_category_id),
    CONSTRAINT check_category_type CHECK (category_type IN ('PRODUCT', 'SERVICE'))
);

CREATE INDEX idx_categories_parent_category_id ON categories(parent_category_id);
CREATE INDEX idx_categories_category_type ON categories(category_type);

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- CJ Products Table
CREATE TABLE cj_products (
    platform_product_id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    cj_product_id VARCHAR(255) UNIQUE NOT NULL,
    cj_product_data_json JSONB,
    display_name VARCHAR(255) NOT NULL,
    display_description TEXT,
    platform_category_id INTEGER NOT NULL REFERENCES categories(id),
    selling_price NUMERIC(10, 2) NOT NULL,
    cj_base_price NUMERIC(10, 2),
    image_url TEXT,
    additional_image_urls_json JSONB,
    is_active BOOLEAN DEFAULT FALSE,
    cashback_percentage NUMERIC(5, 2) DEFAULT 0.00,
    shipping_rules_id VARCHAR(255),
    source VARCHAR(50) DEFAULT 'CJ',
    variants_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cj_products_cj_product_id ON cj_products(cj_product_id);
CREATE INDEX idx_cj_products_platform_category_id ON cj_products(platform_category_id);
CREATE INDEX idx_cj_products_is_active ON cj_products(is_active);

CREATE TRIGGER update_cj_products_updated_at
    BEFORE UPDATE ON cj_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE, 
    hashed_api_key VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_users_username ON admin_users(username);

CREATE TABLE products (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL, 
    base_price DECIMAL(10, 2) NULL, 
    image_url VARCHAR(255),
    additional_image_urls JSONB NULL, 
    category VARCHAR(100),
    platform_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    data_ai_hint TEXT,
    is_active BOOLEAN DEFAULT false NOT NULL,
    approval_status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    merchant_id VARCHAR(255), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    has_variants BOOLEAN DEFAULT FALSE,
    source VARCHAR(50),
    original_cj_product_id VARCHAR(255) UNIQUE,
    cashback_percentage DECIMAL(5, 2) DEFAULT 0.00 NULL,
    external_shipping_rules_id VARCHAR(255) NULL,
    original_source_data JSONB NULL, 
    admin_review_notes TEXT NULL,
    weight_kg DECIMAL(10,3) NULLABLE DEFAULT 0.100, 
    default_variant_id INTEGER, -- Added from your local commit
    CONSTRAINT check_products_approval_status CHECK (approval_status IN ('pending', 'approved', 'rejected'))
);

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_products_platform_category_id ON products(platform_category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_approval_status ON products(approval_status);
CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_products_name ON products(name); 
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_has_variants ON products(has_variants); -- From origin/master
CREATE INDEX idx_products_source ON products(source); -- From origin/master
CREATE INDEX idx_products_original_cj_product_id ON products(original_cj_product_id); -- From origin/master

CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL, 
    sku VARCHAR(255) UNIQUE NOT NULL,
    name_override VARCHAR(512),      
    price DECIMAL(10, 2) NOT NULL,   
    image_url VARCHAR(255),          
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    weight_grams INTEGER,            
    attributes JSONB,                
    is_active BOOLEAN DEFAULT TRUE,  
    cj_variant_id VARCHAR(255) UNIQUE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_variants_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_cj_variant_id ON product_variants(cj_variant_id); -- From your local commit
CREATE INDEX idx_product_variants_attributes ON product_variants USING GIN (attributes); -- From your local commit

CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE products
ADD CONSTRAINT fk_products_default_variant
FOREIGN KEY (default_variant_id) REFERENCES product_variants(id) ON DELETE SET NULL; -- From your local commit

CREATE INDEX idx_products_default_variant_id ON products(default_variant_id); -- From your local commit

CREATE TABLE crypto_transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) NOT NULL,
    transaction_hash VARCHAR(255) UNIQUE,
    wallet_address VARCHAR(255) NOT NULL,
    network VARCHAR(50) NOT NULL,
    amount_expected DECIMAL(20, 8) NOT NULL,
    currency_expected VARCHAR(10) NOT NULL,
    amount_received DECIMAL(20, 8),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_user_action',
    payment_initiation_data JSONB,
    confirmation_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_crypto_transactions_updated_at
BEFORE UPDATE ON crypto_transactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE admin_audit_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    admin_username VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    target_entity_type VARCHAR(100),
    target_entity_id VARCHAR(255),
    details JSONB
);

CREATE INDEX idx_admin_audit_log_timestamp ON admin_audit_log(timestamp);
CREATE INDEX idx_admin_audit_log_admin_username ON admin_audit_log(admin_username);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_target_entity ON admin_audit_log(target_entity_type, target_entity_id);

CREATE TABLE merchant_store_profiles (
    merchant_id VARCHAR(255) PRIMARY KEY, 
    store_slug VARCHAR(255) UNIQUE NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    banner_url VARCHAR(255),
    logo_url VARCHAR(255),
    store_description TEXT,
    custom_settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_merchant_store_profiles_store_slug ON merchant_store_profiles(store_slug);

CREATE TRIGGER update_merchant_store_profiles_updated_at
    BEFORE UPDATE ON merchant_store_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE store_reviews (
    id SERIAL PRIMARY KEY,
    merchant_id VARCHAR(255) NOT NULL REFERENCES merchant_store_profiles(merchant_id) ON DELETE CASCADE,
    reviewer_id VARCHAR(255), 
    reviewer_name VARCHAR(255),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_title VARCHAR(255),
    review_text TEXT,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_store_reviews_merchant_id ON store_reviews(merchant_id);
CREATE INDEX idx_store_reviews_reviewer_id ON store_reviews(reviewer_id);
CREATE INDEX idx_store_reviews_is_approved ON store_reviews(is_approved);
CREATE INDEX idx_store_reviews_rating ON store_reviews(rating);

CREATE TRIGGER update_store_reviews_updated_at
    BEFORE UPDATE ON store_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE ai_agent_feedback (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(100) NOT NULL,
    session_id VARCHAR(255) NULL,
    user_query TEXT NULL,
    recommendation_reference_id VARCHAR(255) NULL,
    feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'rating_scale', 'text_comment')),
    rating_value INTEGER NULL,
    comment_text TEXT NULL,
    user_id VARCHAR(255) NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_ai_agent_feedback_agent_name ON ai_agent_feedback(agent_name);
CREATE INDEX idx_ai_agent_feedback_session_id ON ai_agent_feedback(session_id);
CREATE INDEX idx_ai_agent_feedback_user_id ON ai_agent_feedback(user_id);
CREATE INDEX idx_ai_agent_feedback_feedback_type ON ai_agent_feedback(feedback_type);
CREATE INDEX idx_ai_agent_feedback_recommendation_reference_id ON ai_agent_feedback(recommendation_reference_id);

CREATE TABLE vto_images (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL, 
    image_type VARCHAR(50) NOT NULL CHECK (image_type IN ('user_profile_for_vto', 'generated_vto_result')),
    original_filename VARCHAR(255),
    stored_filepath VARCHAR(1024) NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    related_product_id VARCHAR(255), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_vto_images_user_id ON vto_images(user_id);
CREATE INDEX idx_vto_images_image_type ON vto_images(image_type);
CREATE INDEX idx_vto_images_related_product_id ON vto_images(related_product_id);
CREATE INDEX idx_vto_images_expires_at ON vto_images(expires_at);

-- Pioneer Program Applications Table
CREATE TABLE pioneer_applications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NULL, -- FK to users.id (nullable if non-users can apply or if linked later)
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telegram_handle VARCHAR(100) NULL,
    discord_id VARCHAR(100) NULL,
    country_of_residence VARCHAR(100) NULL,
    applying_for_tier VARCHAR(100) NOT NULL, -- Added this field
    application_text TEXT NOT NULL,
    reason_for_interest TEXT,
    relevant_experience TEXT,
    social_media_links JSONB,
    application_status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- Renamed from 'status' and updated check
    internal_notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by_admin_id INTEGER, -- Could reference admin_users(id) if needed
    -- Note: Tier names might be better in a separate table if they become complex or have associated data
    CONSTRAINT check_applying_for_tier CHECK (applying_for_tier IN (
        'Tier 1: Visionary Partner',
        'Tier 2: Strategic Influencer',
        'Tier 3: Early Champion',
        'Tier 4: Community Advocate',
        'Tier 5: Platform Pioneer'
        -- Add other tiers as defined in docs/pioneer_program_tiers_definition.md
    )),
    CONSTRAINT check_pioneer_application_status CHECK (application_status IN ( -- Renamed constraint for clarity
        'pending',
        'under_review',
        'additional_info_requested',
        'approved',
        'rejected',
        'waitlisted',
        'onboarded'
    ))
);

CREATE INDEX idx_pioneer_applications_user_id ON pioneer_applications(user_id);
CREATE INDEX idx_pioneer_applications_email ON pioneer_applications(email);
CREATE INDEX idx_pioneer_applications_applying_for_tier ON pioneer_applications(applying_for_tier); -- Added index
CREATE INDEX idx_pioneer_applications_application_status ON pioneer_applications(application_status); -- Updated index name
CREATE INDEX idx_pioneer_applications_submitted_at ON pioneer_applications(submitted_at);

CREATE TRIGGER update_pioneer_applications_updated_at
    BEFORE UPDATE ON pioneer_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE shipping_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_shipping_zones_updated_at
    BEFORE UPDATE ON shipping_zones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE shipping_zone_locations (
    id SERIAL PRIMARY KEY,
    shipping_zone_id INTEGER NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
    country_code VARCHAR(2) NOT NULL, 
    state_province_code VARCHAR(50) NULL, 
    postal_code_pattern VARCHAR(255) NULL, -- e.g., "902*", "AB1*|AB2*"
    CONSTRAINT uq_shipping_zone_location UNIQUE (shipping_zone_id, country_code, state_province_code, postal_code_pattern)
);

CREATE INDEX idx_shipping_zone_locations_zone_id ON shipping_zone_locations(shipping_zone_id);
CREATE INDEX idx_shipping_zone_locations_country ON shipping_zone_locations(country_code);
CREATE INDEX idx_shipping_zone_locations_state_province ON shipping_zone_locations(state_province_code);


CREATE TABLE shipping_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    processing_time_estimate TEXT, -- e.g., "1-2 business days"
    delivery_time_estimate TEXT, -- e.g., "3-5 business days"
    logo_url VARCHAR(255),
    tracking_url_template VARCHAR(512), -- e.g., "https://carrier.com/track?id={tracking_number}"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_shipping_methods_updated_at
    BEFORE UPDATE ON shipping_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE shipping_rates (
    id SERIAL PRIMARY KEY,
    shipping_zone_id INTEGER NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
    shipping_method_id INTEGER NOT NULL REFERENCES shipping_methods(id) ON DELETE CASCADE,
    condition_type VARCHAR(50) NOT NULL DEFAULT 'PRICE' CHECK (condition_type IN ('PRICE', 'WEIGHT', 'ITEM_COUNT')),
    min_condition_value DECIMAL(10,2) NULL, -- Min order price, weight (kg), or item count
    max_condition_value DECIMAL(10,2) NULL, -- Max order price, weight (kg), or item count
    rate DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_shipping_rate_criteria UNIQUE (shipping_zone_id, shipping_method_id, condition_type, min_condition_value, max_condition_value)
);

CREATE INDEX idx_shipping_rates_zone_method ON shipping_rates(shipping_zone_id, shipping_method_id);
CREATE INDEX idx_shipping_rates_condition_type ON shipping_rates(condition_type);
CREATE INDEX idx_shipping_rates_is_active ON shipping_rates(is_active);

CREATE TRIGGER update_shipping_rates_updated_at
    BEFORE UPDATE ON shipping_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE user_addresses (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address_nickname VARCHAR(255) NULLABLE, 
    contact_name VARCHAR(255) NOT NULL,
    -- ... (rest of user_addresses table as it was, assuming no conflicts there) ...
    company_name VARCHAR(255) NULLABLE,
    street_address_line1 VARCHAR(255) NOT NULL,
    street_address_line2 VARCHAR(255) NULLABLE,
    city VARCHAR(100) NOT NULL,
    state_province_region VARCHAR(100) NOT NULL,
    postal_zip_code VARCHAR(20) NOT NULL,
    country_code VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2 country code
    phone_number VARCHAR(50) NULLABLE,
    is_default_shipping BOOLEAN DEFAULT FALSE,
    is_default_billing BOOLEAN DEFAULT FALSE,
    additional_instructions TEXT NULLABLE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_user_addresses_country_code ON user_addresses(country_code);
CREATE INDEX idx_user_addresses_is_default_shipping ON user_addresses(user_id, is_default_shipping);
CREATE INDEX idx_user_addresses_is_default_billing ON user_addresses(user_id, is_default_billing);

CREATE TRIGGER update_user_addresses_updated_at
    BEFORE UPDATE ON user_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
