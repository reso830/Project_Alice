# Plan Review Checklist: 014-resume-parser-profile

Reviewer completes this before accepting the plan and moving to tasks.

---

## Constitution Compliance

- [ ] **I. User-First Application Tracking** — Does this feature support users tracking
  job applications clearly? *(This is a profile feature; it does not touch application
  records directly. Constitution applies insofar as profile data enriches application
  tracking context.)*

- [ ] **II. Simple, Maintainable Architecture** — Is the plan direct and readable?
  - New modules have single, clear responsibilities (extractor, parser, router, component)
  - Merge logic is centralized in `profile.js` model, not duplicated in UI code
  - No clever abstractions; heuristic parser is explicit regex/string logic

- [ ] **III. Data Integrity and Validation** — Is data validated before saving?
  - Resume import does NOT auto-save; user must click Save explicitly
  - Merge rules prevent silent overwrites of existing profile data
  - Incomplete parsed entries (e.g. missing issuingBody) reach the form; existing
    profile validation prevents saving until the user completes them

- [ ] **IV. Practical UX** — Does the feature reduce friction without adding complexity?
  - Loading feedback with cycling messages during processing
  - Graceful failure with Retry and Continue Manually
  - All parsed fields remain editable; no lock-in

- [ ] **V. Testing and Quality Gates**
  - [ ] Merge rules covered by automated tests (`tests/models/resumeMerge.test.js`)
  - [ ] Server endpoint covered by integration tests (`tests/server/resume.test.js`)
  - [ ] Parser unit tests with fixture text (`tests/server/resumeParser.test.js`)
  - [ ] Existing Profile.test.js and ProfileEdit.test.js updated (not deleted)
  - [ ] Browser smoke test phase required (UI feature)

---

## Plan Completeness

- [ ] Architecture is described (layers: browser, server, shared model)
- [ ] Data flow is described end-to-end
- [ ] All new files listed with purpose
- [ ] All modified files listed with scope of change
- [ ] New dependencies listed with justification
- [ ] Risks and tradeoffs identified
- [ ] Affected areas section complete (modify / inspect / add tests / out of scope)

---

## Supporting Artifacts

- [ ] `data-model.md` — ParsedProfileData shape + merge rules + date normalization
- [ ] `contracts/api.md` — POST /api/resume/parse request/response contract
- [ ] `research.md` — library choices with rationale (pdf-parse, mammoth, multer)

---

## Open Items / Flags

- **Parse quality is inherently limited**: heuristic parsing without AI/LLM will miss
  or mis-map fields on non-standard resumes. Users must be clearly informed that
  imported data requires review. The import widget copy should set this expectation.

- **`pdf-parse` Node 20+ deprecation warning**: may appear in test output. Document
  in tasks and handle during implementation (mock in tests if needed).

- **ProfileEdit re-render on import**: calling `renderEditPage(container)` after merge
  re-renders the full page including the import widget (returns to idle). Acceptable.
  Any open inline overlay is lost, but the UI prevents overlays from being open during
  an active import operation.

---

## Sign-off

- [ ] Plan reviewed and accepted → proceed to `/speckit.tasks`
- [ ] Notes: _______________________________________________
