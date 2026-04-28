# Feature Specification: Profile Page

**Feature Branch**: `007-profile-page`  
**Created**: 2026-04-28  
**Status**: Draft  
**Design Reference**: `design/profile_page.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 — First-time user discovers Profile page (Priority: P1)

A user who has not yet set up a profile navigates to the Profile page for the first time. They see a welcome heading without their name, an applications summary using their Tracker data, and a clear call-to-action inviting them to create a profile.

**Why this priority**: This is the default landing experience for all new users. Getting the empty state right ensures users understand what the page offers and how to proceed.

**Independent Test**: Navigate to the Profile page with no profile saved. The welcome heading, applications summary, and empty profile card with a "Set Up Profile" button must all render correctly.

**Acceptance Scenarios**:

1. **Given** no profile exists, **When** the user navigates to the Profile page, **Then** the heading reads "Welcome back.", the applications summary renders, and the profile card shows the empty state with a "Set Up Profile" button.
2. **Given** no profile exists and the user clicks "Set Up Profile", **When** the navigation occurs, **Then** the user is taken to the Edit / Setup Profile page.

---

### User Story 2 — Returning user views their profile and pipeline at a glance (Priority: P1)

A user who has already set up a profile visits the Profile page. They see a personalised welcome heading, an applications summary reflecting their Tracker data, and their full professional profile displayed in clearly organised sections.

**Why this priority**: This is the primary intended experience for active users and the main value proposition of the page.

**Independent Test**: With a profile saved, navigate to the Profile page. The personalised heading, applications summary, and all filled profile sub-sections must render.

**Acceptance Scenarios**:

1. **Given** a profile exists with a first name of "Alex", **When** the user visits the Profile page, **Then** the heading reads "Welcome back, Alex." and the sub-line "Here's where things stand today." appears below it.
2. **Given** a profile exists, **When** the profile section renders, **Then** the basic info block (name, city, phone, email) and all populated sub-sections are visible.
3. **Given** a profile exists, **When** the profile section header renders, **Then** an "Edit Profile" button appears right-aligned.

---

### User Story 3 — User views application pipeline summary (Priority: P1)

Any user (with or without a profile) wants to see a quick summary of where their job applications stand. The applications section shows total, active, pending, and offer counts alongside a visual breakdown, all sourced live from Tracker data.

**Why this priority**: Application summary renders in both page states and is the core at-a-glance utility.

**Independent Test**: With applications in the Tracker across multiple statuses, open the Profile page. Verify stat counts match Tracker data and the desktop chart or mobile bar renders correctly.

**Acceptance Scenarios**:

1. **Given** applications exist across various statuses, **When** the applications section renders on desktop (viewport ≥ 640px), **Then** stat chips for Total, Active, Pending, and Offer show correct counts, and a donut chart with legend is visible.
2. **Given** applications exist, **When** the user hovers a chart segment on desktop, **Then** that segment highlights, others dim, and a tooltip appears showing "{Label} · {count} ({pct}%)".
3. **Given** applications exist, **When** the user views the applications section on mobile (viewport < 640px), **Then** stat chips appear in a row and a horizontal stacked bar is shown instead of a donut chart.
4. **Given** a mobile user taps a bar segment or legend item, **When** the tap registers, **Then** an inline label appears showing label, count, and percentage, then auto-dismisses after 2 seconds.
5. **Given** the applications section is visible, **When** the user clicks "Go to Tracker", **Then** the user is navigated to the Tracker page.

---

### User Story 4 — User navigates to Edit / Setup Profile page (Priority: P2)

A user wants to create or update their professional profile. From the Profile page, they can reach a dedicated edit page via either "Set Up Profile" (empty state) or "Edit Profile" (profile exists). Both routes lead to the same page.

**Why this priority**: Without the ability to reach the edit page, the empty state CTA and the edit button are broken. This must work for the feature to be complete, though the edit page itself is intentionally minimal in this iteration.

**Independent Test**: From both the empty state and the profile-exists state, verify that both buttons navigate to the same Edit / Setup Profile page, and "← Back to Profile" returns to the Profile page.

**Acceptance Scenarios**:

1. **Given** no profile exists and the user clicks "Set Up Profile", **When** the page navigates, **Then** the Edit / Setup Profile page loads with a "← Back to Profile" button and stacked section cards.
2. **Given** a profile exists and the user clicks "Edit Profile", **When** the page navigates, **Then** the same Edit / Setup Profile page loads.
3. **Given** the user is on the Edit / Setup Profile page, **When** the user clicks "← Back to Profile", **Then** the user returns to the Profile page.

---

### User Story 5 — Mobile user collapses and expands profile sub-sections (Priority: P3)

A mobile user viewing a profile with many sub-sections can tap any sub-section header to collapse or expand it, reducing scrolling. On desktop, all sub-sections remain always expanded.

**Why this priority**: This is a UX enhancement improving mobile usability. The core page is functional without it, but it is required by the acceptance criteria.

**Independent Test**: On a narrow viewport (below 640px), tap a sub-section header. It should toggle between expanded and collapsed. On desktop, no collapse affordance should be present.

**Acceptance Scenarios**:

1. **Given** a profile exists and the user is on mobile, **When** the user taps a sub-section header, **Then** the section collapses with a chevron indicating the collapsed state.
2. **Given** a sub-section is collapsed on mobile, **When** the user taps the header again, **Then** the section expands and content becomes visible.
3. **Given** a profile exists and the user is on desktop, **When** the profile section renders, **Then** all sub-sections are always expanded and no collapse toggle is present.

---

### Edge Cases

- What happens when there are zero applications in the Tracker? Counts show 0 and the chart/bar renders an empty or placeholder visual rather than breaking layout.
- What happens when only one application status has entries? The chart and bar render with a single segment; the legend still appears.
- What happens when a profile field (e.g. city, phone) is empty? That field is omitted from the basic info block rather than showing a blank entry.
- What happens when a profile sub-section (e.g. certifications) has no entries? That sub-section is hidden rather than rendering an empty list.
- What happens if a profile link URL is malformed? The chip still renders; clicking it attempts to open the URL in a new tab without crashing the page.
- How does the page handle slow data loading? While `api.getAll()` is in flight, the applications section shows a loading indicator (skeleton or spinner). The profile section renders immediately from localStorage — no loading state is needed for the profile section, as the read is synchronous.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Profile page MUST be reachable from the main navigation, with an active indicator on the Profile nav item when on that page.
- **FR-002**: The Profile page MUST display a no-profile state or a profile-exists state based on whether a profile record is saved.
- **FR-003**: The welcome heading MUST read "Welcome back." when no profile exists, and "Welcome back, {firstName}." when a profile exists.
- **FR-004**: A sub-line "Here's where things stand today." MUST appear below the welcome heading when a profile exists.
- **FR-005**: The applications section MUST always render regardless of profile state, using live data sourced from the Tracker.
- **FR-006**: Application counts MUST be calculated as: Total = sum of all statuses including Wishlist; Active = screening + interview + assessment; Pending = applied; Offer = offer.
- **FR-007**: On desktop viewports (640px and above), the applications section MUST show stat chips alongside a donut chart with legend.
- **FR-008**: On desktop, hovering a chart segment MUST highlight it and dim all others; hovering a legend item MUST cross-highlight the matching segment; a tooltip showing "{Label} · {count} ({pct}%)" MUST appear near the cursor.
- **FR-009**: On mobile viewports (below 640px), the applications section MUST show a full-width horizontal stacked bar in place of the donut chart.
- **FR-010**: On mobile, tapping a bar segment or legend item MUST reveal an inline label (label, count, percentage) that auto-dismisses after 2 seconds.
- **FR-011**: Clicking "Go to Tracker" MUST navigate the user to the Tracker page.
- **FR-012**: When no profile exists, the profile card MUST display an empty state with a person icon, the text "No profile set up yet.", supporting encouragement text, and a "Set Up Profile" primary button.
- **FR-013**: Clicking "Set Up Profile" MUST navigate to the Edit / Setup Profile page.
- **FR-014**: When a profile exists, the profile card MUST display a basic info block (initials avatar, full name, city, phone, email) and all populated sub-sections.
- **FR-015**: When a profile exists, an "Edit Profile" outline button MUST appear right-aligned in the profile section header and navigate to the Edit / Setup Profile page.
- **FR-016**: Profile link chips MUST open their URLs in a new browser tab.
- **FR-017**: On mobile, each profile sub-section header MUST be tappable to toggle collapse/expand, with a chevron indicator reflecting state.
- **FR-018**: On desktop, profile sub-sections MUST always remain expanded with no collapse affordance.
- **FR-019**: The Edit / Setup Profile page MUST be a dedicated route reachable from both "Set Up Profile" and "Edit Profile".
- **FR-020**: The Edit / Setup Profile page topbar MUST replace the normal navigation with a "← Back to Profile" ghost button (left) and "Edit Profile" title text.
- **FR-021**: Clicking "← Back to Profile" MUST return the user to the Profile page.
- **FR-022**: The Edit / Setup Profile page MUST display an inline notice: "This page is a placeholder — details to be designed in a later iteration."
- **FR-023**: The Edit / Setup Profile page MUST render stacked section cards for: Basic Info, Summary, Professional Experience, Education, Skills, Certifications, Awards, Languages, and Links.
- **FR-024**: The Basic Info card MUST include real, interactive fields for First Name, Last Name, City/Location, Email, and Phone.
- **FR-025**: The Summary card MUST use a textarea input.
- **FR-026**: The Skills and Languages cards MUST use comma-separated text inputs.
- **FR-027**: Professional Experience, Education, Certifications, Awards, and Links cards MAY remain as placeholder content in this iteration.
- **FR-028**: Each edit card MUST include a Cancel button and a Save button.
- **FR-029**: The Profile feature MUST NOT cause regressions in existing Tracker or Calendar pages.
- **FR-030**: Required profile fields (First Name, Last Name) MUST be validated before a save is accepted.
- **FR-031**: System MUST preserve all required job application fields: company name, job title, status, and created date.
- **FR-032**: System MUST provide clear user-facing errors for invalid profile data.
- **FR-033**: System MUST avoid external analytics, tracking, or data sharing.
- **FR-034**: System MUST support desktop and mobile browsers with no horizontal scrolling on mobile viewports.
- **FR-035**: All user-supplied profile text (name, summary, role titles, etc.) MUST be rendered via `textContent`, not `innerHTML`, to prevent injection attacks.

### Key Entities

- **Profile**: A user's optional professional background record containing basic contact info, a written summary, and structured lists for experience, education, skills, certifications, awards, languages, and external links. Its presence or absence drives the two page states.
- **Job Application**: An existing tracked record (company, title, status, created date) used to calculate the applications summary. Sourced from the Tracker data store — not owned by this feature.
- **Application Summary Counts**: Derived aggregations of Job Application statuses, grouped into Total, Active, Pending, and Offer display buckets.
- **Experience Entry**: One position in a work history, comprising a role title, company name, period string, and description.
- **Education Entry**: One academic credential comprising a degree, school name, and year.
- **Link Entry**: An external profile link with a platform name, display label, and URL.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can reach the Profile page from any page in the app in under 2 clicks.
- **SC-002**: The Profile page renders correctly in both the no-profile and profile-exists states across all tested desktop and mobile viewports with no layout breakage.
- **SC-003**: Application stat counts shown on the Profile page match the Tracker data with 100% accuracy for any combination of application statuses.
- **SC-004**: All navigation flows complete successfully: Profile → Tracker, Profile → Edit Profile, Edit Profile → Profile, with no dead ends.
- **SC-005**: Mobile profile sub-sections toggle collapse and expand correctly across all populated sub-sections with no data loss.
- **SC-006**: Desktop chart hover interactions (highlight, dim, tooltip) respond instantaneously on user hover with no visible lag.
- **SC-007**: All existing Tracker and Calendar tests continue to pass after this feature is introduced, confirming no regression.
- **SC-008**: All tested external profile link chips successfully open their URLs in a new browser tab.

---

## Assumptions

- The existing Tracker data layer is available to the Profile page without introducing a new backend API — the same data access pattern used by the Tracker is reused.
- A single user profile is supported per session. If no profile record is found, the no-profile state renders.
- Profile data is stored locally, consistent with the project's local-first, no-external-tracking principle.
- The app routing system can accommodate two new routes (`/profile` and `/profile/edit`) without architectural changes.
- No avatar photo upload is included in this iteration; the avatar displays generated initials only.
- No unsaved-change confirmation dialog is required on the Edit Profile page in this iteration.
- "Active" count maps to internal status slugs `phone_screen`, `interview`, and `assessment`. "Total" includes the `wishlisted` status.
- The Calendar page does not consume Profile data in this iteration.
- A profile sub-section with no data entries is hidden rather than rendered as an empty list.
- Job application data is private and local-first unless a future feature explicitly introduces an external service.
