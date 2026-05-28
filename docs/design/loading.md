# Loading & Async States

Design reference for Alice's loading, busy, and error-recovery conventions. Every surface that issues an async operation (fetch, save, parse, archive) follows one of the six channels defined below. The helpers in `src/utils/asyncUI.js` enforce the lifecycle; the skeletons in `src/utils/skeletons.js` provide the placeholder visuals.

## Channels

### initial-load

First data fetch on page mount. The surface shows a skeleton placeholder and the container carries `aria-busy="true"` until data arrives. On failure the skeleton is replaced by an inline-error block with a retry button.

| Visual | Helper | Surfaces |
|--------|--------|----------|
| Skeleton placeholder | Manual `aria-busy` on container | Tracker list, Profile sections, Calendar grid + panel, ProfileEdit, Profile applications block |

### refresh

Re-fetch of data the user has already seen. Prior content stays visible while the container carries `aria-busy="true"`. On failure a toast fires and the prior view is preserved.

| Visual | Helper | Surfaces |
|--------|--------|----------|
| Container `aria-busy` over existing content | `bindContainerBusy` | Calendar month/year switch |

### save

Persist user edits. The triggering button shows a label change, `aria-busy="true"`, and `disabled`. Peer action buttons are locked via the `peers` option.

| Visual | Helper | Surfaces |
|--------|--------|----------|
| Button busy + peer lockout | `bindBusyButton` | Application Overlay Save, ProfileEdit Save |

### parse

Long-running analysis of user-supplied content. The button shows busy state, the input is locked as a peer, and an inline pending message describes progress.

| Visual | Helper | Surfaces |
|--------|--------|----------|
| Button busy + input read-only + pending message | `bindBusyButton` | CreationPicker Process, Resume Import upload |

### mutation

Single-action write (archive, unarchive, favorite, status change). The button shows `aria-busy="true"` and `disabled`. No peer lockout beyond the button itself.

| Visual | Helper | Surfaces |
|--------|--------|----------|
| Button busy (attribute-only for icon buttons) | `bindBusyButton` | Card Archive / Unarchive, Modal Favorite / Archive / Unarchive, StatusDropdown commit |

### transition

Switch between views of the same dataset. The destination view's skeleton replaces the source content; the navigation control carries `aria-busy="true"`.

| Visual | Helper | Surfaces |
|--------|--------|----------|
| Destination skeleton + nav `aria-busy` | Manual skeleton swap + `viewBusy` prop drives manual `aria-busy` on chip | Tracker Active / Archived view switch |

## Skeleton vocabulary

Five DOM-factory builders in [`src/utils/skeletons.js`](../../src/utils/skeletons.js). Each returns a ready-to-insert element (or pair) with `aria-busy="true"` on the root.

| Builder | Returns | Surface |
|---------|---------|---------|
| `buildApplicationListSkeleton()` | `HTMLDivElement` | Tracker card list |
| `buildProfileSkeleton()` | `HTMLDivElement` | Profile page sections |
| `buildCalendarSkeleton()` | `{ grid, panel }` | Calendar month grid + Action Panel |
| `buildProfileEditSkeleton()` | `HTMLDivElement` | ProfileEdit section cards |
| `buildProfileAppsSkeleton()` | `HTMLDivElement` | Profile applications block |

All builders reuse the `.skeleton-line` CSS class, which inherits the existing `prefers-reduced-motion` rule.

## Inline-error block

Produced by `renderInlineError({ target, message, onRetry })` in [`src/utils/asyncUI.js`](../../src/utils/asyncUI.js).

```html
<div class="inline-error" role="alert" aria-live="polite">
  <p class="inline-error__message">{message}</p>
  <button class="inline-error__retry" type="button">Try again</button>
</div>
```

- Replaces `target`'s children and clears `aria-busy` on the target.
- Auto-focuses the retry button after insertion.
- `dispose()` removes the element from the DOM (idempotent).

Used for cold-load failures on Tracker, Calendar, Profile applications, CreationPicker parse, and Resume Import parse.

## Button-busy contract

`bindBusyButton({ button, action, busyLabel?, peers?, errorMessage?, silent? })` returns `{ run, dispose }`.

- **Label buttons** (Save, Process): `busyLabel` swaps the text; `aria-busy="true"` + `disabled` are set.
- **Icon-only buttons** (Favorite, Archive): no `busyLabel`; only `aria-busy="true"` + `disabled`.
- **Peers**: each element in `peers` is disabled during pending and restored to its prior `disabled` state on completion. Peers already carrying `aria-busy="true"` are skipped to avoid clobbering another binding's lifecycle.
- **Duplicate-click guard**: a second `run()` while pending returns the same in-flight promise (FR-009).
- **AbortError**: resolves to `null` silently.
- **dispose()**: idempotent; safe during pending (clears attributes, does not abort the request).
- **Disabled-restore invariant**: cleanup restores the button's pre-`run()` `disabled` value. A caller whose action recalculates the final `disabled` (e.g. ProfileEdit's `updateControlsState()` disabling Save once the form is clean) MUST dispose or detach the button before the cleanup microtask — typically by closing or navigating away — otherwise the restore re-applies the stale value. All current callers do this (Modal/Card close on success; ProfileEdit navigates away, which unmounts and disposes the binding synchronously).

See [contracts/api.md § 2.1](../../specs/029-loading-async-states/contracts/api.md) for the full signature.

## Reduced motion

The existing CSS rule at `src/styles/main.css` targets `.skeleton-line`:

```css
@media (prefers-reduced-motion: reduce) {
  .skeleton-line { animation: none; }
}
```

Every skeleton builder uses `.skeleton-line` primitives, so the rule applies automatically to all new skeletons. No new `@keyframes` or motion rules were introduced.

## Adding new surfaces

To add busy state to a new action button:

1. `import { bindBusyButton } from '../utils/asyncUI.js';`
2. Create the binding: `const binding = bindBusyButton({ button, action: () => doWork(), busyLabel: 'Working...', silent: true });`
3. Wire the click: `button.addEventListener('click', () => binding.run().catch(() => {}));`
4. Dispose on teardown: `binding.dispose();`

To add a skeleton for a new page section, add a builder to `src/utils/skeletons.js` using the existing `.skeleton-line` primitives and export it.

## References

- [Feature spec](../../specs/029-loading-async-states/spec.md), [plan](../../specs/029-loading-async-states/plan.md), [contracts](../../specs/029-loading-async-states/contracts/api.md), [data model](../../specs/029-loading-async-states/data-model.md), [research](../../specs/029-loading-async-states/research.md)
- [Tracker design](tracker.md), [Calendar design](calendar.md), [Application Overlay design](application_overlay.md), [Profile design](profile_page.md)
- [WAI-ARIA `aria-busy`](https://www.w3.org/TR/wai-aria-1.2/#aria-busy)
- [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
