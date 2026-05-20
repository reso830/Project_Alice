# Contract: `POST /api/resume/parse` — Security Model

**Feature**: [021-hosted-resume-import-security](../spec.md)
**Status**: Draft (will be the post-021 canonical reference)

This document is the explicit security model for the hosted resume
parse endpoint. It supersedes any prior implicit assumptions in the
codebase about what this endpoint does and does not protect against.

---

## 1. Endpoint Surface

```
POST /api/resume/parse
Content-Type: multipart/form-data
Authorization: Bearer <supabase-jwt>     ← hosted mode only
Body: { resume: <File>  /* PDF | DOCX | TXT, ≤ 5 MB */ }
```

### Responses

| Status | Code | When |
|---|---|---|
| 200 | — | Parse succeeded; body is `{ data: <parsed-fields> }` |
| 400 | `FILE_TOO_LARGE` | Upload exceeded 5 MB (multer-enforced) |
| 400 | `UNSUPPORTED_FILE_TYPE` | Extension/MIME is not PDF, DOCX, or TXT |
| 400 | `VALIDATION_ERROR` | No `resume` field in the multipart body, OR any non-size multer upload error (misnamed field, too many parts, oversized field value, etc.) |
| 400 | `PARSE_FAILED` | The file parser threw (corrupted file, malformed structure). **NEW in 021** |
| 401 | (auth-middleware shape) | Hosted: missing, malformed, expired, or forged JWT |
| 500 | `INTERNAL_ERROR` | Unexpected server-side failure (OOM, dependency missing) — caught by the global handler. Should be **rare** post-021 since parser library throws are now caught and mapped to 400 |

The 400 client-facing messages are fixed strings; they do not echo
library internals, file offsets, or stack-trace text.

---

## 2. Threat Model

### In scope (defenses implemented + tested)

| Threat | Defense | Layer |
|---|---|---|
| Unauthenticated read of parse functionality | `router.use(requireAuth)` mounted in hosted mode | Server auth (Layer 2) |
| Demo visitor bypasses UI gates and POSTs directly | Demo visitor has no Supabase JWT → 401 from `requireAuth` | Server auth (Layer 2) |
| Disk exhaustion via large uploads | `multer({ limits.fileSize: 5_242_880 })` (5 MB) | Upload validation (Layer 3) |
| Disk persistence of uploaded content | `multer.memoryStorage()` — never writes to disk; pinned by FS-spy regression test | Upload validation (Layer 3) |
| Malformed file type (`.exe`, `.zip`, etc.) crashes parser | Extension + MIME validation → 400 `UNSUPPORTED_FILE_TYPE` before parser runs | Format validation (Layer 4) |
| Library internals leak to client via error responses | Resume-route–scoped catch → 400 `PARSE_FAILED` with generic message; raw error logged server-side only | Format validation (Layer 4) |
| Service-role credential reachable from resume code path | `SUPABASE_SERVICE_ROLE_KEY` never imported or referenced in any resume-path file; pinned by grep regression test | Defense in depth |
| Cross-user data leak via the endpoint | Endpoint does not accept a user-id parameter, does not write per-user data, returns parsed fields only to the requesting client | Server semantics |

### Out of scope (residual risks)

| Threat | Why not defended | Mitigation strategy |
|---|---|---|
| Malicious content embedded in a valid PDF (e.g., a PDF that exploits a `pdf-parse` CVE) | No malware scanning per spec Non-Goal §3 | Keep `pdf-parse` / `mammoth` versions current via `npm audit`; the parser runs in a serverless function instance that is recycled, limiting blast radius |
| Resume content rendered as HTML in the client | Frontend renders parsed text via `textContent`, not `innerHTML`; passive defense — out of scope for 021 | Documented for a future server-side sanitization feature |
| High-frequency upload attack exhausts function memory | No application-level rate limiting per spec Non-Goal §8 | Vercel platform protections (BotID, Firewall) provide baseline DDoS mitigation; a future feature could add per-user limits |
| Filename in server logs is PII | Logs use an 8-char SHA-256 prefix of the filename, not the raw name (FR-006) | Documented in `research.md §6` |
| Parser library calls out to the network or spawns a child process | `pdf-parse` and `mammoth` don't do this today; fs-spy regression test would not catch it if they started | Documented in `research.md §7` — re-evaluate on library upgrades |
| Local-mode endpoint is open to anyone on the dev network | Local mode has no auth by design; assumption is the dev server is not exposed to a network | Documented in spec Non-Goal §1 |
| Global 500 handler in `server/index.js:74-91` still echoes `err.message` | Out of scope per spec Non-Goal §2 | Flagged as future work in `research.md §11.1` |

---

## 3. Four-Layer Defense

Each layer is independent. Removing any one layer does not collapse
the others.

### Layer 1: Frontend demo gate (feature 020)

Three independent client-side defenses prevent a demo visitor from
ever attempting the request:

1. [src/components/ResumeImport.js](../../../src/components/ResumeImport.js) —
   `VISIBLE_STATUSES` set excludes `'demo'`. The component's root is
   `hidden = true` whenever `authStore.getAuthState().status === 'demo'`.
   The set is exported and a design-by-contract test
   (`tests/components/ResumeImport.demo.test.js`) asserts
   `!VISIBLE_STATUSES.has(DEMO_STATUS)`.
2. [src/pages/ProfileEdit.js](../../../src/pages/ProfileEdit.js) —
   `renderResumeImportArea` checks `authStore.getAuthState().status ===
   'demo'` and renders the inline note element
   (`.profile-edit__resume-demo-note`) **instead of** mounting
   `ResumeImport`. The widget never enters the DOM in demo.
3. [src/services/resumeApi.js](../../../src/services/resumeApi.js) —
   `parseResume` throws
   `{ code: 'DEMO_FEATURE_UNAVAILABLE', message: 'Resume import is available after signing in.' }`
   at the top of the function if status is `'demo'`, before any
   `fetch` call. A fetch-spy regression test
   ([tests/services/resumeApi.demo.test.js](../../../tests/services/resumeApi.demo.test.js))
   asserts `fetch` is never called from this path.

If all three layers fail (a hand-crafted fetch from the browser console
or a non-app HTTP client), Layer 2 catches it.

### Layer 2: Server auth gate

[server/routes/resume.js:36-38](../../../server/routes/resume.js#L36-L38)
mounts `router.use(requireAuth)` whenever a `requireAuth` middleware
is passed to `createResumeRouter`. In hosted mode,
[server/index.js:29-37](../../../server/index.js#L29-L37) builds
`requireAuth` automatically from the JWKS URI derived from
`config.supabase.url`.

`requireAuth` rejects any request without a valid Supabase JWT with a
401 response. The JWT signature is verified against the JWKS endpoint
using `jose.jwtVerify` with an explicit `['ES256', 'RS256']` algorithm
allowlist. Demo visitors have no JWT — they are 401-rejected here.

**Regression test (FR-009)**: hosted POST without `Authorization` →
401; response body contains no parser library name, stack trace, or
internal path.

### Layer 3: Upload validation (multer)

[server/routes/resume.js:31-34](../../../server/routes/resume.js#L31-L34)
configures:

```js
multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_242_880 },  // 5 MB
});
```

- `memoryStorage()` — uploads live in `req.file.buffer`. **No disk
  write occurs at any point in the request lifecycle.**
- `limits.fileSize` — multer rejects the upload with `LIMIT_FILE_SIZE`
  before fully buffering the file; the handler maps this to
  `400 FILE_TOO_LARGE`.
- Every other `multer.MulterError` code
  (`LIMIT_UNEXPECTED_FILE`, `LIMIT_FIELD_KEY`, `LIMIT_FIELD_VALUE`,
  `LIMIT_FIELD_COUNT`, `LIMIT_FILE_COUNT`, `LIMIT_PART_COUNT`) is
  mapped to `400 VALIDATION_ERROR` with the raw multer message
  logged server-side only — closing FR-007's "no client-shape error
  reaches the global 500 handler" guarantee.

**Regression test (FR-010)**: install pass-through spies on
`fs.writeFile`, `fs.writeFileSync`, `fs.appendFile`,
`fs.appendFileSync`, `fs.createWriteStream`, `fs.writeSync`,
`fs.promises.writeFile`, `fs.promises.appendFile`, `fs.open`, and
`fs.openSync` for every parse-endpoint test (happy + sad). Assert
zero calls on every spy except `open` / `openSync`; for those two,
assert zero calls whose flags argument indicates
write/create/truncate/append intent (read-mode opens are expected
in-process during the test — the module loader and library debug
paths use them legitimately).

### Layer 4: Format validation (extractor + parser)

[server/resume/extractor.js#extractText](../../../server/resume/extractor.js)
resolves the file type via mimetype + extension fallback, then routes
to:

- `extractPdfText(buffer)` — lazy-imports `pdf-parse`, calls
  `parser.getText()` in memory, ensures `parser.destroy()` runs in a
  `finally` block.
- `extractDocxText(buffer)` — lazy-imports `mammoth`, calls
  `mammoth.extractRawText({ buffer })`.
- `Buffer.toString('utf8')` for TXT.

Anything else throws `UnsupportedFileTypeError`, which the route maps
to `400 UNSUPPORTED_FILE_TYPE`.

**NEW in 021**: any other throw from the extractor or parser
(`pdf-parse` library error, `mammoth` ZIP-corruption error,
empty-buffer error, format-internal error) is caught by the new
resume-route–scoped catch and mapped to `400 PARSE_FAILED` with a
fixed generic message. The raw error is logged server-side via
`console.error('[resume.parse]', { error, stack, nameSha8, mimetype })`.

**Regression test (FR-011)**: corrupted PDF + corrupted DOCX each
return `400 PARSE_FAILED` with the fixed message; response body
contains no library name; the `[resume.parse]` log line was emitted.

---

## 4. Explicit Guarantees

This endpoint guarantees:

1. In hosted mode, every request is authenticated before any
   parsing logic runs.
2. No uploaded file is ever written to disk.
3. No uploaded file is ever stored in Supabase, in a cache, or in
   any persistence layer.
4. The parsed-field response contains only the fields the parser
   extracted; no raw resume bytes, no library metadata.
5. Error responses use a fixed set of error codes with fixed
   client-facing messages. No library internals leak via the
   response body.
6. Server-side logs do not contain the raw filename or the resume
   content; only an 8-char SHA-256 prefix of the filename for
   correlation (unsalted — the goal is opaque correlation, not
   resistance to a preimage attack on a known filename).
7. The `SUPABASE_SERVICE_ROLE_KEY` credential is unreachable from
   any code in the resume parse path.

---

## 5. Explicit Non-Guarantees

This endpoint does NOT guarantee:

1. That the uploaded file is free of malware. No malware scanning is
   performed. Spec Non-Goal §3.
2. That the resume content cannot exploit a future parser library
   CVE. Mitigation is keeping libraries current; not a runtime
   defense.
3. That repeated high-frequency uploads cannot exhaust a function
   instance's memory. Spec Non-Goal §8.
4. That every error path in `server/index.js` is fully sanitized.
   The global 500 handler still echoes `err.message` for genuinely
   unexpected errors outside the resume route. Spec Non-Goal §2.
5. That local-mode (`APP_RUNTIME=local` or absent) is auth-gated.
   Local is open by design. Spec Non-Goal §1.

---

## 6. Local Mode Note

In local mode:

- No `requireAuth` middleware is mounted (Layer 2 is absent).
- The endpoint is openly callable on the local dev server.
- All other layers (3, 4) and the new `PARSE_FAILED` sanitization
  apply uniformly — local-mode error responses are also sanitized.

Local mode's threat model assumes the developer owns the machine and
the dev server is not exposed to a network. The constitution allows
this; the deployment guide
([docs/deployment.md](../../../docs/deployment.md)) is explicit that
hosted is the multi-user surface.

---

## 7. Pinning Summary

Every guarantee above is pinned by at least one automated test:

| Guarantee | Pinning test |
|---|---|
| §4.1 auth-required in hosted | `tests/server/resume.test.js` — new `hosted unauthenticated returns 401` group (FR-009) |
| §4.2 no disk write | `tests/server/resume.test.js` — new `no filesystem writes during any parse path` group (FR-010) |
| §4.3 no Supabase persistence | Provable by §4.2 (no fs write) + endpoint code reading (the route does not import any Supabase adapter) |
| §4.4 sanitized response shape | Existing parser tests in `tests/server/resumeParser.test.js` + new sanitization assertions in `tests/server/resume.test.js` |
| §4.5 fixed error code set | `tests/server/resume.test.js` — exhaustive test cases for `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `VALIDATION_ERROR`, `PARSE_FAILED` |
| §4.6 PII-minimized logs | Server-side; verified by reading the `[resume.parse]` log shape in the source |
| §4.7 service-role-key unreachable | `tests/server/resume.test.js` — new grep-style regression guard (FR-012) |

---

## 8. Change Procedure

A future change that touches this contract must:

1. Update this document first (the spec → contract → code order).
2. Add or update the pinning test in `tests/server/resume.test.js`.
3. Run `npm run test:run` + `npm run lint` clean before commit.
4. If a non-additive change (e.g., new required field, removed
   error code), follow the constitution's review-gate process.
