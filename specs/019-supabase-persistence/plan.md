# Implementation Plan: Supabase Persistence for Hosted Mode (019)

**Branch**: `019-supabase-persistence` | **Date**: 2026-05-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/019-supabase-persistence/spec.md`
**Depends on**: [017-hosted-foundation](../017-hosted-foundation/spec.md) (runtime contract, env vars, dispatcher entry point) and
[018-auth-user-access](../018-auth-user-access/spec.md) (auth middleware, per-request user identity, documented ownership plan)

---

## Summary

Implement Supabase-backed `applications` and `profile` repository adapters, wire
them through the existing `createRepositories(config)` dispatcher in
[server/repositories/index.js](../../server/repositories/index.js), add a third
runtime mode `demo` as a routing slot only (stub that throws), enforce per-user
ownership via Supabase RLS plus explicit server-side filters, and seed a tiny
starter dataset on each hosted user's first authenticated API call.

Concretely this introduces:

1. A one-shot Supabase migration that wipes pre-019 hosted rows, adds non-nullable
   `user_id` columns to `applications` and `profile`, enforces one profile row per
   user, creates a `user_seed_state` table to track first-call seeding, and applies
   RLS policies of the shape `USING (user_id = auth.uid())` / `WITH CHECK (user_id
   = auth.uid())` documented by 018.
2. Server-side Supabase adapter modules
   ([server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js)
   and [profile.js](../../server/repositories/supabase/profile.js)) that satisfy
   the existing repository contract. Each adapter takes a per-request Supabase
   client initialized with the caller's JWT, so every query and mutation runs
   under RLS as the authenticated user. Server-side `.eq('user_id', userId)`
   filters and `.update({ user_id: userId })` assignments are added on top of
   RLS for clarity, observability, and an explicit ownership invariant in code.
3. A new `demo` runtime value in [server/config.js](../../server/config.js) and
   a `createDemoStub(name)` factory mirroring 017's `createHostedStub` pattern,
   producing a `DemoRepositoryNotImplementedError` that points to feature 020.
4. A small post-auth middleware in hosted mode that, on every authenticated
   request, calls a single `SECURITY INVOKER` RPC,
   `claim_and_seed_starter()`, which atomically claims the seed marker
   (INSERT into `user_seed_state` with `ON CONFLICT DO NOTHING`) and, if
   claimed, inserts two starter applications under the calling user — all
   inside one Postgres transaction. The RPC returns boolean (`true` if
   seeding ran on this call, `false` if the user was already seeded). A
   failure mid-RPC rolls back the marker and any partial row inserts
   together, so the next request retries cleanly. The profile is
   intentionally left empty by the seed — the user fills it in on first
   edit.
5. A boot-time schema smoke check (anon-key PostgREST `select=user_id&limit=0`
   against `applications` and `profile`, plus `select=user_id&limit=0` against
   `user_seed_state`). Failure produces a descriptive startup error naming the
   missing column or table; the server refuses to serve hosted traffic until
   the operator runs the migration.
6. Converting the dispatcher in
   [server/repositories/index.js](../../server/repositories/index.js) so all
   three runtimes (local, hosted, demo) return the **same shape** —
   `{ forRequest(req) }` — and replacing the hosted-mode `createHostedStub`
   with the real Supabase adapter factory inside `forRequest`. Local and
   demo modes return long-lived bundles; hosted constructs a fresh per-
   request bundle. Route handlers get one uniform contract; the SQLite
   path remains byte-equivalent inside its `forRequest` wrapper.
7. A canonical SQL block in [data-model.md §5](data-model.md) (single source
   of truth, no separate `.sql` file) plus quickstart-driven manual
   application via the Supabase SQL editor, mirroring 018's operator
   workflow for the allowlist trigger.

The feature does **not** modify SQLite schema, repository contract shape, API
response shapes, or frontend code. Local SQLite mode boots without touching
Supabase. The frontend remains unaware that hosted persistence is now backed by
Supabase.

---

## Technical Context

**Language/Version**: Node.js ≥ 20.19.0, JavaScript (ESM)
**Primary Dependencies**: Express 4, Vite 8, Vitest 4, Zod 4. **New (server)**:
`@supabase/supabase-js` (per-request client; same package the frontend already
uses in 018). No new frontend dependencies.
**Storage**:
- SQLite (local mode, unchanged).
- Supabase Postgres (hosted mode): `applications` and `profile` tables gain a
  non-nullable `user_id` column referencing `auth.users(id)` ON DELETE CASCADE;
  new `user_seed_state` table tracks per-user seed status; RLS enabled on all
  three tables.
**Testing**: Vitest with `@supabase/supabase-js` mocked at the module boundary —
no live Supabase project required for CI. RLS itself is not exercised by unit
tests (it lives inside Supabase); RLS behavior is validated in the manual
quickstart against a real Supabase project.
**Target Platform**: Local Node.js (dev); Vercel serverless (hosted).
**Project Type**: Web application — Vite frontend + Express API. Repository
adapter layer is server-only; no frontend reach.
**Constraints**:
- Server uses **per-request** Supabase clients initialized with the caller's
  JWT. No long-lived service-role client at runtime in 019. The service-role
  key remains in the env contract per 017 (and is used only by operators
  applying migrations via SQL editor — not by application code).
- Hosted adapters MUST be lazy-imported from
  [server/repositories/index.js](../../server/repositories/index.js). Local-mode
  boot MUST NOT import any Supabase module.
- Response shapes returned to route handlers MUST match the pre-019 SQLite
  adapter output exactly. `user_id` is stripped at the adapter boundary
  (explicit `.select(...)` projection without `user_id`).
- Seed step MUST be atomic and idempotent. The seed runs as a single
  PL/pgSQL function (`claim_and_seed_starter()`) whose body contains the
  marker INSERT and the row INSERTs in one Postgres transaction. A partial
  failure rolls back the marker and any row inserts together; the next
  request re-enters the function cleanly.
**Scale/Scope**: Single hosted operator + a handful of allowlisted users (tens
at most). One small seed batch per user lifetime; per-request CRUD volumes
small enough that PostgREST round-trip latency dominates and adapter overhead
is negligible.

---

## Architecture

```text
┌──────────────────────────── Browser ─────────────────────────────┐
│  (unchanged — 018's authStore + services/api.js + Supabase JS    │
│   client for sign-in/up/out. No new frontend code in 019.)       │
└──────────────────┬───────────────────────────────────────────────┘
                   │ Authorization: Bearer <user JWT>
                   ▼
┌──────────────────── Express API ────────────────────┐
│                                                      │
│  requireAuth  (from 018)                             │
│      attaches req.user = { id, email }               │
│      raw JWT remains in req.headers.authorization    │
│              │                                       │
│              ▼                                       │
│  seedHostedUserIfNeeded  (NEW, hosted-mode only)     │
│      client.rpc('claim_and_seed_starter')            │
│        PL/pgSQL function body, ONE transaction:      │
│          INSERT INTO user_seed_state (user_id)       │
│                  VALUES (auth.uid())                 │
│                  ON CONFLICT (user_id) DO NOTHING    │
│          IF claimed: INSERT 2 starter applications   │
│          RETURN boolean (true | false)               │
│      on RPC error → next(err); marker rolled back    │
│              │                                       │
│              ▼                                       │
│  Route handler (applications | profile | resume)     │
│      const { applications } =                        │
│        req.repositories.forRequest(req);             │
│      applications.getAll()                           │
│              │                                       │
│              ▼                                       │
│  createRepositories(config)  (MODIFIED dispatcher)   │
│    Uniform shape: { forRequest(req) } across modes   │
│      local  → forRequest returns long-lived SQLite   │
│      hosted → forRequest constructs per-request bundle│
│      demo   → forRequest returns long-lived stub     │
│              │                                       │
│              ▼                                       │
│  Supabase adapter (applications | profile)           │
│      createClient(SUPABASE_URL, ANON_KEY, {          │
│        global: { headers: { Authorization: jwt }}})  │
│              │                                       │
└──────────────┼──────────────────────────────────────┘
               │ PostgREST (RLS-enforced as auth.uid())
               ▼
┌─── Supabase Postgres (hosted) ──────────────────────┐
│  applications  (RLS: user_id = auth.uid())          │
│      user_id uuid NOT NULL  ← added by 019          │
│  profile       (RLS: user_id = auth.uid())          │
│      user_id uuid NOT NULL UNIQUE  ← added by 019   │
│  user_seed_state                                    │
│      user_id uuid PK ref auth.users(id)             │
│      seeded_at timestamptz NOT NULL DEFAULT now()   │
│      (RLS: user_id = auth.uid())                    │
│  auth.users  (unchanged, owned by Supabase)         │
└─────────────────────────────────────────────────────┘
```

### Why per-request anon + user JWT (not service role)

Three approaches were considered for the server's Supabase client model:

1. **Long-lived service-role client** that bypasses RLS. *(Rejected.)* Makes
   server-side `.eq('user_id', userId)` filters the *only* line of defense.
   The spec's "layered server filter + RLS defense in depth" (FR-016, US6)
   becomes weaker — RLS is effectively dead for server traffic and only
   defends against direct-anon-key client access we don't otherwise exercise.
   Forces us to write more code carefully under "the database trusts us blindly."
2. **Hybrid: anon+JWT for CRUD, service role for seed.** *(Rejected.)* Adds a
   second client lifecycle for one operation. The seed step works fine under
   RLS (INSERT with `user_id = auth.uid()` satisfies the policy), so the
   complexity buys nothing.
3. **Per-request anon client + user JWT.** **(Chosen.)** Server constructs
   `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: {
   Authorization: <user JWT> } } })` once per request, passes it to the
   adapter, and discards it after the response. RLS fires on every query;
   server-side `.eq('user_id', userId)` filters are added for explicitness
   and to give a clear test-time invariant. Defense in depth is real:
   removing the server filter still produces correct behavior, and removing
   the RLS policy still produces correct behavior — both layers independently
   prevent cross-user access.

The trade-off is per-request client construction overhead. `createClient` is
lightweight (it constructs URLs and a small fetch wrapper — no DB connection
is opened until a query runs); the cost is negligible at our scale.

### Why a dedicated `user_seed_state` table

FR-014 requires the seed marker to be **independent of applications/profile
row presence** — a user who deletes their seeded rows MUST NOT be re-seeded.
That rules out "the seed has run iff a profile row exists" and "the seed has
run iff at least one application exists."

Three storage options were considered:

1. **Column on profile.** *(Rejected.)* Couples seeding to profile existence;
   if we ever allow profile deletion (we don't today, but adapters might be
   extended), the marker disappears and the user gets re-seeded. Also requires
   the profile row to exist before seeding, adding an order-of-operations
   wrinkle.
2. **`raw_app_meta_data` on `auth.users`.** *(Rejected.)* Writing it requires
   the service-role key, which 019 otherwise avoids at runtime. Pulls a
   server-side admin client into the seed step for no upside.
3. **Dedicated `user_seed_state` table.** **(Chosen.)** Single-purpose table:
   `user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`,
   `seeded_at timestamptz NOT NULL DEFAULT now()`. The seed claim is
   `INSERT … VALUES ($user_id) ON CONFLICT (user_id) DO NOTHING RETURNING
   user_id` — atomic, race-safe, returns one row exactly once per user.
   RLS scopes it to `user_id = auth.uid()` (users can read their own seed
   status; INSERT is allowed only with their own `user_id`).

### Why a tiny seed (2 apps, empty profile)

Per the spec's "Define in plan phase" answer:

- **2 applications** spanning two visibly different statuses (one `applied`,
  one `interview`), with realistic but generic content. Enough to demonstrate
  the tracker isn't empty and that statuses render.
- **Empty profile.** The first profile screen prompt is itself part of the
  product's onboarding. A pre-filled profile would mislead the user about who
  owns the data.
- **Dates** computed relative to seed time (e.g. `applied` at `now() - 14d`,
  `interview` at `now() - 5d`, `last_status_update` for both at `now() - 5d`)
  so the seed always reads as current regardless of when a user signs up. We
  do NOT reuse the dev seed's hardcoded 2026-03/04 dates.
- **No `compat` scores, no salary, no skills.** Keep the seed minimal so the
  empty-state edges of the UI still get exercised on first paint.

Exact fixture content lives in [contracts/api.md §4](contracts/api.md).

---

## Data Flow

### Hosted CRUD (any protected route)

1. Browser sends `Authorization: Bearer <user JWT>` (from 018).
2. `requireAuth` — built once at app construction via
   `createRequireAuth({ jwksUri })` from
   [server/auth/middleware.js](../../server/auth/middleware.js) (018) —
   verifies the JWT via Supabase's JWKS endpoint (`ES256`/`RS256`), attaches
   `req.user = { id: payload.sub, email: payload.email }`. Raw JWT remains
   in `req.headers.authorization`.
3. `seedHostedUserIfNeeded(req)` runs (hosted mode only). It calls one RPC,
   `claim_and_seed_starter()`, whose PL/pgSQL body atomically claims the
   marker and (if claimed) inserts the starter applications in a single
   Postgres transaction. The RPC returns boolean — `true` on first call,
   `false` thereafter. Middleware calls `next()` on success regardless of
   the boolean; on RPC failure it calls `next(err)` and the rollback
   preserves the user's eligibility to seed on a future request.
4. Route handler invokes
   `const { applications } = req.repositories.forRequest(req)` (uniform
   contract across all three runtimes; see contracts/api.md §1.1), then
   `applications.getAll()`.
5. In hosted mode, `forRequest(req)` constructs a fresh Supabase client
   from `req.headers.authorization` and returns adapters scoped to
   `req.user.id`. The adapter:
   - Issues the query with `.eq('user_id', req.user.id)` for explicitness;
     RLS additionally constrains rows to `user_id = auth.uid()`.
   - Projects only the SQLite-compatible column set (no `user_id` in the
     output).
6. Response is returned to the route handler, which serializes it. The shape
   is byte-equivalent to pre-019 SQLite output.

### Hosted writes (create / update / upsert)

- `user_id` is set explicitly from `req.user.id` in the adapter. Any `user_id`
  in the request body is discarded before the INSERT/UPSERT call.
- RLS `WITH CHECK (user_id = auth.uid())` additionally refuses writes whose
  resolved `user_id` doesn't match the JWT, so even an adapter bug can't write
  cross-user.

### Cross-user access attempt (US6)

- User A's session token, attempting `GET /api/applications/<B_app_id>`:
  - Adapter issues `.eq('id', B_app_id).eq('user_id', A.id)` → 0 rows → 404.
  - With the server filter bypassed in a test harness, the same query without
    `.eq('user_id', …)` still returns 0 rows because RLS appends `user_id =
    auth.uid()` automatically.

### Boot-time schema check

On `config.isHosted`, the server performs three sentinel calls via a
freshly-constructed anon-key client (no JWT):

1. `GET .../rest/v1/applications?select=user_id&limit=0`
2. `GET .../rest/v1/profile?select=user_id&limit=0`
3. `GET .../rest/v1/user_seed_state?select=user_id&limit=0`

A 200 response (any payload) means the column/table exists. A 4xx with the
PostgREST error code `42703` (`undefined_column`) or `42P01`
(`undefined_table`) means the migration hasn't run — the server logs the
specific missing artifact and exits non-zero. Any other error is treated as
a transient connectivity problem (logged but boot continues; first request
will surface it).

### Seeding race / failure cases

- **Concurrent first requests from the same user**: both attempt the INSERT;
  Postgres serializes them. Exactly one returns a row; the other returns 0
  rows and skips seeding. No duplicate seed rows are written.
- **Seed claim succeeds but starter-application INSERT fails**: the wrapping
  transaction rolls back the seed marker. The next request retries cleanly.
- **User deletes both seeded applications, then makes another request**: the
  seed marker is still in `user_seed_state`; the INSERT returns 0 rows; no
  re-seed. Empty workspace is preserved as intended.

---

## Constitution Check

- [x] Required application fields preserved (FR-020). The Supabase
  `applications` schema retains the same columns as SQLite plus `user_id`.
- [x] Validation rules remain centralized (FR-019). Adapters perform no
  validation; existing `server/validation/application.js` and the route layer
  continue to be the validation surface.
- [x] No external analytics, tracking, or data sharing introduced.
- [x] Business logic stays server-side: ownership filtering, seed eligibility,
  and seed payload are server responsibilities; the frontend never sees
  `user_id` and never knows about seeding.
- [x] Local SQLite mode entirely unaffected — no Supabase imports, no boot
  check, no seed middleware, no migration.
- [x] No silent data corruption: response shape is preserved; ownership is
  enforced in two layers; seed is atomic.
- [x] Operations covered: add (create), edit (update), search/filter
  (server filters by user_id under RLS), review (route handlers unchanged).
- [x] UX requirements: no UI changes; empty/loading/error states unchanged;
  desktop/mobile unaffected.
- [x] Testing: adapter unit tests, dispatcher routing tests, seed-step
  idempotency + race-safety tests, SQLite regression suite continues to pass.

**Complexity Tracking**:

| Complexity item | Why needed | Simpler alternative rejected because |
|---|---|---|
| Per-request Supabase client construction | Lets RLS fire as the authenticated user; gives real defense-in-depth | Long-lived service-role client makes RLS a no-op for server traffic; weakens FR-016 |
| Dedicated `user_seed_state` table | Marker is independent of profile/applications row presence (FR-014); atomic claim via ON CONFLICT | Column on profile re-seeds on profile delete; `raw_app_meta_data` requires service-role writes |
| Boot-time schema smoke check | FR-021 mandates hosted mode fail fast if migration not applied | First-request failure leaves a window where 5xx errors leak before the operator notices |
| Migration wipes pre-019 hosted rows | Direct resolution of 018's *Accepted Limitations* — no attribution exists for those rows | Backfill attempt would have to invent ownership; spec explicitly forbids it |
| Lazy import of Supabase adapters from dispatcher | Local mode must not load Supabase code at boot | A static import couples local-mode boot to a hosted-only dependency |

---

## Project Structure

```text
server/
├── config.js                              # MODIFIED — add 'demo' to VALID_RUNTIMES
├── index.js                               # MODIFIED — boot schema check (hosted),
│                                          #            pass seedHostedUserIfNeeded into router factories,
│                                          #            pass `repos` (dispatcher) instead of static repo
├── auth/
│   ├── middleware.js                      # unchanged (018, factory-style requireAuth)
│   └── seedHostedUser.js                  # NEW — first-call seeding middleware
├── routes/
│   ├── applications.js                    # MODIFIED — factory accepts { repos, requireAuth,
│   │                                      #            seedHostedUserIfNeeded }; wires
│   │                                      #            requireAuth → attachRepos → seed → handler
│   ├── profile.js                         # MODIFIED — same factory-signature change
│   └── resume.js                          # MODIFIED — same factory-signature change
├── repositories/
│   ├── index.js                           # MODIFIED — uniform { forRequest(req) } shape across
│   │                                      #            local/hosted/demo; demo stub added
│   ├── middleware.js                      # NEW — attachRepos(repos) helper
│   ├── applications.js                    # unchanged (SQLite)
│   ├── profile.js                         # unchanged (SQLite)
│   └── supabase/                          # NEW
│       ├── client.js                      # createSupabaseClientForRequest(req)
│       ├── applications.js                # createSupabaseApplicationsRepository(client, userId)
│       └── profile.js                     # createSupabaseProfileRepository(client, userId)
└── db/                                    # unchanged (SQLite)

specs/019-supabase-persistence/
├── spec.md                                # already written
├── plan.md                                # this file
├── data-model.md                          # NEW — migration SQL, table shapes, RLS policies
├── contracts/
│   └── api.md                             # NEW — adapter contract, seed contract, boot check
├── research.md                            # NEW — decisions + rejected alternatives
├── quickstart.md                          # NEW — operator setup + verification
├── checklists/
│   ├── requirements.md                    # already written (spec phase)
│   └── plan-review.md                     # NEW — review gate before /speckit.tasks
└── migrations/
    └── 019/
        └── up.sql                         # NEW — canonical migration source

tests/
├── server/
│   ├── config.test.js                     # MODIFIED — assert 'demo' is accepted
│   ├── repositories/
│   │   ├── applications.test.js           # unchanged (SQLite regression)
│   │   ├── profile.test.js                # unchanged (SQLite regression)
│   │   ├── stubs.test.js                  # MODIFIED — add demo stub assertion
│   │   ├── dispatcher.test.js             # NEW — local/hosted/demo selection
│   │   └── supabase/
│   │       ├── applications.test.js       # NEW — Supabase mocked at module boundary
│   │       ├── profile.test.js            # NEW — same
│   │       └── ownership.test.js          # NEW — server filter + simulated RLS
│   └── auth/
│       └── seedHostedUser.test.js         # NEW — idempotency, concurrency, txn rollback
```

---

## Affected Areas

### Files/components likely to be **inspected** (read-only context)

- [server/repositories/index.js](../../server/repositories/index.js) —
  current dispatcher shape and the `HostedRepositoryNotImplementedError`
  precedent to mirror for `DemoRepositoryNotImplementedError`.
- [server/repositories/applications.js](../../server/repositories/applications.js)
  and [profile.js](../../server/repositories/profile.js) — current SQLite
  adapter contract (method names, argument shapes, return shapes) that the
  Supabase adapters must satisfy.
- [server/db/applications.js](../../server/db/applications.js) and
  [profile.js](../../server/db/profile.js) — column list per entity, to make
  the Supabase `.select(...)` projection an exact match.
- [server/routes/applications.js](../../server/routes/applications.js),
  [profile.js](../../server/routes/profile.js), and
  [resume.js](../../server/routes/resume.js) — current factory signature
  (`{ repo, requireAuth }`) and where the static `repo` is referenced in
  handlers; both change in Task 05.1.
- [server/auth/middleware.js](../../server/auth/middleware.js) — confirmed
  factory-style `createRequireAuth({ jwksUri })`; attaches
  `req.user = { id, email }`; leaves `req.headers.authorization` in
  place. 019's adapter and seed contracts depend on this.
- [server/config.js](../../server/config.js) — current `VALID_RUNTIMES`
  shape; required hosted env vars.
- [server/index.js](../../server/index.js) — middleware mounting order;
  where to insert the boot schema check and the post-auth seed middleware.
- [shared/constants.js](../../shared/constants.js) and
  [src/models/application.js](../../src/models/application.js) — controlled
  status values so seed payloads use the right tokens.
- [package.json](../../package.json) — confirm `@supabase/supabase-js` is
  already in `dependencies` from 018 (frontend) and decide whether it needs
  to remain there (yes) or be promoted (no — already a regular dependency).

### Files/components likely to be **modified**

- [server/config.js](../../server/config.js) — extend `VALID_RUNTIMES` with
  `'demo'`; ensure `config.isDemo` is exported alongside `config.isHosted`.
- [server/repositories/index.js](../../server/repositories/index.js) — convert
  to uniform `{ forRequest(req) }` shape across all three runtimes; replace
  `createHostedStub` path with lazy import of the Supabase adapter factory
  inside hosted `forRequest`; add the demo branch returning
  `createDemoStub(name)`.
- [server/routes/applications.js](../../server/routes/applications.js),
  [profile.js](../../server/routes/profile.js), and
  [resume.js](../../server/routes/resume.js) — change factory signature
  from `{ repo, requireAuth }` to `{ repos, requireAuth,
  seedHostedUserIfNeeded }`; wire
  `requireAuth → attachRepos(repos) → seed → handler` on every route;
  swap `repo.method(...)` calls for `req.repos.applications.method(...)`
  (or `.profile.`).
- [server/index.js](../../server/index.js) — call `assertHostedSchema()` on
  boot in hosted mode; build (or accept injected) `seedHostedUserIfNeeded`
  in hosted mode and thread it into each router factory; pass the
  dispatcher (`repos: repositories`) instead of pre-extracted
  `repo: repositories.applications`.
- [tests/server/repositories/stubs.test.js](../../tests/server/repositories/stubs.test.js)
  — extend to assert `DemoRepositoryNotImplementedError` shape and message.

### Files/components likely to be **created**

- [server/repositories/supabase/client.js](../../server/repositories/supabase/client.js)
  — `createSupabaseClientForRequest(req)` that constructs a per-request
  `@supabase/supabase-js` client from `req.headers.authorization` and
  `SUPABASE_URL` / `SUPABASE_ANON_KEY`. Pure factory; no state.
- [server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js)
  — `createSupabaseApplicationsRepository(client, userId)` returning
  `{ getAll, getById, create, update, archive }` that all delegate to
  PostgREST under RLS.
- [server/repositories/supabase/profile.js](../../server/repositories/supabase/profile.js)
  — `createSupabaseProfileRepository(client, userId)` returning
  `{ get, upsert }`.
- [server/auth/seedHostedUser.js](../../server/auth/seedHostedUser.js) —
  Express middleware that calls the `claim_and_seed_starter()` RPC. The
  RPC body atomically claims the seed marker and (on first claim)
  inserts the starter applications inside one Postgres transaction.
  Not mounted in local/demo (passthrough used instead via injection).
- [server/repositories/middleware.js](../../server/repositories/middleware.js)
  — `attachRepos(repos)` Express middleware factory. Returns a
  middleware that sets `req.repos = repos.forRequest(req)` and calls
  `next()`. Mounted after `requireAuth` in every protected router.
- [server/repositories/index.js](../../server/repositories/index.js) — extended
  with a `createDemoStub(name)` paralleling `createHostedStub`. Exports a new
  `DemoRepositoryNotImplementedError`.
- [server/health.js](../../server/health.js) (or a function in `server/index.js`)
  — `assertHostedSchema(config)` running the three PostgREST sentinel calls.
- The canonical migration SQL ships inside
  [data-model.md §5](data-model.md) (single source of truth, mirroring
  018's "SQL-in-markdown" pattern). No separate `.sql` file is shipped.
- Test files listed in *Project Structure* above.
- Supporting spec artifacts:
  [data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
  [research.md](research.md), [quickstart.md](quickstart.md),
  [checklists/plan-review.md](checklists/plan-review.md).

### Tests likely to be **added or updated**

- **New**:
  - `tests/server/repositories/dispatcher.test.js` — `createRepositories(config)`
    returns the SQLite adapters for `local`, Supabase adapters for `hosted`,
    and the demo stub for `demo`. Includes a check that the Supabase modules
    are not imported when `config.runtime === 'local'` (assert via
    `vi.spyOn`/import-tracking).
  - `tests/server/repositories/supabase/applications.test.js` — adapter behavior
    against a mocked `@supabase/supabase-js`: `getAll` issues the expected
    `.from('applications').select(...).eq('user_id', userId)` chain; `create`
    sets `user_id` from context and discards any `user_id` in input; response
    shape excludes `user_id`.
  - `tests/server/repositories/supabase/profile.test.js` — `get` returns
    null when no row exists; `upsert` writes one row per user keyed on
    `user_id`; response shape excludes `user_id`.
  - `tests/server/repositories/supabase/ownership.test.js` — controlled
    test: when `.eq('user_id', userId)` is omitted from the mock query chain,
    the simulated RLS layer still returns 0 rows (asserts defense in depth
    semantics under mocks).
  - `tests/server/auth/seedHostedUser.test.js` — first call seeds and calls
    `next()`; second call from same user skips seeding; concurrent calls
    yield exactly one successful claim; transaction rollback on seed-row
    failure resets the marker.
  - Optional `tests/server/health.test.js` — `assertHostedSchema` throws
    descriptive errors on simulated `42703` / `42P01` PostgREST responses.
- **Updated**:
  - `tests/server/config.test.js` — accept `demo` as a valid runtime; reject
    invalid values; preserve all 017 hosted-env-var requirements when runtime
    is `hosted`.
  - `tests/server/repositories/stubs.test.js` — assert the demo stub mirrors
    the hosted stub pattern (same method shape, distinct error class).
- **Unchanged but verified to still pass**:
  - `tests/server/repositories/applications.test.js`, `profile.test.js` —
    SQLite regression. Must remain green without modification.
- **Manual (not unit-tested)**:
  - RLS policies themselves (verified via the quickstart against a real
    Supabase project).
  - The migration SQL itself (applied by the operator via the Supabase SQL
    editor; verification is by running the boot check after).

### Explicitly **out of scope**

- Real demo-mode behavior (session-only in-memory data). 019 ships the
  routing slot and a `DemoRepositoryNotImplementedError` stub; feature 020
  implements the actual demo repository.
- Frontend changes. The frontend remains unaware of the persistence backend.
- Automated migration of pre-019 local SQLite data into Supabase.
- Cross-device sync for local mode.
- Multi-user collaboration / shared workspaces.
- Resume-import gating beyond what 018 already does. The resume route still
  goes through `requireAuth`; its persistence path is unchanged in 019.
- New env vars. 019 consumes 017's `SUPABASE_URL` and `SUPABASE_ANON_KEY`;
  no new vars are introduced.
- Service-role usage at runtime. The service-role key is consumed only by
  operators applying migrations via the Supabase SQL editor.

---

## Risks and Tradeoffs

### Risks

1. **Per-request client construction overhead.** Each authenticated request
   constructs a fresh `@supabase/supabase-js` client. The library's
   `createClient` is lightweight (URL prep + a small fetch wrapper, no DB
   connection until a query fires), but the cost is non-zero.
   *Mitigation*: client construction lives in
   `server/repositories/supabase/client.js`; if profiling later shows it's
   material at our scale, swap to a small per-process client + per-request
   `setSession({ access_token })` call.

2. **Boot-time schema check can produce false negatives during a Supabase
   outage.** A transient PostgREST 5xx on boot would mask a real missing
   column.
   *Mitigation*: `assertHostedSchema` distinguishes PostgREST error codes
   (`42703` / `42P01` → exit non-zero; others → log warning and continue).
   The next request's failure will surface a connectivity problem with a
   different signature.

3. **Seed step runs synchronously on every authenticated request.** Even
   though the body is cheap (one INSERT … ON CONFLICT, returning 0 rows for
   already-seeded users), it adds one round-trip per request.
   *Mitigation*: short-circuit on a per-process LRU of seen user ids
   (max ~100 entries) so a warm server doesn't re-query for repeat users.
   *Not included in the initial implementation*; added only if profiling
   shows it matters.

4. **Pre-019 hosted data is wiped by the migration.** Per 018's *Accepted
   Limitations*, this is intentional but irreversible. Operators must accept
   the data loss before running the migration.
   *Mitigation*: quickstart explicitly calls this out as a P0 step; the
   migration `up.sql` begins with a `TRUNCATE` comment block explaining the
   consequence.

5. **RLS misconfiguration is silent in unit tests.** The CI test suite
   mocks `@supabase/supabase-js`, so RLS policies aren't exercised. A bad
   policy could ship.
   *Mitigation*: quickstart §6 includes a manual cross-user test (two
   accounts, one tries to read the other's data through the API and through
   a direct anon-key call). Plan-review checklist makes this a P0 gate.

6. **Migration is operator-applied via SQL editor, not version-controlled
   in CI.** Same risk profile as 018's allowlist trigger.
   *Mitigation*: [data-model.md §5](data-model.md) is the canonical
   source checked into the repo; quickstart points operators at it;
   plan-review elevates verification to a P0 gate. If the migration is
   missing, the boot check refuses to serve.

### Tradeoffs taken

- **RLS as primary enforcement vs. server-side filter as primary.** Chose
  per-request client + JWT so RLS fires for real. Adds a per-request client
  construction cost; gains true defense in depth.
- **Dedicated seed-marker table vs. column on profile / Supabase metadata.**
  Chose dedicated table for atomic claim semantics and independence from
  profile row presence. Adds one table; gains cleaner semantics.
- **Tiny seed (2 apps, empty profile) vs. reuse of dev seed.** Chose tiny
  + relative dates so the seed always reads as current and doesn't overwhelm
  a new user. Sacrifices first-paint "wow" for honesty about who owns the
  data.
- **TRUNCATE pre-019 data vs. backfill attempt.** Chose TRUNCATE per 018's
  *Accepted Limitations*. Avoids inventing ownership.
- **Boot-time schema check via PostgREST anon-key probes vs. via a
  service-role information_schema query.** Chose PostgREST so 019 has no
  runtime service-role-client codepath. Slightly more brittle (depends on
  PostgREST error codes); acceptable.
- **Lazy import of Supabase adapters (matching 017's pattern).** No trade-off
  in practice; keeps local-mode boot identical to today.
- **Seed inside the request that triggers it vs. background job.** Chose
  inline. Background-job infrastructure doesn't exist in this project and
  the seed is cheap enough to be synchronous.

---

## Validation Approach

### Automated (Vitest, `@supabase/supabase-js` mocked at module boundary)

1. **Dispatcher routing**: `createRepositories({runtime:'local'})` returns
   SQLite adapters; `{runtime:'hosted'}` returns Supabase adapters;
   `{runtime:'demo'}` returns the demo stub. Static-import discipline:
   the Supabase module is not loaded when runtime is `local` or `demo`.
2. **Demo stub**: every method throws `DemoRepositoryNotImplementedError`
   with a message referencing feature 020.
3. **Supabase applications adapter**: `getAll`, `getById`, `create`,
   `update`, `archive` issue the expected PostgREST chain; `user_id` is set
   from the userId argument on writes; any `user_id` in input is dropped;
   `.select(...)` projection excludes `user_id`.
4. **Supabase profile adapter**: `get` returns null when no row exists;
   `upsert` writes a single row per user (one-row-per-user invariant);
   response shape excludes `user_id`.
5. **Ownership defense in depth (under mock)**: with the server's
   `.eq('user_id', ...)` removed from the mock chain, the simulated RLS
   filter still produces zero cross-user rows.
6. **Seed middleware (`seedHostedUserIfNeeded`)**: first call claims the
   seed slot and inserts the starter applications; second call from the
   same user skips both INSERTs; simulated concurrent claim yields exactly
   one successful seed across two requests; simulated INSERT failure rolls
   back the seed marker.
7. **Boot schema check (`assertHostedSchema`)**: simulated PostgREST
   `42703` / `42P01` responses produce descriptive startup errors;
   simulated transient 5xx logs a warning and continues.
8. **Config**: `APP_RUNTIME=demo` parses; invalid runtimes still rejected;
   hosted env var requirements unchanged.
9. **SQLite regression**: existing
   `tests/server/repositories/applications.test.js` and `profile.test.js`
   pass without modification.

### Manual (quickstart-driven, requires a real Supabase project)

1. Apply the SQL block from [data-model.md §5](data-model.md) via the
   Supabase SQL editor. Verify the boot check passes by starting the
   server with `APP_RUNTIME=hosted`.
2. Sign up an allowlisted user (018 path). Sign in. Call
   `GET /api/applications` — observe exactly 2 seed rows with dates
   relative to now. Call `GET /api/profile` — observe an empty profile.
3. Call `GET /api/applications` again — observe still 2 rows, no
   duplicates.
4. Delete both seed applications via the API. Call `GET /api/applications`
   again — observe 0 rows. Confirm no re-seed.
5. Create a second allowlisted user. Sign in. Observe their own 2 seed
   rows under their own `user_id`. Cross-check: user A's API token cannot
   see user B's rows (network panel: 0 rows in list, 404 on getById).
6. **RLS verification**: with user A's JWT, call PostgREST directly from
   dev tools console using a `select=*` URL against `applications` — the
   response contains only user A's rows. Modify the URL to a known user B
   row id; the response is empty (RLS denies).
7. Edit + save the profile. Refresh. Confirm persistence. Sign out and
   sign back in — same profile. Inspect a second user's profile via
   direct DB access (admin) — confirm one-row-per-user invariant holds.
8. Stop the server, drop the `user_id` column from `applications` via SQL
   editor, restart with `APP_RUNTIME=hosted` — observe descriptive boot
   error pointing at the missing column. Reapply the migration; restart
   succeeds.
9. Re-run with `APP_RUNTIME=local`: observe SQLite mode boots without any
   Supabase network activity and existing SQLite data is intact and
   accessible.

### Browser smoke test (per constitution Amendment 1.1.0, one per user story)

1. **US1** — hosted user creates + retrieves applications; persists across
   refresh and re-sign-in.
2. **US2** — hosted user edits + saves profile; persists; second user has
   distinct profile.
3. **US3** — new hosted user observes seeded starter content on first
   visit; second visit shows no duplicates; deleting seeded rows does not
   re-seed.
4. **US4** — `APP_RUNTIME=local` boots and works identically to pre-019.
5. **US5** — `APP_RUNTIME=demo` boots; protected route returns the demo
   stub error.
6. **US6** — cross-user attempt returns not-found-shaped responses; direct
   PostgREST attempt is RLS-refused.

### Constitution / quality gates ([checklists/plan-review.md](checklists/plan-review.md))

Reviewed before generating `tasks.md` via `/speckit.tasks`.

---

## Open Items for Tasks Phase

- Decide whether `assertHostedSchema` lives in `server/index.js` or a small
  `server/health.js` module. Default: a function in `server/index.js` that
  also exposes `/api/health`'s `runtime` field — keeps the surface small.
- Decide the exact `select(...)` column lists for the Supabase adapters.
  Read SQLite's column lists and replicate. Plan does not pin the lists to
  avoid coupling the plan to a TBD migration column ordering — the column
  list itself ships in `data-model.md`.
- Decide whether to add a per-process LRU short-circuit to the seed
  middleware (risk #3). Default: omit; revisit if profiling shows it.

  *Resolved during plan review (2026-05-17)*: per-request Supabase client
  is constructed inside the dispatcher's `forRequest(req)` (uniform shape
  across all three runtimes). Both applications and profile adapters
  share the client returned by a single `forRequest(req)` call within
  the request handler. See [contracts/api.md §1.1](contracts/api.md).
