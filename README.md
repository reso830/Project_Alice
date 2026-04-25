# Project Alice — Application Tracker

A local-first job application tracker built with vanilla JavaScript and Vite. Review applications, inspect details, update statuses, star priority leads, and copy saved job URLs.

## Features

- **Application cards** — surface company, role, status, date, and compatibility at a glance
- **Full detail view** — modal with all fields including salary, source URL, recruiter, and notes
- **Status workflow** — nine states (Wishlist → Applied → Phone Screen → Interview → Technical Assessment → Offer → Rejected → Withdrawn → Ghosted)
- **Quick actions** — change status, star applications, and copy saved URLs directly from the card list
- **Local-first storage** — all data lives in `localStorage`; no external services

## Tech Stack

| Tool | Purpose |
|---|---|
| [Vite](https://vite.dev) | Dev server and bundler |
| Vanilla JS (ES modules) | UI and business logic |
| CSS custom properties | Design tokens (colors, typography, spacing) |
| [Vitest](https://vitest.dev) | Unit tests |
| [ESLint v9](https://eslint.org) | Linting |

## Getting Started

```bash
npm install
npm run dev        # start dev server at http://localhost:5173
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once (CI mode) |
| `npm run test:ci` | Run tests once and write JUnit results to `test-results/vitest/` |
| `npm run lint` | Lint `src/` and `tests/` |

## Continuous Integration

GitHub Actions runs Node.js CI on every push to `main` and every pull request targeting `main`. The workflow tests Node.js 18.x, 20.x, and 22.x, then runs install, lint, build, and CI test-result generation.

Local runtime logs and generated test reports belong under ignored output folders:

- `logs/`
- `test-results/`

## Project Structure

```
src/
  components/     # Reusable UI components (cards, modals, badges, toolbar)
  pages/          # Page-level components (tracker, calendar, profile)
  data/           # Data store and localStorage adapter
  models/         # Application model and validation rules
  styles/         # Global styles and design tokens
specs/            # Specification, plan, and task documents per feature branch
tests/            # Unit tests
```

## Versioning

This project follows [Semantic Versioning](https://semver.org) (`MAJOR.MINOR.PATCH`).

- **MAJOR** — breaking changes to data format or storage schema
- **MINOR** — new user-facing features, backwards-compatible
- **PATCH** — bug fixes and minor polish

The authoritative version is in [package.json](package.json). See [CHANGELOG.md](CHANGELOG.md) for the full history.

Current version: **0.1.0**

## Development Workflow

This project uses the [Specify](https://github.com/anthropics/claude-code) specification-driven workflow. Features are developed on numbered branches (`###-feature-name`) following a spec → plan → tasks → implement → checklist cycle. See [CLAUDE.md](CLAUDE.md) for details.
