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

-- Existing tables below, with updated comments for FKs where applicable

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER, -- TODO: Change user_id type to VARCHAR(255) to reference users.id; currently INTEGER.
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- Admin Users Table (Simplified - separate from main 'users' table for distinct admin auth/management)
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE, -- This username could be linked to a users.email or a specific admin user ID if needed
    hashed_api_key VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_users_username ON admin_users(username);

-- Products table
CREATE TABLE products (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(255),
    category VARCHAR(100),
    platform_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    data_ai_hint TEXT,
    is_active BOOLEAN DEFAULT false NOT NULL,
    approval_status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    merchant_id VARCHAR(255), -- Conceptually REFERENCES users(id) WHERE users.role = 'MERCHANT'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    has_variants BOOLEAN DEFAULT FALSE,
    source VARCHAR(50),
    original_cj_product_id VARCHAR(255) UNIQUE,
    admin_review_notes TEXT NULL,
    CONSTRAINT check_products_approval_status CHECK (approval_status IN ('pending', 'approved', 'rejected'))
);

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_products_platform_category_id ON products(platform_category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_approval_status ON products(approval_status);
CREATE INDEX idx_products_merchant_id ON products(merchant_id); -- For faster lookups of merchant products
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_has_variants ON products(has_variants);
CREATE INDEX idx_products_source ON products(source);
CREATE INDEX idx_products_original_cj_product_id ON products(original_cj_product_id);

-- Product Variants Table
CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(255) REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(255) UNIQUE,
    attributes JSONB NOT NULL,
    specific_price DECIMAL(10, 2),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    image_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);

CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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

-- Admin Audit Log Table
CREATE TABLE admin_audit_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    admin_username VARCHAR(255) NOT NULL, -- Consider FK to admin_users.username if strict consistency needed
    action VARCHAR(255) NOT NULL,
    target_entity_type VARCHAR(100),
    target_entity_id VARCHAR(255),
    details JSONB
);

CREATE INDEX idx_admin_audit_log_timestamp ON admin_audit_log(timestamp);
CREATE INDEX idx_admin_audit_log_admin_username ON admin_audit_log(admin_username);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_target_entity ON admin_audit_log(target_entity_type, target_entity_id);

-- Merchant Store Profiles Table
CREATE TABLE merchant_store_profiles (
    merchant_id VARCHAR(255) PRIMARY KEY, -- Conceptually REFERENCES users(id) WHERE users.role = 'MERCHANT' (and users.id is VARCHAR(255))
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

-- Store Reviews Table
CREATE TABLE store_reviews (
    id SERIAL PRIMARY KEY,
    merchant_id VARCHAR(255) NOT NULL REFERENCES merchant_store_profiles(merchant_id) ON DELETE CASCADE,
    reviewer_id VARCHAR(255), -- Conceptually REFERENCES users(id) (and users.id is VARCHAR(255))
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

-- AI Agent Feedback Table
CREATE TABLE ai_agent_feedback (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(100) NOT NULL,
    session_id VARCHAR(255) NULL,
    user_query TEXT NULL,
    recommendation_reference_id VARCHAR(255) NULL,
    feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'rating_scale', 'text_comment')),
    rating_value INTEGER NULL, -- Application logic to ensure this is set if feedback_type is 'rating_scale'
    comment_text TEXT NULL,
    user_id VARCHAR(255) NULL, -- Conceptually REFERENCES users(id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_ai_agent_feedback_agent_name ON ai_agent_feedback(agent_name);
CREATE INDEX idx_ai_agent_feedback_session_id ON ai_agent_feedback(session_id);
CREATE INDEX idx_ai_agent_feedback_user_id ON ai_agent_feedback(user_id);
CREATE INDEX idx_ai_agent_feedback_feedback_type ON ai_agent_feedback(feedback_type);
CREATE INDEX idx_ai_agent_feedback_recommendation_reference_id ON ai_agent_feedback(recommendation_reference_id);

-- Virtual Try-On (VTO) Images Table
CREATE TABLE vto_images (
    id VARCHAR(255) PRIMARY KEY, -- e.g., UUID generated by application
    user_id VARCHAR(255) NOT NULL, -- Conceptually REFERENCES users(id) ON DELETE CASCADE
    image_type VARCHAR(50) NOT NULL CHECK (image_type IN ('user_profile_for_vto', 'generated_vto_result')),
    original_filename VARCHAR(255),
    stored_filepath VARCHAR(1024) NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    related_product_id VARCHAR(255), -- Conceptually REFERENCES products(id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE -- If images are to be automatically deleted
);

CREATE INDEX idx_vto_images_user_id ON vto_images(user_id);
CREATE INDEX idx_vto_images_image_type ON vto_images(image_type);
CREATE INDEX idx_vto_images_related_product_id ON vto_images(related_product_id);
CREATE INDEX idx_vto_images_expires_at ON vto_images(expires_at);
