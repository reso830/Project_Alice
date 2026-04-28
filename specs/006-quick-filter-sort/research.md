# Research: Quick Filters and Sort

**Branch**: `006-quick-filter-sort` | **Date**: 2026-04-27

---

## Decision 1: Salary Field — Parsing Strategy

**Question**: The salary field is a free-text string (e.g., `"$110k-$130k"`). How should it be parsed for range filtering and sorting?

**Decision**: Implement a local `parseSalaryLower` / `parseSalaryRange` helper in `filterSort.js` that handles the patterns found in seed data. Return `null` for unrecognized or empty strings. Treat null-salary applications as excluded when a salary filter is active, and as matching when the filter is at full extent (inactive).

**Rationale**: The salary string format is consistent across seed data (`$Xk-$Yk`). A minimal regex parser handles this cleanly. Returning null for edge cases is safe because the spec explicitly states: "Applications without a salary value are treated as outside any active Salary filter range" and "match when the filter is empty."

**Alternatives considered**:
- Structured salary field on the backend — rejected; the spec explicitly prohibits database changes.
- Displaying salary filter only for applications that have salary data — revised; the Salary filter button is always visible but is rendered disabled (with an accessible label) when no applications have parseable salary data. Applications without salary data do not match a constrained range when the filter is active.

---

## Decision 2: Salary Slider Step and Bounds

**Question**: Is there a configured salary step constant? What should slider bounds be?

**Decision**: No existing salary step constant exists in the codebase. Per `design/quickfilter_sort.md` §5.5, step = **$1,000**. Export `SALARY_STEP = 1000` from `filterSort.js`. Slider bounds are derived from the dataset at mount time via `getSalaryBounds(applications)`, rounded to the nearest $1,000. Return shape: `{ min, max, hasSalaryData: boolean }`. Default fallback: `{ min: 0, max: 200_000, hasSalaryData: false }` when no parseable salary data exists.

**Rationale**: Design spec is explicit about $1k step. Dataset-derived bounds ensure the slider is always relevant to the actual data without requiring a config file.

**Alternatives considered**:
- Hardcoded $0–$300k bounds — rejected; irrelevant when all applications are in a narrower range.
- Configurable step via settings file — rejected; the design specifies $1k and no config mechanism exists.

---

## Decision 3: Archived Application Handling

**Question**: How does the filter feature distinguish non-archived from archived applications?

**Decision**: No action needed. The `_applications` module variable in `Tracker.js` is already the non-archived list. `api.archive(id)` removes the record from `_applications` via `removeApplication()`. The filter feature operates on `_applications` as-is — it is already the correct base dataset.

**Rationale**: Confirmed by reading Tracker.js. There is no `archived` field on application records; archiving is handled by removing the record from the in-memory array and the server-side list.

---

## Decision 4: Toolbar Architecture

**Question**: Should `Toolbar.js` be extended, or should a new component be created?

**Decision**: Create **`QuickFiltersToolbar.js`** as a new component. `Tracker.js` replaces its usage of `Toolbar.render()` / `Toolbar.updateCount()` with `QuickFiltersToolbar.render()` / `QuickFiltersToolbar.update()`. `Toolbar.js` is left untouched (not deleted, not modified).

**Rationale**: `Toolbar.js` is simple (29 lines) and would need substantial restructuring to accommodate filter buttons, dynamic label switching, panel management, and erase-all. Creating a new module keeps `Toolbar.js` as a clean historical reference and avoids any risk of breaking existing import chains if other code ever imports it. `QuickFiltersToolbar.js` owns the full toolbar row from day one.

**Alternatives considered**:
- Extend `Toolbar.js` in-place — rejected; the two APIs are incompatible (different render arguments, different update semantics).
- One monolithic component with all panels inline — rejected; panel components (`FilterPanel.js`, `SortPanel.js`, `RangeSlider.js`) are small enough to be separate and reusable if future panels are needed.

---

## Decision 5: Status Sort Order

**Question**: What defines "deterministic and stable" ordering for status sort?

**Decision**: Sort by `STATUS_VALUES.indexOf(app.status)`. This uses the insertion order in `shared/constants.js`: wishlisted → applied → phone_screen → interview → assessment → offer → rejected → withdrawn → ghosted. Tie-break on `id` ascending.

**Rationale**: The array order in `STATUS_VALUES` already represents a natural workflow progression. Using array index gives a deterministic, stable result without requiring a separate rank mapping.

**Alternatives considered**:
- Alphabetical by status label — rejected; "Applied" and "Assessment" would be adjacent, which doesn't match workflow order.
- Explicit rank object — rejected; the array index approach is equivalent and requires no extra constant.

---

## Decision 6: Dynamic Option Narrowing — Auto-Removal of Unavailable Selections

**Question**: When should unavailable status/company selections be removed?

**Decision**: After any filter state change, `Tracker.js` calls `syncDynamicSelections(newFilterState, _applications)` before storing the new state. This function computes available statuses and companies (excluding the respective self-filter), intersects with current selections, and returns updated state. If nothing changed, the same reference is returned (no unnecessary re-render).

**Rationale**: Centralizing this in a pure function makes it easy to test. Running it after every filter change (not just on open) ensures consistency even when filters are changed programmatically.

---

## Decision 7: Design File Location

**Question**: The spec references `designs/QuickFilter_Sort.md`. Does this file exist?

**Decision**: The design file exists at **`design/quickfilter_sort.md`** (lowercase `d`, singular `design`, lowercase filename). The path in the spec is incorrect. Implementation should reference `design/quickfilter_sort.md`. No action required on the spec — this is a path discrepancy only; the design content is available and complete.

---

## Decision 8: Filter State Persistence

**Question**: Should filter state survive a page refresh? Should sort state use `sessionStorage`?

**Decision**: Filter state is **in-memory only** (no sessionStorage, no localStorage) and resets on unmount. Sort state is also module-level in-memory, but is **intentionally not reset on unmount** — this gives SPA-session persistence without sessionStorage. Both reset on browser page refresh when the module reloads.

**Rationale**: Filters are "temporary narrowing" that users expect to start fresh when they navigate away. Sort is a "review preference" that should survive navigating away and back within the same tab session. Since ES module singletons persist for the lifetime of the page, omitting the `_sortState` reset from `unmount()` is sufficient — no sessionStorage required. `sessionStorage` would be a premature addition given the spec does not require cross-tab or cross-refresh persistence.

---

## Decision 9: Panel Mutual Exclusion and Keyboard Behavior

**Question**: When a second filter panel is opened while one is already open, what happens?

**Decision**: Opening a new panel closes the previously open panel first. Only one panel is visible at a time. Module-level `_openPanel` and `_openButton` refs in `QuickFiltersToolbar.js` manage this.

**Keyboard behavior**:
- `Escape` closes the open panel and returns focus to `_openButton`.
- Clicking outside the panel and its trigger button closes the panel.
- This is implemented via `document` `keydown` and `click` listeners attached when a panel opens and removed when it closes.

**Rationale**: Single-panel constraint is standard for toolbar filter UIs. The document-level listener approach is established in the codebase (similar patterns may exist in Modal.js).
