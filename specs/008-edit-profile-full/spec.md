# Feature Specification: Edit / Create Profile — Full Implementation

**Feature Branch**: `008-edit-profile-full`  
**Created**: 2026-04-28  
**Status**: Draft  
**Design Reference**: `design/profile_page.md` · `specs/007-profile-page/spec.md`

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — User creates a profile for the first time (Priority: P1)

A user who has no saved profile navigates to the Edit Profile page. All form fields are blank. They fill in their details across all sections and click Save. The profile is persisted and they are returned to the Profile page, which now shows their information.

**Why this priority**: Creating a profile from scratch is the entry point for all users. Without this working, the profile feature delivers no value.

**Independent Test**: With no profile in storage, navigate to `/profile/edit`. All fields should be empty. Fill in required basic info, click Save, and verify the Profile page displays the newly saved information and a success toast is shown.

**Acceptance Scenarios**:

1. **Given** no profile exists, **When** the user opens the Edit Profile page, **Then** all form fields are blank and placeholder text may appear as hints.
2. **Given** the user has filled in required fields, **When** they click Save, **Then** the profile is persisted, the user is navigated to `/profile`, and a success toast confirms the save.
3. **Given** the user has not made any changes, **When** they click Cancel, **Then** they are navigated directly back to the Profile page with no confirmation prompt.
4. **Given** the user has filled in some fields but has not saved, **When** they click Cancel, **Then** a discard confirmation modal appears.
5. **Given** the discard confirmation modal is showing, **When** the user confirms discard, **Then** changes are discarded, the user returns to the Profile page, and a toast confirms the discard.
6. **Given** the discard confirmation modal is showing, **When** the user dismisses the modal, **Then** the modal closes and the user remains on the Edit Profile page with their changes intact.

---

### User Story 2 — User edits an existing profile (Priority: P1)

A user who already has a profile navigates to the Edit Profile page. All fields are pre-populated with their saved data. They modify some fields, add new entries, remove others, and save. The Profile page reflects the updated data after returning.

**Why this priority**: Editing an existing profile is the primary ongoing use case for returning users.

**Independent Test**: With a complete profile saved, open the Edit Profile page. Verify all existing values appear in the correct fields. Modify a field, save, and verify the Profile page reflects the changes with a success toast.

**Acceptance Scenarios**:

1. **Given** a profile exists with data in all sections, **When** the user opens the Edit Profile page, **Then** every field and list entry is pre-populated with the saved values.
2. **Given** the user modifies one or more fields, **When** they click Save, **Then** the updated profile is persisted and the Profile page reflects the changes.
3. **Given** the user modifies data, **When** they navigate to the Profile page after saving, **Then** all edited values appear correctly in the profile display.

---

### User Story 3 — User manages list-based profile sections (Priority: P1)

A user adds and removes entries in the Skills, Languages, Certifications, Education, Professional Experience, Links, and Awards sections. Each section provides inline controls to add new entries and remove existing ones. Adding an entry requires completing an inline form; invalid or incomplete entries are rejected before committing.

**Why this priority**: List-based sections are the richest part of the profile. Without functional add/remove flows, the profile is not usable for professional background data.

**Independent Test**: In each list section, add a valid entry and verify it appears. Attempt to add an entry with missing required fields and verify it is rejected. Remove an entry and verify it disappears.

**Acceptance Scenarios**:

1. **Given** the Skills section is visible, **When** the user types a skill and clicks Add, **Then** the skill appears as a removable pill in the list.
2. **Given** a skill pill is displayed, **When** the user clicks the remove button on the pill, **Then** the skill is removed from the list.
3. **Given** the Languages section is visible and the user opens the Add Language form, **When** the user fills in language and proficiency and clicks Add, **Then** the entry is committed and the inline form is dismissed.
4. **Given** the user opens an inline add form for any section, **When** they click Cancel, **Then** the inline form is dismissed and the section returns to its normal state without any committed entry.
5. **Given** the user attempts to add an entry with missing required fields, **When** they click Add, **Then** validation feedback is shown on the empty required fields and the entry is not committed.
6. **Given** the Professional Experience inline form has the Current Work checkbox checked, **When** the form renders, **Then** the Date Ended field is hidden.
7. **Given** the Professional Experience inline form has the Current Work checkbox unchecked, **When** the form renders, **Then** the Date Ended field is shown and required.
8. **Given** Education entries have been added, **When** they are displayed, **Then** they appear sorted from most recent to least recent by Year Completed.
9. **Given** Experience entries have been added, **When** they are displayed, **Then** current roles appear first, followed by ended roles sorted by most recent Date Ended descending.
10. **Given** the user adds a Link URL with an unsafe protocol (e.g. `javascript:` or `data:`), **When** they click Add, **Then** the URL is rejected with validation feedback and the entry is not committed.

---

### User Story 4 — User navigates the Edit Profile page using the subheader (Priority: P2)

A user on the Edit Profile page sees the normal Project Alice navigation bar plus a secondary subheader bar below it. The subheader shows the page title "Edit Profile" and a back action. The main nav bar is unchanged.

**Why this priority**: The navigation update improves consistency and removes a bespoke edit-page topbar, but the core form behavior is independently valuable.

**Independent Test**: Navigate to `/profile/edit`. Verify the main nav bar is present and unchanged. Verify a subheader bar appears below it showing "Edit Profile" and a back link to the Profile page.

**Acceptance Scenarios**:

1. **Given** the user is on the Edit Profile page, **When** the page renders, **Then** the standard Project Alice nav bar is visible and unchanged.
2. **Given** the user is on the Edit Profile page, **When** the page renders, **Then** a secondary subheader bar appears below the nav bar showing the title "Edit Profile" and a back action.
3. **Given** the user clicks the back action in the subheader with no unsaved changes, **When** the navigation occurs, **Then** the user is taken back to the Profile page.
4. **Given** the user clicks the back action in the subheader with unsaved changes, **When** the action fires, **Then** the discard confirmation modal appears.
5. **Given** the Edit Profile page renders on a mobile viewport, **When** the subheader is visible, **Then** both the title and back action are accessible without horizontal scrolling.

---

### User Story 5 — User uses top and bottom Save/Cancel controls (Priority: P2)

A user editing a long profile form can Save or Cancel from both the top and the bottom of the page. Both pairs of buttons perform the same actions, so the user is never forced to scroll to act.

**Why this priority**: Large forms without persistent controls create friction. Duplicate top/bottom controls improve usability without requiring sticky UI.

**Independent Test**: Open the Edit Profile page and scroll to the bottom. Verify Save and Cancel buttons are present near both the top and the bottom. Click the bottom Save button and verify it behaves identically to the top Save button.

**Acceptance Scenarios**:

1. **Given** the Edit Profile page renders, **When** the user views the top of the page, **Then** a Save and Cancel button pair is visible near the top.
2. **Given** the Edit Profile page renders, **When** the user scrolls to the bottom, **Then** a second Save and Cancel button pair is visible.
3. **Given** no changes have been made, **When** either Save button is viewed, **Then** it is visually disabled and cannot trigger a save.
4. **Given** the user modifies any field or list entry, **When** they view either Save button, **Then** it becomes enabled.

---

### Edge Cases

- What happens when a user attempts to save with an open inline add form that has uncommitted data? The save must not proceed silently — the user must be notified to complete or cancel the open inline form first.
- What happens if a MM/YYYY date has an invalid month (e.g. `13/2024`)? The entry must be rejected with specific feedback indicating the month must be between 01 and 12.
- What happens if a MM/YYYY date has a non-four-digit year (e.g. `01/24`)? The entry must be rejected with feedback indicating the year must be four digits.
- What happens when the user adds a skill that duplicates an existing one (case-insensitively)? The duplicate must either be prevented or silently deduplicated — it must never result in two identical skill entries in the list.
- What happens if the profile save operation fails (e.g. a storage write error)? The user must remain on the Edit Profile page, see an error toast, and retain all their form data.
- What happens if a Friendly Name is left blank for a Link entry? The URL or the safe hostname must be used as the link display label instead.
- What happens when a profile sub-section has no entries on load? That sub-section renders empty with the Add button available; it is not hidden on the Edit page the way it may be hidden on the view-only Profile page.

---

## Requirements *(mandatory)*

### Functional Requirements

**Navigation and Layout**

- **FR-001**: The Edit Profile page MUST display the standard Project Alice nav bar unchanged, with the Profile nav item shown as active.
- **FR-002**: A secondary subheader bar MUST appear below the nav bar on the Edit Profile page, containing the page title "Edit Profile" and a back action that returns the user to the Profile page.
- **FR-003**: The subheader back action MUST trigger the discard confirmation flow when unsaved changes exist, or navigate directly to the Profile page when no changes exist.
- **FR-004**: The previous edit-page topbar variant (replacing the nav bar with a custom bar) MUST be removed.
- **FR-005**: The placeholder banner ("This page is a placeholder — details to be designed in a later iteration.") MUST be removed from the Edit Profile page.
- **FR-006**: The Edit Profile page layout MUST make effective use of available horizontal space on wider viewports using wider form sections or responsive multi-column layouts; mobile viewports MUST remain single-column.

**Save and Cancel Controls**

- **FR-007**: Save and Cancel button pairs MUST appear both near the top and near the bottom of the Edit Profile page.
- **FR-008**: All Save buttons MUST perform the same save action; all Cancel buttons MUST perform the same cancel action.
- **FR-009**: Save buttons MUST be disabled when no unsaved changes exist (dirty state is false).
- **FR-010**: Save buttons MUST become enabled when the current form state differs from the saved state. If a user reverts all changes back to the original saved values, Save buttons MUST disable again.
- **FR-011**: Clicking Save MUST persist all profile changes to the application's storage layer, navigate to `/profile`, and show a success toast. While the save is in progress, all Save buttons MUST display a loading state (text changes to 'Saving…') and be non-interactive.
- **FR-012**: If the save operation fails, the user MUST remain on the Edit Profile page, an error toast MUST be shown, and all form data MUST be preserved.
- **FR-013**: Clicking Cancel when no unsaved changes exist MUST navigate directly to the Profile page.
- **FR-014**: Clicking Cancel when unsaved changes exist MUST show a discard confirmation modal.
- **FR-015**: Confirming discard in the modal MUST discard all changes, navigate to the Profile page, and show a toast confirming the discard.
- **FR-016**: Dismissing the discard confirmation modal MUST close the modal and keep the user on the Edit Profile page with their changes intact.
- **FR-017**: While the discard confirmation modal is open, the page behind it MUST NOT be scrollable or interactable.
- **FR-018**: Section-level Save and Cancel buttons MUST be removed; only the top and bottom page-level controls remain.

**Page State and Pre-Population**

- **FR-019**: When no profile exists, all Edit Profile form fields MUST render blank; placeholder text MAY be shown as hints.
- **FR-020**: When a profile exists, all Edit Profile form fields and list sections MUST be pre-populated with the saved values.

**Basic Info**

- **FR-021**: The Basic Info section MUST include interactive fields for: First Name, Last Name, City / Location, Email, and Phone.

**Summary**

- **FR-022**: The Summary section MUST use a large textarea input.

**Skills**

- **FR-023**: Existing skills MUST be displayed as removable pill tags, each with an × remove button.
- **FR-024**: Clicking a skill pill's remove button MUST remove that skill from the list.
- **FR-025**: The Skills section MUST include a text field and an Add button for adding new skills one at a time.
- **FR-026**: Clicking Add MUST commit the entered skill as a new pill; empty values MUST NOT be committed.
- **FR-027**: Duplicate skills MUST be prevented or normalized so that no two identical skill values appear in the list.

**Languages**

- **FR-028**: Existing languages MUST be displayed as rows showing the language name and proficiency level.
- **FR-029**: Clicking "Add Language" MUST open an inline entry form with a Language text field (required) and a Proficiency dropdown (required) with options: Beginner, Intermediate, Professional, Fluent.
- **FR-030**: Clicking Add in the inline language form MUST validate required fields, commit the entry, and restore the "Add Language" button.
- **FR-031**: Clicking Cancel in the inline language form MUST discard the inline state and restore the "Add Language" button.

**Certifications**

- **FR-032**: Existing certifications MUST be displayed as rows or list items.
- **FR-033**: Clicking "Add Certification" MUST open an inline entry form with: Certification Name (required), Issuing Body (optional), Certificate ID (optional), Issuance Date (required), Expiry Date (optional).
- **FR-034**: Clicking Add in the inline certification form MUST validate required fields, commit the entry, and restore the "Add Certification" button.
- **FR-035**: Clicking Cancel in the inline certification form MUST discard the inline state and restore the "Add Certification" button.

**Education**

- **FR-036**: Existing education entries MUST be displayed as rows or cards.
- **FR-037**: Education entries MUST be sorted from most recent to least recent by Year Completed.
- **FR-038**: Clicking "Add Education" MUST open an inline entry form with: Degree & Major (required), University (required), Year Completed (required).
- **FR-039**: Clicking Add in the inline education form MUST validate required fields, commit the entry, re-sort the list by Year Completed descending, and restore the "Add Education" button.
- **FR-040**: Clicking Cancel in the inline education form MUST discard the inline state and restore the "Add Education" button.

**Professional Experience**

- **FR-041**: Existing experience entries MUST be displayed as rows or cards.
- **FR-042**: Experience entries MUST be sorted with current roles first, then ended roles by most recent Date Ended descending; Date Started may be used as a fallback for tie-breaking.
- **FR-043**: Clicking "Add Experience" MUST open an inline entry form with: Role (required), Company (required), Responsibilities textarea (required), Date Started in MM/YYYY format (required), Date Ended in MM/YYYY format (required unless Current Work is checked), and a Current Work checkbox.
- **FR-044**: When the Current Work checkbox is checked, the Date Ended field MUST be hidden and treated as not required.
- **FR-045**: When the Current Work checkbox is unchecked, the Date Ended field MUST be shown and required.
- **FR-046**: Clicking Add in the inline experience form MUST validate required fields and MM/YYYY format for date fields, commit the entry, re-sort the list, and restore the "Add Experience" button.
- **FR-047**: Clicking Cancel in the inline experience form MUST discard the inline state and restore the "Add Experience" button.

**Links**

- **FR-048**: Existing links MUST be displayed as anchor elements using the friendly name (if set) or the URL/hostname as the link text; links MUST open in a new browser tab.
- **FR-049**: Clicking "Add Link" MUST open an inline entry form with: Link URL (required) and Friendly Name (optional).
- **FR-050**: Clicking Add in the inline link form MUST validate the URL, reject URLs with unsafe protocols (`javascript:`, `data:`, or malformed URLs), commit valid entries, and restore the "Add Link" button.
- **FR-051**: If Friendly Name is blank, the displayed link label MUST use `new URL(url).hostname` as the anchor text.
- **FR-052**: External links rendered in the profile MUST use appropriate safe attributes to prevent referrer leakage and cross-origin access.
- **FR-053**: Clicking Cancel in the inline link form MUST discard the inline state and restore the "Add Link" button.

**Awards**

- **FR-054**: Existing awards MUST be displayed as rows or cards.
- **FR-055**: Clicking "Add Award" MUST open an inline entry form with: Award Name (required), Issuing Body (required), Details textarea (optional), Date in MM/YYYY format (optional).
- **FR-056**: Clicking Add in the inline award form MUST validate required fields and MM/YYYY format for the Date field if provided, commit the entry, and restore the "Add Award" button.
- **FR-057**: Clicking Cancel in the inline award form MUST discard the inline state and restore the "Add Award" button.

**Validation**

- **FR-058**: Required fields in all inline forms MUST show clear validation feedback when left empty and the user attempts to commit.
- **FR-059**: MM/YYYY fields MUST reject values that do not match the MM/YYYY format, have a month outside 01–12, or have a year that is not a valid four-digit number.
- **FR-060**: URL fields MUST reject malformed URLs and URLs using unsafe protocols; a clear validation message MUST be shown.
- **FR-061**: The page-level Save action MUST NOT proceed if any inline entry form is open with uncommitted data; a persistent error message MUST appear below the top Save/Cancel controls instructing the user to complete or cancel the open form. A toast MUST NOT be used for this notification.

**Inline Form Constraint**

- **FR-062**: Only one inline entry form MAY be open at a time across all sections. Clicking 'Add' in a section while another section's inline form is already open MUST have no effect.

**Dirty State Tracking**

- **FR-063**: The page MUST track unsaved changes (dirty state) covering: edits to any text field, additions or removals in any list section (skills, languages, certifications, education, experience, links, awards).
- **FR-064**: Dirty state MUST reset to clean after a successful save.

**Data Model**

- **FR-065**: The Profile data model MUST be extended to store structured entries for experience, education, certifications, awards, languages, and links as typed objects rather than plain strings.
- **FR-066**: The extended Profile model MUST support at minimum the shape defined in the Data Model section of this specification.

**Persistence**

- **FR-067**: Profile saves MUST use the application's existing persistent local storage layer.
- **FR-068**: Profile data MUST NOT be stored in browser-only state (localStorage, sessionStorage, or in-memory only).

**Constitution Compliance**

- **FR-069**: All user-supplied profile text MUST be rendered safely to prevent injection attacks.
- **FR-070**: Forms MUST have labels, clear validation messages, and keyboard navigation MUST work for core editing workflows.
- **FR-071**: The app MUST NOT introduce external analytics, tracking, or data sharing as part of this feature.

**Non-Regression**

- **FR-072**: The Edit Profile enhancements MUST NOT cause regressions in the Profile page display, the Tracker, or the Calendar.
- **FR-073**: All existing automated tests MUST continue to pass after this feature is implemented.

### Key Entities

- **Profile**: A user's optional professional background record containing basic contact info, a summary, and structured lists for experience, education, skills, certifications, awards, languages, and external links. Its presence or absence drives the two Profile page states.
- **Experience Entry**: One work history position with a role, company, responsibilities, start date (MM/YYYY), optional end date (MM/YYYY), and a current-work flag.
- **Education Entry**: One academic credential with a degree and major, university, and year completed.
- **Certification Entry**: One professional certification with a name, optional issuing body, optional certificate ID, issuance date, and optional expiry date.
- **Award Entry**: One recognition record with an award name, issuing body, optional details, and an optional date (MM/YYYY).
- **Language Entry**: A language the user speaks or works in, paired with a fixed proficiency level (Beginner, Intermediate, Professional, Fluent).
- **Link Entry**: An external URL with an optional friendly display name.

---

## Data Model

The following minimum model shape MUST be supported by the extended Profile:

```
Profile
  firstName         string, required
  lastName          string, required
  city              string
  phone             string
  email             string
  summary           string
  experience        ExperienceEntry[]
  education         EducationEntry[]
  skills            string[]
  certifications    CertificationEntry[]
  awards            AwardEntry[]
  languages         LanguageEntry[]
  links             LinkEntry[]

ExperienceEntry
  role              string, required
  company           string, required
  responsibilities  string, required
  dateStarted       string (MM/YYYY), required
  dateEnded         string (MM/YYYY), optional — absent when currentWork is true
  currentWork       boolean, required

EducationEntry
  degreeMajor       string, required
  university        string, required
  yearCompleted     string, required

CertificationEntry
  name              string, required
  issuingBody       string, optional
  certificateId     string, optional
  issuanceDate      string, required
  expiryDate        string, optional

AwardEntry
  awardName         string, required
  issuingBody       string, required
  details           string, optional
  date              string (MM/YYYY), optional

LanguageEntry
  language          string, required
  proficiency       one of: Beginner | Intermediate | Professional | Fluent, required

LinkEntry
  url               string, required
  friendlyName      string, optional
```

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a complete profile from scratch and have it reflected on the Profile page in a single Save action, with no data loss.
- **SC-002**: Users can edit any profile field or list section and see the change reflected on the Profile page after saving, with no data loss.
- **SC-003**: Save buttons are disabled on page load and become enabled within one user interaction of modifying any field or list entry.
- **SC-004**: All inline entry forms reject incomplete or invalid inputs 100% of the time before committing an entry; no invalid data reaches persistent storage.
- **SC-005**: The discard confirmation flow triggers 100% of the time when unsaved changes exist and the user attempts to navigate away, and does not trigger when no changes exist.
- **SC-006**: Experience and Education entries consistently appear in most-recent-first order after each add operation without requiring a page reload.
- **SC-007**: All added links open correctly in a new browser tab, and no unsafe-protocol URL is ever committed to the profile.
- **SC-008**: MM/YYYY validation correctly rejects invalid months and non-four-digit years across all applicable fields, for both required and optional date inputs.
- **SC-009**: All existing Tracker and Calendar automated tests pass without modification after this feature is delivered. Profile page tests are updated to accommodate new entry shapes and continue to pass.
- **SC-010**: The Edit Profile page is fully usable on mobile viewports (below 640px) with no horizontal scrolling and all controls and inline forms accessible.

---

## Assumptions

- The existing persistent storage layer (local SQLite-backed API) supports storing the extended Profile model with structured list entries; no new storage technology is required.
- The Profile data model update is backward-compatible — an existing profile saved with the previous simpler model (plain string arrays for skills, languages, certifications, awards) will not cause errors; missing list fields default to empty arrays on load.
- A single user profile record is supported per application database instance.
- No avatar photo upload is in scope for this iteration; initials-only avatars continue.
- Only one inline entry form may be open at a time across all sections; this is now a firm requirement (see FR-062) rather than a design choice.
- Link platform detection (e.g. auto-labelling LinkedIn vs. GitHub based on URL domain) is out of scope for this iteration; users supply a friendly name or the URL is used as-is.
- The Calendar page does not consume Profile data in this iteration.
- Job application data and profile data remain private and local-first with no external analytics or data sharing.
- Browser navigation interception (e.g. blocking the browser back button with an unsaved-changes warning) is applied on a best-effort basis within the SPA routing capabilities; full interception may not be achievable for all navigation methods.
