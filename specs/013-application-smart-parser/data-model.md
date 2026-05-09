# Data Model: Smart Application Creation Flow

**Branch**: `013-application-smart-parser` | **Date**: 2026-05-09

## Schema Changes

**None.** This feature introduces no new database columns, no new server-side fields, and no changes to the existing application record shape. The parser produces a subset of the existing application record fields.

---

## ParsedResult Shape

`jobPostParser.parseJobPost(text)` returns a plain object conforming to the existing application field names. All fields are optional in the return value; unrecognized fields are omitted.

```
{
  companyName?:      string         // '' if not found
  jobTitle?:         string         // '' if not found
  responsibilities?: string         // '' if not found (required field — user must complete)
  location?:         string         // '' if not found
  workSetup?:        '' | 'Remote' | 'Hybrid' | 'On-site' | 'Field'
  shift?:            '' | 'Day' | 'Mid' | 'Night' | 'Flexible'
  salary?:           number | null  // positive integer or null
  jobPostingUrl?:    string         // '' if not found or invalid
  skills?:           string[]       // union of required + preferred skills
  preferredSkills?:  string[]       // explicitly preferred skills only
  recruiter?:        string         // '' if not found
  compat?:           number         // random integer 0–100
}
```

Fields NOT in the ParsedResult (left to Modal defaults or user entry):
- `id` — assigned by server on create
- `status` — defaults to `'wishlisted'` (existing Modal default)
- `lastStatusUpdate` — set to today's date by normalizeApplication (existing behavior)
- `fav` — defaults to `false`
- `sourcePlatform` — not extracted; user can fill manually
- `applicationDate` — not extracted
- `followUpAction` / `followUpDate` — not extracted
- `compatNotes` — left blank (brief specifies blank placeholder for MVP)
- `generalNotes` — populated only when a recognized overflow section is found

---

## Field Mapping Table

| ParsedResult field | Application schema field | Type | Extraction strategy | Valid range / enum |
|---|---|---|---|---|
| `companyName` | `companyName` | string | Label match, "About X", "At X," pattern | any non-empty string |
| `jobTitle` | `jobTitle` | string | First heading / first substantial line | any non-empty string |
| `responsibilities` | `responsibilities` | string | Section keywords → body content | any non-empty string |
| `location` | `location` | string | "Location:" label or city/country pattern | free text |
| `workSetup` | `workSetup` | enum string | Keyword scan | `''`, `'Remote'`, `'Hybrid'`, `'On-site'`, `'Field'` |
| `shift` | `shift` | enum string | Keyword scan | `''`, `'Day'`, `'Mid'`, `'Night'`, `'Flexible'` |
| `salary` | `salary` | integer or null | Currency regex, lower bound of range, ×12 if monthly | positive integer or `null` |
| `jobPostingUrl` | `jobPostingUrl` | string | URL regex → validateUrl() | valid `http(s)://` URL or `''` |
| `skills` | `skills` | string[] | Required-skills section + preferred-skills section | deduped string array |
| `preferredSkills` | `preferredSkills` | string[] | Preferred-skills / nice-to-have section | deduped string array (subset of skills) |
| `recruiter` | `recruiter` | string | Contact / Recruiter label | free text or `''` |
| `compat` | `compat` | integer | `Math.floor(Math.random() * 101)` | 0–100 inclusive |

---

## Draft Initialization in Modal (create mode with prefill)

The modal draft for a parser-created application is assembled as:

```
_draft = {
  ...normalizeApplication({}),   // all fields at safe defaults
  status: 'wishlisted',          // existing default
  compat: 0,                     // existing default, overridden by prefill.compat
  ...prefill,                    // parser result — overwrites defaults where present
}
```

The spread order ensures:
1. `normalizeApplication({})` provides safe types for all fields (no undefined)
2. `status: 'wishlisted'` is set before prefill (parser does not set status)
3. `prefill` values override defaults only where the parser extracted something

---

## Data Layer Impact

| Layer | Change | Notes |
|-------|--------|-------|
| SQLite schema | None | No migration needed |
| `server/validation/application.js` | None | Existing server validation unchanged |
| `server/routes/applications.js` | None | No new routes |
| `src/models/application.js` | None | `normalizeApplication()` and `validateApplication()` reused as-is |
| `src/services/api.js` | None | `api.create()` reused unchanged |
| `src/components/Modal.js` | Additive | Optional `prefill` parameter only |

---

## Validation Rules (unchanged)

These rules are enforced by `Modal.validateDraft()` before any save, regardless of whether data came from the parser or manual entry:

| Field | Rule |
|-------|------|
| `jobTitle` | Non-empty string |
| `companyName` | Non-empty string |
| `responsibilities` | Non-empty string |
| `jobPostingUrl` | Valid `http(s)://` URL if non-empty |
| `status` | Must be one of `STATUS_VALUES` |
| `workSetup` | Must be one of `WORK_SETUP_VALUES` or empty |
| `shift` | Must be one of `SHIFT_VALUES` or empty |
| `salary` | Positive integer or null |
