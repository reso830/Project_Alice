# Feature Specification: Quick Filters and Sort

**Feature Branch**: `006-quick-filter-sort`  
**Created**: 2026-04-27  
**Status**: Draft  
**Design Reference**: `design/quickfilter_sort.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter by Status and Company (Priority: P1)

A job seeker wants to see only applications in a specific stage or at a specific company. They open the application list and use the Status or Company filter to narrow results without navigating away. The list updates immediately; the toolbar shows how many results match.

**Why this priority**: Status and company are the most frequently used filters for triaging a job search. Delivering this alone gives users a meaningful way to focus their review workflow.

**Independent Test**: Can be fully tested by opening the application list, activating a Status filter, selecting one or more values, and confirming the list shows only matching applications — delivering the ability to review applications in a specific stage.

**Acceptance Scenarios**:

1. **Given** a list with applications in multiple statuses, **When** the user selects "Interviewing" from the Status filter, **Then** only applications with status "Interviewing" appear and the toolbar reads `Results (X)` where X is the matching count.
2. **Given** an active Status filter, **When** the user also selects a company from the Company filter, **Then** the list narrows to applications matching both selected status and company (AND logic).
3. **Given** no filters are active, **When** the user opens the Status filter panel, **Then** all statuses present in the non-archived application list appear as options.
4. **Given** an active Salary range filter that reduces the result set, **When** the user opens the Status filter, **Then** only status values present in the remaining results are shown; statuses not present in the remaining results are absent from the option list.
5. **Given** an active Status filter with "Interviewing" selected, **When** a Salary filter is applied that excludes all "Interviewing" applications, **Then** "Interviewing" is automatically removed from the active Status filter state.

---

### User Story 2 - Filter by Salary and Compatibility Range (Priority: P2)

A job seeker wants to focus on roles that fall within their salary expectations or match a minimum compatibility score. They use the Salary or Compatibility range slider to set a min and max bound, and the list updates to show only applications within those bounds.

**Why this priority**: Range filters enable users to surface the most relevant opportunities by numeric criteria, complementing the categorical Status and Company filters.

**Independent Test**: Can be fully tested by opening the Salary filter, dragging the slider to set a range, releasing it, and confirming only applications within that salary range appear — delivering targeted browsing by compensation.

**Acceptance Scenarios**:

1. **Given** applications with varying salary ranges, **When** the user sets a Salary filter of $80K–$120K and releases the slider, **Then** only applications whose salary range overlaps that filter range appear (an application with salary "$90K–$130K" is included because it overlaps $80K–$120K, even though its upper bound exceeds the filter max).
2. **Given** the user is dragging the Salary slider, **When** the drag is in progress, **Then** the slider visual updates in real time but the application list does not change until the user releases.
3. **Given** a Salary slider, **When** the user releases at a value, **Then** the committed value snaps to the nearest configured salary step.
4. **Given** a Compatibility slider, **When** the user releases at a value, **Then** the committed value snaps to the nearest integer percentage.
5. **Given** the user is adjusting the minimum Salary bound, **When** the minimum would exceed the maximum, **Then** the slider enforces a minimum spacing so the bounds cannot cross.
6. **Given** no Salary filter is active (range is at full extent), **Then** the filter applies no constraint and all applications appear regardless of salary.

---

### User Story 3 - Sort the Application List (Priority: P3)

A job seeker wants to order their application list by a specific field — such as most recent Job ID, highest compatibility, or alphabetical company — so they can prioritize their review. They use the sort control to select a field and direction.

**Why this priority**: Sorting alone provides meaningful list organization even without filtering, making it a self-contained valuable feature.

**Independent Test**: Can be fully tested by selecting a sort field (e.g., Compatibility descending) and confirming the list reorders accordingly — delivering an ordered review queue.

**Acceptance Scenarios**:

1. **Given** no sort has been changed, **Then** the list is sorted by Job ID ascending (default) and the sort icon does not appear active.
2. **Given** the user selects "Compatibility" as the sort field with descending order, **Then** applications are ordered from highest to lowest compatibility score, and the sort icon appears active.
3. **Given** an active filter, **When** the user changes the sort field, **Then** only the order of the already-filtered results changes and the current page resets to 1.
4. **Given** the user applies a sort by Company, **Then** applications are ordered alphabetically by company name.
5. **Given** the user applies a sort by Salary, **Then** applications are ordered using the lower bound of each application's salary range.
6. **Given** two applications share the same sort field value, **Then** their relative order is stable and deterministic across re-renders.

---

### User Story 4 - Clear All Filters (Priority: P4)

A job seeker has applied multiple filters to narrow results and now wants to return to the full list. They use the clear-all control to remove all active filters at once without having to close each filter individually.

**Why this priority**: Without a quick clear path, multi-filter states become tedious to undo and reduce the usability of the filtering system.

**Independent Test**: Can be fully tested by applying two or more filters, clicking the clear-all control, and confirming the full unfiltered list is restored with the toolbar showing `All Applications (N)`.

**Acceptance Scenarios**:

1. **Given** one or more active filters, **When** the user activates clear-all, **Then** all filter state is cleared, the list shows all non-archived applications, and the toolbar reads `All Applications (N)`.
2. **Given** no filters are active, **Then** the clear-all control is not visible.
3. **Given** the user clears all filters while on page 3, **Then** the current page resets to page 1.
4. **Given** the user clears all filters, **Then** the current sort order is preserved.

---

### User Story 5 - Empty Filter State (Priority: P5)

A job seeker applies filters that match no applications. The list view communicates clearly that there are no results for the current filter combination, rather than displaying a blank or broken-looking list.

**Why this priority**: Empty states are essential for usability — without a clear signal, users cannot tell whether the filter worked correctly or something went wrong.

**Independent Test**: Can be fully tested by applying a filter combination that produces zero matches and confirming the empty state message from the design reference appears in place of the application list.

**Acceptance Scenarios**:

1. **Given** active filters that match zero applications, **Then** the empty state defined in `design/quickfilter_sort.md` is displayed instead of the application list.
2. **Given** the empty state is visible, **Then** the toolbar still shows `Results (0)` and the clear-all control is visible.
3. **Given** the empty state is visible, **When** the user clears all filters, **Then** the application list reappears and the empty state is dismissed.

---

### Edge Cases

- What happens when a selected Status or Company value becomes unavailable because another filter was applied? → That value is silently removed from the active filter state.
- What happens when all non-archived applications have no salary data? → The Salary filter button is visible but disabled with an accessible label indicating no salary data is available.
- What happens when the filtered result count is exactly 0? → The empty state from the design reference is shown.
- What happens when a user rapidly changes filters? → Each change produces a consistent result; intermediate states do not persist.
- What happens when there is only one application in the list? → Filters and sort function normally; the single application appears if it matches.
- What happens when all applications are archived (total count is 0)? → The toolbar shows `All Applications (0)`; all filter and sort buttons are visible but disabled.
- What happens when a compatibility score is missing or invalid? → The data model normalizes it to 0; it is treated as 0 for all filter and sort operations.
- What happens when the page number is beyond the new filtered result count? → The page resets to 1 when a filter change reduces results below the current page.

## Requirements *(mandatory)*

### Functional Requirements

**Toolbar**

- **FR-001**: The toolbar MUST display `All Applications (N)` when no filters are active, where N is the total count of non-archived applications.
- **FR-002**: The toolbar MUST display `Results (X)` when one or more filters are active, where X is the count of applications matching all active filters.
- **FR-003**: The toolbar MUST show a clear-all control only when at least one filter is active.
- **FR-003a**: When the total non-archived application count is 0, all filter and sort buttons MUST be visible but disabled (with `aria-disabled="true"`). The clear-all control remains hidden.
- **FR-004**: Activating the clear-all control MUST remove all active filters and reset the current page to 1, while preserving the current sort.

**Filter Controls**

- **FR-005**: Users MUST be able to filter by Status using a multi-select control; selecting multiple values shows applications matching any of the selected statuses.
- **FR-006**: Users MUST be able to filter by Company using a multi-select control; selecting multiple values shows applications from any of the selected companies.
- **FR-007**: Users MUST be able to filter by Salary using a min/max range control. An application matches the Salary filter if its salary range overlaps the filter range (i.e., the application's lower bound ≤ filter max AND the application's upper bound ≥ filter min). Applications with no parseable salary value are excluded when the filter is active.
- **FR-007a**: When no applications in the dataset have parseable salary data, the Salary filter button MUST be visible but disabled. Its `aria-label` MUST communicate that no salary data is available (e.g., "Filter by Salary (no salary data)").
- **FR-008**: Users MUST be able to filter by Compatibility using a min/max range control.
- **FR-009**: All active filters MUST stack using AND logic: a result must satisfy every active filter to appear.
- **FR-010**: An empty filter (no value selected, range at full extent) MUST apply no constraint to results.

**Dynamic Option Narrowing**

- **FR-011**: Status filter options MUST only list values present in the result set after all other active filters (but not the Status filter itself) are applied.
- **FR-012**: Company filter options MUST only list values present in the result set after all other active filters (but not the Company filter itself) are applied.
- **FR-013**: Unavailable Status and Company values MUST be removed from the option list entirely; they MUST NOT appear as disabled.
- **FR-014**: If an active Status selection becomes unavailable after another filter changes, that value MUST be automatically removed from the active Status filter state.
- **FR-015**: If an active Company selection becomes unavailable after another filter changes, that value MUST be automatically removed from the active Company filter state.

**Slider Behavior**

- **FR-016**: Salary and Compatibility sliders MUST update their visual position in real time during dragging without updating the filter results until the user releases.
- **FR-017**: On release, the Salary slider MUST commit a value snapped to the nearest configured salary step.
- **FR-018**: On release, the Compatibility slider MUST commit a value snapped to the nearest integer percentage.
- **FR-019**: Both sliders MUST enforce minimum spacing between the min and max thumbs so that they cannot cross.

**Sort Controls**

- **FR-020**: Users MUST be able to sort by: Job ID, Status, Compatibility, Salary, and Company.
- **FR-021**: The default sort MUST be Job ID ascending.
- **FR-022**: The sort icon MUST appear active only when a non-default sort is applied.
- **FR-023**: Salary sort MUST use the lower bound of each application's salary range as the sort key.
- **FR-024**: Company sort MUST be alphabetical.
- **FR-025**: Status sort and Job ID sort MUST be deterministic and stable across re-renders.
- **FR-026**: Compatibility sort MUST be numeric.
- **FR-027**: Changing the sort MUST reset the current page to 1.

**Pipeline Order**

- **FR-028**: Filtering MUST be applied before sorting.
- **FR-029**: Sorting MUST be applied before pagination.
- **FR-030**: Any filter change MUST reset the current page to 1.
- **FR-031**: Clearing all filters MUST reset the current page to 1.

**Accessibility**

- **FR-032**: All filter and sort buttons MUST have descriptive aria-labels.
- **FR-033**: Filter buttons that have active selections MUST expose their active state via aria-pressed.
- **FR-034**: Checkbox options in filter panels MUST expose their checked state programmatically.
- **FR-035**: Slider thumbs MUST expose aria-valuemin, aria-valuemax, aria-valuenow, and aria-label attributes.
- **FR-036**: Pressing Escape MUST close any open filter or sort panel.
- **FR-037**: After a filter or sort panel closes, keyboard focus MUST return to the button that opened it.

**Scope**

- **FR-038**: Filter state MUST be local to the current UI session and MUST NOT be persisted to storage, synced to URL query parameters, or sent to any backend.
- **FR-039**: Sort state MUST persist for the current SPA session — it MUST survive navigating away from and back to the Tracker view within the same browser tab (achieved via module-level state that is not reset on unmount). It MUST reset on browser page refresh.
- **FR-040**: The feature MUST NOT introduce backend persistence, URL query syncing, or database changes.

**Constitutional Requirements**

- **FR-041**: The feature MUST support desktop and mobile browser use.
- **FR-042**: All interactive controls MUST be keyboard-navigable and use labeled form elements.
- **FR-043**: Status communication MUST NOT rely on color alone.

### Key Entities

- **Job Application**: A tracked application record with required company name, job title, status, and created date; optional source platform, job posting URL, application date, salary range, compatibility score, notes, follow-up action, and follow-up date.
- **Filter State**: The set of currently active filter values for each filter dimension (Status selections, Company selections, Salary range, Compatibility range). Local to the current UI session.
- **Sort State**: The currently active sort field and direction. Persists for the current SPA session via module-level state; resets on browser refresh.
- **Derived Result Set**: The ordered, paginated subset of non-archived applications produced by applying filter state, then sort state, then pagination to the full application dataset.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can apply a filter and see narrowed results in under one second for any realistic application list size.
- **SC-002**: Users can locate and activate any filter or sort control without consulting external help — all controls are labeled and discoverable inline.
- **SC-003**: Applying multiple filters cumulatively reduces the result set correctly 100% of the time — no results appear that do not satisfy every active filter.
- **SC-004**: Status and Company option lists always reflect only values present in the remaining result set — no unavailable options are shown.
- **SC-005**: Slider interactions remain smooth during dragging; the filter result does not change until the user releases.
- **SC-006**: The empty state is displayed whenever active filters produce zero results — users are never shown a blank or broken list.
- **SC-007**: Clearing all filters restores the full non-archived application count in the toolbar and resets to page 1, with no filter state retained.
- **SC-008**: Keyboard-only users can activate every filter and sort control, adjust slider values, and close panels using standard keyboard interactions.

## Assumptions

- The existing application list already excludes archived applications from the default view; the filter feature targets this same non-archived dataset.
- A "configured salary step" for slider snapping is an existing application-level setting (e.g., $5,000 increments); if no configuration exists, a sensible default step will be established during planning.
- Compatibility scores are numeric values between 0 and 100 representing a percentage.
- Applications without a salary value are treated as outside any active Salary filter range (they do not match a constrained salary range but do match when the filter is empty).
- Compatibility scores missing or invalid in the source data are normalized to 0 by `normalizeApplication()` in the existing data model. This feature treats any `app.compat` value of 0 as 0, whether it represents a genuine score of zero or a normalized missing value.
- The `companyName` field is the canonical field key used for company-related filter and sort operations throughout this feature.
- The design reference file `design/quickfilter_sort.md` defines the visual layout, empty state messaging, and interaction patterns; the spec defers visual decisions to that document.
- Archived applications are excluded from all filter, sort, and count operations.
- Filter state resets on page refresh. Sort state persists within the SPA session (module-level) and also resets on page refresh.
- Job application data is private and local-first; no external services are involved in this feature.
