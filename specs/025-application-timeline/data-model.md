# Data Model: Application Timeline (025)

**Branch**: `025-application-timeline`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## 1. Entities

### 1.1 `TimelineEntry` (new)

A log line attached to a single application.

```js
/**
 * @typedef {Object} TimelineEntry
 * @property {number} id        - Positive integer; unique within the parent
 *                                application's `timeline` array. Allocated
 *                                client-side as max(existingIds, 0) + 1.
 * @property {string} date      - Calendar date, ISO `YYYY-MM-DD`. Past,
 *                                today, and future are all valid.
 * @property {string} status    - Member of `STATUS_VALUES` (see
 *                                `src/models/application.js`). Independent
 *                                of the parent row's current `status`.
 * @property {string} text      - Free-form note; may be empty string.
 */
```

**Invariants**:

- `id` is unique within its parent application's `timeline` array.
- `date` matches `/^\d{4}-\d{2}-\d{2}$/`.
- `status ∈ STATUS_VALUES` (the same set used for the row's `status`).
- `text` is a string (never `null` / `undefined`).

### 1.2 `Application` (existing — additive change)

Existing entity gains a single new field. All existing fields keep their
shape, semantics, and required/optional status.

```diff
 {
   id: number,
   companyName: string,        // required (constitution)
   jobTitle: string,           // required (constitution)
   status: StatusKey,          // required (constitution)
   lastStatusUpdate: string,   // required (constitution) — STILL stored
                               //   and bumped; UI no longer renders a
                               //   dedicated row for it.
   responsibilities: string,   // required (constitution)
   ...other existing fields...
+  timeline: TimelineEntry[]   // NEW; default []
 }
```

`timeline` is unordered on disk. The client sorts at render time by
`(date DESC, id DESC)`.

---

## 2. Validation rules

### 2.1 Per-entry (Zod, server-side)

In [server/validation/application.js](../../server/validation/application.js):

```js
const timelineEntry = z.object({
  id: z.number().int().positive(),
  date: z.string().regex(datePattern, 'Timeline entry date must use YYYY-MM-DD format'),
  status: z.string().refine(
    (value) => STATUS_VALUES.includes(value),
    `Timeline entry status must be one of: ${STATUS_VALUES.join(', ')}`,
  ),
  text: z.string(),
});

const timeline = z.array(timelineEntry).optional();
```

`timeline` is wired into both `createSchema` and `updateSchema`'s
`writableFields` block.

### 2.2 Per-array (client mirror)

`validateApplication(record)` in
[src/models/application.js](../../src/models/application.js) extends to:

- coerce a non-array `timeline` to `[]`,
- flag `_corrupt` when any entry fails the per-entry shape check
  (mirrors the server schema).

### 2.3 ID uniqueness (advisory, not enforced)

The client allocates entry `id`s monotonically via
`Math.max(...existingIds, 0) + 1` so duplicates only arise from bugs or
hand-crafted payloads. Neither the Zod schema nor `validateApplication`
enforces uniqueness — the worst-case outcome of a duplicate (rendering
oddness on the affected entry) does not justify the schema cost. This
is a deliberate v1 tradeoff documented in
[research.md R-3](research.md).

---

## 3. SQLite schema

### 3.1 Migration (idempotent)

Add to [server/db.js](../../server/db.js) `initSchema`:

```js
ensureColumn(targetDb, 'applications', 'timeline', "TEXT NOT NULL DEFAULT '[]'");
```

The `ensureColumn` helper already short-circuits when the column exists,
so the migration is safe to run on fresh DBs, partially-migrated DBs,
and DBs that already have the column.

### 3.2 Adapter ([server/db/columns.js](../../server/db/columns.js))

```diff
 export const FIELD_TO_COLUMN = {
   ...
+  timeline: 'timeline',
 };
 export const INSERTABLE_COLUMNS = [
   ...,
+  'timeline',
 ];
 // UPDATABLE_COLUMNS derives from FIELD_TO_COLUMN values — automatic.
 export const APPLICATION_COLUMNS_WITHOUT_USER_ID = [
   ...,
+  'timeline',
 ];
```

`toRow`:

```js
} else if (field === 'timeline') {
  row[column] = JSON.stringify(Array.isArray(value) ? value : []);
}
```

`toRecord`:

```js
return {
  ...,
  timeline: parseJson(row.timeline, []),
};
```

### 3.3 `create()` / `update()` defaults

[server/db/applications.js](../../server/db/applications.js)`create()` already
spreads defaults before `toRow`. Add `timeline: '[]'` to the default object
so a freshly-inserted row carries an empty array even when the caller omits
the field.

---

## 4. Supabase schema

### 4.1 Migration (additive)

Operator runs in the Supabase SQL editor:

```sql
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS timeline jsonb NOT NULL DEFAULT '[]'::jsonb;
```

No new RLS policy is needed — the column inherits the existing
`applications` RLS, which gates by `user_id = auth.uid()`.

### 4.2 Adapter ([server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js))

```diff
-const JSONB_COLUMNS = ['skills', 'preferred_skills', 'metadata'];
+const JSONB_COLUMNS = ['skills', 'preferred_skills', 'metadata', 'timeline'];
```

That's the only adapter change — `toRow` JSON-stringifies on write,
`normalizeForPostgres` parses back so PostgREST receives a true JS
array (which it encodes into jsonb), and `toRecord` decodes the value
PostgREST returns (jsonb decodes to JS objects, so `parseJson` no-ops
on the already-parsed value — see existing `parseJson` contract).

### 4.3 Starter seed (`claim_and_seed_starter()`)

The canonical source of the `claim_and_seed_starter()` RPC body now
lives at [docs/db/claim_and_seed_starter.md](../../docs/db/claim_and_seed_starter.md).
Feature 025 ships v2 of the body, which adds a populated `timeline`
jsonb literal to each of the two starter rows. Operators apply v2 via
[quickstart.md §3.2](quickstart.md).

The prior body in
[specs/019-supabase-persistence/data-model.md §5.4](../019-supabase-persistence/data-model.md)
is now annotated as superseded and kept only as a rollback target.

### 4.4 Boot-time schema smoke check

Extend the existing hosted-mode startup probe (from 019) with a single
additional column probe:

```
GET /rest/v1/applications?select=timeline&limit=0
```

A 4xx response surfaces a startup error pointing the operator at the
migration block in [quickstart.md](quickstart.md).

---

## 5. Read-time synthesis (legacy rows)

When `normalizeApplication(record)` receives a record whose persisted
`timeline` is `[]` (or missing), it returns a synthesized array
derived from existing dates:

| Condition | Synthesized entries |
|---|---|
| `applicationDate` present AND row.status === 'applied' | `[ { id:1, date: applicationDate, status: 'applied', text: 'Submitted application.' } ]` |
| `applicationDate` present AND row.status !== 'applied' AND `lastStatusUpdate !== applicationDate` | `[ { id:1, date: applicationDate, status: 'applied', text: 'Submitted application.' }, { id:2, date: lastStatusUpdate, status: row.status, text: '' } ]` |
| `applicationDate` present AND row.status !== 'applied' AND `lastStatusUpdate === applicationDate` | `[ { id:1, date: applicationDate, status: row.status, text: '' } ]` |
| `applicationDate` missing | `[ { id:1, date: lastStatusUpdate, status: row.status, text: '' } ]` |

Synthesis is display-only — the array is returned from `normalize`
but never written through `toRow` unless the user explicitly Saves
(in which case the draft they Save is what persists; synthesis only
runs on read).

---

## 6. Sorting

Render-time only. The persisted array order is irrelevant — clients and
adapters MUST treat `timeline` as unordered storage.

```js
function sortTimelineEntries(entries) {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1; // date DESC
    }
    return b.id - a.id;                // id DESC tiebreak
  });
}
```

---

## 7. Mutation patterns

### 7.1 Add (manual)

```js
const id = Math.max(0, ...draft.timeline.map(e => e.id)) + 1;
draft.timeline.push({ id, date, status, text });
```

### 7.2 Add (auto, from Change-Status)

```js
const id = Math.max(0, ...draft.timeline.map(e => e.id)) + 1;
draft.timeline.push({ id, date: todayIso(), status: newStatus, text: '' });
// Do NOT bump draft.lastStatusUpdate client-side — server owns that.
draft.status = newStatus;
```

### 7.3 Edit text

```js
const entry = draft.timeline.find(e => e.id === entryId);
entry.text = newText;
```

### 7.4 Edit status

```js
const entry = draft.timeline.find(e => e.id === entryId);
entry.status = newStatus;
```

### 7.5 Edit date

```js
const entry = draft.timeline.find(e => e.id === entryId);
entry.date = newIsoDate;
// Re-sort happens at next render.
```

### 7.6 Delete

```js
draft.timeline = draft.timeline.filter(e => e.id !== entryId);
```

### 7.7 Save

`api.update(id, { ...draft })` — `timeline` rides along in the same
PATCH body. Server validates, persists, returns the new record.

### 7.8 Discard

`_draft = copyApplication(_original)` — `copyApplication` deep-copies
`timeline` so the original array is preserved.

---

## 8. JSON examples

### 8.1 Empty timeline

```json
{
  "id": 42,
  "companyName": "Acme Corp",
  "jobTitle": "Frontend Engineer",
  "status": "applied",
  "lastStatusUpdate": "2026-04-10",
  "applicationDate": "2026-04-10",
  "timeline": []
}
```

After normalization, the client receives:

```json
"timeline": [
  { "id": 1, "date": "2026-04-10", "status": "applied",
    "text": "Submitted application." }
]
```

### 8.2 Rich timeline

```json
"timeline": [
  { "id": 4, "date": "2026-04-25", "status": "offer",
    "text": "Verbal offer at 145k base." },
  { "id": 3, "date": "2026-04-22", "status": "interview",
    "text": "Tech round 1 with frontend lead." },
  { "id": 2, "date": "2026-04-19", "status": "phone_screen",
    "text": "Recruiter screen scheduled." },
  { "id": 1, "date": "2026-04-18", "status": "applied",
    "text": "Submitted via referral from Marie." }
]
```

### 8.3 Future-dated entry

```json
{
  "id": 5,
  "date": "2026-06-04",
  "status": "phone_screen",
  "text": "Recruiter callback scheduled."
}
```

Renders at the top of the entry list because its `date` is
chronologically newest.

---

## 9. Storage and payload size

- Typical entry JSON size: ~120 bytes (after stringify).
- Typical application with 8 entries: ~1 KiB of `timeline` payload.
- 100-entry pathological row: ~12 KiB. Acceptable for a per-row JSONB
  column; no pagination on entries in v1.

---

## 10. Compatibility

- **Local SQLite migration** is non-destructive and idempotent.
- **Hosted Supabase migration** is non-destructive and additive.
- **API response shape** gains one field; existing clients that ignore
  unknown fields are unaffected.
- **Constitution-required fields** are unchanged.
- **Status set** is unchanged — `accepted` was already added in a
  prior change (see [src/models/application.js:55-60](../../src/models/application.js#L55-L60)).
