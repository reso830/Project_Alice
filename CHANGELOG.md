# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/reso830/Project_Alice/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/reso830/Project_Alice/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/reso830/Project_Alice/releases/tag/v0.1.0
