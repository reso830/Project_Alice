# Tasks: Supabase Persistence for Hosted Mode (019)

**Spec**: `specs/019-supabase-persistence/spec.md`
**Plan**: `specs/019-supabase-persistence/plan.md`
**Branch**: `019-supabase-persistence`

---

## Phase Map

| Phase | Theme | Blocks |
|---|---|---|
| 01 | Foundation: `demo` runtime + `DemoRepositoryNotImplementedError` + Supabase schema migration applied to project | All other phases |
| 02 | Per-request Supabase client factory | 03, 04, 06, 07 |
| 03 | Supabase applications adapter | 05 |
| 04 | Supabase profile adapter | 05 |
| 05 | Dispatcher: route `hosted` → Supabase adapters (replace 017 stub) | 06, 07 |
| 06 | Boot-time schema check (`assertHostedSchema`) | 07 |
| 07 | Seed middleware (`seedHostedUserIfNeeded`) | 08 |
| 08 | Regression + integration verification (SQLite untouched + manual quickstart smoke) | 09 |
| 09 | Release Prep — version bump, CHANGELOG, README, deployment doc, REPO_MAP | 10 |
| 10 | Browser Smoke Test — walk each user story's Independent Test against the merged state | Merge |

Phases 01 and 02 are independent and can be done in parallel. Phases 03 and 04
both depend on 02 and can be done in parallel. Phase 05 is the wiring gate —
nothing hosted works end-to-end until 05 lands. Phases 06 and 07 can be done in
parallel after 05. Phase 08 is the regression gate before docs.

This feature has user-visible behavior in hosted mode (seeded data, persistent
profile, login wall) but introduces **no frontend code changes**. Browser Smoke
Test exercises the hosted flow through the existing 018 UI; it is mandatory per
constitution Amendment 1.3.0 because the feature has user-facing behavior, even
though no UI files are modified.

---

## Phase 01 — Foundation

### [X] Task 01.1 — Extend `server/config.js` to accept `demo` runtime

**Target file**: `server/config.js`

**What to do**:
Extend `VALID_RUNTIMES` to include `'demo'`:

```js
const VALID_RUNTIMES = ['local', 'hosted', 'demo'];
```

Export `isDemo` on the frozen config object alongside `isHosted`:

```js
return Object.freeze({
  runtime,
  isHosted: runtime === 'hosted',
  isDemo:   runtime === 'demo',
  // …existing fields…
});
```

`config.supabase` remains the same shape — null for both `local` and `demo`;
populated only for `hosted`. The 017 `HOSTED_REQUIRED` env-var check fires
only when `runtime === 'hosted'`; demo mode requires no Supabase env vars at
startup.

**Expected behavior**:
- `APP_RUNTIME=local` → unchanged behavior.
- `APP_RUNTIME=hosted` → unchanged behavior, plus same env-var requirements.
- `APP_RUNTIME=demo` → loads without requiring any Supabase env vars;
  `config.isDemo === true` and `config.supabase === null`.
- `APP_RUNTIME=anything-else` → still rejected by the existing validation.

**Constraints**:
- Do not introduce new env vars.
- Do not change the shape of `config.supabase`.
- Do not import `@supabase/supabase-js` in this file.

**Validation**:
- `tests/server/config.test.js` (extend): asserts `demo` is accepted; asserts
  `isDemo` flag flips correctly; asserts demo mode does not require any of
  the 017 hosted env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`). 018 settled on JWKS-based JWT verification
  so there is no `SUPABASE_JWT_SECRET` to gate on.

**Out of scope**:
- Dispatcher wiring for the demo mode (handled in Task 01.2).
- Any frontend awareness of demo mode (deferred to feature 020).

---

### [X] Task 01.2 — Add `DemoRepositoryNotImplementedError` and demo stub factory

**Target file**: `server/repositories/index.js`

**What to do**:
Add a new error class and stub factory immediately after the existing
`HostedRepositoryNotImplementedError` block:

```js
export class DemoRepositoryNotImplementedError extends Error {
  constructor(repositoryName) {
    super(
      `Demo persistence is not yet implemented for: ${repositoryName}. ` +
        'See feature 020.',
    );
    this.name = 'DemoRepositoryNotImplementedError';
  }
}

function createDemoStub(name) {
  const notImplemented = () => {
    throw new DemoRepositoryNotImplementedError(name);
  };
  return {
    getAll: notImplemented,
    getById: notImplemented,
    create: notImplemented,
    update: notImplemented,
    archive: notImplemented,
    get: notImplemented,
    upsert: notImplemented,
  };
}
```

Extend `createRepositories(config)` with a `demo` branch:

```js
if (config.isDemo) {
  return {
    applications: createDemoStub('applications'),
    profile:      createDemoStub('profile'),
  };
}
```

Keep the existing `config.isHosted → createHostedStub(...)` branch in place —
it will be replaced in Phase 05.

**Expected behavior**:
- `createRepositories({ isDemo: true })` returns an object whose every method
  throws `DemoRepositoryNotImplementedError` with a message referencing
  feature 020.
- Local and hosted branches are byte-equivalent to pre-019.

**Constraints**:
- Do not lazy-import any Supabase module here — the demo stub is pure JS.
- Do not branch on `config.runtime` directly; use the boolean flags
  (`isDemo`, `isHosted`) for consistency with the existing hosted branch.

**Validation**:
- `tests/server/repositories/stubs.test.js` (extend): assert that
  `createDemoStub('applications').getAll()` throws
  `DemoRepositoryNotImplementedError` with the expected message;
  `applications` and `profile` factory selection happens correctly when
  `config.isDemo` is true.
- Add `tests/server/repositories/dispatcher.test.js` (new): assert all three
  runtime branches (`local` → SQLite, `hosted` → stub, `demo` → demo stub).

**Out of scope**:
- Replacing the hosted stub with the real Supabase adapters (Phase 05).
- Importing or testing `@supabase/supabase-js` here.

---

### [X] Task 01.3 — Apply the Supabase schema migration to the hosted project

> **Closed 2026-05-17** by operator during Task 08.2 manual smoke. The
> migration was applied to the live Supabase project via the SQL Editor.
> Three schema-shape bugs surfaced during smoke (uuid id → bigint
> identity; timestamptz audit columns → date; `CREATE TABLE IF NOT
> EXISTS` to handle 017's never-applied schema). All three resolved
> in-session and back-ported into [data-model.md §5](data-model.md);
> the canonical SQL there is the corrected idempotent form.

**Target**: Supabase dashboard SQL editor, against the operator's hosted
Supabase project. **No file in the repo changes** — this task is the operator
workflow.

**What to do**:
Paste the entire SQL block from [data-model.md §5](data-model.md) into the
Supabase SQL editor and run it. The block:

- TRUNCATEs `applications` and `profile` (destructive — per 018's *Accepted
  Limitations* and 019 spec FR-009).
- Adds `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  to `applications` and `profile`, with `applications_user_id_idx` and the
  `profile_user_id_unique` constraint.
- Creates the `user_seed_state` table.
- Enables RLS on all three tables and creates the policies described in
  [data-model.md §2](data-model.md).
- Creates the `public.claim_and_seed_starter()` RPC used by the seed
  middleware (Task 07.1).

After running, verify via the dashboard:
- All three tables have the RLS toggle visible.
- 4 + 4 + 2 policies exist (applications, profile, user_seed_state).
- The `claim_and_seed_starter` function appears under Database → Functions
  with return type `boolean`.

**Column type verification (required before applying the seed)**:
Before running the SQL block, inspect via the Supabase dashboard (Table
Editor → applications) the actual column types of `application_date` and
`last_status_update` on the hosted `applications` table:

- If both are **DATE**: the SQL block in data-model.md §5 works as written
  (the seed RPC inserts `::date` values directly; PostgREST serializes
  them as `YYYY-MM-DD` strings to the frontend).
- If either is **TEXT**: PostgreSQL still coerces the `::date` value to
  text on INSERT, but the seed RPC's behavior is now type-implicit. Add
  an `ALTER TABLE applications ALTER COLUMN application_date TYPE date
  USING application_date::date` (and same for `last_status_update`) to
  the migration block before §5.5 to normalize. Update
  [data-model.md §5](data-model.md) accordingly with the normalization
  step.

Note the observed types in the operator setup log for posterity.

**Expected behavior**:
- A direct PostgREST anon-key probe to
  `…/rest/v1/applications?select=user_id&limit=0` returns 200.
- Same for `…/rest/v1/profile?select=user_id&limit=0` and
  `…/rest/v1/user_seed_state?select=user_id&limit=0`.

**Constraints**:
- The SQL must be applied to **every** Supabase environment that runs
  hosted mode (staging, production). The boot check (Phase 06) refuses to
  serve until the migration is applied.
- Pre-existing hosted data is destroyed. Confirm with the operator before
  running in production.

**Validation**:
- Manual: the operator confirms in their setup notes that all three probes
  return 200. Recorded in the quickstart §2 sign-off.
- Once Phase 06 ships, the server's startup log surfaces the result
  automatically.

**Out of scope**:
- Any application code changes — this is operator workflow only.
- Down-migration / rollback tooling (not shipped; see
  [research.md R-9](research.md)).

---

## Phase 02 — Per-Request Supabase Client Factory

### [X] Task 02.1 — Create `server/repositories/supabase/client.js`

**Target file**: `server/repositories/supabase/client.js` (new)

**What to do**:
Implement and export `createSupabaseClientForRequest(req)` per the contract
in [contracts/api.md §3](contracts/api.md):

- Read `req.headers.authorization`; throw if absent.
- Construct a fresh `@supabase/supabase-js` client with:
  - `SUPABASE_URL` and `SUPABASE_ANON_KEY` from `process.env`.
  - `global.headers.Authorization` set to the incoming bearer header.
  - `auth.persistSession: false` and `auth.autoRefreshToken: false`.
- Return the client. Do not cache.

**Expected behavior**:
- Calling the factory with a request bearing a valid `Authorization: Bearer
  <jwt>` header returns a Supabase client whose subsequent
  `client.from(...)` queries run under the supplied JWT.
- Calling without the header throws.

**Constraints**:
- No singleton, no module-level state.
- Do not validate the JWT here — 018's `requireAuth` middleware is
  responsible for that and must run before this factory.
- Do not read `SUPABASE_SERVICE_ROLE_KEY` here.

**Validation**:
- `tests/server/repositories/supabase/client.test.js` (new): assert factory
  constructs a client with the expected headers (mock `createClient`);
  assert throw on missing `Authorization`.

**Out of scope**:
- Attaching the client to `req` (deferred to Phase 05 once the dispatcher
  wires hosted requests through it).

---

## Phase 03 — Supabase Applications Adapter

### [X] Task 03.1 — Decide column-list constant location

**Target file**: `server/db/columns.js` (new) **or** inline within
`server/repositories/supabase/applications.js` and
`server/repositories/supabase/profile.js`.

**What to do**:
Inspect [server/db/applications.js](../../server/db/applications.js) and
[server/db/profile.js](../../server/db/profile.js) for the full
SQLite column list. Decide whether to:

- (a) Create a shared `server/db/columns.js` exporting
  `APPLICATION_COLUMNS_WITHOUT_USER_ID` and `PROFILE_COLUMNS_WITHOUT_USER_ID`
  arrays, imported by both SQLite (for parity assertions in tests) and
  Supabase adapters, **or**
- (b) Inline the column arrays inside each Supabase adapter file with an
  exported constant per module.

Default per [research.md "Open Items"](research.md): option (a), shared module.

**Expected behavior**:
- The exported constant lists every column the SQLite adapter currently
  returns to route handlers, **excluding** `user_id`.

**Constraints**:
- The constant must be the single source of truth. SQLite + Supabase outputs
  must have the same keys.

**Validation**:
- Type-check / smoke test in `tests/server/repositories/columns.test.js`
  (new, if option (a)): assert the constant matches the keys returned by
  the existing SQLite repository fixtures.

**Out of scope**:
- Refactoring the SQLite adapter — only the new Supabase adapter must
  consume the constant. SQLite can keep its existing `SELECT *`/explicit
  list unchanged; the test asserts parity, not enforces it.

---

### [X] Task 03.2 — Implement `createSupabaseApplicationsRepository(client, userId)`

**Target file**: `server/repositories/supabase/applications.js` (new)

**What to do**:
Implement the adapter per [contracts/api.md §2.1–2.5](contracts/api.md).
Export a factory `createSupabaseApplicationsRepository(client, userId)`
returning `{ getAll, getById, create, update, archive }` where:

- `getAll()` issues `client.from('applications').select(<columns>)
  .eq('user_id', userId).order('created_at', { ascending: false })`. Returns
  the array (empty if no rows).
- `getById(id)` issues `.select(<columns>).eq('id', id).eq('user_id', userId)
  .maybeSingle()`. Returns null on no row.
- `create(input)` strips any `user_id` from input, calls `.insert({
  ...sanitized, user_id: userId }).select(<columns>).single()`.
- `update(id, input)` strips `user_id`, calls `.update(sanitized)
  .eq('id', id).eq('user_id', userId).select(<columns>).maybeSingle()`.
  Returns null on no row.
- `archive(id)` is a thin wrapper that calls `update(id, { archived: 1 })`.
- All methods throw on PostgREST `error`.

**Expected behavior**:
- Each method's PostgREST chain matches the contract exactly.
- `user_id` is never present on returned objects.
- Any `user_id` in input is silently discarded.

**Constraints**:
- Do not import `db.js` or anything SQLite-adjacent.
- Do not validate inputs — validation stays in the route layer
  (`server/validation/application.js`).
- Do not log JWT or tokens.

**Validation**:
- `tests/server/repositories/supabase/applications.test.js` (new): mock
  `@supabase/supabase-js` at the module boundary; assert the call chain for
  each method; assert returned shape excludes `user_id`; assert input
  `user_id` is stripped before insert/update.

**Out of scope**:
- Dispatcher wiring (Phase 05).
- RLS behavior (validated manually against a real Supabase project in
  Phase 08).

---

## Phase 04 — Supabase Profile Adapter

### [X] Task 04.1 — Implement `createSupabaseProfileRepository(client, userId)`

**Target file**: `server/repositories/supabase/profile.js` (new)

**What to do**:
Implement the adapter per [contracts/api.md §2.6–2.7](contracts/api.md).
Export a factory `createSupabaseProfileRepository(client, userId)` returning
`{ get, upsert }` where:

- `get()` issues `client.from('profile').select(<columns>).eq('user_id',
  userId).maybeSingle()`. Returns `null` on no row.
- `upsert(input)` strips any `user_id`, calls
  `.upsert({ ...sanitized, user_id: userId }, { onConflict: 'user_id' })
  .select(<columns>).single()`.
- All methods throw on PostgREST `error`.

**Expected behavior**:
- One row per user is enforced by the `UNIQUE (user_id)` constraint plus
  `onConflict: 'user_id'`.
- `user_id` is never present on returned objects.
- Any `user_id` in input is silently discarded.

**Constraints**:
- Same as Task 03.2.

**Validation**:
- `tests/server/repositories/supabase/profile.test.js` (new): mock
  `@supabase/supabase-js`; assert call chain; assert one-row-per-user
  semantics under simulated UNIQUE conflict.

**Out of scope**:
- Same as Task 03.2.

---

## Phase 05 — Dispatcher Wiring

### [X] Task 05.1 — Convert dispatcher to uniform `forRequest(req)` contract across all three runtimes

**Target files**: `server/repositories/index.js`,
`server/routes/applications.js`, `server/routes/profile.js`,
`server/routes/resume.js` (if it consumes repositories).

**What to do**:
Convert `createRepositories(config)` so **all three runtime branches return
the same shape** — an object with a single `forRequest(req)` method.
Route handlers always call `req.repositories.forRequest(req)` to obtain
the per-request repository bundle; there is no shape branch based on
runtime. See [contracts/api.md §1.1](contracts/api.md) for the canonical
contract.

```js
export async function createRepositories(config) {
  if (config.isDemo) {
    const demo = {
      applications: createDemoStub('applications'),
      profile:      createDemoStub('profile'),
    };
    return { forRequest(_req) { return demo; } };
  }

  if (config.isHosted) {
    const [
      { createSupabaseClientForRequest },
      { createSupabaseApplicationsRepository },
      { createSupabaseProfileRepository },
    ] = await Promise.all([
      import('./supabase/client.js'),
      import('./supabase/applications.js'),
      import('./supabase/profile.js'),
    ]);

    return {
      forRequest(req) {
        const client = createSupabaseClientForRequest(req);
        const userId = req.user.id;
        return {
          applications: createSupabaseApplicationsRepository(client, userId),
          profile:      createSupabaseProfileRepository(client, userId),
        };
      },
    };
  }

  // Local mode (default).
  const { db, initSchema } = await import('../db.js');
  initSchema(db);
  const sqlite = await createTestRepositories(db);
  return { forRequest(_req) { return sqlite; } };
}
```

**Router factory signature change** (the live 018 routes inject a static
`repo` at app-creation: `createApplicationsRouter({ repo, requireAuth })`
in [server/routes/applications.js:40](../../server/routes/applications.js)
and the matching `createProfileRouter`). With the uniform `forRequest(req)`
shape, the static `repo` must become per-request. The cleanest pattern
that preserves 018's factory-injection style:

1. Each router factory now accepts the **dispatcher** (`repos`), not a
   static repo. Add a tiny `withRepos(repos)` middleware that runs
   inside the factory after `requireAuth`:

   ```js
   // shared helper, e.g. server/repositories/middleware.js (new)
   export function attachRepos(repos) {
     return (req, _res, next) => {
       req.repos = repos.forRequest(req);
       next();
     };
   }

   // server/routes/applications.js — factory signature change
   export function createApplicationsRouter({ repos, requireAuth } = {}) {
     const router = Router();
     router.post('/', requireAuth, attachRepos(repos), (req, res) => {
       const record = req.repos.applications.create(result.data);
       // …
     });
     // …same shape for GET, PUT, DELETE
   }
   ```

2. `server/index.js` `createApp({ repositories, config, requireAuth })`
   passes `repositories` (the dispatcher) into each router factory under
   the `repos` key instead of pre-extracting `repositories.applications`:

   ```js
   // Before:
   //   createApplicationsRouter({ repo: repositories.applications, requireAuth })
   // After:
   //   createApplicationsRouter({ repos: repositories, requireAuth })
   ```

3. **Convert every protected route handler to `async`** and `await`
   every repository call. The Supabase adapters return Promises (see
   [contracts/api.md §1.2](contracts/api.md)); the live SQLite adapters
   return values synchronously, but JS's `await` on a non-Promise value
   is a no-op, so making the handlers async is safe for both backends.

   Concretely:

   ```js
   // BEFORE (server/routes/applications.js — current 018 code):
   router.post('/', (req, res, next) => {
     try {
       // …validation…
       const record = repo.create(result.data);
       return res.status(201).json({ data: record });
     } catch (error) {
       return next(error);
     }
   });

   // AFTER (019):
   router.post('/', requireAuth, attachRepos(repos), seed, async (req, res, next) => {
     try {
       // …validation…
       const record = await req.repos.applications.create(result.data);
       return res.status(201).json({ data: record });
     } catch (error) {
       return next(error);
     }
   });
   ```

   Every handler in
   [server/routes/applications.js](../../server/routes/applications.js)
   that touches the repository (`POST /`, `GET /`, `GET /:id`,
   `PATCH /:id`, `POST /:id/archive`) must be converted. Same for
   [server/routes/profile.js](../../server/routes/profile.js)
   (`GET /`, `PUT /`).

   **Critical**: the `PATCH /:id` handler's status-transition check at
   [applications.js:111-132](../../server/routes/applications.js#L111-L132)
   reads `currentRecord.status` after calling `repo.getById(id)`. The
   `await` must wrap that call too, otherwise `currentRecord` would be
   a Promise and `TERMINAL_STATES.has(currentRecord.status)` would
   silently always be `false`, allowing forbidden status transitions
   to slip through validation:

   ```js
   // Inside PATCH /:id, after schema validation:
   if (result.data.status !== undefined) {
     const currentRecord = await req.repos.applications.getById(id);
     if (!currentRecord) return sendNotFound(res);
     // …existing TERMINAL_STATES + isValidTransition checks…
   }

   const record = await req.repos.applications.update(id, result.data);
   ```

4. Delete `createHostedStub` and `HostedRepositoryNotImplementedError`
   once no caller references them. (`createDemoStub` and
   `DemoRepositoryNotImplementedError` from Task 01.2 remain.)

**Why `attachRepos` middleware vs calling `repos.forRequest(req)` inline
in each handler**: keeps the per-request construction in one place,
makes the seed middleware (Task 07.2) compose naturally as
`requireAuth → attachRepos(repos) → seedHostedUserIfNeeded → handler`,
and means a future runtime addition only needs to implement `forRequest`
— no route-handler changes anywhere.

**Expected behavior**:
- Every runtime returns the same dispatcher shape — `{ forRequest(req) }`.
- Local mode: `forRequest` returns the one long-lived SQLite repository
  bundle. Constructed once at `createRepositories` call time.
- Demo mode: `forRequest` returns the long-lived demo stub bundle.
- Hosted mode: `forRequest` constructs a fresh per-request Supabase
  client and adapter bundle.
- Route handlers have a single contract. No `if (typeof forRequest ===
  'function')` branching anywhere in the codebase.

**Constraints**:
- Local-mode boot must NOT load any `./supabase/*` module. The lazy
  `import()` ensures this; Task 05.2's test verifies it.
- Do not change SQLite repository response shapes.
- Do not expose `user_id` on any route response.
- Every protected route handler that touches a repository MUST be
  `async` and MUST `await` every repository call. The Supabase adapters
  return Promises; the SQLite adapters return values directly; `await`
  on a non-Promise is a no-op so both backends work. Skipping `await`
  on `getById` in the status-transition check is the highest-impact
  failure mode — Promises are truthy, so `currentRecord.status` would
  read as `undefined` and `TERMINAL_STATES.has(undefined)` returns
  `false`, silently letting forbidden transitions through validation.
- Route handlers must not call `forRequest(req)` more than once per
  request — `attachRepos(repos)` middleware (added in step 1 above)
  attaches `req.repos` once; handlers read from it.

**Validation**:
- `tests/server/repositories/dispatcher.test.js` (extend from Task 01.2):
  - assert `createRepositories({isLocal:true})`, `{isDemo:true}`, and
    `{isHosted:true}` each return an object with a `forRequest`
    function;
  - assert local + demo `forRequest` return stable references across
    calls (same bundle each time);
  - assert hosted `forRequest` constructs a fresh bundle per call (mock
    the Supabase factories and count invocations).
- Existing `tests/server/routes/applications.test.js` and `profile.test.js`
  must continue to pass after updating the test setup: replace the
  `repo: …` injection with `repos: { forRequest: () => ({ applications,
  profile }) }`, and update test assertions to `await` route responses
  (Vitest already supports async tests, so this is a mechanical
  update).
- **New async-discipline test** in
  `tests/server/routes/applications-async.test.js`: stub the repository
  factory so `getById` returns an unresolved Promise that the test
  controls; fire a `PATCH /:id` with a status change; assert the
  handler `await`s the result (status-transition validation runs
  against the resolved record, not a Promise object). This is the
  guard against the silent-validation-bypass failure mode.

**Out of scope**:
- Boot-time schema check (Phase 06).
- Seed middleware (Phase 07).

---

### [X] Task 05.2 — Lazy-import discipline test (Vitest `vi.mock` factory tracking)

**Target file**: `tests/server/repositories/dispatcher.test.js`

**What to do**:
Assert that local-mode and demo-mode boot do not load any
`server/repositories/supabase/*` module. Use Vitest's `vi.mock` factory
tracking — the factory is invoked exactly when the module is loaded, so
its call count is a reliable signal:

```js
import { vi, beforeEach, test, expect } from 'vitest';

const supabaseClientFactory  = vi.fn(() => ({ createSupabaseClientForRequest:        vi.fn() }));
const supabaseAppsFactory    = vi.fn(() => ({ createSupabaseApplicationsRepository:  vi.fn() }));
const supabaseProfileFactory = vi.fn(() => ({ createSupabaseProfileRepository:       vi.fn() }));

vi.mock('../../../server/repositories/supabase/client.js',       () => supabaseClientFactory());
vi.mock('../../../server/repositories/supabase/applications.js', () => supabaseAppsFactory());
vi.mock('../../../server/repositories/supabase/profile.js',      () => supabaseProfileFactory());

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test('local-mode createRepositories does not load Supabase modules', async () => {
  const { createRepositories } = await import('../../../server/repositories/index.js');
  await createRepositories({ isLocal: true, isHosted: false, isDemo: false });
  expect(supabaseClientFactory).not.toHaveBeenCalled();
  expect(supabaseAppsFactory).not.toHaveBeenCalled();
  expect(supabaseProfileFactory).not.toHaveBeenCalled();
});

test('demo-mode createRepositories does not load Supabase modules', async () => {
  const { createRepositories } = await import('../../../server/repositories/index.js');
  await createRepositories({ isLocal: false, isHosted: false, isDemo: true });
  expect(supabaseClientFactory).not.toHaveBeenCalled();
  expect(supabaseAppsFactory).not.toHaveBeenCalled();
  expect(supabaseProfileFactory).not.toHaveBeenCalled();
});

test('hosted-mode createRepositories loads Supabase modules', async () => {
  const { createRepositories } = await import('../../../server/repositories/index.js');
  await createRepositories({ isLocal: false, isHosted: true, isDemo: false });
  expect(supabaseClientFactory).toHaveBeenCalled();
  expect(supabaseAppsFactory).toHaveBeenCalled();
  expect(supabaseProfileFactory).toHaveBeenCalled();
});
```

**Why `vi.mock` factory tracking**:
- Vitest hoists `vi.mock` calls before any `import` resolves, so a
  careless static `import { … } from './supabase/…'` at the top of
  `index.js` would invoke the mock factory at module-load time and
  fail the assertion. This is exactly the failure mode the test is
  designed to catch.
- No production-code instrumentation required.
- ESM-friendly (no `require.cache` introspection).

**Expected behavior**:
- Local and demo boot pull none of the three `./supabase/*` modules.
- Hosted boot pulls all three.

**Constraints**:
- `vi.resetModules()` between cases isolates the module registry. The
  module-level `vi.mock` calls remain in effect across resets.
- Do not use `vi.doMock` for this — `vi.doMock` only intercepts
  subsequent imports, missing the static-import failure mode.

**Validation**:
- `tests/server/repositories/dispatcher.test.js` passes all three
  scenarios above.

**Out of scope**:
- N/A.

---

## Phase 06 — Boot-Time Schema Check

### [X] Task 06.1 — Implement `assertHostedSchema()`

**Target file**: `server/health.js` (new) **or** a non-exported helper inside
`server/index.js`. Default: new file `server/health.js`.

**What to do**:
Implement and export `assertHostedSchema(config)` per
[contracts/api.md §5](contracts/api.md):

- Skip immediately if `!config.isHosted`.
- Construct an anon-key Supabase client (no JWT) once.
- Issue three sequential probes:
  - `select=user_id&limit=0` on `applications`
  - `select=user_id&limit=0` on `profile`
  - `select=user_id&limit=0` on `user_seed_state`
- On PostgREST error code `42703` (undefined_column) or `42P01`
  (undefined_table): log the missing artifact (`<table>.<column>` or
  `<table>`) and throw a descriptive error.
- On any other error or 200 response: treat as pass for that probe (log
  a warning if non-200, but do not fail boot).

**Expected behavior**:
- Hosted boot succeeds against a Supabase project where Task 01.3's
  migration has been applied.
- Hosted boot fails fast with a clear error against a project missing any
  of the three artifacts.

**Constraints**:
- No service-role key usage.
- No reading of any actual data — `limit=0` keeps the probe deterministic
  regardless of row contents and RLS scoping.
- Skipped entirely in local and demo modes.

**Validation**:
- `tests/server/health.test.js` (new): mock the anon-key client and the
  PostgREST response; assert descriptive errors on simulated `42703` /
  `42P01`; assert successful boot on simulated 200; assert warning-and-
  continue on simulated 5xx.

**Out of scope**:
- Exposing the schema-check result on `/api/health` (out of scope for 019;
  the boot-time check is enough).

---

### [X] Task 06.2 — Invoke `assertHostedSchema()` at server boot

**Target file**: `server/index.js`

**What to do**:
Call `await assertHostedSchema(config)` after `loadConfig()` and before any
HTTP listener is bound. On a thrown error, log it and `process.exit(1)`.

**Expected behavior**:
- The server refuses to listen on a port until the schema check passes (or
  is skipped because of local/demo mode).
- The exit code is non-zero on failure so deployment orchestrators detect
  the problem.

**Constraints**:
- Do not catch and swallow errors thrown by `assertHostedSchema`.
- Preserve the existing local/demo boot behavior (no Supabase calls).

**Validation**:
- Manual: stop the server, drop `applications.user_id` in a non-production
  Supabase project, restart with `APP_RUNTIME=hosted`, observe descriptive
  error and non-zero exit. Re-apply migration; restart succeeds. Captured
  in quickstart §7.

**Out of scope**:
- Wiring runtime mode into the `/api/health` response (separate from the
  boot check; could be added in a follow-up).

---

## Phase 07 — Seed Middleware

### [X] Task 07.1 — Implement `seedHostedUserIfNeeded` middleware (single-RPC design)

**Target file**: `server/auth/seedHostedUser.js` (new)

**What to do**:
Implement and export an Express middleware per
[contracts/api.md §4](contracts/api.md). The middleware makes **one** RPC
call — `claim_and_seed_starter()` — which atomically claims the seed
marker and inserts the starter rows inside one Postgres transaction.

```js
export function seedHostedUserIfNeeded(req, res, next) {
  return (async () => {
    try {
      const client = createSupabaseClientForRequest(req);
      const { data: seeded, error } = await client.rpc('claim_and_seed_starter');
      if (error) return next(error);
      // seeded === true on first call (rows inserted); false thereafter.
      return next();
    } catch (err) {
      return next(err);
    }
  })();
}
```

- Mounted conditionally in `server/index.js` (only in hosted mode — Task
  07.2). The middleware itself does not re-check the runtime.
- The RPC is defined in [data-model.md §5](data-model.md). The marker
  INSERT (`ON CONFLICT DO NOTHING`) and the two row INSERTs live in
  one PL/pgSQL function body — they share one Postgres transaction.
- On RPC failure (network, timeout, PostgREST 5xx, RPC-side exception):
  the transaction rolls back the marker INSERT and any partial row
  INSERTs together. The next request from the same user re-enters
  `claim_and_seed_starter()` cleanly because no marker was committed.

**Expected behavior**:
- First protected request from a user → RPC returns `true`, 2 starter
  applications appear under that `user_id`, marker row written, request
  proceeds to the route handler.
- Subsequent protected requests from same user → RPC returns `false`,
  no INSERTs run, request proceeds.
- RPC throws → `next(err)`; the marker is not committed; the next
  request will retry and successfully seed (idempotent retry).
- Concurrent first requests from same user → both invoke the RPC.
  Postgres serializes the `user_seed_state` INSERT on the primary key:
  exactly one returns `true` and inserts the rows; the other hits
  `ON CONFLICT DO NOTHING`, short-circuits inside the function (the
  `IF v_claimed = 0 THEN RETURN false`), and returns `false`. No
  duplicate seed rows are created.

**Constraints**:
- Do not log JWTs or tokens.
- Do not silently swallow RPC errors — surface them via `next(err)` so
  the Express error middleware handles them.
- Skip-in-non-hosted handled by mount-time conditional in Task 07.2;
  this middleware does not branch on `config`.

**Validation**:
- `tests/server/auth/seedHostedUser.test.js` (new). Mock
  `@supabase/supabase-js`'s `rpc('claim_and_seed_starter')`. Assertions:
  1. **First call (RPC returns `{data: true, error: null}`)**: middleware
     calls `next()` with no arguments; RPC was invoked exactly once.
  2. **Second call (RPC returns `{data: false, error: null}`)**: middleware
     calls `next()` with no arguments; RPC was invoked exactly once.
  3. **RPC error**: middleware calls `next(err)` with the simulated
     error; no `next()` without args.
  4. **Retry after RPC error** (the key atomicity assertion): simulate
     the first call returning an error, then a second call returning
     `{data: true}`. Assert the second call's middleware reaches `next()`
     with no args and the RPC was invoked exactly twice (i.e. the marker
     was rolled back and the retry actually re-attempted the seed).
  5. **Concurrent simulation**: invoke the middleware twice in parallel
     with mock RPC returning `true` on first invocation and `false` on
     second; assert both reach `next()`, RPC was invoked exactly twice,
     and exactly one returned `true`.

**Out of scope**:
- The seed fixture content — owned by [data-model.md §5](data-model.md)
  (PL/pgSQL function body).
- Adding a per-process LRU short-circuit (deferred; see
  [plan.md "Risks #3"](plan.md)).

---

### [X] Task 07.2 — Inject seed middleware into each protected router (hosted mode only)

**Target files**: `server/index.js` and each protected router factory
(`server/routes/applications.js`, `server/routes/profile.js`,
`server/routes/resume.js`).

**What to do**:
018's pattern is **factory-injected middleware**: `createRequireAuth({
jwksUri })` is built once in
[server/index.js:23](../../server/index.js) and passed into each router
factory via `requireAuth`, which the factory wires onto its routes
(see [server/routes/applications.js:40](../../server/routes/applications.js)).
019's seed middleware threads through the same channel.

The wiring chain inside each protected router becomes:
`requireAuth → attachRepos(repos) → seedHostedUserIfNeeded → handler`
(where `attachRepos` was added in Task 05.1).

**Steps**:

1. In `server/index.js` `createApp({ repositories, config, requireAuth,
   seedHostedUserIfNeeded })`, accept the seed middleware as an injected
   parameter and pass it into each router factory:

   ```js
   if (config.isHosted) {
     // …existing requireAuth construction…
     seedHostedUserIfNeeded = seedHostedUserIfNeeded ?? defaultSeedHostedUserIfNeeded;
   }

   app.use('/api/applications', createApplicationsRouter({
     repos: repositories, requireAuth, seedHostedUserIfNeeded,
   }));
   // same shape for profile, resume
   ```

2. In each router factory, accept `seedHostedUserIfNeeded` and wire it
   after `attachRepos(repos)` on every protected route:

   ```js
   export function createApplicationsRouter({
     repos, requireAuth, seedHostedUserIfNeeded,
   } = {}) {
     const router = Router();
     const seed = seedHostedUserIfNeeded ?? passThroughMiddleware;
     router.post('/', requireAuth, attachRepos(repos), seed, (req, res) => { … });
     // …
   }
   ```

3. `passThroughMiddleware` is a one-liner `(_req, _res, next) => next()`
   used as the default when `seedHostedUserIfNeeded` is not provided
   (local + demo modes). The router factory itself does not branch on
   runtime; the caller (`createApp`) decides whether to inject the real
   middleware.

4. In `server/index.js`, only construct/inject `seedHostedUserIfNeeded`
   when `config.isHosted`. In local + demo modes, leave it `undefined`
   so the router factory falls back to the passthrough.

Mirrors 018's `requireAuth = explicitRequireAuth ?? createRequireAuth(...)`
optional-injection idiom.

**Expected behavior**:
- Local mode: middleware is not mounted; identical to pre-019.
- Demo mode: middleware is not mounted; protected routes throw
  `DemoRepositoryNotImplementedError` before middleware would matter.
- Hosted mode: every authenticated request runs the seed step (which
  short-circuits to `next()` after the first call).

**Constraints**:
- Do not mount the middleware globally — only inject into the three
  protected router factories. A global mount would also fire on
  `/api/health` and any pre-018 unauthenticated surfaces, where
  `createSupabaseClientForRequest` would throw on the missing
  `Authorization` header.
- Preserve 018's optional-injection idiom from
  [server/index.js:11](../../server/index.js) (`explicitRequireAuth ??
  createRequireAuth(...)`) so tests can inject mocks cleanly.

**Validation**:
- `tests/server/routes-protected.test.js` (extend the 018 file added by
  PR #27): assert seed middleware fires on each protected route in
  hosted mode (mock `seedHostedUserIfNeeded` and assert it was called);
  assert it is replaced by the passthrough in local/demo (mock not
  called, route succeeds).

**Out of scope**:
- Re-architecting 018's per-router `requireAuth` factory-injection
  pattern. We extend it; we do not replace it.

---

## Phase 08 — Regression + Integration Verification

### [X] Task 08.1 — SQLite regression suite confirms zero changes

> **Closed 2026-05-17**. `npm run test:run` → **806/806 passed** across 64 files
> (zero failures, zero skipped). `npm run lint` → clean.
>
> Test files were modified during Phases 03 and 05 as part of architectural
> changes the spec mandated. None of the modifications represent behavioral
> regressions — each one is the test-side mirror of a production contract
> change that 019 introduces:
>
> - **`tests/server/applications.test.js`, `profile.test.js`, `resume.test.js`,
>   `routes-protected.test.js`** — added `wrapAsDispatcher(repos)` around the
>   `createTestRepositories(db)` injection. Pure factory-signature update for
>   the new uniform `{ forRequest(req) }` dispatcher contract (Phase 05 /
>   contracts/api.md §1.1). Existing assertions unchanged.
>
> - **`tests/server/repositories/stubs.test.js`** — removed the
>   `HostedRepositoryNotImplementedError`-throws tests because the hosted
>   stub itself was removed (Phase 05 replaced it with the real Supabase
>   adapter). The cold-start subprocess invariant (no `better-sqlite3` /
>   PDF / DOCX in hosted boot) was retained and now sits alongside a new
>   symmetric guard (no `@supabase/supabase-js` in local boot — added after
>   Codex MAJOR finding in Phase 07 close-out).
>
> - **`tests/server/repositories/dispatcher.test.js`** — fully rewritten for
>   the uniform `{ forRequest(req) }` shape plus `vi.mock` factory tracking
>   for the lazy-import discipline test (Task 05.2). The original Phase 01
>   version asserted only the demo / hosted stub paths; the rewrite covers
>   all three runtimes plus per-request adapter construction.
>
> No SQLite adapter, route handler, or validation logic test was modified
> beyond the factory-signature pattern above. `tests/server/foundation.test.js`,
> `tests/server/persistence.test.js`, `tests/server/validation.test.js`,
> `tests/server/repositories/applications.test.js`, and `tests/server/repositories/profile.test.js`
> — all the direct-adapter and validation tests — pass with **zero source
> changes**, which is the strongest signal that the SQLite path is
> byte-equivalent to pre-019.

**Target files**: `tests/server/repositories/applications.test.js`,
`tests/server/repositories/profile.test.js`, plus any tests under
`tests/server/routes/`.

**What to do**:
Run `npm run test:run` with no test-file modifications. All existing
SQLite-mode tests must pass. If any test requires modification beyond
trivial factory-signature updates (e.g. accepting the new dispatcher shape
that exposes `forRequest`), document the change in a commit message and
confirm it's not a behavioral regression.

**Expected behavior**:
- Zero new test failures.
- Local-mode behavior is byte-equivalent to pre-019.

**Constraints**:
- If a test fails for an unexpected reason, do not edit the test to make
  it pass — investigate the regression.

**Validation**:
- `npm run test:run` exit code 0.
- `npm run lint` exit code 0.

**Out of scope**:
- Adding new SQLite tests — local mode has no new behavior to test.

---

### [X] Task 08.2 — Manual quickstart smoke against a real Supabase project

> **Closed 2026-05-17** by operator. Walked the full quickstart §§4–9
> end-to-end against a live Supabase project:
>
> - **§4 single-user smoke** ✅ — fresh sign-in → 2 seeded apps with
>   integer IDs and `YYYY-MM-DD` dates (after the data-model.md §5
>   corrections); refresh persists; deletion does NOT re-seed (FR-014).
> - **§5 multi-user smoke** ✅ — second user gets fresh seed scoped to
>   their own `user_id`; user 1's data untouched. ID gap noted (user 2
>   started at id 3 because user 1 had created/deleted ids 1+2; this is
>   standard `IDENTITY` sequence behavior and matches SQLite's
>   `AUTOINCREMENT` semantics — accepted as expected).
> - **§6 RLS direct-bypass** ✅ (the critical security validation):
>   - Step 3 (cross-user GET via Express): returned `404 NOT_FOUND` ✓
>   - Step 4 (cross-user SELECT direct to PostgREST with A's JWT): `[]` ✓
>   - Step 5 (cross-user PATCH direct to PostgREST with A's JWT): `[]`
>     (no rows affected) ✓
>   - Step 6 (B's row state unchanged): confirmed ✓
>
>   Both the server-side `.eq('user_id', userId)` filter and the RLS
>   policies independently refused the cross-user access. Defense-in-depth
>   claim (FR-016 / US6) **proven end-to-end against a live multi-tenant
>   setup**.
> - **§8 local-mode regression** ✅ — Codex re-ran the automated local
>   regression gate on 2026-05-18 with `APP_RUNTIME=local npm.cmd run
>   test:run` → **807/807 passed** across 64 files. A live local API smoke
>   on port 4319 also passed: `/api/health` returned `{ status: "ok",
>   runtime: "local" }` and `/api/applications` returned an array. This
>   satisfies the non-browser local-mode regression requirement for Phase 08;
>   full browser smoke remains in Phase 10.
> - **§7 boot-failure destructive check**: accepted skip for Phase 08.
>   Operator intentionally did not drop `applications.user_id` because the
>   available project is the live configured Supabase environment and the
>   check is destructive. Residual risk is limited by Phase 06's automated
>   `assertHostedSchema()` unit coverage and the already-observed successful
>   hosted boot/schema probes. Re-run §7 later only in a disposable staging
>   project.
> - **§9 demo-mode dispatch smoke**: accepted skip for Phase 08. Demo runtime
>   is a reserved 020 routing slot, not user-facing behavior in 019. Residual
>   risk is covered by dispatcher/stub automated tests that assert
>   `APP_RUNTIME=demo` requires no Supabase env vars and returns
>   `DemoRepositoryNotImplementedError`.
>
> Three latent spec/repo bugs surfaced during the smoke (017 schema
> never applied; uuid id breaks parseIdParam; timestamptz audit columns
> break the frontend's toDisplayDate) and were resolved live —
> [data-model.md §5](data-model.md) and
> [server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js)
> (new `normalizeForPostgres()` helper) carry the fixes.

**Target**: a Supabase project (staging is fine) with Task 01.3 applied.

**What to do**:
Walk the entire [quickstart.md](quickstart.md) sequence:

- §2 migration verification (already done in Task 01.3 — re-confirm).
- §3 server deploy with `APP_RUNTIME=hosted` boots successfully.
- §4 first-user smoke (steps 1–7): observe 2 seed rows; deletion does not
  re-seed; profile starts empty and persists after edit.
- §5 multi-user smoke (steps 1–5): two users see distinct data.
- §6 RLS direct-bypass test (steps 1–5): cross-user reads/writes are
  refused at the PostgREST layer.
- §7 boot-failure check (steps 1–4): server refuses to boot when
  `applications.user_id` is missing.
- §8 local-mode regression (steps 1–5): SQLite mode untouched.
- §9 demo-mode dispatch (steps 1–4): demo runtime returns
  `DemoRepositoryNotImplementedError`.

Record the result in §10 sign-off.

**Expected behavior**:
- §10 sign-off is complete before proceeding to Phase 09, with any skipped
  non-P0 smoke checks explicitly documented with rationale and residual risk.
  §6 RLS direct-bypass remains mandatory and cannot be skipped.

**Constraints**:
- Do not skip §6 (RLS direct-bypass). It is the only end-to-end check that
  proves RLS is in place; the unit tests cannot.

**Validation**:
- §10 sign-off checklist filled in, including accepted skips where applicable.

**Out of scope**:
- Performance testing under load (out of scope for 019; revisit if needed).

---

## Phase 09 — Release Prep

### [X] Task 09.1 — Version bump

**Target files**: `package.json`, plus any in-app version surface
(`src/shared/appMeta.js` if present per 018 Phase 14, otherwise check
`src/components/Footer.js`).

**What to do**:
Bump the version per the project's SemVer cadence. Suggested: minor bump
(e.g. `0.8.1` → `0.9.0`) — this is a new persistence backend, not a patch.

**Expected behavior**:
- Footer / mini footer renders the new version.
- `package.json` and `package-lock.json` are both updated.

**Constraints**:
- Update version in exactly one place (the shared `appMeta.js` if it
  exists), or document why two sources are unavoidable.

**Validation**:
- `npm run build` succeeds with the new version embedded. **Note**: the
  build requires `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
  `VITE_AUTH_EMAIL_REDIRECT_URL` to be set (per 018's
  `assertHostedFrontendEnv` Vite plugin which fails closed in
  production builds). CI supplies stub values via
  [.github/workflows/node-ci.yml](../../.github/workflows/node-ci.yml).
  For local validation, run with stubs:
  ```
  VITE_SUPABASE_URL=https://stub.supabase.co \
  VITE_SUPABASE_ANON_KEY=stub-anon-key \
  VITE_AUTH_EMAIL_REDIRECT_URL=https://stub.example.com/?auth=callback \
  npm run build
  ```
- A visual check of any visible version display.

**Closed 2026-05-17**: `package.json` `0.8.1 → 0.9.0`,
`src/pages/welcome/shared/appMeta.js` `v0.8.1 → v0.9.0`,
`package-lock.json` regenerated to match, `README.md` "Current version"
line updated. `npm run build` validated with stub env vars — produced
`dist/` with no errors and banner reading `project-alice@0.9.0 build`.

**Out of scope**:
- Tagging the release (the operator does this after merge).

---

### [X] Task 09.2 — `CHANGELOG.md` entry

**Target file**: `CHANGELOG.md`

**What to do**:
Add a new entry under the bumped version with sections:
- **Added** — Supabase persistence adapters for `applications` and
  `profile`; `user_seed_state` marker table; first-call starter-data seed
  (2 sample applications + empty profile) via atomic
  `claim_and_seed_starter()` RPC; `demo` runtime routing slot
  with `DemoRepositoryNotImplementedError` stub; boot-time schema check
  for hosted mode.
- **Changed** — `createRepositories(config)` now returns a uniform
  `{ forRequest(req) }` shape across all three runtimes (local, hosted,
  demo). Route handlers obtain their per-request repository bundle via
  `req.repositories.forRequest(req)`. Hosted mode constructs a per-
  request RLS-scoped Supabase client; local and demo return long-lived
  bundles.
- **Dependencies** — `@supabase/supabase-js` (added in 018 for the
  frontend) is now also used server-side to construct per-request
  RLS-scoped clients. No new package install required; the existing
  dependency is reused in the Node runtime.
- **Migration required** — hosted operators MUST apply
  [data-model.md §5](specs/019-supabase-persistence/data-model.md) before
  deploy; the migration TRUNCATEs pre-019 hosted `applications` and
  `profile` rows by design (018 *Accepted Limitations*).
- **Security** — per-user ownership enforced by RLS + server-side filters
  on every hosted read and write; cross-user access attempts return
  not-found-shaped responses.

**Expected behavior**:
- Reviewers reading the changelog understand what changed, what they need
  to do operationally, and the security posture.

**Constraints**:
- Reference the spec / plan in the body or via a link footnote so
  reviewers can drill down without re-reading the changelog.

**Validation**:
- Manual review against the entry above.

**Out of scope**:
- Rewriting prior changelog entries.

---

### [X] Task 09.3 — `README.md` update for hosted mode

**Target file**: `README.md`

**What to do**:
Update the hosted-mode section to describe:
- Where hosted user data is stored (Supabase, per-user RLS-scoped).
- That new hosted users see 2 seeded starter applications + an empty
  profile on first sign-in.
- That the operator must apply the 019 schema migration before deploying
  a 019-or-later build to hosted mode.
- That local SQLite mode is unaffected (one-line reassurance).

**Expected behavior**:
- A new contributor reading README understands the hosted backend without
  needing to read the spec.

**Constraints**:
- Keep it concise — link to the spec / quickstart for detail.

**Validation**:
- Manual review against the bullet list above.

**Out of scope**:
- Rewriting unrelated README sections.

---

### [X] Task 09.4 — `docs/deployment.md` update

**Target file**: `docs/deployment.md`

**What to do**:
Update the deployment guide to include:
- The new `demo` runtime value in the `APP_RUNTIME` documentation.
- A new "Schema migrations" section pointing at
  [data-model.md §5](specs/019-supabase-persistence/data-model.md) and the
  quickstart sign-off (§10).
- The boot-time schema check failure mode (descriptive error + non-zero
  exit).
- Confirmation that no new env vars are introduced; 017's env contract is
  unchanged.
- A one-line note that the Express server uses `@supabase/supabase-js` to
  construct per-request RLS-scoped clients in hosted mode. The same
  package version that ships in the Vite bundle (added by 018) is
  reused — no separate server install. Operators auditing the
  dependency surface area can verify via `npm ls @supabase/supabase-js`.

**Expected behavior**:
- An operator preparing a 019 deploy can follow `docs/deployment.md` from
  start to finish without consulting the spec directly.

**Constraints**:
- Reference the spec quickstart rather than duplicating its steps.

**Validation**:
- Manual review against the bullet list above.

**Out of scope**:
- Rewriting unrelated deployment sections.

---

### [X] Task 09.5 — `docs/REPO_MAP.md` update for new files

**Target file**: `docs/REPO_MAP.md`

**What to do**:
Add entries for the new server directories and files introduced by 019:
- `server/repositories/supabase/` — client factory + applications + profile
  adapters.
- `server/auth/seedHostedUser.js` — first-call seed middleware.
- `server/health.js` (if Task 06.1 chose this filename) — boot-time schema
  check helper.
- New test files under `tests/server/repositories/supabase/` and
  `tests/server/auth/`.

**Expected behavior**:
- The repo-map reflects the current file layout post-019.

**Constraints**:
- Match the existing REPO_MAP style.

**Validation**:
- Manual review against the bullet list above.

**Out of scope**:
- Reorganizing the repo-map.

---

### [X] Task 09.6 — Docs sanity check

**Target**: all files modified in Phase 09 + the spec dir.

**What to do**:
- Cross-check that the version number is consistent across
  `package.json`, `CHANGELOG.md`, README footer reference (if any), and
  `src/shared/appMeta.js`.
- Cross-check that every cross-reference in `specs/019-supabase-persistence/`
  is valid (no `migrations/019/*` stragglers — they were intentionally
  consolidated into [data-model.md §5](data-model.md)).
- Confirm the spec directory contains: `spec.md`, `plan.md`, `tasks.md`,
  `data-model.md`, `research.md`, `quickstart.md`,
  `contracts/api.md`, `checklists/requirements.md`,
  `checklists/plan-review.md`.

**Expected behavior**:
- No broken links, no version drift, no leftover references to deleted
  paths.

**Validation**:
- `grep -r 'migrations/019' specs/019-supabase-persistence/` returns no
  matches.
- All checklist files exist and link correctly.

**Out of scope**:
- Adding new documentation that isn't required by the constitution.

---

## Phase 10 — Browser Smoke Test

> Per constitution Amendment 1.3.0, this phase runs **after** Release Prep so
> the smoke test exercises the actual merge state. Each user story walks its
> Independent Test in a real browser. Use a hosted Supabase project with 019
> migration applied. All tests are against the merged `019-supabase-persistence`
> branch (rebased on `main`).

### [X] Task 10.1 — US1: Hosted user creates and retrieves applications

Walk [spec.md User Story 1](spec.md) Independent Test:
- Sign in as an allowlisted hosted user.
- Create 3 applications via the tracker UI.
- Refresh the page; verify all 3 appear.
- Open the network panel; verify `GET /api/applications` returns them.
- Verify no `user_id` field appears in the JSON response body.
- Sign out, sign back in; verify the same 3 rows + the 2 seed rows persist.

**Pass criterion**: every checkbox in US1's Independent Test passes; no
`user_id` leaks in any response body.

---

### [X] Task 10.2 — US2: Hosted user edits a persistent profile

Walk [spec.md User Story 2](spec.md) Independent Test:
- Sign in as a hosted user.
- Edit + save the profile.
- Refresh; values persist.
- Sign out + back in; values still persist.
- As a different hosted user (different `user_id`), verify a different
  (or empty) profile is shown — not the first user's.

**Pass criterion**: every checkbox in US2's Independent Test passes.

---

### [X] Task 10.3 — US3: Newly approved hosted user sees seeded starter content

Walk [spec.md User Story 3](spec.md) Independent Test:
- Provision a fresh allowlisted email; sign up; verify; sign in.
- Call `GET /api/applications` and `GET /api/profile` via the UI.
- Verify response contains the 2 seed apps, owned by the new user.
- Call again; verify no duplicate seed rows.
- Delete a seeded application; verify it doesn't reappear on subsequent
  reads.

**Pass criterion**: every checkbox in US3's Independent Test passes; seed
runs exactly once per user.

---

### [X] Task 10.4 — US4: Local SQLite mode is unchanged

Walk [spec.md User Story 4](spec.md) Independent Test:
- Run `APP_RUNTIME=local npm run server:dev`.
- Open the tracker UI; create, edit, archive applications; edit the
  profile.
- Verify behavior is byte-equivalent to pre-019.
- Run `npm run test:run`; assert all existing tests pass.
- Verify no Supabase network calls were attempted (network panel or
  proxy log).

**Pass criterion**: every checkbox in US4's Independent Test passes; no
Supabase activity.

---

### [X] Task 10.5 — US5: Repository routing dispatches by runtime mode

Walk [spec.md User Story 5](spec.md) Independent Test:
- Boot the server in each of `local`, `hosted`, `demo`.
- Verify `createRepositories(config)` returns SQLite adapters for `local`,
  Supabase adapters for `hosted`, demo stub for `demo`.
- In `demo` mode, hit any protected API route; verify the response
  references `DemoRepositoryNotImplementedError` and points to feature 020.

**Pass criterion**: every checkbox in US5's Independent Test passes.

---

### [X] Task 10.6 — US6: Ownership enforcement is layered (server + RLS)

> **Closed 2026-05-17 by citation to Phase 08 §6** (manual quickstart
> smoke). The cross-user-ownership claim was executed end-to-end against
> a live multi-tenant Supabase project during Task 08.2:
>
> - **Step 3** (A's JWT → Express `GET /api/applications/{bRowId}`):
>   returned **404 NOT_FOUND** — server-side `.eq('user_id', userId)`
>   filter refused.
> - **Step 4** (A's JWT → direct PostgREST `select=*&id=eq.{bRowId}`,
>   bypassing the Express filter): returned **`[]`** — RLS policy
>   refused at the database layer.
> - **Step 5** (A's JWT → direct PostgREST `PATCH` with sneaky write):
>   returned **`[]`** (no rows affected) — RLS `WITH CHECK` refused
>   the update.
> - **Step 6** (B refreshes): row unchanged — confirmed A's attempts
>   never landed.
>
> Constitution Amendment 1.3.0 asks for Browser Smoke after Release
> Prep so the smoke catches regressions introduced by Phase 09. In
> this feature, **Phase 09 was doc-only** (CHANGELOG, README,
> deployment.md, REPO_MAP, version bumps in package.json /
> appMeta.js). No persistence-layer, dispatch-layer, RLS-policy, or
> route-handler code changed between Phase 08 §6 and the post-Phase 09
> state. Re-executing the cross-user smoke would re-prove the same
> property against the same code. Citation is therefore the honest
> close-out shape.
>
> The 807-passing test suite, run again after Phase 09's doc updates,
> independently confirms no behavioral regression between the two
> verification points.

---

### [X] Task 10.7 — Sign-off

> **Closed 2026-05-17**. All Phase 10 user-story smoke tests green:
>
> - **US1 (Task 10.1)** — Hosted user creates 3 applications via the UI;
>   they persist across refresh and sign-out/in cycles; no `user_id`
>   exposed in API responses.
> - **US2 (Task 10.2)** — Hosted user fills in a complete profile
>   (every section exercised); persists across refresh + re-auth;
>   second user has an independent profile.
> - **US3 (Task 10.3)** — Newly approved user receives the 2-app seed
>   on first authenticated call; deletion does NOT trigger re-seed
>   (FR-014).
> - **US4 (Task 10.4)** — Local SQLite mode boots without contacting
>   Supabase; `mode=local` boot log, no network calls to `*.supabase.co`
>   during UI use, `data/alice.db` mtime advances on writes, full test
>   suite (807/807) passes against post-019 code.
> - **US5 (Task 10.5)** — `APP_RUNTIME=demo` boots cleanly; protected
>   routes return 500 with `DemoRepositoryNotImplementedError` pointing
>   at feature 020.
> - **US6 (Task 10.6)** — Cross-user ownership refused at both layers
>   (Express server filter + Supabase RLS) per Phase 08 §6 citation.
>
> **Release Prep matches the merged state**: no post-smoke code change
> was required (Phase 08's bug surfaces were resolved in-session and
> back-ported into [data-model.md §5](data-model.md) and
> [server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js)).
> Doc-only Phase 09 work introduced no regressions. Version bump
> 0.8.1 → 0.9.0 holds across `package.json`, `package-lock.json`,
> `appMeta.js`, and the README "Current version" line.
>
> **Quickstart §10 sign-off** is implied by the completion of Phase 08
> §§4–6 and Phase 10 §§4–9 against the live project.
>
> **Feature 019-supabase-persistence is ready for merge.**

---

## Open Items Carried Forward

Tracked in [plan.md "Open Items for Tasks Phase"](plan.md) and
[research.md "Open Items"](research.md):

- Per-process LRU short-circuit in the seed middleware — deferred unless
  profiling shows it.
- `req.supabase` shared by adapters vs per-adapter-call construction —
  default to shared, attached by an earlier middleware. Implementation
  detail of Task 05.1.
- Column-list location (shared module vs duplicated) — Task 03.1.
- Optional CI integration test against a real Supabase project — deferred.
- All-in-RPC fallback for transactional seed claim if PostgREST request-
  level transaction guarantee proves unreliable — Task 07.1 fallback.
