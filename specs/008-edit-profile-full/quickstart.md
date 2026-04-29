# Quickstart: Edit / Create Profile — Full Implementation

**Branch**: `008-edit-profile-full` | **Date**: 2026-04-28

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

Open `http://localhost:5173` in a browser. Navigate to the Profile page via the top nav, then click "Set Up Profile" or "Edit Profile" to reach `/profile-edit`.

---

## Seeding a Test Profile

```sh
node server/db-seed-profile.js
```

This inserts a sample profile record. On next page load the Profile page will show the profile-exists state.

---

## Clearing Profile Data

```sh
node server/db-clear-profile.js
```

This removes the profile record. On next load the Profile page will show the empty state.

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
| `tests/pages/ProfileEdit.test.js` | Page mount/unmount, save, cancel, dirty state, discard modal, section interactions |
| `tests/models/profile.test.js` | Extended normaliseProfile (entry shapes, backward compat), extended validateProfile |
| `tests/utils/validate.test.js` | `validateMonthYear`, `validateUrl`, `validateRequired`, `validateEmail` |
| `tests/utils/sort.test.js` | `sortEducation`, `sortExperience` sort order correctness |
| `tests/server/profile.test.js` | API persistence with new entry shapes |

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
| `src/pages/ProfileEdit.js` | REWRITE | Full replacement |
| `src/models/profile.js` | EXTEND | New entry normalisers and validators |
| `src/utils/validate.js` | NEW | Shared validators (MM/YYYY, URL, required, email) |
| `src/utils/sort.js` | NEW | `sortEducation`, `sortExperience` |
| `src/styles/main.css` | EXTEND | Subheader, pill, inline form, modal, responsive grid CSS |
| `src/main.js` | MODIFY | Add `Navbar.setActive('profile')` for `profile-edit` route |
| `server/db/profile.js` | UNCHANGED | Schema unchanged; normaliseProfile handles migration |
| `tests/pages/ProfileEdit.test.js` | REWRITE | Architecture changes require full test update |
| `tests/utils/validate.test.js` | NEW | |
| `tests/utils/sort.test.js` | NEW | |

---

## Architectural Notes for Implementors

**Form state pattern**:
```js
let _formState = null;   // live editable copy
let _initialState = null; // snapshot at load time

function isDirty() {
  return JSON.stringify(_formState) !== JSON.stringify(_initialState);
}
```

**Save flow**:
```js
async function handleSave() {
  if (!isDirty()) return;
  // 1. Check no open inline form
  // 2. Client-side validate _formState
  // 3. await saveProfile(_formState)
  // 4. On success: navigate('profile'), Toast.show('Profile saved.', 'success')
  // 5. On error: Toast.show('Could not save profile. Please try again.', 'error')
}
```

**Cancel flow**:
```js
function handleCancel() {
  if (!isDirty()) { navigate('profile'); return; }
  showDiscardModal({
    onConfirm: () => { navigate('profile'); Toast.show('Edits discarded.', 'success'); },
    onDismiss: () => closeDiscardModal(),
  });
}
```

**Subheader injection**:
```js
function renderSubheader(navigate) {
  const bar = document.createElement('div');
  bar.className = 'profile-edit-subheader';
  // ... append back button + title
  const navbar = document.querySelector('.navbar');
  navbar.insertAdjacentElement('afterend', bar);
  _subheader = bar;
}
```

**Dirty tracking on input**:
```js
input.addEventListener('input', () => {
  _formState.firstName = input.value;
  updateControlsState(); // enable/disable Save buttons
});
```

**Section list mutation pattern**:
```js
function addSkill(skill) {
  const trimmed = skill.trim();
  if (!trimmed) return;
  const lower = trimmed.toLowerCase();
  if (_formState.skills.some(s => s.toLowerCase() === lower)) return;
  _formState.skills = [..._formState.skills, trimmed];
  updateControlsState();
  reRenderSkillPills(skillsContainer);
}
```
