# Plan: #120 — Mobile/tablet Tracker card tap feedback

## Problem

On mobile/tablet, tapping a Tracker card calls `openModalApplication()`
([src/pages/Tracker.js:891](src/pages/Tracker.js#L891)), which awaits
`api.getById()` before anything renders. There is no pressed state, spinner,
or skeleton on `.card` today, so on a slow (hosted) connection a tap looks
unregistered — the same problem #109 fixed for desktop, but #109's fix
(`card--selected`, CSS-scoped to `.tracker-master`) never applies to mobile's
plain `.card-list` markup.

## Goal

Give the tapped card immediate, visible feedback the instant it's tapped,
and keep that feedback visible until the modal opens (or an error toast
fires), without touching the desktop docked-pane behavior.

## Revision note

This plan was reviewed by both Antigravity and Codex. Both flagged the same
core defect independently: **DOM-class mutation is the wrong mechanism**
because `renderPage()` ([Tracker.js:823](src/pages/Tracker.js#L823)) does a
full non-diffed `_cardList.replaceChildren()` rebuild, triggered by
unrelated concurrent actions (`onFavToggle`, `onStatusChange`, `onArchive`,
each calling `renderPage()` after their own `await`). A card marked pending
via `classList.add` loses that marking the instant *any* other card's
action resolves and re-renders the list. The approach below replaces DOM
mutation with page-level render state, and adds explicit answers to several
race conditions and gaps both reviews raised. See prior review threads for
full detail; this section is the resolution, not a transcript.

## Approach

Three layered, additive changes — no refactor of `Modal.js` required:

1. **Native press feedback (CSS only).** Add an `:active` state to `.card`
   (subtle scale/opacity dip) so *every* tap gets instant feedback with zero
   JS, before any fetch even starts. **Scoped to sub-desktop widths**
   (`@media (max-width: 1099px)`, matching the existing mobile/tablet `.card`
   override at [main.css:5611](src/styles/main.css#L5611)) so it cannot
   interact with `.tracker-master .card--selected:hover`'s transform on
   desktop — the stated "don't touch desktop" scope was violated by a
   global `.card:active` rule in the original draft.
2. **In-flight loading state via render state, not DOM lookup.** Track a
   single `_pendingModalApplicationId` module variable in `Tracker.js`,
   parallel to the existing `_selectedId`. Set it before `await
   api.getById()`, clear it in `finally`. Thread it into `Card.render()` as
   a `pending` boolean (same mechanism already used for `selected`), and
   into `renderPage()`'s per-card render loop, so the pending visual is
   reconstructed correctly on every rebuild regardless of what triggered it.
3. **Accessibility contract**, not just visual: the pending card gets
   `aria-busy="true"` (removed when cleared), and the spinner/transform
   respect `prefers-reduced-motion: reduce` (drop the animation, keep a
   static, non-color-only indicator) — matching the existing pattern at
   [main.css:9411](src/styles/main.css#L9411) for `.pane-loading__spinner`.

### Re-entrancy / concurrent taps — explicit policy

**Decision: ignore new taps while a modal fetch is already pending.**
Rationale: mobile has one modal surface; allowing a second tap to "replace"
the pending target adds a stale-response class of bug for no clear UX
benefit, whereas ignoring is simple and matches how a native app would
debounce a double-tap.

- `openModalApplication(id)` sets `_pendingModalApplicationId` **before**
  the `await`, and returns early (no-op) if a fetch is already pending for
  a *different* id. Tapping the same still-pending card again is also a
  no-op (avoids a duplicate `api.getById()` call).
- Because `api.getById()` can resolve out of order, `Modal.open()` is only
  called if `_pendingModalApplicationId` still equals `numericId` at
  resolution time (guards against a stale response from an ignored/older
  request — defensive, in case the ignore-guard above is ever relaxed).
- All existing entry points funnel through the same `onOpen(id)` callback
  ([Tracker.js:944-952](src/pages/Tracker.js#L944)) — card click, card
  `Enter`/`Space` keydown, and the edit button's `onOpen` — so a single
  id-keyed pending state naturally covers all three without per-source
  handling.

### Unmount race

`openModalApplication()` currently has no "still mounted" guard, and
`Tracker.unmount()` ([Tracker.js:1130](src/pages/Tracker.js#L1130)) nulls
`_container` without cancelling in-flight fetches — so navigating away
mid-fetch would still pop `Modal.open()` on top of whatever page loaded
next. Reuse the existing guard idiom already established in this codebase
(`Calendar.js`'s `isCurrentMount(mountId)`, used inside a non-mount async
action at [Calendar.js:150-178](src/pages/Calendar.js#L150)) rather than
inventing a new pattern: capture the mount identity, and no-op instead of
calling `Modal.open()` if the page has unmounted by the time the fetch
resolves.

## Implementation steps

1. `src/pages/Tracker.js`
   - Add `_pendingModalApplicationId` (module state, mirrors `_selectedId`).
   - In `openModalApplication(id)`: early-return if a different id is
     already pending; set `_pendingModalApplicationId` and call
     `renderPage()` before the `await`; on resolution, check the id is
     still current *and* the page is still mounted (reuse the
     `Calendar.js`-style mount guard) before calling `Modal.open()`; clear
     `_pendingModalApplicationId` and `renderPage()` again in `finally`.
   - Leave `selectApplication()` / desktop pane logic untouched.
2. `src/components/Card.js`
   - Thread a `pending` flag through `render()` the same way `selected` is
     threaded today; when true, add `card--pending`, `aria-busy="true"`.
3. `src/styles/main.css`
   - Add `.card { position: relative; }` (currently unset at both the base
     rule [main.css:3566](src/styles/main.css#L3566) and both responsive
     overrides — required before any absolutely-positioned spinner
     pseudo-element can be anchored to the card instead of the viewport).
   - Add `.card:active` press feedback scoped to `@media (max-width:
     1099px)` only.
   - Exclude action buttons from the press effect —
     `.card:active:not(:has(.card-btn:active))` — since all `.card-btn`
     clicks already `stopPropagation()` (`Card.js`'s `stopAction()`
     helper), but `:active` is a CSS pseudo-class state (applies to
     ancestors of the pressed element), not a bubbled JS event, so
     `stopPropagation()` doesn't stop it — pressing a button still visually
     activates the ancestor card without this guard. `:has()` is already used elsewhere in this stylesheet
     (`main.css:12364`), so no new browser-support boundary is crossed.
   - Add `.card--pending` styles (dimmed + small spinner) with a
     `prefers-reduced-motion: reduce` override that removes the animation.
4. Automated tests (`tests/pages/Tracker.test.js`) — this changes async
   state and stale-response handling, not just CSS, so cover:
   - `card--pending`/`aria-busy` appears before `api.getById()` resolves.
   - Clears on both success and failure paths.
   - A second tap on a different card while one is pending is a no-op
     (only one `api.getById()` call fires).
   - A resolved fetch for a since-unmounted page does not call
     `Modal.open()`.
5. Manual browser smoke test (mobile + tablet viewport, throttled network)
   remains required per the constitution, but is not the only gate — it
   confirms visual/timing feel, the Vitest additions confirm correctness.

## Out of scope

- No change to desktop `selectApplication()` / docked-pane behavior.
- No skeleton content inside the modal itself (would require `Modal.js` to
  support a loading state before `application` data exists) — the card-level
  pending state is sufficient per the issue's suggested fix shape.

## Testing

- New Vitest coverage in `tests/pages/Tracker.test.js` per step 4 above.
- Manual browser smoke test (mobile + tablet viewport, throttled network):
  tap a card, confirm immediate press feedback, confirm pending indicator
  persists until modal opens, confirm pending state clears cleanly on
  fetch failure (Toast shown, no stuck spinner), confirm a second card
  tapped while one is pending does nothing until the first resolves.

## Release considerations

Per project constitution, final phases before merge are Release Prep
(version bump, CHANGELOG entry) and Browser Smoke Test (this is a UI
feature/fix, so both apply) — done last, against the to-be-merged state.
Current version is `1.12.1`; this would land as a patch bump.
