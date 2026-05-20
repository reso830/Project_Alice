# Feature Specification: Deployment Polish & Docs

**Feature Branch**: `022-deployment-polish-docs`
**Created**: 2026-05-20
**Status**: Draft
**Input**: `features/022-deployment-polish-docs.md`

---

## Problem Statement

Project Alice has grown into a dual-mode application across features 017–021
(local SQLite + hosted Supabase, with portfolio demo mode and resume-import
security audited). The hosted runtime works, but the operator-facing
documentation accreted feature-by-feature: env vars, Supabase setup, demo
behavior, security model, and migration expectations are each correct but
scattered across [`README.md`](../../README.md),
[`docs/deployment.md`](../../docs/deployment.md), and per-feature
`specs/018…021/quickstart.md` and `contracts/api.md` files.

A reviewer or contributor encountering the repo today must stitch the hosted
deploy story together from five+ files. Concretely:

1. **No single end-to-end hosted deploy checklist.** The 018 quickstart
   covers allowlist + trigger. The 019 quickstart covers schema migration.
   The 020 spec covers demo mode. Each is correct in isolation but no
   single doc walks an operator from "fresh Vercel + fresh Supabase" to
   "smoke-tested hosted deploy."
2. **Env var documentation exists but is not framed as a checklist.**
   `.env.example` and the deployment-guide reference table list variables;
   neither answers the question "have I configured everything I need?"
   for a first-time deployer.
3. **No documented hosted smoke-test procedure.** Each feature's tasks.md
   has its own browser smoke test, but there is no portfolio-scoped
   smoke-test checklist that an operator runs after promoting to verify
   login, demo, CRUD, profile editing, authorization, resume import, and
   mobile layout in one pass.
4. **Free-tier limitations are not surfaced.** Vercel Hobby cold starts,
   Supabase Free pause-on-inactivity, and demo-mode reset behavior are
   real portfolio-reviewer-visible behaviors that operators and visitors
   should be primed for.
5. **Local-to-hosted migration expectation is implicit.** The hosted code
   path seeds new users with starter applications (FR-012 of feature 019).
   There is no tooling to migrate a local SQLite dataset into hosted, and
   no doc that makes this explicit. A reviewer who set up local first and
   then deployed could reasonably expect their data to follow.

This feature consolidates and polishes the operator-facing surface so a
portfolio reviewer, future contributor, or returning maintainer can deploy,
verify, and demo the hosted experience without spelunking through five
spec directories. No new runtime behavior, no new env vars, no new
endpoints, no new dependencies.

---

## Scope

- Add a hosted-deployment quickstart section to the README (or refresh the
  existing one) that orients newcomers to the three runtime modes (local,
  hosted, demo) and points at the deployment guide.
- Consolidate and expand [`docs/deployment.md`](../../docs/deployment.md)
  with:
  - An explicit **Environment Variable Checklist** with required vs.
    optional, server-only vs. client-safe, and a copy-pasteable example
    block keyed off the existing `.env.example`.
  - A reproducible **Supabase Setup Checklist** that consolidates the 018
    allowlist/trigger steps, the 019 schema migration, and any RLS policy
    verification into a single ordered procedure runnable from a fresh
    Supabase project.
  - A **Demo & Free-Tier Notes** section documenting Vercel Hobby cold
    starts, Supabase Free pause/inactivity behavior, demo-mode reset
    semantics, and a brief "what to expect" framing for portfolio
    visitors.
  - A **Migration Clarification** section stating explicitly that local
    SQLite data is not migrated automatically to hosted, hosted users
    start from seeded starter data (per feature 019), and end-to-end
    migration tooling is future work.
- Add a **Hosted Smoke-Test Checklist** as a standalone document so it
  can be linked from the README, the deployment guide, and any future
  release-prep phase. It covers: login flow, demo flow, application CRUD,
  profile editing, authorization (cross-user denial), resume import
  restrictions (demo-blocked, hosted-allowed), and mobile layout sanity
  checks.
- Update [`docs/REPO_MAP.md`](../../docs/REPO_MAP.md) to reference any new
  documentation files this feature introduces.
- Update [`CHANGELOG.md`](../../CHANGELOG.md) and bump the version in
  `package.json` per the constitution's Release Prep phase. The version
  bump is a PATCH (docs-only, no runtime or schema change).

## Non-Goals

- **No code changes to the runtime, schema, repositories, or auth.** This
  feature does not touch `server/`, `src/`, `api/`, `shared/`, or any
  test under `tests/`.
- **No new env vars, endpoints, dependencies, or scripts.**
- **Custom domains.** Out of scope per the brief.
- **CI/CD automation beyond current workflow.** Out of scope per the
  brief.
- **Monitoring / analytics / telemetry.** Out of scope per the brief and
  the constitution's privacy stance.
- **Paid infrastructure tier optimization.** The docs target Vercel Hobby
  + Supabase Free.
- **Production-scale hardening** (rate limiting, malware scanning, WAF,
  bot detection, multi-region failover). Out of scope per the brief.
- **Migration tooling implementation.** Documented as future work only.
- **A new contracts/api.md** for this feature. The endpoint contracts
  documented by features 017–021 stand unchanged.

---

## User Scenarios & Testing

### User Story 1 — Fresh-environment reproducible hosted deploy (Priority: P1)

A new operator (portfolio reviewer, contributor, or returning maintainer)
clones the repo, reads the deployment guide, and follows the documented
steps end-to-end against a brand-new Vercel project and a brand-new
Supabase project. They reach a working hosted deploy with login, demo,
and authenticated CRUD all functional, without needing to read any
per-feature `specs/0##-…/quickstart.md`.

**Why this priority**: This is the through-line that the entire feature
serves. Every other story is a slice of this one.

**Independent Test**: Walk the documented deploy path (README →
`docs/deployment.md` → Supabase Setup Checklist) top-to-bottom against
an existing hosted preview environment, treating each step as a
reading-comprehension exercise: every referenced artifact resolves,
every checklist item maps to a concrete operator action, and no step
requires opening a file under `specs/`. Full re-provisioning against
a fresh Vercel + fresh Supabase project is the strongest verification
but is not required for the gate — the documentary walk-through is
sufficient to surface a missing step. The deployed preview is then
exercised to confirm (a) the welcome page loads, (b) **Try the demo**
works, (c) an allowlisted email can sign up and sign in, (d)
authenticated CRUD on applications succeeds, and (e) profile editing
persists.

**Acceptance Scenarios**:

1. **Given** a fresh checkout of the repo and a Vercel + Supabase account
   with no prior project, **When** the operator follows the deployment
   guide top-to-bottom, **Then** they reach a working hosted deploy
   without consulting any per-feature spec directory.
2. **Given** the Environment Variable Checklist, **When** the operator
   reads it before configuring Vercel, **Then** they can identify every
   required variable, distinguish server-only vs. client-safe, and copy
   a complete example block.
3. **Given** the Supabase Setup Checklist, **When** the operator runs it
   against a fresh Supabase project, **Then** the schema migration, the
   allowlist table + trigger, and the RLS policies are all installed and
   verified in one ordered pass.

---

### User Story 2 — Pre-promotion smoke-test verification (Priority: P1)

After deploying a preview build (or before promoting a preview to
production), an operator opens the hosted smoke-test checklist and
walks every step in a real browser against the live URL. The checklist
exercises login, demo, CRUD, profile editing, cross-user authorization,
resume-import restrictions, and mobile-viewport sanity.

**Why this priority**: The constitution makes a browser smoke test a
mandatory final phase for every UI feature, but those phases live inside
each feature's `tasks.md`. A portfolio-scoped checklist makes pre-promotion
verification reproducible without scrolling through history.

**Independent Test**: With the deployed URL in hand, open the smoke-test
checklist and complete every item. The checklist passes only if every
flow succeeds in a single uninterrupted pass.

**Acceptance Scenarios**:

1. **Given** a deployed preview URL and the smoke-test checklist, **When**
   the operator walks every step in order, **Then** each step either
   passes or surfaces a specific failure with enough context to
   reproduce.
2. **Given** the checklist, **When** the operator inspects the resume-import
   step in demo mode, **Then** the documented expectation matches the
   actual behavior (button hidden / disabled per feature 020).
3. **Given** the checklist, **When** the operator inspects the
   cross-user authorization step (signed in as user A, attempting to
   read user B's record), **Then** the documented expectation matches
   the actual 404 / RLS-scoped behavior (per feature 019).
4. **Given** the mobile-layout sanity step, **When** the operator opens
   the deployed URL at a 375px viewport, **Then** the documented mobile
   expectations (navbar, card list, profile chart fallback) match the
   actual rendering.

---

### User Story 3 — Free-tier expectation calibration (Priority: P2)

A portfolio visitor (or a contributor evaluating whether to deploy their
own copy) reads the Demo & Free-Tier Notes section and knows in advance
that (a) the first request after a quiet period may be slow because of
Vercel Hobby cold starts, (b) Supabase Free pauses inactive projects,
(c) demo data resets on browser refresh by design, and (d) "production
feel" is shaped within those constraints.

**Why this priority**: Misaligned expectations are the most likely cause
of a portfolio reviewer interpreting normal free-tier behavior as a
defect. P2 because docs alone don't change runtime behavior — they only
shape the framing.

**Independent Test**: A first-time visitor reads the Demo & Free-Tier
Notes section before clicking around the deployed URL. After encountering
a cold start, a paused-project warmup, or a demo reset, they can name
the behavior they observed and confirm it matched what the docs said.

**Acceptance Scenarios**:

1. **Given** the Free-Tier Notes section, **When** a visitor encounters
   a slow first load, **Then** the cold-start explanation in the docs
   matches the observed behavior.
2. **Given** the Free-Tier Notes section, **When** a visitor refreshes
   the browser during a demo session, **Then** the demo-reset expectation
   in the docs matches the observed reset.

---

### User Story 4 — Migration expectation clarity (Priority: P2)

A maintainer who has been using local mode decides to deploy hosted for
the first time. Before they deploy, the Migration Clarification section
tells them explicitly that their local SQLite data will not move and
that hosted users start from seeded starter applications. They are not
surprised after they deploy.

**Why this priority**: This is a one-paragraph expectation reset, but
the consequence of getting it wrong is "I deployed and my data is
gone." P2 because the doc fix is small and the failure mode is
specific.

**Independent Test**: Operator reads the Migration Clarification section
before deploying. After their first hosted sign-in, the observed state
(2 seeded applications, empty profile, no carry-over from local SQLite)
matches what the docs said to expect.

**Acceptance Scenarios**:

1. **Given** the Migration Clarification section, **When** an operator
   reads it before deploying, **Then** they know that local data does
   not migrate and hosted starts from seeded data.
2. **Given** the same section, **When** an operator looks for migration
   tooling, **Then** they find a clear "future work" statement and do
   not look for a script that does not exist.

---

### Edge Cases

- **Operator skips the Supabase migration step.** The boot-time schema
  check (`server/health.js`, documented in `docs/deployment.md`) exits
  non-zero with a descriptive log. The deployment guide must point
  operators at that log line as the diagnostic.
- **Operator forgets a `VITE_*` env var.** The `vite.config.js` plugin
  `assertHostedFrontendEnv` fails the production build closed and
  names the missing variable. The Env Var Checklist must point at this
  failure mode.
- **Operator sets `SUPABASE_SERVICE_ROLE_KEY` with a `VITE_` prefix.**
  The service-role key would be inlined into the public bundle. The
  Env Var Checklist must call this out explicitly as a security
  footgun (the constitution treats this as private data).
- **Supabase Free project pauses while the smoke test is mid-run.** The
  smoke-test checklist should document this as an expected failure
  mode and tell the operator how to wake the project (open the
  Supabase dashboard, wait for warmup).
- **Vercel Hobby cold start lands mid-smoke-test.** The smoke-test
  checklist should note that the first request after a quiet period
  may take several seconds; subsequent requests in the same session
  are fast.
- **Operator's allowlisted email already exists in `auth.users` from a
  previous run.** Documented in the Supabase Setup Checklist as a
  re-run-safe condition (the 018 quickstart is idempotent).
- **Reviewer uses a non-supported browser.** Out of scope — README
  already implies modern browsers; this feature does not enumerate a
  support matrix.
- **Documentation drift between this feature and future feature
  additions.** Out of scope — the constitution's Release Prep phase
  is the durable mechanism for keeping docs current with code.

---

## Requirements

### Functional Requirements

- **FR-001**: The README MUST contain a short "Runtime modes" section
  (or refresh of the existing hosted-mode block) that names the three
  modes — local, hosted, demo — describes the role of each, and links
  to the deployment guide for full operator steps.
- **FR-002**: `docs/deployment.md` MUST contain an **Environment Variable
  Checklist** section that:
  - Lists every required variable, every optional variable, the
    server-only vs. client-safe split, and the secret-handling
    guidance.
  - Stays in sync with `.env.example` (variable names and ordering
    align; no orphaned variables in either file).
  - Includes a copy-pasteable example block.
- **FR-003**: `docs/deployment.md` MUST contain a **Supabase Setup
  Checklist** section that consolidates project creation, schema
  migration (per feature 019), allowlist + trigger install (per
  feature 018), RLS policy verification, and the pre-deploy
  verification gate into a single ordered, reproducible procedure.
  The checklist MUST be runnable from a fresh Supabase project
  without consulting per-feature spec directories during normal flow
  (links to those specs are allowed for deep-dive context, but every
  step the operator must execute appears inline).
- **FR-004**: `docs/deployment.md` MUST contain a **Demo & Free-Tier
  Notes** section covering Vercel Hobby cold starts, Supabase Free
  pause-on-inactivity behavior, demo-mode reset semantics, and a
  realistic expectations framing for portfolio visitors.
- **FR-005**: `docs/deployment.md` MUST contain a **Migration
  Clarification** section stating explicitly that local SQLite data
  is not migrated automatically, that hosted users start from seeded
  starter applications (per feature 019), and that end-to-end
  migration tooling is future work.
- **FR-006**: A new **Hosted Smoke-Test Checklist** MUST exist as a
  standalone document so it can be linked from both the README and
  the deployment guide. It MUST cover, at minimum:
  - login flow (allowlisted email sign-up + sign-in)
  - demo flow (Try the demo CTA + in-memory CRUD reset)
  - application CRUD (create, edit, archive)
  - profile editing (one structured section, sticky save/cancel,
    discard guard)
  - authorization (cross-user denial: user A cannot read user B)
  - resume import restrictions (hidden in demo; allowed in hosted
    auth'd mode)
  - mobile layout sanity (375px viewport: navbar, card list, profile
    chart fallback)
- **FR-007**: `docs/REPO_MAP.md` MUST be updated to reference every new
  documentation file this feature introduces.
- **FR-008**: `CHANGELOG.md` MUST receive a PATCH-bump entry describing
  the docs consolidation. `package.json#version` MUST be bumped to the
  matching PATCH value.
- **FR-009**: This feature MUST NOT modify any file under `server/`,
  `api/`, `shared/`, or `tests/`. The only permitted `src/` edit is
  the version-literal in
  [`src/pages/welcome/shared/appMeta.js`](../../src/pages/welcome/shared/appMeta.js)
  (the `APP_VERSION` constant), bumped in sync with `package.json`
  per the constitution's Release Prep mandate
  (Amendment 1.3.0 — "version bump (SemVer in `package.json` + any
  in-app version display)"). The `APP_VERSION` literal is currently
  hand-maintained — replacing the hand-maintained literal with a
  build-time `package.json` import is out of scope for this feature
  (it would be runtime-touching code in a docs-only feature). This
  is enforced by review, not by automation.
- **FR-010**: Every external link the new docs add MUST resolve
  (relative repo links to existing files; external links to
  vendor docs that exist today).
- **FR-011**: The browser smoke-test phase for this feature is
  scoped to a single check on the only changed UI surface: confirm
  the in-app footer / welcome-page version display reads `v0.11.1`
  after the merge (matching `package.json` and
  `src/pages/welcome/shared/appMeta.js`). Constitution Amendment
  1.1.0 applies because `APP_VERSION` is a user-visible UI surface,
  even if trivial; Task 05.4's grep-based check verifies the
  literal in source but does not verify the rendered output (build
  chain, DOM mount path, bundle inclusion all fall outside grep's
  reach). The previous-feature flows (login, demo, CRUD, profile,
  authorization, resume import, mobile layout) are **not re-walked**
  — they are unchanged by this feature, and the new
  `docs/hosted-smoke-test.md` is a **future-operator reference
  artifact**, not a self-verification artifact for this feature.
  Decision recorded in [`research.md`](./research.md) D6.

### Key Entities

This feature does not introduce or modify entities. It documents the
operator surface of the existing application.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Walking the documented deploy path (`README.md` →
  `docs/deployment.md` → Supabase Setup Checklist) end-to-end requires
  no excursion into `specs/0##-…/` for any operator-executable step.
  Per-feature spec links remain as deep-dive references but are not
  load-bearing for the happy path. The strongest verification is a
  fresh Vercel + fresh Supabase provisioning pass; the gate-level
  verification is a documentary walk-through against an existing
  preview environment. (FR-001, FR-002, FR-003)
- **SC-002**: The Environment Variable Checklist in `docs/deployment.md`
  references every variable present in `.env.example` and vice versa.
  Discrepancies are zero. (FR-002)
- **SC-003**: The Supabase Setup Checklist in `docs/deployment.md`
  references every artifact required by features 018 and 019 (allowed
  emails table, signup trigger, applications + profile + user_seed_state
  tables, RLS policies, JWKS endpoint reachability). (FR-003)
- **SC-004**: A first-time visitor reading the Demo & Free-Tier Notes
  section can name (in their own words) at least the three expected
  free-tier behaviors: cold start, project pause/warmup, demo reset.
  (FR-004)
- **SC-005**: The Migration Clarification section appears in the
  deployment guide and is explicit that local data does not migrate,
  hosted starts seeded, and migration tooling is future work. (FR-005)
- **SC-006**: The Hosted Smoke-Test Checklist exists as a standalone
  document and is linked from both `README.md` and `docs/deployment.md`.
  Every item in the brief's smoke-test list (login, demo, CRUD,
  profile, authorization, resume import, mobile) is present.
  (FR-006)
- **SC-007**: `docs/REPO_MAP.md` references every new documentation
  file this feature introduces. (FR-007)
- **SC-008**: `package.json` version is incremented by one PATCH unit
  vs. the merge base; `CHANGELOG.md` has a matching entry under the
  new version. (FR-008)
- **SC-009**: A `git diff` of the merge into `main` shows zero changes
  outside `README.md`, `CHANGELOG.md`, `package.json`, `docs/**`,
  `specs/022-deployment-polish-docs/**`, and the single-line
  `APP_VERSION` literal update in
  `src/pages/welcome/shared/appMeta.js`. (FR-009)
- **SC-010**: Every relative link added by this feature resolves to a
  file that exists in the repository at the same commit. (FR-010)
- **SC-011**: The feature's Browser Smoke Test phase opens the
  deployed preview (or local `npm run dev`) and confirms the
  footer / welcome-page version display renders `v0.11.1`,
  matching `package.json` and `appMeta.js`. Previous-feature flows
  are not re-walked (unchanged surface); the new Hosted Smoke-Test
  Checklist is shipped without execution by this feature's author.
  (FR-011 / research.md D6)

---

## Data Considerations

- **No new persistent data.** No tables, columns, indexes, env vars,
  config flags, or files outside the documentation surface.
- **No runtime behavior change.** All artifacts are markdown.
- **Privacy posture unchanged.** The constitution's no-analytics,
  no-telemetry, no-third-party-sharing stance is preserved — this
  feature documents the existing stance and does not add or remove
  data flows.
- **Logging unchanged.** No new log events.
- **Local mode unchanged.** Documentation explicitly preserves the
  local-first default; no new requirements imposed on local
  developers.

---

## Constitution Compliance

- **Required fields**: N/A — this feature does not touch application or
  profile data models.
- **Validation rules**: N/A — no new validation surface.
- **Testing**: per FR-011 / SC-011, this feature runs a single-task
  Browser Smoke Test phase scoped to the footer / welcome-page
  version-display check — the only UI surface this feature changes.
  Task 05.4's grep covers source-literal correctness; the browser
  check covers rendered-output correctness (build chain, DOM mount
  path, bundle inclusion). Previous-feature flows are not re-walked
  because they are unchanged. The new Hosted Smoke-Test Checklist
  is a future-operator artifact, not validated by this feature
  (research.md D6). No new automated tests are introduced because
  the only code change is a single version literal (FR-009).
- **UX**: documentation is the user surface. Newcomer-friendliness is
  pinned by SC-001 (fresh deploy reproducible from README + deployment
  guide alone).
- **Architecture**: no new dependencies, no new endpoints, no new env
  vars, no new files outside `docs/` and the feature's own `specs/`
  directory.
- **Privacy**: free-tier notes and demo behavior are documented
  consistent with the constitution's no-external-sharing stance.
- **Release Prep**: this feature's content largely *is* Release Prep
  for prior features (017–021). The constitution's Release Prep phase
  applies to this feature itself as well — version bump + CHANGELOG +
  README + REPO_MAP land before the Browser Smoke Test phase.
- **Browser Smoke Test**: scoped to a single check on the only
  changed UI surface — the footer / welcome-page version display
  (`v0.11.1`). Task 05.4's grep verifies the source literal; the
  browser check verifies the rendered output. Previous-feature
  flows are not re-walked (unchanged); the new Hosted Smoke-Test
  Checklist is a future-operator artifact, not validated by this
  feature. See research.md D6.

---

## Resolved Clarifications

The five `[NEEDS CLARIFICATION]` items originally flagged here were
resolved during `/speckit.plan`. The authoritative record is
[`research.md`](./research.md). Summary:

- **Smoke-test checklist file location** → `docs/hosted-smoke-test.md`
  (flat in `docs/`, no new subdirectory). Resolved as D1.
- **README scope** → Refresh the existing "Hosted Mode (Supabase
  Authentication)" section only; no new top-level Runtime Modes block,
  no separate "About this build" portfolio block. Resolved as D2.
  (The "portfolio framing surface" question was folded into this
  decision — framing stays implicit, carried by well-organized docs.)
- **Smoke-test format** → Given / When / Then per step (matches
  `specs/018-auth-user-access/quickstart.md §10` and the spec's own
  acceptance scenarios). Resolved as D3.
- **Version bump** → PATCH: `0.11.0` → `0.11.1` (docs-only, no
  runtime or schema change). Resolved as D4.

See [`research.md`](./research.md) for rejected alternatives and the
rationale per decision.
