# Research: Hosted Authenticated User Access (018)

Decisions and rejected alternatives that informed the plan. Each entry: the
question, the option chosen, why, and what we rejected.

---

## R1 — Where does signup happen: client-side or server-side?

**Decision**: Server-side. Frontend calls `POST /api/auth/signup`; the server
checks the allowlist and then calls `supabase.auth.admin.createUser` with the
service role key.

**Why**: Allowlist enforcement is a server responsibility. If the client called
`supabase.auth.signUp` directly, the Supabase user would be created before any
allowlist check could run; rolling back via a webhook leaves a transient
unallowlisted account and complicates the user-facing error.

**Rejected**:
- *Client-side `supabase.auth.signUp` + post-create webhook to delete*: race
  conditions, transient account, harder error handling.
- *Custom database trigger that rejects inserts to `auth.users`*: requires
  modifying a Supabase-managed schema; brittle across Supabase upgrades.

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
Hosts both login and signup, and also handles Supabase's email-verification
callback (`?auth=callback`).

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

**Open visual question (deferred)**: layout, typography, brand treatment.
`design.md` will fill this in; the plan's structural decision is independent.

---

## R6 — Allowlist storage: Supabase table vs env var vs static file

**Decision**: Supabase `allowed_emails` table with RLS deny-all from the anon
role.

**Why**:
- Operator can add/remove entries from the Supabase dashboard without a redeploy.
- Anon key cannot enumerate the table.
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

**Decision**: One error code (`SIGNUP_NOT_PERMITTED`, 403) and one message for
all of:
- Email not in `allowed_emails`
- Email already exists in `auth.users`
- Supabase admin createUser rejection (any reason)

**Why**: Distinguishing these is an enumeration channel for allowlist
membership.

**Tradeoff**: User-facing message is less actionable ("Signup is not available
for this email"). Operator support is the escape hatch; this is acceptable
given the closed-allowlist model.

---

## R10 — Email verification: Supabase default vs custom

**Decision**: Use Supabase's default verification flow and default email
template. Server sets `email_confirm: false` on admin create; Supabase sends the
email.

**Why**: Zero implementation cost; matches "Password reset enhancements beyond
baseline support" being a non-goal per the brief.

**Revisit if**: Brand requirements demand a custom template (design.md or a
later feature).

---

## R11 — Bundle impact of `@supabase/supabase-js`

**Estimate**: ~30–50 KB gzipped for the auth subset. Acceptable for v1; project
has no strict bundle budget today. If measurement shows unacceptable delta, the
fallback is a lazy import inside the welcome page module so the auth client is
not in the initial chunk for already-signed-in users.
