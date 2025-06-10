CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on orders table
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Categories Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    parent_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, -- Allow null for top-level, set null if parent deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_parent_category_id ON categories(parent_category_id);

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- CJ Products Table
CREATE TABLE cj_products (
    platform_product_id SERIAL PRIMARY KEY,
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
    shipping_rules_id VARCHAR(255), -- Placeholder, could reference another table
    source VARCHAR(50) DEFAULT 'CJ',
    variants_json JSONB, -- Placeholder for CJ product variants
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

-- Admin Users Table (Simplified)
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    hashed_api_key VARCHAR(255) NOT NULL UNIQUE, -- Store a hashed version of the admin API key
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
    category VARCHAR(100), -- Legacy category name field, consider migrating to platform_category_id
    platform_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, -- Preferred way to link categories
    data_ai_hint TEXT,
    is_active BOOLEAN DEFAULT false NOT NULL,
    approval_status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- Values: 'pending', 'approved', 'rejected'
    merchant_id VARCHAR(255), -- To associate product with a merchant/user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_products_approval_status CHECK (approval_status IN ('pending', 'approved', 'rejected'))
);

-- Trigger for automatically updating the updated_at column on products table
-- Assumes the function update_updated_at_column() is defined elsewhere and is suitable.
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for products table
CREATE INDEX idx_products_platform_category_id ON products(platform_category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_approval_status ON products(approval_status);
CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_products_name ON products(name); -- For searching/sorting by name
CREATE INDEX idx_products_price ON products(price); -- For sorting/filtering by price

CREATE TABLE crypto_transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) NOT NULL,
    transaction_hash VARCHAR(255) UNIQUE,
    wallet_address VARCHAR(255) NOT NULL,
    network VARCHAR(50) NOT NULL,
    amount_expected DECIMAL(20, 8) NOT NULL,
    currency_expected VARCHAR(10) NOT NULL,
    amount_received DECIMAL(20, 8),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_user_action', -- Increased length for more descriptive statuses
    payment_initiation_data JSONB,
    confirmation_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update updated_at on crypto_transactions table
CREATE TRIGGER update_crypto_transactions_updated_at
BEFORE UPDATE ON crypto_transactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
