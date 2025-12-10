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
  confirmed_by_user: boolean; // TRUE if user confirmed this mapping
  confirmed_at: string | null; // When user confirmed (NULL for auto-matched)
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
  is_low_views: boolean; // TRUE if views < 50
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
  isLowViews?: boolean; // TRUE if views < 50 (excluded from metrics)
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

// ============================================================================
// ADVANCED ANALYTICS TYPES
// ============================================================================

/**
 * Time-series aggregation for hours data
 * Groups hours by month or week
 */
export interface HoursTimeSeries {
  period: string; // YYYY-MM for month, YYYY-Www for week
  total_hours: number;
  employee_count: number;
  avg_hours_per_employee: number;
}

/**
 * Time-series aggregation for articles data
 */
export interface ArticlesTimeSeries {
  period: string;
  total_articles: number;
  total_views: number;
  employee_count: number;
  avg_articles_per_employee: number;
}

/**
 * Missing data detection result
 * Identifies employees with incomplete data
 */
export interface DataGap {
  employee_id: string;
  employee_name: string;
  gap_type: 'hours_only' | 'articles_only' | 'missing_days';
  details: string;
  hours_count: number;
  articles_count: number;
  date_range?: { start: string; end: string };
}

/**
 * Anomaly detection result
 * Flags unusual patterns in hours or views data
 */
export interface Anomaly {
  employee_id: string;
  employee_name: string;
  type: 'hours_spike' | 'hours_drop' | 'views_spike' | 'missing_days' | 'outlier';
  date: string;
  value: number;
  expected_value: number;
  deviation_percent: number;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Cross-reference analysis: hours worked for each article
 */
export interface EmployeeArticleHours {
  employee_id: string;
  employee_name: string;
  article_id: number;
  article_title: string;
  published_at: string;
  views: number;
  hours_on_publish_date: number;
  hours_week_of_publish: number;
}

/**
 * Trend comparison between two periods
 */
export interface TrendComparison {
  current_period: string;
  previous_period: string;
  metric: string;
  current_value: number;
  previous_value: number;
  change_percent: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Employee ranking by various metrics
 */
export interface EmployeeRanking {
  employee_id: string;
  employee_name: string;
  rank: number;
  metric_name: 'hours' | 'articles' | 'views' | 'efficiency';
  metric_value: number;
  percentile: number;
}

/**
 * Weekly breakdown of hours
 */
export interface WeeklyBreakdown {
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  day_name: string;
  total_hours: number;
  avg_hours: number;
  employee_count: number;
}

/**
 * Query filters for analytics functions
 */
export interface QueryFilters {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  employeeIds?: string[];
}

/**
 * Period definition for trend analysis
 */
export interface Period {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/**
 * Detailed error for upload validation
 */
export interface DetailedError {
  row: number;
  field: string;
  value: string;
  message: string;
}

/**
 * Enhanced upload result with detailed tracking
 */
export interface DetailedUpsertResult extends UpsertResult {
  detailedErrors: DetailedError[];
  matchStats: {
    exactMatches: number;
    fuzzyMatches: number;
    newEmployees: number;
  };
  processingTimeMs: number;
}

// ============================================================================
// NAME RESOLUTION TYPES
// ============================================================================

/**
 * A candidate employee match with similarity score
 * Shown to user in name resolution modal for selection
 */
export interface NameCandidate {
  employee_id: string;
  canonical_name: string;
  similarity_score: number;
  is_user_confirmed: boolean; // Has this mapping been confirmed before?
  last_used_date?: string; // When was this alias last seen?
}

/**
 * A single name conflict that requires user resolution
 * Occurs when name similarity is between 0.75-0.84 (medium confidence)
 * or when no match found (low confidence)
 */
export interface NameConflict {
  inputName: string;
  normalized: string;
  candidates: NameCandidate[];
  confidence: 'low' | 'medium'; // medium = 0.75-0.84, low = <0.75
  rowNumbers: number[]; // Which rows this name appears in (for user reference)
}

/**
 * An automatically matched name (high confidence ≥0.85)
 * These names don't require manual resolution
 */
export interface AutoMatchedName {
  inputName: string;
  employee_id: string;
  matchType: 'exact' | 'fuzzy-high' | 'user-confirmed';
  similarity_score?: number;
}

/**
 * Result of name analysis phase (before upload)
 * Splits names into auto-matched vs. needs-resolution
 */
export interface NameAnalysisResult {
  autoMatched: AutoMatchedName[];
  needsResolution: NameConflict[];
  totalUniqueNames: number;
}

/**
 * User's resolution decision for a name conflict
 * Submitted from NameResolutionModal after user chooses action
 */
export interface NameResolution {
  inputName: string;
  action: 'match' | 'create-new';
  employee_id?: string; // Required if action is 'match'
  confirmed_by_user: boolean; // TRUE for manual resolutions
}

/**
 * Final name mapping after resolution
 * Map of input name → employee_id + confirmation status
 */
export interface ResolvedNameMap {
  [inputName: string]: {
    employee_id: string;
    confirmed_by_user: boolean;
  };
}

/**
 * Warning about employees with hours but no articles
 * Shown in hours upload result as informational message
 */
export interface HoursWithoutArticlesWarning {
  employee_id: string;
  employee_name: string;
  total_hours: number;
  date_range: { start: string; end: string };
}

/**
 * Enhanced upload result with additional tracking
 * Extends DetailedUpsertResult with new features
 */
export interface EnhancedUploadResult extends DetailedUpsertResult {
  // Articles-specific
  ignoredLowViewArticles?: number; // Count of articles with views < 50

  // Hours-specific
  hoursWithoutArticles?: HoursWithoutArticlesWarning[];

  // Name resolution stats
  nameResolutionStats?: {
    autoMatched: number;
    manuallyResolved: number;
    newEmployeesCreated: number;
  };
}

// ============================================================================
// DELETE DATA TYPES
// ============================================================================

/**
 * Delete data request payload
 */
export interface DeleteDataRequest {
  type: 'hours' | 'articles' | 'both';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

/**
 * Delete data operation result
 */
export interface DeleteDataResult {
  success: boolean;
  deletedHours: number;
  deletedArticles: number;
  errors: string[];
  processingTimeMs: number;
}
