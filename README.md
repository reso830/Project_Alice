# Project Alice — Application Tracker

A local-first job application tracker built with vanilla JavaScript, Vite, and a SQLite-backed Express API. Review applications, inspect details, update statuses, star priority leads, copy saved job URLs, and archive records.

## Features

- **Application tracking** — cards surfacing company, role, status, date, and compatibility; a full detail view (job title, salary, source URL, recruiter, location, shift, work setup, skills, notes) with inline click-to-edit
- **Desktop master-detail workspace** — at ≥ 1100px the list sits beside a docked detail pane instead of a modal; tablet keeps the centered modal, mobile uses a bottom sheet
- **Status workflow** — ten states (Wishlist → Applied → Phone Screen → Interview → Technical Assessment → Offer → Accepted / Rejected / Withdrawn / Ghosted)
- **Compatibility scoring** — a deterministic, explainable 0–100 score and Low/Medium/High/Great band computed locally from your profile vs. the job (no AI, no network), with a Compatibility Insights Panel (skill proficiency chips, optional AI-generated notes)
- **Filtering, sorting & pagination** — filter by status, salary, compatibility, company, favorites, shift, work setup, and location; sort by several fields; state persists across reloads
- **Application Timeline & Calendar** — a chronological activity log with reminders, plus a month-grid Calendar with rule-based Suggested Actions (follow-up, feedback, ghost-flag, offer-expiry)
- **Archive view** — toggle active/archived applications; archived records are read-only and excluded from active workflow surfaces
- **Profile page** — stats dashboard, graded skill-proficiency meters, and a guided Setup/Import flow (Smart or Manual entry)
- **AI resume & job-description parsing (BYOK)** — optional browser-direct OpenRouter parsing configured per-user in Settings; Alice's server never receives the key, and manual entry always remains available
- **Portable Windows package** — run Alice with no Node.js install, no clone, and no terminal; self-updates in place while preserving your data
- **Loading & async states** — every fetch/mutation shows explicit busy, error, and empty states with accessible messaging
- **Local / hosted / demo runtime modes** — local-first by default (SQLite via Express); optional hosted multi-user mode (Supabase, Row Level Security); a no-signup demo mode with seeded, in-memory-only data
- **Delete Profile & User Data** — hosted users can permanently delete their account; local users can clear all stored data behind a typed-`DELETE` gate
- **Hosted password management** — change your password from Settings, or reset a forgotten one via an emailed recovery link (non-enumerating "Forgot password?" request, dedicated expired-link state)

See [`docs/REPO_MAP.md`](docs/REPO_MAP.md#spec-packages) for the full per-feature spec index.

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

For local development on Windows, use the one-command launcher. It starts both
the backend API and the frontend dev server in one terminal. You can double-click
`Start-Alice-Dev.cmd` in File Explorer or run it from PowerShell/CMD:

```bash
npm install

# 1. Initialize the database (first time only; safe to re-run)
npm run db:init

# 2. Start Alice locally
.\Start-Alice-Dev.cmd
```

Open `http://localhost:5173`. The Vite dev server proxies all `/api/*` requests to the backend automatically.

The launcher keeps the frontend in local mode: it starts the Vite dev server with
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` cleared, so a stale `.env.local`
can't push the UI into hosted-auth mode against your local backend. Your
`.env.local` is left untouched on disk. To run the full hosted stack locally
instead, use `npm run server:dev:hosted` alongside `npm run dev`.

To stop Alice, press Ctrl+C in the launcher terminal or close the window. The
launcher stops both the backend and frontend processes.

You can still run the two processes manually when you need separate terminals:

```bash
npm run alice      # npm alias for Start-Alice-Dev.cmd
npm run server:dev
npm run dev
```

## Run the Portable Package (Windows)

End users don't need any of the above. Download `alice-v<version>-win-x64.zip`
from GitHub Releases, extract it anywhere, and double-click
**`Start-Alice.cmd`** — a bundled Node runtime starts the server on
`127.0.0.1` and opens your browser automatically. No installer, no clone, no
terminal. Data lives in `data\alice.db` and settings in
`config\settings.json`, both surviving updates; Alice is reachable only from
this PC and self-updates in place via GitHub Releases.

**Build the portable package (maintainers):** run `npm run build:portable`
on Windows — see
[`specs/040-portable-distribution-package/quickstart.md`](specs/040-portable-distribution-package/quickstart.md)
for the full build/release process.

## Hosted Mode (Supabase Authentication)

Project Alice is local-first by default. The app supports three runtime modes:

- **Local mode** (default): Express + SQLite on your machine. No external services. Single anonymous user. No auth.
- **Hosted mode**: Vite frontend on Vercel + Express API on Vercel Functions + Supabase for auth and persistence. Each verified user signs in to their own per-user dataset, enforced server-side and via Supabase Row Level Security.
- **Demo mode**: client-side preview enabled by default in hosted deployments — seeded data, no sign-in, no persistence, no network calls.

For the full operator-facing guide — required environment variables, the allowlist model, the build/runtime config-check handshake, Supabase project setup, free-tier expectations, and pre-promotion verification — see [docs/deployment.md](docs/deployment.md).

## Available Scripts

| Script | Description |
|---|---|
| `npm run db:init` | Initialize (or re-initialize) the SQLite database |
| `npm run db:seed` | Clear the database and load 23 demo application records |
| `npm run db:seed:demo` | Load demo applications, then seed the demo profile and recompute compatibility scores |
| `npm run db:clear` | Delete all application records from the database |
| `npm run db:seed:profile` | Populate the profile table with demo profile data |
| `npm run db:clear:profile` | Clear the profile table (resets to no-profile state) |
| `npm run alice` | Start local Alice dev mode in one terminal (backend + frontend) |
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

`db:seed:demo` (recommended) inserts 23 realistic applications across every
status plus one archived record, saves a demo profile (Alex Rivera), and
recomputes compatibility scores. `db:clear` / `db:clear:profile` reset
applications and profile respectively without touching the schema — see the
[Available Scripts](#available-scripts) table above for each script.

**Typical demo flow:**

```bash
npm run db:init              # first time only
npm run db:seed:demo         # load demo applications, profile, and scores
npm run alice                # start backend + frontend — open http://localhost:5173
# ... demo ...
npm run db:clear             # reset applications
npm run db:clear:profile     # reset profile
```

## Continuous Integration

GitHub Actions runs Node.js CI on every push to `main` and every pull request targeting `main`. The workflow tests Node.js 20.x and 22.x, running install, lint, build, and `npm run test:ci` (which writes JUnit output to `test-results/vitest/results.xml`, uploaded as an artifact for each matrix job).

Local runtime logs and generated test reports belong under ignored output folders: `logs/`, `test-results/`.

## Project Structure

`shared/` (constants shared by frontend and backend) · `server/` (Express API,
db, routes, validation) · `src/` (components, pages, services, models,
styles, utils) · `docs/` (design notes, feature briefs) · `specs/`
(per-feature spec packages) · `tests/` (mirrors `src/`/`server/`).

For a full file/folder navigation map, see [docs/REPO_MAP.md](docs/REPO_MAP.md).

## Versioning

This project follows [Semantic Versioning](https://semver.org) (`MAJOR.MINOR.PATCH`).

- **MAJOR** — breaking changes to data format or storage schema
- **MINOR** — new user-facing features, backwards-compatible
- **PATCH** — bug fixes and minor polish

The authoritative version is in [package.json](package.json). See [CHANGELOG.md](CHANGELOG.md) for the full history.

Current version: **1.14.0** — see [CHANGELOG.md](CHANGELOG.md)

## Development Workflow

This project uses the [Specify](https://github.com/anthropics/claude-code) specification-driven workflow. Features are developed on numbered branches (`###-feature-name`) following a spec → plan → tasks → implement → checklist cycle. See [CLAUDE.md](CLAUDE.md) for details.

For a quick map of where to find things in the codebase, see [docs/REPO_MAP.md](docs/REPO_MAP.md).

## Further Reading

- [docs/deployment.md](docs/deployment.md) — local + hosted deployment guide
- [docs/hosted-smoke-test.md](docs/hosted-smoke-test.md) — pre-promotion hosted smoke-test checklist (Given/When/Then; runs after a hosted deploy before promoting to production)
- [docs/REPO_MAP.md](docs/REPO_MAP.md) — file/folder navigation map for AI-assisted work, including a **Spec Packages** index of every feature's `specs/###-…/` package (the per-feature spec links used to live here — they're consolidated there now)
- [docs/feature_roadmap.md](docs/feature_roadmap.md) — product roadmap, version themes, and feature status
- [docs/features/](docs/features/) — feature briefs that seed Speckit specs, organized by roadmap phase
- [docs/design/](docs/design/) — visual and UX design notes; per-screen design specs:
  - [application_timeline.md](docs/design/application_timeline.md) · [calendar.md](docs/design/calendar.md) · [loading.md](docs/design/loading.md) · [profile_page.md](docs/design/profile_page.md) (incl. skill proficiency §4.4 / §5)
