# Data Model: LLM Resume / CV Parser (033)

This feature introduces **no persistent data model changes** — no new DB tables,
columns, or profile-schema fields. The profile schema (`src/models/profile.js`,
feature 032) is consumed as-is. The "data" here is transient browser state and
the LLM request/response shape.

---

## 1. Transient & client-side entities

### 1.1 Provider Key Setting (browser-only)
- **Store**: `localStorage`, managed exclusively by `src/data/aiSettings.js`.
- **Key**: `alice.ai.openrouterKey` (string; the user's OpenRouter API key).
- **Lifecycle**: set/cleared by the user in the Profile-page AI settings section.
  Never sent to Alice's server; never persisted server-side. Cleared by "Clear
  key" or by clearing browser data.
- **Validation**: non-empty trimmed string to be considered "configured"
  (`hasKey()`). No format check beyond non-empty (OpenRouter validates on use).

### 1.2 Consent State (browser-only)
- **Store**: `localStorage` key `alice.ai.consent` (e.g. `'granted'`).
- **Lifecycle**: set once when the user accepts the first-use consent notice;
  remembered until cleared. `hasConsent()` reads it.
- **Semantics**: gate that MUST be true before any resume content is sent to
  OpenRouter (FR-011).

### 1.3 AI-field provenance set (in-memory, ProfileEdit)
- **Shape**: a `Set<string>` of field paths the AI populated this session
  (e.g. `summary`, `firstName`, `experience[0]`, `skills[2]`).
- **Lifecycle**: populated from `ResumeImport.onSuccess`; an entry is removed when
  the user edits that field; discarded on navigation away / save.
- **Not persisted**: provenance never enters the saved profile — AI-populated
  values save identically to manually entered ones.

---

## 2. LLM request shape (browser → OpenRouter)

`POST https://openrouter.ai/api/v1/chat/completions`

- Headers: `Authorization: Bearer <user key>`, `Content-Type: application/json`.
- Body (single request, no chaining):
  - `model`: configurable `DEFAULT_MODEL` constant.
  - `response_format`: `{ type: 'json_object' }` (where supported).
  - `messages`:
    - system: instruct the model to return ONLY JSON matching the profile schema
      below; omit unknown fields rather than inventing them; dates as `MM/YYYY`
      (or `YYYY` for education year); do not fabricate dates.
    - user: the raw resume text (possibly truncated — see §4).

---

## 3. LLM response → profile draft (target schema)

The model is asked to return a JSON object matching the **full** profile schema
(clarification Q1). Fields mirror `normaliseProfile` output:

| Field | Type | Notes |
|---|---|---|
| `firstName`, `lastName`, `email`, `phone`, `city`, `summary` | string | singular fields; merged into empty slots only |
| `experience[]` | `{ role, company, responsibilities, dateStarted, dateEnded, currentWork }` | dates `MM/YYYY`; `currentWork` boolean |
| `education[]` | `{ degreeMajor, university, yearCompleted }` | `yearCompleted` four-digit year |
| `skills[]` | `string` (name) | imported **unrated** → `{ name, level: null }` via merge |
| `certifications[]` | `{ name, issuingBody, certificateId, issuanceDate, expiryDate }` | dates `MM/YYYY` |
| `awards[]` | `{ awardName, issuingBody, details, date }` | date `MM/YYYY` |
| `languages[]` | `{ language, proficiency }` | proficiency in {Beginner, Intermediate, Professional, Fluent} |
| `links[]` | `{ url, friendlyName }` | http/https |

**Validation/sanitization (browser)**: `JSON.parse` → must be a plain object →
`normaliseProfile()` → must contain extracted data, else invalid → rule-based
fallback (R-5). `normaliseProfile` already drops malformed entries and coerces
types, so the draft entering `mergeResumeData` is always schema-clean.

**Merge into form**: via existing `mergeResumeData(_formState, draft)` —
singular fields fill only empty slots; collections append with duplicate
detection; skills arrive unrated (existing behavior, unchanged).

---

## 4. Over-length handling

- A configurable `MAX_INPUT_CHARS` constant bounds the text sent to OpenRouter.
- If raw text exceeds it: truncate to the limit, send, and surface a visible
  notice that the resume was long and some tail content may be unparsed (FR-020).
  A draft is still produced; the rule-based fallback (no length cap) remains
  available on failure.

---

## 5. Server-side (no model change)

- `POST /api/resume/extract` (new): input = multipart file; output =
  `{ data: { text: string } }`. Stateless, memory-only, no persistence.
- `POST /api/resume/parse` (extended): input = multipart file **or** JSON
  `{ text }`; output unchanged (`{ data: <parsed profile> }`).
- No database reads/writes are introduced by this feature.
