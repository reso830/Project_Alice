# Project Alice — Application Tracker

A local-first job application tracker built with vanilla JavaScript, Vite, and a SQLite-backed Express API. Review applications, inspect details, update statuses, star priority leads, copy saved job URLs, and archive records.

## Features

- **Application cards** — surface company, role, status, date, and compatibility at a glance
- **Inline edit modal** — click any field to edit it directly in the detail view; outside-click commits to draft; Esc reverts the field; Cmd/Ctrl+S saves; discard confirmation guard on close
- **Create mode** — `+ New application` opens an empty draft; status defaults to Wishlisted; saving creates the record and switches to edit mode
- **Full detail view** — modal with all application fields: job title, company, status, salary, compatibility, source URL, recruiter, location, shift, work setup, preferred skills, compatibility notes, and general notes
- **Status workflow** — nine states (Wishlist → Applied → Phone Screen → Interview → Technical Assessment → Offer → Rejected → Withdrawn → Ghosted)
- **Quick filters & sort** — filter by Status, Salary range, Compatibility range, Company, Favorites, Shift, Work Setup, and Location; stack multiple filters with AND logic; sort by Job ID, Status, Compatibility, Salary, or Company; filter state persists across reloads
- **Quick actions** — change status, star applications, copy saved URLs, and archive directly from the card list
- **Pagination** — 3-page sliding window with first/last anchors; hidden when 10 or fewer records; page preserved across archives and reloads
- **Profile page** — personalised welcome, application stats with an interactive donut chart (desktop) and stacked bar (mobile), and a full profile card with collapsible subsections
- **Profile editing** — centralized editor with sticky Save/Cancel controls, dirty-state tracking, and discard confirmation; all six structured sections (Experience, Education, Certifications, Awards, Languages, Links) use modal/bottom-sheet overlays for Add and Edit with inline validation, focus trap, and discard guard; Skills use a staging overlay with deduplication; browser refresh guard warns on unsaved changes; navbar navigation intercepted when unsaved changes exist
- **Persistent footer** — brand identity, version info, tech stack credits, and feedback links on every page
- **SQLite persistence** — all data stored in a local SQLite database via a lightweight Express API; no external services
- **Hosted authenticated access** — optional Supabase-backed multi-user mode behind an operator-managed email allowlist (`specs/018-auth-user-access/`); local mode is unaffected and remains the default

## Tech Stack

| Tool | Purpose |
|---|---|
| [Vite](https://vite.dev) | Dev server and bundler |
| Vanilla JS (ES modules) | UI and business logic |
| CSS custom properties | Design tokens (colors, typography, spacing) |
| [Express](https://expressjs.com) | REST API server |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | SQLite database driver |
| [Zod](https://zod.dev) | API request validation |
| [Vitest](https://vitest.dev) | Unit and integration tests |
| [jsdom](https://github.com/jsdom/jsdom) | DOM environment for component tests |
| [ESLint v9](https://eslint.org) | Linting |

## Getting Started

**Requires Node.js 20.19 or later** (jsdom 29, used for component tests, does not support Node 18).

Two processes are required — the backend API and the frontend dev server:

```bash
npm install

# 1. Initialize the database (first time only; safe to re-run)
npm run db:init

# 2. Terminal 1 — backend API (port 3001)
npm run server:dev

# 3. Terminal 2 — frontend dev server (port 5173)
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies all `/api/*` requests to the backend automatically.

## Hosted Mode (Supabase Authentication)

Project Alice is local-first by default. A second, optional **hosted** mode adds Supabase email/password authentication with a small operator-managed allowlist, for cases where a single deployment needs to serve a handful of trusted users.

- **Local mode** (default): Express + SQLite on your machine. No external services. Single anonymous user. No auth.
- **Hosted mode**: Vite frontend on Vercel + Express API on Vercel Functions + Supabase for auth. Each verified user signs in to access the same shared dataset (per-user isolation is planned for feature 019).

### Required Environment Variables

| Variable | Scope | Secret? | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | server | no | Supabase project REST endpoint |
| `SUPABASE_ANON_KEY` | server | no | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | **yes** | Admin key; never expose to the frontend |
| `SUPABASE_JWT_SECRET` | **server only** | **yes** | Signing secret used by `requireAuth` to verify access tokens (HS256) |
| `VITE_SUPABASE_URL` | client/build | no | Same value as `SUPABASE_URL`, re-exported for the browser bundle |
| `VITE_SUPABASE_ANON_KEY` | client/build | no | Same value as `SUPABASE_ANON_KEY` |
| `VITE_AUTH_EMAIL_REDIRECT_URL` | client/build | no | Verification-callback URL Supabase sends in confirmation emails |

The two `*_SERVICE_ROLE_KEY` / `*_JWT_SECRET` variables must never be prefixed with `VITE_` — Vite would inline them into the public bundle. The build fails closed if any of the three `VITE_*` variables is missing in production.

### Allowlist Model

Hosted signups are gated by a Postgres trigger on `auth.users`. The trigger reads from an operator-managed `allowed_emails` table — an attempted signup with a non-allowlisted email is rejected before a row is ever created in `auth.users`, regardless of whether the request came through the in-app SignupForm or a direct Supabase API call from the browser. The frontend renders a neutral error and never leaks the rejection cause. Full operator install steps are in [specs/018-auth-user-access/quickstart.md](specs/018-auth-user-access/quickstart.md).

### Defense in Depth: Build + Runtime Handshake

Two independent checks guard against a hosted deployment with missing config:

1. **Build time** — `vite.config.js`'s `assertHostedFrontendEnv` plugin fails the production build if any `VITE_*` env var is missing.
2. **Runtime** — on boot, the frontend calls `/api/health`. If the API reports `runtime: 'hosted'` but the bundle has `isHostedAuthAvailable === false`, the app mounts `ConfigError` instead of the welcome page or app shell. A misconfigured deploy fails loud rather than silently broken.

## Available Scripts

| Script | Description |
|---|---|
| `npm run db:init` | Initialize (or re-initialize) the SQLite database |
| `npm run db:seed` | Clear the database and load 23 demo application records |
| `npm run db:clear` | Delete all application records from the database |
| `npm run db:seed:profile` | Populate the profile table with demo profile data |
| `npm run db:clear:profile` | Clear the profile table (resets to no-profile state) |
| `npm run server:dev` | Start backend API in watch mode (nodemon, port 3001) |
| `npm run server:start` | Start backend API without watch mode |
| `npm run dev` | Start frontend development server (port 5173) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once (CI mode) |
| `npm run test:ci` | Run tests once and write JUnit results to `test-results/vitest/` |
| `npm run lint` | Lint `src/`, `tests/`, `server/`, and `shared/` |

## Demo Data

Two scripts are provided for demos and local development:

```bash
# Load 23 pre-written records (clears any existing data first)
npm run db:seed

# Remove all records without touching the schema
npm run db:clear
```

`db:seed` inserts 23 realistic applications covering every status — Wishlist, Applied, Phone Screen, Interview, Technical Assessment, Offer, Rejected, Withdrawn, and Ghosted — plus one archived record. Records have varied dates, compatibility scores, notes, skills, and salary ranges so the UI renders a representative view.

`db:clear` is a hard delete of all rows. The schema (tables and indexes) is left intact, so the server keeps running and `db:seed` can be run again without `db:init`.

`db:seed:profile` writes a single demo profile (Alex Rivera) with experience, education, skills, languages, certifications, awards, and links. Run it to see the Profile page fully populated.

`db:clear:profile` removes the profile row, returning the Profile page to its empty state.

**Typical demo flow:**

```bash
npm run db:init              # first time only
npm run db:seed              # load demo applications
npm run db:seed:profile      # load demo profile
npm run server:dev           # terminal 1
npm run dev                  # terminal 2 — open http://localhost:5173
# ... demo ...
npm run db:clear             # reset applications
npm run db:clear:profile     # reset profile
```

## Continuous Integration

GitHub Actions runs Node.js CI on every push to `main` and every pull request targeting `main`. The workflow tests Node.js 20.x and 22.x, then runs install, lint, build, and CI test-result generation.

Local runtime logs and generated test reports belong under ignored output folders:

- `logs/`
- `test-results/`

## Project Structure

```
shared/
  constants.js    # STATUS_VALUES — shared by frontend and backend
server/
  index.js        # Express app factory and entry point
  db.js           # Database connection and schema initializer
  db-init.js      # Standalone init script (npm run db:init)
  db-seed.js      # Demo application records (npm run db:seed)
  db-seed-profile.js   # Demo profile data (npm run db:seed:profile)
  db-clear-profile.js  # Clear profile table (npm run db:clear:profile)
  db/
    applications.js  # SQL queries — applications repository
    profile.js       # SQL queries — profile repository (UPSERT)
  routes/
    applications.js  # Route handlers — applications
    profile.js       # Route handlers — profile
  validation/
    application.js   # Zod schemas
data/
  alice.db        # SQLite database file (git-ignored)
src/
  assets/         # Static assets (logo images)
  components/     # Reusable UI components (cards, modals, badges, toolbar, pagination, footer, charts)
  pages/          # Page-level components (Tracker, Calendar, Profile, ProfileEdit)
  services/
    api.js        # fetch-based API client
  models/         # Application and profile models, client-side validation
  styles/         # Global styles and design tokens
  utils/          # Pure utility functions (pagination, date, validation, sort, URL helpers)
specs/            # Specification, plan, and task documents per feature branch
tests/
  server/         # Backend integration tests
  services/       # Frontend service tests
  models/         # Model and validation tests
  data/           # Legacy store tests
  utils/          # Utility function tests
  components/     # Component DOM tests (jsdom)
  pages/          # Page-level DOM tests (jsdom)
```

## Versioning

This project follows [Semantic Versioning](https://semver.org) (`MAJOR.MINOR.PATCH`).

- **MAJOR** — breaking changes to data format or storage schema
- **MINOR** — new user-facing features, backwards-compatible
- **PATCH** — bug fixes and minor polish

The authoritative version is in [package.json](package.json). See [CHANGELOG.md](CHANGELOG.md) for the full history.

Current version: **0.8.0** — see [CHANGELOG.md](CHANGELOG.md)

## Development Workflow

This project uses the [Specify](https://github.com/anthropics/claude-code) specification-driven workflow. Features are developed on numbered branches (`###-feature-name`) following a spec → plan → tasks → implement → checklist cycle. See [CLAUDE.md](CLAUDE.md) for details.

### Local AI Orchestration

A two-agent pipeline automates the full feature lifecycle via `scripts/ai-flow.ps1`. Claude owns specification and review; Codex owns requirements validation and implementation. Hard gates block forward progress at each stage.

```powershell
# Full pipeline for a new feature
./scripts/ai-flow.ps1 spec <feature> <brief-path> [-DesignDoc <path>]
./scripts/ai-flow.ps1 req-review <feature>
./scripts/ai-flow.ps1 implement <feature>
./scripts/ai-flow.ps1 check-next <feature>
# ... repeat implement/check-next per phase ...
./scripts/ai-flow.ps1 create-pr <feature>
```

See [docs/AI_WORKFLOW_GUIDE.md](docs/AI_WORKFLOW_GUIDE.md) for the full reference including all actions, gate system, log locations, and FAQ.

For a quick map of where to find things in the codebase, see [docs/REPO_MAP.md](docs/REPO_MAP.md).

## Further Reading

- [docs/deployment.md](docs/deployment.md) — local + hosted deployment guide
- [docs/REPO_MAP.md](docs/REPO_MAP.md) — file/folder navigation map for AI-assisted work
- [docs/AI_WORKFLOW_GUIDE.md](docs/AI_WORKFLOW_GUIDE.md) — local two-agent AI pipeline reference
- [specs/018-auth-user-access/spec.md](specs/018-auth-user-access/spec.md) — hosted-auth feature specification
- [specs/018-auth-user-access/plan.md](specs/018-auth-user-access/plan.md) — architecture and implementation plan
- [specs/018-auth-user-access/quickstart.md](specs/018-auth-user-access/quickstart.md) — operator install steps for Supabase setup
- [specs/018-auth-user-access/data-model.md](specs/018-auth-user-access/data-model.md) — `allowed_emails` schema and trigger contract
