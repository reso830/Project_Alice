# Data Model: Hosted Password Management

**Feature**: [plan.md](./plan.md) · **Date**: 2026-07-10

> **No persistence / database model changes.** This feature does not add, remove, or modify any entity, table, or `createRepositories`-routed store. The constitution's required fields (company, job title, status, `lastStatusUpdate`, responsibilities) are untouched. What follows models the **client-side auth-status state machine** (extended by this feature) and the **request/response shapes** for the one new server operation. No user password is ever persisted by Alice itself — Supabase Auth is the sole store.

---

## 1. `authStore` status union (extended)

| Status | Enter condition | Today or new? |
|---|---|---|
| `initializing` | module load, before `init()` resolves | today |
| `local-mode` | `isHostedAuthAvailable === false` | today |
| `unauthenticated` | `getSession()` resolves no session | today |
| `authenticated` | `getSession()` resolves a session, **or** a `SIGNED_IN` event fires and is not part of a pending recovery sequence | today |
| `demo` | `enterDemo()` | today |
| **`password-recovery`** | a recovery-shaped URL was detected on load **and** a `PASSWORD_RECOVERY` event was subsequently confirmed | **new** |
| **`recovery-expired`** | a recovery-shaped URL was detected on load, but no `PASSWORD_RECOVERY` event arrived within the guard timeout, **or** `updateUser({password})` fails at submit time citing an invalid/expired session (FR-11) | **new** |

**Invariants**
- Any event other than `PASSWORD_RECOVERY` that arrives while a recovery-URL guard is pending — in practice `INITIAL_SESSION`, per the source-verified finding in research.md D1 (originally assumed to be `SIGNED_IN`) — does **not** resolve to `authenticated`; it is held until either `PASSWORD_RECOVERY` confirms it (→ `password-recovery`) or the guard times out (→ `recovery-expired`). See plan.md Architecture / research.md D1.
- `password-recovery` and `recovery-expired` are both reachable **only** during initial boot (a recovery link is a one-shot entry point) — neither is a state the app can transition into from `authenticated`/`unauthenticated` during normal use.
- **Every** exit from `password-recovery` transitions to `unauthenticated` via an explicit `signOut()` call — not just a successful Reset Password submit, but also closing the overlay (× button, Escape, backdrop click, or "Back to sign in") without submitting (spec Clarification, 2026-07-10). `password-recovery` never persists past the overlay closing, regardless of how it closed; `updateUser()` itself has no session side effect (Supabase does not sign a session out as a side effect of a password change), so every one of these paths calls `signOut()` explicitly, none of them rely on it happening implicitly.
- `recovery-expired` has no further transition except "user navigates back to the standard Welcome/login flow" (a UI action, not an auth-state change) or a fresh Forgot Password request (which restarts the flow from `unauthenticated`) — this state never held a confirmed recovery session in the first place (the guard timed out before one was confirmed), so there is nothing to sign out of.

## 2. `main.js` render-branch mapping (extended)

| `authStore` status | Today's mount | New mount |
|---|---|---|
| `initializing` | unmount everything | unchanged |
| `local-mode` (health-gated, per 044) | app shell | unchanged |
| `authenticated` / `demo` | app shell | unchanged |
| `unauthenticated` | `mountWelcome()` (overlay closed / login) | unchanged |
| `password-recovery` | *(unreachable today)* | `mountWelcome({ initialAuthView: 'reset-password' })` |
| `recovery-expired` | *(unreachable today)* | `mountWelcome({ initialAuthView: 'recovery-expired' })` |

## 3. `AuthOverlay` / `WelcomePage` view union (extended)

| View | Reached via | Today or new? |
|---|---|---|
| `login` | default / "Sign In" CTA / swap from signup | today |
| `signup` | "Create Account" CTA / swap from login | today |
| `verification_sent` | `SignupForm`'s `onSuccess` | today |
| **`forgot`** | "Forgot password?" link on `login` (login view only) | **new** |
| **`forgot_sent`** | `ForgotPasswordForm`'s `onSuccess` | **new** |
| **`reset-password`** | `main.js` mounting with `initialAuthView: 'reset-password'` (never reached by a click) | **new** |
| **`recovery-expired`** | `main.js` mounting with `initialAuthView: 'recovery-expired'`, **or** `ResetPasswordForm` submit failing with an invalid-session error | **new** |

**Invariant**: `reset-password` and `recovery-expired` are the only two views an overlay can *open into* directly (via the initial-view parameter) rather than reach purely through in-overlay navigation — mirroring how every other view is reachable by a click or a form's `onSuccess`.

## 4. `PATCH /api/account/password` — request/response shape

No new persisted entity; documented here because it's the one new wire contract this feature introduces (see [contracts/api.md](./contracts/api.md) for the full contract, error codes, and both runtime adapters).

| Field | Direction | Notes |
|---|---|---|
| `currentPassword` | request | never logged; forwarded only to Supabase's `signInWithPassword` for re-verification |
| `newPassword` | request | never logged; forwarded only to Supabase's `admin.updateUserById` |
| `updated` | response (`200`) | `true` |
| `error.code` | response (4xx/5xx) | `VALIDATION_ERROR` \| `INVALID_PASSWORD` \| `NOT_SUPPORTED` \| `INTERNAL_ERROR` |
