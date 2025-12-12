import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadHoursDataServer } from '@/lib/queries/upload-server';
import { ParsedHoursRow, ResolvedNameMap } from '@/types';

// Maximum rows allowed per upload to prevent timeouts
const MAX_ROWS_PER_UPLOAD = 10000;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await request.json();
    const { rows, fileName, resolvedNames: resolvedNameMap } = body as {
      rows: ParsedHoursRow[];
      fileName: string;
      resolvedNames?: ResolvedNameMap;
    };

    // Validate input
    if (!rows || !Array.isArray(rows)) {
      console.error('[API /upload/hours] Invalid input: rows is not an array');
      return NextResponse.json(
        { error: 'Missing or invalid rows array' },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      console.error('[API /upload/hours] Invalid input: empty rows array');
      return NextResponse.json(
        { error: 'No rows to upload' },
        { status: 400 }
      );
    }

    // Prevent timeout on very large uploads
    if (rows.length > MAX_ROWS_PER_UPLOAD) {
      console.error(`[API /upload/hours] Too many rows: ${rows.length} > ${MAX_ROWS_PER_UPLOAD}`);
      return NextResponse.json(
        { error: `Too many rows. Maximum is ${MAX_ROWS_PER_UPLOAD.toLocaleString()} per upload. You have ${rows.length.toLocaleString()} rows.` },
        { status: 400 }
      );
    }

    console.log(`[API /upload/hours] 📥 Received upload request:`, {
      rowCount: rows.length,
      fileName: fileName || 'unknown',
      hasResolvedNames: !!resolvedNameMap,
      resolvedNamesCount: resolvedNameMap ? Object.keys(resolvedNameMap).length : 0,
    });

    // Create admin client (bypasses RLS)
    const supabase = createAdminClient();

    // Upload data with resolved name map (if provided)
    const result = await uploadHoursDataServer(
      supabase,
      rows,
      fileName || 'unknown',
      resolvedNameMap
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[API /upload/hours] Completed in ${duration}s: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);

    // Return result
    return NextResponse.json(result);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[API /upload/hours] Error after ${duration}s:`, error);
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
