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
} from '@/types';
import { safeDivide } from '@/lib/utils/numbers';

/**
 * Get global metrics for the dashboard
 */
export async function getGlobalMetrics(filters: QueryFilters): Promise<GlobalMetrics> {
  const supabase = createClient();

  // Build articles query (exclude low-view articles)
  let articlesQuery = supabase
    .from('articles')
    .select('views, employee_id')
    .eq('is_low_views', false);

  if (filters.startDate) {
    articlesQuery = articlesQuery.gte('published_at', filters.startDate);
  }
  if (filters.endDate) {
    articlesQuery = articlesQuery.lte('published_at', filters.endDate + 'T23:59:59');
  }
  if (filters.employeeIds && filters.employeeIds.length > 0) {
    articlesQuery = articlesQuery.in('employee_id', filters.employeeIds);
  }

  const { data: articles } = await articlesQuery;

  // Build hours query
  let hoursQuery = supabase
    .from('daily_hours')
    .select('hours, employee_id');

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

  const totalArticles = articles?.length || 0;
  const totalViews = articles?.reduce((sum, a) => sum + (a.views || 0), 0) || 0;
  const totalHours = hours?.reduce((sum, h) => sum + (Number(h.hours) || 0), 0) || 0;

  return {
    total_articles: totalArticles,
    total_views: totalViews,
    total_hours: totalHours,
    avg_rate: safeDivide(totalArticles, totalHours),
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
