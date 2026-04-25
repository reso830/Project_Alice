# Feature Specification: Responsive Job Application Tracker Web App

**Feature Branch**: `001-app-tracker-ui`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "Responsive web app for job application tracking with card-based tracker view, navigation bar, and detail modals"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse Job Applications at a Glance (Priority: P1)

A job seeker opens the app and immediately lands on the Tracker page, where all their job applications are displayed as card rows ordered by ID. Each card surfaces the most critical information — position title, company, current status, compatibility score, and last updated date — without requiring any clicks. The user can visually scan, compare, and assess the state of their job search from a single view.

**Why this priority**: This is the core value of the app. Without a scannable list of applications, nothing else is useful. It is the first thing every user sees and the feature they will use most often.

**Independent Test**: Can be fully tested by loading the Tracker page with sample data and verifying that all required card fields are visible and ordered correctly. Delivers value as a read-only dashboard even without any interactive features.

**Acceptance Scenarios**:

1. **Given** the user opens the app, **When** the page loads, **Then** the Tracker page is displayed by default with all job application cards visible in a scrollable list
2. **Given** there are job applications in the system, **When** the Tracker page is displayed, **Then** each card shows the application ID, status badge, position title, company name, last updated date, compatibility score bar, a 2-line preview of responsibilities, skill tags, salary, and the job posting URL (or — when absent); any optional field that is absent displays a dash (—)
3. **Given** there are multiple job applications, **When** the Tracker page is displayed, **Then** cards are ordered by ID ascending, with any cards that have invalid or missing IDs appearing at the bottom
4. **Given** the Tracker page is displayed, **When** the user views the toolbar, **Then** a count badge showing the total number of applications is visible
5. **Given** there are no job applications in the system, **When** the Tracker page is displayed, **Then** an empty state message is shown prompting the user to add their first application

---

### User Story 2 — View Full Application Details (Priority: P2)

A job seeker makes a deliberate click (not a scroll gesture) on a card row to open a detail modal that shows all fields for that application — including recruiter contact, job posting URL, full responsibilities, and skills — without navigating away from the Tracker page. The Edit button on the card also opens this same detail modal. The background remains visible but non-interactive and non-scrollable. The user can close the modal by clicking outside it, and their scroll position in the list is preserved.

**Why this priority**: Many fields cannot fit on the card. Users need a quick way to see all details for any application without losing their place in the list.

**Independent Test**: Can be tested by clicking any card and verifying that the detail modal appears with complete application data, background scroll is locked, the list scroll position is preserved on close, and the modal closes on outside click.

**Acceptance Scenarios**:

1. **Given** the Tracker page is displayed and the user is not scrolling, **When** the user clicks on a card row body (excluding action buttons), **Then** a detail modal opens showing all application fields
2. **Given** the Tracker page is displayed, **When** the user clicks the Edit button on a card, **Then** the same detail modal opens for that application
3. **Given** the detail modal is open, **When** the user tries to scroll the background page, **Then** the background does not scroll
4. **Given** the detail modal is open and the user has scrolled partway down the Tracker list, **When** the user closes the modal by clicking outside it, **Then** the modal closes, background scroll is restored, and the list returns to the same scroll position as before the modal was opened
5. **Given** the detail modal is open, **When** the user views the modal header, **Then** the application ID, status, and position title are prominently displayed
6. **Given** the detail modal is open, **When** the user changes the status via the modal's status control, **Then** the status badge in the modal updates immediately, the last updated date in the modal body refreshes to the current date, and the card behind it also reflects the new status and last updated date without closing the modal

---

### User Story 3 — Take Quick Actions Directly from a Card (Priority: P3)

A job seeker can change an application's status, star/favorite it, or copy the job posting URL directly from the card row — without opening the detail modal. Status changes are immediately reflected in the card's badge and left-border accent color. A brief toast notification confirms clipboard actions, and a distinct failure toast appears if the clipboard operation is denied or fails.

**Why this priority**: Frequent micro-actions (status updates, bookmarking) should not require opening a full modal. Speed of interaction matters for users managing many applications.

**Independent Test**: Can be tested by using the status change button on a card to update the status and verifying the badge and border color update immediately without a page reload.

**Acceptance Scenarios**:

1. **Given** a card is displayed, **When** the user clicks the status change button, **Then** a dropdown appears with all available status options
2. **Given** the status dropdown is open, **When** the user selects a new status, **Then** the card's status badge and left-border accent update immediately, the dropdown closes, and the last updated date on the card refreshes to the current date
3. **Given** a card is displayed, **When** the user clicks the star button, **Then** the star toggles to a gold/filled state and persists across page reloads
4. **Given** a card is displayed with a job URL and clipboard access is available, **When** the user clicks the copy URL button, **Then** the URL is copied to the clipboard and a success toast notification appears and auto-dismisses within 3 seconds
5. **Given** a card is displayed with a job URL and clipboard access is denied or fails, **When** the user clicks the copy URL button, **Then** a failure toast notification appears indicating the copy was unsuccessful
6. **Given** the status dropdown is open, **When** the user clicks outside it, **Then** the dropdown closes without changing the status

---

### User Story 4 — Responsive Layout Across Devices (Priority: P4)

A job seeker uses the app on both a desktop browser (landscape) and a mobile browser (portrait). On desktop, cards display in a 3-row horizontal layout. On mobile, card content stacks vertically for readability. The detail modal becomes a bottom-sheet on mobile, sliding up from the bottom of the screen. The top navigation bar remains usable at all sizes.

**Why this priority**: The user explicitly requires both desktop and mobile support. An app that breaks on mobile is not shippable.

**Independent Test**: Can be tested by loading the app at desktop width (> 1024px) and mobile width (< 640px) and verifying that cards and modals render correctly at both sizes without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** the app is viewed on a desktop browser (> 1024px wide), **When** the Tracker page is displayed, **Then** cards show the full 3-row layout with the compatibility bar at partial width and actions aligned to the right
2. **Given** the app is viewed on a mobile browser (< 640px wide), **When** the Tracker page is displayed, **Then** card content stacks vertically with each section on its own row and the compatibility bar spans full card width
3. **Given** the app is viewed on a mobile browser, **When** the user clicks a card, **Then** the detail modal appears as a bottom-sheet sliding up from the bottom with rounded top corners
4. **Given** the app is viewed at tablet width (640–1023px), **When** the Tracker page is displayed, **Then** the layout adapts with responsibilities wrapping to their own row and the modal becoming single-column

---

### User Story 5 — Navigate Between App Sections (Priority: P5)

A job seeker uses the top navigation bar to switch between the three main sections: Tracker, Calendar, and Profile. The active page is visually highlighted in the nav bar. The Calendar page shows a month grid with status update dates, and the Profile page shows summary stats. Both Calendar and Profile are stub implementations in this feature. Returning to the Tracker page always starts at the top of the list.

**Why this priority**: Navigation must exist for the app to feel complete, but Calendar and Profile stubs add minimal complexity while establishing the full information architecture.

**Independent Test**: Can be tested by clicking each nav button and verifying the correct page content is displayed and the active button is visually distinct.

**Acceptance Scenarios**:

1. **Given** the app is displayed, **When** the user clicks "Calendar" in the nav bar, **Then** the Calendar page is shown with a month grid stub displaying status update dates
2. **Given** the app is displayed, **When** the user clicks "Profile" in the nav bar, **Then** the Profile page is shown with summary stat cards (total, active, offers, rejections)
3. **Given** the user is on any page, **When** they view the nav bar, **Then** the currently active page button is visually distinct from the others
4. **Given** the user has navigated to Calendar or Profile, **When** the user clicks "Tracker" in the nav bar, **Then** the Tracker page is displayed and the list is scrolled to the top

---

### Edge Cases

- What happens when there are no job applications? → Show an empty state message prompting the user to add their first application
- How does the modal handle very long responsibilities or skills content? → The modal is independently scrollable up to 90% of viewport height; content does not overflow outside the modal bounds
- What happens when the user tries to copy a URL but the URL field is empty? → The copy URL button is always visible; clicking it when no URL is set shows a toast notifying the user that no URL is on file; the URL text display in the card shows a dash (—) and is not a clickable link
- What happens if the compatibility score is 0% or 100%? → The bar renders correctly at both extremes with a readable percentage label
- What happens when the status dropdown would extend beyond the viewport edge? → The dropdown repositions to remain fully visible: if the panel bottom would exceed the viewport height it opens above the anchor; if the panel right edge would exceed the viewport width it right-aligns to the anchor element instead
- What happens if a modal is already open and the user clicks another card? → The backdrop covers the card list, making it non-interactive; this scenario cannot occur
- What happens when clipboard copy fails or is denied? → A failure toast appears (e.g., "Copy failed — check browser permissions") and auto-dismisses within 3 seconds
- What happens if a stored application is missing its status field? → The status defaults to Wishlisted; the card renders normally with the Wishlisted badge
- What happens if a stored application has a missing or unparseable ID? → The card receives a soft red highlight and a warning icon; these entries are sorted to the bottom of the list below all valid entries

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a persistent top navigation bar containing the app title/logo on the left and navigation buttons (Tracker, Calendar, Profile) on the right, visible on all pages
- **FR-002**: System MUST default to the Tracker page when the app is first loaded
- **FR-003**: System MUST visually highlight the active navigation button to distinguish it from inactive ones; all three navigation labels MUST be visible without scrolling on desktop and mobile viewports
- **FR-004**: System MUST display all job applications as interactive card rows in the Tracker page, ordered by ID ascending by default; cards with invalid or missing IDs MUST appear at the bottom of the list
- **FR-005**: Each card MUST display: application ID pill, status badge, position title, company name, last updated date, compatibility score bar with percentage label, a 2-line clamped preview of responsibilities, skill tags, salary, and the job posting URL as plain text (not a link); any optional field that is absent MUST display a dash (—) in its place
- **FR-006**: Each card MUST include quick action buttons: Edit, Status Change, Copy URL, and Star/Favorite; the Edit button MUST open the same detail modal as clicking the card body
- **FR-007**: System MUST open a detail modal when the user makes a deliberate click (not a scroll gesture) on a card row body, where the click target excludes all action buttons (Edit, Status Change, Copy URL, Star)
- **FR-008**: System MUST lock background page scroll when any modal or overlay is open
- **FR-009**: System MUST restore background scroll and preserve the Tracker list scroll position when a modal is closed
- **FR-010**: System MUST close an open modal when the user clicks outside the modal content area
- **FR-011**: The detail modal MUST display all application fields: ID, position, company, status, recruiter, job posting URL, full responsibilities, skills, salary, compatibility score, and last updated date; absent optional fields MUST display a dash (—)
- **FR-012**: System MUST allow users to change an application's status via an inline dropdown accessible from both the card's status change button and from within the detail modal; both entry points MUST update the card immediately and close the dropdown on selection
- **FR-013**: Status changes MUST be reflected immediately on the card (badge color and left-border accent) without a page reload; the last updated date on the card MUST refresh to the current date at the same time
- **FR-014**: System MUST allow users to toggle the star/favorite state on any application card, and the state MUST persist across page reloads
- **FR-015**: System MUST attempt to copy the job posting URL to the clipboard when the copy URL button is clicked; on success, display a success toast that auto-dismisses within 3 seconds; on failure or permission denial, display a failure toast that auto-dismisses within 3 seconds
- **FR-016**: The Copy URL quick action button MUST always be visible on the card; when clicked and no URL is set, the system MUST show a toast notifying the user that no URL is on file; the URL text display in the card MUST show a dash (—) when no URL is set and MUST NOT be rendered as a clickable link
- **FR-017**: System MUST display a toolbar below the top bar showing a count badge with the total number of applications
- **FR-018**: System MUST show an empty state message when no applications exist in the Tracker
- **FR-019**: System MUST use a defined set of application statuses with consistent visual representation: Wishlisted, Applied, Phone Screen, Interview, Technical Assessment, Offer, Rejected, Withdrawn, Ghosted
- **FR-020**: Application status MUST be communicated by visible label text in addition to color, so that status is identifiable without relying on color perception alone
- **FR-021**: The layout MUST be responsive with distinct adaptations for desktop (> 1024px), tablet (640–1023px), and mobile (< 640px) viewports
- **FR-022**: On mobile viewports (< 640px), the detail modal MUST appear as a bottom-sheet that slides up from the bottom with rounded top corners
- **FR-023**: System MUST display the Calendar page as a stub with a month grid showing status update dates when the user navigates to it
- **FR-024**: System MUST display the Profile page as a stub with stat cards (total applications, active, offers, rejections) when the user navigates to it
- **FR-025**: System MUST enforce the following required fields: ID, position title, company name, and status; if status is missing at load time, the system MUST default it to Wishlisted; if ID is missing or non-numeric (blank, alphabetical, or symbolic characters), the card MUST display a soft red highlight and warning icon and be sorted to the bottom of the list
- **FR-026**: Optional fields (recruiter, URL, salary, responsibilities, skills, compatibility score) MUST render a dash (—) when absent; cards and modals MUST not break or show empty gaps when these fields are missing
- **FR-027**: System MUST close any open modal or status dropdown when the user presses the Escape key

### Key Entities *(include if feature involves data)*

- **Job Application**: A tracked application record containing: ID (zero-padded sequential integer, e.g., 001, 002 — immutable primary key), position title, company name, status (enum), responsibilities (long text), skills (array of strings rendered as pill tags), salary (text), compatibility score (integer 0–100, randomized at entry creation and fixed until a future scoring feature ships), last updated date (`last_status_update` — auto-set to the current date when the entry is first created and on every subsequent status change; shown on card and in modal), recruiter name, job posting URL, and starred/favorite state (boolean)
- **Application Status**: An enumerated classification with nine values (Wishlisted, Applied, Phone Screen, Interview, Technical Assessment, Offer, Rejected, Withdrawn, Ghosted), each with an associated badge style and card left-border accent color; status label text is always visible alongside color
- **Navigation Page**: One of three top-level sections (Tracker, Calendar, Profile), with one section active at a time and tracked at the app level

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the position, company, status, and compatibility of any application without clicking — all key fields are visible on the card face
- **SC-002**: The detail modal opens within 1 second of clicking a card on both desktop and mobile devices
- **SC-003**: The app is fully usable on desktop (landscape, > 1024px) and mobile (portrait, < 640px) without horizontal scrolling or layout overflow at either size
- **SC-004**: Background content is non-scrollable 100% of the time while a modal is open
- **SC-005**: Status changes are visually reflected on the card within 1 second of the user selecting a new status
- **SC-006**: All three navigation labels (Tracker, Calendar, Profile) are visible and legible without scrolling on both desktop and mobile viewports
- **SC-007**: Toast notifications appear within 500ms of a clipboard action and auto-dismiss within 3 seconds, for both success and failure outcomes

## Assumptions

- The app serves a single user with no login or authentication required for this feature
- Application data is stored locally in the user's browser and persists across sessions without a server
- Calendar and Profile pages are stub implementations only — fully interactive versions are out of scope for this feature
- No internet connection is required after initial page load (beyond loading external fonts if applicable)
- The Edit button on cards opens the detail modal in this feature; a dedicated edit/form experience is a separate future feature
- The exact app title/brand name is a design decision separate from this specification
- Skill tags, salary, recruiter, and URL are optional fields; absent fields display a dash (—) and never cause visual breakage
- Compatibility score values are randomized at entry creation and persist; a future feature will replace randomization with a real scoring mechanism
- Job application data is private and local-first; no external data sharing or analytics are in scope

## QA Notes

- Cross-browser rendering (Chrome, Firefox, Safari on desktop and mobile) should be verified during QA but is not a functional requirement of this specification
