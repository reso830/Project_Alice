# API Contract: Delete Profile & User Data (030)

**Branch**: `030-delete-profile-data` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

One new endpoint. Response envelope matches the existing API convention: success → `{ "data": ... }`; error → `{ "error": { "code", "message", "fields?" } }` (see [`server/index.js`](../../server/index.js) error handler and [`src/services/api.js`](../../src/services/api.js) `request`).

---

## `DELETE /api/account`

Permanently deletes the current user's account and all associated data (hosted), or clears all local data (local). Runtime-polymorphic via the `account` repository; the handler does not branch on `config.runtime`.

**Middleware**: `requireAuth` (hosted only — absent in local mode by existing convention) → `attachRepos`. **`seedHostedUserIfNeeded` is intentionally NOT mounted** (research.md R-3).

### Request

**Headers** (hosted): `Authorization: Bearer <jwt>`, `Content-Type: application/json`.

**Body**:

| Mode | Body | Notes |
|---|---|---|
| Hosted | `{ "password": "<string>" }` | Required. Re-verified server-side before any deletion. Never logged. |
| Local | `{ "confirm": "DELETE" }` | Required. The local clear is gated at the API boundary (not UI-only) so a stray/empty request cannot wipe data. Value must equal `DELETE`. |

> `DELETE` with a JSON body is supported by `express.json()` + `fetch`. If body-on-DELETE is awkward in implementation/tests, `POST /api/account/delete` with the same body/handler is an acceptable equivalent (research.md R-5) — does not change the user-visible contract.

### Responses

**200 OK** — deletion/clear succeeded.
```json
{ "data": { "deleted": true } }
```
Local mode MAY return `{ "data": { "cleared": true } }`. Either way the client treats 200 as success.

**401 Unauthorized — `INVALID_PASSWORD`** (hosted) — the submitted password did not match. **Nothing was deleted.** Distinct from a missing/expired-token 401 so the client can show a password error rather than rerouting.
```json
{ "error": { "code": "INVALID_PASSWORD", "message": "Incorrect password." } }
```

**401 Unauthorized — `UNAUTHORIZED`** (hosted) — missing/invalid/expired JWT (existing `requireAuth` body). Client treats this as a dead session (FR-011a revalidation path).
```json
{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }
```

**400 Bad Request — `VALIDATION_ERROR`** — hosted: missing/empty `password` field; local: missing/mismatched `confirm` (must equal `DELETE`).
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Password is required." } }
```
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Confirmation required." } }
```

**500 Internal Server Error — `INTERNAL_ERROR`** — admin delete failed, password-verification call errored unexpectedly, or local transaction failed. **All-or-nothing: no partial deletion.** Client shows an error toast; user remains signed in with data intact (FR-012).
```json
{ "error": { "code": "INTERNAL_ERROR", "message": "<message>" } }
```

### Server behavior

The route calls a uniform `req.repos.account.delete(req.body)`; each runtime adapter implements `delete(body)` (research.md R-5 / R-6).

**Hosted** (`account.delete(body)` reads `body.password`):
1. Validate `password` present → else `400 VALIDATION_ERROR`.
2. Anon client `signInWithPassword({ email: req.user.email, password })`:
   - error → `401 INVALID_PASSWORD` (no admin call runs).
   - success → discard the transient session (`persistSession: false`).
3. Service-role admin client `auth.admin.deleteUser(req.user.id)` → cascade removes `applications`, `profile`, `user_seed_state`.
4. `200 { data: { deleted: true } }`.

**Local** (`account.delete(body)` reads `body.confirm`):
1. Validate `body.confirm === 'DELETE'` → else `400 VALIDATION_ERROR`.
2. Single SQLite transaction: `DELETE FROM applications`; `DELETE FROM profile`.
3. `200 { data: { cleared: true } }`.

### Authorization invariants
- A user can only delete **their own** account — the target is always `req.user.id`; there is no `:id` parameter and no admin-delete-other-user path (FR-006).
- The service-role key is used only inside the server-side admin client and never returned in any response or exposed to the browser (FR-007, SC-008).

---

## Client service layer

`src/services/api.js`:

```text
deleteAccount(payload = {})     // hosted: { password }; local: { confirm: 'DELETE' }
  - demo:   no fetch — reject with a "not available in demo" error (020 no-fetch invariant)
  - else:   request('DELETE', '/api/account', payload)
```

**Auth-failure hook (FR-011a)**: `request()` invokes `authStore.handleAuthFailure(status)` when an authenticated request returns a status that could indicate a dead session — **401, 404, or 500** (NOT 400, and NOT `INVALID_PASSWORD`). `handleAuthFailure` calls `supabase.auth.getUser()`; if the account no longer exists it clears the session (→ Welcome) with a message. A still-valid user → no action (a legitimate 404/500 never signs the user out).

> The `INVALID_PASSWORD` 401 from the delete modal MUST be handled as a form error within the modal, **not** treated as a dead-session reroute — distinguish by `error.code`.
