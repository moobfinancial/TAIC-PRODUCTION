-- Migration to make the email column nullable in the users table
-- and ensure the unique constraint on email allows for multiple NULLs.

-- Step 1: Drop the existing unique constraint if it exists and doesn't allow multiple NULLs.
-- PostgreSQL unique constraints by default allow multiple NULLs, but if it was created
-- as UNIQUE NOT NULL or with a specific index that treats NULLs as equal, it might need adjustment.
-- We'll assume standard behavior for now. If this fails due to a specific unique index,
-- that index might need to be dropped and recreated as a partial index.
-- Example: DROP INDEX IF EXISTS unique_email_idx; (if a custom index exists)

-- Step 2: Alter the column to allow NULL values
ALTER TABLE public.users
ALTER COLUMN email DROP NOT NULL;

-- Optional Step 3: If there was a unique constraint that didn't behave as desired with NULLs,
-- you might recreate it here. Standard UNIQUE constraints in PostgreSQL allow multiple NULLs.
-- If you had a UNIQUE INDEX like `CREATE UNIQUE INDEX unique_email_idx ON users (email);`
-- this already allows multiple NULLs.
-- If you had `CREATE UNIQUE INDEX unique_email_idx ON users (COALESCE(email, 'some_magic_null_placeholder'));`
-- then that would need to be dropped.

-- For simplicity, we assume the standard UNIQUE constraint on `email` (if it exists)
-- already handles multiple NULLs correctly. If not, further specific DDL will be needed.

-- Add a comment to the column for clarity
COMMENT ON COLUMN public.users.email IS 'User''s email address. Can be null for wallet-only users.';

-- End of migration
