import Papa from 'papaparse';
import { ParsedArticleRow } from '@/types';
import { parseHebrewDateTime } from '@/lib/utils/dates';
import { parseNumber } from '@/lib/utils/numbers';

// Hebrew column name mappings
const COLUMN_MAPPINGS = {
  name: ['שם', 'name', 'author'],
  articleId: ['מספר כתבה', 'article id', 'article number', 'id'],
  title: ['כותרת', 'title'],
  views: ['צפיות', 'views'],
  publishedAt: ['תאריך יצירה', 'published', 'date', 'created'],
};

function findColumn(headers: string[], mappings: string[]): string | null {
  const normalizedMappings = mappings.map(m => m.toLowerCase().trim());

  for (const header of headers) {
    const normalizedHeader = header?.toLowerCase().trim();
    if (normalizedMappings.some(m => normalizedHeader?.includes(m))) {
      return header;
    }
  }
  return null;
}

export interface ParseArticlesResult {
  rows: ParsedArticleRow[];
  errors: string[];
  totalRows: number;
}

export async function parseArticlesFile(file: File): Promise<ParseArticlesResult> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const rows: ParsedArticleRow[] = [];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const headers = results.meta.fields || [];

        // Find columns
        const columns = {
          name: findColumn(headers, COLUMN_MAPPINGS.name),
          articleId: findColumn(headers, COLUMN_MAPPINGS.articleId),
          title: findColumn(headers, COLUMN_MAPPINGS.title),
          views: findColumn(headers, COLUMN_MAPPINGS.views),
          publishedAt: findColumn(headers, COLUMN_MAPPINGS.publishedAt),
        };

        // Validate required columns
        if (!columns.name) errors.push('Missing column: Name (שם)');
        if (!columns.articleId) errors.push('Missing column: Article ID (מספר כתבה)');
        if (!columns.title) errors.push('Missing column: Title (כותרת)');
        if (!columns.views) errors.push('Missing column: Views (צפיות)');
        if (!columns.publishedAt) errors.push('Missing column: Published Date (תאריך יצירה)');

        if (errors.length > 0) {
          resolve({ rows, errors, totalRows: results.data.length });
          return;
        }

        // Parse rows
        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i] as Record<string, string>;

          try {
            const fullName = row[columns.name!]?.trim();
            const articleIdStr = row[columns.articleId!];
            const title = row[columns.title!]?.trim();
            const viewsStr = row[columns.views!];
            const publishedAtStr = row[columns.publishedAt!];

            if (!fullName || !articleIdStr) continue; // Skip empty rows

            const articleId = parseInt(articleIdStr, 10);
            if (isNaN(articleId)) {
              errors.push(`Row ${i + 2}: Invalid article ID`);
              continue;
            }

            const views = parseNumber(viewsStr);
            const publishedAt = parseHebrewDateTime(publishedAtStr);

            if (!publishedAt) {
              errors.push(`Row ${i + 2}: Invalid date format`);
              continue;
            }

            rows.push({
              articleId,
              fullName,
              title: title || '',
              views,
              publishedAt,
            });
          } catch (err) {
            errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }

        resolve({ rows, errors, totalRows: results.data.length });
      },
      error: (err) => {
        errors.push(`Failed to parse CSV: ${err.message}`);
        resolve({ rows, errors, totalRows: 0 });
      },
    });
  });
}
