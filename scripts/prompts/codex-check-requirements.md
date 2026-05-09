Review this Spec Kit package as a software engineer.

Instructions:
- Read the spec, plan, tasks, and workflow ledger if one exists.
- Honor user notes, accepted findings, and prior review history unless they conflict with the project constitution.
- This is a read-only review. Do not modify source, tests, spec, plan, tasks, or the workflow ledger.

Check for:
- unclear requirements
- blockers to implementation
- missing acceptance criteria
- contradictions
- missing validation or tests
- risky assumptions

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

After the verdict, list findings concisely. Include file paths and line references when useful.
