Create a technical plan for this feature.

Context:
Multi-step AI workflow. Do not assume missing info.
Speckit remains the source of truth for branch naming, feature directory naming, and generated artifacts.

Inputs:
- {{SPEC_DIR}}/spec.md
- {{DESIGN_DOC}}

Output:
- {{SPEC_DIR}}/plan.md
- Speckit-generated supporting files when applicable, such as research.md, data-model.md, quickstart.md, contracts/, and checklists/

Include:
- architecture
- data flow
- components
- risks and tradeoffs

Add this required section:

## Affected Areas

Include:
- files/components likely to be inspected
- files/components likely to be modified
- tests likely to be added or updated
- areas explicitly out of scope

Token/context discipline:
- Prefer precise affected areas over broad repo exploration
- Do not list unrelated files just to be exhaustive
- If uncertain, mark the area as "inspect only" rather than "modify"

Do not implement code.