# Quickstart: Pagination & Footer UI

**Feature**: 005-pagination-footer | **Date**: 2026-04-26

---

## Prerequisites

```bash
# Install dependencies (if not already done)
npm install

# Initialize and seed the database (if not already done)
npm run db:init
npm run db:seed
```

---

## Development Workflow

Run the backend and frontend dev servers in two terminals:

```bash
# Terminal 1 — backend
npm run server:dev

# Terminal 2 — frontend
npm run dev
```

Open `http://localhost:5173` in a browser. To test pagination, seed enough records (>10) via the add form or `npm run db:seed`.

---

## Running Tests

```bash
# Single run (CI-style)
npm run test:run

# Watch mode
npm run test
```

The pagination unit tests live in `tests/utils/pagination.test.js`. They run in `node` environment (no DOM needed).

---

## Lint

```bash
npm run lint
```

ESLint covers `src/`, `tests/`, `server/`, and `shared/`.

---

## Key Files for This Feature

| File | Role |
|---|---|
| `src/utils/pagination.js` | Pure `getPaginationModel()` function — start here |
| `src/components/Pagination.js` | Pagination DOM component |
| `src/components/Footer.js` | Footer DOM component |
| `src/pages/Tracker.js` | Modified list container with pagination state |
| `src/main.js` | App shell — mounts footer once |
| `src/styles/main.css` | Global styles — pagination + footer sections appended at bottom |
| `tests/utils/pagination.test.js` | Unit tests for the windowing algorithm |
| `design/pagination_footer.md` | Source-of-truth design spec |

---

## Verifying Pagination Manually

1. Ensure more than 10 application records exist (use seed or add via UI)
2. Confirm pagination controls appear below the card list
3. Click page 2 — list should show records 11–20, view scrolls to top, and keyboard focus moves to the list region
4. Click page 1 — list should show records 1–10
5. Navigate to a middle page, then archive or filter records while that page is still valid — pagination should preserve the current page
6. Archive or filter enough records that the current page no longer exists — pagination should move to the highest valid page, or page 1 if pagination disappears

## Verifying Footer Manually

1. Open the app on desktop — confirm 3-column footer layout at bottom
2. Resize browser to < 640px — confirm footer reflows to 2-column layout
3. Click "Report an issue" and "Request a feature" — each link opens `https://github.com/reso830/Project_Alice/issues/new` in a new tab
4. Navigate between Tracker, Calendar, and Profile — footer must persist across all pages
