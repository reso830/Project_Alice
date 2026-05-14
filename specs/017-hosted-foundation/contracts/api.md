# API Contracts: Hosted Deployment Foundation (017)

This document defines the two interface contracts introduced by this feature:
1. The **environment configuration contract** — what the server expects at startup
2. The **repository interface contract** — what every persistence implementation must satisfy

---

## 1. Environment Configuration Contract

### Variables

| Variable | Scope | Local required | Hosted required | Notes |
|----------|-------|:--------------:|:---------------:|-------|
| `APP_RUNTIME` | server | no | yes | `"local"` or `"hosted"`. Defaults to `"local"` if absent. |
| `PORT` | server | no | no | API listen port. Defaults to `3001`. |
| `SUPABASE_URL` | server (client-safe future) | no | yes | Supabase project URL. |
| `SUPABASE_ANON_KEY` | server (client-safe future) | no | yes | Supabase public/anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | no | yes | Supabase service role key. **Never expose to frontend.** |
| `ALICE_DB_PATH` | server | no | no | Override path for local SQLite file. Existing variable. |

### Validation rules (enforced in `server/config.js`)

1. If `APP_RUNTIME` is absent → treat as `"local"`, no error.
2. If `APP_RUNTIME` is set to an unrecognized value → throw:
   ```
   Invalid APP_RUNTIME: "<value>". Valid values: "local", "hosted".
   ```
3. If `APP_RUNTIME=hosted` and `SUPABASE_URL` is absent → throw:
   ```
   Missing required environment variable for hosted mode: SUPABASE_URL
   ```
4. If `APP_RUNTIME=hosted` and `SUPABASE_ANON_KEY` is absent → throw:
   ```
   Missing required environment variable for hosted mode: SUPABASE_ANON_KEY
   ```
5. If `APP_RUNTIME=hosted` and `SUPABASE_SERVICE_ROLE_KEY` is absent → throw:
   ```
   Missing required environment variable for hosted mode: SUPABASE_SERVICE_ROLE_KEY
   ```
6. Partial hosted config with `APP_RUNTIME=local` → valid; extra vars ignored.

> **Note**: An environment variable set to an empty string is treated as absent for
> the purpose of rules 3–5. The check `!process.env[KEY]` is falsy for both missing
> and empty-string values.

All validation errors throw synchronously at module load time. The process will not
reach `app.listen()` or export the Vercel handler if config is invalid.

### `config` object shape (exported from `server/config.js`)

```js
{
  runtime: 'local' | 'hosted',
  isHosted: boolean,
  port: number,
  supabase: {
    url: string,
    anonKey: string,
    serviceRoleKey: string,
  } | null   // null in local mode
}
```

The exported object is frozen (`Object.freeze`). Mutation throws in strict mode.

---

## 2. Repository Interface Contract

All persistence implementations (current: SQLite; future: Supabase) must conform to
this interface. API routes depend only on this surface — they have no knowledge of the
underlying persistence technology.

### ApplicationsRepository

```
getAll() → ApplicationRecord[]
  Returns all non-archived applications, ordered by created_at descending.
  Throws on persistence error.

getById(id: number | string) → ApplicationRecord | null
  Returns the application with the given id, or null if not found.
  id: positive integer in local/SQLite mode; UUID string in hosted/Supabase mode.
  Note: the route-level parseIdParam() in server/routes/applications.js currently
  only accepts positive integers. Feature 019 must update that function alongside
  the Supabase repository implementation.

create(fields) → ApplicationRecord
  Creates a new application record with the provided fields.
  Sets created_at, updated_at, last_status_update to current date.
  Returns the created record.
  Throws on validation or persistence error.

update(id, fields) → ApplicationRecord | null
  Updates mutable fields on the application with the given id.
  Returns the updated record, or null if not found.
  Refreshes last_status_update when status changes.
  Throws on persistence error.

archive(id) → ApplicationRecord | null
  Sets archived=true, fav=false on the application with the given id.
  Returns the updated record, or null if not found.
  Throws on persistence error.
```

### ProfileRepository

```
get() → object | null
  Returns the current profile data object, or null if none has been saved.
  Throws on persistence error.

upsert(data) → object
  Creates or replaces the profile with the provided data object.
  Returns the saved profile.
  Throws on validation or persistence error.
```

### Contract guarantees expected by routes

- Methods never return `undefined`; they return the documented type or throw.
- `create` always returns the full record, not just an id.
- `update` and `archive` return `null` (not an error) when the record is not found.
  Routes translate `null` to a `404 NOT_FOUND` response.
- No method exposes database-specific error types to the route layer; implementations
  should wrap persistence errors in generic `Error` instances.

### Hosted stub behavior (this feature only)

In hosted mode, the stub repository implements the interface but every method throws:

```
HostedRepositoryNotImplementedError: Hosted persistence is not yet implemented.
  See feature 019-supabase-persistence.
```

The Express error handler catches this and returns HTTP 500. This is intentional and
acceptable for the foundation phase — the server starts, but requests fail loudly.

---

## 3. `createApp` factory contract

`server/index.js` exports `createApp({ repositories })`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `repositories.applications` | `ApplicationsRepository` | Required |
| `repositories.profile` | `ProfileRepository` | Required |

Returns an Express `Application` instance. Does not call `app.listen()`.

`api/index.js` (Vercel entry) and the local entry point (`server/index.js` bottom)
both call `await createRepositories(config)` (async — defers the SQLite import to
local mode) before passing the result to `createApp`.

---

## 4. HTTP API surface (unchanged)

This feature does not add, remove, or change any HTTP routes. The existing API surface
is preserved exactly:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/applications` | List all non-archived applications |
| `POST` | `/api/applications` | Create application |
| `GET` | `/api/applications/:id` | Get application by id |
| `PATCH` | `/api/applications/:id` | Update application |
| `POST` | `/api/applications/:id/archive` | Archive application |
| `GET` | `/api/profile` | Get profile |
| `PUT` | `/api/profile` | Save profile |
| `POST` | `/api/resume/parse` | Parse resume file |

Request/response schemas, validation rules, and error shapes are unchanged.
