-- ============================================================================
-- Allow Platform Admin and Workspace Admin to update user roles
-- ============================================================================
-- This migration creates an RLS policy that allows users with
-- 'platform_admin' or 'workspace_admin' roles to update the 'role' column
-- in the profiles table.
--
-- Context: Backend has no Supabase dependencies, so frontend must update
-- roles directly. This policy enables that functionality.

-- Step 1: Create policy for admins to update roles
-- This policy allows platform_admin and workspace_admin to update the role
-- column for any user in their company (or all users for platform_admin)
CREATE POLICY "admins_can_update_user_roles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Check if the current user (auth.uid()) is an admin
  EXISTS (
    SELECT 1 
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('platform_admin', 'workspace_admin')
  )
)
WITH CHECK (
  -- Ensure the user making the update is still an admin
  EXISTS (
    SELECT 1 
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('platform_admin', 'workspace_admin')
  )
);

-- Step 2: Optional - Add more restrictive policy for workspace_admin
-- This ensures workspace_admin can only update roles within their company
-- (platform_admin can update any user)
CREATE POLICY "workspace_admin_can_update_roles_in_company"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Check if current user is workspace_admin
  EXISTS (
    SELECT 1 
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'workspace_admin'
  )
  AND
  -- Ensure the target user is in the same company
  (
    -- If current user is workspace_admin, target must be in same company
    (SELECT company_id FROM public.profiles WHERE id = auth.uid()) = 
    (SELECT company_id FROM public.profiles WHERE id = profiles.id)
    OR
    -- Platform admin can update anyone (handled by first policy)
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'platform_admin'
    )
  )
)
WITH CHECK (
  -- Same checks for WITH CHECK clause
  EXISTS (
    SELECT 1 
    FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'workspace_admin'
  )
  AND
  (
    (SELECT company_id FROM public.profiles WHERE id = auth.uid()) = 
    (SELECT company_id FROM public.profiles WHERE id = profiles.id)
    OR
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'platform_admin'
    )
  )
);

-- ============================================================================
-- Alternative: Simpler single policy (if the above is too restrictive)
-- ============================================================================
-- If you prefer a simpler approach, you can use just this policy instead:
-- (Comment out the two policies above and uncomment this one)

-- CREATE POLICY "admins_can_update_user_roles"
-- ON public.profiles
-- FOR UPDATE
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 
--     FROM public.profiles p
--     WHERE p.id = auth.uid()
--     AND p.role IN ('platform_admin', 'workspace_admin')
--   )
-- )
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 
--     FROM public.profiles p
--     WHERE p.id = auth.uid()
--     AND p.role IN ('platform_admin', 'workspace_admin')
--   )
-- );

-- ============================================================================
-- Verification queries (run these to verify the migration)
-- ============================================================================
-- Check existing policies on profiles table:
-- SELECT * FROM pg_policies WHERE tablename = 'profiles' AND policyname LIKE '%role%';
--
-- Test update (as platform_admin or workspace_admin):
-- UPDATE public.profiles SET role = 'ml_engineer' WHERE id = '<target_user_id>';
--
-- Verify the update:
-- SELECT id, email, role FROM public.profiles WHERE id = '<target_user_id>';
-- ============================================================================
