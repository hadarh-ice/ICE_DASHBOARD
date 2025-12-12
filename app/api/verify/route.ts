import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NAME_MATCHING_CONFIG } from '@/lib/config/matching-thresholds';

/**
 * Verification endpoint for monthly data integrity checks
 * GET /api/verify?month=2025-11
 *
 * Returns:
 * - Hours summary: total hours, record count, unique employees
 * - Articles summary: total, valid (views >= 50), low-view count, total views
 * - Name matching: employees with hours but no articles, vice versa
 * - Expected KPIs based on the data
 */
export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get('month');

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM (e.g., 2025-11)' },
        { status: 400 }
      );
    }

    const [year, monthNum] = month.split('-').map(Number);

    // Calculate date range for the month
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
    const nextYear = monthNum === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    console.log(`[verify] Verifying data for ${month}: ${startDate} to ${endDate}`);

    const supabase = createAdminClient();

    // 1. Get hours data for the month
    const { data: hoursData, error: hoursError } = await supabase
      .from('daily_hours')
      .select('employee_id, date, hours')
      .gte('date', startDate)
      .lt('date', endDate);

    if (hoursError) {
      console.error('[verify] Hours query error:', hoursError);
      return NextResponse.json({ error: `Hours query failed: ${hoursError.message}` }, { status: 500 });
    }

    // 2. Get articles data for the month
    const { data: articlesData, error: articlesError } = await supabase
      .from('articles')
      .select('article_id, employee_id, views, is_low_views, published_at')
      .gte('published_at', startDate)
      .lt('published_at', endDate);

    if (articlesError) {
      console.error('[verify] Articles query error:', articlesError);
      return NextResponse.json({ error: `Articles query failed: ${articlesError.message}` }, { status: 500 });
    }

    // 3. Get employee names for reference
    const allEmployeeIds = new Set<string>([
      ...(hoursData?.map(h => h.employee_id) || []),
      ...(articlesData?.filter(a => a.employee_id).map(a => a.employee_id!) || []),
    ]);

    const { data: employees } = await supabase
      .from('employees')
      .select('id, canonical_name')
      .in('id', [...allEmployeeIds]);

    const employeeNames = new Map(employees?.map(e => [e.id, e.canonical_name]) || []);

    // Calculate hours summary
    const totalHours = hoursData?.reduce((sum, h) => sum + Number(h.hours), 0) || 0;
    const hoursRecordCount = hoursData?.length || 0;
    const uniqueEmployeesWithHours = new Set(hoursData?.map(h => h.employee_id));

    // Calculate articles summary
    const validArticles = articlesData?.filter(a => !a.is_low_views) || [];
    const lowViewArticles = articlesData?.filter(a => a.is_low_views) || [];
    const totalViews = validArticles.reduce((sum, a) => sum + a.views, 0);
    const uniqueAuthors = new Set(articlesData?.filter(a => a.employee_id).map(a => a.employee_id));

    // Find employees with hours but no articles
    const employeesWithHoursNoArticles: Array<{ id: string; name: string; totalHours: number }> = [];
    for (const empId of uniqueEmployeesWithHours) {
      const hasArticles = articlesData?.some(a => a.employee_id === empId);
      if (!hasArticles) {
        const empHours = hoursData?.filter(h => h.employee_id === empId).reduce((s, h) => s + Number(h.hours), 0) || 0;
        employeesWithHoursNoArticles.push({
          id: empId,
          name: employeeNames.get(empId) || 'Unknown',
          totalHours: Math.round(empHours * 100) / 100,
        });
      }
    }

    // Find authors with articles but no hours
    const authorsWithArticlesNoHours: Array<{ id: string; name: string; articleCount: number; totalViews: number }> = [];
    for (const authorId of uniqueAuthors) {
      const hasHours = hoursData?.some(h => h.employee_id === authorId);
      if (!hasHours && authorId) {
        const authorArticles = validArticles.filter(a => a.employee_id === authorId);
        authorsWithArticlesNoHours.push({
          id: authorId,
          name: employeeNames.get(authorId) || 'Unknown',
          articleCount: authorArticles.length,
          totalViews: authorArticles.reduce((s, a) => s + a.views, 0),
        });
      }
    }

    // Calculate expected KPIs
    const expectedPace = totalHours > 0 ? Math.round((validArticles.length / totalHours) * 100) / 100 : 0;
    const expectedEfficiency = totalHours > 0 ? Math.ceil(totalViews / totalHours) : 0;

    // Per-employee breakdown
    const employeeBreakdown: Array<{
      id: string;
      name: string;
      hours: number;
      validArticles: number;
      totalViews: number;
      pace: number | null;
      efficiency: number | null;
      hasDataIntegrityIssue: boolean;
    }> = [];

    for (const empId of allEmployeeIds) {
      const empHours = hoursData?.filter(h => h.employee_id === empId).reduce((s, h) => s + Number(h.hours), 0) || 0;
      const empArticles = validArticles.filter(a => a.employee_id === empId);
      const empViews = empArticles.reduce((s, a) => s + a.views, 0);

      employeeBreakdown.push({
        id: empId,
        name: employeeNames.get(empId) || 'Unknown',
        hours: Math.round(empHours * 100) / 100,
        validArticles: empArticles.length,
        totalViews: empViews,
        pace: empHours > 0 ? Math.round((empArticles.length / empHours) * 100) / 100 : null,
        efficiency: empHours > 0 ? Math.ceil(empViews / empHours) : null,
        hasDataIntegrityIssue: (empHours === 0 && empArticles.length > 0) || (empHours > 0 && empArticles.length === 0),
      });
    }

    // Sort by efficiency descending
    employeeBreakdown.sort((a, b) => (b.efficiency || 0) - (a.efficiency || 0));

    const result = {
      month,
      dateRange: { start: startDate, end: endDate },
      hours: {
        totalHours: Math.round(totalHours * 100) / 100,
        recordCount: hoursRecordCount,
        uniqueEmployees: uniqueEmployeesWithHours.size,
      },
      articles: {
        total: articlesData?.length || 0,
        valid: validArticles.length,
        lowView: lowViewArticles.length,
        lowViewThreshold: NAME_MATCHING_CONFIG.LOW_VIEWS_THRESHOLD,
        totalViews,
        uniqueAuthors: uniqueAuthors.size,
      },
      expectedKPIs: {
        pace: expectedPace,
        efficiency: expectedEfficiency,
        avgViewsPerArticle: validArticles.length > 0 ? Math.round(totalViews / validArticles.length) : 0,
      },
      dataIntegrity: {
        employeesWithHoursNoArticles,
        authorsWithArticlesNoHours,
        articlesWithoutEmployee: articlesData?.filter(a => !a.employee_id).length || 0,
      },
      employeeBreakdown,
    };

    console.log(`[verify] Verification complete for ${month}`);
    return NextResponse.json(result);

  } catch (error) {
    console.error('[verify] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
