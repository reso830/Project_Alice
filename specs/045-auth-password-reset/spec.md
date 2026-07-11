# Feature Specification: Hosted Password Management

**Feature Branch**: `045-auth-password-reset`
**Created**: 2026-07-10
**Status**: Draft
**Input**: docs/features/2.0.0-smart-intake-ai-assistance/045-hosted-password-management.md

---

## Clarifications

### Session 2026-07-10

- **Q: FR-1 gates password management on Hosted vs Local Mode; should it also be unavailable in Demo Mode (a third, client-side-only runtime state with no real Supabase account)?** → A: **Yes, hide it in Demo Mode.** Matches the existing Delete Account precedent (`src/pages/Profile.js`'s `renderAccountGroup`/`resolveAccountMode`), which already renders distinct copy for `hosted` / `local` / `demo` and disables the destructive action in `demo` with explanatory text. Change Password follows the same three-way gate and is unavailable (hidden, with equivalent explanatory copy) whenever the session status is `demo`.
- **Q: After a successful password reset via the emailed recovery link (FR-12), should the user land signed into the app (the recovery session is itself a valid authenticated session) or be signed out back to a logged-out Welcome/login screen?** → A: **Sign out, return to login.** The recovery session is explicitly ended after a successful reset; the user re-authenticates with the new password from the standard Welcome/login screen. Matches the design handoff's "Back to sign in" affordance and FR-12's "return to the standard Welcome/Login flow" wording taken literally (a logged-out state, not merely a screen).
- **Q: What happens if a user opens an already-expired/invalid recovery link (before ever touching the Reset Password form)?** → A: **Show a dedicated expired-link state on load.** Detect the invalid/missing recovery session immediately (not only at submit time) and present a "This reset link has expired — request a new one" message with a path back to Forgot Password, rather than silently falling back to the standard Welcome/login screen with no explanation.
- **Q: The design handoff exposes a close button, Escape, backdrop-click, and a "Back to sign in" link on the Reset Password overlay in addition to Submit — none of these are "successful reset." What happens to the active Supabase recovery session (and to `authStore`'s `password-recovery` status) if the user abandons the workflow through any of these instead of submitting?** → A: **Abandoning ends the recovery session the same way completing it does.** Any exit from the Reset Password workflow that is not a successful submit — the close (×) button, Escape, backdrop click, or "Back to sign in" — explicitly signs out of the recovery session (`authStore.signOut()`) before returning to the standard, logged-out Welcome/login screen, exactly like AC-11's success path minus the success notification. This was raised as a gap during plan review (an unresolved abandon path would leave `authStore` reporting `password-recovery` while the UI showed something else, the same class of state/UI mismatch the recovery-detection guard elsewhere in this feature exists to prevent). No exit path leaves a recovery session dangling.

---

## Problem Statement

Hosted users currently rely on administrative intervention to recover forgotten passwords and cannot manage their own credentials from within Alice. This is a deliberate, documented prior decision (feature 018 / Phase 14): `docs/design/welcome_page.md` and `specs/018-auth-user-access/spec.md` both record "no custom in-app reset UI" as an explicit non-goal, with password reset left operator-driven (the operator triggers a reset email from the Supabase dashboard) "while the allowlist-controlled user base stays small." That same design doc flags the natural follow-up: *"A follow-up feature can wire `supabase.auth.resetPasswordForEmail` with a defined redirect URL."* `src/pages/welcome/AuthOverlay.js` carries the same decision in its file-header comment: *"No Forgot-password affordance... password reset stays operator-driven."*

This feature is that follow-up. It **supersedes** the 018 decision: it adds a self-service Forgot Password / Reset Password flow to the Welcome page, and a self-service Change Password flow to Settings, so hosted users no longer depend on operator intervention for either.

This feature applies exclusively to Hosted Mode (and, per the Clarifications above, is also unavailable in Demo Mode) and has no impact on Local Mode deployments, which have no hosted account or Welcome/login screen at all.

---

## Scope

### In Scope

- **Change Password** (Settings, signed-in): entry point in the Settings "Account" area (`src/pages/Profile.js`'s `renderAccountGroup`, alongside the existing "Delete account" control), opening an overlay that collects current password, new password, and confirm-new-password, verifies the current password against the Hosted Authentication provider, and submits the change via the provider.
- **Forgot Password** (Welcome, signed-out): a "Forgot password?" link on the sign-in form (only, per the design handoff — not shown on the create-account form) opening an overlay that collects an email address and requests a recovery email from the Hosted Authentication provider, followed by a non-enumerating confirmation screen.
- **Reset Password** (Welcome, reached via the emailed recovery link): detecting a valid Supabase password-recovery session on load and presenting a dedicated overlay (new password + confirm) instead of the standard login flow; on success, ending the recovery session and returning the user to the standard, logged-out Welcome/login screen.
- **Expired/invalid recovery link handling**: a dedicated inline state shown immediately on load when the recovery link is missing/expired/already used, distinct from the standard Welcome screen.
- **Demo Mode isolation**: Change Password hidden/disabled in Demo Mode, following the existing Delete Account gating pattern (`resolveAccountMode()` returning `hosted` / `local` / `demo`).
- **Local Mode isolation**: no password management UI anywhere in Local Mode (Local Mode never reaches the Welcome page at all — `local-mode` auth status routes straight to the app shell today — so this is inherently satisfied by scoping every new entry point to hosted-only code paths, but is still an explicit acceptance criterion below).
- Reuse of established patterns in this codebase: the `err.code === 'INVALID_PASSWORD'` re-verification contract already wired for Delete Account (`src/components/DeleteAccountModal.js` ↔ `src/services/api.js` ↔ `server/repositories/supabase/account.js`) for Change Password's current-password check; the existing `Toast.show(...)` / `authStore.setAuthNotice()` + `consumeAuthNotice()` one-shot pattern for success notifications that must survive a screen-clearing reroute; the existing 8-character minimum password rule (`PASSWORD_MIN` in `LoginForm.js`/`SignupForm.js`) as the floor for new-password validation, with no new complexity/composition rules introduced.

### Non-Goals

- Email address changes.
- Username changes.
- Multi-factor authentication (MFA).
- Passwordless authentication.
- Account deletion (already shipped, feature 030 — unaffected by this feature).
- Authentication provider migration.
- Password strength meters or composition rules beyond the existing 8-character minimum.
- Any password management functionality in Local Mode.
- Any password management functionality in Demo Mode (Change Password hidden; Forgot Password is inherently unreachable from Demo Mode since it is only ever entered from an already-rendered Welcome screen, and Demo Mode has no real account to reset).
- A password-strength/composition policy change — this feature is UI/workflow only; the provider's own password floor is unchanged.
- Redesigning the sign-in/sign-up modal beyond adding the Forgot Password link and the two new recovery views to its state machine.
- Rate limiting or abuse protection for repeated recovery requests beyond what the Hosted Authentication provider already applies.

---

## User Behavior & Stories

Each story has an **Independent Test** exercised in the final Browser Smoke Test phase.

- **US-1 — Change Password.** As a signed-in Hosted Mode user, I want to change my password from Settings, so that I can maintain the security of my account.
  - **Independent Test**: Signed in on a hosted deploy, open Settings → Account → "Change password". Submit with a correct current password and a new password meeting policy; confirm a success notification, the overlay closes, and signing out and back in with the new password succeeds. Repeat with an incorrect current password; confirm an inline error and the overlay stays open.

- **US-2 — Recover Forgotten Password (request).** As a Hosted Mode user who forgot their password, I want to request a recovery email from the Welcome screen, so that I can regain access without administrator assistance.
  - **Independent Test**: On the Welcome screen's sign-in form, click "Forgot password?", enter a registered email, submit; confirm a generic "if an account exists…" confirmation screen (not confirming or denying the address is registered). Repeat with an unregistered/malformed-but-valid-format email; confirm the same generic confirmation copy is shown either way.

- **US-3 — Recover Forgotten Password (reset via link).** As a Hosted Mode user who requested recovery, I want to set a new password by following the emailed link, so that I can sign back in.
  - **Independent Test**: Open a valid recovery link; confirm the Reset Password overlay (new password + confirm) appears instead of the standard login flow. Submit a valid new password + matching confirmation; confirm a success notification, the recovery session ends, and the user lands on the standard logged-out Welcome/login screen. Confirm signing in with the new password succeeds.

- **US-4 — Expired/invalid recovery link.** As a user who opens a stale or already-used recovery link, I want a clear explanation instead of a confusing form, so that I know to request a new one.
  - **Independent Test**: Open an expired or already-used recovery link; confirm a dedicated "This reset link has expired" state appears immediately on load (not only after a failed submit), with a path back to Forgot Password.

- **US-5 — Local Mode Isolation.** As a Local Mode user, I should never see hosted password management functionality, because Local Mode does not use hosted authentication.
  - **Independent Test**: In a Local Mode build/run, confirm there is no Welcome/login screen, no Forgot Password link, and no Change Password control anywhere in Settings.

- **US-6 — Demo Mode Isolation.** As a Demo Mode visitor, I should not be able to change a password that doesn't correspond to a real account.
  - **Independent Test**: Enter Demo Mode from the Welcome screen; confirm Settings → Account shows no active Change Password control (hidden or disabled with explanatory copy), consistent with the existing Delete Account demo-mode treatment.

---

## Acceptance Criteria

- **AC-1**: Hosted users can initiate Change Password from Settings → Account.
- **AC-2**: Change Password requires current password, new password, and confirmation password; all three are validated before submission (required, current password authenticated by the provider, new password meets the 8-character-minimum policy, new/confirm match).
- **AC-3**: Forgot Password is available from the Welcome screen's sign-in form in Hosted Mode.
- **AC-4**: Submitting a recovery request sends a password recovery request through the Hosted Authentication provider.
- **AC-5**: Recovery request confirmation copy never discloses whether the submitted email address corresponds to a registered account.
- **AC-6**: Opening a valid recovery link automatically presents the Reset Password overlay instead of the standard login flow.
- **AC-7**: Opening an expired/invalid/already-used recovery link presents a dedicated expired-link state on load, not the standard login form and not a generic error only surfaced after submit.
- **AC-8**: Reset Password requires a new password and confirmation password, validated (required, 8-character minimum, match, recovery session still valid).
- **AC-9**: Both Change Password and Reset Password enforce the same 8-character-minimum password policy already used by sign-in/sign-up.
- **AC-10**: Successful Change Password shows a success notification and closes the overlay; the session is preserved or invalidated per the Hosted Authentication provider's own default behavior (no forced sign-out is engineered client-side for Change Password).
- **AC-11**: Successful Reset Password shows a success notification, explicitly ends the recovery session, and returns the user to the standard logged-out Welcome/login screen (not the authenticated app shell).
- **AC-11a**: Abandoning Reset Password without submitting — close button, Escape, backdrop click, or "Back to sign in" — also explicitly ends the recovery session (no success notification) and returns the user to the standard logged-out Welcome/login screen; no exit path leaves `authStore` reporting `password-recovery` after the overlay is gone (Clarifications, 2026-07-10).
- **AC-12**: No password management functionality (Forgot Password link, Change Password control, Reset Password overlay) is reachable in Local Mode.
- **AC-13**: No active Change Password control is reachable in Demo Mode; it is hidden or disabled with explanatory copy, matching the Delete Account precedent.
- **AC-14**: Multiple submissions are prevented while a request is in progress (submit buttons show a loading state and are disabled) across all three workflows.
- **AC-15**: Validation errors are presented inline, gated behind a "touched"/first-submit-attempt flag so errors do not show before the user has tried once (matching `LoginForm.js`'s existing pattern).
- **AC-16**: Focus management, keyboard navigation (including a focus trap and Escape-to-close), and ARIA dialog semantics are present on all three overlays, consistent with `AuthOverlay.js` / `DeleteAccountModal.js`.

---

## Edge Cases

- **Expired/invalid/already-used recovery link on load** → dedicated inline expired-link state shown immediately, not the standard login form, not a silent fallback (Clarifications, 2026-07-10).
- **Recovery session expires between page load and form submit** → FR-11's "recovery session remains valid" check at submit time catches this even when the initial load-time check passed; the same expired-link messaging (or an equivalent inline error) applies.
- **Demo Mode session at Settings** → Change Password control hidden/disabled with explanatory copy; no network call is possible or attempted (mirrors `DEMO_UNAVAILABLE` handling in `deleteAccount()`).
- **Local Mode** → no Welcome page is ever mounted (today's `local-mode` auth status routes directly to the app shell), so Forgot Password is structurally unreachable; Change Password's Settings entry point is gated the same way `renderAccountGroup` gates Delete Account, so it never renders.
- **Incorrect current password on Change Password** → inline error, overlay stays open, no other side effects (mirrors `err.code === 'INVALID_PASSWORD'` handling in `DeleteAccountModal.js`).
- **Recovery request for an unregistered or malformed-but-valid-format email** → identical generic confirmation copy as a registered email; no timing or copy difference reveals account existence.
- **Recovery request for a syntactically invalid email** → inline client-side validation error before any request is sent (does not reach the provider or the confirmation screen).
- **Rapid double-submit on any of the three forms** → submit buttons disable themselves and show a loading label immediately; a second click/Enter before the first request resolves is a no-op.
- **User closes/ESC/backdrop-clicks an in-progress request** → matches existing overlay conventions (`DeleteAccountModal.js` disables Cancel/ESC/backdrop-close while `loading` is true); no partial state changes result.
- **User abandons Reset Password without submitting** (close button, Escape, backdrop click, or "Back to sign in", while idle — not mid-request) → explicitly ends the recovery session (`authStore.signOut()`) and returns to the standard logged-out Welcome/login screen, the same as a successful reset minus the success notification; `authStore` never continues reporting `password-recovery` once the overlay is gone (Clarifications, 2026-07-10).
- **Password/confirm mismatch on Change Password or Reset Password** → inline error on the confirmation field only, shown once the field has been touched or a submit has been attempted.
- **New password below the 8-character minimum** → inline error on the new-password field, same copy/pattern as sign-up ("Use at least 8 characters." per the design handoff; "Password must be at least 8 characters." per `LoginForm.js`/`SignupForm.js` — the two should be reconciled to one string during planning).
- **Network/provider failure during any of the three submissions** → inline error region reflects failure without exposing implementation details (provider error codes, stack traces); form remains usable for retry.
- **Success notification during a screen-clearing reroute** (Reset Password's success → sign-out → Welcome reroute) → uses the existing one-shot `authStore.setAuthNotice()` / `consumeAuthNotice()` mechanism already used for the analogous delete-account reroute, so the notification survives `document.body` being cleared.

---

## Data Considerations

- **No application data is created, read, or mutated** by this feature. The constitution's required fields (company name, job title, status, `lastStatusUpdate`, responsibilities) are untouched.
- **No new persisted data.** Passwords are never logged or persisted by Alice outside the Hosted Authentication provider; the provider (Supabase Auth) remains the sole source of truth for credentials, password validation, and recovery-link/session validity.
- **No new analytics or tracking.** These are client-only auth workflows; no expansion of the existing Vercel Speed Insights / Web Analytics scope (constitution Amendments 1.5.0 / 1.7.0).
- **Existing redaction is unaffected but relevant**: constitution Amendment 1.7.1 already redacts Supabase auth-callback URL artifacts (`#access_token=...`, `?auth=callback`) from anything reported to Vercel Observability — the new recovery-link URL fragment this feature introduces is covered by that same existing redaction, since it is the same class of Supabase auth-callback artifact.
- **Password policy**: reuses the existing, currently-duplicated 8-character minimum (`LoginForm.js`, `SignupForm.js`); this feature does not raise or lower that floor. Consolidating the duplicated constant into a shared module is a planning-level decision, not a scope change.
- **Local-first preserved**: all new functionality is confined to hosted-only code paths (gated on `isHostedAuthAvailable` / `authStore` status); a local/GitHub checkout is unaffected.

---

## Dependencies

- Hosted Authentication provider (Supabase Auth) — specifically `supabase.auth.updateUser({password})` (Change Password, Reset Password) and `supabase.auth.resetPasswordForEmail(email, {redirectTo})` (Forgot Password), neither of which is called anywhere in the codebase today.
- `src/data/authStore.js` — the client-side auth state module; will need a new branch (today discarded) on the `onAuthStateChange` event to recognize a `PASSWORD_RECOVERY` session, distinct from a normal `authenticated` sign-in.
- `src/pages/welcome/AuthOverlay.js` — the sign-in/sign-up modal's view state machine (currently `login | signup | verification_sent`) that Forgot Password and Reset Password extend.
- `src/pages/Profile.js` — the Settings "Account" area that Change Password's entry point extends.
- `src/components/DeleteAccountModal.js` and `server/repositories/supabase/account.js` — precedent for the current-password re-verification contract (`err.code === 'INVALID_PASSWORD'`) that Change Password's FR-4 reuses.
- `src/components/Toast.js` and `authStore.setAuthNotice()`/`consumeAuthNotice()` — existing success-notification mechanisms.
- Design references: `Alice_Change_ForgotPwd.zip` → `design_handoff_password_reset_modal/` (README.md, wr-auth.jsx, password-change-form.jsx, profile-settings.jsx, plus supporting host-page/asset files) — high-fidelity React/JSX prototypes to be recreated (not copied verbatim) as vanilla JS, consistent with how `docs/design/welcome_page.md` was recreated from its own React/JSX prototype lineage.
- **Supersedes**: `specs/018-auth-user-access/spec.md`'s "no custom in-app reset UI" non-goal and `docs/design/welcome_page.md`'s "Forgot? link deferred" decision (Phase 14) — both are explicitly reversed by this feature.

---

## Out of Scope

- Multi-factor authentication.
- Email verification changes (signup email verification is unaffected).
- Change email.
- Delete account (unaffected, already shipped).
- Social login.
- Session management enhancements beyond what FR-5/FR-12 and the Clarifications above specify.
- Authentication provider migration.
- Rate limiting / abuse protection beyond the provider's own defaults.

---

## Notes

This feature is exclusive to Hosted Mode and unavailable in Demo Mode (Clarifications, 2026-07-10). It is inherently unreachable in Local Mode, which has no Welcome page or hosted account.

The Hosted Authentication provider (Supabase Auth) remains the source of truth for authentication, password validation, and recovery-link/session validity. Alice presents a consistent, hand-rolled vanilla-JS user experience (no React in production, despite the React/JSX design handoff) while delegating all credential operations to the provider, and implements no custom password-recovery tokens of its own.

This feature explicitly reverses the "password reset stays operator-driven" decision recorded in feature 018 / `docs/design/welcome_page.md` (see Problem Statement and Dependencies).
