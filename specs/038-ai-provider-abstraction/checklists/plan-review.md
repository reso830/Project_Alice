# Plan Review Checklist: 038-ai-provider-abstraction

**Reviewer**: _(fill in)_
**Date**: _(fill in)_

---

## Spec alignment

- [ ] Plan scope matches spec scope — no new features, no prompt changes, no schema changes
- [ ] All three in-scope features are migrated: Resume Import (parseWithLlm), JD Parser (parseJobWithLlm), Compat Notes (generateNotes)
- [ ] validateKey is migrated into the provider implementation and exposed via aiService
- [ ] Non-goals are respected: no server-side move, no multi-provider switching, no UI changes

## Architecture

- [ ] Provider interface matches `contracts/provider.md` — `complete`, `validateKey`, `defaultModel`
- [ ] `aiService.js` does NOT import from `aiSettings.js` (no circular dependency)
- [ ] `llmClient.js` is deleted with no re-export bridge
- [ ] No feature component (`ResumeImport`, `JobPostingImport`, `CompatibilityModule`) is modified
- [ ] `REASON_CODES` and `mapErrorToReason` are public exports of `aiService.js`
- [ ] `llmParser.js` re-exports these for backward compat with component importers
- [ ] `validateKey` is no longer exported from `llmParser.js`; `Profile.js` imports from `aiService.js`

## Behavior preservation

- [ ] Prompt text in `llmParser.js` is unchanged
- [ ] Response-parsing logic in `llmParser.js` is unchanged
- [ ] Prompt text in `compatNotesService.js` is unchanged
- [ ] Response-parsing and normalization in `compatNotesService.js` is unchanged
- [ ] Input truncation behavior (`MAX_INPUT_CHARS`) preserved in OpenRouter provider
- [ ] Timeout behavior (`LLM_TIMEOUT_MS`) preserved in OpenRouter provider
- [ ] `DEFAULT_MODEL` value is unchanged: `'meta-llama/llama-3.3-70b-instruct:free'`
- [ ] Error reason codes are unchanged: `timeout`, `network`, `invalid_key`, `quota`, `rate_limit`, `server`, `NO_TEXT`

## Tests

- [ ] `tests/services/providers/openrouter.test.js` exists and covers: complete (happy path, timeout, network, invalid key, server error, truncation), validateKey (ok, rejected, network)
- [ ] `tests/services/aiService.test.js` exists and covers: delegation to active provider, result passthrough, error propagation
- [ ] `tests/services/compatNotesService.test.js` mock updated from `llmClient.js` to `aiService.js`
- [ ] `tests/services/llmParser.test.js` validateKey tests moved to `openrouter.test.js`
- [ ] `tests/pages/profile.aiSettings.test.js` mock updated from `llmParser.js` to `aiService.js`
- [ ] Full test suite passes with zero failures

## Release Prep gates

- [ ] `package.json` version bumped
- [ ] `package-lock.json` root version synced
- [ ] CHANGELOG entry present
- [ ] `docs/REPO_MAP.md` updated: new files added, `llmClient.js` marked removed
- [ ] `docs/feature_roadmap.md` ticked

## Risk checks

- [ ] No remaining imports of `llmClient.js` anywhere in the repo (grep confirms)
- [ ] No remaining direct calls to `requestChatCompletion` outside of `providers/openrouter.js` (grep confirms)
- [ ] No remaining direct references to `OPENROUTER_URL` outside of `providers/openrouter.js` (grep confirms)
- [ ] `aiService.js` has no dependency on `aiSettings.js` (grep confirms)
