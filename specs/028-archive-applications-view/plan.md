# Implementation Plan: Archive Applications View

**Branch**: `028-archive-applications-view` | **Date**: 2026-05-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from [spec.md](spec.md), feature brief at [docs/features/028-archive-applications-view.md](../../docs/features/028-archive-applications-view.md), design refs at [docs/design/tracker.md](../../docs/design/tracker.md) (View switcher + Archived card variant) and [docs/design/application_overlay.md](../../docs/design/application_overlay.md) (§12 Archived mode).

**Supporting artifacts** (per [Plan supporting artifacts](../../../../C:/Users/acres/.claude/projects/d--Alvin--CodeProjects-Project-Alice/memory/feedback_plan_artifacts.md) memory):

- [research.md](research.md) — code survey + decisions
- [data-model.md](data-model.md) — `archived_date` column + demoStore semantic change
- [contracts/api.md](contracts/api.md) — `GET /?view=archived`, `POST /:id/unarchive`, behavior change to `POST /:id/archive`
- [quickstart.md](quickstart.md) — local + demo + hosted verification walk-through
- [checklists/plan-review.md](checklists/plan-review.md) — pre-tasks gate

---

## Summary

Close the archive lifecycle loop. The codebase already lets a user archive an application (`POST /api/applications/:id/archive`, the × button on the card, the 🗄 button in the overlay) but archived rows are unreachable thereafter — there is no archived list, no unarchive operation, no UI surface to restore a row.

This feature adds:

1. A **server-side restore path**: `POST /api/applications/:id/unarchive`, a new `archived_date` column populated automatically on archive, and a `?view=archived` query parameter on the existing list endpoint.
2. A **client view switcher** on the Tracker toolbar (per `tracker.md` § View switcher), URL-synchronized to `?view=archived`.
3. An **archived card variant** (per `tracker.md` § Card > Archived card variant): "Archived" stamp chip, date-stamp slot reading "Archived [date]", quick-actions row collapsed to a single ↺ Unarchive button.
4. An **archived overlay mode** (per `application_overlay.md` §12): read-only, footer hidden, only ↺ and ✕ in the header, no draft state, no discard confirmation.
5. A **Profile entry point**: `Archived applications · N →` link that deep-links to `Tracker.html?view=archived` and always renders (even at `N = 0`).
6. **Exclusion** of archived rows from active surfaces (already mostly true — the Calendar and Profile read from `getAll()` which excludes archived).
7. A **behavior fix** to existing archive: stop clearing `fav` (FR-009).

Mode parity (SQLite / Supabase / demo in-memory) is preserved end-to-end; the demoStore is refactored from "splice on archive" to "set flag on archive" so the Archived view has demo data to render.

## Technical Context

**Language/Version**: Node 24 LTS (server) + ES2022 modules in the browser (Vite-bundled)
**Primary Dependencies**: Express 4, `better-sqlite3` (local), `@supabase/supabase-js` (hosted), Vite, Vitest. No new dependencies.
**Storage**: SQLite (`server/data.db`) locally; Supabase Postgres in hosted mode; in-memory `_applications` array in demo mode.
**Testing**: Vitest (`tests/`), with `tests/server/*` for backend and `tests/components`, `tests/pages`, `tests/services`, `tests/data` for client-side.
**Target Platform**: Modern desktop + mobile browsers (Chromium / Firefox / Safari + their mobile variants). Server runs on Node 24 LTS on Vercel Functions in hosted mode and a local Express process in dev/local mode.
**Project Type**: Web application — Vite + Vanilla JS frontend, Express backend (`server/`), shared modules under `shared/`, repository-pattern data layer (SQLite + Supabase adapters).
**Performance Goals**: No new perf targets. The archived list is bounded by the same per-user row count as the active list (a few hundred at most); render performance characteristics are identical.
**Constraints**: No external network calls beyond the existing Supabase API. Local-first / privacy-preserving (constitution VI). No new analytics. Mobile viewport <640px must work for every new surface (toolbar chip, archived card, archived overlay).
**Scale/Scope**: Single user, per-account row sets in the low hundreds. No need for paged backend responses or summary endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Application records still include required `companyName`, `jobTitle`, `status`, `lastStatusUpdate`, `responsibilities` — archive and unarchive do not modify these.
- [x] Business logic (`archive` / `unarchive` repo methods, exclusion filters) is separated from UI rendering (Tracker, Card, Modal, Profile). The view chip and overlay archived-mode flag are presentation-only; the truth of "is this row archived" lives in the row's `archived` field.
- [x] Validation rules are preserved. The new `archivedDate` field is server-set, never client-writable; it is intentionally **not** added to `updateSchema` in `server/validation/application.js`.
- [x] Main workflows (add, edit, search/filter, review, stale applications, follow-ups) all continue to operate on the active list. The archived view exposes the parallel review path for archived rows.
- [x] Empty / loading / error states are defined for both views (FR-034–FR-036).
- [x] Automated tests are planned for: archive `archivedDate` set; unarchive `archivedDate` cleared; `fav` round-trip preservation; URL `?view=archived` parsing; Calendar exclusion; archived overlay read-only behavior; Profile link.
- [x] Lint / format checks remain the same (no new tooling).
- [x] Local-first / no external analytics is preserved (no new third-party calls).
- [x] Desktop / mobile responsiveness is addressed for every new surface (view chip, archived card, archived overlay, Profile link). Keyboard navigation for ↺ Unarchive and the view chip is on par with existing buttons.
- [x] Data-model extensibility: `archived_date` is a single nullable column. Future extensions (e.g. archive reason, archive batch id) are additive and do not require restructuring.

**Re-check after Phase 1 design**: pending — runs as part of the [plan-review.md](checklists/plan-review.md) checklist immediately before `/speckit.tasks`.

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│  Browser                                                               │
│                                                                        │
│  ┌─────────────┐    ┌────────────────────────────┐    ┌────────────┐   │
│  │   Tracker   │    │  Application Overlay       │    │  Profile   │   │
│  │   page      │    │  (Modal.js)                │    │   page     │   │
│  │             │    │                            │    │            │   │
│  │  ┌────────┐ │    │  • edit mode               │    │  • Total   │   │
│  │  │ View   │ │    │  • create mode             │    │  • Active  │   │
│  │  │ chip   │ │    │  • archived mode  ← new    │    │  • Pending │   │
│  │  │ ▾   N  │ │    │     - ARCHIVED chip        │    │  • Offer   │   │
│  │  └────────┘ │    │     - ↺ + ✕ only           │    │  Archived  │   │
│  │  ┌────────┐ │    │     - footer hidden        │    │  apps · N →│   │
│  │  │ card   │ │    │     - body read-only       │    │            │   │
│  │  │ active │ │    │                            │    └────────────┘   │
│  │  │  or    │ │    └────────────────────────────┘                     │
│  │  │ archvd │ │            ▲                                          │
│  │  └────────┘ │            │ open by id                               │
│  └──────┬──────┘            │                                          │
│         │                   │                                          │
│  ┌──────▼───────────────────┴────────────────────────────────────┐     │
│  │  api.js  (client service)                                     │     │
│  │    getAll({ view })  ── archive(id)  ── unarchive(id)  ← new  │     │
│  └──────┬───────────────────────┬────────────────────────────────┘     │
│         │ live mode             │ demo mode                            │
└─────────┼───────────────────────┼────────────────────────────────────┐ │
          │                       │                                    │ │
   ┌──────▼─────────┐    ┌────────▼──────────────┐                       │
   │ HTTP (fetch)   │    │ demoStore (in-memory) │  ── archive sets flag │
   └──────┬─────────┘    └───────────────────────┘     not splice (new)  │
          │                                                              │
┌─────────▼──────────────────────────────────────────────────────────┐   │
│ Express routes (server/routes/applications.js)                     │   │
│                                                                    │   │
│  GET    /api/applications[?view=archived]   ← extended             │   │
│  POST   /api/applications/:id/archive       ← no longer zeros fav  │   │
│  POST   /api/applications/:id/unarchive     ← new                  │   │
│  PATCH  /api/applications/:id               ← ignores archivedDate │   │
└───────────────────────┬────────────────────────────────────────────┘   │
                        │                                                │
        ┌───────────────┴──────────────────┐                             │
        │                                  │                             │
┌───────▼──────────────────┐    ┌──────────▼─────────────────────────┐   │
│  SQLite adapter          │    │  Supabase adapter                  │   │
│  server/db/applications.js  │  server/repositories/supabase/      │   │
│                          │    │  applications.js                   │   │
│  archive() — sets         │    │  archive() — sets                  │   │
│    archived_date          │    │    archived_date                   │   │
│  unarchive() — clears it  │    │  unarchive() — clears it           │   │
│                          │    │                                    │   │
│  Both keep fav unchanged. │    │  Both keep fav unchanged.          │   │
└──────────────────────────┘    └────────────────────────────────────┘   │
```

### Key architectural decisions

1. **Query-param view selection (not a new endpoint).** `GET /api/applications?view=archived` reuses the existing list path, RLS, auth, and validation. Unknown `view` values fall back to active. See [research.md § 5.1](research.md#51--archived-list-endpoint-shape-fr-010).
2. **Server-set `archived_date` only.** Client PATCH containing `archivedDate` is dropped silently — the field is not in `FIELD_TO_COLUMN`. See [data-model.md § 1.2](data-model.md#12--field-mapping-serverdbcolumnsjs).
3. **No Calendar code change.** Calendar's data source (`api.getAll()`) already returns active-only rows, so archived rows are excluded by virtue of the data flow. Only a verification test is added. See [research.md § 5.5](research.md#55--calendar-exclusion-no-code-change).
4. **demoStore refactored from splice to flag.** Demo mode's `archive()` currently deletes the row outright; this changes to flipping `archived: true` so the Archived view is renderable in demo mode. Seed gets two archived rows. See [research.md § 5.3](research.md#53--demo-seed-includes-archived-rows).
5. **`fav` preservation at three removal sites.** Drop the `fav = 0` side effect from SQLite `archive()`, Supabase `archive()`, AND the implicit clearing inside `toRow()`. See [research.md § 5.4](research.md#54--fav-preservation-remove-both-clearing-sites).

## Data flow

### Archive flow (existing + behavior change)

1. User clicks × on a card (or 🗄 in the overlay).
2. `ConfirmDialog` opens; user confirms.
3. Client → `api.archive(id)` → `POST /api/applications/:id/archive`.
4. Server route → repo `archive(id, now)` → atomic conditional UPDATE: `SET archived = 1, archived_date = now, updated_at = now WHERE id = @id AND archived = 0`. Both adapters use the same predicate-UPDATE pattern; the second (re-archive) request matches 0 rows and resolves via a fallback `getById` (idempotent, no `updated_at` bump). **No fav write.**
5. Response 200 with updated record (`{ archived: true, archivedDate: "2026-05-26", fav: <preserved>, ... }`).
6. Tracker refreshes the active list (row is now absent); toolbar chip's count drops by 1.
7. If the user is currently on the Archived view (e.g. archived from the overlay opened from an active card and then somehow saw an archived list — edge case), the Archived chip's count increments by 1.

### Unarchive flow (new)

1. User clicks ↺ on an archived card (in the Archived view) or in the archived overlay header.
2. No confirmation (non-destructive restore).
3. Client → `api.unarchive(id)` → `POST /api/applications/:id/unarchive`.
4. Server route → repo `unarchive(id, now)` → UPDATE row: `archived = 0, archived_date = NULL, updated_at = now`. **No other field touched.**
5. Response 200 with updated record (`{ archived: false, archivedDate: null, status: <unchanged>, fav: <preserved>, ... }`).
6. If from card: row leaves the Archived list, chip count drops by 1, toast `Unarchived.` fires.
7. If from overlay: overlay closes, row leaves the Archived list (if visible), chip count drops by 1, toast `Unarchived.` fires.

### View-switch flow

1. User clicks the toolbar chip (`Applications ▾` or `Archived ▾`). View popup opens.
2. User picks the other view.
3. Tracker:
   - Updates `currentView` state.
   - Pushes `?view=archived` or strips the param via `history.replaceState`.
   - Resets pagination to page 1 (filters and sort remain).
   - Calls `api.getAll(currentView === 'archived' ? { view: 'archived' } : {})`.
   - Re-renders cards. Toolbar chip label and count update. The `+ New application` button + FAB toggle visibility based on `currentView`.

### Deep-link flow

1. User opens `/Tracker.html?view=archived` directly (Profile link, bookmark, refresh).
2. Tracker mount reads `URLSearchParams` **synchronously** before the first list render.
3. Initial state is `currentView === 'archived'`.
4. First fetch is `api.getAll({ view: 'archived' })`.
5. No flash of Active view.

## Affected Areas

### Files / components likely to be modified

**Server:**
- [server/db/applications.js](../../server/db/applications.js) — `archive()` (remove `fav=0`, add `archived_date`), new `unarchive()`, new query path `getAll({ view: 'archived' })` (or equivalent param).
- [server/db/columns.js](../../server/db/columns.js) — **MODIFY**: add `'archived_date'` to `APPLICATION_COLUMNS_WITHOUT_USER_ID`; add `archivedDate: row.archived_date,` to `toRecord()`; remove the `fav = 0` side effect inside `toRow()`'s `archived` branch. **DO NOT MODIFY** `FIELD_TO_COLUMN`, `INSERTABLE_COLUMNS`, or `UPDATABLE_COLUMNS` — these are deliberately left untouched so `archivedDate` remains server-set-only per the canonical rule in [data-model.md § 1.2](data-model.md#12--field-mapping-serverdbcolumnsjs).
- [server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js) — `archive()` (remove `fav: false`, add `archived_date`), new `unarchive()`, extend `getAll()` to accept view param.
- [server/repositories/applications.js](../../server/repositories/applications.js) — repository interface contract: add `unarchive`.
- [server/routes/applications.js](../../server/routes/applications.js) — add `POST /:id/unarchive`; extend `GET /` to handle `?view=archived`.
- [server/db.js](../../server/db.js) — add a single `ensureColumn(targetDb, 'applications', 'archived_date', 'TEXT');` call alongside the existing `ensureColumn` cluster at [server/db.js:60-67](../../server/db.js#L60-L67). **DO NOT MODIFY** the `CREATE TABLE applications` statement — `ensureColumn` is idempotent and handles both fresh-DB initialization and migration of existing local databases. This matches the pattern feature 025 used for `timeline` and is the canonical SQLite-evolution mechanism per [data-model.md § 1.4](data-model.md#14--sqlite-local-schema).
- Supabase migration SQL — captured inline in [data-model.md § 1.3](data-model.md#13--migration-supabase-hosted), not in a separate file. The operator pastes the block in the Supabase SQL editor at deploy time (canonical pattern from feature 025).

**Client:**
- [src/services/api.js](../../src/services/api.js) — add `unarchive(id)`; extend `getAll(opts)`.
- [src/data/demoStore.js](../../src/data/demoStore.js) — refactor `archive(id)` to flip flag (not splice); add `unarchive(id)`, `getAllArchived()`; filter `getAll()` on `archived === false`.
- [src/data/demoSeed.js](../../src/data/demoSeed.js) — add two archived seed rows (one with `fav: true`, one in terminal status).
- [src/data/store.js](../../src/data/store.js) — inspect only (legacy localStorage path); confirm whether it's still wired up. If yes, mirror the demoStore semantics.
- [src/pages/Tracker.js](../../src/pages/Tracker.js) — view state, URL sync, list fetch by view, pagination reset on switch, +New / FAB visibility, archived-card unarchive handler, empty-state copy variants.
- [src/components/Toolbar.js](../../src/components/Toolbar.js) — view chip + view popup; count badges for both views.
- [src/components/Card.js](../../src/components/Card.js) — archived-card branch: stamp chip, Archived-date stamp, single-↺ quick-actions row, conditional class on root.
- [src/components/Modal.js](../../src/components/Modal.js) — third `archived` mode: ARCHIVED chip, header collapse to ↺+✕, body read-only, footer hidden, no discard flow, ↺ handler.
- [src/components/Fab.js](../../src/components/Fab.js) — visibility tied to `currentView`.
- [src/pages/Profile.js](../../src/pages/Profile.js) — Archived applications link with count from a parallel `api.getAll({ view: 'archived' })` fetch.
- [src/styles/main.css](../../src/styles/main.css) — new classes: `.view-chip`, `.view-popup`, `.card-archived`, `.card-archived-stamp`, `.archived-stamp` (overlay), `.modal-header--light .archived-stamp` / `.modal-header--dark .archived-stamp`, `.card-btn--unarchive`, `.modal-quick-action--unarchive`, archived-empty-state variants, Profile archived link.

### Files / components likely to be inspected only

- [src/components/ConfirmDialog.js](../../src/components/ConfirmDialog.js) — confirm existing archive confirm flow stays intact for active cards. No code change expected.
- [src/components/QuickFiltersToolbar.js](../../src/components/QuickFiltersToolbar.js) — confirm filter state is page-level (so it persists across view switch) and `currentView` does not reset it.
- [src/components/Pagination.js](../../src/components/Pagination.js) — confirm pagination resets correctly when the underlying list shrinks/swaps; no code change expected.
- [src/pages/Calendar.js](../../src/pages/Calendar.js) — already excludes archived via `api.getAll()`; verify with a test, no code change.
- [src/components/calendar/*.js](../../src/components/calendar/) — same; inspect only.
- [server/validation/application.js](../../server/validation/application.js) — confirm `archivedDate` is NOT added to `updateSchema` (intentional). No code change.
- [src/pages/welcome/*](../../src/pages/welcome/) — confirm no need to preserve `?view=archived` across sign-in (per [research.md § 5.2](research.md#52--viewarchived-url-preservation-across-sign-in-redirect)).
- [shared/constants.js](../../shared/constants.js) — confirm no status enum changes; no view enum needs to live here (the view is a UI concept, not a domain status).

### Tests likely to be added or updated

**Added (new test files or substantial new test blocks):**
- New cases in [tests/server/db/applications.test.js](../../tests/server/db/applications.test.js) (or co-located): archive sets `archived_date`; unarchive clears it; both preserve `fav`, `status`, `last_status_update`.
- New cases in [tests/server/routes-protected.test.js](../../tests/server/routes-protected.test.js): `POST /:id/unarchive` happy path, 404, 401; `GET /?view=archived` filters correctly; unknown view values fall back.
- New cases in [tests/data/demoStore.test.js](../../tests/data/demoStore.test.js): archive keeps row in array; `getAll()` excludes; new `getAllArchived()` returns archived; unarchive flips back; `fav` round-trip.
- New cases in [tests/services/api.test.js](../../tests/services/api.test.js): `api.unarchive(id)` URL; `api.getAll({ view: 'archived' })` URL.
- New cases in [tests/pages/Tracker.test.js](../../tests/pages/Tracker.test.js): view chip toggles; URL sync round-trip; `?view=archived` deep link initial render; pagination resets on switch; filters/sort persist; +New hidden in Archived view; ↺ Unarchive flow.
- New cases in [tests/components/Modal.test.js](../../tests/components/Modal.test.js): archived mode header chip; only ↺ + ✕ in action cluster; body fields inert; no Save/Discard footer; Esc closes immediately (no discard dialog); ↺ unarchives and closes.
- New cases in [tests/components/Card.test.js](../../tests/components/Card.test.js): archived card variant — stamp chip, date-stamp "Archived [date]", single-↺ action row.
- New test in [tests/pages/Calendar.test.js](../../tests/pages/Calendar.test.js): an archived row's timeline entries do NOT appear in Today / Upcoming / Month Grid chips / Suggested Actions (locks in the data-flow invariant).
- New test cases for Profile (location TBD — likely [tests/pages/Profile.test.js](../../tests/pages/Profile.test.js) if it exists, or a new file): Archived link renders with count `N` including `0`; click navigates to `?view=archived`; existing stat tiles unaffected.

**Updated:**
- [tests/components/Modal.test.js:1360](../../tests/components/Modal.test.js#L1360) — the existing `archive` test asserts `fav: false` after archive; update to assert `fav` is preserved.

### Areas explicitly out of scope

- Permanent deletion of individual archived applications.
- Bulk archive / bulk unarchive UI or endpoints.
- Archive-only analytics dashboards.
- Tagging / categorization of archived rows.
- Auto-archive heuristics.
- A `fav_before_archive` shadow column.
- An Undo toast on archive (deferred — the brief and `tracker.md` design omit it; only `application_overlay.md` §8 mentions it, and current source has no Undo wiring).
- Preserving `?view=archived` across the sign-in redirect (deferred — see [research.md § 5.2](research.md#52--viewarchived-url-preservation-across-sign-in-redirect)).
- Demo→hosted import preservation of archived rows (vacuous — no import flow exists; see spec.md § Withdrawn C5).

## Risks and tradeoffs

(Full discussion in [research.md § 6](research.md#6--risks-and-tradeoffs). Summary here.)

1. **Supabase migration**: nullable `archived_date date` column add. Non-blocking; existing archived rows have `NULL` and the client falls back to `lastStatusUpdate`.
2. **Observable `fav` behavior change**: archive no longer zeros `fav`. Document in CHANGELOG. Forward-only — historical archived rows that lost their `fav` are not retroactively recovered.
3. **demoStore semantic change**: from "splice on archive" to "flag on archive". Public API surface is stable; internal tests that introspect `_applications` directly may need updating.
4. **URL initialisation race**: `?view=archived` must be applied **before** the first list render. Mitigation: read `URLSearchParams` synchronously in Tracker mount before the first `api.getAll(...)` call.
5. **Filter / sort persistence**: relies on filters living at page-level state (confirmed in Tracker.js). If a future refactor pushes them into per-view component scope, the persistence behavior breaks. Tests guard against regression.

## Validation

### Test pyramid

| Layer | Where | What it covers |
|---|---|---|
| Unit (db helpers) | `tests/server/db/applications.test.js` | `archive(now)` sets `archived_date`; `unarchive(now)` clears it; round-trip preserves `fav`, `status`, `last_status_update`, every other column. `toRow()` no longer zeros `fav` when `archived: true`. |
| Unit (demoStore) | `tests/data/demoStore.test.js` | `archive(id)` keeps the row in the array; `getAll()` excludes archived; `getAllArchived()` returns only archived; `unarchive(id)` flips back; `fav` survives the round-trip. |
| Service (client API) | `tests/services/api.test.js` | `api.unarchive(id)` posts to `/api/applications/${id}/unarchive`; `api.getAll({ view: 'archived' })` sends `?view=archived`. |
| Route | `tests/server/routes-protected.test.js` | `POST /:id/unarchive` (200/404/401); `GET /?view=archived` (filtered correctly, unknown values fall back). |
| Component | `tests/components/{Card,Modal,Toolbar}.test.js` | Archived card variant; archived overlay mode read-only enforcement; view chip popup behavior. |
| Page | `tests/pages/{Tracker,Profile,Calendar}.test.js` | View switching + URL sync; Profile archived link; Calendar exclusion verification. |
| End-to-end (browser smoke) | Manual per [quickstart.md](quickstart.md) | All P1 + P2 stories on desktop + mobile viewports. Required by constitution Amendment 1.1.0. |

### Validation gates

1. **Pre-tasks gate** — every item in [checklists/plan-review.md](checklists/plan-review.md) is `[x]` or has a documented deferral reason.
2. **Pre-merge gate** (constitution V) — `npm test` green, lint + format green.
3. **Release Prep phase** (constitution Amendment 1.3.0) — version bump, CHANGELOG entry mentioning the `fav` behavior change, `docs/REPO_MAP.md` updated for any new files, `docs/deployment.md` updated for the Supabase migration if applicable.
4. **Browser Smoke Test phase** (constitution Amendment 1.1.0 + 1.3.0) — manual walk of every P1/P2 Independent Test on the to-be-merged branch state, on both desktop and mobile viewports.

## Project Structure

### Documentation (this feature)

```text
specs/028-archive-applications-view/
├── plan.md                       # This file
├── spec.md                       # Already authored (after /speckit.clarify)
├── research.md                   # Code survey + decisions
├── data-model.md                 # archived_date column + demoStore semantic change
├── quickstart.md                 # Local + demo + hosted verification walk-through
├── contracts/
│   └── api.md                    # GET /?view=archived, POST /:id/unarchive
├── checklists/
│   └── plan-review.md            # Pre-tasks gate
└── tasks.md                      # /speckit.tasks output — not created by /speckit.plan
```

### Source Code (repository root)

```text
server/
├── db/
│   ├── applications.js           # MODIFY: archive(), new unarchive(), getAll() variant
│   └── columns.js                # MODIFY: APPLICATION_COLUMNS_WITHOUT_USER_ID + toRecord (read-path); toRow fav side-effect removal. FIELD_TO_COLUMN / INSERTABLE_COLUMNS / UPDATABLE_COLUMNS are deliberately left unchanged.
├── repositories/
│   ├── applications.js           # MODIFY: interface gains unarchive
│   └── supabase/
│       └── applications.js       # MODIFY: archive(), new unarchive(), getAll() variant
├── routes/
│   └── applications.js           # MODIFY: extend GET /, new POST /:id/unarchive
├── validation/
│   └── application.js            # INSPECT ONLY (confirm archivedDate stays out of updateSchema)
└── db.js                         # MODIFY: add ensureColumn for archived_date (no CREATE TABLE edit)

src/
├── components/
│   ├── Card.js                   # MODIFY: archived-card variant
│   ├── Modal.js                  # MODIFY: archived mode
│   ├── Toolbar.js                # MODIFY: view chip + popup
│   └── Fab.js                    # MODIFY: visibility tied to view
├── data/
│   ├── demoStore.js              # MODIFY: archive → flip flag; new unarchive, getAllArchived
│   ├── demoSeed.js               # MODIFY: seed two archived rows
│   └── store.js                  # INSPECT (confirm legacy)
├── pages/
│   ├── Tracker.js                # MODIFY: view state, URL sync, list dispatch, +New/FAB visibility
│   ├── Profile.js                # MODIFY: Archived applications link
│   └── Calendar.js               # INSPECT ONLY
├── services/
│   └── api.js                    # MODIFY: getAll({ view }), new unarchive(id)
└── styles/
    └── main.css                  # MODIFY: new classes for view chip, archived card/overlay, etc.

tests/
├── components/{Card,Modal,Toolbar}.test.js  # MODIFY + ADD
├── data/demoStore.test.js                   # ADD (round-trip cases)
├── pages/{Tracker,Profile,Calendar}.test.js # ADD
├── server/db/applications.test.js           # ADD
├── server/routes-protected.test.js          # MODIFY (new endpoint cases)
└── services/api.test.js                     # ADD (unarchive, view query)

CHANGELOG.md                                 # MODIFY (Release Prep phase)
docs/REPO_MAP.md                             # MODIFY (Release Prep phase)
docs/deployment.md                           # MODIFY if migration steps change
```

**Structure Decision**: Use the existing repository layout (no new top-level directory). All changes fit into the existing `server/` (backend) + `src/` (frontend) + `tests/` (cross-cutting) layout. The data-layer changes are localized to `server/db/`, `server/repositories/`, and `src/data/` per the existing repository-pattern split.

## Complexity Tracking

No constitution violations identified — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|

## Phases

The implementation is broken into phases that map cleanly to user stories so each phase delivers an independently demoable slice. Detailed task ordering is the responsibility of `/speckit.tasks`; this plan declares the phase shape only.

| Phase | Theme | Primary FRs | User Stories | Independent demo |
|---|---|---|---|---|
| **1 · Data layer** | `archived_date` column, server-side archive/unarchive correctness, `fav` preservation, query path | FR-005…FR-012 | (foundation for US-1, US-2, US-5) | Repo + route tests green; manual curl shows `archived_date` populated and `fav` preserved |
| **2 · Client data + Tracker view switch** | `api.unarchive`, `api.getAll({ view })`, demoStore refactor + seed, Tracker view state + URL sync + +New/FAB visibility, empty states | FR-001…FR-004, FR-010, FR-029, FR-030, FR-031…FR-036 | US-1 (P1) | Toggle the chip, see the URL change, see archived list (empty until next phase wires unarchive UI) |
| **3 · Archived card** | Card variant, ↺ Unarchive from card, toasts | FR-013, FR-014, FR-037 | US-2 (P1) | Click ↺ on an archived card → row restored |
| **4 · Archived overlay mode** | Modal third mode, read-only enforcement, ↺ from overlay | FR-015…FR-023 | US-3 (P2) | Click an archived card body → read-only overlay → ↺ closes and restores |
| **5 · Profile + Calendar verification** | Profile archived link with count; Calendar exclusion verification test | FR-027, FR-028, FR-024…FR-026 | US-4, US-5 (P2) | Profile link reads `N`; archiving a row removes its activity from Calendar surfaces |
| **6 · Filter / sort / pagination polish** | End-to-end persistence + reset across view switches | FR-029, FR-030 | US-6 (P3) | Filter / sort / paginate within Archived view; persist across switches |
| **7 · Release Prep** *(Amendment 1.3.0, mandatory)* | Version bump, CHANGELOG entry (incl. `fav` behavior change), `docs/REPO_MAP.md`, `docs/deployment.md` for the Supabase migration | (governance) | — | All non-code deliverables landed on the branch before the final test |
| **8 · Browser Smoke Test** *(Amendment 1.1.0, mandatory, ordered AFTER Release Prep)* | Walk every P1/P2 Independent Test in a real browser on desktop + mobile viewports against the to-be-merged state | SC-001…SC-006 | All | Sign-off |

The `/speckit.tasks` command consumes this phase list and produces an ordered, dependency-aware `tasks.md`.
