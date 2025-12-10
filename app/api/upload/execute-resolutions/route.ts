import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { executeNameResolutions } from '@/lib/matching/names';
import {
  NameResolution,
  AutoMatchedName,
  ResolvedNameMap,
} from '@/types';

/**
 * POST /api/upload/execute-resolutions
 *
 * Execute user's name resolution decisions
 * Creates employees and aliases based on user confirmations
 * Returns final name mapping (input name → employee_id)
 *
 * Request body:
 * {
 *   resolutions: NameResolution[],      // User's manual decisions
 *   autoMatched: AutoMatchedName[],     // Previously auto-matched names
 *   source: 'hours' | 'articles'
 * }
 *
 * Response:
 * {
 *   [inputName: string]: {
 *     employee_id: string,
 *     confirmed_by_user: boolean
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resolutions, autoMatched, source } = body as {
      resolutions: NameResolution[];
      autoMatched: AutoMatchedName[];
      source: 'hours' | 'articles';
    };

    // Validate input
    if (!resolutions || !Array.isArray(resolutions)) {
      return NextResponse.json(
        { error: 'Invalid or missing resolutions array' },
        { status: 400 }
      );
    }

    if (!autoMatched || !Array.isArray(autoMatched)) {
      return NextResponse.json(
        { error: 'Invalid or missing autoMatched array' },
        { status: 400 }
      );
    }

    if (!source || !['hours', 'articles'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be "hours" or "articles"' },
        { status: 400 }
      );
    }

    console.log(
      `[API /execute-resolutions] Processing ${resolutions.length} resolutions + ` +
        `${autoMatched.length} auto-matched for ${source}`
    );

    const supabase = createAdminClient();

    // Execute resolutions (creates aliases + employees)
    const resolvedMap = await executeNameResolutions(
      resolutions,
      source,
      supabase
    );

    // Combine with auto-matched names into final mapping
    const finalMap: ResolvedNameMap = {};

    // Add auto-matched names first
    for (const match of autoMatched) {
      finalMap[match.inputName] = {
        employee_id: match.employee_id,
        confirmed_by_user: match.matchType === 'user-confirmed',
      };
    }

    // Add manually resolved names (may override if same name)
    for (const [name, empId] of resolvedMap.entries()) {
      const resolution = resolutions.find((r) => r.inputName === name);
      finalMap[name] = {
        employee_id: empId,
        confirmed_by_user: resolution?.confirmed_by_user || false,
      };
    }

    console.log(
      `[API /execute-resolutions] Complete: ${Object.keys(finalMap).length} names mapped`
    );

    return NextResponse.json(finalMap);
  } catch (error) {
    console.error('[API /execute-resolutions] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
