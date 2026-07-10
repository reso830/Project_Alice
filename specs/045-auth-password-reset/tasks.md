# Tasks: Hosted Password Management

**Feature**: `045-auth-password-reset` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small, ordered, and specific. `[P]` marks parallelizable tasks (different files, no shared edits). Status legend: `[x]` done · `[ ]` pending · `[~]` skipped.
Commands: `npm run test:run`, `npm run lint`.

Phase dependency: 01 → 02 → 03 → 04 → 05 → 06 → 07

**Additive rule**: phases are ordered so `npm run test:run` passes after every phase, not just at the end. **Parallel opportunity**: Phase 03 (Forgot Password) has no dependency on Phase 01 at all (no password field involved) and Phase 02 (Change Password) depends only on Phase 01's `validatePassword` (T001), not its recovery-guard work (T002) — both could be staffed in parallel after T001 lands if worked by more than one agent/developer. Phase 04 is the one phase that genuinely needs all of Phase 01 (the recovery-status state machine).

**Constitution validation areas**: this feature does not touch application-record validation (status transitions, required-field enforcement, URL validation, date handling on job applications) — those required areas are N/A here; existing suites covering them must stay green (verified in Release Prep). The validation logic this feature *does* add — password-policy compliance — gets its own explicit test coverage (T001, T003).

**Visual-Fidelity Mode**: Mixed (see [plan.md](plan.md#visual-fidelity-mode)). Tier 1 (automated geometry harness) is **skipped this feature** by proportionality decision — no `npm run test:visual` harness exists yet and standing one up is out of proportion to 3 modals reusing existing overlay chrome. Tier 2 (screenshot-vs-prototype visual judgment) is **not** skipped — every visual task below still requires it, self-served by the implementing agent after an in-session image-view preflight.

**Prerequisite**: none — this feature does not depend on any other in-flight feature branch.

## Phase summary

| Phase | Focus | Tasks | Stories |
|---|---|---|---|
| 01 | Foundational — password policy + recovery-detection state machine | T001–T004 | — |
| 02 | Change Password (Settings) | T005–T010 | US-1 |
| 03 | Forgot Password (Welcome, request) | T011–T015 | US-2 |
| 04 | Reset Password + expired-link state (Welcome, via link) | T016–T022 | US-3, US-4 |
| 05 | Polish & Cross-Cutting — Local/Demo isolation, a11y, copy | T023–T026 | US-5, US-6 |
| 06 | Release Prep | T027–T035 | — |
| 07 | Browser Smoke Test | T036–T042 | US-1–US-6 |

---

## Phase 01: Foundational — Password Policy + Recovery-Detection State Machine

**Purpose**: Groundwork shared across the rest of the feature. No user-visible surface ships yet.

- [ ] T001 [P] Consolidate password-policy validation into `src/utils/validate.js`
  - **Target**: [src/utils/validate.js](../../src/utils/validate.js) (new `validatePassword(value)` + `PASSWORD_MIN = 8` export); [src/pages/welcome/LoginForm.js](../../src/pages/welcome/LoginForm.js), [src/pages/welcome/SignupForm.js](../../src/pages/welcome/SignupForm.js) (remove the duplicated local `PASSWORD_MIN` constant and inline length check, import `validatePassword` instead)
  - **Expected behavior**: One canonical 8-character-minimum rule and one canonical error string, used by both existing forms with no behavior change (same threshold, same UX — this is a pure extraction, not a policy change). Reconcile the two slightly different error strings currently in play ("Password must be at least 8 characters." in `LoginForm.js`/`SignupForm.js`) into a single string that later tasks (T008, T013, T018) also use.
  - **Constraints**: no change to the 8-character threshold itself (spec Non-Goal: no composition/strength-meter rules beyond the existing floor); `src/utils/validate.js`'s existing exports (`validateRequired`, `validateEmail`, `validateUrl`, etc.) are untouched.
  - **Validation/test**: unit tests for `validatePassword` (boundary at exactly 8 chars, empty string, whitespace-only) in `tests/utils/validate.test.js`; existing `tests/pages/welcome/*`/`tests/components/welcome.test.js` assertions covering `LoginForm`/`SignupForm` password validation continue passing unmodified.
  - **Out of scope**: any new composition rule (uppercase/digit/symbol requirements) — explicitly not part of this feature.

- [ ] T002 Recovery-URL detection + guarded auth-event state machine in `authStore`
  - **Target**: [src/data/authStore.js](../../src/data/authStore.js) `init()` and the `onAuthStateChange` callback
  - **Expected behavior**: On `init()`, before any `await`, synchronously check `location.hash`/`location.search` for Supabase's recovery marker (`type=recovery`) and arm a `pendingRecovery` guard if present. Register `supabase.auth.onAuthStateChange(...)` **before** awaiting `getSession()` (today's code does the reverse). While the guard is armed: a bare `SIGNED_IN` event does **not** resolve `authenticated` (it's held, see plan.md Architecture / research.md D1); a `PASSWORD_RECOVERY` event resolves `status: 'password-recovery'` and disarms the guard; if neither arrives within a short timeout (~5–10s), resolve `status: 'recovery-expired'` and disarm the guard. The guard arms at most once per page load. `state`'s type/shape gains the two new status literals; `getAuthState()`/`subscribe()` are unchanged otherwise.
  - **Constraints**: does not change behavior for the no-recovery-URL case (today's `local-mode`/`unauthenticated`/`authenticated`/`demo` paths must be unaffected — `tests/data/authStore.test.js`/`tests/data/authStore.demo.test.js`'s existing assertions must keep passing without modification to their expectations). Guard timeout value is a constant, easy to find/tune (research.md flags the exact duration as something to verify against real timing, not a hard-coded magic number scattered in logic).
  - **Validation/test**: see T003.
  - **Out of scope**: `main.js`'s `render()` branch for the new statuses (Phase 04, T016) — this task only makes the statuses reachable in `authStore`, it does not wire anything downstream yet.

- [ ] T003 [P] `authStore` recovery-guard test suite
  - **Target**: [tests/data/authStore.test.js](../../tests/data/authStore.test.js) (extend)
  - **Expected behavior**: Cover (a) no recovery URL → existing behavior unaffected; (b) recovery URL + `SIGNED_IN` then `PASSWORD_RECOVERY` (in that order) → resolves `password-recovery`, never transiently observable as `authenticated` by a subscriber; (c) recovery URL + neither event arrives → resolves `recovery-expired` after the timeout; (d) recovery URL + `SIGNED_IN` only (no `PASSWORD_RECOVERY` ever) → resolves `recovery-expired` after the timeout, not stuck on `authenticated`.
  - **Constraints**: mock `supabase.auth.onAuthStateChange`/`getSession()` — no real network/Supabase project needed for this suite (T004 covers the one thing this can't verify).
  - **Validation/test**: `npm run test:run tests/data/authStore.test.js`.
  - **Out of scope**: `main.js` integration (Phase 04).

- [ ] T004 Manual verification — real recovery-link event ordering
  - **Target**: a test Supabase project (not a repo file)
  - **Expected behavior**: Trigger a real password-recovery email, click the link against a local `npm run dev` pointed at that project, and confirm the assumed `SIGNED_IN`-before-`PASSWORD_RECOVERY` event ordering (research.md D1) actually holds for the installed `@supabase/supabase-js@^2.45.0`. If it doesn't hold as assumed, revisit T002's guard logic before Phase 04 builds on it.
  - **Constraints**: exploratory/manual — not automatable in this pass; do once, document the observed behavior (a one-line note in research.md is sufficient, not a new artifact).
  - **Validation/test**: N/A (manual). Blocks Phase 04 in spirit (Phase 04's correctness depends on this being right), though Phase 04 can be *coded* against the assumption in parallel and adjusted if T004 finds it wrong.
  - **Out of scope**: building any automated test around a real Supabase project (out of proportion — T003's mocked suite is the durable coverage).

**Checkpoint**: `validatePassword` and the recovery-status state machine exist and are tested. Phases 02–04 can now proceed (02/03 don't need T002; 04 needs T002 and should have T004's finding in hand).

---

## Phase 02: Change Password (Settings)

**Goal**: A signed-in Hosted Mode user can change their password from Settings.
**Independent Test** (spec.md US-1): Signed in on a hosted deploy, open Settings → Account → "Change password". Submit with a correct current password and a compliant new password → success notification, overlay closes, sign-out/sign-in with the new password succeeds. Submit with an incorrect current password → inline error, overlay stays open.

- [ ] T005 `PATCH /api/account/password` route + both repository adapters
  - **Target**: [server/routes/account.js](../../server/routes/account.js) (new `router.patch('/password', ...)`, `requireAuth`-gated, alongside the existing `DELETE /`); [server/repositories/supabase/account.js](../../server/repositories/supabase/account.js) (new `changePassword(body)`); [server/repositories/account.js](../../server/repositories/account.js) (SQLite — new `changePassword()` stub)
  - **Expected behavior**: Per contracts/api.md §1 — hosted: validate both fields present and `newPassword.length >= 8` (else `VALIDATION_ERROR`/400); re-verify `currentPassword` via a fresh anon client's `signInWithPassword` (else `INVALID_PASSWORD`/401, mirroring `deleteAccount`'s step 1 exactly); update via the lazily-imported service-role admin client's `admin.auth.admin.updateUserById(userId, {password: newPassword})`; return `{updated: true}`. Local: unconditionally throw `{code: 'NOT_SUPPORTED', status: 501}`. Route handler maps thrown `{code, status}` to a JSON error body, mirroring the existing `DELETE /` handler's error mapping.
  - **Constraints**: `currentPassword`/`newPassword` are never logged (matches the existing comment on `DELETE /api/account`'s handler). Reuses the already-established lazy-import pattern for the admin client (`server/repositories/supabase/adminClient.js`) — do not eagerly import it at module load.
  - **Validation/test**: see T006.
  - **Out of scope**: any change to the existing `DELETE /` route or `deleteAccount()` — this task adds alongside it, does not touch it.

- [ ] T006 [P] Server test suite for `PATCH /api/account/password`
  - **Target**: [tests/server/account.test.js](../../tests/server/account.test.js) (route wiring + `requireAuth` gating), [tests/server/repositories/supabase/account.test.js](../../tests/server/repositories/supabase/account.test.js) (hosted adapter), [tests/server/repositories/account.test.js](../../tests/server/repositories/account.test.js) (local adapter stub)
  - **Expected behavior**: Cover all four error paths (missing fields, weak new password, wrong current password, local `NOT_SUPPORTED`) plus the success path, matching contracts/api.md §1's table exactly.
  - **Validation/test**: `npm run test:run tests/server/`.
  - **Out of scope**: client-side tests (T010).

- [ ] T007 [P] Client API function — `changePassword`
  - **Target**: [src/services/api.js](../../src/services/api.js) (new `changePassword({currentPassword, newPassword})`, modeled directly on the existing `deleteAccount()`)
  - **Expected behavior**: `PATCH /api/account/password` with the given body; surfaces `err.code`/`err.message` from the response for the modal to branch on (`INVALID_PASSWORD` vs. other).
  - **Constraints**: same demo-mode short-circuit shape as `deleteAccount()` (`isDemo()` → reject with a clear `DEMO_UNAVAILABLE`-style error) is **not** needed here since T009 already prevents the control from rendering in demo mode — but keep the function itself safe to call (no crash) if it somehow is, for defense-in-depth consistency with `deleteAccount()`'s own guard.
  - **Validation/test**: unit test alongside `tests/services/api.test.js`'s existing `deleteAccount` coverage, if that file exists; otherwise colocate with T010.
  - **Out of scope**: server-side logic (T005).

- [ ] T008 `PasswordChangeModal` component *(Visual — Tier 2 only, see plan.md Visual-Fidelity Mode)*
  - **Target**: new [src/components/PasswordChangeModal.js](../../src/components/PasswordChangeModal.js), modeled structurally on [src/components/DeleteAccountModal.js](../../src/components/DeleteAccountModal.js) (backdrop + `role="alertdialog"`/`aria-modal`/`aria-labelledby`, body-scroll lock, full Tab focus trap, ESC/backdrop-close disabled while loading, `INVALID_PASSWORD` → inline error + stay open, other errors → close + caller toasts)
  - **Match**: `Alice_Change_ForgotPwd.zip` → `design_handoff_password_reset_modal/password-change-form.jsx` (whole file — `PasswordChangeModal`/`PcfFields`/`PasswordChangeFormStyles`) and `README.md` §"Flow 2 — Change password (Settings)" + §"Design Tokens" (`.pcf-*` chrome values: max-width 400px, radius 16px, indigo accent `#4F46E5`, input height 44px/radius 9–10px, error `#E5484D`, success icon `#22C55E` on `rgba(34,197,94,.12)`).
  - **Breakpoints/checkpoints**: single fixed-width card (400px max), no distinct mobile layout declared in the handoff — verify no overflow/clip down to 375px viewport width (not a declared breakpoint, just a don't-break floor).
  - **Translation note**: no existing Settings-area modal to reuse for chrome (the only precedent, `DeleteAccountModal.js`, is a differently-shaped confirm/danger dialog, not a form modal) — lift the `.pcf-*` CSS custom properties/values wholesale into `src/styles/main.css` as a new, self-contained style block, and replicate the prototype's DOM shape (header/sigil, three-field form, Cancel/Submit actions, success state) rather than retrofitting `DeleteAccountModal`'s single-input shape.
  - **Provenance**: `.pcf-*` styles — `lifted from prototype CSS` (password-change-form.jsx's inline `<style>` block). Structural/behavioral shell (focus trap, ESC handling, `INVALID_PASSWORD` contract) — `recreated manually`, reason: the prototype has no equivalent server-integration contract to lift; `DeleteAccountModal.js`'s already-shipped, already-reviewed implementation of that contract is the correct source instead.
  - **Constraints**: three fields (current/new/confirm password), each with an independent show/hide eye toggle per the handoff; validation gated behind a `touched`/first-submit flag (no errors before the first submit attempt); submit disabled while loading; success state replaces the form in the same card (green check, "Password updated", Done button that closes the modal — no navigation, matching README §Flow 2's "Done closes the modal (no navigation; user is already logged in)").
  - **Done when**: Tier 2 frozen-state screenshots of the built modal (form state + success state) reviewed side-by-side against the prototype's rendered output, self-served by the implementing agent after an in-session image-view preflight. (Tier 1 skipped this feature.)
  - **Validation/test**: see T010.
  - **Out of scope**: the Settings entry-point wiring (T009).

- [ ] T009 Wire the Change Password entry point into Settings
  - **Target**: [src/pages/Profile.js](../../src/pages/Profile.js) `renderAccountGroup()` (or an adjacent group in the same `SETTINGS` section)
  - **Expected behavior**: A "Change password" control appears in the Account area, gated identically to the existing Delete Account control — reuse `resolveAccountMode()` (`'hosted' | 'local' | 'demo'`): visible/enabled only for `'hosted'`; hidden (or disabled with explanatory copy matching the Delete Account demo-mode treatment) for `'demo'`; absent for `'local'` (Local Mode never reaches Settings' hosted-only controls). Opens `PasswordChangeModal` (T008) on click; on success, `Toast.show('Password updated.', 'success')` (or equivalent) and closes.
  - **Constraints**: does not restructure the existing `ACCOUNT` group's Delete Account control — additive only.
  - **Validation/test**: see T010.
  - **Out of scope**: `PasswordChangeModal`'s internals (T008).

- [ ] T010 [P] `PasswordChangeModal` + Settings-gating test suite
  - **Target**: new [tests/components/PasswordChangeModal.test.js](../../tests/components/PasswordChangeModal.test.js) (modeled on `tests/components/DeleteAccountModal.test.js`); [tests/pages/Profile.account.test.js](../../tests/pages/Profile.account.test.js) (extend for the new entry point's three-way mode gating)
  - **Expected behavior**: Modal-level: field validation (required, 8-char min via `validatePassword`, confirm-match), `INVALID_PASSWORD` keeps the modal open with an inline error, other errors close it, success shows the Done state. Profile-level: control renders for `hosted`, hidden/disabled for `demo`, absent for `local`.
  - **Validation/test**: `npm run test:run tests/components/PasswordChangeModal.test.js tests/pages/Profile.account.test.js`.

**Checkpoint**: US-1 is independently functional and testable. `npm run test:run` passes.

---

## Phase 03: Forgot Password (Welcome, request)

**Goal**: A signed-out Hosted Mode user can request a recovery email from the Welcome sign-in form.
**Independent Test** (spec.md US-2): "Forgot password?" → enter a registered email → generic "if an account exists…" confirmation. Repeat with an unregistered-but-valid-format email → identical confirmation copy.

- [ ] T011 `AuthOverlay`/`WelcomePage` view-union extension for `forgot`/`forgot_sent`
  - **Target**: [src/pages/welcome/AuthOverlay.js](../../src/pages/welcome/AuthOverlay.js) (`VALID_VIEWS` gains `'forgot'`, `'forgot_sent'`; `paint()` gains render branches for both, following the exact precedent `verification_sent` already sets — reached via a form's `onSuccess`, not a click, chrome/footer hidden the same way); [src/pages/welcome/WelcomePage.js](../../src/pages/welcome/WelcomePage.js) (`VALID_AUTH_VIEWS` extended to match)
  - **Expected behavior**: `forgot` renders `ForgotPasswordForm` (T013) in the existing `form-slot`; `forgot_sent` renders inline confirmation content (no form), matching how `verification_sent` already renders inline content directly in `paint()` rather than mounting a separate component.
  - **Constraints**: no change to `login`/`signup`/`verification_sent`'s existing behavior.
  - **Validation/test**: see T015.
  - **Out of scope**: `reset-password`/`recovery-expired` (Phase 04).

- [ ] T012 "Forgot password?" link on the sign-in form
  - **Target**: [src/pages/welcome/LoginForm.js](../../src/pages/welcome/LoginForm.js)
  - **Expected behavior**: A "Forgot password?" link/button appears below the password field, **login view only** (per README §"Screens/Views" — not shown on the signup form). Clicking it calls the overlay's `onSwitch('forgot')` (the same mechanism `AuthOverlay`'s footer swap-link already uses), not a page navigation.
  - **Constraints**: does not alter `LoginForm`'s existing validation/submit behavior.
  - **Validation/test**: see T015.

- [ ] T013 `ForgotPasswordForm` component *(Visual — Tier 2 only)*
  - **Target**: new [src/pages/welcome/ForgotPasswordForm.js](../../src/pages/welcome/ForgotPasswordForm.js), mounted-into-slot pattern matching [src/pages/welcome/LoginForm.js](../../src/pages/welcome/LoginForm.js)/[SignupForm.js](../../src/pages/welcome/SignupForm.js) (`mountForgotPasswordForm(container, {onSuccess})` returning an unmount fn)
  - **Match**: `design_handoff_password_reset_modal/wr-auth.jsx` — `ForgotPasswordModal`'s **form phase only** (lines defining the email field + submit button + "Back to sign in" link; the "sent" phase is T011's `forgot_sent` view, not part of this component) — and `README.md` §"Step 1a — Email entry".
  - **Breakpoints/checkpoints**: inherits `AuthOverlay`'s existing responsive behavior (this form mounts into the same `form-slot` `LoginForm`/`SignupForm` already use) — verify at the same widths `AuthOverlay` is already exercised at; no new breakpoint logic.
  - **Translation note**: this form reuses the **live** `AuthOverlay`/`.auth-overlay__*` chrome (header/sigil/close button/footer are `AuthOverlay`'s, not reproduced here) — per plan.md's Visual-Fidelity Mode translation note, the prototype's own `.scrim`/`.modal`/`.m-head` classes are its stand-in for chrome this codebase already has for real; only the **field-level** markup (email input, submit button, "Back to sign in" link) is new, styled with the existing `.auth-overlay__*`/`auth-form__*` token classes `LoginForm.js` already establishes, not a new class namespace.
  - **Provenance**: field layout/copy — `lifted from prototype CSS`/copy (email field styling matches `LoginForm.js`'s existing `.auth-form__field` pattern, which itself already matches the prototype's field styling — no new tokens needed). Copy strings ("Forgot your password?", "We'll email you a link to reset it.", "Send reset link" / "Sending…") — `lifted from prototype` (README §Step 1a) verbatim.
  - **Constraints**: one field (email), reusing `LoginForm.js`'s existing email-format regex/validation pattern (not a new one); submit calls `supabase.auth.resetPasswordForEmail(email, {redirectTo: emailRedirectUrl})` **for every syntactically-valid-format email**, regardless of whether Supabase reports the account exists (FR-8/AC-5 — contracts/api.md F1); `onSuccess` fires regardless of Supabase's actual result (non-enumeration — the UI must not branch on success vs. "user not found"); "Back to sign in" calls `onSwitch('login')`.
  - **Done when**: Tier 2 screenshot of the form state reviewed against the prototype, self-served.
  - **Validation/test**: see T015.
  - **Out of scope**: the `forgot_sent` confirmation view (T011); the redirect-URL env var question (research.md D4 — inspect during this task, escalate if `VITE_AUTH_EMAIL_REDIRECT_URL` turns out unsuitable rather than guessing).

- [ ] T014 Wire the non-enumerating `forgot_sent` confirmation
  - **Target**: [src/pages/welcome/AuthOverlay.js](../../src/pages/welcome/AuthOverlay.js) (`forgot_sent` render branch, part of T011 — split out here only if T011's branch needs the submitted email address threaded through for the confirmation copy)
  - **Expected behavior**: Confirmation copy: *"If an account exists for **{email}**, we've sent a password reset link. Click it to choose a new password."* (README §Step 1b, verbatim) — identical regardless of whether the email was actually registered. "Back to sign in" returns to `login`.
  - **Constraints**: no "open the link" demo/stand-in affordance (the design handoff's "Open reset link (demo)" button is explicitly a prototype-only stand-in per its own code comment — production reaches Reset Password only via a real emailed link, Phase 04).
  - **Validation/test**: see T015.

- [ ] T015 [P] Forgot Password test suite
  - **Target**: new [tests/pages/welcome/ForgotPasswordForm.test.js](../../tests/pages/welcome/ForgotPasswordForm.test.js); extend [tests/components/welcome.test.js](../../tests/components/welcome.test.js) or the equivalent `AuthOverlay`/`WelcomePage` test file for the `forgot`/`forgot_sent` view transitions and `LoginForm`'s new link
  - **Expected behavior**: malformed email → inline error, `resetPasswordForEmail` never called; valid-format email (mock both a "success" and an "error" provider response) → `resetPasswordForEmail` called both times, identical `forgot_sent` copy both times; "Forgot password?" link absent on the signup view.
  - **Validation/test**: `npm run test:run tests/pages/welcome/ tests/components/welcome.test.js`.

**Checkpoint**: US-2 is independently functional and testable. `npm run test:run` passes.

---

## Phase 04: Reset Password + Expired-Link State (Welcome, via recovery link)

**Goal**: A user who opens a valid recovery link sets a new password and lands back on a logged-out Welcome/login screen; a user who opens an expired/invalid link sees a clear explanation instead of a confusing form.
**Independent Test** (spec.md US-3/US-4): open a valid recovery link → Reset Password overlay (not login) → submit → success → recovery session ends → standard logged-out Welcome. Open an expired/already-used link → dedicated expired-link state on load.
**Depends on**: Phase 01 (T002's recovery-status state machine) — do not start before T002/T004 land.

- [ ] T016 `main.js`/`WelcomePage` initial-view threading for the recovery statuses
  - **Target**: [src/main.js](../../src/main.js) `render()` (new branch: `state.status === 'password-recovery' | 'recovery-expired'` → `mountWelcome({initialAuthView: state.status === 'password-recovery' ? 'reset-password' : 'recovery-expired'})`); `mountWelcome()` (gains an optional parameter, threaded into `WelcomePage.mount()`); [src/pages/welcome/WelcomePage.js](../../src/pages/welcome/WelcomePage.js) `mount()` (accepts and threads an initial view into `_deps.openAuthOverlay`/the overlay render call, instead of always starting `null`)
  - **Expected behavior**: On boot with a recovery-shaped session, the Welcome shell mounts (same starfield/hero/footer as always) with the overlay **already open** in the `reset-password` or `recovery-expired` view — no click required, and the standard login form is never shown first.
  - **Constraints**: `mountWelcome()`'s existing no-argument call sites (`unauthenticated` routing) are unaffected — the new parameter is optional and defaults to the current `null`/login behavior. Respect `mountWelcome()`'s existing `if (_welcomeMounted) return;` idempotency guard — the recovery statuses are only reachable at initial boot (per data-model.md §1's invariant), so this should not collide with an already-mounted Welcome in practice; verify this holds rather than assuming.
  - **Validation/test**: see T022.
  - **Out of scope**: any change to `mountAppShell()`/`mountConfigError()` or their branch conditions.

- [ ] T017 `AuthOverlay`/`WelcomePage` view-union extension for `reset-password`/`recovery-expired`
  - **Target**: [src/pages/welcome/AuthOverlay.js](../../src/pages/welcome/AuthOverlay.js) (`VALID_VIEWS` gains both; render branches added); [src/pages/welcome/WelcomePage.js](../../src/pages/welcome/WelcomePage.js) (`VALID_AUTH_VIEWS` extended to match)
  - **Expected behavior**: `reset-password` renders `ResetPasswordForm` (T018); `recovery-expired` renders inline expired-link content (T019) — both reachable **only** via T016's initial-view threading (never via a click, unlike every other view), and `recovery-expired` additionally reachable if `ResetPasswordForm`'s submit fails citing an invalid/expired session (T020).
  - **Constraints**: neither view exposes a mode-swap link to `signup` (a recovery flow has nothing to do with creating a new account) — only a path back to `login`/`forgot` as applicable. The `reset-password` view's close (×), Escape, and backdrop-click handling **cannot fall through to `AuthOverlay`'s generic `close()`/`setAuthView(null)` unmodified** the way every other view does — abandoning an active recovery session must also end it (T021 owns the actual `signOut()` wiring; this task's job is to make sure `reset-password`'s close path is distinguishable from the generic one, not to bypass it by omission).
  - **Validation/test**: see T022.

- [ ] T018 `ResetPasswordForm` component *(Visual — Tier 2 only)*
  - **Target**: new [src/pages/welcome/ResetPasswordForm.js](../../src/pages/welcome/ResetPasswordForm.js), mounted-into-slot pattern matching `LoginForm.js`
  - **Match**: `design_handoff_password_reset_modal/wr-auth.jsx` — `NewPasswordModal`'s **form phase** (new-password + confirm-new-password fields, submit button, "Back to sign in" link — the "done" success phase is handled by T020's success path via `setAuthNotice`/Toast after reroute, not rendered in-place here per the spec Clarification that a successful reset signs the user out rather than showing an in-overlay success card) — and `README.md` §"Step 2 — Set a new password".
  - **Breakpoints/checkpoints**: inherits `AuthOverlay`'s existing responsive behavior, same as T013.
  - **Translation note**: reuses the live `AuthOverlay` chrome, same as T013 — only the two-field form body is new, using the existing `.auth-form__field`/eye-toggle pattern `LoginForm.js` already establishes (each field with its own independent show/hide toggle per the handoff).
  - **Provenance**: field layout — `lifted from prototype CSS` (matches `LoginForm.js`'s existing field pattern, which already reflects the prototype's field styling). Copy ("Set a new password", "Choose a new password for your account.", "Update password" / "Updating…", validation messages) — `lifted from prototype` (README §Step 2) verbatim, reconciled against T001's canonical `validatePassword` error string where the two differ (research.md's noted copy-reconciliation item).
  - **Constraints**: two fields only (new password, confirm — no current-password field, since the whole point of a recovery flow is the user doesn't have one to prove); validation gated behind `touched`/first-submit; reuses `validatePassword` (T001) for the length check.
  - **Done when**: Tier 2 screenshot of the form state reviewed against the prototype, self-served.
  - **Validation/test**: see T022.
  - **Out of scope**: the submit success/failure flow (T020); the abandon-path sign-out behind the "Back to sign in" link (T021 — this task renders the link and fires `onSwitch`/`onClose`, T021 wires what those calls actually do for this specific view); the `recovery-expired` view (T019).

- [ ] T019 `recovery-expired` view content *(Visual — Tier 2 only, small)*
  - **Target**: [src/pages/welcome/AuthOverlay.js](../../src/pages/welcome/AuthOverlay.js) (`recovery-expired` render branch, part of T017 — split out here for the visual-fidelity task pattern since it has no prototype screen of its own to match)
  - **Match**: **no direct prototype screen** — the design handoff does not model an expired-link state (it only ever "clicks the reset link" successfully in its demo stand-in). This task's copy/layout is derived from the existing inline-message pattern `AuthOverlay`'s `verification_sent` view already establishes (icon/title/message/action layout), not a new visual language.
  - **Breakpoints/checkpoints**: inherits `AuthOverlay`'s existing responsive behavior, same as `verification_sent`.
  - **Translation note**: N/A (no cross-stack source to translate — this is new content within existing chrome).
  - **Provenance**: `recreated manually` — reason: no prototype coverage exists for this state (spec Clarification, 2026-07-10, resolved this gap independent of the design handoff).
  - **Constraints**: message: "This reset link has expired — request a new one." (or equivalent, matching the spec Clarification's wording); one action back to `forgot` (not `login` directly, so the user isn't dead-ended without a way to request a fresh link).
  - **Done when**: Tier 2 screenshot reviewed for basic visual consistency with the rest of `AuthOverlay`'s inline-message views (no prototype to compare against, so this is an internal-consistency check, not a prototype-match check).
  - **Validation/test**: see T022.

- [ ] T020 Wire `updateUser` success (explicit sign-out) and failure (→ expired) paths
  - **Target**: [src/pages/welcome/ResetPasswordForm.js](../../src/pages/welcome/ResetPasswordForm.js) (submit handler); [src/data/authStore.js](../../src/data/authStore.js) (reuse existing `signOut()`/`setAuthNotice()`, no new exports needed)
  - **Expected behavior**: Submit calls `supabase.auth.updateUser({password: newPassword})`. On success: `authStore.setAuthNotice('Password updated. Sign in with your new password.', 'success')` → `authStore.signOut()` (per spec Clarification 2026-07-10 — explicit, not passive) → the resulting `unauthenticated` state routes to standard Welcome/login via the existing `render()` path, and `mountWelcome()`'s existing `consumeAuthNotice()`/Toast mechanism (already used for the delete-account reroute) surfaces the notice post-reroute. On failure citing an invalid/expired session (FR-11's runtime re-check — the recovery session lapsed between load and submit): `setView('recovery-expired')` (T017/T019's view) rather than a generic inline error. On any other failure (network, etc.): inline error, form stays usable for retry (FR-13 — no provider internals exposed).
  - **Constraints**: does not skip `setAuthNotice()` — a bare `Toast.show()` called before `signOut()`'s reroute would be lost when `document.body` clears, per the same reasoning `mountWelcome()`'s comment already documents for the delete-account case.
  - **Validation/test**: see T022.

- [ ] T021 Wire explicit sign-out on the Reset Password **abandon** path (close / Escape / backdrop / "Back to sign in")
  - **Target**: [src/pages/welcome/AuthOverlay.js](../../src/pages/welcome/AuthOverlay.js) (the × close button, `onKeydown`'s Escape handling, and the backdrop click handler — all currently generic across every view); [src/pages/welcome/ResetPasswordForm.js](../../src/pages/welcome/ResetPasswordForm.js) ("Back to sign in" link's click handler)
  - **Expected behavior**: Per spec Clarification (2026-07-10) / research.md D5 / contracts/api.md R7 — while `AuthOverlay`'s current view is `reset-password` **and no submit is in flight**, closing via the × button, Escape, a backdrop click, or the form's "Back to sign in" link calls `authStore.signOut()` (no `setAuthNotice()` — nothing succeeded, so no notification) before the overlay's normal close/reroute behavior proceeds. Every other view's close behavior is completely unchanged — this is additive, scoped to `reset-password` only, not a change to `close()`'s general contract.
  - **Constraints**: while a submit is in flight (`loading` state, T020), close/Escape/backdrop are already disabled per the existing `DeleteAccountModal.js`-style convention (spec Edge Case: "User closes/ESC/backdrop-clicks an in-progress request") — this task's sign-out path only fires when idle, never racing T020's own `signOut()` call on a concurrent submit. Do not duplicate `signOut()` calls if the user completes a submit and the overlay's teardown also runs some shared close routine — trace the actual call path before wiring both, rather than assuming they're independent.
  - **Validation/test**: see T022.
  - **Out of scope**: `recovery-expired`'s close behavior (that view never held a confirmed recovery session — see data-model.md §1 — so it has nothing to sign out of; its close is the ordinary generic path, matching `verification_sent`).

- [ ] T022 [P] Reset Password + expired-link test suite
  - **Target**: new [tests/pages/welcome/ResetPasswordForm.test.js](../../tests/pages/welcome/ResetPasswordForm.test.js); extend [tests/main.test.js](../../tests/main.test.js) (or equivalent) for T016's `render()` branch; extend `tests/components/welcome.test.js`/`AuthOverlay` tests for T017/T019's new views
  - **Expected behavior**: `password-recovery` status → Welcome mounts with `reset-password` open (not login); `recovery-expired` status → Welcome mounts with the expired-link view open; successful `updateUser` → `signOut()` called, notice staged, reroute occurs; `updateUser` failing with an invalid-session error → transitions to `recovery-expired` in place (no reroute); mismatch/below-policy new password → inline error, no `updateUser` call. **Abandon-path coverage (T021)**: closing via ×, Escape, and backdrop click while idle on `reset-password` → `signOut()` called, no notice staged, reroute to standard Welcome/login; same for the "Back to sign in" link; closing while a submit is in flight → close is a no-op (matches the existing loading-disables-close convention) and does **not** additionally call `signOut()`; closing `recovery-expired` (contrast case) → ordinary close, no `signOut()` call (nothing to end).
  - **Validation/test**: `npm run test:run tests/pages/welcome/ tests/main.test.js`.

**Checkpoint**: US-3 and US-4 are independently functional and testable. `npm run test:run` passes.

---

## Phase 05: Polish & Cross-Cutting

**Purpose**: Close out the two isolation acceptance criteria that aren't tied to a single build phase, plus a consistency pass across all three new surfaces.

- [ ] T023 [P] Local Mode isolation verification
  - **Target**: new or extended test asserting `authStore` status `'local-mode'` never reaches `mountWelcome()` (structural — already true today per `render()`'s existing branch table; this task adds explicit test coverage for the *new* surfaces specifically, not just the pre-existing shell behavior) — likely `tests/main.test.js`
  - **Expected behavior**: confirms no code path in this feature accidentally makes Forgot Password / Change Password reachable in Local Mode (e.g., a future edit to `resolveAccountMode()` or `render()` regressing this would be caught here).
  - **Validation/test**: `npm run test:run tests/main.test.js`.

- [ ] T024 [P] Demo Mode isolation — consolidated check
  - **Target**: [tests/pages/Profile.account.test.js](../../tests/pages/Profile.account.test.js) (verify T010 already covers this; add the explicit demo-specific assertion if it doesn't)
  - **Expected behavior**: confirms Change Password's control is hidden/disabled with explanatory copy in `demo` mode, matching the Delete Account precedent exactly (same copy pattern, not just "absent").
  - **Validation/test**: `npm run test:run tests/pages/Profile.account.test.js`.

- [ ] T025 Accessibility pass across the three new overlays
  - **Target**: [src/components/PasswordChangeModal.js](../../src/components/PasswordChangeModal.js), [src/pages/welcome/ForgotPasswordForm.js](../../src/pages/welcome/ForgotPasswordForm.js), [src/pages/welcome/ResetPasswordForm.js](../../src/pages/welcome/ResetPasswordForm.js)
  - **Expected behavior**: verify (not re-implement — these inherit focus trap/ESC/ARIA from `AuthOverlay`/`DeleteAccountModal`'s existing patterns) that each overlay has a working focus trap, ESC-to-close (except mid-submit, matching `DeleteAccountModal`'s loading-state guard), `role="dialog"`/`aria-modal`/labelled-by, and that error/status regions carry `aria-live`. Confirm no gap was introduced by the new field-level markup (e.g., a missing `aria-label` on a new eye-toggle button).
  - **Validation/test**: manual keyboard-only walkthrough of all three overlays; no new automated test expected beyond what T010/T015/T022 already assert for ARIA attributes.

- [ ] T026 `npm run lint` clean
  - **Target**: all files touched by Phases 01–04
  - **Validation/test**: `npm run lint` exits clean.

**Checkpoint**: All six user stories are independently functional and testable; cross-cutting isolation is explicitly verified, not just implied. `npm run test:run` and `npm run lint` both pass.

---

## Phase 06: Release Prep

**Purpose**: Land documentation, version metadata, and operator-facing references in the same state the operator will merge. Runs before the Browser Smoke Test so the smoke test walks the to-be-merged state.

- [ ] T027 Version bump — `package.json` (SemVer minor: new user-facing feature, no breaking change) and any in-app version display (`src/pages/welcome/shared/appMeta.js`'s `APP_VERSION` or equivalent); update matching version-string test assertions if they pin the literal.
- [ ] T028 Sync `package-lock.json` root fields (`version` + `packages[""].version`) to match — leave dependency versions untouched.
- [ ] T029 `docs/feature_roadmap.md` — tick `045-auth-password-reset` `[x]`, note the shipped version.
- [ ] T030 `CHANGELOG.md` — new `## [<new-version>] — <merge-date>` section (Keep-a-Changelog format, **Added**/**Changed** as applicable: Change Password, Forgot Password, Reset Password); update the `[Unreleased]`/`[<new-version>]` diff links at the bottom.
- [ ] T031 `README.md` — add Features bullet(s) for the three new user-facing surfaces; update the `Current version` line. No per-feature `specs/045-…/` link under Further Reading (indexed via `docs/REPO_MAP.md` instead, per existing convention).
- [ ] T032 `docs/deployment.md` — **only if** T013/research.md D4 concluded a second env var was needed for `resetPasswordForEmail`'s `redirectTo`; otherwise skip (existing `VITE_AUTH_EMAIL_REDIRECT_URL` reused, no runtime/env change).
- [ ] T033 `docs/REPO_MAP.md` — add entries for the three new files (`PasswordChangeModal.js`, `ForgotPasswordForm.js`, `ResetPasswordForm.js`) and the new `PATCH /api/account/password` route; add a Spec Packages row for `specs/045-auth-password-reset/`.
- [ ] T034 Docs sanity check — grep the previous version string across `package.json`, `package-lock.json` (root fields only), `src/`, `README.md`, `CHANGELOG.md`, `docs/`; confirm only historical matches remain; confirm every new cross-link path exists; confirm the running app renders the new version.
- [ ] T035 Full suite — `npm run test:run` and `npm run lint` clean at the Release Prep commit.

---

## Phase 07: Browser Smoke Test

**Purpose**: Verify the feature end-to-end in a real browser against a running hosted-mode deployment (or `npm run dev` pointed at a real Supabase test project — see quickstart.md Prerequisites). Required for any feature with user-facing UI.

**Setup**: hosted or hosted-equivalent local run with a real Supabase test project; a test account to sign in with; access to trigger/receive a real recovery email (or the Supabase dashboard's email log).

- [ ] T036 [US-1] Change Password — complete spec.md's Independent Test in browser (correct current password → success; wrong current password → inline error, overlay stays open); verify sign-out/sign-in with the new password.
- [ ] T037 [US-2] Forgot Password request — complete the Independent Test; verify identical confirmation copy for a registered and an unregistered email.
- [ ] T038 [US-3] Reset Password via a real link — complete the Independent Test; verify the recovery session ends and the user lands on a logged-out Welcome/login, then successfully signs in with the new password. Also verify AC-11a: open a second real recovery link and, without submitting, close it via the × button — confirm the same "ends up on a logged-out Welcome/login" outcome (no success toast this time), and that returning to the app afterward does not silently land back in the Reset Password overlay.
- [ ] T039 [US-4] Expired/invalid recovery link — open an already-used or manually-invalidated link; confirm the dedicated expired-link state appears immediately, with a working path back to Forgot Password.
- [ ] T040 [US-5] Local Mode isolation — in a Local Mode run, confirm no Welcome page, no Forgot Password link, no Change Password control anywhere.
- [ ] T041 [US-6] Demo Mode isolation — enter Demo Mode; confirm no active Change Password control in Settings.
- [ ] T042 Mobile layout — DevTools ≤ 640px for all three new overlays (`PasswordChangeModal`, `ForgotPasswordForm`, `ResetPasswordForm`, and the `recovery-expired` view); confirm no clipping/overflow and all interactions work with touch/click.

**Note**: each task is complete only when a human (or a vision-capable agent, per plan.md's Tier 2 judge) has walked through the steps against the to-be-merged state and all pass criteria are met. Since Tier 1 was skipped for this feature (plan.md Visual-Fidelity Mode), this smoke test is the first end-to-end look at the built overlays against real browser rendering — expect it to possibly surface layout issues Tier 2's static screenshots didn't catch, and treat that as normal for this feature's scoped-down fidelity gate, not a process failure.
