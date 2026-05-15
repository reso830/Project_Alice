# API Contracts: Hosted Authenticated User Access (018)

This document defines:
1. The **environment configuration additions** introduced by this feature
2. The **`Authorization` header contract** between frontend and API
3. The **`requireAuth` middleware contract** for protected routes
4. The **`/api/health` runtime-handshake contract**
5. The **Supabase Auth Hook contract** (allowlist trigger)
6. The **Vite build-time assertion contract**
7. The **error response inventory** for auth failures

The environment variable contract from 017 still applies; only the additions
and changes are listed here.

---

## 1. Environment Configuration Additions

Extends the table in `specs/017-hosted-foundation/contracts/api.md`.

### Server-only (added)

| Variable | Local required | Hosted required | Notes |
|---|---|---|---|
| `SUPABASE_JWT_SECRET` | no | yes | HS256 secret used to verify Supabase-issued access tokens in `requireAuth`. **Never expose to the frontend.** |

### Client-safe (added — read at Vite build time, inlined into the bundle)

| Variable | Local required | Hosted build required | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | no | yes | Supabase project URL. Read by `src/services/supabaseClient.js`. |
| `VITE_SUPABASE_ANON_KEY` | no | yes | Supabase anon/public key. Read by `src/services/supabaseClient.js`. |
| `VITE_AUTH_EMAIL_REDIRECT_URL` | no | yes | URL Supabase uses as the redirect target after email verification (e.g. `https://example.com/?auth=callback`). Passed to `supabase.auth.signUp({ options: { emailRedirectTo } })`. Must point at the welcome-page callback handler. |

### Removed from earlier plan revision

`AUTH_EMAIL_REDIRECT_URL` is **no longer a server-side env var**. It moved to
the client (`VITE_AUTH_EMAIL_REDIRECT_URL`) because the redirect URL is now
passed from the browser's `supabase.auth.signUp` call rather than from an
Express endpoint.

### Validation rules (added to `server/config.js`)

Adds one rule to 017's validation:

6. If `APP_RUNTIME=hosted` and `SUPABASE_JWT_SECRET` is absent or empty-string →
   throw:
   ```
   Missing required environment variable for hosted mode: SUPABASE_JWT_SECRET
   ```

### Client-bundle guarantees

Re-asserted from 017 (with one addition):
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
routers (`applications`, `profile`, `resume`) only when the application boots
in hosted mode. Local mode never instantiates the middleware.

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

## 4. `/api/health` Runtime-Handshake Contract

`/api/health` is extended so the frontend can detect a hosted-server /
local-frontend configuration mismatch at runtime (defense in depth for the
build-time assertion in §6).

### Request

```http
GET /api/health
```

### Response (success)

```json
{
  "status": "ok",
  "runtime": "local"
}
```

or

```json
{
  "status": "ok",
  "runtime": "hosted"
}
```

### Behavior

- `runtime` reflects `config.runtime` exactly (`"local"` or `"hosted"`).
- The endpoint remains **public** (no `requireAuth`). It is safe to share the
  runtime mode with unauthenticated callers; it is already implicit in the
  presence of the welcome page.
- Frontend `main.js` calls this once at boot. If `runtime === "hosted"` and
  the frontend's `isHostedAuthAvailable === false`, mount `ConfigError.js`
  instead of the welcome page or app shell.

---

## 5. Supabase Auth Hook Contract

The single source of allowlist enforcement is a Postgres trigger function on
`auth.users`. Defined in `data-model.md §2-3`.

### Caller-agnostic enforcement

The trigger fires on **every** insert into `auth.users`, regardless of which
Supabase API initiated the signup:

| Caller | Trigger fires? |
|---|---|
| `supabase.auth.signUp` from browser (anon key) | yes |
| `supabase.auth.admin.createUser` from server (service-role) | yes |
| Direct SQL `insert into auth.users` (service-role) | yes |
| Supabase dashboard "Add user" | yes |

### Allow / deny semantics

- Email lookup is case-insensitive (`lower(new.email)` against
  `allowed_emails.email` which is lowercased on insert).
- On hit, the trigger returns and the insert proceeds normally. Supabase then
  emails the verification link to `options.emailRedirectTo` (set by the caller)
  or to the project's default site URL.
- On miss, the trigger raises an exception with errcode `P0001` and message
  `"Signup is not available for this email."` Supabase Auth surfaces this to
  the caller as an error.

### Frontend error mapping

SignupForm catches every error from `supabase.auth.signUp` and maps it to the
single neutral user-facing message:

```
"This email cannot sign up right now."
```

This applies regardless of the underlying cause (allowlist miss, duplicate
email, Supabase rate-limit, network error) to satisfy FR-006's enumeration-
channel requirement.

---

## 6. Vite Build-Time Assertion Contract

`vite.config.js` includes a plugin that runs during the `config` hook of every
Vite build. Behavior:

- If `process.env.NODE_ENV === 'production'` (or Vite's `mode === 'production'`):
  - If `process.env.VITE_SUPABASE_URL` is missing or empty → throw with message
    `"Production build requires VITE_SUPABASE_URL — set it in your build environment."`
  - If `process.env.VITE_SUPABASE_ANON_KEY` is missing or empty → throw with
    similarly descriptive message.
  - If `process.env.VITE_AUTH_EMAIL_REDIRECT_URL` is missing or empty → throw
    with similarly descriptive message.
- In development (`mode !== 'production'`), the plugin emits no error so local
  dev without Supabase env vars continues to work (this is local mode).

The throw prevents `dist/` from being produced. CI / Vercel build fails loudly.

---

## 7. Error Code Inventory (this feature)

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing/invalid/expired token on a protected route |
| `INTERNAL_ERROR` | 500 | Server error reaching the request — uses 017's existing handler |

### Removed from earlier plan revision

- `SIGNUP_NOT_PERMITTED` — removed because there is no longer an Express signup
  endpoint. Signup rejections come directly from Supabase Auth as errors on the
  client; the frontend maps them to a neutral user-facing message in
  SignupForm without surfacing a stable error code.
- `VALIDATION_ERROR` for signup payloads — removed for the same reason. Field-
  level validation now lives in SignupForm (Zod or hand-rolled, TBD in tasks).

---

## 8. Frontend ↔ Supabase Auth (out-of-band, for reference)

These calls go **directly** from the browser to Supabase Auth via the JS client.
They are not Express endpoints, but the plan references them.

| Action | JS client call | Notes |
|---|---|---|
| Sign up | `supabase.auth.signUp({ email, password, options: { emailRedirectTo: VITE_AUTH_EMAIL_REDIRECT_URL } })` | Auth Hook trigger runs server-side. Supabase sends verification email on success. |
| Sign in | `supabase.auth.signInWithPassword({ email, password })` | After success, JS client persists the JWT to `localStorage`. |
| Sign out | `supabase.auth.signOut()` | Clears localStorage; `authStore` notifies subscribers. |
| Restore session | `supabase.auth.getSession()` | Called once at boot; populates `authStore`. |
| Subscribe to changes | `supabase.auth.onAuthStateChange(...)` | `authStore` re-broadcasts to UI subscribers. |
