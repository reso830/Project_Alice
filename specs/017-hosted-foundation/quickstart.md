# Quickstart: Hosted Deployment Foundation (017)

---

## Local Development (unchanged)

```bash
npm install

# Start API server
npm run server:dev

# Start frontend dev server (separate terminal)
npm run dev
```

App: `http://localhost:5173` (Vite proxy forwards `/api` to `http://localhost:3001`)

No environment variables are required for local mode. `APP_RUNTIME` defaults to
`"local"` when absent.

---

## Run Tests

```bash
# All tests
npm test

# Config validation tests
npm test -- tests/server/config.test.js

# Repository interface tests
npm test -- tests/server/repositories/

# Regression: existing server routes still work
npm test -- tests/server/applications.test.js tests/server/profile.test.js
```

---

## Testing Hosted Mode Locally

To verify hosted mode config validation without a real Supabase project:

```bash
# Valid hosted config — server should boot and log "hosted mode active"
APP_RUNTIME=hosted \
  SUPABASE_URL=https://example.supabase.co \
  SUPABASE_ANON_KEY=eyJexample \
  SUPABASE_SERVICE_ROLE_KEY=eyJexample \
  node server/index.js
```

Expected output:
```
[config] Runtime mode: hosted
Alice API server listening on http://localhost:3001
```

API requests in hosted mode will return HTTP 500 (stub repositories not yet
implemented). That is expected — the goal here is confirming the server boots.

---

## Testing Config Validation Failures

```bash
# Missing APP_RUNTIME=hosted env var — should fail with named variable
APP_RUNTIME=hosted node server/index.js
# Expected: Error: Missing required environment variable for hosted mode: SUPABASE_URL

# Unrecognized runtime — should fail immediately
APP_RUNTIME=production node server/index.js
# Expected: Error: Invalid APP_RUNTIME: "production". Valid values: "local", "hosted".
```

---

## Manual Smoke Test Script

### Path 1 — Local mode baseline (no regression)

1. Start the local stack with no env vars set
2. Create a new application — verify it saves and appears in the list
3. Edit the application — verify changes persist
4. Filter by status — verify filtering works
5. Load the Profile page — verify it renders and can be saved
6. Verify no console errors related to config or repositories

### Path 2 — Hosted mode boots without crashing

1. Set `APP_RUNTIME=hosted` plus valid Supabase URL/keys
2. Start `node server/index.js`
3. Verify the server starts and logs the runtime mode
4. Make a `GET /api/health` request — expect `{ status: 'ok' }`
5. Make a `GET /api/applications` request — expect HTTP 500 with a clear error
   (stub not implemented)
6. Verify the error message mentions "hosted persistence not yet implemented"

### Path 3 — Invalid config fails fast

1. Set `APP_RUNTIME=hosted` with one required var missing
2. Attempt to start the server
3. Verify the process exits immediately with an error naming the missing variable

---

## Common Issues

**Server starts but all API requests return 500 in hosted mode**
→ Expected. Supabase repositories are stubs in this feature. See feature 019.

**`better-sqlite3` error when deploying to Vercel**
→ Expected. SQLite is not supported in Vercel serverless functions. The SQLite
repository layer is local-only. Feature 019 implements the Supabase layer.

**Existing tests fail after the `{ db }` → `{ repositories }` change**
→ Tests that call `createApp({ db })` need to be updated to pass
`createSqliteRepositories(db)` from `server/repositories/index.js`. See the test
migration notes in `tasks.md`.

**`SUPABASE_SERVICE_ROLE_KEY` appears in the Vite bundle**
→ Check that the variable is not prefixed with `VITE_` anywhere in config or
`.env` files. Only `VITE_`-prefixed vars are exposed to the browser bundle.
