# Feature Specification: Pagination & Footer UI

**Feature Branch**: `004-pagination-footer`  
**Created**: 2026-04-26  
**Status**: Draft  
**Design Reference**: `design/pagination_footer.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse a large application list with pagination (Priority: P1)

A user has more than 10 job applications and wants to browse them across multiple pages without losing context. The list is divided into fixed pages of 10, and the user can move between pages using numbered page buttons.

**Why this priority**: Core usability — without pagination the card list grows unbounded and becomes difficult to scan. Everything else (footer, accessibility polish) is secondary to making the list navigable.

**Independent Test**: Seed more than 10 applications, load the tracker page, and verify page buttons appear below the list. Click through pages and confirm the visible cards change correctly.

**Acceptance Scenarios**:

1. **Given** 11 or more applications exist, **When** the tracker loads, **Then** a pagination control renders below the card list, separated by a horizontal rule.
2. **Given** pagination is visible and I am on page 1, **When** I click page 2, **Then** the list updates to show the next 10 applications and the view scrolls to the top.
3. **Given** 10 or fewer applications exist, **When** the tracker loads, **Then** no pagination control is rendered.
4. **Given** I am on page 3, **When** the dataset refreshes (e.g. after archive), **Then** pagination resets to page 1.

---

### User Story 2 — Navigate to a specific page via the windowed page selector (Priority: P1)

A user on page 5 of 12 wants to jump directly to page 10. The page selector shows a windowed set of nearby pages plus first, last, and ellipsis markers so they can jump without clicking Next repeatedly.

**Why this priority**: Equally critical to Story 1 — the windowing algorithm is the navigation mechanism, not a nice-to-have.

**Independent Test**: Seed more than 30 applications (3+ pages), navigate to a middle page, and verify the rendered button sequence matches the algorithm in `design/pagination_footer.md`.

**Acceptance Scenarios**:

1. **Given** I am on page 5 of 10, **When** the pagination renders, **Then** the sequence shown is `1 ··· 4 5 6 ··· 10`.
2. **Given** I am on page 1 of 10, **When** the pagination renders, **Then** the sequence is `1 2 3 ··· 10`.
3. **Given** I am on page 10 of 10, **When** the pagination renders, **Then** the sequence is `1 ··· 8 9 10`.
4. **Given** the ellipsis (`···`) is rendered, **When** I click it, **Then** nothing happens (it is non-interactive).

---

### User Story 3 — See a persistent footer on every page (Priority: P2)

A user navigating between Tracker, Calendar, and Profile pages sees a consistent footer at the bottom of each view. The footer displays the app brand, version, tech stack, and feedback links.

**Why this priority**: Footer is a site-wide chrome element independent of the pagination feature. Valuable for brand completeness and feedback collection, but does not block core list navigation.

**Independent Test**: Navigate to each page (Tracker, Calendar, Profile) and confirm the footer is visible with all five sections present.

**Acceptance Scenarios**:

1. **Given** I visit the Tracker page, **When** the page loads, **Then** a footer is visible at the bottom with Brand, Version, Stack, Feedback, and Copyright sections.
2. **Given** I visit the Calendar or Profile page, **When** the page loads, **Then** the same footer is visible.
3. **Given** I am on a desktop viewport (≥ 640px), **When** I view the footer, **Then** the three content sections (Version, Stack, Feedback) are displayed in a 3-column grid.
4. **Given** I am on a mobile viewport (< 640px), **When** I view the footer, **Then** the content reflows to a 2-column layout.

---

### User Story 4 — Use feedback buttons in the footer (Priority: P3)

A user wants to report an issue or request a feature. They click the corresponding button in the footer Feedback section. The button is interactive and responds to the click (placeholder behavior acceptable).

**Why this priority**: Backend integration is out of scope; placeholder interactivity is sufficient at this stage.

**Independent Test**: Click "Report an issue" and "Request a feature" buttons; confirm they are clickable and produce some response without crashing.

**Acceptance Scenarios**:

1. **Given** I click "Report an issue", **When** the click fires, **Then** the button responds without crashing or breaking page state.
2. **Given** I click "Request a feature", **When** the click fires, **Then** the button responds without crashing or breaking page state.

---

### Edge Cases

- What happens when total applications is exactly 10? → No pagination rendered.
- What happens when total applications is exactly 11? → Pagination renders with 2 pages; page 1 shows 10 items, page 2 shows 1 item.
- What happens when `totalPages` is 2 or 3? → Window algorithm still applies; ellipsis is omitted when all pages fit within the 3-page window.
- What happens if the user is on the last page and archives the final card on that page? → Dataset shrinks; pagination resets to page 1.
- What happens on very narrow viewports (< 320px)? → Pagination buttons must not overflow horizontally.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render pagination only when the total number of active applications exceeds 10.
- **FR-002**: System MUST use a fixed page size of 10 applications per page.
- **FR-003**: System MUST calculate `totalPages` as the ceiling of `totalEntries / PAGE_SIZE`.
- **FR-004**: System MUST implement the windowing algorithm from `design/pagination_footer.md`: a window of 3 consecutive pages clamped so `winStart ≥ 1` and `winEnd ≤ totalPages`; prepend page 1 when `winStart > 1`; prepend ellipsis when `winStart > 2`; append ellipsis when `winEnd < totalPages − 1`; append last page when `winEnd < totalPages`.
- **FR-005**: System MUST visually distinguish the active page button from inactive buttons using a filled accent background.
- **FR-006**: System MUST scroll the view to the top when the user navigates to a new page.
- **FR-007**: System MUST render ellipsis markers as non-interactive elements with no click handler and no pointer cursor.
- **FR-008**: System MUST reset pagination to page 1 when the underlying dataset changes (e.g. after archive, filter, or reload).
- **FR-009**: System MUST slice the application dataset for display only; it MUST NOT mutate the source data.
- **FR-010**: System MUST render a persistent footer on every page view.
- **FR-011**: The footer MUST contain five sections — Brand, Version, Stack, Feedback, and Copyright — matching the content defined in `design/pagination_footer.md`.
- **FR-012**: Feedback buttons in the footer MUST be clickable; placeholder behavior is acceptable with no backend integration required.
- **FR-013**: The footer MUST display in a 3-column grid on viewports ≥ 640px and reflow to 2 columns on viewports < 640px.
- **FR-014**: System MUST preserve required job application fields: company name, job title, status, and created date.
- **FR-015**: System MUST avoid external analytics, tracking, or data sharing.
- **FR-016**: System MUST support desktop and mobile browser use, labeled interactive elements, keyboard navigation, and non-color-only status communication.

### Accessibility Requirements

- **AR-001**: Each pagination page button MUST include a descriptive `aria-label` (e.g. `aria-label="Go to page 4"`).
- **AR-002**: The active page button MUST carry `aria-current="page"` and its `aria-label` MUST indicate it is the current page (e.g. `aria-label="Current page, page 5"`).
- **AR-003**: Ellipsis markers MUST have `aria-hidden="true"`.
- **AR-004**: Footer interactive elements MUST have accessible labels.
- **AR-005**: All footer text MUST meet a 4.5:1 contrast ratio against the dark footer background.

### Key Entities

- **Application List (paginated view)**: An ordered slice of the full application dataset for the current page. Contains at most `PAGE_SIZE` items. Derived from the source dataset; never mutates it.
- **Pagination State**: Local UI state tracking `currentPage` (1-indexed integer) and `totalPages`. Resets to 1 on dataset change.
- **Footer**: A site-wide chrome element rendered on every page. Stateless except for feedback button click handlers (placeholders).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users with more than 10 applications can reach any application within 3 page navigations from any starting page.
- **SC-002**: Users with 10 or fewer applications see no pagination chrome — zero extra visual noise added to the list view.
- **SC-003**: Page navigation is immediate — the visible card list updates without a full page reload or perceptible delay.
- **SC-004**: The footer is visible on 100% of page views across Tracker, Calendar, and Profile pages.
- **SC-005**: The pagination windowing algorithm produces the correct button sequence for all boundary conditions (pages 1, 2, 3, middle, `totalPages − 2`, `totalPages − 1`, `totalPages`) as verified by automated tests covering each case.
- **SC-006**: All pagination page buttons and footer feedback buttons are operable via keyboard (Tab to focus, Enter or Space to activate).

---

## Assumptions

- The application list is fetched in full from the backend; pagination is a frontend-only concern — no server-side pagination or API changes required.
- The feedback buttons in the footer are non-functional placeholders; wiring them to a backend or modal form is a future feature.
- The "Stack" section content in the footer should reflect the actual tech stack of this project (vanilla JS, SQLite, Express, Sora, DM Mono), not the React/Babel values shown in the wireframe (which was drafted before the stack was finalized). The implementing engineer should update that section accordingly.
- The footer is rendered as part of the global app shell, not inside any individual page component, so it persists across page navigations automatically.
- No new external dependencies are required; all styling uses the existing CSS custom property system already defined in `src/styles/main.css`.
- Application data is private and local-first; the pagination feature introduces no data sharing or remote calls.
