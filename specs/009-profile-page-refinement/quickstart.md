# Quickstart: Profile Page Refinements

**Branch**: `009-profile-page-refinement` | **Date**: 2026-04-29

---

## Prerequisites

- Node.js 20.x
- `npm install` completed at repo root

---

## Running the App

```sh
# Terminal 1 — backend
npm run server

# Terminal 2 — frontend
npm run dev
```

Open `http://localhost:5173`. Navigate to the Profile page via the top nav.

---

## Seeding a Test Profile

```sh
node server/db-seed-profile.js
```

Seeds a sample profile with entries in all sections (experience, education, skills, certifications, awards, languages, links). Required to verify structured display and Edit/Remove overlay flows.

---

## Clearing Profile Data

```sh
node server/db-clear-profile.js
```

Removes the profile record. On next load the Profile page shows the empty state.

---

## Running Tests

```sh
# All tests (single run)
npm run test:run

# Watch mode
npm test

# CI mode (JUnit output)
npm run test:ci
```

Key test files for this feature:

| File | Coverage |
|------|----------|
| `tests/pages/Profile.test.js` | Certifications and Awards structured display, partial data, non-regression |
| `tests/pages/ProfileEdit.test.js` | Section order, structured entry rows, Add-in-header button, modal/sheet open/close, focus trap, Skills staging, overlay discard flow, Edit pre-fill and in-place update |

---

## Linting

```sh
npm run lint
```

Fix issues before committing. The CI gate runs lint.

---

## Key Files for This Feature

| File | Status | Notes |
|------|--------|-------|
| `src/pages/Profile.js` | MODIFY | `renderCertifications` and `renderAwards` refactored to `profile-entry-list` structure |
| `src/pages/ProfileEdit.js` | MODIFY | Section reorder, `createStructuredEntryRow`, `createEditCard` with Add button, `createEntryOverlay`, per-section form builders, Skills staging overlay, Edit callbacks |
| `src/styles/main.css` | EXTEND | `.profile-entry__meta--secondary`, structured entry row classes, overlay/sheet CSS, overlay discard dialog CSS, iPad Mini stat chip fix |
| `tests/pages/Profile.test.js` | EXTEND | Four new assertions for Certifications/Awards structured display |
| `tests/pages/ProfileEdit.test.js` | EXTEND | New overlay, staging, discard, and Edit icon flow assertions |

No new source files are introduced. No backend changes. No database schema changes.

---

## Architectural Notes for Implementors

**Overlay open guard**:
```js
let _openOverlay = null;  // module-level; prevents double-open

function createEntryOverlay(title, buildForm, { onSave } = {}) {
  if (_openOverlay !== null) return;  // no-op if already open
  // ...
  _openOverlay = { close };
}
```

**isDirty snapshot — take from form, not initialValues**:
```js
function buildExperienceForm(formEl, initial = {}) {
  // ... create fields pre-filled from initial ...
  const snapshot = JSON.stringify(getFormData(fields));  // snapshot AFTER init
  const isDirty = () => JSON.stringify(getFormData(fields)) !== snapshot;
  return { validate, getData, isDirty };
}
```
Taking the snapshot from `getFormData(fields)` rather than `initialValues` avoids false-positive dirty detection in add mode (where `initialValues = {}` but fields initialize as empty strings).

**Edit icon in Phase 3 (inert) → Phase 7 (wired)**:
```js
// Phase 3 — icon renders, does nothing
createStructuredEntryRow(display, { onEdit: () => {}, onRemove });

// Phase 7 — replace noop with real callback
createStructuredEntryRow(display, { onEdit: () => openEditExperienceOverlay(entry, index), onRemove });
```

**Sort reference identity**:
```js
// onSave for Experience — must use sortExperience on the same object references
_formState.experience.splice(index, 1, data);
_formState.experience = sortExperience(_formState.experience);
// sortExperience must NOT clone entries — indexOf() depends on reference equality
```

**Skills staging**:
```js
function openSkillsOverlay() {
  const staged = [];  // modal-local; never mutates _formState.skills until Save
  createEntryOverlay('Add Skills', (formEl) => {
    // ... pill UI mutates staged[] only ...
    return { validate: () => true, getData: () => staged, isDirty: () => staged.length > 0 };
  }, { onSave: (data) => mergeSkills(data) });
}
```
