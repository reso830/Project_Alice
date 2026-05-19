# Plan Review Checklist: Supabase Persistence (019)

**Purpose**: Review gate for plan + contract decisions. Each item is a P0
unless marked otherwise. Consumed by `/speckit.analyze` and by a manual
reviewer. The gate is iterative — it ran once before initial tasks
generation, and re-ran after the spec-review + Codex-review cycles
surfaced issues. The current sign-off (below) reflects the final
post-Codex state.

**Created**: 2026-05-17
**Last updated**: 2026-05-17 (post-Codex review)
**Plan**: [../plan.md](../plan.md)

---

## Architecture

- [ ] Per-request Supabase client model is the chosen approach (R-1).
      Service-role client is **not** used at runtime.
- [ ] Repository dispatch in
      [server/repositories/index.js](../../../server/repositories/index.js)
      remains the single source of truth for runtime-to-adapter selection.
      Route handlers do not branch on `config.runtime`.
- [ ] Dispatcher returns the **uniform** `{ forRequest(req) }` shape
      across all three runtimes (local, hosted, demo). Route handlers
      always call `req.repositories.forRequest(req)`; no shape branching
      on runtime. See [contracts/api.md §1.1](../contracts/api.md).
- [ ] Supabase adapter modules are lazy-imported. Local-mode and demo-mode
      boot load no `@supabase/supabase-js` module.
- [ ] Demo stub is structurally identical to 017's `createHostedStub`
      (same method surface, distinct error class).

## Data Model

- [ ] Migration is idempotent for the intended 019 hosted schema, and
      operators are instructed to drop any legacy wrong-typed hosted tables
      rather than inventing ownership for unowned rows.
- [ ] `applications.user_id` is `uuid NOT NULL REFERENCES auth.users(id)
      ON DELETE CASCADE` with an index on `user_id`.
- [ ] `profile.user_id` is `uuid NOT NULL REFERENCES auth.users(id) ON
      DELETE CASCADE` with `UNIQUE (user_id)`.
- [ ] `user_seed_state` table exists with `(user_id PK, seeded_at
      timestamptz NOT NULL DEFAULT now())`.
- [ ] RLS is enabled on all three tables.
- [ ] RLS policies exist for SELECT / INSERT / UPDATE / DELETE on
      `applications` and `profile`, all `user_id = auth.uid()`.
- [ ] RLS policies on `user_seed_state` cover SELECT and INSERT only
      (UPDATE and DELETE are intentionally absent — denied).

## Ownership Enforcement

- [ ] Server-side `.eq('user_id', userId)` filter is present on every
      adapter read (FR-010).
- [ ] Adapter writes set `user_id` from `req.user.id` and discard any
      `user_id` in input (FR-011).
- [ ] Layered enforcement holds: removing the server filter still leaves
      RLS as the enforcement layer (FR-016). Verified manually in
      quickstart §6.
- [ ] Cross-user access attempts return responses indistinguishable from
      the resource not existing (FR-015).

## Seeding

- [ ] Seed runs on the first authenticated API call (FR-012).
- [ ] Seed is a **single** RPC call — `claim_and_seed_starter()` — whose
      PL/pgSQL body contains the marker INSERT (`ON CONFLICT DO NOTHING`)
      and the row INSERTs in one transaction (FR-013, R-6). The
      middleware never makes a separate marker INSERT from the JS
      client; that two-call design was rejected because two
      `@supabase/supabase-js` calls are two PostgREST requests in two
      transactions.
- [ ] Seed marker is in a dedicated `user_seed_state` table — not a column
      on profile/applications and not in Supabase user metadata (FR-014).
- [ ] Seed payload (2 applications, profile intentionally empty) is
      defined exactly in [contracts/api.md §4](../contracts/api.md) and
      implemented in [../data-model.md §5](../data-model.md) as a
      SECURITY INVOKER RPC.
- [ ] RPC failure mid-body rolls back the marker INSERT and any partial
      row INSERTs together (Postgres transactional guarantee). Next
      request retries the seed cleanly.
- [ ] Seed does not re-run for users whose seeded rows were deleted
      (FR-014).
- [ ] Profile is **not** seeded. FR-012, SC-004, and US3 all agree.

## Boot-Time Verification

- [ ] Hosted-mode boot runs the three PostgREST sentinel probes against
      `applications`, `profile`, and `user_seed_state` (FR-021,
      contracts/api.md §5).
- [ ] PostgREST error codes `42703` and `42P01` produce a descriptive
      startup error and exit non-zero.
- [ ] Transient 5xx is logged as a warning and does not block boot.
- [ ] The boot check is skipped in local and demo modes.

## Response-Shape Invariants

- [ ] `user_id` is **not** present on any object returned to the route
      handler (FR-017).
- [ ] Field shapes returned by Supabase adapters match SQLite adapters
      column-for-column otherwise.
- [ ] The shared column-list constant (or duplicated lists, if not
      shared) stays consistent across adapters — tested via a regression
      test that asserts the SQLite repo's output and the Supabase mock
      adapter's output have the same keys.

## Local-Mode Preservation

- [ ] `APP_RUNTIME=local` boots without contacting Supabase (no
      `createClient` call, no PostgREST probe).
- [ ] No `user_id` column is added to SQLite (FR-003).
- [ ] All existing `tests/server/*` SQLite tests pass unchanged
      (FR-003, SC-006).
- [ ] Lazy-import discipline test confirms no Supabase modules load in
      local mode (R-7).

## Demo-Mode Reservation

- [ ] `config.runtime === 'demo'` is accepted by the config loader (FR-004).
- [ ] Every demo stub method throws `DemoRepositoryNotImplementedError`
      (FR-005).
- [ ] The error message identifies feature 020 as the owner.

## Constitution Compliance

- [ ] Required application fields (company name, job title, status,
      last_status_update, responsibilities) preserved in seed fixture and
      adapter projections (FR-020, constitution Amendment 1.2.0).
- [ ] Validation logic remains in the existing validation layer (FR-019).
- [ ] No external analytics, tracking, or data sharing introduced.
- [ ] Local-first behavior preserved.
- [ ] Operations covered: add, edit, archive, search/filter, review.
- [ ] UX requirements unchanged (no frontend deltas in 019).

## Testing

- [ ] Dispatcher routing test exists for `local`, `hosted`, `demo`.
- [ ] Supabase adapter tests exist for `applications` and `profile`,
      mocking `@supabase/supabase-js` at the module boundary.
- [ ] Ownership defense-in-depth test exists (verifies that omitting
      the server filter still produces correct behavior under mocked RLS).
- [ ] Seed middleware test exists for first-call seed, second-call skip,
      concurrent claim, transaction rollback on seed failure.
- [ ] Boot schema check test exists for `42703` / `42P01` / transient
      5xx paths.
- [ ] SQLite regression tests pass without modification.

## Operator Workflow

- [ ] [../data-model.md §5](../data-model.md) is the canonical
      source for the schema change and seed RPC.
- [ ] [quickstart.md](../quickstart.md) §6 (RLS direct-bypass test) is
      a mandatory P0 step before public exposure.
- [ ] [quickstart.md](../quickstart.md) §10 sign-off checklist must be
      green before considering the deploy complete.

## Constitutional Final Phases (Amendments 1.1.0 + 1.3.0)

- [ ] `tasks.md` will include a **Release Prep** phase as the
      second-to-last phase (version bump, CHANGELOG, README, deployment
      doc updates, REPO_MAP for new files).
- [ ] `tasks.md` will include a **Browser Smoke Test** phase as the
      final phase (one walkthrough per user story, executed against the
      to-be-merged state).
- [ ] These two phases appear in the order: Release Prep → Browser
      Smoke Test.

## Open Items Logged (Not Blocking)

- [ ] Per-process LRU short-circuit on the seed claim (plan §"Risks #3")
      — explicitly deferred unless profiling shows it.
- [ ] `req.supabase` vs per-adapter-call client construction — default
      to `req.supabase`, attached by a small earlier middleware.
- [ ] Shared `server/db/columns.js` for column-list constants vs duplicated
      lists — default to shared.
- [ ] Optional integration test against a real Supabase project in CI —
      deferred.

## Async-Discipline (added post-Codex review)

- [ ] Every protected route handler that touches a repository is `async`
      and `await`s every repository call. Supabase adapters return
      Promises; sync `await` on a non-Promise is a no-op so the SQLite
      backend remains correct.
- [ ] The `PATCH /api/applications/:id` status-transition check
      ([applications.js:111-132](../../../server/routes/applications.js#L111-L132))
      `await`s `getById(id)` before reading `currentRecord.status`. A
      missing `await` here silently bypasses `TERMINAL_STATES` and
      `isValidTransition` checks — explicit test in
      `tests/server/routes/applications-async.test.js` (Task 05.1)
      guards against this regression.
- [ ] No route handler returns a Promise to `res.json()` (e.g.
      `res.json({ data: req.repos.applications.getAll() })` without
      `await`). Such a call would serialize the unresolved Promise as
      `{}` in JSON.

---

## Sign-off

### Round 1 — pre-`/speckit.tasks` (2026-05-17)

Iterative review during plan drafting. Three plan-phase decisions were
clarified via [AskUserQuestion](../research.md) (R-1, R-2, R-3) before
tasks generation. All P0 items at the time were checked.

- Reviewer: Claude (plan drafting agent) + user (decision authority)
- Date: 2026-05-17
- All P0 items checked: ☑ (as of round 1; superseded by round 2)
- Open items reviewed and accepted: ☑

### Round 2 — post-spec-review (2026-05-17)

`/speckit.spec-review` flagged C1 (seed atomicity), M1 (spec/plan
profile-seeding contradiction), MINOR-1 (dispatcher contract decision
left to implementer), and four lower-severity findings. All resolved
in spec.md, plan.md, contracts/api.md, data-model.md, research.md,
quickstart.md, tasks.md, and this checklist. Uniform
`{ forRequest(req) }` dispatcher contract finalized.

- Reviewer: Claude (architect role)
- Date: 2026-05-17
- All P0 items checked: ☑
- Open items reviewed and accepted: ☑

### Round 3 — post-merge-rebase verification (2026-05-17)

After rebasing onto merged 018 (PR #27), verified spec assumptions
against the live code: confirmed `req.user.id` / `req.headers.authorization`
contract holds; corrected `SUPABASE_JWT_SECRET` references (018 settled
on JWKS); expanded Task 05.1 with the explicit `attachRepos(repos)`
pattern needed for 018's factory-injection routing style; rewrote
Task 07.2 to match 018's factory-injection idiom.

- Reviewer: Claude (architect role, against live merged code)
- Date: 2026-05-17
- All P0 items checked: ☑
- Open items reviewed and accepted: ☑

### Round 4 — post-Codex review (2026-05-17)

Codex review flagged the MAJOR async/await omission (route handlers
are sync today; adapters return Promises; status-transition validation
would silently bypass without `await`). Also flagged the
contracts/api.md §7 contradiction (claimed `createRepositories` shape
unchanged while §1.1 defined the new `forRequest` shape) and this
checklist's missing sign-off. All three resolved: Task 05.1 expanded
with the async-conversion step and an explicit async-discipline test;
contracts/api.md §7 corrected to call out the dispatcher signature
change; this checklist now records the full review history.

- Reviewer: Codex (external) + Claude (architect, resolution)
- Date: 2026-05-17
- All P0 items checked: ☑
- Open items reviewed and accepted: ☑

**Gate status**: ✅ All four review rounds resolved. Ready for
`/speckit.implement` Phase 01.
