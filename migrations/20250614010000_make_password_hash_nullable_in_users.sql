-- Migration to make the password_hash column nullable in the users table

-- Step 1: Alter the column to allow NULL values
ALTER TABLE public.users
ALTER COLUMN password_hash DROP NOT NULL;

-- Add a comment to the column for clarity
COMMENT ON COLUMN public.users.password_hash IS 'User''s hashed password. Can be null for wallet-only users or users who have not set a password.';

-- End of migration
