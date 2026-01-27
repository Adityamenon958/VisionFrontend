-- ============================================================================
-- Add RBAC-based RLS Policies for Datasets and Dataset Files
-- ============================================================================
-- This migration adds Row Level Security policies to enforce RBAC permissions
-- at the database level for dataset operations.
--
-- Key Changes:
-- 1. Dataset deletion restricted to platform_admin and workspace_admin
-- 2. Dataset file access restricted for Viewer role (cannot view raw images)
-- 3. Helper function to check user roles for RLS policies
--
-- Note: Inference and training operations are handled by the backend API,
-- not Supabase, so those permissions are enforced at the API level.

-- ============================================================================
-- Step 1: Create helper function to check if user has a specific role
-- ============================================================================
-- This function is used in RLS policies to check user roles
-- Uses SECURITY DEFINER to bypass RLS when checking roles (avoids recursion)

CREATE OR REPLACE FUNCTION public.check_user_role(target_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user has the target role
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = target_role
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_user_role(TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.check_user_role(TEXT) IS 
  'Checks if the current authenticated user has the specified role. Uses SECURITY DEFINER to avoid RLS recursion.';

-- ============================================================================
-- Step 2: Create helper function to check if user is admin (platform or workspace)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_user_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('platform_admin', 'workspace_admin')
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_user_is_admin() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.check_user_is_admin() IS 
  'Checks if the current authenticated user is a platform_admin or workspace_admin. Uses SECURITY DEFINER to avoid RLS recursion.';

-- ============================================================================
-- Step 3: Create helper function to check if user can view raw dataset images
-- ============================================================================
-- Viewer role cannot view raw images, all other roles can

CREATE OR REPLACE FUNCTION public.check_user_can_view_raw_images()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is NOT a viewer (all other roles can view)
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role != 'viewer'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_user_can_view_raw_images() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.check_user_can_view_raw_images() IS 
  'Checks if the current authenticated user can view raw dataset images. Viewer role cannot view raw images. Uses SECURITY DEFINER to avoid RLS recursion.';

-- ============================================================================
-- Step 4: Drop existing DELETE policy on datasets (if exists)
-- ============================================================================
-- We'll create a new one with RBAC restrictions

DROP POLICY IF EXISTS "Users can delete datasets in their company" ON public.datasets;
DROP POLICY IF EXISTS "Admins can delete datasets" ON public.datasets;

-- ============================================================================
-- Step 5: Create RBAC-based DELETE policy for datasets
-- ============================================================================
-- Only platform_admin and workspace_admin can delete datasets
-- Workspace admins can only delete datasets in their company
-- Platform admins can delete datasets in any company

CREATE POLICY "only_admins_can_delete_datasets"
ON public.datasets
FOR DELETE
TO authenticated
USING (
  -- Check if user is an admin
  public.check_user_is_admin()
  AND
  (
    -- Platform admin can delete any dataset
    public.check_user_role('platform_admin')
    OR
    -- Workspace admin can only delete datasets in their company
    (
      public.check_user_role('workspace_admin')
      AND
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.company_id = datasets.company_id
      )
    )
  )
);

-- ============================================================================
-- Step 6: Update dataset_files SELECT policy to restrict Viewer role
-- ============================================================================
-- Drop existing policies on dataset_files if they exist
DROP POLICY IF EXISTS "Users can view dataset files in their company" ON public.dataset_files;
DROP POLICY IF EXISTS "Users can view dataset files" ON public.dataset_files;

-- Create new policy that restricts Viewer role from accessing raw images
CREATE POLICY "users_can_view_dataset_files_with_rbac"
ON public.dataset_files
FOR SELECT
TO authenticated
USING (
  -- User must be in the same company as the dataset
  EXISTS (
    SELECT 1
    FROM public.datasets d
    INNER JOIN public.profiles p ON p.company_id = d.company_id
    WHERE d.id = dataset_files.dataset_id
      AND p.id = auth.uid()
  )
  AND
  -- Viewer role cannot view raw images (all other roles can)
  public.check_user_can_view_raw_images()
);

-- ============================================================================
-- Step 7: Update dataset INSERT policy to ensure company membership check
-- ============================================================================
-- The existing INSERT policy only checks created_by = auth.uid()
-- We need to also ensure the user is in the same company
-- This allows platform_admin, workspace_admin, and ml_engineer to upload
-- (as long as they're in the company)

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can create datasets" ON public.datasets;

-- Create new INSERT policy with company membership check
CREATE POLICY "users_can_create_datasets_in_company"
ON public.datasets
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be the creator
  auth.uid() = created_by
  AND
  -- User must be in the same company (or platform_admin can create in any company)
  (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = datasets.company_id
    )
    OR
    -- Platform admin can create datasets in any company
    public.check_user_role('platform_admin')
  )
);

-- ============================================================================
-- Step 8: Update storage bucket policies for dataset files (if applicable)
-- ============================================================================
-- Note: Storage bucket policies are separate from table RLS policies
-- If you have a storage bucket for datasets, you may want to add similar restrictions
-- This is commented out as storage policies may be managed differently

-- Example storage policy (uncomment and adjust if needed):
-- DROP POLICY IF EXISTS "Users can view their company's datasets" ON storage.objects;
-- 
-- CREATE POLICY "users_can_view_dataset_files_with_rbac_storage"
-- ON storage.objects
-- FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'datasets'
--   AND
--   -- Check company membership via path structure (adjust based on your path format)
--   (storage.foldername(name))[1] IN (
--     SELECT company_id::TEXT
--     FROM public.profiles
--     WHERE id = auth.uid()
--   )
--   AND
--   -- Viewer role cannot access raw images
--   public.check_user_can_view_raw_images()
-- );

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these queries to verify the migration:

-- 1. Check that helper functions exist:
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
--   AND routine_name IN ('check_user_role', 'check_user_is_admin', 'check_user_can_view_raw_images');

-- 2. Check dataset DELETE policy:
-- SELECT * FROM pg_policies 
-- WHERE tablename = 'datasets' 
--   AND policyname = 'only_admins_can_delete_datasets';

-- 3. Check dataset_files SELECT policy:
-- SELECT * FROM pg_policies 
-- WHERE tablename = 'dataset_files' 
--   AND policyname = 'users_can_view_dataset_files_with_rbac';

-- 4. Test as different roles:
-- -- As platform_admin (should be able to delete any dataset):
-- DELETE FROM public.datasets WHERE id = '<test_dataset_id>';
--
-- -- As workspace_admin (should only delete in their company):
-- DELETE FROM public.datasets WHERE id = '<test_dataset_id>';
--
-- -- As ml_engineer (should NOT be able to delete):
-- DELETE FROM public.datasets WHERE id = '<test_dataset_id>';
-- -- Expected: Error or no rows affected
--
-- -- As viewer (should NOT be able to view dataset_files):
-- SELECT * FROM public.dataset_files WHERE dataset_id = '<test_dataset_id>';
-- -- Expected: No rows returned (or error)

-- ============================================================================
-- Notes
-- ============================================================================
-- 1. Inference and training operations are handled by the backend API,
--    not Supabase, so those permissions are enforced at the API level.
--
-- 2. The RLS policies here enforce:
--    - Dataset deletion: Only admins can delete
--    - Dataset file access: Viewer role cannot view raw images
--
-- 3. Upload permissions are typically handled by company membership,
--    which is already enforced by existing INSERT policies.
--
-- 4. These policies work in conjunction with:
--    - Frontend UI permission checks (Phase 1)
--    - Backend API permission checks (Phase 2)
--    - Database RLS policies (Phase 3 - this migration)
--
-- 5. All three layers (frontend, backend, database) should enforce the same
--    permissions for defense in depth.
