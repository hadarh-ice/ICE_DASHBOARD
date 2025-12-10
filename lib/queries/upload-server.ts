import { SupabaseClient } from '@supabase/supabase-js';
import {
  ParsedHoursRow,
  ParsedArticleRow,
  UpsertResult,
  EnhancedUploadResult,
  DetailedError,
  HoursWithoutArticlesWarning,
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
 */
export async function uploadHoursDataServer(
  supabase: SupabaseClient,
  rows: ParsedHoursRow[],
  fileName: string
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
    const uniqueNames = [...new Set(validRows.map(r => r.fullName))].map(name => ({
      fullName: name,
      employeeNumber: validRows.find(r => r.fullName === name)?.employeeNumber,
    }));

    console.log(`[upload-server] Matching ${uniqueNames.length} unique employee names`);

    const employeeMap = await batchFindOrCreateEmployees(uniqueNames, 'hours', supabase);

    // Track match stats
    result.matchStats.exactMatches = employeeMap.size; // Approximation

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

    console.log(`[upload-server] Prepared ${records.length} records for upsert`);

    // 4. CHECK EXISTING RECORDS
    const existingMap = new Map<string, boolean>();
    const employeeIds = [...new Set(records.map(r => r.employee_id))];
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
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`[upload-server] Upserting batch ${batchNum}/${totalBatches}`);

      const { error } = await supabase
        .from('daily_hours')
        .upsert(batch, {
          onConflict: 'employee_id,date',
          ignoreDuplicates: false,
        });

      if (error) {
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
 */
export async function uploadArticlesDataServer(
  supabase: SupabaseClient,
  rows: ParsedArticleRow[],
  fileName: string
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
    const uniqueNames = [...new Set(validRows.map(r => r.fullName))].map(name => ({
      fullName: name,
    }));

    console.log(`[upload-server] Matching ${uniqueNames.length} unique employee names`);

    const employeeMap = await batchFindOrCreateEmployees(uniqueNames, 'articles', supabase);

    result.matchStats.exactMatches = employeeMap.size;

    // 3. CHECK EXISTING ARTICLES
    const articleIds = validRows.map(r => r.articleId);
    const { data: existingArticles } = await supabase
      .from('articles')
      .select('article_id')
      .in('article_id', articleIds);

    const existingIds = new Set(existingArticles?.map(a => a.article_id) || []);

    console.log(`[upload-server] Found ${existingIds.size} existing articles`);

    // 4. PREPARE RECORDS
    const records = validRows.map(row => ({
      article_id: row.articleId,
      employee_id: employeeMap.get(row.fullName) || null,
      title: row.title,
      views: row.views,
      published_at: row.publishedAt,
      is_low_views: row.isLowViews || row.views < NAME_MATCHING_CONFIG.LOW_VIEWS_THRESHOLD,
      updated_at: new Date().toISOString(),
    }));

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
          if (existingIds.has(record.article_id)) {
            result.updated++;
          } else {
            result.inserted++;
          }
        }
      }
    }

    // 6. LOG IMPORT
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
