# Implementation Plan: Hosted Deployment Foundation (017)

**Branch**: `017-hosted-foundation` | **Date**: 2026-05-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/017-hosted-foundation/spec.md`

---

## Summary

Introduce the hosted deployment architecture for Project Alice by:
1. Adding a centralized runtime config module (`server/config.js`) that validates environment variables at startup and distinguishes `local` from `hosted` mode.
2. Adding a repository abstraction layer (`server/repositories/`) that decouples route handlers from the SQLite implementation, enabling future Supabase repositories to be wired in without touching route code.
3. Wiring up a Vercel Function entry point (`api/index.js`) and `vercel.json` routing config.
4. Documenting the Supabase schema plan and hosted deployment setup.

No user-facing behavior changes. Local SQLite mode is fully preserved.

---

## Technical Context

**Language/Version**: Node.js ≥ 20.19.0, JavaScript (ESM)
**Primary Dependencies**: Express 4, better-sqlite3, Vite 8, Vitest 4
**Storage**: SQLite (local mode); Supabase Postgres planned (hosted mode, feature 019)
**Testing**: Vitest
**Target Platform**: Local Node.js (dev); Vercel serverless (hosted)
**Project Type**: Web application — Vite frontend + Express API
**Performance Goals**: No new performance requirements; local-first behavior unchanged
**Constraints**: `better-sqlite3` (native module) cannot run in Vercel Functions — SQLite is local-only. Hosted persistence deferred to feature 019.
**Scale/Scope**: Single-user local tracker → foundation for hosted single-user deployment

---

## Constitution Check

- [x] Required application fields (`company_name`, `job_title`, `status`, `last_status_update`, `responsibilities`) are preserved — no schema or validation changes
- [x] Business logic stays server-side; frontend gains no direct database access
- [x] Validation rules remain centralized in `server/validation/`; repository layer does not duplicate them
- [x] No external analytics, tracking, or data sharing introduced
- [x] Local-first default: `APP_RUNTIME` absent → `"local"` mode
- [x] No silent data corruption: hosted stubs throw rather than silently return empty data
- [x] UI unchanged — desktop/mobile, keyboard nav, accessibility unaffected
- [x] Data model extensibility preserved; no overbuilding of future features

**Complexity Tracking**:

| Complexity item | Why needed | Simpler alternative rejected because |
|----------------|------------|--------------------------------------|
| Repository abstraction layer | FR-007: routes must not depend on SQLite directly; Supabase support requires swappable implementations | Direct imports can't be swapped without touching every route file |
| `api/index.js` Vercel entry point | Vercel requires a default export handler; existing `server/index.js` uses `import.meta.url` guard for CLI-style startup | Restructuring `server/index.js` would break local dev startup |

---

## Project Structure

```text
server/
├── config.js                    # NEW — runtime config validation
├── index.js                     # MODIFIED — createApp({ repositories })
├── db.js                        # unchanged
├── db/
│   ├── applications.js          # unchanged (SQLite implementation)
│   └── profile.js               # unchanged (SQLite implementation)
├── repositories/
│   ├── index.js                 # NEW — factory: createRepositories(config), createTestRepositories(db)
│   ├── applications.js          # NEW — SQLite adapter implementing ApplicationsRepository
│   └── profile.js               # NEW — SQLite adapter implementing ProfileRepository
├── routes/
│   ├── applications.js          # MODIFIED — { db } → { repo }
│   ├── profile.js               # MODIFIED — { db } → { repo }
│   └── resume.js                # unchanged
└── validation/                  # unchanged

api/
└── index.js                     # NEW — Vercel Function entry point

vercel.json                      # NEW — build + rewrite config
.env.example                     # NEW — all env vars documented

docs/
└── deployment.md                # NEW — hosted setup guide

tests/
└── server/
    ├── config.test.js           # NEW
    ├── repositories/
    │   ├── applications.test.js # NEW
    │   ├── profile.test.js      # NEW
    │   └── stubs.test.js        # NEW
    ├── applications.test.js     # MODIFIED — use createTestRepositories(db)
    └── profile.test.js          # MODIFIED — use createTestRepositories(db)
```

---

## Architecture

### Runtime Config (`server/config.js`)

Loaded once at process startup via module-level evaluation. If it throws, the process
exits before accepting connections — no partial startup state.

```
process.env
  → loadConfig()
      → validate APP_RUNTIME (default: 'local')
      → if hosted: validate SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
      → return Object.freeze({ runtime, isHosted, port, supabase })
  → export config
```

### Repository Factory (`server/repositories/index.js`)

```
createRepositories(config)
  → local:  { applications: createSqliteApplicationsRepository(db),
               profile:      createSqliteProfileRepository(db) }
  → hosted: { applications: createHostedStub('applications'),
               profile:      createHostedStub('profile') }
```

Hosted stubs implement the full interface but every method throws
`HostedRepositoryNotImplementedError`. The server starts; requests fail with HTTP 500
until feature 019 replaces the stubs with Supabase implementations.

`createTestRepositories(db)` is the same as the local path but accepts an arbitrary
`better-sqlite3` instance — used by test files to pass in-memory databases.

### App Factory (`server/index.js`)

```
createApp({ repositories })
  → createApplicationsRouter({ repo: repositories.applications })
  → createProfileRouter({ repo: repositories.profile })
  → createResumeRouter()                               (unchanged)
  → error handler                                      (unchanged)
```

### Entry Points

**Local dev**: The bottom of `server/index.js` (the `import.meta.url` guard) calls
`await createRepositories(config)` → `createApp({ repositories })` → `app.listen(port)`.

**Vercel**: `api/index.js` calls `await createRepositories(config)` → `createApp({ repositories })`
→ exports `app` as the default export. Vercel treats it as a serverless handler.
`createRepositories` is async because it defers the SQLite import (`server/db.js`) so
hosted cold starts never load `better-sqlite3`.

### Vercel Routing

```
vercel.json
  buildCommand:    "npm run build"
  outputDirectory: "dist"
  rewrites:
    /api/:path*  →  /api/index    (Express handler)
    /**          →  /index.html   (SPA fallback — handled by Vercel default)
```

---

## Data Flow

```
Request: GET /api/applications

Client
  → Vite proxy (dev) or Vercel rewrite (hosted)
  → Express app
  → createApplicationsRouter
  → router.get('/')
  → repo.getAll()
      local:  getAll(db) from server/db/applications.js
      hosted: throws HostedRepositoryNotImplementedError → 500
  → res.json({ data: records })
```

```
Server startup (local)

node server/index.js
  → import server/config.js
      APP_RUNTIME absent → runtime = 'local'
      no hosted validation required
      config = { runtime: 'local', isHosted: false, port: 3001, supabase: null }
  → await createRepositories(config)
      dynamic import of server/db.js (SQLite only loaded here)
      initSchema(db)
      SQLite repositories created
  → createApp({ repositories })
  → app.listen(3001)
  → logs: "[config] Runtime mode: local"
```

```
Server startup (hosted, valid config)

node server/index.js (or Vercel cold start of api/index.js)
  → import server/config.js
      APP_RUNTIME=hosted
      SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY all present
      config = { runtime: 'hosted', isHosted: true, port: 3001, supabase: { ... } }
  → await createRepositories(config)
      hosted stub repositories created (server/db.js never imported — no SQLite init)
  → createApp({ repositories })
  → logs: "[config] Runtime mode: hosted"
  → server ready (requests fail at repo call with 500 until feature 019)
```

---

## Affected Areas

### Files to modify

| File | Change |
|------|--------|
| `server/index.js` | `createApp({ db })` → `createApp({ repositories })`; wire config + repos at entry point |
| `server/routes/applications.js` | `createApplicationsRouter({ db })` → `({ repo })`; all db calls → repo method calls |
| `server/routes/profile.js` | `createProfileRouter({ db })` → `({ repo })`; db calls → repo method calls |
| `tests/server/applications.test.js` | Pass `createTestRepositories(db)` instead of `{ db }` |
| `tests/server/profile.test.js` | Pass `createTestRepositories(db)` instead of `{ db }` |

### Files to add

| File | Purpose |
|------|---------|
| `server/config.js` | Runtime config with startup validation |
| `server/repositories/index.js` | Repository factory + test helper |
| `server/repositories/applications.js` | SQLite adapter for ApplicationsRepository |
| `server/repositories/profile.js` | SQLite adapter for ProfileRepository |
| `api/index.js` | Vercel Function entry point |
| `vercel.json` | Build + rewrite rules |
| `.env.example` | Env var documentation |
| `docs/deployment.md` | Hosted setup guide |
| `tests/server/config.test.js` | Config validation unit tests |
| `tests/server/repositories/applications.test.js` | SQLite adapter conformance tests |
| `tests/server/repositories/profile.test.js` | SQLite adapter conformance tests |
| `tests/server/repositories/stubs.test.js` | Hosted stub throws correct error |

### Files to inspect (no expected modification)

| File | Reason |
|------|--------|
| `server/db.js` | Exports `db` (sqlite instance) and `initSchema`. Used by the SQLite repository adapter; unchanged. |
| `server/db/applications.js` | SQLite implementation; wrapped by the new adapter; not modified. |
| `server/db/profile.js` | SQLite implementation; wrapped by the new adapter; not modified. |
| `server/routes/resume.js` | Does not use `db`; unaffected by the repo change. |
| `server/validation/` | Validation logic is unchanged; still called by route handlers. |
| `shared/constants.js` | Unchanged. |
| `src/` (frontend) | No changes. No new env vars exposed to the frontend bundle. |
| `vite.config.js` | Proxy config unchanged for local dev. |

### Areas explicitly out of scope

- Authentication (feature 018)
- Supabase persistence implementation (feature 019)
- Resume upload restrictions (feature 021)
- Row Level Security
- Demo mode
- Any frontend changes

---

## Risks and Tradeoffs

### Route signature change breaks existing tests

`createApplicationsRouter({ db })` → `({ repo })` is a breaking change to the factory
signature used by test files. Mitigated by `createTestRepositories(db)` — tests
construct the helper once and pass the result. The change is mechanical and confined to
test setup blocks.

### `better-sqlite3` unusable in Vercel Functions

SQLite is a native module requiring a writable filesystem — both unavailable in Vercel's
serverless environment. This is a hard constraint, documented in research.md D-004. The
mitigation is the stub repository: the server boots, but hosted persistence is explicitly
deferred to feature 019.

### Hosted stub requests return 500

Until feature 019 ships, any API request in hosted mode returns HTTP 500. This is
intentional and acceptable for a foundation feature. The error message clearly identifies
the cause (`HostedRepositoryNotImplementedError`), making it easy to diagnose.

### `vercel.json` rewrite catches all `/api/*` paths

If new API routes are added later, they are automatically covered by the rewrite without
any change to `vercel.json`. The tradeoff is all routes bundle into a single Vercel
Function — acceptable for a small application.

### Config throws at import time (not on first request)

Module-level config validation means a bad deploy will fail at cold start, not on the
first user request. This is the correct tradeoff — it surfaces config errors immediately
and prevents a partially-healthy server from appearing healthy.

---

## Validation Approach

**Config unit tests** (`tests/server/config.test.js`):
- `APP_RUNTIME` absent → `runtime === 'local'`, no throw
- `APP_RUNTIME=local` → config resolves; `supabase === null`
- `APP_RUNTIME=hosted` with all vars → config resolves; `isHosted === true`
- `APP_RUNTIME=hosted`, missing `SUPABASE_URL` → throws naming `SUPABASE_URL`
- `APP_RUNTIME=hosted`, missing `SUPABASE_ANON_KEY` → throws naming `SUPABASE_ANON_KEY`
- `APP_RUNTIME=hosted`, missing `SUPABASE_SERVICE_ROLE_KEY` → throws naming `SUPABASE_SERVICE_ROLE_KEY`
- `APP_RUNTIME=unknown` → throws naming valid values
- `APP_RUNTIME=local` with all hosted vars present → valid; resolves `local`

**Repository interface tests** (`tests/server/repositories/`):
- SQLite applications adapter: `getAll`, `getById`, `create`, `update`, `archive` return correct shapes with an in-memory db
- SQLite profile adapter: `get`, `upsert` return correct shapes
- Hosted stub: all methods throw `HostedRepositoryNotImplementedError`

**Regression tests** (existing test files, modified setup only):
- All existing `applications.test.js` and `profile.test.js` scenarios pass unchanged after switching to `createTestRepositories(db)`

**Manual smoke**:
- Local mode: full CRUD workflow works with no env vars set (US1)
- Hosted mode: server boots and logs runtime mode with valid env vars (US2)
- Invalid config: server exits immediately with a descriptive error (US2 AC2)
- Follow `quickstart.md` test script for each path
