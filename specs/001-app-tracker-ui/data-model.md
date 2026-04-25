# Data Model: Responsive Job Application Tracker Web App

**Feature**: `001-app-tracker-ui`  
**Date**: 2026-04-25  
**Storage**: `localStorage` key `apptracker_applications` — JSON array of `JobApplication` objects

---

## Entity: JobApplication

### Schema

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | `string` | Yes | — | Zero-padded integer string, e.g. `"001"`. Immutable primary key. Never reassigned or reused. |
| `position` | `string` | Yes | — | Job title / role name. Non-empty. |
| `company` | `string` | Yes | — | Company name. Non-empty. |
| `status` | `StatusEnum` | Yes | `"wishlisted"` | Defaults to `"wishlisted"` if missing or unrecognised at load time. |
| `last_status_update` | `string` (ISO 8601 date) | Yes | Current date on creation | Auto-set to today's date on entry creation and on every status change. Format: `YYYY-MM-DD`. |
| `compat` | `number` | Yes | Random integer 0–100 | Randomised at entry creation; fixed until a future scoring feature ships. |
| `fav` | `boolean` | Yes | `false` | Star/favourite state. Persists across reloads. |
| `responsibilities` | `string` | No | `""` | Full text. Displayed with 2-line clamp on card, full text in modal. Renders `—` if absent. |
| `skills` | `string[]` | No | `[]` | Array of skill strings, each rendered as a pill tag. Renders `—` if empty. |
| `salary` | `string` | No | `""` | Free text (e.g. `"$120k–$140k"`). Renders `—` if absent. |
| `recruiter` | `string` | No | `""` | Recruiter name. Modal only. Renders `—` if absent. |
| `url` | `string` | No | `""` | Job posting URL. Must be a valid URL if provided. Copy button hidden when absent. |

### Example Record

```json
{
  "id": "003",
  "position": "Senior Frontend Engineer",
  "company": "Acme Corp",
  "status": "interview",
  "last_status_update": "2026-04-24",
  "compat": 72,
  "fav": false,
  "responsibilities": "Lead UI architecture, mentor junior developers, own design system.",
  "skills": ["React", "TypeScript", "CSS"],
  "salary": "$130k–$150k",
  "recruiter": "Jane Smith",
  "url": "https://jobs.acme.com/senior-frontend"
}
```

---

## Enum: StatusEnum

| Value | Display Label | Card Border Accent | Badge Background | Badge Text |
|-------|--------------|-------------------|-----------------|-----------|
| `wishlisted` | Wishlisted | `#9333EA` | `#F3E8FF` | `#6B21A8` |
| `applied` | Applied | `#3B82F6` | `#DBEAFE` | `#1E40AF` |
| `phone_screen` | Phone Screen | `#F97316` | `#FFEDD5` | `#9A3412` |
| `interview` | Interview | `#EAB308` | `#FEF9C3` | `#854D0E` |
| `assessment` | Technical Assessment | `#8B5CF6` | `#EDE9FE` | `#5B21B6` |
| `offer` | Offer | `#22C55E` | `#DCFCE7` | `#166534` |
| `rejected` | Rejected | `#EF4444` | `#FEE2E2` | `#991B1B` |
| `withdrawn` | Withdrawn | `#64748B` | `#F1F5F9` | `#475569` |
| `ghosted` | Ghosted | `#94A3B8` | `#F8FAFC` | `#64748B` |

All nine values are the complete and closed set. Any unrecognised status value loaded from storage defaults to `wishlisted`.

---

## Validation Rules

All rules live in `src/models/application.js` and are enforced before every localStorage write.

| Rule | Field(s) | Behaviour on Failure |
|------|----------|----------------------|
| `id` must be a non-empty string of digit characters | `id` | Card rendered with red highlight + warning icon; sorted to list bottom |
| `position` must be a non-empty string | `position` | Treated as required field violation; card still renders with warning |
| `company` must be a non-empty string | `company` | Same as above |
| `status` must be a recognised `StatusEnum` value | `status` | Coerced to `wishlisted` silently |
| `last_status_update` must be a valid `YYYY-MM-DD` string | `last_status_update` | Replaced with today's date |
| `compat` must be an integer 0–100 (inclusive) | `compat` | Clamped to range: values < 0 become 0, values > 100 become 100 |
| `url` must be a valid URL if non-empty | `url` | Field treated as absent; copy button hidden |
| `skills` must be an array (not a string) | `skills` | Coerced to `[]` if wrong type |
| `fav` must be boolean | `fav` | Defaulted to `false` if wrong type |

---

## State Transitions

Status can change from any value to any other value. There are no enforced transition rules for v1 — all nine statuses are always available in the dropdown. The `last_status_update` date updates on every status change regardless of the transition.

```
Any status → Any status (unrestricted in v1)
```

On status change:
1. `status` field updated to new value
2. `last_status_update` set to today's ISO date (`YYYY-MM-DD`)
3. Record written back to `localStorage`
4. Card DOM updated immediately (badge, border accent, date)

---

## Storage Layout

```
localStorage key: "apptracker_applications"
value: JSON.stringify(JobApplication[])
```

- Read once on app initialisation; held in memory for the session
- Written (full array) on every mutation (status change, star toggle)
- On parse error (corrupt JSON): store initialises with empty array; existing data is not recoverable without a backup

### Corrupt Record Handling (on load)

1. Parse the stored JSON array
2. For each record, run validation:
   - Records with missing/invalid `id` → mark as `_corrupt: true`, sort to list bottom, render with red highlight
   - Records with missing `status` → coerce to `wishlisted`, proceed normally
   - Records with invalid `url` → treat url as absent
   - Records with invalid `compat` → clamp to 0–100
3. `_corrupt` is a runtime-only flag; it is not persisted back to storage

---

## ID Generation

IDs are assigned externally (future add-entry feature). This feature reads and displays existing IDs only. For seed/demo data, IDs are pre-assigned zero-padded integers starting at `"001"`. The model validates that an ID is a non-empty digit string but does not generate new IDs.

---

## Compatibility Score

- Stored as an integer 0–100
- Randomised at record creation using `Math.floor(Math.random() * 101)`
- Fixed thereafter until a future scoring feature replaces the value
- Display thresholds (from design spec):
  - ≥ 80: green fill (`#22C55E`), white label text
  - ≥ 60: yellow fill (`#EAB308`), white label text
  - < 60: indigo fill (`#4F46E5`), white label text when fill ≥ 50%, `#4B5563` when fill < 50%
