# Project Alice — Application Tracker

A local-first job application tracker built with vanilla JavaScript, Vite, and a SQLite-backed Express API. Review applications, inspect details, update statuses, star priority leads, copy saved job URLs, and archive records.

## Features

- **Application cards** — surface company, role, status, date, and compatibility at a glance
- **Full detail view** — modal with all fields including salary, source URL, recruiter, and notes
- **Status workflow** — nine states (Wishlist → Applied → Phone Screen → Interview → Technical Assessment → Offer → Rejected → Withdrawn → Ghosted)
- **Quick actions** — change status, star applications, copy saved URLs, and archive directly from the card list
- **Pagination** — 3-page sliding window with first/last anchors; hidden when 10 or fewer records; page preserved across archives and reloads
- **Profile page** — personalised welcome, application stats with an interactive donut chart (desktop) and stacked bar (mobile), and a full profile card with collapsible subsections
- **Profile editing** — centralized editor with sticky Save/Cancel controls, dirty-state tracking, and discard confirmation; all six structured sections (Experience, Education, Certifications, Awards, Languages, Links) use modal/bottom-sheet overlays for Add and Edit with inline validation, focus trap, and discard guard; Skills use a staging overlay with deduplication; browser refresh guard warns on unsaved changes; navbar navigation intercepted when unsaved changes exist
- **Persistent footer** — brand identity, version info, tech stack credits, and feedback links on every page
- **SQLite persistence** — all data stored in a local SQLite database via a lightweight Express API; no external services

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

Current version: **0.5.1**

## Development Workflow

This project uses the [Specify](https://github.com/anthropics/claude-code) specification-driven workflow. Features are developed on numbered branches (`###-feature-name`) following a spec → plan → tasks → implement → checklist cycle. See [CLAUDE.md](CLAUDE.md) for details.
