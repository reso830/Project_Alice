# Data Model — 028 Archive Applications View

Documents the data-layer changes required to deliver the Archived view. Reference: [spec.md](spec.md) FR-005, FR-006, FR-009, FR-010, FR-031–FR-033, and the existing `applications` table schema described in feature [019-supabase-persistence/data-model.md](../019-supabase-persistence/data-model.md).

This feature introduces **one new column** (`archived_date`) on the existing `applications` table and changes the **semantics** (not the shape) of the existing `archived` column on the demo in-memory store. There is no new entity.

---

## 1 · `applications` table (existing)

The application record is unchanged in shape except for the new `archived_date` column. The full table is documented in feature 019; only the archive-related columns are repeated here.

### 1.1 · Archive-related columns

| Column | Type (SQLite) | Type (Postgres) | Default | Nullable | Notes |
|---|---|---|---|---|---|
| `archived` | `INTEGER` (0/1) | `boolean` | `0` / `false` | NO | Existing. When `true`, the row is excluded from the Active list and surfaced in the Archived list. |
| `archived_date` | `TEXT` (`YYYY-MM-DD`) | `date` | `NULL` | YES | **New.** ISO `YYYY-MM-DD` set automatically when `archived` transitions `false → true`; cleared to `NULL` when it transitions `true → false`. |
| `fav` | `INTEGER` (0/1) | `boolean` | `0` / `false` | NO | Existing. **No longer auto-cleared on archive** (FR-009 — was previously zeroed by `archive()` and by `toRow({ archived: true })`). |
| `updated_at` | `TEXT` (ISO datetime) | `timestamptz` | now | NO | Existing. Bumped by archive, unarchive, and every update. |

All other columns (`status`, `last_status_update`, `application_date`, `responsibilities`, `skills`, `salary`, `recruiter`, `job_posting_url`, `location`, `shift`, `work_setup`, `compat_notes`, `general_notes`, `preferred_skills`, `timeline`, `compat`, `metadata`) are **untouched** by both archive and unarchive operations.

### 1.2 · Field mapping (`server/db/columns.js`)

> **Canonical rule for `archivedDate`**: this field is **server-managed only**. It is written exclusively by the dedicated `archive()` and `unarchive()` repository methods (which issue direct SQL bypassing `toRow()`). Clients MUST NOT be able to write it through any code path — including PATCH, create, or any future bulk-update endpoint. The mapping rules below enforce this by **deliberately excluding `archivedDate` from `FIELD_TO_COLUMN`**, which means `toRow()` drops it from any client input and `UPDATABLE_COLUMNS` (derived from `Object.values(FIELD_TO_COLUMN)`) does not contain `archived_date`. All other read/write touchpoints are updated as listed.

**Changes to apply:**

| Constant / function | Change | Why |
|---|---|---|
| `FIELD_TO_COLUMN` | **DO NOT add** `archivedDate`. | This is the enforcement point. `toRow()` iterates this mapping; adding `archivedDate` here would make it client-writable via PATCH. |
| `INSERTABLE_COLUMNS` | **DO NOT add** `'archived_date'`. | `archive()` writes `archived_date` via direct SQL, not via `create()`. Newly-created rows always have `archived_date = NULL` by column default. Adding to this list would be dead weight. |
| `UPDATABLE_COLUMNS` | **Derives automatically** from `Object.values(FIELD_TO_COLUMN)`. Since `archivedDate` is not in `FIELD_TO_COLUMN`, `UPDATABLE_COLUMNS.has('archived_date')` is `false`. No manual edit. | Same enforcement as `FIELD_TO_COLUMN`. |
| `APPLICATION_COLUMNS_WITHOUT_USER_ID` | **DO add** `'archived_date'`. | Read-path projection for the Supabase `.select(...)` query. Without this, the API response would omit `archivedDate`. |
| `toRecord(row)` | **DO add** the line `archivedDate: row.archived_date,` | Read-path mapping that surfaces the column in API responses. Independent of `FIELD_TO_COLUMN`. |
| `toRow(fields)` | **DO NOT add** any branch for `archivedDate`. Any client field that isn't in `FIELD_TO_COLUMN` is silently dropped — this is the existing pattern and the enforcement mechanism. | Belt-and-suspenders with the schema layer. |
| `server/validation/application.js` `updateSchema` | **DO NOT add** `archivedDate`. | Defense in depth — even if `FIELD_TO_COLUMN` were ever broken, the validation schema would still drop `archivedDate` from the parsed input. |

### 1.3 · Migration (Supabase, hosted)

This project does **not** use Supabase CLI migration files. The operator pastes SQL into the Supabase SQL editor at deploy time. The canonical inline-SQL pattern is established by [025-application-timeline/data-model.md § 4.1](../025-application-timeline/data-model.md#L165-L175).

Operator runs in the Supabase SQL editor:

```sql
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS archived_date date;
```

Nullable, no default, no backfill, idempotent via `IF NOT EXISTS`. Existing archived rows have `archived_date = NULL` — the client falls back to displaying `lastStatusUpdate` in the card date-stamp. The migration is non-blocking (single column add, no index, no trigger, no RLS change — `archived_date` inherits the existing per-user RLS on `applications`).

The feature's [quickstart.md § 3.1](quickstart.md#31--apply-the-migration) links to this block for operator convenience; do not duplicate the SQL in quickstart.

### 1.4 · SQLite local schema

The local schema add is done via the existing `ensureColumn(targetDb, table, column, definition)` helper at [server/db.js:13](../../server/db.js#L13), which the project has used since feature 015 to evolve the `applications` table without rewriting `CREATE TABLE` blocks. Adding `archived_date`:

```js
ensureColumn(targetDb, 'applications', 'archived_date', 'TEXT');
```

`ensureColumn` short-circuits when the column exists, so the change is safe to run on fresh DBs, partially-migrated DBs, and DBs that already have the column. See [server/db.js:60-67](../../server/db.js#L60-L67) for the surrounding cluster of similar invocations. Task [01.1](tasks.md#-task-011--add-archived_date-column-to-sqlite-via-ensurecolumn) is the implementation.

---

## 2 · Field semantics

### 2.1 · `archived: boolean`

Unchanged from the existing definition. Truthy means "row is in the archive bin; hide from active surfaces, show in archived surfaces; read-only in the overlay."

### 2.2 · `archivedDate: string | null`

- ISO `YYYY-MM-DD` format, matching `lastStatusUpdate` and `applicationDate`.
- Set by the server (`archive()`) using `currentDate(now)` — the same `now` plumbing every other write uses, sourced from the `X-Client-Date` request header when present and falling back to server UTC date.
- Never written by the client. PATCH requests containing `archivedDate` MUST be ignored (the field is not in `FIELD_TO_COLUMN`, so `toRow` will drop it).
- Cleared to `null` by `unarchive()`.

### 2.3 · State transitions

```
                   archive(id, now)
                ┌─────────────────────────────────────┐
                ▼                                     │
┌───────────────────────────────┐     ┌───────────────────────────────┐
│ archived: false               │     │ archived: true                │
│ archivedDate: null            │     │ archivedDate: "YYYY-MM-DD"    │
│ fav: <preserved>              │     │ fav: <preserved>              │
│ status: <any>                 │     │ status: <unchanged from prior>│
│ lastStatusUpdate: <preserved> │     │ lastStatusUpdate: <preserved> │
└───────────────────────────────┘     └───────────────────────────────┘
                ▲                                     │
                └─────────────────────────────────────┘
                   unarchive(id, now)
```

Both transitions:
- Bump `updated_at` to `now` **only when an actual state transition occurs** (i.e., when the row was in the opposite archived state at the moment of the call). Idempotent re-calls (archiving an already-archived row, unarchiving an already-active row) do NOT bump `updated_at`.
- Preserve `fav`, `status`, `last_status_update`, `application_date`, `responsibilities`, `skills`, `salary`, and every other content field.
- Are idempotent at the database layer: both adapters use an atomic conditional UPDATE with an `archived = <opposite-state>` predicate. The no-op path (predicate matches 0 rows) falls through to `getById`, which returns the existing record unchanged. See [research.md § 5.1.1](research.md#511--supabase-archive--unarchive-concurrency-hardening) for the cross-mode design.

### 2.4 · `fav` behavior change (FR-009)

Three sites in the codebase currently couple `fav = 0` to archive. All three are removed:

1. `server/db/applications.js:95` — the explicit `SET fav = 0` in the `archive()` UPDATE.
2. `server/repositories/supabase/applications.js:152` — the explicit `fav: false` in the Supabase archive UPDATE.
3. `server/db/columns.js:213-218` — the implicit clearing inside `toRow()` whenever `archived: true` is written. The branch becomes:

```js
} else if (field === 'archived') {
  row[column] = value ? 1 : 0;
  // No fav side effect — see FR-009.
}
```

---

## 3 · Demo in-memory store (`src/data/demoStore.js`)

### 3.1 · Current semantics (to be replaced)

The current `archive(id)` (`:144-158`) **splices the row out of `_applications`** — i.e. it deletes rather than flips a flag. Once archived in demo mode, a row no longer exists in the store.

This is incompatible with the Archived view, which needs to enumerate archived rows.

### 3.2 · New semantics

`_applications` remains a single array containing both active and archived rows. The archive flag distinguishes them:

```js
// archive(id, now)
//   - Find the row by id.
//   - Replace it in-place with { ...row, archived: true, archivedDate: now }.
//   - Do NOT clear fav.
//   - Return a deep clone of the updated row.

// unarchive(id, now)
//   - Find the row by id.
//   - Replace it in-place with { ...row, archived: false, archivedDate: null }.
//   - Do NOT change fav, status, lastStatusUpdate, applicationDate, or any other field.
//   - The `now` parameter is unused for unarchive's in-memory variant (no updated_at concept
//     in demo, since demo is read-only across sessions).
//   - Return a deep clone of the updated row.

// getAll() — implicitly filters archived === false.
// getAllArchived() — new; returns rows with archived === true.
```

### 3.3 · Seed (`src/data/demoSeed.js`)

The seed gets two new entries with `archived: true` and an `archivedDate` set to a realistic recent date (e.g. 30–60 days back). One entry should be in a terminal status (`rejected` or `withdrawn`) to demonstrate the "restore a terminal-status row" edge case if the demo user unarchives it.

The exact rows are an implementation detail of the seed; the data-model contract is:

| Field | Constraint for archived seed rows |
|---|---|
| `archived` | `true` |
| `archivedDate` | ISO `YYYY-MM-DD`, in the past, within the last 90 days for plausibility |
| `lastStatusUpdate` | Earlier than `archivedDate` (the archive happened after the last status change) |
| `fav` | At least one of the two seed rows has `fav: true` to demonstrate the preservation behavior |

---

## 4 · API response shape

The `Application` record returned by `GET /api/applications/:id`, `GET /api/applications`, `GET /api/applications?view=archived`, `POST /api/applications`, `PATCH /api/applications/:id`, `POST /api/applications/:id/archive`, and the new `POST /api/applications/:id/unarchive` all conform to the same JSON shape:

```json
{
  "id": 42,
  "companyName": "Example Co.",
  "jobTitle": "Senior Engineer",
  "status": "interview",
  "compat": 78,
  "fav": true,
  "sourcePlatform": "LinkedIn",
  "applicationDate": "2026-03-04",
  "jobPostingUrl": "https://example.com/jobs/42",
  "recruiter": "Pat",
  "notes": "Initial screen scheduled",
  "salary": 110000,
  "responsibilities": "...",
  "skills": ["TypeScript", "Node"],
  "followUpAction": "Send thank-you",
  "followUpDate": "2026-04-12",
  "location": "Remote",
  "shift": "Day",
  "workSetup": "Remote",
  "compatNotes": "Strong overlap on stack",
  "generalNotes": "...",
  "preferredSkills": ["GraphQL"],
  "timeline": [ /* ... */ ],
  "lastStatusUpdate": "2026-04-08",
  "createdAt": "2026-03-04T09:12:33.000Z",
  "updatedAt": "2026-05-26T14:01:18.000Z",
  "archived": true,
  "archivedDate": "2026-05-26",
  "metadata": null
}
```

The only new field is `archivedDate` (string ISO date or null). Every existing field's shape is unchanged.

---

## 5 · Invariants the model layer must hold

1. `archived === false` ⟹ `archivedDate === null`.
2. `archived === true` ⟹ `archivedDate !== null` (for any row created or transitioned after this feature ships). Legacy archived rows from before this feature **MAY** have `archivedDate === null`; clients MUST tolerate this and fall back to `lastStatusUpdate` for display.
3. `archive(id)` followed immediately by `unarchive(id)` returns a record where every field except `updated_at` matches the pre-archive snapshot. This is the test-able invariant for FR-009.
4. `archived` and `archivedDate` are never set or cleared by `create()` or `update()`. Only `archive()` and `unarchive()` modify them.
5. `getAll()` (no `view` param) returns only `archived === false` rows. `getAll({ view: 'archived' })` (or the server-side `?view=archived` query) returns only `archived === true` rows. There is no API for "all rows regardless of archive state" in this feature.
6. RLS (Supabase): `archived_date` is exposed to the authenticated user via the `APPLICATION_COLUMNS_WITHOUT_USER_ID` projection, the same as every other column. There is no per-column RLS rule needed — row-level ownership already gates access.

---

## 6 · What is NOT changed in the data model

For clarity:

- No new entity, no new table, no junction.
- No change to `timeline` shape — archived rows retain their timeline as-is.
- No `fav_before_archive` shadow column (rejected at clarification — FR-009 makes it unnecessary).
- No change to `last_status_update` semantics. Archive does not count as a status change.
- No change to `application_date` semantics.
- No change to validation rules for any field. Required fields stay required.
