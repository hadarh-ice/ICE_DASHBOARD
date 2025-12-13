import { readFileSync } from 'fs';
import Papa from 'papaparse';
import pkg from 'xlsx';
const { readFile, utils } = pkg;

// Check articles CSV
const csvContent = readFileSync('/Users/aloniter/Ice/ice-analytics/files/articales/כתבות ינואר25.csv', 'utf-8');
const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

console.log('📄 Articles CSV Columns:');
if (parsed.data.length > 0) {
  console.log('Columns:', Object.keys(parsed.data[0]));
  console.log('\nSample row:', parsed.data[0]);
}

// Check hours XLSX
const workbook = readFile('/Users/aloniter/Ice/ice-analytics/files/hours and names/ינואר שעות 2025.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = utils.sheet_to_json(worksheet);

console.log('\n\n⏰ Hours XLSX Columns:');
if (rows.length > 0) {
  console.log('Columns:', Object.keys(rows[0]));
  console.log('\nSample row:', rows[0]);
}
