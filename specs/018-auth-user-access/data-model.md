# Data Model: Hosted Authenticated User Access (018)

> **Amendment 2026-05-16**: §JWT Claims below describes the access token as
> HS256-signed; the implementation actually verifies tokens via Supabase's
> JWKS endpoint (ES256/RS256). The claim shape (`sub`, `email`, `exp`, etc.)
> is unchanged — only the signing algorithm and verification mechanism differ.
> See `plan.md` amendment header for the rationale.

This feature introduces:
1. One new Supabase table — `allowed_emails`
2. One new Postgres trigger function (`SECURITY DEFINER`) that consults the
   table and raises on miss — referred to throughout the spec package as the
   **allowlist trigger**
3. One new Postgres BEFORE INSERT trigger on `auth.users` that fires the
   function above

It consumes Supabase's built-in `auth.users` table. It documents — without
implementing — the per-user ownership additions that feature 019 will apply to
`applications` and `profile`.

> **Terminology note.** This feature uses a plain Postgres trigger on
> `auth.users`. It does **not** use Supabase's "Auth Hooks" mechanism
> (a separate feature with a JSONB function signature, dashboard
> configuration, and `supabase_auth_admin` grants). A raw trigger is simpler
> for our scale and fires regardless of any Auth-Hooks dashboard setting.
> If a future feature needs the JSONB hook flow, it can replace the trigger
> at that point.

Local SQLite mode is unaffected. No SQLite schema changes.

---

## 1. `allowed_emails` — created in this feature

Stores the operator-managed list of email addresses permitted to sign up.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `email` | `TEXT` | `PRIMARY KEY`, lowercased on insert, `CHECK (length(email) <= 254)` | RFC 5321 caps the practical email length at 254 chars (local part ≤ 64 + `@` + domain ≤ 253). Operator MUST insert in lowercase; the trigger function lowercases incoming candidates before lookup. |
| `added_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | When the entry was added |
| `added_by` | `TEXT` | nullable | Free-text label for whoever added the entry; for operator audit only |

```sql
create table allowed_emails (
  email      text primary key check (length(email) <= 254),
  added_at   timestamptz not null default now(),
  added_by   text
);
```

### RLS

Row Level Security is **enabled** on this table with **no policies**. Every
client role (anon, authenticated) is denied. The allowlist trigger function
reads the table via `SECURITY DEFINER`, executing with the owner role's
privileges so it can bypass RLS.

```sql
alter table allowed_emails enable row level security;
-- (no policies — deny by default; the allowlist trigger reads via SECURITY DEFINER)
```

### Operator workflow

- Add an entry: insert via Supabase dashboard SQL editor.
- Remove an entry: delete the row. **This does not delete the corresponding
  Supabase auth user**; disabling an existing account is a separate admin action
  performed in Authentication → Users.

### Access pattern

- Read at signup time by the allowlist trigger function only:
  `select 1 from allowed_emails where email = lower(new.email)`.
- No write paths exposed through the API.

---

## 2. `public.handle_new_user_email_allowlist()` — allowlist trigger function

A Postgres trigger function (not a Supabase "Auth Hook") that fires before
each `auth.users` insert. Consults `allowed_emails` and raises an exception
on miss.

```sql
create or replace function public.handle_new_user_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from allowed_emails where email = lower(new.email)
  ) then
    raise exception 'Signup is not available for this email.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- The function owner must have SELECT on allowed_emails. The function is
-- created by whichever role runs the SQL editor, which by default is the
-- postgres superuser in Supabase and already has access.
revoke all on function public.handle_new_user_email_allowlist() from public;
```

### Why `SECURITY DEFINER`

The trigger fires in the context of whatever role is performing the
`auth.users` insert (typically Supabase's internal auth role). `SECURITY
DEFINER` makes the function execute with the **owner's** privileges, allowing
it to read `allowed_emails` even though that table has RLS deny-all. The
function owner must have `select` on `allowed_emails`; in Supabase the
postgres superuser already has this and is the default owner when the
function is created via the SQL editor.

### Why `lower(new.email)`

Supabase normalizes email casing on its end, but defense in depth: explicitly
lowercase the candidate so a mixed-case insert (if Supabase ever changes its
normalization) still matches the lowercased entries in `allowed_emails`.

### Error surface

The raised exception propagates back to the Supabase client as an error. The
SignupForm maps every error from `supabase.auth.signUp` to a single neutral
user-facing message (FR-006) — the SQL message text is operational, not
user-facing.

---

## 3. Trigger on `auth.users`

```sql
drop trigger if exists before_user_created_allowlist on auth.users;
create trigger before_user_created_allowlist
  before insert on auth.users
  for each row execute function public.handle_new_user_email_allowlist();
```

This trigger is the **single enforcement point** for the allowlist. It runs
regardless of which Supabase API initiated the signup:

- `supabase.auth.signUp` from the browser via anon key — trigger fires
- `supabase.auth.admin.createUser` via service role (not used by 018, listed
  for completeness) — trigger fires
- Direct SQL `insert into auth.users …` via service role — trigger fires
- Supabase dashboard "Add user" — trigger fires

No bypass exists short of disabling the trigger inside Supabase.

---

## 4. `auth.users` — consumed, not modeled

Supabase's built-in user table. This feature does not add columns and does not
expose it through the API. Users are created via `supabase.auth.signUp` called
**from the browser** with the anon key; the allowlist trigger fires on insert
and either permits or denies the user.

Relevant fields the server reads:
- `id` (`uuid`) — used as the user identity throughout the API
- `email` — surfaced in navigation and operational logs

---

## 5. JWT payload (consumed from Supabase Auth)

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

## 6. Application + Profile ownership (deferred to 019)

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

## 7. Migration / backfill (handed off to 019)

This feature does not migrate any existing hosted rows. As of 018, applications
and profile rows have no `user_id` column. The accepted-limitations section of
the spec explains that authenticated users share data until 019 ships AND that
018-only hosted data is treated as throwaway.

### Backfill directive for 019

**Wipe `applications` and `profile` before adding the `user_id` column.**
Concretely, 019 should:

```sql
-- Inside 019's migration, executed in this order:
delete from applications;
delete from profile;

alter table applications
  add column user_id uuid not null references auth.users(id) on delete cascade;
create index applications_user_id_idx on applications(user_id);

alter table profile
  add column user_id uuid not null references auth.users(id) on delete cascade;

-- RLS policies (see Section 6)
```

Justification: 018-only hosted data has no `user_id` attribution and is not
multi-user-safe. Assigning all rows to a single user during backfill would
imply ownership that wasn't true. Wiping is the lossless option because the
data was already not trustworthy. Operators have been warned via the spec's
Accepted Limitations section.

If a future operator has irreplaceable production data during a real 018→019
transition, they should perform an out-of-band manual backfill BEFORE deploying
019, then remove or override the wipe statements in 019's migration. This is a
deliberate decision to optimize for the common case (test/development hosted
environments) rather than the edge case.
