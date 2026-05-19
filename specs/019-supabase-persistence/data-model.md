# Data Model: Supabase Persistence (019)

**Branch**: `019-supabase-persistence` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

This document defines the Supabase schema changes 019 introduces. §1–§4 explain
*why* each part of the migration is shaped the way it is and anchor the RLS
policy review; §5 contains the canonical executable SQL the operator applies
via the Supabase SQL editor (mirroring 018's "SQL-in-markdown, manually
applied" workflow). No separate `.sql` file is shipped — §5 is the single
source of truth.

---

## 1. Affected Tables

### 1.1 `public.applications` (modified)

Pre-019 (017's hosted schema): all the SQLite columns plus no ownership column.
Post-019: same columns plus a non-nullable `user_id` referencing `auth.users(id)`.

**Migration sequence** (see §5 below for the executable form):

1. Create `applications` with `user_id uuid NOT NULL REFERENCES
   auth.users(id) ON DELETE CASCADE` when absent.
2. If a project has legacy pre-019 or wrong-typed hosted rows, drop the
   legacy table first rather than inventing `user_id` attribution.
3. `CREATE INDEX applications_user_id_idx ON applications (user_id);`
   — supports the per-user list query that backs `GET /api/applications`.
4. `ALTER TABLE applications ENABLE ROW LEVEL SECURITY;`
5. Policies (one each for SELECT / INSERT / UPDATE / DELETE):
   - `USING (user_id = auth.uid())` for SELECT, UPDATE, DELETE.
   - `WITH CHECK (user_id = auth.uid())` for INSERT and UPDATE.

The existing column set (`company_name`, `job_title`, `status`,
`last_status_update`, `responsibilities`, etc.) is unchanged. The plan's
adapter projection ([contracts/api.md §2](contracts/api.md)) excludes
`user_id` from the column list returned to route handlers, so API response
shapes remain identical to SQLite.

### 1.2 `public.profile` (modified)

Pre-019: single row containing the user's profile, no ownership column.
Post-019: one row per user, owned via `user_id`.

**Migration sequence**:

1. Create `profile` with `user_id uuid NOT NULL REFERENCES auth.users(id)
   ON DELETE CASCADE` when absent.
2. If a project has a legacy unowned profile table, drop it first rather than
   inventing `user_id` attribution.
3. Add `UNIQUE (user_id)`.
   — enforces the one-row-per-user invariant in the database, not just
   in the adapter.
4. `ALTER TABLE profile ENABLE ROW LEVEL SECURITY;`
5. Policies (one each for SELECT / INSERT / UPDATE / DELETE):
   - `USING (user_id = auth.uid())` for SELECT, UPDATE, DELETE.
   - `WITH CHECK (user_id = auth.uid())` for INSERT and UPDATE.

DELETE policy is included for completeness; the application does not currently
delete profile rows, but RLS should remain consistent across operations so a
future feature can't accidentally elevate scope.

### 1.3 `public.user_seed_state` (new)

A single-purpose table that records whether a user has been seeded. Its
existence is the sole signal that the seed step has run for a given user
(FR-014: the marker MUST NOT be inferable from the presence/absence of
applications or profile rows).

```sql
CREATE TABLE public.user_seed_state (
  user_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seeded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_seed_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_seed_state_select_self
  ON public.user_seed_state
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_seed_state_insert_self
  ON public.user_seed_state
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE policies — the marker is immutable from the client side.
```

The seed middleware calls a single RPC, `claim_and_seed_starter()`, which
performs the marker claim and the row inserts in **one PL/pgSQL function
body** — i.e. one Postgres transaction (see §5.5 for the function definition).
The function returns `boolean`:

- `true` — this request just claimed the seed, and the starter rows were
  inserted in the same transaction.
- `false` — another request already claimed it, or the user was seeded
  earlier.

A failure inside the function body rolls back the marker INSERT and the
row INSERTs together. The next request retries cleanly because the marker
was never committed.

The two-call alternative (marker INSERT from the JS client, then a
separate `client.rpc(...)` for the rows) was rejected because two
`@supabase/supabase-js` calls are two separate HTTP requests to PostgREST
and therefore two separate transactions — if the marker INSERT commits and
the RPC then fails, the user is permanently marked-seeded with zero rows.
See [research.md R-6](research.md).

---

## 2. RLS Policy Shape

All three tables use the same policy shape, mirroring 018's documented plan:

| Table              | SELECT                  | INSERT                       | UPDATE                                                                | DELETE                  |
|--------------------|-------------------------|------------------------------|-----------------------------------------------------------------------|-------------------------|
| applications       | `user_id = auth.uid()` | `WITH CHECK user_id = auth.uid()` | `USING user_id = auth.uid()` + `WITH CHECK user_id = auth.uid()` | `user_id = auth.uid()` |
| profile            | `user_id = auth.uid()` | `WITH CHECK user_id = auth.uid()` | `USING user_id = auth.uid()` + `WITH CHECK user_id = auth.uid()` | `user_id = auth.uid()` |
| user_seed_state    | `user_id = auth.uid()` | `WITH CHECK user_id = auth.uid()` | — (no policy → denied)                                              | — (no policy → denied) |

All policies are scoped to the `authenticated` role. The `anon` role has no
policy on any of these tables, so unauthenticated PostgREST calls fail closed.

The `service_role` role bypasses RLS by design. 019 application code does not
use the service role at runtime. Operators using the service role (e.g. for
schema introspection or one-off SQL maintenance) implicitly bypass RLS, which
is the intended Supabase pattern for admin access.

---

## 3. Seed Fixture

The seed is intentionally tiny (per plan §"Why a tiny seed"). Exact content
ships in [contracts/api.md §4](contracts/api.md); the data-model view here is
just the row shape.

**Applications**: two rows, both `archived = 0`, with `user_id = auth.uid()`,
`created_at = updated_at = now()`, `last_status_update` computed relative to
now. Specific status / company / job-title values are part of the contract,
not the schema.

**Profile**: no row. The first `POST /api/profile` (upsert) creates the row.
This is consistent with how the SQLite profile is treated when empty.

**user_seed_state**: one row per seeded user, written atomically with the
applications insert by `claim_and_seed_starter()` (§5.5). `seeded_at = now()`.

---

## 4. SQLite (Local Mode)

**Unchanged.** The local SQLite schema does not gain a `user_id` column,
does not enforce ownership, and does not have a corresponding
`user_seed_state` table. Local mode is single-user by design and the
existing schema satisfies that.

The repository contract surface (method names, return shapes) is the same
across SQLite and Supabase adapters. Internally, the SQLite adapter ignores
the user-scoping concept entirely; the Supabase adapter applies it on every
read and write.

---

## 5. Canonical Migration SQL

This section is the single source of truth for the schema change. The
operator pastes the entire block into the Supabase SQL editor (see
[quickstart.md §2](quickstart.md)). Matches 018's "SQL-in-markdown,
manually applied" workflow — no separate `.sql` file is shipped.

> **Schema lineage note (post-smoke-test correction, 2026-05-17)**: 017's
> data-model.md §"Supabase Schema Plan" documented an intended hosted
> schema (uuid PKs, timestamptz audit columns) but the `CREATE TABLE`
> statements were never executed against any project. 019's first
> iteration of this SQL assumed 017's tables existed and only added
> `user_id`; manual quickstart smoke against a real project (Task 08.2)
> revealed three latent problems that drove the corrections below:
>
> 1. **`applications` / `profile` tables don't exist at all** — the
>    `ALTER TABLE` calls failed with `42P01: relation "public.applications"
>    does not exist`. Fixed by switching to `CREATE TABLE IF NOT EXISTS`
>    with the full column set inline.
> 2. **`applications.id` typed `uuid`** breaks the route handler's
>    `parseIdParam` ([server/routes/applications.js:5](../../server/routes/applications.js#L5))
>    which expects integer ids matching SQLite's `INTEGER PRIMARY KEY
>    AUTOINCREMENT`. Every `/api/applications/:id` call returned 400.
>    Fixed by using `bigint GENERATED ALWAYS AS IDENTITY`.
> 3. **`last_status_update` / `created_at` / `updated_at` typed
>    `timestamptz`** breaks the frontend's `toDisplayDate`
>    ([src/utils/date.js:32](../../src/utils/date.js#L32)) which expects
>    `YYYY-MM-DD` strings (per FR-017's "match pre-019 SQLite shapes").
>    PostgREST serializes `timestamptz` as full ISO 8601 and the format
>    check fails, rendering as `—`. Fixed by typing these columns as
>    `date`.
>
> A fourth issue surfaced server-side: SQLite stores `fav`/`archived` as
> `0`/`1` and JSON fields as stringified text, but Postgres types are
> `boolean` / `jsonb`. Fixed in
> [server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js)
> via the `normalizeForPostgres(row)` helper which coerces booleans and
> parses JSON strings before any PostgREST write/filter.
>
> The SQL block below is the corrected, idempotent shape — applies
> cleanly to a project where the tables don't exist yet (the realistic
> case for any fresh operator). If a project has legacy wrong-typed
> tables from an earlier failed migration attempt, drop them first
> (`DROP TABLE public.applications, public.profile CASCADE;`) then run
> this block.

```sql
-- ============================================================
-- 019 / Supabase Persistence — schema migration (idempotent)
-- ============================================================
-- Creates the hosted applications + profile schema from scratch with
-- 019 ownership columns + RLS + seed marker + seed RPC. Idempotent via
-- CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS, so re-runs are
-- safe for the intended 019 schema. If a project has legacy wrong-typed
-- tables from an earlier failed migration attempt, drop them first as
-- described in the schema-lineage note above.
-- ============================================================

BEGIN;

-- 5.1 applications -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applications (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name        text NOT NULL,
  job_title           text NOT NULL,
  status              text NOT NULL,
  responsibilities    text NOT NULL,
  compat              integer NOT NULL DEFAULT 0,
  fav                 boolean NOT NULL DEFAULT false,
  archived            boolean NOT NULL DEFAULT false,
  source_platform     text,
  application_date    date,
  job_posting_url     text,
  recruiter           text,
  notes               text,
  salary              integer,
  skills              jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_skills    jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_up_action    text,
  follow_up_date      date,
  location            text,
  shift               text,
  work_setup          text,
  compat_notes        text,
  general_notes       text,
  metadata            jsonb,
  last_status_update  date NOT NULL DEFAULT (now()::date),
  created_at          date NOT NULL DEFAULT (now()::date),
  updated_at          date NOT NULL DEFAULT (now()::date)
);

CREATE INDEX IF NOT EXISTS applications_user_id_idx
  ON public.applications (user_id);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS applications_select_own ON public.applications;
CREATE POLICY applications_select_own ON public.applications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS applications_insert_own ON public.applications;
CREATE POLICY applications_insert_own ON public.applications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS applications_update_own ON public.applications;
CREATE POLICY applications_update_own ON public.applications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS applications_delete_own ON public.applications;
CREATE POLICY applications_delete_own ON public.applications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5.2 profile ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_select_own ON public.profile;
CREATE POLICY profile_select_own ON public.profile
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS profile_insert_own ON public.profile;
CREATE POLICY profile_insert_own ON public.profile
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profile_update_own ON public.profile;
CREATE POLICY profile_update_own ON public.profile
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profile_delete_own ON public.profile;
CREATE POLICY profile_delete_own ON public.profile
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5.3 user_seed_state --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_seed_state (
  user_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seeded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_seed_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_seed_state_select_self ON public.user_seed_state;
CREATE POLICY user_seed_state_select_self ON public.user_seed_state
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_seed_state_insert_self ON public.user_seed_state;
CREATE POLICY user_seed_state_insert_self ON public.user_seed_state
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE policies → both denied for authenticated.

-- 5.4 claim_and_seed_starter() RPC ------------------------------------
-- Single atomic function: claim the seed marker AND insert the seed
-- rows in one transaction. Returns true on first claim (rows inserted),
-- false if the marker already existed (no-op).
--
-- SECURITY INVOKER so RLS still applies; the function can only insert
-- rows whose user_id = auth.uid(). A failure mid-body rolls back both
-- the marker INSERT and any row INSERTs (one PL/pgSQL function body =
-- one Postgres transaction).
--
-- Native bool/date values throughout — matches the column types
-- defined in 5.1. `created_at`/`updated_at` fall through to their
-- column DEFAULTs.
CREATE OR REPLACE FUNCTION public.claim_and_seed_starter()
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_claimed integer;
BEGIN
  INSERT INTO public.user_seed_state (user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.applications (
    user_id, company_name, job_title, status,
    application_date, last_status_update,
    responsibilities, archived
  ) VALUES (
    auth.uid(),
    'Sample Company',
    'Frontend Engineer',
    'applied',
    (now() - interval '14 days')::date,
    (now() - interval '14 days')::date,
    'Sample responsibilities — edit or replace to make this your own.',
    false
  );

  INSERT INTO public.applications (
    user_id, company_name, job_title, status,
    application_date, last_status_update,
    responsibilities, archived
  ) VALUES (
    auth.uid(),
    'Example Labs',
    'Full Stack Developer',
    'interview',
    (now() - interval '21 days')::date,
    (now() - interval '5 days')::date,
    'Sample responsibilities — edit or replace to make this your own.',
    false
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_and_seed_starter FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_and_seed_starter TO authenticated;

COMMIT;
-- ============================================================
-- End of 019 migration. Verify via the boot check in the server.
-- ============================================================
```

**Column list note**: the `INSERT INTO public.applications (...) VALUES (...)`
lists above use a subset of the table's columns — the seed only writes the
columns required by the constitution + a minimal demonstration shape (see
[research.md R-3](research.md) and
[contracts/api.md §4.3](contracts/api.md)). All other columns receive their
table defaults (null for nullable columns).

If the project's `applications` schema has columns whose defaults are not
acceptable for seeded rows (e.g. a NOT NULL column with no default), update
the seed function above before applying the migration.

No down migration is shipped. Reverting 019 requires manual operator
action and is not part of the supported workflow — the spec's *Accepted
Limitations* already accept the irreversibility for the 018-only data
window.

---

## 6. Handoff to Feature 020 (demo mode)

This feature reserves the `demo` runtime value and a `DemoRepositoryNotImplementedError`
stub at the dispatcher layer. No demo schema or storage is introduced. Feature
020 will implement an in-memory session-scoped repository under the same
contract — the data model in that feature will define what (if any) ephemeral
shape backs it.

The Supabase tables defined in this document are **not** used by demo mode.
A user signed into a hosted Supabase session has nothing to do with `demo`;
demo mode is its own runtime configuration and operates entirely without
authentication.
