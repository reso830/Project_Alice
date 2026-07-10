# Contracts: Hosted Password Management

**Feature**: [plan.md](./plan.md) · **Date**: 2026-07-10

> **One new API endpoint** (`PATCH /api/account/password`, Change Password only). Forgot Password and Reset Password add **no new Alice server endpoints** — both call the Supabase client SDK directly from the browser, exactly like the existing `signInWithPassword`/`signUp` calls in `LoginForm.js`/`SignupForm.js`. The internal contracts below (§2, §3) document the client-side state machine this feature depends on getting right, since that's the primary risk (see plan.md Architecture / research.md D1).

---

## 1. `PATCH /api/account/password` (new)

Mounted in `server/routes/account.js` alongside the existing `DELETE /`, behind the same `requireAuth` middleware, dispatched through `req.repos.account` (runtime-polymorphic, matching the existing `delete()` pattern).

**Request**
```jsonc
{ "currentPassword": "string", "newPassword": "string" }
```

**Success `200`**
```jsonc
{ "data": { "updated": true } }
```

**Failure**
| HTTP | `error.code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `currentPassword`/`newPassword` missing, or `newPassword` shorter than the 8-char policy floor |
| 401 | `INVALID_PASSWORD` | `currentPassword` does not authenticate via `signInWithPassword` (hosted only) |
| 401 | *(from `requireAuth`)* | no/invalid JWT — unchanged existing middleware behavior |
| 501 | `NOT_SUPPORTED` | local-mode adapter (Change Password has no meaning without a hosted account) |
| 500 | `INTERNAL_ERROR` | admin-client update fails for a reason other than the above |

**Hosted implementation** (`server/repositories/supabase/account.js`, new `changePassword(body)`):
1. Validate both fields present, `newPassword.length >= 8` → else `VALIDATION_ERROR`/400 (mirrors `deleteAccount`'s existing missing-password check).
2. Re-verify `currentPassword` via a fresh anon client's `signInWithPassword({ email, password: currentPassword })` (identical mechanism to `deleteAccount`'s step 1) → failure → `INVALID_PASSWORD`/401.
3. Update via the lazily-imported service-role admin client: `admin.auth.admin.updateUserById(userId, { password: newPassword })` → failure → rethrow (route maps to 500).
4. Return `{ updated: true }`.

**Local implementation** (`server/repositories/account.js`, new `changePassword()`): throws `{ code: 'NOT_SUPPORTED', status: 501 }` unconditionally — Local Mode has no hosted account. Never reached through the UI (the Change Password control is gated out client-side in Local/Demo Mode), but present so the runtime-polymorphic route handler never crashes on a missing method.

**Password/current-password values are never logged**, matching the existing comment on `DELETE /api/account`'s handler (`req.body` is passed through without logging).

---

## 2. Recovery-detection contract (internal, `authStore`)

The rework MUST preserve these guarantees:

| # | Guarantee | Rationale |
|---|---|---|
| R1 | A recovery-shaped URL (Supabase's `type=recovery` marker) is checked **synchronously**, before any `await`, so the guard is armed before `getSession()`/`onAuthStateChange` can race it | deterministic — no dependency on async timing to know whether a guard is needed at all |
| R2 | While the guard is armed, a bare `SIGNED_IN` event does **not** resolve `authStore` to `authenticated` | prevents `main.js` from mounting the real app shell for a frame before `PASSWORD_RECOVERY` arrives (research.md D1) |
| R3 | A `PASSWORD_RECOVERY` event while the guard is armed resolves to `password-recovery`, disarming the guard | the actual "we're in a recovery flow" signal |
| R4 | If neither event arrives within the guard timeout, resolve to `recovery-expired`, disarming the guard | covers a dead/malformed/already-consumed link — also the mechanism behind AC-7 |
| R5 | The guard is armed **at most once per page load** (a recovery link is a one-shot entry point) — it never re-arms during normal in-app use | prevents a false-positive guard on, e.g., a coincidental URL parameter during normal navigation |
| R6 | A confirmed `password-recovery` → successful `updateUser({password})` → explicit `signOut()` → `unauthenticated`, in that order, not skipped | spec Clarification (2026-07-10): return to a logged-out Welcome/login screen, not the authenticated app shell |
| R7 | A confirmed `password-recovery` that is **abandoned** (close button, Escape, backdrop click, or "Back to sign in", without submitting) also calls explicit `signOut()` → `unauthenticated`, before or as part of the overlay closing — never left as a dangling `password-recovery` status once the overlay is gone | spec Clarification (2026-07-10): every exit from a recovery session ends it, not just a successful one — otherwise `authStore` and the visible UI can disagree about whether a recovery session is still active |

## 3. `resetPasswordForEmail` / `updateUser` contract (internal, client-direct Supabase calls)

| # | Guarantee | Rationale |
|---|---|---|
| F1 | `resetPasswordForEmail(email, { redirectTo })` is called for **every** syntactically-valid-format email, regardless of whether Supabase reports the account exists | non-enumeration (FR-8/AC-5) — the UI shows identical confirmation copy on both the success and "user not found"-shaped outcomes |
| F2 | A syntactically invalid email never reaches `resetPasswordForEmail` at all | client-side format validation gates the call, consistent with `LoginForm.js`'s existing email-format check |
| F3 | `updateUser({password})` during Reset Password is only reachable while `authStore.getAuthState().status === 'password-recovery'` | the form is only ever mounted in that state (§2, R3) — no separate runtime guard needed inside the form itself |
| F4 | A `updateUser` failure citing an invalid/expired session transitions the view to `recovery-expired` (not a generic inline error) | FR-11's "recovery session remains valid" check, surfaced consistently with the on-load expired-link state (AC-7) rather than as a one-off error string |
