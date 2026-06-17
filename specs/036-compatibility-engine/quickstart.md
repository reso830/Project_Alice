# Quickstart: Compatibility Engine

How to verify the feature locally. Assumes the local (SQLite) runtime.

## 1. Run the suite

```powershell
npm test                       # full suite
npx vitest run tests/models/compatibility.test.js   # the scoring contract
```

Expect: determinism, proficiency weighting, preferred-as-partial-credit, graded experience, renormalization, band boundaries, and sparse-input cases all green.

## 2. Start the app

```powershell
npm run dev                    # Vite + Express
```

## 3. Verify the score is real (not random)

1. Open an application in the detail overlay — note the **CompatBar** shows a percentage **and** a band label (Low/Medium/High/Great).
2. Reload the page → the score is **identical** (no random reshuffle).
3. In **Profile**, raise the proficiency of a skill that the application lists as **required**, save, return to the application → the score has **increased**.
4. Remove that skill from the profile, save → the score **decreases**.

## 4. Verify experience

1. Edit an application; set **Min Years Experience** to a value **below** your profile's total experience → experience contributes positively.
2. Raise it **well above** your total experience → the score drops (graded shortfall).
3. Clear the field → the experience category is **skipped** (score reflects only the other categories).
4. Enter a negative or non-integer value → save is rejected with a validation message (no silent coercion).

## 5. Verify preferred-skill partial credit

> Scoring v2 (Group B, 2026-06-16): skills now use **pooled weighted coverage** (preferred weight 0.69; 0.35 cap when zero required matched). The checks below still hold — preferred stays below required — but the underlying model changed; see [`docs/compatibility_scoring.md`](../../docs/compatibility_scoring.md).

1. Find/create an application whose **preferred** skills you have but whose **required** skills you do not.
2. Confirm the skills contribution is **partial** — it cannot reach the level you'd get by covering the required skills, and is capped (≤ 35% of the skills sub-score) when you match no required skills.
3. Add a matched skill to **required** vs. **preferred** and confirm the required placement helps **at least as much** (no inversion).

## 6. Verify recompute scope (archived frozen)

1. Note an **active** application's score and an **archived** one's score.
2. Change the profile and save.
3. The active application's score updates; the **archived** one's score is **unchanged**.
4. Edit the archived application's own JD (e.g. required skills) → its score recomputes.

## 7. Verify offline / AI-off determinism

Disable network / AI features and repeat steps 3–4 — scoring still works (no LLM/network dependency).

## 8. Demo mode parity

Run the portfolio/demo runtime and confirm seeded applications show sensible, stable scores and labels identical in spirit to local mode (same pure module).

## Hosted note

Apply the additive migration from [data-model.md](data-model.md) §1 (`ALTER TABLE … ADD COLUMN min_years_experience`) before deploying; `assertHostedSchema` will fail fast if it is missing.

After migrating, run the **one-time backfill** (T017) as an all-applications maintenance pass — it must rescore **archived** apps too, so it cannot be a profile re-save (the ongoing profile recompute deliberately skips archived). Verify afterward that no application — active or archived — still shows a legacy random score.
