# Feature Specification: Hosted Authenticated User Access

**Feature Branch**: `018-auth-user-access`
**Created**: 2026-05-14
**Status**: Draft
**Input**: `features/018-auth-user-access.md`

> **Amendment 2026-05-16 (Phase 12 finding fix)**: JWT verification is performed
> via Supabase's JWKS endpoint (ES256/RS256 asymmetric signing), not via a
> shared HS256 secret. `SUPABASE_JWT_SECRET` is no longer a required env var.
> See `plan.md` amendment header and `contracts/api.md` §3 for the current
> contract. Earlier references in this spec to HS256/`SUPABASE_JWT_SECRET`
> reflect the original design.

> **Amendment 2026-05-16 (Phase 13 — tracker chrome refresh)**: The Tracker page
> chrome (top bar, toolbar, mobile shell) is being refreshed to integrate the
> authentication identity cluster (email + sign-out) into a unified navy band,
> and to introduce mobile-specific navigation (bottom tab bar + FAB). Behavior
> remains as specified by FR-010 (session-aware navigation); the changes are
> primarily visual + mobile-layout, plus a small behavior delta around the
> signed-out state of the Tracker chrome (see FR-010a below). Source of truth
> for the visual design is `design/tracker.md`. Release Prep and Browser Smoke
> Test are deferred until the welcome-page refresh (Phase 14) also lands, so
> a single 0.8.1 release covers both UI phases.

> **Amendment 2026-05-16 (Phases 14–18 — welcome page refresh)**: The Welcome
> page introduced by Phases 06–09 is being rewritten to match the updated
> `design/welcome_page.md`, split across five phases by risk and dependency:
>
> - **Phase 14 (Foundation)** — appMeta module, design tokens, headline accent,
>   brand mark swap, removal of floating pills + disclaimer, mini-footer
>   sourced from `appMeta.js`, demo CTA placeholder via shared
>   `showDemoComingSoon()` stub. FR-020 (partial) + FR-023 + FR-026.
> - **Phase 15 (Hero scenes)** — four abstract animated scenes
>   (`SceneStack`, `ScenePipeline`, `SceneProfile`, `SceneLogo`); rebuilt
>   `HeroSlideshow` with 5500ms cycle, 700ms cross-fade, dot navigation
>   with progress bar. FR-021.
> - **Phase 16 (Tweaks + layouts + themes)** — Tweaks store + panel UI
>   (production), four layout modes (`diagonal | split | centered | hero`),
>   three theme variants (`warm | white | navy`). FR-022.
> - **Phase 17 (Auth Modal restyle)** — 440px shell, new overlay rgba +
>   blur, drop the tab strip, add "or" divider + in-modal demo button +
>   swap-mode link + legal copy on signup. No Forgot link. FR-024.
> - **Phase 18 (Mobile + cleanup)** — `<760px` portrait-stack branch in the
>   single `WelcomePage.js` module, deletion of the six `welcome-hero/*.png`
>   files, full rewrite of `tests/components/welcome.test.js`, spec/design
>   cross-check. FR-025 + FR-020 closure.
>
> The auth contract is unchanged across all five phases (still email +
> password via Supabase, still allowlist-gated, still verification-mailed).
> The "Try the demo" CTA renders enabled across the welcome page and the
> Auth Modal but always routes to the shared `showDemoComingSoon()` toast
> (Phase 14 ships the stub; Phase 17 wires the in-modal demo button to it).
> `window.alert()` is forbidden — see Task 14.8. Real demo behavior remains
> owned by feature 020. The Auth Modal's name field is **not** added
> (Supabase signup stays email + password; FR-002 unchanged). Mini footer
> version + license + issue links are sourced from the same constants as
> `src/components/Footer.js`. See FR-020 through FR-026 below; each FR
> tags the phase that owns it.

---

## Problem Statement

Feature 017 established hosted runtime architecture (Vercel + Supabase) but left
authentication, user identity, and ownership intentionally out of scope. Hosted mode
currently boots without any concept of "who" is using it, which blocks every downstream
hosted feature: per-user persistence (019), portfolio/demo separation (020), and the
hosted resume-import gate (021).

This feature adds Supabase-backed email/password authentication for hosted mode only,
gates protected hosted routes behind an authenticated session, restricts new signups to
an explicit allowlist, and defines (without implementing) the per-user ownership model
and Row Level Security policies that feature 019 will apply to the application and
profile tables.

Local SQLite mode remains entirely unaffected: no authentication, no allowlist, no
session state.

---

## Scope

- Wire Supabase Auth (email/password) into the hosted runtime
- Provide a public signup form, login form, and sign-out flow in the frontend
- Enforce the allowed-email check via a **Postgres allowlist trigger** —
  a `BEFORE INSERT ON auth.users` trigger function that consults an
  `allowed_emails` table and denies the signup at the database layer before any
  user is created — closing the bypass where a client could otherwise call
  `supabase.auth.signUp` directly with the anon key. (This is a plain Postgres
  trigger, not a Supabase "Auth Hook" — see data-model.md for terminology.)
- Use Supabase's built-in email-verification flow before a new account can log in
- Use Supabase's built-in password-reset flow (no custom in-app reset UI)
- Add an authentication middleware to the Express API that validates the Supabase
  session token on every protected hosted route
- Apply a hard login wall in hosted mode: all hosted protected routes return 401 for
  unauthenticated requests until feature 020 introduces demo behavior
- Update the frontend to render session-aware navigation (signed-in identifier vs
  signed-out call-to-action) and to gate the resume-import entry point on session state
- Persist the Supabase session across page refreshes via the Supabase JS client's
  default storage mechanism
- Verify at build time that the frontend has the required Vite-exposed Supabase
  configuration so a hosted deploy cannot ship with a silently-degraded frontend
- Document (not implement) the per-user ownership data model: `user_id` columns on
  hosted `applications` and `profile` tables, plus the RLS policy shape that feature
  019 will apply

## Non-Goals

- OAuth/social login providers (Google, GitHub, etc.)
- Multi-user collaboration, sharing, or organization concepts
- Admin dashboard for managing the allowlist (managed directly in Supabase)
- Custom in-app password-reset UI beyond Supabase's default email flow
- Account profile management beyond what Supabase Auth provides natively
- Authentication for local SQLite mode
- Creation, population, or migration of `user_id` columns on `applications` and
  `profile` tables — that work belongs to feature 019
- Application of RLS policies to `applications` and `profile` tables — also 019
- Migration of any existing hosted rows to user ownership
- Demo / public-explorer behavior — owned by feature 020
- Resume-upload size or rate limits — owned by feature 021

---

## User Stories

### User Story 1 — Allowlisted user signs up, verifies email, and signs in (Priority: P1)

A person whose email appears on the allowlist visits the hosted app, opens the signup
form, submits their email and password, receives a verification email, confirms it,
and then signs in. After signing in, the navigation reflects their signed-in state and
the protected hosted features (applications, profile, resume import) become available.

**Why this priority**: Without this flow nobody can use hosted mode. It is the
foundation every other hosted feature depends on.

**Independent Test**: Provision an email in the `allowed_emails` table. Use the signup
form with that email and a password. Confirm via the verification email. Sign in.
Verify the navigation shows signed-in state and a protected route (`GET /api/applications`)
returns 200 instead of 401.

**Acceptance Scenarios**:

1. **Given** an email is present in `allowed_emails`, **When** the user submits the
   signup form with that email and a valid password, **Then** a Supabase account is
   created, a verification email is sent, and the UI displays a "check your email"
   confirmation state.
2. **Given** a freshly-created unverified account, **When** the user attempts to sign
   in, **Then** sign-in fails with a clear "email not verified" message and no session
   is created.
3. **Given** the user clicks the verification link, **When** they then sign in with
   the registered password, **Then** a session is created, navigation shows signed-in
   state, and protected API routes return 200 for that session's requests.

---

### User Story 2 — Non-allowlisted signup attempt is rejected (Priority: P1)

A visitor whose email is not in the allowlist tries to sign up. The signup is rejected
with a clear user-facing error. No Supabase account is created and no verification
email is sent. The error message does not reveal the contents of the allowlist or
otherwise leak which emails are approved.

**Why this priority**: Allowlist enforcement is the only barrier to open registration.
Any bypass invalidates the feature's access-control model.

**Independent Test**: With an email that is not in `allowed_emails`, submit the signup
form. Verify that no row appears in Supabase's `auth.users` table, no verification
email is sent, and the UI shows a generic "signup not permitted for this address"
error.

**Acceptance Scenarios**:

1. **Given** an email is not in `allowed_emails`, **When** the signup is submitted,
   **Then** the Postgres allowlist trigger on `auth.users` raises an exception
   that prevents the insert; no account is created and no verification email
   is sent.
2. **Given** the rejection error is shown, **Then** it does not state whether other
   emails are approved, does not enumerate the allowlist, and does not differentiate
   between "not on the list" and any other arbitrary signup rejection in a way that
   would leak allowlist membership.
3. **Given** a client attempts to bypass the frontend by calling
   `supabase.auth.signUp` directly with the anon key, **When** the email is not in
   `allowed_emails`, **Then** the allowlist trigger still rejects the signup —
   the anon-key path is not a bypass because the trigger runs inside Supabase
   on every `auth.users` insert regardless of the caller.

---

### User Story 3 — Authenticated session persists across refreshes and supports sign-out (Priority: P1)

After signing in, the user refreshes the page, closes and reopens the tab, and
returns later in the same browser session — the signed-in state is preserved and
protected features remain available. When the user clicks "Sign out," the session is
cleared, navigation returns to signed-out state, and subsequent protected requests
return 401.

**Why this priority**: A non-persistent session forces the user to re-authenticate
on every refresh, which is not a usable product. Sign-out is the inverse and is
required for shared-device safety.

**Independent Test**: Sign in. Refresh the page. Verify the user is still signed in
and that a protected API call succeeds. Click "Sign out." Verify the navigation
returns to signed-out state and a protected API call returns 401.

**Acceptance Scenarios**:

1. **Given** a signed-in session, **When** the page is refreshed, **Then** the
   session is restored without re-prompting and protected API calls succeed.
2. **Given** a signed-in session, **When** the user clicks "Sign out," **Then** the
   Supabase session is terminated, navigation reflects signed-out state, and the
   next protected API call returns 401.
3. **Given** a session that has expired or been revoked, **When** the user makes a
   protected API call, **Then** the call returns 401 and the frontend transitions
   to the signed-out state without an unhandled error.

---

### User Story 4 — Unauthenticated hosted visitor hits the login wall (Priority: P1)

A visitor who is not signed in opens the hosted app. They see the login/signup
interface. All protected hosted routes return 401 when called without a valid
session token. They cannot view, create, or modify hosted applications or profile
data, and they cannot access the resume-import endpoint.

**Why this priority**: This defines the hosted security posture between 018 and the
later demo-mode feature (020). Without an enforced login wall, hosted mode is open.

**Independent Test**: Without signing in, attempt `GET /api/applications`,
`GET /api/profile`, and the resume-import endpoint. Verify each returns 401. Verify
the frontend renders a signed-out shell with no application data and no resume-import
entry point.

**Acceptance Scenarios**:

1. **Given** no session is active, **When** a protected hosted API route is called,
   **Then** the server returns 401 with a consistent error shape.
2. **Given** no session is active, **When** the frontend loads, **Then** the resume-
   import entry point is not visible and protected views are not rendered.
3. **Given** local mode is active (no auth configured), **When** the same routes are
   called, **Then** they behave exactly as before this feature — local mode is not
   subject to the login wall.

---

### User Story 5 — Authorization middleware rejects forged or tampered tokens (Priority: P2)

A request arrives at a protected hosted route bearing a session token that is
missing, malformed, expired, or signed by a key the server does not trust. The
middleware rejects the request with 401, does not invoke the route handler, and does
not leak which validation step failed.

**Why this priority**: The middleware is the primary enforcement layer for hosted
authorization (RLS in 019 is defense-in-depth). Any leak here weakens the whole
hosted model.

**Independent Test**: Send protected requests with each of: no Authorization header,
a malformed JWT, an expired JWT, and a JWT signed with a different key. Verify each
returns 401 with the same error shape and no stack traces or token diagnostics in
the response body.

**Acceptance Scenarios**:

1. **Given** a request with no `Authorization` header, **When** it hits a protected
   route, **Then** the route handler is not invoked and a 401 is returned.
2. **Given** a request with an expired or invalid token, **When** it hits a
   protected route, **Then** a 401 is returned with no internal diagnostics in the
   response body.
3. **Given** a request with a valid token, **When** it hits a protected route,
   **Then** the route handler runs and the resolved user identity is available to
   the handler for future ownership checks (019).

---

## Edge Cases

- **Allowlist entry added or removed after a user has already signed up**: existing
  Supabase accounts are unaffected; removal of an allowlist entry does not delete or
  disable the corresponding Supabase user. Disabling an existing user is an admin
  task performed in the Supabase dashboard.
- **Same email signs up twice**: Supabase's native duplicate-email handling applies;
  the UI surfaces a clear error without revealing whether the email is verified.
- **Email verification link expires before the user clicks it**: the user submits
  the signup form again with the same email. Supabase detects the existing
  unconfirmed user and issues a fresh verification email — no duplicate account is
  created, and no separate "resend verification" UI is required. Default
  verification link lifetime is 24 hours (configurable in the Supabase dashboard).
- **Password reset requested by an allowlisted user**: the Supabase-hosted reset page
  is used; there is no in-app reset UI in this feature.
- **Password reset requested for an email not on the allowlist or not registered**:
  Supabase's default reset flow is used. The response must not differentiate between
  "not registered" and "not allowlisted" — both produce a generic neutral response
  (Supabase's default reset endpoint already behaves this way).
- **Session token expires mid-session**: the next protected API call returns 401;
  the frontend handles this by transitioning to signed-out state, not by surfacing
  a raw error.
- **Allowlist table is empty or unreachable at signup time**: signup fails with a
  generic error; the system does not fall back to allowing the signup.
- **Hosted mode is configured but the `allowed_emails` table is missing**:
  signups fail loudly because the trigger function's `select` raises (or, if
  the trigger itself is also missing, signups fail OPEN — see next bullet).
- **Hosted mode is configured but the allowlist trigger is missing**: signups
  fail **OPEN**. Without the trigger, Supabase's default behavior is to allow
  any signup. This is an access-control failure mode and the system has **no
  runtime mitigation** for it — the trigger must be installed and verified by
  the operator before any production deploy. This is why quickstart §10
  documents an explicit pre-deploy bypass test (signup with a non-allowlisted
  email from dev tools; confirm rejection). The plan-review checklist makes
  the verification an explicit P0 gate.
- **Hosted frontend deployed without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`**:
  the production build must fail at build time. A Vite plugin asserts the variables
  are non-empty when `NODE_ENV=production`; deploys cannot ship a silently-degraded
  frontend that treats itself as local mode.
- **A user signs out in one tab while another tab has a stale session**: protected
  calls from the stale tab eventually return 401 once the token is refused; the
  frontend treats this the same as an expired session.
- **Local mode with hosted env vars partially set**: behavior follows the 017
  contract — local mode ignores hosted env vars; no auth is enabled.
- **Multiple authenticated users in the 018-only window (pre-019)**: see
  *Accepted Limitations* below — shared hosted data across authenticated users is
  an accepted limitation of this feature, not an edge case.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST integrate Supabase Auth for email/password authentication
  in hosted mode and MUST NOT activate any authentication in local mode.
- **FR-002**: System MUST provide a signup form, a login form, and a sign-out
  control in the hosted frontend.
- **FR-003**: System MUST require email verification (via Supabase's default flow)
  before a newly registered account can sign in.
- **FR-004**: System MUST persist the authenticated session across page refreshes
  using the Supabase JS client's default session storage.
- **FR-005**: System MUST enforce an allowlist check at the Supabase database layer
  via a Postgres `BEFORE INSERT` trigger on `auth.users` that consults the
  `allowed_emails` table and raises an exception on miss. The trigger MUST
  run regardless of caller (anon key, service role, or admin SDK) so that
  `supabase.auth.signUp` from the browser cannot bypass it.
- **FR-006**: Allowlist rejection messages surfaced to the user MUST be
  user-friendly and MUST NOT reveal allowlist membership of other addresses or leak
  internal details. The SignupForm MUST map Supabase's raw rejection error to a
  single neutral user-facing message identical to "this email cannot sign up right
  now," regardless of whether the underlying cause is allowlist miss, duplicate
  account, or any other Supabase-side rejection.
- **FR-007**: API MUST provide an authentication middleware that validates the
  Supabase session token on every protected hosted route and rejects requests with
  missing, malformed, expired, or untrusted tokens with a 401 response.
- **FR-008**: Protected hosted routes (applications, profile, resume import) MUST
  return 401 for any request without a valid session token; the route handler MUST
  NOT execute for rejected requests.
- **FR-009**: System MUST resolve and expose the authenticated user's identity
  (Supabase user id and email) to protected route handlers so that future ownership
  enforcement (feature 019) can read it without re-validating the token.
- **FR-010**: Frontend MUST render session-aware navigation: signed-in users see an
  identifier (email or display name) and a sign-out control; signed-out users see a
  call-to-action to sign in or sign up.
- **FR-010a (Phase 13)**: The Tracker top bar MUST integrate the identity cluster
  (email readout + sign-out button) into a unified navy band shared with the
  toolbar, per `design/tracker.md` §Top Bar / §Toolbar / §Authentication-Identity.
  When the auth state is `unauthenticated`, the identity cluster MUST NOT render
  on the Tracker — unauthenticated visitors are routed to the Welcome page, which
  remains the sole sign-in surface. The Tracker chrome therefore renders the
  cluster only in its signed-in form (email + sign-out) or in `local-mode`
  (no cluster).
- **FR-010b (Phase 13)**: The Tracker chrome MUST collapse responsively per
  `design/tracker.md` §Responsive Breakpoints — at ≤ 639px the page nav moves
  to a Bottom Tab Bar, the "+ New application" toolbar button is replaced by a
  FAB, and the sign-out button collapses to icon-only (32px hit target) with the
  email readout hidden; at < 380px ("fold-narrow"), the "Project Alice" wordmark
  hides leaving only the 38px logo mark beside the sign-out icon.
- **FR-010c (Phase 13)**: Email truncation in the Tracker top bar MUST be
  driven by a `max-width: 220px` single-line ellipsis (CSS), not by a JavaScript
  character-count cap. The full email MUST be exposed via the element's `title`
  attribute for hover/focus.
- **FR-011**: Frontend MUST gate the resume-import entry point on an authenticated
  session: signed-out visitors MUST NOT see or be able to invoke it.
- **FR-012**: Frontend MUST NOT be relied on as the only enforcement layer; every
  protected action MUST also be enforced by the API.
- **FR-013**: System MUST document — without implementing — the per-user ownership
  model for `applications` and `profile`: a non-nullable `user_id` column referencing
  Supabase `auth.users.id`, plus the RLS policy shape (`user_id = auth.uid()`) to be
  applied by feature 019.
- **FR-014**: System MUST document — without implementing — that feature 019 is
  responsible for: (a) adding the `user_id` columns, (b) populating them, (c)
  applying RLS policies, and (d) updating repositories to filter by user.
- **FR-015**: System MUST preserve required application fields, validation rules,
  and the constitution-mandated UX behaviors from prior features without regression.
- **FR-016**: The Express server MUST log the authentication events it actually
  observes — token rejection (count + failure category, e.g. `missing` /
  `malformed` / `expired` / `signature`), hosted-route 401 responses, and
  runtime-mode reporting via `/api/health` — at a level appropriate for
  operational visibility. **Tokens MUST NOT be logged in any form**, neither
  full nor prefixed. Passwords MUST NOT be logged (the server never sees them).
  Signup attempts, login successes/failures, and verification-email events go
  **directly between the browser and Supabase Auth**; they do not pass through
  Express and therefore cannot be logged server-side. Operators wanting that
  visibility MUST consult **Supabase Dashboard → Logs → Auth Logs**, which is
  the source of truth for signup/login events in this architecture.
- **FR-017**: The Express server MUST surface a clear startup configuration
  error if hosted mode is active but `SUPABASE_JWT_SECRET` (or any other
  hosted-required server env var from 017's contract) is missing. The server
  has no Supabase client in this feature and therefore CANNOT verify
  `allowed_emails` reachability or trigger installation at startup. Those
  Supabase-side concerns are operator responsibilities and are verified
  manually as a P0 step in quickstart §10 before any production deploy
  (table exists, trigger installed, bypass test passes).
- **FR-018**: The production frontend build MUST fail with a descriptive error if
  `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing or empty, so a hosted
  deploy cannot silently ship a frontend that treats itself as local mode.
- **FR-019**: The frontend MUST additionally perform a runtime check against
  `GET /api/health` (which reports the server's runtime mode) and render a
  "Configuration Error" view when the server reports `hosted` but the frontend's
  Supabase client is unconfigured — defense in depth against a deploy whose
  build-time check was somehow bypassed.
- **FR-020 (Phases 14 + 18)**: The Welcome page MUST be rewritten to match
  `design/welcome_page.md`. The headline MUST render `Your job search,
  <em>organized.</em>` with the indigo underline-glow on the `<em>` per
  design §4.2. The brand block MUST swap between `Alice_Colored.png` (warm /
  white themes) and `Alice_White.png` (navy theme + Scene 4) per design §4.1.
  The floating metadata pills + "Sample data — illustrative only" disclaimer
  from the previous design MUST be removed.
- **FR-021 (Phase 15)**: The hero slideshow MUST replace the 6 product
  screenshots with the four abstract scenes specified in design §4.4:
  `SceneStack` (tilted card stack), `ScenePipeline` (status-cycling preview
  card), `SceneProfile` (donut + 4 stat chips), and `SceneLogo` (Alice mark
  with sparkles). Auto-cycle 5500ms per scene, 700ms cross-fade, with
  click-to-jump dot controls and a per-scene progress indicator.
  `prefers-reduced-motion: reduce` MUST disable rotation, scene-internal
  animations, and the dot progress bar.
- **FR-022 (Phase 16)**: The Welcome page MUST expose a runtime Tweaks panel
  controlling `layout` (`diagonal | split | centered | hero`), `theme`
  (`warm | white | navy`), `copyIntensity` (`none | minimal | pitch`),
  `authState` (`signin | signup`), and `heroScene` (`auto | stack | pipeline
  | profile | logo`). Defaults match design §5. The panel MUST also honor
  matching `?key=value` URL query parameters at load time (overlaying any
  matches onto defaults) so deep links can pre-configure the page. Panel
  state MUST NOT be persisted across sessions — the page is unauthenticated
  pre-app and storing UI prefs there has no value.
- **FR-023 (Phase 14, extended by Phase 17)**: The "Try the demo" CTA MUST
  render enabled (no disabled attribute, no "Coming soon" tooltip), but
  clicking it MUST surface a transient "Demo coming soon" toast (via the
  existing `src/components/Toast.js`) rather than navigating. `window.alert()`
  MUST NOT be used. Real demo behavior is out of scope for 018 and is owned
  by feature 020. The Auth Modal demo button (design §4.6 footer) shares
  this exact handler (Phase 14 ships the shared `showDemoComingSoon()` stub
  in `src/pages/welcome/demoStub.js`; Phase 17 wires the in-modal demo
  button to the same handler — see Task 14.8 + Task 17.1).
- **FR-024 (Phase 17)**: The Auth Modal MUST be restyled per design §4.6 —
  440px max-width, 14px radius, `rgba(8,8,24,.55)` overlay with 6px backdrop
  blur, 40px header logo, `signin` body containing email → password,
  `signup` body containing email → password (no name field), footer
  containing primary submit → "or" divider → demo button → swap-mode link
  → legal copy (signup only). The "Forgot?" link from the design is
  **deferred** — Phase 14 does not ship a forgot-password trigger
  (operator-driven reset only, consistent with 018's "no custom in-app
  reset UI" + Phase 14's "no new auth API" constraints). The mode swap
  MUST occur in-place without remounting; the entered email value MUST
  persist across the swap.
- **FR-025 (Phase 18)**: At viewports `<760px`, the Welcome page MUST render
  the simplified portrait stack from design §3.3 within the same module
  (single responsive `WelcomePage.js`; no separate page or HTML file).
  Mobile mode MUST omit the slideshow, render full-width CTAs with the
  pulsing green dot on the demo button, and use `Alice_Colored.png` 68×68
  with the brand block left-aligned per design §3.3. The Tweaks panel MAY
  be hidden on mobile (its layout/theme switches are not meaningful at this
  viewport).
- **FR-026 (Phase 14)**: The Welcome mini footer MUST render the version,
  license, and feedback-link items sourced from a single shared module that
  also feeds [src/components/Footer.js](src/components/Footer.js). The
  version constant (e.g. `APP_VERSION`) and the issue URL (e.g. `ISSUE_URL`)
  MUST NOT be duplicated; the license string MUST be `PolyForm Noncommercial
  1.0.0` (not "MIT"). Report-an-issue and Request-a-feature items MUST be
  anchor elements with `target="_blank"` and `rel="noopener noreferrer"`
  pointing at `ISSUE_URL`, mirroring `createFeedbackLink` in Footer.js.

### Key Entities

- **Supabase User**: A user record stored in Supabase's `auth.users` table. Owned by
  Supabase Auth; not modeled in the project schema. Identified by a UUID and an
  email address.
- **Authenticated Session**: A signed JWT issued by Supabase Auth after successful
  login and email verification; persisted on the client by the Supabase JS client;
  validated by the API middleware on every protected request.
- **Allowed Email**: A row in the `allowed_emails` Supabase table containing a single
  email address (and optional metadata such as added-by, added-at). Checked by
  the allowlist trigger at signup time. Removal of an allowed-email row does not
  delete an existing Supabase user.
- **Allowlist Trigger**: A Postgres `BEFORE INSERT` trigger on `auth.users` that
  invokes a `SECURITY DEFINER` function. The function looks up the candidate
  email in `allowed_emails` and raises an exception to deny the signup on miss.
  This is the single source of enforcement for FR-005 and runs regardless of
  which Supabase API initiated the signup. **Not** a Supabase "Auth Hook"
  (which is a separate, JSONB-based mechanism); a plain Postgres trigger is
  sufficient for our scale and avoids dashboard configuration drift.
- **Auth Middleware Context**: The per-request user identity (Supabase user id,
  email) resolved by the authentication middleware and attached to the request for
  downstream handlers.
- **Hosted Ownership Plan (documented, not implemented)**: The future shape of
  per-user data ownership — `user_id` columns on `applications` and `profile`, plus
  RLS policies `user_id = auth.uid()` — to be created and applied by feature 019.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: An allowlisted user can sign up, verify their email, sign in, and
  reach a protected hosted route returning 200 — entirely through the application
  UI and the Supabase default email flow.
- **SC-002**: A non-allowlisted signup attempt produces no row in `auth.users`, no
  verification email, and a generic user-facing rejection error. This holds for
  both the application signup form and a direct anon-key call to
  `supabase.auth.signUp` — the allowlist trigger denies both paths identically.
- **SC-003**: Every protected hosted route returns 401 for requests with missing,
  malformed, expired, or untrusted tokens; route handlers do not execute in those
  cases.
- **SC-004**: After signing in and refreshing the page, the user remains signed in
  and protected API calls continue to succeed without re-prompting.
- **SC-005**: After signing out, navigation returns to signed-out state and the
  next protected API call returns 401.
- **SC-006**: Local SQLite mode boots and operates with no authentication enabled,
  no Supabase calls, and no regression in existing automated tests.
- **SC-007**: Hosted mode boots with a clear, descriptive startup error if any
  required server env var (`SUPABASE_JWT_SECRET`, plus the vars inherited from
  017's contract) is missing. The Express server has no Supabase client and
  therefore CANNOT verify the `allowed_emails` table or the allowlist trigger
  at startup — those concerns are operator responsibilities and are validated
  manually via the quickstart §10 pre-deploy gate.
- **SC-008**: The frontend bundle does not contain `SUPABASE_SERVICE_ROLE_KEY` or
  `SUPABASE_JWT_SECRET` (carried over from 017 and re-verified here).
- **SC-008b**: A production `npm run build` with any of `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, or `VITE_AUTH_EMAIL_REDIRECT_URL` missing or empty
  fails with a descriptive error naming the offending variable(s) and does not
  produce a bundle.
- **SC-009**: Server logs include the auth events the server actually observes —
  token-rejection counts + failure categories (`missing` / `malformed` /
  `expired` / `signature`), hosted-route 401 responses, and `/api/health`
  runtime reporting. Server logs do NOT include tokens (in any form),
  passwords (server never sees them), signup attempts, or login outcomes —
  the latter two flow directly browser ↔ Supabase and are visible only in
  Supabase Dashboard → Logs → Auth Logs.
- **SC-010**: The spec's ownership-and-RLS plan section is concrete enough that
  feature 019's `data-model.md` can adopt it without re-deciding column types,
  nullability, or policy expressions.

---

## Data Considerations

### Owned by this feature

- **`allowed_emails` table (Supabase, created in this feature)**
  - `email`: `TEXT`, primary key, lowercased on insert, `CHECK (length(email) <= 254)`
  - `added_at`: `TIMESTAMPTZ`, default `now()`
  - `added_by`: `TEXT`, optional — free-text label for the operator who added the row
  - Access: managed directly in the Supabase dashboard; not exposed via the API.
  - RLS: deny-all (no policies). Read only by the allowlist trigger function
    via `SECURITY DEFINER`. The application server has no Supabase client and
    does not touch this table.

- **Allowlist trigger (Postgres `BEFORE INSERT ON auth.users`)**: the single
  enforcement point for FR-005. Documented in data-model.md §2-3. Installed
  manually via SQL editor in quickstart §3.

- **Supabase Auth (consumed, not modeled)**: this feature wires the project to
  Supabase's built-in `auth.users` table and built-in email-verification and
  password-reset flows. No schema additions to `auth.users` are required.

- **Environment variable additions (extending the 017 contract)**

  | Variable | Scope | Required in local | Required in hosted |
  |---|---|---|---|
  | `SUPABASE_JWT_SECRET` | server-only | no | yes |
  | `VITE_SUPABASE_URL` | client (Vite, build-time) | no | yes (hosted build) |
  | `VITE_SUPABASE_ANON_KEY` | client (Vite, build-time) | no | yes (hosted build) |
  | `VITE_AUTH_EMAIL_REDIRECT_URL` | client (Vite, build-time) | no | yes (hosted build) — used for verification email callbacks; passed to `supabase.auth.signUp({ options: { emailRedirectTo } })` |

  All other Supabase env vars are inherited from 017. Vite-prefixed vars are
  read at build time and inlined into the bundle; the production build fails
  (via Vite plugin) when any of them is empty.

### Documented for feature 019 (not implemented here)

- **`applications.user_id`**: `uuid`, NOT NULL once 019 populates existing rows,
  references `auth.users(id)` ON DELETE CASCADE (deletion behavior to be confirmed
  in 019's data model). 017 currently models this as nullable; 019 will populate
  and enforce non-null.
- **`profile.user_id`**: same shape as above; profile becomes per-user.
- **RLS policy shape (to be applied by 019)**:
  - `applications`: `USING (user_id = auth.uid())` and `WITH CHECK (user_id = auth.uid())`
    on SELECT/INSERT/UPDATE/DELETE.
  - `profile`: identical shape.
- **Repository contract impact (handled by 019)**: `getAll`, `getById`, `create`,
  `update`, `archive` for applications and `get`, `upsert` for profile will scope
  by the authenticated user id resolved by 018's middleware.

### Not changed by this feature

- SQLite schema remains unchanged. Local mode does not add `user_id` columns and
  does not enforce ownership.
- The repository interface contract from 017 remains the same. 019 introduces the
  user-scoping changes.

---

## Accepted Limitations

- **Shared hosted data across authenticated users until 019 ships.** This feature
  authenticates users but does not yet scope hosted applications or profile data by
  `user_id` — that work is owned by feature 019. During the 018-only window, every
  authenticated user sees and mutates the same hosted applications/profile rows.
  This is accepted because (a) the login wall prevents anonymous access, (b) the
  allowlist controls who can sign in at all, and (c) feature 019 is the next
  feature in the sequence and closes the gap before any externally shared release.
  Reviewers and operators must not interpret a successful 018 deployment as
  multi-user-safe.

- **018-only hosted data is treated as throwaway.** Because no `user_id` attribution
  exists for rows created during the 018-only window, feature 019's backfill MUST
  wipe the hosted `applications` and `profile` tables before adding the `user_id`
  column. Any operator running 018 in hosted mode should consider hosted data
  written during this window as disposable. This is acceptable because the same
  shared-data limitation above already makes the data not multi-user-safe.

---

## Assumptions

- Supabase Auth's default email/password provider is acceptable; magic-link and
  social providers are not configured in this feature.
- Supabase's default email templates (verification, password reset) are acceptable
  without customization in this feature.
- The hosted deployment uses a single Supabase project; multi-tenant Supabase setup
  is not in scope.
- The frontend uses the Supabase JS client directly for sign-up, sign-in, sign-out,
  and session storage; protected data flows still go through the Express API, not
  through direct Supabase reads.
- Allowlist enforcement lives entirely in Supabase — there is no Express signup
  endpoint. The Postgres allowlist trigger (BEFORE INSERT on `auth.users`) is
  the single source of truth for allowlist enforcement, regardless of which
  Supabase caller initiated the signup. Operators MUST install and verify the
  trigger before any production deploy (see quickstart §10).
- The Express API validates Supabase JWTs locally using `SUPABASE_JWT_SECRET`
  rather than calling Supabase Auth on every request.
- The allowlist is small (operator-managed, on the order of tens of entries at most);
  enumeration performance is not a design concern.
- Email addresses are compared case-insensitively (lowercased on both the allowlist
  row and the signup submission).
- Local SQLite mode continues to be the primary developer workflow; nothing in this
  feature requires a network round-trip to Supabase for `npm run server:dev`.
