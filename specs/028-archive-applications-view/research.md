# Research â€” 028 Archive Applications View

This document captures the technical investigation that informed [plan.md](plan.md). It is the record of *what is true today* (verified against current code) and *what decisions follow from that*, organized by surface.

## 1 Â· Server data layer

### 1.1 Â· SQLite schema and queries

- The `applications` table already carries an `archived` boolean column (`server/db/columns.js:36`, `:113`).
- Default value on insert is `0` (`server/db/applications.js:35`).
- The active-list query already filters `WHERE archived = 0 ORDER BY created_at DESC` (`server/db/applications.js:23`).
- `getById` does **not** filter on `archived` â€” it returns archived rows by id. This is correct: card â†’ overlay â†’ modal flow needs to load archived rows by id for the read-only overlay.
- The current `archive(id)` SQL statement sets `archived = 1, fav = 0, updated_at = @updated_at` in one update (`server/db/applications.js:93-97`).

**Implications for this feature:**
- Need a new `archived_date` column (ISO `YYYY-MM-DD` text in SQLite, `date` in Postgres).
- The `archive()` statement drops `fav = 0` (FR-009) and adds `archived_date = @archived_date`.
- A new `unarchive(id, now)` function mirrors `archive()` shape: `SET archived = 0, archived_date = NULL, updated_at = @updated_at`. It does **not** touch `fav`, `status`, `last_status_update`, `application_date`, or any user-content field.
- A new query path is required to read **only** archived rows. Two options considered (see Â§5 below); decision: a query param on the existing list endpoint.

### 1.2 Â· Supabase (hosted) repo

- `server/repositories/supabase/applications.js:76-85` mirrors SQLite: `.eq('archived', false)` filters the active list.
- `archive()` (`:144-159`) explicitly writes `{ archived: true, fav: false, updated_at: now }` â€” duplicate of SQLite's behavior.
- Per `APPLICATION_COLUMNS_WITHOUT_USER_ID` in `server/db/columns.js:85`, the Supabase select projection must include the new `archived_date` column once the migration lands.

**Implications:**
- Add `unarchive(id, now)` method to the returned object (`server/repositories/supabase/applications.js:161`).
- Drop the `fav: false` from `archive()` and add `archived_date: now`.
- Append `'archived_date'` to `APPLICATION_COLUMNS_WITHOUT_USER_ID`.
- Schema migration: the Supabase `applications` table gains an `archived_date date` column (nullable, default NULL) via inline SQL pasted in the Supabase SQL editor at deploy time. This project does not use Supabase CLI migration files â€” canonical pattern from [025-application-timeline/data-model.md Â§ 4.1](../025-application-timeline/data-model.md#L165-L175). Existing rows have NULL â†’ the card date-stamp falls back to `lastStatusUpdate` per the design.

### 1.3 Â· Shared `toRow()` helper

- `server/db/columns.js:213-218` has a fav-clearing side effect when `archived: true` is written through any path (e.g. a hypothetical `PATCH { archived: true }`):
  ```
  } else if (field === 'archived') {
    row[column] = value ? 1 : 0;
    if (value) {
      row.fav = 0;
    }
  ```
- This is a second site of `fav`-clearing that must be removed alongside the explicit `SET fav = 0` in `archive()` (FR-009). Otherwise the bug ("archive zeros fav") will quietly survive in any PATCH-based archive write path.

### 1.4 Â· Validation schemas

- `server/validation/application.js:103` already lists `archived: optionalBoolean`. No schema change is needed for archive itself.
- For `archived_date`, the field is **server-set, never client-supplied**. We deliberately do **not** add it to `updateSchema` â€” clients should not be able to write it directly. Tests must assert that a PATCH containing `archivedDate` is ignored (or rejected, depending on the strictness mode of `safeParse`).

### 1.5 Â· Route surface

- `server/routes/applications.js:173` is the existing archive endpoint.
- Pattern to mirror: parse id, call repo method, return 200 with record or 404.
- New `POST /:id/unarchive` slots in immediately after, identical structure.
- `GET /` (`:90`) needs to gain an opt-in `?view=archived` query selector. Strict allowlist: only `archived` is accepted as a value; anything else (including `?view=active`, `?view=`, or no param) returns the active list. Mirrors how the existing list endpoint is permissive about extra query strings without surfacing them.

## 2 Â· Client data layer

### 2.1 Â· `src/services/api.js`

- `api.archive(id)` exists (`:102-105`) and currently POSTs to `/api/applications/${id}/archive`, with a `fromDemo(() => demoStore.archive(id))` branch.
- `api.getAll()` (verify in file) currently has no query param â€” it always returns the active list.

**Changes:**
- Add `api.unarchive(id)` mirroring `archive(id)`, including `fromDemo(() => demoStore.unarchive(id))`.
- Extend `api.getAll(opts?)` to optionally accept `{ view: 'archived' }`; when set, the GET URL becomes `/api/applications?view=archived` and the demo branch calls `demoStore.getAllArchived()`.

### 2.2 Â· `src/data/demoStore.js`

- **Critical mismatch.** Today `demoStore.archive(id)` literally **splices the row out of the array** (`:153-158`). There is no archive flag retained in demo mode â€” once "archived," the row is gone.
- This makes the Archived view impossible in demo mode unless the semantic changes.

**Changes:**
- `archive(id, now)`: keep the row in `_applications`, set `archived: true` and `archivedDate: now`. Do not touch `fav`.
- New `unarchive(id, now)`: set `archived: false` and `archivedDate: null`. Do not touch other fields.
- New filtering at read time: `getAll()` returns only `archived === false` rows (already implicitly true today because archived rows were spliced out; now becomes an explicit filter). New `getAllArchived()` (or `getAll({ view: 'archived' })`) returns only `archived === true` rows.
- The demoSeed (`src/data/demoSeed.js`) currently has no archived rows. Decision: seed two archived demo rows so a fresh demo session has something to show in the Archived view. Otherwise the Profile "Archived applications Â· 0 â†’" link leads to an empty state, which is functionally correct but does not demo the feature.

### 2.3 Â· `src/data/store.js` (localStorage path)

- Legacy localStorage path appears used as a fallback (`STORAGE_KEY = 'apptracker_applications'` at `:8`). Verify whether it is still in the live wire-up (likely deprecated or used only for offline-resilience). If still active, the same archive â†” unarchive semantics apply.

## 3 Â· Client UI surface

### 3.1 Â· Tracker page (`src/pages/Tracker.js`, 522 lines)

- Currently has a single list rendering; no view switching.
- `await api.archive(coerceId(id))` (`:379`) is the only archive call here.
- Needs:
  - A `currentView` state (string `'active' | 'archived'`), initialised from `URLSearchParams(window.location.search).get('view')`.
  - URL sync: when the view changes, push `?view=archived` or strip the param via `history.replaceState`.
  - List query: `api.getAll(currentView === 'archived' ? { view: 'archived' } : {})`.
  - Pagination reset to page 1 on view switch; filters/sort preserved.
  - Hide the "+ New application" toolbar button and FAB while `currentView === 'archived'`.
  - Empty-state copy variants for the archived view (`Nothing archived yet. / Archived applications will appear here.` and `No archived items match / the active filters.`).
  - Wire the new `â†º` unarchive handler on archived cards.

### 3.2 Â· Toolbar component (`src/components/Toolbar.js` â€” verify file)

- Needs a new `view-chip` element (per `tracker.md` Â§ View switcher) wrapping the title label + count badge in one pill, with a chevron and a click handler that opens the view popup.
- New `view-popup` component (likely inline in Toolbar.js, similar to `QuickFiltersStatusPopup.js`) â€” backdrop-on-outside-click, header label "View", two option rows (Active + Archived) with dot/label/count-pill grid, indigo highlight on the selected row.
- Count badges inside the popup reflect the **filtered** counts for both views, computed alongside the active-list render.

### 3.3 Â· Card component (`src/components/Card.js`, 202 lines)

- Today builds the full quick-actions row with `editButton, statusButton, copyButton, starButton, archiveButton`.
- Needs an archived-card branch:
  - Conditional `card-archived` class on the root.
  - "Archived" stamp chip in Row 1's meta cluster (per `tracker.md` Â§ Archived card variant).
  - Date-stamp slot reads `Archived ${archivedDate || lastStatusUpdate}` instead of `Updated ${lastStatusUpdate}`.
  - Quick-actions row collapses to a single â†º Unarchive button (no âœŽ, â‡„, ðŸ”—, â˜…, Ã—).
  - The unarchive button calls `api.unarchive(id)`, refreshes the list, fires toast `Unarchived.`.

### 3.4 Â· Modal component (`src/components/Modal.js`, 1048 lines)

- Currently supports `edit` and `create` modes.
- Needs a third `archived` mode (per `application_overlay.md` Â§12):
  - Mode is determined by the row's `archived` flag, not by the active view.
  - Add an "ARCHIVED" chip in the header next to the status badge, with contrast-aware variant classes (`modal-header--light` / `modal-header--dark`).
  - Collapse the header action cluster to â†º + âœ• only. Hide â˜…, â‡„, ðŸ—„.
  - Suppress every body field's click-to-edit affordance: no caret cursor, no hover lift, no chip remove buttons, no chip-editor input, no dropdown trigger.
  - Status badge becomes non-interactive (no Status Dropdown).
  - Footer (Save/Discard) not rendered.
  - âœ• / Esc / backdrop close immediately, no discard confirmation.
  - `Cmd/Ctrl+S` is a no-op.
  - â†º button calls `api.unarchive(id)`, closes the modal, fires toast `Unarchived.`.

### 3.5 Â· Profile page (`src/pages/Profile.js`)

- Existing stat tiles (`createStatChipRow` in `:108-121`) use `computeStats` whose source is `getAll()` â€” already excludes archived. **No behavioral change to existing tiles** is needed for FR-027.
- New: an `Archived applications Â· N â†’` link added to the Applications section (location to be confirmed during implementation review â€” likely directly under the stat chip row or as a separate sub-section affordance).
- The link's count `N` requires a separate fetch since `getAll()` returns only active rows. Options:
  - **Chosen:** Profile calls `api.getAll({ view: 'archived' })` once on mount in parallel with the existing `getAll()` and counts the array length. Same shape as the active fetch, no new endpoint.
  - Rejected: a dedicated `GET /api/applications/archived-count` summary endpoint â€” premature optimization for what is at most a few hundred rows per user.

### 3.6 Â· Calendar page

- `src/pages/Calendar.js:400` reads from `api.getAll()` which excludes archived. Calendar already correctly excludes archived rows from its Action Panel, Suggested Actions, Month Grid chips, and Upcoming, because the data source is already filtered upstream.
- **No code change is required** to satisfy FR-024â€¦FR-026 â€” they are already satisfied by virtue of the data flow. The tasks document will include an explicit verification test rather than a code change.

### 3.7 Â· Styles (`src/styles/main.css`, 6606 lines)

- Today: no CSS for `.view-chip`, `.view-popup`, `.card-archived`, `.card-archived-stamp`, `.archived-stamp`, `.modal-header--light/dark` archived chip variants, the â†º Unarchive button variants, or the Profile archived link.
- All new styles are net-additive; no existing class needs to change except possibly the `.card-btn-row` / `.quick-actions` to support the single-button archived variant. Use existing tokens (`--navy`, `--indigo`, `--r-pill`, etc.) end-to-end.

## 4 Â· Test surface

### 4.1 Â· Existing tests that need updating

- `tests/components/Modal.test.js:1360` â€” asserts `fav: false` after archive. Update to assert `fav` is preserved (test passes both `fav: true` initial state and an unchanged post-archive value).
- `tests/components/Modal.test.js:144, 310, 366, 389` â€” header action cluster expectations. Verify these still hold for `edit` / `create` modes after the archived mode is added (no regression).
- `tests/components/Card.test.js:93-97` â€” assert the existing archive button SVG. New test cases cover the archived-card variant having only â†º and not Ã—.

### 4.2 Â· New test files

- `tests/server/routes-protected.test.js` â€” extend to cover `POST /:id/unarchive` (auth required, 404 when not owner / not found, 200 with record on success).
- New `tests/server/db/archive.test.js` (or co-located with existing applications db tests) â€” round-trip: archive sets `archived_date`; unarchive clears it; both leave `fav`, `status`, `last_status_update` untouched.
- `tests/data/demoStore.test.js` â€” round-trip parity assertions: archive keeps the row in the array; getAll excludes archived; getAllArchived returns only archived; unarchive flips back; `fav` preserved across both.
- `tests/services/api.test.js` â€” `api.unarchive(id)` posts to the right URL; `api.getAll({ view: 'archived' })` sends `?view=archived`.
- `tests/pages/Tracker.test.js` â€” view chip toggles; URL sync round-trip; pagination resets on switch; filters/sort persist; +New button hidden in archived view; archived card unarchive flow.
- `tests/components/Modal.test.js` â€” archived mode header chip; no Save/Discard footer; field click is inert; â†º button calls unarchive and closes the modal; Esc/backdrop close immediately (no discard dialog).
- `tests/pages/Profile.test.js` (or `ProfileEdit.test.js` if profile suite is split) â€” `Archived applications Â· N â†’` link renders with the correct count, including `0`; clicking it navigates to `/?view=archived`.
- `tests/pages/Calendar.test.js` â€” verification test: an archived row's timeline entries do **not** appear in the Calendar's Today / Upcoming / Month Grid / Suggested Actions sections (already true by virtue of data source; lock in with an explicit test).

## 5 Â· Decisions made at planning

### 5.1 Â· Archived-list endpoint shape (FR-010)

**Decision:** Add `?view=archived` as a query parameter on the existing `GET /api/applications` endpoint. No new endpoint.

**Rationale:**
- Reuses the existing list path, validation, RLS, and authentication pattern. No additional surface area to secure.
- Matches the URL parameter the client already uses for the view switcher (single source of truth â€” the server's `?view=archived` and the browser's `?view=archived` mean the same thing).
- Trivial to extend later: a third value (e.g. `?view=all` for admin/debug) is a one-line allowlist change.
- Permissive: unknown values fall back to active, identical to no-param behavior. Avoids 400-error noise from the existing client during gradual rollout.

**Rejected alternative:** a dedicated `GET /api/applications/archived` endpoint â€” duplicates the entire route handler, validation, and RLS wiring for no architectural gain.

### 5.1.1 Â· Supabase `archive()` / `unarchive()` concurrency hardening

**Decision:** Use an atomic conditional UPDATE that only flips state when the row is currently in the opposite state:
```js
.update({ archived: true, archived_date: now, updated_at: now })
.eq('id', id).eq('user_id', userId)
.eq('archived', false)         // â† race-killing predicate
```
On a no-op (row already archived, or row absent), the UPDATE matches 0 rows and the adapter falls back to `getById(id)` to return the current record.

**Rationale:**
- **Eliminates the read-then-write race window.** Two concurrent `archive(id, t1)` and `archive(id, t2)` calls cannot both write `archived_date` â€” Postgres serializes the UPDATEs, and the second one's `archived = false` predicate matches 0 rows (because the first call set `archived = true`).
- **Idempotency is intrinsic to the SQL.** No application-level branching on "is this a re-archive?". FR-008 is satisfied at the database layer, not the adapter layer.
- **Simpler than read-then-write.** The originally-proposed `existing.archivedDate ?? now` pattern required a `getById` *before* every UPDATE and computed COALESCE in JavaScript. The atomic pattern needs the `getById` only on the no-op path, which is rare.
- **Single round-trip happy path.** Archive/unarchive of a transition (the common case) is one UPDATE. The fallback `getById` only fires on idempotent re-calls.
- **Symmetric across SQLite and Supabase.** Both adapters use the same atomic conditional UPDATE pattern with an `archived = <opposite>` predicate. This eliminates the SQL-level `COALESCE` and ensures FR-033 mode parity â€” `updated_at` is bumped only on actual transitions (not on idempotent re-calls) in both paths. The earlier draft used SQL-level COALESCE on SQLite, which would have bumped `updated_at` on re-archive while Supabase did not. Symmetric predicates close that gap.
- **Symmetric for unarchive too.** The same pattern applies for unarchive with `.eq('archived', true)` (or `AND archived = 1` in SQLite). Both write paths (archive â†” unarchive) are race-free and idempotency-clean by construction.

**Rejected alternatives:**
- *Read-then-write with COALESCE in JS.* Has a sub-second race window between `getById` and `update`. At this app's per-user traffic the practical risk is near zero, but the predicate-UPDATE costs nothing extra and is genuinely correct.
- *Postgres stored function with COALESCE.* Adds DB infrastructure (a new RPC + migration entry) for marginal gain over the predicate-UPDATE.
- *BEFORE UPDATE trigger that preserves archived_date.* Same DB-infrastructure cost; also invisible to anyone reading the adapter code.

### 5.2 Â· `?view=archived` URL preservation across sign-in redirect

**Decision:** Drop the query param on the welcome-page redirect; the user lands on the default Active view after sign-in. Re-entering the Archived view from the Profile link or the toolbar chip is a one-click operation, and this matches the spec's "either behavior satisfies" stance.

**Rationale:**
- Keeps `src/pages/welcome/*` and the auth flow unchanged. Adding a "preserve return URL" mechanic across auth is a separate concern that affects multiple feature surfaces, not just archive.
- The Profile entry point covers the case where the user signed in *intending* to see archived rows.

### 5.3 Â· Demo seed includes archived rows

**Decision:** Add two archived rows to `src/data/demoSeed.js` so a fresh demo session has visible archive content.

**Rationale:**
- Without seed data, the demo view's only state is "Nothing archived yet." â€” which doesn't demonstrate the feature.
- Two rows is enough to show: the archived card variant, the unarchive interaction, the toolbar chip count, and the Profile link badge with `N > 0`.

### 5.4 Â· `fav` preservation: remove both clearing sites

**Decision:** Remove `fav = 0` from `archive()` in SQLite (`server/db/applications.js:95`), Supabase (`server/repositories/supabase/applications.js:152`), AND the implicit clearing in `toRow()` (`server/db/columns.js:213-218`).

**Rationale:**
- The spec mandates `fav` survives the archive â†” unarchive round-trip (FR-009).
- Leaving any of the three sites in place would re-introduce the bug through different write paths.
- Existing test `tests/components/Modal.test.js:1360` will need a one-line update.

### 5.5 Â· Calendar exclusion: no code change

**Decision:** Add only a verification test, no production code change.

**Rationale:**
- The Calendar already reads from `api.getAll()` (active-only). Archived rows are not in the data source it iterates over.
- Adding a defensive `.filter(a => !a.archived)` somewhere would be dead code today; it would mask future regressions if the data source ever changed.
- A test that seeds an archived row with a today-dated timeline entry and asserts it does **not** appear in the Calendar's Today section locks in the invariant.

## 6 Â· Risks and tradeoffs

### 6.1 Â· `archived_date` migration on Supabase

The hosted Supabase project needs a schema migration to add the `archived_date` column. Risks:

- Existing archived rows have no archived_date. The spec covers this â€” the card date-stamp falls back to `lastStatusUpdate`. Verify the migration is non-blocking (nullable column, no backfill required).
- The Supabase column type should be `date` (not `timestamptz`) to match how `last_status_update` and `application_date` are stored. Verify alignment when authoring the migration.

### 6.2 Â· `fav` behavior change is observable

Removing the `fav = 0` side effect of archive is a **user-observable behavior change** to existing archive. A user who archived a starred row in the past and re-opens the archive view (post-deploy) will not see this change retroactively â€” `fav` was already cleared in their stored record. The change is forward-only.

- Mitigation: the spec calls this out (FR-009 + Out of scope). Document in CHANGELOG.

### 6.3 Â· Demo mode semantic change

The demoStore refactor â€” from "archive splices the row out" to "archive sets a flag" â€” changes the in-memory shape of `_applications` for any test or component that introspects it directly.

- Mitigation: the public store API surface stays the same (`getAll`, `archive`, plus new `unarchive` and `getAllArchived`). Internal tests that introspect `_applications` directly may need updating; assert via the public API instead.

### 6.4 Â· URL initialisation race

`?view=archived` must take effect *before* the first list render to avoid the "flash of Active view" called out in Acceptance Scenario 1.2.

- Mitigation: read `URLSearchParams` synchronously during Tracker mount, before the first `api.getAll(...)` call. Don't fetch the active list speculatively then re-fetch the archived list on view detection.

### 6.5 Â· Filter/sort persistence across switch

If filters and sort live in module-level state in the Tracker/QuickFilters components, "persist across switch" comes for free. If they're scoped to per-view component instances, we need to lift them.

- Mitigation: confirmed by reading Tracker.js â€” the filter/sort state is page-level. Just don't reset on view switch.

### 6.6 Â· Concurrent archive / unarchive writes on Supabase *(closed at design time)*

Raised at spec-review time as a theoretical race window: two concurrent `archive(id)` calls could both write `archived_date` to different values, with the later call winning.

- **Resolution:** see [Â§ 5.1.1](#511--supabase-archive--unarchive-concurrency-hardening). Both adapters use an atomic conditional UPDATE with an `archived = <opposite-state>` predicate. The second (concurrent) call matches 0 rows and falls back to `getById`, returning the first call's record unchanged. Race window eliminated at the SQL layer for SQLite (`AND archived = 0` / `AND archived = 1` clauses) and for Supabase (`.eq('archived', false)` / `.eq('archived', true)` clauses).
- **Symmetry:** the same pattern protects concurrent `unarchive(id)` calls symmetrically â€” the `archived = true` predicate makes the second concurrent unarchive a no-op. Both write paths (archive and unarchive) are race-free by construction.
- **Test coverage:** [Task 01.4 validation cases #2 and #3](tasks.md#-task-014--sqlite-repo-behavior-fix--new-unarchive--archived-list-query) and [Task 01.5 validation case #4](tasks.md#-task-015--supabase-repo-behavior-fix--new-unarchive--archived-list-query--migration-sql) â€” assert the adapter-pattern wiring. True race-freedom under genuine concurrent writes is a Postgres / better-sqlite3 serialization guarantee, not a JS-testable property.

## 7 Â· Validation approach

See [plan.md Â§ Validation](plan.md#validation) for the test pyramid. Quick summary:

- **Unit / model layer**: archive + unarchive in SQLite db helpers; archive + unarchive in demoStore; computeAppCounts ignoring archived rows.
- **Service / route layer**: route tests for POST /:id/unarchive (200 / 404 / 401); GET /?view=archived (filters correctly, ignores other view values).
- **Component layer**: Card archived variant; Modal archived mode; Toolbar view chip.
- **Page layer**: Tracker view switching + URL sync; Profile link with count.
- **End-to-end / smoke**: the mandatory final-phase browser smoke test walks every P1/P2 story per constitution Amendment 1.1.0.
