# Data Model: Profile Schema Refactor (032)

**Branch**: `032-profile-schema-refactor` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

This document defines the new `profile_skill` store. §1 is the entity, §2 the
local (SQLite) schema, §3 the canonical hosted (Supabase) migration SQL —
the single source of truth, applied manually via the SQL editor (mirroring
019's "SQL-in-markdown, manually applied" workflow). §4 covers the read/write
mapping; §5 the migration semantics.

---

## 1. Entity: `profile_skill`

One row per skill on a profile. Replaces the per-element entries previously
held in the `Profile.skills` JSON array.

| Attribute | Type | Notes |
|-----------|------|-------|
| `id` | integer (autoincrement / identity) | Insertion order; reads sort by it ascending to reproduce the "Custom" order. |
| owner | `profile_id` (local) / `user_id` (hosted) | FK to the owning profile; `ON DELETE CASCADE`. |
| `skill_name` | text, non-blank | Maps to the model's `name`. **Unique within a profile, case-insensitive** — enforced by a store-level unique index on `(owner, lower(skill_name))` (plus app-layer 031 dedupe + migration collapse). **Non-blank** is enforced by app validation (031) + migration cleanup (blank entries dropped before insert), not a store CHECK. |
| `proficiency` | integer 1–5, `NOT NULL`, `CHECK (1..5)` | Maps to the model's `level`. Unrated (`null`) is a transient editor state and is never persisted (031 FR-014). |

The profile **document** (`profile.data`) keeps every other section
(`summary`, `experience`, `education`, `certifications`, `awards`,
`languages`, `links`, identity/preference fields) and **no longer contains a
`skills` key** after a save or migration.

---

## 2. Local (SQLite)

Added to `initSchema()` in [server/db.js](../../server/db.js) as an idempotent
`CREATE TABLE IF NOT EXISTS` (local mode is single-profile, `profile.id = 1`):

```sql
CREATE TABLE IF NOT EXISTS profile_skill (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL DEFAULT 1 REFERENCES profile(id) ON DELETE CASCADE,
  skill_name  TEXT    NOT NULL,
  proficiency INTEGER NOT NULL CHECK (proficiency BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_profile_skill_profile
  ON profile_skill(profile_id);

-- Case-insensitive uniqueness backstop (no duplicate skill per profile).
-- SQLite supports expression indexes; `lower()` covers ASCII names, which
-- is sufficient as a backstop behind the app-level dedupe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_skill_unique
  ON profile_skill(profile_id, lower(skill_name));
```

Writes happen inside a `better-sqlite3` `db.transaction(...)`: upsert the
profile document (without `skills`), `DELETE FROM profile_skill WHERE
profile_id = 1`, then insert the payload skills in order.

---

## 3. Canonical Hosted Migration SQL

Single source of truth for the hosted schema change. The operator pastes the
whole block into the Supabase SQL editor (see [quickstart.md §2](quickstart.md)).
Idempotent via `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS` +
`CREATE OR REPLACE FUNCTION`. No separate `.sql` file is shipped. No down
migration (consistent with 019).

```sql
-- ============================================================
-- 032 / Profile Schema Refactor — profile_skill + save RPC (idempotent)
-- ============================================================
BEGIN;

-- 3.1 profile_skill table ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_skill (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name  text NOT NULL,
  proficiency smallint NOT NULL CHECK (proficiency BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS profile_skill_user_id_idx
  ON public.profile_skill (user_id);

-- Case-insensitive uniqueness backstop (no duplicate skill per user).
CREATE UNIQUE INDEX IF NOT EXISTS profile_skill_user_name_uniq
  ON public.profile_skill (user_id, lower(skill_name));

ALTER TABLE public.profile_skill ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_skill_select_own ON public.profile_skill;
CREATE POLICY profile_skill_select_own ON public.profile_skill
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS profile_skill_insert_own ON public.profile_skill;
CREATE POLICY profile_skill_insert_own ON public.profile_skill
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profile_skill_update_own ON public.profile_skill;
CREATE POLICY profile_skill_update_own ON public.profile_skill
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profile_skill_delete_own ON public.profile_skill;
CREATE POLICY profile_skill_delete_own ON public.profile_skill
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3.2 save_profile_with_skills(p_data, p_skills) RPC -------------------
--
-- Atomic profile save: upsert the document (without a skills key) AND
-- replace the caller's profile_skill rows in ONE transaction. Returns the
-- stored document jsonb. SECURITY INVOKER so RLS still applies — the
-- function only ever touches auth.uid()'s rows.
--
-- p_data   : the profile document jsonb WITHOUT a `skills` key.
-- p_skills : a jsonb array of { "name": text, "level": 1..5 }, in the
--            order the user saved (the Profile page "Custom" order).
--            Rows are inserted in array order so ascending identity id
--            reproduces that order on read.
CREATE OR REPLACE FUNCTION public.save_profile_with_skills(
  p_data   jsonb,
  p_skills jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
BEGIN
  INSERT INTO public.profile (user_id, data, updated_at)
  VALUES (auth.uid(), p_data, now())
  ON CONFLICT (user_id) DO UPDATE
    SET data = excluded.data, updated_at = excluded.updated_at
  RETURNING data INTO v_data;

  DELETE FROM public.profile_skill WHERE user_id = auth.uid();

  INSERT INTO public.profile_skill (user_id, skill_name, proficiency)
  SELECT auth.uid(), elem->>'name', (elem->>'level')::smallint
  FROM jsonb_array_elements(coalesce(p_skills, '[]'::jsonb))
       WITH ORDINALITY AS t(elem, ord)
  ORDER BY ord;

  RETURN v_data;
END;
$$;

REVOKE ALL ON FUNCTION public.save_profile_with_skills(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_profile_with_skills(jsonb, jsonb) TO authenticated;

COMMIT;
-- ============================================================
-- End of 032 migration. Verify via the boot check (assertHostedSchema).
-- ============================================================
```

**Note**: the migration creates only the schema (table + RLS + RPC). The data
move (embedded `skills` → rows) is performed automatically and idempotently by
the application on first read (see §5) — there is no per-user operator step.

---

## 4. Read / Write Mapping

| Model (`{ name, level }`) | `profile_skill` column |
|---------------------------|------------------------|
| `name` | `skill_name` |
| `level` (1–5) | `proficiency` |

The mapping lives at the adapter boundary; the rest of the app keeps 031's
`{ name, level }` shape. Reassembly on read uses
`joinProfileWithSkills(document, skills)`; the split on write uses
`splitProfileForStorage(profile)` (both in
[src/models/profile.js](../../src/models/profile.js)).

Reads order skills `ORDER BY id ASC`. The API projection for the profile
document is unchanged (`PROFILE_COLUMNS_WITHOUT_USER_ID = ['data']`,
[server/db/columns.js:80](../../server/db/columns.js#L80)) — `user_id` is never
surfaced, consistent with the 019 invariant.

---

## 5. Migration Semantics (auto, idempotent, on first read)

Trigger: a read whose profile document still contains a `skills` key.

1. Take **only** the normalised skills via `splitProfileForStorage(document).skills`
   — this reuses 031's `normaliseProfile`, which migrates legacy `string`
   skills → `{ name, level: 2 }` (Basic), coerces out-of-range levels, and
   drops junk. The document persisted on migration is the stored document with
   the `skills` key removed and **all other sections left verbatim** — migration
   does NOT re-normalize non-skill fields on read (FR-008). (Contrast: a normal
   save persists the fully-normalised document, which is unchanged save
   behavior.)
2. Drop blank-name entries and de-duplicate defensively (case-insensitive,
   whitespace-collapsed; first occurrence wins) **before** inserting rows, so
   legacy data predating 031's dedupe cannot create duplicate rows (FR-010)
   and blank names cannot reach the store. This is required for correctness:
   the unique index (§2/§3) would otherwise abort the migration insert on a
   duplicate or on two empty `lower('')` names. Collapsing duplicates and
   dropping blanks is intentional cleanup, not data loss (FR-008).
3. Persist via the same transactional write path (local `db.transaction`,
   hosted `save_profile_with_skills`) — atomic, so a failure leaves the
   profile fully un-migrated (FR-011).
4. Return the reassembled profile.

**Idempotency**: after step 3 the document has no `skills` key, so later reads
skip the branch. Re-running changes nothing.

**Edge behavior**:
- Profile with no skills / empty array → zero rows; `skills: []`.
- Blank-name rows → preserved through normalization so save-validation rejects
  them; empty legacy strings dropped as junk (031).
- Unrated (`null`) levels are never written (031 gates save); migration only
  sees saved profiles, whose levels are always 1–5.
