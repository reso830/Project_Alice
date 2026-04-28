# Tasks: Edit / Create Profile — Full Implementation

**Input**: Design documents from `/specs/008-edit-profile-full/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Core validation tests are REQUIRED by the constitution — this feature touches forms, persistence, URLs, and dates.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in same phase)
- **[Story]**: Maps to user story from spec.md (US1–US5)

---

## Phase 1: Setup (Shared Utilities)

**Purpose**: Create new utility modules that have no dependencies and unblock all later phases.

- [X] T001 [P] Create `src/utils/validate.js` with exports: `validateRequired`, `validateMonthYear`, `validateUrl`, `validateEmail` — each returns `null` on pass or an error string on fail; `validateMonthYear` rejects non-MM/YYYY, month outside 01–12, year < 1900; `validateUrl` uses `new URL()` and rejects any protocol other than `http:` or `https:`
- [X] T002 [P] Create `src/utils/sort.js` with exports: `sortEducation(entries)` (by `yearCompleted` desc, non-numeric to end) and `sortExperience(entries)` (`currentWork === true` first, then `dateEnded` desc parsed as YYYY×100+MM, then `dateStarted` desc as fallback; treat empty string `dateEnded` as absent, sorting to end of non-current group)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data model, routing, and CSS must be complete before any page work begins.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [X] T003 [P] Create `tests/utils/validate.test.js` — unit tests for all four validators: `validateRequired` (empty/blank/filled), `validateMonthYear` (valid, bad month 13, bad year 24, wrong format), `validateUrl` (valid https, valid http, javascript:, data:, malformed), `validateEmail` (valid, invalid, empty)
- [X] T004 [P] Create `tests/utils/sort.test.js` — unit tests for `sortEducation` (desc by year, non-numeric at end) and `sortExperience` (current first, ended by dateEnded desc, dateStarted fallback; empty string dateEnded sorts to end of non-current group)
- [X] T005 [P] Add backward-compat normalisers to `src/models/profile.js`: `normaliseExperienceEntry` (maps old `desc→responsibilities`, passes new keys through; sets `currentWork: false`, `dateStarted: ''`, `dateEnded: ''` as defaults), `normaliseEducationEntry` (maps old `degree→degreeMajor`, `school→university`, `year→yearCompleted`), `normaliseCertificationEntry` (plain string→`{name}` object with other fields empty), `normaliseAwardEntry` (plain string→`{awardName}` object — `issuingBody` will be empty and is required; migrated entries will fail validation at save time, prompting the user to update their profile), `normaliseLanguageEntry` (plain string→`{language, proficiency:''}` object), `normaliseLinkEntry` (maps old `label→friendlyName`, drops `platform`; plain string→`{ url: entry, friendlyName: '' }` — preserve the string as the URL value rather than discarding, allowing the URL validator to surface it if invalid)
- [X] T006 Update `normaliseProfile` in `src/models/profile.js` to call the new per-type normalisers for each array field (replacing the generic `normaliseEntryArray` call for `experience`, `education`, `certifications`, `awards`, `languages`, `links`); filter out null results; `skills` continues to use `normaliseStringArray` unchanged
- [X] T007 Extend `validateProfile` in `src/models/profile.js` to validate structured entry fields: required `role`, `company`, `responsibilities` in experience entries; required `degreeMajor`, `university`, `yearCompleted` in education entries; required `name` and `issuanceDate` in certification entries; required `awardName` and `issuingBody` in award entries; required `language` and valid `proficiency` (one of `PROFICIENCY_LEVELS`) in language entries; required `url` in link entries
- [X] T008 Extend `tests/models/profile.test.js` with: backward-compat normalisation tests for each entry type (old key shapes map correctly), new entry shape normalisation (new keys pass through), and extended `validateProfile` tests for entry-level required fields
- [X] T009 Update `src/main.js`: in the `profile-edit` branch of `navigate()`, add `Navbar.setActive('profile')` so the Profile nav item stays highlighted on the edit page; remove the early `return` that was skipping `Navbar.setActive`
- [X] T010 Add CSS to `src/styles/main.css` in a `/* === Profile Edit (008) === */` block:
  - `.profile-edit-subheader` (sticky, `top: 48px`, dark navy, 44px, flex, z-index below navbar)
  - `.profile-edit-subheader__back` (ghost button, white text) and `.profile-edit-subheader__title` (13px, 700)
  - `.profile-edit-page` max-width updated from 680px to 900px
  - `.edit-fields-grid` (two-column grid at ≥640px) and `.edit-field--full` (spans both columns)
  - `.page-controls` (flex row, justify-content: flex-end, gap 8px, padding 12px 0)
  - `.skills-pills-wrap` (flex-wrap, gap 6px, margin-bottom 10px) and `.skill-pill` / `.skill-pill__remove`
  - `.skills-input-row` (flex, gap 8px)
  - `.inline-entry-form` (section card body style, padding-top 12px, border-top 1px solid var(--border-2))
  - `.inline-entry-form__actions` (flex, justify-content: flex-end, gap 8px, margin-top 8px)
  - `.entry-row` (flex, align-items center, justify-content space-between, padding 8px 0, border-bottom) and `.entry-row__remove` (ghost icon button)
  - `.open-form-error` (persistent inline error shown below the top `.page-controls` when save is blocked by an open inline form; red/warning text, 13px, margin-top 4px)
  - `.confirm-backdrop` (fixed inset 0, z-index 500, semi-transparent black) and `.confirm-modal` (centered card, max-width 400px, padding 24px)
  - `.confirm-modal__title` (14px 700), `.confirm-modal__body` (13px muted), `.confirm-modal__actions` (flex, gap 8px, justify-content flex-end, margin-top 16px)
  - Mobile overrides at `@media (max-width: 639px)` for `.profile-edit-page` padding, `.edit-fields-grid` single-column, `.profile-edit-subheader` safe area handling

**Checkpoint**: Utilities, data model, routing, and CSS ready — user story work can begin.

---

## Phase 3: User Story 1 — Create Profile from Scratch (Priority: P1) 🎯 MVP

**Goal**: A user with no saved profile can open `/profile/edit`, see blank fields, fill them in, save, and be returned to the Profile page with a success toast.

**Independent Test**: With no profile in storage, navigate to `/profile/edit`. All fields should be blank. Fill in First Name, Last Name, click Save. Verify the Profile page shows the newly saved data and a success toast.

- [X] T011 [US1] Rewrite `src/pages/ProfileEdit.js` structural scaffold: remove `renderTopbar()`, `hideNavbar()`/`_navbar`/`_previousNavbarDisplay` state; add module-level `_subheader`, `_formState`, `_initialState`, `_saving` variables; add `isDirty()` (JSON.stringify comparison) and `updateControlsState()` (toggles `.disabled` on all `.page-controls__save` buttons and restores their text to 'Save'); add `deepClone(obj)` helper (JSON.parse/stringify)
- [X] T012 [US1] Add `renderSubheader(navigate)` to `src/pages/ProfileEdit.js`: creates `.profile-edit-subheader` div with back button (`← Profile`, calls `handleCancel`) and title (`Edit Profile`); inserts via `document.querySelector('.navbar').insertAdjacentElement('afterend', bar)`; stores in `_subheader`; update `unmount()` to call `_subheader?.remove()` and reset `_subheader = null`
- [X] T013 [US1] Add `renderPageControls()` to `src/pages/ProfileEdit.js`: creates a `.page-controls` div with Cancel button (outline, calls `handleCancel`) and Save button (primary, `.page-controls__save`, initially `disabled`, calls `handleSave`); called twice in `renderEditPage()` — once before the first section card (top) and once after the last (bottom)
- [X] T014 [US1] Update `mount()` in `src/pages/ProfileEdit.js`: fetch profile, initialize `_formState = deepClone(normaliseProfile(profile ?? {}))` and `_initialState = deepClone(_formState)`, call `renderSubheader`, render top controls, section cards, bottom controls; blank form state correctly produces empty fields when profile is null
- [X] T015 [US1] Implement `renderBasicInfoCard(page)` in `src/pages/ProfileEdit.js` wired to `_formState`: First Name, Last Name (`.edit-fields-grid` row 1), City/Location (`.edit-field--full`), Email + Phone (row 3); each input wired to `_formState` field on `input` event; calls `updateControlsState()` on change; remove section-level Save/Cancel
- [X] T016 [US1] Implement `renderSummaryCard(page)` in `src/pages/ProfileEdit.js` wired to `_formState`: large textarea (rows 6), pre-filled from `_formState.summary`; updates `_formState.summary` on `input`; calls `updateControlsState()`; remove section-level Save/Cancel
- [X] T017 [US1] Implement `handleSave()` in `src/pages/ProfileEdit.js`: guard `!isDirty() || _saving`; call `hasOpenInlineForm()` guard — if open, render a persistent `.open-form-error` element directly after the top `.page-controls` with text 'Please finish or cancel the open form before saving.' and return (do NOT use a toast); remove any existing `.open-form-error` at the start of each `handleSave()` call; immediately before `await saveProfile`, disable all `.page-controls__save` buttons and set their text to 'Saving…'; set `_saving = true`; call `saveProfile(_formState)`; on success: `navigate('profile')`, `Toast.show('Profile saved.', 'success')`; on failure: `Toast.show('Could not save profile. Please try again.', 'error')`, stay on page, preserve state; in `finally`: reset `_saving = false`, restore button text to 'Save', call `updateControlsState()`
- [X] T018 [US1] Implement `handleCancel()` in `src/pages/ProfileEdit.js`: if `!isDirty()`, call `navigate('profile')`; else call `showDiscardModal()`
- [X] T019 [US1] Implement `showDiscardModal()` in `src/pages/ProfileEdit.js`: append `.confirm-backdrop` and `.confirm-modal` to `document.body`; set `document.body.style.overflow = 'hidden'`; modal shows title "Discard changes?", body "Your edits will be lost.", "Keep Editing" button (closes modal), "Discard" button (calls `navigate('profile')`, `Toast.show('Edits discarded.', 'success')`); backdrop click and Escape key close modal; `closeDiscardModal()` removes backdrop and restores `overflow`
- [X] T020 [US1] Add client-side validation to `handleSave()` using `validateProfile(_formState)`: if invalid, surface `firstName`/`lastName` errors below the Basic Info fields and abort save; use existing `.field-error` pattern
- [X] T021 [US1] Rewrite `tests/pages/ProfileEdit.test.js`: update helpers (`getTopControls`, `getBottomControls`, `getSaveButton`, `getCancelButton`); cover:
  - blank form on new profile (all inputs empty)
  - Save disabled on load; both top and bottom `.page-controls__save` buttons are disabled
  - Save enabled after any field edit; both buttons enable simultaneously
  - **dirty→clean reversion**: set `firstName` to a new value (assert Save enables); revert to original value (assert Save disables again)
  - **list reversion**: add a skill then remove it; assert Save disables again
  - save in-progress: both Save buttons show 'Saving…' text and are disabled during the async call
  - successful save calls `saveProfile` + triggers navigation to 'profile' + shows success toast
  - save failure shows error toast, stays on page, preserves form state; Save button restored to enabled (`updateControlsState()` called)
  - Cancel with no changes navigates directly without modal
  - Cancel with changes shows discard modal
  - modal Discard: navigates to 'profile' + shows discard toast
  - modal Keep Editing: closes modal, edits remain intact
  - **hasOpenInlineForm blocks save**: open a section's inline form, click Save — assert `saveProfile` is NOT called and a `.open-form-error` element appears after the top controls (not a toast)
  - subheader back button calls `handleCancel` (not direct navigate): back while dirty shows modal; back while clean navigates directly
  - `unmount()` removes `.profile-edit-subheader` with no orphaned elements after navigation
  - bottom Cancel button with unsaved changes shows discard modal (same as top Cancel)

**Checkpoint**: First-time profile creation fully functional and tested. Profile can be created from a blank form. US4 (subheader) and US5 (dual controls) behaviors verified in this phase's tests.

---

## Phase 4: User Story 2 — Edit Existing Profile (Priority: P1)

**Goal**: A user with a saved profile opens `/profile/edit` and sees all fields pre-populated with their saved values. Edits are saved correctly.

**Independent Test**: With a complete profile in storage, navigate to `/profile/edit`. Verify all Basic Info and Summary fields contain the saved values. Modify a field, save, and confirm the Profile page reflects the change.

- [X] T022 [US2] Verify `mount()` in `src/pages/ProfileEdit.js` correctly pre-populates `_formState` from an existing profile — all `normaliseProfile()` string fields map to input values and `_initialState` snapshot matches the loaded data so Save starts disabled
- [X] T023 [US2] Update `src/pages/Profile.js` display rendering to handle new entry shapes: use `responsibilities` instead of `desc` and `dateStarted`/`dateEnded`/`currentWork` in experience display; use `degreeMajor`/`university`/`yearCompleted` in education display; render certification/award/language entries as objects (show `entry.name`, `entry.language + entry.proficiency`, etc.); render links using `entry.friendlyName || new URL(entry.url).hostname` as anchor text with `target="_blank" rel="noopener noreferrer"`; update `tests/pages/Profile.test.js` to use new entry shapes so existing tests continue to pass
- [X] T024 [US2] Extend `tests/server/profile.test.js` with: round-trip test for an experience entry with new shape (`responsibilities`, `dateStarted`, `currentWork`), round-trip for education with new keys, round-trip for certification/award/language/link object entries; verify backward-compat by saving old-shaped data and confirming it normalises correctly on read; **server rejects invalid entries**: PUT `/api/profile` with an experience entry missing `role` → assert response is 400 with `{ error: { code: 'VALIDATION_ERROR' } }`; repeat for a link entry missing `url`
- [X] T025 [US2] Extend `tests/pages/ProfileEdit.test.js`: add test that mounts with a full profile and verifies each Basic Info input value matches the profile data; add test that modifies a pre-loaded field and confirms save sends updated `_formState`

**Checkpoint**: Edit mode fully functional — existing profile data loads and saves correctly.

---

## Phase 5: User Story 3 — List-Based Section Management (Priority: P1)

**Goal**: All seven list sections (Skills, Languages, Certifications, Education, Experience, Links, Awards) support inline add and remove, with validation, sorting where required, and dirty state tracking.

**Independent Test**: For each section, verify: existing entries render on load; Add button opens inline form; valid entry commits and appears; invalid entry is rejected; Cancel discards form; remove button removes entry; dirty state triggers after any list change.

- [X] T026 [P] [US3] Implement `renderSkillsCard(page)` in `src/pages/ProfileEdit.js`: render `_formState.skills` as `.skills-pills-wrap` with `.skill-pill` elements each having a `.skill-pill__remove` button that splices from `_formState.skills` and re-renders; below pills, render `.skills-input-row` (text input + Add button); Add validates non-empty via `validateRequired`, normalises whitespace, checks case-insensitive duplicate (`toLowerCase()` comparison) before pushing to `_formState.skills`; clears input after add; do NOT wire the Enter key on the skills input — submission is via the Add button only; calls `updateControlsState()` on add/remove
- [X] T027 [P] [US3] Implement `renderLanguagesCard(page)` in `src/pages/ProfileEdit.js`: render `_formState.languages` as `.entry-row` rows (language name + proficiency badge + remove button); "Add Language" button calls `hasOpenInlineForm()` on click — if any form is already open, do nothing (enforce one-at-a-time); otherwise set `isAddingLanguage = true` and re-render body; inline form has Language text input (required) and Proficiency `<select>` with Beginner/Intermediate/Professional/Fluent (required); Add validates both fields, pushes `{ language, proficiency }` to `_formState.languages`, resets flag; Cancel resets flag; calls `updateControlsState()` on add/remove
- [X] T028 [P] [US3] Implement `renderCertificationsCard(page)` in `src/pages/ProfileEdit.js`: render `_formState.certifications` as `.entry-row` rows (name + issuanceDate + remove button); "Add Certification" button respects one-at-a-time via `hasOpenInlineForm()`; inline form: Certification Name (required), Issuing Body (optional), Certificate ID (optional), Issuance Date (required, `validateMonthYear`), Expiry Date (optional, `validateMonthYear` when non-empty); Add validates required fields and date formats, pushes `CertificationEntry` to `_formState.certifications`, resets flag; calls `updateControlsState()`
- [X] T029 [P] [US3] Implement `renderEducationCard(page)` in `src/pages/ProfileEdit.js`: render `_formState.education` sorted by `sortEducation()` as `.entry-row` rows (degreeMajor + university + yearCompleted + remove button); "Add Education" button respects one-at-a-time; inline form: Degree & Major (required), University (required), Year Completed (required); Add validates all required, pushes entry, re-sorts `_formState.education` via `sortEducation()`, resets flag; calls `updateControlsState()`
- [X] T030 [US3] Implement `renderExperienceCard(page)` in `src/pages/ProfileEdit.js`: render `_formState.experience` sorted by `sortExperience()` as cards (role + company + dateStarted–dateEnded or "Present" + remove button); "Add Experience" button respects one-at-a-time; inline form: Role (required), Company (required), Responsibilities textarea (required), Date Started (required, `validateMonthYear`), Current Work checkbox (default unchecked), Date Ended (hidden when checked, shown+required when unchecked, `validateMonthYear`); checkbox `change` event shows/hides Date Ended; Add validates all applicable fields, pushes `ExperienceEntry`, re-sorts via `sortExperience()`, resets flag; calls `updateControlsState()`
- [X] T031 [P] [US3] Implement `renderLinksCard(page)` in `src/pages/ProfileEdit.js`: render `_formState.links` as `.entry-row` rows each containing an `<a href target="_blank" rel="noopener noreferrer">` showing `friendlyName || new URL(url).hostname` as anchor text; "Add Link" button respects one-at-a-time; inline form: Link URL (required, `validateUrl` — rejects unsafe protocols), Friendly Name (optional); Add commits `{ url, friendlyName }` entry; calls `updateControlsState()`
- [X] T032 [P] [US3] Implement `renderAwardsCard(page)` in `src/pages/ProfileEdit.js`: render `_formState.awards` as `.entry-row` rows (awardName + issuingBody + remove button); "Add Award" button respects one-at-a-time; inline form: Award Name (required), Issuing Body (required), Details textarea (optional), Date (optional, `validateMonthYear` when non-empty); Add validates required fields and optional date, pushes `AwardEntry`, resets flag; calls `updateControlsState()`
- [X] T033 [US3] Call all section card renderers in `renderEditPage()` in `src/pages/ProfileEdit.js`: Skills, Languages, Certifications, Education, Professional Experience, Links, Awards — in the order specified by the design; all sections render between Summary and the bottom controls
- [X] T034 [US3] Add `hasOpenInlineForm()` to `src/pages/ProfileEdit.js` that returns `true` if any `.inline-entry-form` element exists in the document; all section Add buttons call this guard before opening their form (one-at-a-time enforcement); `handleSave()` also calls this guard and renders a persistent `.open-form-error` element after the top controls if blocked — remove the error element when the inline form is closed or when `handleSave()` runs again
- [X] T035 [P] [US3] Extend `tests/pages/ProfileEdit.test.js` for Skills: add skill → pill appears; add exact-same-case duplicate → not added; add different-case duplicate (e.g. 'TypeScript' then 'typescript') → not added (case-insensitive check); remove pill → disappears; dirty state set after add/remove; dirty state re-clears when add is followed by remove restoring the original list
- [X] T036 [P] [US3] Extend `tests/pages/ProfileEdit.test.js` for Languages: Add Language opens form; valid entry commits; missing language field shows error; Cancel discards; dirty state set; clicking Add Language while another section's inline form is open has no effect (one-at-a-time)
- [X] T037 [P] [US3] Extend `tests/pages/ProfileEdit.test.js` for Experience: Current Work checkbox hides Date Ended; unchecking Current Work shows Date Ended as required; invalid MM/YYYY (e.g. '13/2024') rejected; valid entry commits and is sorted current-first; `sortExperience` applied
- [X] T038 [P] [US3] Extend `tests/pages/ProfileEdit.test.js` for Links: unsafe URL (`javascript:`, `data:`) rejected with validation feedback; valid https URL accepted; friendly name used as anchor text when provided; blank friendly name falls back to `new URL(url).hostname` as anchor text

**Checkpoint**: All seven list sections are functional with inline add, remove, validation, and sorting. One-at-a-time form constraint enforced across all sections.

---

## Phase 6: Polish, Responsive QA & Final Validation

**Purpose**: Responsive layout verification, integration QA, lint, and test run.

- [ ] T039 [P] Manually verify desktop layout: open the edit page at ≥ 640px viewport; confirm Basic Info fields use two-column grid (First Name + Last Name in row 1, City full-width, Email + Phone in row 3); confirm page content is wider than old 680px; confirm section cards have readable spacing
- [ ] T040 [P] Manually verify mobile layout: open at < 640px viewport; confirm all sections are single-column; confirm inline add forms do not overflow; confirm both Save/Cancel control groups are visible and tappable; confirm subheader back action is accessible; confirm no horizontal scrollbar
- [ ] T041 Update `server/db-seed-profile.js` to seed all entry arrays using new entry shapes: experience with `responsibilities`, `dateStarted`, `dateEnded`, `currentWork`; education with `degreeMajor`, `university`, `yearCompleted`; certifications with `name`, `issuingBody`, `issuanceDate` (MM/YYYY format); awards with `awardName`, `issuingBody`, `date` (MM/YYYY format); languages with `language`, `proficiency`; links with `url`, `friendlyName` — ensures integration QA runs against valid new-format data
- [ ] T042 Integration QA — create flow: clear profile data (`node server/db-clear-profile.js`), navigate to Profile page, click "Set Up Profile", fill all sections including at least one entry per list section, save, confirm Profile page shows all saved data with correct entry shapes
- [ ] T043 Integration QA — edit flow: seed profile (`node server/db-seed-profile.js`), navigate to edit page, confirm pre-population of all fields and sections, modify a field in each section, save, confirm Profile page reflects all changes
- [ ] T044 Integration QA — discard flow: make edits, click Cancel, confirm discard modal appears; click Discard, confirm navigation + discard toast; repeat but click Keep Editing, confirm modal closes and edits are still present
- [ ] T045 Integration QA — validation: attempt to add Experience with invalid date (e.g. `13/2024`) — confirm rejection with error message; attempt to add a `javascript:` link URL — confirm rejection; attempt to save with First Name blank — confirm field error; attempt to save with an open inline form — confirm persistent `.open-form-error` appears after top controls (not a toast); confirm `Navbar.setActive('profile')` highlights the Profile tab while on the edit page
- [ ] T046 Integration QA — regression: navigate Tracker and Calendar pages after profile edit flow; confirm no regressions; run `npm run test:run` and confirm all tests pass
- [ ] T047 Run `npm run lint` and fix any reported issues in modified files (`src/pages/ProfileEdit.js`, `src/models/profile.js`, `src/utils/validate.js`, `src/utils/sort.js`, `src/main.js`, `src/pages/Profile.js`, `server/db-seed-profile.js`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No dependencies — start immediately, both tasks run in parallel
- **Phase 2** (Foundational): Depends on Phase 1 completion — **BLOCKS all user story phases**
- **Phase 3** (US1): Depends on Phase 2 — core page rebuild; also verifies US4/US5 behaviors in T021
- **Phase 4** (US2): Depends on Phase 3 — pre-population layered on top
- **Phase 5** (US3): Depends on Phase 3 — list sections build on the form state and controls from US1
- **Phase 6** (Polish): Depends on Phases 3–5

### User Story Dependencies

- **US1 (P1)**: Start after Phase 2 — no story dependencies
- **US2 (P1)**: Start after US1 — pre-population requires form state scaffolding
- **US3 (P1)**: Start after US1 — section renderers require form state and controls
- **US4 (P2)**: Verified in T021 — subheader and back button behavior built and tested in Phase 3
- **US5 (P2)**: Verified in T021 — dual controls and synchronized state built and tested in Phase 3

### Within Each Phase

- All `[P]`-marked tasks in a phase can run simultaneously
- Model changes (T005–T007) precede page changes (T011+)
- Tests for a phase should be run after implementation tasks in that phase complete

### Parallel Opportunities

**Phase 1**: T001 and T002 run simultaneously (different files).

**Phase 2**: T003/T004 (test files), T005 (model normalisers), and T010 (CSS) run simultaneously. T006/T007 depend on T005.

**Phase 5**: T026–T032 (individual section renderers) can all run in parallel — each is a separate `renderXCard()` function appended to the page. T033 depends on all of T026–T032.

---

## Parallel Example: Phase 5 (List Sections)

```
Parallel batch — all independent section implementations:
  T026  renderSkillsCard()         src/pages/ProfileEdit.js
  T027  renderLanguagesCard()      src/pages/ProfileEdit.js
  T028  renderCertificationsCard() src/pages/ProfileEdit.js
  T029  renderEducationCard()      src/pages/ProfileEdit.js
  T030  renderExperienceCard()     src/pages/ProfileEdit.js
  T031  renderLinksCard()          src/pages/ProfileEdit.js
  T032  renderAwardsCard()         src/pages/ProfileEdit.js

Then sequential:
  T033  Wire all sections into renderEditPage()
  T034  Add hasOpenInlineForm() guard and one-at-a-time enforcement
  T035–T038  Test coverage per section (can also run in parallel)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T010) — critical gate
3. Complete Phase 3: User Story 1 (T011–T021)
4. **STOP and VALIDATE**: blank form renders, Save saves, Cancel with dirty shows modal, toast fires
5. At this point the create-profile flow is production-ready

### Incremental Delivery

1. Phase 1 + Phase 2 → utilities and data model ready
2. Phase 3 → working create flow (MVP), subheader and controls built and verified
3. Phase 4 → working edit flow (existing data loads)
4. Phase 5 → all list sections (full profile management)
5. Phase 6 → polish, QA, lint, green tests

### Non-Goals (do not implement)

- Avatar photo upload
- Advanced date pickers (plain text inputs are correct)
- Autosave or draft mode
- Profile scoring changes
- Changes to the main Profile page beyond display compatibility (T023)
- Edit-in-place for existing list entries (remove + re-add is sufficient)
- Enter key in any text input triggering an add action — submission is button-only throughout

---

## Notes

- `[P]` tasks have no intra-phase dependency — they touch separate functions or files
- All section renderers in Phase 5 modify the same file (`ProfileEdit.js`) but target separate named functions; coordinate to avoid merge conflicts if working in parallel
- Commit after each phase checkpoint at minimum
- Run `npm run test:run` at each checkpoint to catch regressions early
- The `tests/pages/ProfileEdit.test.js` rewrite in T021 replaces the existing 4-test file entirely; the old section-level save tests are no longer valid after the architecture change
- US4 (subheader) and US5 (dual controls) are built in Phase 3 and their verification assertions are integrated into T021 — no separate verification phase is needed
