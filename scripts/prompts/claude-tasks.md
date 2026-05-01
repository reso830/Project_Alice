Create phased implementation tasks.

Context:
Multi-step AI workflow. Do not assume missing info.
Speckit remains the source of truth for artifacts.

Inputs:
- {{SPEC_DIR}}/spec.md
- {{SPEC_DIR}}/plan.md

Output:
- {{SPEC_DIR}}/tasks.md

Requirements:
- Group by Phase (Phase 01, Phase 02, etc.)
- Each task must include:
  - target files/components (explicit paths when possible)
  - expected behavior
  - constraints
  - validation/test (file or test location)
  - out-of-scope files/components (when applicable)

Guidelines:
- Prefer specific file paths over generic descriptions
- Keep each task small and scoped to a minimal set of files
- Avoid tasks that require scanning the entire repository
- Align target files with the "Affected Areas" section from plan.md

Do not implement code.