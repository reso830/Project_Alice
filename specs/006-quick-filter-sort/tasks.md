# Tasks: Quick Filters and Sort

**Input**: Design documents from `/specs/006-quick-filter-sort/`  
**Branch**: `006-quick-filter-sort`  
**Tech stack**: JavaScript ES Modules, vanilla DOM components, Vitest + jsdom

**Tests**: Filter, sort, and dynamic option derivation logic are constitutional validation concerns and MUST have automated tests. UI-level tests are included for toolbar render correctness and callback wiring.

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different logical blocks, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Confirm paths and design tokens before writing any new files

- [X] T001 Locate the project CSS stylesheet — find the file linked in `index.html` (or equivalent entry point) that styles `.toolbar`, `.card-list`, and `.empty-state`; note the path for use in all CSS tasks below (`src/styles/main.css`, imported by `src/main.js`)
- [X] T002 Verify the CSS custom properties referenced in `design/quickfilter_sort.md §10` exist in the stylesheet found in T001: `--color-accent`, `--color-border`, `--color-accent-light`, `--color-accent-tint`, `--color-danger`, `--color-danger-bg`, `--color-bg-dark`, `--font-ui`, `--font-mono`; add any missing ones

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the pure logic layer (`filterSort.js`) and update the `Tracker.js` render pipeline. No UI yet. Must be complete before any user story phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### filterSort.js — state shapes and constants

- [ ] T003 Create `src/utils/filterSort.js`; export `DEFAULT_FILTER_STATE = { statuses: [], companies: [], salaryMin: null, salaryMax: null, compatMin: null, compatMax: null }`, `DEFAULT_SORT_STATE = { field: 'id', direction: 'asc' }`, and `SALARY_STEP = 1000`

### filterSort.js — salary parsing

- [ ] T004 [P] Implement `parseSalaryLower(salaryStr)` in `src/utils/filterSort.js` — regex-extracts the first dollar amount, handles `$Xk` and `$X,000` formats, returns `null` for empty or unrecognized strings
- [ ] T005 [P] Implement `parseSalaryRange(salaryStr)` in `src/utils/filterSort.js` — splits on `'-'`, parses both bounds using `parseSalaryLower`; returns `{ min, max }` or `null` when lower bound fails
- [ ] T006 [P] Implement `getSalaryBounds(apps)` in `src/utils/filterSort.js` — scans all apps using `parseSalaryRange`, finds overall min (lower bounds) and max (upper bounds), rounds each to nearest `$1k`; returns `{ min: 0, max: 200_000, hasSalaryData: false }` when no parseable salary data exists; returns `{ min, max, hasSalaryData: true }` when at least one app has a parseable salary

### filterSort.js — filter helpers

- [ ] T007 Implement `filterByStatus(apps, statuses)` in `src/utils/filterSort.js` — returns `apps` unchanged when `statuses` is empty; otherwise returns apps whose `status` is in the `statuses` array
- [ ] T008 [P] Implement `filterByCompany(apps, companies)` in `src/utils/filterSort.js` — returns `apps` unchanged when `companies` is empty; otherwise filters by `companyName` inclusion
- [ ] T009 [P] Implement `filterBySalary(apps, min, max)` in `src/utils/filterSort.js` — returns `apps` unchanged when both `min` and `max` are `null`; when active, excludes apps whose salary string is empty or unparseable; uses overlap semantics: includes apps where `parseSalaryRange(a.salary).min <= max && parseSalaryRange(a.salary).max >= min` (an app whose salary range partially overlaps the filter range is included)
- [ ] T010 [P] Implement `filterByCompat(apps, min, max)` in `src/utils/filterSort.js` — returns `apps` unchanged when both bounds are `null`; otherwise includes only apps where `app.compat >= min && app.compat <= max`
- [ ] T011 Implement `applyFilters(apps, filterState)` in `src/utils/filterSort.js` — chains `filterByStatus → filterByCompany → filterBySalary → filterByCompat` in sequence (AND logic); depends on T007–T010
- [ ] T012 [P] Implement `isAnyFilterActive(filterState)` in `src/utils/filterSort.js` — returns `true` if `statuses.length > 0`, `companies.length > 0`, or any range bound is non-null

### filterSort.js — dynamic option helpers

- [ ] T013 Implement `getAvailableStatuses(apps, filterState)` in `src/utils/filterSort.js` — applies all filters EXCEPT status (`filterByCompany + filterBySalary + filterByCompat`), collects unique `status` values from the result, returns them ordered by `STATUS_VALUES` array position (import from `shared/constants.js`); depends on T008–T010
- [ ] T014 [P] Implement `getAvailableCompanies(apps, filterState)` in `src/utils/filterSort.js` — applies all filters EXCEPT company, collects unique `companyName` values, returns them sorted alphabetically via `localeCompare`
- [ ] T015 Implement `syncDynamicSelections(filterState, apps)` in `src/utils/filterSort.js` — calls `getAvailableStatuses` and `getAvailableCompanies`, intersects current `statuses`/`companies` selections with available options; returns the same object reference if nothing changed, otherwise returns a new object with pruned selections; depends on T013, T014

### filterSort.js — sort helpers

- [ ] T016 Implement `sortApplications(apps, sortState)` in `src/utils/filterSort.js` — supports `field` values `'id'` (numeric), `'status'` (`STATUS_VALUES.indexOf()`), `'compat'` (numeric), `'salary'` (`parseSalaryLower() ?? Infinity`, nulls sort last ascending / first descending), `'companyName'` (`localeCompare`); direction `'asc'`/`'desc'`; tie-break always on `id` ascending for stability; depends on T004
- [ ] T017 [P] Implement `isDefaultSort(sortState)` in `src/utils/filterSort.js` — returns `true` only when `field === 'id' && direction === 'asc'`

### filterSort.test.js — unit tests

- [ ] T018 Create `tests/utils/filterSort.test.js` with a reusable fixture dataset: ≥8 apps covering all `STATUS_VALUES`, multiple companies, valid salary strings (`"$110k-$130k"`, `"$95k-$115k"`), apps with empty salary, compat scores across 0–100 range; import all functions from `src/utils/filterSort.js`
- [ ] T019 [P] Add salary parser tests to `tests/utils/filterSort.test.js` — `parseSalaryLower`: `"$110k-$130k"` → 110000, `"$95,000-$115,000"` → 95000, `""` → null, `"competitive"` → null; `parseSalaryRange`: valid string → `{min, max}`, single-value `"$120k"` → `{min: 120000, max: 120000}`, `"$120k+"` → `{min: 120000, max: 120000}`; `getSalaryBounds`: verify rounding, fallback `{min: 0, max: 200_000, hasSalaryData: false}` when no parseable data, `hasSalaryData: true` when at least one app has salary
- [ ] T020 [P] Add filter function tests to `tests/utils/filterSort.test.js` — `filterByStatus`: empty → no-op, single match, multi-value OR, no match; `filterByCompany`: empty → no-op, match, no match; `filterBySalary`: null range → no-op, salary fully within filter range → included, salary overlapping filter min edge (app upper > filter max) → included, salary overlapping filter max edge (app lower < filter min) → included, no overlap → excluded, null salary excluded when filter active; `filterByCompat`: null range → no-op, boundary values
- [ ] T021 [P] Add `applyFilters` AND-logic tests to `tests/utils/filterSort.test.js` — status + company both active narrows correctly; status + salary active further narrows; `DEFAULT_FILTER_STATE` → all apps returned
- [ ] T022 [P] Add `isAnyFilterActive` tests to `tests/utils/filterSort.test.js` — `DEFAULT_FILTER_STATE` → false; non-empty `statuses` → true; non-null `salaryMin` → true; non-null `compatMax` → true
- [ ] T023 [P] Add dynamic option tests to `tests/utils/filterSort.test.js` — `getAvailableStatuses`: with salary filter active, returns only statuses present in salary-filtered results; selected status NOT excluded from its own option list; order matches `STATUS_VALUES`; `getAvailableCompanies`: alphabetical; selected company not self-excluded
- [ ] T024 [P] Add `syncDynamicSelections` tests to `tests/utils/filterSort.test.js` — selected status becomes unavailable after salary filter → removed from state; available selections preserved; returns same object reference when nothing changed
- [ ] T025 [P] Add `sortApplications` tests to `tests/utils/filterSort.test.js` — each of the 5 sort fields tested asc and desc; salary sort uses lower bound; apps with null salary sort last when ascending (after all apps with salary data) and first when descending; status sort follows `STATUS_VALUES` order; tie-break preserves id-ascending stability; `isDefaultSort`: default → true, non-default field → false, non-default direction → false

### Tracker.js — pipeline integration

- [ ] T026 Add four module-level variables to `src/pages/Tracker.js`: `let _filterState = { ...DEFAULT_FILTER_STATE }`, `let _sortState = { ...DEFAULT_SORT_STATE }`, `let _salaryBounds = { min: 0, max: 200_000, hasSalaryData: false }`, `let _toolbarEl = null`; import `DEFAULT_FILTER_STATE`, `DEFAULT_SORT_STATE` from `src/utils/filterSort.js`; note: `_sortState` is module-level and intentionally persists across mount/unmount cycles (SPA-session persistence per FR-039)
- [ ] T027 Update `clampCurrentPage()` in `src/pages/Tracker.js` to accept a `filteredCount` parameter and act as a pure clamp — `clampCurrentPage(filteredCount)`: `const maxPage = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE)); _currentPage = Math.min(_currentPage, maxPage)`; this never unconditionally resets to 1; callers (`onFilterChange`, `onSortChange`, `onClearAll`) set `_currentPage = 1` explicitly before calling `renderPage()`
- [ ] T028 Update `renderPage()` in `src/pages/Tracker.js` to run the derived pipeline: `const filteredApps = applyFilters(_applications, _filterState)`, `const sortedApps = sortApplications(filteredApps, _sortState)`, call `clampCurrentPage(sortedApps.length)`, paginate on `sortedApps`; the existing `Toolbar.updateCount()` call temporarily uses `filteredApps.length` until Phase 3 replaces the toolbar
- [ ] T029 Add `renderFilterEmptyState()` to `src/pages/Tracker.js` — creates `div.empty-state.empty-state--filter`; `innerHTML = 'No applications match<br>the active filters.'`; update `renderPage()` branching so when `sortedApps.length === 0 && isAnyFilterActive(_filterState)` → append filter empty state instead of card list (existing "No applications yet" state remains for the zero-apps-no-filter case)

**Checkpoint**: `npx vitest run` passes all tests. With default filter/sort state, the app renders identically to before this phase. Manually verifiable: list loads, pagination works, no regressions.

---

## Phase 3: User Story 1 — Filter by Status and Company (Priority: P1) 🎯 MVP

**Goal**: Users can open a Status or Company filter, select values, and see the list immediately narrow; toolbar shows "Results (X)"; dynamic options update; unavailable selections auto-clear.

**Independent Test**: Open the app → click Status filter button → select "Applied" → confirm only Applied applications appear and toolbar reads "Results (X)". Then select a Company → confirm AND logic further narrows results.

### FilterPanel component

- [ ] T030 Create `src/components/FilterPanel.js` — `FilterPanel.render(options)` returns a panel `div` with: popup header row (uppercase title label + clear ✕ button), separator, and a scrollable checklist container (`max-height: 220px; overflow-y: auto`); no options rendered yet; `onClear` callback fires on ✕ click
- [ ] T031 [P] [US1] Implement Status checklist rows in `src/components/FilterPanel.js` — for each option value: row div containing a 14×14px checkbox (`role="checkbox"`, `aria-checked`), a 7px color dot using `STATUS_CONFIG[value].badgeBg`, and the `STATUS_CONFIG[value].label` text; row click toggles selection and calls `onChange(updatedSelected)`; `getLabel` and `getDot` callbacks are accepted via options
- [ ] T032 [P] [US1] Implement Company checklist rows in `src/components/FilterPanel.js` — identical row structure to Status rows but without the color dot; option value is displayed as plain text

### QuickFiltersToolbar component

- [ ] T033 [US1] Create `src/components/QuickFiltersToolbar.js` — `QuickFiltersToolbar.render(options)` returns a `div.toolbar` containing: a label+count section (`span.toolbar__label` + `span.count-badge aria-live="polite"`), a `div.toolbar__filters` group (initially empty), and a placeholder for the add-application button; options: `{ apps, totalCount, filteredCount, filterState, sortState, salaryBounds, onFilterChange, onSortChange, onClearAll, onAddApplication }`; store `apps` as module-level `_allApps`; when `totalCount === 0`, all filter and sort buttons are rendered with `disabled` attribute and `aria-disabled="true"` from the start
- [ ] T034 [US1] Add Status and Company filter icon buttons to the `div.toolbar__filters` group in `src/components/QuickFiltersToolbar.js` — each button is 28×28px with an inline SVG icon (clock for Status, building for Company), `aria-label="Filter by Status"` / `"Filter by Company"`, `aria-pressed="false"` initially, and a `title` tooltip attribute; buttons stored as module-level refs
- [ ] T035 [US1] Implement panel open/close management in `src/components/QuickFiltersToolbar.js` — module-level `_openPanel` (DOM element or null) and `_openButton` (button element or null); opening a new panel calls `closePanel()` first; clicking the same button again toggles closed; `closePanel()` removes panel from DOM, clears refs; on panel open: attach `document` `keydown` (Escape → close, return focus to `_openButton`) and `click` (outside panel+button → close) listeners; detach on close
- [ ] T036 [US1] Wire Status filter button to open `FilterPanel` in `src/components/QuickFiltersToolbar.js` — on click: compute available statuses via `getAvailableStatuses(_allApps, _filterState)`, render `FilterPanel` with `options=availableStatuses, selected=filterState.statuses, getLabel, getDot, onChange=({newSelected}) => onFilterChange({...filterState, statuses: newSelected}), onClear=() => onFilterChange({...filterState, statuses: []})`; position panel below button; update button `aria-pressed`; store `_openPanelType = 'status'`
- [ ] T037 [US1] Wire Company filter button to open `FilterPanel` in `src/components/QuickFiltersToolbar.js` — same pattern as T036 using `getAvailableCompanies` and `filterState.companies`; store `_openPanelType = 'company'`
- [ ] T038 [US1] Implement `QuickFiltersToolbar.update(el, { apps, totalCount, filteredCount, filterState, sortState })` in `src/components/QuickFiltersToolbar.js` — updates `_allApps = apps`; updates label text to `"All Applications"` (no active filters) or `"Results"` (any active); updates count badge to `filteredCount` when active or `totalCount` when inactive; sets `disabled`/`aria-disabled` on all filter and sort buttons when `totalCount === 0`, clears them otherwise; updates `aria-pressed` on Status and Company filter buttons; updates erase-all button visibility (rendered in T062); updates sort button `aria-pressed` (wired in T060); if `_openPanelType === 'status'`, re-render the open panel's checklist with `getAvailableStatuses(_allApps, filterState)`; if `_openPanelType === 'company'`, re-render with `getAvailableCompanies(_allApps, filterState)`

### Tracker.js integration for US1

- [ ] T039 [US1] Add `onFilterChange(newFilterState)` and `updateToolbar()` internal functions to `src/pages/Tracker.js` — `onFilterChange`: runs `syncDynamicSelections(newFilterState, _applications)`, stores result as `_filterState`, sets `_currentPage = 1`, calls `renderPage()` and `updateToolbar()`; `updateToolbar`: calls `QuickFiltersToolbar.update(_toolbarEl, { totalCount: _applications.length, filteredCount: applyFilters(_applications, _filterState).length, filterState: _filterState, sortState: _sortState })`
- [ ] T040 [US1] Update `mount()` in `src/pages/Tracker.js` — after `api.getAll()`: compute `_salaryBounds = getSalaryBounds(_applications)`; replace `Toolbar.render(0)` with `QuickFiltersToolbar.render({ apps: _applications, totalCount: 0, filteredCount: 0, filterState: _filterState, sortState: _sortState, salaryBounds: _salaryBounds, onFilterChange, onSortChange: () => {}, onClearAll: () => {}, onAddApplication: () => {} })`; store returned element in `_toolbarEl`; remove `Toolbar` import
- [ ] T041 [US1] Update `unmount()` in `src/pages/Tracker.js` — reset `_filterState = { ...DEFAULT_FILTER_STATE }`, `_salaryBounds = { min: 0, max: 200_000, hasSalaryData: false }`, `_toolbarEl = null`; **do NOT reset `_sortState`** — sort state must persist across SPA navigation within the browser session (FR-039); it resets naturally when the browser reloads the module on page refresh

### CSS for US1

- [ ] T042 [US1] Add toolbar layout CSS to the stylesheet found in T001 — desktop: `div.toolbar` as `display: flex; align-items: center; gap: 8px`; `span.toolbar__label` font: Sora 13px weight 500; `strong` inside label: weight 600; `div.toolbar__filters`: flex row with `gap: 4px`
- [ ] T043 [US1] Add filter icon button CSS — `.filter-btn`: `width: 28px; height: 28px; border-radius: 5px; border: 1.5px solid var(--color-border); background: #fff; color: #888; cursor: pointer`; hover: `border-color: var(--color-accent); color: var(--color-accent); background: var(--color-accent-light)`; `[aria-pressed="true"]`: `border-color: var(--color-accent); color: var(--color-accent); background: var(--color-accent-tint)`; open state (add class `filter-btn--open`): active styles + `box-shadow: 0 0 0 2px rgba(79,70,229,0.15)`; disabled state: `.filter-btn[disabled], .filter-btn[aria-disabled="true"]`: `opacity: 0.4; cursor: not-allowed; pointer-events: none; border-color: var(--color-border); background: #fff; color: #888` (overrides hover/active)
- [ ] T044 [US1] Add FilterPanel popup CSS — `.filter-panel`: `position: absolute; top: calc(100% + 8px); left: 0; background: #fff; border: 1.5px solid var(--color-border); border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.12); min-width: 220px; z-index: 500`; header: title `font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: #aaa`; separator `border-bottom: 1px solid #f0ede8`; checklist row: `height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 10px; cursor: pointer`; hover: `background: var(--color-accent-light)`; color dot: `width: 7px; height: 7px; border-radius: 50%`; checkbox: `width: 14px; height: 14px; border: 1.5px solid var(--color-border); border-radius: 3px`; checked: `background: var(--color-accent)`; trigger button parent: `position: relative`

### Tests for US1

- [ ] T045 [US1] Create `tests/components/QuickFiltersToolbar.test.js` — set up jsdom test with `QuickFiltersToolbar.render()` called with no-filter default state; assert: label text contains "All Applications", count badge shows `totalCount`, Status and Company buttons have `aria-pressed="false"`, no erase-all button in DOM
- [ ] T046 [P] [US1] Add test to `tests/components/QuickFiltersToolbar.test.js`: call `QuickFiltersToolbar.update(el, ...)` with an active status filter; assert label text changes to "Results", count badge shows `filteredCount`, Status filter button has `aria-pressed="true"`
- [ ] T047 [P] [US1] Add test to `tests/components/QuickFiltersToolbar.test.js`: simulate `onFilterChange` callback being called with a non-empty `statuses` array; assert callback was invoked with the correct updated `filterState`
- [ ] T047a [P] [US1] Add disabled-state tests to `tests/components/QuickFiltersToolbar.test.js` — render with `totalCount: 0`; assert all filter buttons and sort button have `disabled` attribute and `aria-disabled="true"`; assert erase-all button is absent; call `update(el, { totalCount: 5, ... })`; assert buttons no longer have `disabled`
- [ ] T047b [P] [US1] Add sort-persistence test to Tracker.js integration tests — call `mount()`, trigger `onSortChange({ field: 'compat', direction: 'desc' })`, call `unmount()`, call `mount()` again; assert `_sortState` is still `{ field: 'compat', direction: 'desc' }` (survives unmount/remount cycle)

**Checkpoint**: US1 independently testable — open Status filter, select a status, confirm list narrows and toolbar reads "Results (X)". Select another company, confirm AND logic applies. Deselect status — toolbar restores to "All Applications (N)".

---

## Phase 4: User Story 2 — Filter by Salary and Compatibility Range (Priority: P2)

**Goal**: Users can set a Salary or Compatibility range using a dual-range slider; list updates on release only; slider stays smooth during drag; snap-to-step on release.

**Independent Test**: Open Salary filter → drag both slider thumbs to set a range → release → confirm list shows only matching-salary applications. Drag during operation should not cause list updates.

### RangeSlider component

- [ ] T048 [US2] Create `src/components/RangeSlider.js` — `RangeSlider.render(options)` returns a container element; options: `{ min, max, valueMin, valueMax, step, formatValue, ariaLabelMin, ariaLabelMax, onCommit }`; renders: two value labels above thumbs, a track div with fill div, two thumb divs (`.range-thumb`), bound labels below track ends
- [ ] T049 [US2] Implement visual thumb positioning in `src/components/RangeSlider.js` — calculate each thumb's `left` as `((value - min) / (max - min)) * 100 + '%'`; fill between thumbs via `left` and `width` on the fill div using accent color; update value labels above thumbs on every position change
- [ ] T050 [US2] Implement drag behavior in `src/components/RangeSlider.js` — `mousedown`/`touchstart` on a thumb: set that thumb as active, attach `document`-level `mousemove`/`touchmove` listener; on move: compute new value from pointer X position within track bounds (clamped to `[min, max]`), update local `localMin`/`localMax`, reposition thumb and fill in real time, update `aria-valuenow`; do NOT call `onCommit` during drag; also add keyboard handler for desktop: thumb has `tabIndex="0"`; on `keydown`, `ArrowRight` increases that thumb's value by one `step` (enforcing min-spacing and bounds), `ArrowLeft` decreases by one step; commits immediately via `onCommit(snappedMin, snappedMax)` on each key press (no drag state involved)
- [ ] T051 [US2] Implement snap-on-release in `src/components/RangeSlider.js` — on `mouseup`/`touchend`: snap active thumb value to `Math.round(rawValue / step) * step`; enforce minimum spacing: if snapped min ≥ max then min = max − step; if snapped max ≤ min then max = min + step; call `onCommit(snappedMin, snappedMax)`; detach document listeners; reset active thumb z-index
- [ ] T052 [P] [US2] Add ARIA attributes to `RangeSlider.js` thumbs — `role="slider"`, `aria-valuemin={min}`, `aria-valuemax={max}`, `aria-valuenow={value}` (updated during drag), `aria-label` from `ariaLabelMin`/`ariaLabelMax`; thumb z-index: active thumb `z-index: 4`, idle thumb `z-index: 2`

### Salary and Compatibility filter buttons in QuickFiltersToolbar

- [ ] T053 [US2] Add Salary filter icon button and panel to `src/components/QuickFiltersToolbar.js` — bag/currency inline SVG button; when `salaryBounds.hasSalaryData` is false: render button with `disabled`, `aria-disabled="true"`, `aria-label="Filter by Salary (no salary data)"` — no panel opens on click; when `hasSalaryData` is true: `aria-label="Filter by Salary"`, `aria-pressed` reflects whether salary filter is active; on click: open panel containing `RangeSlider.render({ min: salaryBounds.min, max: salaryBounds.max, valueMin: filterState.salaryMin ?? salaryBounds.min, valueMax: filterState.salaryMax ?? salaryBounds.max, step: SALARY_STEP, formatValue: v => '$' + (v/1000) + 'k', ariaLabelMin: 'Minimum salary', ariaLabelMax: 'Maximum salary', onCommit: (min, max) => onFilterChange({...filterState, salaryMin: min === salaryBounds.min ? null : min, salaryMax: max === salaryBounds.max ? null : max}) })`; store `_openPanelType = 'salary'`; null-conversion ensures returning the slider to full extent correctly clears the filter
- [ ] T054 [P] [US2] Add Compatibility filter icon button and panel to `src/components/QuickFiltersToolbar.js` — trend/chart inline SVG button, `aria-label="Filter by Compatibility"`, `aria-pressed` reflects whether compat filter is active; panel contains `RangeSlider.render({ min: 0, max: 100, valueMin: filterState.compatMin ?? 0, valueMax: filterState.compatMax ?? 100, step: 1, formatValue: v => v + '%', ariaLabelMin: 'Minimum compatibility', ariaLabelMax: 'Maximum compatibility', onCommit: (min, max) => onFilterChange({...filterState, compatMin: min === 0 ? null : min, compatMax: max === 100 ? null : max}) })`; store `_openPanelType = 'compat'`

### CSS for US2

- [ ] T055 [US2] Add `RangeSlider` CSS — `.range-track`: `height: 4px; border-radius: 2px; background: var(--color-border); position: relative; margin: 18px 0`; `.range-fill`: `position: absolute; height: 100%; background: var(--color-accent); border-radius: 2px`; `.range-thumb`: `position: absolute; width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 2px solid var(--color-accent); box-shadow: 0 1px 4px rgba(0,0,0,0.15); cursor: grab; transform: translateX(-50%); top: -7px`; hover: `box-shadow: 0 0 0 4px rgba(79,70,229,0.12)`; active/grabbing: `cursor: grabbing; box-shadow: 0 0 0 5px rgba(79,70,229,0.18)`; value label: `position: absolute; font-family: var(--font-mono); font-size: 10px; color: #555; bottom: calc(100% + 4px); transform: translateX(-50%)`; bound labels: `display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; color: #aaa`

### Tests for US2

- [ ] T055a Create `tests/components/RangeSlider.test.js` — set up jsdom tests for `RangeSlider.render()` with a Salary configuration (`min: 0, max: 200000, step: 1000, valueMin: 50000, valueMax: 150000`); assert: two thumb elements present with correct `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label`; value labels above thumbs show formatted values; bound labels show min and max
- [ ] T055b [P] Add drag-and-release tests to `tests/components/RangeSlider.test.js` — dispatch `mousedown` on min thumb, `mousemove` to new position, assert `onCommit` NOT called during move; dispatch `mouseup`, assert `onCommit` called once with snapped value; verify snapped value = `Math.round(rawValue / step) * step`; test min-spacing enforcement: releasing min thumb at or beyond max results in `max - step`
- [ ] T055c [P] Add keyboard interaction tests to `tests/components/RangeSlider.test.js` — dispatch `keydown ArrowRight` on focused min thumb, assert `onCommit` called with `valueMin + step`; dispatch `keydown ArrowLeft`, assert `onCommit` called with `valueMin - step`; verify key navigation clamps at bounds; verify min thumb cannot step past max minus one step
- [ ] T055d [P] Add full-extent null-conversion tests to `tests/components/QuickFiltersToolbar.test.js` — simulate Salary slider `onCommit(0, 200000)` (full extent), assert `onFilterChange` called with `{ salaryMin: null, salaryMax: null }`; simulate `onCommit(50000, 200000)`, assert `{ salaryMin: 50000, salaryMax: null }`; simulate Compat `onCommit(0, 100)`, assert `{ compatMin: null, compatMax: null }`
- [ ] T055e [P] Add no-salary-data disabled test to `tests/components/QuickFiltersToolbar.test.js` — render toolbar with `salaryBounds: { min: 0, max: 200_000, hasSalaryData: false }`; assert Salary button has `disabled`, `aria-disabled="true"`, `aria-label` contains "no salary data"; assert other filter buttons are NOT disabled (when totalCount > 0)

**Checkpoint**: US2 independently testable — open Salary filter, drag thumbs, release; list updates to match salary range; slider does not trigger list re-renders during drag.

---

## Phase 5: User Story 3 — Sort the Application List (Priority: P3)

**Goal**: Users can sort the list by Job ID, Status, Compatibility, Salary, or Company in ascending or descending order. Default sort (Job ID asc) does not show the sort icon as active.

**Independent Test**: Click sort button → select "Compatibility" → select "Descending" → confirm list reorders high-to-low compat, sort icon shows active. Click "Restore default" → icon returns to inactive state.

### SortPanel component

- [ ] T056 [US3] Create `src/components/SortPanel.js` — `SortPanel.render(options)` returns a panel `div`; options: `{ sortState, onChange, onRestoreDefault }`; renders: "SORT BY" section with 5 option rows (`id`→"Job ID", `status`→"Status", `compat`→"Compatibility", `salary`→"Salary", `companyName`→"Company"), divider, "ORDER" section with "Ascending ↑" and "Descending ↓" rows, divider, "Restore default" row
- [ ] T057 [US3] Implement SortPanel selection state in `src/components/SortPanel.js` — currently selected SORT BY field and ORDER option each show `✓` prefix and `var(--color-accent)` text color, weight 500; section labels: `font-size: 8px; text-transform: uppercase; letter-spacing: 0.8px; color: #ccc`; row hover: `background: var(--color-accent-light)`; "Restore default": `color: #ccc`, hover `color: var(--color-danger)`; clicking any row calls `onChange({ field, direction })` or `onRestoreDefault`
- [ ] T058 [US3] Add sort icon button to `src/components/QuickFiltersToolbar.js` — 28×28px button positioned after filter icons group and erase-all (when visible); inline SVG sort icon; `aria-label="Sort"`; `aria-pressed` reflects `!isDefaultSort(sortState)`; on click: open `SortPanel.render({ sortState: _sortState, onChange: onSortChange, onRestoreDefault: () => { onSortChange(DEFAULT_SORT_STATE); closePanel(); } })`
- [ ] T059 [US3] Add `onSortChange(newSortState)` callback to `src/pages/Tracker.js` — updates `_sortState = newSortState`, sets `_currentPage = 1`, calls `renderPage()` and `updateToolbar()`; wire it into `QuickFiltersToolbar.render()` `onSortChange` option (update the empty stub added in T040)
- [ ] T060 [US3] Update `QuickFiltersToolbar.update()` to refresh the sort button `aria-pressed` state when `sortState` changes — `!isDefaultSort(newSortState)` → `aria-pressed="true"`, else `"false"`
- [ ] T061 [US3] Add SortPanel CSS — `.sort-panel` uses same popup container CSS as `.filter-panel` from T044; option rows: `font-size: 11px; color: #333; height: 32px`; selected option: `color: var(--color-accent); font-weight: 500`; divider rows: `border-top: 1px solid #f0ede8`

### Tests for US3

- [ ] T061a [P] Add sort-resets-page test to `tests/components/QuickFiltersToolbar.test.js` — simulate `onSortChange` being called with a non-default sort; assert that `_currentPage` is set to 1 in Tracker.js (test via calling `onSortChange` directly and verifying the rendered page index resets)
- [ ] T061b [P] Add erase-all preserves sort test to `tests/components/QuickFiltersToolbar.test.js` — set sort to `{ field: 'compat', direction: 'desc' }`; call `onClearAll()`; assert `_sortState` is still `{ field: 'compat', direction: 'desc' }` after clear

**Checkpoint**: US3 independently testable — click sort button, pick field and direction, list reorders and page resets to 1. "Restore default" resets to Job ID asc with inactive sort icon.

---

## Phase 6: User Story 4 — Clear All Filters (Priority: P4)

**Goal**: When filters are active, an erase-all button appears. Clicking it clears all filter state, resets page to 1, and restores "All Applications (N)" — while preserving the current sort.

**Independent Test**: Apply Status + Company filters → click erase-all → list shows all non-archived apps, toolbar reads "All Applications (N)", erase-all button is gone, sort is unchanged.

- [ ] T062 [US4] Add erase-all button element to `src/components/QuickFiltersToolbar.js` — `.erase-btn` (28×28px); rendered in the DOM only when `isAnyFilterActive(filterState)` is true (toggle via `hidden` attribute or conditional DOM insertion); positioned between `div.toolbar__filters` and the sort button; `aria-label="Clear all filters"`; on click: calls `onClearAll()`; store reference as `_eraseBtn`; `QuickFiltersToolbar.update()` must show/hide it based on current `filterState`
- [ ] T063 [US4] Add `onClearAll()` callback to `src/pages/Tracker.js` — resets `_filterState = { ...DEFAULT_FILTER_STATE }` (sort state is preserved), sets `_currentPage = 1`, calls `renderPage()` and `updateToolbar()`; wire it into `QuickFiltersToolbar.render()` `onClearAll` option (update the empty stub added in T040)
- [ ] T064 [US4] Add erase-all button CSS — `.erase-btn`: `border: 1.5px solid #fca5a5; background: var(--color-danger-bg); color: var(--color-danger)`; hover: `background: #fee2e2; border-color: var(--color-danger)`
- [ ] T065 [P] [US4] Add tests to `tests/components/QuickFiltersToolbar.test.js` — erase-all button not in DOM when `filterState = DEFAULT_FILTER_STATE`; erase-all button present after `update()` with active filter; clicking erase-all calls `onClearAll` once

**Checkpoint**: US4 independently testable — apply filters, verify erase-all appears, click it, verify full list is restored and erase-all disappears.

---

## Phase 7: User Story 5 — Filter Empty State (Priority: P5)

**Goal**: When active filters produce zero results, show "No applications match the active filters." instead of a blank card list.

**Independent Test**: Apply a Status filter for a status with no existing applications → empty state message appears in place of the card list → "Results (0)" in toolbar → erase-all visible.

- [ ] T066 [US5] Add `.empty-state--filter` CSS to the project stylesheet — `text-align: center; padding: 48px 20px; color: #bbbbbb; font-family: var(--font-mono); font-size: 12px; line-height: 1.8` (per `design/quickfilter_sort.md §9`)
- [ ] T067 [P] [US5] Add tests to `tests/components/QuickFiltersToolbar.test.js` — call `QuickFiltersToolbar.update(el, { totalCount: 5, filteredCount: 0, filterState: activeFilter, ... })`; assert label reads "Results", count shows "0", erase-all button is present
- [ ] T068 [P] [US5] Add test for filter empty state in Tracker context — set up app with `_applications = [fixtures]`, set `_filterState.statuses = ['nonexistent']`, call `renderPage()`; assert `.empty-state--filter` is in the container and the card list is empty

**Checkpoint**: US5 independently testable — apply a filter that matches nothing → empty state text appears, toolbar shows "Results (0)", erase-all visible, clicking it restores the full list.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility completeness, mobile layout, responsive behavior, and final quality gate.

- [ ] T069 Add `title` tooltip CSS to the stylesheet — `.filter-btn[title]` tooltip via `::before`/`::after` pseudo-elements (or a JS tooltip div) per `design/quickfilter_sort.md §4.2`: `background: var(--color-bg-dark); color: #fff; font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; border-radius: 4px; white-space: nowrap; position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%)`; visible on hover/focus
- [ ] T070 Add mobile two-row toolbar layout CSS — `@media (max-width: 639px)`: `div.toolbar`: `flex-wrap: wrap`; Row 1: `span.toolbar__label` + add-application button take full width; Row 2: `div.toolbar__filters` + erase btn + sort btn fill remaining row; filter/sort panels open as `position: static; width: 100%` (inline below Row 2) rather than absolutely positioned
- [ ] T071 Audit all interactive controls for complete ARIA coverage — verify each has correct attribute: filter buttons (`aria-label`, `aria-pressed`), sort button (`aria-label`, `aria-pressed`), erase-all (`aria-label`), restore-default button in SortPanel (`aria-label="Restore default sort"`), checklist rows (`role="checkbox"`, `aria-checked`), slider thumbs (`role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label`)
- [ ] T072 Verify Escape-to-close and focus-return behavior across all panels — keyboard test: Tab to Status filter button, Enter to open, Escape to close; assert `document.activeElement` is the Status filter button after close; repeat for Company, Salary, Compatibility, and Sort panels
- [ ] T073 Run `npx vitest run` — confirm all new tests in `tests/utils/filterSort.test.js` and `tests/components/QuickFiltersToolbar.test.js` pass; confirm all existing tests (`tests/utils/pagination.test.js`, `tests/models/application.test.js`, `tests/components/Pagination.test.js`, `tests/data/store.test.js`) remain green; fix any regressions
- [ ] T074 Run the project lint and format checks on all new and modified files (`src/utils/filterSort.js`, `src/components/QuickFiltersToolbar.js`, `src/components/FilterPanel.js`, `src/components/RangeSlider.js`, `src/components/SortPanel.js`, `src/pages/Tracker.js`) — fix any issues; verify no unused imports remain

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 2 completion — can start in parallel with Phase 3 if staffed
- **Phase 5 (US3)**: Depends on Phase 2 completion — can start in parallel with Phase 3/4
- **Phase 6 (US4)**: Depends on Phase 3 (erase-all button goes inside QuickFiltersToolbar)
- **Phase 7 (US5)**: Depends on Phase 2 (empty state added to `renderPage()`)
- **Phase 8 (Polish)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 complete; is the MVP — no other story dependency
- **US2 (P2)**: Requires Phase 2 complete; adds buttons to toolbar shell from US1 (start US2 after T033)
- **US3 (P3)**: Requires Phase 2 complete; adds sort button to toolbar shell from US1 (start US3 after T033)
- **US4 (P4)**: Requires US1 complete (erase-all button is part of `QuickFiltersToolbar`)
- **US5 (P5)**: Requires Phase 2 complete (renderPage empty-state branching in T029)

### Within Each Phase

- Phase 2: T003 first → T004–T006 [P] → T007–T010 [P] → T011 → T012 [P] → T013 → T014 [P] → T015 → T016–T017 [P] → T018 → T019–T025 [P] → T026–T029 sequential
- Phase 3: T030 → T031+T032 [P] → T033 → T034 → T035 → T036+T037 [P] → T038 → T039 → T040 → T041 → T042+T043+T044 [P] → T045 → T046+T047 [P]
- Phase 4: T048 → T049 → T050 → T051 → T052 [P] → T053+T054 [P] → T055 → T055a → T055b+T055c+T055d [P]
- Phase 5: T056 → T057 → T058 → T059 → T060 → T061 → T061a+T061b [P]

---

## Parallel Example: Phase 2 (Foundational)

```
Sequential:    T003
Parallel:      T004, T005, T006  (salary parsing — different functions, same file section)
Parallel:      T007, T008, T009, T010  (individual filter helpers)
Sequential:    T011 (applyFilters — depends on T007–T010)
Parallel:      T012 (isAnyFilterActive — independent)
Sequential:    T013 (getAvailableStatuses — depends on T011)
Parallel:      T014 (getAvailableCompanies — independent of T013)
Sequential:    T015 (syncDynamicSelections — depends on T013+T014)
Parallel:      T016, T017 (sort helpers — independent of each other)
Sequential:    T018 (test file + fixtures)
Parallel:      T019, T020, T021, T022, T023, T024, T025 (test groups — all in same file, independent blocks)
Sequential:    T026, T027, T028, T029 (Tracker.js — same file, ordered changes)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T029) — **critical gate**
3. Complete Phase 3: User Story 1 (T030–T047)
4. **STOP and VALIDATE**: open the app, apply Status filter, verify AND logic with Company filter, verify dynamic narrowing removes unavailable options
5. Run `npx vitest run` — all tests green

### Incremental Delivery

1. Setup + Foundational → verifiable pipeline with default sort/no-filter (identical to previous behavior)
2. US1 → Status + Company filters working → **MVP demo**
3. US2 → Salary + Compatibility range sliders
4. US3 → Sort controls
5. US4 → Erase-all button (small addition to toolbar)
6. US5 → Filter empty state (already partially wired in Foundational T029)
7. Polish → Mobile layout, accessibility audit, final test run

---

## Notes

- [P] tasks operate on logically independent blocks; within a single file, run them sequentially if one implementer
- [Story] labels map to spec.md user stories (US1=P1, US2=P2, US3=P3, US4=P4, US5=P5)
- Design tokens and visual specs come from `design/quickfilter_sort.md` (note: lowercase `design/`, not `designs/`)
- `Toolbar.js` is left in place and untouched; `QuickFiltersToolbar.js` replaces its usage in `Tracker.js`
- `_applications[]` in `Tracker.js` is already the non-archived list; no archived-field filtering needed
- Salary (`app.salary`) is a free-text string — always parse it; never store parsed values on the record
- The filter pipeline order is strict: `applyFilters → sortApplications → paginate` (FR-028–029)
- Sort changes, filter changes, and clear-all ALL reset `_currentPage = 1` explicitly in their Tracker.js callbacks; `clampCurrentPage` is a pure clamp only
