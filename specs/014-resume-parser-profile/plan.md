# Technical Plan: Resume Auto-Parser for Profile Builder

**Feature Branch**: `014-resume-parser-profile`
**Spec**: `specs/014-resume-parser-profile/spec.md`
**Created**: 2026-05-10
**Status**: Draft

---

## Architecture Overview

The feature has three layers:

```
Browser
  └── ResumeImport component (new)
        ├── client-side validation (type, size)
        ├── POST /api/resume/parse (multipart/form-data)
        └── onSuccess(parsedData) → ProfileEdit merge + re-render

Express server
  └── POST /api/resume/parse (new route)
        ├── multer memoryStorage (in-memory, no disk write)
        ├── extractor.js — text extraction (PDF / DOCX / TXT)
        └── parser.js — heuristic field parsing → ParsedProfileData

ProfileEdit page (modified)
  ├── renderResumeImportArea() inserted at top of renderEditPage()
  └── applyResumeData(parsedData) — merges into _formState, re-renders

Profile page (modified)
  └── renderEmptyProfile() — two-option layout instead of one CTA
```

No database changes. No new profile model fields. All resume data is transient.

---

## Data Flow

```
1. User selects or drops a file
2. Client validates: type ∈ {pdf, docx, txt}, size ≤ 5 MB
   → reject inline if invalid (no server call)
3. User clicks "Process Resume"
4. Client POST /api/resume/parse
   Content-Type: multipart/form-data, field name: "resume"
5. Server: multer receives file buffer in memory
6. extractor.js extracts plain text based on file mimetype
7. parser.js runs heuristic extraction → ParsedProfileData
8. File buffer goes out of scope (GC); nothing written to disk
9. Server responds { data: ParsedProfileData }
10. Client: ResumeImport component calls onSuccess(parsedData)
11. ProfileEdit: `_formState = mergeResumeData(_formState, parsedData)` (assignment; pure function, no mutation)
12. ProfileEdit: renderEditPage(container) re-renders with updated state
    _initialState is unchanged → isDirty() returns true → Save enabled
13. User reviews, edits, and saves manually
```

---

## New Files

### `server/resume/extractor.js`
Exports `extractText(buffer, mimetype, originalname)`.
- `application/pdf` → `pdf-parse(buffer).text`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `mammoth.extractRawText({ buffer }).value`
- `text/plain` → `buffer.toString('utf8')`
- `application/octet-stream` or empty mimetype → fall back to file extension from
  `originalname` (`.pdf`, `.docx`, `.txt`) to determine extraction method; this
  handles browsers (e.g. Firefox on Windows) that report a generic MIME type for
  DOCX files that the client accepted via extension fallback
- Other mimetypes (and unrecognized extensions on fallback) → throw `Unsupported file type`
  (caught by route handler, returns 400)

### `server/resume/parser.js`
Exports `parseResumeText(text)` → `ParsedProfileData`.

See `data-model.md` for the output shape.

Parsing strategy (heuristic, no AI/LLM):
1. Split text into lines; normalize whitespace
2. Detect section boundaries by header keywords (case-insensitive):
   - Contact/header: lines before the first recognized section header
   - Summary: `SUMMARY | ABOUT | PROFILE | OBJECTIVE`
   - Experience: `EXPERIENCE | EMPLOYMENT | WORK HISTORY`
   - Education: `EDUCATION | ACADEMIC`
   - Skills: `SKILLS | COMPETENCIES | TECHNOLOGIES`
   - Certifications: `CERTIF | LICENSE`
   - Awards: `AWARD | HONOR | ACHIEVEMENT`
   - Languages: `LANGUAGE`
3. Parse contact block (top of resume):
   - Name: first non-empty line that is not an email/phone/URL; split on space
   - Email: regex `[\w.+-]+@[\w-]+\.[a-z]{2,}`
   - Phone: regex for common formats (digits, spaces, parens, dashes)
   - LinkedIn: `linkedin\.com\/in\/[\w-]+`
   - Portfolio URL: any `https?://` that is not LinkedIn
   - City: heuristic — line matching `City, ST` or `City, Country` pattern near top
4. Parse experience blocks within the Experience section:
   - Job block boundary: line that matches a date range pattern
   - Date conversion: month names and abbreviations → `MM/YYYY`; "Present" → currentWork: true
   - Role: line before the date line (or after company in some layouts) — limited heuristic
   - Responsibilities: remaining lines in the block, joined with newlines
5. Parse education, certifications, awards, languages similarly by section
6. Skills: split on common delimiters (comma, bullet, newline) within the Skills section

Partial results are always returned; null fields indicate not found.

### `server/routes/resume.js`
Exports `createResumeRouter({ })` (no db dependency).

```
POST /api/resume/parse
  multer({ storage: memoryStorage(), limits: { fileSize: 5_242_880 } }).single('resume')
  → extractText(req.file.buffer, req.file.mimetype, req.file.originalname)
  → parseResumeText(text)
  → res.json({ data: parsedData })
```

Error handling:
- multer `LIMIT_FILE_SIZE` → 400 `FILE_TOO_LARGE`
- Unsupported mimetype → 400 `UNSUPPORTED_FILE_TYPE`
- Extraction/parse throws → 500 (caught by global error handler)

### `src/components/ResumeImport.js`
Self-contained UI component. Exports `ResumeImport.create({ onSuccess, onDismiss })`.

Internal state machine:
- `idle` — dropzone with click target; no file selected
- `selected` — filename shown; "Process Resume" button enabled
- `processing` — loading indicator with cycling status messages
- `error` — complete parse failure; shows "Retry" and "Continue Manually"

Returns a DOM element that ProfileEdit inserts at the top of the page.

On `onSuccess(parsedData)`, the component's caller (ProfileEdit) handles the merge
and re-render. The component itself does not manipulate `_formState`.

On `onDismiss()`, the component signals that the user chose "Continue Manually".

Drag-and-drop: `dragover` / `drop` event listeners; only active on `desktop`
(`window.matchMedia('(pointer: fine)')` or viewport width check).

File validation (client-side, before any upload):
- Allowed MIME types: `application/pdf`,
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
  `text/plain`
- Allowed extensions: `.pdf`, `.docx`, `.txt` (fallback if browser reports empty MIME)
- Max size: 5 MB (`5 * 1024 * 1024`)

### `src/services/resumeApi.js`
Exports `parseResume(file)` — uses `fetch` with `FormData` directly (not the JSON
`request` helper, which always sets `Content-Type: application/json`).

```js
export async function parseResume(file) {
  const body = new FormData();
  body.append('resume', file);
  const res = await fetch('/api/resume/parse', { method: 'POST', body });
  const payload = await res.json();
  if (!res.ok) throw payload.error ?? { code: 'INTERNAL_ERROR' };
  return payload.data;
}
```

---

## Modified Files

### `server/index.js`
- Import and register `createResumeRouter`
- Add `app.use('/api/resume', createResumeRouter())` (no db needed)
- multer is applied per-route in the resume router, not globally

### `src/main.js`
- Change `navigate(page)` → `navigate(page, options = {})` (backward-compatible)
- Pass `options` through to `ProfileEdit.mount(appRoot, { navigate, ...options })`
- Profile page calls `navigate('profile-edit', { highlightImport: true })` for
  "Upload Resume" path

### `src/pages/ProfileEdit.js`
- `mount(container, { navigate, highlightImport = false })` — accept new option
- Module-level flags: `let _highlightImport = false` and `let _importDone = false`
- `renderEditPage(container)` — call `renderResumeImportArea(page)` before
  `renderBasicInfoCard(page)` (top of page)
- `renderResumeImportArea(page)`:
  - If `_importDone === true`, return immediately (widget suppressed after success)
  - Otherwise create and insert `ResumeImport.create({ onSuccess, onDismiss })` at top
  - `onSuccess(parsedData)`: set `_importDone = true`, call `mergeResumeData`,
    then call `renderEditPage(_container)` — the re-render skips the widget
    because `_importDone` is now true; `_initialState` unchanged → isDirty() true
  - `onDismiss()`: the component hides itself (handled inside the component via
    `element.hidden = true`); `_importDone` is not set
  - If `_highlightImport === true`: add class `resume-import--highlight` and
    `scrollIntoView({ behavior: 'smooth' })`
- `unmount()`: reset `_highlightImport = false` and `_importDone = false`

### `src/pages/Profile.js`
- Replace `renderEmptyProfile(section, navigate)` body with two-option layout:
  - "Upload Resume" button → `navigate('profile-edit', { highlightImport: true })`
  - "Build Profile Manually" button → `navigate('profile-edit')`
- Adjust CSS classes for two-button layout

### `src/models/profile.js`
- Add `mergeResumeData(currentProfile, parsedData)` export:
  - Singular fields: only fill if `currentProfile[field]` is empty
  - Collection fields: filter `parsedData[field]` through duplicate detection,
    then append to `currentProfile[field]`
  - Returns a new profile object (does not mutate the argument)
- Duplicate detection keys per spec FR-028

---

## New Dependencies

All are server-side (added to `dependencies` in `package.json`):

| Package | Purpose | Justification |
|---|---|---|
| `multer` | Multipart form-data parsing | No existing multipart support; well-tested, narrow-scope, memory-storage option avoids disk I/O |
| `pdf-parse` | PDF text extraction | Simple Buffer-in/text-out API; pure JS; no native bindings or external tools required |
| `mammoth` | DOCX text extraction | Strips formatting cleanly; well-maintained; simpler than alternatives |

No new frontend dependencies.

---

## Validation Approach

### Server-side
- File type: checked against accepted mimetypes before extraction; 400 if unsupported
- File size: enforced by multer `limits.fileSize`; multer throws `LIMIT_FILE_SIZE`
- Empty text after extraction: parser returns all-null ParsedProfileData; client
  treats zero extracted fields as a complete parse failure

### Client-side (before upload)
- File type: check `file.type` and `file.name` extension
- File size: check `file.size`
- Both rejections show an inline error without triggering any network call

### Merge correctness
- `mergeResumeData` has no side effects and is pure (returns new object)
- All merge rules are covered by automated tests (see Test Plan)

---

## Risks and Tradeoffs

| Risk | Likelihood | Mitigation |
|---|---|---|
| Parse quality is low for non-standard resumes | High | Graceful failure path; all fields editable; no auto-save |
| Date format variety causes missed experience entries | Medium | Parser normalizes common formats; unrecognized dates left blank; user completes manually |
| Re-rendering ProfileEdit loses any open inline overlay | Low | User cannot have an overlay open while the import widget is processing; UI ordering prevents this |
| Empty profile entry point change breaks existing Profile.test.js | Certain | Tests must be updated; isolated and low-risk |
| `pdf-parse` may emit deprecation warnings in Node 20+ | Low | Pin to a known-good version; monitor during implementation |
| Image-based or heavily stylized PDFs produce no text | Medium | Expected; handled by graceful failure; noted in spec |

---

## Affected Areas

### Files to Modify
- `server/index.js` — register resume router
- `server/routes/profile.js` — inspect only (no changes expected)
- `src/main.js` — extend `navigate(page, options)` signature
- `src/pages/ProfileEdit.js` — add import area, `applyResumeData`, `highlightImport`
- `src/pages/Profile.js` — replace single empty-state CTA with two-option layout
- `src/models/profile.js` — add `mergeResumeData` export
- `src/services/api.js` — inspect only (no changes; resume API is separate file)

### Files to Create
- `server/resume/extractor.js`
- `server/resume/parser.js`
- `server/routes/resume.js`
- `src/components/ResumeImport.js`
- `src/services/resumeApi.js`

### Tests to Add
- `tests/server/resume.test.js` — endpoint: valid upload → parsed data, wrong type
  → 400, oversized → 400, no file → 400
- `tests/models/resumeMerge.test.js` — all merge rule cases (FR-025 to FR-028)
- `tests/server/resumeParser.test.js` — parser unit tests with fixture text strings

### Tests to Update
- `tests/pages/Profile.test.js` — empty state now has two buttons ("Upload Resume",
  "Build Profile Manually") instead of one ("Set Up Profile")
- `tests/pages/ProfileEdit.test.js` — new import area rendered at top of page;
  inspect and update assertions that check the top-level DOM structure

### Out of Scope
- `server/db/profile.js` — no schema or persistence changes
- `server/validation/application.js` — unrelated
- `src/pages/Calendar.js`, `src/pages/Tracker.js` — unrelated
- Any CSS file changes beyond adding new classes for the import widget and
  empty-state two-option layout
- OCR, AI/LLM parsing, LinkedIn import, resume version history
