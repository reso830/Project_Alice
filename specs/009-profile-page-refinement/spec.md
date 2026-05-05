# Feature Specification: Profile Page Refinements

**Feature Branch**: `009-profile-page-refinement`  
**Created**: 2026-04-29  
**Status**: Approved  
**Design Reference**: `design/profile_page.md` · `specs/008-edit-profile-full/spec.md`

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Certifications and Awards use structured entry presentation on View Profile (Priority: P1)

A user with a complete profile views the Profile page. The Certifications section now looks like the Education section — each certification is a structured row with a primary name, supporting issuing body text, and date metadata. The Awards section looks like the Professional Experience section — each award is a structured row with a primary name, supporting issuing body, date metadata, and a descriptive details paragraph.

**Why this priority**: Certifications and Awards are currently bullet lists that flatten all fields into one joined string. Structured presentation is the highest visual regression and the simplest to deliver independently, requiring only Profile.js and CSS changes with no modal or interaction work.

**Independent Test**: With a seeded demo profile (`npm run db:seed:profile`), navigate to the Profile page. Verify each Certification entry renders with a distinct primary name line, issuing body line, and date metadata — matching the Education entry card style. Verify each Award entry renders with a distinct primary name, issuing body, date metadata, and a details paragraph — matching the Professional Experience entry card style.

**Acceptance Scenarios**:

1. **Given** a profile has certifications, **When** the user views the Profile page, **Then** each certification is displayed with its name as the primary text, issuing body as supporting text, and issuance / expiry dates as metadata.
2. **Given** a certification has no expiry date or certificate ID, **When** it renders, **Then** the absent fields are omitted cleanly without breaking the layout.
3. **Given** a certification has a certificate ID, **When** it renders, **Then** the certificate ID appears as optional secondary metadata.
4. **Given** a profile has awards, **When** the user views the Profile page, **Then** each award is displayed with its name as the primary text, issuing body as supporting text, date as metadata, and details as a descriptive body paragraph.
5. **Given** an award has no date or details, **When** it renders, **Then** the absent fields are omitted cleanly without breaking the layout.
6. **Given** an award has a long details text, **When** it renders, **Then** the text wraps naturally without overflowing or truncating.

---

### User Story 2 — Edit Profile sections follow View Profile order (Priority: P2)

A user on the Edit Profile page finds the sections in the same order as the View Profile page: Basic Info, Summary, Professional Experience, Education, Skills, Certifications, Awards, Languages, Links. Previously the order differed (Skills and Languages appeared before Experience and Education), which was disorienting when switching between the two views.

**Why this priority**: Order alignment is a pure UI reorder with no data model impact. It is a prerequisite for the visual consistency improvements in US3.

**Independent Test**: Open the Edit Profile page. Verify the section cards appear top-to-bottom in this exact order: Basic Info, Summary, Professional Experience, Education, Skills, Certifications, Awards, Languages, Links.

**Acceptance Scenarios**:

1. **Given** the user is on the Edit Profile page, **When** the page renders, **Then** sections appear in this exact order: Basic Info, Summary, Professional Experience, Education, Skills, Certifications, Awards, Languages, Links.
2. **Given** a section is empty (no entries), **When** the page renders, **Then** that section still appears in the correct position with its Add button available.

---

### User Story 3 — Edit Profile entries use View Profile visual hierarchy (Priority: P2)

A user editing their profile sees Experience, Education, Certification, and Award entries that look like the corresponding cards on the View Profile page — only with Edit and Remove quick action icons added on the right. They can clearly recognize which entry they are about to edit or remove.

**Why this priority**: Consistent visual language between view and edit modes reduces cognitive load and makes the editor feel like a natural extension of the profile rather than a separate interface.

**Independent Test**: With a profile containing entries in each structured section, open the Edit Profile page. Verify that an Experience entry shows role, company/date, and responsibilities text in the same hierarchy as on the View Profile page — with Edit and Remove icons on the right.

**Acceptance Scenarios**:

1. **Given** Experience entries exist, **When** the user views the Edit Profile page, **Then** each entry shows role as primary text, company and date range as supporting text, and responsibilities as body text — plus Edit and Remove icons on the right.
2. **Given** Education entries exist, **When** the user views the Edit Profile page, **Then** each entry shows degree/major as primary text and university + year as supporting metadata — plus Edit and Remove icons.
3. **Given** Certification entries exist, **When** the user views the Edit Profile page, **Then** each entry shows the certification name as primary text, issuing body as supporting text, and dates as metadata — plus Edit and Remove icons.
4. **Given** Award entries exist, **When** the user views the Edit Profile page, **Then** each entry shows the award name as primary text, issuing body as supporting text, date as metadata, and details as body text — plus Edit and Remove icons.

---

### User Story 4 — Add buttons are right-aligned in section headers and use primary styling (Priority: P2)

A user on the Edit Profile page sees a consistently placed "Add" button in the top-right of each section header — for Professional Experience, Education, Skills, Certifications, Awards, Languages, and Links. Each button uses the same filled primary style as the page's Save button, making it immediately recognizable. The button label is simply "Add" with no section-specific prefix.

**Why this priority**: The current section Add buttons are variously labeled, inconsistently styled, and not in the header row. Standardizing them is prerequisite to US5 and makes the page scannable before any modal work is done.

**Independent Test**: On the Edit Profile page, inspect each of the seven supported sections. Verify each header row contains a right-aligned "Add" button with primary styling (filled background, same color as Save). Verify no button is labeled "Add Experience", "Add Skill", or similar.

**Acceptance Scenarios**:

1. **Given** the Edit Profile page renders, **When** the user views any of the seven supported sections, **Then** the section header contains a right-aligned button labeled exactly "Add".
2. **Given** the "Add" button is visible in any section header, **When** the user views it, **Then** it uses the same primary button styling (filled background, primary accent color) as the page-level Save button.
3. **Given** the user views a section header, **When** the page renders, **Then** the section label is left-aligned and the Add button is right-aligned in the same row.

---

### User Story 5 — Adding an entry opens a modal (desktop) or bottom sheet (mobile) (Priority: P1)

A user on the Edit Profile page clicks "Add" in any section. On desktop, a modal overlay appears with the relevant entry form, a Cancel button, and a Save button. On mobile, a bottom sheet slides up from the bottom with the same form and actions. The old inline form that expanded within the card is gone. Saving commits the entry and closes the overlay; Cancel follows the discard-confirmation behavior.

**Why this priority**: Replacing inline forms with modals/sheets is the central interaction change of this feature. It affects all seven addable sections and establishes the pattern for US6, US7, and US8.

**Independent Test**: On a desktop viewport (≥ 640 px), click "Add" in the Professional Experience section. Verify a modal overlay appears with a backdrop, the experience form fields, a Cancel button, and a Save button. Fill in required fields and click Save. Verify the entry appears in the section and the modal closes.

On a mobile viewport (< 640 px), click "Add" in the Education section. Verify a bottom sheet slides up from the bottom with the education form. Fill required fields, Save, and verify the entry is committed and the sheet closes.

**Acceptance Scenarios**:

1. **Given** the user is on a desktop viewport (≥ 640 px), **When** they click "Add" in any supported section, **Then** a modal overlay with a backdrop appears containing the entry form, a Cancel button, and a Save button.
2. **Given** the user is on a mobile viewport (< 640 px), **When** they click "Add" in any supported section, **Then** a bottom sheet slides up from the bottom containing the entry form, a Cancel button, and a Save button.
3. **Given** a modal or bottom sheet is open, **When** the user fills in required fields and clicks Save, **Then** the entry is committed to the section, the overlay closes, and no toast is shown (entry save is silent; only page-level Save shows a toast).
4. **Given** a modal or bottom sheet is open with valid field values, **When** the user clicks Save, **Then** validation passes and the entry is committed.
5. **Given** a modal or bottom sheet is open with missing required fields, **When** the user clicks Save, **Then** validation errors appear inline inside the overlay and the entry is not committed.
6. **Given** a modal is open, **When** the user clicks the backdrop, **Then** Cancel behavior is triggered (discard confirmation if changes exist, close immediately if none).
7. **Given** a modal is open, **When** the user presses Escape, **Then** Cancel behavior is triggered.
8. **Given** a modal is open, **When** it renders, **Then** keyboard focus is trapped inside the modal until it closes.
9. **Given** an inline add form previously existed, **When** the Add button is clicked, **Then** no inline form expands inside the section card — only the overlay appears.

---

### User Story 6 — Skills Add uses a staging flow inside the modal/bottom sheet (Priority: P2)

A user clicks "Add" in the Skills section. A modal (desktop) or bottom sheet (mobile) opens showing a text input, an "Add" button next to it, and an empty pill area for staged skills. The user types a skill, clicks Add (or presses Enter), and the skill appears as a pill inside the overlay — not on the Edit Profile page. After staging multiple skills, the user clicks Save: all staged skills are committed to the Edit Profile skills list. Clicking Cancel with staged skills shows the discard confirmation.

**Why this priority**: Skills have a different input model (many at once, pill-based) and need special treatment within the modal pattern. Depends on US5.

**Independent Test**: Click "Add" in the Skills section. In the modal/sheet, type "JavaScript" and click the inline Add button. Verify "JavaScript" appears as a pill in the modal only, not on the Edit Profile page yet. Type "Python", press Enter, verify it is staged. Click Save. Verify both "JavaScript" and "Python" appear in the Edit Profile skills list.

**Acceptance Scenarios**:

1. **Given** the Skills modal/sheet is open, **When** the user types a skill and clicks the inline Add button (or presses Enter), **Then** the skill appears as a staged pill inside the modal/sheet only.
2. **Given** a skill is staged as a pill, **When** the user clicks the pill's remove button, **Then** the skill is removed from the staged list without affecting the Edit Profile page.
3. **Given** the user clicks Save in the Skills modal/sheet, **When** there are staged skills, **Then** those skills are committed to the Edit Profile skills list and the modal/sheet closes.
4. **Given** a staged skill duplicates an existing skill (case-insensitively), **When** the user clicks Save, **Then** the duplicate is dropped and no duplicate appears in the Edit Profile list.
5. **Given** the user has staged at least one skill, **When** they click Cancel, **Then** the discard confirmation flow is triggered.
6. **Given** the user has no staged skills, **When** they click Cancel, **Then** the modal/sheet closes immediately.
7. **Given** an empty text input, **When** the user clicks the inline Add button or presses Enter, **Then** no skill is staged and no error message is shown (silent ignore).
8. **Given** a skill input with only whitespace, **When** the user adds it, **Then** it is trimmed and treated as empty (not staged).

---

### User Story 7 — Modal/bottom sheet Cancel shows discard confirmation when changes exist (Priority: P2)

A user opens an add or edit modal/sheet, fills in some fields, then changes their mind and clicks Cancel. A confirmation dialog appears asking whether to discard their edits. If they confirm, the dialog and the overlay both close and a toast confirms the discard. If they decline, the dialog closes and the overlay stays open with their form state intact.

**Why this priority**: Prevents silent data loss when a user accidentally clicks Cancel after filling in form data. Depends on US5.

**Independent Test**: Open the Professional Experience add modal. Fill in the Role field, then click Cancel. Verify a confirmation dialog appears (not a page navigation). Click "Keep Editing" (decline) and verify the modal stays open with the Role field still filled. Click Cancel again, then confirm discard. Verify the modal closes and a toast appears ("Changes discarded" or similar).

**Acceptance Scenarios**:

1. **Given** a modal/sheet is open with at least one field filled, **When** the user clicks Cancel, **Then** a confirmation dialog appears asking whether to discard edits.
2. **Given** the discard confirmation dialog is showing, **When** the user confirms discard, **Then** the dialog closes, the modal/sheet closes, and a toast appears confirming the discard.
3. **Given** the discard confirmation dialog is showing, **When** the user declines discard, **Then** the dialog closes and the modal/sheet remains open with the form state preserved.
4. **Given** a modal/sheet is open with no changes from its initial state (all fields empty for add, all fields at original values for edit), **When** the user clicks Cancel, **Then** the modal/sheet closes immediately with no confirmation dialog.
5. **Given** a modal/sheet is open, **When** the user presses Escape or clicks the backdrop, **Then** the same Cancel logic applies (immediate close if no changes, discard confirmation if changes exist).
6. **Given** the discard confirmation dialog is showing, **When** it renders, **Then** it has distinct "Discard" (confirm) and "Keep Editing" (decline) actions.

---

### User Story 8 — Edit quick action opens modal/sheet pre-filled with existing entry data (Priority: P2)

A user on the Edit Profile page sees both an Edit icon and a Remove icon on every structured entry. Clicking the Edit icon opens the same modal (desktop) or bottom sheet (mobile) used for adding that entry type, but with all fields pre-filled with the entry's current data. After making changes and clicking Save, the entry is updated in-place and the overlay closes. Cancel follows the discard-confirmation behavior.

**Why this priority**: Without edit support, users can only add or remove — they cannot correct a typo or update a date without deleting and recreating the entry. Depends on US5.

**Independent Test**: Seed a profile with an experience entry. On the Edit Profile page, click the Edit icon on that experience entry. Verify the modal/sheet opens with the role, company, dates, and responsibilities fields pre-filled with the entry's current data. Change the role name, click Save. Verify the entry in the Edit Profile list reflects the new role name.

**Acceptance Scenarios**:

1. **Given** a structured entry is displayed in the Edit Profile page, **When** the user clicks the Edit icon, **Then** the add/edit modal (desktop) or bottom sheet (mobile) for that section opens with all fields pre-filled with the entry's current values.
2. **Given** the edit modal/sheet is open and the user modifies at least one field, **When** they click Save, **Then** the entry is updated in-place (the correct entry is replaced, not a new one appended) and the overlay closes.
3. **Given** the edit modal/sheet is open, **When** the user clicks Cancel with no changes from the pre-filled values, **Then** the modal closes immediately.
4. **Given** the edit modal/sheet is open and the user modifies a field, **When** they click Cancel, **Then** the discard confirmation dialog appears.
5. **Given** an entry is updated via the edit flow, **When** the section has a sort order (Experience or Education), **Then** the list is re-sorted after the edit is saved.
6. **Given** a structured entry is displayed, **When** the user clicks the Remove icon, **Then** the entry is removed immediately (existing behavior is unchanged).

---

### User Story 9 — iPad Mini stat chips wrap gracefully (Priority: P3)

A user viewing the Profile page on an iPad Mini (approximately 768 px wide) sees the four application stat chips (Total, Active, Pending, Offer) arranged in a two-row layout rather than forced into one overflowing row. The labels are fully readable. Desktop (wider) and mobile (narrower) layouts are unchanged.

**Why this priority**: A visual bug on a specific viewport. Independent of all other stories — only a CSS change.

**Independent Test**: Open the Profile page with demo data at 768 px viewport width. Verify the stat chips are arranged without any horizontal overflow and their labels (including "Pending") are fully visible. Verify at 1280 px that chips are in their original layout, and at 375 px that the mobile layout is unchanged.

**Acceptance Scenarios**:

1. **Given** the Profile page renders at approximately 768 px width, **When** the Applications section displays, **Then** the four stat chips do not overflow horizontally.
2. **Given** the chip row does not have enough width for all four chips in one row, **When** the chips render, **Then** they wrap into a second row.
3. **Given** the Profile page renders at a typical desktop width (≥ 1024 px), **When** the stat chips render, **Then** their layout is unchanged from the current desktop behavior.
4. **Given** the Profile page renders at a typical mobile width (≤ 430 px), **When** the stat chips render, **Then** their layout is unchanged from the current mobile behavior.

---

### Edge Cases

- What happens when a user clicks the backdrop or presses Escape on a modal/sheet with unsaved changes? → The same Cancel / discard-confirmation logic applies as clicking the Cancel button.
- What happens when an edit modal Save fails validation? → Errors are shown inline in the modal; the modal stays open; the underlying entry is not modified.
- What happens when the Edit Profile page has unsaved changes (dirty) and the user saves an entry via an edit modal? → The edit commits to the in-memory form state and marks the page dirty; the page-level Save persists everything to storage.
- What happens on viewports between 640 px and 768 px? → Modal is used (≥ 640 px threshold) and two-column inline form row layouts apply.
- What happens when the one-at-a-time inline form constraint from 008 now conflicts with the modal pattern? → The constraint is superseded; modals naturally enforce one-at-a-time. Clicking Add while a modal is already open has no effect (or the existing modal is surfaced).
- What happens when there are no entries in a structured section and the user edits the profile? → Section renders empty with only the Add button; this is unchanged behavior.
- What happens to the Skills section Add flow relative to the existing Enter-key shortcut? → The Enter key shortcut now applies to the skill text input inside the modal/sheet (staging), not to adding the final entry to the profile.
- What happens when a nav link is clicked while an entry overlay is open? → The overlay's discard-confirmation logic fires first (same as clicking Cancel on the overlay). If the user confirms discard, the overlay closes. The page-level guard then runs if the Edit Profile page has unsaved changes. Navigation proceeds only after both guards are cleared.
- What happens when the Language overlay opens for an entry whose stored proficiency value does not match any known select option (Beginner / Intermediate / Professional / Fluent)? → The proficiency `<select>` falls back to its "Select" placeholder state. The user must choose a valid option before Save is accepted.

---

## Requirements *(mandatory)*

### Functional Requirements

**View Profile — Certifications**

- **FR-001**: Certifications on the View Profile page MUST be displayed using the same entry-row structure (`profile-entry-list` / `profile-entry`) as Education entries.
- **FR-002**: Certification name MUST be rendered as the primary text (`profile-entry__title` or equivalent class).
- **FR-003**: Issuing body MUST be rendered as supporting text below the name (`profile-entry__meta` or equivalent).
- **FR-004**: Issuance and expiry dates MUST be rendered as metadata where present; absent date fields MUST be omitted without breaking the layout.
- **FR-005**: Certificate ID MUST be rendered as optional secondary metadata where present.
- **FR-006**: Partial certification data (missing expiry, missing certificate ID) MUST render without visual breakage.

**View Profile — Awards**

- **FR-007**: Awards on the View Profile page MUST be displayed using the same entry-row structure as Professional Experience entries.
- **FR-008**: Award name MUST be rendered as the primary text.
- **FR-009**: Issuing body MUST be rendered as supporting text below the name.
- **FR-010**: Date MUST be rendered as metadata where present; absent date MUST be omitted cleanly.
- **FR-011**: Details MUST be rendered as a descriptive body paragraph (`profile-entry__desc` or equivalent) where present, with graceful long-text wrapping.
- **FR-012**: Partial award data (missing date, missing details) MUST render without visual breakage.

**Edit Profile — Section Order**

- **FR-013**: Edit Profile section cards MUST appear in this exact top-to-bottom order: Basic Info, Summary, Professional Experience, Education, Skills, Certifications, Awards, Languages, Links.

**Edit Profile — Entry Presentation**

- **FR-014**: Existing Professional Experience entries in the Edit Profile page MUST display role as primary text, company and date range as supporting text, and responsibilities as body text — matching the View Profile hierarchy.
- **FR-015**: Existing Education entries in the Edit Profile page MUST display degree/major as primary text and university + year as supporting metadata — matching the View Profile hierarchy.
- **FR-016**: Existing Certification entries in the Edit Profile page MUST display name as primary text, issuing body as supporting text, and dates as metadata — matching the View Profile hierarchy.
- **FR-017**: Existing Award entries in the Edit Profile page MUST display award name as primary text, issuing body as supporting text, date as metadata, and details as body text — matching the View Profile hierarchy.
- **FR-018**: Quick action icons (Edit pencil icon and Remove × icon) MUST appear on the right side of each structured entry row in the Edit Profile page.

**Edit Profile — Section Add Button**

- **FR-019**: Each of the following sections MUST have an "Add" button in its section header: Professional Experience, Education, Skills, Certifications, Awards, Languages, Links.
- **FR-020**: The Add button label MUST be exactly "Add" — no section name prefix or suffix (not "Add Experience", "Add Skill", etc.).
- **FR-021**: Add buttons MUST use the same primary button styling as the page-level Save button (filled background, primary accent color).
- **FR-022**: The section header MUST lay out the section label left-aligned and the Add button right-aligned in the same row.

**Modal / Bottom Sheet — Add and Edit Flow**

- **FR-023**: Clicking "Add" on desktop viewports (≥ 640 px) MUST open a modal overlay with a scroll-locked backdrop.
- **FR-024**: Clicking "Add" on mobile viewports (< 640 px) MUST open a bottom sheet that slides up from the bottom of the viewport.
- **FR-025**: The modal and bottom sheet MUST contain a title, the section's entry form fields, a Cancel button, and a Save button.
- **FR-026**: Clicking Save in the modal/sheet MUST validate all fields; on validation success it MUST commit the entry and close the overlay; on validation failure it MUST show inline errors and keep the overlay open.
- **FR-027**: Clicking Cancel in the modal/sheet MUST trigger the discard-confirmation flow (FR-035 – FR-040).
- **FR-028**: Clicking the modal backdrop MUST trigger the same Cancel logic as the Cancel button.
- **FR-029**: Pressing Escape while a modal is open MUST trigger the same Cancel logic as the Cancel button.
- **FR-030**: Keyboard focus MUST be trapped inside the modal or bottom sheet while it is open.
- **FR-031**: The modal and bottom sheet MUST use consistent internal spacing, title typography, and action button styles across all sections.
- **FR-032**: Inline add forms previously expanding inside section cards MUST be removed; Add always opens the overlay.
- **FR-033**: The inline one-at-a-time form constraint from 008 (FR-062) is superseded; the modal pattern naturally enforces one overlay at a time. Clicking Add while a modal is already open MUST have no effect.

**Skills — Modal / Bottom Sheet**

- **FR-034**: Clicking "Add" in the Skills section MUST open a modal (desktop) or bottom sheet (mobile) containing: a skill text input, an inline "Add" button (or Enter key shortcut), and a pill area for staged skills.
- **FR-035**: The inline Add action inside the Skills modal/sheet MUST stage the entered skill as a pill inside the overlay only; it MUST NOT update the Edit Profile skills list.
- **FR-036**: Empty or whitespace-only skill inputs MUST NOT be staged.
- **FR-037**: Case-insensitive duplicate skills (against the staged list or existing skills) MUST be prevented.
- **FR-038**: Each staged skill pill MUST have a remove button to unstage that skill within the overlay.
- **FR-039**: Clicking Save in the Skills modal/sheet MUST commit all staged skills to the Edit Profile skills list, deduplicate against existing skills, and close the overlay.
- **FR-040**: Clicking Cancel in the Skills modal/sheet with at least one staged skill MUST trigger the discard-confirmation flow.
- **FR-041**: Clicking Cancel in the Skills modal/sheet with no staged skills MUST close the overlay immediately.

**Cancel Behavior — Modal / Bottom Sheet**

- **FR-042**: Cancel in any modal/sheet MUST compare the current form state against the overlay's initial state to determine whether changes exist.
- **FR-043**: If no changes exist, Cancel MUST close the overlay immediately.
- **FR-044**: If changes exist, Cancel MUST show a confirmation dialog with distinct "Discard" and "Keep Editing" (or equivalent) actions.
- **FR-045**: Confirming discard MUST close the confirmation dialog, close the overlay, discard all overlay form state, and show a toast ("Changes discarded" or equivalent).
- **FR-046**: Declining discard MUST close the confirmation dialog and keep the overlay open with all form state preserved.
- **FR-047**: The discard-confirmation behavior MUST be consistent across all add and edit overlays.

**Edit Existing Entry**

- **FR-048**: Each structured entry in Professional Experience, Education, Certifications, Awards, Languages, and Links MUST show an Edit icon and a Remove icon on the right side of the entry row.
- **FR-049**: Clicking the Edit icon MUST open the section's add/edit modal (desktop) or bottom sheet (mobile) with all fields pre-filled with the entry's current values.
- **FR-050**: Saving from the edit overlay MUST update the correct entry in-place (by index or identity) and close the overlay. A new duplicate entry MUST NOT be appended.
- **FR-051**: Where a section applies a sort order (Experience: current-first then by end date; Education: by year completed descending), the sort MUST be re-applied after an edit is saved.
- **FR-052**: Cancel from the edit overlay MUST follow the same discard-confirmation behavior as Cancel from the add overlay (FR-042 – FR-046).
- **FR-053**: The Remove icon behavior MUST be unchanged: clicking Remove removes the entry immediately.

**Dashboard — iPad Mini Stat Chips**

- **FR-054**: The stat chip row (`stat-chip-row`) in the Applications section MUST allow chip wrapping so that chips that do not fit on one row flow onto a second row.
- **FR-055**: On viewports approximately 768 px wide, stat chip text (including "Pending") MUST NOT overflow its chip container.
- **FR-056**: The existing desktop stat chip layout (chips in a vertical column on the left of the donut chart) MUST be preserved.
- **FR-057**: The existing mobile stat chip layout MUST be preserved.

**Validation**

- **FR-058**: Field validation rules inside all add/edit overlays MUST follow the same rules as the current inline forms: required fields, MM/YYYY format for date fields, URL protocol enforcement, email format.
- **FR-059**: Validation errors MUST appear inline inside the overlay, not as toasts.

**Constitution Compliance**

- **FR-060**: All user-supplied text MUST be rendered safely to prevent injection attacks.
- **FR-061**: All overlay forms MUST have labels, clear validation messages, and keyboard navigation MUST work for all core editing actions.
- **FR-062**: No external analytics, tracking, or data sharing MUST be introduced by this feature.

**Non-Regression**

- **FR-063**: All changes MUST NOT cause regressions in the Tracker or Calendar.
- **FR-064**: All existing automated tests MUST continue to pass (no regressions). New tests may be added to existing test files; existing assertions must not fail.

### Key Entities

- **Profile**: Unchanged from 008 — single JSON record with structured entry arrays for experience, education, skills, certifications, awards, languages, and links.
- **Experience Entry, Education Entry, Certification Entry, Award Entry, Language Entry, Link Entry**: Unchanged data shapes from 008.
- **Modal**: A centered overlay with a semi-opaque backdrop, scroll lock on the page behind it, and keyboard focus trap. Used on desktop (≥ 640 px) for add and edit flows.
- **Bottom Sheet**: A panel anchored to the bottom of the viewport that slides up from below. Used on mobile (< 640 px) for add and edit flows. Contains the same form fields and Cancel/Save actions as the modal.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Certifications on the View Profile page are visually indistinguishable in structure from Education entries (same class hierarchy, same field ordering, same metadata style).
- **SC-002**: Awards on the View Profile page are visually indistinguishable in structure from Professional Experience entries (same class hierarchy, including a details/description paragraph).
- **SC-003**: Edit Profile section order matches View Profile section order exactly, verified by inspecting the DOM order of section cards.
- **SC-004**: Every structured entry in the Edit Profile page (Experience, Education, Certifications, Awards) uses the same primary/supporting/metadata text hierarchy as its View Profile counterpart, with Edit and Remove icons on the right.
- **SC-005**: Every supported section header has an "Add" button labeled exactly "Add", right-aligned, with primary button styling — confirmed by visual inspection and automated test assertion.
- **SC-006**: On a desktop viewport (≥ 640 px), clicking Add in any supported section opens a modal overlay. On a mobile viewport (< 640 px), clicking Add opens a bottom sheet. No inline form expands inside the section card.
- **SC-007**: Skills modal/sheet stages skills locally; the Edit Profile page skills list updates only after the modal/sheet Save is clicked.
- **SC-008**: Canceling a modal/sheet with unsaved changes always produces a confirmation dialog; confirmed discard always produces a toast. Canceling with no changes always closes immediately.
- **SC-009**: Every structured entry on the Edit Profile page has an Edit icon that opens the overlay pre-filled with that entry's values; saving from the edit overlay updates the correct entry in-place.
- **SC-010**: At a 768 px viewport width, all four stat chips are fully readable with no overflow.
- **SC-011**: All existing automated tests continue to pass after feature delivery (no regressions). New tests may be added to existing test files; existing assertions must not fail.

---

## Assumptions

- The modal and bottom sheet share the same form fields; responsive behavior determines which container is rendered.
- "Bottom sheet" is implemented as a CSS-positioned panel anchored to the viewport bottom; slide-up animation is desirable but not mandatory.
- The discard confirmation dialog used inside modals/sheets may reuse the existing global discard modal component or be a lightweight variant — either is acceptable as long as it matches the existing modal style.
- "iPad Mini" refers to viewport widths approximately 768 px in portrait orientation.
- Edit and Remove icons follow the same compact icon-button style established in 008 (≈ 26 × 26 px, `aria-label` set).
- Section ordering on the Edit Profile page is a UI-only reorder; no database migration is required.
- The existing global page discard confirmation (triggered by nav bar clicks while the Edit Profile page has unsaved changes) is unchanged.
- Clicking Add while a modal is already open produces no effect (the open modal takes priority); no error message is needed for this case.
- Individual skill editing is not supported. To correct a skill (e.g., a typo), the user must remove the existing entry and add a new one.
- Job application data and profile data remain private and local-first with no external analytics or data sharing.
- The Calendar page does not consume Profile data in this iteration.
