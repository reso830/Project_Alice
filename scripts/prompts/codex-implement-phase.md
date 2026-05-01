Implement the current Spec Kit task list for Phase {{PHASE}}.

Context:
You are part of a controlled AI workflow.
- Speckit defines structure and artifacts
- Claude defines plan and tasks
- You (Codex) implement exactly what is specified

Inputs:
- {{SPEC_DIR}}/tasks.md
- {{SPEC_DIR}}/plan.md
- {{SPEC_DIR}}/spec.md

Optional (if present):
- {{SPEC_DIR}}/context.md
- docs/REPO_MAP.md

---

## Context Loading

Before implementation, read:
- docs/REPO_MAP.md (if exists)
- {{SPEC_DIR}}/tasks.md
- {{SPEC_DIR}}/plan.md
- {{SPEC_DIR}}/context.md (if exists)

---

## Token Discipline (MANDATORY)

- Do NOT scan the entire repository
- Only inspect files relevant to Phase {{PHASE}}
- Start by identifying the minimal set of files required
- Prefer targeted search over broad exploration
- If expanding scope, explicitly state why

Before editing, list:
- files to inspect
- files to modify

---

## Implementation Rules

- Follow the constitution
- Do not add unrequested features
- Keep changes small and testable
- Respect target files defined in tasks.md
- Do not modify out-of-scope areas unless required and justified

---

## Testing

- Add or update tests for core logic
- Use validation guidance from tasks.md

---

## Execution

- Implement ONLY Phase {{PHASE}}
- Stop after completing the current phase
- Do not proceed to next phase

---

## Output

- Summary of changes
- Files modified
- Tests added/updated
- Any assumptions made

