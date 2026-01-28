-- ============================================================================
-- Update role constraint to support 5 roles instead of 2
-- ============================================================================
-- This migration updates the profiles.role column to support:
-- - platform_admin
-- - workspace_admin
-- - ml_engineer
-- - operator
-- - viewer
--
-- Existing data mapping:
-- - 'admin' → 'workspace_admin'
-- - 'member' → 'viewer'

-- Step 1: Drop the existing CHECK constraint on the role column
-- Find the constraint name first (PostgreSQL auto-generates names like profiles_role_check)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND conname LIKE '%role%';
    
    -- Drop the constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No role constraint found, proceeding...';
    END IF;
END $$;

-- Step 2: Update existing data to map old roles to new roles
-- Map 'admin' → 'workspace_admin'
UPDATE public.profiles
SET role = 'workspace_admin'
WHERE role = 'admin';

-- Map 'member' → 'viewer'
UPDATE public.profiles
SET role = 'viewer'
WHERE role = 'member';

-- Step 3: Add the new CHECK constraint with all 5 roles
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('platform_admin', 'workspace_admin', 'ml_engineer', 'operator', 'viewer'));

-- Step 4: Update the index (if needed, indexes don't need to change)
-- The existing indexes will continue to work fine

-- ============================================================================
-- Verification queries (run these to verify the migration)
-- ============================================================================
-- SELECT 
--   role,
--   COUNT(*) as count
-- FROM public.profiles
-- WHERE company_id IS NOT NULL
-- GROUP BY role;
--
-- Should show:
-- - workspace_admin: users who were previously 'admin'
-- - viewer: users who were previously 'member'
-- - platform_admin, ml_engineer, operator: can be assigned via admin UI
-- ============================================================================
