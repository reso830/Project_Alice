Review this Spec Kit package as a software engineer.

Instructions:
- Read the spec, plan, tasks, the `checklists/plan-review.md` checklist, and the workflow ledger if one exists.
- Also read contracts, quickstart, feature brief, roadmap, or other package artifacts when they exist and define behavior, public contracts, validation, acceptance criteria, or release scope.
- Honor user notes, accepted findings, and prior review history unless they conflict with the project constitution.
- This is a read-only review. Do not modify source, tests, spec, plan, tasks, or the workflow ledger.

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
- Include a brief `Artifacts reviewed` list so review coverage is clear.
