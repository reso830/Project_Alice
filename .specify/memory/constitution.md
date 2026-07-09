<!--
Sync Impact Report (1.7.0 — 2026-07-09)
Version change: 1.6.0 -> 1.7.0
Reason: Amendment 1.7.0 — records a second explicit, scoped exception to
the privacy clause's "Analytics, tracking, and third-party data sharing
MUST be absent by default" rule. Vercel Web Analytics is enabled on the
hosted deployment to report anonymized visitor/traffic stats (page views,
visitor counts, referrer sources, and country-level geography) so operators
can monitor usage, debug issues, and prioritize improvements for hosted
Alice (issue #132). Amendment 1.5.0 explicitly named Web Analytics as still
prohibited absent its own amendment; this is that record. The exception is
broader in kind than 1.5.0's performance-only Speed Insights exception — it
covers visitor behavior, not just page timing — but stays narrow: no
application data, no cookies, no PII (job titles, companies, salary, resume
content) is ever collected, matching Vercel Web Analytics' cookieless-by-
default design. Local mode is unaffected — the @vercel/analytics package
no-ops outside the production Vercel deployment, so local-first is preserved.
Modified principles: none redefined.
Modified sections:
- Privacy, Accessibility, and Extensibility Constraints — privacy clause
  annotated with the Web Analytics exception, alongside the existing Speed
  Insights exception.
Templates requiring updates: none.
Follow-up TODOs: none.

---

Sync Impact Report (1.6.0 — 2026-07-06)
Version change: 1.5.0 -> 1.6.0
Reason: Amendment 1.6.0 — adds a Design Fidelity gate for visual-fidelity
features (any feature implemented against a design prototype, mockup set, or
high-fidelity handoff). Identified after feature 042 (welcome brand refresh):
the handoff was excellent, but the pixel/motion detail was lost when the
prototype was paraphrased down the spec -> plan -> tasks chain, and appearance
was only checked by the operator at the very end — producing ~18 "align to
prototype" rework commits. For visual work the design artifact IS the
requirement; prose is a lossy encoding of pixels and motion. The gate makes the
prototype the referenced source of truth, decomposes visual work per
scene/component, and moves the appearance check into the implementation loop
(automated geometry + agent visual judgment) instead of onto the human at merge.
Proportionality is built in: the gate scales down for small visual changes, and
documentary artifacts are produced only when actually needed.
Modified principles:
- V. Testing and Quality Gates — added the Design Fidelity gate for
  visual-fidelity features (source-of-truth referencing, faithful cross-stack
  translation, per-component decomposition, two-tier fidelity check).
Modified sections:
- Development Workflow and Review Gates — plans classify visual-fidelity
  features and name the canonical design source; tasks reference it directly
  and pass the Design Fidelity gate before a visual phase is accepted.
Templates requiring updates:
- .specify/templates/plan-template.md — Visual-Fidelity Mode section added.
- .specify/templates/tasks-template.md — visual-task pattern, Tier-1 harness
  setup task, and conditional artifacts added.
- .specify/templates/checklist-fidelity-template.md — new fidelity checklist
  variant (with the test:visual harness spec) added.
Follow-up TODOs: none.

---

Sync Impact Report (1.5.0 — 2026-05-30)
Version change: 1.4.0 -> 1.5.0
Reason: Amendment 1.5.0 — records the first explicit, scoped exception to
the privacy clause's "Analytics, tracking, and third-party data sharing
MUST be absent by default" rule. Vercel Speed Insights is enabled on the
hosted deployment to report anonymized Core Web Vitals (page-level
performance only — no application data, no cookies, no PII). The clause
already permits external services "unless a later specification explicitly
requires it"; this amendment is that explicit record. Local mode is
unaffected — the @vercel/speed-insights package no-ops outside the
production Vercel deployment, so local-first is preserved.
Modified principles: none redefined.
Modified sections:
- Privacy, Accessibility, and Extensibility Constraints — privacy clause
  annotated with the Speed Insights exception.
Templates requiring updates: none.
Follow-up TODOs: none.

---

Sync Impact Report (1.4.0 — 2026-05-21)
Version change: 1.3.0 -> 1.4.0
Reason: Amendment 1.4.0 — rescinds Amendment 1.0.1's removal of
`application date` from the optional field set. The codebase, the
spec template, the validation schema, and the seeds never carried
the consolidation; the field has remained throughout as
`applicationDate` (frontend) / `application_date` (DB column).
Feature 025 (Application Timeline) depends on this field for its
read-time synthesis of legacy rows whose `timeline` is empty.
The two fields have distinct semantics: `applicationDate` is when
the user submitted; `lastStatusUpdate` is when the row last
advanced in status. The 1.0.1 removal language is formally
withdrawn.
Modified principles:
- I. User-First Application Tracking — optional fields list now
  explicitly includes `application date` again, alongside source
  platform, job posting URL, salary, notes, follow-up action, and
  follow-up date. No required-field change.
Modified sections: none beyond Principle I.
Templates requiring updates:
- .specify/templates/spec-template.md — already lists "application
  date" as optional at line 108 (template never tracked the 1.0.1
  removal); no change required by 1.4.0. Pre-existing drift unrelated
  to this amendment: line 106 still says "created date" required
  field (Amendment 1.0.1 replaced with last_status_update) and
  omits `responsibilities` required field (Amendment 1.2.0). Deferred.
- .specify/templates/plan-template.md — no change required by 1.4.0.
  Pre-existing drift unrelated to this amendment: missing
  `responsibilities` required field from Amendment 1.2.0. Deferred.
- .specify/templates/tasks-template.md — no change required.
Follow-up TODOs (pre-existing, not introduced by 1.4.0):
- Update spec-template.md line 106 to reflect Amendment 1.0.1
  (last_status_update) and 1.2.0 (responsibilities required).
- Update plan-template.md to add responsibilities to the required
  field list per Amendment 1.2.0.

---

Sync Impact Report
Version change: template -> 1.3.0 (current)
Modified principles:
- Template Principle 1 -> I. User-First Application Tracking
- Template Principle 2 -> II. Simple, Maintainable Web Architecture
- Template Principle 3 -> III. Data Integrity and Validation
- Template Principle 4 -> IV. Practical User Experience
- Template Principle 5 -> V. Testing and Quality Gates
Added sections:
- Privacy, Accessibility, and Extensibility Constraints
- Development Workflow and Review Gates
Removed sections:
- Template placeholder sections
Templates requiring updates:
- .specify/templates/plan-template.md - updated
- .specify/templates/spec-template.md - updated
- .specify/templates/tasks-template.md - updated
- .specify/templates/commands/*.md - not applicable; directory absent
Follow-up TODOs: none

Amendment 1.0.1 — 2026-04-25
Reason: Replaced "created date" required field with last_status_update. A single
temporal field set on entry creation and on every status change is sufficient for v1
and avoids managing two date fields before an edit form exists.
Modified principles:
- I. User-First Application Tracking — required date field updated
- IV. Practical User Experience — "date applied" reference updated
Removed from optional fields: application date (consolidated into last_status_update)
Templates updated: .specify/templates/plan-template.md (constitution check bullet)

Amendment 1.1.0 — 2026-05-09
Reason: Added mandatory browser smoke test requirement for all features with
user-facing UI. Automated tests are necessary but not sufficient — rendering,
CSS layout, real keyboard interaction, and mobile viewports require human
verification in a live browser session. This was identified as a gap after
features shipped without browser verification exposed issues only visible
in the browser.
Modified principles:
- V. Testing and Quality Gates — added browser smoke test requirement for UI features
Modified sections:
- Development Workflow and Review Gates — added browser smoke test phase as
  mandatory final phase for UI features
Templates updated: .specify/templates/tasks-template.md (browser smoke test phase added)
Follow-up TODOs: none

Amendment 1.2.0 — 2026-05-09
Reason: Promoted `responsibilities` (the stated duties / role description from a job
posting) from optional to required. A record without responsibilities lacks sufficient
context to evaluate role fit and is practically unusable as a tracking record. Identified
during manual browser testing of feature 012.
Modified principles:
- I. User-First Application Tracking — responsibilities added to required field set
Templates updated: none
Follow-up TODOs: server/validation/application.js — responsibilities to required text;
src/models/application.js — add responsibilities to required field validation;
src/components/Modal.js — add responsibilities to inline error guard in Save/Create handlers

Amendment 1.3.0 — 2026-05-16
Reason: Added mandatory Release Prep phase to every feature, executed BEFORE the
Browser Smoke Test phase. Identified after feature 018 shipped its smoke-test
phase ahead of docs/version work, requiring a tasks.md edit mid-stream to add a
release-prep phase. Documentation, version bumps, and CHANGELOG entries should
land in the same state the operator will smoke-test, not in a follow-up pass.
Modified principles:
- V. Testing and Quality Gates — added Release Prep requirement immediately
  before the Browser Smoke Test
Modified sections:
- Development Workflow and Review Gates — Release Prep phase added as mandatory
  pre-merge phase, ordered before the existing Browser Smoke Test phase
Templates updated: .specify/templates/tasks-template.md (Release Prep phase
inserted between Polish and Browser Smoke Test); scripts/prompts/claude-tasks.md
(Release Prep noted in Requirements)
Follow-up TODOs: none

Amendment 1.4.0 — 2026-05-21
Reason: Rescinds Amendment 1.0.1's removal of `application date` from the
optional field set. The 1.0.1 consolidation was never enforced — the codebase,
spec template, validation schema, and seeds all retained `applicationDate` /
`application_date` as an optional field throughout. The two fields have
distinct semantics: `applicationDate` is when the user submitted the
application (set once, optional); `lastStatusUpdate` is when the row last
advanced in status (auto-bumped on every status change). Conflating them
loses the "when did I apply" information. The drift was identified during
spec review for feature 025 (Application Timeline), which depends on
`applicationDate` for its read-time synthesis of default Timeline entries
for legacy rows. This amendment formalizes the existing reality so future
features can rely on `applicationDate` on solid constitutional ground.
Modified principles:
- I. User-First Application Tracking — restores `application date` to the
  optional field list (alongside source platform, job posting URL, salary,
  notes, follow-up action, follow-up date). No required-field change.
Templates updated: none required (spec-template.md already lists
"application date" as optional; it never tracked the 1.0.1 removal).
Follow-up TODOs (pre-existing, not introduced by this amendment):
- spec-template.md line 106 still references the pre-1.0.1 "created date"
  required field and omits the post-1.2.0 `responsibilities` required
  field — both deferred to a future template-sync amendment.
- plan-template.md Constitution Check bullet (line 34) omits
  `responsibilities` per 1.2.0 — also deferred.

Amendment 1.6.0 — 2026-07-06
Reason: Added a Design Fidelity gate for visual-fidelity features (features
implemented against a design prototype, mockup set, or high-fidelity handoff).
Identified after feature 042: the handoff README was high-fidelity, but the
pixel/motion detail evaporated when the prototype was paraphrased through
spec -> plan -> tasks, and appearance was verified only by the operator at the
end — the ~18 "align to prototype" rework commits were that late human review
firing. Speckit's normal summarization is correct for logic requirements and
lossy for visual ones, where the design artifact is the requirement itself.
The gate: (1) the prototype/handoff is the referenced canonical source, never
paraphrased; (2) cross-stack ports lift the stylesheet wholesale and replicate
the DOM element-for-element; (3) each scene/component is its own task; (4) a
two-tier check runs inside implementation — Tier 1 automated geometry
assertions (mandatory) and Tier 2 frozen-state visual judgment (capability-
preflight-gated, artifacts always produced). Proportionality and an
artifact-must-name-the-failure-it-prevents rule guard against process bloat.
Modified principles:
- V. Testing and Quality Gates — Design Fidelity gate added for visual features
Modified sections:
- Development Workflow and Review Gates — visual-fidelity classification and
  gate referenced as a pre-acceptance requirement for visual phases
Templates updated: .specify/templates/plan-template.md (Visual-Fidelity Mode),
.specify/templates/tasks-template.md (visual-task pattern + Tier-1 harness task
+ conditional artifacts), .specify/templates/checklist-fidelity-template.md (new)
Follow-up TODOs: none

Amendment 1.7.0 — 2026-07-09
Reason: Enabled Vercel Web Analytics on the hosted deployment to report
anonymized visitor/traffic stats (page views, visitor counts, referrer
sources, and country-level geography). Hosted operators had no visibility
into traffic volume or usage patterns — Speed Insights (Amendment 1.5.0)
reports only page-level performance, not who is visiting or how much. This
was requested to support quality-of-service monitoring, debugging, and
improvement prioritization for hosted Alice (issue #132). Amendment 1.5.0
had explicitly named Web Analytics as still prohibited absent its own
amendment; this is that explicit record. The exception stays narrow: Vercel
Web Analytics is cookieless by design and reports only aggregated,
anonymized visitor metrics — never application data, passwords, or PII (job
titles, companies, salary info, resume content). Local mode is unaffected —
the @vercel/analytics package no-ops outside the production Vercel
deployment, so local-first is preserved.
Modified principles: none redefined.
Modified sections:
- Privacy, Accessibility, and Extensibility Constraints — privacy clause
  annotated with the Web Analytics exception.
Templates updated: none.
Follow-up TODOs: none.
-->

# Application Tracker Constitution

## Core Principles

### I. User-First Application Tracking
The system MUST help users track job applications clearly and quickly. Every job
application record MUST include company name, job title, application status,
a last_status_update date (set automatically on entry creation and on every status
change), and responsibilities (the stated duties or role description from the job
posting). Optional fields MAY include source platform, job posting URL,
application date (when the user submitted the application; distinct from
last_status_update, which tracks the most recent status change), salary, notes,
follow-up action, and follow-up date. Status values MUST be controlled,
consistent, and easy to filter.

Rationale: The application exists to make a user's job search understandable at
a glance, so the core record shape and status vocabulary are non-negotiable.

### II. Simple, Maintainable Web Architecture
Implementation MUST prefer readable, direct web application structure over clever
abstractions. Business logic MUST be separated from UI rendering. Validation
rules MUST be centralized and reusable by forms, persistence logic, and tests.
New dependencies MUST be introduced only when they clearly reduce complexity or
improve maintainability.

Rationale: The project is intended to remain easy to extend, debug, and test as the
tracker grows beyond the initial application record workflow.

### III. Data Integrity and Validation
Required fields MUST be validated before saving. URLs MUST be validated when
provided. Dates MUST use one consistent project format. Invalid data MUST produce
clear user-facing errors. Application records MUST NOT be silently corrupted,
silently overwritten, or saved in an ambiguous state.

Rationale: Job application data is private and operationally important; users
need confidence that their records remain accurate.

### IV. Practical User Experience
The app MUST make it easy to add, edit, search, filter, and review job
applications. The main view MUST prioritize application status, company, role,
last status update, and next follow-up. Users MUST be able to quickly identify
stale applications and pending follow-ups. Empty states, loading states, and
error states MUST be handled clearly.

Rationale: The tracker succeeds only when common job-search workflows are fast,
visible, and low-friction.

### V. Testing and Quality Gates
Core validation logic MUST have automated tests. Status transitions, required
fields, URL validation, and date handling MUST be tested. New features MUST NOT
break existing tests. Code MUST be linted and formatted consistently before a
feature is considered complete.

For features with user-facing UI, a browser smoke test MUST verify each user
story's Independent Test scenario in a live browser session before the feature
is considered complete. Automated tests are necessary but not sufficient for UI
features — rendering, CSS layout, real keyboard interaction, and mobile viewports
require human verification in the browser.

Every feature MUST include a Release Prep phase before the Browser Smoke Test
covering version bump (SemVer in `package.json` + any in-app version display),
`CHANGELOG.md` entry, README updates for new user-facing surface, deployment
docs updates when env vars or runtime modes change, and repo-map / navigation
docs updates when new directories or files were introduced. The smoke test
walks the same state the operator will merge, so docs and version land first.

**Design Fidelity gate (visual-fidelity features).** A *visual-fidelity
feature* is any feature implemented against a design prototype, mockup set, or
high-fidelity handoff. For these, the design artifact IS the requirement, not
supporting evidence, and the following MUST hold:

- **Source of truth.** The prototype/handoff is canonical and MUST be referenced
  directly (file + section or line range), never paraphrased into prose. On
  conflict, precedence is prototype / screenshots > handoff README > spec > plan
  > tasks. Ambiguities are resolved by asking, not by inventing detail.
- **Faithful translation.** When porting across stacks (e.g. a React prototype
  to Vanilla JS), lift the prototype's stylesheet and design tokens wholesale
  and replicate its DOM structure element-for-element. Do not restructure or
  "clean up" the node tree — the lifted CSS depends on the exact hierarchy.
- **Decomposition.** Each animated scene or distinct component is its own task.
  Bundling several into one task is prohibited.
- **Two-tier fidelity check, run inside implementation before a visual phase is
  accepted:** *Tier 1 (mandatory, automated)* — geometry/layout assertions
  (viewport-relative sizing, non-overlap, responsive visibility) run headless
  with animations frozen and identical mock data seeded; tolerances are ranges,
  not exact pixels. *Tier 2 (visual judgment)* — frozen-state screenshots at the
  defined breakpoints/checkpoints, compared against the prototype. The
  implementing agent self-serves Tier 2 only after passing an in-session
  image-view preflight; otherwise it MUST still produce the screenshot artifacts
  and hand judgment to a vision-capable reviewer or the operator. Tier 2 is never
  skipped — only its judge changes.

Proportionality governs this gate: it applies in full to substantial visual
features and scales down for small visual changes, which follow the principles
above without the full harness. Documentary artifacts (a deviation ledger; a
per-task visual-artifacts manifest) are produced only when actually needed — when
a real intentional deviation exists, or when Tier 2 judgment is handed between
parties. Every recurring fidelity artifact MUST name the specific failure it
prevents; one that cannot is removed.

Rationale: Validation and status behavior define the reliability of the tracker,
so they require repeatable automated checks. Docs and version metadata define
how the tracker is discovered, deployed, and rolled forward, so they belong in
the merge boundary rather than in a follow-up pass. Prose is a lossy encoding of
pixels and motion: visual features fail when the design is summarized instead of
referenced, and when appearance is checked only by a human at the end instead of
by the implementer during the work — so fidelity is referenced, decomposed, and
verified in-loop.

## Privacy, Accessibility, and Extensibility Constraints

Job application data MUST be treated as private user data. The app MUST NOT
expose application data, sensitive notes, or usage details to external services
unless a later specification explicitly requires it. Analytics, tracking, and
third-party data sharing MUST be absent by default.

**Scoped exception (Amendment 1.5.0):** Vercel Speed Insights is enabled on
the hosted Vercel deployment to report anonymized Core Web Vitals (page-level
performance metrics only — never application data, no cookies, no PII). This
is the explicit record required by the clause above. The exception is narrow:
it covers performance telemetry only, and the `@vercel/speed-insights` package
no-ops outside the production Vercel deployment, so local mode reports nothing
and the local-first principle is preserved.

**Scoped exception (Amendment 1.7.0):** Vercel Web Analytics is enabled on
the hosted Vercel deployment to report anonymized visitor/traffic stats (page
views, visitor counts, referrer sources, and country-level geography), so
operators can monitor usage, debug issues, and prioritize improvements. This
is the explicit record required by the clause above, and by Amendment 1.5.0,
which had named Web Analytics as prohibited absent this amendment. The
exception is narrow: Vercel Web Analytics is cookieless by design and reports
only aggregated, anonymized visitor metrics — never application data,
passwords, or PII (job titles, companies, salary info, resume content). The
`@vercel/analytics` package no-ops outside the production Vercel deployment,
so local mode reports nothing and the local-first principle is preserved. Any
analytics or tracking beyond these two named, scoped exceptions remains
prohibited absent its own explicit amendment.

The app MUST be usable on desktop and mobile browsers. Forms MUST have labels and
clear validation messages. Keyboard navigation MUST work for core workflows.
Color MUST NOT be the only way to communicate status.

The data model MUST allow future support for interviews, contacts, documents,
reminders, and salary tracking without requiring a rewrite of the base
application record. These future features MUST NOT be overbuilt until specified.

## Development Workflow and Review Gates

Specifications MUST describe how each feature supports application tracking,
data integrity, privacy, accessibility, and practical review workflows. Plans
MUST pass a Constitution Check before implementation design is accepted. Tasks
MUST include validation, state handling, and required quality-gate work whenever
the feature touches application records, forms, filtering, persistence, or status
behavior.

Before completion, contributors MUST run the relevant automated tests and the
project's lint/format checks when those commands exist. Features MUST include a
Release Prep phase as the second-to-last implementation phase (version bump,
CHANGELOG, README, deployment docs, repo map). Features with user-facing UI
changes MUST then include a Browser Smoke Test phase as the final implementation
phase, walking through each user story's Independent Test from spec.md in a real
browser against the to-be-merged state. Any skipped check MUST be documented with
the reason and residual risk.

For visual-fidelity features (Principle V), plans MUST classify the feature as
such and name the canonical design source, tasks MUST reference that source
directly rather than paraphrase it, and each visual phase MUST pass the Design
Fidelity gate (Tier 1 automated geometry + Tier 2 visual judgment) before it is
accepted. This gate runs during implementation; the Browser Smoke Test then
confirms the merged state rather than discovering drift for the first time.

## Governance

This constitution overrides convenience during specification, planning, and
implementation. Any proposed technical choice MUST support simplicity, data
integrity, testability, and maintainability. If a feature conflicts with this
constitution, this constitution wins unless explicitly revised.

Amendments MUST document the reason for change, update impacted templates or
guidance, and include a semantic version bump. MAJOR versions apply to backward
incompatible governance or principle redefinitions. MINOR versions apply to new
principles, new sections, or materially expanded guidance. PATCH versions apply
to clarifications and non-semantic wording changes.

Compliance review is required during specification, planning, task generation,
implementation review, and final verification.

**Version**: 1.7.0 | **Ratified**: 2026-04-25 | **Last Amended**: 2026-07-09
