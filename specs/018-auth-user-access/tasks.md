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
| 10 | Hero screenshot capture (polish; can ship later) | 11 |
| 11 | Release prep: README, CHANGELOG, footer/version bump, deployment + repo-map docs | 12 |
| 12 | Verification, browser smoke tests, checklist walk | Merge |
| 13 | Tracker chrome refresh — unified navy band, identity cluster polish, bottom tab bar, FAB, fold-narrow breakpoint | 14–18 |
| 14 | Welcome refresh — Foundation: appMeta module, design tokens, headline accent, brand mark swap, remove pills/disclaimer, mini footer, demo CTA placeholder | 15–18 |
| 15 | Welcome refresh — Hero scenes + slideshow rebuild (SceneStack / ScenePipeline / SceneProfile / SceneLogo, replace 6-screenshot rotation) | 16–18 |
| 16 | Welcome refresh — Tweaks system + layout modes + theme variants (tweaksStore, TweaksPanel, four layouts, three themes) | 17, 18 |
| 17 | Welcome refresh — Auth Modal restyle (440px shell, new overlay, drop tab strip, "or" divider + demo button, swap-mode link, legal copy) | 18 |
| 18 | Welcome refresh — Mobile portrait-stack branch (`<760px`) + asset cleanup + test rewrite + spec/design cross-check | 19 |
| 19 | Release prep redo: bump to 0.8.1, CHANGELOG entry, docs sweep | 20 |
| 20 | UI-only browser smoke test — re-verify US3 + US4 chrome paths and all welcome surfaces against the to-be-merged state | Merge |

Phases 01 → 04 are backend + build pipeline. Phases 05 → 09 are frontend and
can begin once Phase 03 is merged (the JWT contract is then stable). Phase 10
is optional polish; Phase 11 is the docs + version bump for v0.8.0; Phase 12
was the verification gate that closed out v0.8.0. Phase 13 is the post-v0.8.0
tracker chrome refresh (`design/tracker.md`). Phases 14–18 are the welcome-
page refresh (`design/welcome_page.md`), split by risk and dependency:
Phase 14 lays the shared foundation; Phase 15 swaps the hero slideshow over to
the new abstract scene system; Phase 16 introduces the Tweaks + layout + theme
matrix; Phase 17 restyles the auth modal; Phase 18 closes out with the mobile
branch, asset cleanup, and the full welcome test rewrite. Phases 13–18 share
a single Release Prep + Smoke Test cycle (Phases 19–20) that bumps to v0.8.1.

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

### [X] Task 05.1 — Create `src/services/supabaseClient.js`

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

### [X] Task 05.2 — Create `src/data/authStore.js`

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

### [X] Task 05.3 — Update `src/services/api.js` to attach the `Authorization` header

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

### [X] Task 05.4 — Update `src/services/resumeApi.js` to attach the `Authorization` header

**Target file**: `src/services/resumeApi.js`

**What to do**: same pattern as 05.3 for the resume endpoint.

**Validation**: `tests/services/resumeApi.test.js` (new or extended) confirms
header attachment.

---

### [X] Task 05.5 — Create `src/services/healthApi.js`

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

### [X] Task 06.1 — Create `src/pages/welcome/WelcomePage.js`

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

### [X] Task 06.2 — Create `src/pages/welcome/HeroSlideshow.js`

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

### [X] Task 06.3 — Wire welcome page into `src/main.js`

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

### [X] Task 07.1 — Create `src/pages/welcome/AuthOverlay.js`

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

### [X] Task 07.2 — Create `src/pages/welcome/LoginForm.js`

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

### [X] Task 07.3 — Create `src/pages/welcome/SignupForm.js`

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

### [X] Task 07.4 — Write the welcome-page test suite

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

### [X] Task 08.1 — Update `src/components/Navbar.js`

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

### [X] Task 08.2 — Update `src/components/ResumeImport.js` to hide when signed out

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

### [X] Task 08.3 — Create `ConfigError.js` and wire the runtime handshake

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

### [X] Task 09.1 — Add welcome-page CSS to `src/styles/main.css`

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

### [X] Task 09.2 — Style the auth overlay (centered modal at all breakpoints)

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

### [X] Task 09.3 — Reduced-motion + accessibility pass

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

### [X] Task 10.1 — Capture five real-application screenshots

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

### [X] Task 10.2 — Wire captured slides into `HeroSlideshow`

**Target file**: `src/pages/welcome/WelcomePage.js`

**What to do**:
Pass the captured slides into the `HeroSlideshow` (replacing the empty array).

**Validation**:
- Manual: rotation visible.

---

## Phase 11 — Release Prep

Docs + version bump pass before the verification gate. Phase 12 reruns the
test suite and build assertion after this phase lands, so anything broken by
the version/docs edits is caught before PR.

### [X] Task 11.1 — Bump version to `0.8.0`

**Target files**:
- `package.json`
- `src/components/Footer.js` (`APP_VERSION` constant)

**What to do**:
- Update `"version"` in `package.json` from `0.7.0` to `0.8.0` (SemVer minor:
  additive hosted-auth feature, no breaking change to local-mode users).
- Update `APP_VERSION` in `src/components/Footer.js` to `'v0.8.0'`.
- If the "Built May 2026" string in the footer is stale relative to the merge
  date, refresh it to match. Keep the format identical.

**Validation**:
- `grep -n "0.7.0" package.json src/` returns no matches.
- `npm run test:run` still green (footer tests assert the string structure,
  not the exact version — verify they still pass).

**Out of scope**:
- Bumping any dependency versions.
- Touching `package-lock.json` beyond what `npm install` regenerates.

---

### [X] Task 11.2 — `CHANGELOG.md` entry for 0.8.0

**Target file**: `CHANGELOG.md`

**What to do**:
Add a `## [0.8.0] — <merge-date>` section above `[0.7.0]`, following the
Keep-a-Changelog format already in use. Group entries under:

- **Added**:
  - Hosted authenticated user access via Supabase email/password
  - `allowed_emails` table + Postgres `BEFORE INSERT` trigger on `auth.users`
  - JWT-based `requireAuth` middleware with categorized rejection logging
    (`missing | malformed | expired | signature | other`); token contents
    never logged
  - `/api/health` now reports `{ status, runtime: 'local' | 'hosted' }`
  - Welcome page (`src/pages/welcome/*`) — diagonal-split landing with hero
    slideshow, brand block, three-CTA group, floating metadata pills, and
    `?auth=callback` verification banner handler
  - Auth overlay with centered-modal design at all breakpoints, login + signup
    forms, shared email value across tabs, verification-sent confirmation,
    focus trap, ESC + backdrop + close-button dismissal, and previous-focus
    restoration
  - `Navbar` user segment showing email (truncated if long) + Sign Out
  - `ConfigError` page + runtime handshake — defense-in-depth for missing
    Vite env vars (build-time assertion is the primary line)
  - Frontend `authStore` (Supabase-backed), `supabaseClient.js`,
    `healthApi.js`; `Authorization: Bearer <token>` automatically attached by
    `api.js` and `resumeApi.js` when authenticated
  - Resume-import gating: hidden when `unauthenticated` / `initializing`
  - Six hero screenshots in `src/assets/welcome-hero/`
  - Vite build-time assertion for `VITE_SUPABASE_URL`,
    `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`
- **Changed**:
  - `createApp({ repositories, config, requireAuth? })` factory signature —
    accepts optional `requireAuth` (route factories likewise)
  - `unmountAppShell` now calls `Navbar.destroy()` to clean up the authStore
    subscription
- **Security**:
  - Allowlist enforcement moved into a Postgres `SECURITY DEFINER` trigger
    (server endpoint approach considered and rejected for bypass risk)
  - Service-role key and JWT secret are server-only; never imported in `src/`

Mirror the prose density of the existing `[0.7.0]` entry — concise, file/path
references where they aid future debugging, no marketing language.

**Validation**:
- `CHANGELOG.md` parses by eye; section ordering matches Keep-a-Changelog.

**Out of scope**:
- Rewriting earlier release entries.
- A separate "release notes" file.

---

### [X] Task 11.3 — `README.md` hosted-mode + auth section

**Target file**: `README.md`

**What to do**:
- In the **Features** bullets, add a single line for hosted authenticated
  multi-user access pointing to the spec for details.
- Add a new top-level section `## Hosted Mode (Supabase Authentication)`
  after the existing **Getting Started**. Cover, in this order:
  1. Local vs hosted mode at a glance (one sentence each).
  2. Required env vars (server: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`; client/build:
     `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
     `VITE_AUTH_EMAIL_REDIRECT_URL`). Note which are secret-only.
  3. One-paragraph allowlist model with a pointer to
     `specs/018-auth-user-access/quickstart.md` for the operator install
     steps.
  4. Defense-in-depth note: build-time assertion + runtime `/api/health`
     handshake → `ConfigError`.
- Cross-link the spec package
  (`specs/018-auth-user-access/{spec,plan,quickstart,data-model}.md`) under
  a `## Further Reading` subsection.

**Constraints**:
- Do not duplicate the operator-install steps inline; link the quickstart.
- Keep the existing local-first framing intact — hosted is the second
  paragraph, not the first.

**Validation**:
- Markdown renders cleanly on GitHub (manual check).
- Every linked path exists at the time of writing.

---

### [X] Task 11.4 — Update `docs/deployment.md` with hosted-mode notes

**Target file**: `docs/deployment.md`

**What to do**:
Add a `## Hosted Mode Deployment` section covering:
- Setting Supabase project env vars in Vercel (Production + Preview).
- Where to set the redirect URLs in the Supabase dashboard (Authentication →
  URL Configuration). Reference the gamma project naming convention used
  during 018 dev.
- The pre-deploy verification gate from `quickstart.md §10` — a short
  bulleted recap with a link rather than copying the steps.
- Note that local-mode deployment is unchanged; hosted-mode is a separate
  Vercel project, not a flag.

**Constraints**:
- Don't restate Supabase quickstart steps; link them.

**Validation**:
- Cross-references resolve.
- No drift between this file and `quickstart.md` (the quickstart is
  authoritative).

---

### [X] Task 11.5 — Update `docs/REPO_MAP.md` with the new directories and files

**Target file**: `docs/REPO_MAP.md`

**What to do**:
Add entries for:
- `server/auth/middleware.js` — JWT verification + categorized logging
- `server/auth/` directory
- `src/data/authStore.js` — module-state auth store
- `src/services/supabaseClient.js`, `src/services/healthApi.js`
- `src/pages/welcome/` (WelcomePage, HeroSlideshow, AuthOverlay,
  LoginForm, SignupForm)
- `src/pages/ConfigError.js`
- `src/assets/welcome-hero/` — six hero screenshots
- `specs/018-auth-user-access/` (spec, plan, tasks, data-model, contracts,
  research, quickstart, checklists)

Update any entry whose description changed (e.g. `server/index.js`'s
`createApp` signature, `Navbar.js` adding auth segment + destroy).

**Constraints**:
- Match the existing REPO_MAP entry format exactly (one-line description,
  same column conventions).

**Validation**:
- Every new path exists in the repo at write time.

---

### [X] Task 11.6 — Docs sanity check

**Target files**: none (read-only sweep over the edited docs).

**What to do**:
1. `grep -rn "0\.7\.0" package.json package-lock.json src/ README.md CHANGELOG.md docs/ .env.example` —
   acceptable hits are limited to `CHANGELOG.md` only: the historical
   `## [0.7.0]` heading and the two diff-link footnote lines
   (`[0.8.0]: …v0.7.0...v0.8.0` and `[0.7.0]: …v0.6.0...v0.7.0`). Any
   hit outside `CHANGELOG.md` is a stale reference and must be fixed.
2. `grep -n "\"version\"" package.json package-lock.json` returns `0.8.0`
   in both files (root-level entries).
3. Open `README.md`, `CHANGELOG.md`, `docs/deployment.md`,
   `docs/REPO_MAP.md`, and `.env.example` and verify the new entries
   render correctly and internal links resolve.
4. Run the app and confirm the footer renders `v0.8.0`.

**Validation**:
- All three steps pass before moving to Phase 12.
- The heavier test/lint/build verification is owned by Phase 12; do not
  duplicate it here.

**Out of scope**:
- Cutting the release tag — operator step after Phase 12.

---

## Phase 12 — Verification

### [X] Task 12.1 — Run the full automated test suite

**Command**: `npm run test:run`

**Expected behavior**: All tests pass, zero new failures.

---

### [X] Task 12.2 — Verify secrets are not in the Vite bundle

**Target output**: `dist/`

**What to do**:
- Run `npm run build` with hosted env vars set.
- Grep `dist/` for `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and the
  actual values from local hosted env vars.

**Validation**:
- Zero hits for any of the above.

---

### [X] Task 12.3 — Verify build-time assertion fails closed

**What to do**:
- Run `npm run build` with `VITE_SUPABASE_URL` unset.
- Confirm the build exits with a non-zero status and a descriptive error
  message.
- Repeat for the other two `VITE_*` vars.

**Validation**:
- Three runs, three failures with the expected error.

---

### [X] Task 12.4 — Walk `checklists/plan-review.md`

**Target file**: `specs/018-auth-user-access/checklists/plan-review.md`

**What to do**: check off each item; note residual risk for any unchecked.

---

### [X] Task 12.5 — Manual validation via `quickstart.md §6-7`

**What to do**: follow quickstart §6 (run) and §7 (manual validation flow,
including negative paths) end-to-end on a real Supabase project.

**Validation**:
- All steps documented as passing in the PR description.

---

### [X] Task 12.5b — Pre-deploy verification gate (`quickstart.md §10`)

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

### [X] Task 12.6 — Browser smoke tests (constitution Amendment 1.1.0)

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

### [X] Task 12.7 — Update memory and `CLAUDE.md` if patterns emerged

**Target files**: `CLAUDE.md` (project), user auto-memory.

**What to do**: capture new conventions not obvious from the code (e.g.
"allowlist enforcement lives in Supabase trigger; document the install in
quickstart"; "build-time + runtime defense-in-depth for Vite env vars").

---

## Phase 13 — Tracker Chrome Refresh

> Source of visual truth: [`design/tracker.md`](../../design/tracker.md).
> Behavior contract: spec.md FR-010 / FR-010a / FR-010b / FR-010c.
>
> Scope guardrails: visual + responsive-layout work only. Do NOT change auth
> behavior, JWT verification, route protection, store APIs, or the welcome
> page (Phase 14 owns the welcome refresh). If an apparent visual change
> would require touching `authStore`, `supabaseClient`, route handlers, or
> middleware, stop and raise it — it is out of Phase 13's scope.

### [X] Task 13.1 — Add on-navy tint tokens + FAB shadow + fold-narrow breakpoint variables

**Target file**: `src/styles/main.css`

**What to do**:
Append a new section that captures the values in `design/tracker.md` §
*Toolbar-on-navy tints* and §*Shadows*. Add (as CSS custom properties or as
hard-coded values inside the relevant component selectors — pick whichever is
consistent with the existing pattern in `main.css`):

- Subheader label foreground `rgba(255,255,255,0.8)`
- Count badge bg `rgba(129,140,248,0.18)` / fg `#C7CCFE`
- Filter chip idle / hover / active / open backgrounds, borders, foregrounds
  (six rgba tuples — see design §Toolbar-on-navy tints table)
- Erase-all on-navy bg `rgba(239,68,68,0.18)` / border `rgba(252,165,165,0.45)` / fg `#FCA5A5`
- FAB shadow `0 6px 16px rgba(79,70,229,0.42), 0 2px 6px rgba(0,0,0,0.12)`
- New media-query stop `@media (max-width: 379px)` for the **fold-narrow**
  breakpoint (the existing `@media (max-width: 639px)` mobile stop stays).

**Expected behavior**: No visual change yet — this task just lands the tokens
so subsequent tasks can reference them.

**Constraints**:
- **No renames** of existing tokens. Legacy `--color-accent-tint`,
  `--color-accent-light`, `--color-border` keep their light-context meaning
  per the updated tracker.md.
- Keep all new custom properties scoped to `:root` if they generalize, or
  inline at the call site if they're one-off rgba tuples.

**Validation**:
- `npm run build` still succeeds.
- `npm run test:run` still green (no CSS-token tests yet, but the build
  pipeline catches malformed CSS).

**Out of scope**:
- Applying the tokens (handled in 13.2–13.6).

---

### [X] Task 13.2 — Restyle the top bar into the unified navy band

**Target files**:
- `src/components/Navbar.js`
- `src/styles/main.css`

**What to do**:
Per `design/tracker.md` §Top Bar:

- Height `52px`, `position: sticky`, `z-index: 100`, background `var(--navy)`,
  horizontal flex, `padding: 0 24px`, `gap: 28px`.
- Brand cluster (left): 38×38 logo image `src/assets/Alice_White.png` + the
  `.topbar-brand-text` span "Project Alice" (Sora 15 / 600, letter-spacing
  -0.3px). Wrap the mark+text together so the wordmark can be hidden in the
  fold-narrow breakpoint (Task 13.7) without affecting the mark.
- Page nav (inline, right after the brand): nav buttons `padding: 7px 11px`,
  `border-radius: var(--r-sm)`, default `rgba(255,255,255,0.65)` text and
  transparent bg, hover `rgba(255,255,255,0.08)` bg + white text, active
  state fills `var(--indigo)` + white text.
- Identity cluster (right, `margin-left: auto`): wraps email span +
  sign-out button — both styled in Tasks 13.3 and 13.4.

Add the structural class names the design references (`.topbar`,
`.topbar-brand`, `.topbar-brand-text`, `.topbar-nav`, `.topbar-identity`) and
update Navbar.js's element classes accordingly. Keep the existing
`data-page` attribute on each nav button so `setActive(page)` continues to
work without change.

**Expected behavior**:
- Visually matches the design ASCII diagram at desktop (`> 1024px`).
- `setActive('tracker' | 'calendar' | 'profile')` still toggles the active
  state.
- Local-mode still renders identically (no identity cluster — see 13.4).

**Constraints**:
- No changes to `authStore` subscription or `destroy()` lifecycle.
- Hide page nav at `≤ 639px` via CSS (it will be re-mounted as the Bottom
  Tab Bar in Task 13.5).

**Validation**:
- `tests/components/navbar.test.js` extended: assert the rendered DOM
  contains `.topbar-brand` (with mark + text), `.topbar-nav` with three
  buttons, and the identity cluster slot.
- Manual at desktop and `> 1024px` breakpoint: layout matches design.

---

### [X] Task 13.3 — Switch email truncation from char-count to CSS max-width

**Target files**:
- `src/components/Navbar.js`
- `src/styles/main.css`

**What to do**:
Per FR-010c:

- Remove `EMAIL_DISPLAY_LIMIT` and `truncateEmail()` from `Navbar.js`.
- Render the full email as `textContent` of a `<span class="topbar-email">`.
- Always set the `title` attribute to the full email (currently set only
  when truncated).
- In `main.css`, style `.topbar-email` per design §Top Bar / §Typography:
  DM Mono 11 / 400, color `rgba(255,255,255,0.7)`, `max-width: 220px`,
  `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`.

**Expected behavior**:
- Long emails truncate at 220px with a CSS ellipsis; hovering shows the full
  address via the native `title` tooltip.
- Short emails render unchanged.

**Constraints**:
- Do not introduce a JS truncation fallback.

**Validation**:
- `tests/components/navbar.test.js` updated: assert the rendered span's
  `textContent` is the full email and `title` attribute matches it, even
  for long emails (the previous char-count assertion is removed).

---

### [X] Task 13.4 — Restyle the sign-out button (`.signout-btn`) with door-arrow icon

**Target files**:
- `src/components/Navbar.js`
- `src/styles/main.css`

**What to do**:
Per `design/tracker.md` §Top Bar / Identity cluster:

- Replace the current plain-text Sign Out button with an inline-flex element
  containing a 13×13 door-arrow SVG icon followed by a "Sign out" label
  (Sora 12 / 500, gap 6px, padding `6px 12px`).
- Class `.signout-btn`; background `rgba(255,255,255,0.08)`, border
  `1px solid rgba(255,255,255,0.14)`, radius `var(--r-sm)`.
- Hover: bg `rgba(255,255,255,0.14)`, border `rgba(255,255,255,0.24)`,
  label `#fff`.
- The click handler keeps its current behavior: `authStore.signOut()`.
- Inline the SVG (no new asset file) so the icon can inherit `currentColor`
  for hover state.

Render rule (per FR-010a): the identity cluster (email + sign-out) renders
**only** when `state.status === 'authenticated' && state.user?.email`. In
`'unauthenticated'`, `'initializing'`, and `'local-mode'`, the cluster slot
is empty (kept in the DOM as a flex placeholder via `hidden` is fine, or
removed — pick the option that keeps the right-edge layout stable).

**Expected behavior**:
- Visually matches design at desktop. Hover state animates cleanly.
- Local mode: no identity cluster (no behavior regression).
- Unauthenticated hosted users never see this on the Tracker (they're on
  the Welcome page).

**Constraints**:
- No new asset files for the icon — inline the SVG path.
- Do not change `authStore.signOut()` semantics or its toast trigger.

**Validation**:
- `tests/components/navbar.test.js`:
  - Authenticated mount renders `.signout-btn` containing both an `<svg>`
    child and the "Sign out" label.
  - Clicking it still calls `authStore.signOut` (existing assertion
    preserved).
  - Local-mode + unauthenticated + initializing mounts render no
    `.signout-btn` in the DOM.

---

### [X] Task 13.5 — Add the mobile Bottom Tab Bar

**Target files**:
- `src/components/BottomTabBar.js` (new)
- `src/styles/main.css`
- `src/main.js` (mount point — only when the app shell is mounted, never on
  the welcome page)

**What to do**:
Per `design/tracker.md` §Bottom Tab Bar:

- `position: fixed; left: 0; right: 0; bottom: 0`, background `var(--navy)`,
  top border `1px solid rgba(255,255,255,0.08)`, padding
  `6px 8px calc(6px + env(safe-area-inset-bottom))`, z-index `var(--z-nav)`.
- Three tabs (Tracker / Calendar / Profile) — flex column (18×18 inline SVG
  icon over Sora 10 / 500 label), radius `var(--r-sm)`, padding `6px 4px`.
- Default `rgba(255,255,255,0.55)`; hover `#fff`; active `rgba(79,70,229,0.32)`
  bg + white text.
- Visible only at `@media (max-width: 639px)`; hidden otherwise.
- Selecting a tab calls the same page-change function the desktop top-bar
  nav uses (extract or expose a `setPage(id)` callback from Navbar / main.js
  rather than duplicating the routing logic).
- Cards-list (`.cards-list` or equivalent on Tracker) adds
  `padding-bottom: 86px` on mobile so the bottom tab + FAB clearance keeps
  the last card visible.

**Expected behavior**:
- At ≤ 639px the desktop top-bar nav is hidden and the Bottom Tab Bar
  replaces it.
- Active-tab state stays in sync with `setActive(page)`.
- Welcome page does not mount this component (it's pre-app).

**Constraints**:
- Inline SVG icons; no new asset files.
- Single source of truth for active page — do not introduce a parallel
  state machine.

**Validation**:
- `tests/components/bottomTabBar.test.js` (new):
  - Renders three tabs at width 639; not rendered or
    `display: none`-equivalent at width 1024 (use jsdom + window.matchMedia
    stub or a class-based check).
  - Clicking a tab fires the page-change callback with the right id.
- Manual at 360px viewport: bottom tab bar visible, top-bar nav hidden.

---

### [X] Task 13.6 — Add the mobile FAB

**Target files**:
- `src/components/Fab.js` (new)
- `src/styles/main.css`
- Tracker page (wherever the toolbar "+ New application" button is mounted)

**What to do**:
Per `design/tracker.md` §FAB:

- 56×56, `border-radius: 50%`, bg `var(--indigo)` (hover `var(--indigo-hover)`),
  white `+` glyph (24×24 inline SVG, stroke 2.4).
- `position: fixed; right: 16px; bottom: calc(72px + env(safe-area-inset-bottom))`.
- Shadow per Task 13.1 FAB tuple; active press `transform: scale(0.96)`.
- z-index `calc(var(--z-nav) + 1)` so it floats above the tab bar.
- `aria-label="New application"`.
- Visible only at `@media (max-width: 639px)`; hidden otherwise.
- Click handler opens the Detail Modal in Create mode — reuse the existing
  "+ New application" handler from the toolbar so semantics are identical.

Also hide the toolbar "+ New application" button at ≤ 639px per design
§Toolbar.

**Expected behavior**:
- Mobile: FAB visible, toolbar button hidden, FAB opens Create modal.
- Desktop: FAB hidden, toolbar button visible (no regression).

**Constraints**:
- Inline SVG; no new asset files.
- Reuse the existing modal-open path; do not create a parallel one.

**Validation**:
- `tests/components/fab.test.js` (new):
  - Renders at mobile width; not at desktop width.
  - Click fires the create-application callback.
- Manual at 360px viewport: FAB visible above the bottom tab bar; tap opens
  the modal.

---

### [X] Task 13.7 — Fold-narrow breakpoint: hide wordmark below 380px

**Target file**: `src/styles/main.css`

**What to do**:
Inside the new `@media (max-width: 379px)` block added in Task 13.1, hide
`.topbar-brand-text` (`display: none`). The 38×38 logo mark remains; the
sign-out icon remains. Verify the layout still fits without overflow at
320px (smallest realistic phone width).

**Expected behavior**:
- < 380px viewport: only the logo mark + bottom tab bar + sign-out icon
  visible in the top bar.
- ≥ 380px viewport: wordmark visible (no regression).

**Constraints**:
- Pure CSS — no JS viewport queries.

**Validation**:
- Manual at 320px and 380px viewports: confirm the wordmark toggle.

---

### [X] Task 13.8 — Flip the toolbar to the navy band and restyle filter chips / badge / erase

**Target files**:
- `src/components/Toolbar.js`
- `src/components/QuickFiltersToolbar.js` (and any sub-components: count
  badge, filter chip, sort, erase-all)
- `src/components/FilterPanel.js` (only if it inherits toolbar-context
  styles)
- `src/styles/main.css`

**What to do**:
Per `design/tracker.md` §Toolbar and §Toolbar-on-navy tints:

- Toolbar background flips from `var(--surface)` → `var(--navy)`.
- Bottom border: `1px solid rgba(255,255,255,0.06)` (hairline separator
  only; the previous `1px solid var(--border)` is removed).
- Subheader label: 13 / 500, `rgba(255,255,255,0.8)`.
- Count badge: pill, `rgba(129,140,248,0.18)` bg, `#C7CCFE` text, 12 / 500,
  padding `3px 10px`.
- Filter chips, sort trigger, erase-all: dark-toolbar tints from the table
  in design's §Toolbar-on-navy tints (idle / hover / active / open states).
- Primary action `.btn-primary.new-app-btn`: unchanged indigo button,
  pushed right via `margin-left: auto`. Hidden at ≤ 639px (FAB replaces
  it — see 13.6).
- Filter dropdown panels themselves stay on a light surface
  (`var(--surface)`) — only the toolbar trigger row changes context.

**Expected behavior**:
- Toolbar is visually continuous with the top bar.
- Filter dropdown panels still readable (they open onto a light surface).
- No behavior change to filter / sort / erase logic.

**Constraints**:
- Do not touch filter / sort state machinery.
- Erase-all confirmation flow unchanged.

**Validation**:
- Existing toolbar / filter / sort tests stay green (`npm run test:run`).
- Manual at desktop: toolbar matches the design's unified-band intent;
  filter dropdowns open onto a light surface with no contrast regression.

---

### [X] Task 13.9 — Update z-index registry: FAB + confirm-dialog values

**Target file**: `src/styles/main.css`

**What to do**:
Add the two new layers from `design/tracker.md` §Z-Index Stack:

- FAB: `calc(var(--z-nav) + 1)` (101)
- Confirm dialog: `calc(var(--z-modal) + 10)` (310)

If `--z-nav` and `--z-modal` are not yet custom properties (they are
referenced in the design as if they were), either promote the existing
numeric literals to those custom properties **only in `main.css`**, or
hard-code the `101` / `310` values inside the FAB / ConfirmDialog selectors.
Pick the option that's closer to the existing convention in `main.css`.

**Constraints**:
- Do not introduce z-index drift across other components.

**Validation**:
- Manual: open the archive confirm dialog while a modal is open — confirm
  it sits above the modal as designed.
- Manual: FAB sits above the bottom tab bar.

---

### [X] Task 13.10 — Spec/design cross-check

**Target files** (read-only sweep):
- `design/tracker.md`
- `specs/018-auth-user-access/spec.md` (FR-010a/b/c)

**What to do**:
After 13.1–13.9 land:

1. Walk every requirement in FR-010a, FR-010b, FR-010c and confirm there's
   a corresponding code change.
2. Walk every component-and-token row in tracker.md's tables and confirm
   the styling exists in the implementation.
3. Note any deviation in the PR description for the welcome refresh
   (Phases 14–18) to roll into the Phase 19 CHANGELOG.

**Out of scope**:
- Re-running the full test suite or build assertion — that's owned by
  Phase 19 (Release Prep) and Phase 20 (Smoke Test) once Phases 14–18
  also land.

---

## Phase 14 — Welcome refresh: Foundation

> Source of visual truth: [`design/welcome_page.md`](../../design/welcome_page.md).
> Behavior contract: spec.md FR-020 (partial) / FR-023 / FR-026.
>
> Architecture: see plan.md §14.A–§14.F (module layout, demo stub, asset
> cleanup boundaries, scope guardrails). Phase 14 implements the shared
> foundation — centralized app metadata, design tokens, headline accent,
> brand mark swap, removal of legacy pills/disclaimer, mini-footer rewrite,
> and the demo CTA placeholder. The hero scene system (Phase 15), Tweaks
> + layouts + themes (Phase 16), Auth Modal restyle (Phase 17), and mobile
> branch + asset cleanup (Phase 18) follow.
>
> Scope guardrails: Welcome surface only. Do NOT change `authStore`,
> `supabaseClient`, route handlers, middleware, the JWT contract, or
> Supabase signup fields (no `name` field on signup). If an apparent visual
> change would require any of those, stop and raise it.

### [X] Task 14.1 — Centralize app metadata in a shared module

**Target files**:
- `src/pages/welcome/shared/appMeta.js` (new)
- `src/components/Footer.js` (refactor to import from the new module)

**What to do**:
Create `appMeta.js` exporting:

```js
export const APP_VERSION = 'v0.8.0';                // stays in lock-step with package.json
export const ISSUE_URL = 'https://github.com/reso830/Project_Alice/issues/new';
export const LICENSE_NAME = 'PolyForm Noncommercial 1.0.0';
export const LICENSE_URL = 'https://polyformproject.org/licenses/noncommercial/1.0.0';
```

Then update `src/components/Footer.js` to import these instead of its own
local constants. Behavior of Footer.js is unchanged.

**Expected behavior**:
- `Footer.js` renders identically to before.
- New module is ready for consumption by the Welcome mini footer (Task 14.7).

**Constraints**:
- Phase 19 (version bump) will touch only `appMeta.js` + `package.json`.
- No new dependencies.

**Validation**:
- Existing footer tests still pass unmodified.
- `grep -n "v0.8.0" src/` finds only `appMeta.js` (and any test fixtures
  asserting the value).

---

### [X] Task 14.2 — Wire the existing `Alice_Colored.png` asset

**Target file**: `src/assets/Alice_Colored.png` (already in repo)

**What to do**:
The colored variant is already present at `src/assets/Alice_Colored.png`
alongside `Alice_White.png`. This task is a no-op for the asset itself —
the actual import lands in Task 14.5 (`renderBrand` theme-driven mark
swap). Kept as a discrete task only so the Phase Map references match
the design's asset list (§7).

**Validation**:
- `npm run build` resolves the import added in Task 14.5.

---

### [X] Task 14.3 — Add Phase 14 design tokens to `main.css`

**Target file**: `src/styles/main.css`

**What to do**:
Add the new tokens from `design/welcome_page.md` §2 (where missing) to
`:root`:

- `--navy-deep: #0E0E20`
- `--gold: #F2B544`

Verify the rest of the design's named tokens (`--navy`, `--navy-2`,
`--indigo`, `--indigo-hover`, `--indigo-dim`, `--indigo-soft`, `--indigo-mid`,
`--warm`, `--surface`, `--border`, `--border-2`, `--t1`…`--t4`) already
exist from earlier features — only add what's missing.

**Constraints**:
- Do not rename existing tokens.
- The design's `--warm: #F4F1ED` is what the existing `--bg` token holds
  already; keep `--bg` as the canonical name and alias `--warm` to it via
  `--warm: var(--bg)` if any Phase-14 selectors need to reference the
  design-spec spelling.

**Validation**:
- `npm run build` succeeds.
- `npm run test:run` green.

---

### [X] Task 14.4 — Headline accent: `<em>organized.</em>` with underline-glow

**Target files**:
- `src/pages/welcome/WelcomePage.js` (`renderHeadline()`)
- `src/styles/main.css`

**What to do**:
Per design §4.2:

- Update `renderHeadline()` to render `Your job search,` + `<br>` + `<em>organized.</em>`.
- CSS for `.welcome__headline em`:
  - `color: var(--indigo)`
  - `font-style: normal`
  - `position: relative`
  - `white-space: nowrap`
  - `::after` element: 12% of em height, 22% opacity, indigo, `border-radius: 999px`,
    positioned beneath the text to give the underline-glow effect.

**Expected behavior**:
- "organized." renders in indigo with a soft underline glow.
- No layout shift introduced by the `::after`.

**Constraints**:
- `prefers-reduced-motion` doesn't affect this — it's static.

**Validation**:
- Manual at desktop: headline matches design.
- `tests/components/welcome.test.js`: assert the `em` element exists with
  textContent `'organized.'`.

---

### [X] Task 14.5 — Brand block: theme-driven mark swap (`Alice_Colored` / `Alice_White`)

**Target files**:
- `src/pages/welcome/WelcomePage.js` (`renderBrand()`)
- `src/styles/main.css`

**What to do**:
Per design §4.1:

- Import both `Alice_Colored.png` (warm + white themes) and
  `Alice_White.png` (navy theme; also used by Scene 4 in 14.7).
- `renderBrand()` accepts the current theme and picks the right `src`.
- Sizes: `clamp(56px, 6vw, 84px)` on desktop, 68px on mobile (via CSS at
  `<760px`). Wordmark Sora 700, `clamp(28px, 3vw, 40px)` desktop, 32px
  mobile, `-.6px` tracking. Gap 14px desktop / 18px mobile.
- The brand element re-renders on theme change (the Tweaks store from
  Task 16.2 notifies subscribers; Phase 14 ships with the default theme).

**Constraints**:
- No inline `<style>` — all sizing via CSS.

**Validation**:
- Manual at each theme: mark swaps correctly.
- `tests/components/welcome.test.js`: assert the `<img>` `src` swaps when
  the theme tweak changes.

---

### [X] Task 14.6 — Remove floating metadata pills + "Sample data" disclaimer

**Target files**:
- `src/pages/welcome/WelcomePage.js`
- `src/styles/main.css`
- `tests/components/welcome.test.js`

**What to do**:
Per FR-020 and design (which no longer mentions these elements):

- Delete the floating metadata pills render code (24 Active / +12 This Month
  / 78% Match) and the "Sample data — illustrative only" disclaimer.
- Remove the corresponding CSS rules.
- Update `tests/components/welcome.test.js` to drop any assertions about
  these elements.

**Constraints**:
- Do not leave dead CSS classes behind.

**Validation**:
- The rendered welcome page no longer contains either element.
- `grep -n "Sample data" src/` returns no hits.

---

### [X] Task 14.7 — Mini footer (sourced from `appMeta.js`)

**Target files**:
- `src/pages/welcome/WelcomePage.js` (replace `renderFooterMeta()` or add)
- `src/styles/main.css`

**What to do**:
Per design §4.5 and FR-026:

- Import `APP_VERSION`, `ISSUE_URL`, `LICENSE_NAME`, `LICENSE_URL` from
  `src/pages/welcome/shared/appMeta.js`.
- Render four items separated by 3px round separators (35% opacity):
  - `APP_VERSION` (plain text)
  - `LICENSE_NAME` (anchor → `LICENSE_URL`, `target="_blank"`,
    `rel="noopener noreferrer"`)
  - `⊙ Report an issue` (anchor → `ISSUE_URL`)
  - `✦ Request a feature` (anchor → `ISSUE_URL`)
- Style: DM Mono 10px; hover on link items shifts color to `--indigo`.
- Position per layout (handled in Phase 16 Task 16.1): absolute bottom-left
  on diagonal / split / hero; centred bottom on centered. For Phase 14, ship
  the default (diagonal) positioning; the layout-aware variants land with
  the layout system in 16.1.

**Constraints**:
- No hard-coded `'v0.8.0'`, `'MIT'`, `'PolyForm…'`, or issue URL anywhere
  in `WelcomePage.js`.
- Links open in a new tab with `rel="noopener noreferrer"`.

**Validation**:
- `tests/components/welcome.test.js`: assert the mini-footer items match
  the values exported from `appMeta.js` and the two feedback links carry
  the correct `href` + `rel`.

---

### [X] Task 14.8 — Demo CTA placeholder (welcome page + auth modal)

**Target files**:
- `src/pages/welcome/demoStub.js` (new)
- `src/pages/welcome/WelcomePage.js` (rewire the CTA)
- `src/pages/welcome/AuthOverlay.js` (Phase 17 will wire the modal demo
  button to this same handler — leave a TODO marker until then; Phase 14
  only updates the welcome-page CTA).

**What to do**:
Per FR-023:

- `demoStub.js` exports `showDemoComingSoon()` which calls the existing
  toast (`src/components/Toast.js`) with copy like "Demo coming soon — the
  public preview lands in a later release."
- The welcome page "Try the demo" CTA renders enabled (drop the
  `disabled` attribute and the "Coming soon" tooltip from the existing
  implementation) and calls `showDemoComingSoon()` on click.
- Comment in `demoStub.js`: this file is the single call site feature 020
  will replace with the real demo-route handler. Phase 17 wires the auth
  modal demo button to the same handler.

**Constraints**:
- Use the existing Toast component; do not import a new toast library.
- No `window.alert()` fallback.

**Validation**:
- `tests/components/welcome.test.js`: clicking the welcome demo CTA calls
  `showDemoComingSoon` (mocked). Auth modal coverage lands with Phase 17.

---

## Phase 15 — Welcome refresh: Hero scenes + slideshow rebuild

> Source of visual truth: [`design/welcome_page.md`](../../design/welcome_page.md) §4.4.
> Behavior contract: spec.md FR-021.
>
> Replaces the 6-screenshot rotation from Phase 10 with four animated
> abstract scenes. The 6 PNGs stay on disk until Phase 18 Task 18.2 deletes
> them — Phase 15 just stops importing them. Scope guardrails inherit from
> Phase 14 (welcome surface only; no auth-API changes).

### [X] Task 15.1 — Implement the four hero scenes

**Target files** (all new):
- `src/pages/welcome/scenes/SceneStack.js`
- `src/pages/welcome/scenes/ScenePipeline.js`
- `src/pages/welcome/scenes/SceneProfile.js`
- `src/pages/welcome/scenes/SceneLogo.js`
- `src/styles/main.css` (scene-specific keyframes + class styles)

**What to do**:
Implement each scene per design §4.4. Each module exports
`{ mount(container, opts), unmount() }` matching the existing
`HeroSlideshow` mount contract.

- **SceneStack** — diagonal/split/hero variants render 4 tilted preview
  cards (-4° → +4°, ghost opacities 42% / 100% / 100% / 55%, 90ms stagger,
  cubic-bezier(.2,.7,.3,1.05) enter from `scale(.55) opacity(0)`). The
  `centered` variant (tablet) renders 2 flat cards in a row (`flex: 1`,
  14px gap, no rotation).
- **ScenePipeline** — single straight preview card ("J024 · UX Engineer ·
  Vertex AI", compat 94). Status badge cycles `applied → phone_screen →
  interview → assessment → offer` every 1100ms with a 0.55s pop-in
  keyframe (`pipeline-badge`). No progress pips, no `Stage N/5` caption.
- **SceneProfile** — flex column with 44px gap (parent must be
  `display: flex` for `gap` to apply). Top row: 4 stat chips
  (Total / Active / Pending / Offer, `rgba(255,255,255,.06)` bg with 1px
  hairline borders). Bottom row: 168×168 SVG donut (22px ring thickness)
  + 2-column legend. Donut animates from 0 → target `strokeDasharray`
  over 0.7s, 120ms stagger per segment. At 2700ms,
  `DONUT_INITIAL → DONUT_AFTER` swap re-allocates segments; numbers tick
  via an `AnimatedNumber` helper (700ms cubic ease-out).
- **SceneLogo** — `Alice_White.png` floating with a 6s `scene-logo-float`
  ease-in-out loop. Four `--gold` sparkle stars (corners of the logo
  box, 2.4s `scene-sparkle` scale/fade loop, 0.6s stagger). Size
  `min(360px, 70%)` aspect-ratio 1 for diagonal/split/hero;
  **fixed 200×200 for `centered`** (tablet).

All scene animations are gated behind `prefers-reduced-motion: reduce` —
when set, scenes render their final/static state.

**Constraints**:
- Each scene module owns its own DOM and animation; the slideshow
  orchestrates timing only.
- All SVG inline; no new image assets except those already imported.
- Status icon/badge styling reuses tokens from `design/tracker.md` Status
  System where possible.

**Validation**:
- `tests/pages/welcome/scenes/*.test.js` (one per scene):
  - Each scene mounts and unmounts cleanly.
  - Reduced-motion: no `setInterval` / `setTimeout` left running after
    mount.
  - Scene 2: cycles through five statuses over time (fake timers).
  - Scene 3: donut redraws when DONUT_AFTER swap fires.

---

### [X] Task 15.2 — Rebuild `HeroSlideshow.js` around the new scenes

**Target files**:
- `src/pages/welcome/HeroSlideshow.js`
- `src/styles/main.css`
- `src/pages/welcome/WelcomePage.js` (update slide-source props)

**What to do**:
- Replace the 6-screenshot rotation with a scene cycler.
- Auto-cycle 5500ms per scene, 700ms cross-fade.
- 4 bottom dots; clicking a dot jumps to that scene. The active dot
  shows a 0→1 progress bar matching scene duration.
- Accept a `heroScene` prop (`'auto' | 'stack' | 'pipeline' | 'profile'
  | 'logo'`); when non-`auto`, pin to that single scene and disable
  rotation.
- `prefers-reduced-motion: reduce` → render scene 1 (`stack`) only,
  static, with no progress bar and no dot controls.
- Reduced-motion path bypasses scene-internal animations too (delegated
  to each scene module).

**Constraints**:
- The four scene modules from Task 15.1 are the only allowed slide
  content.
- Do not import `welcome-hero/*.png` anywhere — those imports are removed
  in Task 18.2.

**Validation**:
- `tests/pages/welcome/heroSlideshow.test.js` (rewrite):
  - Auto-cycles through 4 scenes over time (fake timers).
  - `heroScene='pipeline'` pins to scene 2.
  - Clicking a dot jumps to that scene and resets the progress bar.
  - Reduced-motion: scene 1 only, no timers.

---

---

## Phase 16 — Welcome refresh: retired Tweaks system + layout modes + theme variants

> **Superseded 2026-05-17**: the floating Tweaks panel, `tweaksStore`, and
> layout/theme/copy/auth/scene URL-param overlay were removed from production
> as prototype-only controls. The historical Phase 16 tasks below remain for
> audit history only; current production must not render the panel.

> Source of visual truth: [`design/welcome_page.md`](../../design/welcome_page.md) §3 (layouts), §5 (tweaks).
> Behavior contract: spec.md FR-022.
>
> Three concerns landed in one phase because they're tightly coupled: the
> Tweaks store drives layout + theme class application, and the panel UI
> exposes those switches. Phase 16 must NOT regress Phase 14 / Phase 15
> defaults (`layout: diagonal`, `theme: warm`, `heroScene: auto` produces
> the same render as before).

### [X] Task 16.1 — Implement the four layout modes

**Target files**:
- `src/pages/welcome/WelcomePage.js`
- `src/styles/main.css`

**What to do**:
Per design §3.1–§3.2, apply layout via a CSS class on the welcome root:

- `.welcome--layout-diagonal` (default) — pitch column `position: relative;
  z-index: 2; width: 55%; max-width: 760px; padding: 6vw 5vw 6vw 6vw`.
  Preview slab `position: absolute; inset: 0; left: auto; width: 62%`;
  `clip-path: polygon(22% 0, 100% 0, 100% 100%, 6% 100%)`. Slab background
  `--navy` (or `--navy-deep` on navy theme).
- `.welcome--layout-split` — straight 55/45 vertical split, no diagonal.
- `.welcome--layout-centered` — pitch centred top, preview as a 280px-tall
  horizontal band beneath; also auto-applied at tablet width (760–1099px)
  regardless of Tweaks selection.
- `.welcome--layout-hero` — pitch overlays a full-bleed preview that
  gradient-fades into the page.

Mini footer position varies by layout (absolute on diagonal/split; bottom-
centred full-width on centered).

**Constraints**:
- A single root element gets the layout class; sub-elements adapt via
  selectors.
- Mobile (`<760px`) ignores all layout classes — the `.welcome--mobile`
  class from 14.11 wins.

**Validation**:
- Manual at each layout × theme combination — record any visual delta
  against the design in the Phase 14 PR description.

---

### [X] Task 16.2 — Tweaks store + URL-param overlay

**Target files**:
- `src/pages/welcome/tweaks/tweaksStore.js` (new)
- `src/pages/welcome/WelcomePage.js` (subscribe + apply tweaks)

**What to do**:
Implement a small pub/sub store mirroring `src/data/authStore.js`:

```js
const TWEAK_DEFAULTS = Object.freeze({
  layout: 'diagonal',
  theme: 'warm',
  copyIntensity: 'none',
  authState: 'signin',
  heroScene: 'auto',
});
const ALLOWED = {
  layout: ['diagonal', 'split', 'centered', 'hero'],
  theme: ['warm', 'white', 'navy'],
  copyIntensity: ['none', 'minimal', 'pitch'],
  authState: ['signin', 'signup'],
  heroScene: ['auto', 'stack', 'pipeline', 'profile', 'logo'],
};

// At init: read window.location.search; for each known key with a value in ALLOWED, overlay onto defaults.
```

API:
- `getTweaks()` → current snapshot
- `setTweak(key, value)` → validated set + notify
- `subscribe(fn)` → unsubscribe

Apply to the welcome root in `WelcomePage.js`:
- `theme` and `layout` map to CSS classes
  (`welcome--theme-${theme}`, `welcome--layout-${layout}`)
- `copyIntensity` maps to `welcome--copy-${value}`
- `heroScene` passes to `HeroSlideshow`
- `authState` passes to `AuthOverlay` (when mounted)

**Constraints**:
- **No persistence** — do not write to `localStorage` or cookies.
- Validation: invalid query-string values are ignored and the default
  retained.
- Module-level state; single instance per page.

**Validation**:
- `tests/pages/welcome/tweaks/tweaksStore.test.js` (new):
  - Defaults match design §5.
  - URL `?layout=centered&theme=navy` overlays correctly.
  - Invalid value (`?layout=spinny`) ignored.
  - `setTweak` notifies subscribers.

---

### [X] Task 16.3 — Tweaks panel UI

**Target files**:
- `src/pages/welcome/tweaks/TweaksPanel.js` (new)
- `src/styles/main.css`
- `src/pages/welcome/WelcomePage.js` (mount the panel)

**What to do**:
Implement a floating control panel per design §5:

- Toggle button (`◆` glyph, ~32×32) anchored to the top-right of the
  viewport. Hidden at `<760px` (mobile).
- Clicking the toggle opens a small panel with one labeled select per
  tweak key.
- Each select reflects `getTweaks()` and calls `setTweak(key, e.target.value)`
  on change.
- Pressing Escape or clicking outside closes the panel.
- z-index above the welcome chrome but below the auth modal.

**Constraints**:
- Implementation uses the same DOM utilities as the rest of the project
  (no framework).
- The panel is part of the production bundle (user decision); keep its
  CSS minimal so it doesn't bloat first paint.
- Do not auto-open on first load.

**Validation**:
- `tests/pages/welcome/tweaks/tweaksPanel.test.js` (new):
  - Renders with all five selects at desktop width.
  - Not in DOM at width 700 (mobile).
  - Changing a select calls `setTweak` with the right key/value.
  - Escape closes the panel.

---

---

## Phase 17 — Welcome refresh: Auth Modal restyle

> Source of visual truth: [`design/welcome_page.md`](../../design/welcome_page.md) §4.6.
> Behavior contract: spec.md FR-024.
>
> Drops the existing tab strip, applies the new 440px shell + overlay, adds
> the in-modal demo button (wired to the Phase 14 `showDemoComingSoon()`
> stub) + "or" divider + swap-mode link + legal copy on signup. Auth logic
> is unchanged.

### [X] Task 17.1 — Restyle Auth Modal (was `AuthOverlay`) to the new design

**Target files**:
- `src/pages/welcome/AuthOverlay.js`
- `src/pages/welcome/LoginForm.js`
- `src/pages/welcome/SignupForm.js`
- `src/styles/main.css`

**What to do**:
Per design §4.6 and FR-024:

- Overlay: `rgba(8,8,24,.55)` + `backdrop-filter: blur(6px)`.
- Modal: 440px max-width, 14px radius, white surface,
  `box-shadow: 0 12px 40px rgba(26,26,46,.22)`.
- Header: 40px Alice logo + title + close button.
- Body (`signin` mode): email → password. **No "Forgot?" link** — the
  design's `Forgot?` affordance is **out of scope for Phase 14** because
  (a) 018 spec mandates "no custom in-app reset UI" and (b) Phase 14
  forbids new auth-API call sites. Password reset stays operator-driven
  (the operator triggers reset from the Supabase dashboard). When the
  user-base grows past the allowlisted operator-managed model, add the
  Forgot link as a follow-up feature that wires `supabase.auth.resetPasswordForEmail`
  with a defined redirect URL. Track this as a non-blocking divergence
  from `design/welcome_page.md` §4.6 in the PR description.
- Body (`signup` mode): email → password (no name field).
- Footer: primary submit button → `or` text divider → demo button (warm
  fill, green pulse dot, click fires the demo-coming-soon toast) → swap-
  mode link ("Don't have an account? Create one" / "Already have one?
  Sign in") → legal copy on signup only ("By creating an account, you
  agree to…").
- Mode swap is in-place — overlay does not remount, focus does not leave
  the modal, the entered email persists across the swap (this is already
  done in the existing implementation; preserve it).
- Subscribe to `tweaksStore` for `authState` — the Tweaks panel can drive
  the open mode directly.

**Constraints**:
- Do not add a name field to `SignupForm`.
- Do not call any new auth API.
- Preserve focus trap, ESC-to-close, backdrop-click-to-close,
  previous-focus restoration.

**Validation**:
- Extend `tests/components/welcome.test.js`:
  - Modal width / radius / overlay rgba match.
  - Signin mode has "Forgot?" link; signup mode does not.
  - Signup form has no name input.
  - Demo button inside the modal triggers the toast helper.
  - Swap-mode link preserves email value.

---

---

## Phase 18 — Welcome refresh: Mobile branch + asset cleanup + test rewrite + cross-check

> Source of visual truth: [`design/welcome_page.md`](../../design/welcome_page.md) §3.3.
> Behavior contract: spec.md FR-025 + FR-020 closure.
>
> Closes out the welcome refresh: the `<760px` portrait-stack branch lands
> alongside the deletion of the six `welcome-hero/*.png` files, a full
> rewrite of `tests/components/welcome.test.js`, and a final spec/design
> cross-check.

### [X] Task 18.1 — Mobile responsive branch (`<760px`)

**Target files**:
- `src/pages/welcome/WelcomePage.js`
- `src/styles/main.css`

**What to do**:
Per design §3.3 and FR-025, implement the mobile portrait stack as a
viewport branch inside `WelcomePage.js`:

- `matchMedia('(max-width: 759px)')` attaches a listener at mount; toggles
  `.welcome--mobile` on the root.
- Mobile rules (CSS scoped under `.welcome--mobile`):
  - Container: `width: 100%; height: 100%; background: var(--warm);
    display: flex; flex-direction: column; padding: 96px 28px 56px`.
  - Brand stack: left-aligned column, `gap: 18px`. Logo
    `Alice_Colored.png` 68×68. Wordmark Sora 700 / 32 / `-.6px` tracking.
  - Headline: 38 / `-1.2px` / line-height 1.04 / `text-wrap: balance`.
    `<em>organized.</em>` keeps the same indigo + underline-glow.
  - CTA group: `margin-top: auto`. Buttons full-width, 12px radius,
    `16px / 20px` padding, 15px font, vertical stack with 10px gap.
    Pulsing green dot on the "Try the demo" button (`mw-pulse` 1.8s
    infinite).
  - **Hide**: hero slideshow, mini footer, Tweaks panel toggle.
- Tweaks panel does not affect mobile; layout is fixed.

**Constraints**:
- No separate page module — this is the same `WelcomePage.js`.
- Keep the auth flow available on mobile (clicking Sign In / Create
  Account still opens the Auth Modal).

**Validation**:
- Manual at 360px, 414px, and 759px viewports: stack renders per design.
- `tests/components/welcome.test.js`: mount with width 700, assert
  slideshow is not present and the Tweaks panel toggle is not rendered.

---

### [X] Task 18.2 — Asset cleanup: remove `welcome-hero/*.png`

**Target files**:
- `src/assets/welcome-hero/*.png` (delete)
- `src/pages/welcome/WelcomePage.js` (drop unused imports)
- `docs/REPO_MAP.md` (remove the directory entry added in Phase 11.5;
  defer the docs edit to Phase 19.3 if cleaner)

**What to do**:
After Tasks 15.1–15.2 land, the six hero screenshots are no longer
referenced. Delete them and any orphan import statements. Verify
`npm run build` still succeeds.

**Constraints**:
- Use `git rm` (or VSCode/Explorer delete) for tracked files so the
  deletion is captured in the next commit.
- Do not delete `Alice_White.png` (still used by Scene 4 and by the
  Navbar / Footer).

**Validation**:
- `grep -rn "welcome-hero" src/` returns no hits.
- `npm run build` succeeds; bundle size shrinks.

---

### [X] Task 18.3 — Test pass: rewrite `tests/components/welcome.test.js`

**Target file**: `tests/components/welcome.test.js`

**What to do**:
- Drop assertions about the removed elements (floating pills, disclaimer,
  product screenshots, char-count truncation, disabled demo CTA).
- Add assertions for the new structure (per Tasks 14.4 / 14.5 / 14.7 /
  17.1 / 14.8 / 18.1).
- Tweaks panel + tweaks store get their own test files (Tasks 16.2–16.3).

**Validation**:
- `npm run test:run -- tests/components/welcome.test.js` passes.
- Full `npm run test:run` still green.

---

### [X] Task 18.4 — Spec/design cross-check

**Target files** (read-only sweep):
- `design/welcome_page.md`
- `specs/018-auth-user-access/spec.md` (FR-020 through FR-026)
- `specs/018-auth-user-access/plan.md` §14.A–§14.F

**What to do**:
After Phases 14–18 land (Tasks 14.1–18.3):

1. Walk every requirement in FR-020 through FR-026 and confirm there's a
   corresponding code change.
2. Walk every section in `design/welcome_page.md` (purpose, tokens,
   layouts, components, tweaks, behaviour, assets) and confirm the code
   matches — or note the divergence in the PR description.
3. Confirm the four resolved divergences in the design's "Implementation
   note" header (license, version source, demo placeholder, name field)
   are honored in code.

**Out of scope**:
- Re-running the full test suite or build assertion — owned by Phase 19
  (Release Prep) and Phase 20 (Smoke Test).

---

## Phase 19 — Release Prep Redo (v0.8.1)

> Runs once Phases 13 through 18 are all implementation-complete. Bundles
> a single CHANGELOG entry + version bump for the tracker chrome refresh
> (Phase 13) and the full welcome refresh (Phases 14–18).

### [X] Task 19.1 — Bump version to `0.8.1`

**Target files**:
- `package.json`
- `src/components/Footer.js` (`APP_VERSION`)

**What to do**: bump `0.8.0` → `0.8.1` (SemVer patch — UI-only, no API or
schema change). Run `npm install` so `package-lock.json` resyncs. Update
the "Built …" date string in the footer if stale.

**Validation**:
- `grep -n "0\.8\.0" package.json src/` returns no matches outside
  CHANGELOG.
- `npm run test:run` still green.

---

### [X] Task 19.2 — `CHANGELOG.md` entry for 0.8.1

**Target file**: `CHANGELOG.md`

**What to do**:
Add a `## [0.8.1] — <merge-date>` section above `[0.8.0]`. Group entries
under **Changed** (Tracker chrome unification, identity cluster polish,
mobile bottom tab bar + FAB, fold-narrow breakpoint, welcome-page polish
from Phase 14) and **Fixed** (anything Phase 14 surfaces as a bug). No
**Added** / **Security** / **Removed** sections expected — this is pure
UI polish on top of v0.8.0.

**Validation**: section parses by eye; Keep-a-Changelog ordering preserved.

---

### [X] Task 19.3 — Docs sweep

**Target files**:
- `README.md` (only if Phase 13/14 changed user-visible behavior — likely
  a no-op)
- `docs/REPO_MAP.md` (add `src/components/BottomTabBar.js`, `Fab.js`, and
  any other new files from Phase 13/14)
- `docs/deployment.md` (no-op expected; UI-only)

**Validation**: cross-references resolve; new paths exist.

---

## Phase 20 — UI-Only Browser Smoke Test

> Constitution Amendment 1.3.0: Browser Smoke Test is the final phase and
> must run against the to-be-merged state. Scope here is limited to the
> UI surfaces touched by Phases 13 through 18 (functionality was already
> validated in Phase 12 for v0.8.0).

### [X] Task 20.1 — Walk the UI-affected acceptance paths

**What to do**: in a live browser session against the merge-state build,
exercise the chrome surfaces:

- [X] **Desktop ≥ 1024px** — top bar identity cluster renders email
  (truncated at 220px CSS) + door-arrow sign-out button; clicking
  sign-out clears state and routes to welcome.
- [X] **Tablet 640–1023px** — same as desktop; toolbar chips remain
  readable on the navy band.
- [X] **Mobile ≤ 639px** — bottom tab bar visible; top-bar page nav hidden;
  sign-out collapses to icon-only; email hidden; "+ New application"
  hidden; FAB visible above the tab bar; tapping the FAB opens the
  Create-mode detail modal.
- [X] **Fold-narrow < 380px** — "Project Alice" wordmark hidden; logo
  mark + sign-out icon remain.
- [X] **Sign-out behavior** — clicking sign-out from any viewport fires
  the toast and returns the app to the welcome page (US3 chrome path).
- [X] **Unauthenticated path** — visit the Tracker URL while signed out
  in a hosted preview; confirm the welcome page renders (US4 chrome path).
- [X] **Welcome — desktop diagonal** — open the welcome page at ≥ 1100px;
  confirm the diagonal split, indigo "organized." underline-glow, four-
  scene slideshow auto-cycle, dot navigation + progress bar, and the
  mini footer's version / PolyForm link / Report-issue / Request-feature
  links all match design.
- [X] **Welcome — Tweaks panel** — toggle the Tweaks panel; cycle each
  control (`layout`, `theme`, `copyIntensity`, `authState`, `heroScene`)
  and confirm the page responds without errors. Load
  `?layout=centered&theme=navy&heroScene=pipeline` and confirm the URL
  overlay applies.
- [X] **Welcome — tablet centered** — at 900px width, confirm the
  layout collapses to the centered preset with the 280px preview band;
  scene-1 renders as 2 flat cards, scene-4 logo is fixed 200×200.
- [X] **Welcome — mobile portrait stack** — at 360px width, confirm:
  no slideshow, no Tweaks panel, brand stack left-aligned with
  `Alice_Colored.png` 68×68, full-width CTAs with the green pulsing dot
  on Try the demo, headline at 38px with "organized." glow.
- [X] **Welcome — Try the demo placeholder** — click Try the demo on
  desktop, tablet, mobile, and inside the Auth Modal; each click
  surfaces the "Demo coming soon" toast and does not navigate.
- [X] **Welcome — Auth Modal restyle** — open the modal in `signin` and
  `signup`; confirm 440px max-width, white surface, "Forgot?" link in
  signin only, no name field in signup, in-place mode swap preserves
  the email value, ESC + backdrop + close button all dismiss, focus
  returns to the originating CTA.

Mark each path complete in the PR description. Functional smoke
(US1/US2/US5) is **not** repeated — those were validated in Phase 12 and
the underlying code is unchanged.

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
