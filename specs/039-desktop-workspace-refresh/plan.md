# Implementation Plan: Desktop Workspace Refresh

**Branch**: `039-desktop-workspace-refresh` | **Date**: 2026-06-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/039-desktop-workspace-refresh/spec.md`

---

## Summary

Two presentation changes to the Tracker, both UI-only (no data, schema, or backend changes):

1. **Desktop master-detail workspace (≥ 1100px)** — replace "list + centered modal" with a persistent split: the application list (master, ~60%) beside a sticky docked **detail pane** (~40%). Clicking a card selects it and renders its details inline in the pane (no backdrop, no scroll lock). An empty "Nothing open yet" pane shows when nothing is selected. Tablet (640–1099px) keeps the centered modal; mobile (< 640px) keeps the bottom sheet.

2. **Panelized Application Details body** — replace the flat `.modal-field` grid in `Modal.js` with five collapsible panels (**Overview → Skills → Compatibility → Timeline → Notes & Links**, the clarified order), built to `application_overlay.md` §15. Because the body is shared, this one change appears in all three variants (pane, modal, sheet).

The existing `Modal` singleton becomes a **two-variant renderer** (`modal` | `pane`) sharing all editing logic. Selection state lives in `Tracker.js`, independent of the modal's draft state. Switching the selected card while the pane is dirty routes through the existing discard-confirmation; once the selected card scrolls/filters/pages out of view, the pane keeps its contents until another card is clicked.

No new runtime dependency. `createRepositories(config)` and both persistence runtimes (local SQLite, hosted Supabase) and demo mode are untouched.

---

## Technical Context

**Language/Version**: Vanilla JS (ES modules), Vite frontend; Express backend (untouched by this feature)
**Primary Dependencies**: none new — DOM APIs, `window.matchMedia` for the ≥ 1100px breakpoint; existing `CompatibilityModule`, `Timeline`, `StatusDropdown`, `ConfirmDialog`, `CompatBar`
**Storage**: N/A — no schema, column, or persistence change; selection and panel-open state are in-memory only
**Testing**: Vitest + jsdom (`tests/components`, `tests/pages` or `tests/utils`); run via `npm run test:run`; lint/format via `npm run lint` (ESLint — the project has no separate `format` script)
**Target Platform**: Desktop + tablet + mobile browsers; same build for local, hosted (Vercel), and demo runtimes
**Project Type**: Web application (Vite frontend + Express backend, dual-mode persistence) — **frontend-only change**
**Performance Goals**: Application switch feels immediate (re-render of one pane, no network beyond the existing `api.getById`); no layout thrash on resize across the 1100px boundary
**Constraints**: Local-first; no analytics; existing accessibility (labels, keyboard, focus, non-color-only state) must not regress; single shared editing code path across all three variants

---

## Constitution Check

*GATE: Must pass before design. Re-checked after design below.*

- **Required fields preserved** — company, job title, status, `lastStatusUpdate`, responsibilities are unchanged. Panelization only regroups fields; `validateDraft()` in `Modal.js` (which enforces Job Title, Company, Responsibilities, URL, Min Years) is reused verbatim. ✅
- **Business logic separated from UI** — all persistence/validation stays in `api.js`, `models/application.js`, `server/validation`. This feature touches only presentation/components; no business rule moves into the view. ✅
- **Centralized, reusable validation** — no new validation path; the existing `validateDraft()` and `validateUrl()` continue to gate saves in both variants. ✅
- **No silent corruption / overwrite** — selection state is independent of the draft (FR-013); switching a dirty pane routes through the existing discard confirmation (FR-014); collapse state never mutates the draft (FR-026). ✅
- **Workflows + empty/loading/error states** — add/edit/search/filter/review all preserved; the new empty-pane state is handled explicitly; list loading/error states (skeleton, inline error) are unchanged and continue to render in the master column. ✅
- **Automated tests** — unit tests for the new `OPanel` and `ClampText`, the variant/selection logic, the dirty-switch guard, and selected-card state; existing Modal/Timeline/Compatibility tests must stay green. ✅
- **Privacy local-first** — no external calls, no analytics; UI-only. ✅
- **Responsive / a11y** — desktop pane, tablet modal, mobile sheet all covered; selected card communicated by more than color (aria-selected + border/elevation, not glow alone); panel headers are real buttons with `aria-expanded`; keyboard activation (Enter/Space) for panels and card selection; the pane variant must NOT trap focus the way the modal does (it is non-modal). ✅
- **Future extensibility** — `OPanel` and `ClampText` are reusable primitives; the `variant` parameter cleanly separates modal vs pane without forking editing logic. ✅

**New dependency justification**: none introduced.

No violations → Complexity Tracking table omitted.

---

## Architecture & Data Flow

### Decision 1 — `Modal` becomes a two-variant renderer (`modal` | `pane`)

`Modal.open(application, opts)` gains:
- `variant: 'modal' | 'pane'` (default `'modal'`)
- `target: HTMLElement` — the container to render into for the `pane` variant (the Tracker's `.tracker-detail` element)
- `onRequestClose` / `onClosed` callbacks so the host (Tracker) learns when the pane should return to the empty state

Behavior gated on variant:

| Concern | `modal` (today) | `pane` (new) |
| --- | --- | --- |
| Mount point | `.modal-backdrop` appended to `document.body` | `panel` appended into `target` (the detail pane); no backdrop element |
| Body scroll lock | `document.body.style.overflow = 'hidden'` | **none** — page scrolls; pane body scrolls internally |
| Backdrop click-to-close | yes | n/a (no backdrop) |
| Focus trap | Tab cycles within panel | **no trap** — pane is non-modal; Tab flows naturally |
| `Esc` at document level | attempt close | **no global Esc hijack** — field-level Esc still reverts the field |
| Close semantics | remove backdrop, restore scroll | clear the pane → host shows empty state (`onClosed`) |

The existing singleton state (`_draft`, `_original`, `_mode`, footer, status chrome, `_attemptClose`, `_attemptDiscardDraft`, `validateDraft`, `saveDraft`) is **reused unchanged**. The variant only changes *where* and *how* the panel is mounted and which window-level behaviors (scroll lock, focus trap, global Esc) are attached. `document.querySelector('#modal-status-badge')`-style lookups keep working because IDs remain unique and the panel is in the live DOM regardless of container.

> The pane is a **non-modal** surface (it does not cover the app), so `role="dialog"`/`aria-modal="true"` and the focus trap are applied to the `modal` variant only. The pane panel uses a region/labelled-group role instead.

### Decision 2 — Selection state lives in `Tracker.js`, not in `Modal`

New Tracker module state: `_selectedId` (number | null) and `_isDesktop` (derived from `matchMedia('(min-width: 1100px)')`).

```
Card click (onOpen path)
  if (_isDesktop):
      selectApplication(id)            ← NEW desktop path
  else:
      Modal.open(application, { variant:'modal', … })   ← unchanged
```

`selectApplication(id)`:
1. If a pane is already open and dirty → `await Modal.requestClose()`; if it resolves `false` (Keep editing), abort the switch (FR-014).
2. Set `_selectedId = id`; re-render cards so the selected card gets `--selected` (and `aria-selected="true"`).
3. `api.getById(id)` → `Modal.open(application, { variant:'pane', target:_detailPaneEl, … })`.

`Modal.requestClose()` is a thin exported wrapper around the existing `_attemptClose()` (which already shows the discard dialog when dirty and resolves a boolean). No new dialog is authored.

### Decision 3 — Master-detail layout & responsive switching

`Tracker.mount()` builds a workspace wrapper. At ≥ 1100px the DOM is:

```
.tracker-split
├─ .tracker-master   (the existing .card-list + list states live here)
└─ .tracker-detail   (sticky; holds the pane panel OR .empty-pane)
.split-pagination    (full width, below the split)
```

Below 1100px the layout collapses to today's single column (`.card-list` + inline pagination), and `.tracker-detail` is not rendered.

A single `matchMedia('(min-width: 1100px)')` `change` listener drives transitions:
- **modal→pane (crossing up):** if a modal is open for app X, close it and select X in the pane (preserve selection where feasible, per the edge case). If none open, show empty pane.
- **pane→modal (crossing down):** if the pane shows app X, tear down the pane; selection is retained in `_selectedId` but no modal auto-opens (the user taps a card to open the modal), matching today's tap-to-open behavior.

Pagination moves into `.split-pagination` (full width) in desktop mode; below 1100px it stays where it is today.

### Decision 4 — Selection persistence (FR-016)

`renderPage()` re-renders the card list on every filter/sort/page/view change. Selection persistence means: **do not clear `_selectedId` or the pane** during `renderPage()` — only update which card (if any visible) carries the `--selected` class. The pane keeps rendering the previously selected application even when its card is absent from the current page/filter/view. Selection is replaced only by an explicit card click (or by archiving/closing the open application).

### Decision 5 — Panelized body (`OPanel` + `ClampText`), shared by all variants

`_renderBody()` is rewritten to emit `.pbody` → five `OPanel` sections instead of the flat field list. **All existing field-maker functions are reused** (`makeInlineText`, `makeInlineSelect`, `makeMinYearsField`, `makeChipEditor`, `makeSkillLegend`, `createCompatibilityField`, `Timeline.render`) — only their grouping/container changes (FR-030).

New presentation primitives:
- **`src/components/OPanel.js`** — `OPanel({ icon, title, tone, open, onToggle, preview, children })` → `<section class="panel panel--elevated">` with a `.panel-head.clickable` (role=button, `aria-expanded`, Enter/Space) and a body that renders `children` when open else `preview`. `tone:'ai'` adds `.panel-ai` (Compatibility only). Per design §15.2–15.4.
- **`src/utils/clampText.js`** (or `src/components/ClampText.js`) — line-clamp + Show more/less for Responsibilities and General Notes (design §15.5). Toggle renders only when the content overflows.

Panel composition (clarified order):

| # | Panel | Children | Collapsed preview |
| - | ----- | -------- | ----------------- |
| 1 | Overview | Company, Recruiter, Location, Salary, Shift, Work Setup, Min Years grid + Responsibilities (`ClampText`) | `Company · Location · Salary` |
| 2 | Skills | Required + Preferred chip editors + legend | `N proficient · M learning · K missing` |
| 3 | Compatibility (`tone:'ai'`) | existing `CompatibilityModule` | mini ring + verdict + summary |
| 4 | Timeline | existing `Timeline` | latest entry line |
| 5 | Notes & Links | URL + General Notes (`ClampText`) | first non-empty of Notes/URL |

Panel-open state: module-level `_panelOpen = { overview:true, skills:false, compat:false, timeline:false, notes:false }`, reset on each `open()`. Toggling re-renders only the affected panel body and **calls neither `_syncFooter()` nor any draft mutation** (FR-026).

**Integration nuance — Compatibility & Timeline already own rendering:**
- `CompatibilityModule` currently renders its own collapsed/expanded state and toggle (`.cx-collapsed-content`, `setDirty`). Inside `OPanel`, the panel owns collapse. Plan: render `CompatibilityModule` in an **embedded/expanded** mode (panel preview reuses the module's mini-ring/collapsed content; the module's own section toggle is suppressed). This is the §15.4 "Panel 2" rule: the panel header replaces the module's toggle, the collapsed preview is the mini ring, and the expanded body is the §14.4–14.6 content rendered directly (no inner wash box). Implement via a new `embedded:true` option on `CompatibilityModule.render` (additive; default false preserves current behavior). `setDirty` wiring stays as-is.
- `Timeline.render(draft, { currentStatus, onChange, readOnly })` has no headerless mode. Plan: add an additive `bare:true` option so the panel header replaces the field's own header (design §4.3 "bare" mode), or wrap Timeline as-is if its header is acceptable inside the panel — decided in research.md.

### Decision 6 — Selected card state in `Card.js`

`Card.render(application, callbacks, { selected = false } = {})` gains a third options arg. When `selected`, add `card--selected` and `aria-selected="true"`. Visual: indigo border + soft halo (design: `border-color:--indigo` + `0 0 0 4px rgba(79,70,229,.06)`). The `aria-selected` attribute is the **non-color** signal (constitution). `renderPage()` passes `selected: application.id === _selectedId`.

### Component / data flow

```
Tracker.mount()
  ├─ matchMedia('(min-width:1100px)') → _isDesktop (+ change listener)
  ├─ build .tracker-split (master + detail) when desktop, else single column
  └─ renderPage(): Card.render(app, cbs, { selected: app.id === _selectedId })

Card click → callbacks.onOpen(id)
  ├─ desktop:  selectApplication(id)
  │     ├─ if pane dirty: await Modal.requestClose() → false? abort
  │     ├─ _selectedId = id; renderPage() (re-mark selected card)
  │     └─ api.getById(id) → Modal.open(app, { variant:'pane', target:_detailPaneEl, onClosed })
  └─ <1100px: api.getById(id) → Modal.open(app, { variant:'modal', … })   (unchanged)

Modal.open(app, { variant, target, … })
  ├─ variant==='pane': mount panel into target; no backdrop/scroll-lock/focus-trap
  ├─ variant==='modal': today's behavior
  └─ _renderBody(): .pbody → [Overview, Skills, Compatibility, Timeline, Notes&Links] OPanels

Modal.requestClose() → _attemptClose()  (existing dirty-check + discard dialog)
Modal.close() (pane) → onClosed() → Tracker shows .empty-pane, _selectedId stays or clears per path
```

---

## Affected Areas

### Files/components likely to be **inspected** (read; little/no change)
- [src/services/api.js](../../src/services/api.js) — confirm `getById`, `getProfile`, `update`, `archive` signatures (already used by Tracker/Modal); no change expected
- [src/components/ConfirmDialog.js](../../src/components/ConfirmDialog.js) — confirm the discard dialog API reused by the dirty-switch guard; no change
- [src/components/StatusDropdown.js](../../src/components/StatusDropdown.js) — confirm anchored-dropdown works when the panel is in the pane (it appends to body with fixed positioning); inspect only
- [src/utils/pagination.js](../../src/utils/pagination.js) / [src/components/Pagination.js](../../src/components/Pagination.js) — confirm pagination can mount into `.split-pagination`; inspect only

### Files/components likely to be **modified**
- [src/pages/Tracker.js](../../src/pages/Tracker.js) — master-detail wrapper; `_selectedId` + `_isDesktop`; `selectApplication()`; `matchMedia` listener + teardown in `unmount`; route card `onOpen` to pane vs modal by viewport; full-width `.split-pagination`; pass `selected` to `Card.render`; render/teardown `.empty-pane`
- [src/components/Modal.js](../../src/components/Modal.js) — `variant`/`target`/`onClosed` params; gate scroll-lock, backdrop, focus-trap, global Esc on `variant==='modal'`; export `requestClose()`; rewrite `_renderBody()` to the 5-panel `.pbody` stack; archived-mode read-only panels
- [src/components/Card.js](../../src/components/Card.js) — `selected` option → `card--selected` + `aria-selected`
- [src/components/CompatibilityModule.js](../../src/components/CompatibilityModule.js) — additive `embedded` render option so the OPanel owns collapse (panel preview reuses the module's mini-ring content)
- [src/components/Timeline.js](../../src/components/Timeline.js) — additive `bare` (headerless) render option for in-panel use (pending research.md confirmation)
- [src/styles/main.css](../../src/styles/main.css) — `.tracker-split`/`.tracker-master`/`.tracker-detail` (sticky, ≥1100px), `.empty-pane`, `.split-pagination`, `.card--selected`, pane-variant panel styles, and the full panelized body styleset (`.pbody`, `.panel`, `.panel--elevated`, `.panel-head`, `.sec-toggle`/`.sec-chev`, panel previews, `.panel-ai`, `.clamp-*`) per design §15; mobile/tablet panel rules

### New files
- **NEW** [src/components/OPanel.js](../../src/components/OPanel.js) — collapsible panel shell (design §15.2–15.4)
- **NEW** [src/utils/clampText.js](../../src/utils/clampText.js) *(or `src/components/ClampText.js`)* — line-clamp + Show more/less primitive (design §15.5)
- **NEW** (optional) [src/components/EmptyPane.js](../../src/components/EmptyPane.js) — the "Nothing open yet" placeholder; may instead live inline in Tracker if trivial

### Tests likely to be **added or updated**
- **NEW** `tests/components/OPanel.test.js` — open/closed render, header toggle (click + Enter/Space), `aria-expanded`, `tone:'ai'`
- **NEW** `tests/utils/clampText.test.js` — clamp applied, toggle shows only on overflow, Show more/less switches
- `tests/components/Modal.test.js` — body renders 5 panels in order; only Overview open by default; collapse does not show footer / not dirty; pane variant does not lock body scroll or trap focus; archived panels read-only; existing edit/save/discard still pass
- `tests/pages/Tracker.test.js` (or existing Tracker tests) — desktop selection sets `--selected` + `aria-selected`; dirty-switch routes through `requestClose`; selection persists across filter/sort/page/view; below 1100px clicking opens the modal; empty pane on load
- `tests/components/Card.test.js` — `selected` option adds class + `aria-selected`
- Existing `CompatibilityModule` / `Timeline` tests — must stay green with the new additive options

### Explicitly **out of scope**
- Compatibility scoring/engine (036), compatibility analysis/notes lifecycle (037) — reused unchanged
- Timeline data/behavior (025) — reused unchanged
- Application creation flow (013/035) — Add-application gate + Create mode remain a centered overlay
- Any backend route, DB schema/column, migration, or `createRepositories` change
- The denser one-line `compact` card row (deferred to a future Settings toggle)
- Persisting selection or panel-open state across reloads

---

## Validation Approach

- **Unit — `OPanel`**: renders `children` when open and `preview` when closed; header `role=button` + `aria-expanded` reflect state; click and Enter/Space fire `onToggle`; `tone:'ai'` adds `.panel-ai`.
- **Unit — `ClampText`**: clamps to configured lines; toggle appears only when content overflows; Show more/less expands/collapses.
- **Component — `Modal` body**: five panels in order Overview → Skills → Compatibility → Timeline → Notes & Links; only Overview open at open; toggling a panel does not set `footer.hidden=false` and `_isDirty()` stays false; field edits inside panels still commit to draft and show the footer; archived mode renders panels with no inline editors and no footer.
- **Component — `Modal` pane variant**: with `variant:'pane'`, `document.body.style.overflow` is not set to `hidden`, no `.modal-backdrop` is created, the panel mounts into the provided target, and Tab is not trapped; `requestClose()` resolves true when clean and (mocking ConfirmDialog) false on "Keep editing".
- **Page — `Tracker` selection**: at ≥ 1100px (mock `matchMedia`), clicking a card sets `_selectedId`, marks the card `--selected`/`aria-selected`, and mounts the pane; a second click on a dirty pane awaits `requestClose` and aborts on false; below 1100px, clicking opens the modal (no pane).
- **Page — selection persistence**: with a pane open, applying a filter that removes the selected card, sorting, paging, and switching Active/Archived all keep the pane populated; clicking a visible card replaces it.
- **Page — empty state**: on desktop load with no selection, `.empty-pane` is present and no application details render.
- **Card**: `selected:true` adds `card--selected` and `aria-selected="true"`; default adds neither.
- **Regression**: existing `Modal`, `Timeline`, `CompatibilityModule`, `Card`, and `Tracker` suites remain green; `npm run lint` passes (ESLint is the style/format gate; there is no separate `format` script).
- **Browser smoke (final phase)**: walk each user story's Independent Test (US1–US8) at ≥1100px, 640–1099px, and <640px in a real browser.

---

## Constitution Re-check (post-design)

No principle is affected by the design above: required fields and validation are reused verbatim, business logic stays out of the view layer, no new dependency, privacy/local-first intact, and accessibility is explicitly planned (aria-selected, aria-expanded, keyboard activation, non-modal pane semantics). Gate remains **PASS**.

---

## Notes for `/speckit.tasks`

Suggested phase order (each phase independently testable; matches the spec's user-story priorities):

1. **Panel primitives** — `OPanel.js` + `ClampText` (+ unit tests). No wiring yet.
2. **Panelized body** — rewrite `Modal._renderBody()` to the 5-panel `.pbody` stack reusing existing field makers; `_panelOpen` state; `CompatibilityModule` `embedded` option; `Timeline` `bare` option; panel CSS. Verifiable in the existing centered modal first (US8) before any pane work.
3. **Modal pane variant** — `variant`/`target`/`onClosed`; gate scroll-lock/backdrop/focus-trap/Esc; `requestClose()` export; pane CSS.
4. **Master-detail layout** — Tracker `.tracker-split` wrapper, `matchMedia` detection + listener, `.split-pagination`, `.empty-pane`; layout CSS (US1, US2).
5. **Selection + card state** — `_selectedId`, `selectApplication()`, `Card` `selected` option, route onOpen by viewport (US1, US3).
6. **Dirty-switch guard + selection persistence** — wire `requestClose()` into `selectApplication`; keep pane across filter/sort/page/view; crossing-breakpoint handoff (US5, US6).
7. **Archived + tablet/mobile regression** — archived panels read-only in pane; confirm modal/sheet unchanged (US7).
8. **Tests** — all new + updated per Validation Approach.
9. **Release Prep** — version bump, `CHANGELOG.md`, README (desktop workspace), `docs/REPO_MAP.md` (new `OPanel.js` / `ClampText`), tick `docs/feature_roadmap.md` (039), sync `package-lock.json` root version; **correct `application_overlay.md` §15.4 panel order** (Skills before Compatibility) and reconcile the design docs to the as-built; no `docs/deployment.md` change (no env vars / runtime modes).
10. **Browser Smoke Test** — walk US1–US8 across the three breakpoints against the to-be-merged state.

See [research.md](research.md) for resolved decisions, [data-model.md](data-model.md) (no persisted change), [contracts/api.md](contracts/api.md) (no API change), [quickstart.md](quickstart.md), and [checklists/plan-review.md](checklists/plan-review.md).
