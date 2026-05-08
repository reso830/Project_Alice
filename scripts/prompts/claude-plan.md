Create a technical plan for this Spec Kit feature.

Fill in before sending:
- Feature name:
- Feature directory:
- Spec path:
- Design reference path, if any:
- Workflow ledger path, if any:

Instructions:
- Read the spec before writing the plan.
- Use the design reference only if one is provided.
- Do not assume missing information.
- Do not implement code.
- Keep the plan practical and scoped to the feature.

Write or update:
- `plan.md` in the feature directory
- supporting artifacts only when useful, such as `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, or `checklists/`

Include:
- architecture
- data flow
- affected components
- risks and tradeoffs
- validation approach

Add this required section:

## Affected Areas

Include:
- files/components likely to be inspected
- files/components likely to be modified
- tests likely to be added or updated
- areas explicitly out of scope

Token/context discipline:
- Prefer precise affected areas over broad repo exploration.
- Do not list unrelated files just to be exhaustive.
- If uncertain, mark the area as "inspect only" rather than "modify".
