# Plan Review Checklist: Compatibility Insights Panel

Use before accepting the plan and advancing to `/speckit.tasks`.

---

## Constitution compliance

- [x] Required application fields (company, title, status, last_status_update, responsibilities) — unaffected by this feature
- [x] Business logic separated from UI — `compatNotesService.js`, `skillProficiency.js`, `CompatibilityModule.js` are distinct; Modal.js only wires them
- [x] Centralized validation — `summary` length and `body` non-empty validated in the server route; `compat_analysis` not client-writable via PATCH
- [x] No silent corruption — malformed `compat_analysis` JSON degrades to `none` state; invalid notes rejected on persist
- [x] Privacy / local-first — API key stays in browser localStorage; never sent to server; no analytics
- [x] Responsive + a11y — desktop and mobile layouts planned; score communicated via number + text; keyboard navigation within existing focus trap
- [x] Automated tests planned — unit (skillProficiency, module state, notes service), server (route, column wiring, compat_scored_at), component (Modal integration)

---

## Spec coverage

- [x] All 6 user stories have implementation coverage in the plan phases
- [x] All 5 notes states (none, generating, fresh, stale, error) have UI components planned
- [x] `no-profile` state has a component path
- [x] FR-016 (staleness via `compat_scored_at`) — mechanism designed and captured in data-model.md + research.md D3/D6
- [x] FR-023 amendment documented — client-side LLM call; server route is a persistence endpoint; captured in research.md D1
- [x] Create mode disabled Generate button (FR from clarification Q2) — covered in CompatibilityModule phase

---

## Architecture

- [x] `llmClient.js` extraction does not break existing `llmParser.js` behavior — it is a refactor only
- [x] `compatNotesService.js` imports from `llmClient.js`, not `llmParser.js`
- [x] `compat_scored_at` stamped on every score computation attempt (not only on value change) — research.md D6
- [x] Profile passed from Tracker.js to Modal.open() — fallback to `no-profile` if null
- [x] `CompatibilityModule.js` is standalone; Modal.js only calls `render()` and `destroy()`
- [x] Demo mode: `saveCompatNotes` in `demoStore.js` + `compatScoredAt` stamping

---

## Data model

- [x] `compat_analysis` column — SQLite migration, Supabase SQL, assertHostedSchema probe, column wiring in `columns.js`
- [x] `compat_scored_at` column — same
- [x] `compat_notes` retirement — nulled in migration; removed from writable schema; column not dropped
- [x] `compatScoredAt` and `compatAnalysis` removed from `updateSchema` / `createSchema`

---

## Risks acknowledged

- [x] `compat_scored_at` backfilled to `created_at` — acceptable (no pre-existing notes)
- [x] Summary > 34 chars returned by LLM — server rejects; UI truncates as fallback
- [x] Score unchanged but data changed → `compat_scored_at` still stamped (research.md D6; applies to `recomputeActive` batch path)
- [x] Profile null fallback in Modal — graceful degradation to plain chips + `no-profile` module state

---

## Phase order

- [x] Phase 01 (data layer) before all others — downstream phases depend on column wiring
- [x] Phase 02 (`compat_scored_at` stamping) before Phase 05 (CompatibilityModule) — stale state requires the timestamp
- [x] Phase 03 (LLM client extraction + notes service) — `llmClient.js` (T008) extracted before `compatNotesService.js` (T009) within the same phase
- [x] Phase 06 (Modal integration) after Phases 04+05 — skill proficiency utility and CompatibilityModule must exist first
- [x] Phase 09 (Release Prep) second-to-last
- [x] Phase 10 (Browser Smoke Test) final
