# Plan Review Checklist — 028 Archive Applications View

Use this checklist to validate the plan before invoking `/speckit.tasks`. Every item must be `[x]` or have a documented reason in this file for being deferred.

Reference: project constitution v1.4.0 (`.specify/memory/constitution.md`) and the [Plan supporting artifacts](../../../../C:/Users/acres/.claude/projects/d--Alvin--CodeProjects-Project-Alice/memory/feedback_plan_artifacts.md) memory.

> **Process note (2026-05-26):** This checklist was authored alongside the initial plan but the items were left unchecked while three rounds of spec-review (architect) and one round of Codex review iteratively refined the package. The checklist is now completed retroactively against the final post-review state. Future features should treat the checklist as a true pre-`/speckit.tasks` gate (toggle items as the plan is being written), not a post-hoc sign-off.

---

## 1 · Constitutional alignment

- [x] **I. User-First Application Tracking.** Required application fields (`companyName`, `jobTitle`, `status`, `lastStatusUpdate`, `responsibilities`) are not modified by archive or unarchive. Confirmed in [data-model.md § 2.3](../data-model.md#23--state-transitions) and locked in by spec FR-038 + FR-009.
- [x] **II. Simple, Maintainable Web Architecture.** No new entity, no new table, no new abstraction layer. One new column (`archived_date`), one new endpoint (`POST /:id/unarchive`), one new query param (`?view=archived`). Net additions are localized. Verified across [plan.md § Affected Areas](../plan.md#affected-areas).
- [x] **III. Data Integrity and Validation.** `archivedDate` is server-set only; client PATCH containing it is silently dropped. Validation schema (`server/validation/application.js`) is not extended for `archivedDate` (intentional). The canonical rule is enforced in [data-model.md § 1.2](../data-model.md#12--field-mapping-serverdbcolumnsjs) — `archivedDate` is **excluded** from `FIELD_TO_COLUMN`, with a dedicated enforcement assertion in [tasks.md Task 01.2 validation case #4](../tasks.md#-task-012--extend-serverdbcolumnsjs-for-archived_date).
- [x] **IV. Practical User Experience.** Empty / loading / error states defined for the Archived view (spec FR-034–FR-036). Desktop and mobile layouts addressed via the existing Tracker chrome (toolbar chip, FAB hide, bottom tab bar parity).
- [x] **V. Testing and Quality Gates.**
  - [x] Automated tests planned for: archive `archivedDate` set; unarchive `archivedDate` cleared; `fav` round-trip preservation (FR-009); URL `?view=archived` parsing; Calendar exclusion of archived rows; Profile link count rendering; Modal archived mode read-only behavior.
  - [x] Release Prep phase (Amendment 1.3.0) is planned as the second-to-last phase ([tasks.md Phase 08](../tasks.md#phase-08--release-prep-required--constitution-amendment-130)).
  - [x] Browser Smoke Test phase (Amendment 1.1.0) is planned as the final phase, ordered AFTER Release Prep ([tasks.md Phase 09](../tasks.md#phase-09--browser-smoke-test-required--ui-feature-constitution-amendment-110)).

## 2 · Privacy and external dependencies

- [x] No external analytics, tracking, or telemetry introduced. Confirmed in [plan.md § Architecture](../plan.md#architecture) — purely local-first / hosted-Supabase, no third-party calls.
- [x] No new dependencies added to `package.json`. Confirmed in [research.md § Technical Context](../research.md) and [plan.md § Technical Context](../plan.md#technical-context) — all changes use existing libraries.

## 3 · Accessibility and responsive behavior

- [x] New UI surfaces (view chip, view popup, archived card variant, archived overlay chip, ↺ Unarchive button) have explicit aria-labels and keyboard reachability per the existing Tracker accessibility patterns. Captured in tasks.md Task 03.2 (chip + popup), Task 04.1 (card ↺ button), Task 05.1 (overlay chip + ↺), Task 06.1 (Profile link aria-label).
- [x] Status communication remains non-color-only — archived state is signaled by:
  - The "Archived" stamp chip on the card (text label, not color)
  - The "ARCHIVED" chip in the overlay header
  - The date-stamp slot's `Archived` prefix
  - The toolbar chip label changing from `Applications ▾` to `Archived ▾`
- [x] Mobile layout: the toolbar view chip and FAB-hide behavior are tested at <640px viewport (per [quickstart.md § 3.3](../quickstart.md#33--repeat-sections-13110) and [tasks.md Task 09.7](../tasks.md#--task-097-mobile-layout)).

## 4 · Spec ↔ plan traceability

For each functional requirement in [spec.md](../spec.md), the plan or research document points to where it is satisfied:

| FR | Satisfied by |
|---|---|
| FR-001…FR-004 (view switcher + URL sync) | plan.md § Data flow > View-switch flow; research.md § 3.1, § 3.2; tasks.md Phase 03 |
| FR-005, FR-006 (`archivedDate` set/clear) | data-model.md § 2.2, § 2.3; contracts/api.md § 2.2, § 3.2 |
| FR-007 (`POST /:id/unarchive`) | contracts/api.md § 3; tasks.md Task 01.6 |
| FR-008 (idempotency) | contracts/api.md § 2.4, § 3.4; research.md § 5.1.1 (atomic predicate UPDATE) |
| FR-009 (fav preservation) | research.md § 5.4; data-model.md § 2.4; tasks.md Task 01.2 + 01.4 + 01.5 + 05.3 |
| FR-010 (archived list query) | contracts/api.md § 1; research.md § 5.1; tasks.md Task 01.6 |
| FR-011, FR-012 (active list unchanged; server-side filter) | contracts/api.md § 1; data-model.md § 5 invariant 5 |
| FR-013, FR-014 (archived card) | research.md § 3.3; tasks.md Task 04.1 |
| FR-015…FR-023 (archived overlay mode) | research.md § 3.4; tasks.md Task 05.1 |
| FR-024…FR-026 (Calendar exclusion) | research.md § 3.6, § 5.5; tasks.md Task 06.2 |
| FR-027, FR-028 (Profile tiles + link) | research.md § 3.5; tasks.md Task 06.1 |
| FR-029, FR-030 (filter/sort/pagination compatibility) | research.md § 3.1; tasks.md Task 03.1 + 07.5 |
| FR-031…FR-033 (mode parity) | data-model.md § 1, § 3; contracts/api.md § 8; research.md § 5.1.1 |
| FR-034…FR-036 (empty / error states) | spec.md edge cases; tasks.md Task 03.4 |
| FR-037 (toasts) | research.md § 3.3, § 3.4; tasks.md Task 04.2 + 05.1 |
| FR-038…FR-041 (constitutional) | This checklist § 1 |

> The draft FR-031 for search persistence was withdrawn at `/speckit.clarify` (C3) and subsequently removed from the spec; subsequent FRs were renumbered to close the gap. The current FR-031 is the persistence FR, not the (withdrawn) search FR. See [spec.md § Clarifications](../spec.md#clarifications).

## 5 · Affected areas — completeness

- [x] Every file listed in [plan.md § Affected Areas](../plan.md#affected-areas) has been verified to exist (no speculative paths). Verified via `Glob` / `Grep` during the initial code survey; results captured in [research.md § 1–§ 3](../research.md).
- [x] No file in "inspect only" should actually be modified — if a touched-only file becomes a modified file during implementation, the plan is updated before merge. (Forward-looking; implementer commits to this discipline.)
- [x] No file in "modify" is missing from the implementation surface that the spec implies. Walked spec FR-by-FR against plan's Affected Areas during the architect review rounds.

## 6 · Risks and tradeoffs

- [x] Each risk in [research.md § 6](../research.md#6--risks-and-tradeoffs) has a mitigation listed. § 6.1 (migration), § 6.2 (fav change), § 6.3 (demoStore semantic change), § 6.4 (URL race), § 6.5 (filter persistence), § 6.6 (concurrent writes — closed by § 5.1.1 design).
- [x] The `fav` behavior change is called out in CHANGELOG (Release Prep deliverable — [tasks.md Task 08.2](../tasks.md#--task-082--changelog-entry) explicitly mentions it under "Changed").
- [x] The Supabase migration's nullability is verified safe for existing data. [data-model.md § 1.3](../data-model.md#13--migration-supabase-hosted) specifies `ADD COLUMN IF NOT EXISTS archived_date date;` — nullable, no default, no backfill, idempotent.

## 7 · Out-of-scope discipline

- [x] No "while we're here" scope creep snuck into the plan. The plan does not touch unrelated files (welcome page, resume import, profile edit, etc.) except where the spec explicitly requires (Profile link). Verified against [plan.md § Affected Areas](../plan.md#affected-areas).
- [x] No premature optimization (e.g. a summary endpoint, a count cache, batch endpoints) introduced. Confirmed via [research.md § 3.5](../research.md) which explicitly rejects a dedicated archived-count endpoint in favor of a parallel `api.getAll({ view: 'archived' })`.

## 8 · Pending blockers

- None as of 2026-05-26. Three rounds of architect review + one Codex review surfaced and resolved: 13 MINORs (M1–M13), 16 INFOs (I1–I16), plus Codex's MAJOR `FIELD_TO_COLUMN` contradiction. All resolved before sign-off.

## 9 · Sign-off

- Plan reviewer (architect, Claude Code): **completed 2026-05-26** across review rounds 1–3.
- External reviewer (Codex): **completed 2026-05-26** — surfaced the `archivedDate` FIELD_TO_COLUMN MAJOR + checklist MINOR; both resolved.
- Spec reviewer (user, reso830): **awaiting sign-off** prior to `/speckit.implement`. Approval signal: confirmation to proceed.
- Recorded in: this file; downstream confirmation will appear in commit messages and PR description at merge time.
