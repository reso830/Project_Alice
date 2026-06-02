# Tasks: Profile Schema Refactor (032)

**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Data model**: [data-model.md](data-model.md)
**Research**: [research.md](research.md)
**Contracts**: [contracts/api.md](contracts/api.md)
**Quickstart**: [quickstart.md](quickstart.md)
**Plan review**: [checklists/plan-review.md](checklists/plan-review.md)
**Branch**: `032-profile-schema-refactor`

---

## Phase Map

| Phase | Theme | Blocks |
|---|---|---|
| 01 | **Model** — `splitProfileForStorage` / `joinProfileWithSkills` pure helpers + unit tests | 02, 03 |
| 02 | **Local (SQLite)** — `profile_skill` table in `initSchema`; rewrite `db/profile.js` get/save (txn) + lazy-on-read migration; adapter tests; seed-CLI verification | 04 |
| 03 | **Hosted (Supabase)** — finalize migration SQL + RPC, rewrite supabase adapter (RPC save, skills read, lazy migration), add `assertHostedSchema` probe; adapter + health tests | 04 |
| 04 | **Cross-cutting verification** — route integration (GET embeds / PUT round-trips), demo parity verified unchanged, full-suite green | 05 |
| 05 | **Release Prep (REQUIRED)** — version bump, CHANGELOG, README, deployment.md, REPO_MAP, feature_roadmap, package-lock, docs sanity | 06 |
| 06 | **Browser Smoke Test (REQUIRED — transparent-contract proof)** — walk US-1/US-2/US-3 Independent Tests against the merge state | merge |

**Sequencing notes:**
- Phase 01 (model helpers) blocks 02 and 03 — both adapters split/join through the shared model.
- Phases 02 and 03 are independent (different files, different backends); either order. Do 02 first so the local path can be smoke-tested without applying hosted SQL.
- Phase 04 depends on both adapters being done.
- Release Prep (05) is second-to-last; Browser Smoke (06) is last — constitution Amendment 1.3.0.

**FR coverage**: FR-002/004 → 01.1, 01.2; FR-001 → 02.1, 03.1; FR-002/004/005/014 → 02.2, 03.2; FR-006/007/008/009/010/011 → 02.3, 03.3; FR-003 → 02.2/03.2/04.2; FR-015 → 02.4, 03.4, 04.1; FR-012/013 → negative (out-of-scope notes + 04.1 assertions).

---

## Phase 01 — Model

### [x] Task 01.1 — `splitProfileForStorage` helper

**Target file**: [src/models/profile.js](../../src/models/profile.js)

**What to do**:
1. Add and export `splitProfileForStorage(profile)` returning `{ document, skills }`.
2. Internally call `normaliseProfile(profile)` (unchanged), then return `document` = the normalised profile with the `skills` key removed, and `skills` = the normalised `skills` array (`[{ name, level }]`).
3. Do not mutate the input; build a new `document` object without `skills`.

**Expected behavior**: a single pure function that produces the two storage halves from a whole profile, reusing 031's normalization so legacy/junk/coercion handling has one home.

**Constraints**: model layer only; no DB/IO. `normaliseProfile` and `validateProfile` MUST remain unchanged (they still produce/validate the embedded shape). Unrated (`level: null`) entries pass through here unchanged — save-gating happens in `validateProfile` upstream, not here.

**Validation**: `tests/models/profile.test.js` (01.3).

**Out of scope**: persistence, the `skills` UI, `mergeResumeData`.

---

### [x] Task 01.2 — `joinProfileWithSkills` helper

**Target file**: [src/models/profile.js](../../src/models/profile.js)

**What to do**:
1. Add and export `joinProfileWithSkills(document, skills)` returning `{ ...document, skills }` (the reassembled read/API shape).
2. Treat a missing/`null` `skills` argument as `[]`. Do not re-normalise here (rows come from storage already normalised); just attach.

**Expected behavior**: reconstructs the pre-032 embedded profile shape from the document + ordered skill rows.

**Constraints**: pure; must produce a shape indistinguishable from the old embedded profile so API/UI are unchanged (FR-004). Preserve the order of the `skills` array as given (caller supplies insertion order).

**Validation**: `tests/models/profile.test.js` (01.3).

**Out of scope**: ordering/sorting logic (caller orders rows), persistence.

---

### [x] Task 01.3 — Model unit tests for split/join

**Target file**: [tests/models/profile.test.js](../../tests/models/profile.test.js)

**What to do**:
1. `splitProfileForStorage`: returns a `document` with **no** `skills` key and a `skills` array equal to `normaliseProfile(profile).skills`; non-skill fields equal the normalised document.
2. Round-trip: `joinProfileWithSkills(...splitProfileForStorage(p))` deep-equals `normaliseProfile(p)` for a profile with skills, with no skills, and with legacy `string[]` skills (→ `{ name, level: 2 }`).
3. `joinProfileWithSkills(doc, undefined)` yields `skills: []`.
4. Input is not mutated.

**Expected behavior**: locks the contract that the split is loss-free and the join reproduces the embedded shape.

**Constraints**: reuse existing 031 fixtures where possible; do not duplicate normalization assertions already covered for `normaliseProfile`.

**Validation**: `npm test -- tests/models/profile.test.js`.

**Out of scope**: adapter/DB tests (Phases 02–04).

---

## Phase 02 — Local (SQLite)

### [x] Task 02.1 — `profile_skill` table in `initSchema`

**Target file**: [server/db.js](../../server/db.js)

**What to do**:
1. Add a `CREATE TABLE IF NOT EXISTS profile_skill (...)` block to `initSchema` per [data-model.md §2](data-model.md): `id INTEGER PRIMARY KEY AUTOINCREMENT`, `profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profile(id) ON DELETE CASCADE`, `skill_name TEXT NOT NULL`, `proficiency INTEGER NOT NULL CHECK (proficiency BETWEEN 1 AND 5)`.
2. Add `CREATE INDEX IF NOT EXISTS idx_profile_skill_profile ON profile_skill(profile_id);`.
3. Add the case-insensitive uniqueness backstop: `CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_skill_unique ON profile_skill(profile_id, lower(skill_name));`.

**Expected behavior**: the local skill store exists after boot; idempotent. The unique index enforces no-duplicate-per-profile at the store level (backstop behind app dedupe).

**Constraints**: additive only; do not alter the existing `profile` or `applications` tables. Keep within the existing `targetDb.exec(...)` style. Non-blank skill names are NOT enforced by a store CHECK (app validation + migration cleanup handle that).

**Validation**: exercised by 02.4 adapter tests (table must exist for round-trips).

**Out of scope**: hosted schema (Phase 03), data backfill (02.3).

---

### [x] Task 02.2 — Rewrite SQLite `getProfile` / `saveProfile`

**Target file**: [server/db/profile.js](../../server/db/profile.js)

**What to do**:
1. `saveProfile(profile, targetDb)`: call `splitProfileForStorage(profile)`; inside a `targetDb.transaction(...)`: upsert the `profile` row with `data = JSON.stringify(document)` (no `skills` key); `DELETE FROM profile_skill WHERE profile_id = 1`; insert each skill (`skill_name`, `proficiency`) **in array order**. Return `getProfile(targetDb)`.
2. `getProfile(targetDb)`: read the `profile` row → parse `data`; read `SELECT skill_name, proficiency FROM profile_skill WHERE profile_id = 1 ORDER BY id ASC` → map to `[{ name, level }]`; return `joinProfileWithSkills(document, skills)`. Return `null` when no profile row exists.

**Expected behavior**: save splits skills into rows transactionally; read reassembles the embedded shape in insertion order. Document never carries a `skills` key (FR-002); read shape is identical to pre-032 (FR-004); write is atomic (FR-005).

**Constraints**: import `splitProfileForStorage` / `joinProfileWithSkills` from the model. Do not change the exported function signatures (`getProfile` / `saveProfile`) — the repository wrapper and seed script depend on them. Unrated skills cannot reach here for a normal save (validated upstream); the `CHECK` is the backstop.

**Validation**: `tests/server/repositories/profile.test.js` (02.4).

**Out of scope**: lazy migration logic (02.3 adds the branch), hosted adapter.

---

### [x] Task 02.3 — Local lazy-on-read migration

**Target file**: [server/db/profile.js](../../server/db/profile.js)

**What to do**:
1. In `getProfile`, after parsing `data`: if the parsed document still contains a `skills` key, run the migration. Take the normalised skills via `splitProfileForStorage(document).skills`; **drop blank-name entries and collapse duplicates** (case-insensitive, whitespace-collapsed; first occurrence wins) **before insert** — this is mandatory, since the unique index (02.1) would otherwise abort the insert on a duplicate or on two empty `lower('')` names. Build the stripped document as `{ ...document }` with the `skills` key **removed** (all other sections left **verbatim** — do NOT re-normalise non-skill fields). Persist via the same transactional path as `saveProfile` (upsert stripped document + replace `profile_skill` rows). Then continue to the normal reassembly.
2. Ensure idempotency: after migration the stored document has no `skills` key, so subsequent reads skip the branch.

**Expected behavior**: an existing profile whose `data` embeds `skills` migrates automatically on first read, loss-free and idempotent (FR-006/007/008/010/011), with legacy `string` skills defaulting to level 2 via the reused normalization (FR-009). Non-skill document fields are unchanged (FR-008 / US1#4).

**Constraints**: reuse the model normalization for **skills only** — do not re-implement legacy/coercion logic, and do NOT run the full `normaliseProfile` over the document on read (that would alter non-skill fields). Migration must be transactional (no half-migrated state). No user/operator action.

**Validation**: `tests/server/repositories/profile.test.js` (02.4) — seed a `profile.data` with embedded `skills` directly, read, assert rows created + key stripped + second read is a no-op.

**Out of scope**: hosted migration (03.3).

---

### [x] Task 02.4 — SQLite adapter tests

**Target file**: [tests/server/repositories/profile.test.js](../../tests/server/repositories/profile.test.js)

**What to do**: add cases —
1. Round-trip: `upsert` a profile with skills → `get` returns identical embedded `skills` (names, levels, **order**).
2. Order preserved across a re-save that reorders skills.
3. Empty skills → `get` returns `skills: []`, zero rows.
4. Document has **no** `skills` key after save (`SELECT data` assertion).
5. Lazy migration: insert a `profile` row whose `data` embeds `skills` (incl. one legacy `string`), read once → rows created (string → level 2), key stripped; read again → unchanged (idempotent).
6. Migration is loss-free for distinct skills (distinct count + names preserved; junk dropped).
7. Migration duplicate/blank handling: a `data` whose embedded `skills` contains a case-insensitive duplicate (e.g. `React`/`react`) and a blank-name entry migrates to one row per distinct name (first occurrence's level wins) with the blank dropped — and the unique index does not abort the insert (FR-008/FR-009/FR-010).

**Validation**: `npm test -- tests/server/repositories/profile.test.js`.

**Out of scope**: Supabase adapter, route tests.

---

### [x] Task 02.5 — Verify local seed CLI against the new table

**Target files**: [server/db-seed-profile.js](../../server/db-seed-profile.js) (inspect; adjust only if needed)

**What to do**:
1. Confirm the CLI seed path still works now that `saveProfile` writes to `profile_skill`. `db-seed-profile.js` already calls `initSchema()` before `saveProfile(DEMO_PROFILE)` ([server/db-seed-profile.js:16-19](../../server/db-seed-profile.js#L16)), so the table will exist — verify the seed completes and writes one `profile_skill` row per `DEMO_PROFILE` skill, with the stored `profile.data` carrying no `skills` key.
2. Only change the script if the run fails (e.g., an explicit ordering issue); otherwise record "no change needed" in the task notes.

**Expected behavior**: `node server/db-seed-profile.js` seeds the demo profile and its skills into the new store without error.

**Constraints**: do not alter the seed *data* (`server/seeds/profileData.js`); this is a path-verification task.

**Validation**: run `node server/db-seed-profile.js` against a temp `ALICE_DB_PATH`; inspect `profile_skill` + `profile.data`.

**Out of scope**: hosted seed (handled by the existing `claim_and_seed_starter` RPC, which does not seed a profile row).

---

## Phase 03 — Hosted (Supabase)

### [x] Task 03.1 — Finalize hosted migration SQL + RPC

**Target file**: [specs/032-profile-schema-refactor/data-model.md](data-model.md) §3 (canonical SQL — already drafted; confirm correctness)

**What to do**:
1. Confirm the `profile_skill` table DDL, the four RLS policies (scoped to `authenticated`, `user_id = auth.uid()`), the `user_id` index, the **case-insensitive unique index** on `(user_id, lower(skill_name))`, and the `save_profile_with_skills(p_data jsonb, p_skills jsonb)` `SECURITY INVOKER` RPC match the adapter's calls and 019's conventions.
2. Confirm idempotency (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE FUNCTION`) and the `EXECUTE` grant to `authenticated`.

**Expected behavior**: the doc block is the single source of truth an operator pastes into the Supabase SQL editor (FR-001/005 hosted side).

**Constraints**: no separate `.sql` file (mirror 019). RPC must use `WITH ORDINALITY ... ORDER BY ord` so insertion order is preserved.

**Validation**: applied + verified manually in [quickstart.md §2](quickstart.md); referenced by 03.3 probe and 06 smoke.

**Out of scope**: executing it against production (operator step at deploy).

---

### [x] Task 03.2 — Rewrite Supabase adapter get/upsert

**Target file**: [server/repositories/supabase/profile.js](../../server/repositories/supabase/profile.js)

**What to do**:
1. `upsert(profile)`: `splitProfileForStorage(profile)` → call `client.rpc('save_profile_with_skills', { p_data: document, p_skills: skills })`; on success return `get()` (reassembled). Surface RPC errors via the existing `if (error) throw error` pattern.
2. `get()`: read the profile `data` (existing `select(SELECT_PROJECTION)`), then `client.from('profile_skill').select('skill_name, proficiency').eq('user_id', userId).order('id', { ascending: true })` → map to `[{ name, level }]`; return `joinProfileWithSkills(document, skills)`. Keep `null` when no profile row.

**Expected behavior**: hosted save is atomic via the RPC (FR-005/FR-011); read reassembles ordered skills; document never carries `skills` (FR-002); response shape unchanged (FR-004).

**Constraints**: import the model helpers; keep `user_id` out of API responses (019 invariant). `proficiency` (smallint) maps to `level`; `skill_name` to `name`. Do not add new public routes.

**Validation**: `tests/server/repositories/supabase/profile.test.js` (03.4).

**Out of scope**: local adapter, route layer.

---

### [x] Task 03.3 — Hosted lazy migration + `assertHostedSchema` probe

**Target files**: [server/repositories/supabase/profile.js](../../server/repositories/supabase/profile.js), [server/health.js](../../server/health.js)

**What to do**:
1. In the supabase `get()`, if the read profile `data` still contains a `skills` key, migrate: take `skills = splitProfileForStorage(data).skills`, then **drop blank-name entries and collapse duplicates** (case-insensitive, whitespace-collapsed; first wins) **before** the RPC call — mandatory, since the unique index (03.1) would otherwise abort the insert. Build the stripped document as `{ ...data }` with the `skills` key **removed** (non-skill sections **verbatim** — do NOT re-normalise them), then call `save_profile_with_skills(strippedDocument, cleanedSkills)` (atomic) and reassemble from the (now-clean) state. Idempotent — subsequent reads have no `skills` key.
2. Add a probe to `health.js` `PROBES`: `{ table: 'profile_skill', column: 'user_id', failOn: [UNDEFINED_TABLE, UNDEFINED_COLUMN], docPath: 'specs/032-profile-schema-refactor/data-model.md §3' }`.

**Expected behavior**: hosted profiles auto-migrate on first read (FR-006/007/008/011); a missing migration fails boot with an actionable hint.

**Constraints**: reuse model normalization (no SQL legacy logic). The RPC absence is not probed (helper checks tables/columns only) — it surfaces on first save + is covered by the smoke test.

**Validation**: `tests/server/repositories/supabase/profile.test.js` (03.4) for migration; [tests/server/health.test.js](../../tests/server/health.test.js) for the probe (fails on `42P01`/`42703`, passes on 200).

**Out of scope**: local migration (02.3).

---

### [x] Task 03.4 — Supabase adapter tests

**Target file**: [tests/server/repositories/supabase/profile.test.js](../../tests/server/repositories/supabase/profile.test.js)

**What to do**: with the existing mocked client —
1. `upsert` calls `rpc('save_profile_with_skills', { p_data: <no skills key>, p_skills: <array> })`.
2. `get` issues the profile select **and** the ordered `profile_skill` select, then returns a profile with embedded `skills` in order.
3. Lazy migration: a profile read whose `data` embeds `skills` triggers the RPC with the split args, then returns reassembled.
4. `null` profile path unaffected.

**Validation**: `npm test -- tests/server/repositories/supabase/profile.test.js`.

**Out of scope**: real network calls; local adapter.

---

## Phase 04 — Cross-cutting verification

### [x] Task 04.1 — Route integration tests

**Target file**: [tests/server/profile.test.js](../../tests/server/profile.test.js)

**What to do**:
1. `GET /api/profile` returns `{ data }` with an embedded `skills` array (post-refactor parity).
2. `PUT /api/profile` with a valid body (incl. skills) returns the reassembled profile; a second `GET` shows persistence.
3. Validation unchanged: unrated/blank/duplicate/over-50 skill bodies still return `400 VALIDATION_ERROR` with field errors (assert 031 rules still enforced — FR-013/FR-014).
4. Assert **no** new profile routes exist (FR-012) — only `GET` and `PUT` on `/`.

**Validation**: `npm test -- tests/server/profile.test.js`.

**Out of scope**: adapter internals (covered in 02/03).

---

### [x] Task 04.2 — Demo parity verification

**Target files**: [tests/data/demoStore.test.js](../../tests/data/demoStore.test.js) (verify), [src/data/demoStore.js](../../src/data/demoStore.js) (inspect only)

**What to do**:
1. Confirm the demo store still returns the profile with embedded `{ name, level }` skills (it keeps the in-memory shape — no table). Run the existing parity test; only adjust if it breaks.
2. Confirm `server/seeds/profileData.js` ↔ `src/data/demoSeed.js` skills already use `{ name, level }` (031) — no change expected.

**Expected behavior**: demo mode still returns reassembled skills (FR-003) with zero code change.

**Constraints**: do **not** add a skill store to demo mode (ephemeral by design). If no change is needed, record that explicitly in the task notes.

**Validation**: `npm test -- tests/data/demoStore.test.js`.

**Out of scope**: persistence backends.

---

### [x] Task 04.3 — Full suite + lint

**Target**: whole repo (verification only)

**What to do**: run `npm test` and the project's lint/format check; confirm green and no contract regressions in profile/applications.

**Validation**: clean `npm test` + lint output.

**Out of scope**: new feature code.

---

## Phase 05 — Release Prep (REQUIRED)

### [x] Task 05.1 — Version + changelog + package-lock

**Target files**: [package.json](../../package.json), [package-lock.json](../../package-lock.json), [CHANGELOG.md](../../CHANGELOG.md)

**What to do**: bump the version (minor — internal schema feature, no breaking API), add a CHANGELOG entry summarizing the skills-to-`profile_skill` refactor (transparent, auto-migrating), and sync the `package-lock.json` root version to match `package.json`.

**Validation**: [tests/release-metadata.test.js](../../tests/release-metadata.test.js) passes; versions match.

**Out of scope**: feature code.

---

### [x] Task 05.2 — Docs: deployment, REPO_MAP, README, roadmap

**Target files**: [docs/deployment.md](../../docs/deployment.md), [docs/REPO_MAP.md](../../docs/REPO_MAP.md), [README.md](../../README.md), [docs/feature_roadmap.md](../../docs/feature_roadmap.md)

**What to do**:
1. `docs/deployment.md`: add the 032 hosted SQL step (apply the `profile_skill` table + RLS + `save_profile_with_skills` RPC from `data-model.md §3`; idempotent; boot check probes it).
2. `docs/REPO_MAP.md`: record the new `profile_skill` table/store and the 032 spec package files.
3. `README.md`: only if a user-facing surface changed — likely a one-line note that profile skills are now first-class storage (no behavior change). Skip if nothing user-facing.
4. `docs/feature_roadmap.md`: tick 032 as shipped/in-progress per the roadmap convention.

**Validation**: docs render; deployment steps match `data-model.md §3`; REPO_MAP lists the new artifacts.

**Out of scope**: feature code.

---

## Phase 06 — Browser Smoke Test (REQUIRED — transparent-contract proof)

### [X] Task 06.1 — Walk the Independent Tests in a real browser

**Target**: running app (local mode at minimum; hosted if a Supabase project is available), against the to-be-merged state.

**What to do**: against a profile that already has skills (pre-existing data):
1. **US-1** (no visible change): load the Profile page — skills render identically (names, levels, order). Open the editor, rename a skill, re-rate one, add one, remove one, save; reload and confirm persistence + order.
2. **US-2** (independent persistence): after a save, confirm via DB/SQL that `profile_skill` has one row per skill and `profile.data` has no `skills` key (quickstart §1.4 / §2.4).
3. **US-3** (safe migration): with a profile whose stored `data` still embedded `skills`, first load migrates transparently; a second load is unchanged.
4. Confirm the "Custom" sort and "By level" sort on the Profile page still behave as in 031.

**Expected behavior**: zero user-visible difference; data lands in the new store; migration is invisible and idempotent.

**Constraints**: exercise the actual merge state. Record results (pass/fail per story) in the task notes. No UI code is expected to change — this phase proves the refactor is transparent.

**Validation**: manual walkthrough notes appended here.

**Out of scope**: new UI work.
