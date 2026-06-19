# Provider Interface Contract

**Feature**: 038-ai-provider-abstraction
**Version**: 1.0 (v1 — OpenRouter only)

Every AI provider implementation must export an object conforming to this contract. The `aiProvider.js` registry enforces conformance at registration time.

---

## Export shape

Each provider file must export a **named aggregate object** that the registry can store directly:

```js
// src/services/providers/myprovider.js
export const myProvider = {
  defaultModel: 'provider/model-slug',
  complete,
  validateKey,
};
```

Flat named exports (`export function complete(...)`) are not sufficient — `aiProvider.js` registers objects, not module namespaces.

## Interface

The aggregate object must conform to:

```js
{
  defaultModel: string,
  complete(params): Promise<CompleteResult>,
  validateKey(key): Promise<ValidateResult>,
}
```

---

## `defaultModel`

**Type**: `string`

The model slug this provider uses when no model is configured by the caller. Must be non-empty.

**OpenRouter v1 value**: `'meta-llama/llama-3.3-70b-instruct:free'`

---

## `complete(params)`

**Params**:
```js
{
  systemPrompt: string,   // instruction prompt
  userContent: string,    // user-supplied content (resume, job posting, compat context)
  key: string,            // caller's API key for this provider
  model: string,          // model slug; fall back to defaultModel when blank or absent
}
```

**Returns**: `Promise<{ parsed: object, truncated: boolean }>`

- `parsed` — a plain JSON object extracted from the provider's response envelope
- `truncated` — `true` when `userContent` exceeded the provider's input limit and was clipped

**On failure**: throws an `Error` created via `createLlmError(code, message, status?)` from `aiErrors.js`. The thrown error carries `.code` set to an internal error string (e.g., `'LLM_TIMEOUT'`, `'LLM_NETWORK_ERROR'`). Callers normalize to a standardized reason string by passing the error through `mapErrorToReason(error)`. Must not throw provider-specific exceptions (raw HTTP status codes, SDK error types, provider error envelopes).

---

## `validateKey(key)`

**Params**:
- `key: string` — the API key to validate

**Returns**: `Promise<{ ok: boolean, reason?: string }>`

- `{ ok: true }` — key is accepted by the provider
- `{ ok: false, reason }` — key was rejected; `reason` is a standardized reason code

**Local / self-hosted providers** that have no API key concept may implement this as a stub returning `{ ok: true }` unconditionally. This is only permitted for local models; cloud providers must implement full validation.

---

## Standardized Error Reason Codes

All providers must ensure their errors are mappable to these codes. Specifically:
- Errors thrown by `complete` must be created with `createLlmError` and must map correctly through `mapErrorToReason` to one of the strings below.
- `validateKey` failure responses must carry `.reason` set directly to one of the strings below.

The standardized reason strings are:

| Code | Meaning | HTTP equivalent (OpenRouter) |
|---|---|---|
| `timeout` | Request exceeded the allowed duration | AbortError / 408 |
| `network` | Network-level failure before receiving a response | fetch rejection |
| `invalid_key` | API key rejected | 401 / 403 |
| `quota` | Account balance exhausted | 402 |
| `rate_limit` | Too many requests | 429 |
| `server` | Provider-side server error | 5xx |
| `NO_TEXT` | Input contained no machine-readable content | n/a |

Provider-specific exceptions must not propagate beyond the provider implementation.

---

## Registration

Providers are registered in `src/services/aiProvider.js` by importing the named aggregate and adding it to the `PROVIDERS` map:

```js
import { openrouterProvider } from './providers/openrouter.js';
import { myProvider } from './providers/myprovider.js';   // ← add

const PROVIDERS = {
  openrouter: openrouterProvider,
  myprovider: myProvider,                                  // ← add
};
```

After registration, `aiProvider.setActiveProvider('myprovider')` switches all AI calls to the new provider at runtime. Existing feature code requires no changes.

---

## Adding a New Provider (checklist)

- [ ] Create `src/services/providers/<name>.js` exporting a single named aggregate: `export const myProvider = { defaultModel, complete, validateKey }`
- [ ] Errors thrown by `complete` use `createLlmError` from `aiErrors.js` and map correctly through `mapErrorToReason`; `validateKey` failures return `{ ok: false, reason }` with `.reason` set to a standardized code
- [ ] If local/self-hosted (no API key concept), stub `validateKey` as `{ ok: true }`
- [ ] Register in `aiProvider.js` under a unique slug
- [ ] Add unit tests covering: happy path, timeout, network error, invalid key, server error
- [ ] Update `docs/REPO_MAP.md`
