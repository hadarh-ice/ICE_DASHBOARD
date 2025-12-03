// Database types
export interface Employee {
  id: string;
  canonical_name: string;
  first_name: string;
  last_name: string;
  employee_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAlias {
  id: string;
  employee_id: string;
  alias: string;
  normalized_alias: string;
  source: 'hours' | 'articles';
  created_at: string;
}

export interface DailyHours {
  id: string;
  employee_id: string;
  date: string;
  hours: number;
  status: string | null;
  entry_time: string | null;
  exit_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  article_id: number;
  employee_id: string | null;
  title: string;
  views: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface ImportLog {
  id: string;
  file_type: 'hours' | 'articles';
  file_name: string | null;
  file_size_bytes: number | null;
  rows_processed: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  errors: unknown[];
  uploaded_by: string | null;
  created_at: string;
}

// Parsed data types
export interface ParsedHoursRow {
  firstName: string;
  lastName: string;
  fullName: string;
  date: string; // YYYY-MM-DD
  hours: number;
  status?: string;
  entryTime?: string;
  exitTime?: string;
  employeeNumber?: string;
}

export interface ParsedArticleRow {
  articleId: number;
  fullName: string;
  title: string;
  views: number;
  publishedAt: string; // ISO date string
}

// Metrics types
export interface EmployeeMetrics {
  employee_id: string;
  employee_name: string;
  total_articles: number;
  total_views: number;
  total_hours: number;
  avg_views_per_article: number | null;
  rate_articles_per_hour: number | null;
  efficiency_views_per_hour: number | null;
}

export interface GlobalMetrics {
  total_articles: number;
  total_views: number;
  total_hours: number;
  avg_rate: number | null;
  avg_efficiency: number | null;
}

export interface TopArticle {
  article_id: number;
  title: string;
  views: number;
  published_at: string;
  employee_name: string;
}

// Filter types
export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface FilterState {
  dateRange: DateRange;
  selectedEmployees: string[];
  setDateRange: (range: DateRange) => void;
  setSelectedEmployees: (employees: string[]) => void;
  clearFilters: () => void;
}

// Upload result types
export interface UpsertResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface UploadProgress {
  stage: 'parsing' | 'matching' | 'uploading' | 'complete' | 'error';
  progress: number;
  message: string;
}
