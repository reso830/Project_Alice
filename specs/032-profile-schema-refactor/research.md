# Research: Profile Schema Refactor (032)

Decisions and rejected alternatives behind [plan.md](plan.md). Each entry is a choice that materially shaped the design.

## R-1 — Table name: `profile_skill`

**Decision**: name the new table `profile_skill` (singular row), in both backends.

**Why**: the `applications` table already has a `skills` JSONB column ([server/db.js:36](../../server/db.js#L36), 019 migration). A table literally named `skills` would invite confusion between *application-required* skills and *profile* skills, which are unrelated concepts. `profile_skill` is unambiguous and reads naturally as "one row = one skill on a profile."

**Rejected**: `skills` (clashes with the column), `user_skill` (local mode has no user concept; profile-scoped is the accurate framing).

## R-2 — Hosted atomic save via a PL/pgSQL RPC

**Decision**: hosted writes (both normal save and lazy migration) go through a new `save_profile_with_skills(p_data jsonb, p_skills jsonb)` `SECURITY INVOKER` function that, in one transaction, upserts the profile document, deletes the profile's skill rows, and re-inserts them in array order.

**Why**: FR-005 / FR-011 require the document write + skill-row replacement to be atomic. With `@supabase/supabase-js`, each call is a separate PostgREST request and therefore a separate Postgres transaction — exactly the failure mode 019 already documented for the seed ([019 data-model §1.3](../019-supabase-persistence/data-model.md)). A doc-upsert that commits followed by a failed skill insert would leave the profile inconsistent (skills lost or stale). One PL/pgSQL body = one transaction, so a mid-flight failure rolls back cleanly. `SECURITY INVOKER` keeps RLS in force — the function can only touch `auth.uid()`'s rows.

**Rejected**: sequential JS calls (`upsert` then `delete` then `insert`). Simpler, no new SQL object, but violates the approved atomicity requirement and risks orphaned/duplicate rows. Operator consequence of the RPC (one more SQL object) is accepted and made explicit in [quickstart.md](quickstart.md).

`ORDER BY ordinality` on `jsonb_array_elements(p_skills) WITH ORDINALITY` guarantees identity ids are assigned in payload order, which is what the read path relies on for the "Custom" sort.

## R-3 — Migration is lazy-on-read, reusing the JS model

**Decision**: a profile whose document still carries a `skills` key is migrated the first time it is read, in both backends, by reusing `splitProfileForStorage` (which calls 031's `normaliseProfile`).

**Why**:
- **Single home for legacy handling.** 031 already converts legacy `string[]` → `{ name, level: 2 }`, coerces out-of-range levels, and drops junk ([src/models/profile.js](../../src/models/profile.js)). Reusing it means migration behaves *identically* to load, with zero duplicated logic. A hand-written SQL backfill would have to re-implement string-vs-object detection, level coercion, and junk filtering in PL/pgSQL — fragile and a second source of truth.
- **Honors the clarification** ("auto-migrate, no operator/user step, idempotent"). The only operator action is applying the schema SQL (table/RLS/RPC), which is the unavoidable established pattern for every hosted change; the data move is automatic.
- **Consistent across modes** — local and hosted share the same trigger and the same code.

**Rejected**: (a) deploy-time SQL `DO $$ ... $$` backfill — fragile legacy handling, duplicates the model. (b) A one-shot JS migration script over all users via the service role — an extra operator step and admin-client surface for no benefit over lazy-on-read.

**Accepted cost**: the first read of an un-migrated profile performs a write. Guarded by the `skills`-key check (one time per profile) and idempotent under concurrency (delete-then-insert converges).

## R-4 — Skill order via insertion order, no position column

**Decision**: preserve the user's "Custom" order implicitly. Reads `ORDER BY id ASC`; saves delete-then-reinsert in payload order so ascending id == payload order.

**Why**: Clarification 2026-06-02 (Option B). Avoids an extra column and keeps the write path simple. Because the save already replaces the whole set, monotonic identity ids naturally encode order. (Postgres gives no ordering guarantee without `ORDER BY`, so the explicit sort is mandatory — not incidental.)

**Rejected**: explicit `position` column (more bookkeeping for no extra capability here); relying on unordered reads (would regress 031's Custom sort).

## R-5 — Proficiency column is `NOT NULL CHECK (1..5)`

**Decision**: store proficiency as a non-null integer constrained to 1–5.

**Why**: 031 gates save on unrated (`level: null`) skills (FR-014), so an unrated skill can never be persisted — the column never needs to hold `NULL`. A `CHECK` constraint is defense-in-depth against a future bug writing an out-of-range value, complementing the app-level validation.

**Rejected**: nullable proficiency (would model a state that can't be saved); no `CHECK` (loses a cheap integrity guard).

## R-6 — `normaliseProfile` stays skills-inclusive; adapters split

**Decision**: the shared model still produces and validates the embedded `{ ..., skills: [...] }` shape. Only the SQLite/Supabase adapters split skills out on write and rejoin on read.

**Why**: the route validates `req.body` (with skills) before the adapter ([server/routes/profile.js:43](../../server/routes/profile.js#L43)), and the UI exchanges the embedded shape. Keeping the model unchanged means the API/UI contract is provably untouched; the storage split is a pure adapter concern. Demo mode (ephemeral) therefore needs no change.

**Rejected**: making `normaliseProfile` strip skills — would ripple into the route, demo store, and every test that asserts the embedded shape, expanding blast radius for no gain.

## R-7 — `assertHostedSchema` gains a `profile_skill` probe

**Decision**: add a probe `{ table: 'profile_skill', column: 'user_id', failOn: [42P01, 42703] }` pointing at this feature's data-model doc.

**Why**: matches the boot-time guard every hosted table already has ([server/health.js:5](../../server/health.js#L5)); a forgotten migration fails fast with an actionable hint instead of surfacing as a runtime 500 on first profile read. The RPC's absence is not probed (the helper only checks tables/columns) but surfaces immediately on the first save and is covered by the quickstart smoke.
