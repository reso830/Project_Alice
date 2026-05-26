# API Contracts — 028 Archive Applications View

Documents the server-side HTTP contracts introduced or modified by this feature. The application's API surface lives under `/api/applications` and is gated by the same auth middleware (`requireAuth`) and repository dispatcher (`attachRepos`) as the existing endpoints.

This feature adds **one new endpoint** (`POST /api/applications/:id/unarchive`) and **extends one existing endpoint** (`GET /api/applications` gains an opt-in `?view=archived` query parameter). The `Application` response shape gains one field (`archivedDate`); see [data-model.md § 4](../data-model.md#4--api-response-shape).

---

## Endpoint matrix

| Method | Path | Status | Change |
|---|---|---|---|
| `GET` | `/api/applications` | Existing | Now accepts optional `?view=archived` query param |
| `POST` | `/api/applications` | Existing | Unchanged |
| `GET` | `/api/applications/:id` | Existing | Unchanged (returns archived rows too — needed for the read-only overlay) |
| `PATCH` | `/api/applications/:id` | Existing | Unchanged; `archivedDate` in body is silently ignored; `archived` toggle no longer zeros `fav` |
| `POST` | `/api/applications/:id/archive` | Existing | Behavior change: no longer zeros `fav`; now sets `archived_date` to today's date |
| `POST` | `/api/applications/:id/unarchive` | **New** | Mirrors `archive` semantics in reverse |

All endpoints require authentication (`requireAuth` middleware) and operate scoped to the authenticated user in both local and hosted modes.

---

## 1 · `GET /api/applications`

### 1.1 · Query parameters

| Param | Type | Default | Behavior |
|---|---|---|---|
| `view` | `string` | none | If exactly `archived`, return rows where `archived = true`. If absent, empty, or any other value, return rows where `archived = false` (current behavior). Unknown values do NOT 400. |

The `view` value is strictly allowlisted to `'archived'`. This avoids brittle client–server coordination during gradual rollout — a typo or a future client value falls back to the safe (active) default.

### 1.2 · Responses

**200 OK** — applies to both views.

```json
{
  "data": [
    { /* Application record — see data-model.md § 4 */ }
  ]
}
```

The array is sorted by `created_at DESC` (same as existing). Filtering, sorting, and pagination are applied client-side by the Tracker page; the server returns the full set for the current user matching the view filter.

### 1.3 · Errors

- **401** — no auth. Standard auth-middleware response.
- **5xx** — repository error. Forwarded by the route's `next(error)`.

### 1.4 · Examples

```http
GET /api/applications HTTP/1.1
→ 200 OK
{ "data": [ /* active rows */ ] }

GET /api/applications?view=archived HTTP/1.1
→ 200 OK
{ "data": [ /* archived rows */ ] }

GET /api/applications?view=banana HTTP/1.1
→ 200 OK
{ "data": [ /* active rows — unknown view value falls back */ ] }
```

---

## 2 · `POST /api/applications/:id/archive` (behavior change)

### 2.1 · Request

```http
POST /api/applications/42/archive HTTP/1.1
X-Client-Date: 2026-05-26
```

No request body. Optional `X-Client-Date` header carries the user's local date for `archived_date` and `updated_at` (per the existing `resolveRequestDate` middleware).

### 2.2 · Behavior change vs. today

- **Was:** sets `archived = 1`, `fav = 0`, `updated_at = now`.
- **Now:** sets `archived = 1`, `archived_date = now (date-only)`, `updated_at = now`. **Does NOT touch `fav`.**

### 2.3 · Responses

**200 OK** — record returned with `archived: true` and `archivedDate` set.

```json
{
  "data": {
    "id": 42,
    /* ... */
    "archived": true,
    "archivedDate": "2026-05-26",
    "fav": true /* preserved if it was true */
    /* ... */
  }
}
```

**404 Not Found** — id is unknown or does not belong to the authenticated user.

```json
{ "error": { "code": "NOT_FOUND", "message": "Application not found" } }
```

**400 Bad Request** — invalid id.

```json
{ "error": { "code": "BAD_REQUEST", "message": "Invalid id" } }
```

### 2.4 · Idempotency

Archiving an already-archived row succeeds and returns the same record (no-op effective UPDATE). `archived_date` is **not** rewritten on a re-archive — the original archive date is preserved. `updated_at` is **not** bumped on a re-archive — the no-op path returns the existing record without writing.

> Implementation note (see [research.md § 5.1.1](../research.md#511--supabase-archive--unarchive-concurrency-hardening)):
> Both adapters use the same atomic conditional UPDATE pattern with an `archived = <opposite-state>` predicate. The second (re-archive) request matches 0 rows in either path and resolves via a fallback `getById`, returning the original record with both `archived_date` and `updated_at` intact. Race-free under concurrent writes (Postgres serialization on Supabase; single-writer model on SQLite).

---

## 3 · `POST /api/applications/:id/unarchive` (new)

### 3.1 · Request

```http
POST /api/applications/42/unarchive HTTP/1.1
X-Client-Date: 2026-05-26
```

No request body. Optional `X-Client-Date` header sets `updated_at`.

### 3.2 · Behavior

Sets `archived = 0`, `archived_date = NULL`, `updated_at = now`. Does **not** touch `fav`, `status`, `last_status_update`, `application_date`, or any other field. No state-machine validation runs (per spec edge case: terminal-status rows are unarchivable).

### 3.3 · Responses

**200 OK** — record returned with `archived: false` and `archivedDate: null`.

```json
{
  "data": {
    "id": 42,
    /* ... */
    "archived": false,
    "archivedDate": null,
    "status": "rejected" /* unchanged */
    /* ... */
  }
}
```

**404 Not Found** — id is unknown or does not belong to the authenticated user.

```json
{ "error": { "code": "NOT_FOUND", "message": "Application not found" } }
```

**400 Bad Request** — invalid id.

```json
{ "error": { "code": "BAD_REQUEST", "message": "Invalid id" } }
```

### 3.4 · Idempotency

Unarchiving an already-active row succeeds and returns the same record. Both SQLite and Supabase adapters use the same atomic conditional UPDATE pattern with an `archived = true` predicate. The second (re-unarchive) request matches 0 rows and resolves via a fallback `getById`, returning the existing active record with `updated_at` unchanged. See [research.md § 5.1.1](../research.md#511--supabase-archive--unarchive-concurrency-hardening).

---

## 4 · `PATCH /api/applications/:id` (clarifications, no signature change)

The existing PATCH endpoint already accepts an `archived` field in the body (via `optionalBoolean` in `server/validation/application.js:103`). This is unchanged in this feature except that the side effect of clearing `fav` when `archived: true` is written is **removed** (FR-009).

- A client SHOULD use `POST /:id/archive` and `POST /:id/unarchive` for archive lifecycle changes. The PATCH path is retained for backwards compatibility but is **not** the canonical archive interface.
- A PATCH body containing `archivedDate` is silently ignored — the field is not in `FIELD_TO_COLUMN`, so `toRow()` drops it. This is the existing behavior for any unknown field.
- Tests MUST assert that PATCHing `archivedDate` does not corrupt the record (the field is dropped, not written through).

---

## 5 · `GET /api/applications/:id`

Unchanged. Returns the full record by id regardless of `archived` state. This is necessary because the read-only Archived overlay opens a record by id, and the row's `archived` flag determines the overlay's mode.

---

## 6 · Client API surface (`src/services/api.js`)

The client-side service module gains:

```js
export function unarchive(id) {
  if (isDemo()) return fromDemo(() => demoStore.unarchive(id));
  return request('POST', `/api/applications/${id}/unarchive`);
}
```

And `getAll` is extended:

```js
export function getAll({ view } = {}) {
  if (isDemo()) {
    return Promise.resolve(view === 'archived' ? demoStore.getAllArchived() : demoStore.getAll());
  }
  const query = view === 'archived' ? '?view=archived' : '';
  return request('GET', `/api/applications${query}`);
}
```

Existing callers that invoke `api.getAll()` without arguments continue to work unchanged (active list).

---

## 7 · RLS and authorization

- Both endpoints reuse the existing `requireAuth` middleware. No new role, no new policy.
- The Supabase repo's `archive()` and `unarchive()` use `.eq('user_id', userId)` in addition to RLS — defense in depth (consistent with the existing pattern documented in [019-supabase-persistence/research.md](../019-supabase-persistence/research.md)).
- The `?view=archived` filter is applied **after** the user-scoped query — a user can only see their own archived rows.

---

## 8 · Wire-format compatibility

| Change | Backward-compatible? |
|---|---|
| `Application` record gains `archivedDate` | Yes — additive field; older clients ignore it. |
| `POST /:id/archive` no longer zeros `fav` | Observable behavior change. Document in CHANGELOG. |
| `GET /` accepts `?view=archived` | Yes — additive; unknown values fall back to active. |
| `POST /:id/unarchive` | Yes — new endpoint; old clients never call it. |
| `?view=archived` on a server that doesn't know it yet | N/A — server and client deploy together. |
