# Plan Review Checklist: Application Workflow State Machine (015)

Complete before generating tasks. Check each item; document any skip with reason and residual risk.

---

## Constitution Compliance

- [ ] Required fields (`company name`, `job title`, `status`, `last_status_update`) are unaffected by this change
- [ ] No silent data corruption: transition rejection returns an explicit `400`; no silent coercion of invalid statuses
- [ ] URL validation is unaffected
- [ ] No new external dependencies introduced
- [ ] Local-first constraint maintained: no analytics, no remote calls

---

## Transition Map Completeness

- [ ] Every status in `STATUS_VALUES` has an entry in `TRANSITIONS` (including `accepted`)
- [ ] All four terminal states (`accepted`, `rejected`, `withdrawn`, `ghosted`) map to `[]`
- [ ] Assessment ↔ Interview bidirectional loop is present: `assessment → interview` and `interview → assessment`
- [ ] `offer → accepted` is present
- [ ] `wishlisted → applied` is the only transition from `wishlisted`

---

## Single Source of Truth

- [ ] `TRANSITIONS`, `isValidTransition`, `getValidTransitions` are exported from `src/models/application.js` only
- [ ] No other file duplicates the transition rules
- [ ] `StatusDropdown.js`, `Card.js`, and `Modal.js` import helpers directly from `src/models/application.js`
- [ ] The PATCH route imports helpers from `shared/constants.js` (re-exported from the model per INFO-01 convention), not directly from `src/models/`

---

## Affected Surfaces

- [ ] `StatusDropdown.js` — confirmed to be the only component that renders the status option list
- [ ] `Card.js` — all status-change entry points identified (line 147 confirmed)
- [ ] `Modal.js` — all three status-change entry points identified (lines 896, 900, 906 confirmed)
- [ ] No other components trigger status changes (Grep for `StatusDropdown.open` confirms count)
- [ ] `CreationPicker.js` confirmed to use `STATUS_VALUES` without transition filtering (free-form creation is correct)

---

## Server Validation

- [ ] PATCH handler fetches current record before validating transition (not relying solely on client state)
- [ ] Error response shape matches existing `VALIDATION_ERROR` format (`fields.status: "..."`)
- [ ] Terminal state check happens before invalid-transition check (correct evaluation order)
- [ ] POST (creation) is confirmed exempt from transition validation

---

## Backward Compatibility

- [ ] All existing statuses (`wishlisted`, `applied`, `phone_screen`, `interview`, `assessment`, `offer`, `rejected`, `withdrawn`, `ghosted`) remain valid
- [ ] No DB migration required: `status` column is unconstrained TEXT
- [ ] `shared/constants.js` re-exports are confirmed to pick up `accepted` automatically
- [ ] `server/validation/application.js` refine confirmed to pick up `accepted` automatically
- [ ] `normalizeApplication` fallback coercion is unaffected (unknown → `wishlisted`)

---

## Test Coverage

- [ ] Model unit tests planned for: every TRANSITIONS row, `isValidTransition` (valid, invalid, terminal), `getValidTransitions` (all states), `accepted` in `STATUS_CONFIG`
- [ ] Server integration tests planned for: invalid transition → 400, terminal state → 400, valid transition → 200, POST with `accepted` → 201
- [ ] Component tests planned for: filtered dropdown options, terminal-state disabled button (Card)
- [ ] Existing test suite confirmed to still pass after `accepted` is added to `STATUS_VALUES`

---

## Filter Panel and Creation

- [ ] `FilterPanel` / `QuickFiltersToolbar` use `STATUS_VALUES` as source for filter options — `accepted` propagates automatically without modification
- [ ] `CreationPicker` inspected: iterates `STATUS_VALUES` without transition filtering; `accepted` appears as a valid creation-status option (Task 01.4)

---

## Edge Cases Addressed

- [ ] Unknown/corrupted status in DB → `getValidTransitions` returns `[]` → control disabled → documented in `research.md` D-003
- [ ] Assessment ↔ Interview loop confirmed intentional and present in `TRANSITIONS`
- [ ] Archive + terminal state: archiving is independent; `POST /:id/archive` is unaffected
- [ ] Wishlisted with single valid transition: UI will show a one-item dropdown; no special handling needed

---

## Skipped Items

_None at time of plan authoring. Document any skips here with reason and residual risk before generating tasks._
