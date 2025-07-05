-- Migration: Customer Notifications Table for Order Processing
-- Created: 2025-07-05
-- Purpose: Add customer notification system for merchant order updates

-- Create customer_notifications table
CREATE TABLE IF NOT EXISTS customer_notifications (
    id VARCHAR(255) PRIMARY KEY,
    order_id INTEGER NOT NULL,
    customer_id UUID NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    merchant_id UUID NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_customer_notifications_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_notifications_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_notifications_merchant FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Check constraints
    CONSTRAINT chk_notification_type CHECK (notification_type IN ('status_update', 'shipping_update', 'delivery_confirmation', 'custom')),
    CONSTRAINT chk_notification_status CHECK (status IN ('pending', 'sent', 'failed'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_notifications_order_id ON customer_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_id ON customer_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_merchant_id ON customer_notifications(merchant_id);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_status ON customer_notifications(status);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_created_at ON customer_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_type_status ON customer_notifications(notification_type, status);

-- Add fulfillment_notes column to orders table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'fulfillment_notes') THEN
        ALTER TABLE orders ADD COLUMN fulfillment_notes TEXT;
    END IF;
END $$;

-- Add reorder_level column to merchant_products table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_products' AND column_name = 'reorder_level') THEN
        ALTER TABLE merchant_products ADD COLUMN reorder_level INTEGER DEFAULT 10;
    END IF;
END $$;

-- Add inventory_notes column to merchant_products table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_products' AND column_name = 'inventory_notes') THEN
        ALTER TABLE merchant_products ADD COLUMN inventory_notes TEXT;
    END IF;
END $$;

-- Grant permissions to moobuser role
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_notifications TO moobuser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO moobuser;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customer_notifications_updated_at
    BEFORE UPDATE ON customer_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_notifications_updated_at();

-- Insert sample notification types for reference
INSERT INTO customer_notifications (
    id, order_id, customer_id, customer_email, merchant_id, 
    notification_type, message, status, created_at
) VALUES 
(
    'sample_notif_001',
    1,
    (SELECT id FROM users WHERE role = 'SHOPPER' LIMIT 1),
    'sample@example.com',
    (SELECT id FROM users WHERE role = 'MERCHANT' LIMIT 1),
    'status_update',
    'Your order has been processed and will be shipped soon.',
    'sent',
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE customer_notifications IS 'Customer notification system for order updates and merchant communications';
COMMENT ON COLUMN customer_notifications.id IS 'Unique notification identifier';
COMMENT ON COLUMN customer_notifications.order_id IS 'Reference to the order this notification is about';
COMMENT ON COLUMN customer_notifications.customer_id IS 'Customer receiving the notification';
COMMENT ON COLUMN customer_notifications.merchant_id IS 'Merchant sending the notification';
COMMENT ON COLUMN customer_notifications.notification_type IS 'Type of notification: status_update, shipping_update, delivery_confirmation, custom';
COMMENT ON COLUMN customer_notifications.message IS 'Notification message content';
COMMENT ON COLUMN customer_notifications.status IS 'Notification delivery status: pending, sent, failed';
COMMENT ON COLUMN customer_notifications.sent_at IS 'Timestamp when notification was successfully sent';
