# `claim_and_seed_starter()` — canonical RPC source

**Canonical location for the Supabase RPC body that seeds starter
applications onto each new hosted user.**

This document supersedes prior copies in feature specs. The function body
below is the authoritative version; quickstart guides may reproduce it
inline for operator convenience, but they MUST link back here.

| Version | Introduced by | Notes |
|---|---|---|
| v1 | [019-supabase-persistence](../../specs/019-supabase-persistence/spec.md) | Initial body — two starter rows, no Timeline. |
| v2 (current) | [025-application-timeline](../../specs/025-application-timeline/spec.md) | Each starter row now carries a populated `timeline jsonb` array. |

When a newer feature updates the RPC body, that feature MUST:

1. Update this file with the new body and add a row to the version table.
2. Link to this file from its `quickstart.md`.
3. Not edit prior feature specs.

This is the rule introduced by feature 025 to stop retroactive edits to
older spec packages.

---

## When operators run this

Apply the SQL block in §1 below in the Supabase SQL editor:

- On a fresh Supabase project, **after** the rest of the
  [019 schema migration](../../specs/019-supabase-persistence/data-model.md)
  (this RPC references the `applications` and `user_seed_state` tables
  defined there) **and** the
  [025 additive column migration](../../specs/025-application-timeline/quickstart.md)
  (this RPC's body writes the `timeline` jsonb column added by 025).
- On an existing hosted project that has already applied 019 but not
  025: run the 025 column migration first
  ([025/quickstart.md §3.1](../../specs/025-application-timeline/quickstart.md)),
  then re-run the block below to replace the function body.

The function is idempotent at the user level — its first statement is a
marker INSERT on `user_seed_state` with `ON CONFLICT DO NOTHING`, so
re-applying the RPC body does not re-seed already-seeded users.

---

## 1. SQL body (v2)

```sql
-- claim_and_seed_starter() RPC ----------------------------------------
-- Single atomic function: claim the seed marker AND insert the seed
-- rows in one transaction. Returns true on first claim (rows inserted),
-- false if the marker already existed (no-op).
--
-- SECURITY INVOKER so RLS still applies; the function can only insert
-- rows whose user_id = auth.uid(). A failure mid-body rolls back both
-- the marker INSERT and any row INSERTs (one PL/pgSQL function body =
-- one Postgres transaction).
--
-- Each starter row now carries a populated `timeline jsonb` array
-- (added by 025) so new users land on a non-empty Timeline that
-- teaches the workflow: auto-status progression, manual note, and a
-- scheduled future follow-up.

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

  -- Starter app 1: showcases auto-status progression + manual note +
  -- a future-dated follow-up.
  INSERT INTO public.applications (
    user_id, company_name, job_title, status,
    application_date, last_status_update,
    responsibilities, archived,
    timeline
  ) VALUES (
    auth.uid(),
    'Welcome Inc.',
    'Frontend Engineer (starter)',
    'phone_screen',
    (now() - interval '12 days')::date,
    (now() - interval '3 days')::date,
    'Demo starter row — edit me to learn the tracker.',
    false,
    jsonb_build_array(
      jsonb_build_object(
        'id',     1,
        'date',   (now() - interval '12 days')::date::text,
        'status', 'applied',
        'text',   'Submitted via referral from Marie.'
      ),
      jsonb_build_object(
        'id',     2,
        'date',   (now() - interval '7 days')::date::text,
        'status', 'phone_screen',
        'text',   'Recruiter screen scheduled.'
      ),
      jsonb_build_object(
        'id',     3,
        'date',   (now() + interval '4 days')::date::text,
        'status', 'phone_screen',
        'text',   'Follow-up call with Jane.'
      )
    )
  );

  -- Starter app 2: showcases the accepted-state Timeline shape.
  INSERT INTO public.applications (
    user_id, company_name, job_title, status,
    application_date, last_status_update,
    responsibilities, archived,
    timeline
  ) VALUES (
    auth.uid(),
    'Beacon Studio',
    'Product Designer (starter)',
    'accepted',
    (now() - interval '40 days')::date,
    (now() - interval '6 days')::date,
    'Demo starter row — explore the accepted state.',
    false,
    jsonb_build_array(
      jsonb_build_object(
        'id',     1,
        'date',   (now() - interval '40 days')::date::text,
        'status', 'applied',
        'text',   'Cold application via portfolio site.'
      ),
      jsonb_build_object(
        'id',     2,
        'date',   (now() - interval '28 days')::date::text,
        'status', 'interview',
        'text',   'Portfolio review — strong signal.'
      ),
      jsonb_build_object(
        'id',     3,
        'date',   (now() - interval '15 days')::date::text,
        'status', 'offer',
        'text',   'Verbal offer — base + signing.'
      ),
      jsonb_build_object(
        'id',     4,
        'date',   (now() - interval '6 days')::date::text,
        'status', 'accepted',
        'text',   'Accepted — start date 30 days out.'
      )
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_and_seed_starter FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_and_seed_starter TO authenticated;
```

---

## 2. Coverage promise (spec FR-034)

The two starter rows together demonstrate every Timeline pattern a new
user needs to discover the feature:

| Pattern | Starter app 1 (Welcome Inc.) | Starter app 2 (Beacon Studio) |
|---|---|---|
| Auto-status progression entry | ✅ (id 2 — `phone_screen`) | ✅ (id 2 — `interview`) |
| Manual note attached | ✅ (id 1 — referral note) | ✅ (id 3 — verbal offer note) |
| Scheduled future follow-up | ✅ (id 3 — +4 days) | — |
| `accepted` status entry | — | ✅ (id 4) |

Any future revision of this RPC MUST preserve this coverage matrix
unless feature 025's FR-034 is explicitly amended.

---

## 3. Verification

After applying:

```sql
-- 1. Function exists with the expected return type.
SELECT proname, pg_get_function_result(oid) AS returns
FROM   pg_proc
WHERE  proname = 'claim_and_seed_starter';
-- expect: claim_and_seed_starter | boolean

-- 2. Function body length is sane (catches half-pasted bodies).
SELECT length(pg_get_functiondef(oid)) AS bytes
FROM   pg_proc
WHERE  proname = 'claim_and_seed_starter';
-- expect: > 1500 bytes (the v2 body is ~3 KiB)
```

Then sign up a fresh hosted user via the running app and confirm both
starter rows appear in the tracker with populated Timelines.

---

## 4. Rollback

To revert to v1 (no Timeline content in starter rows), paste the v1
body from
[specs/019-supabase-persistence/data-model.md §5.4](../../specs/019-supabase-persistence/data-model.md)
into the SQL editor. Existing seeded users are unaffected — the
marker prevents re-seeding either way.
