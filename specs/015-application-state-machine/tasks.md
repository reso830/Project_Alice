# Tasks: Application Workflow State Machine (015)

**Spec**: `specs/015-application-state-machine/spec.md`
**Plan**: `specs/015-application-state-machine/plan.md`
**Branch**: `015-application-state-machine`

---

## Phase 01 — Model: Status Constants and Transition Map

All transition logic lives in `src/models/application.js`. This phase produces the
exports that every other phase depends on. Complete it before starting Phase 02 or 03.

---

### [X] Task 01.1 — Add `accepted` to `STATUS_VALUES` and `STATUS_CONFIG`

**Target file**: `src/models/application.js`

**What to do**:

1. Insert `'accepted'` into `STATUS_VALUES` after `'offer'` and before `'rejected'`.
   Result order: `..., 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted'`.

2. Add an `accepted` entry to `STATUS_CONFIG`:
   ```js
   accepted: {
     label: 'Accepted',
     badgeBg: '#2EC4B6',
     badgeText: '#212529',
     borderAccent: '#2EC4B6',
   },
   ```

**Expected behavior**:
- `STATUS_VALUES.includes('accepted')` → `true`
- `STATUS_CONFIG.accepted.badgeBg` → `'#2EC4B6'`
- `STATUS_CONFIG.accepted.badgeText` → `'#212529'`
- `STATUS_CONFIG.accepted.borderAccent` → `'#2EC4B6'`
- `STATUS_CONFIG.accepted.label` → `'Accepted'`

**Constraints**:
- Do not change any existing `STATUS_VALUES` entry or its position relative to other
  existing entries.
- Do not change any existing `STATUS_CONFIG` entry.

**Validation**: Test updates for this task are owned by Task 01.3. Run
`npm test -- tests/models/application.test.js` after Task 01.3 is complete.

**Out of scope**: `shared/constants.js` — it re-exports `STATUS_VALUES` dynamically and
will pick up `accepted` automatically without modification.

---

### [X] Task 01.2 — Export transition map and helpers

**Target files**: `src/models/application.js`, `shared/constants.js`

**What to add** (export all four):

```js
export const TRANSITIONS = {
  wishlisted:   ['applied'],
  applied:      ['phone_screen', 'interview', 'assessment', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  phone_screen: ['interview', 'assessment', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  interview:    ['assessment', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  assessment:   ['interview', 'offer', 'rejected', 'withdrawn', 'ghosted'],
  offer:        ['accepted', 'rejected', 'withdrawn', 'ghosted'],
  accepted:     [],
  rejected:     [],
  withdrawn:    [],
  ghosted:      [],
};

export const TERMINAL_STATES = new Set(['accepted', 'rejected', 'withdrawn', 'ghosted']);

export function getValidTransitions(status) {
  return TRANSITIONS[status] ?? [];
}

export function isValidTransition(current, next) {
  return (TRANSITIONS[current] ?? []).includes(next);
}
```

**Expected behavior**:
- `getValidTransitions('wishlisted')` → `['applied']`
- `getValidTransitions('offer')` → `['accepted', 'rejected', 'withdrawn', 'ghosted']`
- `getValidTransitions('assessment')` → `['interview', 'offer', 'rejected', 'withdrawn', 'ghosted']`
- `getValidTransitions('accepted')` → `[]`
- `getValidTransitions('not_a_status')` → `[]`
- `isValidTransition('applied', 'phone_screen')` → `true`
- `isValidTransition('applied', 'wishlisted')` → `false`
- `isValidTransition('rejected', 'applied')` → `false`
- `isValidTransition('assessment', 'interview')` → `true` (bidirectional loop)
- `isValidTransition('interview', 'assessment')` → `true` (bidirectional loop)
- `TERMINAL_STATES.has('accepted')` → `true`
- `TERMINAL_STATES.has('applied')` → `false`

**After adding the exports to `src/models/application.js`**, also update
`shared/constants.js` to re-export the three server-facing helpers alongside the
existing exports:

```js
// add to shared/constants.js — after existing exports
export { isValidTransition, getValidTransitions, TERMINAL_STATES } from '../src/models/application.js';
```

This keeps `server/routes/applications.js` consistent with the existing convention in
`server/validation/application.js`, which imports from `shared/constants.js` rather
than reaching into `src/` directly.

**Constraints**:
- All four exports must originate from `src/models/application.js` only. No other
  file may define or duplicate these transition rules.
- `shared/constants.js` re-exports only — it must not re-implement any logic.
- `TRANSITIONS` must have exactly one key per value in `STATUS_VALUES` (10 keys after
  Task 01.1).
- Terminal states (`accepted`, `rejected`, `withdrawn`, `ghosted`) must map to `[]`.

**Validation**: New tests in Task 01.3.

---

### [X] Task 01.3 — Add model tests for transition helpers

**Target file**: `tests/models/application.test.js`

**What to do**:

1. Add `TRANSITIONS`, `TERMINAL_STATES`, `getValidTransitions`, `isValidTransition`
   to the import at line 2.

2. Update the existing "defines unique badge backgrounds" test (lines 200–207): change
   both `toHaveLength(9)` and `.toBe(9)` to `10` — `STATUS_VALUES` now has 10 entries.

3. Add a new `describe('TRANSITIONS and helpers', ...)` block with the following tests:

   - `getValidTransitions('wishlisted')` returns `['applied']` (one option only)
   - `getValidTransitions('applied')` returns 7 statuses (all except `wishlisted` and `accepted`)
   - `getValidTransitions('offer')` returns `['accepted', 'rejected', 'withdrawn', 'ghosted']`
   - `getValidTransitions('accepted')` returns `[]`
   - `getValidTransitions('rejected')` returns `[]`
   - `getValidTransitions('withdrawn')` returns `[]`
   - `getValidTransitions('ghosted')` returns `[]`
   - `getValidTransitions('unknown_xyz')` returns `[]` (graceful fallback)
   - `isValidTransition('applied', 'phone_screen')` returns `true`
   - `isValidTransition('applied', 'wishlisted')` returns `false`
   - `isValidTransition('rejected', 'applied')` returns `false` (terminal source)
   - `isValidTransition('assessment', 'interview')` returns `true` (loop)
   - `isValidTransition('interview', 'assessment')` returns `true` (loop)
   - `TERMINAL_STATES` contains exactly `accepted`, `rejected`, `withdrawn`, `ghosted`
   - `TERMINAL_STATES` does not contain `offer` or `interview`

3. Add to the existing `describe('STATUS_CONFIG', ...)` block:
   - `accepted` entry has `badgeBg: '#2EC4B6'` and `badgeText: '#212529'`

**Validation**: `npm test -- tests/models/application.test.js` must pass fully.

---

### [X] Task 01.4 — Inspect CreationPicker for free-form status compatibility

**Target file**: `src/components/CreationPicker.js` (read-only inspection)

**What to do**: Open the file and confirm:

1. The creation status picker iterates `STATUS_VALUES` (or `STATUS_CONFIG`) without
   any filtering — there is no call to `getValidTransitions` or `TRANSITIONS` in the
   creation flow.
2. After Task 01.1 adds `'accepted'` to `STATUS_VALUES`, it will appear as a selectable
   option in the creation form. This is correct per spec decision CQ-001 — creation is
   free-form.

**If both checks pass**: no code change required. Mark this task done.

**If the file filters statuses at creation**: this is a bug — raise a new finding before
proceeding. Creation must not apply the transition map.

---

## Phase 02 — Server: Transition Gate in PATCH Handler

Depends on Phase 01 (imports model helpers). No UI changes in this phase.

---

### [X] Task 02.1 — Add transition gate to PATCH handler

**Target file**: `server/routes/applications.js`

**What to do**:

1. Add to the import at line 2 (or add a new import line):
   ```js
   import { isValidTransition, TERMINAL_STATES } from '../../shared/constants.js';
   ```
   This follows the established convention: server-side files import from
   `shared/constants.js`, not directly from `src/models/`. The helpers are re-exported
   from `shared/constants.js` in Task 01.2.

2. In the PATCH handler (line 73), after the Zod `safeParse` block (after line 89)
   and before the `update()` call at line 91, insert the following logic:

   ```
   if result.data.status is defined:
     a. Fetch current record: const currentRecord = getById(id, db)
     b. If currentRecord is null: return 404 NOT_FOUND (same shape as line 93–98)
     c. If result.data.status === currentRecord.status: skip to update() — no
          transition is occurring; do not run checks d or e
     d. If TERMINAL_STATES.has(currentRecord.status):
          return 400 VALIDATION_ERROR with fields.status:
          "Cannot change status of a completed application"
     e. If !isValidTransition(currentRecord.status, result.data.status):
          return 400 VALIDATION_ERROR with fields.status:
          "Invalid transition from <currentRecord.status> to <result.data.status>"
   ```

   Exact 400 response shape:
   ```json
   {
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "Validation failed",
       "fields": {
         "status": "<message here>"
       }
     }
   }
   ```

**Constraints**:
- The guard runs only when `result.data.status` is defined **and differs from the
  current record's status**. A PATCH that includes the unchanged status (e.g. the
  modal saving a full draft payload) MUST pass through without a transition error.
- The `POST /` creation route is unaffected — no transition check at creation.
- `POST /:id/archive` is unaffected.
- The existing `getById` import from `'../db/applications.js'` is already present;
  use it.

**Validation**: New tests in Task 02.2.

---

### [X] Task 02.2 — Add server integration tests for transition gate

**Target file**: `tests/server/applications.test.js`

**What to do**: Add a new `describe` block (or add tests to the existing `applications API`
block) covering:

1. **Invalid transition returns 400**
   - Create an application with `status: 'applied'`
   - PATCH with `{ status: 'wishlisted' }` (not a valid transition from `applied`)
   - Assert response status is `400`
   - Assert `body.error.code` is `'VALIDATION_ERROR'`
   - Assert `body.error.fields.status` is a non-empty string

2. **Terminal state returns 400**
   - Create an application with `status: 'rejected'`
   - PATCH with `{ status: 'applied' }` (terminal state — no transitions allowed)
   - Assert response status is `400`
   - Assert `body.error.fields.status` is `'Cannot change status of a completed application'`

3. **Valid transition returns 200**
   - Create an application with `status: 'applied'`
   - PATCH with `{ status: 'phone_screen' }` (valid transition)
   - Assert response status is `200`
   - Assert `body.data.status` is `'phone_screen'`

4. **PATCH without status field is unaffected**
   - Create an application
   - PATCH with `{ fav: true }` (no status field)
   - Assert response status is `200` (no transition check triggered)

5. **PATCH with unchanged status is unaffected (including terminal records)**
   - Create an application with `status: 'rejected'`
   - PATCH with `{ notes: 'follow up', status: 'rejected' }` (status unchanged)
   - Assert response status is `200`
   - Assert `body.data.status` is `'rejected'`
   - _(Verifies US4: non-status fields on terminal applications remain editable)_

6. **`offer → accepted` transition returns 200 (SC-005, US3)**
   - Create an application with `status: 'offer'`
   - PATCH with `{ status: 'accepted' }`
   - Assert response status is `200`
   - Assert `body.data.status` is `'accepted'`
   - Assert `body.data.lastStatusUpdate` is present and non-empty (confirms SC-005: valid
     transition updates both `status` and `last_status_update`)

**Validation**: `npm test -- tests/server/applications.test.js` must pass.

---

### [X] Task 02.3 — Verify `accepted` passes Zod validation

**Target file**: `tests/server/validation.test.js`

**What to do**: In the existing `describe('createSchema', ...)` block, add one test:

```
it('accepts "accepted" as a valid status', () => {
  expect(createSchema.safeParse(validPayload({ status: 'accepted' })).success).toBe(true);
});
```

This confirms that `server/validation/application.js` picks up `accepted` automatically
via `STATUS_VALUES` (no manual change to the validation file is required).

**Validation**: `npm test -- tests/server/validation.test.js` must pass.

---

## Phase 03 — UI: Filter StatusDropdown to Valid Transitions

Depends on Phase 01. Can run in parallel with Phase 02.

---

### [X] Task 03.1 — Filter dropdown options to valid next transitions

**Target file**: `src/components/StatusDropdown.js`

**What to do**:

1. Update the import at line 1 to include `getValidTransitions`:
   ```js
   import { STATUS_CONFIG, getValidTransitions } from '../models/application.js';
   ```
   Remove `STATUS_VALUES` from the import (it is no longer used in this file).

2. In the `open` function, replace the loop at line 100:
   ```js
   // Before:
   for (const value of STATUS_VALUES) {
   // After:
   for (const value of getValidTransitions(currentStatus)) {
   ```

**Expected behavior**:
- `open(anchor, 'wishlisted', fn)` → dropdown renders exactly one option: `applied`
- `open(anchor, 'offer', fn)` → dropdown renders exactly four options:
  `accepted`, `rejected`, `withdrawn`, `ghosted`
- `open(anchor, 'applied', fn)` → dropdown renders seven options (all except
  `wishlisted` and `accepted`)
- `open(anchor, 'rejected', fn)` → dropdown renders zero options (terminal state;
  callers should prevent this case, but the function must not crash)

**Constraints**:
- Do not modify `createOption`. The check-mark and active-state logic may remain.
- Do not modify the `open` function signature or the `currentStatus` parameter.
- Do not modify `close`, `positionPanel`, or any other function in the file.

**Validation**: Updated tests in Task 03.2.

---

### [X] Task 03.2 — Update StatusDropdown tests

**Target file**: `tests/components/StatusDropdown.test.js`

**What to do**:

1. The existing test (line 22) opens the dropdown with `currentStatus: 'wishlisted'`
   and queries `[data-status="wishlisted"]`. After the change, `wishlisted` is no longer
   in the options list (only `applied` is). Update this test:
   - Change the query to `[data-status="applied"]` (the only valid transition from
     `wishlisted`) and assert its dot background color matches
     `STATUS_CONFIG.applied.badgeBg`.

2. Add new tests:

   - Opening with `currentStatus: 'wishlisted'` renders exactly 1 option element
     (`data-status="applied"` is present, no other `status-option` elements exist)

   - Opening with `currentStatus: 'offer'` renders exactly 4 option elements
     (query `.status-option` and assert `.length === 4`)

   - Opening with `currentStatus: 'accepted'` renders 0 option elements
     (terminal state → empty dropdown)

**Validation**: `npm test -- tests/components/StatusDropdown.test.js` must pass.

---

## Phase 04 — UI: Disable Status Controls for Terminal States

Depends on Phase 01. Applies to both Card and Modal independently.

---

### [X] Task 04.1 — Disable status button in Card for terminal states

**Target file**: `src/components/Card.js`

**What to do**:

1. Add `TERMINAL_STATES` to the existing import from `'../models/application.js'`
   (currently at or near the top of the file where `STATUS_CONFIG` is imported).

2. Before the `statusButton.addEventListener('click', ...)` block at line 145:

   ```js
   if (TERMINAL_STATES.has(application.status)) {
     statusButton.disabled = true;
     statusButton.title = 'Workflow complete';
   } else {
     statusButton.addEventListener('click', (event) => {
       stopAction(event, () => {
         StatusDropdown.open(statusButton, application.status, (newStatus) => {
           callbacks.onStatusChange?.(application.id, newStatus);
         });
       });
     });
   }
   ```

   Move the existing click-handler block into the `else` branch. The button element
   must remain in the DOM — it is not hidden or removed.

**Expected behavior**:
- `Card.render(application({ status: 'rejected' }))` → status button has `disabled`
  attribute and `title="Workflow complete"`; clicking it does nothing
- `Card.render(application({ status: 'accepted' }))` → status button has `disabled`
  attribute and `title="Workflow complete"`
- `Card.render(application({ status: 'applied' }))` → status button has no `disabled`
  attribute; click opens the dropdown

**Constraints**:
- Do not change `archiveButton`, `editButton`, `copyButton`, or `starButton` handlers.
- The total number of `.card-btn` elements must remain 5.

**Validation**: New tests in Task 04.3.

---

### [X] Task 04.2 — Disable status controls in Modal for terminal states

**Target file**: `src/components/Modal.js`

**What to do**:

1. Add `TERMINAL_STATES` to the existing import from `'../models/application.js'` near
   the top of the file.

2. After `currentStatus` is initialized at line 833, derive a boolean:
   ```js
   const isTerminal = TERMINAL_STATES.has(currentStatus);
   ```

3. After `statusButton.setAttribute('aria-label', 'Change status')` at line 863,
   conditionally apply the terminal-state attributes:
   ```js
   if (isTerminal) {
     statusButton.disabled = true;
     statusButton.title = 'Workflow complete';
   }
   ```

4. For `statusBadge`, after line 872 (`statusBadge.setAttribute('aria-label', ...)`),
   conditionally override its interactive attributes:
   ```js
   if (isTerminal) {
     statusBadge.removeAttribute('role');
     statusBadge.removeAttribute('tabindex');
     statusBadge.setAttribute('aria-disabled', 'true');
     statusBadge.setAttribute('aria-label', 'Status locked — workflow complete');
   }
   ```

5. Wrap the three status-change event listeners (lines 895–908) in `if (!isTerminal)`
   guards:
   ```js
   if (!isTerminal) {
     statusButton.addEventListener('click', () => { openStatusDropdown(statusButton); });
     statusBadge.addEventListener('click', () => { openStatusDropdown(statusBadge); });
     statusBadge.addEventListener('keydown', (event) => {
       if (event.key === 'Enter' || event.key === ' ') {
         event.preventDefault();
         openStatusDropdown(statusBadge);
       }
     });
   }
   ```

**Expected behavior**:
- Modal opened for a `rejected` application: `statusButton` has `disabled` attribute;
  `statusBadge` has `aria-disabled="true"` and no `role` or `tabindex`; clicking
  either control does not open the dropdown.
- Modal opened for an `applied` application: no change to existing behavior.

**Constraints**:
- `favoriteButton`, `archiveButton`, `closeButton` handlers are unaffected.
- The `openStatusDropdown` function itself is unchanged; it is simply not called in
  terminal state.

**Validation**: Manual test per `quickstart.md` Path 2 and Path 5. No new automated
component test for Modal is required, but if `tests/components/Modal.test.js` has
status-related tests, verify they still pass.

---

### [X] Task 04.3 — Add terminal state tests to Card

**Target file**: `tests/components/Card.test.js`

**What to do**: Add tests to the existing `describe('Card', ...)` block:

1. Status button is `disabled` for each terminal state:
   ```
   for status in ['accepted', 'rejected', 'withdrawn', 'ghosted']:
     card = Card.render(application({ status }))
     statusButton = card.querySelector('[aria-label="Change status"]')
                   (or equivalent selector — match how the button is found in existing tests)
     expect(statusButton.disabled).toBe(true)
   ```

2. Status button is NOT disabled for an active state:
   ```
   card = Card.render(application({ status: 'applied' }))
   statusButton = ...
   expect(statusButton.disabled).toBe(false)
   ```

3. The total card button count is still 5 for a terminal-state application:
   ```
   card = Card.render(application({ status: 'rejected' }))
   expect(card.querySelectorAll('.card-btn')).toHaveLength(5)
   ```

**Note**: To find the correct selector for the status button in Card tests, inspect
how the button is created in `Card.js`. Use `aria-label` or a class attribute that
already exists on that button.

**Validation**: `npm test -- tests/components/Card.test.js` must pass.

---

## Phase 05 — Quality Gate

Run after all other phases are complete.

---

### [X] Task 05.1 — Run full test suite and resolve failures

**Command**: `npm test`

**Known tests that may need fixing if not already updated**:

| Test file | Expected issue |
|-----------|----------------|
| `tests/models/application.test.js` | `toHaveLength(9)` / `.toBe(9)` in STATUS_CONFIG test — must be updated to `10` in Task 01.1 |
| `tests/components/StatusDropdown.test.js` | `[data-status="wishlisted"]` query fails after filtering — must be updated in Task 03.2 |
| `tests/server/validation.test.js` | No breakage expected; Task 02.3 adds a new test |

All tests must pass before marking this phase complete.

---

### [X] Task 05.2 — Complete plan-review checklist

**File**: `specs/015-application-state-machine/checklists/plan-review.md`

Work through every checkbox. For any item that cannot be confirmed, document it
inline with reason and residual risk. All items in the "Transition Map Completeness"
and "Single Source of Truth" sections are required to pass before marking Phase 05 done.

---

## Phase 06 — Browser Smoke Test

**Purpose**: Verify the feature end-to-end in a real browser against a running server.
Catches rendering, CSS layout, real keyboard interaction, and mobile viewport issues
that automated tests cannot detect. Required by the project constitution (Amendment
1.1.0) for any feature with user-facing UI changes.

**Setup**: `npm run dev` (starts frontend + backend). Load or create test applications
before running each task.

**Pass criteria**: A task is complete only when a human has walked through the steps
in a live browser and every listed acceptance scenario passes. Document any deviation
or deferred item with rationale.

---

### [X] Task 06.1 — US1: Valid transitions filter the status picker

**Spec reference**: `spec.md` User Story 1 — Independent Test and Acceptance Scenarios 1–4

Steps:
1. Open an application at `Applied`. Open the status control.
2. **Pass**: only `Phone Screen`, `Interview`, `Assessment`, `Offer`, `Rejected`,
   `Withdrawn`, and `Ghosted` are shown — `Wishlisted` and `Accepted` are absent.
3. Select `Phone Screen` and confirm. **Pass**: status updates; `last_status_update` refreshes.
4. Repeat from an application at `Wishlisted`: **Pass**: only `Applied` appears in the picker.
5. Open an application at `Offer`: **Pass**: `Accepted`, `Rejected`, `Withdrawn`, `Ghosted`
   appear; no active pipeline states appear.

---

### [X] Task 06.2 — US2: Terminal state locks the status control

**Spec reference**: `spec.md` User Story 2 — Independent Test and Acceptance Scenarios 1–3

Steps:
1. Open each terminal-state application (`Accepted`, `Rejected`, `Withdrawn`, `Ghosted`)
   in turn — both in card view and in the detail modal.
2. **Pass**: the status change control is visible but disabled (not hidden or removed).
3. **Pass**: hovering/focusing the button shows "Workflow complete" (tooltip or
   accessible label confirms the control communicates workflow completion, not mere absence).
4. Attempt to click or keyboard-activate the control. **Pass**: no dropdown opens; no
   status change occurs; no error is thrown.

---

### [X] Task 06.3 — US3: Accepting an offer

**Spec reference**: `spec.md` User Story 3 — Independent Test and Acceptance Scenarios 1–4

Steps:
1. Set an application to `Offer`. Open the status control.
2. **Pass**: `Accepted` appears as a selectable option.
3. Select `Accepted` and confirm.
4. **Pass**: application status badge shows teal background (`#2EC4B6`) with dark text (`#212529`).
5. **Pass**: the status control is now disabled (terminal state rule applies).

---

### [X] Task 06.4 — US4: Existing records unaffected

**Spec reference**: `spec.md` User Story 4 — Independent Test and Acceptance Scenarios 1–3

Steps:
1. Locate applications at all current statuses (`wishlisted`, `applied`, `phone_screen`,
   `interview`, `assessment`, `offer`, `rejected`, `withdrawn`, `ghosted`).
2. **Pass**: every record displays its existing status badge correctly; no status coercion
   or visual corruption.
3. **Pass**: the status control for each non-terminal record shows the correct valid next
   transitions per the transition map.
4. **Pass**: `ghosted`, `rejected`, and `withdrawn` records show a disabled status control.
5. Open the filter panel (or `QuickFiltersToolbar`). **Pass**: `Accepted` appears as a
   filter option alongside all other statuses — confirming `STATUS_VALUES` is the source
   for filter options and `accepted` propagated correctly.

---

### [X] Task 06.5 — Mobile layout

Steps:
1. Open DevTools; set viewport to ≤ 640 px.
2. Open the status dropdown on a card and in the modal.
3. **Pass**: dropdown panel positions correctly and is fully usable.
4. **Pass**: disabled status button on terminal-state cards is visible and legible at
   mobile width.
5. **Pass**: no broken layout, overflow, or truncated text in the status badge area.

Record any failures as issues to resolve before the feature is accepted.
