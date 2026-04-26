# Feature Specification: Pagination & Footer UI

**Feature Branch**: `005-pagination-footer`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User description: "Implement pagination and footer UI for the application tracker."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Navigate a Large Application List via Pagination (Priority: P1)

A user with more than 10 tracked job applications can move through their list in manageable pages rather than scrolling through an endless list, keeping their review focused and efficient.

**Why this priority**: Without pagination, large lists become hard to scan and review. This is the primary usability improvement this feature delivers.

**Independent Test**: Create more than 10 application records, then verify that page controls appear and that clicking between pages shows different records.

**Acceptance Scenarios**:

1. **Given** 11 or more application records exist, **When** the user views the application list, **Then** page navigation controls are visible below the list.
2. **Given** pagination is visible, **When** the user clicks a page number, **Then** the list updates to show only that page's records, the view scrolls to the top, and keyboard focus moves to the top of the list region.
3. **Given** 10 or fewer application records exist, **When** the user views the application list, **Then** no pagination controls are shown.
4. **Given** the user is on page 3, **When** a search, filter, archive, or reload changes the displayed dataset, **Then** the view preserves page 3 if that page is still valid; otherwise it moves to the highest valid page, or page 1 when pagination is no longer needed.
5. **Given** pagination is visible with many pages, **When** the user views the controls, **Then** first and last pages are always accessible, and non-adjacent ranges are separated by a non-clickable ellipsis.

---

### User Story 2 — View a Consistent Footer on Every Page (Priority: P2)

A user visiting any page of the application sees a persistent footer with brand identity, product version, technology credits, and options to give feedback — creating a professional, trustworthy experience.

**Why this priority**: The footer establishes brand consistency and provides a feedback pathway. It is secondary to the core navigation feature but adds polish and usability across the whole product.

**Independent Test**: Navigate to any page in the app and confirm the footer is visible at the bottom with all required sections present.

**Acceptance Scenarios**:

1. **Given** the user is on any page, **When** they scroll to the bottom, **Then** the footer is visible with brand name, version, technology credits, and feedback links.
2. **Given** the footer is visible, **When** the user clicks a feedback link, **Then** the project's GitHub new-issue page opens in a new browser tab.
3. **Given** the footer is visible, **When** the user views the copyright line, **Then** it reads "© 2026 Project Alice. All rights reserved. · Part of reso's Project Series."

---

### User Story 3 — Access Pagination and Footer on a Mobile Device (Priority: P3)

A user on a small-screen device can navigate between pages and see the footer without layout breakage, horizontal scrolling, or inaccessible controls.

**Why this priority**: The project constitution requires desktop and mobile browser support. Layout responsiveness ensures the feature works for all users.

**Independent Test**: Open the app on a mobile-sized viewport and confirm pagination buttons are tappable and the footer columns reflow correctly.

**Acceptance Scenarios**:

1. **Given** a viewport narrower than 640px, **When** the footer is visible, **Then** it reflows into a 2-column layout with brand and copyright spanning the full width.
2. **Given** a viewport narrower than 640px, **When** pagination is visible, **Then** all page buttons are accessible and tappable without horizontal scrolling.

---

### Edge Cases

- What happens when total records is exactly 10? — Pagination is hidden; all 10 records appear on one page.
- What happens when total records is exactly 11? — Pagination appears showing 2 pages.
- What happens when the user is on page 3 and a filter reduces results to 5? — Pagination hides, page becomes 1, and all 5 filtered results are shown.
- What happens when the user is on page 3 and an archive or filter reduces the list to 2 pages? — The current page becomes invalid, so the view moves to page 2 rather than rendering an empty page.
- What happens when navigating to the first page? — No ellipsis before page 1; the window starts at page 1.
- What happens when navigating to the last page? — No ellipsis after the last page; the window ends at the last page.
- What happens when ellipsis elements are clicked? — Nothing; they are non-interactive.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display pagination navigation only when the total number of application records exceeds 10.
- **FR-002**: System MUST paginate the application list into fixed groups of 10 records per page.
- **FR-003**: System MUST calculate the total number of pages correctly based on total records.
- **FR-004**: System MUST display page navigation as a centered row of page buttons, separated from the card list by a horizontal divider.
- **FR-005**: System MUST display a windowed page sequence of up to 3 consecutive page numbers, always including the first and last pages, with non-clickable ellipsis separating non-adjacent page ranges.
- **FR-006**: System MUST visually distinguish the currently active page from all other page buttons.
- **FR-007**: System MUST scroll the view to the top and move keyboard focus to the top of the list region when the user navigates to a new page, and also when pagination adjusts due to a dataset change.
- **FR-008**: System MUST preserve the current page when the displayed dataset changes and that page is still valid; if the current page is no longer valid, the system MUST move to the highest valid page, or page 1 when pagination is no longer needed.
- **FR-009**: Ellipsis elements MUST be non-interactive — they must not respond to clicks or hover.
- **FR-010**: All pagination page buttons MUST include descriptive accessible labels; the active page MUST be identified for assistive technology.
- **FR-011**: System MUST render a persistent footer on every page of the application.
- **FR-012**: Footer MUST include the following sections: brand identity, version information, actual project technology stack credits, feedback links, and a copyright notice.
- **FR-013**: Feedback links in the footer MUST open the project's GitHub issue tracker in a new browser tab when clicked. Both "Report an issue" and "Request a feature" link to the new-issue page. No backend integration is required.
- **FR-013a**: The footer MUST remain visually positioned at the bottom of the viewport on all pages, including pages with minimal content.
- **FR-014**: Footer MUST adapt to screen size: multi-column layout on desktop (≥ 640px), condensed layout on mobile (< 640px).
- **FR-015**: Footer interactive elements MUST have accessible labels.
- **FR-016**: Pagination MUST operate on the existing data set only; it MUST NOT alter, reorder, or corrupt the underlying application records.
- **FR-017**: System MUST preserve required job application fields: company name, job title, status, and created date.
- **FR-018**: System MUST avoid external analytics, tracking, or data sharing.
- **FR-019**: System MUST support desktop and mobile browser use, labeled forms, keyboard navigation, and non-color-only status communication.

### Key Entities

- **Job Application**: A tracked application record with required company name, job title, status, and created date; optional source platform, job posting URL, application date, salary, notes, follow-up action, and follow-up date.
- **Page**: A logical slice of the application list, containing up to 10 records, identified by a page number starting at 1.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users with more than 10 application records can navigate through all records using visible page controls on the list view.
- **SC-002**: Users with 10 or fewer records see the full list without pagination controls present.
- **SC-003**: Navigating to a new page shows the correct slice of records, scrolls to the top of the view, and moves keyboard focus to the top of the list region.
- **SC-004**: Pagination controls are not shown when the application list contains 10 or fewer records at load or after an application is archived.
- **SC-005**: Users on all pages see a consistent footer with brand, version, stack, feedback, and copyright content.
- **SC-006**: Clicking a feedback link in the footer opens the project's issue tracker in a new browser tab.
- **SC-007**: Users on mobile devices can access all footer sections and pagination buttons without layout breakage or horizontal scrolling.
- **SC-008**: Users relying on keyboard navigation or assistive technology can operate pagination controls and identify the currently active page.

---

## Assumptions

- The application list continues to be fetched from the existing backend; this feature does not change how data is retrieved or stored.
- All existing filter and search functionality continues to work as today; pagination reacts to whatever result set those operations produce.
- Feedback links open the GitHub Issues new-issue page in a new tab; no backend integration is required.
- The version number displayed in the footer is a static value maintained in the codebase and should match the project's actual package version at implementation time.
- Footer stack credits should reflect the actual project stack: vanilla JavaScript ES modules, Vite, Vitest, and ESLint. The footer must not claim React or Babel unless those technologies become real project dependencies.
- Visual styling conventions (typography, color palette) are already partially in use in the project; this feature extends their use to the pagination and footer components.
- No new authentication, data persistence, or API requirements are introduced by this feature.
- Application data is private and local-first; no data is shared externally by this feature.
