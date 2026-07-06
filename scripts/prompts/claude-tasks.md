Create phased implementation tasks for this Spec Kit feature.

Instructions:
- Read the spec and plan before writing tasks.
- Do not assume missing information.
- Do not implement code.
- Keep tasks small, ordered, and easy to verify.

Write or update:
- `tasks.md` in the feature directory (`specs/###-name/`)

Open `tasks.md` with a conventions header (match recent tasks files in `specs/`):
- status legend: `[x]` done · `[ ]` pending · `[~]` skipped
- the `[P]` marker for tasks that can run in parallel (different files, no shared edits)
- the phase-dependency line (e.g. `01 → 02 → 03`)
- the commands: `npm run test:run`, `npm run lint`
- a **phase summary table** immediately after the header (before Phase 01), giving a
  scannable overview — one row per phase with: phase number, short focus/name, task ID
  range (e.g. `T001–T004`), and the user stories it covers (or `—` for non-story phases
  like Release Prep). Keep it consistent with the detailed phases below it.

Requirements:
- Group work by phase, for example `Phase 01`, `Phase 02`, etc.
- Order phases additively so the test suite passes after every phase, not just at the
  end — nothing should be left broken at a phase boundary.
- Each task must include:
  - target files/components, with explicit paths when possible
  - expected behavior
  - constraints
  - validation/test location
  - out-of-scope files/components when applicable
- For any validation logic, include explicit test tasks covering the constitution's
  required areas: status transitions, required-field enforcement, URL validation, and
  date handling.
- If `plan.md`'s Visual-Fidelity Mode is `Visual-fidelity` or `Mixed`, visual tasks in
  the affected phases MUST use the **Visual-Fidelity Task Pattern** from
  `.specify/templates/tasks-template.md` in place of generic target/expected-behavior
  prose (constitution Amendment 1.6.0 — the Design Fidelity gate exists because
  paraphrasing a design handoff into prose loses the pixel/motion fidelity that IS the
  requirement). Concretely:
  - One scene/component per task — never bundle several visual elements into one task.
  - Each visual task's "expected behavior" is replaced by: **Match**
    `<prototype file>#<section or Lnn-Lnn>` (reference the canonical source directly;
    never paraphrase its pixels, colors, or motion into prose), declared
    breakpoints/checkpoints, a translation note for cross-stack ports (lift the
    prototype's stylesheet/tokens wholesale and replicate its DOM element-for-element —
    do not restructure), and a provenance tag per style block (`lifted from prototype
    CSS` or `recreated manually`, with a reason if recreated).
  - Add a Foundational-phase task to stand up the `npm run test:visual` Tier-1 harness
    if it does not already exist in this project (reused across features once built).
  - Each visual task's "Done when" is: Tier 1 (`test:visual` geometry) green at every
    breakpoint AND Tier 2 frozen-state screenshots reviewed against the prototype.
  - Only add the conditional deviation-ledger / `visual-artifacts.md` manifest tasks
    when actually triggered (a real accepted deviation, or a Tier 2 handoff between
    agents) — do not create them speculatively.
  - This pattern applies at full strength even for a small visual tweak — only the
    harness setup and the conditional artifacts scale down, never the source-reference
    or Tier 2 review requirement.
- The final two phases of every feature MUST be, in this order:
  1. **Release Prep** — version bump (`package.json` **and** `package-lock.json` root
     `version`, plus any in-app version display), `CHANGELOG.md` entry, tick the
     feature's row in `docs/feature_roadmap.md`, `README.md` updates for new
     user-facing surface, `docs/deployment.md` updates when env vars / runtime modes
     change, `docs/REPO_MAP.md` updates for new directories or files, docs sanity check.
  2. **Browser Smoke Test** (UI features only) — walk each user story's Independent Test
     in a real browser against the to-be-merged state. Ordered AFTER Release Prep so it
     exercises the actual merge state.
- Release Prep is mandatory for every feature; Browser Smoke Test is mandatory for any
  feature with user-facing UI. Required by `.specify/memory/constitution.md` Amendment 1.3.0.

Guidelines:
- Prefer specific file paths over generic descriptions.
- Keep each task scoped to a minimal set of files.
- Avoid tasks that require scanning the entire repository.
- Align target files with the `Affected Areas` section from `plan.md`.
- Make review/validation tasks explicit enough that another agent can execute them without guessing.
