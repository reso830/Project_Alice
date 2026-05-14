# Tasks: Hosted Authenticated User Access (018)

**Spec**: `specs/018-auth-user-access/spec.md`
**Plan**: `specs/018-auth-user-access/plan.md`
**Design**: `design/welcome_page.md`
**Branch**: `018-auth-user-access`

---

## Phase Map

| Phase | Theme | Blocks |
|---|---|---|
| 01 | Foundation: deps + config | All other phases |
| 02 | Supabase server wiring | 03, 04 |
| 03 | Auth middleware + signup endpoint | 04 |
| 04 | Wire protected routers + server entry | 05+ runtime, but FE work can begin in parallel |
| 05 | Frontend auth core (client + store) | 06, 07 |
| 06 | Welcome page structure (no styling) | 07, 09 |
| 07 | Auth overlay + forms | 09 |
| 08 | Navbar + resume-import gating | 11 |
| 09 | Welcome page styling per design | 11 |
| 10 | Hero screenshot capture (polish; can ship later) | — |
| 11 | Verification & checklist walk | — |

Phases 01 → 04 are backend. Phases 05 → 09 are frontend and can begin once
Phase 03 is merged (the signup contract is then stable). Phase 10 is optional
polish.

---

## Phase 01 — Foundation

### [ ] Task 01.1 — Add `@supabase/supabase-js` and `jsonwebtoken` to dependencies

**Target file**: `package.json`

**What to do**:
Add to `dependencies`:
- `@supabase/supabase-js` (latest 2.x)
- `jsonwebtoken` (latest 9.x)

Run `npm install` after editing. Commit both `package.json` and
`package-lock.json`.

**Expected behavior**:
- `import { createClient } from '@supabase/supabase-js'` resolves in both
  server and client modules.
- `import jwt from 'jsonwebtoken'` resolves in server modules.

**Constraints**:
- Add to `dependencies`, not `devDependencies` — both packages run in
  production.
- Pin only major versions (use `^`); do not pin patch.

**Validation**:
- `npm install` exits 0.
- `npm run test:run` still passes with zero new failures.
- `npm run build` still completes without unresolved-import errors.

**Out of scope**:
- Wiring the packages into application code (handled in 02.x and 05.x).

---

### [ ] Task 01.2 — Extend `server/config.js` with `SUPABASE_JWT_SECRET` and `AUTH_EMAIL_REDIRECT_URL`

**Target file**: `server/config.js`

**What to do**:
- Add `SUPABASE_JWT_SECRET` and `AUTH_EMAIL_REDIRECT_URL` to the
  `HOSTED_REQUIRED` list (or equivalent validation block).
- Add the resolved values to the frozen `config.supabase` object as
  `jwtSecret` and to `config.auth` as `emailRedirectUrl`.

```js
return Object.freeze({
  runtime,
  isHosted: runtime === 'hosted',
  port: Number(process.env.PORT) || 3001,
  supabase: runtime === 'hosted'
    ? {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        jwtSecret: process.env.SUPABASE_JWT_SECRET,
      }
    : null,
  auth: runtime === 'hosted'
    ? { emailRedirectUrl: process.env.AUTH_EMAIL_REDIRECT_URL }
    : null,
});
```

**Expected behavior**:
- `APP_RUNTIME=hosted` without `SUPABASE_JWT_SECRET` → throws
  `Missing required environment variable for hosted mode: SUPABASE_JWT_SECRET`
- `APP_RUNTIME=hosted` without `AUTH_EMAIL_REDIRECT_URL` → throws
  `Missing required environment variable for hosted mode: AUTH_EMAIL_REDIRECT_URL`
- `APP_RUNTIME=local` → `config.supabase` is `null`, `config.auth` is `null`,
  no new env vars required.

**Constraints**:
- `SUPABASE_JWT_SECRET` must never appear under a `VITE_` prefix anywhere.
- Returned object must remain frozen.

**Validation**:
- Extend `tests/server/config.test.js` with two new cases:
  - hosted mode missing `SUPABASE_JWT_SECRET` throws naming that variable
  - hosted mode missing `AUTH_EMAIL_REDIRECT_URL` throws naming that variable
- `npm run test:run -- tests/server/config.test.js` passes.

**Out of scope**:
- Loading or using the secret (handled in 03.2).

---

## Phase 02 — Supabase Server Wiring

### [ ] Task 02.1 — Author the `allowed_emails` SQL and document it in quickstart

**Target file**: `specs/018-auth-user-access/quickstart.md` (already exists)

**What to do**:
Confirm the SQL block in `quickstart.md` matches `data-model.md`. No code
change. If the project later adds a `db/migrations/` directory the SQL should
be moved there; until then `quickstart.md` is the operator-facing source of
truth.

**Expected behavior**:
- Operator can run the SQL in Supabase SQL Editor and produce a table that
  matches `data-model.md` exactly: `email PRIMARY KEY`, `added_at`, `added_by`,
  RLS enabled with no anon policies.

**Constraints**:
- No migration tooling is introduced in this feature (per spec assumption).

**Validation**:
- Manual: operator runs the SQL once during quickstart; confirms the table
  appears in Supabase and the anon key returns 0 rows for
  `select * from allowed_emails`.

**Out of scope**:
- Automated migrations (deferred to a later infra feature).

---

### [ ] Task 02.2 — Create `server/auth/supabase.js` (admin client factory)

**Target file**: `server/auth/supabase.js` (new)

**What to do**:
```js
import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient(config) {
  if (!config.isHosted) {
    return null;
  }
  return createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
```

**Expected behavior**:
- Returns a Supabase client configured with the service-role key.
- Returns `null` in local mode (callers must check).

**Constraints**:
- This client uses the service-role key — must never be exposed to anything
  that reaches the frontend.
- `persistSession: false` and `autoRefreshToken: false` (server-side).

**Validation**:
- `tests/server/auth-supabase.test.js`:
  - `createSupabaseAdminClient({ isHosted: false })` returns `null`
  - `createSupabaseAdminClient({ isHosted: true, supabase: { url: 'https://x.supabase.co', serviceRoleKey: 'svc' } })` returns a non-null object exposing `.auth.admin` and `.from`

**Out of scope**:
- Using the client (consumed in 02.3 and 03.3).

---

### [ ] Task 02.3 — Create `server/repositories/allowedEmails.js`

**Target file**: `server/repositories/allowedEmails.js` (new)

**What to do**:
```js
export function createAllowedEmailsRepository(supabaseAdminClient) {
  return {
    async isAllowed(email) {
      const normalized = email.trim().toLowerCase();
      const { data, error } = await supabaseAdminClient
        .from('allowed_emails')
        .select('email')
        .eq('email', normalized)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },
  };
}
```

**Expected behavior**:
- Lowercases and trims input before lookup.
- Returns `true` on hit, `false` on miss.
- Throws on Supabase error (propagated to the route handler → 500).

**Constraints**:
- Uses `maybeSingle()` (not `single()`) so a miss is not a Postgres error.
- No write methods are exposed.

**Validation**:
- `tests/server/repositories/allowedEmails.test.js`:
  - Mock supabase client returns `{ data: { email: 'a@b.c' }, error: null }`
    → `isAllowed('A@B.C')` resolves `true` (case folded)
  - Mock returns `{ data: null, error: null }` → resolves `false`
  - Mock returns `{ data: null, error: { message: 'down' } }` → rejects

**Out of scope**:
- Mutations (allowlist managed in the Supabase dashboard).

---

### [ ] Task 02.4 — Wire `allowedEmails` into `server/repositories/index.js`

**Target file**: `server/repositories/index.js`

**What to do**:
- Import `createSupabaseAdminClient` from `server/auth/supabase.js`.
- In hosted mode, instantiate the admin client and the
  `allowedEmails` repository; expose it as `repositories.allowedEmails`.
- In local mode, leave `repositories.allowedEmails` undefined (or set to a
  guard that throws "not available in local mode" — pick whichever matches
  the existing pattern for hosted-only repos established in 017).

**Expected behavior**:
- `await createRepositories(config)` in local mode returns the same
  applications + profile repos as before, with no allowedEmails entry.
- In hosted mode the returned object also has `repositories.allowedEmails`
  with an `isAllowed(email)` method.

**Constraints**:
- Do not import `@supabase/supabase-js` at the top level if that breaks
  local-mode cold start (017 had a similar cold-start bug — see commit
  52a0847). Lazy-load if needed.

**Validation**:
- Existing tests pass unchanged.
- New `tests/server/repositories/index.test.js` case (extend if file exists):
  - `createRepositories({ isHosted: false })` does not throw and has no
    `allowedEmails` key.
  - `createRepositories({ isHosted: true, supabase: {…} })` exposes
    `repositories.allowedEmails.isAllowed`.

**Out of scope**:
- Switching the applications/profile repos to Supabase (that is 019's job).

---

## Phase 03 — Auth Middleware + Signup Endpoint

### [ ] Task 03.1 — Create `server/validation/auth.js`

**Target file**: `server/validation/auth.js` (new)

**What to do**:
Define a Zod schema (project already uses Zod 4) for the signup payload:

```js
import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
```

Export a `parseSignup(input)` helper that returns
`{ ok: true, data }` or `{ ok: false, fields }` mirroring the shape used by
the existing validation modules in `server/validation/`.

**Expected behavior**:
- `parseSignup({ email: 'a@b.c', password: 'longenough' })` → `{ ok: true, data: { email: 'a@b.c', password: 'longenough' } }`
- `parseSignup({ email: 'nope', password: 'x' })` → `{ ok: false, fields: { email: '...', password: '...' } }`
- Email is lowercased + trimmed in the resolved data.

**Constraints**:
- Match the existing `server/validation/` return-shape conventions (read one
  existing file to confirm before writing).

**Validation**:
- `tests/server/validation.test.js` (extend existing file with a new
  describe block) covers valid input, both fields missing, invalid email,
  short password.

**Out of scope**:
- Email-verification semantics (Supabase handles them).

---

### [ ] Task 03.2 — Create `server/auth/middleware.js` (`requireAuth`)

**Target file**: `server/auth/middleware.js` (new)

**What to do**:
```js
import jwt from 'jsonwebtoken';

const UNAUTHORIZED_BODY = {
  error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
};

export function createRequireAuth({ jwtSecret }) {
  return function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json(UNAUTHORIZED_BODY);
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      req.user = { id: payload.sub, email: payload.email };
      return next();
    } catch {
      return res.status(401).json(UNAUTHORIZED_BODY);
    }
  };
}
```

**Expected behavior**:
- No `Authorization` header → 401, route handler not invoked
- Header not in `Bearer …` shape → 401
- Token signature invalid / malformed / expired / wrong key → 401
- Valid token → `req.user = { id, email }`, `next()` invoked
- All failure response bodies are byte-identical (no leaking which step failed)

**Constraints**:
- Algorithm allowlist: `HS256` only. Do not accept `none` or `RS*` (Supabase
  default is HS256; this prevents algorithm-confusion attacks).
- Log auth failures at debug-level only; never log token contents.
- Do not look up the user in Supabase — verification is local.

**Validation**:
- `tests/server/auth-middleware.test.js`:
  - Missing header → 401, body matches `UNAUTHORIZED_BODY`, handler not run
  - Malformed header → 401
  - Wrong-key signature → 401
  - Expired token → 401
  - Valid HS256 token signed with the test secret → 200, `req.user.id` set
    to the `sub` claim
  - Mounted on an Express stub via `supertest` (already used in
    `tests/server/applications.test.js`)

**Out of scope**:
- Applying the middleware to real routers (handled in Phase 04).

---

### [ ] Task 03.3 — Create `server/auth/routes.js` (POST `/api/auth/signup`)

**Target file**: `server/auth/routes.js` (new)

**What to do**:
```js
import { Router } from 'express';
import { parseSignup } from '../validation/auth.js';

const NEUTRAL_REJECT = {
  error: { code: 'SIGNUP_NOT_PERMITTED', message: 'Signup is not available for this email.' },
};

export function createAuthRouter({ repositories, supabaseAdmin, config }) {
  const router = Router();
  router.post('/signup', async (req, res, next) => {
    const parsed = parseSignup(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields: parsed.fields },
      });
    }
    try {
      const allowed = await repositories.allowedEmails.isAllowed(parsed.data.email);
      if (!allowed) return res.status(403).json(NEUTRAL_REJECT);
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: false,
      });
      if (error) return res.status(403).json(NEUTRAL_REJECT);
      return res.status(200).json({
        data: { status: 'verification_sent', email: parsed.data.email },
      });
    } catch (err) {
      return next(err);
    }
  });
  return router;
}
```

**Expected behavior**:
- Validation failure → 400 with field-level diagnostics
- Allowlist miss → 403 `SIGNUP_NOT_PERMITTED`, **`createUser` never called**
- Allowlist hit + Supabase rejection → 403 `SIGNUP_NOT_PERMITTED` (same shape)
- Allowlist hit + Supabase success → 200 `verification_sent`
- Supabase unreachable / repo throws → propagates to the global error handler
  (500 `INTERNAL_ERROR` per 017's handler in `server/index.js`)

**Constraints**:
- Allowlist-miss and Supabase-rejection responses must be byte-identical.
- The handler must not log the password.
- `email_confirm: false` so Supabase sends the verification email.

**Validation**:
- `tests/server/auth-signup.test.js`:
  - Validation error case (missing email)
  - Allowlist-miss case: `repositories.allowedEmails.isAllowed` returns
    `false` → 403, `supabaseAdmin.auth.admin.createUser` is not called
  - Allowlist-hit + `createUser` returns `{ error: { message: 'already' } }`
    → 403 with identical body to the miss case
  - Happy path → 200 with `verification_sent`
  - Use mock objects for `repositories.allowedEmails` and `supabaseAdmin`

**Out of scope**:
- Login (frontend talks to Supabase directly).
- Verification callback (handled on the frontend in 06.x).

---

## Phase 04 — Wire Protected Routers + Server Entry

### [ ] Task 04.1 — Update protected router factories to accept an optional `requireAuth` middleware

**Target files**:
- `server/routes/applications.js`
- `server/routes/profile.js`
- `server/routes/resume.js`

**What to do**:
Change each `createXRouter({ repo })` to
`createXRouter({ repo, requireAuth })`. If `requireAuth` is provided, mount it
at the top of the router (`router.use(requireAuth)`); if absent, skip it.

**Expected behavior**:
- Existing local-mode tests pass with no changes (they don't pass
  `requireAuth`, so behavior is unchanged).
- A hosted-mode test that passes a stub `requireAuth` sees the middleware run
  before each route.

**Constraints**:
- No business-logic changes inside the route handlers in this task — only the
  factory signature and middleware wiring.

**Validation**:
- Existing `tests/server/applications.test.js`, `profile.test.js`,
  `resume.test.js` pass unmodified.
- New assertion in each: when called with a `requireAuth` stub that calls
  `res.status(401).end()`, every request returns 401 and `repo.getAll` is
  never invoked.

**Out of scope**:
- Reading `req.user` inside handlers (that work belongs to 019).

---

### [ ] Task 04.2 — Update `server/index.js` to mount `/api/auth` and conditionally pass `requireAuth`

**Target file**: `server/index.js`

**What to do**:
- Import `createRequireAuth` from `server/auth/middleware.js`,
  `createSupabaseAdminClient` from `server/auth/supabase.js`, and
  `createAuthRouter` from `server/auth/routes.js`.
- In `createApp`, if `config.isHosted`:
  - Instantiate `supabaseAdmin = createSupabaseAdminClient(config)`.
  - Instantiate `requireAuth = createRequireAuth({ jwtSecret: config.supabase.jwtSecret })`.
  - Mount `app.use('/api/auth', createAuthRouter({ repositories, supabaseAdmin, config }))` **before** the protected routers.
- Pass `requireAuth` to each protected router factory only in hosted mode.
- Local mode: routers continue to be instantiated without `requireAuth` —
  identical to today.

**Expected behavior**:
- Local mode: `/api/health`, `/api/applications`, `/api/profile`,
  `/api/resume` all behave exactly as before. `/api/auth/signup` is **not
  mounted** in local mode (404).
- Hosted mode: `/api/health` is public; `/api/auth/signup` is public;
  `/api/applications`, `/api/profile`, `/api/resume` return 401 without a
  valid Bearer token.

**Constraints**:
- Mount order: `/api/health` → `/api/auth` → protected routers → error
  handler.
- Do not put `requireAuth` on `/api/health` or `/api/auth/*`.

**Validation**:
- New `tests/server/routes-protected.test.js`:
  - Build a hosted-mode app via `createApp({ config: hostedConfig, repositories, requireAuth: stubPass })`
    pattern; confirm 200 with valid stub.
  - Build a hosted-mode app with `requireAuth: stubReject` and confirm 401
    for each of `/api/applications`, `/api/profile`, `/api/resume`.
  - Confirm `/api/health` and `/api/auth/signup` remain 200/400 respectively
    (i.e. middleware is not applied to them).

**Out of scope**:
- Calling the real Supabase admin client in tests (always mocked).

---

### [ ] Task 04.3 — Update existing route tests to accommodate the new factory signature

**Target files**:
- `tests/server/applications.test.js`
- `tests/server/profile.test.js`
- `tests/server/resume.test.js`

**What to do**:
- If a test was using `createApp({ repositories })`, change to
  `createApp({ repositories })` unchanged (local mode default).
- No `requireAuth` is passed; tests run in the same local-mode path.
- Confirm zero behavioral regression.

**Expected behavior**:
- All previously passing tests still pass.

**Constraints**:
- Do not migrate tests to a hosted-mode mock unless they specifically test
  hosted behavior.

**Validation**:
- `npm run test:run` — full suite green.

---

## Phase 05 — Frontend Auth Core

### [ ] Task 05.1 — Create `src/services/supabaseClient.js`

**Target file**: `src/services/supabaseClient.js` (new)

**What to do**:
```js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const isHostedAuthAvailable = supabase !== null;
```

**Expected behavior**:
- Hosted mode (Vite env vars present) → exports a usable client.
- Local mode (env vars absent) → exports `null`. Consumers must check
  `isHostedAuthAvailable` before using.

**Constraints**:
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are read.
- The service-role key and JWT secret must never appear in this file or in
  any other `src/` file.
- `detectSessionInUrl: true` is required so the email-verification callback
  (`?auth=callback#access_token=…`) is processed by the client on page load.

**Validation**:
- `tests/services/supabaseClient.test.js`:
  - When env stubs are absent, the module exports `supabase === null` and
    `isHostedAuthAvailable === false`.
  - When env stubs are present, `supabase` is non-null.
  - Confirm `import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY` is never
    referenced (text-search the file).

**Out of scope**:
- Using the client (handled in 05.2 + 07.x).

---

### [ ] Task 05.2 — Create `src/data/authStore.js`

**Target file**: `src/data/authStore.js` (new)

**What to do**:
Implement a small subscribable store that mirrors the pattern in
`src/data/store.js`:

```js
import { supabase, isHostedAuthAvailable } from '../services/supabaseClient.js';

let state = { status: 'initializing', user: null, accessToken: null };
const subscribers = new Set();

function notify() { for (const fn of subscribers) fn(state); }

export function getAuthState() { return state; }
export function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
export function getAccessToken() { return state.accessToken; }

export async function init() {
  if (!isHostedAuthAvailable) {
    state = { status: 'local-mode', user: null, accessToken: null };
    notify();
    return;
  }
  const { data } = await supabase.auth.getSession();
  applySession(data.session);
  supabase.auth.onAuthStateChange((_evt, session) => applySession(session));
}

function applySession(session) {
  if (session?.user && session.access_token) {
    state = {
      status: 'authenticated',
      user: { id: session.user.id, email: session.user.email },
      accessToken: session.access_token,
    };
  } else {
    state = { status: 'unauthenticated', user: null, accessToken: null };
  }
  notify();
}

export async function signOut() { if (supabase) await supabase.auth.signOut(); }
```

**Expected behavior**:
- `init()` is called once at app boot.
- Local mode: `state.status === 'local-mode'`; consumers treat that like
  authenticated for routing purposes (no welcome page).
- Hosted mode: starts `initializing` → flips to `authenticated` or
  `unauthenticated` once the session is loaded.
- `onAuthStateChange` keeps the store in sync with Supabase JS client events
  (sign-in, sign-out, token refresh).

**Constraints**:
- Module-level state — single instance per app.
- Token is only exposed via `getAccessToken()`; the store does not write to
  `localStorage` directly (Supabase JS client owns persistence).

**Validation**:
- `tests/data/authStore.test.js`:
  - With `supabase = null` (mock), `init()` resolves to `local-mode` state.
  - With a mock supabase exposing `auth.getSession` returning a session,
    `init()` resolves to `authenticated` and the listener fires on
    `onAuthStateChange`.
  - `subscribe` returns an unsubscribe that prevents further notifications.
  - `signOut()` calls the mock client; subsequent
    `onAuthStateChange(null)` flips state to `unauthenticated`.

**Out of scope**:
- UI consumption (handled in 06.x).

---

### [ ] Task 05.3 — Update `src/services/api.js` to attach the `Authorization` header

**Target file**: `src/services/api.js`

**What to do**:
- Import `getAccessToken` from `src/data/authStore.js`.
- Inside `request()`, when a token is present, attach
  `Authorization: 'Bearer ' + token` to the outgoing headers.
- Do not change the response/error shape.

**Expected behavior**:
- Local mode: `getAccessToken()` returns `null`, no header attached, behavior
  identical to today.
- Hosted authenticated: header attached automatically.
- 401 response: surfaces as the existing error shape with `code: 'UNAUTHORIZED'`
  (already supported by the response parsing).

**Constraints**:
- Do not log token contents.

**Validation**:
- `tests/services/api.test.js` (new):
  - With `getAccessToken` returning `null`, no `Authorization` header on the
    sent fetch.
  - With `getAccessToken` returning `'abc'`, header is
    `Authorization: Bearer abc`.
  - 401 JSON response surfaces as a thrown
    `{ code: 'UNAUTHORIZED', message }`.

**Out of scope**:
- Refreshing tokens manually (Supabase JS client handles refresh).

---

### [ ] Task 05.4 — Update `src/services/resumeApi.js` to attach the `Authorization` header

**Target file**: `src/services/resumeApi.js`

**What to do**:
Same pattern as 05.3, applied to whatever fetch wrapper this file uses for
the resume endpoint.

**Expected behavior**: identical to 05.3 but for resume requests.

**Constraints**: same.

**Validation**:
- `tests/services/resumeApi.test.js` (new or extended): confirms header
  attachment behavior.

**Out of scope**: none.

---

### [ ] Task 05.5 — Create `src/services/authApi.js`

**Target file**: `src/services/authApi.js` (new)

**What to do**:
```js
import { request } from './api.js';

export function signup(email, password) {
  return request('POST', '/api/auth/signup', { email, password });
}
```

**Expected behavior**:
- Thin wrapper around `request()`. Reuses the same network-error and
  validation-error surface as the rest of the API.

**Constraints**:
- No additional logic — keep this file under 10 lines.

**Validation**:
- Covered indirectly by `tests/components/welcome.test.js` (Phase 07) which
  mocks `authApi`.

**Out of scope**:
- Login / sign-out (those go through `supabaseClient` directly).

---

## Phase 06 — Welcome Page Structure

### [ ] Task 06.1 — Create `src/pages/welcome/WelcomePage.js`

**Target file**: `src/pages/welcome/WelcomePage.js` (new)

**What to do**:
Export a `WelcomePage` object with `mount(root, deps)` and `unmount()`
matching the existing page convention. Inside `mount`:
- Render the diagonal-split layout container (left column + right hero slab).
- Mount `BrandBlock`, headline, supporting copy, `CTAGroup`,
  `FloatingMeta`, and `HeroSlideshow` into the appropriate columns.
- Read the URL for `?auth=callback`. If present, show the
  verification-confirmed inline state (a brief toast or banner inviting the
  user to sign in) and clean the query string (`history.replaceState`).

**Expected behavior**:
- Mounts a structurally complete welcome page (semantic HTML, correct
  containers). Styling lands in Phase 09.
- `unmount()` removes event listeners and DOM nodes.

**Constraints**:
- Do not render a navbar or footer — the welcome page is pre-app.
- Layout containers use class names matching the design tokens (e.g.
  `.welcome`, `.welcome__content`, `.welcome__hero`).
- The headline uses the exact copy from the design (`Your job search,` /
  `organized.`) with a fixed line break.

**Validation**:
- `tests/components/welcome.test.js` (covered fully in 07.5):
  - Mount renders the brand block, headline, CTA group, and hero slot.
  - `?auth=callback` query renders the verification-confirmed banner and the
    URL is cleaned afterward.

**Out of scope**:
- Visual styling beyond structural class names (Phase 09).
- Auth overlay (Phase 07).

---

### [ ] Task 06.2 — Create `src/pages/welcome/BrandBlock.js`

**Target file**: `src/pages/welcome/BrandBlock.js` (new)

**What to do**:
Render an `<img src={Alice_White}>` (44×44) next to a "Project Alice"
wordmark in a flex container. Class names match the design's specs.

**Expected behavior**:
- Returns a DOM element (project pattern — vanilla JS, not JSX).

**Constraints**:
- Import `Alice_White.png` (already used by `Navbar` and `Footer`).
- No alt-text on the icon (it's decorative; the wordmark carries the label).

**Validation**:
- Smoke test inside `tests/components/welcome.test.js`.

**Out of scope**: none.

---

### [ ] Task 06.3 — Create `src/pages/welcome/CTAGroup.js`

**Target file**: `src/pages/welcome/CTAGroup.js` (new)

**What to do**:
Render three buttons:
- Sign In (primary indigo) — emits a `signin` event when clicked
- Create Account (secondary outlined) — emits a `signup` event
- Try Demo (ghost) — **rendered with `disabled` attribute and a `title`
  attribute reading "Coming soon — available with the next release."** Does
  not emit any event.

Accept an `onAction(actionId)` callback or use a `CustomEvent`-on-element
pattern — match whichever pattern the existing components use (read
`StatusDropdown.js` first to confirm).

**Expected behavior**:
- Clicking Sign In → fires the signin handler.
- Clicking Create Account → fires the signup handler.
- Try Demo cannot be clicked (disabled); hover/focus shows the tooltip.

**Constraints**:
- The `disabled` state must be announced by assistive tech (use native
  `<button disabled>`, not `aria-disabled` alone, so keyboard focus skips it
  by default).
- Tooltip uses the native `title` attribute for now; richer tooltip widget
  is out of scope.

**Validation**:
- `tests/components/welcome.test.js` clicks each button and asserts the
  handler fires (or doesn't, for Try Demo).

**Out of scope**:
- Wiring the handlers to actual auth flows (Phase 07).

---

### [ ] Task 06.4 — Create `src/pages/welcome/HeroCard.js`

**Target file**: `src/pages/welcome/HeroCard.js` (new)

**What to do**:
Render an `<img>` wrapped in a card container. Props: `src`, `alt`,
`rotation` (e.g. `-2deg`), `primary` (boolean for which shadow/size variant
to use).

**Expected behavior**:
- Pure presentational component with the design's border, radius, shadow,
  and transform.

**Constraints**:
- If `src` is missing, render a neutral placeholder (a `--surface` box with
  the brand mark centered). This lets the welcome page build before
  Phase 10 captures the real screenshots.

**Validation**:
- Smoke test in welcome.test.js.

**Out of scope**: none.

---

### [ ] Task 06.5 — Create `src/pages/welcome/HeroSlideshow.js`

**Target file**: `src/pages/welcome/HeroSlideshow.js` (new)

**What to do**:
- Accept a `slides` array (`[{ src, alt }, …]`) and a `placeholder` flag.
- Render the slides as overlapping `HeroCard`s; auto-rotate which one is
  primary on a 5-second interval.
- Respect `prefers-reduced-motion: reduce` — when set, render only the first
  slide statically and disable interval rotation.
- If `slides.length === 0` (assets not yet captured), render a single
  placeholder `HeroCard`.

**Expected behavior**:
- Rotation transitions use the design's `opacity 500ms ease, transform 500ms ease`.
- Component cleans up its interval on `unmount`.

**Constraints**:
- No external animation library — use CSS transitions only.

**Validation**:
- `tests/components/heroSlideshow.test.js`:
  - With `prefers-reduced-motion: reduce`, no interval is registered.
  - With slides empty, the placeholder renders.
  - With three slides, the primary index advances over time (use vitest
    fake timers).

**Out of scope**:
- Slide content itself (Phase 10 supplies it).

---

### [ ] Task 06.6 — Create `src/pages/welcome/FloatingMeta.js`

**Target file**: `src/pages/welcome/FloatingMeta.js` (new)

**What to do**:
Render the three example pills from the design (`24 Active`, `+12 This Month`,
`78% Match`) absolutely-positioned over the hero slab. Decorative only.

**Expected behavior**:
- Renders three pills. No interactivity. Hidden when
  `prefers-reduced-motion: reduce` is on (keeps the page calmer when
  reduced-motion is requested — optional, document if implemented).

**Constraints**:
- Plain text values are hardcoded — these are not real metrics in this
  feature.

**Validation**:
- Smoke test that the three pills render with the expected text.

**Out of scope**:
- Real-data binding (the floating pills become live in a future polish
  feature, not 018).

---

### [ ] Task 06.7 — Update `src/main.js` to gate the app shell on auth state

**Target file**: `src/main.js`

**What to do**:
- Call `authStore.init()` early in the bootstrap.
- Subscribe to the auth store:
  - `status === 'local-mode'` → mount the existing app shell exactly as
    today (navbar + main + footer).
  - `status === 'authenticated'` → mount the existing app shell.
  - `status === 'unauthenticated'` or `'initializing'` → mount the
    `WelcomePage` into a sibling root (replace any existing app shell with
    just the welcome page; no navbar).
- On state transition (e.g. sign-in completes, sign-out fires), unmount the
  active root and mount the other.

**Expected behavior**:
- Local mode is byte-identical to today after this change — unchanged paint
  and behavior.
- Hosted unauthenticated → welcome page only (no navbar/footer).
- Hosted authenticated → existing app shell with navbar/footer.

**Constraints**:
- Don't double-mount. Use an `_authUnsubscribe` and a `_currentRoot` variable
  similar to the existing `_currentPage` / `_currentUnmount` pattern.

**Validation**:
- Manual smoke: run `npm run dev` in local mode; confirm the tracker still
  loads.
- `tests/main.test.js` (new, optional): script a hosted-mode state machine
  through `local-mode` / `unauthenticated` / `authenticated` and assert
  which top-level element exists in the DOM.

**Out of scope**:
- The welcome page's contents (Phase 06.1–06.6 cover those).

---

## Phase 07 — Auth Overlay + Forms

### [ ] Task 07.1 — Create `src/pages/welcome/AuthOverlay.js`

**Target file**: `src/pages/welcome/AuthOverlay.js` (new)

**What to do**:
- Render a shell that becomes a centered modal on desktop (`≥760px`) and a
  bottom sheet on mobile (`<760px`). Use a CSS media-query to switch styles
  (Phase 09 supplies the styling; this task supplies the structural
  containers and class names).
- Accept a `view` prop (`'login' | 'signup' | 'verification_sent'`) and
  mount `LoginForm`, `SignupForm`, or a verification-sent confirmation panel
  accordingly. Switching between login and signup must not remount the
  overlay or lose the email value.
- Focus trap + ESC-to-close + backdrop-click-to-close. Restore focus to the
  CTA that opened the overlay on close.
- Reuse `components/Modal.js` where it fits; otherwise duplicate the
  focus-trap pattern.

**Expected behavior**:
- ESC closes; backdrop click closes; close button closes.
- Tab order is trapped inside the overlay while open.
- Switching `view` does not unmount.

**Constraints**:
- The shared email value between login and signup is held in the overlay's
  state, not in the form components.

**Validation**:
- `tests/components/welcome.test.js`:
  - Opening from CTA, switching tabs, and pressing ESC each behave as
    specified.
  - Focus returns to the original CTA on close.

**Out of scope**:
- Actual form submission logic (07.2, 07.3).

---

### [ ] Task 07.2 — Create `src/pages/welcome/LoginForm.js`

**Target file**: `src/pages/welcome/LoginForm.js` (new)

**What to do**:
Render email + password inputs and a Sign In submit button. On submit:
- Disable the submit button; show inline loading state.
- Call `supabase.auth.signInWithPassword({ email, password })`.
- On success: `authStore` will fire `onAuthStateChange` → `main.js` will
  swap to the app shell automatically. The form does not need to navigate.
- On failure (any Supabase error including unverified email): render a
  single inline error: "Sign-in failed. Check your email and password, or
  confirm your email if you haven't yet."

**Expected behavior**:
- Form prevents double-submit while in flight.
- Inline error renders accessibly (`aria-live="polite"`, associated with
  the inputs).

**Constraints**:
- Do not differentiate "user not found" vs "wrong password" in error copy
  (neutrality, consistent with FR-006 spirit).

**Validation**:
- `tests/components/welcome.test.js`:
  - Submit with mocked Supabase returning a session → success branch.
  - Submit with mocked Supabase returning an error → inline error renders.
  - Submit while in flight is blocked.

**Out of scope**:
- "Forgot password" link UI (Supabase's default flow is used out of the
  app; no in-app entry point in this feature).

---

### [ ] Task 07.3 — Create `src/pages/welcome/SignupForm.js`

**Target file**: `src/pages/welcome/SignupForm.js` (new)

**What to do**:
Render email + password inputs and a Create Account submit button. On
submit:
- Call `authApi.signup(email, password)`.
- On success: switch the overlay `view` to `verification_sent`.
- On 400 validation error: render inline field-level errors.
- On 403 / any other error: render the same neutral message: "Signup is
  not available for this email."

**Expected behavior**:
- Validation errors render at field level when the server returns them.
- Non-validation errors render as a single inline notice.
- Successful submit transitions the overlay to verification-sent.

**Constraints**:
- Do not reveal whether the email exists or is allowlisted (already
  enforced server-side; the form must not invent a more specific error).

**Validation**:
- `tests/components/welcome.test.js`:
  - Happy path → overlay shows verification-sent.
  - 400 with `fields.email` → email field shows error.
  - 403 → neutral inline error.

**Out of scope**:
- Resending the verification email (Supabase's default flow handles it).

---

### [ ] Task 07.4 — Wire CTA → overlay handlers in `WelcomePage`

**Target file**: `src/pages/welcome/WelcomePage.js`

**What to do**:
Connect `CTAGroup` actions to the `AuthOverlay`:
- Sign In → open overlay in `'login'` view.
- Create Account → open overlay in `'signup'` view.
- Try Demo → no-op (button is disabled).

**Expected behavior**:
- Clicking the CTAs opens the overlay with the right view.
- Closing the overlay returns focus to the CTA.

**Constraints**: none.

**Validation**:
- Welcome page integration test in `tests/components/welcome.test.js`.

**Out of scope**: none.

---

### [ ] Task 07.5 — Write the welcome-page test suite

**Target file**: `tests/components/welcome.test.js` (new)

**What to do**:
Cover the behavioral surface introduced by Phases 06 and 07:
- Welcome page mounts with brand, headline, CTAs, hero slot.
- Try Demo is disabled.
- CTA click opens overlay in correct view.
- Login flow happy path / error path (Supabase mocked).
- Signup flow happy path → verification-sent state; 400 → field error; 403
  → neutral error.
- ESC / backdrop / close button each close the overlay; focus restores.
- `?auth=callback` query renders the verification banner and cleans the URL.

**Constraints**:
- Supabase JS client is **fully mocked at the module boundary**. No live
  Supabase project required.
- Use `jsdom` (already a project devDependency).

**Validation**:
- `npm run test:run -- tests/components/welcome.test.js` passes.

**Out of scope**: none.

---

## Phase 08 — Navbar + Resume-Import Gating

### [ ] Task 08.1 — Update `src/components/Navbar.js`

**Target file**: `src/components/Navbar.js`

**What to do**:
- Subscribe to `authStore`. When authenticated, render a small right-aligned
  segment containing the user's email (truncated if long) and a Sign Out
  button.
- The Sign Out button calls `authStore.signOut()`.
- In `local-mode` state, the segment is not rendered — navbar looks exactly
  as today.

**Expected behavior**:
- Local mode: navbar visually unchanged.
- Hosted authenticated: navbar shows the email + sign-out control.

**Constraints**:
- Unsubscribe on `Navbar` teardown to avoid memory leaks (project pattern:
  return an unsubscribe function from `render`, called by the page on
  unmount, or attach to the navbar element via a `_cleanup` property —
  read the existing Navbar code first).

**Validation**:
- `tests/components/navbar.test.js` (extend existing or new):
  - Local-mode mount renders no user segment.
  - Hosted-authenticated mount renders the email and sign-out.
  - Clicking sign-out calls `authStore.signOut`.

**Out of scope**:
- User avatar / dropdown menu (out of scope; v1 is text + button only).

---

### [ ] Task 08.2 — Update `src/components/ResumeImport.js` to hide when signed out

**Target file**: `src/components/ResumeImport.js`

**What to do**:
- Subscribe to `authStore`. The resume-import entry point renders only when
  `status === 'local-mode'` or `status === 'authenticated'`. In
  `unauthenticated` / `initializing`, the component returns nothing (or
  renders nothing into its container).

**Expected behavior**:
- Local mode: unchanged.
- Hosted authenticated: visible.
- Hosted unauthenticated: absent.

**Constraints**:
- This is a defense-in-depth measure — the API already rejects
  unauthenticated resume requests via `requireAuth`.

**Validation**:
- `tests/components/resumeImport.test.js` (new or extended):
  - Renders in local-mode and authenticated states.
  - Does not render in unauthenticated state.

**Out of scope**:
- Resume upload size or rate limiting (021).

---

## Phase 09 — Welcome Page Styling

### [ ] Task 09.1 — Add welcome-page CSS to `src/styles/main.css`

**Target file**: `src/styles/main.css`

**What to do**:
Append a new section under a `/* Welcome page */` comment that implements the
design's specs:
- `.welcome` container with the diagonal split (left content column ~55%,
  right hero slab ~62%, polygon clip-path
  `polygon(22% 0, 100% 0, 100% 100%, 6% 100%)`).
- Hero slab background: documented radial-gradient stack over `var(--navy)`.
- Headline: Sora 700 / 54px / line-height 1.05 / tracking -1.6px /
  `var(--t1)`.
- Supporting copy: Sora 400 / 14px / `var(--t2)` / max-width 420px /
  line-height 1.7.
- Brand block: `Alice_White.png` 44×44; "Project Alice" wordmark Sora 16 /
  600 / tracking -0.3px.
- CTA buttons: primary (`var(--indigo)` bg, `#fff` text), secondary
  (transparent + 1.5px `var(--border)`), ghost (text-only).
- Hover states per design: primary brightens to `var(--indigo-hover)` and
  `translateY(-1px)`; secondary borders to `var(--indigo)` and bg to
  `var(--indigo-soft)`; ghost increases opacity only.
- Screenshot card: `#fff` bg, 16px radius, layered shadows.
- Footer metadata: DM Mono 11px / `var(--t3)` / margin-top 28px.

**Expected behavior**:
- Pixel-correct match to the design at desktop, tablet, and mobile
  breakpoints.

**Constraints**:
- **No new CSS custom properties**. Reuse the existing tokens in `:root` at
  `src/styles/main.css:1-46`.
- Keep all rules inside one labeled section to keep the file scannable.

**Validation**:
- Manual: run `npm run dev`, open the welcome page in hosted mode, compare
  side-by-side to the design at three breakpoints (≥1100px, 760–1100px,
  <760px, <420px).

**Out of scope**:
- The auth overlay styles (09.2).

---

### [ ] Task 09.2 — Style the auth overlay (modal + bottom sheet)

**Target file**: `src/styles/main.css`

**What to do**:
- Desktop (`≥760px`): centered modal at ~440px width using shadow `var(--shadow-lg)`
  and radius `var(--r-lg)`.
- Mobile (`<760px`): bottom sheet, slides up from below, full width with a
  drag-affordance handle at the top, max-height 92vh, internal scroll.
- Backdrop: `rgba(26, 26, 46, 0.36)` to match `var(--navy)` tonality.
- Form inputs use the existing project input styles (read one existing form
  to copy class names).
- Field-error text uses `var(--color-danger)`.

**Expected behavior**:
- Overlay is centered on desktop, bottom-anchored on mobile.
- Reduced-motion users get instant appearance (no slide animation) when
  `prefers-reduced-motion: reduce`.

**Constraints**:
- Reuse `var(--shadow-lg)`, `var(--r-lg)`, color tokens — no new vars.
- Animation duration ≤ 250ms.

**Validation**:
- Manual at each breakpoint.

**Out of scope**: none.

---

### [ ] Task 09.3 — Reduced-motion + accessibility pass on the welcome page

**Target files**:
- `src/styles/main.css`
- `src/pages/welcome/HeroSlideshow.js`

**What to do**:
- Confirm the `prefers-reduced-motion: reduce` media query disables
  slideshow rotation, hero card transforms, and overlay slide-in animations.
- Confirm headline and supporting copy meet WCAG AA contrast against
  `var(--bg)` (already true given the existing tokens; verify with a
  contrast checker once styled).
- Confirm CTA buttons are reachable in tab order and have visible focus
  rings.
- Confirm floating metadata pills meet AA contrast against the hero slab
  background.

**Expected behavior**:
- Reduced-motion: no animations.
- All interactive elements keyboard-reachable with visible focus.

**Constraints**:
- Do not remove transitions for non-reduced-motion users.

**Validation**:
- Manual: enable "Reduce motion" in OS settings; refresh; verify no
  rotations.
- axe-core (browser extension) pass on the welcome page returns no AA
  failures.

**Out of scope**:
- Color-contrast token redesign (not needed; existing tokens already meet AA).

---

## Phase 10 — Hero Screenshot Capture (polish; can ship later)

This phase is optional for the initial 018 merge — the placeholder fallback
from Task 06.5 keeps the welcome page presentable. Run this phase as a
follow-up PR when ready.

### [ ] Task 10.1 — Capture five real-application screenshots

**Target files**: `src/assets/welcome-hero/*.png` (five new files)

**What to do**:
- Run `npm run dev` with seeded data.
- Capture, at consistent zoom and aspect ratio:
  1. `tracker.png` — main tracker view with several applications visible
  2. `application-modal.png` — the edit application modal open
  3. `profile.png` — the profile view
  4. `filters.png` — the quick filters / filter panel area
  5. `calendar.png` — the calendar view
- Crop tightly, optimize for file size (TinyPNG / `pngquant`), target ≤
  300KB each.

**Expected behavior**:
- Each screenshot is a believable capture of the actual application, per the
  design's "no fake dashboards" requirement.

**Constraints**:
- Use the warm off-white background (`var(--bg)`) — never the dark navy
  shell — as the page bg for these captures, per design intent.
- Do not include any personally identifying information from the
  developer's local data; reseed with `npm run db:seed` if necessary.

**Validation**:
- Manual review against design intent.

**Out of scope**: none.

---

### [ ] Task 10.2 — Wire the captured slides into `HeroSlideshow`

**Target file**: `src/pages/welcome/WelcomePage.js`

**What to do**:
Pass the captured slides into the `HeroSlideshow`:

```js
const slides = [
  { src: trackerPng, alt: 'Tracker view' },
  { src: applicationModalPng, alt: 'Application edit modal' },
  { src: profilePng, alt: 'Profile' },
  { src: filtersPng, alt: 'Filters and sorting' },
  { src: calendarPng, alt: 'Calendar' },
];
```

**Expected behavior**:
- Slideshow shows the real screenshots, rotating per design.
- Placeholder fallback path remains intact for tests.

**Constraints**:
- Alt text describes the screenshot subject (these are not decorative).

**Validation**:
- Manual: rotation visible at the documented cadence.

**Out of scope**: none.

---

## Phase 11 — Verification & Checklist

### [ ] Task 11.1 — Run the full test suite

**Command**: `npm run test:run`

**Expected behavior**: All tests pass with zero new failures. Coverage of new
modules is verifiable from the test names listed in this file.

---

### [ ] Task 11.2 — Verify secrets are not in the Vite bundle

**Target output**: `dist/` (post-`npm run build`)

**What to do**:
- Run `npm run build`.
- Grep the `dist/` directory for `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_JWT_SECRET`, and the actual values from local hosted env vars
  (if any are set in the shell).

**Expected behavior**:
- Zero hits.

**Constraints**:
- Run with hosted env vars present in the shell — that's the realistic check.

**Validation**:
- `grep -r SUPABASE_SERVICE_ROLE_KEY dist/` returns no matches.
- `grep -r SUPABASE_JWT_SECRET dist/` returns no matches.

---

### [ ] Task 11.3 — Walk `checklists/plan-review.md`

**Target file**: `specs/018-auth-user-access/checklists/plan-review.md`

**What to do**:
- Check off each item that the implementation now satisfies.
- For any unchecked item, note the reason in the Open Items table at the
  bottom and the residual risk.
- Re-run `axe-core` (browser extension) on the welcome page; capture
  results.

**Expected behavior**:
- Either every item is checked, or every unchecked item has a stated
  reason and residual risk.

**Validation**:
- The checklist file is updated in this PR.

---

### [ ] Task 11.4 — Manually validate via `quickstart.md`

**Target file**: `specs/018-auth-user-access/quickstart.md`

**What to do**:
- Follow the quickstart end-to-end on a real Supabase project.
- Confirm each step in §6 (Manual validation flow) succeeds.

**Expected behavior**:
- Allowlisted signup → verification → sign-in → protected route 200.
- Non-allowlisted signup → neutral rejection.
- Refresh preserves session.
- Sign-out clears session; protected route 401.
- Demo button is disabled and shows the tooltip.

**Constraints**:
- This task requires a real Supabase project — schedule accordingly.

**Validation**:
- All quickstart §6 steps documented as passing in the PR description.

---

### [ ] Task 11.5 — Update memory and CLAUDE.md if patterns emerged

**Target files**:
- `CLAUDE.md` (project)
- User auto-memory (`MEMORY.md` index + per-topic files)

**What to do**:
- If any new conventions emerged that aren't obvious from the code (e.g.
  the "neutral error channel" pattern, the conditional-middleware pattern,
  the welcome-page-as-pre-app-gate pattern), capture them.
- Don't write memories about things derivable from the code itself.

**Expected behavior**:
- Memory index up to date.

**Validation**:
- Memory files committed (user repo only — not the project repo).

---

## Out of Scope (entire feature)

These belong to other features and MUST NOT be done here:

- Adding `user_id` columns to `applications` or `profile` (019)
- Applying RLS policies to `applications` or `profile` (019)
- Switching repositories to Supabase persistence (019)
- Demo session behavior beyond rendering a disabled CTA (020)
- Hosted resume-import size/rate limits (021)
- OAuth/social login providers
- Custom in-app password-reset UI
- Admin allowlist management UI
- SQLite schema changes
- Local-mode authentication
