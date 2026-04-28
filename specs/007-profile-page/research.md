# Research: Profile Page

**Branch**: `007-profile-page` | **Date**: 2026-04-28  
**Phase**: 0 — Technical decisions resolved before design

---

## Decision 1: Chart Rendering — Custom SVG, No Library

**Decision**: Implement the donut chart and horizontal stacked bar as custom SVG and DOM elements respectively.

**Rationale**: A donut chart requires computing arc paths from percentages — roughly 30 lines of SVG math. A stacked bar is CSS flex or SVG rects. Neither requires a charting library. The constitution requires justification for new dependencies; there is none here that a library would materially simplify.

**Alternatives considered**:
- **Chart.js** (~350 KB) — rejected; oversized for two simple shapes, adds a build-time dependency.
- **D3.js** (~150 KB) — rejected; powerful but far beyond what two primitive shapes require.

---

## Decision 2: Profile Data Storage - SQLite-backed API

**Decision**: Store the single profile record in the existing local SQLite database and expose it through `GET /api/profile` and `PUT /api/profile`.

**Rationale**: Profile data is user data and should follow the same durable local persistence model as applications. The feature must not save profile data in browser `localStorage`, `sessionStorage`, or browser-only memory. Reusing the existing Express + SQLite stack keeps the app local-first without introducing a new database or external service.

**Rejected alternatives**:
- **Browser storage (`localStorage` / `sessionStorage`)** - rejected; profile data should not be saved in browser-managed storage.
- **In-memory only** - rejected; profile would be lost on page refresh.
---

## Decision 3: Routing — Extend `navigate()` with `'profile-edit'` Key

**Decision**: Add `'profile-edit'` as a fourth page key in the `navigate()` function in `main.js`, alongside the existing `'tracker'`, `'calendar'`, and `'profile'` keys.

**Rationale**: The existing router is a minimal string-switch in `main.js`. Adding one case is idiomatic and keeps the diff small. The spec's `/profile/edit` notation is a logical path concept — the app has no URL bar routing, so `'profile-edit'` is the correct mapping within the existing architecture.

**Navbar handling**: The edit page requires a different topbar (back button + title, no nav links). `ProfileEdit.mount()` will hide the global `.navbar` element and insert its own `<header>` before `<main id="app">`. `ProfileEdit.unmount()` removes the custom header and restores the navbar. The `Navbar.setActive()` call in `navigate()` is skipped for `'profile-edit'` since the global navbar is hidden.

**Alternatives considered**:
- **Hash-based routing** (`#/profile/edit`) — rejected; requires broader refactoring of main.js, link handling, and back-button behaviour beyond this feature's scope.
- **History API (pushState)** — rejected; same scope concern; no requirement for URL sharing or browser back-button integration.
- **Modal/overlay for edit page** — rejected; spec explicitly calls for a "dedicated full-page route" with its own topbar.

---

## Decision 4: Application Counts Data Source — API (`api.getAll()`)

**Decision**: The Profile page fetches live application data from `api.getAll()` (the existing SQLite-backed REST API) to compute AppCounts.

**Rationale**: The Tracker page migrated to the API as its source of truth. `store.js` (localStorage) is marked deprecated in the codebase. Using `api.getAll()` ensures Profile counts always match what the Tracker shows.

**Status slug mapping**: The design spec labels differ from internal slugs in one case:
| Design label | Internal slug   |
|--------------|-----------------|
| Applied      | `applied`       |
| Screening    | `phone_screen`  |
| Interview    | `interview`     |
| Assessment   | `assessment`    |
| Offer        | `offer`         |
| Rejected     | `rejected`      |
| Withdrawn    | `withdrawn`     |
| Ghosted      | `ghosted`       |
| Wishlist     | `wishlisted`    |

Active count uses `phone_screen + interview + assessment` (not "screening").

**Alternatives considered**:
- **`store.getAll()` (localStorage)** — rejected; deprecated, may diverge from API data.

---

## Decision 5: Mobile Collapse — CSS Class Toggle (No `<details>`)

**Decision**: Implement mobile sub-section collapse via `classList.toggle('is-collapsed')` on the section element, with CSS handling visibility and chevron rotation. No `<details>`/`<summary>` HTML element.

**Rationale**: The existing codebase uses class-based show/hide patterns throughout (e.g., Modal, StatusDropdown). A CSS class toggle integrates naturally with the `main.css` convention and allows for CSS transition animation on the chevron. The `<details>` element cannot be styled with a CSS transition for open/close in a cross-browser reliable way.

**Alternatives considered**:
- **`<details>/<summary>`** — rejected; CSS animation support is inconsistent, and the chevron arrow styling is harder to control.
- **JS height animation** — rejected; measuring `scrollHeight` for animation is valid but more complex than a CSS max-height transition, which is sufficient for this use case.
