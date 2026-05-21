# Feature Specification: Application Timeline

**Feature Branch**: `025-application-timeline`
**Created**: 2026-05-21
**Status**: Draft
**Input**: [`docs/features/025-application-timeline.md`](../../docs/features/025-application-timeline.md), [`docs/design/application_timeline.md`](../../docs/design/application_timeline.md)

---

## Problem Statement

Today the Application Detail Overlay surfaces a single static **Last Updated**
field. That value tells the user *when* the row last moved, but not *what
happened*, *who said it*, or *what's next*. There is no place to log a
recruiter call, capture an interview note, or schedule a follow-up. Users who
want a CRM-style history are forced to put it into the free-form `notes` field,
which is unstructured and quickly becomes a wall of text.

This feature replaces the static *Last Updated* line with an editable
**Timeline** — a chronological log of `{ date, status, text }` entries owned
by the application. Status changes from the existing Change-Status action are
appended automatically; users can also add, edit, re-status, and delete
entries inline (including future-dated reminders). The result is a
realistic progression record for each application without leaving the overlay
and without growing the existing field set.

The feature also aligns demo data, the local seed, and the hosted starter
applications so the Timeline is immediately legible to first-time users, and
audits existing status surfaces to confirm the previously-added `accepted`
status renders correctly everywhere — including the new Timeline nodes.

---

## Scope

- Add a full-width **Timeline** section to the Application Detail Overlay,
  positioned in the row currently occupied by the *Last Updated* / blank pair.
- Replace the static *Last Updated* UI line with the Timeline; keep
  `lastStatusUpdate` as a stored field (constitution-required) bumped on every
  status change but no longer rendered verbatim in the overlay.
- Persist a new `timeline: TimelineEntry[]` array on the application record
  across both runtime modes (local SQLite, hosted Supabase).
- Support collapsed (single-line preview) and expanded (inline add row + full
  history) states, session-local — collapsed on every modal open.
- Support inline add, inline note editing, inline status re-classification,
  inline date editing, and inline delete on entries.
- Allow past-dated and future-dated entries (retroactive logging and scheduled
  reminders).
- Append a Timeline entry automatically whenever the application's `status`
  changes via the Change Status control, using today's date and an empty
  note; the auto-entry is fully editable and deletable like any other.
- Auto-synthesize a default Timeline for applications loaded with no
  `timeline` array (existing rows pre-dating this feature) so the collapsed
  preview is never empty.
- Update seeded fixtures so users see Timeline immediately:
  - `server/seeds/applicationsData.js` (local SQLite seed) gets realistic,
    varied timelines per application.
  - `src/data/demoSeed.js` (in-browser demo mode) gets varied timelines
    spanning minimal / dense / empty / future-dated / accepted / rejected
    patterns.
  - `server/auth/seedHostedUser.js` (the two starter applications dropped
    onto every new hosted user, per feature 019) gets rich timelines that
    teach the Timeline workflow — auto status entry, manual note,
    scheduled follow-up, inline note edit.
- Audit every existing surface that renders a status (badges, pills,
  dropdowns, filters, modal header background, left-border accent) and fix
  any gap where `accepted` does not render correctly. The status itself
  already exists in `src/models/application.js`; this is verification work,
  not new-status work.
- Provide keyboard parity: expand/collapse, commit-on-Enter, revert-on-Esc,
  visible focus rings, button semantics.
- Mobile (bottom-sheet) layout: stacked entry rows, always-visible delete,
  no horizontal overflow.

## Non-Goals

- Attachments per entry (files, screenshots, link previews).
- Bulk import (paste-multiple, email-forward parsing).
- Calendar/email/external-notification integrations or reminders.
- Auto-generated entries from non-status actions (favorite toggle, archive).
- Timeline analytics, reporting, or aggregation views.
- A separate Timeline visualization outside the application overlay.
- Migrating, mutating, or back-filling `lastStatusUpdate` semantics beyond
  hiding the read-only display.
- Multi-user collaborative editing of a single application's Timeline.
- Persisting expanded/collapsed state across overlay opens or across
  sessions.
- Adding any *new* canonical status. The `accepted` status already exists;
  this feature only verifies its presentation.

---

## User Behavior

### User Story 1 — See an application's history at a glance (Priority: P1)

A user opens any application from the tracker. In the overlay's Timeline row
they see the most recent activity — date, status, and a short note —
formatted as a single line. If the application has no Timeline yet, the row
shows *"No entries yet — click to add"*.

**Why this priority**: This is the entire reason the Timeline replaces *Last
Updated*. Without the collapsed preview, the feature has no visible value
until expanded.

**Independent Test**: Open three seeded applications with different timeline
states (rich history, single-entry, empty). Each modal's Timeline row
displays the latest entry (or empty prompt) without any further interaction.

**Acceptance Scenarios**:

1. **Given** an application whose Timeline contains entries on Apr 18, Apr
   21, and Apr 22, **When** the user opens its overlay, **Then** the
   collapsed Timeline row reads `Apr 22 — [<latest status>] <latest note>`
   (single line, ellipsis on overflow).
2. **Given** an application whose Timeline is empty, **When** the user opens
   its overlay, **Then** the collapsed Timeline row reads
   *"No entries yet — click to add"* in the empty-state style.
3. **Given** an application loaded with no `timeline` field at all (legacy
   row), **When** the user opens its overlay, **Then** a synthesized
   default entry derived from `dateApplied` and/or `lastStatusUpdate`
   appears as if it were authored — and the overlay never shows
   *"No entries yet"* unless both source dates were also absent.

---

### User Story 2 — Log a new event on a Timeline (Priority: P1)

A user expanding the Timeline sees an inline add-entry row pinned to the
top. The user picks a date (defaulting to today), picks a status
(defaulting to the application's current status), optionally types a note,
and commits with `Enter` or the **+ Add** button. The entry appears
immediately at the top of the history. Focus returns to the text input so
the user can log a second entry without re-clicking.

**Why this priority**: Logging activity is the primary write path of the
feature. Without it, the Timeline is read-only.

**Independent Test**: Expand the Timeline of any application; add an entry
with today's date, an entry with a past date, and an entry with a future
date; verify all three appear in correct (newest-first) order and save
when the overlay's Save action is invoked.

**Acceptance Scenarios**:

1. **Given** an expanded Timeline with the add-entry row focused, **When**
   the user types a note and presses `Enter`, **Then** the entry is
   committed to the draft, the inputs reset (date → today, status → row's
   current status, note → empty), and focus returns to the note input.
2. **Given** the add-entry row with the date field cleared, **When** the
   user tries to commit, **Then** the **+ Add** button is disabled and
   `Enter` does not commit.
3. **Given** the user enters a future date (e.g., one month ahead), **When**
   they commit, **Then** the entry is accepted and appears at the top of
   the history. Future dates are not blocked.
4. **Given** the user commits an entry, then clicks Discard on the overlay,
   **When** the overlay closes, **Then** the new entry is not persisted —
   the row reverts to its pre-edit state.

---

### User Story 3 — Status changes auto-log to the Timeline (Priority: P1)

When the user changes status via the Change Status control in the overlay
header, the application updates as it does today, and a new Timeline entry
is appended automatically with today's date, the new status, and an empty
note. The entry behaves like any user-authored entry — editable, deletable,
re-statusable.

**Why this priority**: Without auto-entries, status history is invisible
to users who don't manually log. This is what makes the Timeline a
historical audit trail rather than a memo pad.

**Independent Test**: Open an application, change status from *Applied* to
*Interview*, save, reopen — the Timeline shows the new auto-entry at the
top with today's date and the *Interview* status pill. Delete the entry,
save, reopen — the entry is gone but the application's status is still
*Interview*.

**Acceptance Scenarios**:

1. **Given** an application in *Applied*, **When** the user changes its
   status to *Interview* and saves, **Then** the persisted Timeline
   contains a new entry `{ date: today, status: 'interview', text: '' }`
   at the top, AND `lastStatusUpdate` equals today.
2. **Given** an auto-appended entry in the draft, **When** the user clicks
   the entry's note area and types text, **Then** the entry's `text` is
   updated in the draft (committed on blur or `Enter`).
3. **Given** an auto-appended entry, **When** the user deletes it before
   saving, **Then** the entry is removed from the draft, BUT the
   application's `status` and `lastStatusUpdate` stay at their new values.

---

### User Story 4 — Revise an existing entry (Priority: P2)

A user notices an old entry's status was wrong, the date was off by a day,
or the note needs more detail. They click the status pill (re-classifies),
click the date (re-dates), or click the note text (re-types). Each control
commits on blur or `Enter` and reverts on `Esc`. Sorting recomputes
immediately when a date changes.

**Why this priority**: Inline correction is high-value but the feature
delivers value (read history + add new entries) without it. P2.

**Independent Test**: For each existing entry on an application, change
the status, change the date, change the note text. Verify each change
sticks after Save and that re-dated entries re-sort to the correct
position.

**Acceptance Scenarios**:

1. **Given** an entry dated Apr 22 with status *Interview*, **When** the
   user clicks its status pill and selects *Offer*, **Then** the entry's
   `status` updates to `offer` in the draft and its pill re-styles.
2. **Given** an entry dated Apr 22, **When** the user edits the date to
   Apr 19, **Then** the entry re-sorts to its new chronological position.
3. **Given** the user is editing a note and presses `Esc`, **When** focus
   leaves, **Then** the note reverts to its pre-edit value.

---

### User Story 5 — Schedule a future follow-up (Priority: P2)

A user wants a Timeline reminder for a future event ("Recruiter callback
Friday"). They add a Timeline entry with a future date and a descriptive
note. The entry appears at the top of the Timeline (newest-first sort by
date) and persists across reloads.

**Why this priority**: This is the realism upgrade the brief calls out.
The Timeline already supports it once future dates are not blocked, but it
needs explicit acceptance criteria because the design draft initially
forbade it.

**Independent Test**: Add a future-dated Timeline entry; reload the app;
the entry appears at the top of the Timeline.

**Acceptance Scenarios**:

1. **Given** today is 2026-05-21, **When** the user adds an entry dated
   2026-05-28 with text *"Recruiter call"*, **Then** the entry is saved and
   sorts ahead of any entries dated on or before 2026-05-21.
2. **Given** a future-dated entry exists, **When** the user opens the
   overlay, **Then** the collapsed Timeline preview shows that future
   entry (because newest-by-date sort).

---

### User Story 6 — Delete an entry (Priority: P2)

A user removes a Timeline entry inline by clicking its `×` control. The
entry disappears from the draft immediately, no confirmation. Discarding
the overlay restores the deleted entry; saving persists the deletion.

**Why this priority**: Required for clean correction of mistaken entries
and rejection of auto-appended entries the user doesn't want.

**Independent Test**: Delete one entry, save, reopen — entry is gone.
Delete another entry, discard — entry returns.

**Acceptance Scenarios**:

1. **Given** an expanded Timeline with multiple entries, **When** the user
   clicks the `×` on one entry, **Then** that entry is removed from the
   draft immediately with no confirmation prompt.
2. **Given** the user has deleted an entry and not yet saved, **When**
   they click Discard, **Then** the entry is restored.

---

### User Story 7 — Seeded data showcases the Timeline (Priority: P3)

A user encountering the app for the first time — via the local SQLite
seed, the in-browser demo, or as a freshly-signed-up hosted user — sees
Timeline examples that immediately teach the feature.

**Why this priority**: Critical for onboarding and the portfolio demo, but
strictly additive over the core feature. Ship after the core lands.

**Independent Test**:

- Run a fresh local `npm run dev` against a clean DB; verify the seeded
  applications show varied, realistic Timelines (auto status entries,
  manual notes, future follow-ups).
- Open the welcome page's demo; verify the seeded demo applications
  include at least one minimal Timeline, one dense Timeline, one empty
  Timeline, one future-dated follow-up, and one accepted-status entry.
- Sign up a fresh hosted user; verify the two starter applications
  include rich Timeline histories that demonstrate auto-progression,
  manual notes, and scheduled follow-ups.

**Acceptance Scenarios**:

1. **Given** a freshly-seeded local DB, **When** the user opens any
   seeded application, **Then** its Timeline is non-empty and the
   collapsed preview shows a real entry.
2. **Given** the demo mode is entered, **When** the user opens each
   seeded demo application, **Then** the collection covers minimal,
   dense, empty, future-dated, accepted, and rejected Timeline shapes.
3. **Given** a brand-new hosted user has just signed up, **When** they
   open either of the two starter applications, **Then** the Timeline
   contains multiple entries demonstrating auto-status progression,
   manual notes, and a scheduled follow-up.

---

### Edge Cases

- **Same-day entries**: two entries with identical `date` sort by
  insertion order with newest-inserted on top (tiebreak by entry `id`
  descending).
- **Future-dated entries**: allowed; sort to the top by date. No "future"
  badge is required for v1.
- **Empty note**: rendered as the empty-state placeholder text from the
  shared `EditableText` primitive; entries remain valid with empty
  `text`.
- **Auto-entry deletion does not roll back status**: the user can delete
  the auto-generated entry produced by a status change; the application's
  `status` and `lastStatusUpdate` are unaffected by that deletion.
- **Status change while expanded**: when the user changes status from the
  modal header `⇄` dropdown while the Timeline is expanded, the new
  auto-entry appears at the top of the visible list immediately.
- **Discard while expanded**: closing via Discard reverts the entire
  `timeline` array (and `status` / `lastStatusUpdate`) to the row's
  pre-edit state.
- **Mobile delete affordance**: on touch devices the `×` button stays
  visible (no hover state); accessible directly without long-press.
- **Legacy rows**: a row loaded with no `timeline` field gets a
  synthesized default at render time (see *Data Considerations*). The
  synthesis runs once per load; persisted writes after that point use the
  user-edited array exclusively.
- **Sort recompute after date edit**: editing an entry's date triggers a
  re-sort of the displayed list before the next interaction.
- **Saving from a different overlay state**: the persistence boundary is
  Save; expand/collapse and unsaved adds/edits never persist on their own.
- **Concurrent overlay close**: if the user closes the overlay via `Esc`
  with unsaved Timeline edits, the existing overlay's unsaved-changes
  handling applies (same path as any other unsaved-field discard).

---

## Requirements

### Functional Requirements

**Data**

- **FR-001**: Each application MUST gain a `timeline: TimelineEntry[]`
  field where `TimelineEntry = { id: number, date: string (YYYY-MM-DD),
  status: StatusKey, text: string }`.
- **FR-002**: `timeline` MUST persist in both runtime backends (local
  SQLite via better-sqlite3 and hosted Supabase) with no data loss across
  CRUD round-trips.
- **FR-003**: `timeline` entries' `status` MUST be a value from the
  canonical `STATUS_VALUES` set defined in `src/models/application.js`.
- **FR-004**: `timeline` entries' `date` MUST be a valid ISO calendar
  date (`YYYY-MM-DD`). Invalid or missing dates MUST be rejected at the
  validation layer with a user-facing error.
- **FR-005**: `timeline` entries' `id` MUST be unique within the
  application's timeline array and stable across saves so React keys and
  edit/delete operations remain valid.
- **FR-006**: `lastStatusUpdate` MUST remain a stored, required field
  bumped on every status change. The constitution's required-field set is
  unchanged.
- **FR-007**: Applications loaded with no `timeline` field MUST be
  rendered with a synthesized default array (one or two entries derived
  from `dateApplied` and `lastStatusUpdate`); the synthesized entries are
  display-only until the user explicitly saves an edit, after which the
  written `timeline` becomes authoritative.

**UI — Collapsed Timeline**

- **FR-008**: The Application Detail Overlay MUST render a full-width
  Timeline section in place of the previous *Last Updated* row, at row 5
  of the modal body grid (between Compatibility/Compatibility Notes and
  Responsibilities). The existing 2-column Compatibility +
  Compatibility Notes pair on row 4 is preserved.
- **FR-009**: The Timeline section MUST open collapsed on every overlay
  open. Expanded state MUST NOT persist across modal closes or sessions.
- **FR-010**: The collapsed state MUST render a single-line preview of
  the latest Timeline entry (newest by date, then by `id`) showing date,
  status pill, and note text (ellipsis on overflow).
- **FR-011**: When `timeline` is empty after synthesis (no `dateApplied`
  and no `lastStatusUpdate` either), the collapsed state MUST render the
  empty-state prompt *"No entries yet — click to add"*.

**UI — Expanded Timeline**

- **FR-012**: Clicking the collapsed row, the chevron, or pressing
  `Enter` / `Space` with the row focused MUST expand the Timeline.
- **FR-013**: The expanded Timeline MUST render an inline add-entry row
  (date input, status picker, text input, **+ Add** button) pinned above
  the entry history.
- **FR-014**: The add-entry row's date input MUST default to today, MUST
  accept past and future dates without restriction, and MUST disable the
  **+ Add** button when no date is set.
- **FR-015**: The add-entry row's status picker MUST default to the
  application's current `status`.
- **FR-016**: Pressing `Enter` while focused inside the add-entry's text
  input MUST commit the entry (same as clicking **+ Add**).
- **FR-017**: After commit, the add-entry row MUST reset (date → today,
  status → row's current status, text → empty) and refocus the text
  input.

**UI — Entry editing**

- **FR-018**: Each existing entry MUST allow inline editing of:
  - its note text (via the shared `EditableText` primitive)
  - its status (via an inline status picker scoped to the Timeline)
  - its date (via the same date input affordance used in the add row)
- **FR-019**: Inline note editing MUST commit on blur or `Enter` and
  revert on `Esc`.
- **FR-020**: Inline status changes MUST commit on selection and close
  the picker.
- **FR-021**: Inline date changes MUST commit on blur and MUST trigger a
  re-sort of the displayed entry list.
- **FR-022**: Each entry MUST expose an inline `×` delete control that
  removes the entry from the draft on a single click, with no
  confirmation dialog. On desktop the control is hover-revealed; on
  mobile it is always visible.

**Automatic entries**

- **FR-023**: A status change initiated from the overlay's Change-Status
  control MUST atomically (a) update `draft.status`, (b) set
  `draft.lastStatusUpdate` to today, and (c) append a new entry
  `{ date: today, status: newStatus, text: '' }` to `draft.timeline`.
- **FR-024**: Auto-appended entries MUST be editable and deletable by
  the user identically to manually-added entries. Deleting the
  auto-entry MUST NOT roll back the `status` change.

**Sorting**

- **FR-025**: Entries MUST be rendered with `date` descending, then `id`
  descending as the tiebreaker.

**Persistence boundary**

- **FR-026**: All Timeline mutations (add, edit, status change, date
  change, delete) MUST stage to the overlay's draft and persist only on
  Save. Discard MUST revert the entire `timeline` array to the row's
  pre-edit state.

**Mobile**

- **FR-027**: Below the existing mobile breakpoint the entry rows MUST
  reflow to a stacked layout (node + date + delete on top, status pill
  on the second row, text spanning the third row) without horizontal
  overflow.
- **FR-028**: The mobile delete control MUST be always visible
  (no hover affordance).

**Accessibility**

- **FR-029**: The collapsed Timeline row MUST be keyboard-focusable with
  `role="button"` and `tabIndex={0}`, and MUST expand on `Enter` or
  `Space`.
- **FR-030**: All interactive Timeline controls (add row inputs, status
  pills, note text, delete buttons, **+ Add**) MUST be reachable via
  `Tab` / `Shift+Tab` and MUST display a visible focus ring.
- **FR-031**: Status MUST be communicated by both color and label (the
  badge text label, not color alone) in every Timeline surface.

**Seeded data**

- **FR-032**: `server/seeds/applicationsData.js` MUST be updated so every
  seeded application carries a realistic Timeline covering at least
  applied, recruiter outreach, interview/assessment, and at least one
  follow-up or future-scheduled entry across the seed set as a whole.
- **FR-033**: `src/data/demoSeed.js` MUST be updated so the demo
  applications collectively showcase Timelines that are minimal, dense,
  empty, future-scheduled, accepted, and rejected (at least one of each
  shape across the set).
- **FR-034**: `server/auth/seedHostedUser.js`'s two starter applications
  MUST each carry a rich Timeline demonstrating: an auto status entry, a
  manually-edited note, and a future-dated follow-up.

**Status System audit**

- **FR-035**: Every existing status surface (status badge, status pill,
  status dropdown, status filter, modal header background, left-border
  accent, demo legend if any) MUST render the `accepted` status using
  the values already in `STATUS_CONFIG.accepted`
  (`#2EC4B6` / `#212529`). Any missing surface MUST be fixed.
- **FR-036**: Timeline nodes MUST render the per-entry status'
  `borderAccent` color, including for `accepted` entries.

**Validation**

- **FR-037**: Saving an application with an invalid timeline (missing
  `id`, non-ISO `date`, unknown `status`) MUST be rejected with a
  user-facing error and MUST NOT corrupt the existing persisted
  `timeline`.

**Local-first**

- **FR-038**: Timeline data MUST flow through the existing local-first
  data path; no external analytics, tracking, or third-party services
  MUST be introduced.

### Key Entities

- **Timeline Entry**: An immutable-ish log line on an application —
  `{ id, date, status, text }`. Owned by exactly one application;
  unordered on disk; sorted at render time. Identity is the local `id`,
  unique within the application's `timeline` array.
- **Application**: Existing entity. Gains the `timeline` field. All
  other constitution-required fields (`companyName`, `jobTitle`,
  `status`, `lastStatusUpdate`, `responsibilities`) are unchanged.

---

## Data Considerations

**Schema migration (both backends)**

- Local SQLite: a migration MUST add a `timeline` column (TEXT, JSON-
  encoded array). Existing rows get an empty JSON array (`[]`) at
  migration time. The render-time synthesis described in FR-007 then
  fills the collapsed preview for those rows from `dateApplied` /
  `lastStatusUpdate` until the user saves a real edit.
- Hosted Supabase: an additive migration adds a `timeline` JSONB column
  defaulting to `'[]'::jsonb`. Same synthesis logic applies on read.
- Migrations MUST be reversible (drop column) and MUST NOT alter
  existing required-field semantics.

**Synthesis rules for empty timelines (read-time only)**

1. If `dateApplied` is present, prepend
   `{ id: <synthetic>, date: dateApplied, status: 'applied',
   text: 'Submitted application.' }`.
2. If `lastStatusUpdate` differs from `dateApplied` AND the current row
   `status` is not `applied`, append
   `{ id: <synthetic>, date: lastStatusUpdate, status: row.status,
   text: '' }`.

Synthesis runs only when reading a row whose persisted `timeline` is
empty AND the row has not been written-through since this feature
shipped. The first save replaces the synthesized array with whatever
the user has in the draft.

**Sort & display**

- Sort key: `(date DESC, id DESC)`. Stable for same-day entries because
  monotonic `id` allocation is required by FR-005.

**Identity allocation**

- New entry `id`s are generated client-side as
  `Math.max(...existingIds, 0) + 1` at commit time within the draft, so
  numeric IDs stay locally unique without needing a backend round-trip.
  Backends MUST accept and preserve whatever numeric IDs the client
  writes.

**Validation surface**

- Existing `validateApplication` MUST be extended (or a sibling helper
  added) to validate `timeline` shape on save. Validation
  responsibilities (per the constitution): array-of-objects with `id`,
  ISO `date`, known `status`, string `text`.

**No data loss path**

- Discard reverts `timeline` to the row's pre-edit array.
- Save persists the entire `timeline` array atomically with the rest of
  the application draft. Partial-write states are not allowed.

**Privacy / local-first**

- Timeline content is private application data. It stays in the user's
  local DB or in their Supabase row; no third-party services are added.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of seeded applications across local, demo, and hosted-
  starter datasets render a non-empty collapsed Timeline immediately on
  first overlay open (verified against the three seed files).
- **SC-002**: A user can log a Timeline entry — open overlay, expand,
  type, commit, save, close — in fewer than 5 interactive steps and
  without leaving the overlay.
- **SC-003**: Every status change initiated from the overlay produces
  exactly one new Timeline entry on save (verified by an automated test
  asserting the count diff before/after a status change).
- **SC-004**: All entry mutations (add, edit text, edit status, edit
  date, delete) round-trip through Save and reload without data loss for
  both runtime modes (verified by integration tests against SQLite and a
  Supabase test project, or a mocked equivalent).
- **SC-005**: 0 regressions in the status system — every status,
  including `accepted`, renders correctly across badge, pill, dropdown,
  filter, modal header background, left-border accent, and Timeline
  node (verified by a screenshot or DOM-assertion test sweep).
- **SC-006**: Timeline interactions (expand, collapse, commit-on-Enter,
  revert-on-Esc, delete, status pick, date edit, note edit) are fully
  keyboard-operable with no mouse (verified by a keyboard-only walk in
  the browser smoke test).
- **SC-007**: The Application Detail Overlay's vertical sizing stays
  within `min(860px, calc(100vh - 64px))` — a maximally-expanded
  Timeline scrolls inside the modal body without pushing the footer
  offscreen on a standard desktop viewport (verified manually in the
  smoke test).

---

## Assumptions

- The `accepted` status is already in the model (verified:
  `src/models/application.js` defines it with `#2EC4B6` /
  `#212529`). This feature audits surfaces but does not redefine the
  status.
- The shared `EditableText` primitive used elsewhere in the overlay is
  reusable for inline note editing without modification. If it needs an
  extension, that is captured during the planning phase, not here.
- The inline status picker is a scoped reuse of the existing Status
  Dropdown component; no new picker pattern is introduced.
- The Change Status action in the overlay header continues to exist
  and continues to mutate `status` + `lastStatusUpdate`. This feature
  hooks an additional atomic write into that same code path.
- Hosted users continue to be seeded with the same two starter
  applications from feature 019; the only change here is enriching
  their content with Timeline entries.
- The constitution's required-field set is unchanged (company, title,
  status, `lastStatusUpdate`, responsibilities). `lastStatusUpdate`
  stays stored and bumped — only its dedicated UI line is removed.
- Saving and discarding semantics for the overlay are unchanged for
  every other field; Timeline simply joins the same draft.
- Local SQLite is the primary local backend (better-sqlite3); the
  hosted backend is Supabase; no third backend is assumed.

---

## Open Questions

None blocking — the four clarifications captured during spec drafting
are resolved:

- Inline date editing on existing entries: **allowed** (FR-018, FR-021).
- Legacy rows with no `timeline`: **auto-synthesized at read time**
  (FR-007, *Data Considerations*).
- `accepted` status: **audit existing surfaces, fix only gaps**
  (FR-035).
- Modal layout: **design doc layout governs** — full-width Timeline
  at row 5; Compatibility + Compatibility Notes stay paired on row 4
  (FR-008).

Items flagged in the design doc as *Open / Pending* but explicitly
**out of scope** for this spec:

- Attachments per entry.
- Bulk import / email-forward parsing.
- Auto-derived entries from non-status actions (favorite, archive).
- Empty-text placeholder tweaks (a polish item to revisit after usage).
