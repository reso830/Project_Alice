# Feature Specification: Smart Application Creation Flow

**Feature Branch**: `013-application-smart-parser`
**Created**: 2026-05-09
**Status**: Draft
**Input**: User description: "Smart Application Creation Flow — paste a job posting to auto-populate application fields, or use manual entry"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Smart Parser Happy Path (Priority: P1)

A user wants to add a new job application quickly. Instead of typing every field
by hand, they paste the raw job posting text, the app extracts recognizable
information, and the standard application form opens pre-filled for review. The
user corrects or completes any fields and saves.

**Why this priority**: This is the core value of the feature. Without it, there
is no reason to build the selection screen or parser path. All other stories
support or recover from this one.

**Independent Test**: Click "New Application", choose the Smart Parser option,
paste a well-structured job posting, click Process, verify that fields such as
company name, job title, location, and salary are pre-filled in the application
form, then save. Confirm the record appears correctly in the application list.

**Acceptance Scenarios**:

1. **Given** the user is on the main application list, **When** they click "New Application", **Then** a selection screen appears offering two creation options: Smart Parser and Manual Entry
2. **Given** the selection screen is open, **When** the user selects the Smart Parser option, **Then** the view transitions to a paste input area with a Process button
3. **Given** the user has pasted text into the input area, **When** they click Process, **Then** a visible processing state appears (loading indicator, button disabled) while extraction runs
4. **Given** extraction completes successfully, **When** the results are ready, **Then** the existing application form appears with recognizable fields pre-filled from the pasted content
5. **Given** the pre-filled form is displayed, **When** the user edits any field, **Then** the form behaves identically to manual entry (dirty state, validation, save/discard actions)
6. **Given** the pre-filled form is displayed, **When** the user clicks Save, **Then** the application is saved and appears in the list, identical to a manually entered application

---

### User Story 2 - Manual Entry via Selection Screen (Priority: P2)

A user either prefers manual entry or has content that does not suit the parser.
They choose the Manual Entry option from the selection screen and reach the
existing application form without any change in behavior.

**Why this priority**: Preserves the existing creation workflow for all users.
Without this path, users who bypass the parser are blocked.

**Independent Test**: Click "New Application", choose Manual Entry, verify the
application form opens and behaves exactly as it did before this feature was
introduced. Fill and save a record normally.

**Acceptance Scenarios**:

1. **Given** the selection screen is open, **When** the user selects the Manual Entry option, **Then** the existing application form opens with no behavioral changes
2. **Given** the form is open via Manual Entry, **When** the user completes required fields and saves, **Then** the application is persisted identically to the pre-feature behavior

---

### User Story 3 - Error and Recovery States (Priority: P3)

The user submits an empty paste area, or the extraction returns no recognizable
fields. The system prevents or gracefully handles the failure and always offers a
path forward.

**Why this priority**: Defines the reliability floor. Users must never be left
stuck in a broken or dead-end state.

**Independent Test**: (a) Open the Smart Parser input, leave it empty — verify
the Process button is disabled or shows a blocking message before proceeding.
(b) Paste content that contains no recognizable job details, click Process —
verify a non-blocking error message appears with options to retry or switch to
Manual Entry.

**Acceptance Scenarios**:

1. **Given** the paste input area is empty, **When** the user views or clicks the Process button, **Then** processing does not begin — the button is disabled or an inline validation message appears
2. **Given** the pasted content yields no recognizable fields, **When** extraction completes, **Then** a non-blocking error message is shown: "Unable to extract application details. Please review the pasted content or enter details manually."
3. **Given** the error message is displayed, **When** the user chooses to retry, **Then** the input area remains editable so they can paste different content and try again
4. **Given** the error message is displayed, **When** the user chooses to enter details manually, **Then** the existing application form opens

---

### Edge Cases

- **Partial extraction**: some fields are recognized and others are not — the form pre-fills whatever was found; unrecognized fields are left blank and behave as manually empty
- **Salary expressed as a range** (e.g. "$80,000–$100,000"): the lower bound is used as the salary value
- **No company name found**: the company name field is left blank; existing required-field validation prevents saving until the user fills it
- **Job title appears multiple times**: the first (topmost) occurrence is used
- **Work setup or shift not mentioned**: those fields are left empty, not defaulted
- **Paste content is very short** (fewer than 20 characters): treated as insufficient — Process is blocked the same as empty
- **Pasted recruiter message without formal job post structure**: extract what is recognizable; leave remaining fields blank
- **Extracted job posting URL is malformed**: the URL field is left blank; existing URL validation applies

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST present a selection screen when the user clicks "New Application", before any form opens
- **FR-002**: The selection screen MUST offer exactly two creation paths: Smart Parser and Manual Entry
- **FR-003**: The Smart Parser option MUST be visually more prominent than Manual Entry and use a distinct icon (sparkle or magic-wand style)
- **FR-004**: The Manual Entry option MUST use an edit or pencil-style icon
- **FR-005**: Selecting Manual Entry MUST open the existing application form with no change in behavior
- **FR-006**: Selecting Smart Parser MUST transition to a paste input area with a Process button
- **FR-007**: The Process button MUST be disabled or blocked when the paste input contains fewer than 20 characters
- **FR-008**: Clicking Process MUST display a visible processing state for the duration of extraction
- **FR-009**: On successful extraction, the system MUST open the existing application form pre-filled with extracted values
- **FR-010**: On extraction failure or zero recognized fields, the system MUST display a non-blocking error with retry and Manual Entry fallback options
- **FR-011**: The selection screen layout MUST render side-by-side on desktop and stacked on mobile
- **FR-012**: No application data MUST be saved automatically; the user must explicitly review and click Save
- **FR-013**: The existing application form, required-field validation, and save logic MUST be reused without duplication
- **FR-014**: Extracted values MUST pass through existing field validation before being presented in the form (e.g. invalid URLs left blank, out-of-range values discarded)
- **FR-015**: System MUST NOT send pasted content or any application data to external services as part of extraction
- **FR-016**: System MUST preserve required job application fields: company name, job title, responsibilities, status, and last status update date
- **FR-017**: System MUST validate required fields, URLs when provided, and status values before saving
- **FR-018**: System MUST provide clear user-facing errors for any invalid data
- **FR-019**: System MUST support desktop and mobile browser use, labeled form fields, keyboard navigation, and non-color-only status indicators

### Key Entities

- **Job Application**: A tracked record with required company name, job title,
  responsibilities, status, and last status update date; optional fields include
  source platform, job posting URL, salary, location, work setup, shift,
  notes, skills, preferred skills, recruiter, follow-up action, and follow-up date
- **Parsed Result**: A transient, unvalidated set of values extracted from pasted
  text — not persisted; used only to pre-fill the application form for user review

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from clicking "New Application" to a saved application record using only pasted job text, with no manual field typing required for fields successfully extracted
- **SC-002**: The Manual Entry path is behaviorally identical to the application creation flow that existed before this feature
- **SC-003**: A parse failure always results in a visible, non-blocking recovery option — the user is never left on a screen with no forward path
- **SC-004**: The selection screen layout renders correctly on both desktop (side-by-side) and mobile (stacked) viewports without horizontal scrolling or clipped content
- **SC-005**: All existing application creation, editing, and saving behaviors remain intact after this feature is introduced

## Assumptions

- The "New Application" button is the sole entry point for this feature; no secondary triggers exist in this phase
- Extraction runs locally and produces a result fast enough that a brief loading indicator is sufficient — no background jobs or queued processing are needed
- Compatibility score for parser-created applications is a random integer 0–100; this differs from the manual create path, which defaults to 0
- Compatibility notes will be left blank for parser-created applications
- Employment type (full-time, contract, etc.) has no dedicated field in the current application record and will not be extracted in this phase
- Skills and tech stack keywords found in the posting are treated as a single set; items the posting explicitly labels as "preferred" are additionally recorded in the preferred skills field
- Job application data remains private and local — extraction produces no network traffic
