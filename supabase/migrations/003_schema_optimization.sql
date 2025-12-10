-- =============================================
-- ICE Analytics - Schema Optimization
-- Migration 003
-- =============================================

-- PURPOSE:
-- 1. Remove redundant indexes that duplicate unique constraints
-- 2. Add missing indexes for common query patterns
-- 3. Create partial indexes for efficient filtered queries
-- 4. Optimize storage and improve write performance

-- =============================================
-- REMOVE REDUNDANT INDEXES
-- =============================================

-- These indexes duplicate the automatic indexes created by UNIQUE constraints
-- Removing them saves storage and improves write performance

-- Drop idx_employees_canonical (duplicates employees_canonical_name_key)
DROP INDEX IF EXISTS idx_employees_canonical;
-- Savings: Eliminates duplicate index on employees.canonical_name

-- Drop idx_aliases_normalized (duplicates employee_aliases_normalized_alias_key)
DROP INDEX IF EXISTS idx_aliases_normalized;
-- Savings: Eliminates duplicate index on employee_aliases.normalized_alias

-- Drop idx_daily_hours_emp_date (duplicates daily_hours_employee_id_date_key)
DROP INDEX IF EXISTS idx_daily_hours_emp_date;
-- Savings: Eliminates duplicate composite index on daily_hours(employee_id, date)

-- Drop idx_daily_hours_employee (covered by composite unique index)
DROP INDEX IF EXISTS idx_daily_hours_employee;
-- Savings: employee_id searches are covered by the composite unique index

-- =============================================
-- ADD PERFORMANCE INDEXES
-- =============================================

-- Index for import logs chronological queries
-- Used when displaying upload history sorted by date
CREATE INDEX IF NOT EXISTS idx_import_logs_created
ON import_logs(created_at DESC);

COMMENT ON INDEX idx_import_logs_created IS 'Optimizes chronological queries on import history';

-- Index for filtering import logs by file type
-- Used when viewing only hours or only articles uploads
CREATE INDEX IF NOT EXISTS idx_import_logs_type
ON import_logs(file_type);

COMMENT ON INDEX idx_import_logs_type IS 'Optimizes filtering uploads by type (hours/articles)';

-- Composite index for employee article timelines
-- Used when viewing articles by employee sorted by date
CREATE INDEX IF NOT EXISTS idx_articles_employee_published
ON articles(employee_id, published_at DESC)
WHERE employee_id IS NOT NULL;

COMMENT ON INDEX idx_articles_employee_published IS 'Optimizes employee article timeline queries';

-- =============================================
-- PARTIAL INDEXES FOR FILTERED QUERIES
-- =============================================

-- Partial index for high-view articles only
-- Used in metrics calculations that exclude low-view articles
CREATE INDEX IF NOT EXISTS idx_high_view_articles
ON articles(views DESC)
WHERE is_low_views = FALSE;

COMMENT ON INDEX idx_high_view_articles IS 'Optimizes metrics queries that filter out low-view articles (<50 views)';

-- Partial index for user-confirmed aliases
-- Used to prioritize confirmed mappings during name matching
CREATE INDEX IF NOT EXISTS idx_confirmed_aliases_only
ON employee_aliases(normalized_alias, employee_id)
WHERE confirmed_by_user = TRUE;

COMMENT ON INDEX idx_confirmed_aliases_only IS 'Optimizes lookup of user-confirmed name mappings during upload';

-- =============================================
-- STATISTICS UPDATE
-- =============================================

-- Update table statistics to help query planner make better decisions
-- This ensures the new indexes are used effectively
ANALYZE employees;
ANALYZE employee_aliases;
ANALYZE daily_hours;
ANALYZE articles;
ANALYZE import_logs;

-- =============================================
-- OPTIMIZATION SUMMARY
-- =============================================

-- Indexes REMOVED (4):
--   1. idx_employees_canonical (redundant)
--   2. idx_aliases_normalized (redundant)
--   3. idx_daily_hours_emp_date (redundant)
--   4. idx_daily_hours_employee (redundant)

-- Indexes ADDED (5):
--   1. idx_import_logs_created (chronological queries)
--   2. idx_import_logs_type (type filtering)
--   3. idx_articles_employee_published (employee timelines)
--   4. idx_high_view_articles (metrics with low-view filter)
--   5. idx_confirmed_aliases_only (prioritize confirmed matches)

-- Net change: +1 index, but better targeted for actual query patterns
-- Expected impact: Faster writes, faster filtered queries, reduced storage

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- To verify this migration:

-- 1. Check removed indexes are gone:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('employees', 'employee_aliases', 'daily_hours')
-- AND indexname IN ('idx_employees_canonical', 'idx_aliases_normalized',
--                   'idx_daily_hours_emp_date', 'idx_daily_hours_employee');
-- Expected: 0 rows

-- 2. Check new indexes exist:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE indexname IN ('idx_import_logs_created', 'idx_import_logs_type',
--                     'idx_articles_employee_published', 'idx_high_view_articles',
--                     'idx_confirmed_aliases_only');
-- Expected: 5 rows

-- 3. Check index sizes:
-- SELECT schemaname, tablename, indexname,
--        pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexname::regclass) DESC;

-- 4. Test query plans use new indexes:
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM articles
-- WHERE employee_id = '...' AND is_low_views = FALSE
-- ORDER BY views DESC LIMIT 10;
-- Expected: Should use idx_high_view_articles or idx_articles_employee_published
