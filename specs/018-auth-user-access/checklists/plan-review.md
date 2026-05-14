# Plan Review Checklist: Hosted Authenticated User Access (018)

Complete before generating tasks via `/speckit.tasks`. Check each item; document
any skip with reason and residual risk.

---

## Constitution Compliance

- [ ] Required application fields (`company_name`, `job_title`, `status`,
  `last_status_update`, `responsibilities`) are unaffected — no schema or
  validation changes to `applications` in this feature
- [ ] Validation rules remain centralized; new auth validation lives in
  `server/validation/auth.js`, not scattered across routes
- [ ] No silent data corruption: signup failures are explicit; JWT failures are
  401; missing config produces a startup error
- [ ] Business logic stays server-side: allowlist enforcement and JWT validation
  are server responsibilities; the frontend is transport only
- [ ] No external analytics, tracking, or data sharing introduced
- [ ] Local-first preserved: SQLite local mode boots and operates with no
  Supabase calls, no env vars required, no middleware activated
- [ ] Desktop/mobile, keyboard nav, and non-color-only status communication
  preserved on the welcome page
- [ ] Operations covered: add (signup), edit (login/sign-out flows), review
  (protected routes return 401 cleanly when unauthenticated)
- [ ] Testing coverage: auth middleware, allowlist enforcement, signup
  validation, signed-in/out gating, session restore — all automated

---

## Config Contract

- [ ] `SUPABASE_JWT_SECRET` is server-only — no `VITE_` prefix anywhere
- [ ] `AUTH_EMAIL_REDIRECT_URL` is documented as hosted-required
- [ ] Each new hosted env var, when missing, throws a startup error naming the
  specific variable
- [ ] Local mode never requires the new env vars
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` are absent from the
  Vite bundle (re-verified, not just inherited from 017)
- [ ] Config validation runs at module load time before `app.listen()`

---

## Authentication & Authorization

- [ ] `requireAuth` middleware exists at `server/auth/middleware.js`
- [ ] Middleware verifies JWT locally using `SUPABASE_JWT_SECRET` (HS256)
- [ ] Middleware rejects missing / malformed / expired / wrong-key tokens with
  401 and a uniform error shape
- [ ] Middleware does not invoke the route handler on failure
- [ ] Middleware attaches `req.user = { id, email }` on success
- [ ] `requireAuth` is applied at the top of `createApplicationsRouter`,
  `createProfileRouter`, and `createResumeRouter`
- [ ] No protected route forgets to apply the middleware (grep-checked)
- [ ] `/api/health` and `/api/auth/signup` remain public (no middleware)

---

## Signup & Allowlist

- [ ] `allowed_emails` Supabase table exists with the documented columns
- [ ] RLS is enabled on `allowed_emails` with no anon policies
- [ ] Server reads `allowed_emails` via the service role client only
- [ ] `POST /api/auth/signup` validates payload before any Supabase call
- [ ] Allowlist check runs before `supabase.auth.admin.createUser`
- [ ] Non-allowlisted signup returns 403 `SIGNUP_NOT_PERMITTED` and creates no
  Supabase user
- [ ] Allowlisted signup triggers verification email via Supabase default flow
- [ ] Error responses do not differentiate between "not allowlisted",
  "already exists", and "Supabase rejected" (FR-006 neutral channel)
- [ ] Emails are lowercased on both insert (operator-managed) and lookup
  (server-managed)

---

## Frontend Auth Flow

- [ ] Welcome page is mounted as a pre-app gate (not via the in-app `navigate`)
- [ ] Welcome page hosts login + signup overlay + email-verification callback
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
- [ ] Brand block: Alice_White.png at 44x44 + "Project Alice" wordmark in Sora
  16 / 600
- [ ] Three CTAs rendered: Sign In (primary indigo), Create Account
  (secondary outlined), Try Demo (ghost — **disabled with "coming soon"
  tooltip** until feature 020 ships)
- [ ] Hero background uses the documented radial-gradient stack over
  `var(--navy)`
- [ ] Hero slideshow rotates through Tracker / Application Modal / Profile /
  Filters / Calendar slides
- [ ] Screenshot cards use the documented border, radius, shadow, and rotation
  (`-2deg` primary, `1.5deg` secondary)
- [ ] Footer metadata row in DM Mono 11 / `var(--t3)` with the documented copy
- [ ] All copy and component breakpoints match the design specification
- [ ] No new CSS custom properties introduced — design tokens
  (`--indigo`, `--bg`, `--surface`, `--border`, `--t1/t2/t3`, Sora, DM Mono)
  reused from `src/styles/main.css`

---

## Auth Overlay (Modal / Bottom Sheet)

- [ ] Desktop (`≥760px`): renders as a centered modal using the existing
  `components/Modal.js` pattern
- [ ] Mobile (`<760px`): renders as a bottom sheet
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

---

## Hero Slideshow

- [ ] Five real-application screenshots live under
  `src/assets/welcome-hero/`
- [ ] Slideshow auto-rotates with the documented `500ms ease` opacity +
  transform transition
- [ ] Honors `prefers-reduced-motion: reduce` by disabling rotation and
  transform animations
- [ ] Placeholder fallback (single neutral card) renders when screenshot
  assets are not yet captured, so the welcome page is buildable in advance
  of the screenshot task

---

## Hosted Ownership Plan (documented, not implemented)

- [ ] `data-model.md` documents `applications.user_id` and `profile.user_id` for
  019 with type, nullability, FK, and index
- [ ] `data-model.md` documents the RLS policy shape for 019
- [ ] Plan and spec both state that 019 owns column creation, backfill, RLS
  application, and repository scoping
- [ ] Accepted limitation (shared hosted data pre-019) is acknowledged in the
  spec and not "fixed" in 018

---

## Tests

- [ ] `tests/server/auth-middleware.test.js` covers valid, missing, malformed,
  expired, and wrong-key tokens
- [ ] `tests/server/auth-signup.test.js` covers validation errors, non-allowlist
  rejection (no Supabase call), allowlist hit, and neutrality of error shapes
- [ ] `tests/server/routes-protected.test.js` covers 401 without token and 200
  with a valid token for each of applications/profile/resume
- [ ] `tests/data/authStore.test.js` covers subscribe/notify, session restore,
  and sign-out clearing
- [ ] `tests/components/welcome.test.js` covers form states (idle, loading,
  verification-sent, error) and rejection-message neutrality
- [ ] Existing route tests updated to either bypass the middleware in setup or
  attach a stub token
- [ ] All tests run with Supabase fully mocked at the module boundary; CI
  needs no live Supabase project

---

## Logging & Observability

- [ ] Server logs: signup attempted, signup rejected by allowlist, login
  succeeded, login failed, token rejected — at an appropriate level
- [ ] Logs do **not** contain plaintext passwords
- [ ] Logs do **not** contain full session tokens (token presence may be logged;
  contents may not)

---

## Documentation

- [ ] `quickstart.md` covers Supabase setup, `allowed_emails` creation, env
  vars, redirect URL configuration, and the manual validation flow
- [ ] `contracts/api.md` covers env vars, `Authorization` header, middleware
  behavior, `/api/auth/signup`, and the error-code inventory
- [ ] `research.md` records every plan-level decision with rejected alternatives
- [ ] `design.md` is acknowledged as deferred and the plan flags where
  implementation must pause until it arrives

---

## Out-of-Scope Re-confirmation

- [ ] No `user_id` columns added to `applications` or `profile` in this feature
- [ ] No RLS policies applied to `applications` or `profile` in this feature
- [ ] No SQLite schema changes
- [ ] No OAuth/social provider configuration
- [ ] No custom in-app password-reset UI
- [ ] No admin allowlist management UI
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
