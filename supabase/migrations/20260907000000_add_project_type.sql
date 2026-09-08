-- Add project_type column so a project can be flagged as belonging to an
-- exclusive workflow (e.g. Corrosion) instead of the generic vision
-- pipeline. Existing projects default to 'generic', so this is backward
-- compatible with every project created before this migration.

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'generic';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_project_type_check'
  ) THEN
    ALTER TABLE public.projects
    ADD CONSTRAINT projects_project_type_check CHECK (project_type IN ('generic', 'corrosion'));
  END IF;
END $$;

COMMENT ON COLUMN public.projects.project_type IS 'generic = standard vision project; corrosion = ship-corrosion inspection project with its own exclusive dashboard. Extend the CHECK constraint here when adding future exclusive project types.';
