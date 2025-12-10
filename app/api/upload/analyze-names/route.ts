import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeNamesForResolution } from '@/lib/matching/names';
import { ParsedHoursRow, ParsedArticleRow, NameAnalysisResult } from '@/types';

/**
 * POST /api/upload/analyze-names
 *
 * Analyze names before upload to identify conflicts
 * Returns auto-matched names and names that need manual resolution
 *
 * Request body:
 * {
 *   rows: ParsedHoursRow[] | ParsedArticleRow[],
 *   source: 'hours' | 'articles'
 * }
 *
 * Response:
 * {
 *   autoMatched: AutoMatchedName[],
 *   needsResolution: NameConflict[],
 *   totalUniqueNames: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rows, source } = body as {
      rows: ParsedHoursRow[] | ParsedArticleRow[];
      source: 'hours' | 'articles';
    };

    // Validate input
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty rows array' },
        { status: 400 }
      );
    }

    if (!source || !['hours', 'articles'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be "hours" or "articles"' },
        { status: 400 }
      );
    }

    console.log(`[API /analyze-names] Analyzing ${rows.length} ${source} rows`);

    // Extract unique names with row tracking
    const nameMap = new Map<string, number[]>();

    rows.forEach((row, idx) => {
      const fullName = row.fullName;
      if (!fullName) return;

      if (!nameMap.has(fullName)) {
        nameMap.set(fullName, []);
      }
      nameMap.get(fullName)!.push(idx + 1); // 1-indexed for user display
    });

    const uniqueNames = Array.from(nameMap.entries()).map(
      ([fullName, rowNumbers]) => ({
        fullName,
        rowNumbers,
        employeeNumber:
          source === 'hours'
            ? (rows as ParsedHoursRow[]).find((r) => r.fullName === fullName)
                ?.employeeNumber
            : undefined,
      })
    );

    console.log(
      `[API /analyze-names] Found ${uniqueNames.length} unique names from ${rows.length} rows`
    );

    // Analyze names (use admin client for server-side operations)
    const supabase = createAdminClient();
    const analysisResult: NameAnalysisResult = await analyzeNamesForResolution(
      uniqueNames,
      source,
      supabase
    );

    console.log(
      `[API /analyze-names] Result: ${analysisResult.autoMatched.length} auto-matched, ` +
        `${analysisResult.needsResolution.length} need resolution`
    );

    return NextResponse.json(analysisResult);
  } catch (error) {
    console.error('[API /analyze-names] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
