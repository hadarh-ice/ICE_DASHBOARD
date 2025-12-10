-- =============================================
-- ICE Analytics - Name Resolution Enhancements
-- Migration 002
-- =============================================

-- PURPOSE:
-- 1. Add low-views filtering for articles (<50 views)
-- 2. Add user confirmation tracking for employee name aliases
-- 3. Enable better name matching with user override capability

-- =============================================
-- ARTICLES TABLE: Add low-views filtering
-- =============================================

-- Add is_low_views column to track articles with insufficient views
ALTER TABLE articles
ADD COLUMN is_low_views BOOLEAN DEFAULT FALSE;

-- Add index for efficient filtering in metrics queries
CREATE INDEX idx_articles_low_views ON articles(is_low_views);

-- Add comment for documentation
COMMENT ON COLUMN articles.is_low_views IS 'TRUE if article has < 50 views (excluded from metrics calculations)';

-- =============================================
-- EMPLOYEE_ALIASES TABLE: Add user confirmation tracking
-- =============================================

-- Add confirmed_by_user to distinguish user-confirmed vs auto-matched aliases
ALTER TABLE employee_aliases
ADD COLUMN confirmed_by_user BOOLEAN DEFAULT FALSE;

-- Add confirmed_at timestamp for tracking when user confirmed the mapping
ALTER TABLE employee_aliases
ADD COLUMN confirmed_at TIMESTAMPTZ;

-- Add composite index for efficient lookup of user-confirmed aliases
-- Used to prioritize user confirmations in future matching
CREATE INDEX idx_aliases_confirmed ON employee_aliases(confirmed_by_user, employee_id);

-- Add comments for documentation
COMMENT ON COLUMN employee_aliases.confirmed_by_user IS 'TRUE if this alias mapping was explicitly confirmed by user in name resolution UI (prioritized in future uploads)';
COMMENT ON COLUMN employee_aliases.confirmed_at IS 'Timestamp when user confirmed this mapping (NULL for auto-matched aliases)';

-- =============================================
-- DATA BACKFILL
-- =============================================

-- Backfill is_low_views for existing articles
-- Articles with views < 50 are marked as low_views
UPDATE articles
SET is_low_views = (views < 50)
WHERE is_low_views = FALSE;  -- Only update records that haven't been processed

-- Note: existing employee_aliases default to confirmed_by_user = FALSE (auto-matched)
-- This is correct behavior - only NEW user confirmations will be TRUE

-- =============================================
-- VERIFICATION QUERIES (for testing after migration)
-- =============================================

-- To verify the migration worked correctly, run these queries:

-- 1. Check low-view articles count
-- SELECT COUNT(*) as low_view_count FROM articles WHERE is_low_views = TRUE;

-- 2. Check confirmed aliases (should be 0 initially)
-- SELECT COUNT(*) as confirmed_count FROM employee_aliases WHERE confirmed_by_user = TRUE;

-- 3. Verify indexes exist
-- SELECT * FROM pg_indexes WHERE tablename IN ('articles', 'employee_aliases')
--   AND indexname IN ('idx_articles_low_views', 'idx_aliases_confirmed');
