# Implementation Plan: Hosted Authenticated User Access (018)

> **Amendment 2026-05-16 (Phase 12 finding fix)**: The JWT verification design
> in this plan was originally specified as HS256 with a shared `SUPABASE_JWT_SECRET`.
> Manual validation in Phase 12 surfaced that modern Supabase projects (created
> from 2024+) sign access tokens with asymmetric keys (ES256 by default) and
> the Legacy JWT Secret is no longer the source of truth. The middleware was
> rewritten to verify via Supabase's JWKS endpoint
> (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`) using `jose`, accepting
> `['ES256', 'RS256']`. `SUPABASE_JWT_SECRET` is no longer required; the JWKS
> URI is derived from `SUPABASE_URL`. References in this plan to HS256, `jwtSecret`,
> and `jsonwebtoken` reflect the original design and have been superseded — see
> `contracts/api.md` §3 for the current contract.

**Branch**: `018-auth-user-access` | **Date**: 2026-05-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/018-auth-user-access/spec.md`
**Visual design**: [design/welcome_page.md](../../design/welcome_page.md) — diagonal
split layout, hero slideshow, three-CTA welcome page, centered-modal auth overlay
at every breakpoint. All design tokens it references (`--indigo`, `--bg`,
`--surface`, `--border`, `--t1/t2/t3`, Sora, DM Mono) already exist in
[src/styles/main.css:1-28](../../src/styles/main.css#L1-L28).

---

## Summary

Add hosted email/password authentication to Project Alice using Supabase Auth, gate
all protected hosted API routes behind a JWT-validating middleware, restrict signups
via a **Postgres allowlist trigger** (`BEFORE INSERT ON auth.users`) that
enforces an `allowed_emails` table at the database layer, and replace the
unauthenticated hosted shell with a welcome-page login wall. Local SQLite
mode is untouched.

> **Naming note.** Throughout this spec package, "allowlist trigger" refers
> to a plain Postgres trigger and trigger function — not a Supabase "Auth
> Hook" (which is a separate JSONB-based mechanism with dashboard configuration
> and `supabase_auth_admin` grants). The trigger approach is simpler at our
> scale and fires regardless of any Supabase Auth-Hooks dashboard setting.

Concretely this introduces:
1. A welcome-page pre-app gate in the frontend, laid out per
   [design/welcome_page.md](../../design/welcome_page.md): diagonal split, brand
   block, headline + copy, three CTAs (Sign In / Create Account / **Try Demo —
   disabled with "coming soon" tooltip until feature 020 ships**), hero slideshow
   of real application screenshots, footer metadata, illustrative-only disclaimer
   on the floating metadata pills.
2. A **centered modal auth overlay at every breakpoint** (no separate bottom-sheet
   variant) that hosts the login and signup forms, mounted from the welcome page
   when the user clicks a CTA. The overlay is a standalone component
   (`AuthOverlay.js`), not an extension of the existing `Modal.js`, to avoid
   regressing existing modals.
3. A handler in the welcome page for Supabase's email-verification callback
   (`?auth=callback` URL parameter).
4. A frontend `services/supabaseClient.js` module wrapping `@supabase/supabase-js`
   for sign-up, sign-in, sign-out, and session restore. The frontend talks to
   Supabase Auth **directly** for signup — there is no Express signup endpoint.
5. A frontend `data/authStore.js` module owning session state and subscribers,
   analogous to the existing `data/store.js`.
6. An Express `server/auth/middleware.js` containing only the JWT-validating
   `requireAuth` middleware. (No `routes.js`, no admin client, no server-side
   allowlist repo — all signup gating happens in Supabase.)
7. Wiring `requireAuth` into each protected router (applications, profile, resume)
   per the agreed scoping decision.
8. A new Supabase `allowed_emails` table with deny-all RLS, **plus a Postgres
   trigger function** (the allowlist trigger) wired to fire
   `BEFORE INSERT ON auth.users` to enforce the allowlist regardless of which
   Supabase caller (anon-key client, service-role client, or admin SDK)
   initiated the signup.
9. A **build-time Vite assertion** that fails production builds when
   `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is empty, plus a runtime
   handshake (`GET /api/health` reports the server's runtime mode) that mounts a
   "Configuration Error" view when the server reports hosted but the client is
   unconfigured.
10. Documentation of the per-user ownership model (`user_id` columns + RLS on
    applications/profile) without implementing it — 019 will apply it and will
    **wipe pre-019 hosted data** as part of the backfill.

The feature does **not** introduce per-row user ownership for `applications` or
`profile`. The login wall is the security boundary in this feature; data
partitioning arrives in feature 019.

---

## Technical Context

**Language/Version**: Node.js ≥ 20.19.0, JavaScript (ESM)
**Primary Dependencies**: Express 4, Vite 8, Vitest 4, Zod 4. **New**:
`@supabase/supabase-js` (frontend only). **New**: `jsonwebtoken` (server JWT
verification with `SUPABASE_JWT_SECRET`).
**Storage**: SQLite (local mode, unchanged); Supabase Auth (`auth.users` schema,
managed by Supabase); new Supabase `allowed_emails` table; new Postgres trigger
function on `auth.users`.
**Testing**: Vitest with Supabase fully mocked at the module boundary — no live
Supabase project required for CI. JWT verification tested with self-signed test
tokens. The allowlist trigger is validated manually via quickstart §6 and
§10 (it lives inside Supabase and cannot be unit-tested from our codebase).
**Target Platform**: Local Node.js (dev); Vercel serverless (hosted).
**Project Type**: Web application — Vite frontend + Express API (unchanged shape).
**Constraints**:
- Frontend talks to Supabase Auth directly via the JS client for sign-up, sign-in,
  sign-out, and session restore; data flows still go through Express.
- All allowlist enforcement lives in Supabase (the Postgres allowlist trigger
  on `auth.users`). Express has no signup endpoint and no admin client.
- Express verifies JWTs locally using `SUPABASE_JWT_SECRET` — no per-request
  Supabase round-trip.
- `SUPABASE_SERVICE_ROLE_KEY` must never appear in the Vite bundle (carried over
  from 017's contract; re-verified here). 018 does not consume the service role
  key in code — but the env contract preserves it for 019.
- The `allowed_emails` table is read **only by the trigger function** running
  with `SECURITY DEFINER`. Deny-all RLS means the anon key cannot enumerate it
  from the client.
**Scale/Scope**: Single hosted operator + a handful of allowlisted users (tens at
most). Performance is not a design concern at this scale.

---

## Architecture

```text
┌──────────────────────────── Browser ────────────────────────────┐
│                                                                  │
│  ┌────────────────────┐        ┌──────────────────────────────┐  │
│  │  Welcome page      │  auth  │  data/authStore.js           │  │
│  │  (CTAs + auth      │◄──────►│  ─ session JWT               │  │
│  │   overlay modal +  │        │  ─ user identity             │  │
│  │   verify callback) │        │  ─ subscribers               │  │
│  └─────────┬──────────┘        └──────────┬───────────────────┘  │
│            │                              │                      │
│            │ supabase.auth.signUp /       │                      │
│            │ signInWithPassword / signOut │                      │
│            │                              │                      │
│  ┌─────────▼──────────┐                   │                      │
│  │  App shell         │◄──────────────────┘ on signed-in         │
│  │  (Tracker/Profile  │                                          │
│  │   /Calendar)       │                                          │
│  └────────┬───────────┘                                          │
│           │                                                      │
│           ▼ services/api.js (attaches Authorization header)      │
└───────────┼─────────────────────┬────────────────────────────────┘
            │                     │
            │                     │ supabase.auth.*  (sign-up/in/out)
            ▼                     ▼
┌──────── Express API ─────┐   ┌──────── Supabase ────────────────┐
│ /api/health (public)     │   │ Auth (auth.users)                │
│                          │   │   ├── trigger: before_user_       │
│ /api/applications/*  ┐   │   │   │       created()              │
│ /api/profile/*       │── │   │   │       reads allowed_emails    │
│ /api/resume/*        ┘   │   │   │       raises on miss          │
│   requireAuth():         │   │   │                               │
│   verify JWT (HS256,     │   │   ├── sends verification email    │
│   SUPABASE_JWT_SECRET)   │   │   │       on signUp               │
│   attach req.user =      │   │   └── issues JWT on signIn        │
│     { id, email }        │   │                                   │
│   401 on bad token       │   │ allowed_emails (RLS deny-all)     │
└────────┬─────────────────┘   └──────────────────────────────────┘
         │
         └──► SQLite repositories (local mode) — unchanged
              (hosted-mode repos arrive in 019)
```

### Why all signup gating lives in Supabase (not Express)

Three approaches were considered:
1. **Server-side Express signup endpoint** that pre-checks the allowlist before
   calling `supabase.auth.admin.createUser`. *(Rejected.)* `admin.createUser` does
   not send the verification email, and the publicly-shipped anon key would let
   any browser bypass the Express check by calling `supabase.auth.signUp` directly.
2. **`supabase.auth.admin.inviteUserByEmail`** with an out-of-band allowlist
   check. *(Rejected.)* Magic-link invite UX, not email+password, and adds a
   second flow to maintain.
3. **Postgres allowlist trigger** — a `BEFORE INSERT` trigger function on
   `auth.users` that consults `allowed_emails` and raises an exception on
   miss. **(Chosen.)** Runs at the database layer so anon-key direct signup
   cannot bypass it; reuses Supabase's built-in verification-email flow; removes
   the entire Express signup surface from the codebase.

The chosen approach trades "signup logic visible in our repo" for "signup logic
unbypassable." The trigger function is small (~10 lines of PL/pgSQL) and is
documented in `data-model.md` and `quickstart.md` so operators can install
and verify it during setup.

> **Distinction from Supabase Auth Hooks.** Supabase also offers a separate
> "Auth Hooks" feature with JSONB-based functions, dashboard configuration,
> and grants to `supabase_auth_admin`. That mechanism would also work but adds
> setup steps that operators can forget. The plain Postgres trigger fires
> regardless of any Supabase dashboard hook setting and is sufficient for our
> single-allowlisted-user-set scale.

---

## Data Flow

### Signup
1. User opens the auth overlay (Create Account tab) and submits email + password.
2. Frontend calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo: VITE_AUTH_EMAIL_REDIRECT_URL } })`.
3. Supabase's "Before User Created" trigger fires:
   - Lowercases the candidate email.
   - Looks it up in `allowed_emails`.
   - On miss → raises an exception. Supabase returns an error to the JS client.
     SignupForm maps the error to the neutral message "this email cannot sign up
     right now."
   - On hit → trigger returns; Supabase inserts the row in `auth.users` and sends
     a verification email to `emailRedirectTo`.
4. Frontend transitions the overlay to its verification-sent state.
5. User clicks the verification link in their inbox → lands on the welcome page
   with `?auth=callback#access_token=…` → Supabase JS client (with
   `detectSessionInUrl: true`) consumes the hash, confirms the account, and
   stashes the session in localStorage. `authStore` flips to authenticated and
   the app shell mounts.

### Sign-in
1. User submits email + password.
2. Frontend calls `supabase.auth.signInWithPassword(...)`.
3. On success the Supabase JS client stores the JWT in localStorage; `authStore`
   notifies subscribers; the app shell mounts the regular app.
4. `services/api.js` reads the current JWT from `authStore` and attaches it as
   `Authorization: Bearer <jwt>` on every API call.

### Protected request
1. `services/api.js` attaches the JWT.
2. `requireAuth` middleware verifies the JWT locally via `jsonwebtoken` using
   `SUPABASE_JWT_SECRET` (HS256). On success it sets `req.user = { id, email }`.
3. Route handler runs as today. (019 will later filter by `req.user.id`.)
4. On verification failure → 401 with `{ error: { code: "UNAUTHORIZED" } }` and
   the route handler is not invoked.

### Sign-out
1. User clicks sign-out → frontend calls `supabase.auth.signOut()` → JS client
   clears localStorage → `authStore` notifies subscribers → shell switches to the
   welcome page.
2. Server is not involved beyond the next protected call returning 401 if it
   somehow runs against a stale token (which `signOut` should have purged).

### Session restore on page load
1. On boot, the Supabase JS client reads the persisted session from localStorage.
2. `authStore` initializes from the client's session.
3. If authenticated → app shell mounts. If not → welcome page mounts.

---

## Constitution Check

- [x] Required application fields preserved; no schema changes to `applications`
  or `profile` in this feature
- [x] Validation rules remain centralized within their domain: existing
  application-record validation stays in `server/validation/`. Signup field
  validation (email format, password minimum length) lives co-located in
  `src/pages/welcome/SignupForm.js` because there is no Express signup
  endpoint — the form is the only point where signup input exists before it
  goes directly to Supabase Auth.
- [x] No external analytics, tracking, or data sharing introduced; Supabase Auth
  emails are operational, not analytic
- [x] Business logic stays server-side: allowlist enforcement and JWT validation
  are both server responsibilities; the frontend is only the transport
- [x] Local SQLite mode entirely unaffected — no Supabase calls, no middleware
  activated, no env vars required
- [x] No silent data corruption: signup failures are explicit; JWT failures are
  401s; missing config produces startup errors
- [x] Operations covered: add (signup), edit (login, sign-out), search/filter
  unaffected, review (protected routes return 401 cleanly)
- [x] UX requirements: empty/loading/error states explicit on welcome page;
  desktop/mobile supported; keyboard nav preserved; status not communicated by
  color alone
- [x] Testing: core validation logic (allowlist check, JWT verification, signup
  validation) automated; status transitions, required-field enforcement unchanged

**Complexity Tracking**:

| Complexity item | Why needed | Simpler alternative rejected because |
|---|---|---|
| Postgres allowlist trigger on `auth.users` | Anon key is publicly shipped; an Express pre-check is bypassable. The trigger fires inside Supabase regardless of caller. | Express signup endpoint + `admin.createUser` is both bypassable (anon-key direct call) and silent (admin.createUser does not send verification email). |
| Welcome-page pre-app gate | Hard login wall; protected app shell never renders for unauthenticated users | In-app `navigate('login')` requires rendering navbar around an unauthenticated user, weakening the wall metaphor |
| `data/authStore.js` separate from `data/store.js` | Session state has a different lifecycle and persistence model than application data | A combined store would couple Supabase auth subscriptions to application data flows |
| `jsonwebtoken` dependency | Local JWT verification avoids a Supabase round-trip per request | Calling `supabase.auth.getUser()` per request multiplies hosted latency by 1 RTT and creates a runtime Supabase dependency for every API call |
| Build-time `VITE_SUPABASE_*` assertion via Vite plugin | Hosted deploys must fail loud at build time when the frontend can't reach Supabase, not silently boot into degraded local-mode behavior | A runtime-only check ships broken bundles and shifts failure to the end user |

---

## Project Structure

```text
server/
├── auth/                         # NEW
│   └── middleware.js             # requireAuth(req, res, next) — JWT verify only
├── config.js                     # MODIFIED — add SUPABASE_JWT_SECRET
├── index.js                      # MODIFIED — per-router requireAuth wiring; /api/health
│                                 #            reports runtime mode
├── routes/
│   ├── applications.js           # MODIFIED — accepts optional requireAuth
│   ├── profile.js                # MODIFIED — accepts optional requireAuth
│   └── resume.js                 # MODIFIED — accepts optional requireAuth
└── db/                           # unchanged (SQLite)

# REMOVED from earlier plan revision:
#   server/auth/supabase.js        (no admin client needed — Supabase enforces allowlist via trigger)
#   server/auth/routes.js          (no /api/auth/signup endpoint)
#   server/validation/auth.js      (signup validation moves to SignupForm via SDK error mapping)
#   server/repositories/allowedEmails.js (table read only by Postgres trigger)

vite.config.js                    # MODIFIED — add build-time assertion plugin for VITE_SUPABASE_*

src/
├── data/
│   ├── authStore.js              # NEW — session state, subscribers
│   └── store.js                  # unchanged
├── pages/
│   ├── welcome/                  # NEW — middle-ground split per I4
│   │   ├── WelcomePage.js        # mount, layout, brand block, CTA group,
│   │   │                         # floating meta, callback handler (inlined)
│   │   ├── HeroSlideshow.js      # rotating screenshots + reduced-motion
│   │   ├── AuthOverlay.js        # standalone centered modal at every breakpoint;
│   │   │                         # focus trap, ESC/backdrop close, tab strip
│   │   ├── LoginForm.js          # email + password; Supabase signInWithPassword
│   │   └── SignupForm.js         # email + password; Supabase signUp + neutral
│   │                             # error mapping; verification-sent state
│   ├── Tracker.js                # unchanged
│   ├── Profile.js                # unchanged
│   ├── ProfileEdit.js            # unchanged
│   └── Calendar.js               # unchanged
├── pages/ConfigError.js          # NEW — rendered when server reports hosted but
│                                 #       client has no Supabase config (runtime
│                                 #       defense-in-depth for FR-019)
├── services/
│   ├── api.js                    # MODIFIED — attach Authorization header from authStore
│   ├── healthApi.js              # NEW — GET /api/health for runtime handshake
│   ├── resumeApi.js              # MODIFIED — same Authorization header pattern
│   └── supabaseClient.js         # NEW — wrap @supabase/supabase-js; reads
│                                 #       VITE_SUPABASE_URL / _ANON_KEY /
│                                 #       _AUTH_EMAIL_REDIRECT_URL
├── components/
│   ├── Modal.js                  # unchanged — NOT used by AuthOverlay
│   ├── Navbar.js                 # MODIFIED — signed-in identifier + sign-out control
│   └── ResumeImport.js           # MODIFIED — hide when signed out
├── assets/
│   ├── Alice_White.png           # already present — used in BrandBlock (inlined in WelcomePage)
│   └── welcome-hero/             # NEW — captured screenshots for HeroSlideshow
│       ├── tracker.png
│       ├── application-modal.png
│       ├── profile.png
│       ├── filters.png
│       └── calendar.png
└── main.js                       # MODIFIED — mount Welcome / app shell / ConfigError
                                  #            by auth state + runtime handshake

# REMOVED from earlier plan revision:
#   src/pages/welcome/BrandBlock.js  (inlined into WelcomePage — 10-line component)
#   src/pages/welcome/CTAGroup.js    (inlined into WelcomePage — 30 lines)
#   src/pages/welcome/FloatingMeta.js (inlined into WelcomePage — 15 lines)
#   src/pages/welcome/HeroCard.js    (inlined into HeroSlideshow — 15 lines)
#   src/services/authApi.js          (no Express signup endpoint to wrap)

tests/
├── server/
│   ├── auth-middleware.test.js   # NEW — JWT verification
│   └── routes-protected.test.js  # NEW — 401 on protected routes without token
├── build/
│   └── vite-config.test.js       # NEW — build-time assertion plugin
├── components/
│   └── welcome.test.js           # NEW — login/signup form behavior, error states
├── data/
│   └── authStore.test.js         # NEW — subscribe/notify, restore on boot
└── services/
    ├── api.test.js               # NEW — Authorization header attach
    └── supabaseClient.test.js    # NEW — env stub presence/absence

# REMOVED from earlier plan revision:
#   tests/server/auth-signup.test.js  (no Express signup endpoint; signup
#                                      enforcement is the trigger in Supabase
#                                      and validated manually in Phase 11.6)

specs/018-auth-user-access/
├── spec.md                       # already written
├── plan.md                       # this file
├── data-model.md                 # NEW — allowed_emails table + trigger SQL + 019 handoff
├── contracts/
│   └── api.md                    # NEW — env, Authorization header, trigger, build-time check
├── research.md                   # NEW — decisions and rejected alternatives
├── quickstart.md                 # NEW — operator setup including trigger install + verify
└── checklists/
    └── plan-review.md            # NEW — review gate before /speckit.tasks
```

---

## Affected Areas

### Files/components likely to be **inspected** (read-only context)

- `server/config.js` — extend env var contract (017 set the pattern)
- `server/index.js` — see how routers are mounted; pattern from 017
- `server/routes/applications.js`, `server/routes/profile.js`,
  `server/routes/resume.js` — locate where to wire optional `requireAuth`
- `src/main.js` — see how pages are mounted; replicate the gating logic
- `src/services/api.js`, `src/services/resumeApi.js` — confirm fetch wrapper shape
  before injecting the `Authorization` header
- `src/components/Navbar.js` — confirm rendering surface for sign-in/out indicator
- `src/components/ResumeImport.js` — confirm where to hide the entry point
- `src/components/Modal.js` — confirm focus-trap pattern to copy into AuthOverlay
- `vite.config.js` — confirm plugin pattern before adding build-time assertion
- `specs/017-hosted-foundation/spec.md` — env contract baseline
- `package.json` — confirm where to add `@supabase/supabase-js` and `jsonwebtoken`

### Files/components likely to be **modified**

- `server/config.js` (add `SUPABASE_JWT_SECRET` only — `AUTH_EMAIL_REDIRECT_URL`
  moves to Vite-exposed)
- `server/index.js` (per-router `requireAuth` wiring; `/api/health` returns
  runtime mode)
- `server/routes/applications.js` (accept optional `requireAuth`)
- `server/routes/profile.js` (accept optional `requireAuth`)
- `server/routes/resume.js` (accept optional `requireAuth`)
- `vite.config.js` (build-time assertion plugin)
- `src/main.js` (welcome / app-shell / ConfigError boot gate; subscribe to
  `authStore`; runtime handshake)
- `src/services/api.js` (`Authorization` header from `authStore`)
- `src/services/resumeApi.js` (same `Authorization` header pattern)
- `src/components/Navbar.js` (signed-in identifier; sign-out control)
- `src/components/ResumeImport.js` (hidden when signed out)
- `package.json` (new deps: `@supabase/supabase-js`, `jsonwebtoken`)

### Files/components likely to be **created**

- `server/auth/middleware.js` (JWT verification only)
- `src/data/authStore.js`
- `src/pages/welcome/WelcomePage.js` (also inlines BrandBlock, CTAGroup,
  FloatingMeta per I4 middle ground)
- `src/pages/welcome/HeroSlideshow.js` (inlines HeroCard)
- `src/pages/welcome/AuthOverlay.js` (centered modal at every breakpoint)
- `src/pages/welcome/LoginForm.js`
- `src/pages/welcome/SignupForm.js`
- `src/pages/ConfigError.js`
- `src/services/supabaseClient.js`
- `src/services/healthApi.js`
- `src/assets/welcome-hero/*.png` — five captured screenshots for the hero
  slideshow
- Supabase artifacts (created via SQL editor, not in repo): `allowed_emails`
  table; `public.handle_new_user_email_allowlist()` trigger function; trigger
  on `auth.users`
- Test files listed in *Project Structure* above
- Supporting spec artifacts: `data-model.md`, `contracts/api.md`, `research.md`,
  `quickstart.md`, `checklists/plan-review.md`

### Tests likely to be **added or updated**

- **New**:
  - `tests/server/auth-middleware.test.js` — accepts valid HS256 JWT signed with
    test secret; rejects missing/malformed/expired/wrong-key; populates `req.user`
  - `tests/server/routes-protected.test.js` — each protected router returns 401
    for missing token and reaches the handler with a valid one; `/api/health`
    returns `runtime` field
  - `tests/build/vite-config.test.js` — production-build assertion throws on
    missing `VITE_SUPABASE_*` env vars
  - `tests/data/authStore.test.js` — subscribe/notify; restore from
    `supabase.auth.getSession()` mock; clears state on signOut
  - `tests/services/api.test.js` — Authorization header attach behavior
  - `tests/services/supabaseClient.test.js` — env-stub presence/absence paths
  - `tests/components/welcome.test.js` — welcome page mount, Try Demo disabled,
    CTA → overlay flow, form submission states, signup error neutrality,
    `?auth=callback` banner, focus restore
  - `tests/components/heroSlideshow.test.js` — reduced-motion, placeholder
    fallback, rotation progression
  - `tests/main.test.js` — ConfigError mounting when server reports hosted but
    client has no Supabase config
- **Updated**:
  - Existing `tests/server/*` route tests confirmed to use the no-`requireAuth`
    path (local mode); no behavioral changes needed beyond a factory-signature
    update
  - `tests/components/*` tests that mount the app shell may need to seed an
    authenticated `authStore` first
- **Manual (not unit-tested)**:
  - The Postgres trigger on `auth.users` lives inside Supabase and cannot be
    unit-tested from the application repo. Validated manually in Phase 11.6 via
    the bypass test (`supabase.auth.signUp` from dev tools with a
    non-allowlisted email; confirms no `auth.users` row is created).

### Explicitly **out of scope**

- `user_id` columns on `applications` or `profile` (deferred to 019)
- RLS policies on `applications` or `profile` (deferred to 019)
- SQLite schema changes
- OAuth/social providers
- Custom in-app password-reset UI
- Admin allowlist management UI
- Demo / public-explorer mode (020)
- Resume-import size/rate limits (021)
- "Try Demo" CTA behavior beyond rendering it disabled with a "coming soon"
  tooltip — actual demo session behavior belongs to feature 020

---

## Risks and Tradeoffs

### Risks

1. **Allowlist trigger lives outside the repo.**
   The single point of allowlist enforcement is a Postgres trigger function
   installed in Supabase via SQL editor. It is not version-controlled with the
   application code. If the trigger is **missing**, signups fail OPEN —
   Supabase has no other gate. *Mitigation:* the trigger SQL is the canonical
   source in `data-model.md §2-3` and `quickstart.md §3`; quickstart §10 is a
   P0 pre-deploy verification gate (operator runs a bypass test with a
   non-allowlisted email and confirms rejection); plan-review.md elevates
   trigger verification to a checklist gate.

2. **Hero slideshow needs real application screenshots.**
   The design explicitly forbids fabricated dashboard mockups. The five
   screenshots (Tracker, Application Modal, Profile, Filters, Calendar) must
   be captured from a real run of the app with believable seeded data.
   *Mitigation:* capture as a dedicated task during the polish phase; until
   then, ship a placeholder fallback (single neutral card with the brand
   wordmark) behind the same `HeroSlideshow` component so the welcome page
   remains buildable. Hold the polish task until the screenshots exist.

3. **`@supabase/supabase-js` adds a meaningful bundle cost.**
   The Supabase JS client is ~30–50 KB gzipped. Acceptable, but new for this
   project. *Mitigation:* import only the auth subset; lazy-load the client
   module if the bundle delta is unacceptable after measurement.

4. **`SUPABASE_JWT_SECRET` is a long-lived shared secret.**
   Local JWT verification needs the secret in the server env. Leak risk if env
   handling regresses. *Mitigation:* server-only env var (no `VITE_` prefix);
   verified by 017's existing client-bundle check; rotation procedure documented
   in `quickstart.md`.

5. **Token storage in `localStorage` is XSS-readable.**
   Supabase JS client default. Acceptable for the current threat model
   (small allowlist, no third-party scripts in the bundle), but documented.
   *Mitigation:* note in `research.md`; reassessing this becomes its own future
   feature if requirements change.

6. **Build-time Vite assertion can be circumvented by deploys that skip it.**
   The plugin only fires on `npm run build`. A deploy pipeline that uses
   `--mode development` or builds outside the project's npm scripts could bypass
   it. *Mitigation:* runtime handshake (FR-019, ConfigError page) catches the
   miss client-side; quickstart documents the required build invocation.

7. **Accepted limitation (spec): pre-019 hosted data is shared across users
   AND will be wiped by 019.** Plan does not attempt to mitigate either — both
   are intentional per the spec.

### Tradeoffs taken

- **Postgres allowlist trigger vs Express signup endpoint.** Chose trigger:
  closes the anon-key bypass and reuses Supabase's built-in verification
  email flow. Trade-off is signup logic living in Supabase rather than in our
  codebase; documentation + pre-deploy verification gate are the compensating
  controls.
- **Direct Supabase JS client for sign-up/in vs proxying through Express.**
  Chose direct: gets session refresh, persistence, sign-out, AND
  verification-email send for free. Trade-off is that the JWT lives in
  `localStorage` rather than an HTTP-only cookie.
- **Local JWT verification vs `supabase.auth.getUser()` per request.** Chose
  local: lower latency, no Supabase dependency on every API call. Trade-off is
  that revoked sessions remain accepted until they expire (Supabase default access
  token lifetime ≈ 1 hour). Acceptable given the allowlist controls who can ever
  sign in.
- **Per-router `requireAuth` vs global with public allowlist.** Chose per-router:
  explicit, matches the existing router-factory pattern, no hidden global rule.
  Trade-off is that new protected routers must remember to apply the middleware —
  mitigated by the checklist in `checklists/plan-review.md`.
- **Welcome page as a separate pre-app gate vs in-app router page.** Chose
  pre-app: clean login wall, no signed-out variant of the navbar to maintain,
  smaller blast radius if a Tracker/Profile bug renders before auth resolves.
- **Centered modal at every breakpoint vs bottom-sheet on mobile.** Chose
  centered modal everywhere: simpler implementation, single DOM/CSS path,
  adequate for two-field login/signup forms. Trade-off is slightly less-native
  mobile feel; acceptable for the form complexity at hand.
- **Standalone `AuthOverlay.js` vs extending `Modal.js`.** Chose standalone:
  avoids the risk of regressing existing modals when adding tab-strip and
  verification-sent semantics. Trade-off is small focus-trap-logic duplication
  (pull into `src/utils/focusTrap.js` if it grows).
- **Component split (middle ground, I4).** Inlined trivial components
  (BrandBlock, CTAGroup, FloatingMeta, HeroCard) into their parents to keep the
  file count aligned with the existing codebase pattern; kept complex ones
  (HeroSlideshow, AuthOverlay, LoginForm, SignupForm) as separate files.

---

## Validation Approach

### Automated (vitest, Supabase mocked at module boundary)
1. **JWT middleware**: accept valid HS256 token signed with `SUPABASE_JWT_SECRET`;
   reject missing/malformed/expired/wrong-key with 401; populate `req.user`.
2. **Protected routers**: each protected router returns 401 without a token and
   200 with a valid token (mock auth middleware passes through).
3. **Frontend auth store**: subscribes notified on sign-in / sign-out / session
   restore; cleared state on signOut.
4. **Welcome page**: error states render; verification-sent state renders; form
   resets cleanly between attempts; SignupForm maps Supabase rejection errors
   to the same neutral user-facing message regardless of underlying cause.
5. **Resume-import gating**: component absent from DOM when `authStore` is
   signed-out; present when signed-in.
6. **Config validation (server)**: hosted mode missing `SUPABASE_JWT_SECRET` →
   descriptive startup error; local mode unaffected.
7. **Vite build-time assertion**: a build with `NODE_ENV=production` and missing
   `VITE_SUPABASE_URL` (or `VITE_SUPABASE_ANON_KEY`) exits with a descriptive
   error before producing a bundle.
8. **Runtime handshake**: when `/api/health` reports `hosted` and the client
   has no Supabase config, `main.js` mounts `ConfigError.js`.
9. **Client bundle**: re-run 017's check confirming `SUPABASE_SERVICE_ROLE_KEY`
   and `SUPABASE_JWT_SECRET` do not appear in the Vite bundle.

### Manual (quickstart-driven, requires a real Supabase project)
1. Operator installs the `allowed_emails` table and the allowlist trigger;
   seeds the table with their email; signs up via welcome page; confirms email;
   signs in; reaches `/api/applications` (returns 200).
2. Operator submits signup with a non-allowlisted email; sees generic rejection.
3. **Bypass test**: from browser dev tools console, calls
   `await supabase.auth.signUp({ email: 'unallowed@x.com', password: 'longenough' })`
   directly; observes Supabase returns an error and no row appears in
   `auth.users`. *(Validates that the allowlist trigger is the enforcement point.)*
4. Operator signs out; observes welcome page reappear; observes
   `/api/applications` returns 401 in the network panel.
5. Operator refreshes mid-session; remains signed in.
6. **Expired-link test**: operator does not click the verification email; waits
   past the configured expiry (or shortens it temporarily); resubmits the
   signup form with the same email; receives a fresh verification email; no
   duplicate auth.users row is created.

### Browser smoke test (per constitution Amendment 1.1.0, one per user story)
1. **US1** — allowlisted signup → verify → sign in → protected route access.
2. **US2** — non-allowlisted rejection (via form AND via direct anon-key call).
3. **US3** — session persists across refresh + sign-out clears.
4. **US4** — login wall: protected routes 401 for unauthenticated client.
5. **US5** — tampered token rejected by middleware; response body opaque.

### Constitution / quality gates (`checklists/plan-review.md`)
Reviewed before generating `tasks.md` via `/speckit.tasks`.

---

## Open Items for Tasks Phase

- Decide the exact JWT verification library: `jsonwebtoken` vs `jose`. Default
  `jsonwebtoken` (smaller; familiar). Revisit if Supabase rotates to RS256 by
  default — at which point JWKS fetching is needed and `jose` is cleaner.
- Decide whether the welcome page is rendered into `#app` directly or into a
  sibling root. Default: sibling root removed on mount of the app shell, so the
  `#app` invariant from `main.js` stays clean.
- Confirm whether to extract a shared `src/utils/focusTrap.js` helper now or
  copy focus-trap logic into `AuthOverlay.js` and extract later if a third
  consumer appears.
