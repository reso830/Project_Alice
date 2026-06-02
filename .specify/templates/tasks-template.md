---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Core validation tests are REQUIRED by the constitution whenever a
feature touches application records, forms, persistence, status behavior, URLs,
or dates. Other tests should be included when requested by the feature
specification or when needed to protect the changed behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

<!-- 
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.
  
  The /speckit.tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/
  
  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment
  
  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting and formatting tools

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T004 Setup database schema and migrations framework
- [ ] T005 [P] Create controlled application status values and transition rules
- [ ] T006 [P] Create centralized reusable validation rules for required fields, URLs, dates, and status
- [ ] T007 [P] Add automated validation tests for required fields, URLs, dates, and status behavior
- [ ] T008 [P] Setup API routing and middleware structure
- [ ] T009 Create base models/entities that all stories depend on
- [ ] T010 Configure clear user-facing error handling
- [ ] T011 Setup environment configuration management without analytics or tracking by default

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 (REQUIRED for constitutional validation; add other tests as needed)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T012 [P] [US1] Unit test for validation rules in tests/unit/test_[name].py
- [ ] T013 [P] [US1] Integration test for [user journey] in tests/integration/test_[name].py

### Implementation for User Story 1

- [ ] T014 [P] [US1] Create [Entity1] model in src/models/[entity1].py
- [ ] T015 [P] [US1] Create [Entity2] model in src/models/[entity2].py
- [ ] T016 [US1] Implement [Service] in src/services/[service].py (depends on T014, T015)
- [ ] T017 [US1] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T018 [US1] Add validation and user-facing error handling
- [ ] T019 [US1] Add accessible labels, keyboard support, responsive layout, and non-color-only status indicators

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (REQUIRED when story changes records, validation, status, URLs, or dates)

- [ ] T020 [P] [US2] Unit test for affected validation/status behavior in tests/unit/test_[name].py
- [ ] T021 [P] [US2] Integration test for [user journey] in tests/integration/test_[name].py

### Implementation for User Story 2

- [ ] T022 [P] [US2] Create [Entity] model in src/models/[entity].py
- [ ] T023 [US2] Implement [Service] in src/services/[service].py
- [ ] T024 [US2] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T025 [US2] Integrate with User Story 1 components (if needed)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (REQUIRED when story changes records, validation, status, URLs, or dates)

- [ ] T026 [P] [US3] Unit test for affected validation/status behavior in tests/unit/test_[name].py
- [ ] T027 [P] [US3] Integration test for [user journey] in tests/integration/test_[name].py

### Implementation for User Story 3

- [ ] T028 [P] [US3] Create [Entity] model in src/models/[entity].py
- [ ] T029 [US3] Implement [Service] in src/services/[service].py
- [ ] T030 [US3] Implement [endpoint/feature] in src/[location]/[file].py

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories
- [ ] TXXX [P] Additional unit tests for validation, status transitions, URL validation, and date handling in tests/unit/
- [ ] TXXX Privacy review confirming no analytics, tracking, or third-party data sharing
- [ ] TXXX Accessibility and responsive layout review
- [ ] TXXX Run lint and format checks
- [ ] TXXX Run quickstart.md validation

---

## Phase N+1: Release Prep (REQUIRED for every feature)

**Purpose**: Land documentation, version metadata, and operator-facing references in the same state the operator will merge. Required by the project constitution for every feature. Runs immediately before the Browser Smoke Test so the smoke test walks the to-be-merged state, not a follow-up snapshot.

- [ ] TXXX Bump version in `package.json` (SemVer: MAJOR / MINOR / PATCH per change shape) and keep any in-app version display (`src/components/Footer.js` `APP_VERSION`, etc.) in sync; update the matching version-string assertions in tests if they pin the literal.
- [ ] TXXX Sync `package-lock.json` to the new version — update the two **root** fields (top-level `version` and `packages[""].version`); leave dependency versions untouched (`npm install --package-lock-only`, or a surgical 2-line edit). The release-metadata test asserts these.
- [ ] TXXX `docs/feature_roadmap.md` — tick the shipped feature `[x]` (note the shipped version), and advance the theme/version row's status if this feature changes it (e.g. Planned → In progress / Shipped).
- [ ] TXXX `CHANGELOG.md` — new `## [<new-version>] — <merge-date>` section above the previous entry; group under **Added**, **Changed**, **Removed**, **Security** as applicable; preserve Keep-a-Changelog format; update the `[Unreleased]` and `[<new-version>]` diff links at the bottom of the file.
- [ ] TXXX `README.md` — add Features bullet(s) for new user-facing surface; add a dedicated section if the feature introduces a new mode, env-var requirement, or operator workflow; update the `Current version` line. Do NOT add a per-feature `specs/###-…/` link under Further Reading — the spec package is indexed in `docs/REPO_MAP.md` (Spec Packages); only link genuinely foundational / operator docs from Further Reading.
- [ ] TXXX `docs/deployment.md` — only required if the feature changes env vars, runtime modes, the architecture diagram, or the deployment procedure. Link the feature's `quickstart.md` rather than restating operator steps.
- [ ] TXXX `docs/REPO_MAP.md` — add entries for every new directory and file; update existing entries whose description changed (factory signatures, new subscriptions, etc.); add a Spec Packages row pointing at `specs/###-feature/` if non-trivial.
- [ ] TXXX Docs sanity check — `grep` the previous version string across `package.json`, `package-lock.json` (root fields only), `src/`, `README.md`, `CHANGELOG.md`, `docs/` and confirm the only remaining matches are historical CHANGELOG headings / diff URLs / dependency versions; verify every new cross-link path exists; confirm the running app renders the new version.

**Note**: Do not duplicate operator-install steps from `quickstart.md` — link to them. The quickstart is authoritative; README and deployment docs are entry points.

---

## Phase N+2: Browser Smoke Test (REQUIRED for UI features)

**Purpose**: Verify the feature end-to-end in a real browser against a running server. Catches rendering, CSS layout, real keyboard interaction, and mobile viewport issues that automated tests cannot detect. Required by the project constitution for any feature with user-facing UI changes.

**Setup**: start the dev server, start the backend, and load seed or fixture data before running these tasks.

For each user story in this feature, add one task using the Independent Test from spec.md as the acceptance bar. Expand to multi-step walkthroughs when the story has complex interaction patterns (multiple triggers, keyboard shortcuts, error states).

- [ ] TXXX [US1] [User Story 1 title] — complete spec.md Independent Test in browser; verify acceptance scenarios 1–N pass
- [ ] TXXX [US2] [User Story 2 title] — complete spec.md Independent Test in browser; verify acceptance scenarios 1–N pass
- [ ] TXXX [US3] [User Story 3 title] — complete spec.md Independent Test in browser; verify acceptance scenarios 1–N pass
- [ ] TXXX Mobile layout — open DevTools at ≤ 640px; confirm no broken layout, single-column stacking, and all interactions work with touch/click

**Note**: Each task MUST define clear pass criteria. A task is complete only when a human has walked through the steps in a real browser and all pass criteria are met. Document any deviations or deferred items with rationale.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish**: Depends on all desired user stories being complete
- **Release Prep (Phase N+1)**: Depends on Polish completion - lands docs and version bump for the to-be-merged state
- **Browser Smoke Test (Phase N+2)**: Depends on Release Prep - walks the to-be-merged state in a real browser

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Required validation tests MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (if tests requested):
Task: "Contract test for [endpoint] in tests/contract/test_[name].py"
Task: "Integration test for [user journey] in tests/integration/test_[name].py"

# Launch all models for User Story 1 together:
Task: "Create [Entity1] model in src/models/[entity1].py"
Task: "Create [Entity2] model in src/models/[entity2].py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
