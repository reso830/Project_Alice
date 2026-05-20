# Research — Portfolio Demo Mode (020)

Each section captures the alternatives considered for a single decision,
why one was chosen, and why the others were rejected. Decisions made
during spec clarification are recorded with the user's selection.

---

## 1. Where the demo data layer plugs in

**Decision**: Branch inside the existing service modules
(`src/services/api.js` and `src/services/resumeApi.js`).

**Considered alternatives**:

1. **Branch inside each service function (chosen)**. Each export checks
   `getAuthState().status === 'demo'` at the top and delegates to
   `demoStore` instead of `fetch`. Page-layer imports unchanged.
   - *Pros*: smallest blast radius; one line per method; tests trivially
     `vi.spyOn(globalThis, 'fetch')` to verify network silence.
   - *Cons*: `api.js` becomes mode-aware. Acceptable: it's a thin
     transport layer and the branch is uniform.

2. **Swap the entire service module via a build-time or runtime selector**
   (e.g. `import * as api from getAuthState().status === 'demo' ?
   './demoApi.js' : './api.js'`). *Rejected*. Dynamic `import` at the
   page-module top level isn't viable; a runtime selector breaks tree-
   shaking and forces every page to read the selector. Updating every
   `import` site (5+ files: `Tracker`, `Modal`, `Profile`, `ProfileEdit`,
   anywhere else `services/api` is referenced) is mechanical churn for
   no semantic benefit.

3. **Intercept at `fetch` itself with a request-router middleware**
   (e.g. wrap `globalThis.fetch` and respond locally for `/api/...`
   paths when in demo). *Rejected*. Adds a global side effect that's
   hard to opt out of in tests; the layered approach where each service
   function knows the demo branch is far easier to reason about.

4. **Push the demo branch up into the pages themselves** (e.g. `Tracker`
   checks demo and calls `demoStore.getAll()` directly). *Rejected*.
   Spreads demo awareness across every page; violates the architectural
   constraint that pages should be unaware of persistence.

---

## 2. Where the demo mode signal lives

**Decision**: Extend `src/data/authStore.js` with a new `'demo'` status.

**Considered alternatives**:

1. **New `'demo'` status on `authStore` (chosen)**. One source of truth
   for "what should the UI render?" `main.js`, `Navbar`, `ResumeImport`,
   and `services/api.js` all already consult `authStore`. Adding a
   fourth state value is the natural extension.

2. **Separate `demoStore.isActive` flag**. *Rejected*. Two sources of
   truth: routing decisions in `main.js` would consult `authStore.status`
   for welcome-vs-shell, and `demoStore.isActive` for demo-or-not. Any
   future page-level branch would have to remember both.

3. **URL-based: `/demo` route or `?demo=1` query param**. *Rejected*.
   The app doesn't use URL routing today; introducing it for this one
   feature is premature. URL-based mode also makes refresh-as-reset
   harder: a bookmark to `/demo` would survive refresh, and we'd have
   to actively reset state on re-entry, which is more code than the
   in-memory variant.

---

## 3. Resume Import handling in demo

**Decision**: Hide the upload affordance entirely (existing
`ResumeImport.VISIBLE_STATUSES` excludes `'demo'`); render an inline
one-line note in the surrounding `ProfileEdit.js` slot.

**Considered alternatives**:

1. **Hide upload, inline note in the slot (chosen)**. Calmest visual.
   The visitor sees the feature exists in text but isn't presented with
   a non-functional control.

2. **Render `ResumeImport` in a fully disabled state**. *Rejected*.
   `ResumeImport` is a multi-step interactive component (file picker,
   progress states, error handling). Its disabled state still renders
   the upload widget plus messaging. The visual is louder than the
   brief intends and risks looking broken.

3. **Hide the entire `ProfileEdit` page in demo**. *Rejected*. Editing
   the profile is one of the brief's core demo interactions.

---

## 4. Storage mechanism for demo state

**Decision**: Module-level JS state in `demoStore.js`. No browser-side
persistence for demo content.

**Considered alternatives**:

1. **Module-level memory (chosen)**. Free reset-on-refresh; nothing to
   audit in storage panels.

2. **`sessionStorage`**. *Rejected*. Survives refresh in most browsers
   (sessionStorage is tab-scoped but does survive reload), which
   violates FR-005.

3. **`localStorage`**. *Rejected*. Survives across tabs, refreshes, and
   browser restarts. Maximally wrong for a non-persistent demo.

4. **IndexedDB**. *Rejected*. Same persistence properties as
   `localStorage`, plus dramatic complexity for the feature.

5. **Server-side in-memory keyed by session token (via 019's
   `APP_RUNTIME=demo` slot)**. *Rejected during spec clarification*.
   Vercel cold starts wipe in-memory state unpredictably; multiple
   concurrent function instances diverge; the brief's "non-persistent"
   intent is much more naturally satisfied on the client.

---

## 5. Reset trigger

**Decision** (spec clarification): refresh-on-browser-reload is the
canonical reset trigger. Explicit reset via an in-app button is *not*
required.

**Considered alternatives**:

1. **Refresh (chosen)**. Combines reset with the most discoverable
   browser-native action.

2. **Refresh + explicit "Reset demo" button**. *Rejected*. The visitor
   already has an **Exit demo** button; a second reset button next to
   it is clutter. Re-entering the demo from welcome accomplishes the
   same.

3. **Tab close / TTL**. *Rejected*. Module-level memory dies with the
   tab anyway, so this is implicit; surfacing it as a UX promise
   doesn't add value.

4. **No explicit reset, just exit + re-entry**. *Rejected*. Refresh is
   too natural a reset gesture to leave unsupported.

---

## 6. Demo-entry call site(s)

**Decision**: Update `src/pages/welcome/demoStub.js` to export
`enterDemo()` (replacing `showDemoComingSoon()`). Both the welcome-page
CTA (`WelcomePage.js`) and the auth-modal demo button (`AuthOverlay.js`)
funnel through this one export, matching the existing pattern.

**Considered alternatives**:

1. **One shared export from `demoStub.js` (chosen)**. Matches today's
   layout: `WelcomePage` and `AuthOverlay` both import the same
   function from `demoStub.js`. Renaming the function consolidates the
   contract.

2. **Two separate entry points (one per surface)**. *Rejected*. They do
   the same thing; duplication is the wrong default.

3. **Direct call to `authStore.enterDemo()` from each CTA**. *Rejected*.
   Couples the CTAs to the auth store and bypasses the seed load. A
   tiny `enterDemo()` wrapper that loads the seed *and* flips the auth
   status is the cleanest seam.

---

## 7. Seed fixture as a function (vs constant)

**Decision**: `buildDemoSeed()` is a function that returns a fresh
object graph, so dates can be computed at call time.

**Considered alternatives**:

1. **Function returning fresh objects (chosen)**. Dates are computed
   relative to "now"; deep-cloning happens at the boundary; tests can
   stub `Date.now()`.

2. **Constant exported object literal**. *Rejected*. Hardcoded dates
   date the demo and look stale over time; mutating the constant in
   one demo session would leak into the next.

---

## 8. Validation source for demo writes

**Decision**: Reuse `src/models/application.js#validateApplication` and
`normalizeApplication` (and the equivalent in `src/models/profile.js`).
Demo writes call the same functions the network-backed path's pre-submit
checks call today.

**Considered alternatives**:

1. **Reuse existing client validation (chosen)**. One source of truth.
   Constitution-required.

2. **Skip validation in demo for speed**. *Rejected*. Demo would accept
   payloads the authenticated path rejects, breaking the brief's
   "interactions should feel fully functional" promise.

3. **Run validation server-side via a tiny demo-only endpoint**.
   *Rejected*. Demo is offline by design.

---

## 9. Navbar exit affordance

**Decision**: In demo, the identity cluster renders an **Exit demo**
button styled visually similar to the existing Sign-out button (door
arrow icon + label). Clicking it calls `authStore.exitDemo()`.

**Considered alternatives**:

1. **Dedicated Exit demo button (chosen)**. Discoverable; matches the
   existing Sign-out affordance's visual weight.

2. **Reuse the Sign-out button with different label**. *Rejected*. The
   semantics differ (no signed-in user to sign out), and conflating the
   two would complicate the i18n / labeling story.

3. **Demo-mode banner that includes the exit link**. *Rejected* as the
   only affordance — possibly worth adding *alongside* the Navbar
   button as a more obvious indicator. Decided open in plan for tasks
   phase: add a compact "Demo mode" badge adjacent to the Exit button
   to make the mode unambiguous without redesigning anything.

---

## 10. Should `apptracker_filters` localStorage write be gated in demo?

**Decision** (refined during spec review): **Gate it.** Task 05.4
applies an early-return on `status === 'demo'` inside both
`persistFilterState` (no writes) and `loadPersistedFilterState`
(returns the default filter state, ignoring any pre-existing
`localStorage` value).

**Considered alternatives**:

1. **Gate `persistFilterState` and `loadPersistedFilterState` on
   `status !== 'demo'` (chosen)**. Pros: zero `localStorage` writes
   during a demo session → cleanest audit story; matches FR-004
   strictly; the storage audit (Task 08.2) becomes a simple "no
   project-namespaced keys" assertion rather than carving out an
   exception for filter prefs. A prior authenticated session's
   filter state does not leak into the demo's initial filter UI.
   Cons: filter prefs reset between demo sessions, but that's
   consistent with "demo is non-persistent."

2. **Leave behavior unchanged.** *Rejected*. `apptracker_filters` is
   technically UX preference data and FR-004 names "demo application
   or profile data" specifically — but leaving any `localStorage`
   write during a demo session forces the audit to carve out an
   exception, and a strict reviewer would still flag it. The cleanest
   "demo writes nothing" story is worth the small gating change.

3. **Namespace demo-session filters under a separate key** (e.g.
   `apptracker_demo_filters`). *Rejected*. Extra complexity for no
   real user benefit — demo state is supposed to die on refresh, so
   persisting filter prefs across demo sessions would be slightly
   weird anyway.

---

## 11. Delete vs. keep the server-side `APP_RUNTIME=demo` slot

**Decision** (during plan review): **delete** the server-side demo
scaffolding reserved by 019. Concretely: remove `'demo'` from
`VALID_RUNTIMES`, remove `config.isDemo`, remove
`DemoRepositoryNotImplementedError` and `createDemoStub`, remove the
`if (config.isDemo)` branch in `createRepositories`, remove the
`isDemo` short-circuit in `assertHostedSchema`, and drop the
corresponding tests and docs.

**Considered alternatives**:

1. **Delete (chosen)**. The server-side slot was reserved on the
   assumption that 020 would implement a server-side demo store. With
   the client-only design landed during spec clarification, the slot
   has no caller and no plausible near-term use. Carrying dead code
   that throws "see feature 020" after 020 has shipped is actively
   misleading. Deletion shrinks the runtime config matrix (back to
   `local` + `hosted`) and removes a misconfiguration foot-gun
   (operator sets `APP_RUNTIME=demo` and gets non-obvious 500s on
   every request).

2. **Keep as-is**. *Rejected*. The original plan draft preserved the
   stub, reasoning that future-us might want a server-side demo
   deployment. But there is no concrete near-term need, no captured
   requirement, and no spec for what that would do. YAGNI applies: if
   a server-side demo is ever specified, re-adding a small dispatcher
   branch is trivial. Carrying dead code in the meantime is the cost.

3. **Keep the value, change the error message** (e.g. "demo runtime
   is not supported"). *Rejected*. Worse than either deletion or
   keeping the original stub: the value remains valid in
   `VALID_RUNTIMES` and lets an operator boot a broken server. If we
   don't support it, the config loader should refuse it.

---

## 12. Demo mode badge / banner

**Decision** (confirmed during spec review): ship a compact "Demo
mode" badge in the Navbar adjacent to the **Exit demo** button. Task
06.1 implements both as a single render branch in
`renderIdentityCluster`.

**Considered alternatives**:

1. **Compact badge in Navbar (chosen)**. Keeps the demo unambiguous
   without occupying screen real estate. Textual label satisfies the
   constitution's non-color-only status rule.

2. **Full-width top banner**. *Rejected*. Heavier visual; pushes the
   app shell down by ~32px on mobile, which crowds the already-tight
   viewport.

3. **No indicator beyond the Exit button**. *Rejected*. A visitor who
   lands deep in the app may forget which mode they're in; the
   badge is cheap insurance.

---

## 13. Demo seed: duplicate of SQLite seed, with data extracted to server/seeds/

**Decision** (refined during spec review): Adopt a **two-stage**
approach.

**Stage 1 (in scope for 020)** — data-only extraction. Move the raw
`DEMO_RECORDS` and `DEMO_PROFILE` constants out of the side-effect-laden
seed scripts (`server/db-seed.js`, `server/db-seed-profile.js`) into
new side-effect-free modules under `server/seeds/`. The seed scripts
re-import the constants; their existing storage shape and CLI behavior
are unchanged. This unblocks the demo's parity test (Task 02.3), which
needs to compare the demo's frontend-shape fixture against the SQLite
source without opening the database or terminating the test process.
The demo still keeps its own dedicated fixture file
(`src/data/demoSeed.js`) with the records translated to frontend shape
— the camelCase + array-skills transformation lives in the demo file,
not in the shared data.

**Stage 2 (deferred, future work)** — full `shared/` source of truth.
A single camelCase source consumed by both (a) a transformer in the
server seed that produces SQLite shape, and (b) the client demo
fixture directly. Defer until drift becomes a recurring issue. See
*Follow-up trigger* below.

**Why the partial extraction instead of just duplicating the data
inline in the test fixture**:

- The real motivation isn't theoretical drift between seeds — it's
  that `server/db-seed-profile.js` has a module-load side effect today
  (`initSchema()` + `saveProfile(...)` + `process.exit(0)` at the top
  level, no `import.meta.url` guard). The parity test can't import
  that file without killing vitest. Fixing this side-effect bug is
  worth doing on its own merits, and the extraction is the cheapest
  fix that delivers it.
- The Stage 1 extraction is mechanical: move the constant, re-import.
  It does **not** consolidate the SQLite shape with the frontend
  shape; that's still two copies. The "single source of truth"
  property — Stage 2 — is what's deferred.

**Rejected alternatives**:

1. **Pure duplicate** — keep both seed scripts as-is, hand-curate a
   small `EXPECTED_PARITY` array (23 `{ companyName, jobTitle, status }`
   triples) inline in the parity test. *Rejected*: leaves the
   `db-seed-profile.js` side-effect bug in place; introduces a third
   copy of the seed data (`server/db-seed.js`'s `DEMO_RECORDS`,
   `src/data/demoSeed.js`'s `SOURCE_RECORDS`, and the test's
   `EXPECTED_PARITY`).

2. **Full `shared/` extraction** — Stage 2 above, applied in 020.
   *Deferred, not rejected*. The transformer work and the redesign of
   the SQLite seed flow are real scope expansion for a feature whose
   primary surface is the client demo. Once drift between the demo
   fixture and `server/seeds/applicationsData.js` is observed, this
   becomes the obvious next step.

3. **Demo seed imports `server/db-seed.js` directly** — *Rejected*.
   The server seed transitively imports `better-sqlite3` via `./db.js`;
   pulling that into the client bundle defeats 019's lazy-import
   discipline. The Stage 1 extraction (a side-effect-free module under
   `server/seeds/`) is the right shape for any client to import, but
   the **client** demo deliberately doesn't import even that — its
   frontend-shape fixture is independent and lives in `src/data/`.
   Only the **test** imports from `server/seeds/`.

**Follow-up trigger**: if a PR updates the demo fixture without
updating `server/seeds/applicationsData.js` (or vice versa) and the
parity test catches it, that's one drift event. A second drift event
is the cue to spec the Stage 2 `shared/` extraction.
