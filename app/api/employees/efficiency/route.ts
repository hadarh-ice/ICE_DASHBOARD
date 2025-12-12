import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeEfficiencyTable } from '@/lib/queries/metrics';
import { QueryFilters } from '@/types';

/**
 * GET /api/employees/efficiency
 * Returns employee efficiency table with performance flags
 * Shows ALL employees with hours, even if 0 articles in the selected shift
 *
 * Query parameters:
 * - startDate: YYYY-MM-DD (optional)
 * - endDate: YYYY-MM-DD (optional)
 * - employeeIds: comma-separated employee IDs (optional)
 * - shift: 'all' | 'morning' | 'evening' (optional, default: 'all')
 * - excludeSabbath: 'true' | 'false' (optional, default: 'false')
 *
 * Returns array of EmployeeEfficiency objects sorted by efficiency DESC
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

    const efficiencyData = await getEmployeeEfficiencyTable(filters);

    return NextResponse.json(efficiencyData);
  } catch (error) {
    console.error('[API /employees/efficiency] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
