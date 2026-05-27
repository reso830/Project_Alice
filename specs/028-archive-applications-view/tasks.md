# Tasks: Archive Applications View (028)

**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Data model**: [data-model.md](data-model.md)
**Contracts**: [contracts/api.md](contracts/api.md)
**Research**: [research.md](research.md)
**Quickstart**: [quickstart.md](quickstart.md)
**Plan review**: [checklists/plan-review.md](checklists/plan-review.md)
**Branch**: `028-archive-applications-view`

---

## Phase Map

| Phase | Theme | Blocks |
|---|---|---|
| 01 | **Data layer** â€” `archived_date` column (SQLite + Supabase), `archive()` behavior fix (drop `fav=0` at all three sites), new `unarchive()`, archived-list query path, route surface | 02 |
| 02 | **Client data layer** â€” `api.unarchive(id)`, `api.getAll({ view })`, demoStore refactor (splice â†’ flag), demoSeed adds two archived rows | 03 |
| 03 | **Tracker view switch (US-1)** â€” `currentView` state, URL sync (`?view=archived`), `+ New application` / FAB visibility, pagination reset on switch, archived empty states | 04, 05, 06 |
| 04 | **Archived card (US-2)** â€” `card-archived` variant, "Archived" stamp chip, archived date-stamp, single-â†º quick actions, unarchive handler + toast | 07 |
| 05 | **Archived overlay mode (US-3)** â€” Modal third mode, ARCHIVED chip, action-cluster collapse to â†º+âœ•, body read-only, footer hidden, no discard flow | 07 |
| 06 | **Profile + Calendar verification (US-4, US-5)** â€” Profile `Archived applications Â· N â†’` link with parallel fetch; Calendar exclusion verification test (no production code change) | 07 |
| 07 | **Styling polish (US-6 also)** â€” CSS for view chip, view popup, archived card, archived overlay chip, â†º button variants, Profile link, mobile review | 08 |
| 08 | **Release Prep (REQUIRED)** â€” version bump, CHANGELOG, README, deployment.md (Supabase migration), REPO_MAP.md, docs sanity check | 09 |
| 09 | **Browser Smoke Test (REQUIRED â€” UI feature)** â€” every P1/P2 story walked in a real browser against the merge state, desktop + mobile | merge |

**Sequencing notes:**

- Phase 01 (data layer) blocks every later phase â€” both server tests and the client refactor depend on the new endpoint + column.
- Phase 02 (client data) blocks Phases 03â€“06 â€” all UI surfaces fetch through `api.js` or `demoStore`.
- **Within Phase 02**, the sub-task order is **02.2 (demoStore) â†’ 02.1 (api.js) â†’ 02.3 (demoSeed)**. Task 02.1 imports `demoStore.unarchive` and `demoStore.getAllArchived` which are added in 02.2; doing 02.2 first avoids a `ReferenceError`. Task 02.3 (seed) is independent of either and may land before or after 02.1 â€” it's grouped here for cohesion.
- Phases 03 â†’ 04 â†’ 05 â†’ 06 run in sequence (the original "may run in parallel" framing was misleading because Phase 05's overlay-unarchive wiring depends on Phase 04's page-level `onUnarchiveSuccess` callback). Sequential execution also keeps git history coherent and makes intermediate browser smoke checks possible between phases.
- Phase 07 (styling) can land alongside Phases 04â€“06 because those phases write the class names that Phase 07 styles. Components are visually rough until 07 lands but functionally testable.
- Phases 08 and 09 are mandated by constitution Amendment 1.3.0 (Release Prep before Browser Smoke Test).
- Phase 09's hosted-mode parity walk (Task 09.8) requires a Supabase preview deploy. Open a PR before Phase 09 to trigger the preview build, or coordinate with the operator before that phase starts.

**FR coverage**: every FR-XXX in [spec.md](spec.md) is covered by at least one task â€” see [checklists/plan-review.md Â§ 4](checklists/plan-review.md#4--spec--plan-traceability) for the FRâ†”plan map; the FRâ†”task map is the same mapping carried one level deeper.

---

## Phase 01 â€” Data layer

### [X] Task 01.1 â€” Add `archived_date` column to SQLite via `ensureColumn`

**Target file**: [server/db.js](../../server/db.js)

**What to do**:

1. In `initSchema(targetDb)` (or wherever the existing `ensureColumn(...)` invocations live â€” see the cluster at [server/db.js:60-67](../../server/db.js#L60-L67) added by features 015/018/025), add:
   ```js
   ensureColumn(targetDb, 'applications', 'archived_date', 'TEXT');
   ```
   Place it adjacent to the existing `ensureColumn(targetDb, 'applications', 'archived', 'INTEGER NOT NULL DEFAULT 0');` line for readability.

2. **Do not** edit the `CREATE TABLE applications` statement separately. The `ensureColumn` helper is idempotent â€” it short-circuits when the column exists and adds it otherwise â€” so it covers both fresh-DB initialization and migration of existing local databases in one place. This matches the pattern feature 025 used for `timeline` ([server/db.js:67](../../server/db.js#L67)) per the canonical guidance in [specs/025-application-timeline/data-model.md Â§ 3.1](../025-application-timeline/data-model.md#L107-L117).

3. Column definition: `TEXT` (nullable; no default). Matches `last_status_update`'s SQLite shape.

**Expected behavior**:
- Fresh DB init creates `applications` with `archived_date TEXT` after this `ensureColumn` runs.
- Existing local DBs gain the column on next startup without data loss.
- `PRAGMA table_info(applications)` lists `archived_date` (run after init to verify).

**Constraints**:
- Use `ensureColumn`. Do not invent a new idempotency mechanism.
- No backfill â€” existing archived rows retain `archived_date = NULL`; the card fallback to `lastStatusUpdate` per [tracker.md Â§ Card > Archived card variant](../../docs/design/tracker.md) covers display.
- Do not add any index â€” archived queries are full-table-scan-acceptable at this row count.

**Validation**:
- [tests/server/db/applications.test.js](../../tests/server/db/applications.test.js) (or co-located db test) â€” assert `PRAGMA table_info(applications)` includes `archived_date` after init.
- Manual: after `node server/db-init.js`, query `PRAGMA table_info(applications);` and confirm the row exists.

**Out of scope**:
- Supabase migration (Task 01.5).
- Adding `archived_date` to the validation schema (intentional; see Task 01.3).

---

### [X] Task 01.2 â€” Extend `server/db/columns.js` for `archived_date`

**Target file**: [server/db/columns.js](../../server/db/columns.js)

> Follow the canonical rule for `archivedDate` documented in [data-model.md Â§ 1.2](data-model.md#12--field-mapping-serverdbcolumnsjs): the field is server-managed only and MUST be excluded from `FIELD_TO_COLUMN` (and therefore from `INSERTABLE_COLUMNS` and `UPDATABLE_COLUMNS`). Only the read-path mappings â€” `APPLICATION_COLUMNS_WITHOUT_USER_ID` and `toRecord()` â€” gain entries.

**What to do**:

1. **DO NOT add** `archivedDate` to `FIELD_TO_COLUMN`. The mapping is intentionally absent. This is the enforcement point that prevents client writes via `toRow()` / PATCH.

2. **DO NOT add** `'archived_date'` to `INSERTABLE_COLUMNS`. Newly-created rows have `archived_date = NULL` by column default; `archive()` writes the column via direct SQL after the fact.

3. Add `'archived_date'` to `APPLICATION_COLUMNS_WITHOUT_USER_ID` (immediately after `'archived'`). Without this, the Supabase `.select(...)` projection won't surface the column in API responses.

4. Add to `toRecord(row)`:
   ```js
   archivedDate: row.archived_date,
   ```
   Place between `archived` and `metadata`.

5. **Remove the `fav = 0` side effect** in `toRow()`. Current code (lines 213â€“218):
   ```js
   } else if (field === 'archived') {
     row[column] = value ? 1 : 0;
     if (value) {
       row.fav = 0;
     }
   ```
   becomes:
   ```js
   } else if (field === 'archived') {
     row[column] = value ? 1 : 0;
   ```

6. Do **not** add a `toRow` branch for `archivedDate`. The field is server-set only; clients cannot write it via PATCH. Any client PATCH containing `archivedDate` is dropped silently by `toRow()` because the field is not in `FIELD_TO_COLUMN`. This is the enforcement mechanism â€” paired with the validation schema layer (Task 01.3) for defense in depth.

**Expected behavior**:
- `toRecord({ archived: 1, archived_date: '2026-05-26', ... })` returns `{ archived: true, archivedDate: '2026-05-26', ... }`.
- `toRow({ archived: true })` returns `{ archived: 1 }` â€” note the absence of `fav: 0`.
- `toRow({ archived: true, fav: true })` returns `{ archived: 1, fav: 1 }`.
- `toRow({ archivedDate: '2099-01-01' })` returns `{}` (empty object â€” the field is silently dropped, since `archivedDate` is not in `FIELD_TO_COLUMN`).
- `UPDATABLE_COLUMNS.has('archived_date')` is **`false`** (derived from `Object.values(FIELD_TO_COLUMN)`, which does not include `'archived_date'`). PATCH cannot write the column.

**Constraints**:
- Do not add `archivedDate` to `FIELD_TO_COLUMN`, `INSERTABLE_COLUMNS`, or the validation schema (`server/validation/application.js`). Confirm by reading those after this change.
- Do not change any other branch in `toRow()` or any other field in `toRecord()`.

**Validation**:
- [tests/server/db/columns.test.js](../../tests/server/db/columns.test.js) (existing file or co-located) â€” add four new cases:
  1. `toRow({ archived: true })` does not include a `fav` key.
  2. `toRow({ archived: true, fav: true })` returns `fav: 1` (preserved).
  3. `toRecord({ ..., archived_date: '2026-05-26' })` returns `archivedDate: '2026-05-26'`.
  4. **Enforcement assertion**: `toRow({ archivedDate: '2099-01-01' })` returns an empty object (field is dropped); equivalently, `UPDATABLE_COLUMNS.has('archived_date')` is `false`. This locks the canonical rule into the test suite.

**Out of scope**:
- The validation schema (must remain unchanged â€” see Task 01.3 for the verification test).

---

### [X] Task 01.3 â€” Confirm `archivedDate` stays out of `updateSchema`

**Target file**: [server/validation/application.js](../../server/validation/application.js) â€” **inspect only**

**What to do**:
1. Read the file. Confirm the line `archived: optionalBoolean,` (currently :103) exists.
2. Confirm there is no `archivedDate:` or `archived_date:` key in `updateSchema`.
3. If there is, remove it. If there is not (expected), leave the file unchanged.

**Expected behavior**:
- `updateSchema.safeParse({ archivedDate: '2026-05-26' })` does not include `archivedDate` in the parsed output (Zod default behavior for unknown keys is to strip them when using `.object(...)` with `.strict()` disabled, which is the project's pattern).

**Constraints**:
- Do not add the field. Server-set fields stay out of the client-facing schema.

**Validation**:
- [tests/server/validation/application.test.js](../../tests/server/validation/application.test.js) (existing or co-located) â€” add a case:
  - `updateSchema.safeParse({ archivedDate: '2026-05-26' })` succeeds and the parsed `.data` does not contain `archivedDate`.
- Add a route-level integration test (in Task 01.6) confirming a PATCH with `archivedDate` does not corrupt the record.

**Out of scope**:
- Adding the field â€” must NOT happen.

---

### [X] Task 01.4 â€” SQLite repo: behavior fix + new `unarchive` + archived-list query

**Target file**: [server/db/applications.js](../../server/db/applications.js)

**What to do**:

1. Update `archive(id, targetDb = db, now = currentDate())` to use an atomic conditional UPDATE that only flips state when the row is currently active. This mirrors the Supabase adapter's pattern symmetrically, eliminates the SQL-level `COALESCE`, and ensures both paths bump `updated_at` only on actual state transitions (not on idempotent re-calls). See [research.md Â§ 5.1.1](research.md#511--supabase-archive--unarchive-concurrency-hardening) for the cross-mode design.
   - Stop setting `fav = 0`.
   - SQL:
     ```sql
     UPDATE applications
     SET archived = 1,
         archived_date = @now,
         updated_at = @updated_at
     WHERE id = @id AND archived = 0
     ```
   - Since both the transition path and the no-op path return the same thing (`getById(id, targetDb)`), the implementation collapses to a single unconditional `getById` after the UPDATE:
     ```js
     stmt.run({ id, now, updated_at });
     return getById(id, targetDb); // null on missing row â†’ caller 404s; record otherwise
     ```
     The `info.changes` value is informational only (useful for logging if needed; not for control flow). For missing rows, `getById` returns `null` and the route layer surfaces 404. For already-archived rows, `getById` returns the existing record with its original `archived_date` intact (the UPDATE matched 0 rows so nothing was written).
   - Parameter shape: `{ id, now: <YYYY-MM-DD>, updated_at: <YYYY-MM-DD or full ISO per existing convention> }`. Confirm the existing `currentDate()` return shape and reuse it for both fields.

2. Add `unarchive(id, targetDb = db, now = currentDate())`:
   - Mirror `archive()`'s atomic-predicate pattern with the opposite state.
   - SQL:
     ```sql
     UPDATE applications
     SET archived = 0,
         archived_date = NULL,
         updated_at = @updated_at
     WHERE id = @id AND archived = 1
     ```
   - Same single-call resolution: run the UPDATE, then `return getById(id, targetDb)` unconditionally. Missing row â†’ `null` â†’ 404. Already-active row â†’ existing record (UPDATE matched 0 rows; nothing written).

3. Add `getAllArchived(targetDb = db)`:
   ```js
   export function getAllArchived(targetDb = db) {
     return targetDb
       .prepare('SELECT * FROM applications WHERE archived = 1 ORDER BY created_at DESC')
       .all()
       .map(toRecord);
   }
   ```
   Place immediately after `getAll`.

**Expected behavior**:
- `archive(id, db, '2026-05-26')` on an active row with `fav = 1` produces a row with `archived = 1`, `archived_date = '2026-05-26'`, `fav = 1`, `updated_at = <now>`.
- `archive(id, db, '2026-06-01')` on a row already archived at `2026-05-26` matches 0 rows; the fallback `getById` returns the existing record with `archived_date = '2026-05-26'` (preserved) and `updated_at` unchanged (no idempotent bump â€” symmetric with the Supabase adapter).
- `unarchive(id, db, '2026-05-27')` on the same archived row produces `archived = 0`, `archived_date = NULL`, `fav = 1` (preserved), `status` unchanged, `updated_at` bumped.
- `unarchive(id, db, '2026-05-28')` on an already-active row matches 0 rows; fallback `getById` returns the active record unchanged.
- `getAllArchived()` returns only rows with `archived = 1`, in `created_at DESC` order.
- `getAll()` is unchanged (still excludes archived).

**Constraints**:
- Do not touch any field besides `archived`, `archived_date`, and `updated_at`.
- Do not run any state-machine validation in `unarchive()` â€” unarchiving a `rejected` row succeeds and leaves status `rejected`.
- Both functions are idempotent (archive on archived = no observable change beyond `updated_at`; unarchive on active = same).

**Validation**:
- [tests/server/db/applications.test.js](../../tests/server/db/applications.test.js) â€” add:
  1. Round-trip: archive then unarchive preserves `fav`, `status`, `last_status_update`, every other column except `updated_at`.
  2. Re-archive: archive twice with different `now` values; `archived_date` is the first call's value AND `updated_at` is unchanged on the second call (predicate matches 0 rows; fallback `getById` returns the record).
  3. Re-unarchive: unarchive twice; both calls return the active record; the second call's UPDATE matches 0 rows and `updated_at` is unchanged on the second call.
  4. `getAllArchived()` returns only archived rows in `created_at DESC` order.
  5. `unarchive()` of a terminal-status row (`rejected`) succeeds and leaves status unchanged.
  6. `archive()` and `unarchive()` of a non-existent id both return `null` (route layer maps to 404).

**Out of scope**:
- Supabase parity (Task 01.5).
- Route plumbing (Task 01.6).
- Validation schema changes (Task 01.3).

---

### [X] Task 01.5 â€” Supabase repo: behavior fix + new `unarchive` + archived-list query + migration SQL

**Target files**:
- [server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js)
- [data-model.md Â§ 1.3](data-model.md) â€” the SQL block the operator pastes into the Supabase SQL editor at deploy time. This project does **not** use Supabase CLI migration files â€” see [025-application-timeline/data-model.md Â§ 4.1](../025-application-timeline/data-model.md#L165-L175) for the canonical inline-SQL pattern.

**What to do**:

1. **Migration SQL** â€” confirm [data-model.md Â§ 1.3](data-model.md#13--migration-supabase-hosted) contains the additive `ALTER TABLE` (idempotent form):
   ```sql
   ALTER TABLE applications
     ADD COLUMN IF NOT EXISTS archived_date date;
   ```
   The operator pastes this in the Supabase SQL editor during deploy. The feature's `quickstart.md Â§ 3.1` links to this block; do not duplicate the SQL in quickstart, link to data-model.md.

2. **Adapter** â€” update `archive(id, now)` to use an atomic conditional UPDATE that only flips state when the row is currently active. This eliminates the read-then-write race window and makes idempotency intrinsic to the database operation (FR-008). The SQLite adapter (Task 01.4) uses the symmetric `AND archived = 0` SQL predicate, so the two paths are operationally identical. See [research.md Â§ 5.1.1](research.md#511--supabase-archive--unarchive-concurrency-hardening) for the cross-mode rationale.
   - Drop `fav: false` from the UPDATE object.
   - Body becomes:
     ```js
     async function archive(id, now = currentDate()) {
       // Atomic transition: only flip if currently active. This makes
       // archive_date "set once" without a read-then-write race, and
       // makes the idempotent re-archive case a 0-rows-affected no-op
       // (handled via the fallback getById below). Symmetric with the
       // SQLite adapter's `WHERE id = @id AND archived = 0` predicate.
       const { data, error } = await client
         .from('applications')
         .update({ archived: true, archived_date: now, updated_at: now })
         .eq('id', id)
         .eq('user_id', userId)
         .eq('archived', false)
         .select(SELECT_PROJECTION)
         .maybeSingle();
       if (error) throw error;
       if (data) return toRecord(data);
       // 0 rows matched â†’ row doesn't exist, OR row is already archived.
       // Both are safe outcomes per FR-008. Resolve with a getById to
       // return the current record (null if truly absent â†’ caller 404s).
       return getById(id);
     }
     ```

3. **Adapter** â€” add `unarchive(id, now)` mirroring the same atomic pattern:
   ```js
   async function unarchive(id, now = currentDate()) {
     // Mirror of archive(): only flip if currently archived. The
     // 0-rows-affected case (already active / row missing) resolves
     // via the fallback getById, matching FR-008 idempotency.
     const { data, error } = await client
       .from('applications')
       .update({ archived: false, archived_date: null, updated_at: now })
       .eq('id', id)
       .eq('user_id', userId)
       .eq('archived', true)
       .select(SELECT_PROJECTION)
       .maybeSingle();
     if (error) throw error;
     if (data) return toRecord(data);
     return getById(id);
   }
   ```

4. **Adapter** â€” add `getAllArchived()`:
   ```js
   async function getAllArchived() {
     const { data, error } = await client
       .from('applications')
       .select(SELECT_PROJECTION)
       .eq('user_id', userId)
       .eq('archived', true)
       .order('created_at', { ascending: false });
     if (error) throw error;
     return (data ?? []).map(toRecord);
   }
   ```

5. **Export surface** â€” the returned object now reads `{ getAll, getAllArchived, getById, create, update, archive, unarchive }`.

6. **JSDoc / typedef** â€” update the `import('../applications.js').ApplicationsRepository` reference (or wherever the repository interface lives) to include `getAllArchived` and `unarchive`.

**Expected behavior**:
- Migration applies cleanly to an existing hosted DB; pre-existing archived rows show `archived_date IS NULL`.
- `archive()` and `unarchive()` produce records with `archivedDate` matching the SQLite repo's behavior, including the "set once" guarantee on re-archive (predicate matches 0 rows; fallback `getById` returns the existing record).
- `getAllArchived()` returns archived rows scoped by `user_id` (RLS + explicit `.eq` defense in depth, per [019-supabase-persistence](../019-supabase-persistence/spec.md)).
- `fav` is preserved through archive â†” unarchive.

**Constraints**:
- Use the existing `normalizeForPostgres()` only if a path requires it; the explicit boolean updates above don't need it.
- `archived_date` value: pass the ISO `YYYY-MM-DD` string returned by `currentDate(now)`. PostgREST accepts ISO date strings for `date` columns. Do not wrap in `new Date(...)`.
- Do not introduce a Postgres stored function or BEFORE UPDATE trigger. The atomic conditional UPDATE with `.eq('archived', <opposite>)` already provides the "set once" guarantee race-free, at the cost of one extra `getById` only on the no-op idempotent path. The SQLite adapter uses the symmetric `AND archived = <opposite>` SQL predicate to keep both paths operationally identical. See [research.md Â§ 5.1.1](research.md#511--supabase-archive--unarchive-concurrency-hardening) for the full decision.

**Validation**:
- [tests/server/repositories/supabase/applications.test.js](../../tests/server/repositories/supabase/applications.test.js) (existing or new) â€” add:
  1. Round-trip: archive then unarchive preserves `fav`, `status`, every other column.
  2. Re-archive (second call on an already-archived row) preserves the original `archived_date`. The first call returns the freshly-archived record; the second call's UPDATE matches 0 rows, so the fallback `getById` returns the existing record with the original `archived_date` intact.
  3. Re-unarchive (second call on an already-active row) is a safe no-op returning the active record.
  4. **Adapter pattern wiring (not true race-freedom):** with a test-double `client` simulating two sequential `archive(id, '2026-05-26')` then `archive(id, '2026-05-27')` calls where the row has already been mutated to `archived = true` between them, assert that the second call's `update(...)` returns `data: null` (predicate `.eq('archived', false)` matches 0 rows) and the adapter's fallback `getById` returns the existing record with `archived_date = '2026-05-26'` (the first call's value) intact. This proves the adapter wires the predicate-UPDATE pattern correctly and handles 0-row results via the fallback. True race-freedom under genuine concurrent writes is a Postgres serialization guarantee, not a JS-testable property â€” that would require integration tests against a real Postgres connection with parallel `Promise.all` writes, which is out of scope here.
  5. `getAllArchived()` returns archived rows only; respects `user_id` scoping.
- Manual: apply migration on a hosted preview deploy; archive a row in the Supabase dashboard via the UI or `psql`; confirm `archived_date` populates.

**Out of scope**:
- Backfilling `archived_date` on historic rows. The card fallback to `lastStatusUpdate` covers display.
- Adding an index on `archived` or `archived_date`. Justify with a later phase if perf data warrants.

---

### [X] Task 01.6 â€” Routes: `POST /:id/unarchive` + `GET /?view=archived`

**Target file**: [server/routes/applications.js](../../server/routes/applications.js)

**What to do**:

1. Extend `GET /` (currently :90) to consume `req.query.view`:
   ```js
   router.get('/', async (req, res, next) => {
     try {
       // Strict scalar equality: the literal string 'archived' selects
       // the archived list. Anything else â€” undefined, '', unknown
       // values, or array forms like `?view=archived&view=active`
       // (Express default `qs` parses repeated keys as arrays, which
       // `=== 'archived'` rejects) â€” falls back to the active list.
       const view = req.query.view === 'archived' ? 'archived' : 'active';
       const data = view === 'archived'
         ? await req.repos.applications.getAllArchived()
         : await req.repos.applications.getAll();
       return res.status(200).json({ data });
     } catch (error) {
       return next(error);
     }
   });
   ```
   - Verified: [server/index.js:29](../../server/index.js#L29) uses the default Express setup with no custom `query parser` setting, so repeated `?view=...&view=...` parameters parse to an array. The strict equality check rejects arrays naturally; no additional sanitization is needed.
   - Any `view` value other than the literal scalar string `'archived'` falls back to the active list. No 400.

2. Add `POST /:id/unarchive`, mirroring the existing archive endpoint (currently :173):
   ```js
   router.post('/:id/unarchive', async (req, res, next) => {
     try {
       const id = parseIdParam(req.params.id);
       if (id === null) {
         return sendInvalidId(res);
       }
       const record = await req.repos.applications.unarchive(id, resolveRequestDate(req));
       if (!record) {
         return sendNotFound(res);
       }
       return res.status(200).json({ data: record });
     } catch (error) {
       return next(error);
     }
   });
   ```
   - Place immediately after the archive handler.

3. No new helper functions needed. `parseIdParam`, `sendInvalidId`, `sendNotFound` already exist.

**Expected behavior**:
- `GET /api/applications` (no query) â†’ 200 with active rows (unchanged).
- `GET /api/applications?view=archived` â†’ 200 with archived rows.
- `GET /api/applications?view=banana` â†’ 200 with active rows (silent fallback).
- `POST /api/applications/42/unarchive` on an existing archived row â†’ 200 with `{ data: { ..., archived: false, archivedDate: null } }`.
- `POST /api/applications/42/unarchive` on a non-existent id â†’ 404 `NOT_FOUND`.
- `POST /api/applications/banana/unarchive` â†’ 400 `BAD_REQUEST`.
- Both endpoints require auth (existing `requireAuth` middleware applies via `router.use(requireAuth)`).
- A PATCH containing `archivedDate` in the body succeeds (200) but the field is dropped â€” the record's `archivedDate` is unchanged.

**Constraints**:
- Do not introduce a new validation schema for `view`. A single string-equality check is the right primitive here.
- Do not log the `view` value â€” keep parity with existing handlers' logging.
- Do not add a route for `getAllArchived` â€” the query param on the existing route is the canonical surface ([contracts/api.md Â§ 5.1](contracts/api.md#51--archived-list-endpoint-shape-fr-010)).

**Validation**:
- [tests/server/routes-protected.test.js](../../tests/server/routes-protected.test.js) â€” add:
  1. `GET /api/applications?view=archived` returns archived rows only.
  2. `GET /api/applications?view=banana` returns active rows (no 400).
  3. `POST /api/applications/:id/unarchive` returns 200 with the updated record (`archived: false`, `archivedDate: null`).
  4. `POST /api/applications/9999/unarchive` returns 404 when the row does not exist.
  5. `POST /api/applications/abc/unarchive` returns 400 for an invalid id.
  6. `POST /api/applications/:id/unarchive` requires auth (401 without a session).
  7. PATCH `/api/applications/:id` with `{ archivedDate: '2099-01-01' }` succeeds but the persisted `archivedDate` is unchanged.

**Out of scope**:
- Rate limiting or audit logging â€” not required by the spec.

---

## Phase 02 â€” Client data layer

### [X] Task 02.1 â€” `api.unarchive(id)` and `api.getAll({ view })`

**Target file**: [src/services/api.js](../../src/services/api.js)

**What to do**:

1. Extend `getAll`:
   ```js
   export function getAll({ view } = {}) {
     if (isDemo()) {
       return Promise.resolve(view === 'archived'
         ? demoStore.getAllArchived()
         : demoStore.getAll());
     }
     const query = view === 'archived' ? '?view=archived' : '';
     return request('GET', `/api/applications${query}`);
   }
   ```
   - Default argument `= {}` preserves the call-site behavior of `api.getAll()` returning the active list.

2. Add `unarchive(id)`, mirroring `archive(id)`:
   ```js
   export function unarchive(id) {
     if (isDemo()) return fromDemo(() => demoStore.unarchive(id));
     return request('POST', `/api/applications/${id}/unarchive`);
   }
   ```
   Place immediately after `archive`.

**Expected behavior**:
- `api.getAll()` (no args) â†’ live mode: `GET /api/applications`; demo mode: `demoStore.getAll()`. Unchanged from today.
- `api.getAll({ view: 'archived' })` â†’ live mode: `GET /api/applications?view=archived`; demo mode: `demoStore.getAllArchived()`.
- `api.unarchive(42)` â†’ live mode: `POST /api/applications/42/unarchive`; demo mode: `fromDemo(() => demoStore.unarchive(42))`.
- Any unknown `view` value is forwarded as-is, but only `'archived'` is a recognised path â€” anything else returns the active list (matching server fallback).

**Constraints**:
- Do not break `api.getAll()` callers (`src/pages/Tracker.js`, `src/pages/Profile.js`, `src/pages/Calendar.js`). The default-empty-object pattern is the safest signature change.
- Do not introduce TypeScript or JSDoc generics â€” match the existing module's style.

**Validation**:
- [tests/services/api.test.js](../../tests/services/api.test.js) â€” add:
  1. `api.getAll()` sends GET to `/api/applications` with no query.
  2. `api.getAll({ view: 'archived' })` sends GET to `/api/applications?view=archived`.
  3. `api.unarchive(42)` sends POST to `/api/applications/42/unarchive`.
  4. In demo mode (`isDemo()` mocked to true), `api.getAll({ view: 'archived' })` calls `demoStore.getAllArchived()` and `api.unarchive(42)` calls `demoStore.unarchive(42)`.

**Out of scope**:
- Caching responses. The Tracker re-fetches on view switch by design.
- Pagination params. Server returns the full set; Tracker paginates client-side.

---

### [X] Task 02.2 â€” demoStore refactor: splice â†’ flag

**Target file**: [src/data/demoStore.js](../../src/data/demoStore.js)

**What to do**:

1. Rewrite `archive(id)` (currently :144â€“158) to flip the flag instead of splicing:
   ```js
   export function archive(id, now = toISODate()) {
     const index = findIndexById(id);
     if (index === -1) {
       throw { code: 'NOT_FOUND', message: 'Application not found' };
     }
     const existing = _applications[index];
     const archivedDate = existing.archivedDate ?? now;
     const updated = {
       ...existing,
       archived: true,
       archivedDate,
       // fav, status, lastStatusUpdate, applicationDate, every other field: unchanged
     };
     _applications = [
       ..._applications.slice(0, index),
       updated,
       ..._applications.slice(index + 1),
     ];
     return deepClone(updated);
   }
   ```

2. Add `unarchive(id)`:
   ```js
   export function unarchive(id) {
     const index = findIndexById(id);
     if (index === -1) {
       throw { code: 'NOT_FOUND', message: 'Application not found' };
     }
     const existing = _applications[index];
     const updated = {
       ...existing,
       archived: false,
       archivedDate: null,
     };
     _applications = [
       ..._applications.slice(0, index),
       updated,
       ..._applications.slice(index + 1),
     ];
     return deepClone(updated);
   }
   ```

3. Add an `archived === false` filter to `getAll()`:
   - Current `getAll()` returns every row in `_applications`. After this change, the demoStore retains archived rows so `getAll()` must filter:
     ```js
     export function getAll() {
       return _applications
         .filter((app) => app.archived !== true)
         .map(cloneApplication); // or deepClone â€” match existing pattern
     }
     ```

4. Add `getAllArchived()`:
   ```js
   export function getAllArchived() {
     return _applications
       .filter((app) => app.archived === true)
       .map(cloneApplication);
   }
   ```

5. **`now` parameter**: confirm the existing demoStore convention for "today" (`toISODate()` from `src/utils/date.js`, likely). Use it for `archive()`'s default. `unarchive()` does not need it because it clears the date.

**Expected behavior**:
- After `archive(1)` the row with id 1 is still present in `_applications` with `archived: true` and `archivedDate` set.
- `getAll()` excludes archived rows; `getAllArchived()` returns them.
- After `unarchive(1)` the row's `archived` flips to `false` and `archivedDate` to `null`; `fav` and all other fields are unchanged.
- A double-`archive(1)` preserves the original `archivedDate` (the `existing.archivedDate ?? now` guard).
- Calling `archive(999)` (unknown id) throws `{ code: 'NOT_FOUND' }`; same for `unarchive(999)`.

**Constraints**:
- Do not touch `update()`, `create()`, `getById()`, `getProfile()`, `saveProfile()`.
- Do not change the public function signatures of any other export.
- Preserve the existing array-immutable update pattern (`slice + concat`) â€” the codebase relies on referential newness for change detection in some places.
- Public surface adds two new exports (`unarchive`, `getAllArchived`); other consumers (api.js) import these by name.

**Validation**:
- [tests/data/demoStore.test.js](../../tests/data/demoStore.test.js) â€” add:
  1. `archive(id)` keeps the row in `_applications` (assert via `getAll().concat(getAllArchived())` length is unchanged).
  2. After `archive(id)` the row is absent from `getAll()` and present in `getAllArchived()`.
  3. `archive(id)` sets `archivedDate` to today's date (mock or freeze date).
  4. Re-archive preserves the first `archivedDate`.
  5. `unarchive(id)` flips `archived` back and clears `archivedDate`; `fav`, `status`, and every other field are unchanged.
  6. `fav: true` round-trips through archive â†” unarchive (FR-009 client-side equivalent).
  7. `archive` and `unarchive` of an unknown id throw `NOT_FOUND`.

**Out of scope**:
- Persisting demo state to `localStorage` â€” feature 020 FR-004 forbids it.
- The `now` parameter shape for hosted-mode parity â€” that's covered by api.js + server.

---

### [X] Task 02.3 â€” demoSeed: add two archived rows

**Target file**: [src/data/demoSeed.js](../../src/data/demoSeed.js)

**What to do**:

1. Read the existing seed shape (the file currently produces active rows only).

2. Add two new rows at the end of the seed array. Their shape mirrors the existing entries but with:
   - `archived: true`
   - `archivedDate: <ISO date 30â€“60 days in the past>` (a fixed plausible date; do not compute against `Date.now()` because seed reproducibility matters for tests)
   - One row with `fav: true` (demonstrates the preservation behavior)
   - One row in a terminal status (`rejected` or `withdrawn`) so the "restore a terminal-status row" edge case is reachable in the demo
   - `lastStatusUpdate` earlier than `archivedDate` (the archive happened after the last status change)
   - All required fields populated (`companyName`, `jobTitle`, `status`, `lastStatusUpdate`, `responsibilities` â€” constitution Amendment 1.2.0)

3. Pick distinctive companies / job titles so they are obviously seed data (do not collide with the existing active seed rows' companies/titles).

**Expected behavior**:
- A fresh demo session shows the existing active seed rows in the Active view.
- Switching to the Archived view shows exactly two rows: one `fav: true` non-terminal, one terminal-status non-favorited (or chosen permutation; document the exact pair in the file as inline comments).
- The Profile page's `Archived applications Â· N â†’` link reads `Â· 2 â†’` in demo mode.

**Constraints**:
- Do not modify existing seed entries. Append the new rows.
- Do not introduce dates that are in the future relative to the seed's other dates.
- Keep the row count below ~30 total to keep demo cold-start fast.

**Validation**:
- [tests/data/demoSeed.test.js](../../tests/data/demoSeed.test.js) (existing file or co-located) â€” add:
  1. Seed contains exactly two archived rows.
  2. Both archived rows have `archived: true` and `archivedDate` non-null.
  3. At least one archived row has `fav: true`.
  4. At least one archived row has a terminal status.

**Out of scope**:
- Local SQLite seed (`server/db-seed.js`) â€” out of scope for this feature; the hosted RPC seed is also not touched. The archive lifecycle is exercised via the existing active seed by archiving a row at runtime.

---

## Phase 03 â€” Tracker view switch (US-1)

### [X] Task 03.1 â€” `currentView` state + URL sync

**Target file**: [src/pages/Tracker.js](../../src/pages/Tracker.js)

**What to do**:

1. At Tracker mount, before the first list fetch:
   ```js
   const params = new URLSearchParams(window.location.search);
   let currentView = params.get('view') === 'archived' ? 'archived' : 'active';
   ```

2. Wire the list fetch through the new view:
   - Change every call site from `api.getAll()` to `api.getAll(currentView === 'archived' ? { view: 'archived' } : {})`.
   - There should be a single fetch entry point in the page module â€” if list-load logic is in multiple places, consolidate to one helper `loadList()` that reads `currentView` and dispatches accordingly.

3. Add a `setView(next)` helper:
   ```js
   function setView(next) {
     if (next === currentView) return;
     currentView = next;
     const url = new URL(window.location.href);
     if (next === 'archived') {
       url.searchParams.set('view', 'archived');
     } else {
       url.searchParams.delete('view');
     }
     window.history.replaceState({}, '', url.toString());
     // Reset pagination to page 1 (do not touch filters or sort).
     paginationState.page = 1; // adjust to the actual variable name in Tracker.js
     loadList();
   }
   ```
   - The exact pagination reset line depends on how pagination is stored in Tracker.js â€” read the file and use the correct variable.
   - Do **not** reset `filters` or `sort` state.

4. Expose `setView` to the Toolbar's view chip (Task 03.2 will pass it down).

**Expected behavior**:
- Cold load of `//?view=archived` initializes `currentView = 'archived'` before the first `api.getAll(...)` call; no flash of Active view.
- `setView('archived')` updates `currentView`, writes `?view=archived` to the URL via `history.replaceState`, resets `paginationState.page` to 1, and re-loads.
- `setView('active')` clears the `view` param from the URL.
- Filters and sort persist across the view switch.

**Constraints**:
- Use `replaceState`, not `pushState` â€” the spec treats the view switch as a state change, not a navigation step (so the back button does not unwind toggles).
- Do not refetch on every render; only on `setView` and the existing list refresh triggers.
- Read `URLSearchParams` once at mount; do not re-read on every render.

**Validation**:
- [tests/pages/Tracker.test.js](../../tests/pages/Tracker.test.js) â€” add:
  1. Mounting Tracker with `window.location.search = '?view=archived'` calls `api.getAll({ view: 'archived' })` on first load (mock `api.getAll`).
  2. `setView('archived')` updates the URL to contain `?view=archived` and triggers a re-fetch with `{ view: 'archived' }`.
  3. `setView('active')` removes the `view` param from the URL.
  4. Pagination resets to page 1 on view switch; filters/sort do not change.
  5. Mounting with no `view` param defaults to active (regression guard).
  6. **End-to-end count update on archive without view switch (per Task 03.2 case #6's framing)**: with Tracker mounted on the Active view and a summary of `{ activeCount: 8, archivedCount: 5 }`, fire an archive operation on a visible row (mock `api.archive` to resolve). Without calling `setView`, assert that the Toolbar receives an updated summary `{ activeCount: 7, archivedCount: 6 }` on the next render. Mirror for unarchive from the Archived view.

**Out of scope**:
- The view chip UI itself (Task 03.2).
- +New / FAB visibility (Task 03.3).

---

### [X] Task 03.2 â€” Toolbar view chip + view popup

**Target file**: [src/components/Toolbar.js](../../src/components/Toolbar.js) (verify file)

**What to do**:

1. Render the view chip per [tracker.md Â§ View switcher](../../docs/design/tracker.md):
   - Container `.view-chip` wrapping a `.app-title-trigger` (label + chevron) and the count badge.
   - Label text: `'Applications'` when `currentView === 'active'`, `'Archived'` when `'archived'`.
   - Chevron `â–¾`, rotates 180Â° via CSS when popup open.
   - Count badge displays the current view's **filtered** count (matches the existing badge's filtered-count semantics on the Active view â€” reuse the same `filteredCount` plumbing the toolbar already has).

2. Add the view popup (`.view-popup`):
   - Anchored under the chip (`top: calc(100% + 8px); left: 0`).
   - Header label "View" with the design's small-uppercase styling.
   - Two option rows in a 3-col grid `dot | label | count`:
     - Row 1: `Applications` with the active count.
     - Row 2: `Archived` with the archived count.
   - The active view's row uses the indigo highlight (text + dot + count-pill variant).
   - Outside click and option select both close the popup.
   - The archived count for the popup is the **unfiltered** archived list size (FR-002). Tracker calls both `api.getAll()` and `api.getAll({ view: 'archived' })` on first mount and computes a `{ activeCount, archivedCount }` summary it passes to the toolbar.
   - **Refresh triggers**: the `{ activeCount, archivedCount }` summary updates on every archive (decrement `activeCount`, increment `archivedCount`) and every unarchive (increment `activeCount`, decrement `archivedCount`), regardless of which view is currently active. The view switch itself does NOT change the counts â€” it only changes which side the chip displays. The chip's own count (the *filtered* current-view count) recomputes naturally from the rendered list after each refetch.

3. Wire the chip's click handler to open/close the popup; wire each option's click to `setView(...)` (passed in from Tracker.js).

**Expected behavior**:
- The chip is the leading element of the toolbar (replaces the existing toolbar label, if any).
- Clicking the chip opens the popup; clicking outside closes it.
- Selecting a view in the popup closes the popup and calls `setView(view)`.
- Switching views updates the chip's label and count immediately (driven by `currentView` and the filtered count).

**Constraints**:
- Do not duplicate the existing dropdown-positioning primitive. If `src/components/calendar/anchoredDropdown.js` (introduced by feature 026) is the canonical primitive, reuse it. Otherwise use the same Escape-key + outside-click pattern as `QuickFiltersStatusPopup.js`.
- The popup MUST close on Escape.
- The view chip's count is the **filtered** count of the current view, not the unfiltered total â€” same semantics as the existing toolbar count badge.
- The popup's per-view counts are **unfiltered** totals for the user's data set (so a user with active filters applied can still see "Archived Â· 12" even if only 3 of those would match the active filter).

**Validation**:
- New file [tests/components/Toolbar.test.js](../../tests/components/Toolbar.test.js) (or extend existing) â€” add:
  1. Initial render with `currentView === 'active'`: label reads "Applications", chevron points down.
  2. Click chip â†’ popup renders both options with their counts.
  3. Click "Archived" option â†’ popup closes, `setView('archived')` called.
  4. After switch, label reads "Archived" and the chip's count reflects the archived **filtered** count.
  5. **Popup counts are unfiltered (FR-002)**: with an active filter that reduces the visible list (e.g. Status=Interview applied while 5 archived and 8 active rows exist, but only 1 archived and 2 active match the filter), open the popup and assert the option counts read `5` (archived total) and `8` (active total) â€” NOT the filtered values. Simultaneously, the chip's own count reads the filtered current-view count (`2` on Active, `1` on Archived). The popup and chip counts MAY differ.
  6. **Popup re-renders when count props change (component-level contract)**: mount the Toolbar with props `{ activeCount: 8, archivedCount: 5 }`; open the popup, assert option counts read `8` and `5`. Re-render with `{ activeCount: 7, archivedCount: 6 }`; open the popup again, assert counts read `7` and `6`. This tests the Toolbar's contract â€” counts come in via props and the popup reflects them. The end-to-end "archive operation updates the counts without a view switch" assertion lives at the Tracker page level (see Task 03.1 validation case #6 below) since the Tracker page owns the archive flow that produces the count change.
  7. Escape closes the popup; outside-click closes it.

**Out of scope**:
- The styling itself (Phase 07).
- Pagination, filter, or sort interactions (separate components).

---

### [X] Task 03.3 â€” Hide `+ New application` button and FAB on Archived view

**Target files**:
- [src/components/Toolbar.js](../../src/components/Toolbar.js)
- [src/components/Fab.js](../../src/components/Fab.js)
- [src/pages/Tracker.js](../../src/pages/Tracker.js) (wires the visibility)

**What to do**:

1. Toolbar: render the `+ New application` button only when `currentView === 'active'`. Easiest approach: take `currentView` as a prop / re-render the toolbar on view switch.

2. FAB: same conditional. The FAB component already conditionally renders based on viewport (â‰¤ 639px); add `currentView === 'active'` as a second AND-gate.

3. Both elements must be hidden via CSS `display: none` OR not-rendered. Either is acceptable; `display: none` keeps the DOM cheaper to toggle. Match whichever pattern the existing code uses for view-conditional elements.

**Expected behavior**:
- Active view: `+ New application` button visible on desktop; FAB visible on mobile.
- Archived view: both hidden.
- On view switch, the visibility flips with no flicker.

**Constraints**:
- Do not break the existing creation flow on the Active view.
- Do not disable the keyboard shortcut for creation (if any) â€” only hide the affordances; the creation flow itself remains intact.

**Validation**:
- [tests/pages/Tracker.test.js](../../tests/pages/Tracker.test.js) â€” add:
  1. With `currentView === 'archived'`, the `+ New application` button is absent (or `display: none`).
  2. With `currentView === 'archived'`, the FAB is absent (or `display: none`) at mobile viewport (mock matchMedia / viewport as the existing FAB test does).
  3. Switching back to `'active'` restores both.

**Out of scope**:
- Removing the creation entry points entirely (must remain on Active).
- Disabling status-change or other actions on archived cards (covered by the archived card variant in Phase 04).

---

### [X] Task 03.4 â€” Empty-state copy variants

**Target file**: [src/pages/Tracker.js](../../src/pages/Tracker.js)

**What to do**:

1. Locate the existing empty-state rendering (currently emits "No applications yet. Add your first one!" and a filter-empty variant).

2. Add archived variants:
   - `currentView === 'archived'` AND no archived rows at all (no filter active or filter active but archived list is empty):
     - Use class `.empty-state`; copy: `Nothing archived yet.` newline `Archived applications will appear here.`
   - `currentView === 'archived'` AND filters are active AND filtered set is empty:
     - Use class `.empty-state.empty-state--filter`; copy: `No archived items match` newline `the active filters.`

3. The "are filters active" check uses whatever predicate Tracker already exposes (`hasActiveFilters()` or equivalent). Match the existing Active-view filter-empty branch's predicate.

**Expected behavior**:
- Per [spec.md FR-034, FR-035](spec.md) and [tracker.md Â§ Empty & Error States](../../docs/design/tracker.md), the four empty states render the correct copy:
  1. Active, no rows â†’ "No applications yet. Add your first one!"
  2. Active, filter empty â†’ "No applications match / the active filters."
  3. Archived, no rows â†’ "Nothing archived yet. / Archived applications will appear here."
  4. Archived, filter empty â†’ "No archived items match / the active filters."

**Constraints**:
- Use the existing `.empty-state` and `.empty-state--filter` classes. Do not introduce new empty-state classes (Phase 07 styles them consistently).
- Newlines in the copy render as `<br>` or wrapper `<span>` per the existing Active variant's pattern; match it.

**Validation**:
- [tests/pages/Tracker.test.js](../../tests/pages/Tracker.test.js) â€” add cases for each of the four empty-state copy variants.

**Out of scope**:
- Error-state copy for the archived view â€” the existing `.empty-state.empty-state--error` "Cannot connect to the backendâ€¦" message works for both views.

---

## Phase 04 â€” Archived card (US-2)

### [X] Task 04.1 â€” `card-archived` variant: stamp chip, date-stamp, action collapse

**Target file**: [src/components/Card.js](../../src/components/Card.js)

**What to do**:

1. Add a `card-archived` class on the root when `application.archived === true`.

2. In Row 1's meta cluster, insert a `.card-archived-stamp` chip immediately after the status badge â€” only when archived:
   ```js
   if (application.archived) {
     const stamp = createElement('span', 'card-archived-stamp', 'Archived');
     metaCluster.append(stamp);
   }
   ```

3. The date-stamp slot's text:
   - Active: `Updated <formatted-date>` (current behavior â€” keep).
   - Archived: `Archived <formatted-date>` where `<formatted-date>` is `application.archivedDate ?? application.lastStatusUpdate`, formatted via the same date formatter the active card uses.

4. The quick-actions row:
   - Active: keep the existing `editButton, statusButton, copyButton, starButton, archiveButton`.
   - Archived: render exactly one button â€” the â†º Unarchive button with class `card-btn--unarchive`, `aria-label="Unarchive application"`, title `Unarchive`. Use the existing `createActionButton` helper for shape parity; choose an SVG glyph for the rotational refresh / undo arrow (verify a suitable SVG exists in the project; otherwise inline a 13Ã—13 path).

5. The unarchive button's click handler:
   ```js
   unarchiveButton.addEventListener('click', async (event) => {
     event.stopPropagation();
     try {
       const updated = await api.unarchive(application.id);
       onUnarchiveSuccess(updated); // page-level callback; Tracker.js refreshes list + fires toast
     } catch (error) {
       onError?.(error); // existing error-handling hook on the page
     }
   });
   ```
   - `event.stopPropagation()` is critical so the click does not also open the overlay.

6. The card body click handler is unchanged â€” it still opens the overlay. The overlay decides its own mode based on `application.archived` (Phase 05).

**Expected behavior**:
- An archived card renders with status accent border, status badge, "Archived" stamp chip, date-stamp reading `Archived <date>`, and a single â†º action.
- The active card is visually unchanged.
- Clicking â†º unarchives the row without confirmation; the card disappears from the list and a toast fires (handled at the page level â€” Task 04.2).
- Clicking the card body still opens the overlay (which opens in archived mode per the row's flag).

**Constraints**:
- Do not change the active card's DOM structure or class names (regression risk on existing tests).
- The archived card MUST keep the same status accent border color â€” the design explicitly says "the card itself receives no muted treatment so the status accent reads at full strength" ([tracker.md Â§ Archived card variant](../../docs/design/tracker.md)).
- Do not introduce a new icon library; inline an SVG path consistent with the existing card buttons.

**Validation**:
- [tests/components/Card.test.js](../../tests/components/Card.test.js) â€” add:
  1. `application.archived === true` renders `.card-archived` on the root.
  2. The "Archived" stamp chip is present with text `Archived`.
  3. The date-stamp text starts with `Archived ` and contains the formatted `archivedDate`.
  4. When `archivedDate` is `null`, the date-stamp falls back to `lastStatusUpdate`.
  5. The actions row contains exactly one button with class `card-btn--unarchive` and no `card-btn--archive`, `--edit`, `--status`, `--copy`, or `--star`.
  6. Clicking â†º calls `api.unarchive(id)` (mocked) and invokes the page callback with the returned row.
  7. Clicking â†º does NOT open the overlay (stopPropagation honored).

**Out of scope**:
- Styling (`background`, `border-color`, etc. for `.card-archived-stamp` and `.card-btn--unarchive`) â€” Phase 07.
- The unarchive-from-overlay path â€” Phase 05.

---

### [X] Task 04.2 â€” Tracker page: unarchive handler + toast

**Target file**: [src/pages/Tracker.js](../../src/pages/Tracker.js)

**What to do**:

1. Add `onUnarchiveSuccess(updated)` callback at the page level (mirror the existing `onArchiveSuccess` pattern if it exists):
   - Remove the row from the in-memory list (if currently on Archived view, the row's `archived` is now `false` and should leave; if somehow visible on Active view, the row stays).
   - Update the toolbar chip counts.
   - Fire a success toast: `Unarchived.` (use the existing Toast.show or equivalent).

2. Pass `onUnarchiveSuccess` and `onError` into the Card factory invocations.

3. If a previous archive call had a `coerceId` wrapper at [src/pages/Tracker.js:379](../../src/pages/Tracker.js#L379), match the same id-coercion pattern for unarchive.

**Expected behavior**:
- Clicking â†º on an archived card removes the card from the visible list and fires the toast.
- The toolbar chip's count updates immediately.
- A failed unarchive (network error / 404) does not remove the card; the user sees an error toast.

**Constraints**:
- Do not call `loadList()` (a full re-fetch) on every unarchive â€” local state update is sufficient. A failed call should leave the row in place.
- The toast message string is exactly `Unarchived.` (with trailing period) per [spec.md FR-037](spec.md).

**Validation**:
- [tests/pages/Tracker.test.js](../../tests/pages/Tracker.test.js) â€” add:
  1. On a successful unarchive, the row leaves the Archived list and `Toast.show` is called with `Unarchived.`.
  2. The toolbar archived count drops by 1.
  3. On a failed unarchive, the row remains visible and an error toast is shown.

**Out of scope**:
- Undo. Not in scope per [spec.md Â§ Out of scope](spec.md).

---

## Phase 05 â€” Archived overlay mode (US-3)

### [X] Task 05.1 â€” Add `archived` mode to Modal

**Target file**: [src/components/Modal.js](../../src/components/Modal.js)

**What to do**:

1. Extend the mode discriminant:
   - Today the modal supports `edit` and `create` modes. Add `archived`.
   - The mode is determined by the row's `archived` flag at open time, not by the view: `mode = row.archived ? 'archived' : (rowId == null ? 'create' : 'edit')`.

2. **Header row 1** in archived mode:
   - Render the existing ID pill and status badge.
   - Append an "ARCHIVED" chip (`.archived-stamp`) immediately after the status badge.
   - The chip text is `Archived` (per [application_overlay.md Â§12.1](../../docs/design/application_overlay.md)).
   - The chip's background/foreground variant follows the header's contrast class:
     - `.modal-header--light` (dark accent statuses) â†’ light-on-light chip (rgba(255,255,255,0.16) bg + rgba(255,255,255,0.95) fg).
     - `.modal-header--dark` (light accent statuses) â†’ dark-on-light chip (rgba(0,0,0,0.10) bg + rgba(0,0,0,0.72) fg).
     - Drive via CSS, not JS (Phase 07).
   - Optional: include the 11Ã—11 archive-box SVG glyph; verify availability or inline a path. The text label alone meets accessibility; the glyph is decorative.

3. **Header action cluster** in archived mode:
   - Hide â˜… Favorite, â‡„ Change Status, ðŸ—„ Archive.
   - Render â†º Unarchive button (`.modal-quick-action--unarchive`, `aria-label="Unarchive application"`).
   - Keep âœ• Close.
   - Action button order in archived mode: `[â†º] [âœ•]`.

4. **Header row 2 (Job title)**:
   - In edit/create modes: click-to-edit, large 24px/600 type.
   - In archived mode: render plain text with the same size/weight; do NOT bind the click-to-edit handler. No caret cursor; no hover lift.

5. **Status badge**:
   - In archived mode: not interactive. Drop the click handler.
   - No status dropdown opens.

6. **Body fields** in archived mode:
   - Render every existing field with its value but DO NOT bind any inline-edit handlers (no field swap to input/textarea/dropdown).
   - Chip editors (Required Skills, Preferred Skills): render chips, omit the `Ã—` remove buttons and the trailing input.
   - Dropdowns (Shift, Work Setup): render the current value as plain text, no caret, no open-on-click.
   - URL field: render as plain text or a clickable link; not editable.
   - Last Updated: already read-only in edit mode; unchanged in archived.

7. **Footer**: do not render. Today the footer is conditionally rendered when dirty (and always in create). Add an early-return for `mode === 'archived'`.

8. **Discard / Esc / backdrop / Cmd+S** in archived mode:
   - âœ• Close: closes immediately, no dirty check.
   - Esc at modal level: closes immediately.
   - Backdrop click: closes immediately.
   - Cmd/Ctrl+S: no-op.
   - These behaviors are achievable by short-circuiting the existing dirty-check at the top of each close path when `mode === 'archived'` (`isDirty` is always false by construction, but the explicit short-circuit makes intent clear).

9. **Unarchive button handler**:
   ```js
   unarchiveButton.addEventListener('click', async () => {
     try {
       const updated = await api.unarchive(_draft.id);
       onUnarchiveSuccess(updated); // page-level callback
       close(); // closes the modal without dirty check
     } catch (error) {
       showInlineError(error); // existing error-surface pattern in this file
     }
   });
   ```

**Expected behavior**:
- Clicking an archived card's body opens the modal in `archived` mode.
- The header reads `[ID]  [Status]  [ARCHIVED]  ...  â†º  âœ•`.
- All body fields display their values without entering edit mode.
- The footer is not rendered.
- Esc / backdrop / âœ• close immediately.
- â†º clears the row's `archived` flag, closes the modal, fires the `Unarchived.` toast (via the same page-level callback as the card path â€” Task 04.2).

**Constraints**:
- Do not introduce a `mode === 'archived'` branch in every helper â€” extract the "is editable" predicate (`canEdit = mode !== 'archived'`) and gate handlers once.
- Do not change `edit` or `create` mode behavior (regression).
- Existing tests at [tests/components/Modal.test.js:144, 310, 366, 389](../../tests/components/Modal.test.js#L144) assume the existing action cluster shape for edit/create modes â€” make sure those still pass.
- The existing archive test at [tests/components/Modal.test.js:1360](../../tests/components/Modal.test.js#L1360) currently asserts `fav: false` after archive â€” flip it to `fav: <unchanged>` (Task 05.3 covers this).

**Validation**:
- [tests/components/Modal.test.js](../../tests/components/Modal.test.js) â€” add:
  1. Opening a row with `archived: true` initializes the modal in `archived` mode.
  2. The `.archived-stamp` chip is present in the header.
  3. The action cluster contains exactly `.modal-quick-action--unarchive` and `.modal-quick-action--close` â€” no `--favorite`, `--status`, `--archive`.
  4. Clicking the status badge does not open the Status Dropdown.
  5. Clicking any body field (Company, Salary, Responsibilities) does not switch it into an input.
  6. The Save/Discard footer is absent.
  7. Pressing Esc closes immediately (no discard dialog).
  8. Backdrop click closes immediately.
  9. Clicking â†º calls `api.unarchive(id)` and closes the modal; the success toast `Unarchived.` is fired via the page callback (mock the callback).
  10. `Cmd+S` is a no-op (mode-check short-circuit).

**Out of scope**:
- Styling (Phase 07).
- Active card / overlay regression coverage â€” the existing tests already gate this.

---

### [X] Task 05.2 â€” Wire Modal unarchive to Tracker

**Target file**: [src/pages/Tracker.js](../../src/pages/Tracker.js) (small follow-up to Task 04.2)

**What to do**:
- Pass `onUnarchiveSuccess` (already added in Task 04.2) into the Modal mount/open call, in addition to the existing `onArchiveSuccess`.

**Expected behavior**:
- Unarchive triggered from the Modal updates the Tracker list and chip counts the same way the card-path does.

**Constraints**:
- One callback, two trigger points (card + modal). Do not duplicate logic.

**Validation**:
- Covered by Task 05.1's test #9 (callback invocation) and Task 04.2's test #2 (count drops).

**Out of scope**:
- Profile / Calendar wiring â€” separate phase.

---

### [X] Task 05.3 â€” Update existing archive test for `fav` preservation

**Target file**: [tests/components/Modal.test.js](../../tests/components/Modal.test.js)

**What to do**:
- Update the assertion at [line 1360](../../tests/components/Modal.test.js#L1360):
  - Today: `api.archive.mockResolvedValue({ ...application(), archived: true, fav: false });` and the test passes if the response has `fav: false`.
  - Replace with: starting `fav: true`, asserting that after archive the resolved record still has `fav: true`.
  - The test name should change to reflect "preserves fav" per FR-009.

**Expected behavior**:
- The test fails before Task 01.4 and Task 01.5 land; passes after.
- Documents the FR-009 behavior change at the unit level.

**Constraints**:
- This is a behavior-change test, not a regression test. If your TDD discipline prefers, write this test ahead of the server change in Phase 01.

**Validation**:
- The updated test in this file.

**Out of scope**:
- The repo-level test (covered by Tasks 01.4, 01.5).

---

## Phase 06 â€” Profile + Calendar verification (US-4, US-5)

### [X] Task 06.1 â€” Profile `Archived applications Â· N â†’` link

**Target file**: [src/pages/Profile.js](../../src/pages/Profile.js)

**What to do**:

1. In `mount(container, { navigate })`, alongside the existing `getAll()` call (currently the active list fetch), fetch the archived list count in parallel:
   ```js
   const applicationsPromise = api.getAll();
   const archivedPromise = api.getAll({ view: 'archived' }).catch(() => []);
   ```

2. Inside `renderApplicationsSection` or alongside it, append the archived link element after the stat chip row:
   ```js
   function renderArchivedLink(parent, count, navigate) {
     const link = createButton(
       `Archived applications Â· ${count} â†’`,
       'profile-archived-link',
       () => navigate('tracker', { view: 'archived' }),
     );
     link.setAttribute('aria-label', `View archived applications, ${count} ${count === 1 ? 'item' : 'items'}`);
     parent.append(link);
   }
   ```
   - The exact element type and class will be styled in Phase 07. Use a button or anchor consistent with the existing Profile action elements.

3. Always render the link, even at `count === 0`, per the spec clarification ("Always show. Count reads `0`...").

4. The navigation: confirm how the page router accepts a deep-link / view parameter. Existing pages use `navigate('tracker')`. Extend to `navigate('tracker', { view: 'archived' })` if the router supports an options object; otherwise navigate to the `?view=archived`-suffixed URL directly. Read the navigator implementation in `src/main.js` (or wherever the navigate signature lives) to confirm.

**Expected behavior**:
- On Profile mount, both the active applications fetch (for the stat chip row) and the archived count fetch resolve in parallel.
- The Profile renders the existing stat chips (Total / Active / Pending / Offer â€” derived from active applications, unchanged) AND a new `Archived applications Â· N â†’` link below them.
- Clicking the link navigates to `/?view=archived` and the Tracker initializes with the Archived view (no flash).
- The link reads `Archived applications Â· 0 â†’` when no rows are archived.

**Constraints**:
- Do not change the existing stat chip computation or any of the other Profile sections.
- Do not block the rest of the Profile render on the archived fetch â€” if `archivedPromise` fails (graceful catch returns `[]`), the link still renders with `count === 0` and a non-fatal degraded state.
- The link is keyboard-reachable (button or anchor) and has an `aria-label` describing the count.

**Validation**:
- New file [tests/pages/Profile.test.js](../../tests/pages/Profile.test.js) (or extend if it exists) â€” add:
  1. On mount, `api.getAll({ view: 'archived' })` is called once.
  2. The link renders with text `Archived applications Â· N â†’` where N matches the resolved array length.
  3. At `count === 0`, the link still renders.
  4. Clicking the link invokes `navigate` with a payload that routes to `/?view=archived`.
  5. The existing stat chips are unaffected (regression).
  6. **Fetch-failure graceful degradation (per spec edge case)**: if `api.getAll({ view: 'archived' })` rejects, the link still renders with `N = 0` and the rest of the Profile page renders normally (no error toast, no skeleton stuck). The link's `aria-label` reflects `0 items`.

**Out of scope**:
- Restyling the Profile's existing visualizations.
- Adding an archive-only donut or stat chart.

---

### [X] Task 06.2 â€” Calendar verification test (no production code change)

**Target file**: [tests/pages/Calendar.test.js](../../tests/pages/Calendar.test.js)

**What to do**:

1. Confirm via reading [src/pages/Calendar.js](../../src/pages/Calendar.js) that the Calendar's data source is `api.getAll()` (currently :400) and there is no other applications query. If a second query exists (e.g. for suggestions), audit it.

2. **Test mechanism**: the test uses a **single** mock for `api.getAll()` (no `getAllArchived` involvement â€” Calendar never calls it). The mock returns ONLY active rows, matching the production data flow. The fixture is constructed so that **if Calendar were broken to include archived rows**, the additional archived rows would have to come from a *new* call somewhere â€” which the mock setup would surface by either (a) failing because the new call isn't stubbed, or (b) showing the additional rows in the assertion. The test locks in the data-flow invariant: Calendar's sole applications source is `api.getAll()`-active-only.

3. Test cases to add:
   - Seed `api.getAll()` mock with three rows: (a) an active row with a Timeline entry dated today, (b) an active row with a Timeline entry dated +2 days, (c) an active row that meets the `followup` rule. Render Calendar; assert all three appear in the appropriate sections (Today / Upcoming / Suggested Actions).
   - Repeat the test, but this time flip rows (a) and (c) to `archived: true` and re-seed the mock â€” but **crucially**, since the production `getAll()` excludes archived rows, the mock at this layer simply omits them entirely from its return value. Render Calendar; assert only row (b) appears in Upcoming, and Today / Suggested Actions are empty.
   - The "if Calendar adds a new fetch" regression guard: if a future change in Calendar adds `api.getAll({ view: 'archived' })`, the test's mock for that call would be missing â€” the test would fail or behave unexpectedly, surfacing the new call. Document this as the regression mechanism.

**Expected behavior**:
- The test passes as-is against the current Calendar (since it already reads from the active-only `getAll()`).
- If a future change makes Calendar fetch all rows (e.g. adds a `getAll({ view: 'archived' })` call or a hypothetical `getAll({ view: 'all' })`), the test fails â€” surfacing the regression by either missing-stub error or assertion mismatch.

**Constraints**:
- No production code change in [src/pages/Calendar.js](../../src/pages/Calendar.js) or [src/components/calendar/*](../../src/components/calendar/) under this task.
- If during inspection a Calendar query is found that does include archived rows, escalate and document in research.md / plan.md before making changes.

**Validation**:
- The new test cases in this file.

**Out of scope**:
- Adding defensive `.filter(a => !a.archived)` calls inside Calendar â€” would be dead code today and mask future regressions.

---

## Phase 07 â€” Styling polish (also covers US-6 finishing)

### [X] Task 07.1 â€” View chip + view popup styles

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:

Add CSS for the toolbar view chip and view popup per [tracker.md Â§ View switcher](../../docs/design/tracker.md):

- `.view-chip` â€” pill border, 1px rgba(255,255,255,0.18); bg rgba(255,255,255,0.04); radius `--r-pill`; padding `3px 4px 3px 0`; gap `4px`. Hover/open: border rgba(255,255,255,0.32); bg rgba(255,255,255,0.08).
- `.app-title-trigger` â€” Sora 13px / 500, color rgba(255,255,255,0.88); white on hover/open. Chevron `â–¾` to the right, DM Mono 11px, 55% opacity â†’ 100% on open, rotates 180Â° via `transform: rotate(180deg)` when popup open.
- `.view-popup` â€” anchored below the chip (`top: calc(100% + 8px); left: 0`); background `--surface`; border `1.5px solid --color-border`; radius `--r-md`; shadow `--shadow-lg`; min-width 220px; padding 5px.
- `.view-popup__header` â€” "View" label, 8px uppercase, 0.8px tracking, `--t4`.
- `.view-popup__option` â€” 3-col grid (dot | label | count pill); idle uses `--t2` text, `--t4` dot, light `--bg` count pill; selected uses `--indigo` text + dot, `--indigo-dim` count pill; hover row `--indigo-soft`.
- The count badge inside the chip uses the existing `.count-badge` style (purple toolbar variant). Verify class reuse and add a wrapper if needed.

**Expected behavior**:
- Visual parity with the design doc's mocks.
- Hover, open, and selected states all visible and distinguishable.
- Popup closes on outside click and Escape (functional behavior wired in Task 03.2).

**Constraints**:
- Reuse existing tokens (`--navy`, `--indigo`, `--r-pill`, etc.). Do not introduce new color values inline.
- The popup must stay inside the viewport on narrow screens â€” if positioning conflicts, use a small inline-style nudge similar to how `QuickFiltersStatusPopup` handles right-edge collisions.

**Validation**:
- Visual review at desktop and mobile viewports (covered in Phase 09 browser smoke).
- No automated style tests beyond ensuring the classes are present in the DOM (Task 03.2).

**Out of scope**:
- Archived card / archived overlay styles (Tasks 07.2, 07.3).

---

### [X] Task 07.2 â€” Archived card styles

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:

Add CSS per [tracker.md Â§ Card > Archived card variant](../../docs/design/tracker.md):

- `.card.card-archived` â€” **no muted treatment**: same background, border, shadow as the active card so the status accent reads at full strength. Confirmed by the design's explicit "Background, border, shadow, and status badge are identical to active cards."
- `.card-archived-stamp` â€” DM Mono 9px / 600, uppercase, 0.7px tracking, color `--t3`, background `--bg`, border `1px solid --border`, padding `2px 7px`, pill radius `--r-pill`.
- `.card-btn--unarchive` â€” extends `.card-btn` base; border `--indigo-dim`, color `--indigo`, background `--indigo-soft`; hover: border `--indigo`, background `--indigo-dim`. Size unchanged from base (28Ã—28).
- The single-button row layout: keep the existing `.card-actions` flexbox / grid container; the archived variant simply contains one button, no special grid override needed unless the existing layout has fixed columns. Verify and override if necessary.

**Expected behavior**:
- Archived cards look identical to active cards except for the stamp chip and the single â†º button.
- The â†º button uses elevated indigo styling (per the design â€” non-destructive restore).
- Mobile layout reorders correctly via the existing card flex-column order.

**Constraints**:
- No `opacity` or `saturate()` filter on the archived card â€” explicitly forbidden by the design.

**Validation**:
- Browser smoke (Phase 09).

**Out of scope**:
- Active card style changes (regression risk; do not touch).

---

### [X] Task 07.3 â€” Archived overlay chip + button styles

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:

Per [application_overlay.md Â§12.1](../../docs/design/application_overlay.md):

- `.archived-stamp` â€” pill (`--r-pill`); padding `4px 10px`; DM Mono 9px / 600, uppercase, 0.8px tracking. Optional 11Ã—11 archive-box SVG leading icon with `opacity: 0.85`.
- Contrast-aware variants:
  - `.modal-header--light .archived-stamp` â€” bg `rgba(255,255,255,0.16)`, color `rgba(255,255,255,0.95)`.
  - `.modal-header--dark .archived-stamp` â€” bg `rgba(0,0,0,0.10)`, color `rgba(0,0,0,0.72)`.
- `.modal-quick-action--unarchive` â€” same 28Ã—28 base as the other modal quick actions; color and hover follow the active-card unarchive button's indigo treatment (`--indigo-dim` border, `--indigo` color, `--indigo-soft` bg; hover: `--indigo` border, `--indigo-dim` bg).

**Expected behavior**:
- The "ARCHIVED" chip is legible against every status-accent header background.
- The â†º Unarchive button matches the card-side â†º visually.

**Constraints**:
- Do not introduce contrast-tinted backgrounds via JS â€” drive via CSS based on the existing `.modal-header--light` / `--dark` class the overlay already toggles.

**Validation**:
- Browser smoke (Phase 09).

**Out of scope**:
- Header recoloring (already handled by the existing status-accent logic).

---

### [X] Task 07.4 â€” Profile archived link styles

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:

Add `.profile-archived-link` styling consistent with the Profile's other action affordances:

- Inline button or link styling (match the existing `.profile-btn` or `.section-card__actions` button pattern).
- Right-aligned chevron-like `â†’` or implicit via the button's text.
- Hover: subtle indigo lift consistent with the other Profile action buttons.

**Expected behavior**:
- The link is visually a Profile section accessory, not a heavy CTA â€” secondary chrome.

**Constraints**:
- Do not introduce a new visual style; reuse `.profile-btn` modifiers if a fit exists.

**Validation**:
- Browser smoke (Phase 09).

**Out of scope**:
- The donut chart or stack-bar visuals.

---

### [X] Task 07.5 â€” Filter / sort / pagination compatibility check (US-6 polish)

**Target files**:
- [src/components/QuickFiltersToolbar.js](../../src/components/QuickFiltersToolbar.js) â€” inspect only
- [src/components/SortPanel.js](../../src/components/SortPanel.js) â€” inspect only
- [src/components/Pagination.js](../../src/components/Pagination.js) â€” inspect only

**What to do**:

1. Inspect the three components. Confirm they operate on the rows passed to them (no internal fetch).
2. If any component carries internal state that resets on every list re-fetch, document the behavior; otherwise no code change is needed. Filters and sort persist naturally because they live at the page level.
3. Add Tracker-level tests that exercise the cross-cutting flows: filter applied, switch view, filter still applied, pagination reset to 1.

**Expected behavior**:
- No code change in any of the three components.
- Filters + sort persist across view switches.
- Pagination resets to page 1 on switch.

**Constraints**:
- If a component needs a small fix to persist correctly, scope it to a one-line change and update this task with the file/line.

**Validation**:
- [tests/pages/Tracker.test.js](../../tests/pages/Tracker.test.js) â€” add:
  1. Apply Status filter on Active â†’ switch to Archived â†’ filter still applied; archived list is filtered.
  2. Set sort to `Salary DESC` on Active â†’ switch to Archived â†’ sort still applied.
  3. Navigate to Active page 3 â†’ switch to Archived â†’ pagination is on page 1.

**Out of scope**:
- Search functionality (does not exist â€” see spec.md Â§ Withdrawn C3).

---

## Phase 08 â€” Release Prep (REQUIRED â€” constitution Amendment 1.3.0)

### [X] Task 08.1 â€” Version bump

**Target files**:
- [package.json](../../package.json) â€” `version` field
- [src/components/Footer.js](../../src/components/Footer.js) â€” `APP_VERSION` literal (if pinned there per the project pattern)

**What to do**:
1. Bump SemVer:
   - This feature adds a new user-facing capability (archived view + unarchive) and changes one observable behavior (`fav` preservation on archive).
   - **Recommended bump**: MINOR (e.g. `0.13.3` â†’ `0.14.0`). The `fav` behavior change is observable but not a breaking API contract; new features land in MINOR.
2. Update `Footer.js` `APP_VERSION` to match.
3. Search the test suite for any assertions that pin the literal version string (`grep -rn '0\.13' tests/`); update each match.

**Expected behavior**:
- `package.json` `version` matches the new SemVer.
- The Footer in the running app displays the new version.
- All version-string assertions in tests pass.

**Constraints**:
- Do not bump MAJOR â€” this is not a breaking change.
- If a different SemVer convention is in use, document the deviation here and follow it.

**Validation**:
- `npm test` passes (asserts string matches).
- Manually open the running app and confirm the Footer reads the new version.

**Out of scope**:
- Bumping any dependency in `package.json`.

---

### [X] Task 08.2 â€” CHANGELOG entry

**Target file**: [CHANGELOG.md](../../CHANGELOG.md)

**What to do**:

Add a new section above the previous entry, formatted per Keep a Changelog:

```markdown
## [<new-version>] â€” <merge-date>

### Added
- Archived Applications view on the Tracker (toolbar chip + `?view=archived` deep link).
- Read-only Archived mode for the Application Overlay (per `docs/design/application_overlay.md` Â§12).
- `POST /api/applications/:id/unarchive` endpoint and `api.unarchive(id)` client helper.
- `archived_date` column on `applications` (SQLite + Supabase). Populated automatically on archive; cleared on unarchive.
- "Archived applications Â· N â†’" link on the Profile page (deep-linked to `/?view=archived`).
- Two seeded archived rows in demo mode so the feature has visible content for portfolio visitors.

### Changed
- **Archive no longer clears the `fav` star.** A starred row archived after this version retains `fav: true` through both archive and unarchive. This is a forward-only behavior change â€” rows archived before this version had their `fav` cleared at archive time; that state is not retroactively recovered. (FR-009.)
- Demo mode's `archive` operation now keeps the row in memory with `archived: true` (previously the row was spliced out).
- Tracker's `+ New application` button and mobile FAB are hidden while the Archived view is active.
```

Then update the `[Unreleased]` and `[<new-version>]` diff links at the bottom of the file.

**Expected behavior**:
- CHANGELOG.md has the new section.
- The previously-`[Unreleased]` section's content (if any unrelated entries existed) is preserved.
- The diff URLs at the bottom resolve.

**Constraints**:
- Keep the entry concise. Do not duplicate the full spec.
- Call out the `fav` behavior change explicitly â€” it is the most surprise-prone item.

**Validation**:
- Read the file end-to-end; confirm no syntactic / format break.
- `grep` for the new version literal in CHANGELOG; expect at least 2 matches (section heading + diff URL).

**Out of scope**:
- Backfilling CHANGELOG entries for previous features.

---

### [X] Task 08.3 â€” README updates

**Target file**: [README.md](../../README.md)

**What to do**:
1. Add a new bullet under the Features list (or similarly named section):
   > "Archive applications you no longer need to follow â€” they leave the active list and dashboards but stay reachable from a dedicated Archived view, restorable in one click."
2. If README has a `Current version` line, update it to the new SemVer.
3. Add cross-link under Further Reading:
   - `- [Archive Applications View spec](specs/028-archive-applications-view/spec.md)`

**Expected behavior**:
- README mentions the new feature.
- Version display matches `package.json`.

**Constraints**:
- Do not restate operator-install steps from `quickstart.md`. Link to it instead.

**Validation**:
- Read the file; confirm no broken formatting.

**Out of scope**:
- Adding a screenshot â€” defer to a follow-up doc PR if desired.

---

### [X] Task 08.4 â€” deployment.md (Supabase migration)

**Target file**: [docs/deployment.md](../../docs/deployment.md)

**What to do**:
1. Add a one-liner under the Supabase / hosted-mode section noting the `archived_date` migration that ships with this feature.
2. Link to [specs/028-archive-applications-view/data-model.md Â§ 1.3](data-model.md#13--migration-supabase-hosted) (the SQL block) and to [specs/028-archive-applications-view/quickstart.md Â§ 3.1](quickstart.md) (the operator walkthrough).

**Expected behavior**:
- An operator deploying the next release knows the migration is required and where to find the SQL.

**Constraints**:
- Do not duplicate the SQL â€” link to data-model.md.
- This project does not use Supabase CLI migration files; the operator pastes inline SQL in the Supabase SQL editor (canonical pattern from feature 025). Do not introduce migration-file framing.
- If `docs/deployment.md` does not have a Supabase migrations section yet, add one near other hosted-mode operator notes (or extend an existing "Schema changes" / "Upgrades" subsection if one exists).

**Validation**:
- Read the file; confirm the new section is discoverable.

**Out of scope**:
- Migration tooling changes.

---

### [X] Task 08.5 â€” REPO_MAP.md

**Target file**: [docs/REPO_MAP.md](../../docs/REPO_MAP.md)

**What to do**:
1. Add a row for the new `specs/028-archive-applications-view/` package under the Spec Packages section.
2. Update any rows whose description changed:
   - `src/data/demoStore.js` â€” semantic change to `archive` + new `unarchive` / `getAllArchived` exports.
   - `src/services/api.js` â€” new `unarchive`, `getAll(opts)`.
   - `server/db/applications.js` â€” new `unarchive`, `getAllArchived`.
   - `server/repositories/supabase/applications.js` â€” new `unarchive`, `getAllArchived`.
   - `server/routes/applications.js` â€” new `POST /:id/unarchive`, `GET /?view=archived`.
   - `src/components/Modal.js` â€” new `archived` mode.
   - `src/components/Card.js` â€” archived variant.
   - `src/components/Toolbar.js` â€” view chip + view popup.
   - `src/components/Fab.js` â€” view-conditional visibility.
   - `src/pages/Tracker.js` â€” view state + URL sync.
   - `src/pages/Profile.js` â€” archived applications link.

**Expected behavior**:
- REPO_MAP accurately reflects the merged state.

**Constraints**:
- Be specific in the row descriptions â€” vague entries dilute the map's value.

**Validation**:
- Read the file; ensure every new file and every modified file's row matches the change description in the corresponding task above.

**Out of scope**:
- Other repo-map sections.

---

### [X] Task 08.6 â€” Docs sanity check

**Target files**: cross-cutting

**What to do**:
1. `grep -rn <previous-version>` across `package.json`, `src/`, `README.md`, `CHANGELOG.md`, `docs/`. Confirm the only remaining matches are historical CHANGELOG headings or CHANGELOG diff URLs.
2. Confirm every cross-link path introduced in this phase resolves (no 404s).
3. Open the running app and confirm the Footer renders the new version.

**Expected behavior**:
- No stale version strings in user-facing files.
- All cross-links resolve.
- App displays the new version.

**Constraints**:
- This is a check, not an edit. If something is wrong, fix it in the relevant earlier task.

**Validation**:
- Manual.

**Out of scope**:
- Anything that would change a code file unrelated to this feature.

---

## Phase 09 â€” Browser Smoke Test (REQUIRED â€” UI feature; constitution Amendment 1.1.0)

**Setup**: Start the dev server (`npm run dev`), start the backend (whatever the project's standard verb is), and load seed data (`node server/db-clear.js && node server/db-seed.js` for local; sign in to a hosted preview deploy for hosted). Per Amendment 1.3.0, smoke testing runs AFTER Release Prep so the walk exercises the to-be-merged state.

Each task below walks one user story's Independent Test against the merged-state branch in a real browser, on both desktop (â‰¥ 1024px) and mobile (â‰¤ 639px) viewports.

### [X] Task 09.1 [US-1] Open the Archived view

Per [spec.md US-1](spec.md):

- With at least one archived row, load `/`. Click the toolbar chip â†’ select `Archived`.
- âœ… The list shows only `archived = true` rows.
- âœ… The URL contains `?view=archived`.
- âœ… Reload â€” Archived view is still active, no flash of Active.
- âœ… Filter+sort applied on Active persist when switching; pagination resets to page 1.
- âœ… "+ New application" button hidden (desktop); FAB hidden (mobile).
- âœ… Switching back to Active strips `?view=` and restores the original list.

### [X] Task 09.2 [US-2] Unarchive from the card

Per [spec.md US-2](spec.md):

- In the Archived view, click â†º on an archived card.
- âœ… Row leaves the list immediately (no confirm dialog).
- âœ… Toast reads `Unarchived.`.
- âœ… Toolbar archived count drops by 1.
- âœ… Switching to Active, the row is present with `status` unchanged.
- âœ… In local mode, check the DB: `archived = 0`, `archived_date = NULL`, `fav` preserved (test with a starred row and confirm `fav = 1` survives).

### [X] Task 09.3 [US-3] Archived overlay (read-only)

Per [spec.md US-3](spec.md):

- Click an archived card's body (not the â†º button).
- âœ… Overlay opens in archived mode: ID pill + status badge + "ARCHIVED" chip in header.
- âœ… Action cluster: only â†º and âœ•.
- âœ… Clicking the status badge does nothing.
- âœ… Clicking any body field (Company, Salary, Responsibilities, Required Skills chip, etc.) does not enter edit mode.
- âœ… Save / Discard footer is absent.
- âœ… Esc closes immediately, no discard dialog.
- âœ… Backdrop click closes immediately, no discard dialog.
- âœ… âœ• closes immediately, no discard dialog.
- âœ… â†º in the header unarchives the row, closes the modal, fires the `Unarchived.` toast.

### [X] Task 09.4 [US-4] Profile entry point

Per [spec.md US-4](spec.md):

- Open the Profile page.
- âœ… `Archived applications Â· N â†’` link is present, with N matching the actual archived count (test at 0, 1, and â‰¥ 2).
- âœ… Clicking the link navigates to `//?view=archived` and the Archived view is the initial state (no flash).
- âœ… The existing stat tiles (Total / Active / Pending / Offer) still render unchanged.

### [X] Task 09.5 [US-5] Active surfaces exclude archived rows

Per [spec.md US-5](spec.md):

- Seed an application that would otherwise trigger a Calendar suggestion (e.g. an applied row â‰¥ 7 days old with no newer timeline entries).
- Archive it.
- âœ… Open the Calendar. The row's activity is absent from Today / Upcoming / Suggested Actions / Month Grid chips.
- âœ… Open the Profile. The stat tile counts do not include the archived row.
- Unarchive the row. Reload the Calendar.
- âœ… The row's activity reappears in the Calendar.

### [X] Task 09.6 [US-6] Filter / sort / pagination within the Archived view

Per [spec.md US-6](spec.md):

- With ~10+ archived rows across mixed statuses, switch to the Archived view.
- âœ… Apply `Status = Rejected` filter â€” only matching archived rows shown.
- âœ… Change sort to `Salary desc` â€” order updates.
- âœ… Paginate â€” correct chunking.
- âœ… Switch back to Active â€” the same filter + sort still applied (against active rows now).
- âœ… Pagination reset to page 1 on each switch.

### [X] Task 09.7 Mobile layout

- DevTools at â‰¤ 639px (or a real mobile device on the preview deploy).
- âœ… Toolbar view chip renders correctly and the popup is reachable.
- âœ… Archived cards stack via the existing flex-column order; the single â†º button is touch-reachable.
- âœ… Archived overlay opens as a bottom sheet (slides up, max-height 92vh).
- âœ… FAB is absent on the Archived view; visible on Active.
- âœ… Profile archived link is touch-reachable, navigates correctly.

### [X] Task 09.8 Hosted mode parity

- Sign in to a preview deploy.
- âœ… Migration applied; `archived_date` column present in Supabase.
- âœ… Repeat 09.1 â€“ 09.5 against hosted data.
- âœ… A second user signing in cannot see the first user's archived rows.
- âœ… Pre-feature archived rows (if any) display `Archived <lastStatusUpdate>` (fallback) without crashing.

### [X] Task 09.9 Demo mode

- Open the demo from the welcome page.
- âœ… The Archived view shows the two seeded archived rows.
- âœ… Unarchive one â€” disappears from Archived, reappears in Active.
- âœ… Archive an active demo row â€” appears in Archived.
- âœ… Reload â€” demo state reverts to seed (feature 020 FR-004; not persisted).

---

**Pass criteria for Phase 09**: every checkbox above is `âœ…` in a real browser walkthrough. Deviations or deferred items must be documented in this file (under the task) with a rationale and a follow-up reference (issue link or next-feature deferral note) before the feature is merged.
