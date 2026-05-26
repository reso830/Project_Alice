# Research & Decisions: Hosted Deployment Foundation (017)

---

## D-001 — How to deploy Express to Vercel?

**Context**: The current server is a standard Express app started with `node server/index.js`.
Vercel is a serverless platform that does not run a persistent Node.js process.

**Options considered:**

| Approach | Pros | Cons |
|----------|------|------|
| Express adapter via `vercel.json` rewrite + `api/index.js` entry point | Minimal code change; existing Express routes unchanged; single function handles all `/api/*` | Cold starts may be slower; all routes share one function bundle |
| Rewrite each route as a native Vercel Function (`api/applications.js`, etc.) | Fine-grained cold start; Vercel-idiomatic | Significant refactor; loses Express middleware chain |
| Use `@vercel/node` runtime with the existing `server/index.js` | Familiar; documented pattern | More configuration complexity; mixing concerns between dev and prod entrypoints |

**Decision**: Express adapter via a new `api/index.js` entry point.
- `api/index.js` imports `createApp` from `server/index.js`, wires up repositories, and exports the Express app as the default export.
- `vercel.json` rewrites `/api/:path*` to `/api/index` and serves the Vite `dist/` output for everything else.
- This preserves all existing Express route code with no changes.

**Rationale**: The constitution requires readable, direct architecture over clever abstractions. The adapter approach adds one small file and a config; it does not require restructuring the route layer.

---

## D-002 — Repository abstraction: how much indirection?

**Context**: Routes currently import functions directly from `server/db/applications.js` and
`server/db/profile.js`. These SQLite-specific functions cannot be swapped for Supabase
without changing every import site.

**Options considered:**

| Approach | Pros | Cons |
|----------|------|------|
| Keep `server/db/` imports; document future refactor | Zero change now | Doesn't satisfy FR-007; future migration is harder |
| Create `server/repositories/` factory; routes import from there | Decouples routes from SQLite; ready for Supabase | Route signature changes (`db` param removed); moderate refactor |
| Full service layer (`server/services/`) | Clean separation | Over-engineered for this feature |

**Decision**: `server/repositories/` factory pattern.
- `server/repositories/applications.js` and `server/repositories/profile.js` wrap the existing `server/db/` functions into plain JS objects conforming to the defined interface.
- `server/repositories/index.js` exports `createRepositories(config)` which returns the SQLite implementations in local mode and stub implementations (throwing `NotImplementedError`) in hosted mode.
- Route factories change from `createApplicationsRouter({ db })` to `createApplicationsRouter({ repo })`.
- `server/db/` files are **unchanged** — they remain the SQLite implementation layer.

**Rationale**: The DB functions already take `targetDb` as an optional parameter, making them easy to wrap. Keeping `server/db/` intact avoids breaking the existing test fixtures that construct in-memory SQLite databases directly.

---

## D-003 — Where does runtime config validation live?

**Options considered:**

| Location | Pros | Cons |
|----------|------|------|
| Inline in `server/index.js` | Simple | Mixes startup logic with app assembly |
| A dedicated `server/config.js` module | Single import; testable in isolation; loaded once at process start | One new file |
| `process.env` checks scattered through the codebase | No new file | Unpredictable failure modes; hard to test |

**Decision**: `server/config.js` — a dedicated module that:
1. Reads `APP_RUNTIME` (defaults to `'local'` if absent)
2. Rejects unrecognized runtime values with a clear error
3. In `hosted` mode, checks for each required env var and throws with the variable name if missing
4. Exports a frozen `config` object consumed by `server/index.js` and `server/repositories/index.js`

Config is loaded at module import time — if it throws, the process exits before accepting any requests.

---

## D-004 — SQLite cannot run in Vercel serverless functions

**Context**: `better-sqlite3` is a native Node.js addon. Vercel Functions run on a read-only
filesystem; there is no persistent writable path for a SQLite database file.

**Implication**: The SQLite repository layer will not be usable in hosted mode — ever. This is
expected and correct: the hosted persistence path is Supabase (feature 019). The stub
repositories in hosted mode are placeholders until 019 ships.

**Decision**: Document this constraint clearly in the deployment docs and in code comments near the
hosted repository stubs. No workaround is attempted.

---

## D-005 — Env var naming and frontend exposure

**Context**: Vite only exposes variables prefixed with `VITE_` to the browser bundle. Any
variable without that prefix is inaccessible in `import.meta.env` and will not appear in the
built output.

**Current need**: In this feature, the frontend does not need Supabase access directly. All env
vars are server-side only.

**Future need**: When the frontend eventually needs to initialize a Supabase client (e.g. for
auth), `SUPABASE_URL` and `SUPABASE_ANON_KEY` will need to be exposed as `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY`.

**Decision**: Use non-prefixed names (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) for the server-side
config contract in this feature. The `VITE_` variants are a naming concern for the frontend auth
feature (018). Document the future rename in `.env.example` with a comment.

**Key invariant**: `SUPABASE_SERVICE_ROLE_KEY` must never be given a `VITE_` prefix under any
circumstances. A future code review gate should verify this.

---

## D-006 — Hosted repository stubs: throw or return empty?

**Context**: In hosted mode, Supabase persistence is not implemented. The server must start
without error, but API requests in hosted mode have no backing data store.

**Options considered:**

| Behavior | Pros | Cons |
|----------|------|------|
| Stub methods throw `NotImplementedError` → 500 from error handler | Honest about state; fails loud | Any request in hosted mode returns 500 |
| Stub methods return empty/null → silent no-ops | Server appears to work | Silent data loss; misleading |
| Hosted mode disables all API routes with a 503 response | Clear signal | Requires route-layer changes |

**Decision**: Stub methods throw a `HostedRepositoryNotImplementedError`. The existing Express
error handler catches it and returns 500. A distinctive error class makes it easy to grep for
accidental invocations and to replace with a real 503 response in a later cleanup if desired.

---

## D-007 — `createApp` factory: `{ db }` vs `{ repositories }`

**Context**: `server/index.js` currently exports `createApp({ db })`. The `db` is threaded into
each router factory (`createApplicationsRouter({ db })`), which in turn passes it to every db
call.

After introducing the repository layer, routes no longer need direct `db` access — they call
repository methods.

**Decision**: Change `createApp({ db })` to `createApp({ repositories })`.
- `server/index.js` (the entry point) calls `createRepositories(config)` and passes the result to `createApp`.
- `api/index.js` (Vercel entry point) does the same.
- Existing test files that call `createApp({ db })` will need to construct a repositories object; a helper `createSqliteRepositories(db)` will be exported from `server/repositories/index.js` for this purpose.

---

## D-008 — Vercel build output directory

**Context**: The Vite build output goes to `dist/`. Vercel needs to know to serve this as the
static frontend.

**Decision**: Set `"outputDirectory": "dist"` in `vercel.json`. The `"buildCommand"` is
`npm run build`. Vercel auto-detects Node for the function runtime based on `package.json`.
