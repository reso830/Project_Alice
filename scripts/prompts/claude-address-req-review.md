Address standing requirements-review findings for this feature.

Fill in before sending:
- Feature name:
- Feature directory:
- Workflow ledger path:
- Spec path:
- Plan path:
- Tasks path:
- Constitution path:

Instructions:
- Read the workflow ledger, spec, plan, tasks, and constitution.
- Inspect the Req-Review findings table in the workflow ledger.
- For each finding marked `New`, either:
  - update spec, plan, and/or tasks to resolve it, or
  - leave it unchanged if the user marked it `Accepted` or gave an explicit override.
- Treat `CRITICAL`, `MAJOR`, and `MINOR` findings as blocking unless the user marked them `Accepted`.
- Treat `INFO` findings as non-blocking unless the user explicitly asks to address them.
- After resolving a finding, update the workflow ledger:
  - change its state from `New` to `Resolved`
  - add a concise resolution summary
- Do not implement application source code or tests.
- Do not address findings from implementation or PR-review sections.

Output:
- summary of requirements artifacts changed
- findings resolved
- findings left open and why
