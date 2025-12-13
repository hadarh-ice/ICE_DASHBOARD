-- Migration: Merge duplicate employee records for Efrat and Dora
-- This migration consolidates:
-- 1. "אפרת באבא גני" → "אפרת בבג'ני" (keep 9e0c1ce7-754e-4cc5-b224-acb7ba3d7f6b)
-- 2. "דורה גונסון" → "דורה ג'ונסון" (keep d4bffe15-5b0c-49da-b765-917578166320)

BEGIN;

-- ====================
-- EFRAT UNIFICATION
-- ====================

-- Update daily_hours FK: Transfer 235 hours records from old Efrat to kept Efrat
UPDATE daily_hours
SET employee_id = '9e0c1ce7-754e-4cc5-b224-acb7ba3d7f6b'
WHERE employee_id = '6b97169a-d5bb-4d74-8162-9c010154e5d7';

-- Update employee_aliases FK: Transfer existing aliases from old Efrat to kept Efrat
UPDATE employee_aliases
SET employee_id = '9e0c1ce7-754e-4cc5-b224-acb7ba3d7f6b'
WHERE employee_id = '6b97169a-d5bb-4d74-8162-9c010154e5d7';

-- Create alias entry for the old Efrat name (if not already exists)
INSERT INTO employee_aliases (employee_id, alias, normalized_alias, source)
VALUES (
  '9e0c1ce7-754e-4cc5-b224-acb7ba3d7f6b',
  'אפרת באבא גני',
  'אפרת באבא גני',
  'hours'
)
ON CONFLICT (normalized_alias) DO NOTHING;

-- Delete the duplicate Efrat employee record
DELETE FROM employees WHERE id = '6b97169a-d5bb-4d74-8162-9c010154e5d7';

-- ====================
-- DORA UNIFICATION
-- ====================

-- Update daily_hours FK: Transfer 4 hours records from old Dora to kept Dora
UPDATE daily_hours
SET employee_id = 'd4bffe15-5b0c-49da-b765-917578166320'
WHERE employee_id = 'c99f47dc-ab76-4b30-9884-8939cde166ef';

-- Update articles FK: Transfer 32 article records from old Dora to kept Dora
UPDATE articles
SET employee_id = 'd4bffe15-5b0c-49da-b765-917578166320'
WHERE employee_id = 'c99f47dc-ab76-4b30-9884-8939cde166ef';

-- Update employee_aliases FK: Transfer existing aliases from old Dora to kept Dora
UPDATE employee_aliases
SET employee_id = 'd4bffe15-5b0c-49da-b765-917578166320'
WHERE employee_id = 'c99f47dc-ab76-4b30-9884-8939cde166ef';

-- Create alias entry for the old Dora name (if not already exists)
INSERT INTO employee_aliases (employee_id, alias, normalized_alias, source)
VALUES (
  'd4bffe15-5b0c-49da-b765-917578166320',
  'דורה גונסון',
  'דורה גונסון',
  'hours'
)
ON CONFLICT (normalized_alias) DO NOTHING;

-- Delete the duplicate Dora employee record
DELETE FROM employees WHERE id = 'c99f47dc-ab76-4b30-9884-8939cde166ef';

COMMIT;
