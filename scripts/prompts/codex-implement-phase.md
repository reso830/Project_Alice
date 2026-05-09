Implement one Spec Kit phase.

Instructions:
- Read the workflow ledger, tasks, plan, spec, and repo map if available.
- Use the workflow ledger to identify standing findings, user notes, and accepted resolutions.
- Address findings marked `New` for this phase unless the user marked them `Accepted`.
- Implement only the requested phase.
- Stop after completing this phase.
- Do not proceed to the next phase.

Context discipline:
- Do not scan the entire repository.
- Start by identifying the minimal set of files required.
- Prefer targeted search over broad exploration.
- If expanding scope, explicitly state why.

Before editing, list:
- files to inspect
- files to modify

Implementation rules:
- Follow the project constitution.
- Do not add unrequested features.
- Keep changes small and testable.
- Respect target files defined in `tasks.md`.
- Do not modify out-of-scope areas unless required and justified.

Testing:
- Add or update tests according to the phase tasks.
- Run the narrowest useful tests first.
- Report any tests that could not be run and why.

Output:
- summary of changes
- files modified
- tests added/updated
- tests run
- assumptions made
