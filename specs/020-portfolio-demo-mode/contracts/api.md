# Client Contracts — Portfolio Demo Mode (020)

This feature is frontend-only. There are no new HTTP endpoints, no
schema changes, and no protocol changes. "API" in this document refers
to internal module-level contracts: the small set of functions other
modules import.

---

## 1. `src/data/demoStore.js`

A new module-level data layer for the demo. Mirrors the shape of
`src/services/api.js` so the service-layer switch (§3) is a simple
delegate.

### Exports

```js
export function loadSeed(): void
export function clear(): void
export function getAll(): Application[]
export function getById(id: number): Application | undefined
export function create(fields: Partial<Application>): Application
export function update(id: number, fields: Partial<Application>): Application
export function archive(id: number): Application
export function getProfile(): Profile | null
export function saveProfile(profile: Profile): Profile
```

### Behavior

- All reads return **deep clones** of the underlying state.
- `loadSeed()` replaces the entire in-memory state from
  `buildDemoSeed()`. Idempotent — safe to call multiple times. Used by
  `authStore.enterDemo()`.
- `clear()` resets `_applications = []` and `_profile = null`. Used by
  `authStore.exitDemo()`.
- `create` assigns the next id (`max(existing ids) + 1`, starting at
  the highest seeded id + 1), runs the input through
  `normalizeApplication` + `validateApplication`, prepends to the list.
- `update` merges `fields` into the existing row, re-normalizes and
  re-validates, returns the cloned row. If `fields.status` differs from
  the row's current status, `lastStatusUpdate` is set to today (parity
  with the server-side adapter contract from 019).
- `archive` removes the row from `_applications`; returns the row
  pre-removal (so callers can show "Archived <X>" toasts).
- `getProfile` returns a deep clone or `null`.
- `saveProfile` normalizes + validates + replaces `_profile`.

### Errors

Validation errors throw the same `{ code, message, fields }` shape
`src/services/api.js` throws from a 400 response. Modal, Tracker, and
ProfileEdit handle this shape today and continue to work without
changes.

---

## 2. `src/data/authStore.js`

The new `'demo'` status plus two new transition functions.

### Additions

```js
export const DEMO_STATUS = 'demo';

export function enterDemo(): void
// 1. demoStore.loadSeed()
// 2. state = { status: 'demo', user: null, accessToken: null }
// 3. notify()

export function exitDemo(): void
// 1. demoStore.clear()
// 2. state = { status: 'unauthenticated', user: null, accessToken: null }
// 3. notify()
```

### `init()` behavior in demo context

`init()` is unchanged. On boot, the resulting status is one of
`'local-mode' | 'authenticated' | 'unauthenticated'`. Demo cannot be
re-entered automatically: refresh ends every demo session by design.

### `signOut()` behavior in demo

`signOut()` is currently a thin wrapper around `supabase.auth.signOut()`.
In demo there is no Supabase session to clear, so callers in demo
should use `exitDemo()` instead. The Navbar's identity-cluster
rendering routes by `state.status` and never calls `signOut()` while in
demo, so no conflict arises.

### `getAccessToken()` in demo

Returns `null` (the state object's `accessToken` is `null` in demo).
This means `services/api.js`'s `Authorization: Bearer …` header is
never set in demo — additional defense in depth against accidental
authenticated requests.

---

## 3. `src/services/api.js` and `src/services/resumeApi.js`

The service-layer mode switch is a single pattern applied to every
exported function.

### Pattern (illustrative)

```js
// src/services/api.js
import { DEMO_STATUS, getAuthState } from '../data/authStore.js';
import * as demoStore from '../data/demoStore.js';

function isDemo() {
  return getAuthState().status === DEMO_STATUS;
}

export function getAll() {
  if (isDemo()) return Promise.resolve(demoStore.getAll());
  return request('GET', '/api/applications');
}

export function create(fields) {
  if (isDemo()) {
    return new Promise((resolve, reject) => {
      try { resolve(demoStore.create(fields)); } catch (err) { reject(err); }
    });
  }
  return request('POST', '/api/applications', fields);
}
// … same pattern for getById, update, archive, getProfile, saveProfile
```

### Why `Promise.resolve` / `new Promise(...)`

`Tracker.js`, `Modal.js`, `Profile.js`, and `ProfileEdit.js` all
`await` the service calls. Wrapping the synchronous demoStore
returns in a Promise preserves the existing call shape so pages need
zero changes.

### `resumeApi.parseResume(file)` in demo

```js
export async function parseResume(file) {
  if (getAuthState().status === DEMO_STATUS) {
    throw {
      code: 'DEMO_FEATURE_UNAVAILABLE',
      message: 'Resume import is available after signing in.',
    };
  }
  // existing implementation
}
```

In practice this throw is defense in depth: `ResumeImport` is hidden
in demo (§5), so the function should not be called. The throw exists
so that a future surface that forgets to gate visibility fails loudly
instead of attempting `/api/resume/parse`.

### Network discipline (test contract)

A unit test MUST assert that no service function in `api.js` or
`resumeApi.js` calls `globalThis.fetch` when `authStore` is in demo
status. This is the canonical regression guard against a new method
forgetting the demo branch.

---

## 4. `src/main.js` routing

`render(state)` adds one case:

```js
if (state.status === 'local-mode' || state.status === 'authenticated' || state.status === 'demo') {
  mountAppShell();
  return;
}
if (state.status === 'unauthenticated') {
  mountWelcome();
}
```

The dev-time `SEED_DATA` seed inside `mountAppShell()` (the existing
`store.save(SEED_DATA)` block for first-time local users) MUST NOT
fire in demo. Today the block is gated on `!hasStoredApplications &&
store.getAll().length === 0`; in demo `store` is the legacy local
store and is untouched, so the gate still passes. To prevent any
accidental write through the legacy store, the gate is tightened to
also require `state.status !== 'demo'`. (Or the seed block is left as
is and the legacy `store` is simply not consulted by any demo code
path; either resolution is acceptable and the tasks phase picks one.)

---

## 5. `src/components/ResumeImport.js`

**No code changes.** The existing visibility gate is:

```js
const VISIBLE_STATUSES = new Set(['local-mode', 'authenticated']);
```

The new `'demo'` value is intentionally not added. The component is
hidden whenever `getAuthState().status === 'demo'`. A unit test asserts
this (since the behavior is by construction, the test guards against a
future refactor that broadens the set).

---

## 6. `src/pages/ProfileEdit.js`

Adds an inline note in the slot where `ResumeImport` mounts. Shape:

```js
if (authState.status === 'demo') {
  slot.append(renderResumeImportDemoNote());
} else if (VISIBLE_STATUSES.has(authState.status)) {
  ResumeImport.mount(slot, …);
}
```

`renderResumeImportDemoNote()` returns a small DOM node with a one-line
message (exact copy in tasks phase). Class name placeholder:
`profile-edit__resume-demo-note`.

---

## 7. `src/components/Navbar.js`

`renderIdentityCluster(state)` extends to handle the demo case:

```js
if (state.status === 'demo') {
  _identityCluster.hidden = false;
  // Optional "Demo mode" badge (plan-review decision)
  const badge = el('span', 'topbar-demo-badge', 'Demo mode');
  const exit = button('Exit demo', 'signout-btn', () => authStore.exitDemo(), {
    'aria-label': 'Exit demo',
  });
  _identityCluster.append(badge, exit);
  return;
}
// existing authenticated branch …
```

### Accessibility

- Exit demo button has an `aria-label` of `"Exit demo"`.
- Tab order: badge (non-focusable text) → existing nav buttons → Exit
  demo, matching the current Sign-out button placement.
- The badge is not announced as a status by default; if the plan-review
  decision is to surface mode visually, `role="status"` may be added in
  tasks phase.

---

## 8. `src/pages/welcome/demoStub.js`

Replaces the existing `showDemoComingSoon()` export.

### New shape

```js
import { enterDemo as authEnterDemo } from '../../data/authStore.js';

export function enterDemo() {
  authEnterDemo();
}
```

A wrapper rather than a direct re-export, so tests can stub `enterDemo`
at the welcome-CTA boundary independently of `authStore`.

### Removed

`showDemoComingSoon()` is removed. `WelcomePage.js` and
`AuthOverlay.js` update their imports to the new symbol.

---

## 9. Test contracts (summary)

The following automated contracts MUST pass before merge:

1. **No-network in demo**: `tests/services/api.demo.test.js` and
   `tests/services/resumeApi.demo.test.js` spy on `globalThis.fetch`
   and assert zero calls across every exported function.
2. **No persistent demo storage**: `tests/data/demoStore.test.js`
   asserts that demoStore methods do not call `localStorage.setItem`,
   `sessionStorage.setItem`, or `indexedDB.open` (spy assertions).
3. **State machine**: `tests/data/authStore.demo.test.js` asserts the
   transitions in §2.
4. **Visibility**: `tests/components/ResumeImport.demo.test.js` asserts
   the upload affordance is not rendered when status is `'demo'`.
5. **Navbar**: `tests/components/Navbar.demo.test.js` asserts the Exit
   demo button renders in demo and calls `authStore.exitDemo()` on
   click.

These five tests collectively cover SC-001 through SC-010.
