# Implementation Plan: Deployment Polish & Docs

**Branch**: `022-deployment-polish-docs` | **Date**: 2026-05-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-deployment-polish-docs/spec.md`

---

## Summary

Consolidate and polish the operator-facing surface so a fresh reviewer can
deploy, verify, and demo the hosted Project Alice experience using only
`README.md` + `docs/deployment.md` + a new `docs/hosted-smoke-test.md`,
without spelunking through per-feature spec directories.

This is a **documentation-only feature** with one constitution-mandated
exception: the in-app `APP_VERSION` literal in
[`src/pages/welcome/shared/appMeta.js`](../../src/pages/welcome/shared/appMeta.js)
must be bumped in sync with `package.json` (constitution Amendment
1.3.0). No other source code, schema, env vars, endpoints, or
dependencies change. Per FR-009 / SC-009, the merge diff is bounded
to `README.md`, `CHANGELOG.md`, `package.json`,
`src/pages/welcome/shared/appMeta.js` (one literal),
`docs/**`, and `specs/022-deployment-polish-docs/**`.

---

## Technical Context

**Language/Version**: Markdown (CommonMark). No code.
**Primary Dependencies**: None added. Existing `.env.example`, `vercel.json`,
`package.json`, and per-feature spec files are referenced from the new docs.
**Storage**: N/A — no data model changes.
**Testing**: Manual link-check + a single-task Browser Smoke Test
on the footer / welcome version display (the only UI surface this
feature changes). The new `docs/hosted-smoke-test.md` is shipped as
a future-operator reference artifact and is NOT executed by this
feature's own verification (research.md D6). No new automated tests
introduced; existing unit/integration test suites are unaffected.
**Target Platform**: GitHub-rendered Markdown + the operator-facing
documentation surface.
**Project Type**: Documentation feature inside an existing Vite + Express
+ optional Supabase application.
**Performance Goals**: N/A.
**Constraints**:
- No source-code changes (FR-009).
- New docs must remain in sync with the existing artifacts they
  reference (`.env.example`, `vercel.json`, per-feature quickstarts).
- Free-tier framing must be realistic — Vercel Hobby + Supabase Free.
**Scale/Scope**: Estimated diff: ~1 file refresh (`README.md`), ~5 new
or expanded sections in `docs/deployment.md`, 1 new file
(`docs/hosted-smoke-test.md`), 1 new entry in `docs/REPO_MAP.md`, 1
`CHANGELOG.md` entry, 1 `package.json` version bump.

---

## Architecture

Documentation-only feature. No runtime architecture changes. The
architectural decision is the **information architecture** across three
docs:

```
README.md                      ← entry point; orients newcomers
  │
  ├─ Hosted Mode (refreshed)   ← one paragraph each on local/hosted/demo;
  │   points at docs/deployment.md as the canonical operator guide
  │
  └─ Further Reading           ← link to docs/hosted-smoke-test.md added
       (existing block)

docs/deployment.md             ← canonical operator guide
  ├─ existing sections preserved (Overview, Local Dev, Supabase Project
  │   Setup, Hosted Mode Deployment, Vercel Project Setup, Env Var
  │   Reference, Local vs Hosted Differences, Architecture Overview)
  │
  ├─ Environment Variable Checklist (NEW, FR-002)
  │   required vs optional, server-only vs client-safe, secrets
  │   handling, copy-pasteable example
  │
  ├─ Supabase Setup Checklist (NEW, FR-003)
  │   ordered procedure consolidating 018 + 019 quickstarts; runnable
  │   from a fresh Supabase project; per-feature spec links retained
  │   as deep-dive pointers
  │
  ├─ Demo & Free-Tier Notes (NEW, FR-004)
  │   Vercel Hobby cold starts, Supabase Free inactivity behavior,
  │   demo-mode reset semantics, portfolio-visitor framing
  │
  └─ Migration Clarification (NEW, FR-005)
      explicit: local SQLite does not migrate; hosted starts seeded;
      end-to-end migration tooling is future work

docs/hosted-smoke-test.md      ← NEW, FR-006
  standalone checklist, Given/When/Then per step, covering:
    1. Login flow (allowlisted email sign-up + sign-in)
    2. Demo flow (Try the demo CTA, in-memory CRUD reset)
    3. Application CRUD (create, edit, archive)
    4. Profile editing (one section, sticky save/cancel, discard guard)
    5. Authorization (user A cannot read user B)
    6. Resume import restrictions (demo-hidden, hosted-allowed)
    7. Mobile layout sanity (375px viewport)

docs/REPO_MAP.md               ← UPDATE
  add docs/hosted-smoke-test.md row

CHANGELOG.md                   ← UPDATE
  ## [0.11.1] - 2026-MM-DD entry

package.json                   ← UPDATE
  "version": "0.11.0" → "0.11.1"
```

**No new subdirectory under `docs/`** — per operator guidance, the
ongoing docs housekeeping plan keeps `docs/` flat.

---

## Data Flow

N/A. No runtime data is created, transformed, or persisted by this
feature. All artifacts are static Markdown rendered by GitHub and read
by operators.

---

## Decisions (from clarification)

| Decision | Resolution |
|---|---|
| Smoke-test checklist file location | `docs/hosted-smoke-test.md` (flat, no subdirectory) |
| README scope | Refresh existing **Hosted Mode** section only; no new top-level Runtime Modes or "About this build" blocks |
| Smoke-test format | **Given / When / Then** per step (matches `specs/018-auth-user-access/quickstart.md §10` and spec.md acceptance scenarios) |
| Version bump | **PATCH**: `0.11.0` → `0.11.1` (docs-only, no runtime / schema change) |

Rationale and rejected alternatives captured in [`research.md`](./research.md).

---

## Affected Areas

### Files / components likely to be **modified**

- `README.md` — refresh the existing "Hosted Mode (Supabase
  Authentication)" section: tighten language, clarify the three runtime
  modes (local / hosted / demo) inside the existing section, point
  readers at `docs/deployment.md` as the canonical operator guide, add
  `docs/hosted-smoke-test.md` to the "Further Reading" list.
- `docs/deployment.md` — append four new sections (Environment Variable
  Checklist, Supabase Setup Checklist, Demo & Free-Tier Notes,
  Migration Clarification). Keep the existing Environment Variable
  Reference table; the new Checklist complements it with a deployer's
  pass/fail framing rather than replacing it.
- `docs/REPO_MAP.md` — add a row for `docs/hosted-smoke-test.md`.
- `CHANGELOG.md` — add `## [0.11.1] - <date>` section with `### Docs`
  entries.
- `package.json` — bump `version` to `0.11.1`.
- `src/pages/welcome/shared/appMeta.js` — bump the `APP_VERSION`
  literal from `'v0.11.0'` to `'v0.11.1'`. Single-line edit on
  line 6. Mandated by constitution Amendment 1.3.0 (in-app version
  display must stay in sync with `package.json`). This is the only
  permitted `src/` change in the feature.

### Files / components likely to be **created**

- `docs/hosted-smoke-test.md` — the standalone Hosted Smoke-Test
  Checklist (FR-006). Given/When/Then per step, seven sections per the
  brief.
- `specs/022-deployment-polish-docs/plan.md` — this file.
- `specs/022-deployment-polish-docs/research.md` — captures the four
  clarification decisions above.
- `specs/022-deployment-polish-docs/checklists/plan-review.md` — the
  Constitution Check + review-gate checklist.

### Files / components likely to be **inspected only**

- `.env.example` — to confirm the Environment Variable Checklist names
  and ordering align (SC-002). No edits.
- `vercel.json` — to confirm the example reflects current build /
  rewrite config. No edits.
- `specs/018-auth-user-access/quickstart.md` — to consolidate the
  allowlist + trigger steps into the Supabase Setup Checklist; original
  preserved as a deep-dive link.
- `specs/019-supabase-persistence/data-model.md §5` — to consolidate
  the schema migration block into the Supabase Setup Checklist;
  original preserved as a deep-dive link.
- `specs/020-portfolio-demo-mode/spec.md` — to confirm the demo-mode
  reset semantics description in Free-Tier Notes is accurate.
- `specs/021-hosted-resume-import-security/contracts/api.md` — to
  confirm the resume-import smoke step matches documented behavior.
- `server/health.js` — to confirm the boot-time schema-check log line
  referenced in the edge-cases section (spec.md) matches what the
  server actually logs.

### Tests likely to be added or updated

- **No automated tests added.** Per FR-009 / SC-009, the only code
  change is a single version literal in `appMeta.js`.
- **Manual verification**: a single-task Browser Smoke Test on the
  footer / welcome version display (FR-011 / SC-011). Task 05.4's
  grep covers the source literal; Phase 06's browser viewing covers
  the rendered output. The new `docs/hosted-smoke-test.md` is NOT
  walked against this feature's merge — it ships as a
  future-operator reference artifact (research.md D6).

### Out of scope

- All paths under `server/`, `api/`, `shared/`, `tests/`, `scripts/`.
  All `src/` paths except the single `APP_VERSION` literal on
  [`src/pages/welcome/shared/appMeta.js:6`](../../src/pages/welcome/shared/appMeta.js#L6).
  The literal change is mandated by the constitution's Release Prep
  rule and is the only `src/` carve-out (FR-009).
- `vite.config.js`, `package-lock.json` (other than what `npm version`
  auto-touches if used; otherwise hand-edit the version string in
  `package.json` only).
- Per-feature `specs/018…021/` content. These are referenced by the new
  docs but not edited.
- A new `contracts/api.md` for feature 022. The endpoint contracts
  documented by features 017–021 remain canonical.
- A new `data-model.md` for feature 022. No data model exists or
  changes.
- A new `quickstart.md` for feature 022 inside `specs/022-…/`. This
  feature's *output* is the operator-facing docs in `docs/` and
  `README.md`; a separate spec-internal quickstart would duplicate
  them.

---

## Risks and Tradeoffs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Docs drift: a future feature changes runtime behavior without updating these new sections | Medium | Medium — reviewers see stale instructions | The constitution's Release Prep phase (Amendment 1.3.0) is the durable mechanism. Plan-review checklist explicitly calls this out. |
| `.env.example` and Env Var Checklist drift apart | Low–Medium | Medium — operator confusion | SC-002 makes alignment a success criterion. Plan-review checklist requires a side-by-side diff before merge. |
| Smoke-test checklist documents behavior that doesn't match production | Low–Medium | Medium — first real user hits a false step | **Accepted residual risk.** The checklist is not validated by this feature (research.md D6); one-operator dogfooding against the same source of truth catches nothing. The first different-operator run is the real validation. Mitigation: write the checklist conservatively, prefer linking per-feature contracts over restating, and treat any future-operator-reported defect as a fast-follow doc patch. |
| Consolidated Supabase Setup Checklist loses fidelity vs. per-feature quickstarts | Medium | Medium — operator misses a step | Per-feature quickstarts (`specs/018…021/quickstart.md`) are linked inline as deep-dive references; the checklist is "the steps to run," the linked specs are "the rationale." |
| Free-tier framing becomes outdated when Vercel / Supabase change pricing | Medium | Low — text-only fix | The sections name tiers explicitly (Vercel Hobby, Supabase Free) so future drift is easy to grep for. |
| Reviewer interprets PATCH bump as "this feature has no user-facing value" | Low | Low | CHANGELOG entry frames the consolidation explicitly. SemVer-by-rule is the right call per the constitution; the value is real but not new runtime surface. |
| Markdown rendering differences (GitHub vs. local preview) | Low | Low | Use the same Markdown dialect (CommonMark + GitHub tables) already used across `docs/`. |
| Operator follows the new checklist on a paid Supabase tier and free-tier notes look out of place | Low | Low | Free-tier notes are scoped to a labeled section; paid-tier operators can skim past. |

**Tradeoff: consolidation vs. duplication.** The Supabase Setup
Checklist and Environment Variable Checklist intentionally duplicate
content from per-feature quickstarts and from the existing
Environment Variable Reference table in `docs/deployment.md`. This is
deliberate: the existing references serve "look up one fact"; the new
checklists serve "walk a fresh setup top-to-bottom." Keeping both
shapes is justified because the audience differs.

**Tradeoff: standalone smoke-test file vs. section in
`deployment.md`.** Standalone wins because (a) it can be linked from
PR descriptions as the captured run, and (b) it survives a future
deployment.md trim. Cost: one more file in `docs/`. Mitigated by
keeping `docs/` flat (no new subdirectory).

**Tradeoff: README scope.** Refreshing the existing section (instead
of adding new top-level blocks) keeps the README close to its current
shape and avoids reflowing the table of contents. Cost: the three
runtime modes are mentioned inside Hosted Mode rather than called out
at the top. The canonical operator guide is `docs/deployment.md`
anyway.

---

## Validation Approach

### Spec-level validation (does the spec hold?)

- Constitution Check section below.
- Plan-review checklist at
  [`checklists/plan-review.md`](./checklists/plan-review.md).

### Implementation-level validation (does the implementation match the spec?)

- **Link check**: every relative link added by this feature must
  resolve to a file that exists in the same commit (FR-010 / SC-010).
  Verified by `git grep` for `](` patterns in new content + manual
  click-through.
- **`.env.example` ↔ Env Var Checklist alignment**: SC-002. Verified
  by side-by-side diff during the Release Prep phase.
- **Supabase Setup Checklist completeness**: SC-003. Verified by
  cross-referencing the artifacts named in
  `specs/018-auth-user-access/data-model.md`,
  `specs/019-supabase-persistence/data-model.md §5`, and the
  `auth.users` trigger contract.
- **Diff-scope guard**: `git diff main...HEAD --stat` must show changes
  only in `README.md`, `CHANGELOG.md`, `package.json`,
  `src/pages/welcome/shared/appMeta.js` (one-line `APP_VERSION`
  bump), `docs/**`, and `specs/022-deployment-polish-docs/**`
  (SC-009).
- **Version bump verifiability**: `package.json` version reads
  `0.11.1`; `CHANGELOG.md` has a `[0.11.1]` heading; the two match.

### Release Prep phase (constitution Amendment 1.3.0)

- Version bump to `0.11.1` in `package.json`.
- `CHANGELOG.md` entry under `[0.11.1]`.
- README refresh per FR-001.
- `docs/deployment.md` updates per FR-002 / FR-003 / FR-004 / FR-005.
- `docs/REPO_MAP.md` adds `docs/hosted-smoke-test.md`.

### Browser Smoke Test phase (constitution Amendment 1.1.0)

This feature's only UI surface change is the `APP_VERSION` literal
bump (D5), which renders in the footer and on the welcome page.
Amendment 1.1.0 applies because that literal is a user-visible UI
surface, even if trivial. Phase 06 is therefore scoped to a single
~30-second task: open the deployed preview (or local `npm run dev`
against the merge-target branch) and confirm the footer reads
`v0.11.1`.

This is a deliberately tighter scope than the constitution's
default mandate of "walk each user story's Independent Test." The
spec's User Stories describe **future-operator** behavior (running
the new checklist against a fresh deploy); previous-feature flows
(login, demo, CRUD, profile, authorization, resume import, mobile
layout) are unchanged by this feature and re-walking them adds no
verification value. The new Hosted Smoke-Test Checklist
(`docs/hosted-smoke-test.md`) is shipped as a **future-operator
reference artifact** — its real validation happens the first time
a different operator runs it for its intended purpose, not when
its author re-walks it on their own merge.

Why a browser check and not just Task 05.4's grep: grep proves the
source literal is correct; it does not prove the rendered output is
correct. The Vite build chain, the DOM mount path in `Footer.js` /
`WelcomePage.js`, and the production bundle inclusion all sit
between the source literal and what the user sees. A 30-second
browser viewing covers what grep cannot. Decision documented in
[`research.md`](./research.md) D6.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
|---|---|---|
| I. User-First Application Tracking — required fields, status vocabulary | **N/A** | No data model touched. |
| II. Simple, Maintainable Web Architecture — separation of concerns, no unnecessary deps | **Pass** | No new dependencies. Documentation only. |
| III. Data Integrity and Validation | **N/A** | No validation surface touched. |
| IV. Practical User Experience — labeled forms, keyboard nav, non-color-only status | **N/A — for runtime** | Documentation surface only. The smoke-test checklist *includes* a 375px mobile sanity step that exercises these requirements against the runtime. |
| V. Testing and Quality Gates — automated tests + Release Prep + Browser Smoke Test | **Pass** | No new automated tests required (only a one-line version literal changes). Release Prep is mandatory and runs as Phase 05. Browser Smoke Test (Phase 06) is scoped to a single footer/welcome version-display check — the only UI surface this feature changes; Task 05.4's grep verifies the source literal, the browser viewing verifies the rendered output. Previous-feature flows are unchanged and not re-walked (research.md D6). |
| Privacy, Accessibility, Extensibility | **Pass** | No analytics, no third-party sharing introduced. Free-tier notes and demo behavior are documented consistent with the constitution's no-external-sharing stance. |

**No constitution violations.** Complexity Tracking table below is
empty by intention.

---

## Project Structure

### Documentation (this feature)

```text
specs/022-deployment-polish-docs/
├── spec.md                          # /speckit.specify output (existing)
├── plan.md                          # this file
├── research.md                      # clarification decisions
└── checklists/
    └── plan-review.md               # review gate
```

**Supporting artifacts intentionally omitted** (with rationale):

- `data-model.md` — no data model exists or changes for this feature.
- `contracts/api.md` — no endpoints are added or changed; existing
  per-feature contracts (017–021) remain canonical.
- `quickstart.md` — this feature's output IS the operator quickstart
  surface (`docs/deployment.md` + `README.md` + `docs/hosted-smoke-test.md`).
  A separate spec-internal quickstart would duplicate them.

### Source Code (repository root)

No source code is produced or modified by this feature. The relevant
"source" is the documentation tree:

```text
README.md                             # refreshed (Hosted Mode section)
CHANGELOG.md                          # appended ([0.11.1] entry)
package.json                          # version bumped (0.11.0 → 0.11.1)
src/pages/welcome/shared/appMeta.js   # APP_VERSION literal bumped
.env.example                          # INSPECT ONLY (reference)
docs/
├── AI_WORKFLOW_GUIDE.md              # unchanged
├── REPO_MAP.md                       # appended (hosted-smoke-test.md row)
├── deployment.md                     # extended (4 new sections)
└── hosted-smoke-test.md              # NEW (smoke-test checklist)
```

**Structure Decision**: Documentation-only feature; the structure
above is the entirety of the working set.

---

## Complexity Tracking

> No Constitution Check violations. Table empty by intention.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(none)_ | _(n/a)_ | _(n/a)_ |
