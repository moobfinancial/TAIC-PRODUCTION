-- Add the original_name column if it doesn't exist
ALTER TABLE cj_products ADD COLUMN IF NOT EXISTS original_name TEXT;

-- Add the original_description column if it doesn't exist
ALTER TABLE cj_products ADD COLUMN IF NOT EXISTS original_description TEXT;

-- Verify the columns were added
\d+ cj_products;
