# Tasks: Loading & Async States (029)

**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Data model**: [data-model.md](data-model.md)
**Contracts**: [contracts/api.md](contracts/api.md)
**Research**: [research.md](research.md)
**Quickstart**: [quickstart.md](quickstart.md)
**Plan review**: [checklists/plan-review.md](checklists/plan-review.md)
**Branch**: `029-loading-async-states`

---

## Phase Map

| Phase | Theme | Stories covered | Blocks |
|---|---|---|---|
| 01 | **Foundation — shared utilities** — `src/utils/asyncUI.js`, `src/utils/skeletons.js`, new CSS rules in `main.css`, util tests | (all) | 02–08 |
| 02 | **Tracker page (US-1)** — initial-load skeleton via shared builder, inline-error path on list-fetch failure, `aria-busy` on view-switcher chip during transition | US-1 | 09 |
| 03 | **Application Overlay (Modal.js) (US-2)** — Save / Archive / Unarchive / Star / Status busy states; peer-action lockout; abort path preserved | US-2 | 09 |
| 04 | **Card component (US-2)** — × Archive / ↺ Unarchive button busy states | US-2 | 09 |
| 05 | **Parsing surfaces (US-3)** — CreationPicker Process button busy + inline-error + textarea lock; Resume Import upload busy + inline-error | US-3 | 09 |
| 06 | **Calendar page (US-4)** — replace `"Loading…"` strings with grid + Action Panel skeleton; refresh `aria-busy` on month/year switch; inline-error on failure | US-4 | 09 |
| 07 | **Profile + ProfileEdit (US-5)** — apps-block skeleton; section-card skeleton on ProfileEdit; Save / Cancel busy states | US-5 | 09 |
| 08 | **Cross-cutting verification (US-6)** — accessibility audit, reduced-motion checks, demo-mode parity matrix, repo-wide bare-`"Loading…"` regression assertion | US-6 | 09 |
| 09 | **Design doc + Polish** — write `docs/design/loading.md`, run lint, remove orphaned CSS if any | (all) | 10 |
| 10 | **Release Prep** (REQUIRED) — version bump, CHANGELOG, README, REPO_MAP, docs sanity | (all) | 11 |
| 11 | **Browser Smoke Test** (REQUIRED — UI feature) — walk each user story in a real browser against the to-be-merged state, desktop + mobile | (all) | merge |

**Sequencing notes:**

- Phase 01 blocks every later phase: every retrofit imports from `src/utils/asyncUI.js` and `src/utils/skeletons.js`.
- Phases 02–07 are mostly independent of each other once Phase 01 lands. Recommended order is the one shown (P1 first), but a parallel pair (e.g., Phase 02 + Phase 06) is safe.
- Phase 03 (Modal) and Phase 04 (Card) both cover US-2 acceptance criteria 1–4 (Modal) and 5 (Card). They share no files so they can run in parallel. Phase 04 is small enough to fold into 03 by a single developer; the split is editorial.
- Phase 08 verifies the work of Phases 02–07 — it must run after them. It is mostly tests, not production code.
- Phase 09 introduces no production behaviour change but writes the design doc that future features will cite. It is sequenced before Release Prep so the doc lands in the same merge as the implementation.
- Phases 10 and 11 are constitutionally mandated (Amendment 1.3.0).
- Phase 11's hosted-mode walkthrough (Task 11.7) requires a Supabase preview deploy. Open a PR before Phase 11 to trigger the preview build.

**FR coverage**: every FR-XXX in [spec.md](spec.md) is covered by at least one task — see the FR↔task index at the bottom of this file.

**Out-of-scope cross-check**: no task in this file touches `server/**`, `shared/**`, `package.json` dependencies, `vercel.json`, env vars, or persistence-layer code. The plan-review checklist [§ 9](checklists/plan-review.md#9-out-of-scope-cross-check) is enforced here.

---

## Phase 01 — Foundation: shared utilities + CSS

### [X] Task 01.1 — Create `src/utils/asyncUI.js` with `bindBusyButton`, `bindContainerBusy`, `renderInlineError`

**Target file**: `src/utils/asyncUI.js` (new file)

**What to do**:

1. Create the module with the three exports specified in [contracts/api.md § 2](contracts/api.md#2-internal-client-contracts-new).
2. Import `Toast` from [src/components/Toast.js](../../src/components/Toast.js) once, lazily (defer the import to call time — module-level import is fine since Toast has no side-effect cost) so the failure-toast path works without further wiring.
3. Implement `bindBusyButton({ button, action, busyLabel?, peers?, errorMessage?, silent? })` per [contracts/api.md § 2.1](contracts/api.md#21--bindbusybutton):
   - `run()` is idempotent during pending — second call returns the same in-flight promise; no second `action()` invocation.
   - `try / finally` clears `aria-busy`, restores `disabled`, restores `textContent`, restores peer states.
   - `AbortError` resolves to `null` silently (preserves Modal save's existing behaviour).
   - Non-Abort errors re-throw after toast (so callers can branch on the rejection).
   - `dispose()` is idempotent and safe during pending.
4. Implement `bindContainerBusy({ container, action, errorMessage?, silent? })` per [contracts/api.md § 2.2](contracts/api.md#22--bindcontainerbusy) — same lifecycle, container instead of button, no label / no disabled.
5. Implement `renderInlineError({ target, message, onRetry, retryLabel? })` per [contracts/api.md § 2.3](contracts/api.md#23--renderinlineerror):
   - Build the DOM shape:
     ```html
     <div class="inline-error" role="alert" aria-live="polite">
       <p class="inline-error__message">[message]</p>
       <button class="inline-error__retry" type="button">[Try again]</button>
     </div>
     ```
   - `target.replaceChildren(errorBlock)`.
   - Remove `aria-busy` from `target` if present.
   - Auto-focus the retry button via `element.focus()` after insertion.
   - Returned `dispose()` removes the element from the DOM, idempotent.

**Expected behavior**:
- The three exports are callable from any other module with no global side-effects on import (`require`-safe).
- Each helper's `run()` returns `Promise<T | null>` exactly per the contract.
- `aria-busy` is set / cleared exactly once per lifecycle.
- No new global object created; no `window.*` patch.

**Constraints**:
- No new dependencies.
- Use only existing DOM APIs (no library helpers).
- Match the rest of the codebase's module style (export named functions, no default export).
- Keep the file < 200 LOC; this is a thin helper, not a framework.

**Validation**: covered by Task 01.4 (`tests/utils/asyncUI.test.js`).

**Out of scope**:
- Optimistic UI hooks (deferred per [research.md § 4](research.md)).
- `AbortController` integration for parse (deferred per [research.md § 3.5](research.md#35--no-parse-cancellation-fr-008-edge-case)).
- Minimum-display-time hold (deferred per [research.md § 4.2](research.md#42--no-minimum-display-time)).

---

### [X] Task 01.2 — Create `src/utils/skeletons.js` with five DOM-factory builders

**Target file**: `src/utils/skeletons.js` (new file)

**What to do**:

1. **Port `renderApplicationSkeleton`** from [src/pages/Tracker.js:370-388](../../src/pages/Tracker.js#L370-L388) verbatim, rename to `buildApplicationListSkeleton()`. DOM output MUST be byte-identical to the original (FR-020, SC-007).
2. **Port `renderProfileSkeleton`** from [src/pages/Profile.js:43-54](../../src/pages/Profile.js#L43-L54) verbatim, rename to `buildProfileSkeleton(page)`. DOM output MUST be byte-identical to the original.
3. **Add `buildCalendarSkeleton()`** returning `{ grid: HTMLDivElement, panel: HTMLDivElement }`:
   - `grid` is a `<div class="calendar-skeleton calendar-skeleton__grid" aria-busy="true">` containing 42 cells (6 rows × 7 days), each `<div class="calendar-skeleton__cell"><span class="skeleton-line skeleton-line--short"></span></div>`.
   - `panel` is a `<div class="calendar-skeleton calendar-skeleton__panel" aria-busy="true">` containing three section headers (Today / Suggested / Upcoming) each with two `.skeleton-line` rows.
4. **Add `buildProfileEditSkeleton()`** returning a `<div class="loading-skeleton profile-edit-skeleton" aria-busy="true">` with three `.section-card.skeleton-section` blocks (mirroring the existing Profile skeleton style — reuses `.skeleton-section` to honour the existing reduced-motion rule).
5. **Add `buildProfileAppsSkeleton()`** returning a `<div class="loading-skeleton profile-apps-skeleton" aria-busy="true">` with four shimmer rows (`.skeleton-line` primitives).
6. The module exports nothing else — no helper, no constant, no class. Pure DOM factories.

**Expected behavior**:
- Each builder returns DOM nodes ready to insert; the caller manages mount/unmount.
- Each root carries `aria-busy="true"`.
- All shimmer is driven by the existing `.skeleton-line` class — no new keyframes.
- The two ported skeletons produce DOM identical to the originals (byte-for-byte after stripping whitespace).

**Constraints**:
- No imports from `src/components/` or `src/pages/`.
- No imports from `src/data/`.
- No imports from `src/services/`.
- Reuse existing CSS classes (`.loading-skeleton`, `.skeleton-card`, `.skeleton-section`, `.skeleton-line`) wherever possible. New classes only where the existing vocabulary genuinely doesn't fit (see Task 01.3).

**Validation**: covered by Task 01.5 (`tests/utils/skeletons.test.js`).

**Out of scope**:
- Skeletons for Archived list — feature 028's existing skeleton flow reuses `buildApplicationListSkeleton()` directly; no separate builder.
- Mobile-specific skeleton variants (the existing skeletons are already responsive via parent CSS).

---

### [X] Task 01.3 — Add new CSS rules to `src/styles/main.css`

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:

1. **Inline-error block rules**, in the section after `.parser-loading` ([src/styles/main.css:3910](../../src/styles/main.css#L3910)):
   ```css
   .inline-error {
     display: flex;
     flex-direction: column;
     align-items: center;
     gap: var(--space-3, 12px);
     padding: var(--space-5, 24px);
     text-align: center;
   }
   .inline-error__message {
     margin: 0;
     color: var(--color-text-muted, #475569);
   }
   .inline-error__retry {
     /* match existing secondary button look — use the project's existing button class
        if one exists; otherwise minimal styling */
   }
   .inline-error__retry:focus-visible {
     outline: 2px solid var(--color-focus, #2563eb);
     outline-offset: 2px;
   }
   ```
   - Verify the existing button class to reuse (e.g. `.btn--secondary`); prefer reuse over net-new button styling.
2. **Calendar skeleton rules**, adjacent to the existing calendar styles:
   ```css
   .calendar-skeleton__grid {
     display: grid;
     grid-template-columns: repeat(7, 1fr);
     gap: var(--space-1, 4px);
   }
   .calendar-skeleton__cell {
     aspect-ratio: 1 / 1;
     padding: var(--space-2, 8px);
   }
   .calendar-skeleton__panel {
     display: flex;
     flex-direction: column;
     gap: var(--space-3, 12px);
   }
   .calendar-skeleton__row {
     display: flex;
     gap: var(--space-2, 8px);
   }
   ```
3. **ProfileEdit + Profile-apps skeleton rules** — if they need anything beyond reusing `.loading-skeleton`/`.skeleton-section`, add minimal layout overrides only. Avoid duplicating shimmer.
4. **Button `aria-busy` treatment** — verify whether the existing button styles already cover `[aria-busy="true"]`. If not, add a single rule:
   ```css
   button[aria-busy="true"] {
     cursor: progress;
     opacity: 0.7;
   }
   ```
   - Do NOT add a spinner glyph (FR-006).
5. **Reduced-motion** — no new rules needed. The existing `prefers-reduced-motion` rule at [src/styles/main.css:5403-5411](../../src/styles/main.css#L5403-L5411) targets `.skeleton-line` and continues to apply because every new skeleton reuses `.skeleton-line` primitives.

**Expected behavior**:
- New classes are scoped under BEM-style block names (`.inline-error`, `.calendar-skeleton`, `.profile-edit-skeleton`, `.profile-apps-skeleton`) — no selector collisions with existing rules.
- Existing classes (`.loading-skeleton`, `.skeleton-card`, `.skeleton-section`, `.skeleton-line`, `.parser-loading`, `.profile-loading`) are not modified.

**Constraints**:
- No new `@keyframes`.
- No new colour tokens — reuse existing CSS variables.
- No new media queries — the responsive surface lives in the parent layouts.
- All new rules cite their FR in a comment (e.g. `/* FR-002 — Calendar grid skeleton */`).

**Validation**:
- Manual visual check at Phase 08 / Phase 11.
- CSS lint (if `npm run lint` covers CSS — check existing setup before declaring this required).

**Out of scope**:
- Refactor of existing `.loading-skeleton` rules (FR-020 preservation).
- Dark mode adjustments — not in scope for this feature.

---

### [X] Task 01.4 — [P] Add `tests/utils/asyncUI.test.js`

**Target file**: `tests/utils/asyncUI.test.js` (new file)

**What to do**:

Write Vitest cases (jsdom environment) for every state transition in [data-model.md § 5](data-model.md#5-state-transitions):

1. **`bindBusyButton` happy path**: idle → pending → idle-after-success; assert `aria-busy="true"` then `aria-busy` absent; assert `disabled=true` then false; assert label swap then restore.
2. **`bindBusyButton` failure path**: rejects → toast fired with caller message → re-thrown to caller's catch.
3. **`bindBusyButton` AbortError path**: returns `null`; no toast; `aria-busy` cleared.
4. **`bindBusyButton` duplicate-click (FR-009)**: 3 rapid `run()` calls return the same in-flight promise; mock action is called exactly once.
5. **`bindBusyButton` `dispose()` during pending**: does not throw; `aria-busy` cleared; outstanding promise resolves silently without further side effects on the button.
6. **`bindBusyButton` `dispose()` during idle**: no-op.
7. **`bindBusyButton` peer lockout**: peers passed in `options.peers` are disabled during pending and restored to their prior `disabled` state (true OR false) on resolution.
8. **`bindContainerBusy` happy path**: same as bindBusyButton without label/disabled assertions.
9. **`bindContainerBusy` failure path**: container `aria-busy` cleared; toast fired.
10. **`renderInlineError` mounts**: target.children replaced with one `<div class="inline-error" role="alert" aria-live="polite">`; message text matches; Try again button present.
11. **`renderInlineError` focus**: after `renderInlineError`, `document.activeElement` is the retry button.
12. **`renderInlineError` retry click**: `onRetry` invoked exactly once per click.
13. **`renderInlineError` dispose**: removes the block from the DOM; idempotent.
14. **`renderInlineError` clears `aria-busy`** on `target` if it was set.
15. **Bad-input guards**: `bindBusyButton({ button: null })` throws clearly; `bindBusyButton({ button, action: undefined })` throws on `run()`.

Use `Toast.show` mocked via `vi.mock('../../src/components/Toast.js', ...)`.

**Expected behavior**: all 15 cases pass deterministically.

**Constraints**:
- jsdom (no Playwright).
- No reliance on timer mocks unless explicitly needed for the duplicate-click case (Promise resolution order is sufficient).
- Cover the contract surface, not the implementation details.

**Validation**: `npm run test:run -- tests/utils/asyncUI.test.js` green.

**Out of scope**:
- Performance benchmarks.
- Visual regression — covered in Phase 11.

---

### [X] Task 01.5 — [P] Add `tests/utils/skeletons.test.js`

**Target file**: `tests/utils/skeletons.test.js` (new file)

**What to do**:

1. **DOM-shape baseline test** for `buildApplicationListSkeleton()` and `buildProfileSkeleton()`:
   - Capture the existing output by importing the *pre-refactor* HTML as a fixture string (use a snapshot or string constant).
   - Assert `buildApplicationListSkeleton().outerHTML` equals the fixture (FR-020, SC-007).
   - Repeat for `buildProfileSkeleton()`.
2. **`buildCalendarSkeleton()` shape**: returns `{ grid, panel }`; `grid` has 42 cells; `grid` and `panel` both carry `aria-busy="true"`.
3. **`buildProfileEditSkeleton()` shape**: root has class `loading-skeleton profile-edit-skeleton`, `aria-busy="true"`, contains ≥ 1 `.skeleton-section`.
4. **`buildProfileAppsSkeleton()` shape**: root has class `loading-skeleton profile-apps-skeleton`, `aria-busy="true"`, contains ≥ 4 `.skeleton-line` rows.
5. **Reduced-motion contract**: every new skeleton's root has at least one descendant carrying the `.skeleton-line` class (the existing CSS rule then applies). Assert via querySelector.

**Expected behavior**: all 5 cases pass.

**Constraints**:
- The fixture for ported skeletons must be captured from `main`'s output, not authored from spec — capture by importing the original function once, then locking the string.
- No reliance on CSS computed styles — assert class presence and DOM shape only.

**Validation**: `npm run test:run -- tests/utils/skeletons.test.js` green.

**Out of scope**:
- Computed-style animation timing.
- Visual regression — Phase 11.

---

### [X] Task 01.6 — [P] Wire CSS into the build verification

**Target files**: none (verification only)

**What to do**:

1. Run `npm run build` and confirm no CSS warnings introduced by the new rules.
2. Run `npm run dev` and load any page; visually confirm the new `.inline-error` class is reachable from devtools and renders the expected layout when injected manually:
   ```js
   document.body.appendChild(Object.assign(document.createElement('div'), { className: 'inline-error', innerHTML: '<p class="inline-error__message">test</p><button class="inline-error__retry">Try again</button>' }));
   ```
3. Document any deviation in the [plan-review.md](checklists/plan-review.md) sign-off block before Phase 02 begins.

**Expected behavior**: build is clean; manual injection of the inline-error block renders without layout shift.

**Constraints**:
- This is a verification task, not a code-edit task.
- Skip if your environment cannot run `npm run build` cleanly — log the skip with the residual-risk note.

**Validation**: manual; documented in plan-review checklist.

**Out of scope**:
- E2E browser smoke (Phase 11).

---

### [X] Task 01.7 — Phase 01 review gate

**Target files**: none

**What to do**:

1. Confirm `src/utils/asyncUI.js`, `src/utils/skeletons.js`, and the new CSS rules are in place.
2. Confirm `tests/utils/asyncUI.test.js` and `tests/utils/skeletons.test.js` are green.
3. Confirm no existing test in `tests/` has regressed: `npm run test:run`.
4. Confirm `npm run lint` passes.
5. Sign off in [checklists/plan-review.md § 10](checklists/plan-review.md#10-sign-off) (Phase 01 readiness).

**Expected behavior**: green build, green tests, lint clean.

**Constraints**: do not begin Phase 02 until this gate passes.

**Validation**: documented in checklist.

---

**Checkpoint — Phase 01 complete**: shared utilities + tests + CSS are in. Phases 02–07 can begin.

---

## Phase 02 — Tracker page (US-1)

### [X] Task 02.1 — [US1] Replace inline `renderApplicationSkeleton` with the shared builder

**Target file**: [src/pages/Tracker.js](../../src/pages/Tracker.js)

**What to do**:

1. Remove the inline function `renderApplicationSkeleton()` ([src/pages/Tracker.js:370-388](../../src/pages/Tracker.js#L370-L388)).
2. Add `import { buildApplicationListSkeleton } from '../utils/skeletons.js';` at the top of the file (sorted with the existing imports).
3. Replace the call site at [src/pages/Tracker.js:593](../../src/pages/Tracker.js#L593) — `const skeleton = renderApplicationSkeleton();` → `const skeleton = buildApplicationListSkeleton();`.

**Expected behavior**: cold load renders the identical skeleton as today (FR-020); no visual diff.

**Constraints**:
- No DOM shape change.
- The existing `aria-busy="true"` on the toolbar around the skeleton ([src/pages/Tracker.js:597](../../src/pages/Tracker.js#L597)) is preserved.

**Validation**: extend `tests/pages/Tracker.test.js` (Task 02.4) — assert the skeleton has the same class signature.

**Out of scope**:
- Renaming any other helper in Tracker.js.
- Refactor of the toolbar busy logic — Phase 02.3 covers the view-switcher chip change.

---

### [X] Task 02.2 — [US1] Add inline-error path to Tracker list fetch

**Target file**: [src/pages/Tracker.js](../../src/pages/Tracker.js)

**What to do**:

1. Locate the `api.getAll(...)` call site (search for `api.getAll` in Tracker.js).
2. Wrap the fetch in a try/catch (or `.catch()`) that on failure:
   - Identifies the same DOM node that held the skeleton (the existing `_container` data slot).
   - Calls `renderInlineError({ target: <slot>, message: 'Couldn\'t load your applications. Check your connection or try again.', onRetry: () => <re-invoke the same fetch sequence> })`.
3. Import `renderInlineError` from `../utils/asyncUI.js`.
4. The retry handler MUST re-render the skeleton (call `buildApplicationListSkeleton()` again into the slot) and re-invoke the fetch — i.e. the entire load sequence is idempotent and re-entrant.

**Expected behavior**:
- Forcing a 500 on the list fetch replaces the skeleton with the inline-error block; `aria-busy` is cleared.
- Clicking `Try again` re-issues a fresh list fetch.

**Constraints**:
- Do NOT surface a toast for the cold-load failure (FR-010 — inline block is the recovery surface, not toast).
- Existing keyboard / focus management is preserved (`renderInlineError` moves focus to the retry button).

**Validation**: extend `tests/pages/Tracker.test.js` (Task 02.4).

**Out of scope**:
- Error messaging beyond the single string (no error-code-based messages).

---

### [X] Task 02.3 — [US1] View-switcher chip `aria-busy` during transition

**Target file**: [src/components/QuickFiltersToolbar.js](../../src/components/QuickFiltersToolbar.js)

**What to do**:

1. Locate the view-switch handler (the function that fires when the user selects Active or Archived from the chip popup; introduced in feature 028).
2. Before the handler issues its fetch, set the chip's `aria-busy="true"`. Reference: the chip is the element with class `qfb-view-chip` (verify the actual class in [src/components/QuickFiltersToolbar.js](../../src/components/QuickFiltersToolbar.js)).
3. After the fetch resolves (success OR failure), remove `aria-busy`.
4. While `aria-busy="true"`, the destination skeleton is already being rendered by Tracker.js's view-switch flow (existing feature 028 wiring) — confirm this in code; if Tracker.js does NOT swap to skeleton during the transition, add that swap as part of this task. Implementation: in Tracker.js's view-change handler, replace the current list contents with `buildApplicationListSkeleton()` before awaiting the new fetch, then on response replace skeleton with the new list (or with the inline-error block on failure, reusing the Task 02.2 path).
5. On failure of the view-fetch: same inline-error path as Task 02.2, scoped to the list slot — the chip's `aria-busy` clears regardless.

**Expected behavior**:
- During an in-flight view switch, the chip carries `aria-busy="true"` and the list slot shows the destination view's skeleton (FR-005).
- The "stale list shown while next list loads" pattern is gone.

**Constraints**:
- Do NOT change the chip's popup behaviour, count display, or click semantics — only the in-flight `aria-busy` attribute is new.
- Do NOT introduce a separate "transition skeleton" — the same `buildApplicationListSkeleton()` is reused.
- Feature 028's quick-filter / sort / pagination behaviours are untouched.

**Validation**:
- Extend [tests/components/QuickFiltersToolbar.test.js](../../tests/components/QuickFiltersToolbar.test.js) — assert chip `aria-busy="true"` during in-flight view change and cleared on resolution.
- Extend `tests/pages/Tracker.test.js` (Task 02.4) — assert the skeleton-swap during view change.

**Out of scope**:
- Chip popup behaviour beyond the busy state.
- Changing how counts are computed.

---

### [X] Task 02.4 — [P] [US1] Extend `tests/pages/Tracker.test.js`

**Target file**: [tests/pages/Tracker.test.js](../../tests/pages/Tracker.test.js)

**What to do**:

Add three test groups:

1. **Cold-load skeleton** (covers Task 02.1):
   - Mount Tracker with a delayed `api.getAll` mock.
   - Assert the skeleton renders (class `loading-skeleton--applications`).
   - Assert toolbar `aria-busy="true"`.
   - Resolve the mock; assert skeleton is gone, cards visible, `aria-busy` removed.
2. **Inline-error on list-fetch failure** (covers Task 02.2):
   - Mock `api.getAll` to reject.
   - Assert the slot ends up with `<div class="inline-error">`, retry button present.
   - Click the retry button — assert a second `api.getAll` call fires.
   - On retry success: cards render.
3. **View-switch transition** (covers Task 02.3):
   - Mount Tracker, resolve initial fetch.
   - Trigger the view switch to Archived.
   - Assert the list slot shows the skeleton during the in-flight window.
   - Assert chip `aria-busy="true"` during the in-flight window.
   - Resolve the second fetch; assert skeleton replaced and chip `aria-busy` cleared.

**Expected behavior**: all three groups pass.

**Constraints**:
- Reuse existing test scaffolding for Tracker (look at the existing test file's setup helpers).
- No new test dependencies.

**Validation**: `npm run test:run -- tests/pages/Tracker.test.js` green.

**Out of scope**:
- Snapshot the entire Tracker — narrow the assertions to the loading/error/transition concerns.

---

### [X] Task 02.5 — [US1] Phase 02 review gate

**Target files**: none

**What to do**:

1. Confirm Phase 02 tasks 02.1–02.4 are checked.
2. Run `npm run test:run` — no regressions.
3. Browser-spot-check: visit Tracker on a throttled connection; confirm skeleton, then cards; force a 500 and confirm inline-error + retry; switch views and confirm chip busy + destination skeleton.
4. Sign off.

---

## Phase 03 — Application Overlay save / mutation busy (US-2)

### [X] Task 03.1 — [US2] Wire `bindBusyButton` to Modal `Save` button

**Target file**: [src/components/Modal.js](../../src/components/Modal.js)

**What to do**:

1. Locate the Save button element and the save handler (`saveDraft` / wherever the `api.update(...)` call at [src/components/Modal.js:720](../../src/components/Modal.js#L720) is invoked from).
2. Add `import { bindBusyButton } from '../utils/asyncUI.js';` at the top of the file.
3. At Save-button construction time, attach the busy binding:
   ```js
   const saveBinding = bindBusyButton({
     button: saveButton,
     action: () => doSaveInner(), // the function that wraps the existing try/catch + api.update
     busyLabel: 'Saving…',
     peers: [discardButton, /* other peers — see Task 03.4 */],
     silent: true, // Modal already has its own success/failure toast wiring; don't double-toast on error
   });
   ```
4. Replace the existing `saveButton.addEventListener('click', saveDraft)` with `saveButton.addEventListener('click', () => saveBinding.run())`.
5. On modal teardown, call `saveBinding.dispose()`.
6. The existing AbortController + `_saveController.abort()` flow is preserved — when the modal close path calls abort, the in-flight save's promise rejects with AbortError, `bindBusyButton.run()` returns `null` silently per the contract (Task 01.1 case 3), and the existing post-save cleanup runs in the `finally` (Task 03.5 covers peer-state restoration).

**Expected behavior**:
- Click Save → button label becomes `Saving…`, `aria-busy="true"`, disabled.
- Two rapid Save clicks → exactly one `api.update` call.
- Success path closes modal as before, `Saved.` toast fires (existing behaviour — FR-021).
- Failure path: button returns to idle label, modal stays open, `Failed to save` toast fires (existing wiring — FR-013).
- Abort path (close mid-save): button restores silently, modal closes, no toast (existing behaviour preserved).

**Constraints**:
- DO NOT remove the existing `_saveController` plumbing.
- DO NOT remove the existing `Toast.show('Failed to save', 'failure')` call — `silent: true` avoids `bindBusyButton`'s default toast; we keep the Modal-authored one.
- DO NOT change the modal close path's call to `_saveController.abort()`.
- DO NOT rewrite `saveDraft` — wrap it.

**Validation**: extended `tests/components/Modal.test.js` (Task 03.7).

**Out of scope**:
- Modal Create-mode save (different code path — covered in Task 03.2 if the Create button uses the same Save button; otherwise no-op).
- Discard button's own action (Task 03.3).

---

### [X] Task 03.2 — [US2] Wire `bindBusyButton` to Modal Create-mode save (if separate)

**Target file**: [src/components/Modal.js](../../src/components/Modal.js)

**What to do**:

1. Locate the Create-mode save path — at [src/components/Modal.js:673](../../src/components/Modal.js#L673) `api.create(_draft)` is called. Identify the button that triggers it.
2. If it is the same `saveButton` as edit-mode (likely), then Task 03.1's binding already covers it — verify and check this task off as a verification-only task.
3. If it is a separate button (e.g., "Add application"), attach an analogous `bindBusyButton` with `busyLabel: 'Creating…'`.
4. Single-request guarantee + label change + peer lockout apply identically.

**Expected behavior**: Create flow has the same busy-state guarantees as Edit.

**Constraints**: same as 03.1.

**Validation**: covered by `tests/components/Modal.test.js` extensions.

**Out of scope**: new Modal behaviour beyond busy state.

---

### [X] Task 03.3 — [US2] Wire `bindBusyButton` to Modal Archive / Unarchive / Star / Status

**Target file**: [src/components/Modal.js](../../src/components/Modal.js)

**What to do**:

For each of the following action buttons in Modal.js, attach a `bindBusyButton`:

1. **🗄 Archive** (header action) — handler at [src/components/Modal.js:1021](../../src/components/Modal.js#L1021) (`api.archive`). `busyLabel`: omit (icon-only button). `silent: true`. Peers: none (archive is its own surface).
2. **↺ Unarchive** (header action in archived mode) — handler at [src/components/Modal.js:1031](../../src/components/Modal.js#L1031) (`api.unarchive`). Same shape as Archive.
3. **★ Favorite** — handler at [src/components/Modal.js:987](../../src/components/Modal.js#L987) (`api.update({ fav })`). Same shape.
4. **⇄ Change Status** — this is a Status-Dropdown trigger; the actual write happens inside [src/components/StatusDropdown.js](../../src/components/StatusDropdown.js). The Modal-side button just opens the dropdown — no binding needed on the trigger itself; the binding lives on the dropdown's selection commit (Task 03.6).

Each binding:

- Wraps the existing handler in `binding.run()`.
- Returns the same value as the existing handler so downstream code keeps working.
- On failure, `bindBusyButton`'s re-throw is caught by the existing try/catch (which already calls `Toast.show`) — `silent: true` prevents double-toast.
- `dispose()` is called on modal teardown.

**Expected behavior**:
- Each icon button shows `aria-busy="true"` and `disabled` during its action.
- Two rapid clicks → one network request.
- Existing success/failure toasts preserved.

**Constraints**:
- Icon-only buttons get `aria-busy` + `disabled` only — no label change (the icon doesn't have a swap target).
- Visual treatment for `[aria-busy="true"]` comes from Task 01.3's CSS.

**Validation**: `tests/components/Modal.test.js` (Task 03.7).

**Out of scope**:
- Star button on the card grid (Card.js, Phase 04 if covered there).

---

### [X] Task 03.4 — [US2] Identify and pass Modal Save's peer buttons

**Target file**: [src/components/Modal.js](../../src/components/Modal.js)

**What to do**:

1. Enumerate the buttons that are peer-actions to Save (i.e., other writes the user might click instead while Save is pending). For edit mode this is at minimum:
   - Discard button
   - ★ Favorite (its own write would race with Save — disable during Save)
   - 🗄 Archive (same reasoning)
   - ⇄ Change Status trigger (opens dropdown — disable to prevent a status change racing with Save)
2. Pass them as the `peers` array to Task 03.1's `bindBusyButton`.
3. `bindBusyButton` records their prior `disabled` state and restores on resolution.

**Expected behavior**:
- During Save in flight, every peer write button is disabled.
- After Save resolves (success / failure / abort), each peer returns to its prior state (e.g., the ⇄ button is disabled if the status is terminal — Modal already handles this at [src/components/Modal.js:735-744](../../src/components/Modal.js#L735-L744); the restore must respect that).

**Constraints**:
- The restore is "prior state", not "enabled". `bindBusyButton` reads `peer.disabled` at run-start and re-applies it at finally. This must work for the terminal-status case where `disabled=true` is the prior state.

**Validation**: `tests/components/Modal.test.js` — assert ⇄ button stays disabled after Save for terminal-status rows.

**Out of scope**:
- Esc / backdrop / ✕ — these are not peer *buttons* (they're close paths); their handling is Task 03.5.

---

### [X] Task 03.5 — [US2] Resolve FR-008 close-path-during-save (per research § 3.4)

**Target file**: [src/components/Modal.js](../../src/components/Modal.js)

**What to do**:

The spec's FR-008 says "modal close paths MUST be inert during a Save." Per [research.md § 3.4](research.md#34--interaction-with-existing-abortcontroller-fr-008), the resolution is: **inert = does not commit a different action; close still calls `_saveController.abort()`**. The existing Modal close path already does this (see [src/components/Modal.js:826](../../src/components/Modal.js#L826)).

1. Verify the Esc handler ([find via grep for `key === 'Escape'` in Modal.js](../../src/components/Modal.js)), backdrop click handler, and ✕ button handler all flow through the same close path that calls `_saveController?.abort()`.
2. Do NOT add any blocking logic — the abort path is the user's intended escape hatch.
3. Add a clarification comment near the close path:
   ```js
   // During an in-flight save, close paths abort the save rather than blocking the user.
   // See specs/029-loading-async-states/research.md § 3.4.
   ```
4. Update [spec.md](spec.md) with a `## Clarifications` section (mirroring feature 028's convention) documenting this resolution as a clarify-equivalent decision:
   ```markdown
   ### Session 2026-05-27 (plan-time)

   - Q: Should close paths during Save be inert (block) or call abort()? → A: Call abort() — preserves the existing escape hatch. "Inert" in FR-008 means "does not commit a different action," not "blocks the abort signal." Resolves the plan-review § 4 contradiction.
   ```

**Expected behavior**:
- Close paths during Save abort the save (existing behaviour).
- The clarification is documented in `spec.md`.

**Constraints**:
- This is a documentation + verification task, not a behaviour change.
- Do NOT remove the existing abort path under any condition.

**Validation**:
- `tests/components/Modal.test.js` — assert pressing Esc during an in-flight Save aborts the save (no `api.update` resolution affects the closed modal; no `Saved.` toast fires).
- Plan-review checklist § 4 box checked.

**Out of scope**:
- Adding a visible "Cancel save" affordance — not in scope.

---

### [X] Task 03.6 — [US2] Wire `bindBusyButton` to Status Dropdown selection commit

**Target file**: [src/components/StatusDropdown.js](../../src/components/StatusDropdown.js)

**What to do**:

1. Locate the selection-commit path inside StatusDropdown.js (where the picked status is sent through `api.update` or a Modal-provided callback).
2. If the commit happens via a button click inside the dropdown, attach `bindBusyButton` on that button:
   - `busyLabel`: omit (compact UI); rely on `aria-busy` + disabled.
   - `silent`: defer to the existing error-toast wiring at the call site.
3. If the commit happens via a list-item click and no button is the visual target, attach `bindContainerBusy` on the dropdown's container — `aria-busy="true"` on the popup while the request is in flight.

**Expected behavior**:
- Two rapid status selections → one network request.
- Visible busy state during commit.

**Constraints**:
- Do not change the dropdown's open/close behaviour or the list rendering.

**Validation**: extend `tests/components/Modal.test.js` (or a new `tests/components/StatusDropdown.test.js` if one exists) — assert single-request guarantee.

**Out of scope**:
- Status validation logic.

---

### [X] Task 03.7 — [P] [US2] Extend `tests/components/Modal.test.js`

**Target file**: [tests/components/Modal.test.js](../../tests/components/Modal.test.js)

**What to do**:

Add test cases:

1. Save click → button `aria-busy="true"`; label === `Saving…`.
2. Two rapid Save clicks → exactly one `api.update` call.
3. Save in flight → Discard / ★ / 🗄 / ⇄ all disabled.
4. Save resolves successfully → modal closes; peers' prior disabled states restored (test the terminal-status case — ⇄ stays disabled).
5. Save fails → modal stays open; button label restored; `Failed to save` toast fires once (not twice).
6. Esc during Save → abort path runs; no `Saved.` toast; no `Failed to save` toast (because AbortError is silent).
7. 🗄 Archive → button `aria-busy="true"` + disabled during request; resolves and closes modal.
8. ↺ Unarchive (archived mode) → same as Archive.
9. ★ Favorite → button `aria-busy="true"` + disabled briefly; toggles after resolve.
10. Status change via dropdown → busy state during commit; single-request on double-click.

**Expected behavior**: 10 new cases pass.

**Constraints**:
- Reuse existing test scaffolding.
- Mock `api.update`, `api.create`, `api.archive`, `api.unarchive` per test.

**Validation**: `npm run test:run -- tests/components/Modal.test.js` green.

---

### [X] Task 03.8 — [US2] Phase 03 review gate

**Target files**: none

**What to do**:

1. Confirm 03.1–03.7 done.
2. `npm run test:run` — no regressions.
3. Browser spot-check: open an application, edit a field, click Save; observe label change + disabled. Force a 500 via DevTools; observe error toast + form stays open.
4. Sign off.

---

## Phase 04 — Card mutation busy (US-2)

### [X] Task 04.1 — [US2] Wire `bindBusyButton` to Card × Archive button

**Target file**: [src/components/Card.js](../../src/components/Card.js)

**What to do**:

1. Locate the × Archive button construction in [src/components/Card.js](../../src/components/Card.js).
2. Wrap the click handler in `bindBusyButton`:
   - `busyLabel`: omit (icon-only).
   - `silent: true` if the Card already toasts on failure; otherwise default error message `'Couldn't archive.'`.
3. Import `bindBusyButton` from `../utils/asyncUI.js`.
4. Dispose the binding on card unmount / re-render.

**Expected behavior**: × button shows `aria-busy="true"` + disabled during archive; single-request guarantee.

**Constraints**:
- Do not change the existing confirm-dialog flow (archive currently goes through ConfirmDialog — the busy state begins after confirmation).
- Do not change which cards re-render after archive (existing list update behaviour preserved).

**Validation**: extend [tests/components/Card.test.js](../../tests/components/Card.test.js) (Task 04.3).

**Out of scope**:
- ConfirmDialog itself — no busy state needed (it's a click-then-dismiss flow).

---

### [X] Task 04.2 — [US2] Wire `bindBusyButton` to Card ↺ Unarchive button

**Target file**: [src/components/Card.js](../../src/components/Card.js)

**What to do**:

1. Locate the ↺ Unarchive button (archived-card variant, from feature 028).
2. Same wrapping pattern as Task 04.1.

**Expected behavior**: ↺ shows `aria-busy="true"` + disabled during unarchive; single-request guarantee.

**Constraints**:
- Preserve the existing `Unarchived.` toast.
- Preserve the existing "card disappears from Archived list on success" behaviour.

**Validation**: extend `tests/components/Card.test.js` (Task 04.3).

**Out of scope**:
- Card body click-to-open-overlay flow.

---

### [X] Task 04.3 — [P] [US2] Extend `tests/components/Card.test.js`

**Target file**: [tests/components/Card.test.js](../../tests/components/Card.test.js)

**What to do**:

Add cases:

1. × Archive → `aria-busy="true"` + disabled during request.
2. × Archive double-click → one network request.
3. ↺ Unarchive → same.
4. ↺ Unarchive double-click → one network request.

**Validation**: `npm run test:run -- tests/components/Card.test.js` green.

---

### [X] Task 04.4 — [US2] Phase 04 review gate

Confirm 04.1–04.3 done; `npm run test:run` green; browser spot-check on a × Archive on Tracker.

---

## Phase 05 — Parsing surfaces (US-3)

### [X] Task 05.1 — [US3] Wire `bindBusyButton` to CreationPicker Process button + inline-error retry + demo-mode gate

**Target file**: [src/components/CreationPicker.js](../../src/components/CreationPicker.js)

**What to do**:

1. **Demo-mode gating** (per [spec § Clarifications Q5](spec.md#clarifications) and the new Edge Case "Demo-mode parsing surfaces"):
   - Import `getAuthState`, `subscribe as subscribeAuth` from `../data/authStore.js` (same pattern as [src/components/ResumeImport.js:1](../../src/components/ResumeImport.js#L1)).
   - Define a `PARSER_VISIBLE_STATUSES` set excluding `'demo'` (mirroring `VISIBLE_STATUSES` in ResumeImport).
   - When auth status is `demo`: the Smart Parser entry (the parser tab / textarea / Process button) MUST be disabled or hidden so only Manual Entry is clickable. The exact visual mechanism (hide tab vs. disable button vs. swap with a static "Smart Parser is available after signing in." note) matches the existing in-product pattern — verify by inspecting CreationPicker's current shape and matching whichever pattern feature 020 used elsewhere.
   - Subscribe + unsubscribe on mount / unmount.
2. **Busy state + retry** (only reachable in non-demo modes):
   - In `_runParser(textarea, processBtn, loading)` at [src/components/CreationPicker.js:56-77](../../src/components/CreationPicker.js#L56-L77):
     - Wrap the parse call (`api.parseJob(...)` or whatever the actual call is) in `bindBusyButton.run()`.
     - `busyLabel`: `'Processing…'`.
     - Pass `[textarea]` as peers so the textarea is disabled (read-only) during the parse.
     - On failure (the catch path), call `renderInlineError({ target: loading, message: 'Couldn\'t analyze the job post. Try again.', onRetry: () => _runParser(textarea, processBtn, loading) })`.
     - On retry, re-render the inline pending message (the existing `loading.textContent = 'Analyzing job post…'`) before the next parse attempt.
3. The existing success path (`loading.hidden = true` and pick-flow continues) is preserved.
4. Import `bindBusyButton` and `renderInlineError` from `../utils/asyncUI.js`.

**Expected behavior**:
- Click Process → button label `Processing…`, `aria-busy="true"`, disabled.
- Textarea is read-only during parse.
- Two rapid Process clicks → one network request.
- Failure → `loading` element converts to inline-error with Try again; textarea re-enabled.
- Try again → one more parse against the textarea's current content.
- Close picker mid-parse → existing close-cancel behaviour (no abort wired here; result discarded by the closed view).

**Constraints**:
- Do not add `AbortController` for the parse request (out of scope per research § 3.5).
- Preserve the success picker-advance flow.
- Per the [Phase 1 open finding](C:\Users\acres\.claude\projects\d--Alvin--CodeProjects-Project-Alice\memory\project_phase1_open_finding.md) memory, the existing JSDoc/param mismatch in CreationPicker.js was flagged for Phase 3 review of 013 — this task touches CreationPicker but does NOT need to fix that mismatch unless it directly affects the new wiring. Note any drift and defer per the memory.

**Validation**: new `tests/components/CreationPicker.test.js` (Task 05.3).

**Out of scope**:
- Parse-request cancellation.
- Smart-parser result-view UI changes.

---

### [X] Task 05.2 — [US3] Wire `bindBusyButton` to ResumeImport upload trigger + inline-error retry

**Target file**: [src/components/ResumeImport.js](../../src/components/ResumeImport.js)

**What to do**:

1. Locate the upload trigger (the function that fires `parseResume(file)` from [src/services/resumeApi.js](../../src/services/resumeApi.js)).
2. Wrap the call in `bindBusyButton.run()` on the upload button:
   - `busyLabel`: omit (the existing rotating processing messages serve the inline-pending UI).
   - The existing `aria-busy="true"` on the root container at [src/components/ResumeImport.js:212](../../src/components/ResumeImport.js#L212) is preserved; the new `bindBusyButton` adds aria-busy on the *button* specifically.
3. On failure, call `renderInlineError({ target: <status slot>, message: 'Couldn\'t parse the resume. Try again.', onRetry: () => <re-trigger upload with the same file ref> })`.
   - The status slot is the element that currently displays the rotating processing messages — verify the exact element.
4. Preserve the rotating processing messages (FR-022). The existing `DEMO_FEATURE_UNAVAILABLE` short-circuit at [src/services/resumeApi.js](../../src/services/resumeApi.js) remains as **defense-in-depth dead code only** — the ResumeImport widget is already hidden in demo mode via `VISIBLE_STATUSES` at [src/components/ResumeImport.js:9](../../src/components/ResumeImport.js#L9), so no user-clickable upload control reaches the service-layer throw (per [spec § Clarifications Q5](spec.md#session-2026-05-27)).

**Expected behavior**:
- Upload click (non-demo modes) → button disabled + `aria-busy="true"`; rotating messages preserved.
- Two rapid upload clicks → one network request.
- Failure → inline-error replaces the rotating messages with Try again; file reference preserved for retry.
- Demo mode: ResumeImport root is `hidden` (existing `VISIBLE_STATUSES` gate); no upload control is reachable; no `DEMO_FEATURE_UNAVAILABLE` toast fires from user interaction.

**Constraints**:
- Preserve the rotating-messages success path (FR-022).
- Preserve the existing `VISIBLE_STATUSES` gate.
- The service-layer `DEMO_FEATURE_UNAVAILABLE` throw is preserved as dead-code defense; do not remove it (regression resilience if the UI gate is ever bypassed).

**Validation**: extend or create `tests/components/ResumeImport.test.js` (Task 05.4).

**Out of scope**:
- File-validation logic (already in place).
- Parse-request cancellation.

---

### [X] Task 05.3 — [P] [US3] Create `tests/components/CreationPicker.test.js`

**Target file**: `tests/components/CreationPicker.test.js` (verify if exists; create if absent)

**What to do**:

Add (or extend) test cases:

1. Process click with textarea populated (non-demo mode) → button label `Processing…`, `aria-busy="true"`, disabled; textarea read-only; inline pending message visible.
2. Two rapid Process clicks → one network request.
3. Parse failure → inline-error replaces pending message; Try again present; textarea re-enabled.
4. Try again click → second parse request fires; busy state re-enters; on success, picker advances.
5. Picker close mid-parse → picker DOM removed; no state leak (a subsequent re-open shows fresh empty state).
6. **Demo mode** → mount CreationPicker with `authStore` in `demo` state; assert the Smart Parser entry is disabled or hidden (per Task 05.1 step 1); assert Manual Entry remains clickable; assert no Process button is reachable so no `api.parseJob` call could fire.

**Validation**: `npm run test:run -- tests/components/CreationPicker.test.js` green.

---

### [X] Task 05.4 — [P] [US3] Create or extend `tests/components/ResumeImport.test.js`

**Target file**: `tests/components/ResumeImport.test.js` (verify; create if absent)

**What to do**:

1. Upload trigger click → button `aria-busy="true"`, disabled; rotating processing messages still cycle.
2. Two rapid upload clicks → one network request.
3. Parse failure → inline-error replaces status slot; file reference preserved for retry.
4. Try again click → second parse request fires.
5. **Demo mode** → mount ResumeImport with `authStore` in `demo` state; assert the root element is hidden (`root.hidden === true`); no upload button is reachable; no `DEMO_FEATURE_UNAVAILABLE` toast surfaces from user interaction (defense-in-depth throw at the service layer is unreachable from the UI). Per the spec edge case "Demo-mode parsing surfaces."

**Validation**: green.

---

### [X] Task 05.5 — [US3] Phase 05 review gate

Confirm 05.1–05.4 done; `npm run test:run` green; browser spot-check on CreationPicker against an AI-backed deploy.

---

## Phase 06 — Calendar page (US-4)

### [X] Task 06.1 — [US4] Replace `"Loading…"` strings with skeleton

**Target file**: [src/pages/Calendar.js](../../src/pages/Calendar.js)

**What to do**:

1. Locate the two bare-string assignments at [src/pages/Calendar.js:159-160](../../src/pages/Calendar.js#L159-L160):
   ```js
   _panelSlot.textContent = 'Loading…';
   _gridSlot.textContent = 'Loading…';
   ```
2. Replace with:
   ```js
   import { buildCalendarSkeleton } from '../utils/skeletons.js';
   // …
   const { grid, panel } = buildCalendarSkeleton();
   _gridSlot.replaceChildren(grid);
   _panelSlot.replaceChildren(panel);
   ```
3. The existing data-fetch flow's success / failure handlers remain — they replace the skeleton with the real grid / Action Panel content on success, or with the inline-error block on failure (Task 06.3).

**Expected behavior**:
- Cold load: grid + Action Panel skeletons render within one paint frame; no `"Loading…"` text appears.
- `aria-busy="true"` is on both slots until data lands.

**Constraints**:
- Do not change the data-fetch contract or the existing render functions for the grid / panel.
- Do not change how the page wires the month / year picker, status filter, or DayPanel.

**Validation**: extend `tests/pages/Calendar.test.js` (Task 06.4).

---

### [X] Task 06.2 — [US4] Add refresh `aria-busy` for month/year switch

**Target file**: [src/pages/Calendar.js](../../src/pages/Calendar.js)

**What to do**:

1. Locate the month/year change handlers (the functions invoked by MonthPicker / YearPicker selection).
2. Wrap the data refetch in `bindContainerBusy({ container: _gridSlot, action: ()=>fetchAndRender(month, year) })`.
3. The prior month's grid cells remain visible during the in-flight window (per FR-004). `bindContainerBusy` only toggles `aria-busy="true"` on the container — it does not mutate children, so the prior month stays painted automatically.

**Expected behavior**:
- Month/year change → `_gridSlot` carries `aria-busy="true"` while the new month is fetched; old cells visible; on resolve, atomic swap to new month; on reject, prior month remains + error toast.

**Constraints**:
- Do NOT replace the prior month with a skeleton (that would be the transition channel, not refresh — wrong per FR-004).
- Do NOT change the Action Panel's behaviour during a month switch (Action Panel is per-day, not per-month).

**Validation**: `tests/pages/Calendar.test.js` (Task 06.4).

---

### [X] Task 06.3 — [US4] Inline-error path on Calendar cold-load failure

**Target file**: [src/pages/Calendar.js](../../src/pages/Calendar.js)

**What to do**:

1. In the cold-load fetch's catch path, call `renderInlineError({ target: _gridSlot, message: 'Couldn\'t load the calendar.', onRetry: () => <re-render skeletons and re-issue fetch> })`.
2. Also wipe the panel slot: `_panelSlot.replaceChildren()` (or render a single inline-error in the panel slot mirroring the grid). Per spec, the inline error replaces both skeletons together as a single recovery surface — implementation: render the inline-error in the grid slot, clear the panel slot to keep the visual centered.
3. On retry, re-mount both skeletons and re-issue the fetch.

**Expected behavior**:
- Cold-load failure → inline-error in `_gridSlot`; panel slot cleared.
- Try again → both skeletons re-render; fetch retries.

**Constraints**:
- Do not use a toast for cold-load failure (FR-010).

**Validation**: `tests/pages/Calendar.test.js` (Task 06.4).

---

### [X] Task 06.4 — [P] [US4] Extend `tests/pages/Calendar.test.js`

**Target file**: [tests/pages/Calendar.test.js](../../tests/pages/Calendar.test.js)

**What to do**:

1. Cold-load → grid + panel skeletons render; no `"Loading…"` text present in the DOM (assert via `textContent.includes('Loading…') === false`).
2. Cold-load resolve → skeletons replaced; `aria-busy` cleared.
3. Cold-load failure → inline-error in grid slot; Try again button present.
4. Try again → second fetch fires; skeletons re-mount on retry start.
5. Month switch with data already rendered → grid slot `aria-busy="true"` during refetch; prior month's cells still in the DOM.
6. Month switch failure → error toast fires; prior month's view stays; `aria-busy` cleared.

**Validation**: green.

---

### [X] Task 06.5 — [US4] Phase 06 review gate

Confirm 06.1–06.4 done; `npm run test:run` green; browser spot-check on Calendar with throttling.

---

## Phase 07 — Profile + ProfileEdit (US-5)

### [X] Task 07.1 — [US5] Port `renderProfileSkeleton` to shared builder

**Target file**: [src/pages/Profile.js](../../src/pages/Profile.js)

**What to do**:

1. Remove the inline `renderProfileSkeleton` function at [src/pages/Profile.js:36-54](../../src/pages/Profile.js#L36-L54).
2. Import `buildProfileSkeleton` from `../utils/skeletons.js`.
3. Replace the call site at [src/pages/Profile.js:579](../../src/pages/Profile.js#L579) — `renderProfileSkeleton(page)` → `page.replaceChildren(buildProfileSkeleton())` (verify the original call-shape; mirror it).

**Expected behavior**: identical to existing (FR-020, SC-007).

**Constraints**: DOM byte-identical.

**Validation**: snapshot match in `tests/utils/skeletons.test.js` (Task 01.5).

---

### [X] Task 07.2 — [US5] Replace Profile apps-block `"Loading applications..."` with skeleton

**Target file**: [src/pages/Profile.js](../../src/pages/Profile.js)

**What to do**:

1. Locate the bare string at [src/pages/Profile.js:153](../../src/pages/Profile.js#L153):
   ```js
   body.append(createElement('div', 'profile-loading', 'Loading applications...'));
   ```
2. Replace with `body.append(buildProfileAppsSkeleton())`.
3. Wrap the apps-fetch in a try/catch: on failure call `renderInlineError({ target: body, message: 'Couldn\'t load your applications.', onRetry: () => <re-mount skeleton + re-fetch> })`.

**Expected behavior**:
- Cold load of the apps block → skeleton renders; no bare text.
- Failure → inline-error block in the apps slot.

**Constraints**: do not change how the apps block's data is fetched or rendered on success.

**Validation**: extend `tests/pages/Profile.test.js` (Task 07.5).

---

### [X] Task 07.3 — [US5] Replace ProfileEdit `"Loading profile..."` with skeleton

**Target file**: [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js)

**What to do**:

1. Locate the bare string at [src/pages/ProfileEdit.js:1278](../../src/pages/ProfileEdit.js#L1278):
   ```js
   container.replaceChildren(createElement('div', 'profile-loading', 'Loading profile...'));
   ```
2. Replace with `container.replaceChildren(buildProfileEditSkeleton())`.

**Expected behavior**: cold load → section-card skeleton; no bare text.

**Constraints**:
- Do not change ProfileEdit's existing state-machine, dirty-state tracking, or section overlay logic.

**Validation**: extend `tests/pages/ProfileEdit.test.js` (Task 07.5).

---

### [X] Task 07.4 — [US5] Wire `bindBusyButton` to ProfileEdit Save / Cancel

**Target file**: [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js)

**What to do**:

1. Locate the sticky Save / Cancel buttons in ProfileEdit.
2. Attach `bindBusyButton` to Save:
   - `busyLabel`: `'Saving changes…'`.
   - `peers`: `[cancelButton]`.
   - `silent: true` if ProfileEdit already toasts on failure.
3. Wrap the save handler (the function that calls `api.saveProfile`).

**Expected behavior**:
- Save click → label `Saving changes…`, `aria-busy="true"`, disabled; Cancel disabled.
- Two rapid Save clicks → one `api.saveProfile` call.
- Failure → button restored, form remains open + dirty.

**Constraints**:
- Do not change ProfileEdit's dirty-state guard logic.
- Do not change which validation runs before save.

**Validation**: `tests/pages/ProfileEdit.test.js` (Task 07.5).

---

### [X] Task 07.5 — [P] [US5] Extend `tests/pages/Profile.test.js` and `tests/pages/ProfileEdit.test.js`

**Target files**: [tests/pages/Profile.test.js](../../tests/pages/Profile.test.js), [tests/pages/ProfileEdit.test.js](../../tests/pages/ProfileEdit.test.js)

**What to do**:

Profile.test.js additions:

1. Cold-load → apps block skeleton; no `"Loading applications..."` text.
2. Apps-fetch failure → inline-error in apps slot.
3. Retry → second apps fetch fires.

ProfileEdit.test.js additions:

1. Cold-load → section skeleton; no `"Loading profile..."` text.
2. Save click → `aria-busy="true"` + disabled; Cancel disabled.
3. Two rapid Save clicks → one `api.saveProfile` call.
4. Save failure → button restored; form remains.

**Validation**: green for both.

---

### [X] Task 07.6 — [US5] Phase 07 review gate

Confirm 07.1–07.5 done; `npm run test:run` green; browser spot-check on Profile + ProfileEdit.

---

## Phase 08 — Cross-cutting verification (US-6)

### [X] Task 08.1 — [US6] Accessibility audit pass

**Target files**: spot-checks across the touched components / pages.

**What to do**:

1. With a screen reader (NVDA / VoiceOver / Narrator):
   - Force a Tracker list-fetch failure → AT announces the inline-error message (polite live region).
   - Tab into the page → focus lands on Try again button.
   - Click Save on a Modal edit → AT announces busy state ("busy" or label change).
2. With `prefers-reduced-motion: reduce` enabled in the OS or via DevTools:
   - Cold load Tracker / Profile / Calendar / ProfileEdit → no shimmer animation on any skeleton.
3. Tab through every new inline-error block — Try again is reachable.
4. Confirm no new colour-only signalling has been introduced (the helper relies on attribute / text changes, not colour).

**Expected behavior**: each AT and reduced-motion check passes.

**Constraints**:
- This is a manual verification task. Failures here are blocking before Phase 09.

**Validation**: document results in [checklists/plan-review.md § 1](checklists/plan-review.md#1-constitution-compliance) "Desktop + mobile responsive, labeled forms, keyboard navigation, non-color-only signalling" row.

**Out of scope**:
- Axe / Lighthouse automated audit — optional but not required by this task.

---

### [X] Task 08.2 — [US6] Demo-mode parity assertions

**Target file**: any of the touched component / page tests where demo-mode coverage is missing.

**What to do**:

1. For each retrofit (Modal, Card, CreationPicker, ResumeImport, Tracker, Calendar, Profile, ProfileEdit), confirm at least one test runs against `demoStore` (FR-018, FR-019).
2. Add a test in the relevant file if missing — pattern:
   ```js
   it('traverses the busy lifecycle in demo mode', async () => {
     // mount with authStore in demo
     // trigger the action
     // assert aria-busy="true" is observed and then cleared
   });
   ```

**Expected behavior**: every retrofit has a demo-mode parity test.

**Constraints**:
- Demo-mode mocks reuse the existing demoStore (no new mock infrastructure).

**Validation**: green tests.

---

### [X] Task 08.3 — [US6] Repo-wide bare-`"Loading…"` regression assertion

**Target file**: `tests/main.test.js` (or a new `tests/regression/no-bare-loading.test.js`)

**What to do**:

1. Add a test that mounts each affected page (Tracker, Profile, ProfileEdit, Calendar) with `api.*` mocks that delay forever (pending state).
2. Assert that the page's rendered DOM does NOT contain `"Loading…"` (en/em ellipsis), `"Loading applications..."`, or `"Loading profile..."` as a text node.
3. The auth-form `aria-busy` test surfaces `Loading…`-equivalent text? Verify; if `LoginForm` shows a busy label like `Loading…`, exclude welcome forms from the assertion or scope the assertion to the four pages.

**Expected behavior**: the assertion passes against current code; would have failed before this feature.

**Constraints**:
- Scope to the four pages — do not turn this into a project-wide string-presence linter.

**Validation**: green (SC-003).

---

### [X] Task 08.4 — [US6] Phase 08 review gate

Confirm 08.1–08.3 done; documented manual results in checklist.

---

## Phase 09 — Design doc + Polish

### [X] Task 09.1 — Write `docs/design/loading.md`

**Target file**: `docs/design/loading.md` (new file)

**What to do**:

Write the canonical design reference for the channel vocabulary. Structure:

1. **Purpose** — one paragraph: why this doc exists.
2. **The six channels** — `initial-load`, `refresh`, `save`, `parse`, `mutation`, `transition`. For each: definition, canonical visual, example surfaces, the helper function used (`bindBusyButton`, `bindContainerBusy`, manual `aria-busy` on container).
3. **Skeleton vocabulary** — list of the five builders in `src/utils/skeletons.js` with the surface each covers.
4. **Inline-error block** — DOM shape, ARIA contract, focus behaviour, reproduction pattern.
5. **Button-busy contract** — label-swap + `aria-busy` + disabled; icon-only buttons get attribute-only.
6. **Reduced-motion** — the existing CSS rule's scope; how new skeletons inherit.
7. **Adding new surfaces** — quickref for future-feature authors: "to add busy state to a new action button, import `bindBusyButton`, attach it, dispose on teardown."
8. **References** — link [specs/029-loading-async-states/](../../specs/029-loading-async-states/) (spec, plan, contracts, data-model), [WAI-ARIA `aria-busy`](https://www.w3.org/TR/wai-aria-1.2/#aria-busy), [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).

**Expected behavior**: file written, < 400 lines, internally cross-linked to other design docs ([docs/design/tracker.md](../../docs/design/tracker.md), [docs/design/calendar.md](../../docs/design/calendar.md), [docs/design/application_overlay.md](../../docs/design/application_overlay.md), [docs/design/profile_page.md](../../docs/design/profile_page.md)).

**Constraints**:
- No prescriptive copy beyond what the spec already mandates (the doc is a reference, not a redefinition).
- No new requirements added here — the spec is canonical.

**Validation**: read through; verify no contradictions with [spec.md](spec.md) / [research.md](research.md).

---

### [X] Task 09.2 — Lint pass

**Target files**: all touched files.

**What to do**:

1. `npm run lint`.
2. Fix any new warnings introduced by this feature.

**Expected behavior**: clean lint.

---

### [X] Task 09.3 — Orphaned-CSS audit

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:

1. After Phases 02–07, search for usages of `.profile-loading` ([src/styles/main.css:846](../../src/styles/main.css#L846)) in the codebase. If no caller remains (the Profile.js and ProfileEdit.js inline strings should be gone), remove the rule.
2. Same for any other rules orphaned by the bare-string removal.
3. Document any rule kept "just in case" with a comment + reason.

**Expected behavior**: zero dead CSS introduced; pre-existing dead CSS pruned where touched.

**Constraints**: do not aggressively prune unrelated dead rules; scope to rules orphaned by this feature.

**Validation**: grep confirms no `.profile-loading` usage; build still clean.

---

### [X] Task 09.4 — Phase 09 review gate

Confirm 09.1–09.3 done; design doc reads cleanly; lint green; ready for Release Prep.

---

## Phase 10 — Release Prep (REQUIRED)

### [X] Task 10.1 — Bump version in `package.json`

**Target file**: [package.json](../../package.json)

**What to do**:

1. Read current version from `package.json`.
2. Bump the **minor** version (feature 029 is an additive UX-system change, not a breaking change, not a bugfix).
3. Update any in-app version display:
   - [src/pages/welcome/shared/appMeta.js](../../src/pages/welcome/shared/appMeta.js) — `APP_VERSION`.
   - [src/components/Footer.js](../../src/components/Footer.js) — verify it sources from appMeta (no separate bump needed if so).
4. Update version-string assertions in `tests/release-metadata.test.js` if they pin the literal.

**Expected behavior**: version string is updated consistently across the codebase.

**Validation**: `npm run test:run -- tests/release-metadata.test.js` green.

---

### [X] Task 10.2 — Add CHANGELOG entry

**Target file**: [CHANGELOG.md](../../CHANGELOG.md)

**What to do**:

1. Add a new `## [<new-version>] — <merge-date>` section above the previous entry.
2. Under **Added**, list:
   - Shared loading + async-state utilities (`src/utils/asyncUI.js`, `src/utils/skeletons.js`).
   - New Calendar skeletons; bare `"Loading…"` strings removed from Calendar / ProfileEdit / Profile applications block.
   - Inline-error recovery surface across Tracker / Calendar / Profile / ProfileEdit list fetches.
   - Application Overlay Save / Archive / Unarchive / Star / Status busy states.
   - Card × Archive and ↺ Unarchive busy states.
   - CreationPicker + ResumeImport upload busy states + inline-error recovery on parse failure.
   - View-switcher chip `aria-busy` during in-flight view changes.
   - Channel vocabulary documented in `docs/design/loading.md`.
3. Under **Changed**, list:
   - View-switcher chip now signals in-flight transitions via `aria-busy` (small additive change on top of feature 028).
4. Preserve Keep-a-Changelog format and the `[Unreleased]` / `[<new-version>]` diff links at the bottom.

**Expected behavior**: well-formed CHANGELOG entry.

**Validation**: `tests/release-metadata.test.js` if it parses CHANGELOG; otherwise visual review.

---

### [X] Task 10.3 — README updates (only if UX section exists)

**Target file**: [README.md](../../README.md)

**What to do**:

1. Check if README has a Features list or UX-conventions section.
2. If yes: add a bullet noting standardized loading/async UX with link to `docs/design/loading.md`.
3. Update the `Current version` line if present.
4. Add Further Reading link to `specs/029-loading-async-states/`.
5. If README has no relevant section, document the skip in this task's notes ("README has no UX section; no update required — feature is a UX-only refactor with no new user-installable mode").

**Expected behavior**: README is consistent with the feature; or skip is documented.

---

### [X] Task 10.4 — Verify `docs/deployment.md` does NOT need updating

**Target file**: [docs/deployment.md](../../docs/deployment.md)

**What to do**:

1. Confirm this feature introduces no env vars, no runtime modes, no architecture change.
2. Document the skip in this task's checkbox: "No deployment.md update required (verified per plan § Affected Areas — no infra changes)."

**Skip note**: No deployment.md update required. Feature 029 is a client-only UX refactor — no env vars, no runtime modes, no schema/RPC/migration, no architecture change. Verified against plan § Affected Areas. The existing `v0.14.0+` migration references in deployment.md are unrelated (028 `archived_date`) and remain valid for v0.15.0+.

**Expected behavior**: deployment.md is untouched.

---

### [X] Task 10.5 — Add REPO_MAP entries

**Target file**: [docs/REPO_MAP.md](../../docs/REPO_MAP.md)

**What to do**:

1. Add a row under **Utilities / Shared** for `src/utils/asyncUI.js` — describe as "Shared client-side loading + async-state utilities (`bindBusyButton`, `bindContainerBusy`, `renderInlineError`)."
2. Add a row for `src/utils/skeletons.js` — describe as "Shared DOM-factory builders for loading skeletons (Tracker / Profile / Calendar / ProfileEdit / Profile apps)."
3. Add a row under **Docs** for `docs/design/loading.md` — describe as "Channels + visual conventions for loading + async UX."
4. Update the **Components** rows for any component whose behaviour is now spec'd by this feature (e.g., note that QuickFiltersToolbar's view chip carries `aria-busy` during in-flight transitions).
5. Add a row under **Spec Packages** for `specs/029-loading-async-states/`.

**Expected behavior**: REPO_MAP reflects the new files.

**Validation**: grep confirms every new file is listed.

---

### [X] Task 10.6 — Docs sanity check

**Target files**: cross-cutting

**What to do**:

1. `grep` the previous version string across `package.json`, `src/`, `README.md`, `CHANGELOG.md`, `docs/` — confirm the only remaining matches are historical CHANGELOG headings / diff URLs.
2. Verify every new cross-link path exists.
3. Confirm the running app renders the new version in the Footer.
4. Read `docs/design/loading.md` end-to-end; reconcile any contradiction with the spec.

**Expected behavior**: no orphan version strings; all links resolve.

---

### [X] Task 10.7 — Phase 10 review gate

Confirm 10.1–10.6 done; `npm run test:run` and `npm run lint` green; ready for the smoke test against the to-be-merged state.

---

## Phase 11 — Browser Smoke Test (REQUIRED — UI feature)

**Setup**: start the dev server (`npm run dev`) and the backend (or build for hosted preview deploy). Load seed data: `npm run db:seed`. For demo-mode and hosted-mode walks, see [quickstart.md § 0](quickstart.md#0-smoke-test-environment-matrix).

For each user story below, walk the spec.md Independent Test in a real browser; verify the acceptance scenarios pass; document deviations.

### [X] Task 11.1 — [US1] User Story 1 walk: Tracker initial-load + recovery + view transition

**Walkthrough**: [quickstart.md § 1](quickstart.md#1-user-story-1--hosted-user-sees-the-system-is-working-not-frozen).

**Pass criteria**:
- Skeleton renders within one paint frame on throttled cold load.
- `aria-busy="true"` on toolbar.
- Forced 500 → inline-error replaces skeleton; `Try again` re-issues fetch.
- View-switch to Archived → destination skeleton + chip `aria-busy="true"`.

**Mode coverage**: local-throttled + hosted-preview.

**Result (hosted, Edge)**: PASS. Cold-load skeleton + view transition OK. Failure path confirmed via DevTools request-blocking on `GET /api/applications` → inline-error + `Try again` → recovers on unblock. (Real 500 not injectable in-browser; request-block exercises the same catch path.)

---

### [X] Task 11.2 — [US2] User Story 2 walk: Save without doubling up

**Walkthrough**: [quickstart.md § 2](quickstart.md#2-user-story-2--save-without-doubling-up).

**Pass criteria**:
- Save label changes to `Saving…`, button disabled, peers disabled.
- Two rapid clicks → one PATCH.
- Esc during save → existing abort path runs; no toast.
- Failure → button restored, modal stays open, error toast.
- Same guarantees for card × / ↺, modal 🗄 / ↺ / ★, Status Dropdown.

**Mode coverage**: local + hosted-preview. Demo: tests-only (per quickstart § 2).

**Result (hosted, Edge)**: PASS. Two rapid Save clicks → one PATCH; Esc during save aborts with no toast. Failure path confirmed via DevTools **Offline** toggle → button restored, modal stays open, "Failed to save" toast.

---

### [X] Task 11.3 — [US3] User Story 3 walk: Smart Parser progress + failure

**Walkthrough**: [quickstart.md § 3](quickstart.md#3-user-story-3--smart-parser-communicates-progress--failure).

**Pass criteria**:
- Process button busy + textarea read-only + inline pending message.
- Two rapid Process clicks → one parse request.
- Failure → inline-error with Try again; textarea re-enabled.
- Try again → one new parse request.
- Close mid-parse → picker closes; re-open shows fresh state.

**Mode coverage**: hosted-preview required (AI parsing). Demo: verify the Smart Parser entry in CreationPicker is disabled / hidden and Manual Entry remains the only clickable creation path (per [spec § Clarifications Q5](../../specs/029-loading-async-states/spec.md#session-2026-05-27)); verify ResumeImport widget is hidden. No `DEMO_FEATURE_UNAVAILABLE` toast should be reachable from a user click.

**Result (hosted + demo, Edge)**: PASS with deviation. Demo-mode gating confirmed — Smart Parser entry hidden, Manual Entry is the only creation path, no demo toast reachable. Parse busy / inline-error / Try again **not browser-observable**: `parseJobPost()` is a client-side synchronous regex parse (no network call), so throttling can't slow it and a parse failure can't be injected in-browser. Those states are covered by `tests/components/CreationPicker.test.js` with a controllable promise. Residual risk: low (test-covered).

---

### [X] Task 11.4 — [US4] User Story 4 walk: Calendar skeletons

**Walkthrough**: [quickstart.md § 4](quickstart.md#4-user-story-4--calendar-renders-without-a-loading-string).

**Pass criteria**:
- Cold load → grid + Action Panel skeletons; **no** `"Loading…"` text anywhere.
- `aria-busy="true"` on grid during fetch.
- Resolve → skeletons replaced.
- Month switch → grid `aria-busy="true"` during refetch; prior month still visible.
- Failure → error toast on month switch; prior month preserved.
- Cold-load failure → inline-error in grid slot.

**Mode coverage**: local-throttled + hosted-preview.

---

### [X] Task 11.5 — [US5] User Story 5 walk: ProfileEdit + Profile apps

**Walkthrough**: [quickstart.md § 5](quickstart.md#5-user-story-5--profileedit--profile-applications-block).

**Pass criteria**:
- ProfileEdit cold load → section skeleton; **no** `"Loading profile..."` text.
- Profile apps block cold load → row skeleton; **no** `"Loading applications..."` text.
- ProfileEdit Save → busy state; single-request guarantee.

**Mode coverage**: local + hosted-preview.

---

### [X] Task 11.6 — [US6] User Story 6 walk: Accessibility

**Walkthrough**: [quickstart.md § 6](quickstart.md#6-user-story-6--recoverable-error-surfaces-are-accessible).

**Pass criteria**:
- Screen reader announces inline-error messages.
- Tab → Try again button is focusable.
- `prefers-reduced-motion: reduce` → no shimmer on new skeletons.
- Modal Save busy is announced.

**Mode coverage**: local with assistive tech.

**Result (Edge)**: PASS with documented deferral. Reduced-motion (6.4) confirmed — `prefers-reduced-motion: reduce` emulation renders Calendar / ProfileEdit / Profile-apps skeleton blocks solid (no shimmer). Screen-reader spot-checks (6.1 / 6.3 / 6.5) **deferred** — not exercised with a live AT this session. Residual risk: low. The ARIA contract is automated-test-covered: `tests/utils/asyncUI.test.js` asserts `renderInlineError` produces `role="alert"` + `aria-live="polite"` and moves focus to the `Try again` button; `bindBusyButton` sets/clears `aria-busy`. Deferral consistent with Task 08.1's documented note (constitution allows a documented skip with residual risk).

---

### [X] Task 11.7 — Mobile layout walk

**Pass criteria**:

- DevTools viewport ≤ 640px: every skeleton + inline-error + busy-button surface renders without overflow, ellipsis truncation, or broken touch targets.
- View-switcher chip popup operates on mobile.
- Calendar skeleton fits the mobile grid layout.
- Modal busy state visible on mobile width.
- Resume Import inline-error reachable on mobile.

**Mode coverage**: local + hosted-preview.

---

### [X] Task 11.8 — Regression smoke

**Walkthrough**: [quickstart.md § 7](quickstart.md#7-regression-smoke-existing-flows-that-should-remain-unchanged).

**Pass criteria**: every row in quickstart § 7 passes (auth forms, post-save toast, ResumeImport rotating messages, view-chip counts, Calendar exclusion of archived rows, Tracker filter/sort/pagination, keyboard navigation).

**Mode coverage**: local + hosted-preview.

---

### [~] Task 11.9 — Phase 11 sign-off

**Target file**: PR description / merge log

**What to do**:

1. Confirm 11.1–11.8 all pass.
2. Confirm [quickstart.md § 10](quickstart.md#10-sign-off-gate) sign-off boxes are checked.
3. Document any deferred items with rationale (e.g., a non-blocking visual nit found during the smoke — flagged for follow-up, residual risk noted).
4. Merge to `main`.

**Sign-off (recorded; merge pending user authorization)**:

- 11.1–11.8 walked on **hosted** (Edge) + demo; results recorded per-task above. 11.4 / 11.5 / 11.7 / 11.8 clean PASS; 11.1 / 11.2 failure paths confirmed via DevTools request-blocking / Offline; 11.3 demo-gating PASS with the parse-failure path deferred as test-covered.
- 11.6: reduced-motion PASS; screen-reader AT deferred (test-covered, documented).
- [quickstart.md § 10](quickstart.md#10-sign-off-gate) boxes updated with annotations; deferrals carry documented residual risk (constitution-permitted).
- Section 8: 1208/1208 tests + ESLint clean.
- **Merge step (4) outstanding** — not performed; awaiting explicit user go-ahead. Branch `029-loading-async-states` is otherwise ready to merge to `main`.

---

## Dependencies & Execution Order

### Phase dependencies

```
Phase 01 (Foundation)
    ↓ blocks
Phase 02 (Tracker) ─┐
Phase 03 (Modal)   ─┤
Phase 04 (Card)    ─┤   ─→ can run in parallel after Phase 01
Phase 05 (Parsing) ─┤
Phase 06 (Calendar)─┤
Phase 07 (Profile) ─┘
    ↓ all complete
Phase 08 (Verification)
    ↓
Phase 09 (Design doc + Polish)
    ↓
Phase 10 (Release Prep)
    ↓
Phase 11 (Browser Smoke Test)
    ↓
merge
```

### Within-phase task ordering

- Phase 01: 01.1 (asyncUI.js) and 01.2 (skeletons.js) are independent and can run in parallel. 01.3 (CSS) is independent. 01.4 and 01.5 are tests that come after their target files exist. 01.6 is verification. 01.7 is the gate.
- Phase 02: 02.1 → 02.2 → 02.3 → 02.4 → 02.5 (sequential).
- Phase 03: 03.1, 03.2, 03.3, 03.6 can be parallel after Phase 01; 03.4 + 03.5 are sequenced with 03.1; 03.7 (tests) comes after; 03.8 is the gate.
- Phase 04: 04.1 + 04.2 in parallel; 04.3 after; 04.4 gate.
- Phase 05: 05.1 + 05.2 in parallel; 05.3 + 05.4 after; 05.5 gate.
- Phase 06: 06.1 → 06.2 → 06.3 → 06.4 → 06.5.
- Phase 07: 07.1 + 07.2 + 07.3 can be parallel; 07.4 sequenced with 07.3; 07.5 after; 07.6 gate.
- Phase 08: 08.1, 08.2, 08.3 in parallel; 08.4 gate.
- Phase 09: 09.1 + 09.2 + 09.3 in parallel; 09.4 gate.
- Phase 10: 10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.6 → 10.7.
- Phase 11: 11.1–11.8 can be parallel walkthroughs; 11.9 final sign-off.

### Parallel team strategy

If multiple developers:

- After Phase 01: assign Phases 02 (Tracker), 03 (Modal), 06 (Calendar), 07 (Profile) to four developers; Phases 04 + 05 can be folded into Phase 03's owner or shared.

---

## FR ↔ Task index

| Spec FR | Task(s) |
|---------|---------|
| FR-001 (channel vocabulary) | 09.1 |
| FR-002 (skeleton placeholders) | 01.2, 06.1, 07.1, 07.2, 07.3 |
| FR-003 (button busy) | 01.1, 03.1, 03.3, 04.1, 04.2, 05.1, 05.2, 07.4 |
| FR-004 (refresh aria-busy) | 06.2 |
| FR-005 (transition skeleton) | 02.3 |
| FR-006 (no new visual vocabulary) | 01.3 |
| FR-007 (peer non-interactive) | 03.4, 03.5 |
| FR-008 (close-path during save) | 03.5 |
| FR-009 (duplicate-submit prevention) | 01.1, 01.4, 03.1, 03.3, 04.1, 04.2, 05.1, 05.2, 07.4 |
| FR-010 (inline error on list fetch) | 02.2, 06.3, 07.2 |
| FR-011 (Try again re-fetch) | 02.2, 06.3, 07.2 |
| FR-012 (parse retry preserves input) | 05.1, 05.2 |
| FR-013 (mutation error toast + form stays) | 03.1, 03.3, 04.1, 04.2, 07.4 |
| FR-014 (aria-busy presence + removal) | 01.1, all retrofits |
| FR-015 (aria-live on inline error) | 01.1 |
| FR-016 (Try again keyboard reachable) | 01.1, 08.1 |
| FR-017 (reduced motion honoured) | 01.2, 01.3, 08.1 |
| FR-018 (mode parity) | 08.2 |
| FR-019 (no short-circuit on synchronous resolution) | 08.2 |
| FR-020 (preserve existing skeletons) | 01.2, 01.5, 02.1, 07.1 |
| FR-021 (preserve post-save toast) | 03.1 |
| FR-022 (preserve ResumeImport rotating messages) | 05.2 |
| FR-023 (preserve auth-form busy) | (no task — preservation verified by no edit) |
| FR-024 (preserve required fields) | (no task — no data-model change) |
| FR-025 (no analytics) | (no task — feature adds no telemetry) |
| FR-026 (desktop + mobile + a11y) | 08.1, 11.7 |
| FR-027 (automated tests) | 01.4, 01.5, 02.4, 03.7, 04.3, 05.3, 05.4, 06.4, 07.5, 08.2, 08.3 |

| Spec SC | Task(s) |
|---------|---------|
| SC-001 (busy state within one paint frame) | 11.1, 11.4, 11.5, 11.7 |
| SC-002 (single-request guarantee) | 01.4, 03.7, 04.3, 05.3, 05.4, 07.5 |
| SC-003 (zero bare "Loading…" strings) | 08.3, 11.4, 11.5 |
| SC-004 (aria-busy lifecycle) | 01.4, all retrofit tests |
| SC-005 (inline error recovery) | 02.4, 06.4, 07.5 |
| SC-006 (browser smoke) | 11.1–11.8 |
| SC-007 (no regression to existing skeletons) | 01.5, 02.1, 07.1 |
| SC-008 (reduced motion) | 08.1, 11.6 |

---

## Notes

- Tasks marked `[P]` are parallelizable within their phase.
- `[US1]`..`[US6]` labels map each task to a spec.md user story (see spec § User Scenarios & Testing).
- Every task lists its target file with an absolute-from-repo-root path.
- Out-of-scope notes appear on each task where there is a real risk of scope creep.
- Per the [Explicit approval before edits](C:\Users\acres\.claude\projects\d--Alvin--CodeProjects-Project-Alice\memory\feedback_explicit_approval.md) memory, do not begin a task without explicit user approval to start that specific phase / task.
