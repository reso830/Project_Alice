# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] — 2026-04-28

### Added
- Profile page — welcome header personalised with first name, application stats (total, active, pending, offer) with an interactive donut chart and collapsible legend, and a full profile card with collapsible subsections (Summary, Experience, Education, Skills, Languages, Certifications, Awards, Links)
- Profile edit page — section-by-section editing; each card saves independently using a read-merge-write pattern so unedited fields are never overwritten
- `GET /api/profile` and `PUT /api/profile` — SQLite-backed profile persistence; profile stored as a single JSON record
- `server/db/profile.js` — profile repository with UPSERT logic
- `server/routes/profile.js` — `createProfileRouter()` factory matching the existing applications router pattern
- `src/models/profile.js` — `validateProfile`, `normaliseProfile`, `computeAppCounts`, `computeStats`, `STATUS_COLORS`, `STATUS_LABELS`
- `src/components/DonutChart.js` — SVG donut chart with per-segment hover tooltips; Largest Remainder Method for exact integer percentages; degenerate 100% case handled as two arcs to avoid invalid SVG paths
- `src/components/StackedBar.js` — horizontal proportional bar with tap-to-label interaction for mobile
- Responsive chart layout — desktop shows donut + legend, mobile shows stacked bar + tap labels; both always in DOM, toggled via CSS `@media`
- Collapsible profile subsections — expanded on desktop, collapsible on mobile via `.is-collapsed` class toggle
- XSS-safe external link rendering — only `http:`/`https:` hrefs are passed through; `javascript:` and all other schemes fall back to `#`
- `npm run db:seed:profile` — populate the profile table with demo data
- `npm run db:clear:profile` — clear the profile table (returns the profile page to the no-profile state)
- Server integration tests for the profile API (`tests/server/profile.test.js`)
- Page-level tests for the Profile page (`tests/pages/Profile.test.js`)
- Component tests for DonutChart (`tests/components/DonutChart.test.js`)

## [0.3.0] — 2026-04-26

### Added
- Client-side pagination on the application list — visible only when total records exceed 10; 3-page sliding window with first/last anchors and non-clickable ellipsis separators
- Persistent site footer on every page — brand identity, version info, tech stack credits, and feedback links (GitHub Issues)
- `src/utils/pagination.js` — `getPaginationModel()` pure function encapsulating the windowing algorithm
- `src/components/Pagination.js` — page navigation component with full ARIA labelling (`aria-label`, `aria-current="page"`)
- `src/components/Footer.js` — footer component with inline brand SVG, version/stack sections, and feedback links
- `src/assets/` — project logo files (`Alice_White.png`, `Alice_Colored.png`); white variant used in header and footer
- `jsdom` dev dependency for component-level DOM tests
- Page-change behaviour: scrolls to top and moves keyboard focus to the list region
- Page preservation on dataset change: current page retained when still valid; clamped to highest valid page when invalid; reset to 1 when pagination disappears
- Component tests for Pagination and Footer (`tests/components/`)
- `npm run db:seed` — loads 23 demo records covering all 9 statuses (one archived); clears existing data first
- `npm run db:clear` — deletes all rows without touching the schema

### Changed
- Footer and navbar now use `Alice_White.png` logo instead of placeholder SVG/div icons
- Sticky footer layout: `body` uses flex column with `min-height: 100%`; `#app` takes `flex: 1` to push footer to viewport bottom on short pages
- Footer reflows to 2-column grid on viewports narrower than 640 px

## [0.2.0] — 2026-04-26

### Added
- SQLite-backed Express REST API (`server/`) replacing `localStorage` as the persistence layer
- `POST /api/applications` — create an application with full validation (Zod)
- `GET /api/applications` — list all non-archived applications
- `GET /api/applications/:id` — fetch a single application (archived records included)
- `PATCH /api/applications/:id` — partial update with status-change tracking (`lastStatusUpdate` bumped only on actual status change)
- `POST /api/applications/:id/archive` — soft-delete via `archived` flag
- `GET /api/health` — liveness probe
- Shared `STATUS_VALUES` constant (`shared/constants.js`) imported by both frontend and backend
- `src/services/api.js` — fetch-based API client with typed error envelopes (`NETWORK_ERROR`, `VALIDATION_ERROR`, `NOT_FOUND`)
- `npm run db:init` script to initialize or re-initialize the SQLite schema
- `npm run server:dev` / `npm run server:start` scripts
- Integration test suite for all API endpoints (`tests/server/applications.test.js`)
- `makeMemoryDb()` and `makeTestDb()` test helpers for isolated SQLite databases
- GitHub Actions Node.js CI workflow for pushes to `main` and pull requests targeting `main`
- CI test-result generation via `npm run test:ci`, with Vitest JUnit output written under `test-results/vitest/`
- Ignored output directories for local logs and generated test results

### Changed
- Frontend reads (`getAll`, `getById`) and writes (`create`, `update`, `archive`, `fav` toggle) now go through the API instead of `localStorage`
- `src/data/store.js` retained but marked `@deprecated` — no longer the active persistence layer
- Card and modal field references updated to match API names (`jobTitle`, `companyName`, `jobPostingUrl`, `lastStatusUpdate`)
- Lint script now covers `server/` and `shared/` in addition to `src/` and `tests/`
- All system date fields (`createdAt`, `updatedAt`, `lastStatusUpdate`) stored as `YYYY-MM-DD` (date-only)

## [0.1.0] — 2026-04-25

### Added
- Application tracker UI with card-based list view
- Nine-state status workflow (Wishlist, Applied, Phone Screen, Interview, Technical Assessment, Offer, Rejected, Withdrawn, Ghosted)
- Add and edit forms with required-field validation and URL checking
- Full detail modal with all application fields
- Search and status filter
- Compatibility bar (0–100% job match indicator)
- Quick actions per card: star, copy URL, status change, edit
- Local-first `localStorage` persistence
- Centralized data store (`src/data/`)
- Application model and validation rules (`src/models/application.js`)
- CSS design tokens for colors, typography, spacing, and responsive breakpoints
- Vitest test suite for core validation logic
- ESLint v9 configuration

[Unreleased]: https://github.com/reso830/Project_Alice/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/reso830/Project_Alice/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/reso830/Project_Alice/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/reso830/Project_Alice/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/reso830/Project_Alice/releases/tag/v0.1.0
