# Feature Specification: Supabase Persistence for Hosted Mode

**Feature Branch**: `019-supabase-persistence`
**Created**: 2026-05-17
**Status**: Draft
**Input**: `features/019-supabase-persistence.md`

---

## Problem Statement

Feature 017 established the hosted runtime contract (Vercel + Supabase) and stubbed
hosted repository methods to throw `HostedRepositoryNotImplementedError`. Feature 018
added Supabase authentication and a per-request user identity, and explicitly
documented — without implementing — the per-user ownership model (`user_id` columns
plus RLS policies) that hosted persistence will rely on.

Hosted authenticated users today have no persistent storage. Every protected hosted
API route still throws because the repositories return stubs. Until 019 lands, hosted
mode authenticates users but cannot actually retain their data across requests, much
less across sessions.

This feature adds Supabase-backed repository adapters for `applications` and `profile`,
wires runtime-based repository dispatch (local → SQLite, hosted → Supabase, demo →
stub for feature 020), enforces per-user ownership end-to-end via RLS and server-side
filtering, and lazily seeds starter content on a hosted user's first authenticated API
call. Local SQLite mode is preserved unchanged.

---

## Scope

- Implement Supabase-backed repository adapters for `applications` and `profile`,
  preserving the existing repository contract used by route handlers
  (`getAll`, `getById`, `create`, `update`, `archive`; `get`, `upsert`).
- Replace the hosted-mode `createHostedStub` path in `server/repositories/index.js`
  with the real Supabase adapters; preserve the SQLite path for local mode.
- Add a `demo` runtime mode to the repository dispatcher as a routing slot only —
  a stub repository that throws a `DemoRepositoryNotImplementedError` for every call.
  Real demo behavior (session-only in-memory data) is owned by feature 020.
- Add `user_id` columns to hosted `applications` and `profile` tables, populate the
  RLS policies documented in 018 (`USING (user_id = auth.uid())` and
  `WITH CHECK (user_id = auth.uid())`), and wipe pre-019 hosted rows during the
  schema change per 018's *Accepted Limitations*.
- Enforce ownership server-side in the repository layer: every read scopes by the
  authenticated user id resolved by 018's middleware; every write sets `user_id` from
  that same context (never from the request body).
- Seed starter content on a hosted user's first authenticated API call, exactly once
  per Supabase user id. Exact fixture content is decided in the plan phase.
- Preserve local SQLite repositories and behavior. Local mode never touches Supabase,
  never gates by `user_id`, and never seeds starter data.

## Non-Goals

- Automated migration of pre-019 local SQLite data into hosted Supabase.
- Migration of any pre-019 hosted data — the schema change wipes hosted
  `applications` and `profile` rows per 018's *Accepted Limitations*.
- Cross-device sync for local SQLite mode.
- Offline support for hosted mode.
- Multi-user sharing, collaboration, or workspace concepts.
- Conflict resolution or last-write-wins protocols beyond what Supabase Postgres
  already provides for single-user writes.
- Real demo-mode behavior (session-only in-memory repositories). Owned by feature 020.
- New authentication or allowlist work — owned by 018, consumed unchanged here.
- Frontend changes beyond what is required for hosted CRUD to round-trip through the
  new adapters. The frontend remains unaware of the persistence backend.

---

## User Stories

### User Story 1 — Hosted user creates and retrieves applications that persist (Priority: P1)

A signed-in hosted user adds an application via the tracker. The application is
stored in Supabase under their `user_id`. Reloading the tracker, refreshing the page,
or signing in from a different browser in the same hosted environment shows the same
application list. The user can edit, archive, and view applications, and every
operation persists.

**Why this priority**: Persistent application tracking is the core promise of
hosted mode. Without it, feature 018's authentication has no payload.

**Independent Test**: Sign in as an allowlisted hosted user. Create three applications
via the UI. Refresh the page. Verify all three appear and that
`GET /api/applications` returns them with `user_id` matching the signed-in user.
Sign out, sign back in, repeat — same rows.

**Acceptance Scenarios**:

1. **Given** a signed-in hosted user, **When** they create an application via the API,
   **Then** the row is persisted in Supabase with `user_id` set to the
   authenticated user's id and is returned to the client without exposing `user_id`
   in the response body (response shape unchanged from 017/018).
2. **Given** a signed-in hosted user with existing applications,
   **When** they call `GET /api/applications`, **Then** the response contains only
   rows where `user_id = auth.uid()`; rows belonging to other users are never
   returned.
3. **Given** a signed-in hosted user, **When** they edit or archive an application
   they own, **Then** the change persists and is reflected on subsequent reads.

---

### User Story 2 — Hosted user edits a persistent profile (Priority: P1)

A signed-in hosted user opens the profile page, fills in or edits their profile, and
saves. The profile persists per user. Reloading, signing out and back in, or returning
later in the same hosted environment shows the same profile content.

**Why this priority**: Profile editing is the second core hosted UX promise. The
profile entity also drives downstream features (resume parser, smart-parse) that
expect a user-scoped profile row.

**Independent Test**: Sign in as a hosted user. Edit and save the profile. Refresh
the page; verify the values persist. Sign out, sign back in; verify the same values
remain. Verify a second hosted user (different `user_id`) sees a different profile,
not the first user's.

**Acceptance Scenarios**:

1. **Given** a signed-in hosted user with no existing profile, **When** they save
   profile content, **Then** a profile row is created with their `user_id` and is
   returned on subsequent `GET /api/profile` requests.
2. **Given** a signed-in hosted user with an existing profile, **When** they save
   updated content, **Then** the existing row is updated in place (one profile row
   per user) and the response reflects the new values.
3. **Given** two distinct hosted users, **When** each calls `GET /api/profile`,
   **Then** each receives only their own profile row.

---

### User Story 3 — Newly approved hosted user is greeted with seeded starter content (Priority: P2)

After an allowlisted user verifies their email and signs in for the first time,
their first authenticated API call triggers a one-time seed of sample
**applications** under their `user_id`. The profile is intentionally left
**empty** so the first profile-edit prompt is part of onboarding. Subsequent
calls do not re-seed — the seed runs at most once per Supabase user id.
Subsequent edits, deletions, or re-creations behave as normal user-owned data.

**Why this priority**: The starter applications are a UX polish for the
first-run hosted experience. They are not required for hosted mode to function
— an empty seed would still satisfy stories 1 and 2 — but they remove empty-
state friction on the tracker. The profile starting empty is deliberate so
the user sees their own placeholder prompt rather than someone else's
fabricated identity.

**Independent Test**: Provision a fresh allowlisted email. Sign up, verify, sign in.
Call `GET /api/applications` and `GET /api/profile`. Verify `GET /api/applications`
returns the seeded sample applications owned by the new user's `user_id`, and
`GET /api/profile` returns null / no row. Call `GET /api/applications` a second
time and verify no duplicate seed rows were created. Delete a seeded application
and verify it does not reappear on subsequent reads. Save the profile once;
verify the row is created and persists on subsequent reads.

**Acceptance Scenarios**:

1. **Given** a hosted user with zero rows in `applications` and `profile`,
   **When** they make their first authenticated API call, **Then** the server
   seeds the sample applications under their `user_id` exactly once,
   `GET /api/applications` returns those rows, and `GET /api/profile` returns
   no row (the profile is intentionally not seeded).
2. **Given** a hosted user whose seed has already run, **When** they make another
   authenticated API call, **Then** the seed does not run again and no duplicate
   application rows are created — even if the user has since deleted some or
   all of the originally-seeded rows.
3. **Given** two hosted users, **When** each triggers their first authenticated
   API call, **Then** each receives their own copy of the seeded applications
   scoped to their own `user_id`; no rows are shared between users; both
   start with no profile row.

---

### User Story 4 — Local SQLite mode is unchanged (Priority: P1)

A developer runs the app in local mode (`APP_RUNTIME=local`, the default). All
existing SQLite behavior is preserved: applications and profile persist to the
local SQLite file, no Supabase calls are made, no `user_id` column or RLS is
enforced, no starter seed runs on first request, and all existing automated
tests pass without modification.

**Why this priority**: Local mode is the primary developer workflow per 017's
contract. Any regression breaks every contributor's loop.

**Independent Test**: With `APP_RUNTIME=local`, start the dev server. Run the
existing applications and profile test suites. Use the tracker UI to create,
edit, and archive applications and to edit the profile. Verify the SQLite file is
written, no network calls to Supabase are attempted, and all existing tests
pass unchanged.

**Acceptance Scenarios**:

1. **Given** `APP_RUNTIME=local`, **When** the server boots, **Then** no Supabase
   client is instantiated and no hosted-required env vars are consulted.
2. **Given** local mode, **When** existing applications and profile tests run,
   **Then** they pass without modification.
3. **Given** local mode, **When** the user performs CRUD via the UI, **Then**
   data persists to SQLite and the behavior is byte-equivalent to pre-019.

---

### User Story 5 — Repository routing dispatches by runtime mode (Priority: P1)

The repository factory dispatches based on `config.runtime`: `local` returns the
existing SQLite repositories, `hosted` returns Supabase-backed repositories,
`demo` returns a stub that throws `DemoRepositoryNotImplementedError` (feature 020
will replace this stub). Selection is centralized in the existing
`server/repositories/index.js` entry point; route handlers and the frontend remain
unchanged.

**Why this priority**: Centralized dispatch is the architectural constraint the
brief calls out explicitly ("Repository selection should be centralized. Frontend
should remain unaware of persistence implementation details"). Without it, every
route handler becomes mode-aware and the next runtime mode (demo) requires
changes scattered across the route layer.

**Independent Test**: Boot the server in each of the three modes. Inspect that
`createRepositories(config)` returns SQLite adapters for `local`, Supabase
adapters for `hosted`, and the demo stub for `demo`. Verify no route handler
needs `if (config.runtime === ...)` branching to function.

**Acceptance Scenarios**:

1. **Given** `APP_RUNTIME=local`, **When** repositories are created, **Then**
   the SQLite implementations are returned.
2. **Given** `APP_RUNTIME=hosted`, **When** repositories are created, **Then**
   the Supabase implementations are returned and are configured with the
   hosted-required Supabase env vars from 017.
3. **Given** `APP_RUNTIME=demo`, **When** any repository method is invoked,
   **Then** it throws `DemoRepositoryNotImplementedError` with a message pointing
   to feature 020 (mirroring 017's `HostedRepositoryNotImplementedError` pattern).

---

### User Story 6 — Ownership enforcement is layered (server + RLS) (Priority: P1)

A request bearing user A's valid session token attempts to read, edit, or delete
user B's data. The server-side repository filter rejects the request (no row
returned for reads; not-found for writes against a non-owned id), and even if the
server filter were bypassed, Supabase's RLS policies refuse the operation at
the database layer.

**Why this priority**: Ownership is the central security property of hosted
mode. 018's review explicitly designated server-side enforcement as primary
and RLS as defense-in-depth. Both layers must hold.

**Independent Test**: Create two hosted users A and B, each with their own
applications. Using A's session token, attempt `GET /api/applications/{B_app_id}`,
`PUT /api/applications/{B_app_id}`, and `DELETE /api/applications/{B_app_id}`.
Verify each returns the appropriate not-found response without leaking B's data.
Bypass the server filter in a test harness (call the Supabase adapter directly
with A's token but B's id) and verify RLS still refuses.

**Acceptance Scenarios**:

1. **Given** a request from user A for a resource owned by user B, **When** any
   read or write is attempted, **Then** the response is indistinguishable from
   the resource not existing — no information leak via differing status codes
   or response bodies.
2. **Given** a write request that includes a `user_id` field in the body,
   **When** it is processed, **Then** the supplied `user_id` is ignored and
   the row's `user_id` is taken from the authenticated session.
3. **Given** the server-side ownership filter is bypassed in a controlled test,
   **When** the Supabase adapter attempts the operation, **Then** RLS refuses
   it (database-level error or zero rows affected), confirming defense in depth.

---

## Edge Cases

- **Hosted user has zero rows but seed has already run once**: the seed marker
  is persisted (per-user); a user who deletes all their seeded content does
  not get re-seeded on subsequent requests. They keep their (now-empty) workspace.
- **First authenticated API call is a write, not a read**: the seed runs before
  the write is processed. The newly-seeded rows do not collide with the
  incoming write; the write is appended.
- **First authenticated API call races with itself (two concurrent first calls)**:
  the seed must be idempotent and concurrency-safe — exactly one seed runs per
  user; the second concurrent request either waits or observes the seed marker
  already set. No duplicate seed rows are created.
- **Hosted mode is configured but Supabase is unreachable**: requests fail with
  a 5xx response and a clear error; the server does not silently fall back to
  SQLite or to demo mode.
- **`user_id` column is missing or RLS policies are not applied at boot**: the
  Supabase adapters' first read or write fails loudly. The server has no runtime
  mitigation; the operator must run the 019 migration before the deploy. The
  plan-review checklist makes this a P0 gate, mirroring 018's allowlist-trigger
  pattern.
- **Session token expires mid-request**: 018's middleware already rejects the
  request with 401 before it reaches the repository layer. The repository never
  sees an expired-token request.
- **Local mode tries to import a Supabase adapter**: the import path remains
  lazy (matching 017's pattern for SQLite). Local mode must never touch a
  Supabase module at import time.
- **A pre-019 hosted row exists in the database after the migration runs**:
  the migration wipes pre-019 hosted `applications` and `profile` rows by
  contract (018's *Accepted Limitations*). No pre-019 rows should remain to
  trigger this case; if any do, the migration is considered incomplete and
  the deploy fails the plan-review gate.
- **`APP_RUNTIME=demo` is set without 020 having shipped**: every protected API
  call throws `DemoRepositoryNotImplementedError`. This is intentional — the
  demo slot is reserved by 019 but only functional once 020 lands.
- **Profile upsert when no profile row exists yet for the user**: the upsert
  creates the row; subsequent upserts update it. One row per user is the invariant.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST implement Supabase-backed repository adapters for the
  `applications` and `profile` entities that satisfy the existing repository
  contract used by `server/routes/applications.js` and `server/routes/profile.js`.
- **FR-002**: System MUST replace the hosted-mode stub returned by
  `createRepositories(config)` (currently `createHostedStub` in
  `server/repositories/index.js`) with the Supabase adapters when
  `config.runtime === 'hosted'`.
- **FR-003**: System MUST preserve the SQLite repositories returned by
  `createRepositories(config)` when `config.runtime === 'local'` and MUST NOT
  modify SQLite schema, behavior, or persistence semantics.
- **FR-004**: System MUST extend the `APP_RUNTIME` value set with a third value
  `demo` (in addition to `local` and `hosted`) and MUST update the config loader
  to accept `demo` as a valid runtime.
- **FR-005**: System MUST return a stub demo repository — throwing
  `DemoRepositoryNotImplementedError` with a message referencing feature 020 —
  when `config.runtime === 'demo'`. No real demo data handling is implemented in
  this feature.
- **FR-006**: Repository selection MUST remain centralized in
  `server/repositories/index.js`. Route handlers MUST NOT branch on
  `config.runtime`.
- **FR-007**: System MUST add a non-nullable `user_id` column referencing
  `auth.users(id)` ON DELETE CASCADE to the hosted `applications` and `profile`
  tables, exactly matching the column shape documented in 018's spec
  (*Documented for feature 019* section).
- **FR-008**: System MUST apply Supabase Row Level Security policies to
  `applications` and `profile` per 018's documented shape:
  `USING (user_id = auth.uid())` and `WITH CHECK (user_id = auth.uid())` on
  SELECT, INSERT, UPDATE, and DELETE.
- **FR-009**: System MUST wipe pre-019 hosted `applications` and `profile` rows
  during the schema change that introduces `user_id`. This is the resolution
  promised in 018's *Accepted Limitations*. No backfill or attribution attempt
  is made.
- **FR-010**: Supabase repository adapters MUST scope every read by the
  authenticated user id resolved by 018's middleware (queries filter by
  `user_id = <authenticated user id>` in addition to RLS doing the same).
- **FR-011**: Supabase repository adapters MUST set `user_id` on every write
  from the authenticated user identity exposed by 018's middleware. Any
  `user_id` value present in the request body MUST be ignored.
- **FR-012**: On the first authenticated API call from a given hosted user (any
  protected route), the system MUST seed a one-time starter dataset of sample
  **applications** under that user's `user_id`. The profile is intentionally
  seeded **empty** — the first profile edit creates the row as part of
  onboarding. Exact fixture content (specific applications) is decided in
  the plan phase; the spec only requires that the seeded set demonstrates
  the tracker's primary surfaces (multiple distinct statuses).
- **FR-013**: The seeding step MUST be idempotent and concurrency-safe: exactly
  one seed runs per Supabase user id, even if the user makes multiple concurrent
  first requests, deletes seeded rows, or signs out and back in.
- **FR-014**: The seed marker (the durable signal that a user has already been
  seeded) MUST persist alongside hosted user data such that it survives
  server restarts and deploys. The marker MUST NOT be inferable from the
  presence or absence of `applications` / `profile` rows — a user who deletes
  all seeded content MUST NOT be re-seeded.
- **FR-015**: Cross-user access attempts (reading or writing a row whose
  `user_id` does not match the authenticated user) MUST behave indistinguishably
  from the row not existing — no differential responses that leak ownership.
- **FR-016**: Ownership enforcement MUST be layered: server-side filtering in
  the repository adapters is the primary enforcement; RLS policies are
  defense-in-depth. Both MUST be present; neither MUST be assumed sufficient
  on its own.
- **FR-017**: Repository response shapes (the objects route handlers return to
  the client) MUST remain identical to the pre-019 SQLite shapes. `user_id`
  MUST NOT appear in API responses unless an explicit need surfaces during the
  plan phase. The frontend remains unaware of persistence implementation
  details (consistent with the brief's architectural constraint).
- **FR-018**: The Supabase adapter modules MUST NOT be imported at module load
  time in local mode. The lazy-import pattern from `server/repositories/index.js`
  (used today for SQLite imports) MUST be preserved and applied to the new
  Supabase imports.
- **FR-019**: Repository-level validation, status-transition rules, and
  required-field enforcement MUST continue to live in the existing API /
  validation layer, not in the persistence adapters. Adapters MUST focus on
  storage responsibilities only (per the brief's architectural constraint).
- **FR-020**: System MUST preserve all constitution-required application
  fields (company name, job title, status, last_status_update,
  responsibilities) and status semantics across both adapters. No silent data
  corruption or shape divergence between SQLite and Supabase is permitted.
- **FR-021**: Hosted mode MUST fail loudly at server boot if the migration that
  introduces `user_id` and applies RLS has not been run against the configured
  Supabase project. Detection MAY be a smoke query the server performs at
  startup (e.g. introspecting the column or attempting a no-op query); the
  detection mechanism is a plan-phase decision. The server MUST NOT silently
  serve from a pre-019 schema in hosted mode.
- **FR-022**: System MUST preserve 018's hosted security posture without
  regression: protected routes still require a valid session token, the
  allowlist trigger still gates signup, and no path through 019's changes
  weakens 018's enforcement.

### Key Entities

- **Hosted Application (Supabase)**: A row in the hosted `applications` table.
  Same logical shape as the SQLite Application, plus a non-nullable `user_id`
  column referencing `auth.users(id)`. Owned by exactly one Supabase user;
  ownership is enforced by both server-side filtering and RLS.
- **Hosted Profile (Supabase)**: A row in the hosted `profile` table.
  Same logical shape as the SQLite Profile, plus a non-nullable `user_id`
  column. Exactly one profile row per Supabase user; the row is created on
  first upsert (or seeded by the first-call seed).
- **Repository Dispatcher**: The factory in `server/repositories/index.js` that
  returns SQLite, Supabase, or demo-stub repositories based on `config.runtime`.
  The single source of truth for runtime-to-adapter selection.
- **Demo Repository Stub**: A no-op repository whose methods throw
  `DemoRepositoryNotImplementedError`, reserving the routing slot for feature
  020. Mirrors the `HostedRepositoryNotImplementedError` stub introduced by 017.
- **Starter Seed Marker**: A durable per-user signal that a user has been
  seeded. Independent of the presence of seeded rows (so deletion does not
  re-seed). Storage and shape are a plan-phase decision (candidates: a column
  on `profile`, a dedicated `user_seed_state` table, or a Supabase user
  metadata field) — the spec requires only the behavior in FR-013 and FR-014.
- **Seed Fixture**: The starter content seeded for new hosted users. Content
  is defined in the plan phase; the spec sets the goal (populated tracker
  spanning multiple distinct statuses). The profile is intentionally not
  seeded — the first user-driven upsert creates the row as part of
  onboarding.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A hosted user can create, read, update, and archive applications
  via the API, and every operation persists across page refreshes, sign-outs,
  and server restarts.
- **SC-002**: A hosted user's profile persists across page refreshes,
  sign-outs, and server restarts. The user sees exactly one profile and it is
  their own.
- **SC-003**: Two hosted users with overlapping or identical content never see
  each other's rows. `GET /api/applications` and `GET /api/profile` return
  only the requesting user's data.
- **SC-004**: A newly approved hosted user, on their first authenticated API
  call, receives a populated tracker (multiple sample applications spanning
  multiple distinct statuses). The profile starts empty — the user's first
  profile save creates the row.
- **SC-005**: Across repeated first-call scenarios — refresh during seed,
  concurrent first calls, sign-out-and-back-in immediately after seed,
  delete-all-then-call — exactly one seed runs per Supabase user id. No
  duplicate seed rows exist for any user under any of these scenarios.
- **SC-006**: Local SQLite mode boots and operates with no Supabase imports,
  no Supabase network calls, and no regression in the existing applications
  or profile test suites.
- **SC-007**: `APP_RUNTIME=hosted` boots successfully against a Supabase
  project that has the 019 migration applied; it fails fast with a clear
  error against a project that does not.
- **SC-008**: `APP_RUNTIME=demo` boots successfully and routes repository
  selection to the demo stub; every protected API call returns an error
  identifying feature 020 as the owner (mirroring 017's hosted-stub UX).
- **SC-009**: A cross-user access attempt (user A's session token, user B's
  resource id) returns a response indistinguishable from the resource not
  existing — no body content, no status code, no header reveals ownership.
- **SC-010**: With server-side filtering bypassed in a controlled test, RLS
  still refuses cross-user reads and writes — confirming defense-in-depth.

---

## Data Considerations

### Owned by this feature

- **Migration: add `user_id` to hosted `applications`**
  - Non-nullable `uuid` referencing `auth.users(id)` ON DELETE CASCADE.
  - Pre-019 rows are deleted as part of the migration (per 018's *Accepted
    Limitations*); no backfill is attempted.
  - RLS enabled on the table; policies `USING (user_id = auth.uid())` and
    `WITH CHECK (user_id = auth.uid())` applied on SELECT/INSERT/UPDATE/DELETE.

- **Migration: add `user_id` to hosted `profile`**
  - Same shape and same RLS policies as `applications`.
  - One row per user is the invariant; the existing single-row profile
    semantics from SQLite generalize to one-row-per-user in Supabase.
  - Pre-019 rows are deleted as part of the migration.

- **Seed marker storage**: a durable per-user signal that seeding has run.
  Storage and shape are deferred to the plan phase (FR-013, FR-014 define the
  behavioral contract). Candidates include a column on the `profile` row, a
  dedicated `user_seed_state` table, or a Supabase user-metadata field.

- **Starter seed fixture**: the content seeded on first authenticated API
  call. Defined in the plan phase. Must satisfy FR-012's "demonstrates the
  tracker's primary surfaces, multiple distinct statuses" goal. The profile
  is intentionally not seeded; the first user-driven upsert creates the row.

- **Environment variables (consumed, not introduced)**: 017's
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
  consumed in hosted mode by the new Supabase adapters. No new server env
  vars are introduced by 019.

### Inherited from 018 (consumed unchanged)

- The per-request authenticated user identity attached by 018's auth
  middleware (Supabase user id + email). 019's adapters read `user_id` from
  this context.
- 018's allowlist trigger and email-verification gating. 019 does not
  duplicate or override these.

### Not changed by this feature

- SQLite schema. Local mode does not gain a `user_id` column and does not
  enforce ownership. The existing SQLite `applications` and `profile` tables
  remain byte-equivalent to pre-019.
- The repository contract used by route handlers and the API response shapes
  delivered to the frontend. Both remain unchanged.
- Feature 018's authentication, allowlist, login wall, or session-management
  behavior.

---

## Assumptions

- 018's authentication middleware ships before 019 begins integration testing
  and exposes the authenticated user id on the request in a stable way (per
  018 FR-009).
- The hosted Supabase project used by hosted deploys is the same single
  project from 017 — multi-tenant Supabase setups are out of scope.
- The starter seed is small (a handful of rows per user) and runs synchronously
  inside the first authenticated API call without exceeding request-timeout
  budgets. If volume changes materially, this assumption is revisited in the
  plan phase.
- Repository response shapes remain identical to pre-019. If the frontend ever
  needs to render multi-user data (e.g. portfolio mode), `user_id` exposure is
  a separate, future decision — not a 019 concern.
- The `demo` runtime mode value is `demo` (single token, lowercase, matching
  the `local` / `hosted` convention). Feature 020 may extend the demo runtime
  but MUST NOT rename it.
- Hosted users created in the 018-only window are acceptable to keep — only
  their hosted application and profile rows are wiped (per 018's *Accepted
  Limitations*). Supabase Auth user records (the rows in `auth.users`) are
  untouched by the 019 migration.
- The seed-marker mechanism (FR-013/FR-014) does not need to survive a Supabase
  project reset; if the project is recreated, all users are effectively new
  and re-seeding on their next first call is correct behavior.

---

## Dependencies

- **Feature 017 (hosted-foundation)**: Runtime config, `config.runtime`,
  hosted env var contract, and the `createRepositories` dispatcher entry
  point. 019 extends the dispatcher and consumes the env vars.
- **Feature 018 (auth-user-access)**: Authentication middleware, per-request
  user identity, allowlist trigger, email verification, and the documented
  per-user ownership plan that 019 implements. 019 cannot ship until 018 is
  in place.
- **Feature 020 (demo-mode)**: Downstream consumer of 019's `demo` routing
  slot. 020 replaces the demo stub introduced here with the real session-only
  repository implementation. 019 must not block on 020.
