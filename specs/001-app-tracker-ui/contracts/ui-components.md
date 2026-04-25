# Contract: UI Components

**Feature**: `001-app-tracker-ui`  
**Pattern**: Each component is a plain JS module that exports a factory/render function. Components receive data as arguments and return DOM nodes or accept a container element to mount into. Components call store methods for mutations; they do not hold their own state beyond what is needed for animation/transition.

---

## Navbar

```
Navbar.render(activePage: 'tracker' | 'calendar' | 'profile') → HTMLElement
Navbar.setActive(page: string) → void
```

**Renders**: Top bar (52px, navy background) with app logo left, nav buttons (Tracker, Calendar, Profile) right.  
**Active state**: The active nav button receives the filled indigo style.  
**Constraint**: All three buttons must be visible without scrolling at all viewport widths.

---

## Toolbar

```
Toolbar.render(count: number) → HTMLElement
Toolbar.updateCount(count: number) → void
```

**Renders**: Sticky bar below Navbar showing an application count badge.  
**Constraint**: Sticky below Navbar; z-index below Navbar.

---

## Card

```
Card.render(application: JobApplication) → HTMLElement
```

**Renders**: A card row with the full 3-row desktop layout (or stacked mobile layout via CSS). Attaches internal event listeners for click-to-modal, star toggle, status dropdown trigger, and copy URL.

**Events emitted** (via callbacks passed by Tracker page):
- `onOpen(id)` — deliberate click on card body → open Modal
- `onStatusChange(id, newStatus)` — status selected from dropdown
- `onFavToggle(id)` — star clicked
- `onCopyUrl(id)` — copy URL button clicked

**Corrupt record**: If `application._corrupt === true`, renders with soft red background and warning icon; click-to-open is still permitted.

**Click disambiguation**: Uses `pointerdown`/`pointerup` movement threshold (< 5 px) to distinguish deliberate click from scroll gesture. Threshold applies to card body only; action buttons use standard `click`.

---

## CompatBar

```
CompatBar.render(score: number) → HTMLElement
```

**Renders**: A pill-shaped progress bar with fill colour and centred percentage label.  
**Fill thresholds**: ≥ 80 green, ≥ 60 yellow, < 60 indigo (per design spec).  
**Label colour**: White when fill ≥ 50%; `#4B5563` when fill < 50%.  
**Constraint**: Renders correctly at 0 and 100 without overflow.

---

## Modal

```
Modal.open(application: JobApplication) → void
Modal.close() → void
```

**Renders**: Full-screen backdrop + centred modal panel (max-width 740px, max-height 90vh, independently scrollable body).  
**On open**: Saves `window.scrollY`; sets `document.body.style.overflow = 'hidden'`.  
**On close**: Restores `document.body.style.overflow`; calls `window.scrollTo(0, savedScrollY)`.  
**Backdrop click**: Calls `Modal.close()`.  
**Mobile**: On viewports < 640px, renders as a bottom-sheet (slides up from bottom, rounded top corners only).  
**Status change**: Modal header includes a status change trigger that calls `store.updateStatus()` and re-renders the status badge in-place.

---

## StatusDropdown

```
StatusDropdown.open(anchorEl: HTMLElement, currentStatus: StatusEnum, onChange: (newStatus) => void) → void
StatusDropdown.close() → void
```

**Renders**: A floating panel of nine status options with colour dots and the current status checked.  
**Positioning**: Positioned relative to `anchorEl`; repositions if it would overflow the viewport edge.  
**Backdrop**: A full-viewport transparent div that calls `StatusDropdown.close()` on click, without changing status.  
**On selection**: Calls `onChange(newStatus)` then `StatusDropdown.close()`.

---

## Toast

```
Toast.show(message: string, type: 'success' | 'failure') → void
```

**Renders**: A pill-shaped fixed notification at bottom-centre of viewport.  
**Success**: Green dot prefix; navy background; white text.  
**Failure**: No dot (or red indicator); same shell.  
**Timing**: Appears within 500 ms of call; auto-dismisses after 2400 ms.  
**Animation**: `translateY(8px) → translateY(0)` + fade in, 180 ms ease on enter; reverse on exit.  
**Constraint**: Only one Toast visible at a time; a new call replaces any in-progress toast.

---

## Pages

### Tracker.js

```
Tracker.mount(container: HTMLElement) → void
Tracker.unmount() → void
```

**Renders**: Toolbar + card list. Reads all records from `store.getAll()`, sorts by ID ascending (corrupt records last), renders a `Card` for each. Renders empty state when list is empty.  
**Scroll**: Resets scroll to top on every `mount()` call (navigating back to Tracker always starts at top). Scroll position within the page is managed by `Modal` (preserved on modal close).

### Calendar.js

```
Calendar.mount(container: HTMLElement) → void
Calendar.unmount() → void
```

**Renders**: Stub — a month grid for the current month with `last_status_update` dates marked for entries that updated in that month. No interaction beyond display.

### Profile.js

```
Profile.mount(container: HTMLElement) → void
Profile.unmount() → void
```

**Renders**: Stub — four stat cards: Total Applications, Active (not rejected/withdrawn/ghosted), Offers, Rejections. Values derived from `store.getAll()`.
