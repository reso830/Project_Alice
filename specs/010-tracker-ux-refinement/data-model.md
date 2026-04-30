# Data Model: Application Tracker UX & Data Refinement Pack

**Branch**: `010-tracker-ux-refinement` | **Date**: 2026-04-30

---

## Entity: JobApplication (updated fields)

The core `JobApplication` entity is unchanged structurally. Two fields gain clarified types for this feature.

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| id | string | ✅ | non-empty UUID | Auto-generated |
| company_name | string | ✅ | non-empty | |
| job_title | string | ✅ | non-empty | |
| status | string (enum) | ✅ | one of STATUS_VALUES | 9 controlled values |
| last_status_update | ISO date string | ✅ | valid date | Auto-set on create and on status change |
| source_platform | string | ❌ | | |
| job_posting_url | string | ❌ | valid URL when present | |
| salary | integer \| null | ❌ | positive integer or null | **Changed**: was freeform string (e.g. `"$120k–$140k"`). Now stored as plain integer (e.g. `150000`). Display via `formatPeso()`. |
| notes | string | ❌ | | |
| follow_up_action | string | ❌ | | |
| follow_up_date | ISO date string | ❌ | valid date when present | |
| compat | integer (0–100) \| null | ❌ | 0 ≤ value ≤ 100 | |
| fav | boolean | ❌ | `true` or `false` | **Clarified**: must be boolean, default `false`. SQLite stores as 0/1 — coerce to boolean on read. Force to `false` when application is archived. |
| archived | boolean | ❌ | `true` or `false` | Default `false`. Excluded from default list view when `true`. SQLite stores as 0/1 — coerce to boolean on read. |
| recruiter | string | ❌ | | |
| responsibilities | string | ❌ | | |
| skills | JSON array of strings | ❌ | | |
| application_date | ISO date string | ❌ | valid date when present | |

### Migration note

Existing records with string salary values (e.g. `"$120,000 – $140,000"`) must be migrated to numeric integers in `db-seed.js` using the existing `parseSalaryLower()` utility to recover the lower bound as an integer. Only fall back to `null` if parsing fails. The server should normalize any remaining legacy string salary to `null` on read to prevent display errors until migration is fully applied. The `archived` column may not exist in older DB schemas; add a migration step to create it with `DEFAULT 0` if absent.

---

## STATUS_CONFIG (updated)

Defined in `src/models/application.js`. `shared/constants.js` imports from `application.js` — do not maintain a duplicate definition there.

| Key | Label | badgeBg | badgeText | borderAccent | Change |
|---|---|---|---|---|---|
| `wishlisted` | Wishlisted | `#FCE7F3` | `#9D174D` | `#EC4899` | **Updated** — was purple |
| `applied` | Applied | `#DBEAFE` | `#1E40AF` | `#3B82F6` | No change |
| `phone_screen` | Phone Screen | `#FFEDD5` | `#9A3412` | `#F97316` | No change |
| `interview` | Interview | `#FEF9C3` | `#854D0E` | `#EAB308` | No change |
| `assessment` | Technical Assessment | `#EDE9FE` | `#5B21B6` | `#8B5CF6` | No change |
| `offer` | Offer | `#DCFCE7` | `#166534` | `#22C55E` | No change |
| `rejected` | Rejected | `#FEE2E2` | `#991B1B` | `#EF4444` | No change |
| `withdrawn` | Withdrawn | `#F1F5F9` | `#475569` | `#64748B` | No change |
| `ghosted` | Ghosted | `#F8FAFC` | `#64748B` | `#94A3B8` | No change |

All 9 statuses now have visually distinct hues with no near-duplicate pairs.

---

## Entity: FilterState (persistent)

Stored in `localStorage` under key `'apptracker_filters'`. Read on page load; written on every filter change.

| Field | Type | Default | Notes |
|---|---|---|---|
| statuses | string[] | `[]` | Valid STATUS_VALUES keys; unknown keys discarded on load |
| companies | string[] | `[]` | Company name strings |
| salaryMin | integer \| null | `null` | ₱ value or null (no lower bound) |
| salaryMax | integer \| null | `null` | ₱ value or null (no upper bound) |
| compatMin | integer \| null | `null` | 0–100 or null |
| compatMax | integer \| null | `null` | 0–100 or null |
| favoritesOnly | boolean | `false` | **New** — filter to favorited applications only |

### FilterState validation on load

- Unknown `statuses` keys are discarded silently.
- `salaryMin` / `salaryMax`: must be integers; if both set, `salaryMin ≤ salaryMax`. Otherwise reset to `null`.
- `compatMin` / `compatMax`: must be integers in [0, 100]; same range constraint.
- `favoritesOnly`: coerced to boolean (`Boolean(value)`) to guard against localStorage corruption.

---

## Utility: `formatPeso(value)` — `src/utils/currency.js`

```text
Input:   integer | null | undefined
Output:  string

Rules:
  null or undefined  →  ""
  0                  →  "" (treated as absent; salary of zero is not meaningful)
  negative integer   →  "" (treated as invalid; salary cannot be negative)
  positive integer   →  "₱" + toLocaleString('en-PH', { maximumFractionDigits: 0 })
```

Examples:
- `formatPeso(150000)` → `"₱150,000"`
- `formatPeso(50000)`  → `"₱50,000"`
- `formatPeso(null)`   → `""`
- `formatPeso(0)`      → `""`

---

## State Transition: Archive Action

```text
[active application in overlay]
  → user clicks Archive quick action
  → window.confirm("Archive this application?") shown
      → user cancels:
          no state change; overlay remains open
      → user confirms:
          PATCH /api/applications/:id  { archived: true, fav: false }
          → success:
              overlay closes / card removed from active list
          → failure:
              UI state unchanged; error message shown to user

[archived application]
  → excluded from default list view (archived: false filter applied by default)
  → fav is always false on archived applications
  → accessing archived items is out of scope for this feature
```

---

## State Transition: Favorite Toggle

```text
[any application — card or overlay]
  → user clicks Favorite action
  → application.fav toggled immediately (optimistic update)
  → PATCH /api/applications/:id  { fav: !current }
  → icon reflects new state; no page reload required
  → if "Favorites only" filter is active and fav becomes false:
      → application disappears from filtered list immediately
```
