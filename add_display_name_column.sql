-- Migration script to add a display_name column to the users table

DO $$
BEGIN
    -- Check if the display_name column already exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' -- Or your specific schema if not public
        AND table_name = 'users'
        AND column_name = 'display_name'
    ) THEN
        -- Add the display_name column
        ALTER TABLE users
        ADD COLUMN display_name VARCHAR(255) NULL;

        RAISE NOTICE 'Added display_name column to users table';
    ELSE
        RAISE NOTICE 'display_name column already exists in users table';
    END IF;
END $$;
