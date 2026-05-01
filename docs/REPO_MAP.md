# REPO_MAP.md

## Purpose

This file guides AI-assisted implementation. It is not full documentation; it is a navigation shortcut to reduce unnecessary repo scanning.

Job application tracker. Vanilla JS frontend (Vite), Express backend, SQLite persistence. No framework, no state manager.

**Stack:** Vite 5 · Express 4 · better-sqlite3 · Zod · Vitest

---

## Pages / Screens

| Path | Purpose |
|------|---------|
| `src/pages/Tracker.js` | Main page — card grid, filters, sort, pagination, modal wiring |
| `src/pages/Calendar.js` | Calendar view (follow-up dates) |
| `src/pages/Profile.js` | User profile screen |
| `index.html` | Vite entry HTML |

---

## Components

| Path | Purpose |
|------|---------|
| `src/components/Card.js` | Application card (status badge, star, compat score) |
| `src/components/Modal.js` | Detail / edit modal for a single application |
| `src/components/QuickFiltersToolbar.js` | Status pill filters above the grid |
| `src/components/FilterPanel.js` | Full filter drawer (status, salary, compat, etc.) |
| `src/components/SortPanel.js` | Sort options panel |
| `src/components/Pagination.js` | 3-page sliding window UI |
| `src/components/StatusDropdown.js` | Inline status change control |
| `src/components/RangeSlider.js` | Salary / compat range input |
| `src/components/Toast.js` | User feedback notifications |
| `src/components/Navbar.js` | Top navigation bar |
| `src/components/Footer.js` | Page footer |
| `src/components/Toolbar.js` | Action toolbar (search, add, sort toggle) |
| `src/components/CompatBar.js` | Compatibility score visual bar |

---

## Data / Models

| Path | Purpose |
|------|---------|
| `src/models/application.js` | Client-side field validation + `STATUS_CONFIG` (colors, labels per status) |
| `shared/constants.js` | `STATUS_VALUES` — 9 status strings shared between frontend and backend |

**Application fields:** `jobTitle`, `companyName`, `status`, `lastStatusUpdate`, `compat` (0–100), `skills[]`, `fav` (starred), `jobPostingUrl`, `recruiter`, `salary`, `notes`

**Status values:** `wishlisted → applied → phone_screen → interview → assessment → offer → rejected / withdrawn / ghosted`

---

## Backend / API

| Path | Purpose |
|------|---------|
| `server/index.js` | Express app factory, health endpoint (`GET /health`) |
| `server/routes/applications.js` | CRUD route handlers (`GET/POST/PATCH/DELETE /api/applications`) |
| `server/db/applications.js` | SQL query layer (repository pattern) |
| `server/db.js` | SQLite connection and schema creation |
| `server/validation/application.js` | Zod schemas for request validation |
| `server/db-seed.js` | Load 23 demo records |
| `server/db-init.js` | Standalone schema init script |

**API proxy:** Vite dev server proxies `/api/*` → Express on port 3001.

---

## Utilities / Shared

| Path | Purpose |
|------|---------|
| `src/services/api.js` | Fetch wrapper for all `/api/*` calls |
| `src/utils/filterSort.js` | Client-side filter + sort logic |
| `src/utils/pagination.js` | Pagination state model |
| `src/utils/date.js` | Date formatting helpers |
| `src/utils/dom.js` | DOM utility helpers |
| `src/styles/main.css` | Global styles and CSS design tokens |

---

## Tests

| Path | Purpose |
|------|---------|
| `tests/models/` | Application field validation, status transitions |
| `tests/utils/` | filterSort, pagination, date utilities |
| `tests/components/` | Component render / DOM behavior |
| `tests/server/` | Route handlers, Zod validation, DB queries |
| `tests/services/` | API client |
| `tests/pages/` | Page-level integration |

Run: `npm test` (watch) · `npm run test:run` (CI)

---

## Where to Start (Quick Guide)

- UI change → `src/pages/Tracker.js` → relevant component in `src/components/`
- Form/modal change → `src/components/Modal.js` → `src/models/application.js`
- Data model change → `shared/constants.js` → `server/validation/application.js` → `src/models/application.js`
- Backend/API issue → `server/routes/applications.js` → `server/db/applications.js`
- Filter/sort behavior → `src/utils/filterSort.js` → `src/pages/Tracker.js` wiring
- Pagination behavior → `src/utils/pagination.js` → `src/components/Pagination.js` → `src/pages/Tracker.js`

---

## Key Boundaries

- **Tracker page** is self-contained — filters, sort, and pagination state live only in `Tracker.js`. Calendar and Profile are independent.
- **`shared/constants.js`** is the only file intentionally shared across frontend/backend. Changing status values there affects validation, UI badges, and DB queries simultaneously.
- **`src/models/application.js`** (client) and **`server/validation/application.js`** (server) are parallel but separate — both need updating when fields change.
- Do **not** touch `server/db.js` schema without also updating `server/db/applications.js` queries.

---

## Common Change Patterns

**New field on an application:**
`shared/constants.js` (if status-related) → `server/validation/application.js` → `server/db.js` (schema) → `server/db/applications.js` (queries) → `src/models/application.js` → `src/components/Modal.js` → `src/components/Card.js` (if surfaced on card)

**UI-only change (label, color, layout):**
`src/styles/main.css` or the specific component in `src/components/`

**New status value:**
`shared/constants.js` → `src/models/application.js` (STATUS_CONFIG) → `server/validation/application.js` → tests

**Filter or sort behavior:**
`src/utils/filterSort.js` → `src/components/FilterPanel.js` or `QuickFiltersToolbar.js` → `Tracker.js` wiring

**API endpoint change:**
`server/routes/applications.js` → `server/validation/application.js` → `src/services/api.js`

---

## Notes for AI Implementation

Before exploring:
- Identify target files from `tasks.md`
- Limit inspection to those files unless expansion is required
- If expanding scope, state why before inspecting more files

**Start here:**
- Feature touching UI → `src/pages/Tracker.js` to understand wiring, then the relevant component
- Feature touching data shape → `src/models/application.js` + `shared/constants.js` first
- Backend bug → `server/routes/applications.js` → `server/db/applications.js`

**Do NOT scan unless necessary:**
- `server/db-seed.js`, `server/db-clear.js` — dev tooling only, never touches production logic
- `src/assets/` — static images, no logic
- `src/data/store.js` — legacy, avoid unless task explicitly requires it

**Validation lives in two places** — always update both client (`src/models/`) and server (`server/validation/`) when changing field rules.
