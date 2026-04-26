# Implementation Plan: Pagination & Footer UI

**Branch**: `005-pagination-footer` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-pagination-footer/spec.md`

## Summary

Add client-side pagination to the application list (visible only when total records exceed 10) and a persistent site footer across all pages. The pagination algorithm is implemented as a pure utility function isolated from rendering. Both components are built in the existing vanilla JavaScript component pattern. The only dependency change is dev-only `jsdom` for DOM component tests. The footer mounts once at the app-shell level; pagination state lives in the Tracker module alongside the existing application list state.

---

## Technical Context

**Language/Version**: JavaScript (ES2022 modules)
**Primary Dependencies**: Vite 5.4 (build), Vitest 1.6 (tests), ESLint 9 (lint); add `jsdom` as a dev-only test dependency
**Storage**: N/A — purely a display feature; the Express/SQLite backend is unchanged
**Testing**: Vitest 1.6 — `npm run test:run` / `npm run test:ci`
**Target Platform**: Desktop and mobile browsers (evergreen)
**Project Type**: Vanilla JS SPA — manual DOM construction, no framework
**Performance Goals**: Page transitions are synchronous DOM operations; sub-16ms render budget
**Constraints**: No new production npm dependencies (jsdom added as dev-only test dependency); no backend changes; styling must extend existing CSS custom-property tokens; no mutation of the fetched applications array
**Scale/Scope**: Tracker page with one list view; pagination applies when list length exceeds 10

---

## Constitution Check

*GATE: Must pass before proceeding to design. Re-checked after Phase 1.*

| Principle | Assessment |
|---|---|
| Required fields preserved | ✅ — pagination is display-only; no data reads or writes |
| Business logic separated from UI | ✅ — pagination algorithm is a pure function in `utils/`; component only renders |
| Validation rules centralized | ✅ — no validation changes; existing rules untouched |
| Add / edit / search / filter / review workflows | ✅ — pagination integrates with the existing application list; no workflow removed |
| Automated tests for core logic | ✅ — `getPaginationModel` unit tests planned; visibility + navigation UI tests planned |
| Privacy: no external data sharing | ✅ — no analytics, no external calls |
| Desktop + mobile responsive, keyboard nav, non-color status | ✅ — responsive footer layout, semantic `<button>` elements, `aria-label` + `aria-current`, and focus movement to the list region after page changes |
| Data model extensibility not overbuilt | ✅ — no data model changes |

**Verdict**: All gates pass. No violations to justify.

---

## Project Structure

### Documentation (this feature)

```text
specs/005-pagination-footer/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — not created here)
```

### Source Code Changes

```text
src/
├── components/
│   ├── Footer.js         ← NEW: persistent footer component
│   └── Pagination.js     ← NEW: page navigation component
├── pages/
│   └── Tracker.js        ← MODIFIED: add _currentPage state, renderPage(), invalid-page clamp logic, focus management
├── styles/
│   └── main.css          ← MODIFIED: pagination + footer styles appended
├── utils/
│   └── pagination.js     ← NEW: getPaginationModel() pure function
└── main.js               ← MODIFIED: mount Footer to document.body

tests/
└── utils/
    └── pagination.test.js  ← NEW: unit tests for getPaginationModel()
```

**Structure Decision**: Option 2 (web application) applies — but this project uses a flat `src/` layout rather than separate `frontend/` and `backend/` directories. The existing structure is preserved and extended. No new directories are introduced beyond the existing `src/utils/`, `src/components/`, and `tests/utils/`.

---

## Complexity Tracking

> No Constitution Check violations. This section is intentionally empty.
