import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { deleteDataByDateRange } from '@/lib/queries/delete-data';
import { DeleteDataRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // 1. CHECK AUTHENTICATION
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[API /delete-data] Request from user: ${user.email}`);

    // 2. PARSE AND VALIDATE REQUEST
    const body = await request.json();
    const { type, startDate, endDate } = body as DeleteDataRequest;

    // Validate type
    if (!type || !['hours', 'articles', 'both'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "hours", "articles", or "both"' },
        { status: 400 }
      );
    }

    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing startDate or endDate' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (end < start) {
      return NextResponse.json(
        { error: 'endDate must be greater than or equal to startDate' },
        { status: 400 }
      );
    }

    console.log(`[API /delete-data] Deleting ${type} from ${startDate} to ${endDate}`);

    // 3. CREATE ADMIN CLIENT AND EXECUTE DELETE
    const adminSupabase = createAdminClient();
    const result = await deleteDataByDateRange(adminSupabase, { type, startDate, endDate });

    // 4. RETURN RESULT
    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }

  } catch (error) {
    console.error('[API /delete-data] Error:', error);
    return NextResponse.json(
      {
        success: false,
        deletedHours: 0,
        deletedArticles: 0,
        errors: [error instanceof Error ? error.message : 'Internal server error'],
        processingTimeMs: 0,
      },
      { status: 500 }
    );
  }
}
