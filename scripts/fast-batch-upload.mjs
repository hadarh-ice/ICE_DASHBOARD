/**
 * Fast Batch Upload Script for ICE Analytics
 * Optimized with employee caching and batch inserts
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

// Hebrew month names mapping
const HEBREW_MONTHS = {
  'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4,
  'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8,
  'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
};

function getMonthFromFilename(filename) {
  for (const [hebrewMonth, monthNum] of Object.entries(HEBREW_MONTHS)) {
    if (filename.includes(hebrewMonth)) return monthNum;
  }
  return 99;
}

// Cache employees
let employeeCache = null;

async function loadEmployeeCache() {
  const { data } = await supabase
    .from('employees')
    .select('id, canonical_name');

  employeeCache = new Map();
  if (data) {
    data.forEach(emp => {
      if (emp.canonical_name) {
        employeeCache.set(emp.canonical_name.toLowerCase().trim(), emp.id);
      }
    });
  }
  console.log(`✅ Loaded ${employeeCache.size} employees into cache`);
}

async function getOrCreateEmployee(fullName) {
  const key = fullName.toLowerCase().trim();

  if (employeeCache.has(key)) {
    return employeeCache.get(key);
  }

  // Split name into first and last
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Create new employee
  const { data, error } = await supabase
    .from('employees')
    .insert({
      first_name: firstName,
      last_name: lastName,
      canonical_name: fullName.trim(),
      normalized_name: fullName.trim().toLowerCase()
    })
    .select('id')
    .single();

  if (data) {
    employeeCache.set(key, data.id);
    return data.id;
  }

  return null;
}

/**
 * Process articles file
 */
async function processArticlesFile(filepath, filename) {
  console.log(`\n📄 Processing: ${filename}`);

  try {
    const fileContent = readFileSync(filepath, 'utf-8');
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    const rows = parsed.data;

    console.log(`   Found ${rows.length} rows`);

    const articlesToInsert = [];
    let skipped = 0;

    for (const row of rows) {
      const fullName = row['שם'] || '';
      const views = parseInt(row['צפיות'] || '0', 10);
      const dateStr = row['תאריך יצירה'] || '';
      const title = row['כותרת'] || '';
      const articleId = parseInt(row['מספר כתבה'] || '0', 10);

      if (!fullName || !dateStr || !articleId) {
        skipped++;
        continue;
      }

      // Convert DD/MM/YYYY HH:MM to YYYY-MM-DD
      const parts = dateStr.split(' ')[0].split('/');
      if (parts.length !== 3) {
        skipped++;
        continue;
      }
      const date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;

      const employeeId = await getOrCreateEmployee(fullName);
      if (!employeeId) {
        skipped++;
        continue;
      }

      articlesToInsert.push({
        article_id: articleId,
        employee_id: employeeId,
        views,
        published_at: date,
        title,
        is_low_views: views < 50,
      });
    }

    // Batch upsert
    if (articlesToInsert.length > 0) {
      // Split into chunks of 1000
      const chunkSize = 1000;
      let inserted = 0;

      for (let i = 0; i < articlesToInsert.length; i += chunkSize) {
        const chunk = articlesToInsert.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('articles')
          .upsert(chunk, { onConflict: 'article_id' });

        if (error) {
          console.error(`   ❌ Error in chunk ${i / chunkSize + 1}:`, error.message);
        } else {
          inserted += chunk.length;
        }
      }

      console.log(`   ✅ Inserted ${inserted} articles (skipped ${skipped})`);
      return { inserted, skipped, errors: 0 };
    }

    return { inserted: 0, skipped, errors: 0 };
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return { inserted: 0, skipped: 0, errors: 1 };
  }
}

/**
 * Process hours file
 */
async function processHoursFile(filepath, filename) {
  console.log(`\n⏰ Processing: ${filename}`);

  try {
    const workbook = readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = utils.sheet_to_json(worksheet, { range: 1 });

    console.log(`   Found ${rows.length} rows`);

    const hoursToInsert = [];
    let skipped = 0;

    for (const row of rows) {
      const firstName = row['שם פרטי'] || '';
      const lastName = row['שם משפחה'] || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const dateStr = row['תאריך'];
      const hours = parseFloat(row['שעות'] || '0');

      if (!fullName || !dateStr || hours === 0) {
        skipped++;
        continue;
      }

      // Convert date
      let date = '';
      if (typeof dateStr === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const jsDate = new Date(excelEpoch.getTime() + dateStr * 86400000);
        date = jsDate.toISOString().split('T')[0];
      } else if (typeof dateStr === 'string') {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      if (!date) {
        skipped++;
        continue;
      }

      const employeeId = await getOrCreateEmployee(fullName);
      if (!employeeId) {
        skipped++;
        continue;
      }

      hoursToInsert.push({
        employee_id: employeeId,
        date,
        hours,
      });
    }

    // Deduplicate hours by employee_id+date (keep last entry)
    const hoursMap = new Map();
    for (const hour of hoursToInsert) {
      const key = `${hour.employee_id}|${hour.date}`;
      hoursMap.set(key, hour);
    }
    const dedupedHours = Array.from(hoursMap.values());

    // Batch upsert
    if (dedupedHours.length > 0) {
      const chunkSize = 1000;
      let inserted = 0;

      for (let i = 0; i < dedupedHours.length; i += chunkSize) {
        const chunk = dedupedHours.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('daily_hours')
          .upsert(chunk, { onConflict: 'employee_id,date' });

        if (error) {
          console.error(`   ❌ Error in chunk ${i / chunkSize + 1}:`, error.message);
        } else {
          inserted += chunk.length;
        }
      }

      console.log(`   ✅ Inserted ${inserted} hours (skipped ${skipped}, deduped ${hoursToInsert.length - dedupedHours.length})`);
      return { inserted, skipped, errors: 0 };
    }

    return { inserted: 0, skipped, errors: 0 };
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return { inserted: 0, skipped: 0, errors: 1 };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 ICE Analytics - Fast Batch Upload\n');
  console.log('='.repeat(60));

  // Load employee cache first
  await loadEmployeeCache();

  let totalArticles = 0;
  let totalHours = 0;
  let totalErrors = 0;

  // Process articles
  const articlesFiles = readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.csv'))
    .sort((a, b) => getMonthFromFilename(a) - getMonthFromFilename(b));

  console.log(`\n📚 PROCESSING ${articlesFiles.length} ARTICLES FILES\n`);

  for (const file of articlesFiles) {
    const result = await processArticlesFile(join(ARTICLES_DIR, file), file);
    totalArticles += result.inserted;
    totalErrors += result.errors;
  }

  // Process hours
  const hoursFiles = readdirSync(HOURS_DIR)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .sort((a, b) => getMonthFromFilename(a) - getMonthFromFilename(b));

  console.log(`\n\n⏱️  PROCESSING ${hoursFiles.length} HOURS FILES\n`);

  for (const file of hoursFiles) {
    const result = await processHoursFile(join(HOURS_DIR, file), file);
    totalHours += result.inserted;
    totalErrors += result.errors;
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 BATCH UPLOAD SUMMARY\n');
  console.log(`Total Articles Inserted: ${totalArticles.toLocaleString()}`);
  console.log(`Total Hours Records Inserted: ${totalHours.toLocaleString()}`);
  console.log(`Total Employees: ${employeeCache.size}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log('\n' + '='.repeat(60));

  if (totalErrors === 0) {
    console.log('\n✅ All files processed successfully!');
  } else {
    console.log(`\n⚠️  Completed with ${totalErrors} errors.`);
  }

  // ==========================================
  // DATA INTEGRITY VALIDATION
  // ==========================================
  console.log('\n\n' + '='.repeat(60));
  console.log('🔍 DATA INTEGRITY VALIDATION');
  console.log('='.repeat(60));
  console.log('\nVerifying Total Views KPI accuracy...\n');

  try {
    // Check 1: RPC total
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_global_metrics', {
      p_start_date: null,
      p_end_date: null,
      p_employee_ids: null,
    });

    if (rpcError) {
      console.error('❌ RPC validation failed:', rpcError.message);
      throw rpcError;
    }

    const rpcTotalViews = rpcData[0].total_views;
    const rpcTotalArticles = rpcData[0].total_articles;

    // Check 2: Manual sum per employee
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('employee_id, views')
      .eq('is_low_views', false);

    if (articlesError) {
      console.error('❌ Articles fetch failed:', articlesError.message);
      throw articlesError;
    }

    const employeeSums = new Map();
    let orphanedViews = 0;
    let orphanedCount = 0;

    articles.forEach(article => {
      if (article.employee_id === null) {
        orphanedViews += article.views || 0;
        orphanedCount++;
      } else {
        const current = employeeSums.get(article.employee_id) || 0;
        employeeSums.set(article.employee_id, current + (article.views || 0));
      }
    });

    const sumOfEmployeeTotals = Array.from(employeeSums.values()).reduce((sum, val) => sum + val, 0);
    const totalIncludingOrphaned = sumOfEmployeeTotals + orphanedViews;

    // Check 3: Verify match
    const totalsMatch = rpcTotalViews === totalIncludingOrphaned;

    console.log('\n📈 Validation Results:\n');
    console.log(`   RPC Total Views:          ${rpcTotalViews.toLocaleString()}`);
    console.log(`   RPC Total Articles:       ${rpcTotalArticles.toLocaleString()}`);
    console.log(`   Sum of Employee Totals:   ${sumOfEmployeeTotals.toLocaleString()}`);
    console.log(`   Orphaned Articles:        ${orphanedCount}`);
    console.log(`   Orphaned Views:           ${orphanedViews.toLocaleString()}`);
    console.log(`   Total (incl. orphaned):   ${totalIncludingOrphaned.toLocaleString()}`);
    console.log(`   Employees with Articles:  ${employeeSums.size}`);

    if (totalsMatch) {
      console.log('\n✅ DATA INTEGRITY VERIFIED - Totals match perfectly!');
    } else {
      console.error('\n❌ DATA INTEGRITY ERROR - Totals DO NOT match!');
      console.error(`   Discrepancy: ${Math.abs(rpcTotalViews - totalIncludingOrphaned).toLocaleString()} views`);
      console.error('\n   This indicates a critical bug in aggregation logic.');
      console.error('   Dashboard KPIs will show incorrect numbers.');
      process.exit(1);
    }

    if (orphanedCount > 0) {
      console.log(`\n⚠️  WARNING: ${orphanedCount} articles have NULL employee_id`);
      console.log(`   These represent ${orphanedViews.toLocaleString()} views`);
      console.log('   Impact: Included in global totals but NOT in employee rankings');
      console.log('   Cause: Name matching failure during upload');
    }

  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    console.error('   Unable to verify data integrity.');
    console.error('   Manually check dashboard KPIs against database totals.');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📌 Next: Use Playwright to validate KPIs in dashboard\n');
}

main().catch(console.error);
