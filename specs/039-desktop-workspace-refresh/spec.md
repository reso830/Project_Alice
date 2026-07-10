# Feature Specification: Desktop Workspace Refresh

**Feature Branch**: `039-desktop-workspace-refresh`
**Created**: 2026-06-20
**Status**: Draft
**Input**: Feature brief `docs/features/2.0.0-smart-intake-ai-assistance/039-desktop-workspace-refresh.md`. Design references `docs/design/tracker.md` § *Desktop Detail Pane* and `docs/design/application_overlay.md` §3 (render variants), §4 / §15 (panelled body). UX-only refresh — no changes to compatibility scoring (036/037), timeline (025), application data model, or backend.

---

## Clarifications

### Session 2026-06-20

- Q: The feature brief lists the Application Details panel order as **Overview → Skills → Compatibility → Timeline → Notes & Links**, but the newer design revision in `application_overlay.md` §15.4 lists **Overview → Compatibility → Skills → Timeline → Notes & Links**. Which order is normative? → A: **The feature brief order** — Overview → **Skills** → **Compatibility** → Timeline → Notes & Links. The design doc §15.4 ordering is superseded by this spec and should be corrected during Release Prep.
- Q: When the docked pane has unsaved (dirty) edits and the user clicks a different application card, what happens? → A: **Prompt the existing discard confirmation** (Keep editing / Discard). The switch proceeds only when the user confirms Discard; "Keep editing" cancels the switch and keeps the current application loaded. Mirrors the modal close-while-dirty behavior — no silent data loss.
- Q: What happens to the selection and the pane when the selected application leaves the visible set (filtered out, sorted onto another page, or the Active/Archived view is switched)? → A: **Keep the pane showing the previously selected application until the user selects another card.** The detail pane is not force-cleared when its source card scrolls out of, is filtered out of, or is paged away from the visible list.
- Q: On desktop (≥1100px), what does the detail pane show on initial page load before any card is clicked? → A: **The empty "Nothing open yet" state** — nothing is auto-selected on load. This is the behavior already specified in `docs/design/tracker.md` § *Desktop Detail Pane* → *Empty state* and the ≥1100px row of the Responsive Breakpoints table; no new mockup is required.
- Q: The production overlay body is a flat field grid, not the 5 named collapsible panels in `application_overlay.md` §15. Is panelizing the body in scope for 039? → A: **Yes — panelize the body** into the 5 collapsible panels (Overview → Skills → Compatibility → Timeline → Notes & Links) per design §15, applied across **all** render variants (desktop pane, tablet modal, mobile bottom sheet). Build to §15, but use the clarified **Skills-before-Compatibility** order (the §15.4 Compatibility-before-Skills ordering is superseded by this spec).

---

## Problem Statement

On desktop, the Tracker opens every application's details in a centered modal that covers the list and locks page scroll. As a user works through a pipeline of many applications, this forces a repetitive open → read → close → open-next loop: only one application is visible at a time, the list context is hidden behind a backdrop, and comparing two opportunities means closing one modal and opening another.

This wastes the large screen real estate desktop users have and adds friction to the core job of managing applications. A persistent **master-detail workspace** — the application list beside a docked detail pane, modelled on a mail client's reading pane — lets users browse, compare, review compatibility, and edit without leaving the list. Tablet and mobile, where horizontal space is limited, keep the existing centered-modal and bottom-sheet workflows unchanged.

This is a user-experience and workflow refresh only. It introduces no changes to compatibility scoring, timeline behavior, the application creation choices, the data model, or the backend. On desktop, Create mode now renders in the docked pane after the existing Add-application gate.

---

## Scope

**In scope**

- A desktop **master-detail layout** for the Tracker at viewport widths **≥ 1100px**: the application list (master, ~60%) beside a docked **detail pane** (detail, ~40%).
- **Application selection** on desktop: clicking a card selects and highlights it and loads its details into the docked pane instead of opening a centered modal.
- A **desktop empty-pane state** shown when no application is selected (including on initial page load).
- A **pane render variant** of the existing Application Details component — borderless, no backdrop, no page-scroll lock, internal scrolling only — sharing all editing behavior and business logic with the existing modal variant.
- **Selection state** kept independent of editing (draft) state, with an unsaved-edit guard when switching applications.
- Retaining, unchanged, the existing **tablet centered-modal** (640–1099px) and **mobile bottom-sheet** (< 640px) workflows.
- **Panelizing the Application Details body** into 5 collapsible panels — Overview → Skills → Compatibility → Timeline → Notes & Links — per `application_overlay.md` §15, applied across the desktop pane, tablet modal, and mobile bottom sheet (the body is shared, so panelization is one change visible in all three). This replaces the existing flat `.modal-field` grid.

**Non-goals**

- No changes to the **compatibility scoring algorithm or engine** (036), the compatibility analysis/notes lifecycle (037), or how scores are computed or displayed on cards.
- No changes to **timeline** functionality or its data (025).
- No changes to the **application creation choices** — the Add-application gate, Smart Entry, Manual Entry, and job-posting parsing (013/035) remain exactly as today. Only the desktop Create-mode surface changes: after the gate, Create mode renders in the docked pane at ≥1100px.
- No changes to the **application data model**, database schema, or any backend route (no new/changed columns, no migrations).
- No new **AI capabilities** and no changes to AI provider configuration (038).
- No changes to **Dashboard** or **Calendar** (026) functionality.
- No **ATS / resume quality** analysis (tracked separately under 041).
- No change to the **archive/unarchive** behavior or the Active/Archived view switcher itself (028) — only how an archived card's details render on desktop.
- No introduction of a denser one-line `compact` card row variant (it exists in code but stays off by default, pending a future Settings toggle — out of scope here).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse the list and view details side-by-side (Priority: P1)

On a wide desktop, a user sees their application list and, beside it, a docked detail pane. Clicking any card selects it, highlights it, and loads its full details into the pane — the list stays visible the whole time; no centered modal appears.

**Why this priority**: This is the core of the feature — the master-detail workspace and in-pane detail rendering. Without it, nothing else in the feature exists.

**Independent Test**: Resize the browser to ≥ 1100px and open the Tracker. Confirm a two-column layout (list left, detail pane right). Click an application card and confirm: (a) the card receives an active/selected treatment, (b) its details render in the docked pane, (c) no centered modal or backdrop appears, and (d) the rest of the list remains visible and scrollable.

**Acceptance Scenarios**:

1. **Given** the Tracker at ≥ 1100px, **When** the page loads, **Then** the application list and a docked detail pane render side-by-side (list ~60%, pane ~40%).
2. **Given** the master-detail layout, **When** the user clicks an application card, **Then** the application is selected, the card is visually highlighted, and its details load in the docked pane.
3. **Given** the master-detail layout, **When** the user clicks a card, **Then** no centered modal and no backdrop appear, and the list remains visible.
4. **Given** the docked pane is showing an application, **When** the user scrolls within the pane, **Then** only the pane body scrolls; the page and list are not scroll-locked.

---

### User Story 2 — Empty detail state (Priority: P1)

When nothing is selected, the detail pane shows a friendly placeholder explaining what the pane is for and inviting the user to pick an application.

**Why this priority**: The empty state is the desktop default on first load and whenever no application is selected; the workspace is incomplete and confusing without it.

**Independent Test**: Open the Tracker at ≥ 1100px without clicking any card. Confirm the detail pane shows the "Nothing open yet" empty state (placeholder illustration + explanatory copy) and that no application details are shown.

**Acceptance Scenarios**:

1. **Given** the Tracker at ≥ 1100px on initial load, **When** no application has been selected, **Then** the detail pane shows the empty "Nothing open yet" state and no application is auto-selected.
2. **Given** the empty-pane state, **When** the user reads it, **Then** it communicates the pane's purpose and encourages selecting an application (no creation call-to-action button — creation lives in the toolbar).
3. **Given** the empty-pane state, **When** the user clicks an application card, **Then** the empty state is replaced by that application's details.

---

### User Story 3 — Switch quickly between applications (Priority: P2)

A user clicks from one application to another to compare opportunities. Each click swaps the pane's contents in place — no modal opens or closes, and selecting a different application does not carry over or persist edits from the previous one.

**Why this priority**: Frictionless switching is the productivity payoff of the redesign, but it builds on the layout and selection delivered by US1.

**Independent Test**: At ≥ 1100px, select application A and observe its details. Click application B and confirm the pane now shows B (A's details fully replaced) with B highlighted and A no longer highlighted, with no modal animation. Confirm that switching back to A shows A's saved (unedited) values, not any transient state from B.

**Acceptance Scenarios**:

1. **Given** application A is loaded in the pane, **When** the user clicks application B's card, **Then** the pane replaces A's details with B's, B becomes the highlighted card, and A is no longer highlighted.
2. **Given** the user switches between applications, **When** a new application is selected, **Then** selection state updates independently of editing state and no draft from the previous application persists into the newly selected one.
3. **Given** repeated switching, **When** the user clicks several cards in succession, **Then** the pane updates each time without opening or closing a modal.

---

### User Story 4 — Edit consistently across pane, modal, and bottom sheet (Priority: P2)

A user edits an application in the docked pane using the same click-to-edit fields, status changes, compatibility view, timeline, and Save/Discard footer they would use in the centered modal — the experience is identical to the tablet modal and mobile bottom sheet.

**Why this priority**: The redesign must not fork editing behavior. A single shared editing experience is what keeps the pane trustworthy and maintainable, but it depends on the pane existing (US1).

**Independent Test**: Edit a field, change status, and view the Compatibility and Timeline panels in the docked pane; confirm Save and Discard behave exactly as in the modal. Then repeat the same edits in the tablet modal (640–1099px) and confirm identical behavior and outcomes.

**Acceptance Scenarios**:

1. **Given** an application loaded in the docked pane, **When** the user edits any editable field, **Then** the inline click-to-edit, commit, and revert behavior is identical to the centered modal.
2. **Given** edits in the pane, **When** the user clicks Save, **Then** the draft commits to the record and the save outcome (toast, dirty-state reset) matches the modal exactly.
3. **Given** edits in the pane, **When** the user clicks Discard, **Then** the discard flow matches the modal exactly.
4. **Given** the Application Details panels, **When** rendered in the pane, **Then** their order is Overview → Skills → Compatibility → Timeline → Notes & Links — the same order as in the modal and bottom sheet.
5. **Given** the Compatibility panel, **When** viewed in the pane, **Then** detailed compatibility information is available there and the compatibility score remains visible on the application card; scoring behavior is unchanged.

---

### User Story 5 — Guard unsaved edits when switching applications (Priority: P2)

A user with unsaved edits in the pane clicks a different application. Instead of silently losing the edits, they are shown the existing discard confirmation and can choose to keep editing or discard and switch.

**Why this priority**: Without a guard, the low-friction switching of US3 becomes a data-loss hazard. The guard makes fast switching safe.

**Independent Test**: Edit a field in the pane so the draft is dirty (Save/Discard footer visible), then click a different card. Confirm the discard confirmation appears. Choose "Keep editing" and confirm the original application stays loaded with edits intact. Repeat, choose "Discard," and confirm the newly clicked application loads.

**Acceptance Scenarios**:

1. **Given** the pane has unsaved (dirty) edits, **When** the user clicks a different application card, **Then** the existing discard confirmation dialog appears.
2. **Given** the discard confirmation from a card switch, **When** the user chooses "Keep editing," **Then** the switch is cancelled and the current application remains loaded with its edits intact.
3. **Given** the discard confirmation from a card switch, **When** the user chooses "Discard," **Then** the edits are dropped and the clicked application loads in the pane.
4. **Given** the pane has no unsaved edits, **When** the user clicks a different card, **Then** the switch happens immediately with no confirmation dialog.

---

### User Story 6 — Selection persists across filter, sort, pagination, and view changes (Priority: P2)

A user who has an application open in the pane then filters, sorts, paginates, or switches between the Active and Archived views continues to see that application's details — the pane is not blanked just because its card is no longer on screen.

**Why this priority**: Losing the open detail every time the list re-queries would undercut the "keep context" goal. Persistence keeps the workspace stable during list manipulation.

**Independent Test**: Select an application, then apply a filter that removes its card from the visible list (or sort/paginate it off the page, or switch to the Archived view). Confirm the detail pane still shows the previously selected application until the user clicks a different card.

**Acceptance Scenarios**:

1. **Given** an application is loaded in the pane, **When** the user applies a filter or sort that removes that application's card from the visible list, **Then** the pane keeps showing that application's details.
2. **Given** an application is loaded in the pane, **When** the user changes pages so that application's card is not on the current page, **Then** the pane keeps showing that application's details.
3. **Given** an application is loaded in the pane, **When** the user switches between the Active and Archived views, **Then** the pane keeps showing the previously selected application until another card is clicked.
4. **Given** the pane is showing a previously selected application whose card is no longer visible, **When** the user clicks any visible card, **Then** the pane replaces its contents with the newly clicked application.

---

### User Story 7 — Tablet and mobile workflows remain unchanged (Priority: P3)

Users on tablet and mobile continue to get the centered modal (640–1099px) and bottom sheet (< 640px) exactly as before — the master-detail layout is desktop-only.

**Why this priority**: Regression protection for the unchanged platforms. It is lower priority because it requires no new behavior, only verified preservation.

**Independent Test**: At 640–1099px, click a card and confirm a centered modal (with backdrop and scroll lock) opens, not a docked pane. At < 640px, click a card and confirm the bottom-sheet workflow opens. Confirm no docked pane appears below 1100px.

**Acceptance Scenarios**:

1. **Given** a viewport of 640–1099px, **When** the user clicks an application card, **Then** the existing centered modal opens (with backdrop and body-scroll lock) and no docked pane is shown.
2. **Given** a viewport < 640px, **When** the user clicks an application card, **Then** the existing bottom-sheet workflow opens.
3. **Given** any viewport < 1100px, **When** the Tracker renders, **Then** the master-detail split is not engaged.

---

### User Story 8 — Panelized, collapsible Application Details body (Priority: P1)

The Application Details body is organized into five labeled, collapsible panels — Overview, Skills, Compatibility, Timeline, Notes & Links — in that order. On open, only Overview is expanded; the others show a one-line preview and can be expanded individually. This grouping is identical in the desktop pane, the tablet modal, and the mobile bottom sheet.

**Why this priority**: The brief makes the panel structure a normative part of the Application Details experience, and the docked pane is far more usable with a compact, collapsible body than a long flat field list. It is the second pillar of this feature alongside the master-detail layout.

**Independent Test**: Open an application (in the pane at ≥ 1100px, and again in the modal below 1100px). Confirm the body shows five panels in the order Overview → Skills → Compatibility → Timeline → Notes & Links, with only Overview expanded and the rest collapsed to a one-line preview. Expand and collapse each panel and confirm the toggle works and does not make the Save/Discard footer appear (collapse is not an edit).

**Acceptance Scenarios**:

1. **Given** an application is opened in any variant, **When** the body renders, **Then** it shows five collapsible panels in the order Overview → Skills → Compatibility → Timeline → Notes & Links.
2. **Given** the body opens, **When** first rendered, **Then** only the Overview panel is expanded and the other four are collapsed to a one-line preview (Compatibility shows its mini score ring + verdict + summary; the others show their respective summaries).
3. **Given** a collapsed panel, **When** the user activates its header (click or Enter/Space), **Then** the panel expands to its full content; activating again collapses it.
4. **Given** a clean (non-dirty) application, **When** the user expands or collapses any panel, **Then** the Save/Discard footer does not appear — collapse state is local UI state, not a draft change.
5. **Given** the Overview panel, **When** expanded, **Then** it contains Company, Recruiter, Location, Salary, Shift, Work Setup, Min Years, and Responsibilities; the Skills panel contains Required and Preferred skills; Notes & Links contains the Job Posting URL and General Notes.
6. **Given** a long Responsibilities or General Notes value, **When** displayed, **Then** it is clamped with a Show more / Show less toggle.
7. **Given** an archived application, **When** opened, **Then** the same five panels render read-only (no editing affordances, no footer), consistent with archived mode.

---

### Edge Cases

- **Archived card on desktop**: clicking a card whose `archived` flag is true loads the existing read-only Archived mode of the Application Details component in the docked pane (per `application_overlay.md` §12 — archived mode shares the same frame and renders in the pane variant). No editing footer; Unarchive/Close actions only.
- **Create on desktop**: starting a new application still opens the Add-application gate first. After the user chooses Manual Entry or completes Smart Entry / job-posting parsing, Create mode renders in the docked pane at ≥1100px; closing or discarding Create mode restores the empty-pane placeholder.
- **Selected application archived or deleted from the pane**: if the user archives the currently loaded application from within the pane, the pane returns to the empty state and the card leaves the Active list (existing archive behavior, applied to the pane variant).
- **Viewport crosses 1100px while an application is open**: shrinking below 1100px with an application selected falls back to the modal/sheet workflow for that application; growing to ≥ 1100px restores the docked pane. (Selection is preserved across the transition where feasible.)
- **No applications at all / filter returns nothing**: the list column shows the existing empty/no-results state and the detail pane shows the "Nothing open yet" empty state.
- **Selected application's card is filtered, sorted, or paged out**: the pane retains its contents (US6) — it is not cleared.
- **Unsaved edits + filter/sort/pagination/view change** (no card click): the pane keeps the dirty application loaded; no discard prompt fires because no different application was selected. The discard guard fires only on selecting a different application (US5).
- **Keyboard-only selection**: cards are keyboard-focusable and activatable; selecting via keyboard loads the pane the same as a click, and the selected state is communicated by more than color alone.

---

## Requirements *(mandatory)*

### Functional Requirements

**Desktop master-detail layout**

- **FR-001**: The Tracker MUST present a master-detail layout — application list (master) beside a docked Application Details pane (detail) — at viewport widths ≥ 1100px.
- **FR-002**: The application list MUST remain the primary surface (~60% width) and the detail pane the secondary surface (~40% width); the pane MUST be pinned (sticky) so it stays in view while the list scrolls, and the pane's own body MUST scroll internally.
- **FR-003**: At viewports < 1100px the master-detail layout MUST NOT engage; the existing centered modal (640–1099px) and bottom sheet (< 640px) MUST be used unchanged.

**Selection**

- **FR-004**: Clicking an application card at ≥ 1100px MUST select the application, apply an active/selected visual treatment to that card, and load the application's details into the docked pane.
- **FR-005**: At ≥ 1100px, clicking a card MUST NOT open a centered modal or backdrop and MUST NOT lock page scroll.
- **FR-006**: At most one application MUST be selected at a time; selecting a different card MUST move the highlight to the newly selected card and clear it from the previous one.
- **FR-007**: The selected state MUST be communicated by more than color alone (e.g. an accompanying border/elevation treatment and an accessible selected state), satisfying the constitution's non-color-only requirement.

**Empty state**

- **FR-008**: When no application is selected — including on initial desktop load — the detail pane MUST display an empty state that communicates the pane's purpose and encourages selecting an application.
- **FR-009**: No application MUST be auto-selected on initial desktop load.

**Application Details render variants**

- **FR-010**: The Application Details component MUST support two render variants — a docked **pane** variant (no backdrop, no page-scroll lock, internal scrolling only) and the existing **modal** variant (backdrop and scroll lock) — selected by viewport: pane at ≥ 1100px, modal/sheet below.
- **FR-011**: Both render variants MUST share the same editing experience and business logic (inline click-to-edit, status change, Save, Discard, validation, dirty-state tracking, quick actions, keyboard behavior). Editing in the pane MUST be fully equivalent to editing in the modal.
- **FR-012**: The Application Details panels MUST render in this order in all variants: Overview → Skills → Compatibility → Timeline → Notes & Links.

**Selection vs. editing state**

- **FR-013**: Application selection state MUST be independent of editing (draft) state; selecting a different application MUST NOT cause a draft from the previously selected application to persist into the newly selected one.
- **FR-014**: When the pane has unsaved (dirty) edits and the user selects a different application, the system MUST present the existing discard confirmation; the switch MUST proceed only if the user chooses Discard, and "Keep editing" MUST cancel the switch and keep the current application loaded.
- **FR-015**: When the pane has no unsaved edits, selecting a different application MUST switch immediately with no confirmation.

**Selection persistence**

- **FR-016**: When the currently selected application's card leaves the visible list due to filtering, sorting, pagination, or an Active/Archived view switch, the detail pane MUST continue to show that application's details until the user selects a different card.

**Compatibility & timeline (unchanged behavior, surfaced in the pane)**

- **FR-017**: Compatibility scores MUST remain visible on application cards, and detailed compatibility information MUST remain available within the Application Details Compatibility panel; compatibility analysis MUST appear only within the Compatibility panel. No compatibility scoring behavior MUST change.
- **FR-018**: Timeline functionality MUST remain unchanged and MUST be available within the Application Details Timeline panel in the pane variant.

**Creation**

- **FR-019**: The application creation workflow MUST continue to start with the Add-application gate (Smart Entry / Manual Entry / job-posting parsing). At ≥1100px, the resulting Create mode MUST render in the docked pane; below 1100px it MUST continue to use the centered modal / bottom-sheet surfaces.

**Regression protection**

- **FR-020**: Existing CRUD, status management, compatibility, timeline, and archive/unarchive functionality MUST remain fully operational across desktop pane, tablet modal, and mobile bottom-sheet.
- **FR-021**: Existing accessibility support MUST NOT regress; keyboard navigation, labeled forms, and focus behavior MUST remain supported in the pane variant, including keyboard-driven card selection.

**Performance**

- **FR-022**: Switching the selected application MUST feel immediate, with no perceptible rendering delay introduced by the redesign.

**Panelized Application Details body**

- **FR-024**: The Application Details body MUST be organized into five collapsible panels in this order: Overview → Skills → Compatibility → Timeline → Notes & Links. The same panel structure MUST apply in all render variants (desktop pane, tablet modal, mobile bottom sheet).
- **FR-025**: Each panel MUST be collapsible via its header (activatable by click and by Enter/Space) and expose an accessible expanded/collapsed state. On open, only the Overview panel MUST be expanded; the other four MUST start collapsed, each showing a one-line preview of its contents.
- **FR-026**: Expanding or collapsing a panel MUST be local UI state only; it MUST NOT mark the draft dirty or cause the Save/Discard footer to appear.
- **FR-027**: Panel contents MUST be: **Overview** — Company, Recruiter, Location, Salary, Shift, Work Setup, Min Years, Responsibilities; **Skills** — Required Skills, Preferred Skills (with the existing proficiency coding and legend); **Compatibility** — the existing CompatibilityModule, unchanged; **Timeline** — the existing Timeline, unchanged; **Notes & Links** — Job Posting URL, General Notes.
- **FR-028**: Long free-text values (Responsibilities, General Notes) MUST clamp to a limited number of lines with a Show more / Show less toggle.
- **FR-029**: In archived mode the five panels MUST render read-only (no inline editors, no footer), consistent with existing archived-mode behavior.
- **FR-030**: All existing inline-edit, validation, status, compatibility, and timeline behavior MUST be preserved within the panelized body — panelization MUST change only the grouping and container of fields, not their editing semantics or business logic.

**No data/backend change**

- **FR-023**: This feature MUST NOT change the application data model, database schema, or any backend route; it is presentation and interaction only.

### Key Entities

This feature introduces no new persisted entities and changes no existing application fields. It adds only **transient UI state**:

- **Selected application** — the id of the application currently shown in the docked pane (or none). Independent of editing/draft state; not persisted to the data store. The constitution's required application fields (company name, job title, status, `lastStatusUpdate`, responsibilities) are unaffected.
- **Render variant** — derived UI state (`pane` vs `modal`/`sheet`) chosen from the viewport width. Not persisted.
- **Panel open/collapsed state** — per-panel expanded/collapsed flags (default: Overview open, others collapsed). Transient UI state, reset each time the body opens; never persisted and never part of the draft.

---

## Data Considerations

- **No schema or data changes.** No columns are added, removed, or repurposed; no migration is required; no backend route changes. Local SQLite, hosted Supabase, and demo modes are unaffected by this feature.
- **Selection is ephemeral.** The selected-application id and the chosen render variant are in-memory UI state only. They are not written to the database and need not survive a page reload (initial load is always the empty pane per FR-009).
- **Compatibility and timeline data** are read and edited through the same paths as today; the pane variant reads and writes the identical fields the modal does. No new compatibility or timeline fields are introduced (036/037/025 own those).
- **Existing required-field validation** (company name, job title, status, `lastStatusUpdate`, responsibilities) continues to run before save in the pane variant, identical to the modal — there is no separate validation path.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At ≥ 1100px, a user can open an application's full details and see the application list at the same time, with zero centered-modal opens during browsing.
- **SC-002**: A user can move from viewing one application to viewing another in a single click (when no unsaved edits exist), with no modal open/close cycle in between.
- **SC-003**: On initial desktop load, the detail pane shows the empty "Nothing open yet" state 100% of the time and never auto-selects an application.
- **SC-004**: 100% of editing operations available in the centered modal (field edits, status change, Save, Discard, quick actions, compatibility view, timeline) are available and behave identically in the docked pane.
- **SC-005**: A user with unsaved edits who clicks a different application is never silently switched away; the discard confirmation appears in 100% of dirty-switch attempts.
- **SC-006**: Filtering, sorting, paginating, or switching Active/Archived views never blanks a populated detail pane — the previously selected application stays visible until another card is clicked.
- **SC-007**: Tablet (640–1099px) and mobile (< 640px) users experience no change: the centered modal and bottom-sheet workflows pass their existing behavior with no docked pane appearing.
- **SC-008**: No application data is lost or corrupted by the redesign; all existing CRUD, status, compatibility, timeline, and archive operations continue to pass.
- **SC-009**: The Application Details body renders as five collapsible panels in the required order, with only Overview expanded by default, in the desktop pane, the tablet modal, and the mobile bottom sheet alike; expanding/collapsing never triggers the Save/Discard footer.

---

## Assumptions

- The desktop master-detail layout, the docked pane render variant, the selected-card indigo-glow treatment, and the "Nothing open yet" empty state are already specified in `docs/design/tracker.md` § *Desktop Detail Pane* and `docs/design/application_overlay.md` §3; this spec formalizes that design and the open behavioral decisions around it.
- The Application Details component already supports a `pane` vs `modal` render variant in the design; this feature treats them as two presentations of one component sharing all business logic (per the design's "single source of truth" intent).
- The normative panel order is **Overview → Skills → Compatibility → Timeline → Notes & Links** (clarified 2026-06-20). Where `application_overlay.md` §15.4 currently shows Compatibility before Skills, that doc is to be corrected to match this spec during Release Prep; this spec is authoritative for ordering.
- `application_overlay.md` §15 (Panelized body redesign) is the **normative visual/structural build target** for the panelized body (panel shells, collapse toggle, one-line previews, `ClampText`, default-open Overview-only), **except** for the panel order, which follows the clarified Skills-before-Compatibility order above. The panelization replaces the current flat `.modal-field` grid in `Modal.js` and is shared by all render variants.
- Clicking an archived card on desktop loads the existing read-only Archived mode in the pane variant (no editing footer), consistent with `application_overlay.md` §12.
- Create mode uses the same responsive surface as application details: docked pane at ≥1100px after the Add-application gate, centered modal / bottom sheet below 1100px (FR-019).
- The ~60/40 list-to-pane split and the ≥ 1100px activation threshold follow the design docs; exact pixel values and styling are an implementation/design concern, not a spec requirement.
- Application data is private and local-first; this feature introduces no external service, analytics, or tracking.
