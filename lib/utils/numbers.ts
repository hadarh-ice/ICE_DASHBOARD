/**
 * Format a number with thousands separators
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('he-IL');
}

/**
 * Format a decimal number with specified precision
 */
export function formatDecimal(num: number | null | undefined, precision: number = 2): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('he-IL', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

/**
 * Parse a number from string, handling Hebrew/Excel formats
 */
export function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  // Remove spaces and replace comma with dot
  const cleaned = value.toString().replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Safe division that returns null instead of Infinity/NaN
 */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  const result = numerator / denominator;
  return isNaN(result) || !isFinite(result) ? null : result;
}
