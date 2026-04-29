# Implementation Plan: Application Tracker UX & Data Refinement Pack

**Branch**: `010-tracker-ux-refinement` | **Date**: 2026-04-30 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/010-tracker-ux-refinement/spec.md`

## Summary

Ten focused UX, data, and interaction improvements to the Application Tracker: standardized salary display in Philippine Peso, a visually distinct pink color for the Wishlist status, a composable Favorites filter with local persistence, inline overlay quick actions (favorite / change status / archive with undo), click-to-copy job links, a mobile FAB, subheader/nav visual consistency, slider label overlap fixes, icon consistency, and improved seed data variety. All changes are additive or corrective — no core data model rewrite required.

## Technical Context

**Language/Version**: JavaScript (ES Modules), Node.js ≥ 20.19.0  
**Primary Dependencies**: Vite 8.0.10 (build/dev), Vitest 4.1.5 (test), Express (server), vanilla DOM (no UI framework)  
**Storage**: SQLite via Express API (primary); localStorage for filter state persistence only  
**Testing**: Vitest 4.1.5 — `npm run test:run` (single run) / `npm test` (watch)  
**Target Platform**: Desktop and mobile web browsers  
**Project Type**: Web application (vanilla JS frontend + Express backend)  
**Performance Goals**: Standard web responsiveness; no new performance constraints introduced  
**Constraints**: Local-first, no external services; mobile safe-area compliance; backward-compatible data changes  
**Scale/Scope**: Single user, ~20–50 application records

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ Application records retain required company name, job title, status, and last_status_update; salary changes are additive (numeric format) and backward-compatible. No required fields removed.
- ✅ Business logic remains separated: salary formatting utility goes in `src/utils/currency.js`, status-color mapping stays in `src/models/application.js`, favorites filter logic in `src/utils/filterSort.js`.
- ✅ Existing validation in `src/utils/validate.js` and `src/models/application.js` is preserved; no validation rules are removed or bypassed. URL validation for copy-link handles the absent-URL case explicitly.
- ✅ All key workflows (add, edit, search, filter, review, stale/follow-up) are maintained and enhanced; empty and error states already handled and not regressed.
- ✅ New behaviors (favorites filter, salary formatting, archive action with undo) will have automated test coverage in `tests/utils/`; existing tests must not regress.
- ✅ All changes are local-first; no analytics, external services, or data sharing introduced.
- ✅ Mobile UX improvements (FAB, single-row subheader), icon consistency (SVG replacing emoji), keyboard navigation, and non-color-only status indicators are explicitly addressed.
- ✅ Adding a `fav` boolean clarification and numeric `salary` field are minimal additive changes that preserve future extensibility.

**Constitution Check result: PASS — no violations.**

## Project Structure

### Documentation (this feature)

```text
specs/010-tracker-ux-refinement/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api-applications.md   # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── Card.js                    # [MODIFY] favorites icon (SVG), status pill color
│   ├── Modal.js                   # [MODIFY] status-colored header, quick actions, copy-link
│   ├── QuickFiltersToolbar.js     # [MODIFY] favorites toggle filter
│   ├── RangeSlider.js             # [MODIFY] label overlap fix
│   ├── Toast.js                   # [MODIFY] add optional undo callback support
│   ├── Navbar.js                  # [MODIFY] subheader elevation/style alignment
│   └── StatusDropdown.js          # [REVIEW] verify color rendering consistency
├── models/
│   └── application.js             # [MODIFY] STATUS_CONFIG wishlisted → pink; salary type
├── pages/
│   ├── Tracker.js                 # [MODIFY] filter state persistence, FAB (mobile)
│   └── ProfileEdit.js             # [MODIFY] subheader style alignment
├── styles/
│   └── main.css                   # [MODIFY] FAB, subheader, slider label fix, icon sizing
├── utils/
│   ├── currency.js                # [NEW] formatPeso() utility
│   ├── filterSort.js              # [MODIFY] favoritesOnly filter, salary bounds use numeric
│   └── validate.js                # [NO CHANGE]
└── main.js                        # [MODIFY] client-side seed data (fallback only)

shared/
└── constants.js                   # [MODIFY] STATUS_COLORS wishlisted → pink (sync with model)

server/
└── db-seed.js                     # [MODIFY] salary → integer, improved job descriptions

tests/
├── utils/
│   ├── currency.test.js           # [NEW] formatPeso() unit tests
│   └── filterSort.test.js         # [MODIFY] favoritesOnly filter tests
└── models/
    └── application.test.js        # [MODIFY] wishlisted color, salary type assertions
```

**Structure Decision**: Single web application. Frontend source lives under `src/`, backend under `server/`, shared constants under `shared/`. All new logic follows existing project patterns: utilities in `src/utils/`, model constants in `src/models/`, global styles in `src/styles/main.css`. No new directories required.

## Complexity Tracking

> No constitution violations found. This section is not applicable.
