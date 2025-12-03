import { createClient } from '@/lib/supabase/client';
import { ParsedHoursRow, ParsedArticleRow, UpsertResult } from '@/types';
import { batchFindOrCreateEmployees } from '@/lib/matching/names';

/**
 * Upload hours data with deduplication
 * Rule: Keep row with higher hours for same (employee, date)
 */
export async function uploadHoursData(
  rows: ParsedHoursRow[],
  fileName: string
): Promise<UpsertResult> {
  const supabase = createClient();
  const result: UpsertResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Batch find/create employees
    const uniqueNames = [...new Set(rows.map(r => r.fullName))].map(name => ({
      fullName: name,
      employeeNumber: rows.find(r => r.fullName === name)?.employeeNumber,
    }));

    const employeeMap = await batchFindOrCreateEmployees(uniqueNames, 'hours');

    // Process rows in batches
    const BATCH_SIZE = 100;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        const employeeId = employeeMap.get(row.fullName);

        if (!employeeId) {
          result.errors.push(`Failed to find/create employee: ${row.fullName}`);
          continue;
        }

        // Check existing record
        const { data: existing } = await supabase
          .from('daily_hours')
          .select('id, hours')
          .eq('employee_id', employeeId)
          .eq('date', row.date)
          .single();

        if (existing) {
          // Update only if new hours > existing hours
          if (row.hours > Number(existing.hours)) {
            const { error } = await supabase
              .from('daily_hours')
              .update({
                hours: row.hours,
                status: row.status,
                entry_time: row.entryTime,
                exit_time: row.exitTime,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            if (error) {
              result.errors.push(`Update failed for ${row.fullName} on ${row.date}: ${error.message}`);
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
            status: row.status,
            entry_time: row.entryTime,
            exit_time: row.exitTime,
          });

          if (error) {
            result.errors.push(`Insert failed for ${row.fullName} on ${row.date}: ${error.message}`);
          } else {
            result.inserted++;
          }
        }
      }
    }

    // Log import
    await supabase.from('import_logs').insert({
      file_type: 'hours',
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

/**
 * Upload articles data with deduplication
 * Rule: Always overwrite on conflict (article_id is unique key)
 */
export async function uploadArticlesData(
  rows: ParsedArticleRow[],
  fileName: string
): Promise<UpsertResult> {
  const supabase = createClient();
  const result: UpsertResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Batch find/create employees
    const uniqueNames = [...new Set(rows.map(r => r.fullName))].map(name => ({
      fullName: name,
    }));

    const employeeMap = await batchFindOrCreateEmployees(uniqueNames, 'articles');

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
