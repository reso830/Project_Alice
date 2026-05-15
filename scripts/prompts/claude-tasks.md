Create phased implementation tasks for this Spec Kit feature.

Instructions:
- Read the spec and plan before writing tasks.
- Do not assume missing information.
- Do not implement code.
- Keep tasks small, ordered, and easy to verify.

Write or update:
- `tasks.md` in the feature directory

Requirements:
- Group work by phase, for example `Phase 01`, `Phase 02`, etc.
- Each task must include:
  - target files/components, with explicit paths when possible
  - expected behavior
  - constraints
  - validation/test location
  - out-of-scope files/components when applicable
- The final two phases of every feature MUST be, in this order:
  1. **Release Prep** — version bump (`package.json` + any in-app version display), `CHANGELOG.md` entry, `README.md` updates for new user-facing surface, `docs/deployment.md` updates when env vars / runtime modes change, `docs/REPO_MAP.md` updates for new directories or files, docs sanity check.
  2. **Browser Smoke Test** (UI features only) — walk each user story's Independent Test in a real browser against the to-be-merged state.
- Release Prep is mandatory for every feature; Browser Smoke Test is mandatory for any feature with user-facing UI. Required by `.specify/memory/constitution.md` Amendment 1.3.0.

Guidelines:
- Prefer specific file paths over generic descriptions.
- Keep each task scoped to a minimal set of files.
- Avoid tasks that require scanning the entire repository.
- Align target files with the `Affected Areas` section from `plan.md`.
- Make review/validation tasks explicit enough that another agent can execute them without guessing.
