import { SupabaseClient } from '@supabase/supabase-js';
import { DeleteDataResult, DeleteDataRequest } from '@/types';

/**
 * Delete hours and/or articles data by date range
 * Uses admin client to bypass RLS
 */
export async function deleteDataByDateRange(
  supabase: SupabaseClient,
  request: DeleteDataRequest
): Promise<DeleteDataResult> {
  const startTime = Date.now();
  const result: DeleteDataResult = {
    success: true,
    deletedHours: 0,
    deletedArticles: 0,
    errors: [],
    processingTimeMs: 0,
  };

  try {
    // Delete hours if requested
    if (request.type === 'hours' || request.type === 'both') {
      const { error, count } = await supabase
        .from('daily_hours')
        .delete({ count: 'exact' })
        .gte('date', request.startDate)
        .lte('date', request.endDate);

      if (error) {
        result.errors.push(`Hours deletion failed: ${error.message}`);
        result.success = false;
      } else {
        result.deletedHours = count || 0;
        console.log(`[delete-data] Deleted ${count} hours records`);
      }
    }

    // Delete articles if requested
    if (request.type === 'articles' || request.type === 'both') {
      const { error, count } = await supabase
        .from('articles')
        .delete({ count: 'exact' })
        .gte('published_at', `${request.startDate}T00:00:00`)
        .lte('published_at', `${request.endDate}T23:59:59`);

      if (error) {
        result.errors.push(`Articles deletion failed: ${error.message}`);
        result.success = false;
      } else {
        result.deletedArticles = count || 0;
        console.log(`[delete-data] Deleted ${count} articles records`);
      }
    }

    result.processingTimeMs = Date.now() - startTime;

  } catch (err) {
    result.success = false;
    result.errors.push(
      `Delete operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
    console.error('[delete-data] Error:', err);
  }

  return result;
}
