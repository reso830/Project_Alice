# Implementation Plan: Profile Schema Refactor

**Branch**: `032-profile-schema-refactor` | **Spec**: [spec.md](spec.md)  
**Created**: 2026-06-02  
**Input**: Feature brief `docs/features/032-profile-schema-refactor.md` + [spec.md](spec.md)  
**Supporting artifacts**: [research.md](research.md) · [data-model.md](data-model.md) · [contracts/api.md](contracts/api.md) · [quickstart.md](quickstart.md) · [checklists/plan-review.md](checklists/plan-review.md)

## Summary

Promote profile **skills** from an array embedded in the profile JSON document to a dedicated, per-profile `profile_skill` store in **both** persistence modes (local SQLite + hosted Supabase). The store becomes the **sole source of truth** for skills; the profile document no longer carries a `skills` key. Reads reassemble skills onto `profile.skills` so the API contract and UI are byte-for-byte unchanged. Existing profiles auto-migrate, idempotently, on first read. Demo mode keeps its ephemeral in-memory shape (no persistence layer to split).

This is a **persistence-only** refactor: no UI changes, no new public endpoints, no change to the skill model (the 1–5 scale, validation, and 50-skill cap from feature 031 are untouched).

## Constitution Check

| Rule | Compliance |
|------|------------|
| Simple, readable code over clever abstractions | Splitting skills out is a thin adapter concern; the shared model gains two small pure helpers (`splitProfileForStorage` / `joinProfileWithSkills`). |
| Separate business logic from UI | Split/join + normalization stay in `src/models/profile.js`; adapters only persist. No UI touched. |
| Centralized, reusable validation | `validateProfile` / `normaliseProfile` (031) are reused unchanged; migration reuses the same normalization so legacy handling has one home. |
| New dependencies require justification | **None added.** Uses existing `better-sqlite3` transactions and the existing Supabase RPC pattern. |
| Local-first; no external tracking | Both modes get the store at parity; no new external service or telemetry. |
| No silent data corruption / overwrites | Migration is loss-free and idempotent; saves replace a profile's rows transactionally. |
| Core validation has automated tests | New helpers + adapter behavior + migration covered across SQLite, Supabase (mocked), and model unit tests. |
| Mandatory final phases | Release Prep (version/CHANGELOG/README/REPO_MAP/deployment/roadmap/package-lock) + a light Browser Smoke (transparent-contract proof) — see `/speckit.tasks`. |

No deviations to record.

## Architecture

### Storage shape

A new table **`profile_skill`** (singular row per skill; named to avoid clashing with the existing `applications.skills` JSONB column):

- **Local (SQLite)**: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `profile_id INTEGER NOT NULL DEFAULT 1 REFERENCES profile(id) ON DELETE CASCADE`, `skill_name TEXT NOT NULL`, `proficiency INTEGER NOT NULL CHECK (proficiency BETWEEN 1 AND 5)`; a non-unique index on `profile_id` plus a **case-insensitive unique index** on `(profile_id, lower(skill_name))`.
- **Hosted (Supabase)**: `id bigint GENERATED ALWAYS AS IDENTITY`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `skill_name text NOT NULL`, `proficiency smallint NOT NULL CHECK (proficiency BETWEEN 1 AND 5)`, with RLS mirroring `profile`, an index on `user_id`, and a **case-insensitive unique index** on `(user_id, lower(skill_name))`.

Uniqueness is enforced at the store level (the unique index backstops the app-level dedupe). Non-blank skill names are enforced by application validation (031) + migration cleanup, not a store CHECK. The migration therefore drops blank names and collapses duplicates **before** insert — otherwise the unique index would abort the insert (see Migration below).

Full DDL + RLS + the migration SQL block live in [data-model.md](data-model.md).

**Ordering** (Clarification 2026-06-02 — Option B): no position column. Rows are read `ORDER BY id ASC`; since a save deletes-then-reinserts a profile's rows in payload order, ascending id reproduces the user's "Custom" order from feature 031.

**Proficiency**: stored as integer 1–5, `NOT NULL` with a `CHECK`. Unrated (`level: null`) is a transient editor state — 031's save-gating prevents it ever reaching the store (FR-014), so the column never needs `NULL`.

### Shared model (`src/models/profile.js`)

Two new pure helpers keep the split/join logic centralized and unit-testable:

- `splitProfileForStorage(profile)` → `{ document, skills }`. Runs `normaliseProfile`, then returns the document with `skills` removed and the normalised `skills` array separately.
- `joinProfileWithSkills(document, skills)` → a profile object with `skills` attached (reassembled read shape).

`normaliseProfile` / `validateProfile` are **unchanged** — they still produce/validate the embedded shape, which is what the route and UI exchange.

### Read / write flow

```
GET /api/profile
  route → repos.profile.get()
        → read profile document (no skills key)
        → read profile_skill rows ORDER BY id  → [{ name, level }]
        → joinProfileWithSkills(document, skills)
        → { ...document, skills }            (identical to pre-032 shape)

PUT /api/profile
  route → validateProfile(body)              (unchanged; sees embedded skills)
        → repos.profile.upsert(body)
        → splitProfileForStorage(body) → { document, skills }
        → TRANSACTION:
            upsert profile document (without skills)
            delete this profile's profile_skill rows
            insert skills in payload order
        → get()  (reassembled)
```

- **Local**: the transaction is a `better-sqlite3` `db.transaction(...)`.
- **Hosted**: atomicity across the doc upsert + skill delete/insert requires a single Postgres transaction, so the write goes through a new `SECURITY INVOKER` RPC **`save_profile_with_skills(p_data jsonb, p_skills jsonb)`** (RLS still applies; the function only touches `auth.uid()`'s rows). This mirrors the existing `claim_and_seed_starter()` precedent. *(Operator consequence: one more SQL object to apply — see Risks.)*

### Migration (auto, idempotent, on first read)

A profile whose stored document still contains a `skills` key is migrated **lazily on read**, in both modes, reusing 031's normalization for the **skills only** (so legacy bare strings → `{ name, level: 2 }`, junk dropped, out-of-range coerced). Non-skill document sections are written back **verbatim** — migration does **not** run the full `normaliseProfile` over the document on read (FR-008):

```
get():
  read document
  if document has `skills` key:
      skills   = splitProfileForStorage(document).skills   // 031-normalised skills only
      stripped = { ...document } without `skills`           // non-skill fields VERBATIM
      persist (stripped, skills) via the transactional write path (local txn / hosted RPC)
      document = stripped
  reassemble + return
```

Note the contrast with **save**: a normal `upsert` persists `splitProfileForStorage(profile).document` (the fully-normalised document — unchanged save behavior, since save has always normalised). Only the read-time **migration** uses the verbatim-stripped document so it cannot alter non-skill fields a user never edited.

Idempotent: after migration the document has no `skills` key, so subsequent reads skip the branch. Safe under concurrent first-reads — the write path deletes-then-inserts the same normalised set, converging to N rows. Reusing the JS model (not hand-written SQL) keeps legacy skill handling identical to feature 031 and avoids a fragile SQL backfill.

### Hosted schema rollout

The `profile_skill` table + RLS + the `save_profile_with_skills` RPC are applied by the operator via the SQL-in-markdown block in [data-model.md](data-model.md) — the established invariant for every hosted schema change in this repo. `assertHostedSchema` ([server/health.js](../../server/health.js)) gains a probe for `profile_skill.user_id` so a missing migration fails the boot check with a descriptive hint. The data backfill itself is automatic (lazy-on-read), so there is **no per-user operator step**.

### Demo mode

`src/data/demoStore.js` is ephemeral and has no persistence layer to split against; it keeps skills embedded in the in-memory `_profile` and already returns them in the contract shape. The demo seed (`server/seeds/profileData.js` → `src/data/demoSeed.js`) already uses `{ name, level }` (031). **No demo changes are expected**; the parity test continues to assert equality. (Verify-only.)

## Data Flow

1. **First read after deploy** (existing profile): document still has `skills` → lazy migration writes `profile_skill` rows, strips the key, returns reassembled profile. Subsequent reads are pure (document + rows → join).
2. **Save**: validated body → split → transactional doc-upsert + row-replace (local txn / hosted RPC) → reassembled return.
3. **New/empty profile**: no rows; `skills: []`. First upsert with skills creates rows.
4. **Demo**: unchanged in-memory path.

## Risks and Tradeoffs

| Risk / Tradeoff | Mitigation |
|-----------------|------------|
| **Hosted save now needs a PL/pgSQL RPC** (operator applies one more SQL object). Sequential JS calls were rejected because they are separate PostgREST transactions and would violate FR-005/FR-011 (a mid-flight failure could orphan or duplicate rows). | RPC mirrors the proven `claim_and_seed_starter` pattern; `assertHostedSchema` + quickstart make the operator step explicit; smoke test verifies it. Documented in [research.md](research.md) R-2. |
| **A read that writes** (lazy migration) is mildly surprising and adds first-read latency post-deploy. | Guarded to fire only when an embedded `skills` key is present (one time per profile); converges idempotently; alternative deploy-time SQL backfill rejected for legacy-handling fragility (research.md R-3). |
| **Concurrent first-reads** could both attempt backfill. | Write path is delete-then-insert of the same normalised set → converges to N rows; doc-strip short-circuits future reads. |
| **Ordering regression** (Custom sort) if row order is not preserved. | Reads `ORDER BY id`; saves reinsert in payload order. Covered by an explicit round-trip ordering test. |
| **Two backends drift** in skill handling. | Both adapters reuse the same shared `split`/`join`/`normaliseProfile`; contract tests run against both. |
| **Down-migration** (rolling back) not provided. | Consistent with 019's "no down migration" stance; documented in data-model.md. The reassembled read shape is unchanged, so a rollback to pre-032 code reading post-032 data is the only gap — accept + document. |

## Validation Approach

- **Model unit tests** (`tests/models/profile.test.js`): `splitProfileForStorage` removes `skills` and returns the normalised array; `joinProfileWithSkills` round-trips; legacy/junk/coercion paths (reuse 031 fixtures).
- **SQLite adapter** (`tests/server/repositories/profile.test.js`): save→get round-trip with skills as rows; ordering preserved; empty-skills; lazy migration from an embedded-`skills` document; idempotent re-read; document has no `skills` key after save.
- **Supabase adapter** (`tests/server/repositories/supabase/profile.test.js`): `upsert` calls `save_profile_with_skills` with split args; `get` issues the document + ordered skills reads and reassembles; lazy migration path; mocked client.
- **Route integration** (`tests/server/profile.test.js`): `GET` returns embedded `skills`; `PUT` validates then round-trips; validation errors unchanged.
- **Demo parity** (`tests/data/demoStore.test.js`): unchanged — asserts demo profile still deep-equals the seed with embedded skills.
- **Health probe** (`tests/server/health.test.js`): new `profile_skill` probe fails on `42P01`/`42703`, passes on 200.
- **Manual**: quickstart steps — apply hosted SQL, boot local, load Profile page, edit/save a skill (transparent-contract smoke).

## Affected Areas

### Likely inspected (read for context, may not change)
- [src/data/demoStore.js](../../src/data/demoStore.js) — confirm embedded-skills path is unaffected (inspect only).
- [src/data/demoSeed.js](../../src/data/demoSeed.js), [server/seeds/profileData.js](../../server/seeds/profileData.js) — confirm `{ name, level }` shape already matches (inspect only).
- [server/db-seed-profile.js](../../server/db-seed-profile.js) — exercises `saveProfile`; verify it now writes skill rows (inspect; likely no change).
- [server/routes/profile.js](../../server/routes/profile.js) — confirm validate-then-upsert flow is untouched (inspect only).
- [server/repositories/middleware.js](../../server/repositories/middleware.js), [server/repositories/index.js](../../server/repositories/index.js) — confirm dispatcher wiring needs no change (inspect only).

### Likely modified
- [src/models/profile.js](../../src/models/profile.js) — add `splitProfileForStorage` / `joinProfileWithSkills` (pure, exported).
- [server/db.js](../../server/db.js) — add `profile_skill` `CREATE TABLE IF NOT EXISTS` (+ index) to `initSchema`.
- [server/db/profile.js](../../server/db/profile.js) — rewrite `getProfile` / `saveProfile` to read/write the skill rows in a transaction, with lazy-migration.
- [server/repositories/supabase/profile.js](../../server/repositories/supabase/profile.js) — `get` reads doc + ordered skills; `upsert` calls the RPC; lazy-migration.
- [server/health.js](../../server/health.js) — add the `profile_skill` probe.
- [server/db/columns.js](../../server/db/columns.js) — add a small `profile_skill` column projection / field map if needed by the adapter (inspect; minimal).

### Tests added/updated
- `tests/models/profile.test.js`, `tests/server/repositories/profile.test.js`, `tests/server/repositories/supabase/profile.test.js`, `tests/server/profile.test.js`, `tests/server/health.test.js`, `tests/data/demoStore.test.js` (verify-unchanged).

### Docs (Release Prep)
- New: `specs/032-profile-schema-refactor/data-model.md` (canonical hosted SQL).
- Update: `docs/deployment.md` (apply the 032 SQL block), `docs/REPO_MAP.md` (new table + spec files), `CHANGELOG.md`, `README.md`, `docs/feature_roadmap.md`, `package.json` + `package-lock.json` version bump.

### Explicitly out of scope
- All Profile UI ([src/pages/Profile.js](../../src/pages/Profile.js), [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js)) and CSS.
- The application-level `applications.skills` JSONB column (unrelated to profile skills).
- New skill API endpoints (deferred to consuming features 033–037).
- Resume/JD parsing, compatibility scoring, ATS, analytics (non-goals).
- The skill model itself (scale, labels, validation, 50-cap) — owned by feature 031.

## Next Steps

Run `/speckit.tasks` to generate the phased task list (ending with Release Prep, then a light Browser Smoke that proves the transparent contract).
