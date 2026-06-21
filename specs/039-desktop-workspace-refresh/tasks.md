# Tasks: Desktop Workspace Refresh

**Feature**: `039-desktop-workspace-refresh` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small and ordered; `[P]` marks tasks that can run in parallel with their siblings (different files, no shared edits). Commands: `npm run test:run`, `npm run lint`. (ESLint is the style/format gate — the project has no separate `npm run format` script.)

Status legend: `[x]` done · `[ ]` pending · `[~]` skipped.

Phase dependency: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09.

**Additive rule**: every phase leaves `npm run test:run` green. Phases that change shared components (Modal body in 02, Tracker in 04–06) update the affected existing tests in the same phase.

**User-story coverage**: Phase 01–02 → **US8** (panelized body); Phase 03 → pane render variant (enables US1/US4); Phase 04 → **US1, US2**; Phase 05 → **US1, US3**; Phase 06 → **US5, US6**; Phase 07 → **US7** (+ archived). US4 (editing parity) is exercised throughout and verified in 02/03; the Browser Smoke Test (Phase 09) walks every story.

This is a **UI-only** feature: no backend, schema, migration, `createRepositories`, or data-model change (see [data-model.md](data-model.md), [contracts/api.md](contracts/api.md)). All extended component interfaces are additive with safe defaults.

## Phase summary

| Phase | Focus | Tasks | Stories |
|---|---|---|---|
| 01 | Panel primitives — `OPanel` + `ClampText` | T001–T004 | US8 (foundation) |
| 02 | Panelized overlay body (verified in the modal) | T005–T010 | US8, US4 |
| 03 | Modal `pane` render variant + `requestClose()` | T011–T013 | enables US1/US4 |
| 04 | Desktop master-detail layout + empty pane | T014–T018 | US1, US2 |
| 05 | Selection & selected-card state | T019–T023 | US1, US3 |
| 06 | Dirty-switch guard, persistence, breakpoint handoff | T024–T027 | US5, US6 |
| 07 | Archived read-only panels + tablet/mobile regression | T028–T029 | US7 |
| 08 | Release Prep | T030–T035 | — |
| 09 | Browser Smoke Test | T036 | all |

---

## Phase 01 — Panel primitives (foundational — blocks the panelized body)

**Purpose**: Build the reusable `OPanel` shell and `ClampText` primitive in isolation, with tests, before wiring them into the overlay. Nothing downstream renders panels without these.

### T001 `[x]` — Create the `OPanel` collapsible panel shell
- **Target**: `src/components/OPanel.js` (new)
- **Expected behavior**: Export `OPanel({ icon, title, tone, open, onToggle, preview, children })` returning a `<section class="panel panel--elevated">`. Header is `.panel-head.clickable` with `role="button"`, `tabIndex=0`, `aria-expanded` reflecting `open`; click and Enter/Space call `onToggle`. Left cluster = 15px line `icon` + `.panel-title` (uppercase). Right cluster = `.sec-toggle` with `.sec-chev` rotating 90° when open and label "Expand"/"Collapse". Body renders `children` when `open`, else the `preview` node. `tone === 'ai'` adds `.panel-ai`. Per design `application_overlay.md` §15.2–15.4.
- **Constraints**: Pure presentational component — no application/business logic, no `api` import. The inner `.sec-toggle` must `stopPropagation` so it doesn't double-fire with the header. No persisted state; `open` is supplied by the caller.
- **Validation/test**: T002.
- **Out of scope**: the 5 concrete panels and their content (Phase 02); collapse-state ownership (lives in `Modal.js`).

### T002 `[x]` [P] — Unit tests for `OPanel`
- **Target**: `tests/components/OPanel.test.js` (new)
- **Expected behavior**: Assert: renders `children` when `open:true` and `preview` when `open:false`; header has `role="button"` and `aria-expanded` matching `open`; click fires `onToggle`; Enter and Space fire `onToggle`; `tone:'ai'` adds `.panel-ai`; toggle label/chevron reflect state.
- **Constraints**: jsdom + Vitest; no real timers/network.
- **Validation/test**: this is the test task.
- **Out of scope**: integration with Modal.

### T003 `[x]` [P] — Create the `ClampText` line-clamp primitive
- **Target**: `src/utils/clampText.js` (new)
- **Expected behavior**: Export a factory that renders a value element clamped to `lines` (desktop) / `mlines` (mobile) with a Show more / Show less toggle. Clamp via `.clamp-text.clamped` (`-webkit-line-clamp`). Toggle renders **only when the content overflows** the clamp (measured on mount: `scrollHeight − clientHeight > 2`) or once expanded; short values show no toggle. Per design §15.5. Used for Responsibilities (`2 / 4`) and General Notes (`3 / 3`).
- **Constraints**: No business logic; takes a string + options and returns DOM. Must degrade gracefully when measurement APIs are stubbed in jsdom (treat as non-overflowing → no toggle).
- **Validation/test**: T004.
- **Out of scope**: field editing (the clamp wraps the read display only; editing remains the existing inline editors).

### T004 `[x]` [P] — Unit tests for `ClampText`
- **Target**: `tests/utils/clampText.test.js` (new)
- **Expected behavior**: Assert: clamp class applied with the configured line count; toggle absent for short/non-overflowing content; toggle present + Show more/less switches expanded state when overflow is simulated.
- **Constraints**: jsdom; simulate overflow by stubbing `scrollHeight`/`clientHeight`.
- **Validation/test**: this is the test task.
- **Out of scope**: Modal wiring.

**Checkpoint**: `npm run test:run` green. Primitives exist and are tested; no overlay change yet.

---

## Phase 02 — Panelized overlay body (verified in the existing centered modal)

**Purpose**: Replace the flat `.modal-field` grid in `Modal._renderBody()` with the 5-panel `.pbody` stack (US8), reusing every existing field-maker. Verified first in the centered modal so the pane variant (Phase 03) inherits a working body. **This phase updates existing `Modal.test.js` assertions that reference the flat layout.**

### T005 `[x]` — Add `embedded` option to `CompatibilityModule.render`
- **Target**: `src/components/CompatibilityModule.js`
- **Expected behavior**: Add an additive `embedded` option (default `false`). When `embedded:true`: render the expanded score+notes content directly (no inner wash box) and **do not** render the module's own section Expand/Collapse toggle (the host `OPanel` owns collapse); expose the existing mini-ring/verdict/summary collapsed content for the panel to use as its preview. `setDirty` wiring unchanged. Per design §15.4 "Panel 2" and [research.md D3](research.md).
- **Constraints**: Additive only — `embedded:false` preserves current standalone behavior and all existing `CompatibilityModule` tests. No scoring/notes-lifecycle change (036/037 unchanged).
- **Validation/test**: existing `tests/components/CompatibilityModule.test.js` stays green; T009 covers the embedded render inside the panel.
- **Out of scope**: compatibility scoring/notes behavior.

### T006 `[x]` [P] — Add `bare` (headerless) option to `Timeline.render`
- **Target**: `src/components/Timeline.js`
- **Expected behavior**: Add an additive `bare` option (default `false`) to `Timeline.render(draft, options)` so the field's own header is omitted when the panel header supplies the title (design §4.3). If inspection shows the existing header reads acceptably inside a panel, keep `bare` as a no-op fallback and wrap Timeline unchanged — either way the default behavior is preserved. See [research.md D4](research.md).
- **Constraints**: Additive only; existing `tests/components/Timeline.test.js` stays green. No timeline data/behavior change (025 unchanged).
- **Validation/test**: existing Timeline tests stay green; T009 covers Timeline rendered inside its panel.
- **Out of scope**: timeline entry semantics.

### T007 `[x]` — Rewrite `Modal._renderBody()` to the 5-panel `.pbody` stack
- **Target**: `src/components/Modal.js`
- **Expected behavior**: Replace the flat `.modal-body` field list with `.pbody` containing five `OPanel`s in order **Overview → Skills → Compatibility → Timeline → Notes & Links**. Compose using the **existing** field-makers (no editing-logic changes): Overview = `makeInlineText`(Company, Recruiter, Location, Salary)/`makeInlineSelect`(Shift, Work Setup)/`makeMinYearsField` grid + Responsibilities via `ClampText`; Skills = the two `makeChipEditor`s + `makeSkillLegend`; Compatibility = `createCompatibilityField` using `CompatibilityModule` `embedded:true` (tone `'ai'`); Timeline = `Timeline.render(..., { bare })`; Notes & Links = URL (`makeInlineText`) + General Notes via `ClampText`. Add module state `_panelOpen = { overview:true, skills:false, compat:false, timeline:false, notes:false }`, reset on `open()`. Each panel's `onToggle` flips its flag, re-renders that panel body, and calls **neither** `_syncFooter()` nor any draft mutation (FR-026). Keep the Create-mode fill banner/notice atop `.pbody`. Provenance markers attach to the field inside whichever panel holds it; panels containing smart-filled fields should open so markers are visible.
- **Constraints**: Inline-edit, validation, status, compatibility, and timeline behavior must be byte-for-byte preserved (FR-030) — only grouping/container changes. Collapse state is local UI state, never dirty. Field order within Overview/Skills/Notes follows the spec FR-027. Do not touch `saveDraft`, `validateDraft`, `_attemptClose`, or footer logic.
- **Validation/test**: T009, T010.
- **Out of scope**: pane variant (Phase 03); master-detail layout (Phase 04).

### T008 `[x]` [P] — Panelized body styles
- **Target**: `src/styles/main.css`
- **Expected behavior**: Add the panelized body styleset per design §15: `.pbody` (flex column, gap, `#FAF8F4` bg, internal scroll), `.panel`/`.panel--elevated` (white card, border, shadow, padding), `.panel-head`/`.panel-head-l`/`.panel-title`/`.panel-ic`, `.sec-toggle`/`.sec-chev`, panel preview containers, `.panel-ai` glow (Compatibility only), and `.clamp-text`/`.clamp-toggle`. Mobile (`< 640px`) `.pbody.compact` spacing; `.panel-grid` stays 2-col, `.skills-grid` → 1-col.
- **Constraints**: These styles are **not** breakpoint-gated to desktop — they apply in all variants (modal, sheet, pane). Place near the existing `.modal-*` rules (~lines 3673–4900). Do not remove the flat `.modal-field` rules still used elsewhere until confirmed unused.
- **Validation/test**: visual; covered by the Browser Smoke Test (Phase 09).
- **Out of scope**: pane/layout styles (Phase 03/04).

### T009 `[x]` — Update/extend Modal body tests for the panelized structure
- **Target**: `tests/components/Modal.test.js`
- **Expected behavior**: Update existing assertions that reference the flat `.modal-body`/`.modal-field` layout to the panelized structure. Add: body renders 5 panels in the required order; only Overview is expanded on open; toggling a panel does **not** set `footer.hidden = false` and `_isDirty()` stays false; Compatibility panel renders embedded (no double toggle); archived applications render panels read-only.
- **Constraints**: Keep all existing edit/save/discard/create assertions green (update selectors only where the DOM grouping changed).
- **Validation/test**: this is the test task.
- **Out of scope**: pane-variant tests (T013).

### T010 `[x]` [P] — Regression tests: required fields, URL, status/date in the panelized body
- **Target**: `tests/components/Modal.test.js`
- **Expected behavior**: Explicit constitution-required coverage rendered through the panelized body: (a) **required-field enforcement** — saving with empty Job Title / Company / Responsibilities shows the inline errors and blocks save; (b) **URL validation** — invalid Job Posting URL in Notes & Links is rejected with the existing message; (c) **status transition + date** — changing status via the header updates the badge/header and appends a timeline entry, and Save bumps `lastStatusUpdate` (date handling) — behavior unchanged from pre-panelization.
- **Constraints**: Assert against the existing `validateDraft`/`validateUrl` paths (no new validation). These fields now live in Overview (Company, Responsibilities) and Notes & Links (URL) panels — expand panels as needed in the test.
- **Validation/test**: this is the test task.
- **Out of scope**: backend validation (unchanged).

**Checkpoint**: `npm run test:run` green. The centered modal now shows the 5-panel body on all viewports; editing/validation unchanged.

---

## Phase 03 — Modal pane render variant

**Purpose**: Give `Modal` a borderless, non-modal `pane` variant mounted into a host container, plus `requestClose()`. Not yet wired into the Tracker — tested directly against `Modal`.

### T011 `[x]` — Add `variant`/`target`/`onClosed` + `requestClose()` to `Modal`
- **Target**: `src/components/Modal.js`
- **Expected behavior**: Extend `open(application, opts)` with `variant: 'modal' | 'pane'` (default `'modal'`), `target: HTMLElement` (required for `pane`), and `onClosed: () => void`. For `variant:'pane'`: mount the `panel` into `target` (no `.modal-backdrop`); do **not** set `document.body.style.overflow = 'hidden'`; do **not** attach the focus trap; do **not** hijack document-level `Esc` (field-level Esc/Cmd-S still bound); use a labelled-region role instead of `role="dialog"`/`aria-modal`. `close()` in pane mode removes the panel from `target` and invokes `onClosed`. Export `requestClose(): Promise<boolean>` as a thin wrapper over the existing `_attemptClose()` (resolves true on close/clean-or-discard, false on Keep editing). Add `Modal.requestClose` to the exported object.
- **Constraints**: Reuse ALL existing edit/draft/footer/save/discard logic — gate only mount point + window-level behaviors on `variant`. Modal-variant behavior must be unchanged. Singleton remains single-instance (one detail surface at a time).
- **Validation/test**: T013.
- **Out of scope**: Tracker wiring (Phase 04/05).

### T012 `[x]` [P] — Pane-variant styles
- **Target**: `src/styles/main.css`
- **Expected behavior**: Add `.modal-panel--pane` (or equivalent) modifier: fills its column, no centered-overlay shadow/translate, body scrolls internally; no backdrop styling. Per `tracker.md` § Desktop Detail Pane and `application_overlay.md` §3 (render variants).
- **Constraints**: Must not alter the centered `modal`/bottom-sheet appearance. Pane sizing (column width) comes from the layout in Phase 04; this task styles only the panel-in-pane chrome.
- **Validation/test**: visual; Browser Smoke Test (Phase 09).
- **Out of scope**: `.tracker-split` layout (Phase 04).

### T013 `[x]` — Tests for the pane variant
- **Target**: `tests/components/Modal.test.js`
- **Expected behavior**: With `variant:'pane', target`: assert the panel mounts inside `target`; `document.body.style.overflow` is **not** `'hidden'`; no `.modal-backdrop` exists; Tab is not trapped (focus can leave the panel). Assert `requestClose()` resolves `true` when clean and (mocking `ConfirmDialog`) `false` on "Keep editing", `true` on "Discard". Assert `onClosed` fires on pane close.
- **Constraints**: Mock `ConfirmDialog.show`. Keep modal-variant tests green.
- **Validation/test**: this is the test task.
- **Out of scope**: selection routing (Phase 05).

**Checkpoint**: `npm run test:run` green. `Modal` can render as a pane on demand; Tracker still uses the modal everywhere.

---

## Phase 04 — Desktop master-detail layout (US1, US2)

**Purpose**: Build the ≥1100px split (master list + sticky detail pane + full-width pagination + empty pane). Interim: clicking a card still opens the modal until Phase 05 rewires selection — keeps tests green.

### T014 `[x]` — Master-detail wrapper + responsive detection in `Tracker`
- **Target**: `src/pages/Tracker.js`
- **Expected behavior**: In `mount()`, build a `.tracker-split` wrapper with `.tracker-master` (hosting the existing `.card-list` + list states) and `.tracker-detail` (the pane host) when `_isDesktop`. Add module state `_isDesktop` from `window.matchMedia('(min-width: 1100px)')`, a stored `change` listener updating `_isDesktop` and relaying out, and listener teardown in `unmount()`. Below 1100px, render today's single-column layout (no `.tracker-detail`).
- **Constraints**: Do not change list loading/skeleton/error rendering — they continue inside `.tracker-master`. No selection logic yet. Clean teardown: remove the matchMedia listener and `.tracker-detail` in `unmount()`.
- **Validation/test**: T018.
- **Out of scope**: selection (Phase 05), dirty-switch (Phase 06).

### T015 `[x]` — Empty-pane placeholder
- **Target**: `src/components/EmptyPane.js` (new) and `src/pages/Tracker.js`
- **Expected behavior**: Render the "Nothing open yet" placeholder (layered-cards illustration + title + the line "Pick an application on the left and its full breakdown — compatibility, skills, timeline and notes — lands right here.", no CTA button) per `tracker.md` § Empty state. Tracker shows it in `.tracker-detail` whenever `_selectedId` is null (including initial load, FR-009). May live inline in Tracker if trivial.
- **Constraints**: No "+ New application" button (creation is in the toolbar). Desktop-only (only mounted inside `.tracker-detail`).
- **Validation/test**: T018.
- **Out of scope**: selection.

### T016 `[x]` [P] — Full-width pagination below the split
- **Target**: `src/pages/Tracker.js`
- **Expected behavior**: In desktop mode, mount the existing `Pagination` into a full-width `.split-pagination` row below both columns (not nested in the list column). Below 1100px, pagination stays where it is today.
- **Constraints**: Reuse `Pagination.render` and `onPageChange` unchanged; only the mount location differs by viewport.
- **Validation/test**: T018.
- **Out of scope**: pagination model changes (none).

### T017 `[x]` [P] — Master-detail layout styles
- **Target**: `src/styles/main.css`
- **Expected behavior**: Add `@media (min-width: 1100px)` rules: `.tracker-split` (flex row, gap 18px, padding), `.tracker-master` (~60%), `.tracker-detail` (~40%, `position: sticky`, pinned at `top: calc(--header-h + 16px)`, internal scroll), `.split-pagination` (full width), and `.empty-pane`. Per `tracker.md` § Desktop Detail Pane.
- **Constraints**: Below 1100px these rules must not apply (single-column unchanged). Pane width tokens per design (`--pane-w: 40%`).
- **Validation/test**: visual; Browser Smoke Test (Phase 09).
- **Out of scope**: selected-card glow (Phase 05).

### T018 `[x]` — Tracker layout + empty-pane tests
- **Target**: `tests/pages/Tracker.test.js`
- **Expected behavior**: With `matchMedia` mocked to ≥1100px: assert `.tracker-split` with master + detail renders, the detail shows the empty pane on load (no selection), and pagination mounts in `.split-pagination`. With `matchMedia` < 1100px: assert the single-column layout (no `.tracker-detail`). Update any existing Tracker layout assertions accordingly.
- **Constraints**: Mock `window.matchMedia` (jsdom lacks it). Keep existing Tracker list/filter tests green.
- **Validation/test**: this is the test task.
- **Out of scope**: selection behavior (Phase 05).

**Checkpoint**: `npm run test:run` green. Desktop shows the split with an empty pane; clicking a card still opens the centered modal (interim, intentional).

---

## Phase 05 — Selection & selected-card state (US1, US3)

**Purpose**: Make desktop card clicks select into the pane (no modal), with a selected-card treatment; below 1100px clicks still open the modal.

### T019 `[x]` — `selected` option on `Card.render`
- **Target**: `src/components/Card.js`
- **Expected behavior**: Add a third options arg `{ selected = false } = {}`. When `selected`, add the `card--selected` class and `aria-selected="true"`; otherwise neither. The `aria-selected` attribute is the non-color selection signal (constitution).
- **Constraints**: Additive; default unchanged. Do not alter existing card click/keyboard handlers.
- **Validation/test**: T020.
- **Out of scope**: which card is selected (Tracker owns `_selectedId`).

### T020 `[x]` [P] — Card selected-state test
- **Target**: `tests/components/Card.test.js` (new)
- **Expected behavior**: Assert `selected:true` adds `card--selected` + `aria-selected="true"`; default adds neither.
- **Constraints**: jsdom; render with a minimal application stub.
- **Validation/test**: this is the test task.
- **Out of scope**: Tracker integration.

### T021 `[x]` — Selection state + pane routing in `Tracker`
- **Target**: `src/pages/Tracker.js`
- **Expected behavior**: Add `_selectedId` (number | null). Add `selectApplication(id)`: set `_selectedId`, re-render the list so the matching visible card is `selected`, `api.getById(id)` → `Modal.open(application, { variant:'pane', target:_detailPaneEl, profile:_profile, onClosed, ...callbacks })`. In the card `onOpen` path: if `_isDesktop` call `selectApplication(id)`, else `Modal.open(..., { variant:'modal' })` (today's behavior). Pass `selected: application.id === _selectedId` from `renderPage()` to `Card.render`. `onClosed` clears `_selectedId` and shows the empty pane.
- **Constraints**: Selection state is independent of the modal draft (FR-013). Archived cards open archived (read-only) mode in the pane (reuse existing archived-mode resolution). Reuse existing Modal callbacks (`onApplicationUpdate`, `onArchiveSuccess`, etc.).
- **Validation/test**: T023.
- **Out of scope**: dirty-switch guard (Phase 06) — this phase may switch selection without the guard; Phase 06 adds it.

### T022 `[x]` [P] — Selected-card styles
- **Target**: `src/styles/main.css`
- **Expected behavior**: Add `.card--selected`: `border-color: --indigo` + soft halo `0 0 0 4px rgba(79,70,229,.06)` (design — matches resume-import card treatment).
- **Constraints**: Only applies in desktop split; must not affect non-selected cards or below-1100px layout.
- **Validation/test**: visual; Browser Smoke Test (Phase 09).
- **Out of scope**: behavior.

### T023 `[x]` — Tracker selection tests
- **Target**: `tests/pages/Tracker.test.js`
- **Expected behavior**: With `matchMedia` ≥1100px (and `Modal.open` spied/mocked): clicking a card calls `selectApplication`, sets `_selectedId`, marks that card `card--selected`/`aria-selected`, and opens `Modal` with `variant:'pane'` and the detail target. With < 1100px: clicking opens `Modal` with `variant:'modal'` (no pane). Empty pane shows again after `onClosed`.
- **Constraints**: Mock `api.getById`; spy on `Modal.open`.
- **Validation/test**: this is the test task.
- **Out of scope**: persistence/dirty-switch (Phase 06).

**Checkpoint**: `npm run test:run` green. Desktop selects into the pane; tablet/mobile still open the modal.

---

## Phase 06 — Dirty-switch guard, selection persistence & breakpoint handoff (US5, US6)

**Purpose**: Make fast switching safe (discard confirmation when dirty), keep the pane populated across list re-renders, and hand off between modal and pane across the 1100px boundary.

### T024 `[x]` — Dirty-switch guard in `selectApplication`
- **Target**: `src/pages/Tracker.js`
- **Expected behavior**: Before switching to a new application while a pane is open, `await Modal.requestClose()`; if it resolves `false` (Keep editing), abort — leave `_selectedId`, the selected card, and the pane unchanged. If `true`, proceed to select/mount the new application. Clicking the already-selected card is a no-op.
- **Constraints**: Reuse `Modal.requestClose()` (existing discard dialog/copy) — author no new dialog (FR-014). Clean pane switches immediately with no prompt (FR-015).
- **Validation/test**: T027.
- **Out of scope**: persistence (T025).

### T025 `[x]` — Selection persistence across filter/sort/page/view
- **Target**: `src/pages/Tracker.js`
- **Expected behavior**: `renderPage()` must not clear `_selectedId` or tear down the pane when the list re-renders (filter, sort, pagination, Active/Archived switch). It only re-applies `selected` to the matching visible card (if any). The pane keeps showing the previously selected application until another card is clicked or the open application is archived/closed (FR-016).
- **Constraints**: Do not auto-clear on view switch; do not auto-select. If the selected application is archived from the pane, the existing `onArchiveSuccess` path removes it and `onClosed` returns the pane to empty.
- **Validation/test**: T027.
- **Out of scope**: breakpoint handoff (T026).

### T026 `[x]` [P] — Breakpoint handoff (modal ↔ pane at 1100px)
- **Target**: `src/pages/Tracker.js`
- **Expected behavior**: In the `matchMedia` `change` handler: crossing **up** to ≥1100px while a modal is open for app X → close the modal and select X in the pane (preserve selection where feasible); crossing **down** to <1100px while the pane shows app X → tear down the pane, retain `_selectedId` but do not auto-open a modal (tap-to-open, matching today). If a dirty edit is in progress during a crossing, route through `Modal.requestClose()` first.
- **Constraints**: No data loss across the transition — honor the dirty guard. Avoid layout thrash (single relayout per crossing).
- **Validation/test**: T027.
- **Out of scope**: none.

### T027 `[x]` — Tests: dirty-switch, persistence, handoff
- **Target**: `tests/pages/Tracker.test.js`
- **Expected behavior**: (a) Dirty-switch — with `Modal.requestClose` mocked to resolve `false`, clicking another card leaves selection/pane unchanged; resolving `true` switches. (b) Persistence — with a pane open, applying a filter that drops the selected card, sorting, paging, and switching Active↔Archived all keep `_selectedId` and the pane; clicking a visible card replaces it. (c) Handoff — toggling `matchMedia` up/down performs the documented modal↔pane transition.
- **Constraints**: Mock `matchMedia`, `Modal.requestClose`, `Modal.open/close`, `api.getById`.
- **Validation/test**: this is the test task.
- **Out of scope**: archived read-only specifics (Phase 07).

**Checkpoint**: `npm run test:run` green. Switching is safe and the pane is stable across list operations.

---

## Phase 07 — Archived mode & tablet/mobile regression (US7)

**Purpose**: Confirm archived applications render read-only panels in the pane, and that the tablet modal and mobile sheet are unchanged.

### T028 `[x]` — Archived panels render read-only in the pane
- **Target**: `src/components/Modal.js`
- **Expected behavior**: Verify the panelized body honors archived mode in the pane variant: panels render with no inline editors (display-only fields, chip editors without remove/add, dropdowns as text), no Save/Discard footer, and the archived header action set (Unarchive/Close) — consistent with existing archived-mode rules (FR-029). Fix any panelization gap where an editor leaks in archived mode.
- **Constraints**: Reuse the existing `canEdit()`/`_mode === 'archived'` gating already present in the field-makers; panelization must not bypass it.
- **Validation/test**: T029.
- **Out of scope**: unarchive behavior (unchanged).

### T029 `[x]` — Archived + tablet/mobile regression tests
- **Target**: `tests/components/Modal.test.js`, `tests/pages/Tracker.test.js`
- **Expected behavior**: Modal: opening an archived application renders the 5 panels read-only with no footer and the Unarchive/Close actions. Tracker: at 640–1099px clicking a card opens the centered modal (backdrop present, body scroll locked) with the panelized body and no `.tracker-detail`; at <640px the bottom-sheet path is used. Assert the master-detail split does not engage below 1100px.
- **Constraints**: Mock `matchMedia` for the tablet/mobile cases.
- **Validation/test**: this is the test task.
- **Out of scope**: visual styling (Browser Smoke Test).

**Checkpoint**: `npm run test:run` green. Full feature behavior implemented and unit/component-tested across all three breakpoints.

---

## Phase 08 — Release Prep

**Purpose**: Land version, changelog, and docs in the same state the operator will smoke-test (constitution Amendment 1.3.0). No env vars / runtime modes change → no `docs/deployment.md` change.

### T030 `[x]` — Version bump
- **Target**: `package.json`, `package-lock.json` (root `version`), plus any in-app version display if present
- **Expected behavior**: Bump the SemVer version (minor — new user-facing surface; next after the shipped `1.7.1`, e.g. `1.8.0`) in `package.json` and the root `version` in `package-lock.json`. Update any in-app version string if one exists.
- **Constraints**: `package.json` and `package-lock.json` root versions must match. Do not touch dependency versions.
- **Validation/test**: `npm run test:run` (no version-coupled tests should break); manual diff.
- **Out of scope**: dependency upgrades.

### T031 `[x]` [P] — CHANGELOG entry
- **Target**: `CHANGELOG.md`
- **Expected behavior**: Add an entry for this version: desktop master-detail workspace + docked detail pane; panelized Application Details body (Overview/Skills/Compatibility/Timeline/Notes & Links); empty-pane state; selection with dirty-switch guard and persistence. Note tablet/mobile unchanged.
- **Constraints**: Match the existing changelog format/heading style.
- **Validation/test**: manual.
- **Out of scope**: roadmap (T033).

### T032 `[x]` [P] — README updates
- **Target**: `README.md`
- **Expected behavior**: Document the desktop master-detail workspace and the panelized details body in the user-facing feature overview.
- **Constraints**: Only add/adjust the relevant surface; keep tone/format consistent.
- **Validation/test**: manual.
- **Out of scope**: design docs (T034).

### T033 `[x]` [P] — REPO_MAP + roadmap
- **Target**: `docs/REPO_MAP.md`, `docs/feature_roadmap.md`
- **Expected behavior**: Add the new files (`src/components/OPanel.js`, `src/utils/clampText.js`, `src/components/EmptyPane.js` if created) to `docs/REPO_MAP.md`. Tick `039-desktop-workspace-refresh` (and append the shipped version) in `docs/feature_roadmap.md`.
- **Constraints**: Match existing repo-map grouping; only add new paths.
- **Validation/test**: manual.
- **Out of scope**: none.

### T034 `[x]` — Correct design docs to the as-built panel order
- **Target**: `docs/design/application_overlay.md`, `docs/design/tracker.md`
- **Expected behavior**: Correct `application_overlay.md` §15.4 (and any other place that lists Compatibility before Skills) to the normative **Skills → Compatibility** order shipped here; reconcile the §15 "as-built" language with the now-real implementation. Sanity-check `tracker.md` § Desktop Detail Pane against the shipped layout (sticky pane, 60/40, empty state, selection glow).
- **Constraints**: Spec is authoritative for ordering (see spec Clarifications/Assumptions). Preserve history-note style used in those docs.
- **Validation/test**: manual docs review.
- **Out of scope**: behavioral change.

### T035 `[x]` — Docs sanity check
- **Target**: feature docs + touched docs
- **Expected behavior**: Verify no stale references to "centered modal on desktop", confirm no `docs/deployment.md` change is needed (no env vars / runtime modes changed), and that REPO_MAP/README/CHANGELOG/roadmap are internally consistent.
- **Constraints**: Documentation only.
- **Validation/test**: manual.
- **Out of scope**: code.

**Checkpoint**: version, changelog, and docs reflect the to-be-merged state.

---

## Phase 09 — Browser Smoke Test (final)

**Purpose**: Walk each user story's Independent Test in a real browser against the to-be-merged state (constitution requirement for UI features). Run `npm run lint` and `npm run test:run` first.

### T036 `[x]` — Browser smoke walk of all user stories
- **Target**: running app (`npm run dev`); reference [quickstart.md](quickstart.md)
- **Expected behavior**: At **≥1100px**: US1 (list + pane side-by-side, card click selects into pane, no modal), US2 (empty "Nothing open yet" on load), US3 (single-click switching, no modal churn), US4 (edit/status/compat/timeline/Save/Discard parity in the pane), US5 (dirty-switch shows discard confirmation; Keep editing vs Discard), US6 (selection persists across filter/sort/page/Active↔Archived), US8 (5 collapsible panels in order, Overview-only open, toggle ≠ dirty, Show more/less). At **640–1099px**: US7 — centered modal opens (backdrop + scroll lock), panelized body present, no pane. At **<640px**: US7 — bottom sheet opens, panelized body present. Archived: read-only panels, no footer. Verify keyboard: card selection via Enter/Space, panel toggle via Enter/Space, `aria-selected`/`aria-expanded` present.
- **Constraints**: Exercise the actual merge state. Note any deviation as a defect before merge. Record pass/fail per story.
- **Validation/test**: manual browser session across the three breakpoints.
- **Out of scope**: automated coverage (Phases 01–07).

**Checkpoint**: all user stories verified in the browser; `npm run lint` and `npm run test:run` green.
