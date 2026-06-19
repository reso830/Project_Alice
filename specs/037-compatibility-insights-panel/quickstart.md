# Quickstart: Compatibility Insights Panel

Key facts for a developer picking up this feature.

---

## What this feature does

Replaces the existing compatibility bar + free-text notes textarea in the Application Edit Modal with a new **Compatibility Insights Panel**: a collapsible module showing the live score, profile-aware skill proficiency chips, and optionally AI-generated analysis.

## What it does NOT do

- Change the scoring algorithm (that's 036)
- Add server-side LLM calls (client-side only, like 035)
- Add new env vars

## Key files to read before starting

1. `specs/037-compatibility-insights-panel/spec.md` — requirements + acceptance criteria
2. `docs/design/application_overlay.md` §14 — normative design spec (exact px values, colors, class names)
3. `specs/037-compatibility-insights-panel/data-model.md` — new columns + schema changes
4. `specs/037-compatibility-insights-panel/contracts/api.md` — new endpoint contract
5. `src/services/llmParser.js` — existing LLM pattern to be refactored
6. `server/services/compatibility.js` — 036's recompute service to be extended

## The two most important architectural decisions

1. **LLM calls are client-side** — `compatNotesService.js` calls OpenRouter in the browser, then POSTs `{ summary, body }` to the server for persistence. The server route does NOT call OpenRouter.
2. **Staleness via `compat_scored_at`** — a new column stamped on every score computation. Notes are stale when `notes.generatedAt < application.compat_scored_at`. This is driven by 036's recompute path, not by field-watching in 037.

## New files this feature introduces

| File | Purpose |
|---|---|
| `src/services/llmClient.js` | Extracted generic OpenRouter HTTP caller (from `llmParser.js`) |
| `src/services/compatNotesService.js` | Notes generation: prompt building + LLM call |
| `src/components/CompatibilityModule.js` | Full module component (score ring, notes states, expand/collapse) |
| `src/utils/skillProficiency.js` | `resolveSkillLevel(name, profileSkills)` pure function |

## New columns

| Column | Key | Notes |
|---|---|---|
| `compat_analysis` | `compatAnalysis` | JSON `CompatNotes` or null |
| `compat_scored_at` | `compatScoredAt` | ISO timestamp; staleness signal |

`compat_notes` is retired (nulled) but not dropped.

## How staleness works

```
User edits skills → PATCH /api/applications/:id
  → server scores → writes compat + compat_scored_at = NOW()

User opens modal next time:
  → notes.generatedAt < compat_scored_at  →  stale state
```

## How notes generation works

```
User clicks "Generate notes" in expanded module
  → compatNotesService.generateNotes(application, profile, aiSettings)
  → llmClient.requestChatCompletion({ key, model, systemPrompt, userContent })
  → { summary, body }
  → api.saveCompatNotes(id, { summary, body })
  → POST /api/applications/:id/compat-notes  { summary, body }
  ← { data: { summary, body, generatedAt } }
  → module re-renders in fresh state
```

## Running locally

No new env vars. Run as usual:

```bash
npm run dev
```

For hosted mode, run the Supabase migration SQL from `data-model.md §1` and `§2` before deploying.

## Test commands

```bash
npm test                    # full suite
npm run test -- skillProficiency    # just the new utility
npm run test -- compatNotes         # server route tests
npm run lint && npm run format      # required before Release Prep
```
