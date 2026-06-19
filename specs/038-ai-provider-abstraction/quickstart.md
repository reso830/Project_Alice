# Quickstart: Adding a New AI Provider

After 038 lands, adding a second AI provider requires four steps and no changes to existing feature code.

---

## Step 1 — Create the provider implementation

Create `src/services/providers/<name>.js`. It must export a **single named aggregate object** — flat named exports are not valid (the registry stores objects, not module namespaces).

```js
// src/services/providers/anthropic.js  (example)
import { createLlmError, mapErrorToReason } from '../aiErrors.js';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 30_000;

async function complete({ systemPrompt, userContent, key, model }) {
  const modelSlug = (typeof model === 'string' && model.trim()) ? model.trim() : DEFAULT_MODEL;
  const controller = new globalThis.AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await globalThis.fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelSlug,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw createLlmError('LLM_TIMEOUT', 'The provider request timed out.');
    throw createLlmError('LLM_NETWORK_ERROR', 'The provider request failed.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const s = response.status;
    throw createLlmError('LLM_PROVIDER_ERROR', 'The provider rejected the request.', s);
  }

  const payload = await response.json();
  const text = payload?.content?.[0]?.text ?? '';
  const parsed = JSON.parse(text.trim());   // add fence-stripping as needed
  return { parsed, truncated: false };
}

async function validateKey(key) {
  // Anthropic has no "list models" endpoint; probe with a minimal request instead
  try {
    const r = await globalThis.fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    if (r.ok) return { ok: true };
    // validateKey returns { ok, reason } with reason as a standardized string directly
    return { ok: false, reason: mapErrorToReason(r.status) };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

// Export as a named aggregate — required by the aiProvider.js registry
export const anthropicProvider = {
  defaultModel: DEFAULT_MODEL,
  complete,
  validateKey,
};
```

**Rules:**
- Only `export const <name>Provider = { ... }` — no other exports from the file
- Provider-specific exceptions must not escape `complete` or `validateKey`
- Errors thrown by `complete` must use `createLlmError` (sets `.code`) so they map correctly through `mapErrorToReason`; `validateKey` failures return `{ ok: false, reason }` with `.reason` set directly to a standardized code string — see `contracts/provider.md`
- If the provider has no API key concept (local/self-hosted), stub `validateKey` as `return { ok: true }`

---

## Step 2 — Register the provider

Open `src/services/aiProvider.js` and add an entry to `PROVIDERS`:

```js
import { openrouterProvider } from './providers/openrouter.js';
import { anthropicProvider } from './providers/anthropic.js';   // ← add

const PROVIDERS = {
  openrouter: openrouterProvider,
  anthropic: anthropicProvider,   // ← add
};
```

---

## Step 3 — Add tests

Create `tests/services/providers/anthropic.test.js`. Cover at minimum:
- `complete` — happy path (fetch returns valid JSON)
- `complete` — AbortError → error has `.code === 'LLM_TIMEOUT'`; `mapErrorToReason` returns `'timeout'`
- `complete` — network failure → `.code === 'LLM_NETWORK_ERROR'`; `mapErrorToReason` returns `'network'`
- `complete` — 401 response → `.code === 'LLM_PROVIDER_ERROR'`, `.status === 401`; `mapErrorToReason` returns `'invalid_key'`
- `complete` — 5xx response → `.status >= 500`; `mapErrorToReason` returns `'server'`
- `validateKey` — ok and rejected cases

---

## Step 4 — Switch at runtime (future UI feature)

Once a provider-selector UI exists, it will call:

```js
import { setActiveProvider } from '../services/aiProvider.js';
setActiveProvider('anthropic');
```

All subsequent `aiService.complete()` and `aiService.validateKey()` calls will use the Anthropic provider. No feature code changes.

---

## Checklist

- [ ] `src/services/providers/<name>.js` created; sole export is `export const <name>Provider = { defaultModel, complete, validateKey }`
- [ ] `complete` errors use `createLlmError` and map correctly through `mapErrorToReason`; `validateKey` failures return `{ ok: false, reason }` with a standardized reason string
- [ ] Provider registered in `aiProvider.js` under a unique slug
- [ ] Tests added: happy path + all error branches
- [ ] `docs/REPO_MAP.md` updated
