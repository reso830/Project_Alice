# Plan Review Checklist: Compatibility Insights Panel

Use before accepting the plan and advancing to `/speckit.tasks`.

---

## Constitution compliance

- [ ] Required application fields (company, title, status, last_status_update, responsibilities) — unaffected by this feature
- [ ] Business logic separated from UI — `compatNotesService.js`, `skillProficiency.js`, `CompatibilityModule.js` are distinct; Modal.js only wires them
- [ ] Centralized validation — `summary` length and `body` non-empty validated in the server route; `compat_analysis` not client-writable via PATCH
- [ ] No silent corruption — malformed `compat_analysis` JSON degrades to `none` state; invalid notes rejected on persist
- [ ] Privacy / local-first — API key stays in browser localStorage; never sent to server; no analytics
- [ ] Responsive + a11y — desktop and mobile layouts planned; score communicated via number + text; keyboard navigation within existing focus trap
- [ ] Automated tests planned — unit (skillProficiency, module state, notes service), server (route, column wiring, compat_scored_at), component (Modal integration)

---

## Spec coverage

- [ ] All 6 user stories have implementation coverage in the plan phases
- [ ] All 5 notes states (none, generating, fresh, stale, error) have UI components planned
- [ ] `no-profile` state has a component path
- [ ] FR-016 (staleness via `compat_scored_at`) — mechanism designed and captured in data-model.md + research.md D3/D6
- [ ] FR-023 amendment documented — client-side LLM call; server route is a persistence endpoint; captured in research.md D1
- [ ] Create mode disabled Generate button (FR from clarification Q2) — covered in CompatibilityModule phase

---

## Architecture

- [ ] `llmClient.js` extraction does not break existing `llmParser.js` behavior — it is a refactor only
- [ ] `compatNotesService.js` imports from `llmClient.js`, not `llmParser.js`
- [ ] `compat_scored_at` stamped on every score computation attempt (not only on value change) — research.md D6
- [ ] Profile passed from Tracker.js to Modal.open() — fallback to `no-profile` if null
- [ ] `CompatibilityModule.js` is standalone; Modal.js only calls `render()` and `destroy()`
- [ ] Demo mode: `saveCompatNotes` in `demoStore.js` + `compatScoredAt` stamping

---

## Data model

- [ ] `compat_analysis` column — SQLite migration, Supabase SQL, assertHostedSchema probe, column wiring in `columns.js`
- [ ] `compat_scored_at` column — same
- [ ] `compat_notes` retirement — nulled in migration; removed from writable schema; column not dropped
- [ ] `compatScoredAt` and `compatAnalysis` removed from `updateSchema` / `createSchema`

---

## Risks acknowledged

- [ ] `compat_scored_at` backfilled to `created_at` — acceptable (no pre-existing notes)
- [ ] Summary > 34 chars returned by LLM — server rejects; UI truncates as fallback
- [ ] Score unchanged but data changed → `compat_scored_at` still stamped (research.md D6)
- [ ] Profile null fallback in Modal — graceful degradation to plain chips + `no-profile` module state

---

## Phase order

- [ ] Phase 1 (data layer) before all others — downstream phases depend on column wiring
- [ ] Phase 2 (`compat_scored_at` stamping) before Phase 6 (CompatibilityModule) — stale state requires the timestamp
- [ ] Phase 3 (LLM client extraction) before Phase 4 (notes service) — dependency
- [ ] Phase 06 (Modal integration) after Phases 04+05 — skill proficiency utility and CompatibilityModule must exist first
- [ ] Phase 09 (Release Prep) second-to-last
- [ ] Phase 10 (Browser Smoke Test) final
