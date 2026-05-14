# Plan: Application Workflow State Machine (015)

**Spec**: `specs/015-application-state-machine/spec.md`
**Branch**: `015-application-state-machine`

---

## Overview

Introduce a state machine for application status transitions. The scope is behavioral
only: no schema migration, no new routes. The changes are:

1. New model helpers as the single source of truth for transition logic
2. A server-side transition gate added to the PATCH handler
3. UI status dropdowns filtered to valid next states only
4. Status controls disabled (not hidden) on terminal-state applications

---

## Architecture

### Model layer — `src/models/application.js`

All transition logic lives here and is exported for use by all callers. No other layer
duplicates the rules.

Additions:

- `'accepted'` inserted into `STATUS_VALUES` (after `'offer'`, before terminal states)
- `accepted` entry in `STATUS_CONFIG`: `{ label: 'Accepted', badgeBg: '#2EC4B6', badgeText: '#212529', borderAccent: '#2EC4B6' }`
- `TRANSITIONS` — exported `const Record<string, string[]>` mapping each status to its
  valid next statuses; terminal states map to `[]`
- `TERMINAL_STATES` — exported `Set<string>` of terminal status strings for O(1) lookup
- `getValidTransitions(status: string): string[]` — returns the array from `TRANSITIONS`,
  or `[]` for unknown statuses (graceful fallback for corrupted DB records)
- `isValidTransition(current: string, next: string): boolean` — derived from `TRANSITIONS`

### Server PATCH route — `server/routes/applications.js`

After Zod validation passes, when `status` is present in the update payload:

1. Call `getById(id, db)` to fetch the current record
2. If `TERMINAL_STATES.has(currentRecord.status)` → return `400 VALIDATION_ERROR` with
   `fields.status: "Cannot change status of a completed application"`
3. If `!isValidTransition(currentRecord.status, data.status)` → return `400 VALIDATION_ERROR`
   with `fields.status: "Invalid transition from <current> to <next>"`
4. Proceed to `update()`

`POST /` (creation) is unchanged — the transition map applies only to status *changes*
on existing records.

### UI — `src/components/StatusDropdown.js`

Change the `open` function: replace iteration over `STATUS_VALUES` (line 100) with
`getValidTransitions(currentStatus)`. The `createOption` signature is unchanged; the
current-status check mark logic remains but will never fire since the current status is
not in the transitions list.

### UI — `src/components/Card.js`

Before calling `StatusDropdown.open` at line 147: check `isTerminalState(application.status)`.
If terminal, render the status button with `disabled` attribute and skip attaching the
click handler (or make it a no-op).

### UI — `src/components/Modal.js`

At the `openStatusDropdown` helper (line 837), guard with `isTerminalState(currentStatus)`.
The click handlers on the status button and badge (lines 896–906) call `openStatusDropdown`
only when not terminal. When terminal, the button/badge is rendered with `disabled`
attribute and a visual affordance communicating "workflow complete."

---

## Data Flow

```
User clicks status button
  → Card/Modal: isTerminalState(status) → true → button disabled, noop
  → Card/Modal: isTerminalState(status) → false
      → StatusDropdown.open(anchor, currentStatus, onChange)
          → getValidTransitions(currentStatus) → filtered list
          → User picks newStatus
          → onChange(newStatus)
  → PATCH /api/applications/:id  { status: newStatus }
      → Zod: newStatus ∈ STATUS_VALUES (now includes 'accepted') ✓
      → getById(id) → fetch current record
      → TERMINAL_STATES.has(current.status) → 400 if true
      → isValidTransition(current.status, newStatus) → 400 if false
      → update() → last_status_update refreshed automatically
      → 200 { data: updatedRecord }
```

---

## Affected Areas

### Files to modify

| File | Change |
|------|--------|
| `src/models/application.js` | Add `accepted` to constants; export `TRANSITIONS`, `TERMINAL_STATES`, `getValidTransitions`, `isValidTransition` |
| `shared/constants.js` | Re-export `isValidTransition`, `getValidTransitions`, `TERMINAL_STATES` so server-side code follows the established import convention |
| `server/routes/applications.js` | Add transition gate in PATCH handler |
| `src/components/StatusDropdown.js` | Replace `STATUS_VALUES` iteration with `getValidTransitions(currentStatus)` in `open()` |
| `src/components/Card.js` | Disable status button for terminal states |
| `src/components/Modal.js` | Disable status controls for terminal states |

### Files to inspect (no expected modification)

| File | Reason |
|------|--------|
| `server/validation/application.js` | The `status` refine (line 50–55) checks `STATUS_VALUES.includes(value)` — auto-picks up `accepted`. No logic change needed. |
| `server/db/applications.js` | `update()` already handles `last_status_update` on status change. Transition awareness stays in the route layer. |
| `src/components/CreationPicker.js` | Creation is free-form per spec decision CQ-001. Inspect to confirm it iterates `STATUS_VALUES` without filtering and that `accepted` appears as an option. |

### Tests to add or update

| File | Change |
|------|--------|
| `tests/models/application.test.js` | Add: `TRANSITIONS` map shape, `getValidTransitions` for each pipeline state, `isValidTransition` valid/invalid/terminal cases, `accepted` in `STATUS_CONFIG` |
| `tests/server/applications.test.js` | Add: invalid transition → 400, terminal state update → 400, valid transition → 200, POST with `accepted` → 201 |
| `tests/server/validation.test.js` | Update: `accepted` is now a valid `status` value |
| `tests/components/StatusDropdown.test.js` | Update: dropdown renders only valid transitions; behavior for `STATUS_VALUES` baseline changes |
| `tests/components/Card.test.js` | Add: terminal-state application renders status button as `disabled` |

### Out of scope

- `server/db/applications.js` — no modification; business logic stays in route layer
- `src/components/FilterPanel.js` / `QuickFiltersToolbar.js` — filter surfaces show all statuses; they are not status-change surfaces
- `src/components/CreationPicker.js` — creation is exempt per CQ-001
- Database schema — no migration; SQLite `status` column is unconstrained text
- CSS files — `accepted` badge color applied via `STATUS_CONFIG` inline styles; no dedicated CSS class required unless the existing badge component uses class-based color

---

## Risks and Tradeoffs

### Double fetch in PATCH handler

The transition gate fetches the current record before `update()`. This is one extra
SQLite read per status-change PATCH. Negligible for a local-first app. The alternative
(moving logic into `update()`) would mix business rules into the data layer.

### Stale client state

If the client has a stale copy of an application (e.g. status changed in another tab),
the UI may allow the user to attempt an invalid transition. The server gate will reject
it with `400`. The UI must handle this error and surface it; this is existing error
handling behavior — the UI already handles `VALIDATION_ERROR` responses.

### Unknown status in DB → graceful fallback

A record with a status not in `STATUS_VALUES` (e.g. from a direct DB edit) returns `[]`
from `getValidTransitions`, which locks the status control. This is a safe default: the
record remains visible and editable (all non-status fields), but the status control is
disabled until corrected outside the app.

### Active check mark becomes dead code

After the change, `currentStatus` is never in the filtered options list (a status
cannot transition to itself), so the `✓` indicator in `createOption` never renders.
Leave it; removing it is cleanup, not a correctness issue.

---

## Validation Approach

**Model**: Unit tests cover every row of `TRANSITIONS`, every valid/invalid pair for
`isValidTransition`, and all terminal states for `getValidTransitions`.

**Server**: Integration tests cover: valid transition → 200, invalid transition → 400
with correct `fields.status` message, terminal-state update → 400, creation at any
status → 201.

**UI**: Component tests verify the dropdown option list for at least three source states.
Card/Modal tests verify the `disabled` attribute on terminal-state applications.

**Manual**: Follow `quickstart.md` test script; cycle through at least one full pipeline
path from `wishlisted` → `applied` → `offer` → `accepted`, and verify each terminal
state locks the control.
