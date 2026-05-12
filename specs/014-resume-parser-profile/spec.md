# Feature Specification: Resume Auto-Parser for Profile Builder

**Feature Branch**: `014-resume-parser-profile`
**Created**: 2026-05-10
**Status**: Draft
**Input**: Feature brief: `features/resume-parser-profile.md`

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Resume Import via Edit Profile Page (Priority: P1)

A user on the Edit Profile page uploads a resume file (PDF, DOCX, or TXT), clicks
"Process Resume", watches loading feedback, and sees the Edit Profile form pre-filled
with extracted data. They review, edit any incorrect or incomplete entries, and save
manually. No automatic save occurs.

**Why this priority**: This is the core value proposition. All other stories depend on
the parsing and pre-fill mechanic defined here. Without it, the feature delivers
nothing.

**Independent Test**: Navigate to the Edit Profile page. Locate the Resume Import area
near the top. Upload a PDF resume with recognizable sections (experience, education,
skills). Click "Process Resume". Confirm loading feedback appears. After processing,
verify fields such as first name, last name, experience entries, education, and skills
are pre-filled. Confirm no automatic save has occurred. Make a manual edit and click
Save — verify the saved profile reflects all changes.

**Acceptance Scenarios**:

1. **Given** the user is on the Edit Profile page, **When** the page renders, **Then**
   a Resume Import area is visible near the top of the page, with a click-to-upload
   target and drag-and-drop affordance on desktop
2. **Given** the user selects or drops a supported file (PDF, DOCX, TXT) under 5 MB,
   **When** the file is accepted, **Then** the filename is displayed and a "Process
   Resume" button is enabled
3. **Given** the user clicks "Process Resume", **When** processing begins, **Then** a
   loading indicator with at least one cycling status message appears ("Reading
   resume...", "Extracting experience...", "Building profile...") and the button is
   disabled for the duration
4. **Given** parsing completes successfully, **When** results are ready, **Then** all
   extractable fields in the Edit Profile form are pre-filled according to the merge
   rules (FR-025 to FR-028)
5. **Given** the form is pre-filled, **When** the user edits any field, **Then** the
   form behaves identically to normal manual editing
6. **Given** the form has pre-filled data (treated as unsaved changes), **When** the
   user clicks Save, **Then** the profile is saved exactly as if the user had manually
   entered all values
7. **Given** a file is already selected, **When** the user selects a different file,
   **Then** the previous file selection and any parsed state are replaced

---

### User Story 2 — Resume Import from Empty Profile State (Priority: P1)

A user with no saved profile visits the Profile page and sees two distinct options:
"Upload Resume" and "Build Profile Manually". Choosing "Upload Resume" navigates to
the Edit Profile page with the Resume Import area prominently presented at the top.
Choosing "Build Profile Manually" goes directly to Edit Profile with blank fields,
identical to the previous "Set Up Profile" behavior.

**Why this priority**: The empty state is the primary onboarding path for new users.
Surfacing the resume import option here reduces setup friction at the moment of first
use.

**Independent Test**: With no profile saved, navigate to the Profile page. Verify two
distinct options appear: "Upload Resume" and "Build Profile Manually". Click "Build
Profile Manually" — verify it navigates to the Edit Profile page with blank fields.
Return; click "Upload Resume" — verify the Edit Profile page opens with the Resume
Import area prominently shown at the top. Upload and process a file, then confirm
pre-filled fields appear in the form.

**Acceptance Scenarios**:

1. **Given** no profile exists, **When** the user visits the Profile page, **Then**
   the empty state shows two options: "Upload Resume" and "Build Profile Manually"
   instead of the previous single "Set Up Profile" button
2. **Given** the user clicks "Build Profile Manually", **When** the action fires,
   **Then** the user is navigated to the Edit Profile page with all fields blank,
   behavior identical to the previous "Set Up Profile" path
3. **Given** the user clicks "Upload Resume", **When** the action fires, **Then** the
   user is navigated to the Edit Profile page with the Resume Import area visually
   prominent (e.g. auto-scrolled to or highlighted)
4. **Given** the user arrives on Edit Profile via "Upload Resume", **When** they
   process a file and parsing succeeds, **Then** the Edit Profile form is pre-filled
   and dirty-state tracking begins

---

### User Story 3 — Existing Profile Field Protection (Priority: P2)

A user with a partially or fully populated profile imports a resume. Singular text
fields (name, email, phone, city, summary) only fill currently empty slots. Collection
sections (experience, education, certifications, skills, languages, awards, links)
append new entries and apply lightweight duplicate detection.

**Why this priority**: Users who already have profiles must not have their data silently
overwritten. This is a correctness and trust requirement.

**Independent Test**: Create a profile with a first name, one experience entry, and one
skill. Import a resume that contains a different value for first name, an overlapping
experience entry (same company, role, dates), and the same skill. Verify: first name is
unchanged; the overlapping experience entry is not duplicated; the existing skill is not
added again; any genuinely new experience or skill from the resume is appended.

**Acceptance Scenarios**:

1. **Given** a singular field (firstName, lastName, email, phone, city) already has a
   non-empty value, **When** parsing extracts a different value for that field, **Then**
   the existing value is preserved unchanged
2. **Given** a singular field is empty, **When** parsing extracts a value for that
   field, **Then** the field is pre-filled with the extracted value
3. **Given** the summary field is empty and the resume contains no explicit
   About/Summary section, **When** parsing completes, **Then** the summary field
   remains blank
4. **Given** an extracted experience entry matches an existing one (same company + role
   + dateStarted), **When** duplicate detection runs, **Then** the entry is not appended
5. **Given** an extracted education entry matches an existing one (same university +
   degreeMajor + yearCompleted), **When** duplicate detection runs, **Then** the entry
   is not appended
6. **Given** an extracted skill already exists in the profile (case-insensitive match),
   **When** duplicate detection runs, **Then** the skill is not added again
7. **Given** a genuinely new, non-duplicate entry is extracted, **When** parsing
   completes, **Then** that entry is appended to the appropriate collection section

---

### User Story 4 — Graceful Failure and Recovery (Priority: P3)

Parsing fails either partially (some sections unrecognized) or completely (no structured
data found). On partial failure, successfully extracted data still pre-fills applicable
fields. On complete failure, the user sees Retry and Continue Manually options without
losing their current editing state.

**Why this priority**: Users must never be left in a dead-end state. Recovery options
keep the import flow from blocking forward progress.

**Independent Test**: (a) Upload a TXT file with recognizable basic info but no
experience section — verify basic info fields are populated and experience is unchanged.
(b) Upload a file that yields no recognized structure — verify an error state appears
with Retry and Continue Manually actions, and the Edit Profile form is not corrupted.

**Acceptance Scenarios**:

1. **Given** the parser recognizes only some sections, **When** parsing completes,
   **Then** recognized data is pre-filled and unrecognized sections are left unchanged;
   no blocking error is shown
2. **Given** the parser recognizes no structured data (all scalar fields null and all
   arrays empty — see `data-model.md` "Complete parse failure" definition), **When**
   parsing completes, **Then** an error message appears with Retry and "Continue
   Manually" actions
3. **Given** the error state is shown, **When** the user clicks Retry, **Then** the
   import state resets to the file selection step, retaining the previously selected
   file for convenience
4. **Given** the error state is shown, **When** the user clicks "Continue Manually",
   **Then** the Resume Import UI is dismissed and the Edit Profile form is shown with
   any data pre-filled before the failure intact (not wiped)

---

### Edge Cases

- **Unsupported file type**: Any file not PDF, DOCX, or TXT is rejected at selection
  with a clear inline message; no upload or processing occurs
- **File over 5 MB**: Rejected at selection with an inline message; no upload occurs
- **File over 5 pages**: Processing proceeds but results may be limited; no hard
  client-side rejection (page count is not reliably determined before server parsing)
- **Name is a single token**: Placed in `firstName` only; `lastName` is left empty;
  existing required-field validation prevents save until user completes it
- **No explicit Skills section**: No skills are inferred from job descriptions;
  the skills field is left unchanged
- **Languages listed without proficiency levels**: Entries are appended with proficiency
  defaulting to "Intermediate"; user may change before saving
- **Certification extracted without a required field** (issuingBody or issuanceDate
  missing): Entry is pre-filled so the user can complete it; it will not pass validation
  until required fields are filled
- **Experience entry without a start date**: Entry is pre-filled with empty dateStarted;
  the user must supply it before the profile can be saved
- **Experience for a current role** ("Present", open end date, or equivalent detected):
  `currentWork` is set to `true` and `dateEnded` is omitted
- **LinkedIn or portfolio URL found in resume**: Appended to `links[]` with an
  appropriate friendlyName (e.g. "LinkedIn", "Portfolio"); duplicate check compares
  normalized URLs
- **Highly stylized or image-based PDF**: Text extraction yields low-quality output;
  partial or complete parse failure is expected and handled by the graceful failure path
- **User navigates away mid-import with pre-filled data**: Standard dirty-state
  behavior applies; pre-filled data counts as unsaved changes, triggering the existing
  discard confirmation flow

---

## Requirements *(mandatory)*

### Functional Requirements

**Resume Import UI**

- **FR-001**: The Edit Profile page MUST include a Resume Import area visible near the
  top of the page, before the profile section cards
- **FR-002**: The Resume Import area MUST support click-to-upload on all supported
  viewports (desktop and mobile)
- **FR-003**: The Resume Import area MUST support drag-and-drop on desktop viewports;
  drag-and-drop is not required on mobile
- **FR-004**: Accepted file types MUST be limited to PDF, DOCX, and TXT; any other
  type MUST be rejected at selection with an inline error; no upload occurs
- **FR-005**: Files exceeding 5 MB MUST be rejected at selection with an inline error;
  no upload occurs
- **FR-006**: After a valid file is selected, the filename MUST be displayed and the
  "Process Resume" button MUST become enabled
- **FR-007**: The "Process Resume" button MUST be disabled until a valid file has been
  accepted

**Processing**

- **FR-008**: Clicking "Process Resume" MUST display visible loading feedback immediately
  and disable the button for the duration of processing
- **FR-009**: Loading feedback MUST include at least one cycling or sequential status
  message (e.g. "Reading resume...", "Extracting experience...", "Building profile...")
- **FR-010**: Resume files MUST be sent to a dedicated server-side endpoint for text
  extraction and field parsing; the endpoint returns parsed structured JSON
- **FR-011**: Resume files MUST NOT be permanently stored; they MUST be discarded
  server-side after parsing, before the response is returned
- **FR-012**: Parsing MUST NOT call any external API, LLM, or third-party service;
  all extraction is performed locally

**Field Mapping**

- **FR-013**: The full name extracted from the resume MUST be split into `firstName`
  and `lastName`; if only a single token is found, it maps to `firstName` only
- **FR-014**: Extracted email, phone, and location MUST map to `email`, `phone`, and
  `city` respectively
- **FR-015**: "Current role/title" is NOT extracted in V1; the existing profile model
  has no standalone headline field
- **FR-016**: LinkedIn and portfolio URLs MUST be appended to `links[]` with
  appropriate friendlyNames; there is no singular URL profile field
- **FR-017**: The `summary` field MUST only be populated if an explicit
  About/Summary/Profile section is found in the resume; it MUST NOT be inferred or
  generated from other content
- **FR-018**: Experience entries MUST map to `experience[]`:
  - position title → `role`
  - company name → `company`
  - role description/bullet points (concatenated) → `responsibilities`
  - start date → `dateStarted` (MM/YYYY)
  - end date → `dateEnded` (MM/YYYY); if current role detected → `currentWork: true`,
    `dateEnded` omitted
- **FR-019**: Education entries MUST map to `education[]`:
  - school → `university`
  - degree + field of study combined → `degreeMajor`
  - graduation/end year → `yearCompleted` (4-digit year); start year is not stored in V1
- **FR-020**: Certification entries MUST map to `certifications[]`:
  - certification name → `name`
  - issuing organization → `issuingBody`
  - issue date → `issuanceDate` (MM/YYYY)
  - expiry date → `expiryDate` (MM/YYYY, optional)
- **FR-021**: Skills MUST be appended to `skills[]` only when sourced from an
  explicitly labeled Skills section; no inference from job descriptions
- **FR-022**: Skills MUST be deduplicated before appending (case-insensitive match
  against existing profile skills and newly extracted skills)
- **FR-023**: Language entries MUST map to `languages[]`:
  - language name → `language`
  - stated proficiency → `proficiency` (mapped to nearest valid level); if not stated,
    defaults to "Intermediate"
- **FR-024**: Award entries MUST map to `awards[]`:
  - award name → `awardName`
  - issuing body → `issuingBody`
  - description → `details` (optional)
  - date → `date` (MM/YYYY, optional)

**Merge Rules**

- **FR-025**: Singular profile fields (`firstName`, `lastName`, `email`, `phone`,
  `city`, `summary`) MUST NOT be overwritten if they already contain a non-empty value
- **FR-026**: Empty singular fields MUST be filled with the extracted value
- **FR-027**: Collection fields (`experience`, `education`, `certifications`, `skills`,
  `languages`, `awards`, `links`) MUST append newly extracted entries; existing entries
  are not replaced or removed
- **FR-028**: Duplicate detection MUST be applied before appending, using these keys:
  - experience: same `company` + `role` + `dateStarted`
  - education: same `university` + `degreeMajor` + `yearCompleted`
  - certifications: same `name` + `issuingBody`
  - skills: case-insensitive string match
  - languages: same `language` (case-insensitive)
  - links: same normalized URL
  - awards: same `awardName` + `issuingBody`

**No Automatic Save**

- **FR-029**: No profile data MUST be automatically saved as a result of resume import;
  the user MUST explicitly click Save on the Edit Profile page to persist changes
- **FR-030**: Pre-filled data MUST be treated as unsaved changes (dirty state); the
  existing discard confirmation flow MUST apply if the user attempts to navigate away

**Empty Profile State**

- **FR-031**: When no profile exists, the Profile page empty state MUST present two
  options: "Upload Resume" and "Build Profile Manually"
- **FR-032**: "Build Profile Manually" MUST navigate to the Edit Profile page with
  blank fields, identical to the previous "Set Up Profile" behavior
- **FR-033**: "Upload Resume" MUST navigate to the Edit Profile page with the Resume
  Import area visually prominent at the top (e.g. auto-scrolled to or highlighted)

**Error Handling**

- **FR-034**: On complete parse failure, the system MUST display a non-blocking error
  message with two recovery actions: "Retry" and "Continue Manually"
- **FR-035**: "Retry" MUST reset the import state to file selection, retaining the
  previously selected file
- **FR-036**: "Continue Manually" MUST dismiss the import area and show the Edit Profile
  form with any data that was pre-filled before failure intact
- **FR-037**: On partial parse failure, successfully extracted data MUST be pre-filled;
  no blocking error is shown; user may complete missing fields manually

**Constitution Compliance**

- **FR-038**: The Resume Import UI MUST have labeled controls, keyboard-operable file
  selection, and non-color-only status communication
- **FR-039**: All resume content rendered in the form MUST be treated as untrusted and
  rendered safely to prevent injection attacks
- **FR-040**: Resume files and parsed content MUST remain private and local; no external
  analytics, tracking, or third-party data sharing is permitted
- **FR-041**: The Resume Import UI MUST be usable on both desktop and mobile viewports;
  drag-and-drop is desktop-only but click-to-upload is required on all viewports
- **FR-042**: All existing automated tests MUST continue to pass after this feature is
  introduced; no regressions in the Profile page, Tracker, or Calendar

### Key Entities

- **ResumeUpload**: A transient file upload processed within a single server request
  cycle — never written to permanent storage
- **ParsedProfileData**: A transient, unvalidated set of values returned from the
  server after parsing — not persisted; used only to pre-fill the Edit Profile form
- **Profile**: The existing user profile record (defined in spec `008-edit-profile-full`);
  no schema changes are required in V1; this feature operates entirely through the
  existing model fields via the merge rules defined above

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can upload a supported resume file, click Process, and have
  recognizable fields pre-filled in the Edit Profile form in under 5 seconds for a
  standard 1–2 page resume on a local connection
- **SC-002**: Existing non-empty singular profile fields are never overwritten by a
  resume import; 100% of merge-rule tests for this behavior pass
- **SC-003**: A complete parse failure always presents Retry and Continue Manually
  options; the user is never left on a screen with no forward path
- **SC-004**: No resume file is written to permanent storage; server-side verification
  confirms files are discarded within the request cycle
- **SC-005**: No automatic profile save occurs as a result of import; the user's
  explicit Save action is always required before any data is persisted
- **SC-006**: The Resume Import UI renders and operates correctly on both desktop and
  mobile viewports without horizontal scrolling
- **SC-007**: All existing automated test suites pass after required test updates
  are applied (Profile.test.js and ProfileEdit.test.js require updates per plan;
  Tracker and Calendar tests require no modification)

---

## Assumptions

- Resume text extraction (PDF, DOCX, TXT) is handled server-side via a new POST
  endpoint (`POST /api/resume/parse` or equivalent); the client sends the file as
  multipart/form-data and receives parsed structured JSON in the response
- For PDF: a Node.js text-extraction library (e.g. `pdf-parse`) is used without OCR;
  image-only PDFs produce low-quality output handled by the graceful failure path
- For DOCX: a Node.js extraction library (e.g. `mammoth`) strips formatting and
  extracts plain text
- For TXT: raw text is passed directly to the field-parsing logic
- "Current role/title" extraction was requested in the feature brief but is explicitly
  excluded in V1 (FR-015); the existing profile model has no standalone headline field.
  This is an accepted scope reduction from the brief. If a `headline` field is
  introduced in a future spec, extraction can be added then
- "Attendance dates" for education means start and end years; only the graduation/end
  year is stored as `yearCompleted`; start year is discarded in V1 to match the
  existing model
- Language proficiency defaults to "Intermediate" when no level is stated in the resume
- The empty-profile entry point replaces the existing single "Set Up Profile" button
  with a two-option layout; the new layout must match existing Profile page design
  conventions
- Client-side file size validation (5 MB) is enforced before upload; the server applies
  a second defense via multipart size limits
- A single user profile record per database instance is assumed; no multi-profile
  handling is needed
- No new profile model fields are required in V1; all extracted data maps to existing
  fields via the merge rules defined above
- V1 supports English-language resumes only; non-English content will produce poor
  extraction results and is not a supported case. Multi-language support is out of scope
