# Implementation Plan: Portfolio Demo Mode (020)

**Branch**: `020-portfolio-demo-mode` | **Date**: 2026-05-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/020-portfolio-demo-mode/spec.md`
**Depends on**: [017-hosted-foundation](../017-hosted-foundation/spec.md) (runtime contract, hosted deploy), [018-auth-user-access](../018-auth-user-access/spec.md) (`requireAuth` defense-in-depth, authStore shape), [019-supabase-persistence](../019-supabase-persistence/spec.md) (`local` + `hosted` dispatcher branches consumed unchanged; the `demo` branch reserved by 019 is removed by this feature, see FR-016)

---

## Summary

Replace the welcome-page **Try the demo** placeholder
(`src/pages/welcome/demoStub.js#showDemoComingSoon`) with a real, in-browser
demo experience that runs inside the existing hosted deploy. The demo is
purely client-side: no Supabase calls, no server-side demo backend.
State lives in module-level JS for one tab session and is reset by
browser refresh (refresh triggers a fresh `bootstrap()`, which calls
`authStore.init()`, which has no persistent demo flag to restore — the demo
session is gone).

Because the demo no longer needs server-side persistence, the
`APP_RUNTIME=demo` routing slot reserved by 019 — its `createDemoStub`
helper, `DemoRepositoryNotImplementedError`, the config loader's
`'demo'` valid value, the `config.isDemo` flag, the
`assertHostedSchema` short-circuit, and the tests covering all of them
— is dead code and is removed by this feature (FR-016). Post-020 the
server only knows about two runtimes: `local` and `hosted`.

Concretely this introduces:

1. A new client-side **demo data adapter** (`src/data/demoStore.js`) holding
   the demo's applications and profile in module-level state. CRUD helpers
   mirror the shape returned by the existing API service so callers do not
   need to know about the demo.
2. A **demo seed fixture** (`src/data/demoSeed.js`) that mirrors the
   23-record `DEMO_RECORDS` array from `server/db-seed.js` and the
   `DEMO_PROFILE` from `server/db-seed-profile.js` — translated from
   SQLite storage shape to the frontend shape (camelCase keys, arrays
   instead of JSON-strings, snake_case DB columns dropped). Application
   dates are shifted to be relative to "today" so the demo never reads
   as stale; profile biographical dates stay static. The fixture is a
   separate file (not a `shared/` extraction) — see
   [research.md §13](research.md) for the keep-duplicate-for-now
   rationale.
3. A **demo mode signal** added to `src/data/authStore.js`: a new `'demo'`
   status, `enterDemo()`, and `exitDemo()`. Refresh reloads the bundle and
   `authStore.init()` re-runs from scratch with no demo state to recover, so
   the visitor returns to `'unauthenticated'` (welcome page). No
   sessionStorage, no localStorage, no cookie writes for demo data.
4. A **request-time mode switch** inside `src/services/api.js` and
   `src/services/resumeApi.js`: when `authStore.getAuthState().status ===
   'demo'`, every function delegates to `demoStore` (or throws a controlled
   "not available in demo" error for resume parsing) instead of calling
   `fetch`. The page layer is unchanged.
5. **Welcome-page CTA rewiring**: `src/pages/welcome/demoStub.js` replaces
   its `showDemoComingSoon()` toast with `enterDemo()`. The auth modal's
   "Try the demo" button (`src/pages/welcome/AuthOverlay.js`) goes through
   the same call.
6. **Routing changes in `src/main.js`**: the `'demo'` status mounts the same
   app shell as `'authenticated'` and `'local-mode'`. The shell uses
   `demoStore` for reads/writes via the service layer's mode switch.
7. **Navbar exit affordance** (`src/components/Navbar.js`): in demo, the
   identity cluster renders an **Exit demo** button that calls
   `authStore.exitDemo()`. No email is shown (no user is signed in).
8. **Resume Import gating**: `src/components/ResumeImport.js` already gates
   visibility via `VISIBLE_STATUSES = new Set(['local-mode', 'authenticated'])`.
   Demo's new `'demo'` status is intentionally not added to that set, so the
   upload affordance is hidden inside demo. `ProfileEdit.js` renders a small
   inline placeholder note in its place explaining that resume import is
   available after sign-in (the brief's "disabled with messaging" alternative,
   applied to the surrounding slot rather than the upload control itself).

Server-side changes in this feature are two narrow categories: (a) the
**deletion** of the 019 demo-slot scaffolding (`APP_RUNTIME=demo`
config value, `DemoRepositoryNotImplementedError`, `createDemoStub`,
the dispatcher's demo branch, the `assertHostedSchema` short-circuit,
and the related tests/docs); and (b) a small **data-only extraction**
of `DEMO_RECORDS` and `DEMO_PROFILE` into side-effect-free modules
under `server/seeds/` so the client-side demo seed's parity test can
import them without triggering DB opens or `process.exit` at module
load (Task 02.0). No new server endpoints, no new server-side data
flow, no changes to repositories, routes, or the hosted runtime. The
hosted deploy continues to run with `APP_RUNTIME=hosted`. 018's
`requireAuth` on every protected route is the defense-in-depth
guarantee that even a tampered client cannot reach hosted data via
demo paths — demo requests carry no JWT and would be rejected with
401 on any accidental network call.

---

## Technical Context

**Language/Version**: Node.js ≥ 20.19.0, JavaScript (ESM)
**Primary Dependencies**: Vite 8 (bundler), Vitest 4 (tests). **No new
dependencies** for either runtime or test. No new server packages.
**Storage**: None. Demo state is module-level JS only. No `localStorage`,
`sessionStorage`, IndexedDB, cookies, or Supabase reads/writes for demo
content. The tracker's existing `apptracker_filters` localStorage key (used
by `src/pages/Tracker.js`) is **gated** for demo sessions — Task 05.4
applies an early-return on `status === 'demo'` inside both
`persistFilterState` and `loadPersistedFilterState`, so demo sessions
write zero project-namespaced `localStorage` keys and start with the
default filter state. The storage audit (Task 08.2) verifies the
zero-write outcome.
**Testing**: Vitest, jsdom environment for component-level tests, mocked
`fetch` to assert demo paths make zero network calls.
**Target Platform**: Hosted Vercel deploy (browsers: desktop + mobile, the
same matrix the authenticated experience supports).
**Project Type**: Web application — Vite frontend + Express API. **The demo
is frontend-only.**
**Constraints**:
- Demo writes MUST NOT call `/api/applications`, `/api/profile`, or
  `/api/resume/parse`. The service-layer mode switch (`getAuthState().status
  === 'demo'`) is the single check; below it `fetch` is never reached for
  demo writes.
- Demo state MUST NOT be written to `localStorage`, `sessionStorage`,
  IndexedDB, or cookies. Anything that *is* written there during a demo
  (e.g. `apptracker_filters`) MUST be preferences, not demo content.
- Validation logic MUST be reused unchanged from
  `src/models/application.js`. No demo-specific validation rules.
- 019's hosted code paths MUST be byte-equivalent. The dispatcher's hosted
  branch, the seed middleware, the Supabase adapters, and the `requireAuth`
  middleware are not touched.
**Scale/Scope**: Single hosted deploy, many concurrent demo visitors. Each
tab is a fully independent session. No server resources are consumed by
demo browsing.

---

## Architecture

```text
┌──────────────────────────── Browser ──────────────────────────────────┐
│                                                                       │
│  bootstrap()                                                          │
│    └─ runtimeHandshake() — unchanged                                  │
│    └─ authStore.init()                                                │
│           if !hostedAuthAvailable → status = 'local-mode'             │
│           else (Supabase session?) → 'authenticated' | 'unauth.'      │
│           (no demo restore — refresh always exits demo)               │
│           │                                                           │
│           ▼                                                           │
│  main.js render(state)                                                │
│           'local-mode' | 'authenticated' | 'demo' → app shell         │
│           'unauthenticated' → welcome page                            │
│                                                                       │
│  ┌────────────── Welcome page ────────────────────┐                   │
│  │   "Try the demo" CTA                           │                   │
│  │   demoStub.enterDemo()                         │                   │
│  │     └─ demoStore.loadSeed()                    │                   │
│  │     └─ authStore.enterDemo()  (status='demo')  │                   │
│  └────────────────────────────────────────────────┘                   │
│                          │                                            │
│                          ▼                                            │
│  ┌──────────────── App shell (Tracker, Profile, Calendar) ──────────┐ │
│  │  Pages call api.getAll / api.update / api.getProfile / etc.     │ │
│  │             │                                                   │ │
│  │             ▼                                                   │ │
│  │  src/services/api.js, src/services/resumeApi.js                 │ │
│  │     if status === 'demo' → demoStore.<method>                   │ │
│  │     else → fetch(...) as today                                  │ │
│  │                                                                 │ │
│  │  src/components/ResumeImport.js                                 │ │
│  │     VISIBLE_STATUSES excludes 'demo' → hidden in demo           │ │
│  │  ProfileEdit renders an inline "sign in to use resume import"   │ │
│  │  note in the slot where ResumeImport would mount.               │ │
│  │                                                                 │ │
│  │  src/components/Navbar.js                                       │ │
│  │     status='demo' → "Exit demo" button                          │ │
│  │     onClick → authStore.exitDemo() → status='unauthenticated'   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  refresh (F5 / Cmd-R)                                                 │
│    → entire JS bundle reloads → demoStore module re-initialized       │
│      empty → authStore re-runs init() → 'unauthenticated' →           │
│      welcome page renders                                             │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                          │   (no network for demo)
                          ▼
┌──────────────────── Express API ───────────────────────────────────┐
│  config.js: VALID_RUNTIMES = ['local', 'hosted']                    │
│      (the 'demo' value reserved by 019 is removed in 020)           │
│  repositories/index.js: dispatcher serves 'local' and 'hosted' only │
│      (DemoRepositoryNotImplementedError and createDemoStub deleted) │
│                                                                     │
│  requireAuth (018)                                                  │
│      Rejects any request without a valid JWT → 401                  │
│      Defense in depth: demo carries no JWT, so even an accidental   │
│      network call from the demo path is refused at this layer.      │
│                                                                     │
│  Supabase adapters (019) — unreachable from demo. Hosted users      │
│  continue to operate exactly as in the post-019 baseline.           │
└────────────────────────────────────────────────────────────────────┘
```

### Why a service-layer mode switch (not a swapped service module)

Three architectures were considered for routing reads/writes to the demo
store. See [research.md §1](research.md) for the rejected alternatives.

The chosen approach — branching at the top of every function in
`src/services/api.js` and `src/services/resumeApi.js` — gives the smallest
blast radius. Pages keep their existing imports (`import * as api from
'../services/api.js'`). Modal, Profile, ProfileEdit, Tracker stay byte-
equivalent. The mode switch is one early-return per function in two
service files. Tests can mock `fetch` and `authStore` independently.

### Why module-level state (not sessionStorage)

The spec requires reset-on-refresh. Module-level state in `demoStore.js`
satisfies this for free: refreshing the page reloads the bundle, which
reinitializes the module. `sessionStorage` would *survive* refresh (and
tab restore on some browsers), which would violate FR-005. `localStorage`
would survive even longer. Module-level memory is the simplest mechanism
that matches the requirement and adds zero persistent surface area to audit.

### Why hide Resume Import (vs disable with inline messaging)

Resume Import is a multi-step interactive component (file picker, processing
spinner, three-stage messaging) whose disabled state would still render the
upload widget and an "auth required" caption. That visual is louder than the
brief intends. The chosen approach hides the upload widget entirely (already
gated by `ResumeImport.VISIBLE_STATUSES`) and replaces it with a one-line
inline note inside `ProfileEdit.js`'s slot. The visitor sees that resume
import exists but is not asked to interact with a non-functional control.
See [research.md §3](research.md) for the rejected variants.

### Why `enterDemo()` lives on `authStore` (not a separate `demoStore` flag)

`main.js` already routes on `authStore` status (`'authenticated'`,
`'local-mode'`, `'unauthenticated'`). Adding a separate demo flag would
require every place that asks "what page should I be on?" to consult two
sources. Extending the existing finite state with a fourth value
(`'demo'`) is one source of truth, follows the established pattern, and
makes the Navbar's status-based affordance switch trivial. The actual
data still lives in `demoStore.js`; `authStore` only owns the **mode**
signal. See [contracts/api.md §2](contracts/api.md).

---

## Data Flow

### Entering the demo

1. Visitor on welcome page clicks **Try the demo**.
2. `WelcomePage.js` (or `AuthOverlay.js`'s demo button) calls
   `demoStub.enterDemo()`.
3. `enterDemo()`:
   - Calls `demoStore.loadSeed()` — `demoStore` copies the seed fixture
     into its in-memory state. `applications` becomes an array with seeded
     entries; `profile` becomes a populated object.
   - Calls `authStore.enterDemo()` — sets `state = { status: 'demo', user:
     null, accessToken: null }` and notifies subscribers.
4. Subscribers fire:
   - `main.js render(state)` sees `'demo'` and mounts the app shell.
   - `Navbar` re-renders the identity cluster as an **Exit demo** button.
5. The app shell mounts `Tracker` by default, which calls `api.getAll()`.
6. `api.getAll()` sees `status === 'demo'` and returns `demoStore.getAll()`
   (a defensive clone of the in-memory applications array). No `fetch`.

### Demo CRUD (read + write)

- **Read** (`api.getAll`, `api.getById`, `api.getProfile`): the service
  function returns a clone from `demoStore`. Zero network.
- **Create** (`api.create`): `demoStore.create(fields)` generates a new id
  (max existing id + 1), runs the same `validateApplication` /
  `normalizeApplication` modules the SQLite/Supabase paths use server-side,
  inserts the new row at the head, and returns a clone.
- **Update** (`api.update`): `demoStore.update(id, fields)` finds the row,
  merges fields, re-validates, returns a clone.
- **Archive** (`api.archive`): `demoStore.archive(id)` returns the archived
  row but removes it from the active list (matches the post-019 archive
  semantics — archive deletes from the active list, no archived-list UI is
  exposed today).
- **Profile** (`api.getProfile` / `api.saveProfile`): the seed populates
  `demoStore.profile`; saves write to the same object in memory; reads
  return a defensive clone.
- **Resume parse** (`resumeApi.parseResume`): `status === 'demo'` triggers
  an early throw with `{ code: 'DEMO_FEATURE_UNAVAILABLE', message: 'Resume
  import is available after signing in.' }`. The Resume Import component is
  already hidden in demo, so this throw is defense in depth — the inline
  note in `ProfileEdit.js` replaces the upload UI.

### Refresh / reset

1. Visitor presses F5. The browser reloads the page.
2. The JS bundle reinitializes. `demoStore` module-level `applications` and
   `profile` are their initial empty/null values. `authStore` re-runs
   `init()`. Since the visitor was not authenticated and there is no
   persisted demo flag, the resulting status is `'unauthenticated'`.
3. `main.js` mounts the welcome page. No edits survive.

### Exiting the demo

1. Visitor clicks **Exit demo** in the Navbar.
2. `authStore.exitDemo()` runs: it calls `demoStore.clear()` (resets
   `applications = []` and `profile = null`), then sets status to
   `'unauthenticated'`, then notifies subscribers.
3. `main.js render('unauthenticated')` mounts the welcome page.

### Demo data isolation from authenticated paths

- A visitor in demo never holds a Supabase session, so
  `authStore.getAccessToken()` returns `null`. The service layer's mode
  switch makes the network calls unreachable in the first place, but even
  if a future code path bypassed the switch, the resulting unauthenticated
  request would be rejected by 018's `requireAuth` with 401.
- A separate browser holding an authenticated session for the same hosted
  deploy is untouched: demo writes never reach the server, so no
  authenticated user's rows can be modified by any demo activity.

---

## Constitution Check

- [x] **I. User-First Application Tracking** — Required fields (company,
  title, status, last status update, responsibilities) are enforced in the
  demo by reusing `src/models/application.js#validateApplication`. The seed
  fixture supplies all required fields for every seeded row.
- [x] **II. Simple, Maintainable Web Architecture** — One new module
  (`demoStore.js`) plus a small seed fixture. No new dependencies. Existing
  validation modules are reused. Mode branching lives in one place
  (`src/services/api.js`) and is one line per method.
- [x] **III. Data Integrity and Validation** — Validation rules are reused
  unchanged. Demo writes that fail validation surface the same error shape
  pages already handle. URL validation and date format apply identically.
- [x] **IV. Practical User Experience** — Empty states (no apps after the
  visitor archives the entire seed), loading states (synchronous in demo,
  but the existing async patterns continue to work), and error states (the
  resume-import note) are all explicit. Desktop and mobile browsers
  unaffected. Labels and keyboard navigation are inherited from the
  existing forms. Status indicators continue to use non-color cues.
- [x] **V. Testing and Quality Gates** — New unit tests cover demoStore
  CRUD, authStore demo transitions, and service-layer branching. Browser
  smoke test phase covers each of the six user stories in spec.md.
- [x] **Privacy** — No analytics, no tracking, no third-party data sharing.
  Demo state is local to the visitor's tab and is discarded on refresh or
  exit.
- [x] **Accessibility** — Exit demo button has an `aria-label` and is
  keyboard-reachable. The inline "sign in to use resume import" note is
  rendered as plain text within the existing form layout (no off-screen or
  color-only signaling).
- [x] **Extensibility** — Demo data uses the same models as authenticated
  data; future fields added to `application.js` flow through both paths.

**Complexity Tracking**:

| Complexity item | Why needed | Simpler alternative rejected because |
|---|---|---|
| New `'demo'` status on `authStore` | Single source of truth for "which page should I be on" matches the existing pattern | A separate `demoMode` flag would force every page-routing decision to consult two sources |
| Service-layer mode switch | Pages keep existing imports and call sites; smallest blast radius | A swapped service module would require updating every `import` in 5+ files and a build-time switch |
| Module-level demo state (no sessionStorage) | Refresh-as-reset is the spec's required behavior; module-level state achieves it for free | sessionStorage would survive refresh and violate FR-005; localStorage would survive longer still |
| Resume Import hidden + inline replacement note | Hides a multi-step interactive component while still telling the visitor the feature exists | "Disabled with messaging" on the upload widget itself renders a confusing partially-active control |
| Demo seed mirrors the 23 SQLite records with dates shifted relative to "today" | Parity with the local-dev seed (same companies / titles / notes) so a portfolio visitor sees the same realistic dataset the developer sees; relative dates keep the demo evergreen | Hand-curated short fixture would lose parity; verbatim hardcoded dates would date the demo |
| Partial extraction to `server/seeds/` (data-only, no shape conversion) instead of a full `shared/` source-of-truth refactor | Unblocks the demo seed's parity test (which would otherwise import side-effect-laden modules that open SQLite and call `process.exit`) without forcing the server seed scripts to convert SQLite-shape on every run. Demo still keeps its own camelCase fixture; the `server/seeds/` modules just hold the raw constants the existing seed scripts already used inline | A full `shared/` extraction (one camelCase source consumed by both the server seed transformer and the client demo) is the right move **if** drift between the two fixtures becomes a recurring issue — see research §13 |
| Deleting the server-side `APP_RUNTIME=demo` slot from 019 | The slot was reserved on the assumption 020 would implement a server-side demo; with client-only state it has no caller. Dead code that throws "see feature 020" after 020 ships is actively misleading | Keeping it as-is would leave a misconfiguration foot-gun (operator sets `APP_RUNTIME=demo`, gets non-obvious 500s on every request) and signal a server-side demo is coming when it isn't |

---

## Project Structure

```text
src/
├── data/
│   ├── authStore.js                  # MODIFIED — add 'demo' status, enterDemo(), exitDemo()
│   ├── demoStore.js                  # NEW — in-memory demo applications + profile + CRUD
│   ├── demoSeed.js                   # NEW — demo seed fixture (apps + profile)
│   └── store.js                      # unchanged (legacy localStorage path, untouched)
├── services/
│   ├── api.js                        # MODIFIED — early-return demoStore branch per method
│   ├── resumeApi.js                  # MODIFIED — demo throw with DEMO_FEATURE_UNAVAILABLE
│   ├── healthApi.js                  # unchanged
│   └── supabaseClient.js             # unchanged
├── pages/
│   ├── Tracker.js                    # unchanged (consumes api.js)
│   ├── Profile.js                    # unchanged
│   ├── ProfileEdit.js                # MODIFIED — inline note in resume-import slot when in demo
│   ├── Calendar.js                   # unchanged
│   └── welcome/
│       ├── WelcomePage.js            # unchanged (CTA already delegates to demoStub)
│       ├── AuthOverlay.js            # MODIFIED — demo button calls demoStub.enterDemo
│       └── demoStub.js               # MODIFIED — replace showDemoComingSoon with enterDemo
├── components/
│   ├── Navbar.js                     # MODIFIED — render Exit demo button when status === 'demo'
│   ├── ResumeImport.js               # MODIFIED — promote VISIBLE_STATUSES to an export (Task 07.2 contract guard)
│   └── (others)                      # unchanged
├── main.js                           # MODIFIED — route 'demo' status to app shell
├── models/                           # unchanged — reused for demo validation
└── utils/                            # unchanged

server/
├── config.js                         # MODIFIED — remove 'demo' from VALID_RUNTIMES; remove isDemo
├── repositories/
│   └── index.js                      # MODIFIED — remove DemoRepositoryNotImplementedError,
│                                     #            createDemoStub, and the if (config.isDemo) branch
├── health.js                         # MODIFIED — remove the config.isDemo short-circuit
├── seeds/
│   ├── applicationsData.js           # NEW — side-effect-free DEMO_RECORDS export (SQLite shape)
│   └── profileData.js                # NEW — side-effect-free DEMO_PROFILE export (frontend shape)
├── db-seed.js                        # MODIFIED — import DEMO_RECORDS from ./seeds/applicationsData.js
├── db-seed-profile.js                # MODIFIED — import DEMO_PROFILE from ./seeds/profileData.js;
│                                     #            wrap top-level side effects in CLI-only guard
└── (everything else unchanged)

specs/020-portfolio-demo-mode/
├── spec.md                           # already written
├── plan.md                           # this file
├── data-model.md                     # NEW — demo store shape, seed shape, authStore states
├── research.md                       # NEW — decisions + rejected alternatives
├── contracts/
│   └── api.md                        # NEW — client-side contracts (authStore, services, components)
├── quickstart.md                     # NEW — local + hosted verification
└── checklists/
    └── plan-review.md                # NEW — review gate before /speckit.tasks

tests/
├── data/
│   ├── authStore.demo.test.js        # NEW — enterDemo/exitDemo/refresh transitions
│   └── demoStore.test.js             # NEW — CRUD against the seed
├── services/
│   ├── api.demo.test.js              # NEW — demo branch returns store data; no fetch
│   └── resumeApi.demo.test.js        # NEW — demo throw; no fetch
├── pages/
│   └── ProfileEdit.demo.test.js      # NEW — inline note renders in resume-import slot in demo
├── components/
│   ├── Navbar.demo.test.js           # NEW — Exit demo button visible in demo; signs out
│   └── ResumeImport.demo.test.js     # NEW — affordance is hidden in demo status
└── pages/welcome/
    └── demoStub.test.js              # MODIFIED — enterDemo path + (legacy showDemoComingSoon removed)
```

---

## Affected Areas

### Files/components likely to be **inspected** (read-only context)

- [src/data/authStore.js](../../src/data/authStore.js) — current state shape
  (`status`, `user`, `accessToken`), `init()`, `signOut()`, subscribe
  pattern. The demo additions plug in alongside, no signature changes.
- [src/services/api.js](../../src/services/api.js) — every export
  (`request`, `create`, `getAll`, `getProfile`, `getById`, `update`,
  `archive`, `saveProfile`). All gain the same early-return pattern.
- [src/services/resumeApi.js](../../src/services/resumeApi.js) — single
  `parseResume(file)` function. Gains a demo throw at the top.
- [src/pages/Tracker.js](../../src/pages/Tracker.js),
  [Modal.js](../../src/components/Modal.js),
  [Profile.js](../../src/pages/Profile.js),
  [ProfileEdit.js](../../src/pages/ProfileEdit.js) — current call sites
  for `api.*` (read-only confirmation that the service-layer switch is
  enough; no page changes).
- [src/components/ResumeImport.js](../../src/components/ResumeImport.js) —
  `VISIBLE_STATUSES` already excludes anything that isn't `'authenticated'`
  or `'local-mode'`. Confirm in code that adding `'demo'` *outside* the
  set is the right way to keep the upload hidden (it is).
- [src/components/Navbar.js](../../src/components/Navbar.js) —
  `renderIdentityCluster(state)` currently shows email + Sign out for
  `'authenticated'` only. Read to confirm where to insert the demo branch.
- [src/main.js](../../src/main.js) — `render(state)` switch. Confirm where
  to add the `'demo'` case (alongside `'local-mode'`/`'authenticated'`).
- [src/pages/welcome/WelcomePage.js](../../src/pages/welcome/WelcomePage.js)
  + [AuthOverlay.js](../../src/pages/welcome/AuthOverlay.js) +
  [demoStub.js](../../src/pages/welcome/demoStub.js) — confirm two call
  sites for demo CTA (welcome page main CTA + auth modal footer button).
  Both currently funnel through `showDemoComingSoon()` in `demoStub.js`.
- [src/models/application.js](../../src/models/application.js) +
  [shared/constants.js](../../shared/constants.js) — required fields,
  status vocabulary, default values. Demo seed must satisfy these.

### Files/components likely to be **modified**

- [server/config.js](../../server/config.js) — remove `'demo'` from
  `VALID_RUNTIMES`; remove the `isDemo` field from the returned config.
  Hosted env-var requirement logic for `runtime === 'hosted'` is
  unchanged.
- [server/repositories/index.js](../../server/repositories/index.js) —
  delete the `DemoRepositoryNotImplementedError` class, the
  `createDemoStub(name)` helper, and the `if (config.isDemo) { … }`
  branch in `createRepositories`. The `local` and `hosted` branches
  are unchanged. The module-level comment that references demo-mode
  laziness is updated to remove the demo half.
- [server/health.js](../../server/health.js) — remove the
  `config.isDemo` short-circuit in `assertHostedSchema`. The function
  remains a no-op for non-hosted runtimes (i.e. local).
- [server/db-seed.js](../../server/db-seed.js) — replace the inline
  `DEMO_RECORDS` array with `import { DEMO_RECORDS } from
  './seeds/applicationsData.js'`. Function body and CLI guard
  unchanged (Task 02.0).
- [server/db-seed-profile.js](../../server/db-seed-profile.js) —
  replace the inline `DEMO_PROFILE` constant with
  `import { DEMO_PROFILE } from './seeds/profileData.js'`; wrap the
  top-level `initSchema()` / `saveProfile()` / `process.exit()` side
  effects in an `import.meta.url === pathToFileURL(process.argv[1]).href`
  guard so the file is safe to import from tests (Task 02.0).
- [tests/server/config.test.js](../../tests/server/config.test.js) —
  remove the two demo acceptance tests; remove `isDemo: false`
  assertions from the local/hosted cases; update the
  "lists all valid runtimes" assertion to expect `local` and `hosted`
  only.
- [tests/server/repositories/dispatcher.test.js](../../tests/server/repositories/dispatcher.test.js) —
  remove the demo-mode lazy-import test, the demo-routing test, and
  the demo-precedence test. The local + hosted cases stay.
- [tests/server/repositories/stubs.test.js](../../tests/server/repositories/stubs.test.js) —
  delete the entire `describe('demo repository stubs', …)` block and
  the `DemoRepositoryNotImplementedError` import. The cold-start
  invariant tests stay.
- [tests/server/health.test.js](../../tests/server/health.test.js) —
  remove the "does nothing for demo runtime" test case.
- [docs/deployment.md](../../docs/deployment.md) — remove the demo-mode
  bullet that names `DemoRepositoryNotImplementedError`.
- [docs/REPO_MAP.md](../../docs/REPO_MAP.md) — update the
  `server/repositories/index.js` and `src/pages/welcome/demoStub.js`
  rows to drop the demo-slot references and replace `demoStub.js`'s
  description with the real (post-020) behavior.
- [src/data/authStore.js](../../src/data/authStore.js) — add `'demo'` to
  the status finite set; export `enterDemo()` and `exitDemo()`.
- [src/services/api.js](../../src/services/api.js) — add the demo branch
  to each of `create`, `getAll`, `getProfile`, `getById`, `update`,
  `archive`, `saveProfile`. The `request()` helper itself is unchanged.
- [src/services/resumeApi.js](../../src/services/resumeApi.js) — add a
  demo early-throw with `DEMO_FEATURE_UNAVAILABLE`.
- [src/main.js](../../src/main.js) — extend `render(state)` to mount
  the app shell when `state.status === 'demo'` (parallel to
  authenticated); skip the entire legacy `store` warm-up block in
  `mountAppShell` when in demo (Task 05.3).
- [src/pages/Tracker.js](../../src/pages/Tracker.js) — gate both
  `persistFilterState` and `loadPersistedFilterState` on
  `status !== 'demo'` so demo sessions write nothing to
  `localStorage` and start with the default filter state (Task 05.4).
- [src/pages/welcome/demoStub.js](../../src/pages/welcome/demoStub.js) —
  replace `showDemoComingSoon()` with `enterDemo()`. The exported function
  is renamed; existing tests for the toast are removed.
- [src/pages/welcome/AuthOverlay.js](../../src/pages/welcome/AuthOverlay.js)
  — update the import from `showDemoComingSoon` to `enterDemo` (the
  in-modal demo button uses the same handler as the welcome CTA).
- [src/components/Navbar.js](../../src/components/Navbar.js) — extend
  `renderIdentityCluster(state)` to render an **Exit demo** button when
  `state.status === 'demo'`.
- [src/components/ResumeImport.js](../../src/components/ResumeImport.js) —
  promote the existing `const VISIBLE_STATUSES = new Set([...])` to an
  exported binding so the demo test can assert
  `!VISIBLE_STATUSES.has(DEMO_STATUS)`. The set's contents are unchanged.
- [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js) — in the
  layout slot where `ResumeImport` mounts, conditionally render a small
  inline note (`"Sign in to use resume import."` or similar; exact copy
  is a tasks-phase decision but no longer than one short sentence) when
  the current status is `'demo'`. The `ResumeImport` component is not
  modified; its own visibility gating handles hiding the upload.

### Files/components likely to be **created**

- [src/data/demoStore.js](../../src/data/demoStore.js) —
  `loadSeed()`, `clear()`, `getAll()`, `getById(id)`, `create(fields)`,
  `update(id, fields)`, `archive(id)`, `getProfile()`, `saveProfile(p)`.
  Module-level `_applications` array, `_profile` object. No persistence.
- [src/data/demoSeed.js](../../src/data/demoSeed.js) — exports
  `buildDemoSeed()` (function, not constant — so dates can be computed
  at call time) that returns `{ applications, profile }`. Mirrors the
  23 records from `DEMO_RECORDS` (in frontend shape; dates shifted so
  the most recent record reads as "today") and the `DEMO_PROFILE`
  persona verbatim. See [data-model.md §3](data-model.md) for the
  column-translation table.
- [server/seeds/applicationsData.js](../../server/seeds/applicationsData.js)
  (Task 02.0) — side-effect-free module exporting the 23-record
  `DEMO_RECORDS` array in SQLite storage shape (snake_case, JSON-string
  arrays, `archived: 0`). No imports of `./db.js`. The existing
  `server/db-seed.js` re-imports from here.
- [server/seeds/profileData.js](../../server/seeds/profileData.js)
  (Task 02.0) — side-effect-free module exporting the `DEMO_PROFILE`
  constant in frontend shape. No `initSchema()`, no `saveProfile()`,
  no `process.exit()`. The existing `server/db-seed-profile.js`
  re-imports from here.
- Supporting spec artifacts:
  [data-model.md](data-model.md),
  [research.md](research.md),
  [contracts/api.md](contracts/api.md),
  [quickstart.md](quickstart.md),
  [checklists/plan-review.md](checklists/plan-review.md).
- Test files listed under *Project Structure*.

### Tests likely to be **added or updated**

- **New**:
  - `tests/data/authStore.demo.test.js` —
    `enterDemo()` transitions `'unauthenticated' → 'demo'`, notifies
    subscribers, and clears `accessToken`; `exitDemo()` transitions
    `'demo' → 'unauthenticated'` and clears `demoStore`; a fresh `init()`
    in the absence of a Supabase session does not restore demo.
  - `tests/data/demoStore.test.js` — `loadSeed()` populates from the
    fixture (count is 23); `getAll()` returns a defensive copy;
    `create` / `update` / `archive` mutate in memory and pass
    validation (Task 02.3 items 4–8); `getProfile` / `saveProfile`
    work against the same object; `clear()` resets both. Includes
    **parity assertions** against
    `server/seeds/applicationsData.js#DEMO_RECORDS` and
    `server/seeds/profileData.js#DEMO_PROFILE` — index-aligned
    company/title/status triples plus profile deep-equal — and a
    **storage-discipline spy** asserting zero `localStorage.setItem`,
    `sessionStorage.setItem`, and `indexedDB.open` calls across the
    full CRUD pass.
  - `tests/services/api.demo.test.js` — with `authStore` stubbed to
    `'demo'`, every method returns demoStore data and `globalThis.fetch`
    is **never** called (assert via `vi.spyOn(globalThis, 'fetch')`).
  - `tests/services/resumeApi.demo.test.js` — `parseResume()` throws
    `{ code: 'DEMO_FEATURE_UNAVAILABLE', ... }` without invoking `fetch`.
  - `tests/pages/ProfileEdit.demo.test.js` — in demo, the resume-import
    slot renders the inline note and `ResumeImport` is not mounted.
  - `tests/components/Navbar.demo.test.js` — in demo, the identity
    cluster shows the **Exit demo** button; clicking it calls
    `authStore.exitDemo()`.
  - `tests/components/ResumeImport.demo.test.js` — when authStore is in
    demo status, `ResumeImport` does not render the upload affordance
    (covers the `VISIBLE_STATUSES` exclusion).
- **Updated**:
  - `tests/pages/welcome/demoStub.test.js` — the existing toast
    assertion is replaced with an `enterDemo()` assertion: confirms
    that the CTA handler calls `authStore.enterDemo()`. (The seed
    load runs inside `authStore.enterDemo()`, not from the CTA — see
    Task 05.1 single-source constraint; that behavior is covered at
    the authStore boundary in `authStore.demo.test.js`.)
  - `tests/pages/welcome/AuthOverlay.test.js` (if it asserts the demo
    button calls `showDemoComingSoon`) — updated to the new symbol.
- **Unchanged but verified to still pass**:
  - Post-019 server-side **runtime** tests not touched by Phase 01 or
    Task 02.0 — repository adapters, the seed middleware, RLS mocks,
    and the route handlers. 020 does not modify any runtime server
    behavior beyond deletions; it modifies four server *test* files
    (config, dispatcher, stubs, health — see [Task 01.4](#task-014--update-server-side-tests-to-drop-demo-coverage))
    and refactors the two seed *scripts* (Task 02.0) without changing
    their output.
  - All authenticated-path component tests
    (`tests/pages/Tracker.test.js`, `Modal.test.js`, etc.). The demo
    branch in `services/api.js` is an early return; the authenticated
    branch is unchanged.
- **Manual** (per constitution Amendment 1.1.0):
  - The six browser smoke tests under *Validation Approach* below.

### Explicitly **out of scope**

- New server endpoints, new server modules, or any new server-side
  data flow. The only server work in 020 is the **deletion** of the
  dead `APP_RUNTIME=demo` scaffolding from 019 (FR-016, see *Affected
  Areas → Modified*).
- New persistent storage. No use of `sessionStorage`, `localStorage`,
  IndexedDB, or cookies for demo content.
- Sharing or saving a demo session (no "save your demo to an account",
  no shareable demo URL with seeded edits).
- Analytics or telemetry of demo usage.
- A separate demo deployment (e.g. a demo subdomain).
- Changes to the welcome page's visual design or layout.
- Changes to the authenticated experience beyond what is needed to
  conditionally render the Exit-demo Navbar branch and the inline resume
  note in `ProfileEdit.js`.
- New server-side demo behavior. (Removal of 019's dead `APP_RUNTIME=demo`
  scaffolding is **in scope** — see FR-016 and Phase 01. What this bullet
  excludes is the introduction of any new server demo functionality.)

---

## Risks and Tradeoffs

### Risks

1. **A future feature adds a new client-side network call that forgets to
   route through the demo switch.** A new service method that calls `fetch`
   directly would attempt a real network request in demo and either fail
   (401 from `requireAuth`) or, worse, succeed against an unprotected
   endpoint.
   *Mitigation*: the demo automated test for `services/api.js` asserts
   that no service function calls `fetch` when status is `'demo'`. New
   service methods must add the same demo branch to pass that test. The
   plan-review checklist makes this an explicit gate.

2. **`apptracker_filters` localStorage write during a demo session.** The
   tracker persists filter state to `localStorage` independent of the data
   store. Even though filter preferences are not visitor-entered demo
   content, leaving them writable from a demo session dilutes the "demo
   never persists anything" promise and would force the storage audit
   to carve out an exception.
   *Mitigation* (applied): Task 05.4 gates both `persistFilterState`
   and `loadPersistedFilterState` on `status !== 'demo'`. Demo
   sessions write nothing to `localStorage` under any project key, and
   a prior authenticated session's filter state does not leak into the
   demo's initial filter UI. Task 08.2's storage audit verifies the
   zero-write outcome.

3. **Visitor uses browser back/forward across welcome ↔ demo and expects
   their edits to come back.** Module-level state survives a same-page
   `history.back()`/`forward()` *if the bundle is not re-evaluated*. In a
   typical SPA the bundle stays alive — so the demoStore *could* still
   hold the edits, but `authStore` was reset to `'unauthenticated'` on
   exit and is now back to `'demo'` on forward, so the contents would
   surprisingly persist.
   *Mitigation*: `exitDemo()` calls `demoStore.clear()` before flipping
   the auth status, so back-from-welcome doesn't re-mount stale edits.
   The corresponding browser-back-from-app-shell case is handled by the
   spec's "browser back/forward" edge case in spec.md: navigations end
   the demo cleanly because `exitDemo()` runs from the Navbar.

4. **Validation drift between demo and server adapters.** The demo reuses
   `src/models/application.js#validateApplication`, but the server's
   `server/validation/application.js` is a separate module. If the two
   diverge over time, demo could accept a payload the server rejects (or
   vice versa).
   *Mitigation*: the codebase already mostly delegates client-side
   validation to `src/models/application.js`; demo follows that
   convention. The plan-review checklist flags the dual-validation
   surface so future maintainers consider both files when adding a rule.

5. **Demo state leaks if a future feature adds a "save to my account"
   action.** Out-of-scope today (spec non-goal), but a careless future
   change could plumb demo data into a server call.
   *Mitigation*: spec non-goals + this plan's out-of-scope section.

### Tradeoffs taken

- **Hide vs. disable Resume Import** — chose hide-the-upload + inline note.
  Trades a visible "this exists but is disabled" affordance for a calmer
  surface that still mentions the feature in text. The brief allows either.
- **Service-layer switch vs. module swap** — chose the in-line branch.
  Trades one early-return per service method for zero page-level changes.
- **Module-level state vs. sessionStorage** — chose module-level. Trades
  any cross-refresh continuity (which the spec forbids anyway) for the
  simplest reset mechanism.
- **`'demo'` on `authStore` vs. a parallel demo flag** — chose to extend
  the existing finite set. Trades a slightly bigger `authStore` state
  machine for one source of truth for routing decisions.
- **Relative dates in the seed vs. fixed dates** — chose relative. Trades
  test determinism (snapshots would need date stubbing) for an evergreen
  demo that doesn't read as stale. The seed fixture is a function, not a
  constant, so tests can inject a fixed `Date.now()`.
- **Mirror the 23 SQLite records (duplicate) vs. extract a shared
  fixture** — chose duplicate. Trades single-source-of-truth for
  minimal scope and zero refactor of `server/db-seed.js`. A small
  parity test (Task 02.3) catches structural drift; a content drift
  is a soft documentation requirement (research §13).

---

## Validation Approach

### Automated (Vitest)

1. **`authStore` demo transitions**: `enterDemo()` sets status to
   `'demo'`, `accessToken` to null, notifies subscribers exactly once;
   `exitDemo()` resets to `'unauthenticated'` and calls
   `demoStore.clear()`; calling `init()` with no Supabase session does
   not restore demo.
2. **`demoStore` CRUD**: `loadSeed()` populates from the fixture (deep
   copy, so mutations don't bleed into the fixture); `getAll()` returns
   a defensive clone; `create` assigns a fresh id, validates via
   `validateApplication`, prepends to the list; `update` merges fields
   and re-validates; `archive` removes from the active list; `getProfile`
   / `saveProfile` work against the seeded profile.
3. **`services/api.js` demo branching**: with `authStore` stubbed to
   `'demo'`, each method (`getAll`, `getById`, `create`, `update`,
   `archive`, `getProfile`, `saveProfile`) returns the demoStore result
   and `globalThis.fetch` is never called. Spy assertion required.
4. **`services/resumeApi.js` demo throw**: `parseResume()` throws
   `DEMO_FEATURE_UNAVAILABLE` without calling `fetch`.
5. **`ResumeImport` visibility**: with status `'demo'`, the component
   does not render the upload control (existing `VISIBLE_STATUSES`
   already excludes the new value).
6. **`ProfileEdit` inline note**: in demo, the resume-import slot
   renders the inline note instead of mounting `ResumeImport`.
7. **`Navbar` exit affordance**: in demo, the identity cluster renders
   **Exit demo**; clicking calls `authStore.exitDemo()`.
8. **Welcome CTA**: `demoStub.enterDemo()` is called (not the old toast)
   from both the welcome-page CTA and the auth-modal demo button.
9. **`main.js` routing**: `render({ status: 'demo' })` mounts the app
   shell. Refresh (simulated as a fresh `bootstrap()` call) returns the
   welcome page.
10. **Authenticated-path regression**: existing tracker, modal, profile,
    and profile-edit tests pass without modification. Existing server
    tests are untouched.

### Manual (quickstart-driven, requires the hosted deploy or a local
hosted-style run)

1. Load the hosted deploy in a fresh private window. Verify the welcome
   page renders.
2. Click **Try the demo**. Verify the welcome page unmounts and the
   tracker mounts with the 23 seeded applications mirroring the SQLite
   seed (same companies and roles, dates shifted so the most recent
   record reads as "today"). Verify the profile page also renders the
   populated demo persona (Alex Rivera, full sections).
3. Open DevTools → Network. Repeat: create an application, edit one,
   change a status, archive one, edit the profile and save. Confirm
   zero requests to `/api/applications`, `/api/profile`,
   `/api/resume/parse`, or Supabase.
4. Open DevTools → Application → Storage. Confirm `localStorage`,
   `sessionStorage`, IndexedDB, and cookies have **zero new or
   modified project-namespaced keys** from the demo session. In
   particular `apptracker_filters` MUST NOT have been written
   during the demo — Task 05.4 gates that write on
   `status !== 'demo'`. Any pre-existing `apptracker_filters`
   value from a prior authenticated session in the same browser
   remains unchanged.
5. Refresh the page (F5). Verify the welcome page renders fresh and no
   prior-session content is visible after re-entering the demo.
6. Inside the demo, navigate to Profile → Profile Edit. Verify the
   resume-import slot shows the inline sign-in note and no upload
   widget. Confirm no `/api/resume/parse` request is attempted.
7. Inside the demo, click **Exit demo** in the Navbar. Verify the
   welcome page renders. Re-enter the demo and confirm the data is the
   seed (no leftovers from the prior demo).
8. Open a second browser. Sign in as a real hosted user. Verify their
   existing applications and profile load (post-019 behavior). Return to
   the first browser and perform demo writes. Refresh the second
   browser's tracker. Verify the authenticated user's data is byte-
   equivalent to its pre-demo state.

### Browser smoke test (per constitution Amendment 1.1.0)

One smoke test per spec user story, walked in the to-be-merged state:

1. **US1** — visitor opts into demo from welcome; tracker shows seeded
   data.
2. **US2** — visitor performs the full CRUD set inside the demo;
   changes are visible across pages within the session.
3. **US3** — DevTools Network + Application panels confirm zero
   persistence to Supabase and no demo content in any browser-side
   storage.
4. **US4** — refresh resets to welcome; re-entry restarts from the seed.
5. **US5** — Resume Import is hidden inside the demo; the inline note
   appears in the slot; an authenticated user (separate browser) still
   sees the full Resume Import flow.
6. **US6** — a parallel authenticated session is unaffected by the demo
   session in another browser.

### Constitution / quality gates ([checklists/plan-review.md](checklists/plan-review.md))

Reviewed before `/speckit.tasks` runs.

---

## Open Items for Tasks Phase

All previously-open items resolved during plan review:

- **Seed fixture content** — resolved: mirror the 23 SQLite records and
  the persona profile (FR-003 / [data-model.md §3](data-model.md)).
- **Resume-import inline note copy** — resolved: "Resume import is
  available after signing in." (Task 07.1).
- **Exit demo button** — resolved: visual parity with the existing
  Sign-out button, `aria-label="Exit demo"` (Task 06.1).
- **Demo mode badge** — resolved: ship a compact "Demo mode" badge in
  the Navbar adjacent to the Exit demo button (Task 06.1).
- **`apptracker_filters` gating** — resolved: gate `persistFilterState`
  and `loadPersistedFilterState` on `status !== 'demo'` so demo
  sessions write nothing to `localStorage` under any project-namespaced
  key (Task 05.4).
