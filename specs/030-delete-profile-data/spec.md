# Feature Specification: Delete Profile & User Data

**Feature Branch**: `030-delete-profile-data`
**Created**: 2026-05-28
**Status**: Draft
**Input**: [`docs/features/1.0.0-operational-core/030-delete-profile-data.md`](../../docs/features/1.0.0-operational-core/030-delete-profile-data.md) (feature brief; no design document exists for this feature)
**Depends on**: [`007-profile-page`](../007-profile-page/spec.md) (Profile page sections — the new control is a Profile section), [`017-hosted-foundation`](../017-hosted-foundation/spec.md) (runtime modes, lazy-import discipline), [`018-auth-user-access`](../018-auth-user-access/spec.md) (Supabase email+password auth, JWT `requireAuth`, client `signOut`), [`019-supabase-persistence`](../019-supabase-persistence/spec.md) (hosted schema, RLS, `ON DELETE CASCADE` foreign keys to `auth.users`, service-role key), [`020-portfolio-demo-mode`](../020-portfolio-demo-mode/spec.md) (demo runtime is auth-less and ephemeral)

---

## Clarifications

### Session 2026-05-28

- Q: What should deletion remove on the backend (hosted)? → A: **Full account + cascade.** The server uses the service-role key to call Supabase Admin `deleteUser(userId)`. The existing `ON DELETE CASCADE` foreign keys on `applications`, `profile`, and `user_seed_state` (per [019 data-model §5](../019-supabase-persistence/data-model.md)) remove all of the user's rows automatically. This is the **first runtime use** of `SUPABASE_SERVICE_ROLE_KEY` (019 used it only as a boot/operator concern). Resolves FR-006…FR-009.
- Q: How must the user confirm before deletion fires? → A: **Password re-confirmation** (hosted). The confirmation modal requires the user to re-enter their account password, re-verified before the destructive request fires. Auth is email+password only ([`src/pages/welcome/LoginForm.js`](../../src/pages/welcome/LoginForm.js)), so every hosted account has a password. Resolves FR-004 / FR-005.
- Q: What should the control do in local mode and demo mode? → A: **Demo: visible but disabled**, so demo visitors discover the feature exists; it performs no operation. **Local: "Clear all data"** — wipes the local SQLite `applications` + `profile` data (local mode is single-user with no account to delete). Resolves FR-014…FR-018.
- Q: Where does the control live and what is the section called? → A: A new **"Account"** section on the Profile page, after the existing Profile section. No new route. Resolves FR-001 / FR-002.
- Q: Where is the password re-confirmation verified — client only, server, or both? → A: **Server-side re-verification.** The client sends the password to the authenticated delete endpoint over HTTPS; the server re-verifies it against the user's credentials and only then performs the admin delete. A valid JWT alone is insufficient to delete the account — the password is an authoritative gate, not UX friction. Resolves FR-004 / FR-005 / FR-007a.
- Q: For multi-session invalidation (US5), best-effort revocation, build a proactive client reroute, or drop US5? → A: **Build proactive reroute.** This feature adds client-side handling so that any session whose authenticated request fails due to the account no longer existing clears its local session and routes to the Welcome page. US5 is promoted from best-effort to a built requirement. Resolves FR-011a.
- Q: What confirmation gate does local-mode "Clear all data" use? → A: **Typed `DELETE`.** The user must type `DELETE` to enable the destructive button (no plain one-click confirm). Ratifies derived decision D1. Resolves FR-005.
- Q: How should cross-device reroute (FR-011a) behave given access tokens stay valid until expiry (~1h)? → A: **Eventual + on-failure revalidation.** The acting device signs out immediately (FR-010). Other devices reroute (a) eventually, when their access token expires and refresh fails (Supabase revokes refresh tokens on `deleteUser`; the existing `authStore.onAuthStateChange` already routes to Welcome), and (b) immediately on their next failed authenticated request, via a one-shot `supabase.auth.getUser()` session revalidation that detects the deleted account and reroutes. A per-request user-existence check was rejected as overkill. Known limitation: an idle device that issues no request stays on a stale view until its token lifetime elapses. Resolves FR-011a / FR-011b and the concurrent-edit edge case.

### Derived decisions (not directly answered; recorded to avoid silent assumptions)

- **D1 — Local-mode confirmation gate.** The password re-confirmation answer is hosted-specific: local mode has no account and no password to verify. Local "Clear all data" therefore uses a **typed-confirmation gate** (the user types `DELETE` into a field to enable the destructive button) instead of password re-confirmation. Same warning copy, mode-appropriate gate. **Ratified at `/speckit.clarify` 2026-05-28.**
- **D2 — Post-clear local state.** After a local "Clear all data", the Tracker and Profile render their existing empty states. Re-seeding is **not** performed automatically (seeding remains operator-driven via existing `server/db-seed*.js` scripts). Out of scope to auto-repopulate.
- **D3 — Resume parsing artifacts.** The brief lists "hosted parsing artifacts" in the removal scope. Verified at spec time: resume parsing uses `multer.memoryStorage()` ([`server/routes/resume.js`](../../server/routes/resume.js)) and writes **no** persistent files or rows — the parsed result is returned to the client and never stored server-side. There is nothing to delete. This item is **vacuous** in the current codebase; revisit only if a feature later persists parsing artifacts.
- **D4 — Calendar / timeline data.** The Calendar (026) is a pure projection of `applications` rows and the Timeline (025) is a JSON column **on** the `applications` row. Both are removed implicitly when the application rows are deleted (cascade in hosted; table wipe in local). No separate deletion path is required.

---

## Problem Statement

Hosted users can create an account, import a resume, build a profile, and accumulate job applications — but there is **no way to delete any of it**. The app exposes Sign out ([`src/components/Navbar.js`](../../src/components/Navbar.js)) but Sign out only ends the session; the account and all its data persist indefinitely on the hosted Supabase project. There is no surface to permanently remove a profile, the applications, or the account itself.

This is a trust, ownership, and lifecycle gap. A user who wants to leave has no exit; a user evaluating the hosted app has no assurance their data is theirs to remove. For a local-first tool that handles personal job-search data (employers, salaries, contact names), the absence of a delete path is a meaningful omission.

This feature closes the account lifecycle. It adds an **Account** section to the Profile page with a permanent-deletion control. In hosted mode, confirming (with password re-entry) permanently deletes the user's Supabase account; the existing `ON DELETE CASCADE` foreign keys remove every associated row (applications, profile, seed marker) in one operation, all sessions are invalidated, and the user lands back on the Welcome page. In local mode the same control becomes "Clear all data" (there is no account to delete). In demo mode the control is shown but disabled, so visitors can see the capability exists without acting on a real account.

---

## Scope

### In scope

- A new **Account** section rendered on the Profile page after the existing Profile section, in all runtime modes.
- **Hosted mode** — permanent account deletion:
  - A destructive control ("Delete account") with serious-but-non-alarming warning copy stating that deletion is **permanent**, data **cannot be recovered**, and **all hosted data is removed**.
  - A confirmation modal that requires **re-entering the account password**; the destructive request only fires after the password is verified.
  - A new authenticated server endpoint that, server-side only, uses the **service-role** Supabase admin client to delete the authenticated user (`req.user.id`). The `ON DELETE CASCADE` FKs on `applications`, `profile`, and `user_seed_state` remove the user's rows.
  - On success: the acting client's session is cleared (sign-out) and the app routes to the Welcome page with a confirmation toast. `deleteUser` revokes the user's **refresh** tokens immediately, so no session can refresh; an unexpired **access** token on another device stays technically valid until it expires, but its data requests fail (the rows are gone) and the client reroutes per FR-011a/b.
- **Local mode** — "Clear all data":
  - The same Account section, with the control labeled "Clear all data" and copy scoped to local data.
  - A **typed-confirmation** gate (type `DELETE`) — local mode has no password (D1).
  - Clears the local SQLite `applications` and `profile` data for the single local user; afterward the app shows its existing empty states (D2).
- **Demo mode** — the Account section and control are **visible but disabled**, with copy explaining the action applies to a real hosted account and is unavailable in the demo.
- **Mode parity of the surface**: the Account section is present in every mode; only the control's behavior and enabled/disabled state differ by mode.
- Accessibility for every new surface (labeled controls, keyboard-operable modal, focus management, non-color-only signaling of the destructive action).
- Automated tests for the deletion endpoint behavior, the password-verification gate, mode-dependent control state, and post-deletion session handling.

### Out of scope (Non-Goals)

- Account deactivation or suspension (no reversible disable state).
- Soft-delete or any recovery / undo window for deleted accounts.
- Admin or moderation tooling for deleting **other** users.
- Partial or selective deletion (e.g. "delete my applications but keep my profile", per-record deletion).
- Data export / download before deletion.
- Editing account credentials (changing email or password) or a forgot-password flow — explicitly out, consistent with 018's "no in-app password reset" stance.
- A separate settings/account **route or page** — the control lives in a Profile-page section.
- Auto re-seeding local data after a clear (D2).
- Any cleanup of resume parsing artifacts (none are persisted — D3).
- A general-purpose "User Settings" surface for future preferences — this feature ships only the Account-deletion control; the section is named "Account".

---

## User Scenarios & Testing

### User Story 1 — Delete my hosted account (Priority: P1)

A signed-in hosted user opens the Profile page, scrolls to the new **Account** section, and clicks **Delete account**. A modal explains the deletion is permanent and asks them to confirm by entering their password. They enter the correct password and confirm. Their account and all associated data are permanently removed; they are signed out and returned to the Welcome page with a confirmation message.

**Why this priority**: This is the feature. Without it, the account lifecycle has no exit. MVP slice.

**Independent Test**: As a hosted user with a profile + several applications, open Profile → Account → Delete account, enter the correct password, confirm. Verify: the API responds success; the user is on the Welcome page (unauthenticated); attempting to sign in again with the same credentials fails (account no longer exists); querying the database confirms zero `applications`, `profile`, and `user_seed_state` rows for that former user id.

**Acceptance Scenarios**:

1. **Given** a hosted user with N applications and a profile, **When** they confirm deletion with the correct password, **Then** the server deletes the auth user and the cascade removes all `applications`, `profile`, and `user_seed_state` rows for that user id.
2. **Given** a successful deletion, **When** the response returns, **Then** the client clears the session and the app renders the Welcome page (authStore status `unauthenticated`).
3. **Given** a deleted account, **When** the former user attempts to sign in with the same email/password, **Then** sign-in fails (the account no longer exists).
4. **Given** a successful deletion, **Then** a confirmation toast/message is shown (e.g. `Account deleted.`).

---

### User Story 2 — Password gate prevents accidental / unauthorized deletion (Priority: P1)

The deletion modal will not delete anything until the user proves identity by re-entering their password. A wrong password, or an empty field, blocks the destructive request and shows an error; nothing is deleted.

**Why this priority**: A one-click permanent delete is unacceptably dangerous. The gate is what makes the flow trustworthy.

**Independent Test**: Open the deletion modal, enter an incorrect password, confirm. Verify: an error is shown, no delete request is sent (or it is rejected), and all of the user's data still exists. Then enter the correct password — deletion proceeds.

**Acceptance Scenarios**:

1. **Given** the deletion modal is open, **When** the password field is empty, **Then** the destructive button is disabled or the submit is blocked with a validation message.
2. **Given** an incorrect password, **When** the user confirms, **Then** verification fails, an error message is shown, and no account/data is deleted.
3. **Given** a correct password, **When** the user confirms, **Then** verification succeeds and deletion proceeds (US1).
4. **Given** the modal is open, **When** the user cancels / presses Esc / clicks the backdrop, **Then** the modal closes and nothing is deleted.

---

### User Story 3 — Clear all data in local mode (Priority: P2)

A local-mode user opens Profile → Account. The control reads **Clear all data** with copy scoped to local data. They click it, type `DELETE` to confirm, and confirm. All local applications and profile data are removed; the Tracker and Profile show their empty states. The user remains in the app (there is no account to sign out of).

**Why this priority**: Local mode still benefits from a clean reset, and the Account section must behave coherently in every mode. Secondary to the hosted flow that motivates the feature.

**Independent Test**: In local mode with seeded applications and a profile, open Profile → Account → Clear all data, type `DELETE`, confirm. Verify: the SQLite `applications` and `profile` data are empty; the Tracker shows the empty state; the Profile shows "No profile set up yet."; the user is still in the app shell (not redirected to Welcome).

**Acceptance Scenarios**:

1. **Given** local mode with data, **When** the user types `DELETE` and confirms, **Then** all local applications and profile data are cleared.
2. **Given** a local clear, **When** it completes, **Then** the app remains mounted (no sign-out / no Welcome redirect — local mode has no auth).
3. **Given** the confirmation field does not contain exactly `DELETE`, **Then** the destructive button is disabled.
4. **Given** a local clear, **Then** a confirmation toast is shown and the existing empty states render without a full reload.

---

### User Story 4 — Discover the control in demo mode (disabled) (Priority: P2)

A demo visitor opens Profile → Account. The deletion control is present but **disabled**, with copy explaining it deletes a real hosted account and is unavailable in the demo. Clicking it does nothing destructive.

**Why this priority**: The demo is the portfolio surface (020). Showing the control communicates the capability without risking the auth-less in-memory session.

**Independent Test**: Enter demo from the Welcome page, open Profile → Account. Verify: the control is rendered, visibly disabled, with explanatory copy; activating it performs no operation and triggers no network call.

**Acceptance Scenarios**:

1. **Given** demo mode, **When** the Account section renders, **Then** the deletion control is present and disabled.
2. **Given** demo mode, **When** the user attempts to activate the disabled control, **Then** no confirmation modal opens, no data changes, and no network request is made (consistent with 020's no-fetch demo seam).
3. **Given** demo mode, **Then** explanatory copy indicates the action applies to a real hosted account.

---

### User Story 5 — Deletion invalidates sessions everywhere (Priority: P3)

A hosted user signed in on two devices/tabs deletes the account from one. The deleting tab returns to Welcome. The other session can no longer perform authenticated actions — its next authenticated request fails (the rows are gone), the client revalidates the session, and it is routed to Welcome.

**Why this priority**: Completes the "permanent" promise across sessions. Lower priority because the primary device's experience (US1) already delivers the core value.

**Independent Test**: Sign in on two browser sessions. Delete from session A. In session B, trigger an authenticated request (e.g. reload the Tracker). Verify session B's request fails, the client revalidates via `getUser()` (FR-011a), and it is routed to the Welcome page rather than silently operating on a deleted account.

**Acceptance Scenarios**:

1. **Given** a deleted account, **When** another session makes an authenticated API call, **Then** the call fails — typically a 500 (the `seedHostedUserIfNeeded` re-seed hits the `auth.users` FK constraint) or a 404 (rows are gone), **not** necessarily a clean auth error, because the unexpired access token still passes `requireAuth`.
2. **Given** session B's request fails after deletion, **When** the client's FR-011a revalidation (`getUser()`) confirms the account no longer exists, **Then** session B is routed to the Welcome page (unauthenticated state), not left in a broken authenticated shell.

---

### Edge Cases

- **Wrong password**: handled in US2 — verification fails, error shown, nothing deleted.
- **Deletion request fails mid-flight** (admin API error, network error, service-role misconfigured): the user is **not** signed out; an error toast is shown; their data is intact. There is no partial-deletion state to recover — the cascade is atomic at the database, and if `deleteUser` does not succeed, no rows are removed. The user may retry.
- **Interrupted deletion** (user closes the tab mid-request): the request either completed server-side (account gone; on next load they reach Welcome) or it did not (account intact). No intermediate corrupt state.
- **Active parsing operation during deletion**: resume parsing is stateless and in-memory (D3); a parse request in flight when the account is deleted simply fails auth afterward. No artifact remains.
- **Re-signup with the same email after deletion**: allowed — deleting the auth user frees the email for a fresh signup. The new account starts empty (and re-runs the 019 seed on first request).
- **Demo / local restrictions**: covered by US3 / US4 — no auth user exists in those modes, so account deletion is not applicable; behavior is mode-specific.
- **Service-role key absent in hosted mode**: hosted boot already requires `SUPABASE_SERVICE_ROLE_KEY` ([`server/config.js`](../../server/config.js)), so a misconfigured deploy fails to start rather than reaching this feature with a missing key. If the admin call nonetheless errors at runtime, it surfaces as a deletion failure (above), never a partial wipe.
- **Local clear with no data**: clearing when already empty is a safe no-op that still shows the confirmation toast and empty states.
- **Concurrent edit from a second device after deletion**: device 1 deletes the account; device 2 (still holding an unexpired access token) edits an application. The edit does **not** save — the request fails server-side (the `seedHostedUserIfNeeded` re-seed attempt hits the `auth.users` foreign-key constraint and returns 500; even if it reached the handler, the `UPDATE … WHERE user_id = auth.uid()` matches 0 deleted rows → 404). Per FR-011a, device 2's client revalidates the session on this failure, detects the deleted account, and routes to Welcome with a message rather than surfacing a raw error.

---

## Requirements

### Functional Requirements

#### Account section (all modes)

- **FR-001**: The Profile page MUST render a new **Account** section after the existing Profile section, in all runtime modes (hosted, local, demo).
- **FR-002**: The Account section MUST contain a single destructive control whose label and behavior depend on runtime mode: hosted → "Delete account"; local → "Clear all data"; demo → "Delete account" (disabled).
- **FR-003**: The destructive control MUST present serious, clear, non-alarming warning copy communicating that the action is permanent, data cannot be recovered, and (hosted) all hosted data will be removed.

#### Confirmation gate

- **FR-004**: In hosted mode, the destructive action MUST require **password re-confirmation**: a confirmation modal collects the account password and the deletion MUST NOT proceed until that password is verified for the signed-in user. Verification MUST be performed **server-side** on the delete endpoint (the password is sent to the server over HTTPS and re-checked against the user's credentials); the client MAY additionally pre-check for fast feedback, but the server check is the authoritative gate. A valid JWT without a correct password MUST NOT delete the account.
- **FR-005**: An incorrect or empty password MUST block deletion and surface an error; no account or data is deleted. The server MUST return a distinct, non-enumerating error for a failed password check (not a generic 401 that the client cannot distinguish from an expired session). (D1) In local mode, where no password exists, the confirmation MUST require typing `DELETE` to enable the destructive button, **and** the local clear endpoint MUST require a matching `confirm: "DELETE"` value in the request body — the destructive clear is gated at the API boundary, not by the UI alone, so a stray/empty request cannot wipe local data.
- **FR-005a**: The confirmation modal MUST be cancelable (explicit cancel, Esc, and backdrop click) and canceling MUST delete nothing.

#### Hosted deletion (backend)

- **FR-006**: The system MUST expose an **authenticated** endpoint that permanently deletes the calling user's account. It MUST require a valid JWT (`requireAuth`) and act only on `req.user.id` — a user MUST NOT be able to delete any account other than their own.
- **FR-007**: Deletion MUST be performed server-side using the **service-role** Supabase admin client to delete the auth user. The service-role key MUST NOT be exposed to the browser or returned in any response.
- **FR-007a**: The endpoint MUST re-verify the submitted password against the authenticated user's own credentials before invoking the admin delete (FR-004). The password MUST NOT be logged, and the verification MUST be scoped to `req.user` so it cannot be used to probe other accounts.
- **FR-008**: Deletion of the auth user MUST result in removal of all of that user's rows in `applications`, `profile`, and `user_seed_state`, relying on the existing `ON DELETE CASCADE` foreign keys (no new manual per-table delete logic is required, and none of the user's data may remain).
- **FR-009**: The service-role admin client MUST be constructed only on the deletion path (or lazily), consistent with the lazy-import / no-top-level-Supabase discipline of 017/019; local-mode boot MUST NOT load it.

#### Post-deletion behavior

- **FR-010**: On successful hosted deletion, the client MUST clear the local session (sign out) so authStore transitions to `unauthenticated` and the app routes to the Welcome page.
- **FR-011**: Deleting the account MUST revoke the user's refresh tokens (a property of `auth.admin.deleteUser`) so no session can refresh and remain alive past its current access-token lifetime. Note: an already-issued access token stays valid until expiry and still passes `requireAuth`, so "instant" server-side rejection is NOT guaranteed within that window — every data request nonetheless fails because the rows are gone (500/404), and the client handles rerouting per FR-011a/b. No session can continue operating against a live account.
- **FR-011a**: The client MUST proactively reroute non-acting sessions. Because an unexpired access token still passes `requireAuth` after the account is deleted (and a stale data request fails as a 500 or 404, not a clean 401 — see Edge Cases), the client MUST, on a failed authenticated request whose code/status could indicate a dead session — **`UNAUTHORIZED`, `INVALID_PASSWORD`, 404, or 500** (but NOT a 400 validation error) — perform a one-shot session revalidation (`supabase.auth.getUser()`); if it reports the account no longer exists, the client MUST clear its local session and route to the Welcome page with a clear message (e.g. "Your account no longer exists."). A still-valid user is a no-op, so a legitimate failure never signs the user out. `INVALID_PASSWORD` is included because a stale session submitting the delete modal with a *correct* password still gets `INVALID_PASSWORD` (the server-side recheck fails when the account is gone); the `getUser()` guard keeps a genuine wrong-password attempt on its inline modal error without signing out. This handler applies app-wide, not only to the deleting device.
- **FR-011b**: Independently of FR-011a, the client MUST continue to honor Supabase's `onAuthStateChange` sign-out (fired when the stale access token expires and refresh fails, since `deleteUser` revokes refresh tokens) by routing to the Welcome page. This is the eventual catch-all for an idle device that issues no request. Known limitation: an idle non-acting device may remain on a stale view until its access-token lifetime elapses; instant logout there is explicitly out of scope (a per-request user-existence check was rejected).
- **FR-012**: On a failed deletion, the user MUST remain signed in with data intact and MUST see an error message; no partial deletion is permitted.
- **FR-013**: A confirmation message/toast MUST be shown on success (hosted: account deleted; local: data cleared).

#### Local mode

- **FR-014**: In local mode the control MUST be labeled "Clear all data" and its copy MUST be scoped to local data (no "account" language, since local mode has no account).
- **FR-015**: Confirming a local clear MUST remove all local `applications` and `profile` data for the single local user.
- **FR-016**: After a local clear, the app MUST remain mounted (no sign-out, no Welcome redirect) and MUST render the existing empty states for the Tracker and Profile.
- **FR-017**: A local clear MUST NOT auto re-seed data (D2).

#### Demo mode

- **FR-018**: In demo mode the control MUST be **visible but disabled** with copy indicating it applies to a real hosted account and is unavailable in the demo.
- **FR-019**: Activating the disabled demo control MUST perform no operation and MUST NOT issue any network request (consistent with the 020 no-fetch demo seam).

#### Constitutional requirements

- **FR-020**: The feature MUST handle empty, loading, and error states explicitly for the deletion flow (in-flight deletion indicator, error surface, post-deletion empty/redirect state).
- **FR-021**: Every new surface (Account section, destructive control, confirmation modal) MUST be operable on desktop and mobile, with labeled controls, keyboard navigation, focus management in the modal, and non-color-only signaling of the destructive action.
- **FR-022**: The feature MUST NOT introduce external analytics, tracking, or data sharing. Operational logs MAY record that a deletion occurred only if anonymized and non-user-identifiable.
- **FR-023**: The feature MUST NOT corrupt or partially delete data — deletion is all-or-nothing (FR-008, FR-012).
- **FR-024**: The system MUST provide automated tests covering: the deletion endpoint authenticated/own-account-only behavior; the password-verification gate (correct vs incorrect); mode-dependent control state (hosted enabled / demo disabled / local "Clear all data"); and post-deletion unauthenticated routing.

---

### Key Entities

- **Account** *(existing — Supabase `auth.users`)*: the authenticated hosted user. Deletion target. Removing it cascades to all owned rows via existing FKs. Not present in local or demo mode.
- **User data** *(existing — no schema change)*: `applications` rows (including the `timeline` JSON column — 025), the `profile` row (007/019), and the `user_seed_state` marker (019). All carry `user_id` with `ON DELETE CASCADE` to `auth.users`; all are removed by the cascade.
- **Account section** *(new client surface, no persistence)*: a Profile-page section hosting the destructive control; mode-aware label, copy, and enabled/disabled state.
- **Confirmation modal** *(new client surface, no persistence)*: collects the gate (hosted: password; local: typed `DELETE`) and triggers the destructive operation only on a verified/valid gate.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A hosted user can permanently delete their account in at most three interactions from the Profile page (open Account control → enter password → confirm), ending on the Welcome page.
- **SC-002**: After a hosted deletion, zero `applications`, `profile`, and `user_seed_state` rows remain for the former user id, verified by direct database query.
- **SC-003**: An incorrect password never deletes data — verified by an automated test asserting data intact after a wrong-password attempt.
- **SC-004**: The deletion endpoint rejects unauthenticated requests and cannot be used to delete another user's account — verified by automated tests.
- **SC-005**: The Account control renders correctly per mode: enabled "Delete account" (hosted), disabled "Delete account" (demo, no network call), "Clear all data" (local) — verified by automated tests.
- **SC-006**: Local "Clear all data" empties local applications + profile and leaves the user in-app with empty states — no Welcome redirect.
- **SC-007**: Browser smoke test (constitution-required final phase): on desktop + mobile viewports, a hosted user deletes their account (with password confirmation) and lands on Welcome; re-signup with the same email yields a fresh empty account. No visual regressions on existing Profile sections.
- **SC-008**: The service-role key is never present in any client bundle or API response — verified by inspection/test that the admin client is server-only.

---

## Assumptions

- Hosted auth (email+password), JWT verification (`requireAuth`), and per-user RLS already exist (018/019).
- The `ON DELETE CASCADE` foreign keys from `applications`, `profile`, and `user_seed_state` to `auth.users(id)` are in place per [019 data-model §5](../019-supabase-persistence/data-model.md), so deleting the auth user removes all owned rows.
- `SUPABASE_SERVICE_ROLE_KEY` is configured in hosted deployments (already required at boot by [`server/config.js`](../../server/config.js)); this feature is its first runtime consumer.
- Supabase's Admin API (`auth.admin.deleteUser`) is available with the service-role key and revokes the user's sessions/tokens on deletion.
- Auth is email+password only — there are no OAuth/magic-link accounts, so password re-confirmation is viable for every hosted account.
- Resume parsing persists nothing server-side (in-memory `multer`), so there are no parsing artifacts to delete (D3).
- The Calendar projection (026) and Timeline (025) hold no data independent of `applications` rows, so they are cleared implicitly (D4).
- Local mode is single-user with no authentication; "Clear all data" is the local analogue of account deletion.
- The Profile page can accept an additional section without a redesign (additive change to the section list).
- No external service or new dependency is introduced beyond the already-present `@supabase/supabase-js` (used with the service-role key for the admin call).
