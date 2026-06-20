Implement one Spec Kit phase.

Instructions:
- Always read the workflow ledger if present, tasks, plan, and spec.
- Read contracts, quickstart, checklists, repo map, roadmap, release docs, or related source files only when the phase references them, the change touches public/API/storage/release behavior, there is ambiguity, or implementation requires deleting or migrating an existing contract.
- Use the workflow ledger to identify standing findings, user notes, and accepted resolutions.
- Address findings marked `New` for this phase unless the user marked them `Accepted`.
- Implement only the requested phase.
- Stop after completing this phase.
- Do not proceed to the next phase.
- If phase numbering, target files, or task scope conflict, stop and ask one clarification instead of guessing.

Context discipline:
- Do not scan the entire repository.
- Start by identifying the minimal set of files required.
- Prefer targeted search over broad exploration.
- If expanding scope, explicitly state why.

Before editing, briefly state:
- requested phase
- in-scope task IDs
- out-of-scope tasks or phases
- files likely to change
- extra artifacts read, if any, and why

Implementation rules:
- Follow the project constitution.
- Do not add unrequested features.
- Keep changes small and testable.
- Respect target files defined in `tasks.md`.
- Do not modify out-of-scope areas unless required and justified.
- Do not add attribution comments to source, tests, specs, or generated app content unless the user explicitly requests it.
- Update `tasks.md`, checklists, or workflow ledger items only after the corresponding implementation and validation are complete.
- If a task or check is intentionally skipped, document the reason and residual risk.
- For release-prep phases, keep version and release surfaces synchronized: `package.json`, `package-lock.json`, app metadata, README, CHANGELOG, repo map, roadmap, and release metadata tests when present.

Testing:
- Add or update tests according to the phase tasks.
- Run the narrowest useful tests first.
- Run broader lint/test/diff checks when the phase touches shared services, persistence, release metadata, cross-module contracts, or user-facing workflows.
- For migrations, deletions, or renamed contracts, run targeted searches for stale references.
- Report any tests that could not be run and why.

Output:
- summary of changes
- files modified
- tests added/updated
- tests run
- assumptions made
- skipped checks or residual risks
- attribution line: `Co-developed by OpenAI Codex`
