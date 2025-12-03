-- =============================================
-- ICE Analytics Database Schema
-- =============================================

-- EMPLOYEES TABLE
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  employee_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_canonical ON employees(canonical_name);

-- EMPLOYEE ALIASES TABLE
CREATE TABLE employee_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('hours', 'articles')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(normalized_alias)
);

CREATE INDEX idx_aliases_normalized ON employee_aliases(normalized_alias);
CREATE INDEX idx_aliases_employee ON employee_aliases(employee_id);

-- DAILY HOURS TABLE
CREATE TABLE daily_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  status TEXT,
  entry_time TIME,
  exit_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

CREATE INDEX idx_daily_hours_employee ON daily_hours(employee_id);
CREATE INDEX idx_daily_hours_date ON daily_hours(date);
CREATE INDEX idx_daily_hours_emp_date ON daily_hours(employee_id, date);

-- ARTICLES TABLE
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id INTEGER UNIQUE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_articles_employee ON articles(employee_id);
CREATE INDEX idx_articles_published ON articles(published_at);
CREATE INDEX idx_articles_views ON articles(views DESC);

-- IMPORT LOGS TABLE
CREATE TABLE import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_type TEXT NOT NULL CHECK (file_type IN ('hours', 'articles')),
  file_name TEXT,
  file_size_bytes INTEGER,
  rows_processed INTEGER DEFAULT 0,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROW LEVEL SECURITY
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Allow authenticated access" ON employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON employee_aliases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON daily_hours
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON articles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access" ON import_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
