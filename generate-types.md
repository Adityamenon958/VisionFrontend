# How to Generate TypeScript Types for Supabase

## Method 1: Using Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Navigate to: **Settings** → **API**
4. Look for "TypeScript" or "Generate types" section
5. Copy the generated types

**Alternative locations to check:**
- Settings → API → Scroll down to find "TypeScript types"
- Database → Tables → Click on any table → Look for "Generate types" option
- Project Settings → API → Code Generation

## Method 2: Using Supabase CLI (if you have access)

```bash
# Generate types from remote project
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts

# Or if linked locally
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

## Method 3: Manual SQL Query + Type Generation

1. Go to SQL Editor in Supabase Dashboard
2. Run this query to see your current schema:

```sql
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

3. Manually verify the `companies` table has `admin_email` column

## Method 4: Use Supabase Studio (if available)

Some Supabase projects have a "Studio" section where you can:
1. Go to Database → Tables
2. Right-click on `companies` table
3. Look for "Generate types" or "Export schema" option

## Method 5: Check if types are already correct

The types file might already be correct. Check:
- Open `src/integrations/supabase/types.ts`
- Look for `companies` table definition
- Verify it has `admin_email: string` in the Insert type

If it's already there, the issue might be:
- Database column doesn't exist (need to add it)
- Schema cache needs refresh (restart dev server)

