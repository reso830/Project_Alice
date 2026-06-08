# Tasks: Compatibility Engine

**Feature**: `036-compatibility-engine` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small and ordered; `[P]` marks tasks that can run in parallel with their siblings (different files, no shared edits). The project practices TDD — where a task pairs an implementation file with a test file, **write the failing test first**, confirm it fails for the right reason, then implement. Commands: `npm run test:run`, `npm run lint`.

Phase dependency: 01 → 02 → 03 → 04/05 (parallel) → 06 → 07 → 08.

---

## Phase 01 — Pure scoring module

### T001 — Create the deterministic scoring module
- **Target**: `src/models/compatibility.js` (new)
- **Expected behavior**: Export `COMPAT_WEIGHTS` (skills 35, roleAlignment 25, experience 20, keywords 10, certifications 10), `COMPAT_BANDS` + `getCompatLabel(score)` (Low 0–39 / Medium 40–64 / High 65–84 / Great 85–100), and `computeCompatibility(profile, application, { weights = COMPAT_WEIGHTS, asOf } = {}) → { score, label }`. Implement the five category functions, the `derivedYears(experience, asOf)` helper, normalization/tokenization helpers, active-category selection, weight renormalization, and final `round`+clamp to 0–100. Formulas are fixed in [research.md](research.md) §D5/§D6 and [data-model.md](data-model.md) §4.
- **Constraints**: Pure — **no I/O, no `Math.random`, no implicit `Date.now()`** (time enters only via `asOf`). Does not mutate arguments. Preferred-skill credit is capped so a profile with zero required coverage cannot reach a full skills sub-score (FR-005). Experience graded by closeness, full at ≥ requirement, no overshoot bonus (FR-013). Absent categories renormalize; zero active → `0`.
- **Validation/test**: `tests/models/compatibility.test.js` (T002).
- **Out of scope**: any per-category breakdown in the return value (037); reading repos/DB; display logic.

### T002 — Unit-test the scoring contract
- **Target**: `tests/models/compatibility.test.js` (new)
- **Expected behavior**: Cover determinism (identical inputs incl. fixed `asOf` → identical score); proficiency weighting (level 5 match > level 2 match); preferred = partial credit and cannot exceed required coverage; experience grading (near-miss > large shortfall; ≥ requirement caps at full, no overshoot bonus); renormalization when a category is absent; band boundaries at 39/40/64/65/84/85; sparse profile + empty JD → deterministic low score with **no throw**; zero active categories → 0.
- **Constraints**: Use fixed `asOf` for any current-role fixture. No network, no DB.
- **Validation/test**: `npm run test:run -- tests/models/compatibility.test.js` green; `npm run lint`.
- **Out of scope**: server/route behavior (Phase 03).

---

## Phase 02 — `minYearsExperience` field (model + persistence, all modes)

### T003 — App model: normalize + validate `minYearsExperience`
- **Target**: `src/models/application.js`
- **Expected behavior**: `normalizeApplication` coerces `minYearsExperience` to a non-negative integer or `null`. `validateApplication` flags a negative / non-integer / non-numeric non-empty value as invalid **without silent coercion**. (Keep existing `clampCompat` as the defensive `compat` backstop.)
- **Constraints**: No new required field; default `null`. Centralized in the shared model (constitution).
- **Validation/test**: `tests/models/application.test.js` — add cases for valid int, `null`/empty, and rejected invalid values.
- **Out of scope**: scoring; UI.

### T004 — Column mapping for `min_years_experience`
- **Target**: `server/db/columns.js`
- **Expected behavior**: Add `minYearsExperience ↔ min_years_experience` to `FIELD_TO_COLUMN`, `INSERTABLE_COLUMNS`, `APPLICATION_COLUMNS_WITHOUT_USER_ID`; map it in `toRecord` (`row.min_years_experience ?? null`) and `toRow` (integer or `null`, no JSON/boolean special-casing).
- **Constraints**: Backend-agnostic; do not import `server/db.js` (cold-start invariant).
- **Validation/test**: `tests/server/repositories/columns.test.js` — round-trip mapping incl. `null`.
- **Out of scope**: schema DDL (T005/T007).

### T005 — Local SQLite migration
- **Target**: `server/db.js`
- **Expected behavior**: Add `ensureColumn(targetDb, 'applications', 'min_years_experience', 'INTEGER')` in `initSchema`.
- **Constraints**: Idempotent/additive (matches existing `ensureColumn` calls); nullable; no default beyond NULL.
- **Validation/test**: `tests/server/foundation.test.js` (schema) or an applications test asserting create/read of the field locally.
- **Out of scope**: Supabase DDL.

### T006 — Request validation: add field, remove client-writable `compat`
- **Target**: `server/validation/application.js`
- **Expected behavior**: Add `minYearsExperience: z.union([z.number().int().nonnegative(), z.null()]).optional()` (accept empty→null) to `writableFields`. **Remove `compat`** from `writableFields` so it is no longer client-writable (server-authoritative).
- **Constraints**: `.strip()` already drops unknown keys; ensure a client-sent `compat` is ignored, not rejected. Clear field error messages for invalid `minYearsExperience`.
- **Validation/test**: `tests/server/validation.test.js` — `minYearsExperience` accepted/rejected; `compat` no longer round-trips from the client.
- **Out of scope**: computing `compat` (Phase 03).

### T007 — Supabase adapter + migration + schema probe
- **Target**: `server/repositories/supabase/applications.js`, `server/health.js`, [data-model.md](data-model.md) §1 (SQL)
- **Expected behavior**: Ensure `min_years_experience` flows through Supabase create/update (plain integer; not in `JSONB_COLUMNS`/`BOOLEAN_COLUMNS`; include a `null` default in the `create` row block alongside the others). Add the documented `ALTER TABLE … ADD COLUMN IF NOT EXISTS min_years_experience integer;` to data-model. Add an `assertHostedSchema` probe for `applications.min_years_experience` (failOn `UNDEFINED_COLUMN`, `docPath: 'specs/036-compatibility-engine/data-model.md §1'`).
- **Constraints**: Additive; parity with SQLite; probe must fail fast on an unmigrated deploy.
- **Validation/test**: `tests/server/repositories/supabase/applications.test.js` (column passthrough); `tests/server/health.test.js` (probe present).
- **Out of scope**: applying the SQL to any live project.

---

## Phase 03 — Server-authoritative scoring & recompute

### T008 — Compatibility orchestration service
- **Target**: `server/services/compatibility.js` (new)
- **Expected behavior**: Export helpers over an injected repo bundle: `scoreApplication(appFields, profile, asOf) → number` (delegates to the pure module) and `recomputeActive(repos, profile, asOf)` (loads `applications.getAll()`, scores each, updates **only changed** `compat`). Do not touch archived applications.
- **Constraints**: Depends only on `{ applications, profile }` repos + `src/models/compatibility.js`. No direct DB access. SQLite path should update changed rows efficiently (wrap in a transaction if practical via the repo).
- **Validation/test**: exercised via route tests (T009/T010); a focused unit test optional.
- **Out of scope**: demo store (Phase 04).

### T009 — Compute `compat` on application create/update
- **Target**: `server/routes/applications.js`
- **Expected behavior**: In `POST /` and `PATCH /:id`, load the current profile (`req.repos.profile.get()`), compute `compat` from the new/merged JD fields via T008 using `resolveRequestDate(req)` as `asOf`, and persist it (overriding any client value). An archived application edited via its own PATCH recomputes its score.
- **Constraints**: Preserve existing status-transition validation/order; one profile read per write; do not regress the no-op update contract.
- **Validation/test**: `tests/server/applications.test.js` — created/updated record carries a computed `compat`; a client-supplied `compat` is ignored; archived-self-edit recomputes.
- **Out of scope**: profile-triggered recompute (T010).

### T010 — Recompute active applications on profile save
- **Target**: `server/routes/profile.js`
- **Expected behavior**: After `req.repos.profile.upsert(req.body)`, call T008's `recomputeActive` with `resolveRequestDate(req)`. Archived applications are excluded (frozen).
- **Constraints**: Recompute must not change the profile response shape; only changed scores written; failures surface via the existing error path.
- **Validation/test**: `tests/server/profile.test.js` — saving the profile updates active applications' `compat` and leaves archived scores unchanged.
- **Out of scope**: demo mode.

---

## Phase 04 — Demo mode parity [P with Phase 05]

### T011 — Demo store client-side scoring
- **Target**: `src/data/demoStore.js`
- **Expected behavior**: In `create`/`update`, compute `compat` via `src/models/compatibility.js` against the in-memory demo profile. If the demo profile is mutable at runtime, recompute the in-memory applications when it changes (mirror archived-frozen behavior).
- **Constraints**: Same pure module as the server (no divergence); no network.
- **Validation/test**: `tests/data/demoStore.test.js` — created/updated demo app carries a computed `compat`.
- **Out of scope**: server paths.

### T012 — Demo seed data
- **Target**: `src/data/demoSeed.js`
- **Expected behavior**: Add realistic `minYearsExperience` values and precomputed `compat` scores to seeded applications so the portfolio renders stable, sensible scores offline.
- **Constraints**: Seed `compat` should match what the module would produce for the seeded profile/app (deterministic).
- **Validation/test**: demo renders in `npm run dev` demo runtime; existing demo seed tests stay green.
- **Out of scope**: scoring logic changes.

---

## Phase 05 — Display [P with Phase 04]

### T013 — CompatBar: four-band label, non-color-only
- **Target**: `src/components/CompatBar.js`
- **Expected behavior**: Replace the current 3-threshold coloring (≥80/≥60) with the four spec bands and render the **label text** (Low/Medium/High/Great) beside the percentage, using `getCompatLabel` from the shared module.
- **Constraints**: Non-color-only (FR-016); informative, non-authoritative framing; single render surface reused by Tracker card + overlay.
- **Validation/test**: `tests/components/CompatBar.test.js` (new) — correct label per band incl. boundaries; label text present.
- **Out of scope**: Modal field.

### T014 — Modal: `minYearsExperience` field + label
- **Target**: `src/components/Modal.js`
- **Expected behavior**: Add a labeled, keyboard-operable `minYearsExperience` editor (numeric/empty) in the application overlay; ensure the CompatBar shows the band label. After save, the rendered record reflects the server-computed score (no client compute required).
- **Constraints**: Labeled form control; reject invalid input consistent with model/schema messaging; do not write `compat` from the client.
- **Validation/test**: `tests/components/Modal.test.js` — field renders, edits the draft, persists via the save payload.
- **Out of scope**: live preview (T015).

### T015 — [P][Optional] Modal live score preview
- **Target**: `src/components/Modal.js`
- **Expected behavior**: Optionally recompute a preview `compat` via the shared module from the in-memory profile + current draft as the user edits, so the bar updates before save. Purely additive polish.
- **Constraints**: Preview only — the server remains authoritative on save; skip if it risks scope creep.
- **Validation/test**: manual; optional unit assertion.
- **Out of scope**: changing persisted values from the client.

---

## Phase 06 — Remove randomness & backfill

### T016 — Remove random `compat` assignments
- **Target**: `src/utils/jobPostParser.js` (lines ~374, ~394), `src/services/llmParser.js`
- **Expected behavior**: Delete the `Math.floor(Math.random()*101)` `compat` assignments. Parsers no longer set `compat`; the server computes it on create.
- **Constraints**: Do not break the parser draft shape otherwise; `minYearsExperience` stays unset by parsers (manual entry only).
- **Validation/test**: `tests/utils/jobPostParser.test.js`, `tests/services/llmParser.jd.test.js` — update any assertions expecting a random `compat`.
- **Out of scope**: scoring logic.

### T017 — One-time backfill of legacy scores
- **Target**: local boot/migration step (e.g. `server/db.js`/init or a `server/db-*.js` maintenance script) + documented hosted step in [data-model.md](data-model.md)/[quickstart.md](quickstart.md)
- **Expected behavior**: Recompute `compat` for every existing application against the current profile so no record keeps a legacy random value (SC-003). Local: run once during migration/boot. Hosted: documented one-time recompute (e.g. a single profile re-save or maintenance run).
- **Constraints**: Idempotent and safe to re-run; deterministic; does not alter `minYearsExperience` or other fields.
- **Validation/test**: a test seeding an app with an arbitrary `compat` then asserting the backfill replaces it with the computed value.
- **Out of scope**: continuous recompute (covered by Phase 03 triggers).

---

## Phase 07 — Release Prep *(mandatory)*

### T018 — Version bump + changelog + docs
- **Target**: `package.json` (`1.5.0`→`1.6.0`), `package-lock.json` (root `version`), `src/pages/welcome/shared/appMeta.js` (`APP_VERSION` `v1.5.0`→`v1.6.0`), `CHANGELOG.md`, `README.md`, `docs/REPO_MAP.md`, `docs/feature_roadmap.md`
- **Expected behavior**: Bump the version in all three surfaces; add a CHANGELOG entry for the compatibility engine; update README for the new user-facing behavior (real compatibility scores + Min Years Experience field); add `src/models/compatibility.js` and `server/services/compatibility.js` to REPO_MAP; tick `036-compatibility-engine` in the roadmap. Note the hosted `min_years_experience` migration where deployment docs reference schema (no new env vars → `docs/deployment.md` only if a runtime/env change exists; otherwise skip with a note).
- **Constraints**: Keep `package.json` + `package-lock.json` root versions in sync (release-prep checklist); run **full** suite AFTER the bump.
- **Validation/test**: `npm run test:run` (full) green post-bump; `npm run lint`; docs sanity check.
- **Out of scope**: feature code changes.

---

## Phase 08 — Browser Smoke Test *(mandatory — UI feature)*

### T019 — Walk each user story's Independent Test in a browser
- **Target**: running app (`npm run dev`), local mode, against the to-be-merged state
- **Expected behavior**: Execute [quickstart.md](quickstart.md): (US1) score is real, identical on reload, rises/falls with matching skills; (US2) CompatBar shows number + band label; (US3) profile change updates active scores; (US4) Min Years Experience contributes/omits and rejects invalid input; preferred-skill partial credit; archived-frozen recompute; offline/AI-off determinism; demo parity.
- **Constraints**: Ordered AFTER Release Prep so it exercises the actual merge state (constitution Amendment 1.3.0). Note any deviation with residual risk.
- **Validation/test**: manual checklist pass recorded in the PR.
- **Out of scope**: automated E2E.
