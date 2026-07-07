# Project Alice — Application Tracker

A local-first job application tracker built with vanilla JavaScript, Vite, and a SQLite-backed Express API. Review applications, inspect details, update statuses, star priority leads, copy saved job URLs, and archive records.

## Features

- **Application cards** — surface company, role, status, date, and compatibility at a glance
- **Loading & async states** — every list fetch shows a skeleton placeholder; every mutation button (Save, Archive, Unarchive, Star, Status, Process, Upload) shows a busy state and prevents duplicate submissions; failed list loads recover via an inline `Try again` block with screen-reader-announced messaging. See [docs/design/loading.md](docs/design/loading.md).
- **Archive Applications view** — a Tracker toolbar chip toggles between active and archived rows (deep-linkable via `?view=archived`); archived cards open a read-only overlay with a single ↺ Unarchive action; archived rows are excluded from every active workflow surface (Calendar suggestions, Action Panel sections, Profile stat tiles); a Profile entry point (`Archived applications · N →`) makes the view discoverable from anywhere
- **Inline edit modal** — click any field to edit it directly in the detail view; outside-click commits to draft; Esc reverts the field; Cmd/Ctrl+S saves; discard confirmation guard on close
- **Desktop master-detail workspace** — at ≥ 1100px the Tracker splits into the application list beside a docked detail pane: clicking a card selects it (indigo glow + `aria-selected`) and loads its details inline — no centered modal — while an empty "Nothing open yet" pane shows when nothing is selected. Switching with unsaved edits prompts the discard confirmation, and the selection persists across filtering, sorting, paging, and Active/Archived switches. Tablet (640–1099px) keeps the centered modal and mobile (< 640px) the bottom sheet. The Application Details body is organised into five collapsible panels — Overview → Skills → Compatibility → Timeline → Notes & Links — shared across all three surfaces. (039-desktop-workspace-refresh)
- **Create mode** — `+ New application` opens an empty draft; status defaults to Wishlisted; saving creates the record and switches to edit mode
- **Compatibility scoring** — each application shows a deterministic, explainable compatibility score (0–100) and a Low / Medium / High / Great band, computed locally from your profile vs. the job across weighted categories (skills weighted by 1–5 proficiency, role alignment, experience, keywords, certifications) — no AI, no network. Scores recompute when the application or your profile changes; archived records stay frozen. See [`specs/036-compatibility-engine/`](specs/036-compatibility-engine/). (036-compatibility-engine)
- **Compatibility Insights Panel** — the Application Edit Modal's compatibility section is a collapsible panel with a score ring, tier-coloured verdict pill, and profile-aware skill proficiency chips (Required Skills and Preferred Skills coded as Proficient / Learning / Missing against your profile with a legend). Optionally, AI-generated notes explain the score in prose with freshness states (none, fresh, stale, error); staleness triggers when compat-relevant fields or your profile change; non-compat edits (URL, General Notes, recruiter) do not trigger staleness. Generation is always user-initiated and AI failure never blocks the score or modal. See [`specs/037-compatibility-insights-panel/`](specs/037-compatibility-insights-panel/). (037-compatibility-insights-panel)
- **Full detail view** — modal with all application fields: job title, company, status, salary, compatibility panel, minimum years of experience, source URL, recruiter, location, shift, work setup, skills with proficiency coding, and general notes
- **Application Timeline** — detail overlays show a chronological Timeline with inline add, edit, delete, automatic status-change entries, and future-dated reminders
- **Calendar page** — month-grid view of all Timeline activity with an Action Panel showing Today events, rule-based Suggested Actions (follow-up, feedback, ghost-flag, offer-expiry), and Upcoming entries; status filter; day popovers; Mark Ghosted from suggestion rows
- **Status workflow** — ten states (Wishlist → Applied → Phone Screen → Interview → Technical Assessment → Offer → Accepted / Rejected / Withdrawn / Ghosted)
- **Quick filters & sort** — filter by Status, Salary range, Compatibility range, Company, Favorites, Shift, Work Setup, and Location; stack multiple filters with AND logic; sort by Job ID, Status, Compatibility, Salary, or Company; filter state persists across reloads
- **Quick actions** — change status, star applications, copy saved URLs, and archive directly from the card list
- **Pagination** — 3-page sliding window with first/last anchors; hidden when 10 or fewer records; page preserved across archives and reloads
- **Profile page** — personalised welcome, application stats with an interactive donut chart (desktop) and stacked bar (mobile), full profile card with collapsible subsections, an Archived Applications entry point, and a unified Settings card for AI and account controls; Skills render as graded 1-5 proficiency meters with an in-place level reveal, scale reference, sort, and collapse-past-10
- **Profile editing** — centralized editor with sticky Save/Cancel controls, dirty-state tracking, and discard confirmation; first-time users see a guided Setup and Import flow with Smart entry and Manual entry choices, while existing profiles get an Import Bar. Smart imports support paste/upload, ask-first AI-unavailable dialogs with reason codes, basic-parser fallback by explicit choice, AI-filled / Auto-filled provenance tags, Undo, and reduced-motion-safe highlighting; structured sections and Skills retain inline validation and keyboard-friendly overlays.
- **AI resume parsing (BYOK)** — optional browser-direct OpenRouter parsing is configured from the Profile page's unified Settings card: save a browser-local key, choose a model slug, and toggle CV/JD/compatibility AI features independently. Saving a key is the consent boundary; deleting it withdraws AI access. Alice's server never receives the key, no environment variables are required, and manual/profile-local paths remain available. See [`specs/034-profile-page-refresh/quickstart.md`](specs/034-profile-page-refresh/quickstart.md). (034-profile-page-refresh)
- **AI job-description parsing (BYOK)** — from the Add-application gate's Smart entry, paste a job posting and have an LLM (via OpenRouter) pre-fill a new application for review before saving. Gated by the master AI toggle plus the live Job-description parsing switch and a browser-local key; with AI off the Smart card is locked ("Enable AI in Settings →") and Manual entry remains. Recoverable failures offer a basic rule-based parser, an empty result ends in a clear dead-end, and pasted text is preserved across retries. Status is never parsed (stays Wishlisted) and no job text is persisted. See [`specs/035-llm-jd-parser/quickstart.md`](specs/035-llm-jd-parser/quickstart.md). (035-llm-jd-parser)
- **Portable Windows package** — run Alice with no Node.js install, no repository clone, and no terminal: download the release ZIP, extract it anywhere, and double-click `Start-Alice.cmd`. A bundled Node runtime serves the app on `127.0.0.1` (localhost-only) and opens your browser automatically; close the console window to stop. Your data lives in `data/alice.db` and your settings in `config/` — both preserved across launches and outside the replaceable program files. The same codebase still deploys to hosted (Vercel) unchanged. See [`specs/040-portable-distribution-package/quickstart.md`](specs/040-portable-distribution-package/quickstart.md). (040-portable-distribution-package)
- **Self-update (portable, Windows)** — a portable install keeps itself current: Alice checks GitHub Releases for a newer version, surfaces an update toast and a Profile nav badge, and (on confirm) downloads the release ZIP to a staging folder, verifies its SHA256, and applies it on restart via the launcher — replacing the program files while preserving `data/alice.db` and `config/`. A per-install lockfile guarantees a single instance across the stop → swap → restart sequence, and pending SQLite schema migrations run automatically (with a pre-migration backup that restores on failure). The Profile › Settings › **Updates** sub-group adds a manual check, an auto-check toggle, and an update-mode picker (Notify only / Ask before installing) — Notify only shows just the nav badge while Ask before installing surfaces the update toast (#85). Hosted (Vercel) updates via normal deploys, so the in-app updater is gated to local Windows installs. See [`specs/041-self-update-support/quickstart.md`](specs/041-self-update-support/quickstart.md). (041-self-update-support)
- **Persistent footer** — brand identity with inline version, a GitHub repo link plus feedback links, and license/legal links (Terms & Conditions, Privacy Policy) on every page, over a layered spotlight background. (043-legal-and-footer)
- **Terms & Conditions and Privacy Policy** — read-only legal document overlays reachable from the global footer, the Welcome page mini-footer, and the signup consent copy; centered modal on desktop/tablet, bottom sheet on mobile. Content is developer-drafted placeholder copy pending attorney review. See [`specs/043-legal-and-footer/`](specs/043-legal-and-footer/). (043-legal-and-footer)
- **SQLite persistence** — all data stored in a local SQLite database via a lightweight Express API; no external services
- **Hosted authenticated access** — optional Supabase-backed multi-user mode behind an operator-managed email allowlist (`specs/018-auth-user-access/`); local mode is unaffected and remains the default
- **Hosted persistence** — applications and profile data persist per-user in Supabase Postgres, scoped by Row Level Security. New hosted users see 2 seeded starter applications on first sign-in (empty profile by design). Operators apply the schema migration from `specs/019-supabase-persistence/data-model.md §5` before deploying hosted mode; see [docs/deployment.md](docs/deployment.md). Local SQLite mode is unaffected.
- **Portfolio demo mode** — public visitors can click **Try the demo** on the welcome page to preview the tracker and profile with 23 seeded sample applications and a fully populated persona; changes feel real but live in memory only and reset on browser refresh. No sign-in required, no data persisted, no network calls; always enabled in hosted deployments with no configuration (feature 020).
- **Delete Profile & User Data** — an **Account** section on the Profile page lets hosted users permanently delete their account (password-confirmed; the Supabase auth user is removed and `ON DELETE CASCADE` clears applications, profile, and the seed marker) and lets local users clear all stored data behind a typed-`DELETE` gate. The control is disabled with explanatory copy in demo mode; a stale session on another device revalidates and reroutes to Welcome after a deletion. See [`specs/030-delete-profile-data/`](specs/030-delete-profile-data/).

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

## Run the Portable Package (Windows)

End users don't need any of the above. The portable release is a self-contained
ZIP — no Node.js install, no clone, no terminal:

1. Download `alice-v<version>-win-x64.zip` from GitHub Releases.
2. Extract it anywhere (Desktop is fine). No installer, no admin rights.
3. Double-click **`Start-Alice.cmd`**. A console window opens, the bundled Node
   runtime starts the server on `127.0.0.1`, and your default browser opens to
   the app. (Windows may show a one-time SmartScreen prompt for the downloaded
   script — that's expected.)
4. To stop Alice, close the console window (or press Ctrl+C in it).

Your data is saved to `data\alice.db` and launch settings live in
`config\settings.json` (`port`, `openBrowser`) — both survive updates. AI
features are optional: paste your OpenRouter key in Settings (stored in your
browser, never on disk). Alice is reachable only from this PC; it is not exposed
to your network. Launching again while Alice is already running just re-opens
your browser to the existing instance — it never starts a second copy.

**Build the portable package (maintainers):** on Windows, run
`npm run build:portable`. This builds the frontend, bundles a pinned Node
runtime, assembles the standardized `alice/` layout, and emits
`alice-v<version>-win-x64.zip` plus a `.sha256` checksum under `portable-dist/`.
A tag/dispatch-only GitHub Actions workflow (`release-portable.yml`) attaches
those artifacts to the matching GitHub Release. See
[`specs/040-portable-distribution-package/quickstart.md`](specs/040-portable-distribution-package/quickstart.md).

## Hosted Mode (Supabase Authentication)

Project Alice is local-first by default. The app supports three runtime modes — local (default), hosted, and demo — each with its own purpose. For the full operator-facing deployment guide covering setup, env vars, Supabase configuration, free-tier expectations, and pre-promotion verification, see [docs/deployment.md](docs/deployment.md).

- **Local mode** (default): Express + SQLite on your machine. No external services. Single anonymous user. No auth.
- **Hosted mode**: Vite frontend on Vercel + Express API on Vercel Functions + Supabase for auth and persistence. Each verified user signs in to their own per-user dataset; ownership is enforced server-side via repository filters and database-side via Supabase Row Level Security (feature 019, v0.9.0+).
- **Demo mode**: client-side preview enabled by default in hosted deployments. Public visitors click **Try the demo** on the welcome page to explore the tracker with seeded data; changes feel real but live in memory only and reset on browser refresh (feature 020).

### Required Environment Variables

| Variable | Scope | Secret? | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | server | no | Supabase project REST endpoint; the middleware derives the JWKS endpoint (`<URL>/auth/v1/.well-known/jwks.json`) from this |
| `SUPABASE_ANON_KEY` | server | no | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | **yes** | Admin key; never expose to the frontend |
| `VITE_SUPABASE_URL` | client/build | no | Same value as `SUPABASE_URL`, re-exported for the browser bundle |
| `VITE_SUPABASE_ANON_KEY` | client/build | no | Same value as `SUPABASE_ANON_KEY` |
| `VITE_AUTH_EMAIL_REDIRECT_URL` | client/build | no | Verification-callback URL Supabase sends in confirmation emails |

The `*_SERVICE_ROLE_KEY` variable must never be prefixed with `VITE_` — Vite would inline it into the public bundle. The build fails closed if any of the three `VITE_*` variables is missing in production.

Access tokens are verified server-side via Supabase's JWKS endpoint using `jose`, accepting `ES256` and `RS256` (Supabase's modern asymmetric signing modes). There is no shared HS256 secret to manage — the middleware fetches the public key by `kid` from the JWKS endpoint on demand and caches it.

For a deployer-oriented variant of this table — required vs. optional, server-only vs. client-safe, secrets-handling rules, plus a copy-pasteable example — see the [Environment Variable Checklist in docs/deployment.md](docs/deployment.md#environment-variable-checklist).

### Allowlist Model

Hosted signups are gated by a Postgres trigger on `auth.users`. The trigger reads from an operator-managed `allowed_emails` table — an attempted signup with a non-allowlisted email is rejected before a row is ever created in `auth.users`, regardless of whether the request came through the in-app SignupForm or a direct Supabase API call from the browser. The frontend renders a neutral error and never leaks the rejection cause. Full operator install steps are in [specs/018-auth-user-access/quickstart.md](specs/018-auth-user-access/quickstart.md).

For a single consolidated Supabase Setup Checklist that walks project creation, schema migration (feature 019), allowlist install (feature 018), RLS policy verification, and the pre-deploy verification gate from a fresh Supabase project top-to-bottom, see the [Supabase Setup Checklist in docs/deployment.md](docs/deployment.md#supabase-setup-checklist).

### Defense in Depth: Build + Runtime Handshake

Two independent checks guard against a hosted deployment with missing config:

1. **Build time** — `vite.config.js`'s `assertHostedFrontendEnv` plugin fails the production build if any `VITE_*` env var is missing.
2. **Runtime** — on boot, the frontend calls `/api/health`. If the API reports `runtime: 'hosted'` but the bundle has `isHostedAuthAvailable === false`, the app mounts `ConfigError` instead of the welcome page or app shell. A misconfigured deploy fails loud rather than silently broken.

## Available Scripts

| Script | Description |
|---|---|
| `npm run db:init` | Initialize (or re-initialize) the SQLite database |
| `npm run db:seed` | Clear the database and load 23 demo application records |
| `npm run db:seed:demo` | Load demo applications, then seed the demo profile and recompute compatibility scores |
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
# Load scored demo applications and Alex Rivera's demo profile
npm run db:seed:demo

# Remove all records without touching the schema
npm run db:clear
```

`db:seed:demo` is the recommended local demo command. It runs `db:seed` followed by `db:seed:profile`, so the applications are inserted, Alex Rivera's demo profile is saved, and compatibility scores are recomputed from the deterministic engine.

`db:seed` inserts 23 realistic applications covering every status — Wishlist, Applied, Phone Screen, Interview, Technical Assessment, Offer, Accepted, Rejected, Withdrawn, and Ghosted — plus one archived record. It intentionally does not write compatibility scores directly; rows stay at the default score of `0` until `db:seed:profile` saves a profile and runs the compatibility backfill.

`db:clear` is a hard delete of all rows. The schema (tables and indexes) is left intact, so the server keeps running and `db:seed` can be run again without `db:init`.

`db:seed:profile` writes a single demo profile (Alex Rivera) with experience, education, skills, languages, certifications, awards, and links. Run it to see the Profile page fully populated.

`db:clear:profile` removes the profile row, returning the Profile page to its empty state.

**Typical demo flow:**

```bash
npm run db:init              # first time only
npm run db:seed:demo         # load demo applications, profile, and scores
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
docs/
  design/         # Visual design briefs and screen-level interaction notes
  features/       # Lightweight feature briefs used as Speckit inputs
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

Current version: **1.11.1** — see [CHANGELOG.md](CHANGELOG.md)

## Development Workflow

This project uses the [Specify](https://github.com/anthropics/claude-code) specification-driven workflow. Features are developed on numbered branches (`###-feature-name`) following a spec → plan → tasks → implement → checklist cycle. See [CLAUDE.md](CLAUDE.md) for details.

### Local AI Orchestration

A two-agent pipeline automates the full feature lifecycle via `scripts/ai-flow.ps1`. Claude owns specification and review; Codex owns requirements validation and implementation. Hard gates block forward progress at each stage.

This orchestration flow is still under test and should be treated as experimental until it has proven reliable across multiple full feature cycles.

```powershell
# Full pipeline for a new feature
./scripts/ai-flow.ps1 spec <feature> docs/features/<brief>.md [-DesignDoc docs/design/<design>.md]
./scripts/ai-flow.ps1 req-review <feature>
./scripts/ai-flow.ps1 implement <feature>
./scripts/ai-flow.ps1 check-next <feature>
# ... repeat implement/check-next per phase ...
./scripts/ai-flow.ps1 create-pr <feature>
```

CI runs `npm run test:ci`, writes JUnit output to `test-results/vitest/results.xml`, and uploads `test-results/` as a GitHub Actions artifact for each Node.js matrix job.

See [docs/AI_WORKFLOW_GUIDE.md](docs/AI_WORKFLOW_GUIDE.md) for the full reference including all actions, gate system, log locations, and FAQ.

For a quick map of where to find things in the codebase, see [docs/REPO_MAP.md](docs/REPO_MAP.md).

## Further Reading

- [docs/deployment.md](docs/deployment.md) — local + hosted deployment guide
- [docs/hosted-smoke-test.md](docs/hosted-smoke-test.md) — pre-promotion hosted smoke-test checklist (Given/When/Then; runs after a hosted deploy before promoting to production)
- [docs/REPO_MAP.md](docs/REPO_MAP.md) — file/folder navigation map for AI-assisted work, including a **Spec Packages** index of every feature's `specs/###-…/` package (the per-feature spec links used to live here — they're consolidated there now)
- [docs/feature_roadmap.md](docs/feature_roadmap.md) — product roadmap, version themes, and feature status
- [docs/AI_WORKFLOW_GUIDE.md](docs/AI_WORKFLOW_GUIDE.md) — local two-agent AI pipeline reference
- [docs/features/](docs/features/) — feature briefs that seed Speckit specs
- [docs/design/](docs/design/) — visual and UX design notes; per-screen design specs:
  - [application_timeline.md](docs/design/application_timeline.md) · [calendar.md](docs/design/calendar.md) · [loading.md](docs/design/loading.md) · [profile_page.md](docs/design/profile_page.md) (incl. skill proficiency §4.4 / §5)
