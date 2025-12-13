import { createClient } from '@/lib/supabase/client';
import {
  EmployeeMetrics,
  GlobalMetrics,
  TopArticle,
  QueryFilters,
  HoursTimeSeries,
  ArticlesTimeSeries,
  DataGap,
  Anomaly,
  EmployeeArticleHours,
  TrendComparison,
  EmployeeRanking,
  WeeklyBreakdown,
  Period,
  TimeResolution,
  EmployeeTrendPoint,
  DashboardKPIs,
  EmployeeEfficiency,
  EmployeeTrends,
} from '@/types';
import { safeDivide } from '@/lib/utils/numbers';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Filter articles by shift (client-side)
 * Morning: 07:00-15:00, Evening: 15:00-23:00
 * @param articles Array of articles with published_at field
 * @param shift Shift filter ('all' | 'morning' | 'evening')
 * @returns Filtered articles array
 */
function filterByShift(articles: any[], shift?: 'all' | 'morning' | 'evening'): any[] {
  if (!shift || shift === 'all') return articles;

  return articles.filter(article => {
    const hour = new Date(article.published_at).getHours();
    if (shift === 'morning') return hour >= 7 && hour < 15;
    if (shift === 'evening') return hour >= 15 && hour < 23;
    return true;
  });
}

/**
 * Check if a date is Saturday (Sabbath)
 * @param date Date object or ISO date string
 * @returns True if date is Saturday
 */
function isSabbath(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getDay() === 6; // Saturday = 6
}

/**
 * Filter out Sabbath dates if excludeSabbath is true
 * @param items Array of items with date or published_at field
 * @param excludeSabbath Whether to exclude Sabbath
 * @returns Filtered array
 */
function filterSabbath<T extends { date?: string; published_at?: string }>(
  items: T[],
  excludeSabbath: boolean
): T[] {
  if (!excludeSabbath) return items;

  return items.filter(item => {
    const dateStr = item.date || item.published_at;
    return dateStr ? !isSabbath(dateStr) : true;
  });
}

/**
 * Get bucket string for a date based on resolution
 * @param date Date object
 * @param resolution Time resolution (daily/weekly/monthly/yearly)
 * @returns Bucket string (e.g., "2024-01", "2024-W01", "2024-01-15")
 */
function getBucket(date: Date, resolution: TimeResolution): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (resolution) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly':
      return getWeekBucket(date);
    case 'monthly':
      return `${year}-${month}`;
    case 'yearly':
      return `${year}`;
  }
}

/**
 * Get ISO week bucket (YYYY-Wnn format)
 * @param date Date object
 * @returns Week bucket string (e.g., "2024-W01")
 */
function getWeekBucket(date: Date): string {
  const year = date.getFullYear();
  const weekNum = getISOWeekNumber(date);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Get ISO week number (1-53)
 * @param date Date object
 * @returns Week number
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ============================================================================
// EXISTING METRICS FUNCTIONS
// ============================================================================

/**
 * Get global metrics for the dashboard
 */
export async function getGlobalMetrics(filters: QueryFilters): Promise<GlobalMetrics> {
  const supabase = createClient();

  // Build articles count query (exclude low-view articles)
  let articlesCountQuery = supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('is_low_views', false);

  // Build articles views query (exclude low-view articles)
  let articlesViewsQuery = supabase
    .from('articles')
    .select('views')
    .eq('is_low_views', false);

  if (filters.startDate) {
    articlesCountQuery = articlesCountQuery.gte('published_at', filters.startDate);
    articlesViewsQuery = articlesViewsQuery.gte('published_at', filters.startDate);
  }
  if (filters.endDate) {
    articlesCountQuery = articlesCountQuery.lte('published_at', filters.endDate + 'T23:59:59');
    articlesViewsQuery = articlesViewsQuery.lte('published_at', filters.endDate + 'T23:59:59');
  }
  if (filters.employeeIds && filters.employeeIds.length > 0) {
    articlesCountQuery = articlesCountQuery.in('employee_id', filters.employeeIds);
    articlesViewsQuery = articlesViewsQuery.in('employee_id', filters.employeeIds);
  }

  const { count: totalArticles } = await articlesCountQuery;
  const { data: articleViews } = await articlesViewsQuery.limit(100000);

  // Build hours query
  let hoursQuery = supabase
    .from('daily_hours')
    .select('hours, employee_id')
    .limit(100000);

  if (filters.startDate) {
    hoursQuery = hoursQuery.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    hoursQuery = hoursQuery.lte('date', filters.endDate);
  }
  if (filters.employeeIds && filters.employeeIds.length > 0) {
    hoursQuery = hoursQuery.in('employee_id', filters.employeeIds);
  }

  const { data: hours } = await hoursQuery;

  const totalViews = articleViews?.reduce((sum, a) => sum + (a.views || 0), 0) || 0;
  const totalHours = hours?.reduce((sum, h) => sum + (Number(h.hours) || 0), 0) || 0;

  return {
    total_articles: totalArticles || 0,
    total_views: totalViews,
    total_hours: totalHours,
    avg_rate: safeDivide(totalArticles || 0, totalHours),
    avg_efficiency: safeDivide(totalViews, totalHours),
  };
}

/**
 * Get metrics per employee for the rankings table
 */
export async function getEmployeeMetrics(filters: QueryFilters): Promise<EmployeeMetrics[]> {
  const supabase = createClient();

  // Get employees
  let employeesQuery = supabase
    .from('employees')
    .select('id, canonical_name');

  if (filters.employeeIds && filters.employeeIds.length > 0) {
    employeesQuery = employeesQuery.in('id', filters.employeeIds);
  }

  const { data: employees } = await employeesQuery;

  if (!employees || employees.length === 0) {
    return [];
  }

  const employeeIds = employees.map(e => e.id);

  // Get articles (exclude low-view articles)
  let articlesQuery = supabase
    .from('articles')
    .select('employee_id, views')
    .in('employee_id', employeeIds)
    .eq('is_low_views', false);

  if (filters.startDate) {
    articlesQuery = articlesQuery.gte('published_at', filters.startDate);
  }
  if (filters.endDate) {
    articlesQuery = articlesQuery.lte('published_at', filters.endDate + 'T23:59:59');
  }

  const { data: articles } = await articlesQuery;

  // Get hours
  let hoursQuery = supabase
    .from('daily_hours')
    .select('employee_id, hours')
    .in('employee_id', employeeIds);

  if (filters.startDate) {
    hoursQuery = hoursQuery.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    hoursQuery = hoursQuery.lte('date', filters.endDate);
  }

  const { data: hours } = await hoursQuery;

  // Aggregate by employee
  const metrics: EmployeeMetrics[] = employees.map(employee => {
    const empArticles = articles?.filter(a => a.employee_id === employee.id) || [];
    const empHours = hours?.filter(h => h.employee_id === employee.id) || [];

    const totalArticles = empArticles.length;
    const totalViews = empArticles.reduce((sum, a) => sum + (a.views || 0), 0);
    const totalHours = empHours.reduce((sum, h) => sum + (Number(h.hours) || 0), 0);

    return {
      employee_id: employee.id,
      employee_name: employee.canonical_name,
      total_articles: totalArticles,
      total_views: totalViews,
      total_hours: Math.round(totalHours * 100) / 100,
      avg_views_per_article: totalArticles > 0 ? Math.round(totalViews / totalArticles) : null,
      rate_articles_per_hour: safeDivide(totalArticles, totalHours)
        ? Math.round(safeDivide(totalArticles, totalHours)! * 100) / 100
        : null,
      efficiency_views_per_hour: safeDivide(totalViews, totalHours)
        ? Math.round(safeDivide(totalViews, totalHours)!)
        : null,
    };
  });

  // Sort by efficiency (descending), nulls last
  return metrics.sort((a, b) => {
    if (a.efficiency_views_per_hour === null && b.efficiency_views_per_hour === null) return 0;
    if (a.efficiency_views_per_hour === null) return 1;
    if (b.efficiency_views_per_hour === null) return -1;
    return b.efficiency_views_per_hour - a.efficiency_views_per_hour;
  });
}

/**
 * Get top articles by views
 */
export async function getTopArticles(
  filters: QueryFilters,
  limit: number = 5
): Promise<TopArticle[]> {
  const supabase = createClient();

  let query = supabase
    .from('articles')
    .select(`
      article_id,
      title,
      views,
      published_at,
      employee:employees(canonical_name)
    `)
    .eq('is_low_views', false)
    .order('views', { ascending: false })
    .limit(limit);

  if (filters.startDate) {
    query = query.gte('published_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('published_at', filters.endDate + 'T23:59:59');
  }
  if (filters.employeeIds && filters.employeeIds.length > 0) {
    query = query.in('employee_id', filters.employeeIds);
  }

  const { data } = await query;

  return (data || []).map(article => ({
    article_id: article.article_id,
    title: article.title,
    views: article.views,
    published_at: article.published_at,
    employee_name: (article.employee as unknown as { canonical_name: string } | null)?.canonical_name || '-',
  }));
}

/**
 * Get all employees for filter dropdown
 */
export async function getAllEmployees(): Promise<Array<{ id: string; name: string }>> {
  const supabase = createClient();

  const { data } = await supabase
    .from('employees')
    .select('id, canonical_name')
    .order('canonical_name');

  return (data || []).map(e => ({
    id: e.id,
    name: e.canonical_name,
  }));
}

// ============================================================================
// ADVANCED ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Helper: Get ISO week number from date
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Helper: Get day name in Hebrew
 */
const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * Get hours aggregated by month or week
 * Useful for time-series charts and trend analysis
 */
export async function getHoursTimeSeries(
  filters: QueryFilters,
  groupBy: 'month' | 'week' = 'month'
): Promise<HoursTimeSeries[]> {
  const supabase = createClient();

  let query = supabase
    .from('daily_hours')
    .select('date, hours, employee_id');

  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }
  if (filters.employeeIds?.length) {
    query = query.in('employee_id', filters.employeeIds);
  }

  const { data: hours } = await query;

  // Group by period
  const periodMap = new Map<string, {
    totalHours: number;
    employees: Set<string>;
  }>();

  for (const h of hours || []) {
    const date = new Date(h.date);
    const period = groupBy === 'month'
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : `${date.getFullYear()}-W${String(getWeekNumber(date)).padStart(2, '0')}`;

    if (!periodMap.has(period)) {
      periodMap.set(period, { totalHours: 0, employees: new Set() });
    }

    const entry = periodMap.get(period)!;
    entry.totalHours += Number(h.hours) || 0;
    entry.employees.add(h.employee_id);
  }

  return [...periodMap.entries()]
    .map(([period, data]) => ({
      period,
      total_hours: Math.round(data.totalHours * 100) / 100,
      employee_count: data.employees.size,
      avg_hours_per_employee: data.employees.size > 0
        ? Math.round((data.totalHours / data.employees.size) * 100) / 100
        : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Get articles aggregated by month or week
 */
export async function getArticlesTimeSeries(
  filters: QueryFilters,
  groupBy: 'month' | 'week' = 'month'
): Promise<ArticlesTimeSeries[]> {
  const supabase = createClient();

  let query = supabase
    .from('articles')
    .select('published_at, views, employee_id')
    .eq('is_low_views', false);

  if (filters.startDate) {
    query = query.gte('published_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('published_at', filters.endDate + 'T23:59:59');
  }
  if (filters.employeeIds?.length) {
    query = query.in('employee_id', filters.employeeIds);
  }

  const { data: articles } = await query;

  // Group by period
  const periodMap = new Map<string, {
    totalArticles: number;
    totalViews: number;
    employees: Set<string>;
  }>();

  for (const a of articles || []) {
    const date = new Date(a.published_at);
    const period = groupBy === 'month'
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : `${date.getFullYear()}-W${String(getWeekNumber(date)).padStart(2, '0')}`;

    if (!periodMap.has(period)) {
      periodMap.set(period, { totalArticles: 0, totalViews: 0, employees: new Set() });
    }

    const entry = periodMap.get(period)!;
    entry.totalArticles++;
    entry.totalViews += a.views || 0;
    if (a.employee_id) entry.employees.add(a.employee_id);
  }

  return [...periodMap.entries()]
    .map(([period, data]) => ({
      period,
      total_articles: data.totalArticles,
      total_views: data.totalViews,
      employee_count: data.employees.size,
      avg_articles_per_employee: data.employees.size > 0
        ? Math.round((data.totalArticles / data.employees.size) * 100) / 100
        : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Detect missing data gaps
 * Finds employees who have hours but no articles, or vice versa
 */
export async function detectMissingData(filters: QueryFilters): Promise<DataGap[]> {
  const supabase = createClient();
  const gaps: DataGap[] = [];

  // Get all employees
  const { data: employees } = await supabase
    .from('employees')
    .select('id, canonical_name');

  if (!employees) return gaps;

  // Filter by specific employees if provided
  const targetEmployees = filters.employeeIds?.length
    ? employees.filter(e => filters.employeeIds!.includes(e.id))
    : employees;

  // Get hours counts per employee
  let hoursQuery = supabase
    .from('daily_hours')
    .select('employee_id');

  if (filters.startDate) hoursQuery = hoursQuery.gte('date', filters.startDate);
  if (filters.endDate) hoursQuery = hoursQuery.lte('date', filters.endDate);

  const { data: allHours } = await hoursQuery;

  // Get articles counts per employee (exclude low-view articles)
  let articlesQuery = supabase
    .from('articles')
    .select('employee_id')
    .eq('is_low_views', false);

  if (filters.startDate) articlesQuery = articlesQuery.gte('published_at', filters.startDate);
  if (filters.endDate) articlesQuery = articlesQuery.lte('published_at', filters.endDate + 'T23:59:59');

  const { data: allArticles } = await articlesQuery;

  // Count per employee
  const hoursCounts = new Map<string, number>();
  const articlesCounts = new Map<string, number>();

  for (const h of allHours || []) {
    hoursCounts.set(h.employee_id, (hoursCounts.get(h.employee_id) || 0) + 1);
  }

  for (const a of allArticles || []) {
    if (a.employee_id) {
      articlesCounts.set(a.employee_id, (articlesCounts.get(a.employee_id) || 0) + 1);
    }
  }

  // Detect gaps
  for (const emp of targetEmployees) {
    const hoursCount = hoursCounts.get(emp.id) || 0;
    const articlesCount = articlesCounts.get(emp.id) || 0;

    if (hoursCount > 0 && articlesCount === 0) {
      gaps.push({
        employee_id: emp.id,
        employee_name: emp.canonical_name,
        gap_type: 'hours_only',
        details: `יש ${hoursCount} רשומות שעות אבל אין כתבות`,
        hours_count: hoursCount,
        articles_count: 0,
      });
    } else if (hoursCount === 0 && articlesCount > 0) {
      gaps.push({
        employee_id: emp.id,
        employee_name: emp.canonical_name,
        gap_type: 'articles_only',
        details: `יש ${articlesCount} כתבות אבל אין שעות`,
        hours_count: 0,
        articles_count: articlesCount,
      });
    }
  }

  return gaps.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
}

/**
 * Detect anomalies in hours data
 * Flags values that deviate significantly from the employee's average
 */
export async function detectAnomalies(
  filters: QueryFilters,
  thresholdStdDev: number = 2.0
): Promise<Anomaly[]> {
  const supabase = createClient();
  const anomalies: Anomaly[] = [];

  // Get employees
  let employeesQuery = supabase
    .from('employees')
    .select('id, canonical_name');

  if (filters.employeeIds?.length) {
    employeesQuery = employeesQuery.in('id', filters.employeeIds);
  }

  const { data: employees } = await employeesQuery;

  if (!employees) return anomalies;

  for (const emp of employees) {
    let query = supabase
      .from('daily_hours')
      .select('date, hours')
      .eq('employee_id', emp.id)
      .order('date');

    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);

    const { data: hours } = await query;

    if (!hours || hours.length < 5) continue; // Need enough data for statistics

    // Calculate mean and standard deviation
    const values = hours.map(h => Number(h.hours));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) continue; // All values are identical

    // Find anomalies
    for (const h of hours) {
      const value = Number(h.hours);
      const deviation = Math.abs(value - mean);

      if (deviation > thresholdStdDev * stdDev) {
        const deviationPercent = mean > 0 ? Math.round((deviation / mean) * 100) : 100;
        const severity: 'low' | 'medium' | 'high' =
          deviationPercent > 100 ? 'high' : deviationPercent > 50 ? 'medium' : 'low';

        anomalies.push({
          employee_id: emp.id,
          employee_name: emp.canonical_name,
          type: value > mean ? 'hours_spike' : 'hours_drop',
          date: h.date,
          value: Math.round(value * 100) / 100,
          expected_value: Math.round(mean * 100) / 100,
          deviation_percent: deviationPercent,
          severity,
        });
      }
    }
  }

  // Sort by severity (high first) then by deviation
  return anomalies.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.deviation_percent - a.deviation_percent;
  });
}

/**
 * Get cross-reference analysis: hours worked for each article
 * Links articles to the hours worked on their publish date and week
 */
export async function getArticleHoursAnalysis(filters: QueryFilters): Promise<EmployeeArticleHours[]> {
  const supabase = createClient();

  // Get articles with employee info (exclude low-view articles)
  let articlesQuery = supabase
    .from('articles')
    .select(`
      article_id,
      title,
      views,
      published_at,
      employee_id,
      employee:employees(canonical_name)
    `)
    .eq('is_low_views', false);

  if (filters.startDate) articlesQuery = articlesQuery.gte('published_at', filters.startDate);
  if (filters.endDate) articlesQuery = articlesQuery.lte('published_at', filters.endDate + 'T23:59:59');
  if (filters.employeeIds?.length) articlesQuery = articlesQuery.in('employee_id', filters.employeeIds);

  const { data: articles } = await articlesQuery;

  if (!articles) return [];

  // Get all hours for these employees in the date range
  const employeeIds = [...new Set(articles.map(a => a.employee_id).filter(Boolean))];

  if (employeeIds.length === 0) return [];

  // Extend date range to include week context
  const minDate = new Date(filters.startDate || '2020-01-01');
  minDate.setDate(minDate.getDate() - 7);
  const maxDate = new Date(filters.endDate || '2099-12-31');
  maxDate.setDate(maxDate.getDate() + 7);

  const { data: allHours } = await supabase
    .from('daily_hours')
    .select('employee_id, date, hours')
    .in('employee_id', employeeIds)
    .gte('date', minDate.toISOString().split('T')[0])
    .lte('date', maxDate.toISOString().split('T')[0]);

  // Build hours lookup map
  const hoursMap = new Map<string, number>(); // key: employee_id:date
  for (const h of allHours || []) {
    hoursMap.set(`${h.employee_id}:${h.date}`, Number(h.hours) || 0);
  }

  const results: EmployeeArticleHours[] = [];

  for (const article of articles) {
    if (!article.employee_id) continue;

    const publishDate = new Date(article.published_at);
    const publishDateStr = publishDate.toISOString().split('T')[0];

    // Get hours on publish date
    const hoursOnPublishDate = hoursMap.get(`${article.employee_id}:${publishDateStr}`) || 0;

    // Get hours for the week of publish
    const weekStart = new Date(publishDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    let hoursWeekOfPublish = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      hoursWeekOfPublish += hoursMap.get(`${article.employee_id}:${dateStr}`) || 0;
    }

    results.push({
      employee_id: article.employee_id,
      employee_name: (article.employee as unknown as { canonical_name: string })?.canonical_name || '-',
      article_id: article.article_id,
      article_title: article.title,
      published_at: article.published_at,
      views: article.views,
      hours_on_publish_date: Math.round(hoursOnPublishDate * 100) / 100,
      hours_week_of_publish: Math.round(hoursWeekOfPublish * 100) / 100,
    });
  }

  return results.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
}

/**
 * Get trend analysis comparing two periods
 */
export async function getTrendAnalysis(
  currentPeriod: Period,
  previousPeriod: Period,
  employeeIds?: string[]
): Promise<TrendComparison[]> {
  const trends: TrendComparison[] = [];

  // Get current period metrics
  const currentMetrics = await getGlobalMetrics({
    startDate: currentPeriod.start,
    endDate: currentPeriod.end,
    employeeIds,
  });

  // Get previous period metrics
  const previousMetrics = await getGlobalMetrics({
    startDate: previousPeriod.start,
    endDate: previousPeriod.end,
    employeeIds,
  });

  // Calculate trends for each metric
  const metrics = [
    { name: 'סה״כ כתבות', current: currentMetrics.total_articles, previous: previousMetrics.total_articles },
    { name: 'סה״כ צפיות', current: currentMetrics.total_views, previous: previousMetrics.total_views },
    { name: 'סה״כ שעות', current: currentMetrics.total_hours, previous: previousMetrics.total_hours },
    {
      name: 'יעילות ממוצעת',
      current: currentMetrics.avg_efficiency || 0,
      previous: previousMetrics.avg_efficiency || 0
    },
  ];

  for (const m of metrics) {
    const changePercent = m.previous > 0
      ? Math.round(((m.current - m.previous) / m.previous) * 100)
      : m.current > 0 ? 100 : 0;

    trends.push({
      current_period: `${currentPeriod.start} עד ${currentPeriod.end}`,
      previous_period: `${previousPeriod.start} עד ${previousPeriod.end}`,
      metric: m.name,
      current_value: m.current,
      previous_value: m.previous,
      change_percent: changePercent,
      trend: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
    });
  }

  return trends;
}

/**
 * Get employee rankings by various metrics
 */
export async function getEmployeeRankings(
  filters: QueryFilters,
  metric: 'hours' | 'articles' | 'views' | 'efficiency' = 'efficiency'
): Promise<EmployeeRanking[]> {
  const employeeMetrics = await getEmployeeMetrics(filters);

  // Sort by the selected metric
  const sorted = [...employeeMetrics].sort((a, b) => {
    switch (metric) {
      case 'hours':
        return b.total_hours - a.total_hours;
      case 'articles':
        return b.total_articles - a.total_articles;
      case 'views':
        return b.total_views - a.total_views;
      case 'efficiency':
        return (b.efficiency_views_per_hour || 0) - (a.efficiency_views_per_hour || 0);
    }
  });

  return sorted.map((emp, index) => {
    let metricValue: number;
    switch (metric) {
      case 'hours':
        metricValue = emp.total_hours;
        break;
      case 'articles':
        metricValue = emp.total_articles;
        break;
      case 'views':
        metricValue = emp.total_views;
        break;
      case 'efficiency':
        metricValue = emp.efficiency_views_per_hour || 0;
        break;
    }

    return {
      employee_id: emp.employee_id,
      employee_name: emp.employee_name,
      rank: index + 1,
      metric_name: metric,
      metric_value: metricValue,
      percentile: sorted.length > 1
        ? Math.round((1 - index / (sorted.length - 1)) * 100)
        : 100,
    };
  });
}

/**
 * Get weekly breakdown of hours by day of week
 * Useful for understanding work patterns
 */
export async function getWeeklyBreakdown(filters: QueryFilters): Promise<WeeklyBreakdown[]> {
  const supabase = createClient();

  let query = supabase
    .from('daily_hours')
    .select('date, hours, employee_id');

  if (filters.startDate) query = query.gte('date', filters.startDate);
  if (filters.endDate) query = query.lte('date', filters.endDate);
  if (filters.employeeIds?.length) query = query.in('employee_id', filters.employeeIds);

  const { data: hours } = await query;

  // Group by day of week
  const dayData = new Map<number, { totalHours: number; count: number; employees: Set<string> }>();

  for (let i = 0; i < 7; i++) {
    dayData.set(i, { totalHours: 0, count: 0, employees: new Set() });
  }

  for (const h of hours || []) {
    const date = new Date(h.date);
    const dayOfWeek = date.getDay();
    const entry = dayData.get(dayOfWeek)!;
    entry.totalHours += Number(h.hours) || 0;
    entry.count++;
    entry.employees.add(h.employee_id);
  }

  return Array.from(dayData.entries()).map(([day, data]) => ({
    day_of_week: day,
    day_name: DAY_NAMES_HE[day],
    total_hours: Math.round(data.totalHours * 100) / 100,
    avg_hours: data.count > 0 ? Math.round((data.totalHours / data.count) * 100) / 100 : 0,
    employee_count: data.employees.size,
  }));
}

// ============================================================================
// PRD ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Get dashboard KPIs for macro view
 * Includes aggregated metrics and top articles
 * @param filters Query filters (date range, shift, Sabbath exclusion)
 * @param topArticlesLimit Number of top articles to return (default: 5)
 * @returns Dashboard KPIs with averages
 */
export async function getDashboardKPIs(
  filters: QueryFilters,
  topArticlesLimit: number = 5
): Promise<DashboardKPIs> {
  const supabase = createClient();

  // Fetch articles (exclude low-view articles)
  let articlesQuery = supabase
    .from('articles')
    .select('views, employee_id, published_at')
    .eq('is_low_views', false);

  if (filters.startDate) {
    articlesQuery = articlesQuery.gte('published_at', filters.startDate);
  }
  if (filters.endDate) {
    articlesQuery = articlesQuery.lte('published_at', filters.endDate + 'T23:59:59');
  }
  if (filters.employeeIds?.length) {
    articlesQuery = articlesQuery.in('employee_id', filters.employeeIds);
  }

  const { data: articles } = await articlesQuery;

  // Apply filters
  let filteredArticles = filterSabbath(articles || [], filters.excludeSabbath || false);
  filteredArticles = filterByShift(filteredArticles, filters.shift);

  // Fetch hours
  let hoursQuery = supabase
    .from('daily_hours')
    .select('hours, date, employee_id');

  if (filters.startDate) {
    hoursQuery = hoursQuery.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    hoursQuery = hoursQuery.lte('date', filters.endDate);
  }
  if (filters.employeeIds?.length) {
    hoursQuery = hoursQuery.in('employee_id', filters.employeeIds);
  }

  const { data: hours } = await hoursQuery;
  const filteredHours = filterSabbath(hours || [], filters.excludeSabbath || false);

  // Calculate totals
  const totalArticles = filteredArticles.length;
  const totalViews = filteredArticles.reduce((sum, a) => sum + (a.views || 0), 0);
  const totalHours = filteredHours.reduce((sum, h) => sum + (Number(h.hours) || 0), 0);

  // Calculate averages (round UP for efficiency, 2 decimals for pace)
  const avgEfficiency = totalHours > 0 ? Math.ceil(totalViews / totalHours) : 0;
  const avgPace = totalHours > 0 ? Math.round((totalArticles / totalHours) * 100) / 100 : 0;

  // Get top articles
  const topArticles = await getTopArticles(filters, topArticlesLimit);

  return {
    total_views: totalViews,
    total_articles: totalArticles,
    total_hours: Math.round(totalHours * 100) / 100,
    avg_efficiency: avgEfficiency,
    avg_pace: avgPace,
    top_articles: topArticles,
  };
}

/**
 * Get employee efficiency table with performance flags
 * Shows ALL employees with hours, even if 0 articles in shift
 * @param filters Query filters (date range, shift, Sabbath exclusion)
 * @returns Array of employee efficiency data sorted by efficiency DESC
 */
export async function getEmployeeEfficiencyTable(
  filters: QueryFilters
): Promise<EmployeeEfficiency[]> {
  const supabase = createClient();

  // Fetch ALL employees with hours in the date range
  let hoursQuery = supabase
    .from('daily_hours')
    .select('employee_id, hours, date')
    .not('employee_id', 'is', null);

  if (filters.startDate) {
    hoursQuery = hoursQuery.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    hoursQuery = hoursQuery.lte('date', filters.endDate);
  }
  if (filters.employeeIds?.length) {
    hoursQuery = hoursQuery.in('employee_id', filters.employeeIds);
  }

  const { data: hours } = await hoursQuery;
  const filteredHours = filterSabbath(hours || [], filters.excludeSabbath || false);

  // Get unique employee IDs with hours
  const employeeIds = [...new Set(filteredHours.map(h => h.employee_id))];

  if (employeeIds.length === 0) return [];

  // Fetch employee names
  const { data: employees } = await supabase
    .from('employees')
    .select('id, canonical_name')
    .in('id', employeeIds);

  // Fetch articles for these employees
  let articlesQuery = supabase
    .from('articles')
    .select('employee_id, views, published_at')
    .eq('is_low_views', false)
    .in('employee_id', employeeIds);

  if (filters.startDate) {
    articlesQuery = articlesQuery.gte('published_at', filters.startDate);
  }
  if (filters.endDate) {
    articlesQuery = articlesQuery.lte('published_at', filters.endDate + 'T23:59:59');
  }

  const { data: articles } = await articlesQuery;

  // Apply filters to articles
  let filteredArticles = filterSabbath(articles || [], filters.excludeSabbath || false);
  filteredArticles = filterByShift(filteredArticles, filters.shift);

  // Build efficiency data
  const efficiencyData: EmployeeEfficiency[] = [];

  for (const employee of employees || []) {
    const empArticles = filteredArticles.filter(a => a.employee_id === employee.id);
    const empHours = filteredHours.filter(h => h.employee_id === employee.id);

    const articleCount = empArticles.length;
    const totalViews = empArticles.reduce((sum, a) => sum + (a.views || 0), 0);
    const totalHours = empHours.reduce((sum, h) => sum + (Number(h.hours) || 0), 0);

    const pace = safeDivide(articleCount, totalHours);
    const efficiency = safeDivide(totalViews, totalHours);

    // Calculate flags
    const noHours = totalHours === 0;
    const highPace = pace !== null && pace > 2.0;

    // Check missing_hours_with_articles flag
    // Employee has articles on days with no hours records
    const articleDates = new Set(
      empArticles.map(a => new Date(a.published_at).toISOString().split('T')[0])
    );
    const hoursDates = new Set(empHours.map(h => h.date));
    const missingHoursWithArticles = Array.from(articleDates).some(date => !hoursDates.has(date));

    efficiencyData.push({
      employee_id: employee.id,
      employee_name: employee.canonical_name,
      article_count: articleCount,
      total_views: totalViews,
      total_hours: Math.round(totalHours * 100) / 100,
      pace: pace ? Math.round(pace * 100) / 100 : null,
      efficiency: efficiency ? Math.round(efficiency) : null,
      missing_hours_with_articles: missingHoursWithArticles,
      no_hours: noHours,
      high_pace: highPace,
    });
  }

  // Sort by efficiency DESC (nulls last)
  return efficiencyData.sort((a, b) => {
    if (a.efficiency === null && b.efficiency === null) return 0;
    if (a.efficiency === null) return 1;
    if (b.efficiency === null) return -1;
    return b.efficiency - a.efficiency;
  });
}

/**
 * Get employee trends bucketed by time resolution
 * Supports period comparison for A/B analysis
 * @param employeeId Employee ID
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @param resolution Time resolution (daily/weekly/monthly/yearly)
 * @param comparePeriod Optional comparison period
 * @param excludeSabbath Exclude Saturday data (default: false)
 * @returns Employee trends with bucketed data
 */
export async function getEmployeeTrends(
  employeeId: string,
  startDate: string,
  endDate: string,
  resolution: TimeResolution,
  comparePeriod?: { start_date: string; end_date: string },
  excludeSabbath: boolean = false
): Promise<EmployeeTrends> {
  const supabase = createClient();

  // Get employee name
  const { data: employee } = await supabase
    .from('employees')
    .select('canonical_name')
    .eq('id', employeeId)
    .single();

  if (!employee) {
    throw new Error('Employee not found');
  }

  // Fetch period A data
  const periodAData = await fetchEmployeePeriodData(
    supabase,
    employeeId,
    startDate,
    endDate,
    resolution,
    excludeSabbath
  );

  // Fetch period B data if comparison requested
  let comparison = undefined;
  if (comparePeriod) {
    const periodBData = await fetchEmployeePeriodData(
      supabase,
      employeeId,
      comparePeriod.start_date,
      comparePeriod.end_date,
      resolution,
      excludeSabbath
    );
    comparison = {
      period_a: periodAData,
      period_b: periodBData,
    };
  }

  return {
    employee_id: employeeId,
    employee_name: employee.canonical_name,
    resolution,
    data: periodAData,
    comparison,
  };
}

/**
 * Helper: Fetch and bucket employee data for a specific period
 * @param supabase Supabase client
 * @param employeeId Employee ID
 * @param startDate Start date (YYYY-MM-DD)
 * @param endDate End date (YYYY-MM-DD)
 * @param resolution Time resolution
 * @param excludeSabbath Exclude Saturday data
 * @returns Array of trend points
 */
async function fetchEmployeePeriodData(
  supabase: any,
  employeeId: string,
  startDate: string,
  endDate: string,
  resolution: TimeResolution,
  excludeSabbath: boolean
): Promise<EmployeeTrendPoint[]> {
  // Fetch articles
  const { data: articles } = await supabase
    .from('articles')
    .select('published_at, views')
    .eq('employee_id', employeeId)
    .eq('is_low_views', false)
    .gte('published_at', startDate)
    .lte('published_at', endDate + 'T23:59:59');

  // Fetch hours
  const { data: hours } = await supabase
    .from('daily_hours')
    .select('date, hours')
    .eq('employee_id', employeeId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Apply Sabbath filter
  const filteredArticles = filterSabbath(articles || [], excludeSabbath);
  const filteredHours = filterSabbath(hours || [], excludeSabbath);

  // Bucket data by resolution
  const buckets = new Map<string, {
    hours: number;
    articles: number;
    views: number;
  }>();

  // Bucket hours
  for (const h of filteredHours) {
    if (!h.date) continue;
    const bucket = getBucket(new Date(h.date), resolution);
    if (!buckets.has(bucket)) {
      buckets.set(bucket, { hours: 0, articles: 0, views: 0 });
    }
    buckets.get(bucket)!.hours += Number((h as any).hours) || 0;
  }

  // Bucket articles
  for (const a of filteredArticles) {
    if (!a.published_at) continue;
    const bucket = getBucket(new Date(a.published_at), resolution);
    if (!buckets.has(bucket)) {
      buckets.set(bucket, { hours: 0, articles: 0, views: 0 });
    }
    buckets.get(bucket)!.articles++;
    buckets.get(bucket)!.views += (a as any).views || 0;
  }

  // Convert to trend points
  return Array.from(buckets.entries())
    .map(([bucket, data]) => {
      const pace = safeDivide(data.articles, data.hours);
      const efficiency = safeDivide(data.views, data.hours);

      return {
        bucket,
        hours: Math.round(data.hours * 100) / 100,
        article_count: data.articles,
        total_views: data.views,
        pace: pace ? Math.round(pace * 100) / 100 : null,
        efficiency: efficiency ? Math.round(efficiency) : null,
      };
    })
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}
