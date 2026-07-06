# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Application records include required company name, job title, controlled status,
  and last_status_update date (auto-set on creation and on status change); optional
  fields are intentionally scoped.
- Business logic is separated from UI rendering, with centralized reusable
  validation rules.
- Required field, URL, date format, status transition, and overwrite/corruption
  risks are addressed before saving.
- Main workflows cover add, edit, search, filter, review, stale applications, and
  pending follow-ups with clear empty, loading, and error states.
- Automated tests cover core validation logic and any changed status/date
  behavior; lint/format commands are identified.
- Privacy remains local-first by default with no analytics, tracking, or external
  data sharing unless explicitly specified.
- Desktop/mobile responsiveness, form labels, validation messages, keyboard
  navigation, and non-color-only status indicators are planned.
- Data model choices preserve future extensibility for interviews, contacts,
  documents, reminders, and salary tracking without overbuilding them.
- If this is a visual-fidelity feature (Principle V — implemented against a
  design prototype / high-fidelity handoff), the Visual-Fidelity Mode section
  below is filled in; otherwise it is marked N/A.

## Visual-Fidelity Mode

*Fill in ONLY if this feature is implemented against a design prototype, mockup
set, or high-fidelity handoff. Otherwise write "N/A — no design handoff; standard
logic-feature flow." Small visual tweaks follow the principles below without the
full harness (see the proportionality note in Principle V).*

- **Feature classification**: [Visual-fidelity | Mixed | N/A]
- **Canonical design source**: [path(s) to the prototype/handoff, pinned. This is
  the source of truth — tasks reference it (file + section/lines); they do NOT
  paraphrase pixels or motion into prose.]
- **Target stack vs prototype stack**: [e.g. prototype = React+HTML; target =
  Vanilla JS. If they differ, tasks lift the prototype stylesheet/tokens wholesale
  and replicate the DOM element-for-element — no restructuring.]
- **Breakpoints / checkpoints to verify**: [e.g. 390 / 768 / 1440px; animation
  checkpoints where applicable, e.g. 0 / 900 / 1800ms + reduced-motion/settled.]
- **Tier 1 harness**: [`npm run test:visual` — Playwright geometry assertions,
  headless, animations frozen, mock data seeded via a test flag. Note whether the
  harness already exists (reused across features) or needs a setup task this
  feature. See `.specify/templates/checklist-fidelity-template.md` for the spec.]
- **Tier 2 judge**: [implementing agent self-serves after an in-session image-view
  preflight; otherwise names the vision-capable reviewer / operator who does it.]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
