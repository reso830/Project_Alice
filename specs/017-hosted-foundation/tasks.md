# Tasks: Hosted Deployment Foundation (017)

**Spec**: `specs/017-hosted-foundation/spec.md`
**Plan**: `specs/017-hosted-foundation/plan.md`
**Branch**: `017-hosted-foundation`

---

## Phase 01 — Config Module

Create `server/config.js`, the foundational module that everything else depends on.
No other phase may begin until Phase 01 is complete.

---

### [X] Task 01.1 — Create `server/config.js` with runtime validation

**Target file**: `server/config.js` (new)

**What to do**:

Create the file with a `loadConfig()` function and a module-level `config` export.
Export both so tests can call `loadConfig()` directly.

```js
import process from 'node:process';

const VALID_RUNTIMES = ['local', 'hosted'];
const HOSTED_REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

export function loadConfig() {
  const runtime = process.env.APP_RUNTIME ?? 'local';

  if (!VALID_RUNTIMES.includes(runtime)) {
    throw new Error(
      `Invalid APP_RUNTIME: "${runtime}". Valid values: "local", "hosted".`
    );
  }

  if (runtime === 'hosted') {
    for (const key of HOSTED_REQUIRED) {
      if (!process.env[key]) {
        throw new Error(
          `Missing required environment variable for hosted mode: ${key}`
        );
      }
    }
  }

  return Object.freeze({
    runtime,
    isHosted: runtime === 'hosted',
    port: Number(process.env.PORT) || 3001,
    supabase:
      runtime === 'hosted'
        ? {
            url: process.env.SUPABASE_URL,
            anonKey: process.env.SUPABASE_ANON_KEY,
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          }
        : null,
  });
}

export const config = loadConfig();
```

**Expected behavior**:
- `APP_RUNTIME` absent → `config.runtime === 'local'`, `config.isHosted === false`, `config.supabase === null`
- `APP_RUNTIME=local` → same as above
- `APP_RUNTIME=hosted` with all three Supabase vars present → `config.isHosted === true`, `config.supabase` object populated
- `APP_RUNTIME=hosted`, `SUPABASE_URL` missing → throws with message `"Missing required environment variable for hosted mode: SUPABASE_URL"`
- `APP_RUNTIME=staging` → throws with message `"Invalid APP_RUNTIME: \"staging\". Valid values: \"local\", \"hosted\"."`
- `APP_RUNTIME=local` with all Supabase vars present → resolves `local`; extra vars ignored

**Constraints**:
- `SUPABASE_SERVICE_ROLE_KEY` must never be added to the `supabase` object under a `VITE_`-prefixed name.
- The returned object must be frozen — mutations throw in strict mode.
- `PORT` defaults to `3001` when absent.
- The module-level `config` export runs `loadConfig()` once at import time.

**Validation**: Tests in Task 01.2. No other file changes in this task.

---

### [X] Task 01.2 — Add config unit tests in `tests/server/config.test.js`

**Target file**: `tests/server/config.test.js` (new)

**What to do**:

Import `loadConfig` from `../../server/config.js`. Use `beforeEach`/`afterEach` to
save and restore `process.env` around each test, or use vitest's `vi.stubEnv`. Call
`loadConfig()` directly for each scenario — do not import `config` (the singleton),
which is evaluated once at module load.

Test cases to cover:

1. **Local mode (no env var)**: Delete `process.env.APP_RUNTIME`; call `loadConfig()`.
   Assert `runtime === 'local'`, `isHosted === false`, `supabase === null`.

2. **Local mode explicit**: Set `APP_RUNTIME=local`. Assert same result as above.

3. **Hosted mode (all vars present)**: Set `APP_RUNTIME=hosted` plus all three Supabase
   vars. Assert `runtime === 'hosted'`, `isHosted === true`, `supabase.url` matches
   `SUPABASE_URL`, `supabase.anonKey` matches `SUPABASE_ANON_KEY`,
   `supabase.serviceRoleKey` matches `SUPABASE_SERVICE_ROLE_KEY`.

4. **Hosted mode — `SUPABASE_URL` missing**: Set `APP_RUNTIME=hosted`, provide
   `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` but omit `SUPABASE_URL`.
   Assert `loadConfig()` throws with message containing `"SUPABASE_URL"`.

5. **Hosted mode — `SUPABASE_ANON_KEY` missing**: Set `APP_RUNTIME=hosted`, provide
   the other two vars. Assert throws with message containing `"SUPABASE_ANON_KEY"`.

6. **Hosted mode — `SUPABASE_SERVICE_ROLE_KEY` missing**: Set `APP_RUNTIME=hosted`,
   provide the other two vars. Assert throws with message containing
   `"SUPABASE_SERVICE_ROLE_KEY"`.

7. **Invalid runtime value**: Set `APP_RUNTIME=production`. Assert throws with message
   containing `"Invalid APP_RUNTIME"` and `"production"`.

8. **Config is frozen**: Call `loadConfig()`; attempt to assign a property. Assert it
   throws (strict mode) or the assignment is silently ignored, but the original value
   is unchanged.

9. **Local mode with hosted vars present**: Set `APP_RUNTIME=local` and all three
   Supabase vars. Assert resolves without throw and `supabase === null`.

10. **Hosted mode — empty `SUPABASE_URL`**: Set `APP_RUNTIME=hosted`, set
    `SUPABASE_URL` to an empty string, provide the other two vars. Assert
    `loadConfig()` throws with message containing `"SUPABASE_URL"`. (The `!value`
    guard treats empty string the same as absent.)

**Validation**: `npm test -- tests/server/config.test.js` must pass fully.

---

## Phase 02 — Repository Layer

Create the full `server/repositories/` directory and all files within it. Depends
on Phase 01 (`server/config.js` exists). Can start immediately after Phase 01.

Tasks 02.1 and 02.2 are independent and can be written in parallel.

---

### [X] Task 02.1 [P] — Create `server/repositories/applications.js` (SQLite adapter)

**Target file**: `server/repositories/applications.js` (new)

**What to do**:

Wrap the existing exports from `server/db/applications.js` into the
`ApplicationsRepository` interface. Do not modify `server/db/applications.js`.

Add JSDoc for the `ApplicationsRepository` typedef at the top, then:

```js
import {
  getAll,
  getById,
  create,
  update,
  archive,
} from '../db/applications.js';

/**
 * @typedef {Object} ApplicationsRepository
 * @property {() => object[]} getAll
 * @property {(id: number) => object | null} getById
 * @property {(fields: object) => object} create
 * @property {(id: number, fields: object) => object | null} update
 * @property {(id: number) => object | null} archive
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {ApplicationsRepository}
 */
export function createSqliteApplicationsRepository(db) {
  return {
    getAll:  ()             => getAll(db),
    getById: (id)           => getById(id, db),
    create:  (fields)       => create(fields, db),
    update:  (id, fields)   => update(id, fields, db),
    archive: (id)           => archive(id, db),
  };
}
```

**Expected behavior**:
- `repo.getAll()` returns the same result as `getAll(db)` for the given db
- `repo.getById(1)` returns the same result as `getById(1, db)`
- `repo.create(fields)` creates and returns the record
- `repo.update(id, fields)` updates and returns the record, or `null` if not found
- `repo.archive(id)` archives the record and returns it, or `null` if not found

**Constraints**:
- `server/db/applications.js` must not be modified.
- This file must not import from `server/config.js` — it is pure adapter logic.

**Validation**: Tests in Task 02.4.

---

### [X] Task 02.2 [P] — Create `server/repositories/profile.js` (SQLite adapter)

**Target file**: `server/repositories/profile.js` (new)

**What to do**:

```js
import { getProfile, saveProfile } from '../db/profile.js';

/**
 * @typedef {Object} ProfileRepository
 * @property {() => object | null} get
 * @property {(data: object) => object} upsert
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {ProfileRepository}
 */
export function createSqliteProfileRepository(db) {
  return {
    get:    ()     => getProfile(db),
    upsert: (data) => saveProfile(data, db),
  };
}
```

**Expected behavior**:
- `repo.get()` returns `null` when no profile exists, or the profile object
- `repo.upsert(data)` saves and returns the profile

**Constraints**: `server/db/profile.js` must not be modified.

**Validation**: Tests in Task 02.4.

---

### [X] Task 02.3 — Create `server/repositories/index.js` (factory)

**Target file**: `server/repositories/index.js` (new)

**Depends on**: Tasks 02.1 and 02.2.

**What to do**:

Create the factory with three exports: `createRepositories`, `createTestRepositories`,
and the `HostedRepositoryNotImplementedError` class.

```js
import { createSqliteApplicationsRepository } from './applications.js';
import { createSqliteProfileRepository } from './profile.js';
// server/db.js is NOT imported at the top level — importing it triggers better-sqlite3
// and filesystem side effects that must not run in hosted/Vercel environments.

export class HostedRepositoryNotImplementedError extends Error {
  constructor(repositoryName) {
    super(
      `Hosted persistence is not yet implemented for: ${repositoryName}. ` +
      `See feature 019-supabase-persistence.`
    );
    this.name = 'HostedRepositoryNotImplementedError';
  }
}

function createHostedStub(name) {
  const notImplemented = () => {
    throw new HostedRepositoryNotImplementedError(name);
  };
  return {
    getAll:  notImplemented,
    getById: notImplemented,
    create:  notImplemented,
    update:  notImplemented,
    archive: notImplemented,
    get:     notImplemented,
    upsert:  notImplemented,
  };
}

/**
 * @param {import('../config.js').config} config
 * @returns {Promise<{ applications: import('./applications.js').ApplicationsRepository,
 *                     profile: import('./profile.js').ProfileRepository }>}
 */
export async function createRepositories(config) {
  if (config.isHosted) {
    return {
      applications: createHostedStub('applications'),
      profile:      createHostedStub('profile'),
    };
  }
  // Defer SQLite initialization to local mode only.
  const { db, initSchema } = await import('../db.js');
  initSchema(db);
  return {
    applications: createSqliteApplicationsRepository(db),
    profile:      createSqliteProfileRepository(db),
  };
}

/**
 * For use in tests only — accepts an in-memory db instance.
 * @param {import('better-sqlite3').Database} db
 */
export function createTestRepositories(db) {
  return {
    applications: createSqliteApplicationsRepository(db),
    profile:      createSqliteProfileRepository(db),
  };
}
```

**Expected behavior**:
- `await createRepositories({ isHosted: false })` → SQLite repositories backed by the
  default db; `initSchema` is called on first local use
- `await createRepositories({ isHosted: true })` → stub repositories; every method throws
  `HostedRepositoryNotImplementedError`
- `createTestRepositories(inMemoryDb)` → SQLite repositories backed by the given db

**Constraints**:
- Hosted stubs must implement all five application methods (`getAll`, `getById`,
  `create`, `update`, `archive`) and both profile methods (`get`, `upsert`).
- `HostedRepositoryNotImplementedError` must extend `Error` with `name` set to the
  class name, so it can be identified in tests via `error.name`.
- `createTestRepositories` must not call `initSchema` — the caller is responsible for
  schema initialization in test setup.

**Validation**: Tests in Task 02.4.

---

### [X] Task 02.4 — Add repository tests

**Target files**:
- `tests/server/repositories/applications.test.js` (new)
- `tests/server/repositories/profile.test.js` (new)
- `tests/server/repositories/stubs.test.js` (new)

**What to do**:

Each test file uses an in-memory SQLite database (same pattern as
`tests/server/applications.test.js`): `new Database(':memory:')` → `initSchema(db)` →
`createTestRepositories(db)`.

**`applications.test.js`** — SQLite adapter conformance:

- `getAll()` returns `[]` on empty db
- `create(fields)` returns a record with required fields (`id`, `companyName`,
  `jobTitle`, `status`, `lastStatusUpdate`, `createdAt`)
- `getById(id)` returns the record after `create`; returns `null` for unknown id
- `update(id, fields)` returns the updated record; `update(99999, {})` returns `null`
- `archive(id)` returns the record with `archived: true`; `archive(99999)` returns `null`

**`profile.test.js`** — SQLite adapter conformance:

- `get()` returns `null` when no profile saved
- `upsert(data)` saves and returns the profile
- `get()` after `upsert` returns the saved data

**`stubs.test.js`** — hosted stubs:

- Each method on `(await createRepositories({ isHosted: true })).applications` throws
  `HostedRepositoryNotImplementedError`; check methods: `getAll`, `getById`, `create`,
  `update`, `archive`
- Each method on `(await createRepositories({ isHosted: true })).profile` throws
  `HostedRepositoryNotImplementedError`; check methods: `get`, `upsert`
- The thrown error has `name === 'HostedRepositoryNotImplementedError'`
- The thrown error message contains `'019-supabase-persistence'`

**Validation**: `npm test -- tests/server/repositories/` must pass fully.

---

## Phase 03 — Route Migration (US1: Local Mode Preserved)

**Goal**: Migrate routes from `{ db }` to `{ repo }` and wire the new config +
repository factory into `server/index.js`. At the end of this phase, local mode must
be fully operational with all existing tests passing.

**Independent Test** (from spec.md US1): No env vars set; run `npm run server:dev`;
verify create, edit, filter, and profile all work without errors.

Depends on Phase 02. Tasks 03.1 and 03.2 are independent and can be done in parallel.

---

### [X] Task 03.1 [P] [US1] — Migrate `server/routes/applications.js` to use `repo`

**Target file**: `server/routes/applications.js`

**What to do**:

1. Change the factory signature from `createApplicationsRouter({ db } = {})` to
   `createApplicationsRouter({ repo } = {})`.

2. Remove the import of `{ archive, create, getAll, getById, update }` from
   `'../db/applications.js'`. The route will now call these through `repo`.

3. In every route handler, replace each direct db function call with its repo
   equivalent:

   | Before | After |
   |--------|-------|
   | `create(result.data, db)` | `repo.create(result.data)` |
   | `getAll(db)` | `repo.getAll()` |
   | `getById(id, db)` | `repo.getById(id)` |
   | `update(id, result.data, db)` | `repo.update(id, result.data)` |
   | `archive(id, db)` | `repo.archive(id)` |

   The transition gate (added in feature 015) uses `getById` to fetch the current
   record — change that call to `repo.getById(id)` as well.

4. The rest of the file (validation, error helpers, `parseIdParam`) is unchanged.

**Expected behavior**: All existing route behavior is identical — only the
implementation source changes from direct db calls to repository calls.

**Constraints**:
- `server/db/applications.js` must not be imported in this file after this task.
- The `isValidTransition` and `TERMINAL_STATES` imports from `../../shared/constants.js`
  are unchanged.
- `server/routes/resume.js` is out of scope — it does not use `db`.

**Validation**: Task 03.4 updates the tests. Run
`npm test -- tests/server/applications.test.js` after Task 03.4 to confirm.

---

### [X] Task 03.2 [P] [US1] — Migrate `server/routes/profile.js` to use `repo`

**Target file**: `server/routes/profile.js`

**What to do**:

1. Change the factory signature from `createProfileRouter({ db } = {})` to
   `createProfileRouter({ repo } = {})`.

2. Remove the import of `{ getProfile, saveProfile }` from `'../db/profile.js'`.

3. In route handlers:

   | Before | After |
   |--------|-------|
   | `getProfile(db)` | `repo.get()` |
   | `saveProfile(req.body, db)` | `repo.upsert(req.body)` |

4. The `validateProfile` import and validation logic are unchanged.

**Constraints**: `server/db/profile.js` must not be imported in this file after this task.

**Validation**: Task 03.5 updates the tests. Run
`npm test -- tests/server/profile.test.js` after Task 03.5.

---

### [X] Task 03.3 [US1] — Update `server/index.js` to wire config and repositories

**Target file**: `server/index.js`

**Depends on**: Tasks 03.1, 03.2.

**What to do**:

1. Add imports at the top:
   ```js
   import { config } from './config.js';
   import { createRepositories } from './repositories/index.js';
   ```

2. Change `createApp({ db } = {})` to `createApp({ repositories })` (no default — see
   Constraints below).

3. Inside `createApp`, update the two router calls:
   ```js
   // Before:
   app.use('/api/applications', createApplicationsRouter({ db }));
   app.use('/api/profile', createProfileRouter({ db }));

   // After:
   app.use('/api/applications', createApplicationsRouter({ repo: repositories.applications }));
   app.use('/api/profile', createProfileRouter({ repo: repositories.profile }));
   ```

4. At the bottom of the file (the `import.meta.url` guard — the local entry point),
   replace the bare `createApp()` call:
   ```js
   // Before:
   const app = createApp();
   app.listen(PORT, () => { ... });

   // After:
   const repositories = await createRepositories(config);
   const app = createApp({ repositories });
   app.listen(config.port, () => {
     console.log(`[config] Runtime mode: ${config.runtime}`);
     console.log(`Alice API server listening on http://localhost:${config.port}`);
   });
   ```

5. Remove the hardcoded `const PORT = 3001;` line — the port now comes from `config.port`.

**Expected behavior**:
- `node server/index.js` with no env vars → logs `[config] Runtime mode: local` and
  starts on port 3001
- `createApp({ repositories })` is exported and usable by tests and `api/index.js`

**Constraints**:
- Keep the `createApp({ repositories })` signature with no default. Missing repositories
  should produce a clear error at the first request, not silent undefined behavior.
- `server/db.js`, `server/db/applications.js`, `server/db/profile.js` are not imported
  in this file — those imports now live inside `server/repositories/`.

---

### [X] Task 03.4 [US1] — Update `tests/server/applications.test.js` to use `createTestRepositories`

**Target file**: `tests/server/applications.test.js`

**What to do**:

1. Add `createTestRepositories` to the imports from the repositories module:
   ```js
   import { createTestRepositories } from '../../server/repositories/index.js';
   ```

2. In the test setup (the `beforeEach` or top-level setup that calls `createApp`),
   replace `createApp({ db })` with:
   ```js
   const repositories = createTestRepositories(db);
   app = createApp({ repositories });
   ```

3. The in-memory db setup (`new Database(':memory:')` → `initSchema(db)`) is unchanged.

4. All test assertions are unchanged — only the `createApp` call changes.

**Constraints**:
- `db` must still be created and `initSchema(db)` called in test setup — the schema
  initialization is now the test's responsibility (not `createRepositories`).
- Do not change any test assertions, route expectations, or fixture data.

**Validation**: `npm test -- tests/server/applications.test.js` must pass in full.

---

### [X] Task 03.5 [US1] — Update `tests/server/profile.test.js` to use `createTestRepositories`

**Target file**: `tests/server/profile.test.js`

**What to do**: Same pattern as Task 03.4 — add `createTestRepositories` import,
replace `createApp({ db })` with `createApp({ repositories: createTestRepositories(db) })`.

**Validation**: `npm test -- tests/server/profile.test.js` must pass in full.

---

### [X] Task 03.6 [US1] — Run full test suite to confirm local mode regression-free

**Command**: `npm test`

**Pass criteria**:
- All pre-existing tests pass without any assertion changes.
- Only test setup blocks (Task 03.4, 03.5) should have changed.
- If any test fails unexpectedly, diagnose and fix before proceeding to Phase 04.

**This is the US1 checkpoint**: At this point, local mode is fully functional via the
new repository layer and the independent test from spec.md US1 can be manually verified.

---

## Phase 04 — Hosted Mode & Vercel Config (US2: Hosted Runtime Initializes)

**Goal**: The server boots successfully with `APP_RUNTIME=hosted` and valid env vars.
`api/index.js` and `vercel.json` are in place for Vercel deployment.

**Independent Test** (from spec.md US2): Set `APP_RUNTIME=hosted` plus all three
Supabase env vars; run `node server/index.js`; confirm it logs "hosted mode active"
and starts without error.

Depends on Phase 03 (routes are wired). Tasks 04.1 and 04.2 are independent.

---

### [X] Task 04.1 [P] [US2] — Create `api/index.js` (Vercel Function entry point)

**Target file**: `api/index.js` (new)

**What to do**:

```js
import { config } from '../server/config.js';
import { createRepositories } from '../server/repositories/index.js';
import { createApp } from '../server/index.js';

const repositories = await createRepositories(config);
export default createApp({ repositories });
```

This file is the Vercel serverless handler. Vercel invokes it as a Node.js module;
the default export (an Express app) is used as the request handler.

**Expected behavior**:
- When deployed to Vercel with valid hosted env vars: module loads, config validates,
  stub repositories created, Express app exported.
- When deployed with missing env vars: `loadConfig()` throws at module import time;
  Vercel reports a cold-start error.

**Constraints**:
- This file must not contain any route logic — it only wires config + repos + app.
- The `import.meta.url` guard in `server/index.js` ensures `app.listen()` is not
  called in this file (the guard is false when imported as a module).

---

### [X] Task 04.2 [P] [US2] — Create `vercel.json`

**Target file**: `vercel.json` (new, at repo root)

**What to do**:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/index" }
  ]
}
```

**Expected behavior**:
- `vercel build` runs `npm run build` and serves the Vite output from `dist/`.
- All requests to `/api/*` are forwarded to `api/index.js`.
- All other requests are served from the static `dist/` output (Vercel's default SPA
  fallback handles client-side routing).

**Constraints**:
- Do not add a `functions` key or a `builds` key — the `rewrites` approach is sufficient
  and uses the default `@vercel/node` runtime for `api/index.js`.
- `dist/` is already in `.gitignore`; do not change that.

---

### [X] Task 04.3 [US2] — Manually verify hosted mode boots

**How to test** (from `quickstart.md` Path 2):

```bash
APP_RUNTIME=hosted \
  SUPABASE_URL=https://example.supabase.co \
  SUPABASE_ANON_KEY=eyJexample \
  SUPABASE_SERVICE_ROLE_KEY=eyJexample \
  node server/index.js
```

**Pass criteria**:
1. Server starts without throwing.
2. Console output contains `[config] Runtime mode: hosted`.
3. `GET http://localhost:3001/api/health` → `{ "status": "ok" }` (health check is not
   repository-backed; it must still pass).
4. `GET http://localhost:3001/api/applications` → HTTP 500 with an error message
   containing `"HostedRepositoryNotImplementedError"` or the `019` reference (stub
   behavior is intentional).

**Pass criteria for config failure** (from `quickstart.md` Path 3):

```bash
APP_RUNTIME=hosted node server/index.js
# Expected: process exits with error naming SUPABASE_URL
```

```bash
APP_RUNTIME=unknown node server/index.js
# Expected: process exits with "Invalid APP_RUNTIME" error
```

---

## Phase 05 — Documentation (US3: Onboarding Reproducible)

**Goal**: A new contributor can reproduce the Vercel + Supabase setup from the docs
alone. Tasks 05.1 and 05.2 are independent and can be written in parallel.

**Independent Test** (from spec.md US3): Follow each documented step from scratch;
verify no missing steps and that the expected outcome is produced at each step.

---

### [X] Task 05.1 [P] [US3] — Create `.env.example`

**Target file**: `.env.example` (new, at repo root)

**What to do**:

Document every environment variable with scope and requirement annotations. Example
structure:

```bash
# ─── Runtime ────────────────────────────────────────────────────────────────
# Controls which persistence mode the server uses.
# Values: "local" (default) | "hosted"
# Required in hosted mode; omit or leave blank for local development.
APP_RUNTIME=

# Optional: override the API server port (default: 3001)
PORT=

# ─── Local Development ──────────────────────────────────────────────────────
# Optional: override the SQLite database file path (default: data/alice.db)
ALICE_DB_PATH=

# ─── Hosted Mode — Supabase ─────────────────────────────────────────────────
# All three variables below are required when APP_RUNTIME=hosted.
# Obtain from your Supabase project → Settings → API.

# Your Supabase project URL (client-safe; safe to expose in browser code)
SUPABASE_URL=

# Your Supabase anon/public key (client-safe; safe to expose in browser code)
SUPABASE_ANON_KEY=

# !! SERVER ONLY — NEVER expose this key in browser code or VITE_ prefixed vars !!
# Your Supabase service role key. Has full database access; treat as a secret.
SUPABASE_SERVICE_ROLE_KEY=
```

**Constraints**:
- `SUPABASE_SERVICE_ROLE_KEY` must have a prominent warning that it must never be
  exposed to the frontend (no `VITE_` prefix, not in client code).
- All values must be blank — `.env.example` is a template, not a real secrets file.

---

### [X] Task 05.2 [P] [US3] — Create `docs/deployment.md`

**Target file**: `docs/deployment.md` (new)

**What to do**:

Write a deployment guide covering all three spec.md US3 acceptance scenarios. Include
all of the following sections:

1. **Overview** — Summarize local vs hosted mode and what each uses (1–2 paragraphs).

2. **Local Development Setup** — `npm install`, `npm run server:dev`, `npm run dev`,
   no env vars required.

3. **Supabase Project Setup**:
   - Create a new Supabase project at supabase.com
   - Navigate to Settings → API
   - Copy the Project URL → `SUPABASE_URL`
   - Copy the `anon public` key → `SUPABASE_ANON_KEY`
   - Copy the `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`
   - Note: The Supabase schema (tables) is not yet provisioned by this feature — see
     feature 019 for the migration step.

4. **Vercel Project Setup**:
   - Link repository in Vercel dashboard
   - Framework preset: Other (Vite output is in `dist/`, already set in `vercel.json`)
   - Set environment variables in Vercel dashboard: `APP_RUNTIME=hosted` plus the
     three Supabase vars. Mark `SUPABASE_SERVICE_ROLE_KEY` as sensitive/server-only.
   - Deploy.

5. **Environment Variable Reference** — Table matching the one in
   `contracts/api.md`: variable name, scope, local required, hosted required, description.

6. **Local vs Hosted Differences** — Table summarizing what changes between modes:
   persistence layer, env vars needed, API behavior in hosted (HTTP 500 until 019).

7. **Architecture Overview** — Brief diagram or bulleted description: Vite frontend →
   Vercel static hosting; Express API → Vercel Function (`api/index.js`); data → Supabase
   Postgres (feature 019).

**Constraints**:
- Do not document steps for features not yet implemented (auth, RLS, migrations).
- Reference the relevant future feature numbers (018, 019) where applicable so a reader
  knows what is coming.

---

## Phase 06 — Quality Gate

Run after all phases are complete.

---

### [X] Task 06.1 — Run full test suite and resolve all failures

**Command**: `npm test`

**Expected result**: All tests pass.

**Known tests to double-check** if failures occur:

| Test file | What to verify |
|-----------|----------------|
| `tests/server/applications.test.js` | Setup passes `createTestRepositories(db)` (Task 03.4) |
| `tests/server/profile.test.js` | Setup passes `createTestRepositories(db)` (Task 03.5) |
| `tests/server/config.test.js` | All 9 config scenarios pass (Task 01.2) |
| `tests/server/repositories/` | All three adapter/stub test files pass (Task 02.4) |

---

### [X] Task 06.2 — Run lint and confirm no new violations

**Command**: `npm run lint`

Resolve any ESLint errors introduced by the new files before marking this task done.
Unused imports, missing semicolons (if applicable to the project's rules), and stray
`console.log` calls are the most likely issues.

---

### [X] Task 06.3 — Complete plan-review checklist

**File**: `specs/017-hosted-foundation/checklists/plan-review.md`

Work through every checkbox. For any item that cannot be confirmed, document it inline
with reason and residual risk. All items in the "Config Contract" and "Repository
Abstraction" sections are required to pass before this feature is accepted.

---

### [X] Task 06.4 — Manual smoke test: local mode

Follow `quickstart.md` Path 1 (local mode baseline). Start the dev stack with no env
vars; verify create, edit, filter, and profile all function without errors.

**Pass criteria**: All operations succeed. No console errors. `npm test` still passes
after any debugging changes made during this test.

---

### [X] Task 06.5 — Manual smoke test: hosted mode boots and fails loudly

Follow `quickstart.md` Path 2 (hosted mode boot) and Path 3 (config failure).

**Pass criteria**:
1. Server logs `[config] Runtime mode: hosted` and stays up when valid env vars are set.
2. `GET /api/health` returns `{ "status": "ok" }` in hosted mode.
3. `GET /api/applications` in hosted mode returns HTTP 500 with an error referencing
   the unimplemented repository (not a silent empty array).
4. Missing a hosted env var causes immediate process exit with a message naming the
   variable.
5. `APP_RUNTIME=unknown` causes immediate process exit with an "Invalid APP_RUNTIME"
   message.

---

### [X] Task 06.6 — Verify `SUPABASE_SERVICE_ROLE_KEY` absent from Vite bundle (SC-004)

SC-004 requires that the service role *secret* never reach the frontend bundle. A name
check alone is insufficient — a renamed/aliased variable could still leak the value.
This task therefore checks for both the variable name AND a known sentinel value.

**What to do**:

1. Build the frontend with a sentinel service-role value:
   ```
   SUPABASE_SERVICE_ROLE_KEY=alice_sentinel_do_not_ship npm run build
   ```
   (PowerShell: `$env:SUPABASE_SERVICE_ROLE_KEY = 'alice_sentinel_do_not_ship'; npm run build`)
2. Grep the entire `dist/` directory for the sentinel value:
   ```
   grep -r "alice_sentinel_do_not_ship" dist/
   ```
3. Grep the entire `dist/` directory for the variable name:
   ```
   grep -r "SUPABASE_SERVICE_ROLE_KEY" dist/
   ```
4. Assert both greps produce no output (zero matches).

**Pass criteria**: Both greps produce no output. Any match — whether the name OR the
sentinel value — is a critical security failure. The service role key bypasses Supabase
Row Level Security and must never reach the browser bundle.

**What to investigate if a match is found**:
- Sentinel value match: the secret is being inlined into the bundle. Look for a
  `VITE_SUPABASE_SERVICE_ROLE_KEY` alias, `define` config in `vite.config.js`, or
  `import.meta.env` references in frontend code.
- Variable name match: the identifier was picked up by Vite — usually via a `VITE_`
  prefix or an accidental `import.meta.env.SUPABASE_SERVICE_ROLE_KEY` reference.

The fix is to remove the `VITE_` prefix and eliminate any frontend reference. The key
belongs in `process.env` on the server only.

**Cleanup**: After the test, unset the sentinel before any subsequent dev/test commands
so it does not pollute later runs.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 01** (Config): No dependencies — start immediately
- **Phase 02** (Repository layer): Depends on Phase 01 complete
- **Phase 03** (Route migration / US1): Depends on Phase 02 complete
- **Phase 04** (Hosted mode / US2): Depends on Phase 03 complete
- **Phase 05** (Documentation / US3): Depends on Phase 03 complete; independent of Phase 04
- **Phase 06** (Quality Gate): Depends on all prior phases

### Parallel Opportunities Within Phases

- **Phase 02**: T02.1 and T02.2 (independent adapter files) can be written in parallel
- **Phase 03**: T03.1 and T03.2 (independent route files) can be written in parallel
- **Phase 04**: T04.1 and T04.2 (independent new files) can be written in parallel
- **Phase 05**: T05.1 and T05.2 (independent new files) can be written in parallel

### MVP Scope

Phase 01 + Phase 02 + Phase 03 delivers US1 (local mode preserved with new architecture).
This is the minimum needed before any hosted feature can build on top.
Phases 04 and 05 complete the feature per the spec.

---

## Notes

- `[P]` = different files, no cross-task dependency; safe to implement in parallel
- `[US1]`, `[US2]`, `[US3]` = the user story this task satisfies
- `server/db/applications.js`, `server/db/profile.js`, `server/db.js` must not be
  modified at any point in this feature — they are consumed by the repository adapters
  but not changed
- No browser smoke test phase — this feature has no user-facing UI changes
