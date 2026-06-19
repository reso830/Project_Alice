# Research: Compatibility Insights Panel

Decisions made during planning, with rationale.

---

## D1 — LLM call architecture: client-side vs server-side

**Decision**: Client-side LLM call (Option A), consistent with 035 JD parser and 033 resume parser.

**Rationale**: The existing codebase has zero server-side LLM calls. Both parsers call OpenRouter directly in the browser using `aiSettings.getKey()`. Introducing a server-side LLM call would require a new pattern for passing the API key to the server (env var or request header), add infrastructure complexity, and diverge from the established architecture for no functional gain at current scale.

**Implementation**: Extract `requestChatCompletion` from `llmParser.js` into a shared `src/services/llmClient.js`. New `src/services/compatNotesService.js` imports from `llmClient.js`. Server route `POST /api/applications/:id/compat-notes` receives the generated `{ summary, body }` from the client and handles validation + persistence only.

**Trade-off accepted**: FR-023 in the spec says the route "derives all context from the stored application and profile" — this was written assuming server-side generation. The plan amends this: the route validates and persists client-generated text; the "context derivation" (prompt assembly) happens client-side using application + profile data already in the modal state.

---

## D2 — Shared LLM client extraction

**Decision**: Extract `requestChatCompletion` and `LLM_TIMEOUT_MS` from `llmParser.js` into `src/services/llmClient.js`. Export `mapErrorToReason` from `llmClient.js` as well (it is generic, not parse-specific).

**Rationale**: Without extraction, `compatNotesService.js` would need to duplicate the OpenRouter HTTP call, timeout logic, and error mapping — or import from `llmParser.js` (which would make the dependency semantically wrong: notes generation is not "parsing"). `llmClient.js` is the right abstraction boundary.

**What stays in `llmParser.js`**: `buildResumeSystemPrompt`, `buildJobSystemPrompt`, `parseWithLlm`, `parseJobWithLlm`, `validateKey`, `buildJobDraft`, `cleanString*` helpers. All parse-specific.

**No behavior change** to `llmParser.js` from the user's perspective — it just imports from `llmClient.js` internally.

---

## D3 — Staleness mechanism: `compat_scored_at` vs field tracking

**Decision**: New `compat_scored_at TEXT` column stamped by 036's recompute path on every score write. Staleness = `notes.generatedAt < compat_scored_at`.

**Rationale**: The alternative (037 independently monitoring which application fields changed) would duplicate 036's field-watch logic and create a divergence risk. The one-way cascade — compat-relevant changes trigger 036 recompute → 036 stamps `compat_scored_at` → 037 reads it — is architecturally cleaner and guaranteed to be consistent because 036 already knows exactly which changes warrant a recompute.

**Edge case**: `compat_scored_at` only updates when `compat` changes in `recomputeActive()`. If a compat-relevant field changes but the score is identical (unlikely but possible), `compat_scored_at` won't be stamped and notes won't go stale. This is an acceptable trade-off — if the score didn't change, the analysis is unlikely to be materially wrong.

**Actually**: On closer inspection, `recomputeActive()` currently only writes if `compat !== application.compat`. The `compat_scored_at` stamp should happen whenever a score compute is *attempted*, not only when the value changes — to correctly mark notes stale even when the score stays the same but the underlying data changed. **Amended**: `compat_scored_at` is stamped on every score computation attempt, not only on value change.

---

## D4 — Profile availability in Modal.js

**Decision**: Tracker.js fetches the profile at page init (`api.getProfile()`) alongside `api.getAll()`, and passes it as a `profile` parameter to `Modal.open()`.

**Rationale**: Fetching the profile inside Modal on every open would add latency to an already-fast interaction. Tracker.js already performs a bulk data fetch at init; adding one more parallel fetch is negligible. The profile changes rarely compared to applications.

**Fallback**: If `profile` is null or not passed (e.g., a caller that hasn't been updated), skill chips degrade gracefully to plain chips and the compatibility module shows `no-profile` state. A console warning is emitted.

---

## D5 — Stale copy: generic vs context-aware

**Decision** (from clarification session): Single generic copy: *"Your profile or job data changed after these notes were written. The score above is current — refresh the notes to match."*

**Rationale**: Context-aware messaging (different copy for profile-triggered vs application-triggered staleness) would require tracking which entity set `compat_scored_at` — extra state for minimal UX gain. The generic copy is accurate in all cases and simpler to implement.

---

## D6 — `compat_scored_at` stamping granularity

**Amended from D3**: `compat_scored_at` is stamped on every score computation attempt (not only on value change).

**In `recomputeActive()`**: remove the `if (compat !== application.compat)` guard for the `compat_scored_at` stamp. The compat write still only happens on value change (to avoid unnecessary DB writes), but the timestamp stamp is separated:

```js
for (const application of applications) {
  const compat = scoreApplication(application, profile, asOf);
  const compatScoredAt = new Date().toISOString();

  // always stamp compat_scored_at (data changed, recompute was attempted)
  // only update compat if the value changed
  const payload = compat !== application.compat
    ? { compat, compatScoredAt }
    : { compatScoredAt };

  updates.push(repos.applications.update(application.id, payload, asOf));
}
```

This ensures notes always go stale after a compat-relevant data change, even when the score stays the same.

---

## D7 — `no-profile` detection threshold

**Decision**: `no-profile` when `profile.skills.length === 0 && profile.experience.length === 0 && !profile.summary?.trim()`.

**Rationale**: The spec says "insufficient profile information exists to calculate compatibility." With zero skills, experience, and summary, the only scoring signal is keywords — which would produce a score very close to 0 and be meaningless. Any of the three present means the scoring engine has at least one signal to work with and should show the `scored` state (even if low). This threshold is intentionally lenient.

---

## D8 — Generate button: AI provider not configured

**Decision**: When `!aiSettings.canUseJdParser()` (or equivalent check for compat notes), the Generate/Regenerate/Refresh buttons are replaced with an inline "Enable AI in Settings →" link, following the §13.1 Smart Entry gate pattern.

**Rationale**: Same pattern as the JD parser locked state — consistent UX, same code path for checking AI availability.

**Check to use**: `aiSettings.hasKey() && aiSettings.isEnabled()` — the same conditions that gate `canUseJdParser()`. If a separate `canGenerateCompatNotes()` function is needed, it should delegate to the same underlying check.
