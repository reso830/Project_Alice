Review the current PR or branch as an engineer.

Fill in before sending:
- Feature name:
- PR link or branch:
- Base branch:
- Workflow ledger path, if any:
- Spec/plan/tasks paths, if relevant:

Instructions:
- Read the PR diff or current branch diff.
- Read the workflow ledger if one exists.
- Honor user notes, accepted findings, and prior review history unless they conflict with the project constitution.
- This is a read-only review. Do not edit files.

Focus on:
- correctness
- validation
- data integrity
- edge cases
- test coverage
- regressions

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

After the verdict, list concise findings with file paths and line references when useful.
