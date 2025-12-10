-- =============================================
-- ICE Analytics - Name Resolution Infrastructure
-- Migration: 20251210173454_name_resolution
-- =============================================

-- PURPOSE:
-- 1. Add validation constraints for data integrity
-- 2. Create helper functions for name normalization
-- 3. Add triggers for automatic timestamp updates
-- 4. Create views for name resolution analytics

-- =============================================
-- VALIDATION CONSTRAINTS
-- =============================================

-- Ensure hours values are realistic (0-24 hours per day)
ALTER TABLE daily_hours
ADD CONSTRAINT check_hours_valid
CHECK (hours >= 0 AND hours <= 24);

-- Ensure views cannot be negative
ALTER TABLE articles
ADD CONSTRAINT check_views_valid
CHECK (views >= 0);

-- Add comment for clarity
COMMENT ON CONSTRAINT check_hours_valid ON daily_hours IS 'Ensures hours worked per day is between 0 and 24';
COMMENT ON CONSTRAINT check_views_valid ON articles IS 'Ensures article views cannot be negative';

-- =============================================
-- NAME NORMALIZATION FUNCTION
-- =============================================

-- Function to normalize names for matching
-- Converts to lowercase, removes extra spaces, handles common variations
CREATE OR REPLACE FUNCTION normalize_name(input_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    TRIM(
      REGEXP_REPLACE(
        input_name,
        '\s+', ' ', 'g'  -- Replace multiple spaces with single space
      )
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_name IS 'Normalizes employee names for consistent matching (lowercase, trim, collapse spaces)';

-- =============================================
-- AUTOMATIC TIMESTAMP UPDATES
-- =============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to employees table
DROP TRIGGER IF EXISTS set_updated_at ON employees;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to daily_hours table
DROP TRIGGER IF EXISTS set_updated_at ON daily_hours;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON daily_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to articles table
DROP TRIGGER IF EXISTS set_updated_at ON articles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON FUNCTION update_updated_at_column IS 'Automatically updates the updated_at timestamp on row modification';

-- =============================================
-- NAME RESOLUTION ANALYTICS VIEW
-- =============================================

-- View showing name resolution statistics per employee
CREATE OR REPLACE VIEW name_resolution_stats AS
SELECT
  e.id AS employee_id,
  e.canonical_name,
  COUNT(ea.id) AS total_aliases,
  COUNT(ea.id) FILTER (WHERE ea.confirmed_by_user = TRUE) AS confirmed_aliases,
  COUNT(ea.id) FILTER (WHERE ea.confirmed_by_user = FALSE) AS auto_matched_aliases,
  COUNT(ea.id) FILTER (WHERE ea.source = 'hours') AS hours_aliases,
  COUNT(ea.id) FILTER (WHERE ea.source = 'articles') AS articles_aliases,
  MAX(ea.confirmed_at) AS last_confirmation_date
FROM employees e
LEFT JOIN employee_aliases ea ON ea.employee_id = e.id
GROUP BY e.id, e.canonical_name
ORDER BY total_aliases DESC;

COMMENT ON VIEW name_resolution_stats IS 'Analytics view showing name alias counts and confirmation status per employee';

-- =============================================
-- UNMATCHED NAMES VIEW
-- =============================================

-- View showing aliases that might need review
-- (auto-matched aliases that appear frequently but haven't been confirmed)
CREATE OR REPLACE VIEW unmatched_aliases_review AS
SELECT
  ea.id,
  ea.alias,
  ea.normalized_alias,
  ea.employee_id,
  e.canonical_name,
  ea.source,
  ea.created_at,
  ea.confirmed_by_user
FROM employee_aliases ea
JOIN employees e ON e.id = ea.employee_id
WHERE ea.confirmed_by_user = FALSE
  AND ea.normalized_alias != LOWER(e.canonical_name)  -- Not exact match
ORDER BY ea.created_at DESC;

COMMENT ON VIEW unmatched_aliases_review IS 'Shows auto-matched aliases that may need user review/confirmation';

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- To verify this migration:

-- 1. Check constraints exist:
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid IN ('daily_hours'::regclass, 'articles'::regclass)
-- AND conname LIKE 'check_%';

-- 2. Check triggers exist:
-- SELECT tgname, tgrelid::regclass, proname
-- FROM pg_trigger
-- JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
-- WHERE tgname = 'set_updated_at';

-- 3. Check views exist:
-- SELECT viewname, definition FROM pg_views
-- WHERE viewname IN ('name_resolution_stats', 'unmatched_aliases_review');

-- 4. Test normalization function:
-- SELECT normalize_name('  John  SMITH  ') AS normalized;
-- Expected: 'john smith'
