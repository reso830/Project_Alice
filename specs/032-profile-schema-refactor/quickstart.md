# Quickstart: Profile Schema Refactor (032)

How to bring up and verify the `profile_skill` store in each mode.

## 1. Local (SQLite) — automatic

No operator step. `initSchema()` creates `profile_skill` at boot, and existing
profiles migrate on first read.

```powershell
npm run dev            # or the project's local-mode start
```

Verify:
1. Open the Profile page — skills render exactly as before (same names, levels, order).
2. Edit a skill (rename / re-rate), add one, remove one, and save.
3. Reload — changes persisted; order preserved.
4. (Optional) Inspect the DB: `SELECT * FROM profile_skill ORDER BY id;` shows
   one row per skill; `SELECT data FROM profile;` has **no** `skills` key.

## 2. Hosted (Supabase) — apply the schema once

Apply the migration SQL block from
[data-model.md §3](data-model.md) via **Supabase dashboard → SQL Editor**, then
restart the server. This creates the `profile_skill` table + RLS + the
`save_profile_with_skills` RPC. It is idempotent — safe to re-run.

The boot-time check (`assertHostedSchema`) probes `profile_skill`; if the
migration was not applied the server logs:

```
[hosted-schema] missing artifact: public.profile_skill. ... Apply the SQL block from specs/032-profile-schema-refactor/data-model.md §3
```

The **data** move (embedded skills → rows) is automatic on first read — no
per-user action.

Verify:
1. Sign in to a hosted account that already has a profile with skills.
2. Load the Profile page — skills render unchanged (this read performs the
   one-time migration behind the scenes).
3. Edit/add/remove a skill and save; reload to confirm persistence and order.
4. (Optional, SQL editor) `SELECT skill_name, proficiency FROM profile_skill
   WHERE user_id = auth.uid() ORDER BY id;` and confirm `profile.data` has no
   `skills` key.

## 3. Demo mode — no change

Enter the portfolio demo; the Alex Rivera persona's skills render as before.
Demo data is ephemeral and keeps skills in memory — nothing to migrate.

## 4. Tests

```powershell
npm test
```

Covers: model split/join, SQLite + Supabase adapters (round-trip, ordering,
empty, lazy migration, idempotency), route integration, the new health probe,
and demo parity.
