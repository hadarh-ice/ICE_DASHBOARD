import * as XLSX from 'xlsx';
import { ParsedHoursRow } from '@/types';
import { parseHebrewDate, formatDatabaseDate } from '@/lib/utils/dates';
import { parseNumber } from '@/lib/utils/numbers';

// Hebrew column name mappings
const COLUMN_MAPPINGS = {
  firstName: ['שם פרטי', 'שם_פרטי', 'first name', 'firstname'],
  lastName: ['שם משפחה', 'שם_משפחה', 'last name', 'lastname'],
  date: ['תאריך', 'date'],
  hours: ['שעות', 'hours', 'total hours'],
  status: ['סטטוס', 'status'],
  entryTime: ['כניסה', 'entry', 'entry time'],
  exitTime: ['יציאה', 'exit', 'exit time'],
  employeeNumber: ['מספר עובד', 'employee number', 'employee id'],
};

function findColumnIndex(headers: string[], mappings: string[]): number {
  const normalizedHeaders = headers.map(h =>
    h?.toString().toLowerCase().trim().replace(/\s+/g, ' ')
  );

  for (const mapping of mappings) {
    const index = normalizedHeaders.findIndex(h =>
      h?.includes(mapping.toLowerCase())
    );
    if (index !== -1) return index;
  }
  return -1;
}

export interface ParseHoursResult {
  rows: ParsedHoursRow[];
  errors: string[];
  totalRows: number;
}

export async function parseHoursFile(file: File): Promise<ParseHoursResult> {
  const errors: string[] = [];
  const rows: ParsedHoursRow[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with header detection
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

    if (rawData.length < 2) {
      errors.push('File is empty or has no data rows');
      return { rows, errors, totalRows: 0 };
    }

    // Find header row (first row with column names)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      const row = rawData[i] as string[];
      const hasFirstName = findColumnIndex(row, COLUMN_MAPPINGS.firstName) !== -1;
      const hasDate = findColumnIndex(row, COLUMN_MAPPINGS.date) !== -1;
      if (hasFirstName && hasDate) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = rawData[headerRowIndex] as string[];

    // Find column indices
    const colIndices = {
      firstName: findColumnIndex(headers, COLUMN_MAPPINGS.firstName),
      lastName: findColumnIndex(headers, COLUMN_MAPPINGS.lastName),
      date: findColumnIndex(headers, COLUMN_MAPPINGS.date),
      hours: findColumnIndex(headers, COLUMN_MAPPINGS.hours),
      status: findColumnIndex(headers, COLUMN_MAPPINGS.status),
      entryTime: findColumnIndex(headers, COLUMN_MAPPINGS.entryTime),
      exitTime: findColumnIndex(headers, COLUMN_MAPPINGS.exitTime),
      employeeNumber: findColumnIndex(headers, COLUMN_MAPPINGS.employeeNumber),
    };

    // Validate required columns
    if (colIndices.firstName === -1) {
      errors.push('Missing column: First Name (שם פרטי)');
    }
    if (colIndices.lastName === -1) {
      errors.push('Missing column: Last Name (שם משפחה)');
    }
    if (colIndices.date === -1) {
      errors.push('Missing column: Date (תאריך)');
    }
    if (colIndices.hours === -1) {
      errors.push('Missing column: Hours (שעות)');
    }

    if (errors.length > 0) {
      return { rows, errors, totalRows: rawData.length - headerRowIndex - 1 };
    }

    // Parse data rows
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as unknown[];

      try {
        const firstName = row[colIndices.firstName]?.toString().trim() || '';
        const lastName = row[colIndices.lastName]?.toString().trim() || '';

        if (!firstName && !lastName) continue; // Skip empty rows

        const dateValue = row[colIndices.date];
        let parsedDate: Date | null = null;

        // Handle Excel serial date numbers
        if (typeof dateValue === 'number') {
          parsedDate = XLSX.SSF.parse_date_code(dateValue) as unknown as Date;
          if (parsedDate) {
            const excelDate = XLSX.SSF.parse_date_code(dateValue);
            parsedDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
          }
        } else {
          parsedDate = parseHebrewDate(dateValue?.toString() || '');
        }

        if (!parsedDate) {
          errors.push(`Row ${i + 1}: Invalid date format`);
          continue;
        }

        const hours = parseNumber(row[colIndices.hours] as string | number | null | undefined);

        rows.push({
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim(),
          date: formatDatabaseDate(parsedDate),
          hours,
          status: colIndices.status !== -1 ? row[colIndices.status]?.toString() : undefined,
          entryTime: colIndices.entryTime !== -1 ? row[colIndices.entryTime]?.toString() : undefined,
          exitTime: colIndices.exitTime !== -1 ? row[colIndices.exitTime]?.toString() : undefined,
          employeeNumber: colIndices.employeeNumber !== -1 ? row[colIndices.employeeNumber]?.toString() : undefined,
        });
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return { rows, errors, totalRows: rawData.length - headerRowIndex - 1 };
  } catch (err) {
    errors.push(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return { rows, errors, totalRows: 0 };
  }
}
