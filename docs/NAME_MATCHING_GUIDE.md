# Name Matching System Guide

## Overview

The ICE Analytics app uses an intelligent name matching system to handle Hebrew names with variations, spelling differences, and user confirmations. This guide explains how the system works, how to configure it, and what to expect.

---

## How Name Matching Works

### Three-Tier Matching Strategy

The system uses a **priority-based** approach when matching names from uploaded files to existing employees:

```
Priority 1: User-Confirmed Aliases (Always trust)
    ↓
Priority 2: Exact Normalized Match (100% similarity)
    ↓
Priority 3: High-Confidence Fuzzy Match (≥85% similarity)
    ↓
Priority 4: Medium-Confidence Fuzzy Match (75-84% similarity) → **Manual Resolution Required**
    ↓
Priority 5: Low-Confidence or No Match (<75% similarity) → **Create New Employee**
```

### Similarity Scoring

The system uses **Levenshtein distance** to calculate similarity between names:
- 1.0 (100%) = Identical strings
- 0.85-0.99 (85-99%) = Very similar, minor differences
- 0.75-0.84 (75-84%) = Similar but uncertain
- <0.75 (<75%) = Different names

---

## Configuration

All thresholds are centralized in **`/lib/config/matching-thresholds.ts`**:

```typescript
export const NAME_MATCHING_CONFIG = {
  EXACT_MATCH: 1.0,
  AUTO_MATCH_THRESHOLD: 0.85,           // High confidence → auto-match
  MANUAL_RESOLUTION_THRESHOLD: 0.75,    // Medium confidence → user confirmation
  FIRST_NAME_THRESHOLD: 0.85,           // Prevent false surname-only matches
  LOW_VIEWS_THRESHOLD: 50,              // Articles exclusion threshold
  MAX_CANDIDATES_PER_CONFLICT: 5,       // UI limit for candidate options
}
```

### Adjusting Thresholds

#### Increasing `AUTO_MATCH_THRESHOLD` (e.g., 0.85 → 0.90)

**Effect**: More names require manual resolution

**Pros**:
- ✅ Fewer false matches (higher accuracy)
- ✅ Safer for production environments
- ✅ Less risk of mixing different employees with similar names

**Cons**:
- ❌ More manual work for users
- ❌ Slower upload process
- ❌ More user confirmations needed

**Example**:
```
Before (0.85): "יוסי כהן" → auto-matched to "יוסף כהן" ✅
After (0.90):  "יוסי כהן" → requires manual confirmation ⚠️
```

#### Decreasing `AUTO_MATCH_THRESHOLD` (e.g., 0.85 → 0.80)

**Effect**: Fewer names require manual resolution

**Pros**:
- ✅ Less manual work for users
- ✅ Faster upload process
- ✅ Better for large datasets

**Cons**:
- ❌ Higher risk of incorrect matches
- ❌ Could merge different employees with similar names
- ❌ Data quality concerns

**Example**:
```
Before (0.85): "משה כהן" → requires confirmation ⚠️
After (0.80):  "משה כהן" → auto-matched to "מושה כוהן" ✅ (risky!)
```

#### Recommended Settings

For **most use cases**, the default thresholds work well:
- AUTO_MATCH_THRESHOLD: 0.85
- MANUAL_RESOLUTION_THRESHOLD: 0.75

**Conservative** (prioritize accuracy):
- AUTO_MATCH_THRESHOLD: 0.90
- MANUAL_RESOLUTION_THRESHOLD: 0.80

**Aggressive** (prioritize speed):
- AUTO_MATCH_THRESHOLD: 0.80
- MANUAL_RESOLUTION_THRESHOLD: 0.70

---

## Hebrew Name Normalization

### Normalization Rules

The system normalizes Hebrew names before comparison:

1. **Final Letters (Sofit)** → Regular form:
   - ם → מ
   - ן → נ
   - ץ → צ
   - ך → כ
   - ף → פ

2. **Geresh/Apostrophe Variants** → Standard apostrophe:
   - ׳ (Hebrew geresh)
   - ״ (Hebrew gershayim)
   - ' (single quote)
   - " (double quote)
   - ` (backtick)

3. **Whitespace** → Trimmed and normalized to single spaces

4. **Case** → Converted to lowercase (for Latin characters)

### Normalization Examples

| Original Name | Normalized Name | Match? |
|--------------|----------------|---------|
| "דוד כהן" | "דוד כהן" | ✅ Exact |
| "דוד   כהן" | "דוד כהן" | ✅ Exact (whitespace) |
| "דוד כהן  " | "דוד כהן" | ✅ Exact (trailing space) |
| "ג׳ונסון" | "ג'ונסון" | ✅ Exact (geresh) |
| "גונסון" | "גונסון" | ❌ Different (no apostrophe) |
| "שרה" | "שרה" | ✅ Exact |
| "שרה לוין" | "שרה לוי" | ⚠️ Fuzzy match (final letter) |

---

## Similarity Score Examples

### High Confidence (≥0.85) - Auto-Matched

| Input Name | Matched To | Similarity | Reason |
|-----------|-----------|-----------|--------|
| יוסף כהן | יוסי כהן | 0.91 | Nickname variation |
| דוד לוי | דוד לוין | 0.87 | Single char difference |
| שרה | שרה  | 1.0 | Exact (whitespace ignored) |
| מיכל | מיכל אבני | 0.86 | Partial match (first name) |

### Medium Confidence (0.75-0.84) - Manual Resolution

| Input Name | Candidate | Similarity | Reason |
|-----------|-----------|-----------|--------|
| משה כהן | מושה כוהן | 0.82 | Spelling variation |
| שרה לוי | שרה לוין | 0.84 | Similar surnames |
| אלי | אליעזר | 0.75 | Short vs. full name |

### Low Confidence (<0.75) - Create New

| Input Name | Best Match | Similarity | Reason |
|-----------|-----------|-----------|--------|
| דוד כהן | משה כהן | 0.67 | Different first names |
| ישראל ישראלי | ישראל כהן | 0.70 | Different last names |
| יונתן | דן | 0.55 | Completely different |

---

## User-Confirmed Aliases

### What Are They?

User-confirmed aliases are name mappings that a user has manually approved via the name resolution UI. Once confirmed, these mappings are **always respected** in future uploads.

### How They Work

1. **First Upload**: "יוסי כהן" has 0.82 similarity to "יוסף כהן" → User confirms match
2. **Database**: Alias created with `confirmed_by_user = TRUE`
3. **Future Uploads**: "יוסי כהן" → **Instantly matched** to "יוסף כהן" (no UI prompt)

### Benefits

- ✅ Reduces manual work over time
- ✅ Learns from user corrections
- ✅ Handles organization-specific name variations
- ✅ Priority over fuzzy matching

### Database Storage

```sql
SELECT * FROM employee_aliases
WHERE confirmed_by_user = TRUE;

-- Example result:
employee_id | alias      | confirmed_by_user | confirmed_at
------------|------------|-------------------|------------------
uuid-123    | יוסי כהן   | TRUE              | 2025-01-15 10:30
uuid-456    | משה כוהן   | TRUE              | 2025-01-15 10:32
```

---

## Upload Flow Walkthrough

### Scenario: Uploading Hours Report with 100 Names

#### Step 1: Name Analysis

System analyzes all unique names:

```
100 unique names found
 ├─ 75 auto-matched (≥85% similarity)
 ├─ 10 user-confirmed (from previous uploads)
 ├─ 10 need resolution (75-84% similarity)
 └─ 5 low confidence (<75% similarity)
```

#### Step 2: Manual Resolution (If Needed)

If conflicts exist, **Name Resolution Modal** appears:

```
┌─────────────────────────────────────────────┐
│ Name Resolution (1 of 15)                   │
├─────────────────────────────────────────────┤
│ Input Name: "יוסי כהן"                      │
│ Appears in rows: 12, 45, 78                │
│                                             │
│ Confidence: Medium (82%)                    │
│                                             │
│ Match to existing employee:                 │
│  ○ יוסף כהן (82% similarity)               │
│  ○ יוסי כהן אברהם (75% similarity)         │
│                                             │
│ Or:                                         │
│  ○ Create new employee: "יוסי כהן"         │
│                                             │
│ [Back] [Next]                               │
└─────────────────────────────────────────────┘
```

User selects one option, system moves to next conflict.

#### Step 3: Resolution Execution

System creates:
- New employees (if "Create new" chosen)
- Confirmed aliases (`confirmed_by_user = TRUE`)
- Name mapping for upload

#### Step 4: Data Upload

Hours data uploaded with resolved employee IDs.

---

## Low-View Articles Filtering

### What Are Low-View Articles?

Articles with **views < 50** are marked as `is_low_views = TRUE` in the database.

### Why Filter Them?

- Test content typically has <50 views
- Drafts accidentally published have low engagement
- Not representative of normal published work
- Could skew efficiency metrics

### How It Works

1. **Upload**: All articles stored, but marked with `is_low_views = (views < 50)`
2. **Metrics Queries**: Filter applied: `.eq('is_low_views', false)`
3. **Result**: Low-view articles excluded from all performance calculations

### Changing the Threshold

To use a different threshold (e.g., 100 views):

1. Update `LOW_VIEWS_THRESHOLD` in `/lib/config/matching-thresholds.ts`:
   ```typescript
   LOW_VIEWS_THRESHOLD: 100,  // Changed from 50
   ```

2. Run database backfill:
   ```sql
   UPDATE articles SET is_low_views = (views < 100);
   ```

3. Future uploads will use new threshold automatically

---

## Hours-Without-Articles Warnings

### What Are They?

After uploading hours data, the system checks if any employees have **hours but no articles** in the system.

### Display Example

```
⚠️ Employees with Hours but No Articles (3)

• דוד לוי - 45.5 hours (2025-01-01 to 2025-01-31)
• משה כהן - 32.0 hours (2025-01-01 to 2025-01-31)
• שרה אברהם - 18.0 hours (2025-01-01 to 2025-01-31)

ℹ️ These employees may write articles later, or hours data may be incomplete.
```

### Is This Blocking?

**No**. Hours data is still uploaded successfully. This is just an **informational warning** to alert the manager.

### Why Show This?

- Helps identify missing articles data
- Flags employees who might need article attribution
- Catches data entry errors early

---

## Troubleshooting

### Problem: Too many manual resolutions

**Cause**: AUTO_MATCH_THRESHOLD too high (e.g., 0.90)

**Solution**: Lower threshold to 0.85 or 0.80

---

### Problem: Incorrect auto-matches

**Cause**: AUTO_MATCH_THRESHOLD too low (e.g., 0.75)

**Solution**: Increase threshold to 0.85 or 0.90

---

### Problem: Same name keeps asking for confirmation

**Cause**: User previously clicked "Cancel" without confirming

**Solution**: Complete the name resolution process. Once confirmed, future uploads won't ask again.

---

### Problem: Duplicate employees created

**Cause**: User chose "Create new" instead of matching to existing

**Solution**:
1. Manually merge employees in database (see migration script)
2. Update `employee_aliases` to point to correct employee
3. Future uploads will use corrected mapping

---

## Advanced Features

### First Name Threshold

The `FIRST_NAME_THRESHOLD: 0.85` prevents false matches like:

```
❌ BAD: "דוד כהן" matched to "משה כהן" (0.80 overall, but different first names)
✅ GOOD: First names must be ≥0.85 similar before checking full name
```

This prevents matching employees who share only a surname.

### Employee Number Priority

When uploading **hours data**, if an employee number is provided:
1. System checks if employee exists with that number
2. If found, uses that employee (even if name differs)
3. Otherwise, falls back to name matching

Example:
```
Input: "יוסי כהן" with employeeNumber "12345"
System: Finds employee with number 12345 → Uses that employee ✅
Ignores: Name matching (number takes priority)
```

---

## Performance Notes

### Name Analysis Speed

- **1,000 unique names**: ~2 seconds
- **100 resolutions**: ~3 seconds
- **Metrics queries**: <50ms increase with `is_low_views` filter

### Optimization Tips

1. **Batch Processing**: System processes 100-500 rows per chunk
2. **In-Memory Lookups**: All aliases fetched once, processed in memory
3. **Indexed Queries**: Database indexes on `normalized_alias` and `is_low_views`

---

## Database Schema

### `employee_aliases` Table

```sql
CREATE TABLE employee_aliases (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source TEXT CHECK (source IN ('hours', 'articles')),
  confirmed_by_user BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aliases_normalized ON employee_aliases(normalized_alias);
CREATE INDEX idx_aliases_confirmed ON employee_aliases(confirmed_by_user, employee_id);
```

### `articles` Table

```sql
ALTER TABLE articles ADD COLUMN is_low_views BOOLEAN DEFAULT FALSE;
CREATE INDEX idx_articles_low_views ON articles(is_low_views);

-- Backfill
UPDATE articles SET is_low_views = (views < 50);
```

---

## Summary

The name matching system provides:
- ✅ **Intelligent Hebrew name handling** with normalization
- ✅ **User-confirmed learning** that improves over time
- ✅ **Configurable thresholds** for accuracy vs. speed
- ✅ **Low-view filtering** for clean metrics
- ✅ **Informational warnings** for data gaps

**Configuration File**: `/lib/config/matching-thresholds.ts`

**Default Settings Work Well** for most use cases. Adjust only if you notice:
- Too many manual resolutions (lower threshold)
- Incorrect auto-matches (raise threshold)

---

## Questions?

For issues or feature requests, check:
- GitHub: [Repository Link]
- Docs: `/docs/`
- Code: `/lib/matching/names.ts`
