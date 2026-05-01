Create phased implementation tasks.

Context:
Multi-step AI workflow. Do not assume missing info.

Inputs:
- specs/{{FEATURE_NAME}}/spec.md
- specs/{{FEATURE_NAME}}/plan.md

Output:
- specs/{{FEATURE_NAME}}/tasks.md

Requirements:
- Group by Phase (Phase 01, Phase 02, etc.)
- Each task must include:
  - target area
  - expected behavior
  - constraints
  - validation/test

Do not implement code.