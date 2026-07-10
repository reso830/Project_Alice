# Implementation Plan: Hosted Password Management

**Branch**: `045-auth-password-reset` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/045-auth-password-reset/spec.md`

---

## Summary

Adds three self-service credential workflows to Hosted Mode, reversing feature 018's deliberate "no custom in-app reset UI" decision: **Change Password** (Settings, signed-in, current+new+confirm), **Forgot Password** (Welcome, signed-out, email → recovery email), and **Reset Password** (Welcome, reached via the emailed recovery link, new+confirm). All three delegate credential validation to Supabase Auth; Alice adds its own current-password re-verification (Change Password) and a dedicated expired-link state (Reset Password) on top. Work is organized into four dependency-ordered phases (WS1–WS4): a foundational `authStore`/shared-validation phase, then the three workflows, each buildable independently once WS1 lands. No application data, schema, or `createRepositories` entity is touched — this is auth/session/UI only.

---

## Technical Context

**Language/Version**: JavaScript (ES6+), Vanilla JS (client), Express (server)
**Primary Dependencies**: `@supabase/supabase-js` (^2.45.0, already a dependency) — `supabase.auth.updateUser()`, `supabase.auth.resetPasswordForEmail()`, and (server-side, admin client) `admin.auth.admin.updateUserById()`, none of which are called anywhere in the codebase today. No new npm dependencies.
**Storage**: N/A — no persistence-layer change. Supabase Auth remains the sole credential store.
**Testing**: Vitest (unit/integration, client + server) + manual Browser Smoke Test (final phase, per constitution).
**Target Platform**: Hosted web (Vercel serverless + Supabase Auth) only. Structurally unreachable in Local Mode (no Welcome page, no hosted account); explicitly hidden in Demo Mode (Change Password) per the spec Clarifications.
**Constraints**: No new custom password-recovery tokens (Supabase's own recovery links are the only mechanism); current password re-verified server-side before Change Password is allowed (FR-4); recovery-request confirmation must never disclose account existence (FR-8/AC-5); a successful Reset Password explicitly ends the recovery session (spec Clarification, 2026-07-10); an expired/invalid recovery link shows a dedicated state on load, not only on submit-failure (spec Clarification, 2026-07-10).

---

## Constitution Check

- **Data Fields**: No persistence models or required fields (company, job title, status, `lastStatusUpdate`, responsibilities) are added or modified. Nothing in this feature touches `createRepositories`'s `applications`/`profile` entities.
- **Separation of Logic**: Password-policy validation (8-char minimum) is consolidated into the existing centralized `src/utils/validate.js` (adds `validatePassword`) rather than staying duplicated across `LoginForm.js`/`SignupForm.js` and the two new forms — this is itself a constitution-aligned cleanup ("centralized, reusable validation rules"). Server-side credential mutation logic stays in `server/repositories/supabase/account.js`; route handlers stay thin (mirrors the existing `DELETE /api/account` split).
- **Validation**: Change Password and Reset Password both validate required fields, password-policy compliance, and confirmation-match client-side before submit, **and** the server independently re-validates password length and (Change Password only) current-password authenticity — no client-only trust for the security-relevant checks, consistent with how `DELETE /api/account` already re-verifies server-side rather than trusting a client-side "I confirmed" flag.
- **Workflows / States**: Explicit loading (disabled/spinner submit buttons across all three forms), inline error, and a dedicated expired/invalid-recovery-link state are all planned (spec AC-14, AC-7).
- **Local-First Privacy**: All three workflows are gated to hosted-only code paths. No new analytics/tracking. No PII beyond what Supabase Auth already handles (email, password — never logged, never persisted by Alice itself).
- **New Dependencies**: None. All new calls use the already-installed `@supabase/supabase-js` client (browser: anon-key client already constructed in `src/services/supabaseClient.js`; server: the anon client and admin client already constructed ad hoc in `server/repositories/supabase/account.js`/`adminClient.js` for the existing Delete Account flow).

---

## Visual-Fidelity Mode

- **Feature classification**: Mixed — the three new overlays (Change Password, Forgot Password, Reset Password) are implemented against a high-fidelity handoff and are visual-fidelity work; `authStore`'s recovery-detection logic, the new server route, and the repository changes are pure logic work with no visual component.
- **Canonical design source**: `Alice_Change_ForgotPwd.zip` → `design_handoff_password_reset_modal/` — specifically `README.md` (authoritative behavior/copy/token spec), `wr-auth.jsx` (`ForgotPasswordModal`, `NewPasswordModal`), `password-change-form.jsx` (`PasswordChangeModal`), `profile-settings.jsx` (`AccountGroup`'s entry point), `assets/Alice-Sigil-color.svg`. The README explicitly marks colors/typography/spacing/radii/interaction-states as **final** ("recreate them pixel-for-pixel").
- **Target stack vs prototype stack**: prototype = React/JSX (in-browser Babel, not a real build); target = Vanilla JS (this repo has no React in production — `src/pages/welcome/*.js`, `src/components/*.js` are hand-rolled DOM builders). Per the constitution's faithful-translation rule, tasks lift the prototype's CSS custom-property tokens and pixel/radius/shadow values wholesale (README §"Design Tokens") and replicate its DOM structure (`.scrim`/`.modal`/`.m-head` for the two Welcome overlays; `.pcf-*` for the Settings modal) rather than restructuring to fit existing `AuthOverlay`/`DeleteAccountModal` class names — **except** where the design is explicitly reused chrome: the two Welcome recovery overlays reuse the *live* `AuthOverlay`/`.auth-overlay__*` DOM and CSS (not a re-creation of `.scrim`/`.modal`, which is the *prototype's own* stand-in chrome for a modal system this codebase already has for real) per the README's own note ("same `.scrim`/`.modal`/`.m-head` classes... no new modal chrome was introduced" — read in this codebase's context as "reuse the existing overlay chrome," since the prototype's `.scrim`/`.modal` **is** its local stand-in for exactly that). The Settings `PasswordChangeModal` has no existing equivalent chrome to reuse (Settings' only precedent, `DeleteAccountModal.js`, is a differently-purposed confirm/danger dialog) — its `.pcf-*` styles are lifted wholesale as a new, self-contained component per the design handoff's own framing ("styled independently... so Settings isn't coupled to Welcome-page CSS").
- **Breakpoints / checkpoints to verify**: the two Welcome overlays inherit `AuthOverlay`'s existing responsive behavior (already verified for `login`/`signup`/`verification_sent`) — no new breakpoint logic, verify at the same widths `AuthOverlay` is already tested at. `PasswordChangeModal` (Settings): single fixed-width card (`max-width: 400px`) with no distinct mobile layout in the handoff — verify it doesn't overflow/clip at narrow widths (≤390px) even though the handoff doesn't declare a separate mobile breakpoint for it.
- **Tier 1 harness**: **skipped for this feature** (proportionality — see spec/plan discussion: 3 modals reusing/extending existing overlay chrome, not a new page or animated scene set; no `npm run test:visual` harness or Playwright dependency exists yet in this repo, and standing one up is out of proportion to this feature's visual surface). Tier 2 is not weakened by this — see below.
- **Tier 2 judge**: implementing agent self-serves after an in-session image-view preflight (comparing frozen-state screenshots of the built overlays against the design handoff's own screenshots/rendered HTML), per task, during implementation — not deferred to the Browser Smoke Test.

---

## Architecture

### Phasing (dependency-ordered)

- **WS1 — `authStore` foundation.** Recovery-URL detection, the `SIGNED_IN`-before-`PASSWORD_RECOVERY` guard, the two new status values (`password-recovery`, `recovery-expired`), and the `validatePassword` consolidation into `src/utils/validate.js`. Nothing user-visible ships yet — this is the shared groundwork WS3/WS4 depend on. *Verify the event-ordering assumption (research.md D1) against a real recovery link before building WS4 on top of it.*
- **WS2 — Change Password (Settings).** Independent of WS1 beyond the shared `validatePassword`. New `PATCH /api/account/password` route + both repository adapters, `PasswordChangeModal`, the Settings entry point, Demo/Local gating.
- **WS3 — Forgot Password (Welcome, request).** Independent of WS1/WS2 beyond the shared `validatePassword`. `AuthOverlay`/`LoginForm` additions, `ForgotPasswordForm`, non-enumerating confirmation.
- **WS4 — Reset Password + expired-link state (Welcome, via recovery link).** Depends on WS1 (the recovery-status state machine) and reuses WS3's `AuthOverlay` extension pattern. `main.js`/`WelcomePage` initial-view threading, `ResetPasswordForm`, explicit post-success sign-out.

Mandatory final phases (constitution): **Release Prep**, then **Browser Smoke Test** — walking US-1 through US-6's Independent Tests against the to-be-merged state.

### Current state (verified in code)

- `src/data/authStore.js` `init()` awaits `supabase.auth.getSession()` **first**, then registers `supabase.auth.onAuthStateChange((_evt, session) => applySession(session))` **after** — the event name is received but never inspected. There is no `PASSWORD_RECOVERY` branch.
- `src/services/supabaseClient.js` constructs the client with `detectSessionInUrl: true`, so Supabase-js already auto-parses a recovery link's URL fragment into a session on load — but the app never reacts to it as anything other than a normal sign-in.
- `src/pages/welcome/AuthOverlay.js` explicitly does **not** have a Forgot-password affordance today (its file-header comment records this as feature 018's deliberate scope decision, now being reversed). Its view state machine is `login | signup | verification_sent`.
- `src/pages/Profile.js`'s `renderAccountGroup()` already implements the three-way Hosted/Local/Demo gate this feature reuses for Change Password (`resolveAccountMode()` → `'hosted' | 'local' | 'demo'`).
- `src/components/DeleteAccountModal.js` ↔ `src/services/api.js`'s `deleteAccount()` ↔ `server/repositories/supabase/account.js` is the existing precedent for "collect a current password client-side, re-verify it server-side, distinguish `INVALID_PASSWORD` from other failures" — Change Password reuses this contract directly rather than inventing a new one.

### Risk: a recovery-link click fires `SIGNED_IN` before `PASSWORD_RECOVERY`

Supabase's documented behavior (confirmed via Supabase's own GitHub discussions or a real recovery-link click) is that opening a password-recovery link causes the client to emit **two** `onAuthStateChange` events in sequence: `SIGNED_IN` first, then `PASSWORD_RECOVERY`. If `authStore`'s callback treats every event identically (as it does today — `applySession(session)` unconditionally), a recovery-link visit would briefly resolve to `status: 'authenticated'` before the second event arrives, and `main.js`'s `render()` (subscribed to every `authStore` state change) could mount the real authenticated app shell for a frame before the recovery view takes over. This is the same class of "flash before the correct destination mounts" risk 044 solved for `local-mode`/ConfigError, and needs an equivalent guard here (see D1 in [research.md](./research.md)).

**Mitigation**: read `location.hash`/`location.search` synchronously (before any async Supabase call) for Supabase's recovery marker (`type=recovery`). If present, `authStore.init()` sets a `pendingRecovery` flag *before* calling `getSession()`/registering `onAuthStateChange`, and while that flag is set, a bare `SIGNED_IN` event is **not** applied as `authenticated` — the store waits specifically for `PASSWORD_RECOVERY` (which is now guaranteed relevant, not speculative) before resolving to a new `password-recovery` status. A short timeout (mirroring 044's boot-timeout pattern, ~5–10s) covers the case where neither event ever arrives (a genuinely dead/malformed link) by resolving to `recovery-expired` instead. This also directly implements the expired-link acceptance criterion (AC-7) — the same mechanism serves both "avoid flashing the app shell" and "detect an invalid link on load," so this is not two problems, it's one.

**Also register `onAuthStateChange` before awaiting `getSession()`** (today's code does the opposite order) — not because `getSession()` itself is expected to reorder against the recovery events (it reads local storage and does not by itself emit `PASSWORD_RECOVERY`), but because Supabase's own docs recommend subscribing before/independent of any initial `await`, and it removes any dependency on `getSession()`'s resolution timing relative to the URL-driven auth events for correctness.

### Change Password mechanism (server-side, mirrors Delete Account)

New `PATCH /api/account/password` route (`server/routes/account.js`, `requireAuth`-gated, alongside the existing `DELETE /`), forwarding to a new `changePassword(body)` method on the `account` repository:

- **Hosted** (`server/repositories/supabase/account.js`): re-verify `currentPassword` via the anon client's `signInWithPassword` (identical pattern to `deleteAccount`'s step 1) → on failure, throw `{ code: 'INVALID_PASSWORD', status: 401 }`. On success, validate `newPassword` server-side (length ≥ 8) → update via the service-role admin client's `admin.auth.admin.updateUserById(userId, { password: newPassword })` (reusing the delete flow's already-established, lazily-imported admin client — deliberately not restructuring the repository to also carry a per-request JWT client just to avoid the admin client for this one call; see research.md D2 for the tradeoff).
- **Local** (`server/repositories/account.js`): add a `changePassword()` stub that throws `{ code: 'NOT_SUPPORTED', status: 501 }` — mirrors the interface-uniformity convention already documented on `createSqliteAccountRepository` (`delete()` exists on both adapters so the route stays runtime-agnostic), and gives a clean, intentional error if this route is ever hit on a local/portable deployment (the UI never renders the control there, so this is defense-in-depth, not a real user path).

### Forgot Password / Reset Password mechanism (no new server route)

Unlike Change Password, neither Forgot nor Reset Password needs a server round-trip — both are direct client-SDK calls with the browser's existing anon-key Supabase client, exactly like `LoginForm.js`'s `signInWithPassword` and `SignupForm.js`'s `signUp` already are:

- **Forgot Password**: `supabase.auth.resetPasswordForEmail(email, { redirectTo: emailRedirectUrl })` (reusing the existing `VITE_AUTH_EMAIL_REDIRECT_URL`-sourced `emailRedirectUrl` export from `supabaseClient.js` — the same base URL already used for signup verification; Supabase appends its own recovery-specific hash params regardless of the path portion, so a single allow-listed redirect URL covers both flows — to be confirmed against the actual configured value during implementation, see research.md D4).
- **Reset Password**: `supabase.auth.updateUser({ password: newPassword })`, callable directly because `detectSessionInUrl` already promoted the recovery link into an active (recovery) session by the time the form is reachable. On success, explicitly `supabase.auth.signOut()` (per the spec Clarification: return to a logged-out Welcome/login screen, not the authenticated app shell) before rerouting. **Abandoning the workflow without submitting — close button, Escape, backdrop click, or "Back to sign in" — also explicitly calls `signOut()`** before returning to the standard Welcome/login screen (spec Clarification, 2026-07-10): every exit from a `password-recovery` session, not just a successful one, ends it. This is wired at the `AuthOverlay`/`ResetPasswordForm` close-handling seam, not left to `main.js`'s `render()` to reconcile after the fact — `render()` only reacts to `authStore` status changes, it does not itself know the overlay closed, so the sign-out **must** be triggered from the same place `onClose` already fires (mirroring how `AuthOverlay.close()` already restores focus and calls `onClose?.()` as one seam).
- Both surface Supabase errors as an inline error region without exposing provider internals (FR-13), matching `LoginForm.js`'s existing `ERROR_MESSAGE` pattern.

### `main.js` / `render()` / `authStore` extension

- `authStore`'s status union gains two new values: `'password-recovery'` (a `PASSWORD_RECOVERY` event was confirmed) and `'recovery-expired'` (a recovery-shaped URL was present but never resolved to a valid recovery session, or `updateUser` fails at submit time citing an invalid session — FR-11's runtime re-check).
- `main.js`'s `render()` gains a branch: `password-recovery` / `recovery-expired` → `mountWelcome({ initialAuthView })`, threading an initial view into `WelcomePage.mount()` → `AuthOverlay.render({ view })` so the overlay opens directly into the Reset Password (or expired-link) view instead of `null`/the login form. This is additive to `mountWelcome()`'s existing signature, not a new mount function — the Welcome page shell (starfield, hero, footer) is identical; only the overlay's initial view differs, matching how the design handoff's `wr-app.jsx` renders the recovery modals as overlays on the same `<App/>` shell rather than a separate page.
- `WelcomePage.js`'s `VALID_AUTH_VIEWS` and `AuthOverlay.js`'s `VALID_VIEWS` both gain `'forgot'`, `'forgot_sent'`, `'reset-password'`, and `'recovery-expired'` — following the exact precedent already set by `'verification_sent'` (a view reached via a form's `onSuccess` callback, not a user click).
- A successful Reset Password's Toast survives the `document.body`-clearing sign-out reroute via the existing `authStore.setAuthNotice()` / `consumeAuthNotice()` one-shot mechanism (already used for the analogous delete-account/session-revalidation reroutes in `mountWelcome()`).

---

## Data Flow

- **Change Password**: `PasswordChangeModal` (new, modeled on `DeleteAccountModal.js`) → `changePassword({currentPassword, newPassword})` in `src/services/api.js` → `PATCH /api/account/password` → `server/repositories/supabase/account.js`'s `changePassword()` → anon-client re-verify → admin-client update → `{ updated: true }` or a thrown `{code, status}` the route maps to a JSON error body, mirroring `deleteAccount`'s existing error-mapping in the route handler.
- **Forgot Password**: `ForgotPasswordForm` (new) → `supabase.auth.resetPasswordForEmail()` directly (browser → Supabase, no Alice server involvement) → `AuthOverlay` transitions to `forgot_sent` (generic confirmation copy, independent of the actual result to preserve non-enumeration — FR-8).
- **Reset Password**: recovery link → Supabase auto-establishes a recovery session (`detectSessionInUrl`) → `authStore` observes `PASSWORD_RECOVERY` (guarded per the risk above) → `password-recovery` status → `main.js` mounts `ResetPasswordForm` (new) inside the Welcome overlay → either (a) submit → `supabase.auth.updateUser({password})` directly (browser → Supabase) → `supabase.auth.signOut()` → `authStore.setAuthNotice()` → reroute to standard Welcome/login → Toast shown post-reroute, or (b) close/Escape/backdrop/"Back to sign in" without submitting → `supabase.auth.signOut()` directly (no notice) → same reroute. Both paths converge on the same "no dangling `password-recovery` session" outcome (spec Clarification, 2026-07-10).
- **No application data flow is touched.** `store.load()`, Tracker/Profile/Calendar data fetches are entirely unaffected; only `authStore`'s status union and `main.js`'s `render()` branch table gain new entries.

See [data-model.md](./data-model.md) for the extended auth-status state machine; [contracts/api.md](./contracts/api.md) for the new `PATCH /api/account/password` contract and the internal recovery-detection contract.

---

## Affected Components (overview)

- `src/data/authStore.js` — recovery-URL detection, reordered `onAuthStateChange` registration, `SIGNED_IN`-before-`PASSWORD_RECOVERY` guard, two new status values, `signOut()` reuse for post-reset.
- `src/main.js` — `render()` branch for `password-recovery`/`recovery-expired`; `mountWelcome()` gains an optional initial-view parameter.
- `src/pages/welcome/WelcomePage.js` — `VALID_AUTH_VIEWS` extended; threads an initial view into the overlay on mount.
- `src/pages/welcome/AuthOverlay.js` — `VALID_VIEWS` extended (`forgot`, `forgot_sent`, `reset-password`, `recovery-expired`); new view-render branches.
- `src/pages/welcome/LoginForm.js` — add the "Forgot password?" link (login view only, per the design handoff).
- New: `src/pages/welcome/ForgotPasswordForm.js`, `src/pages/welcome/ResetPasswordForm.js` (mounted-into-slot pattern, matching `LoginForm.js`/`SignupForm.js`).
- `src/utils/validate.js` — new `validatePassword` (consolidates the duplicated `PASSWORD_MIN = 8` from `LoginForm.js`/`SignupForm.js`).
- `src/pages/Profile.js` — `renderAccountGroup()` (or an adjacent group) gains the Change Password entry point, gated identically to Delete Account (hosted-only, hidden in demo/local).
- New: `src/components/PasswordChangeModal.js` (modeled directly on `DeleteAccountModal.js`).
- `src/services/api.js` — new `changePassword({currentPassword, newPassword})` client function, modeled on `deleteAccount()`.
- `src/components/Toast.js` — no code change expected; reused as-is for success notifications.
- `server/routes/account.js` — new `PATCH /password` route.
- `server/repositories/supabase/account.js` — new `changePassword()` method (anon re-verify + admin update).
- `server/repositories/account.js` (SQLite) — new `changePassword()` stub (`NOT_SUPPORTED`).
- `src/styles/main.css` — new modal styles for `PasswordChangeModal`/the two Welcome overlay views (reusing existing `.auth-overlay__*`/`.delete-modal__*` token patterns rather than introducing a new visual language).

Full inventory in **Affected Areas** below.

---

## Risks and Tradeoffs

- **`SIGNED_IN`-before-`PASSWORD_RECOVERY` event ordering** (the primary architectural risk — see Architecture above and research.md D1). Mitigation: synchronous URL-marker check + guarded event handling + timeout fallback to `recovery-expired`. This needs to be verified against the actual installed `@supabase/supabase-js` behavior early in implementation (a quick manual recovery-link test) rather than assumed correct from documentation alone — flagged as the first thing to validate once WS1 lands.
- **Change Password's admin-client update uses more privilege than strictly required** (a user's own JWT is sufficient to call `updateUser` on themselves; the plan uses the service-role admin client instead, matching Delete Account's existing pattern). Tradeoff accepted for consistency with the established, already-reviewed precedent rather than introducing a second privilege model; the actual security-relevant step (re-verifying the current password) still happens first and is unaffected by which client performs the subsequent update.
- **Two separate view-state machines gain nearly-parallel new states** (`AuthOverlay.VALID_VIEWS` and `authStore`'s status union) — risk of drift if one is updated without the other. Mitigation: `main.js`'s `render()` is the single seam translating `authStore` status → `mountWelcome(initialAuthView)`, so the mapping lives in one place, not scattered.
- **`resetPasswordForEmail`'s `redirectTo` reuses the existing `VITE_AUTH_EMAIL_REDIRECT_URL`.** If that URL is narrowly scoped to the signup-verification flow (e.g. hardcodes `?auth=callback` rather than being a bare origin), it will need a second env var or a shared base-URL constant instead. Needs confirming against the actual configured value during implementation (inspect `supabaseClient.js` and the Vercel env config, not assumed) — see research.md D4.
- **Abandoning Reset Password without submitting** (close button, Escape, backdrop click, or "Back to sign in") is now resolved (spec Clarification, 2026-07-10): every exit path explicitly signs out of the recovery session, matching the successful-reset invariant minus the notification (research.md D5). The residual implementation risk is purely mechanical: `AuthOverlay`'s existing `close()`/`onSwitch('login')` handlers don't know today whether the view they're leaving was a recovery session — T017/T020 (tasks.md) must route the `reset-password` view's exit specifically through a `signOut()`-calling path, not just the generic `setAuthView(null)`/`setView('login')` every other view uses, or this resolution doesn't actually get built.
- **Password-policy consolidation touches two already-shipped forms** (`LoginForm.js`, `SignupForm.js`) as a refactor, not just the two new forms. Mitigation: the extraction is a pure move (same 8-char rule, same behavior) — covered by the existing `tests/pages/welcome/*` / `tests/components/welcome.test.js` suites, which must continue passing unmodified in assertions, only refactored in implementation if they reach into the removed constant directly.

---

## Validation Approach

- **Unit/integration (Vitest, client)**: `authStore` recovery-URL detection (URL marker present/absent), `SIGNED_IN`-then-`PASSWORD_RECOVERY` sequencing does not transiently resolve `authenticated`, timeout fallback to `recovery-expired`; `AuthOverlay`/`WelcomePage` new view transitions (`forgot` → `forgot_sent`, initial-view threading for `reset-password`/`recovery-expired`); `validatePassword` unit tests (boundary at 8 chars); `PasswordChangeModal`'s `INVALID_PASSWORD` vs. other-error handling (mirrors existing `DeleteAccountModal.test.js` coverage); non-enumerating confirmation copy is identical regardless of whether `resetPasswordForEmail` reports success or a "user not found"-shaped error.
- **Unit/integration (Vitest, server)**: `PATCH /api/account/password` — missing fields → `VALIDATION_ERROR`; wrong current password → `INVALID_PASSWORD`/401; new password below policy → `VALIDATION_ERROR`/400; success → `{updated: true}`; local-mode repo → `NOT_SUPPORTED`/501; `requireAuth` gating (no JWT → 401, mirroring `tests/server/account.test.js`'s existing coverage for `DELETE /`).
- **Manual/exploratory**: a real recovery-link click against a test Supabase project, specifically to confirm the `SIGNED_IN`-before-`PASSWORD_RECOVERY` ordering assumption (research.md D1) before relying on it — this is the one behavior that cannot be fully verified by unit tests against a mocked client.
- **Browser Smoke Test (final phase, per constitution)**: walk US-1 through US-6's Independent Tests from spec.md against the to-be-merged state, including the Demo/Local isolation checks.

---

## Persistence Runtimes

This feature does **not** touch the data layer routed through `createRepositories(config)` — no `applications`/`profile` entity is read or written. It does add one new method (`changePassword`) to the **existing** `account` repository, which both `createRepositories` runtimes already implement (`delete`) — **hosted** (Supabase, real password re-verify + update) and **local** (SQLite, a `NOT_SUPPORTED` stub, since Local Mode has no hosted account to change a password for and the UI never renders the control there). **Demo Mode** runs on the local path with a seeded auth state; it does not gain a `changePassword` implementation of its own — the client-side gate (`resolveAccountMode() === 'demo'`) prevents the control from ever rendering, so the question of what the local repo's stub does in a demo session does not arise in practice (demo always resolves to the local repository, whose stub is never reached because the UI never calls it).

---

## Affected Areas

### Files/Components to Inspect
- `src/services/supabaseClient.js` (`emailRedirectUrl` — confirm it's reusable for `resetPasswordForEmail`'s `redirectTo`, or whether a second env var is needed — inspect only, see Risks)
- `src/main.js` (`bootstrap()`, `_pendingLocalModeState` handling — confirm the new `password-recovery`/`recovery-expired` branches compose cleanly with the existing 044 boot-state machine; inspect, minimal touch beyond the new `render()` branch)
- `server/repositories/index.js` (confirm the dispatcher needs no change beyond both adapters gaining `changePassword` — inspect only)
- `server/repositories/supabase/adminClient.js` (confirm `admin.auth.admin.updateUserById` is available on the already-constructed admin client — inspect only)
- `tests/components/welcome.test.js`, `tests/pages/welcome/*`, `tests/data/authStore.test.js`, `tests/data/authStore.demo.test.js` (confirm existing assertions are unaffected by the `authStore.init()` reordering — inspect, then extend rather than rewrite)

### Files/Components to Modify
- `src/data/authStore.js`, `src/main.js`, `src/pages/welcome/WelcomePage.js`, `src/pages/welcome/AuthOverlay.js`, `src/pages/welcome/LoginForm.js`, `src/utils/validate.js`, `src/pages/Profile.js`, `src/services/api.js`, `src/styles/main.css`, `server/routes/account.js`, `server/repositories/supabase/account.js`, `server/repositories/account.js`
- New: `src/pages/welcome/ForgotPasswordForm.js`, `src/pages/welcome/ResetPasswordForm.js`, `src/components/PasswordChangeModal.js`
- `package.json` / `package-lock.json` / `README.md` / `CHANGELOG.md` / `docs/feature_roadmap.md` / `docs/REPO_MAP.md` (Release Prep — version bump)

### Tests to Add or Update
- `tests/data/authStore.test.js` (recovery-URL detection, event-ordering guard, timeout fallback, new status values)
- `tests/components/welcome.test.js` / `tests/pages/welcome/*` (new `AuthOverlay`/`WelcomePage` views; `LoginForm`'s new Forgot-password link)
- **New**: `tests/pages/welcome/ForgotPasswordForm.test.js`, `tests/pages/welcome/ResetPasswordForm.test.js`
- **New**: `tests/components/PasswordChangeModal.test.js` (modeled on `tests/components/DeleteAccountModal.test.js`)
- `tests/pages/Profile.account.test.js` (extend for the new Change Password entry point's mode gating)
- **New**: `tests/server/repositories/supabase/account.test.js` extension, or a new `tests/server/repositories/account.changePassword.test.js` (hosted re-verify/update, local `NOT_SUPPORTED` stub)
- `tests/server/account.test.js` (extend for the new `PATCH /password` route)
- `tests/utils/validate.test.js` (new `validatePassword`)
- `tests/release-metadata.test.js` (version assertion at Release Prep)

### Areas Explicitly Out of Scope
- Data layer / `createRepositories` `applications`/`profile` entities (untouched).
- Email verification / signup flow (unaffected — `SignupForm.js`'s `emailRedirectTo` usage is inspected only, not modified beyond the shared `validatePassword` refactor).
- Delete Account (unaffected — `DeleteAccountModal.js`/`deleteAccount()`/the existing account-deletion server code are the pattern this feature reuses, not code it modifies).
- MFA, passwordless auth, email/username changes, social login, provider migration (spec Non-Goals).
- Rate limiting beyond Supabase Auth's own defaults (spec Non-Goals).
