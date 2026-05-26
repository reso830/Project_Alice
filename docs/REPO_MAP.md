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
| `src/pages/Calendar.js` | Calendar page — month-grid view of all Timeline activity; mounts MonthGrid, ActionPanel, MonthPicker, YearPicker, and the shared QuickFiltersStatusPopup; manages nav state and status filter |
| `src/pages/Profile.js` | User profile screen |
| `src/pages/ProfileEdit.js` | Profile editor — sticky Save/Cancel, dirty-state tracking, section overlays. In demo (feature 020) the resume-import slot renders an inline `.profile-edit__resume-demo-note` ("Resume import is available after signing in.") instead of mounting `ResumeImport` |
| `src/pages/ConfigError.js` | Operator-facing fallback when hosted runtime detects missing Vite env vars |
| `src/pages/welcome/WelcomePage.js` | Welcome landing page — applies fixed production layout/theme/copy classes plus viewport matchMedia; mounts the hero slideshow on desktop/tablet and tears it down on mobile; `?auth=callback` verification banner handler |
| `src/pages/welcome/HeroSlideshow.js` | 4-scene cycler — auto 5500ms cycle + 700ms cross-fade + click-to-jump dots with per-scene progress bar; `heroScene` prop pins to one scene; reduced-motion → static scene 1, no dots |
| `src/pages/welcome/scenes/SceneStack.js` · `ScenePipeline.js` · `SceneProfile.js` · `SceneLogo.js` | Four hero scene modules — each exports `{ mount(container, { variant }), unmount() }`; `centered` variant flips Scene 1 to 2 flat cards and Scene 4 to a fixed 200×200 logo (tablet) |
| `src/pages/welcome/AuthOverlay.js` | Centered-modal overlay — header (40px Alice mark + title + close), focus trap, ESC/backdrop dismissal, footer with "or" divider + demo button + swap-mode link + signup-only legal copy; `verification_sent` state |
| `src/pages/welcome/LoginForm.js` | Email/password login — neutral error, accessible inline loading |
| `src/pages/welcome/SignupForm.js` | Email/password signup — inline validation, neutral rejection, → `verification_sent` |
| `src/pages/welcome/shared/appMeta.js` | `APP_VERSION` / `ISSUE_URL` / `LICENSE_NAME` / `LICENSE_URL` — single source consumed by both `Footer.js` and the welcome mini footer |
| `src/pages/welcome/demoStub.js` | Shared `enterDemo()` entry point for the portfolio demo — wired by both the welcome CTA and the auth-modal demo button (feature 020). Delegates to `authStore.enterDemo()` |
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
| `src/components/Timeline.js` | Application Timeline section for the detail modal — collapsed preview, expanded add/edit/delete rows, inline status picker, and status-change helper |
| `src/components/RangeSlider.js` | Dual-handle range slider (salary, compat) |
| `src/components/Toast.js` | User feedback notifications |
| `src/components/Navbar.js` | Top navigation bar — sticky navy band (52px), brand cluster + page nav + identity cluster; email truncated via CSS `max-width` with full value in `title`; door-arrow sign-out button (icon-only at `≤ 639px`); subscribes to `authStore`; `destroy()` unsubscribes. In demo (feature 020) the identity cluster renders a "Demo mode" badge and an Exit demo button that calls `authStore.exitDemo()` |
| `src/components/BottomTabBar.js` | Mobile bottom tab bar (`≤ 639px`) — three tabs (Tracker / Calendar / Profile); same `setActive(page)` contract as Navbar |
| `src/components/Fab.js` | Mobile floating action button — "+ New application" above the bottom tab bar at `≤ 639px`; opens the Create-mode detail modal |
| `src/components/Footer.js` | Page footer; sources `APP_VERSION` / `ISSUE_URL` / `LICENSE_NAME` / `LICENSE_URL` from `src/pages/welcome/shared/appMeta.js` |
| `src/components/ResumeImport.js` | Drag-and-drop resume parser; subscribes to `authStore` and hides outside `local-mode` / `authenticated`. Exports `VISIBLE_STATUSES` (feature 020 design-by-contract guard — `'demo'` intentionally excluded) |
| `src/components/CompatBar.js` | Compatibility score visual bar |
| `src/components/DonutChart.js` | SVG donut chart with per-segment hover tooltips (Profile page) |
| `src/components/StackedBar.js` | Horizontal proportional bar for mobile stats (Profile page) |
| `src/components/calendar/MonthGrid.js` | Month-grid calendar — 7-column layout with day cells showing timeline event dots; keyboard-selectable cells (Enter/Space); chips decorative; cell selection drives the inline DayPanel below the grid |
| `src/components/calendar/ActionPanel.js` | Calendar right-panel — Today section, Suggested Actions (5 rule-based kinds), Upcoming section; Mark Ghosted from suggestion rows; local dismissals (with "Suggestion dismissed" toast); collapsible summary bar at `<1200px` stacked layouts |
| `src/components/calendar/DayPanel.js` | Inline Day Details Panel (v2) — sits below the Month Grid in the same card; renders prompt/empty/populated state for the selected date; replaces the retired DayPopover |
| `src/components/calendar/MonthPicker.js` | Month picker dropdown — 12-month grid anchored to the nav chevron |
| `src/components/calendar/YearPicker.js` | Year picker dropdown — scrollable year list anchored to the nav chevron |
| `src/components/QuickFiltersStatusPopup.js` | Shared status filter popup used by Tracker quick filters and Calendar status filtering |
| `src/components/calendar/anchoredDropdown.js` | `mountAnchoredDropdown({ anchorEl, contentEl, align, asBottomSheet, scrim, ariaLabel, onClose })` — shared primitive; handles positioning, outside-click/Esc dismiss, `bsIn` animation for bottom-sheet mode |

---

## Data / Models

| Path | Purpose |
|------|---------|
| `src/models/application.js` | Client-side field validation + `STATUS_CONFIG` (colors, labels per status) · `SHIFT_VALUES` · `WORK_SETUP_VALUES` · `normalizeApplication()` · TimelineEntry helpers · `applyStatusChange(app, status, options)` · `STATUS_DISPLAY_PRIORITY` · `TERMINAL_STATES` |
| `src/models/profile.js` | Profile validation, normalisation, stat computation, `PROFICIENCY_LEVELS` |
| `shared/constants.js` | `STATUS_VALUES` — 10 status strings shared between frontend and backend |

**Application fields (required):** `jobTitle`, `companyName`, `status`, `lastStatusUpdate`, `responsibilities`

**Application fields (optional):** `compat` (0–100), `skills[]`, `preferredSkills[]`, `fav` (starred), `jobPostingUrl`, `recruiter`, `salary`, `location`, `shift`, `workSetup`, `compatNotes`, `generalNotes`

**Status values:** `wishlisted → applied → phone_screen → interview → assessment → offer → accepted / rejected / withdrawn / ghosted`

---

## Backend / API

| Path | Purpose |
|------|---------|
| `server/index.js` | Express app factory `createApp({ repositories, config, requireAuth?, seedHostedUserIfNeeded? })`; `GET /api/health` returns `{ status, runtime }`; `logBoot()`. CLI boot block lazy-imports the seed middleware in hosted mode only |
| `api/index.js` | Vercel serverless entry — lazy-imports the seed middleware in hosted mode; passes `config` + dispatcher + seed middleware into `createApp` |
| `server/health.js` | `assertHostedSchema(config, { logger? })` — hosted-mode boot check; PostgREST sentinel probes against `applications` (including `applications.timeline`), `profile`, and `user_seed_state`; throws on `42703` / `42P01` (migration not applied); soft-warns on transient errors |
| `server/routes/applications.js` | CRUD route handlers — accepts `{ repos, requireAuth?, seedHostedUserIfNeeded? }`; uses `attachRepos(repos)` to populate `req.repos`; all handlers `async` with `await` on every repo call (Supabase adapter returns Promises) |
| `server/routes/profile.js` | Profile route handlers — same `{ repos, requireAuth, seedHostedUserIfNeeded }` shape |
| `server/routes/resume.js` | Resume parse handler — `{ requireAuth, seedHostedUserIfNeeded }`; doesn't consume repos but mounts seed so a hosted user's first action via resume upload still seeds |
| `server/auth/middleware.js` | `createRequireAuth({ jwksUri, jwks?, logger })` — verifies Supabase JWTs against the project's JWKS endpoint (`['ES256', 'RS256']` algorithm allowlist) via `jose.jwtVerify`; categorized rejection logging (token contents never logged) |
| `server/auth/seedHostedUser.js` | `seedHostedUserIfNeeded(req, res, next)` — async middleware; calls `client.rpc('claim_and_seed_starter')`; the RPC atomically claims the per-user seed marker and inserts 2 starter applications in one Postgres transaction (idempotent, race-safe, deletion-survivable per FR-014) |
| `server/repositories/index.js` | `createRepositories(config)` returns uniform `{ forRequest(req) }` across `local` and `hosted` runtimes. Hosted lazy-imports the Supabase modules; local never loads `@supabase/supabase-js` |
| `server/repositories/middleware.js` | `attachRepos(dispatcher)` — Express middleware factory that sets `req.repos = dispatcher.forRequest(req)`; mounted after `requireAuth` in every protected router |
| `server/repositories/applications.js` | `createSqliteApplicationsRepository(db)` — local SQLite adapter |
| `server/repositories/profile.js` | `createSqliteProfileRepository(db)` — local SQLite adapter |
| `server/repositories/supabase/client.js` | `createSupabaseClientForRequest(req)` — per-request anon-key Supabase client initialized with the caller's JWT; never reads `SUPABASE_SERVICE_ROLE_KEY` |
| `server/repositories/supabase/applications.js` | `createSupabaseApplicationsRepository(client, userId)` — hosted adapter. RLS-scoped reads/writes via PostgREST; `normalizeForPostgres()` helper coerces SQLite-shaped int booleans + JSON strings to Postgres `bool`/`jsonb` before any write |
| `server/repositories/supabase/profile.js` | `createSupabaseProfileRepository(client, userId)` — hosted adapter; `data` jsonb projection; one-row-per-user via `{ onConflict: 'user_id' }` upsert |
| `server/db/applications.js` | SQL query layer for SQLite (re-exports `toRow`/`toRecord` from columns.js for backward compat with foundation.test.js) |
| `server/db/profile.js` | SQL query layer for SQLite profile (`getProfile` / `saveProfile`) |
| `server/db/columns.js` | Pure data-layer helpers shared by SQLite + Supabase adapters — `FIELD_TO_COLUMN`, `toRow`, `toRecord`, `currentDate`, `APPLICATION_COLUMNS_WITHOUT_USER_ID`, `PROFILE_COLUMNS_WITHOUT_USER_ID`, including `timeline` JSON mapping. MUST NOT import `db.js` (would trigger SQLite load in hosted cold start) |
| `server/db.js` | SQLite connection and schema creation |
| `server/validation/application.js` | Zod schemas for request validation |
| `server/db-seed.js` | Load 23 demo records (local SQLite only); imports `DEMO_RECORDS` from `server/seeds/applicationsData.js` |
| `server/db-init.js` | Standalone schema init script (local SQLite only) |
| `server/seeds/applicationsData.js` | Side-effect-free module exporting `DEMO_RECORDS` (23 records in SQLite storage shape); consumed by `db-seed.js` and by the demo-store parity test |
| `server/seeds/profileData.js` | Side-effect-free module exporting `DEMO_PROFILE` (frontend shape); consumed by `db-seed-profile.js` and the demo-store parity test |

**API proxy:** Vite dev server proxies `/api/*` → Express on port 3001.

---

## Utilities / Shared

| Path | Purpose |
|------|---------|
| `src/services/api.js` | Fetch wrapper for all `/api/*` calls; auto-attaches `Authorization: Bearer <token>` when `authStore.getAccessToken()` returns one; in demo, every export short-circuits to `src/data/demoStore.js` and never calls `fetch` |
| `src/services/resumeApi.js` | Resume upload client — same auth-header behavior as `api.js`; in demo, throws `{ code: 'DEMO_FEATURE_UNAVAILABLE' }` before any network call |
| `src/services/supabaseClient.js` | Supabase JS client wrapper; reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`; exports `isHostedAuthAvailable` |
| `src/services/healthApi.js` | `getHealth()` — standalone fetcher returning raw `{ status, runtime }` (does not unwrap `data`) |
| `src/data/authStore.js` | Module-state subscribable auth store — `init`, `subscribe`, `getAuthState`, `getAccessToken`, `signOut`, `enterDemo`, `exitDemo`, `DEMO_STATUS`; states `initializing | local-mode | unauthenticated | authenticated | demo`. `init()` has no demo restore path — refresh always ends the demo (feature 020) |
| `src/data/demoStore.js` | In-memory portfolio-demo data adapter (feature 020) — `loadSeed`, `clear`, `getAll`, `getById`, `create`, `update`, `archive`, `getProfile`, `saveProfile`. Reads deep-clone; validation reuses `src/models/application.js` + `src/models/profile.js`; no `localStorage`, `sessionStorage`, `IndexedDB`, or `fetch` |
| `src/data/demoSeed.js` | Demo seed fixture (feature 020) — `buildDemoSeed()` returns `{ applications, profile }` with the 23 SQLite seed records translated to frontend shape and dates shifted so the most recent `lastStatusUpdate` anchors to today; profile biographical dates static |
| `src/utils/filterSort.js` | Client-side filter + sort logic (all 8 filter dimensions) |
| `src/utils/currency.js` | `parseSalaryInput`, `formatSalaryDisplay` — peso salary formatting |
| `src/utils/pagination.js` | Pagination state model |
| `src/utils/date.js` | Date formatting helpers |
| `src/utils/dom.js` | DOM utility helpers |
| `src/utils/icons.js` | SVG icon markup helpers |
| `src/utils/sort.js` | `sortEducation`, `sortExperience` — profile entry sorting |
| `src/utils/url.js` | `getSafeExternalHref` — safe external link handling |
| `src/utils/validate.js` | `validateRequired`, `validateMonthYear`, `validateUrl`, `validateEmail` |
| `src/utils/calendar.js` | Date math helpers for the Calendar page — week-start offset, day-of-week index, ISO week number, month boundary helpers |
| `src/utils/calendarProjection.js` | `projectCalendarMonth(apps, year, month)` — maps application Timeline entries onto a month grid; returns `{ days, eventsByDate }` |
| `src/utils/calendarSuggestions.js` | `evaluateSuggestions(apps, todayISO, dismissals)` — 5 rule-based suggestion kinds: `followup`, `feedback`, `interview_followup`, `offer_expiry`, `ghost`; skips terminal-state apps and apps with future entries |
| `src/utils/calendarDismissals.js` | In-memory dismissal store for Calendar Suggested Actions; `dismiss(key)`, `isDismissed(key)`, `clearAll()` — never touches localStorage (feature 020 FR-004) |
| `src/styles/main.css` | Global styles and CSS design tokens |

---

## Tests

| Path | Purpose |
|------|---------|
| `tests/models/` | Application field validation, status transitions |
| `tests/models/timeline.test.js` | TimelineEntry model helper tests — id allocation, sorting, and legacy synthesis |
| `tests/utils/` | filterSort, pagination, date utilities |
| `tests/utils/calendar.test.js` | Calendar date math helpers |
| `tests/utils/calendarProjection.test.js` | `projectCalendarMonth` — event mapping, boundary cases, empty months |
| `tests/utils/calendarSuggestions.test.js` | `evaluateSuggestions` — all 5 rule kinds, terminal/future-entry guards, dismissal filtering |
| `tests/utils/calendarDismissals.test.js` | In-memory dismissal store — dismiss, isDismissed, clearAll |
| `tests/components/` | Component render / DOM behavior (jsdom) |
| `tests/components/Timeline.test.js` | Timeline component DOM behavior — collapsed/expanded states, add/edit/delete, picker, and sorting interactions |
| `tests/components/calendar/anchoredDropdown.test.js` | `mountAnchoredDropdown` — positioning, outside-click/Esc dismiss, bottom-sheet animation |
| `tests/components/calendar/ActionPanel.test.js` | ActionPanel DOM — Today/Suggestions/Upcoming render, Mark Ghosted, dismiss |
| `tests/components/calendar/MonthGrid.test.js` | MonthGrid DOM — day cells, event dots, keyboard nav, filter-hidden cells |
| `tests/components/calendar/MonthPicker.test.js` | MonthPicker DOM — 12-month grid, current-month highlight, selection |
| `tests/components/calendar/YearPicker.test.js` | YearPicker DOM — year list, current-year highlight, selection |
| `tests/components/QuickFiltersStatusPopup.test.js` | Shared status popup DOM — Tracker-compatible surface, status ordering, Calendar single-select mount behavior |
| `tests/components/calendar/DayPanel.test.js` | DayPanel DOM — prompt/empty/populated states, status priority grouping, mouse + keyboard (Enter/Space) row activation, root identity preserved across updates, deferred variant-prop guard |
| `tests/server/` | Route handlers, Zod validation, DB queries, `requireAuth` middleware, protected-routes wiring |
| `tests/services/` | API client, supabase client, resume API, health API |
| `tests/data/` | Auth store, legacy localStorage store |
| `tests/pages/` | Page-level integration (Tracker, Profile, ProfileEdit, ConfigError) |
| `tests/pages/Calendar.test.js` | Calendar page integration — month nav, status filter, inline DayPanel selection, ActionPanel wiring, greeting name injection, dismiss toast |
| `tests/seed-data.test.js` | Cross-validates demo seed and SQLite seed — parity checks + Calendar suggestion coverage (all 5 kinds exercised with date-shifted records) |
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
| `specs/019-supabase-persistence/spec.md` | Hosted Supabase Postgres persistence layer — feature spec |
| `specs/019-supabase-persistence/plan.md` | Repository factory, RLS policies, migration architecture, boot-time schema check, and per-user seed middleware |
| `specs/019-supabase-persistence/tasks.md` | Phased implementation tasks ledger |
| `specs/019-supabase-persistence/data-model.md` | Postgres schema (applications, profile) + RLS + indices; §5 holds the canonical operator-applied SQL (no separate `.sql` file) |
| `specs/019-supabase-persistence/contracts/api.md` | Internal contracts (dispatcher, Supabase adapter, per-request client, seed step, schema check) — wire-level API responses explicitly unchanged |
| `specs/019-supabase-persistence/quickstart.md` | Operator migration steps + verification |
| `specs/019-supabase-persistence/research.md` | Design decisions with rejected alternatives |
| `specs/019-supabase-persistence/checklists/plan-review.md` | Pre-implementation review gate |
| `specs/020-portfolio-demo-mode/spec.md` | Client-side in-memory portfolio demo — feature spec |
| `specs/020-portfolio-demo-mode/plan.md` | Demo store, auth-status switch, seeded sample data architecture, removal of the 019 `APP_RUNTIME=demo` server slot, and side-effect-free seed extraction |
| `specs/020-portfolio-demo-mode/tasks.md` | Phased implementation tasks ledger |
| `specs/020-portfolio-demo-mode/data-model.md` | In-memory demo data shape (no persistence layer) |
| `specs/020-portfolio-demo-mode/contracts/api.md` | Service-layer demo-mode short-circuit contracts |
| `specs/020-portfolio-demo-mode/quickstart.md` | End-to-end verification walkthrough — exercised against both local dev and the hosted Vercel deploy |
| `specs/020-portfolio-demo-mode/research.md` | Design decisions with rejected alternatives |
| `specs/020-portfolio-demo-mode/checklists/plan-review.md` | Pre-implementation review gate |
| `specs/021-hosted-resume-import-security/spec.md` | Hosted resume import security hardening — feature spec |
| `specs/021-hosted-resume-import-security/plan.md` | Four-layer defense architecture + regression-guard strategy |
| `specs/021-hosted-resume-import-security/tasks.md` | Phased implementation tasks ledger |
| `specs/021-hosted-resume-import-security/data-model.md` | Request/response shapes + sanitized log shape (no persistence added) |
| `specs/021-hosted-resume-import-security/contracts/api.md` | Canonical security model: threat model, four-layer defense, guarantees / non-guarantees |
| `specs/021-hosted-resume-import-security/quickstart.md` | Manual verification recipe for the sanitized-error contract |
| `specs/021-hosted-resume-import-security/research.md` | Design + post-implementation decisions |
| `specs/021-hosted-resume-import-security/checklists/plan-review.md` | Pre-implementation review gate |
| `specs/022-deployment-polish-docs/spec.md` | Deployment polish & docs — feature spec (US1–US4, FR-001..013, SC-001..011) |
| `specs/022-deployment-polish-docs/plan.md` | Docs-only architecture with one `APP_VERSION` literal carve-out; affected areas, risks, validation approach |
| `specs/022-deployment-polish-docs/tasks.md` | Phased implementation tasks ledger |
| `specs/022-deployment-polish-docs/research.md` | Clarification decisions D1–D6 with rejected alternatives |
| `specs/022-deployment-polish-docs/checklists/plan-review.md` | Pre-implementation review gate |
| `specs/025-application-timeline/` | Application Timeline feature spec package — timeline persistence, modal UI, seed updates, hosted migration, release prep, and smoke plan |
| `specs/026-calendar/` | Calendar page feature spec package — month-grid, Action Panel, suggestions engine, day popovers, seed augmentation, release prep, and smoke plan |
| `docs/design/` | Visual specifications and screen-level interaction notes |
| `docs/features/` | Lightweight feature briefs used as Speckit inputs |

---

## Docs

| Path | Purpose |
|------|---------|
| `docs/AI_WORKFLOW_GUIDE.md` | Local two-agent AI orchestration reference (Claude + Codex pipeline) |
| `docs/deployment.md` | Operator-facing deployment guide — local + hosted modes, Supabase Setup Checklist, Environment Variable Checklist, Demo & Free-Tier Notes, Migration Clarification (consolidated in feature 022) |
| `docs/design/welcome_page.md` | Visual specification for the welcome experience |
| `docs/design/calendar.md` | Calendar page interaction and visual design — month-grid layout, Action Panel sections, popover anatomy, suggestion rule logic |
| `docs/db/claim_and_seed_starter.md` | `claim_and_seed_starter()` RPC evolution — v1 (019), v2 (025 Timeline), v3 (026 Calendar suggestions); SQL bodies and operator apply instructions |
| `docs/hosted-smoke-test.md` | Hosted smoke-test checklist — Given/When/Then verification flow run before promoting a deploy (feature 022) |
| `docs/REPO_MAP.md` | This file — navigation shortcut for AI-assisted work |

---

## Static Assets

| Path | Purpose |
|------|---------|
| `src/assets/Alice_White.png` · `Alice_Colored.png` | Brand marks (used by Navbar, Footer, WelcomePage, ConfigError, Auth modal header, Scene 4 of `HeroSlideshow`) |

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
