# Module Contracts: Profile Page

**Branch**: `007-profile-page` | **Date**: 2026-04-28

These contracts define the public interface for each new or modified module. They follow the same mount/unmount lifecycle and named-export patterns already established in the codebase.

---

## `src/pages/Profile.js`

Replaces the existing statistics stub. Full rewrite.

```js
// mount(container: HTMLElement, options: { navigate: (page: string) => void }) → void
// Fetches api.getAll(), reads profileStore.get(), renders the complete
// profile page (welcome heading, applications section, profile section)
// into `container`. Both DonutChart and StackedBar are rendered; CSS media
// queries control which is visible. navigate is used for all cross-page CTAs.
export function mount(container, { navigate }) { ... }

// unmount() → void
// Clears the container and tears down any timers (mobile tap-dismiss timers).
export function unmount() { ... }

export const Profile = { mount, unmount };
```

---

## `src/pages/ProfileEdit.js`

New module. Dedicated Edit / Setup Profile page.

```js
// mount(container: HTMLElement, options: { navigate: (page: string) => void }) → void
// Hides the global .navbar element, inserts a custom <header> (back button +
// title) before <main id="app">, renders stacked edit cards into `container`.
// navigate is used for "← Back to Profile" and any future CTA routing.
export function mount(container, { navigate }) { ... }

// unmount() → void
// Removes the custom header, restores .navbar visibility, clears the container.
export function unmount() { ... }

export const ProfileEdit = { mount, unmount };
```

---

## `src/data/profileStore.js`

New module. Mirrors the pattern of `src/data/store.js`.

```js
const PROFILE_KEY = 'apptracker_profile';

// get() → Profile | null
// Returns the stored profile object, or null if none is saved.
export function get() { ... }

// save(profile: Profile) → { ok: boolean, errors?: object }
// Validates the profile via models/profile.js. If valid, serialises and
// writes to localStorage. Returns { ok: true } on success or
// { ok: false, errors: { field: message } } on validation failure.
export function save(profileData) { ... }

export const profileStore = { get, save };
```

---

## `src/models/profile.js`

New module. Pure functions only — no side effects, no DOM.

```js
// validateProfile(data: object) → { valid: boolean, errors: { [field]: string } }
// Checks required fields and email format. Returns errors keyed by field name.
export function validateProfile(data) { ... }

// normaliseProfile(data: object) → Profile
// Trims strings, normalises undefined array fields to [], returns a clean object.
export function normaliseProfile(data) { ... }

// computeAppCounts(applications: Application[]) → AppCounts
// Reduces an application array to a status → count map.
export function computeAppCounts(applications) { ... }

// computeStats(counts: AppCounts) → { total, active, pending, offer }
// Derives the four display stats from a counts map.
// active = phone_screen + interview + assessment
// pending = applied
// offer = offer
export function computeStats(counts) { ... }
```

---

## `src/components/DonutChart.js`

New component. Renders an SVG donut chart.

```js
// render(options) → { el: SVGElement, update: (hovered: string|null) → void }
//
// options = {
//   counts: AppCounts,           // status → count map
//   colors: { [status]: string }, // hex colours per status
//   labels: { [status]: string }, // display labels per status
//   size: number,                 // SVG width/height in px (default 160)
//   holeRatio: number,            // 0–1, fraction of radius for hole (default 0.55)
//   onHover: (status: string|null, el: SVGPathElement|null, pct: number, event: MouseEvent|null) → void
//            ↑ event is the raw MouseEvent (for cursor-relative tooltip positioning via
//              event.clientX / event.clientY); null when hover ends
// }
//
// Returns the SVG element and an `update()` function to programmatically
// set the hovered segment (used by legend cross-highlighting).
// Note: DonutChart fires onHover on both mouseover AND mousemove so the
// tooltip can track the cursor within a segment.
export function render(options) { ... }

export const DonutChart = { render };
```

---

## `src/components/StackedBar.js`

New component. Renders a horizontal stacked bar for mobile.

```js
// render(options) → HTMLElement
//
// options = {
//   counts: AppCounts,
//   colors: { [status]: string },
//   labels: { [status]: string },
//   onTap: (status: string, count: number, pct: number) → void
// }
//
// Returns a <div> containing the stacked bar segments.
// Each segment fires onTap on click/touchend.
export function render(options) { ... }

export const StackedBar = { render };
```

---

## `main.js` (modification)

Add `profile-edit` to the `navigate()` switch. Import `ProfileEdit`.

```js
// Before:
} else if (page === 'profile') {
  Profile.mount(appRoot);
  _currentUnmount = Profile.unmount;
}

// After:
} else if (page === 'profile') {
  Profile.mount(appRoot);
  _currentUnmount = Profile.unmount;
} else if (page === 'profile-edit') {
  ProfileEdit.mount(appRoot);
  _currentUnmount = ProfileEdit.unmount;
  // Do NOT call Navbar.setActive() for this key — navbar is hidden on this page.
  return;
}
```

`Navbar.setActive(page)` at the end of `navigate()` is guarded to skip `'profile-edit'`.
