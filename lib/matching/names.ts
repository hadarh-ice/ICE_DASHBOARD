import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Normalize a Hebrew name for matching
 * - Removes apostrophes and special characters
 * - Normalizes whitespace
 * - Converts to lowercase
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/[\u0027\u2019\u05F3'`״"]/g, '') // Remove apostrophes and quotes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .toLowerCase();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0 to 1)
 */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Find or create an employee by name with fuzzy matching
 */
export async function findOrCreateEmployee(
  fullName: string,
  source: 'hours' | 'articles',
  employeeNumber?: string
): Promise<string> {
  const supabase = createClient();
  const normalized = normalizeName(fullName);

  // 1. Try exact match on alias
  const { data: exactMatch } = await supabase
    .from('employee_aliases')
    .select('employee_id')
    .eq('normalized_alias', normalized)
    .single();

  if (exactMatch) {
    return exactMatch.employee_id;
  }

  // 2. Try fuzzy match on existing aliases
  const { data: allAliases } = await supabase
    .from('employee_aliases')
    .select('employee_id, normalized_alias');

  const firstName = normalized.split(' ')[0];

  for (const alias of allAliases || []) {
    const aliasFirstName = alias.normalized_alias.split(' ')[0];

    // First name must match closely (threshold 0.85)
    if (similarity(firstName, aliasFirstName) >= 0.85) {
      // Full name similarity threshold 0.75
      if (similarity(normalized, alias.normalized_alias) >= 0.75) {
        // Add this variant as new alias
        await supabase.from('employee_aliases').insert({
          employee_id: alias.employee_id,
          alias: fullName,
          normalized_alias: normalized,
          source,
        });
        return alias.employee_id;
      }
    }
  }

  // 3. No match - create new employee
  const nameParts = fullName.trim().split(' ');
  const firstName_ = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const { data: newEmployee, error } = await supabase
    .from('employees')
    .insert({
      canonical_name: fullName.trim(),
      first_name: firstName_,
      last_name: lastName,
      employee_number: employeeNumber,
    })
    .select('id')
    .single();

  if (error || !newEmployee) {
    throw new Error(`Failed to create employee: ${error?.message}`);
  }

  // Add alias
  await supabase.from('employee_aliases').insert({
    employee_id: newEmployee.id,
    alias: fullName,
    normalized_alias: normalized,
    source,
  });

  return newEmployee.id;
}

/**
 * Batch find or create employees (more efficient for large imports)
 * @param names - Array of names to process
 * @param source - Source of the data ('hours' or 'articles')
 * @param supabaseClient - Optional Supabase client (defaults to browser client)
 */
export async function batchFindOrCreateEmployees(
  names: Array<{ fullName: string; employeeNumber?: string }>,
  source: 'hours' | 'articles',
  supabaseClient?: SupabaseClient
): Promise<Map<string, string>> {
  // Use provided client or create browser client (for backward compatibility)
  const supabase = supabaseClient || createClient();
  const result = new Map<string, string>();

  // Get all existing aliases
  const { data: existingAliases } = await supabase
    .from('employee_aliases')
    .select('employee_id, normalized_alias');

  const aliasMap = new Map<string, string>();
  for (const alias of existingAliases || []) {
    aliasMap.set(alias.normalized_alias, alias.employee_id);
  }

  // Process each name
  for (const { fullName, employeeNumber } of names) {
    const normalized = normalizeName(fullName);

    // Check if already processed in this batch
    if (result.has(fullName)) continue;

    // Check exact match
    if (aliasMap.has(normalized)) {
      result.set(fullName, aliasMap.get(normalized)!);
      continue;
    }

    // Check fuzzy match
    let foundMatch = false;
    const firstName = normalized.split(' ')[0];

    for (const [aliasNorm, employeeId] of aliasMap) {
      const aliasFirstName = aliasNorm.split(' ')[0];

      if (similarity(firstName, aliasFirstName) >= 0.85 &&
          similarity(normalized, aliasNorm) >= 0.75) {
        // Add new alias (ignore errors from duplicate aliases)
        const { error: aliasError } = await supabase.from('employee_aliases').insert({
          employee_id: employeeId,
          alias: fullName,
          normalized_alias: normalized,
          source,
        });

        if (aliasError && !aliasError.message.includes('duplicate')) {
          console.error(`[name-matching] Failed to add alias for ${fullName}: ${aliasError.message}`);
        }

        aliasMap.set(normalized, employeeId);
        result.set(fullName, employeeId);
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      // Create new employee
      const nameParts = fullName.trim().split(' ');
      const firstName_ = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data: newEmployee, error: empError } = await supabase
        .from('employees')
        .insert({
          canonical_name: fullName.trim(),
          first_name: firstName_,
          last_name: lastName,
          employee_number: employeeNumber,
        })
        .select('id')
        .single();

      if (empError) {
        // Handle duplicate canonical_name - try to find existing
        if (empError.message.includes('duplicate')) {
          const { data: existingEmp } = await supabase
            .from('employees')
            .select('id')
            .eq('canonical_name', fullName.trim())
            .single();

          if (existingEmp) {
            aliasMap.set(normalized, existingEmp.id);
            result.set(fullName, existingEmp.id);
          } else {
            console.error(`[name-matching] Failed to create or find employee: ${fullName}`);
          }
        } else {
          console.error(`[name-matching] Failed to create employee ${fullName}: ${empError.message}`);
        }
      } else if (newEmployee) {
        // Add alias for the new employee (ignore duplicate errors)
        const { error: aliasError } = await supabase.from('employee_aliases').insert({
          employee_id: newEmployee.id,
          alias: fullName,
          normalized_alias: normalized,
          source,
        });

        if (aliasError && !aliasError.message.includes('duplicate')) {
          console.error(`[name-matching] Failed to add alias for new employee ${fullName}: ${aliasError.message}`);
        }

        aliasMap.set(normalized, newEmployee.id);
        result.set(fullName, newEmployee.id);
      }
    }
  }

  return result;
}
