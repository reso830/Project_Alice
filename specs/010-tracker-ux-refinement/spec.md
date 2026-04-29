# Feature Specification: Application Tracker UX & Data Refinement Pack

**Feature Branch**: `010-tracker-ux-refinement`  
**Created**: 2026-04-30  
**Status**: Draft  
**Input**: User description: "Application Tracker UX & Data Refinement Pack — UI/UX consistency, data standardization, and interaction quality improvements across the Application Tracker."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent Status Colors Across All Surfaces (Priority: P1)

A job seeker opens their tracker and immediately recognizes each application's status by its color — whether on a card, in an overlay header, or in a status selector. Every status has a visually distinct color, and "Wishlist" no longer looks the same as "Technical Assessment."

**Why this priority**: Status is the primary at-a-glance signal for the tracker. Color inconsistencies or conflicts create confusion and undermine trust in the UI. Fixing this first makes every other surface improvement coherent.

**Independent Test**: Open the tracker, view applications across statuses, and verify that each of the 9 statuses has a unique, recognizable color applied uniformly to cards, overlay headers, and status selectors.

**Acceptance Scenarios**:

1. **Given** a list of applications with varied statuses, **When** the user scans the cards, **Then** each status pill displays a distinct color with no two statuses sharing the same hue (specifically, "Wishlist" shows pink, distinct from "Technical Assessment").
2. **Given** an application overlay is open, **When** the user views the overlay header, **Then** the header background reflects the application's current status color with sufficient text/icon contrast.
3. **Given** the status selector is open, **When** the user views the available options, **Then** each option displays its associated status color consistently with how it appears on cards and overlays.

---

### User Story 2 - Quick Actions from the Application Overlay (Priority: P2)

A job seeker opens an application's overlay and can immediately favorite it, change its status, or archive it — all from a single set of inline controls without navigating to additional screens or modals.

**Why this priority**: The overlay is the primary interaction surface for managing individual applications. Reducing friction on the most frequent actions (favorite, status change, archive) directly improves daily workflow.

**Independent Test**: Open an application overlay and perform favorite toggle, status change, and archive — confirm each action completes inline without opening additional modals.

**Acceptance Scenarios**:

1. **Given** an application overlay is open, **When** the user activates the Favorite action, **Then** the application's favorite state toggles immediately and the icon reflects the new state without closing the overlay.
2. **Given** an application overlay is open, **When** the user uses the Change Status quick action, **Then** the status updates via a dropdown selector (dropdown popovers are acceptable; full-screen overlays are not), and the overlay header color updates to reflect the new status.
3. **Given** an application overlay is open, **When** the user activates Archive, **Then** a browser confirmation dialog appears; upon confirmation the application is archived, the application's favorite state is reset to false, and the overlay closes.
4. **Given** the quick actions panel, **When** rendered, **Then** actions appear in order: Favorite → Change Status → Archive.

---

### User Story 3 - Favorites Filter and Composable Filtering (Priority: P3)

A job seeker can mark applications as favorites and filter their list to show only favorites, optionally combined with other active filters (status, company, etc.). Their filter preferences persist across sessions.

**Why this priority**: Favorites give users a personalized shortlist of high-priority applications. Composable filtering and persistence reduce repeated setup work on every visit.

**Independent Test**: Mark two applications as favorites, apply "Favorites only" filter, then add a status filter on top — confirm only applications matching both criteria appear. Refresh the page and confirm filter state is restored.

**Acceptance Scenarios**:

1. **Given** a list of applications, **When** the user enables "Favorites only" filter, **Then** only favorited applications are shown.
2. **Given** the "Favorites only" filter is active, **When** the user also selects a status filter, **Then** only applications that are both favorited AND match the selected status are shown.
3. **Given** the user has set any filter state (including favorites), **When** the page is reloaded, **Then** the filter state is restored to the same configuration.

---

### User Story 4 - Salary Displayed in Philippine Peso (Priority: P4)

A job seeker entering or viewing salary information sees values displayed in Philippine Peso (₱) with no decimal places. The salary filter range has defined minimum (₱50,000) and maximum (₱250,000+) bounds.

**Why this priority**: Salary data currently lacks currency context. Standardizing to ₱ removes ambiguity for the target user base, and the filter range makes comparisons actionable.

**Independent Test**: Enter a salary value, save, and confirm it displays as ₱[amount] with no decimals. Use the salary filter and confirm the slider spans ₱50,000 to ₱250,000+.

**Acceptance Scenarios**:

1. **Given** an application with a salary value, **When** displayed anywhere in the UI, **Then** the value appears as ₱[amount] formatted with comma separators and no decimal places (e.g., ₱150,000).
2. **Given** the salary filter, **When** the slider is rendered, **Then** the minimum bound is ₱50,000 and the maximum bound is ₱250,000+ (indicating no upper cap beyond this point).
3. **Given** an application's stored salary data, **When** the value is retrieved, **Then** the underlying numeric value is preserved without truncation or rounding.

---

### User Story 5 - Mobile-Optimized Layout with Floating Action Button (Priority: P5)

On a mobile device, a job seeker sees a clean, uncluttered tracker view. A Floating Action Button (FAB) in the bottom-right corner replaces the "New Application" button, and the subheader shows a compact single-row layout with context on the left and quick filter icons on the right.

**Why this priority**: Mobile usability suffers from button placement and subheader clutter. The FAB is a standard mobile pattern for primary actions, and a single-row subheader reduces vertical space consumed by navigation.

**Independent Test**: Open the tracker on a mobile-sized viewport, verify the FAB is visible in the bottom-right, tap it to open a new application form, and confirm the subheader occupies a single row with no layout breaks.

**Acceptance Scenarios**:

1. **Given** the tracker is viewed on a mobile browser, **When** the page renders, **Then** a FAB appears in the bottom-right corner, does not overlap core content, and respects device safe areas.
2. **Given** the tracker is viewed on a mobile browser, **When** the subheader is rendered, **Then** it shows a single row with context/title on the left and filter icons right-aligned.
3. **Given** the FAB is tapped, **When** the new application flow opens, **Then** the FAB does not obstruct the form or primary content beneath it.

---

### User Story 6 - Copy Job Link with Feedback (Priority: P6)

A job seeker viewing an application with a job posting URL can click the link field to copy the URL to the clipboard. A brief toast notification confirms the copy. If no URL is set, the field is visually disabled and non-interactive.

**Why this priority**: Copying job links is a frequent action when cross-referencing applications. A one-click copy with feedback is faster than manual selection and reduces errors.

**Independent Test**: View an application with a URL, click the link field, confirm a "Link copied" toast appears and the clipboard contains the correct URL. View an application with no URL, confirm the field is visually muted and non-interactive.

**Acceptance Scenarios**:

1. **Given** an application with a job URL, **When** the user clicks the link field, **Then** the URL is copied to clipboard and a "Link copied" toast notification appears briefly.
2. **Given** an application with no URL, **When** the link field is rendered, **Then** it appears with reduced opacity and does not respond to click interactions.
3. **Given** a copy icon is present alongside the link field, **When** rendered, **Then** the icon is drawn from the existing icon set (not an emoji) and provides hover feedback.

---

### User Story 7 - Subheader and Navigation Visual Consistency (Priority: P7)

A user navigating between the tracker, profile edit, and application edit views sees a consistent subheader bar that matches the navigation bar in background color and elevation/shadow style.

**Why this priority**: Visual inconsistency between navigation and subheaders creates a fragmented look. Aligning them signals a cohesive, polished product.

**Independent Test**: Navigate between the tracker, Edit Profile, and Edit Application views and verify the subheader and navigation bar share the same background color and shadow/elevation treatment.

**Acceptance Scenarios**:

1. **Given** any view with a subheader, **When** rendered alongside the navigation bar, **Then** both bars share the same background color and elevation/shadow style.
2. **Given** the Edit Profile and Edit Application overlays, **When** rendered, **Then** their subheaders match the same styling as the main tracker subheader.

---

### User Story 8 - Slider Labels Without Overlap (Priority: P8)

A user adjusting the compatibility or salary slider sees labels that do not overlap at any position across the slider's full range.

**Why this priority**: Overlapping labels make sliders unusable at certain values. This is a readability regression that should be resolved before broader UI polish.

**Independent Test**: Move each slider across its full range and confirm labels never overlap and remain readable at every position.

**Acceptance Scenarios**:

1. **Given** the compatibility slider, **When** dragged across its full range, **Then** labels or value indicators do not overlap at any position.
2. **Given** the salary slider, **When** dragged across its full range, **Then** labels or value indicators do not overlap at any position.

---

### User Story 9 - Icon Consistency (Priority: P9)

A user interacting with any action icon (including copy link and favorites) sees proper icons from the application's existing icon set, with consistent sizing, hover states, and interaction feedback — no emoji substitutes.

**Why this priority**: Emoji in action contexts look unpolished and behave inconsistently across platforms. Consistent icons reinforce a professional feel.

**Independent Test**: Inspect all interactive icons across the tracker, overlay, and forms. Confirm no emoji are used as icons. Confirm all icons share consistent sizing and respond to hover.

**Acceptance Scenarios**:

1. **Given** the copy link action, **When** rendered, **Then** the icon comes from the existing icon set rather than an emoji character.
2. **Given** all interactive icons in the application, **When** hovered, **Then** each displays a consistent hover state and interaction feedback.
3. **Given** all interactive icons in the application, **When** rendered side by side, **Then** each shares a consistent visual size.

---

### User Story 10 - Realistic and Varied Seed Data (Priority: P10)

A developer or tester loading the seed data sees job descriptions that vary in tone (corporate, startup, fintech), seniority signals, and tooling references — with no repeated or templated-sounding entries.

**Why this priority**: Repetitive seed data produces a false testing environment that masks UI issues with real-world variation in text length and content style.

**Independent Test**: Load the seed data and review all job description entries. Confirm no two entries use the same sentence patterns or domain vocabulary, and that they represent at least three distinct company/industry contexts.

**Acceptance Scenarios**:

1. **Given** the seed data is loaded, **When** job descriptions are reviewed, **Then** each entry uses a distinct tone and avoids templated phrasing.
2. **Given** the seed data is loaded, **When** job descriptions are reviewed, **Then** entries span at least three different industry/company contexts (e.g., corporate, startup, fintech).
3. **Given** the seed data is loaded, **When** job descriptions are reviewed, **Then** seniority signals and tooling references vary meaningfully across entries.

---

### Edge Cases

- What happens when a user archives the currently-displayed application and then dismisses the undo? The overlay closes and the item disappears from the active list view.
- How does "Favorites only" behave when the user has no favorited applications? Show an empty state with a prompt to mark favorites.
- What happens if the clipboard API is unavailable (e.g., insecure HTTP context, browser restriction)? The copy action fails gracefully with an informative message rather than silently failing.
- What does the salary filter display when an application has no salary value stored? The application is not excluded from results unless the user explicitly sets a minimum filter threshold.
- What if a user has an existing salary record above ₱250,000? The ₱250,000+ filter bucket captures all values at or above the threshold without truncating the stored data.
- What happens if a user unfavorites an application while the "Favorites only" filter is active? The application immediately disappears from the filtered list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display all 9 application statuses with visually distinct, non-conflicting colors across cards, overlay headers, and status selectors.
- **FR-002**: System MUST assign the "Wishlist" status a pink color, distinct from the color assigned to "Technical Assessment."
- **FR-003**: System MUST render the application overlay header background using the current application's status color, with sufficient contrast for text and icons.
- **FR-004**: System MUST display all salary values in Philippine Peso (₱) format with comma separators and no decimal places (e.g., ₱150,000).
- **FR-005**: System MUST store salary values as plain numeric data without truncation or rounding, regardless of how they are displayed.
- **FR-006**: System MUST provide a salary filter with a defined range: ₱50,000 minimum to ₱250,000+ maximum bucket.
- **FR-007**: System MUST allow users to mark and unmark any application as a favorite.
- **FR-008**: System MUST provide a "Favorites only" quick filter toggle that is composable with all other active filters.
- **FR-009**: System MUST persist all active filter state — including the favorites toggle — in local browser storage, restoring it on page reload.
- **FR-010**: System MUST present inline quick actions in the application overlay in the order: Favorite, Change Status, Archive — without triggering additional modals.
- **FR-011**: System MUST require explicit confirmation or provide a visible undo affordance before completing an archive action.
- **FR-012**: System MUST copy the job posting URL to clipboard when the user clicks the link field, and display a "Link copied" toast notification.
- **FR-013**: System MUST render the link field with reduced opacity and disable click interaction when no URL is present on the application.
- **FR-014**: System MUST replace the "New Application" button with a Floating Action Button (FAB) positioned at the bottom-right on mobile viewports, respecting device safe areas.
- **FR-015**: System MUST render the subheader as a single row on mobile viewports, with context/title left-aligned and quick filter icons right-aligned.
- **FR-016**: System MUST apply matching background color and elevation/shadow to the subheader bar and navigation bar across the tracker, Edit Profile, and Edit Application views.
- **FR-017**: System MUST render all action icons using the existing icon set — no emoji substitutes — with consistent sizing, hover states, and interaction feedback.
- **FR-018**: System MUST render compatibility and salary slider labels without visual overlap at any position across the full slider range.
- **FR-019**: System MUST include seed data with job descriptions that vary in tone, seniority signals, and domain/tooling references across at least three distinct industry contexts.
- **FR-020**: System MUST preserve required job application fields: company name, job title, status, and created date.
- **FR-021**: System MUST validate required fields, URLs when provided, and dates before saving.
- **FR-022**: System MUST support desktop and mobile browser use, labeled forms, keyboard navigation, and non-color-only status communication.

### Key Entities *(include if feature involves data)*

- **Job Application**: A tracked application record with required company name, job title, status, and created date; optional source platform, job posting URL, application date, salary (stored as numeric, displayed as ₱ formatted), notes, follow-up action, follow-up date, and favorite flag (boolean).
- **Filter State**: A persisted set of active filter values including status selection, search query, salary range, and favorites toggle — stored in local browser storage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 9 application statuses are visually distinct — no two statuses share the same color across cards, overlay headers, or selectors — verifiable by visual inspection.
- **SC-002**: Status color is consistently applied across all surfaces: cards, overlay headers, and status selectors all display the same color for a given status.
- **SC-003**: All salary values in the UI display in ₱ format with no decimal places — zero instances of unformatted or decimal-inclusive display are found during testing.
- **SC-004**: Salary values stored in the data layer are never truncated or altered by display formatting changes.
- **SC-005**: The "Favorites only" filter, combined with a status filter, returns only applications satisfying both conditions — verifiable with a defined test dataset.
- **SC-006**: Filter state (including favorites toggle) survives a page reload without requiring manual reconfiguration.
- **SC-007**: Favorite, Change Status, and Archive quick actions complete from the overlay in no more than 2 interactions each, with no modal opened.
- **SC-008**: Archive action provides a confirmation or visible undo affordance — no silent, irreversible archive operation is possible.
- **SC-009**: Clicking a populated link field copies the URL to clipboard in all test cases where the clipboard API is available.
- **SC-010**: The FAB is visible and tappable on mobile viewports, does not overlap primary content, and respects safe area boundaries.
- **SC-011**: Compatibility and salary sliders render labels without overlap at any position across their full range — zero overlap instances across all tested values.
- **SC-012**: Seed data contains no two job description entries with matching sentence patterns or repeated domain vocabulary.

## Assumptions

- The target user base is primarily based in the Philippines, making Philippine Peso the appropriate and sole currency for salary display and filtering.
- "Archive" moves an application out of the default active view but does not permanently delete it; archived items remain accessible via a dedicated filter or separate section.
- The existing icon set (already in use in the application) contains suitable icons for all required actions including copy link, favorite, and archive.
- The "Favorites" flag is a local UI preference and does not affect any sync, export, or sharing behavior.
- "Mobile viewport" corresponds to screen widths where the current layout is difficult to use (typically ≤768px); the FAB is shown only at those widths and not on desktop.
- The ₱250,000+ salary filter bucket includes all values at or above ₱250,000 without altering stored data.
- Clipboard copy relies on the browser's native Clipboard API; a user-visible fallback message is sufficient when the API is unavailable.
- Subheader styling changes apply to the tracker, Edit Profile, and Edit Application surfaces; future overlays will adopt the pattern as they are built.
- Seed data changes apply to development/demo environments only and do not affect any production user data.
- Job application data remains local-first; no external services are involved in this feature.
