/**
 * ICE Analytics - Upload Server Functions
 *
 * NOTE: For simpler data operations without validation/parsing, see lib/supabase/operations.ts
 * operations.ts provides:
 * - batchUpsertHours: Direct hours upsert with business logic (latest wins)
 * - batchUpsertArticles: Direct articles upsert with business logic (MAX views)
 * - deleteHoursByDateRange / deleteArticlesByDateRange: Safe deletion with confirmation
 *
 * This file (upload-server.ts) provides:
 * - Full upload workflow with validation, parsing, error tracking
 * - Sophisticated Hebrew name matching and user confirmation
 * - Detailed error reporting for UI display
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  ParsedHoursRow,
  ParsedArticleRow,
  UpsertResult,
  EnhancedUploadResult,
  DetailedError,
  HoursWithoutArticlesWarning,
  ResolvedNameMap,
} from '@/types';
import { batchFindOrCreateEmployees, normalizeName } from '@/lib/matching/names';
import { NAME_MATCHING_CONFIG } from '@/lib/config/matching-thresholds';

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a string is a valid time format (HH:MM or HH:MM:SS)
 */
function isValidTimeFormat(value: string | undefined | null): boolean {
  if (!value) return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  return timeRegex.test(value.trim());
}

/**
 * Check if a date is valid (YYYY-MM-DD format)
 */
function isValidDateFormat(value: string | undefined | null): boolean {
  if (!value) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Extract status from entry/exit time if it's not a valid time
 * Hebrew status values: מחלה, חופש, מילואים, מחלת ילד, etc.
 */
function extractStatusFromTime(
  entryTime: string | undefined,
  exitTime: string | undefined,
  existingStatus: string | undefined
): string | undefined {
  if (existingStatus) return existingStatus;
  if (entryTime && !isValidTimeFormat(entryTime)) return entryTime;
  if (exitTime && !isValidTimeFormat(exitTime)) return exitTime;
  return undefined;
}

/**
 * Validate a single hours row and return detailed errors
 */
function validateHoursRow(
  row: ParsedHoursRow,
  rowIndex: number
): DetailedError[] {
  const errors: DetailedError[] = [];

  // Validate name
  if (!row.fullName || row.fullName.trim() === '') {
    errors.push({
      row: rowIndex,
      field: 'fullName',
      value: row.fullName || '',
      message: 'שם עובד חסר',
    });
  }

  // Validate date
  if (!row.date) {
    errors.push({
      row: rowIndex,
      field: 'date',
      value: '',
      message: 'תאריך חסר',
    });
  } else if (!isValidDateFormat(row.date)) {
    errors.push({
      row: rowIndex,
      field: 'date',
      value: row.date,
      message: 'פורמט תאריך לא תקין (צפוי: YYYY-MM-DD)',
    });
  }

  // Validate hours
  if (typeof row.hours !== 'number' || isNaN(row.hours)) {
    errors.push({
      row: rowIndex,
      field: 'hours',
      value: String(row.hours),
      message: 'שעות חייבות להיות מספר',
    });
  } else if (row.hours < 0) {
    errors.push({
      row: rowIndex,
      field: 'hours',
      value: String(row.hours),
      message: 'שעות לא יכולות להיות שליליות',
    });
  } else if (row.hours > 24) {
    errors.push({
      row: rowIndex,
      field: 'hours',
      value: String(row.hours),
      message: 'שעות לא יכולות לעלות על 24',
    });
  }

  return errors;
}

/**
 * Validate a single article row and return detailed errors
 */
function validateArticleRow(
  row: ParsedArticleRow,
  rowIndex: number
): DetailedError[] {
  const errors: DetailedError[] = [];

  // Validate name
  if (!row.fullName || row.fullName.trim() === '') {
    errors.push({
      row: rowIndex,
      field: 'fullName',
      value: row.fullName || '',
      message: 'שם כותב חסר',
    });
  }

  // Validate article ID
  if (!row.articleId || typeof row.articleId !== 'number' || isNaN(row.articleId)) {
    errors.push({
      row: rowIndex,
      field: 'articleId',
      value: String(row.articleId),
      message: 'מספר כתבה לא תקין',
    });
  }

  // Validate title
  if (!row.title || row.title.trim() === '') {
    errors.push({
      row: rowIndex,
      field: 'title',
      value: row.title || '',
      message: 'כותרת חסרה',
    });
  }

  // Validate views
  if (typeof row.views !== 'number' || isNaN(row.views) || row.views < 0) {
    errors.push({
      row: rowIndex,
      field: 'views',
      value: String(row.views),
      message: 'צפיות חייבות להיות מספר חיובי',
    });
  }

  // Validate published date
  if (!row.publishedAt) {
    errors.push({
      row: rowIndex,
      field: 'publishedAt',
      value: '',
      message: 'תאריך פרסום חסר',
    });
  }

  return errors;
}

// ============================================================================
// HOURS UPLOAD
// ============================================================================

/**
 * Server-side upload hours data with detailed validation and tracking
 * Uses admin client that bypasses RLS
 *
 * @param resolvedNameMap - Optional pre-resolved name→employee_id mapping from name resolution flow
 */
export async function uploadHoursDataServer(
  supabase: SupabaseClient,
  rows: ParsedHoursRow[],
  fileName: string,
  resolvedNameMap?: ResolvedNameMap
): Promise<EnhancedUploadResult> {
  const startTime = Date.now();
  const result: EnhancedUploadResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    detailedErrors: [],
    matchStats: { exactMatches: 0, fuzzyMatches: 0, newEmployees: 0 },
    processingTimeMs: 0,
    hoursWithoutArticles: [],
  };

  try {
    console.log(`[upload-server] Starting hours upload: ${rows.length} rows from ${fileName}`);

    // 1. VALIDATION PHASE
    const validRows: ParsedHoursRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowErrors = validateHoursRow(rows[i], i + 1);

      if (rowErrors.length > 0) {
        result.detailedErrors.push(...rowErrors);
        result.skipped++;
      } else {
        validRows.push(rows[i]);
      }
    }

    console.log(`[upload-server] Validation: ${validRows.length} valid, ${result.skipped} skipped`);

    if (validRows.length === 0) {
      result.errors.push('אין שורות תקינות לעיבוד');
      result.processingTimeMs = Date.now() - startTime;
      return result;
    }

    // 2. EMPLOYEE MATCHING PHASE
    let employeeMap: Map<string, string>;

    if (resolvedNameMap) {
      // Use pre-resolved name map (from name resolution flow)
      console.log(`[upload-server] ✅ Using pre-resolved name map: ${Object.keys(resolvedNameMap).length} names`);
      employeeMap = new Map(
        Object.entries(resolvedNameMap).map(([name, data]) => [name, data.employee_id])
      );
      console.log(`[upload-server] Employee map created from resolved names, size: ${employeeMap.size}`);

      // Track match stats
      result.matchStats.exactMatches = employeeMap.size;
    } else {
      // Fallback: Batch match employees (for backward compatibility or direct uploads without name resolution)
      const uniqueNames = [...new Set(validRows.map(r => r.fullName))].map(name => ({
        fullName: name,
        employeeNumber: validRows.find(r => r.fullName === name)?.employeeNumber,
      }));

      console.log(`[upload-server] ⚠️ No resolved name map provided, running batch matching for ${uniqueNames.length} names`);
      employeeMap = await batchFindOrCreateEmployees(uniqueNames, 'hours', supabase);

      // Track match stats
      result.matchStats.exactMatches = employeeMap.size; // Approximation
    }

    console.log(`[upload-server] 📊 Employee map ready: ${employeeMap.size} mappings available`);

    // 3. PREPARE RECORDS
    const records: Array<{
      employee_id: string;
      date: string;
      hours: number;
      status: string | null;
      entry_time: string | null;
      exit_time: string | null;
      updated_at: string;
    }> = [];

    for (const row of validRows) {
      const employeeId = employeeMap.get(row.fullName);

      if (!employeeId) {
        console.warn(`[upload-server] ⚠️ Skipping row ${rows.indexOf(row) + 1}: No employee_id found for "${row.fullName}"`);
        result.detailedErrors.push({
          row: rows.indexOf(row) + 1,
          field: 'fullName',
          value: row.fullName,
          message: 'לא נמצא עובד עם שם זה',
        });
        result.skipped++;
        continue;
      }

      const status = extractStatusFromTime(row.entryTime, row.exitTime, row.status);
      const entryTime = isValidTimeFormat(row.entryTime) ? row.entryTime! : null;
      const exitTime = isValidTimeFormat(row.exitTime) ? row.exitTime! : null;

      records.push({
        employee_id: employeeId,
        date: row.date,
        hours: row.hours,
        status: status ?? null,
        entry_time: entryTime,
        exit_time: exitTime,
        updated_at: new Date().toISOString(),
      });
    }

    console.log(`[upload-server] Prepared ${records.length} records (before deduplication)`);

    // 3.5. DEDUPLICATE AND AGGREGATE RECORDS
    // Group by employee_id + date and sum hours (handles multiple entries per day)
    const aggregatedMap = new Map<string, typeof records[0]>();

    for (const record of records) {
      const key = `${record.employee_id}:${record.date}`;
      const existing = aggregatedMap.get(key);

      if (existing) {
        // Aggregate: sum hours, keep earliest entry and latest exit
        existing.hours += record.hours;
        if (record.entry_time && (!existing.entry_time || record.entry_time < existing.entry_time)) {
          existing.entry_time = record.entry_time;
        }
        if (record.exit_time && (!existing.exit_time || record.exit_time > existing.exit_time)) {
          existing.exit_time = record.exit_time;
        }
        existing.updated_at = record.updated_at;
      } else {
        aggregatedMap.set(key, { ...record });
      }
    }

    const deduplicatedRecords = Array.from(aggregatedMap.values());
    const duplicatesRemoved = records.length - deduplicatedRecords.length;

    console.log(`[upload-server] After deduplication: ${deduplicatedRecords.length} records (removed ${duplicatesRemoved} duplicates)`);
    if (deduplicatedRecords.length > 0) {
      console.log(`[upload-server] Sample record:`, JSON.stringify(deduplicatedRecords[0], null, 2));
    }

    // Use deduplicated records from now on
    const finalRecords = deduplicatedRecords;

    // 4. CHECK EXISTING RECORDS
    const existingMap = new Map<string, boolean>();
    const employeeIds = [...new Set(finalRecords.map(r => r.employee_id))];
    const FETCH_CHUNK_SIZE = 1000;

    for (let i = 0; i < employeeIds.length; i += FETCH_CHUNK_SIZE) {
      const chunk = employeeIds.slice(i, i + FETCH_CHUNK_SIZE);
      const { data: existing } = await supabase
        .from('daily_hours')
        .select('employee_id, date')
        .in('employee_id', chunk);

      for (const record of existing || []) {
        existingMap.set(`${record.employee_id}:${record.date}`, true);
      }
    }

    console.log(`[upload-server] Found ${existingMap.size} existing records`);

    // 5. BATCH UPSERT
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(finalRecords.length / BATCH_SIZE);

    for (let i = 0; i < finalRecords.length; i += BATCH_SIZE) {
      const batch = finalRecords.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`[upload-server] Upserting batch ${batchNum}/${totalBatches}`);

      const { error } = await supabase
        .from('daily_hours')
        .upsert(batch, {
          onConflict: 'employee_id,date',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`[upload-server] ❌ Batch ${batchNum} upsert error:`, error);
        result.errors.push(`שגיאה באצווה ${batchNum}: ${error.message}`);
      } else {
        for (const record of batch) {
          const key = `${record.employee_id}:${record.date}`;
          if (existingMap.has(key)) {
            result.updated++;
          } else {
            result.inserted++;
            existingMap.set(key, true);
          }
        }
      }
    }

    // 5.5. VERIFICATION - Confirm records actually in database
    const employeeIdsToVerify = [...new Set(finalRecords.map(r => r.employee_id))];
    const datesToVerify = [...new Set(finalRecords.map(r => r.date))];
    const { count: actualCount, error: countError } = await supabase
      .from('daily_hours')
      .select('*', { count: 'exact', head: true })
      .in('employee_id', employeeIdsToVerify)
      .in('date', datesToVerify);

    if (!countError && actualCount !== null) {
      const expectedCount = result.inserted + result.updated;
      console.log(`[upload-server] VERIFICATION: ${actualCount} daily_hours records verified in database (expected: ${expectedCount})`);
      if (actualCount < expectedCount) {
        console.warn(`[upload-server] ⚠️ VERIFICATION WARNING: Expected ${expectedCount} but found ${actualCount} daily_hours records`);
        result.errors.push(`אימות: צפויות ${expectedCount} רשומות שעות אך נמצאו ${actualCount}`);
      }
    } else if (countError) {
      console.error(`[upload-server] VERIFICATION ERROR: ${countError.message}`);
    }

    // 6. LOG IMPORT
    const { error: logError } = await supabase.from('import_logs').insert({
      file_type: 'hours',
      file_name: fileName,
      rows_processed: rows.length,
      rows_inserted: result.inserted,
      rows_updated: result.updated,
      rows_skipped: result.skipped,
      errors: [
        ...result.errors,
        ...result.detailedErrors.map(e => `שורה ${e.row}: ${e.field} - ${e.message}`),
      ],
    });

    if (logError) {
      console.error(`[upload-server] Failed to log import: ${logError.message}`);
    }

    // 7. CHECK FOR HOURS WITHOUT ARTICLES (Warning only, not blocking)
    const employeeIdsWithHours = [...new Set(records.map(r => r.employee_id))];
    const datesRange = {
      start: records.reduce((min, r) => r.date < min ? r.date : min, records[0]?.date || ''),
      end: records.reduce((max, r) => r.date > max ? r.date : max, records[0]?.date || ''),
    };

    console.log(`[upload-server] Checking for hours without articles for ${employeeIdsWithHours.length} employees`);

    const { data: employeesWithArticles } = await supabase
      .from('articles')
      .select('employee_id')
      .in('employee_id', employeeIdsWithHours)
      .not('employee_id', 'is', null);

    const employeeIdsWithArticles = new Set(
      employeesWithArticles?.map(a => a.employee_id) || []
    );

    const employeeIdsWithoutArticles = employeeIdsWithHours.filter(
      id => !employeeIdsWithArticles.has(id)
    );

    if (employeeIdsWithoutArticles.length > 0) {
      // Fetch employee names and calculate total hours
      const { data: employees } = await supabase
        .from('employees')
        .select('id, canonical_name')
        .in('id', employeeIdsWithoutArticles);

      const warnings: HoursWithoutArticlesWarning[] = [];

      for (const emp of employees || []) {
        const empHours = records
          .filter(r => r.employee_id === emp.id)
          .reduce((sum, r) => sum + r.hours, 0);

        warnings.push({
          employee_id: emp.id,
          employee_name: emp.canonical_name,
          total_hours: empHours,
          date_range: datesRange,
        });
      }

      result.hoursWithoutArticles = warnings;
      console.log(`[upload-server] Found ${warnings.length} employees with hours but no articles`);
    }

    result.processingTimeMs = Date.now() - startTime;
    console.log(
      `[upload-server] Hours upload complete: ` +
      `${result.inserted} inserted, ${result.updated} updated, ` +
      `${result.skipped} skipped, ${result.errors.length} errors, ` +
      `${result.processingTimeMs}ms`
    );

  } catch (err) {
    const errorMsg = `העלאה נכשלה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`;
    console.error(`[upload-server] ${errorMsg}`);
    result.errors.push(errorMsg);
    result.processingTimeMs = Date.now() - startTime;
  }

  return result;
}

// ============================================================================
// ARTICLES UPLOAD
// ============================================================================

/**
 * Server-side upload articles data with detailed validation and tracking
 * Uses admin client that bypasses RLS
 *
 * @param resolvedNameMap - Optional pre-resolved name→employee_id mapping from name resolution flow
 */
export async function uploadArticlesDataServer(
  supabase: SupabaseClient,
  rows: ParsedArticleRow[],
  fileName: string,
  resolvedNameMap?: ResolvedNameMap
): Promise<EnhancedUploadResult> {
  const startTime = Date.now();
  const result: EnhancedUploadResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    detailedErrors: [],
    matchStats: { exactMatches: 0, fuzzyMatches: 0, newEmployees: 0 },
    processingTimeMs: 0,
    ignoredLowViewArticles: 0,
  };

  try {
    console.log(`[upload-server] Starting articles upload: ${rows.length} rows from ${fileName}`);

    // 1. VALIDATION PHASE
    const validRows: ParsedArticleRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowErrors = validateArticleRow(rows[i], i + 1);

      if (rowErrors.length > 0) {
        result.detailedErrors.push(...rowErrors);
        result.skipped++;
      } else {
        validRows.push(rows[i]);
      }
    }

    console.log(`[upload-server] Validation: ${validRows.length} valid, ${result.skipped} skipped`);

    if (validRows.length === 0) {
      result.errors.push('אין שורות תקינות לעיבוד');
      result.processingTimeMs = Date.now() - startTime;
      return result;
    }

    // 2. EMPLOYEE MATCHING PHASE
    let employeeMap: Map<string, string>;

    if (resolvedNameMap) {
      // Use pre-resolved name map (from name resolution flow)
      console.log(`[upload-server] ✅ Using pre-resolved name map for articles: ${Object.keys(resolvedNameMap).length} names`);
      employeeMap = new Map(
        Object.entries(resolvedNameMap).map(([name, data]) => [name, data.employee_id])
      );
      console.log(`[upload-server] Employee map created from resolved names, size: ${employeeMap.size}`);

      // Track match stats
      result.matchStats.exactMatches = employeeMap.size;
    } else {
      // Fallback: Batch match employees (for backward compatibility or direct uploads without name resolution)
      const uniqueNames = [...new Set(validRows.map(r => r.fullName))].map(name => ({
        fullName: name,
      }));

      console.log(`[upload-server] ⚠️ No resolved name map provided for articles, running batch matching for ${uniqueNames.length} names`);
      employeeMap = await batchFindOrCreateEmployees(uniqueNames, 'articles', supabase);

      // Track match stats
      result.matchStats.exactMatches = employeeMap.size;
    }

    console.log(`[upload-server] 📊 Employee map ready for articles: ${employeeMap.size} mappings available`);

    // 3. CHECK EXISTING ARTICLES AND GET THEIR VIEW COUNTS
    // PRD REQUIREMENT: Keep MAX(old_views, new_views) for cumulative tracking
    const articleIds = validRows.map(r => r.articleId);
    const { data: existingArticles } = await supabase
      .from('articles')
      .select('article_id, views')
      .in('article_id', articleIds);

    const existingViewsMap = new Map(
      existingArticles?.map(a => [a.article_id, a.views]) || []
    );

    console.log(`[upload-server] Found ${existingViewsMap.size} existing articles`);

    // 4. PREPARE RECORDS WITH MAX VIEWS LOGIC
    const unmatchedAuthors = new Set<string>();
    const records = validRows.map(row => {
      const existingViews = existingViewsMap.get(row.articleId);
      // PRD BUSINESS LOGIC: Keep highest view count (cumulative maximum)
      const finalViews = existingViews !== undefined
        ? Math.max(existingViews, row.views)
        : row.views;

      const employeeId = employeeMap.get(row.fullName);
      if (!employeeId) {
        unmatchedAuthors.add(row.fullName);
      }

      return {
        article_id: row.articleId,
        employee_id: employeeId || null,
        title: row.title,
        views: finalViews, // MAX(old_views, new_views)
        published_at: row.publishedAt,
        is_low_views: finalViews < NAME_MATCHING_CONFIG.LOW_VIEWS_THRESHOLD,
        updated_at: new Date().toISOString(),
      };
    });

    // Track unmatched authors as warnings (not errors - articles still inserted with null employee_id)
    if (unmatchedAuthors.size > 0) {
      console.warn(`[upload-server] ⚠️ ${unmatchedAuthors.size} authors not matched to employees: ${[...unmatchedAuthors].join(', ')}`);
      result.errors.push(`${unmatchedAuthors.size} כותבים לא הותאמו לעובדים: ${[...unmatchedAuthors].join(', ')}`);
    }

    // Count low-view articles for result
    result.ignoredLowViewArticles = records.filter(r => r.is_low_views).length;
    console.log(`[upload-server] Identified ${result.ignoredLowViewArticles} low-view articles (<${NAME_MATCHING_CONFIG.LOW_VIEWS_THRESHOLD} views)`);

    // 5. BATCH UPSERT
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`[upload-server] Upserting batch ${batchNum}/${totalBatches}`);

      const { error } = await supabase
        .from('articles')
        .upsert(batch, {
          onConflict: 'article_id',
          ignoreDuplicates: false,
        });

      if (error) {
        result.errors.push(`שגיאה באצווה ${batchNum}: ${error.message}`);
      } else {
        for (const record of batch) {
          if (existingViewsMap.has(record.article_id)) {
            result.updated++;
          } else {
            result.inserted++;
          }
        }
      }
    }

    // 6. VERIFICATION - Confirm records actually in database
    const articleIdsToVerify = records.map(r => r.article_id);
    const { count: actualCount, error: countError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .in('article_id', articleIdsToVerify);

    if (!countError && actualCount !== null) {
      const expectedCount = result.inserted + result.updated;
      console.log(`[upload-server] VERIFICATION: ${actualCount} articles verified in database (expected: ${expectedCount})`);
      if (actualCount < expectedCount) {
        console.warn(`[upload-server] ⚠️ VERIFICATION WARNING: Expected ${expectedCount} but found ${actualCount} articles`);
        result.errors.push(`אימות: צפויות ${expectedCount} כתבות אך נמצאו ${actualCount}`);
      }
    } else if (countError) {
      console.error(`[upload-server] VERIFICATION ERROR: ${countError.message}`);
    }

    // 7. LOG IMPORT
    const { error: logError } = await supabase.from('import_logs').insert({
      file_type: 'articles',
      file_name: fileName,
      rows_processed: rows.length,
      rows_inserted: result.inserted,
      rows_updated: result.updated,
      rows_skipped: result.skipped,
      errors: [
        ...result.errors,
        ...result.detailedErrors.map(e => `שורה ${e.row}: ${e.field} - ${e.message}`),
      ],
    });

    if (logError) {
      console.error(`[upload-server] Failed to log import: ${logError.message}`);
    }

    result.processingTimeMs = Date.now() - startTime;
    console.log(
      `[upload-server] Articles upload complete: ` +
      `${result.inserted} inserted, ${result.updated} updated, ` +
      `${result.skipped} skipped, ${result.errors.length} errors, ` +
      `${result.processingTimeMs}ms`
    );

  } catch (err) {
    const errorMsg = `העלאה נכשלה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`;
    console.error(`[upload-server] ${errorMsg}`);
    result.errors.push(errorMsg);
    result.processingTimeMs = Date.now() - startTime;
  }

  return result;
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy wrapper that returns UpsertResult for backward compatibility
 */
export async function uploadHoursDataServerLegacy(
  supabase: SupabaseClient,
  rows: ParsedHoursRow[],
  fileName: string
): Promise<UpsertResult> {
  const detailed = await uploadHoursDataServer(supabase, rows, fileName);
  return {
    inserted: detailed.inserted,
    updated: detailed.updated,
    skipped: detailed.skipped,
    errors: [
      ...detailed.errors,
      ...detailed.detailedErrors.map(e => `Row ${e.row}: ${e.field} - ${e.message}`),
    ],
  };
}

/**
 * Legacy wrapper that returns UpsertResult for backward compatibility
 */
export async function uploadArticlesDataServerLegacy(
  supabase: SupabaseClient,
  rows: ParsedArticleRow[],
  fileName: string
): Promise<UpsertResult> {
  const detailed = await uploadArticlesDataServer(supabase, rows, fileName);
  return {
    inserted: detailed.inserted,
    updated: detailed.updated,
    skipped: detailed.skipped,
    errors: [
      ...detailed.errors,
      ...detailed.detailedErrors.map(e => `Row ${e.row}: ${e.field} - ${e.message}`),
    ],
  };
}
