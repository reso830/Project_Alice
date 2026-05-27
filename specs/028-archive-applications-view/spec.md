# Feature Specification: Archive Applications View

**Feature Branch**: `028-archive-applications-view`
**Created**: 2026-05-26
**Status**: Draft
**Input**: [`docs/features/028-archive-applications-view.md`](../../docs/features/028-archive-applications-view.md), [`docs/design/tracker.md`](../../docs/design/tracker.md), [`docs/design/application_overlay.md`](../../docs/design/application_overlay.md)
**Depends on**: [`001-app-tracker-ui`](../001-app-tracker-ui/spec.md) (Tracker chrome, card, filters), [`007-profile-page`](../007-profile-page/spec.md) (Profile stat tiles), [`012-inline-edit-overlay`](../012-inline-edit-overlay/spec.md) (Application Overlay modes), [`019-supabase-persistence`](../019-supabase-persistence/spec.md) (hosted persistence parity), [`020-portfolio-demo-mode`](../020-portfolio-demo-mode/spec.md) (demo-mode persistence rules â€” FR-033 references its FR-004), [`026-calendar`](../026-calendar/spec.md) (Calendar suggestion rules + Action Panel sections â€” FR-024â€¦FR-026 reference them by name)

---

## Clarifications

### Session 2026-05-26

- Q: Profile stat tiles (Total / Active / Offers / Rejections) â€” include archived rows or exclude them? â†’ A: All four tiles **exclude** archived rows. The new "Archived applications Â· N â†’" link is the only surface where archived rows are counted. Resolves C2 / FR-027.
- Q: Restore endpoint shape â€” dedicated route, generic PATCH, or toggle archive endpoint? â†’ A: Dedicated `POST /api/applications/:id/unarchive`, mirroring the existing `archive` endpoint. Client gains an `api.unarchive(id)` helper; demoStore and the Supabase repo each gain an `unarchive()` method. Resolves C4 / FR-007 / FR-010.
- Q: Favorite state across archive â†” restore â€” should archive clear `fav`, and should unarchive restore it? â†’ A: **Stop clearing `fav` on archive.** Archive leaves `fav` untouched; `fav` survives the round-trip naturally with no schema additions. The current `SET fav = 0` side effect in `archive()` is removed. Resolves C1 / FR-009 (and is a small intentional behavior change to existing archive).
- Q: Should the search query persist across view switches? â†’ A: **N/A â€” withdrawn.** Verified the Tracker has no text-search input today; the brief listed "search" in its compatibility list but the feature does not exist in the codebase. C3 is therefore vacuous. Resolves C3. (The draft FR-031 for search persistence was removed; subsequent FRs were renumbered to close the gap. FR-031 in the current spec now refers to persistence, unrelated to C3.)
- Q: Profile "Archived applications Â· N â†’" link â€” hide at count = 0 or always show? â†’ A: **Always show.** Count reads `0` when no rows are archived. Keeps layout stable and makes the surface discoverable before the user has any archived rows. Resolves the inline open question under US-4 Acceptance Scenario 3.

### Withdrawn at this session (no longer applicable)

- C3. Search query persistence â€” verified no text-search input exists in the Tracker today. The brief's compatibility list mentioned "search" but the feature does not exist. Vacuous; revisit only if/when search is added.
- C5. Imported-from-demo archived rows on hosted sign-in â€” verified no demoâ†’hosted import flow exists in the codebase today (feature 020 keeps demo state in memory; nothing crosses into hosted on sign-in). Edge case is vacuous; revisit only if/when an import flow is added.

---

## Problem Statement

Applications accumulate. As a user works through a search, many entries reach a state where they no longer warrant attention (closed, lost interest, deferred, ghosted-then-forgotten) but still hold information the user may want to revisit â€” interview notes, salary data, contact names, the exact job posting URL. Permanently deleting them is too destructive; leaving them in the active list dilutes every count, every filter result, and every suggestion.

Today the codebase has half of an archive lifecycle: the data model carries an `archived` boolean (server-side filtered out of the active list by `WHERE archived = 0`), the Tracker card and Application Overlay expose an Archive button, and `POST /api/applications/:id/archive` works. **But once an application is archived it disappears with no way back** â€” there is no archived-list view, no unarchive endpoint, no UI surface to restore a row.

This feature closes the loop. It adds a dedicated **Archived view** of the Tracker (toggled via a toolbar chip and deep-linked via `?view=archived`), surfaces an **Archived applications Â· N â†’** entry point on the Profile page, gives archived cards and the Application Overlay a **read-only Archived mode**, and introduces a one-click **Unarchive** action that restores a row to the active list. Archived rows remain fully excluded from active workflows, suggestion engine inputs, dashboard counts, and calendar-derived activity unless restored.

---

## Scope

### In scope

- Toolbar **View switcher chip** on the Tracker that toggles between Active and Archived lists (per `tracker.md` Â§ Toolbar > View switcher).
- **URL synchronization**: `?view=archived` activates the Archived view on load; default (no param) is Active. Switching the view writes the param.
- **Archived list query path**: the existing tracker list endpoint and demoStore gain a way to return archived rows. The Active list continues to exclude archived rows (current behavior).
- **Archived card variant** (per `tracker.md` Â§ Card > Archived card variant): "Archived" stamp chip, date-stamp slot reads "Archived [date]", quick-actions row collapses to a single Unarchive (â†º) button. Status accent and badge remain at full strength.
- **Archived Application Overlay mode** (per `application_overlay.md` Â§12): same frame and header, "ARCHIVED" header chip, â†º Unarchive + âœ• Close as the only icon actions, all body fields read-only, footer hidden, no draft/dirty machinery, no discard confirmation.
- **Unarchive action**:
  - On card row: clicking â†º immediately clears `archived` (and the new `archivedDate`); row leaves the Archived list; toast `Unarchived.`. No confirmation.
  - In overlay: clicking â†º clears `archived` (and `archivedDate`), closes the modal, toast `Unarchived.`. No confirmation.
- New `archivedDate` field on the application record, populated server-side when `archived` flips to `true`, and cleared when it flips back to `false`.
- **Empty states**:
  - Archived view with zero archived rows: "Nothing archived yet. / Archived applications will appear here."
  - Archived view with filters that match nothing: "No archived items match / the active filters."
- **Profile entry point**: Profile page adds an `Archived applications Â· N â†’` link that deep-links to `/?view=archived` (per `tracker.md` Â§ Navigation Pages).
- **Filter / sort / pagination compatibility**: existing Tracker quick filters, sort, and pagination work against the Archived list. Filters and sort **persist** across view switches; pagination **resets to page 1** on switch.
- **Toolbar adjustments in Archived view**: the "+ New application" toolbar button and the mobile FAB are **hidden** while the Archived view is active.
- **Exclusion of archived rows** from every active workflow surface:
  - Active Tracker list query (already enforced server-side; keep)
  - Suggestion engine inputs (feature 026 Calendar's `followup`, `feedback`, `interview_followup`, `offer_expiry`, `ghost` rules â€” must not consider archived rows)
  - Calendar Action Panel (`Today`, `Suggested Actions`, `Upcoming`)
  - Calendar Month Grid status chips
  - Profile dashboard counts â€” Total, Active, Offers, and Rejections all exclude archived rows (per FR-027); only the new "Archived applications Â· N â†’" link reports archived counts
- **Mode parity**: behavior is identical across local (SQLite) and hosted (Supabase) repositories, and the demo in-memory store. Archive + unarchive both persist across sessions in modes that persist; in demo mode they live for the page lifetime per feature 020's no-persistent-client-state rule.
- **Restoring a terminal-status application is allowed** (per brief edge case): unarchive does not change `status`; a row archived from `rejected` is restored to `rejected`. No state-machine validation runs on unarchive (there is no status transition).

### Out of scope (Non-Goals)

- Permanent deletion of individual archived applications.
- Bulk archive / bulk unarchive operations.
- Archive-only analytics (separate dashboards or stats screens for archived rows).
- Tagging, categorizing, or grouping archived rows beyond existing filters.
- Auto-archive heuristics (e.g. "archive after N days in terminal status").
- New filters introduced *for* the Archived view (existing quick filters are reused as-is).
- A `fav_before_archive` shadow column or any other mechanism to remember a prior favorite state â€” the spec's chosen rule (FR-009) is that archive does not clear `fav`, so no remembering is needed.
- Restoring previously archived rows via undo toast (the brief and tracker design omit Undo on archive; only the `application_overlay.md` Â§8 row mentions a toast with Undo â€” current source has no Undo wiring and adding it is out of scope here).

---

## User Scenarios & Testing

### User Story 1 â€” Open the Archived view (Priority: P1)

The user is on the Tracker. They click the leading toolbar chip ("Applications â–¾"). A popup lists two views â€” `Applications` and `Archived` â€” each with a count. They click `Archived`. The list is replaced with their archived applications; pagination resets to page 1; existing filters and sort remain applied. The toolbar chip now reads "Archived â–¾" and shows the archived count. The URL gains `?view=archived`. The "+ New application" button and mobile FAB are hidden.

**Why this priority**: Without this, no archived row is ever reachable; the rest of the feature is meaningless. This is the MVP slice.

**Independent Test**: With at least one archived row in the store, load `/`, click the toolbar chip, choose `Archived`. The list shows only `archived = true` rows. The URL contains `?view=archived`. Reload â€” the Archived view is still active. Click the chip â†’ `Applications` â€” the URL param clears and the active list returns.

**Acceptance Scenarios**:

1. **Given** the Active view with 5 active and 2 archived rows, **When** the user switches to Archived, **Then** exactly the 2 archived rows render, the chip count reads `2`, and `?view=archived` is present in the URL.
2. **Given** the user is on `//?view=archived` directly (refresh or deep link), **When** the page loads, **Then** the Archived view is the initial state without an intermediate flash of the Active view.
3. **Given** the Active view has a `Status = Interview` quick-filter applied and a sort by Last Updated, **When** the user switches to Archived, **Then** the same filter and sort remain applied and the count reflects archived rows matching them; pagination is at page 1.
4. **Given** the Archived view is active, **When** the user looks at the toolbar, **Then** the "+ New application" button is hidden (desktop) and the FAB is hidden (mobile).
5. **Given** the user is on the Archived view with `?view=archived` in the URL, **When** they switch back to the Active view, **Then** the URL no longer contains a `view=` parameter (the param is stripped, not rewritten to `view=active`).

---

### User Story 2 â€” Unarchive an application from the card (Priority: P1)

The user is in the Archived view. Each card shows the existing status accent and badge plus a small "Archived" stamp chip, a date-stamp that reads "Archived [date]", and a single â†º button in the actions row. They click â†º on one card. The row immediately disappears from the Archived list, the toolbar chip's archived count drops by one, and a toast reads `Unarchived.`. No confirmation dialog is shown.

**Why this priority**: This is the primary mechanic that gives the archived view its purpose â€” recovery without ceremony.

**Independent Test**: With one archived row in the store, switch to the Archived view, click â†º. The row leaves the Archived list, the toast fires, and the row is now present in the Active view with `archived = false` and `archivedDate = null`. Status is unchanged.

**Acceptance Scenarios**:

1. **Given** an archived row with status `rejected`, **When** the user clicks â†º, **Then** the persisted record has `archived = false`, `archivedDate = null`, and `status = rejected` (unchanged), and the row appears in the Active list.
2. **Given** the user is on the Archived view and clicks â†º, **Then** no confirmation dialog is shown (contrast with archive, which does confirm).
3. **Given** a successful unarchive, **Then** a toast `Unarchived.` is fired.
4. **Given** unarchive succeeds, **Then** the Archived toolbar count decreases by one and (if the user switches to Active) the Active count increases by one.

---

### User Story 3 â€” Open an archived application in read-only overlay (Priority: P2)

The user clicks anywhere on an archived card body (or its â†º does not catch the click). The Application Overlay opens in **Archived mode**: same header layout, but a small "ARCHIVED" chip sits next to the status badge, the only header actions are â†º and âœ•, all body fields render their values without entering edit mode, and the Save/Discard footer is hidden entirely.

**Why this priority**: Reviewing full details (responsibilities, notes, URL, dates) is the main reason archived data is kept around. Unarchive alone does not deliver that value.

**Independent Test**: With one archived row containing populated responsibilities, skills, salary, URL, and notes, click the card body. The overlay opens. Click any body field (e.g. Company) â€” nothing happens. Press Esc â€” overlay closes immediately without a discard confirmation.

**Acceptance Scenarios**:

1. **Given** the user clicks an archived card, **When** the overlay opens, **Then** the mode is `archived`, an "ARCHIVED" chip is rendered in the header, only â†º and âœ• are present in the header action cluster (no â˜…, â‡„, or ðŸ—„), and the footer is not rendered.
2. **Given** the overlay is in Archived mode, **When** the user clicks any body field (Company, Salary, Responsibilities, Required Skills chip, URL, etc.), **Then** the field does not switch to an input/textarea/dropdown and no caret/hover-lift appears.
3. **Given** the overlay is in Archived mode, **When** the user presses Esc / clicks the backdrop / clicks âœ•, **Then** the overlay closes immediately with no discard confirmation.
4. **Given** the overlay is in Archived mode, **When** the user clicks the status badge, **Then** the Status Dropdown does **not** open.
5. **Given** the overlay is in Archived mode, **When** the user clicks â†º in the header, **Then** the row is unarchived, the modal closes, and the toast `Unarchived.` fires.

---

### User Story 4 â€” Profile entry point to the Archived view (Priority: P2)

The user opens the Profile page. Alongside the existing stat tiles (Total, Active, Pending, Offer â€” per the actual implementation in [src/pages/Profile.js:113-118](../../src/pages/Profile.js#L113-L118); note this differs from the design doc's "Total / Active / Offers / Rejections" label set, which describes a redesign that has not yet shipped) they see an `Archived applications Â· N â†’` link showing the count of archived rows. Clicking it navigates to `/?view=archived`.

**Why this priority**: Without a Profile entry point, the only way to reach the Archived view is from the toolbar chip after already loading the Tracker â€” discoverable but indirect. The Profile link is the secondary discovery surface and is explicitly called out in the design.

**Independent Test**: Seed N archived rows. Load the Profile page. The Archived link shows `N`. Click the link â†’ URL is `/?view=archived` and the Archived view is active.

**Acceptance Scenarios**:

1. **Given** 3 archived rows exist, **When** the user opens the Profile page, **Then** the Archived link reads `Archived applications Â· 3 â†’`.
2. **Given** the user clicks the Archived link, **Then** the browser navigates to `/?view=archived` and the Archived view is the initial state.
3. **Given** zero archived rows exist, **When** the Profile page renders, **Then** the link appears with count `0` (the Archived view itself will show the empty state if the user enters it). The link is always rendered regardless of count.

---

### User Story 5 â€” Archive a row and have it leave active surfaces (Priority: P2)

Archive itself already works in the current codebase; this story covers the **new** behaviors layered on top: populating `archivedDate`, excluding the row from the Calendar's Action Panel + Suggested Actions + Month Grid + Upcoming, and excluding it from Suggestion Engine rule inputs.

**Why this priority**: This is the "no pollution" half of the brief's goal. Archive without exclusion makes the active view cleaner only on the surface.

**Independent Test**: Seed one application that would otherwise trigger each of the Calendar suggestion rules (`followup`, `feedback`, `interview_followup`, `offer_expiry`, `ghost`). Archive each one. Open the Calendar â€” the Suggested Actions panel is empty for those rows; the Action Panel's Today / Upcoming sections do not list them; the Month Grid does not draw chips for their timeline entries.

**Acceptance Scenarios**:

1. **Given** an application that meets the `followup` rule, **When** it is archived, **Then** the Calendar Suggested Actions panel does not include it. Same for `feedback`, `interview_followup`, `offer_expiry`, `ghost`.
2. **Given** an application with a Timeline entry dated today, **When** it is archived, **Then** the Calendar Action Panel's Today section does not include it.
3. **Given** an application with a Timeline entry dated +2 days, **When** it is archived, **Then** the Month Grid does not render a chip on that cell for that application's status.
4. **Given** a freshly archived row, **When** persistence completes, **Then** the server-side record has `archived = true` and `archivedDate` set to today's local date in ISO `YYYY-MM-DD` format.
5. **Given** a row is unarchived, **Then** it reappears in all surfaces above as soon as the list is re-fetched.

---

### User Story 6 â€” Filter, sort, paginate within the Archived view (Priority: P3)

The user, viewing the Archived list, applies the existing quick filters (status, company, location, shift, work setup), changes sort, and paginates. Behaviors mirror the Active view scoped to archived rows. Switching views preserves filters and sort; pagination resets to page 1.

**Why this priority**: Without filters/sort/pagination working over archived data, the view is functional only for small archives. For users with large archives, this is what makes the view actually usable.

**Independent Test**: With 25 archived rows across mixed statuses and companies, switch to Archived, apply a `Status = Rejected` filter â€” only matching archived rows are shown; pagination chunks correctly. Change sort to `Salary desc` â€” order updates. Switch back to Active â€” the same filter/sort is still applied and applies to active rows.

**Acceptance Scenarios**:

1. **Given** the Archived view with active filters, **When** filters match no archived rows, **Then** the empty state reads `No archived items match / the active filters.`.
2. **Given** the Archived view with zero archived rows, **When** the view renders, **Then** the empty state reads `Nothing archived yet. / Archived applications will appear here.`.
3. **Given** an active filter is set on the Active view, **When** the user switches to Archived, **Then** the same filter remains applied (and pagination resets to page 1).
4. **Given** the user is on Archived page 3, **When** they switch to Active, **Then** they land on Active page 1, not page 3.

---

### Edge Cases

- **Restore of a terminal-status row** (`rejected`, `withdrawn`, `ghosted`): unarchive succeeds without status validation; `status` is preserved as-is.
- **Restore of a row with pending follow-up data**: any follow-up fields, Timeline entries, notes, and skills survive the archive â†” unarchive round-trip unchanged.
- **Large archived datasets**: filter/sort/pagination apply to the Archived list with the same semantics and limits as the Active list. The Archived count badge reflects the **filtered** count, matching the Active chip's existing behavior. (The brief's mention of "search" in its compatibility list does not apply â€” no Tracker text-search input exists today.)
- **Demo mode**: archive and unarchive both work in demo mode but never persist beyond the page lifetime (per feature 020 FR-004). After a reload, the demo seed determines initial archived state.
- **Hosted mode import** of demo data on first sign-in: no such flow exists today (verified at clarify-time; see Clarifications Â§ Withdrawn C5). Revisit only if a demoâ†’hosted import flow is introduced.
- **Race conditions**: if the user clicks â†º twice in rapid succession (or Ã—/Archive twice on the same row), the second request returns 200 with the same already-transitioned record per FR-008 idempotency. The card is gone from the visible list after the first response, so the second click would typically come from the modal's archive button before its first response landed. UI should not surface a misleading error.
- **Archiving while in the Archived view**: not reachable â€” archived cards' quick-actions row collapses to a single â†º Unarchive button per FR-013 (no Ã— Archive button), and the archived-mode overlay hides the ðŸ—„ Archive icon per FR-017. The "+ New application" toolbar button and FAB hide (FR-004) prevent creation, which is a separate concern.
- **URL with `?view=archived` while signed out**: the route is gated like the rest of the Tracker â€” unauthenticated visitors are routed to the Welcome page (see `docs/design/welcome_page.md`). Whether the `?view=archived` parameter is preserved across the sign-in redirect (so the user lands on the Archived view after signing in) or dropped (lands on the default Active view) is deferred to planning; either behavior satisfies the spec.
- **`archivedDate` for rows archived before this feature shipped**: existing archived rows in any user's database have no `archivedDate`. The card falls back to displaying `lastStatusUpdate` ("Archived [last_status_update]") per the design. No back-population migration is required.
- **Profile archived-count fetch failure**: the Profile page issues a separate `api.getAll({ view: 'archived' })` call to compute the count for the `Archived applications Â· N â†’` link. On fetch failure (network error, server 5xx, etc.) the link renders with `N = 0` as a graceful-degradation default rather than blocking the entire Profile render. The user can still click through; the Archived view itself surfaces the load/error state per FR-036. This is an explicit UX choice: an inaccurate "0" is preferable to a broken Profile page, since the Archived view's own error surface is the canonical place to report list-fetch failures.
- **Star (`fav`) preservation across archive â†” unarchive**: `fav` is untouched by archive and by unarchive. The current archive behavior of zeroing `fav` is being removed (see FR-009). A row archived while favorited remains favorited (the â˜… icon is just hidden in the archived card/overlay surfaces) and re-emerges with `fav = true` on unarchive.

---

## Requirements

### Functional Requirements

#### View switcher + URL sync

- **FR-001**: The Tracker MUST render a leading toolbar chip whose label is `Applications â–¾` in the Active view and `Archived â–¾` in the Archived view, with a count badge reflecting the current view's filtered row count (per `tracker.md` Â§ View switcher).
- **FR-002**: Clicking the chip MUST open a popup listing both views with their respective counts and an indicator of the active view; selecting a view MUST switch the list, reset pagination to page 1, and persist filters + sort. The popup's per-view counts MUST be the **unfiltered** totals for each view (so a user with active filters sees the chip showing the *filtered* current-view count and the popup showing both views' *unfiltered* totals â€” these MAY differ when filters are active).
- **FR-003**: The selected view MUST be reflected in the URL: Active = no `?view=` param (the param MUST be stripped, not rewritten to `?view=active`); Archived = `?view=archived`. On page load, the URL parameter MUST initialize the view before the first list render (no flash of Active when `?view=archived` is present). The URL update MUST use `history.replaceState`, not `pushState` â€” view toggles do not become independent browser-history entries (so the back button does not unwind a sequence of toggles).
- **FR-004**: The "+ New application" toolbar button and the mobile FAB MUST be hidden while the Archived view is active.

#### Archive lifecycle (existing + new)

- **FR-005**: When `archived` flips from `false` to `true`, the server MUST set `archivedDate` to the current date in ISO `YYYY-MM-DD` format (same date semantics as `lastStatusUpdate`).
- **FR-006**: When `archived` flips from `true` to `false`, the server MUST clear `archivedDate` to `null`.
- **FR-007**: The system MUST expose `POST /api/applications/:id/unarchive` (mirroring the existing `POST /:id/archive`) as the canonical restore action. The client MUST expose an `api.unarchive(id)` helper; the SQLite repo, the Supabase repo, and the demo in-memory store MUST each implement an `unarchive(id)` method. `PATCH /api/applications/:id` MUST NOT be used to toggle `archived`.
- **FR-008**: Archive and unarchive MUST be idempotent â€” archiving an already-archived row or unarchiving an already-active row MUST be a safe no-op (response shape consistent with other writes).
- **FR-009**: Unarchive MUST NOT change `status`, `fav`, `lastStatusUpdate`, `applicationDate`, or any other field beyond `archived` and `archivedDate`. It is a pure restore. Symmetrically, archive MUST also leave `fav` untouched â€” the current behavior of zeroing `fav` on archive is removed so that `fav` survives the archive â†” unarchive round-trip naturally.

#### Archived list query

- **FR-010**: The system MUST expose a way to list archived rows server-side, scoped to the current user (hosted mode) or the local user (local/demo mode). The shape (query param on the existing list endpoint vs. separate endpoint vs. expanded response) is a planning-phase decision; it does not affect the user-visible spec and is not part of the C4 restore-endpoint resolution.
- **FR-011**: The Active list endpoint MUST continue to exclude archived rows (current behavior). The change is additive: no behavior regression on Active.
- **FR-012**: Archive filtering MUST be performed server-side (per brief Technical Notes). The client MUST NOT fetch all rows and filter locally.

#### Card rendering (Archived view)

- **FR-013**: Archived cards MUST use the layout described in `tracker.md` Â§ Archived card variant: identical surface/border/shadow/status accent to active cards, with an "Archived" stamp chip in Row 1, a date-stamp reading "Archived [archivedDate || lastStatusUpdate fallback]", and a quick-actions row collapsed to a single â†º Unarchive button (no âœŽ, â‡„, ðŸ”—, â˜…, Ã—).
- **FR-014**: Clicking the card body of an archived card MUST open the Application Overlay in Archived mode (FR-018). Clicking the â†º button MUST NOT open the overlay; it MUST execute the unarchive operation.

#### Application Overlay â€” Archived mode

- **FR-015**: The Application Overlay MUST support a third mode, `archived`, in addition to `edit` and `create` (per `application_overlay.md` Â§12).
- **FR-016**: In Archived mode the header MUST render the existing ID pill and status badge plus an "ARCHIVED" chip (`archived-stamp`) with the contrast-aware styling defined in `application_overlay.md` Â§12.1. The status badge and the job title MUST NOT be interactive.
- **FR-017**: In Archived mode the header action cluster MUST collapse to exactly two buttons: â†º Unarchive and âœ• Close. The â˜… Favorite, â‡„ Change Status, and ðŸ—„ Archive icons MUST be hidden.
- **FR-018**: In Archived mode every body field (Company, Recruiter, Location, Salary, Shift, Work Setup, Compatibility Notes, Responsibilities, Required Skills, Preferred Skills, URL, General Notes) MUST render its value without an editable affordance: no click-to-edit, no hover lift, no dropdown carets, no chip remove buttons, no chip-editor input. Last Updated remains read-only as in Edit mode.
- **FR-019**: In Archived mode the Save / Discard footer MUST NOT be rendered. There is no draft state, no `isDirty`, and no Save / Discard confirmation flow.
- **FR-020**: In Archived mode the Status Dropdown MUST be unreachable (no badge click handler, no â‡„ icon).
- **FR-021**: In Archived mode âœ• / backdrop click / Esc MUST close the modal immediately, never showing a discard confirmation. `Cmd/Ctrl + S` MUST be a no-op.
- **FR-022**: Clicking â†º Unarchive in the overlay MUST perform the unarchive operation, close the modal, and fire toast `Unarchived.`. No confirmation dialog.
- **FR-023**: The mode MUST be selected by the row's data, not by the active view: a card with `row.archived === true` MUST open in Archived mode even if entered via a deep link, search, or back-navigation. Conversely, a row with `archived === false` MUST never open in Archived mode regardless of context.

#### Active-workflow exclusion

- **FR-024**: Calendar Action Panel sections (`Today`, `Suggested Actions`, `Upcoming`) MUST exclude rows where `archived === true`.
- **FR-025**: Calendar Suggestion Engine rules (`followup`, `feedback`, `interview_followup`, `offer_expiry`, `ghost`) MUST treat archived rows as ineligible (no suggestion generated for them).
- **FR-026**: Calendar Month Grid status chips MUST NOT include activity from archived rows.
- **FR-027**: The existing Profile stat tiles (Total, Active, Pending, Offer â€” per the actual implementation; the design doc shows a different label set ("Total / Active / Offers / Rejections") that describes a redesign not yet shipped â€” see [src/pages/Profile.js:113-118](../../src/pages/Profile.js#L113-L118) and [src/models/profile.js:420-429](../../src/models/profile.js#L420-L429)) MUST exclude archived rows from their counts. Each tile counts only rows with `archived === false`. Today this is satisfied by-default because the Profile reads from `getAll()` which already excludes archived; no Profile code change is required to honor this FR. The "Archived applications Â· N â†’" link (FR-028) is the sole Profile surface that reports archived rows.
- **FR-028**: The new Profile `Archived applications Â· N â†’` link MUST navigate to `/?view=archived` and MUST show the count of archived rows for the current user. The link MUST always be rendered regardless of count â€” when the user has zero archived rows, it MUST render with `N = 0` (clickable; leads to the Archived empty state).

#### Filter / sort / pagination

- **FR-029**: The existing quick filters (Status, Company, Location, Shift, Work Setup), Sort panel, and pagination MUST operate over the Archived list identically to the Active list.
- **FR-030**: Filters and sort MUST persist across view switches. Pagination MUST reset to page 1 on every view switch.

#### Persistence + mode parity

- **FR-031**: `archived` and `archivedDate` MUST persist across sessions in local (SQLite) and hosted (Supabase) modes.
- **FR-032**: Demo mode MUST support archive and unarchive against its in-memory store; archive state MUST NOT be written to `localStorage` (per feature 020 FR-004); state lives only for the page lifetime.
- **FR-033**: Behavior MUST be identical (within mode capability) across local, hosted, and demo modes for: listing the archived view, archiving, unarchiving, excluding archived rows from active surfaces.

#### Empty / loading / error states

- **FR-034**: The Archived view MUST render the empty state `Nothing archived yet. / Archived applications will appear here.` when zero archived rows exist for the current user (filters not applied).
- **FR-035**: The Archived view MUST render the filter-empty state `No archived items match / the active filters.` when filters are applied and match no archived rows.
- **FR-036**: The Archived view MUST surface the same load/error state used by the Active list when the list query fails.
- **FR-037**: Toasts: `Unarchived.` on a successful unarchive (card or overlay path). Standard error toast on failure.

#### Constitutional requirements

- **FR-038**: System MUST preserve required job application fields: company name, job title, status, last_status_update, responsibilities (Constitution Amendment 1.2.0) â€” archive and unarchive do not alter these.
- **FR-039**: System MUST not introduce external analytics, tracking, or data sharing.
- **FR-040**: System MUST support desktop and mobile browsers, labeled forms, keyboard navigation, and non-color-only status communication for every new surface introduced here (view chip, archived card stamp, archived overlay chip, Unarchive button).
- **FR-041**: System MUST provide automated tests for the new logic: archive sets `archivedDate`; unarchive clears it; `status` and `fav` preservation across the archive â†” unarchive round-trip (per FR-009); URL `?view=archived` parsing; Calendar exclusion rules.

---

### Key Entities

- **Application** *(existing â€” extended)*: the tracked job application record. New behavior:
  - `archived: boolean` â€” already exists; semantics unchanged.
  - `archivedDate: ISO date string | null` â€” **new**. Set automatically by the server when `archived` transitions `false â†’ true`. Cleared automatically when it transitions `true â†’ false`. Surfaced on the card date-stamp and in any future audit context.
- **View** *(client concept, no persistence)*: the active list view, one of `active` or `archived`. Reflected in the toolbar chip, the URL query (`?view=archived`), and the Application Overlay's mode selection. Not stored server-side.
- **Filter / Sort State** *(existing)*: persists across view switches per FR-030.
- **Pagination State** *(existing)*: resets on view switch per FR-030.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user with archived applications can reach the Archived view from a cold load in at most two interactions: either via the toolbar chip (1 click â†’ 1 select) or via the Profile link (1 click).
- **SC-002**: Archiving a row removes it from every active surface (Active list, Calendar Today / Upcoming / Suggested Actions / Month Grid) within the same page session, without a full reload. Unarchiving restores it the same way.
- **SC-003**: For a database containing N archived rows, the Archived view renders within the same time budget as the Active view rendering N rows under identical filter/sort/pagination state (no per-row penalty beyond fetching from a different filter).
- **SC-004**: All new automated tests pass: `archivedDate` round-trip, unarchive endpoint behavior, view query, Calendar exclusion of archived rows, overlay Archived mode read-only enforcement, URL parsing of `?view=archived`.
- **SC-005**: Browser smoke test (constitution-required final phase): on desktop + mobile viewports, a user can archive a row, see it leave the Active view, switch to the Archived view, open the row in read-only overlay, unarchive from either the card or the overlay, and confirm it returns to the Active view. No visual regressions on the Active card or overlay paths.
- **SC-006**: Zero regressions to existing archive behavior â€” the current `Ã— Archive` button on active cards and the ðŸ—„ Archive in the Application Overlay continue to behave as before (confirm dialog, toast, row leaves the Active list).

---

## Assumptions

- Archive functionality already exists at the application level (server endpoint, DB column, card + modal trigger, demoStore + Supabase parity).
- Existing tracker filters, sort, and pagination components can be reused without forks for the Archived view. (No Tracker text-search input exists today â€” C3 withdrawn at `/speckit.clarify`.)
- The Application Timeline (feature 025) data on archived rows remains in the database; it is just not surfaced through the Calendar's projection while the row is archived.
- The `archivedDate` field can be added without a data migration that disrupts running deployments â€” existing archived rows will simply have `null` and fall back to `lastStatusUpdate` on display.
- The Profile page (feature 007) can accept a new link tile without a redesign â€” only an additive change to the stat tile row.
- The Calendar (feature 026) suggestion engine and Action Panel queries already iterate the application list and can apply an `archived === false` filter at the same point they apply other inclusion rules.
- Hosted-mode (Supabase) and local-mode (SQLite) repositories will both gain the `archivedDate` column / field via parallel schema updates; demo mode tracks it in memory only.
- No external service or new dependency is introduced by this feature.
- Job application data remains local-first / per-user; archived rows carry the same privacy posture as active rows.
