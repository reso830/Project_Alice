Review this Spec Kit package as a software engineer.

Instructions:
- Read the spec, plan, tasks, the `checklists/plan-review.md` checklist, and the workflow ledger if one exists.
- Also read contracts, quickstart, feature brief, roadmap, or other package artifacts when they exist and define behavior, public contracts, validation, acceptance criteria, or release scope.
- Honor user notes, accepted findings, and prior review history unless they conflict with the project constitution.
- This review is read-only for source, tests, spec, plan, tasks, and the workflow ledger. The **one exception** is `checklists/plan-review.md`, which is the reviewer's worksheet: you MUST execute it (see "Execute the plan-review gate" below) and may edit that file only — checking verified items and writing the gate-result note. Modify nothing else.

Check for:
- unclear requirements
- blockers to implementation
- missing acceptance criteria
- contradictions
- missing validation or tests
- risky assumptions
- cross-artifact drift between spec, plan, tasks, contracts, quickstart, checklist, roadmap, and release notes
- missing target files, nonexistent scripts, unclear task ownership, or untestable acceptance criteria
- feature number/name mismatches and stale references from earlier features

## Execute the plan-review gate

`checklists/plan-review.md` is a pre-implementation gate that MUST be *completed during this review* — `/speckit.plan` creates it with empty boxes and no later step fills it in, so if you skip it the gate is left at FAIL until a human notices. Work through every item:

- Verify each item against the spec, plan, tasks, contracts, and the other artifacts.
- If the item holds, mark it `[x]`.
- If it does not hold — or you cannot confirm it from the artifacts — leave it `[ ]` and raise a corresponding finding (severity by impact) describing the gap and what would satisfy the item. Never tick an item you could not verify.
- After working through all items, set a one-line result at the top of the file: `**Gate result**: PASS` (every item checked) or `**Gate result**: FAIL — open: <item numbers>`, plus the review date.
- The package is **Not Ready** while any item is unchecked because of a real gap. A fully-checked gate with no other non-INFO findings is part of a `Ready` verdict.

Editing `checklists/plan-review.md` (and only that file) is expected and required here; it does not violate the read-only rule above.

The first line of your response must be exactly one of:
Ready
Not Ready

Use `Not Ready` if there are any `CRITICAL`, `MAJOR`, or `MINOR` findings.
Use `Ready` only when all findings are `INFO` or there are no findings.

Use only these severity labels:
- `CRITICAL` - app-breaking issue or major conflict with constitution that needs to be addressed. Current phase cannot proceed.
- `MAJOR` - app-breaking or major bug. Must be resolved before moving forward.
- `MINOR` - non-breaking issue that can still cause problems, including UI/UX. Must be resolved before moving forward.
- `INFO` - FYIs based on findings.

After the verdict:
- List findings concisely. For each finding include severity, file path/line when useful, the issue, why it matters, and what would make it ready.
- State the `plan-review.md` gate result (PASS, or FAIL with the open item numbers).
- Include a brief `Artifacts reviewed` list so review coverage is clear.
