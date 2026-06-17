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

> **Superseded by D11 (2026-06-16):** weights are now `skills 43 · roleAlignment 25 · experience 12 · keywords 10 · certifications 10`. Original decision kept below for history.

**Decision**: `skills 35, roleAlignment 25, experience 20, keywords 10, certifications 10`. Configurable; absent categories renormalize.

**Why**: User-selected "Balanced" profile. Skills still leads (only fully-structured both-sides signal), role and experience carry real weight, and the coarse text signals (keywords, certifications) are kept light to avoid fake precision. Weights live in the module as `COMPAT_WEIGHTS` so they are trivially tunable and unit-testable.

## D3 — Determinism vs. ongoing-role tenure (the `asOf` parameter)

**Decision**: `computeCompatibility` takes an explicit `asOf` date used only to measure the duration of `currentWork: true` experience entries. Determinism is defined as "same inputs **including `asOf`** → same output."

**Why**: Years of experience for an ongoing role grows with the calendar, which would otherwise make the score time-dependent and break FR-001. Making `asOf` an explicit input keeps the function pure: the server passes `resolveRequestDate(req)`, tests pass a fixed date. Because scores are **persisted and only recomputed on a trigger** (app write or profile save), natural tenure drift is *not* applied continuously — it materializes only at the next recompute, which is the intended behavior, not silent corruption.

## D4 — Matching is normalized-exact (no fuzzy/semantic)

**Decision**: Lowercase, collapse whitespace, tokenize on non-alphanumerics, drop a small stopword set, de-duplicate. Matching is set membership / exact token equality.

**Why**: Deterministic and cheap; aligns with the brief's "no fake precision." The known cost — "React" ≠ "React.js", "JS" ≠ "JavaScript" — is accepted for v1 because the structured **skills** category (exact skill names the user curated, matched against parser-extracted skill names) dominates. Semantic/synonym matching is an explicit non-goal and a clean future extension point (the category list is open).

## D5 — Category formulas (normalized to [0,1])

> **Superseded in part (2026-06-16, post-smoke-test).** The **skills** formula below is replaced by **D10** (pooled weighted coverage), and the default **weights** + **experience activation** are revised by **D11**. The role-alignment, keywords, and certifications formulas and the aggregate/renormalization mechanism are unchanged. Kept here for history.

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

---

## Revision — Group B (scoring v2), 2026-06-16

Post-smoke-test review of the deployed scoring surfaced two believability problems. These decisions revise D5 (skills formula, default weights, experience activation); everything else is unchanged. Full math and worked examples live in [`docs/compatibility_scoring.md`](../../docs/compatibility_scoring.md).

### D10 — Skills: pooled weighted coverage (replaces the D5 skills formula)

**Problem**: D5 made `requiredScore` a *mean* over the required list but `preferred` an *additive* bonus. When required coverage was low, adding a matched skill to **required** barely moved the score (the `+1` in the denominator diluted it), while adding the same skill to **preferred** added a clean flat bump — so a preferred match could out-score a required match (observed on app#990: Jest@4 → +6% as required vs +11% as preferred). The discount factor wasn't the cause; the *mean-vs-additive* structure was.

**Decision**: Score skills as one **pooled, weighted coverage** fraction. Each required skill carries weight `1`, each preferred skill carries weight `w = 0.69` (the "a preferred skill at proficiency 4 should weigh like a required skill at ~2.75" intuition → `2.75 / 4 ≈ 0.69`). A matched skill contributes its proficiency fraction `level/5`; an unmatched skill contributes `0` but keeps its weight in the denominator:

```
num = Σ_matched-required (level/5)·1 + Σ_matched-preferred (level/5)·w
den = |required|·1 + |preferred|·w
skills = num / den
```

Guards: if required is non-empty and **zero** required skills are matched, cap `skills = min(0.35, skills)` (nice-to-haves can't mask failing the actual requirements). If **no** required skills are listed (preferred-only posting), the `w` cancels and the formula naturally becomes preferred coverage `Σ(level/5)/|preferred|`. Both lists empty → category inactive.

**Why**: Proven structurally — a required match's marginal contribution always exceeds the same skill as preferred for any list size (no dilution edge case), so the inversion is impossible; unmatched required skills stay in the denominator, so partial coverage stays honest (matching 5 of 6 strong skills ≈ 67%, not 100%); a single parameter `w` instead of three.

### D11 — Experience: lighter weight + data-aware activation

**Problem**: experience at weight 20 let one coarse, often-blank field swing the total by ~±15 points (observed: app#984 moved 24% → 39% just by setting Min Years). And an empty `experience` section scored `0`, penalizing an unfilled profile rather than treating it as "no data."

**Decision (weight)**: drop experience weight **20 → 12** and move the freed **8** into **skills (35 → 43)**. New default weights: **skills 43 · role alignment 25 · experience 12 · keywords 10 · certifications 10**. This caps experience's sway to ~±8 points when present; it remains omitted+renormalized whenever Min Years is blank (the common case, since postings rarely state explicit years).

**Decision (activation)**: when a job states `minYearsExperience > 0`, the experience category is scored as:
- profile **has** experience entries (`derivedYears > 0`) → graded as before (`candidate ≥ required ? 1 : candidate/required`);
- profile has **no** experience but **does** have other substantive content (summary, education, skills, certifications, awards, or languages) → `0` (a deliberate "fresh-grad has no experience yet" signal — a genuine shortfall);
- profile is **essentially empty** (no experience *and* no other substantive content) → **omit** the category and renormalize (nothing to assess; don't penalize an unfilled profile).

**Why**: mirrors the skills rule (missing *data* → omit, not score 0) while preserving an honest zero for a genuinely experience-less but otherwise-complete profile. The curve and `derivedYears` (verified accurate against the seeded ~7.8-year persona) are unchanged.
