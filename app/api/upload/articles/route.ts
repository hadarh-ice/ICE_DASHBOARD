import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadArticlesDataServer } from '@/lib/queries/upload-server';
import { ParsedArticleRow } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { rows, fileName } = body as { rows: ParsedArticleRow[]; fileName: string };

    // Validate input
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'Missing or invalid rows array' },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No rows to upload' },
        { status: 400 }
      );
    }

    console.log(`[API /upload/articles] Received ${rows.length} rows from ${fileName || 'unknown'}`);

    // Create admin client (bypasses RLS)
    const supabase = createAdminClient();

    // Upload data
    const result = await uploadArticlesDataServer(supabase, rows, fileName || 'unknown');

    console.log(`[API /upload/articles] Result: ${result.inserted} inserted, ${result.updated} updated, ${result.errors.length} errors`);

    // Return result
    return NextResponse.json(result);

  } catch (error) {
    console.error('[API /upload/articles] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      },
      { status: 500 }
    );
  }
}
