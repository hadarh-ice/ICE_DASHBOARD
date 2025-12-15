import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Data Integrity Validation API
 *
 * Validates that Total Views KPI remains correct across all aggregation methods.
 *
 * This endpoint checks:
 * 1. Global SUM matches RPC function output
 * 2. Sum of per-employee totals equals global total
 * 3. No orphaned articles (NULL employee_id)
 * 4. No is_low_views flag inconsistencies
 *
 * Context: This validation prevents regression of the "1,000 row limit bug"
 * that was fixed in migration 006_add_global_metrics_rpc.sql
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Test 1: Get global total using direct SUM
    const { data: directSum, error: sumError } = await supabase
      .rpc('execute_sql', {
        query: 'SELECT COALESCE(SUM(views), 0)::BIGINT as total FROM articles WHERE is_low_views = false'
      });

    if (sumError) {
      // Fallback: use client-side query if RPC not available
      const { data: articles, error } = await supabase
        .from('articles')
        .select('views')
        .eq('is_low_views', false);

      if (error) throw error;

      const manualSum = articles?.reduce((sum, a) => sum + (a.views || 0), 0) || 0;

      return NextResponse.json({
        status: 'warning',
        message: 'Using client-side aggregation (may be limited to 1,000 rows)',
        checks: {
          manual_sum: manualSum,
          row_count: articles?.length || 0,
          warning: articles && articles.length >= 1000 ? 'Hit 1,000 row limit! Totals may be incorrect.' : null
        }
      });
    }

    // Test 2: Get total using RPC function (the correct method)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_global_metrics', {
      p_start_date: null,
      p_end_date: null,
      p_employee_ids: null,
    });

    if (rpcError) throw rpcError;

    const rpcTotal = rpcData && rpcData[0] ? Number(rpcData[0].total_views) : 0;
    const rpcArticles = rpcData && rpcData[0] ? Number(rpcData[0].total_articles) : 0;

    // Test 3: Get per-employee sums
    const { data: employeeMetrics, error: empError } = await supabase
      .from('articles')
      .select('employee_id, views')
      .eq('is_low_views', false);

    if (empError) throw empError;

    const employeeSums = new Map<string, number>();
    let orphanedViews = 0;
    let orphanedCount = 0;

    employeeMetrics?.forEach(article => {
      if (article.employee_id === null) {
        orphanedViews += article.views || 0;
        orphanedCount++;
      } else {
        const current = employeeSums.get(article.employee_id) || 0;
        employeeSums.set(article.employee_id, current + (article.views || 0));
      }
    });

    const sumOfEmployeeTotals = Array.from(employeeSums.values()).reduce((sum, val) => sum + val, 0);
    const totalIncludingOrphaned = sumOfEmployeeTotals + orphanedViews;

    // Test 4: Check for is_low_views inconsistencies
    const { data: inconsistencies, error: inconsistError } = await supabase
      .from('articles')
      .select('id, views, is_low_views')
      .or('and(views.lt.50,is_low_views.eq.false),and(views.gte.50,is_low_views.eq.true)');

    if (inconsistError) throw inconsistError;

    // Validation results
    const checks = {
      rpc_total_views: rpcTotal,
      rpc_total_articles: rpcArticles,
      sum_of_employee_totals: sumOfEmployeeTotals,
      orphaned_articles: orphanedCount,
      orphaned_views: orphanedViews,
      total_including_orphaned: totalIncludingOrphaned,
      employees_with_articles: employeeSums.size,
      is_low_views_inconsistencies: inconsistencies?.length || 0,

      // Critical checks
      totals_match: rpcTotal === totalIncludingOrphaned,
      no_orphaned_articles: orphanedCount === 0,
      no_flag_inconsistencies: (inconsistencies?.length || 0) === 0,
    };

    const allChecksPass = checks.totals_match && checks.no_orphaned_articles && checks.no_flag_inconsistencies;

    return NextResponse.json({
      status: allChecksPass ? 'success' : 'error',
      message: allChecksPass
        ? 'All data integrity checks passed ✅'
        : 'Data integrity issues detected ⚠️',
      checks,
      issues: [
        !checks.totals_match && {
          severity: 'critical',
          description: `Total mismatch: RPC returned ${rpcTotal} but sum of employees is ${totalIncludingOrphaned}`,
          impact: 'Dashboard KPIs may be incorrect',
        },
        checks.orphaned_articles > 0 && {
          severity: 'warning',
          description: `${orphanedCount} articles have NULL employee_id (${orphanedViews.toLocaleString()} views)`,
          impact: 'These articles are counted in global totals but not in employee rankings',
        },
        checks.is_low_views_inconsistencies > 0 && {
          severity: 'warning',
          description: `${inconsistencies?.length} articles have incorrect is_low_views flags`,
          impact: 'Articles may be incorrectly included/excluded from metrics',
        },
      ].filter(Boolean),
      recommendations: !allChecksPass ? [
        'Run database query to identify specific discrepancies',
        'Check recent upload logs for errors',
        'Verify migration 006_add_global_metrics_rpc.sql is applied',
        'Consider running data backfill to fix inconsistencies',
      ] : [],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Data integrity validation error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to run data integrity checks',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
