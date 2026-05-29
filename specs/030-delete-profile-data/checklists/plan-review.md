# Plan Review Checklist: Delete Profile & User Data (030)

**Branch**: `030-delete-profile-data` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Pre-implementation quality gates. Check before `/speckit.tasks` and re-confirm before merge.

---

## Spec ↔ plan coverage

- [ ] Every functional requirement (FR-001…FR-024, incl. FR-005a, FR-007a, FR-011a, FR-011b) maps to an architecture element or test in the plan.
- [ ] All clarifications (Session 2026-05-28) and derived decisions D1–D4 are reflected; none contradicted.
- [ ] All five user stories have an Independent Test reachable by the planned surfaces.
- [ ] Success criteria SC-001…SC-008 each have a validation path (test or smoke step).

## Architecture / correctness

- [ ] Hosted delete uses `auth.admin.deleteUser(userId)` (service role) and relies on existing cascade FKs — no manual per-table deletes (R-1).
- [ ] Password is re-verified **server-side** via `signInWithPassword({ email: req.user.email, password })` before any admin call; failure deletes nothing (R-2, FR-004/FR-005).
- [ ] `INVALID_PASSWORD` is a distinct error code, separable from an expired-session `UNAUTHORIZED` (FR-005, contracts/api.md).
- [ ] The `account` router does **not** mount `seedHostedUserIfNeeded` (R-3).
- [ ] Local `delete(body)` requires `body.confirm === 'DELETE'` (else 400) and runs the clear in a single SQLite transaction over `applications` + `profile` (R-6, all-or-nothing, gate-before-transaction).
- [ ] Route handler is runtime-agnostic; runtime branching lives in the `account` repository adapters.
- [ ] A user can only delete their own account — target is always `req.user.id`, no `:id` param (FR-006).

## Security / privacy

- [ ] Service-role admin client is server-only, lazy-imported on the delete path, never in the Vite bundle or any response (FR-007, SC-008).
- [ ] Password is never logged (FR-007a).
- [ ] Verification client uses `persistSession: false` / `autoRefreshToken: false`.
- [ ] No analytics/tracking added (FR-022).
- [ ] Deletion-event logging (if any) records no user-identifying data — no email, user id, or password (FR-022).

## Cross-device / session handling

- [ ] `api.js` invokes `authStore.handleAuthFailure()` on `UNAUTHORIZED` / `INVALID_PASSWORD` / 404 / 500 of authenticated requests, excluding 400 (FR-011a).
- [ ] `handleAuthFailure()` calls `getUser()` and signs out **only** when the account is gone (no spurious sign-out on transient errors).
- [ ] The delete modal handles `INVALID_PASSWORD` as a form error, not a dead-session reroute.
- [ ] Idle-device limitation (token-lifetime window) is documented, not silently assumed away (FR-011b).

## Demo / mode parity

- [ ] `api.deleteAccount` has a demo branch with no `fetch` (020 invariant; `api.demo.test.js`).
- [ ] Account control renders per mode: hosted enabled / local "Clear all data" / demo disabled (FR-002, FR-014, FR-018).

## UX / accessibility

- [ ] Warning copy is serious, clear, non-alarming; states permanence + irrecoverability (FR-003).
- [ ] Modal is keyboard-operable, focus-trapped, cancelable via button/Esc/backdrop; cancel deletes nothing (FR-005a, FR-021).
- [ ] Destructive action is not signaled by color alone (FR-021).
- [ ] In-flight (loading), error, and post-action (redirect/empty) states are all handled (FR-020).
- [ ] Works on desktop + mobile viewports.

## Tests

- [ ] Endpoint: auth required (hosted), own-account scope, success, `INVALID_PASSWORD`, local clear, no-seed-middleware assertion.
- [ ] Adapters: hosted verify+delete branches; local `delete({ confirm: 'DELETE' })` empties both tables, and missing/wrong `confirm` clears nothing (400).
- [ ] Service layer: `deleteAccount` shape, demo no-fetch, auth-failure hook trigger conditions.
- [ ] authStore: `handleAuthFailure` sign-out vs no-op.
- [ ] Profile page: section per mode + modal gate + post-action.

## Constitution (final phases)

- [ ] Release Prep planned: version bump, CHANGELOG, README, `docs/deployment.md` (service-role runtime use), `docs/REPO_MAP.md` (new files), docs sanity check.
- [ ] Browser Smoke Test planned as the final phase, after Release Prep, exercising the merge state on desktop + mobile.
- [ ] Lint/format gates identified (`npm run lint`, `npm run format`).
