# Research: Application Timeline (025)

**Branch**: `025-application-timeline`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Decision log for non-obvious choices made while planning the feature.
Each entry: decision, alternatives considered, rationale.

---

## R-1: Persist `timeline` as a JSON column, not a child table

**Decision**: Store `timeline` as a single JSON / JSONB column on the
`applications` row.

**Alternatives**:

- **Child `application_timeline_entries` table** with `application_id`
  FK. Indexed lookups, server-side sort, per-entry update endpoints.
- **Append-only event log table** scoped per user.

**Rationale**:

- The Timeline is always read with its parent application — there is no
  surface that queries entries across applications.
- The existing `skills` / `preferred_skills` / `metadata` JSON-column
  pattern is already a proven precedent in both backends. Reusing it
  costs zero new infrastructure.
- A child table would force a per-entry CRUD API, more SQL, RLS
  policies for the child table on the hosted side, and a refactor of
  the `repos.applications` interface — none of which the feature
  needs.
- The expected size (10s of entries per row, ~120 bytes each) is well
  under any payload threshold that would force normalization.

**Tradeoff accepted**: large pathological rows (hundreds of entries)
inflate the row payload. Acceptable in v1; revisit if real usage shows
rows >50 entries.

---

## R-2: Replace, don't patch, the `timeline` array on PATCH

**Decision**: PATCH `/api/applications/:id` accepts the full `timeline`
array; server replaces it atomically.

**Alternatives**:

- Per-entry endpoints (POST/PUT/DELETE on
  `/api/applications/:id/timeline/:entryId`).
- JSON-Patch operations (`{ op: "add", path: "/timeline/-", value: ... }`).

**Rationale**:

- Mirrors how `skills` / `preferredSkills` already round-trip — same
  mental model, same Zod pattern.
- Eliminates a class of partial-write bugs around concurrent status
  changes + entry edits in the same draft (both ride in one PATCH).
- The Modal's draft+Save model already buffers the whole record;
  serializing just `timeline` separately would duplicate state.

**Tradeoff accepted**: payload size is slightly larger on every
PATCH. Acceptable — payloads are still kilobyte-class.

---

## R-3: Allocate entry `id` client-side

**Decision**: Allocate `id = Math.max(0, ...existingIds) + 1` in the
Timeline component before commit.

**Alternatives**:

- UUIDv4 strings.
- Server-allocated sequential ids returned in the PATCH response.

**Rationale**:

- Strings would be over-engineered for an array that lives inside one
  row; `id`s only need to be unique within the array.
- Server-allocated ids would require splitting the PATCH into
  "validate-then-id-then-write" and a response shape change. Not worth
  it when client allocation is trivially correct under serial writes
  from a single overlay.
- Numeric ids match the existing `application.id` style and play nicely
  with React-style key reconciliation if/when the renderer becomes
  declarative.

**Tradeoff accepted**: two overlapping clients editing the same row
could allocate the same `id`. The product is single-user (constitution:
local-first); even in hosted mode, each user owns their own rows.
Cross-device concurrent edits are a real edge case but extremely rare;
last-write-wins is the existing model.

---

## R-4: Render-time synthesis for legacy rows, not a backfill migration

**Decision**: When `normalizeApplication` sees a row with `timeline ===
[]`, it synthesizes a default array from `applicationDate` /
`lastStatusUpdate` for display. The persisted column stays `[]` until
the user explicitly Saves.

**Alternatives**:

- One-time backfill SQL that materializes synthesized entries into the
  column at migration time.
- Lazy backfill on first read of each row.

**Rationale**:

- Avoids touching production data via a migration; rollback is just
  "remove the column."
- Avoids "is this entry real or auto-generated?" ambiguity in the
  persisted store — entries are real iff the user wrote them.
- Makes the first save authoritative: if the user expands, edits, and
  saves, exactly what they see is what persists. If they never edit,
  no write occurs.
- The synthesis logic is small (~15 lines) and centralized in
  `normalizeApplication`.

**Tradeoff accepted**: every read pays a tiny synthesis cost for legacy
rows. Negligible.

---

## R-5: Inline status picker reuses `STATUS_CONFIG` + existing dropdown CSS, not a new component

**Decision**: The Timeline's inline status picker is a small local
helper inside the Timeline component that builds the same DOM and uses
the same `.status-dropdown`, `.status-option`, `.status-dot` classes
as the global `StatusDropdown`.

**Alternatives**:

- Refactor `StatusDropdown` to accept a "no-transition-guard" option
  and use it directly.
- Build a brand-new picker with its own CSS.

**Rationale**:

- The existing `StatusDropdown.open` calls `getValidTransitions(current)`
  internally — Timeline entries need the full `STATUS_VALUES` list
  (because each entry's status is independent of the row's current
  status and is not constrained by the row's transitions).
  `StatusDropdown.openAll` does pass the full list, but it's reserved
  by `Modal` for the create flow, and the Timeline picker also needs
  to anchor to a different element and close on selection without
  side-effecting the global single-instance dropdown.
- Cleaner to add ~40 lines of helper code in Timeline.js than to make
  the global dropdown more configurable.

**Tradeoff accepted**: code duplication between Timeline.js and
StatusDropdown.js. Mitigated by sharing the CSS class names — visual
consistency is enforced by the stylesheet, not the JS.

---

## R-6: Client-side `lastStatusUpdate` stays untouched; server owns the bump

**Decision**: When the user changes status in the overlay, the client
sets `_draft.status = newStatus` and appends a Timeline auto-entry, but
does NOT bump `_draft.lastStatusUpdate`. The server bumps it inside
`update()`.

**Alternatives**:

- Bump `_draft.lastStatusUpdate = today()` client-side and let the server
  echo it back.
- Have the server return a "what we wrote" patch the client merges in.

**Rationale**:

- The server already owns the bump (see
  [server/db/applications.js:68-70](../../server/db/applications.js#L68-L70)
  and the equivalent in the Supabase adapter). Duplicating it
  client-side risks drift if the rules ever change.
- The next-render result is the same: the server response includes the
  new `lastStatusUpdate`, the Modal's `saveDraft` already copies
  `updated` back into `_draft`, and the displayed value is fresh.

**Tradeoff accepted**: a fast in-flight save shows the old
`lastStatusUpdate` for ~one network roundtrip in the unsaved-state
indicator chip (which lists `lastStatusUpdate` nowhere by design).
Imperceptible.

---

## R-7: No confirmation on entry delete

**Decision**: Single click on the `×` button removes the entry from the
draft immediately, with no confirmation modal.

**Alternatives**:

- Modal confirm ("Delete this entry?").
- Soft delete with an undo toast.

**Rationale**:

- The Modal is in draft state until Save — a mistaken delete is undone
  by Discard. This is the same risk model as a stray text edit.
- A confirm modal interrupts the user's flow during high-frequency
  log editing.
- An undo toast adds UI state machinery (timer, dismiss, action) that
  the rest of the overlay does not have.
- Matches the design doc rationale verbatim
  ([docs/design/application_timeline.md:161](../../docs/design/application_timeline.md#L161)).

**Tradeoff accepted**: a user who clicks delete then immediately closes
with Save loses the entry. Acceptable — Save is an explicit action.

---

## R-8: Future-dated entries are allowed without a separate UI affordance

**Decision**: The Timeline's date input has no `max` attribute. Future
dates render at the top of the list (newest by date) with no special
badge or styling.

**Alternatives**:

- Block future dates entirely (the design doc's original intent;
  overridden by the feature brief).
- Allow future dates but visually tag them as "Scheduled".

**Rationale**:

- The feature brief explicitly enables future dates as the realism
  upgrade.
- Adding a "Scheduled" tag is gilding — the sort order already makes
  them visually prominent (top of the list).
- Less UI to test, fewer paths to maintain.

**Tradeoff accepted**: a user who mistypes a year (`2036` instead of
`2026`) gets an entry that floats to the top until corrected. Cost is
one inline date edit to fix.

---

## R-9: `accepted` status is audit-only, not a feature deliverable

**Decision**: This feature audits all status surfaces and fixes any
missing-`accepted` rendering. It does not (re-)define the status or
its tokens — `STATUS_CONFIG.accepted` already exists in
[src/models/application.js:55-60](../../src/models/application.js#L55-L60).

**Alternatives**:

- Treat `accepted` as a new status with its own spec scope and
  acceptance criteria.
- Defer the audit to a separate feature.

**Rationale**:

- The model already lists the status; the audit work is a small
  walk through ~5 surfaces. Defining it as a separate feature would
  inflate process for what is a one-PR check.
- The Timeline introduces a new status surface (the node accent), so
  the audit naturally pairs with this feature.

**Tradeoff accepted**: tasks phase needs an explicit "audit existing
surfaces" task ordered before the Timeline UI work so any gap is
discovered early, not after the UI lands on top of broken status
rendering.

---

## R-9a: Timeline keeps `expanded` state across `Modal._renderBody()`, resets only on `Modal.close()`

**Decision**: `Timeline.js` keeps a module-level `_expanded` boolean
that survives `Modal._renderBody()` re-instantiation (e.g., after
Save). The Modal's `close()` calls `Timeline.reset()` to flip it back
to `false`, so reopening the overlay still starts collapsed.

**Alternatives**:

- Accept the Save-collapses-Timeline UX and document it.
- Make Save not call `_renderBody()` — just patch the affected fields.
- Store expanded state on the application row.

**Rationale**:

- The user's mental model during a single overlay session is "the
  Timeline I just expanded is still expanded after I Save." Collapsing
  on Save would be a surprise UX regression.
- A module-level boolean costs ~3 lines and survives re-instantiation
  naturally because the JS module persists; the DOM does not.
- Persisting expanded state on the row violates the spec's
  session-local requirement (FR-009).

**Tradeoff accepted**: a module-level boolean is global state. A
second Modal instance (we have only one ever, by design) would share
it. The reset on close keeps the invariant clean.

---

## R-9b: Module-level `Timeline.refresh()`, not a per-instance callback

**Decision**: `Timeline.js` exports `refresh()` and `reset()` as
module-level functions, mirroring the `StatusDropdown` singleton
pattern. The Modal calls `Timeline.refresh(_draft)` after appending
the status-change auto-entry, and `Timeline.reset()` from `close()`.

**Alternatives**:

- Per-instance `rerender` callback returned from `Timeline.render()`.
- Custom event on the host element the Modal subscribes to.

**Rationale**:

- A per-instance callback is destroyed by `Modal._renderBody()`, so
  Modal would need to re-register on every render — fragile.
- Module-level singletons match the existing pattern in
  `StatusDropdown.js`, keeping the codebase consistent.
- One-liner integration in Modal: `Timeline.refresh(_draft)`.

**Tradeoff accepted**: same as R-9a — module-level state is global.
Acceptable because we have at most one Timeline rendered at any moment.

---

## R-10: Reuse the existing `EditableText` pattern from the Modal, do not introduce a primitive

**Decision**: Inline note editing reuses the small click-to-edit
pattern already encoded in `makeInlineText` in
[src/components/Modal.js:258-335](../../src/components/Modal.js#L258-L335).
The Timeline component does its own minimal click-to-edit because
`makeInlineText` is tightly coupled to `_draft` and the Modal's
syncFooter.

**Alternatives**:

- Extract a shared `EditableText` primitive consumed by both the Modal
  and the Timeline.
- Pass `_draft` into the Timeline component so it can call
  `makeInlineText` directly.

**Rationale**:

- An extraction is a separate refactor — useful, but out of scope.
- Coupling the Timeline to the Modal's `_draft` global would
  entrench an existing antipattern; passing data via props /
  onChange callbacks is cleaner.
- The Timeline's edit pattern is small (~30 LOC); duplication cost is
  low.

**Tradeoff accepted**: two slightly different click-to-edit
implementations exist after this feature. The design-doc's *Open
items* section already flags an `EditableText` extraction as a
follow-up; this feature stays focused.

---

## R-11: Modal max-height bump is part of this feature, not deferred

**Decision**: Bump `.modal` `max-height` to `min(860px, calc(100vh -
64px))` in `src/styles/main.css` as part of this feature.

**Alternatives**:

- Defer the height change to a polish feature.
- Use a fixed max-height (e.g., 720px).

**Rationale**:

- A maximally-expanded Timeline (10+ entries) overflows the current
  modal height on a typical laptop viewport, pushing the footer
  offscreen.
- The change is two characters of CSS and ships with the feature that
  causes the need.
- `min(...)` graceful-degrades on short viewports (mobile) to the
  viewport-height bound.

**Tradeoff accepted**: every modal on the app — not just one with a
Timeline — gets the taller cap. Minor positive side effect; existing
content-fits-content modals are unaffected since they sit well under
860px.

---

## R-12: Local SQLite migration uses `ensureColumn`; no version bump in `initSchema`

**Decision**: Add the column via the existing `ensureColumn(targetDb,
'applications', 'timeline', "TEXT NOT NULL DEFAULT '[]'")` helper in
[server/db.js](../../server/db.js).

**Alternatives**:

- Introduce a migrations folder + a schema-version table.
- Drop and recreate the table during dev.

**Rationale**:

- The codebase has standardized on `ensureColumn` for additive
  column changes (`archived`, `location`, `shift`, `work_setup`,
  `compat_notes`, `general_notes`, `preferred_skills` all use it).
- A migrations system is a larger architectural decision that
  doesn't belong in this feature.
- Drop-and-recreate is destructive for local dev DBs that may carry
  real personal data.

**Tradeoff accepted**: schema history lives only in `initSchema`; not
queryable. Acceptable while the schema is short.

---

## R-13a: Canonical RPC source in `docs/db/`, not retroactive spec edits

**Decision**: The `claim_and_seed_starter()` RPC body is owned by a
single canonical Markdown doc at
[docs/db/claim_and_seed_starter.md](../../docs/db/claim_and_seed_starter.md).
Each feature that revises the body updates this file and the version
table inside it. Prior feature specs are NOT retroactively edited;
they remain snapshots of the body as it shipped.

**Alternatives**:

- Edit the previous feature's `data-model.md` in-place every time the
  RPC changes (the original 025 plan).
- Version the RPC body inside the latest feature's spec; older specs
  link forward.
- Move the body to a `.sql` file under `docs/db/`.

**Rationale**:

- Editing prior spec packages from a new feature confuses git history
  and makes "what shipped with which feature" ambiguous.
- A canonical doc gives one stable URL operators can bookmark; spec
  packages link out to it.
- Markdown (not raw SQL) preserves the "docs are human-readable" intent
  of the directory and lets the doc carry version history, a coverage
  table, verification queries, and rollback notes alongside the SQL
  block.
- The rule generalizes — future RPCs / DB-level artifacts can live in
  `docs/db/` under the same convention.

**Tradeoff accepted**: operators reading older feature specs encounter
a "superseded — see canonical doc" pointer instead of the live body.
Mild redirection cost is worth the clarity.

---

## R-13: Hosted Supabase migration via SQL editor, not a code-driven migration tool

**Decision**: Operator pastes the additive `ALTER TABLE ...` block into
the Supabase SQL editor. The quickstart documents the exact text.

**Alternatives**:

- Adopt a Supabase migrations tool (e.g., `supabase db push`).
- Build a node-pg migration runner in the server.

**Rationale**:

- Matches 019's operator workflow exactly — single source of truth in
  the data-model file plus quickstart-driven application.
- Avoids new infra/dependency for a one-column change.
- Boot-time smoke check (extended in this feature) catches an
  un-migrated env at startup.

**Tradeoff accepted**: operators have to remember to run the SQL when
deploying 025 to a 019-only env. Mitigated by the boot smoke check and
the CHANGELOG entry.

---

## R-14: No new env vars, no new feature flags

**Decision**: The feature ships in the "on" state in every runtime
mode immediately on merge. No env var to gate it.

**Alternatives**:

- Gate behind `ALICE_TIMELINE=true` for staged rollout.
- Feature-flag in hosted mode only.

**Rationale**:

- This is a UI replacement of an existing UI cell (Last Updated), not
  an experimental capability. There is no "off" state the user would
  want; removing the *Last Updated* line without delivering Timeline
  would be a regression.
- Aligns with the spec's non-goal of avoiding backwards-compatibility
  shims.

**Tradeoff accepted**: a hosted deploy without the matching DB
migration produces 4xx on `PATCH` until the operator applies the SQL.
Mitigated by the boot-time smoke check.
