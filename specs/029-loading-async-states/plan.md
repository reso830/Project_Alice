# Implementation Plan: Loading & Async States

**Branch**: `029-loading-async-states` | **Date**: 2026-05-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from [spec.md](spec.md), feature brief at [docs/features/029-loading-async-states.md](../../docs/features/029-loading-async-states.md). No new visual design doc yet — this plan introduces one at [docs/design/loading.md](../../docs/design/loading.md) as part of Phase A.

**Supporting artifacts** (per [Plan supporting artifacts](../../../../C:/Users/acres/.claude/projects/d--Alvin--CodeProjects-Project-Alice/memory/feedback_plan_artifacts.md) memory):

- [research.md](research.md) — survey of current loading surfaces, decisions, rejected alternatives
- [data-model.md](data-model.md) — client-state shapes (Loading Channel, Busy State, Inline Error Block); confirms no persistence change
- [contracts/api.md](contracts/api.md) — internal client contracts (the `asyncUI` helper signatures, skeleton-helper signatures, inline-error block shape); confirms wire-level API is unchanged
- [quickstart.md](quickstart.md) — local + demo + hosted verification walk-through
- [checklists/plan-review.md](checklists/plan-review.md) — pre-tasks gate

---

## Summary

Standardise Alice's loading + async UX. Today five different conventions are visible (skeleton on Tracker/Profile, bare "Loading…" text on Calendar/ProfileEdit/Profile-apps, `aria-busy` on auth forms, rotating processing messages on ResumeImport, inline "Analyzing job post…" on CreationPicker), and the Application Overlay's Save button has no visible busy state at all — meaning hosted users on a flaky connection can double-save.

This feature ships four things:

1. **A shared client-side utility module** `src/utils/asyncUI.js` that owns the busy-state lifecycle for action buttons (label swap, `aria-busy`, disabled, peer-action lockout) and the inline-error block (`Try again` recovery surface). One implementation, called from every action site.
2. **A shared skeleton-helper module** `src/utils/skeletons.js` that extracts the existing Tracker `renderApplicationSkeleton()` and Profile `renderProfileSkeleton()` into reusable factories, and adds `renderCalendarSkeleton()`, `renderProfileEditSkeleton()`, `renderProfileApplicationsSkeleton()`.
3. **Retrofit of inconsistent surfaces** to use those helpers: Calendar grid + Action Panel, ProfileEdit, Profile-apps block, Smart Parser (failure path), Application Overlay Save / Archive / Unarchive / Status / Star, Tracker card Archive / Unarchive, view-switcher chip in-flight signalling.
4. **A new design doc** `docs/design/loading.md` that names the six channels (`initial-load`, `refresh`, `save`, `parse`, `mutation`, `transition`), pins each to its canonical visual, and is the reference future features cite.

No backend, no DB, no API change. Wire-level contracts are unchanged. The only new module surface is internal-client. The Application Overlay's existing `AbortController` plumbing ([src/components/Modal.js:35](../../src/components/Modal.js#L35), [src/components/Modal.js:718-721](../../src/components/Modal.js#L718-L721), [src/components/Modal.js:826](../../src/components/Modal.js#L826)) is preserved as-is — the new button-busy contract layers on top, it does not replace the abort path.

## Technical Context

**Language/Version**: Node 24 LTS (server, unchanged) + ES2022 modules in the browser (Vite-bundled).
**Primary Dependencies**: Vite, Vitest. **No new dependencies.**
**Storage**: Unchanged. SQLite, Supabase Postgres, in-memory demo store — all untouched by this feature.
**Testing**: Vitest. New tests live in `tests/utils/asyncUI.test.js`, `tests/utils/skeletons.test.js`, plus extensions to `tests/components/Modal.test.js`, `tests/pages/Tracker.test.js`, `tests/pages/Calendar.test.js`, `tests/pages/Profile.test.js`, `tests/pages/ProfileEdit.test.js`, `tests/components/QuickFiltersToolbar.test.js`, `tests/components/Card.test.js`, `tests/components/CreationPicker.test.js` (new), `tests/components/ResumeImport.test.js` (new — if absent).
**Target Platform**: Modern desktop + mobile browsers (Chromium / Firefox / Safari + their mobile variants).
**Project Type**: Web application — Vite + Vanilla JS frontend, Express backend (unchanged), shared modules under `shared/` (unchanged), repository-pattern data layer (unchanged).
**Performance Goals**: No new perf targets. Skeleton + busy-state lifecycle adds at most a single attribute toggle per request — no measurable cost.
**Constraints**: No external network calls. No new analytics. Mobile viewport <640px must work for every new skeleton + inline-error surface. `prefers-reduced-motion` honoured by every new skeleton class.
**Scale/Scope**: Frontend-only. ~9 component touchpoints, ~5 page touchpoints, ~2 new utility modules, ~1 new CSS section, ~1 new design doc. Backend is read-only context.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. User-First Application Tracking** — Application records still include required `companyName`, `jobTitle`, `status`, `lastStatusUpdate`, `responsibilities`. No field changes. Loading-state changes are UX-only.
- [x] **II. Simple, Maintainable Web Architecture** — Business logic (the request lifecycle in `api.js` / repositories) stays where it lives; the new `asyncUI.js` is a thin presentation-side state-management helper. No clever abstractions: an explicit `bindBusyButton({ button, action, label })` call per site, not a global "every button is auto-busy" magic. Validation rules are unchanged (centralised in `src/models/application.js` and `server/validation/application.js`).
- [x] **III. Data Integrity and Validation** — No data model change. The duplicate-submit guard at the UI is **additive** safety — server-side idempotency (where it exists for archive/unarchive) remains the source of truth. No silent corruption risk.
- [x] **IV. Practical User Experience** — Empty / loading / error states are made consistent across the app. This is the constitution's direct mandate ("Empty states, loading states, and error states MUST be handled clearly") being acted on.
- [x] **V. Testing and Quality Gates** — Automated tests planned for: button-busy lifecycle, duplicate-submit prevention (single-request guarantee), inline error rendering, `Try again` re-fetch, `aria-busy` set/cleared, reduced-motion honoured, mode parity (busy traversal in demo). Browser smoke test phase covers each of the six user stories in a live browser. Release Prep phase precedes the smoke test (version bump, CHANGELOG, REPO_MAP entries for the new util modules and the new design doc).
- [x] **Privacy** — No new external calls, no new telemetry. The new `asyncUI` helper logs to `console.error` only on developer-mode unhandled paths (same posture as the existing fetch wrapper).
- [x] **Accessibility** — `aria-busy` on every busy container, `aria-live` on inline error blocks, keyboard focus on `Try again`, `prefers-reduced-motion` honoured. Non-color-only signalling preserved (label text changes, not just colour swap).
- [x] **Extensibility** — The channel vocabulary is documented in `docs/design/loading.md`; future features (optimistic UI, cancellation, min-display-time) can layer on top without rewriting the helper.

**Re-check after Phase 1 design**: pending — runs as part of the [plan-review.md](checklists/plan-review.md) checklist immediately before `/speckit.tasks`.

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser (Vite-bundled ES2022)                                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Pages (call sites)                                              │   │
│  │                                                                  │   │
│  │  Tracker.js · Calendar.js · Profile.js · ProfileEdit.js          │   │
│  │  welcome/LoginForm.js · welcome/SignupForm.js (already conformant)   │
│  └─────────┬────────────────────────────────────────────────────────┘   │
│            │                                                            │
│  ┌─────────▼────────────────────────────────────────────────────────┐   │
│  │  Components (call sites)                                         │   │
│  │                                                                  │   │
│  │  Modal.js · Card.js · CreationPicker.js · ResumeImport.js        │   │
│  │  QuickFiltersToolbar.js · StatusDropdown.js                      │   │
│  └─────────┬────────────────────────────────────────────────────────┘   │
│            │                                                            │
│  ┌─────────▼─────────────────────┐    ┌──────────────────────────────┐  │
│  │  src/utils/asyncUI.js   NEW   │    │  src/utils/skeletons.js  NEW │  │
│  │                               │    │                              │  │
│  │  bindBusyButton({             │    │  buildApplicationListSkeleton() │
│  │    button, action,            │    │    (moved from Tracker.js)   │  │
│  │    busyLabel, peers? })       │    │  buildProfileSkeleton()      │  │
│  │  → returns { run, dispose }   │    │    (moved from Profile.js)   │  │
│  │                               │    │  buildCalendarSkeleton()     │  │
│  │  bindContainerBusy({          │    │  buildProfileEditSkeleton()  │  │
│  │    container, action })       │    │  buildProfileAppsSkeleton()  │  │
│  │  → returns { run, dispose }   │    │                              │  │
│  │                               │    │  All return DOM nodes with   │  │
│  │  renderInlineError({          │    │  aria-busy + skeleton-line   │  │
│  │    target, message, onRetry })│    │  classes; reduced-motion via │  │
│  │  → swaps skeleton for error;  │    │  existing CSS rule.          │  │
│  │  focuses Try again button     │    │                              │  │
│  └───────────────────────────────┘    └──────────────────────────────┘  │
│            │                                                            │
│  ┌─────────▼─────────────────────┐    ┌──────────────────────────────┐  │
│  │  src/components/Toast.js      │    │  src/styles/main.css         │  │
│  │  (existing — used by FR-013   │    │  + new classes:              │  │
│  │   mutation error toasts)      │    │    .calendar-skeleton        │  │
│  │                               │    │    .profile-edit-skeleton    │  │
│  │                               │    │    .inline-error             │  │
│  │                               │    │    .inline-error__message    │  │
│  │                               │    │    .inline-error__retry      │  │
│  │                               │    │    .btn[aria-busy=true]      │  │
│  └───────────────────────────────┘    └──────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  src/services/api.js                                             │   │
│  │  (unchanged — fetch wrapper unaffected; AbortSignal pass-through │   │
│  │   already exists for Modal save path)                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │  HTTP / demo-store in-memory
                                  ▼
                       (No server changes.)
```

### Key architectural decisions

1. **One helper module, not a framework.** `src/utils/asyncUI.js` exposes three small functions — `bindBusyButton`, `bindContainerBusy`, `renderInlineError`. Each call site explicitly invokes them. There is no "everything is reactive" wrapper, no observer pattern, no global registry. This matches the project's Vanilla JS posture. See [research.md § 3.1](research.md#31--shape-of-the-shared-helper-fr-001fr-009).
2. **Skeleton helpers as pure DOM factories.** `buildCalendarSkeleton()` returns a `<div>` tree. The caller appends + removes. No mount lifecycle, no destructor — same convention as `renderApplicationSkeleton` today. Reduces the surface area dramatically; the helper is just a builder.
3. **Inline-error block is rendered into the same slot the skeleton occupied.** No new modal, no banner. The slot is identified by a DOM node passed to `renderInlineError({ target, … })`. This keeps each surface self-contained — Tracker's error appears in the Tracker list slot, Calendar's appears in the Calendar slot. See [contracts/api.md § 2.3](contracts/api.md#23--inline-error-block).
4. **`aria-busy` is the single source of truth for "is this surface busy".** Tests assert presence/absence; CSS uses `[aria-busy="true"]` for visual treatment. No JS-side state map.
5. **Preserve the existing `AbortController` on Modal save** ([src/components/Modal.js:35-826](../../src/components/Modal.js#L35-L826)). The new button-busy contract layers on top. When the user closes the modal during a save, the controller still aborts — that path is preserved by the in-scope edits to Modal.js. See [research.md § 3.4](research.md#34--interaction-with-existing-abortcontroller-fr-008).
6. **No min-display-time hold.** A 50 ms response shows a 50 ms busy state. If flashing becomes a QA finding, the helper has a single hook (`busyMinMs?` option) that can be wired in a follow-up — but it ships unset. See [research.md § 4.2](research.md#42--no-minimum-display-time).
7. **Demo mode traverses the lifecycle synchronously.** Demo `api.update()` resolves on the next microtask; `bindBusyButton` sets `aria-busy="true"`, awaits, sets `false`. The cycle is invisible to humans but visible to tests. See [research.md § 4.5](research.md#45--demo-mode-parity).
8. **No new visual design beyond the skeleton vocabulary.** No spinner glyph, no full-screen overlay. `[aria-busy="true"]` buttons get an inline label change (`Saving…`); no extra DOM, no animation. See [research.md § 4.1](research.md#41--no-new-visual-vocabulary).

---

## Data flow

### Initial-load channel (Tracker / Calendar / Profile / ProfileEdit)

```text
1. Page mount
2. Page renders the relevant skeleton via buildXSkeleton() into the data slot
3. Slot carries aria-busy="true"
4. Page issues api.getAll() (or equivalent)
5a. Success → skeleton is replaced atomically by the real DOM tree; aria-busy removed
5b. Failure → renderInlineError({ target: slot, message, onRetry: () => goto 2 })
```

### Save channel (Application Overlay)

```text
1. User clicks Save
2. bindBusyButton's run() guards: if already pending, return the same in-flight promise (FR-009)
3. Button: label → "Saving…", aria-busy="true", disabled=true
4. Peer action disabled: Discard button (Save's only true peer — Discard has no async surface, locked to prevent user discarding while save is committing).
   Close paths (Esc / backdrop / ✕) are NOT gated — they continue to invoke _saveController.abort() (per FR-008 and the Q1 clarification). They are the user's escape hatch for a hung save.
5. _saveController (existing) is created; api.update() called with its signal
6a. Success → existing post-save toast + close (preserved)
6b. Failure (non-Abort) → button → idle label, aria-busy="false", Discard re-enabled, error toast, modal stays open
6c. Abort (user pressed Esc / clicked backdrop / clicked ✕ mid-save — preserved path) → AbortError handled silently; aria-busy cleared in finally; modal closes; no toast
```

### Mutation channel (card Archive / Unarchive / Star, Status Dropdown)

```text
1. User clicks action button (e.g. ↺ Unarchive on archived card)
2. bindBusyButton's run() guards against duplicate click
3. Button: aria-busy="true", disabled=true; label optionally changes
   (for icon-only buttons, only aria-busy + disabled — see contracts § 2.1)
4. api.unarchive() called
5a. Success → row re-renders or list re-fetches (existing behaviour preserved)
5b. Failure → button returns to idle, error toast surfaces
```

### Parse channel (CreationPicker, ResumeImport)

```text
1. User clicks Process (or selects a resume file)
2. bindBusyButton on Process; inline pending message rendered ("Analyzing job post…")
3. Textarea / file-drop disabled
4. api parser invoked
5a. Success → existing result view (preserved)
5b. Failure → inline pending message replaced by inline-error in same slot;
   Try again re-issues with same textarea content / same file ref
5c. User closes picker mid-parse → picker unmounts; pending request completes
   server-side and result is discarded (no AbortController wired here in scope —
   see [research.md § 3.5](research.md#35--no-parse-cancellation-fr-008-edge-case))
```

### Refresh channel (Calendar month/year switch)

```text
1. User clicks month/year picker
2. Calendar grid container carries aria-busy="true"; prior data stays visible
3. api request issued
4a. Success → atomic swap to new month data; aria-busy removed
4b. Failure → error toast (FR-013 path); prior month's view stays; aria-busy removed
```

### Transition channel (Tracker view-switcher chip)

```text
1. User selects "Archived" from the chip popup
2. Chip carries aria-busy="true"; list container shows destination skeleton
3. api.getAll({ view: 'archived' }) issued
4a. Success → archived cards render; chip aria-busy cleared
4b. Failure → inline-error in list slot (same as initial-load failure path)
```

---

## Affected Areas

### Files / components likely to be inspected (no edits planned)

- [src/services/api.js](../../src/services/api.js) — verify the existing fetch wrapper passes through `{ signal }` and returns rejected promises on non-2xx (per [src/services/api.js](../../src/services/api.js#L1)) so `bindBusyButton`'s `try/catch` works
- [src/components/Toast.js](../../src/components/Toast.js) — verify the existing `Toast.show(message, kind)` API; the helper calls it for FR-013 mutation errors
- [src/data/authStore.js](../../src/data/authStore.js) — verify the page-transition path on auth changes does not collide with in-flight busy states (edge case: 401 mid-save)
- [src/data/demoStore.js](../../src/data/demoStore.js) — confirm demo operations return a Promise (they do — they're `async` per [src/data/demoStore.js](../../src/data/demoStore.js#L1)) so the channel traversal works uniformly with hosted mode
- [server/](../../server) — **inspect only**; no server-side changes in scope

### Files / components likely to be modified

**New files (added):**

- `src/utils/asyncUI.js` — `bindBusyButton`, `bindContainerBusy`, `renderInlineError` (see [contracts/api.md](contracts/api.md))
- `src/utils/skeletons.js` — `buildApplicationListSkeleton`, `buildProfileSkeleton`, `buildCalendarSkeleton`, `buildProfileEditSkeleton`, `buildProfileAppsSkeleton`
- `docs/design/loading.md` — channels + visual conventions reference

**Existing files (modified):**

- [src/components/Modal.js](../../src/components/Modal.js) — wire `bindBusyButton` to Save (FR-007, FR-009), the 🗄 Archive button, the ↺ Unarchive button, the ★ Favorite button, the ⇄ Change Status path. Discard is treated as a Save **peer** (locked during in-flight Save via `bindBusyButton`'s `peers` array — not its own busy binding, since Discard has no async surface; per [spec § Q4 clarification](spec.md#session-2026-05-27)). Esc / backdrop / ✕ during a Save invoke the existing `_saveController.abort()` path — they are **not** gated as "inert" (per [spec § Q1 clarification](spec.md#session-2026-05-27) and FR-008 amended wording). The save's `aria-busy` clears in the abort branch.
- [src/components/Card.js](../../src/components/Card.js) — wire `bindBusyButton` to the card's × Archive button and ↺ Unarchive button.
- [src/components/CreationPicker.js](../../src/components/CreationPicker.js) — wire `bindBusyButton` to the Process button; replace the inline `loading` element's success/failure branching with `renderInlineError({ target: loading, ... })` on failure (preserve success branch). **Add demo-mode gating**: subscribe to `authStore`; when status is `demo`, disable the Smart Parser entry path so only Manual Entry is clickable (mirrors the existing Resume Import `VISIBLE_STATUSES` pattern). Per the [spec § Edge Cases — Demo-mode parsing surfaces](spec.md#edge-cases) clarification.
- [src/components/ResumeImport.js](../../src/components/ResumeImport.js) — wire `bindBusyButton` to the upload trigger; on failure, render inline error in the existing status slot (preserve the rotating processing-messages success path).
- [src/components/QuickFiltersToolbar.js](../../src/components/QuickFiltersToolbar.js) — set `aria-busy="true"` on the view chip during in-flight view changes (FR-005).
- [src/components/StatusDropdown.js](../../src/components/StatusDropdown.js) — wire `bindBusyButton` on the underlying selection commit.
- [src/pages/Tracker.js](../../src/pages/Tracker.js) — replace inline `renderApplicationSkeleton` with import from `src/utils/skeletons.js` (FR-020 preservation: same DOM); add inline-error path for list-fetch failure; add transition-channel skeleton swap during view switch.
- [src/pages/Calendar.js](../../src/pages/Calendar.js) — replace bare `"Loading…"` strings (lines 159-160) with `buildCalendarSkeleton()`; add `bindContainerBusy` for month/year switch refresh channel; add inline-error path on fetch failure.
- [src/pages/Profile.js](../../src/pages/Profile.js) — replace bare `"Loading applications..."` (line 153) with `buildProfileAppsSkeleton()`; preserve the existing `renderProfileSkeleton` path (extract to `skeletons.js` but keep DOM identical per FR-020).
- [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js) — replace bare `"Loading profile..."` (line 1278) with `buildProfileEditSkeleton()`; wire `bindBusyButton` to `Save changes` and `Cancel`.
- [src/styles/main.css](../../src/styles/main.css) — add `.calendar-skeleton`, `.profile-edit-skeleton`, `.profile-apps-skeleton` (or reuse `.loading-skeleton` modifier classes per FR-006), `.inline-error`, `.inline-error__message`, `.inline-error__retry`, and an action-button visual rule for `[aria-busy="true"]` (label colour adjustment if needed; no new animation).
- [docs/REPO_MAP.md](../../docs/REPO_MAP.md) — entries for the new `src/utils/asyncUI.js`, `src/utils/skeletons.js`, and `docs/design/loading.md` (Release Prep phase).
- [CHANGELOG.md](../../CHANGELOG.md) — feature entry (Release Prep phase).
- [package.json](../../package.json) — minor version bump (Release Prep phase).
- [README.md](../../README.md) — mention shared loading vocabulary if user-visible (only if the README currently has a UX section; otherwise skip per "only update README when user-facing surface changes").

### Tests likely to be added or updated

**New test files:**

- `tests/utils/asyncUI.test.js` — `bindBusyButton` lifecycle, duplicate-submit guarantee (single network call from N rapid clicks), `bindContainerBusy` lifecycle, `renderInlineError` DOM shape + focus management + `aria-live` + `Try again` click handler.
- `tests/utils/skeletons.test.js` — each builder returns the expected DOM tree, `aria-busy="true"` is set on the root, `prefers-reduced-motion` rule continues to apply (asserted via CSS-class presence, not animation timing).
- `tests/components/CreationPicker.test.js` *(new)* — Process button busy state, inline-error on parse failure, Try again re-issues exactly one request, textarea is read-only during in-flight.
- `tests/components/ResumeImport.test.js` *(new — verify if absent; some Resume tests may already exist under `tests/services` for the API layer)* — upload busy state, inline-error on parse failure, Try again with same file reference.

**Existing tests modified:**

- `tests/components/Modal.test.js` — assert Save button `aria-busy="true"` during save; Discard is disabled (Save peer); Esc / backdrop / ✕ during save **invoke `_saveController.abort()`** (modal closes silently, no `Saved.` toast, no `Failed to save` toast — preserves existing `AbortError`-silent path); single-request guarantee from two rapid Save clicks; assert non-Abort error path returns button to idle + leaves modal open.
- `tests/components/Card.test.js` — assert Archive / Unarchive button busy state; single-request guarantee.
- `tests/components/QuickFiltersToolbar.test.js` — assert view chip `aria-busy="true"` during in-flight view change.
- `tests/pages/Tracker.test.js` — assert skeleton renders on cold load, inline-error renders on failure, `Try again` re-issues fetch, transition skeleton swap on view change.
- `tests/pages/Calendar.test.js` — assert grid + Action Panel skeleton on cold load (no `"Loading…"` text); refresh-channel `aria-busy` on month switch; inline-error path on failure.
- `tests/pages/Profile.test.js` — assert applications block skeleton (no `"Loading applications..."` text); inline-error on failure.
- `tests/pages/ProfileEdit.test.js` — assert section skeleton on cold load (no `"Loading profile..."` text); Save button busy state.

### Areas explicitly out of scope (inspect-only or no-touch)

- **Server-side code** (`server/**`) — no route, validation, or repository changes. The feature is purely a frontend-UX concern.
- **`shared/`** — no schema / constants change.
- **Auth flow** — `src/data/authStore.js` and welcome forms already conform to the channel vocabulary; **no edits**. They are cited in FR-023 as the reference implementations of the auth-form busy pattern.
- **Vercel / hosted deploy configuration** — no env vars added, no `vercel.json` change, no runtime mode added. The feature deploys identically.
- **Backend latency** — no caching, no prefetch, no perf work. The feature improves perceived responsiveness only.
- **Optimistic UI** — deferred to a future feature.
- **AbortController for parse** — deferred ([research.md § 3.5](research.md#35--no-parse-cancellation-fr-008-edge-case)).
- **Global progress bar** — non-goal (spec).
- **Service worker / offline mode** — non-goal (spec).
- **Minimum-display-time hold** — non-goal for this iteration ([research.md § 4.2](research.md#42--no-minimum-display-time)).

---

## Risks and tradeoffs

### Risk: regression in the existing Tracker / Profile skeletons during the extraction

The Tracker's `renderApplicationSkeleton` ([src/pages/Tracker.js:370-388](../../src/pages/Tracker.js#L370-L388)) and Profile's `renderProfileSkeleton` ([src/pages/Profile.js:43-54](../../src/pages/Profile.js#L43-L54)) are moved into `src/utils/skeletons.js`. A naive port could produce a different DOM tree (different class order, different children count) and visibly regress the existing skeletons.

**Mitigation:** FR-020 requires byte-identical DOM for those two skeletons. The extraction is a straight cut-and-paste: the existing function bodies move; the existing call sites import the new symbol. A snapshot-style assertion (`outerHTML` equality) is added to `tests/utils/skeletons.test.js` against a fixture taken from current `main` to lock the output. SC-007 demands zero visual regression.

### Risk: Save-path regression in Modal.js

Modal.js's save path is the most code-dense path in the codebase ([src/components/Modal.js:718-760](../../src/components/Modal.js#L718-L760)) and already balances `_saveController`, the success branch, the error branch, the abort branch, and the post-save UI restoration. Adding the button-busy contract risks ordering bugs (e.g. `aria-busy` set after `await` resolves, briefly leaving the button in the success state with `aria-busy="true"`).

**Mitigation:** The button-busy state is owned by `bindBusyButton`, which wraps the existing async call. Order: `aria-busy=true` → `await action()` → success branch (existing) → `aria-busy=false` in a `finally` block. The error branch and the abort branch both go through the same `finally`, so the busy state always clears. Test in `tests/components/Modal.test.js` asserts the state machine for all three outcomes.

### Risk: `bindBusyButton` and the existing AbortController cooperating badly

If the user closes the modal mid-save: today the abort signal fires, `AbortError` is caught silently, and the modal closes. With `bindBusyButton` in the loop: the button is unmounted as part of the modal tearing down. `bindBusyButton`'s `dispose()` must be idempotent (callable from the modal's unmount even if `run()` is still in flight) so we don't leak an event listener or leave the button in a bad state if it ever re-mounts.

**Mitigation:** Contract spec'd in [contracts/api.md § 2.1](contracts/api.md#21--bindbusybutton): `dispose()` is idempotent and cancellable. Test in `tests/utils/asyncUI.test.js` asserts dispose-during-flight does not throw and does not call `Toast.show`.

### Risk: peer-action lockout (FR-008) over-locking — **RESOLVED**

**Status: resolved at `/speckit.clarify` (2026-05-27, Q1).** Originally FR-008 wording could be read as "block close paths entirely during Save," which would defeat the existing `_saveController.abort()` escape hatch at [src/components/Modal.js:826](../../src/components/Modal.js#L826).

**Resolution:** FR-008 amended to make "inert" mean "does not commit a different action." Esc / backdrop / ✕ during Save invoke `_saveController.abort()` as today — the user's escape hatch is preserved. Discard is the only Save peer that is *blocked* (it has no async surface and no abort path; locking it prevents the user discarding edits while the save is committing).

The amended FR-008 is in [spec.md § Functional Requirements](spec.md#functional-requirements); the Q1 clarification is recorded under [spec.md § Clarifications § Session 2026-05-27](spec.md#session-2026-05-27); the test plan in [tasks.md Task 03.7](tasks.md) and the data-flow steps above assert the abort path. No further action required at the plan-review gate.

### Risk: increased CSS specificity / collisions

Adding new skeleton classes to `main.css` risks colliding with existing CSS (the file is large). New rule prefixes (`.calendar-skeleton`, `.profile-edit-skeleton`, etc.) reduce this but it's not zero.

**Mitigation:** All new classes use BEM-style block names (`.inline-error`, `.inline-error__message`, `.inline-error__retry`, `.calendar-skeleton`) so they sit in their own specificity lane. Existing `.loading-skeleton` / `.skeleton-line` are reused unchanged.

### Tradeoff: shared helper vs per-page inline

Inlining busy-state code per page would be simpler short-term but multiplies the duplicate-submit risk at every call site. The shared helper trades one new file (~150 LOC) against ~15 inline implementations of the same pattern. The shared helper wins.

### Tradeoff: no min-display-time hold

A 50 ms hosted response will flash the skeleton briefly. This is intentional ([research.md § 4.2](research.md#42--no-minimum-display-time)): adding a hold complicates the helper, slows the fast path, and is not the user pain (the user pain is the *long* operations, not the short ones). If QA finds the flash distracting, a hold is a single-line addition to `bindContainerBusy` in a follow-up.

### Tradeoff: not using `requestIdleCallback` or animation frames

The helper sets `aria-busy="true"` synchronously and calls the action. It does not `requestAnimationFrame` the attribute set — meaning the busy state and the network request fire in the same frame. This is the simplest correct behaviour; the modern browser will paint the busy state on the next frame regardless.

---

## Validation approach

### Pre-implementation gate

- [plan-review.md](checklists/plan-review.md) — constitution check, naming + module-boundary review, contract-spec sanity check, test plan completeness.

### Unit tests (Vitest, jsdom)

- `tests/utils/asyncUI.test.js` — three exported functions × success / failure / dispose / duplicate-click paths.
- `tests/utils/skeletons.test.js` — five builders × DOM shape + ARIA + reduced-motion class assertions.

### Component tests (Vitest, jsdom)

- `tests/components/Modal.test.js` — Save / Archive / Unarchive / Star / Status busy state; peer-action lockout; abort path preserved.
- `tests/components/Card.test.js` — Archive / Unarchive busy state.
- `tests/components/QuickFiltersToolbar.test.js` — view chip busy state.
- `tests/components/CreationPicker.test.js` *(new)* — parse busy state, inline-error, Try again.
- `tests/components/ResumeImport.test.js` *(new / extended)* — upload busy state, inline-error, Try again.

### Page-integration tests (Vitest, jsdom)

- `tests/pages/Tracker.test.js` — cold load skeleton, inline-error, Try again, transition skeleton on view switch.
- `tests/pages/Calendar.test.js` — cold load skeleton (no bare text), refresh aria-busy on month switch, inline-error.
- `tests/pages/Profile.test.js` — applications block skeleton (no bare text), inline-error.
- `tests/pages/ProfileEdit.test.js` — section skeleton (no bare text), Save button busy.

### Cross-cutting assertions

- A repo-wide grep test (or snapshot test in `tests/main.test.js`) confirms the bare strings `"Loading…"`, `"Loading applications..."`, `"Loading profile..."` no longer appear in rendered DOM for the surfaces named in FR-002. (SC-003.)
- Demo mode parity: each affected component's test runs once against the live `api.js` mock and once against `demoStore`, asserting `aria-busy` is set + cleared in both modes.

### Manual browser smoke test (constitution-required, ordered AFTER Release Prep)

Per [quickstart.md](quickstart.md), each of the six user stories from [spec.md](spec.md) is walked in a real browser on desktop + mobile viewports, against the to-be-merged state, with the network throttled to a slow profile. The smoke test exercises: cold load + recovery, save dupe-prevention, parse recovery, Calendar skeleton, ProfileEdit skeleton, accessibility (screen reader + `prefers-reduced-motion`).

### Lint / format

`npm run lint` + existing format checks. No new tooling.

---

## Project Structure

### Documentation (this feature)

```text
specs/029-loading-async-states/
├── plan.md                         # This file
├── spec.md                         # Feature spec
├── research.md                     # Phase 0 output
├── data-model.md                   # Phase 1 output (client state, no persistence)
├── quickstart.md                   # Phase 1 output (verification walkthrough)
├── contracts/
│   └── api.md                      # Internal client contracts (helper signatures)
└── checklists/
    ├── requirements.md             # Spec quality checklist (already exists)
    └── plan-review.md              # Pre-tasks gate
```

### Source Code (repository root)

```text
src/
├── utils/
│   ├── asyncUI.js              ← NEW
│   ├── skeletons.js            ← NEW
│   └── (existing utils unchanged)
├── components/
│   ├── Modal.js                ← modified (wire bindBusyButton on action buttons)
│   ├── Card.js                 ← modified (wire bindBusyButton on Archive/Unarchive)
│   ├── CreationPicker.js       ← modified (parse busy + inline-error)
│   ├── ResumeImport.js         ← modified (upload busy + inline-error on failure)
│   ├── QuickFiltersToolbar.js  ← modified (chip aria-busy)
│   ├── StatusDropdown.js       ← modified (selection commit busy)
│   ├── Toast.js                ← unchanged (consumed by FR-013 mutation errors)
│   └── (everything else unchanged)
├── pages/
│   ├── Tracker.js              ← modified (skeleton via shared helper, inline-error)
│   ├── Calendar.js             ← modified (skeleton replaces "Loading…" text)
│   ├── Profile.js              ← modified (apps block skeleton; section skeleton ported to helper)
│   ├── ProfileEdit.js          ← modified (skeleton replaces "Loading profile…")
│   └── welcome/
│       ├── LoginForm.js        ← unchanged (already conformant)
│       └── SignupForm.js       ← unchanged (already conformant)
├── styles/
│   └── main.css                ← modified (new skeleton + inline-error rules; no new keyframes)
├── services/
│   └── api.js                  ← unchanged (existing AbortSignal pass-through preserved)
└── data/
    ├── authStore.js            ← unchanged
    └── demoStore.js            ← unchanged (already async)

server/                         ← UNCHANGED (no backend work)
shared/                         ← UNCHANGED

docs/
├── design/
│   └── loading.md              ← NEW (channels + visual conventions)
└── REPO_MAP.md                 ← modified (Release Prep — new file entries)

tests/
├── utils/
│   ├── asyncUI.test.js         ← NEW
│   └── skeletons.test.js       ← NEW
├── components/
│   ├── Modal.test.js           ← extended
│   ├── Card.test.js            ← extended
│   ├── QuickFiltersToolbar.test.js  ← extended
│   ├── CreationPicker.test.js  ← NEW (or significantly extended if any exists)
│   └── ResumeImport.test.js    ← NEW or extended
└── pages/
    ├── Tracker.test.js         ← extended
    ├── Calendar.test.js        ← extended
    ├── Profile.test.js         ← extended
    └── ProfileEdit.test.js     ← extended

CHANGELOG.md                    ← Release Prep entry
package.json                    ← Release Prep version bump
README.md                       ← Release Prep — only if user-facing copy section exists
```

**Structure Decision**: Web application — existing layout preserved. Two new utility modules under `src/utils/`, one new design doc under `docs/design/`. No new top-level directories. Tests mirror the source-tree layout, per existing convention.

## Complexity Tracking

> No constitutional violations; this section intentionally left empty.
