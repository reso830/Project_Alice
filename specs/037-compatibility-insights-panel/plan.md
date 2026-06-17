# Implementation Plan: Compatibility Insights Panel

**Branch**: `037-compatibility-insights-panel` | **Date**: 2026-06-17 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/037-compatibility-insights-panel/spec.md`

---

## Summary

Replace the existing `CompatBar` + `compatNotes` textarea with a **Compatibility Insights Panel** — a collapsible module that presents the live 036-computed score, profile-aware skill proficiency chips (row 6), and optionally AI-generated analysis with freshness management.

The LLM call follows the existing client-side pattern (user's OpenRouter key via `aiSettings`), but is cleanly separated into a new `compatNotesService.js`. A shared `llmClient.js` is extracted from `llmParser.js` to avoid duplication. The server route `POST /api/applications/:id/compat-notes` is a thin persistence endpoint — it receives client-generated text, adds `generatedAt`, and saves to a new `compat_analysis` column. A second new column, `compat_scored_at`, is stamped by 036's recompute path on every score write and serves as the staleness signal for notes.

---

## Technical Context

**Language/Version**: Node.js (ESM), Vanilla JS frontend (Vite), Express backend  
**Primary Dependencies**: `better-sqlite3` (local), `@supabase/supabase-js` (hosted), `zod` (validation), OpenRouter (client-side LLM via `aiSettings`); **no new dependency**  
**Storage**: Two new `TEXT` columns on `applications` (`compat_analysis`, `compat_scored_at`); `compat_notes` retired in place  
**Testing**: Vitest (`tests/models`, `tests/server`, `tests/components`, `tests/services`)  
**Target Platform**: Desktop + mobile browsers; Vercel serverless (hosted) / local Node (local) / client-only (demo)  
**Project Type**: Web application (Vite frontend + Express backend, dual-mode persistence)  
**Performance Goals**: Notes generation is user-triggered and bounded by `LLM_TIMEOUT_MS` (30 s); staleness check is a single timestamp comparison at render time  
**Constraints**: AI calls are strictly user-initiated; AI failure never blocks the modal; score is always live; local-first by default

---

## Constitution Check

- **Required fields preserved** — no change to company/title/status/last_status_update/responsibilities; new columns are optional additions. ✅
- **Business logic separated from UI** — `compatNotesService.js` owns generation logic; `CompatibilityModule.js` owns rendering; `skillProficiency.js` owns resolution; server route owns persistence. ✅
- **Validation / no silent corruption** — `compat_analysis` is never client-writable via the standard PATCH route; server route validates `{ summary, body }` before persisting; malformed JSON in `compat_analysis` degrades to `none` state. ✅
- **Workflows + states** — all five notes states (none/generating/fresh/stale/error) and the `no-profile` availability state have dedicated UI; empty/sparse profiles render gracefully. ✅
- **Automated tests** — unit tests for `skillProficiency.js`, `CompatibilityModule` state logic, server route; integration tests for column wiring + persistence. Lint/format: `npm run lint`, `npm run format`. ✅
- **Privacy local-first** — AI key stays in localStorage; never stored server-side; notes generation is user-triggered. ✅
- **Responsive / a11y** — mobile bottom-sheet layout supported; score communicated via number + text; keyboard navigation within existing focus trap. ✅
- **Future extensibility** — `CompatibilityModule` is a standalone component; notes schema is a versioned JSON blob; easy to extend without rewriting the module. ✅

No violations → Complexity Tracking table omitted.

---

## Architecture & Data Flow

### Key architectural decisions

1. **LLM calls are client-side** — consistent with the existing pattern (035 JD parser, 033 resume parser). The user's API key never leaves the browser.
2. **Shared LLM client** — `requestChatCompletion` is extracted from `llmParser.js` into `src/services/llmClient.js`. Both `llmParser.js` and the new `compatNotesService.js` import from it. `llmParser.js` retains all parse-specific logic unchanged.
3. **Server route is a persistence endpoint** — `POST /api/applications/:id/compat-notes` receives `{ summary, body }` (generated client-side), adds `generatedAt: new Date().toISOString()`, validates, and saves to `compat_analysis`. It does not call OpenRouter.
4. **Staleness via `compat_scored_at`** — 036's `recomputeActive()` and the application create/update route are extended to stamp `compat_scored_at: new Date().toISOString()` on every score write. Notes are stale when `notes.generatedAt < application.compat_scored_at`.
5. **Profile passed to modal** — Tracker.js fetches the profile at page init and passes it into `Modal.open()`. The module uses it for skill resolution and notes context assembly.
6. **`CompatibilityModule.js` is a standalone component** — owns all module rendering, state machine, and generation orchestration. Modal.js embeds it; it does not embed Modal logic.

---

### Component / data flow diagram

```
Tracker.js (page init)
  ├─ api.getAll()        → _applications[]
  └─ api.getProfile()    → _profile            ← NEW

onOpen(id):
  api.getById(id) → application
  Modal.open(application, { profile: _profile, … })   ← NEW param

Modal.js
  ├─ makeChipEditor({ key:'skills', profileSkills })   ← proficiency-coded
  ├─ makeChipEditor({ key:'preferredSkills', profileSkills })
  └─ CompatibilityModule.render({ application, profile })   ← NEW, replaces CompatBar + compatNotes

CompatibilityModule.js
  ├─ derivedState = deriveCompatState(application, profile)
  │    CompatAvailability: 'scored' | 'no-profile'
  │    NotesState: 'none' | 'fresh' | 'stale' | 'error' (+ 'generating' during call)
  │    stale = notes.generatedAt < application.compat_scored_at
  ├─ renders: collapsed bar / expanded panel (score ring, notes region)
  └─ onGenerate():
       1. compatNotesService.generateNotes(application, profile, aiSettings)
          → llmClient.requestChatCompletion({ key, model, systemPrompt, userContent })
          → { summary, body }
       2. api.saveCompatNotes(id, { summary, body })
          POST /api/applications/:id/compat-notes  { summary, body }
          ← { data: { summary, body, generatedAt } }
       3. module re-renders with fresh notes

Server: POST /api/applications/:id/compat-notes
  ├─ validate { summary (≤34 chars), body (non-empty) }
  ├─ generatedAt = new Date().toISOString()
  ├─ repos.applications.update(id, { compatAnalysis: JSON.stringify({…}) })
  └─ res.json({ data: { summary, body, generatedAt } })

Server: PATCH /api/applications/:id (on save)
  └─ scoreApplication() → compat + compat_scored_at = now   ← EXTENDED

Server: PUT /api/profile (on profile save)
  └─ recomputeActive() → each updated app gets compat + compat_scored_at = now   ← EXTENDED
```

---

### `compatNotesService.js` — prompt design

The prompt assembles full context (Clarification Q3):

**System prompt** (instructions + output schema):
- Instructs the model to explain the compatibility score concisely
- Output: JSON `{ "summary": "≤34 chars", "body": "..." }`
- Prohibits career advice, hiring predictions, application recommendations

**User content** (structured context block):
```
Score: 72 (High match)

Required skills:
  ✓ React (Proficient)   ● Node.js (Learning)   ✕ PostgreSQL (Missing)

Preferred skills:
  ✓ TypeScript (Proficient)   ✕ Docker (Missing)

Job: Senior Frontend Developer at Acme Corp
Responsibilities: Build scalable UI components…

Profile summary: Full-stack developer with 5 years React experience…
Experience: Senior Developer at XYZ, Frontend Engineer at ABC
```

The model receives the score + tier so its prose is anchored to the deterministic result (not a re-assessment). Short `summary` (≤34 chars) is requested explicitly; the server enforces it on write.

---

### Skill proficiency resolution (`src/utils/skillProficiency.js`)

```js
// Pure function — no side effects
export function resolveSkillLevel(skillName, profileSkills) {
  const normalized = skillName.trim().toLowerCase().replace(/\s+/g, ' ');
  const match = profileSkills.find(
    s => s.name.trim().toLowerCase().replace(/\s+/g, ' ') === normalized
  );
  if (!match) return 'missing';
  return match.level >= 3 ? 'proficient' : 'learning';
}

// Batch resolve for a skill array
export function resolveSkillMatches(skillNames, profileSkills) {
  return skillNames.map(name => ({
    name,
    level: resolveSkillLevel(name, profileSkills ?? []),
  }));
}
```

---

### `CompatAvailability` derivation

```js
function isProfileSufficient(profile) {
  // no-profile when profile has no skills, no experience, and no summary
  return (profile?.skills?.length > 0)
    || (profile?.experience?.length > 0)
    || (typeof profile?.summary === 'string' && profile.summary.trim().length > 0);
}
```

---

### `compat_scored_at` stamping

In `server/services/compatibility.js`:

```js
// recomputeActive — extend update payload
// Always stamp compatScoredAt on every score attempt (not only on value change),
// so notes go stale even when the score is numerically identical post-edit.
const compatScoredAt = new Date().toISOString();
const payload = compat !== application.compat
  ? { compat, compatScoredAt }
  : { compatScoredAt };
updates.push(repos.applications.update(application.id, payload, asOf));
```

In `server/routes/applications.js` (create + update):
```js
const compat = scoreApplication(result.data, profile, asOf);
const compatScoredAt = new Date().toISOString();
// pass both into the update/create payload
```

`compatScoredAt` is not user-editable; it is removed from the writable Zod schema alongside `compat`.

---

## Validation Approach

- **Unit — `skillProficiency.js`**: proficient/learning/missing thresholds; normalized-exact match (case, whitespace); empty profile → all missing; empty skill list → no output.
- **Unit — `CompatibilityModule` state logic**: `deriveCompatState` for each `NotesState`; staleness condition (`generatedAt < compat_scored_at`); `no-profile` detection.
- **Unit — `compatNotesService.js`**: prompt assembly (correct fields, score/tier present, summary constraint in prompt); error mapping (`mapErrorToReason`); summary truncation guard.
- **Server — `POST /api/applications/:id/compat-notes`**: valid body persists and returns `CompatNotes`; invalid `summary` (>34 chars) rejected; empty `body` rejected; unknown application ID → 404; `compat_analysis` written correctly; `compat_notes` is NOT written.
- **Server — `PATCH /api/applications/:id`**: `compat_scored_at` is stamped on every compat write; `compatAnalysis` is NOT writable via PATCH.
- **Server — `PUT /api/profile`**: `compat_scored_at` stamped on each recomputed application.
- **Column wiring**: `compat_analysis` and `compat_scored_at` round-trip through `toRecord`/`toRow`; `compat_notes` is stripped from writable surface.
- **Component — `CompatibilityModule`**: collapsed default state; expand/collapse toggle; notes states render correct UI; score ring tier colors match spec bands; stale bar copy; disabled Generate button in Create mode.
- **Integration — demo store**: `saveCompatNotes` persists in-memory; seeded notes appear on the correct demo applications.

---

## Affected Areas

### Files/components likely to be **inspected** (read, likely no change)
- [src/pages/Tracker.js](../../src/pages/Tracker.js) — confirm profile fetch location and how `Modal.open` is called; will be lightly modified to pass profile
- [src/data/aiSettings.js](../../src/data/aiSettings.js) — confirm `getKey()`, `getModel()`, `canUseJdParser()` API; `canUseAI()` or equivalent needed for notes locked state
- [src/components/CompatBar.js](../../src/components/CompatBar.js) — inspect before removing; confirm it is only used in Modal.js
- [server/routes/profile.js](../../server/routes/profile.js) — confirm `recomputeActive` call site for `compat_scored_at` extension
- [server/health.js](../../server/health.js) — add `assertHostedSchema` probes for new columns

### Files/components likely to be **modified**
- **NEW** [`src/services/llmClient.js`](../../src/services/llmClient.js) — extracted generic `requestChatCompletion` + `LLM_TIMEOUT_MS`; `mapErrorToReason` moved here or re-exported
- **NEW** [`src/services/compatNotesService.js`](../../src/services/compatNotesService.js) — `generateNotes(application, profile, aiSettings)` → `{ summary, body }`; prompt builders; uses `llmClient`
- **NEW** [`src/components/CompatibilityModule.js`](../../src/components/CompatibilityModule.js) — full module component (score ring SVG, verdict pill, notes region, all states, expand/collapse)
- **NEW** [`src/utils/skillProficiency.js`](../../src/utils/skillProficiency.js) — `resolveSkillLevel`, `resolveSkillMatches`
- [`src/services/llmParser.js`](../../src/services/llmParser.js) — replace inline `requestChatCompletion` with import from `llmClient.js`; no functional change
- [`src/services/api.js`](../../src/services/api.js) — add `saveCompatNotes(id, { summary, body })` method; demo path calls `demoStore.saveCompatNotes`
- [`src/components/Modal.js`](../../src/components/Modal.js) — add `profile` param to `open()`; pass `profileSkills` to skill chip editors; replace `createCompatField` + `compatNotes` inline text with `CompatibilityModule.render()`; remove `CompatBar` import; reorder body fields to match design doc §4 (skills row 6 before compatibility row 7)
- [`src/pages/Tracker.js`](../../src/pages/Tracker.js) — fetch profile at page init; pass `profile` into `Modal.open()` calls
- [`server/db/columns.js`](../../server/db/columns.js) — add `compatAnalysis ↔ compat_analysis`, `compatScoredAt ↔ compat_scored_at`; remove `compatNotes` from writable surface; update `INSERTABLE_COLUMNS`, `APPLICATION_COLUMNS_WITHOUT_USER_ID`, `toRecord`, `toRow`
- [`server/db.js`](../../server/db.js) — `ensureColumn(... 'compat_analysis', 'TEXT')`, `ensureColumn(... 'compat_scored_at', 'TEXT')` (idempotent); backfill `compat_scored_at` for rows where it is NULL (set to `created_at`)
- [`server/validation/application.js`](../../server/validation/application.js) — remove `compatNotes` from writable schema; add `compatAnalysis` and `compatScoredAt` to non-writable block
- **NEW** route handler inside [`server/routes/applications.js`](../../server/routes/applications.js) — `router.post('/:id/compat-notes', …)` for notes persistence
- [`server/services/compatibility.js`](../../server/services/compatibility.js) — extend `recomputeActive()` and `scoreApplication()` callers to stamp `compatScoredAt`
- [`server/repositories/supabase/applications.js`](../../server/repositories/supabase/applications.js) — ensure `compat_analysis` and `compat_scored_at` flow through create/update; `compat_notes` nulled
- [`src/data/demoStore.js`](../../src/data/demoStore.js) — add `saveCompatNotes(id, notes)`; stamp `compatScoredAt` on score recompute; wire `compatAnalysis` through create/update
- [`src/data/demoSeed.js`](../../src/data/demoSeed.js) — add `compat_analysis` (seeded notes) and `compat_scored_at` on a representative sample of demo applications

### Tests likely to be **added or updated**
- **NEW** `tests/utils/skillProficiency.test.js`
- **NEW** `tests/components/CompatibilityModule.test.js` — state derivation, staleness logic, `no-profile` detection
- **NEW** `tests/services/compatNotesService.test.js` — prompt assembly, error mapping
- **NEW** `tests/server/compatNotes.test.js` — `POST /api/applications/:id/compat-notes` (valid, invalid summary, missing body, 404)
- `tests/server/applications.test.js` — `compat_scored_at` stamped on create/update; `compatAnalysis` not writable via PATCH
- `tests/server/profile.test.js` — `compat_scored_at` stamped on profile-save recompute
- `tests/server/repositories/columns.test.js` — new column mappings; `compat_notes` removed from writable surface
- `tests/services/api.demo.test.js` — `saveCompatNotes` demo path
- `tests/components/Modal.test.js` — module renders in Create mode (disabled generate button); profile prop passed through

### Explicitly **out of scope**
- Changes to the scoring algorithm (feature 036)
- Career coaching, hiring predictions, resume rewriting
- User-editable compatibility scores or analysis
- Semantic/fuzzy skill matching
- ATS / resume quality checks (feature 038)
- Conversation history or multi-turn AI

---

## Migration & Backfill

**Local (SQLite):**
- `ensureColumn(db, 'applications', 'compat_analysis', 'TEXT')` — default NULL
- `ensureColumn(db, 'applications', 'compat_scored_at', 'TEXT')` — default NULL
- One-time backfill on boot: `UPDATE applications SET compat_scored_at = created_at WHERE compat_scored_at IS NULL` — sets a safe baseline so new notes generated after migration will correctly compare
- Nulling `compat_notes`: `UPDATE applications SET compat_notes = NULL WHERE compat_notes IS NOT NULL` — retires the old free-text field; column stays for schema stability

**Hosted (Supabase):**
```sql
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS compat_analysis text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS compat_scored_at text;
UPDATE public.applications SET compat_scored_at = created_at WHERE compat_scored_at IS NULL;
UPDATE public.applications SET compat_notes = NULL WHERE compat_notes IS NOT NULL;
```
Add `assertHostedSchema` probes for both new columns (see [data-model.md](data-model.md)).

---

## Risks & Tradeoffs

| Risk / tradeoff | Impact | Mitigation |
|---|---|---|
| `compat_scored_at` backfilled to `created_at` means any notes generated before migration would appear stale | Low: no notes exist before this feature ships | Acceptable; no pre-migration notes to protect |
| Client-side LLM call pattern means the API key is in JS memory during the call | Same surface as existing 035/033 | Consistent with accepted pattern; key never sent to server |
| `Modal.open()` profile parameter not yet provided by all callers | Skill chips degrade gracefully to plain chips if `profile` is null | Log a warning; implement Tracker.js fetch in the same phase as Modal changes |
| Application route stamps `compat_scored_at` only when compat-relevant fields (`skills`, `preferredSkills`, `responsibilities`, `jobTitle`, `minYearsExperience`) are in the PATCH body; a bug or future caller passing extra fields could accidentally make notes stale | Conditional guard `hasCompatRelevantFields(body)` is the single source of truth; tests cover both paths (stale on compat field, no-stale on General Notes) | Centralize the constant list so it can't drift between the guard and the test |
| Large profile or JD might hit `MAX_INPUT_CHARS` truncation in `llmClient` | Context truncated → less accurate notes | Acceptable v1 tradeoff; same limit applies to JD parser today |
| LLM summary > 34 chars returned by model | Notes body becomes headline-less or truncated | Server rejects on persist; UI truncates via ellipsis as fallback |
| `CompatibilityModule` is a large new component | Modal.js complexity grows | Module is fully standalone; Modal.js only calls `CompatibilityModule.render()` and `CompatibilityModule.destroy()` |

---

## Notes for `/speckit.tasks`

Suggested phase order:

1. **Data layer** — new columns, column mappings, validation changes, migration/backfill, Supabase SQL, `assertHostedSchema` probes, retire `compat_notes`
2. **`compat_scored_at` stamping** — extend `server/services/compatibility.js` and application create/update route to stamp `compatScoredAt` on every score write
3. **LLM client extraction** — extract `requestChatCompletion` + `LLM_TIMEOUT_MS` from `llmParser.js` → `llmClient.js`; update `llmParser.js` imports
4. **`compatNotesService.js` + server route** — notes generation service (prompt building, LLM call, error mapping); `POST /api/applications/:id/compat-notes` route; `api.saveCompatNotes()`
5. **Skill proficiency utility** — `src/utils/skillProficiency.js`; unit tests
6. **`CompatibilityModule.js` component** — score ring SVG, verdict pill, collapsed bar, expanded panel, all five notes states, `no-profile` state, expand/collapse toggle
7. **Modal.js integration** — add `profile` param; replace `CompatBar` + `compatNotes` with `CompatibilityModule`; upgrade skill chips; fix field order per design doc §4; Tracker.js profile fetch
8. **Demo mode** — `demoStore.saveCompatNotes`, `compatScoredAt` stamping in demo, seed `compat_analysis` on representative applications
9. **Tests** — all new + updated tests per Validation Approach
10. **Release Prep** — version bump, CHANGELOG, README, REPO_MAP, `docs/deployment.md` (no new env vars), docs sanity check
11. **Browser Smoke Test** — walk each user story in a real browser against the to-be-merged state
