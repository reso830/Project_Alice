# Research: Compatibility Engine

Decisions and rationale behind [plan.md](plan.md). All choices trace to the spec's clarifications (2026-06-08) plus codebase grounding.

## D1 — Scoring location: shared pure module, server-authoritative

**Decision**: One pure module `src/models/compatibility.js`. In local/hosted the **server** computes and persists `compat` (single source of truth); demo mode calls the **same module** client-side because it has no server.

**Why**: The spec requires *persist + recompute* and "no stale score ever shown." A profile change affects every application, so:
- **Server-authoritative** makes recompute atomic and consistent across devices/sessions, and matches the existing model where `compat` is a stored column the API returns.
- A **client-only** alternative would require the browser to PATCH every application after a profile save (N requests, racy) and could not guarantee freshness for another session — rejected.
- Demo mode is client-only in-memory ([demoStore.js](../../src/data/demoStore.js)), so the engine **must** be a pure, environment-agnostic module rather than server code. The same module then powers server, demo, and optional Modal live preview — divergence is impossible by construction.

**Rejected**: putting orchestration inside the repository adapters (they are single-store; scoring needs both profile + applications). Instead a thin `server/services/compatibility.js` orchestrates over the injected `{ applications, profile }` bundle, which routes already have.

## D2 — Default category weights: 35/25/20/10/10

**Decision**: `skills 35, roleAlignment 25, experience 20, keywords 10, certifications 10`. Configurable; absent categories renormalize.

**Why**: User-selected "Balanced" profile. Skills still leads (only fully-structured both-sides signal), role and experience carry real weight, and the coarse text signals (keywords, certifications) are kept light to avoid fake precision. Weights live in the module as `COMPAT_WEIGHTS` so they are trivially tunable and unit-testable.

## D3 — Determinism vs. ongoing-role tenure (the `asOf` parameter)

**Decision**: `computeCompatibility` takes an explicit `asOf` date used only to measure the duration of `currentWork: true` experience entries. Determinism is defined as "same inputs **including `asOf`** → same output."

**Why**: Years of experience for an ongoing role grows with the calendar, which would otherwise make the score time-dependent and break FR-001. Making `asOf` an explicit input keeps the function pure: the server passes `resolveRequestDate(req)`, tests pass a fixed date. Because scores are **persisted and only recomputed on a trigger** (app write or profile save), natural tenure drift is *not* applied continuously — it materializes only at the next recompute, which is the intended behavior, not silent corruption.

## D4 — Matching is normalized-exact (no fuzzy/semantic)

**Decision**: Lowercase, collapse whitespace, tokenize on non-alphanumerics, drop a small stopword set, de-duplicate. Matching is set membership / exact token equality.

**Why**: Deterministic and cheap; aligns with the brief's "no fake precision." The known cost — "React" ≠ "React.js", "JS" ≠ "JavaScript" — is accepted for v1 because the structured **skills** category (exact skill names the user curated, matched against parser-extracted skill names) dominates. Semantic/synonym matching is an explicit non-goal and a clean future extension point (the category list is open).

## D5 — Category formulas (normalized to [0,1])

Let `norm(s)` = lowercased, whitespace-collapsed; `tokens(s)` = `norm`→split on non-alphanumeric→drop stopwords→dedupe.

- **skills** — `profMap = {norm(name) → level}` from profile skills. For required set `R = dedupe(application.skills)`: `requiredScore = (Σ_{r∈R, r∈profMap} profMap[r]/5) / |R|`. For preferred set `P`: `preferredScore = (Σ_{p∈P, p∈profMap} profMap[p]/5) / |P|`. `skills = min(1, requiredScore + PREFERRED_FACTOR × preferredScore)` with `PREFERRED_FACTOR ≈ 0.3`. With `requiredScore = 0`, the ceiling is `0.3 < full` → preferred cannot mask missing required (FR-005). Active only if `|R| > 0` **or** `|P| > 0` and the profile has ≥1 skill.
- **roleAlignment** — `jt = tokens(application.jobTitle)`, `corpus = tokens(experience[].role joined + summary)`. `score = |jt ∩ corpus| / |jt|`. Active only if `|jt| > 0` and `|corpus| > 0`.
- **experience** — `required = application.minYearsExperience`. Active only if `required` is a number `> 0`. `candidate = derivedYears(profile.experience, asOf)`. `score = candidate ≥ required ? 1 : candidate/required` (graded; no overshoot bonus).
- **keywords** — `jd = tokens(responsibilities + jobTitle + skills + preferredSkills)`, `prof = tokens(summary + experience responsibilities + skill names)`. `score = |jd ∩ prof| / |jd|` (bounded [0,1]; long JD cannot dominate). Active only if both non-empty.
- **certifications** — `certTokens = tokens(certifications[].name)` grouped per cert; a cert "matches" if all/most of its salient tokens appear in `tokens(responsibilities + skills + preferredSkills)`. `score = matchedCerts / |certs|`. Active only if the profile has ≥1 certification and the JD text corpus is non-empty. *(Planning default — flagged in the spec as the one un-user-confirmed basis; low weight limits its influence.)*

**Aggregate**: `active = categories with usable input on both sides`; `W = Σ weight(active)`; `score = round(100 × Σ_{c∈active} (weight(c)/W) × subScore(c))`; `active = ∅ → 0`. Clamp 0–100.

## D6 — `derivedYears(experience, asOf)`

**Decision**: Sum each experience entry's duration in years (`dateEnded` or `asOf` if `currentWork`), from `dateStarted`. Entries with an unparhseable/blank `dateStarted` contribute 0. No overlap de-duplication in v1 (simple sum).

**Why**: Profile experience stores per-role date ranges, not a single total. A simple sum is deterministic and good enough for a coarse "meets N years" gate; overlap-aware tenure is a future refinement. Dates use the existing `MM/YYYY`/`YYYY` formats the profile model already normalizes.

## D7 — `compat` becomes server-authoritative

**Decision**: Remove `compat` from the client-writable Zod schema; the server computes it. The random assignments in `jobPostParser.js` and `llmParser.js` are deleted.

**Why**: A client-supplied score would contradict the engine and reintroduce the "random number" problem. Stripping it closes a corruption vector (constitution: no silent overwrites) and makes the server the single writer.

## D8 — Backfill for existing applications

**Decision**: A one-time recompute of all applications' `compat` so legacy random values are superseded (SC-003). Local: during the migration/boot step. Hosted: a documented one-time recompute.

**Why**: Recompute triggers (app write, profile save) would otherwise leave untouched applications showing the old random value indefinitely. A single backfill converges all records deterministically.

## D9 — Display: reuse `CompatBar`, add the label

**Decision**: Keep `CompatBar` as the single render surface; change its banding from the current 3 color thresholds (≥80/≥60) to the **four** spec bands and add the **label text** next to the percentage.

**Why**: Non-color-only (constitution + FR-016) and consistent presentation everywhere the bar already appears (Tracker card, detail overlay). The label mapping lives in the shared module so display and scoring never disagree.
