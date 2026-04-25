# Feature Specification: Local Persistence & Backend Support

**Feature Branch**: `002-backend-persistence`  
**Created**: 2026-04-26  
**Status**: Draft  
**Last updated**: 2026-04-26 (architect review applied)  
**Input**: User description: "Build local persistence and backend support for the web-based application tracker."

## User Scenarios & Testing *(mandatory)*

### System Property — Data Survives Restart

This is a system-level property, not an independently deliverable user story. It is validated only after User Story 1 (Create) and User Story 2 (View All) are implemented, since proving persistence requires the ability to both write and read records.

**Acceptance Scenarios**:

1. **Given** a user has saved at least one application record, **When** they refresh the browser, **Then** all previously saved records appear on the tracker list with correct field values.
2. **Given** a user has saved at least one application record, **When** they stop and restart the local backend server, **Then** all previously saved records are still accessible.
3. **Given** the data storage does not yet exist, **When** the app is started from a clean checkout, **Then** setup instructions guide the user to initialize storage successfully.

---

### User Story 1 - Create a New Application Record (Priority: P1) 🎯 MVP

A user finds a job posting and wants to log it as a tracked application. They fill in the relevant details and save the record so it appears in their tracker.

**Why this priority**: Creating records is the entry point to all other interactions and the prerequisite for validating the persistence system property.

**Independent Test**: Can be tested by submitting a new application record through the app and confirming it appears in the list and survives a backend restart.

**Acceptance Scenarios**:

1. **Given** the backend is running, **When** the user submits a new application with all required fields, **Then** the record is saved and immediately visible in the application list.
2. **Given** the user submits a record with required fields missing, **When** the request is processed, **Then** the system rejects it with a specific, human-readable error identifying which fields are missing.
3. **Given** the user provides an invalid job posting URL, **When** the request is processed, **Then** the system rejects it with a clear error explaining the URL format is invalid.
4. **Given** a record is saved, **When** the user refreshes the browser, **Then** the record still appears with all field values intact.

---

### User Story 2 - View All Application Records (Priority: P2)

A user wants to see a full list of all their tracked applications so they can review their job search progress at a glance.

**Why this priority**: Viewing the list is the primary read path and is required to verify the persistence system property.

**Independent Test**: Can be tested by confirming that all saved records appear in the list in a consistent order after a backend restart.

**Acceptance Scenarios**:

1. **Given** one or more records exist, **When** the user opens the tracker, **Then** all active (non-archived) records are shown.
2. **Given** no records exist yet, **When** the user opens the tracker, **Then** an appropriate empty state is shown.
3. **Given** the backend server is not running, **When** the user opens the tracker, **Then** a clear message is shown explaining the backend is unreachable.

---

### User Story 3 - View a Single Application Record (Priority: P2)

A user wants to open a specific application and see its full details, including fields not shown on the summary list.

**Why this priority**: Detail view surfaces the complete record for review and decision-making.

**Independent Test**: Can be tested by opening a saved record and confirming all field values are shown correctly.

**Acceptance Scenarios**:

1. **Given** an application exists, **When** the user opens its detail view, **Then** all stored fields are shown with correct values.
2. **Given** an application does not exist, **When** the user requests it by ID, **Then** the system responds with a clear not-found error.

---

### User Story 4 - Update an Existing Application Record (Priority: P2)

A user's application status changes — they receive an interview, get rejected, or need to update notes. They want to edit an existing record and have the changes saved.

**Why this priority**: Application state changes constantly during a job search. Without edits, the tracker becomes stale immediately.

**Independent Test**: Can be tested by changing a field on an existing record, saving, and confirming the updated value is shown on reload.

**Acceptance Scenarios**:

1. **Given** a record exists, **When** the user updates one or more fields and saves, **Then** the updated values are reflected and the record's last-modified timestamp has changed.
2. **Given** a user submits a partial update (only some fields), **When** the update is processed, **Then** only the specified fields are changed and all other fields retain their original values.
3. **Given** an update includes an invalid URL, **When** the update is processed, **Then** the system rejects it with a clear validation error and the existing record is unchanged.

---

### User Story 5 - Archive an Application Record (Priority: P3)

A user wants to remove an application from their active list — either because it's no longer relevant or was entered by mistake — without permanently losing the record.

**Why this priority**: Archiving is a cleanup action. The tracker remains usable without it.

**Independent Test**: Can be tested by archiving a record and confirming it disappears from the active list.

**Acceptance Scenarios**:

1. **Given** an application exists, **When** the user archives it, **Then** it is removed from the active application list.
2. **Given** an archived record, **When** the user refreshes the tracker, **Then** the record does not appear in the active list.

---

### Edge Cases

- What happens when the user submits a record with all optional fields omitted? (System should accept it if required fields are present.)
- What happens when a date field receives a value in an unexpected format? (System should reject with a clear format error.)
- What happens when a URL field receives a value without a valid protocol (e.g., missing `https://`)? (System should reject it.)
- What happens when the user attempts to update a record that no longer exists? (System should return a clear not-found error.)
- What happens when the backend server is not running when the page loads? (Frontend must catch the network error and show a specific message: "Cannot connect to the backend — is the server running?")
- What happens when `metadata` receives a non-JSON value (e.g., a plain string)? (System should reject it with a validation error.)
- What happens when two records are created in rapid succession? (Each must receive a unique identifier.)

## Requirements *(mandatory)*

### Functional Requirements

**Data persistence:**
- **FR-001**: The system MUST persist all application records to durable local storage so data survives browser refresh and backend restart.
- **FR-002**: The system MUST initialize storage automatically from a clean checkout using documented, repeatable setup steps.
- **FR-003**: Every record MUST be assigned a unique integer identifier at creation time that does not change for the lifetime of the record.
- **FR-004**: Every record MUST automatically record when it was first created and when it was last modified; these values MUST NOT be editable by the user.
- **FR-005**: Partial updates MUST NOT overwrite fields that are not included in the update request.

**CRUD operations:**
- **FR-006**: The system MUST allow users to create a new application record.
- **FR-007**: The system MUST allow users to retrieve a list of all active (non-archived) application records.
- **FR-008**: The system MUST allow users to retrieve the full details of a single record by its unique identifier.
- **FR-009**: The system MUST allow users to update an existing application record.
- **FR-010**: The system MUST allow users to archive an application record, removing it from the active list without permanently deleting the data.

**Validation:**
- **FR-011**: The system MUST enforce required fields (company name, job title, status) at the point of save, regardless of which interface submits the data.
- **FR-012**: The system MUST reject any job posting URL that is not a well-formed URL with a valid web protocol.
- **FR-013**: The system MUST enforce a consistent date format for all date fields across the application.
- **FR-014**: The system MUST return specific, human-readable error messages that identify which field failed and why.

**Service layer:**
- **FR-015**: The system MUST expose a service interface that supports: list all active records, get one record by ID, create a record, update a record, and archive a record.
- **FR-016**: All service responses MUST follow a consistent structure for both successful and error outcomes.
- **FR-017**: The frontend MUST connect to the service layer rather than managing data directly in browser memory.
- **FR-018**: The frontend MUST display clear success and error states for all user-initiated operations, including a specific message when the backend is unreachable.

**Extensibility:**
- **FR-019**: The data model MUST include a flexible, unstructured storage field (`metadata`) to accommodate future additions such as AI-parsed job description outputs, without requiring schema changes to existing fields.
- **FR-020**: The schema MUST be designed so that future fields can be added without breaking existing records or requiring migration of currently stored values.

**Constitution compliance:**
- **FR-021**: The system MUST preserve required job application fields: company name, job title, status, and last status update date.
- **FR-022**: The system MUST avoid external analytics, tracking, or data sharing.
- **FR-023**: The system MUST support desktop and mobile browser use, labeled forms, keyboard navigation, and non-color-only status communication.

### Key Entities

- **Job Application**: A tracked record representing one job a user has applied to or is considering.
  - *Required*: company name (`companyName`), job title (`jobTitle`), status
  - *Optional*: source platform, application date, job posting URL, recruiter, notes, salary, responsibilities, skills (array of strings), compatibility score (`compat`, 0–100), starred flag (`fav`), follow-up action, follow-up date, metadata (unstructured JSON)
  - *System-managed*: unique integer ID, last status update date, created timestamp, last-modified timestamp, archived flag
- **Archive State**: A flag on a Job Application record indicating it has been removed from the active list. Archived records are retained in storage but excluded from the default list view.

## Out of Scope

- User accounts and authentication
- Cloud sync and multi-device access
- Multi-user collaboration
- Job board crawling or scraping
- AI parsing implementation
- Email reminders
- File attachments
- Production deployment
- **Pagination and server-side sorting** (will be addressed in a future feature)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of records saved before a browser refresh or backend restart are available and correctly displayed when the user returns.
- **SC-002**: Every record created receives a unique identifier; no two records share the same ID regardless of creation timing.
- **SC-003**: Records missing required fields are rejected 100% of the time with a human-readable error message before any data is written to storage.
- **SC-004**: Invalid job posting URLs are rejected 100% of the time with a human-readable error message before any data is written to storage.
- **SC-005**: Partial updates change only the fields included in the request; all other fields retain their original values in 100% of update operations.
- **SC-006**: Archived records do not appear in the active application list after archiving, and this state persists across browser refresh and backend restart.
- **SC-007**: A user can set up the storage layer from a clean project checkout by following documented steps, with no manual file editing required beyond those steps.
- **SC-008**: All data operations (create, read, update, archive) complete and are reflected in the UI within 300ms under normal local conditions.

## Assumptions

- The app runs locally for a single user with no authentication or multi-user access.
- Archive (soft delete) is chosen over hard delete. Archived records are retained in storage but hidden from the active list. This choice preserves historical data and allows future recovery if needed. Hard delete is out of scope for this feature.
- The local backend server and the frontend are run together on the same machine during development and personal use.
- No migration of existing browser localStorage data is required in this phase; users may need to re-enter any existing records manually.
- The `metadata` field stores arbitrary JSON for future use; its internal structure is not validated or interpreted in this phase.
- Date fields follow the ISO 8601 standard (YYYY-MM-DD) as established in the existing codebase.
- The service layer will be available locally; no offline-without-backend mode is required.
- Single-instance use only; concurrent writes from multiple clients are out of scope.
- The existing frontend field names (`position`, `company`, `url`, `last_status_update`) will be updated to match the new API field names (`jobTitle`, `companyName`, `jobPostingUrl`, `lastStatusUpdate`) as part of this feature.
