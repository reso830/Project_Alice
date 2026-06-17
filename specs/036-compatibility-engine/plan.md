# Implementation Plan: Compatibility Engine

**Branch**: `036-compatibility-engine` | **Date**: 2026-06-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/036-compatibility-engine/spec.md`

## Summary

Replace the **random** `compat` value with a **deterministic compatibility score** computed by a single pure module from the user's profile and an application's JD data. Scoring is **server-authoritative** for local/hosted modes (computed and persisted on application create/update, and recomputed for all active applications when the profile is saved) and reuses the **same pure module client-side** in demo mode (which has no server). The engine outputs an integer 0–100 score plus a derived band label (Low/Medium/High/Great); the per-category breakdown is deferred to 037.

A single new optional application field, `minYearsExperience`, gives the experience category a comparison target (manually entered — the JD parser never extracts it); the candidate's years are derived at compute time from the profile's experience date ranges.

## Technical Context

**Language/Version**: Node.js (ESM), Vanilla JS frontend (Vite), Express backend  
**Primary Dependencies**: `better-sqlite3` (local), `@supabase/supabase-js` (hosted), `zod` (validation); **no new dependency** for scoring (pure JS)  
**Storage**: `applications.compat` (existing INTEGER column, reused) + new `applications.min_years_experience` (INTEGER, nullable); profile + `profile_skill` store (031/032)  
**Testing**: Vitest (`tests/models`, `tests/server`, `tests/components`, `tests/data`)  
**Target Platform**: Desktop + mobile browsers; Vercel serverless (hosted) / local Node (local) / client-only (demo)  
**Project Type**: Web application (Vite frontend + Express backend, dual-mode persistence)  
**Performance Goals**: Profile save recompute is O(active applications); a personal tracker holds tens–low-hundreds of records → well under a second. Per-application write adds one profile read + one in-memory score.  
**Constraints**: Deterministic (no randomness; the only time input is an explicit as-of date for ongoing-role tenure); **no LLM/network in the scoring path**; works offline and with AI disabled; local-first.  
**Scale/Scope**: One profile vs. N applications per user; N is small. Scoring is one synchronous pass per application.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Required fields preserved** — no change to company/title/status/last_status_update/responsibilities. `compat` already exists; `minYearsExperience` is optional. ✅
- **Business logic separated from UI; centralized validation** — scoring lives in one pure module (`src/models/compatibility.js`), reused by server, demo store, and (optionally) the Modal; field validation stays in `src/models/application.js` + the Zod schema. ✅
- **Validation / no silent corruption** — `minYearsExperience` validated as a non-negative integer or empty (rejected, not coerced); final score clamped 0–100; `compat` becomes server-authoritative (client-supplied value ignored), removing a corruption vector. ✅
- **Workflows + states** — score surfaces in Tracker cards and the detail overlay; sparse profile / empty JD produce a deterministic low score, never an error (explicit empty/edge handling). ✅
- **Automated tests for core logic + changed behavior** — new `tests/models/compatibility.test.js` (determinism, weighting, renormalization, bands, experience), plus updated model/server/validation/component tests. Lint/format: `npm run lint`, `npm run format` (existing). ✅
- **Privacy local-first** — scoring is local deterministic computation; no LLM, analytics, or external calls. ✅
- **Responsive / a11y / non-color-only** — `CompatBar` updates to show the numeric score **and** the band label (text), satisfying non-color-only; keyboard/screen-reader unaffected. ✅
- **Future extensibility** — categories and weights are a config-driven list with a renormalization rule, so adding a category (e.g. a future structured experience signal, or the 037 breakdown) needs no rewrite. ✅

No violations → Complexity Tracking table omitted.

## Architecture & Data Flow

### The pure scoring module (`src/models/compatibility.js`)

A single, side-effect-free module — the centralized source of truth for scoring. No I/O, no `Math.random`, no implicit `Date.now()`.

Exports (final names settled in implementation):
- `COMPAT_WEIGHTS` — default category weights: **skills 43, roleAlignment 25, experience 12, keywords 10, certifications 10** (configurable; sum need not be relied on — categories renormalize). *(Revised 2026-06-16, Group B — was `35 · 25 · 20 · 10 · 10`; see [research.md](research.md) D11 and [data-model.md §7](data-model.md).)*
- `COMPAT_BANDS` / `getCompatLabel(score)` — bands **Low 0–39 · Medium 40–64 · High 65–84 · Great 85–100**.
- `computeCompatibility(profile, application, { weights = COMPAT_WEIGHTS, asOf } = {}) → { score, label }` — `score` is an integer 0–100; `label` derived from it.

Each category produces a normalized sub-score in `[0,1]`; only categories with usable input on **both** sides are "active"; active weights are **renormalized** to sum to 1; `score = round(100 × Σ effectiveWeightᵢ × subScoreᵢ)`; zero active categories → `0`.

Category logic (full rules in [research.md](research.md) and [data-model.md](data-model.md)):
- **skills** — required `application.skills` matched against profile `{name, level}`; each match credited by `level/5` (proficiency weighting). *(Revised 2026-06-16, Group B — the original "capped additive preferred bonus" is replaced by **pooled weighted coverage**: required weight 1, preferred weight 0.69, unmatched required kept in the denominator, with a 0.35 cap when zero required matched. See [research.md](research.md) D10 and [`docs/compatibility_scoring.md`](../../docs/compatibility_scoring.md).)*
- **roleAlignment** — normalized token overlap of `application.jobTitle` against a profile corpus of `experience[].role` + `summary`.
- **experience** — derived candidate years vs `application.minYearsExperience`, **graded by closeness** (≥ requirement → full, no overshoot bonus; short → `candidate/required`). Omitted when the requirement is blank/0.
- **keywords** — normalized token overlap of a JD corpus (responsibilities + jobTitle + skills + preferredSkills) against a profile corpus (summary + experience responsibilities + skill names); bounded `[0,1]` so a long JD cannot dominate.
- **certifications** — profile `certifications[].name` tokens matched against the JD text corpus (planning default; low weight).

### Server-authoritative flow (local + hosted)

```
Application create/update (POST/PATCH /applications)
  → route loads current profile via req.repos.profile.get()
  → computeCompatibility(profile, mergedAppFields, { asOf: resolveRequestDate(req) })
  → persist score into compat (client-supplied compat is ignored)

Profile save (PUT /profile)
  → req.repos.profile.upsert(body)
  → recompute ALL ACTIVE applications: getAll() → score each → update changed compat
  → archived applications are NOT touched (frozen snapshot; FR-009)
```

A thin orchestration helper (`server/services/compatibility.js`) wraps "score one application against the profile" and "recompute all active," so both routes share one code path and the routes stay declarative. The helper depends only on the injected `{ applications, profile }` repos and the pure module.

### Demo flow (client-only, no server)

`src/data/demoStore.js` `create`/`update` call the same `computeCompatibility` against the in-memory demo profile; if the demo profile is editable, its setter recomputes the in-memory applications. The demo seed (`src/data/demoSeed.js`) ships realistic precomputed scores so the portfolio renders identically offline.

### Display

`compat` is already rendered by `CompatBar` in the Tracker card and the detail overlay. The change is presentational only: `CompatBar` maps the score to the **four** bands and shows the **label text** beside the percentage (non-color-only). The Modal gains a `minYearsExperience` field; after save, the client renders the server-returned record, so the freshly computed score appears with no extra client compute. Live in-Modal preview (recomputing as the user edits, via the shared module) is an **optional** enhancement, not required for correctness.

## Validation Approach

- **Unit (pure module)** — `tests/models/compatibility.test.js`: identical inputs → identical score (determinism, with a fixed `asOf`); proficiency weighting (level 5 > level 2); preferred = partial credit and cannot exceed required coverage; experience graded (near-miss > large shortfall; ≥ requirement caps at full, no overshoot bonus); renormalization when a category is absent; band boundaries (39/40/64/65/84/85); sparse/empty profile and empty JD → deterministic low score, no throw.
- **Model** — `tests/models/application.test.js`: `minYearsExperience` normalizes (non-negative int or null) and `validateApplication` rejects invalid values without coercion.
- **Server** — `tests/server/applications.test.js`: create/update compute and persist `compat`; a client-supplied `compat` is ignored. `tests/server/profile.test.js`: saving the profile recomputes active applications and **leaves archived scores frozen**. `tests/server/validation.test.js`: `minYearsExperience` accepted/rejected; `compat` no longer client-writable. `tests/server/repositories/columns.test.js`: `min_years_experience` field↔column mapping round-trips; Supabase adapter parity test updated.
- **Component** — `CompatBar` renders the correct label per band and is non-color-only.
- **Lint/format** — `npm run lint`, `npm run format`. **Full suite** — `npm test` after the version bump (per release-prep guidance).

## Affected Areas

### Files/components likely to be **inspected** (read, likely no change)
- [src/pages/Tracker.js](../../src/pages/Tracker.js) — confirm the `compatMin`/`compatMax` quick-filter still operates on the now-computed `compat` (it reads the field generically; expected no change).
- [src/pages/Profile.js](../../src/pages/Profile.js) — confirm profile save flows through the API path that triggers server recompute.
- [src/services/api.js](../../src/services/api.js) — confirm create/update/profile-save responses carry the server-computed record (the client renders the returned `compat`).
- [src/components/Card.js](../../src/components/Card.js) — confirm it delegates to `CompatBar` (label change lands centrally).
- [server/db/applications.js](../../server/db/applications.js) — `create` default block may need a `min_years_experience` default; otherwise unchanged.

### Files/components likely to be **modified**
- **NEW** [src/models/compatibility.js](../../src/models/compatibility.js) — the pure scoring module (weights, bands, `computeCompatibility`, `getCompatLabel`).
- **NEW** [server/services/compatibility.js](../../server/services/compatibility.js) — orchestration helper (score-one / recompute-all-active) over injected repos.
- [src/models/application.js](../../src/models/application.js) — add `minYearsExperience` to `normalizeApplication` / `validateApplication`.
- [server/db/columns.js](../../server/db/columns.js) — add `minYearsExperience ↔ min_years_experience` to `FIELD_TO_COLUMN`, `INSERTABLE_COLUMNS`, `APPLICATION_COLUMNS_WITHOUT_USER_ID`, `toRecord`, `toRow`.
- [server/db.js](../../server/db.js) — `ensureColumn(... 'min_years_experience', 'INTEGER')` (idempotent local migration).
- [server/health.js](../../server/health.js) — add a `assertHostedSchema` probe for `applications.min_years_experience` (points at this feature's data-model SQL).
- [server/validation/application.js](../../server/validation/application.js) — add `minYearsExperience` (non-negative int or empty); **remove `compat`** from client-writable fields (server-authoritative).
- [server/routes/applications.js](../../server/routes/applications.js) — compute `compat` on create/update using the current profile.
- [server/routes/profile.js](../../server/routes/profile.js) — recompute active applications after upsert.
- [server/repositories/supabase/applications.js](../../server/repositories/supabase/applications.js) — ensure `min_years_experience` flows through create/update (integer; no JSONB handling needed).
- [src/data/demoStore.js](../../src/data/demoStore.js) — compute `compat` in `create`/`update`; recompute on demo-profile change.
- [src/data/demoSeed.js](../../src/data/demoSeed.js) — seed `minYearsExperience` + precomputed `compat` for realistic demo data.
- [src/components/CompatBar.js](../../src/components/CompatBar.js) — render four-band label text (non-color-only) using `getCompatLabel`.
- [src/components/Modal.js](../../src/components/Modal.js) — add a `minYearsExperience` field editor; show the band label; (optional) live preview.
- [src/utils/jobPostParser.js](../../src/utils/jobPostParser.js) — **remove** the random `compat` assignment (lines ~374, ~394).
- [src/services/llmParser.js](../../src/services/llmParser.js) — **remove** the random `compat` assignment.

### Tests likely to be **added or updated**
- **NEW** `tests/models/compatibility.test.js` — the scoring contract (see Validation Approach).
- `tests/models/application.test.js` — `minYearsExperience` normalize/validate.
- `tests/server/applications.test.js`, `tests/server/profile.test.js`, `tests/server/validation.test.js`, `tests/server/repositories/columns.test.js`, `tests/server/repositories/supabase/applications.test.js`.
- `tests/components/CompatBar.test.js` (band/label), Modal test for the new field.
- Demo store test for client-side scoring.

### Explicitly **out of scope**
- Per-category breakdown / explanation UI and any stored breakdown — **feature 037**.
- A user-facing weights editor (weights stay code/config-configurable).
- Semantic / fuzzy / synonym skill matching ("React" ≠ "React.js" in v1).
- Per-skill years-of-experience requirements (no per-skill tenure data).
- ATS / resume quality checks — **feature 038**.
- Parser extraction of `minYearsExperience` (manual entry only).

## Migration & Backfill

- **Local (SQLite)**: idempotent `ensureColumn` adds `min_years_experience` on boot. The one-time backfill (below) runs in the same boot/migration step, so existing rows' legacy random `compat` is replaced immediately — no legacy random value survives normal migration.
- **Hosted (Supabase)**: additive `ALTER TABLE applications ADD COLUMN min_years_experience integer;` (SQL in [data-model.md](data-model.md)); `assertHostedSchema` gains a probe so an unmigrated deploy fails fast.
- **Backfill (convergence for SC-003)**: a one-time recompute of **every** application's `compat` — **active *and* archived** — against the current profile so no record keeps a legacy random value. This is a **distinct maintenance pass, not a profile re-save**: a profile save runs the *ongoing* recompute, which by design excludes archived snapshots (FR-009), so it would leave archived legacy values in place. The one-time backfill instead iterates all records (e.g. `getAll()` + `getAllArchived()`), scores each once, and writes it; archived apps are scored **once** here (a random value is not a snapshot worth preserving) and then freeze. Local: run during the boot/migration step (cheap, synchronous, covers both archived and active). Hosted: a documented one-time all-applications maintenance run (script or admin action) — explicitly **not** a profile re-save. Captured as task T017.

## Risks & Tradeoffs

| Risk / tradeoff | Impact | Mitigation |
|---|---|---|
| Profile save triggers O(N) application recompute | Extra writes per profile save | N is small for a personal tracker; only **changed** scores are written; SQLite path wrapped in a transaction. Hosted batching noted as future work if N grows. |
| Experience tenure depends on an "as-of" date (ongoing roles) | Strict determinism nuance | `asOf` is an explicit parameter (server passes the request date; tests pass a fixed date). Because scores are **persisted and only recomputed on a trigger**, tenure drift is not silently applied — it materializes only at the next recompute. Documented in research.md. |
| Coarse normalized-exact text matching misses variants ("JS"/"JavaScript") | Some real matches missed | Accepted v1 tradeoff (anti-fake-precision); skills (structured) dominate the weighting; semantic matching is an explicit non-goal/future. |
| `compat` becomes server-authoritative; client no longer writes it | A client still sending `compat` would be ignored | Remove `compat` from the write schema; update tests; Tracker filter reads `compat` from records (unaffected). |
| Demo mode must replicate scoring client-side | Divergence risk between server and demo | Both call the **same** pure module — divergence is impossible by construction; demo seed ships precomputed scores. |
| Bulk recompute on a large hosted profile save | Latency on Supabase (N round-trips) | Update only changed rows; acceptable at current scale; batched update is a noted future optimization. |

## Notes for `/speckit.tasks`

Suggested phase order: (1) pure module + tests → (2) `minYearsExperience` field across model/columns/db/validation/supabase + tests → (3) server orchestration (routes + service) + tests → (4) demo store + seed → (5) display (CompatBar label, Modal field) → (6) remove random-compat assignments + backfill → (7) **Release Prep** → (8) **Browser Smoke Test**. The last two phases are mandatory per the constitution (Amendments 1.1.0 + 1.3.0).
