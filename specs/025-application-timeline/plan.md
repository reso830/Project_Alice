# Implementation Plan: Application Timeline (025)

**Branch**: `025-application-timeline` | **Date**: 2026-05-21
**Spec**: [spec.md](spec.md)
**Inputs**: [docs/features/025-application-timeline.md](../../docs/features/025-application-timeline.md),
[docs/design/application_timeline.md](../../docs/design/application_timeline.md)
**Depends on**: [019-supabase-persistence](../019-supabase-persistence/spec.md)
(per-request Supabase adapter, `claim_and_seed_starter` RPC),
[015-application-state-machine](../015-application-state-machine/spec.md)
(`TRANSITIONS`, `TERMINAL_STATES`, status guard at the API boundary).

---

## Summary

Add a `timeline: TimelineEntry[]` field to applications and replace the
Application Detail Overlay's *Last Updated* row with an inline, collapsible
Timeline log. Status changes from the overlay's Change-Status control append
a Timeline entry atomically with the existing `status` /
`lastStatusUpdate` writes. Entries are user-editable (text, status, date),
deletable, and may be future-dated. Render-time synthesis fills the
collapsed preview for legacy rows whose persisted `timeline` is empty.

Concretely this introduces:

1. A new shared `TimelineEntry` shape and validation helpers in the model
   layer; existing `validateApplication` / Zod schemas extended to admit
   `timeline`.
2. SQLite migration: additive `timeline TEXT` column (JSON-encoded). Hosted
   Supabase migration: additive `timeline jsonb NOT NULL DEFAULT '[]'`.
   Both migrations are idempotent and reversible.
3. Server adapter changes: `toRow` / `toRecord` in
   [server/db/columns.js](../../server/db/columns.js) gain `timeline`
   handling (JSON encode on write, parse on read). Supabase adapter's
   `JSONB_COLUMNS` list extended.
4. Server-side validation in [server/validation/application.js](../../server/validation/application.js)
   extends the create + update schemas with a Zod `timeline` array schema.
5. A new client-side `Timeline` component
   ([src/components/Timeline.js](../../src/components/Timeline.js))
   rendering the collapsed and expanded states, with inline add /
   edit / status-pick / date-edit / delete, and a small inline status
   picker that reuses `STATUS_CONFIG` and the existing
   `.status-dropdown-backdrop` style.
6. [src/components/Modal.js](../../src/components/Modal.js) changes:
   replace the `statusDateField` slot with a full-width Timeline
   section at row 5 (between the Compatibility pair and
   Responsibilities); on Change-Status, atomically append a new
   Timeline entry; route Discard to revert `timeline` along with the
   rest of the draft.
7. Seed updates: [server/seeds/applicationsData.js](../../server/seeds/applicationsData.js)
   (local SQLite seed, also the source of the demo seed parity assertion),
   [src/data/demoSeed.js](../../src/data/demoSeed.js) (in-browser demo
   fixture), and v2 of the `claim_and_seed_starter` Postgres RPC body
   (canonical source created at
   [docs/db/claim_and_seed_starter.md](../../docs/db/claim_and_seed_starter.md);
   the prior body in
   [specs/019-supabase-persistence/data-model.md §5.4](../019-supabase-persistence/data-model.md)
   is annotated as superseded). The rule introduced here:
   DB-level artifacts (RPCs, migration SQL) are owned by canonical
   docs under `docs/db/`; feature specs link out rather than
   editing prior specs in place.
8. Render-time synthesis in [src/models/application.js](../../src/models/application.js)
   `normalizeApplication`: when a record arrives with an empty
   `timeline`, synthesize a default array from `dateApplied` /
   `lastStatusUpdate` so the collapsed preview never appears empty for
   legacy rows.
9. `accepted` status audit: confirm and (if needed) fix every status
   surface — badge, pill, dropdown, filter, modal header background,
   left-border accent, Timeline node — renders `accepted` using
   the existing `STATUS_CONFIG.accepted` tokens.

The feature does **not** change: the canonical status set (already
includes `accepted`), the `TRANSITIONS` map, the auth model, the
runtime mode set, the API response envelope, or any non-application
table.

---

## Architecture

### Layered view

```
┌─ src/pages/Tracker.js ────────────────────────────────────┐
│  Existing tracker page; passes application to Modal.open. │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│ src/components/Modal.js                                   │
│  • Replaces statusDateField with <Timeline> at row 5      │
│  • Change-Status hook now also appends a timeline entry   │
│  • Save persists `timeline` as part of the draft          │
└──────────────────────┬────────────────────────────────────┘
                       │ owns draft.timeline
┌──────────────────────▼────────────────────────────────────┐
│ src/components/Timeline.js  (NEW)                         │
│  • Module-level singleton (mirrors StatusDropdown.js).    │
│  • Module-level `_expanded` boolean — survives             │
│    Modal._renderBody() so Save doesn't collapse Timeline. │
│  • render(draft, opts) → builds DOM, captures _host.      │
│  • refresh()  → rebuild DOM in _host (used by Modal       │
│    after status-change auto-entry append).                │
│  • reset()    → clear _expanded + _host (called by        │
│    Modal.close()).                                        │
│  • Collapsed preview (latest entry or empty prompt)       │
│  • Expanded list: add-row + entries (newest-first)        │
│  • Inline status picker (scoped reuse of StatusDropdown   │
│    styles via openWithOptions-like local helper)          │
│  • Inline date / text / status edit on each entry         │
│  • Mutates draft.timeline in place; calls onChange()      │
│    so Modal can syncFooter()                              │
└──────────────────────┬────────────────────────────────────┘
                       │ uses
┌──────────────────────▼────────────────────────────────────┐
│ src/models/application.js                                 │
│  • TimelineEntry type (JSDoc)                             │
│  • allocateTimelineEntryId(timeline)                      │
│  • sortTimelineEntries(timeline)                          │
│  • synthesizeTimelineFromDates(record)                    │
│  • normalizeApplication() → fills timeline:[] default and │
│    applies synthesis when persisted array is empty        │
│  • validateApplication() → checks shape per entry         │
└──────────────────────┬────────────────────────────────────┘
                       │ persisted via
┌──────────────────────▼────────────────────────────────────┐
│ src/services/api.js (unchanged signature)                 │
│  • PATCH /api/applications/:id with { timeline: [...] }   │
│  • demo branch: demoStore.update() handles timeline too   │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│ server/routes/applications.js → updateSchema (validation) │
│ → server/repositories/applications.js (dispatch)          │
│   ├── server/db/applications.js  (SQLite path)            │
│   └── server/repositories/supabase/applications.js        │
│       (Hosted path)                                       │
└───────────────────────────────────────────────────────────┘
```

Demo mode flows through [src/data/demoStore.js](../../src/data/demoStore.js):
it already round-trips arbitrary fields via spread merge, so the only
required change is the seed fixture and a small parity assertion (the
existing parity test in [tests/data/demoStore.test.js](../../tests/data/demoStore.test.js)
will cover `timeline` automatically once both seeds carry it).

### Data flow — add a Timeline entry

1. User expands the Timeline → `Timeline` component switches to expanded.
2. User fills date / status / text, presses Enter or clicks **+ Add**.
3. `Timeline` allocates `id = max(existingIds, 0) + 1`, pushes the entry
   onto `draft.timeline`, re-sorts the view by `(date DESC, id DESC)`,
   resets the add-row inputs, and calls the parent `onChange()`.
4. Modal's `onChange()` runs `_syncFooter()` — the unsaved indicator
   appears.
5. User clicks Save → `Modal.saveDraft()` → `api.update(id, _draft)`.
6. The PATCH payload includes `timeline: [...]`. The Zod `updateSchema`
   accepts the array; the route handler delegates to the repository.
7. SQLite repo: `toRow({ timeline: [...] })` → `JSON.stringify(...)` →
   `UPDATE ... SET timeline = @timeline`.
   Supabase repo: `normalizeForPostgres` parses the JSON back into a JS
   array because Postgres jsonb wants the structured value.
8. `toRecord(row)` decodes `timeline` (string or already-parsed) into
   the array shape the client expects.

### Data flow — Change Status (auto-entry)

1. User clicks the header status button or the status badge → `StatusDropdown`
   opens with `getValidTransitions(currentStatus)`.
2. User picks a new status → existing callback:
   - sets `_draft.status = newStatus`
   - re-applies the header background
   - re-renders the badge
3. **New**: same callback also calls a helper
   `appendStatusChangeTimelineEntry(draft, newStatus)` that pushes
   `{ id: nextId, date: today, status: newStatus, text: '' }` onto
   `draft.timeline`. `lastStatusUpdate` is NOT bumped client-side
   because the server still owns that bump (see SQLite/Supabase
   `update()`).
4. The Timeline component, if expanded, re-renders to show the new
   entry at the top. Save persists everything atomically.

### Data flow — Discard

`copyApplication(record)` already deep-copies `skills` and
`preferredSkills` via spread. Extend it once to deep-copy
`timeline` (`timeline: [...(normalized.timeline ?? []).map(e => ({ ...e }))]`).
`_attemptDiscardDraft` then restores the array transparently when it
resets `_draft = copyApplication(_original)`.

### Data flow — Legacy rows (read-time synthesis)

`normalizeApplication(record)` runs on every API response shape
through the existing `copyApplication()` path in the Modal. Extend
`normalizeApplication` so that when `record.timeline` is missing or
an empty array, it returns a synthesized default:

- If `applicationDate` (the existing field; spec calls it `dateApplied`
  in design-doc shorthand — same field) is present:
  prepend `{ id: 1, date: applicationDate, status: 'applied',
  text: 'Submitted application.' }`.
- If `lastStatusUpdate !== applicationDate` AND row `status` is not
  `applied`: append `{ id: 2, date: lastStatusUpdate, status: row.status,
  text: '' }`.

The synthesis is display-only: it's produced by the normalize step
that hydrates a draft. The persisted `timeline` is only overwritten
when the user explicitly Saves, at which point the draft's
(possibly-synthesized-then-edited) array becomes the new authoritative
value. No backend migration mutates rows on read.

---

## Affected Areas

### Files / components to inspect (read-only context)

- [src/pages/Tracker.js](../../src/pages/Tracker.js) — confirms Modal
  open path; no expected changes.
- [src/pages/Calendar.js](../../src/pages/Calendar.js) — confirms it
  does not depend on `lastStatusUpdate` rendering.
- [src/utils/filterSort.js](../../src/utils/filterSort.js) — confirms
  sort uses `lastStatusUpdate`/`createdAt`, not Timeline.
- [src/components/QuickFiltersToolbar.js](../../src/components/QuickFiltersToolbar.js)
  — confirms the status filter chip renders `accepted` (this is part
  of the audit).
- [src/components/Card.js](../../src/components/Card.js) — confirms
  the tracker card renders `accepted` correctly (audit only).
- [shared/constants.js](../../shared/constants.js) — re-exports
  `STATUS_VALUES` etc.; confirms `accepted` is in the shared list.
- [specs/019-supabase-persistence/data-model.md](../019-supabase-persistence/data-model.md)
  — source of truth for the `claim_and_seed_starter` RPC body that
  seeds two starter rows on first hosted login.
- [tests/data/demoStore.test.js](../../tests/data/demoStore.test.js)
  — confirms the seed parity test extends naturally once both seeds
  carry `timeline`.

### Files / components to modify

**Model / shared**
- [src/models/application.js](../../src/models/application.js) — add
  `TimelineEntry` JSDoc, `allocateTimelineEntryId`,
  `sortTimelineEntries`, `synthesizeTimelineFromDates`; extend
  `normalizeApplication` and `validateApplication` to handle
  `timeline`.

**Server (SQLite)**
- [server/db.js](../../server/db.js) — add `ensureColumn(..., 'timeline',
  "TEXT NOT NULL DEFAULT '[]'")` line at the end of `initSchema`.
- [server/db/columns.js](../../server/db/columns.js) — add `timeline`
  to `FIELD_TO_COLUMN`, `INSERTABLE_COLUMNS`, `UPDATABLE_COLUMNS`;
  extend `toRow` to JSON-stringify and `toRecord` to parse via
  `parseJson(..., [])`. Add `APPLICATION_COLUMNS_WITHOUT_USER_ID`
  entry for the Supabase projection.

**Server (Hosted)**
- [server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js)
  — add `'timeline'` to `JSONB_COLUMNS`.

**Validation**
- [server/validation/application.js](../../server/validation/application.js)
  — add a `timeline` Zod schema:
  `z.array(z.object({ id: z.number().int().positive(), date: z.string()
  .regex(datePattern), status: z.string().refine(v => STATUS_VALUES
  .includes(v)), text: z.string() })).optional()`.
  Wire it into `writableFields`.

**Frontend (new)**
- [src/components/Timeline.js](../../src/components/Timeline.js)
  (NEW) — collapsed/expanded UI; inline add/edit/status/delete; uses
  `STATUS_CONFIG` for pills + nodes; reuses `dom.js`
  `createStatusBadge` and date helpers from `utils/date.js`.

**Frontend (modified)**
- [src/components/Modal.js](../../src/components/Modal.js):
  - In `_renderBody`: remove `statusDateField`; insert `Timeline.render(
    draft, { onChange: _syncFooter, currentStatus: _draft.status })`
    in the row-5 slot (full-width, between `compatNotes` row and
    `responsibilities`).
  - In `copyApplication`: deep-copy `timeline`.
  - In `openStatusDropdown`'s callback: after setting `_draft.status`,
    call `appendStatusChangeTimelineEntry(_draft, newStatus)` followed
    by `Timeline.refresh(_draft)` so the new entry appears in any
    currently-expanded list.
  - In `close()`: call `Timeline.reset()` so the next overlay starts
    collapsed (preserves spec FR-009 session-local guarantee).
  - Bump `.modal` `max-height` to `min(860px, calc(100vh - 64px))` in
    `src/styles/main.css`.
- [src/styles/main.css](../../src/styles/main.css) — add the
  Timeline-scoped classes referenced in
  [docs/design/application_timeline.md](../../docs/design/application_timeline.md):
  `.tl-collapsed`, `.tl-chev`, `.tl-header`, `.tl-collapse-btn`,
  `.tl-row`, `.tl-node`, `.tl-node-new`, `.tl-date-text`,
  `.tl-date-input`, `.tl-dash`, `.tl-text-input`, `.tl-text-line`,
  `.tl-add`, `.tl-del`, `.tl-status-pop` plus the mobile reflow
  block.

**Seeds**
- [server/seeds/applicationsData.js](../../server/seeds/applicationsData.js)
  — add a `timeline` field (JSON-stringified array) to every record.
- [src/data/demoSeed.js](../../src/data/demoSeed.js) — mirror the
  `timeline` change on every record; tweak a small subset to showcase
  the required shapes (minimal / dense / empty / future / accepted /
  rejected).
- [specs/019-supabase-persistence/data-model.md §5](../019-supabase-persistence/data-model.md)
  — update the canonical SQL of `claim_and_seed_starter()` so the
  two starter rows include rich Timeline JSONB literals. A short
  follow-up migration ships in this feature's quickstart for operators
  who have already applied 019.

### Tests likely to be added or updated

- **Add**: [tests/components/Timeline.test.js](../../tests/components/Timeline.test.js)
  — render collapsed, render expanded, add entry (Enter + click),
  edit entry, delete entry, inline status pick, future-date allowed,
  empty-state prompt.
- **Add**: [tests/models/timeline.test.js](../../tests/models/timeline.test.js)
  — `sortTimelineEntries` ordering, `allocateTimelineEntryId`,
  `synthesizeTimelineFromDates` for the three legacy-row shapes
  (dateApplied + status change, dateApplied only, neither).
- **Update**: [tests/models/application.test.js](../../tests/models/application.test.js)
  — `normalizeApplication` admits and round-trips `timeline`;
  `validateApplication` flags malformed entries.
- **Update**: [tests/server/validation.test.js](../../tests/server/validation.test.js)
  — `updateSchema` accepts a valid `timeline`; rejects invalid date /
  unknown status / missing id.
- **Update**: [tests/server/repositories/columns.test.js](../../tests/server/repositories/columns.test.js)
  — `toRow` JSON-encodes `timeline`; `toRecord` decodes; round-trip
  preserves entries.
- **Update**: [tests/server/repositories/applications.test.js](../../tests/server/repositories/applications.test.js)
  — SQLite repo round-trips `timeline` through create + update +
  getById + getAll.
- **Update**: [tests/server/repositories/supabase/applications.test.js](../../tests/server/repositories/supabase/applications.test.js)
  — adapter passes `timeline` through `normalizeForPostgres` (array,
  not string) on insert / update; parses back on read.
- **Update**: [tests/server/applications.test.js](../../tests/server/applications.test.js)
  — PATCH with a `timeline` array round-trips end-to-end against the
  local SQLite path.
- **Update**: [tests/components/Modal.test.js](../../tests/components/Modal.test.js)
  — Modal renders Timeline section in row-5 slot (full-width);
  Change-Status callback appends an auto-entry to `draft.timeline`;
  Discard reverts a Timeline edit.
- **Update**: [tests/data/demoStore.test.js](../../tests/data/demoStore.test.js)
  — extend the seed parity assertion to cover `timeline`; assert
  `update` accepts a `timeline` array round-trip.
- **Update**: [tests/seed-data.test.js](../../tests/seed-data.test.js)
  — assert each seeded record carries a valid `timeline` (per
  `validateApplication`).

### Out of scope

- New `accepted` status definition — already present in
  `src/models/application.js` and `STATUS_CONFIG`. Audit only.
- Attachments per entry.
- Timeline in any surface other than the Application Detail Overlay
  (tracker cards, Calendar page, etc.).
- Email-forward parsing, bulk import, CSV import.
- Calendar / email / push integrations.
- Auto entries from favorite, archive, or any non-status action.
- Persisting expanded/collapsed state across overlay opens.
- Changing the `applicationDate` field name or constitution-required
  field set.
- Hosted-only or local-only behavior divergence — the feature must
  work identically across both backends and in demo mode.

---

## Risks and Tradeoffs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Hosted Supabase migration drift** — operators who applied 019 must now also add the `timeline` column and update the `claim_and_seed_starter()` body. | High (any hosted env that pre-dates 025) | Hosted POSTs fail until the migration runs. | Quickstart includes a copy-pasteable additive SQL migration; boot-time schema smoke check from 019 is extended with a `select=timeline&limit=0` probe so a missing column fails fast at boot, not at the first PATCH. |
| **Status mutation now writes two fields atomically (`status` + `timeline`)**. SQLite path is fine (one transaction inside `update`). Supabase path issues two separate writes if we naively split into a status-update then a timeline-update. | Medium | Inconsistent state after a partial network failure — `status` advanced but no log entry. | Always pass `timeline` as part of the same `update()` payload from the client. Server-side `update(id, fields)` already serializes one PATCH per call; the Timeline entry rides in the same JSON body. No server-side splitting. |
| **Legacy rows synthesized → user edits → save**: the first save replaces the synthesized array with whatever the user has. If the user expands and never edits, no write happens — synthesis stays display-only. | Low | None — by design. | Document in plan + data-model. Add a normalize test that asserts synthesized entries do not appear in `toRow()` output unless explicitly written. |
| **`timeline` size growth**. A user with hundreds of entries over years could bloat the JSON column. | Low (today). | API payload per-row grows. | Acceptable — Timeline is per-row, not joined; payload size matches what a CRM would push. No pagination on entries in v1; revisit only if a single row exceeds ~50 entries in real data. |
| **Inline status picker drift from the global `StatusDropdown`**. Adding a second status-picker UI risks diverging styles, ARIA, transitions. | Medium | Inconsistent visual & a11y. | Reuse `STATUS_CONFIG`, `.status-option*` CSS classes, and `STATUS_VALUES` (full list — not `getValidTransitions`, because the entry's status is independent of the row's current status). No new tokens. |
| **Date input localization**. `<input type="date">` UI varies by browser; format is uniform ISO. | Low | Cosmetic in some browsers. | Accept the platform date picker; tests assert ISO output value, not UI chrome. |
| **`accepted` status audit reveals a missing surface**. Discovering a surface mid-implementation expands scope. | Medium | Adds a small task. | Spec FR-035 already lists the surfaces; the plan adds an explicit audit task in the tasks phase that runs *before* the Timeline UI work so any gap is found early. |
| **Modal max-height bump (`min(860px, calc(100vh - 64px))`) regresses other content**. | Low | Footer scroll behavior changes for very tall existing modals. | Manual smoke on small viewports; existing modal tests cover the footer-pin invariant. |
| **`copyApplication` deep-copy cost** when timelines grow large. | Very low | Microseconds. | The map+spread per entry is O(n); acceptable. |

### Tradeoffs accepted

- **No confirmation on entry delete.** Matches the design doc's rationale —
  the modal is a draft until Save, and a stray delete is undone by
  Discard.
- **Auto-entry has empty `text`.** The user can fill it inline. The
  alternative — auto-generating a sentence — would require copy that
  rots and i18n that we don't have.
- **No `applicationDate` → `dateApplied` rename.** The design doc uses
  `dateApplied` informally; the codebase uses `applicationDate`. We
  read from the existing field name; renaming is out of scope.
- **`accepted` flows through normal status surfaces** — no special
  affordance. Matches the existing `offer`/`rejected` treatment.

---

## Validation Approach

### Automated (CI gate)

1. **Model unit tests** — `tests/models/timeline.test.js` covers
   sort, id allocation, and synthesis edge cases.
2. **Validation unit tests** — `tests/server/validation.test.js`
   covers the Zod schema (valid, missing id, bad date, unknown
   status).
3. **Columns round-trip** — `tests/server/repositories/columns.test.js`
   asserts `toRow`/`toRecord` preserve `timeline` byte-for-byte.
4. **Repository round-trips** — both SQLite and Supabase adapter
   tests cover create + getById + update + getAll with `timeline`
   populated.
5. **Route integration** — `tests/server/applications.test.js`
   PATCHes a `timeline` array and asserts the GET response matches.
6. **Modal interaction** — `tests/components/Modal.test.js`
   asserts: (a) Timeline is rendered, (b) Change-Status appends an
   auto-entry, (c) Discard reverts a Timeline mutation.
7. **Timeline component** — `tests/components/Timeline.test.js`
   covers expand/collapse, add, edit, delete, future date allowed,
   inline status pick, empty prompt.
8. **Seed parity** — `tests/data/demoStore.test.js` extended seed
   parity assertion fails if local SQLite seed and demo seed
   `timeline` arrays diverge.
9. **Seed shape** — `tests/seed-data.test.js` asserts every seeded
   record validates.

### Manual (in the Browser Smoke Test phase)

Walk each User Story's Independent Test in a real browser against
the to-be-merged state, per the constitution (Amendment 1.3.0):

- US1 collapsed preview (rich / single / empty / synthesized).
- US2 add an entry inline (today + past + future); Discard.
- US3 Change Status → auto-entry appears; deleting auto-entry
  preserves the status change.
- US4 edit text / status / date on an existing entry; verify re-sort
  on date change.
- US5 schedule a future-dated entry; reload; entry remains.
- US6 delete an entry; Discard restores; Save persists.
- US7 demo / local seed / hosted starter rich timelines render.
- `accepted` status audit walk: badges, pills, dropdowns, filters,
  modal header background, left-border accent, Timeline node.
- Keyboard-only pass: Tab traversal, Enter to expand/commit, Esc to
  revert, no mouse.
- Mobile bottom-sheet pass at <640px: entry rows reflow, delete
  always visible, no horizontal overflow.

### Quality gates (per constitution v1.4.0)

- Lint + format pass.
- Test suite green (Vitest).
- Release Prep phase: version bump, CHANGELOG entry,
  [docs/REPO_MAP.md](../../docs/REPO_MAP.md) updated for the new
  `src/components/Timeline.js` and `tests/models/timeline.test.js`
  files, [docs/deployment.md](../../docs/deployment.md) appended
  with the hosted `timeline` migration SQL.
- Browser Smoke Test phase: ordered last; exercises the merge state
  in a real browser.
- Plan-review checklist (this directory's `checklists/plan-review.md`)
  passes before tasks generation.

---

## Technical Context

**Language/Version**: Node.js ≥ 20.19.0, JavaScript (ESM), no TypeScript.
**Primary Dependencies**: Existing only — Express 4, Vite 8, Vitest 4,
Zod 4, better-sqlite3, `@supabase/supabase-js`. No new runtime
dependencies. No new dev dependencies.
**Storage**:
- SQLite: existing `applications` table gains a `timeline TEXT NOT
  NULL DEFAULT '[]'` column. Idempotent migration via the existing
  `ensureColumn()` helper in [server/db.js](../../server/db.js).
- Supabase Postgres: `applications` table gains a `timeline jsonb NOT
  NULL DEFAULT '[]'::jsonb` column. Operator runs the additive SQL
  block in [quickstart.md](quickstart.md). `claim_and_seed_starter()`
  is replaced with an updated body that writes the same starter
  rows plus their Timeline entries.
**Frontend storage**: Demo mode is in-memory only; no
`localStorage` writes for Timeline.
**Testing**: Vitest with the same browser-environment fakes used
elsewhere (`@vitest/browser` not required; JSDOM is sufficient for
Timeline component tests because it relies on standard DOM APIs).
**Target Platform**: Browsers (desktop + mobile, evergreen);
Node.js server (local + Vercel).
**Project Type**: Web application — Vite SPA frontend + Express
API; this feature touches both halves.
**Constraints**:
- Local-first; no analytics; no third-party calls (constitution).
- Required application fields unchanged: `companyName`, `jobTitle`,
  `status`, `lastStatusUpdate`, `responsibilities`.
- API response envelope `{ data, error }` unchanged.
- Status set unchanged; `accepted` is already a member.

---

## Constitution Compliance

| Constitution rule | Compliance |
|---|---|
| Required fields preserved | Yes — `lastStatusUpdate` stays stored & bumped; no field removed. |
| Simple, readable code | Yes — one new component, one new model helper file's worth of code, additive schema. |
| Centralized validation | Yes — Zod schema in `server/validation/application.js`; client mirrors in `validateApplication`. |
| No new dependencies w/o justification | Yes — no new deps. |
| Local-first | Yes — Timeline lives on the row in the user's local DB or their Supabase row. |
| Validation before save | Yes — Zod rejects malformed `timeline`. |
| URL / date validation | Yes — date schema enforces YYYY-MM-DD. |
| No silent corruption | Yes — schema rejection returns `VALIDATION_ERROR`. |
| Operations: add, edit, search, filter, review | Add/edit/review preserved; search and filter unaffected (Timeline is per-row content, not a filterable axis in v1). |
| Status, company, role, date primary | Preserved — Timeline supplements, doesn't replace. |
| Stale apps / pending follow-ups | Future-dated entries support pending-follow-up visibility in the collapsed preview (newest by date). |
| Empty / loading / error states | Empty state explicit ("No entries yet — click to add"); load state inherits from Modal; error state via existing Toast. |
| Desktop + mobile | Yes — stacked mobile reflow defined. |
| Labeled forms, keyboard, non-color status | Yes — labels + visible focus + status labels in pills. |
| Tests for status transitions, required fields, URL, dates | Existing tests preserved; new tests cover Timeline shape. |
| Mandatory Release Prep (penultimate phase) | Plan calls it out in the validation section; tasks phase will include it. |
| Mandatory Browser Smoke Test (final phase, UI features) | Plan calls it out; tasks phase will include it. |

---

## Open questions

None. The four spec-time clarifications (inline date edits allowed;
legacy rows auto-synthesize; `accepted` is audit-only; modal layout
follows design doc) are encoded in this plan's *Architecture* and
*Affected Areas* sections.
