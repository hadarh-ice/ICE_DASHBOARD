-- Migration: Add RPC function for server-side global metrics aggregation
-- Purpose: Fix KPI underreporting bug caused by Supabase 1,000 row limit
-- Date: 2025-12-14

-- Drop function if exists (for idempotency)
DROP FUNCTION IF EXISTS get_global_metrics(TEXT, TEXT, UUID[]);

-- Create function to calculate global metrics server-side
CREATE OR REPLACE FUNCTION get_global_metrics(
  p_start_date TEXT,
  p_end_date TEXT,
  p_employee_ids UUID[]
)
RETURNS TABLE(
  total_articles BIGINT,
  total_views BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_articles,
    COALESCE(SUM(views), 0)::BIGINT AS total_views
  FROM articles
  WHERE
    is_low_views = false
    AND (p_start_date IS NULL OR published_at >= p_start_date::timestamp)
    AND (p_end_date IS NULL OR published_at <= (p_end_date || 'T23:59:59')::timestamp)
    AND (p_employee_ids IS NULL OR ARRAY_LENGTH(p_employee_ids, 1) IS NULL OR employee_id = ANY(p_employee_ids));
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_global_metrics IS 'Calculates total articles and views for filtered date range and employees. Fixes KPI underreporting by using server-side aggregation instead of client-side SUM of limited rows.';
