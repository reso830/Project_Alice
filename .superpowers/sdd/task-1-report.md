# Task 1 Report: Refactor `ProfileEdit.js` to Export `openSetupGate` with Unified Visual Cards

## Status
- **Status:** DONE
- **Branch:** `feat/80-unify-creation-overlays`
- **Target File:** `src/pages/ProfileEdit.js`

## Changes Summary
1. **Refactored `createEntryGateCard`**:
   - Converted structure to use `.creation-picker-card` classes (`.creation-picker-card--parser`, `.creation-picker-card--locked`, `.creation-picker-card__icon`, `.creation-picker-card__title-row`, `.creation-picker-card__title`, `.creation-picker-card__badge`, `.creation-picker-card__desc`, `.creation-picker-card__bullets`, `.creation-picker-card__cta`).
   - Added click listener to the whole card to choose options if not locked.
   - Retained legacy class names (`.profile-entry-gate__card--${kind}`, `.profile-entry-gate__choose`, `.profile-entry-gate__settings-link`, `.profile-entry-gate__icon`, `.is-disabled`) to keep backwards compatibility and preserve green test status.

2. **Implemented `openSetupGate`**:
   - Replaced `showEntryGate` with the exported `openSetupGate` API.
   - Used CSS classes `.creation-picker-backdrop`, `.creation-picker-panel`, `.creation-picker-header`, `.creation-picker-title`, `.creation-picker-subtitle`, `.creation-picker-close`, `.creation-picker-content` for layout.
   - Retained backdrop class `.profile-entry-gate`, close button class `.profile-entry-gate__close`, and proper ARIA/role attributes to keep test compliance.
   - Added safe fallback default parameters to destructured callbacks (`onChooseManual`, `onDismiss`, `onImportSuccess`).

3. **Updated `createSmartResumeImport` and `openSmartInputModal`**:
   - Modified signature and handlers to accept `navigate`, `onChooseManual`, `onImportSuccess`, and `onDismiss` callbacks.
   - Configured fallback defaults to seamlessly support both modal-triggered imports and the inline profile-edit page import bar.
   - Resolved modal scope leakage by unconditionally invoking `closeEntryFlowModal()` on dismissal.

4. **Updated `mount` and Exports**:
   - Modify `mount` to accept `prefill`, `aiFields`, `meta`, and `entryGateDismissed`.
   - Set up automatic populating flow via `applyImportedResume` if `prefill` is passed.
   - Exported `openSetupGate` via named and default exports.
   - Removed unused legacy helper function `dismissEntryGate` to satisfy ESLint linter requirements.

## Test Verification
- Running `npm run test:run` confirms all tests pass successfully.
- **Pass rate**: 139/139 test files passed, 1859/1859 tests passed.
- Running `npm run lint` confirms ESLint code styling is clean with 0 violations.

## Concerns / Notes
- None. Maintaining the legacy classes alongside the new `.creation-picker-*` CSS classes is a highly robust solution that prevents breaking the existing unit tests in `ProfileEdit.test.js` (which is locked out of scope of this phase's file targets).
