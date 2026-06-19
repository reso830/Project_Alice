# Implementation Plan: AI Provider Abstraction

**Branch**: `038-ai-provider-abstraction` | **Date**: 2026-06-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/038-ai-provider-abstraction/spec.md`

---

## Summary

A transport-only refactor. No prompts, no response shapes, no data schema, and no user-facing behavior change. The existing OpenRouter HTTP logic (`llmClient.js`) is migrated into a provider implementation that conforms to a new provider interface. A thin AI service facade (`aiService.js`) replaces all direct references to `llmClient.js` in the three feature services and in settings. The provider registry in `aiProvider.js` is designed for runtime provider switching; v1 always resolves to OpenRouter.

---

## Technical Context

**Language/Version**: Node.js (ESM), Vanilla JS frontend (Vite), Express backend
**Primary Dependencies**: No new dependencies
**Storage**: No schema changes
**Testing**: Vitest (`tests/services`, `tests/pages`, `tests/data`)
**Target Platform**: Browser (client-side services only; server is untouched)
**Constraints**: Migration is transport-only — prompts, parsing, normalization, and error copy are frozen

---

## Constitution Check

- **Business logic separated from UI** — prompt-building and response-parsing stay in `llmParser.js` and `compatNotesService.js`; OpenRouter HTTP details move to the provider; the service facade is the boundary. ✅
- **Validation / no silent corruption** — existing error codes, timeout behavior, and input truncation are preserved exactly. ✅
- **Automated tests** — existing fetch-stub–based tests in `llmParser.test.js` continue to work unchanged; `compatNotesService.test.js` mock path updates; new unit tests for the provider and service are added. ✅
- **Privacy / local-first** — AI key stays in `localStorage`, used client-side. No change to key handling. ✅
- **Lint**: `npm run lint` (no `format` script exists in this project).
- **Simple, readable code over clever abstractions** — provider registry is a plain object; no class hierarchies; no dynamic imports. ✅

No constitution violations.

---

## Architecture

### Module layout: before → after

```
BEFORE                                  AFTER
──────────────────────────────────────  ─────────────────────────────────────────
src/services/
  llmClient.js          ← DELETED       src/services/
  llmParser.js          ← MODIFIED        aiErrors.js       ← NEW (shared error utilities)
  compatNotesService.js ← MODIFIED        providers/
                                            openrouter.js   ← NEW (absorbs llmClient.js)
src/data/                                 aiProvider.js     ← NEW (registry + resolution)
  aiSettings.js         ← MODIFIED        aiService.js      ← NEW (public facade)
                                          llmParser.js      ← MODIFIED
src/pages/                                compatNotesService.js ← MODIFIED
  Profile.js            ← MODIFIED
                                        src/data/
                                          aiSettings.js     ← MODIFIED

                                        src/pages/
                                          Profile.js        ← MODIFIED
```

### New modules

**`src/services/aiErrors.js`** — shared error utilities

Single source of truth for `createLlmError` and `mapErrorToReason`. Imported by both `providers/openrouter.js` (to throw structured errors) and `aiService.js` (to re-export to callers). Keeping these here avoids a circular dependency: if they lived inside `providers/openrouter.js`, `aiService.js` would need to import from the provider directly, coupling the facade to a specific implementation.

```
Exports:
  createLlmError(code, message, status?): Error
  mapErrorToReason(errorOrStatus): string   ← one of the standardized reason codes
```

No imports of its own.

---

**`src/services/providers/openrouter.js`** — OpenRouter provider implementation

Imports `createLlmError` and `mapErrorToReason` from `aiErrors.js`. Absorbs the HTTP transport from `llmClient.js` plus `validateKey` from `llmParser.js`. Exports a **single named aggregate object** — the registry in `aiProvider.js` stores provider objects, not flat exports.

```
export const openrouterProvider = { defaultModel, complete, validateKey }

  defaultModel: 'meta-llama/llama-3.3-70b-instruct:free'
  complete({ systemPrompt, userContent, key, model }): Promise<{ parsed, truncated }>
  validateKey(key): Promise<{ ok, reason? }>
```

Internal-only (not exported): `OPENROUTER_URL`, `OPENROUTER_MODELS_URL`, `LLM_TIMEOUT_MS`, `MAX_INPUT_CHARS`, `parseAssistantJson`.

**`src/services/aiProvider.js`** — provider registry

A plain object registry. On module load, the OpenRouter provider is registered as the only entry and set as the active provider. Exports `setActiveProvider` and `getActiveProvider` for future runtime switching. No dependency on `aiSettings.js` (avoids circular dep).

```
PROVIDERS = { openrouter: openrouterProvider }
activeSlug = 'openrouter'

Exports:
  getActiveProvider(): provider
  setActiveProvider(slug): void   ← for future provider-selector UI
  resolveProvider(slug): provider ← throws if slug unknown
```

**`src/services/aiService.js`** — public facade

All application code imports from here. Delegates `complete` and `validateKey` to the active provider via `aiProvider.getActiveProvider()`. Re-exports `createLlmError`, `mapErrorToReason` from `aiErrors.js` and `REASON_CODES` (moved from `llmParser.js`). Does **not** import from `aiSettings.js` (no circular dependency).

```
Exports:
  complete(params): Promise<{ parsed, truncated }>
  validateKey(key): Promise<{ ok, reason? }>
  DEFAULT_MODEL: string          ← openrouterProvider.defaultModel (v1 static; avoids circular dep)
  createLlmError(code, msg, s?): Error   ← re-exported from aiErrors.js
  mapErrorToReason(e): string    ← re-exported from aiErrors.js
  REASON_CODES: object           ← moved here from llmParser.js
```

Imports: `aiProvider.js`, `providers/openrouter.js` (only for `DEFAULT_MODEL` in v1), `aiErrors.js`. Does **not** import `aiSettings.js`.

### Modified modules

**`src/services/llmParser.js`**

- Replace: `requestChatCompletion({ ... })` → `aiService.complete({ ... })`
- Remove: `validateKey` export (moves to `aiService.js`)
- Update import block: `from './llmClient.js'` → `from './aiService.js'`
- Re-export `DEFAULT_MODEL`, `mapErrorToReason`, `REASON_CODES` from `aiService.js` for backward compatibility with components that currently import them from here (`ResumeImport.js`, `JobPostingImport.js`)
- No changes to prompt-building functions, response-parsing logic, or output shapes

**`src/services/compatNotesService.js`**

- Replace: `requestChatCompletion({ ... })` → `aiService.complete({ ... })`
- Update import: `from './llmClient.js'` → `from './aiService.js'`
- Re-export `mapErrorToReason` from `aiService.js` (currently re-exported from llmClient)
- No changes to prompt-building, skill-match formatting, or response normalization

**`src/data/aiSettings.js`**

- Change `DEFAULT_MODEL` import: `from '../services/llmParser.js'` → `from '../services/aiService.js'`
- No other changes; key/model/feature-flag logic is untouched

**`src/pages/Profile.js`**

- Change `validateKey` import: `from '../services/llmParser.js'` → `from '../services/aiService.js'`
- `validateKey` is not a parsing function; importing it directly from the service is the correct boundary
- No other changes

---

## Data Flow

```
ResumeImport.js
  parseWithLlm(text, key, model)
    → llmParser.js
    → aiService.complete({ systemPrompt, userContent: text, key, model })
    → aiProvider.getActiveProvider()          ← resolves openrouterProvider
    → openrouterProvider.complete(...)
    → fetch(OPENROUTER_URL)

JobPostingImport.js
  parseJobWithLlm(text, key, model)
    → llmParser.js
    → aiService.complete(...)
    → (same path)

CompatibilityModule.js
  generateNotes(application, profile, aiSettings)
    → compatNotesService.js
    → aiService.complete({ systemPrompt, userContent, key, model })
    → (same path)

Profile.js
  aiService.validateKey(key)
    → aiProvider.getActiveProvider()
    → openrouterProvider.validateKey(key)
    → fetch(OPENROUTER_MODELS_URL)
```

---

## Design Decisions

### No circular dependency between `aiService.js` and `aiSettings.js`

`aiSettings.js` imports `DEFAULT_MODEL` from `aiService.js`. To avoid a cycle, `aiService.js` must **not** import from `aiSettings.js`. Provider resolution in v1 is handled by `aiProvider.js` which reads its own module-level `activeSlug` (not from settings). When the future provider-selector UI lands, it will call `aiProvider.setActiveProvider(slug)` on startup (reading from storage itself) — `aiService.js` still won't need to import `aiSettings.js`.

### `validateKey` moves to `aiService.js`, not re-exported from `llmParser.js`

`validateKey` is not a parse operation. Keeping it in `llmParser.js` as a re-export would leave a misleading public surface. `Profile.js` updates its import to `aiService.js` directly.

### `REASON_CODES` moves to `aiService.js`

It is the UI-facing error contract for all AI operations, not a parser-specific concern. `llmParser.js` re-exports it from `aiService.js` so `ResumeImport.js` and `JobPostingImport.js` need no import changes.

### No feature component changes

`ResumeImport.js`, `JobPostingImport.js`, and `CompatibilityModule.js` do not need to change. They call parse/generate functions that are internally updated. Error utilities they import from `llmParser.js` are re-exported there from `aiService.js`.

### `llmClient.js` is deleted

Its content is fully absorbed into `providers/openrouter.js`. No re-export bridge is kept — any remaining direct import of `llmClient.js` is a bug to fix, not compat to preserve.

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Test mock path breakage (`compatNotesService.test.js` mocks `llmClient.js`) | Certain — intentional change | Update mock to `aiService.js`; run tests in Phase 2 before moving on |
| `profile.aiSettings.test.js` mocks `llmParser.js` for `validateKey` | Certain — intentional change | Update mock to `aiService.js` when Profile.js import is updated |
| `validateKey` tests in `llmParser.test.js` become orphaned after validateKey moves | Certain | Move validateKey tests to `providers/openrouter.test.js` in Phase 2 |
| Accidental behavior change in parse functions | Low — transport-only | All existing parse + compat-notes tests continue to assert on output; run full suite after each phase |
| Fetch-stub–based tests break | Low — fetch path unchanged | `llmParser.test.js` / `llmParser.jd.test.js` stub `globalThis.fetch`; the provider still uses `globalThis.fetch`, so stubs still intercept |
| Hidden import of `llmClient.js` missed | Low — grep confirms only 2 importers | Delete `llmClient.js` at end of Phase 2, after all migration tasks complete; CI will surface any missed reference |

---

## Validation Approach

- After Phase 1: `aiService.js` + `openrouterProvider` unit tests pass with fetch stubs; existing test suite remains green (`llmClient.js` still present and untouched)
- After Phase 2: Full test suite passes; `llmClient.js` deleted; no direct `llmClient.js` or `requestChatCompletion` references remain in feature or test code
- Smoke test: Resume Import, JD Parser, and Compat Notes generation all function correctly against a real OpenRouter key in a local browser session

---

## Phases

### Phase 1 — Provider infrastructure

1. Create `src/services/aiErrors.js` — `createLlmError` and `mapErrorToReason` (moved from `llmClient.js`); no imports
2. Create `src/services/providers/openrouter.js` — imports from `aiErrors.js`; exports `openrouterProvider = { defaultModel, complete, validateKey }` aggregate
3. Create `src/services/aiProvider.js` — registry (`{ openrouter: openrouterProvider }`), active-slug state, `getActiveProvider` / `setActiveProvider`
4. Create `src/services/aiService.js` — delegates to `getActiveProvider()`; re-exports `createLlmError`, `mapErrorToReason` from `aiErrors.js`; exports `REASON_CODES` (moved from `llmParser.js`)
5. Add `tests/services/providers/openrouter.test.js` — unit tests for `openrouterProvider.complete` and `openrouterProvider.validateKey` with fetch stubs
6. Add `tests/services/aiService.test.js` — delegation tests with mocked `aiProvider.js`

### Phase 2 — Feature migration

1. Update `src/services/llmParser.js`
   - Replace `requestChatCompletion` calls with `aiService.complete()`
   - Remove `validateKey` export
   - Update imports; add re-exports for `DEFAULT_MODEL`, `mapErrorToReason`, `REASON_CODES` from `aiService.js`
2. Update `src/services/compatNotesService.js`
   - Replace `requestChatCompletion` call with `aiService.complete()`
   - Update imports
3. Update `src/data/aiSettings.js` — `DEFAULT_MODEL` import from `aiService.js`
4. Update `src/pages/Profile.js` — `validateKey` import from `aiService.js`
5. Update `tests/services/compatNotesService.test.js` — mock `aiService.js` instead of `llmClient.js`
6. Update `tests/services/llmParser.test.js` — move `validateKey` tests to `openrouter.test.js`; remaining parse tests should pass as-is (fetch stubs unchanged)
7. Update `tests/pages/profile.aiSettings.test.js` — mock `aiService.js` instead of `llmParser.js` for `validateKey`
8. Inspect `tests/data/aiSettings.test.js` — verify `DEFAULT_MODEL` assertions still pass (value is unchanged)
9. Run full test suite; confirm zero failures

### Phase 3 — Release Prep

- Version bump (`package.json`, `package-lock.json`)
- CHANGELOG entry
- README update if needed
- `docs/REPO_MAP.md` — add new files (`aiErrors.js`, `providers/openrouter.js`, `aiProvider.js`, `aiService.js`); mark `llmClient.js` removed
- `docs/feature_roadmap.md` — tick 038
- Docs sanity check

### Phase 4 — Browser Smoke Test

- Load app in local browser against a real OpenRouter key
- Resume Import: upload a PDF resume → parse succeeds, profile fields populate
- JD Parser: paste a job posting → parse succeeds, draft populates
- Compat Notes: open an application with a profile → generate notes → notes display correctly
- Settings: test a valid key → Connected; test an invalid key → error shown

---

## Affected Areas

### New files
- `src/services/aiErrors.js`
- `src/services/providers/openrouter.js`
- `src/services/aiProvider.js`
- `src/services/aiService.js`
- `tests/services/providers/openrouter.test.js`
- `tests/services/aiService.test.js`

### Modified
- `src/services/llmParser.js` — import changes + re-exports; validateKey removed
- `src/services/compatNotesService.js` — import + call site change
- `src/data/aiSettings.js` — DEFAULT_MODEL import source
- `src/pages/Profile.js` — validateKey import source
- `tests/services/compatNotesService.test.js` — mock path: llmClient.js → aiService.js
- `tests/services/llmParser.test.js` — validateKey tests relocated
- `tests/pages/profile.aiSettings.test.js` — mock path: llmParser.js → aiService.js
- `tests/data/aiSettings.test.js` — inspect only; likely no change needed

### Deleted
- `src/services/llmClient.js`

### Out of scope
- All server-side code (`server/`)
- `src/components/ResumeImport.js` — no changes needed
- `src/components/JobPostingImport.js` — no changes needed
- `src/components/CompatibilityModule.js` — no changes needed
- All other test files not listed above
