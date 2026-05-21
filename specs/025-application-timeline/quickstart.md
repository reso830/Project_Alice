# Quickstart: Application Timeline (025)

**Branch**: `025-application-timeline`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Contracts**: [contracts/api.md](contracts/api.md)

Operator + developer steps to bring the Timeline online in local,
demo, and hosted runtimes. Mirrors the format of
[../019-supabase-persistence/quickstart.md](../019-supabase-persistence/quickstart.md).

---

## 1. Local (SQLite) developer

### One-time

```powershell
npm install                       # no new deps; safe to skip if up to date
npm run db:init                   # ensureColumn() adds `timeline` to applications
npm run db:seed                   # reseeds with rich Timeline fixtures
```

> `db:init` is idempotent. The `ensureColumn` helper in
> [server/db.js](../../server/db.js) skips the ALTER TABLE when the
> column already exists.

### Verify

```powershell
npm run dev
```

1. Open the tracker, click any seeded application.
2. The overlay's body now has a **Timeline** row in place of the old
   *Last Updated* row.
3. Click to expand → add-entry row + entry history are visible.
4. Add an entry with a past date → it appears in the correct sort
   position.
5. Add an entry with a future date → it appears at the top.
6. Click the header `⇄` Change-Status control, pick a new status →
   the new status appears in the header AND a fresh empty-text
   Timeline entry appears at the top of the expanded list.
7. Click Save, close the overlay, reopen — everything persists,
   Timeline opens collapsed again.

---

## 2. Demo (browser-only)

No setup. After `npm run dev`, visit the welcome page and click the
demo CTA. The demo seed
([src/data/demoSeed.js](../../src/data/demoSeed.js)) now ships with
varied Timelines per record:

- At least one minimal Timeline (1 entry).
- At least one dense Timeline (5+ entries).
- At least one Timeline with a future-dated entry.
- At least one Timeline on an `accepted` application.
- At least one Timeline on a `rejected` application.
- At least one empty Timeline (so the empty-state prompt is exercised).

All edits in demo are in-memory and reset on browser refresh — same as
every other demo mutation today.

---

## 3. Hosted (Supabase)

### 3.1 Apply the additive migration

In the Supabase SQL editor, paste and run:

```sql
-- 025: add timeline column to applications
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS timeline jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Sanity check
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'applications' AND column_name = 'timeline';
-- expect: timeline | jsonb | NO | '[]'::jsonb
```

> Idempotent — re-running is safe.

### 3.2 Update the starter-seed RPC

The `claim_and_seed_starter()` RPC body is now owned by a single
canonical doc:
[docs/db/claim_and_seed_starter.md](../../docs/db/claim_and_seed_starter.md).
Feature 025 introduces **v2** of that body — the two starter rows now
include a populated `timeline jsonb` array each.

For operator convenience, the v2 body is reproduced below. If it ever
disagrees with the canonical doc, the canonical doc wins — paste from
there:

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

> SECURITY INVOKER — rows are scoped to `auth.uid()` by RLS.
> Existing users (already seeded) are unaffected because the marker
> in `user_seed_state` short-circuits the function.

### 3.3 Verify on a fresh hosted user

1. Deploy the branch to Vercel preview (or run locally with
   `ALICE_RUNTIME=hosted` and the hosted env vars).
2. Sign up a brand-new user via the welcome page.
3. After landing on the tracker, open either starter card.
4. Confirm the Timeline shows the seeded entries (welcome card has a
   future-dated entry; Beacon Studio card has the `accepted` path).

### 3.4 Boot-time smoke check

The server's hosted-mode boot probe was extended with a `select=
timeline&limit=0` column probe. A missing column fails fast at boot
with a descriptive error pointing back here. If you see:

```
[hosted] Schema check failed: applications.timeline missing.
   Run the migration in specs/025-application-timeline/quickstart.md.
```

…apply §3.1 above.

---

## 4. Roll back

### Local

```sql
-- Inside sqlite3 against data/alice.db
ALTER TABLE applications DROP COLUMN timeline;
```

(better-sqlite3 ≥ 3.35 supports DROP COLUMN; project version is
already higher.)

### Hosted

```sql
ALTER TABLE applications DROP COLUMN IF EXISTS timeline;

-- Restore the prior claim_and_seed_starter() body from
-- specs/019-supabase-persistence/data-model.md §5
```

Rollback restores the pre-025 schema and seed. The frontend reverts
when the branch is reverted; no orphan UI state remains because the
collapsed Timeline row is gone.

---

## 5. Manual smoke test (browser, before declaring done)

Per constitution Amendment 1.3.0, the final phase walks each
spec.md User Story Independent Test in a real browser. The script
lives in [tasks.md](tasks.md) under *Phase: Browser Smoke Test*. The
walk targets the to-be-merged state — run it on the merge SHA or on
a freshly-rebased branch.

Pass criteria (must all hold):

- US1 Collapsed Timeline preview shows the latest entry for every
  application, and the empty-state prompt for empty timelines.
- US2 An entry added inline appears immediately and persists across
  reload.
- US3 A status change appends an auto-entry; deleting the auto-entry
  does NOT roll back the status.
- US4 An entry's text / status / date are editable inline; date
  changes re-sort the list.
- US5 A future-dated entry is accepted and floats to the top.
- US6 Delete is single-click; Discard restores; Save persists.
- US7 Local seed / demo / hosted starter all render rich Timelines.
- `accepted` audit: badge, pill, dropdown, filter, modal header,
  border accent, Timeline node all render `accepted` correctly.
- Keyboard-only operation works end-to-end.
- Mobile bottom-sheet (<640px) reflows correctly.
- Modal footer stays pinned with a maximally-expanded Timeline.
