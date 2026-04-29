# Research: Profile Page Refinements

**Branch**: `009-profile-page-refinement` | **Date**: 2026-04-29

---

## 1. Modal vs Bottom Sheet vs Inline Form

**Decision**: Replace all inline section forms with `createEntryOverlay` — a single function that renders a modal on desktop (≥ 640 px) or a bottom sheet on mobile (< 640 px).

**Rationale**: Inline forms in 008 share the card body with the entry list, creating a cramped layout when editing long-form entries (responsibilities, details). Modals and bottom sheets give the form dedicated viewport space, match user expectations on mobile, and naturally enforce one-at-a-time editing without an explicit guard like `hasOpenInlineForm()`.

**Alternatives considered**:
- Keep inline forms, expand the card — rejected; long-form fields (responsibilities, details) overflow fixed card widths on mobile.
- Use a drawer/sidebar panel — rejected; wider than a bottom sheet and provides no benefit on narrow viewports where horizontal space is scarce.
- Separate page/route for each entry form — rejected; navigation overhead is excessive for short-lived forms; URL history becomes polluted.

---

## 2. Single `createEntryOverlay` Factory vs Per-Section Modal Components

**Decision**: One `createEntryOverlay(title, buildForm, { onSave })` factory with per-section `buildForm` callbacks, all inside `ProfileEdit.js`.

**Rationale**: Six of seven sections (all except Skills) share an identical modal structure — backdrop, box, header, form area, Cancel/Save footer. The only thing that varies per section is the form fields. A single factory avoids duplicating the backdrop/focus-trap/close/discard logic six times. `buildForm` gives each section control over its specific fields while keeping shared infrastructure in one place.

**Alternatives considered**:
- Separate modal class or file — rejected; increases the module count for functionality that is entirely scoped to `ProfileEdit.js` and does not need to be shared.
- Shared `Modal.js` component extension — rejected; the existing `Modal.js` is purpose-built for application status editing and requires significant rework to support a generic form pattern.

---

## 3. Edit Icon: Render in Phase 3 (Inert) vs Defer to Phase 7

**Decision**: Render the Edit icon in Phase 3 via `onEdit: () => {}` noop; wire the real callback in Phase 7.

**Rationale**: Rendering the icon early means the UI is visually complete from Phase 3 onward — a reviewer or manual tester sees the final appearance immediately. The icon cannot cause harm as a noop. Deferring the icon entirely to Phase 7 would create a visible UI gap between phases (Remove only, then both) and complicate the Phase 3/7 split.

**Alternatives considered**:
- Defer icon rendering entirely to Phase 7 — rejected by user; creates a visible mid-feature regression window.
- Render icon and show "coming soon" toast — rejected; confusing to anyone testing intermediate phases.

---

## 4. Focus Trap Implementation

**Decision**: Implement a Tab/Shift-Tab focus trap inside each overlay by querying focusable descendants and clamping focus at the boundary on keydown.

**Rationale**: FR-030 requires this. Without a trap, Tab from the last field in the modal moves focus to browser chrome or content behind the backdrop, breaking keyboard-only workflows. The implementation is ~15 lines of vanilla JS, no library required.

**Implementation approach**:
```js
overlay.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const focusable = [...overlay.querySelectorAll(
    'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )].filter(el => !el.disabled);
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
});
```
On open, focus is moved to the first focusable element. On close, the listener is removed.

**Alternatives considered**:
- `focus-trap` npm package — rejected; adds a dependency for ~15 lines of code. Constitution requires justification for new dependencies.
- `inert` attribute on background content — could complement the Tab trap but has less predictable cross-browser behavior for `pointer-events`; not used in the existing codebase.

---

## 5. Overlay Discard Confirmation — Second-Layer Dialog vs Global Modal

**Decision**: Implement a lightweight second-layer dialog (`showOverlayDiscardDialog(boxEl, { onDiscard })`) that appends a `position: absolute; inset: 0` div inside the open modal/sheet box.

**Rationale**: The page-level discard modal (triggered by navbar clicks on a dirty Edit Profile page) already exists and must continue to work independently. If an overlay's Cancel triggered the global modal, both guards would compete — the global modal might fire first and navigate away before the overlay's discard is resolved. A second-layer dialog scoped to the overlay box keeps the two concerns separate.

**Alternatives considered**:
- Reuse the global discard modal — rejected; the two guards must be independent (overlay discard vs page-level discard are different events with different outcomes).
- `window.confirm()` — rejected; browser native confirm cannot be styled, is not keyboard-navigable in the same flow, and differs across browsers in styling and behavior.

---

## 6. Skills Staging — Modal-Local Array vs `_formState` Mutation

**Decision**: Maintain a `staged = []` array inside the Skills overlay closure. Skills are only merged into `_formState.skills` when Save is clicked.

**Rationale**: Skills have a different input model — the user adds multiple items in one overlay session. If each inline Add wrote directly to `_formState.skills`, Cancel would need to roll back an unknown number of mutations. A local staging array keeps the overlay state entirely independent of the main form state; Cancel simply discards `staged[]` without touching `_formState`.

**Alternatives considered**:
- Write to `_formState` on each inline Add, undo on Cancel — rejected; undo logic requires tracking the pre-open skills snapshot and rolling back, which is error-prone.
- Re-render the skills card on each staged Add — rejected; would cause the pill list outside the overlay to flash with partially-staged skills before the user has confirmed Save.

---

## 7. `isDirty` Snapshot — `getFormData(fields)` vs `initialValues`

**Decision**: Take the dirty-detection snapshot from `getFormData(fields)` *after* form field initialization, not from `initialValues` directly.

**Rationale**: In add mode, `initialValues = {}` is passed but form fields initialize their values as empty strings (`''`). Comparing `{}` against `{ role: '', company: '', ... }` would always produce a mismatch, reporting the form as dirty the moment it opens. Snapshotting from `getFormData(fields)` after initialization captures the actual initial rendered state and avoids false-positive discard confirmations on Cancel.

---

## 8. Sort Reference Identity for Edit-in-Place

**Decision**: Document that `sortExperience` and `sortEducation` MUST return the same object references, not clones.

**Rationale**: Edit-in-place uses `_formState.experience.indexOf(entry)` to locate the entry to replace. This relies on reference equality — the `entry` variable captured in the Edit callback must be the same object that exists in `_formState.experience`. If `sortExperience` returned new objects, `indexOf` would return `-1`, the `splice` would silently fail, and the edit would be lost. The current sort implementation reorders in place and is safe.

---

## 9. iPad Mini Stat Chip Fix — No Upper-Bound Media Query

**Decision**: Apply `.apps-desktop-vis__stats .stat-chip-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }` outside any media query, producing a 2 × 2 grid at all desktop viewport widths.

**Rationale**: The overflow problem exists because the `apps-desktop-vis__stats` column is narrower than the global `stat-chip-row` width at mid-range viewports. A scoped rule that makes chips always 2 × 2 in that column is simpler than a media-query range that targets only a specific width band, and the 2 × 2 layout is acceptable at all desktop widths per user confirmation.

**Alternatives considered**:
- Media query targeting 640–900 px only — rejected by user; 2 × 2 is acceptable everywhere so a range query adds complexity with no benefit.
- CSS `min-content` / `auto-fill` — considered; less predictable than an explicit column count given the fixed-width stat chips.

---

## 10. No New npm Dependencies

**Decision**: All new functionality (overlay, focus trap, discard dialog, structured rows) uses vanilla JS. No new packages.

**Rationale**: Required by the constitution. The overlay system, focus trap, and discard dialog are each under 50 lines of straightforward DOM manipulation — well within the threshold where a library would be justified.
