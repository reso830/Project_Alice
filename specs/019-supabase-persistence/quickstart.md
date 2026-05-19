# Quickstart: Supabase Persistence (019)

**Branch**: `019-supabase-persistence` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Operator-facing setup steps for deploying 019. Assumes 017 (hosted runtime
contract) and 018 (auth + allowlist) are already applied to the target
Supabase project. Local-mode developers can skip this entire document —
019 changes nothing for local SQLite.

> ⚠ **Destructive step ahead.** Section 2 wipes all pre-019 hosted
> `applications` and `profile` rows. This is by design (see 018's
> *Accepted Limitations* and 019 spec FR-009). If you have hosted data
> you need to preserve, export it before running the migration.

---

## 1. Prerequisites

- Supabase project with 018 already applied: `allowed_emails` table
  exists, the allowlist trigger on `auth.users` is installed, at least
  one allowlisted user can sign in.
- Server env vars (017 + 018 contract, unchanged): `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. **No
  `SUPABASE_JWT_SECRET`** — 018 settled on JWKS-based verification via
  `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` using `jose`. The JWKS
  URI is derived from `SUPABASE_URL`; no separate JWT-secret env var is
  required.
- Frontend env vars (017 + 018 contract, unchanged): `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`.
- The canonical migration SQL in
  [data-model.md §5](data-model.md) is available alongside
  this document.

No new env vars are introduced by 019.

---

## 2. Apply the migration

1. Open the Supabase dashboard → **SQL Editor**.
2. Paste the entire contents of
   [data-model.md §5](data-model.md).
3. Review the leading SQL comment block carefully. The migration is
   idempotent (`CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS`) for
   the intended 019 hosted schema. If you have legacy 017-shaped hosted
   tables from an earlier manual attempt, drop them first per the schema
   lineage note in [data-model.md §5](data-model.md).
4. Run.
5. Verify the result by inspecting (in the **Table Editor**):
   - `applications` has a `user_id` column (uuid, NOT NULL, FK to
     `auth.users.id`).
   - `profile` has a `user_id` column (uuid, NOT NULL, FK to
     `auth.users.id`) and a `UNIQUE (user_id)` constraint.
   - `user_seed_state` table exists with `(user_id, seeded_at)` columns.
   - All three tables have **RLS enabled** (toggle visible in the table
     header).
6. Verify policies via dashboard → **Authentication → Policies**:
   - `applications`: 4 policies (SELECT / INSERT / UPDATE / DELETE), each
     scoped `user_id = auth.uid()`.
   - `profile`: same shape.
   - `user_seed_state`: 2 policies (SELECT, INSERT) — no UPDATE or DELETE.

The migration also creates the `public.claim_and_seed_starter()` RPC
(returns `boolean`) used by the seed middleware. Verify via dashboard →
**Database → Functions**. The function body atomically claims the
`user_seed_state` marker and (on first claim) inserts the starter
applications inside one Postgres transaction.

---

## 3. Deploy the server

1. Pull the 019 branch and run `npm install` (no new dependencies — the
   server consumes `@supabase/supabase-js` already added by 018 for the
   frontend; if your tooling separates frontend/server deps, ensure the
   package is reachable to the server too).
2. Deploy to your hosted environment with `APP_RUNTIME=hosted` and the
   017 hosted env vars.
3. On boot, the server runs the **boot-time schema check** (plan §"Data
   Flow → Boot-time schema check"). If the migration has not been
   applied, the server logs the missing artifact and exits non-zero — do
   not retry the deploy until the migration is in place.
4. Successful boot: `GET /api/health` returns `{ runtime: "hosted" }` (or
   the 018-defined shape, augmented with `runtime` if 019 takes that on).

---

## 4. First-user smoke (mandatory P0 verification)

1. Sign in as an existing allowlisted user (created in 018).
2. Open the network panel. Trigger any authenticated route — e.g. load
   the tracker page so it issues `GET /api/applications`.
3. Expect the response to contain **exactly 2 seed rows** with
   `status: applied` and `status: interview`. Dates should be within the
   last 21 days relative to now.
4. Refresh the page. Expect the same 2 rows — no duplicates, no
   re-seeding.
5. Delete both rows via the tracker UI (or via the API). Refresh. Expect
   **0 rows** — confirms FR-014 (deletion does not re-seed).
6. Open the profile page. Expect an empty profile (FR-012 ships the
   "tiny" seed: 2 apps + empty profile).
7. Edit and save the profile. Refresh. Expect the saved values to
   persist.

---

## 5. Multi-user smoke (mandatory P0 verification)

1. Add a second email to `allowed_emails`.
2. Sign up + verify + sign in as the second user (a different browser
   profile or incognito window helps).
3. Expect 2 fresh seed rows under the second user's `user_id`, not the
   first user's. The application list shows only the second user's rows.
4. Edit the second user's profile. Expect a separate profile row (not
   shared with user 1).
5. Switch back to user 1. Confirm user 1's tracker and profile look
   unchanged.

---

## 6. RLS verification (mandatory P0 verification)

This step verifies that even a malicious caller bypassing the server
filter cannot read or write another user's data. It is the only
end-to-end check that proves RLS is actually in place.

1. Sign in as user A. From dev tools console, capture A's JWT:

   ```js
   const { data } = await supabase.auth.getSession();
   const aJwt = data.session.access_token;
   ```

2. Sign in as user B (different browser / incognito). Note the id of one
   of B's rows — e.g. via the network panel after a `GET /api/applications`,
   pick `rows[0].id`. Call this `bRowId`.
3. Back in user A's browser dev tools, attempt a direct PostgREST read
   targeting B's row:

   ```js
   const res = await fetch(
     `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/applications?select=*&id=eq.${bRowId}`,
     {
       headers: {
         apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
         Authorization: `Bearer ${aJwt}`,
       },
     },
   );
   const body = await res.json();
   console.log(body);
   ```

   Expected: `[]` (empty array). RLS refuses the read because
   `user_id != auth.uid()`.

4. Attempt the same against `/api/applications/<bRowId>` (our Express
   route) using A's session. Expected: 404 — the server-side filter
   plus RLS combine to refuse the access without revealing whether the
   row exists.

5. Attempt to write to B's row from A's session:

   ```js
   await fetch(
     `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/applications?id=eq.${bRowId}`,
     {
       method: 'PATCH',
       headers: {
         apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
         Authorization: `Bearer ${aJwt}`,
         'Content-Type': 'application/json',
         Prefer: 'return=representation',
       },
       body: JSON.stringify({ notes: 'sneaky update from user A' }),
     },
   );
   ```

   Expected: empty array or no-rows-affected. RLS refuses the update.
   Verify B's row in B's session shows no change.

If any of steps 3–5 reveal data or accept a write, **stop the deploy**
and re-verify the RLS policies. Do not proceed until step 6's result
matches expectation.

---

## 7. Failure mode check (recommended but optional)

Exercises the boot-time schema check from §3 step 3.

1. In a non-production Supabase project, drop the `user_id` column from
   `applications`:

   ```sql
   ALTER TABLE applications DROP COLUMN user_id;
   ```

2. Restart the server with `APP_RUNTIME=hosted`.
3. Expected: the server logs a descriptive error naming
   `applications.user_id` and exits non-zero.
4. Re-apply the migration. Restart the server. Boot succeeds.

This proves operator forgetfulness is detected at deploy time, not at
the first user request.

---

## 8. Local-mode regression check

1. Run `APP_RUNTIME=local npm run server:dev` (or your local
   equivalent).
2. Expected: server boots without contacting Supabase. The boot-time
   schema check is skipped.
3. Open the tracker UI. Existing local SQLite data is intact and
   accessible.
4. Create, edit, archive applications; edit the profile. Expected:
   behavior identical to pre-019.
5. Run the existing test suites:

   ```bash
   npm run test
   ```

   Expected: all existing tests pass without modification (FR-003).

---

## 9. Runtime-mode dispatch sanity

1. Briefly start the server with `APP_RUNTIME=demo` (no Supabase env
   vars required for the dispatcher itself, but 017's config loader
   may still gate runtime acceptance — confirm `demo` is now in
   `VALID_RUNTIMES`).
2. Hit any protected route.
3. Expected: response is an error referencing
   `DemoRepositoryNotImplementedError` and pointing to feature 020.
4. Stop the demo-mode server.

This is a smoke-only check that the routing slot is reserved. Real
demo behavior arrives with feature 020.

---

## 10. Sign-off checklist

Operators should confirm each of the following before considering 019
deployed. If a non-P0 smoke check is intentionally skipped, record the
rationale and residual risk in the accepted-skips section below.

- [x] Migration applied to the configured Supabase project (§2).
- [x] Three sentinel probes return 200 at server boot (visible in boot
      logs).
- [x] Single-user smoke completes (§4, all 7 steps).
- [x] Multi-user smoke completes (§5, all 5 steps).
- [x] RLS direct-bypass test refuses cross-user reads and writes (§6,
      all 5 steps).
- [x] Local-mode regression check passes (§8, all 5 steps).
- [x] Demo-mode dispatch sanity check observes
      `DemoRepositoryNotImplementedError` (§9). Completed during Phase 10
      browser smoke (Task 10.5): `APP_RUNTIME=demo` booted cleanly and a
      protected route returned `DemoRepositoryNotImplementedError` pointing
      at feature 020.

Accepted skips for Phase 08:

- §7 boot-failure destructive check skipped intentionally. The operator did
  not drop `applications.user_id` because the available Supabase project is
  the configured live environment and the check is destructive. Residual
  risk is limited by Phase 06's automated `assertHostedSchema()` coverage and
  the successful hosted boot/schema probes already observed. Run this later
  only against a disposable staging project.
- §9 demo-mode dispatch smoke was skipped only for Phase 08, then completed
  during Phase 10 (Task 10.5). Demo mode remains a reserved feature-020
  routing slot; the Phase 10 smoke and automated dispatcher/stub tests both
  observed `DemoRepositoryNotImplementedError`.

Until §6 passes, the hosted environment **must not be made public**. The §7
accepted skip above does not block Phase 08, but remains a useful pre-release
smoke check when a safe disposable staging project is available.

---

## 11. Operator notes

### 11.1 Deleting a Supabase Auth user is destructive

Every `user_id` foreign key created by 019 (`applications.user_id`,
`profile.user_id`, `user_seed_state.user_id`) uses
`ON DELETE CASCADE` against `auth.users(id)`. Deleting a user from the
Supabase dashboard → **Authentication → Users** therefore permanently
removes that user's applications, profile, and seed marker with no audit
trail.

**To revoke a user's access without destroying their data**: instead of
deleting the auth row, (a) remove their email from the `allowed_emails`
table — this prevents fresh signup but does not affect existing
verified accounts — and (b) sign them out / disable the user via the
Supabase dashboard. Their data is preserved; only future signup is
blocked. If you later need to restore access, re-add the email to
`allowed_emails` and re-enable the user.

**To permanently delete a user *and* their data** (e.g. GDPR /
right-to-erasure request): deletion via the Supabase dashboard's
Authentication panel is the correct path — the CASCADE handles the rest.

### 11.2 Server-side `@supabase/supabase-js` usage

The Express server uses `@supabase/supabase-js` to construct per-request
RLS-scoped clients in hosted mode. The same package version that ships
in the Vite frontend bundle (added by 018) is reused at the Node
runtime — there is no separate server install. Verify with
`npm ls @supabase/supabase-js`.
