# Quickstart: Application Tracker UX & Data Refinement Pack

**Branch**: `010-tracker-ux-refinement`

## Prerequisites

- Node.js ≥ 20.19.0
- npm

## Setup

```bash
git checkout 010-tracker-ux-refinement
npm install
```

## Development

```bash
npm run dev
```

Opens the Vite dev server (frontend) with the Express backend. Visit the URL Vite reports (typically `http://localhost:5173`).

## Seed Data

To reset the database with the improved seed records (numeric salary, varied job descriptions):

```bash
node server/db-seed.js
```

## Testing

```bash
npm run test:run   # Single run (all tests)
npm test           # Watch mode
npm run test:ci    # CI mode with JUnit XML output
```

## Key Files for This Feature

| Area | File |
|---|---|
| Status colors | `src/models/application.js` — `STATUS_CONFIG` |
| Shared status constants | `shared/constants.js` — `STATUS_COLORS` |
| Salary formatter | `src/utils/currency.js` — `formatPeso()` *(new)* |
| Filter logic + favorites | `src/utils/filterSort.js` |
| Filter persistence + FAB | `src/pages/Tracker.js` |
| Overlay quick actions | `src/components/Modal.js` |
| Application cards | `src/components/Card.js` |
| Toast (with undo) | `src/components/Toast.js` |
| Slider label fix | `src/components/RangeSlider.js` |
| Mobile layout + FAB styles | `src/styles/main.css` |
| Seed data | `server/db-seed.js` |
| Currency tests | `tests/utils/currency.test.js` *(new)* |
| Filter tests | `tests/utils/filterSort.test.js` |
| Model tests | `tests/models/application.test.js` |
