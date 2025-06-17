ALTER TABLE orders
ADD COLUMN cashback_awarded DECIMAL(10, 2) DEFAULT 0.00;

COMMENT ON COLUMN orders.cashback_awarded IS 'The amount of cashback awarded for this order.';
