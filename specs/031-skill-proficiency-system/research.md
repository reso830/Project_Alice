# Research / Design Decisions: Skill Proficiency System

**Feature**: `031-skill-proficiency-system` · **Spec**: [spec.md](./spec.md)

Three decisions shaped the plan. Each records the options weighed and why.

## D1 — Editor: inline rows vs. keep the entry-overlay

**Context**: Today the Skills editor uses an "Add Skills" entry-overlay modal that stages string pills (`createEntryOverlay('Add Skills', …)` in [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js)). Each skill now needs a per-skill level.

- **Option A — inline rows with a per-row level picker** (chosen). Matches design doc §5; each row carries name + 1–5 picker + remove; an "Add skill" button appends an unrated row.
- Option B — keep the overlay, add a level control inside it. Rejected: levelling is a per-skill, frequently-revisited action; routing every rating through a modal is clumsy and diverges from the design.

**Consequence**: the largest single change in the feature, but it removes a modal and aligns the editor with the display. The overlay scaffolding for skills (`openSkillsOverlay`/`buildSkillsForm`) is retired.

## D2 — Where the proficiency scale lives

**Context**: The 1–5 scale (labels, and for the UI, colours + flavor) must stay consistent between the model (validation), the editor, and the display.

- **Option A — `SKILL_LEVELS` in [src/models/profile.js](../../src/models/profile.js)** (chosen), beside the existing language `PROFICIENCY_LEVELS` that the editor already imports. The model owns the valid range + labels; UI imports them.
- Option B — `shared/constants.js`. Rejected: that file is a thin status-config derivation shared with the server; the server needs none of the skill scale.
- Colours/flavor stay UI-side (CSS custom properties / a small client map) — presentation data the server should not carry.

**Consequence**: one import point for labels; no presentation data leaks into the server bundle.

## D3 — Level coercion vs. unrated semantics

**Context**: Several inputs "have no usable level": legacy strings, freshly added/imported skills, and malformed stored numbers. They must not be conflated (spec clarification 2026-05-31).

- **Chosen rule** (shape-based): bare **string** → `level: 2` (migration, Basic — never lock an existing user out of saving); object with **`null`** → preserved unrated (intentional, gates save); object with an **invalid number** → coerced to nearest 1–5 (malformed, not intentional).
- Rejected: a single uniform default for all three. It would either silently rate imported skills (violating "no auto-estimation") or block existing users from saving migrated data.

**Consequence**: `normaliseSkillEntry` branches on element shape; resume import emits `{ name, level: null }` so imports stay unrated. Fully covered by model unit tests.
