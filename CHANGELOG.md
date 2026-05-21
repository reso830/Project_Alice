# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.12.0] — 2026-05-21

### Added

- Application Timeline section in the detail overlay: collapsed preview,
  inline add/edit/delete, future-dated entries, and automatic Timeline
  entries when status changes.
  (025-application-timeline)
- Seeded Timeline content in the local SQLite DB seed, in-browser demo
  seed, and hosted starter applications.
  (025-application-timeline)

### Changed

- Replaced the visible *Last Updated* row in the application detail
  overlay with the Timeline preview. The underlying `lastStatusUpdate`
  field is still stored and bumped for status changes.
  (025-application-timeline)
- Modal max-height now clamps at 860px so tall Timelines scroll inside
  the modal body while the header and footer remain pinned.
  (025-application-timeline)
- `claim_and_seed_starter()` RPC body updated to seed Timeline content
  for new hosted users.
  (025-application-timeline)

### Removed

- Removed the visible *Last Updated* row from the application detail
  overlay. No data was removed.
  (025-application-timeline)

## [0.11.1] — 2026-05-20

> Documentation polish release — feature 022-deployment-polish-docs.
> Consolidated hosted-deployment operator surface (README refresh +
> `docs/deployment.md` expansion + new `docs/hosted-smoke-test.md`).
> No runtime, schema, endpoint, or dependency changes. Only code
> touch is the in-app `APP_VERSION` literal keeping pace with
> `package.json` per constitution Amendment 1.3.0.

### Docs

- Refreshed README "Hosted Mode" section: three runtime modes
  (local / hosted / demo) summarised in one place, with pointers to
  the consolidated operator surface in `docs/deployment.md`.
  (022-deployment-polish-docs)
- Expanded `docs/deployment.md` with four new sections:
  **Environment Variable Checklist** (deployer pass/fail framing
  alongside the existing Reference table), **Supabase Setup
  Checklist** (one ordered procedure consolidating features 018 +
  019 quickstarts plus an explicit RLS-policy verification step),
  **Demo & Free-Tier Notes** (Vercel Hobby cold starts, Supabase
  Free pause, demo reset, hosted seeded data), and
  **Migration Clarification** (local SQLite does not migrate to
  hosted; migration tooling is future work).
  (022-deployment-polish-docs)
- Added `docs/hosted-smoke-test.md` — standalone Given/When/Then
  smoke-test checklist for pre-promotion hosted verification.
  Seven sections: login, demo, CRUD, profile editing, cross-user
  authorization (RLS-scoped 404 check with proper Bearer-token
  fetch), resume-import restrictions, and 375px mobile layout.
  (022-deployment-polish-docs)
- `docs/REPO_MAP.md`: added a `## Docs` section cataloguing
  `AI_WORKFLOW_GUIDE.md`, `deployment.md`, `hosted-smoke-test.md`,
  and `REPO_MAP.md`; added Spec Packages rows for
  `specs/022-deployment-polish-docs/`.
  (022-deployment-polish-docs)

### Changed

- `APP_VERSION` literal bumped to `'v0.11.1'` in
  `src/pages/welcome/shared/appMeta.js` to stay in sync with
  `package.json` per constitution Amendment 1.3.0 (in-app version
  display in lockstep with SemVer).
  (022-deployment-polish-docs)

## [0.11.0] — 2026-05-20

> Hosted resume import security release — feature 021-hosted-resume-import-security.
> Pure security hardening + regression guards on the existing
> `POST /api/resume/parse` endpoint. No new endpoints or env vars. The
> user-observable delta is a sanitized error code for corrupted files;
> everything else is invariant-pinning plus a serverless PDF runtime shim.

### Added
- `PARSE_FAILED` error code for `POST /api/resume/parse` — returned
  when the file parser throws (corrupted PDF, malformed DOCX,
  empty/garbled file). The response is
  `400 { error: { code: 'PARSE_FAILED', message: 'Could not read this resume. Try a different file.' } }`.
  The raw library error is logged server-side via
  `console.error('[resume.parse]', { error, stack, nameSha8, mimetype, path })`
  with an 8-char SHA-256 prefix of the filename (not the raw filename)
  and the request path; the resume content and the raw filename are
  never logged.
- `specs/021-hosted-resume-import-security/contracts/api.md` —
  canonical post-021 security model for the parse endpoint:
  threat model, four-layer defense (frontend demo gate → server
  auth → multer validation → parser validation), explicit guarantees
  (`§4.1` auth required, `§4.2` no disk write, `§4.3` no Supabase
  persistence, `§4.5` fixed error code set, `§4.7` service-role-key
  unreachable), and explicit non-guarantees (no malware scan, no
  rate limiting, global 500 handler unchanged).

### Changed
- Pre-021, corrupted-file uploads fell through `next(error)` to the
  global 500 handler at `server/index.js:74-91`, which echoed
  `err.message` — exposing library internals (`pdf-parse` stack text,
  `mammoth` ZIP error strings, internal paths) to the client. The
  new resume-route catch sanitizes the response. The global 500
  handler is unchanged for every other route.
- Every non-`LIMIT_FILE_SIZE` `multer.MulterError`
  (`LIMIT_UNEXPECTED_FILE`, `LIMIT_FIELD_KEY`, `LIMIT_FIELD_VALUE`,
  `LIMIT_FIELD_COUNT`, `LIMIT_FILE_COUNT`, `LIMIT_PART_COUNT`) is
  now mapped to `400 VALIDATION_ERROR` with the raw multer message
  logged server-side — closing FR-007's "no client-shape error
  reaches the global 500 handler" guarantee.
- PDF extraction now installs `DOMMatrix`, `ImageData`, and `Path2D`
  globals from `@napi-rs/canvas` before loading `pdf-parse`, and
  points PDF.js at `pdf-parse`'s embedded data-URL worker instead of
  the default `./pdf.worker.mjs` path. Valid PDFs now parse in
  Vercel's Node/serverless runtime even when browser canvas globals
  and untraced worker files are absent. `@napi-rs/canvas` was already
  present transitively via `pdf-parse`; it is now direct so the
  runtime shim is explicit.

### Internal
- New regression guards in `tests/server/resume.test.js` —
  `describe('resume API — hosted auth gate (FR-001, FR-009)')`
  (2 cases) pins the hosted unauthenticated → 401 contract;
  `describe('resume API — in-memory invariant (FR-002, FR-010)')`
  (5 cases) installs pass-through `fs.write*` / `fs.open*` /
  `fs.promises.*` spies and asserts zero write-mode calls across
  happy + four failure paths;
  `describe('resume API — service-role credential isolation (FR-012)')`
  (5 cases) reads each resume-code-path file and asserts neither
  `SUPABASE_SERVICE_ROLE_KEY` nor `service_role` appears.
- New corrupted-file + log-shape + FR-007 sweep tests in the same
  file pin the new `PARSE_FAILED` mapping, the sanitized response
  body (no `pdf-parse`/`pdfjs`/`mammoth`/`node_modules` substrings),
  and the sanitized log object (`nameSha8` / `mimetype` / `path`
  present, raw filename absent).
- Added 18 new tests across the three new describe blocks plus the
  corrupted-file, log-shape, FR-007 sweep, and `LIMIT_UNEXPECTED_FILE`
  cases, including a valid-PDF regression with DOM canvas globals
  deleted and the embedded PDF worker selected.

## [0.10.0] — 2026-05-19

> Portfolio demo mode release — feature 020-portfolio-demo-mode.
> A purely client-side, in-memory demo of the tracker is now reachable
> from the welcome page's "Try the demo" CTA. Local SQLite and hosted
> Supabase modes are unchanged. The reserved `APP_RUNTIME=demo` slot
> from 019 is removed; setting it now fails at boot.

### Added
- Portfolio demo mode — public visitors can click **Try the demo** on
  the welcome page (or the auth-modal's demo button) to explore the
  tracker and profile with 23 seeded sample applications and a fully
  populated demo persona (Alex Rivera). Application date and
  `lastStatusUpdate` are shifted at session start so the most recent
  record reads as "today" while preserving relative spacing. Profile
  biographical dates remain static. Demo state lives in module-level
  memory only and resets on every browser refresh (FR-005); no API
  calls, no `localStorage`, `sessionStorage`, IndexedDB, or cookie
  writes occur during a demo session
- `'demo'` auth status — `src/data/authStore.js` gains `DEMO_STATUS`,
  `enterDemo()`, and `exitDemo()`; `init()` has no demo restore path
  (refresh ends the demo by design)
- In-memory demo data layer — `src/data/demoStore.js` provides the same
  CRUD surface as the network adapter (`getAll` / `getById` / `create`
  / `update` / `archive` / `getProfile` / `saveProfile` / `loadSeed` /
  `clear`) with deep-cloned reads, validation reused from
  `src/models/application.js` and `src/models/profile.js`, and the
  standard `{ code, message, fields? }` error shape; `src/data/demoSeed.js`
  exposes `buildDemoSeed()` returning a fresh applications + profile
  pair
- Side-effect-free SQLite seed modules — `server/seeds/applicationsData.js`
  and `server/seeds/profileData.js` expose `DEMO_RECORDS` and
  `DEMO_PROFILE` as pure constants so the demo's parity tests can
  assert byte-for-byte equivalence with the SQLite seed without
  opening the database or calling `process.exit`
- Service-layer mode switch — `src/services/api.js` short-circuits all
  seven exported functions to `demoStore` when `getAuthState().status
  === 'demo'`, never touching the network in demo; `src/services/resumeApi.js`
  throws `{ code: 'DEMO_FEATURE_UNAVAILABLE' }` immediately in demo
- Navbar Demo affordance — `src/components/Navbar.js` renders a
  "Demo mode" badge and an **Exit demo** button (door-arrow icon
  matching the sign-out button) when status is `'demo'`; clicking the
  button calls `authStore.exitDemo()` and toasts "Exited demo"
- ProfileEdit inline note — `src/pages/ProfileEdit.js` renders a small
  `.profile-edit__resume-demo-note` element ("Resume import is
  available after signing in.") in the resume-import slot when in
  demo, replacing the upload widget
- Design-by-contract guard — `src/components/ResumeImport.js` promotes
  its previously internal `VISIBLE_STATUSES` set to an export; a test
  asserts `!VISIBLE_STATUSES.has(DEMO_STATUS)` so a future change that
  silently adds `'demo'` to the set fails immediately
- Test coverage — `tests/data/{demoStore,authStore.demo}.test.js`,
  `tests/services/{api,resumeApi}.demo.test.js`,
  `tests/pages/welcome/demoStub.test.js`,
  `tests/components/{Navbar.demo,ResumeImport.demo}.test.js`,
  `tests/pages/ProfileEdit.demo.test.js` — including a fetch spy that
  asserts zero network calls across every demo write

### Changed
- Server-side runtime config now accepts only `local` and `hosted` —
  the reserved `'demo'` slot from 019 has been removed. Setting
  `APP_RUNTIME=demo` now fails at boot with the standard
  `Invalid APP_RUNTIME` error naming the two valid values. The
  `DemoRepositoryNotImplementedError` class, the `createDemoStub`
  factory, the dispatcher's demo branch, and the
  `config.isDemo` short-circuit in `assertHostedSchema` are deleted
- Welcome CTA wiring — `src/pages/welcome/demoStub.js` no longer fires
  a "Demo coming soon" toast. It now exports `enterDemo()` which
  delegates to `authStore.enterDemo()`. The welcome page CTA and the
  auth-modal demo button both call through this entry
- `src/main.js` routes `'demo'` status to the app shell alongside
  `'local-mode'` and `'authenticated'`, and skips the legacy
  `src/data/store.js` `localStorage` warm-up entirely in demo
- `src/pages/Tracker.js` gates both `persistFilterState` and
  `loadPersistedFilterState` on `status !== 'demo'` so demo sessions
  perform zero `localStorage` writes under `apptracker_filters` and
  start from default filter state regardless of any prior signed-in
  session's persisted prefs

### Internal
- The legacy `server/db-seed.js` and `server/db-seed-profile.js`
  scripts now import their data constants from the new
  `server/seeds/*.js` modules; `db-seed-profile.js` additionally
  guards its top-level side effects (`initSchema` / `saveProfile` /
  `process.exit`) behind an `import.meta.url === pathToFileURL(process.argv[1]).href`
  CLI check matching the pattern `db-seed.js` already uses

## [0.9.0] — 2026-05-17

> Hosted persistence release — feature 019-supabase-persistence.
> Local SQLite mode is byte-equivalent to v0.8.1 and remains the default.
> Hosted operators MUST apply the migration in
> [`specs/019-supabase-persistence/data-model.md §5`](specs/019-supabase-persistence/data-model.md)
> before deploying a v0.9.0+ build to hosted mode; the boot check refuses
> to serve until the migration is in place.

### Added
- Supabase-backed repository adapters for `applications` and `profile` —
  every read scopes by the caller's `user_id` via both server-side
  `.eq('user_id', userId)` filters and Supabase Row Level Security
  (defense in depth, FR-016)
- `user_seed_state` marker table + `claim_and_seed_starter()` RPC — first
  authenticated API call from a hosted user atomically seeds 2 sample
  applications and a starter-state marker inside one Postgres transaction;
  empty profile is intentional onboarding (FR-012, FR-013, FR-014)
- `demo` runtime mode added as a third `APP_RUNTIME` value (alongside
  `local` and `hosted`) — currently returns
  `DemoRepositoryNotImplementedError` on every method; reserved for
  feature 020
- Per-request Supabase client factory
  ([server/repositories/supabase/client.js](server/repositories/supabase/client.js))
  — constructs an anon-key client carrying the caller's JWT so PostgREST
  applies RLS as the authenticated user; never reads
  `SUPABASE_SERVICE_ROLE_KEY` at runtime
- Boot-time hosted schema check
  ([server/health.js](server/health.js)) — sentinel PostgREST probes
  against `applications`, `profile`, `user_seed_state` refuse to start
  the server until the 019 migration is applied
- `attachRepos(dispatcher)` Express middleware
  ([server/repositories/middleware.js](server/repositories/middleware.js))
  — sets `req.repos = dispatcher.forRequest(req)` so route handlers have
  one uniform contract across all three runtime modes
- `seedHostedUserIfNeeded` Express middleware
  ([server/auth/seedHostedUser.js](server/auth/seedHostedUser.js))
  — runs after `requireAuth` on every protected hosted route, invoking
  the seed RPC exactly once per user
- `server/db/columns.js` — shared module exporting column lists, the
  `FIELD_TO_COLUMN` map, `toRow`/`toRecord` translators, and SQLite-side
  helpers. Both the SQLite and Supabase adapters consume it so they
  cannot drift; backward-compat re-exports preserve existing imports
  from [server/db/applications.js](server/db/applications.js)

### Changed
- `createRepositories(config)` now returns a uniform
  `{ forRequest(req) }` shape across all three runtimes (local, hosted,
  demo). Route handlers obtain their per-request repository bundle via
  `req.repositories.forRequest(req)`. Hosted mode constructs a per-
  request RLS-scoped Supabase client; local and demo return long-lived
  bundles. Route factories now receive `{ repos, requireAuth,
  seedHostedUserIfNeeded }` instead of pre-extracted `{ repo, requireAuth }`.
- All protected route handlers converted to `async` with explicit `await`
  on every repository call — the Supabase adapter returns Promises and
  the status-transition check in `PATCH /api/applications/:id` cannot
  function without `await` (forbidden transitions would silently slip
  through validation)
- `api/index.js` (Vercel hosted entry) now passes `config` +
  lazy-imported `seedHostedUserIfNeeded` to `createApp`, fixing two
  pre-existing latent gaps (hosted Vercel runtime had not been
  receiving auth/seed middleware)
- Adapter shape (`ApplicationsRepository` / `ProfileRepository`) method
  names + arguments unchanged; only return type changed from sync values
  to Promises (route handlers add `await` to existing call sites)

### Dependencies
- `@supabase/supabase-js` (added in 018 for the frontend bundle) is now
  also used **server-side** to construct per-request RLS-scoped clients.
  No new package install required; the existing dependency is reused at
  the Node runtime. Verify with `npm ls @supabase/supabase-js`.

### Migration required
- Hosted operators MUST apply
  [`data-model.md §5`](specs/019-supabase-persistence/data-model.md) via
  Supabase dashboard → SQL Editor before deploying v0.9.0+ to hosted
  mode. The block is idempotent (CREATE TABLE IF NOT EXISTS + DROP
  POLICY IF EXISTS) and safe to re-run. Pre-019 hosted data is wiped per
  018's *Accepted Limitations* — though in practice 017's hosted schema
  was documented but never applied so most projects have nothing to
  wipe.
- The boot check in
  [server/health.js](server/health.js) refuses to start the hosted
  server if the migration has not been applied; expect a descriptive
  startup error naming the missing column or table.

### Security
- Per-user ownership enforced by RLS + server-side filters on every
  hosted read and write. Cross-user access attempts return responses
  indistinguishable from "resource does not exist" — no information
  leak via differential status codes or response bodies.
- Verified end-to-end against a live multi-tenant Supabase project
  during Task 08.2 manual smoke (quickstart §6 RLS direct-bypass):
  user A's JWT against user B's row id returned `[]` from both Express
  (404) and direct PostgREST calls — both server-side filter and RLS
  policy independently refused.

### Local mode (unchanged)
- SQLite repositories and schema are byte-equivalent to v0.8.1. Local
  developer workflow (`npm run server:dev` + `npm run dev`) requires
  no setup changes. Existing local data is untouched.

## [0.8.1] — 2026-05-17

> UI polish release on top of v0.8.0 — no API, schema, or auth-behavior
> changes. Bundles the Tracker chrome refresh (feature 018 Phase 13) and the
> full Welcome refresh (Phases 14–18).

### Changed
- Tracker top bar restyled to a unified navy band (52px sticky) with brand cluster, page nav, and right-aligned identity cluster
- Email truncation switched from JS char-count to CSS `max-width` (full email always in the `title` attribute); `EMAIL_DISPLAY_LIMIT` and `truncateEmail()` retired from `Navbar.js`
- Sign-out button restyled with a door-arrow icon; collapses to icon-only at `≤ 639px`
- Mobile chrome (`≤ 639px`) gains a bottom tab bar (`src/components/BottomTabBar.js`) for page nav and a floating "+ New application" button (`src/components/Fab.js`) above it
- Fold-narrow breakpoint (`< 380px`) hides the "Project Alice" wordmark while keeping the logo mark + sign-out icon
- Tracker toolbar flipped onto the navy band with refreshed filter chip / count badge / erase-all tints (`design/tracker.md` § Toolbar-on-navy tints)
- Welcome page rewritten to match `design/welcome_page.md` — headline accent `<em>organized.</em>` with indigo underline-glow, theme-driven brand mark; the previous floating metadata pills + "Sample data" disclaimer are no longer rendered
- Welcome mini footer sourced from a new shared `src/pages/welcome/shared/appMeta.js` (`APP_VERSION`, `ISSUE_URL`, `LICENSE_NAME`, `LICENSE_URL`) — single source of truth shared with `Footer.js`; license set to `PolyForm Noncommercial 1.0.0`
- Hero slideshow replaced — the six product-screenshot slides (`src/assets/welcome-hero/*.png`) and their imports are gone; the new cycler shows four animated scenes (`SceneStack`, `ScenePipeline`, `SceneProfile`, `SceneLogo` in `src/pages/welcome/scenes/`), 5500ms per scene, 700ms cross-fade, dot navigation with a per-scene progress bar; all motion gated behind `prefers-reduced-motion: reduce`
- Welcome page now ships fixed production defaults for layout, theme, copy intensity, and hero scene — the prototype Tweaks panel and `?key=value` URL overrides were prototyped during Phase 16 but cut before merge; responsive desktop / tablet / mobile branches remain
- Auth modal restyled per design §4.6 — 440px / 14px-radius shell, `rgba(8,8,24,.55)` overlay with 6px backdrop blur, 40px header logo, footer with primary submit → "or" divider → demo button (warm fill, green pulse dot) → swap-mode link → legal copy on signup only; the previous tab strip is replaced by the in-footer swap link
- Welcome `<760px` portrait stack lands inside the same `WelcomePage.js` module via a JS-toggled `.welcome--mobile` class; full-width CTAs with pulsing green dot on the demo button; brand mark forced to `Alice_Colored.png` regardless of theme
- Resize-driven viewport crossings mount/unmount the hero slideshow so the DOM matches the active branch (mobile omits it; desktop/tablet keep it)
- "Try the demo" CTA (welcome page + auth modal) now fires a shared "Demo coming soon" toast via `src/pages/welcome/demoStub.js` — `window.alert()` no longer used; real demo behavior owned by a future feature
- Test coverage extended in `tests/components/{bottomTabBar,fab}.test.js`, `tests/pages/welcome/heroSlideshow.test.js`, and `tests/pages/welcome/scenes/*.test.js`

## [0.8.0] — 2026-05-16

### Added
- Hosted authenticated user access via Supabase email/password — feature 018-auth-user-access; local mode is unchanged and remains the default
- `allowed_emails` table + `auth.users` `BEFORE INSERT` trigger — operator-managed allowlist enforced inside Postgres so unauthorized signups never reach `auth.users`
- `server/auth/middleware.js` — `createRequireAuth({ jwksUri, logger })` factory; verifies `Authorization: Bearer <jwt>` against Supabase's JWKS endpoint (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`) via `jose.jwtVerify`, accepting `ES256` and `RS256` (Supabase's modern asymmetric signing modes); logs categorized rejections (`missing | malformed | expired | signature | other`) with redacted-path context, never the token
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
- `@supabase/supabase-js` (^2.45.0) and `jose` (^6.x) dependencies
- Spec package at `specs/018-auth-user-access/` — `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/api.md`, `research.md`, `quickstart.md`, `checklists/plan-review.md`
- `design/welcome_page.md` — visual specification for the welcome experience
- Test suites: `tests/server/auth-middleware.test.js`, `tests/server/routes-protected.test.js`, `tests/data/authStore.test.js`, `tests/services/{supabaseClient,healthApi,resumeApi}.test.js`, `tests/components/{welcome,heroSlideshow,navbar,resumeImport}.test.js`, `tests/pages/configError.test.js`, `tests/main.test.js`, `tests/build/vite-config.test.js`

### Changed
- `createApp()` signature now `({ repositories, config, requireAuth? })`; route factories (`createApplicationsRouter`, `createProfileRouter`, `createResumeRouter`) likewise accept `{ repo, requireAuth }`
- `unmountAppShell` in `src/main.js` calls `Navbar.destroy()` to clean up the auth-store subscription on transitions back to the welcome page
- `ResumeImport.create()` always returns an element; visibility now driven by `root.hidden` from a subscription, with completion state tracked separately so post-import hiding survives auth-state transitions

### Security
- Allowlist enforcement lives in a Postgres `SECURITY DEFINER` trigger on `auth.users` — an Express endpoint approach was considered and rejected because it could be bypassed by direct Supabase calls from the browser
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never appears in `src/` or in the Vite production bundle (verified in Phase 12)
- JWT verification pins `['ES256', 'RS256']` algorithm allowlist explicitly to defeat `alg: none` and downgrade attacks
- No long-lived shared HS256 secret is configured anywhere; signing key material is fetched at runtime from the Supabase-managed JWKS endpoint
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

[Unreleased]: https://github.com/reso830/Project_Alice/compare/v0.12.0...HEAD
[0.12.0]: https://github.com/reso830/Project_Alice/compare/v0.11.1...v0.12.0
[0.11.1]: https://github.com/reso830/Project_Alice/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/reso830/Project_Alice/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/reso830/Project_Alice/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/reso830/Project_Alice/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/reso830/Project_Alice/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/reso830/Project_Alice/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/reso830/Project_Alice/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/reso830/Project_Alice/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/reso830/Project_Alice/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/reso830/Project_Alice/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/reso830/Project_Alice/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/reso830/Project_Alice/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/reso830/Project_Alice/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/reso830/Project_Alice/releases/tag/v0.1.0
