# Data Model: Compatibility Insights Panel

Builds on the applications schema ([server/db/columns.js](../../server/db/columns.js)) and the 036 compatibility engine. **Two new columns; one column retired in place.**

---

## 1. New column — `compat_analysis` / `compatAnalysis`

Stores the AI-generated compatibility notes as a JSON blob. `null` = notes have never been generated.

| Aspect | Value |
|---|---|
| App-model key | `compatAnalysis` |
| DB column | `compat_analysis` |
| Type | `TEXT` (JSON-encoded `CompatNotes`) or `NULL` |
| Default | `NULL` |
| Persisted | local SQLite, hosted Supabase, demo (in-memory) — at parity |
| Writable by client via PATCH | **No** — removed from `updateSchema`; written only by `POST /api/applications/:id/compat-notes` |
| Validation on write | `summary` ≤ 34 chars (non-empty string); `body` non-empty string; `generatedAt` added server-side |

### JSON shape

```ts
type CompatNotes = {
  summary: string;      // ≤ 34 chars; headline shown in collapsed + expanded states
  body: string;         // prose; may contain **bold** runs; shown in expanded notes region
  generatedAt: string;  // ISO 8601 UTC timestamp set by the server on persist
}
```

### Wiring

- `server/db/columns.js`:
  - `FIELD_TO_COLUMN`: `compatAnalysis: 'compat_analysis'`
  - `INSERTABLE_COLUMNS`: add `'compat_analysis'`
  - `APPLICATION_COLUMNS_WITHOUT_USER_ID`: add `'compat_analysis'`
  - `toRecord`: `compatAnalysis: parseJson(row.compat_analysis, null)`
  - `toRow`: `JSON.stringify(value)` when non-null, else `null`
- `src/models/application.js` — `normalizeApplication`: accept `compatAnalysis` as-is (JSON object or null); skip in `validateApplication` (never user-editable)
- `server/validation/application.js` — NOT in `updateSchema` or `createSchema`; added to the non-writable block alongside `compat`

### SQLite migration (idempotent)

```js
ensureColumn(targetDb, 'applications', 'compat_analysis', 'TEXT');
```

### Supabase migration

```sql
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS compat_analysis text;
```

### `assertHostedSchema` probe

```js
{
  table: 'applications',
  column: 'compat_analysis',
  failOn: [UNDEFINED_COLUMN],
  docPath: 'specs/037-compatibility-insights-panel/data-model.md §1',
}
```

---

## 2. New column — `compat_scored_at` / `compatScoredAt`

ISO timestamp stamped by 036's recompute path on every score write. Used as the staleness signal: `notes.generatedAt < compat_scored_at → stale`.

| Aspect | Value |
|---|---|
| App-model key | `compatScoredAt` |
| DB column | `compat_scored_at` |
| Type | `TEXT` (ISO 8601 UTC timestamp) or `NULL` |
| Default | `NULL` (backfilled to `created_at` on migration) |
| Persisted | local SQLite, hosted Supabase, demo — at parity |
| Writable by client via PATCH | **No** — written only by the scoring path |
| Written by | `server/services/compatibility.js` `recomputeActive()` + application create/update route |

### Stamping logic

Whenever `compat` is written on an application, `compat_scored_at = new Date().toISOString()` is written in the same update payload. This uses wall-clock UTC (not the `asOf` request date, which is a day string for tenure calculation only).

```js
// server/services/compatibility.js — recomputeActive
// Always stamp compatScoredAt on every score computation attempt (not only on value
// change), so notes go stale even when a compat-relevant edit leaves the score identical.
const compatScoredAt = new Date().toISOString();
const payload = compat !== application.compat
  ? { compat, compatScoredAt }
  : { compatScoredAt };
updates.push(repos.applications.update(application.id, payload, asOf));

// server/routes/applications.js — create + update
const compat = scoreApplication(result.data, profile, asOf);
const compatScoredAt = new Date().toISOString();
// include { compat, compatScoredAt } in the persist payload
```

### Wiring

- `server/db/columns.js`:
  - `FIELD_TO_COLUMN`: `compatScoredAt: 'compat_scored_at'`
  - `INSERTABLE_COLUMNS`: add `'compat_scored_at'`
  - `APPLICATION_COLUMNS_WITHOUT_USER_ID`: add `'compat_scored_at'`
  - `toRecord`: `compatScoredAt: row.compat_scored_at ?? null`
  - `toRow`: pass through as string or `null`
- `server/validation/application.js` — NOT in `updateSchema`; non-writable

### SQLite migration (idempotent)

```js
ensureColumn(targetDb, 'applications', 'compat_scored_at', 'TEXT');
// backfill: set compat_scored_at = created_at where null
targetDb.prepare(
  `UPDATE applications SET compat_scored_at = created_at WHERE compat_scored_at IS NULL`
).run();
```

### Supabase migration

```sql
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS compat_scored_at text;
UPDATE public.applications
  SET compat_scored_at = created_at
  WHERE compat_scored_at IS NULL;
```

### `assertHostedSchema` probe

```js
{
  table: 'applications',
  column: 'compat_scored_at',
  failOn: [UNDEFINED_COLUMN],
  docPath: 'specs/037-compatibility-insights-panel/data-model.md §2',
}
```

---

## 3. Retired column — `compat_notes` / `compatNotes`

The old user-editable free-text notes textarea is retired. The column stays in the schema (additive-only policy) but is emptied and removed from the writable surface.

| Aspect | Before (≤036) | After (037) |
|---|---|---|
| DB column | `compat_notes TEXT` | **unchanged** (column retained) |
| App-model key | `compatNotes` | retained in `toRecord` (reads as null post-migration) |
| Writable via PATCH | Yes | **No** — removed from `updateSchema` |
| UI | "Compat Notes" multiline text editor in Modal | **Removed** — replaced by `CompatibilityModule` |
| Migration | — | `UPDATE applications SET compat_notes = NULL WHERE compat_notes IS NOT NULL` |

### Wiring changes

- Remove `compatNotes` from `INSERTABLE_COLUMNS` (no new writes)
- Remove `compatNotes` from `server/validation/application.js` `updateSchema` / `createSchema`
- Retain `compatNotes: row.compat_notes` in `toRecord` (so existing cached records don't throw on read; value will be null post-migration)
- Remove the `makeInlineText({ label: 'Compat Notes', key: 'compatNotes', … })` field from `Modal.js`

---

## 4. Derived client-side state (not persisted)

```ts
type SkillMatch = {
  name: string;
  level: 'proficient' | 'learning' | 'missing';
};

// Derived at render time — never stored
type CompatAvailability = 'scored' | 'no-profile';
type NotesState = 'none' | 'generating' | 'fresh' | 'stale' | 'error';
```

**`CompatAvailability` derivation:**
- `no-profile` when `profile.skills.length === 0 && profile.experience.length === 0 && !profile.summary`
- `scored` otherwise (score is always present; sparse profile → low score, not an error)

**`NotesState` derivation:**
```
compatAnalysis === null                    → 'none'
compatAnalysis !== null &&
  generatedAt < compat_scored_at          → 'stale'
compatAnalysis !== null && !stale         → 'fresh'
(set transiently during LLM call)         → 'generating'
(set transiently on LLM error)            → 'error'
```

---

## 5. Entities touched

| Entity | Change |
|---|---|
| `applications` table | +`compat_analysis TEXT`, +`compat_scored_at TEXT`; `compat_notes` nulled and removed from write surface |
| `CompatNotes` (new) | Transient type; persisted as JSON in `compat_analysis` |
| `SkillMatch` (new) | Transient type; derived at render time; not persisted |
| `server/services/compatibility.js` | Extended to stamp `compat_scored_at` on every score write |
