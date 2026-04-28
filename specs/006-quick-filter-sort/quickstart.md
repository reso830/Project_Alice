# Quickstart: Quick Filters and Sort

**Branch**: `006-quick-filter-sort` | **Date**: 2026-04-27

---

## What This Feature Adds

Inline filter and sort controls in the Tracker toolbar. Users can narrow the application card list by Status, Company, Salary range, or Compatibility range — and reorder by any of those fields plus Job ID — without leaving the main view.

---

## New Files to Create

| File | What it is |
|---|---|
| `src/utils/filterSort.js` | Pure helper functions: salary parsing, filtering, sorting, dynamic option derivation |
| `src/components/QuickFiltersToolbar.js` | Full toolbar component: label, filter buttons, panels, erase-all, sort button |
| `src/components/FilterPanel.js` | Status and Company checklist panel (multi-select) |
| `src/components/RangeSlider.js` | Dual-range slider for Salary and Compatibility filters |
| `src/components/SortPanel.js` | Sort field + direction selection panel |
| `tests/utils/filterSort.test.js` | Unit tests for all pure helpers in filterSort.js |
| `tests/components/QuickFiltersToolbar.test.js` | DOM tests for toolbar render and interaction |

---

## Files to Modify

| File | What changes |
|---|---|
| `src/pages/Tracker.js` | Add `_filterState`, `_sortState`, `_salaryBounds`, `_toolbarEl`; update `mount()`, `renderPage()`, `clampCurrentPage()`, `unmount()` |
| Existing CSS stylesheet | Add toolbar layout, filter button styles, panel styles, slider styles, filter empty state |

---

## Files Left Unchanged

- `src/components/Toolbar.js` — retained as-is; no longer used by Tracker.js after the change
- `src/components/Card.js`, `Pagination.js`, `Modal.js`, `Toast.js` — untouched
- `src/services/api.js` — no new API calls
- `src/models/application.js`, `shared/constants.js` — read-only
- All existing test files

---

## Build and Test Commands

```bash
# Run all tests
npx vitest run

# Watch mode during development
npx vitest

# The project has no separate build step for the frontend (vanilla JS, served directly)
```

---

## Implementation Order (recommended)

1. `filterSort.js` + `filterSort.test.js` — logic first, verified by tests
2. `RangeSlider.js` — standalone UI component, testable in isolation
3. `FilterPanel.js` — checklist panel
4. `SortPanel.js` — sort panel
5. `QuickFiltersToolbar.js` — composes all panels; wires callbacks
6. `Tracker.js` modifications — integrates everything; existing page behavior must remain green
7. CSS — style all new elements per `design/quickfilter_sort.md` tokens
8. `QuickFiltersToolbar.test.js` — confirm toolbar renders and callbacks fire correctly

---

## Key Design Decisions to Keep in Mind

- **Salary is a string** (`"$110k-$130k"`). Parse it in `filterSort.js`; never store parsed values on the record.
- **Filter pipeline order**: `applyFilters` → `sortApplications` → paginate. This order is mandatory per FR-028–029.
- **Page reset on filter or sort change**: set `_currentPage = 1` in the `onFilterChange`, `onSortChange`, and `onClearAll` callbacks, before calling `renderPage()`. Every user-initiated change resets to page 1.
- **Dynamic narrowing**: call `syncDynamicSelections(newFilterState, _applications)` in `onFilterChange` before storing state. This removes status/company selections that are no longer available.
- **Salary slider snaps on release only**: `RangeSlider` maintains local drag state; commits to parent via `onCommit` only on `mouseup`/`touchend`.
- **Sort state persists across SPA navigation**: `_sortState` is module-level and intentionally NOT reset in `unmount()`. Navigating away from Tracker and back preserves the sort. Browser refresh resets it.
- **Filter state resets on navigation**: `_filterState` IS reset in `unmount()`. Navigating away clears active filters.
- **Disabled controls**: all filter and sort buttons are rendered `disabled` / `aria-disabled="true"` when `totalCount === 0`. The Salary button is also disabled (with a descriptive aria-label) when `getSalaryBounds` returns `hasSalaryData: false`.
- **One panel at a time**: `QuickFiltersToolbar` closes any open panel before opening a new one.
- **Design token reference**: all colors, sizes, and font specs are in `design/quickfilter_sort.md` §10. Use the existing CSS custom properties (`--color-accent`, `--color-border`, etc.) where they map.

---

## Verifying the Feature Works

After implementation, verify manually:

1. Apply Status filter → list narrows, toolbar shows "Results (X)"
2. Add Company filter → AND logic reduces further
3. Open Status filter while Company filter is active → only statuses present in Company-filtered results appear
4. Apply Salary range filter → "Interviewing" status disappears from Status option list if no Interviewing apps in salary range; if "Interviewing" was selected, it auto-clears
5. Drag salary slider → list doesn't change during drag; changes on release
6. Sort by Compatibility descending → list reorders; sort icon shows active state; page resets to 1
7. Click erase-all → full list restored, toolbar shows "All Applications (N)", page resets to 1, sort preserved
8. Apply filters that match nothing → filter empty state appears
9. Keyboard: Tab to filter button, Enter/Space to open, Escape to close, focus returns to button
