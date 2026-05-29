# Research: Loading & Async States

**Feature**: 029 · **Date**: 2026-05-27 · **Status**: Final (Phase 0)

Survey of existing loading surfaces in the codebase, decisions taken for this feature, and the rejected alternatives behind each decision.

---

## 1. Current state of the codebase

### 1.1 — Skeleton vocabulary already exists

CSS classes `.loading-skeleton`, `.loading-skeleton--applications`, `.loading-skeleton--profile`, `.skeleton-card`, `.skeleton-section`, `.skeleton-line` (with modifier classes `--short`, `--medium`, `--title`) are defined in [src/styles/main.css:2189-2238](../../src/styles/main.css#L2189-L2238) along with the `skeleton-shimmer` keyframe. A `prefers-reduced-motion: reduce` rule at [src/styles/main.css:5403-5411](../../src/styles/main.css#L5403-L5411) disables the shimmer for affected users.

Two functions use them today:

- `renderApplicationSkeleton()` at [src/pages/Tracker.js:370-388](../../src/pages/Tracker.js#L370-L388) — builds a card-grid skeleton with three placeholder cards.
- `renderProfileSkeleton(page)` at [src/pages/Profile.js:43-54](../../src/pages/Profile.js#L43-L54) — builds three section-card skeletons for hero / applications / profile sections.

Both set `aria-busy="true"` on the wrapper and reuse the same `.skeleton-line` primitives.

### 1.2 — Bare "Loading…" strings still exist on three surfaces

- [src/pages/Calendar.js:159-160](../../src/pages/Calendar.js#L159-L160) — grid + panel slots: `_panelSlot.textContent = 'Loading…'; _gridSlot.textContent = 'Loading…';`
- [src/pages/Profile.js:153](../../src/pages/Profile.js#L153) — applications block: `body.append(createElement('div', 'profile-loading', 'Loading applications...'))`
- [src/pages/ProfileEdit.js:1278](../../src/pages/ProfileEdit.js#L1278) — `container.replaceChildren(createElement('div', 'profile-loading', 'Loading profile...'))`

All three precede a `getAll()` / `getProfile()` call and are replaced atomically on response.

### 1.3 — `aria-busy` exists on auth forms

- [src/pages/welcome/LoginForm.js:65-74](../../src/pages/welcome/LoginForm.js#L65-L74) — submit button gets `aria-busy="true"` during pending; form root gets it during submit.
- [src/pages/welcome/SignupForm.js:92-101](../../src/pages/welcome/SignupForm.js#L92-L101) — same pattern.

These two surfaces are the de-facto reference for the button-busy pattern this feature codifies. **No change required.** FR-023 explicitly preserves them.

### 1.4 — Parsing surfaces have ad-hoc patterns

- [src/components/CreationPicker.js:56-77](../../src/components/CreationPicker.js#L56-L77) — `_runParser()` toggles a `loading` div's `hidden` attribute (`loading.hidden = false` before fetch, `loading.hidden = true` after). Text is `'Analyzing job post…'`. There is **no failure handling visible**: on a thrown error the catch path is implicit and does not surface a retry; the user just sees the loading message hide with no further state.
- [src/components/ResumeImport.js:22-26, 156, 212](../../src/components/ResumeImport.js) — three rotating processing messages plus `aria-busy` on the root. Rotation is timer-driven.

### 1.5 — Application Overlay (Modal.js) has AbortController plumbing but no UI busy state

- [src/components/Modal.js:35](../../src/components/Modal.js#L35) — `let _saveController = null;` module-level state.
- [src/components/Modal.js:718-721](../../src/components/Modal.js#L718-L721) — `_saveController = new globalThis.AbortController(); const updated = await api.update(_draft.id, _draft, { signal: _saveController.signal }); _saveController = null;`
- [src/components/Modal.js:754-758](../../src/components/Modal.js#L754-L758) — catch path swallows `AbortError` silently; otherwise fires `Toast.show('Failed to save', 'failure')`.
- [src/components/Modal.js:826-827](../../src/components/Modal.js#L826-L827) — `_saveController?.abort(); _saveController = null;` (called from the modal close path).

**The plumbing is there. The UX gap is that no button receives `aria-busy` and no peer action gets disabled during the await.** That is the gap this feature closes.

### 1.6 — Other action buttons

- Card archive / unarchive — uses `api.archive(id)` / `api.unarchive(id)` directly with no in-flight indicator.
- Modal's `★ Favorite` ([src/components/Modal.js:987](../../src/components/Modal.js#L987)) — same; toggles `fav` via `api.update()` with no busy state.
- Modal's `🗄 Archive` and `↺ Unarchive` ([src/components/Modal.js:1021-1031](../../src/components/Modal.js#L1021-L1031)) — same; no busy state.
- Status Dropdown — commits a status change with no busy state.
- QuickFiltersToolbar view chip ([src/components/QuickFiltersToolbar.js](../../src/components/QuickFiltersToolbar.js)) — switches view; no in-flight signal during the transition fetch.

---

## 2. Constraints from the project context

### 2.1 — Vanilla JS, no framework

The project is intentionally framework-less. There is no React, no Vue, no observable / signal library. State is managed by plain JS closures and module-level variables; subscriptions are manual (`authStore.subscribe`). Any helper introduced here must match that posture — **no reactive wrappers, no proxies, no observer registries.**

### 2.2 — `api.js` already supports `AbortSignal`

[src/services/api.js](../../src/services/api.js) passes options through. The Modal save path already uses it. The helper can rely on this for the save channel; the parse channel does not need it for v1 (see § 3.5).

### 2.3 — `demoStore` is async by interface

[src/data/demoStore.js](../../src/data/demoStore.js) exposes `async` methods even though resolution is synchronous (they `await` nothing meaningful). This means the helper's `await action()` works uniformly for hosted and demo modes — the channel-traversal contract holds in demo without special-casing.

### 2.4 — Toast component is the standard error surface

[src/components/Toast.js](../../src/components/Toast.js) — `Toast.show(message, kind)`. Already used by Modal save's failure path. The mutation-error path (FR-013) reuses it; no new toast variant is introduced.

---

## 3. Design decisions

### 3.1 — Shape of the shared helper (FR-001…FR-009)

**Decision:** Three small functions, no class, no state machine.

```js
// src/utils/asyncUI.js
export function bindBusyButton({ button, action, busyLabel, peers })
  → { run, dispose }
export function bindContainerBusy({ container, action })
  → { run, dispose }
export function renderInlineError({ target, message, onRetry })
  → { element, focus, dispose }
```

**Rationale:** The project's existing style. Each call site is explicit. Tests are straightforward.

**Alternatives considered:**

- *Reactive observable / signal store.* Rejected — out of band with the codebase. Would introduce a programming pattern alien to the project.
- *Single `useAsync` HOC-style helper.* Rejected — couples the busy state to the request itself; we want them decoupled so a non-fetch action (e.g. a sync confirmation) can still go through the same lifecycle.
- *DOM-attribute scanning (`[data-async-action]` auto-binding).* Rejected — magical, hard to debug, and forces tests to set up DOM rather than call functions.
- *Toast-only feedback (no button busy).* Rejected — the duplicate-submit problem requires visible UI gating; toasts arrive *after* the request lands.

### 3.2 — Skeleton helper extraction

**Decision:** Move `renderApplicationSkeleton` and `renderProfileSkeleton` into `src/utils/skeletons.js` verbatim (rename to `buildApplicationListSkeleton` / `buildProfileSkeleton`); add three new builders (`buildCalendarSkeleton`, `buildProfileEditSkeleton`, `buildProfileAppsSkeleton`). Each builder returns a DOM node ready to insert; the caller manages mount/unmount.

**Rationale:** The functions are already written in DOM-builder style. Lifting them to a util module is a low-risk port. The new builders follow the same convention so the future test surface is uniform.

**Alternatives considered:**

- *A single `buildSkeleton(kind, options)` function.* Rejected — five small builders are clearer than one big switch.
- *A component class with `mount/unmount`.* Rejected — overkill for read-only nodes.
- *Server-rendered skeletons.* Rejected — the app is a Vite SPA with no SSR; there is no server-rendered shell to put a skeleton in.

### 3.3 — `aria-busy` as the single source of truth

**Decision:** `aria-busy="true"` on the busy container or button is the only state the rest of the app inspects. Tests assert presence/absence; CSS uses `[aria-busy="true"]` selectors for visual treatment. No JS-side state map, no `data-pending` attribute, no module-scoped set.

**Rationale:** ARIA is already the accessibility contract. Reusing it for the visual + behavioural contract avoids duplicating state. One attribute, one truth.

**Alternatives considered:**

- *`data-busy="true"` (separate attribute).* Rejected — duplicates the ARIA attribute.
- *Module-scoped `Set<HTMLElement>` of busy buttons.* Rejected — encapsulates state in JS where it should be on the DOM.

### 3.4 — Interaction with existing AbortController (FR-008)

**Decision:** The existing Modal save abort path is preserved. The `bindBusyButton` helper does NOT wrap the abort signal — the helper sees the same Promise the abort signal already operates against, and reacts to its resolution / rejection.

**Critical resolution of an FR-008 contradiction:**

FR-008 says "modal close paths MUST be inert during a Save." But the existing Modal code uses the close path to *abort* the save ([src/components/Modal.js:826](../../src/components/Modal.js#L826)). Reading FR-008 literally would defeat the existing abort.

We resolve: **inert** means "does not commit a different action" (does not switch the modal to a different mode, does not open another row). It does *not* mean "blocks the abort signal." The close paths during save are visually idle (no spinner cancellation hint) and call `_saveController.abort()` as today; the save's `aria-busy` clears in the abort branch.

This is documented in the plan's [Risk § peer-action lockout (FR-008) over-locking](plan.md#risk-peer-action-lockout-fr-008-over-locking). The plan-review gate ([checklists/plan-review.md](checklists/plan-review.md)) re-validates this with the team before tasks generation.

**Alternatives considered:**

- *Block close paths fully during save.* Rejected — removes the existing escape hatch; bad UX for a 30-second hung request.
- *Add an explicit "Cancel save" button.* Rejected — out of scope; the existing close-cancels-save behaviour is fine.

### 3.5 — No parse cancellation (FR-008 edge case)

**Decision:** The Smart Parser and Resume Import do not get `AbortController` wiring in this feature. Closing the picker mid-parse leaves the request in flight; the result is discarded by the closed view. The spec's [Smart Parser dialog re-opened after closing mid-parse](spec.md#edge-cases) edge case documents this.

**Rationale:** Parse requests can take 3+ seconds and there is currently no abort path in the parser route. Adding one is a separate feature touching `server/routes/resume.js` and the AI provider's call site. Scope-creep risk is real.

**Alternatives considered:**

- *Wire `AbortController` to parse.* Rejected — out of scope; touches server.
- *Block close during parse.* Rejected — the user expectation that close cancels is too well established.

### 3.6 — Inline-error block shape

**Decision:** A single shape across surfaces:

```html
<div class="inline-error" role="alert" aria-live="polite">
  <p class="inline-error__message">[message]</p>
  <button class="inline-error__retry" type="button">Try again</button>
</div>
```

Focus moves to the `Try again` button on render.

**Rationale:** One shape means one test, one CSS rule, one mental model for users. Variants are surface-style differences (size, spacing) handled by parent-context CSS.

**Alternatives considered:**

- *Per-surface error designs.* Rejected — exactly the inconsistency this feature is fixing.
- *Toast-only error path for list fetches.* Rejected — a toast cannot live in the empty-skeleton slot; the user can dismiss it and end up with a blank list.
- *Modal error dialog.* Rejected — interrupts the user; the error belongs in the surface that failed.

### 3.7 — Reuse of the auth-form button-busy pattern

**Decision:** `bindBusyButton`'s behaviour mirrors the auth forms' (label change + `aria-busy="true"` + disabled). The auth forms remain untouched but are tested via the same assertion shape.

**Rationale:** Two existing call sites already work this way. Codifying their pattern is the lowest-risk option.

---

## 4. Boundary-of-scope decisions

### 4.1 — No new visual vocabulary

**Decision:** No new spinner glyph, no new shimmer style, no new animation. The feature uses only the existing `.skeleton-line` shimmer + new BEM-style block classes for the inline-error.

**Rationale:** Brief Goal: "Standardize loading behavior." Adding a new visual makes the *current* problem worse — five conventions become six.

### 4.2 — No minimum display-time hold

**Decision:** A 50 ms response shows a 50 ms busy state. No hold, no minimum-display logic.

**Rationale:** The user pain is *long* operations, not short ones. Holding a skeleton artificially for 200 ms when the response landed in 30 ms makes the app slower for no benefit. If QA finds the flash distracting, a hold is a one-line addition to `bindContainerBusy` in a follow-up.

**Alternatives considered:**

- *200 ms hold.* Rejected — premature optimisation for a problem we have no evidence of.
- *Adaptive hold based on response time.* Rejected — too clever.

### 4.3 — No global progress bar

**Decision:** No top-of-viewport bar. Each surface owns its own busy state.

**Rationale:** Global progress bars are useful for SPAs that do meaningful client-side routing with deferred chunk loading. This app does instant client-side route swaps; the only async work is the data fetch per page, which is captured by the per-page skeleton.

### 4.4 — No retry / backoff schedule

**Decision:** Inline-error blocks expose `Try again` once; the user clicks, the helper re-issues. No automatic retry. The 429 edge case adds a `Retry-After` countdown if the server provides one; otherwise immediate retry.

**Rationale:** Automatic retry hides failure from the user and can multiply rate-limit hits.

### 4.5 — Demo mode parity

**Decision:** Demo operations resolve synchronously; the busy lifecycle is traversed anyway. `bindBusyButton`'s `run()` is always `async`, so it always sets `aria-busy="true"`, awaits the action, and clears `aria-busy`. In demo mode the cycle is a single microtask — invisible to humans, asserted by tests.

**Rationale:** Tests catch state-management bugs; humans never see the demo flash. Bypassing the cycle would mean a separate code path that drifts from the hosted path — a class of bug FR-019 explicitly prohibits.

---

## 5. Open items resolved at plan time

| Open item | Resolution | Source |
|-----------|------------|--------|
| Should we add `AbortController` to parse flows? | No — out of scope, deferred. | § 3.5 |
| Should close paths abort the save or block it? | Abort (preserve existing behaviour). | § 3.4 |
| Should there be a min-display-time hold? | No. | § 4.2 |
| Should the helper expose its busy state outside the DOM? | No — `aria-busy` is the truth. | § 3.3 |
| Should each surface get a bespoke skeleton or a shared builder? | Shared builder per surface. | § 3.2 |
| Should the inline-error be a toast variant or its own block? | Own block (lives in the skeleton's slot). | § 3.6 |
| Should we preserve the auth forms or rewrite them through the helper? | Preserve (FR-023). | § 3.7 |
| Should the helper handle optimistic UI? | No — separate future feature. | § 4 (out of scope) |

---

## 6. Risks identified during research

- **Skeleton DOM port regression** — mitigated by snapshot test against `main` baseline.
- **`bindBusyButton` × abort interaction** — mitigated by idempotent `dispose()` and abort-branch handling in helper's `finally` clause.
- **FR-008 over-locking** — resolved (§ 3.4); re-validate at plan-review gate.
- **CSS class collisions in `main.css`** — mitigated by BEM-style new class names.

---

## 7. Reading list / further reference

- [WAI-ARIA `aria-busy`](https://www.w3.org/TR/wai-aria-1.2/#aria-busy) — the contract this feature centres on.
- [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) — already wired in [src/styles/main.css:5403-5411](../../src/styles/main.css#L5403-L5411).
- Existing project references: [docs/design/tracker.md](../../docs/design/tracker.md), [docs/design/application_overlay.md](../../docs/design/application_overlay.md), [docs/design/calendar.md](../../docs/design/calendar.md). The new [docs/design/loading.md](../../docs/design/loading.md) joins this set.
