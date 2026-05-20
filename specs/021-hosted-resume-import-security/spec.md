# Feature Specification: Hosted Resume Import Security

**Feature Branch**: `021-hosted-resume-import-security`
**Created**: 2026-05-20
**Status**: Draft
**Input**: `features/021-hosted-resume-import-security.md`

---

## Problem Statement

The hosted Resume Import endpoint (`POST /api/resume/parse`, introduced
in feature 014 and migrated under hosted auth in feature 018) accepts
uploaded resume files, extracts text via `pdf-parse` / `mammoth` / UTF-8
decoding, and returns parsed structured profile fields. Today's
implementation is **functionally** correct for the happy path and
inherits authentication from `requireAuth` in hosted mode. However, the
endpoint has never had a dedicated security audit, the security model
is not documented anywhere, and three gaps are observable in the
current code:

1. **Parse-failure errors leak library internals.** A corrupted PDF, a
   malformed DOCX, or any unexpected error thrown by `pdf-parse` /
   `mammoth` falls through `next(error)` at
   [server/routes/resume.js:65](../../server/routes/resume.js#L65) into
   the global 500 handler at
   [server/index.js:84](../../server/index.js#L84), which echoes
   `err.message` to the client. Library internals (file offsets,
   PDF spec violations, stack-trace text) can reach the browser.

2. **No regression guard against on-disk persistence.** The handler
   uses `multer.memoryStorage()` so uploads live in `req.file.buffer`,
   never on disk. There is no test that pins this — a future refactor
   to `multer.diskStorage()` (or a similar move) would silently
   introduce a tmp-file path with no test failure.

3. **No regression guard against demo bypass.** Feature 020's
   client-side gates prevent the demo UI from reaching
   `/api/resume/parse`, and in hosted mode demo visitors have no JWT
   so `requireAuth` returns 401 if the client gates were bypassed.
   No server-side test exists today asserting the 401 path; the
   defense is real but unwitnessed.

This feature closes those three gaps, locks in the existing security
properties with automated regression guards, and documents the
end-state security model in `contracts/api.md`. No new endpoints, no
new dependencies, no new env vars.

---

## Scope

- Verify and lock in the existing security model for `POST /api/resume/parse`
  on the hosted runtime: authentication required, in-memory only, 5 MB
  cap, validated file types, parsed fields returned to the requesting
  client only.
- Extend the existing `try`/`catch` in the `/parse` route handler so
  that any error other than `UnsupportedFileTypeError` is mapped to a
  generic `400 PARSE_FAILED` response (an in-handler catch branch, not
  a separate four-arg express error middleware) with an actionable
  but sanitized client-facing message, while logging the real error
  server-side for debugging.
- Add automated regression guards covering: the in-memory-only
  invariant (no filesystem writes during a parse), the hosted demo
  bypass path (no JWT → 401), and the new sanitized parse-failure
  contract.
- Document the security model in `specs/021-hosted-resume-import-security/contracts/api.md`:
  threat model, defenses by layer, and the explicit guarantees the
  endpoint provides.

## Non-Goals

- **Local-mode auth gating.** Local mode has no concept of
  authenticated vs unauthenticated visitors. Local keeps its existing
  open-endpoint behavior; this feature targets the hosted runtime.
- **Hardening the global 500 handler** in `server/index.js:74-91`.
  That handler echoes `err.message` for every uncaught error across
  every route, which is a broader concern. This feature only narrows
  the resume route's surface; the global handler change is flagged in
  `research.md` as future work.
- **Malware scanning.** Explicitly excluded by the brief.
- **OCR / image-based resume parsing.** Excluded.
- **Cloud file storage integration** (S3, Vercel Blob, Supabase
  Storage). Resume content is never persisted at all.
- **Resume export / download / history.** No persistent storage means
  no retrieval surface.
- **Making the 5 MB limit configurable** via env var. The cap stays
  hard-coded; revisit if a real product need emerges.
- **Rate limiting** the parse endpoint. A separate concern; flagged
  for future work.
- **Adding a custom demo-detection header on the server.** The server
  has no trustworthy way to verify a client-asserted demo claim.
  Hosted demo visitors have no JWT → existing `requireAuth` 401 is
  the defense.
- **Changing the parsed-data shape** returned to the client. Feature
  014's contract for `/api/resume/parse` response is unchanged.
- **Frontend behavior changes.** Features 014, 018, and 020 already
  shape the client. This feature audits and tests the server.

---

## User Stories

### User Story 1 — Authenticated hosted user uploads a valid resume (Priority: P1)

A signed-in hosted user uploads a PDF, DOCX, or TXT resume under
5 MB. The server authenticates the request, extracts text in memory,
parses it, and returns structured profile fields. No file is written
to disk at any point in the request lifecycle.

**Why this priority**: This is the happy path that the entire feature
exists to support. Every other story is a constraint on this one.

**Independent Test**: Sign in as a hosted user, navigate to
ProfileEdit, upload a small valid PDF. Verify the parsed fields
appear in the form. With a `fs.writeFile` / `fs.createWriteStream`
spy installed on the server during the test, verify zero filesystem
writes occurred during the request.

**Acceptance Scenarios**:

1. **Given** a signed-in hosted user with a valid Supabase JWT, **When**
   they POST a 1 MB valid PDF to `/api/resume/parse`, **Then** the
   response is `200` with `{ data: <parsed-fields> }` and no
   filesystem write occurs.
2. **Given** the same user, **When** they POST a valid DOCX or TXT,
   **Then** the corresponding parser runs in memory and returns the
   same response shape.
3. **Given** a successful parse, **When** the request completes,
   **Then** the resume buffer is no longer referenced anywhere in the
   request handler (garbage-collectable; not pinned in a module-level
   cache).

---

### User Story 2 — Unauthenticated hosted request is rejected before any parsing runs (Priority: P1)

A client POSTs to `/api/resume/parse` on the hosted runtime without
a valid Supabase JWT. The request is rejected at the `requireAuth`
middleware boundary with a 401; no parser library is loaded, no
file buffer is processed, and no internal details are echoed back.

**Why this priority**: The auth gate is the primary access control.
Without a regression guard, a future middleware refactor could
silently demote the endpoint to anonymous access.

**Independent Test**: With the server running in hosted mode, POST a
valid PDF to `/api/resume/parse` without an `Authorization` header
(or with a syntactically invalid token, or with an expired/forged
token). Verify the response is `401` with the standard auth error
shape and that the response body contains no parser library names,
stack traces, or internal paths.

**Acceptance Scenarios**:

1. **Given** the hosted runtime, **When** a request to
   `/api/resume/parse` arrives with no `Authorization` header, **Then**
   the response is `401` and the handler body is never reached.
2. **Given** the hosted runtime, **When** a request arrives with a
   malformed, expired, or forged JWT, **Then** the response is `401`
   with no information about which check failed beyond the standard
   `requireAuth` categorization.
3. **Given** a demo visitor in hosted mode (no JWT, status `'demo'`),
   **When** any code path that would normally call
   `/api/resume/parse` is reached, **Then** the client-side guard in
   `src/services/resumeApi.js` throws `DEMO_FEATURE_UNAVAILABLE`
   before any fetch fires, AND if the client guards are bypassed, the
   server returns `401`.

---

### User Story 3 — Oversized or unsupported uploads fail clearly without exposing internals (Priority: P1)

An authenticated user uploads a file that violates the contract: too
large, wrong type, missing entirely, or syntactically valid but
internally corrupted. Every failure mode returns a `400` with an
actionable client-facing message and a stable error code. No raw
library error string, file offset, or stack trace reaches the client.

**Why this priority**: The brief's most concrete security ask is
"errors should be actionable" and "should not expose internal
infrastructure details." This is the user story that pins both.

**Independent Test**: As an authenticated hosted user, attempt each
of the following uploads in turn and verify the response body matches
the expected error code with a generic message:
- A 10 MB PDF → `400 FILE_TOO_LARGE`
- A file with extension `.exe` → `400 UNSUPPORTED_FILE_TYPE`
- An empty form submission (no `resume` field) → `400 VALIDATION_ERROR`
- A `.pdf` file whose bytes are random garbage → `400 PARSE_FAILED`
  (NEW; today this falls through to 500 INTERNAL_ERROR)
- A `.docx` file with a corrupted ZIP container → `400 PARSE_FAILED`

For each, inspect the response body and confirm no library name
(`pdf-parse`, `pdfjs-dist`, `mammoth`), no stack trace, no file
offset, and no internal path appears.

**Acceptance Scenarios**:

1. **Given** any of the four established failure modes (oversized,
   unsupported type, missing file, malformed file), **When** the
   server processes the request, **Then** the response is `400` with
   a fixed error code and a generic, actionable client-facing message.
2. **Given** a parse failure inside the extractor (corrupted file),
   **When** the handler catches the error, **Then** the response code
   is the NEW `PARSE_FAILED` (not `INTERNAL_ERROR`), the message is
   generic ("Could not read this resume. Try a different file."), and
   the raw library error is logged server-side but not in the
   response body.
3. **Given** the new `PARSE_FAILED` mapping, **When** the global 500
   handler at `server/index.js:74-91` is reached, **Then** it is for
   genuinely unexpected errors only (network failure, OOM, etc.) —
   not for routine corrupted-upload cases.

---

### User Story 4 — No file is ever written to disk (Priority: P1)

The endpoint processes uploaded resumes entirely in memory. The
multer storage engine is `memoryStorage()`, not `diskStorage()`. No
temporary file, no `os.tmpdir()` write, no logged path to a file on
disk. The buffer is garbage-collectable as soon as the request
handler returns.

**Why this priority**: The brief explicitly requires "in-memory
only" processing. Today's code satisfies this by virtue of how
multer is configured, but no test pins it.

**Independent Test**: Install pass-through spies on `fs.writeFile`,
`fs.writeFileSync`, `fs.appendFile`, `fs.appendFileSync`,
`fs.createWriteStream`, `fs.writeSync`, `fs.promises.writeFile`,
`fs.promises.appendFile`, `fs.open`, and `fs.openSync` for the
duration of a parse-endpoint integration test. Run the happy-path
and every failure-path test against the endpoint. Assert zero calls
on every spy except `fs.open` / `fs.openSync`; for those two, assert
zero calls **whose flags argument indicates write/create/truncate/
append intent** (read-mode opens are expected — the module loader
and library debug paths legitimately call them in-process during
the test window, and they do not constitute "writing to disk").

**Acceptance Scenarios**:

1. **Given** any request to `/api/resume/parse` (happy or sad path),
   **When** the request completes, **Then** zero filesystem write
   calls were made by the resume route or its parser libraries.
2. **Given** the multer configuration, **When** the server boots,
   **Then** the upload engine is `memoryStorage`; no `diskStorage`
   reference exists in the resume route.

---

### User Story 5 — Service credentials are not exposed by the parse endpoint (Priority: P2)

`SUPABASE_SERVICE_ROLE_KEY` is server-only and unrelated to the
resume parse flow. The resume **code path** — the explicit set of
files that the parse request transits through: `server/routes/resume.js`,
`server/resume/extractor.js`, `server/resume/parser.js`,
`src/services/resumeApi.js`, `src/components/ResumeImport.js` —
contains no reference to it.

**Why this priority**: Defense in depth. The service role key is
the highest-privilege credential in the project; verifying it is
unreachable from the resume code path is a small, durable check.
P2 because the credential is already gated by config; this is a
belt-and-suspenders test.

**Independent Test**: Run
`grep -n "SUPABASE_SERVICE_ROLE_KEY\|service_role" \
  server/routes/resume.js server/resume/extractor.js \
  server/resume/parser.js src/services/resumeApi.js \
  src/components/ResumeImport.js`
and verify zero matches. The repo-wide frontend audit is a separate
concern with a different threat model; this feature's guarantee is
scoped to the five files above (the resume code path).

**Acceptance Scenarios**:

1. **Given** the five files that constitute the resume code path
   (`server/routes/resume.js`, `server/resume/extractor.js`,
   `server/resume/parser.js`, `src/services/resumeApi.js`,
   `src/components/ResumeImport.js`), **When** each is read end to
   end, **Then** no reference to `SUPABASE_SERVICE_ROLE_KEY`,
   `service_role`, or any admin-bypass credential exists.

---

## Functional Requirements

- **FR-001**: `POST /api/resume/parse` MUST require a valid Supabase
  JWT in hosted mode. The existing `router.use(requireAuth)` mount in
  [server/routes/resume.js:36-38](../../server/routes/resume.js#L36-L38)
  satisfies this; a new integration test pins the 401 path.
- **FR-002**: The handler MUST use `multer.memoryStorage()` —
  uploads live in `req.file.buffer` and are never written to disk.
- **FR-003**: The handler MUST enforce a 5 MB upload size limit via
  multer's `limits.fileSize`. Oversized uploads return `400 FILE_TOO_LARGE`.
- **FR-004**: File-type validation MUST occur in
  `server/resume/extractor.js#extractText` via the existing MIME +
  extension fallback. Unsupported types return `400 UNSUPPORTED_FILE_TYPE`.
- **FR-005**: A missing or empty `resume` form field MUST return
  `400 VALIDATION_ERROR`.
- **FR-006**: Parse failures (corrupted PDF, malformed DOCX, any
  error thrown by `pdf-parse` / `mammoth`) MUST be caught by the
  `/parse` route handler's in-handler `catch` branch (not a separate
  express error middleware) and returned as `400 PARSE_FAILED`
  with a generic client-facing message. The raw library error MUST
  be logged server-side (with the request path and a redacted file
  identifier) but MUST NOT appear in the response body.
- **FR-007**: The handler MUST NOT pass any error other than the
  established 400-class errors to the global 500 handler. This
  includes the multer upload-error branch: every `multer.MulterError`
  code MUST be mapped to an existing 400 response in the route
  (`LIMIT_FILE_SIZE` → `FILE_TOO_LARGE`; every other multer code →
  `VALIDATION_ERROR`, with the raw multer message logged server-side
  only). Genuinely unexpected non-multer errors (OOM, network failure,
  programmer bug) continue to fall through to the global handler,
  which returns `500 INTERNAL_ERROR` with a fixed generic message
  (existing behavior, unchanged).
- **FR-008**: The frontend MUST continue to hide the Resume Import
  UI in demo via the three existing layers from feature 020 —
  `VISIBLE_STATUSES` in [src/components/ResumeImport.js](../../src/components/ResumeImport.js),
  the inline note branch in [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js),
  and the `DEMO_FEATURE_UNAVAILABLE` throw in
  [src/services/resumeApi.js](../../src/services/resumeApi.js). The existing
  regression tests remain green; no changes to these layers in this
  feature.
- **FR-009**: A new integration test MUST assert that a hosted
  request to `/api/resume/parse` with no `Authorization` header
  returns `401`, and that the response body contains no parser
  library name, stack trace, or internal path.
- **FR-010**: A new integration test MUST assert that during a
  happy-path parse, zero write-path filesystem calls occur. The
  spy set covers `fs.writeFile`, `fs.writeFileSync`,
  `fs.appendFile`, `fs.appendFileSync`, `fs.createWriteStream`,
  `fs.writeSync`, `fs.promises.writeFile`, `fs.promises.appendFile`
  (asserted to have zero calls) and `fs.open` / `fs.openSync`
  (asserted to have zero calls **whose flags argument indicates
  write/create/truncate/append intent** — read-mode opens are
  expected and not counted, since the module loader and library
  debug paths legitimately call them in-process during the test).
  The same assertion must hold for every failure path (oversized,
  unsupported, validation error, parse failure).
- **FR-011**: A new integration test MUST assert that a corrupted
  PDF and a corrupted DOCX each return `400 PARSE_FAILED` with the
  fixed generic message, and that the response body contains no raw
  library error string.
- **FR-012**: The five files that constitute the resume parse code
  path — `server/routes/resume.js`, `server/resume/extractor.js`,
  `server/resume/parser.js`, `src/services/resumeApi.js`,
  `src/components/ResumeImport.js` — MUST NOT contain any reference
  to `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, or any
  admin-bypass credential. A vitest regression guard reads these
  files at test time and asserts the strings are absent. A
  repo-wide audit is out of scope for this feature.
- **FR-013**: A new `contracts/api.md` MUST document the security
  model for the endpoint: threat model, the four-layer defense
  (frontend demo gate → server auth gate → multer validation →
  parser validation), the explicit guarantees the endpoint provides,
  and the explicit non-guarantees (no malware scan, no content
  inspection beyond format-aware text extraction).

---

## Success Criteria

- **SC-001**: Authenticated hosted POST to `/api/resume/parse` with a
  valid PDF/DOCX/TXT under 5 MB returns `200` with the existing
  parsed-fields response shape. Existing happy-path tests
  ([tests/server/resume.test.js](../../tests/server/resume.test.js))
  remain green.
- **SC-002**: Hosted POST with no `Authorization` header returns
  `401`; no parser library is loaded; no response-body leak. (FR-001,
  FR-009)
- **SC-003**: Oversized upload (> 5 MB) returns `400 FILE_TOO_LARGE`
  with the existing message. (FR-003)
- **SC-004**: Unsupported file type returns `400 UNSUPPORTED_FILE_TYPE`
  with the existing message. (FR-004)
- **SC-005**: Missing `resume` field returns `400 VALIDATION_ERROR`
  with the existing message. (FR-005)
- **SC-006**: Corrupted PDF and corrupted DOCX each return `400
  PARSE_FAILED` with a fixed generic message; no raw library text in
  the body. The real error is captured in server logs. (FR-006,
  FR-011)
- **SC-007**: Zero filesystem writes occur during any request to
  `/api/resume/parse`, across every success and failure path. (FR-002,
  FR-010)
- **SC-008**: Feature 020's fetch-spy regression guard in
  [tests/services/resumeApi.demo.test.js](../../tests/services/resumeApi.demo.test.js)
  remains green — demo visitors never reach the network. (FR-008)
- **SC-009**: A repo-scoped grep across the resume code path returns
  zero hits for `SUPABASE_SERVICE_ROLE_KEY` / `service_role`. (FR-012)
- **SC-010**: `contracts/api.md` exists and documents the four-layer
  defense model plus the explicit non-guarantees. (FR-013)

---

## Edge Cases

- **Zero-byte file uploaded.** Multer accepts the upload (size is 0,
  within the limit); the extractor receives an empty buffer. Decision:
  treat as `PARSE_FAILED` — `pdf-parse` / `mammoth` will throw; the
  TXT path returns an empty string which the parser will reject.
- **File with a recognized extension but wrong magic bytes** (e.g., a
  `.pdf` file that is actually plain text). Today the extractor
  routes by mimetype + extension; the parser library will throw.
  Decision: `PARSE_FAILED`.
- **Mimetype is `application/octet-stream`** (browser fallback when
  it can't guess). Today the extractor falls back to extension. No
  change.
- **Concurrent uploads from the same authenticated user.** Each
  request gets its own `req.file.buffer`; no shared state between
  requests. No change needed.
- **Upload arrives during a token refresh.** The request was sent
  with token T1, which is still in its validity window at the server's
  verification time. `requireAuth` validates against the JWKS;
  succeeds. No change needed.
- **A valid JWT for user A while the parsing is "for user B"** — the
  endpoint does not write per-user data and does not accept a
  user-id parameter, so confused-deputy risk is N/A. Parsed fields
  are returned to the requesting client only.
- **Filename contains path traversal** (`../../etc/passwd.pdf`). The
  filename is used only as a fallback for MIME resolution via
  `getExtension(originalname)`. It is not used as a filesystem path
  (memoryStorage). No change.
- **Filename contains Unicode / control characters.** Same as above —
  filename is not a filesystem path. No injection risk.
- **Parser library spawns a child process or makes a network call.**
  Neither `pdf-parse` nor `mammoth` does this in their current
  versions. If a future version did, the filesystem-spy test would
  not catch it. Out of scope for this feature; the threat model in
  `contracts/api.md` flags this as a residual risk.

---

## Data Considerations

- **No new persistent data.** No tables, columns, env vars, or files.
- **In-memory lifetime.** The uploaded buffer exists only for the
  duration of the request handler. Node.js GC reclaims it after the
  response is sent.
- **Parsed text lifetime.** Same as the buffer — exists only in the
  handler scope, returned in the response body, never stored.
- **Logged data.** Server-side logs for parse failures (FR-006)
  capture the request path, a redacted file identifier (e.g., the
  first 8 chars of a SHA-256 of the filename, not the filename
  itself), and the raw library error message. The log MUST NOT
  include the resume content or its decoded text.
- **No analytics or telemetry.** Constitution: "Analytics, tracking,
  and third-party data sharing MUST be absent by default."
- **Local mode is unchanged.** The local SQLite runtime does not run
  `requireAuth` and keeps its existing open endpoint behavior for
  single-user dev use. The security-model documentation in
  `contracts/api.md` is explicit about this scope boundary.

---

## Constitution Compliance

- **Required fields**: N/A — this feature does not touch the
  application or profile data models.
- **Validation rules**: extends the existing validation surface for
  the resume endpoint; no silent data corruption (parse failures
  surface as `400 PARSE_FAILED`).
- **Testing**: every functional requirement above is paired with at
  least one automated test (§Success Criteria).
- **UX**: error responses are actionable; the client-facing message
  for `PARSE_FAILED` is one short sentence with a suggested next step
  ("Try a different file").
- **Architecture**: no new dependencies, no new env vars, no new
  endpoints; isolates the change to the resume route and a new
  contracts doc.
