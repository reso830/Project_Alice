# Tasks: Hosted Resume Import Security (021)

**Spec**: `specs/021-hosted-resume-import-security/spec.md`
**Plan**: `specs/021-hosted-resume-import-security/plan.md`
**Branch**: `021-hosted-resume-import-security`

---

## Phase Map

| Phase | Theme                                                                     | Blocks | Status |
|-------|---------------------------------------------------------------------------|--------|--------|
| 01    | Implement `PARSE_FAILED` mapping in `server/routes/resume.js` + paired test | 05, 06 | [X] |
| 02    | Regression test: hosted unauthenticated POST → 401, no library text in body | 06 (parallel) | [X] |
| 03    | Regression test: zero filesystem writes during any parse path (fs-spy) | 06 (parallel) | [X] |
| 04    | Regression test: `SUPABASE_SERVICE_ROLE_KEY` never referenced in resume code path | 06 (parallel) | [X] |
| 05    | Verify `contracts/api.md` + `research.md` against the implementation built in Phases 01–04 | 06 | [X] |
| 06    | Release Prep — version bump 0.10.0 → 0.11.0, CHANGELOG, README, REPO_MAP, docs sanity check | Merge | [X] |

Phases 02, 03, and 04 are independent of Phase 01 and of each other —
they exercise existing or new server paths via the integration test
helper and may be implemented in parallel.

Per [research.md §10](research.md) and constitution Amendment 1.3.0,
this feature has **no UI changes** so the Browser Smoke Test phase is
not required. The manual verification recipe in
[quickstart.md](quickstart.md) walks the user-observable delta on a
hosted preview as a pre-merge sanity check.

---

## Phase 01 — Implement `PARSE_FAILED` mapping  [X]

This phase implements spec **FR-006** and **FR-007**. One small code
change in the resume route plus one paired test that proves the new
behavior.

### Task 01.1 — Add `PARSE_FAILED` error constant + sanitized catch + server-side log  [X]

**Target file**: `server/routes/resume.js`

**What to do**:
1. Add a new entry to the `ERROR_RESPONSES` constant at the top of
   the file:
   ```js
   PARSE_FAILED: {
     code: 'PARSE_FAILED',
     message: 'Could not read this resume. Try a different file.',
   },
   ```
2. Add a `node:crypto` import at the top of the file:
   ```js
   import { createHash } from 'node:crypto';
   ```
3. Add a small helper above `createResumeRouter` (or near the
   existing `isUnsupportedFileType` helper):
   ```js
   function hashFilename(originalname = '') {
     return createHash('sha256').update(originalname).digest('hex').slice(0, 8);
   }
   ```
4. Inside the `catch (error)` block of the
   `router.post('/parse', …)` handler (currently
   [server/routes/resume.js:60-66](../../server/routes/resume.js#L60-L66)),
   replace the existing `return next(error);` with:
   ```js
   console.error('[resume.parse]', {
     error: error?.message ?? 'unknown',
     stack: error?.stack,
     nameSha8: hashFilename(req.file?.originalname),
     mimetype: req.file?.mimetype,
     path: req.originalUrl?.split('?')[0] ?? req.path,
   });
   return sendError(res, 400, ERROR_RESPONSES.PARSE_FAILED);
   ```
5. Leave the `if (isUnsupportedFileType(error)) { … }` branch above
   it untouched — `UNSUPPORTED_FILE_TYPE` continues to short-circuit
   before the new sanitized catch.
6. Update the multer upload-error branch (currently
   [server/routes/resume.js:45-51](../../server/routes/resume.js#L45-L51))
   so every `multer.MulterError` code is mapped explicitly. Today
   only `LIMIT_FILE_SIZE` is mapped; all other multer error codes
   (`LIMIT_UNEXPECTED_FILE`, `LIMIT_FIELD_KEY`, `LIMIT_FIELD_VALUE`,
   `LIMIT_FIELD_COUNT`, `LIMIT_FILE_COUNT`, `LIMIT_PART_COUNT`) fall
   through `next(uploadError)` to the global 500 handler and echo
   `err.message` — defeating FR-007 in a narrow but real way (e.g.
   a misnamed `resume` field leaks `"Unexpected field"` plus the
   field name). Replace with:
   ```js
   if (uploadError instanceof multer.MulterError) {
     if (uploadError.code === 'LIMIT_FILE_SIZE') {
       return sendError(res, 400, ERROR_RESPONSES.FILE_TOO_LARGE);
     }
     console.error('[resume.parse]', {
       error: uploadError.message,
       code: uploadError.code,
     });
     return sendError(res, 400, ERROR_RESPONSES.VALIDATION_ERROR);
   }
   if (uploadError) {
     return next(uploadError);
   }
   ```
   Non-multer errors (truly unexpected) continue to fall through to
   `next()` — only multer's own client-shape error codes are mapped.

**Expected behavior**:
- A corrupted PDF (e.g., bytes that don't start with `%PDF-`) returns
  `400 { error: { code: 'PARSE_FAILED', message: 'Could not read this resume. Try a different file.' } }`.
- A corrupted DOCX (e.g., a non-ZIP file with `.docx` extension)
  returns the same response shape.
- The response body MUST NOT contain `pdf-parse`, `pdfjs`,
  `DOMMatrix`, `mammoth`, any stack-trace text, or any internal
  filesystem path.
- Server logs MUST contain exactly one `[resume.parse]` line per
  failed parse, with `error`, `stack`, `nameSha8`, `mimetype`, and
  `path` fields. The raw `originalname` MUST NOT appear in the log
  object.
- The happy path is unchanged.
- `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, and `VALIDATION_ERROR`
  responses are unchanged.

**Constraints**:
- Do not modify `server/index.js`'s global 500 handler — out of
  scope per spec Non-Goal §2.
- Do not change the parsed-data response shape on success — out of
  scope per spec Non-Goal §10.
- Do not introduce new dependencies — `node:crypto` is a built-in.
- The 5 MB limit stays hard-coded — out of scope per spec Non-Goal §7.

**Validation**: covered by Task 01.2.

**Out of scope**: server/index.js, server/resume/extractor.js,
server/resume/parser.js, any frontend file.

---

### Task 01.2 — Test `PARSE_FAILED` mapping (corrupted PDF + corrupted DOCX + log shape)  [X]

**Target file**: `tests/server/resume.test.js`

**What to do**:

Add three new test cases inside the existing `describe('resume API', …)`
block. Reuse the existing `withServer` + `uploadResume` helpers
(local-mode server — `requireAuth` not mounted; the `PARSE_FAILED`
sanitization applies uniformly to both modes since it lives in the
route handler, so local-mode tests verify the same behavior).

1. **Corrupted PDF → 400 PARSE_FAILED**:
   ```js
   it('returns 400 PARSE_FAILED for a corrupted PDF without leaking library internals', async () => {
     await withServer(async (baseUrl) => {
       const response = await uploadResume(baseUrl, {
         content: 'NOT A REAL PDF',
         type: 'application/pdf',
         filename: 'bad.pdf',
       });
       expect(response.status).toBe(400);
       expect(response.body.error.code).toBe('PARSE_FAILED');
       expect(response.body.error.message).toBe('Could not read this resume. Try a different file.');
       const bodyText = JSON.stringify(response.body);
       expect(bodyText).not.toMatch(/pdf-parse/i);
       expect(bodyText).not.toMatch(/pdfjs/i);
       expect(bodyText).not.toMatch(/DOMMatrix/);
       expect(bodyText).not.toMatch(/node_modules/);
     });
   });
   ```

2. **Corrupted DOCX → 400 PARSE_FAILED**:
   ```js
   it('returns 400 PARSE_FAILED for a corrupted DOCX without leaking library internals', async () => {
     await withServer(async (baseUrl) => {
       const response = await uploadResume(baseUrl, {
         content: 'NOT A REAL DOCX ZIP',
         type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         filename: 'bad.docx',
       });
       expect(response.status).toBe(400);
       expect(response.body.error.code).toBe('PARSE_FAILED');
       expect(response.body.error.message).toBe('Could not read this resume. Try a different file.');
       const bodyText = JSON.stringify(response.body);
       expect(bodyText).not.toMatch(/mammoth/i);
       expect(bodyText).not.toMatch(/node_modules/);
     });
   });
   ```

3. **Log shape on parse failure** (spy on `console.error`):
   ```js
   it('logs a sanitized [resume.parse] line on parse failure (no raw filename)', async () => {
     const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
     try {
       await withServer(async (baseUrl) => {
         await uploadResume(baseUrl, {
           content: 'NOT A REAL PDF',
           type: 'application/pdf',
           filename: 'alex_rivera_resume_2026.pdf',
         });
       });
       const resumeLogCalls = errorSpy.mock.calls.filter(
         (args) => args[0] === '[resume.parse]',
       );
       expect(resumeLogCalls).toHaveLength(1);
       const logged = resumeLogCalls[0][1];
       expect(logged).toMatchObject({
         error: expect.any(String),
         nameSha8: expect.stringMatching(/^[a-f0-9]{8}$/),
         mimetype: 'application/pdf',
         path: '/api/resume/parse',
       });
       expect(logged.nameSha8).not.toContain('alex');
       expect(JSON.stringify(logged)).not.toContain('alex_rivera_resume_2026.pdf');
     } finally {
       errorSpy.mockRestore();
     }
   });
   ```

Add the required `vi` import to the test file's existing
`import { describe, expect, it } from 'vitest';` line.

**Expected behavior**:
- All three new tests pass after Task 01.1 is implemented.
- The existing happy-path TXT test and the existing
  `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` / `VALIDATION_ERROR`
  tests continue to pass unchanged.

**Constraints**:
- Use `withServer` (local-mode) — do not introduce a hosted-mode
  test fixture here; that's Phase 02's scope.
- Do not modify the existing `uploadResume` helper signature; add
  fields to the options bag if needed but keep defaults backward-
  compatible.
- Do not mock `pdf-parse` or `mammoth` — the test exercises real
  parser failure paths.

**Validation**:
- `npm run test:run` — three new tests pass; existing tests remain
  green.

**Out of scope**: hosted-mode tests (Phase 02), fs-spy assertions
(Phase 03), service-role-key absence (Phase 04), the FR-007 sweep
guard (Task 01.3).

---

### Task 01.3 — Add FR-007 sweep guard ("no failure mode reaches `INTERNAL_ERROR`")  [X]

**Target file**: `tests/server/resume.test.js`

**What to do**:

Add one test that iterates every known failure mode for the resume
route and asserts that none of them returns `500 INTERNAL_ERROR`.
This is a single-point regression guard for spec **FR-007** — the
architectural property that the resume route's new sanitized catch
prevents any error from reaching the global 500 handler.

```js
it('no failure mode reaches the global INTERNAL_ERROR handler (FR-007)', async () => {
  const failures = [
    {
      label: 'corrupted PDF',
      upload: { content: 'NOT A PDF', type: 'application/pdf', filename: 'bad.pdf' },
    },
    {
      label: 'corrupted DOCX',
      upload: {
        content: 'NOT A DOCX',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename: 'bad.docx',
      },
    },
    {
      label: 'unsupported extension',
      upload: { content: 'x', type: 'application/octet-stream', filename: 'r.exe' },
    },
  ];

  for (const { label, upload } of failures) {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, upload);
      expect(
        response.status,
        `${label}: response should not be 500`,
      ).not.toBe(500);
      expect(
        response.body.error.code,
        `${label}: error code should not be INTERNAL_ERROR`,
      ).not.toBe('INTERNAL_ERROR');
    });
  }
});

// Separately, exercise the multer upload-error branch with a misnamed
// field. uploadResume() always uses field name 'resume'; build the
// FormData manually here.
it('multer LIMIT_UNEXPECTED_FILE does not reach the global 500 handler', async () => {
  await withServer(async (baseUrl) => {
    const fd = new globalThis.FormData();
    fd.append(
      'wrong_field_name',
      new globalThis.Blob(['x'], { type: 'text/plain' }),
      'r.txt',
    );
    const response = await globalThis.fetch(`${baseUrl}/api/resume/parse`, {
      method: 'POST',
      body: fd,
    });
    expect(response.status).not.toBe(500);
    const body = await response.json();
    expect(body.error.code).not.toBe('INTERNAL_ERROR');
    expect(body.error.code).toBe('VALIDATION_ERROR');
    // Sanitized — no field name, no "Unexpected field" library text
    expect(JSON.stringify(body)).not.toMatch(/wrong_field_name/);
    expect(JSON.stringify(body)).not.toMatch(/unexpected field/i);
  });
});
```

**Expected behavior**:
- Test passes after Task 01.1 is implemented (every failure mode
  funnels through the route's explicit error mapping).
- If a future change reintroduces a `next(error)` fall-through path
  that hits the global 500 handler, this test fails immediately with
  a label identifying which failure mode regressed.

**Constraints**:
- Use `withServer` (local-mode) — the FR-007 invariant applies
  uniformly to local and hosted; hosted just adds an extra 401 layer
  on top, tested separately in Phase 02.
- This test is intentionally redundant with the per-failure-mode
  tests in Task 01.2 (which assert specific codes). Its purpose is
  to provide a single readable guard for the architectural property,
  not to replace the per-mode coverage.
- The `VALIDATION_ERROR` (missing file) case is not in the sweep
  array — that path short-circuits before the new catch and is
  already covered by the existing test. However, the misnamed-field
  case (`LIMIT_UNEXPECTED_FILE`) IS exercised separately because it
  reaches the new multer-error mapping added in Task 01.1 step 6
  and would otherwise regress silently.

**Validation**:
- `npm run test:run` — one new test passes.

**Out of scope**: hosted-mode tests (Phase 02), fs-spy assertions
(Phase 03).

---

## Phase 02 — Regression test: hosted unauthenticated POST → 401  [X]

This phase implements spec **FR-001** and **FR-009**. No code
change; one test that pins the existing 401 behavior so a future
refactor can't silently demote the endpoint to anonymous access.

### Task 02.1 — Add hosted-mode integration test that asserts 401 without library leaks  [X]

**Target file**: `tests/server/resume.test.js`

**What to do**:

1. Inspect [tests/server/routes-protected.test.js](../../tests/server/routes-protected.test.js)
   to see the existing pattern for testing protected routes with a
   stub `requireAuth`. The expected pattern is something like:
   ```js
   const requireAuth = (_req, res, _next) => res.status(401).json({
     error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
   });
   const app = createApp({ repositories, requireAuth });
   ```

2. Add a new helper `withHostedServer(test)` inside
   `tests/server/resume.test.js`, mirroring the existing
   `withServer` helper but passing a `requireAuth` stub that always
   rejects:
   ```js
   async function withHostedServer(test) {
     const db = makeMemoryDb();
     const repositories = await createSqliteRepositories(db);
     const requireAuth = (_req, res, _next) => res.status(401).json({
       error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
     });
     const app = createApp({
       repositories: wrapAsDispatcher(repositories),
       requireAuth,
     });
     const server = app.listen(0);
     const { port } = server.address();
     const baseUrl = `http://127.0.0.1:${port}`;
     try {
       await test(baseUrl, db);
     } finally {
       server.close();
       db.close();
     }
   }
   ```

3. Add a new `describe('resume API — hosted auth gate', …)` block
   with two cases:
   ```js
   it('returns 401 for hosted POST without Authorization header', async () => {
     await withHostedServer(async (baseUrl) => {
       const response = await uploadResume(baseUrl, {
         content: 'anything',
         type: 'text/plain',
         filename: 'r.txt',
       });
       expect(response.status).toBe(401);
       expect(response.body.error.code).toBe('UNAUTHORIZED');
     });
   });

   it('401 response body contains no parser library names or internal paths', async () => {
     await withHostedServer(async (baseUrl) => {
       const response = await uploadResume(baseUrl, {
         content: 'anything',
         type: 'application/pdf',
         filename: 'r.pdf',
       });
       const bodyText = JSON.stringify(response.body);
       expect(bodyText).not.toMatch(/pdf-parse/i);
       expect(bodyText).not.toMatch(/mammoth/i);
       expect(bodyText).not.toMatch(/multer/i);
       expect(bodyText).not.toMatch(/node_modules/);
     });
   });
   ```

**Expected behavior**:
- A POST to `/api/resume/parse` against a server constructed with a
  rejecting `requireAuth` returns `401` before the handler runs.
- The 401 response body is the auth-middleware's standard error
  shape; it contains no parser library names.

**Constraints**:
- Do NOT spin up a real Supabase project. The stub `requireAuth`
  exists precisely to test the resume route's wiring to the
  middleware, not the JWKS verification path (which is covered in
  `tests/server/auth-middleware.test.js`).
- Do not modify `server/routes/resume.js` or `server/index.js` —
  this is a pure regression test.

**Validation**:
- `npm run test:run` — two new tests pass.

**Out of scope**: real JWT verification (covered elsewhere),
filesystem-spy assertions (Phase 03).

---

## Phase 03 — Regression test: zero filesystem writes during parse  [X]

This phase implements spec **FR-002** and **FR-010**. No code
change; one test group that pins the multer `memoryStorage()`
invariant by spying on every plausible filesystem write API.

### Task 03.1 — Add `fs.write*` spy regression test covering happy + sad paths  [X]

**Target file**: `tests/server/resume.test.js`

**What to do**:

1. Add a small spy installer at the top of `tests/server/resume.test.js`
   (or in a `beforeEach`/`afterEach` pair inside a new `describe`).
   **Use pass-through spies from the start** — every spy records calls
   but delegates to the original implementation. A no-op
   `mockImplementation(() => {})` would break unrelated in-process
   file reads (vitest module loader, pdf-parse debug fixture,
   snapshot reads via `fs.open` / `fs.openSync`); pass-through
   preserves the full security coverage of the spy set while keeping
   the test process functional.
   ```js
   import * as fs from 'node:fs';
   import * as fsPromises from 'node:fs/promises';

   function passThrough(target, method) {
     const original = target[method].bind(target);
     return vi.spyOn(target, method).mockImplementation((...args) => original(...args));
   }

   function installFsSpies() {
     return {
       writeFile: passThrough(fs, 'writeFile'),
       writeFileSync: passThrough(fs, 'writeFileSync'),
       appendFile: passThrough(fs, 'appendFile'),
       appendFileSync: passThrough(fs, 'appendFileSync'),
       createWriteStream: passThrough(fs, 'createWriteStream'),
       open: passThrough(fs, 'open'),
       openSync: passThrough(fs, 'openSync'),
       writeSync: passThrough(fs, 'writeSync'),
       promisesWriteFile: passThrough(fsPromises, 'writeFile'),
       promisesAppendFile: passThrough(fsPromises, 'appendFile'),
     };
   }

   The spy list covers the realistic write paths a future regression
   could take: standard `writeFile` (both callback + sync + promise
   variants), `appendFile` (both variants) to catch a hypothetical
   "log uploads to file" misfeature, `createWriteStream` for streamed
   writes, the lower-level `open`/`openSync` + `writeSync` pair that
   bypasses `writeFile`-style helpers, and `fs.promises.appendFile` for
   the modern Promise-based append. `child_process.spawn`-based writes
   (e.g. shelling out to a binary) remain a documented residual risk
   in [research.md §7](research.md).

   function isWriteMode(flags) {
     if (typeof flags === 'string') return /[wax+]/.test(flags);
     if (typeof flags === 'number') {
       const writeMask = fs.constants.O_WRONLY
                       | fs.constants.O_RDWR
                       | fs.constants.O_CREAT
                       | fs.constants.O_TRUNC
                       | fs.constants.O_APPEND;
       return (flags & writeMask) !== 0;
     }
     return false; // unknown shape — be permissive (don't count)
   }

   function assertNoFsWrites(spies) {
     for (const [name, spy] of Object.entries(spies)) {
       if (name === 'open' || name === 'openSync') {
         // open() / openSync() are also used for legitimate in-process
         // READS by the module loader, snapshot reads, etc. Only count
         // calls whose flags argument indicates write/create/truncate
         // intent — those are the actual write-path signature.
         const writeOpens = spy.mock.calls.filter((args) => isWriteMode(args[1]));
         expect(
           writeOpens,
           `unexpected write-mode fs.${name} call(s): ${JSON.stringify(writeOpens)}`,
         ).toHaveLength(0);
         continue;
       }
       expect(spy, `unexpected fs.${name} call during parse`).not.toHaveBeenCalled();
     }
   }
   ```

   **Why pass-through, not no-op**: `fs.open` / `fs.openSync` are
   used by vitest's module loader, by pdf-parse's debug fixture, and
   by snapshot reads — all in-process during the test. A no-op
   mock would silently break those. Pass-through records every call
   into the spy registry (which is what the assertion reads) while
   the real syscall still runs.

   **Why flag-filtered assertions for open/openSync**: even with
   pass-through, asserting *zero* calls to `open` / `openSync` would
   false-trigger on legitimate in-process reads (module loader,
   snapshot fixtures, library debug paths) that happen during the
   test window. The `isWriteMode()` filter limits the assertion to
   calls whose flags argument indicates write/create/truncate/append
   intent — that is the actual write-path signature, and it is what
   the security invariant cares about. Read-mode opens are not a
   "write to disk" by any reasonable reading of FR-002 / FR-010.

2. Add a new `describe('resume API — in-memory invariant', …)`
   block with one test that exercises each successful and failed
   path:
   ```js
   describe('resume API — in-memory invariant (FR-010)', () => {
     let spies;
     beforeEach(() => { spies = installFsSpies(); });
     afterEach(() => { vi.restoreAllMocks(); });

     it('does not write to disk during a successful TXT parse', async () => {
       await withServer(async (baseUrl) => {
         await uploadResume(baseUrl, { content: 'Jane Smith', type: 'text/plain' });
       });
       assertNoFsWrites(spies);
     });

     it('does not write to disk during a corrupted-PDF parse', async () => {
       await withServer(async (baseUrl) => {
         await uploadResume(baseUrl, { content: 'NOT A PDF', type: 'application/pdf', filename: 'bad.pdf' });
       });
       assertNoFsWrites(spies);
     });

     it('does not write to disk during an UNSUPPORTED_FILE_TYPE rejection', async () => {
       await withServer(async (baseUrl) => {
         await uploadResume(baseUrl, { content: 'x', type: 'application/octet-stream', filename: 'r.exe' });
       });
       assertNoFsWrites(spies);
     });

     it('does not write to disk during a VALIDATION_ERROR (missing file)', async () => {
       await withServer(async (baseUrl) => {
         const response = await globalThis.fetch(`${baseUrl}/api/resume/parse`, {
           method: 'POST',
           body: new globalThis.FormData(),
         });
         await response.json();
       });
       assertNoFsWrites(spies);
     });

     it('does not write to disk during a FILE_TOO_LARGE rejection', async () => {
       // Build a >5 MB payload in memory; multer rejects with
       // LIMIT_FILE_SIZE inside the request handler scope, so spies
       // installed in beforeEach will see any incidental write.
       const oversized = 'A'.repeat(5_242_880 + 1024);  // ~5 MB + 1 KB
       await withServer(async (baseUrl) => {
         await uploadResume(baseUrl, {
           content: oversized,
           type: 'text/plain',
           filename: 'big.txt',
         });
       });
       assertNoFsWrites(spies);
     });
   });
   ```

**Expected behavior**:
- All five cases pass — zero write-path filesystem calls observed
  across every path.
- If a future refactor introduces `multer.diskStorage()` or a
  parser-library version that writes a tmp file, the relevant
  test fails immediately.

**Constraints**:
- Cover both the happy path AND the four failure paths (parse
  failure, unsupported type, missing file, oversized upload) — a
  refactor that writes only on the error path must still fail this
  test.
- All spies MUST be pass-through (`mockImplementation((...args) =>
  original(...args))`). No-op mocks would break unrelated reads via
  `fs.open` / `fs.openSync` (vitest module loader, snapshot reads,
  pdf-parse's debug fixture) and are forbidden. The point is to
  *observe* every call, not to prevent any.
- Do not modify `server/routes/resume.js` or any source file in
  this phase.

**Validation**:
- `npm run test:run` — five new tests pass; no unrelated tests
  break from the fs spies.

**Out of scope**: the `os.tmpdir()` / `child_process` writes are
known limitations documented in [research.md §7](research.md#7-fs-spy-regression-test-design).

---

## Phase 04 — Regression test: service-role-key absence  [X]

This phase implements spec **FR-012**. One vitest test reads the
resume code path files and asserts they contain no admin-credential
references.

### Task 04.1 — Add grep-style regression guard for `SUPABASE_SERVICE_ROLE_KEY`  [X]

**Target file**: `tests/server/resume.test.js`

**What to do**:

1. Add the test at the top of the file (before the existing
   `withServer` definition) so it runs independently of any
   integration setup:
   ```js
   import { readFileSync } from 'node:fs';
   import { fileURLToPath } from 'node:url';
   import { dirname, join } from 'node:path';

   const TEST_DIR = dirname(fileURLToPath(import.meta.url));
   const REPO_ROOT = join(TEST_DIR, '..', '..');

   const RESUME_CODE_PATH_FILES = [
     'server/routes/resume.js',
     'server/resume/extractor.js',
     'server/resume/parser.js',
     'src/services/resumeApi.js',
     'src/components/ResumeImport.js',
   ];

   const FORBIDDEN_STRINGS = [
     'SUPABASE_SERVICE_ROLE_KEY',
     'service_role',
   ];

   describe('resume API — service-role credential isolation (FR-012)', () => {
     it.each(RESUME_CODE_PATH_FILES)(
       '%s contains no reference to service-role credentials',
       (relativePath) => {
         const contents = readFileSync(join(REPO_ROOT, relativePath), 'utf8');
         for (const forbidden of FORBIDDEN_STRINGS) {
           expect(contents, `forbidden string "${forbidden}" found in ${relativePath}`).not.toContain(forbidden);
         }
       },
     );
   });
   ```

**Expected behavior**:
- Five test cases (one per file) all pass.
- If a future change adds `SUPABASE_SERVICE_ROLE_KEY` to any file
  in the resume code path, the corresponding test fails with the
  filename in the message.

**Constraints**:
- Do not skip a file with `it.skip` — if a file legitimately needs
  to reference the service role, either remove it from
  `RESUME_CODE_PATH_FILES` (with a justifying comment) or fail
  loudly.
- Use absolute paths derived from `import.meta.url` so the test
  runs identically on Windows, macOS, and Linux.
- Do not extend this check to other files in the repo — out of
  scope. Other features have their own threat models.

**Validation**:
- `npm run test:run` — five new tests pass.

**Out of scope**: extending the grep to the entire repo (broader
audit, separate feature).

---

## Phase 05 — Verify `contracts/api.md` + `research.md` against the implementation  [X]

This phase ensures the supporting artifacts written during planning
still match the implementation after Phases 01–04. No new artifacts;
just a sanity check pass.

### Task 05.1 — Reconcile `contracts/api.md` with the implemented code  [X]

**Target file**: `specs/021-hosted-resume-import-security/contracts/api.md`

**What to do**:

1. Open
   [specs/021-hosted-resume-import-security/contracts/api.md](contracts/api.md)
   and walk every reference to a line number in `server/routes/resume.js`.
   Confirm the post-Task-01.1 line numbers still match the snippets
   shown. If not, update the line ranges.
2. Verify §3 Layer 4's claim that "the new resume-route–scoped
   catch … is logged server-side via
   `console.error('[resume.parse]', { error, stack, nameSha8 })`"
   matches the actual log shape implemented in Task 01.1.
3. Verify §3 Layer 3's claim that
   `multer({ storage: multer.memoryStorage(), limits: { fileSize: 5_242_880 } })`
   matches the current code.
4. Verify §7 "Pinning Summary" lists every test added by Phases
   01–04 against the correct test file path.
5. If any non-trivial divergence is found between the doc and the
   implementation, prefer fixing the doc — the implementation is
   the source of truth post-implementation.

**Expected behavior**:
- The `contracts/api.md` matches the actual implementation
  line-for-line for every code reference, behavior assertion, and
  test reference.

**Constraints**:
- Do not modify any source file during this task — this is purely
  a documentation reconciliation.
- Do not add new sections to `contracts/api.md` unless they're
  needed to describe a behavior that emerged during implementation
  but wasn't anticipated in planning.

**Validation**:
- Visual review.
- Confirm `grep -n "server/routes/resume.js#L" specs/021-hosted-resume-import-security/contracts/api.md`
  returns line ranges that still correspond to the actual code.

---

### Task 05.2 — Add post-implementation notes to `research.md` (if any)  [X]

**Target file**: `specs/021-hosted-resume-import-security/research.md`

**What to do**:

If any unanticipated decision was made during Phases 01–04 (e.g.,
choosing a specific node:crypto API for the hash, dealing with a
multer-internal write that broke the fs spy and required a fallback
pattern), append a new section to `research.md` documenting it.

If no such decisions arose, this task is a no-op — note that fact
in the PR description.

**Expected behavior**:
- `research.md` accurately reflects every decision actually made,
  not just the ones anticipated during planning.

**Constraints**:
- Do not retro-justify implementation choices that were already
  documented in the original `research.md`. Only add genuinely new
  decisions.
- Keep new sections short — one or two paragraphs max each.

**Validation**: visual review.

---

## Phase 06 — Release Prep  [X]

Required by constitution Amendment 1.3.0 — second-to-last phase
(and last phase in this case, since 021 is not a UI feature).

### Task 06.1 — Version bump  [X]

**Target files**:
- `package.json` — bump `"version"` from `0.10.0` to `0.11.0`
  (MINOR per SemVer: the new `PARSE_FAILED` error code is additive;
  no existing client behavior breaks).
- `src/pages/welcome/shared/appMeta.js` — bump `APP_VERSION` from
  `'v0.10.0'` to `'v0.11.0'`.
- `package-lock.json` — regenerate via `npm install --package-lock-only`
  or let it update naturally on the next `npm install`.

**Constraints**:
- Do not bump to 0.11.0 if a different version has already landed
  on `main` ahead of this branch — rebase and re-decide.
- The three pre-existing tests that hard-code the version string
  (`tests/components/Footer.test.js` and two in
  `tests/components/welcome.test.js`, last updated in PR #29) will
  need to be updated from `v0.10.0` to `v0.11.0` as part of this
  task. Find via
  `grep -rn "v0\.10\.0" tests/`.

**Expected behavior**:
- `npm run test:run` passes after the version-string updates.
- The welcome footer renders `v0.11.0`.

**Validation**:
- `npm run test:run` clean.
- `npm run lint` clean.

---

### Task 06.2 — `CHANGELOG.md` entry  [X]

**Target file**: `CHANGELOG.md`

**What to do**: add a new `[0.11.0]` entry above the existing
`[0.10.0]` block, following the format of recent entries (017,
018, 019, 020). Suggested content:

- **Added**: `PARSE_FAILED` error code for `POST /api/resume/parse`
  — returned when the file parser throws (corrupted PDF, malformed
  DOCX, empty file). The response is `400 { error: { code:
  'PARSE_FAILED', message: 'Could not read this resume. Try a
  different file.' } }`. The raw library error is logged
  server-side via `[resume.parse]` with a SHA-256–prefixed filename
  for correlation; the raw filename and the resume content are
  never logged.
- **Changed**: pre-021, corrupted-file uploads fell through to the
  global 500 handler, which echoed `err.message` (including library
  internals like `pdf-parse` stack text) to the client. The new
  resume-route–scoped catch sanitizes the response. The global 500
  handler is unchanged for other routes.
- **Internal**: new regression guards in `tests/server/resume.test.js`
  — hosted unauthenticated → 401 (FR-009), zero filesystem writes
  during any parse path via `fs.write*` spies (FR-010),
  `SUPABASE_SERVICE_ROLE_KEY` never referenced in the resume code
  path (FR-012). New `specs/021-hosted-resume-import-security/contracts/api.md`
  documents the four-layer defense model and the explicit
  guarantees/non-guarantees.

Also update the footer link references — add the `[0.11.0]` link and
re-anchor `[Unreleased]` to `v0.11.0...HEAD`.

**Constraints**: mirror the 020 entry's structure (Added / Changed /
Internal blocks). Keep wording precise about the security delta —
explicitly call out that this closes the `err.message` leak in the
resume route only.

**Validation**: visual review.

---

### Task 06.3 — `README.md` updates  [X]

**Target file**: `README.md`

**What to do**:

1. Bump the "Current version" line near the end of the file from
   `Current version: **0.10.0**` to `Current version: **0.11.0**`.
2. Optionally add a one-line link to the new security model doc in
   the "Further Reading" section:
   ```
   - [specs/021-hosted-resume-import-security/contracts/api.md](specs/021-hosted-resume-import-security/contracts/api.md) — resume import security model (021)
   ```

**Constraints**: do not introduce a Features-section bullet for
this work — the user-visible delta is just an error message, not
a new feature surface.

**Validation**: visual review.

---

### Task 06.4 — `docs/REPO_MAP.md` updates  [X]

**Target file**: `docs/REPO_MAP.md`

**What to do**:

The existing rows for `server/routes/resume.js`,
`server/resume/extractor.js`, `server/resume/parser.js`,
`src/services/resumeApi.js`, and `src/components/ResumeImport.js`
do not require updates — the file purposes are unchanged.

If a "Spec Packages" section row for 020 was added in PR #29, mirror
it for 021 with rows pointing at:
- `specs/021-hosted-resume-import-security/spec.md`
- `specs/021-hosted-resume-import-security/plan.md`
- `specs/021-hosted-resume-import-security/contracts/api.md`

If no Spec Packages section exists or 020 wasn't added to it, treat
021 the same way and leave the section unchanged.

**Constraints**: do not alphabetize or restructure the existing
REPO_MAP sections — only add the minimal new rows.

**Validation**: visual review.

---

### Task 06.5 — Docs sanity check + `docs/deployment.md` verification + final quality gates  [X]

**What to do**:

1. **Verify `docs/deployment.md` is unchanged**: no env vars, runtime
   modes, or operator steps changed in this feature. The 5 MB limit,
   the auth requirement, and the Supabase env vars are all unchanged.
   If verified true, no edit is required. Note this fact in the PR
   description for the constitution compliance check.
2. **Read all spec artifacts end to end** — `spec.md`, `plan.md`,
   `data-model.md`, `research.md`, `contracts/api.md`,
   `quickstart.md`, and `checklists/plan-review.md`. Confirm no
   remaining "feature 021 will…" forward references; everything reads
   in present/past tense for the merged state.
3. Run the final quality gates:
   - `npm run test:run` — confirm green at the post-implementation
     test count (existing 856 from main + new tests from Phases
     01–04; expected to land around 870–880 depending on exact
     parameterization).
   - `npm run lint` — confirm clean.
4. Optionally walk the manual recipe in
   [quickstart.md](quickstart.md) §§1–7 against a hosted preview
   deploy. Append the eight pass/fail outcomes to the PR
   description.

**Constraints**: do not modify `docs/deployment.md`. Do not skip
either quality gate. If either fails, return to the corresponding
phase and fix the root cause.

**Validation**: green run on both gates; deployment.md visually
confirmed unchanged.

---

## Done criteria

A feature is ready to merge when:

- Phases 01 + 02 + 03 + 04 + 05 + 06 all complete with green
  `npm run test:run` AND green `npm run lint` (constitution §V).
- Phase 06 has bumped the version, written the CHANGELOG entry,
  and updated docs.
- Either the manual `quickstart.md` walk is recorded in the PR
  description, or the PR description explicitly states the
  automated test coverage is sufficient (which it is — every FR
  has a paired test).
- The plan-review checklist
  ([checklists/plan-review.md](checklists/plan-review.md)) has every
  P0 item ticked.

This feature has no UI changes, so per constitution Amendment 1.3.0
("UI features only"), the Browser Smoke Test phase is not required.
Decision documented in [research.md §10](research.md#10-browser-smoke-test-phase--needed-or-not).
