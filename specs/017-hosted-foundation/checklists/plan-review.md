# Plan Review Checklist: Hosted Deployment Foundation (017)

Complete before generating tasks. Check each item; document any skip with reason
and residual risk.

---

## Constitution Compliance

- [x] Required fields (`company_name`, `job_title`, `status`, `last_status_update`,
  `responsibilities`) are unaffected — no schema or validation changes
- [x] Business logic remains in the API layer; frontend gains no new direct data access
- [x] Validation rules are centralized and unchanged; repository layer does not duplicate them
- [x] No new external analytics, tracking, or data sharing introduced
- [x] Local-first default preserved: `APP_RUNTIME` defaults to `"local"` when absent
- [x] No silent data corruption: validation behavior is unchanged; repository stubs fail
  loud (500) rather than silently returning empty data
- [x] Desktop/mobile support unaffected — no UI changes

---

## Config Contract

- [x] `APP_RUNTIME` absent → defaults to `"local"` with no error
- [x] `APP_RUNTIME` invalid value → throws with message naming valid values
- [x] Each missing hosted env var → throws a separate error naming that specific variable
- [x] Partial hosted config with `APP_RUNTIME=local` → valid; extra vars ignored
- [x] `SUPABASE_SERVICE_ROLE_KEY` has no `VITE_` prefix anywhere in the plan
- [x] Config is validated at module load time (before `app.listen()`)
- [x] `config` object is frozen to prevent mutation

---

## Repository Abstraction

- [x] `server/db/applications.js` and `server/db/profile.js` are **unchanged**
- [x] `server/repositories/` wraps them into the defined interface — no logic duplication
- [x] Both `ApplicationsRepository` and `ProfileRepository` interfaces are fully
  documented in `contracts/api.md`
- [x] Route factories change from `{ db }` to `{ repo }` — every db call becomes a
  repo method call
- [x] `createTestRepositories(db)` exported for test use; no test logic changes beyond
  using the helper
- [x] Hosted stubs throw `HostedRepositoryNotImplementedError` (not silent no-ops)

---

## Vercel Deployment Config

- [x] `vercel.json` routes `/api/:path*` to `api/index.js`
- [x] `vercel.json` sets `outputDirectory: "dist"` and `buildCommand: "npm run build"`
- [x] `api/index.js` wires config + repositories and exports the Express app as default
- [x] SQLite (native module) confirmed unusable in Vercel serverless; plan documents
  this constraint explicitly — no workaround attempted

---

## HTTP API Surface

- [x] No routes added, removed, or changed
- [x] Request/response schemas unchanged
- [x] Error response shapes unchanged
- [x] `GET /api/health` continues to work in both modes

---

## Test Coverage

- [x] `tests/server/config.test.js` planned: valid local, valid hosted, missing var
  (each), invalid runtime value, partial hosted + local mode
- [x] `tests/server/repositories/applications.test.js` planned: interface conformance
  against SQLite adapter (getAll, getById, create, update, archive)
- [x] `tests/server/repositories/profile.test.js` planned: interface conformance against
  SQLite adapter (get, upsert)
- [x] Existing `tests/server/applications.test.js` and `tests/server/profile.test.js`
  updated to use `createTestRepositories(db)` helper — no logic change expected
- [x] Hosted stub throws the right error class — tested in
  `tests/server/repositories/stubs.test.js`

---

## Documentation

- [x] `docs/deployment.md` planned to cover: Vercel project setup, Supabase project
  setup, env var configuration, local vs hosted differences, architecture overview
- [x] `.env.example` documents all variables with scope and requirement annotations
- [x] Supabase schema plan captured in `data-model.md` with field types, ownership
  columns, and RLS readiness notes

---

## Backward Compatibility

- [x] Local mode: existing behavior identical — same SQLite db functions, same routes,
  same validation
- [x] All existing automated tests pass after the `{ db }` → `{ repositories }` change
  (via `createTestRepositories` helper)
- [x] No npm dependencies added yet (Supabase client deferred to feature 019)
- [x] `server/db.js`, `server/db/applications.js`, `server/db/profile.js` are not
  modified

---

## Skipped Items

_None at time of plan authoring. Document any skips here with reason and residual risk
before generating tasks._
