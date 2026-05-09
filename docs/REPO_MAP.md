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
| `src/pages/ProfileEdit.js` | Profile editor — sticky Save/Cancel, dirty-state tracking, section overlays |
| `index.html` | Vite entry HTML |

---

## Components

| Path | Purpose |
|------|---------|
| `src/components/Card.js` | Application card (status badge, star, compat score) |
| `src/components/Modal.js` | Inline-edit detail modal — edit/create modes, draft management, focus trap |
| `src/components/QuickFiltersToolbar.js` | Full filter + sort toolbar — 8 filter dimensions, sort panel, erase-all |
| `src/components/FilterPanel.js` | Filter popup renderer — checklist and range-slider panels; used by QuickFiltersToolbar |
| `src/components/SortPanel.js` | Sort popup renderer — used by QuickFiltersToolbar |
| `src/components/ConfirmDialog.js` | Reusable confirmation dialog (archive, discard) |
| `src/components/Pagination.js` | 3-page sliding window UI |
| `src/components/StatusDropdown.js` | Inline status change control |
| `src/components/RangeSlider.js` | Dual-handle range slider (salary, compat) |
| `src/components/Toast.js` | User feedback notifications |
| `src/components/Navbar.js` | Top navigation bar |
| `src/components/Footer.js` | Page footer |
| `src/components/CompatBar.js` | Compatibility score visual bar |
| `src/components/DonutChart.js` | SVG donut chart with per-segment hover tooltips (Profile page) |
| `src/components/StackedBar.js` | Horizontal proportional bar for mobile stats (Profile page) |

---

## Data / Models

| Path | Purpose |
|------|---------|
| `src/models/application.js` | Client-side field validation + `STATUS_CONFIG` (colors, labels per status) |
| `src/models/profile.js` | Profile validation, normalisation, stat computation, `PROFICIENCY_LEVELS` |
| `shared/constants.js` | `STATUS_VALUES` — 9 status strings shared between frontend and backend |

**Application fields:** `jobTitle`, `companyName`, `status`, `lastStatusUpdate`, `compat` (0–100), `skills[]`, `preferredSkills[]`, `fav` (starred), `jobPostingUrl`, `recruiter`, `salary`, `location`, `shift`, `workSetup`, `compatNotes`, `generalNotes`

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
| `src/utils/filterSort.js` | Client-side filter + sort logic (all 8 filter dimensions) |
| `src/utils/currency.js` | `parseSalaryInput`, `formatSalaryDisplay` — peso salary formatting |
| `src/utils/pagination.js` | Pagination state model |
| `src/utils/date.js` | Date formatting helpers |
| `src/utils/dom.js` | DOM utility helpers |
| `src/utils/icons.js` | SVG icon markup helpers |
| `src/utils/sort.js` | `sortEducation`, `sortExperience` — profile entry sorting |
| `src/utils/url.js` | `getSafeExternalHref` — safe external link handling |
| `src/utils/validate.js` | `validateRequired`, `validateMonthYear`, `validateUrl`, `validateEmail` |
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
`src/utils/filterSort.js` → `src/components/QuickFiltersToolbar.js` (toolbar + popups via FilterPanel/SortPanel) → `Tracker.js` wiring

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
- `src/data/store.js` — legacy localStorage store, superseded by API; avoid
- `src/components/Toolbar.js` — orphaned; superseded by QuickFiltersToolbar; do not use

**Validation lives in two places** — always update both client (`src/models/`) and server (`server/validation/`) when changing field rules.
