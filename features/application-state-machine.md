# Feature Brief — Application Workflow State Machine

## Overview

Implement a structured workflow system for application statuses by introducing a strict state machine for application progression.

Currently, application statuses behave like standalone labels where any status can transition to any other status. This feature introduces controlled transitions between statuses to better reflect real-world hiring pipelines, improve data consistency, and create a more guided user experience.

The goal is to make application progression intentional while keeping the workflow simple and lightweight.

---

# Objectives

- Enforce valid application status progression
- Prevent invalid or illogical status transitions
- Simplify status management UX
- Improve application data consistency
- Prepare the system for future workflow-based features and analytics

---

# Application Statuses

## Active Pipeline States

- Wishlisted
- Applied
- Phone Screen
- Interview
- Assessment
- Offer

## Terminal States

- Accepted
- Rejected
- Withdrawn
- Ghosted

Terminal states represent completed application outcomes and cannot transition further.

---

# Workflow Rules

## Valid Status Transitions

### Wishlisted
- Applied

---

### Applied
- Phone Screen
- Interview
- Assessment
- Offer
- Rejected
- Withdrawn
- Ghosted

---

### Phone Screen
- Interview
- Assessment
- Offer
- Rejected
- Withdrawn
- Ghosted

---

### Interview
- Assessment
- Offer
- Rejected
- Withdrawn
- Ghosted

---

### Assessment
- Interview
- Offer
- Rejected
- Withdrawn
- Ghosted

---

### Offer
- Accepted
- Rejected
- Withdrawn
- Ghosted

---

### Accepted
- No further transitions allowed

---

### Rejected
- No further transitions allowed

---

### Withdrawn
- No further transitions allowed

---

### Ghosted
- No further transitions allowed

---

# UX Expectations

## Status Change Behavior

When changing an application's status, users should only see statuses that are valid next transitions from the current state.

The full status list should no longer be shown universally.

Example:
- If current status is `Applied`, only valid next statuses should be selectable.

This applies to:
- Quick actions
- Dropdowns
- Menus
- Overlay actions
- Any future status-change UI

---

## Terminal State Behavior

Applications in terminal states:
- Accepted
- Rejected
- Withdrawn
- Ghosted

should no longer allow status changes.

The status change action should remain visible but disabled to clearly communicate that the application workflow is already completed.

---

# Accepted Status

Add a new `Accepted` status as the successful end-state of an application workflow.

This represents successfully securing or accepting a role offer.

---

# Existing Archive Behavior

Archive functionality remains separate from the workflow system.

Archiving is not a status and should continue functioning independently from application progression.

Examples:
- Accepted + Archived
- Rejected + Archived
- Ghosted + Archived

remain valid combinations.

---

## Accepted Status Color

Add a dedicated teal color for the new `Accepted` status.

### Accepted
- Background Color: `#2EC4B6`
- RGB: `rgb(46, 196, 182)`
- Recommended Text Color: `#212529`

The color should visually communicate a successful/completed outcome while remaining distinct from existing status colors.

The chosen text color should maintain accessible readability and contrast compliance.

---

# Validation Expectations

Invalid transitions should not be possible through normal application usage.

The workflow rules should be consistently respected throughout the application experience.

---

# Migration Expectations

Existing applications using the current statuses should remain valid after introducing the workflow system.

No existing applications should become unusable or invalid after rollout.

---

# Out of Scope

The following are intentionally excluded from this feature and may be implemented separately in future iterations:

- Status transition history
- Workflow analytics or funnel reporting
- Automatic ghosting detection
- Rollback/backward transitions
- SLA timers or stale application tracking
- Reminder systems
- AI-driven workflow suggestions
- Visual workflow timelines
- Workflow customization by user

---

# Expected Outcome

The application tracker should feel more structured, guided, and workflow-aware while remaining lightweight and easy to use.

Users should naturally progress applications through realistic hiring stages without being overwhelmed by unnecessary complexity.