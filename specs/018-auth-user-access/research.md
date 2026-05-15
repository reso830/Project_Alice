# Research: Hosted Authenticated User Access (018)

Decisions and rejected alternatives that informed the plan. Each entry: the
question, the option chosen, why, and what we rejected.

---

## R1 — Where does signup happen, and how is the allowlist enforced?

**Decision (revised)**: Postgres allowlist trigger — a `BEFORE INSERT`
trigger on `auth.users` whose function consults `allowed_emails` and raises
on miss. Frontend calls `supabase.auth.signUp` directly with the anon key;
the trigger gates user creation at the database layer.

> **Not** a Supabase "Auth Hook" — that's a distinct JSONB-based mechanism
> with dashboard configuration and `supabase_auth_admin` grants. A plain
> trigger is simpler and fires regardless of any Auth-Hooks dashboard setting.

**Why**:
- Anon-key bypass is impossible: the trigger fires inside Supabase regardless
  of which caller initiated the insert.
- Supabase's built-in verification email is sent automatically by `signUp` —
  no separate email-delivery wiring needed.
- Removes the entire Express signup surface from the codebase (`/api/auth/signup`,
  admin client, signup validation, allowlist repo all unneeded).
- The trigger function is small (~10 lines of PL/pgSQL) and lives in `data-model.md`
  + `quickstart.md`; operators install it once.

**Originally proposed and rejected**:
- *Express `/api/auth/signup` endpoint that pre-checks the allowlist then
  calls `supabase.auth.admin.createUser`*: two flaws — (a) anon-key direct
  `supabase.auth.signUp` from the browser bypasses the Express check, and
  (b) `admin.createUser` does not send the verification email, leaving
  allowlisted signups in an unverifiable state.
- *Express endpoint + `admin.createUser` + `admin.generateLink('signup')` +
  custom email-send pipeline*: closes the verification gap from option above
  but still has the anon-key bypass; also adds an email-delivery dependency.
- *`admin.inviteUserByEmail` as the signup primitive*: magic-link invite UX,
  not email+password; changes the signup ergonomics. Considered if the team
  wants invite-flow UX later — not chosen here.
- *Custom client-side `supabase.auth.signUp` + post-create webhook that
  deletes non-allowlisted users*: race conditions, transient account exists
  briefly, complicates user-facing error.

**Tradeoff taken**: signup logic now lives in Supabase (the trigger
function), not in our repo. Compensating control: the trigger SQL is the
canonical source in `data-model.md` and `quickstart.md §3`; manual validation
in Phase 11 explicitly tests the bypass path.

---

## R2 — JWT verification: local secret vs Supabase round-trip per request

**Decision**: Verify JWTs locally on the Express server using
`SUPABASE_JWT_SECRET` and the `jsonwebtoken` library (HS256).

**Why**:
- No per-request latency penalty.
- No new runtime dependency on Supabase Auth's availability for every API call.
- Supabase issues HS256 access tokens by default; the secret is available.

**Tradeoff**: Revoked sessions remain accepted until the access token expires
(default ≈ 1 hour). Acceptable because the allowlist controls who can ever sign
in, and any compromised session is bounded by the access-token lifetime.

**Rejected**:
- *`supabase.auth.getUser(token)` per request*: doubles request latency and
  creates a hard dependency on Supabase Auth uptime for every protected call.

---

## R3 — JWT library: `jsonwebtoken` vs `jose`

**Decision**: `jsonwebtoken` for v1.

**Why**: Smaller surface area, mature, simpler API for HS256. The project does
not need JWKS fetching, asymmetric keys, or DID-style use cases.

**Revisit if**: Supabase rotates to RS256 by default, at which point JWKS
fetching becomes needed and `jose` is the cleaner library. This is plan-level
flexibility; the middleware contract does not change.

---

## R4 — Session storage on the client

**Decision**: Use the Supabase JS client's default session storage
(`localStorage`).

**Why**:
- Built-in session restore on page load.
- Automatic token refresh.
- Removes any need for custom storage code.

**Tradeoff**: `localStorage` is readable by XSS. The project does not load
third-party scripts and the bundle is owned end-to-end; this is acceptable for
the current threat model.

**Rejected**:
- *HTTP-only secure cookie set by Express*: requires Express to mediate every
  Supabase auth call (sign-in, sign-up, refresh, sign-out), giving up the JS
  client's built-in session management. Higher implementation cost; not enough
  threat-model benefit at this scale.

---

## R5 — Login/signup UI shape

**Decision**: Single welcome page hosted as a **pre-app gate** outside the
existing in-app router. Renders only when unauthenticated in hosted mode.
Hosts an `AuthOverlay` modal launched by the CTAs (Sign In / Create Account).
The welcome page itself handles Supabase's email-verification callback
(`?auth=callback`).

**Why**:
- The spec defines a hard login wall in hosted mode; mounting the existing
  navbar around an unauthenticated user weakens that boundary.
- Existing pages (Tracker, Profile, Calendar, ProfileEdit) are mounted into
  `#app` by `main.js`; cleanest to gate that mount on auth state.
- Reduces signed-out-variant complexity in existing components (only Navbar +
  ResumeImport change).

**Rejected**:
- *In-app `navigate('login')` page*: forces a signed-out navbar variant.
- *Modal overlay on the existing app*: conflicts with the 401 login-wall posture.

**Companion decision (R5b)**: AuthOverlay uses a **centered modal at every
breakpoint** (desktop, tablet, mobile). A separate bottom-sheet variant was
considered for mobile but rejected to keep the implementation single-path
for a two-field form. Sizing scales with breakpoint per `design/welcome_page.md §11b`.

---

## R6 — Allowlist storage: Supabase table vs env var vs static file

**Decision**: Supabase `allowed_emails` table with RLS deny-all from any
client role; read only by the allowlist trigger function via `SECURITY DEFINER`.

**Why**:
- Operator can add/remove entries from the Supabase dashboard without a redeploy.
- Anon key cannot enumerate the table.
- The trigger reads via `SECURITY DEFINER`, so neither the anon key nor the
  service role key needs `select` on the table from application code.
- Fits the existing Supabase footprint added by 017.

**Rejected**:
- *Comma-separated env var*: requires redeploy per entry; environment-management
  drift across environments.
- *Static file in repo*: requires deploy and is PR-visible (privacy: shows who
  is allowlisted in repo history).

---

## R7 — Test strategy

**Decision**: Pure unit tests with Supabase mocked at the module boundary. JWT
verification tested with self-signed HS256 tokens using a fixed test secret.

**Why**:
- No live Supabase needed in CI.
- Deterministic and fast.
- Matches the existing vitest pattern.

**Rejected**:
- *Hybrid mock-HTTP + real JWT*: more realistic but adds `msw` or `fetch-mock`
  for marginal benefit. Can be added later if signal is missing.
- *Live Supabase test project*: highest fidelity but adds infrastructure,
  secrets, and CI complexity not currently in the repo.

---

## R8 — Middleware scoping: per-router vs global with allowlist

**Decision**: Per-router. Each protected router applies `requireAuth` at its top.

**Why**:
- Explicit; matches the existing router-factory pattern.
- Public routes (`/api/health`, `/api/auth/signup`) need no special-case logic.

**Tradeoff**: New protected routers must remember to apply the middleware.
Mitigated by the plan-review checklist.

**Rejected**:
- *Global with public-route allowlist*: safer-by-default but adds a hidden
  global rule; the project's existing router-factory pattern is the more
  legible choice at this scale.

---

## R9 — Signup neutrality (FR-006)

**Decision (revised)**: SignupForm maps **every** error from
`supabase.auth.signUp` to a single neutral user-facing message
("This email cannot sign up right now."). This applies to:
- Email not in `allowed_emails` (trigger raises)
- Email already exists in `auth.users`
- Supabase rate limit
- Network error
- Any other client-side rejection

**Why**: Distinguishing these is an enumeration channel for allowlist
membership. Since there is no longer an Express signup endpoint to
standardize the error shape, the neutrality must live in the SignupForm's
error-mapping logic.

**Tradeoff**: User-facing message is less actionable. Operator support is the
escape hatch; this is acceptable given the closed-allowlist model.

---

## R10 — Email verification: Supabase default vs custom

**Decision (revised)**: Use Supabase's default verification flow and default
email template. Frontend calls `supabase.auth.signUp({ email, password,
options: { emailRedirectTo } })`; Supabase sends the verification email
automatically.

**Why**: Zero implementation cost; matches "Password reset enhancements
beyond baseline support" being a non-goal per the brief. Resolves an earlier
plan-revision concern that `admin.createUser` does not auto-send the
verification email — we no longer use `admin.createUser`.

**Revisit if**: Brand requirements demand a custom template, or the link
expiry semantics need to change.

---

## R11 — Bundle impact of `@supabase/supabase-js`

**Estimate**: ~30–50 KB gzipped for the auth subset. Acceptable for v1; project
has no strict bundle budget today. If measurement shows unacceptable delta, the
fallback is a lazy import inside the welcome page module so the auth client is
not in the initial chunk for already-signed-in users.

---

## R12 — Build-time vs runtime detection of missing Vite Supabase env vars

**Decision**: Both. Build-time Vite plugin is the primary defense; runtime
`/api/health` handshake + ConfigError page is the secondary defense.

**Why build-time**: failing the deploy with a descriptive error is strictly
better than shipping a silently-degraded frontend that confuses users. The
plugin is ~15 lines in `vite.config.js` and only fires on
`mode === 'production'`, so local dev without these vars (legitimate local
mode) continues to work.

**Why also runtime**: not every deploy path runs `npm run build` through this
project's vite config. A deploy that uses a custom build invocation or
bypasses the plugin (Vercel's `--prebuilt`, a hand-rolled CI step, etc.) would
miss the assertion. The runtime handshake catches the mismatch on the next
page load and shows a clear configuration-error page instead of a broken app.

**Rejected**:
- *Runtime check only*: ships broken bundles; shifts failure to end users.
- *Build-time check only*: assumes every deploy path runs the plugin.

---

## R13 — 019 backfill: wipe vs assign vs manual

**Decision**: Wipe `applications` and `profile` before adding `user_id` in
019.

**Why**: 018-only hosted data has no `user_id` attribution and the spec's
Accepted Limitations section already declares it non-multi-user-safe.
Wiping is lossless because the data was never trustworthy.

**Rejected**:
- *Assign all rows to the first allowlisted user*: implies ownership that
  wasn't true. Could surprise operators.
- *Manual SQL-script backfill per row*: painful for the common case
  (test/dev hosted environments). Reserved for operators with irreplaceable
  production data, who would perform the backfill out-of-band before 019
  deploys and then remove the wipe statements from 019's migration.
