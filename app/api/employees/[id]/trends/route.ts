import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeTrends } from '@/lib/queries/metrics';
import { TimeResolution } from '@/types';

/**
 * POST /api/employees/[id]/trends
 * Returns employee trends bucketed by time resolution
 * Supports period comparison for A/B analysis
 *
 * Request body (JSON):
 * {
 *   start_date: string (YYYY-MM-DD, required)
 *   end_date: string (YYYY-MM-DD, required)
 *   resolution: 'daily' | 'weekly' | 'monthly' | 'yearly' (required)
 *   compare_period?: {
 *     start_date: string (YYYY-MM-DD)
 *     end_date: string (YYYY-MM-DD)
 *   }
 *   exclude_sabbath?: boolean (default: false)
 * }
 *
 * Returns EmployeeTrends object with bucketed data and optional comparison
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { start_date, end_date, resolution, compare_period, exclude_sabbath } = body;

    // Validate required fields
    if (!start_date || !end_date || !resolution) {
      return NextResponse.json(
        { error: 'Missing required fields: start_date, end_date, resolution' },
        { status: 400 }
      );
    }

    // Validate resolution
    const validResolutions: TimeResolution[] = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json(
        { error: `Invalid resolution. Must be one of: ${validResolutions.join(', ')}` },
        { status: 400 }
      );
    }

    const trends = await getEmployeeTrends(
      id,
      start_date,
      end_date,
      resolution as TimeResolution,
      compare_period,
      exclude_sabbath || false
    );

    return NextResponse.json(trends);
  } catch (error) {
    console.error('[API /employees/[id]/trends] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
