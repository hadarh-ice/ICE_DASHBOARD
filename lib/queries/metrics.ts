import { createClient } from '@/lib/supabase/client';
import { EmployeeMetrics, GlobalMetrics, TopArticle } from '@/types';
import { safeDivide } from '@/lib/utils/numbers';

interface QueryFilters {
  startDate?: string;
  endDate?: string;
  employeeIds?: string[];
}

/**
 * Get global metrics for the dashboard
 */
export async function getGlobalMetrics(filters: QueryFilters): Promise<GlobalMetrics> {
  const supabase = createClient();

  // Build articles query
  let articlesQuery = supabase
    .from('articles')
    .select('views, employee_id');

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

  // Get articles
  let articlesQuery = supabase
    .from('articles')
    .select('employee_id, views')
    .in('employee_id', employeeIds);

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
