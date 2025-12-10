-- =============================================
-- ICE Analytics - Fix Normalized Name Column
-- Migration 004
-- =============================================

-- PURPOSE:
-- Fix normalized_name column that exists but is not properly configured
-- - Backfill NULL values
-- - Add NOT NULL constraint
-- - Add unique index
--
-- BUSINESS LOGIC:
-- - canonical_name: Display name with original capitalization (e.g., "David Cohen")
-- - normalized_name: Matching name in lowercase (e.g., "david cohen")
-- - Both are stored to preserve display quality while ensuring match consistency

-- =============================================
-- FIX NORMALIZED_NAME COLUMN
-- =============================================

-- Step 1: Add column if it doesn't exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'normalized_name'
  ) THEN
    ALTER TABLE employees ADD COLUMN normalized_name TEXT;
  END IF;
END $$;

-- Step 2: Backfill any NULL values using normalize_name() function
-- (This function was created in migration 20251210173454_name_resolution)
UPDATE employees
SET normalized_name = normalize_name(canonical_name)
WHERE normalized_name IS NULL;

-- Step 3: Make it NOT NULL now that all rows have values
ALTER TABLE employees
ALTER COLUMN normalized_name SET NOT NULL;

-- Step 4: Create unique index to prevent duplicate normalized names
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_normalized_name
ON employees(normalized_name);

-- Step 5: Add documentation comments
COMMENT ON COLUMN employees.normalized_name IS 'Normalized version of canonical_name for consistent matching (lowercase, trimmed, collapsed spaces). Used in employee matching algorithms.';
COMMENT ON INDEX idx_employees_normalized_name IS 'Ensures no duplicate employees with same normalized name. Used for efficient employee lookups during upload.';

-- =============================================
-- UPDATE RLS POLICIES (if needed)
-- =============================================

-- No changes needed - existing policies cover all columns

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- To verify this migration:

-- 1. Check column exists and is NOT NULL:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'employees' AND column_name = 'normalized_name';

-- 2. Check unique index exists:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'employees' AND indexname = 'idx_employees_normalized_name';

-- 3. Verify normalized values look correct:
-- SELECT canonical_name, normalized_name FROM employees LIMIT 10;

-- 4. Test that duplicate normalized names are prevented:
-- INSERT INTO employees (canonical_name, first_name, last_name, normalized_name)
-- VALUES ('Test User', 'Test', 'User', 'existing_normalized_name');
-- Expected: Should fail with unique constraint violation
