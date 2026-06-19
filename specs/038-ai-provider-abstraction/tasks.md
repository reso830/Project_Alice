# Tasks: AI Provider Abstraction

**Feature**: `038-ai-provider-abstraction` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small and ordered. `[P]` marks tasks that can run in parallel with their siblings (different files, no shared edits). Commands: `npm run test:run`, `npm run lint`.

Status legend: `[x]` done · `[ ]` pending · `[~]` skipped.

Phase dependency: 01 → 02 → 03 → 04.

---

## Phase 01 — Provider infrastructure

**Purpose**: Create the four new modules (`aiErrors.js`, `providers/openrouter.js`, `aiProvider.js`, `aiService.js`) and their tests. Source files (`llmClient.js`, `llmParser.js`, `compatNotesService.js`) are untouched here — they continue to work as-is. Nothing breaks at the end of this phase.

---

### T001 `[ ]` — Create `src/services/aiErrors.js`

- **Target**: `src/services/aiErrors.js` (new file)
- **Expected behavior**:
  - Export `createLlmError(code, message, status)`: creates an `Error`, sets `.code = code` and, when `status` is provided, `.status = status`. Returns the error. Identical to the function currently in `src/services/llmClient.js` lines 6–13.
  - Export `mapErrorToReason(errorOrStatus)`: maps an error object or HTTP status integer to one of the standardized reason-code strings. Identical to the function currently in `src/services/llmClient.js` lines 15–53. Reason codes produced: `'timeout'`, `'network'`, `'invalid_key'`, `'quota'`, `'rate_limit'`, `'server'`, `'NO_TEXT'`.
  - No other exports. No imports.
- **Constraints**: This is the single source of truth for error utilities. Both `providers/openrouter.js` (T002) and `aiService.js` (T004) import from here. `llmClient.js` and all other existing files are NOT modified in this task.
- **Validation/test**: T005 covers `mapErrorToReason` spot-checks via `aiService.test.js`. No dedicated test file needed — functions are covered through their consumers.
- **Out of scope**: `aiProvider.js`, `providers/openrouter.js`, `aiService.js`, any existing file.

---

### T002 `[ ]` — Create `src/services/providers/openrouter.js`

- **Target**: `src/services/providers/openrouter.js` (new file; directory `src/services/providers/` must be created first)
- **Expected behavior**:
  - Import `{ createLlmError, mapErrorToReason }` from `'../aiErrors.js'`.
  - Define internal-only constants (not exported): `OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'`, `OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'`, `DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free'`, `LLM_TIMEOUT_MS = 30_000`, `MAX_INPUT_CHARS = 24_000`.
  - Define internal-only helper `parseAssistantJson(content)`: identical to the same function in `src/services/llmClient.js` lines 55–69.
  - Define `complete({ systemPrompt, userContent, key, model })`: identical logic to `requestChatCompletion` in `src/services/llmClient.js` lines 71–135, renamed. Returns `Promise<{ parsed: object, truncated: boolean }>`. Uses `createLlmError` and `mapErrorToReason` from `aiErrors.js`.
  - Define `validateKey(key)`: identical logic to `validateKey` in `src/services/llmParser.js` lines 240–271, including the `OPENROUTER_MODELS_URL` fetch. Returns `Promise<{ ok: boolean, reason?: string }>`.
  - **Export a single named aggregate object**: `export const openrouterProvider = { defaultModel: DEFAULT_MODEL, complete, validateKey }`. This is the only export from this file. The registry in `aiProvider.js` receives this object directly.
- **Constraints**: `src/services/llmClient.js` and `src/services/llmParser.js` are NOT modified in this task. The aggregate export (`openrouterProvider`) is required — flat named exports are not sufficient for the registry pattern used in T003.
- **Validation/test**: T005 adds tests for this file using `vi.stubGlobal('fetch', ...)`.
- **Out of scope**: `aiProvider.js`, `aiService.js`, any existing file.

---

### T003 `[ ]` — Create `src/services/aiProvider.js`

- **Target**: `src/services/aiProvider.js` (new file)
- **Expected behavior**:
  - Import `{ openrouterProvider }` from `'./providers/openrouter.js'`.
  - Maintain a `PROVIDERS` plain object: `{ openrouter: openrouterProvider }`.
  - Maintain a module-level `let activeSlug = 'openrouter'`.
  - Export `getActiveProvider()`: returns `PROVIDERS[activeSlug]`. Throws a structured `Error` (`'Unknown AI provider: <slug>'`) if the slug is not in `PROVIDERS`.
  - Export `setActiveProvider(slug)`: sets `activeSlug`. Throws if `slug` is not a key in `PROVIDERS`.
  - Export `resolveProvider(slug)`: returns `PROVIDERS[slug]`. Throws if not found. (Reserved for future multi-provider routing; not called by `aiService.js` in v1.)
  - Does **not** import from `src/data/aiSettings.js`.
- **Constraints**: No circular imports. `aiProvider.js` must not import from `aiSettings.js` directly or transitively.
- **Validation/test**: T006 covers delegation via mocked provider. Spot-check: `getActiveProvider()` returns `openrouterProvider` by default; `setActiveProvider('unknown')` throws.
- **Out of scope**: `aiService.js`, any existing file.

---

### T004 `[ ]` — Create `src/services/aiService.js`

- **Target**: `src/services/aiService.js` (new file)
- **Expected behavior**:
  - Import `{ getActiveProvider }` from `'./aiProvider.js'`.
  - Import `{ openrouterProvider }` from `'./providers/openrouter.js'` (only to source `DEFAULT_MODEL` in v1 — avoids a circular dependency with `aiSettings.js`).
  - Import `{ createLlmError, mapErrorToReason }` from `'./aiErrors.js'`.
  - Export `async function complete(params)`: delegates to `getActiveProvider().complete(params)` and returns the result.
  - Export `async function validateKey(key)`: delegates to `getActiveProvider().validateKey(key)` and returns the result.
  - Export `DEFAULT_MODEL`: `openrouterProvider.defaultModel` (v1 static string; `aiSettings.js` imports this without creating a circular dep since `aiService.js` does not import `aiSettings.js`).
  - Export `mapErrorToReason` and `createLlmError` re-exported from `'./aiErrors.js'`.
  - Export `REASON_CODES`: the frozen object mapping reason codes to UI copy — moved verbatim from `src/services/llmParser.js` lines 33–69.
  - Does **not** import from `src/data/aiSettings.js`.
- **Constraints**: `mapErrorToReason` and `createLlmError` come from `aiErrors.js`, not from the OpenRouter provider — providers are an implementation detail that `aiService.js` accesses only through `aiProvider.getActiveProvider()`. The one exception is the direct `openrouterProvider` import for `DEFAULT_MODEL`; this is a v1 pragmatic decision documented in `plan.md`. No circular dependency with `aiSettings.js`.
- **Validation/test**: T006.
- **Out of scope**: Modifying `llmClient.js`, `llmParser.js`, or any existing file.

---

### T005 `[ ]` [P] — Add `tests/services/providers/openrouter.test.js`

- **Target**: `tests/services/providers/openrouter.test.js` (new file; directory `tests/services/providers/` must be created)
- **Expected behavior**: Unit tests for `openrouterProvider` using `vi.stubGlobal('fetch', ...)`. Use `vi.resetModules()` + dynamic import (same pattern as `tests/services/llmParser.test.js`). Cover:
  - `openrouterProvider.complete` — happy path: valid JSON in `choices[0].message.content` → `{ parsed, truncated: false }`
  - `openrouterProvider.complete` — input longer than 24 000 chars → `truncated: true`, fetch called with clipped content
  - `openrouterProvider.complete` — blank `model` → falls back to `defaultModel`
  - `openrouterProvider.complete` — fetch AbortError → rejects with an error that `mapErrorToReason` maps to `'timeout'`
  - `openrouterProvider.complete` — fetch network rejection → reason maps to `'network'`
  - `openrouterProvider.complete` — HTTP 401 → reason maps to `'invalid_key'`
  - `openrouterProvider.complete` — HTTP 402 → reason maps to `'quota'`
  - `openrouterProvider.complete` — HTTP 429 → reason maps to `'rate_limit'`
  - `openrouterProvider.complete` — HTTP 500 → reason maps to `'server'`
  - `openrouterProvider.complete` — response content is not valid JSON → rejects
  - `openrouterProvider.validateKey` — `ok: true` response → `{ ok: true }`
  - `openrouterProvider.validateKey` — 401 response → `{ ok: false, reason: 'invalid_key' }`
  - `openrouterProvider.validateKey` — network error → `{ ok: false, reason: 'network' }`
  - `openrouterProvider.validateKey` — AbortError → match the existing `validateKey` timeout behavior in `llmParser.js` exactly
  - These `validateKey` cases are migrated from `tests/services/llmParser.test.js` so they live with the code they test.
- **Constraints**: Import `{ openrouterProvider }` by name — the file's sole export is the aggregate object. Do not import from `llmClient.js` or `llmParser.js`.
- **Validation/test**: `npm run test:run tests/services/providers/openrouter.test.js` — all cases green.
- **Out of scope**: `aiService.js`, `aiProvider.js`, any existing file.

---

### T006 `[ ]` [P] — Add `tests/services/aiService.test.js`

- **Target**: `tests/services/aiService.test.js` (new file)
- **Expected behavior**: Unit tests for `aiService.js`. Mock `aiProvider.js` with `vi.mock` to inject a fake provider object. Cover:
  - `complete` delegates to `getActiveProvider().complete(params)` and returns the result unchanged
  - `validateKey` delegates to `getActiveProvider().validateKey(key)` and returns the result unchanged
  - `DEFAULT_MODEL` is a non-empty string
  - `REASON_CODES` is exported and contains at least: `rate_limit`, `timeout`, `server`, `network`, `invalid_key`, `quota`, `NO_TEXT`
  - `mapErrorToReason` is exported and maps known inputs to correct reason strings (spot-check: `{ code: 'LLM_TIMEOUT' }` → `'timeout'`; `{ status: 401 }` → `'invalid_key'`; `{ status: 402 }` → `'quota'`)
  - `createLlmError('LLM_TIMEOUT', 'msg')` returns an `Error` with `.code === 'LLM_TIMEOUT'` and no `.status`
  - `createLlmError('LLM_PROVIDER_ERROR', 'msg', 429)` returns an `Error` with `.code` and `.status === 429`
- **Constraints**: Test at the service boundary — mock at `aiProvider.js`, not at `fetch`. Keep tests independent of OpenRouter internals.
- **Validation/test**: `npm run test:run tests/services/aiService.test.js` — all cases green.
- **Out of scope**: `providers/openrouter.js` internals (covered by T005).

---

**Checkpoint — Phase 01**: All new tests pass. `llmClient.js`, `llmParser.js`, and `compatNotesService.js` are untouched. Run `npm run test:run` — full suite must be green.

---

## Phase 02 — Feature migration

**Purpose**: Migrate `llmParser.js`, `compatNotesService.js`, `aiSettings.js`, and `Profile.js` to use `aiService.js`. Update impacted test files. Delete `llmClient.js`. After this phase no file imports from `llmClient.js` or calls `requestChatCompletion` directly.

---

### T007 `[ ]` — Update `src/services/llmParser.js`

- **Target**: `src/services/llmParser.js`
- **Expected behavior**:
  - Remove the import block from `'./llmClient.js'` (lines 3–9: `DEFAULT_MODEL`, `LLM_TIMEOUT_MS`, `createLlmError`, `mapErrorToReason`, `requestChatCompletion`).
  - Remove the re-export block from `'./llmClient.js'` (lines 11–16: `DEFAULT_MODEL`, `LLM_TIMEOUT_MS`, `MAX_INPUT_CHARS`, `mapErrorToReason`).
  - Remove `OPENROUTER_MODELS_URL` constant (line 18) — moved to `providers/openrouter.js`.
  - Remove `REASON_CODES` definition (lines 33–69) — moved to `aiService.js`.
  - Remove `validateKey` function (lines 240–271) — moved to `providers/openrouter.js`, exposed via `aiService.js`.
  - Add import from `'./aiService.js'`: `{ complete, DEFAULT_MODEL, createLlmError, mapErrorToReason, REASON_CODES }`.
  - In `parseWithLlm` (line 144): replace `requestChatCompletion({ text, key, model, systemPrompt })` with `complete({ userContent: text, key, model, systemPrompt })`.
  - In `parseJobWithLlm` (line 223): replace `requestChatCompletion({ text, key, model, systemPrompt })` with `complete({ userContent: text, key, model, systemPrompt })`.
  - Add re-exports for component backward-compatibility (so `ResumeImport.js` and `JobPostingImport.js` require no changes): `export { DEFAULT_MODEL, mapErrorToReason, REASON_CODES } from './aiService.js'`.
  - Drop `LLM_TIMEOUT_MS` and `MAX_INPUT_CHARS` re-exports — these are provider-internal constants. Tests that reference `llmParser.LLM_TIMEOUT_MS` and `llmParser.MAX_INPUT_CHARS` will be updated to use literal values `30_000` and `24_000` in T012 and T013.
- **Constraints**: `parseWithLlm` and `parseJobWithLlm` function signatures are unchanged. All prompt-building functions (`buildResumeSystemPrompt`, `buildJobSystemPrompt`) and response-parsing/normalization code (`normaliseProfile`, `buildJobDraft`, `hasExtractedData`, `hasUsableJobData`) are untouched. `ResumeImport.js` and `JobPostingImport.js` must not need any changes.
- **Validation/test**: `tests/services/llmParser.test.js` — all parse cases pass (fetch stubs still intercept because the call chain reaches `providers/openrouter.js` which uses `globalThis.fetch`). `validateKey` test cases will fail until T012 removes them.
- **Out of scope**: `compatNotesService.js`, `aiSettings.js`, `Profile.js`, any component file.

---

### T008 `[ ]` — Update `src/services/compatNotesService.js`

- **Target**: `src/services/compatNotesService.js`
- **Expected behavior**:
  - Remove import from `'./llmClient.js'` (lines 1–5: `mapErrorToReason`, `requestChatCompletion`).
  - Add import from `'./aiService.js'`: `{ complete, mapErrorToReason }`.
  - In `generateNotes` (line 119): replace `requestChatCompletion({ key: aiSettings?.getKey?.(), model: aiSettings?.getModel?.(), systemPrompt, userContent })` with `complete({ key: aiSettings?.getKey?.(), model: aiSettings?.getModel?.(), systemPrompt, userContent })`.
  - Preserve re-export of `mapErrorToReason`: `export { mapErrorToReason } from './aiService.js'`.
- **Constraints**: `generateNotes` signature is unchanged. All prompt-building (`buildCompatSystemPrompt`, `buildCompatUserContent`), skill formatting, and response normalization (`normalizeNotes`) code is untouched. `CompatibilityModule.js` must not need any changes.
- **Validation/test**: `tests/services/compatNotesService.test.js` — will fail until T011 updates the mock. Run T011 immediately after.
- **Out of scope**: `llmParser.js`, `aiSettings.js`, `Profile.js`.

---

### T009 `[ ]` — Update `src/data/aiSettings.js`

- **Target**: `src/data/aiSettings.js`
- **Expected behavior**:
  - Change line 1: `import { DEFAULT_MODEL } from '../services/llmParser.js'` → `import { DEFAULT_MODEL } from '../services/aiService.js'`.
  - No other changes. `DEFAULT_MODEL` value is unchanged (`'meta-llama/llama-3.3-70b-instruct:free'`), so all storage migration logic and fallback behavior is identical.
- **Constraints**: One-line change only.
- **Validation/test**: `tests/data/aiSettings.test.js` — all existing tests must pass without modification. The `aiSettings.DEFAULT_MODEL` assertions check the string value, which is unchanged.
- **Out of scope**: Everything else.

---

### T010 `[ ]` — Update `src/pages/Profile.js`

- **Target**: `src/pages/Profile.js`
- **Expected behavior**:
  - Change line 18: `import { validateKey } from '../services/llmParser.js'` → `import { validateKey } from '../services/aiService.js'`.
  - No other changes. The `validateKey(aiSettings.getKey())` call on line 1054 is unchanged.
- **Constraints**: One-line change only.
- **Validation/test**: `tests/pages/profile.aiSettings.test.js` — will fail until T014 updates the mock. Run T014 immediately after.
- **Out of scope**: Everything else.

---

### T011 `[ ]` — Update `tests/services/compatNotesService.test.js`

- **Target**: `tests/services/compatNotesService.test.js`
- **Expected behavior**:
  - Change the `vi.hoisted` mock object (lines 3–6): rename `requestChatCompletion` → `complete`.
  - Change the `vi.mock` path (line 8): `'../../src/services/llmClient.js'` → `'../../src/services/aiService.js'`.
  - Update all references in test bodies from `llmClientMock.requestChatCompletion` → `llmClientMock.complete`.
  - `mapErrorToReason` mock remains on the same object — it is still re-exported from `aiService.js` so the mock covers it.
- **Constraints**: Test logic and assertions are unchanged. Only the mock target path and function name change.
- **Validation/test**: `npm run test:run tests/services/compatNotesService.test.js` — all existing cases green.
- **Out of scope**: Any other test file.

---

### T012 `[ ]` — Update `tests/services/llmParser.test.js`

- **Target**: `tests/services/llmParser.test.js`
- **Expected behavior**:
  - Remove the `validateKey` describe block (lines ~160–212). These tests now live in `tests/services/providers/openrouter.test.js` (T005).
  - Replace `llmParser.MAX_INPUT_CHARS` with the literal `24_000` (two occurrences: the `repeat()` argument and the `toHaveLength()` assertion).
  - Replace `llmParser.LLM_TIMEOUT_MS` with the literal `30_000` in the `vi.advanceTimersByTimeAsync` call.
  - All remaining parse test cases use `vi.stubGlobal('fetch', ...)` and continue to work — the call chain reaches `providers/openrouter.js` which still uses `globalThis.fetch`.
- **Constraints**: Do not change fetch-stub logic or any parse test assertions beyond the constant replacements above. `LLM_TIMEOUT_MS` and `MAX_INPUT_CHARS` are now provider-internal; tests must not import them as public API.
- **Validation/test**: `npm run test:run tests/services/llmParser.test.js` — all remaining cases green.
- **Out of scope**: `llmParser.jd.test.js` (see T013).

---

### T013 `[ ]` — Update `tests/services/llmParser.jd.test.js`

- **Target**: `tests/services/llmParser.jd.test.js`
- **Expected behavior**:
  - Replace `llmParser.MAX_INPUT_CHARS` with the literal `24_000` (two occurrences: the `repeat()` argument and the `toHaveLength()` assertion, lines ~168 and ~171).
  - Replace `llmParser.LLM_TIMEOUT_MS` with the literal `30_000` in the `vi.advanceTimersByTimeAsync` call (line ~249).
  - All other test logic and assertions are unchanged. The call chain after T007 goes `llmParser.js → aiService.js → aiProvider.js → providers/openrouter.js → globalThis.fetch`, so fetch stubs still intercept correctly.
- **Constraints**: Do not change fetch-stub logic or any other test assertions. Only replace the two constant references with their literal values.
- **Validation/test**: `npm run test:run tests/services/llmParser.jd.test.js` — green.
- **Out of scope**: Any logic change beyond the constant replacements.

---

### T014 `[ ]` — Update `tests/pages/profile.aiSettings.test.js`

- **Target**: `tests/pages/profile.aiSettings.test.js`
- **Expected behavior**:
  - Change the `vi.mock` path (line 27): `'../../src/services/llmParser.js'` → `'../../src/services/aiService.js'`.
  - The mock object `{ validateKey: vi.fn() }` is unchanged.
  - Optionally rename the local `llmParser` variable to `aiService` for clarity.
- **Constraints**: Test logic and assertions are unchanged. Only the mock path changes.
- **Validation/test**: `npm run test:run tests/pages/profile.aiSettings.test.js` — all existing cases green.
- **Out of scope**: Any other test file.

---

### T015 `[ ]` — Delete `src/services/llmClient.js`

- **Target**: `src/services/llmClient.js` (delete)
- **Expected behavior**:
  - Before deleting, grep for any remaining `llmClient` references: `grep -r "llmClient" src/ tests/`. Confirm zero results.
  - Delete the file.
  - Run `npm run test:run` — full suite green.
- **Constraints**: This task runs last in Phase 02, after T007–T014 are all complete.
- **Validation/test**: `npm run test:run` — green. `grep -r "llmClient" src/ tests/` returns zero results.
- **Out of scope**: Everything else.

---

**Checkpoint — Phase 02**: Full test suite green. Run these greps to confirm clean migration:
```
grep -r "llmClient"             src/ tests/   # must return zero results
grep -r "requestChatCompletion" src/ tests/   # must return zero results
grep -r "OPENROUTER_URL"        src/ tests/   # must appear only in providers/openrouter.js
```

---

## Phase 03 — Release Prep

### T016 `[ ]` — Release Prep

- **Targets**: `package.json`, `package-lock.json`, `CHANGELOG.md`, `docs/REPO_MAP.md`, `docs/feature_roadmap.md`
- **Expected behavior**:
  - Bump version in `package.json` (patch increment). Sync `package-lock.json` root version to match.
  - Add CHANGELOG entry under a new version heading. Summary: internal AI Provider Abstraction Layer — decouples AI features from OpenRouter; establishes provider interface for future provider support. No user-facing changes.
  - `docs/REPO_MAP.md`: add entries for `src/services/providers/` (new directory), `src/services/providers/openrouter.js`, `src/services/aiErrors.js`, `src/services/aiProvider.js`, `src/services/aiService.js`; mark `src/services/llmClient.js` as removed.
  - `docs/feature_roadmap.md`: mark feature 038 as complete.
  - `README.md`: no update required (no user-facing surface changed).
  - `docs/deployment.md`: no update required (no new env vars or runtime modes).
  - Run `npm run lint` — clean.
- **Constraints**: No code changes. Docs only.
- **Validation/test**: `npm run test:run` — still green after docs changes. `npm run lint` clean.
- **Out of scope**: Code changes, new features.

---

## Phase 04 — Browser Smoke Test

### T017 `[ ]` — Browser smoke test

**Purpose**: Confirm the three migrated AI features work correctly against a real OpenRouter key after all code changes are merged.

- **Pre-condition**: Local server running. A valid OpenRouter API key configured in Settings.

**Story 1 — Resume Import (033)**
- Open Profile → AI Settings → confirm key shows Connected.
- Navigate to Resume Import → upload or paste a PDF/text resume.
- Confirm: parse completes, profile fields populate correctly. No console errors.

**Story 2 — Job Description Parser (035)**
- Open the Create Application modal → Job Description Import tab.
- Paste a job posting text.
- Confirm: parse completes, application draft fields populate correctly. No console errors.

**Story 3 — Compatibility Notes (037)**
- Open an existing application with a non-zero compat score and a loaded profile.
- Expand the Compatibility Panel → click "Generate notes".
- Confirm: generation spinner appears, notes render (summary + body). No console errors.

**Story 4 — Key validation**
- Open Profile → AI Settings → enter an invalid key → click Test.
- Confirm: error status shown.
- Restore valid key → click Test → Connected status shown.

**Story 5 — Error passthrough**
- Temporarily set an invalid model slug in Settings.
- Trigger Resume Import parse.
- Confirm: error state displayed in UI (no crash, no unhandled rejection).

- **Validation**: All five stories pass. Browser console is free of unhandled errors during each story.
- **Out of scope**: Testing with a real second provider.
