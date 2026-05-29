# Implementation Plan: Delete Profile & User Data

**Branch**: `030-delete-profile-data` | **Date**: 2026-05-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/030-delete-profile-data/spec.md`
**Supporting artifacts**: [research.md](research.md) · [data-model.md](data-model.md) · [contracts/api.md](contracts/api.md) · [quickstart.md](quickstart.md) · [checklists/plan-review.md](checklists/plan-review.md)

## Summary

Add an **Account** section to the Profile page that lets a hosted user permanently delete their account (and, by cascade, all their data) and lets a local user wipe all local data. Hosted deletion is gated by **server-side password re-verification** and executed via the Supabase **service-role admin API** (`auth.admin.deleteUser`), relying on the existing `ON DELETE CASCADE` foreign keys to remove `applications`, `profile`, and `user_seed_state`. The control is mode-aware: enabled "Delete account" (hosted), "Clear all data" with a typed-`DELETE` gate (local), and visible-but-disabled (demo). After a hosted delete the acting device signs out and lands on Welcome; other devices reroute on their next failed request via a one-shot session revalidation. No schema change is required.

## Technical Context

**Language/Version**: Node.js (ESM), vanilla JS frontend (Vite), Express backend
**Primary Dependencies**: `express`, `@supabase/supabase-js` ^2.45.0 (admin API + `signInWithPassword`), `better-sqlite3` (local), `jose` (JWT verify — existing)
**Storage**: Supabase Postgres (hosted, RLS + cascade FKs); SQLite (local); in-memory demo store
**Testing**: Vitest (`tests/server/**`, `tests/services/**`, `tests/pages/**` — match existing layout), jsdom for client
**Target Platform**: Desktop + mobile browsers; hosted on Vercel + Supabase, or local Node/SQLite
**Project Type**: Web app (Vite SPA + Express API), runtime modes: `local` / `hosted` / demo
**Performance Goals**: Deletion is a single user-initiated action — no throughput target. No per-request overhead added to existing routes.
**Constraints**: Local-first/no analytics; lazy-import discipline (no top-level `@supabase/supabase-js` or `better-sqlite3` on the wrong boot path); service-role key server-only, never in a client bundle or response.
**Scale/Scope**: One new endpoint, one new repository concern (`account`) across two adapters + demo no-op, one new Profile section, one confirmation modal, one client auth-failure revalidation hook.

## Constitution Check

*GATE: re-checked after design below.*

- **Required fields**: This feature deletes data; it does not create or mutate application fields. Required-field invariants are untouched. ✅
- **Business logic vs UI**: Deletion logic lives in repository adapters + the route handler; the Profile section and modal are presentation only. Password verification is server-side. ✅
- **Validation / no silent corruption**: Deletion is all-or-nothing — hosted relies on atomic cascade; local clear runs in a single SQLite transaction. A failed password or failed admin call deletes nothing (FR-012, FR-023). ✅
- **Workflows + states**: Explicit loading (in-flight delete), error (failed password / failed delete), and post-delete empty/redirect states (FR-020). ✅
- **Tests**: New automated tests cover endpoint auth/own-account scope, password gate, mode-dependent control, and post-delete routing (FR-024). Lint/format via existing `npm run lint` / `npm run format`. ✅
- **Privacy / local-first**: No analytics; service-role key server-only; password never logged (FR-007a, FR-022). ✅
- **Accessibility / responsive**: Labeled controls, keyboard-operable focus-trapped modal, non-color-only destructive signaling, desktop + mobile (FR-021). ✅
- **Extensibility without overbuild**: The "Account" section is named for its single current purpose (deletion); no speculative settings surface is built (Non-Goals). ✅

No violations. No new dependency (uses already-present `@supabase/supabase-js`).

## Architecture

The feature spans backend (new endpoint + `account` repository concern), the client service layer (`api.js` + a session-revalidation hook), and the Profile page (new section + modal). It deliberately reuses existing seams rather than adding new infrastructure.

### Backend

- **New router** `server/routes/account.js` exposing `DELETE /api/account`, mounted in `server/index.js` like the other routers, with `requireAuth` (hosted only — `requireAuth` is undefined in local mode by existing convention) and `attachRepos(repos)`. **It does NOT mount `seedHostedUserIfNeeded`** — the delete path must never trigger a re-seed (see research.md R-3).
- **New repository concern `account`**, added to the dispatcher bundle in `server/repositories/index.js` alongside `applications` and `profile`:
  - **Hosted** — `server/repositories/supabase/account.js#createSupabaseAccountRepository(client, { userId, email })` with `delete(body)` (reads `body.password`):
    1. Re-verify the password: construct a throwaway anon client and call `auth.signInWithPassword({ email, password })`. On error → throw a typed `INVALID_PASSWORD` error (no admin call runs). `email` comes from `req.user.email` (the JWT `email` claim set by `requireAuth`).
    2. Construct a **service-role admin client** (lazy import; `SUPABASE_SERVICE_ROLE_KEY`) and call `auth.admin.deleteUser(userId)`. The `ON DELETE CASCADE` FKs remove all of the user's rows. Returns `{ deleted: true }`.
  - **Local** — SQLite account adapter with the same `delete(body)` method (reads `body.confirm`): require `body.confirm === 'DELETE'` (else a typed `VALIDATION_ERROR`), then a single SQLite transaction `DELETE FROM applications; DELETE FROM profile;`. The `confirm` token gates the destructive clear at the API boundary, not UI-only (research.md R-6). No password (local mode has no auth and `requireAuth` is not mounted).
  - The route handler calls the uniform `delete(body)` method (`req.repos.account.delete(req.body)`); each adapter does the runtime-appropriate work. The handler does not branch on `config.runtime`.
- **Service-role admin client factory** (`server/repositories/supabase/adminClient.js`, lazy-imported only on the delete path) — distinct from the per-request anon JWT client (`client.js`). Documented as the **first runtime consumer** of the service-role key.

### Client — service layer

- `src/services/api.js#deleteAccount(payload = {})` → `DELETE /api/account` with `payload` (hosted: `{ password }`; local: `{ confirm: 'DELETE' }`). Add the mandatory **demo branch** (no fetch): demo throws/rejects a "not available in demo" error to satisfy the `api.demo.test.js` no-fetch invariant — though the control is disabled in demo so this path is not user-reachable.
- **Session-revalidation hook (FR-011a)**: on a failed authenticated response, `api.js` invokes `authStore.handleAuthFailure(status)`. `authStore` gains `handleAuthFailure()` which calls `supabase.auth.getUser()`; if it reports the account no longer exists, it clears the session (→ `unauthenticated` → Welcome) with a message. Trigger is scoped to auth-suspicious statuses — **401, 404, or 500** (the stale-session delete-race surfaces as a 500 from the seed middleware or a 404 from a zero-row update) — and excludes 400 validation errors and the `INVALID_PASSWORD` modal error, so ordinary failures never trigger a spurious sign-out (a still-valid `getUser()` is a no-op).

### Client — UI

- `src/pages/Profile.js` gains `renderAccountSection(page, { mode, navigate })`, appended after `renderProfileSection`. Mode is read from `authStore.getAuthState().status` (`authenticated` → hosted; `local-mode` → local; `demo` → disabled).
- A **confirmation modal** (reuse `src/components/Modal.js`; `ConfirmDialog.js` as a reference for structure) with:
  - Hosted: warning copy + password input + destructive button enabled only when the field is non-empty; submit calls `api.deleteAccount({ password })`.
  - Local: warning copy + a text input; destructive button enabled only when the value is exactly `DELETE`; submit calls `api.deleteAccount({ confirm: 'DELETE' })`.
- Post-success: hosted → `authStore.signOut()` + toast `Account deleted.`; local → toast `All data cleared.` + re-render Profile/Tracker empty states (the app shell stays mounted).

### Key architectural decisions

- **Cascade over manual deletes** — deleting the `auth.users` row removes every owned row via existing FKs; no per-table delete logic in hosted mode (research.md R-1).
- **Server-side password gate** — a stolen JWT alone cannot delete the account (FR-004, R-2).
- **No seed middleware on the delete route** — prevents a re-seed during deletion (R-3).
- **Eventual + on-failure cross-device reroute** — no per-request user-existence check; accept the idle-device token-lifetime window (R-4, FR-011a/b).

## Data flow

### Hosted delete flow
1. User opens Profile → Account → "Delete account" → modal.
2. User enters password, confirms → `api.deleteAccount({ password })` → `DELETE /api/account` `{ password }` with `Authorization: Bearer <jwt>`.
3. `requireAuth` verifies the JWT, sets `req.user = { id, email }`.
4. Handler → `req.repos.account.delete(req.body)`:
   a. Anon client `signInWithPassword({ email, password })` → on failure return `401 INVALID_PASSWORD`, nothing deleted.
   b. Service-role `admin.deleteUser(userId)` → cascade removes `applications` + `profile` + `user_seed_state`.
5. `200 { data: { deleted: true } }` → client stages `setAuthNotice('Account deleted.', 'success')` → `authStore.signOut()` → `onAuthStateChange(null)` → `unauthenticated` → Welcome; `mountWelcome()` consumes the notice and shows the success toast (staged so it survives the body-clearing reroute).

### Local clear flow
1. Profile → Account → "Clear all data" → modal → type `DELETE` → confirm.
2. `api.deleteAccount({ confirm: 'DELETE' })` → `DELETE /api/account` `{ confirm: 'DELETE' }` (no auth in local mode).
3. Handler → `req.repos.account.delete(req.body)` → require `body.confirm === 'DELETE'` (else `400 VALIDATION_ERROR`) → transaction `DELETE FROM applications; DELETE FROM profile;`.
4. `200 { data: { cleared: true } }` → toast + re-render empty states; app stays mounted.

### Cross-device (post-deletion) flow
- **Acting device**: explicit `signOut()` (above).
- **Other device, makes a request**: request fails (500 from seed-middleware FK violation, or 404) → `api.js` → `authStore.handleAuthFailure()` → `supabase.auth.getUser()` reports the account is gone → clear session → Welcome + message.
- **Other device, idle**: when the access token expires and refresh fails (refresh token revoked by `deleteUser`), Supabase fires `SIGNED_OUT` → existing `onAuthStateChange` routes to Welcome (FR-011b). Bounded by token lifetime.

## Affected Areas

### Files / components likely to be modified
- `server/index.js` — mount the new `account` router (no seed middleware).
- `server/repositories/index.js` — add `account` to the hosted and local repository bundles.
- `src/services/api.js` — add `deleteAccount()` (+ demo no-fetch branch) and the auth-failure hook call.
- `src/data/authStore.js` — add `handleAuthFailure()` (session revalidation via `getUser()`) + a one-shot reroute-notice carrier `setAuthNotice(message, type)` / `consumeAuthNotice()` returning `{ message, type }` (`ACCOUNT_DELETED_NOTICE` for the involuntary case; reused for the voluntary "Account deleted." success); confirm `signOut()` reroute path.
- `src/main.js` — `mountWelcome()` consumes the pending notice and shows it via `Toast.show(message, type)` on the reroute (FR-011a + FR-013 display; keeps Toast out of the data layer). Both the involuntary deleted-account message and the voluntary deletion-success confirmation are surfaced here because the reroute clears `document.body`.
- `src/pages/Profile.js` — add the Account section (`renderAccountSection`) + wire the modal.
- `src/styles/**` — styles for the Account section, destructive button, and modal states.
- `CHANGELOG.md`, `README.md`, `package.json` (version bump), `docs/deployment.md` (note first runtime use of `SUPABASE_SERVICE_ROLE_KEY`), `docs/REPO_MAP.md` (new files) — Release Prep phase.

### Files / components likely to be added
- `server/routes/account.js` — `DELETE /api/account` router.
- `server/repositories/supabase/account.js` — hosted account adapter (password verify + admin delete).
- `server/repositories/supabase/adminClient.js` — lazy service-role client factory.
- `server/repositories/account.js` — local SQLite account adapter (`delete(body)` → `confirm` gate + clear all).
- `src/components/` — a confirmation modal for deletion (or extend `ConfirmDialog.js`).

### Files / components likely to be inspected only
- `server/auth/middleware.js` — confirms `req.user.email` is available for password verification.
- `server/repositories/supabase/client.js` — pattern reference for the admin client (do not reuse the JWT client for admin calls).
- `server/repositories/middleware.js` (`attachRepos`) — wiring reference.
- `server/db.js`, `server/db/profile.js`, `server/db/applications.js` — confirm local table names for the local clear.
- `src/components/Modal.js`, `src/components/Toast.js`, `src/components/Navbar.js` (existing `signOut`) — reuse references.
- `src/main.js` — confirms unauthenticated → Welcome routing.
- `tests/services/api.demo.test.js` — the no-fetch demo invariant the new export must satisfy.

### Tests likely to be added or updated
- `tests/server/account.test.js` — endpoint auth required (hosted); own-account scope; success path (mocked admin client + cascade assumption); `INVALID_PASSWORD` on wrong password; local clear path (`confirm` gate); **no seed middleware** on the route. (Mirrors the existing `tests/server/profile.test.js` location.)
- `tests/server/repositories/**` — hosted account adapter (password verify branch, admin delete called with `userId`); local adapter `delete({ confirm: 'DELETE' })` transaction empties both tables, and a missing/wrong `confirm` clears nothing.
- `tests/services/api.*` — `deleteAccount(payload)` request shape; demo no-fetch branch; auth-failure hook fires `handleAuthFailure` on 401/404/500 only (not 400 / `INVALID_PASSWORD`).
- `tests/data/authStore.*` — `handleAuthFailure()` signs out when `getUser()` reports a deleted account; no sign-out when the user still exists.
- `tests/pages/profile.*` — Account section renders per mode (hosted enabled / local "Clear all data" / demo disabled); modal gate (password / typed `DELETE`); post-action behavior.

### Areas explicitly out of scope
- Any change to `applications`/`profile`/`user_seed_state` schema or RLS policies (cascade already exists — data-model.md).
- `requireAuth` per-request user-existence checks (rejected — R-4).
- Resume parsing pipeline (`server/routes/resume.js`, `server/resume/**`) — nothing persisted (spec D3).
- Calendar (026) / Timeline (025) code — cleared implicitly via application-row removal (spec D4).
- Account credential editing, password reset, email change, data export (Non-Goals).
- A separate settings route/page; a general "User Settings" surface.

## Risks and tradeoffs

| Risk | Mitigation |
|---|---|
| Service-role key leakage (first runtime use). | Admin client constructed server-side only, lazy-imported on the delete path; never returned in a response or bundled client-side; covered by SC-008 test/inspection. |
| `signInWithPassword` for verification creates a transient session. | Use `persistSession: false`; the result is discarded. Documented in research.md R-2. Only viable because auth is password-only (no OAuth/magic-link). |
| Stale-token device sees a confusing 500 (seed FK violation) instead of 401. | `handleAuthFailure()` revalidates via `getUser()` on failure and reroutes cleanly (FR-011a). Idle-device window is a documented limitation (FR-011b). |
| Auth-failure hook causing spurious sign-outs on transient errors. | Scope the trigger to 401/404/500 (not 400 / `INVALID_PASSWORD`); `getUser()` confirms the account still exists before any sign-out, so a genuine transient 404/500 never logs the user out. |
| Local clear partial failure. | Single SQLite transaction — all-or-nothing; `confirm` gate checked before the transaction. |
| Re-seed during deletion. | Seed middleware deliberately not mounted on the account route (R-3). |

## Validation

### Test pyramid
- **Unit**: account adapters (hosted verify+delete branches, local `delete(body)` confirm gate + clear), `authStore.handleAuthFailure`, `api.deleteAccount` shape + demo branch.
- **Integration**: `DELETE /api/account` via `createApp` with stubbed repositories — auth required, password gate, success, local clear, no-seed-middleware assertion.
- **Component**: Profile Account section per mode + modal gate (jsdom).
- **Browser smoke (constitution final phase)**: hosted delete with password → Welcome → re-signup yields empty account; local clear → empty states; desktop + mobile; no regression to existing Profile sections.

### Validation gates
- Constitution compliance (above) re-checked.
- Lint/format clean (`npm run lint`, `npm run format`).
- Service-role key never in client bundle (SC-008).
- All FR-024 test categories present and green.

## Project Structure

### Documentation (this feature)
```text
specs/030-delete-profile-data/
├── plan.md              # This file
├── spec.md              # Feature spec (clarified)
├── research.md          # Decisions + alternatives
├── data-model.md        # Existing schema + cascade graph (no migration)
├── contracts/
│   └── api.md           # DELETE /api/account request/response
├── quickstart.md        # Dev setup + manual test steps
└── checklists/
    └── plan-review.md   # Pre-implementation gates
```

### Source Code (repository root) — touched paths
```text
server/
├── index.js                              # mount account router
├── routes/account.js                     # NEW — DELETE /api/account
└── repositories/
    ├── index.js                          # add `account` to bundles
    ├── account.js                        # NEW — local delete(body) → clear all
    ├── supabase/account.js               # NEW — hosted adapter
    └── supabase/adminClient.js           # NEW — service-role client
src/
├── services/api.js                       # deleteAccount() + auth-failure hook
├── data/authStore.js                     # handleAuthFailure()
├── pages/Profile.js                      # Account section + modal
└── components/                           # deletion confirm modal
tests/                                     # see "Tests likely to be added"
```

## Phases

Concrete, dependency-ordered tasks are produced by `/speckit.tasks`. Expected phase shape (Release Prep + Browser Smoke Test as the final two, per constitution Amendments 1.1.0 + 1.3.0):

1. Backend: admin client + hosted account adapter + local `delete(body)` clear + route + dispatcher wiring (+ tests).
2. Client service layer: `deleteAccount` + demo branch + auth-failure hook + `authStore.handleAuthFailure` (+ tests).
3. UI: Account section + confirmation modal + post-action handling + styles (+ component tests).
4. **Release Prep**: version bump, CHANGELOG, README, `docs/deployment.md` (service-role runtime use), `docs/REPO_MAP.md` (new files), docs sanity check.
5. **Browser Smoke Test**: walk each user story's Independent Test against the to-be-merged state (hosted delete, local clear, demo disabled, cross-device reroute), desktop + mobile.

## Complexity Tracking

No constitution violations requiring justification. The one notable addition — first runtime use of the service-role key — is inherent to the feature (account deletion cannot be done with the per-request anon JWT) and is contained to a single lazy-imported server-only factory.
