# Quickstart: Responsive Job Application Tracker Web App

**Feature**: `001-app-tracker-ui`  
**Branch**: `001-app-tracker-ui`

---

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+

---

## Initial Setup

```bash
# From the project root
npm install
```

---

## Development

```bash
npm run dev
```

Opens a local dev server (default: `http://localhost:5173`) with hot module replacement. The app loads with seed data in `localStorage` if no existing data is found.

---

## Production Build

```bash
npm run build
# Output goes to dist/
```

The built output is a static site — open `dist/index.html` in any browser or serve with any static file server.

---

## Tests

```bash
npm run test
```

Runs Vitest in watch mode. Tests cover:
- `src/models/application.js` — validation rules, status coercion, default values, compat clamping
- `src/utils/date.js` — ISO date formatting, display formatting

```bash
npm run test:run
```

Single-pass test run (for CI or pre-commit).

---

## Lint

```bash
npm run lint
```

Runs ESLint over `src/` and `tests/`. Fix issues before marking any task complete.

---

## Reset App Data

Open browser DevTools → Application → Local Storage → delete the `apptracker_applications` key, then reload. The app will reinitialise with seed data.

---

## Project Scripts (package.json)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Dev server with HMR |
| `build` | `vite build` | Production bundle |
| `preview` | `vite preview` | Preview production build locally |
| `test` | `vitest` | Watch-mode unit tests |
| `test:run` | `vitest run` | Single-pass tests |
| `lint` | `eslint src tests` | Lint check |

---

## Seed Data

On first load (empty `localStorage`), `src/main.js` injects five sample `JobApplication` records with varied statuses, optional fields, and randomised compat scores. This allows the full card layout and modal to be exercised immediately without manually adding data.
