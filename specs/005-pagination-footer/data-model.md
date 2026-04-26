# Data Model: Pagination & Footer UI

**Feature**: 005-pagination-footer | **Date**: 2026-04-26

This feature introduces no changes to the application data model. Pagination is a pure display concern — it slices the existing `_applications` array for rendering and resets when the dataset changes. No new fields, entities, or persistence requirements are added.

---

## Existing Entity: Job Application

Unchanged. The `JobApplication` entity defined in `src/models/application.js` is the source of truth.

Required fields: `id`, `companyName`, `jobTitle`, `status`, `lastStatusUpdate`
Optional fields: `source`, `jobPostingUrl`, `salary`, `notes`, `followUpAction`, `followUpDate`, `fav`, `compat`, `recruiter`, `responsibilities`, `skills`

---

## Display Concept: Page

Not a persisted entity. Exists only as a derived computation.

| Property | Type | Description |
|---|---|---|
| `currentPage` | `number` (≥ 1) | The page number currently displayed. Module-level state in Tracker.js. Initialized to 1 on mount, reset to 1 on dataset change. |
| `totalPages` | `number` (≥ 1) | `Math.ceil(totalEntries / PAGE_SIZE)`. Derived. |
| `hasPagination` | `boolean` | `true` when `totalEntries > PAGE_SIZE`. Derived. Controls pagination visibility. |
| `startIndex` | `number` | `(currentPage - 1) * PAGE_SIZE`. Slice start, inclusive. |
| `endIndex` | `number` | `startIndex + PAGE_SIZE`. Slice end, exclusive. |
| `visibleApplications` | `JobApplication[]` | `_applications.slice(startIndex, endIndex)`. The rendered subset. Never stored. |

**Invariant**: `_applications` is never mutated by pagination. Only the slice boundaries change.

---

## Pagination Model Output

The `getPaginationModel()` utility returns:

```js
{
  pagesToRender: Array<number | 'ellipsis'>,  // ordered render sequence
  totalPages: number,
  hasPagination: boolean
}
```

`pagesToRender` example for currentPage=5, totalPages=10:
```
[1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]
```

The `'ellipsis'` token is a sentinel value. The Pagination component renders it as a non-interactive span; the rendering logic never treats it as a page number.

---

## State Reset Rule

`_currentPage` resets to `1` whenever `_applications` is reassigned. Currently this happens only in `Tracker.mount()`. Future filter/search features that update `_applications` must also reset `_currentPage` to prevent stale page indices from producing empty views.
