# Plan Review Checklist: Hosted Authenticated User Access (018)

Complete before generating tasks via `/speckit.tasks`. Check each item; document
any skip with reason and residual risk.

---

## Constitution Compliance

- [ ] Required application fields (`company_name`, `job_title`, `status`,
  `last_status_update`, `responsibilities`) are unaffected — no schema or
  validation changes to `applications` in this feature
- [ ] Validation rules remain centralized; SignupForm field validation
  (email format, password min length) is co-located in the form module
- [ ] No silent data corruption: signup failures surface via Supabase error
  → neutral SignupForm message; JWT failures are 401; missing config produces
  a startup error
- [ ] Business logic stays server-side: allowlist enforcement is in the
  Postgres allowlist trigger (database layer); JWT validation is in Express
  middleware
- [ ] No external analytics, tracking, or data sharing introduced
- [ ] Local-first preserved: SQLite local mode boots and operates with no
  Supabase calls, no env vars required, no middleware activated
- [ ] Desktop/mobile, keyboard nav, and non-color-only status communication
  preserved on the welcome page
- [ ] Operations covered: add (signup), edit (login/sign-out flows), review
  (protected routes return 401 cleanly when unauthenticated)
- [ ] Testing coverage: auth middleware, signed-in/out gating, session
  restore, build-time assertion, runtime handshake — all automated; bypass
  path, allowlist enforcement, and verification flow validated in Phase 11.6
  browser smoke test

---

## Config Contract

- [ ] `SUPABASE_JWT_SECRET` is server-only — no `VITE_` prefix anywhere
- [ ] `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_AUTH_EMAIL_REDIRECT_URL` are documented as hosted-build-required
- [ ] Each new server hosted env var, when missing, throws a startup error
  naming the specific variable
- [ ] Each new Vite env var, when missing in production builds, throws a
  build-time error naming the specific variable
- [ ] Local mode never requires any new env vars (server or client)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` are absent from
  the Vite bundle (re-verified per 11.2)
- [ ] Server config validation runs at module load time before `app.listen()`

---

## Authentication & Authorization

- [ ] `requireAuth` middleware exists at `server/auth/middleware.js`
- [ ] Middleware verifies JWT locally using `SUPABASE_JWT_SECRET` (HS256
  explicit allowlist)
- [ ] Middleware rejects missing / malformed / expired / wrong-key tokens
  with 401 and a uniform error shape
- [ ] Middleware does not invoke the route handler on failure
- [ ] Middleware attaches `req.user = { id, email }` on success
- [ ] `requireAuth` is applied at the top of `createApplicationsRouter`,
  `createProfileRouter`, and `createResumeRouter` **only in hosted mode**
- [ ] In local mode no protected router receives `requireAuth`
- [ ] No protected route forgets to apply the middleware in hosted mode
  (grep-checked)
- [ ] `/api/health` remains public (no middleware)

---

## Signup & Allowlist (Postgres trigger)

- [ ] `allowed_emails` Supabase table exists with the documented columns
  including the `length(email) <= 254` check
- [ ] RLS is enabled on `allowed_emails` with no policies
- [ ] `public.handle_new_user_email_allowlist()` function exists with
  `SECURITY DEFINER` and reads `allowed_emails` via lowercased lookup
- [ ] `before_user_created_allowlist` trigger fires on `before insert on auth.users`
- [ ] Direct SQL `insert into auth.users (...)` with a non-allowlisted email
  raises the trigger exception
- [ ] Direct browser `supabase.auth.signUp({ email: <not-allowlisted>, ... })`
  via dev tools returns an error and creates no auth.users row
- [ ] Allowlisted signup triggers the Supabase default verification email
- [ ] SignupForm maps Supabase signup errors to a single neutral user-facing
  message regardless of underlying cause (FR-006 neutrality)
- [ ] Operator's emails are inserted lowercased in `allowed_emails`

---

## Frontend Auth Flow

- [ ] Welcome page is mounted as a pre-app gate (not via the in-app `navigate`)
- [ ] Welcome page hosts CTAs that open the auth overlay + email-verification
  callback handler
- [ ] `data/authStore.js` owns session state and subscribers
- [ ] `services/supabaseClient.js` initializes only in hosted mode
- [ ] `services/api.js` and `services/resumeApi.js` attach
  `Authorization: Bearer <jwt>` from `authStore` on every protected request
- [ ] Session restore on page load uses `supabase.auth.getSession()`
- [ ] Sign-out clears the JS client session and notifies `authStore`
  subscribers
- [ ] Navbar renders signed-in identifier + sign-out control when authenticated;
  otherwise it does not render (welcome page has no navbar)
- [ ] `ResumeImport` component is absent from DOM when signed out
- [ ] Auth overlay renders explicit idle/loading/error/verification-sent states
- [ ] `main.js` renders nothing during the brief `'initializing'` window (no flash)

---

## Build-Time + Runtime Config Detection

- [ ] `vite.config.js` plugin throws on production builds when any of
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`
  is empty
- [ ] `npm run dev` works without the Vite env vars (local mode)
- [ ] `/api/health` reports `runtime: 'local' | 'hosted'`
- [ ] `main.js` reads `/api/health` at boot; mounts `ConfigError` when the
  server reports `hosted` and the client has no Supabase config

---

## Welcome Page Design Compliance

Refers to [design/welcome_page.md](../../../design/welcome_page.md).

- [ ] Diagonal-split layout on desktop (left content column ~55%, right hero
  slab ~62%, polygon clip-path per design)
- [ ] Hero ribbon variant on mobile (`<760px`) with the documented polygon
- [ ] CTA stack collapses to vertical full-width on narrow mobile (`<420px`)
- [ ] Headline uses Sora 700 / 54px (desktop), 38px (mobile), with the fixed
  line break "Your job search, / organized."
- [ ] Supporting copy uses Sora 400 / 14px with `420px` max width
- [ ] Brand block: Alice_White.png at 44x44 + "Project Alice" wordmark in
  Sora 16 / 600
- [ ] Three CTAs rendered: Sign In (primary indigo), Create Account
  (secondary outlined), Try Demo (ghost — **disabled with "coming soon"
  tooltip** until feature 020 ships)
- [ ] Hero background uses the documented radial-gradient stack over `var(--navy)`
- [ ] Hero slideshow rotates through Tracker / Application Modal / Profile /
  Filters / Calendar slides
- [ ] Screenshot cards use the documented border, radius, shadow, and rotation
- [ ] Footer metadata row in DM Mono 11 / `var(--t3)` with the documented copy
- [ ] Floating pills include the `Sample data — illustrative only` disclaimer
  (DM Mono 10, bottom-right anchored)
- [ ] All copy and component breakpoints match the design specification
- [ ] No new CSS custom properties introduced — design tokens reused from
  `src/styles/main.css`

---

## Auth Overlay (Centered Modal at Every Breakpoint)

- [ ] Centered modal at every breakpoint (no bottom-sheet variant)
- [ ] Sizing per design §11b at desktop / tablet / mobile breakpoints
- [ ] `AuthOverlay` is a standalone component, not an extension of `Modal.js`
- [ ] Overlay traps focus while open and restores focus to the triggering CTA
  on close
- [ ] ESC key and backdrop click close the overlay
- [ ] Switching between Login and Signup within the overlay does not unmount
  the overlay or lose entered email value
- [ ] Form validation errors render inline (not as a toast) and read by
  screen readers
- [ ] Submit button disabled while request is in-flight; visible loading state
- [ ] Verification-sent state replaces the form with a clear "check your email"
  message and a way to dismiss the overlay
- [ ] Entrance animation (fade + translate-up) honors
  `prefers-reduced-motion: reduce`

---

## Hero Slideshow

- [ ] Five real-application screenshots live under `src/assets/welcome-hero/`
  (may be deferred to Phase 10 with placeholder fallback in place)
- [ ] Slideshow auto-rotates with the documented `500ms ease` opacity +
  transform transition
- [ ] Honors `prefers-reduced-motion: reduce` by disabling rotation and
  transform animations
- [ ] Placeholder fallback (single neutral card) renders when screenshot
  assets are not yet captured

---

## Hosted Ownership Plan (documented, not implemented)

- [ ] `data-model.md §6` documents `applications.user_id` and `profile.user_id`
  for 019 with type, nullability, FK, and index
- [ ] `data-model.md §6` documents the RLS policy shape for 019
- [ ] `data-model.md §7` directs 019 to wipe `applications` and `profile`
  before adding `user_id`
- [ ] Plan and spec both state that 019 owns column creation, RLS
  application, and repository scoping
- [ ] Accepted limitation (shared hosted data pre-019 + 018-only data
  treated as throwaway) is acknowledged in the spec and not "fixed" in 018

---

## Tests

- [ ] `tests/server/auth-middleware.test.js` covers valid, missing, malformed,
  expired, and wrong-key tokens, and asserts a `logger.warn` call per
  rejection with the expected `category` value, and a token-redaction
  assertion that the rejected token never appears in any captured log
  argument
- [ ] `tests/server/routes-protected.test.js` covers 401 without token and
  200 with a valid token for each of applications/profile/resume,
  `/api/health` returns the runtime field in both modes, the
  `[runtime] mode=…` boot log emits once per boot, and the end-to-end 401
  case captures a real `[auth] reject` log entry with the expected
  category through the real middleware
- [ ] `tests/build/vite-config.test.js` covers the production-build assertion
  throwing on missing Vite env vars
- [ ] `tests/data/authStore.test.js` covers subscribe/notify, session
  restore, and sign-out clearing
- [ ] `tests/services/supabaseClient.test.js` covers env-stub-absent and
  env-stub-present paths
- [ ] `tests/services/api.test.js` covers header attachment
- [ ] `tests/components/welcome.test.js` covers welcome-page mount, Try Demo
  disabled, CTA → overlay flow, login/signup happy + error paths, signup
  error neutrality, ESC/backdrop close, focus restore, `?auth=callback`
  banner
- [ ] `tests/components/heroSlideshow.test.js` covers reduced-motion,
  placeholder fallback, rotation progression
- [ ] `tests/components/navbar.test.js` covers signed-in segment behavior
- [ ] `tests/components/resumeImport.test.js` covers visibility in each
  auth state
- [ ] `tests/main.test.js` covers ConfigError mounting on hosted/client-
  unconfigured mismatch
- [ ] Existing route tests pass unmodified
- [ ] All tests run with Supabase fully mocked at the module boundary; CI
  needs no live Supabase project

---

## Pre-Deploy Verification Gate (P0, runs against production Supabase)

Documented in `quickstart.md §10`. None of these checks can be automated from
the application repo because the server has no Supabase client. They MUST be
performed manually before any production promotion.

- [ ] `allowed_emails` table exists with `email`, `added_at`, `added_by` columns
- [ ] `public.handle_new_user_email_allowlist()` function exists
- [ ] `before_user_created_allowlist` trigger is wired to `auth.users`
- [ ] **Bypass test**: `supabase.auth.signUp` from dev tools with a
  non-allowlisted email returns an error and creates no `auth.users` row
- [ ] Happy path: allowlisted signup → verification → sign in → protected
  route 200
- [ ] `npm run build` against production env vars either succeeds with all
  three `VITE_*` set, or fails loudly with the Vite plugin error when any
  are missing
- [ ] All six check outputs captured in the deploy PR description as
  evidence

---

## Browser Smoke Tests (constitution Amendment 1.1.0)

Each user story's Independent Test from spec.md must pass in a live browser
session (Phase 11.6):

- [ ] **US1** — allowlisted signup → verify → sign in → protected route 200
- [ ] **US2a** — non-allowlisted SignupForm submission rejected with neutral
  error; no auth.users row
- [ ] **US2b** — direct anon-key `supabase.auth.signUp` from dev tools with
  non-allowlisted email rejected; no auth.users row
- [ ] **US3** — refresh preserves auth; sign-out clears state
- [ ] **US4** — unauthenticated 401 on protected routes; resume-import absent
- [ ] **US5** — tampered JWT → 401; response body opaque

---

## Logging & Observability

- [ ] Server logs cover what the server actually sees: token-rejection counts
  + failure categories (`missing` / `malformed` / `expired` / `signature`),
  hosted-route 401 responses, `/api/health` calls. The server does **not**
  observe signup or login attempts (those are direct browser ↔ Supabase
  calls).
- [ ] Documentation points operators to **Supabase Dashboard → Logs → Auth
  Logs** for signup/login visibility (FR-016).
- [ ] Logs do **not** contain plaintext passwords (server never sees them).
- [ ] Logs do **not** contain tokens in any form — neither full tokens nor
  prefixed/truncated tokens.

---

## Documentation

- [ ] `quickstart.md` covers Supabase project setup, `allowed_emails`
  creation, allowlist trigger install + verify, redirect URLs, env vars
  (server + Vite-exposed), the manual validation flow including the bypass
  test, and the §10 pre-deploy verification gate
- [ ] `contracts/api.md` covers env vars, `Authorization` header, middleware
  behavior, `/api/health` runtime contract, allowlist trigger contract,
  build-time assertion contract, and the error-code inventory
- [ ] `research.md` records every plan-level decision with rejected
  alternatives (R1 reflects the Postgres-trigger revision; R12 covers
  build/runtime detection; R13 covers the 019 wipe)
- [ ] `design/welcome_page.md` covers the centered-modal auth overlay
  decision and the illustrative-disclaimer on the floating pills

---

## Out-of-Scope Re-confirmation

- [ ] No `user_id` columns added to `applications` or `profile` in this feature
- [ ] No RLS policies applied to `applications` or `profile` in this feature
- [ ] No SQLite schema changes
- [ ] No OAuth/social provider configuration
- [ ] No custom in-app password-reset UI
- [ ] No admin allowlist management UI
- [ ] No Express `/api/auth/signup` endpoint (removed in this revision)
- [ ] No server-side Supabase admin client (removed in this revision)
- [ ] No demo/public-explorer behavior (owned by 020)
- [ ] No resume upload size/rate limits (owned by 021)
- [ ] "Try Demo" button renders disabled — actual demo behavior belongs to 020

---

## Open Items

Capture any item that can't be checked off above and the reason:

| Item | Why it's open | Residual risk |
|---|---|---|
| Hero screenshot assets | Five real-app screenshots not yet captured | Welcome page ships with placeholder hero until polish task captures them; design specifies real screenshots, not mockups |
| (add others as found during review) | | |
