# Plan Review Checklist: Loading & Async States

**Feature**: 029 · **Date**: 2026-05-27 · **Status**: Signed off (post-clarify; A · 2026-05-27)
**Purpose**: Pre-implementation gate. Originally scoped to run before `/speckit.tasks`.

This is the single review gate between the planning artifacts and the `tasks.md` ledger. If any item below is incomplete or contested, resolve it before implementation begins.

---

## 0. Workflow-order acknowledgement (added 2026-05-27)

The Speckit phases for this feature ran in the order: `specify → plan → tasks → clarify`. This checklist was authored alongside `plan.md` before tasks were generated, but the formal sign-off review was deferred until after `tasks.md` was written and `/speckit.clarify` produced [spec § Session 2026-05-27 clarifications](../spec.md#session-2026-05-27) (Q1–Q5).

Net effect:
- The checklist applies retroactively against the **clarification-updated** spec + plan + tasks (FR-007 and FR-008 wording, US-2 acceptance scenarios 2–6, the new "Demo-mode parsing surfaces" edge case, and the duplicate-run contract have all been amended).
- The user signs off below once they have read the clarified artifacts.
- No tasks have been executed yet — gate still bites before Phase 01.1 begins.

A Codex review on 2026-05-27 caught four artifact-drift items (duplicate-run contract, US-2 abort wording, demo-mode toast conflicts, this gate's pending status) — all four have been addressed in the same revision that wrote this paragraph.

---

## 1. Constitution compliance

| Item | Status | Notes |
|------|--------|-------|
| Application records still include required `companyName`, `jobTitle`, `status`, `lastStatusUpdate`, `responsibilities` | [x] | This feature changes no fields. |
| Business logic separated from UI rendering | [x] | `asyncUI` is presentation-side state, not business logic. API stays in `api.js`. |
| Validation rules centralized + reusable | [x] | No new field validation; existing models untouched. |
| Required field, URL, date, status-transition validation preserved | [x] | Touched code (call sites) does not bypass any validation. |
| Empty / loading / error states defined | [x] | This feature is the empty/loading/error-state work. |
| Automated tests planned for changed validation / status / date behaviour | [x] | Tests cover the new helper + each retrofit site. |
| Local-first / no analytics preserved | [x] | No new telemetry. |
| Desktop + mobile responsive, labeled forms, keyboard navigation, non-color-only signalling | [x] | Phase 08 audit confirmed skeleton ARIA, polite inline-error regions, retry focus, keyboard reachability, busy labels, and reduced-motion CSS through automated tests and source inspection. Manual screen-reader and OS reduced-motion spot checks were not executable in this sandbox; residual visual/AT confirmation is deferred to Phase 11 browser smoke. |
| Data-model extensibility preserved | [x] | No persistence change to extend. |
| Release Prep phase planned (before Browser Smoke Test) | [x] | Captured in plan § Project Structure + Affected Areas. |
| Browser Smoke Test phase planned (last phase) | [x] | Captured in [quickstart.md](../quickstart.md). |

---

## 2. Spec ↔ plan traceability

| Spec section | Plan section | Status |
|--------------|--------------|--------|
| FR-001..FR-006 (Shared vocabulary) | Plan § Summary + Architecture, contracts § 2.1–2.3 | [x] |
| FR-007..FR-009 (Duplicate-submit prevention) | Plan § Data flow (Save channel), contracts § 2.1 idempotency, research § 3.1 + § 3.4 | [x] |
| FR-010..FR-013 (Inline error recovery) | Plan § Data flow, contracts § 2.3, research § 3.6 | [x] |
| FR-014..FR-017 (Accessibility) | Plan § Constitution Check (accessibility row), data-model § 5.3, contracts § 4.2 | [x] |
| FR-018..FR-019 (Mode parity) | Plan § Data flow demo note, research § 4.5 | [x] |
| FR-020..FR-023 (Existing-surface preservation) | Plan § Risk (regression in existing skeletons), contracts § 6 | [x] |
| FR-024..FR-027 (Constitutional) | Plan § Constitution Check | [x] |
| Spec Edge Cases (13, post-clarify) | Plan § Risks (FR-008 over-locking RESOLVED), research § 3.4, § 3.5; Demo-mode parsing edge case added at clarify Q5 | [x] |
| Spec SC-001..SC-008 | Plan § Validation approach, quickstart § 8 + § 10 | [x] |

---

## 3. Architecture review

### 3.1 — Module boundaries

- [x] `src/utils/asyncUI.js` does **not** import from `src/components/`, `src/pages/`, or `src/data/`. (Only `src/components/Toast.js` is a permitted dependency.) — confirmed in plan § Architecture diagram + contracts § 2.
- [x] `src/utils/skeletons.js` is dependency-free (pure DOM builders, no imports of `Toast`, `api`, etc.). — confirmed in Task 01.2 constraints.
- [x] No new top-level directory introduced. — confirmed in plan § Project Structure.
- [x] `server/` is not touched. — confirmed via Affected Areas + § 9 cross-check.
- [x] `shared/` is not touched. — confirmed via Affected Areas + § 9 cross-check.

### 3.2 — Existing-code preservation

- [x] FR-020: Tracker `renderApplicationSkeleton` DOM is preserved byte-identically. The plan calls this out and SC-007 enforces it with a snapshot test.
- [x] FR-021: Application Overlay post-save toast is preserved.
- [x] FR-022: Resume Import rotating messages are preserved.
- [x] FR-023: Auth-form `aria-busy` toggling is preserved.
- [x] Modal `_saveController` lifecycle is preserved (research § 3.4 + Q1 clarification).

### 3.3 — Naming / API consistency

- [x] Helper names are verb-led: `bindBusyButton`, `bindContainerBusy`, `renderInlineError`. No "Manager", "Service", "Controller" suffix.
- [x] Skeleton builders are noun-led, prefixed `build`: `buildApplicationListSkeleton`, etc. Consistent with the DOM-factory convention of `buildXyz` already used elsewhere in the codebase.
- [x] Channel names are kebab-case lowercase: `initial-load`, `refresh`, `save`, `parse`, `mutation`, `transition`. Documented in [docs/design/loading.md](../../../docs/design/loading.md) (to be written in implementation).

### 3.4 — Contract surface

- [x] `bindBusyButton` returns `{ run, dispose }` (not a class, not a promise directly). Documented in [contracts/api.md § 2.1](../contracts/api.md#21--bindbusybutton).
- [x] `bindContainerBusy` returns the same shape. Documented in [contracts/api.md § 2.2](../contracts/api.md#22--bindcontainerbusy).
- [x] `renderInlineError` returns `{ element, focus, dispose }`. Documented in [contracts/api.md § 2.3](../contracts/api.md#23--renderinlineerror).
- [x] All three are idempotent on `dispose()`.
- [x] All three guarantee single network request on rapid `run()` calls. (Post-clarify Q&: duplicate `run()` calls return the **same in-flight promise**; one `action()` invocation total.)

---

## 4. FR-008 contradiction resolution

**Resolved at clarify (Q1, [spec § Session 2026-05-27](../spec.md#session-2026-05-27))**: "Inert" means "does not commit a different action"; close paths (Esc, backdrop, ✕) during Save invoke `_saveController.abort()` as today. Discard is locked but never aborts (it has no in-flight request).

- [x] FR-008 wording amended in spec.md to remove the literal contradiction.
- [x] US-2 acceptance scenarios split into Discard-inert (AS-2) vs. Esc/backdrop/✕-abort (AS-3) per the resolution.
- [x] Task 03.5 documents the resolution at code-comment level.
- [x] User acknowledges the resolution is the canonical answer (sign off below). — A, 2026-05-27.

---

## 5. Test plan completeness

| Test surface | Planned in plan | Status |
|--------------|-----------------|--------|
| `tests/utils/asyncUI.test.js` (new) | Yes — three exported functions × success / failure / dispose / dup-click | [x] |
| `tests/utils/skeletons.test.js` (new) | Yes — five builders × DOM shape + ARIA + reduced-motion-class | [x] |
| `tests/components/Modal.test.js` (extend) | Yes — Save / Archive / Unarchive / Star / Status busy + lockout + abort-preserved | [x] |
| `tests/components/Card.test.js` (extend) | Yes — Archive / Unarchive busy | [x] |
| `tests/components/QuickFiltersToolbar.test.js` (extend) | Yes — chip aria-busy on view change | [x] |
| `tests/components/CreationPicker.test.js` (new) | Yes — parse busy + inline-error + Try again + demo-mode UI-gating test (Q5) | [x] |
| `tests/components/ResumeImport.test.js` (new/extend) | Yes — upload busy + inline-error + demo-mode hidden assertion (Q5) | [x] |
| `tests/pages/Tracker.test.js` (extend) | Yes — skeleton + inline-error + transition swap | [x] |
| `tests/pages/Calendar.test.js` (extend) | Yes — skeleton (no bare text) + refresh aria-busy | [x] |
| `tests/pages/Profile.test.js` (extend) | Yes — apps block skeleton (no bare text) | [x] |
| `tests/pages/ProfileEdit.test.js` (extend) | Yes — section skeleton + Save busy | [x] |
| Snapshot lock on Tracker + Profile skeleton DOM (FR-020, SC-007) | Yes — `tests/utils/skeletons.test.js` includes a baseline-fixture snapshot | [x] |
| Cross-cutting "no bare Loading… string" assertion (SC-003) | Yes — repo-wide grep or page-test integration (Task 08.3) | [x] |
| Demo-mode parity assertions (FR-018, FR-019) | Yes — each component test runs against demo store + hosted-stub (Task 08.2) | [x] |

---

## 6. Quickstart / smoke completeness

- [x] [quickstart.md](../quickstart.md) covers each of the six user stories in spec.md.
- [x] Each story's pass criteria are observable in a real browser.
- [x] Demo-mode caveats are called out (visual flashes not observable; rely on tests; parser entry UI-gated per Q5).
- [x] Regression-smoke section (§ 7) covers each FR-020..FR-023 preservation.
- [x] Deploy-verification section (§ 9) confirms no wire-level API change.

---

## 7. Risks ack

- [x] **Tracker / Profile skeleton DOM port regression** — mitigation in place (snapshot test).
- [x] **Save-path regression in Modal.js** — mitigation in place (`finally` ordering test).
- [x] **bindBusyButton × AbortController interaction** — contract documented in [contracts/api.md § 2.1 row 4](../contracts/api.md#21--bindbusybutton); test asserts dispose-during-flight does not throw.
- [x] **FR-008 over-locking** — addressed (§ 4 of this checklist).
- [x] **CSS specificity collisions** — mitigated by BEM-style new class names.
- [x] **Demo-mode synchronous-flash invisibility** — explicitly accepted (tests cover; humans don't see).

---

## 8. Release Prep readiness

Items the Release Prep phase will land (no work here at plan-review time, but listing them so they are accounted for):

- [x] `package.json` minor version bump (one minor revision for a substantive UX-system change). — planned at Task 10.1.
- [x] `CHANGELOG.md` entry with the channel vocabulary summary + the list of retrofit surfaces. — planned at Task 10.2.
- [x] `docs/REPO_MAP.md` entries for `src/utils/asyncUI.js`, `src/utils/skeletons.js`, `docs/design/loading.md`. — planned at Task 10.5.
- [x] `docs/design/loading.md` (new file — the design reference). The full text is written **in implementation**, not here; the plan reserves the file name and the topic. — planned at Task 09.1.
- [x] README is updated **only if** it currently has a UX-conventions section; otherwise skipped (and the skip is documented). — planned at Task 10.3.
- [x] `docs/deployment.md` is **not** updated — no env vars, no runtime modes added. — planned at Task 10.4 (skip verification).

---

## 9. Out-of-scope cross-check

Items that MUST NOT appear in `tasks.md`:

- [x] Backend / server-side changes — none present in tasks.md.
- [x] New env vars — none present.
- [x] AbortController wiring for parse flows — explicitly deferred (research § 3.5).
- [x] Optimistic UI work — explicitly deferred (research § 4 / spec § Out of scope).
- [x] Global progress bar — explicitly non-goal.
- [x] Service worker / offline mode — explicitly non-goal.
- [x] Minimum-display-time hold — explicitly non-goal (confirmed at Q3).
- [x] New visual designs / animation styles — none added; FR-006 enforced.
- [x] Auth-form rewrites — none; FR-023 preserves existing behaviour.
- [x] `shared/constants.js` changes — none present.
- [x] Persistence-layer changes (SQLite, Supabase, demoStore data shape) — none present.

---

## 10. Sign-off

Reviewer name: `A`
Date: `2026-05-27`

- [x] All items above checked or explicitly waived (with reason).
- [x] FR-008 resolution (§ 4) accepted **or** spec amended.
- [x] OK to begin Phase 01 implementation. *(Original wording read "OK to run `/speckit.tasks`" — out of order for this feature since tasks.md already exists. Semantically updated to reflect the actual next step.)*

If any item is unchecked, list the blockers below and resolve them before generating tasks:

```
(no blockers — signed off A · 2026-05-27)
```

Phase 01 implementation note (2026-05-27): `npm.cmd run test:run`, `npm.cmd run lint`, and `npm.cmd run build` passed. The build command required local placeholder values for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_AUTH_EMAIL_REDIRECT_URL` because production builds enforce hosted frontend env vars. Vite dev server startup reached `http://127.0.0.1:5173/`, but the sandbox could not keep a persistent browser/manual session alive (`Start-Process` hit Windows `Path`/`PATH` environment casing; node_repl browser launch failed at sandbox setup), so Task 01.6's manual inline-error injection was substituted with a jsdom CSS injection check confirming `.inline-error` flex column layout, retry cursor, and `button[aria-busy="true"]` progress cursor / opacity. Residual risk: true visual/manual confirmation remains for Phase 11 browser smoke.
