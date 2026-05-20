# Research: Hosted Resume Import Security (021)

Decision log for the planning phase. Each entry records what was
considered, what was chosen, and the rejected alternatives — so a
future contributor can re-evaluate without re-deriving the reasoning.

---

## §1. Scope — hosted-only vs. local-mode included

**Decision**: Hosted-only.

**Rejected**: Apply the hardening uniformly to local mode (open
endpoint with sanitized errors + filesystem-spy guard but no auth gate).

**Reasoning**:
- The brief's title says "hosted resume import security" — explicit.
- Local mode has no authentication concept; "restrict to authenticated
  users" is meaningless there.
- The single-user local dev workflow benefits from open endpoint
  behavior; introducing a flag-gated rejection would add complexity
  without security gain (the threat model assumes the local user owns
  the machine).
- The error-sanitization changes (FR-006) naturally apply to local
  too since they live in the same route handler — local mode will
  inherit the `PARSE_FAILED` mapping for free. Documented in
  `contracts/api.md`.

**Residual risk**: a local-mode developer running their dev server
exposed to a network could be probed; mitigation is "don't expose the
local dev server to a network," which is the existing assumption.

---

## §2. Demo enforcement — server-side flag vs. existing 401 path

**Decision**: Rely on the existing `requireAuth` → 401 path. Demo
visitors in hosted mode have no Supabase JWT, so any direct
`POST /api/resume/parse` is rejected at the middleware boundary before
the handler runs. Add a regression test that pins this (FR-009).

**Rejected option A**: Add a server-side check for a header like
`X-Demo: true` and reject if present.
- Defeated by a malicious client that simply doesn't send the header.
- Provides theatre, not security.

**Rejected option B**: Encode a `demo: true` claim into a session
token and reject at the route if seen.
- Demo is purely client-side per feature 020; there is no session
  token to encode a claim into.
- Would require introducing a new server-side demo session concept,
  contradicting 020's purely-client architecture.

**Reasoning**:
- The three frontend defenses from feature 020 (`VISIBLE_STATUSES`
  set, ProfileEdit inline note, `resumeApi.js DEMO_FEATURE_UNAVAILABLE`
  throw) prevent a well-behaved client from ever attempting the
  request.
- For an ill-behaved client, the server has no trustworthy way to
  verify a self-asserted demo claim. The genuine defense is the
  bearer-token requirement — demo visitors don't have one.
- Adding a pinning test (FR-009) converts "demo visitors can't reach
  this endpoint" from an implicit property to a tested invariant.

---

## §3. Error sanitization — resume-route–scoped vs. global

**Decision**: Narrow the change to the resume route. Replace the
catch's `next(error)` with an explicit mapping to `400 PARSE_FAILED`.
Leave the global 500 handler in `server/index.js:74-91` unchanged.

**Rejected**: Harden the global handler to never echo `err.message`.

**Reasoning**:
- The global handler affects every route. Changing it would touch
  the contract of every endpoint, risk silent test regressions
  elsewhere, and conflate two concerns (resume security + global
  error-response policy).
- This feature's threat model is the resume parse endpoint
  specifically; broader work is a different feature.
- The global handler still has the same behavior for any uncaught
  error that genuinely escapes a route — but with the new resume
  catch, the practical surface where parser internals could leak is
  closed.

**Flagged for future work**: a follow-up feature could replace
`err.message` with `'Unexpected server error'` in the global handler
and route errors through a `category` discriminator. Out of scope
for 021.

---

## §4. PARSE_FAILED status code — 400 vs. 422

**Decision**: 400 Bad Request.

**Rejected**: 422 Unprocessable Entity (semantically more accurate
for "well-formed request, unprocessable content").

**Reasoning**:
- The project's existing error envelope uses 400 for every
  client-recoverable error (`FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`,
  `VALIDATION_ERROR`). Staying with 400 keeps the client error
  handling uniform.
- The error code (`PARSE_FAILED`) is the actual discriminator clients
  branch on, not the HTTP status. Adding 422 would force the client
  to handle both 400 and 422 with the same code-based logic.
- Future work that introduces a layered error category (validation
  vs. content vs. internal) could revisit status code choices
  holistically.

---

## §5. PARSE_FAILED message wording

**Decision**: `"Could not read this resume. Try a different file."`

**Rejected variants**:
- `"Resume could not be parsed."` — passive, less actionable.
- `"Invalid file format."` — overlaps with the UNSUPPORTED_FILE_TYPE
  message and may confuse users into thinking they chose the wrong
  type when they actually chose the right type but the file is
  corrupted.
- `"File parse error. Please try again."` — implies "try the exact
  same file again," which won't help; the file is the problem.

**Reasoning**: short, identifies the action that failed, suggests the
specific remediation. Mirrors the existing `UNSUPPORTED_FILE_TYPE`
message's two-sentence "what failed / what to do" pattern.

---

## §6. Server-side log shape

**Decision**: `console.error('[resume.parse]', { error, stack, nameSha8, mimetype, path })`
where `nameSha8` is the first 8 chars of a SHA-256 of the original
filename, `mimetype` is the browser-asserted MIME from
`req.file.mimetype`, and `path` is the sanitized request path
(`req.originalUrl?.split('?')[0] ?? req.path`).

`mimetype` is included (not PII) because it materially helps triage
MIME/byte mismatches — the most common parser-failure shape is a
client that mislabels the file type.

`path` is required by spec FR-006 / Data Considerations so the log
remains self-describing in aggregated log streams. The endpoint has
a single route today (`/api/resume/parse`), but including the field
keeps logs filterable by downstream tools and future-proofs the
shape if the route ever splits.

**Rejected**: log the original filename verbatim.
- Filenames frequently contain PII (`alex_rivera_resume_2026.pdf`),
  workplace names, or other identifying information.
- A SHA-256 prefix lets ops correlate two failures from the same
  upload across logs without retaining the identifying string.

**Rejected**: log nothing (return a generic error with no server-side
trace).
- Defeats the ability to debug genuinely-unexpected library bugs.
- Server logs are a private operator surface; the constraint is on
  the response body.

**Reasoning**: balances debuggability (`error.message`, `stack`,
correlation hash) against PII minimization (no filename, no resume
content, no extracted text).

**Note**: The log goes to the existing `console.error` stream. No new
log infrastructure, no external sink, no analytics call. Constitution
compliance — "no third-party data sharing."

---

## §7. fs-spy regression test design

**Decision**: install pass-through spies on the following `fs` APIs
for the duration of every parse-endpoint integration test (happy +
sad). Assert zero calls on every spy *except* `fs.open` /
`fs.openSync`; for those two, assert zero calls whose flags argument
indicates write/create/truncate/append intent.

Rationale for the split: `fs.open` and `fs.openSync` are part of the
low-level write path (open with `O_WRONLY` / `O_CREAT` then
`writeSync`), so dropping them entirely would narrow the security
envelope. But they are also called by legitimate in-process readers
during the test (vitest's module loader, snapshot reads, library
debug fixtures). Filtering by the flags argument keeps the write-path
coverage and avoids false positives from those reads. Every other
spy in the set is a write-only API, so a flat zero-call assertion
remains correct for them.

Covered APIs:
- `fs.writeFile`, `fs.writeFileSync`, `fs.promises.writeFile` — the
  standard write paths.
- `fs.appendFile`, `fs.appendFileSync`, `fs.promises.appendFile` —
  the append paths. Catches a hypothetical future "log uploads to
  file" misfeature that would otherwise bypass the writeFile spies.
- `fs.createWriteStream` — streamed writes (multer's `diskStorage`
  uses this path).
- `fs.open`, `fs.openSync`, `fs.promises.open` + `fs.writeSync` —
  the low-level file-descriptor write path that bypasses the
  `writeFile`-style helpers. A direct `openSync` + `writeSync`
  regression, or a promise-based file-handle write opened with write
  flags, would otherwise be silent.

**Rejected option A**: spy on `os.tmpdir()`.
- Not a function call we can spy on cleanly; tmpdir returns a string
  and write operations bypass it directly. Spying on the writes
  themselves (above) is the actionable equivalent.

**Rejected option B**: only spy on the success-path test.
- Misses the case where a failure path inadvertently writes (e.g., a
  future "save failed uploads for debugging" misfeature).

**Rejected option C**: spy on `fs.mkdtemp` / `mkdtempSync`.
- These create a temp directory but don't write content. A
  subsequent `writeFile` into the resulting path would be caught by
  the existing spies. Adding the spy adds noise without coverage.

**Reasoning**: the expanded set covers every realistic fs write path
a future regression could take. The set is documented in the test's
inline comment so a future change of upload middleware or parser
library prompts re-evaluation.

**Known limitation**: a write through `child_process.spawn` (shelling
out to an external binary that writes the resume to disk) or
`process.stdout.write` to a pipe-backed file would bypass these
spies. Neither current library does this; closing this requires
sandbox-style isolation that is disproportionate to the threat.
Documented as residual risk in `plan.md §Risks`.

---

## §8. Service-role-key grep test design

**Decision**: a vitest test that uses `node:fs` to read the resume
code path files at runtime and asserts none of them contain the
literal string `SUPABASE_SERVICE_ROLE_KEY` or `service_role`. Files
covered:

- `server/routes/resume.js`
- `server/resume/extractor.js`
- `server/resume/parser.js`
- `src/services/resumeApi.js`
- `src/components/ResumeImport.js`

**Rejected**: a shell `grep` as a `prelint` step in `package.json`.
- Cross-platform (Windows + macOS + Linux) shell scripting is
  brittle; running the same check in JS via vitest is portable.

**Rejected**: a static analysis rule via ESLint.
- ESLint plugins for "this file must not reference this string" are
  not standard; rolling one for one assertion is overkill.

**Reasoning**: the test is a few lines of `fs.readFileSync` +
`expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY')`. Easy to
maintain, easy to extend if the resume code path grows.

---

## §9. Test setup for hosted-mode requireAuth path

**Decision**: borrow the `createApp({ requireAuth: stubReject })`
pattern from existing tests in
[tests/server/routes-protected.test.js](../../tests/server/routes-protected.test.js)
where a stub `requireAuth` that always returns 401 is passed
explicitly. The integration test runs against a server that has the
resume route mounted with this stub, exercises the no-Authorization
case, and asserts the 401 response.

**Rejected**: spin up a real Supabase test project to verify the JWKS
verification path end-to-end.
- The JWKS verification is already tested in
  `tests/server/auth-middleware.test.js`. 021's regression test only
  needs to verify the resume route honors whatever `requireAuth` is
  passed in.

**Reasoning**: respects the existing auth-test pattern, keeps the new
test self-contained, fast, and deterministic.

---

## §10. Browser Smoke Test phase — needed or not

**Decision**: not required for this feature.

**Reasoning**: Constitution Amendment 1.3.0 mandates the Browser
Smoke Test as the final phase "for UI features only." 021 introduces
no UI changes — the frontend behavior (demo gate, upload widget,
parsing trigger) is unchanged from feature 020. The only client-
observable delta is a different error code/message for a corrupted
file; that's covered by the integration tests + the manual hosted-
preview walk in [quickstart.md](quickstart.md).

If a future review concludes the manual hosted walk is itself a
"smoke test" by another name, the constitution requirement is
satisfied either way; the formal phase is omitted.

---

## §11. Future work (out of scope for 021)

1. **Global 500 handler hardening** — replace `err.message` with a
   fixed generic message in `server/index.js:74-91`; route errors
   through a category discriminator. Recommended as a follow-up
   security feature.
2. **Resume content sanitization** — the extracted text from a
   resume is currently echoed back to the client in the parsed-field
   response. Resume content can contain HTML/script tags. The
   frontend renders these as text via `textContent` (not innerHTML),
   so the risk is low today. A future feature could explicitly strip
   or escape on the server for defense in depth.
3. **Upload rate limiting** — the brief's Non-Goals list includes
   rate limiting. A high-frequency upload attack could exhaust the
   serverless function instance's memory. Vercel's platform-level
   protections (BotID, Firewall) mitigate this today; an
   application-level limit would be a future feature.
4. **Filename SHA logging hash collision** — 8 hex chars = 32 bits of
   entropy. By the birthday bound, ~50% collision probability is
   reached around ~65,000 distinct uploads (≈ √2³²). Sufficient for
   debugging correlation within an operator session, but not for
   forensic uniqueness across long log windows. Acceptable; revisit
   the prefix length if log retention or volume grows materially.
5. **`/api/resume/parse` response shape change** — out of scope per
   spec Non-Goal §10. A future cleanup might trim the response
   payload to omit fields the client doesn't use.

---

## §12. Post-implementation notes

Decisions that emerged during Phases 01–04 and were not anticipated
in the original research notes above.

### §12.1 fs default import vs. namespace import

**Original spec snippet** (tasks.md Task 03.1) used
`import * as fs from 'node:fs'` (namespace import). During Phase 03
implementation this turned out to interact badly with `vi.spyOn`:
ES module namespace bindings are sealed in Node, so `vi.spyOn(fs, …)`
attempts to redefine a property on a sealed object. In some vitest
versions this throws; in others it silently fails to attach.

**Adopted**: `import fs from 'node:fs'` (default import). Node's
ESM compatibility layer exposes the entire CJS `module.exports` as
the default export, which is a regular mutable object — `vi.spyOn`
attaches cleanly. `fs.promises.*` is reachable via the same handle,
so the `node:fs/promises` namespace import is also unnecessary.

Functionally identical; one less import line; the spy set in
`installFsSpies()` works as documented.

### §12.2 console.error suppression in the fs-spy `beforeEach`

The Phase 01 implementation logs `[resume.parse]` via `console.error`
on every parse-failure path. The Phase 03 fs-spy installs a
pass-through spy on `fs.writeSync`. On some platforms / Node versions
`process.stderr.write` ultimately calls `fs.writeSync(2, …)`, which
would register a call on our spy and trip the `not.toHaveBeenCalled()`
assertion even though no application code wrote to disk.

**Mitigation**: the fs-spy describe's `beforeEach` runs
`vi.spyOn(console, 'error').mockImplementation(() => {})` BEFORE
`installFsSpies()`, suppressing the route's stderr emission so the
fs.writeSync spy sees no incidental call. `vi.restoreAllMocks()` in
`afterEach` cleans both up.

Documented here because a future maintainer adding new fs spies might
not understand why the console.error mock is present; the answer is
"to prevent stderr's syscall from tripping the writeSync spy."

### §12.3 Vercel PDF runtime canvas globals

During hosted preview validation, a known-good PDF upload returned
`400 PARSE_FAILED` in Vercel even though TXT parsing and local tests
were green. The PDF path uses `pdf-parse`, which is built on PDF.js.
Some PDF.js paths expect browser canvas globals such as `DOMMatrix`,
`ImageData`, and `Path2D`; Vercel's Node runtime does not provide
those globals.

**Adopted**: before dynamically importing `pdf-parse`, the PDF
extractor lazily imports `DOMMatrix`, `ImageData`, and `Path2D` from
`@napi-rs/canvas` and installs them on `globalThis` only when absent.
`@napi-rs/canvas` was already present transitively through
`pdf-parse`; it is now declared directly in `package.json` so the
runtime contract is explicit and not dependent on a transitive package
remaining hoisted.

**Regression test**: `tests/server/resume.test.js` deletes the three
globals, uploads a minimal valid PDF, asserts a `200` parse response,
and confirms the globals were restored by the extractor.
