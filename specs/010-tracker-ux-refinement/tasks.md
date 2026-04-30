# Tasks: Application Tracker UX & Data Refinement Pack

**Input**: Design documents from `/specs/010-tracker-ux-refinement/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Core validation tests are REQUIRED by the constitution — this feature touches application records (salary, fav, archived), filter persistence, status behavior, and URL handling.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on in-progress tasks)
- **[US#]**: Maps to user story from spec.md (US1–US10)
- All tasks include exact file paths

---

## Phase 1: Setup

**Purpose**: Baseline verification and new file scaffolding before any changes.

- [ ] T001 Run `npm run test:run` to record passing baseline before any modifications
- [ ] T002 [P] Create `src/utils/currency.js` with an empty `formatPeso` export stub

---

## Phase 2: Foundation — Data & Core Logic

**Purpose**: Blocking prerequisites that all user story phases depend on. No user story work begins until this phase is complete.

**⚠️ CRITICAL**: Phases 3–9 all depend on this phase completing first.

- [ ] T003 [P] Update `wishlisted` entry in `STATUS_CONFIG` in `src/models/application.js` — set `badgeBg: '#FCE7F3'`, `badgeText: '#9D174D'`, `borderAccent: '#EC4899'`
- [ ] T004 [P] Consolidate `shared/constants.js` — remove the duplicate `STATUS_COLORS` definition and import `STATUS_CONFIG` from `src/models/application.js` instead; update any consumers that reference `STATUS_COLORS` directly
- [ ] T005 [P] Implement `formatPeso(value)` in `src/utils/currency.js` — `null`/`undefined`/`0`/negative → `""`, positive integer → `"₱X,XXX"` via `toLocaleString('en-PH', { maximumFractionDigits: 0 })`
- [ ] T006 [P] Write unit tests for `formatPeso()` in `tests/utils/currency.test.js` — cover: `null` → `""`, `undefined` → `""`, `0` → `""`, `150000` → `"₱150,000"`, `50000` → `"₱50,000"`, negative integer → `""`
- [ ] T007 [P] Add `favoritesOnly: false` to `DEFAULT_FILTER_STATE` in `src/utils/filterSort.js`
- [ ] T008 [P] Implement `filterByFavorites(apps, favoritesOnly)` in `src/utils/filterSort.js` — returns all apps when `favoritesOnly` is false; filters to `app.fav === true` when true; add call inside `applyFilters()`
- [ ] T009 Write unit tests for `filterByFavorites()` in `tests/utils/filterSort.test.js` — cover: `favoritesOnly: false` returns all, `favoritesOnly: true` with no favorites returns empty, partial favorites, combined with `statuses` filter returns intersection
- [ ] T010 [P] Add server-side field normalization in the server application data layer — coerce `fav` (SQLite 0/1) to boolean; coerce `archived` (SQLite 0/1) to boolean, defaulting to `false` when absent; use `parseSalaryLower()` to convert legacy string salary to integer on read, falling back to `null` only on parse failure
- [ ] T011 [P] Add `salary` integer validation to the `PATCH /api/applications/:id` handler in `server/routes/applications.js` — reject non-integer non-null values with HTTP 400 `{ "error": "Salary must be a positive integer or null" }`
- [ ] T012 Write server-side validation tests in `tests/server/validation.test.js` — PATCH with string salary returns 400; PATCH with `fav: null` is coerced to `false` in the returned record; PATCH `{ archived: true }` returns `fav: false` in the response record
- [ ] T013 [P] Check DB schema in `server/db.js` or the migration setup — if the `archived` column does not exist on the `applications` table, add an `ALTER TABLE` migration with `DEFAULT 0`; ensure this runs before seed and API handler
- [ ] T014 [P] Convert all salary string values to integer literals in `server/db-seed.js` using `parseSalaryLower()` (e.g. `"$120,000 – $140,000"` → `120000`); set to `null` only where parsing fails
- [ ] T015 [P] Update client-side seed in `src/main.js` — convert any salary string values to integers

**Checkpoint**: Foundation ready — `formatPeso()` implemented and tested, STATUS_CONFIG updated and consolidated, `filterByFavorites()` tested, server normalization in place, `archived` column exists, seed data uses numeric salary. All user story phases can now begin.

---

## Phase 3: US1 — Consistent Status Colors Across All Surfaces (Priority: P1) 🎯 MVP

**Goal**: Every application status renders the same visually distinct color on cards, overlay headers, and status selectors. Wishlist is pink.

**Independent Test**: Open the tracker with applications across all 9 statuses. Verify Wishlist shows pink on the card badge, the overlay header, and the status selector. Verify no two statuses share a badge background color.

- [ ] T016 [P] [US1] Verify `Card.js` status badge applies `STATUS_CONFIG[status].badgeBg` and `badgeText` as inline styles — update if hardcoded colors exist
- [ ] T017 [P] [US1] Verify `src/components/StatusDropdown.js` renders each option with `STATUS_CONFIG[status].badgeBg` and `borderAccent` — update any hardcoded color references
- [ ] T018 [P] [US1] Verify `QuickFiltersToolbar.js` / `FilterPanel.js` status filter chips/options read colors from `STATUS_CONFIG` — update hardcoded values
- [ ] T019 [US1] Add assertions in `tests/models/application.test.js` — `STATUS_CONFIG.wishlisted.badgeBg === '#FCE7F3'`; all 9 `badgeBg` values are unique strings
- [ ] T020 [US1] Run `npm run test:run`; visually verify Wishlist renders pink on card badge, overlay header area, and status selector option

**Checkpoint**: US1 complete — all 9 statuses are visually distinct, Wishlist is pink everywhere.

---

## Phase 4: US2 + US6 — Overlay Quick Actions & Copy Link (Priority: P2 / P6)

**Goal (US2)**: Application overlay shows a status-colored header and inline quick actions — Favorite toggle, Change Status (dropdown), Archive (browser confirm dialog) — all without opening additional modals.

**Goal (US6)**: Clicking the job link field copies the URL to clipboard with a toast confirmation. Empty URL renders the field disabled with reduced opacity.

**Independent Test**: Open any application overlay. Confirm the header background matches the status color. Toggle favorite, change status via dropdown, and archive (confirm dialog). Confirm all actions complete inline. Click the link field; confirm toast appears and clipboard holds the URL.

- [ ] T021 [US2] Update `src/components/Modal.js` overlay header — set `background-color` from `STATUS_CONFIG[status].borderAccent`; add a contrast helper that applies a dark or light text class based on the hex luminance of `borderAccent`
- [ ] T022 [US2] Add Favorite quick action button in `src/components/Modal.js` — star icon (filled/outline), on click calls `PATCH /api/applications/:id { fav: !current }` via `src/services/api.js`; update icon fill state on response
- [ ] T023 [US2] Add Change Status quick action in `src/components/Modal.js` — reuse `StatusDropdown` component; on selection calls `PATCH /api/applications/:id { status }`; update header color reactively without closing overlay
- [ ] T024 [US2] Add Archive quick action in `src/components/Modal.js` — on click call `window.confirm('Archive this application?')`; if confirmed call `PATCH /api/applications/:id { archived: true, fav: false }`; on success close overlay and remove card from active list; on API failure show error toast and leave overlay open
- [ ] T025 [US2] Enforce quick action render order in `src/components/Modal.js` — Favorite → Change Status → Archive, left to right
- [ ] T026 [P] [US2] Write unit test for the contrast helper function in `tests/components/modal.test.js` — given `borderAccent` hex values from all 9 `STATUS_CONFIG` entries, assert the helper returns a class meeting WCAG 2.1 AA contrast (≥4.5:1 for normal text)
- [ ] T027 [P] [US2] Write behavioral test for the archive action in `tests/components/modal.test.js` — confirm dialog cancel leaves overlay open and no PATCH is called; confirm dialog acceptance calls `PATCH { archived: true, fav: false }`
- [ ] T028 [US6] Make `job_posting_url` field in `src/components/Modal.js` clickable when non-empty — on click call `navigator.clipboard.writeText(url)` then `Toast.show('Link copied', 'success')`
- [ ] T029 [US6] Apply `opacity: 0.4` and `pointer-events: none` to link field container in `src/components/Modal.js` when `job_posting_url` is `null` or empty string
- [ ] T030 [P] [US6] Replace emoji copy icon in `src/components/Card.js` with inline SVG clipboard icon (16×16) matching the style of existing SVG icons in the project
- [ ] T031 [US6] Apply the same SVG clipboard icon to the copy affordance in `src/components/Modal.js`
- [ ] T032 [US6] Add clipboard API failure handler in `src/components/Modal.js` — wrap `navigator.clipboard.writeText()` in try/catch; on failure show `Toast('Could not copy link', 'error')`
- [ ] T033 [US2] Confirm `src/pages/Tracker.js` re-renders the affected card with updated `fav`, `status`, and `archived` state after overlay quick actions complete
- [ ] T034 Run `npm run test:run` — no regressions from Modal or Card changes
- [ ] T035 Manual smoke test — overlay header color matches status; favorite toggles on click; status change updates header color inline; archive confirm dialog appears and on confirm card is removed; link copy shows confirmation toast; disabled link is muted and unclickable

**Checkpoint**: US2 + US6 complete — overlay has status-colored header, all three quick actions work inline, link copies with feedback, empty link is disabled.

---

## Phase 5: US3 — Favorites Filter & Composable Filtering (Priority: P3)

**Goal**: A "Favorites only" toggle in quick filters composes with all other active filters. Full filter state persists across page reloads.

**Independent Test**: Mark two applications as favorites. Enable "Favorites only" + a status filter. Confirm only matching applications show. Reload; confirm filter state is restored exactly.

- [ ] T036 [US3] Add "Favorites only" toggle button to `src/components/QuickFiltersToolbar.js` — active/inactive visual states bound to `filterState.favoritesOnly`
- [ ] T037 [US3] Wire favorites toggle in `src/pages/Tracker.js` — toggle updates `filterState.favoritesOnly`, triggers `applyFilters()`, and re-renders the card list
- [ ] T038 [US3] Implement filter state persistence in `src/pages/Tracker.js` — on every `filterState` mutation write to `localStorage` key `'apptracker_filters'`; on page mount read, validate (coerce `favoritesOnly` to boolean, discard unknown status keys), and restore; if localStorage is unavailable fall back to defaults silently
- [ ] T039 [P] [US3] Add composability test in `tests/utils/filterSort.test.js` — `applyFilters()` with `statuses: ['applied'], favoritesOnly: true` returns only records matching both conditions
- [ ] T040 [P] [US3] Add localStorage validation edge case tests — unknown `statuses` keys are discarded on load; corrupted `favoritesOnly` value coerces to `false`; `salaryMin > salaryMax` resets both to `null`
- [ ] T041 [US3] Manual verify — favorites filter + status filter shows correct intersection; reload restores both filter states; unfavoriting an app while filter active removes it immediately; no favorites active shows empty state

**Checkpoint**: US3 complete — favorites filter works, composes with other filters, and persists across reloads.

---

## Phase 6: US4 — Salary in Philippine Peso (Priority: P4)

**Goal**: All salary values display as `₱150,000` (no decimals). Salary filter range spans ₱50,000 to ₱250,000+.

**Independent Test**: Open an application with a salary value; confirm it shows `₱[amount]`. Open the salary filter slider; confirm bounds are ₱50,000 and ₱250,000+.

- [ ] T042 [P] [US4] Update salary display in `src/components/Card.js` — call `formatPeso(application.salary)` from `src/utils/currency.js`; remove any prior string rendering logic
- [ ] T043 [P] [US4] Update salary display in `src/components/Modal.js` — call `formatPeso(application.salary)`; remove any prior string rendering logic
- [ ] T044 [P] [US4] Update salary filter slider in `src/components/QuickFiltersToolbar.js` — set slider `min = 50000`, `max = 250000`; render tick/label values through `formatPeso()`; display max as `₱250,000+`
- [ ] T045 [P] [US4] Simplify salary parsing in `src/utils/filterSort.js` — remove `parseSalaryLower()` / `parseSalaryRange()` string-parsing branches now that salary is always a numeric integer; treat salary as integer directly in `filterBySalary()` and `getSalaryBounds()`
- [ ] T046 [P] [US4] Add `filterBySalary()` edge case tests in `tests/utils/filterSort.test.js` — null salary is always included when no minimum is set; salary=0 is treated as absent (included regardless of filter range); values ≥250,000 are captured by the ₱250,000+ bucket
- [ ] T047 [US4] Run `tests/utils/currency.test.js` and `tests/utils/filterSort.test.js` — all pass
- [ ] T048 [US4] Visual check — salary shows as `₱150,000` (no decimal) on cards, modal, and filter slider labels; null/zero salary renders as empty/hidden

**Checkpoint**: US4 complete — salary always renders ₱ formatted with no decimals; filter range is ₱50k–₱250k+.

---

## Phase 7: US5 — Mobile FAB & Subheader Layout (Priority: P5)

**Goal**: On mobile viewports (≤768px), a FAB appears at bottom-right and the subheader "New Application" button is hidden. The subheader is a single row on mobile with title left and filter icons right.

**Independent Test**: Open tracker at 375px viewport. Confirm FAB is visible at bottom-right. Tap FAB; confirm new application flow opens. Confirm subheader is one row with no wrapping. At desktop width, confirm FAB is hidden and existing button is visible.

- [ ] T049 [P] [US5] Add FAB `<button>` to `src/pages/Tracker.js` markup — class `.fab`, `aria-label="New application"`, same new-application click handler as the existing subheader button
- [ ] T050 [P] [US5] Add `.fab` base styles in `src/styles/main.css` — `position: fixed; bottom: calc(1.5rem + env(safe-area-inset-bottom)); right: 1.5rem; z-index: 200; display: none; border-radius: 50%; width: 56px; height: 56px`
- [ ] T051 [US5] Add `@media (max-width: 768px)` rule in `src/styles/main.css` — `display: flex` on `.fab`; `display: none` on the subheader `.new-app-btn`
- [ ] T052 [US5] Refactor subheader markup in `src/pages/Tracker.js` — wrap content in a flex row: left div (title/context), right div (quick filter icon buttons)
- [ ] T053 [US5] Add mobile subheader CSS in `src/styles/main.css` inside `@media (max-width: 768px)` — `flex-direction: row; align-items: center; justify-content: space-between` on the subheader container
- [ ] T054 [US5] Responsive test at 375px, 414px, 768px — FAB visible at bottom-right, safe area padding present, no content overlapped; desktop at 1280px — FAB hidden, existing button visible
- [ ] T055 [US5] Confirm FAB `z-index` does not cover the overlay (`Modal.js`) — verify overlay appears above FAB when open

**Checkpoint**: US5 complete — FAB visible on mobile, does not obstruct content, subheader is single-row on mobile.

---

## Phase 8: US7 — Subheader/Nav Consistency, Slider Fix & Icon Polish (Priority: P7)

**Goal**: Subheader matches navbar styling across all views. Both sliders are label-overlap free at all positions. All action icons use SVG from the existing icon set at 16px with hover states — no emoji.

**Independent Test**: Navigate Tracker, Edit Profile, Edit Application — subheader and navbar match. Drag each slider end-to-end — labels never overlap. Inspect all icons — SVG, 16px, hover feedback, no emoji.

- [ ] T056 [P] [US7] Identify `.navbar` `background-color` and `box-shadow` CSS values in `src/styles/main.css`
- [ ] T057 [US7] Update `.subheader` styles in `src/styles/main.css` — set `background-color` and `box-shadow` to match `.navbar` values (use CSS custom properties if already defined, otherwise copy values directly)
- [ ] T058 [P] [US7] Apply the updated subheader style class/variables to the overlay subheader element in `src/pages/ProfileEdit.js`
- [ ] T059 [P] [US7] Track active drag thumb in `src/components/RangeSlider.js` — `mousedown` / `touchstart` on each thumb sets an `activeThumb` index; `mouseup` / `touchend` clears it
- [ ] T060 [US7] Update label rendering in `src/components/RangeSlider.js` — during drag show only the active thumb's value label; at rest show both labels when pixel distance between thumb positions ≥ 40px, otherwise show only the max-value label
- [ ] T061 [P] [US7] Audit `src/components/Card.js`, `src/components/Modal.js`, `src/components/QuickFiltersToolbar.js` — replace any remaining emoji characters used as icons with inline SVG equivalents from the existing icon set
- [ ] T062 [US7] Normalize action icon sizing in `src/styles/main.css` — add `.icon` or equivalent selector enforcing `width: 16px; height: 16px; flex-shrink: 0`
- [ ] T063 [US7] Add hover/focus transitions for action icons in `src/styles/main.css` — `opacity` or `color` transition (e.g. `transition: opacity 0.15s ease`) on `.btn-icon:hover .icon` or equivalent
- [ ] T064 [US7] Test compatibility slider across full range (0–100) — drag from min to max and confirm no label overlap at any position
- [ ] T065 [US7] Test salary slider across full range (₱50,000–₱250,000+) — drag from min to max and confirm ₱ labels never overlap
- [ ] T066 [US7] Visual audit — subheader and navbar have identical background and shadow on Tracker, ProfileEdit, and modal overlay subheader; all action icons are 16px, have hover feedback, and no emoji characters remain

**Checkpoint**: US7 complete — subheader visually matches navbar everywhere; both sliders are label-overlap free; all icons are SVG, 16px, with hover states.

---

## Phase 9: US10 — Seed Data Improvement (Priority: P10)

**Goal**: All job description seed entries use distinct tone, seniority signals, and tooling references across ≥3 industry contexts. No two entries share sentence patterns.

**Independent Test**: Run seed, then review all entries — confirm at least corporate, startup, and fintech tones represented; no two descriptions open with the same sentence structure.

- [ ] T067 [US10] Rewrite all `responsibilities` values in `server/db-seed.js` — ensure ≥3 distinct tones (e.g. corporate, startup, fintech), varied seniority language (IC, senior, lead signals), distinct tech/tooling per entry, no repeated sentence openers
- [ ] T068 [P] [US10] Update client-side seed in `src/main.js` — reduce to 2–3 representative entries with integer salary and diverse responsibilities matching the new seed style
- [ ] T069 [US10] Run `node server/db-seed.js` — confirm seed completes without errors
- [ ] T070 [US10] Visually inspect 5 seeded records in the UI — confirm no two `responsibilities` fields share sentence structure or domain vocabulary

**Checkpoint**: US10 complete — seed data loads cleanly with realistic, varied job descriptions.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, accessibility, constitution compliance, and edge cases.

- [ ] T071 [P] Run `npm run test:run` — full test suite passes with no regressions
- [ ] T072 [P] Run `npm run lint` (if configured) — no new lint errors introduced by this feature
- [ ] T073 [P] Constitution compliance check — confirm: no external API calls added; FAB has `aria-label`; clipboard failure shows user-facing toast; status communicated via label text not color only; keyboard navigation works for FAB (`Tab`) and overlay actions (`Enter`/`Space`)
- [ ] T074 [P] Cross-device smoke — desktop 1280px: no FAB, overlay colors correct, subheader matches navbar; mobile 375px: FAB at bottom-right, subheader single row, no overflow or horizontal scroll
- [ ] T075 [P] Edge case — enable "Favorites only" filter with zero favorited records; confirm empty state is shown (not a blank or broken UI)
- [ ] T076 [P] Edge case — archive an application: click Cancel in confirm dialog and verify overlay stays open with no PATCH called; click OK and verify card disappears from active list and `PATCH { archived: true, fav: false }` was called
- [ ] T077 [P] Edge case — open overlay for an application with no `job_posting_url`; confirm link field has reduced opacity, does not respond to clicks, and no clipboard error is thrown
- [ ] T078 [P] Edge case — simulate API failure during archive PATCH (mock 500 response); confirm UI state is unchanged (application remains visible) and an error toast is shown
- [ ] T079 [P] Edge case — confirm archived applications do not appear in the default list view; note that UI access to archived items is deferred to a future feature scope (not in this release)
- [ ] T080 Final verification — confirm all 12 success criteria in `specs/010-tracker-ux-refinement/spec.md` (SC-001 through SC-012) are met

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phases 3–9 (User Stories)**: All depend on Phase 2 completion; can proceed in priority order or in parallel if capacity allows
- **Phase 10 (Polish)**: Depends on all desired user story phases completing

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on other user stories
- **US2 + US6 (P2/P6)**: Depends on Phase 2 (STATUS_CONFIG, formatPeso); no dependency on US1
- **US3 (P3)**: Depends on Phase 2 (`filterByFavorites` in place); no dependency on US1/US2
- **US4 (P4)**: Depends on Phase 2 (`formatPeso` implemented); no dependency on other stories
- **US5 (P5)**: Depends on Phase 2 only; CSS-only change with no cross-story dependencies
- **US7 (P7)**: Depends on Phase 2; subheader and icon changes may touch same CSS as US5 — coordinate if running in parallel
- **US10 (P10)**: Depends on Phase 2 (integer salary in seed); otherwise independent

### Within Each Phase

- Tasks marked `[P]` within the same phase operate on different files and can run concurrently
- Unnumbered sequential tasks within a phase depend on the preceding task completing first
- Multiple tasks touching the same file (e.g. `main.css` in Phase 8) must run sequentially regardless of `[P]` on their predecessors

### Parallel Opportunities

```bash
# Phase 2 — all [P] tasks operate on different files:
T003  # src/models/application.js
T004  # shared/constants.js
T005  # src/utils/currency.js
T006  # tests/utils/currency.test.js
T007  # src/utils/filterSort.js
T010  # server data layer
T011  # server/routes/applications.js
T013  # server/db.js (migration)
T014  # server/db-seed.js
T015  # src/main.js

# Phase 4 — test files and Card.js can run in parallel with the Modal.js chain:
T026  # tests/ — contrast helper test (parallel with T021–T025 Modal.js chain)
T027  # tests/ — archive confirm test (parallel with Modal.js chain)
T030  # Card.js — SVG clipboard icon (parallel with Modal.js chain)
```

---

## Implementation Strategy

### MVP First (US1 only — fastest visual signal)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundation (**required before anything else**)
3. Complete Phase 3: US1 (Status Colors)
4. **STOP and VALIDATE**: Wishlist is pink, all status colors consistent
5. Continue to Phase 4+ incrementally

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 (US1) → Status colors fixed and validated
3. Phase 4 (US2 + US6) → Overlay fully functional
4. Phase 5 (US3) → Favorites filter live
5. Phase 6 (US4) → Salary standardized
6. Phase 7 (US5) → Mobile experience improved
7. Phase 8 (US7) → Visual consistency, slider fix, and icon polish
8. Phase 9 (US10) → Seed data refreshed
9. Phase 10 → Final polish and QA sign-off

---

## Notes

- `[P]` tasks operate on different files with no shared in-progress dependencies — safe to parallelize within the same phase
- `[US#]` label maps each task to its user story for traceability against spec.md
- Constitution tests (`T006`, `T009`, `T012`, `T019`, `T039`) must pass before the feature is considered complete
- Commit after each phase checkpoint at minimum; more frequent commits encouraged
- Slider fix tasks (`T059`–`T060`) touch only `RangeSlider.js` and can be done independently of all other UI phases
- Salary display tasks (`T042`, `T043`) require Phase 2 complete (`formatPeso` available)
- Archive uses `window.confirm` — no Toast undo extension required; `PATCH { archived: true, fav: false }` is sent on confirmation only
