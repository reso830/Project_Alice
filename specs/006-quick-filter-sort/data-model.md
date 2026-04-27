# Data Model: Quick Filters and Sort

**Branch**: `006-quick-filter-sort` | **Date**: 2026-04-27

---

## Existing Entities (unchanged)

### JobApplication (existing, read-only for this feature)

```js
{
  id:               number,      // positive integer; sort key for "Job ID"
  jobTitle:         string,      // required
  companyName:      string,      // required; filter + sort key for "Company"
  status:           string,      // one of STATUS_VALUES; filter + sort key for "Status"
  lastStatusUpdate: string,      // ISO date (YYYY-MM-DD)
  compat:           number,      // 0–100; filter + sort key for "Compatibility"
  salary:           string,      // free-text, e.g. "$110k-$130k"; filter + sort key (parsed)
  fav:              boolean,
  skills:           string[],
  responsibilities: string,
  recruiter:        string,
  jobPostingUrl:    string,
  _corrupt:         boolean,     // internal flag; corrupt records are excluded from display
}
```

No fields are added or modified on this entity. This feature is read-only relative to application records.

---

## New State Shapes (in-memory only, defined in filterSort.js)

### FilterState

```js
{
  statuses:   string[],    // selected status keys; empty = no constraint
  companies:  string[],    // selected company names; empty = no constraint
  salaryMin:  number | null,  // null = no lower bound; number = lower bound in dollars
  salaryMax:  number | null,  // null = no upper bound; number = upper bound in dollars
  compatMin:  number | null,  // null = no lower bound; number = 0–100
  compatMax:  number | null,  // null = no upper bound; number = 0–100
}

DEFAULT_FILTER_STATE = {
  statuses: [],
  companies: [],
  salaryMin: null,
  salaryMax: null,
  compatMin: null,
  compatMax: null,
}
```

**Validation rules**:
- `statuses` values must be members of `STATUS_VALUES` (enforced by dynamic option list; invalid values filtered silently).
- `companies` values must match `companyName` in the active dataset.
- `salaryMin <= salaryMax` when both are non-null; slider enforces minimum spacing of 1 step.
- `compatMin <= compatMax` when both are non-null; slider enforces minimum spacing of 1.

### SortState

```js
{
  field:     'id' | 'status' | 'compat' | 'salary' | 'companyName',
  direction: 'asc' | 'desc',
}

DEFAULT_SORT_STATE = { field: 'id', direction: 'asc' }
```

**Default is implicit**: the sort icon does not show as active when `field === 'id' && direction === 'asc'`.

### SalaryBounds (derived at mount time, read-only after)

```js
{
  min: number,   // dataset minimum salary lower bound, rounded to $1k; defaults to 0
  max: number,   // dataset maximum salary upper bound, rounded to $1k; defaults to 200_000
}
```

Stored in `_salaryBounds` in Tracker.js. Recomputed on each `mount()`. Passed to `QuickFiltersToolbar` for slider initialization.

### ParsedSalary (internal to filterSort.js, not exported)

```js
{
  min: number,   // lower bound in dollars (e.g. 110_000)
  max: number,   // upper bound in dollars (e.g. 130_000)
} | null
```

`null` when salary string is empty or does not match the expected pattern.

---

## Derived Result Set (conceptual pipeline, not a stored object)

```
source:    _applications[]           — all non-archived applications (loaded from API, immutable during session)
filtered:  applyFilters(source, filterState)   → apps[] matching all active filters
sorted:    sortApplications(filtered, sortState) → apps[] in specified order
paginated: sorted.slice(startIndex, endIndex)  → apps[] visible on current page
```

Pipeline is computed on demand in `renderPage()`. No intermediate results are cached between renders.

---

## State Transitions

### FilterState transitions

| Event | Transition |
|---|---|
| User selects a status | `statuses` → append value; `syncDynamicSelections` runs; `_currentPage = 1` |
| User deselects a status | `statuses` → remove value; `syncDynamicSelections` runs; `_currentPage = 1` |
| User adjusts salary range (release) | `salaryMin` / `salaryMax` updated; `syncDynamicSelections` runs; `_currentPage = 1` |
| User adjusts compat range (release) | `compatMin` / `compatMax` updated; `syncDynamicSelections` runs; `_currentPage = 1` |
| Another filter change makes a status selection unavailable | that status removed from `statuses` by `syncDynamicSelections` |
| User activates clear-all | all fields → DEFAULT_FILTER_STATE; `_currentPage = 1` |

### SortState transitions

| Event | Transition |
|---|---|
| User selects sort field | `field` updated; `_currentPage` unchanged |
| User selects sort direction | `direction` updated; `_currentPage` unchanged |
| User activates "Restore default" | `field = 'id'`, `direction = 'asc'`; panel closes |

---

## Constants (new, in filterSort.js)

| Constant | Value | Purpose |
|---|---|---|
| `SALARY_STEP` | `1000` | Snap interval for salary slider on release |
| `DEFAULT_FILTER_STATE` | see above | Initial and reset state for filters |
| `DEFAULT_SORT_STATE` | see above | Initial and reset state for sort |

---

## Helper Function Signatures (filterSort.js)

```js
// Salary
parseSalaryLower(salaryStr: string): number | null
parseSalaryRange(salaryStr: string): { min: number, max: number } | null
getSalaryBounds(apps: App[]): { min: number, max: number }

// Filtering
filterByStatus(apps: App[], statuses: string[]): App[]
filterByCompany(apps: App[], companies: string[]): App[]
filterBySalary(apps: App[], min: number | null, max: number | null): App[]
filterByCompat(apps: App[], min: number | null, max: number | null): App[]
applyFilters(apps: App[], filterState: FilterState): App[]
isAnyFilterActive(filterState: FilterState): boolean

// Dynamic options
getAvailableStatuses(apps: App[], filterState: FilterState): string[]
getAvailableCompanies(apps: App[], filterState: FilterState): string[]
syncDynamicSelections(filterState: FilterState, apps: App[]): FilterState

// Sorting
sortApplications(apps: App[], sortState: SortState): App[]
isDefaultSort(sortState: SortState): boolean
```
