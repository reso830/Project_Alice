# Implementation Plan: Responsive Job Application Tracker Web App

**Branch**: `001-app-tracker-ui` | **Date**: 2026-04-25 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-app-tracker-ui/spec.md`

## Summary

Build a responsive, single-page web application that displays a user's job applications as interactive card rows. The primary interaction surface is the Tracker page: a card list ordered by ID, with a detail modal for full field view, inline status change, star/copy quick actions, and a responsive layout that adapts from desktop to mobile. Calendar and Profile are stub pages. All data is stored locally in the browser. No backend, no authentication, no external services.

## Technical Context

**Language/Version**: HTML5 / CSS3 / Vanilla JavaScript (ES2022 modules)  
**Primary Dependencies**: Vite 5.x (dev server + bundler), Vitest 1.x (unit testing), ESLint (lint)  
**Storage**: `localStorage` — JSON-serialised array of application records  
**Testing**: Vitest — unit tests for model validation, default logic, and date utilities  
**Target Platform**: Modern desktop and mobile browsers (Chrome, Firefox, Safari — current versions)  
**Project Type**: Single-page web application (frontend only, no server)  
**Performance Goals**: Modal opens < 1 s; status change reflected < 1 s; toast appears < 500 ms  
**Constraints**: Offline-capable after initial load; no external network calls at runtime; no framework  
**Scale/Scope**: Single user; expected data volume < 500 application records; 3 pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Required fields: company, job title, status, last_status_update date | ✅ PASS | Constitution v1.0.1 updated to reflect `last_status_update` as the required date field. |
| Business logic separated from UI rendering | ✅ PLANNED | `models/` owns validation and defaults; `components/` owns DOM rendering; `data/store.js` owns state |
| Validation rules centralized and reusable | ✅ PLANNED | All validation in `models/application.js`, consumed by store and tests |
| Required field, URL, corruption risks addressed before saving | ✅ PLANNED | Validation gates every localStorage write; corrupt records degraded gracefully on read |
| Main workflows: add, edit, search, filter, stale, follow-up | ⚠️ PARTIAL | This feature scopes to read/view/quick-status only per spec. Add/edit/search/filter are explicitly deferred to future features. Not a violation for this plan. |
| Automated tests for validation, status, date behavior | ✅ PLANNED | Vitest unit tests for `application.js` model and `date.js` utility |
| Lint/format commands identified | ✅ PLANNED | ESLint for JS; no separate formatter (Vite default) |
| Privacy: local-first, no analytics or external sharing | ✅ CONFIRMED | `localStorage` only; no external calls at runtime |
| Desktop/mobile responsiveness, non-color status, keyboard nav | ✅ CONFIRMED | Three responsive breakpoints per spec; badge label text always visible; tab-focusable action buttons |
| Data model preserves extensibility without overbuilding | ✅ PLANNED | Optional fields (recruiter, URL, salary, skills, compat) structured for future extension; no premature schema |

## Project Structure

### Documentation (this feature)

```text
specs/001-app-tracker-ui/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── storage-schema.md
│   └── ui-components.md
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (repository root)

```text
/ (project root)
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js                      ← app entry point, router init, seed data
│   ├── styles/
│   │   └── main.css                 ← design tokens, global styles, responsive breakpoints
│   ├── data/
│   │   └── store.js                 ← in-memory state, localStorage read/write, reactive updates
│   ├── models/
│   │   └── application.js           ← entity schema, validation, defaults, status enum
│   ├── components/
│   │   ├── Navbar.js                ← top bar, navigation, active state
│   │   ├── Toolbar.js               ← count badge, filter controls (future)
│   │   ├── Card.js                  ← card row, 3-row layout, quick actions
│   │   ├── CompatBar.js             ← compatibility score bar
│   │   ├── Modal.js                 ← detail/edit modal shell, scroll lock, backdrop
│   │   ├── StatusDropdown.js        ← inline status picker, viewport repositioning
│   │   └── Toast.js                 ← success/failure notifications, auto-dismiss
│   ├── pages/
│   │   ├── Tracker.js               ← card list, empty state, scroll position management
│   │   ├── Calendar.js              ← stub: month grid with status update dates
│   │   └── Profile.js               ← stub: stat cards (total, active, offers, rejections)
│   └── utils/
│       └── date.js                  ← ISO date formatting, display formatting ("Apr 25")
└── tests/
    ├── models/
    │   └── application.test.js      ← validation rules, defaults, status transitions
    └── utils/
        └── date.test.js             ← date formatting, edge cases
```

**Structure Decision**: Single web application (Option 1 variant). No backend. `src/` contains all runtime code divided into models (logic), data (state), components (DOM), pages (page-level composition), and utils (pure helpers). Tests mirror the `src/` tree under `tests/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
*No violations — constitution amended to v1.0.1 to reflect last_status_update as the required date field.*
