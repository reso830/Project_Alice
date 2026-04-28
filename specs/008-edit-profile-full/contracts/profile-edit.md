# Contract: Edit Profile Page

**Branch**: `008-edit-profile-full` | **Date**: 2026-04-28

---

## Module: `src/pages/ProfileEdit.js`

### Exports

```js
export async function mount(container, { navigate } = {}) { ... }
export function unmount() { ... }
export const ProfileEdit = { mount, unmount };
```

### `mount(container, { navigate })`

**Responsibility**: Initialize the Edit Profile page. Fetches the current profile, renders the subheader and form, and wires up all interactivity.

| Parameter   | Type         | Description                                             |
|-------------|--------------|---------------------------------------------------------|
| `container` | `HTMLElement`| The `<main id="app">` element from `main.js`            |
| `navigate`  | `function`   | SPA navigation callback; called with `'profile'` on save/cancel |

**Side effects on mount**:
1. Renders `<div class="profile-edit-subheader">` into `document.body` after the navbar.
2. Shows `Navbar.setActive('profile')` so the Profile nav item is highlighted (this is handled in `main.js`).
3. Fetches profile via `getProfile()` and initializes `_formState` and `_initialState`.
4. Renders the full edit form into `container`.

**Side effects on unmount**:
1. Removes `.profile-edit-subheader` from `document.body`.
2. Clears `container`.
3. Resets all module-level state variables.

### `unmount()`

Called by `main.js` before navigating away. Cleans up DOM and state.

---

## Module: `src/utils/validate.js`

### Exports

```js
export function validateRequired(value) { ... }    // → string | null
export function validateMonthYear(value) { ... }   // → string | null
export function validateUrl(value) { ... }         // → string | null
export function validateEmail(value) { ... }       // → string | null
```

### Contract

All validators take a single string `value` and return:
- `null` — value is valid
- `string` — error message to display to the user

| Function              | Passes when                                          | Error message                                       |
|-----------------------|------------------------------------------------------|-----------------------------------------------------|
| `validateRequired(v)` | `v.trim()` is non-empty                              | `'This field is required.'`                         |
| `validateMonthYear(v)`| Matches `MM/YYYY`; month 01–12; year ≥ 1900          | `'Date must be in MM/YYYY format.'` or `'Month must be 01–12.'` or `'Year must be a valid four-digit year.'` |
| `validateUrl(v)`      | `new URL(v)` succeeds and protocol is `http:` or `https:` | `'Please enter a valid URL (http or https).'`   |
| `validateEmail(v)`    | Matches `/^[^@]+@[^@]+\.[^@]+$/` or is empty        | `'Email must be a valid email address.'`            |

---

## Module: `src/utils/sort.js`

### Exports

```js
export function sortEducation(entries) { ... }    // → EducationEntry[]
export function sortExperience(entries) { ... }   // → ExperienceEntry[]
```

### Contract

Both functions are pure (return a new sorted array, do not mutate input).

**`sortEducation(entries)`**:
- Sort by `parseInt(entry.yearCompleted)` descending.
- Entries where `yearCompleted` is not a valid integer sort to the end.

**`sortExperience(entries)`**:
- `currentWork === true` entries appear first.
- Remaining entries sorted by `dateEnded` descending. Parse as `YYYY * 100 + MM` integer for comparison.
- If `dateEnded` is equal or absent, sort by `dateStarted` descending as fallback.
- Unparseable date strings sort to the end of their group.

---

## Module: `src/models/profile.js` (updated)

### Updated exports (additions/changes only)

```js
export function normaliseProfile(data = {}) { ... }  // extended — handles new entry shapes
export function validateProfile(data = {}) { ... }   // extended — validates entry fields
// computeAppCounts, computeStats — unchanged
```

### Normalization contract

`normaliseProfile` must handle both old and new profile shapes without throwing. The following backward-compatibility mappings apply:

| Array field       | Old shape          | New shape                  | Mapping                              |
|-------------------|--------------------|----------------------------|--------------------------------------|
| `experience`      | `{ role, company, period, desc }` | `{ role, company, responsibilities, dateStarted, dateEnded, currentWork }` | `desc → responsibilities`; others default |
| `education`       | `{ degree, school, year }` | `{ degreeMajor, university, yearCompleted }` | direct key remap |
| `certifications`  | `string[]`         | `CertificationEntry[]`     | string → `{ name: string, issuingBody: '', ... }` |
| `awards`          | `string[]`         | `AwardEntry[]`             | string → `{ awardName: string, issuingBody: '', ... }` |
| `languages`       | `string[]`         | `LanguageEntry[]`          | string → `{ language: string, proficiency: '' }` |
| `links`           | `{ platform, label, url }` | `{ url, friendlyName }` | `label → friendlyName`; `platform` dropped |
| `skills`          | `string[]`         | `string[]` (unchanged)     | no change                            |

---

## API Contract (unchanged)

The server-side API contract is unchanged. The `PUT /api/profile` endpoint accepts a full profile object and returns the normalized saved profile.

**Request**: `PUT /api/profile`  
**Body**: Full profile object (JSON)  
**Success** `200`: `{ data: Profile }`  
**Validation error** `400`: `{ error: { code: 'VALIDATION_ERROR', message: '...', fields: { fieldName: 'msg' } } }`

Server-side `validateProfile` is extended to enforce required fields on entry objects (see data-model.md). The server continues to use the same `normaliseProfile` function from `src/models/profile.js` (shared module).

---

## CSS Classes (new/changed)

| Class                          | Purpose                                                        |
|--------------------------------|----------------------------------------------------------------|
| `.profile-edit-subheader`      | Sticky subheader bar below navbar (replaces `.profile-edit-nav`) |
| `.profile-edit-subheader__back`| Back button in subheader                                       |
| `.profile-edit-subheader__title`| "Edit Profile" title text                                     |
| `.profile-edit-page`           | Page container; updated max-width (900px)                      |
| `.page-controls`               | Top/bottom Save+Cancel control bar                             |
| `.page-controls__save`         | Save button in control bar; `disabled` when not dirty          |
| `.page-controls__cancel`       | Cancel button in control bar                                   |
| `.skill-pill`                  | Individual skill pill tag                                      |
| `.skill-pill__remove`          | × remove button on skill pill                                  |
| `.skills-input-row`            | Flex row containing skill text input + Add button              |
| `.inline-entry-form`           | Wrapper for inline add-entry form within a section             |
| `.inline-entry-form__actions`  | Add/Cancel button row in inline form                           |
| `.entry-row`                   | Displayed list row for language/cert/award/link entries        |
| `.entry-row__remove`           | Remove button on an existing entry row                         |
| `.confirm-backdrop`            | Full-screen backdrop for discard confirmation modal            |
| `.confirm-modal`               | Discard confirmation modal card                                |
| `.confirm-modal__title`        | Modal heading text                                             |
| `.confirm-modal__actions`      | Modal button row (Discard + Keep Editing)                      |

**Removed CSS classes**: `.profile-edit-nav`, `.profile-edit-nav__back`, `.profile-edit-nav__title`, `.edit-notice` (associated with removed topbar and placeholder banner).

---

## main.js changes

```js
} else if (page === 'profile-edit') {
  ProfileEdit.mount(appRoot, { navigate });
  _currentUnmount = ProfileEdit.unmount;
  _currentPage = page;
  Navbar.setActive('profile');   // ← ADD: highlight Profile tab while editing
  return;
}
```
