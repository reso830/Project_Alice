# Quickstart: Hosted Resume Import Security (021)

Manual verification recipe for the new sanitized-error contract and
the existing security properties. Run against a hosted preview
deploy (or `npm run server:start` with hosted env vars + a real
Supabase JWT) before merging.

This walks the user-visible delta from feature 020 to 021. Every
step has a clear pass/fail criterion.

---

## Prerequisites

- A hosted preview deploy of the branch, OR a local server running
  in hosted mode with the three required Supabase env vars set.
- A valid Supabase session token for an allowlisted user (a real
  sign-in works; capture the bearer from the Network panel after
  signing in). **Treat the token as a credential** — do not paste
  it into PR descriptions, screenshots, chat, or commit logs; revoke
  the session after the manual walk if it was captured to a place
  outside your local terminal scrollback.
- A corrupted PDF for §3 — easiest way: `printf 'NOT A PDF' >
  bad.pdf` (creates a file with PDF extension but no valid PDF
  header).

---

## §1 — Happy path: authenticated upload succeeds (regression)

1. Sign in as a hosted user.
2. Navigate to **Profile → Edit profile**.
3. Verify the Resume Import widget is visible.
4. Upload a small valid PDF (any real resume <= 5 MB).

**Pass criterion**: the form auto-fills with parsed fields. No error
toast appears. Network panel shows a single `POST /api/resume/parse`
with `200 OK`.

---

## §2 — Hosted unauthenticated request → 401 with no leaks

In a terminal, with a hosted dev server running, issue:

```bash
curl -i -X POST <hosted-url>/api/resume/parse \
  -F "resume=@./any-file.pdf"
```

**Pass criterion**:
- Status line: `HTTP/1.1 401 Unauthorized` (or 401 with a similar
  reason phrase depending on the proxy).
- Response body matches the standard `requireAuth` error envelope
  (e.g., `{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }`).
- Response body contains NO occurrence of: `pdf-parse`, `pdfjs`,
  `mammoth`, `multer`, or any file path under `node_modules/`.

---

## §3 — Corrupted PDF → 400 PARSE_FAILED with sanitized message

The new behavior introduced by 021.

1. Create a corrupted PDF:
   ```bash
   printf 'NOT A PDF' > bad.pdf
   ```
2. Sign in as a hosted user, navigate to **Profile → Edit profile**.
3. Upload `bad.pdf` via the resume import control.

**Pass criterion (client side)**:
- The form does NOT auto-fill.
- An error toast or inline error shows the fixed message:
  `Could not read this resume. Try a different file.`
- The Network panel response body is:
  ```json
  { "error": { "code": "PARSE_FAILED", "message": "Could not read this resume. Try a different file." } }
  ```
- Response body contains NO occurrence of: `pdf-parse`, `pdfjs`,
  `DOMMatrix`, any stack-trace text, any internal path.

**Pass criterion (server side)**:
- The server log contains one line tagged `[resume.parse]` with the
  raw error message, stack, and an 8-char nameSha8 hash (NOT the
  filename `bad.pdf` itself).

---

## §4 — Oversized upload → 400 FILE_TOO_LARGE (existing behavior regression)

1. Create a 10 MB file: `dd if=/dev/zero of=big.pdf bs=1m count=10`
   (macOS/Linux) or use any file >5 MB.
2. Sign in as a hosted user.
3. Attempt to upload `big.pdf` via the resume import control.

**Pass criterion**: error response is `400 FILE_TOO_LARGE` with the
existing message (`File exceeds the 5 MB size limit.`). Behavior
unchanged from 014.

---

## §5 — Unsupported file type → 400 UNSUPPORTED_FILE_TYPE (regression)

1. Rename any executable or image to `resume.zip`.
2. Sign in as a hosted user.
3. Attempt to upload it.

**Pass criterion**: `400 UNSUPPORTED_FILE_TYPE` with the existing
message. Behavior unchanged from 014.

---

## §6 — Demo visitor never reaches the endpoint (regression from 020)

1. Open the hosted deploy in a fresh private window.
2. Click **Try the demo** on the welcome page.
3. Navigate to **Profile → Edit profile**.

**Pass criterion**:
- The Resume Import widget is NOT rendered.
- The inline note `Resume import is available after signing in.`
  appears in its place.
- The Network panel shows zero requests to `/api/resume/parse`
  during the entire session.

If a tester wants to verify Layer 2 (server-side) as a backstop:

1. From the demo session, open DevTools → Console.
2. Try to manually craft and send the request:
   ```js
   const fd = new FormData();
   fd.append('resume', new Blob(['x'], { type: 'application/pdf' }), 'a.pdf');
   const r = await fetch('/api/resume/parse', { method: 'POST', body: fd });
   console.log(r.status, await r.text());
   ```

**Pass criterion**: response is `401` (demo has no JWT; `requireAuth`
rejects). No parser library text in the body.

---

## §7 — Service-role key is unreachable from the resume code path

Run repo-locally:

```bash
grep -rn "SUPABASE_SERVICE_ROLE_KEY\|service_role" \
  server/routes/resume.js \
  server/resume/ \
  src/services/resumeApi.js \
  src/components/ResumeImport.js
```

**Pass criterion**: zero matches.

(The automated test in `tests/server/resume.test.js` performs the
same check at CI time. This manual step is a quick sanity check.)

---

## §8 — Logs do not contain the resume content

After running §3:

1. Inspect the server log output for the `[resume.parse]` line.
2. Confirm the log object contains: `error`, `stack`, `nameSha8`.
3. Confirm the log object does NOT contain: the original filename
   (`bad.pdf`), the raw file bytes, the extracted text.

**Pass criterion**: log shape matches the contract in `contracts/api.md §3 Layer 4`.

---

## Smoke-test outcome reporting

Append the eight pass/fail outcomes to the PR description as bullet
points. Any failure blocks merge until the root cause is fixed; do
not "work around" a smoke-test failure with a follow-up.
