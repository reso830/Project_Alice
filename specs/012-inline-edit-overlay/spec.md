# Feature Specification: Enhanced Job Metadata & Inline Editing Overlay

**Feature Branch**: `012-inline-edit-overlay`  
**Created**: 2026-05-08  
**Status**: Draft  
**Input**: User description: "Enhanced job metadata and inline editing with shared create/edit overlay"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View and Save Extended Application Metadata (Priority: P1)

A user opens an existing application and sees a richer set of details: location, shift type, work setup, compatibility notes, general notes, and preferred skills alongside the fields they already know. Any changes to these new fields persist after they save and refresh the page.

**Why this priority**: This is the foundational data expansion. All other stories build on having the new fields present and persisted. Without them, inline editing has nothing new to edit and filtering cannot be tested.

**Independent Test**: Open any existing application card. The overlay shows Location, Shift, Work Setup, Compatibility Notes, General Notes, and Preferred Skills fields. Edit one, save, refresh, and confirm the value is still there.

**Acceptance Scenarios**:

1. **Given** an existing application, **When** the user opens the overlay, **Then** Location, Shift, Work Setup, Compatibility Notes, General Notes, and Preferred Skills fields are all visible.
2. **Given** an application with no values in the new fields, **When** viewed, **Then** the fields display a neutral empty state — not an error or broken layout.
3. **Given** a user fills in a Location value and saves, **When** the page is refreshed and the application is reopened, **Then** the Location value is retained.
4. **Given** an application created before this feature was introduced, **When** it is opened, **Then** all pre-existing data is intact and the new fields appear empty.
5. **Given** an existing application is opened, **When** the overlay renders, **Then** the Last Updated date is visible as a read-only field; after the user saves changes, the displayed date reflects the time of that save.

---

### User Story 2 — Inline Field Editing (Priority: P2)

A user clicks any editable field directly within the application overlay and types a new value — no separate edit screen required. Changes accumulate in a local draft. A footer with Save and Discard buttons appears as soon as any field differs from the stored record.

**Why this priority**: Inline editing is the core UX improvement. Once the data fields exist (P1), this story can be developed and tested independently against any populated record.

**Independent Test**: Open an existing application. Click the Job Title field, change the text, click outside it. The Save/Discard footer appears. Click Save. The overlay reflects the updated title without closing.

**Acceptance Scenarios**:

1. **Given** an open application overlay, **When** the user clicks a text field, **Then** the field becomes editable in place.
2. **Given** an editable field, **When** the user clicks outside it, **Then** the change is committed to the local draft (not yet written to storage).
3. **Given** an editable field, **When** the user presses Esc, **Then** the field reverts to its pre-edit value.
4. **Given** a clean overlay with no local edits, **When** the user modifies any field, **Then** the Save and Discard footer becomes visible.
5. **Given** the Save and Discard footer is visible, **When** the user clicks Save, **Then** changes are written to storage, a "Saved." toast is shown, and the overlay stays open.
6. **Given** the Save and Discard footer is visible, **When** the user presses Cmd/Ctrl+S, **Then** the save behaves identically to clicking Save.
7. **Given** no unsaved changes exist, **Then** the Save and Discard footer is hidden.
8. **Given** an open overlay on a mobile-width screen, **When** the user taps a field, **Then** inline editing works the same as on desktop.
9. **Given** a multi-line Notes field is being edited, **When** the user presses Cmd/Ctrl+Enter, **Then** the field edit is committed to the draft.
10. **Given** the overlay is open in Edit mode, **When** the user saves with a required field (job title, company name, or responsibilities) left empty, **Then** an inline error appears on each offending field and no API call is made.
11. **Given** a multi-line text field (responsibilities, compatibility notes, general notes) with line breaks, **When** the field is in display mode, **Then** the line breaks are rendered visually, not collapsed into a single line.
12. **Given** a chip editor field (Required Skills, Preferred Skills), **When** the user types a value and presses Enter, **Then** the chip is added to the list with no JavaScript errors thrown.
13. **Given** the overlay is open on a very narrow viewport (≤320px), **When** a field contains long text or a URL, **Then** the text wraps within its container and does not overflow into the page margin.
14. **Given** the overlay header is rendered on a very narrow viewport, **Then** the status pill text remains legible — centered within the pill if it wraps to two lines.
15. **Given** the overlay header is rendered on a very narrow viewport, **Then** the quick action buttons (Favorite, Change Status, Archive, Close) appear on their own row and do not overlap the application title.

---

### User Story 3 — Create New Application via the Overlay (Priority: P3)

A user clicks "+ New application" and sees the same overlay used for editing existing records, but with all fields empty and status defaulting to "Wishlisted". The footer shows a Create button that is always visible. After filling in at minimum a Job Title and Company Name, clicking Create saves a new record.

**Why this priority**: This consolidates the create flow with the edit/view flow. It depends on the inline interaction patterns from P2 being defined but can be implemented and tested without any pre-existing application record.

**Independent Test**: Click "+ New application". The overlay opens with empty fields and status defaulting to "Wishlisted". A Create button is visible. Fill in Job Title and Company Name, click Create. The new application appears in the tracker.

**Acceptance Scenarios**:

1. **Given** the user clicks "+ New application", **When** the overlay opens, **Then** all fields are empty and status defaults to "Wishlisted".
2. **Given** the Create overlay with Job Title and Company Name filled, **When** the user clicks Create, **Then** a new application is saved and appears in the tracker list.
3. **Given** the Create overlay with Job Title or Company Name missing, **When** the user looks at the Create button, **Then** the button is disabled and clicking it does nothing.
4. **Given** the Create overlay is open, **Then** the footer is always visible regardless of field content.
5. **Given** a new application is successfully created, **Then** a toast confirms "Application created." and the overlay remains open in Edit mode.
6. **Given** the Create overlay, **Then** the Archive quick action is not present in the header.
7. **Given** the Create overlay with Job Title and Company Name filled but Responsibilities empty, **When** the user clicks Create, **Then** an inline error appears on the Responsibilities field and no record is created.

---

### User Story 4 — Discard Confirmation on Close with Unsaved Changes (Priority: P4)

When a user has unsaved edits and tries to close the overlay — by clicking X, clicking the backdrop, pressing Esc, or clicking the footer Discard button — they see a confirmation dialog before any edits are lost. Confirming discards changes; cancelling returns them to editing.

**Why this priority**: This guard rail depends on dirty-state detection from P2 and can be tested independently of the new fields or create mode.

**Independent Test**: Open an existing application, change a field, then click the backdrop. A confirmation dialog appears. Click "Keep editing" — the modal stays open with edits intact. Repeat, then click "Discard" — the modal closes with no changes saved.

**Acceptance Scenarios**:

1. **Given** unsaved changes in the overlay, **When** the user clicks ✕ Close, **Then** a discard confirmation dialog appears.
2. **Given** unsaved changes, **When** the user clicks the backdrop, **Then** a discard confirmation dialog appears.
3. **Given** unsaved changes, **When** the user presses Esc at the modal level (not inside a field), **Then** a discard confirmation dialog appears.
4. **Given** the discard confirmation dialog, **When** the user clicks "Keep editing", **Then** the dialog closes and the overlay remains open with edits intact.
5. **Given** the discard confirmation dialog, **When** the user clicks "Discard", **Then** the modal closes and no changes are saved to storage.
6. **Given** no unsaved changes, **When** the user clicks ✕, the backdrop, or presses Esc, **Then** the overlay closes immediately with no dialog.
7. **Given** unsaved changes, **When** the user clicks the footer Discard button and confirms, **Then** the draft resets to the stored state and the footer disappears (overlay stays open).

---

### User Story 5 — Filter Applications by New Fields (Priority: P5)

A user can filter the application list by Location, Shift, and Work Setup so they can quickly find applications that match their target work criteria.

**Why this priority**: This discoverability feature requires the new fields to exist in storage (P1) but does not depend on inline editing or the overlay create flow.

**Independent Test**: Create two applications with different Work Setup values ("Remote" and "On-site"). Apply a filter for "Remote". Only the Remote application appears in the list.

**Acceptance Scenarios**:

1. **Given** the filter panel, **When** the user selects a Work Setup value, **Then** only applications matching that value are shown.
2. **Given** the filter panel, **When** the user selects a Shift value, **Then** only applications with that Shift appear.
3. **Given** applications with varying Location text, **When** the user filters by Location, **Then** only matching applications are shown.
4. **Given** an active new-field filter, **When** the user clears it, **Then** all applications reappear.

---

### Edge Cases

- What happens if the save request fails (e.g., a storage error)? The overlay must show an error toast and retain the local draft so the user does not lose their edits.
- What happens when all new optional fields are empty on save? The record saves correctly with null/empty values — no validation error is raised.
- What happens if a user edits a dropdown and selects the same value it already had? The draft is not marked dirty; the Save/Discard footer does not appear.
- What is shown in the Compatibility Notes field when no compatibility score has been computed yet? The notes field is still editable; the read-only bar shows 0% or an empty state.
- What happens if Cmd/Ctrl+S is pressed when there are no unsaved changes? Nothing happens — no save request is made.
- What happens when the Favorite or Archive quick actions are used while a dirty draft exists? These actions persist immediately to the stored record; the local draft is unaffected.
- What happens if the user saves with Responsibilities left empty? The system displays an inline error on the Responsibilities field and aborts the save — no API call is made. This applies in both Edit and Create mode.
- What happens when a filter dimension is active but some applications have no value for that field? Those applications are excluded by default. The user must explicitly select "(Not set)" in that filter panel to include them.
- What happens if the user types a skill and presses Enter while the chip input's blur handler is also firing? The chip must be added exactly once with no JavaScript errors — the blur and Enter paths must not both attempt to re-render the chip list simultaneously.
- What is shown in the Salary field when it has no value? The field MUST display "-" as a neutral empty-state placeholder, consistent with all other optional fields. A blank display is not acceptable — on mobile (stacked layout) a completely blank salary area causes the "Salary" label to appear directly above "Shift", misleading users into thinking the label belongs to the Shift field.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store Location, Shift, Work Setup, Compatibility Notes, General Notes, and Preferred Skills for each application record.
- **FR-002**: All six new fields MUST be optional; existing applications MUST remain valid and unchanged without them.
- **FR-003**: System MUST display all new fields in the application overlay alongside existing fields, including the read-only Last Updated date (an existing field that must remain visible in the redesigned body layout).
- **FR-004**: System MUST allow users to edit any visible field directly within the overlay, without navigating to a separate form or screen.
- **FR-005**: System MUST maintain a local draft state within the overlay that accumulates field edits before the user explicitly saves.
- **FR-006**: System MUST show Save and Discard actions in the overlay footer whenever the draft differs from the stored record.
- **FR-007**: System MUST hide the Save and Discard footer when no unsaved changes exist, except in Create mode where the footer is always visible.
- **FR-008**: System MUST present a discard confirmation dialog before discarding unsaved changes when the user attempts to close or dismiss the overlay.
- **FR-009**: System MUST support a Create mode that uses the same overlay as Edit mode, with all fields empty and a visible Create footer button.
- **FR-010**: System MUST disable the Create button until at least Job Title and Company Name are filled.
- **FR-011**: System MUST default Status to "Wishlisted" for new applications opened in Create mode.
- **FR-012**: System MUST preserve required fields (company name, job title, status, last status update, responsibilities) on every save.
- **FR-013**: System MUST validate that all required fields (job title, company name, responsibilities) are non-empty and that URL format is valid before persisting any changes. Validation failures MUST surface as inline errors on the offending field(s) and abort the save.
- **FR-014**: System MUST allow filtering applications by Location, Shift, and Work Setup.
- **FR-015**: System MUST display an error notification and retain the local draft if a save request fails.
- **FR-016**: System MUST support the overlay on desktop and mobile browsers, with labeled fields and full keyboard navigation.
- **FR-017**: System MUST allow Esc (while focus is inside a field) to revert that field to its pre-edit value without closing the overlay.
- **FR-018**: System MUST allow Cmd/Ctrl+S to save when the overlay is open and the draft is dirty.
- **FR-019**: Shift field MUST accept only the values: Day, Mid, Night, Flexible.
- **FR-020**: Work Setup field MUST accept only the values: Remote, Hybrid, On-site, Field.
- **FR-021**: System MUST NOT apply Favorite or Archive actions to the local draft — these actions persist immediately to the stored record.
- **FR-022**: System MUST hide the Archive action from the overlay header when in Create mode.
- **FR-023**: System MUST display a visual required-field indicator (e.g. asterisk `*`) on each required field (job title, company name, responsibilities) within the overlay.
- **FR-024**: System MUST render newline characters in multi-line text fields (responsibilities, compatNotes, generalNotes) as visual line breaks in display mode.
- **FR-025**: Filter panels for optional enum/text fields (Shift, Work Setup, Location) MUST include a "(Not set)" option that matches applications where that field is empty or null.
- **FR-026**: On mobile viewports (≤639px), quick filter icons in the toolbar MUST appear in a dedicated row below the application count text, left-aligned, so neither overlaps the other.
- **FR-027**: The sort panel popup MUST remain visible on screen when opened while the page is scrolled down on desktop — it MUST NOT clip above the visible viewport.
- **FR-028**: Overlay quick action buttons (Favorite, Change Status, Archive, Close) MUST be positioned in the third row of the overlay header, below the title row, to prevent overflow and icon wrap on narrow viewports (e.g. Galaxy Z Fold).
- **FR-029**: The Archive action icon MUST be visually distinct from the Close icon; it MUST resemble a filing box to clearly communicate its purpose.
- **FR-030**: The Archive icon MUST be visually consistent between the application card and the overlay header.
- **FR-031**: Overlay quick action buttons MUST display exactly one tooltip on hover via the `title` attribute. The `title` attribute MUST be present on every quick action button. `aria-label` MUST NOT be set on these buttons as it causes a duplicate tooltip in some browsers. The Favorite button tooltip MUST read "Favorite". Zero tooltips is not an acceptable fix for the double-tooltip issue — `title` must be retained.
- **FR-032**: The FAB button on mobile MUST have a drop-shadow sufficient to visually separate it from the page content beneath it.
- **FR-033**: The version string displayed in the app footer MUST be kept in sync with the current release version on every release.
- **FR-034**: Field display text in the overlay MUST NOT overflow its container on narrow viewports — long text (including URLs) MUST wrap using `overflow-wrap: break-word`.
- **FR-035**: The status pill in the overlay header MUST remain legible on narrow viewports — text MUST be centered if the pill wraps to two lines, and single-line display MUST be preferred where possible.
- **FR-036**: The chip editor (Required Skills, Preferred Skills) MUST add chips without throwing JavaScript errors regardless of whether the commit is triggered by Enter keydown or by the input losing focus — these two code paths MUST NOT execute a simultaneous DOM re-render.
- **FR-037**: Every optional field in the overlay MUST display "-" as a neutral empty-state placeholder in display mode when its value is empty or null. The Salary field MUST NOT render a completely blank area — a blank salary row causes the "Salary" label to visually merge with the next field's label on mobile stacked layouts.

### Key Entities

- **Job Application**: A tracked application record. Required fields: company name, job title, status, last status update, responsibilities. Newly added optional fields: location (free text), shift (Day / Mid / Night / Flexible), work setup (Remote / Hybrid / On-site / Field), compatibility notes (free text), general notes (free text), preferred skills (array of text tags). All pre-existing optional fields are unchanged.
- **Application Draft**: A local, in-memory working copy held by the overlay while it is open. Discarded on modal close without saving; written to storage only on Save / Create. Not shared across sessions.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open an existing application, edit a field inline, and save — completing the full flow in under 30 seconds without navigating away from the overlay.
- **SC-002**: 100% of applications that existed before this feature are accessible and data-complete after the change (zero data loss or corruption).
- **SC-003**: Users can create a new application from the overlay with the required minimum fields in under 60 seconds.
- **SC-004**: Every attempt to close the overlay with unsaved changes produces a discard confirmation prompt — zero silent data loss.
- **SC-005**: All six new fields are present in the overlay, and the filter panel includes the searchable new fields: Location, Shift, and Work Setup.

---

## Assumptions

- The compatibility score shown in the read-only bar is computed by existing logic and is not manually editable in this phase.
- The existing `skills` field maps to "Required Skills" in the overlay. A new, separate `preferredSkills` field maps to "Preferred Skills" and starts empty for existing applications.
- Location is free-text input with no predefined options in this phase.
- Shift and Work Setup accept only the controlled values listed in FR-019 and FR-020; freeform input is not supported for these fields.
- The Favorite and Archive quick actions bypass draft state and act on the stored record immediately, consistent with current card-level behavior.
- Status changes made via the status badge or Change Status button count as draft changes and mark the overlay as dirty.
- Mobile overlay behavior (bottom sheet at less than 640px width) is in scope.
- Job application data remains local-first; no external services are involved in this feature.
- No data migration or conversion is required — new optional fields default to empty for all existing records.
