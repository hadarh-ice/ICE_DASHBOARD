-- Migration: Pre-seed known employee name aliases
-- Purpose: Handle known spelling variations between hours and articles files
--
-- Issue: Different systems use different spellings for the same employees:
--   Hours file: "אפרת באבא גני" → Articles file: "אפרת בבג'ני"
--   Hours file: "דורה גונסון" → Articles file: "דורה ג'ונסון"
--
-- This migration ensures these variations are automatically matched.

-- Create a function to safely add alias if employee exists
CREATE OR REPLACE FUNCTION add_alias_if_employee_exists(
  p_employee_canonical_name TEXT,
  p_alias TEXT,
  p_source TEXT DEFAULT 'hours'
) RETURNS void AS $$
DECLARE
  v_employee_id UUID;
  v_normalized_alias TEXT;
BEGIN
  -- Find employee by canonical name
  SELECT id INTO v_employee_id
  FROM employees
  WHERE canonical_name = p_employee_canonical_name;

  -- Calculate normalized alias using the same logic as the app
  -- (lowercase, remove apostrophes, normalize Hebrew final letters)
  v_normalized_alias := lower(p_alias);
  -- Remove various quote/apostrophe characters
  v_normalized_alias := regexp_replace(v_normalized_alias, '[''"`׳״־ֿ]', '', 'g');
  -- Normalize Hebrew final letters (sofit)
  v_normalized_alias := replace(v_normalized_alias, 'ם', 'מ');
  v_normalized_alias := replace(v_normalized_alias, 'ן', 'נ');
  v_normalized_alias := replace(v_normalized_alias, 'ץ', 'צ');
  v_normalized_alias := replace(v_normalized_alias, 'ך', 'כ');
  v_normalized_alias := replace(v_normalized_alias, 'ף', 'פ');
  -- Normalize whitespace
  v_normalized_alias := regexp_replace(v_normalized_alias, '\s+', ' ', 'g');
  v_normalized_alias := trim(v_normalized_alias);

  -- Only insert if employee exists
  IF v_employee_id IS NOT NULL THEN
    INSERT INTO employee_aliases (
      employee_id,
      alias,
      normalized_alias,
      source,
      confirmed_by_user,
      confirmed_at
    )
    VALUES (
      v_employee_id,
      p_alias,
      v_normalized_alias,
      p_source,
      true,  -- Mark as confirmed since we know these are correct
      NOW()
    )
    ON CONFLICT (normalized_alias) DO NOTHING;

    RAISE NOTICE 'Added alias "%" for employee "%"', p_alias, p_employee_canonical_name;
  ELSE
    RAISE NOTICE 'Employee "%" not found, skipping alias "%"', p_employee_canonical_name, p_alias;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Known aliases to seed:
-- These are known variations discovered from comparing hours and articles files

-- 1. אפרת בבג'ני / אפרת באבא גני
-- The canonical name in the system may be either one, so we try both
SELECT add_alias_if_employee_exists('אפרת בבג''ני', 'אפרת באבא גני', 'hours');
SELECT add_alias_if_employee_exists('אפרת באבא גני', 'אפרת בבג''ני', 'articles');

-- 2. דורה ג'ונסון / דורה גונסון
SELECT add_alias_if_employee_exists('דורה ג''ונסון', 'דורה גונסון', 'hours');
SELECT add_alias_if_employee_exists('דורה גונסון', 'דורה ג''ונסון', 'articles');

-- Note: Add more known aliases here as they are discovered
-- Format: SELECT add_alias_if_employee_exists('canonical_name', 'alias_name', 'source');

-- Clean up: Remove the function after use (optional - keeps schema clean)
-- DROP FUNCTION IF EXISTS add_alias_if_employee_exists(TEXT, TEXT, TEXT);
