# Plan Review Checklist: Hosted Authenticated User Access (018)

Complete before generating tasks via `/speckit.tasks`. Check each item; document
any skip with reason and residual risk.

---

## Constitution Compliance

- [X] Required application fields (`company_name`, `job_title`, `status`,
  `last_status_update`, `responsibilities`) are unaffected — no schema or
  validation changes to `applications` in this feature
- [X] Validation rules remain centralized; SignupForm field validation
  (email format, password min length) is co-located in the form module
- [X] No silent data corruption: signup failures surface via Supabase error
  → neutral SignupForm message; JWT failures are 401; missing config produces
  a startup error
- [X] Business logic stays server-side: allowlist enforcement is in the
  Postgres allowlist trigger (database layer); JWT validation is in Express
  middleware
- [X] No external analytics, tracking, or data sharing introduced
- [X] Local-first preserved: SQLite local mode boots and operates with no
  Supabase calls, no env vars required, no middleware activated
- [X] Desktop/mobile, keyboard nav, and non-color-only status communication
  preserved on the welcome page (CSS breakpoints + focus-visible rings + text labels alongside color cues)
- [X] Operations covered: add (signup), edit (login/sign-out flows), review
  (protected routes return 401 cleanly when unauthenticated)
- [X] Testing coverage: auth middleware, signed-in/out gating, session
  restore, build-time assertion, runtime handshake — all automated (649/649 pass); bypass
  path, allowlist enforcement, and verification flow validated in Phase 12.6
  browser smoke test (operator-side)

---

## Config Contract

- [X] `SUPABASE_JWT_SECRET` is no longer required — middleware uses Supabase's JWKS endpoint for ES256/RS256 verification (Phase 12 finding fix; jose-based implementation)
- [X] `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_AUTH_EMAIL_REDIRECT_URL` are documented as hosted-build-required (README, deployment.md, .env.example, contracts/api.md)
- [X] Each new server hosted env var, when missing, throws a startup error
  naming the specific variable (server/config.js HOSTED_REQUIRED)
- [X] Each new Vite env var, when missing in production builds, throws a
  build-time error naming the specific variable (verified 12.3: three individual failures)
- [X] Local mode never requires any new env vars (server or client)
- [X] `SUPABASE_SERVICE_ROLE_KEY` is absent from the Vite bundle (verified 12.2: 0 hits in dist/assets/*.js after happy-path build); `SUPABASE_JWT_SECRET` is no longer used anywhere in this feature.
- [X] Server config validation runs at module load time before `app.listen()` (loadConfig() in server/config.js)

---

## Authentication & Authorization

- [X] `requireAuth` middleware exists at `server/auth/middleware.js`
- [X] Middleware verifies JWT via Supabase's JWKS endpoint with explicit
  algorithm allowlist `['ES256', 'RS256']` using `jose.jwtVerify`
  (Phase 12 finding fix — original HS256 design was incompatible with
  Supabase's modern asymmetric signing default)
- [X] Middleware rejects missing / malformed / expired / wrong-key tokens
  with 401 and a uniform error shape (UNAUTHORIZED_BODY)
- [X] Middleware does not invoke the route handler on failure (returns before next())
- [X] Middleware attaches `req.user = { id, email }` on success
- [X] `requireAuth` is applied at the top of `createApplicationsRouter`,
  `createProfileRouter`, and `createResumeRouter` **only in hosted mode** (server/index.js wiring)
- [X] In local mode no protected router receives `requireAuth` (passes undefined; router factories no-op when absent)
- [X] No protected route forgets to apply the middleware in hosted mode
  (tests/server/routes-protected.test.js end-to-end coverage)
- [X] `/api/health` remains public (no middleware) (server/index.js mounts health BEFORE protected routers)

---

## Signup & Allowlist (Postgres trigger)

- [ ] `allowed_emails` Supabase table exists with the documented columns
  including the `length(email) <= 254` check **— operator-side (12.5b)**
- [ ] RLS is enabled on `allowed_emails` with no policies **— operator-side (12.5b)**
- [ ] `public.handle_new_user_email_allowlist()` function exists with
  `SECURITY DEFINER` and reads `allowed_emails` via lowercased lookup **— operator-side (12.5b)**
- [ ] `before_user_created_allowlist` trigger fires on `before insert on auth.users` **— operator-side (12.5b)**
- [ ] Direct SQL `insert into auth.users (...)` with a non-allowlisted email
  raises the trigger exception **— operator-side (12.5b)**
- [ ] Direct browser `supabase.auth.signUp({ email: <not-allowlisted>, ... })`
  via dev tools returns an error and creates no auth.users row **— operator-side (12.6 US2b)**
- [ ] Allowlisted signup triggers the Supabase default verification email **— operator-side (12.6 US1)**
- [X] SignupForm maps Supabase signup errors to a single neutral user-facing
  message regardless of underlying cause (FR-006 neutrality) (welcome.test.js asserts byte-identical error region across distinct Supabase causes)
- [ ] Operator's emails are inserted lowercased in `allowed_emails` **— operator-side (quickstart §3)**

---

## Frontend Auth Flow

- [X] Welcome page is mounted as a pre-app gate (not via the in-app `navigate`) (src/main.js mountWelcome)
- [X] Welcome page hosts CTAs that open the auth overlay + email-verification
  callback handler (WelcomePage.js + ?auth=callback handler)
- [X] `data/authStore.js` owns session state and subscribers
- [X] `services/supabaseClient.js` initializes only in hosted mode (returns null when VITE_* absent)
- [X] `services/api.js` and `services/resumeApi.js` attach
  `Authorization: Bearer <jwt>` from `authStore` on every protected request (tests assert)
- [X] Session restore on page load uses `supabase.auth.getSession()` (authStore.init())
- [X] Sign-out clears the JS client session and notifies `authStore`
  subscribers (signOut → onAuthStateChange → notify())
- [X] Navbar renders signed-in identifier + sign-out control when authenticated;
  otherwise it does not render (Navbar.js auth segment; mountAppShell only on local-mode/authenticated)
- [X] `ResumeImport` component is absent from DOM when signed out (root.hidden via subscribeAuth)
- [X] Auth overlay renders explicit idle/loading/error/verification-sent states (LoginForm/SignupForm aria-busy + error region + verification panel)
- [X] `main.js` renders nothing during the brief `'initializing'` window (no flash) (render() short-circuits on initializing)

---

## Build-Time + Runtime Config Detection

- [X] `vite.config.js` plugin throws on production builds when any of
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`
  is empty (verified 12.3: all three vars individually + all-three-missing produce specific errors)
- [X] `npm run dev` works without the Vite env vars (local mode) (plugin only fires when env.mode === 'production')
- [X] `/api/health` reports `runtime: 'local' | 'hosted'` (server/index.js + routes-protected.test)
- [X] `main.js` reads `/api/health` at boot; mounts `ConfigError` when the
  server reports `hosted` and the client has no Supabase config (runtimeHandshake + main.test.js)

---

## Welcome Page Design Compliance

Refers to [design/welcome_page.md](../../../design/welcome_page.md).

- [X] Diagonal-split layout on desktop (left content column ~55%, right hero
  slab ~62%, polygon clip-path per design) (main.css Phase 09 + Phase 09 codex fix)
- [X] Hero ribbon variant on mobile (`<760px`) with the documented polygon
- [X] CTA stack collapses to vertical full-width on narrow mobile (`<420px`)
- [X] Headline uses Sora 700 / 54px (desktop), 38px (mobile), with the fixed
  line break "Your job search, / organized." (welcome.test asserts <br> + both text fragments)
- [X] Supporting copy uses Sora 400 / 14px with `420px` max width
- [X] Brand block: Alice_White.png at 44x44 + "Project Alice" wordmark in
  Sora 16 / 600
- [X] Three CTAs rendered: Sign In (primary indigo), Create Account
  (secondary outlined), Try Demo (ghost — **disabled with "coming soon"
  tooltip** until feature 020 ships) (welcome.test asserts disabled + tooltip)
- [X] Hero background uses the documented radial-gradient stack over `var(--navy)`
- [X] Hero slideshow rotates through Tracker / Application Modal / Profile /
  Filters / Calendar slides (plus mobile-tracker — Phase 10)
- [X] Screenshot cards use the documented border, radius, shadow, and rotation
- [X] Footer metadata row in DM Mono 11 / `var(--t3)` with the documented copy
- [X] Floating pills include the `Sample data — illustrative only` disclaimer
  (DM Mono 10, bottom-right anchored)
- [ ] All copy and component breakpoints match the design specification **— operator-side visual review at 4 breakpoints (12.6)**
- [X] No new CSS custom properties introduced — design tokens reused from
  `src/styles/main.css` (Phase 09 constraint satisfied)

---

## Auth Overlay (Centered Modal at Every Breakpoint)

- [X] Centered modal at every breakpoint (no bottom-sheet variant) (main.css `.auth-overlay`)
- [X] Sizing per design §11b at desktop / tablet / mobile breakpoints (440 / 420 / min(92vw, 380px))
- [X] `AuthOverlay` is a standalone component, not an extension of `Modal.js`
- [X] Overlay traps focus while open and restores focus to the triggering CTA
  on close (welcome.test asserts both)
- [X] ESC key and backdrop click close the overlay (welcome.test asserts both)
- [X] Switching between Login and Signup within the overlay does not unmount
  the overlay or lose entered email value (welcome.test: overlayAfter === overlayBefore; email preserved)
- [X] Form validation errors render inline (not as a toast) and read by
  screen readers (`aria-live="polite"`)
- [X] Submit button disabled while request is in-flight; visible loading state
  (welcome.test asserts aria-busy + "Signing in…" / "Creating account…")
- [X] Verification-sent state replaces the form with a clear "check your email"
  message and a way to dismiss the overlay (Done button)
- [X] Entrance animation (fade + translate-up) honors
  `prefers-reduced-motion: reduce` (main.css media query disables `auth-overlay-enter`)

---

## Hero Slideshow

- [X] Five real-application screenshots live under `src/assets/welcome-hero/`
  (Phase 10 captured six: tracker, application-modal, profile, filters, calendar, mobile-tracker)
- [X] Slideshow auto-rotates with the documented `500ms ease` opacity +
  transform transition (main.css `.hero-slideshow__card` transition)
- [X] Honors `prefers-reduced-motion: reduce` by disabling rotation and
  transform animations (HeroSlideshow.js renders single static slide; main.css `transform: none`)
- [X] Placeholder fallback (single neutral card) renders when screenshot
  assets are not yet captured (HeroSlideshow.js `buildPlaceholder()`; covered by test)

---

## Hosted Ownership Plan (documented, not implemented)

- [X] `data-model.md §6` documents `applications.user_id` and `profile.user_id`
  for 019 with type, nullability, FK, and index
- [X] `data-model.md §6` documents the RLS policy shape for 019
- [X] `data-model.md §7` directs 019 to wipe `applications` and `profile`
  before adding `user_id`
- [X] Plan and spec both state that 019 owns column creation, RLS
  application, and repository scoping
- [X] Accepted limitation (shared hosted data pre-019 + 018-only data
  treated as throwaway) is acknowledged in the spec and not "fixed" in 018

---

## Tests

- [X] `tests/server/auth-middleware.test.js` covers valid, missing, malformed,
  expired, and wrong-key tokens, and asserts a `logger.warn` call per
  rejection with the expected `category` value, and a token-redaction
  assertion that the rejected token never appears in any captured log
  argument
- [X] `tests/server/routes-protected.test.js` covers 401 without token and
  200 with a valid token for each of applications/profile/resume,
  `/api/health` returns the runtime field in both modes, the
  `[runtime] mode=…` boot log emits once per boot, and the end-to-end 401
  case captures a real `[auth] reject` log entry with the expected
  category through the real middleware
- [X] `tests/build/vite-config.test.js` covers the production-build assertion
  throwing on missing Vite env vars
- [X] `tests/data/authStore.test.js` covers subscribe/notify, session
  restore, and sign-out clearing
- [X] `tests/services/supabaseClient.test.js` covers env-stub-absent and
  env-stub-present paths
- [X] `tests/services/api.test.js` covers header attachment
- [X] `tests/components/welcome.test.js` covers welcome-page mount, Try Demo
  disabled, CTA → overlay flow, login/signup happy + error paths, signup
  error neutrality, ESC/backdrop close, focus restore, `?auth=callback`
  banner
- [X] `tests/components/heroSlideshow.test.js` covers reduced-motion,
  placeholder fallback, rotation progression
- [X] `tests/components/navbar.test.js` covers signed-in segment behavior
- [X] `tests/components/resumeImport.test.js` covers visibility in each
  auth state
- [X] `tests/main.test.js` covers ConfigError mounting on hosted/client-
  unconfigured mismatch
- [X] Existing route tests pass unmodified (649/649 pass after Phase 04 codex review widened applications/profile/resume tests)
- [X] All tests run with Supabase fully mocked at the module boundary; CI
  needs no live Supabase project

---

## Pre-Deploy Verification Gate (P0, runs against production Supabase)

Documented in `quickstart.md §10`. None of these checks can be automated from
the application repo because the server has no Supabase client. They MUST be
performed manually before any production promotion.

- [ ] `allowed_emails` table exists with `email`, `added_at`, `added_by` columns **— operator (12.5b)**
- [ ] `public.handle_new_user_email_allowlist()` function exists **— operator (12.5b)**
- [ ] `before_user_created_allowlist` trigger is wired to `auth.users` **— operator (12.5b)**
- [ ] **Bypass test**: `supabase.auth.signUp` from dev tools with a
  non-allowlisted email returns an error and creates no `auth.users` row **— operator (12.5b)**
- [ ] Happy path: allowlisted signup → verification → sign in → protected
  route 200 **— operator (12.5b)**
- [X] `npm run build` against production env vars either succeeds with all
  three `VITE_*` set, or fails loudly with the Vite plugin error when any
  are missing (verified 12.3 — three individual failures + happy-path build)
- [ ] All six check outputs captured in the deploy PR description as
  evidence **— operator (12.5b deliverable)**

---

## Browser Smoke Tests (constitution Amendment 1.1.0)

Each user story's Independent Test from spec.md must pass in a live browser
session (Phase 11.6):

- [ ] **US1** — allowlisted signup → verify → sign in → protected route 200 **— operator (12.6)**
- [ ] **US2a** — non-allowlisted SignupForm submission rejected with neutral
  error; no auth.users row **— operator (12.6)**
- [ ] **US2b** — direct anon-key `supabase.auth.signUp` from dev tools with
  non-allowlisted email rejected; no auth.users row **— operator (12.6)**
- [ ] **US3** — refresh preserves auth; sign-out clears state **— operator (12.6)**
- [ ] **US4** — unauthenticated 401 on protected routes; resume-import absent **— operator (12.6)**
- [ ] **US5** — tampered JWT → 401; response body opaque **— operator (12.6)**

---

## Logging & Observability

- [X] Server logs cover what the server actually sees: token-rejection counts
  + failure categories (`missing` / `malformed` / `expired` / `signature`),
  hosted-route 401 responses, `/api/health` calls. The server does **not**
  observe signup or login attempts (those are direct browser ↔ Supabase
  calls). (server/auth/middleware.js classifyJwtError)
- [X] Documentation points operators to **Supabase Dashboard → Logs → Auth
  Logs** for signup/login visibility (FR-016). (quickstart §7 and §10)
- [X] Logs do **not** contain plaintext passwords (server never sees them).
- [X] Logs do **not** contain tokens in any form — neither full tokens nor
  prefixed/truncated tokens. (tests/server/auth-middleware.test.js token-redaction assertion)

---

## Documentation

- [X] `quickstart.md` covers Supabase project setup, `allowed_emails`
  creation, allowlist trigger install + verify, redirect URLs, env vars
  (server + Vite-exposed), the manual validation flow including the bypass
  test, and the §10 pre-deploy verification gate
- [X] `contracts/api.md` covers env vars, `Authorization` header, middleware
  behavior, `/api/health` runtime contract, allowlist trigger contract,
  build-time assertion contract, and the error-code inventory
- [X] `research.md` records every plan-level decision with rejected
  alternatives (R1 reflects the Postgres-trigger revision; R12 covers
  build/runtime detection; R13 covers the 019 wipe)
- [X] `design/welcome_page.md` covers the centered-modal auth overlay
  decision and the illustrative-disclaimer on the floating pills

---

## Out-of-Scope Re-confirmation

- [X] No `user_id` columns added to `applications` or `profile` in this feature
- [X] No RLS policies applied to `applications` or `profile` in this feature
- [X] No SQLite schema changes
- [X] No OAuth/social provider configuration
- [X] No custom in-app password-reset UI
- [X] No admin allowlist management UI
- [X] No Express `/api/auth/signup` endpoint (removed in this revision; tests/server/routes-protected.test.js asserts 404)
- [X] No server-side Supabase admin client (removed in this revision)
- [X] No demo/public-explorer behavior (owned by 020)
- [X] No resume upload size/rate limits (owned by 021)
- [X] "Try Demo" button renders disabled — actual demo behavior belongs to 020

---

## Open Items

Capture any item that can't be checked off above and the reason:

| Item | Why it's open | Residual risk |
|---|---|---|
| ~~Hero screenshot assets~~ | Captured in Phase 10 — six PNGs under `src/assets/welcome-hero/` | Resolved |
| Pre-deploy Supabase verification gate (12.5b) | Requires operator with Supabase SQL editor access to production project | LOW with low likelihood × HIGH severity if skipped — allowlist trigger could be absent silently and signups fail OPEN. Must be performed before promoting any hosted deploy. Output captured in deploy PR description. |
| Browser smoke tests (12.6) | Requires operator with live browser session and a real Supabase project | LOW — automated tests cover the JS contracts; this catches CSS regressions, real keyboard interaction, mobile viewport bugs the unit tests cannot see. |
| Manual quickstart §6-7 validation (12.5) | Requires operator with running dev server and real Supabase project | LOW — overlaps with 12.6; smoke-test pass implicitly validates §6-7 happy path |
| Empirical `grep dist/` for real secret values (12.2 strict) | Requires operator to set `SUPABASE_SERVICE_ROLE_KEY` env var locally, build, then grep for the actual value | LOW — structurally impossible for Vite to inline non-VITE_-prefixed env vars; verified via source-side grep (0 hits) and dist-side variable-name grep (0 hits). `SUPABASE_JWT_SECRET` is no longer used. |
