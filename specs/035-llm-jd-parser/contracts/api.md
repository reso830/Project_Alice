# Contracts: LLM JD Parser

## No new server endpoints

JD parsing is **paste-only** and runs **client-side** (browser → OpenRouter, BYOK),
mirroring the resume LLM path. This feature adds **no** Express routes and makes no
changes under `api/`. The only "contract" is between the application and the LLM.

---

## LLM request (reused transport — `services/llmParser.js`)

`POST https://openrouter.ai/api/v1/chat/completions`

```http
Authorization: Bearer <user OpenRouter key>   # browser-held; never sent to Alice's server
Content-Type: application/json
```

```json
{
  "model": "<aiSettings.getModel()>",
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "<JD extraction system prompt>" },
    { "role": "user", "content": "<raw pasted JD, truncated at MAX_INPUT_CHARS>" }
  ]
}
```

- Timeout: `LLM_TIMEOUT_MS` (~30s, shared constant) via `AbortController`.
- Truncation: input over `MAX_INPUT_CHARS` (24k) is sliced; `truncated` flag returned.

---

## LLM response contract (expected JSON object)

The model MUST return **only** a JSON object (markdown fences tolerated and stripped)
with these keys. Unknown values use `""`/`null`/`[]`; the model must not fabricate.

```jsonc
{
  "companyName": "string",
  "jobTitle": "string",
  "responsibilities": "string",        // join bullets with newlines
  "location": "string",
  "salary": 0,                          // integer, annual PHP, lower bound of a range; null if absent
  "workSetup": "Remote|Hybrid|On-site|Field|",   // "" if not stated
  "shift": "Day|Mid|Night|Flexible|",            // "" if not stated
  "skills": ["string"],                 // required skills; deduped
  "preferredSkills": ["string"],        // "nice to have"; deduped
  "recruiter": "string",
  "jobPostingUrl": "string"             // http(s) URL or ""
}
```

**Status is NOT part of the contract** — it is never parsed and stays `wishlisted`.
`compat` is NOT requested — it is assigned a random 0–100 by the app.
**"Years of experience" is intentionally NOT in the contract** — no schema home
(non-goal); the model is not asked to return it.

### Post-receipt handling (app-side, authoritative over the model) — three outcomes

1. Extract JSON (strip code fences). **Unparseable or non-object** →
   `LLM_INVALID_RESPONSE` → **recoverable** AI-down dialog (offers Use basic parser).
2. `normalizeApplication()` then `validateApplication()` — enum whitelist, URL
   validity, salary positivity, status fallback, compat clamp.
3. **Zero usable fields** after normalization → `LLM_EMPTY_RESPONSE` → mapped to
   `NO_TEXT` → **terminal dead-end** (no basic-parser option); do not pre-fill.
4. **≥1 usable field** → success; return `{ draft, truncated }` and pre-fill as-is.

---

## Error → reason mapping (reused `REASON_CODES` / `mapErrorToReason`)

| Provider / client condition | Reason key | Code | Recovery (secondary action) |
| --- | --- | --- | --- |
| HTTP 429 | `rate_limit` | `HTTP 429` | wait → **Try AI again** |
| HTTP 401/403 | `invalid_key` | `HTTP 401` | settings → **Update key** |
| HTTP 402 | `quota` | `HTTP 402` | settings → **Update key** |
| Abort/timeout | `timeout` | `TIMEOUT` | wait → **Try AI again** |
| HTTP 5xx | `server` | `HTTP 503` | wait → **Try AI again** |
| Network failure | `network` | `NETWORK` | wait → **Try AI again** |
| Empty/unreadable result | `NO_TEXT` | `NO_TEXT` | dead-end → **Try again / Enter manually** (no basic parser) |

All non-dead-end reasons also offer **Use basic parser** (`parseJobPost`) and
**Enter manually**. No raw provider/library internals are shown to the user.

---

## Basic parser contract (fallback — `utils/jobPostParser.js`, unchanged)

`parseJobPost(text)` returns a partial application draft over the same fields above
(subset; typically no recruiter/shift/preferred skills), with a random `compat`.
Used only as the post-AI-failure fallback; output marked `fillSource: 'basic'` (⚙ Auto).
