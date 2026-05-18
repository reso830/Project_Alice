# Research Notes: Supabase Persistence (019)

**Branch**: `019-supabase-persistence` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

This document records the design decisions that shape 019 and the rejected
alternatives behind each. The narrative form lets reviewers (and future-us)
follow the reasoning when the implementation diverges from "what looked
obvious."

---

## R-1 Server's Supabase client model

**Decision**: per-request anon-key client initialized with the caller's JWT.

**Alternatives considered**:

1. **Long-lived service-role client.** A single `createClient(url, serviceRoleKey)`
   constructed at server boot, shared across all requests. Bypasses RLS by
   design.
   *Rejected* because it makes the spec's "layered server filter + RLS
   defense in depth" (FR-016, US6) functionally one-layered for server
   traffic — RLS is dead unless a different caller (direct anon-key browser
   call) shows up, which our frontend doesn't. The whole point of layered
   enforcement is that a bug in the server filter still doesn't leak data;
   service-role bypass removes that guarantee.

2. **Hybrid: anon+JWT for CRUD, service-role for the seed step.**
   *Rejected* because the seed step works fine under RLS — the seed
   marker INSERT and the starter-application INSERTs both have
   `user_id = auth.uid()`, which satisfies the `WITH CHECK` policy. The
   hybrid adds a second client lifecycle and a service-role-key
   request-time dependency for zero benefit.

3. **Per-request anon-key client + user JWT.** **Chosen.** The server
   constructs `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: {
   headers: { Authorization: <user JWT> } } })` per request, hands it to
   the adapter, and discards it after the response. RLS fires for every
   query as the authenticated user; server-side `.eq('user_id', userId)`
   filters are added for explicitness and observability but are no longer
   the only enforcement layer.

**Tradeoff**: per-request client construction. `createClient` is
lightweight (URL prep + a fetch wrapper; no DB connection until a query
runs). The cost is negligible at our scale and can be optimized later (per-
process client + per-request `setSession`) if profiling demands it.

**Consequence**: 019 application code does **not** read
`SUPABASE_SERVICE_ROLE_KEY` at runtime. The env var stays in the hosted
contract (per 017) for operator and migration use, but no runtime code path
consumes it.

---

## R-2 Seed marker storage

**Decision**: dedicated `public.user_seed_state` table.

**Alternatives considered**:

1. **`seeded_at` column on the profile row.**
   *Rejected* because it couples the seed marker to profile-row
   existence. FR-014 explicitly requires the marker to be independent of
   applications/profile row presence so that a user who deletes their
   seeded content is not re-seeded. If we ever support profile-row
   deletion (or if a feature later upserts the profile back to "empty"),
   the marker disappears and the user gets re-seeded against their will.

2. **`raw_app_meta_data` on `auth.users`.**
   *Rejected* because writing it requires the service-role key, which
   contradicts R-1's decision to keep service-role usage out of runtime
   code. Also slightly opaque — the marker lives in Supabase Auth's
   namespace rather than our schema.

3. **Dedicated `user_seed_state` table.** **Chosen.** Schema:

   ```sql
   user_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
   seeded_at timestamptz NOT NULL DEFAULT now()
   ```

   Claim semantics:
   ```sql
   INSERT INTO user_seed_state (user_id) VALUES (auth.uid())
   ON CONFLICT (user_id) DO NOTHING RETURNING user_id;
   ```

   Atomic, race-safe (Postgres serializes concurrent INSERTs on the same
   PK), and independent of any other table.

**Tradeoff**: one more table to migrate and RLS-scope. Acceptable given
the clarity and correctness gains.

---

## R-3 Seed fixture content

**Decision**: two applications + empty profile, with dates relative to
seed time.

**Alternatives considered**:

1. **Reuse `server/db-seed.js` DEMO_RECORDS (24 records).**
   *Rejected* because the records use hardcoded 2026-03/04 dates that
   would read as stale for any user signing up after mid-2026. Also 24
   records is overwhelming for a new user's empty-state demo — it
   defeats the "show me my own workspace" feel.

2. **Subset of dev seed (first ~6 records).**
   *Rejected* for the same date-staleness reason and because subset-of-
   another-fixture invites drift: the dev seed is occasionally edited
   for development convenience, and we'd inherit those edits in the
   hosted user experience without noticing.

3. **Tiny: 2 applications + empty profile, relative dates.** **Chosen.**
   - One `applied` row (Sample Company, Frontend Engineer, ~14 days ago).
   - One `interview` row (Example Labs, Full Stack Developer, ~21 days
     ago application, ~5 days ago last status update).
   - Profile starts empty — the first profile edit prompt is itself part
     of onboarding.
   - All other columns are null to exercise the empty-state edges of the
     application detail view.
   - `responsibilities` is filled with a generic placeholder that names
     itself as editable, because the constitution requires the field.

**Tradeoff**: small seed is less impressive on first paint than a 24-row
dev seed. Acceptable; the seed is meant to remove empty-state friction,
not to be a portfolio demo. Portfolio-style demos are owned by feature
020.

---

## R-4 Boot-time schema verification mechanism

**Decision**: anon-key PostgREST sentinel probes against `applications`,
`profile`, and `user_seed_state` (each `select=user_id&limit=0`).

**Alternatives considered**:

1. **Information_schema query via a service-role client.** Reliable but
   pulls in a service-role-client codepath that R-1 otherwise eliminates.
   *Rejected.*

2. **Skip the boot check; let first request fail.**
   *Rejected* because FR-021 mandates a fail-fast at boot. A first-request
   failure leaves a window where 5xx errors leak before the operator
   notices.

3. **Anon-key PostgREST sentinel probe.** **Chosen.** Three GETs against
   each affected table with `select=user_id&limit=0`. 200 (any body) →
   the column/table exists. PostgREST error codes `42703` (column does
   not exist) or `42P01` (table does not exist) → log the missing
   artifact and exit non-zero. Other errors (network, 5xx) → log warning,
   continue boot (first request will resurface the issue).

**Tradeoff**: depends on PostgREST error codes, which Supabase may
restructure in future releases. Brittle but acceptable; if it breaks, the
failure mode is "fail boot harder than necessary" which is still safe.

---

## R-5 Where seeding lives in the middleware chain

**Decision**: a small Express middleware
(`seedHostedUserIfNeeded`) mounted after `requireAuth` and before the
route handlers, conditional on `config.isHosted`.

**Alternatives considered**:

1. **Inside the repository factory.** First-call check + seed embedded
   in `createRepositories`. *Rejected* because the factory runs per
   request but doesn't have a natural error-propagation seam back to
   Express — failures would surface deep inside a route handler.

2. **Inside `requireAuth`.** *Rejected* because `requireAuth` is owned
   by 018 and bundling persistence concerns into the auth middleware
   muddies separation. 019's seeding is a downstream consumer of 018's
   work, not a part of it.

3. **Standalone middleware mounted after `requireAuth`.** **Chosen.**
   Conditional in `server/index.js`: only mounted when `config.isHosted`.
   In local mode, the middleware never runs. In demo mode, route
   handlers fail before this middleware is reached.

---

## R-6 Transactional seed claim + seed payload

**Decision**: a single `SECURITY INVOKER` RPC, `claim_and_seed_starter()`,
that performs the marker INSERT (with `ON CONFLICT DO NOTHING`) and the
starter-row INSERTs inside one PL/pgSQL function body. Returns boolean —
`true` when the seed ran on this call, `false` when the user was already
seeded. The middleware makes one `client.rpc('claim_and_seed_starter')`
call and inspects the result.

**Alternatives considered**:

1. **Two separate JS client calls** — `client.from('user_seed_state')
   .insert(...)` followed by a separate `client.rpc(...)` for the row
   inserts.
   *Rejected* because each `@supabase/supabase-js` call is a separate
   HTTP request to PostgREST, and each PostgREST request runs in its own
   transaction. If the marker INSERT commits and the subsequent RPC fails
   (network blip, timeout, PostgREST 5xx, RPC-side exception), the user
   is permanently marked-seeded with zero seed rows — violating FR-013
   and FR-014. An earlier iteration of this document mistakenly asserted
   that PostgREST wraps both calls in a shared transaction; it does not.

2. **Single `claim_and_seed_starter()` RPC.** **Chosen.** Both the marker
   INSERT and the row INSERTs run inside one PL/pgSQL function body,
   which is one Postgres transaction by construction. A failure mid-body
   rolls back the marker and any partial row inserts together; the next
   request re-enters the function cleanly. Concurrent first calls from
   the same user serialize on the `user_seed_state` primary key —
   exactly one INSERT succeeds (returns `true`); the other hits
   `ON CONFLICT DO NOTHING`, the function short-circuits before the row
   INSERTs (`v_claimed = 0`), and returns `false`. No duplicate seed
   rows can be created.

3. **JS client + manual `BEGIN/COMMIT`.** *Rejected* — PostgREST does
   not expose explicit transaction control to the JS client.

**Tradeoff**: the seed payload lives in PL/pgSQL rather than in
JavaScript. Updating the seed content requires `ALTER FUNCTION REPLACE`
via the Supabase SQL editor, not a JS server redeploy. Acceptable —
seed content changes are rare and want operator review anyway.

---

## R-7 Lazy import discipline

**Decision**: keep the existing lazy-import pattern from
[server/repositories/index.js](../../server/repositories/index.js) and
extend it to the Supabase adapters.

**Alternatives considered**:

1. **Static imports at top of file.** *Rejected* because local-mode boot
   would import `@supabase/supabase-js` and the Supabase adapter modules,
   which is unnecessary and (more importantly) means a future Supabase
   import side effect could affect local mode without anyone noticing.

2. **Lazy imports.** **Chosen.** The hosted branch of `createRepositories`
   awaits `import('./supabase/applications.js')` and
   `import('./supabase/profile.js')` only when `config.runtime ===
   'hosted'`. Mirrors the existing SQLite lazy import.

3. **Dynamic ESM with a plugin/loader.** *Rejected* as overkill.

The dispatcher test explicitly asserts that loading the dispatcher in
local mode does not pull in any `@supabase/supabase-js` module (verified
via import-spy or by checking `require.cache` / module registry, depending
on Vitest harness).

---

## R-8 Migration mechanism (operator-applied SQL)

**Decision**: ship the canonical SQL inline in
[data-model.md §5](data-model.md) — single markdown source of truth, no
separate `.sql` file. Operator applies it manually via the Supabase SQL
editor.

**Alternatives considered**:

1. **Programmatic migration runner.** Add a CLI command that runs the
   SQL against the configured Supabase project. *Rejected* because it
   requires service-role access from application code (or a separate
   tool), introduces ordering/idempotency concerns 019 doesn't need at
   this scale, and the project's existing pattern (018's allowlist
   trigger) is already manual.

2. **Manual SQL via Supabase dashboard.** **Chosen.** Matches 018's
   workflow. The canonical SQL lives in the repo; the boot check
   refuses to serve until the SQL has been applied to the configured
   project; the plan-review checklist makes verification a P0 gate.

**Tradeoff**: a step that operators can forget. Mitigated by the boot
check failing loudly with a descriptive error.

---

## R-9 No automated rollback

**Decision**: no down-migration is shipped.

**Rationale**: 019 introduces a NOT NULL column with a CASCADE constraint
plus RLS policies plus a new table. Reverting any of these is a manual
operation that should be planned, not script-fired. Operators who need to
revert can do so via SQL editor.

---

## R-10 Where the seed lives architecturally

**Decision**: the seed fixture content lives in
[contracts/api.md §4](contracts/api.md) (text + table) and in
[data-model.md §5](data-model.md) (as a `SECURITY INVOKER`
RPC function body). The JS server has **no** copy of the seed content.

**Rationale**: writing the seed in PL/pgSQL keeps the marker-INSERT and
the row-INSERTs in the same transaction (R-6). If the seed content
needed to change in the future, a single ALTER FUNCTION REPLACE handles
it; the JS server doesn't need a redeploy.

---

## Open Items (carried into Tasks Phase)

- Whether to inline a per-process LRU short-circuit in the seed middleware
  to skip the seed-claim INSERT for already-seen users. Default: omit.
- Whether the per-request Supabase client lives on `req.supabase` (shared
  across applications + profile adapter calls within a request) or is
  constructed inside each adapter call. Default: shared on `req.supabase`,
  attached by a small earlier middleware.
- Whether the column-list constants (`APPLICATION_COLUMNS_WITHOUT_USER_ID`,
  etc.) live in `server/repositories/supabase/` or in a shared
  `server/db/columns.js`. Default: shared module so SQLite and Supabase
  can't drift.
- Whether to add an integration test against a real Supabase project in CI
  (gated behind an opt-in env var) once the manual quickstart stabilizes.
