# Plan Review Checklist: Deployment Polish & Docs

**Feature**: 022-deployment-polish-docs
**Companion**: [plan.md](../plan.md), [spec.md](../spec.md), [research.md](../research.md)

This checklist is the review gate before `/speckit.tasks` runs. Walk
every item; flag any failure inline. The gate passes when every
item is checked or has a documented reason for the skip plus residual
risk.

---

## Constitution Compliance

- [ ] **Principle I** — N/A confirmed: no application data fields are
  added, removed, or renamed by this feature.
- [ ] **Principle II** — Simple architecture: no new dependencies, no
  new runtime modules, no new endpoints.
- [ ] **Principle III** — N/A confirmed: no validation rules are added
  or removed.
- [ ] **Principle IV** — UX impact is documentation-only. The new
  Hosted Smoke-Test Checklist (`docs/hosted-smoke-test.md`) is shipped
  as a future-operator reference artifact; this feature does not
  execute it against its own merge (research.md D6).
- [ ] **Principle V** — Release Prep is mandatory and runs as Phase
  05. Browser Smoke Test (Phase 06) is scoped to a single-task
  footer / welcome version-display check — the only UI surface
  this feature changes. Amendment 1.1.0 applies because
  `APP_VERSION` is user-visible; Task 05.4's grep verifies the
  source literal, Phase 06 verifies the rendered output (build
  chain, DOM mount, bundle inclusion). Previous-feature flows are
  unchanged and not re-walked (research.md D6). No new automated
  tests required because the only code change is one version
  literal (FR-009).
- [ ] **Privacy** — No analytics, telemetry, or third-party data sharing
  introduced. Demo/free-tier framing consistent with no-external-sharing
  stance.

---

## Spec ↔ Plan Alignment

- [ ] Every FR in `spec.md` is addressed by the plan's Architecture or
  Affected Areas section. Specifically:
  - [ ] FR-001 — README "Runtime modes" treatment (refreshed Hosted Mode
    section, per D2).
  - [ ] FR-002 — Environment Variable Checklist section in
    `docs/deployment.md`.
  - [ ] FR-003 — Supabase Setup Checklist section in
    `docs/deployment.md`.
  - [ ] FR-004 — Demo & Free-Tier Notes section in
    `docs/deployment.md`.
  - [ ] FR-005 — Migration Clarification section in
    `docs/deployment.md`.
  - [ ] FR-006 — Standalone `docs/hosted-smoke-test.md` with all seven
    flows.
  - [ ] FR-007 — `docs/REPO_MAP.md` updated.
  - [ ] FR-008 — `CHANGELOG.md` entry + `package.json` PATCH bump
    (`0.11.0` → `0.11.1`).
  - [ ] FR-009 — Diff-scope guard: no changes under `server/`,
    `api/`, `shared/`, `tests/`; `src/` change limited to the single
    `APP_VERSION` literal on
    `src/pages/welcome/shared/appMeta.js:6` (D5 carve-out).
  - [ ] FR-010 — Link-check plan documented.
  - [ ] FR-011 — Phase 06 scoped to single-task footer / welcome
    version-display check; full Hosted Smoke-Test Checklist not
    validated by this feature; previous-feature flows unchanged
    and not re-walked (D6).
- [ ] Every SC in `spec.md` maps to a validation step in the plan.

---

## Decision Resolution (from research.md)

- [ ] D1 — Smoke-test path is `docs/hosted-smoke-test.md` (flat).
- [ ] D2 — README scope is "refresh Hosted Mode section only."
- [ ] D3 — Smoke-test format is Given/When/Then.
- [ ] D4 — Version bump is PATCH (`0.11.0` → `0.11.1`).
- [ ] D5 — `src/` carve-out for `APP_VERSION` literal at
  `src/pages/welcome/shared/appMeta.js:6` is documented in
  FR-009 / SC-009 and executed by Task 05.1b.
- [ ] D6 — Phase 06 scoped to single-task footer / welcome
  version-display check; Task 05.4 grep covers source-literal,
  Phase 06 covers rendered output; `docs/hosted-smoke-test.md`
  ships as a future-operator artifact, not validated by this
  feature itself.

---

## Scope Guards

- [ ] No source code edits under `server/`, `api/`, `shared/`,
  `tests/`, `scripts/`.
- [ ] The only permitted `src/` edit is the `APP_VERSION` literal on
  `src/pages/welcome/shared/appMeta.js:6` (Task 05.1b). Verified by
  the diff-scope guard (Task 04.4 + Task 05.4).
- [ ] No new dependencies in `package.json` (only the `version`
  field changes).
- [ ] No new env vars in `.env.example`.
- [ ] No new endpoints or route handlers.
- [ ] No new `data-model.md` / `contracts/api.md` / spec-internal
  `quickstart.md` artifacts for this feature; rationale documented in
  `plan.md` "Supporting artifacts intentionally omitted."

---

## Consolidation Fidelity

- [ ] Supabase Setup Checklist preserves every step from
  `specs/018-auth-user-access/quickstart.md` allowlist + trigger
  install.
- [ ] Supabase Setup Checklist preserves every artifact from
  `specs/019-supabase-persistence/data-model.md §5` schema migration.
- [ ] Supabase Setup Checklist preserves the JWKS reachability check
  from `docs/deployment.md` "Pre-deploy verification gate."
- [ ] Per-feature quickstarts (018, 019, 020, 021) remain linked from
  the new sections as deep-dive references.
- [ ] Env Var Checklist names every variable in `.env.example` (and
  vice versa) — confirmed by side-by-side diff.

---

## Smoke-Test Coverage

The new `docs/hosted-smoke-test.md` MUST cover, per FR-006:

- [ ] Login flow (allowlisted email sign-up + sign-in).
- [ ] Demo flow (Try the demo CTA, in-memory CRUD, reset on refresh).
- [ ] Application CRUD (create, edit, archive).
- [ ] Profile editing (sticky save/cancel, discard guard, one
  structured section walked end-to-end).
- [ ] Authorization (user A cannot read user B; cross-user 404
  observed).
- [ ] Resume import restrictions (hidden in demo; allowed in hosted
  authenticated mode).
- [ ] Mobile layout sanity (375px viewport: navbar, card list, profile
  chart fallback).

---

## Release Prep Readiness

- [ ] `package.json` bump is staged: `0.11.0` → `0.11.1` (Task 05.1).
- [ ] `src/pages/welcome/shared/appMeta.js:6` bump is staged:
  `'v0.11.0'` → `'v0.11.1'` (Task 05.1b — the single `src/`
  carve-out).
- [ ] `README.md` Current-version line bump is staged:
  `**0.11.0**` → `**0.11.1**` (Task 05.1c).
- [ ] `CHANGELOG.md` entry uses the heading `## [0.11.1] — <date>`
  with the **em-dash** separator (matching the existing
  `## [0.11.0] — 2026-05-20` convention) and the `### Docs` group;
  the entry is inserted between the `[Unreleased]` placeholder and
  the previous `[0.11.0]` heading.
- [ ] README references to feature 022 (if any) use the
  `022-deployment-polish-docs` slug.
- [ ] `docs/REPO_MAP.md` has a row for `docs/hosted-smoke-test.md`
  plus five new rows under Spec Packages
  (`specs/022-deployment-polish-docs/{spec,plan,tasks,research}.md`
  and `checklists/plan-review.md`).

---

## Skipped Checks

Any item skipped above MUST be recorded here with the reason and the
residual risk it leaves behind.

| Item | Reason for skip | Residual risk |
|---|---|---|
| _(none yet)_ | _(n/a)_ | _(n/a)_ |
