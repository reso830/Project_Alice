# Plan Review Checklist: LLM Resume / CV Parser (033)

**Purpose**: Gate the plan before `/speckit.tasks`.
**Created**: 2026-06-02

## Constitution alignment

- [x] Local-first preserved — AI is additive/opt-in; a plain checkout still runs
  and resume import still works (rule-based) with no key (FR-012, SC-005).
- [x] External data sharing is **explicitly specified** here (the clause's escape
  hatch), gated by BYOK + one-time consent; no analytics/tracking added.
- [x] No server-side persistence of key or resume content (FR-010, SC-006).
- [x] Business logic separated from UI (`aiSettings.js`, `llmParser.js` modules).
- [x] Validation centralized + reused (`normaliseProfile`/`mergeResumeData`),
  not re-implemented (R-5).
- [x] Demo gating preserved (R-9); hosted demo → 401 on server endpoints.
- [x] Accessibility: AI indicator non-color-only; paste input + consent are
  labeled, keyboard-navigable (FR-022).
- [x] New dependency justification: **none required** — reuses `fetch`, `zod`
  (already present, optional), existing extractor.

## Completeness

- [x] Every FR maps to a planned component/endpoint (see plan §Architecture).
- [x] All edge cases have a handling path (truncation, invalid key, declined
  consent, both-fail, missing dates).
- [x] Failure/fallback flows specified for both paste and upload (R-4, R-6).
- [x] Contracts defined for new + extended endpoints + external call.
- [x] Test strategy covers unit, server, component, page, and reuse suites.

## Risks acknowledged

- [x] OpenRouter browser CORS is the load-bearing assumption (R-2) — early spike
  required. Browser-direct is firm (contracts §4); if the spike fails, STOP and
  escalate — a server-proxy is not a silent fallback (needs an explicit amendment).
- [x] Key in `localStorage` XSS exposure — inherent to BYOK browser storage,
  disclosed to user; app uses no `innerHTML`.
- [x] Free-model availability/latency — configurable model constant + 30s timeout
  + fallback.
- [x] LLM hallucination — review-before-save + indicators + schema sanitization.

## Mandatory final phases (Amendments 1.1.0 / 1.3.0)

- [x] Plan reserves **Release Prep** (version bump, CHANGELOG, README, REPO_MAP;
  deployment.md note that no env vars change) as second-to-last phase.
- [x] Plan reserves **Browser Smoke Test** (walk each user story Independent Test)
  as the final phase.

## Open items for `/speckit.tasks`

- [ ] Confirm CORS spike is sequenced first (de-risks the whole feature).
- [ ] Decide exact `DEFAULT_MODEL` id at implementation time (free-tier current).
