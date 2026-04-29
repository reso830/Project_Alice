# Tasks: Profile Page and Edit Profile UX Refinements

**Input**: Design documents from `/specs/009-profile-page-refinement/`  
**Prerequisites**: plan.md ✅ spec.md ✅

**Tests**: Constitution requires automated tests for any feature touching forms, validation, and user-visible rendering. All overlay form wiring, discard flows, and structured entry rendering require test coverage.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in same phase)
- **[Story]**: Maps to user story from spec.md (US1–US9)

---

## Phase 1: CSS Foundation

**Purpose**: Add all new CSS classes required by later phases. Has no code dependencies; can be done immediately.

- [X] T001 Add a `/* === Profile Refinements (009) === */` block to `src/styles/main.css` containing:
  - `.profile-entry__meta--secondary { font-size: 10px; color: var(--t3); }` — for optional Certificate ID line on View Profile certifications
  - `.entry-row--structured { align-items: flex-start; gap: 12px; }` — extends `.entry-row` for multi-line structured content
  - `.entry-row__content { flex: 1; min-width: 0; }` — holds the profile-entry title/meta/desc hierarchy
  - `.entry-row__actions { display: flex; gap: 6px; flex-shrink: 0; }` — right-side Edit + Remove button group
  - `.entry-row__edit { width: 26px; height: 26px; border: 1px solid var(--accent); border-radius: 4px; color: var(--accent); background: transparent; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; }` with `hover { background: var(--accent); color: #fff; }`
  - `.entry-overlay-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; }`
  - `.entry-modal { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 201; pointer-events: none; }` and `.entry-modal__box { position: relative; background: #fff; border-radius: 12px; padding: 28px; width: min(560px, 90vw); max-height: 85vh; overflow-y: auto; pointer-events: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.18); }`
  - `.entry-sheet { position: fixed; inset: 0; display: flex; align-items: flex-end; z-index: 201; pointer-events: none; }` and `.entry-sheet__box { position: relative; background: #fff; border-radius: 16px 16px 0 0; padding: 24px 20px 36px; width: 100%; max-height: 90vh; overflow-y: auto; pointer-events: auto; box-shadow: 0 -4px 24px rgba(0,0,0,0.12); }`
  - `.entry-overlay__header { margin-bottom: 20px; }`, `.entry-overlay__title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--navy); }`
  - `.entry-overlay__footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }`
  - `.overlay-discard-dialog { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: rgba(255,255,255,0.95); border-radius: inherit; padding: 24px; z-index: 1; }` and `.overlay-discard-dialog__msg { font-size: 14px; font-weight: 600; color: var(--navy); text-align: center; }`

**Checkpoint**: All visual primitives for overlays, structured rows, and the optional certificate ID are ready. No page code has changed yet.

---

## Phase 2: User Story 1 — Certifications and Awards Structured Display (Priority: P1)

**Goal**: Profile page Certifications section visually matches Education. Awards section visually matches Professional Experience.

**Independent Test**: With `npm run db:seed:profile`, view the Profile page. Certifications should show as structured rows (name → issuing body → dates) matching the Education section style. Awards should show as structured rows with a details paragraph matching the Experience style.

- [X] T002 [P] [US1] Refactor `renderCertifications(profile, container)` in `src/pages/Profile.js` — replace `profile-bullet-list profile-bullet-list--indigo` `<ul>`/`<li>` structure with a `profile-entry-list` `<div>` containing `profile-entry` items. For each entry: render `entry.name` as `profile-entry__title`; render `entry.issuingBody` as `profile-entry__meta` (omit element if absent/empty); render `[entry.issuanceDate, entry.expiryDate].filter(Boolean).join(' – ')` as a second `profile-entry__meta` (omit if both absent); render `entry.certificateId` prefixed with `"ID: "` as `profile-entry__meta profile-entry__meta--secondary` (omit if absent). No partial data should produce empty or broken elements.

- [X] T003 [P] [US1] Refactor `renderAwards(profile, container)` in `src/pages/Profile.js` — replace `profile-bullet-list profile-bullet-list--amber` `<ul>`/`<li>` structure with a `profile-entry-list` `<div>` containing `profile-entry` items. For each entry: render `entry.awardName` as `profile-entry__title`; render `[entry.issuingBody, entry.date].filter(Boolean).join(' | ')` as `profile-entry__meta` (omit element if both absent); render `entry.details` as `profile-entry__desc` `<p>` (omit element if absent or empty). Long details text wraps naturally via existing `profile-entry__desc` styles.

- [X] T004 [P] [US1] Update `tests/pages/Profile.test.js` — add the following tests:
  - `"renders certifications with structured entry hierarchy"` — mount with a profile containing one certification with all fields set; assert `.profile-entry-list` exists inside the Certifications subsection, the entry has `.profile-entry__title` with the cert name, a `.profile-entry__meta` with the issuing body, a `.profile-entry__meta` with the date, and a `.profile-entry__meta--secondary` with the certificate ID
  - `"renders certifications with partial data without breaking"` — cert with only `name` and `issuingBody`, no `expiryDate`, no `certificateId`; assert no empty `.profile-entry__meta` elements are rendered
  - `"renders awards with structured entry hierarchy"` — mount with an award having all fields; assert `.profile-entry__title` with award name, `.profile-entry__meta` with issuing body + date, `.profile-entry__desc` with details text
  - `"renders awards with no details and no date without breaking"` — award with only `awardName` and `issuingBody`; assert no empty elements

**Checkpoint**: View Profile certifications and awards render as structured entry rows. US1 is fully testable and deliverable independently.

---

## Phase 3: User Story 2, 3, and 4 — Edit Profile Structural Changes (Priority: P2)

**Goal**: Section order matches View Profile. Structured entries use View Profile visual hierarchy. Add buttons are in section headers with primary styling and label "Add".

**Independent Test**: Open the Edit Profile page with a seeded demo profile. Sections appear top-to-bottom in the correct order. Each Experience/Education/Certification/Award entry shows a structured title/meta layout with Edit and Remove icon buttons on the right. Each section header has a right-aligned "Add" button with the primary (filled indigo) style.

- [X] T005 [US2] Update `renderEditPage()` in `src/pages/ProfileEdit.js` — change the section card call order to: `renderBasicInfoCard`, `renderSummaryCard`, `renderExperienceCard`, `renderEducationCard`, `renderSkillsCard`, `renderCertificationsCard`, `renderAwardsCard`, `renderLanguagesCard`, `renderLinksCard`. No other changes to these functions in this task.

- [X] T006 [US4] Extend `createEditCard(title, { onAdd } = {})` in `src/pages/ProfileEdit.js` to accept an optional `onAdd` callback — when `onAdd` is provided, create a primary-styled button `createButton('Add', 'profile-btn profile-btn--primary', onAdd)` and append it to the section `header` element alongside the existing `label`. The `section-card__header` already uses `justify-content: space-between`, so the Add button appears right-aligned with no additional layout changes. Update all 7 section card render functions (`renderExperienceCard`, `renderEducationCard`, `renderSkillsCard`, `renderCertificationsCard`, `renderAwardsCard`, `renderLanguagesCard`, `renderLinksCard`) to pass their `onAdd` callback to `createEditCard` instead of calling `appendAddButton(body, ...)` inside the render loop — the `appendAddButton` body-based calls are removed from those functions (but `appendAddButton` itself is not deleted yet, as the section form builders in Phase 5 will remove the last remaining callers).

- [X] T007 [US3] Implement `createStructuredEntryRow(display, { onEdit, onRemove } = {})` in `src/pages/ProfileEdit.js` — creates `entry-row entry-row--structured` containing `entry-row__content` (holds `profile-entry__title` div if `display.title` provided; `profile-entry__meta` div if `display.meta` provided and non-empty; `profile-entry__desc` `<p>` if `display.desc` provided and non-empty) and `entry-row__actions` (holds Edit button `'✎'` with class `entry-row__edit` and `aria-label="Edit entry"` when `onEdit` provided; always holds Remove button `'×'` with class `entry-row__remove` and `aria-label="Remove entry"`).

- [X] T008 [P] [US3] Update `renderExperienceCard()` in `src/pages/ProfileEdit.js` — replace `createEntryRow([...], onRemove)` calls with `createStructuredEntryRow({ title: entry.role, meta: [entry.company, [entry.dateStarted, entry.currentWork ? 'Present' : entry.dateEnded].filter(Boolean).join(' – ')].filter(Boolean).join(' | '), desc: entry.responsibilities }, { onEdit: () => {}, onRemove: () => { const idx = _formState.experience.indexOf(entry); _formState.experience.splice(idx, 1); commitListChange(); render(); } })`. The `onEdit: () => {}` noop causes the Edit icon to render visibly but do nothing — the real callback is wired in Phase 7 (T024).

- [X] T009 [P] [US3] Update `renderEducationCard()` in `src/pages/ProfileEdit.js` — replace `createEntryRow` calls with `createStructuredEntryRow({ title: entry.degreeMajor, meta: [entry.university, entry.yearCompleted].filter(Boolean).join(' | ') }, { onEdit: () => {}, onRemove: () => { ... } })`. Edit icon renders visibly but inert — wired in Phase 7 (T025).

- [X] T010 [P] [US3] Update `renderCertificationsCard()` in `src/pages/ProfileEdit.js` — replace `createEntryRow` calls with `createStructuredEntryRow({ title: entry.name, meta: [entry.issuingBody, entry.issuanceDate, entry.expiryDate].filter(Boolean).join(' | ') }, { onEdit: () => {}, onRemove: () => { ... } })`. Edit icon renders visibly but inert — wired in Phase 7 (T026).

- [X] T011 [P] [US3] Update `renderAwardsCard()` in `src/pages/ProfileEdit.js` — replace `createEntryRow` calls with `createStructuredEntryRow({ title: entry.awardName, meta: [entry.issuingBody, entry.date].filter(Boolean).join(' | '), desc: entry.details || '' }, { onEdit: () => {}, onRemove: () => { ... } })`. Edit icon renders visibly but inert — wired in Phase 7 (T027).

- [X] T012 [P] [US3] Update `renderLanguagesCard()` in `src/pages/ProfileEdit.js` — replace `createEntryRow` calls with `createStructuredEntryRow({ title: entry.language, meta: entry.proficiency }, { onEdit: () => {}, onRemove: () => { ... } })`. Edit icon renders visibly but inert — wired in Phase 7 (T028).

- [X] T013 [P] [US3] Update `renderLinksCard()` in `src/pages/ProfileEdit.js` — replace the custom anchor-row DOM code with `createStructuredEntryRow({ title: getLinkLabel(entry.url, entry.friendlyName), meta: entry.url }, { onEdit: () => {}, onRemove: () => { ... } })`. Note: the anchor tag in the view-only Profile page is preserved; the edit page entry row shows the friendly name / hostname as plain title text with the URL as meta. Edit icon renders visibly but inert — wired in Phase 7 (T029).

**Checkpoint**: Edit page sections are in the correct order. All structured entries show a title/meta/desc hierarchy with Edit and Remove icons (Edit icon is visible but inert until Phase 7). Every section header has a right-aligned "Add" button with primary styling. US2, US3, and US4 are independently verifiable at this point.

---

## Phase 4: User Story 5 and 7 — Entry Overlay Infrastructure (Priority: P1)

**Goal**: Clicking "Add" in any section opens a modal (desktop ≥ 640 px) or bottom sheet (mobile < 640 px) with Cancel and Save actions. Cancel with dirty form shows discard confirmation with toast.

**Independent Test**: With `window.innerWidth = 1024`, click "Add" on the Professional Experience section. A modal overlay with a backdrop, a title, form fields, Cancel, and Save should appear. Fill Role and click Save — the entry should commit to the section and the modal should close. Fill Role, click Cancel — a discard dialog should appear. Confirm discard — modal closes, toast shows.

- [X] T014 [US5] Implement `createEntryOverlay(title, buildForm, { onSave, initialValues = {} } = {})` in `src/pages/ProfileEdit.js`:
  - Guard: if `_openOverlay !== null`, return early (no-op)
  - Detects viewport: `window.innerWidth >= 640` → creates `.entry-modal` wrapping `.entry-modal__box`; else creates `.entry-sheet` wrapping `.entry-sheet__box`
  - Creates `.entry-overlay-backdrop`, appends backdrop and overlay to `document.body`, sets `document.body.style.overflow = 'hidden'`
  - Creates `.entry-overlay__header` with title, `.entry-overlay__form` container, `.entry-overlay__footer` with Cancel (outline) + Save (primary) buttons
  - Calls `const { validate, getData, isDirty } = buildForm(formEl)` to populate the form area; `validate()` returns boolean and surfaces inline field errors; `getData()` returns the entry object; `isDirty()` compares current form field values against the snapshot taken by `buildForm` after field initialization — NOT compared against `initialValues` directly (this avoids false-positive dirty detection: `initialValues = {}` but fields initialize as empty strings, so comparing `{}` vs `{ role: '' }` would always be "dirty")
  - `handleSave()`: if `!validate()` return; call `onSave(getData())`; call `close()`
  - `handleCancel()`: if `!isDirty()` → `close()`; else → `showOverlayDiscardDialog(container, { onDiscard: () => { close(); Toast.show('Changes discarded.', 'success'); } })`
  - `close()`: removes backdrop and overlay from DOM, restores `document.body.style.overflow = ''`, sets `_openOverlay = null`
  - ESC keydown on `document` → `handleCancel` (listener cleaned up in `close()`)
  - Backdrop click → `handleCancel`
  - Focus trap: add `keydown` listener on the overlay element; on Tab (and Shift+Tab), query all focusable elements inside the overlay (`button, input, select, textarea, [tabindex]:not([tabindex="-1"])`), clamp focus to first/last element in the list; listener cleaned up in `close()`
  - On open, move focus to the first focusable element inside the overlay
  - Stores `_openOverlay = { close }` on open; returns `{ close }`
  - Add `let _openOverlay = null` to module-level state in `ProfileEdit.js`

- [X] T015 [US7] Implement `showOverlayDiscardDialog(boxEl, { onDiscard })` in `src/pages/ProfileEdit.js`:
  - Accepts `boxEl` — a direct reference to the open `.entry-modal__box` or `.entry-sheet__box` passed from `handleCancel` in `createEntryOverlay` (the `container` variable). Do NOT use `document.querySelector` to locate the box.
  - Creates `.overlay-discard-dialog` div and appends it to `boxEl`
  - Contains `.overlay-discard-dialog__msg` with text "Discard entry changes?", a "Discard" button (danger-styled primary, calls `dialog.remove()` then `onDiscard()`), and a "Keep Editing" button (outline, calls `dialog.remove()` only)
  - While the dialog is visible it covers the form below (handled by `position: absolute; inset: 0` and `z-index: 1` from Phase 1 CSS); no additional scroll lock needed since the overlay already locks the body

**Checkpoint**: The overlay infrastructure is functional. A modal or bottom sheet can be opened and closed with discard confirmation. Both behaviors can be manually tested before any section form is wired in.

---

## Phase 5: User Story 5 Continued — Per-Section Form Builders and Modal Wiring (Priority: P1)

**Goal**: Every section's Add button opens an overlay with the correct form fields and validation. Adding an entry via the overlay commits it to the main form and closes the overlay.

**Independent Test**: For each of the six sections (Experience, Education, Certifications, Awards, Languages, Links), click Add, fill required fields, click Save. The entry should appear in the section and the overlay should close. Leaving required fields blank and clicking Save should surface inline errors inside the overlay.

- [X] T016 [P] [US5] Implement `buildExperienceForm(formEl, initial = {})` in `src/pages/ProfileEdit.js` and wire `renderExperienceCard()`:
  - `buildExperienceForm`: creates Role (required), Company (required), Responsibilities textarea (required), Date Started (required, `validateMonthYear`), Current Work checkbox, Date Ended (disabled+dimmed via `edit-field--disabled` when checked, required+enabled when unchecked, `validateMonthYear`); appends date fields in `inline-entry-form__row inline-entry-form__row--dates` row; wires `currentWork.change` to `syncDateEnded()`; takes snapshot `JSON.stringify(getFormData(fields))` on creation; returns `{ validate: () => validateFields(rules), getData: () => ({ role, company, responsibilities, dateStarted, dateEnded, currentWork }), isDirty: () => snapshot !== JSON.stringify(getFormData(fields)) }`
  - Wire: update `renderExperienceCard` to pass `onAdd: () => createEntryOverlay('Add Experience', (el) => buildExperienceForm(el), { onSave: (data) => { _formState.experience = sortExperience([..._formState.experience, data]); commitListChange(); render(); } })` to `createEditCard`

- [X] T017 [P] [US5] Implement `buildEducationForm(formEl, initial = {})` and wire `renderEducationCard()`:
  - Fields: Degree & Major (required), University (required), Year Completed (required); returns `{ validate, getData, isDirty }`
  - `onSave`: push entry, re-sort via `sortEducation`, call `commitListChange()`, call `render()`

- [X] T018 [P] [US5] Implement `buildCertificationsForm(formEl, initial = {})` and wire `renderCertificationsCard()`:
  - Fields: Certification Name (required), Issuing Body (required), Certificate ID (optional), Issuance Date (required, `validateMonthYear`), Expiry Date (optional, `validateMonthYear` when non-empty via `optionalMonthYear`); Issuance Date and Expiry Date placed in `inline-entry-form__row inline-entry-form__row--two`

- [X] T019 [P] [US5] Implement `buildAwardsForm(formEl, initial = {})` and wire `renderAwardsCard()`:
  - Fields: Award Name (required), Issuing Body (required), Details textarea (optional), Date (optional, `optionalMonthYear`)

- [X] T020 [P] [US5] Implement `buildLanguagesForm(formEl, initial = {})` and wire `renderLanguagesCard()`:
  - Fields: Language text (required), Proficiency `<select>` (Beginner / Intermediate / Professional / Fluent, required) via `createSelectField`; Language and Proficiency placed in `inline-entry-form__row inline-entry-form__row--two`

- [X] T021 [P] [US5] Implement `buildLinksForm(formEl, initial = {})` and wire `renderLinksCard()`:
  - Fields: Link URL (required, `validateUrl` which rejects non-http/https), Friendly Name (optional)
  - `getData` returns `{ url: url.input.value.trim(), friendlyName: normalizeWhitespace(friendlyName.input.value) }`

- [X] T022 [US5] Remove stale helpers from `src/pages/ProfileEdit.js` now that all 6 structured sections use overlay-based Add:
  - Delete `appendAddButton()` (no remaining callers)
  - Delete `canOpenInlineForm()` and `hasOpenInlineForm()` (overlay `_openOverlay` guard replaces this)
  - Delete `renderOpenFormError()` and remove the `hasOpenInlineForm()` guard block from `handleSave()` (the inline form Save-blocking check is no longer needed)
  - Remove `.open-form-error` CSS rule from `src/styles/main.css` if it has no other references

**Checkpoint**: Every structured section's Add button opens an overlay with validated form fields. Entries commit on Save and the overlay closes. The old inline form pattern is fully replaced.

---

## Phase 6: User Story 6 — Skills Staging Overlay (Priority: P2)

**Goal**: The Skills "Add" button opens an overlay with a local staging area. Skills are staged as pills inside the overlay and committed to the main form only when the overlay Save is clicked.

**Independent Test**: Click "Add" in the Skills section. Type "Python" and click the inline Add inside the overlay — "Python" should appear as a pill inside the overlay but NOT in the main Skills section. Type "JavaScript" and press Enter — it stages too. Click overlay Save — both skills appear in the main Skills section and the overlay closes. Reopen, stage a skill, click Cancel — discard dialog appears.

- [X] T023 [US6] Implement `openSkillsOverlay()` in `src/pages/ProfileEdit.js`:
  - Guard: if `_openOverlay !== null`, return early
  - Initialize `const staged = []` (modal-local; never mutates `_formState.skills` until Save)
  - Define `renderStagedPills(pillWrap)`: clears and re-renders pills for `staged` array; each pill is `createElement('span', 'skill-pill', skill)` with a `'×'` remove button that splices from `staged` and calls `renderStagedPills`
  - Define `buildSkillsForm(formEl)`: appends `.skills-input-row` (text input + "Add" button side by side) and `.skills-pills-wrap` (empty initially); inline Add trims input, checks case-insensitive duplicate against `staged` and `_formState.skills`, pushes to `staged`, clears input, calls `renderStagedPills`; pressing Enter in the text input triggers inline Add; returns `{ validate: () => true, getData: () => staged, isDirty: () => staged.length > 0 }`
  - Wire to `createEntryOverlay('Add Skills', buildSkillsForm, { onSave: (data) => { mergeSkills(data); } })`
  - `mergeSkills(data)`: for each skill in `data`, if `_formState.skills.map(s => s.toLowerCase()).includes(skill.toLowerCase())` skip, else push; call `commitListChange()` and re-render the Skills card body
  - Update `renderSkillsCard()` to pass `onAdd: () => openSkillsOverlay()` to `createEditCard` and remove the old inline text-input-row from the skills card body (existing pills with × remove buttons in the main form are preserved as-is)

**Checkpoint**: Skills staging works end-to-end. Staging does not mutate the main form. Save merges and deduplicates. Cancel with staged skills triggers discard confirmation.

---

## Phase 7: User Story 8 — Edit Existing Entry (Priority: P2)

**Goal**: Each structured entry has an Edit icon that opens the section's overlay pre-filled with that entry's data. Saving from the edit overlay updates the correct entry in-place.

**Independent Test**: With a seeded profile, open Edit Profile. Click the Edit icon on an Experience entry. The overlay should open with all fields pre-filled with that entry's data. Change the Role, click Save. The entry in the section should show the updated role. No duplicate entry should be added.

- [X] T024 [P] [US8] Implement `openEditExperienceOverlay(entry, index)` in `src/pages/ProfileEdit.js` and wire the `onEdit` placeholder in T008:
  - Calls `createEntryOverlay('Edit Experience', (el) => buildExperienceForm(el, entry), { onSave: (data) => { _formState.experience.splice(index, 1, data); _formState.experience = sortExperience(_formState.experience); commitListChange(); render(); }, initialValues: entry })`
  - Replace the `/* placeholder */` in T008's `onEdit` callback with `() => openEditExperienceOverlay(entry, _formState.experience.indexOf(entry))`

- [X] T025 [P] [US8] Implement `openEditEducationOverlay(entry, index)` and wire T009's `onEdit`:
  - `createEntryOverlay('Edit Education', (el) => buildEducationForm(el, entry), { onSave: (data) => { _formState.education.splice(index, 1, data); _formState.education = sortEducation(_formState.education); commitListChange(); render(); }, initialValues: entry })`

- [X] T026 [P] [US8] Implement `openEditCertificationOverlay(entry, index)` and wire T010's `onEdit`:
  - `createEntryOverlay('Edit Certification', (el) => buildCertificationsForm(el, entry), { onSave: (data) => { _formState.certifications.splice(index, 1, data); commitListChange(); render(); }, initialValues: entry })`

- [X] T027 [P] [US8] Implement `openEditAwardOverlay(entry, index)` and wire T011's `onEdit`:
  - `createEntryOverlay('Edit Award', (el) => buildAwardsForm(el, entry), { onSave: (data) => { _formState.awards.splice(index, 1, data); commitListChange(); render(); }, initialValues: entry })`

- [X] T028 [P] [US8] Implement `openEditLanguageOverlay(entry, index)` and wire T012's `onEdit`:
  - `createEntryOverlay('Edit Language', (el) => buildLanguagesForm(el, entry), { onSave: (data) => { _formState.languages.splice(index, 1, data); commitListChange(); render(); }, initialValues: entry })`

- [X] T029 [P] [US8] Implement `openEditLinkOverlay(entry, index)` and wire T013's `onEdit`:
  - `createEntryOverlay('Edit Link', (el) => buildLinksForm(el, entry), { onSave: (data) => { _formState.links.splice(index, 1, data); commitListChange(); render(); }, initialValues: entry })`

**Checkpoint**: All six sections have functional Edit icons. Editing pre-fills the overlay; saving updates in-place; section sort is re-applied where applicable.

---

## Phase 8: User Story 9 — iPad Mini Stat Chip Fix (Priority: P3)

**Goal**: Stat chips in the Applications dashboard section do not overflow at iPad Mini viewport width (~768 px). Chips can wrap into a 2 × 2 grid within the desktop stats column.

**Independent Test**: Open the Profile page at 768 px viewport width. All four stat chips (Total, Active, Pending, Offer) should be fully readable with no horizontal overflow. At 1280 px the existing desktop layout should be unchanged. At 375 px the existing mobile layout should be unchanged.

- [X] T030 [US9] Add CSS rule to `src/styles/main.css` (outside any media query, scoped to the desktop stats column): `.apps-desktop-vis__stats .stat-chip-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }` — this overrides the global `repeat(4, minmax(0, 1fr))` rule only within the left column of the desktop applications layout, producing a 2 × 2 chip grid at all viewport widths where `.apps-desktop-vis` is visible (≥ 640 px). The `apps-mobile-vis .stat-chip-row` rule at `@media (max-width: 639px)` is unaffected.

**Checkpoint**: iPad Mini stat chip overflow is resolved. Desktop and mobile layouts are confirmed unchanged.

---

## Phase 9: Tests and Quality Gates

**Purpose**: Automated test coverage for all user stories. Lint and test suite must be clean before this feature is considered complete.

- [ ] T031 [P] [US1] Tests are already added in T004 (Phase 2). Verify `tests/pages/Profile.test.js` passes with all four new assertions covering certifications structured display and awards structured display. Also confirm the existing `"renders a saved profile and wires edit navigation"` test still passes — it asserts Experience, Education, and Skills content via `container.textContent` and serves as the non-regression guard for those unchanged sections after the certifications/awards refactor.

- [X] T032 [P] [US2] Add section order test to `tests/pages/ProfileEdit.test.js`:
  - `"Edit Profile section cards appear in View Profile order"` — mount with a full profile, collect the `textContent` of all `.section-label` elements in DOM order; assert the sequence matches the expected order (Basic Info → Summary → Professional Experience → Education → Skills → Certifications → Awards → Languages → Links)

- [X] T033 [P] [US3+US4] Add structural UI tests to `tests/pages/ProfileEdit.test.js`:
  - `"Experience entries use structured hierarchy with title and meta"` — mount with a profile containing one experience entry; assert the Experience card contains `.profile-entry__title` with the role text and `.profile-entry__meta` with company info
  - `"Add button appears in section header with primary styling"` — assert each section card header (Experience, Education, Skills, Certifications, Awards, Languages, Links) contains a button with textContent `'Add'` and class `profile-btn--primary`
  - `"each structured entry has accessible Edit and Remove icon buttons"` — mount with a profile containing one experience entry; assert the entry row has a button with `aria-label="Edit entry"` and a button with `aria-label="Remove entry"`. (The Edit icon renders in Phase 3 via the `onEdit: () => {}` noop; it is functional in Phase 7. This test only asserts presence, not behavior.)

- [ ] T034 [P] [US5] Add overlay integration tests to `tests/pages/ProfileEdit.test.js`:
  - `"opens modal on desktop when Add is clicked in Experience section"` — set `window.innerWidth = 1024`, click the header Add button in the Experience card, assert `.entry-modal` exists in `document.body` and `.entry-overlay__title` contains 'Add Experience'
  - `"opens bottom sheet on mobile when Add is clicked in Experience section"` — set `window.innerWidth = 375`, click Add, assert `.entry-sheet` exists and `.entry-modal` does not
  - `"closes overlay and restores body scroll after successful Save"` — fill required Experience fields, click Save, assert `.entry-modal` is gone and `document.body.style.overflow === ''`
  - `"validates required fields inside overlay and keeps overlay open on failure"` — click Save without filling Role, assert `.field-error` with a message is visible inside `.entry-modal` and the overlay is still present
  - `"invalid MM/YYYY date in overlay shows inline error"` — open Experience Add overlay, fill Role and Company, enter `'baddate'` in the Date Started field, click Save; assert a `.field-error` element is visible inside the overlay with a date validation message and the overlay remains open
  - `"committed entry appears in Experience section after overlay Save"` — fill required fields, Save, assert a `.profile-entry__title` with the role appears in the Experience card
  - `"clicking Add while an overlay is open has no effect"` — open an Experience overlay, click the Education Add button, assert only one overlay exists in the DOM
  - `"Tab key stays trapped inside the open overlay"` — open an Experience overlay; collect all focusable elements inside it; dispatch a Tab keydown while the last focusable element is focused; assert focus wraps back to the first focusable element inside the overlay

- [ ] T035 [P] [US6] Add Skills staging tests to `tests/pages/ProfileEdit.test.js`:
  - `"Skills Add button opens overlay with staging input and empty pill area"` — click Skills Add, assert overlay contains a text input and an empty `.skills-pills-wrap`
  - `"staging a skill adds it as a pill inside the overlay only"` — type 'Python', click inline Add, assert `.skill-pill` with 'Python' exists inside the overlay; assert 'Python' is NOT yet in the Skills section in the page body
  - `"pressing Enter in skill input stages the skill"` — type 'Go', dispatch Enter keydown on the input, assert 'Go' staged as pill
  - `"overlay Save commits staged skills to main form"` — stage 'Python', click overlay Save, assert 'Python' appears in the Skills section of the page and overlay is closed
  - `"duplicate skill is not staged"` — mount with `skills: ['Python']`; open Skills overlay, type 'python' (lowercase), click inline Add, assert no duplicate pill staged
  - `"Cancel with staged skill triggers discard dialog"` — stage 'Python', click overlay Cancel, assert `.overlay-discard-dialog` appears
  - `"Cancel with no staged skills closes overlay immediately"` — open Skills overlay, click Cancel without staging, assert overlay is gone and no discard dialog appears

- [ ] T036 [P] [US7] Add overlay discard tests to `tests/pages/ProfileEdit.test.js`:
  - `"Cancel on blank add overlay closes immediately"` — open Experience overlay, click Cancel with all fields empty, assert overlay is gone and no discard dialog
  - `"Cancel on dirty add overlay shows discard dialog"` — open Experience overlay, fill Role field, click Cancel, assert `.overlay-discard-dialog` is visible
  - `"dirty-state revert closes overlay immediately on Cancel"` — open Experience overlay, fill the Role field, then clear it back to empty; click Cancel; assert the overlay closes immediately with no discard dialog (form has returned to its initial empty state, so `isDirty()` returns false)
  - `"Discard closes overlay and shows toast"` — in discard dialog click Discard, assert overlay is gone and `Toast.show` was called with a success message
  - `"Keep Editing closes dialog and preserves overlay and form state"` — in discard dialog click 'Keep Editing', assert dialog is gone, overlay is still open, Role field still has its value
  - `"ESC triggers Cancel behavior"` — open dirty overlay, dispatch Escape keydown on document, assert discard dialog appears

- [ ] T037 [P] [US8] Add Edit icon flow tests to `tests/pages/ProfileEdit.test.js`:
  - **Testing strategy note**: Edit icon *presence* is asserted in T033 (Phase 3). Edit overlay *behavior* is tested here because real `onEdit` callbacks are not wired until T024–T029 (Phase 7). T037 tests what happens when the Edit icon is clicked — pre-fill, in-place update, and discard flow — all of which require Phase 7 wiring to be in place.
  - `"Edit icon opens overlay pre-filled with entry data"` — mount with a profile containing one experience entry (role 'Senior Engineer'); click the Edit icon on that entry, assert overlay opens with the Role input value equal to 'Senior Engineer'
  - `"Save from edit overlay updates entry in-place"` — in the pre-filled edit overlay, change the role to 'Staff Engineer', Save; assert the Experience section shows 'Staff Engineer' and the entry count is unchanged (no duplicate)
  - `"Edit then Cancel with changed value shows discard dialog"` — open edit overlay, change role, click Cancel, assert discard dialog
  - `"Remove icon still removes the entry"` — click Remove on an experience entry, assert the section no longer contains that entry

- [ ] T038 Run `npm run lint` — must pass with no errors or warnings across `src/`, `tests/`, `server/`, and `shared/`.

- [ ] T039 Run `npm run test:run` — all 205+ tests must pass. Confirm no regressions in Tracker, Calendar, or any existing Profile / ProfileEdit tests.

**Checkpoint**: All new tests pass, lint is clean, and no regressions exist. Feature is ready for PR.

---

## Non-Goals (Do Not Implement)

- New profile data fields or schema changes
- Avatar / photo upload
- Compatibility scoring changes
- Dashboard redesign beyond the iPad Mini stat chip fix
- Backend schema or API changes
- Autosave or draft persistence
- Animation for bottom sheet slide-up (desirable but not required)
- Link platform detection (LinkedIn vs GitHub auto-labelling)
