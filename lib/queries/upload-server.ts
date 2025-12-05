import { SupabaseClient } from '@supabase/supabase-js';
import { ParsedHoursRow, ParsedArticleRow, UpsertResult } from '@/types';
import { batchFindOrCreateEmployees } from '@/lib/matching/names';

/**
 * Check if a string is a valid time format (HH:MM or HH:MM:SS)
 */
function isValidTimeFormat(value: string | undefined | null): boolean {
  if (!value) return false;
  // Match HH:MM or HH:MM:SS format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  return timeRegex.test(value.trim());
}

/**
 * Extract status from entry/exit time if it's not a valid time
 * Hebrew status values: מחלה, חופש, מילואים, מחלת ילד, etc.
 */
function extractStatusFromTime(entryTime: string | undefined, exitTime: string | undefined, existingStatus: string | undefined): string | undefined {
  // If we already have a status, use it
  if (existingStatus) return existingStatus;

  // Check if entry or exit time contains status text (not a valid time)
  if (entryTime && !isValidTimeFormat(entryTime)) {
    return entryTime;
  }
  if (exitTime && !isValidTimeFormat(exitTime)) {
    return exitTime;
  }

  return undefined;
}

/**
 * Server-side upload hours data with UPSERT
 * Uses admin client that bypasses RLS
 * Always updates existing records (replaces old row-by-row deduplication)
 */
export async function uploadHoursDataServer(
  supabase: SupabaseClient,
  rows: ParsedHoursRow[],
  fileName: string
): Promise<UpsertResult> {
  const result: UpsertResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log(`[upload-server] Starting upload of ${rows.length} rows from ${fileName}`);

    // 1. Batch find/create employees using admin client
    const uniqueNames = [...new Set(rows.map(r => r.fullName))].map(name => ({
      fullName: name,
      employeeNumber: rows.find(r => r.fullName === name)?.employeeNumber,
    }));

    console.log(`[upload-server] Processing ${uniqueNames.length} unique employees`);

    const employeeMap = await batchFindOrCreateEmployees(uniqueNames, 'hours', supabase);

    console.log(`[upload-server] Employee map created with ${employeeMap.size} entries`);

    // 2. Prepare records for upsert, filtering out rows without employee mapping
    const records: Array<{
      employee_id: string;
      date: string;
      hours: number;
      status: string | null;
      entry_time: string | null;
      exit_time: string | null;
      updated_at: string;
    }> = [];

    for (const row of rows) {
      const employeeId = employeeMap.get(row.fullName);

      if (!employeeId) {
        const errorMsg = `Failed to find/create employee: ${row.fullName}`;
        console.error(`[upload-server] ${errorMsg}`);
        result.errors.push(errorMsg);
        continue;
      }

      // Extract status from entry/exit time if they contain status text
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

    // 3. Get existing records to accurately count inserts vs updates
    const existingMap = new Map<string, boolean>();
    const FETCH_CHUNK_SIZE = 1000;

    // Get unique employee IDs and dates from our records
    const employeeIds = [...new Set(records.map(r => r.employee_id))];

    for (let i = 0; i < employeeIds.length; i += FETCH_CHUNK_SIZE) {
      const employeeChunk = employeeIds.slice(i, i + FETCH_CHUNK_SIZE);

      const { data: existingRecords, error: fetchError } = await supabase
        .from('daily_hours')
        .select('employee_id, date')
        .in('employee_id', employeeChunk);

      if (fetchError) {
        console.error(`[upload-server] Failed to fetch existing records: ${fetchError.message}`);
      } else {
        for (const record of existingRecords || []) {
          const key = `${record.employee_id}:${record.date}`;
          existingMap.set(key, true);
        }
      }
    }

    console.log(`[upload-server] Found ${existingMap.size} existing records in database`);

    // 4. Batch upsert records
    const BATCH_SIZE = 500;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(records.length / BATCH_SIZE);

      console.log(`[upload-server] Upserting batch ${batchNum}/${totalBatches} (${batch.length} records)`);

      const { error } = await supabase
        .from('daily_hours')
        .upsert(batch, {
          onConflict: 'employee_id,date',
          ignoreDuplicates: false,
        });

      if (error) {
        const errorMsg = `Batch ${batchNum} upsert failed: ${error.message}`;
        console.error(`[upload-server] ${errorMsg}`);
        result.errors.push(errorMsg);
      } else {
        // Count inserts vs updates
        for (const record of batch) {
          const key = `${record.employee_id}:${record.date}`;
          if (existingMap.has(key)) {
            result.updated++;
          } else {
            result.inserted++;
            existingMap.set(key, true); // Mark as existing for dedup within this upload
          }
        }
      }
    }

    console.log(`[upload-server] Upload complete: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);

    // 5. Log import
    const { error: logError } = await supabase.from('import_logs').insert({
      file_type: 'hours',
      file_name: fileName,
      rows_processed: rows.length,
      rows_inserted: result.inserted,
      rows_updated: result.updated,
      rows_skipped: result.skipped,
      errors: result.errors,
    });

    if (logError) {
      console.error(`[upload-server] Failed to log import: ${logError.message}`);
    }

  } catch (err) {
    const errorMsg = `Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    console.error(`[upload-server] ${errorMsg}`);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Server-side upload articles data with deduplication
 * Uses admin client that bypasses RLS
 * Rule: Always overwrite on conflict (article_id is unique key)
 */
export async function uploadArticlesDataServer(
  supabase: SupabaseClient,
  rows: ParsedArticleRow[],
  fileName: string
): Promise<UpsertResult> {
  const result: UpsertResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log(`[upload-server] Starting articles upload of ${rows.length} rows from ${fileName}`);

    // Batch find/create employees using admin client
    const uniqueNames = [...new Set(rows.map(r => r.fullName))].map(name => ({
      fullName: name,
    }));

    const employeeMap = await batchFindOrCreateEmployees(uniqueNames, 'articles', supabase);

    // Get existing article IDs
    const articleIds = rows.map(r => r.articleId);
    const { data: existingArticles } = await supabase
      .from('articles')
      .select('article_id')
      .in('article_id', articleIds);

    const existingIds = new Set(existingArticles?.map(a => a.article_id) || []);

    // Prepare records for upsert
    const records = rows.map(row => ({
      article_id: row.articleId,
      employee_id: employeeMap.get(row.fullName) || null,
      title: row.title,
      views: row.views,
      published_at: row.publishedAt,
      updated_at: new Date().toISOString(),
    }));

    // Upsert in batches
    const BATCH_SIZE = 500;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      const { error } = await supabase
        .from('articles')
        .upsert(batch, {
          onConflict: 'article_id',
          ignoreDuplicates: false,
        });

      if (error) {
        result.errors.push(`Batch upsert failed: ${error.message}`);
      } else {
        // Count inserts vs updates
        for (const record of batch) {
          if (existingIds.has(record.article_id)) {
            result.updated++;
          } else {
            result.inserted++;
          }
        }
      }
    }

    console.log(`[upload-server] Articles upload complete: ${result.inserted} inserted, ${result.updated} updated`);

    // Log import
    await supabase.from('import_logs').insert({
      file_type: 'articles',
      file_name: fileName,
      rows_processed: rows.length,
      rows_inserted: result.inserted,
      rows_updated: result.updated,
      rows_skipped: result.skipped,
      errors: result.errors,
    });

  } catch (err) {
    result.errors.push(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return result;
}
