-- Fix RLS policy for companies INSERT
-- The issue: The policy requires auth.uid() = created_by, but this should work
-- However, we need to ensure the policy is correctly applied
-- The created_by field references profiles(id), so the user must have a profile

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;

-- Create new INSERT policy that allows authenticated users to create companies
-- The created_by field must match the authenticated user's ID
CREATE POLICY "Users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = created_by);

