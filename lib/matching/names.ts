import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// HEBREW NAME NORMALIZATION
// ============================================================================

/**
 * Hebrew final letter (sofit) to regular letter mappings
 * Final letters appear at the end of words in Hebrew
 */
const HEBREW_FINAL_LETTERS: Record<string, string> = {
  '\u05DD': '\u05DE', // Final Mem (ם) -> Mem (מ)
  '\u05DF': '\u05E0', // Final Nun (ן) -> Nun (נ)
  '\u05E5': '\u05E6', // Final Tsadi (ץ) -> Tsadi (צ)
  '\u05DA': '\u05DB', // Final Kaf (ך) -> Kaf (כ)
  '\u05E3': '\u05E4', // Final Pe (ף) -> Pe (פ)
};

/**
 * Characters to remove during normalization
 * Includes all apostrophe variants, quotes, and Hebrew punctuation
 */
const CHARS_TO_REMOVE_PATTERN = new RegExp(
  [
    '\u0027', // Apostrophe (')
    '\u0060', // Grave accent (`)
    '\u00B4', // Acute accent (´)
    '\u2018', // Left single quote (')
    '\u2019', // Right single quote (')
    '\u201B', // Single high-reversed-9 quote (‛)
    '\u0022', // Quotation mark (")
    '\u201C', // Left double quote (")
    '\u201D', // Right double quote (")
    '\u05F3', // Hebrew Geresh (׳) - commonly used for foreign sounds like ג׳
    '\u05F4', // Hebrew Gershayim (״) - used for abbreviations
    '\u05BE', // Hebrew Maqaf (־) - hyphen
    '\u05BF', // Hebrew Rafe (ֿ) - diacritical mark
    "'",      // Literal single quote
    '"',      // Literal double quote
    '`',      // Literal backtick
    '״',      // Hebrew gershayim (literal)
    '׳',      // Hebrew geresh (literal)
  ].join(''),
  'g'
);

/**
 * Normalize a Hebrew name for matching
 *
 * Handles:
 * - Removes all apostrophe and quote variants (Hebrew and ASCII)
 * - Normalizes Hebrew final letters (sofit) to regular forms
 * - Normalizes whitespace
 * - Converts to lowercase
 *
 * Examples:
 *   "ג'ונסון"   -> "גונסון"
 *   "ג׳ונסון"   -> "גונסון"
 *   "גונסון׳"   -> "גונסון"
 *   " ג׳ונסון " -> "גונסון"
 *   "כהן"       -> "כהנ"  (final nun normalized)
 *   "שלום"      -> "שלומ" (final mem normalized)
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  let normalized = name.trim();

  // Step 1: Remove all apostrophes, quotes, and special punctuation
  normalized = normalized.replace(CHARS_TO_REMOVE_PATTERN, '');

  // Step 2: Normalize Hebrew final letters to regular forms
  for (const [final, regular] of Object.entries(HEBREW_FINAL_LETTERS)) {
    normalized = normalized.replace(new RegExp(final, 'g'), regular);
  }

  // Step 3: Normalize whitespace (multiple spaces -> single space)
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Step 4: Lowercase for consistent matching
  normalized = normalized.toLowerCase();

  return normalized;
}

/**
 * Normalize for display - keeps original characters but cleans whitespace
 * Use this when storing the canonical_name for display purposes
 */
export function normalizeForDisplay(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ');
}

// ============================================================================
// STRING SIMILARITY (Levenshtein Distance)
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Lower distance = more similar
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
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0 to 1)
 * 1 = identical, 0 = completely different
 */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

// ============================================================================
// EMPLOYEE MATCHING - Single Employee
// ============================================================================

/**
 * Find or create an employee by name with fuzzy matching
 * For single employee lookups (used in browser context)
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
        await supabase.from('employee_aliases').upsert({
          employee_id: alias.employee_id,
          alias: fullName,
          normalized_alias: normalized,
          source,
        }, { onConflict: 'normalized_alias', ignoreDuplicates: true });
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
      canonical_name: normalizeForDisplay(fullName),
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

// ============================================================================
// EMPLOYEE MATCHING - Batch Processing
// ============================================================================

/**
 * Match statistics for batch operations
 */
export interface MatchStats {
  exactMatches: number;
  fuzzyMatches: number;
  newEmployees: number;
  total: number;
}

/**
 * Batch find or create employees (optimized for large imports)
 *
 * @param names - Array of names to process
 * @param source - Source of the data ('hours' or 'articles')
 * @param supabaseClient - Optional Supabase client (for server-side with admin access)
 * @returns Map of fullName -> employee_id
 *
 * Matching strategy:
 * 1. Exact match on normalized_alias
 * 2. Fuzzy match using Levenshtein distance (first name >= 0.85, full name >= 0.75)
 * 3. Create new employee if no match
 */
export async function batchFindOrCreateEmployees(
  names: Array<{ fullName: string; employeeNumber?: string }>,
  source: 'hours' | 'articles',
  supabaseClient?: SupabaseClient
): Promise<Map<string, string>> {
  const supabase = supabaseClient || createClient();
  const result = new Map<string, string>();
  const stats: MatchStats = { exactMatches: 0, fuzzyMatches: 0, newEmployees: 0, total: 0 };

  // Get all existing aliases in one query
  const { data: existingAliases, error: aliasError } = await supabase
    .from('employee_aliases')
    .select('employee_id, normalized_alias');

  if (aliasError) {
    console.error('[name-matching] Failed to fetch aliases:', aliasError.message);
  }

  // Build lookup maps
  const aliasMap = new Map<string, string>();
  const aliasListForFuzzy: Array<{ employeeId: string; normalized: string }> = [];

  for (const alias of existingAliases || []) {
    aliasMap.set(alias.normalized_alias, alias.employee_id);
    aliasListForFuzzy.push({
      employeeId: alias.employee_id,
      normalized: alias.normalized_alias,
    });
  }

  // Deduplicate input names
  const uniqueNames = [...new Map(names.map(n => [n.fullName, n])).values()];
  stats.total = uniqueNames.length;

  // Track names that need new employees or aliases
  const newEmployeesToCreate: Array<{
    fullName: string;
    normalized: string;
    employeeNumber?: string;
  }> = [];

  const newAliasesToCreate: Array<{
    employee_id: string;
    alias: string;
    normalized_alias: string;
    source: 'hours' | 'articles';
  }> = [];

  // Process each unique name
  for (const { fullName, employeeNumber } of uniqueNames) {
    const normalized = normalizeName(fullName);

    // Skip if already processed in this batch
    if (result.has(fullName)) continue;

    // Step 1: Exact match
    if (aliasMap.has(normalized)) {
      result.set(fullName, aliasMap.get(normalized)!);
      stats.exactMatches++;
      continue;
    }

    // Step 2: Fuzzy match
    let bestMatch: { employeeId: string; score: number } | null = null;
    const inputFirstName = normalized.split(' ')[0];

    for (const alias of aliasListForFuzzy) {
      const aliasFirstName = alias.normalized.split(' ')[0];

      // First name must match closely (threshold 0.85)
      const firstNameSim = similarity(inputFirstName, aliasFirstName);
      if (firstNameSim < 0.85) continue;

      // Full name similarity (threshold 0.75)
      const fullNameSim = similarity(normalized, alias.normalized);
      if (fullNameSim >= 0.75) {
        if (!bestMatch || fullNameSim > bestMatch.score) {
          bestMatch = { employeeId: alias.employeeId, score: fullNameSim };
        }
      }
    }

    if (bestMatch) {
      result.set(fullName, bestMatch.employeeId);
      stats.fuzzyMatches++;

      // Queue new alias creation
      newAliasesToCreate.push({
        employee_id: bestMatch.employeeId,
        alias: fullName,
        normalized_alias: normalized,
        source,
      });

      // Update local maps for subsequent lookups within this batch
      aliasMap.set(normalized, bestMatch.employeeId);
      continue;
    }

    // Step 3: No match - queue for creation
    newEmployeesToCreate.push({ fullName, normalized, employeeNumber });
  }

  // Batch create new employees (in chunks of 100)
  const EMPLOYEE_BATCH_SIZE = 100;
  for (let i = 0; i < newEmployeesToCreate.length; i += EMPLOYEE_BATCH_SIZE) {
    const batch = newEmployeesToCreate.slice(i, i + EMPLOYEE_BATCH_SIZE);

    const employeeRecords = batch.map(({ fullName, employeeNumber }) => {
      const nameParts = fullName.trim().split(' ');
      return {
        canonical_name: normalizeForDisplay(fullName),
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        employee_number: employeeNumber || null,
      };
    });

    const { data: created, error: createError } = await supabase
      .from('employees')
      .upsert(employeeRecords, { onConflict: 'canonical_name', ignoreDuplicates: false })
      .select('id, canonical_name');

    if (createError) {
      console.error('[name-matching] Failed to create employees batch:', createError.message);
      continue;
    }

    // Map created employees and queue their aliases
    for (const emp of created || []) {
      const original = batch.find(n => normalizeForDisplay(n.fullName) === emp.canonical_name);
      if (original) {
        result.set(original.fullName, emp.id);
        aliasMap.set(original.normalized, emp.id);
        stats.newEmployees++;

        newAliasesToCreate.push({
          employee_id: emp.id,
          alias: original.fullName,
          normalized_alias: original.normalized,
          source,
        });
      }
    }
  }

  // Batch create new aliases (in chunks of 100)
  const ALIAS_BATCH_SIZE = 100;
  for (let i = 0; i < newAliasesToCreate.length; i += ALIAS_BATCH_SIZE) {
    const batch = newAliasesToCreate.slice(i, i + ALIAS_BATCH_SIZE);

    const { error: aliasError } = await supabase
      .from('employee_aliases')
      .upsert(batch, { onConflict: 'normalized_alias', ignoreDuplicates: true });

    if (aliasError && !aliasError.message.includes('duplicate')) {
      console.error('[name-matching] Failed to create aliases batch:', aliasError.message);
    }
  }

  // Log match statistics
  console.log(
    `[name-matching] Processed ${stats.total} names: ` +
    `${stats.exactMatches} exact, ${stats.fuzzyMatches} fuzzy, ${stats.newEmployees} new`
  );

  return result;
}

/**
 * Get matching statistics from the last batch operation
 * Useful for reporting in upload results
 */
export function getMatchStats(
  result: Map<string, string>,
  originalNames: Array<{ fullName: string }>
): { matched: number; unmatched: number; matchRate: number } {
  const matched = [...originalNames].filter(n => result.has(n.fullName)).length;
  const unmatched = originalNames.length - matched;
  const matchRate = originalNames.length > 0
    ? Math.round((matched / originalNames.length) * 100)
    : 100;

  return { matched, unmatched, matchRate };
}

// ============================================================================
// NAME RESOLUTION - Analysis and Manual Confirmation
// ============================================================================

import {
  NameAnalysisResult,
  AutoMatchedName,
  NameConflict,
  NameCandidate,
  NameResolution,
} from '@/types';
import { NAME_MATCHING_CONFIG } from '@/lib/config/matching-thresholds';

/**
 * Find candidate employees with similarity scores
 * Helper function for analyzeNamesForResolution
 *
 * @param normalized - Normalized name to match
 * @param allAliases - All existing employee aliases
 * @returns Sorted array of candidates (highest similarity first)
 */
function findCandidatesWithScores(
  normalized: string,
  allAliases: Array<{
    employeeId: string;
    normalized: string;
    canonical: string;
    confirmedByUser: boolean;
  }>
): NameCandidate[] {
  const firstName = normalized.split(' ')[0];
  const candidates: NameCandidate[] = [];

  for (const alias of allAliases) {
    const aliasFirstName = alias.normalized.split(' ')[0];

    // First name must match closely (use config threshold)
    const firstNameSim = similarity(firstName, aliasFirstName);
    if (firstNameSim < NAME_MATCHING_CONFIG.FIRST_NAME_THRESHOLD) continue;

    // Calculate full name similarity
    const fullNameSim = similarity(normalized, alias.normalized);

    // Only include candidates above manual resolution threshold
    if (fullNameSim >= NAME_MATCHING_CONFIG.MANUAL_RESOLUTION_THRESHOLD) {
      candidates.push({
        employee_id: alias.employeeId,
        canonical_name: alias.canonical,
        similarity_score: fullNameSim,
        is_user_confirmed: alias.confirmedByUser,
      });
    }
  }

  // Sort by similarity score (descending), then by user-confirmed status
  candidates.sort((a, b) => {
    // Prioritize user-confirmed matches
    if (a.is_user_confirmed && !b.is_user_confirmed) return -1;
    if (!a.is_user_confirmed && b.is_user_confirmed) return 1;
    // Then by similarity score
    return b.similarity_score - a.similarity_score;
  });

  // Limit to max candidates from config
  return candidates.slice(0, NAME_MATCHING_CONFIG.MAX_CANDIDATES_PER_CONFLICT);
}

/**
 * Analyze names for resolution (before upload)
 * Splits names into auto-matched vs. needs-resolution
 *
 * This is the NEW entry point for the name resolution flow.
 * Call this BEFORE proceeding with upload to identify conflicts.
 *
 * @param names - Array of names with row tracking
 * @param source - Source of the data ('hours' or 'articles')
 * @param supabaseClient - Optional Supabase client (for server-side)
 * @returns NameAnalysisResult with auto-matched names and conflicts
 *
 * Matching priority (highest to lowest):
 * 1. User-confirmed aliases (always use)
 * 2. Exact matches (normalized identical)
 * 3. High-confidence fuzzy matches (≥0.85) - auto-match
 * 4. Medium-confidence fuzzy matches (0.75-0.84) - manual resolution
 * 5. Low-confidence or no match (<0.75) - will create new
 */
export async function analyzeNamesForResolution(
  names: Array<{ fullName: string; employeeNumber?: string; rowNumbers: number[] }>,
  source: 'hours' | 'articles',
  supabaseClient?: SupabaseClient
): Promise<NameAnalysisResult> {
  const supabase = supabaseClient || createClient();

  // Step 1: Fetch all existing aliases (including confirmation status)
  const { data: existingAliases, error: aliasError } = await supabase
    .from('employee_aliases')
    .select(`
      employee_id,
      normalized_alias,
      confirmed_by_user,
      employee:employees(canonical_name)
    `);

  if (aliasError) {
    console.error('[name-resolution] Failed to fetch aliases:', aliasError.message);
    throw new Error('Failed to fetch employee aliases');
  }

  // Step 2: Build lookup structures
  // Priority: User-confirmed > Exact match > Fuzzy match
  const confirmedAliases = new Map<string, string>(); // normalized → employee_id
  const exactAliases = new Map<string, string>();
  const fuzzyAliases: Array<{
    employeeId: string;
    normalized: string;
    canonical: string;
    confirmedByUser: boolean;
  }> = [];

  for (const alias of existingAliases || []) {
    if (alias.confirmed_by_user) {
      confirmedAliases.set(alias.normalized_alias, alias.employee_id);
    } else {
      exactAliases.set(alias.normalized_alias, alias.employee_id);
    }
    fuzzyAliases.push({
      employeeId: alias.employee_id,
      normalized: alias.normalized_alias,
      canonical: (alias.employee as any)?.canonical_name || 'Unknown',
      confirmedByUser: alias.confirmed_by_user || false,
    });
  }

  // Step 3: Analyze each unique name
  const autoMatched: AutoMatchedName[] = [];
  const conflictsMap = new Map<string, NameConflict>();

  for (const { fullName, rowNumbers } of names) {
    const normalized = normalizeName(fullName);

    // Priority 1: User-confirmed alias (always use this)
    if (confirmedAliases.has(normalized)) {
      autoMatched.push({
        inputName: fullName,
        employee_id: confirmedAliases.get(normalized)!,
        matchType: 'user-confirmed',
        similarity_score: 1.0,
      });
      continue;
    }

    // Priority 2: Exact match (normalized identical)
    if (exactAliases.has(normalized)) {
      autoMatched.push({
        inputName: fullName,
        employee_id: exactAliases.get(normalized)!,
        matchType: 'exact',
        similarity_score: 1.0,
      });
      continue;
    }

    // Priority 3: Fuzzy matching with confidence thresholds
    const candidates = findCandidatesWithScores(normalized, fuzzyAliases);

    if (candidates.length === 0) {
      // No match found - will create new employee
      conflictsMap.set(fullName, {
        inputName: fullName,
        normalized,
        candidates: [],
        confidence: 'low',
        rowNumbers,
      });
      continue;
    }

    const bestCandidate = candidates[0];

    // Auto-match if high confidence (≥0.85)
    if (
      bestCandidate.similarity_score >= NAME_MATCHING_CONFIG.AUTO_MATCH_THRESHOLD
    ) {
      autoMatched.push({
        inputName: fullName,
        employee_id: bestCandidate.employee_id,
        matchType: 'fuzzy-high',
        similarity_score: bestCandidate.similarity_score,
      });
      continue;
    }

    // Needs manual resolution (0.75 ≤ score < 0.85)
    if (
      bestCandidate.similarity_score >=
      NAME_MATCHING_CONFIG.MANUAL_RESOLUTION_THRESHOLD
    ) {
      conflictsMap.set(fullName, {
        inputName: fullName,
        normalized,
        candidates: candidates,
        confidence: 'medium',
        rowNumbers,
      });
      continue;
    }

    // Very low confidence (< 0.75) - will create new
    conflictsMap.set(fullName, {
      inputName: fullName,
      normalized,
      candidates: candidates.slice(0, 3), // Show top 3 for reference
      confidence: 'low',
      rowNumbers,
    });
  }

  const result: NameAnalysisResult = {
    autoMatched,
    needsResolution: Array.from(conflictsMap.values()),
    totalUniqueNames: names.length,
  };

  console.log(
    `[name-resolution] Analyzed ${result.totalUniqueNames} names: ` +
      `${result.autoMatched.length} auto-matched, ` +
      `${result.needsResolution.length} need resolution`
  );

  return result;
}

/**
 * Execute name resolutions and create employee mappings
 * Called AFTER user has resolved conflicts in the UI
 *
 * @param resolutions - User's resolution decisions
 * @param source - Source of the data ('hours' or 'articles')
 * @param supabaseClient - Optional Supabase client (for server-side)
 * @returns Map of fullName → employee_id
 */
export async function executeNameResolutions(
  resolutions: NameResolution[],
  source: 'hours' | 'articles',
  supabaseClient?: SupabaseClient
): Promise<Map<string, string>> {
  const supabase = supabaseClient || createClient();
  const resultMap = new Map<string, string>();

  // Separate resolutions by action type
  const matchResolutions = resolutions.filter((r) => r.action === 'match');
  const createNewResolutions = resolutions.filter((r) => r.action === 'create-new');

  console.log(
    `[name-resolution] Executing ${resolutions.length} resolutions: ` +
      `${matchResolutions.length} matches, ${createNewResolutions.length} new`
  );

  // Handle matches: Create new aliases
  const newAliases = matchResolutions.map((r) => ({
    employee_id: r.employee_id!,
    alias: r.inputName,
    normalized_alias: normalizeName(r.inputName),
    source,
    confirmed_by_user: r.confirmed_by_user,
    confirmed_at: r.confirmed_by_user ? new Date().toISOString() : null,
  }));

  if (newAliases.length > 0) {
    const { error } = await supabase
      .from('employee_aliases')
      .upsert(newAliases, { onConflict: 'normalized_alias' });

    if (error) {
      console.error('[name-resolution] Failed to create aliases:', error);
    } else {
      matchResolutions.forEach((r) => resultMap.set(r.inputName, r.employee_id!));
    }
  }

  // Handle create-new: Batch create employees
  const employeesToCreate = createNewResolutions.map((r) => {
    const nameParts = r.inputName.trim().split(' ');
    return {
      canonical_name: normalizeForDisplay(r.inputName),
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
    };
  });

  if (employeesToCreate.length > 0) {
    const { data: created, error } = await supabase
      .from('employees')
      .upsert(employeesToCreate, { onConflict: 'canonical_name' })
      .select('id, canonical_name');

    if (error) {
      console.error('[name-resolution] Failed to create employees:', error);
    } else {
      // Map created employees and create their aliases
      const newEmployeeAliases = [];
      for (const emp of created || []) {
        const resolution = createNewResolutions.find(
          (r) => normalizeForDisplay(r.inputName) === emp.canonical_name
        );
        if (resolution) {
          resultMap.set(resolution.inputName, emp.id);
          newEmployeeAliases.push({
            employee_id: emp.id,
            alias: resolution.inputName,
            normalized_alias: normalizeName(resolution.inputName),
            source,
            confirmed_by_user: resolution.confirmed_by_user,
            confirmed_at: resolution.confirmed_by_user
              ? new Date().toISOString()
              : null,
          });
        }
      }

      if (newEmployeeAliases.length > 0) {
        await supabase.from('employee_aliases').insert(newEmployeeAliases);
      }
    }
  }

  console.log(
    `[name-resolution] Execution complete: ${resultMap.size} names mapped`
  );

  return resultMap;
}
