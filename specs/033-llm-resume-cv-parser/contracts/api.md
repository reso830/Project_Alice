# API Contracts: LLM Resume / CV Parser (033)

Covers the one new endpoint, one extended endpoint, and the external OpenRouter
call. Error envelope matches the existing convention: `{ "error": { code, message } }`
on failure, `{ "data": ... }` on success.

---

## 1. `POST /api/resume/extract` (NEW)

Returns the raw extracted text of an uploaded resume so the browser can send it
directly to OpenRouter. No LLM, no key, no persistence.

- **Auth**: `requireAuth` in hosted mode (demo visitor → 401). Open in local mode,
  same as `/api/resume/parse`.
- **Request**: `multipart/form-data`, field `resume` = file (PDF/DOCX/TXT).
- **Limits**: 5 MB (`multer.memoryStorage`), reusing the existing extractor.

**Success** `200`:
```json
{ "data": { "text": "…raw extracted text…" } }
```

**Errors** (mirror `/parse`, generic — no library internals leaked):

| Status | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | no file provided |
| 400 | `FILE_TOO_LARGE` | exceeds 5 MB |
| 400 | `UNSUPPORTED_FILE_TYPE` | not PDF/DOCX/TXT |
| 400 | `PARSE_FAILED` | extractor threw (corrupt/unreadable) |
| 401 | (auth) | hosted, missing/invalid JWT |

---

## 2. `POST /api/resume/parse` (EXTENDED)

Existing rule-based endpoint, now accepting pasted text in addition to a file, so
it can serve as the fallback for both input modes.

- **Auth**: unchanged (`requireAuth` in hosted).
- **Request — file mode (unchanged)**: `multipart/form-data`, field `resume`.
- **Request — text mode (new)**: `application/json` body:
  ```json
  { "text": "…raw resume text…" }
  ```
  - Validation: `text` must be a non-empty string within a max-length guard
    (`TEXT_MAX` — return `VALIDATION_ERROR` if missing/empty, `FILE_TOO_LARGE`-style
    `PAYLOAD_TOO_LARGE` if over the cap).
  - Behavior: skip multer/extraction; run `parseResumeText(text)` directly.

**Success** `200` (both modes, unchanged shape):
```json
{ "data": { "firstName": "…", "experience": [ … ], "skills": [ … ], "…": "…" } }
```

**Errors**: existing set, plus the text-mode validation cases above.

---

## 3. External: OpenRouter chat completions (browser-direct)

Not an Alice endpoint — called from the browser with the **user's** key.

- **URL**: `POST https://openrouter.ai/api/v1/chat/completions`
- **Headers**: `Authorization: Bearer <user OpenRouter key>`,
  `Content-Type: application/json`.
- **Body**:
  ```json
  {
    "model": "<DEFAULT_MODEL constant>",
    "response_format": { "type": "json_object" },
    "messages": [
      { "role": "system", "content": "<schema + JSON-only instructions>" },
      { "role": "user", "content": "<raw (possibly truncated) resume text>" }
    ]
  }
  ```
- **Timeout**: `AbortController`, default `LLM_TIMEOUT_MS = 30000`.
- **Expected response**: standard OpenRouter completion; the assistant message
  content is a JSON object matching the profile schema (data-model §3).
- **Client handling**:
  - non-2xx, network error, abort/timeout, or content not parseable as a
    schema-clean profile → **rule-based fallback** (§2).
  - never surface raw provider/auth errors to the user (FR-017); show a friendly
    message and fall back.

---

## 4. Security invariants (locked by tests)

- Neither `/extract` nor `/parse` persists the upload, the text, or any key
  (memory-only; no disk, no DB).
- The **OpenRouter key** never reaches Alice's server — it travels browser →
  OpenRouter only (the LLM call is browser-direct).
- **Resume content**: pasted text goes browser → OpenRouter directly; an uploaded
  file passes through `/extract` for stateless, memory-only extraction, then its
  text goes browser → OpenRouter. In all cases content is processed transiently
  and is **never persisted** (no disk, no DB) — matching FR-010 / SC-006.
- Hosted demo visitor (no JWT) → 401 on `/extract` and `/parse`.
- Error responses never echo provider/library internals.
