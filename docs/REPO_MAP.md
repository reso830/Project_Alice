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
| `src/pages/Profile.js` | User profile screen — refreshed overview layout, Archived Applications entry point, Skills meters, and unified Settings card for browser-local AI Settings plus Account controls |
| `src/pages/ProfileEdit.js` | Profile editor — sticky Save/Cancel, dirty-state tracking, section overlays, first-time Setup gate, existing-profile Import Bar, smart paste/upload import, provenance tags, Undo, and `epfFlash` import highlighting. In demo (feature 020) the resume-import slot renders an inline `.profile-edit__resume-demo-note` ("Resume import is available after signing in.") instead of mounting `ResumeImport` |
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
| `src/components/Card.js` | Application card (status badge, star, compat score). Archived-card variant (`.card-archived`) collapses the actions row to a single ↺ Unarchive button, prefixes the date-stamp with `Archived`, and renders an "Archived" stamp chip in row 1 |
| `src/components/Modal.js` | Inline-edit detail modal — edit/create modes, draft management, focus trap. Create mode accepts `aiFields`/`fillSource` (feature 035) to render ✦ AI / ⚙ Auto provenance tags, a dismissible fill banner, a reduced-motion-safe one-time flash, a truncation `notice`, and clear-on-edit. Third `archived` mode (selected by `row.archived === true` at open time) is read-only: ARCHIVED chip in header, ↺+✕ action cluster only, body fields inert, no Save/Discard footer, Esc/backdrop/✕ close without confirmation |
| `src/components/QuickFiltersToolbar.js` | Full filter + sort toolbar — 8 filter dimensions, sort panel, erase-all. Leading view chip toggles Applications ↔ Archived (popup with unfiltered counts for both views); chip count badge reflects current view's filtered count. View chip carries `aria-busy="true"` during in-flight view transitions (feature 029 FR-005) |
| `src/components/FilterPanel.js` | Filter popup renderer — checklist and range-slider panels; used by QuickFiltersToolbar |
| `src/components/SortPanel.js` | Sort popup renderer — used by QuickFiltersToolbar |
| `src/components/ConfirmDialog.js` | Reusable confirmation dialog (archive, discard) |
| `src/components/DeleteAccountModal.js` | Destructive confirmation modal for account deletion / clear-all-data (feature 030) — mode-aware (`hosted` password gate / `local` typed-`DELETE` gate), inline error, busy state, focus trap; `onConfirm(value)` owns the network call (rejecting `INVALID_PASSWORD` keeps it open) |
| `src/components/Pagination.js` | 3-page sliding window UI |
| `src/components/StatusDropdown.js` | Inline status change control |
| `src/components/Timeline.js` | Application Timeline section for the detail modal — collapsed preview, expanded add/edit/delete rows, inline status picker, and status-change helper |
| `src/components/RangeSlider.js` | Dual-handle range slider (salary, compat) |
| `src/components/Toast.js` | User feedback notifications |
| `src/components/Navbar.js` | Top navigation bar — sticky navy band (52px), brand cluster + page nav + identity cluster; email truncated via CSS `max-width` with full value in `title`; door-arrow sign-out button (icon-only at `≤ 639px`); subscribes to `authStore`; `destroy()` unsubscribes. In demo (feature 020) the identity cluster renders a "Demo mode" badge and an Exit demo button that calls `authStore.exitDemo()` |
| `src/components/BottomTabBar.js` | Mobile bottom tab bar (`≤ 639px`) — three tabs (Tracker / Calendar / Profile); same `setActive(page)` contract as Navbar |
| `src/components/Fab.js` | Mobile floating action button — "+ New application" above the bottom tab bar at `≤ 639px`; opens the Create-mode detail modal. Hidden while the Archived view is active |
| `src/components/Footer.js` | Page footer; sources `APP_VERSION` / `ISSUE_URL` / `LICENSE_NAME` / `LICENSE_URL` from `src/pages/welcome/shared/appMeta.js` |
| `src/components/ResumeImport.js` | Drag-and-drop / paste resume parser; subscribes to `authStore` and hides outside `local-mode` / `authenticated`. Feature 034 adds smart-input mode, AI Settings deep link, ask-first AI-unavailable dialogs with reason codes, explicit basic-parser choice, model-aware LLM calls, and Import Bar integration. Exports `VISIBLE_STATUSES` (feature 020 design-by-contract guard — `'demo'` intentionally excluded) |
| `src/components/JobPostingImport.js` | Paste-only AI job-description parser (feature 035) used by the Add-application gate's Smart entry — processing scrim, recoverable reason-code dialogs with a `Use basic parser` fallback, `NO_TEXT` dead-end, locked "Enable AI in Settings →" affordance when AI is off, and a field-level provenance handoff (`aiFieldSet`/`fillSource`) to the Create modal. Calls `parseJobWithLlm`; gated by `aiSettings.canUseJdParser()` |
| `src/components/CompatBar.js` | Compatibility score visual bar — renders `"{score}% {label}"` with a four-band colour from `getCompatLabel` (036), communicating fit without relying on colour alone |
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
| `src/models/profile.js` | Profile validation, normalisation, stat computation, `PROFICIENCY_LEVELS` (language enum). Feature 031: structured skills (`{ name, level }`) with the 1–5 proficiency scale (`SKILL_LEVELS`, `SKILL_FLAVOR`, `SKILL_MAX`, `getSkillLabel`); `normaliseSkillEntry` migrates legacy `string[]` → level 2 and coerces/validates levels; `mergeResumeData` imports skills unrated. Feature 032: `splitProfileForStorage` / `joinProfileWithSkills` (split skills out of / reassemble skills into the profile document) and `skillNameKey` / `dedupeSkillsForStorage` (case-insensitive dedup + blank-drop, reused by `validateProfile`, `DUPLICATE_KEYS`, and both persistence adapters) |
| `src/models/compatibility.js` | Deterministic compatibility engine (036) — pure `computeCompatibility(profile, application, { asOf })` → `{ score, label }`; `COMPAT_WEIGHTS` (skills 43 / roleAlignment 25 / experience 12 / keywords 10 / certifications 10), pooled weighted skill coverage, `COMPAT_BANDS`, `getCompatLabel`, `derivedYears`. No I/O, no `Math.random`, no clock read — time enters only via the caller-supplied `asOf`. Shared by the server service, the demo store, and `CompatBar` |
| `shared/constants.js` | `STATUS_VALUES` — 10 status strings shared between frontend and backend |
| `shared/util/date.js` | `isValidISODate(value)` — round-trip parse that rejects impossible dates like `2030-02-30`. Re-exported by `src/utils/date.js` for the client (form/timeline) and imported by `server/middleware/requestDate.js` for server-side `X-Client-Date` validation (#43) |

**Application fields (required):** `jobTitle`, `companyName`, `status`, `lastStatusUpdate`, `responsibilities`

**Application fields (optional):** `compat` (0–100, **server-computed** since 036 — not client-writable), `minYearsExperience` (036; non-negative integer or null), `skills[]`, `preferredSkills[]`, `fav` (starred), `jobPostingUrl`, `recruiter`, `salary`, `location`, `shift`, `workSetup`, `compatNotes`, `generalNotes`

**Status values:** `wishlisted → applied → phone_screen → interview → assessment → offer → accepted / rejected / withdrawn / ghosted`

---

## Backend / API

| Path | Purpose |
|------|---------|
| `server/index.js` | Express app factory `createApp({ repositories, config, requireAuth?, seedHostedUserIfNeeded? })`; `GET /api/health` returns `{ status, runtime }`; `logBoot()`. CLI boot block lazy-imports the seed middleware in hosted mode only |
| `api/index.js` | Vercel serverless entry — lazy-imports the seed middleware in hosted mode; passes `config` + dispatcher + seed middleware into `createApp` |
| `server/health.js` | `assertHostedSchema(config, { logger? })` — hosted-mode boot check; PostgREST sentinel probes against `applications` (including `applications.timeline` and `applications.min_years_experience` (036)), `profile`, `profile_skill` (032), and `user_seed_state`; throws on `42703` / `42P01` (migration not applied); soft-warns on transient errors |
| `server/routes/applications.js` | CRUD route handlers — accepts `{ repos, requireAuth?, seedHostedUserIfNeeded? }`; uses `attachRepos(repos)` to populate `req.repos`; all handlers `async` with `await` on every repo call (Supabase adapter returns Promises). `GET /` accepts `?view=archived` (strict scalar equality; unknown values fall back to active). `POST /:id/unarchive` mirrors archive. On create/update, computes the server-authoritative `compat` from the current profile via `server/services/compatibility.js` (036; any client-supplied `compat` is ignored) |
| `server/routes/profile.js` | Profile route handlers — same `{ repos, requireAuth, seedHostedUserIfNeeded }` shape. On `PUT /`, after upsert calls `recomputeActive` (036) to rescore all active applications against the saved profile (archived frozen) |
| `server/services/compatibility.js` | Server-authoritative compatibility orchestration (036) — `scoreApplication(appFields, profile, asOf)` (delegates to the pure `src/models/compatibility.js`) and `recomputeActive(repos, profile, asOf)` (rescores active applications via `getAll()`, persisting only changed `compat`). Depends only on the injected `{ applications, profile }` repos + the pure module |
| `server/routes/resume.js` | Resume parse + extract handlers — `{ requireAuth, seedHostedUserIfNeeded }`; doesn't consume repos but mounts seed so a hosted user's first action via resume upload still seeds. `POST /parse` accepts a multipart file **or** a JSON `{ text }` body (rule-based, feature 033); `POST /extract` (033) returns `{ data: { text } }` raw extracted text — stateless, memory-only, no persistence — for the browser-direct LLM path |
| `server/routes/account.js` | `DELETE /api/account` (feature 030) — `{ repos, requireAuth? }`; calls the uniform `req.repos.account.delete(body)` and maps typed adapter errors (`VALIDATION_ERROR` 400 / `INVALID_PASSWORD` 401) to responses. Intentionally mounts **no** `seedHostedUserIfNeeded` (no re-seed on the delete path) |
| `server/auth/middleware.js` | `createRequireAuth({ jwksUri, jwks?, logger })` — verifies Supabase JWTs against the project's JWKS endpoint (`['ES256', 'RS256']` algorithm allowlist) via `jose.jwtVerify`; categorized rejection logging (token contents never logged) |
| `server/auth/seedHostedUser.js` | `seedHostedUserIfNeeded(req, res, next)` — async middleware; calls `client.rpc('claim_and_seed_starter')`; the RPC atomically claims the per-user seed marker and inserts 2 starter applications in one Postgres transaction (idempotent, race-safe, deletion-survivable per FR-014) |
| `server/repositories/index.js` | `createRepositories(config)` returns uniform `{ forRequest(req) }` across `local` and `hosted` runtimes. Hosted lazy-imports the Supabase modules; local never loads `@supabase/supabase-js`. Each bundle includes `applications`, `profile`, and `account` (feature 030) |
| `server/repositories/middleware.js` | `attachRepos(dispatcher)` — Express middleware factory that sets `req.repos = dispatcher.forRequest(req)`; mounted after `requireAuth` in every protected router |
| `server/middleware/requestDate.js` | `resolveRequestDate(req)` — derives the user's local `YYYY-MM-DD` from the `X-Client-Date` request header (regex-validated); falls back to UTC `currentDate()` when the header is missing/malformed (#43) |
| `server/repositories/applications.js` | `createSqliteApplicationsRepository(db)` — local SQLite adapter. `create/update/archive/unarchive` accept an optional `now` (YYYY-MM-DD) which the router supplies via `resolveRequestDate(req)` to stamp audit columns in the user's local timezone (#43). Also exposes `getAllArchived` (returns rows where `archived = 1` in `created_at DESC` order) |
| `server/repositories/profile.js` | `createSqliteProfileRepository(db)` — local SQLite adapter |
| `server/repositories/supabase/client.js` | `createSupabaseClientForRequest(req)` — per-request anon-key Supabase client initialized with the caller's JWT; never reads `SUPABASE_SERVICE_ROLE_KEY` |
| `server/repositories/supabase/applications.js` | `createSupabaseApplicationsRepository(client, userId)` — hosted adapter. RLS-scoped reads/writes via PostgREST; `normalizeForPostgres()` helper coerces SQLite-shaped int booleans + JSON strings to Postgres `bool`/`jsonb` before any write. `archive`/`unarchive` use atomic conditional UPDATE with `.eq('archived', <opposite>)` predicate + fallback `getById` on the no-op path — race-free idempotency symmetric with the SQLite adapter. `getAllArchived` filters `.eq('archived', true)` |
| `server/repositories/supabase/profile.js` | `createSupabaseProfileRepository(client, userId)` — hosted adapter; one-row-per-user `profile` doc + per-user `profile_skill` rows (032). `get` reads the doc then ordered skill rows and reassembles `{ name, level }`; `upsert` and the lazy on-read migration write atomically via the `save_profile_with_skills(p_data, p_skills)` RPC |
| `server/repositories/supabase/account.js` | `createSupabaseAccountRepository({ userId, email })` (feature 030) — hosted `delete(body)`: re-verifies `body.password` via a throwaway anon `signInWithPassword`, then service-role `admin.deleteUser(userId)` (cascade clears the user's rows). Lazy-imports `@supabase/supabase-js` + `adminClient.js` inside `delete()`; password never logged |
| `server/repositories/supabase/adminClient.js` | `createSupabaseAdminClient()` (feature 030) — service-role Supabase client (bypasses RLS; can call the GoTrue Admin API). **Server-only**, lazy-imported on the delete path; never reaches the Vite bundle |
| `server/repositories/account.js` | `createSqliteAccountRepository(db)` (feature 030) — local `delete(body)`: requires `body.confirm === 'DELETE'` (else `VALIDATION_ERROR`), then clears all `applications` + `profile` rows in a single transaction. No re-seed |
| `server/db/applications.js` | SQL query layer for SQLite (re-exports `toRow`/`toRecord` from columns.js for backward compat with foundation.test.js) |
| `server/db/profile.js` | SQL query layer for SQLite profile (`getProfile` / `saveProfile`). Feature 032: skills persist as `profile_skill` rows — `saveProfile` splits skills out of the document and replaces rows inside a transaction; `getProfile` reads ordered rows and reassembles, lazily migrating any still-embedded `skills` on first read (non-skill document preserved verbatim) |
| `server/db/columns.js` | Pure data-layer helpers shared by SQLite + Supabase adapters — `FIELD_TO_COLUMN`, `toRow`, `toRecord`, `currentDate` (UTC fallback, see #43), `APPLICATION_COLUMNS_WITHOUT_USER_ID`, `PROFILE_COLUMNS_WITHOUT_USER_ID`, including `timeline` JSON mapping and read-only `archived_date` projection (`archivedDate` is deliberately absent from `FIELD_TO_COLUMN` — server-set only, dropped from any client PATCH). MUST NOT import `db.js` (would trigger SQLite load in hosted cold start) |
| `server/db.js` | SQLite connection and schema creation; `ensureColumn` cluster handles in-place column adds for evolving columns (e.g. `archived`, `timeline`, `archived_date`, `min_years_experience` (036)). Feature 032: creates the `profile_skill` table (one row per profile skill) with a per-profile index and a case-insensitive unique index on `(profile_id, lower(skill_name))`. Feature 036: `initSchema` runs an idempotent `backfillCompatibility` after the column adds — rescores every application row (active + archived) against the current profile and writes only changed `compat` (injectable `compatBackfillAsOf`) |
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
| `src/services/api.js` | Fetch wrapper for all `/api/*` calls; auto-attaches `Authorization: Bearer <token>` when `authStore.getAccessToken()` returns one; in demo, every export short-circuits to `src/data/demoStore.js` and never calls `fetch`. `getAll({ view })` accepts an optional `view: 'archived'` to fetch the archived list; `unarchive(id)` mirrors `archive(id)`. `deleteAccount(payload)` issues `DELETE /api/account` (feature 030); `request()` fires `authStore.handleAuthFailure()` on a 401/404/500 of an authenticated request |
| `src/services/resumeApi.js` | Resume client — same auth-header + demo-guard behavior as `api.js`; `parseResume(file)` (multipart) and, for feature 033, `extractText(file)` (→ `POST /api/resume/extract`, returns raw text) and `parseText(text)` (→ `POST /api/resume/parse` JSON, rule-based). Never references the OpenRouter key |
| `src/services/llmParser.js` | Browser-direct OpenRouter client — `parseWithLlm(text, key, model)` (resume → profile) and `parseJobWithLlm(text, key, model)` (feature 035; job posting → application draft validated through the application model), both → `{ draft, truncated }` over one shared transport; `validateKey(key)`, `DEFAULT_MODEL` / `LLM_TIMEOUT_MS` (30s) / `MAX_INPUT_CHARS` constants, `REASON_CODES`, and `mapErrorToReason`. The user's key is sent only to OpenRouter, never to Alice's server |
| `src/data/aiSettings.js` | browser-only AI Settings store (feature 034) — `localStorage`-backed enabled flag, OpenRouter key, model slug, feature toggles, and derived connection status. Exposes `canUseJdParser()` (feature 035 gate: master enabled + `jd` feature + key). Lazily migrates feature 033 key/consent into the new shape; consent is folded into saving a key while compatibility shims remain for old callers |
| `src/services/supabaseClient.js` | Supabase JS client wrapper; reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`; exports `isHostedAuthAvailable` |
| `src/services/healthApi.js` | `getHealth()` — standalone fetcher returning raw `{ status, runtime }` (does not unwrap `data`) |
| `src/data/authStore.js` | Module-state subscribable auth store — `init`, `subscribe`, `getAuthState`, `getAccessToken`, `signOut`, `enterDemo`, `exitDemo`, `DEMO_STATUS`; states `initializing | local-mode | unauthenticated | authenticated | demo`. `init()` has no demo restore path — refresh always ends the demo (feature 020). Feature 030 adds `handleAuthFailure()` (revalidates via `getUser()` and signs out a deleted account) plus a one-shot reroute-notice carrier `setAuthNotice(message, type)` / `consumeAuthNotice()` (`ACCOUNT_DELETED_NOTICE`) surfaced by `main.js` on the Welcome reroute |
| `src/data/demoStore.js` | In-memory portfolio-demo data adapter (feature 020) — `loadSeed`, `clear`, `getAll`, `getAllArchived`, `getById`, `create`, `update`, `archive`, `unarchive`, `getProfile`, `saveProfile`. Reads deep-clone; `archive` flips `archived` + sets `archivedDate` (does NOT remove the row); `unarchive` mirrors. Validation reuses `src/models/application.js` + `src/models/profile.js`; no `localStorage`, `sessionStorage`, `IndexedDB`, or `fetch`. Feature 036: `create`/`update` compute `compat` via the shared module (fixed `DEMO_COMPAT_AS_OF`); `saveProfile` recomputes active rows (archived frozen) — server parity client-side |
| `src/data/demoSeed.js` | Demo seed fixture (feature 020) — `buildDemoSeed()` returns `{ applications, profile }` with 23 active SQLite seed records plus 2 client-only archived rows (one favorited non-terminal, one terminal-status unfavorited) translated to frontend shape and dates shifted so the most recent `lastStatusUpdate` anchors to today; profile biographical dates static |
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
| `src/utils/asyncUI.js` | Shared client-side loading + async-state utilities — `bindBusyButton`, `bindContainerBusy`, `renderInlineError`. Used by Modal, Card, CreationPicker, ResumeImport, StatusDropdown, Tracker, Calendar, Profile, ProfileEdit (feature 029) |
| `src/utils/skeletons.js` | Shared DOM-factory builders for loading skeletons — `buildApplicationListSkeleton`, `buildProfileSkeleton`, `buildCalendarSkeleton`, `buildProfileEditSkeleton`, `buildProfileAppsSkeleton` (feature 029) |
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
| `tests/server/api-entry.test.js` | Hosted-mode integration boot of `api/index.js` (Vercel entry) — exercises `assertHostedSchema` wiring, dynamic seed-middleware import, dispatcher construction, and `GET /api/applications` end-to-end against a mocked Supabase client (closes the CI gap left by the cold-start subprocess test) |
| `tests/services/` | API client, supabase client, resume API, health API, LLM parser (`llmParser.test.js`, 033) |
| `tests/data/` | Auth store, legacy localStorage store, AI settings (`aiSettings.test.js`, 033) |
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
| `specs/028-archive-applications-view/` | Archive Applications view feature spec package — view-switcher toolbar chip, archived card variant, read-only Application Overlay archived mode, `unarchive` operation, `archived_date` column, Profile entry-point link, demo-mode archived seeds, and exclusion of archived rows from active workflow surfaces |
| `specs/029-loading-async-states/` | Loading & async states feature spec package — six loading channels (`initial-load` / `refresh` / `save` / `parse` / `mutation` / `transition`), shared `asyncUI.js` + `skeletons.js` utilities, inline-error recovery, button-busy + peer-lockout contracts, view-switcher chip `aria-busy`, demo-mode parity regression suite |
| `specs/030-delete-profile-data/` | Delete Profile & User Data feature spec package — `DELETE /api/account`, service-role admin delete + cascade, server-side password re-verification, local `confirm`-gated clear, Account section on Profile, `DeleteAccountModal`, cross-device session revalidation (`handleAuthFailure`), and v1.0.0 release prep |
| `specs/031-skill-proficiency-system/` | Skill proficiency feature spec package — structured `{ name, level }` skills with a 1–5 scale (`SKILL_LEVELS`), normalise-on-load migration (legacy `string[]` → Basic), centralized validation (unrated / blank / duplicate / max-50), graded-meter Profile display with reveal/sort/collapse, inline level-picker editor, demo + persistence parity, and v1.1.0 release prep |
| `specs/032-profile-schema-refactor/` | Profile schema refactor spec package — promotes profile skills from the JSON document to a first-class `profile_skill` store (SQLite + Supabase), sole-source-of-truth with read-reassembly (transparent API/UI), transactional saves (SQLite txn / `save_profile_with_skills` RPC), idempotent auto-migration on first read, case-insensitive unique-index backstop, `assertHostedSchema` probe, and v1.2.0 release prep |
| `specs/033-llm-resume-cv-parser/` | LLM Resume / CV Parser spec package — AI-assisted resume parsing via browser-direct OpenRouter (BYOK, browser-only key + one-time consent), paste-or-upload input, new `POST /api/resume/extract` + `/parse` JSON text mode, LLM output sanitized through `normaliseProfile` and merged for review, AI-generated field indicators, automatic rule-based fallback (no key / declined / failure / timeout), no server-side persistence of key or content, and v1.3.0 release prep |
| `specs/036-compatibility-engine/` | Compatibility Engine spec package — deterministic profile-vs-JD scoring in a pure shared module (weighted skills/role/experience/keywords/certifications, proficiency weighting, graded experience, renormalization, Low/Medium/High/Great bands), server-authoritative compute on create/update + active recompute on profile save (archived frozen), demo parity via the same module, optional `min_years_experience` column + `assertHostedSchema` probe, removal of client-writable/random `compat`, one-time legacy backfill (all rows incl. archived), CompatBar band label, and v1.6.0 release prep |
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
| `docs/design/loading.md` | Channels + visual conventions for loading + async UX — six channels, skeleton vocabulary, inline-error block, button-busy contract, reduced-motion inheritance, quickref for adding new surfaces (feature 029) |
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
