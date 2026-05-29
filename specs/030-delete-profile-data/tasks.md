# Tasks: Delete Profile & User Data (030)

**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Data model**: [data-model.md](data-model.md)
**Contracts**: [contracts/api.md](contracts/api.md)
**Research**: [research.md](research.md)
**Quickstart**: [quickstart.md](quickstart.md)
**Plan review**: [checklists/plan-review.md](checklists/plan-review.md)
**Branch**: `030-delete-profile-data`

---

## Phase Map

| Phase | Theme | Blocks |
|---|---|---|
| 01 | **Backend** — service-role admin client, hosted `account` adapter (password verify + admin delete), local `account` adapter (uniform `delete(body)` → `confirm` gate + clear all), dispatcher wiring, `DELETE /api/account` route (no seed middleware) | 02 |
| 02 | **Client data layer** — `api.deleteAccount()` + demo no-fetch branch, `authStore.handleAuthFailure()` session revalidation, `api.js` auth-failure hook wiring | 03 |
| 03 | **UI (US-1…US-4)** — Profile **Account** section (mode-aware), deletion confirmation modal (password / typed-`DELETE` gates), post-action handling, styles | 04 |
| 04 | **Release Prep (REQUIRED)** — version bump, CHANGELOG, README, `docs/deployment.md` (service-role runtime use), `docs/REPO_MAP.md`, docs sanity check | 05 |
| 05 | **Browser Smoke Test (REQUIRED — UI feature)** — walk each user story's Independent Test against the merge state, desktop + mobile, all three modes | merge |

**Sequencing notes:**

- Phase 01 (backend) blocks everything — the client and UI call `DELETE /api/account`.
- Phase 02 blocks Phase 03 — the UI calls `api.deleteAccount()` and relies on `authStore` for post-delete sign-out and the auth-failure reroute.
- Within Phase 01: **01.1 (admin client) → 01.2 (hosted adapter) → 01.3 (local adapter) → 01.4 (dispatcher) → 01.5 (route + mount)**. The hosted adapter imports the admin client; the dispatcher imports both adapters; the route depends on the dispatcher bundle.
- Phase 05's hosted-mode walk (US-1, US-5) requires a Supabase preview deploy with `SUPABASE_SERVICE_ROLE_KEY` set; open a PR before Phase 05 to trigger the preview build, or coordinate with the operator.
- US-5 (cross-device) has no dedicated production-code task beyond Phase 02's `handleAuthFailure` + hook — it is realized by that hook plus the existing `onAuthStateChange` path; it is verified in Phase 05.

**FR coverage**: every FR in [spec.md](spec.md) maps to at least one task below — see the FR tags on each task and [checklists/plan-review.md](checklists/plan-review.md).

---

## Phase 01 — Backend

### [X] Task 01.1 — Service-role admin client factory

**Target file** (new): [server/repositories/supabase/adminClient.js](../../server/repositories/supabase/adminClient.js)

**What to do**:

1. Export `createSupabaseAdminClient()` that returns `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })`.
2. Mirror the structure/comment style of [server/repositories/supabase/client.js](../../server/repositories/supabase/client.js), but document that this client uses the **service-role** key, bypasses RLS, and is **server-only** — it must never be imported into anything that reaches the Vite bundle.
3. This module is imported **lazily** (only on the delete path, by Task 01.2), never at top level on any boot path.

**Expected behavior**: returns a Supabase client capable of `auth.admin.deleteUser(id)`.

**Constraints**:
- `SUPABASE_SERVICE_ROLE_KEY` is already required in hosted mode by [server/config.js:38](../../server/config.js#L38) — do not re-validate here.
- No module-level client; construct per call (or memoize lazily inside the delete adapter, not at import time).
- FR-007, FR-009, SC-008.

**Validation**:
- Covered indirectly by the adapter test (Task 01.2) which stubs/mocks this factory.
- [tests/server/repositories/supabase/account.test.js](../../tests/server/repositories/supabase/account.test.js) — assert the admin client is used (not the per-request JWT client) for the delete call.

**Out of scope**: password verification (Task 01.2), the per-request anon client (unchanged `client.js`).

---

### [X] Task 01.2 — Hosted `account` adapter (password verify + admin delete)

**Target file** (new): [server/repositories/supabase/account.js](../../server/repositories/supabase/account.js)

**What to do**:

1. Export `createSupabaseAccountRepository({ userId, email })` returning `{ delete(body) }` (uniform method name across adapters; reads `body.password`).
2. `delete(body)`:
   a. If `body?.password` is missing/empty → `throw Object.assign(new Error('Password is required.'), { code: 'VALIDATION_ERROR', status: 400 })`.
   b. **Verify**: lazily import `@supabase/supabase-js`, construct a throwaway anon client (`createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })`), call `auth.signInWithPassword({ email, password: body.password })`. On error → `throw Object.assign(new Error('Incorrect password.'), { code: 'INVALID_PASSWORD', status: 401 })`. **No admin call runs.**
   c. **Delete**: lazily import [adminClient.js](../../server/repositories/supabase/adminClient.js) (Task 01.1), call `auth.admin.deleteUser(userId)`. On error → rethrow (route maps to 500).
   d. Return `{ deleted: true }`.
3. `email` is the JWT `email` claim — confirmed available as `req.user.email` ([server/auth/middleware.js:54](../../server/auth/middleware.js#L54)).

**Expected behavior**: wrong password never deletes; correct password → auth user deleted → cascade removes `applications` + `profile` + `user_seed_state` (data-model.md §1).

**Constraints**:
- Never log `password` (FR-007a).
- Use lazy imports (no top-level `@supabase/supabase-js`) consistent with [server/repositories/index.js](../../server/repositories/index.js) discipline.
- Do not reuse the per-request JWT client for the admin call — the JWT lacks admin scope.
- FR-004, FR-005, FR-006, FR-007, FR-007a, FR-008.

**Validation**:
- [tests/server/repositories/supabase/account.test.js](../../tests/server/repositories/supabase/account.test.js) — mock the anon + admin clients; assert: missing password → `VALIDATION_ERROR`; wrong password (signIn error) → `INVALID_PASSWORD` and admin.deleteUser NOT called; correct password → `admin.deleteUser(userId)` called exactly once; password never appears in any logged output.

**Out of scope**: local clear (Task 01.3); route-level status mapping (Task 01.5).

---

### [X] Task 01.3 — Local `account` adapter (`delete` → clear all)

**Target file** (new): [server/repositories/account.js](../../server/repositories/account.js) (SQLite-side, alongside [server/repositories/applications.js](../../server/repositories/applications.js))

**What to do**:

1. Export `createSqliteAccountRepository(db)` returning `{ delete(body) }` (uniform method name across adapters; reads `body.confirm`).
2. `delete(body)`:
   a. If `body?.confirm !== 'DELETE'` → `throw Object.assign(new Error('Confirmation required.'), { code: 'VALIDATION_ERROR', status: 400 })`. This gates the destructive clear at the API boundary, not UI-only (research.md R-6 / FR-005).
   b. Run a single transaction clearing both tables:
   ```js
   const clear = db.transaction(() => {
     db.prepare('DELETE FROM applications').run();
     db.prepare('DELETE FROM profile').run();
   });
   clear();
   return { cleared: true };
   ```
3. Confirm the local table names against [server/db/applications.js](../../server/db/applications.js) and [server/db/profile.js](../../server/db/profile.js) before writing the SQL.

**Expected behavior**: with `confirm: 'DELETE'`, both `applications` and `profile` are emptied (all-or-nothing); without it, a `400 VALIDATION_ERROR` and nothing is cleared.

**Constraints**:
- Single `db.transaction(...)` — no partial clear (FR-023).
- The `confirm` check runs **before** the transaction — a missing/wrong token clears nothing (FR-005).
- No re-seed (spec D2).
- Do not touch the deprecated `localStorage` legacy store (research.md R-6).
- FR-005, FR-015, FR-017, FR-023. (FR-016 — app stays mounted / empty states — is a client concern owned by Task 03.2.)

**Validation**:
- [tests/server/repositories/account.test.js](../../tests/server/repositories/account.test.js) — seed an in-memory SQLite db with applications + a profile row: `delete({ confirm: 'DELETE' })` empties both tables and returns `{ cleared: true }`; `delete({})` and `delete({ confirm: 'nope' })` throw `VALIDATION_ERROR` and leave both tables intact.

**Out of scope**: hosted adapter (Task 01.2).

---

### [X] Task 01.4 — Wire `account` into the repository dispatcher

**Target file**: [server/repositories/index.js](../../server/repositories/index.js)

**What to do**:

1. **Hosted** ([index.js:38-47](../../server/repositories/index.js#L38-L47)): in `forRequest(req)`, add `account: createSupabaseAccountRepository({ userId: req.user?.id, email: req.user?.email })` to the returned bundle. Add the lazy import of `./supabase/account.js` to the existing `Promise.all([...])` import block.
2. **Local** ([createSqliteRepositories](../../server/repositories/index.js#L68-L81)): add `account: createSqliteAccountRepository(db)` to the returned bundle and the lazy import of `./account.js`.

**Expected behavior**: `req.repos.account` is present in both runtimes with a uniform `delete(body)` method.

**Constraints**:
- Preserve the lazy-import pattern (no top-level adapter imports).
- Do not change `applications` / `profile` wiring.
- FR-002 (per-mode behavior) / Scope "Mode parity of the surface" — `account` must exist in both runtimes.

**Validation**:
- Exercised by the route tests (Task 01.5) via `createApp` with stubbed repos; integration covered there.

**Out of scope**: route handler (Task 01.5).

---

### [X] Task 01.5 — `DELETE /api/account` route + mount

**Target files** (new): [server/routes/account.js](../../server/routes/account.js); (modify) [server/index.js](../../server/index.js)

**What to do**:

1. New `createAccountRouter({ repos, requireAuth })`:
   - `if (requireAuth) router.use(requireAuth);`
   - `router.use(attachRepos(repos));`
   - **Do NOT mount `seedHostedUserIfNeeded`** (research.md R-3) — and therefore do not accept it as a dep.
   - `router.delete('/', async (req, res, next) => { ... })`:
     - `const result = await req.repos.account.delete(req.body ?? {});` (pass the whole body — hosted reads `password`, local reads `confirm`).
     - `return res.status(200).json({ data: result });`
     - In `catch (err)`: if `err.status` is set (typed adapter error), respond `res.status(err.status).json({ error: { code: err.code, message: err.message } })`; else `next(err)` (→ global 500 handler).
2. In [server/index.js](../../server/index.js), mount it alongside the others (near [index.js:57-76](../../server/index.js#L57-L76)):
   ```js
   app.use('/api/account', createAccountRouter({ repos: repositories, requireAuth }));
   ```
   Note: pass `requireAuth` (undefined in local mode by existing convention) but **not** `seedHostedUserIfNeeded`.

**Expected behavior**: matches [contracts/api.md](contracts/api.md) — 200 on success; 400 `VALIDATION_ERROR` (hosted: missing password / local: missing-or-wrong `confirm`); 401 `INVALID_PASSWORD` (wrong password); 401 `UNAUTHORIZED` (no/invalid JWT, from `requireAuth`); 500 `INTERNAL_ERROR` (admin/transaction failure).

**Constraints**:
- The handler is runtime-agnostic — no `config.runtime` branching (adapters carry runtime behavior).
- No `:id` param — the target is always the caller (FR-006).
- **Logging (FR-022)**: do not log the request body or any user-identifying data. If a deletion event is logged at all, log only a non-identifying marker (e.g. `[account] delete ok`) — never the email, user id, or password.
- FR-006, FR-012, FR-020 (error surface), FR-022 (no user-identifying logs).

**Validation**:
- [tests/server/account.test.js](../../tests/server/account.test.js) (new, follow [tests/server/profile.test.js](../../tests/server/profile.test.js) + [tests/server/routes-protected.test.js](../../tests/server/routes-protected.test.js) patterns, using `createApp` with a stubbed `account` repo):
  - Hosted: requires auth (401 `UNAUTHORIZED` without a valid token); success → 200 `{ data: { deleted: true } }`, stub `delete` called once with the body; wrong password (stub throws `INVALID_PASSWORD`) → 401 with that code; missing password → 400 `VALIDATION_ERROR`.
  - Local-style (no `requireAuth`): success with `{ confirm: 'DELETE' }` → 200 `{ data: { cleared: true } }`; missing/wrong `confirm` (stub throws `VALIDATION_ERROR`) → 400.
  - **Assert the route does NOT invoke seed middleware** (stub `seedHostedUserIfNeeded` is not wired / not called).

**Out of scope**: client (Phase 02), UI (Phase 03).

---

## Phase 02 — Client data layer

### [X] Task 02.1 — `api.deleteAccount()` + demo no-fetch branch

**Target file**: [src/services/api.js](../../src/services/api.js)

**What to do**:

1. Add (the caller passes the mode-appropriate body — hosted `{ password }`, local `{ confirm: 'DELETE' }`):
   ```js
   export function deleteAccount(payload = {}) {
     if (isDemo()) return fromDemo(() => { throw { code: 'DEMO_UNAVAILABLE', message: 'Account deletion is not available in the demo.' }; });
     return request('DELETE', '/api/account', payload);
   }
   ```
2. Keep the demo branch **no-fetch** (per the canonical seam comment at [api.js:55-63](../../src/services/api.js#L55-L63)).

**Expected behavior**: hosted/local → `DELETE /api/account` with the passed body; demo → rejects without any `fetch`.

**Constraints**:
- Match the existing export style ([archive/unarchive at api.js:107-115](../../src/services/api.js#L107-L115)).
- FR-018, FR-019 (demo no-fetch invariant).

**Validation**:
- [tests/services/api.test.js](../../tests/services/api.test.js) — `deleteAccount({ password: 'pw' })` issues `DELETE /api/account` with `{ password: 'pw' }`; `deleteAccount({ confirm: 'DELETE' })` sends `{ confirm: 'DELETE' }`.
- [tests/services/api.demo.test.js](../../tests/services/api.demo.test.js) — in demo, `deleteAccount` rejects and `globalThis.fetch` is **not** called.

**Out of scope**: the auth-failure hook (Task 02.3).

---

### [X] Task 02.2 — `authStore.handleAuthFailure()` session revalidation + reroute notice

**Target files**: [src/data/authStore.js](../../src/data/authStore.js), [src/main.js](../../src/main.js)

**What to do**:

1. Export `async function handleAuthFailure()`:
   - If `!isHostedAuthAvailable` or current status is `demo`/`local-mode` → return (nothing to revalidate).
   - Call `const { data, error } = await supabase.auth.getUser();`
   - If `error` or `!data?.user` → the account/session is no longer valid: set a one-shot notice (`ACCOUNT_DELETED_NOTICE = 'Your account no longer exists.'`) then call `await signOut()` (which triggers `onAuthStateChange(null)` → `unauthenticated` → Welcome) so the user is rerouted.
   - If a valid user is returned → no-op (avoids spurious sign-outs on transient errors); swallow transient `getUser()` rejections.
2. Guard against re-entrancy (a module flag) so a burst of failed requests triggers at most one `getUser()` round-trip.
3. Carry the message UI-free: export `setAuthNotice(message, type)` + `consumeAuthNotice()` (one-shot, returns `{ message, type } | null`) from authStore; **do not** import Toast into the data layer. The same carrier serves both the involuntary deleted-account reroute (`type: 'error'`) and the voluntary account-deletion success confirmation (`type: 'success'`, staged by Task 03.2) — both must survive the reroute that clears `document.body`.
4. Display it on the reroute: `src/main.js` `mountWelcome()` calls `authStore.consumeAuthNotice()` after mounting Welcome and, if non-null, `Toast.show(notice.message, notice.type)`. A normal/voluntary sign-out (e.g. the Navbar button) leaves the notice null → no toast (the Navbar shows its own "Signed out" toast).

**Expected behavior**: a stale session whose account was deleted gets signed out + rerouted on the next failed request; a still-valid session is untouched.

**Constraints**:
- Reuse existing `signOut()` ([authStore.js:67-71](../../src/data/authStore.js#L67-L71)) and the `onAuthStateChange` reroute already wired in `init()` ([authStore.js:53-64](../../src/data/authStore.js#L53-L64)).
- FR-011a; complements the existing `onAuthStateChange` catch-all (FR-011b — no new code).

**Validation**:
- [tests/data/authStore.test.js](../../tests/data/authStore.test.js) — mock `supabase.auth.getUser`: returns no user → `handleAuthFailure()` calls `signOut` and `consumeAuthNotice()` returns `ACCOUNT_DELETED_NOTICE` once (then null); returns a user → no `signOut`, no notice; transient rejection → no `signOut`; in `local-mode`/`demo` → no `getUser` call.
- [tests/main.test.js](../../tests/main.test.js) — rerouting to Welcome with a pending notice shows a `.toast`; a normal sign-out (no notice) shows none.

**Out of scope**: deciding *when* to call it (Task 02.3).

---

### [X] Task 02.3 — Wire the auth-failure hook into `request()`

**Target file**: [src/services/api.js](../../src/services/api.js)

**What to do**:

1. In `request()` ([api.js:7-53](../../src/services/api.js#L7-L53)), when `!response.ok` and a `token` was sent, after building the thrown error, invoke `authStore.handleAuthFailure()` **only** when the failure indicates a possibly-dead session:
   - `error.code === 'UNAUTHORIZED'` (expired/invalid JWT), OR
   - `response.status === 404` (a stale session's data request can 404 when the rows are gone — spec Edge Cases / FR-011a), OR
   - `response.status === 500` (the delete-race manifests as a seed-middleware FK-violation 500 — research.md R-4).
   - `error.code === 'INVALID_PASSWORD'` — a stale session whose account was deleted elsewhere gets this from the delete endpoint's password recheck even with a *correct* password. Safe to revalidate: `getUser()` no-ops for a genuine wrong-password attempt (account still exists) so the inline modal error stands; it reroutes only if the account is gone.
   - **Do NOT** trigger on `400 VALIDATION_ERROR`. A legitimate 404/500 (or wrong password) for a still-valid user is a harmless no-op (`getUser()` succeeds → no sign-out).
2. Fire-and-forget (do not await before throwing) so the original rejection still propagates to the caller; `handleAuthFailure` runs in parallel and reroutes if appropriate.
3. `authStore` is already imported by `api.js` ([api.js:1](../../src/services/api.js#L1)) — no new import cycle.

**Expected behavior**: a deleted-account session's next authenticated request (`UNAUTHORIZED` / `INVALID_PASSWORD` / 404 / 500) reroutes to Welcome; a genuine wrong-password attempt stays in the modal (revalidation no-ops); a 400 validation error never signs the user out.

**Constraints**:
- Only when `token` is present (skip local/demo).
- FR-011a; must not regress ordinary error handling.

**Validation**:
- [tests/services/api.test.js](../../tests/services/api.test.js) — spy on `authStore.handleAuthFailure`: triggered on `UNAUTHORIZED`, `INVALID_PASSWORD`, a 404, and a 500 (with token); NOT triggered on a 400, or when no token is present.

**Out of scope**: UI wiring (Phase 03).

---

## Phase 03 — UI (US-1…US-4)

### [X] Task 03.1 — Deletion confirmation modal component

**Target files** (new): a modal under [src/components/](../../src/components/) (e.g. `DeleteAccountModal.js`), reusing [src/components/Modal.js](../../src/components/Modal.js); reference [src/components/ConfirmDialog.js](../../src/components/ConfirmDialog.js) for structure.

**What to do**:

1. A modal that accepts a `mode` (`'hosted'` | `'local'`) and an `onConfirm(value)` callback:
   - **Hosted**: serious-but-non-alarming warning copy (permanent, unrecoverable, all hosted data removed); a labeled **password** input (`type="password"`, `autocomplete="current-password"`); destructive "Delete account" button **disabled while the field is empty**.
   - **Local**: warning copy scoped to local data; a labeled text input; destructive "Clear all data" button **enabled only when the value is exactly `DELETE`**.
2. Cancel via an explicit Cancel button, Esc, and backdrop click — all close without acting (FR-005a).
3. Show an inline error region for a returned `INVALID_PASSWORD` (hosted) and an in-flight/loading state on the destructive button while the request runs (FR-020).
4. Focus management: focus the input on open; trap focus; restore focus to the trigger on close (FR-021).

**Expected behavior**: matches FR-003, FR-004, FR-005, FR-005a, FR-020, FR-021.

**Constraints**:
- Destructive action not signaled by color alone (label/icon too) (FR-021).
- No deletion logic in the modal — it only collects the gate value and reports loading/error; the caller (Task 03.2) calls `api.deleteAccount`.

**Validation**:
- [tests/components/](../../tests/components/) (new test for the modal, jsdom) — hosted: button disabled until password non-empty; local: button enabled only on exact `DELETE`; Esc/backdrop/Cancel close without firing `onConfirm`; `INVALID_PASSWORD` renders the inline error.

**Out of scope**: section placement (Task 03.2); network call (handled by caller).

---

### [X] Task 03.2 — Profile **Account** section + post-action handling

**Target file**: [src/pages/Profile.js](../../src/pages/Profile.js)

**What to do**:

1. Add `renderAccountSection(page, { mode, navigate })` and call it after `renderProfileSection` in `mount()` ([Profile.js:560-620](../../src/pages/Profile.js#L560-L620)). Use the existing `createSection('ACCOUNT')` helper ([Profile.js:74-84](../../src/pages/Profile.js#L74-L84)).
2. Resolve `mode` from `authStore.getAuthState().status`: `authenticated` → hosted; `local-mode` → local; `demo` → disabled.
3. Render the control per mode (FR-002):
   - **Hosted**: enabled "Delete account" button → opens the modal in `'hosted'` mode. On confirm → `api.deleteAccount({ password })`; on success → `authStore.setAuthNotice('Account deleted.', 'success')` then `authStore.signOut()` (→ Welcome). The success confirmation is **staged**, not shown immediately, because the sign-out reroute clears `document.body` and would wipe a toast shown now — `main.js` shows it on the Welcome reroute via `consumeAuthNotice()` (FR-013). On `INVALID_PASSWORD` → keep modal open, show inline error. On other errors → error toast, modal closes, user stays (FR-012, FR-013, FR-010).
   - **Local**: "Clear all data" button → modal in `'local'` mode. On confirm → `api.deleteAccount({ confirm: 'DELETE' })`; on success → `Toast.show('All data cleared.', 'success')` and re-render the Tracker/Profile empty states without a full reload (e.g. `navigate('profile')` re-mount); app stays mounted (FR-014, FR-016).
   - **Demo**: render the button **disabled** with copy ("Account deletion applies to a real hosted account and isn't available in the demo.") — never opens the modal, never calls the API (FR-018, FR-019).
4. Add the section's `aria` labeling and ensure it reads after the Profile section.

**Expected behavior**: matches US-1, US-3, US-4 and FR-001, FR-002, FR-003, FR-010, FR-013, FR-014, FR-016, FR-018, FR-019.

**Constraints**:
- The section is named **"Account"** (not "User Settings") (clarify decision).
- Import `authStore`, `Toast`, `api.deleteAccount`, and the modal from Task 03.1.
- Keep deletion logic out of render helpers where practical; the section wires events only.

**Validation**:
- [tests/pages/Profile.test.js](../../tests/pages/Profile.test.js) — Account section renders in all modes; hosted shows enabled "Delete account"; local shows "Clear all data"; demo shows a disabled control that opens no modal and triggers no `api.deleteAccount`. Mock `authStore.getAuthState` per case.
- A demo-specific assertion may live in a `*.demo.test.js` sibling if that matches the existing split ([tests/pages/ProfileEdit.demo.test.js](../../tests/pages/ProfileEdit.demo.test.js)).

**Out of scope**: the modal internals (Task 03.1); cross-device reroute (Phase 02 + smoke test).

---

### [X] Task 03.3 — Styles for the Account section + modal

**Target files**: [src/styles/](../../src/styles/) (the stylesheet(s) that hold Profile + Modal styles — locate via the existing `profile-*` and modal class names).

**What to do**:

1. Style the Account section to match the existing `section-card` look; style the destructive button as a clearly destructive (but accessible) variant — not color-only (add an icon and/or weight).
2. Style the modal's password/typed-`DELETE` input, the disabled and loading button states, and the inline error region.
3. Verify desktop **and** mobile layouts (FR-021).

**Expected behavior**: visually consistent with the rest of the Profile page; legible destructive affordance on both viewports.

**Constraints**:
- Reuse existing tokens/variables; no new color-only signaling.
- FR-021.

**Validation**:
- Manual visual check in Phase 05 (desktop + mobile). No unit test.

**Out of scope**: behavior (Tasks 03.1, 03.2).

---

## Phase 04 — Release Prep (REQUIRED — constitution Amendment 1.3.0)

### [X] Task 04.1 — Version bump

**Target files**: [package.json](../../package.json) (+ any in-app version display, if present).

**What to do**: bump the version (minor — new user-facing feature). Confirm the current base version on `main` at implementation time and increment from there.

**Validation**: `package.json` version updated; app still boots.

---

### [X] Task 04.2 — CHANGELOG entry

**Target file**: [CHANGELOG.md](../../CHANGELOG.md)

**What to do**: add a `## [<new-version>] — <merge-date>` entry. **Added**: Account section on Profile with permanent account deletion (hosted, password-confirmed) and "Clear all data" (local). **Changed**: first runtime use of `SUPABASE_SERVICE_ROLE_KEY`; client reroutes a stale session to Welcome on a failed authenticated request.

**Validation**: entry present, matches the shipped surface.

---

### [X] Task 04.3 — README updates

**Target file**: [README.md](../../README.md)

**What to do**: document the Account/deletion surface and its per-mode behavior (hosted delete, local clear, demo disabled).

**Validation**: README mentions the new surface accurately.

---

### [X] Task 04.4 — `docs/deployment.md` (service-role runtime use)

**Target file**: [docs/deployment.md](../../docs/deployment.md)

**What to do**: note that `SUPABASE_SERVICE_ROLE_KEY` is now used at **runtime** (not just operator/boot) for account deletion, and that deletion relies on the 019 cascade FKs. No new env var is introduced (the key was already required in hosted mode), but its runtime role is new.

**Validation**: deployment doc reflects the runtime service-role usage.

---

### [X] Task 04.5 — `docs/REPO_MAP.md`

**Target file**: [docs/REPO_MAP.md](../../docs/REPO_MAP.md)

**What to do**: add the new files — `server/routes/account.js`, `server/repositories/supabase/account.js`, `server/repositories/supabase/adminClient.js`, `server/repositories/account.js`, and the new client modal component.

**Validation**: every new file from Phases 01 + 03 is listed.

---

### [X] Task 04.6 — Docs sanity check

**What to do**: re-read spec/plan/contracts against the final code; confirm endpoint shape, error codes, and per-mode behavior match what shipped; fix drift.

**Validation**: no contradictions between docs and code.

---

## Phase 05 — Browser Smoke Test (REQUIRED — UI feature; constitution Amendments 1.1.0 + 1.3.0)

> Walk each Independent Test in a real browser against the to-be-merged state. Hosted walks require a Supabase preview deploy with `SUPABASE_SERVICE_ROLE_KEY` set; use a disposable account.

### [X] Task 05.1 [US-1/US-2] Hosted delete + password gate
Open Profile → Account → Delete account. Empty password → disabled. Wrong password → error, data intact. Correct password → signed out, Welcome page, toast `Account deleted.`. Verify in Supabase: 0 rows in `applications`/`profile`/`user_seed_state` for the old id; `auth.users` row gone. Re-signup with the same email → fresh empty account.
**PASS.** Finding fixed: modal now locks background scroll while open (`document.body.style.overflow = 'hidden'`, restored on close) — matches the Application Overlay.

### [X] Task 05.2 [US-3] Local clear all data
Local mode with seeded data → Account → Clear all data. Non-`DELETE` text → disabled; `DELETE` → enabled → confirm → toast `All data cleared.`; Tracker + Profile show empty states; still in-app (no Welcome redirect).

### [X] Task 05.3 [US-4] Demo disabled control
Enter demo → Profile → Account. Control visible but disabled; activating it opens no modal and makes no network request (check Network tab).

### [X] Task 05.4 [US-5] Cross-device reroute
Sign in on two browsers; delete from A. In B, edit an application → action fails and B reroutes to Welcome with the "account no longer exists" message (FR-011a). (Optionally verify the idle path: leave B until token refresh fails → reroutes via `onAuthStateChange`.)

### [X] Task 05.5 Mobile layout
Repeat US-1 (hosted) and US-3 (local) on a mobile viewport; confirm the Account section, button, and modal are usable and legible.

### [X] Task 05.6 No regressions
Confirm the existing Profile sections (Welcome, Applications, Profile) and the Navbar Sign out / Exit demo behave as before.
