# Deployment Guide

This guide covers running Project Alice in either of its two supported runtime
modes: **local** (Express + SQLite on your machine) and **hosted** (Vercel
Functions + Supabase Postgres).

---

## Overview

Project Alice supports two persistence modes selected at runtime via the
`APP_RUNTIME` environment variable.

- **Local mode** (`APP_RUNTIME` absent or `local`): the Express API runs on your
  machine and persists data to a SQLite file. This is the default for development
  and requires no environment configuration.
- **Hosted mode** (`APP_RUNTIME=hosted`): the Express API is deployed as a
  Vercel Function and persists data to Supabase Postgres. This mode requires
  Supabase credentials supplied via environment variables.

Hosted mode boots, validates configuration, and gates API access through
Supabase email/password authentication today (feature
**018-auth-user-access**). The Supabase repository implementation for
persisting application/profile data is deferred to feature
**019-supabase-persistence**. Until 019 lands, authenticated hosted API
requests for `/api/applications` and `/api/profile` return HTTP 500 with:

```
Hosted persistence is not yet implemented for: <applications|profile>. See feature 019-supabase-persistence.
```

Unauthenticated requests to those routes return HTTP 401 (handled by
`requireAuth`). The frontend bundle and the local development workflow are
unaffected.

---

## Local Development Setup

No environment variables required.

```bash
npm install

# Start the API server (port 3001)
npm run server:dev

# In a separate terminal, start the Vite frontend (port 5173)
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` requests to the Express
server on port 3001.

To verify the server is running in local mode, look for this line in the API
server log:

```
[config] Runtime mode: local
```

---

## Supabase Project Setup

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Wait for the project to finish provisioning.
3. In the project dashboard, navigate to **Settings → API**.
4. Copy the following values into your local `.env` file (use `.env.example` as
   a template):
   - **Project URL** → `SUPABASE_URL`
   - **`anon` `public` key** → `SUPABASE_ANON_KEY`
   - **`service_role` `secret` key** → `SUPABASE_SERVICE_ROLE_KEY`

> **Security note**: `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security
> and grants full database access. Treat it as a secret. Never commit it,
> never expose it to the frontend, and never prefix it with `VITE_`.

The Supabase database schema (tables, indexes, RLS policies) for application
and profile records is **not** provisioned by this feature. Schema creation,
migrations, and RLS for those tables are part of feature
**019-supabase-persistence**.

Feature **018-auth-user-access** does require one Supabase-managed artifact:
an `allowed_emails` table and a `BEFORE INSERT` trigger on `auth.users` that
gates signups by allowlist membership. Operator install steps for both are
in [`specs/018-auth-user-access/quickstart.md`](../specs/018-auth-user-access/quickstart.md);
they take ~5 minutes in the Supabase SQL editor and must be installed before
the first hosted deploy is promoted.

---

## Hosted Mode Deployment

This section assumes the Supabase project from the previous section is already
provisioned and the allowlist + trigger are installed per the quickstart.

### Required environment variables on Vercel

In **Settings → Environment Variables**, add the following for both
Production and Preview (so preview URLs can authenticate too):

| Name | Sensitive | Purpose |
|---|:---:|---|
| `APP_RUNTIME` | no | Set to `hosted` |
| `SUPABASE_URL` | no | Server-side Supabase REST endpoint |
| `SUPABASE_ANON_KEY` | no | Server-side public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Server-only admin key |
| `SUPABASE_JWT_SECRET` | **yes** | Server-only HS256 secret used by `requireAuth` |
| `VITE_SUPABASE_URL` | no | Browser bundle — same value as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | no | Browser bundle — same value as `SUPABASE_ANON_KEY` |
| `VITE_AUTH_EMAIL_REDIRECT_URL` | no | Verification callback URL Supabase puts in confirmation emails |

The `VITE_*` variables are inlined into the production bundle. The two
service-role/JWT secrets are server-only and **must never** be prefixed with
`VITE_`. The `vite.config.js` plugin `assertHostedFrontendEnv` fails the
build closed if any of the three `VITE_*` vars is missing in production.

### Supabase Auth redirect URL configuration

In the Supabase dashboard, under **Authentication → URL Configuration**:

- **Site URL** — set to the production URL (during 018 development this was
  `https://project-alice-gamma.vercel.app`, but the canonical alias is what
  matters; team-scoped preview URLs do not need to be the Site URL).
- **Redirect URLs** — at minimum:
  - `https://<production-host>/**`
  - `https://<preview-host>/**` (e.g. `*.vercel.app/**` for preview deploys)
  - `http://localhost:5173/**` (for local hosted-mode testing)

The path component matters; including `/**` permits the `?auth=callback`
query the frontend strips after handling the verification banner.

### Pre-deploy verification gate

Before promoting a hosted deploy to production, run the six checks in
[`specs/018-auth-user-access/quickstart.md` §10](../specs/018-auth-user-access/quickstart.md)
against the **production** Supabase project. Quick recap:

1. `allowed_emails` table exists and has the expected operator entries.
2. `auth.users` `BEFORE INSERT` trigger is installed and points at the
   allowlist-check function.
3. The function is `SECURITY DEFINER` and owned by a privileged role.
4. A signup with a non-allowlisted email fails — direct Supabase API call from
   the dashboard / SQL editor, not via the in-app form.
5. A signup with an allowlisted email succeeds.
6. `SUPABASE_JWT_SECRET` matches what Vercel has configured.

Capture each check's output in the deploy PR description. **If any check
fails, do not promote** — install the missing piece and rerun the gate from
scratch. The application server has no Supabase client and cannot detect a
missing trigger at runtime, so this gate is the only mechanism that catches
the OPEN-fail mode where signups bypass the allowlist.

### Local-mode deployment is unchanged

Hosted mode is a separate Vercel project (or at minimum a separate env-var
set), not a runtime flag inside a single project. Local-mode users continue
to run `npm run server:dev` + `npm run dev` against a SQLite file with no env
vars — feature 018 added no new local-mode requirements.

---

## Vercel Project Setup

1. In the [Vercel dashboard](https://vercel.com), import this repository.
2. **Framework preset**: select **Other**. The repository ships a `vercel.json`
   that configures the build command, output directory, and the API rewrite
   rule, so no framework-specific preset is required.
3. **Environment Variables**: in the project's **Settings → Environment
   Variables**, add the following for the Production environment (and Preview
   if you want hosted previews):

   | Name | Value |
   |---|---|
   | `APP_RUNTIME` | `hosted` |
   | `SUPABASE_URL` | from your Supabase project |
   | `SUPABASE_ANON_KEY` | from your Supabase project |
   | `SUPABASE_SERVICE_ROLE_KEY` | from your Supabase project — mark as **Sensitive** |

4. Deploy. The first deployment runs `npm run build`, publishes the Vite output
   from `dist/`, and exposes `api/index.js` as a serverless function. The
   `vercel.json` rewrite forwards all `/api/*` requests to that function.

If `APP_RUNTIME=hosted` is set but any of the four required Supabase variables
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_JWT_SECRET`) are missing or empty, the function throws at cold
start. Vercel surfaces this as a deployment-time error naming the missing
variable.

Authentication (feature **018**) is implemented; Supabase persistence
(feature **019**) is still pending. Hosted deployments today gate all
`/api/applications` and `/api/profile` requests behind a verified Supabase
session but return HTTP 500 from the repository layer until 019 lands.

---

## Environment Variable Reference

| Variable | Scope | Local required | Hosted required | Description |
|----------|-------|:--------------:|:---------------:|-------------|
| `APP_RUNTIME` | server | no | yes | `"local"` or `"hosted"`. Defaults to `"local"` if absent. |
| `PORT` | server | no | no | API listen port. Defaults to `3001`. |
| `ALICE_DB_PATH` | server | no | no | Override path for the local SQLite file (default `data/alice.db`). |
| `SUPABASE_URL` | server | no | yes | Supabase project URL. |
| `SUPABASE_ANON_KEY` | server | no | yes | Supabase anon/public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | no | yes | Supabase service role key. **Never expose to the frontend.** |
| `SUPABASE_JWT_SECRET` | server-only | no | yes | HS256 signing secret used by `server/auth/middleware.js`. **Never expose to the frontend.** |
| `VITE_SUPABASE_URL` | client/build | no | yes | Same value as `SUPABASE_URL`; inlined into the Vite bundle. |
| `VITE_SUPABASE_ANON_KEY` | client/build | no | yes | Same value as `SUPABASE_ANON_KEY`; inlined into the Vite bundle. |
| `VITE_AUTH_EMAIL_REDIRECT_URL` | client/build | no | yes | Verification callback URL Supabase puts in confirmation emails (e.g. `https://<host>/?auth=callback`). |

An environment variable set to an empty string is treated as absent for the
purpose of hosted-mode required checks. The Vite plugin
`assertHostedFrontendEnv` performs the same check at build time for the three
`VITE_*` vars — a production build fails closed if any are missing.

---

## Local vs Hosted Differences

| Aspect | Local mode | Hosted mode |
|---|---|---|
| Trigger | `APP_RUNTIME` absent or `local` | `APP_RUNTIME=hosted` |
| Persistence | SQLite file (`data/alice.db`) | Supabase Postgres (feature 019) |
| Server entry | `node server/index.js` → `app.listen(config.port)` | `api/index.js` exported as a Vercel Function |
| Repository layer | `createSqliteApplicationsRepository` / `createSqliteProfileRepository` | Stub repositories that throw `HostedRepositoryNotImplementedError` |
| Required env vars | None | Four server (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`) + three client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`) |
| API behavior | Fully functional CRUD on applications and profile | `GET /api/health` returns `{ status, runtime }`; protected routes require `Authorization: Bearer <jwt>` and currently return HTTP 500 from the repository layer pending feature 019 |
| Auth | None (single local user) | Supabase email/password with operator allowlist (feature 018) |
| Frontend | Same Vite bundle, same `/api/*` calls | Same Vite bundle, same `/api/*` calls |

The frontend code and API surface are identical between modes. Only the server
boot path and the repository implementation differ.

---

## Architecture Overview

```
Browser ──► Vite static bundle (Vercel CDN, dist/)
   │
   │  fetch /api/*
   ▼
Vercel rewrite (vercel.json) ──► api/index.js (Vercel Function)
                                       │
                                       ├─ server/config.js          (validates env)
                                       ├─ server/auth/middleware.js (requireAuth: JWT HS256)
                                       ├─ server/repositories/index.js
                                       │     └─ hosted stubs
                                       │        Supabase adapters (feature 019)
                                       └─ server/index.js → createApp({ repositories, config, requireAuth })
```

Local mode short-circuits the Vercel layer: `node server/index.js` directly
calls `app.listen(config.port)` and the repository factory returns the SQLite
adapters backed by `server/db.js`.

The repository interface (`ApplicationsRepository`, `ProfileRepository`) is the
boundary that lets the same `server/routes/*` and the same Express app run
against either persistence backend without route-layer changes. See
`specs/017-hosted-foundation/contracts/api.md` for the full interface contract.
