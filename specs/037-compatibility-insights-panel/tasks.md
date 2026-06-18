# Tasks: Compatibility Insights Panel

**Feature**: `037-compatibility-insights-panel` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small and ordered; `[P]` marks tasks that can run in parallel with their siblings (different files, no shared edits). Write failing tests first where noted. Commands: `npm run test:run`, `npm run lint`, `npm run format`.

Status legend: `[x]` done · `[ ]` pending · `[~]` optional/skipped.

Phase dependency: 01 → 02 → 03/04 (parallel) → 05 → 06 → 07 → 08 → 09 → 10.

---

## Phase 01 — Data layer (foundational — blocks all phases)

**Purpose**: New columns, retire `compat_notes`, migrations across all modes. Every downstream phase depends on this being complete.

### T001 `[x]` — Column mappings for `compat_analysis` and `compat_scored_at`
- **Target**: `server/db/columns.js`
- **Expected behavior**: Add two entries to `FIELD_TO_COLUMN`: `compatAnalysis: 'compat_analysis'` and `compatScoredAt: 'compat_scored_at'`. Add both snake_case names to `INSERTABLE_COLUMNS` and `APPLICATION_COLUMNS_WITHOUT_USER_ID`. In `toRecord`: `compatAnalysis: parseJson(row.compat_analysis, null)` and `compatScoredAt: row.compat_scored_at ?? null`. In `toRow`: serialize `compatAnalysis` via `JSON.stringify` when non-null, else `null`; pass `compatScoredAt` as string or `null`.
- **Constraints**: `compat_analysis` and `compat_scored_at` are **not** in `BOOLEAN_COLUMNS` or `JSONB_COLUMNS` (those are Supabase-specific; JSON is serialized manually). Do not import `server/db.js` (cold-start invariant).
- **Validation/test**: `tests/server/repositories/columns.test.js` — round-trip mapping for both new keys including `null` values.
- **Out of scope**: schema DDL (T003/T004); validation schema changes (T002).

### T002 `[x]` [P] — Remove `compatNotes` from writable schema; add new fields to non-writable block
- **Target**: `server/validation/application.js`
- **Expected behavior**: Remove `compatNotes` from `writableFields` (it is no longer client-editable). Add `compatAnalysis` and `compatScoredAt` to a non-writable block (alongside `compat`) so client-sent values are stripped, not rejected. Keep `compatNotes` in `toRecord` for backward-read compatibility (column stays, reads as `null` after migration).
- **Constraints**: Client sending `compatNotes`, `compatAnalysis`, or `compatScoredAt` in a PATCH body must be silently ignored (not 400). Zod `.strip()` handles unknown keys — only explicitly writable fields pass through.
- **Validation/test**: `tests/server/validation.test.js` — `compatNotes` no longer round-trips from client; `compatAnalysis`/`compatScoredAt` sent by client are stripped.
- **Out of scope**: the new notes persistence route (T013).

### T003 `[x]` — SQLite local migration
- **Target**: `server/db.js`
- **Expected behavior**: In `initSchema`, add: `ensureColumn(targetDb, 'applications', 'compat_analysis', 'TEXT')` and `ensureColumn(targetDb, 'applications', 'compat_scored_at', 'TEXT')`. After column creation, run two idempotent data migrations: (1) `UPDATE applications SET compat_scored_at = created_at WHERE compat_scored_at IS NULL` — baseline for staleness; (2) `UPDATE applications SET compat_notes = NULL WHERE compat_notes IS NOT NULL` — retire old free-text field.
- **Constraints**: All three statements are idempotent (safe to re-run). Run in this order: column additions first, then data updates. `compat_notes` column is NOT dropped (additive-only policy).
- **Validation/test**: `tests/server/foundation.test.js` (schema) or an integration test — fresh DB has both columns; existing rows get `compat_scored_at = created_at`; existing `compat_notes` values are nulled.
- **Out of scope**: Supabase DDL (T004).

### T004 `[x]` [P] — Supabase migration + `assertHostedSchema` probes
- **Target**: `server/repositories/supabase/applications.js`, `server/health.js`, `specs/037-compatibility-insights-panel/data-model.md` (SQL block)
- **Expected behavior**: Add `compat_analysis` and `compat_scored_at` to the Supabase `create`/`update` row passthrough (plain text; no JSONB special-casing needed — serialized as a string). In `server/health.js`, add two `assertHostedSchema` probes: one for `applications.compat_analysis` and one for `applications.compat_scored_at` (both `failOn: [UNDEFINED_COLUMN]`, `docPath: 'specs/037-compatibility-insights-panel/data-model.md §1'` / `'§2'`). Document the migration SQL in `data-model.md` (already drafted; confirm it matches T003's intent).
- **Constraints**: Probes must cause a boot-time failure if columns are missing in hosted mode. `compat_notes` nulling is included in the SQL but the column is not dropped.
- **Validation/test**: `tests/server/repositories/supabase/applications.test.js` — new column passthrough; `tests/server/health.test.js` — probes present for both new columns.
- **Out of scope**: applying migration SQL to a live project.

### T005 `[x]` — App model: `normalizeApplication` for new fields
- **Target**: `src/models/application.js`
- **Expected behavior**: `normalizeApplication` accepts `compatAnalysis` as an object or `null` (no coercion). `compatScoredAt` as an ISO string or `null`. Both default to `null` when absent. Neither is added to `validateApplication` — they are server-managed and never user-supplied. Remove `compatNotes` from the normalized output or keep as `null`; it must not appear as a writable field in any new application creation path.
- **Constraints**: No silent corruption: malformed `compatAnalysis` JSON is treated as `null` by the caller (`parseJson` in `toRecord` already handles this). Do not add `compatAnalysis` or `compatScoredAt` to any user-facing validation error messages.
- **Validation/test**: `tests/models/application.test.js` — `normalizeApplication` passes through `compatAnalysis`/`compatScoredAt`; absent values default to `null`; `compatNotes` absent from write paths.
- **Out of scope**: UI rendering; notes generation route.

**Checkpoint**: Data layer ready. Downstream phases may begin. Run `npm run test:run` — all existing tests must remain green.

---

## Phase 02 — `compat_scored_at` stamping

**Purpose**: Extend 036's recompute path to stamp `compat_scored_at` on every score computation. This is the staleness signal that US3/US4 depend on.

### T006 `[x]` — Extend `recomputeActive` to stamp `compatScoredAt`
- **Target**: `server/services/compatibility.js`
- **Expected behavior**: In `recomputeActive`, stamp `compatScoredAt: new Date().toISOString()` on **every** application in the batch (not only those whose `compat` value changed). The `compat` write still happens only on value change (to avoid unnecessary DB writes), but `compatScoredAt` is always included in the update payload. This ensures notes go stale even when a compat-relevant data change leaves the score numerically identical. See [research.md D6](research.md).
- **Constraints**: `new Date().toISOString()` is the timestamp source — not `asOf` (which is a `YYYY-MM-DD` day string for tenure calculation only). All active applications in the batch get a `compatScoredAt` stamp even if their score didn't change.
- **Validation/test**: `tests/server/profile.test.js` — saving the profile stamps `compat_scored_at` on all active applications; archived applications remain untouched.
- **Out of scope**: demo mode (T026); application create/update route (T007).

### T007 `[x]` — Stamp `compatScoredAt` in application create/update route
- **Target**: `server/routes/applications.js`
- **Expected behavior**: Extend the route to conditionally stamp `compatScoredAt`. On `POST /` (create): always include `compatScoredAt = new Date().toISOString()` in the create payload alongside `compat` — every new application gets an initial score. On `PATCH /:id`: stamp `compatScoredAt` only if the request body contains at least one compat-relevant field (`skills`, `preferredSkills`, `responsibilities`, `jobTitle`, `minYearsExperience`). A PATCH that only updates General Notes, URL, recruiter, salary, location, or other non-compat fields MUST NOT update `compat_scored_at`, so notes do not go stale from unrelated edits. Implement a small helper `hasCompatRelevantFields(body)` that checks for the presence of any of those five keys.
- **Constraints**: `compatScoredAt` is always written on create. On update it is written only when compat-relevant fields are present in the body — never unconditionally. This keeps the staleness contract aligned with the spec clarification (Q1: Option B) and the T041 smoke test acceptance criterion. `scoreApplication` continues to be called on every PATCH (existing 036 behavior); the conditional is only on whether to include `compatScoredAt` in the update payload.
- **Validation/test**: `tests/server/applications.test.js` — (1) created record has non-null `compat_scored_at`; (2) PATCH with `skills` change updates `compat_scored_at`; (3) PATCH updating only `notes` field does NOT change `compat_scored_at`.
- **Out of scope**: notes generation route (T013); `recomputeActive` path (T006, which always stamps because any profile save is compat-relevant).

**Checkpoint**: Staleness signal is live. Creates always stamp `compat_scored_at`; PATCHes stamp only on compat-relevant field changes. Run profile + application server tests.

---

## Phase 03 — LLM client + notes generation service + server route

**Purpose**: Enables US3 (generate AI analysis). Can run in parallel with Phase 04 (skill proficiency utility) since they touch different files.

### T008 `[x]` — Extract `llmClient.js` from `llmParser.js`
- **Target**: `src/services/llmClient.js` (new), `src/services/llmParser.js` (modify)
- **Expected behavior**: Move `requestChatCompletion`, `LLM_TIMEOUT_MS`, `MAX_INPUT_CHARS`, `OPENROUTER_URL`, `createLlmError`, and `mapErrorToReason` into `src/services/llmClient.js` and export them. Update `src/services/llmParser.js` to import these from `llmClient.js`; all existing parse behavior is unchanged. `REASON_CODES` may stay in `llmParser.js` or move; the key constraint is that `compatNotesService.js` imports from `llmClient.js`, not from `llmParser.js`.
- **Constraints**: Zero functional change to `llmParser.js` exports (`parseWithLlm`, `parseJobWithLlm`, `validateKey`, `REASON_CODES`). No new dependency. This is a refactor only.
- **Validation/test**: Existing `tests/services/llmParser.test.js` (or equivalent) must remain green with no changes. `llmClient.js` unit test optional but `mapErrorToReason` error-mapping cases should be covered.
- **Out of scope**: Notes generation logic (T009); `compatNotesService.js`.

### T009 `[x]` — `compatNotesService.js` — prompt building + LLM call
- **Target**: `src/services/compatNotesService.js` (new)
- **Expected behavior**: Export `generateNotes(application, profile, aiSettings) → Promise<{ summary: string, body: string }>`. Internally: (1) build a system prompt that instructs the model to explain the compatibility score concisely, output `{ "summary": "≤34 chars", "body": "..." }` as JSON, and avoid career advice / hiring predictions; (2) build a user content block with score, tier, resolved skill matches (proficient/learning/missing), JD fields (`jobTitle`, `responsibilities`, `skills`, `preferredSkills`, `minYearsExperience`), and profile fields (`skills` with ratings, `experience[].role`, `summary`); (3) call `llmClient.requestChatCompletion({ key: aiSettings.getKey(), model: aiSettings.getModel(), systemPrompt, userContent })`; (4) parse the JSON response, truncate `summary` to 34 chars if needed; (5) return `{ summary, body }`. Errors from `llmClient` propagate as-is (caller handles via `mapErrorToReason`). Imports `resolveSkillMatches` from `src/utils/skillProficiency.js` (T016) to build the skill context block.
- **Constraints**: The score and tier label **must** appear in the user content (Clarification Q3 — model must explain the deterministic result, not re-assess). No career advice, hiring predictions, or application recommendations in the prompt. `summary` hard-capped at 34 characters before return.
- **Validation/test**: `tests/services/compatNotesService.test.js` (new) — prompt assembly includes score/tier/skill matches; `summary` > 34 chars is truncated; empty/null application or profile fields are handled gracefully; `mapErrorToReason` maps LLM errors correctly.
- **Out of scope**: server-side persistence (T013); UI rendering.

### T010 `[x]` — `api.saveCompatNotes()` in frontend API service
- **Target**: `src/services/api.js`
- **Expected behavior**: Add `export function saveCompatNotes(id, { summary, body }) { return request('POST', `/api/applications/${id}/compat-notes`, { summary, body }); }`. Demo path: when `isDemo()`, call `demoStore.saveCompatNotes(id, { summary, body })` and return the result (T026 implements the demo side).
- **Constraints**: No additional validation client-side — the server validates. Matches the contract in [contracts/api.md](contracts/api.md).
- **Validation/test**: `tests/services/api.demo.test.js` — demo path calls `demoStore.saveCompatNotes`; real path emits a `POST` to the correct URL.
- **Out of scope**: Demo store implementation (T026).

### T011 `[x]` — Server route: `POST /api/applications/:id/compat-notes`
- **Target**: `server/routes/applications.js`
- **Expected behavior**: New route handler `router.post('/:id/compat-notes', requireAuth, attachRepos, async (req, res, next) => { … })`. Flow: parse and validate `id`; load application via `req.repos.applications.getById(id)` → 404 if missing; validate request body `{ summary, body }` (summary: non-empty string ≤ 34 chars; body: non-empty string); construct `CompatNotes = { summary, body, generatedAt: new Date().toISOString() }`; update the application with `{ compatAnalysis: CompatNotes }` (JSON serialized by `toRow`); return `res.json({ data: CompatNotes })`.
- **Constraints**: `generatedAt` is always server-set (client value not accepted). `compat_scored_at` is NOT updated by this route (it is only updated by score computation). `compat_analysis` is written; `compat_notes` is not touched.
- **Validation/test**: `tests/server/compatNotes.test.js` (new) — valid body returns `{ data: { summary, body, generatedAt } }` and persists to DB; summary > 34 chars → 400 VALIDATION_ERROR; empty body → 400; missing application → 404; `compat_notes` unchanged after call; `compat_scored_at` unchanged after call.
- **Out of scope**: LLM generation (client-side); demo path (T026).

**Checkpoint**: Notes can be generated client-side and persisted server-side. Run `tests/server/compatNotes.test.js` and `tests/services/compatNotesService.test.js`.

---

## Phase 04 — Skill proficiency utility  [P with Phase 03]

**Purpose**: Pure resolution function needed by both the CompatibilityModule and `compatNotesService.js`. No server changes.

### T012 `[x]` [P] — `src/utils/skillProficiency.js`
- **Target**: `src/utils/skillProficiency.js` (new)
- **Expected behavior**: Export two pure functions: `resolveSkillLevel(skillName, profileSkills) → 'proficient' | 'learning' | 'missing'` and `resolveSkillMatches(skillNames, profileSkills) → SkillMatch[]`. Resolution: normalize both names (`.trim().toLowerCase().replace(/\s+/g, ' ')`); find matching profile skill; if found and `level >= 3` → `'proficient'`; if found and `level < 3` → `'learning'`; if not found → `'missing'`. Empty `profileSkills` → all `'missing'`. Empty `skillNames` → empty array.
- **Constraints**: Pure — no side effects, no I/O. Normalized-exact match only (no fuzzy matching). `profileSkills` is `Array<{ name: string, level: number }>` (from 032 profile skill store).
- **Validation/test**: `tests/utils/skillProficiency.test.js` (new) — proficient at level 3/4/5; learning at level 1/2; missing when not on profile; normalized case/whitespace match; empty inputs.
- **Out of scope**: chip rendering (T017); notes prompt context assembly (T009 imports this).

**Checkpoint**: Proficiency utility ready. `compatNotesService.js` (T009) and CompatibilityModule (Phase 05) can now import it.

---

## Phase 05 — `CompatibilityModule.js` component

**Purpose**: The full module component covering all states. Requires Phases 01–04.

### T013 `[x]` [US1, US2] — Score ring SVG and compatibility tier helpers
- **Target**: `src/components/CompatibilityModule.js` (new — scaffold + score ring)
- **Expected behavior**: Create the module file. Implement: (1) `COMPAT_TIERS` map (Low/Medium/High/Great with arc color, pill ink, pill bg, label from design doc §14.4); (2) `getTier(score)` → tier object; (3) `renderScoreRing(score, size)` → SVG donut element — diameter `size` px (64 desktop / 58 mobile / 30 mini), stroke 8px (mini 4px), arc starts at 12 o'clock (`rotate(-90)`), clockwise, `stroke-linecap:round`, track `#EDE8DF`, progress arc in tier color, center number in DM Mono at `round(size × 0.32)`. Score 0 renders a Low-tier ring with no arc rather than erroring. Returns a DOM element (not a string).
- **Constraints**: SVG ring dimensions and colors are normative — implement to the exact values in `docs/design/application_overlay.md` §14.4. Tier bands: ≥85 Great, ≥65 High, ≥40 Medium, else Low.
- **Validation/test**: `tests/components/CompatibilityModule.test.js` (new) — `getTier` returns correct tier at boundaries (39/40/64/65/84/85); score ring SVG contains correct arc color per tier; score 0 renders without error.
- **Out of scope**: notes region; collapsed/expanded wiring (T014/T015).

### T014 `[x]` [US1] — Collapsed bar state
- **Target**: `src/components/CompatibilityModule.js`
- **Expected behavior**: Implement `renderCollapsed(application, profile)`. Output: `.cx-collapsed-content` div (indigo box, same styling as expanded panel border/bg) containing: (1) mini score ring (30px); (2) `.cx-verdict-text` Sora 12px/600 in tier ink color; (3) em-dash in `--t4`; (4) freshness-dependent trailing content — `fresh` → `.cx-summary` (headline, single-line ellipsis); `stale` → summary in `--t3` + amber `● Update available` marker; `none` → italic "Notes not generated" in `--t4`; `generating` → "Writing analysis…" in `--indigo`. The collapsed state is the default on module open. Score ring is always shown; score always reflects the current `application.compat` value.
- **Constraints**: `compat` must always be visible. Staleness of notes MUST NOT hide or dim the score. Trailing content logic uses the `NotesState` derivation from [data-model.md §4](data-model.md).
- **Validation/test**: `tests/components/CompatibilityModule.test.js` — collapsed renders score + verdict; all four trailing content variants render correctly for their `NotesState`; score visible in all states.
- **Out of scope**: expand/collapse toggle wiring (T015).

### T015 `[x]` [US2] — Expanded panel + expand/collapse toggle
- **Target**: `src/components/CompatibilityModule.js`
- **Expected behavior**: Implement the section header row (`.cx-header`) with: left label "Compatibility" (Sora 11px/500 `--t3`); right cluster with `✦ AI` tag (`.ai-tag`) and the expand/collapse toggle (`.sec-toggle` / `.sec-chev`). Toggle: label "Expand"/"Collapse", chevron rotates 90° when open, Sora 11px/500 `--t3` with indigo/`--indigo-soft` hover. Module starts **collapsed by default**. On expand, render `.cx-panel` (indigo box: `rgba(79,70,229,0.045)` bg, `1px solid rgba(79,70,229,0.14)` border, `border-radius:10px`, `gap:11px`). Panel internal order: (1) `.cx-score-row` (full 64px ring + verdict pill + headline); (2) `.cx-rule` divider; (3) notes region (Phase 05 tasks below). `CompatAvailability === 'no-profile'` → no toggle rendered (module non-collapsible per §14.7).
- **Constraints**: Collapsed by default on every modal open — state is not persisted between opens. AI tag dimmed (`opacity:.5`) in `no-profile` state. Verdict pill: `.verdict-pill` pill-radius, no border, tier ink + bg, 6px leading dot.
- **Validation/test**: `tests/components/CompatibilityModule.test.js` — module starts collapsed; click Expand shows panel; click Collapse hides panel; `no-profile` has no toggle; full score ring (64px) renders in expanded state.
- **Out of scope**: notes region content (T016–T020).

### T016 `[x]` [US3] — Notes region: `none` and `generating` states
- **Target**: `src/components/CompatibilityModule.js`
- **Expected behavior**: `none` state: `.cx-gen-inline` dashed-border prompt with copy *"No written analysis yet. Generate notes to explain this score and surface gaps."* and **✦ Generate notes** button (`.cx-gen-btn`, indigo bg/white text). When AI not configured (`!aiSettings.hasKey() || !aiSettings.isEnabled()`), replace the button with an "Enable AI in Settings →" link. In Create mode (application has no `id`): button visible but disabled with `title="Save the application first"`. `generating` state: `.cx-skel` with 12px indigo spinner + "Writing analysis…" header, then 3 shimmer lines at 96%/88%/70% widths (gradient `#E9E6F6`↔`#F4F2FB`, 1.4s animation). Score block remains visible above.
- **Constraints**: No LLM call is ever triggered automatically — only on explicit user click. Button disabled during in-flight generation (no double-submit). Shimmer animation uses CSS `@keyframes shimmer`.
- **Validation/test**: `tests/components/CompatibilityModule.test.js` — `none` state renders prompt + button; AI disabled → "Enable AI" link replaces button; Create mode → button disabled; `generating` shows skeleton + score visible.
- **Out of scope**: actual API call wiring (T021); `fresh`/`stale`/`error` states (T017–T019).

### T017 `[x]` [US3, US2] — Notes region: `fresh` state + Show more/less
- **Target**: `src/components/CompatibilityModule.js`
- **Expected behavior**: `fresh` state: (a) `.cx-notes-head` with "Analysis" label (Sora 11px/600 `--t3`) + 9px `✦ AI` tag; (b) `.cx-notes` prose (Sora 13px, line-height 1.62, `--t2`; `strong` → `--t1`/600; paragraph `margin-bottom:7px`); clamped by default to `max-height:62px` with `.clamp` class + 28px bottom fade; (c) `.cx-foot` footer: left **Show more ▾** / **Show less ▴** toggle (`.cx-showmore`, Sora 11.5px/600, indigo); right `.cx-meta` "✦ Generated {Mon D}" (DM Mono 10px `--t4`) + separator + **↻ Regenerate** (`.cx-regen`, Sora 11px/600, indigo, underline on hover). Clicking Show more removes `.clamp`, swaps label; clicking Show less restores.
- **Constraints**: `summary` ≤ 34 chars (single-line ellipsis via `.cx-headline`). Prose may contain `**bold**` — render as `<strong>`. `generatedAt` ISO string formatted as "Mon D" (e.g. "Jun 9"). Show more/less is independent per open — not persisted.
- **Validation/test**: `tests/components/CompatibilityModule.test.js` — `fresh` renders headline + clamped prose + footer; Show more expands; Show less re-clamps; Regenerate button present; generated date formatted correctly.
- **Out of scope**: stale state (T018); generation flow orchestration (T021).

### T018 `[x]` [US4] — Notes region: `stale` state
- **Target**: `src/components/CompatibilityModule.js`
- **Expected behavior**: `stale` state extends `fresh` with: (a) amber `.cx-stale-bar` pinned above prose (`#FFFBEB` bg, `1px solid #FDE68A` border, `border-radius:6px`; `⚠` icon `--amber-ink` 13px; copy *"Your profile or job data changed after these notes were written. The score above is current — refresh the notes to match."* Sora 11.5px `#92600A`; `.cx-stale-btn` **↻ Refresh notes** button); (b) prose dims to `opacity:.5` (`.cx-notes.stale` class); (c) headline dims to `--t3`; (d) footer action changes label **Regenerate → Refresh**. Staleness is derived as `notes.generatedAt < application.compat_scored_at` (ISO string comparison). If `compat_scored_at` is null (pre-migration row), notes are treated as `fresh` (no false stale alarm on legacy data).
- **Constraints**: Score ring MUST remain at full opacity and current value regardless of stale state. Stale bar copy is the generic message (Clarification Q4 — no context-aware copy). `compat_scored_at === null` → `fresh` (safe fallback).
- **Validation/test**: `tests/components/CompatibilityModule.test.js` — `stale` state renders amber bar with correct copy; prose dimmed; score visible; `compat_scored_at === null` → treated as fresh.
- **Out of scope**: refresh action orchestration (T021).

### T019 `[x]` [US5] — Notes region: `error` state
- **Target**: `src/components/CompatibilityModule.js`
- **Expected behavior**: `error` state: red-tinted bar styled like `.cx-stale-bar` but with `#FEF2F2` bg, `1px solid #FECACA` border, `⚠` icon `#DC2626`, copy *"Couldn't write the analysis. The score above is unaffected."*, and **↻ Try again** button (same metrics as `.cx-stale-btn`, red palette). Score ring, verdict pill, and skill chips remain fully visible and unaffected. Clicking Try again re-enters `generating` state and retries the LLM call.
- **Constraints**: `error` state MUST NOT hide, dim, or block the score ring or any modal field. The error is contained within the notes region only.
- **Validation/test**: `tests/components/CompatibilityModule.test.js` — `error` state renders red bar + retry button; score visible; Try again triggers re-entry to `generating`.
- **Out of scope**: `no-profile` state (T020).

### T020 `[x]` [US6] — `no-profile` availability state
- **Target**: `src/components/CompatibilityModule.js`
- **Expected behavior**: When `isProfileSufficient(profile)` returns false (no skills AND no experience AND no summary), render `.cx-empty` full-module state: `display:flex`, `gap:13px`, `padding:14px`, `border-radius:10px`, `border:1px dashed --border-2`, `#FBFAF8` bg. Icon `.cx-empty-ic` (34px circle, `○` glyph `--t3`). Title **"Compatibility unavailable"** (Sora 13px/600 `--t1`). Sub-copy *"Add your profile so Alice can score how well you match this role."* (Sora 12px `--t3`). Action **Complete profile →** (secondary button style). `✦ AI` tag in section header is dimmed `opacity:.5`. No Expand/Collapse toggle. Module is always "open" in this state (no collapsed bar).
- **Constraints**: `isProfileSufficient` is lenient — any of skills/experience/summary present → `scored` state. `no-profile` only for essentially empty profiles. Module always renders (never hidden) even with empty profile.
- **Validation/test**: `tests/components/CompatibilityModule.test.js` — empty profile → `no-profile` state; profile with only skills → `scored` state; "Complete profile →" button present; no toggle rendered.
- **Out of scope**: routing to the profile page (link target is a prop or a hash).

### T021 `[x]` [US3, US4, US5] — Generation orchestration: wiring the LLM call
- **Target**: `src/components/CompatibilityModule.js`
- **Expected behavior**: Implement the `onGenerate()` handler (triggered by Generate/Regenerate/Refresh/Try again buttons). Flow: (1) set state to `generating` → re-render; (2) call `compatNotesService.generateNotes(application, profile, aiSettings)` → `{ summary, body }`; (3) on success call `api.saveCompatNotes(application.id, { summary, body })` → `CompatNotes` with `generatedAt`; (4) update `application.compatAnalysis` with the returned notes; (5) set state to `fresh` → re-render; (6) call `onNotesGenerated(updatedApplication)` callback so the parent (Modal) can update its draft. On LLM error: map via `mapErrorToReason` (imported from `llmClient.js`), set state to `error` → re-render. Generation button is disabled during in-flight call (idempotency guard).
- **Constraints**: Never trigger automatically (only on explicit user action). `onNotesGenerated` callback is required so Modal's dirty-state tracking reflects the new `compatAnalysis` value. If `application.id` is null (Create mode), button is disabled and `onGenerate` is a no-op.
- **Validation/test**: `tests/components/CompatibilityModule.test.js` — successful generation flows none→generating→fresh; LLM error flows generating→error; API error flows generating→error; button disabled during generation.
- **Out of scope**: demo mode (T026); responsive layout (T022).

### T022 `[x]` [US1, US2] — Responsive layout (mobile bottom sheet)
- **Target**: `src/components/CompatibilityModule.js` + associated CSS
- **Expected behavior**: At `< 640px` (`.compact` class on module or inherited from modal body): ring shrinks to 58px (expanded) / 30px (mini, unchanged); stale bar wraps and `.cx-stale-btn` gets `margin-left:auto`; `none` generate prompt stacks vertically with full-width button; `.cx-empty` stacks vertically (icon → text → full-width action). Within the `.cx-score-row`: ring + meta stay inline. All functionality remains available at mobile viewport.
- **Constraints**: Design doc §14.12 values are normative. Desktop ring 64px; mobile ring 58px. No functionality is hidden on mobile — only layout adapts.
- **Validation/test**: Manual verification in Phase 10 Browser Smoke Test. Unit test: `.compact` class produces smaller ring size constant.
- **Out of scope**: Tracker card responsive changes.

**Checkpoint**: `CompatibilityModule.js` is complete and independently testable. Run `tests/components/CompatibilityModule.test.js`.

---

## Phase 06 — Modal.js integration

**Purpose**: Wire the module into the modal, add profile, upgrade skill chips. Requires Phase 05.

### T023 `[x]` — Add `profile` param to `Modal.open()`; Tracker.js profile fetch
- **Target**: `src/components/Modal.js`, `src/pages/Tracker.js`
- **Expected behavior**: In `Modal.open(application, options)`, add `profile` to the options object. Store as `_profile` module-level variable alongside `_draft`. In `Tracker.js`, add `api.getProfile()` as a parallel fetch at page init (alongside the existing applications fetch); store as `_profile`. Pass `profile: _profile` into all `Modal.open(...)` calls in `Tracker.js`. If `profile` is null or undefined: skill chips fall back to plain (no proficiency coding); `CompatibilityModule` receives `null` and shows `no-profile` state.
- **Constraints**: Profile fetch is parallel to applications fetch (do not serialize). Null profile is a graceful fallback, not an error. All existing modal callers that do not pass `profile` continue to work.
- **Validation/test**: `tests/pages/Tracker.test.js` or equivalent — profile is fetched at init; `Modal.open` receives `profile`.
- **Out of scope**: CreationPicker modal (it does not show the compatibility module in a meaningful state pre-save).

### T024 `[x]` — Upgrade skill chip editors to proficiency-coded chips (row 6)
- **Target**: `src/components/Modal.js`
- **Expected behavior**: In `makeChipEditor({ label, key })`, add an optional `profileSkills` parameter. When provided, each chip renders with proficiency styling per §14.5: `.chip.lvl-high` (`✓` glyph, `#15803D` text, `#E7F6EC` bg), `.chip.lvl-low` (`●` glyph, `#A16207` text, `#FBF1D9` bg), `.chip.miss` (`✕` glyph, `#DC2626` text, `#FCE9E9` bg). Glyph (`.ck`) is 9px; chip is DM Mono 10.5px, `padding:3px 8px`, pill radius, no border. When `profileSkills` is null/absent, chips render as plain text (existing behavior, no regression). Add a legend `.skills-legend` below the two skill columns: DM Mono 10px `--t3`, three entries: `✓ Proficient` (glyph `#16A34A`), `● Learning` (glyph `#D97706`), `✕ Missing` (glyph `#DC2626`). Update the two `makeChipEditor` calls for `skills` and `preferredSkills` to pass `profileSkills: _profile?.skills ?? null`.
- **Constraints**: Proficiency coding is visual only — chip add/remove interaction is unchanged. Proficiency resolves via `resolveSkillLevel` from `src/utils/skillProficiency.js` (T012). Legend only rendered when `profileSkills` is non-null. Archived mode: chips render proficiency-coded but without the `×` remove button (existing archived-mode chip behavior preserved).
- **Validation/test**: `tests/components/Modal.test.js` — skill chips with `profileSkills` render with correct class per level; legend appears; chips without `profileSkills` render plain.
- **Out of scope**: Compatibility module row (T025).

### T025 `[x]` — Replace `createCompatField` + `compatNotes` with `CompatibilityModule`; fix field order
- **Target**: `src/components/Modal.js`
- **Expected behavior**: In `_renderBody()`: (1) remove `createCompatField(_draft.compat)` and `makeInlineText({ label: 'Compat Notes', key: 'compatNotes', … })`; (2) remove the `CompatBar` import; (3) add `CompatibilityModule.render({ application: _draft, profile: _profile, onNotesGenerated: _handleNotesGenerated })` at body position #7 (after Skills row at #6, before Timeline at #8). Implement `_handleNotesGenerated(updatedNotes)` — updates `_draft.compatAnalysis` to the returned notes and calls `_syncFooter()` so dirty-state tracking reflects the change. Fix body field order to match design doc §4: Company, Recruiter, Location, Salary, Shift, Work Setup, Min Years, Responsibilities (full-width), Required Skills, Preferred Skills, Compatibility module, Timeline, URL, General Notes.
- **Constraints**: `CompatibilityModule` is a standalone component — Modal does not reach into its internals. The `onNotesGenerated` callback must update `_draft` so the save payload includes the latest `compatAnalysis`. `compat` remains excluded from the PATCH payload (server-authoritative). Body field order must exactly match design doc §4 — do not reorder without updating the doc.
- **Validation/test**: `tests/components/Modal.test.js` — CompatibilityModule rendered in modal body; `createCompatField` no longer called; `compatNotes` field absent; `onNotesGenerated` updates `_draft.compatAnalysis`.
- **Out of scope**: Demo mode (T026).

**Checkpoint**: Modal fully integrated. Run full component test suite: `npm run test:run -- tests/components/`.

---

## Phase 07 — Demo mode parity

**Purpose**: Wire `saveCompatNotes` and `compat_scored_at` through `demoStore.js`, add seed data.

### T026 `[x]` — `demoStore.saveCompatNotes` + `compatScoredAt` stamping
- **Target**: `src/data/demoStore.js`
- **Expected behavior**: Add `saveCompatNotes(id, { summary, body })` method: find the in-memory application by `id`; construct `CompatNotes = { summary, body, generatedAt: new Date().toISOString() }`; store as `application.compatAnalysis`; return `{ data: CompatNotes }` (matching the server route response shape). In the existing `create` path, always stamp `compatScoredAt: new Date().toISOString()` alongside `compat`. In the existing `update` path, stamp `compatScoredAt` only when the update payload contains at least one compat-relevant field (`skills`, `preferredSkills`, `responsibilities`, `jobTitle`, `minYearsExperience`) — mirrors the conditional logic from T007. Reuse or import the same `hasCompatRelevantFields` helper from T007 rather than duplicating the field list.
- **Constraints**: Same response shape as the server route so `api.js` can call it transparently. Same staleness policy as the server route: non-compat demo edits (General Notes, URL, recruiter) must not update `compatScoredAt` and must not make notes stale.
- **Validation/test**: `tests/data/demoStore.test.js` — `saveCompatNotes` persists and returns correct shape; `compatScoredAt` set on create; `compatScoredAt` updated when `skills` changes; `compatScoredAt` unchanged when only `notes` changes.
- **Out of scope**: LLM calls in demo (demo uses the real client-side LLM path via `aiSettings`).

### T027 `[x]` [P] — Seed `compat_analysis` and `compat_scored_at` in demo data
- **Target**: `src/data/demoSeed.js`
- **Expected behavior**: Add `compat_analysis` (a pre-written `CompatNotes` JSON object) to at least 3 representative demo applications — one `fresh` (no profile changes after), one that will appear `stale` (set `compat_scored_at` to a date after the notes `generatedAt`), and one `null` (notes never generated). Set `compat_scored_at` on all applications. This gives the demo realistic coverage of all notes states without requiring an OpenRouter call.
- **Constraints**: Seeded notes must be plausible and consistent with the application's seeded score and skills. `generatedAt` and `compat_scored_at` use fixed ISO strings (not `Date.now()`) so the demo is deterministic.
- **Validation/test**: Demo runs in `npm run dev` demo runtime; seeded applications show the expected notes states on open.
- **Out of scope**: LLM generation in demo.

**Checkpoint**: Demo mode fully functional. Run `tests/data/demoStore.test.js` and open the app in demo runtime.

---

## Phase 08 — Cross-cutting tests + polish

**Purpose**: Remaining test coverage not covered by prior phases; lint/format pass.

### T028 `[x]` [P] — Server column wiring integration test
- **Target**: `tests/server/repositories/columns.test.js`
- **Expected behavior**: Extend existing test to cover `compatAnalysis` and `compatScoredAt` round-trips (create → read → confirm values); confirm `compatNotes` is absent from writable surface and returns `null` on read post-migration. Confirm `compatAnalysis` serialized as JSON string in SQLite and deserialized back to object.
- **Constraints**: No Supabase call needed; SQLite only for this test.
- **Validation/test**: `npm run test:run -- tests/server/repositories/columns.test.js` green.

### T029 `[x]` [P] — `CompatibilityModule` full state machine coverage
- **Target**: `tests/components/CompatibilityModule.test.js`
- **Expected behavior**: Ensure all acceptance scenarios from spec.md are covered: band boundary scores (39/40/64/65/84/85); `no-profile` with empty/partial profiles; all five `NotesState` transitions; stale detection (`generatedAt < compatScoredAt`); `compatScoredAt === null` → fresh; Create mode disabled button; AI disabled → "Enable AI" link; concurrent generation guard (button disabled during in-flight call).
- **Constraints**: No real LLM calls — mock `compatNotesService.generateNotes` and `api.saveCompatNotes`.
- **Validation/test**: `npm run test:run -- tests/components/CompatibilityModule.test.js` green.

### T030 `[x]` — Lint + format pass
- **Target**: All new and modified files
- **Expected behavior**: `npm run lint` and `npm run format` pass with zero errors. No unused imports, no stray console.log, consistent code style throughout new files.
- **Constraints**: Fix lint errors; do not suppress with ignore comments unless there is a documented reason.
- **Validation/test**: `npm run lint` exits 0; `npm run format` produces no diff.

---

## Phase 09 — Release Prep (required by constitution)

### T031 `[ ]` — Version bump
- **Target**: `package.json`, `package-lock.json` (root fields only), `src/components/Footer.js` (or equivalent `APP_VERSION` constant)
- **Expected behavior**: Bump version to the next MINOR (new user-facing feature). Sync `package-lock.json` root `version` and `packages[""].version` to match. Update any in-app `APP_VERSION` constant. Run `npm run test:run` — any test asserting the literal version string must be updated.
- **Constraints**: Only the two root-level version fields in `package-lock.json` — do not touch dependency version entries.

### T032 `[ ]` — `CHANGELOG.md` entry
- **Target**: `CHANGELOG.md`
- **Expected behavior**: New `## [<new-version>] — YYYY-MM-DD` section above the previous entry. Under **Added**: Compatibility Insights Panel (collapsible module, score ring, proficiency-coded skill chips, AI-generated notes, staleness management). Under **Changed**: `compat_notes` retired; `compat_analysis` and `compat_scored_at` added; `llmClient.js` extracted from `llmParser.js`. Under **Removed**: `CompatBar` component, `compatNotes` field from UI. Update `[Unreleased]` and `[<new-version>]` diff links at the bottom. Keep a Changelog format.

### T033 `[ ]` — `README.md` update
- **Target**: `README.md`
- **Expected behavior**: Add feature bullet for the Compatibility Insights Panel under the features list. Update the `Current version` line. No new env-var section needed (no new env vars). No `specs/037-…` link in Further Reading (spec is indexed in REPO_MAP).

### T034 `[ ]` — `docs/feature_roadmap.md` tick
- **Target**: `docs/feature_roadmap.md`
- **Expected behavior**: Mark feature 037 as `[x]` shipped with the new version number. Update theme/row status if this feature completes a milestone.

### T035 `[ ]` — `docs/REPO_MAP.md` update
- **Target**: `docs/REPO_MAP.md`
- **Expected behavior**: Add entries for: `src/services/llmClient.js`, `src/services/compatNotesService.js`, `src/components/CompatibilityModule.js`, `src/utils/skillProficiency.js`. Add a Spec Packages row for `specs/037-compatibility-insights-panel/`. Update entries for `src/services/llmParser.js` (now imports from `llmClient.js`), `src/components/Modal.js` (embeds CompatibilityModule), `server/routes/applications.js` (new notes route), `server/services/compatibility.js` (stamps `compatScoredAt`), `server/db/columns.js` (new columns). Mark `src/components/CompatBar.js` as removed if fully replaced.

### T036 `[ ]` — `docs/deployment.md` check
- **Target**: `docs/deployment.md`
- **Expected behavior**: No new env vars introduced by this feature (AI key remains in localStorage, not a server-side env var). Confirm `docs/deployment.md` requires no changes beyond adding a pointer to the Supabase migration SQL from `data-model.md` if the hosted schema section exists. Link `quickstart.md` rather than restating steps.

### T037 `[ ]` — Docs sanity check
- **Target**: All docs + source files
- **Expected behavior**: `grep` the previous version string across `package.json`, `package-lock.json` (root only), `src/`, `README.md`, `CHANGELOG.md`, `docs/` — only historical CHANGELOG headings and diff URLs should remain. Verify every cross-link in REPO_MAP and README points to a file that exists. Confirm running app renders the new version string.

---

## Phase 10 — Browser Smoke Test (required by constitution)

**Setup**: `npm run dev` (frontend + backend); seed or fixture data loaded; a profile with skills at varying proficiency levels; at least one application with fresh notes, one stale, one with no notes.

### T038 `[x]` [US1] — Score + skills at a glance
- **Steps**: Open any application with a computed score. Confirm: collapsed module shows mini ring with correct numeric score; verdict label matches tier band; required and preferred skill chips show `✓`/`●`/`✕` against your profile; legend is present. Do NOT expand the module.
- **Pass criteria**: All 7 acceptance scenarios from spec.md US1 verified. Score visible without expanding. Skill chips colored correctly (spot-check 3 skills across all three states).

### T039 `[x]` [US2] — Expand for full context
- **Steps**: Click "Expand" on the module. Confirm: full 64px score ring appears; verdict pill with correct tier color; notes section visible (fresh/none state); "Collapse" button returns to compact bar.
- **Pass criteria**: All 4 acceptance scenarios from spec.md US2 verified. Show more/less toggle works on long notes prose.

### T040 `[ ]` [US3] — Generate AI analysis
- **Steps**: Open an application with no analysis (notes = null). Expand module. Confirm `none` state shows "Generate notes" button. Click it. Confirm `generating` skeleton appears (score still visible above). Wait for completion. Confirm `fresh` state: headline, prose, "Generated {date}", Regenerate button.
- **Pass criteria**: All 6 acceptance scenarios from spec.md US3 verified. No automatic LLM call on modal open (check network tab before clicking). Create mode → Generate button disabled.

### T041 `[ ]` [US4] — Stale notes
- **Steps**: Generate notes on an application. Then edit a compat-relevant field (e.g. add a required skill) and save. Reopen the modal. Confirm amber stale bar with correct copy; dimmed prose; score ring at new current value; "Refresh notes" generates new notes and transitions to fresh.
- **Pass criteria**: All 6 acceptance scenarios from spec.md US4 verified. Editing a non-compat field (General Notes) does NOT trigger stale state.

### T042 `[x]` [US5] — AI failure handling
- **Steps**: Disable network or set an invalid API key. Click "Generate notes". Confirm `error` state: red bar with "Couldn't write the analysis…"; score ring and skill chips still visible and functional. Click "Try again" → `generating` state reappears.
- **Pass criteria**: All 4 acceptance scenarios from spec.md US5 verified. Modal remains fully functional during and after error.

### T043 `[ ]` [US6] — No-profile state
- **Steps**: Clear all profile data (or use a test fixture with empty profile). Open any application. Confirm module shows "Compatibility unavailable" with "Complete profile →" action, no score ring, no toggle, `✦ AI` tag dimmed.
- **Pass criteria**: All 3 acceptance scenarios from spec.md US6 verified.

### T044 `[ ]` — Mobile layout smoke test
- **Steps**: Open DevTools, set viewport to 375px width (mobile). Open the modal via a card click. Confirm: single-column body layout; module collapsed bar visible; expand works; skill chips wrap correctly; stale bar wraps with "Refresh notes" button pushed right; generate prompt stacks vertically with full-width button; no horizontal overflow.
- **Pass criteria**: All module functionality available at 375px. No broken layout. Touch targets adequately sized.

---

## Dependencies & Execution Order

```
Phase 01 (Data layer)
  └─ Phase 02 (compat_scored_at stamping)
       └─ Phase 03 (LLM service + route)    ─┐ parallel
  └─ Phase 04 (skill proficiency utility)   ─┘
       └─ Phase 05 (CompatibilityModule)
            └─ Phase 06 (Modal integration)
                 └─ Phase 07 (Demo parity)
                      └─ Phase 08 (Tests + polish)
                           └─ Phase 09 (Release Prep)
                                └─ Phase 10 (Browser Smoke Test)
```

Phases 03 and 04 can run in parallel once Phase 01 is complete. All `[P]`-marked tasks within a phase can run in parallel (different files, no shared edits).
