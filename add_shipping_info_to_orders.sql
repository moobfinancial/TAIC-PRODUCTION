-- Migration to add shipping_carrier and tracking_number to the orders table

ALTER TABLE public.orders
ADD COLUMN shipping_carrier VARCHAR(255) NULL,
ADD COLUMN tracking_number VARCHAR(255) NULL;

-- Optional: Add a comment to describe the new columns
COMMENT ON COLUMN public.orders.shipping_carrier IS 'Name of the shipping carrier (e.g., UPS, FedEx, USPS)';
COMMENT ON COLUMN public.orders.tracking_number IS 'Shipping tracking number provided by the carrier';
