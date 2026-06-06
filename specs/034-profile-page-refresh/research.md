# Research & Decisions: Profile Page Refresh (034)

Phase 0 decisions. Each records the chosen approach, the alternatives weighed, and
the rationale. Decisions are grounded in the current codebase (audited 2026-06-05)
and the two design specs.

---

## Current-state audit (what 033 actually shipped)

| Area | Shipped today | Gap vs. design |
|------|---------------|----------------|
| Read-only Profile skills | `renderSkills` with sort (Custom / By level ▾▴), collapse-past-10, "?" scale popover, hover/tap reveal, mobile collapse — `src/pages/Profile.js:565-662` | **Matches design** — verify/polish only |
| Profile sub-sections, Basic Info, Archived link, empty state | Shipped (`Profile.js`) | Matches design |
| Settings | Two **separate** cards: `renderAiSettingsSection` ("AI RESUME PARSING": key + separate consent statuses + Save/Clear/ClearConsent) and `renderAccountSection` — `Profile.js:859-947` | **Net-new redesign** — unify into one Settings card; full §4.5.1 AI sub-group |
| AI settings model | `aiSettings.js`: key + consent only (`alice.ai.openrouterKey`, `alice.ai.consent`) | **Net-new** — add `enabled`, `model`, `features{cv,jd,compat}`, derived status, migration |
| Résumé import | `ResumeImport.js`: upload/paste, key, **separate consent dialog** ("Send resume text to OpenRouter?"), processing messages, rule-based fallback; `llmParser.js` hardcodes `DEFAULT_MODEL`, `parseWithLlm(text, key)` | Basic only |
| Edit page AI provenance | Field-level AI badges (`createAiFieldBadge`, `appendAiIndicator` in `ProfileEdit.js`); `highlightImport` flag | **Net-new** — section-level ✦/⚙ provenance pills, basic-vs-AI distinction |
| Mode gate / Import Bar / reason-code dialog / Undo | **None** | **Net-new** (whole §3, §5, §11) |
| Reduced motion | `prefers-reduced-motion` block exists (3 refs in `main.css`) | Extend to new animations |

**Conclusion:** the read-only Profile page is essentially done; the work concentrates
in (a) the Settings §4.5 redesign + settings-model rewrite/migration, and (b) the
net-new edit-page proposed flow (mode gate → smart input → processing → ask-first
failure/reason-codes → fill/append + provenance + Undo).

---

## R-1 — AI settings storage shape & migration

**Decision:** Extend `aiSettings.js` to persist the §7 shape in `localStorage`:
`enabled` (bool), `apiKey` (existing key store, reused), `model` (string slug),
`features` (`{cv,jd,compat}`). Keep the existing `alice.ai.openrouterKey` storage
key for `apiKey`. Add new keys (`alice.ai.enabled`, `alice.ai.model`,
`alice.ai.features`). On first read under 034, run a one-way migration: if a legacy
key + consent exist and the new keys are absent, set `enabled=true`,
`model=DEFAULT_MODEL`, `features={cv:true,jd:false,compat:false}` (per
Clarifications). The legacy `alice.ai.consent` flag is retired — **a saved key is
consent** — but is read once during migration to confirm prior opt-in.

**Alternatives:** (a) single JSON blob under one key — rejected to keep the proven
key store untouched and migration narrow; (b) clean-slate (ignore prior key) —
rejected (disrupts existing users, contradicts the migration clarification).

**Rationale:** smallest change to a security-sensitive store; preserves the
browser-only/local-first contract; deterministic upgrade for returning users.

## R-2 — Connection status is derived, never persisted

**Decision:** `AiConnectionStatus` (`connected | none | testing | error`) is computed
at render time from key presence + the last Test outcome held in memory — never
written to storage (per spec §7).

**Alternatives:** persist last-known status — rejected (a stored "connected" goes
stale the moment OpenRouter revokes the key).

**Rationale:** a status that can silently become wrong must not be cached.

## R-3 — "Test" key validation call

**Decision:** Add a lightweight key-validation function in `llmParser.js` (e.g.
`validateKey(key)`) that issues one cheap authenticated OpenRouter request (a
minimal request against the models/auth endpoint) with the existing
`AbortController` timeout, mapping the HTTP result to the R-6 reason codes
(`connected` on 2xx; `error` + reason otherwise). It does **not** parse a résumé.

**Alternatives:** reuse `parseWithLlm` with a tiny payload — rejected (wastes a
parse call / tokens, ambiguous errors); skip Test entirely — rejected (design
requires a Test affordance + status pill).

**Rationale:** explicit, cheap, reuses the same error→reason mapping the import
flow needs anyway.

## R-4 — Consent folded into the key flow

**Decision:** Saving a key is consent. `aiSettings.setKey` becomes the consent
point; the separate consent dialog in `ResumeImport.js` ("Send resume text to
OpenRouter?") is removed. `hasConsent` is retired (or made to derive from
`hasKey`) and its callers updated. **Delete** clears the key (= withdraws consent).

**Alternatives:** keep the per-import consent prompt — rejected (design §4.5.1
explicitly folds consent into the key; double-gating is friction).

**Rationale:** matches the locked design decision; removes a redundant surface.

## R-5 — Model slug passed to the parser

**Decision:** `parseWithLlm(text, key, model)` (and `validateKey`) accept the
model slug; callers pass `aiSettings.getModel()`, which defaults to
`DEFAULT_MODEL`. The Settings model field is free-text with a `datalist` of the
suggested slugs (§4.5.1).

**Alternatives:** keep `DEFAULT_MODEL` hardcoded — rejected (design exposes a
model field; users must be able to pick any OpenRouter model).

**Rationale:** one small signature change unlocks the design's model control while
keeping the default behavior for users who never touch it.

## R-6 — Reason-code mapping (single source of truth)

**Decision:** Add a reason-code map (keys: `rate_limit`, `timeout`, `server`,
`network`, `invalid_key`, `quota`, `NO_TEXT`) mirroring `edit_profile_page.md` §11:
each carries a code chip, message, and `fix` class (`wait` → Try AI again;
`settings` → Update key in Settings; dead-end → different file). Map OpenRouter
HTTP/SDK/timeout errors to these keys; default unknown failures to `wait`
(retryable). Used by both the Test flow (R-3) and the import failure dialog.

**Alternatives:** ad-hoc strings per call site — rejected (drift, untestable).

**Rationale:** one tested table drives all error UX; provider-agnostic copy.

## R-7 — First-time vs. returning detection for the mode gate

**Decision:** The split-card mode gate shows **only when no profile exists** (the
Set-Up path); when a profile exists the user lands on the populated form with a
collapsed Import Bar. `ProfileEdit.mount` already receives the loaded profile and a
`highlightImport` flag — drive the gate off "profile is empty" at mount.

**Alternatives:** a persisted "has seen gate" flag — rejected (the rule is purely
"profile empty?", no extra state needed).

**Rationale:** matches §3.1; reuses existing mount inputs; no new persistence.

## R-8 — Merge / append & Undo

**Decision:** Reuse `mergeResumeData` (already append-only, dedupes, imported
skills unrated) for the append path; first-time fill populates the empty form.
Capture a pre-import snapshot (deep clone of form state) before applying; the
post-import toast's **Undo** restores that snapshot. No partial writes — apply only
after a parse fully succeeds.

**Alternatives:** per-field review/overwrite modal — rejected (design §3.6 replaced
it with append + Undo); diff-based undo — rejected (snapshot is simpler and exact).

**Rationale:** leverages tested merge logic; snapshot Undo is trivially correct.

## R-9 — Provenance markers (AI vs basic)

**Decision:** Section-level pills beside affected section titles: `✦ AI FILLED`
(AI sparkle, indigo) for LLM fills; `⚙ Auto-filled` (neutral, no sparkle) for
rule-based fills. Scope: first-time fill marks all populated sections; append marks
only touched sections. Persist for the session until that section is edited/saved.
Reuse/extend the existing field-badge infrastructure where practical.

**Alternatives:** a single provenance style — rejected (design deliberately keeps
the sparkle honest: reserved for genuine LLM output).

**Rationale:** the parser that produced the data must be visible; drives a clear
acceptance test.

## R-10 — Reduced motion

**Decision:** Extend the existing `@media (prefers-reduced-motion: reduce)` block to
neutralize the new decorative transitions (skill-meter cross-fade, `epfFlash`
import flash, bottom-sheet slide) — show end-states directly. Functional reveals
resolve instantly; auto-revert timers still fire so nothing is left stuck.

**Alternatives:** JS-gated motion — rejected (CSS media query is the standard,
test-friendly mechanism already in use).

**Rationale:** accessibility per the constitution; reuses the existing pattern.

## R-11 — JD / Compat toggles for unbuilt features

**Decision:** Render the Job-description and Compatibility toggles **disabled** with
a "coming soon" affordance; only `cv` is functional. Persist their (off) state so
035/036 can flip them on. Smart import gates on `enabled && features.cv`.

**Alternatives:** hide them (rejected — design shows three; layout completeness),
or make them functional no-ops (rejected — implies a capability that doesn't
exist).

**Rationale:** matches the Clarifications decision; honest affordance; forward-compatible.

---

## Cross-cutting constraints (carried from spec)

- **No DB schema or server API changes.** All new state is browser-local; the only
  external call remains the user's browser → OpenRouter (BYOK).
- **No new dependencies.** Reuse `fetch`/`AbortController`, existing extractor,
  existing `normaliseProfile`/`mergeResumeData`/`validateProfile`.
- **Local-first preserved.** With no key, the app behaves exactly as today
  (manual entry; rule-based import).
