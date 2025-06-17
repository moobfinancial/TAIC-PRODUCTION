-- Migration to change orders.user_id from INTEGER to UUID and update Foreign Key

-- Step 1: Attempt to drop the old foreign key constraint if it exists.
-- Note: If your FK has a different name, this might need adjustment or might fail harmlessly if no such FK exists.
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

-- Step 2: Change the column type from INTEGER to UUID.
-- Before changing type, ensure the column can be NULL if it's not already,
-- or if existing integer values that become NULL would violate a NOT NULL constraint.
-- Assuming user_id can be NULL after conversion for legacy data.
ALTER TABLE public.orders
ALTER COLUMN user_id DROP NOT NULL; -- Run this if user_id is currently NOT NULL

ALTER TABLE public.orders
ALTER COLUMN user_id TYPE UUID USING NULL; -- This sets existing integer user_ids to NULL

-- Step 3: Add the new foreign key constraint referencing users.id (which is UUID)
ALTER TABLE public.orders
ADD CONSTRAINT fk_orders_user_id_users_id
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE SET NULL -- Or ON DELETE CASCADE, depending on desired data integrity rules
ON UPDATE CASCADE;

-- Optional: Add a comment to describe the updated column
COMMENT ON COLUMN public.orders.user_id IS 'Foreign key referencing the users table (UUID)';
