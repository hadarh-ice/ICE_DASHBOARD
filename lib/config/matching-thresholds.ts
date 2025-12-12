/**
 * Name Matching Configuration
 *
 * These thresholds control how names are automatically matched vs. requiring manual resolution.
 * Adjusting these values affects the balance between automation and accuracy.
 *
 * The system uses a 3-tier matching strategy:
 * 1. Exact match (normalized names identical) → Always auto-match
 * 2. High-confidence fuzzy match (≥ AUTO_MATCH_THRESHOLD) → Auto-match
 * 3. Medium-confidence fuzzy match (≥ MANUAL_RESOLUTION_THRESHOLD) → User confirmation required
 * 4. Low-confidence or no match (< MANUAL_RESOLUTION_THRESHOLD) → Create new employee
 */

export const NAME_MATCHING_CONFIG = {
  /**
   * Exact match threshold
   * Normalized names are identical (always 1.0 similarity)
   * These are always auto-matched without user intervention
   */
  EXACT_MATCH: 1.0,

  /**
   * High-confidence fuzzy match threshold (auto-match)
   * Names with similarity ≥ 0.85 are automatically matched
   *
   * Example matches at 0.85:
   * - "יוסף כהן" ↔ "יוסי כהן" (nickname variation)
   * - "דוד לוי" ↔ "דוד לוין" (single character difference)
   * - "שרה" ↔ "שרה " (whitespace variation)
   *
   * Impact of INCREASING (e.g., to 0.90):
   * ✅ Fewer false matches (higher accuracy)
   * ❌ More names require manual resolution (more user work)
   *
   * Impact of DECREASING (e.g., to 0.80):
   * ✅ Fewer manual resolutions (less user work)
   * ❌ Higher risk of incorrect matches (lower accuracy)
   */
  AUTO_MATCH_THRESHOLD: 0.85,

  /**
   * Medium-confidence fuzzy match threshold (manual resolution)
   * Names with 0.75 ≤ similarity < 0.85 require user confirmation
   *
   * Example matches at 0.75-0.84:
   * - "משה כהן" ↔ "מושה כוהן" (spelling variations)
   * - "שרה לוי" ↔ "שרה לוין" (similar surnames)
   * - "אלי" ↔ "אליעזר" (short name vs full name)
   *
   * Rationale: In this range, matches could be correct but need verification
   * to avoid false positives (e.g., mixing two different "דוד כהן" employees)
   */
  MANUAL_RESOLUTION_THRESHOLD: 0.75,

  /**
   * First name matching requirement
   * First names must be similar enough before checking full name
   * Prevents false matches like "דוד כהן" → "משה כהן"
   *
   * This is a guard to ensure we don't match employees with completely
   * different first names just because their last names are similar
   */
  FIRST_NAME_THRESHOLD: 0.85,

  /**
   * Low-view articles threshold
   * Articles with views below this are marked as is_low_views = TRUE
   * and excluded from all metrics calculations
   *
   * Rationale for 50 views:
   * - Test content typically has < 50 views
   * - Drafts accidentally published have low views
   * - Not representative of normal published work
   *
   * To adjust: Change this value and re-run data backfill query:
   * UPDATE articles SET is_low_views = (views < NEW_THRESHOLD);
   */
  LOW_VIEWS_THRESHOLD: 50,

  /**
   * Maximum candidates to show in resolution UI
   * Prevents overwhelming users with too many options
   * Shows top N most similar candidates, sorted by similarity score
   */
  MAX_CANDIDATES_PER_CONFLICT: 5,
} as const;

// Re-export individual constants for convenience
export const LOW_VIEWS_THRESHOLD = NAME_MATCHING_CONFIG.LOW_VIEWS_THRESHOLD;
export const AUTO_MATCH_THRESHOLD = NAME_MATCHING_CONFIG.AUTO_MATCH_THRESHOLD;
export const MANUAL_RESOLUTION_THRESHOLD = NAME_MATCHING_CONFIG.MANUAL_RESOLUTION_THRESHOLD;

/**
 * Get confidence level from similarity score
 * Used for UI display and decision-making
 *
 * @param score - Similarity score between 0 and 1
 * @returns Confidence level category
 */
export function getConfidenceLevel(
  score: number
): 'exact' | 'high' | 'medium' | 'low' {
  if (score >= NAME_MATCHING_CONFIG.EXACT_MATCH) return 'exact';
  if (score >= NAME_MATCHING_CONFIG.AUTO_MATCH_THRESHOLD) return 'high';
  if (score >= NAME_MATCHING_CONFIG.MANUAL_RESOLUTION_THRESHOLD)
    return 'medium';
  return 'low';
}

/**
 * Get confidence level display text in Hebrew
 * Used in UI components for user-friendly labels
 *
 * @param score - Similarity score between 0 and 1
 * @returns Hebrew display text with percentage
 */
export function getConfidenceLevelText(score: number): string {
  const level = getConfidenceLevel(score);
  const percent = Math.round(score * 100);

  switch (level) {
    case 'exact':
      return `התאמה מדויקת (${percent}%)`;
    case 'high':
      return `ביטחון גבוה (${percent}%)`;
    case 'medium':
      return `ביטחון בינוני (${percent}%)`;
    case 'low':
      return `ביטחון נמוך (${percent}%)`;
  }
}

/**
 * Check if a similarity score requires manual resolution
 * Used to determine whether to show the name resolution modal
 *
 * @param score - Similarity score between 0 and 1
 * @returns TRUE if manual resolution required
 */
export function requiresManualResolution(score: number): boolean {
  return (
    score >= NAME_MATCHING_CONFIG.MANUAL_RESOLUTION_THRESHOLD &&
    score < NAME_MATCHING_CONFIG.AUTO_MATCH_THRESHOLD
  );
}
