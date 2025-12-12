import { NextRequest, NextResponse } from 'next/server';
import { getDashboardKPIs } from '@/lib/queries/metrics';
import { QueryFilters } from '@/types';

/**
 * GET /api/dashboard
 * Returns dashboard KPIs including total views, articles, hours, averages, and top articles
 *
 * Query parameters:
 * - startDate: YYYY-MM-DD (optional)
 * - endDate: YYYY-MM-DD (optional)
 * - employeeIds: comma-separated employee IDs (optional)
 * - shift: 'all' | 'morning' | 'evening' (optional, default: 'all')
 * - excludeSabbath: 'true' | 'false' (optional, default: 'false')
 * - limit: number of top articles (optional, default: 5)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters: QueryFilters = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      employeeIds: searchParams.get('employeeIds')?.split(',') || undefined,
      shift: (searchParams.get('shift') || 'all') as 'all' | 'morning' | 'evening',
      excludeSabbath: searchParams.get('excludeSabbath') === 'true',
    };

    const limit = parseInt(searchParams.get('limit') || '5');
    const kpis = await getDashboardKPIs(filters, limit);

    return NextResponse.json(kpis);
  } catch (error) {
    console.error('[API /dashboard] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
