# Data Model: Hosted Authenticated User Access (018)

This feature introduces one new Supabase table (`allowed_emails`) and consumes
Supabase's built-in `auth.users` table. It documents — without implementing —
the per-user ownership additions that feature 019 will apply to `applications`
and `profile`.

Local SQLite mode is unaffected. No SQLite schema changes.

---

## 1. `allowed_emails` — created in this feature

Stores the operator-managed list of email addresses permitted to sign up.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `email` | `TEXT` | `PRIMARY KEY`, lowercased on insert | Operator MUST insert in lowercase; the server lowercases incoming signup submissions before lookup |
| `added_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | When the entry was added |
| `added_by` | `TEXT` | nullable | Free-text label for whoever added the entry; for operator audit only |

### RLS

Row Level Security is **enabled** on this table with **no policies granting access
to the anon role**. Effectively: the anon key cannot read or list this table. Server
reads use the service role key, which bypasses RLS.

```sql
alter table allowed_emails enable row level security;
-- (no policies for anon — deny by default)
```

### Operator workflow

- Add an entry: insert via Supabase dashboard SQL editor.
- Remove an entry: delete the row. **This does not delete the corresponding
  Supabase auth user**; disabling an existing account is a separate admin action.

### Access pattern

- Single read at signup time: `select 1 from allowed_emails where email = $1`.
- No write paths exposed through the API.

---

## 2. `auth.users` — consumed, not modeled

Supabase's built-in user table. This feature does not add columns and does not
expose it through the API. Users are created via `supabase.auth.admin.createUser`
called from the server with the service role key.

Relevant fields the server reads:
- `id` (`uuid`) — used as the user identity throughout the API
- `email` — surfaced in navigation and operational logs

---

## 3. JWT payload (consumed from Supabase Auth)

The Supabase Auth-issued access token (HS256, signed with the project's
`SUPABASE_JWT_SECRET`) carries the claims the middleware reads:

| Claim | Source | Used as |
|---|---|---|
| `sub` | Supabase user id (`uuid`) | `req.user.id` |
| `email` | Supabase user email | `req.user.email` |
| `aud`, `iss`, `exp` | standard | verified by `jsonwebtoken` |

The middleware does **not** decode or trust `app_metadata` or `user_metadata` in
this feature. 019 may add role/tier claims; that's a future concern.

---

## 4. Application + Profile ownership (deferred to 019)

This section is **documentation for 019**. None of this is created or applied in
018.

### `applications.user_id` (added by 019)

```sql
alter table applications
  add column user_id uuid not null references auth.users(id) on delete cascade;
create index applications_user_id_idx on applications(user_id);
```

- **Type**: `uuid`
- **Nullability**: `NOT NULL` after 019's backfill step
- **Foreign key**: references `auth.users(id)` with `ON DELETE CASCADE`
- **Default**: none — populated by the API layer from `req.user.id` (the JWT
  middleware in 018 already attaches this)
- **Index**: `(user_id)` — every read path filters by user

### `profile.user_id` (added by 019)

Same shape as above; profile becomes per-user.

### RLS policies (applied by 019)

```sql
alter table applications enable row level security;
create policy applications_owner on applications
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table profile enable row level security;
create policy profile_owner on profile
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- API authorization remains the **primary** enforcement layer (per the constitution
  and per the spec).
- RLS is defense-in-depth — it prevents data exposure even if a future bug routes
  a query without a `user_id` filter.

### Repository contract impact (handled by 019)

`getAll`, `getById`, `create`, `update`, `archive` on applications and
`get`, `upsert` on profile will scope by the user id resolved by 018's middleware
(`req.user.id`). 018 prepares the middleware contract; 019 plumbs the user id
into the repository calls.

---

## 5. Migration / backfill (not in this feature)

This feature does not migrate any existing hosted rows. As of 018, applications
and profile rows have no `user_id` column. The accepted-limitations section of
the spec explains that authenticated users share data until 019 ships.

019 must define the backfill strategy (likely: assign existing rows to the first
allowlisted user, or wipe them if pre-019 hosted data was never user-attributable).
