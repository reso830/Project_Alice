# Plan Review Quality Checklist: Legal Docs & Footer

**Purpose**: Validate technical plan completeness and sound design before starting implementation.  
**Created**: 2026-07-04  
**Feature**: [plan.md](../plan.md)

**Gate result**: PASS (updated 2026-07-05 to address Claude review findings)

## Spec/Plan Alignment

- [x] The plan implements Terms & Conditions and Privacy Policy inside dynamically-built modal overlays rather than routing to static HTML pages in new tabs.
- [x] Welcome page mini-footer links, auth overlay links, and global footer links are all wired to launch the respective modal dialogs.
- [x] Footer redesign layout is covered: removes the STACK column, removes the horizontal rule, uses `alice-sigil-full.svg` (64x64px), places version inline, adds GitHub feedback link, reorganizes stubs, and stack copyright into three lines.
- [x] Uncommitted changes in the main workspace are preserved by isolating all planning and implementation work inside the new Git worktree.
  - Worktree isolates the *working copy*, and the plan specifies that implementation is held until Feature 042 is merged to the main branch, followed by a rebase of the 043 branch (`git rebase origin/main`) before coding begins. Sequenced under T000.

## Architecture & Focus Soundness

- [x] `LegalModal.js` rendering is decoupled and managed under the shell-level state controller (`setLegalDialog`) rather than mounting directly on `document.body` via dynamic controller open calls.
- [x] Scroll lock handles potential modal stack overlaps (e.g. opening legal modal on top of AuthOverlay) without breaking scroll restore.
- [x] Keyboard focus trap is explicitly detailed to prevent focus leaks outside of the active dialog or bottom sheet.
- [x] Layout breakpoints are translated from prototype container-width queries into real `@media` viewport queries.
- [x] Layered background spotlight-grid CSS recipe is integrated into `main.css`.

## Data Model & Dependency Risks

- [x] Technical plan confirms that no database updates, migrations, or data storage model changes are introduced.
- [x] Plan confirms that no new external libraries (npm packages or style scripts) are introduced.
- [x] Legal texts are planned as static constants/assets to avoid network request latency and offline failures.

## Constitution & Privacy Compliance

- [x] Offline-first and local-first compliance is satisfied (no external trackers, analytics, or CDN-hosted files).
- [x] Accessibility requirements are met (keyboard focus trap, ESC close path, visible focus outlines, and distinct link ARIA labels).
  - Focus trap, ESC close path, visible focus, distinct link ARIA labels, and proper ARIA roles (`role="dialog"`, `aria-modal="true"`, and `aria-labelledby` referencing the title node ID) are fully integrated into spec, plan, and tasks.

## Testing Strategy

- [x] Test cases in `Footer.test.js` are slated for modification to align assertions with the new 3-column, stack-removed structure.
- [x] A new test suite `LegalModal.test.js` is planned to assert overlay insertion, scroll-locking, and Escape key dismissal paths.

## Architectural Pivot Review & Sign-Off
- **Change**: Decoupled modal mounting from page-level elements to shell-level state (`setLegalDialog`).
- **Review Findings**:
  - Eliminates DOM mounting race conditions and z-index overlap bugs.
  - Ensures clean state management when stacking modals (e.g. `LegalModal` on top of `AuthOverlay`) without losing form inputs.
  - Maintains strict alignment with the app-shell layout specifications.
- **Verdict**: **APPROVED & SIGNED-OFF** for implementation starting Phase 02.
