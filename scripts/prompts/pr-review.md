Review this PR as the final gate before merge.

Source of truth:
- Review the diff at `origin/main...HEAD`, or the PR diff when a PR exists.
- If a PR exists, verify the current remote PR head before judging — never review a stale local branch.

Instructions:
- Always inspect the diff and the changed tests. Read spec / plan / tasks / checklists / workflow ledger only when the PR maps to a feature branch, or when requirements are needed to judge "missed requirements."
- When a PR exists and the task is merge readiness, check GitHub state: `gh pr view`, CI/checks status, mergeability, and unresolved review threads.
- Honor user notes, accepted findings, and prior review history unless they conflict with the project constitution.
- This is a read-only review. Do not edit files. Do not post to GitHub unless explicitly asked. If asked to post on the user's own PR, use a regular PR comment (formal approve / request-changes can fail) and prefix it to signal it is an automated AI review.

Focus on:
- correctness
- maintainability
- validation logic
- data integrity
- data model quality
- edge cases
- test coverage
- UX risks
- regressions
- missed requirements

Constitution-specific checks, when the relevant files changed:
- Validation logic changed → confirm tests cover status transitions, required-field enforcement, URL validation, and date handling.
- Data layer changed → confirm both persistence runtimes are handled (local / hosted via `createRepositories`). Demo mode runs on the local path with seeded data — check it only if the change affects it.
- UI changed → confirm empty / loading / error states are handled, status is not color-only, and the surface is keyboard-navigable.

Final-gate checks — this is the whole-feature review, so verify the mandatory final phases happened:
- Release Prep: version bumped in `package.json` AND `package-lock.json` root version, `CHANGELOG.md` entry present, `docs/feature_roadmap.md` ticked, `README.md` / `docs/deployment.md` / `docs/REPO_MAP.md` updated where applicable.
- Browser Smoke Test: for UI features, each user story's Independent Test was walked against the to-be-merged state.

The first line of your response must be exactly one of:
Pass
Needs Changes

Use `Needs Changes` if there are any `CRITICAL`, `MAJOR`, or `MINOR` findings.
Use `Pass` only when all findings are `INFO` or there are no findings.

Use only these severity labels:
- `CRITICAL` - app-breaking issue or major conflict with the constitution. Merge cannot proceed.
- `MAJOR` - app-breaking or major bug. Must be resolved before merge.
- `MINOR` - non-breaking issue that can still cause problems, including UI/UX. Must be resolved before merge.
- `INFO` - FYIs based on findings.

Output:
- For each finding, give: severity, file/line, the issue, the risk, and a minimal fix.
- If there are no findings, state "No blocking findings."
- Explicitly name anything you could not verify — remote CI, local test runs, browser smoke, or GitHub thread state — rather than implying it was checked.
