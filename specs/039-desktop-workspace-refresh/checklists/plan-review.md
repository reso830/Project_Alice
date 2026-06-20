# Plan Review Checklist: Desktop Workspace Refresh

**Purpose**: Pre-implementation gate. Verified against `plan.md`, `spec.md`, and the supporting artifacts **before any code is written**. Items are checkable from the plan itself — not post-implementation verification (no "tests pass", "release prep done", or "grep confirms" items here).

**Gate result**: ✅ **PASS** — reviewed 2026-06-20. All items verified against `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, and `tasks.md`. One item (StatusDropdown anchoring inside the pane) is an *implementation-time inspection* — the risk is acknowledged and assigned (plan Affected Areas "inspect only" / research D7); it is not a blocker and does not change the architecture. Implementation may begin.

## Spec ↔ Plan scope alignment

- [x] Every spec user story (US1–US8) is addressed by a plan decision and a `/speckit.tasks` phase.
- [x] Every functional requirement (FR-001 … FR-030) maps to a plan decision or affected-area entry.
- [x] The plan does not introduce scope beyond the spec (no data/backend/scoring/timeline/creation changes; no `compact` card row).
- [x] The clarified decisions are reflected: panel order **Skills before Compatibility**; dirty-switch = **discard confirmation**; selection **persists** until replaced; initial pane = **empty**; body **panelized** across all variants.

## Architecture soundness

- [x] Reusing the `Modal` singleton with a `variant` flag (vs. a forked component) is justified and keeps a single editing/business-logic path (FR-011).
- [x] Window-level behaviors correctly gated to the `modal` variant only: body-scroll lock, backdrop, focus trap, document-level `Esc`. The pane is non-modal.
- [x] Selection state (`_selectedId`) lives in `Tracker.js`, independent of the modal draft (FR-013), and is decoupled from list re-render (FR-016).
- [x] The dirty-switch guard reuses the existing `_attemptClose()`/`ConfirmDialog` (no new dialog, identical copy) (FR-014).
- [x] Responsive routing/handoff at 1100px via `matchMedia` is specified for both directions (modal↔pane), with listener teardown in `unmount`.
- [x] Panelization reuses existing field-maker functions and changes only grouping/container (FR-030), not editing semantics.

## Integration risks

- [x] `CompatibilityModule` self-collapse vs. `OPanel` collapse is resolved (additive `embedded` option; panel owns collapse; preview reuses the module's mini-ring).
- [x] `Timeline` in-panel header duplication is resolved (additive `bare` option, with a safe fallback).
- [x] `StatusDropdown` (fixed-position, body-appended) still anchors correctly when the panel is in the pane — flagged for inspection.
- [x] `_panelOpen` toggling is confirmed to NOT call `_syncFooter()` or mutate the draft (FR-026).
- [x] All extended component interfaces are **additive with safe defaults** so existing callers/tests are unaffected (see contracts/api.md).

## Data-model correctness

- [x] No persisted schema/column/migration change; both runtimes (local SQLite, hosted Supabase) and demo confirmed untouched.
- [x] Required fields (company, job title, status, `lastStatusUpdate`, responsibilities) preserved and still validated by the existing path.
- [x] New state is transient/in-memory only and reset appropriately (selection, variant, panel-open).

## Contract correctness

- [x] No HTTP route or client `api.*` method is added or changed.
- [x] Internal component contract extensions (`Modal.open` variant/target/onClosed, `Modal.requestClose`, `Card.render` selected, `OPanel`, `CompatibilityModule.embedded`, `Timeline.bare`) are documented and additive.

## Test strategy

- [x] Validation Approach covers each user story's Independent Test at the unit/component/page level.
- [x] Pane-variant invariants are testable (no body-scroll lock, no backdrop, no focus trap, mounts into target).
- [x] Dirty-switch and selection-persistence have explicit test cases.
- [x] Accessibility assertions included: `aria-selected` on selected card, `aria-expanded` on panel headers, keyboard activation.
- [x] Regression: existing Modal/Timeline/CompatibilityModule/Card/Tracker suites are expected to stay green.

## Constitution compliance

- [x] Required-field and validation rules reused (no new/parallel validation path).
- [x] Business logic stays out of the view layer.
- [x] No new dependency (or any new dependency is justified — here: none).
- [x] Privacy/local-first intact; no analytics/external calls.
- [x] Responsiveness + a11y (labels, keyboard, non-color-only state) planned across all three breakpoints.
- [x] Final two phases are **Release Prep** then **Browser Smoke Test**, in that order; Release Prep includes correcting `application_overlay.md` §15.4 panel order.

## Notes

- Items here gate the start of implementation. Post-implementation verification (lint/test runs, Release Prep completion, browser smoke walk) belongs to the final review/verification steps, not this checklist.
- **Carried into implementation** (acknowledged, not blocking): confirm `StatusDropdown` (fixed-position, appended to `document.body`) still anchors to its trigger when the detail panel is mounted in the docked pane — verify during Phase 04/05 (it should, since positioning is viewport-relative, but it needs a live check).
