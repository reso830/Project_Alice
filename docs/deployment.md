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

Hosted mode boots and validates configuration today, but the Supabase
repository implementation is deferred to feature **019-supabase-persistence**.
Until then, hosted API requests return HTTP 500 with the literal message:

```
Hosted persistence is not yet implemented for: <applications|profile>. See feature 019-supabase-persistence.
```

The frontend bundle and the local development workflow are unaffected.

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

The Supabase database schema (tables, indexes, RLS policies) is **not**
provisioned by this feature. Schema creation, migrations, and RLS are part of
feature **019-supabase-persistence**.

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

If `APP_RUNTIME=hosted` is set but any of the three Supabase variables are
missing or empty, the function will throw at cold start. Vercel surfaces this
as a deployment-time error naming the missing variable.

Authentication (feature **018**) and Supabase persistence (feature **019**) are
not yet implemented; hosted deployments are intentionally limited to a booting
foundation for now.

---

## Environment Variable Reference

| Variable | Scope | Local required | Hosted required | Description |
|----------|-------|:--------------:|:---------------:|-------------|
| `APP_RUNTIME` | server | no | yes | `"local"` or `"hosted"`. Defaults to `"local"` if absent. |
| `PORT` | server | no | no | API listen port. Defaults to `3001`. |
| `ALICE_DB_PATH` | server | no | no | Override path for the local SQLite file (default `data/alice.db`). |
| `SUPABASE_URL` | server | no | yes | Supabase project URL. Client-safe in future hosted features. |
| `SUPABASE_ANON_KEY` | server | no | yes | Supabase anon/public key. Client-safe in future hosted features. |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | no | yes | Supabase service role key. **Never expose to the frontend.** |

An environment variable set to an empty string is treated as absent for the
purpose of hosted-mode required checks.

---

## Local vs Hosted Differences

| Aspect | Local mode | Hosted mode |
|---|---|---|
| Trigger | `APP_RUNTIME` absent or `local` | `APP_RUNTIME=hosted` |
| Persistence | SQLite file (`data/alice.db`) | Supabase Postgres (feature 019) |
| Server entry | `node server/index.js` → `app.listen(config.port)` | `api/index.js` exported as a Vercel Function |
| Repository layer | `createSqliteApplicationsRepository` / `createSqliteProfileRepository` | Stub repositories that throw `HostedRepositoryNotImplementedError` |
| Required env vars | None | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| API behavior | Fully functional CRUD on applications and profile | `GET /api/health` returns `200 ok`; all other `/api/*` routes return HTTP 500 referencing feature 019 |
| Auth | None (single local user) | None yet — feature 018 |
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
                                       ├─ server/config.js   (validates env)
                                       ├─ server/repositories/index.js
                                       │     └─ hosted stubs (this feature)
                                       │        Supabase adapters (feature 019)
                                       └─ server/index.js → createApp({ repositories })
```

Local mode short-circuits the Vercel layer: `node server/index.js` directly
calls `app.listen(config.port)` and the repository factory returns the SQLite
adapters backed by `server/db.js`.

The repository interface (`ApplicationsRepository`, `ProfileRepository`) is the
boundary that lets the same `server/routes/*` and the same Express app run
against either persistence backend without route-layer changes. See
`specs/017-hosted-foundation/contracts/api.md` for the full interface contract.
