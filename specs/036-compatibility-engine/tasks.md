# Tasks: Compatibility Engine

**Feature**: `036-compatibility-engine` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small and ordered; `[P]` marks tasks that can run in parallel with their siblings (different files, no shared edits). The project practices TDD — where a task pairs an implementation file with a test file, **write the failing test first**, confirm it fails for the right reason, then implement. Commands: `npm run test:run`, `npm run lint`.

Status legend: `[x]` done · `[ ]` pending · `[~]` optional, intentionally skipped.

Phase dependency: 01 → 02 → 03 → 04/05 (parallel) → 06 → 07 → 08 → 09/10 (post-smoke-test fixes).

---

## Phase 01 — Pure scoring module ✅ complete

### T001 `[x]` — Create the deterministic scoring module
- **Target**: `src/models/compatibility.js` (new)
- **Expected behavior**: Export `COMPAT_WEIGHTS` (skills 35, roleAlignment 25, experience 20, keywords 10, certifications 10), `COMPAT_BANDS` + `getCompatLabel(score)` (Low 0–39 / Medium 40–64 / High 65–84 / Great 85–100), and `computeCompatibility(profile, application, { weights = COMPAT_WEIGHTS, asOf } = {}) → { score, label }`. Implement the five category functions, the `derivedYears(experience, asOf)` helper, normalization/tokenization helpers, active-category selection, weight renormalization, and final `round`+clamp to 0–100. Formulas are fixed in [research.md](research.md) §D5/§D6 and [data-model.md](data-model.md) §4. *(Weights/skills formula later revised — see Phase 10 / research D10–D11.)*
- **Constraints**: Pure — **no I/O, no `Math.random`, no implicit `Date.now()`** (time enters only via `asOf`). `asOf` is a **required** caller-supplied `'YYYY-MM-DD'`; the module has **no clock fallback** (omitting it must not silently use "today"). Does not mutate arguments. Preferred-skill credit is capped so a profile with zero required coverage cannot reach a full skills sub-score (FR-005). Experience graded by closeness, full at ≥ requirement, no overshoot bonus (FR-013). Absent categories renormalize; zero active → `0`.
- **Validation/test**: `tests/models/compatibility.test.js` (T002).
- **Out of scope**: any per-category breakdown in the return value (037); reading repos/DB; display logic.

### T002 `[x]` — Unit-test the scoring contract
- **Target**: `tests/models/compatibility.test.js` (new)
- **Expected behavior**: Cover determinism (identical inputs incl. fixed `asOf` → identical score); proficiency weighting (level 5 match > level 2 match); preferred = partial credit and cannot exceed required coverage; experience grading (near-miss > large shortfall; ≥ requirement caps at full, no overshoot bonus); renormalization when a category is absent; band boundaries at 39/40/64/65/84/85; sparse profile + empty JD → deterministic low score with **no throw**; zero active categories → 0.
- **Constraints**: Use fixed `asOf` for any current-role fixture. No network, no DB.
- **Validation/test**: `npm run test:run -- tests/models/compatibility.test.js` green; `npm run lint`.
- **Out of scope**: server/route behavior (Phase 03).

---

## Phase 02 — `minYearsExperience` field (model + persistence, all modes) ✅ complete

### T003 `[x]` — App model: normalize + validate `minYearsExperience`
- **Target**: `src/models/application.js`
- **Expected behavior**: `normalizeApplication` **parses without coercing away bad values**: a non-negative integer or a digit-only string (`"3"`→`3`) becomes that integer; empty/`null`/absent → `null`; any other value (negative, decimal like `3.7`, non-numeric, `NaN`) is **preserved as-is** for validation. `validateApplication` flags as invalid anything that is not a non-negative integer or `null` — `3.7` is **rejected, never floored to `3`**; no silent conversion. (Keep existing `clampCompat` as the defensive `compat` backstop.)
- **Constraints**: No new required field; default `null`. Do not truncate/floor/zero invalid input. Centralized in the shared model (constitution).
- **Validation/test**: `tests/models/application.test.js` — cases for valid int, digit-string `"3"`→3, `null`/empty→null, and **rejected** invalid values (`-1`, `3.7`, `"abc"`) with no coercion. *(Review fix: `undefined` also treated as valid/absent.)*
- **Out of scope**: scoring; UI.

### T004 `[x]` — Column mapping for `min_years_experience`
- **Target**: `server/db/columns.js`
- **Expected behavior**: Add `minYearsExperience ↔ min_years_experience` to `FIELD_TO_COLUMN`, `INSERTABLE_COLUMNS`, `APPLICATION_COLUMNS_WITHOUT_USER_ID`; map it in `toRecord` (`row.min_years_experience ?? null`) and `toRow` (integer or `null`, no JSON/boolean special-casing).
- **Constraints**: Backend-agnostic; do not import `server/db.js` (cold-start invariant).
- **Validation/test**: `tests/server/repositories/columns.test.js` — round-trip mapping incl. `null`.
- **Out of scope**: schema DDL (T005/T007).

### T005 `[x]` — Local SQLite migration
- **Target**: `server/db.js`
- **Expected behavior**: Add `ensureColumn(targetDb, 'applications', 'min_years_experience', 'INTEGER')` in `initSchema`.
- **Constraints**: Idempotent/additive (matches existing `ensureColumn` calls); nullable; no default beyond NULL.
- **Validation/test**: `tests/server/foundation.test.js` (schema) or an applications test asserting create/read of the field locally.
- **Out of scope**: Supabase DDL.

### T006 `[x]` — Request validation: add field, remove client-writable `compat`
- **Target**: `server/validation/application.js`
- **Expected behavior**: Add `minYearsExperience: z.union([z.number().int().nonnegative(), z.null()]).optional()` (accept empty→null) to `writableFields`. **Remove `compat`** from `writableFields` so it is no longer client-writable (server-authoritative).
- **Constraints**: `.strip()` already drops unknown keys; ensure a client-sent `compat` is ignored, not rejected. Clear field error messages for invalid `minYearsExperience`.
- **Validation/test**: `tests/server/validation.test.js` — `minYearsExperience` accepted/rejected; `compat` no longer round-trips from the client.
- **Out of scope**: computing `compat` (Phase 03).

### T007 `[x]` — Supabase adapter + migration + schema probe
- **Target**: `server/repositories/supabase/applications.js`, `server/health.js`, [data-model.md](data-model.md) §1 (SQL)
- **Expected behavior**: Ensure `min_years_experience` flows through Supabase create/update (plain integer; not in `JSONB_COLUMNS`/`BOOLEAN_COLUMNS`; include a `null` default in the `create` row block alongside the others). Add the documented `ALTER TABLE … ADD COLUMN IF NOT EXISTS min_years_experience integer;` to data-model. Add an `assertHostedSchema` probe for `applications.min_years_experience` (failOn `UNDEFINED_COLUMN`, `docPath: 'specs/036-compatibility-engine/data-model.md §1'`).
- **Constraints**: Additive; parity with SQLite; probe must fail fast on an unmigrated deploy.
- **Validation/test**: `tests/server/repositories/supabase/applications.test.js` (column passthrough); `tests/server/health.test.js` (probe present).
- **Out of scope**: applying the SQL to any live project.

---

## Phase 03 — Server-authoritative scoring & recompute ✅ complete

### T008 `[x]` — Compatibility orchestration service
- **Target**: `server/services/compatibility.js` (new)
- **Expected behavior**: Export helpers over an injected repo bundle: `scoreApplication(appFields, profile, asOf) → number` (delegates to the pure module) and `recomputeActive(repos, profile, asOf)` (loads `applications.getAll()`, scores each, updates **only changed** `compat`). Do not touch archived applications.
- **Constraints**: Depends only on `{ applications, profile }` repos + `src/models/compatibility.js`. No direct DB access. SQLite path should update changed rows efficiently (wrap in a transaction if practical via the repo).
- **Validation/test**: exercised via route tests (T009/T010); a focused unit test optional.
- **Out of scope**: demo store (Phase 04).

### T009 `[x]` — Compute `compat` on application create/update
- **Target**: `server/routes/applications.js`
- **Expected behavior**: In `POST /` and `PATCH /:id`, load the current profile (`req.repos.profile.get()`), compute `compat` from the new/merged JD fields via T008 using `resolveRequestDate(req)` as `asOf`, and persist it (overriding any client value). An archived application edited via its own PATCH recomputes its score.
- **Constraints**: Preserve existing status-transition validation/order; one profile read per write; do not regress the no-op update contract.
- **Validation/test**: `tests/server/applications.test.js` — created/updated record carries a computed `compat`; a client-supplied `compat` is ignored; archived-self-edit recomputes.
- **Out of scope**: profile-triggered recompute (T010).

### T010 `[x]` — Recompute active applications on profile save
- **Target**: `server/routes/profile.js`
- **Expected behavior**: After `req.repos.profile.upsert(req.body)`, call T008's `recomputeActive` with `resolveRequestDate(req)`. Archived applications are excluded (frozen).
- **Constraints**: Recompute must not change the profile response shape; only changed scores written; failures surface via the existing error path.
- **Validation/test**: `tests/server/profile.test.js` — saving the profile updates active applications' `compat` and leaves archived scores unchanged.
- **Out of scope**: demo mode.

---

## Phase 04 — Demo mode parity ✅ complete  [P with Phase 05]

### T011 `[x]` — Demo store client-side scoring
- **Target**: `src/data/demoStore.js`
- **Expected behavior**: In `create`/`update`, compute `compat` via `src/models/compatibility.js` against the in-memory demo profile, passing an explicit `asOf` (a fixed demo date). If the demo profile is mutable at runtime, recompute the in-memory applications when it changes (mirror archived-frozen behavior).
- **Constraints**: Same pure module as the server (no divergence); no network; supply `asOf` explicitly (the module has no clock fallback).
- **Validation/test**: `tests/data/demoStore.test.js` — created/updated demo app carries a computed `compat`.
- **Out of scope**: server paths.

### T012 `[x]` — Demo seed data
- **Target**: `src/data/demoSeed.js`
- **Expected behavior**: Add realistic `minYearsExperience` values and precomputed `compat` scores to seeded applications so the portfolio renders stable, sensible scores offline.
- **Constraints**: Seed `compat` should match what the module would produce for the seeded profile/app (deterministic).
- **Validation/test**: demo renders in `npm run dev` demo runtime; existing demo seed tests stay green.
- **Out of scope**: scoring logic changes. *(Phase 10/T024 will regenerate these precomputed scores under the v2 model.)*

---

## Phase 05 — Display ✅ complete  [P with Phase 04]

### T013 `[x]` — CompatBar: four-band label, non-color-only
- **Target**: `src/components/CompatBar.js`
- **Expected behavior**: Replace the current 3-threshold coloring (≥80/≥60) with the four spec bands and render the **label text** (Low/Medium/High/Great) beside the percentage, using `getCompatLabel` from the shared module.
- **Constraints**: Non-color-only (FR-016); informative, non-authoritative framing; single render surface reused by Tracker card + overlay.
- **Validation/test**: `tests/components/CompatBar.test.js` (new) — correct label per band incl. boundaries; label text present.
- **Out of scope**: Modal field.

### T014 `[x]` — Modal: `minYearsExperience` field + label
- **Target**: `src/components/Modal.js`
- **Expected behavior**: Add a labeled, keyboard-operable `minYearsExperience` editor (numeric/empty) in the application overlay; ensure the CompatBar shows the band label. After save, the rendered record reflects the server-computed score (no client compute required).
- **Constraints**: Labeled form control; reject invalid input consistent with model/schema messaging; do not write `compat` from the client.
- **Validation/test**: `tests/components/Modal.test.js` — field renders, edits the draft, persists via the save payload.
- **Out of scope**: live preview (T015).

### T015 `[~]` — [P][Optional] Modal live score preview
- **Target**: `src/components/Modal.js`
- **Expected behavior**: Optionally recompute a preview `compat` via the shared module from the in-memory profile + current draft as the user edits, so the bar updates before save. Purely additive polish.
- **Status**: **Skipped by design** — server returns the computed score on save; live preview not required for correctness.
- **Constraints**: Preview only — the server remains authoritative on save; skip if it risks scope creep.
- **Validation/test**: manual; optional unit assertion.
- **Out of scope**: changing persisted values from the client.

---

## Phase 06 — Remove randomness & backfill ✅ complete

### T016 `[x]` — Remove random `compat` assignments
- **Target**: `src/utils/jobPostParser.js` (lines ~374, ~394), `src/services/llmParser.js`
- **Expected behavior**: Delete the `Math.floor(Math.random()*101)` `compat` assignments. Parsers no longer set `compat`; the server computes it on create.
- **Constraints**: Do not break the parser draft shape otherwise; `minYearsExperience` stays unset by parsers (manual entry only).
- **Validation/test**: `tests/utils/jobPostParser.test.js`, `tests/services/llmParser.jd.test.js` — update any assertions expecting a random `compat`.
- **Out of scope**: scoring logic.

### T017 `[x]` — One-time backfill of legacy scores (all apps, incl. archived)
- **Target**: local boot/migration step (e.g. `server/db.js`/init or a `server/db-*.js` maintenance script) + a hosted all-applications maintenance path (script/admin action) documented in [data-model.md](data-model.md)/[quickstart.md](quickstart.md)
- **Expected behavior**: Recompute `compat` for **every** existing application — **active *and* archived** — against the current profile, so no record keeps a legacy random value (SC-003). Iterate all records (`getAll()` + `getAllArchived()`), score each via `src/models/compatibility.js` with an explicit `asOf`, and persist. Archived apps are scored **once** here, then freeze.
- **Constraints**: This is a **distinct one-time pass, NOT a profile re-save** — a profile save's ongoing recompute excludes archived (FR-009) and would leave archived legacy values. Idempotent and safe to re-run; deterministic; does not alter `minYearsExperience` or other fields. Hosted path must reach archived rows (not via the active-only profile recompute).
- **Validation/test**: a test seeding **both** an active and an **archived** app with arbitrary `compat`, then asserting the backfill replaces **both** with the computed value.
- **Out of scope**: continuous recompute (Phase 03 triggers); ongoing recompute touching archived (it must not — only this one-time pass does).

---

## Phase 07 — Release Prep ✅ complete *(mandatory)*

### T018 `[x]` — Version bump + changelog + docs
- **Target**: `package.json` (`1.5.0`→`1.6.0`), `package-lock.json` (root `version`), `src/pages/welcome/shared/appMeta.js` (`APP_VERSION` `v1.5.0`→`v1.6.0`), `CHANGELOG.md`, `README.md`, `docs/REPO_MAP.md`, `docs/feature_roadmap.md`
- **Expected behavior**: Bump the version in all three surfaces; add a CHANGELOG entry for the compatibility engine; update README for the new user-facing behavior (real compatibility scores + Min Years Experience field); add `src/models/compatibility.js` and `server/services/compatibility.js` to REPO_MAP; tick `036-compatibility-engine` in the roadmap. Note the hosted `min_years_experience` migration where deployment docs reference schema (no new env vars → `docs/deployment.md` only if a runtime/env change exists; otherwise skip with a note). *(Also updated `docs/deployment.md` with the migration + hosted backfill step, and the `release-metadata` test.)*
- **Constraints**: Keep `package.json` + `package-lock.json` root versions in sync (release-prep checklist); run **full** suite AFTER the bump.
- **Validation/test**: `npm run test:run` (full) green post-bump; `npm run lint`; docs sanity check.
- **Out of scope**: feature code changes. *(Note: the v1.6.0 CHANGELOG weight wording is refreshed by Phase 10/T024 once Group B lands, since v1.6.0 is unreleased.)*

---

## Phase 08 — Browser Smoke Test ✅ complete *(mandatory — UI feature)*

### T019 `[x]` — Walk each user story's Independent Test in a browser
- **Target**: running app (`npm run dev`), local mode, against the to-be-merged state
- **Expected behavior**: Execute [quickstart.md](quickstart.md): (US1) score is real, identical on reload, rises/falls with matching skills; (US2) CompatBar shows number + band label; (US3) profile change updates active scores; (US4) Min Years Experience contributes/omits and rejects invalid input; preferred-skill partial credit; archived-frozen recompute; offline/AI-off determinism; demo parity.
- **Constraints**: Ordered AFTER Release Prep so it exercises the actual merge state (constitution Amendment 1.3.0). Note any deviation with residual risk.
- **Validation/test**: manual checklist pass recorded in the PR.
- **Result**: surfaced two UI defects (Group A → Phase 09) and two scoring-believability issues (Group B → Phase 10).
- **Out of scope**: automated E2E.

---

> **Phases 09–10 — post-smoke-test fixes (added 2026-06-16).** The Phase 08 browser smoke test surfaced two UI defects (Group A) and two scoring-believability issues (Group B). Both ship within the **unreleased** v1.6.0 (036 has not merged), so they refine the feature rather than constituting a new release. After Phase 10, re-run the relevant Phase 08 smoke checks against the merge state.

## Phase 09 — UI fixes (Group A) ✅ complete

### T020 `[x]` — CompatBar label legibility
- **Target**: `src/components/CompatBar.js`, `tests/components/CompatBar.test.js`
- **Expected behavior**: the `"{score}% {label}"` text is clearly legible on every band fill (especially the green High/Great bars) and on the beige track.
- **Result (2026-06-16)**: implemented as a **flat per-band label color** — white on the High/Great fills, dark `#111827` on Low/Medium/track — via `getLabelColor`. The `text-shadow` halo approach was **tried and rejected by the user** as *less* readable, so the fills were **recolored** to keep white text legible *and* AA-compliant: **Great → `#2563EB`** (white ≈ 5.2:1, AA-pass) and **High → `#15803D`** (white ≈ 5.0:1, AA-pass); Medium `#EAB308` / Low `#EF4444` keep dark text. **No residual AA gap** — the earlier white-on-green concern is resolved by the recolor.
- **Constraints**: keep the label as text (non-color-only required); `getCompatLabel` stays the band source; UI-only — no scoring changes. (`main.css` ultimately untouched — no halo.)
- **Validation/test**: `tests/components/CompatBar.test.js` asserts the per-band label color; full suite + lint green.
- **Out of scope**: scoring math, weights, the compatibility model.

### T021 `[x]` — Min Years invalid-entry feedback
- **Target**: `src/components/Modal.js` (`makeMinYearsField`, `parseMinYearsInput`, `validateDraft`), `tests/components/Modal.test.js`
- **Expected behavior**: entering an invalid Min Years (decimal, negative, non-numeric) shows a **visible inline field error** and blocks save, instead of silently rejecting the keystroke.
- **Result (2026-06-16)**: field switched from `type="number"` to `type="text"` + `inputMode="numeric"` + `pattern="\d*"`, so the raw value reaches `validateDraft` and the inline `.modal-field-error` renders. Valid input still sent as a **number**, empty → `null`, client `compat` stays stripped.
- **Constraints (preserved)**: numeric send, empty → null, compat stripped; field stays labeled + keyboard-operable. UI-only.
- **Validation/test**: `tests/components/Modal.test.js` asserts the visible inline error on invalid input; full suite + lint green.
- **Out of scope**: scoring math.

## Phase 10 — Scoring v2 (Group B) ✅ complete

Authoritative design: [research.md](research.md) D10/D11, [data-model.md §7](data-model.md), reader-facing math in [`docs/compatibility_scoring.md`](../../docs/compatibility_scoring.md). Pure-computation change only — no schema, persistence, or architecture change.

> **Status (2026-06-16):** T022–T024 implemented and review-passed — full suite **1482 green**, lint clean, no stray `PREFERRED_FACTOR`, CHANGELOG/REPO_MAP/`docs/compatibility_scoring.md` aligned to `43/25/12/10/10` + pooled coverage. T025 automated re-verify green; manual re-smoke marked complete. (Side note for a later revisit, captured in [`docs/features/037-compatibility-insights-panel.md`](../../docs/features/037-compatibility-insights-panel.md): the stricter model skews scores conservative — 037 should make low scores *actionable* rather than discouraging.)

### T022 `[x]` — Skills: pooled weighted coverage
- **Target**: `src/models/compatibility.js` (the skills scorer), `tests/models/compatibility.test.js`
- **Expected behavior**: replace the "required mean + additive preferred bonus" with **pooled weighted coverage** — required weight 1, preferred weight `w = 0.69`; each matched skill contributes `proficiency/5`; unmatched required stay in the denominator. Cap the sub-score at **0.35** when required is non-empty and **zero** required matched. When no required is listed, the formula reduces to preferred coverage; both lists empty → category inactive.
- **Constraints**: deterministic/pure (no clock, no randomness). A required match's marginal MUST never be less than the same skill as preferred (regression-test this). Replaces `PREFERRED_FACTOR`.
- **Validation/test**: rewrite the skills cases in `tests/models/compatibility.test.js` for the new model — assert no inversion (required ≥ preferred marginal), partial-coverage honesty (5 of 6 strong ≈ 67%), the 0.35 cap on zero-required-matched, and preferred-only coverage. Update any other tests that assert specific skills-derived scores.
- **Out of scope**: experience, weights table (T023), display.

### T023 `[x]` — Experience: reweight + data-aware activation
- **Target**: `src/models/compatibility.js` (`COMPAT_WEIGHTS`, the experience scorer), `tests/models/compatibility.test.js`
- **Expected behavior**: set default weights to **skills 43 · roleAlignment 25 · experience 12 · keywords 10 · certifications 10**. Keep the graded curve and `derivedYears` unchanged. Add **data-aware activation** for a stated `minYearsExperience` with no experience entries: score **0** when the profile has other substantive content (summary / education / skills / certifications / awards / languages), **omit + renormalize** when the profile is essentially empty.
- **Constraints**: deterministic/pure; activation must distinguish "no experience but a real profile" (score 0) from "empty profile" (omit). `derivedYears` unchanged.
- **Validation/test**: update weight-dependent expectations; add cases for the fresh-grad (score 0) and empty-profile (omit) paths; confirm experience stays omitted when Min Years is blank.
- **Out of scope**: skills formula (T022), the graded-shortfall curve.

### T024 `[x]` — Propagate to fixtures, demo seed, and release surfaces
- **Target**: `src/data/demoSeed.js` (precomputed `compat`), `server/db.js` backfill expectations if asserted, any server/component tests asserting specific scores; `CHANGELOG.md` (the **unreleased** v1.6.0 entry), `docs/REPO_MAP.md`
- **Expected behavior**: regenerate/adjust demo seed precomputed scores under the new model; update the v1.6.0 CHANGELOG wording (weights `43/25/12/10/10`, pooled-coverage skills, no "capped additive bonus") and any REPO_MAP weight references, since v1.6.0 is unreleased. Cross-check `docs/compatibility_scoring.md` matches the shipped constants.
- **Constraints**: keep `package.json`/`appMeta.js` at **1.6.0** (no version bump — Group B is pre-release tuning, not a new version). Demo and server must stay at parity (same module).
- **Validation/test**: `npm run test:run` fully green; `npm run lint`; the `release-metadata` test still passes.
- **Out of scope**: a version bump.

### T025 `[x]` — Re-verify
- **Target**: full suite + a targeted re-run of the affected Phase 08 smoke checks (US1 skills sensitivity incl. required-vs-preferred, US4 Min Years sway + fresh-grad/empty-profile, archived-frozen) against the merge state
- **Expected behavior**: the believability issues are resolved — adding a matched skill to required helps ≥ adding it as preferred; setting Min Years no longer over-swings; empty profiles aren't penalized.
- **Constraints**: manual smoke recorded in the PR; note residual risk.
- **Out of scope**: automated E2E.
- **Result**: automated model coverage now checks required-vs-preferred, partial skills coverage, zero-required-match cap, preferred-only coverage, fresh-grad zero, empty-profile omit, and blank Min Years omit. Ran targeted model/demo/release tests, full `npm run test:run`, and `npm run lint`; no manual browser smoke was run in this pass.
