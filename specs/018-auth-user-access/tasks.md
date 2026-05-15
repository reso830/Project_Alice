# Tasks: Hosted Authenticated User Access (018)

**Spec**: `specs/018-auth-user-access/spec.md`
**Plan**: `specs/018-auth-user-access/plan.md`
**Design**: `design/welcome_page.md`
**Branch**: `018-auth-user-access`

---

## Phase Map

| Phase | Theme | Blocks |
|---|---|---|
| 01 | Foundation: deps + server config + Vite build-time assertion | All other phases |
| 02 | Supabase setup: `allowed_emails` table + allowlist trigger | Manual validation in 11 |
| 03 | Auth middleware + server tests | 04 |
| 04 | Wire protected routers + `/api/health` runtime mode + tests | 05+ runtime |
| 05 | Frontend auth core (client + store + header attach) | 06, 07 |
| 06 | Welcome page structure (no styling) | 07, 09 |
| 07 | Auth overlay + Login/Signup forms | 09 |
| 08 | Navbar + resume-import gating + ConfigError page | 11 |
| 09 | Welcome page + overlay styling per design | 11 |
| 10 | Hero screenshot capture (polish; can ship later) | — |
| 11 | Verification, browser smoke tests, checklist walk | — |

Phases 01 → 04 are backend + build pipeline. Phases 05 → 09 are frontend and
can begin once Phase 03 is merged (the JWT contract is then stable). Phase 10
is optional polish; Phase 11 is the verification gate.

---

## Phase 01 — Foundation

### [X] Task 01.1 — Add `@supabase/supabase-js` and `jsonwebtoken` to dependencies

**Target file**: `package.json`

**What to do**:
Add to `dependencies`:
- `@supabase/supabase-js` (latest 2.x)
- `jsonwebtoken` (latest 9.x)

Run `npm install` after editing. Commit both `package.json` and
`package-lock.json`.

**Expected behavior**:
- `import { createClient } from '@supabase/supabase-js'` resolves in client modules.
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
- Wiring the packages into application code (handled in 03.x and 05.x).

---

### [X] Task 01.2 — Extend `server/config.js` with `SUPABASE_JWT_SECRET`

**Target file**: `server/config.js`

**What to do**:
Add `SUPABASE_JWT_SECRET` to the `HOSTED_REQUIRED` list. Add the resolved value
to the frozen `config.supabase` object as `jwtSecret`.

```js
supabase: runtime === 'hosted'
  ? {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      jwtSecret: process.env.SUPABASE_JWT_SECRET,
    }
  : null,
```

`AUTH_EMAIL_REDIRECT_URL` is **NOT** added here — it now lives on the client
as `VITE_AUTH_EMAIL_REDIRECT_URL` (consumed by the Supabase JS client).

**Expected behavior**:
- `APP_RUNTIME=hosted` without `SUPABASE_JWT_SECRET` → throws
  `Missing required environment variable for hosted mode: SUPABASE_JWT_SECRET`
- `APP_RUNTIME=local` → `config.supabase` is `null`; no new env vars required.

**Constraints**:
- `SUPABASE_JWT_SECRET` must never appear under a `VITE_` prefix anywhere.
- Returned object must remain frozen.

**Validation**:
- Extend `tests/server/config.test.js` with one new case: hosted mode missing
  `SUPABASE_JWT_SECRET` throws naming that variable.
- `npm run test:run -- tests/server/config.test.js` passes.

**Out of scope**:
- Using the secret (handled in 03.1).

---

### [X] Task 01.3 — Add Vite build-time assertion for Supabase env vars

**Target file**: `vite.config.js`

**What to do**:
Add a Vite plugin that runs during the `config` hook and asserts the three
`VITE_SUPABASE_*` / `VITE_AUTH_*` env vars are non-empty when building for
production. Local-mode dev (which runs without these vars) is unaffected.

```js
function assertHostedFrontendEnv() {
  return {
    name: 'alice:assert-hosted-frontend-env',
    config(_config, env) {
      if (env.mode !== 'production') return;
      const required = [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
        'VITE_AUTH_EMAIL_REDIRECT_URL',
      ];
      const missing = required.filter((k) => !process.env[k]);
      if (missing.length) {
        throw new Error(
          `Production build requires ${missing.join(', ')} — set them in your build environment.`
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [assertHostedFrontendEnv()],
  // existing config
});
```

**Expected behavior**:
- `npm run build` with all three vars set → bundle produced.
- `npm run build` with any missing → throws naming the missing vars; no
  `dist/` produced.
- `npm run dev` works regardless of these vars (local mode).

**Constraints**:
- Plugin must read from `process.env`, not `import.meta.env`, at config time.
- Do not assert these vars in test runs (vitest does not set
  `mode === 'production'`).

**Validation**:
- `tests/build/vite-config.test.js` (new): import the plugin's factory,
  call it, invoke its `config` hook with `{ mode: 'production' }` and missing
  vars in `process.env`, assert it throws with the expected message.
- Manual: run `npm run build` with vars unset and confirm the error message.

**Out of scope**:
- Runtime handshake (Task 04.2 / 08.3).

---

## Phase 02 — Supabase Setup

### [X] Task 02.1 — Create `allowed_emails` table in Supabase

**Target**: Supabase SQL Editor (not a code file)

**What to do**:
Run the SQL from `data-model.md §1`:

```sql
create table allowed_emails (
  email      text primary key check (length(email) <= 254),
  added_at   timestamptz not null default now(),
  added_by   text
);

alter table allowed_emails enable row level security;
-- no policies — deny by default for anon; trigger function reads via SECURITY DEFINER
```

**Expected behavior**:
- Table exists in Supabase.
- Anon-key `select * from allowed_emails` returns 0 rows even when entries
  exist.

**Constraints**:
- All inserts must be lowercased.

**Validation**:
- Manual: in the Supabase dashboard's API explorer, confirm anon-key reads
  return 0 rows.
- Operator inserts their own email in lowercase for the Phase 11 manual
  validation.

**Out of scope**:
- Migration tooling (none in this feature).

---

### [X] Task 02.2 — Install the Postgres allowlist trigger

**Target**: Supabase SQL Editor

**What to do**:
Run the SQL from `data-model.md §2-3`. This is a plain Postgres trigger — not
a Supabase "Auth Hook" — so no dashboard configuration is needed beyond
running this SQL.

```sql
create or replace function public.handle_new_user_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from allowed_emails where email = lower(new.email)
  ) then
    raise exception 'Signup is not available for this email.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_user_email_allowlist() from public;

drop trigger if exists before_user_created_allowlist on auth.users;
create trigger before_user_created_allowlist
  before insert on auth.users
  for each row execute function public.handle_new_user_email_allowlist();
```

**Expected behavior**:
- Calling `supabase.auth.signUp({ email: <not-allowlisted>, … })` returns an
  error and no row is created in `auth.users`.
- Calling `supabase.auth.signUp({ email: <allowlisted>, … })` succeeds and a
  verification email is sent.

**Constraints**:
- The function must use `SECURITY DEFINER` to bypass RLS on `allowed_emails`.
- Owner of the function must have `select` privilege on `allowed_emails`.

**Validation**:
- Manual (Phase 11.4 covers this): from the Supabase dashboard's SQL editor,
  attempt `insert into auth.users (email) values ('unallowed@x.com')` and
  observe the trigger raises.
- Manual: from the application welcome page, signup with a non-allowlisted
  email and observe rejection.

**Out of scope**:
- Allowlist-management UI.

---

### [X] Task 02.3 — Configure Supabase Auth redirect URLs

**Target**: Supabase Dashboard (Authentication → URL Configuration)

**What to do**:
- Set **Site URL** to the production hosted frontend origin (or
  `http://localhost:5173` for local dev).
- Add the matching `?auth=callback` URL(s) to **Redirect URLs**, e.g.:
  - `http://localhost:5173/?auth=callback` (local dev)
  - Production Vercel URL `/?auth=callback`
  - Any preview URLs needed

**Expected behavior**:
- Verification emails land users on the welcome page with `?auth=callback` in
  the query string and the access token in the URL hash.

**Constraints**:
- Match the URL **exactly** (Supabase rejects mismatched redirects).

**Validation**:
- Manual in Phase 11.4.

**Out of scope**:
- Customizing email templates.

---

## Phase 03 — Auth Middleware

### [X] Task 03.1 — Create `server/auth/middleware.js` with categorized logging

**Target file**: `server/auth/middleware.js` (new)

**What to do**:
Accept a `logger` dependency (defaults to a thin wrapper around `console.warn`)
so tests can capture log calls. Categorize every rejection as one of:
`missing` / `malformed` / `expired` / `signature` / `other`. Log the category
and the request path — **never the token, prefix of the token, or the request
body**.

```js
import jwt from 'jsonwebtoken';

const UNAUTHORIZED_BODY = {
  error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
};

function classify(err) {
  if (err?.name === 'TokenExpiredError') return 'expired';
  if (err?.name === 'JsonWebTokenError') {
    return err.message === 'jwt malformed' ? 'malformed' : 'signature';
  }
  return 'other';
}

export function createRequireAuth({ jwtSecret, logger = console }) {
  return function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) {
      logger.warn('[auth] reject', { category: 'missing', path: req.path });
      return res.status(401).json(UNAUTHORIZED_BODY);
    }
    if (!header.startsWith('Bearer ')) {
      logger.warn('[auth] reject', { category: 'malformed', path: req.path });
      return res.status(401).json(UNAUTHORIZED_BODY);
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      req.user = { id: payload.sub, email: payload.email };
      return next();
    } catch (err) {
      logger.warn('[auth] reject', { category: classify(err), path: req.path });
      return res.status(401).json(UNAUTHORIZED_BODY);
    }
  };
}
```

**Expected behavior**:
- See `contracts/api.md §3` for the response contract.
- Every rejection produces exactly one `logger.warn` call with
  `{ category, path }` — `category` is one of the four documented values
  (plus a fallback `other` for unexpected JWT errors).
- Successful verifications produce no log entry.

**Constraints**:
- Algorithm allowlist: `HS256` only (prevents algorithm-confusion attacks).
- **The token MUST NOT appear in any log statement**, not even as a prefix or
  truncated value. Only the failure `category` and the request `path` are
  logged. The token variable is referenced only inside `jwt.verify`.
- Do not log the request body.
- Do not look up the user in Supabase — verification is local.

**Validation**:
- `tests/server/auth-middleware.test.js`:
  - Missing header → 401, body matches `UNAUTHORIZED_BODY`, handler not run,
    `logger.warn` called once with `category: 'missing'`
  - Malformed header (`Token foo`) → 401, `category: 'malformed'`
  - Token with valid shape but malformed JWT payload → 401,
    `category: 'malformed'`
  - Token signed with the wrong key → 401, `category: 'signature'`
  - Expired token → 401, `category: 'expired'`
  - Valid HS256 token signed with the test secret → 200, `req.user.id` set
    to the `sub` claim, **`logger.warn` NOT called**
  - **Token-redaction assertion**: across all rejection cases above, none of
    the captured log-call arguments contain the rejected token string (assert
    via substring search against every argument of every `logger.warn` call).

**Out of scope**:
- Applying the middleware to real routers (handled in Phase 04).
- Aggregated rejection counts (a metrics layer is out of scope for v1; per-
  event log lines are sufficient and can be aggregated by an external log
  pipeline).

---

## Phase 04 — Protected Routers + Runtime Handshake

### [X] Task 04.1 — Update protected router factories to accept an optional `requireAuth`

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
- No business-logic changes inside the route handlers in this task.

**Validation**:
- Existing `tests/server/applications.test.js`, `profile.test.js`,
  `resume.test.js` pass unmodified.
- New assertion in each: when called with a `requireAuth` stub that calls
  `res.status(401).end()`, every request returns 401 and `repo.getAll` is
  never invoked.

**Out of scope**:
- Reading `req.user` inside handlers (019).

---

### [X] Task 04.2 — Update `server/index.js` to wire `requireAuth` conditionally, report runtime mode, and log boot

**Target file**: `server/index.js`

**What to do**:
- Import `createRequireAuth` from `server/auth/middleware.js`.
- In `createApp`, if `config.isHosted`, instantiate
  `requireAuth = createRequireAuth({ jwtSecret: config.supabase.jwtSecret })`
  and pass it to each protected router factory. Local mode passes `undefined`.
- Extend `GET /api/health` to return `{ status: 'ok', runtime: config.runtime }`.
- Log the boot line once at startup:
  `console.log('[runtime] mode=' + config.runtime + ' port=' + config.port)`.
  Local mode emits `mode=local`; hosted emits `mode=hosted`. The existing
  017-era startup log line is preserved alongside.

**Expected behavior**:
- Local mode: `/api/health` → `{ status: 'ok', runtime: 'local' }`. All other
  routes behave as before.
- Hosted mode: `/api/health` → `{ status: 'ok', runtime: 'hosted' }`.
  `/api/applications`, `/api/profile`, `/api/resume` return 401 without a
  valid Bearer token.
- Boot logs include the runtime line so operators can grep for the active
  mode in production logs without hitting `/api/health` (FR-016).

**Constraints**:
- Mount order: `/api/health` → protected routers → error handler.
- Do not put `requireAuth` on `/api/health`.
- No `/api/auth` router is mounted (signup is handled by Supabase directly).

**Validation**:
- New `tests/server/routes-protected.test.js`:
  - Build a hosted-mode app with a stub `requireAuth` that calls `next()`;
    confirm protected routes return 200.
  - Build a hosted-mode app with a stub `requireAuth` that calls
    `res.status(401).end()`; confirm protected routes return 401.
  - Confirm `/api/health` remains 200 with the correct `runtime` field in
    both modes.
  - Spy on `console.log` during a server boot fixture and confirm the
    `[runtime] mode=…` line is emitted exactly once per boot.
  - **End-to-end 401 + log assertion**: build a hosted-mode app with the
    real `createRequireAuth` (not a stub) and a spy logger. Issue a
    `GET /api/applications` without a token; assert 401 response AND
    that the spy logger captured exactly one `[auth] reject` entry with
    `category: 'missing'` and `path: '/api/applications'`. Repeat with
    one tampered-token case to confirm `category: 'signature'`. This
    verifies the wiring end-to-end, not just the middleware in isolation.

**Out of scope**:
- Frontend consumption of `/api/health` (Task 08.3).

---

### [X] Task 04.3 — Update existing route tests for the new factory signature

**Target files**:
- `tests/server/applications.test.js`
- `tests/server/profile.test.js`
- `tests/server/resume.test.js`

**What to do**:
- Confirm all tests still use the no-`requireAuth` path (local mode default).
- No `requireAuth` is passed; tests run unchanged from a behavioral standpoint.

**Expected behavior**:
- All previously passing tests still pass.

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
export const emailRedirectUrl = import.meta.env.VITE_AUTH_EMAIL_REDIRECT_URL;

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
- Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
  `VITE_AUTH_EMAIL_REDIRECT_URL` are read.
- The service-role key and JWT secret must never appear in this file or
  anywhere else in `src/`.
- `detectSessionInUrl: true` ensures the email-verification callback
  (`?auth=callback#access_token=…`) is processed by the client on page load.

**Validation**:
- `tests/services/supabaseClient.test.js`:
  - When env stubs are absent, `supabase === null` and
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
- Local mode: `state.status === 'local-mode'`; main.js treats this like
  authenticated for routing purposes (no welcome page).
- Hosted mode: starts `initializing` → flips to `authenticated` or
  `unauthenticated` once the session is loaded.

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
- 401 response: surfaces as the existing error shape with `code: 'UNAUTHORIZED'`.

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

---

### [ ] Task 05.4 — Update `src/services/resumeApi.js` to attach the `Authorization` header

**Target file**: `src/services/resumeApi.js`

**What to do**: same pattern as 05.3 for the resume endpoint.

**Validation**: `tests/services/resumeApi.test.js` (new or extended) confirms
header attachment.

---

### [ ] Task 05.5 — Create `src/services/healthApi.js`

**Target file**: `src/services/healthApi.js` (new)

**What to do**:
```js
import { request } from './api.js';
export function getHealth() { return request('GET', '/api/health'); }
```

**Expected behavior**:
- Thin wrapper; reuses `request()` so it inherits network-error handling.

**Constraints**:
- Must not require an `Authorization` header.

**Validation**:
- Covered indirectly by Task 08.3's tests.

---

## Phase 06 — Welcome Page Structure

### [ ] Task 06.1 — Create `src/pages/welcome/WelcomePage.js`

**Target file**: `src/pages/welcome/WelcomePage.js` (new)

**What to do**:
Implement `WelcomePage` with `mount(root, deps)` and `unmount()`. The single
file contains, inlined per the I4 middle ground:

- Diagonal-split container (`<div class="welcome">`).
- Left content column with:
  - **Brand block** (inlined): `<img src={aliceWhite} class="welcome__brand-mark">`
    + `<span class="welcome__brand-text">Project Alice</span>`.
  - Headline (`Your job search,` `<br>` `organized.`).
  - Supporting copy.
  - **CTA group** (inlined): three buttons.
    - Sign In (primary) → opens `AuthOverlay` in `'login'` view.
    - Create Account (secondary) → opens `AuthOverlay` in `'signup'` view.
    - Try Demo (ghost) → rendered with `disabled` attribute and
      `title="Coming soon — available with the next release."` Does nothing
      when clicked.
  - Footer metadata text (`Built with Vite · Supabase · Vercel`).
- Right hero slab containing a mounted `HeroSlideshow`.
- **Floating metadata pills** (inlined): three absolute-positioned pills
  (`24 Active`, `+12 This Month`, `78% Match`) plus the small
  `Sample data — illustrative only` disclaimer per design §11.
- Email-verification callback handler: on mount, read the URL; if
  `?auth=callback` is present, render the verification-confirmed banner
  inside the welcome page and clean the query string via
  `history.replaceState`.

Mount the `AuthOverlay` as a sibling overlay element (rendered conditionally
based on internal state for view: `null | 'login' | 'signup' | 'verification_sent'`).

**Expected behavior**:
- Structurally complete welcome page (semantic HTML, correct containers).
  Styling lands in Phase 09.
- `unmount()` removes event listeners, intervals, and DOM nodes.

**Constraints**:
- Do not render a navbar or footer — the welcome page is pre-app.
- Headline uses the exact copy with fixed line break.

**Validation**:
- `tests/components/welcome.test.js` covers mount, three-CTA presence,
  Try Demo disabled, `?auth=callback` handling, and the overlay-open
  side effect.

**Out of scope**:
- Visual styling (Phase 09).
- AuthOverlay internals (Phase 07).

---

### [ ] Task 06.2 — Create `src/pages/welcome/HeroSlideshow.js`

**Target file**: `src/pages/welcome/HeroSlideshow.js` (new)

**What to do**:
- Accept a `slides` array (`[{ src, alt }, …]`).
- Render the slides as overlapping `<img>` cards (HeroCard inlined as a small
  helper function inside this file).
- Auto-rotate which slide is primary on a 5-second interval.
- Respect `prefers-reduced-motion: reduce` — when set, render only the first
  slide statically and disable interval rotation.
- If `slides.length === 0` (assets not yet captured in Phase 10), render a
  single placeholder card.

**Expected behavior**:
- Rotation transitions use `opacity 500ms ease, transform 500ms ease`.
- Component cleans up its interval on `unmount`.

**Constraints**:
- No external animation library — CSS transitions only.

**Validation**:
- `tests/components/heroSlideshow.test.js`:
  - With `prefers-reduced-motion: reduce`, no interval is registered.
  - With slides empty, the placeholder renders.
  - With three slides, the primary index advances over time (use vitest
    fake timers).

**Out of scope**:
- Slide content itself (Phase 10).

---

### [ ] Task 06.3 — Wire welcome page into `src/main.js`

**Target file**: `src/main.js`

**What to do**:
- Call `authStore.init()` early in bootstrap.
- Subscribe to the auth store. Render based on state:
  - `'initializing'` → render nothing (no flash; per N4).
  - `'local-mode'` or `'authenticated'` → mount the existing app shell.
  - `'unauthenticated'` → mount `WelcomePage` (with no navbar/footer).
- On state transition, unmount the active root and mount the other.

**Expected behavior**:
- Local mode is byte-identical to today — unchanged paint and behavior.
- Hosted unauthenticated → welcome page only.
- Hosted authenticated → existing app shell with navbar/footer.
- Brief `initializing` window shows nothing (white viewport for ~50ms while
  Supabase resolves the session).

**Constraints**:
- Don't double-mount.
- Single subscription; unsubscribe on hot-reload paths.

**Validation**:
- Manual smoke: `npm run dev` in local mode; tracker still loads.
- `tests/main.test.js` (new, optional): script a state machine through
  `initializing` / `unauthenticated` / `authenticated` and assert which
  top-level element exists in the DOM.

**Out of scope**:
- `ConfigError` mounting (Task 08.3).

---

## Phase 07 — Auth Overlay + Forms

### [ ] Task 07.1 — Create `src/pages/welcome/AuthOverlay.js`

**Target file**: `src/pages/welcome/AuthOverlay.js` (new)

**What to do**:
- Render a centered modal at every breakpoint per design §11b.
- Accept a `view` prop (`'login' | 'signup' | 'verification_sent'`) and mount
  `LoginForm`, `SignupForm`, or a verification-sent confirmation panel
  accordingly. Switching between login and signup must not remount the
  overlay or lose the email value (state for that lives in the overlay).
- Tab strip at the top switches between Login and Signup.
- Focus trap + ESC-to-close + backdrop-click-to-close. Restore focus to the
  CTA that opened the overlay on close.
- Copy focus-trap logic inline (see plan tradeoff: extract to shared util
  later if a third consumer appears).

**Expected behavior**:
- ESC closes; backdrop click closes; close button closes.
- Tab order is trapped inside the overlay while open.
- Switching `view` does not unmount.

**Constraints**:
- Do **not** extend `components/Modal.js` (plan tradeoff).
- The shared email value between login and signup is held in the overlay's
  state, not in the form components.

**Validation**:
- `tests/components/welcome.test.js`:
  - Opening from CTA, switching tabs, and pressing ESC each behave as
    specified.
  - Focus returns to the original CTA on close.
  - Email field value persists across tab switch.

**Out of scope**:
- Form submission logic (07.2, 07.3).

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
- Inline error renders accessibly (`aria-live="polite"`).

**Constraints**:
- Do not differentiate "user not found" vs "wrong password" in error copy.

**Validation**:
- `tests/components/welcome.test.js`:
  - Submit with mocked Supabase returning a session → success branch.
  - Submit with mocked Supabase returning an error → inline error renders.
  - Submit while in flight is blocked.

**Out of scope**:
- "Forgot password" link UI (Supabase default flow only; no in-app entry).

---

### [ ] Task 07.3 — Create `src/pages/welcome/SignupForm.js`

**Target file**: `src/pages/welcome/SignupForm.js` (new)

**What to do**:
Render email + password inputs and a Create Account submit button. On submit:
- Field-level validation: email regex, password min 8 chars. Render inline
  field errors when present.
- Call `supabase.auth.signUp({ email, password, options: { emailRedirectTo: emailRedirectUrl } })`.
- On success: switch the overlay `view` to `verification_sent`.
- On any error: render a single inline neutral error
  ("This email cannot sign up right now.") regardless of the underlying
  Supabase cause (allowlist miss, duplicate user, rate-limit, network error).

**Expected behavior**:
- Field-level errors render at the field; neutral signup-rejection error
  renders at the form footer.
- Successful submit transitions the overlay to verification-sent.

**Constraints**:
- Do not reveal whether the email exists or is allowlisted.
- Map every Supabase error to the same neutral message string.

**Validation**:
- `tests/components/welcome.test.js`:
  - Happy path → overlay shows verification-sent.
  - Field-level validation errors render inline.
  - Mocked `signUp` rejection → neutral inline error.
  - Two consecutive errors with different Supabase causes produce the
    same DOM (byte-identical error region).

**Out of scope**:
- Resend-verification UI — handled by the user submitting again with the same
  email (Supabase resends automatically).

---

### [ ] Task 07.4 — Write the welcome-page test suite

**Target file**: `tests/components/welcome.test.js` (new)

**What to do**:
Cover the behavioral surface introduced by Phases 06 and 07 (already enumerated
across earlier tasks). Plus:
- `?auth=callback` query renders the verification banner and cleans the URL.
- Try Demo is disabled.

**Constraints**:
- Supabase JS client is **fully mocked at the module boundary**.
- Use `jsdom`.

**Validation**:
- `npm run test:run -- tests/components/welcome.test.js` passes.

---

## Phase 08 — Navbar + Resume-Import + ConfigError

### [ ] Task 08.1 — Update `src/components/Navbar.js`

**Target file**: `src/components/Navbar.js`

**What to do**:
- Subscribe to `authStore`. When authenticated, render a small right-aligned
  segment containing the user's email (truncated if long) and a Sign Out
  button.
- The Sign Out button calls `authStore.signOut()`.
- In `'local-mode'`, the segment is not rendered.

**Validation**:
- `tests/components/navbar.test.js`:
  - Local-mode mount renders no user segment.
  - Hosted-authenticated mount renders the email and sign-out.
  - Clicking sign-out calls `authStore.signOut`.

---

### [ ] Task 08.2 — Update `src/components/ResumeImport.js` to hide when signed out

**Target file**: `src/components/ResumeImport.js`

**What to do**:
- Subscribe to `authStore`. The resume-import entry point renders only when
  `status === 'local-mode'` or `status === 'authenticated'`. In
  `'unauthenticated'` / `'initializing'`, the component returns nothing.

**Validation**:
- `tests/components/resumeImport.test.js`:
  - Renders in local-mode and authenticated states.
  - Does not render in unauthenticated state.

---

### [ ] Task 08.3 — Create `ConfigError.js` and wire the runtime handshake

**Target files**:
- `src/pages/ConfigError.js` (new)
- `src/main.js`

**What to do**:
- `ConfigError.js` renders a simple, branded "Configuration Error" view with
  copy along the lines of "This deployment is misconfigured. Contact the
  operator." Plain text, uses existing design tokens.
- In `main.js`, after `authStore.init()` resolves, also call `getHealth()`
  from `services/healthApi.js`. If the response is `{ runtime: 'hosted' }` and
  `isHostedAuthAvailable === false`, mount `ConfigError` and skip everything
  else (welcome page or app shell). This is defense-in-depth for the build-
  time assertion in 01.3.

**Expected behavior**:
- Build-time check is the primary line of defense (a hosted build cannot ship
  without the Vite env vars).
- If somehow that fails, the runtime check catches the mismatch and renders a
  clear page instead of a silently-broken app.

**Validation**:
- `tests/main.test.js`:
  - Mock `getHealth` to return `{ runtime: 'hosted' }` and
    `isHostedAuthAvailable === false`; assert `ConfigError` renders.
  - Mock `getHealth` to return `{ runtime: 'local' }`; assert the app shell
    renders (no welcome, no ConfigError).

---

## Phase 09 — Welcome + Overlay Styling

### [ ] Task 09.1 — Add welcome-page CSS to `src/styles/main.css`

**Target file**: `src/styles/main.css`

**What to do**:
Append a `/* Welcome page */` section implementing the design spec:
- `.welcome` diagonal split (left ~55%, right hero slab ~62%, polygon
  clip-path `polygon(22% 0, 100% 0, 100% 100%, 6% 100%)`).
- Hero slab background: radial-gradient stack over `var(--navy)`.
- Headline: Sora 700 / 54px / line-height 1.05 / tracking -1.6px /
  `var(--t1)`.
- Supporting copy: Sora 400 / 14px / `var(--t2)` / max-width 420px /
  line-height 1.7.
- Brand block: 44×44 image; "Project Alice" wordmark Sora 16 / 600 / tracking -0.3px.
- CTA buttons: primary, secondary outlined, ghost — per design §7.
- Hover/focus states per design.
- Screenshot card: `#fff` bg, 16px radius, layered shadows.
- Footer metadata: DM Mono 11px / `var(--t3)` / margin-top 28px.
- Floating pills + illustrative disclaimer per design §11.
- Breakpoint behavior per design §4 (tablet, mobile hero ribbon, narrow mobile
  CTA stack).

**Constraints**:
- **No new CSS custom properties** — reuse `src/styles/main.css:1-46`.

**Validation**:
- Manual: `npm run dev`, open the welcome page in hosted mode, compare to
  design at four breakpoints (≥1100px, 760–1100px, <760px, <420px).

---

### [ ] Task 09.2 — Style the auth overlay (centered modal at all breakpoints)

**Target file**: `src/styles/main.css`

**What to do**:
Per design §11b:
- Desktop ≥1100px: 440px centered modal.
- Tablet 760–1100px: 420px centered modal.
- Mobile <760px: `min(92vw, 380px)` centered modal with 16px viewport floors.
- Backdrop: `rgba(26, 26, 46, 0.36)` + 2px blur.
- Shell uses `var(--surface)`, `var(--r-lg)`, `var(--shadow-lg)`, 28px padding.
- Tab strip uses `var(--indigo)` for the active underline, `var(--t2)` for
  inactive labels.
- Form inputs reuse existing project input styles.
- Verification-sent state styling.
- Entrance: 200ms fade + 6px translate-up.

**Constraints**:
- No new CSS variables.
- Animation respects `prefers-reduced-motion: reduce`.

**Validation**:
- Manual at each breakpoint.

---

### [ ] Task 09.3 — Reduced-motion + accessibility pass

**Target files**:
- `src/styles/main.css`
- `src/pages/welcome/HeroSlideshow.js`

**What to do**:
- `prefers-reduced-motion: reduce` disables slideshow rotation, hero card
  transforms, and overlay slide-in animations.
- Headline + copy meet WCAG AA contrast against `var(--bg)`.
- CTA buttons keyboard-reachable with visible focus rings.
- Floating pills + disclaimer meet AA contrast against the hero slab.

**Validation**:
- Manual reduced-motion test.
- axe-core (browser extension) pass on the welcome page returns no AA
  failures.

---

## Phase 10 — Hero Screenshot Capture (optional polish)

Run as a follow-up PR if not needed before initial merge.

### [ ] Task 10.1 — Capture five real-application screenshots

**Target files**: `src/assets/welcome-hero/*.png` (five new files)

**What to do**:
- `npm run dev` with seeded data.
- Capture: `tracker.png`, `application-modal.png`, `profile.png`,
  `filters.png`, `calendar.png`.
- Crop tightly; optimize with TinyPNG / `pngquant`; target ≤300KB each.

**Constraints**:
- Use the warm off-white bg (`var(--bg)`) as the page bg.
- No personal data in captures; reseed with `npm run db:seed` if necessary.

**Validation**:
- Manual review against design intent.

---

### [ ] Task 10.2 — Wire captured slides into `HeroSlideshow`

**Target file**: `src/pages/welcome/WelcomePage.js`

**What to do**:
Pass the captured slides into the `HeroSlideshow` (replacing the empty array).

**Validation**:
- Manual: rotation visible.

---

## Phase 11 — Verification

### [ ] Task 11.1 — Run the full automated test suite

**Command**: `npm run test:run`

**Expected behavior**: All tests pass, zero new failures.

---

### [ ] Task 11.2 — Verify secrets are not in the Vite bundle

**Target output**: `dist/`

**What to do**:
- Run `npm run build` with hosted env vars set.
- Grep `dist/` for `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and the
  actual values from local hosted env vars.

**Validation**:
- Zero hits for any of the above.

---

### [ ] Task 11.3 — Verify build-time assertion fails closed

**What to do**:
- Run `npm run build` with `VITE_SUPABASE_URL` unset.
- Confirm the build exits with a non-zero status and a descriptive error
  message.
- Repeat for the other two `VITE_*` vars.

**Validation**:
- Three runs, three failures with the expected error.

---

### [ ] Task 11.4 — Walk `checklists/plan-review.md`

**Target file**: `specs/018-auth-user-access/checklists/plan-review.md`

**What to do**: check off each item; note residual risk for any unchecked.

---

### [ ] Task 11.5 — Manual validation via `quickstart.md §6-7`

**What to do**: follow quickstart §6 (run) and §7 (manual validation flow,
including negative paths) end-to-end on a real Supabase project.

**Validation**:
- All steps documented as passing in the PR description.

---

### [ ] Task 11.5b — Pre-deploy verification gate (`quickstart.md §10`)

**What to do**: before promoting any hosted deploy to production, run the
six checks in `quickstart.md §10` against the **production** Supabase
project. Capture the SQL outputs and the bypass-test result in the deploy PR.

**Why this is its own task**: the application server has no Supabase client
and cannot verify the trigger or table at runtime. If the trigger is
missing, signups fail OPEN with no runtime indication. This gate is the
only mechanism that catches that misconfiguration before users hit it.

**Validation**:
- All six checks documented as passing in the deploy PR description.
- If any check fails, the deploy is NOT promoted; the missing piece is
  installed and the gate is re-run from scratch.

---

### [ ] Task 11.6 — Browser smoke tests (constitution Amendment 1.1.0)

**What to do**: in a live browser session against the hosted deploy (or a
local hosted-mode dev), execute each user-story Independent Test from spec.md:

- [ ] **US1** — allowlisted signup → verify email → sign in → protected route
  (`GET /api/applications`) returns 200.
- [ ] **US2** — non-allowlisted rejection:
  - [ ] Via the SignupForm: neutral inline error; no row in `auth.users`.
  - [ ] Via dev-tools console (`await supabase.auth.signUp({ email: 'unallowed@x.com', password: 'longenough' })`):
    Supabase returns an error; no row in `auth.users`. This validates the
    allowlist trigger is the enforcement point.
- [ ] **US3** — refresh mid-session preserves auth state; sign-out clears
  state and returns navbar to signed-out.
- [ ] **US4** — unauthenticated client receives 401 on every protected route;
  resume-import entry point is absent from DOM; welcome page renders.
- [ ] **US5** — JWT tampered in dev-tools (alter a character mid-token) →
  `/api/applications` returns 401; response body contains no token
  diagnostics.

Mark each US complete in the PR description. Capture any deviations as
follow-up issues.

---

### [ ] Task 11.7 — Update memory and `CLAUDE.md` if patterns emerged

**Target files**: `CLAUDE.md` (project), user auto-memory.

**What to do**: capture new conventions not obvious from the code (e.g.
"allowlist enforcement lives in Supabase trigger; document the install in
quickstart"; "build-time + runtime defense-in-depth for Vite env vars").

---

## Out of Scope (entire feature)

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
