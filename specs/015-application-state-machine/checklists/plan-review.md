# Plan Review Checklist: Application Workflow State Machine (015)

Complete before generating tasks. Check each item; document any skip with reason and residual risk.

---

## Constitution Compliance

- [x] Required fields (`company name`, `job title`, `status`, `last_status_update`) are unaffected by this change
- [x] No silent data corruption: transition rejection returns an explicit `400`; no silent coercion of invalid statuses
- [x] URL validation is unaffected
- [x] No new external dependencies introduced
- [x] Local-first constraint maintained: no analytics, no remote calls

---

## Transition Map Completeness

- [x] Every status in `STATUS_VALUES` has an entry in `TRANSITIONS` (including `accepted`)
- [x] All four terminal states (`accepted`, `rejected`, `withdrawn`, `ghosted`) map to `[]`
- [x] Assessment ↔ Interview bidirectional loop is present: `assessment → interview` and `interview → assessment`
- [x] `offer → accepted` is present
- [x] `wishlisted → applied` is the only transition from `wishlisted`

---

## Single Source of Truth

- [x] `TRANSITIONS`, `isValidTransition`, `getValidTransitions` are exported from `src/models/application.js` only
- [x] No other file duplicates the transition rules
- [x] `StatusDropdown.js`, `Card.js`, and `Modal.js` import helpers directly from `src/models/application.js`
- [x] The PATCH route imports helpers from `shared/constants.js` (re-exported from the model per INFO-01 convention), not directly from `src/models/`

---

## Affected Surfaces

- [x] `StatusDropdown.js` — confirmed to be the only component that renders the status option list
- [x] `Card.js` — all status-change entry points identified (line 147 confirmed)
- [x] `Modal.js` — all three status-change entry points identified (status button click, badge click, badge Enter/Space keydown confirmed)
- [x] No other components trigger status changes (Grep for `StatusDropdown.open` confirms count)
- [x] `CreationPicker.js` delegates creation to `Modal.open(..., { mode: 'create' })`; Modal uses `StatusDropdown.openAll`, so free-form creation is correct

---

## Server Validation

- [x] PATCH handler fetches current record before validating transition (not relying solely on client state)
- [x] Error response shape matches existing `VALIDATION_ERROR` format (`fields.status: "..."`)
- [x] Terminal state check happens before invalid-transition check (correct evaluation order)
- [x] POST (creation) is confirmed exempt from transition validation

---

## Backward Compatibility

- [x] All existing statuses (`wishlisted`, `applied`, `phone_screen`, `interview`, `assessment`, `offer`, `rejected`, `withdrawn`, `ghosted`) remain valid
- [x] No DB migration required: `status` column is unconstrained TEXT
- [x] `shared/constants.js` re-exports are confirmed to pick up `accepted` automatically
- [x] `server/validation/application.js` refine confirmed to pick up `accepted` automatically
- [x] `normalizeApplication` fallback coercion is unaffected (unknown → `wishlisted`)

---

## Test Coverage

- [x] Model unit tests planned for: every TRANSITIONS row, `isValidTransition` (valid, invalid, terminal), `getValidTransitions` (all states), `accepted` in `STATUS_CONFIG`
- [x] Server integration tests planned for: invalid transition → 400, terminal state → 400, valid transition → 200, POST with `accepted` → 201
- [x] Component tests planned for: filtered dropdown options, terminal-state disabled button (Card)
- [x] Existing test suite confirmed to still pass after `accepted` is added to `STATUS_VALUES`

---

## Filter Panel and Creation

- [x] `FilterPanel` / `QuickFiltersToolbar` use `STATUS_VALUES` as source for filter options — `accepted` propagates automatically without modification
- [x] `CreationPicker` inspected: delegates to Modal create mode; `accepted` appears as a valid creation-status option through `StatusDropdown.openAll`

---

## Edge Cases Addressed

- [x] Unknown/corrupted status in DB → `getValidTransitions` returns `[]` → control disabled → documented in `research.md` D-003
- [x] Assessment ↔ Interview loop confirmed intentional and present in `TRANSITIONS`
- [x] Archive + terminal state: archiving is independent; `POST /:id/archive` is unaffected
- [x] Wishlisted with single valid transition: UI will show a one-item dropdown; no special handling needed

---

## Skipped Items

_None at time of plan authoring. Document any skips here with reason and residual risk before generating tasks._
