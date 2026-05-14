# API Contracts: Hosted Authenticated User Access (018)

This document defines:
1. The **environment configuration additions** introduced by this feature
2. The **`Authorization` header contract** between frontend and API
3. The **`requireAuth` middleware contract** for protected routes
4. The **`/api/auth/signup`** endpoint contract
5. The **error response shape** for auth failures

The environment variable contract from 017 still applies; only the additions are
listed here.

---

## 1. Environment Configuration Additions

Extends the table in `specs/017-hosted-foundation/contracts/api.md`.

| Variable | Scope | Local required | Hosted required | Notes |
|---|---|---|---|---|
| `SUPABASE_JWT_SECRET` | server-only | no | yes | HS256 secret used to verify Supabase-issued access tokens. **Never expose to the frontend.** |
| `AUTH_EMAIL_REDIRECT_URL` | server | no | yes | URL Supabase uses as the redirect target after email verification (e.g. `https://example.com/?auth=callback`). Must point at the welcome-page callback handler. |

### Validation rules (enforced in `server/config.js`)

Adds two rules to 017's validation:

6. If `APP_RUNTIME=hosted` and `SUPABASE_JWT_SECRET` is absent or empty-string →
   throw:
   ```
   Missing required environment variable for hosted mode: SUPABASE_JWT_SECRET
   ```
7. If `APP_RUNTIME=hosted` and `AUTH_EMAIL_REDIRECT_URL` is absent or empty-string
   → throw:
   ```
   Missing required environment variable for hosted mode: AUTH_EMAIL_REDIRECT_URL
   ```

### Client-bundle guarantees

Re-asserted from 017:
- `SUPABASE_SERVICE_ROLE_KEY` MUST NOT appear in the Vite bundle.
- `SUPABASE_JWT_SECRET` MUST NOT appear in the Vite bundle.

---

## 2. `Authorization` Header Contract

Every protected hosted API request MUST include:

```
Authorization: Bearer <supabase access token>
```

- The token is the Supabase-issued access token retrieved via the Supabase JS
  client (`supabase.auth.getSession()`).
- The frontend `services/api.js` and `services/resumeApi.js` attach this header
  automatically from `data/authStore.js`.
- The header is absent on requests made before sign-in completes.
- In local mode the header is not required and the middleware is not active.

---

## 3. `requireAuth` Middleware Contract

Located at `server/auth/middleware.js`. Applied per-router by the protected
routers (`applications`, `profile`, `resume`).

### Behavior

| Condition | Response | `req.user` after | Handler invoked |
|---|---|---|---|
| Header missing | 401 `UNAUTHORIZED` | unchanged | no |
| Header present but not `Bearer <…>` shape | 401 `UNAUTHORIZED` | unchanged | no |
| JWT signature invalid (wrong secret) | 401 `UNAUTHORIZED` | unchanged | no |
| JWT malformed | 401 `UNAUTHORIZED` | unchanged | no |
| JWT expired | 401 `UNAUTHORIZED` | unchanged | no |
| JWT valid | passthrough | `{ id, email }` set | yes |

### Resolved request augmentation

On success the middleware sets:

```js
req.user = {
  id: '<uuid from sub claim>',
  email: '<email claim>',
};
```

Route handlers may read `req.user.id` and `req.user.email`. They MUST NOT
re-verify the token. 019 will use `req.user.id` to scope repository calls.

### Response on failure

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

The message is identical for every failure mode. The middleware MUST NOT include
diagnostic details (e.g. "token expired", "signature mismatch") in the response
body. Operational logging may include the reason; the response may not.

---

## 4. `POST /api/auth/signup`

Public endpoint (no `requireAuth`) that gates signup on the `allowed_emails`
list before calling Supabase's admin create-user API. Active only in hosted
mode; mounted from `server/auth/routes.js`.

### Request

```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "<password>"
}
```

### Validation (server-side, before any Supabase call)

- `email` MUST match a permissive email regex. On failure → 400
  `VALIDATION_ERROR` with field-level error.
- `password` MUST be a string of at least 8 characters. On failure → 400
  `VALIDATION_ERROR` with field-level error.
- Validation errors are explicit and may include field-level diagnostics
  (this is not allowlist-sensitive information).

### Allowlist check

After validation, the server:
1. Lowercases `email`.
2. Queries `allowed_emails` using the service role client.
3. If no row → returns 403 (see below). MUST NOT call Supabase Auth.
4. If row exists → proceeds to admin create-user.

### Responses

#### Success — verification email sent

```http
200 OK
Content-Type: application/json

{
  "data": {
    "status": "verification_sent",
    "email": "user@example.com"
  }
}
```

#### Validation error

```http
400 Bad Request

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "email": "Invalid email address",
      "password": "Password must be at least 8 characters"
    }
  }
}
```

#### Signup not permitted (allowlist miss OR Supabase rejection)

```http
403 Forbidden

{
  "error": {
    "code": "SIGNUP_NOT_PERMITTED",
    "message": "Signup is not available for this email."
  }
}
```

> **Neutral channel requirement (FR-006):** the response MUST be identical for
> (a) email not on the allowlist, (b) email already exists in Supabase Auth, and
> (c) any other Supabase-side signup rejection. Differentiating these would leak
> allowlist membership.

#### Server / configuration error

```http
500 Internal Server Error

{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "<safe message>"
  }
}
```

Examples that map to 500: `allowed_emails` table unreachable, Supabase admin API
unavailable.

---

## 5. Frontend ↔ Supabase Auth (out-of-band, for reference)

These calls go **directly** from the browser to Supabase Auth via the JS client.
They are not Express endpoints, but the plan references them.

| Action | JS client call | Notes |
|---|---|---|
| Sign in | `supabase.auth.signInWithPassword({ email, password })` | After success, JS client persists the JWT to `localStorage` |
| Sign out | `supabase.auth.signOut()` | Clears localStorage; `authStore` notifies subscribers |
| Restore session | `supabase.auth.getSession()` | Called once at boot; populates `authStore` |
| Subscribe to changes | `supabase.auth.onAuthStateChange(...)` | `authStore` re-broadcasts to UI subscribers |

The signup `supabase.auth.signUp()` call is **not** used by this feature. Signup
is server-mediated via `POST /api/auth/signup`.

---

## 6. Error Code Inventory (this feature)

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing/invalid/expired token on a protected route |
| `VALIDATION_ERROR` | 400 | Signup payload failed local validation (already used by 017's error handler; reused here) |
| `SIGNUP_NOT_PERMITTED` | 403 | Allowlist miss or Supabase-side signup rejection (neutral) |
| `INTERNAL_ERROR` | 500 | Supabase unreachable, allowlist read failed, etc. (already in 017's handler) |
