# Feature Specification: Application Workflow State Machine

**Feature Branch**: `015-application-state-machine`
**Created**: 2026-05-13
**Status**: Draft
**Input**: `features/application-state-machine.md`

---

## Problem Statement

Application statuses currently behave as free-form labels: any status can be set from
any other status at any time. This allows illogical progressions (e.g. Wishlisted →
Accepted, Rejected → Interview) that corrupt the integrity of application data and make
workflow-based analysis unreliable.

This feature introduces a strict state machine that restricts status changes to
meaningful hiring-pipeline transitions, adds a new `accepted` terminal state, and
ensures the UI surfaces only valid next options for each application's current status.

---

## Scope

- Add `accepted` as a new terminal status with color `#2EC4B6` / text `#212529`
- Define and enforce a transition map (see below) across all status-change surfaces
- Restrict status pickers and quick-action controls to show only valid next states
- Disable status-change controls on applications already in a terminal state
- Existing application records remain valid; no data migration required

## Non-Goals

- Status transition history or audit log
- Backward / rollback transitions
- Workflow analytics or funnel reporting
- Automatic ghosting detection or SLA timers
- Reminder or notification systems
- AI-driven workflow suggestions
- Visual workflow timeline UI
- Per-user workflow customization

---

## Status Definitions

### Active Pipeline States
`wishlisted` → `applied` → `phone_screen` / `interview` / `assessment` → `offer`

### Terminal States
`accepted`, `rejected`, `withdrawn`, `ghosted`

Terminal states represent closed outcomes. No further status change is permitted once
an application reaches any of these states.

---

## Valid Transition Map

| Current Status | Valid Next Statuses |
|---|---|
| `wishlisted` | `applied` |
| `applied` | `phone_screen`, `interview`, `assessment`, `offer`, `rejected`, `withdrawn`, `ghosted` |
| `phone_screen` | `interview`, `assessment`, `offer`, `rejected`, `withdrawn`, `ghosted` |
| `interview` | `assessment`, `offer`, `rejected`, `withdrawn`, `ghosted` |
| `assessment` | `interview`, `offer`, `rejected`, `withdrawn`, `ghosted` |
| `offer` | `accepted`, `rejected`, `withdrawn`, `ghosted` |
| `accepted` | *(none — terminal)* |
| `rejected` | *(none — terminal)* |
| `withdrawn` | *(none — terminal)* |
| `ghosted` | *(none — terminal)* |

---

## User Stories

### User Story 1 — Advancing an application through valid transitions (P1)

A user has an application currently at `Applied`. They receive a call and want to move
it to `Phone Screen`. The status picker shows only the statuses valid from `Applied`;
they select `Phone Screen` and save.

**Why this priority**: Core correctness requirement. Every other story depends on the
transition map being enforced.

**Independent Test**: Open an application at `Applied` status. Open the status change
control. Verify only the valid next states for `Applied` appear. Select `Phone Screen`
and confirm. Verify the status updates correctly. Repeat for at least two other source
states.

**Acceptance Scenarios**:

1. **Given** an application is at `Applied`, **When** the user opens the status change
   control, **Then** only `phone_screen`, `interview`, `assessment`, `offer`,
   `rejected`, `withdrawn`, and `ghosted` are selectable; `wishlisted` and `accepted`
   are absent.
2. **Given** a valid next status is selected, **When** the user confirms, **Then** the
   application status updates to the selected value and `last_status_update` is
   refreshed.
3. **Given** an application at `Wishlisted`, **When** the user opens the status change
   control, **Then** only `applied` is available.
4. **Given** an application at `Offer`, **When** the user opens the status change
   control, **Then** `accepted`, `rejected`, `withdrawn`, and `ghosted` are available;
   no active pipeline states appear.

---

### User Story 2 — Terminal state locks status changes (P1)

A user opens an application that was previously `Rejected`. The status control is
visible but disabled, clearly communicating that the workflow is complete.

**Why this priority**: Data integrity. Without this, terminal applications can be
incorrectly re-activated.

**Independent Test**: Open a `Rejected` application. Verify the status change control
is rendered but disabled (not hidden). Attempt to interact with it and confirm no
change is possible. Verify the same for `Accepted`, `Withdrawn`, and `Ghosted`.

**Acceptance Scenarios**:

1. **Given** an application is in any terminal state (`accepted`, `rejected`,
   `withdrawn`, `ghosted`), **When** the user views it, **Then** the status change
   control is visible but non-interactive (disabled).
2. **Given** the disabled control is visible, **Then** it communicates to the user
   that the workflow is complete (not merely absent).
3. **Given** a terminal-state application, **When** any attempt is made to change the
   status via UI, **Then** the status does not change and no error is thrown.

---

### User Story 3 — Accepting an offer (P1)

A user's application reaches `Offer`. They accept the role. They select `Accepted`
from the status picker and the application moves to the new terminal state.

**Why this priority**: `Accepted` is a new status that does not currently exist. Its
introduction must be end-to-end verified.

**Independent Test**: Set an application to `Offer`. Open the status control. Verify
`Accepted` appears as an option. Select it and confirm. Verify the application now
shows the `Accepted` status with its teal badge and that the status control is
subsequently disabled.

**Acceptance Scenarios**:

1. **Given** an application at `Offer`, **When** the status control is opened, **Then**
   `accepted` is present as a selectable option.
2. **Given** `Accepted` is selected and confirmed, **Then** the application status
   becomes `accepted` and `last_status_update` is refreshed.
3. **Given** the application is now `Accepted`, **Then** the status badge displays with
   background `#2EC4B6` and text `#212529`.
4. **Given** the application is now `Accepted`, **Then** the status control is disabled
   (terminal state rule applies).

---

### User Story 4 — Existing application data is unaffected (P1)

A user who already has applications in all current statuses sees no disruption after
the feature ships. Their existing records display correctly, can still be viewed and
edited (non-status fields), and their statuses are unchanged.

**Why this priority**: Rollout safety. Any data breakage here affects all existing users.

**Independent Test**: Before deploying, record a set of applications across all current
statuses. After deploying, verify all records display their original status correctly.
Verify the status control for each reflects the correct valid transitions for its
current state.

**Acceptance Scenarios**:

1. **Given** an existing application at any current status, **When** the feature is
   deployed, **Then** the application retains its existing status without modification.
2. **Given** an existing application at a non-terminal status, **When** the user opens
   the status control, **Then** the control shows the valid next states for that
   status as defined by the transition map.
3. **Given** an existing application at `ghosted`, `rejected`, or `withdrawn`,
   **When** the user views it, **Then** the status control is disabled (terminal state).

---

## Success Criteria

- **SC-001** The transition map is enforced in model/validation logic and not only in
  the UI layer.
- **SC-002** `accepted` is added to `STATUS_VALUES` and `STATUS_CONFIG` with color
  `#2EC4B6` (badge background) and `#212529` (badge text).
- **SC-003** All status-change surfaces (quick actions, dropdowns, overlay controls)
  show only valid next transitions for the application's current status.
- **SC-004** Status change controls on terminal-state applications are rendered but
  disabled on all status-change surfaces.
- **SC-005** Selecting and saving a valid transition updates `status` and
  `last_status_update`.
- **SC-006** No existing application record becomes invalid or unrenderable after
  rollout.
- **SC-007** All existing automated test suites pass after required updates are applied.
- **SC-008** `isValidTransition(currentStatus, nextStatus)` (or equivalent) is exported
  from the model layer and used consistently — transition rules are not duplicated
  across UI components.

---

## Edge Cases

- **Wishlisted is the most restricted active state**: only one valid next state
  (`applied`). The status control should make this clearly apparent, not present a long
  list with one option.
- **Assessment ↔ Interview**: Assessment can transition back to Interview (and vice
  versa). This is intentional — hiring pipelines sometimes loop between these stages.
- **Archive + terminal state**: An application can be both archived and in a terminal
  state. Archiving is independent and must not be affected by this feature.
- **Direct creation at any status**: The transition map applies only to status *changes*
  on existing applications. At creation, any status is selectable — users may
  retroactively add applications already mid-process (e.g. logging an `Interview`-stage
  application they forgot to track). The state machine applies from the first status
  change onward.
- **`accepted` absent from existing records**: No existing record uses `accepted`
  (it does not exist yet). The new status requires no data backfill.
- **Invalid status in DB**: If a record somehow holds a status value not in
  `STATUS_VALUES` (e.g. from a direct DB edit), the UI must not crash; it should treat
  the status control as disabled or fall back gracefully.

---

## Data Considerations

- `STATUS_VALUES` in `src/models/application.js` gains `'accepted'`.
- `STATUS_CONFIG` gains an `accepted` entry: `badgeBg: '#2EC4B6'`, `badgeText: '#212529'`,
  `borderAccent: '#2EC4B6'`, `label: 'Accepted'`.
- A `TRANSITIONS` map (status → `string[]`) is added to the model layer and exported.
- An `isValidTransition(current, next)` helper is derived from `TRANSITIONS` and exported.
- `getValidTransitions(current)` returns the list of allowed next statuses for a given
  current status; returns `[]` for terminal states.
- No database schema change is required: the SQLite column storing `status` is an
  unconstrained text field; adding `accepted` to `STATUS_VALUES` is sufficient.
- `last_status_update` is already updated on every status change; no new fields are
  required.

---

## Decisions

**CQ-001 — Initial status at creation (resolved)**: The transition map applies only
to status *changes* on existing applications. Initial status at creation is free-form:
any status may be selected. This allows users to retroactively log applications that
are already mid-process (e.g. adding an application they forgot to track that is
already at `Interview`). The state machine kicks in from that point forward.
