# Workflow Ledger: Application Workflow State Machine (015)

**Branch**: `015-application-state-machine`
**Spec**: `specs/015-application-state-machine/spec.md`

---

## Req-Review Findings

| ID | Severity | Summary | State | Resolution |
|----|----------|---------|-------|------------|
| MINOR-01 | MINOR | No dedicated browser smoke test phase — constitution Amendment 1.1.0 requires it as the final phase | Resolved | Added Phase 06 — Browser Smoke Test to tasks.md with one task per user story drawn from spec.md Independent Tests |
| MINOR-02 | MINOR | US2 scenario 2 acceptance criterion not mapped — tasks set `disabled` but don't specify how the control communicates "workflow complete" | Resolved | Updated Tasks 04.1 and 04.2 to set `title="Workflow complete"` on `statusButton` and update `aria-label` on `statusBadge` to "Status locked — workflow complete" when terminal |
| MINOR-03 | MINOR | No server integration test for `offer → accepted` — the primary path for the new status and SC-005 compliance | Resolved | Added test 5 to Task 02.2: PATCH `offer → accepted` returns 200 with `status: 'accepted'` and `lastStatusUpdate` present |
| INFO-01 | INFO | Import path in Task 02.1 diverges from shared/constants.js convention | Resolved | Updated Task 01.2 to re-export helpers from `shared/constants.js`; updated Task 02.1 to import from there; updated plan.md and data-model.md to reflect `shared/constants.js` as a modified file |
| INFO-02 | INFO | `accepted` appearing in filter panel not explicitly verified in any task | Resolved | Added step 5 to Task 06.4 (browser smoke test) to verify `Accepted` in filter panel; added checklist items to `checklists/plan-review.md` |
| INFO-03 | INFO | CreationPicker inspection not scheduled as a task | Resolved | Added Task 01.4 — inspect `CreationPicker.js` to confirm free-form creation with `accepted` visible as an option |
| INFO-04 | INFO | Task 01.1 and 01.3 both reference the same test assertion update | Resolved | Removed assertion-update instruction from Task 01.1 Validation section; Task 01.3 now owns all test file changes including the `toHaveLength(9) → 10` update |

---

## Implementation Review Findings (pre-implementation, Codex)

| ID | Severity | Summary | State | Resolution |
|----|----------|---------|-------|------------|
| IMPL-MAJOR-01 | MAJOR | Task 02.1 transition gate fires on any PATCH with `status` present, including unchanged-status saves — modal sends full draft payload, so non-status edits on terminal records are incorrectly rejected | Resolved | Added step c to Task 02.1 pseudocode: skip checks when `result.data.status === currentRecord.status`; updated Constraints block; added test 5 to Task 02.2 (unchanged terminal status → 200) and renumbered former test 5 to 6 |
| IMPL-MINOR-01 | MINOR | `plan-review.md` checklist (line 31) says the PATCH route imports from the model, contradicting plan.md and tasks.md which route the server through `shared/constants.js` | Resolved | Split checklist item into two: UI components import from `src/models/application.js` directly; PATCH route imports from `shared/constants.js` per INFO-01 convention |

---

## PR Review Findings

_None yet._
