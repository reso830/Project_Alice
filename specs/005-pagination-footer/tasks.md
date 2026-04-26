# Tasks: Pagination & Footer UI

**Input**: Design documents from `/specs/005-pagination-footer/`
**Branch**: `005-pagination-footer`
**Prerequisites**: plan.md ✓ | spec.md ✓ | research.md ✓ | data-model.md ✓

**Tests**: Unit tests for `getPaginationModel()` are required (core logic). Component tests for Pagination and Footer use jsdom (T003 installs it). All tests run via `npm run test:run`.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: User story this task belongs to (US1 / US2 / US3)

---

## Phase 1: Setup

**Purpose**: Confirm working environment and scope.

- [ ] T001 Confirm active branch is `005-pagination-footer`; review `specs/005-pagination-footer/plan.md` file change map and confirm no files in `server/` or `shared/` are in scope

**Checkpoint**: Scope confirmed. Ready to begin.

---

## Phase 2: Foundation — Pagination Model

**Purpose**: Install test tooling, implement and fully test the pagination algorithm. Blocks Phase 3.

**⚠️ CRITICAL**: Phase 3 cannot begin until T006 passes.

- [ ] T002 Create `src/utils/pagination.js` — export `PAGE_SIZE = 10` constant and stub `getPaginationModel(currentPage, totalEntries, pageSize)` returning `{ pagesToRender: [], totalPages: 0, hasPagination: false }`
- [ ] T003 [P] Install jsdom as a dev-only dependency: `npm install -D jsdom`; add `// @vitest-environment jsdom` as the first line of any component test file that needs DOM access — no changes to `vite.config.js` needed
- [ ] T004 Create `tests/utils/pagination.test.js` — write unit tests for `getPaginationModel()` covering: (a) all 7 windowing examples from `design/pagination_footer.md` § 1.4 (pages 1, 2, 3, 4, 5, 9, 10 on a 10-page set); (b) `totalEntries = 10` → `hasPagination: false`; (c) `totalEntries = 11` → `hasPagination: true, totalPages: 2`, page 1 renders `[1, 2]`, page 2 renders `[1, 2]`; (d) `totalPages = 3`, page 2 renders `[1, 2, 3]` (no ellipsis); (e) `currentPage = 0` or `currentPage > totalPages` → clamps gracefully without rendering non-existent pages; run `npm run test:run` and confirm all tests **fail**
- [ ] T005 Implement `getPaginationModel` in `src/utils/pagination.js`: compute `totalPages = Math.ceil(totalEntries / pageSize)`, `hasPagination = totalEntries > pageSize`; return early if `!hasPagination`; compute `winStart = Math.max(1, Math.min(currentPage - 1, totalPages - 2))`, `winEnd = winStart + 2`; when building window pages, iterate from `winStart` to `Math.min(winEnd, totalPages)` — **never render a page number that exceeds totalPages**; apply first/last page and ellipsis rules from design spec § 1.4
- [ ] T006 Run `npm run test:run` — all tests in `tests/utils/pagination.test.js` must pass; fix any failures before proceeding to Phase 3

**Checkpoint**: Pagination algorithm correct and fully tested. Phase 3 may begin.

---

## Phase 3: User Story 1 — Navigate Large Application Lists via Pagination (P1) 🎯 MVP

**Goal**: Users with >10 applications can navigate through pages; correct 10-record slice shown per page; pagination hides for ≤10 records; page resets and scrolls to top on dataset change; archiving the boundary record removes the pagination bar.

**Independent Test**: Seed >10 records. Pagination controls appear. Click page 2 — different records shown, view scrolled to top. Archive until ≤10 records remain — pagination disappears and view is on page 1.

### Application List Integration

- [ ] T007 [US1] Add `let _currentPage = 1` and `let _paginationEl = null` module-level variables to `src/pages/Tracker.js`; reset both to initial values in `unmount()`; also reset both to initial values at the start of `mount()` before any rendering begins (guards against mount-without-unmount edge case)
- [ ] T008 [US1] Extract `renderPage()` in `src/pages/Tracker.js` — add `import { PAGE_SIZE } from '../utils/pagination.js'` at the top of Tracker.js (do NOT declare a local constant); compute `startIndex = (_currentPage - 1) * PAGE_SIZE`, `endIndex = startIndex + PAGE_SIZE`; slice `_applications` without mutating it; clear and rebuild `_cardList` with sliced records; replace the existing inline card-rendering loop in `mount()` with a call to `renderPage()`
- [ ] T009 [US1] In `renderPage()` in `src/pages/Tracker.js`, call `getPaginationModel(_currentPage, _applications.length, PAGE_SIZE)`; if `hasPagination`, create a Pagination element via `Pagination.render()` and store in `_paginationEl`, then append after `_cardList`; remove any existing `_paginationEl` before re-rendering; if `!hasPagination`, ensure no pagination element is in the DOM
- [ ] T010 [US1] Add `onPageChange(page)` in `src/pages/Tracker.js` — sets `_currentPage = page`, calls `window.scrollTo(0, 0)`, calls `renderPage()`; pass as callback to `Pagination.render()`
- [ ] T011 [US1] Update `onArchive` in `src/pages/Tracker.js` — after `removeApplication(id)` and the surgical card DOM removal, call `renderPage()` instead of only updating the toolbar count; this ensures pagination re-evaluates after the dataset shrinks (e.g., archiving the 11th record must make the pagination bar disappear)

### Pagination Component

- [ ] T012 [P] [US1] Create `src/components/Pagination.js` stub with empty `render()` returning `null`; create `tests/components/Pagination.test.js` with `// @vitest-environment jsdom` at top — write tests for: (a) `getPaginationModel` returns `hasPagination: false` → component renders nothing; (b) `hasPagination: true` → wrapper element exists; (c) active page button has `aria-current="page"`; (d) ellipsis span has `aria-hidden="true"` and no click handler; run `npm run test:run` and confirm these tests **fail**
- [ ] T013 [US1] Implement `Pagination.render(currentPage, totalEntries, onPageChange)` in `src/components/Pagination.js` — call `getPaginationModel()`; return a `<div class="pagination">` containing `<hr class="pagination__rule">` and `<nav class="pagination__nav" aria-label="Pagination">`; for each number in `pagesToRender` create `<button class="pagination__btn">`; for `'ellipsis'` create `<span class="pagination__ellipsis" aria-hidden="true">···</span>`; on each button attach `() => onPageChange(n)`, set `aria-label="Go to page N"`; on the active page add class `pagination__btn--active`, set `aria-label="Current page, page N"`, set `aria-current="page"`
- [ ] T014 [US1] Add pagination styles to `src/styles/main.css`: `.pagination` wrapper (`padding: 0 20px 20px`); `.pagination__rule` (`border: none; border-top: 1.5px solid var(--border, #e0ddd8); margin-bottom: 14px`); `.pagination__nav` (`display: flex; justify-content: center; gap: 6px`); `.pagination__btn` default (`min-width: 32px; height: 32px; border: 1.5px solid var(--border, #e0ddd8); border-radius: 5px; background: #fff; font-family: 'DM Mono', monospace; font-size: 11px; color: #555; cursor: pointer`); `.pagination__btn:hover` (`border-color: #4F46E5; color: #4F46E5; background: #f4f2ff`); `.pagination__btn--active` (`background: #4F46E5; border-color: #4F46E5; color: #fff; font-weight: 600`); `.pagination__ellipsis` (`min-width: 28px; height: 32px; display: inline-flex; align-items: center; justify-content: center; font-family: 'DM Mono', monospace; font-size: 12px; color: #bbb; user-select: none; letter-spacing: 1px; cursor: default`) — all values from `design/pagination_footer.md` § 1.6
- [ ] T015 [US1] Run `npm run test:run` — Pagination component tests from T012 must pass; fix any failures

**Checkpoint**: Pagination end-to-end: ≤10 records → no pagination; >10 → controls appear; page changes show correct records and scroll to top; archiving boundary record removes pagination bar.

---

## Phase 4: User Story 2 — View Consistent Footer on Every Page (P2)

**Goal**: A persistent footer with brand, version, stack, feedback links, and copyright is visible at the bottom of every page. Feedback links open GitHub Issues in a new tab.

**Independent Test**: Navigate to Tracker, Calendar, and Profile — footer present at bottom of all three. Click "Report an issue" — `https://github.com/reso830/Project_Alice/issues/new` opens in a new tab. Inspect copyright text exactly.

### Footer Component

- [ ] T016 [US2] Create `src/components/Footer.js` stub with empty `render()` returning `null`; create `tests/components/Footer.test.js` with `// @vitest-environment jsdom` at top — write tests for: (a) footer element exists in DOM; (b) both feedback links have `href` containing `github.com/reso830/Project_Alice/issues` and `target="_blank"`; (c) both feedback links have `aria-label`; (d) copyright text contains `© 2026 Project Alice`; run `npm run test:run` and confirm these tests **fail**
- [ ] T017 [US2] Implement `Footer.render()` in `src/components/Footer.js` — return `<footer class="site-footer">` containing `<div class="footer__inner">`; add brand section (inline SVG icon from `design/pagination_footer.md` § 2.4, name "Project Alice", tagline "Your job search, organized."); add `<hr class="footer__rule">`; add VERSION section (label "VERSION", values "v0.1.0 — wireframe" and "Built Apr 2026"); add STACK section (label "STACK", values "React 18 · Babel" and "Sora · DM Mono"); add FEEDBACK section (label "FEEDBACK") with two `<a>` elements: "Report an issue" and "Request a feature", both with `href="https://github.com/reso830/Project_Alice/issues/new"`, `target="_blank"`, `rel="noopener noreferrer"`, and matching `aria-label`; add `<p class="footer__copyright">© 2026 Project Alice. All rights reserved. · Part of reso's Project Series.</p>`
- [ ] T018 [US2] In `src/main.js`, import `{ Footer }` from `./components/Footer.js`; inside `DOMContentLoaded`, call `Footer.render()` and append to `document.body` after the `<main>` element; footer mounts once, never unmounts
- [ ] T019 [US2] Add footer desktop styles to `src/styles/main.css`: `.site-footer` (`background: #1a1a2e; color: rgba(255,255,255,0.5); padding: 28px 20px 24px`); `.footer__inner` (`display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px 32px; max-width: 900px; margin: 0 auto`); brand flex row (`align-items: baseline; gap: 8px`); brand name (`color: #fff; font-size: 13px; font-weight: 600; letter-spacing: 0.4px`); tagline (`font-size: 11px; color: rgba(255,255,255,0.38)`); section label (`font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.9px; color: rgba(255,255,255,0.28); margin-bottom: 2px`); value text (DM Mono 10px, `rgba(255,255,255,0.45); line-height: 1.6`); `.footer__link` default (DM Mono 10px, `color: rgba(255,255,255,0.38); background: none; border: none; padding: 0; cursor: pointer; display: block; text-decoration: none`); `.footer__link:hover` (`color: rgba(255,255,255,0.75)`); `.footer__rule` (`border: none; border-top: 1px solid rgba(255,255,255,0.08); grid-column: 1 / -1`); `.footer__copyright` (DM Mono 9px, `color: rgba(255,255,255,0.22); grid-column: 1 / -1; padding-top: 4px`) — all values from `design/pagination_footer.md` § 2.4
- [ ] T020 [US2] Run `npm run test:run` — Footer component tests from T016 must pass; fix any failures

**Checkpoint**: Footer at bottom of all three pages. Desktop 3-column layout. All sections present. "Report an issue" opens correct URL in new tab. Copyright text exact.

---

## Phase 5: User Story 3 — Mobile Responsive Layout + Sticky Footer (P3)

**Goal**: Footer stays at viewport bottom on short pages; reflows to 2-column on mobile; pagination controls accessible at 375px.

**Independent Test**: Open Calendar with no data (short page) — footer at bottom, not floating mid-screen. Resize to 375px — footer 2-column, no horizontal overflow.

- [ ] T021 [US3] Add sticky footer CSS to `src/styles/main.css` — `body { display: flex; flex-direction: column; min-height: 100vh; }` and `#app { flex: 1; }` — this pushes the footer to the bottom of the viewport when content is short; confirm existing layout is unaffected on content-rich pages
- [ ] T022 [US3] Add responsive footer CSS in `src/styles/main.css` inside the existing `@media (max-width: 639px)` block: `.footer__inner { grid-template-columns: 1fr 1fr }` (2-column); `.footer__brand, .footer__copyright { grid-column: 1 / -1 }` (full width)
- [ ] T023 [US3] Manual check: (a) open Calendar page with no data — confirm footer is at viewport bottom, not floating; (b) set viewport to 375px — confirm footer is 2-column; (c) seed >10 records, navigate to Tracker — confirm pagination buttons are fully visible and no horizontal scrollbar appears

**Checkpoint**: Footer pinned to bottom on all pages. 2-column layout at 375px. Pagination accessible on mobile.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Design token hygiene, code quality, and final verification.

- [ ] T024 [P] Review `:root` in `src/styles/main.css` — replace footer/pagination literal colour values with existing CSS custom properties where a match exists (`--border`, `--indigo`, `--indigo-hover`, `--indigo-dim`, `--navy` etc.); add new tokens only where no match exists
- [ ] T025 [P] Inspect all new component files — confirm no `style=` inline attributes; all visual styling must be class-based in `src/styles/main.css`
- [ ] T026 Run `npm run lint` — resolve all ESLint errors in `src/components/Footer.js`, `src/components/Pagination.js`, `src/utils/pagination.js`, `src/pages/Tracker.js`, `src/main.js`
- [ ] T027 Run `npm run test:run` — all tests pass (unit + both component suites)
- [ ] T028 Full manual verification: run all checks in `specs/005-pagination-footer/quickstart.md`; additionally verify the archive regression: with exactly 11 records on page 1, archive one — confirm pagination bar disappears immediately and page count is no longer shown
- [ ] T029 Run `git diff --name-only` — confirm no files under `server/` or `shared/` were modified

**Checkpoint**: All phases complete. Lint clean. All tests pass. Archive regression verified. No backend files changed. Ready for `/speckit.checklist`.

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Blocks |
|---|---|---|
| Phase 1 (Setup) | — | — |
| Phase 2 (Foundation) | Phase 1 | Phase 3 |
| Phase 3 (US1) | Phase 2 | Phase 5 (T021 needs #app selector from main.js) |
| Phase 4 (US2) | Phase 1 only | Phase 5 (T021 needs footer in DOM) |
| Phase 5 (US3) | Phase 3 + Phase 4 | Phase 6 |
| Phase 6 (Polish) | Phases 3 + 4 + 5 | — |

**Key insight**: Phase 4 (Footer) is fully independent of Phase 3 (Pagination). Both can proceed after Phase 1. They share `main.css` for styling — coordinate to avoid conflicting edits on the same file.

### Within Phase 3 (US1)

```
T007 → T008 → T009 → T010 → T011
T012 [P] ← starts alongside T007 (different file: Pagination.js vs Tracker.js)
T013     ← depends on T012 (implements the stub)
T014     ← depends on T013 (class names must be known before writing CSS)
T015     ← depends on T012–T014 (runs the tests)
```

### Within Phase 4 (US2)

```
T016 → T017 → T018
T019   ← depends on T017 (class names from implementation)
T020   ← depends on T016–T019 (runs tests)
```

---

## Parallel Opportunities

### Phase 3 + Phase 4 simultaneously

```
Phase 3                               Phase 4
────────────────────────────────────  ─────────────────────────────────────
T007 Tracker.js: state variables      T016 Footer.js: stub + component tests
T008 Tracker.js: renderPage()         T017 Footer.js: implement all sections
T009 Tracker.js: wire pagination      T018 main.js: mount footer
T010 Tracker.js: onPageChange         T019 main.css: footer desktop styles
T011 Tracker.js: fix onArchive        T020 run Footer tests
T012 Pagination.js: stub + tests [P]
T013 Pagination.js: implement
T014 main.css: pagination styles
T015 run Pagination tests
```

---

## Implementation Strategy

### MVP First (US1 only — 15 tasks)

1. T001 — confirm scope
2. T002–T006 — pagination model + tests
3. T007–T015 — integrate pagination into Tracker
4. **STOP**: seed >10 records, test end-to-end including archive regression
5. Proceed to US2 only after US1 validated

### Incremental Delivery

1. Phase 2 complete → algorithm verified in isolation
2. Phase 3 complete → paginated list ships on desktop
3. Phase 4 complete → footer visible on all pages
4. Phase 5 complete → sticky footer, mobile responsive
5. Phase 6 complete → `/speckit.checklist`

---

## Notes

- `'ellipsis'` is a string sentinel in `pagesToRender` — never compare against a page number
- `_applications` must never be mutated — always derive the visible slice as a computed value
- `window.scrollTo(0, 0)` is already used in existing `Tracker.js` — this is the established scroll pattern
- Footer content strings (stack credits, version) are static values in `Footer.js`, not loaded from config
- Feedback links use `<a>` elements with `target="_blank"` and `rel="noopener noreferrer"`, not `<button>`
- jsdom is a dev dependency only — it is not bundled into the production build
- **Total tasks**: 29 (T001–T029)
