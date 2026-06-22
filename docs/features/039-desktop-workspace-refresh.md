# 039-desktop-workspace-refresh

## Feature Summary

Introduce a desktop-first workspace experience for Alice by redesigning the Tracker and Application Details workflow into a master-detail layout.

The feature replaces the existing desktop interaction model of opening application details in a centered modal with a docked detail pane that remains visible alongside the application list.

The redesign modernizes Alice's primary workflow, improves information density, reduces context switching, and creates a more efficient application management experience for users actively managing multiple job opportunities.

The Application Details component will support both modal and pane rendering modes while maintaining a single editing experience across desktop, tablet, and mobile devices.

This feature focuses on user experience improvements and workflow efficiency without introducing significant changes to application tracking behavior, compatibility scoring logic, timeline functionality, or underlying data structures.

---

## Problem Statement

The current desktop experience requires users to repeatedly open and close application details while managing their application pipeline.

As application volume increases, this workflow introduces unnecessary context switching and limits the effective use of available screen real estate.

Users should be able to:

* Browse applications
* Compare opportunities
* Review compatibility details
* Update application information
* Navigate between records

without repeatedly entering and exiting a modal workflow.

A desktop master-detail experience better aligns with productivity-focused applications and allows Alice to leverage larger screen sizes more effectively.

---

## Goals

### Primary Goals

* Introduce a desktop master-detail workspace
* Reduce context switching
* Improve information visibility on larger screens
* Modernize the Tracker experience
* Improve application management efficiency

### Secondary Goals

* Improve perceived responsiveness
* Improve discoverability of application information
* Improve visual hierarchy
* Align Tracker and Application Details workflows
* Establish a stronger desktop experience

---

## Non-Goals

The following are explicitly out of scope:

* Compatibility engine changes
* Compatibility scoring algorithm changes
* Compatibility analysis redesign
* ATS resume quality analysis
* Dashboard functionality
* Calendar functionality
* New AI capabilities
* Backend architecture changes
* Database schema changes

---

## User Stories

### Tracker Workspace

As a user,

I want to browse applications while simultaneously viewing details

So that I can manage my application pipeline more efficiently.

---

As a user,

I want application details to remain visible while navigating applications

So that I do not repeatedly open and close modals.

---

As a user,

I want to quickly move between applications

So that I can compare opportunities with minimal friction.

---

### Application Details

As a user,

I want application information grouped into logical sections

So that details are easier to locate and understand.

---

As a user,

I want compatibility information available within the application workspace

So that I can understand my fit for a role.

---

As a user,

I want editing behavior to remain consistent across devices

So that workflows remain familiar regardless of platform.

---

## Functional Requirements

### Desktop Master-Detail Layout

The Tracker shall introduce a desktop master-detail layout for viewport widths greater than or equal to 1100px.

The layout shall consist of:

* Application List (Master)
* Application Details Pane (Detail)

The application list shall remain the primary workspace.

The detail pane shall display the currently selected application.

---

### Application Selection

Clicking an application card shall:

* Select the application
* Highlight the selected card
* Load application details into the detail pane

The application shall not open a centered modal on desktop layouts.

---

### Empty Detail State

When no application is selected, the detail pane shall display an empty-state experience.

The empty state shall communicate the purpose of the detail pane and encourage users to select an application.

---

### Application Details Rendering Modes

The Application Details component shall support two rendering variants:

#### Pane Variant

Used for desktop master-detail layouts.

Characteristics:

* Docked within the Tracker page
* No backdrop
* No page scroll lock
* Internal scrolling only

#### Modal Variant

Used for tablet and mobile experiences.

Characteristics:

* Existing modal workflow
* Existing backdrop behavior
* Existing scroll lock behavior

Both variants shall share the same editing experience and business logic.

---

### Application Details Experience

Application details shall be organized into the following panel order:

1. Overview
2. Skills
3. Compatibility
4. Timeline
5. Notes & Links

This ordering is normative and shall remain consistent across all supported device types.

---

### Compatibility Visibility

Compatibility scores shall remain visible on application cards.

Detailed compatibility information shall remain available within the Application Details experience.

Compatibility analysis shall only be shown within the Compatibility panel.

No changes shall be made to compatibility scoring behavior.

---

### Responsive Behavior

#### Desktop (≥1100px)

* Master-detail layout enabled
* Docked detail pane enabled

#### Tablet (640px–1099px)

* Existing centered modal workflow retained

#### Mobile (<640px)

* Existing bottom-sheet workflow retained

---

### Application Creation

The application creation entry workflow shall remain unchanged.

Users shall continue to create applications through:

* Smart Entry
* Manual Entry
* Job Posting Parsing

Application creation shall continue to utilize the existing Create Mode workflow after the Add-application gate.

On desktop viewports where the master-detail workspace is active, Create Mode shall render in the docked detail pane after the user chooses Manual Entry or completes Smart Entry / Job Posting Parsing. Tablet and mobile shall continue to use the existing centered modal and bottom-sheet surfaces.

---

## UX Requirements

### Workspace Efficiency

Users shall be able to browse, review, and edit applications without losing Tracker context.

---

### Visual Hierarchy

Selected applications shall be visually distinguishable from non-selected applications.

The detail pane shall remain visually separated from the application list.

---

### Consistency

Application Details shall provide a consistent editing experience across:

* Desktop Pane
* Tablet Modal
* Mobile Bottom Sheet

---

### Accessibility

Existing accessibility support shall not regress.

Keyboard navigation shall remain supported.

---

### Performance

Application switching shall feel immediate.

The redesign shall not introduce noticeable rendering delays.

---

## Acceptance Criteria

### Desktop Experience

* Master-detail layout activates at 1100px and above
* Clicking a card selects the application
* Selected card receives active visual treatment
* Details render within the docked pane
* Empty state appears when no application is selected

### Tablet Experience

* Existing modal workflow remains operational

### Mobile Experience

* Existing bottom-sheet workflow remains operational

### Application Details

* Application Details supports both pane and modal rendering modes
* Save behavior remains unchanged
* Discard behavior remains unchanged
* Timeline functionality remains unchanged
* Compatibility functionality remains unchanged

### Regression Protection

* Existing CRUD functionality remains operational
* Existing status management remains operational
* Existing compatibility functionality remains operational
* Existing timeline functionality remains operational
* Existing archive functionality remains operational

---

## Technical Considerations

### Component Reuse

The Application Details component shall remain the single source of truth for application editing.

Pane and modal experiences shall be rendering variants of the same component.

---

### State Management

Application selection state shall remain independent from editing state.

Selecting a different application shall not create unintended draft persistence.

---

### Responsive Architecture

Desktop, tablet, and mobile experiences shall share business logic while presenting different layouts.

---

## Dependencies

* Existing Tracker page
* Existing Application Details component
* Existing Compatibility Engine
* Existing Timeline functionality
* Existing Application Creation workflow

---

## Release Notes

### Added

* Desktop master-detail workspace
* Docked application details pane
* Desktop application selection workflow
* Desktop empty-pane experience

### Updated

* Tracker desktop experience
* Application Details rendering architecture
* Desktop application management workflow

### Unchanged

* Compatibility scoring
* Compatibility analysis behavior
* Application lifecycle management
* Timeline functionality
* Smart application creation
* Tablet modal workflow
* Mobile bottom-sheet workflow
