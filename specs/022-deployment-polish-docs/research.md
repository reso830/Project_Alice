# Research & Decisions: Deployment Polish & Docs

**Feature**: 022-deployment-polish-docs
**Date**: 2026-05-20
**Companion**: [plan.md](./plan.md)

This document captures the four planning-input decisions resolved
during the `/speckit.plan` clarification round, along with the
alternatives considered and the rationale for each pick. Spec [`spec.md`](./spec.md)
listed these in its **Open Questions** section.

---

## D1 — Hosted Smoke-Test Checklist file location

**Decision**: `docs/hosted-smoke-test.md` (flat file in `docs/`).

**Why**:
- Survives a future `docs/deployment.md` housekeeping/trim pass without
  losing the checklist.
- Linkable directly from PR descriptions as the captured run.
- The operator's stated docs-housekeeping plan rules out a new
  subdirectory under `docs/`.

**Alternatives considered**:
- `docs/checklists/hosted-smoke-test.md` — rejected. Adds a new
  subdirectory; conflicts with the housekeeping plan.
- Section in `docs/deployment.md` — rejected. Couples the smoke-test
  lifecycle to deployment-guide edits; harder to share standalone;
  may regress during the housekeeping trim.

**Implications**:
- `docs/REPO_MAP.md` gets one new row.
- README "Further Reading" gets one new link.
- `docs/deployment.md` cross-links to the standalone checklist but does
  not contain it.

---

## D2 — README scope

**Decision**: Refresh the existing **Hosted Mode (Supabase Authentication)**
section only. No new top-level Runtime Modes block; no separate "About
this build" / portfolio-framing section.

**Why**:
- Keeps the README close to its current shape; avoids reflowing the
  table of contents.
- The canonical operator guide is `docs/deployment.md`. Pointing
  newcomers at it from the existing section is sufficient.
- Portfolio framing is best carried by the docs *being well-organized*,
  not by a dedicated marketing section.

**Alternatives considered**:
- Add a top-level "Runtime Modes" block (local / hosted / demo, one
  paragraph each) — rejected. Duplicates the existing Hosted Mode
  section and the Local vs Hosted table in `docs/deployment.md`.
- Add a top-level "About this build" portfolio block — rejected.
  Out-of-scope tonal change; the spec brief asks for portfolio-ready
  *docs*, not new portfolio framing in the README.

**Implications**:
- The three runtime modes are described inside the refreshed Hosted
  Mode section, not as a separate block.
- Spec FR-001 is satisfied by the refresh (it asks for a section
  describing the three modes; it does not require a new top-level
  section).

---

## D3 — Smoke-test format

**Decision**: **Given / When / Then** per step.

**Why**:
- Matches the style of `specs/018-auth-user-access/quickstart.md §10`
  and the acceptance scenarios in `spec.md`.
- Unambiguous about preconditions, action, and expected outcome — the
  three things a reviewer needs.
- The checklist serves as both a *run-sheet* and a *contract*; Given/
  When/Then carries both meanings.

**Alternatives considered**:
- Numbered list with `[ ] Pass [ ] Fail` boxes per step — rejected for
  the spec contract role. Lighter to fill in, but loses the
  preconditions and expected-outcome framing.
- Hybrid (numbered steps with inline expected result) — rejected. The
  Given/When/Then form is the established project convention; a hybrid
  would introduce a third style.

**Implications**:
- `docs/hosted-smoke-test.md` body uses Given/When/Then bullet groups
  per step.
- A pass/fail capture for a specific run can still be added at the top
  of the file or in the PR body without breaking the Given/When/Then
  body.

---

## D4 — Version bump

**Decision**: **PATCH**: `0.11.0` → `0.11.1`.

**Why**:
- The constitution defines MAJOR as breaking data/schema changes,
  MINOR as new user-facing features (backwards-compatible), PATCH as
  bug fixes and minor polish.
- This feature ships no runtime change, no schema change, no new
  user-facing feature. Docs polish fits PATCH.

**Alternatives considered**:
- MINOR (`0.12.0`) — rejected. Would imply a new user-facing feature.
  The hosted experience is unchanged by this feature; only the
  operator-facing surface is.

**Implications**:
- `package.json#version` → `"0.11.1"`.
- `CHANGELOG.md` gets a `## [0.11.1] — <date>` entry (em-dash
  separator matching existing entries) with `### Docs` and
  `### Changed` groups.
- The in-app `APP_VERSION` literal at
  `src/pages/welcome/shared/appMeta.js:6` must also be bumped in
  lockstep — see D5 for the FR-009 carve-out that permits this
  single-line `src/` edit.

---

## D5 — `src/` carve-out for the in-app version display

**Decision**: FR-009's blanket prohibition on `src/` edits is narrowed
to permit a **single-line** update to the `APP_VERSION` literal at
[`src/pages/welcome/shared/appMeta.js:6`](../../src/pages/welcome/shared/appMeta.js#L6).
The carve-out is documented in spec FR-009 / SC-009 and is executed
by Task 05.1b in `tasks.md`.

**Why**:
- Constitution Amendment 1.3.0 mandates that every feature's Release
  Prep phase keep the in-app version display in sync with
  `package.json`. The constitution overrides convenience per its
  Governance clause.
- The in-app version display is hand-maintained as a literal — it
  does not read from `package.json` at build time. The current
  literal is consumed by `src/components/Footer.js:117` and
  `src/pages/welcome/WelcomePage.js:275`.
- Without the carve-out, FR-009 and the constitution conflict
  irreconcilably; the constitution wins, so FR-009 must adapt.

**Alternatives considered**:
- **Replace the literal with a build-time import from
  `package.json`** — rejected. That is runtime-touching code in a
  docs-only feature; would expand scope, require test updates, and
  belongs in a separate cleanup feature.
- **Skip the in-app display update; document the residual risk** —
  rejected. The constitution's mandate is explicit; documenting a
  skip would mean shipping with the welcome page reading `v0.11.0`
  while `package.json` reads `0.11.1`. Reviewers would see the
  mismatch immediately.
- **Keep FR-009 strict and let the constitution conflict stand** —
  rejected. The spec must be self-consistent before implementation.

**Implications**:
- Task 05.1 is paired with a new Task 05.1b that performs the
  literal bump.
- Task 04.4 (diff-scope guard) and Task 05.4 (docs sanity check) are
  updated to allow / verify the single-line `appMeta.js` change.
- The constitution carve-out is *single-line only*. Any other edit
  to `appMeta.js`, or any edit to any other `src/` file, remains a
  scope violation.

---

## D6 — Phase 06 scoped to a single footer version-display check; full Hosted Smoke-Test Checklist not validated by this feature

**Decision**: Phase 06 (Browser Smoke Test) is scoped to a single
~30-second task: open the deployed preview (or local `npm run dev`)
and confirm the footer / welcome-page version display reads
`v0.11.1`. The full `docs/hosted-smoke-test.md` shipped by Phase 03
is **not** executed against this feature's own merge — it ships as
a future-operator reference artifact. Previous-feature flows
(login, demo, CRUD, profile, authorization, resume import, mobile
layout) are unchanged by this feature and are not re-walked.

**Why**:
- The `APP_VERSION` literal is user-visible UI. Constitution
  Amendment 1.1.0 mandates a browser smoke test for features with
  user-facing UI changes; a full skip is hard to defend even though
  the change is trivial.
- Task 05.4's grep verifies the source literal (in `package.json`
  and `appMeta.js`) but **cannot** verify the rendered output. The
  Vite build chain, the DOM mount path in `Footer.js` /
  `WelcomePage.js:275`, and the production bundle inclusion all
  sit between source and what the user sees. A 30-second browser
  viewing covers what grep cannot — these are real failure modes
  for the cost of half a minute.
- Previous-feature flows are unchanged by this feature. Re-walking
  them adds no verification value because the runtime surface
  exercised by features 018–021 is byte-for-byte identical at
  merge. Calling that "validation" would be ceremony.
- The author of `docs/hosted-smoke-test.md` is the wrong person to
  validate it. They wrote it by referencing the same source of
  truth (the existing runtime). A one-operator dogfood pass
  post-merge catches no defects the author would not already have
  caught during authorship — it is verification theater. The
  checklist's real validation is the first time a **different**
  operator runs it, which happens organically the next time it is
  used for its intended purpose (pre-promotion verification of a
  future feature, or the first portfolio reviewer deploy).
- Solo-maintainer context: the project has one active operator.
  Pretending otherwise creates ceremony without rigor.

**Alternatives considered**:
- **Full Hosted Smoke-Test Checklist execution against the merge
  state** — rejected. One-operator dogfooding for an
  author-written checklist is low-value verification; re-walking
  the unchanged features 018–021 flows is unrelated to this
  feature's delta.
- **Skip Phase 06 entirely (full 021 precedent)** — rejected. The
  `APP_VERSION` literal IS a user-visible change, and the grep
  cannot verify rendered output. The constitution-defense argument
  for a full skip is weak; the cost of a 30-second browser viewing
  is trivial; the failure modes the browser check catches
  (build-chain break, bundle exclusion, broken import) are real.
- **Strict constitutional reading: walk every spec User Story's
  Independent Test in the browser** — rejected. The spec's User
  Stories describe future-operator behavior (running the new
  checklist against a fresh deploy); they are not surfaces this
  feature changes. Re-walking unchanged surfaces is not what
  Amendment 1.1.0 is asking for.

**Implications**:
- Spec FR-011 records the single-task scoping with the grep-vs-
  rendered-output rationale.
- Spec SC-011 rewritten in lockstep.
- Tasks Phase 06 contains exactly one task (06.1).
- The "defect-diagnosis escalation rule" from an earlier draft is
  removed — it existed to resolve a dogfood-loop ambiguity that no
  longer applies once Phase 06 is scoped this tightly.
- Plan risks table records "checklist not validated until first
  real use" as accepted residual risk.
- `docs/hosted-smoke-test.md` itself is unchanged in scope — it
  ships as a reference artifact for future operators.

---

## Other research

No external research was required. All decisions were informed by
existing artifacts in the repository:

- The constitution (`.specify/memory/constitution.md`) for the SemVer
  + Release Prep rules.
- `specs/017-hosted-foundation/` through `specs/021-hosted-resume-import-security/`
  for the per-feature context that the new docs will consolidate.
- `README.md`, `docs/deployment.md`, `docs/REPO_MAP.md`,
  `.env.example`, and `vercel.json` as the existing operator-facing
  surface that this feature polishes.

No new dependencies were evaluated. No new third-party docs were
referenced. Free-tier behavior descriptions (Vercel Hobby cold starts,
Supabase Free inactivity pauses) are widely-documented vendor
behaviors and will be summarized — not authoritatively redefined — in
the new sections, with links to vendor docs where the reviewer will
look for the authoritative current behavior.
