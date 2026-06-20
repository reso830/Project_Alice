# Plan Review Checklist: Desktop Workspace Refresh

**Purpose**: Pre-implementation gate. Verified against `plan.md`, `spec.md`, and the supporting artifacts **before any code is written**. Items are checkable from the plan itself — not post-implementation verification (no "tests pass", "release prep done", or "grep confirms" items here).

## Spec ↔ Plan scope alignment

- [ ] Every spec user story (US1–US8) is addressed by a plan decision and a `/speckit.tasks` phase.
- [ ] Every functional requirement (FR-001 … FR-030) maps to a plan decision or affected-area entry.
- [ ] The plan does not introduce scope beyond the spec (no data/backend/scoring/timeline/creation changes; no `compact` card row).
- [ ] The clarified decisions are reflected: panel order **Skills before Compatibility**; dirty-switch = **discard confirmation**; selection **persists** until replaced; initial pane = **empty**; body **panelized** across all variants.

## Architecture soundness

- [ ] Reusing the `Modal` singleton with a `variant` flag (vs. a forked component) is justified and keeps a single editing/business-logic path (FR-011).
- [ ] Window-level behaviors correctly gated to the `modal` variant only: body-scroll lock, backdrop, focus trap, document-level `Esc`. The pane is non-modal.
- [ ] Selection state (`_selectedId`) lives in `Tracker.js`, independent of the modal draft (FR-013), and is decoupled from list re-render (FR-016).
- [ ] The dirty-switch guard reuses the existing `_attemptClose()`/`ConfirmDialog` (no new dialog, identical copy) (FR-014).
- [ ] Responsive routing/handoff at 1100px via `matchMedia` is specified for both directions (modal↔pane), with listener teardown in `unmount`.
- [ ] Panelization reuses existing field-maker functions and changes only grouping/container (FR-030), not editing semantics.

## Integration risks

- [ ] `CompatibilityModule` self-collapse vs. `OPanel` collapse is resolved (additive `embedded` option; panel owns collapse; preview reuses the module's mini-ring).
- [ ] `Timeline` in-panel header duplication is resolved (additive `bare` option, with a safe fallback).
- [ ] `StatusDropdown` (fixed-position, body-appended) still anchors correctly when the panel is in the pane — flagged for inspection.
- [ ] `_panelOpen` toggling is confirmed to NOT call `_syncFooter()` or mutate the draft (FR-026).
- [ ] All extended component interfaces are **additive with safe defaults** so existing callers/tests are unaffected (see contracts/api.md).

## Data-model correctness

- [ ] No persisted schema/column/migration change; both runtimes (local SQLite, hosted Supabase) and demo confirmed untouched.
- [ ] Required fields (company, job title, status, `lastStatusUpdate`, responsibilities) preserved and still validated by the existing path.
- [ ] New state is transient/in-memory only and reset appropriately (selection, variant, panel-open).

## Contract correctness

- [ ] No HTTP route or client `api.*` method is added or changed.
- [ ] Internal component contract extensions (`Modal.open` variant/target/onClosed, `Modal.requestClose`, `Card.render` selected, `OPanel`, `CompatibilityModule.embedded`, `Timeline.bare`) are documented and additive.

## Test strategy

- [ ] Validation Approach covers each user story's Independent Test at the unit/component/page level.
- [ ] Pane-variant invariants are testable (no body-scroll lock, no backdrop, no focus trap, mounts into target).
- [ ] Dirty-switch and selection-persistence have explicit test cases.
- [ ] Accessibility assertions included: `aria-selected` on selected card, `aria-expanded` on panel headers, keyboard activation.
- [ ] Regression: existing Modal/Timeline/CompatibilityModule/Card/Tracker suites are expected to stay green.

## Constitution compliance

- [ ] Required-field and validation rules reused (no new/parallel validation path).
- [ ] Business logic stays out of the view layer.
- [ ] No new dependency (or any new dependency is justified — here: none).
- [ ] Privacy/local-first intact; no analytics/external calls.
- [ ] Responsiveness + a11y (labels, keyboard, non-color-only state) planned across all three breakpoints.
- [ ] Final two phases are **Release Prep** then **Browser Smoke Test**, in that order; Release Prep includes correcting `application_overlay.md` §15.4 panel order.

## Notes

- Items here gate the start of implementation. Post-implementation verification (lint/format/test runs, Release Prep completion, browser smoke walk) belongs to the final review/verification steps, not this checklist.
