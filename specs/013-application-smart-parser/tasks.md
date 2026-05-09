# Tasks: Smart Application Creation Flow

**Input**: Design documents from `/specs/013-application-smart-parser/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Tests**: Core validation tests are REQUIRED — this feature touches application creation, URL validation, and required-field enforcement.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

---

## Phase 1: Setup (Skeleton Files)

**Purpose**: Create the two new module stubs so subsequent phases have import targets. Both can be done simultaneously.

- [ ] T001 [P] Create `src/utils/jobPostParser.js` — export a single `parseJobPost(text)` stub that returns `{}`; no logic yet; establishes the module entry point that later tasks fill in
- [ ] T002 [P] Create `src/components/CreationPicker.js` — export `open(callbacks)` and `close()` as no-op stubs; establishes the component module that later tasks implement

**Checkpoint**: Two new files exist and are importable. Running `npm run lint` on them passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Parser implementation and Modal prefill support — both must be complete before US1 can function.

**⚠️ CRITICAL**: Write tests FIRST (T003, T004) and confirm they FAIL before beginning implementation (T005–T010).

### Tests (write first — must FAIL before implementation)

- [ ] T003 [P] Write unit tests in `tests/utils/jobPostParser.test.js` covering:
  - `parseJobPost('')` and `parseJobPost('short')` (< 20 chars) → all fields empty/null/`[]`
  - Company name: labeled "Company: Acme Corp" → `companyName: 'Acme Corp'`; "About Acme Corp" → `companyName: 'Acme Corp'`; no signal → `companyName: ''`
  - Job title: first heading line → correct string; no heading → `jobTitle: ''`
  - Responsibilities: "Responsibilities:\n- Build things" → non-empty string; no section → `responsibilities: ''`
  - Location: "Location: Manila" → `location: 'Manila'`; none → `location: ''`
  - Work setup: "remote" → `workSetup: 'Remote'`; "hybrid" → `workSetup: 'Hybrid'`; "on-site" / "onsite" → `workSetup: 'On-site'`; none → `workSetup: ''`
  - Shift: "night shift" → `shift: 'Night'`; none → `shift: ''`
  - Salary range "₱100,000 – ₱120,000 per month" → `salary: 1200000` (lower bound ₱100,000 × 12 — matches `parseSalaryInput` behavior in `src/utils/currency.js:34`); plain "₱150,000" annual → `salary: 150000`; unparseable → `salary: null`
  - URL: valid `https://` link in text → `jobPostingUrl: 'https://...'`; malformed URL → `jobPostingUrl: ''`
  - Skills section "React, TypeScript" → `skills` includes both; "Preferred: GraphQL" → `preferredSkills` includes it and `skills` includes it too
  - Recruiter: "Contact: Jane Reyes" → `recruiter: 'Jane Reyes'`; none → `recruiter: ''`
  - `compat` is always an integer between 0 and 100 inclusive

- [ ] T004 [P] Add prefill test cases to `tests/components/Modal.test.js`:
  - `Modal.open(null, { mode: 'create', prefill: { companyName: 'Acme', jobTitle: 'Engineer' } })` → draft has `companyName: 'Acme'` and `jobTitle: 'Engineer'`
  - `Modal.open(null, { mode: 'create' })` (no prefill) → draft has `companyName: ''` (existing default behavior unchanged)
  - `Modal.open(existingApp, { mode: 'edit', prefill: { companyName: 'X' } })` → prefill is ignored; draft comes from `existingApp`
  - Prefill `skills: ['React']` → draft `skills` is `['React']` (array merged correctly)

### Implementation

- [ ] T005 Implement text-field extractors in `src/utils/jobPostParser.js`:
  - `extractCompanyName(text)` — label match ("Company:", "Employer:"), "About [Name]" section header, "At [Name]," sentence opener; fallback `''`
  - `extractJobTitle(text)` — first non-empty line 4–80 chars, not all-caps, not bullet/number; or line after "Position:" / "Role:" / "Job Title:" label; fallback `''`
  - `extractResponsibilities(text)` — body of section headed by "Responsibilities", "What You'll Do", "Your Role", "Job Description", "Duties", "About the Role"; fallback: longest paragraph > 100 chars; fallback `''`
  - `extractLocation(text)` — "Location:" / "Based in:" / "Office:" label; fallback `''`
  - `extractRecruiter(text)` — "Contact:" / "Recruiter:" / "Hiring Manager:" label on same line; fallback `''`

- [ ] T006 Implement enum extractors in `src/utils/jobPostParser.js`:
  - `extractWorkSetup(text)` — case-insensitive scan: `remote` → `'Remote'`; `hybrid` → `'Hybrid'`; `on-site` / `onsite` / `in-office` → `'On-site'`; `field` as standalone word → `'Field'`; first match wins; fallback `''`
  - `extractShift(text)` — `day shift` → `'Day'`; `mid shift` / `mid-shift` → `'Mid'`; `night shift` → `'Night'`; `flexible` (schedule/hours) → `'Flexible'`; fallback `''`

- [ ] T007 Implement salary extractor `extractSalary(text)` in `src/utils/jobPostParser.js`:
  - Regex: `/(₱|PHP|USD|\$)\s*[\d,]+(?:\s*[-–—to]+\s*[\d,]+)?(?:\s*(per\s+month|\/mo|monthly|per\s+year|\/yr|annually|annual|yearly))?/i`
  - Parse both bounds of a range; use the lower bound
  - Monthly indicator (per month, /mo, monthly): lower bound × 12
  - Annual indicator (per year, /yr, annually, annual): use as-is
  - Ambiguous (no period indicator): if value > 20,000 treat as annual; else × 12
  - Strip commas from numeric strings before parsing
  - Return positive integer or `null` on failure
  - Constraint: do NOT import `parseSalaryInput` from `src/utils/currency.js` — that utility is for form input parsing; keep parser self-contained

- [ ] T008 Implement URL and skills extractors in `src/utils/jobPostParser.js`:
  - `extractUrl(text)` — regex for first `https?://` URL; pass through `validateUrl` imported from `src/utils/validate.js`; return valid URL string or `''`
  - `extractSkills(text)` — find sections "Required Skills", "Skills", "Qualifications", "Requirements", "Tech Stack", "Technologies"; extract comma-separated or bullet-delimited items; return deduped string array
  - `extractPreferredSkills(text)` — find sections "Preferred Skills", "Nice to Have", "Bonus", "Preferred Qualifications"; extract items; return deduped string array (these are also unioned into `skills`)

- [ ] T009 Implement `parseJobPost(text)` in `src/utils/jobPostParser.js` (depends on T005–T008):
  - Call all extractors; assemble result object using field names from `data-model.md`
  - Union `extractPreferredSkills(text)` result into the `skills` array (deduped)
  - Set `compat: Math.floor(Math.random() * 101)`
  - Return the assembled partial object; do NOT call `normalizeApplication` here (Modal's `open()` already calls it via the spread)
  - Constraint: no DOM access, no network calls, no imports from `src/components/` or `src/services/`

- [ ] T010 Add `prefill` optional parameter to `Modal.open()` in `src/components/Modal.js`:
  - Signature change: `open(application, { mode, prefill, onApplicationUpdate, onApplicationCreate, onArchiveSuccess } = {})`
  - In create-mode branch only: `_draft = { ...normalizeApplication({}), status: 'wishlisted', compat: 0, ...(prefill ?? {}) }`
  - Edit-mode branch: unchanged — `prefill` is ignored
  - All existing `Modal.open()` call sites pass no `prefill`; default behavior is fully preserved
  - Out-of-scope: no changes to `_renderBody()`, `validateDraft()`, `saveDraft()`, or any other Modal internals

- [ ] T011 Verify foundational tests pass (depends on T003–T010):
  - Run `npx vitest run tests/utils/jobPostParser.test.js` → all tests green
  - Run `npx vitest run tests/components/Modal.test.js` → all tests green (including new prefill cases)
  - Run `npm run lint` on `src/utils/jobPostParser.js` and `src/components/Modal.js` → no errors

**Checkpoint**: Parser is fully implemented and tested. Modal accepts prefill. No UI changes visible yet.

---

## Phase 3: User Story 1 — Smart Parser Happy Path (Priority: P1) 🎯 MVP

**Goal**: User clicks "New Application", chooses Smart Parser, pastes a job post, clicks Process, and the existing application form opens pre-filled with extracted values for review and save.

**Independent Test**: Click "New Application" → Smart Parser card → paste the sample job post from `quickstart.md` → click Process → verify company, title, location, salary, work setup, and skills are pre-filled in the modal form → save → record appears in the list.

### Implementation

- [ ] T012 [US1] Implement CreationPicker overlay shell in `src/components/CreationPicker.js`:
  - Module-level state vars: `_backdrop`, `_panel`, `_keydownHandler`, `_callbacks`
  - `open(callbacks)`: saves callbacks, builds backdrop + panel DOM, appends to `document.body`, traps focus, registers Escape keydown handler
  - `close()`: removes backdrop, removes keydown handler, nulls state vars
  - Backdrop click closes the picker (if click target is the backdrop itself)
  - Escape key closes the picker (unless a nested input/select is focused)
  - `panel`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="creation-picker-title"`
  - Out-of-scope: no view rendering yet (placeholder content only)

- [ ] T013 [US1] Implement selection screen view in `src/components/CreationPicker.js`:
  - Renders inside the panel when the picker opens
  - Two cards: Smart Parser (sparkle/magic-wand SVG icon, title "Paste the job post and the app will parse", short description) and Manual Entry (pencil SVG icon, title "Enter it manually instead", short description)
  - Smart Parser card is visually more prominent (different background or border)
  - Each card is keyboard-accessible: `tabindex="0"`, `role="button"`, responds to Enter and Space
  - Clicking Smart Parser card calls `_showPasteStep()` (internal transition; implemented in T014)
  - Clicking Manual Entry card is wired in Phase 4 (US2) — leave as a no-op stub for now
  - Layout class: `.creation-picker-cards` (styled in T017)

- [ ] T014 [US1] Implement paste step view in `src/components/CreationPicker.js`:
  - `_showPasteStep()`: replaces panel content with paste-step view (no full re-open)
  - Paste step contains: a `<textarea>` (large, multiline, `aria-label="Paste job posting text"`), a Process `<button>` (disabled when `textarea.value.trim().length < 20`)
  - Textarea `input` event: enable/disable Process button in real time
  - Process button `click`: call `_runParser()` (T015)
  - Loading state during `_runParser()`: show loading message ("Analyzing job post..." or spinner), disable textarea and Process button
  - Constraint: do not call `parseJobPost` yet — just wire the flow shell; `_runParser()` is implemented in T015

- [ ] T015 [US1] Implement Smart Parser success path `_runParser()` in `src/components/CreationPicker.js`:
  - Calls `parseJobPost(textarea.value)` from `src/utils/jobPostParser.js`
  - Zero-fields check: if all of `companyName`, `jobTitle`, `location`, `salary`, `workSetup`, `skills` are empty/null/`[]` in the result → trigger error state (T022, Phase 5)
  - On ≥1 useful field: call `close()`, then `Modal.open(null, { mode: 'create', prefill: parsedData, ...callbacks })`
  - Import `Modal` from `./Modal.js` and `parseJobPost` from `../utils/jobPostParser.js`
  - Constraint: `parseJobPost` is synchronous; no async/await needed for the parse call itself

- [ ] T016 [US1] Update `onAddApplication()` in `src/pages/Tracker.js`:
  - Add import: `import { CreationPicker } from '../components/CreationPicker.js'`
  - Replace the `Modal.open(null, { mode: 'create', ...callbacks })` call with `CreationPicker.open({ onApplicationCreate, onApplicationUpdate, onArchiveSuccess })`
  - Remove the direct `Modal` import only if it is no longer used elsewhere in the file; otherwise keep it
  - Out-of-scope: no other changes to `Tracker.js`

- [ ] T017 [US1] Add CreationPicker styles to `src/styles/main.css`:
  - `.creation-picker-backdrop` — full-screen fixed overlay, same visual layer as `.modal-backdrop`
  - `.creation-picker-panel` — centered card, max-width ~600px on desktop, full-width with padding on mobile
  - `.creation-picker-title` — visible panel heading (used as `aria-labelledby` target)
  - `.creation-picker-cards` — flex row, gap between cards, wraps on mobile
  - `.creation-picker-card` — flex column, border, padding, cursor pointer, hover state
  - `.creation-picker-card--parser` — accent border or background to make it more visually prominent
  - `.creation-picker-card__icon` — icon sizing
  - `.creation-picker-card__title` and `.creation-picker-card__desc` — typography
  - `.parser-step` — paste step wrapper
  - `.parser-textarea` — full-width, min-height ~160px, resize vertical
  - `.parser-process-btn` — primary action button, full-width or right-aligned
  - `.parser-loading` — loading indicator container
  - Responsive: at ≤640px, `.creation-picker-cards` switches to flex-column (cards stacked)

- [ ] T018 [US1] Update `tests/pages/Tracker.test.js`:
  - Find test(s) that call or stub `onAddApplication` and assert `Modal.open` is called
  - Update to: stub `CreationPicker.open` instead of `Modal.open`; assert `CreationPicker.open` is called with the correct callback shape
  - Constraint: do not change any other test in the file

- [ ] T019 [US1] Verify US1 checkpoint:
  - Run `npx vitest run tests/pages/Tracker.test.js` → passes
  - Run `npm run test:run` → all existing tests still pass (no regressions)
  - Manual check: in browser, click "New Application" → picker opens → Smart Parser card visible → paste step appears → Process button disabled until text typed

**Checkpoint**: Smart Parser happy path is fully functional and independently testable.

---

## Phase 4: User Story 2 — Manual Entry Path (Priority: P2)

**Goal**: User clicks "New Application", chooses Manual Entry from the selection screen, and the existing application form opens exactly as it did before this feature.

**Independent Test**: Click "New Application" → Manual Entry card → verify the existing application form opens immediately with no behavioral change → fill and save normally.

### Implementation

- [ ] T020 [US2] Wire Manual Entry card in `src/components/CreationPicker.js`:
  - In the selection screen (T013), replace the Manual Entry card no-op with: `close()` then `Modal.open(null, { mode: 'create', ...callbacks })`
  - This is the only change in this phase — one event-handler wire-up
  - Constraint: `Modal.open` call here must be identical in arguments to the pre-feature `onAddApplication()` call (no `prefill`, no extra options)

- [ ] T021 [US2] Verify US2 checkpoint:
  - Run `npm run test:run` → all tests pass
  - Manual check: click "New Application" → Manual Entry → existing form opens → fill required fields → save → record in list (identical to pre-feature behavior)

**Checkpoint**: Both creation paths (Smart Parser and Manual Entry) are functional.

---

## Phase 5: User Story 3 — Error and Recovery States (Priority: P3)

**Goal**: Empty or insufficient paste is blocked before processing. A parse that yields no useful fields shows a non-blocking error with retry and manual-entry fallback — the user is never left stuck.

**Independent Test**: (a) Open Smart Parser, leave textarea empty — Process button disabled. (b) Paste < 20 chars — Process still disabled. (c) Paste garbage text → click Process → error message appears → Retry stays in paste step → "Enter manually" opens the form.

### Implementation

- [ ] T022 [US3] Enforce empty/short input guard in `src/components/CreationPicker.js` paste step:
  - Confirm T014's `input` event handler correctly sets `Process.disabled = textarea.value.trim().length < 20`
  - Also disable on paste events: listen to `paste` event and evaluate `setTimeout(() => ..., 0)` after paste lands
  - Verify that a textarea with exactly 19 characters keeps Process disabled; 20 characters enables it
  - Out-of-scope: no tooltip or inline message is required — disabled button is sufficient per spec

- [ ] T023 [US3] Implement parse failure error state in `src/components/CreationPicker.js`:
  - In `_runParser()` (T015), when zero-fields check fails, replace paste-step content with error view:
    - Error message: "Unable to extract application details. Please review the pasted content or enter details manually."
    - Retry button: restores the paste step with the textarea content preserved (user does not need to re-paste)
    - "Enter manually" button: calls `close()` then `Modal.open(null, { mode: 'create', ...callbacks })` (same as Manual Entry path)
  - Error view must not be a modal-on-top-of-modal — it renders inside the existing CreationPicker panel
  - Focus moves to the first focusable element in the error view on render

- [ ] T024 [US3] Add error state styles to `src/styles/main.css`:
  - `.parser-error` — error state container, non-blocking (no red overlay), inside `.parser-step`
  - `.parser-error__message` — readable error text, muted or warning color
  - `.parser-error__actions` — row of Retry and "Enter manually" buttons

- [ ] T025 [US3] Verify US3 checkpoint:
  - Run `npm run test:run` → all tests pass
  - Manual check: (a) empty paste → Process disabled; (b) garbage paste → error message with both recovery options; (c) Retry → textarea still editable; (d) "Enter manually" → form opens

**Checkpoint**: All three user stories are fully functional and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, responsive layout, lint/format, and full test suite verification.

- [ ] T026 [P] Accessibility pass on `src/components/CreationPicker.js`:
  - Confirm all interactive elements have `aria-label` or visible text
  - Confirm focus moves to first focusable element when picker opens (`getFocusableElements` pattern from `Modal.js`)
  - Confirm focus is trapped within the panel (Tab and Shift+Tab cycle within overlay)
  - Confirm Escape closes the picker from any view (selection, paste step, error state)
  - Confirm Smart Parser and Manual Entry cards respond to Enter and Space keys
  - Confirm both recovery buttons in error state (Retry, Enter manually) are keyboard-reachable

- [ ] T027 [P] Responsive layout verification in `src/styles/main.css`:
  - At ≤640px viewport: confirm `.creation-picker-cards` stacks vertically with no horizontal scroll
  - Confirm `.creation-picker-panel` has adequate padding and does not clip on small screens
  - Confirm `.parser-textarea` is usable on a mobile viewport (min-height, font-size)
  - Confirm the Process button and error state buttons are tap-target sized (≥44px height)

- [ ] T028 [P] Run lint and fix any issues:
  - `npm run lint` targeting: `src/utils/jobPostParser.js`, `src/components/CreationPicker.js`, `src/components/Modal.js`, `src/pages/Tracker.js`
  - Fix any ESLint errors before proceeding; do not suppress rules with inline comments

- [ ] T029 Run full test suite and confirm clean:
  - `npm run test:run` → all tests pass, zero failures
  - Confirm `tests/utils/jobPostParser.test.js`, `tests/components/Modal.test.js`, `tests/pages/Tracker.test.js` are all green

**Checkpoint**: Code is clean, accessible, responsive, and fully tested.

---

## Phase 7: Browser Smoke Test (REQUIRED — constitution §1.1.0)

**Purpose**: Verify the feature end-to-end in a live browser. Catches rendering, CSS layout, real keyboard interaction, and mobile viewport issues that automated tests cannot detect.

**Setup**: `npm run dev` (frontend) + `npm run server:dev` (backend) in two terminals. Open `http://localhost:5173`.

- [ ] T030 [US1] Smart Parser happy path — paste the sample job post from `quickstart.md`:
  - Click "New Application" → selection overlay appears with two cards
  - Selection screen is visually correct (sparkle icon on parser card, pencil icon on manual card; parser card more prominent)
  - Click Smart Parser card → paste step appears (textarea + disabled Process button)
  - Paste fewer than 20 characters → Process remains disabled
  - Paste full sample job post → Process enables
  - Click Process → loading indicator visible briefly
  - Application form opens pre-filled: Company "Acme Corp", Job Title "Senior Frontend Engineer", Location "Manila, Philippines", Work Setup "Remote", Salary ₱1,200,000 (lower bound ₱100k/mo × 12), Responsibilities non-empty (extracted from the "Responsibilities:" section), Skills include React and TypeScript
  - Edit one field → dirty state activates, Save/Discard appear
  - Click Create → record appears in list
  - **Pass criteria**: all pre-fill values match expected; existing form behavior unchanged; record saved

- [ ] T031 [US2] Manual Entry path:
  - Click "New Application" → selection overlay appears
  - Click "Manual Entry" → existing application form opens immediately (no paste step)
  - Behavior is identical to clicking "New Application" before this feature: all fields blank, Create button visible
  - Fill required fields (Job Title, Company, Responsibilities) → save
  - **Pass criteria**: form opens with zero behavioral change from pre-feature flow; record saved

- [ ] T032 [US3] Error and recovery states:
  - Click "New Application" → Smart Parser → leave textarea empty → confirm Process button is disabled
  - Type 5 characters → Process still disabled; type 20+ characters → Process enables
  - Clear textarea → Process disables again
  - Paste text with no recognizable job-post signals (e.g. "Lorem ipsum dolor sit amet consectetur adipiscing elit.") → click Process
  - Error message appears: "Unable to extract application details. Please review the pasted content or enter details manually."
  - Click Retry → paste step returns, previous text preserved
  - Click Process again → error returns
  - Click "Enter manually" → existing application form opens
  - **Pass criteria**: each sub-step behaves exactly as described; no frozen states or blank screens

- [ ] T033 Mobile viewport — open DevTools responsive mode at 390×844 (iPhone 14):
  - Click "New Application" → selection cards are stacked vertically (not side-by-side)
  - Overlay fits within viewport with no horizontal scroll
  - Tap Smart Parser → paste step renders correctly; textarea is tappable with usable height
  - Paste sample text → Process enables → tap Process → form opens pre-filled
  - All form fields are accessible and tappable
  - **Pass criteria**: no layout breakage, no horizontal scroll, all interactions work at mobile size

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS Phase 3
- **Phase 3 (US1)**: Depends on Phase 2 complete
- **Phase 4 (US2)**: Depends on Phase 3 (extends CreationPicker from T012–T013)
- **Phase 5 (US3)**: Depends on Phase 3 (extends paste step from T014–T015)
- **Phase 6 (Polish)**: Depends on Phases 3–5 complete
- **Phase 7 (Smoke Test)**: Depends on Phase 6 complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2). No dependency on US2 or US3.
- **US2 (P2)**: Depends on US1's CreationPicker shell and selection screen (T012–T013). A one-task addition.
- **US3 (P3)**: Depends on US1's paste step (T014–T015). Adds error states on top of existing paste step.

### Parallel Opportunities Within Phases

**Phase 2**:
- T003 and T004 (write tests): run in parallel — different test files
- T006, T007, T008 (extractor implementations): run in parallel — all within `jobPostParser.js` but each is a separate private function group with no interdependency

**Phase 3**:
- T017 (CSS) and T018 (Tracker test update): run in parallel — different files
- T012–T015 (CreationPicker implementation) must be sequential (each builds on previous)

**Phase 6**:
- T026, T027, T028 are all parallel — different files/concerns

---

## Parallel Example: Phase 2 Foundational

```
Parallel group A — write tests first:
  T003: tests/utils/jobPostParser.test.js
  T004: tests/components/Modal.test.js

Sequential — implement (after tests written):
  T005: text extractors in jobPostParser.js
  T006 + T007 + T008: enum / salary / URL+skills (parallel within this group)
  T009: parseJobPost() — composes T005–T008
  T010: Modal.js prefill option
  T011: verify all tests green
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T011) — CRITICAL prerequisite
3. Complete Phase 3: User Story 1 (T012–T019)
4. **STOP and VALIDATE**: paste a job post, verify pre-fill, save — confirm US1 works end to end
5. Add US2 and US3 incrementally

### Incremental Delivery

1. Phases 1–2 → parser and Modal prefill complete (unit-testable)
2. Phase 3 (US1) → Smart Parser happy path works → demo-able MVP
3. Phase 4 (US2) → Manual Entry restored through new screen
4. Phase 5 (US3) → Error states handled gracefully
5. Phase 6 → Polish + lint
6. Phase 7 → Browser verification → feature complete

---

## Notes

- T003 and T004 tests MUST be written and confirmed failing BEFORE implementation begins (T005–T010)
- `parseJobPost` is synchronous — no async/await needed in the parse call path
- `CreationPicker.js` follows the same module-level state variable pattern as `Modal.js` — no class, no framework
- The `prefill` parameter in `Modal.open()` is additive only — all existing call sites are unaffected
- Salary in sample job post is monthly (₱120,000/mo) → annual ₱1,440,000 after ×12 conversion
- Commit after each phase checkpoint at minimum; committing after each task is preferred
