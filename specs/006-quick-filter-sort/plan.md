# Implementation Plan: Quick Filters and Sort

**Branch**: `006-quick-filter-sort` | **Date**: 2026-04-27 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/006-quick-filter-sort/spec.md`

## Summary

Add inline filter and sort controls to the Tracker toolbar, allowing users to narrow and reorder the application card list by Status, Company, Salary, and Compatibility without leaving the main view. All filtering, sorting, and dynamic option derivation run as pure client-side derived steps applied in sequence: filter → sort → paginate. No backend, storage, or URL changes are involved. The implementation extends the existing vanilla JS / DOM-component architecture with new utility functions, a new toolbar component, and a reusable range slider component.

## Technical Context

**Language/Version**: JavaScript (ES Modules), no TypeScript  
**Primary Dependencies**: Vitest (tests), jsdom (test environment) — no new runtime dependencies required  
**Storage**: N/A — filter state is session-local (in-memory). Sort state is also in-memory (session only, no sessionStorage needed unless the feature later adds persistence).  
**Testing**: Vitest with jsdom (`vitest run`)  
**Target Platform**: Desktop and mobile browsers  
**Project Type**: Single-page web application (vanilla JS, DOM-based components)  
**Performance Goals**: Filter+sort result visible in under 1 second for realistic list sizes (hundreds of records)  
**Constraints**: No backend changes, no URL query sync, no localStorage persistence for filters

## Constitution Check

- **User-First Tracking** ✅ — feature enhances existing application list with filters and sort; no changes to required application record fields; `last_status_update`, `companyName`, `status`, `jobTitle` remain required and unchanged.
- **Simple Architecture** ✅ — pure helper functions in a dedicated utility module; UI components separated from logic; no new abstractions beyond what the feature requires.
- **Data Integrity** ✅ — feature is read-only relative to application records; no write paths introduced; salary string is parsed read-only for display and comparison.
- **Practical UX** ✅ — adds filter, sort, and empty-state behaviors; existing add/edit/search/review workflows are untouched; toolbar label adapts to filter state.
- **Testing** ✅ — filter, sort, and option derivation logic covered by unit tests; new component renders covered by DOM tests; existing tests must remain green.
- **Privacy** ✅ — all state is local in-memory; no external services touched.
- **Accessibility** ✅ — aria-pressed, aria-label, aria-checked, slider ARIA attributes, Escape-to-close, and focus-return are planned per FR-032–037.
- **Extensibility** ✅ — filter state shape and sort state shape are self-contained; no impact on future salary tracking, contacts, or interview sub-features.

## Project Structure

### Documentation (this feature)

```text
specs/006-quick-filter-sort/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet)
```

### Source Code (existing layout, new files marked ★)

```text
src/
├── components/
│   ├── Card.js
│   ├── Modal.js
│   ├── Pagination.js
│   ├── Toast.js
│   ├── Toolbar.js                    ← existing (kept, retired from Tracker use)
│   ├── QuickFiltersToolbar.js  ★    ← new: full toolbar with filter + sort controls
│   ├── FilterPanel.js          ★    ← new: Status and Company checklist panels
│   ├── RangeSlider.js          ★    ← new: reusable dual-range slider
│   └── SortPanel.js            ★    ← new: sort field + direction panel
├── pages/
│   └── Tracker.js                   ← modified: filter/sort state + derived pipeline
├── utils/
│   ├── date.js
│   ├── pagination.js
│   └── filterSort.js           ★    ← new: pure filter/sort/option helpers
└── models/
    └── application.js               ← read only (STATUS_CONFIG re-used for filter dots)

shared/
└── constants.js                     ← read only (STATUS_VALUES re-used)

design/
└── quickfilter_sort.md              ← design reference (already exists)

tests/
├── components/
│   └── QuickFiltersToolbar.test.js  ★   ← new
├── utils/
│   ├── filterSort.test.js           ★   ← new (primary test file)
│   └── pagination.test.js               ← existing (unchanged)
└── models/
    └── application.test.js              ← existing (unchanged)
```

## Existing Code Audit

### Confirmed field names (from `src/models/application.js`)

| Concept | Field name | Type |
|---------|-----------|------|
| Job ID | `id` | `number` |
| Status | `status` | `string` (one of STATUS_VALUES) |
| Company | `companyName` | `string` |
| Salary | `salary` | `string` (free-text, e.g. `"$110k-$130k"`) |
| Compatibility | `compat` | `number` (0–100) |
| Archived | (no field) | Records removed from `_applications` by `api.archive()` |

### Current Tracker.js data flow (before change)

```
api.getAll() → _applications[]
  → clampCurrentPage()
  → _applications.slice(page) → Card.render() × N
  → Toolbar.updateCount(_applications.length)
  → Pagination.render(currentPage, _applications.length)
```

`_applications` is already the non-archived list (archiving calls `removeApplication(id)` which splices the array). No archived-field filtering needed.

### Toolbar.js current state

Simple two-element module: `label` ("All Applications") + `count-badge`. Module-level `_badge` ref. Used only by `Tracker.js`. Will be superseded by `QuickFiltersToolbar.js`; `Toolbar.js` itself is left in place.

### Salary field

Free-text string, e.g., `"$110k-$130k"`, `"$95k-$115k"`. No structured salary field exists. A salary parser is required for filtering and sorting. Applications with empty or unparseable salary strings are treated as having no salary data.

### Salary step

No existing constant. Per `design/quickfilter_sort.md` §5.5: step = **$1,000**. This becomes a constant in `filterSort.js`.

### Status sort order

Stable, deterministic order is achieved by sorting on `STATUS_VALUES.indexOf(app.status)`. This matches insertion order in `shared/constants.js`.

---

## Implementation Steps

### Step 1 — Create `src/utils/filterSort.js` (pure logic only, no DOM)

**Salary parsing helpers:**

```
parseSalaryLower(salaryStr) → number | null
  - extracts first dollar amount from free-text string
  - handles $Xk and $X,000 formats
  - returns null if unparseable or empty

parseSalaryRange(salaryStr) → { min: number, max: number } | null
  - splits on '-', parses both bounds
  - returns null if lower bound fails; uses lower as upper if upper fails

getSalaryBounds(applications) → { min: number, max: number }
  - scans all applications, finds dataset min/max salary
  - rounds bounds to nearest $1k; defaults to { min: 0, max: 200000 } if no data
```

**Filter helpers (pure, accept apps[] + filterState, return apps[]):**

```
filterByStatus(apps, statuses[]) → apps[]
  - empty statuses[] → return apps unchanged
  - otherwise → apps.filter(a => statuses.includes(a.status))

filterByCompany(apps, companies[]) → apps[]
  - empty companies[] → return apps unchanged

filterBySalary(apps, min, max) → apps[]
  - null min+max → return apps unchanged
  - overlap semantics: app matches if parseSalaryRange(a.salary).min <= max AND parseSalaryRange(a.salary).max >= min
  - apps with null parsed salary → excluded when filter is active

filterByCompat(apps, min, max) → apps[]
  - null min+max → return apps unchanged

applyFilters(apps, filterState) → apps[]
  - chains all four filters in sequence (AND logic)

isAnyFilterActive(filterState) → boolean
  - returns true if any filter dimension has a non-default value

DEFAULT_FILTER_STATE (exported constant):
  { statuses: [], companies: [], salaryMin: null, salaryMax: null,
    compatMin: null, compatMax: null }
```

**Dynamic option helpers:**

```
getAvailableStatuses(apps, filterState) → string[]
  - applies all filters EXCEPT status, returns unique status values in result
  - order: STATUS_VALUES array order

getAvailableCompanies(apps, filterState) → string[]
  - applies all filters EXCEPT company, returns unique companyName values
  - alphabetically sorted

syncDynamicSelections(filterState, apps) → filterState
  - computes available statuses and companies given current filterState
  - returns new filterState with unavailable selections removed
  - pure: returns same object reference if nothing changed
```

**Sort helper:**

```
SALARY_STEP = 1000  (exported constant)

DEFAULT_SORT_STATE (exported constant):
  { field: 'id', direction: 'asc' }

isDefaultSort(sortState) → boolean

sortApplications(apps, sortState) → apps[]
  - field 'id': numeric, stable (secondary sort on id itself)
  - field 'status': STATUS_VALUES.indexOf(a.status), stable
  - field 'compat': numeric (a.compat)
  - field 'salary': parseSalaryLower(a.salary) ?? Infinity (nulls sort last ascending, first descending)
  - field 'companyName': locale-aware alphabetical (localeCompare)
  - direction: 'asc' or 'desc'
  - stable: when primary values are equal, secondary sort on id asc
```

---

### Step 2 — Create `src/components/RangeSlider.js`

Single reusable component for both Salary and Compatibility sliders.

**Public API:**

```
RangeSlider.render(options) → HTMLElement
  options: {
    min,          // absolute minimum (number)
    max,          // absolute maximum (number)
    valueMin,     // current committed min (number)
    valueMax,     // current committed max (number)
    step,         // snapping step on release (number)
    formatValue,  // (value) => string — e.g. '$90k' or '45%'
    ariaLabelMin, // string
    ariaLabelMax, // string
    onCommit,     // (min, max) => void — called on mouseup/touchend after snap
  }
```

**Internal behavior:**

- Renders two thumb elements on a track. Track fill between thumbs is styled with `--color-accent`.
- Maintains local `localMin`, `localMax` variables updated during drag (not committed).
- On `mousedown`/`touchstart` on a thumb: attaches `mousemove`/`touchmove` to `document`, updates local position in real time.
- On `mouseup`/`touchend`: snaps to nearest step, enforces min spacing of 1 step, calls `onCommit(snappedMin, snappedMax)`.
- Keyboard (desktop browsers only — not applied for touch-primary devices): thumb has `tabIndex="0"`; when focused, `ArrowRight` increases value by one step (clamped to max / min spacing), `ArrowLeft` decreases by one step; commits immediately on each key press (no drag state used).
- Thumb ARIA: `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label`.
- Thumb z-index: active thumb elevated to 4; idle thumb at 2.
- Display: current value labels above thumbs, bound labels below track ends.
- Slider full-extent detection: `onCommit` receives raw snapped values; caller (T053/T054) converts `min === salaryBounds.min` → `null` and `max === salaryBounds.max` → `null` before calling `onFilterChange`, so returning to full extent correctly clears the filter.

---

### Step 3 — Create `src/components/FilterPanel.js`

Renders Status and Company checklist panels. Both share the same structure.

**Public API:**

```
FilterPanel.render(options) → HTMLElement
  options: {
    title,          // 'STATUS' or 'COMPANY'
    options,        // string[] — available values to show
    selected,       // string[] — currently checked values
    getLabel,       // optional (value) => string — e.g. STATUS_CONFIG[v].label
    getDot,         // optional (value) => string — hex color for dot
    onChange,       // (selected: string[]) => void
    onClear,        // () => void
  }
```

**Behavior:**

- Renders a popup container with header (title + clear ✕ button) and scrollable checklist.
- Each row: `role="checkbox"`, `aria-checked`, click toggles selection.
- Status options show colored dot from `STATUS_CONFIG[value].badgeBg`.
- Company options are plain text.
- `max-height: 220px; overflow-y: auto` when list overflows.
- Clear button resets this filter only (calls `onClear`) and closes panel.

---

### Step 4 — Create `src/components/SortPanel.js`

**Public API:**

```
SortPanel.render(options) → HTMLElement
  options: {
    sortState,       // { field, direction }
    onChange,        // (sortState) => void
    onRestoreDefault // () => void
  }
```

**Behavior:**

- Two radio-style groups: SORT BY (id, status, compat, salary, companyName) and ORDER (asc, desc).
- Selected option shown with `✓` prefix and accent color.
- "Restore default" row at bottom: resets to DEFAULT_SORT_STATE and closes panel.
- Row hover uses `--color-accent-light` background.

---

### Step 5 — Create `src/components/QuickFiltersToolbar.js`

This module replaces `Toolbar.js` in `Tracker.js`. It manages the complete toolbar row.

**Public API:**

```
QuickFiltersToolbar.render(options) → HTMLElement
  options: {
    apps,            // App[] — full non-archived dataset; stored as _allApps for option derivation
    totalCount,      // number — non-archived app count
    filteredCount,   // number — filtered result count
    filterState,     // object
    sortState,       // object
    salaryBounds,    // { min, max } — dataset bounds for slider
    onFilterChange,  // (filterState) => void
    onSortChange,    // (sortState) => void
    onClearAll,      // () => void
    onAddApplication // () => void — existing add button callback
  }

QuickFiltersToolbar.update(el, { apps, totalCount, filteredCount, filterState, sortState }) → void
  - updates label, count, button states without full re-render
  - stores updated apps as _allApps for option derivation on next panel open
  - if a filter panel is currently open, re-renders its option list with fresh available options
```

**Rendered structure:**

```
[label+count] [StatusBtn][SalaryBtn][CompatBtn][CompanyBtn] [EraseBtn?] [SortBtn] [AddBtn]
```

Each filter icon button:
- 28×28px, `border-radius: 5px`
- Default / hover / active / open states per design tokens
- `aria-label="Filter by {Name}"`, `aria-pressed="{true|false}"`
- Click toggles associated panel; only one panel open at a time
- Panel is absolutely positioned below the button

Erase-all button:
- Only rendered when `isAnyFilterActive(filterState)` is true
- `aria-label="Clear all filters"`
- Calls `onClearAll()` on click

Sort icon button:
- Always visible
- `aria-pressed` reflects `!isDefaultSort(sortState)`
- Opens `SortPanel`

Label section:
- No filters active: `All Applications <strong>N</strong>`
- Any filter active: `Results <strong>X</strong>`
- Font: Sora 13px weight 500 (existing toolbar font)

Panel management (module-level):
- `_openPanel`: currently open panel element or null
- `_openButton`: button that triggered current panel
- `_openPanelType`: string key identifying which panel is open (`'status'`, `'company'`, `'salary'`, `'compat'`, `'sort'`)
- Escape keydown listener on document: closes open panel, returns focus to `_openButton`
- Document click listener: closes open panel if click outside panel and trigger button
- When `update()` is called and a Status or Company panel is currently open: re-render that panel's checklist with fresh available options derived from the new filterState (ensures option list stays current when user makes a selection)

---

### Step 6 — Modify `src/pages/Tracker.js`

**New module-level state:**

```js
let _filterState = { ...DEFAULT_FILTER_STATE };
let _sortState = { ...DEFAULT_SORT_STATE };
let _salaryBounds = { min: 0, max: 200_000 };
let _toolbarEl = null;
```

**Updated `mount()` function:**

1. After `api.getAll()`, compute `_salaryBounds = getSalaryBounds(_applications)`.
2. Replace `Toolbar.render(0)` with `QuickFiltersToolbar.render({ apps: _applications, totalCount: 0, filteredCount: 0, filterState: _filterState, sortState: _sortState, salaryBounds: _salaryBounds, onFilterChange, onSortChange, onClearAll, onAddApplication })`.
3. Store reference to toolbar element in `_toolbarEl`.

**New callback handlers (internal to Tracker.js):**

```js
function onFilterChange(newFilterState) {
  _filterState = syncDynamicSelections(newFilterState, _applications);
  _currentPage = 1;
  renderPage();
  updateToolbar();
}

function onSortChange(newSortState) {
  _sortState = newSortState;
  _currentPage = 1;
  renderPage();
  updateToolbar();
}

function onClearAll() {
  _filterState = { ...DEFAULT_FILTER_STATE };
  _sortState keeps current value (per spec)
  _currentPage = 1;
  renderPage();
  updateToolbar();
}

function updateToolbar() {
  const filtered = applyFilters(_applications, _filterState);
  QuickFiltersToolbar.update(_toolbarEl, {
    apps: _applications,
    totalCount: _applications.length,
    filteredCount: filtered.length,
    filterState: _filterState,
    sortState: _sortState,
  });
}
```

**Updated `renderPage()` function:**

```js
function renderPage({ moveFocus = false } = {}) {
  const filteredApps = applyFilters(_applications, _filterState);
  const sortedApps = sortApplications(filteredApps, _sortState);

  clampCurrentPage(sortedApps.length);  // updated signature

  _cardList.replaceChildren();
  _paginationEl?.remove();
  _paginationEl = null;
  removeEmptyState();

  if (sortedApps.length === 0 && isAnyFilterActive(_filterState)) {
    // render filter empty state (not the "no applications yet" state)
    _container.append(renderFilterEmptyState());
  } else if (sortedApps.length === 0) {
    _container.append(renderMessage('No applications yet. Add your first one!'));
  } else {
    const start = (_currentPage - 1) * PAGE_SIZE;
    const visible = sortedApps.slice(start, start + PAGE_SIZE);
    for (const app of visible) {
      _cardList.append(Card.render(app, createCallbacks()));
    }
    if (getPaginationModel(_currentPage, sortedApps.length, PAGE_SIZE).hasPagination) {
      _paginationEl = Pagination.render(_currentPage, sortedApps.length, onPageChange);
      _container.append(_paginationEl);
    }
  }

  if (moveFocus) { window.scrollTo(0, 0); focusCardList(); }
}
```

**Updated `clampCurrentPage(filteredCount)`:**

Pure clamp — never resets to 1 unconditionally. Callers (`onFilterChange`, `onSortChange`, `onClearAll`) explicitly set `_currentPage = 1` before calling `renderPage()`. This separates "prevent out-of-range page" from "reset on user action."

```js
function clampCurrentPage(filteredCount) {
  const maxPage = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  _currentPage = Math.min(_currentPage, maxPage);
}
```

**Updated `unmount()`:** reset `_filterState`, `_sortState`, `_salaryBounds`, `_toolbarEl` to defaults.

**Filter empty state renderer:**

```js
function renderFilterEmptyState() {
  const el = document.createElement('div');
  el.className = 'empty-state empty-state--filter';
  el.innerHTML = 'No applications match<br>the active filters.';
  return el;
}
```

Style matches `design/quickfilter_sort.md` §9: center, `DM Mono`, 12px, color `#bbbbbb`, padding 48px 20px.

**`refreshCard()` — no change.** Already uses `findApplication()` which searches `_applications`, not the filtered list. This is correct since the full source array is always maintained.

---

### Step 7 — CSS additions

Add to the existing stylesheet (no new file needed unless project convention dictates one):

- Toolbar layout: flexbox row for desktop, two-row for mobile (< 640px)
- Filter icon buttons: 28×28px, border-radius 5px, default/hover/active/open states
- Tooltips: absolute positioning, DM Mono 10px, dark background
- Filter/sort panels: absolute positioning, border, border-radius, box-shadow, z-index 500
- Status/company checklist rows: height 34px, hover background
- Range slider: track, thumbs, fill between thumbs
- Erase-all button: danger styling
- Empty state filter variant: DM Mono 12px, center, `#bbbbbb`
- All new styles use existing CSS custom properties: `--color-accent`, `--color-border`, etc.

---

### Step 8 — Testing plan

**New test file: `tests/utils/filterSort.test.js`**

Unit tests (pure functions, no DOM):

| Test group | Cases |
|---|---|
| `parseSalaryLower` | `"$110k-$130k"` → 110000, `"$95,000-$115,000"` → 95000, `""` → null, `"competitive"` → null |
| `filterByStatus` | empty → no-op, single match, multi-select, none match |
| `filterByCompany` | empty → no-op, match, no match |
| `filterBySalary` | null range → no-op, within range, below min, above max, null salary excluded |
| `filterByCompat` | null range → no-op, within range, boundary values |
| `applyFilters` | AND logic: status + salary both active, all three active, clear filter → all returned |
| `isAnyFilterActive` | default state → false, each filter type → true |
| `getAvailableStatuses` | reflects remaining set after non-status filters; selected status not excluded |
| `getAvailableCompanies` | reflects remaining set; alphabetical; selected company not excluded |
| `syncDynamicSelections` | removes unavailable status selections, removes unavailable company selections, returns same ref if no change |
| `sortApplications` | each field asc + desc, stable tie-breaking, salary uses lower bound, company alphabetical, status deterministic |
| `isDefaultSort` | default → true, any other field/direction → false |

**New test file: `tests/components/QuickFiltersToolbar.test.js`**

DOM tests (jsdom):

| Test | Assertion |
|---|---|
| No filters active | label reads "All Applications", count badge matches total, erase button absent |
| Filter active | label reads "Results", count shows filtered count, erase button present |
| Filter button aria-pressed | false when no selection, true when filter has active values |
| Sort button aria-pressed | false on default sort, true on non-default sort |
| onClearAll called | clicking erase-all calls callback |
| onFilterChange called | toggling a status checkbox calls callback with updated filterState |
| onSortChange called | selecting a sort field calls callback |

**Existing tests: no changes expected.** `tests/utils/pagination.test.js`, `tests/models/application.test.js`, `tests/components/Pagination.test.js` are all unaffected.

---

## Risks and Assumptions to Verify Before Implementation

| Risk | Mitigation |
|---|---|
| Salary string format varies beyond "$Xk-$Yk" (e.g., "$100,000+", "Competitive") | Parser returns null for unrecognized formats; treat as no salary data. Verify actual data distribution before setting slider bounds. |
| `QuickFiltersToolbar.js` panel positioning clips off-screen on small viewports | Use mobile inline-panel layout per design §2.2 for < 640px; verify on narrow screens. |
| Multiple panels open at once via keyboard tab | `_openPanel` module ref enforces only one open at a time; verify keyboard tab behavior. |
| `syncDynamicSelections` causes unintended filter removal | Write tests first; ensure it only removes values not in the available set, not the set itself. |
| `clampCurrentPage` signature change breaks pagination tests | `tests/utils/pagination.test.js` tests `getPaginationModel`, not `clampCurrentPage`; no risk. Verify after Tracker.js edit. |
| Design file path discrepancy | Design reference lives at `design/quickfilter_sort.md` (lowercase, singular "design") — not `designs/QuickFilter_Sort.md` as mentioned in spec. No action needed; plan uses the confirmed path. |

---

## Complexity Tracking

No constitution violations. No complexity justification required.
