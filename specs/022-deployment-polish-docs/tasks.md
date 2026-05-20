# Tasks: Deployment Polish & Docs (022)

**Spec**: [`specs/022-deployment-polish-docs/spec.md`](spec.md)
**Plan**: [`specs/022-deployment-polish-docs/plan.md`](plan.md)
**Research**: [`specs/022-deployment-polish-docs/research.md`](research.md)
**Branch**: `022-deployment-polish-docs`

This feature is **documentation-only** with one constitution-mandated
exception: the in-app `APP_VERSION` literal in
`src/pages/welcome/shared/appMeta.js` must be bumped in sync with
`package.json` per Amendment 1.3.0. Per FR-009 / SC-009 the merge
diff is bounded to `README.md`, `CHANGELOG.md`, `package.json`,
`src/pages/welcome/shared/appMeta.js` (one literal),
`docs/**`, and `specs/022-deployment-polish-docs/**`. No file under
`server/`, `api/`, `shared/`, `tests/`, or `scripts/` is modified, and
no `src/` path other than `appMeta.js` is touched.

---

## Phase Map

| Phase | Theme | Touches | Blocks | Status |
|---|---|---|---|---|
| 01 | Refresh `README.md` "Hosted Mode" section (FR-001) | `README.md` | 05 (Release Prep), 06 (Smoke Test) | [X] |
| 02 | Expand `docs/deployment.md` with four new sections (FR-002 / FR-003 / FR-004 / FR-005) | `docs/deployment.md` | 05, 06 | [X] |
| 03 | Create `docs/hosted-smoke-test.md` (FR-006) | `docs/hosted-smoke-test.md` (new) | 04, 05, 06 | [X] |
| 04 | Review-gate verification (link check, `.env.example` alignment, consolidation fidelity, diff-scope guard) | inspect-only | 05 | [X] |
| 05 | **Release Prep** — version bump (`0.11.0 → 0.11.1`) in `package.json` + `src/pages/welcome/shared/appMeta.js` + `README.md` Current-version line, `CHANGELOG.md`, `docs/REPO_MAP.md`, docs sanity check (FR-007 / FR-008) | `package.json`, `src/pages/welcome/shared/appMeta.js`, `README.md`, `CHANGELOG.md`, `docs/REPO_MAP.md` | 06 | [X] |
| 06 | **Browser Smoke Test** — single-task footer/welcome version-display check (`v0.11.1`); previous-feature flows unchanged and not re-walked; `docs/hosted-smoke-test.md` ships as future-operator artifact (FR-011 / research.md D6) | runtime verification only | merge | [X] |

**Parallelism**: Phases 01, 02, and 03 touch independent files and may
be executed in parallel by separate agents/sessions. Phase 04 depends
on all three. Phase 05 must run after Phase 04 (review must pass
before Release Prep lands the version bump). Phase 06 is the final
phase — it walks the to-be-merged state per constitution Amendment
1.3.0.

**Constitution coverage**: Release Prep (Phase 05) is mandatory per
Amendment 1.3.0. Browser Smoke Test (Phase 06) is scoped to a
single task on the only UI surface this feature changes — the
footer / welcome-page version display. Amendment 1.1.0 applies
because `APP_VERSION` is user-visible. Task 05.4's grep verifies
the source literal but cannot verify rendered output (build chain,
DOM mount, bundle inclusion); a 30-second browser viewing covers
that gap. Previous-feature flows are unchanged by this feature and
not re-walked; the new `docs/hosted-smoke-test.md` is a
future-operator reference artifact, not validated by this feature
(research.md D6).

---

## Phase 01 — Refresh README "Hosted Mode" section  [X]

Implements **FR-001**. Scope is the existing
[Hosted Mode (Supabase Authentication)](../../README.md#hosted-mode-supabase-authentication)
section only — no new top-level blocks (per decision D2 in
[research.md](research.md)).

### Task 01.1 — Refresh `README.md` Hosted Mode section  [X]

**Target file**: `README.md`

**Edit scope**: lines covering the existing `## Hosted Mode (Supabase
Authentication)` section through the end of `### Defense in Depth:
Build + Runtime Handshake`. Adjacent sections (`## Features`,
`## Available Scripts`, `## Further Reading`) are inspect-only EXCEPT
for one bullet add in `## Features` and one link add in
`## Further Reading` per below.

**What to do**:

1. Inside the refreshed Hosted Mode section, add a short intro paragraph
   that names the three runtime modes — local, hosted, demo — with one
   sentence each. Do not duplicate the Local vs Hosted table in
   `docs/deployment.md`; refer readers to it for the full comparison.
2. Tighten the existing Required Environment Variables paragraph: keep
   the table, but add a single-line pointer to the new
   "Environment Variable Checklist" section in `docs/deployment.md`
   (Phase 02 will create the target; use the anchor
   `docs/deployment.md#environment-variable-checklist`).
3. Tighten the existing Allowlist Model paragraph: keep the operator
   pointer to `specs/018-auth-user-access/quickstart.md`; add a
   single-line pointer to the new "Supabase Setup Checklist" section
   in `docs/deployment.md` (anchor
   `docs/deployment.md#supabase-setup-checklist`) as the
   consolidated entry point.
4. Add one line to the `## Further Reading` list pointing at the new
   `docs/hosted-smoke-test.md` (Phase 03 will create the target).
5. **Leave** the `Current version` line near the bottom (currently
   reads `Current version: **0.11.0** — see [CHANGELOG.md](CHANGELOG.md)`)
   untouched in this phase — Task 05.1c bumps it as part of the
   Release Prep version-bump group so all three version surfaces
   (`package.json`, `appMeta.js`, README line) move together.

**Constraints**:

- **No new top-level sections.** Per D2, the three modes are mentioned
  inside the refreshed Hosted Mode section, not as a separate
  Runtime Modes block.
- **No new "About this build" / portfolio block.** Per D2.
- **Do not edit** `## Features`, `## Tech Stack`, `## Getting Started`,
  `## Available Scripts`, `## Demo Data`, `## Continuous Integration`,
  `## Project Structure`, `## Versioning`, `## Development Workflow`.
- The bullet currently in `## Features` covering "Portfolio demo mode"
  (line 21) is canonical; do not rewrite it.

**Validation**:

- Open `README.md` in a Markdown preview; confirm the refreshed section
  renders cleanly and the new anchors will resolve once Phases 02 and
  03 land.
- Phase 04 task 04.1 (link check) will catch unresolved anchors at
  review time.

**Out of scope**: every file outside `README.md`.

---

## Phase 02 — Expand `docs/deployment.md`  [X]

Implements **FR-002**, **FR-003**, **FR-004**, **FR-005**. Adds four
new sections to the existing canonical operator guide. Existing
sections are preserved verbatim except for one anchor target added
to the existing "Environment Variable Reference" header (Task 02.5).

All four tasks below touch the same file, so they execute
sequentially even though they cover independent sections. Suggested
insertion order documented per-task.

### Task 02.1 — Add "Environment Variable Checklist" section  [X]

**Target file**: `docs/deployment.md`

**Insertion point**: Immediately AFTER the existing
`## Environment Variable Reference` section (currently around line 257)
and BEFORE the existing `## Local vs Hosted Differences` section.

**Heading**: `## Environment Variable Checklist`

**What to do**:

1. Open the section with one sentence framing the audience: a
   first-time deployer who wants to confirm they have set every
   variable they need.
2. Add three subsections:
   - `### Required for hosted mode` — list every var marked
     `Hosted required: yes` in the existing Reference table. For each:
     name, scope (server / client / both), secret? (yes / no),
     one-line purpose, and a `[ ]` checkbox.
   - `### Optional` — list `PORT`, `ALICE_DB_PATH` with the same
     row shape; checkboxes optional, mark as "Optional" inline.
   - `### Local-only` — note that **no env vars are required for local
     mode**; the optional `PORT` and `ALICE_DB_PATH` apply in local
     too. Confirm this matches the existing Reference table.
3. Add a copy-pasteable example block (fenced ` ```dotenv ` or
   ` ```ini `) showing the hosted-mode `.env.local` shape. Use the
   placeholder values from `.env.example` verbatim — do not invent
   new placeholder strings.
4. Add a "Secrets handling" callout listing three rules drawn from
   the existing security note at line 102 of `docs/deployment.md`
   and the warning in `.env.example` line 29:
   - `SUPABASE_SERVICE_ROLE_KEY` is server-only; never prefix with
     `VITE_`.
   - Empty string is treated as absent (matches existing
     deployment.md note line 252).
   - `VITE_*` values are inlined into the public bundle; never put a
     secret behind that prefix.
5. Close the section with a single-line pointer to the existing
   Reference table above for "look up one variable" usage.

**Constraints**:

- **No new variable names introduced.** Every var in the checklist
  must appear in `.env.example`. SC-002 is a strict alignment
  requirement.
- **No edits to the existing Reference table.** Both the table and
  the new Checklist coexist (plan.md "Tradeoff: consolidation vs.
  duplication").
- Anchor `#environment-variable-checklist` must resolve from the
  README refresh added in Task 01.1.

**Validation**: Phase 04 task 04.2 cross-checks the section's
variables against `.env.example`.

---

### Task 02.2 — Add "Supabase Setup Checklist" section  [X]

**Target file**: `docs/deployment.md`

**Insertion point**: Immediately AFTER the existing
`## Supabase Project Setup` section (currently around line 91 onward,
ending at the security-note callout near line 116) and BEFORE the
existing `## Hosted Mode Deployment` section.

**Heading**: `## Supabase Setup Checklist`

**What to do**:

1. One-sentence framing: "Run these steps top to bottom against a
   fresh Supabase project. Each step is idempotent and safe to
   re-run."
2. Numbered, ordered list (1. … N.) — each step has:
   - A short imperative title.
   - 1–3 lines of body text.
   - A `[ ]` checkbox.
   - A deep-dive link to the canonical per-feature spec when relevant
     (e.g. `specs/018-auth-user-access/quickstart.md`,
     `specs/019-supabase-persistence/data-model.md §5`).
3. Required steps (per FR-003 and plan.md Affected Areas):
   1. Create the Supabase project; copy `SUPABASE_URL`,
      `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from
      **Settings → API**.
   2. Apply the schema migration block from
      `specs/019-supabase-persistence/data-model.md §5` via the
      Supabase SQL Editor (creates `applications`, `profile`,
      `user_seed_state`, RLS policies, and the
      `claim_and_seed_starter()` RPC). State the block is
      idempotent.
   3. Install the `allowed_emails` table + `BEFORE INSERT` trigger on
      `auth.users` per
      `specs/018-auth-user-access/quickstart.md`. Note the operator
      must populate `allowed_emails` with their seed account email
      before the first signup.
   4. Configure **Authentication → URL Configuration** Site URL and
      Redirect URLs per the existing
      `### Supabase Auth redirect URL configuration` block at
      `docs/deployment.md:150-163`. Cross-link rather than restate.
   5. Verify JWKS reachability:
      `curl <SUPABASE_URL>/auth/v1/.well-known/jwks.json` returns
      a JWKS document.
   6. Run the pre-deploy verification gate from
      `specs/018-auth-user-access/quickstart.md` §10 against the
      production Supabase project.
4. Close with two lines:
   - "If any step fails, do not promote. Install the missing piece
     and re-run from step 1 — every step is safe to re-run."
   - "After this checklist passes, walk
     [`docs/hosted-smoke-test.md`](./hosted-smoke-test.md) against
     the deployed preview to verify the runtime end-to-end before
     promoting to production." This cross-link satisfies the
     FR-006 requirement that the checklist be linked from
     `docs/deployment.md` in addition to `README.md`.

**Constraints**:

- **Cross-link, do not restate.** Per-feature quickstarts remain
  canonical for deep-dive operator content; this checklist is the
  ordering and the pass/fail framing.
- Anchor `#supabase-setup-checklist` must resolve from the README
  refresh added in Task 01.1.

**Validation**: Phase 04 task 04.3 (consolidation fidelity) confirms
every artifact named in plan.md "Consolidation Fidelity" appears in
this section.

---

### Task 02.3 — Add "Demo & Free-Tier Notes" section  [X]

**Target file**: `docs/deployment.md`

**Insertion point**: Immediately BEFORE the existing
`## Architecture Overview` section (currently around line 277).

**Heading**: `## Demo & Free-Tier Notes`

**What to do**:

1. One-sentence framing: "Project Alice's hosted deploy is shaped
   for free-tier hosting. The following behaviors are expected, not
   defects."
2. Four bullets / short paragraphs:
   - **Vercel Hobby cold starts.** First request after a quiet period
     may take several seconds while the function instance boots.
     Subsequent requests are fast. No configuration change can avoid
     cold starts on Hobby.
   - **Supabase Free inactivity pause.** A Supabase Free project that
     receives no traffic for ~7 days pauses. Resume from the Supabase
     dashboard. Warmup takes 1–2 minutes. Reference the Supabase docs
     URL inline (vendor doc, not a repo link).
   - **Demo mode resets on refresh.** Per feature 020, the Try-the-Demo
     flow runs entirely client-side; refreshing the browser resets
     state. No server-side persistence is intentional.
   - **Hosted seed data, not migration.** New hosted users get 2
     seeded sample applications and an empty profile (feature 019,
     FR-012). The seeded state is intentional — it is not migrated
     from anyone's local SQLite database. See the "Migration
     Clarification" section below (Task 02.4).
3. Close with: "Portfolio reviewers should expect production-feel
   inside these constraints, not production-grade scale."

**Constraints**:

- **No claims about Vercel/Supabase that are not in current vendor
  docs.** Free-tier behavior changes over time; describe today's
  behavior in general terms and link to vendor docs as the
  authoritative source.
- Cross-reference Task 02.4 (Migration Clarification) by anchor.

**Validation**: First future-operator deploy will confirm the cold-
start framing matches observed behavior. Not validated by this
feature itself (research.md D6).

---

### Task 02.4 — Add "Migration Clarification" section  [X]

**Target file**: `docs/deployment.md`

**Insertion point**: Immediately AFTER the new "Demo & Free-Tier Notes"
section (Task 02.3) and BEFORE the existing `## Architecture Overview`
section.

**Heading**: `## Migration Clarification`

**What to do**:

1. Three short paragraphs:
   - **Local SQLite data is not migrated automatically.** A user who
     has been running local mode and decides to deploy hosted will
     not see their local data carry over. The hosted runtime reads
     from Supabase Postgres; the local runtime reads from a
     SQLite file. There is no bridge.
   - **Hosted users start from seeded data.** The
     `claim_and_seed_starter()` RPC (feature 019) inserts 2 seeded
     starter applications on first authenticated request. The
     profile starts empty by design (FR-012 of feature 019).
   - **Migration tooling is future work.** No script, CLI, or
     admin endpoint exists today to move SQLite rows into Supabase.
     If such a tool is added, it will land as a separate feature
     with its own spec.

**Constraints**:

- **No promises about future tooling timing.** "Future work" is
  the precise framing.
- The phrase "local SQLite data is not migrated automatically" must
  appear verbatim — it is the search target a reviewer will hit
  when looking for migration semantics.

**Validation**: Phase 04 link-check. The seeded-data expectation
is verified by the existing feature 019 contracts (data-model.md
§5, claim_and_seed_starter RPC); no new runtime verification by
this feature.

---

### Task 02.5 — Wire anchors used by the README refresh  [X]

**Target file**: `docs/deployment.md`

**What to do**: Confirm that GitHub-rendered anchors for the four new
section headings resolve from the README refresh added in Task 01.1.
The defaults — `#environment-variable-checklist`,
`#supabase-setup-checklist`, `#demo--free-tier-notes`,
`#migration-clarification` — match GitHub's slugify rules. If a
heading wording change in 02.1–02.4 breaks one of those, update the
README anchor in 01.1 accordingly.

**Constraints**: This is a verify-and-reconcile task, not a content
task. No new content added.

**Validation**: Phase 04 task 04.1 link-check covers this.

---

## Phase 03 — Create `docs/hosted-smoke-test.md`  [X]

Implements **FR-006**. Standalone Markdown checklist, Given/When/Then
format per decision D3.

### Task 03.1 — Create `docs/hosted-smoke-test.md` skeleton + framing  [X]

**Target file**: `docs/hosted-smoke-test.md` (NEW)

**What to do**:

1. Open the file with a top heading: `# Hosted Smoke-Test Checklist`.
2. Add a 3–4 line framing paragraph: "Run this checklist against a
   hosted preview deploy before promoting to production, or against
   a production deploy after a docs-only merge that needs no rollout
   verification. Each step is a Given / When / Then triplet —
   complete every step before considering the deploy verified."
3. Add a "Prerequisites" subsection listing: a deployed URL (preview
   or production), browser DevTools available, two allowlisted email
   addresses on hand (user A and user B for cross-user authorization
   step), a small valid PDF or DOCX resume file under 5 MB.
4. Add an "Expected mid-run behaviors" subsection covering free-tier
   conditions an operator may hit during the walk-through —
   matching the edge cases enumerated in [spec.md](../spec.md):
   - **Supabase Free inactivity pause.** The project may pause if it
     has not been hit recently; the first request returns an error.
     Wake the project from the Supabase dashboard and wait 1–2
     minutes for warmup, then re-run from the failing step. Not a
     defect; expected free-tier behavior.
   - **Vercel Hobby cold start.** The first request after a quiet
     period may take several seconds while the function instance
     boots. Subsequent requests in the same session are fast. Not a
     defect; expected free-tier behavior. Cross-link the "Demo &
     Free-Tier Notes" section in `docs/deployment.md` for the full
     framing.
5. Add a "Capture" subsection: "Record pass / fail / notes per step
   in the PR description. Any failure stops the run — fix or defer
   with rationale, do not promote a partial pass. Pauses /
   cold-starts that resolve after a wait are not failures; note
   them but continue."

**Constraints**: Skeleton only — sections 1–7 are added by Tasks
03.2–03.8.

**Validation**: First future-operator pre-promotion run executes the
file. Not run against this feature's own merge (research.md D6).

---

### Task 03.2 — Section 1: Login flow  [X]

**Target file**: `docs/hosted-smoke-test.md`

**Heading**: `## 1. Login flow`

**Content**: Given / When / Then group:

- **Given** a hosted deploy URL and an allowlisted email not yet
  registered.
- **When** I click **Sign up**, enter the email and a password,
  submit, and complete the confirmation email link.
- **Then** I land on the welcome page signed in; my email appears
  in the navbar; the application list is empty except for the 2
  seeded starter applications (feature 019 FR-012).

Add a second Given/When/Then for the **Sign in** path with the now-
registered account.

**Validation**: First future-operator run of the checklist exercises
this section. Not validated by this feature (research.md D6).

---

### Task 03.3 — Section 2: Demo flow  [X]

**Target file**: `docs/hosted-smoke-test.md`

**Heading**: `## 2. Demo flow`

**Content**: Given / When / Then groups covering:

- Clicking **Try the demo** from the welcome page (signed out).
- Verifying 23 seeded sample applications and a populated profile
  are visible.
- Making a CRUD change (create, edit, archive) and confirming it
  appears.
- Refreshing the browser and confirming the demo state resets to
  the original seeded snapshot.

**Validation**: First future-operator run exercises this section
(research.md D6).

---

### Task 03.4 — Section 3: Application CRUD  [X]

**Target file**: `docs/hosted-smoke-test.md`

**Heading**: `## 3. Application CRUD`

**Content**: Three Given/When/Then groups, one each for **Create**,
**Edit**, **Archive**. Each step asserts:

- The change reaches the server (response is 2xx in the Network
  panel).
- The change persists across a hard refresh.

**Validation**: First future-operator run exercises this section
(research.md D6).

---

### Task 03.5 — Section 4: Profile editing  [X]

**Target file**: `docs/hosted-smoke-test.md`

**Heading**: `## 4. Profile editing`

**Content**: Given/When/Then groups covering:

- Opening Profile → Edit.
- Adding one entry in one structured section (Experience, say).
- Triggering the discard guard (navigate away with unsaved changes,
  cancel the prompt, return to the edit page, save).
- Confirming sticky Save / Cancel controls remain visible during
  scroll.

**Validation**: First future-operator run exercises this section
(research.md D6).

---

### Task 03.6 — Section 5: Authorization  [X]

**Target file**: `docs/hosted-smoke-test.md`

**Heading**: `## 5. Authorization (cross-user denial)`

**Content**:

- **Given** I am signed in as user A and I know an application ID
  belonging to user B (from a prior sign-in or the server logs).
- **When** I issue `GET /api/applications/<user-B-id>` from the
  browser DevTools console using user A's session.
- **Then** the response is 404 (RLS-scoped: the row does not exist
  from user A's perspective), not 403 or 200. This pins
  feature 019's defense-in-depth (RLS + server-side filter).

**Validation**: First future-operator run exercises this section
(research.md D6).

---

### Task 03.7 — Section 6: Resume import restrictions  [X]

**Target file**: `docs/hosted-smoke-test.md`

**Heading**: `## 6. Resume import restrictions`

**Content**: Two Given/When/Then groups:

1. **Demo mode**: visit the demo, open Profile → Edit; the Resume
   Import UI is hidden (per feature 020 VISIBLE_STATUSES gate).
2. **Hosted authenticated mode**: sign in, open Profile → Edit;
   upload a small valid PDF; verify the parsed fields populate
   the form (per feature 014 + 021).

**Constraints**: Reference feature 020 and feature 021 for the
contracts being verified.

**Validation**: First future-operator run exercises this section
(research.md D6).

---

### Task 03.8 — Section 7: Mobile layout sanity  [X]

**Target file**: `docs/hosted-smoke-test.md`

**Heading**: `## 7. Mobile layout sanity (375px)`

**Content**: Given/When/Then group:

- **Given** Chrome DevTools is open at the 375px iPhone preset.
- **When** I navigate through welcome → app list → application
  detail modal → Profile → Profile edit.
- **Then** the navbar collapses appropriately, the card list
  stacks single-column, the modal is full-screen or near-full,
  and the profile stats fall back to the stacked bar (not the
  desktop donut).

**Validation**: First future-operator run at 375px exercises this
section (research.md D6).

---

## Phase 04 — Review-gate verification  [X]

Runs after Phases 01–03 land. Mechanical checks against the merge
state. No content authoring.

### Task 04.1 — Link check  [X]

**Target**: every relative link added in Phases 01–03.

**What to do**:

1. Build the list of new relative links — at minimum:
   - `README.md` → `docs/deployment.md#environment-variable-checklist`
   - `README.md` → `docs/deployment.md#supabase-setup-checklist`
   - `README.md` → `docs/hosted-smoke-test.md`
   - `docs/deployment.md` → `docs/hosted-smoke-test.md` (FR-006:
     checklist must be reachable from the deployment guide as well
     as the README; added in Task 02.2's closing cross-link).
   - `docs/deployment.md` → `specs/018-auth-user-access/quickstart.md`
   - `docs/deployment.md` → `specs/019-supabase-persistence/data-model.md`
   - `docs/hosted-smoke-test.md` → any references to spec/feature
     contracts.
2. For each, confirm the target file exists at the same commit and
   the anchor (if any) resolves under GitHub's slugify rules
   (lowercase, spaces → `-`, special chars dropped).

**Constraint**: Read-only verification — do not edit files in this
task; if a link breaks, file the fix as a follow-up edit in the
relevant Phase 01–03 task.

**Validation**: SC-010.

---

### Task 04.2 — `.env.example` ↔ Env Var Checklist alignment  [X]

**What to do**:

1. List every variable in `.env.example` (read-only).
2. List every variable in the new "Environment Variable Checklist"
   section of `docs/deployment.md`.
3. The two sets must match exactly. No variable in either that is
   not in the other.

**Validation**: SC-002.

---

### Task 04.3 — Consolidation fidelity vs. per-feature quickstarts  [X]

**What to do**: For each item in the
[`checklists/plan-review.md`](checklists/plan-review.md) "Consolidation
Fidelity" subsection, confirm it is referenced (by cross-link or by
inline content) in the new "Supabase Setup Checklist" section of
`docs/deployment.md`. Specifically:

- 018 allowlist + `BEFORE INSERT` trigger steps.
- 019 schema migration block (`data-model.md §5`).
- JWKS reachability check.
- Pre-deploy verification gate (the six checks from 018 quickstart §10).
- Per-feature quickstarts remain accessible as deep-dive links.

**Validation**: SC-003.

---

### Task 04.4 — Diff-scope guard  [X]

**What to do**: Run `git diff main...HEAD --stat` (read-only). Confirm
every changed path falls inside one of:

- `README.md`
- `CHANGELOG.md` (will be touched in Phase 05; allowed to be empty here)
- `package.json` (will be touched in Phase 05; allowed to be empty here)
- `src/pages/welcome/shared/appMeta.js` (will be touched in Phase 05;
  allowed to be empty here; one-line `APP_VERSION` literal bump only —
  the constitution Amendment 1.3.0 carve-out from FR-009)
- `docs/**`
- `specs/022-deployment-polish-docs/**`

Any change outside this set is a scope violation — open it as a
separate concern, do not merge. In particular, **any** other path
under `src/` (anywhere besides `appMeta.js` line 6) is a scope
violation.

**Constraint**: This task may also run again immediately before merge
as part of Phase 05 docs sanity check.

**Validation**: SC-009 / FR-009.

---

## Phase 05 — Release Prep  [X]

Mandatory per constitution Amendment 1.3.0. Lands the operator-facing
metadata (version, CHANGELOG, REPO_MAP) so Phase 06's Browser Smoke
Test walks the to-be-merged state, not a follow-up snapshot. Task
05.4's grep verifies the source-literal correctness; Phase 06 then
covers the rendered-output side of the same change.

### Task 05.1 — Bump `package.json` version  [X]

**Target file**: `package.json`

**What to do**:

1. Change `"version": "0.11.0"` to `"version": "0.11.1"`.
2. Confirm no other `0.11.0` strings in `package.json` need updating.

**Constraint**: PATCH bump only (decision D4). Do not skip to `0.12.0`.

**Validation**: SC-008. Followed immediately by Task 05.1b which
bumps the in-app `APP_VERSION` literal in lockstep.

---

### Task 05.1b — Bump in-app `APP_VERSION` literal  [X]

**Target file**: `src/pages/welcome/shared/appMeta.js`

**What to do**:

1. On line 6, change `export const APP_VERSION = 'v0.11.0';` to
   `export const APP_VERSION = 'v0.11.1';`.
2. Confirm no other `0.11.0` literals exist in
   `src/pages/welcome/shared/appMeta.js`.

**Constraint**: This is the ONLY permitted `src/` edit in the feature.
The literal must match `package.json#version` exactly except for the
leading `v` prefix the constant carries. Do not refactor the constant
to import from `package.json` — that would be runtime-touching code
in a docs-only feature and is explicitly out of scope.

**Why this task exists**: Constitution Amendment 1.3.0 mandates the
in-app version display stay in sync with `package.json`. This file
hand-maintains the literal at
[`src/pages/welcome/shared/appMeta.js:6`](../../src/pages/welcome/shared/appMeta.js#L6);
it is consumed by `src/components/Footer.js:117` and
`src/pages/welcome/WelcomePage.js:275`. FR-009 carves this single
line out of the otherwise-blanket `src/` prohibition.

**Out of scope**: every other line in `appMeta.js`; both consumers
(`Footer.js`, `WelcomePage.js`) — they read the constant, do not pin
the literal, so they need no edit. The `'Built May 2026'` literal at
`src/components/Footer.js:117` is a separate housekeeping concern,
not part of this feature.

**Validation**: SC-008 + SC-009. Phase 05.4 docs sanity check
greps for `0.11.0` across the repo and confirms only historical
CHANGELOG / diff-link occurrences remain.

---

### Task 05.1c — Bump README `Current version` line  [X]

**Target file**: `README.md`

**What to do**:

1. Update the `Current version` line near the bottom of `README.md`
   (the line Task 01.1 deferred): change
   `Current version: **0.11.0** — see [CHANGELOG.md](CHANGELOG.md)`
   to
   `Current version: **0.11.1** — see [CHANGELOG.md](CHANGELOG.md)`.
2. Confirm no other `0.11.0` strings remain in `README.md`. (Phase
   05.4's grep will catch any miss, but doing it here keeps the
   version bumps together.)

**Constraint**: This task pairs with Task 05.1 (`package.json`) and
Task 05.1b (`appMeta.js`) — the three "current version" surfaces
must move together so no in-between state ships. Keep them
sequential: 05.1 → 05.1b → 05.1c → 05.2.

**Why this task exists**: Task 01.1 step 5 explicitly deferred the
README version-line bump to Phase 05 so the version-bump tasks
land as a single logical group. Without an explicit task here, the
README line could be missed — Task 05.4's grep would catch the
miss but only after the fact.

**Validation**: SC-008. Phase 05.4 grep will additionally confirm
no stray `0.11.0` strings remain in `README.md`.

---

### Task 05.2 — CHANGELOG entry  [X]

**Target file**: `CHANGELOG.md`

**What to do**:

1. Insert the new section **between** the existing
   `## [Unreleased]` heading (currently at line 8, kept as a
   permanent empty placeholder) and the previous
   `## [0.11.0] — 2026-05-20` heading. The new section becomes the
   first non-`[Unreleased]` entry; the `[Unreleased]` placeholder
   stays at the top and stays empty.

2. Use the **em-dash** date separator that matches existing entries —
   not a hyphen:

   ```md
   ## [0.11.1] — <YYYY-MM-DD>

   > Documentation polish release — feature 022-deployment-polish-docs.
   > Consolidated hosted-deployment operator surface; no runtime, schema,
   > or dependency changes.

   ### Docs

   - Consolidated hosted deployment surface: README "Hosted Mode"
     refresh, new Environment Variable Checklist, Supabase Setup
     Checklist, Demo & Free-Tier Notes, and Migration Clarification
     sections in `docs/deployment.md`. (022-deployment-polish-docs)
   - Added `docs/hosted-smoke-test.md` — standalone Given/When/Then
     smoke-test checklist for pre-promotion verification.
     (022-deployment-polish-docs)

   ### Changed

   - `APP_VERSION` literal bumped to `'v0.11.1'` in
     `src/pages/welcome/shared/appMeta.js` to stay in sync with
     `package.json` per constitution Amendment 1.3.0.
     (022-deployment-polish-docs)
   ```

3. If the file uses Keep-a-Changelog link references at the bottom
   (inspect — `CHANGELOG.md` follows that format per its line 5
   header), update both the `[Unreleased]` compare link and add a
   new `[0.11.1]` compare link. The pattern is `v0.11.0...v0.11.1`
   for the new entry and `v0.11.1...HEAD` for `[Unreleased]`.

4. Date format matches existing CHANGELOG entries (`YYYY-MM-DD`).

**Constraint**: Em-dash date separator is mandatory — every existing
entry uses it. A hyphen would break visual consistency.

**Validation**: SC-008. Confirms `[0.11.1]` heading matches
`package.json` and `appMeta.js`.

---

### Task 05.3 — `docs/REPO_MAP.md` update  [X]

**Target file**: `docs/REPO_MAP.md`

**What to do**:

1. Add a row for `docs/hosted-smoke-test.md` under the existing
   `docs/` section. One-line description: "Hosted smoke-test
   checklist — Given/When/Then verification flow run before promoting
   a deploy."
2. Add **five rows** under the existing Spec Packages section
   (currently at line 150), matching the per-feature pattern used by
   features 018–021 (lines 154–185). The five rows are:
   - `specs/022-deployment-polish-docs/spec.md` — feature spec
     (US1–US4, FR-001..013, SC-001..011).
   - `specs/022-deployment-polish-docs/plan.md` — architecture,
     affected areas, risks/tradeoffs, validation approach.
   - `specs/022-deployment-polish-docs/tasks.md` — phased
     implementation tasks ledger.
   - `specs/022-deployment-polish-docs/research.md` — clarification
     decisions (D1–D4) with rejected alternatives.
   - `specs/022-deployment-polish-docs/checklists/plan-review.md` —
     pre-implementation review gate.

   This feature does not ship `data-model.md`, `contracts/api.md`,
   or `quickstart.md` (rationale in [`plan.md`](plan.md)), so do
   not add rows for them.
3. Inspect the existing `docs/deployment.md` row — if its description
   becomes stale because of the four new sections, refresh it
   minimally (one sentence); otherwise leave it unchanged.

**Constraint**: Five new Spec Packages rows is the expected count —
not one summary row. The existing convention (018–021) is one row per
spec-package artifact.

**Validation**: SC-007 / FR-007.

---

### Task 05.4 — Docs sanity check (final pre-smoke pass)  [X]

**What to do**:

1. `grep -nF "0.11.0"` across `package.json`, `README.md`,
   `CHANGELOG.md`, `docs/**`, `src/**`. Confirm the only remaining
   matches are historical CHANGELOG headings, diff-link URLs, and
   the `[0.11.0] — 2026-05-20` heading itself. Specifically confirm
   `src/pages/welcome/shared/appMeta.js:6` reads `'v0.11.1'` not
   `'v0.11.0'`.
2. `grep -nF "0.11.1"` across the same paths. Confirm matches in
   `package.json`, `src/pages/welcome/shared/appMeta.js`,
   `CHANGELOG.md`, and any expected README line referencing the
   current version.
3. Re-run Task 04.1 link check against the now-complete state.
4. Re-run Task 04.4 diff-scope guard.

**Constraint**: Read-only. If any check fails, fix in the originating
phase task, do not patch-merge.

**Validation**: SC-008 + SC-009 + SC-010.

---

## Phase 06 — Browser Smoke Test  [X]

Scoped to a single task on the only UI surface this feature changes:
the footer / welcome-page version display. Constitution Amendment
1.1.0 applies because `APP_VERSION` is user-visible. The phase
covers what Task 05.4's grep cannot — the rendered-output side of
the same change (build chain, DOM mount, bundle inclusion).

Previous-feature flows (login, demo, CRUD, profile editing,
authorization, resume import, mobile layout) are unchanged by this
feature and **not re-walked** here. The new `docs/hosted-smoke-test.md`
is shipped as a future-operator reference artifact and is **not**
executed against the author's own merge — research.md D6 records
the rationale (author dogfooding of an author-written checklist is
verification theater; real validation happens when a different
operator first uses it).

**Setup**: a hosted preview deploy built from the merge-target
state, or local `npm run dev` against the merge-target branch.
Either is sufficient — the check exercises only the static
footer / welcome version literal.

### Task 06.1 — Footer / welcome-page version display sanity  [X]

**What to do**:

1. Open the deployed preview (or `npm run dev` against the merge
   target).
2. Confirm the footer reads the new version string — `v0.11.1` —
   matching `package.json#version` and
   `src/pages/welcome/shared/appMeta.js:6`.
3. Confirm the welcome-page version element (rendered via
   `WelcomePage.js:275`) also reads `v0.11.1`.
4. Capture pass / fail in the PR description.

**Pass criteria**: Both renderings display `v0.11.1` exactly. No
mismatch with `package.json` or `appMeta.js`.

**If this fails**: re-check Task 05.1 + Task 05.1b. The two literals
must match, and the build/import chain must still pull
`APP_VERSION` into the footer and welcome page.

**Out of scope**: every other UI surface. The full Hosted
Smoke-Test Checklist (`docs/hosted-smoke-test.md`) is **not**
executed in this phase. Previous-feature flows are unchanged and
not re-verified. See spec.md FR-011 and research.md D6.

**Validation**: SC-011.

---

## Dependencies & Execution Order

```
01 (README) ──┐
              ├──► 04 (review-gate) ──► 05 (Release Prep) ──► 06 (Smoke Test) ──► merge
02 (depl.md) ─┤
              │
03 (smoke.md) ┘
```

### Within phase

- **Phase 01**: single file edit; tasks within run sequentially.
- **Phase 02**: all tasks (02.1–02.5) touch `docs/deployment.md`;
  sequential to avoid merge conflicts.
- **Phase 03**: tasks 03.1–03.8 touch `docs/hosted-smoke-test.md`;
  sequential. Could be batched into one task if a single agent owns
  the file; broken out per-section here for review granularity.
- **Phase 04**: read-only; tasks 04.1–04.4 are independent and may
  run in parallel.
- **Phase 05**: 05.1 → 05.1b → 05.1c → 05.2 → 05.3 → 05.4 (sanity
  check runs last). The three version-bump tasks (05.1, 05.1b,
  05.1c) move `package.json`, `appMeta.js`, and the README
  Current-version line together so no in-between state ships.
- **Phase 06**: single task (06.1); ~30-second browser check on
  the version display only.

### Across phases

- Phases 01, 02, 03 are independent (different files) and may run in
  parallel across agents/sessions.
- Phase 04 requires 01–03 complete.
- Phase 05 requires 04 to have passed.
- Phase 06 requires 05 to have landed the version bump in both
  `package.json` and `appMeta.js`.

---

## Notes

- This feature ships NO automated tests (FR-009). The only code
  change is a one-line version literal in `appMeta.js`. Task 05.4's
  grep verifies the source literal; Phase 06's 30-second browser
  check verifies the rendered output. The new
  `docs/hosted-smoke-test.md` is a future-operator reference
  artifact, NOT executed by this feature's own smoke phase
  (research.md D6).
- Every task above has an explicit target file path and a validation
  pointer.
- Out-of-scope reminder, repeated for clarity: no edits under
  `server/`, `api/`, `shared/`, `tests/`, `scripts/`. The only
  permitted `src/` edit is the single `APP_VERSION` literal on
  `src/pages/welcome/shared/appMeta.js:6` (Task 05.1b), mandated by
  constitution Amendment 1.3.0. If a task implementation discovers
  that a doc change requires any other code change to be accurate,
  flag it — do not silently expand scope.
- Per spec.md edge cases: if a future operator following the new
  docs hits a `[hosted-schema] missing artifact:` log line during
  their first hosted boot, the new Supabase Setup Checklist (Task
  02.2) step 2 is the corrective action. This feature does not
  verify that pathway against its own merge state (research.md D6);
  the first different-operator deploy is the validation.
