/**
 * Data Integrity Validation Utilities
 *
 * Ensures Total Views KPI remains accurate across all aggregation methods.
 *
 * Background: Migration 006 fixed a critical bug where client-side aggregation
 * hit Supabase's 1,000 row limit, causing severe underreporting of totals.
 * These utilities prevent regression.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DataIntegrityReport {
  isValid: boolean;
  rpcTotalViews: number;
  rpcTotalArticles: number;
  sumOfEmployeeTotals: number;
  orphanedArticles: number;
  orphanedViews: number;
  employeesWithArticles: number;
  inconsistentFlags: number;
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    description: string;
    impact: string;
  }>;
  timestamp: string;
}

/**
 * Comprehensive data integrity validation
 *
 * Checks that:
 * 1. RPC total matches sum of per-employee totals
 * 2. No orphaned articles (NULL employee_id)
 * 3. No is_low_views flag inconsistencies
 */
export async function validateDataIntegrity(
  supabase: SupabaseClient<any>
): Promise<DataIntegrityReport> {
  const issues: DataIntegrityReport['issues'] = [];

  // Check 1: Get RPC total (server-side aggregation)
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_global_metrics', {
    p_start_date: null,
    p_end_date: null,
    p_employee_ids: null,
  } as any);

  if (rpcError) {
    issues.push({
      severity: 'critical',
      description: `RPC function failed: ${rpcError.message}`,
      impact: 'Cannot validate totals. Dashboard KPIs may be incorrect.',
    });
  }

  const rpcTotalViews = rpcData && rpcData[0] ? Number(rpcData[0].total_views) : 0;
  const rpcTotalArticles = rpcData && rpcData[0] ? Number(rpcData[0].total_articles) : 0;

  // Check 2: Get all articles and compute per-employee sums
  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('employee_id, views, is_low_views')
    .eq('is_low_views', false);

  if (articlesError) {
    issues.push({
      severity: 'critical',
      description: `Failed to fetch articles: ${articlesError.message}`,
      impact: 'Cannot validate data integrity.',
    });
  }

  const employeeSums = new Map<string, number>();
  let orphanedViews = 0;
  let orphanedCount = 0;

  articles?.forEach(article => {
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

  // Check 3: Verify totals match
  if (rpcTotalViews !== totalIncludingOrphaned) {
    issues.push({
      severity: 'critical',
      description: `Total views mismatch: RPC returned ${rpcTotalViews.toLocaleString()} but sum of employees is ${totalIncludingOrphaned.toLocaleString()} (diff: ${Math.abs(rpcTotalViews - totalIncludingOrphaned).toLocaleString()})`,
      impact: 'Dashboard displays incorrect Total Views KPI. Data aggregation is broken.',
    });
  }

  // Check 4: Warn about orphaned articles
  if (orphanedCount > 0) {
    issues.push({
      severity: 'warning',
      description: `${orphanedCount} articles have NULL employee_id, representing ${orphanedViews.toLocaleString()} views`,
      impact: 'These articles are included in global totals but NOT in employee rankings. May indicate name matching failures during upload.',
    });
  }

  // Check 5: Verify is_low_views flag consistency
  const { data: inconsistentArticles, error: inconsistError } = await supabase
    .from('articles')
    .select('id, article_id, views, is_low_views')
    .or('and(views.lt.50,is_low_views.eq.false),and(views.gte.50,is_low_views.eq.true)');

  if (inconsistError) {
    issues.push({
      severity: 'warning',
      description: `Failed to check is_low_views consistency: ${inconsistError.message}`,
      impact: 'Cannot verify flag accuracy.',
    });
  }

  const inconsistentCount = inconsistentArticles?.length || 0;
  if (inconsistentCount > 0) {
    issues.push({
      severity: 'warning',
      description: `${inconsistentCount} articles have incorrect is_low_views flags`,
      impact: 'Articles may be incorrectly included/excluded from KPI calculations. Run: UPDATE articles SET is_low_views = (views < 50);',
    });
  }

  return {
    isValid: issues.filter(i => i.severity === 'critical').length === 0,
    rpcTotalViews,
    rpcTotalArticles,
    sumOfEmployeeTotals,
    orphanedArticles: orphanedCount,
    orphanedViews,
    employeesWithArticles: employeeSums.size,
    inconsistentFlags: inconsistentCount,
    issues,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Quick validation for upload scripts
 *
 * Returns true if data is valid, logs errors if not
 */
export async function quickValidate(
  supabase: SupabaseClient<any>,
  context: string = 'Data validation'
): Promise<boolean> {
  console.log(`\n🔍 ${context}...`);

  const report = await validateDataIntegrity(supabase);

  if (report.isValid) {
    console.log(`✅ Data integrity validated`);
    console.log(`   Total Views: ${report.rpcTotalViews.toLocaleString()}`);
    console.log(`   Total Articles: ${report.rpcTotalArticles.toLocaleString()}`);
    console.log(`   Employees: ${report.employeesWithArticles}`);

    if (report.issues.length > 0) {
      console.log(`\n⚠️  Non-critical issues:`);
      report.issues.forEach(issue => {
        console.log(`   [${issue.severity.toUpperCase()}] ${issue.description}`);
      });
    }

    return true;
  } else {
    console.error(`\n❌ DATA INTEGRITY VALIDATION FAILED`);
    console.error(`   RPC Total: ${report.rpcTotalViews.toLocaleString()}`);
    console.error(`   Sum of Employees: ${report.sumOfEmployeeTotals.toLocaleString()}`);
    console.error(`   Orphaned Views: ${report.orphanedViews.toLocaleString()}`);

    console.error(`\n🚨 Critical Issues:`);
    report.issues.forEach(issue => {
      console.error(`   [${issue.severity.toUpperCase()}] ${issue.description}`);
      console.error(`      Impact: ${issue.impact}`);
    });

    return false;
  }
}

/**
 * Validate after filtering by specific criteria
 *
 * Ensures filtered totals also match expected sums
 */
export async function validateFilteredMetrics(
  supabase: SupabaseClient<any>,
  filters: {
    startDate?: string;
    endDate?: string;
    employeeIds?: string[];
  }
): Promise<boolean> {
  const { data: rpcData, error } = await supabase.rpc('get_global_metrics', {
    p_start_date: filters.startDate || null,
    p_end_date: filters.endDate || null,
    p_employee_ids: filters.employeeIds && filters.employeeIds.length > 0 ? filters.employeeIds : null,
  } as any);

  if (error) {
    console.error(`❌ RPC error with filters:`, error.message);
    return false;
  }

  const rpcTotal = rpcData && rpcData[0] ? Number(rpcData[0].total_views) : 0;

  // Manually compute filtered total
  let query = supabase
    .from('articles')
    .select('views')
    .eq('is_low_views', false);

  if (filters.startDate) {
    query = query.gte('published_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('published_at', filters.endDate + 'T23:59:59');
  }
  if (filters.employeeIds && filters.employeeIds.length > 0) {
    query = query.in('employee_id', filters.employeeIds);
  }

  const { data: articles, error: articlesError } = await query;

  if (articlesError) {
    console.error(`❌ Manual query error:`, articlesError.message);
    return false;
  }

  const manualTotal = articles?.reduce((sum, a) => sum + (a.views || 0), 0) || 0;

  if (rpcTotal !== manualTotal) {
    console.error(`❌ Filtered totals mismatch:`);
    console.error(`   RPC: ${rpcTotal.toLocaleString()}`);
    console.error(`   Manual: ${manualTotal.toLocaleString()}`);
    console.error(`   Filters:`, filters);
    return false;
  }

  console.log(`✅ Filtered metrics validated: ${rpcTotal.toLocaleString()} views`);
  return true;
}
