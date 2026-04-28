# Research: Edit / Create Profile — Full Implementation

**Branch**: `008-edit-profile-full` | **Date**: 2026-04-28

---

## 1. State Architecture — Centralized vs Per-Section

**Decision**: Replace per-section independent saves with a single centralized `_formState` object that mirrors the full profile shape.

**Rationale**: The current per-section save pattern in `ProfileEdit.js` works for isolated fields but cannot support global Save/Cancel with dirty state tracking, top+bottom control groups, or a discard confirmation modal. A single form state makes dirty comparison and validation straightforward.

**Alternatives considered**:
- Keep per-section saves, add a global "save all" that calls each section — rejected because it requires coordinating async results from multiple sections, and duplicate save buttons would be hard to synchronize.
- React/Preact state library — rejected; no framework is in use and adding one violates the "no new dependencies without justification" principle.

---

## 2. Dirty State Detection Strategy

**Decision**: Deep comparison via `JSON.stringify` of `_formState` against `_initialState` (a snapshot taken when the page loads), run on every form change event.

**Rationale**: The form state is a plain JSON-serializable object. `JSON.stringify` comparison is reliable for this shape (no Date objects, no circular refs, no functions). A flag-based approach would require instrumenting every individual field change handler, which is more fragile.

**Alternatives considered**:
- Individual field-level `_isDirty` flags — rejected; tedious to maintain across 7+ list sections and prone to desync if a revert is missed.
- Proxy-based reactivity — rejected; overkill for this codebase and adds complexity.

---

## 3. Discard Confirmation Modal

**Decision**: Implement as a lightweight inline overlay within `ProfileEdit.js` — a backdrop `<div>` plus a centered modal `<div>`, not a shared component.

**Rationale**: The existing `Modal.js` is purpose-built for application status editing with specific controls (status dropdown, detail display). Adapting it for a generic confirm/discard pattern would require significant rework. An inline overlay is 30–40 lines, stays local to ProfileEdit, and avoids coupling.

**Alternatives considered**:
- Reuse `Modal.js` — rejected; wrong abstraction, would require modal rework.
- New `ConfirmModal.js` shared component — reasonable but premature generalization if this is the only use case. Can be extracted later if needed.

---

## 4. Subheader Bar Strategy

**Decision**: Restore the navbar (stop hiding it), and add a new `<div class="profile-edit-subheader">` bar rendered by `ProfileEdit.mount()` into `document.body` after the navbar, positioned `sticky` at `top: 48px`.

**Rationale**: The spec requires the standard nav bar to remain visible. The current implementation hides it and renders a bespoke topbar (`profile-edit-nav`). The subheader adds the Edit Profile title and back action without touching the navbar component.

**Implementation notes**:
- `main.js` must call `Navbar.setActive('profile')` when navigating to `'profile-edit'` so the Profile tab stays highlighted.
- `ProfileEdit.unmount()` removes the subheader from `document.body`.
- CSS: `.profile-edit-subheader` uses `position: sticky; top: 48px; z-index: calc(var(--z-nav) - 1)`.

**Alternatives considered**:
- Move subheader into `#app` container — rejected; `#app` is cleared on navigation, so sticky behavior requires the bar to live outside `#app`.

---

## 5. Inline Entry Form Pattern

**Decision**: Each list section manages a boolean `isAddingEntry` flag in its local closure. When true, the section body swaps the "Add X" button for an inline entry form. On commit or cancel, the form is removed and the button restored.

**Rationale**: Inline forms are small and section-specific. A shared `InlineForm` class would need to handle 7 different shapes and would increase abstraction without simplifying implementation. Section-local closures match the existing DOM-manipulation style of the codebase.

**Alternatives considered**:
- Shared inline form factory — acceptable for a second pass if duplication becomes significant; not introduced in phase 1.

---

## 6. Data Model Migration and Backward Compatibility

**Decision**: Extend `normaliseProfile` to handle both old string-array shapes (for `certifications`, `awards`, `languages`) and new object-array shapes. Keep `experience` and `education` as object arrays but update the field names. Old data with mismatched keys falls back to empty arrays.

**Rationale**: An existing saved profile uses old field names (`degree`/`school`/`year` for education; `role`/`company`/`period`/`desc` for experience; plain strings for certifications, awards, languages). If the user has saved profile data, the normaliser must not silently corrupt it on the next load.

**Migration strategy**:
- `normaliseExperienceEntry(entry)` maps old keys to new keys where present, passes through new keys otherwise.
- `normaliseEducationEntry(entry)` same treatment.
- `normaliseCertificationEntry(entry)` handles plain strings (old) → `{ name: string }` (new) + object shape.
- `normaliseAwardEntry(entry)` same treatment.
- `normaliseLanguageEntry(entry)` handles plain strings → `{ language: string, proficiency: '' }` (new).
- `normaliseLinkEntry(entry)` maps old `{ platform, label, url }` → new `{ url, friendlyName }`.

**Alternatives considered**:
- Breaking migration (clear old data on load) — rejected; would cause data loss for users with existing profiles.
- Separate migration endpoint — rejected; overkill for a single-user local app.

---

## 7. Save-on-Page-Level Only (Remove Per-Section Pre-Save Refresh)

**Decision**: Remove the per-section "refresh profile from server before merge" pattern. The centralized save sends `_formState` as a single PUT.

**Rationale**: The refresh-before-merge was needed to avoid one section overwriting another's data during concurrent saves. With a single unified save, there are no concurrent section saves. The form state is the authoritative in-memory state; its content is fully committed on Save.

**New save flow**:
1. Client-side validate `_formState` (required fields, formats)
2. Check no open inline forms
3. `saveProfile(_formState)` → `PUT /api/profile`
4. On success: `navigate('profile')`, `Toast.show('Profile saved.', 'success')`
5. On failure: `Toast.show('Could not save profile. Please try again.', 'error')`; stay on page

---

## 8. URL Validation for Links

**Decision**: Validate link URLs by attempting `new URL(value)` and checking `protocol` is `'http:'` or `'https:'`.

**Rationale**: `new URL()` is natively available in all modern browsers and handles parsing, normalization, and edge cases correctly. Rejecting anything outside `http:`/`https:` covers the spec's requirement to block `javascript:`, `data:`, and malformed URLs.

**Alternatives considered**:
- Regex-based URL validation — rejected; regexes for URLs are notoriously error-prone.

---

## 9. MM/YYYY Validation

**Decision**: Validate with regex `^(0[1-9]|1[0-2])\/\d{4}$` then check month 01–12 and year ≥ 1900.

**Rationale**: A tight regex prevents most garbage input without needing a full date parser. The year floor of 1900 is a reasonable lower bound for professional/education history.

---

## 10. Sorting Utilities

**Decision**: Add `sortEducation(entries)` and `sortExperience(entries)` to `src/utils/sort.js` (new file).

**Rationale**: Sorting logic is pure and testable independently of the UI. Keeping it in `utils/` follows the existing pattern (`date.js`, `pagination.js`, `filterSort.js`).

**Sort specifications**:
- Education: `parseInt(yearCompleted)` descending; non-numeric years sort to end.
- Experience: `currentWork === true` first; then by `dateEnded` descending (parse MM/YYYY as sortable YYYY*100+MM integer); then by `dateStarted` descending as fallback.

---

## 11. Page Layout Width

**Decision**: Change `.profile-edit-page` from `max-width: 680px` to `max-width: 900px`. On desktop, introduce a two-column grid for Basic Info fields (First Name + Last Name in row, City on full width, Email + Phone in row).

**Rationale**: 680px is narrow on modern displays. 900px better utilizes available space while staying readable. The two-column field grid is only applied at ≥ 640px breakpoint.

---

## 12. No New npm Dependencies

**Decision**: All new functionality (validation, sorting, modal, inline forms) is implemented with vanilla JS. No new packages.

**Rationale**: Required by the constitution: "New dependencies MUST be introduced only when they clearly reduce complexity or improve maintainability." The functionality required here is straightforwardly implementable without libraries.
