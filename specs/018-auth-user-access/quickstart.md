# Quickstart: Hosted Auth (018)

How to bring up hosted mode with authentication locally, for development or
manual validation. Local SQLite mode is unaffected; you can skip everything here
if you're only doing local-mode work.

This builds on the hosted setup documented in 017. If 017's Supabase project is
already provisioned, jump to step 3.

---

## 1. Supabase project (one-time)

If you haven't already:
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. From **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon` public key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` *(server-only)*
3. From **Project Settings → API → JWT Settings**, copy:
   - `JWT Secret` → `SUPABASE_JWT_SECRET` *(server-only)*

---

## 2. Create the `allowed_emails` table

In the Supabase dashboard, open **SQL Editor** and run:

```sql
create table allowed_emails (
  email      text primary key,
  added_at   timestamptz not null default now(),
  added_by   text
);

alter table allowed_emails enable row level security;
-- intentionally no policies — denies the anon role by default;
-- service role bypasses RLS for server reads
```

Add your own email so you can sign up:

```sql
insert into allowed_emails (email, added_by) values
  ('lowercase-your-email@example.com', 'self');
```

Note: insert emails **lowercased**. The server lowercases incoming signup
submissions before looking them up.

---

## 3. Configure Supabase Auth

In the dashboard:
1. **Authentication → Providers → Email**: enable email/password.
2. **Authentication → URL Configuration**:
   - Set **Site URL** to your hosted frontend origin (e.g.
     `http://localhost:5173` for local dev, or the Vercel preview URL).
   - Add `http://localhost:5173/?auth=callback` to **Redirect URLs**
     (and the production equivalent).
3. **Authentication → Email Templates**: leave defaults for now; this feature
   does not customize templates.

---

## 4. Local `.env` for hosted-mode dev

Add to your local `.env` (or `.env.local`):

```bash
# from 017
APP_RUNTIME=hosted
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# new in 018
SUPABASE_JWT_SECRET=<jwt-secret-from-dashboard>
AUTH_EMAIL_REDIRECT_URL=http://localhost:5173/?auth=callback
```

Vite-exposed env vars (added in a later task once implementation lands):

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

> **Do not** add `VITE_SUPABASE_SERVICE_ROLE_KEY` or `VITE_SUPABASE_JWT_SECRET`.
> Those must never reach the browser bundle.

---

## 5. Run

```bash
npm run server:dev   # Express API in hosted mode
npm run dev          # Vite frontend
```

Expected boot log: `[config] Runtime mode: hosted` (carried over from 017).

---

## 6. Manual validation flow

1. Open the frontend. You should see the welcome page (login + signup
   sections). The tracker, profile, and calendar should not be reachable.
2. Use the signup form with the email you added to `allowed_emails` and any
   password ≥ 8 characters. The form should show a "check your email" state.
3. Open the verification email; click the link. You should land back on the
   welcome page with the callback handled, ready to sign in.
4. Sign in. The app shell should mount; navbar should show your email and a
   sign-out control.
5. Open browser dev tools → Network. Refresh. Confirm a protected request like
   `GET /api/applications` carries an `Authorization: Bearer …` header and
   returns 200.
6. Click sign-out. The welcome page should reappear and the next
   `GET /api/applications` (e.g. via dev tools) should return 401.

### Negative paths

- **Non-allowlisted signup**: try signing up with an email that's **not** in
  `allowed_emails`. The form should display a generic "Signup is not available
  for this email" error. The dashboard should show no new row in `auth.users`.
- **Tampered token**: with dev tools, edit the `Authorization` header in a
  replayed request. Expect 401 with no diagnostic detail in the response body.

---

## 7. Switching back to local mode

Unset (or comment out) `APP_RUNTIME` and the hosted Supabase env vars. Restart
the server:

```bash
npm run server:dev
```

Expected boot log: `[config] Runtime mode: local`. No auth, no welcome page,
SQLite as today.

---

## 8. Rotation

- **JWT secret rotated in Supabase dashboard**: update `SUPABASE_JWT_SECRET` in
  your `.env` and restart the server. Existing sessions will fail verification
  and users must sign in again.
- **Service role key rotated**: update `SUPABASE_SERVICE_ROLE_KEY` in your
  `.env` and restart. No user impact.
- **Allowlist entry removed**: the corresponding Supabase user is **not**
  deleted automatically. Disable the user from **Authentication → Users** in
  the dashboard if you want them locked out.
