Review one implemented Spec Kit phase.

Fill in before sending:
- Feature name:
- Feature directory:
- Phase number:
- Workflow ledger path:
- Spec path:
- Plan path:
- Tasks path:
- Relevant diff or changed files:

Instructions:
- Read the workflow ledger, phase tasks, plan, spec, and changed files.
- Honor user notes, accepted findings, and prior review history unless they conflict with the project constitution.
- This is a read-only review. Do not edit source files, tests, specs, tasks, or the workflow ledger.

Review for:
- correctness
- maintainability
- validation logic
- data model quality
- test coverage
- UX risks
- missed phase tasks
- unintended out-of-scope changes

The first line of your response must be exactly one of:
Pass
Needs Changes

Use `Needs Changes` if there are any `CRITICAL`, `MAJOR`, or `MINOR` findings.
Use `Pass` only when all findings are `INFO` or there are no findings.

Use only these severity labels:
- `CRITICAL` - app-breaking issue or major conflict with constitution that needs to be addressed. Current phase cannot proceed.
- `MAJOR` - app-breaking or major bug. Must be resolved before moving forward.
- `MINOR` - non-breaking issue that can still cause problems, including UI/UX. Must be resolved before moving forward.
- `INFO` - FYIs based on findings.

After the verdict, list findings concisely. Include file paths and line references when useful.
