# Plan Review Checklist: 038-ai-provider-abstraction

**Reviewer**: reso830 / Claude Sonnet 4.6
**Date**: 2026-06-19

---

## Spec alignment

- [x] Plan scope matches spec scope — no new features, no prompt changes, no schema changes
- [x] All three in-scope features are migrated: Resume Import (parseWithLlm), JD Parser (parseJobWithLlm), Compat Notes (generateNotes)
- [x] validateKey is migrated into the provider implementation and exposed via aiService
- [x] Non-goals are respected: no server-side move, no multi-provider switching, no UI changes

## Architecture

- [x] Provider interface matches `contracts/provider.md` — `complete`, `validateKey`, `defaultModel`
- [x] `aiService.js` does NOT import from `aiSettings.js` (no circular dependency)
- [x] `llmClient.js` is deleted with no re-export bridge
- [x] No feature component (`ResumeImport`, `JobPostingImport`, `CompatibilityModule`) is modified
- [x] `REASON_CODES` and `mapErrorToReason` are public exports of `aiService.js`
- [x] `llmParser.js` re-exports these for backward compat with component importers
- [x] `validateKey` is no longer exported from `llmParser.js`; `Profile.js` imports from `aiService.js`

## Behavior preservation

- [x] Prompt text in `llmParser.js` is unchanged
- [x] Response-parsing logic in `llmParser.js` is unchanged
- [x] Prompt text in `compatNotesService.js` is unchanged
- [x] Response-parsing and normalization in `compatNotesService.js` is unchanged
- [x] Input truncation behavior (`MAX_INPUT_CHARS`) preserved in OpenRouter provider
- [x] Timeout behavior (`LLM_TIMEOUT_MS`) preserved in OpenRouter provider
- [x] `DEFAULT_MODEL` value is unchanged: `'meta-llama/llama-3.3-70b-instruct:free'`
- [x] Error reason codes are unchanged: `timeout`, `network`, `invalid_key`, `quota`, `rate_limit`, `server`, `NO_TEXT`

## Tests

- [x] `tests/services/providers/openrouter.test.js` exists and covers: complete (happy path, timeout, network, invalid key, server error, truncation), validateKey (ok, rejected, network)
- [x] `tests/services/aiService.test.js` exists and covers: delegation to active provider, result passthrough, error propagation
- [x] `tests/services/compatNotesService.test.js` mock updated from `llmClient.js` to `aiService.js`
- [x] `tests/services/llmParser.test.js` validateKey tests moved to `openrouter.test.js`
- [x] `tests/pages/profile.aiSettings.test.js` mock updated from `llmParser.js` to `aiService.js`
- [x] Full test suite passes with zero failures

## Release Prep gates

- [x] `package.json` version bumped
- [x] `package-lock.json` root version synced
- [x] CHANGELOG entry present
- [x] `docs/REPO_MAP.md` updated: new files added, `llmClient.js` marked removed
- [x] `docs/feature_roadmap.md` ticked

## Risk checks

- [x] No remaining imports of `llmClient.js` anywhere in the repo (grep confirms)
- [x] No remaining direct calls to `requestChatCompletion` outside of `providers/openrouter.js` (grep confirms)
- [x] No remaining direct references to `OPENROUTER_URL` outside of `providers/openrouter.js` (grep confirms)
- [x] `aiService.js` has no dependency on `aiSettings.js` (grep confirms)
