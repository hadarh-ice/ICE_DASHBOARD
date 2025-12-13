/**
 * Simple Batch Upload Script for ICE Analytics
 * Uses ES modules to avoid path alias issues
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import Papa from 'papaparse';
import pkg from 'xlsx';
const { readFile, utils } = pkg;

// Supabase client setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// File paths
const ARTICLES_DIR = '/Users/aloniter/Ice/ice-analytics/files/articales';
const HOURS_DIR = '/Users/aloniter/Ice/ice-analytics/files/hours and names';

// Hebrew month names mapping for ordering
const HEBREW_MONTHS = {
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

function getMonthFromFilename(filename) {
  for (const [hebrewMonth, monthNum] of Object.entries(HEBREW_MONTHS)) {
    if (filename.includes(hebrewMonth)) {
      return monthNum;
    }
  }
  return 99;
}

/**
 * Process and upload articles from a CSV file
 */
async function processArticlesFile(filepath, filename) {
  console.log(`\n📄 Processing articles: ${filename}`);

  try {
    const fileContent = readFileSync(filepath, 'utf-8');
    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data;
    console.log(`   Found ${rows.length} rows`);

    // Transform to database format with employee lookup
    const articlesToInsert = [];

    for (const row of rows) {
      const fullName = row['שם'] || '';
      const views = parseInt(row['צפיות'] || '0', 10);
      const dateStr = row['תאריך יצירה'] || '';
      const title = row['כותרת'] || '';

      if (!fullName || !dateStr) continue;

      // Convert DD/MM/YYYY HH:MM to YYYY-MM-DD
      let date = '';
      if (dateStr) {
        const parts = dateStr.split(' ')[0].split('/'); // Take only date part
        if (parts.length === 3) {
          date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      if (!date) continue;

      // Find or create employee
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .ilike('name', fullName.trim())
        .single();

      if (!employee) {
        // Create employee if doesn't exist
        const { data: newEmployee } = await supabase
          .from('employees')
          .insert({ name: fullName.trim(), status: 'active' })
          .select('id')
          .single();

        if (newEmployee) {
          articlesToInsert.push({
            employee_id: newEmployee.id,
            views,
            date,
            title,
            is_low_views: views < 50,
          });
        }
      } else {
        articlesToInsert.push({
          employee_id: employee.id,
          views,
          date,
          title,
          is_low_views: views < 50,
        });
      }
    }

    // Batch upsert articles
    if (articlesToInsert.length > 0) {
      const { data, error } = await supabase
        .from('articles')
        .upsert(articlesToInsert, {
          onConflict: 'employee_id,date,title',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`   ❌ Error upserting:`, error.message);
        return { success: false, inserted: 0, errors: 1 };
      }

      console.log(`   ✅ Upserted ${articlesToInsert.length} articles`);
      return { success: true, inserted: articlesToInsert.length, errors: 0 };
    }

    return { success: true, inserted: 0, errors: 0 };
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return { success: false, inserted: 0, errors: 1 };
  }
}

/**
 * Process and upload hours from an XLSX file
 */
async function processHoursFile(filepath, filename) {
  console.log(`\n⏰ Processing hours: ${filename}`);

  try {
    const workbook = readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Skip first row (business header) by starting from row 2
    const rows = utils.sheet_to_json(worksheet, { range: 1 });

    console.log(`   Found ${rows.length} rows`);

    // Transform to database format
    const hoursToInsert = [];

    for (const row of rows) {
      const firstName = row['שם פרטי'] || '';
      const lastName = row['שם משפחה'] || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const dateStr = row['תאריך'] || '';
      const hours = parseFloat(row['שעות'] || '0');

      if (!fullName || !dateStr || hours === 0) continue;

      // Convert DD/MM/YYYY to YYYY-MM-DD
      let date = '';
      if (dateStr) {
        // Handle Excel date serial numbers or string dates
        if (typeof dateStr === 'number') {
          // Excel serial date
          const excelEpoch = new Date(1899, 11, 30);
          const jsDate = new Date(excelEpoch.getTime() + dateStr * 86400000);
          date = jsDate.toISOString().split('T')[0];
        } else if (typeof dateStr === 'string') {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      }

      if (!date) continue;

      // Find or create employee
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .ilike('name', fullName.trim())
        .single();

      if (!employee) {
        const { data: newEmployee } = await supabase
          .from('employees')
          .insert({ name: fullName.trim(), status: 'active' })
          .select('id')
          .single();

        if (newEmployee) {
          hoursToInsert.push({
            employee_id: newEmployee.id,
            date,
            hours,
          });
        }
      } else {
        hoursToInsert.push({
          employee_id: employee.id,
          date,
          hours,
        });
      }
    }

    // Batch upsert hours
    if (hoursToInsert.length > 0) {
      const { error } = await supabase
        .from('daily_hours')
        .upsert(hoursToInsert, {
          onConflict: 'employee_id,date',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`   ❌ Error upserting:`, error.message);
        return { success: false, inserted: 0, errors: 1 };
      }

      console.log(`   ✅ Upserted ${hoursToInsert.length} hours records`);
      return { success: true, inserted: hoursToInsert.length, errors: 0 };
    }

    return { success: true, inserted: 0, errors: 0 };
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return { success: false, inserted: 0, errors: 1 };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 ICE Analytics - Simple Batch Upload\n');
  console.log('='.repeat(60));

  let totalInserted = 0;
  let totalErrors = 0;

  // Process articles
  const articlesFiles = readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.csv'))
    .sort((a, b) => getMonthFromFilename(a) - getMonthFromFilename(b));

  console.log(`\n📚 PROCESSING ${articlesFiles.length} ARTICLES FILES\n`);

  for (const file of articlesFiles) {
    const result = await processArticlesFile(join(ARTICLES_DIR, file), file);
    totalInserted += result.inserted;
    totalErrors += result.errors;
  }

  // Process hours
  const hoursFiles = readdirSync(HOURS_DIR)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .sort((a, b) => getMonthFromFilename(a) - getMonthFromFilename(b));

  console.log(`\n\n⏱️  PROCESSING ${hoursFiles.length} HOURS FILES\n`);

  for (const file of hoursFiles) {
    const result = await processHoursFile(join(HOURS_DIR, file), file);
    totalInserted += result.inserted;
    totalErrors += result.errors;
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 BATCH UPLOAD SUMMARY\n');
  console.log(`Total Records Inserted: ${totalInserted}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log('\n' + '='.repeat(60));

  if (totalErrors === 0) {
    console.log('\n✅ All files processed successfully!');
  } else {
    console.log(`\n⚠️  Completed with ${totalErrors} errors.`);
  }

  console.log('\n📌 Next: Use Playwright to validate KPIs in dashboard\n');
}

main().catch(console.error);
