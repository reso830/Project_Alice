Create a technical plan for this Spec Kit feature.

Instructions:
- Read the spec before writing the plan.
- Use the design reference only if one is provided.
- Do not assume missing information.
- Do not implement code.
- Keep the plan practical and scoped to the feature.

Write or update:
- `plan.md` in the feature directory (`specs/###-name/`)
- Supporting artifacts by this heuristic: if the feature adds/changes data or has
  more than ~2 phases, produce `data-model.md`, `contracts/api.md`, `research.md`,
  `quickstart.md`, and `checklists/plan-review.md`. Trivial UI-only tweaks may skip
  these.

`checklists/plan-review.md` is a **pre-implementation plan-review gate** — it is read
and verified before any code is written. Scope its items to things checkable against
the plan itself: spec/plan scope alignment, architecture soundness, data-model risks,
contract correctness, test strategy, and constitution compliance. Do NOT include items
that can only be confirmed after implementation (e.g. "Release Prep done", "no remaining
imports of X", "grep confirms…", "full test suite passes") — those are post-implementation
verification and belong to the final review/verification step, not this checklist.

Include:
- architecture
- data flow
- affected components
- risks and tradeoffs
- validation approach

If the feature touches the data layer, address both persistence runtimes routed
through `createRepositories(config)`: **local** (SQLite) and **hosted** (Supabase).
A plan that handles only one is incomplete. Demo mode is not a separate
`createRepositories` runtime — it runs on the local path with seeded data and a demo
auth state; call it out only when the change affects it.

Add a constitution compliance note covering:
- required-field impact (company, job title, status, last_status_update, responsibilities)
- use of centralized, reusable validation rules
- justification for any new dependency (new dependencies require justification)

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
