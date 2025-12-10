/**
 * ICE Analytics - Supabase Data Operations
 *
 * Core data operations for ICE employee efficiency analytics.
 * Handles upserts, deletes, and batch operations with proper business logic.
 *
 * KEY BUSINESS RULES (from PRD):
 * - Articles: Keep MAX(old_views, new_views) when same article_id uploaded
 * - Hours: Latest upload wins for same employee+date
 * - Articles with views < 50 are marked as "low views" (excluded from metrics)
 * - All operations must be idempotent and handle large batches efficiently
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeName, normalizeForDisplay } from '@/lib/matching/names';
import { LOW_VIEWS_THRESHOLD } from '@/lib/config/matching-thresholds';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface EmployeeRecord {
  id: string;
  canonical_name: string;
  normalized_name: string;
  first_name: string;
  last_name: string;
  employee_number?: string | null;
}

export interface HoursInput {
  normalized_name: string; // Pre-normalized by caller
  date: string; // YYYY-MM-DD format
  hours: number;
  status?: string | null;
  entry_time?: string | null;
  exit_time?: string | null;
  notes?: string | null;
}

export interface ArticleInput {
  normalized_name: string; // Pre-normalized by caller
  article_id: number;
  title: string;
  views: number;
  published_at: string; // ISO datetime string
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface DeleteResult {
  deleted_count: number;
  errors: string[];
  log_id?: string; // import_logs ID for the deletion record
}

// ============================================================================
// EMPLOYEE OPERATIONS
// ============================================================================

/**
 * Find or create an employee by normalized name
 *
 * This is the foundation for all employee-related operations.
 * Uses normalized_name for matching to ensure consistency.
 *
 * @param supabase - Supabase client (must be admin client for server-side)
 * @param normalizedName - Already normalized name (lowercase, cleaned)
 * @param firstName - First name for display
 * @param lastName - Last name for display
 * @param employeeNumber - Optional employee number
 * @returns Employee record (existing or newly created)
 */
export async function upsertEmployee(
  supabase: SupabaseClient,
  normalizedName: string,
  firstName: string,
  lastName: string,
  employeeNumber?: string | null
): Promise<EmployeeRecord> {
  // First, try to find existing employee by normalized_name
  const { data: existing, error: selectError } = await supabase
    .from('employees')
    .select('*')
    .eq('normalized_name', normalizedName)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to query employee: ${selectError.message}`);
  }

  if (existing) {
    return existing as EmployeeRecord;
  }

  // Employee doesn't exist, create new one
  const canonicalName = normalizeForDisplay(`${firstName} ${lastName}`);

  const { data: newEmployee, error: insertError } = await supabase
    .from('employees')
    .insert({
      canonical_name: canonicalName,
      normalized_name: normalizedName,
      first_name: firstName,
      last_name: lastName,
      employee_number: employeeNumber || null,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create employee: ${insertError.message}`);
  }

  return newEmployee as EmployeeRecord;
}

// ============================================================================
// HOURS OPERATIONS
// ============================================================================

/**
 * Batch upsert hours records
 *
 * BUSINESS LOGIC:
 * - Latest upload wins for same employee+date (simple overwrite)
 * - Ensures employees exist or creates them
 * - Validates hours are in range 0-24 (database constraint enforces this)
 *
 * UPSERT STRATEGY:
 * ON CONFLICT (employee_id, date) DO UPDATE
 * - Overwrites all fields with new values
 * - No conditional logic (newest file assumed most accurate)
 *
 * @param supabase - Admin Supabase client
 * @param records - Array of hours records to upsert
 * @returns Result with inserted/updated counts and any errors
 */
export async function batchUpsertHours(
  supabase: SupabaseClient,
  records: HoursInput[]
): Promise<UpsertResult> {
  const result: UpsertResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  if (records.length === 0) {
    return result;
  }

  // Step 1: Get unique normalized names and ensure all employees exist
  const uniqueNames = [...new Set(records.map(r => r.normalized_name))];
  const employeeMap = new Map<string, string>(); // normalized_name -> employee_id

  for (const normalizedName of uniqueNames) {
    try {
      // Parse normalized name back to first/last for employee creation
      // This assumes normalized_name is "firstname lastname" format
      const parts = normalizedName.split(' ');
      const firstName = parts[0] || normalizedName;
      const lastName = parts.slice(1).join(' ') || '';

      const employee = await upsertEmployee(
        supabase,
        normalizedName,
        firstName,
        lastName
      );
      employeeMap.set(normalizedName, employee.id);
    } catch (error) {
      result.errors.push(
        `Failed to create/find employee ${normalizedName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Step 2: Check which records already exist to determine inserted vs updated
  const employeeIds = records
    .map(r => employeeMap.get(r.normalized_name))
    .filter(Boolean) as string[];

  const dates = records.map(r => r.date);

  const { data: existingRecords } = await supabase
    .from('daily_hours')
    .select('employee_id, date')
    .in('employee_id', employeeIds)
    .in('date', dates);

  const existingSet = new Set(
    existingRecords?.map(r => `${r.employee_id}:${r.date}`) || []
  );

  // Step 3: Prepare records for upsert
  const hoursToUpsert = records
    .map(record => {
      const employeeId = employeeMap.get(record.normalized_name);
      if (!employeeId) {
        result.skipped++;
        result.errors.push(`No employee found for ${record.normalized_name}`);
        return null;
      }

      const isUpdate = existingSet.has(`${employeeId}:${record.date}`);
      if (isUpdate) {
        result.updated++;
      } else {
        result.inserted++;
      }

      return {
        employee_id: employeeId,
        date: record.date,
        hours: record.hours,
        status: record.status || null,
        entry_time: record.entry_time || null,
        exit_time: record.exit_time || null,
        notes: record.notes || null,
      };
    })
    .filter(Boolean);

  // Step 4: Execute upsert
  if (hoursToUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('daily_hours')
      .upsert(hoursToUpsert, {
        onConflict: 'employee_id,date',
        ignoreDuplicates: false, // Always update on conflict
      });

    if (upsertError) {
      result.errors.push(`Batch upsert failed: ${upsertError.message}`);
    }
  }

  return result;
}

/**
 * Delete hours by date range
 *
 * SAFETY FEATURES:
 * - Requires explicit confirmation flag
 * - Requires both start and end dates
 * - Logs deletion to import_logs for audit trail
 *
 * @param supabase - Admin Supabase client
 * @param startDate - Start date (YYYY-MM-DD) inclusive
 * @param endDate - End date (YYYY-MM-DD) inclusive
 * @param confirmed - Must be true to execute deletion
 * @param uploadedBy - Optional user ID for audit log
 * @returns Result with deleted count and errors
 */
export async function deleteHoursByDateRange(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
  confirmed: boolean,
  uploadedBy?: string
): Promise<DeleteResult> {
  const result: DeleteResult = {
    deleted_count: 0,
    errors: [],
  };

  // Safety check: confirmation required
  if (!confirmed) {
    result.errors.push('Deletion not confirmed. Pass confirmed=true to proceed.');
    return result;
  }

  // Safety check: both dates required
  if (!startDate || !endDate) {
    result.errors.push('Both startDate and endDate are required.');
    return result;
  }

  // Safety check: validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    result.errors.push('Dates must be in YYYY-MM-DD format.');
    return result;
  }

  // Safety check: reasonable range
  if (startDate > endDate) {
    result.errors.push('startDate cannot be after endDate.');
    return result;
  }

  try {
    // Count records to be deleted (for logging)
    const { count: beforeCount, error: countError } = await supabase
      .from('daily_hours')
      .select('*', { count: 'exact', head: true })
      .gte('date', startDate)
      .lte('date', endDate);

    if (countError) {
      result.errors.push(`Failed to count records: ${countError.message}`);
      return result;
    }

    // Execute deletion
    const { error: deleteError } = await supabase
      .from('daily_hours')
      .delete()
      .gte('date', startDate)
      .lte('date', endDate);

    if (deleteError) {
      result.errors.push(`Deletion failed: ${deleteError.message}`);
      return result;
    }

    result.deleted_count = beforeCount || 0;

    // Log the deletion to import_logs
    const { data: logData, error: logError } = await supabase
      .from('import_logs')
      .insert({
        file_type: 'hours',
        file_name: `[DELETE] Hours ${startDate} to ${endDate}`,
        rows_processed: result.deleted_count,
        rows_inserted: 0,
        rows_updated: 0,
        rows_skipped: result.deleted_count,
        errors: [],
        uploaded_by: uploadedBy || null,
      })
      .select('id')
      .single();

    if (!logError && logData) {
      result.log_id = logData.id;
    }
  } catch (error) {
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

// ============================================================================
// ARTICLES OPERATIONS
// ============================================================================

/**
 * Batch upsert articles records
 *
 * BUSINESS LOGIC:
 * - Keep MAX(old_views, new_views) when same article_id uploaded
 * - Auto-marks is_low_views = (views < 50)
 * - Articles with views < 50 are excluded from metrics
 *
 * UPSERT STRATEGY:
 * ON CONFLICT (article_id) DO UPDATE SET views = GREATEST(articles.views, EXCLUDED.views)
 * - Tracks cumulative maximum views ever reached
 * - Handles case where older export has higher views than newer one
 *
 * @param supabase - Admin Supabase client
 * @param records - Array of article records to upsert
 * @returns Result with inserted/updated counts and any errors
 */
export async function batchUpsertArticles(
  supabase: SupabaseClient,
  records: ArticleInput[]
): Promise<UpsertResult> {
  const result: UpsertResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  if (records.length === 0) {
    return result;
  }

  // Step 1: Get unique normalized names and ensure all employees exist
  const uniqueNames = [...new Set(records.map(r => r.normalized_name))];
  const employeeMap = new Map<string, string>(); // normalized_name -> employee_id

  for (const normalizedName of uniqueNames) {
    try {
      const parts = normalizedName.split(' ');
      const firstName = parts[0] || normalizedName;
      const lastName = parts.slice(1).join(' ') || '';

      const employee = await upsertEmployee(
        supabase,
        normalizedName,
        firstName,
        lastName
      );
      employeeMap.set(normalizedName, employee.id);
    } catch (error) {
      result.errors.push(
        `Failed to create/find employee ${normalizedName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Step 2: Check which articles already exist
  const articleIds = records.map(r => r.article_id);

  const { data: existingArticles } = await supabase
    .from('articles')
    .select('article_id, views')
    .in('article_id', articleIds);

  const existingMap = new Map(
    existingArticles?.map(a => [a.article_id, a.views]) || []
  );

  // Step 3: Prepare articles for upsert with MAX logic
  const articlesToUpsert = records
    .map(record => {
      const employeeId = employeeMap.get(record.normalized_name);
      if (!employeeId) {
        result.skipped++;
        result.errors.push(
          `No employee found for ${record.normalized_name} (article ${record.article_id})`
        );
        return null;
      }

      const existingViews = existingMap.get(record.article_id);
      const isUpdate = existingViews !== undefined;

      // Determine final view count: MAX of old and new
      const finalViews = isUpdate
        ? Math.max(existingViews, record.views)
        : record.views;

      if (isUpdate) {
        result.updated++;
      } else {
        result.inserted++;
      }

      return {
        article_id: record.article_id,
        employee_id: employeeId,
        title: record.title,
        views: finalViews,
        is_low_views: finalViews < LOW_VIEWS_THRESHOLD,
        published_at: record.published_at,
      };
    })
    .filter(Boolean);

  // Step 4: Execute upsert
  if (articlesToUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('articles')
      .upsert(articlesToUpsert, {
        onConflict: 'article_id',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      result.errors.push(`Batch upsert failed: ${upsertError.message}`);
    }
  }

  return result;
}

/**
 * Delete articles by published date range
 *
 * SAFETY FEATURES:
 * - Requires explicit confirmation flag
 * - Requires both start and end dates
 * - Logs deletion to import_logs for audit trail
 *
 * @param supabase - Admin Supabase client
 * @param startDate - Start date (YYYY-MM-DD) inclusive
 * @param endDate - End date (YYYY-MM-DD) inclusive
 * @param confirmed - Must be true to execute deletion
 * @param uploadedBy - Optional user ID for audit log
 * @returns Result with deleted count and errors
 */
export async function deleteArticlesByDateRange(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
  confirmed: boolean,
  uploadedBy?: string
): Promise<DeleteResult> {
  const result: DeleteResult = {
    deleted_count: 0,
    errors: [],
  };

  // Safety check: confirmation required
  if (!confirmed) {
    result.errors.push('Deletion not confirmed. Pass confirmed=true to proceed.');
    return result;
  }

  // Safety check: both dates required
  if (!startDate || !endDate) {
    result.errors.push('Both startDate and endDate are required.');
    return result;
  }

  // Safety check: validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    result.errors.push('Dates must be in YYYY-MM-DD format.');
    return result;
  }

  // Safety check: reasonable range
  if (startDate > endDate) {
    result.errors.push('startDate cannot be after endDate.');
    return result;
  }

  try {
    // Count records to be deleted (for logging)
    const { count: beforeCount, error: countError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .gte('published_at', `${startDate}T00:00:00`)
      .lte('published_at', `${endDate}T23:59:59`);

    if (countError) {
      result.errors.push(`Failed to count records: ${countError.message}`);
      return result;
    }

    // Execute deletion
    const { error: deleteError } = await supabase
      .from('articles')
      .delete()
      .gte('published_at', `${startDate}T00:00:00`)
      .lte('published_at', `${endDate}T23:59:59`);

    if (deleteError) {
      result.errors.push(`Deletion failed: ${deleteError.message}`);
      return result;
    }

    result.deleted_count = beforeCount || 0;

    // Log the deletion to import_logs
    const { data: logData, error: logError } = await supabase
      .from('import_logs')
      .insert({
        file_type: 'articles',
        file_name: `[DELETE] Articles ${startDate} to ${endDate}`,
        rows_processed: result.deleted_count,
        rows_inserted: 0,
        rows_updated: 0,
        rows_skipped: result.deleted_count,
        errors: [],
        uploaded_by: uploadedBy || null,
      })
      .select('id')
      .single();

    if (!logError && logData) {
      result.log_id = logData.id;
    }
  } catch (error) {
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}
