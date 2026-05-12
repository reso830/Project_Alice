# Tasks: Resume Auto-Parser for Profile Builder

**Input**: `specs/014-resume-parser-profile/spec.md`, `plan.md`, `data-model.md`,
`contracts/api.md`, `research.md`
**Feature Branch**: `014-resume-parser-profile`

**Tests**: Merge rules, endpoint behaviour, and parser unit tests are REQUIRED by the
constitution. Existing Profile.test.js and ProfileEdit.test.js must be updated before
implementing the changes that break them.

---

## Phase 1: Foundation — Dependencies, Tests, and Shared Logic

**Purpose**: Install packages, write unit tests first, then implement the two shared
modules (`extractor.js`, `parser.js`, `mergeResumeData`). Tests T005 and T006 are
written in this phase (before T003/T004) so they fail on first run and pass once
implementation is complete. No user-visible changes in this phase.

**⚠️ CRITICAL**: Phases 2–4 cannot begin until this phase is complete.

**Order within phase**: T001 → T002 → T005+T006 (write tests; they must fail) →
T003+T004 (implement until tests pass)

---

### T001 — Install server-side dependencies

**Target files**: `package.json`

**Expected behaviour**:
- Add `multer`, `pdf-parse`, and `mammoth` to `dependencies`
- Running `npm install` succeeds with no errors

**Constraints**:
- All three packages go in `dependencies` (not `devDependencies`); they are used at
  runtime by the server
- Do NOT install any frontend packages or AI/LLM libraries
- Verify each package can be imported in a Node 20+ ESM context

**Validation**: `npm install` exits 0; `node -e "import('multer')"` (and equivalents
for the other two) exits 0.

**Out of scope**: Any code changes; configuration changes beyond `package.json`.

---

### T002 — Create text extractor module

**Target files**: `server/resume/extractor.js` *(new)*

**Expected behaviour**:
- Export `extractText(buffer, mimetype, originalname)` → `Promise<string>`
- `application/pdf` → calls `pdf-parse(buffer)`, returns `.text`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → calls
  `mammoth.extractRawText({ buffer })`, returns `.value`
- `text/plain` → returns `buffer.toString('utf8')`
- `application/octet-stream` or empty/falsy mimetype → fall back to the lowercase
  extension of `originalname`:
  - `.pdf` → PDF path; `.docx` → DOCX path; `.txt` → TXT path
  - Any other extension → throws `Error('Unsupported file type')`
- Any other unrecognized mimetype → throws `Error('Unsupported file type')`

**Constraints**:
- No file is written to disk; the buffer is only held in memory during the call
- The function must be `async` (both `pdf-parse` and `mammoth` are async)
- The thrown error message must be catchable by the route handler in T008
- The extension fallback ensures a valid `.docx` accepted client-side is not rejected
  server-side when Firefox or similar sends `application/octet-stream`

**Validation**: Covered by parser tests in T005 (indirectly) and by the endpoint test
in T007 (directly). Manual spot-check: `node -e "import('./server/resume/extractor.js')"`.

**Out of scope**: `server/routes/resume.js`, `server/index.js`, any frontend files.

---

### T005 [P] — Write parser unit tests

**Target files**: `tests/server/resumeParser.test.js` *(new)*

**Expected behaviour** — Write these tests BEFORE implementing T003. They MUST FAIL
on first run (module does not yet exist). They guide T003 and pass once it is complete:

Test cases to cover:
1. Contact block — plain text with name, email, phone, city on separate lines
   → `firstName`, `lastName`, `email`, `phone`, `city` are populated
2. LinkedIn URL in contact block → appears in `links[]` with `friendlyName: 'LinkedIn'`
3. Summary section header present → `summary` is populated
4. No summary section header → `summary` is null
5. Experience section with one job block (company, role, date range, bullets)
   → one entry in `experience[]` with correct `role`, `company`, `dateStarted`,
   `dateEnded`, `currentWork: false`
6. Experience entry with "Present" as end date → `currentWork: true`, `dateEnded: ''`
7. Skills section with comma-separated values → `skills[]` contains each trimmed skill
8. No Skills section → `skills` is `[]`
9. Education section with degree, school, graduation year → one `education[]` entry
10. Language listed without proficiency → proficiency defaults to `'Intermediate'`
11. Empty string input → all scalars null, all arrays empty (complete failure case)
12. Date formats: `Jan 2022`, `January 2022`, `01/2022` all normalize to `'01/2022'`

**Constraints**:
- Use inline fixture strings (no external files); keep fixtures small and focused
- Use `vitest` (`describe`, `it`, `expect`) consistent with `tests/models/profile.test.js`
- Do not import from `src/` (server-only test)
- Tests must be written before T003 is complete; they must initially fail

**Validation**: `npm run test:run -- tests/server/resumeParser.test.js` — all pass
after T003 is complete.

---

### T006 [P] — Write merge rule tests

**Target files**: `tests/models/resumeMerge.test.js` *(new)*

**Expected behaviour** — Write these tests BEFORE implementing T004. They MUST FAIL
on first run (`mergeResumeData` does not yet exist). They guide T004 and pass once
it is complete:

Test cases to cover (mapped to spec FR-025 to FR-028):
1. **FR-025** — Non-empty singular field is not overwritten:
   - `currentProfile.firstName = 'Alice'`, `parsedData.firstName = 'Bob'`
   → result `firstName === 'Alice'`
2. **FR-026** — Empty singular field is filled:
   - `currentProfile.email = ''`, `parsedData.email = 'a@b.com'`
   → result `email === 'a@b.com'`
3. **FR-026** — Null parsed scalar does not corrupt an empty field:
   - `currentProfile.phone = ''`, `parsedData.phone = null`
   → result `phone === ''`
4. **FR-027** — Collection entries are appended, not replaced:
   - `currentProfile.skills = ['JS']`, `parsedData.skills = ['Python']`
   → result `skills === ['JS', 'Python']`
5. **FR-028 experience** — Duplicate blocked (same company + role + dateStarted):
   - Existing entry `{ company: 'Acme', role: 'Dev', dateStarted: '01/2020' }`
   - Parsed entry same key → not appended; length unchanged
6. **FR-028 experience** — Non-duplicate appended:
   - Parsed entry with different `dateStarted` → appended; length increases by 1
7. **FR-028 skills** — Case-insensitive dedup: existing `'JavaScript'`, parsed
   `'javascript'` → not appended
8. **FR-028 education** — Duplicate blocked (same university + degreeMajor + yearCompleted)
9. **FR-028 certifications** — Duplicate blocked (same name + issuingBody)
10. **FR-028 languages** — Duplicate blocked (same language, case-insensitive)
11. **FR-028 links** — Duplicate blocked (same URL, trailing slash normalized)
12. **FR-028 awards** — Duplicate blocked (same awardName + issuingBody)
13. Immutability: `mergeResumeData` does not mutate `currentProfile` or `parsedData`
14. Null/undefined `parsedData` → returns a copy of `currentProfile` without throwing

**Constraints**:
- Import only from `src/models/profile.js`
- Use `vitest` consistent with `tests/models/profile.test.js`
- Tests must be written before T004 is complete; they must initially fail

**Validation**: `npm run test:run -- tests/models/resumeMerge.test.js` — all pass
after T004 is complete.

---

### T003 — Create heuristic resume parser

**Target files**: `server/resume/parser.js` *(new)*

**Expected behaviour**:
- Export `parseResumeText(text)` → `ParsedProfileData` (shape from `data-model.md`)
- All fields default to `null` (scalars) or `[]` (arrays) when not found
- Section detection: split text into lines; find the first line matching each section
  keyword (case-insensitive) to define section boundaries:
  - Contact/header block: lines before the first recognized section header
  - Summary: `SUMMARY`, `ABOUT`, `PROFILE`, `OBJECTIVE`
  - Experience: `EXPERIENCE`, `EMPLOYMENT`, `WORK HISTORY`
  - Education: `EDUCATION`, `ACADEMIC`
  - Skills: `SKILLS`, `COMPETENCIES`, `TECHNOLOGIES`
  - Certifications: `CERTIF`, `LICENSE`
  - Awards: `AWARD`, `HONOR`, `ACHIEVEMENT`
  - Languages: `LANGUAGE`
- Contact block parsing:
  - Name: first non-blank line that is not an email, phone, or URL; split on the
    first space — before → `firstName`, rest → `lastName`
  - Email: regex `[\w.+-]+@[\w-]+\.[a-z]{2,}`
  - Phone: regex matching 7–15 digit sequences with optional `+`, spaces, parens,
    dashes; e.g. `+1 (555) 123-4567`, `555-123-4567`
  - LinkedIn URL: pattern `linkedin\.com/in/[\w-]+`
  - Portfolio URL: any `https?://` URL that is not LinkedIn
  - City: line matching `Word, XX` or `Word, Word` near the top (after name, before
    first section header)
- Date normalization (see `data-model.md`):
  - Month name/abbrev + 4-digit year → `MM/YYYY`
  - `MM/YYYY` already → pass through
  - `YYYY` alone → `01/YYYY`
  - "Present" / "Current" / "now" / "–" as end date → set `currentWork: true`,
    `dateEnded: ''`
  - Unrecognized → `''`
- Skills: split on `,`, `•`, `|`, or newline within the Skills section; trim each
  item; discard blank items
- Language proficiency: map stated level (case-insensitive) to nearest
  `Beginner | Intermediate | Professional | Fluent`; if absent, default to
  `'Intermediate'`
- Partial results are always returned; no exception thrown for missing sections

**Constraints**:
- No external HTTP calls; no AI/LLM
- Must return the exact field names defined in `data-model.md`; do not introduce
  additional fields
- Keep parsing logic in this single file; do not import from frontend code

**Validation**: `tests/server/resumeParser.test.js` (written in T005). Run with
`npm run test:run -- tests/server/resumeParser.test.js`.

**Out of scope**: Route wiring, frontend, CSS, database.

---

### T004 — Add `mergeResumeData` to profile model

**Target files**: `src/models/profile.js`

**Expected behaviour**:
- Export `mergeResumeData(currentProfile, parsedData)` → new profile object
- Does NOT mutate either argument; returns a deep copy
- Singular fields (`firstName`, `lastName`, `email`, `phone`, `city`, `summary`):
  - Keep `currentProfile[field]` if it is a non-empty string
  - Fill with `parsedData[field]` only if `currentProfile[field]` is empty AND
    `parsedData[field]` is a non-null, non-empty string
- Collection fields (`experience`, `education`, `certifications`, `skills`,
  `languages`, `awards`, `links`):
  - For each entry in `parsedData[field]`, check the duplicate key (see `data-model.md`)
  - If no duplicate found in `currentProfile[field]`, append the entry
  - Duplicate key normalization: `trim().replace(/\s+/g, ' ').toLowerCase()`
  - Duplicate keys per field:
    - `experience`: `company + role + dateStarted`
    - `education`: `university + degreeMajor + yearCompleted`
    - `certifications`: `name + issuingBody`
    - `skills`: skill string itself
    - `languages`: `language`
    - `links`: `url` (lowercased, trailing slash removed)
    - `awards`: `awardName + issuingBody`

**Constraints**:
- Function must be pure (no side effects, no global state)
- Null or undefined `parsedData` fields must be handled without throwing
- Existing exports (`normaliseProfile`, `validateProfile`, etc.) must not be changed

**Validation**: `tests/models/resumeMerge.test.js` (written in T006). Run with
`npm run test:run -- tests/models/resumeMerge.test.js`.

**Out of scope**: `server/`, `src/pages/`, `src/components/`.

---

## Phase 2: Server Endpoint

**Purpose**: Expose `POST /api/resume/parse`, covered by tests. No frontend changes.

**⚠️ Write tests before implementation (T007 before T008–T009).**

---

### T007 [P] — Write server endpoint tests

**Target files**: `tests/server/resume.test.js` *(new)*

**Expected behaviour** — Tests MUST FAIL before T008–T009 are complete:

Use the `withServer` / `makeMemoryDb` pattern from `tests/server/applications.test.js`.
For file uploads, use the Node.js `FormData` + `Blob` API (available in Node 20+) or
construct a multipart body manually.

Test cases to cover (mapped to `contracts/api.md`):
1. `POST /api/resume/parse` with a valid TXT file (plain text resume) → 200,
   `body.data` is an object with at least `firstName`, `skills`, `experience` keys
2. No file field in the request → 400, `body.error.code === 'VALIDATION_ERROR'`
3. File with unsupported MIME type (e.g. `image/png`) → 400,
   `body.error.code === 'UNSUPPORTED_FILE_TYPE'`
4. File over 5 MB → 400, `body.error.code === 'FILE_TOO_LARGE'`
5. TXT file with random/unparseable content → 200, `body.data` contains all
   expected keys (`firstName`, `lastName`, `email`, `skills`, `experience`, etc.),
   all scalars are `null` and all arrays are `[]` (complete parse failure still
   returns 200 with empty ParsedProfileData, not an error)
6. `.txt` file sent with `application/octet-stream` MIME type (simulates generic
   browser MIME reporting) → 200, `body.data` is an object with the expected keys
   (extension fallback accepts the file via `.txt` extension and extracts correctly;
   tests the fallback path without requiring a real DOCX binary)

**Constraints**:
- Define a local `withServer` function inline following the pattern in
  `tests/server/applications.test.js` (lines 5–18); import `makeMemoryDb` from
  `tests/server/helpers.js` and `createApp` from `../../server/index.js`
- Do not import `withServer` from `helpers.js` — it is not exported there
- Pass a real `makeMemoryDb()` database to `createApp`; do not pass `null` — other
  routes registered in the same app require a db even though the resume route does not
- Do not use external resume files; construct minimal inline buffers/strings
- Tests must be written before T008–T009; they must initially fail

**Validation**: `npm run test:run -- tests/server/resume.test.js` — all pass after
T008 and T009 are complete.

---

### T008 — Create resume route

**Target files**: `server/routes/resume.js` *(new)*

**Expected behaviour**:
- Export `createResumeRouter()` (no `db` parameter needed)
- `POST /api/resume/parse` route:
  - Apply `multer({ storage: multer.memoryStorage(), limits: { fileSize: 5_242_880 } }).single('resume')`
    as middleware before the handler
  - If `req.file` is absent → respond 400 `{ error: { code: 'VALIDATION_ERROR', message: 'No resume file provided.' } }`
  - Call `extractText(req.file.buffer, req.file.mimetype, req.file.originalname)`:
    - If extractor throws `'Unsupported file type'` → respond 400
      `{ error: { code: 'UNSUPPORTED_FILE_TYPE', message: 'Unsupported file type. Please upload a PDF, DOCX, or TXT file.' } }`
  - Call `parseResumeText(text)` → respond 200 `{ data: parsedData }`
  - Catch multer `MulterError` with `code === 'LIMIT_FILE_SIZE'` → respond 400
    `{ error: { code: 'FILE_TOO_LARGE', message: 'File exceeds the 5 MB size limit.' } }`
  - Any other thrown error propagates to the global Express error handler in
    `server/index.js` (which returns 500)
- No file or buffer is persisted; the route handler does not write to disk or db

**Constraints**:
- Follow the `createProfileRouter` factory pattern in `server/routes/profile.js`
- multer middleware is applied per-route (not globally in `server/index.js`)
- Error response shapes must match the format used elsewhere in the API:
  `{ error: { code, message } }`

**Validation**: `tests/server/resume.test.js` (T007). Run with
`npm run test:run -- tests/server/resume.test.js`.

**Out of scope**: `server/db/`, `src/`, any profile persistence.

---

### T009 — Register resume router in Express app

**Target files**: `server/index.js`

**Expected behaviour**:
- Import `createResumeRouter` from `./routes/resume.js`
- Add `app.use('/api/resume', createResumeRouter())` after the existing profile route
  registration
- The global error handler already in `server/index.js` requires no changes

**Constraints**:
- Do not add multer middleware globally; it stays in the resume router
- The existing `/api/health`, `/api/applications`, and `/api/profile` routes must
  continue to work unchanged

**Validation**: `npm run test:run -- tests/server/` — all server tests pass.

---

## Phase 3: User Story 1 — Core Import on Edit Profile Page (P1)

**Goal**: A user on the Edit Profile page can upload a resume, process it, see
pre-filled fields, and save manually.

**Independent Test** (from spec.md US1): Navigate to the Edit Profile page. Upload a
PDF resume with recognizable sections. Click "Process Resume". Confirm loading feedback
appears. Verify fields are pre-filled. Confirm no auto-save. Make a manual edit and
click Save.

---

### T010 — Create resume API service

**Target files**: `src/services/resumeApi.js` *(new)*

**Expected behaviour**:
- Export `parseResume(file)` → `Promise<ParsedProfileData>`
- Uses native `fetch` with `FormData` (NOT the JSON `request` helper from
  `src/services/api.js`, which sets `Content-Type: application/json`)
- Appends the `File` object under field name `'resume'`
- On non-ok response: throws `payload.error ?? { code: 'INTERNAL_ERROR', message: 'Request failed' }`
- On ok response: returns `payload.data`

**Constraints**:
- Keep this file separate from `src/services/api.js`; do not modify `api.js`
- Must handle network errors (wrap `fetch` in try/catch the same way `api.js` does)

**Validation**: Covered indirectly by component integration (T012). No isolated unit
test required; the server endpoint test (T007) covers the HTTP contract.

**Out of scope**: `src/services/api.js`, any server files.

---

### T011 — Extend `navigate` to accept options

**Target files**: `src/main.js`

**Expected behaviour**:
- Change `function navigate(page)` to `function navigate(page, options = {})`
- Pass `options` through to `ProfileEdit.mount`:
  `ProfileEdit.mount(appRoot, { navigate, ...options })`
- All other `mount` calls (`Profile.mount`, `Calendar.mount`, `Tracker.mount`) are
  unchanged; they do not receive `options`
- All existing callers of `navigate('profile-edit')`, `navigate('tracker')`, etc.
  continue to work with no argument for `options` (default `{}`)

**Constraints**:
- This is a backward-compatible change; no existing behaviour changes
- The `ProfileEdit.mount` signature in `src/pages/ProfileEdit.js` must accept
  `highlightImport` as part of `options` (implemented in T013)

**Validation**: `npm run test:run -- tests/pages/` — all existing page tests still
pass. Confirm by also running `npm run test:run`.

**Out of scope**: Any page files, any server files.

---

### T012 — Create ResumeImport component

**Target files**: `src/components/ResumeImport.js` *(new)*

**Expected behaviour**:
- Export `ResumeImport.create({ onSuccess, onDismiss })` → `HTMLElement`
- Returns a single root element with class `resume-import`
- Internal state machine with four states:

  **`idle`** — shown on mount:
  - Drop zone with label "Import profile information from your resume"
  - Click target (hidden `<input type="file" accept=".pdf,.docx,.txt">`) triggered by
    clicking the zone
  - Drag-and-drop handlers on the element (desktop only: check
    `window.matchMedia('(pointer: fine)').matches` before attaching `dragover`/`drop`)
  - Client-side validation on file selection/drop:
    - Allowed MIME types: `application/pdf`,
      `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
      `text/plain`
    - Allowed extensions (fallback): `.pdf`, `.docx`, `.txt`
    - Max size: `5 * 1024 * 1024` bytes (5 MB)
    - On failure: render inline error message below the drop zone; stay in `idle`
  - On valid file accepted: transition to `selected`

  **`selected`** — file accepted:
  - Filename displayed
  - "Process Resume" button (enabled)
  - Clicking a new file replaces the previous selection and stays in `selected`
  - Clicking "Process Resume": transition to `processing`, call `parseResume(file)`

  **`processing`** — upload in progress:
  - "Process Resume" button disabled
  - Cycling status message (rotate through: "Reading resume…",
    "Extracting experience…", "Building profile…") on a 1.2-second interval
  - On success (`parseResume` resolves):
    - If result has no extracted data (all scalars null, all arrays empty):
      transition to `error`
    - Otherwise: call `onSuccess(parsedData)`; component hides itself
      (`element.hidden = true`)
  - On rejection (`parseResume` throws): transition to `error`

  **`error`** — parse failure:
  - Message: "Unable to parse resume. Try a different file or continue manually."
  - "Retry" button: transition to `selected` state with the previously selected file
    reference retained — filename is shown again and "Process Resume" button is
    re-enabled, so the user can retry without re-selecting the file
  - "Continue Manually" button: call `onDismiss()`, hide the component

- Accessibility: file input has an accessible label; status messages use `aria-live`
  or `aria-busy`; all interactive controls are keyboard-operable

**Constraints**:
- The component must NOT access or mutate `_formState`; it only calls `onSuccess` and
  `onDismiss` callbacks
- No import from `src/pages/`; no import from server code
- Follow existing component patterns: `createElement`, `createButton` helper functions
  as used in `src/pages/ProfileEdit.js`

**Validation**: Manual browser test (Phase 6). No automated component test required;
integration is covered by the ProfileEdit smoke test. Ensure `npm run lint` passes.

**Out of scope**: `src/pages/`, `src/models/`, server files.

---

### T013 — Add import area and `applyResumeData` to ProfileEdit

**Target files**: `src/pages/ProfileEdit.js`

**Expected behaviour**:

1. **`mount(container, { navigate, highlightImport = false })`**:
   - Accept new `highlightImport` option (default `false`); store in module-level
     `let _highlightImport = false`
   - No other change to mount logic

2. **Module-level flags** (add alongside existing `_formState`, `_container`, etc.):
   - `let _highlightImport = false`
   - `let _importDone = false` — set to `true` after a successful parse to suppress
     the import widget on the subsequent `renderEditPage` re-render

3. **`renderResumeImportArea(page)`** (new private function):
   - If `_importDone === true`, return immediately without creating any element
   - Otherwise, create and insert a `ResumeImport.create({ onSuccess, onDismiss })`
     element at the top of `page` (before the first card)
   - `onSuccess(parsedData)`:
     1. Set `_importDone = true` (must happen BEFORE calling `renderEditPage`)
     2. `_formState = mergeResumeData(_formState, parsedData)` (import from
        `src/models/profile.js`)
     3. `renderEditPage(_container)` — re-renders the page; `renderResumeImportArea`
        is skipped because `_importDone` is now true
     4. `_initialState` is NOT updated → `isDirty()` returns true → Save enables
   - `onDismiss()`: component hides itself via `element.hidden = true` inside the
     component; `_importDone` is NOT set (user may retry later)
   - If `_highlightImport === true`: add class `resume-import--highlight` to the
     import element and call `element.scrollIntoView({ behavior: 'smooth' })`

4. **`renderEditPage(container)`**:
   - Call `renderResumeImportArea(page)` as the FIRST call inside the function,
     before `renderBasicInfoCard(page)`

5. **Imports**: add `import { mergeResumeData } from '../models/profile.js'` and
   `import { ResumeImport } from '../components/ResumeImport.js'`

6. **`unmount()`**: reset `_highlightImport = false` and `_importDone = false`

**Constraints**:
- `_initialState` must NOT be updated when `applyResumeData` runs; dirty state
  must be true immediately after a successful resume parse
- `renderEditPage` is already called on mount; calling it again after merge is
  the intentional re-render strategy (see plan.md)
- No changes to `handleSave`, `handleCancel`, or validation logic

**Validation**:
- `npm run test:run -- tests/pages/ProfileEdit.test.js` — existing tests still pass
  (update any assertions that count cards or check top-level DOM order in T018)
- Manual browser test in Phase 6

**Out of scope**: `src/pages/Profile.js`, `src/main.js` (done in T011), server files.

---

## Phase 4: User Story 2 — Empty Profile Entry Point (P1)

**Goal**: A user with no profile sees two clear options — "Upload Resume" and "Build
Profile Manually" — instead of the single "Set Up Profile" button.

**Independent Test** (from spec.md US2): With no profile saved, navigate to the
Profile page. Verify "Upload Resume" and "Build Profile Manually" are both present.
Click "Build Profile Manually" → Edit Profile opens with blank fields. Return; click
"Upload Resume" → Edit Profile opens with the import area prominent.

---

### T014 [P] — Update Profile.test.js for new empty state

**Target files**: `tests/pages/Profile.test.js`

**Expected behaviour** — Tests MUST FAIL before T015 is complete:
- Find the test `'renders the no-profile state and wires navigation callbacks'`
- Update assertions:
  - Remove any assertion for `'Set Up Profile'` button text
  - Add assertion: button "Upload Resume" exists
  - Add assertion: button "Build Profile Manually" exists
  - Verify "Upload Resume" calls `navigate` with `'profile-edit'` and an options
    object containing `highlightImport: true`
  - Verify "Build Profile Manually" calls `navigate` with `'profile-edit'` (and
    no `highlightImport` or `highlightImport: false`)

**Constraints**:
- Modify the existing test; do not add a new test file
- Use the existing `getButton(container, label)` helper already in the test file
- Tests must be updated before T015 is implemented; they must initially fail

**Validation**: `npm run test:run -- tests/pages/Profile.test.js` fails until T015
is done, then passes.

---

### T015 — Update Profile page empty state

**Target files**: `src/pages/Profile.js`

**Expected behaviour**:
- In `renderEmptyProfile(section, navigate)`, replace the single "Set Up Profile"
  button with a two-option layout:
  - A wrapper element with class `profile-empty__actions` containing two buttons:
  - `"Upload Resume"` button (class `profile-btn profile-btn--primary`) →
    calls `navigate('profile-edit', { highlightImport: true })`
  - `"Build Profile Manually"` button (class `profile-btn profile-btn--outline`) →
    calls `navigate('profile-edit')`
- Retain the icon, title ("No profile set up yet."), and copy text
- The two buttons appear side-by-side on desktop (≥ 640 px) and stacked on mobile

**Constraints**:
- Only `renderEmptyProfile` changes; no other function in `Profile.js` is modified
- The populated profile state (when profile exists) is unchanged
- `navigate` is already passed into `renderEmptyProfile`; no signature change needed

**Validation**: `npm run test:run -- tests/pages/Profile.test.js` — all tests pass
(including the updated test from T014).

**Out of scope**: `src/pages/ProfileEdit.js`, `src/models/`, server files.

---

## Phase 5: User Story 3 & 4 — Merge Protection and Graceful Failure

**Note**: The core logic for US3 (merge rules) is implemented in T004 and exercised
via T006. The core logic for US4 (graceful failure) is built into the ResumeImport
component state machine in T012. This phase completes the test coverage and confirms
all existing tests are updated.

---

### T016 [P] — Update ProfileEdit.test.js for import area

**Target files**: `tests/pages/ProfileEdit.test.js`

**Expected behaviour**:
- Inspect the existing tests; identify any assertions that:
  - Check the exact count of cards or top-level children in the edit page container
  - Check the order of rendered elements
- Update those assertions to account for the `resume-import` element now being the
  first child of the edit page
- Do not delete tests; only update assertions that break due to the new element

**Constraints**:
- Confirm which tests actually fail after T013 by running:
  `npm run test:run -- tests/pages/ProfileEdit.test.js`
- Only change the minimum required to make existing tests pass; do not add coverage
  for the import widget here (that is a browser smoke test)

**Validation**: `npm run test:run -- tests/pages/ProfileEdit.test.js` — all pass.

---

### T017 — Run full test suite

**Target files**: *(none — verification task)*

**Expected behaviour**:
- Run `npm run test:run`
- All tests pass, including:
  - `tests/models/resumeMerge.test.js` (T006)
  - `tests/server/resumeParser.test.js` (T005)
  - `tests/server/resume.test.js` (T007)
  - `tests/pages/Profile.test.js` (T014)
  - `tests/pages/ProfileEdit.test.js` (T016)
  - All pre-existing tests (Tracker, Calendar, applications, foundation, etc.)

**Constraints**:
- Zero failures required before moving to Phase 6
- If `pdf-parse` emits Node 20+ deprecation warnings during the test run, suppress
  by mocking the module in `tests/server/resumeParser.test.js`:
  `vi.mock('pdf-parse', () => ({ default: vi.fn().mockResolvedValue({ text: '' }) }))`
  for unit tests that do not need real PDF parsing

**Validation**: `npm run test:run` exits 0 with no failing tests.

---

### T018 — Lint check

**Target files**: *(none — verification task)*

**Expected behaviour**:
- Run `npm run lint`
- No lint errors in `src/`, `server/`, `tests/`, `shared/`

**Constraints**:
- Fix any errors before proceeding to Phase 6
- Do not suppress rules; fix the underlying issues

**Validation**: `npm run lint` exits 0.

---

### T019 — Privacy and security review

**Target files**: *(none — review task)*

**Checklist**:
- [ ] `server/routes/resume.js` — no file written to disk or database; buffer GC'd
  within the request cycle
- [ ] `server/resume/extractor.js` — no external HTTP calls; uses only local libs
- [ ] `server/resume/parser.js` — no external HTTP calls
- [ ] `src/components/ResumeImport.js` — all parsed resume content passed through
  `parseResume()`; no content sent anywhere other than `/api/resume/parse`
- [ ] `src/pages/ProfileEdit.js` — all form content rendered via `textContent` or
  DOM `value` (not `innerHTML`); resume content does not reach `innerHTML`
- [ ] No analytics, tracking pixels, or third-party data sharing added anywhere

**Validation**: Manual review; check each file above. Document any finding with
rationale in a comment or task note. Must be clean before Phase 6.

---

## Phase 6: Browser Smoke Test (Required by Constitution)

**Purpose**: Verify the full feature end-to-end in a real browser with a running
server. Catches rendering, CSS, keyboard interaction, and mobile viewport issues
that automated tests cannot detect.

**Setup before running**:
1. `npm run server:dev` (or `npm run server:start`) — start the backend on port 3001
2. `npm run dev` — start the Vite dev server
3. Open `http://localhost:5173` (or the Vite port shown in terminal)
4. Use `npm run db:clear:profile` to ensure no profile exists for US1/US2 tests
5. Have a real PDF resume file (or a minimal plain-text `.txt` file) ready for upload

---

### T020 [US1] — Core import on Edit Profile page

**Steps**:
1. Navigate to Profile page (no profile exists)
2. Click "Build Profile Manually" → Edit Profile opens
3. Locate the Resume Import area at the top of the page (above "BASIC INFO" card)
4. Click the upload zone; select a supported file (`.txt` or `.pdf`)
5. Verify filename is displayed and "Process Resume" is enabled
6. Click "Process Resume"
7. Verify loading messages cycle during processing
8. After processing: verify at least some fields are pre-filled (e.g. skills list
   or name fields if present in the file)
9. Verify Save button is now enabled (dirty state active)
10. Edit one field manually; click Save
11. Verify success toast; verify Profile page shows the saved data

**Pass criteria**:
- Import area is visible and above all profile section cards
- Loading feedback appears and disappears correctly
- At least one field is pre-filled from a resume with recognizable content
- No automatic save occurs; user must click Save
- Saved profile appears correctly on the Profile page

---

### T021 [US2] — Empty profile entry point

**Steps**:
1. Ensure no profile exists (`npm run db:clear:profile`)
2. Navigate to the Profile page
3. Verify "Upload Resume" button and "Build Profile Manually" button are both visible
   (no "Set Up Profile" button)
4. Click "Build Profile Manually" → verify Edit Profile opens with blank fields
5. Navigate back to Profile page (Cancel with no changes)
6. Click "Upload Resume" → verify Edit Profile opens with import area prominent
   (scrolled to top / highlighted)

**Pass criteria**:
- Two distinct options appear in the empty state
- "Build Profile Manually" behaves identically to the previous "Set Up Profile"
- "Upload Resume" lands on Edit Profile with the import area visually first

---

### T022 [US3] — Existing profile protection

**Steps**:
1. Create a profile with: `firstName = "Alice"`, one experience entry, one skill
   "TypeScript"
2. Navigate to Edit Profile
3. Upload a resume that contains a name (e.g. "Bob Smith"), overlapping experience
   (same company, role, date range), and the skill "typescript" (lowercased)
4. Click "Process Resume"
5. After processing: verify `firstName` is still "Alice" (not overwritten)
6. Verify the overlapping experience entry is NOT duplicated
7. Verify "typescript" skill is NOT added again
8. Verify any genuinely new skill or experience from the resume IS appended

**Pass criteria**:
- No existing field is silently overwritten
- Duplicate detection works for experience, skills, and any other overlapping data

---

### T023 [US4] — Graceful failure and recovery

**Steps**:
1. Navigate to Edit Profile
2. Drop or upload a file type that will yield no parsed data (e.g. an empty `.txt`
   file, or a `.txt` file with only random characters)
3. Click "Process Resume"
4. Verify: error message appears with "Retry" and "Continue Manually" buttons
5. Click "Retry" → verify import resets to file selection (file reference retained)
6. Select a valid resume file and process → verify normal success path
7. Repeat step 2–4; click "Continue Manually" → verify import area hides and Edit
   Profile form is accessible with no data loss

**Pass criteria**:
- Error state always has both recovery options
- Retry resets the widget without losing context
- Continue Manually never corrupts form state

---

### T024 — Mobile layout check

**Steps**:
1. Open DevTools → set viewport to 375 px wide (iPhone SE or similar)
2. Navigate to the Profile page (no profile): verify two-option empty state stacks
   vertically; no horizontal overflow
3. Navigate to Edit Profile: verify import area renders correctly; no clipped content
4. Test the import flow (click-to-upload, since drag-and-drop is desktop-only):
   verify file picker opens on mobile tap
5. Verify loading messages are readable on narrow viewport

**Pass criteria**:
- No horizontal scrolling on any page at 375 px
- Import widget is usable with touch/click on mobile
- Two-option empty state stacks vertically below 640 px

---

## Dependencies & Execution Order

```
Phase 1 (T001→T002→T005+T006→T003+T004) → must complete before Phase 2
  Within Phase 1: T005+T006 written first (fail), then T003+T004 implemented (pass)
Phase 2 (T007→T008→T009) → write T007 (tests fail) before T008–T009 (implementation)
Phase 3 (T010–T013) → depends on Phase 1 and Phase 2
Phase 4 (T014–T015) → write test (T014) before implementation (T015);
                       can start in parallel with Phase 3 (different files)
Phase 5 (T016–T019) → depends on Phase 3 and Phase 4 being complete
Phase 6 (T020–T024) → depends on Phase 5 passing
```

### Parallel opportunities within phases

- **Phase 1**: T005 and T006 can run in parallel (different test files); T003 and T004
  can run in parallel (different implementation files) once T005/T006 are written
- **Phase 2**: T007, T008, T009 are sequential (test before implementation)
- **Phase 3**: T010 and T011 can run in parallel (different files); T012 and T013
  must be sequential (T012 before T013)
- **Phase 4**: T014 must precede T015
- **Phase 5**: T016, T017, T018, T019 must be sequential (T016 before T017,
  T017 before T018)
