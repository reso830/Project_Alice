# Quickstart: Desktop Workspace Refresh

How to run, exercise, and verify this feature locally.

## Run

```bash
npm install      # no new dependencies are added by this feature
npm run dev      # Vite dev server (local SQLite runtime)
```

Open the Tracker with at least a few applications (seed/import some if empty).

## Verify the desktop master-detail workspace (≥ 1100px)

1. Widen the browser to ≥ 1100px. The Tracker shows the **list on the left (~60%)** and a **docked detail pane on the right (~40%)**. Pagination spans the full width below both columns.
2. On first load, the pane shows the **"Nothing open yet"** empty state — nothing is auto-selected (US2, FR-008/FR-009).
3. Click an application card → it gets an **indigo selected treatment** (and `aria-selected`), and its details render **in the pane** with **no centered modal / no backdrop** (US1).
4. Scroll the list — the pane stays pinned (sticky) and scrolls internally (FR-002).
5. Click a different card → the pane swaps in place, no modal animation (US3).

## Verify the panelized Application Details body (all viewports)

6. With an application open, confirm the body is **five collapsible panels** in order **Overview → Skills → Compatibility → Timeline → Notes & Links**, with **only Overview expanded** (US8, FR-024/FR-025).
7. Expand/collapse each panel (click the header, then try Enter/Space with the header focused). Confirm the **Save/Discard footer does not appear** from toggling (FR-026).
8. Confirm Overview holds Company/Recruiter/Location/Salary/Shift/Work Setup/Min Years/Responsibilities; Skills holds Required/Preferred (with proficiency colors + legend); Notes & Links holds URL + General Notes (FR-027).
9. Put long text in Responsibilities/General Notes → confirm **Show more / Show less** clamp (FR-028).

## Verify editing parity (FR-011, US4)

10. Edit a field in the pane, change status, view Compatibility and Timeline; click **Save** → toast + footer hides, exactly like the modal. Click **Discard** with edits → discard confirmation.

## Verify the dirty-switch guard (US5)

11. Make an edit in the pane (footer appears). Click a **different** card → the **discard confirmation** appears. Choose **Keep editing** → original stays loaded with edits intact. Repeat, choose **Discard** → the new card loads.

## Verify selection persistence (US6)

12. With a card open in the pane, apply a filter that removes its card, sort, paginate, and switch Active↔Archived. The pane **keeps showing** the previously selected application each time. Click any visible card → pane replaces.

## Verify tablet & mobile are unchanged (US7)

13. Resize to **640–1099px** → clicking a card opens the **centered modal** (backdrop + scroll lock), no pane. The same five panels render in the modal body.
14. Resize to **< 640px** → clicking a card opens the **bottom sheet**; same five panels.

## Verify archived mode

15. Open an archived application (desktop pane and modal): the five panels render **read-only** — no inline editors, no footer (FR-029).

## Automated checks

```bash
npm run test:run    # Vitest — unit/component/page tests (one-shot)
npm run lint        # ESLint — style/format gate (no separate `format` script exists)
```

Expected new/updated suites: `tests/components/OPanel.test.js`, `tests/utils/clampText.test.js`, `tests/components/Modal.test.js` (panels + pane variant + archived), `tests/components/Card.test.js` (selected), and Tracker selection/persistence tests. Existing `Modal`, `Timeline`, `CompatibilityModule`, and `Card` suites must remain green.
