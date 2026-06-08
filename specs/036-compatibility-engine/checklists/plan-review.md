# Plan Review Checklist: Compatibility Engine

Gate before `/speckit.tasks`. Each item: ✅ pass / ⚠️ risk / ❌ fail.

## Constitution compliance

- [ ] Required application fields untouched; `minYearsExperience` is optional, `compat` reused — ✅
- [ ] Business logic (scoring) centralized in one pure module, separated from UI — ✅
- [ ] Validation centralized; `minYearsExperience` rejected-not-coerced; `compat` server-authoritative (no silent overwrite) — ✅
- [ ] Empty / sparse / error states explicit (deterministic low score, never throws) — ✅
- [ ] Automated tests planned for core scoring + changed behavior — ✅
- [ ] Local-first; no LLM / analytics / external calls in the scoring path — ✅
- [ ] Non-color-only indicator (numeric score + label text) — ✅
- [ ] Desktop + mobile unaffected; keyboard/labels preserved — ✅
- [ ] Extensible (config-driven categories + renormalization) without overbuild — ✅

## Spec ↔ plan coverage

- [ ] Deterministic, repeatable scoring (FR-001) → pure module + `asOf` param + determinism test
- [ ] No LLM in scoring (FR-002) → pure JS, no network; offline test
- [ ] Weighted categories incl. proficiency (FR-003/005) → category formulas; preferred = partial credit
- [ ] Configurable weights (FR-004) → `COMPAT_WEIGHTS` constant
- [ ] Renormalization on absent category (FR-006) → aggregate rule + test
- [ ] Score 0–100 + four bands (FR-007) → `COMPAT_BANDS` / `getCompatLabel`
- [ ] Score + label only; no breakdown (FR-008) → output shape; 037 boundary held
- [ ] Persist + recompute, archived frozen (FR-009) → server orchestration; profile-save recompute excludes archived
- [ ] Random `compat` removed (FR-010) → parser edits + backfill
- [ ] Candidate years derived, no stored field (FR-011) → `derivedYears(experience, asOf)`
- [ ] `minYearsExperience` added, parser leaves blank, validated (FR-012/013) → schema + model + columns
- [ ] Normalized-exact matching, dedup (FR-014/014a) → matching spec; role-alignment basis fixed
- [ ] Graceful sparse/empty (FR-015) → total function; tests
- [ ] Non-color-only + non-authoritative framing (FR-016) → CompatBar label
- [ ] Parity across local/hosted/demo (FR-017) → server path + demo module + migrations
- [ ] Centralized + tested logic (FR-018) → `tests/models/compatibility.test.js`
- [ ] Extensible without rewrite (FR-019) → open category list

## Risk review

- [ ] Profile-save O(N) recompute acceptable at scale; only-changed writes; SQLite transaction — ⚠️ revisit if N grows (hosted batching)
- [ ] `asOf` time-dependence documented; persisted score prevents silent drift — ✅
- [ ] Coarse text matching false-negatives accepted; skills dominate — ✅
- [ ] `compat` removed from write schema without breaking Tracker filter (reads field) — verify in tasks
- [ ] Backfill converges legacy random values (SC-003) — task required (local boot + hosted one-time)
- [ ] Certifications basis is a planning default (only un-user-confirmed category) — low weight; confirm in implementation or defer

## Release-prep reminders (final two phases — mandatory)

- [ ] Version bump across package.json + package-lock.json root version
- [ ] CHANGELOG entry; README; `docs/deployment.md` (new env? no — but note hosted migration); `docs/REPO_MAP.md` for new files (`src/models/compatibility.js`, `server/services/compatibility.js`); `docs/feature_roadmap.md` tick `036-compatibility-engine`
- [ ] Browser Smoke Test ordered AFTER Release Prep, walking each user story's Independent Test against the merge state
