-- Prevent updating admin_email field - only the creator should be admin
-- This ensures there can only be one admin per company (the creator)

-- Create a trigger function to prevent admin_email updates
CREATE OR REPLACE FUNCTION prevent_admin_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If admin_email is being changed, prevent it
  IF OLD.admin_email IS DISTINCT FROM NEW.admin_email THEN
    RAISE EXCEPTION 'admin_email cannot be changed. Only the company creator can be the admin.';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to enforce admin_email immutability
DROP TRIGGER IF EXISTS prevent_admin_email_update ON public.companies;
CREATE TRIGGER prevent_admin_email_update
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION prevent_admin_email_change();

