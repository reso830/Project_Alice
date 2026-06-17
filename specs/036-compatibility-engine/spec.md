# Feature Specification: Compatibility Engine

**Feature Branch**: `036-compatibility-engine`  
**Created**: 2026-06-08  
**Status**: Draft  
**Input**: Feature brief `docs/features/036-compatibility-engine.md`. Builds on the structured skill proficiency data (031), the first-class skill store (032), and the LLM JD parser (035). Consumed later by the Compatibility Insights Panel (037).

## Problem Statement

Every application carries a `compat` value (0–100) that is displayed read-only as a bar plus percentage (`src/components/CompatBar.js`), but the value is **random** — assigned by the parser on creation and never derived from anything real ([llmParser.js / api.md](../035-llm-jd-parser/contracts/api.md#L58)). It looks like a compatibility score but means nothing, which is the opposite of the project's "practical over hype / no fake precision" stance.

This feature replaces that placeholder with a **deterministic compatibility engine** that compares the user's structured profile against an application's structured job-description data and produces a repeatable score and a plain-language label. Scoring logic is deterministic code — never an LLM — so the same inputs always yield the same output, and the number reacts meaningfully when the profile or the job changes. The result must feel *informative*, not authoritative.

## Scope

**In scope**
- A deterministic, repeatable scoring engine that compares a profile and an application's JD data across weighted categories and outputs an integer 0–100 **score** plus a derived **label** (Low / Medium / High / Great).
- Reuse the existing application `compat` field as the storage location for the computed score; **persist** the score and keep it current — recompute when profile, JD, or skill-proficiency data changes (no stale score is ever shown).
- Weighted categories with **configurable** weights; the **skills** category is weighted by each skill's 1–5 proficiency.
- Graceful **weight renormalization** when a category has no usable input on either side (e.g. no required-years stated), so absent signals don't deflate the score.
- A single new optional application field, `minYearsExperience`, as the comparison target for the experience category (manual entry — the JD parser deliberately does not extract it). The candidate's years are **derived at runtime** from the profile's experience date ranges; no candidate-side field is stored.
- Replacing the parser's random `compat` assignment so new and existing applications converge on computed scores.
- Centralized, automated-tested scoring logic (determinism, weighting, renormalization, band mapping, experience handling).

**Non-goals** (carried from the brief)
- Recruiter prediction, hiring-probability estimation, interview prediction, personality analysis.
- Any LLM-determined scoring. LLMs may assist *elsewhere* with extraction (035) and, later, explanations (037); the scoring math here is deterministic only.
- The **per-category breakdown / explanation UI**. This feature outputs only the headline score and label; the breakdown that powers the insights panel is feature **037**.
- ATS / resume quality checks (038).
- Semantic or fuzzy skill matching (e.g. treating "React" and "React.js" as equal). v1 matching is deterministic normalized-exact (case-insensitive, whitespace-collapsed). Synonym/semantic matching is deferred.
- Per-skill years-of-experience requirements (e.g. "3 yrs React, 2 yrs Node"). Alice stores no per-skill tenure, so this cannot be scored deterministically; such phrasing remains in `responsibilities` prose and feeds the skills/keywords categories instead (see Clarifications).
- A user-facing weights editor. Weights are configurable in code/config for v1, not exposed in the UI.

## Clarifications

### Session 2026-06-08

- Q: Does the 035 JD parser already extract years of experience but simply not surface it? → A: **No.** The extraction prompt explicitly excludes it and the post-processing strips a `yearsOfExperience` key if returned ([llmParser.js:195/336](../../src/services/llmParser.js#L195)). Experience is genuinely absent from the structured JD data; if a posting states it, the text survives only inside `responsibilities`.
- Q: How should the engine handle "experience alignment" given that gap? → A: Model the job's requirement as a **single overall minimum-years** field on the application. The candidate's total years are derived from the profile's experience date ranges at compute time. Per-skill year demands are out of scope (no per-skill tenure data) and stay in prose. When the job's required-years is blank, the experience category is skipped and its weight renormalizes across the others.
- Q: Does the candidate's years of experience need a stored schema field? → A: **No** — derived at runtime from `experience[].dateStarted/dateEnded/currentWork`. Only the **job's required** years needs a home, because no structured source produces it; that is the new `minYearsExperience` field on the application.
- Q: How is the score produced and stored, given a profile change affects every application's score? → A: **Persist + recompute.** The score is stored on the application (`compat`) and brought up to date whenever a scoring input changes, so the displayed value always reflects current profile + JD data.
- Q: What score bands map to the four labels? → A: **Low 0–39, Medium 40–64, High 65–84, Great 85–100** (monotonic, non-overlapping). Conservative on purpose — "Great" is hard to reach, keeping scores honest.
- Q: What does 036 output — score+label, or also the per-category breakdown? → A: **Score + label only.** The per-category breakdown is feature 037.
- Q: Do the JD's `preferredSkills` count toward the skills category? → A: **Yes, at partial credit.** A matched **required** skill counts at full weight; a matched **preferred** skill contributes a smaller, capped bonus that cannot outweigh missing required skills.
- Q: Is the experience category binary (meets/falls short) or graded? → A: **Graded by closeness.** Meeting or exceeding the required years gives full category credit (no overshoot bonus); falling short scales the category credit down with the gap (candidate-to-required ratio), so a near-miss scores higher than a large shortfall.
- Q: Are archived applications recomputed on profile/skill changes? → A: **No — frozen.** Archived applications retain their last computed score and are excluded from profile-wide recompute; they recompute only if the archived application's own JD data is edited.
- Q: What is the deterministic basis for the "role alignment" category? → A: **Normalized token overlap** between the JD `jobTitle` and a profile corpus of the `experience[].role` titles plus the profile `summary` text.

### Session 2026-06-16 (post-smoke-test scoring revision — "Group B")

Browser smoke-test review of the deployed scoring revised the **skills** formula, the default **weights**, and the **experience activation** rule. Full math and rationale: [research.md](research.md) D10/D11; reader-facing explainer: [`docs/compatibility_scoring.md`](../../docs/compatibility_scoring.md).

- Q: Preferred skills out-scored required skills (adding a matched skill helped more as preferred than as required). How is the skills sub-score fixed? → A: **Pooled weighted coverage.** Required skills carry weight 1, preferred carry weight **0.69**; a matched skill contributes `proficiency/5`, unmatched required stay in the denominator. A required match's effect now always ≥ the same skill as preferred (no inversion), and partial coverage stays honest. If zero required are matched, the skills sub-score is capped at **0.35**.
- Q: Setting Min Years swung the total too much (one coarse field moved the score ~±15). → A: Drop the **experience weight 20 → 12** and move the freed 8 into **skills (35 → 43)**. New default weights: skills 43 · role alignment 25 · experience 12 · keywords 10 · certifications 10. Experience stays omitted+renormalized whenever Min Years is blank.
- Q: What should experience do when the job states Min Years but the profile has no experience entries? → A: **Data-aware.** No experience but other substantive profile content present → score **0** (genuine "fresh-grad shortfall"). Essentially empty profile (no experience and no other content) → **omit** + renormalize (don't penalize an unfilled profile). Experience entries present → graded as before.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deterministic, meaningful compatibility score (Priority: P1)

A user opens an application and sees a compatibility score that actually reflects how well their profile matches the job — and the score is the *same* every time for the same profile and job, never a random number.

**Why this priority**: This is the core capability. Without a real, repeatable score the feature delivers nothing; everything else (display, recompute, experience) builds on it.

**Independent Test**: Compute the score for a fixed profile + fixed application twice and confirm the two scores are identical; then add a required skill that the profile possesses and confirm the score rises; remove a matched skill and confirm it falls.

**Acceptance Scenarios**:

1. **Given** a profile and an application with overlapping required skills, **When** the score is computed twice with no data change, **Then** both computations return the identical integer 0–100 score (deterministic).
2. **Given** an application whose required skills the profile fully covers at high proficiency, **When** scored, **Then** the score is materially higher than for an application whose required skills the profile does not have.
3. **Given** two skills of equal name but different profile proficiency (e.g. level 5 vs level 2), **When** each is the sole matched required skill, **Then** the higher-proficiency match contributes a higher skills sub-score (proficiency weighting).
4. **Given** a profile that matches a JD's preferred skill but not its required skills, **When** scored, **Then** the preferred match raises the skills sub-score only partially and cannot lift it to the level achieved by covering the required skills (preferred = partial credit).
5. **Given** any computed score, **When** it is produced, **Then** no LLM/network call is involved and the result depends only on the supplied profile and application data.

### User Story 2 - Understand fit at a glance (Priority: P2)

A user scanning applications can read each one's compatibility score and a plain-language label (Low / Medium / High / Great) and immediately grasp the broad fit, without the number feeling like a guarantee.

**Why this priority**: The score is only useful once surfaced. Depends on US1 producing a real value but is independently demonstrable.

**Independent Test**: With a computed score present, open the application (Tracker card and detail overlay) and confirm it shows the numeric score and the band label, that the label matches the score's band, and that fit is communicated without relying on color alone.

**Acceptance Scenarios**:

1. **Given** a score of 72, **When** the application renders, **Then** it shows "72" and the label **High** (65–84 band).
2. **Given** scores at band boundaries (39, 40, 64, 65, 84, 85), **When** rendered, **Then** the labels are Low, Medium, Medium, High, High, Great respectively.
3. **Given** the compatibility indicator, **When** viewed, **Then** it conveys level through text (number + word), not color alone, and reads as informative rather than authoritative (no exaggerated-certainty wording).

### User Story 3 - Score reacts to profile and job changes (Priority: P2)

A user updates their profile (adds a skill, raises a proficiency) or edits an application's job data, and the compatibility score updates to reflect the new reality rather than showing a stale value.

**Why this priority**: "Reacts meaningfully to changes" is an explicit success criterion. It makes the score trustworthy and keeps persisted values honest.

**Independent Test**: Note an application's score; raise the proficiency of one of its matched required skills in the profile and save; reopen the application and confirm the score has increased and now reflects the change; repeat the edit identically and confirm the same resulting score.

**Acceptance Scenarios**:

1. **Given** a stored score, **When** the user changes a profile skill's proficiency that the application requires and saves, **Then** the application's stored score is recomputed and the new value is shown — the old value is never left displayed.
2. **Given** a stored score, **When** the user edits the application's required skills, responsibilities, job title, or required years and saves, **Then** that application's score is recomputed from the new JD data.
3. **Given** a profile change that affects many applications, **When** the change is saved, **Then** every affected application's stored score reflects the change before it is next shown (no stale score persists).

### User Story 4 - Experience contributes when the job states a requirement (Priority: P3)

A user records that a job requires a minimum number of years; the engine compares it against the years derived from their profile and factors it into the score. When no requirement is recorded, experience simply doesn't count for or against them.

**Why this priority**: Adds a real comparison category, but the score is already meaningful without it (US1), so it is the lowest-priority slice.

**Independent Test**: On an application, set `minYearsExperience` to a value below the profile's derived total years and confirm the experience category contributes positively; raise it above the derived years and confirm it contributes negatively; clear it and confirm the category is skipped and the remaining weights renormalize (score is computed only from the other categories).

**Acceptance Scenarios**:

1. **Given** a profile whose experience dates total ~6 years and an application with `minYearsExperience = 3`, **When** scored, **Then** the experience category scores at **full** credit (meets/exceeds), and a profile with ~12 years against the same `minYearsExperience = 3` scores no higher in this category (no overshoot bonus).
2. **Given** the same ~6-year profile, **When** `minYearsExperience = 7` (a near-miss) versus `minYearsExperience = 18` (a large shortfall), **Then** the near-miss yields a **higher** experience-category credit than the large shortfall (graded by closeness).
3. **Given** an application with `minYearsExperience` blank/empty, **When** scored, **Then** the experience category is **omitted** and its weight is renormalized across the remaining categories — a blank requirement neither raises nor lowers the score.
4. **Given** `minYearsExperience` input, **When** saved, **Then** it is validated as a non-negative integer (or empty); invalid input is rejected with feedback, never silently stored.

### Edge Cases

- **Sparse profile** (few or no skills, no experience entries): scoring still completes deterministically and returns a low score; it never errors. A profile with no comparable data against a job yields a low/zero score, not a crash.
- **Empty or extremely short JD** (no required skills, minimal responsibilities): categories with no JD signal are skipped and weights renormalize; if nothing is comparable on either side, the score is 0 (Low), not an error.
- **Keyword-heavy / overloaded JD**: the keyword category's influence is capped by its weight so a long JD cannot dominate; tokens are deduplicated before comparison.
- **Duplicate skills**: profile skills are already de-duplicated (031/032) and JD skill arrays are de-duped by the parser (035); the engine de-dupes defensively so a duplicate cannot double-count.
- **Ambiguous / variant technologies** ("React" vs "React.js", "JS" vs "JavaScript"): v1 matches by normalized-exact string (case-insensitive, whitespace-collapsed); near-variants that don't match exactly simply don't match. This is the deterministic trade-off (semantic matching is a non-goal).
- **Profile with minimal experience vs a stated requirement**: derived candidate years may be 0; the experience category scores low rather than erroring.
- **Required years stated but no profile experience entries**: derived years = 0, requirement not met → experience category scores low (deterministic), category still counts.
- **Pre-existing random `compat` values**: superseded the first time the application is scored; users never keep seeing the legacy random number once a real score is computed.
- **Archived applications**: retain their last computed score and are excluded from profile-wide recompute (historical snapshots). They recompute only when the archived application's own JD data is edited. See FR-009.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The engine MUST compute compatibility as **deterministic, repeatable** logic — identical profile + application inputs MUST always produce the identical score. No randomness in the scoring path.
- **FR-002**: The scoring computation MUST NOT use an LLM or any external/network service. It runs entirely on local, structured data.
- **FR-003**: The engine MUST compare the profile and the application across weighted categories. The category set is: **skills**, **role alignment**, **experience**, **certifications**, and **keywords**. (Skill proficiency is a weighting *within* the skills category, not a separate category.)
- **FR-004**: Category **weights MUST be configurable** (in code/config), with a documented default set. Weights are not user-editable in the UI for this feature.
- **FR-005**: The **skills** category MUST weight each matched skill by the profile's 1–5 proficiency for that skill (a stronger skill contributes more than a weaker one), and MUST treat required and preferred skills as a single **pooled weighted coverage** where preferred skills carry a **reduced weight** relative to required. The model MUST guarantee that a matched **required** skill contributes **at least as much** as the same skill matched as **preferred** (no inversion), and MUST cap the skills sub-score at a **low ceiling (0.35)** when the profile matches **zero** required skills, so nice-to-haves cannot mask failing the actual requirements. *(Revised 2026-06-16 — see Clarifications "Group B" and [research.md](research.md) D10; replaces the earlier "capped additive bonus" model.)*
- **FR-006**: When a category has **no usable input** on either side (e.g. no required-years stated, no JD skills, no profile certifications), that category MUST be omitted and the remaining category weights **renormalized** so absent signals neither inflate nor deflate the score.
- **FR-007**: The engine MUST output an integer **score 0–100**, clamped, and a derived **label** using fixed bands: **Low 0–39, Medium 40–64, High 65–84, Great 85–100**. The label MUST be derived from the score (not stored independently) so the two can never disagree.
- **FR-008**: The engine MUST output **only** the score and label. It MUST NOT produce or persist a per-category breakdown or explanation (that is feature 037).
- **FR-009**: The computed score MUST be **persisted** on the application (reusing the existing `compat` field) and MUST be kept current: whenever a scoring input changes — the application's JD data, the profile, or a skill proficiency — the affected application(s)' stored score MUST be recomputed so a stale score is never displayed. **Archived** applications are excluded from profile-wide recompute (their score is frozen as a historical snapshot) and are rescored only when the archived application's own JD data is edited.
- **FR-010**: The system MUST stop assigning a **random** `compat` on application creation/parse; new applications receive a computed score (or a deterministic initial value pending the first compute), and existing random values are superseded on the next compute.
- **FR-011**: The candidate's years of experience MUST be **derived at compute time** from the profile's experience entries (`dateStarted`/`dateEnded`/`currentWork`); no candidate-experience field is added or stored.
- **FR-012**: The system MUST add a single optional application field, **`minYearsExperience`**, holding the job's stated minimum years. The JD parser MUST leave it unset (it is not extracted); it is entered manually. It MUST be validated as a non-negative integer or empty, with no silent coercion of invalid values.
- **FR-013**: The **experience** category MUST score by comparing derived candidate years against `minYearsExperience`, **graded by closeness**: meeting or exceeding the requirement gives full category credit (no overshoot bonus), and falling short scales credit down proportionally to the gap (candidate-to-required ratio) so a near-miss scores higher than a large shortfall. When `minYearsExperience` is blank, the category is skipped per FR-006. **When `minYearsExperience` is stated but the profile has no experience entries**, the category MUST be **data-aware** *(added 2026-06-16 — see [research.md](research.md) D11)*: if the profile has other substantive content (summary, education, skills, certifications, awards, or languages) the category scores **0** (a genuine shortfall — e.g. a fresh graduate); if the profile is essentially empty (no experience and no other substantive content), the category MUST be **omitted and renormalized** per FR-006 rather than scored 0, so an unfilled profile is not penalized.
- **FR-014**: Skill, keyword, certification, and role matching MUST be deterministic normalized-exact (case-insensitive, whitespace-collapsed) and MUST de-duplicate inputs so no token double-counts. No fuzzy/semantic matching in v1.
- **FR-014a**: The **role alignment** category MUST be computed as normalized token overlap between the JD `jobTitle` and a profile corpus consisting of the profile's `experience[].role` titles and the `summary` text. When either side is empty, the category is omitted and renormalized per FR-006.
- **FR-015**: The engine MUST handle sparse/empty inputs gracefully — a sparse profile or a near-empty JD MUST yield a deterministic low score, never an error or crash, with empty/edge states handled explicitly.
- **FR-016**: The compatibility indicator MUST communicate level through **non-color-only** means (numeric score + textual label) and MUST be presented as informative, avoiding exaggerated-certainty or "predicts your future" framing (constitution UX; brief presentation guidance).
- **FR-017**: The score MUST persist and behave identically across all runtime modes — local SQLite, hosted Supabase, and demo — reusing the existing `compat` persistence; any new field (`minYearsExperience`) MUST persist in every mode at parity.
- **FR-018**: The scoring logic, band mapping, renormalization, proficiency weighting, and experience comparison MUST be **centralized** in shared model/service logic and covered by **automated tests** (determinism, weighting, renormalization, band boundaries, experience present/absent, sparse inputs).
- **FR-019**: The engine MUST be structured so future recalculation and additional categories can be added **without an architectural rewrite** (extensibility — brief).

### Key Entities *(include if feature involves data)*

- **Compatibility Score**: the computed result for one application — an integer 0–100 stored in the application's existing `compat` field, plus a label (Low/Medium/High/Great) derived from the score's band. No breakdown is stored.
- **Scoring Inputs (profile side)**: structured `skills: [{ name, level 1–5 }]` (from the skill store, 032), `experience` entries (`role` titles for role alignment; date ranges for derived total years), `certifications`, the `summary` text (role alignment + keywords), and experience `responsibilities` text (keywords).
- **Scoring Inputs (application/JD side)**: `skills` (required) and `preferredSkills` arrays, `responsibilities` and `jobTitle` text, and the new `minYearsExperience`.
- **Category Weights (configuration)**: the relative weight of each category, with a documented default and a renormalization rule for absent categories. Configurable in code/config, not user-facing.
- **`minYearsExperience` (application field)**: optional non-negative integer; the job's stated minimum years; never auto-extracted; the comparison target for the experience category.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any fixed profile + application, repeated computation returns the **identical** score 100% of the time (no variance).
- **SC-002**: Adding a required skill the profile possesses (or raising its proficiency) **increases** the score; removing a matched skill (or lowering proficiency) **decreases** it — verifiable on a fixed fixture.
- **SC-003**: After this feature, **no application displays the legacy random value** once it has been scored; every shown score is engine-computed.
- **SC-004**: A profile change is reflected in affected applications' scores **before they are next shown** — users never see a stale score from outdated profile data.
- **SC-005**: Scoring completes with **zero** LLM or network calls (observable: works offline / with AI disabled).
- **SC-006**: The displayed label always matches the score's band, and fit is communicated without relying on color alone (keyboard/screen-reader verifiable).
- **SC-007**: Scoring a sparse profile or a near-empty JD **never errors** and returns a deterministic low score.
- **SC-008**: With `minYearsExperience` blank, the score equals the score computed from the remaining renormalized categories (experience contributes nothing); with it set, it shifts the score in the expected direction.

## Assumptions

- The structured skill proficiency data (031), the first-class skill store (032), and the LLM JD parser (035) already exist; this feature consumes them and does not change the skill model or the parser contract (beyond ceasing the random `compat`).
- The existing `compat` field and `CompatBar` display are reused as the score's storage and presentation surface; this feature changes *how the value is produced*, not the display component's contract (display tweaks for labeling are in scope).
- Default category weights are chosen to make **skills** the dominant signal (it is the only fully-structured both-sides comparison), with role/experience/certifications/keywords as supporting categories; exact default values are an initial proposal to be confirmed in planning and are configurable thereafter.
- **Archived applications** retain their last computed score and are not recomputed by profile-wide changes — they are historical snapshots; only active applications participate in profile-wide recompute. An archived application is rescored only if its own JD data is edited.
- The recompute strategy (eager on save vs. lazy on next read) is a planning/implementation decision; the spec only requires that a stale score is never shown (FR-009).
- Compatibility scoring is private and local-first; it adds no external service, analytics, or tracking, consistent with the constitution and the brief's "LLMs do not determine scores" principle.
- Keyword/role/certification matching against JD free-text is deterministic token overlap; it is a coarse signal by design and is weighted below the structured skills category to avoid fake precision.

## Data Considerations

- **Score storage**: reuse `application.compat` (integer 0–100, already clamped by `validateApplication`). No new score column; the value's *meaning* changes from random to computed.
- **New field**: `minYearsExperience` on the application — optional non-negative integer (or empty). Persisted in the application record across SQLite, Supabase, and demo at parity. Validated centrally; never auto-populated by the parser.
- **Derived candidate years**: computed from profile `experience[]` date ranges at scoring time; not stored, so it always reflects the current profile.
- **Default weighting (configurable)**: **skills 43 · role alignment 25 · experience 12 · keywords 10 · certifications 10** (sum 100); absent categories drop out and the rest renormalize to sum to the full scale. *(Revised 2026-06-16 from the original `35 · 25 · 20 · 10 · 10`: experience 20 → 12 with the freed 8 moved into skills, because one coarse, usually-blank field was swinging the total too much — see Clarifications "Group B" and [research.md](research.md) D11.)*
- **Role alignment basis**: normalized token overlap between the JD `jobTitle` and a profile corpus of `experience[].role` titles + `summary` (Clarification 2026-06-08).
- **Certifications basis (planning default — to confirm in `plan.md`)**: the JD has no structured certifications field, so the engine matches the profile's certification names against the JD's `responsibilities` + required/preferred skills text (normalized token presence). Low default weight; omitted + renormalized when the profile has no certifications. This is the one category basis not yet user-confirmed.
- **Determinism guarantees**: all matching is normalized (lowercase, collapsed whitespace) and de-duplicated; no time-, random-, or environment-dependent inputs enter the score.
- **No silent corruption**: invalid `minYearsExperience` is rejected with feedback rather than coerced; clamping of the final score to 0–100 is the only normalization applied to the output.
