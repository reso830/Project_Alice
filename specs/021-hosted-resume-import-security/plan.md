# Implementation Plan: Hosted Resume Import Security (021)

**Branch**: `021-hosted-resume-import-security` | **Date**: 2026-05-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/021-hosted-resume-import-security/spec.md`
**Depends on**: [014-resume-parser-profile](../014-resume-parser-profile/spec.md) (endpoint shape, parser libraries, extractor MIME contract), [018-auth-user-access](../018-auth-user-access/spec.md) (`requireAuth` JWKS verification, 401 contract), [020-portfolio-demo-mode](../020-portfolio-demo-mode/spec.md) (frontend three-layer demo gate, fetch-spy regression pattern)

---

## Summary

This is a **security-hardening + verification** feature, not net-new
functionality. Most of the security properties the brief calls for are
already in place from features 014/018/020. The work here is:

1. **Plug one observable leak.** Parse failures (corrupted PDF,
   malformed DOCX) currently fall through `next(error)` →
   [server/index.js:74-91](../../server/index.js#L74-L91) global 500
   handler, which echoes `err.message` to the client and can expose
   library internals (pdf-parse stack text, mammoth ZIP error
   strings). Extend the existing `try`/`catch` branch inside the
   `/parse` route handler (an in-handler `catch`, NOT a separate
   four-arg express error middleware) so any non-`UnsupportedFileTypeError`
   throw maps to `400 PARSE_FAILED` with a fixed generic client
   message and the raw error is logged server-side only.

2. **Pin three existing invariants with regression tests** so a
   future refactor cannot silently regress them:
   - hosted unauthenticated POST → `401`, no library names in body
     (FR-009)
   - zero filesystem writes during any parse path (FR-010)
   - resume code path contains no reference to
     `SUPABASE_SERVICE_ROLE_KEY` (FR-012)

3. **Document the security model** in a new
   `contracts/api.md`: threat model, four-layer defense (frontend
   demo gate → server auth → multer validation → parser validation),
   explicit guarantees, explicit non-guarantees (no malware scan,
   no content inspection beyond format-aware text extraction).

No new endpoints, no new env vars, no new dependencies. The visible
delta against `main` is approximately:

- ~25 lines changed in `server/routes/resume.js` (one new error
  constant, one new catch branch, one `console.error` call).
- 4 new test files / test groups exercising the regression guards
  above.
- 1 new doc file (`contracts/api.md`) + small additions to
  `research.md` and `quickstart.md`.

---

## Architecture

### Current request flow (pre-021)

```
Client (browser)
   │  POST /api/resume/parse (multipart)
   ▼
multer({ memoryStorage, limits.fileSize: 5_242_880 })
   │  ── exceeds limit ──► 400 FILE_TOO_LARGE
   │  ── no file ────────► 400 VALIDATION_ERROR
   ▼
extractText(buffer, mime, name)         server/resume/extractor.js
   │  ── UnsupportedFileTypeError ────► 400 UNSUPPORTED_FILE_TYPE
   │  ── pdf-parse / mammoth throw ───► next(error)
   ▼                                          │
parseResumeText(text)                         │
   │                                          ▼
   ▼                              server/index.js global 500 handler
200 OK { data: parsed }            500 INTERNAL_ERROR { message: err.message }
                                                                   ▲
                                                                   │
                              ❌ leaks library internals to client
```

In hosted mode, `router.use(requireAuth)` mounts at the top of the
resume router so every branch above is gated behind a 401-or-else
check.

### Post-021 request flow

```
Client (browser)
   │  POST /api/resume/parse (multipart)
   ▼
requireAuth (hosted only)
   │  ── invalid/missing JWT ─────────► 401 (regression-tested)
   ▼
multer({ memoryStorage, limits.fileSize: 5_242_880 })
   │  ── exceeds limit ──► 400 FILE_TOO_LARGE     (unchanged)
   │  ── no file ────────► 400 VALIDATION_ERROR    (unchanged)
   ▼
extractText(buffer, mime, name)
   │  ── UnsupportedFileTypeError ────► 400 UNSUPPORTED_FILE_TYPE (unchanged)
   │  ── any other throw ─────────────► NEW resume-scoped catch:
   │                                       console.error([resume.parse] …)
   │                                       400 PARSE_FAILED
   ▼                                       (raw error never leaves server)
parseResumeText(text)
   │  ── throw ──────────────────────► same NEW catch → PARSE_FAILED
   ▼
200 OK { data: parsed }
```

The only line-level change is the catch block at the bottom of the
route handler in
[server/routes/resume.js:60-66](../../server/routes/resume.js#L60-L66).

### Defense in depth (post-021)

Layer | Mechanism | Failure mode caught
---|---|---
1. Frontend demo gate | `VISIBLE_STATUSES` set + `ProfileEdit` inline-note branch + `resumeApi.js DEMO_FEATURE_UNAVAILABLE` throw (all from feature 020) | A demo visitor never sees the UI and a misbehaving caller never reaches `fetch`
2. Server auth gate | `router.use(requireAuth)` mounted in hosted mode | A direct fetch from any unauthenticated client (including a demo visitor whose client gates were bypassed) → 401 before the handler runs
3. Upload validation | `multer({ memoryStorage, limits.fileSize: 5_242_880 })` | Oversized → 400 FILE_TOO_LARGE; missing field → 400 VALIDATION_ERROR; never writes to disk
4. Format validation | `extractor.js#extractText` MIME + extension resolution | Unrecognized extension → 400 UNSUPPORTED_FILE_TYPE; corrupted PDF/DOCX → NEW 400 PARSE_FAILED (sanitized)

Each layer is independent. Removing any one of them does not collapse
the others. The `contracts/api.md` deliverable formalizes this.

---

## Data Flow

### Request lifetime

| Stage | Data state | Persistent? |
|---|---|---|
| HTTP body arrival | bytes streamed by Express's body parser via multer | no — buffered in memory by multer's `memoryStorage` engine |
| Handler entry | `req.file.buffer` (Buffer instance) + `req.file.mimetype` + `req.file.originalname` | no — lives in the handler scope |
| Extractor | PDF/DOCX/TXT decoder reads the buffer in memory; allocates intermediate strings | no — strings live only for the extractor's stack |
| Parser | regex passes over the extracted text; produces a structured object | no — lives in the handler scope |
| Response | JSON-serialized parsed object | no — Node streams the response and frees the buffer |
| After response | nothing references the buffer or parsed text | GC reclaims |

No tmp file, no DB row, no Supabase upload, no log of the resume
content (only the request path + a redacted file identifier per
FR-006's logging contract).

### Server-side logging (NEW)

A single `console.error('[resume.parse]', { … })` call inside the
new catch branch. The logged object includes:

- `error` — `err.message ?? 'unknown'`
- `stack` — `err.stack` for server-side debugging
- `nameSha8` — first 8 chars of `crypto.createHash('sha256').update(originalname).digest('hex')` to correlate a failure to an upload without logging the filename (which a user might consider PII)

Tests assert this `console.error` was called once during a corrupted-
file test, and was NOT called during the happy path or the
unauthenticated 401 path.

---

## Affected Components

### Files likely to be **modified**

| Path | Why | Approximate change |
|---|---|---|
| [server/routes/resume.js](../../server/routes/resume.js) | Add `PARSE_FAILED` to `ERROR_RESPONSES`; replace the catch's `next(error)` with the new sanitized mapping + server-side log | ~20 added / 1 modified lines |
| [tests/server/resume.test.js](../../tests/server/resume.test.js) | Add new test cases for the four regression guards (auth-required, in-memory-only via fs spy, parse-failure sanitization, no-service-role-key reference) | ~120 added lines |
| [CHANGELOG.md](../../CHANGELOG.md) | Phase 06 release prep entry | ~25 lines |
| [package.json](../../package.json), `package-lock.json`, [src/pages/welcome/shared/appMeta.js](../../src/pages/welcome/shared/appMeta.js) | Version bump 0.10.0 → 0.11.0 (MINOR — new error code is additive; no existing client behavior breaks) | 3 lines + regenerated lockfile |
| [README.md](../../README.md) | One-line current-version update + optional security-model link | ~3 lines |
| [docs/REPO_MAP.md](../../docs/REPO_MAP.md) | One-line note on the new `contracts/api.md` location; resume.js row already exists | ~2 lines |

### Files likely to be **inspected only**

| Path | Why |
|---|---|
| [server/index.js](../../server/index.js) | Confirm `requireAuth` is built in hosted mode and passed to `createResumeRouter`; no changes needed here, the global 500 handler stays as-is per spec non-goals |
| [server/resume/extractor.js](../../server/resume/extractor.js) | Confirm `UnsupportedFileTypeError` is the only sentinel-class error the catch needs to distinguish |
| [server/resume/parser.js](../../server/resume/parser.js) | Confirm it doesn't throw library-named errors that should bypass `PARSE_FAILED` |
| [src/components/ResumeImport.js](../../src/components/ResumeImport.js), [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js), [src/services/resumeApi.js](../../src/services/resumeApi.js) | Confirm feature 020's three demo-gating layers are intact |
| [server/auth/middleware.js](../../server/auth/middleware.js) | Confirm the 401 response shape for FR-009's assertion |
| [tests/server/auth-middleware.test.js](../../tests/server/auth-middleware.test.js), [tests/server/routes-protected.test.js](../../tests/server/routes-protected.test.js) | Borrow the existing `createApp({ requireAuth: stubReject })` pattern for hosted-mode test setup |

### Files / tests likely to be **added**

| Path | Why |
|---|---|
| [specs/021-hosted-resume-import-security/contracts/api.md](contracts/api.md) | FR-013 deliverable: security model documentation |
| [specs/021-hosted-resume-import-security/research.md](research.md) | Decision log: hosted-only scope, demo via 401, error sanitization scope, global-500 handler deferred |
| [specs/021-hosted-resume-import-security/checklists/plan-review.md](checklists/plan-review.md) | Pre-implementation review gate |
| [specs/021-hosted-resume-import-security/quickstart.md](quickstart.md) | Manual verification recipe for the new sanitized-error contract |

### Out of scope (explicitly)

| Area | Why |
|---|---|
| Local-mode auth gating | Local has no auth model; the endpoint stays open in local for single-user dev (spec Non-Goal §1) |
| Hardening the global 500 handler in `server/index.js:74-91` | Affects every route; broader scope; flagged in `research.md` as future work (spec Non-Goal §2) |
| Malware scanning | Spec Non-Goal §3 |
| OCR / image parsing | Spec Non-Goal §4 |
| Cloud file storage integration | Spec Non-Goal §5 |
| Resume export / download / history | Spec Non-Goal §6 |
| Making the 5 MB limit configurable | Spec Non-Goal §7 |
| Rate limiting | Spec Non-Goal §8 |
| Custom demo-detection header on the server | Spec Non-Goal §9; demo is provably 401-rejected via existing `requireAuth` |
| Changing the parsed-data response shape | Spec Non-Goal §10 |
| Frontend behavior changes | Feature 020's three demo gates are unchanged; spec Non-Goal §11 |

---

## Phase Map

| Phase | Theme | Blocks |
|---|---|---|
| 01 | Implement `PARSE_FAILED` mapping in `server/routes/resume.js` + the test that asserts a corrupted PDF returns it (TDD pair) | 05 |
| 02 | Regression test: hosted unauthenticated POST → 401, no leaks | 05 (parallel with 01, 03, 04) |
| 03 | Regression test: zero filesystem writes during any parse path (`fs.write*` spy) | 05 (parallel) |
| 04 | Regression test: `SUPABASE_SERVICE_ROLE_KEY` never referenced in the resume code path (grep-style guard) | 05 (parallel) |
| 05 | Verify `contracts/api.md` + `research.md` against implementation built in 01–04 (drafted during planning) | 06 |
| 06 | Release Prep — version bump 0.10.0 → 0.11.0, CHANGELOG, README current-version, REPO_MAP entry for `contracts/api.md`, docs sanity check | Merge |

Phases 01–04 are mostly independent and can run in parallel. Phase 01
is the only phase that adds non-test code; 02–04 add tests only.

This feature has **no UI changes** so the constitution's Browser Smoke
Test (Amendment 1.3.0, "UI features only") is not required. The
manual verification in [quickstart.md](quickstart.md) walks the new
sanitized-error contract end to end on a hosted preview deploy as the
final pre-merge check.

---

## Risks and Tradeoffs

### Risk 1 — Masking genuinely unexpected errors

**Risk**: The new catch maps "any error that isn't
`UnsupportedFileTypeError`" to `PARSE_FAILED`. An OOM, a missing
dependency, or a typo-induced `TypeError` would all surface as a
client-facing "Could not read this resume" instead of bubbling to the
global 500 handler where ops would expect to see a real bug.

**Mitigation**:
- The catch logs `error.message + error.stack` via `console.error` —
  ops can still see the real failure in server logs.
- Tests assert `console.error` was called for the corrupted-file
  cases; this gives a passive signal that the path runs.
- Most genuinely-unexpected errors in Node (OOM, fatal V8 errors)
  crash the process rather than reach a JS catch block.

**Residual risk**: a future bug that throws inside the parser would
look like a "bad file" to users instead of a server bug. **Accepted**
— the alternative (echoing `err.message`) is worse from a security
posture. The accepted tradeoff: better security, slightly noisier
server logs to catch real bugs.

### Risk 2 — Test brittleness around library error strings

**Risk**: The regression test for FR-011 asserts the response body
contains no library name. If `pdf-parse` or `mammoth` changes its
internal error format, the test's "no leak" assertion still passes
trivially (since the new handler returns a generic message
regardless). But a future contributor might "fix" the test by adding
the library name back — defeating the guard.

**Mitigation**:
- Test name + comment explicitly state the security intent.
- The assertion is a positive equality check on the fixed message
  string, not just a "doesn't contain X" check — so any future change
  to the response body fails the test loudly.

### Risk 3 — File-system spy false negatives

**Risk**: The fs-spy regression test (FR-010) installs spies on
`fs.writeFile`, `fs.writeFileSync`, `fs.createWriteStream`, `fs.open`,
`fs.promises.writeFile`. If multer (or a future parser) wrote via a
different API path — e.g., `process.stdout.write` to a pipe that
backs a file, or a syscall through `child_process` — the spy would
miss it.

**Mitigation**:
- Multer + the current parsers are well-understood and do not use
  those alternative paths.
- Documented in the test comment so a future change of upload
  middleware would prompt re-evaluation.

**Residual risk**: small. **Accepted**.

### Risk 4 — Existing global 500 handler still echoes `err.message`

**Risk**: A future feature might add a different code path that
throws unexpected errors → 500 INTERNAL_ERROR with `err.message`
leaked. This feature does not fix that.

**Mitigation**: explicitly flagged in `research.md` as future work.
Out of scope per spec Non-Goal §2.

### Tradeoff: PARSE_FAILED is a 400, not a 422

The HTTP semantics for "the request was well-formed but the content
was unprocessable" is arguably 422 Unprocessable Entity. The project's
existing error envelope uses 400 for every client-recoverable error
(`FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `VALIDATION_ERROR`).
Staying with 400 keeps the client error-handling path uniform and
matches the existing convention; the error code (`PARSE_FAILED`) is
the discriminator.

---

## Validation Approach

### Automated (CI gate)

- **`npm run test:run`** — all existing tests remain green; 4 new
  test groups added (one per regression guard FR-009/FR-010/FR-011/FR-012)
  plus the corrupted-file → PARSE_FAILED test that pairs with the
  implementation change.
- **`npm run lint`** — clean; no new warnings.
- **Existing 020 fetch-spy** in [tests/services/resumeApi.demo.test.js](../../tests/services/resumeApi.demo.test.js)
  remains green, proving the frontend demo gate still suppresses the
  network call.

### Manual (pre-merge)

Walk the four scenarios in [quickstart.md](quickstart.md) against a
hosted preview deploy:

1. Sign in → upload a valid resume → expect 200 + parsed fields.
2. Without signing in → curl `POST /api/resume/parse` → expect 401
   with no parser library text.
3. Sign in → upload a `.pdf` whose bytes are random text → expect
   400 `PARSE_FAILED` with the fixed generic message; check the
   server log for the `[resume.parse]` line.
4. Sign in → upload a 10 MB PDF → expect 400 `FILE_TOO_LARGE`
   (existing behavior, regression check).

### Decision record

Decisions made during planning are captured in
[research.md](research.md): hosted-only scope, demo via existing
401, error sanitization narrow to resume route, global-500 deferred,
PARSE_FAILED status code choice.

---

## Constitution Compliance

- **Validation lives in two places**: the resume endpoint already has
  server-side validation; this feature does not introduce a parallel
  client-side validator (the client just surfaces server errors via
  the existing toast/inline-error UI).
- **No new dependencies**: nothing added to `package.json`.
- **No analytics or external services**: the new server log goes to
  the existing log stream only.
- **Local-first**: local mode unchanged; hosted-only feature.
- **Testing**: every FR has at least one paired automated test.
- **Release Prep**: included as Phase 06 per Amendment 1.3.0.
- **Browser Smoke Test**: not applicable — no UI changes (the
  amendment specifies "UI features only").
