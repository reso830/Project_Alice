# REPO_MAP.md

## Purpose

This file guides AI-assisted implementation. It is not full documentation; it is a navigation shortcut to reduce unnecessary repo scanning.

Job application tracker. Vanilla JS frontend (Vite), Express backend, SQLite persistence. No framework, no state manager.

**Stack:** Vite 8 · Express 4 · better-sqlite3 · Zod · Vitest

---

## Pages / Screens

| Path | Purpose |
|------|---------|
| `src/pages/Tracker.js` | Main page — card grid, filters, sort, pagination, modal wiring |
| `src/pages/Calendar.js` | Calendar view (follow-up dates) |
| `src/pages/Profile.js` | User profile screen |
| `src/pages/ProfileEdit.js` | Profile editor — sticky Save/Cancel, dirty-state tracking, section overlays |
| `src/pages/ConfigError.js` | Operator-facing fallback when hosted runtime detects missing Vite env vars |
| `src/pages/welcome/WelcomePage.js` | Diagonal-split landing page — CTAs, hero slideshow, floating pills, `?auth=callback` handler |
| `src/pages/welcome/HeroSlideshow.js` | 5-second auto-rotating screenshot slideshow; reduced-motion → single static slide |
| `src/pages/welcome/AuthOverlay.js` | Centered-modal overlay — tabs, focus trap, ESC/backdrop/close dismissal, `verification_sent` state |
| `src/pages/welcome/LoginForm.js` | Email/password login — neutral error, accessible inline loading |
| `src/pages/welcome/SignupForm.js` | Email/password signup — inline validation, neutral rejection, → `verification_sent` |
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
| `src/components/Navbar.js` | Top navigation bar — subscribes to `authStore`; renders email (truncated) + Sign Out when authenticated; `destroy()` unsubscribes |
| `src/components/Footer.js` | Page footer; `APP_VERSION` kept in sync with `package.json` |
| `src/components/ResumeImport.js` | Drag-and-drop resume parser; subscribes to `authStore` and hides outside `local-mode` / `authenticated` |
| `src/components/CompatBar.js` | Compatibility score visual bar |
| `src/components/DonutChart.js` | SVG donut chart with per-segment hover tooltips (Profile page) |
| `src/components/StackedBar.js` | Horizontal proportional bar for mobile stats (Profile page) |

---

## Data / Models

| Path | Purpose |
|------|---------|
| `src/models/application.js` | Client-side field validation + `STATUS_CONFIG` (colors, labels per status) · `SHIFT_VALUES` · `WORK_SETUP_VALUES` · `normalizeApplication()` |
| `src/models/profile.js` | Profile validation, normalisation, stat computation, `PROFICIENCY_LEVELS` |
| `shared/constants.js` | `STATUS_VALUES` — 9 status strings shared between frontend and backend |

**Application fields (required):** `jobTitle`, `companyName`, `status`, `lastStatusUpdate`, `responsibilities`

**Application fields (optional):** `compat` (0–100), `skills[]`, `preferredSkills[]`, `fav` (starred), `jobPostingUrl`, `recruiter`, `salary`, `location`, `shift`, `workSetup`, `compatNotes`, `generalNotes`

**Status values:** `wishlisted → applied → phone_screen → interview → assessment → offer → rejected / withdrawn / ghosted`

---

## Backend / API

| Path | Purpose |
|------|---------|
| `server/index.js` | Express app factory `createApp({ repositories, config, requireAuth? })`; `GET /api/health` returns `{ status, runtime }`; `logBoot()` |
| `server/routes/applications.js` | CRUD route handlers — accepts `{ repo, requireAuth }`, mounts `requireAuth` when present |
| `server/routes/profile.js` | Profile route handlers — same `{ repo, requireAuth }` shape |
| `server/routes/resume.js` | Resume parse handler — `{ requireAuth }` |
| `server/auth/middleware.js` | `createRequireAuth({ jwtSecret, logger })` — HS256 JWT verification with categorized rejection logging (token contents never logged) |
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
| `src/services/api.js` | Fetch wrapper for all `/api/*` calls; auto-attaches `Authorization: Bearer <token>` when `authStore.getAccessToken()` returns one |
| `src/services/resumeApi.js` | Resume upload client — same auth-header behavior as `api.js` |
| `src/services/supabaseClient.js` | Supabase JS client wrapper; reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`; exports `isHostedAuthAvailable` |
| `src/services/healthApi.js` | `getHealth()` — standalone fetcher returning raw `{ status, runtime }` (does not unwrap `data`) |
| `src/data/authStore.js` | Module-state subscribable auth store — `init`, `subscribe`, `getAuthState`, `getAccessToken`, `signOut`; states `initializing | local-mode | unauthenticated | authenticated` |
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
| `tests/components/` | Component render / DOM behavior (jsdom) |
| `tests/server/` | Route handlers, Zod validation, DB queries, `requireAuth` middleware, protected-routes wiring |
| `tests/services/` | API client, supabase client, resume API, health API |
| `tests/data/` | Auth store, legacy localStorage store |
| `tests/pages/` | Page-level integration (Tracker, Profile, ProfileEdit, ConfigError) |
| `tests/build/` | Vite build-time env-var assertion |
| `tests/main.test.js` | `bootstrap()` + runtime handshake → ConfigError wiring |

Run: `npm test` (watch) · `npm run test:run` (CI)

---

## Spec Packages

| Path | Purpose |
|------|---------|
| `specs/018-auth-user-access/spec.md` | Hosted authenticated user access — feature spec (US1–US5, FR-001..019, SC-001..010) |
| `specs/018-auth-user-access/plan.md` | Architecture, file structure, risks, validation approach |
| `specs/018-auth-user-access/tasks.md` | Phased implementation tasks ledger |
| `specs/018-auth-user-access/data-model.md` | `allowed_emails` schema + Postgres trigger contract |
| `specs/018-auth-user-access/contracts/api.md` | Env vars, Authorization header, `requireAuth` behavior, `/api/health`, trigger contract |
| `specs/018-auth-user-access/quickstart.md` | Operator install steps + pre-deploy verification gate (§10) |
| `specs/018-auth-user-access/research.md` | 13 design decisions with rejected alternatives |
| `specs/018-auth-user-access/checklists/plan-review.md` | Pre-implementation review gate |
| `design/welcome_page.md` | Visual specification for the welcome experience |

---

## Static Assets

| Path | Purpose |
|------|---------|
| `src/assets/Alice_White.png` · `Alice_Colored.png` | Brand marks (used by Navbar, Footer, WelcomePage, ConfigError) |
| `src/assets/welcome-hero/` | Six hero screenshots (tracker, application-modal, profile, filters, calendar, mobile-tracker) wired into `HeroSlideshow` |

---

## Where to Start (Quick Guide)

- UI change → `src/pages/Tracker.js` → relevant component in `src/components/`
- Form/modal change → `src/components/Modal.js` → `src/models/application.js`
- Data model change → `shared/constants.js` → `server/validation/application.js` → `src/models/application.js`
- Backend/API issue → `server/routes/applications.js` → `server/db/applications.js`
- Filter/sort behavior → `src/utils/filterSort.js` → `src/pages/Tracker.js` wiring
- Pagination behavior → `src/utils/pagination.js` → `src/components/Pagination.js` → `src/pages/Tracker.js`
- Auth / welcome / overlay → `src/main.js` (bootstrap) → `src/data/authStore.js` → `src/pages/welcome/WelcomePage.js` → `AuthOverlay.js` → `LoginForm.js` / `SignupForm.js`
- Auth middleware / JWT → `server/auth/middleware.js` → `server/index.js` (`createApp` wiring)

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
