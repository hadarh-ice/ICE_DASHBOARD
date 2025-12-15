-- Migration: Extend get_global_metrics RPC to support shift and sabbath filters
-- Purpose: Fix KPI mutation bug by moving ALL filtering to server-side
-- Date: 2025-12-15

-- Drop old function
DROP FUNCTION IF EXISTS get_global_metrics(TEXT, TEXT, UUID[]);

-- Create extended function with shift and sabbath filtering
CREATE OR REPLACE FUNCTION get_global_metrics(
  p_start_date TEXT,
  p_end_date TEXT,
  p_employee_ids UUID[],
  p_shift TEXT DEFAULT 'all',
  p_exclude_sabbath BOOLEAN DEFAULT false
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
    -- Existing filters
    is_low_views = false
    AND (p_start_date IS NULL OR published_at >= p_start_date::timestamp)
    AND (p_end_date IS NULL OR published_at <= (p_end_date || 'T23:59:59')::timestamp)
    AND (p_employee_ids IS NULL OR ARRAY_LENGTH(p_employee_ids, 1) IS NULL OR employee_id = ANY(p_employee_ids))
    -- Shift filter (morning: 7-15, evening: 15-23)
    AND (
      p_shift = 'all'
      OR p_shift IS NULL
      OR (p_shift = 'morning' AND EXTRACT(HOUR FROM published_at) >= 7 AND EXTRACT(HOUR FROM published_at) < 15)
      OR (p_shift = 'evening' AND EXTRACT(HOUR FROM published_at) >= 15 AND EXTRACT(HOUR FROM published_at) < 23)
    )
    -- Sabbath filter (exclude Saturday if requested)
    AND (
      p_exclude_sabbath = false
      OR EXTRACT(DOW FROM published_at) != 6  -- DOW: 0=Sunday, 6=Saturday
    );
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_global_metrics IS 'Calculates total articles and views with support for shift (morning/evening) and sabbath filtering. Uses server-side aggregation to avoid 1,000 row limit and prevent KPI mutation bugs.';
