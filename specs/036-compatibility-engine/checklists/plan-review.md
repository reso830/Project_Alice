# Plan Review Checklist: Compatibility Engine

Gate before `/speckit.tasks`. Each item: `[x]` satisfied · `[ ]` open.

## Constitution compliance

- [x] Required application fields untouched; `minYearsExperience` is optional, `compat` reused
- [x] Business logic (scoring) centralized in one pure module, separated from UI
- [x] Validation centralized; `minYearsExperience` rejected-not-coerced; `compat` server-authoritative (no silent overwrite)
- [x] Empty / sparse / error states explicit (deterministic low score, never throws)
- [x] Automated tests planned for core scoring + changed behavior
- [x] Local-first; no LLM / analytics / external calls in the scoring path
- [x] Non-color-only indicator (numeric score + label text)
- [x] Desktop + mobile unaffected; keyboard/labels preserved
- [x] Extensible (config-driven categories + renormalization) without overbuild

## Spec ↔ plan coverage

- [x] Deterministic, repeatable scoring (FR-001) → pure module + `asOf` param + determinism test
- [x] No LLM in scoring (FR-002) → pure JS, no network; offline test
- [x] Weighted categories incl. proficiency (FR-003/005) → category formulas; preferred = partial credit
- [x] Configurable weights (FR-004) → `COMPAT_WEIGHTS` constant
- [x] Renormalization on absent category (FR-006) → aggregate rule + test
- [x] Score 0–100 + four bands (FR-007) → `COMPAT_BANDS` / `getCompatLabel`
- [x] Score + label only; no breakdown (FR-008) → output shape; 037 boundary held
- [x] Persist + recompute, archived frozen (FR-009) → server orchestration; profile-save recompute excludes archived
- [x] Random `compat` removed (FR-010) → parser edits + backfill
- [x] Candidate years derived, no stored field (FR-011) → `derivedYears(experience, asOf)`
- [x] `minYearsExperience` added, parser leaves blank, validated (FR-012/013) → schema + model + columns
- [x] Normalized-exact matching, dedup (FR-014/014a) → matching spec; role-alignment basis fixed
- [x] Graceful sparse/empty (FR-015) → total function; tests
- [x] Non-color-only + non-authoritative framing (FR-016) → CompatBar label
- [x] Parity across local/hosted/demo (FR-017) → server path + demo module + migrations
- [x] Centralized + tested logic (FR-018) → `tests/models/compatibility.test.js`
- [x] Extensible without rewrite (FR-019) → open category list

## Risk review

- [x] Profile-save O(N) recompute acceptable at scale; only-changed writes; SQLite transaction (revisit if N grows — hosted batching)
- [x] `asOf` time-dependence documented; persisted score prevents silent drift
- [x] Coarse text matching false-negatives accepted; skills dominate
- [x] `compat` removed from write schema without breaking Tracker filter (reads field; verified by filter tests)
- [x] Backfill converges legacy random values once (SC-003) — local boot gated to the migration; hosted one-time maintenance pass
- [x] Certifications basis is a planning default (only un-user-confirmed category) — low weight; shipped as documented default

## Release-prep reminders (final two phases — mandatory)

- [x] Version bump across package.json + package-lock.json root version
- [x] CHANGELOG entry; README; `docs/deployment.md` (note hosted migration + backfill); `docs/REPO_MAP.md` for new files (`src/models/compatibility.js`, `server/services/compatibility.js`); `docs/feature_roadmap.md` tick `036-compatibility-engine`
- [x] Browser Smoke Test ordered AFTER Release Prep, walking each user story's Independent Test against the merge state
