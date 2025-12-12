/**
 * ICE Analytics - Analytics Query Helpers
 *
 * Efficient aggregate queries for employee efficiency analytics.
 * All queries exclude low-view articles (views < 50) per PRD requirements.
 *
 * PERFORMANCE NOTES:
 * - Uses proper column selection to minimize data transfer
 * - Leverages database indexes for fast filtering
 * - Aggregates are computed in the database for efficiency
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface EmployeeAggregate {
  employee_id: string;
  employee_name: string;
  total_hours: number;
  total_articles: number;
  total_views: number;
  avg_views_per_article: number | null;
  pace_articles_per_hour: number | null;
  efficiency_views_per_hour: number | null;
}

export interface TopArticle {
  article_id: number;
  title: string;
  views: number;
  published_at: string;
  employee_id: string | null;
  employee_name: string | null;
}

export interface AnalyticsFilters {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  employeeIds?: string[]; // Filter by specific employees
}

// ============================================================================
// EMPLOYEE AGGREGATES
// ============================================================================

/**
 * Get per-employee aggregates for analytics dashboard
 *
 * Returns comprehensive statistics per employee:
 * - Total hours worked
 * - Total articles written (excluding low-view)
 * - Total views received (excluding low-view)
 * - Derived metrics: avg views/article, pace (articles/hour), efficiency (views/hour)
 *
 * FILTERS:
 * - startDate/endDate: Filter by date ranges for both hours and articles
 * - employeeIds: Filter to specific employees
 *
 * PERFORMANCE:
 * - Uses indexed columns (employee_id, date, published_at)
 * - Excludes is_low_views articles at database level
 * - Returns only necessary columns
 *
 * @param supabase - Supabase client
 * @param filters - Optional date range and employee filters
 * @returns Array of per-employee aggregates sorted by employee name
 */
export async function getEmployeeAggregates(
  supabase: SupabaseClient,
  filters?: AnalyticsFilters
): Promise<EmployeeAggregate[]> {
  try {
    // Build query for hours aggregates
    let hoursQuery = supabase
      .from('daily_hours')
      .select('employee_id, hours');

    if (filters?.startDate) {
      hoursQuery = hoursQuery.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      hoursQuery = hoursQuery.lte('date', filters.endDate);
    }
    if (filters?.employeeIds && filters.employeeIds.length > 0) {
      hoursQuery = hoursQuery.in('employee_id', filters.employeeIds);
    }

    const { data: hoursData, error: hoursError } = await hoursQuery;
    if (hoursError) throw hoursError;

    // Build query for articles aggregates (excluding low-view articles)
    let articlesQuery = supabase
      .from('articles')
      .select('employee_id, views')
      .eq('is_low_views', false); // KEY: Exclude low-view articles

    if (filters?.startDate) {
      articlesQuery = articlesQuery.gte('published_at', `${filters.startDate}T00:00:00`);
    }
    if (filters?.endDate) {
      articlesQuery = articlesQuery.lte('published_at', `${filters.endDate}T23:59:59`);
    }
    if (filters?.employeeIds && filters.employeeIds.length > 0) {
      articlesQuery = articlesQuery.in('employee_id', filters.employeeIds);
    }

    const { data: articlesData, error: articlesError } = await articlesQuery;
    if (articlesError) throw articlesError;

    // Get employee names
    const employeeIds = new Set([
      ...hoursData.map(h => h.employee_id),
      ...articlesData.filter(a => a.employee_id).map(a => a.employee_id!),
    ]);

    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, canonical_name')
      .in('id', Array.from(employeeIds));

    if (employeesError) throw employeesError;

    const employeeNameMap = new Map(
      employees.map(e => [e.id, e.canonical_name])
    );

    // Aggregate hours by employee
    const hoursMap = new Map<string, number>();
    hoursData.forEach(h => {
      const current = hoursMap.get(h.employee_id) || 0;
      hoursMap.set(h.employee_id, current + Number(h.hours));
    });

    // Aggregate articles by employee
    const articlesMap = new Map<string, { count: number; total_views: number }>();
    articlesData.forEach(a => {
      if (!a.employee_id) return; // Skip articles without employee
      const current = articlesMap.get(a.employee_id) || { count: 0, total_views: 0 };
      articlesMap.set(a.employee_id, {
        count: current.count + 1,
        total_views: current.total_views + a.views,
      });
    });

    // Combine into final aggregates
    const results: EmployeeAggregate[] = [];

    employeeIds.forEach(employeeId => {
      const total_hours = hoursMap.get(employeeId) || 0;
      const articles = articlesMap.get(employeeId) || { count: 0, total_views: 0 };
      const total_articles = articles.count;
      const total_views = articles.total_views;

      // Calculate derived metrics
      const avg_views_per_article =
        total_articles > 0 ? total_views / total_articles : null;

      const pace_articles_per_hour =
        total_hours > 0 ? total_articles / total_hours : null;

      const efficiency_views_per_hour =
        total_hours > 0 ? total_views / total_hours : null;

      results.push({
        employee_id: employeeId,
        employee_name: employeeNameMap.get(employeeId) || 'Unknown',
        total_hours,
        total_articles,
        total_views,
        avg_views_per_article,
        pace_articles_per_hour,
        efficiency_views_per_hour,
      });
    });

    // Sort by employee name
    results.sort((a, b) => a.employee_name.localeCompare(b.employee_name));

    return results;
  } catch (error) {
    console.error('Error fetching employee aggregates:', error);
    throw new Error(
      `Failed to fetch employee aggregates: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================================
// TOP ARTICLES
// ============================================================================

/**
 * Get top articles sorted by views
 *
 * Returns the highest-performing articles with employee information.
 * Excludes low-view articles (views < 50) per PRD requirements.
 *
 * FILTERS:
 * - startDate/endDate: Filter by published_at date
 * - limit: Number of top articles to return (default: 10)
 *
 * PERFORMANCE:
 * - Uses idx_high_view_articles partial index (WHERE is_low_views = FALSE)
 * - Sorted by views DESC at database level
 * - Joins employee for name display
 *
 * @param supabase - Supabase client
 * @param filters - Optional date range filters
 * @param limit - Maximum number of articles to return (default: 10)
 * @returns Array of top articles sorted by views DESC
 */
export async function getTopArticles(
  supabase: SupabaseClient,
  filters?: AnalyticsFilters,
  limit: number = 10
): Promise<TopArticle[]> {
  try {
    let query = supabase
      .from('articles')
      .select(
        `
        article_id,
        title,
        views,
        published_at,
        employee_id,
        employees!inner(canonical_name)
      `
      )
      .eq('is_low_views', false) // KEY: Exclude low-view articles
      .order('views', { ascending: false })
      .limit(limit);

    if (filters?.startDate) {
      query = query.gte('published_at', `${filters.startDate}T00:00:00`);
    }
    if (filters?.endDate) {
      query = query.lte('published_at', `${filters.endDate}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform data to match TopArticle interface
    return data.map(article => {
      // Supabase returns employees as object when using !inner, but TS may infer array
      const employeeData = article.employees as unknown as { canonical_name: string } | null;
      return {
        article_id: article.article_id,
        title: article.title,
        views: article.views,
        published_at: article.published_at,
        employee_id: article.employee_id,
        employee_name: employeeData?.canonical_name || null,
      };
    });
  } catch (error) {
    console.error('Error fetching top articles:', error);
    throw new Error(
      `Failed to fetch top articles: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get total articles count (excluding low-view)
 *
 * Quick count of all articles that qualify for metrics.
 *
 * @param supabase - Supabase client
 * @param filters - Optional date range filters
 * @returns Total count of non-low-view articles
 */
export async function getTotalArticlesCount(
  supabase: SupabaseClient,
  filters?: AnalyticsFilters
): Promise<number> {
  try {
    let query = supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('is_low_views', false);

    if (filters?.startDate) {
      query = query.gte('published_at', `${filters.startDate}T00:00:00`);
    }
    if (filters?.endDate) {
      query = query.lte('published_at', `${filters.endDate}T23:59:59`);
    }

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error('Error counting articles:', error);
    throw new Error(
      `Failed to count articles: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get total views sum (excluding low-view articles)
 *
 * Quick sum of all views for articles that qualify for metrics.
 *
 * @param supabase - Supabase client
 * @param filters - Optional date range filters
 * @returns Total views across all non-low-view articles
 */
export async function getTotalViewsSum(
  supabase: SupabaseClient,
  filters?: AnalyticsFilters
): Promise<number> {
  try {
    let query = supabase
      .from('articles')
      .select('views')
      .eq('is_low_views', false);

    if (filters?.startDate) {
      query = query.gte('published_at', `${filters.startDate}T00:00:00`);
    }
    if (filters?.endDate) {
      query = query.lte('published_at', `${filters.endDate}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.reduce((sum, article) => sum + article.views, 0);
  } catch (error) {
    console.error('Error summing views:', error);
    throw new Error(
      `Failed to sum views: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get total hours sum
 *
 * Quick sum of all hours worked.
 *
 * @param supabase - Supabase client
 * @param filters - Optional date range filters
 * @returns Total hours across all employees
 */
export async function getTotalHoursSum(
  supabase: SupabaseClient,
  filters?: AnalyticsFilters
): Promise<number> {
  try {
    let query = supabase.from('daily_hours').select('hours');

    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.reduce((sum, record) => sum + Number(record.hours), 0);
  } catch (error) {
    console.error('Error summing hours:', error);
    throw new Error(
      `Failed to sum hours: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
