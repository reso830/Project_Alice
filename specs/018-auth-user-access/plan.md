# Implementation Plan: Hosted Authenticated User Access (018)

**Branch**: `018-auth-user-access` | **Date**: 2026-05-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/018-auth-user-access/spec.md`
**Visual design**: [design/welcome_page.md](../../design/welcome_page.md) — diagonal
split layout, hero slideshow, three-CTA welcome page, modal/bottom-sheet auth forms.
All design tokens it references (`--indigo`, `--bg`, `--surface`, `--border`,
`--t1/t2/t3`, Sora, DM Mono) already exist in [src/styles/main.css:1-28](../../src/styles/main.css#L1-L28).

---

## Summary

Add hosted email/password authentication to Project Alice using Supabase Auth, gate
all protected hosted API routes behind a JWT-validating middleware, restrict signups
to an `allowed_emails` table managed in Supabase, and replace the unauthenticated
hosted shell with a welcome-page login wall. Local SQLite mode is untouched.

Concretely this introduces:
1. A welcome-page pre-app gate in the frontend, laid out per
   [design/welcome_page.md](../../design/welcome_page.md): diagonal split, brand
   block, headline + copy, three CTAs (Sign In / Create Account / **Try Demo —
   disabled with "coming soon" tooltip until feature 020 ships**), hero slideshow
   of real application screenshots, footer metadata.
2. A modal-on-desktop / bottom-sheet-on-mobile auth overlay that hosts the login
   and signup forms, mounted from the welcome page when the user clicks a CTA.
   The overlay reuses the existing `Modal.js` component pattern.
3. A handler in the welcome page for Supabase's email-verification callback
   (`?auth=callback` URL parameter).
4. A frontend `services/supabaseClient.js` module wrapping `@supabase/supabase-js`
   for sign-in/sign-up/sign-out and session restore.
5. A frontend `data/authStore.js` module owning session state and subscribers,
   analogous to the existing `data/store.js`.
6. An Express `server/auth/` directory: `middleware.js` (requireAuth), `supabase.js`
   (server-side Supabase admin client wrapper), and `routes.js` (signup endpoint
   that enforces the allowlist before calling Supabase Auth's admin create-user API).
7. Wiring `requireAuth` into each protected router (applications, profile, resume)
   per the agreed scoping decision.
8. A new Supabase table `allowed_emails` with deny-all RLS so the anon key cannot
   read it from the client.
9. Documentation of the per-user ownership model (`user_id` columns + RLS on
   applications/profile) without implementing it — 019 will apply it.

The feature does **not** introduce per-row user ownership for `applications` or
`profile`. The login wall is the security boundary in this feature; data
partitioning arrives in feature 019.

---

## Technical Context

**Language/Version**: Node.js ≥ 20.19.0, JavaScript (ESM)
**Primary Dependencies**: Express 4, Vite 8, Vitest 4, Zod 4. **New**:
`@supabase/supabase-js` (frontend + server). **New optional**: `jsonwebtoken` (server
JWT verification with `SUPABASE_JWT_SECRET`).
**Storage**: SQLite (local mode, unchanged); Supabase Auth (`auth.users` schema,
managed by Supabase); new Supabase `allowed_emails` table.
**Testing**: Vitest with Supabase fully mocked at the module boundary — no live
Supabase project required for CI. JWT verification tested with self-signed test
tokens.
**Target Platform**: Local Node.js (dev); Vercel serverless (hosted).
**Project Type**: Web application — Vite frontend + Express API (unchanged shape).
**Constraints**:
- Frontend talks to Supabase Auth directly via the JS client for sign-in/up/out
  and session restore; data flows still go through Express.
- Express verifies JWTs locally using `SUPABASE_JWT_SECRET` — no per-request
  Supabase round-trip.
- `SUPABASE_SERVICE_ROLE_KEY` must never appear in the Vite bundle (carried over
  from 017's contract; re-verified here).
- The `allowed_emails` table is read server-side only. The anon key must not be
  able to enumerate it.
**Scale/Scope**: Single hosted operator + a handful of allowlisted users (tens at
most). Performance is not a design concern at this scale.

---

## Architecture

```text
┌──────────────────────────── Browser ────────────────────────────┐
│                                                                  │
│  ┌────────────────────┐        ┌──────────────────────────────┐  │
│  │  Welcome page      │  auth  │  data/authStore.js           │  │
│  │  (login + signup   │◄──────►│  ─ session JWT               │  │
│  │   sections + email │        │  ─ user identity             │  │
│  │   verify callback) │        │  ─ subscribers               │  │
│  └────────────────────┘        └──────────┬───────────────────┘  │
│                                            │                     │
│  ┌────────────────────┐                    │                     │
│  │  App shell         │◄───────────────────┘ on signed-in        │
│  │  (Tracker/Profile  │                                          │
│  │   /Calendar)       │                                          │
│  └────────┬───────────┘                                          │
│           │                                                      │
│           ▼ services/api.js (attaches Authorization header)      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            │ /api/* with Authorization: Bearer <jwt>
            ▼
┌──────────────────────── Express API ────────────────────────────┐
│  /api/health                  (public)                           │
│  /api/auth/signup             (public; allowlist-checked)        │
│                                                                  │
│  /api/applications/*          ┐                                  │
│  /api/profile/*               │── requireAuth() middleware       │
│  /api/resume/*                ┘                                  │
│                                                                  │
│  requireAuth:  verify JWT (HS256, SUPABASE_JWT_SECRET)           │
│                attach req.user = { id, email }                   │
│                401 on missing/invalid/expired                    │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ├──► SQLite repositories (local mode) — unchanged
         │
         └──► Supabase admin client (hosted mode)
                ─ reads/writes auth.users (signup admin-create)
                ─ reads allowed_emails (service-role; RLS deny-all from client)

Direct browser ↔ Supabase Auth channel (no Express in middle):
   ─ password sign-in
   ─ password sign-up  (gated upstream by /api/auth/signup pre-check)
   ─ sign-out
   ─ session refresh
```

### Why the signup-pre-check + admin-create-user pattern

The frontend cannot be trusted to enforce the allowlist. Two options exist:
1. Frontend calls `/api/auth/signup` first → server checks allowlist → server uses
   service role to call Supabase's admin `createUser` → Supabase sends verification
   email → user signs in via the JS client after verifying. **(Chosen.)**
2. Frontend calls `supabase.auth.signUp()` directly → server runs an allowlist
   webhook that deletes the account if not allowlisted. **(Rejected:** a Supabase
   account exists briefly before deletion, and webhook race conditions complicate
   the user-facing error.)

Option 1 keeps allowlist enforcement strictly server-side with no transient
unallowlisted accounts.

---

## Data Flow

### Signup
1. User submits email + password on welcome page.
2. Frontend POSTs to `/api/auth/signup` with `{ email, password }`.
3. Server lowercases the email, looks it up in `allowed_emails` using the service
   role client. On miss → 403 with generic `SIGNUP_NOT_PERMITTED`.
4. On hit → server calls `supabase.auth.admin.createUser({ email, password,
   email_confirm: false })`. Supabase sends a verification email.
5. Server returns `{ status: "verification_sent" }`. Frontend shows a
   "check your email" state.
6. User clicks the verification link → lands on welcome-page `/?auth=callback`
   (via `AUTH_EMAIL_REDIRECT_URL`) → Supabase JS client picks up the hash params →
   account becomes verified → user is invited to sign in (or auto-redirected to
   sign-in tab).

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
- [x] Validation rules remain centralized; new auth validation (email format,
  password length) is added under `server/validation/auth.js` rather than scattered
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
| Server-side `/api/auth/signup` pre-check + admin createUser | Allowlist enforcement must happen before any Supabase user exists | Client-side `supabase.auth.signUp` + post-hoc webhook delete leaves transient unallowlisted accounts and complicates UX |
| Welcome-page pre-app gate | Hard login wall; protected app shell never renders for unauthenticated users | In-app `navigate('login')` requires rendering navbar around an unauthenticated user, weakening the wall metaphor |
| `data/authStore.js` separate from `data/store.js` | Session state has a different lifecycle and persistence model than application data | A combined store would couple Supabase auth subscriptions to application data flows |
| `jsonwebtoken` dependency | Local JWT verification avoids a Supabase round-trip per request | Calling `supabase.auth.getUser()` per request multiplies hosted latency by 1 RTT and creates a runtime Supabase dependency for every API call |

---

## Project Structure

```text
server/
├── auth/                         # NEW
│   ├── middleware.js             # requireAuth(req, res, next)
│   ├── supabase.js               # createSupabaseAdminClient(config) — service role
│   └── routes.js                 # createAuthRouter() — POST /api/auth/signup
├── config.js                     # MODIFIED — add SUPABASE_JWT_SECRET + AUTH_EMAIL_REDIRECT_URL
├── index.js                      # MODIFIED — mount /api/auth + per-router requireAuth wiring
├── routes/
│   ├── applications.js           # MODIFIED — createApplicationsRouter applies requireAuth
│   ├── profile.js                # MODIFIED — createProfileRouter applies requireAuth
│   └── resume.js                 # MODIFIED — createResumeRouter applies requireAuth
├── validation/
│   └── auth.js                   # NEW — email format, password min length, signup payload
├── repositories/
│   └── allowedEmails.js          # NEW — supabase service-role read; isAllowed(email)
└── db/                           # unchanged (SQLite)

src/
├── data/
│   ├── authStore.js              # NEW — session state, subscribers
│   └── store.js                  # unchanged
├── pages/
│   ├── welcome/                  # NEW — folder per design "Suggested Structure"
│   │   ├── WelcomePage.js        # diagonal-split layout, mounts subcomponents
│   │   ├── BrandBlock.js         # Alice icon + wordmark
│   │   ├── CTAGroup.js           # Sign In / Create Account / Try Demo (disabled)
│   │   ├── HeroSlideshow.js      # rotating real screenshots (Tracker, Modal, Profile, Filters, Calendar)
│   │   ├── HeroCard.js           # individual screenshot card with rotation/shadow
│   │   ├── FloatingMeta.js       # optional metadata pills
│   │   ├── AuthOverlay.js        # modal (desktop) / bottom sheet (mobile) shell
│   │   ├── LoginForm.js          # email + password form (inside overlay)
│   │   └── SignupForm.js         # email + password form (inside overlay)
│   ├── Tracker.js                # unchanged
│   ├── Profile.js                # unchanged
│   ├── ProfileEdit.js            # unchanged
│   └── Calendar.js               # unchanged
├── services/
│   ├── api.js                    # MODIFIED — attach Authorization header from authStore
│   ├── authApi.js                # NEW — POST /api/auth/signup wrapper
│   ├── resumeApi.js              # MODIFIED — same Authorization header pattern
│   └── supabaseClient.js         # NEW — wrap @supabase/supabase-js with hosted-only init
├── components/
│   ├── Modal.js                  # unchanged — reused by AuthOverlay on desktop
│   ├── Navbar.js                 # MODIFIED — signed-in identifier + sign-out control
│   └── ResumeImport.js           # MODIFIED — hide when signed out
├── assets/
│   ├── Alice_White.png           # already present — used in BrandBlock
│   └── welcome-hero/             # NEW — captured screenshots for HeroSlideshow
│       ├── tracker.png
│       ├── application-modal.png
│       ├── profile.png
│       ├── filters.png
│       └── calendar.png
└── main.js                       # MODIFIED — mount Welcome vs app shell by auth state

tests/
├── server/
│   ├── auth-middleware.test.js   # NEW — JWT verification
│   ├── auth-signup.test.js       # NEW — allowlist enforcement + admin createUser mock
│   └── routes-protected.test.js  # NEW — 401 on protected routes without token
├── components/
│   └── welcome.test.js           # NEW — login/signup form behavior, error states
└── data/
    └── authStore.test.js         # NEW — subscribe/notify, restore on boot

specs/018-auth-user-access/
├── spec.md                       # already written
├── plan.md                       # this file
├── data-model.md                 # NEW — allowed_emails table + 019-handoff schema
├── contracts/
│   └── api.md                    # NEW — /api/auth + Authorization header contract
├── research.md                   # NEW — decisions and rejected alternatives
├── quickstart.md                 # NEW — operator setup for hosted auth testing
└── checklists/
    └── plan-review.md            # NEW — review gate before /speckit.tasks
```

---

## Affected Areas

### Files/components likely to be **inspected** (read-only context)

- `server/config.js` — extend env var contract (017 set the pattern)
- `server/index.js` — see how routers are mounted; pattern from 017
- `server/routes/applications.js`, `server/routes/profile.js`,
  `server/routes/resume.js` — locate where to wire `requireAuth`
- `server/repositories/index.js` — confirm pattern for adding `allowedEmails.js`
- `src/main.js` — see how pages are mounted; replicate the gating logic
- `src/services/api.js`, `src/services/resumeApi.js` — confirm fetch wrapper shape
  before injecting the `Authorization` header
- `src/components/Navbar.js` — confirm rendering surface for sign-in/out indicator
- `src/components/ResumeImport.js` — confirm where to hide the entry point
- `specs/017-hosted-foundation/spec.md` — env contract baseline
- `package.json` — confirm where to add `@supabase/supabase-js` and `jsonwebtoken`

### Files/components likely to be **modified**

- `server/config.js` (add `SUPABASE_JWT_SECRET`, `AUTH_EMAIL_REDIRECT_URL`)
- `server/index.js` (mount `/api/auth`; pass repos+auth into protected routers)
- `server/routes/applications.js` (apply `requireAuth`)
- `server/routes/profile.js` (apply `requireAuth`)
- `server/routes/resume.js` (apply `requireAuth`)
- `src/main.js` (welcome-vs-app boot gate; subscribe to `authStore`)
- `src/services/api.js` (`Authorization` header from `authStore`)
- `src/services/resumeApi.js` (same `Authorization` header pattern)
- `src/components/Navbar.js` (signed-in identifier; sign-out control)
- `src/components/ResumeImport.js` (hidden when signed out)
- `package.json` (new deps)

### Files/components likely to be **created**

- `server/auth/middleware.js`
- `server/auth/supabase.js`
- `server/auth/routes.js`
- `server/repositories/allowedEmails.js`
- `server/validation/auth.js`
- `src/data/authStore.js`
- `src/pages/welcome/WelcomePage.js`
- `src/pages/welcome/BrandBlock.js`
- `src/pages/welcome/CTAGroup.js`
- `src/pages/welcome/HeroSlideshow.js`
- `src/pages/welcome/HeroCard.js`
- `src/pages/welcome/FloatingMeta.js`
- `src/pages/welcome/AuthOverlay.js`
- `src/pages/welcome/LoginForm.js`
- `src/pages/welcome/SignupForm.js`
- `src/services/supabaseClient.js`
- `src/services/authApi.js`
- `src/assets/welcome-hero/*.png` — five captured screenshots for the hero
  slideshow
- Test files listed in *Project Structure* above
- Supporting spec artifacts: `data-model.md`, `contracts/api.md`, `research.md`,
  `quickstart.md`, `checklists/plan-review.md`

### Tests likely to be **added or updated**

- **New**:
  - `tests/server/auth-middleware.test.js` — accepts valid HS256 JWT signed with
    test secret; rejects missing/malformed/expired/wrong-key; populates `req.user`
  - `tests/server/auth-signup.test.js` — allowlisted email reaches mocked admin
    createUser; non-allowlisted email returns 403 before any Supabase call; error
    response does not leak allowlist membership
  - `tests/server/routes-protected.test.js` — each protected router returns 401
    for missing token and reaches the handler with a valid one
  - `tests/data/authStore.test.js` — subscribe/notify; restore from
    `supabase.auth.getSession()` mock; clears state on signOut
  - `tests/components/welcome.test.js` — form submission states (idle, loading,
    error, verification-sent), error message neutrality for rejected signup
- **Updated**:
  - Existing `tests/server/*` route tests adjusted to either bypass `requireAuth`
    (via mock middleware in local mode) or to attach a stub token in setup
  - `tests/components/*` tests that mount the app shell may need to seed an
    authenticated `authStore` first

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

1. **Hero slideshow needs real application screenshots.**
   The design explicitly forbids fabricated dashboard mockups. The five
   screenshots (Tracker, Application Modal, Profile, Filters, Calendar) must
   be captured from a real run of the app with believable seeded data.
   *Mitigation:* capture as a dedicated task during the polish phase; until
   then, ship a placeholder fallback (single neutral card with the brand
   wordmark) behind the same `HeroSlideshow` component so the welcome page
   remains buildable. Hold the polish task until the screenshots exist.

2. **`@supabase/supabase-js` adds a meaningful bundle cost.**
   The Supabase JS client is ~30–50 KB gzipped. Acceptable, but new for this
   project. *Mitigation:* import only the auth subset; lazy-load the client
   module if the bundle delta is unacceptable after measurement.

3. **`SUPABASE_JWT_SECRET` is a long-lived shared secret.**
   Local JWT verification needs the secret in the server env. Leak risk if env
   handling regresses. *Mitigation:* server-only env var (no `VITE_` prefix);
   verified by 017's existing client-bundle check; rotation procedure documented
   in `quickstart.md`.

4. **`allowed_emails` enumeration via subtle error differences.**
   FR-006 requires neutral rejection messages. If the implementation returns
   different shapes for "not allowlisted" vs "Supabase rejected the email," that
   becomes a side channel. *Mitigation:* single rejection code
   `SIGNUP_NOT_PERMITTED` with one message; test covers this directly.

5. **Token storage in `localStorage` is XSS-readable.**
   Supabase JS client default. Acceptable for the current threat model
   (small allowlist, no third-party scripts in the bundle), but documented.
   *Mitigation:* note in `research.md`; reassessing this becomes its own future
   feature if requirements change.

6. **Accepted limitation (spec): pre-019 hosted data is shared across users.**
   Plan does not attempt to mitigate this — it is intentional per the spec.

### Tradeoffs taken

- **Direct Supabase JS client for sign-in vs proxying through Express.** Chose
  direct: it gets session refresh, persistence, and sign-out for free. Trade-off
  is that the JWT lives in `localStorage` rather than an HTTP-only cookie.
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

---

## Validation Approach

### Automated (vitest, Supabase mocked at module boundary)
1. **JWT middleware**: accept valid HS256 token signed with `SUPABASE_JWT_SECRET`;
   reject missing/malformed/expired/wrong-key with 401; populate `req.user`.
2. **Signup endpoint**: allowlisted email → mock admin client called once with
   that email; non-allowlisted email → 403 before any mock admin call; rejection
   error shape is identical to "user already exists" rejection (neutral channel).
3. **Protected routers**: each protected router returns 401 without a token and
   200 with a valid token (mock auth middleware passes through).
4. **Frontend auth store**: subscribes notified on sign-in / sign-out / session
   restore; cleared state on signOut.
5. **Welcome page**: error states render; verification-sent state renders; form
   resets cleanly between attempts.
6. **Resume-import gating**: component absent from DOM when `authStore` is
   signed-out; present when signed-in.
7. **Config validation (server)**: hosted mode missing `SUPABASE_JWT_SECRET` or
   `AUTH_EMAIL_REDIRECT_URL` → descriptive startup error; local mode unaffected.
8. **Client bundle**: re-run 017's check confirming `SUPABASE_SERVICE_ROLE_KEY`
   and `SUPABASE_JWT_SECRET` do not appear in the Vite bundle.

### Manual (quickstart-driven, requires a real Supabase project)
1. Operator seeds `allowed_emails` with their email; signs up via welcome page;
   confirms email; signs in; reaches `/api/applications` (returns 200).
2. Operator submits signup with a non-allowlisted email; sees generic rejection.
3. Operator signs out; observes welcome page reappear; observes `/api/applications`
   returns 401 in the network panel.
4. Operator refreshes mid-session; remains signed in.

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
- Confirm error-code naming convention for new auth errors so they line up with
  the existing `code/message/fields` shape from `services/api.js`.
