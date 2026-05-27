# Contracts: Loading & Async States

**Feature**: 029 · **Date**: 2026-05-27 · **Status**: Final (Phase 1)

This feature ships **no wire-level API changes** (no new route, no new query parameter, no new response field, no behaviour change on existing routes). The "contracts" defined here are **internal client-side contracts**: the signatures of the new helper module `src/utils/asyncUI.js`, the new skeleton module `src/utils/skeletons.js`, and the shape of the inline-error DOM block.

---

## 1. Wire-level API surface

### 1.1 — Unchanged routes

The following endpoints exist and are **not** modified by this feature. They are listed for the audit trail.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/applications` | Existing list; optional `?view=archived` (feature 028). No change. |
| GET | `/api/applications/:id` | No change. |
| POST | `/api/applications` | No change. |
| PATCH | `/api/applications/:id` | No change. |
| POST | `/api/applications/:id/archive` | No change. |
| POST | `/api/applications/:id/unarchive` | No change (feature 028). |
| GET | `/api/profile` | No change. |
| PUT | `/api/profile` | No change. |
| POST | `/api/resume/parse` | No change. |
| GET | `/api/health` | No change. |

### 1.2 — Unchanged request / response shapes

No request body field added or removed. No response field added or removed. No header semantics changed. The `X-Client-Date` header introduced in feature 028 is preserved; this feature does not interact with it.

### 1.3 — Unchanged error semantics

`api.js` continues to throw on non-2xx (per existing behaviour). The helper's `bindBusyButton`/`bindContainerBusy` catches the thrown Error and routes it to the caller's error branch + Toast. No new error shape is defined.

### 1.4 — Unchanged client-side `api.js`

[src/services/api.js](../../src/services/api.js) is not edited by this feature. Its existing `AbortSignal` pass-through (used by Modal save) is preserved.

---

## 2. Internal-client contracts (NEW)

These are the contracts call sites depend on. Breaking them is a breaking change to the rest of the client even though no wire-level signature is affected.

### 2.1 — `bindBusyButton`

```js
// src/utils/asyncUI.js

/**
 * Bind a button to a busy-state lifecycle.
 *
 * @param {object} options
 * @param {HTMLButtonElement} options.button            The button element (REQUIRED).
 * @param {() => Promise<T>}  options.action            The async action to run on click (REQUIRED).
 * @param {string=}           options.busyLabel         Label to display while pending. If omitted,
 *                                                      the label is not changed (icon-only buttons).
 * @param {HTMLElement[]=}    options.peers             Elements to disable while pending.
 *                                                      Re-enabled in the finally branch.
 * @param {(error: Error) => string=} options.errorMessage  Builder for the failure toast message.
 *                                                      Defaults to a generic "Something went wrong."
 * @param {boolean=}          options.silent            If true, no Toast.show on failure (caller handles).
 *                                                      Default: false.
 * @returns {{
 *   run:     () => Promise<T | null>,   // null on AbortError; duplicate run() during pending returns the SAME in-flight promise (resolves to the same T as the first call)
 *   dispose: () => void                  // idempotent; safe to call mid-pending
 * }}
 */
export function bindBusyButton(options)
```

**Behavioural contract:**

1. **Idle → pending on `run()`:**
   - Sets `button.setAttribute('aria-busy', 'true')`
   - Sets `button.disabled = true`
   - Captures original `button.textContent`; if `busyLabel` provided, replaces with `busyLabel`
   - Disables each element in `peers` (recording their prior `disabled` state)
   - Calls `action()` and awaits its Promise

2. **Pending → idle on resolve:**
   - In `finally`: removes `aria-busy`, sets `disabled = false`, restores label, restores peer states
   - Returns the resolved value

3. **Pending → idle on reject (non-Abort):**
   - In `finally`: same cleanup as resolve
   - If not `silent`, calls `Toast.show(errorMessage(error) ?? 'Something went wrong.', 'failure')`
   - Re-throws the error so the caller can branch (the caller's `try/catch` controls modal-stay / form-stay behaviour per FR-013)

4. **Pending → idle on AbortError:**
   - In `finally`: same cleanup
   - Returns `null` instead of throwing — preserves the existing silent-abort behaviour of Modal save ([src/components/Modal.js:755-757](../../src/components/Modal.js#L755-L757))

5. **Duplicate-click guard (FR-009):**
   - A second `run()` while pending returns the **same in-flight promise** as the first call and issues no second `action()` call. All duplicate callers therefore resolve to the same value (or the same rejection / same null-on-abort).
   - This is asserted by `tests/utils/asyncUI.test.js` with `Promise.all([handle.run(), handle.run(), handle.run()])` against a counting mock — exactly one call, and all three returned promises resolve to the same value.
   - Returning the same promise (rather than `null` for duplicates) keeps the `null` return reserved exclusively for AbortError — see row 4 — so callers can distinguish "request aborted" from "request still in progress."

6. **`dispose()`:**
   - Idempotent.
   - If called during pending: clears `aria-busy`, restores label + disabled state, restores peers. The in-flight action continues server-side but its resolution/rejection no longer affects the unbound button.
   - If called during idle: no-op.
   - Does NOT abort the action. Callers needing abort must hold their own `AbortController` and pass its signal through `action`.

### 2.2 — `bindContainerBusy`

```js
/**
 * Bind a container to a busy-state lifecycle (no button, no label).
 *
 * @param {object} options
 * @param {HTMLElement}      options.container       The container element (REQUIRED).
 * @param {() => Promise<T>} options.action          The async action to run (REQUIRED).
 * @param {(error: Error) => string=} options.errorMessage  Toast message builder on failure.
 * @param {boolean=}         options.silent          Suppress failure toast. Default: false.
 * @returns {{
 *   run:     () => Promise<T | null>,
 *   dispose: () => void
 * }}
 */
export function bindContainerBusy(options)
```

**Behavioural contract:**

1. Idle → pending: `container.setAttribute('aria-busy', 'true')`. No `disabled` (containers don't have one). No label change. **No child mutations.**
2. Pending → idle: removes `aria-busy`. Failure toast as in `bindBusyButton`.
3. Same duplicate-call guard as `bindBusyButton`: a second `run()` while pending returns the **same in-flight promise**; no second `action()` call.
4. The caller is responsible for the visual change (e.g. swapping in a skeleton, or leaving prior data visible). The helper only manages `aria-busy`.

### 2.3 — `renderInlineError`

```js
/**
 * Replace a slot's children with an inline-error block.
 *
 * @param {object} options
 * @param {HTMLElement}    options.target     The slot element (its children are replaced) (REQUIRED).
 * @param {string}         options.message    The user-facing message (REQUIRED).
 * @param {() => void}     options.onRetry    Called when the user clicks Try again (REQUIRED).
 * @param {string=}        options.retryLabel  Default: 'Try again'.
 * @returns {{
 *   element: HTMLElement,   // the rendered <div class="inline-error">
 *   focus:   () => void,    // moves focus to the Try again button (called once on mount)
 *   dispose: () => void     // removes the element from the DOM; idempotent
 * }}
 */
export function renderInlineError(options)
```

**Behavioural contract:**

1. Replaces `target.replaceChildren(errorBlock)` — the slot's prior contents (skeleton or pending message) are removed.
2. Removes `aria-busy` from `target` if it was set.
3. Returned element has the shape:

   ```html
   <div class="inline-error" role="alert" aria-live="polite">
     <p class="inline-error__message">{message}</p>
     <button class="inline-error__retry" type="button">Try again</button>
   </div>
   ```

4. Calls `focus()` automatically on mount (`Try again` button receives keyboard focus). The returned `focus` method allows re-focusing after a parent layout shift.
5. The retry button click handler calls `onRetry()` exactly once per click. If `onRetry` re-mounts the skeleton, that re-mount is the caller's responsibility — the helper does not auto-dispose.
6. `dispose()` removes the element from the DOM. Idempotent. If the caller wants to keep `aria-busy` while re-fetching, they set it explicitly after dispose.

---

## 3. Skeleton-helper contracts

```js
// src/utils/skeletons.js

/**
 * Build the application-list skeleton (Tracker active + archived views).
 * Ported from src/pages/Tracker.js — DOM is byte-identical to the existing
 * renderApplicationSkeleton() output (FR-020, SC-007).
 *
 * @returns {HTMLDivElement}  div.loading-skeleton.loading-skeleton--applications
 */
export function buildApplicationListSkeleton()

/**
 * Build the Profile-page hero + applications + profile section skeleton.
 * Ported from src/pages/Profile.js — DOM byte-identical to the existing
 * renderProfileSkeleton() output (FR-020, SC-007).
 *
 * @returns {HTMLDivElement}  div.loading-skeleton.loading-skeleton--profile
 */
export function buildProfileSkeleton()

/**
 * Build the Calendar month-grid + Action Panel skeleton.
 * NEW (FR-002).
 *
 * @returns {{ grid: HTMLDivElement, panel: HTMLDivElement }}
 *   Two separate nodes — the caller mounts each into its slot.
 */
export function buildCalendarSkeleton()

/**
 * Build the ProfileEdit section-card skeleton.
 * NEW (FR-002).
 *
 * @returns {HTMLDivElement}
 */
export function buildProfileEditSkeleton()

/**
 * Build the Profile applications-block row skeleton.
 * NEW (FR-002).
 *
 * @returns {HTMLDivElement}
 */
export function buildProfileAppsSkeleton()
```

**Common contract for all builders:**

- Returns a `<div>` (or, for Calendar, two `<div>`s in an object) with `aria-busy="true"` set on the root.
- Reuses `.skeleton-line` / `.skeleton-card` / `.skeleton-section` primitives — no new shimmer animations introduced (FR-006).
- The caller is responsible for inserting and removing the node. The helper does not retain references.

---

## 4. CSS contracts

### 4.1 — New classes

Added to [src/styles/main.css](../../src/styles/main.css):

```css
/* Skeleton variants (FR-002) */
.calendar-skeleton { /* layout for grid + panel skeleton */ }
.calendar-skeleton__grid { /* 7-column placeholder grid */ }
.calendar-skeleton__cell { /* day-cell shimmer block */ }
.calendar-skeleton__panel { /* Action Panel side stack */ }
.calendar-skeleton__row { /* stacked shimmer row */ }
.profile-edit-skeleton { /* section-card row stack */ }
.profile-apps-skeleton { /* application-row stack */ }

/* Inline error block (FR-010, FR-011, FR-015, FR-016) */
.inline-error { /* centered block, padding */ }
.inline-error__message { /* friendly message text */ }
.inline-error__retry  { /* Try again button */ }

/* Button busy treatment (FR-003) */
.btn[aria-busy="true"],
button[aria-busy="true"] { /* dimmed, cursor: progress, etc. */ }
```

### 4.2 — Reduced-motion contract

The existing `prefers-reduced-motion: reduce` rule at [src/styles/main.css:5403-5411](../../src/styles/main.css#L5403-L5411) covers `.skeleton-line` and continues to apply to every new skeleton that reuses the class. This feature does NOT add a separate reduced-motion rule for the new skeleton classes — they rely on the existing rule via the `.skeleton-line` building block.

The inline-error block has no animation, so `prefers-reduced-motion` is implicitly satisfied.

### 4.3 — Backwards compatibility

- `.loading-skeleton`, `.loading-skeleton--applications`, `.loading-skeleton--profile`, `.skeleton-card`, `.skeleton-section`, `.skeleton-line` (and modifiers) are unchanged. (FR-020.)
- `.parser-loading` at [src/styles/main.css:3910](../../src/styles/main.css#L3910) is unchanged — preserves the CreationPicker pending-message style. The new feature reuses it via `renderInlineError` when the pending message converts to an error.
- `.profile-loading` at [src/styles/main.css:846](../../src/styles/main.css#L846) MAY become unused after the bare strings are removed; it is left in place during this feature and flagged for removal in the final Polish phase if no caller remains.

---

## 5. Toast contract (used, not changed)

[src/components/Toast.js](../../src/components/Toast.js) is the existing toast surface. `Toast.show(message, kind)` where `kind ∈ { 'success', 'failure', 'info' }`. This feature consumes it for mutation errors (FR-013) and does NOT introduce a new kind. The `Unarchived.`, `Saved.`, etc. toasts already wired in components are preserved untouched.

---

## 6. Backward-compatibility audit

| Surface | Wire-level | Internal API | Notes |
|---------|------------|--------------|-------|
| Existing `api.js` exports | Unchanged | Unchanged | New helper calls `api.update()` etc. as a black box. |
| `Toast.show()` | n/a | Unchanged | Reused for FR-013. |
| `authStore` | n/a | Unchanged | Read-only by this feature. |
| `Modal.js` save path | Unchanged | `_saveController` lifecycle preserved | Button-busy contract layers on top. |
| `Modal.js` archive / unarchive / fav / status | Unchanged | Same as save — preserved | Adds busy state where there was none. |
| `Tracker.js` view-switcher (feature 028) | Unchanged | Chip gets new `aria-busy` toggling | New attribute toggling only; feature 028's behavioural tests unaffected. |
| Auth forms (`LoginForm`, `SignupForm`) | Unchanged | Unchanged | FR-023 — preserved as reference. |
| Demo mode (`demoStore`) | Unchanged | Unchanged | Async interface already compatible. |

If any of the **Internal API** column changes after merge of this feature, that is a breaking change to *this feature*, not to any prior feature.

---

## 7. Non-contracts (explicitly NOT introduced)

- **No new event names.** The helper does not dispatch DOM events.
- **No new global object.** Nothing on `window`. The helper is module-scoped.
- **No new lifecycle hooks** beyond the per-call `run / dispose` shape.
- **No new error subclasses.** Errors flow through as-is.
- **No new constants exported.** Strings like `'Try again'`, `'Saving…'` are passed in by callers — no `LABELS.SAVE_BUSY` constant.

---

## 8. Acceptance contract

A future feature claiming compatibility with this contract must:

1. Import from `src/utils/asyncUI.js` — not duplicate the lifecycle logic.
2. Set `aria-busy` only via the helper (or for surfaces that already do so per § 6 row by row).
3. For new list-fetch surfaces, use `renderInlineError` for the recovery path (do not invent a new inline error pattern).
4. Reuse `src/utils/skeletons.js` builders or add new builders to the same module (do not duplicate skeleton DOM construction in page files).
5. Honour the `prefers-reduced-motion` rule by using `.skeleton-line` primitives.

These are guidelines for future work, not enforced by code. They are documented here so future Speckit features can cite them in their plan-review checklists.
