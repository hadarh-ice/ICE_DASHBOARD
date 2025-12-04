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
 * Server-side upload hours data with deduplication
 * Uses admin client that bypasses RLS
 * Rule: Keep row with higher hours for same (employee, date)
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

    // Batch find/create employees using admin client
    const uniqueNames = [...new Set(rows.map(r => r.fullName))].map(name => ({
      fullName: name,
      employeeNumber: rows.find(r => r.fullName === name)?.employeeNumber,
    }));

    console.log(`[upload-server] Processing ${uniqueNames.length} unique employees`);

    const employeeMap = await batchFindOrCreateEmployees(uniqueNames, 'hours', supabase);

    console.log(`[upload-server] Employee map created with ${employeeMap.size} entries`);

    // Process rows in batches
    const BATCH_SIZE = 100;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      console.log(`[upload-server] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)}`);

      for (const row of batch) {
        const employeeId = employeeMap.get(row.fullName);

        if (!employeeId) {
          const errorMsg = `Failed to find/create employee: ${row.fullName}`;
          console.error(`[upload-server] ${errorMsg}`);
          result.errors.push(errorMsg);
          continue;
        }

        // Check existing record
        const { data: existing, error: selectError } = await supabase
          .from('daily_hours')
          .select('id, hours')
          .eq('employee_id', employeeId)
          .eq('date', row.date)
          .maybeSingle();

        if (selectError) {
          const errorMsg = `Select failed for ${row.fullName} on ${row.date}: ${selectError.message}`;
          console.error(`[upload-server] ${errorMsg}`);
          result.errors.push(errorMsg);
          continue;
        }

        // Extract status from entry/exit time if they contain status text
        const status = extractStatusFromTime(row.entryTime, row.exitTime, row.status);
        const entryTime = isValidTimeFormat(row.entryTime) ? row.entryTime : null;
        const exitTime = isValidTimeFormat(row.exitTime) ? row.exitTime : null;

        if (existing) {
          // Update only if new hours > existing hours
          if (row.hours > Number(existing.hours)) {
            const { error } = await supabase
              .from('daily_hours')
              .update({
                hours: row.hours,
                status: status,
                entry_time: entryTime,
                exit_time: exitTime,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            if (error) {
              const errorMsg = `Update failed for ${row.fullName} on ${row.date}: ${error.message}`;
              console.error(`[upload-server] ${errorMsg}`);
              result.errors.push(errorMsg);
            } else {
              result.updated++;
            }
          } else {
            result.skipped++;
          }
        } else {
          // Insert new record
          const { error } = await supabase.from('daily_hours').insert({
            employee_id: employeeId,
            date: row.date,
            hours: row.hours,
            status: status,
            entry_time: entryTime,
            exit_time: exitTime,
          });

          if (error) {
            const errorMsg = `Insert failed for ${row.fullName} on ${row.date}: ${error.message}`;
            console.error(`[upload-server] ${errorMsg}`);
            result.errors.push(errorMsg);
          } else {
            result.inserted++;
          }
        }
      }
    }

    console.log(`[upload-server] Upload complete: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);

    // Log import
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
