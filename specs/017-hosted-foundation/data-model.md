# Data Model: Hosted Deployment Foundation (017)

No application-record schema changes. This feature introduces architectural layers
(config, repositories) and documents the future Supabase schema. No SQLite migration
is required.

---

## Repository Interface Contract

Both SQLite (local mode) and future Supabase (hosted mode) implementations must expose
the following method signatures. The contract is defined here as documentation; it is
expressed in code via JSDoc on each implementation file.

### Applications Repository

```js
/**
 * @typedef {Object} ApplicationsRepository
 * @property {() => ApplicationRecord[]} getAll
 * @property {(id: number) => ApplicationRecord | null} getById
 * @property {(fields: object) => ApplicationRecord} create
 * @property {(id: number, fields: object) => ApplicationRecord | null} update
 * @property {(id: number) => ApplicationRecord | null} archive
 */
```

### Profile Repository

```js
/**
 * @typedef {Object} ProfileRepository
 * @property {() => object | null} get
 * @property {(data: object) => object} upsert
 */
```

### Repositories Object

```js
/**
 * @typedef {Object} Repositories
 * @property {ApplicationsRepository} applications
 * @property {ProfileRepository} profile
 */
```

---

## New Files: `server/repositories/`

### `server/repositories/applications.js` — SQLite adapter

Wraps existing `server/db/applications.js` exports into the repository interface.
The underlying `server/db/` files are **unchanged**.

```js
// Wraps server/db/applications.js into the ApplicationsRepository interface.
// db: better-sqlite3 Database instance
export function createSqliteApplicationsRepository(db) {
  return {
    getAll:   ()           => getAll(db),
    getById:  (id)         => getById(id, db),
    create:   (fields)     => create(fields, db),
    update:   (id, fields) => update(id, fields, db),
    archive:  (id)         => archive(id, db),
  };
}
```

### `server/repositories/profile.js` — SQLite adapter

```js
// Wraps server/db/profile.js into the ProfileRepository interface.
export function createSqliteProfileRepository(db) {
  return {
    get:    ()     => getProfile(db),
    upsert: (data) => saveProfile(data, db),
  };
}
```

### `server/repositories/index.js` — factory

```js
// Returns Repositories for the active runtime mode.
// In local mode: SQLite implementations backed by the local database.
// In hosted mode: stubs that throw HostedRepositoryNotImplementedError on any call.
//   Real implementations deferred to feature 019-supabase-persistence.
//
// async because the SQLite import (server/db.js) is deferred to local mode only,
// so that hosted/Vercel cold starts never load better-sqlite3.
export async function createRepositories(config) { ... }

// For test use: construct SQLite repositories from an in-memory db instance.
// Synchronous — the caller provides db, so no lazy import is needed.
export function createTestRepositories(db) { ... }
```

---

## Modified Files

### `server/index.js`

`createApp({ db })` → `createApp({ repositories })`

```js
// Before:
export function createApp({ db } = {}) {
  app.use('/api/applications', createApplicationsRouter({ db }));
  app.use('/api/profile', createProfileRouter({ db }));
}

// After:
export function createApp({ repositories }) {
  app.use('/api/applications', createApplicationsRouter({ repo: repositories.applications }));
  app.use('/api/profile', createProfileRouter({ repo: repositories.profile }));
}
```

The entry point (bottom of `server/index.js`) calls `await createRepositories(config)`
before calling `createApp`. Top-level await is valid in this ESM module.

### `server/routes/applications.js`

Router factory signature: `createApplicationsRouter({ db })` → `createApplicationsRouter({ repo })`

All calls to `create(data, db)`, `getById(id, db)`, etc. become `repo.create(data)`,
`repo.getById(id)`, etc.

### `server/routes/profile.js`

Router factory signature: `createProfileRouter({ db })` → `createProfileRouter({ repo })`

`getProfile(db)` → `repo.get()`, `saveProfile(data, db)` → `repo.upsert(data)`.

---

## New File: `server/config.js`

```js
// Loaded at import time. Throws on invalid configuration before the server accepts requests.
export const config = Object.freeze({
  runtime: 'local' | 'hosted',
  isHosted: boolean,
  port: number,            // PORT env var, default 3001
  supabase: {              // null in local mode
    url: string,
    anonKey: string,
    serviceRoleKey: string,
  } | null,
});
```

**Validation rules:**
- `APP_RUNTIME` absent → `'local'`
- `APP_RUNTIME` unrecognized → throw with message listing valid values
- `APP_RUNTIME=hosted`, any of `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` absent → throw naming the missing key

---

## Supabase Schema Plan (documented, not implemented)

Postgres equivalents for the future hosted persistence layer (feature 019).

### `applications` table

| Column | Postgres Type | Notes |
|--------|---------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | nullable; FK to `auth.users.id` for future RLS |
| `company_name` | `text` | NOT NULL |
| `job_title` | `text` | NOT NULL |
| `status` | `text` | NOT NULL, constrained to STATUS_VALUES enum |
| `responsibilities` | `text` | NOT NULL (constitution v1.2.0) |
| `compat` | `integer` | NOT NULL, default 0 |
| `fav` | `boolean` | NOT NULL, default false |
| `archived` | `boolean` | NOT NULL, default false |
| `source_platform` | `text` | nullable |
| `application_date` | `date` | nullable |
| `job_posting_url` | `text` | nullable |
| `recruiter` | `text` | nullable |
| `notes` | `text` | nullable |
| `salary` | `integer` | nullable (stored as numeric lower bound) |
| `skills` | `jsonb` | NOT NULL, default `'[]'` |
| `preferred_skills` | `jsonb` | NOT NULL, default `'[]'` |
| `follow_up_action` | `text` | nullable |
| `follow_up_date` | `date` | nullable |
| `location` | `text` | nullable |
| `shift` | `text` | nullable |
| `work_setup` | `text` | nullable |
| `compat_notes` | `text` | nullable |
| `general_notes` | `text` | nullable |
| `metadata` | `jsonb` | nullable |
| `last_status_update` | `timestamptz` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

**Future RLS policy** (not implemented in this feature):
```sql
-- Enable after auth is wired (feature 018)
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own applications"
  ON applications FOR ALL
  USING (user_id = auth.uid());
```

### `profile` table

| Column | Postgres Type | Notes |
|--------|---------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | nullable; FK to `auth.users.id` for future RLS; UNIQUE (one profile per user) |
| `data` | `jsonb` | NOT NULL |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

**Note on id strategy**: The SQLite `profile` table uses `id = 1` (singleton row). In
Postgres the singleton constraint is enforced by `UNIQUE(user_id)` once auth is in place;
pre-auth, a single row is expected.

---

## New Files: deployment config

### `api/index.js` — Vercel Function entry point

```js
import { config } from '../server/config.js';
import { createRepositories } from '../server/repositories/index.js';
import { createApp } from '../server/index.js';

const repositories = await createRepositories(config);
export default createApp({ repositories });
```

### `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/index" }
  ]
}
```

### `.env.example`

Documents all environment variables with scope and requirement annotations.

---

## Layer propagation summary

| Layer | File | Change |
|-------|------|--------|
| Config | `server/config.js` | **New** — runtime config validation |
| Repository factory | `server/repositories/index.js` | **New** — resolves SQLite or stub |
| SQLite adapter (apps) | `server/repositories/applications.js` | **New** — wraps `server/db/applications.js` |
| SQLite adapter (profile) | `server/repositories/profile.js` | **New** — wraps `server/db/profile.js` |
| App factory | `server/index.js` | **Modified** — `{ db }` → `{ repositories }` |
| Applications router | `server/routes/applications.js` | **Modified** — `{ db }` → `{ repo }` |
| Profile router | `server/routes/profile.js` | **Modified** — `{ db }` → `{ repo }` |
| Vercel entry point | `api/index.js` | **New** — wires config + repos for Vercel |
| Vercel config | `vercel.json` | **New** — build + rewrite rules |
| Env documentation | `.env.example` | **New** — all env vars documented |
| Deployment docs | `docs/deployment.md` | **New** — hosted setup guide |
| Existing SQLite DB layer | `server/db/applications.js`, `server/db/profile.js`, `server/db.js` | **Unchanged** |
