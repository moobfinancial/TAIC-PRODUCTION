-- Migration to add username and merchant business fields to the users table
-- Username is required for all users
-- business_name and business_description are nullable fields for merchant users

-- Step 1: Add username column with NOT NULL constraint
-- First, add it as nullable to avoid issues with existing data
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Step 2: Add business fields (always nullable)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS business_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS business_description TEXT;

-- Step 3: Fill in usernames for existing users
-- For users with email, use the part before @ symbol
UPDATE public.users
SET username = SUBSTRING(email FROM 1 FOR POSITION('@' IN email) - 1)
WHERE username IS NULL AND email IS NOT NULL;

-- For wallet-only users, use a prefix + truncated wallet address
UPDATE public.users
SET username = 'wallet_' || SUBSTRING(wallet_address FROM 3 FOR 8)
WHERE username IS NULL AND wallet_address IS NOT NULL;

-- If any users without username remain, generate random usernames
-- This ensures we can safely add the NOT NULL constraint
UPDATE public.users
SET username = 'user_' || id::text
WHERE username IS NULL;

-- Step 4: Add unique constraint and NOT NULL constraint now that all rows have values
ALTER TABLE public.users
ALTER COLUMN username SET NOT NULL;

-- Create index on username for performance on lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON public.users (username);

-- Add comments to document the columns
COMMENT ON COLUMN public.users.username IS 'Unique username for the user, required for all users';
COMMENT ON COLUMN public.users.business_name IS 'Business name for merchant users, null for shoppers';
COMMENT ON COLUMN public.users.business_description IS 'Business description for merchant users, null for shoppers';

-- End of migration
