# Feature Specification: Portfolio Demo Mode

**Feature Branch**: `020-portfolio-demo-mode`
**Created**: 2026-05-19
**Status**: Draft
**Input**: `features/020-portfolio-demo-mode.md`

---

## Problem Statement

The hosted deploy (features 017–019) is gated behind Supabase authentication: an
unauthenticated visitor can land on the welcome page but cannot explore the
tracker, profile, or any of the core workflows. The existing "Try the demo" CTA
on the welcome page is wired to a placeholder toast (`src/pages/welcome/demoStub.js`)
because the demo experience has not yet been built.

A portfolio visitor — a recruiter, a peer reviewer, or anyone evaluating the
product without intent to sign up — has no way to see the product in motion.
The only paths today are "create an account" or "watch a video that doesn't
exist." That gap hurts the product's value as a portfolio piece.

This feature replaces the placeholder demo stub with an opt-in, interactive
demo experience that runs entirely in the visitor's browser. The demo seeds
realistic starter data, lets the visitor create, edit, archive, filter, and
sort applications and edit the profile, and resets cleanly on browser refresh.
Demo state never reaches Supabase, never authenticates, and never accesses
protected hosted endpoints. Authenticated hosted users are unaffected.

---

## Scope

- Replace the welcome-page "Try the demo" CTA's placeholder behavior
  (`showDemoComingSoon` in `src/pages/welcome/demoStub.js`) with navigation
  into a real, interactive demo experience served by the hosted deploy.
- Add a client-side, in-memory demo data layer that conforms to the
  application's existing data model (applications + profile) and is mounted
  in place of the network-backed services when the app is running in demo.
- Seed the demo with realistic starter content (multiple applications spanning
  multiple distinct statuses; populated profile content) so the visitor lands
  on a non-empty tracker that showcases the primary surfaces.
- Allow the visitor to perform the existing app's core operations — add, edit,
  archive (one-way; the app has no unarchive surface today), change status,
  edit profile, filter, sort, navigate between pages — against the
  in-memory demo store, with no behavioral divergence from the
  authenticated experience aside from persistence.
- Reset demo state on browser refresh so the visitor always returns to the
  seeded starting point. No persistent storage of demo data (no
  `localStorage`, no `sessionStorage`, no IndexedDB, no cookies, no Supabase).
- Hide sign-in, sign-up, and any other authentication surface while the
  visitor is inside the demo. Provide a clear way to exit demo back to the
  welcome page where authentication is available.
- Hide or disable the Resume Import surface in demo (the feature depends on a
  hosted parsing endpoint that requires authentication). If hidden, no
  affordance is rendered. If disabled, the affordance is visible but
  non-interactive and accompanied by messaging that explains authentication
  is required.
- Preserve all existing hosted behavior for authenticated users: persistent
  data via Supabase, full Resume Import, sign-in/sign-out flows, and the
  starter seed from feature 019.

## Non-Goals

- Server-side demo persistence. The portfolio demo is purely
  client-side — no server-side demo store, no `APP_RUNTIME=demo` runtime.
  Feature 019 reserved an `APP_RUNTIME=demo` slot anticipating that 020
  would implement it server-side; with this spec's client-only design,
  that slot is dead code and 020 deletes it (see FR-016).
- Public account creation, anonymous accounts, or "save your demo to an
  account" flows. The brief explicitly excludes these.
- Demo save / export / share / collaborative-demo functionality.
- Analytics or tracking of demo usage. (Constitution: "Analytics, tracking,
  and third-party data sharing MUST be absent by default.")
- Multi-tab synchronization of demo state. Each tab is its own demo session.
- Server-side endpoints, schema, or migration changes. Feature 019 covers
  hosted persistence; 020 introduces no server changes beyond optional
  defensive checks already implicit in 018's `requireAuth`.
- Cross-browser-restart continuity. Closing the browser ends the demo;
  reopening starts fresh. (Refresh is the canonical reset trigger; the same
  effect applies a fortiori on close/reopen.)
- A separate `APP_RUNTIME=demo` deployment (e.g. a demo subdomain). The demo
  lives inside the hosted deploy and is opt-in via the welcome CTA.

---

## User Stories

### User Story 1 — Visitor opts into demo from the welcome page (Priority: P1)

A public visitor arrives at the hosted welcome page, clicks **Try the demo**,
and is taken into an interactive copy of the application pre-populated with
sample data. They are not prompted to create an account, do not authenticate,
and are not stopped by any login wall. The transition is visually intentional
(not a flash of empty state, not an error toast).

**Why this priority**: This is the entry point. Without it, no other demo
behavior is observable.

**Independent Test**: Open the hosted deploy in a private browsing window.
On the welcome page, click "Try the demo." Verify the welcome page is
replaced by the tracker shell, that the tracker shows multiple sample
applications spanning multiple statuses, and that no sign-in, sign-up, or
"create account" prompts are presented as a condition of entry.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor on the welcome page, **When** they
   click the **Try the demo** CTA, **Then** the welcome page unmounts and
   the demo experience mounts with the 23 seeded sample applications
   already visible on the tracker.
2. **Given** the demo is mounted, **When** the visitor inspects the tracker,
   **Then** the seeded dataset contains the 23 records from the SQLite
   seed (in frontend shape) spanning the same set of distinct status
   values, and the profile page renders the populated demo persona
   (Alex Rivera) mirrored from the SQLite profile seed.
3. **Given** the demo is mounted, **When** the visitor navigates the app
   (tracker → profile → calendar → tracker), **Then** the demo data is the
   single source of truth for every page; no API calls are made for
   applications or profile data.

---

### User Story 2 — Visitor interacts with the app and changes feel real (Priority: P1)

Inside the demo the visitor can create an application, edit an existing
one, archive (one-way; matching the existing app, which has no unarchive
surface today), change status, edit the profile, and use filters and
sorting. Every interaction behaves the same as the authenticated
experience from the user's perspective: forms submit, lists update, the
demo data reflects the change immediately and consistently across pages
within the session.

**Why this priority**: A read-only demo fails the brief's core goal
("Interactions should feel fully functional. Demo behavior should not appear
read-only."). Without this, the demo is a static screenshot.

**Independent Test**: In a fresh demo session, create a new application
with all constitution-required fields (company, title, status, last
status update, responsibilities). Verify it appears on the tracker.
Change its status. Verify the status update reflects on the tracker
view and in any status-based filter. Archive it; verify it leaves the
active list (the existing app has no archived-list view today, so the
removal-from-active-list is the full expected outcome). Edit the
profile; verify the change persists through page navigation within the
session.

**Acceptance Scenarios**:

1. **Given** a mounted demo, **When** the visitor creates an application via
   the existing create flow, **Then** the new row appears in the demo data
   immediately and is rendered on the tracker, identical in UX to the
   authenticated flow (validation, required-field enforcement, status
   semantics, etc.).
2. **Given** an application in the demo, **When** the visitor edits or
   archives it, **Then** the change is reflected immediately across every
   view that depends on that record (tracker, status filters; the app has
   no archived-list view today, so archive simply removes from the active
   list).
3. **Given** profile data in the demo, **When** the visitor edits and saves
   the profile, **Then** the updated profile renders on subsequent profile
   views within the same session.
4. **Given** a demo session, **When** filters and sorting are applied to the
   tracker, **Then** they behave identically to the authenticated tracker
   — same available filters, same sort orders, same validation messages on
   forms.

---

### User Story 3 — Demo changes never persist to Supabase or anywhere else (Priority: P1)

Demo writes (create, edit, archive, profile save) never touch the hosted
Supabase project, never authenticate, never call protected hosted endpoints,
and never write to any browser-side persistent storage (`localStorage`,
`sessionStorage`, IndexedDB, cookies). The hosted Supabase database, the
hosted `applications` and `profile` tables, and any authenticated user's data
are byte-for-byte unaffected by any sequence of demo interactions.

**Why this priority**: This is the central privacy and isolation property of
the demo. Without it, a portfolio demo is a data-leak vector — both for the
viewing visitor (their tinkering becomes "real" data) and for any prior
authenticated user whose rows could be touched.

**Independent Test**: With the network panel open and a fresh demo session,
perform several demo writes: create three applications, edit two, archive
one, change a status, edit and save the profile. Verify the network panel
shows zero requests to `/api/applications`, `/api/profile`, or any
Supabase endpoint. Verify `localStorage`, `sessionStorage`, IndexedDB, and
cookies contain no demo application or profile data (a benign session/CSRF
cookie is acceptable; demo content is not). Sign in as a real hosted user
in a separate browser; verify their data is unchanged.

**Acceptance Scenarios**:

1. **Given** an active demo session, **When** any demo write is performed
   (create, edit, archive, status change, profile save), **Then** zero
   requests are sent to the hosted application APIs or to Supabase.
2. **Given** an active demo session, **When** the visitor closes the demo or
   refreshes the page, **Then** no demo content is found in `localStorage`,
   `sessionStorage`, IndexedDB, or cookies under any project-namespaced key.
3. **Given** an active demo session, **When** a real hosted user signs in
   from a separate browser, **Then** their `applications` and `profile`
   rows are unchanged from the moment before the demo session began.

---

### User Story 4 — Demo resets on browser refresh (Priority: P1)

The visitor refreshes the page (browser reload). The demo resets cleanly:
all demo edits are discarded, the demo remounts on the seeded starting
state, and the experience continues to feel intentional rather than broken
(no "lost your session" error, no half-loaded state).

**Why this priority**: Reset behavior is the user-visible promise of
non-persistence. The brief explicitly calls out that reset should feel
intentional. Without a defined reset point, "non-persistent" reads as
"buggy."

**Independent Test**: Inside the demo, create three applications and edit
the profile. Verify they appear on the tracker. Refresh the browser
(Cmd-R / F5). Verify the visitor lands either on the welcome page (the
default unauthenticated landing) or, if the demo route is bookmarkable and
the visitor reloads its URL, on the seeded demo starting state — never on
the modified state. No error toast appears, no "your changes were lost"
banner is required, the welcome / demo state is simply fresh.

**Acceptance Scenarios**:

1. **Given** a demo session with user-made edits, **When** the visitor
   refreshes the browser, **Then** all demo edits are discarded and the
   visitor sees either the welcome page or the seeded starting state of
   the demo (the exact landing page on refresh is decided in the plan
   phase; both are acceptable and neither leaks the prior state).
2. **Given** the demo has been entered, refreshed, and re-entered in the
   same browser tab, **When** the visitor inspects the tracker, **Then**
   the dataset is the seed — identical to the first-entry state — with
   none of the prior session's edits.
3. **Given** the visitor refreshes during an in-flight edit (e.g. modal
   open, unsaved form), **When** the page reloads, **Then** the in-flight
   edit is discarded with no error and the visitor lands on a clean state.

---

### User Story 5 — Resume Import is unavailable in demo (Priority: P2)

The Resume Import feature depends on the hosted parsing endpoint
(`POST /api/resume/parse`), which requires a valid Supabase session token
(feature 018). In demo, the visitor has no session, so the endpoint cannot
be called. The UI MUST NOT present an action that will obviously fail: the
Resume Import affordance is either hidden entirely or rendered in a
disabled state with clear messaging that authentication is required.

**Why this priority**: Avoids a confusing dead end inside the demo. A
visible-but-broken button damages the polish the demo is meant to convey.
This is P2 because hiding/disabling is a small UI change and is not a
blocker for stories 1–4; demo could function without it, just less polished.

**Independent Test**: Inside a demo session, navigate to every surface that
exposes Resume Import in the authenticated experience (today: the welcome
page does not expose it; the authenticated app shell exposes it on the
profile-edit or tracker surfaces — verify the exact list against
`src/components/ResumeImport.js` consumers). Verify the affordance is
either absent or disabled with messaging. Verify no demo action reaches
`/api/resume/parse`.

**Acceptance Scenarios**:

1. **Given** the visitor is inside the demo, **When** they navigate to any
   surface that hosts Resume Import in the authenticated experience,
   **Then** the Resume Import control is either not rendered or is
   rendered disabled with a message explaining authentication is required.
2. **Given** the visitor is inside the demo, **When** any code path that
   would normally call `/api/resume/parse` is reached, **Then** the call
   is not made; the disabled-state messaging is shown instead.
3. **Given** an authenticated user (not in demo), **When** they view the
   same surfaces, **Then** Resume Import is rendered and fully functional
   exactly as before — no demo logic affects the authenticated path.

---

### User Story 6 — Authenticated hosted users are unaffected (Priority: P1)

A signed-in hosted user's experience is byte-equivalent to the post-019
state. Persistent applications and profile, Resume Import, sign-out, the
019 starter seed, and every other authenticated behavior continues to work
exactly as today. The visitor's demo session in another browser, or in a
separate tab, has zero observable effect on the authenticated user's data
or session.

**Why this priority**: The demo must not regress the product's main
value. 019's hosted persistence is the core feature; 020 cannot weaken it.

**Independent Test**: Sign in as a hosted user. Verify the post-019
behavior: existing applications and profile load from Supabase, edits
persist, Resume Import works, the starter seed has run exactly once.
Sign out. Open a separate browser, enter the demo, make edits. Return to
the first browser, sign in again. Verify all hosted data is unchanged from
the prior sign-out state.

**Acceptance Scenarios**:

1. **Given** an authenticated hosted user, **When** they use any
   authenticated flow (CRUD on applications, profile edit, Resume Import,
   sign-out, sign-in), **Then** the behavior is identical to the post-019
   state.
2. **Given** a concurrent demo session in a separate browser, **When** the
   demo session performs writes, **Then** the authenticated user's
   Supabase rows are not modified, read, or touched in any way (no
   Supabase request is made on behalf of the demo).
3. **Given** the existing post-019 automated test suite, **When** it is
   run against the 020 build, **Then** every test continues to pass
   without modification, except where the suite is explicitly extended to
   cover 020 behavior.

---

## Edge Cases

- **Visitor enters demo, then clicks a sign-in surface that is hidden but
  reachable by keyboard or URL**: there should be no such surface. If any
  navigation reaches a sign-in form from inside the demo, the demo's "auth
  hidden in demo entirely" property is broken and the demo MUST treat that
  navigation as an exit (return to the welcome page and end the demo).
- **Visitor inside demo navigates directly to the welcome URL (or sign-in
  URL) via the address bar**: this is an explicit exit. The demo ends, the
  in-memory demo state is discarded, and the welcome page renders fresh.
- **Visitor enters demo, refreshes, and lands on a demo URL that no longer
  has its state**: the demo remounts on the seeded starting state. No error
  banner is required; the seed is the canonical "blank slate."
- **Visitor uses browser back / forward navigation across welcome ↔ demo**:
  forward into the demo remounts (and re-seeds, since the in-memory store
  is gone after a back-out). Back from the demo to welcome ends the demo
  cleanly. No demo state is retained across navigations once the in-memory
  store unmounts.
- **Visitor opens multiple tabs of the demo**: each tab is an independent
  session with its own in-memory store. Edits in tab A are not visible in
  tab B; this is intentional and consistent with the "in-memory, refresh
  resets" model.
- **Visitor enters demo, then triggers a real network request the demo
  forgot to stub** (e.g. a future feature adds a new API call without
  routing it through the demo adapter): the request would be unauthenticated
  and would be rejected by 018's `requireAuth` with a 401. The demo MUST
  catch this category of failure as a test/integration gap (covered by
  story 3's acceptance scenario 1: zero requests to protected APIs from
  demo) and not surface a confusing error to the visitor.
- **A hosted-side defense-in-depth check fails open**: even if the client
  somehow attempts a demo-style request against `/api/applications` or
  `/api/profile`, 018's `requireAuth` rejects it with 401 because no
  session token is presented. There is no path by which demo writes can
  reach Supabase even if the client bundle is tampered with.
- **`APP_RUNTIME=demo` is set on the hosted deploy after 020 ships**: the
  config loader rejects `demo` as an invalid runtime value at boot and
  exits with a clear error naming the two valid values (`local`, `hosted`).
  The portfolio demo does not require — and the server no longer
  recognizes — `APP_RUNTIME=demo`.
- **Visitor enters demo on a browser with `localStorage` disabled or
  blocked**: the demo still works because state is in-memory only. (The
  authenticated app's tracker uses an in-memory `store` plus `localStorage`
  persistence today; demo MUST NOT call `store.save()` in a way that
  writes to `localStorage` for demo data.)
- **Visitor in demo opens DevTools and edits in-memory state**: this is
  acceptable. Demo state is not security-sensitive; tampering only affects
  the visitor's own view.

---

## Requirements

### Functional Requirements

- **FR-001**: The hosted deploy MUST provide an interactive demo experience
  that an unauthenticated visitor can enter from the welcome page's
  existing **Try the demo** CTA. The CTA MUST be wired to navigate into
  the demo (replacing the current `showDemoComingSoon` toast in
  `src/pages/welcome/demoStub.js`).
- **FR-002**: While inside the demo, the visitor MUST be able to perform
  the application's existing core operations: add an application, edit
  an application, archive/unarchive, change status, edit the profile,
  filter the tracker, sort the tracker, and navigate between pages
  (tracker, profile, calendar, etc.). The set of available operations
  MUST match the authenticated experience.
- **FR-003**: The demo MUST seed the in-memory store with realistic
  starter content on entry. The seeded applications MUST mirror the
  **23 records** from the existing SQLite dev seed (`server/db-seed.js`
  → `DEMO_RECORDS`), translated from the SQLite storage shape to the
  frontend shape, with calendar dates shifted so the most recent record
  reads as "today" (preserving the relative spacing between records).
  The seeded profile MUST mirror the existing SQLite profile seed
  (`server/db-seed-profile.js` → `DEMO_PROFILE`) verbatim — full
  experience, education, skills, languages, certifications, awards, and
  links arrays. Updates to either SQLite seed SHOULD be mirrored into
  the demo fixture in the same PR.
- **FR-004**: The demo data MUST be stored exclusively in client-side,
  in-memory state for the duration of a single browser tab session. The
  demo MUST NOT write demo content to `localStorage`, `sessionStorage`,
  IndexedDB, or cookies, and MUST NOT call hosted application or profile
  APIs (`/api/applications`, `/api/profile`, `/api/resume/parse`) or
  Supabase directly.
- **FR-005**: A browser refresh (page reload) MUST reset the demo to its
  seeded starting state. Discarding the in-memory store on unload is the
  required mechanism. After refresh, the visitor MUST see either the
  welcome page or the seeded demo state; they MUST NOT see any
  pre-refresh edits.
- **FR-006**: While inside the demo, sign-in, sign-up, and any other
  authentication entry-point MUST be hidden from the UI. The visitor's
  only path back to authentication is exiting the demo (e.g. via a clear
  "Exit demo" affordance or by navigating to the welcome URL).
- **FR-007**: The demo MUST provide a discoverable way to exit back to
  the welcome page where authentication is available. The exit affordance
  MUST be visible without entering modal flows and MUST work via keyboard.
- **FR-008**: While inside the demo, the Resume Import UI MUST be either
  hidden entirely or rendered in a disabled state with a clear message
  that authentication is required. The exact treatment (hidden vs disabled)
  is a plan-phase decision; both MUST satisfy the requirement that no
  demo action attempts `/api/resume/parse` and no broken affordance is
  presented as functional.
- **FR-009**: The demo MUST validate user input identically to the
  authenticated experience: constitution-required fields (company, title,
  status, last status update, responsibilities) MUST be enforced; URL
  fields MUST be validated; date fields MUST use the project's standard
  format. Validation rules MUST be the same module used by the
  authenticated experience — no duplicated validation logic in the demo.
- **FR-010**: The demo MUST present status transitions identically to
  the authenticated experience. The same status vocabulary, the same
  transition guards, and the same non-color status indicators MUST apply.
- **FR-011**: The authenticated hosted experience (sign-in, persistent
  applications, persistent profile, Resume Import, sign-out, the 019
  starter seed) MUST remain byte-equivalent to its post-019 behavior.
  Demo work MUST NOT alter authenticated code paths beyond the minimum
  necessary to mount the demo from the welcome page.
- **FR-012**: 018's `requireAuth` middleware MUST continue to reject
  unauthenticated requests on every protected endpoint. The demo MUST
  NOT relax, bypass, or weaken hosted authentication enforcement.
- **FR-013**: The demo MUST NOT introduce any analytics, tracking,
  third-party telemetry, or external data-sharing surface. Per the
  constitution: "Analytics, tracking, and third-party data sharing MUST
  be absent by default."
- **FR-014**: The demo experience MUST be usable on desktop and mobile
  browsers, with labeled forms, keyboard navigation for core workflows,
  and non-color-only status indicators (constitution, Privacy /
  Accessibility / Extensibility Constraints).
- **FR-015**: The demo's seeded data MUST be defined in code (a fixture
  module) rather than fetched from a network resource. The fixture MUST
  be reproducible byte-for-byte across visitors on the same build.
- **FR-016**: Because this feature ships the portfolio demo entirely
  client-side, the server-side `APP_RUNTIME=demo` slot reserved by
  019 has no remaining purpose and MUST be removed. Specifically:
  `'demo'` MUST be removed from the valid `APP_RUNTIME` set in the
  config loader; the `config.isDemo` flag MUST be removed; the
  `DemoRepositoryNotImplementedError` class and the `createDemoStub`
  helper MUST be removed from `server/repositories/index.js`; the
  `if (config.isDemo)` short-circuit in `assertHostedSchema` MUST be
  removed; and all server-side tests and docs that reference the
  removed surface MUST be updated. Booting with `APP_RUNTIME=demo`
  after 020 ships MUST fail at config load with a clear error.

### Key Entities

- **Demo Session**: The in-memory client state representing one visitor's
  current demo run. Created when the visitor enters demo, discarded on
  refresh, navigation away from demo, or tab close. Holds the demo's
  copy of applications and profile.
- **Demo Seed Fixture** (`src/data/demoSeed.js`): A static, code-defined
  module that mirrors the SQLite seeds (FR-003) — 23 applications from
  `DEMO_RECORDS` translated to frontend shape, with relative dates, plus
  the `DEMO_PROFILE` persona verbatim.
- **Demo Mode Flag**: The new `'demo'` value on `authStore.state.status`.
  Used to (a) route data-layer reads/writes through the service-layer
  switch to the demo in-memory store, (b) hide authentication surfaces
  via Navbar's status-based branching, and (c) hide the Resume Import
  surface via `ResumeImport.VISIBLE_STATUSES` exclusion.
- **Demo Data Adapter** (`src/data/demoStore.js`): A new client-side
  module satisfying the same call shape as `src/services/api.js`'s
  exports, operating entirely in memory against the demo seed fixture.
  The service-layer switch in `services/api.js` delegates to this
  module when `authStore.status === 'demo'`.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A new portfolio visitor lands on the hosted welcome page,
  clicks **Try the demo**, and is inside an interactive copy of the app
  with all 23 seeded applications and the seeded persona's profile
  visible, having taken zero authentication actions.
- **SC-002**: Inside the demo, every existing core operation (add, edit,
  archive, status change, profile edit, filter, sort, page navigation)
  works without throwing, without showing an error toast, and with
  visible effect on subsequent reads within the session.
- **SC-003**: Over a complete demo session (entry → many writes → refresh
  → re-entry), zero requests are sent to `/api/applications`,
  `/api/profile`, `/api/resume/parse`, or any Supabase endpoint.
- **SC-004**: After a browser refresh inside the demo, the visitor sees
  no trace of their prior session's edits: applications match the seed
  fixture exactly; the profile matches the seed fixture exactly.
- **SC-005**: Inside the demo, no sign-in, sign-up, or other
  authentication-entry affordance is reachable through normal UI
  navigation. The only path to authentication is exiting the demo.
- **SC-006**: Inside the demo, the Resume Import surface is either
  absent or visibly disabled with a message; no demo path reaches
  `POST /api/resume/parse`.
- **SC-007**: With the demo unmounted (a real signed-in hosted user, or
  any post-019 automated test), every authenticated behavior — sign-in,
  CRUD, profile, Resume Import, sign-out, the 019 starter seed —
  matches the post-019 state exactly. No regression.
- **SC-008**: After a complete demo session in browser A, a hosted
  user's data in browser B (signed in before, during, and after the
  demo) is unchanged byte-for-byte from the moment before the demo
  began.
- **SC-009**: All constitution-required validation rules
  (company / title / status / last status update / responsibilities,
  URL validation, date format) apply identically inside the demo and
  inside the authenticated experience, sourced from the same validation
  modules — no duplicated rules.
- **SC-010**: The demo build introduces no new persistent
  client-side storage of demo data: an automated check
  (`localStorage`, `sessionStorage`, IndexedDB, cookies) after a
  representative demo session finds no project-namespaced demo content.

---

## Data Considerations

### Owned by this feature

- **Demo Seed Fixture (client-side module)**: a code-defined fixture of
  sample applications (multiple, spanning multiple distinct statuses)
  plus a populated sample profile. Lives entirely in the client bundle.
  Exact content is a plan-phase decision.
- **Demo in-memory data store (client-side)**: the per-tab, per-session
  in-memory representation of the visitor's working dataset during a
  demo. No persistence. Discarded on refresh or tab close.
- **Demo Mode Flag and Demo Data Adapter (client-side modules)**: the
  client routing/signal mechanisms that cause the app to use the demo
  data store rather than the network APIs while in demo, and that hide
  authentication and Resume Import surfaces.

### Inherited unchanged

- 018's `requireAuth` middleware. The demo does not alter, weaken, or
  bypass authentication enforcement on the server side.
- 019's hosted Supabase repositories, the per-user RLS policies, the
  first-call starter seed, and the repository dispatcher's `local` /
  `hosted` branches. (The `demo` branch reserved by 019 is removed by
  this feature — see FR-016.)
- The existing client-side data contract used by `src/data/store.js`,
  page modules (`Tracker`, `Profile`, `ProfileEdit`, etc.), and form
  validation modules. The demo plugs in behind the same contract.

### Not changed by this feature

- Server-side schema, migrations, or persistence behavior. No Supabase
  changes. No SQLite changes.
- Hosted environment variables. The demo lives inside the hosted deploy
  and consumes the existing `APP_RUNTIME=hosted` boot.
- Authenticated-flow code paths beyond the minimum needed to mount the
  demo (e.g. the welcome-page CTA's existing `showDemoComingSoon`
  handler becomes a real navigation handler; downstream pages route
  data access through the demo adapter when the demo flag is set).
- The 019 starter seed for hosted users. That seed continues to run on
  a hosted user's first authenticated API call, unchanged.

---

## Assumptions

- 019's hosted persistence has shipped and the post-019 hosted experience
  is the baseline the demo coexists with. (Confirmed: current branch is
  cut from `main` at `97ac4ca`, post-019.)
- The visitor's browser supports modern in-memory JS state and the
  existing app's runtime requirements. The demo does not need to
  support browsers that the authenticated experience does not.
- Demo state lives in client-side, in-memory JS for the lifetime of one
  tab session. Refresh-as-reset is the canonical reset trigger. (Tab
  close is implicitly equivalent.)
- The hosted deploy is the only deploy that needs to expose the demo.
  Local SQLite mode does not need a demo (the developer can use the
  existing local mode). A future `APP_RUNTIME=demo` deployment is out
  of scope.
- The "Try the demo" CTA already exists on the welcome page and is
  intentionally placed there. This feature rewires its handler; it does
  not redesign the welcome page.
- Constitution-required validation modules (e.g.
  `server/validation/application.js`, `src/models/application.js`) can
  be reused on the client side for demo writes without server round-trip.
  Validation today is run client-side before submit, so this is a
  reasonable assumption; the plan phase confirms the exact module
  boundaries.
- The Resume Import affordance is currently exposed only inside the
  authenticated app shell (not on the welcome page). The plan phase
  confirms its exact mount points and chooses hidden vs disabled
  treatment per surface.

---

## Dependencies

- **Feature 017 (hosted-foundation)**: Runtime config and the hosted
  deployment that this demo lives inside. Consumed unchanged.
- **Feature 018 (auth-user-access)**: Authentication enforcement on
  protected endpoints. Consumed unchanged; the demo never attempts
  authenticated calls, and 018's `requireAuth` is the defense-in-depth
  guarantee that even a tampered client cannot reach hosted data via
  the demo.
- **Feature 019 (supabase-persistence)**: Hosted persistence (the
  `local` and `hosted` repository dispatcher branches) is consumed
  unchanged. 019's `demo` dispatcher branch — which was reserved for
  this feature — is removed by 020 (FR-016); the `local` and `hosted`
  behavior, the per-user RLS policies, and the 019 starter seed are
  all untouched.
- **Existing welcome page (`src/pages/welcome/`)**: This feature replaces
  the placeholder `demoStub.showDemoComingSoon` handler with real demo
  navigation. The welcome page's CTA, layout, and copy are unchanged
  unless plan-phase work surfaces a need.
