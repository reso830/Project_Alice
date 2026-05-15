# Quickstart: Hosted Auth (018)

How to bring up hosted mode with authentication locally, for development or
manual validation. Local SQLite mode is unaffected; skip everything here if
you're only doing local-mode work.

This builds on the hosted setup documented in 017. If 017's Supabase project is
already provisioned, jump to step 3.

---

## 1. Supabase project (one-time)

If you haven't already:
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. From **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL` (server) and `VITE_SUPABASE_URL` (client)
   - `anon` public key → `SUPABASE_ANON_KEY` (server) and
     `VITE_SUPABASE_ANON_KEY` (client)
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` *(server-only, never on
     the client)*
3. From **Project Settings → API → JWT Settings**, copy:
   - `JWT Secret` → `SUPABASE_JWT_SECRET` *(server-only)*

---

## 2. Create the `allowed_emails` table

In the Supabase dashboard, open **SQL Editor** and run:

```sql
create table allowed_emails (
  email      text primary key check (length(email) <= 254),
  added_at   timestamptz not null default now(),
  added_by   text
);

alter table allowed_emails enable row level security;
-- intentionally no policies — denies the anon role by default;
-- the trigger function reads via SECURITY DEFINER
```

Add your own email so you can sign up:

```sql
insert into allowed_emails (email, added_by) values
  ('lowercase-your-email@example.com', 'self');
```

> **Insert emails lowercased.** The trigger function lowercases the candidate
> before lookup, but operator-managed entries should be lowercase by
> convention.

---

## 3. Install the Postgres allowlist trigger

> This is a plain Postgres trigger, **not** a Supabase "Auth Hook." Supabase
> Auth Hooks are a separate feature (JSONB function signature, dashboard
> configuration, `supabase_auth_admin` grants). We don't use them here —
> a regular `BEFORE INSERT` trigger is simpler, doesn't depend on a dashboard
> toggle, and fires regardless of any Auth-Hooks setting.

Still in the SQL Editor, run:

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

-- Don't let arbitrary roles call this function directly.
revoke all on function public.handle_new_user_email_allowlist() from public;

drop trigger if exists before_user_created_allowlist on auth.users;
create trigger before_user_created_allowlist
  before insert on auth.users
  for each row execute function public.handle_new_user_email_allowlist();
```

The function uses `SECURITY DEFINER` so it executes with the **function
owner's** privileges (in Supabase, the SQL editor session typically runs as
`postgres`, which already has `select` on `allowed_emails`). This is what
lets the function read `allowed_emails` even though the table has RLS
deny-all.

This trigger is the single enforcement point for the allowlist. It runs on
every `auth.users` insert regardless of which Supabase API initiated the
signup — so a browser bypass via direct `supabase.auth.signUp` is blocked at
the same point as a legitimate signup.

> ⚠️ **If you skip this step, signups fail OPEN.** Supabase has no other
> allowlist mechanism in this architecture. The trigger MUST be installed
> AND verified (see §10) before any production deploy.

### Verify

In the same SQL Editor, attempt to insert a non-allowlisted user manually:

```sql
insert into auth.users (id, email, encrypted_password)
values (gen_random_uuid(), 'unallowed@example.com', 'x');
-- should fail with: Signup is not available for this email.
```

(Roll back any test inserts.)

---

## 4. Configure Supabase Auth

In the dashboard:
1. **Authentication → Providers → Email**: enable email/password.
2. **Authentication → URL Configuration**:
   - Set **Site URL** to your hosted frontend origin (e.g.
     `http://localhost:5173` for local dev, or your Vercel preview/production
     URL).
   - Add `http://localhost:5173/?auth=callback` and the production equivalent
     to **Redirect URLs**.
3. **Authentication → Email Templates**: leave defaults. (This feature does
   not customize templates.)

---

## 5. Local `.env` for hosted-mode dev

Add to your local `.env` (or `.env.local`):

```bash
# Server (from 017)
APP_RUNTIME=hosted
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Server (new in 018)
SUPABASE_JWT_SECRET=<jwt-secret-from-dashboard>

# Vite-exposed (client-safe — read at build time, inlined into the bundle)
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_AUTH_EMAIL_REDIRECT_URL=http://localhost:5173/?auth=callback
```

> **Do not** prefix `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` with
> `VITE_`. The build-time assertion will not catch this — the existing
> bundle-scan check (carried over from 017) will, but treat it as a discipline
> issue.

---

## 6. Run

```bash
npm run server:dev   # Express API in hosted mode
npm run dev          # Vite frontend
```

Expected boot logs:
- Server: `[config] Runtime mode: hosted`
- Frontend: Vite ready at `http://localhost:5173`

---

## 7. Manual validation flow

1. Open the frontend at `http://localhost:5173`. You should see the welcome
   page (diagonal split, three CTAs). The tracker, profile, and calendar
   should not be reachable.
2. Click **Create Account**. The auth overlay opens with a signup form.
   Submit the email you added to `allowed_emails` and a password ≥ 8
   characters. The overlay transitions to a "check your email" state.
3. Open the verification email; click the link. You should land back on the
   welcome page; Supabase auto-confirms the account; the auth state flips to
   authenticated; the app shell mounts.
4. Navbar shows your email and a Sign Out control. Open browser dev tools →
   Network. Refresh. Confirm a protected request like `GET /api/applications`
   carries an `Authorization: Bearer …` header and returns 200.
5. Click Sign Out. The welcome page should reappear and the next
   `GET /api/applications` (e.g. via dev tools) should return 401.

### Negative paths

- **Non-allowlisted signup**: try signing up with an email that's not in
  `allowed_emails`. The overlay shows a neutral "this email cannot sign up
  right now" error. The dashboard shows no new row in `auth.users`.
- **Bypass attempt**: from browser dev tools console, run
  `await window.supabase?.auth?.signUp({ email: 'unallowed@x.com', password: 'longenough' })`
  (or import the client directly). Supabase returns an error and no row is
  created. The trigger is doing its job.
- **Tampered token**: with dev tools open, intercept a protected request and
  alter a character of the `Authorization` JWT. Expect 401 with no diagnostic
  detail in the response body.
- **Expired verification link**: ignore the verification email until past the
  link's TTL (default 24h; lower it in **Authentication → Email Templates →
  Email OTP Expiration** to test quickly). Resubmit the signup form with the
  same email; Supabase sends a fresh verification email without creating a
  duplicate.

---

## 8. Switching back to local mode

Unset (or comment out) `APP_RUNTIME` and the hosted Supabase env vars.
Restart the server:

```bash
npm run server:dev
```

Expected boot log: `[config] Runtime mode: local`. No auth, no welcome page,
SQLite as today.

The Vite frontend in dev mode does **not** require the `VITE_SUPABASE_*` env
vars; absent values are treated as local mode. The build-time assertion only
fires on `npm run build`.

---

## 9. Rotation

- **JWT secret rotated in Supabase dashboard**: update `SUPABASE_JWT_SECRET`
  in your `.env` and restart the server. Existing sessions fail verification;
  users must sign in again.
- **Service role key rotated**: update `SUPABASE_SERVICE_ROLE_KEY` and
  restart. No user impact (018 doesn't use this key in code, but 019 will).
- **Allowlist entry removed**: the corresponding Supabase user is **not**
  deleted automatically. Disable the user from **Authentication → Users** in
  the dashboard if you want them locked out.
- **Trigger function altered or dropped**: rerun the SQL in §3 to restore.
  If the trigger is missing, allowlist enforcement is gone — every email can
  sign up.

---

## 10. Pre-deploy verification gate (REQUIRED before any production deploy)

The application server has no Supabase client and cannot verify that the
`allowed_emails` table or the allowlist trigger exists. If either is missing
in production, signups fail OPEN with no runtime indication. This means the
operator MUST manually verify the following before promoting any hosted
deploy. Treat this as a P0 gate.

Run these checks against the **production** Supabase project (not local):

### 10.1 Table exists with the expected shape

In Supabase SQL Editor, run:

```sql
select
  count(*) filter (where column_name = 'email')      as has_email,
  count(*) filter (where column_name = 'added_at')   as has_added_at,
  count(*) filter (where column_name = 'added_by')   as has_added_by
from information_schema.columns
where table_schema = 'public' and table_name = 'allowed_emails';
```

Expected: each count returns `1`. If `has_email = 0`, the table is missing or
mis-named — stop and re-run §2.

### 10.2 Trigger function exists

```sql
select count(*) as has_function
from pg_proc
where proname = 'handle_new_user_email_allowlist'
  and pronamespace = 'public'::regnamespace;
```

Expected: `has_function = 1`. If `0`, re-run §3.

### 10.3 Trigger is wired to `auth.users`

```sql
select count(*) as has_trigger
from pg_trigger
where tgname = 'before_user_created_allowlist'
  and tgrelid = 'auth.users'::regclass
  and not tgisinternal;
```

Expected: `has_trigger = 1`. If `0`, re-run §3.

### 10.4 Bypass test — proves the trigger is the enforcement point

This is the critical check: it verifies that the trigger actually denies
non-allowlisted signups via the public anon-key path.

From a browser dev-tools console **on the production frontend**:

```js
const r = await window.supabase?.auth?.signUp({
  email: 'not-allowlisted-test-' + Date.now() + '@example.com',
  password: 'a-long-enough-test-password',
});
console.log(r?.error?.message);
```

(If `window.supabase` is not exposed, the same test can be run from any page
that loads `services/supabaseClient.js` — temporarily attach the client to
`window` for the test and remove after.)

Expected: `r.error` is present with a message indicating signup was rejected.
`r.data.user` is `null` (or contains no committed identity).

Then confirm no row was created:

```sql
select email from auth.users where email ilike 'not-allowlisted-test-%@example.com';
```

Expected: zero rows.

If a row IS created, the trigger is not enforcing — STOP, do not proceed
with the deploy, and re-run §3.

### 10.5 Happy path

With an allowlisted email (insert one in `allowed_emails` if you haven't),
complete a signup → verification → sign in → protected route check against
the production environment.

### 10.6 Build assertion

Run `npm run build` against the production environment's `.env`. Confirm the
build either:
- Succeeds (all three `VITE_*` vars present), or
- Fails with the descriptive error from the Vite plugin (one or more vars
  missing — fix the env config and retry).

A silent build success with `VITE_SUPABASE_URL=''` would mean the plugin is
not wired correctly. STOP and revisit Task 01.3.

---

**Sign-off**: only after all six checks pass should the deploy be promoted
to production. Capture the SQL outputs and the bypass-test result in the
deploy PR description as evidence.
