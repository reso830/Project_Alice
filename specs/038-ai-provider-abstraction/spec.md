# Feature Specification: AI Provider Abstraction

**Feature Branch**: `038-ai-provider-abstraction`
**Created**: 2026-06-19
**Status**: Draft
**Input**: Feature brief `docs/features/038-ai-provider-abstraction.md`

---

## Clarifications

### Session 2026-06-19

- Q: How should provider selection work — compile-time or runtime? → A: **Runtime-switchable.** A dedicated provider-selector UI is planned for a future feature. For v1, the configured provider always resolves to OpenRouter, but the architecture must support runtime resolution so the future UI only needs to add a setting and a second provider implementation.
- Q: Should `validateKey` be in the provider interface? → A: **Yes.** Cloud providers must implement it. Self-hosted / local providers (e.g. Ollama) that have no API key concept may stub it as `{ ok: true }` — this is explicitly permitted for local models only.
- Q: Should the error code contract be new or formalize existing codes? → A: **Formalize existing.** The current reason codes (`timeout`, `network`, `invalid_key`, `quota`, `rate_limit`, `server`, `NO_TEXT`) become the official contract output. Each provider implementation maps its own errors to these codes.
- Q: Should LLM calls move to the server side? → A: **No, deferred.** Client-side for 038. Hosted-mode API key security (server-proxied calls + per-user key storage) is a meaningful improvement, particularly in hosted mode, but is deferred to a dedicated future feature.

---

## Problem Statement

Alice's three AI-powered features — Resume Import (033), Job Description Parser (035), and Compatibility Insights Panel (037) — call the LLM provider through direct references to `llmClient.js` and `llmParser.js`. These modules embed OpenRouter-specific details throughout: the endpoint URL, request body format, HTTP status-to-reason-code mapping, and model slug convention are all OpenRouter-specific and shared as utilities across feature code.

As Alice introduces additional AI features, this coupling will spread further. Changing providers — or supporting a second — would require modifying every feature that touches AI. This feature establishes a stable internal contract between application features and AI infrastructure before the next wave of AI features is built.

---

## Scope

**In scope**

- Define a **provider interface** specifying the operations all AI provider implementations must expose
- Implement a **central AI service** that all features call; it resolves the active provider at runtime and delegates to it
- Migrate the existing OpenRouter code into a **provider implementation** conforming to the interface
- Migrate the following features to consume the AI service layer exclusively:
  - Resume Import (033): `parseWithLlm`
  - Job Description Parser (035): `parseJobWithLlm`
  - Compatibility Insights Panel (037): `generateNotes`
- Migrate key validation (`validateKey`) into the OpenRouter provider implementation; expose it through the AI service
- Formalize the existing reason codes as the standardized error output contract all providers must map to
- Structure provider resolution so a future runtime provider-selector can swap the active provider without modifying the service or any feature

**Non-goals**

- Provider-selector UI or user-facing provider configuration
- User-provided API keys for alternative providers
- Multiple simultaneous active providers
- Runtime provider switching (architecture must support it; the switch itself is future work)
- Changes to AI feature behavior, prompts, or output shapes
- Moving LLM calls to the server side (deferred; see Security Note)
- AI usage analytics, cost tracking, or routing strategies
- New AI operations, prompts, or models

---

## Provider Interface Contract

The provider interface defines the operations every provider implementation must expose. The OpenRouter implementation must conform to it; every future provider must also conform before it can be registered.

### `complete({ systemPrompt, userContent, key, model })`

Sends a chat completion request and returns a structured result.

- **`systemPrompt`** `string` — the instruction prompt
- **`userContent`** `string` — the user content (resume text, job description, compat context)
- **`key`** `string` — the API key for this provider
- **`model`** `string` — the model slug; providers must fall back to their own default when empty or blank
- **Returns** `Promise<{ parsed: object, truncated: boolean }>`
  - `parsed` is a plain JSON object; the provider must extract it from whatever envelope the backend returns
  - `truncated` is `true` when the input was clipped to fit the provider's input limit

### `validateKey(key)`

Confirms that the given API key is accepted by the provider.

- **Required** for cloud providers (OpenRouter and any future cloud-hosted integration)
- **Optional / stubbable** for self-hosted and local providers (e.g. Ollama) that have no API key concept — these may return `{ ok: true }` unconditionally; this is explicitly permitted for local models only
- **Returns** `Promise<{ ok: boolean, reason?: string }>` — `reason` is a standardized reason code when `ok` is `false`

### Standardized Error Contract

All provider implementations must map their internal errors to these reason codes before surfacing them to the AI service or callers. Provider-specific exceptions (HTTP status codes, SDK errors, provider error envelopes) must not propagate beyond the provider implementation.

| Reason code | Meaning |
|---|---|
| `timeout` | Request exceeded the allowed duration |
| `network` | Network-level failure before a response was received |
| `invalid_key` | API key rejected (e.g. HTTP 401 / 403) |
| `quota` | Account balance exhausted (e.g. HTTP 402) |
| `rate_limit` | Too many requests (e.g. HTTP 429) |
| `server` | Provider-side server error (e.g. HTTP 5xx) |
| `NO_TEXT` | Input contained no machine-readable content |

These codes are the formalized version of the existing reason codes already used by `mapErrorToReason` and `REASON_CODES`. No new codes are introduced.

---

## AI Service Layer

A single AI service module sits between application features and provider implementations. Features must not reference any provider module directly.

**Responsibilities:**

- Resolve the active provider from application configuration at call time
- Delegate `complete` and `validateKey` to the resolved provider
- Return the provider's result or reason-coded error to the caller unchanged
- Remain ignorant of which provider is active or how it communicates with its backend

**Provider resolution — v1 behavior:**

In v1 the active provider always resolves to the OpenRouter implementation. The resolution mechanism must be structured — via `aiSettings.js` or an equivalent config layer — so that a future feature adding a provider-selector setting can register a second provider and make it active without restructuring the service or migrating callers again.

---

## Migration Requirements

After migration the following must hold:

- `parseWithLlm`, `parseJobWithLlm`, and `generateNotes` call only the AI service — no direct calls to `llmClient.js` or any OpenRouter endpoint remain in feature code
- `validateKey` is called through the AI service — no direct calls to OpenRouter's `/api/v1/models` endpoint remain in feature code or settings modules
- `aiSettings.js` does not import `DEFAULT_MODEL`, `LLM_TIMEOUT_MS`, or any other constant from provider-specific modules; these become internal to the OpenRouter implementation
- No existing prompt text, response-parsing logic, or output normalization is modified; the migration is transport-only

---

## User Scenarios (Developer-Facing)

This is an infrastructure feature. All stories are developer-facing. End-user behavior is unchanged.

### Story 1 — Features call a stable internal API

As a developer implementing an AI feature, I call `aiService.complete(...)` and receive a structured result with no knowledge of which provider is active.

**Acceptance scenarios:**

1. **Given** Resume Import calls `aiService.complete(...)`, **When** the active provider returns a valid response, **Then** the parsed profile is identical to what `parseWithLlm` returned before migration.
2. **Given** Job Description Parser calls `aiService.complete(...)`, **When** the active provider returns a valid response, **Then** the parsed job draft is identical to before migration.
3. **Given** Compatibility Insights Panel calls `aiService.complete(...)`, **When** the active provider returns a valid response, **Then** the generated notes are identical to before migration.

### Story 2 — Errors surface as standardized reason codes

As a developer, when an AI call fails, I receive a reason code from the standardized contract regardless of provider.

**Acceptance scenarios:**

1. **Given** the provider times out, **When** `aiService.complete(...)` rejects, **Then** passing the error through `mapErrorToReason` returns `'timeout'`.
2. **Given** the API key is invalid, **When** `aiService.complete(...)` rejects, **Then** `mapErrorToReason(error)` returns `'invalid_key'`; **When** `aiService.validateKey(...)` returns `ok: false`, **Then** `result.reason === 'invalid_key'`.
3. **Given** an HTTP 402 response from OpenRouter, **When** the error surfaces to the caller, **Then** `mapErrorToReason(error)` returns `'quota'` — not an HTTP status code or provider-specific message.

### Story 3 — Provider is swappable without feature changes

As a developer, when a new provider implementation is registered and set as the active provider, existing AI features work without modification.

**Acceptance scenarios:**

1. **Given** a second provider implementation is registered, **When** it is set as the active provider in configuration, **Then** Resume Import, Job Description Parser, and Compatibility Insights Panel all use it without code changes in those features.
2. **Given** a self-hosted local provider, **When** `aiService.validateKey(...)` is called, **Then** the provider may return `{ ok: true }` unconditionally — callers must handle this as a valid response.

---

## Edge Cases

- **No key configured**: `aiService.complete(...)` called with an empty key — the provider must throw a `createLlmError`-created error that `mapErrorToReason` maps to `'invalid_key'`, not an unstructured exception.
- **Blank model string**: must fall back to the provider's default model (currently `meta-llama/llama-3.3-70b-instruct:free`); behavior unchanged from today.
- **Input truncation**: inputs exceeding the provider's character limit are silently clipped; the `truncated: true` flag is the caller's only signal — this must be preserved post-migration.
- **Unknown provider slug**: if provider resolution cannot match the configured slug (relevant once multiple providers exist), the service must throw a structured error, not a silent fallback or runtime crash.
- **Provider interface not fully implemented**: a provider missing a required operation must fail loudly at registration time, not silently at call time.

---

## Data Considerations

No changes to persisted data. No new database columns, API routes, or server-side logic. The abstraction is entirely within the client-side services layer (`src/services/`).

`DEFAULT_MODEL` (currently `meta-llama/llama-3.3-70b-instruct:free`) remains unchanged as the fallback when no model is configured. Its source of truth moves from `llmClient.js` / `llmParser.js` into the OpenRouter provider implementation; it is no longer a public export consumed by `aiSettings.js` or feature code.

---

## Acceptance Criteria

### Architecture

- [ ] A provider interface exists defining `complete` and `validateKey` operations and the standardized error contract
- [ ] A central AI service module exists; application features interact with it exclusively
- [ ] The OpenRouter implementation conforms to the provider interface
- [ ] Provider-specific details (endpoint URL, request format, HTTP status mapping, model slug format) are isolated within the OpenRouter implementation
- [ ] Provider resolution is runtime-configurable; v1 always resolves to OpenRouter

### Migration

- [ ] Resume Import (`parseWithLlm`) uses only the AI service layer — no direct provider calls remain
- [ ] Job Description Parser (`parseJobWithLlm`) uses only the AI service layer — no direct provider calls remain
- [ ] Compatibility Insights Panel (`generateNotes`) uses only the AI service layer — no direct provider calls remain
- [ ] `validateKey` is invoked through the AI service — no direct provider endpoint calls remain in feature or settings code
- [ ] `aiSettings.js` does not import constants from provider-specific modules

### Compatibility

- [ ] All three migrated AI features produce functionally identical outputs after migration
- [ ] Existing prompts are unchanged
- [ ] Existing error reason codes and the UI copy that depends on them (`REASON_CODES`) are unaffected
- [ ] `truncated` flag behavior is preserved

### Extensibility

- [ ] A second provider can be added by creating an implementation and updating provider configuration — no changes required in migrated features
- [ ] Self-hosted / local providers may stub `validateKey` as always-valid — documented and permitted by the interface contract

---

## Security Note

Moving LLM calls to the server side — so the API key never reaches the browser and is instead stored per-user in Supabase and used only from the Vercel backend — is a meaningful security improvement, particularly in hosted mode. This is explicitly out of scope for 038 and is deferred to a dedicated future feature. The abstraction built here directly enables that migration: once all features call through the AI service, the service's transport can be replaced with a server-proxied implementation without touching any feature code.
