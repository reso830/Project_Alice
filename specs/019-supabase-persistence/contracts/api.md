# Contracts: Supabase Persistence (019)

**Branch**: `019-supabase-persistence` | **Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

This file documents the internal contracts that 019 introduces: the Supabase
repository adapter contract, the per-request Supabase client contract, the
seed step contract, the boot-time schema-check contract, and the seed fixture
itself. Wire-level API response shapes are explicitly **unchanged** by this
feature.

---

## 1. Repository Dispatcher and Adapter Contract

### 1.1 Dispatcher shape — uniform `forRequest(req)` across all runtimes

`createRepositories(config)` returns an object with a single method:

```ts
interface RepositoryDispatcher {
  forRequest(req: Request): {
    applications: ApplicationsRepository;
    profile:      ProfileRepository;
  };
}
```

All three runtime modes implement the same `forRequest(req)` contract.
Route handlers always call `const repos = req.repositories.forRequest(req)`
to obtain the per-request repository bundle — there is no shape branch
based on runtime.

- **Local mode**: `forRequest(req)` ignores `req` and returns the same
  long-lived SQLite repository bundle constructed once at boot. One
  shared instance per process.
- **Demo mode**: `forRequest(req)` returns the demo stub bundle (every
  method throws `DemoRepositoryNotImplementedError`). The bundle is
  long-lived; `req` is ignored.
- **Hosted mode**: `forRequest(req)` constructs a fresh
  `@supabase/supabase-js` client from `req.headers.authorization`, reads
  `req.user.id` (resolved by 018's auth middleware), and returns a
  bundle whose adapters close over both. Per-request; no caching.

This uniform contract is the security-critical decision (see
[research.md R-1](../research.md)): one mental model means a forgotten
branch can't cause a hosted route to land on the wrong code path. Per-
request adapter construction in hosted mode is the source of RLS scoping
under the caller's JWT.

### 1.2 Adapter surface (unchanged from 017)

```ts
// Conceptual shape — JS does not enforce these signatures, but tests do.

interface ApplicationsRepository {
  getAll():                                     Promise<Application[]>;
  getById(id: string):                          Promise<Application | null>;
  create(input: ApplicationInput):              Promise<Application>;
  update(id: string, input: ApplicationInput):  Promise<Application | null>;
  archive(id: string):                          Promise<Application | null>;
}

interface ProfileRepository {
  get():                                        Promise<Profile | null>;
  upsert(input: ProfileInput):                  Promise<Profile>;
}
```

The Supabase adapter factories take `(client, userId)`:

```js
createSupabaseApplicationsRepository(client, userId)  // → ApplicationsRepository
createSupabaseProfileRepository(client, userId)       // → ProfileRepository
```

Where:

- `client` is a `@supabase/supabase-js` client constructed for the current
  request (see §3 below).
- `userId` is `req.user.id` resolved by 018's auth middleware. The adapter
  uses this for `.eq('user_id', userId)` filters on reads and for `user_id`
  assignment on writes; RLS enforces the same scope independently.

### Response shape invariants

- `user_id` is **not** present on returned objects (FR-017). Adapters specify
  explicit `.select(...)` projections that omit `user_id`.
- Field order and naming match the SQLite repositories'. Existing route
  handlers and serializers continue to work unchanged.
- Errors are normalized: PostgREST errors are wrapped/rethrown as
  application-shaped errors (e.g. validation errors from the existing
  validation layer still surface as the route layer expects).

### Write-time user_id discipline

Any `user_id` value present in `input` MUST be stripped before the
`@supabase/supabase-js` `.insert()` / `.update()` / `.upsert()` call. The
adapter assigns `user_id` from the `userId` constructor argument as the
single source of truth. The RLS `WITH CHECK` policy enforces this
independently — an attempt to write a row whose `user_id` doesn't match
`auth.uid()` is refused at the database layer.

---

## 2. Adapter Method Contracts (per entity)

### 2.1 `ApplicationsRepository.getAll()`

```js
const { data, error } = await client
  .from('applications')
  .select(APPLICATION_COLUMNS_WITHOUT_USER_ID)
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

- Returns an empty array (not null) when the user has no rows.
- Throws on `error`.

### 2.2 `ApplicationsRepository.getById(id)`

```js
const { data, error } = await client
  .from('applications')
  .select(APPLICATION_COLUMNS_WITHOUT_USER_ID)
  .eq('id', id)
  .eq('user_id', userId)
  .maybeSingle();
```

- Returns `null` when no row matches (either id doesn't exist or belongs to
  another user — these are indistinguishable to the caller, per FR-015).

### 2.3 `ApplicationsRepository.create(input)`

```js
const { user_id: _ignored, ...sanitized } = input;
const { data, error } = await client
  .from('applications')
  .insert({ ...sanitized, user_id: userId })
  .select(APPLICATION_COLUMNS_WITHOUT_USER_ID)
  .single();
```

- Returns the freshly-inserted row with `user_id` stripped.

### 2.4 `ApplicationsRepository.update(id, input)`

```js
const { user_id: _ignored, ...sanitized } = input;
const { data, error } = await client
  .from('applications')
  .update(sanitized)
  .eq('id', id)
  .eq('user_id', userId)
  .select(APPLICATION_COLUMNS_WITHOUT_USER_ID)
  .maybeSingle();
```

- Returns `null` if the row doesn't exist or belongs to another user.

### 2.5 `ApplicationsRepository.archive(id)`

Identical to `update(id, { archived: 1 })` semantics. The adapter may
implement it as such or as a direct `.update({ archived: 1 })` chain — the
test contract only cares that the row's `archived` field flips and that
ownership is enforced.

### 2.6 `ProfileRepository.get()`

```js
const { data, error } = await client
  .from('profile')
  .select(PROFILE_COLUMNS_WITHOUT_USER_ID)
  .eq('user_id', userId)
  .maybeSingle();
```

- Returns `null` when no profile row exists for this user.

### 2.7 `ProfileRepository.upsert(input)`

```js
const { user_id: _ignored, ...sanitized } = input;
const { data, error } = await client
  .from('profile')
  .upsert({ ...sanitized, user_id: userId }, { onConflict: 'user_id' })
  .select(PROFILE_COLUMNS_WITHOUT_USER_ID)
  .single();
```

- One row per user is enforced by the `UNIQUE (user_id)` constraint plus the
  `onConflict: 'user_id'` upsert directive.

---

## 3. Per-Request Supabase Client Contract

```js
// server/repositories/supabase/client.js

export function createSupabaseClientForRequest(req) {
  const authorization = req.headers.authorization;  // "Bearer <jwt>"
  if (!authorization) {
    throw new Error('createSupabaseClientForRequest called without Authorization header');
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
```

- The client is constructed per request. It is **not** cached on the
  application or per-process.
- `persistSession: false` + `autoRefreshToken: false` because the server
  is not a user agent and does not own the session.
- `req.headers.authorization` is preserved by `requireAuth` — verified in
  the merged 018 code at
  [server/auth/middleware.js:34-55](../../../server/auth/middleware.js)
  which only reads the header (never deletes or rewrites it) before
  attaching `req.user`. This contract depends on that invariant.

---

## 4. Seed Step Contract

### 4.1 Middleware shape

```js
// server/auth/seedHostedUser.js — registered after requireAuth in hosted mode

export function seedHostedUserIfNeeded(req, res, next) { /* ... */ }
```

- Skipped in `local` and `demo` modes (the middleware is conditionally
  mounted in `server/index.js`).
- Reads `req.user.id` resolved by 018's middleware.
- Constructs a per-request Supabase client (`createSupabaseClientForRequest`).
- Calls **one** RPC, `claim_and_seed_starter()`, defined in
  [data-model.md §5](../data-model.md). The RPC performs the marker
  INSERT and the row INSERTs inside a single PL/pgSQL function body —
  one Postgres transaction. Returns boolean: `true` if the seed ran
  on this call, `false` if the user was already seeded.
- On RPC error: calls `next(err)` so Express's error middleware handles
  it. The middleware does not silently swallow seed failures — if the
  seed step fails, the request fails with 5xx, the marker is rolled
  back, and the next request retries cleanly.
- On RPC success (regardless of returned boolean): calls `next()`.

### 4.2 Why one RPC, not two JS-client calls

The seed-marker INSERT and the starter-application INSERTs **must** run
inside the same Postgres transaction (spec FR-013, FR-014). The naive
implementation — JS-client `INSERT … ON CONFLICT` followed by a separate
`client.rpc(...)` — does **not** satisfy this requirement: each
`@supabase/supabase-js` call is a separate HTTP request to PostgREST,
and each PostgREST request runs in its own transaction. If the marker
INSERT commits and the subsequent RPC fails, the user is permanently
marked-seeded with zero seed rows — violating FR-013 and FR-014.

The chosen design moves both INSERTs into one PL/pgSQL function body
that the middleware invokes with a single call:

```sql
CREATE OR REPLACE FUNCTION public.claim_and_seed_starter()
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE v_claimed integer;
BEGIN
  INSERT INTO public.user_seed_state (user_id) VALUES (auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN
    RETURN false;
  END IF;
  INSERT INTO public.applications (user_id, …) VALUES (auth.uid(), …);
  INSERT INTO public.applications (user_id, …) VALUES (auth.uid(), …);
  RETURN true;
END;
$$;
```

The middleware calls:

```js
const { data: seeded, error } = await client.rpc('claim_and_seed_starter');
if (error) return next(error);
return next();   // seeded === true on first call; false thereafter.
```

Atomicity is now a Postgres-level guarantee: the entire function body
runs in one transaction. A failure mid-body rolls back the marker INSERT
and any row INSERTs together; the next request re-enters the function
cleanly. Concurrent first calls from the same user serialize on the
`user_seed_state` primary key — exactly one returns `true` and inserts
rows; the other returns `false`.

See [research.md R-6](../research.md) for the rejected two-call design
and the rationale.

### 4.3 Seed fixture content

Two applications. All dates are relative to seed time so the seed never
reads as stale.

| field                | row 1                                                              | row 2                                                              |
|----------------------|--------------------------------------------------------------------|--------------------------------------------------------------------|
| `company_name`       | `Sample Company`                                                   | `Example Labs`                                                     |
| `job_title`          | `Frontend Engineer`                                                | `Full Stack Developer`                                             |
| `status`             | `applied`                                                          | `interview`                                                        |
| `application_date`   | `now() - interval '14 days'` (ISO date)                            | `now() - interval '21 days'` (ISO date)                            |
| `last_status_update` | same as `application_date`                                         | `now() - interval '5 days'` (ISO date)                             |
| `responsibilities`   | `Sample responsibilities — edit or replace to make this your own.` | `Sample responsibilities — edit or replace to make this your own.` |
| `archived`           | `0`                                                                | `0`                                                                |
| all other columns    | omitted (null in DB)                                               | omitted (null in DB)                                               |

Responsibilities is required (per constitution Amendment 1.2.0); we ship a
placeholder string that explicitly tells the user it's editable.

`compat`, `salary`, `skills`, `preferred_skills`, `source_platform`,
`job_posting_url`, `recruiter`, `notes`, `location`, `shift`, `work_setup`,
`compat_notes`, `general_notes`, `fav` are intentionally left null so the
empty-state of the application detail view still gets exercised on first
view.

No profile row is seeded. The first `POST /api/profile` (upsert) creates it.

---

## 5. Boot-Time Schema Check Contract

```js
// server/index.js (or server/health.js) — called once in hosted mode at boot.

async function assertHostedSchema() { /* ... */ }
```

- Uses a fresh anon-key Supabase client (no JWT) to issue three sentinel
  PostgREST calls:

  | Probe                                                              | Pass criterion                          | Fail criterion                                |
  |--------------------------------------------------------------------|-----------------------------------------|-----------------------------------------------|
  | `GET .../rest/v1/applications?select=user_id&limit=0`              | HTTP 200 (RLS returns empty array OK)  | PostgREST error `42703` or `42P01`            |
  | `GET .../rest/v1/profile?select=user_id&limit=0`                   | HTTP 200                                | PostgREST error `42703` or `42P01`            |
  | `GET .../rest/v1/user_seed_state?select=user_id&limit=0`           | HTTP 200                                | PostgREST error `42P01`                       |

- On any fail-criterion error: log the missing artifact (`applications.user_id`,
  `profile.user_id`, `user_seed_state` table) and `process.exit(1)`.
- On transient 5xx or network failure: log a warning and continue boot. The
  next request will surface the connectivity problem.

The check is skipped in `local` and `demo` modes.

---

## 6. Demo Stub Contract

```js
// server/repositories/index.js

export class DemoRepositoryNotImplementedError extends Error {
  constructor(repositoryName) {
    super(
      `Demo persistence is not yet implemented for: ${repositoryName}. ` +
        'See feature 020.',
    );
    this.name = 'DemoRepositoryNotImplementedError';
  }
}
```

The demo stub is structurally identical to 017's `createHostedStub`: every
repository method throws the error above. Feature 020 will replace this
factory with a real session-scoped in-memory implementation.

---

## 7. What This Feature Does NOT Change

- **Wire-level API response shapes.** Existing routes
  (`/api/applications`, `/api/applications/:id`, `/api/profile`, etc.)
  return the same JSON shapes they did before 019. Feature 020 or later may
  introduce new endpoints; 019 does not.
- **The adapter surface.** The `ApplicationsRepository` /
  `ProfileRepository` method names and argument shapes (§1.2) are
  unchanged from 017/018. Only the return type changes from sync values
  to Promises — route handlers add `await` to existing call sites.
- **The auth middleware contract from 018.** 019 reads `req.user.id` and
  `req.headers.authorization`; it does not extend or modify
  `requireAuth`.
- **The SQLite repository surface.** The local-mode adapters are unchanged
  byte-for-byte.

### What this feature DOES change

- **The dispatcher signature.** `createRepositories(config)` now returns
  `{ forRequest(req) }` uniformly across all three runtimes (§1.1) —
  it no longer returns `{ applications, profile }` directly. Route
  factories receive the dispatcher (`repos`) instead of pre-extracted
  repositories, and an `attachRepos(repos)` middleware sets
  `req.repos = repos.forRequest(req)` for each protected request. See
  [tasks.md Task 05.1](../tasks.md) for the migration pattern.
