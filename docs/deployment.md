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

Hosted mode boots, validates configuration, gates API access through
Supabase email/password authentication (feature **018-auth-user-access**),
and persists application + profile data per-user in Supabase Postgres
under Row Level Security (feature **019-supabase-persistence**, since
v0.9.0). New hosted users receive 2 seeded sample applications on first
sign-in via an atomic `claim_and_seed_starter()` RPC; the profile starts
empty by design (FR-012). Cross-user access is refused at both the
server-side filter and RLS layers — verified end-to-end against a live
multi-tenant project.

### Schema migrations

Hosted operators **MUST** apply the canonical migration SQL in
[`specs/019-supabase-persistence/data-model.md §5`](../specs/019-supabase-persistence/data-model.md)
via the Supabase dashboard's **SQL Editor** before deploying a v0.9.0+
build to hosted mode. The block is idempotent (`CREATE TABLE IF NOT
EXISTS` + `DROP POLICY IF EXISTS`) and safe to re-run.

Feature **025-application-timeline** adds an additive `timeline jsonb`
column and v2 of `claim_and_seed_starter()` so new hosted users receive
starter applications with populated Timelines. Apply
[`specs/025-application-timeline/quickstart.md`](../specs/025-application-timeline/quickstart.md)
after the 019 schema block and before promoting a v0.12.0+ hosted
deploy.

Feature **026-calendar** adds no new Postgres schema but ships v3 of
`claim_and_seed_starter()`. The v3 body enriches each starter
application's Timeline with entries whose ages trigger Calendar
Suggested Actions (follow-up, feedback, ghost-flag, offer-expiry) out
of the box. Apply the v3 RPC body from
[`docs/db/claim_and_seed_starter.md`](../docs/db/claim_and_seed_starter.md)
after the 025 block and before promoting a v0.13.0+ hosted deploy. The
RPC is idempotent — calling `CREATE OR REPLACE FUNCTION` with the v3
body is safe to re-run against a project that already has v2.

Feature **028-archive-applications-view** adds an additive
`archived_date date` column to `applications` (nullable, default NULL,
no backfill). Apply the SQL block from
[`specs/028-archive-applications-view/data-model.md §1.3`](../specs/028-archive-applications-view/data-model.md)
after the 026 RPC and before promoting a v0.14.0+ hosted deploy. The
migration uses `ADD COLUMN IF NOT EXISTS` and is safe to re-run.
Operator walkthrough: [`specs/028-archive-applications-view/quickstart.md §3.1`](../specs/028-archive-applications-view/quickstart.md).
Legacy archived rows (those archived before this migration) retain
`archived_date = NULL` and surface as `Archived ${lastStatusUpdate}` in
the card date-stamp — no data fix is required.

Feature **032-profile-schema-refactor** promotes profile skills into a
dedicated `public.profile_skill` table (one row per skill) with RLS
mirroring `profile`, a case-insensitive unique index, and an atomic
`save_profile_with_skills(p_data, p_skills)` RPC. Apply the SQL block
from
[`specs/032-profile-schema-refactor/data-model.md §3`](../specs/032-profile-schema-refactor/data-model.md)
after the 028 migration and before promoting a v1.2.0+ hosted deploy.
The block is idempotent (`CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF
EXISTS` + `CREATE OR REPLACE FUNCTION`) and safe to re-run. No data
backfill step is required: existing profiles migrate their embedded
skills into the table automatically on first read (idempotent, no user
action). Operator walkthrough:
[`specs/032-profile-schema-refactor/quickstart.md §2`](../specs/032-profile-schema-refactor/quickstart.md).

Feature **036-compatibility-engine** adds an additive
`min_years_experience integer` column to `applications` (nullable, no
default, no backfill of that column). Apply the SQL block from
[`specs/036-compatibility-engine/data-model.md §1`](../specs/036-compatibility-engine/data-model.md)
after the 032 migration and before promoting a v1.6.0+ hosted deploy. The
migration uses `ADD COLUMN IF NOT EXISTS` and is safe to re-run.

> **One-time compatibility backfill (hosted operator step).** As of 036,
> `compat` is a deterministic, server-computed score; existing rows may
> still carry pre-036 random values. After applying the column migration,
> run a **one-time maintenance pass that rescores every application for
> each user — including archived rows — writing only `compat`** (see
> [`specs/036-compatibility-engine/data-model.md §3`](../specs/036-compatibility-engine/data-model.md)).
> Do **not** use a profile re-save for this: the ongoing profile-save
> recompute intentionally excludes archived applications, so archived rows
> would keep their legacy values. Local mode performs this backfill
> automatically on boot (`initSchema`); hosted has no automatic backfill,
> so the maintenance pass is an explicit operator step.

Feature **037-compatibility-insights-panel** adds two additive `TEXT`
columns to `applications`: `compat_analysis` (nullable, JSON-encoded
`CompatNotes` or `null`) and `compat_scored_at` (nullable, ISO timestamp
used as the notes-staleness signal). Apply the SQL block from
[`specs/037-compatibility-insights-panel/data-model.md §1, §2`](../specs/037-compatibility-insights-panel/data-model.md)
after the 036 migration and before promoting a v1.7.0+ hosted deploy. The
block uses `ADD COLUMN IF NOT EXISTS` and is safe to re-run. The backfill
sets `compat_scored_at = created_at` for existing rows (prevents
false staleness on pre-037 records) and nulls any existing `compat_notes`
values (column is retained). No deployment action is required for this
feature beyond the column additions — no new env vars, no new RPC, no
seed changes. See [`specs/037-compatibility-insights-panel/quickstart.md`](../specs/037-compatibility-insights-panel/quickstart.md).

The Express server runs a **boot-time schema check**
([server/health.js](../server/health.js)) that issues sentinel PostgREST
probes against `applications` (including `applications.timeline`,
`applications.min_years_experience`, `applications.compat_analysis`, and
`applications.compat_scored_at`), `profile`, `profile_skill`, and
`user_seed_state`. If the migration has not been applied:
- The server logs a descriptive error naming the missing column or
  table (e.g. `[hosted-schema] missing artifact: public.applications.user_id`).
- The process exits non-zero so deployment orchestrators detect the failure.
- No HTTP listener is bound — the function/server refuses to serve.

To validate manually, walk
[`specs/019-supabase-persistence/quickstart.md §§4–10`](../specs/019-supabase-persistence/quickstart.md)
against a fresh Supabase project before promoting to production.

### Server-side dependencies (v0.9.0+)

The Express server uses `@supabase/supabase-js` to construct per-request
RLS-scoped clients in hosted mode. The same package version that ships
in the Vite frontend bundle (added by 018) is reused at the Node runtime
— no separate server install. Verify with `npm ls @supabase/supabase-js`.

Unauthenticated requests to protected routes still return HTTP 401
(handled by `requireAuth`). The frontend bundle and the local
development workflow are unaffected by 019.

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

## Portable Distribution Package (local, Windows)

Feature `040-portable-distribution-package` packages the **local** runtime as a
self-contained Windows ZIP so end users can run Alice with no Node.js install,
no repository clone, and no terminal. This is a packaging of the existing local
mode — it introduces **no new hosted behavior and no new environment
variables**, and hosted (Vercel) deployment is unchanged.

**Runtime entry.** The package launches `server/portable.js` (not the dev
`server/index.js` CLI boot). The launcher (`Start-Alice.cmd`) runs the bundled
`runtime\node.exe`; the bootstrap then:

- sets `APP_RUNTIME=local` and points `ALICE_DB_PATH` at the package's
  `data/alice.db` (so the SQLite file lives outside the replaceable program
  files);
- reads `config/settings.json` (`port`, default `3001`; `openBrowser`, default
  `true`);
- builds the app with the gated `serveStatic` branch of `createApp`, so one
  Express origin serves the built `dist/` (SPA fallback) **and** `/api/*`;
  since issue **093** (branded 404 page), only `GET /` falls back to
  `index.html` — any other unmatched non-`/api` GET path now returns a real
  `404` status with the branded `dist/404.html` page instead of silently
  200ing the app shell;
- binds to **`127.0.0.1` only** (never exposed to the network — local mode has
  no auth, so nothing is reachable from other devices), auto-selecting the next
  free local port if the default is busy;
- opens the default browser, and writes startup/runtime diagnostics to
  `logs/alice.log`.

**Standardized layout.** The ZIP extracts to `alice/` with replaceable program
files (`app/`, `runtime/`) kept separate from preserved user state (`data/`,
`config/`, `logs/`) plus a root `VERSION` marker — the foundation a future
self-update feature (041) builds on. No application data, schema, migration, or
`/api` route behavior changes.

**Build & release.** On Windows, `npm run build:portable`
(`scripts/build-portable.mjs`) builds the frontend, bundles a pinned official
Node runtime (verified against the official `SHASUMS256`, with an ABI-matched
`better-sqlite3` and a DB-open smoke check), assembles the layout, and emits
`alice-v<version>-win-x64.zip` plus a `.sha256` checksum under `portable-dist/`.
The `release-portable.yml` GitHub Actions workflow builds and attaches those
artifacts to a GitHub Release, triggered **only** on a `v*` tag or manual
`workflow_dispatch` (never on per-feature merges, to conserve free-tier minutes).
The self-update extractor expects the release ZIP shape produced by PowerShell
`Compress-Archive`, including concrete entry sizes in Local File Headers. Do not
switch the release workflow to a streamed/data-descriptor ZIP writer without also
updating the extractor; Alice rejects those archives during update staging.

**AI in the portable package.** Unchanged from local mode — the OpenRouter key
is a browser-local BYOK (`localStorage`), the server is never in the AI path,
and no key ships on disk.

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

> **Runtime use (feature 030)**: as of **v1.0.0**, the service-role key is
> used at **runtime** — not just at boot — by the account-deletion endpoint
> (`DELETE /api/account`). It constructs a server-only Supabase **admin**
> client (lazy-imported on the delete path) to call
> `auth.admin.deleteUser(...)`; the `ON DELETE CASCADE` foreign keys from
> 019 then remove the user's `applications`, `profile`, and `user_seed_state`
> rows. No new environment variable is introduced — the key was already
> required in hosted mode — but its runtime role is new. See
> [`specs/030-delete-profile-data/`](../specs/030-delete-profile-data/)
> (contracts/api.md for the endpoint shape; research.md R-1/R-2 for the
> cascade + password-verification design).

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

## Supabase Setup Checklist

Run these steps top to bottom against a fresh Supabase project. Each step
is idempotent and safe to re-run. Per-feature quickstarts under `specs/`
remain authoritative for deep-dive context — this checklist is the
ordered procedure and the pass/fail framing.

1. **Create the Supabase project.**
   - [ ] Sign in at [supabase.com](https://supabase.com) and create a new
     project; wait for provisioning to complete.
   - [ ] In **Settings → API**, copy `Project URL` → `SUPABASE_URL`,
     `anon public` → `SUPABASE_ANON_KEY`, and
     `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`.
   - [ ] Treat `SUPABASE_SERVICE_ROLE_KEY` as a secret: never commit,
     never expose to the frontend, never prefix with `VITE_`.

2. **Apply the schema migration.**
   - [ ] Open the Supabase **SQL Editor** and run the canonical
     migration block from
     [`specs/019-supabase-persistence/data-model.md §5`](../specs/019-supabase-persistence/data-model.md).
     It creates `public.applications`, `public.profile`,
     `public.user_seed_state`, all RLS policies, and the
     `claim_and_seed_starter()` RPC.
   - [ ] The block uses `CREATE TABLE IF NOT EXISTS` /
     `DROP POLICY IF EXISTS` and is safe to re-run.
   - [ ] For v0.12.0+ hosted deploys, apply the 025 Timeline migration
     and starter-RPC v2 body from
     [`specs/025-application-timeline/quickstart.md`](../specs/025-application-timeline/quickstart.md).
   - [ ] For v0.13.0+ hosted deploys, apply the 026 Calendar
     starter-RPC v3 body from
     [`docs/db/claim_and_seed_starter.md`](../docs/db/claim_and_seed_starter.md).
   - [ ] For v0.14.0+ hosted deploys, apply the 028 archive
     `archived_date` column migration from
     [`specs/028-archive-applications-view/data-model.md §1.3`](../specs/028-archive-applications-view/data-model.md).
   - [ ] For v1.2.0+ hosted deploys, apply the 032 `profile_skill`
     table + RLS + `save_profile_with_skills` RPC from
     [`specs/032-profile-schema-refactor/data-model.md §3`](../specs/032-profile-schema-refactor/data-model.md).
   - [ ] For v1.6.0+ hosted deploys, apply the 036
     `min_years_experience` column from
     [`specs/036-compatibility-engine/data-model.md §1`](../specs/036-compatibility-engine/data-model.md),
     then run the one-time compatibility backfill over **all**
     applications (including archived rows) per
     [`§3`](../specs/036-compatibility-engine/data-model.md) — not a
     profile re-save (which skips archived).

3. **Install the allowlist trigger.**
   - [ ] Follow
     [`specs/018-auth-user-access/quickstart.md`](../specs/018-auth-user-access/quickstart.md)
     to create the `allowed_emails` table and the `BEFORE INSERT`
     trigger on `auth.users`.
   - [ ] Populate `allowed_emails` with the operator's own email
     (and any additional trusted emails) before attempting the first
     signup, or the trigger will reject it.

4. **Configure Auth redirect URLs.**
   - [ ] In **Authentication → URL Configuration**, set the
     **Site URL** to your production URL and add Redirect URLs for
     production, preview, and `http://localhost:5173/**` per the
     [Supabase Auth redirect URL configuration](#supabase-auth-redirect-url-configuration)
     subsection below.
   - [ ] Each Redirect URL must end with `/**` so the `?auth=callback`
     query the frontend uses is permitted.

5. **Verify JWKS reachability.**
   - [ ] `curl <SUPABASE_URL>/auth/v1/.well-known/jwks.json` and
     confirm the response is a JWKS document of the shape
     `{ "keys": [ { ... } ] }`. The middleware fetches this endpoint
     on demand to verify JWTs.

6. **Verify RLS policies enforce per-user isolation.**
   - [ ] In the Supabase **SQL Editor**, confirm `applications`,
     `profile`, and `user_seed_state` all show
     `ROW LEVEL SECURITY = enabled` (run
     `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN
     ('applications', 'profile', 'user_seed_state');` — every row
     should report `true`).
   - [ ] Walk the cross-user denial verification recipe in
     [`specs/019-supabase-persistence/quickstart.md`](../specs/019-supabase-persistence/quickstart.md)
     against the production Supabase project: sign in as user A,
     create an application; sign in as user B; attempt to read
     user A's application by ID and confirm the response is `404`
     (RLS-scoped — the row does not exist from user B's
     perspective), not `200` and not `403`.
   - [ ] This step pins both the database-side defense (RLS) and
     the server-side defense (repository filters) that 019 ships;
     a `200` response indicates a critical RLS misconfiguration —
     do not promote.

7. **Run the pre-deploy verification gate.**
   - [ ] Walk the six checks in
     [`specs/018-auth-user-access/quickstart.md` §10](../specs/018-auth-user-access/quickstart.md)
     against the **production** Supabase project: allowlist table,
     signup trigger, function privileges, non-allowlisted signup
     rejected, allowlisted signup succeeds, JWKS endpoint reachable.

If any step fails, do not promote. Install the missing piece and
re-run from step 1 — every step is safe to re-run.

After this checklist passes, walk
[`docs/hosted-smoke-test.md`](hosted-smoke-test.md) against the
deployed preview to verify the runtime end-to-end before promoting
to production.

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
| `SUPABASE_URL` | no | Server-side Supabase REST endpoint; the middleware derives the JWKS endpoint from this |
| `SUPABASE_ANON_KEY` | no | Server-side public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Server-only admin key |
| `VITE_SUPABASE_URL` | no | Browser bundle — same value as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | no | Browser bundle — same value as `SUPABASE_ANON_KEY` |
| `VITE_AUTH_EMAIL_REDIRECT_URL` | no | Verification callback URL Supabase puts in confirmation emails |

The `VITE_*` variables are inlined into the production bundle. The
service-role key is server-only and **must never** be prefixed with
`VITE_`. The `vite.config.js` plugin `assertHostedFrontendEnv` fails the
build closed if any of the three `VITE_*` vars is missing in production.

Access tokens are verified server-side via Supabase's JWKS endpoint
(`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`) using `jose`, accepting
`ES256` and `RS256` — Supabase's modern asymmetric signing modes for
projects created from 2024 onwards. No shared HS256 secret is required.

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
6. JWKS endpoint at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` returns a valid JWKS document (curl it; expect `{ "keys": [ { ... } ] }`).

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
   Since issue **093** (branded 404 page), `public/404.html` ships as
   `dist/404.html`; Vercel's static-output convention auto-serves it as the
   not-found response for any unmatched, non-rewritten path — no
   `vercel.json` change is needed for this.

If `APP_RUNTIME=hosted` is set but any of the three required Supabase variables
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are missing
or empty, the function throws at cold start. Vercel surfaces this as a
deployment-time error naming the missing variable.

Authentication (feature **018**) and Supabase persistence (feature
**019**, since v0.9.0) are both implemented. Hosted deployments gate all
`/api/applications` and `/api/profile` requests behind a verified
Supabase session AND scope every read/write to the caller's `user_id`
via Supabase Row Level Security plus server-side filter (defense in
depth). New hosted users get 2 sample applications seeded on first
sign-in via an atomic `claim_and_seed_starter()` RPC; the profile
starts empty by design.

The welcome page's **Try the demo** CTA (feature **020**, since
v0.10.0) is enabled by default in hosted deployments and requires no
configuration. The demo runs entirely client-side — no API calls, no
storage, no Supabase access — so it adds no operator surface beyond
shipping the existing Vite bundle.

---

## Environment Variable Reference

| Variable | Scope | Local required | Hosted required | Description |
|----------|-------|:--------------:|:---------------:|-------------|
| `APP_RUNTIME` | server | no | yes | `"local"` or `"hosted"`. Defaults to `"local"` if absent. |
| `PORT` | server | no | no | API listen port. Defaults to `3001`. |
| `ALICE_DB_PATH` | server | no | no | Override path for the local SQLite file (default `data/alice.db`). |
| `SUPABASE_URL` | server | no | yes | Supabase project URL; middleware derives JWKS endpoint from this. |
| `SUPABASE_ANON_KEY` | server | no | yes | Supabase anon/public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | no | yes | Supabase service role key. **Never expose to the frontend.** |
| `VITE_SUPABASE_URL` | client/build | no | yes | Same value as `SUPABASE_URL`; inlined into the Vite bundle. |
| `VITE_SUPABASE_ANON_KEY` | client/build | no | yes | Same value as `SUPABASE_ANON_KEY`; inlined into the Vite bundle. |
| `VITE_AUTH_EMAIL_REDIRECT_URL` | client/build | no | yes | Verification callback URL Supabase puts in confirmation emails (e.g. `https://<host>/?auth=callback`). |

An environment variable set to an empty string is treated as absent for the
purpose of hosted-mode required checks. The Vite plugin
`assertHostedFrontendEnv` performs the same check at build time for the three
`VITE_*` vars — a production build fails closed if any are missing.

### AI resume parsing (BYOK) — no new env vars

The AI resume parser remains **bring-your-own-key and browser-side**. Feature
033 (v1.3.0) introduced the browser-direct OpenRouter path; feature
034-profile-page-refresh (v1.4.0) moves the key, model, and feature toggles into
the Profile page's unified Settings card and guided import flow. The key is
stored only in the user's browser and sent browser-direct to OpenRouter.

Feature 034 introduces **no new server environment variables**, **no database
schema migration**, and **no runtime-mode change**. No deployment action is required for feature 034. Existing hosted and local deployments keep the same `/api/resume/*`
server surface; AI availability is controlled entirely by browser-local
settings. See
[`specs/034-profile-page-refresh/quickstart.md`](../specs/034-profile-page-refresh/quickstart.md).

### AI job-description parsing (BYOK) — no new env vars

Feature 035-llm-jd-parser (v1.5.0) adds an AI-assisted job-description parser to
the Add-application gate's Smart entry. Like the resume parser it is
**bring-your-own-key and browser-side**: the OpenRouter key is stored only in the
user's browser and job text is sent browser-direct to OpenRouter, never
persisted. There is **no new server surface at all** — job-description parsing is
fully client-side (paste only; no file upload, so no `/api` route is involved).

Feature 035 introduces **no new server environment variables**, **no database
schema migration**, and **no runtime-mode change**. No deployment action is
required for feature 035. See
[`specs/035-llm-jd-parser/quickstart.md`](../specs/035-llm-jd-parser/quickstart.md).

### Welcome Page & Brand Refresh — no new env vars

Feature `042-welcome-brand-refresh` (v1.11.0) refreshes the welcome page layout responsiveness, logo asset paths, and updates empty-state illustrations and in-app LLM processing loaders.

Feature 042 introduces **no new server environment variables**, **no database schema migration**, and **no runtime-mode change**. No deployment action is required.

### Hosted Startup Performance — no new env vars

Feature `044-hosted-startup-performance` (v1.12.0) replaces the blank white page on hosted cold loads with a branded loader, parallelizes the boot handshake (health + session checks run concurrently instead of sequentially), code-splits `Calendar`/`Profile`/`ProfileEdit` into separate chunks, and self-hosts Sora + DM Mono (`@fontsource/sora`, `@fontsource/dm-mono`) instead of loading them from `fonts.googleapis.com`.

All runtime changes are **hosted-only** — the loader markup is stripped server-side for portable (`server/index.js`) and by a Vite dev-server plugin for `npm run dev` (`vite.config.js`), so local/portable boot is unchanged. Feature 044 introduces **no new server environment variables**, **no database schema migration**, and **no runtime-mode change**. No deployment action is required. See [`specs/044-hosted-startup-performance/quickstart.md`](../specs/044-hosted-startup-performance/quickstart.md).


---

## Environment Variable Checklist

If you are deploying hosted mode for the first time, walk this checklist
against your Vercel project's environment-variable configuration. Pair it
with the [Environment Variable Reference](#environment-variable-reference)
table above for one-row look-ups; this checklist groups variables by
deployer-facing pass/fail framing.

### Required for hosted mode

All seven variables below MUST be set in Vercel **Settings → Environment
Variables** for Production (and Preview, if you want hosted preview URLs)
before the first deploy.

- [ ] `APP_RUNTIME` — server scope, not secret. Set to `hosted`.
- [ ] `SUPABASE_URL` — server scope, not secret. Supabase project REST
  endpoint; middleware derives the JWKS endpoint from this.
- [ ] `SUPABASE_ANON_KEY` — server scope, not secret. Supabase
  anon/public key.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, **secret**. Mark
  as Sensitive in Vercel. Bypasses RLS; never expose to the frontend;
  never prefix with `VITE_`.
- [ ] `VITE_SUPABASE_URL` — client/build scope, not secret. Same value
  as `SUPABASE_URL`; inlined into the Vite bundle.
- [ ] `VITE_SUPABASE_ANON_KEY` — client/build scope, not secret. Same
  value as `SUPABASE_ANON_KEY`; inlined into the Vite bundle.
- [ ] `VITE_AUTH_EMAIL_REDIRECT_URL` — client/build scope, not secret.
  Verification callback URL Supabase puts in confirmation emails
  (e.g. `https://<your-host>/?auth=callback`).

### Optional

- [ ] `PORT` — server scope. API listen port for local mode; defaults
  to `3001`. Hosted mode does not use this.
- [ ] `ALICE_DB_PATH` — server scope. Local SQLite file path;
  defaults to `data/alice.db`. Hosted mode does not use this.

### Local-only

No env vars are **required** for local mode — `npm run server:dev` +
`npm run dev` against a SQLite file works with zero configuration. The
two Optional variables above apply in local mode as well.

### Example `.env.local` (hosted)

The block below uses the variable names and ordering from
[`.env.example`](../.env.example) verbatim. `APP_RUNTIME=hosted` is
filled in because it is the one fixed value that switches the server
into hosted mode; every other variable is left blank exactly as the
template ships — fill each one with the value from your Supabase
project (Settings → API) and your production host URL.

```dotenv
APP_RUNTIME=hosted

PORT=

ALICE_DB_PATH=

SUPABASE_URL=

SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

VITE_SUPABASE_URL=

VITE_SUPABASE_ANON_KEY=

VITE_AUTH_EMAIL_REDIRECT_URL=
```

`.env.example` is the authoritative template — copy it to
`.env.local` and fill in the values rather than typing the keys by
hand. The block above shows the minimum diff: only `APP_RUNTIME` has
a fixed value the operator does not need to source from Supabase.

### Secrets handling

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Vite would inline a
  `VITE_`-prefixed variable into the public browser bundle — never use
  that prefix for the service-role key.
- An environment variable set to an empty string is treated as absent
  for hosted-mode required checks. Either set every required variable
  to a real value or leave it unset.
- `VITE_*` values are inlined into the public bundle at build time.
  Never put a credential, secret, or admin key behind that prefix.

For one-row look-ups (scope, default, hosted-required), the
[Environment Variable Reference](#environment-variable-reference) table
above remains canonical.

---

## Local vs Hosted Differences

| Aspect | Local mode | Hosted mode |
|---|---|---|
| Trigger | `APP_RUNTIME` absent or `local` | `APP_RUNTIME=hosted` |
| Persistence | SQLite file (`data/alice.db`) | Supabase Postgres, per-user via RLS (v0.9.0+) |
| Server entry | `node server/index.js` → `app.listen(config.port)` | `api/index.js` exported as a Vercel Function |
| Repository layer | `createSqliteApplicationsRepository` / `createSqliteProfileRepository` | `createSupabaseApplicationsRepository` / `createSupabaseProfileRepository` — per-request RLS-scoped Supabase clients constructed from the caller's JWT |
| Required env vars | None | Three server (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) + three client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL`) |
| API behavior | Fully functional CRUD on applications and profile | Fully functional CRUD scoped per user; `GET /api/health` returns `{ status, runtime }`; protected routes require `Authorization: Bearer <jwt>` and seed starter data on first authenticated request |
| Auth | None (single local user) | Supabase email/password with operator allowlist (feature 018) |
| Frontend | Same Vite bundle, same `/api/*` calls | Same Vite bundle, same `/api/*` calls |

The frontend code and API surface are identical between modes. Only the server
boot path and the repository implementation differ.

---

## Observability — Speed Insights

The hosted Vercel deployment reports **Core Web Vitals** (LCP, CLS, INP,
and related real-user performance metrics) to **Vercel Speed Insights**
via the `@vercel/speed-insights` package, injected once on app bootstrap
in [`src/main.js`](../src/main.js).

- **Production-only.** The package only sends data from the production
  Vercel deployment. In local mode (e.g. a GitHub checkout) and dev it
  no-ops and logs to the console — no metrics leave the machine. This
  preserves the constitution's local-first principle.
- **Page performance only.** It measures page-level timings, never
  application data. No cookies, no `localStorage`, no PII.
- **Enable in the dashboard.** Collection requires turning on the
  **Speed Insights** tab for the project in the Vercel dashboard. Until
  that toggle is on, the injected script reports nothing. No environment
  variables are required.
- **Governance.** This is an explicit, scoped exception to the
  constitution's "third-party data sharing absent by default" clause,
  recorded in [`.specify/memory/constitution.md`](../.specify/memory/constitution.md).

---

## Demo & Free-Tier Notes

Project Alice's hosted deploy is shaped for free-tier hosting (Vercel
Hobby + Supabase Free). The behaviors below are expected, not defects.

- **Vercel Hobby cold starts.** The first request to the API after a
  quiet period may take several seconds while the function instance
  boots. Subsequent requests in the same warm window are fast. No
  configuration change avoids cold starts on Hobby; this is a tier
  characteristic. See the
  [Vercel Functions docs](https://vercel.com/docs/functions) for
  current behavior.
- **Supabase Free inactivity pause.** A Supabase Free project that
  receives no traffic for an extended quiet period pauses; the next
  request fails. Resume the project from the Supabase dashboard and
  wait 1–2 minutes for warmup, then retry. See the
  [Supabase platform docs](https://supabase.com/docs/guides/platform)
  for current free-tier policy.
- **Demo mode resets on refresh.** The welcome page's **Try the demo**
  flow (feature 020) runs entirely client-side — no API calls, no
  Supabase access, no persistence. Refreshing the browser resets demo
  state to the original seeded snapshot. This is intentional: the demo
  is a portfolio preview, not a sandbox account.
- **Hosted seeded data, not migrated.** New hosted users get 2 sample
  applications seeded on first authenticated sign-in via the
  `claim_and_seed_starter()` RPC (feature 019); the profile starts
  empty by design. The seeded set is intentional — it is not migrated
  from anyone's local SQLite database. See
  [Migration Clarification](#migration-clarification) below.

Portfolio reviewers should expect production-feel inside these
constraints, not production-grade scale.

---

## Migration Clarification

**No automatic migration.** Specifically:
local SQLite data is not migrated automatically.
A user who has been running local mode and decides to deploy hosted
will not see their local data carry over. The hosted runtime reads
from Supabase Postgres; the local runtime reads from a SQLite file.
There is no bridge between the two.

**Hosted users start from seeded data.** On first authenticated
sign-in, the `claim_and_seed_starter()` RPC (feature 019) inserts 2
seeded starter applications into the user's row-scoped slice of
`public.applications`. The profile starts empty by design (feature
019, FR-012). New hosted users see this seeded state, not migrated
state.

**Migration tooling is future work.** No script, CLI, or admin
endpoint exists today to move SQLite rows into Supabase. If such a
tool is added later, it will land as a separate feature with its
own spec — track it in `specs/` when it arrives.

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
                                       ├─ server/auth/middleware.js (requireAuth: JWKS-verified ES256/RS256 via jose)
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
