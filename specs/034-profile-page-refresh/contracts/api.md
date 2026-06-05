# Contracts: Profile Page Refresh (034)

## Project Alice server API — NO CHANGES

This feature adds **no new server endpoints** and changes **no existing request/
response shapes**. All new behavior is browser-local (settings) or reuses
endpoints already shipped by feature 033:

| Endpoint | Status in 034 |
|----------|---------------|
| `POST /api/resume/extract` (file → text, memory-only) | reused, unchanged |
| Existing profile read/save endpoints | reused, unchanged |
| Account deletion endpoints (feature 030) | reused, unchanged |

The account-deletion control is merely **relocated** into the unified Settings
card; its network contract (`deleteAccount({ password })` / `({ confirm:'DELETE' })`)
is unchanged.

---

## External: OpenRouter (browser-direct, BYOK) — reused + one signature change

The browser calls OpenRouter directly with the user's own key (never via Alice's
server; the key never reaches Alice's backend). Defined in
`src/services/llmParser.js`.

### Parse call (existing, 033)
- `POST https://openrouter.ai/api/v1/chat/completions`
- Auth: `Authorization: Bearer <user key>`
- Body: `{ model, messages, ... }` — `model` currently hardcoded to `DEFAULT_MODEL`
- Timeout: `LLM_TIMEOUT_MS` (30s) via `AbortController`; input capped at
  `MAX_INPUT_CHARS` (24 000)

**034 change (R-5):** `parseWithLlm(text, key, model)` accepts a `model` slug;
callers pass `aiSettings.getModel()` (defaults to `DEFAULT_MODEL`). No other
change to the request/response handling or the JSON sanitisation via
`normaliseProfile`.

### Key-validation call (new, R-3)
- `validateKey(key, model?)` issues **one** cheap authenticated request (auth/models
  endpoint) with the same timeout, used by the Settings "Test" button.
- Returns: `{ ok: true }` → status `connected`; `{ ok: false, reason }` → status
  `error` with a reason code (below). Does **not** parse a résumé / consume parse
  tokens.

### Error → reason-code mapping (new, R-6) — shared by Test + import failure dialog

| OpenRouter / transport result | Reason key | Code chip | `fix` |
|-------------------------------|-----------|-----------|-------|
| HTTP 429 | `rate_limit` | `HTTP 429` | wait |
| Request aborted / timeout | `timeout` | `TIMEOUT` | wait |
| HTTP 5xx (e.g. 503) | `server` | `HTTP 503` | wait |
| `fetch` network failure | `network` | `NETWORK` | wait |
| HTTP 401 / 403 | `invalid_key` | `HTTP 401` | settings |
| HTTP 402 | `quota` | `HTTP 402` | settings |
| Extractor returns no usable text | `NO_TEXT` | `NO_TEXT` | dead-end |
| Unknown | `rate_limit` (treat as retryable) | `HTTP 429` | wait |

Copy is provider-agnostic ("your AI provider key") so the same strings hold for any
backend provider. `fix` drives the dialog's primary recovery action:
`wait` → **Try AI again**; `settings` → **Update key in Settings →**;
`dead-end` → **Use a different file / paste**. "Use basic parser" remains available
for every non-dead-end reason (the rule-based parser is the fallback).

---

## Browser storage contract (browser-local, R-1)

Not an HTTP contract, but the cross-load contract other features rely on. See
[data-model.md §1](../data-model.md). Keys: `alice.ai.openrouterKey` (reused),
`alice.ai.enabled`, `alice.ai.model`, `alice.ai.features`. `alice.ai.consent` is
read once for migration then retired. No OpenRouter key ever leaves the browser
except the direct OpenRouter call. Uploaded résumé files may pass through
`POST /api/resume/extract` transiently (memory-only) for text extraction and are
not persisted; pasted résumé text goes browser-direct to the provider.
