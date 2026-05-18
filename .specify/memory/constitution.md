<!--
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
-->

# Application Tracker Constitution

## Core Principles

### I. User-First Application Tracking
The system MUST help users track job applications clearly and quickly. Every job
application record MUST include company name, job title, application status,
a last_status_update date (set automatically on entry creation and on every status
change), and responsibilities (the stated duties or role description from the job
posting). Optional fields MAY include source platform, job posting URL, salary,
notes, follow-up action, and follow-up date. Status values MUST be controlled,
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

Rationale: Validation and status behavior define the reliability of the tracker,
so they require repeatable automated checks. Docs and version metadata define
how the tracker is discovered, deployed, and rolled forward, so they belong in
the merge boundary rather than in a follow-up pass.

## Privacy, Accessibility, and Extensibility Constraints

Job application data MUST be treated as private user data. The app MUST NOT
expose application data, sensitive notes, or usage details to external services
unless a later specification explicitly requires it. Analytics, tracking, and
third-party data sharing MUST be absent by default.

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

**Version**: 1.3.0 | **Ratified**: 2026-04-25 | **Last Amended**: 2026-05-16
