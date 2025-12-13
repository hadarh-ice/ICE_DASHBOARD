/**
 * Batch Upload Script for ICE Analytics
 * Processes all yearly data files (articles + hours) from the files directory
 *
 * Usage: npx ts-node scripts/batch-upload-yearly-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Supabase client setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// File paths
const ARTICLES_DIR = '/Users/aloniter/Ice/ice-analytics/files/articales';
const HOURS_DIR = '/Users/aloniter/Ice/ice-analytics/files/hours and names';

// Hebrew month names mapping for ordering
const HEBREW_MONTHS: Record<string, number> = {
  'ינואר': 1,
  'פברואר': 2,
  'מרץ': 3,
  'אפריל': 4,
  'מאי': 5,
  'יוני': 6,
  'יולי': 7,
  'אוגוסט': 8,
  'ספטמבר': 9,
  'אוקטובר': 10,
  'נובמבר': 11,
  'דצמבר': 12,
};

interface UploadStats {
  file: string;
  type: 'articles' | 'hours';
  rows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  success: boolean;
}

/**
 * Extract month number from Hebrew filename
 */
function getMonthFromFilename(filename: string): number {
  for (const [hebrewMonth, monthNum] of Object.entries(HEBREW_MONTHS)) {
    if (filename.includes(hebrewMonth)) {
      return monthNum;
    }
  }
  return 99; // Unknown month goes to end
}

/**
 * Process articles CSV file
 */
async function processArticlesFile(filepath: string, filename: string): Promise<UploadStats> {
  console.log(`\n📄 Processing articles: ${filename}`);

  try {
    const fileContent = readFileSync(filepath, 'utf-8');
    const parsed = Papa.parse<any>(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data;
    console.log(`   Found ${rows.length} rows`);

    // Transform CSV rows to ParsedArticleRow format
    const parsedRows = rows.map((row: any, index: number) => ({
      articleId: index + 1, // Generate sequential ID for each row
      fullName: row['שם עיתונאי'] || row['שם'] || '',
      title: row['כותרת'] || '',
      views: parseInt(row['צפיות'] || row['צפיות בכתבה'] || '0', 10),
      publishedAt: row['תאריך פרסום'] || row['תאריך'] || '',
      isLowViews: parseInt(row['צפיות'] || row['צפיות בכתבה'] || '0', 10) < 50,
    }));

    // Upload using the server function
    const { uploadArticlesDataServer } = await import('@/lib/queries/upload-server');
    const result = await uploadArticlesDataServer(supabase, parsedRows, filename);

    console.log(`   ✅ ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);

    return {
      file: filename,
      type: 'articles',
      rows: rows.length,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
      success: result.errors.length === 0,
    };
  } catch (error) {
    console.error(`   ❌ Error processing ${filename}:`, error);
    return {
      file: filename,
      type: 'articles',
      rows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 1,
      success: false,
    };
  }
}

/**
 * Process hours XLSX file
 */
async function processHoursFile(filepath: string, filename: string): Promise<UploadStats> {
  console.log(`\n⏰ Processing hours: ${filename}`);

  try {
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

    console.log(`   Found ${rows.length} rows`);

    // Transform XLSX rows to ParsedHoursRow format
    const parsedRows = rows.map((row: any) => {
      const fullName = row['שם עובד'] || row['שם'] || '';
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        firstName,
        lastName,
        fullName,
        date: row['תאריך'] || '',
        hours: parseFloat(row['שעות'] || row['סה״כ שעות'] || '0'),
        entryTime: row['שעת כניסה'] || undefined,
        exitTime: row['שעת יציאה'] || undefined,
        status: row['סטטוס'] || undefined,
        employeeNumber: row['מספר עובד'] || undefined,
      };
    });

    // Upload using the server function
    const { uploadHoursDataServer } = await import('@/lib/queries/upload-server');
    const result = await uploadHoursDataServer(supabase, parsedRows, filename);

    console.log(`   ✅ ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);

    return {
      file: filename,
      type: 'hours',
      rows: rows.length,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
      success: result.errors.length === 0,
    };
  } catch (error) {
    console.error(`   ❌ Error processing ${filename}:`, error);
    return {
      file: filename,
      type: 'hours',
      rows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 1,
      success: false,
    };
  }
}

/**
 * Main batch upload function
 */
async function main() {
  console.log('🚀 ICE Analytics - Batch Upload Starting...\n');
  console.log('=' .repeat(60));

  const allStats: UploadStats[] = [];

  // Get all articles files and sort by month
  const articlesFiles = readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.csv'))
    .sort((a, b) => getMonthFromFilename(a) - getMonthFromFilename(b));

  // Get all hours files and sort by month
  const hoursFiles = readdirSync(HOURS_DIR)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$')) // Skip Excel temp files
    .sort((a, b) => getMonthFromFilename(a) - getMonthFromFilename(b));

  console.log(`\n📊 Found ${articlesFiles.length} articles files`);
  console.log(`📊 Found ${hoursFiles.length} hours files`);
  console.log('\n' + '='.repeat(60));

  // Process articles files first
  console.log('\n\n📚 PROCESSING ARTICLES FILES\n');
  for (const file of articlesFiles) {
    const filepath = join(ARTICLES_DIR, file);
    const stats = await processArticlesFile(filepath, file);
    allStats.push(stats);
  }

  // Process hours files
  console.log('\n\n⏱️  PROCESSING HOURS FILES\n');
  for (const file of hoursFiles) {
    const filepath = join(HOURS_DIR, file);
    const stats = await processHoursFile(filepath, file);
    allStats.push(stats);
  }

  // Print summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 BATCH UPLOAD SUMMARY\n');

  const totalRows = allStats.reduce((sum, s) => sum + s.rows, 0);
  const totalInserted = allStats.reduce((sum, s) => sum + s.inserted, 0);
  const totalUpdated = allStats.reduce((sum, s) => sum + s.updated, 0);
  const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0);
  const successCount = allStats.filter(s => s.success).length;

  console.log(`Total Files Processed: ${allStats.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${allStats.length - successCount}`);
  console.log(`\nTotal Rows: ${totalRows}`);
  console.log(`Inserted: ${totalInserted}`);
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Errors: ${totalErrors}`);

  console.log('\n' + '='.repeat(60));

  if (totalErrors === 0) {
    console.log('\n✅ Batch upload complete! All files processed successfully.');
  } else {
    console.log(`\n⚠️  Batch upload complete with ${totalErrors} errors. Check logs above.`);
  }

  console.log('\n📌 Next step: Use Playwright to validate KPIs in dashboard\n');
}

main().catch(console.error);
