# Feature Specification: Hosted Deployment Foundation

**Feature Branch**: `017-hosted-foundation`
**Created**: 2026-05-14
**Status**: Draft
**Input**: `features/017-hosted-foundation.md`

---

## Problem Statement

Project Alice currently operates as a single local-only runtime: Express serves the API
and Vite serves the frontend, with SQLite providing persistence. There is no pathway to
a hosted deployment.

To support future features requiring authentication, shared access, and persistent hosted
data, the project needs a clearly defined hosted runtime architecture on Vercel + Supabase
— without breaking the existing local development workflow and without yet implementing
auth or hosted persistence.

This feature establishes the architectural boundaries: environment configuration
contract, repository abstraction layer, Supabase schema plan, and deployment
documentation. No user-facing behavior changes are expected.

---

## Scope

- Define and document two supported runtime modes: **local** and **hosted**
- Introduce a centralized environment configuration contract with validation
- Introduce a repository abstraction interface that decouples business logic from persistence implementations
- Document a Supabase schema plan for applications and profile (no migration tooling required)
- Define API boundary rules formalizing that business logic stays server-side
- Add hosted deployment documentation (Vercel setup, Supabase setup, env vars, runtime differences)
- Preserve the existing local SQLite development workflow without regression

## Non-Goals

- Authentication or user identity
- Supabase persistence implementation (repositories remain SQLite only)
- Row Level Security implementation
- Resume upload restrictions for hosted mode
- Existing SQLite data migration to Supabase
- Demo mode
- Public deployment polish or production readiness
- Frontend environment detection or conditional rendering

---

## User Stories

### User Story 1 — Local mode continues to work without hosted configuration (P1)

A developer clones the repo and runs the local stack with no Supabase or Vercel
configuration set. The application starts, the SQLite database initializes, and the
full application tracking workflow operates exactly as it does today.

**Why this priority**: Regression prevention. Any change to the environment or
repository layer that breaks local mode is an immediate blocker.

**Independent Test**: Pull the branch, ensure no Supabase or hosted env vars are set,
run `npm run server:dev` and `npm run dev`, and verify all existing features (create,
edit, filter, profile) work without errors.

**Acceptance Scenarios**:

1. **Given** no hosted environment variables are configured, **When** the server starts,
   **Then** it initializes in local mode using SQLite without errors or warnings about
   missing config.
2. **Given** local mode is active, **When** a user creates, edits, or filters
   applications, **Then** behavior is identical to the pre-feature baseline.
3. **Given** local mode is active, **When** the profile page is loaded and edited,
   **Then** behavior is identical to the pre-feature baseline.

---

### User Story 2 — Hosted runtime initializes successfully (P2)

A developer configures valid Supabase and Vercel environment variables and starts the
server. The application boots into hosted mode, the configuration is validated without
errors, and the server reaches a ready state (even though Supabase repositories are not
yet implemented).

**Why this priority**: Validates the configuration contract and boot path that all
future hosted features depend on.

**Independent Test**: Set valid `APP_RUNTIME`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` env vars. Start the server. Verify it boots without config
errors and logs the active runtime mode.

**Acceptance Scenarios**:

1. **Given** all required hosted env vars are present and valid, **When** the server
   starts, **Then** it logs `[config] Runtime mode: hosted` and `GET /api/health`
   returns `{ "status": "ok" }`.
2. **Given** a required hosted env var is missing or empty, **When** the server
   starts, **Then** it fails with a clear, descriptive error identifying the variable
   — it does not silently fall back to local mode. ("Malformed" for this feature is
   limited to missing or empty-string values; URL format validation is out of scope.)
3. **Given** the hosted config is valid but Supabase repositories are not yet
   implemented, **Then** the server still starts; unimplemented hosted repositories
   are either stubs or deferred to a future feature.

---

### User Story 3 — Developer can onboard to hosted deployment using documentation (P3)

A new contributor reads the hosted deployment documentation and can reproduce the
Vercel + Supabase setup without asking the project author. The docs cover environment
variables, Supabase project creation, and Vercel deployment steps.

**Why this priority**: Reproducibility of setup. Without docs, the hosted architecture
has no actionable path to use.

**Independent Test**: Follow the docs from scratch. Verify that each documented step
produces the expected outcome and that no required step is missing.

**Acceptance Scenarios**:

1. **Given** the deployment docs, **When** a contributor follows the Supabase setup
   steps, **Then** they can create a Supabase project and obtain the required env vars.
2. **Given** the deployment docs, **When** a contributor follows the Vercel setup steps,
   **Then** they can link the project and configure env vars in the Vercel dashboard.
3. **Given** the deployment docs, **When** a contributor follows the local vs hosted
   runtime section, **Then** they understand what changes between modes and what stays
   the same.

---

## Edge Cases

- **Missing one hosted env var**: Server should fail clearly, naming the specific missing
  variable. It must not start in a partially-configured or undefined state.
- **`APP_RUNTIME` set to an unrecognized value**: Treated as a config error; server
  fails with a descriptive message.
- **Client-safe vs server-only env vars**: `SUPABASE_SERVICE_ROLE_KEY` must never be
  exposed to the frontend bundle. If the build pipeline exposes it, the config contract
  is violated.
- **Supabase connection unavailable in hosted mode**: If a future Supabase repository
  attempts to connect and the Supabase project is unreachable, the error should surface
  clearly rather than silently hanging or returning corrupt data.
- **Repository interface mismatch**: If a future implementation does not conform to the
  defined interface, the mismatch should be detectable at startup or test time, not at
  runtime during a user operation.
- **Local mode with partial hosted env vars**: If some but not all hosted vars are set
  while `APP_RUNTIME=local`, the server should start normally in local mode; extra vars
  are ignored.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST support a `local` runtime mode that uses existing Express +
  SQLite behavior without any hosted env vars configured.
- **FR-002**: System MUST support a `hosted` runtime mode activated by environment
  configuration; this mode prepares the architecture for Supabase persistence.
- **FR-003**: Runtime mode MUST be determined by environment configuration
  (`APP_RUNTIME` or equivalent), not by build-time flags or hardcoded values.
- **FR-004**: Environment configuration MUST be validated at server startup; invalid
  or missing required hosted config MUST produce a clear error and halt the server.
- **FR-005**: Client-safe env vars (Supabase URL, anon key) MUST be separable from
  server-only vars (service role key) in the configuration contract.
- **FR-006**: Business logic, validation, and authorization MUST remain in the API
  layer; the frontend MUST NOT directly access Supabase or enforce business rules.
- **FR-007**: Repository implementations MUST conform to a defined interface contract;
  API routes MUST depend on the interface, not on SQLite or Supabase directly.
- **FR-008**: Existing SQLite repositories MUST remain functional and be the default
  in local mode.
- **FR-009**: A Supabase schema plan MUST be documented for applications and profile,
  covering field names, types, ownership assumptions, timestamps, and future RLS
  readiness.
- **FR-010**: Hosted deployment setup MUST be documented covering Vercel setup,
  Supabase setup, environment variables, and local vs hosted runtime differences.
- **FR-011**: System MUST preserve required application fields: company name, job title,
  status, last_status_update, and responsibilities.
- **FR-012**: System MUST validate required fields, URLs when provided, and status
  values before saving; validation rules MUST remain centralized.
- **FR-013**: System MUST avoid external analytics, tracking, or data sharing.

### Key Entities

- **Runtime Config**: The resolved environment configuration for the current runtime
  mode; determines which repository implementations are loaded and validates that
  required vars are present.
- **Repository Interface**: The abstract contract that both SQLite and future Supabase
  repositories must satisfy; defines method signatures for application and profile CRUD.
- **Applications Repository (SQLite)**: The existing SQLite-backed implementation of
  the application repository interface; unchanged in local mode.
- **Profile Repository (SQLite)**: The existing SQLite-backed implementation of the
  profile repository interface; unchanged in local mode.
- **Supabase Schema Plan**: A documented (not implemented) description of the hosted
  Postgres schema for applications and profile, including field names, types,
  ownership, and timestamp conventions.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Local mode starts and passes all existing automated tests with no
  regression after the repository abstraction is introduced.
- **SC-002**: Hosted mode boots without error when all required env vars are provided.
- **SC-003**: Server fails with a descriptive error (identifying the missing key) when
  a required hosted env var is absent.
- **SC-004**: `SUPABASE_SERVICE_ROLE_KEY` does not appear in the Vite frontend bundle
  under any build configuration.
- **SC-005**: Repository interface is defined and both SQLite repository modules conform
  to it (verifiable by test or type contract).
- **SC-006**: Supabase schema plan document exists and covers all required application
  fields, profile structure, ownership columns, and timestamp conventions.
- **SC-007**: Deployment documentation covers Vercel setup, Supabase setup, env vars,
  and local vs hosted differences with no missing required steps.
- **SC-008**: All existing automated test suites pass with no modifications to test
  logic.

---

## Data Considerations

### Current SQLite Schema (reference)

Applications table: `id`, `company_name`, `job_title`, `status`, `compat`, `fav`,
`source_platform`, `application_date`, `job_posting_url`, `recruiter`, `notes`,
`salary`, `responsibilities`, `skills`, `follow_up_action`, `follow_up_date`,
`last_status_update`, `created_at`, `updated_at`, `archived`, `metadata`, `location`,
`shift`, `work_setup`, `compat_notes`, `general_notes`, `preferred_skills`.

Profile table: `id` (always 1), `data` (JSON blob), `updated_at`.

### Supabase Schema Plan (documented, not implemented)

**`applications` table** (Postgres):
- Maps directly to current SQLite columns where feasible
- `id`: `uuid` (default `gen_random_uuid()`), primary key
- `user_id`: `uuid`, nullable (for future RLS; null until auth is implemented)
- All text fields map to `TEXT` or `VARCHAR`; booleans (`compat`, `fav`, `archived`)
  map to `BOOLEAN`
- `last_status_update`, `created_at`, `updated_at`: `TIMESTAMPTZ`
- `metadata`: `JSONB`
- Future RLS policy: `user_id = auth.uid()` (not implemented in this feature)

**`profile` table** (Postgres):
- `id`: `uuid` (default `gen_random_uuid()`), primary key
- `user_id`: `uuid`, nullable (for future RLS)
- `data`: `JSONB`
- `updated_at`: `TIMESTAMPTZ`

### Repository Interface Contract

Both local (SQLite) and future hosted (Supabase) repository implementations must
expose equivalent method signatures for:
- Applications: `getAll`, `getById`, `create`, `update`, `archive`
- Profile: `get`, `upsert`

API routes access repositories through this interface; the active implementation is
resolved by runtime configuration at startup.

### Environment Variable Contract

| Variable | Scope | Required in local | Required in hosted |
|---|---|---|---|
| `APP_RUNTIME` | server | no (default: `local`) | yes (`hosted`) |
| `SUPABASE_URL` | client-safe | no | yes |
| `SUPABASE_ANON_KEY` | client-safe | no | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | no | yes |
| `PORT` | server | no | no | Defaults to `3001` |

---

## Assumptions

- The Vercel deployment will use Vercel Functions (or the existing Express adapter
  pattern) to serve API routes; the specific adapter approach is a planning decision.
- Supabase will be used for Postgres only in this feature; Supabase Auth is out of scope.
- No schema migration tooling (Prisma, Flyway, etc.) is required in this feature;
  the schema plan is documentation only.
- Local development continues to use `npm run server:dev` + `npm run dev` without
  requiring Docker or external services.
- A single `APP_RUNTIME` toggle is sufficient to differentiate local and hosted behavior
  for v1; per-feature toggles are not required unless a specific need is identified.
- The repository interface contract will be defined as JSDoc or a documented API
  surface, not a TypeScript interface (the project is JavaScript-only).
- SQLite uses integer autoincrement IDs; Supabase will use UUID strings. Feature 019
  must update both the Supabase repository `getById` implementation and
  `parseIdParam()` in `server/routes/applications.js` to accept UUID strings.
