# Data Model: Hosted Resume Import Security (021)

This feature introduces **no schema changes**, **no new persistent
data**, and **no new env vars**. The document exists to formalize
the request/response shapes the feature pins by test, and to make
explicit that nothing is added to any persistence layer.

---

## 1. Persistent data — none added

| Layer | Change in 021 |
|---|---|
| SQLite (local) | none — schema unchanged |
| Supabase Postgres (hosted) | none — schema unchanged |
| `localStorage` / `sessionStorage` / IndexedDB | none — no new keys |
| Cookies | none |
| Files on disk (server) | none — `multer.memoryStorage()` continues to prevent any tmp file write; FR-010 adds a regression guard |

The endpoint's invariant — *no uploaded byte and no parsed text
reaches a persistence layer* — is reinforced by the new fs-spy test
(FR-010) and the new `contracts/api.md` guarantee §4.2/§4.3.

---

## 2. Request shape (unchanged)

```
POST /api/resume/parse
Content-Type: multipart/form-data
Authorization: Bearer <supabase-jwt>      ← hosted mode only

multipart body:
  resume: File   (PDF | DOCX | TXT, ≤ 5 MB)
```

The handler reads `req.file.buffer`, `req.file.mimetype`, and
`req.file.originalname` (the last one used only for MIME fallback,
never as a filesystem path).

---

## 3. Response shape

### Success (unchanged from feature 014)

```json
{
  "data": {
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "phone": "...",
    "summary": "...",
    "experience": [ ... ],
    "education": [ ... ],
    "skills": [ ... ],
    "languages": [ ... ],
    "certifications": [ ... ],
    "awards": [ ... ],
    "links": [ ... ]
  }
}
```

The parsed-field shape is owned by
[server/resume/parser.js](../../server/resume/parser.js#parseResumeText)
and is unchanged by this feature.

### Error envelope (existing + 1 new code)

```json
{
  "error": {
    "code": "<ERROR_CODE>",
    "message": "<fixed client-facing message>"
  }
}
```

| `code` | HTTP | Message | Source |
|---|---|---|---|
| `FILE_TOO_LARGE` | 400 | `File exceeds the 5 MB size limit.` | Existing (014) |
| `UNSUPPORTED_FILE_TYPE` | 400 | `Unsupported file type. Please upload a PDF, DOCX, or TXT file.` | Existing (014) |
| `VALIDATION_ERROR` | 400 | `No resume file provided.` | Existing (014) — in 021 also covers non-size multer errors (e.g. `LIMIT_UNEXPECTED_FILE` when the field is misnamed) |
| `PARSE_FAILED` | 400 | `Could not read this resume. Try a different file.` | **NEW in 021 (FR-006)** |
| (auth-middleware shape) | 401 | (set by `requireAuth`) | Existing (018) |
| `INTERNAL_ERROR` | 500 | (set by global handler — should be rare post-021) | Existing |

The five 400-class messages are exact string equality with the
client. The 401 shape is owned by
[server/auth/middleware.js](../../server/auth/middleware.js) and is
out of scope here.

---

## 4. Server-side log shapes (NEW in 021)

The resume route emits `[resume.parse]` logs from two failure branches.
Each log is a structured object passed as the second argument to
`console.error`.

### Parser-throw log

The resume-route–scoped catch emits exactly one log line when parser
execution fails after multer has accepted the upload:

```js
console.error('[resume.parse]', {
  error: error?.message ?? 'unknown',
  stack: error?.stack,
  nameSha8: <8-char SHA-256 prefix of req.file.originalname>,
  mimetype: req.file?.mimetype,
  path: req.originalUrl?.split('?')[0] ?? req.path,
});
```

**Allowed parser fields**: `error`, `stack`, `nameSha8`, `mimetype`,
`path`.

`mimetype` is included because it materially helps triage parser
failures where the browser-asserted MIME does not match the actual
bytes (e.g., `application/pdf` sent for a TXT file). It is not PII.

`path` is the sanitized request path (query string stripped). It is
required by spec FR-006 / Data Considerations so aggregated log
streams remain self-describing. The endpoint has a single route
today, but the field future-proofs the log shape for downstream
ingestion tools that filter by path.

### Multer-error log

Client-shape multer errors other than `LIMIT_FILE_SIZE` emit exactly
one log line before returning `400 VALIDATION_ERROR`:

```js
console.error('[resume.parse]', {
  error: uploadError.message,
  code: uploadError.code,
  path: req.originalUrl?.split('?')[0] ?? req.path,
});
```

**Allowed multer-error fields**: `error`, `code`, `path`.

`code` is included because it identifies the multer rejection class
(`LIMIT_UNEXPECTED_FILE`, `LIMIT_FIELD_KEY`, etc.) without exposing
the raw multipart field name or uploaded filename.

**Forbidden fields** (regression-tested by `tests/server/resume.test.js`):
- `originalname` — the raw filename is PII-adjacent and is never logged
- raw multipart field names (for example, a misnamed upload field)
- `buffer` or any representation of the resume bytes
- `text` or any representation of the extracted text

---

## 5. Configuration — no new env vars

| Env var | Status in 021 |
|---|---|
| `APP_RUNTIME` | unchanged — `local` or `hosted` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | unchanged — read only by hosted auth + repository factories; never by the resume code path (FR-012 regression guard) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_REDIRECT_URL` | unchanged |
| (new in 021) | none |

The 5 MB upload limit stays hard-coded (spec Non-Goal §7). No flag
to disable the resume endpoint; no flag to toggle sanitized errors.

---

## 6. Migration — none

No migration is required. The new error code is purely additive:

- Existing clients that handle the four pre-021 codes (`FILE_TOO_LARGE`,
  `UNSUPPORTED_FILE_TYPE`, `VALIDATION_ERROR`, plus `INTERNAL_ERROR`
  fallthrough) continue to work — a `PARSE_FAILED` response that the
  client doesn't explicitly handle still falls into the "error code I
  don't recognize" branch and shows the message from the response.
- The frontend `src/components/ResumeImport.js` already handles
  unknown error codes by showing `error.message` directly, so the
  new code's fixed message ("Could not read this resume…") will
  render correctly without code changes on the frontend.

If the frontend ever introduces a code-based switch for resume error
codes, `PARSE_FAILED` should be added explicitly to that switch. Today,
no such switch exists.

---

## 7. Test pinning

| Shape | Pinning test |
|---|---|
| Request: hosted requires JWT | `tests/server/resume.test.js` — new `hosted unauthenticated returns 401` test (FR-009) |
| Request: 5 MB cap | `tests/server/resume.test.js` — existing oversized-upload test (regression) |
| Response: PARSE_FAILED code + message | `tests/server/resume.test.js` — new corrupted-file test (FR-006 / FR-011) |
| Response: error body contains no library text | `tests/server/resume.test.js` — same test (FR-011 sanitization assertion) |
| Log shape: nameSha8 only, no filename | `tests/server/resume.test.js` — new log-spy assertion (part of FR-006) |
| No fs writes | `tests/server/resume.test.js` — new fs-spy group (FR-010) |
| Service-role-key absence | `tests/server/resume.test.js` — new grep-style regression guard (FR-012) |
