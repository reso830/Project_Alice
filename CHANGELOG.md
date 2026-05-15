# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] — 2026-05-16

### Added
- Hosted authenticated user access via Supabase email/password — feature 018-auth-user-access; local mode is unchanged and remains the default
- `allowed_emails` table + `auth.users` `BEFORE INSERT` trigger — operator-managed allowlist enforced inside Postgres so unauthorized signups never reach `auth.users`
- `server/auth/middleware.js` — `createRequireAuth({ jwtSecret, logger })` factory; verifies `Authorization: Bearer <jwt>` against `SUPABASE_JWT_SECRET` using HS256; logs categorized rejections (`missing | malformed | expired | signature | other`) with redacted-path context, never the token
- `/api/health` now returns `{ status, runtime: 'local' | 'hosted' }` so the frontend can detect a runtime/config mismatch
- `createApp({ repositories, config, requireAuth? })` — `server/index.js` factory now accepts an optional `requireAuth`; hosted mode throws if `supabase.jwtSecret` is missing and no explicit `requireAuth` is passed
- `logBoot(config)` — single-line `[runtime] mode=<runtime> port=<port>` entry so operators can grep the active mode in production logs
- `src/services/supabaseClient.js` — Supabase JS client wrapper; reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`; exports `isHostedAuthAvailable`
- `src/data/authStore.js` — module-state subscribable auth store with `init`, `subscribe`, `getAuthState`, `getAccessToken`, `signOut`; states: `initializing | local-mode | unauthenticated | authenticated`
- `src/services/healthApi.js` — `getHealth()` standalone fetcher returning the raw `{ status, runtime }` envelope (does not go through `request()`'s `data` unwrap)
- `Authorization: Bearer <token>` automatically attached by `src/services/api.js` and `src/services/resumeApi.js` whenever `authStore.getAccessToken()` returns a value
- `src/pages/welcome/WelcomePage.js` — diagonal-split landing page with brand block, headline, three CTAs (Sign In, Create Account, Try Demo), floating metadata pills with illustrative disclaimer, footer metadata, and a `?auth=callback` verification banner handler that cleans the URL while preserving other query params
- `src/pages/welcome/HeroSlideshow.js` — 5-second auto-rotating screenshot slideshow, single static slide under `prefers-reduced-motion: reduce`
- `src/pages/welcome/AuthOverlay.js` — centered-modal overlay with `role="dialog"` + `aria-modal`, tab strip with login/signup switching, focus trap, ESC + backdrop + close-button dismissal, previous-focus restoration, `verification_sent` state, `dispose()` cleanup path used by parent unmount
- `src/pages/welcome/LoginForm.js` — email/password login form with neutral error copy and accessible inline loading state (`aria-busy`, mirrored `aria-live` status)
- `src/pages/welcome/SignupForm.js` — email/password signup with inline field validation (email regex, password min 8), neutral signup-rejection error (never leaks the cause), and `onSuccess` → overlay transitions to `verification_sent`
- `src/pages/ConfigError.js` — operator-facing fallback page; mounted when the hosted runtime handshake (`getHealth()` returns `runtime: 'hosted'` but `isHostedAuthAvailable` is false) detects missing Vite env vars
- `bootstrap()` + `runtimeHandshake()` exports in `src/main.js` — runtime handshake now runs BEFORE `authStore.subscribe` / `init`, so a misconfigured hosted deploy never flashes the welcome page or app shell before ConfigError replaces it
- `Navbar` user segment — email (truncated past 24 chars with full value in `title`) + Sign Out button; hidden in `local-mode` and `unauthenticated`; `Navbar.destroy()` unsubscribes from `authStore`
- `ResumeImport.create()` subscribes to `authStore` and toggles `root.hidden` based on auth state — gated to `local-mode` / `authenticated` only
- Welcome + auth overlay + ConfigError CSS in `src/styles/main.css` — diagonal-split layout (55% content / 62% hero anchored right with the design's clip-path), responsive breakpoints (≥1100px / 760–1100px / <760px / <420px), reduced-motion media query disabling card transforms and overlay entrance
- Six hero screenshots in `src/assets/welcome-hero/` (`tracker`, `application-modal`, `profile`, `filters`, `calendar`, `mobile-tracker`)
- Vite build-time assertion (`assertHostedFrontendEnv`) — production builds fail closed when any of `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL` is missing
- `SUPABASE_JWT_SECRET` added to the hosted-required env-var list in `server/config.js`
- `@supabase/supabase-js` (^2.45.0) and `jsonwebtoken` (^9.0.2) dependencies
- Spec package at `specs/018-auth-user-access/` — `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/api.md`, `research.md`, `quickstart.md`, `checklists/plan-review.md`
- `design/welcome_page.md` — visual specification for the welcome experience
- Test suites: `tests/server/auth-middleware.test.js`, `tests/server/routes-protected.test.js`, `tests/data/authStore.test.js`, `tests/services/{supabaseClient,healthApi,resumeApi}.test.js`, `tests/components/{welcome,heroSlideshow,navbar,resumeImport}.test.js`, `tests/pages/configError.test.js`, `tests/main.test.js`, `tests/build/vite-config.test.js`

### Changed
- `createApp()` signature now `({ repositories, config, requireAuth? })`; route factories (`createApplicationsRouter`, `createProfileRouter`, `createResumeRouter`) likewise accept `{ repo, requireAuth }`
- `unmountAppShell` in `src/main.js` calls `Navbar.destroy()` to clean up the auth-store subscription on transitions back to the welcome page
- `ResumeImport.create()` always returns an element; visibility now driven by `root.hidden` from a subscription, with completion state tracked separately so post-import hiding survives auth-state transitions

### Security
- Allowlist enforcement lives in a Postgres `SECURITY DEFINER` trigger on `auth.users` — an Express endpoint approach was considered and rejected because it could be bypassed by direct Supabase calls from the browser
- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` are server-only — neither appears in `src/` or in the Vite production bundle (verified in Phase 12)
- JWT verification pins HS256 algorithm explicitly to defeat `alg: none` attacks
- Token contents are never logged; categorized rejection logs include `category` and request path only

## [0.7.0] — 2026-05-13

### Added
- Resume Import — upload a PDF, DOCX, or TXT resume from the Profile page; extracted text is parsed and mapped into profile fields; the Edit Profile page opens pre-filled for review before the user decides to save; no automatic profile saving occurs
- `POST /api/resume/parse` — multipart upload endpoint; enforces a 5 MB size limit; dispatches to `pdf-parse` (PDF) or `mammoth` (DOCX) for text extraction; regex-based section and field parser extracts structured profile data
- `server/resume/extractor.js` — file-type dispatcher for PDF and DOCX text extraction
- `server/resume/parser.js` — regex and pattern-based parser; maps section headings and field patterns to typed profile field shapes
- `src/components/ResumeImport.js` — drag-and-drop upload component with idle, uploading, success, and error states; accessible file-input fallback
- `src/services/resumeApi.js` — frontend API client for the resume parse endpoint
- `mergeResumeIntoProfile()` in `src/models/profile.js` — non-destructive merge of AI-extracted fields into an existing profile; existing non-empty fields are never overwritten
- `mammoth` and `pdf-parse` server dependencies for document text extraction
- Test suites for resume parsing (`tests/server/resumeParser.test.js`), API routes (`tests/server/resume.test.js`), and profile merge logic (`tests/models/resumeMerge.test.js`)
- `LICENSE` — PolyForm Noncommercial License 1.0.0; Copyright 2026 Alvin

## [0.6.0] — 2026-05-09

### Added
- Inline edit modal — click any field in the detail view to edit it in place; outside-click commits the change to draft; Esc reverts the field without committing; Cmd/Ctrl+S saves; Cmd/Ctrl+Enter commits a multi-line field
- Create mode — `+ New application` button opens an empty draft modal with status defaulting to Wishlisted; saving creates the record and switches the modal to edit mode; Archive button hidden in create mode; footer always visible
- Draft management — footer appears when any field differs from the saved record; Save and Discard buttons; discard confirmation guard on ✕, backdrop click, and Esc; Favorite and Archive bypass the draft
- Six new optional application fields: `location` (free text), `shift` (Day/Mid/Night/Flexible), `workSetup` (Remote/Hybrid/On-site/Field), `compatNotes` (rich notes alongside the compatibility bar), `generalNotes` (free-text notes), `preferredSkills` (chip editor, separate from required skills)
- Quick filters toolbar — filter the card list by Status, Salary range (₱50k–₱250k dual-handle slider), Compatibility range (0–100 dual-handle slider), Company, Favorites, Shift, Work Setup, and Location; multiple filters stack with AND logic; subheader label switches to "Results" when any filter is active; erase-all button clears all filters at once
- "(Not set)" option in Shift, Work Setup, and Location filter panels — matches applications where that field is empty or null
- Sort panel — sort by Job ID, Status, Compatibility, Salary, or Company in ascending or descending order; Restore default resets to Job ID ascending
- Filter state persists to `localStorage` (key `apptracker_filters`) and is restored on page load; invalid enum values stripped on restore; location strings kept as-is; sort state is session-only
- Empty-filter state — "No applications match the active filters." shown in place of the card list when active filters return zero results
- Required field visual indicators (asterisk `*`) on job title, company name, and responsibilities fields within the overlay
- `parseSalaryInput()` and `formatSalaryDisplay()` utilities in `src/utils/currency.js` — parse user-entered peso amounts from formatted strings; format integers for display
- `scripts/ai-flow.ps1` — PowerShell orchestrator for a two-agent AI pipeline (Claude + Codex) with hard gates at each stage; includes `run-all` action to loop through all phases automatically
- `scripts/prompts/` — nine prompt templates covering the full pipeline: specify, plan, tasks, spec review, requirements check, phase implementation, phase review, and PR review (Claude and Codex variants)
- `docs/AI_WORKFLOW_GUIDE.md` — full reference for the local AI workflow: actions, gate system, log locations, recovery flows, and FAQ
- `docs/REPO_MAP.md` — codebase navigation shortcut for AI-assisted implementation; covers pages, components, backend, utilities, key boundaries, and common change patterns
- `features/` directory with example feature brief template
- `.gitignore` entries for AI workflow state files (`specs/**/.ai-phase`, `specs/**/.ai-requirements-ready`, `specs/**/.ai-phase-*-review`)

### Changed
- `responsibilities` field promoted to required — must be non-empty on Save and Create; existing records retain their stored value but validation is enforced on all new saves
- Detail modal header background is now the status `borderAccent` color (not `--navy`); header text color resolves to white or black based on relative-luminance contrast
- Status change in the modal now routes through the draft — the header color and badge update immediately but the `lastStatusUpdate` date is not written until Save
- DB schema auto-migrates — six new nullable columns (`location`, `shift`, `work_setup`, `compat_notes`, `general_notes`, `preferred_skills`) are added via `ensureColumn` on server start; existing records are unaffected
- `db:seed` updated — demo records include representative values for all new fields (shift, workSetup, location, compatNotes, generalNotes, preferredSkills)
- `CLAUDE.md` and `AGENTS.md` updated to reflect implemented app state (Vite/Express/SQLite), constitution v1.0.1, required date field (`lastStatusUpdate`), and correct directory conventions (`.agents/skills/` as shared source; `.codex/` lowercase for Codex-specific state)

### Fixed
- Newline characters in multi-line fields (responsibilities, compatibility notes, general notes) now render as visual line breaks in display mode instead of collapsing to a single line
- Sort popup no longer clips above the visible viewport when opened while the page is scrolled down on desktop
- Overlay quick action buttons now show exactly one tooltip via the `title` attribute; duplicate `aria-label` removed to prevent double-tooltip in some browsers
- Chip editor (Required Skills, Preferred Skills) no longer throws JavaScript errors when Enter keydown and blur fire simultaneously — a `_committingByEnter` flag prevents concurrent DOM re-renders
- Long text and URLs in the overlay no longer overflow their containers on narrow viewports — `overflow-wrap: break-word` applied
- Status pill in the overlay header remains legible on very narrow viewports (≤320px) — text centered when wrapped to two lines
- Salary field now displays "–" instead of blank when no value is set, consistent with all other optional text fields
- Modal discard in create mode no longer no-ops — `_attemptDiscardDraft()` now calls `close()` directly when `_mode === 'create'` instead of falling through the null guard
- `Find-SpeckitSpecDir` now resolves the requested feature name before falling back to the current branch, preventing misrouting when `-FeatureName` differs from the active branch
- Removed silent latest-spec fallback in `Find-SpeckitSpecDir`; unresolved names now throw immediately

## [0.5.1] — 2026-04-29

### Added
- Overlay-based add and edit flows for all six structured profile sections — Experience, Education, Certifications, Awards, Languages, and Links; modal on desktop (≥ 640 px), bottom-sheet on mobile with fly-in animation; overlay includes focus trap, ESC dismiss, and backdrop-click cancel
- Skills staging overlay — skills are staged as pills inside the overlay and merged into the main form only on Save; case-insensitive duplicate deduplication
- Discard confirmation inside overlays — "Discard entry changes?" with a red Discard button appears when cancelling a dirty overlay; ESC and backdrop click route through the same flow
- Edit icon on each structured entry row — opens a pre-filled overlay; saving updates the entry in-place without adding a duplicate
- Structured display for Certifications on the View Profile page — name, issuing body, date range, and optional Certificate ID rendered in a hierarchy matching the Education section
- Structured display for Awards on the View Profile page — award name, issuing body and date as meta, details paragraph below
- `validateYear` — four-digit year validator (≥ 1900) applied to Education's Year Completed field in both the overlay form and `validateProfile`
- `beforeunload` guard on the Edit Profile page — triggers the browser's native "Leave site?" dialog when there are unsaved changes

### Changed
- Edit Profile section order now matches View Profile: Basic Info → Summary → Experience → Education → Skills → Certifications → Awards → Languages → Links
- All structured entry sections use a title/meta/desc hierarchy with dedicated Edit and Remove icon buttons; "Add" button moved to the section header with primary styling
- Edit overlay saves use card-local re-render instead of full page rebuild, preventing scroll position reset on every entry edit
- Overlay form fields have consistent 14 px gap between fields
- Discard button styled red (`#c1121f`) across both the overlay discard dialog and the page-level discard modal
- iPad Mini stat chip layout — `.apps-desktop-vis__stats .stat-chip-row` overrides to a 2 × 2 grid, preventing chip overflow at 768 px

### Fixed
- Education Year Completed now validates year format in addition to required-field check
- Remove icon on the main skills card now uses `×` (was ASCII `x`)
- `.entry-row__edit` CSS now uses `var(--color-accent)` directly; undefined `--accent` fallback removed
- Awards entry no longer passes an empty string to the display helper when details are absent

## [0.5.0] — 2026-04-29

### Added
- Profile Edit page — full rewrite from section-by-section placeholder to a centralized inline editor with global Save/Cancel controls, dirty-state tracking, and a discard confirmation modal (keyboard-accessible, scroll-locked backdrop)
- Sticky subheader bar on the Edit Profile page — "Edit Profile" title with Save and Cancel buttons always visible without scrolling; Cancel triggers the discard flow; no separate back button
- Navbar discard guard — clicking any nav bar link while unsaved changes exist shows the discard confirmation modal before navigation proceeds
- Inline add/remove flows for all seven list-based profile sections: Skills (pill tags, case-insensitive duplicate deduplication, Enter key shortcut), Languages (language + proficiency dropdown), Certifications, Education (sorted newest-first by year), Professional Experience (sorted current-first then by end date), Links (URL validation, safe-protocol enforcement), Awards
- One-at-a-time inline form constraint — opening a second section's form while one is already open has no effect; Save is blocked and shows a persistent inline error (not a toast) while any form is open
- Structured entry data model — Experience, Education, Certifications, Awards, Languages, and Links now stored as typed entry objects instead of plain strings; backward-compatible normaliser migrates old string-array profiles on first read
- Client-side validation for all entry types: required fields, MM/YYYY date format, URL protocol enforcement, email format; errors surfaced inline below the relevant field before save; section-level summary shown if migrated entries have unfilled required fields
- Server-side validation for all structured entry fields via extended `validateProfile`; server returns `400 VALIDATION_ERROR` on invalid entries
- Required field visual indicators — red asterisk appended to all required field labels throughout the editor
- Inline form two-column row layouts — Language (language + proficiency), Certification (issuance date + expiry date), Experience (date started + date ended + current work checkbox) on viewports ≥ 640 px
- Experience Date Ended field disabled and dimmed when Current Work is checked; re-enabled and required when unchecked
- Compact icon remove button on all list entry rows (26 × 26 px, accessible `aria-label`, red hover state)
- Section header navy accent color on the Edit Profile page
- `src/utils/validate.js` — `validateRequired`, `validateMonthYear`, `validateUrl`, `validateEmail` pure validators
- `src/utils/sort.js` — `sortEducation` (by year completed descending) and `sortExperience` (current roles first, then by end date descending, then by start date)
- `src/utils/url.js` — `getSafeExternalHref` extracted and shared by Profile and ProfileEdit pages

### Changed
- Profile page updated to render new structured entry shapes: `responsibilities`/`dateStarted`/`currentWork` for experience; `degreeMajor`/`university`/`yearCompleted` for education; certifications, awards, languages, and links rendered as objects
- `src/models/profile.js` extended with per-type entry normalisers and comprehensive `validateProfile` covering all entry-level required fields; `PROFICIENCY_LEVELS` exported
- `certifications[].issuingBody` is now required (was previously optional); profiles with a blank issuing body will fail validation at save, prompting the user to update before saving

## [0.4.0] — 2026-04-28

### Added
- Profile page — welcome header personalised with first name, application stats (total, active, pending, offer) with an interactive donut chart and collapsible legend, and a full profile card with collapsible subsections (Summary, Experience, Education, Skills, Languages, Certifications, Awards, Links)
- Profile edit page — section-by-section editing; each card saves independently using a read-merge-write pattern so unedited fields are never overwritten
- `GET /api/profile` and `PUT /api/profile` — SQLite-backed profile persistence; profile stored as a single JSON record
- `server/db/profile.js` — profile repository with UPSERT logic
- `server/routes/profile.js` — `createProfileRouter()` factory matching the existing applications router pattern
- `src/models/profile.js` — `validateProfile`, `normaliseProfile`, `computeAppCounts`, `computeStats`, `STATUS_COLORS`, `STATUS_LABELS`
- `src/components/DonutChart.js` — SVG donut chart with per-segment hover tooltips; Largest Remainder Method for exact integer percentages; degenerate 100% case handled as two arcs to avoid invalid SVG paths
- `src/components/StackedBar.js` — horizontal proportional bar with tap-to-label interaction for mobile
- Responsive chart layout — desktop shows donut + legend, mobile shows stacked bar + tap labels; both always in DOM, toggled via CSS `@media`
- Collapsible profile subsections — expanded on desktop, collapsible on mobile via `.is-collapsed` class toggle
- XSS-safe external link rendering — only `http:`/`https:` hrefs are passed through; `javascript:` and all other schemes fall back to `#`
- `npm run db:seed:profile` — populate the profile table with demo data
- `npm run db:clear:profile` — clear the profile table (returns the profile page to the no-profile state)
- Server integration tests for the profile API (`tests/server/profile.test.js`)
- Page-level tests for the Profile page (`tests/pages/Profile.test.js`)
- Component tests for DonutChart (`tests/components/DonutChart.test.js`)

## [0.3.0] — 2026-04-26

### Added
- Client-side pagination on the application list — visible only when total records exceed 10; 3-page sliding window with first/last anchors and non-clickable ellipsis separators
- Persistent site footer on every page — brand identity, version info, tech stack credits, and feedback links (GitHub Issues)
- `src/utils/pagination.js` — `getPaginationModel()` pure function encapsulating the windowing algorithm
- `src/components/Pagination.js` — page navigation component with full ARIA labelling (`aria-label`, `aria-current="page"`)
- `src/components/Footer.js` — footer component with inline brand SVG, version/stack sections, and feedback links
- `src/assets/` — project logo files (`Alice_White.png`, `Alice_Colored.png`); white variant used in header and footer
- `jsdom` dev dependency for component-level DOM tests
- Page-change behaviour: scrolls to top and moves keyboard focus to the list region
- Page preservation on dataset change: current page retained when still valid; clamped to highest valid page when invalid; reset to 1 when pagination disappears
- Component tests for Pagination and Footer (`tests/components/`)
- `npm run db:seed` — loads 23 demo records covering all 9 statuses (one archived); clears existing data first
- `npm run db:clear` — deletes all rows without touching the schema

### Changed
- Footer and navbar now use `Alice_White.png` logo instead of placeholder SVG/div icons
- Sticky footer layout: `body` uses flex column with `min-height: 100%`; `#app` takes `flex: 1` to push footer to viewport bottom on short pages
- Footer reflows to 2-column grid on viewports narrower than 640 px

## [0.2.0] — 2026-04-26

### Added
- SQLite-backed Express REST API (`server/`) replacing `localStorage` as the persistence layer
- `POST /api/applications` — create an application with full validation (Zod)
- `GET /api/applications` — list all non-archived applications
- `GET /api/applications/:id` — fetch a single application (archived records included)
- `PATCH /api/applications/:id` — partial update with status-change tracking (`lastStatusUpdate` bumped only on actual status change)
- `POST /api/applications/:id/archive` — soft-delete via `archived` flag
- `GET /api/health` — liveness probe
- Shared `STATUS_VALUES` constant (`shared/constants.js`) imported by both frontend and backend
- `src/services/api.js` — fetch-based API client with typed error envelopes (`NETWORK_ERROR`, `VALIDATION_ERROR`, `NOT_FOUND`)
- `npm run db:init` script to initialize or re-initialize the SQLite schema
- `npm run server:dev` / `npm run server:start` scripts
- Integration test suite for all API endpoints (`tests/server/applications.test.js`)
- `makeMemoryDb()` and `makeTestDb()` test helpers for isolated SQLite databases
- GitHub Actions Node.js CI workflow for pushes to `main` and pull requests targeting `main`
- CI test-result generation via `npm run test:ci`, with Vitest JUnit output written under `test-results/vitest/`
- Ignored output directories for local logs and generated test results

### Changed
- Frontend reads (`getAll`, `getById`) and writes (`create`, `update`, `archive`, `fav` toggle) now go through the API instead of `localStorage`
- `src/data/store.js` retained but marked `@deprecated` — no longer the active persistence layer
- Card and modal field references updated to match API names (`jobTitle`, `companyName`, `jobPostingUrl`, `lastStatusUpdate`)
- Lint script now covers `server/` and `shared/` in addition to `src/` and `tests/`
- All system date fields (`createdAt`, `updatedAt`, `lastStatusUpdate`) stored as `YYYY-MM-DD` (date-only)

## [0.1.0] — 2026-04-25

### Added
- Application tracker UI with card-based list view
- Nine-state status workflow (Wishlist, Applied, Phone Screen, Interview, Technical Assessment, Offer, Rejected, Withdrawn, Ghosted)
- Add and edit forms with required-field validation and URL checking
- Full detail modal with all application fields
- Search and status filter
- Compatibility bar (0–100% job match indicator)
- Quick actions per card: star, copy URL, status change, edit
- Local-first `localStorage` persistence
- Centralized data store (`src/data/`)
- Application model and validation rules (`src/models/application.js`)
- CSS design tokens for colors, typography, spacing, and responsive breakpoints
- Vitest test suite for core validation logic
- ESLint v9 configuration

[Unreleased]: https://github.com/reso830/Project_Alice/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/reso830/Project_Alice/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/reso830/Project_Alice/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/reso830/Project_Alice/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/reso830/Project_Alice/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/reso830/Project_Alice/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/reso830/Project_Alice/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/reso830/Project_Alice/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/reso830/Project_Alice/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/reso830/Project_Alice/releases/tag/v0.1.0
