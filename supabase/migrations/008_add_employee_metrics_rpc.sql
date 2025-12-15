-- Migration: Add RPC function for per-employee metrics aggregation
-- Purpose: Fix KPI mutation bug in employee ranking table by moving aggregation to server-side
-- Date: 2025-12-15

-- Create function to calculate per-employee metrics server-side
CREATE OR REPLACE FUNCTION get_employee_metrics(
  p_start_date TEXT,
  p_end_date TEXT,
  p_employee_ids UUID[],
  p_shift TEXT DEFAULT 'all',
  p_exclude_sabbath BOOLEAN DEFAULT false
)
RETURNS TABLE(
  employee_id UUID,
  total_articles BIGINT,
  total_views BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.employee_id,
    COUNT(*)::BIGINT AS total_articles,
    COALESCE(SUM(a.views), 0)::BIGINT AS total_views
  FROM articles a
  WHERE
    -- Existing filters
    a.is_low_views = false
    AND (p_start_date IS NULL OR a.published_at >= p_start_date::timestamp)
    AND (p_end_date IS NULL OR a.published_at <= (p_end_date || 'T23:59:59')::timestamp)
    AND (p_employee_ids IS NULL OR ARRAY_LENGTH(p_employee_ids, 1) IS NULL OR a.employee_id = ANY(p_employee_ids))
    -- Shift filter (morning: 7-15, evening: 15-23)
    AND (
      p_shift = 'all'
      OR p_shift IS NULL
      OR (p_shift = 'morning' AND EXTRACT(HOUR FROM a.published_at) >= 7 AND EXTRACT(HOUR FROM a.published_at) < 15)
      OR (p_shift = 'evening' AND EXTRACT(HOUR FROM a.published_at) >= 15 AND EXTRACT(HOUR FROM a.published_at) < 23)
    )
    -- Sabbath filter (exclude Saturday if requested)
    AND (
      p_exclude_sabbath = false
      OR EXTRACT(DOW FROM a.published_at) != 6  -- DOW: 0=Sunday, 6=Saturday
    )
  GROUP BY a.employee_id;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_employee_metrics IS 'Calculates per-employee article and view totals with support for shift (morning/evening) and sabbath filtering. Uses server-side aggregation to avoid 1,000 row limit and prevent KPI mutation bugs in employee ranking table.';
