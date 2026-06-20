# Research: Desktop Workspace Refresh

Phase 0 decisions. The spec has no open `[NEEDS CLARIFICATION]` markers (all four ambiguities + the panelization scope were resolved with the user, see spec Clarifications). The items below are the engineering decisions that shape the design.

---

## D1 — How to render the detail pane: reuse the `Modal` singleton vs. a new component

**Decision**: Reuse the existing `Modal` singleton with an added `variant` ('modal' | 'pane') and a `target` container.

**Rationale**: The spec requires a *single* editing experience and business logic across pane, modal, and sheet (FR-010/FR-011). `Modal.js` already owns the entire edit lifecycle (draft/original, dirty tracking, validation, save/discard, status chrome, quick actions, archived mode). Forking a second component would duplicate ~1700 lines and inevitably drift. The only differences for a pane are *mount point* and *window-level behaviors* (scroll lock, backdrop, focus trap, global Esc) — all cleanly gateable on `variant`.

**Alternatives considered**:
- *New `DetailPane` component wrapping shared sub-renderers* — would require extracting the body/footer/header builders out of the singleton first; larger refactor, higher regression risk, and the singleton's `document.querySelector('#modal-status-badge')` lookups would need rework. Rejected for v1.
- *Render two instances simultaneously* — the singleton uses module-global state and unique element IDs; two live instances are not supported and not needed (only one detail is shown at a time). Rejected.

**Consequence**: `role="dialog"`/`aria-modal`/focus-trap apply to the `modal` variant only. The pane is a non-modal labelled region.

---

## D2 — Dirty-switch guard when selecting a different card

**Decision**: Export `Modal.requestClose()` as a thin wrapper over the existing `_attemptClose()`, and have `Tracker.selectApplication()` `await` it before switching.

**Rationale**: `_attemptClose()` already implements exactly the required behavior — when the draft is dirty it shows the `ConfirmDialog` "Discard changes? / Keep editing / Discard" and resolves a boolean; when clean it closes immediately. The spec's dirty-switch (FR-014, US5) is the same decision applied at "switch" instead of "close". Reusing it guarantees identical copy and behavior and authors no new dialog.

**Flow**: `selectApplication(id)` → if a pane is open, `const ok = await Modal.requestClose()`; if `!ok` (Keep editing) abort the switch (selection and pane unchanged); else proceed to select and mount the new application.

**Alternatives considered**: a bespoke "switch confirmation" dialog — rejected (duplicate copy, divergent UX). Silent discard — rejected by the user (US5 = prompt).

---

## D3 — Integrating `CompatibilityModule` (which self-collapses) into an `OPanel`

**Decision**: Add an additive `embedded: true` option to `CompatibilityModule.render`. When embedded, the module renders its expanded score+notes content directly (no inner wash box) and does **not** render its own section-level Expand/Collapse toggle; the surrounding `OPanel` owns collapse, and the panel's collapsed preview reuses the module's existing mini-ring/verdict/summary renderer.

**Rationale**: Design §15.4 "Panel 2" is explicit: the panel header replaces the module's toggle, the collapsed preview is the mini ring, and the expanded body is the §14.4–14.6 content rendered directly. The module already has a `.cx-collapsed-content` renderer (line ~352) we can surface as the panel preview. `embedded` defaults false, so the standalone behavior and all existing `CompatibilityModule` tests are untouched. `setDirty` wiring (`_syncFooter` → `CompatibilityModule.setDirty`) stays as-is.

**Alternatives considered**: nesting the module's own collapse inside the panel's collapse (double toggle) — confusing, two controls for one section; rejected. Rebuilding the compat panel from scratch — wasteful; the module is shipped and correct.

---

## D4 — `Timeline` inside a panel (headerless / "bare" mode)

**Decision**: Add an additive `bare: true` option to `Timeline.render` so the panel header replaces the field's own header (design §4.3). If, on inspection during implementation, the Timeline's existing header reads acceptably inside the panel, fall back to wrapping it unchanged and drop `bare` — decided at implementation time, default behavior preserved either way.

**Rationale**: Avoids a duplicated "Timeline" label (panel title + field header). Additive option keeps existing Timeline tests/behavior intact. Low-risk, reversible.

---

## D5 — Responsive detection & switching at 1100px

**Decision**: Use a single `window.matchMedia('(min-width: 1100px)')` with a `change` listener stored on a module variable and removed in `Tracker.unmount()`. `_isDesktop` is read from `mql.matches`.

**Rationale**: `matchMedia` is the standard, cheap way to branch layout and to react to viewport/zoom changes without polling `resize`. The 1100px threshold matches `tracker.md` and the spec (FR-001/FR-003). The listener handles the two handoff cases (modal↔pane) described in the plan's Decision 3.

**Alternatives considered**: CSS-only (the split is pure CSS, JS just reads a flag) — the *layout* is CSS, but the *behavior* (click opens pane vs modal) must branch in JS, so a JS signal is required regardless. `resize` listener with debounce — noisier and less precise than `matchMedia`; rejected.

---

## D6 — Selection persistence across list re-render (FR-016)

**Decision**: Treat `_selectedId` and the pane as independent of the visible list. `renderPage()` only updates which (if any) currently visible card carries `--selected`; it never clears `_selectedId` or tears down the pane. The pane is replaced only by an explicit card click, or torn down when the open application is archived/closed.

**Rationale**: The user chose "keep pane until replaced" (US6). The Tracker re-renders cards on every filter/sort/page/view change; coupling selection to the visible set would blank the pane constantly. Decoupling is a one-line discipline in `renderPage()` plus passing `selected` to `Card.render`.

**Edge**: if the user archives the application currently open in the pane (from within the pane), the existing `onArchiveSuccess` path removes it from the list; the pane returns to the empty state and `_selectedId` is cleared.

---

## D7 — Focus & keyboard in the non-modal pane

**Decision**: The pane variant does **not** trap focus and does **not** hijack document-level `Esc`. Field-level `Esc` (revert) and `Cmd/Ctrl+S` (save) still work because they are bound within the panel/fields. Panel headers are real `role="button"` elements with `aria-expanded` and Enter/Space activation. Cards remain keyboard-focusable; selecting via keyboard mounts the pane exactly like a click.

**Rationale**: A docked pane is part of the page, not an overlay, so trapping focus would be wrong (the user must be able to Tab back to the list). Constitution requires keyboard operability and non-color-only state; `aria-selected` on the card and `aria-expanded` on panels satisfy this. The modal/sheet variants keep their existing focus trap (they are modal).

---

## D8 — Styling location

**Decision**: All new CSS goes into the single `src/styles/main.css`, alongside the existing `.modal-*` rules (~lines 3673–4900) and a new `@media (min-width: 1100px)` block for the master-detail split. Panelized-body styles are not breakpoint-gated (they apply in all variants); pane-vs-modal differences are scoped by a `.modal-panel--pane` modifier.

**Rationale**: The project ships one stylesheet; adding a file would diverge from the established structure (Constitution II — prefer the existing simple structure). Panel styles are shared, so they must not live inside a desktop-only media query.
