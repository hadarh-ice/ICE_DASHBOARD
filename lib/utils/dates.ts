import { format, parse, isValid } from 'date-fns';

/**
 * Parse a date string in DD/MM/YYYY format (Israeli format)
 */
export function parseHebrewDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Handle various formats
  const cleanDate = dateStr.trim().split(' ')[0]; // Remove time if present

  // Try DD/MM/YYYY format
  let parsed = parse(cleanDate, 'dd/MM/yyyy', new Date());
  if (isValid(parsed)) return parsed;

  // Try D/M/YYYY format
  parsed = parse(cleanDate, 'd/M/yyyy', new Date());
  if (isValid(parsed)) return parsed;

  // Try ISO format
  parsed = new Date(dateStr);
  if (isValid(parsed)) return parsed;

  return null;
}

/**
 * Format a date to DD/MM/YYYY for display
 */
export function formatHebrewDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return '-';
  return format(d, 'dd/MM/yyyy');
}

/**
 * Format a date to YYYY-MM-DD for database storage
 */
export function formatDatabaseDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return '';
  return format(d, 'yyyy-MM-dd');
}

/**
 * Parse Israeli datetime string to ISO format
 */
export function parseHebrewDateTime(dateTimeStr: string): string | null {
  if (!dateTimeStr) return null;

  const parts = dateTimeStr.trim().split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00';

  const date = parseHebrewDate(datePart);
  if (!date) return null;

  const [hours, minutes] = timePart.split(':').map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);

  return date.toISOString();
}
