# Research: Application Tracker UX & Data Refinement Pack

**Branch**: `010-tracker-ux-refinement` | **Date**: 2026-04-30

All unknowns from the Technical Context have been resolved. No external research was required — decisions are based on the existing codebase patterns, the project constitution, and the feature specification.

---

## Decision 1: Wishlist Status Color → Pink

**Decision**: Update `wishlisted` entry in `STATUS_CONFIG` (`src/models/application.js`) and `STATUS_COLORS` (`shared/constants.js`) to pink: `badgeBg: '#FCE7F3'`, `badgeText: '#9D174D'`, `borderAccent: '#EC4899'`.

**Rationale**: The current Wishlist colors (`#F3E8FF` / `#6B21A8` / `#9333EA`) are purple-violet and visually conflict with Technical Assessment (`#EDE9FE` / `#5B21B6` / `#8B5CF6`). Pink (Tailwind `pink-100` / `pink-800` / `pink-500`) is immediately distinct from all 8 other status colors, passes contrast requirements for text-on-badge, and matches the UX brief.

**Alternatives considered**:
- Teal/cyan: Not semantically aligned with "Wishlist" (passive, aspirational).
- Yellow-green: Too close to Interview (yellow family).
- Pink confirmed as unambiguous and semantically appropriate.

---

## Decision 2: Salary Storage and Display

**Decision**: Store salary as a plain integer in the database (e.g., `150000`). Create a new `formatPeso(value)` utility in `src/utils/currency.js` that renders `₱150,000`. Seed data migrated from legacy string ranges to single numeric values. Salary filter slider uses ₱50,000 as minimum and ₱250,000+ as the upper bucket.

**Rationale**: Existing salary data is stored as strings (e.g., `"$120,000 – $140,000"`). Converting to numeric enables proper range filtering without string parsing, removes currency ambiguity for the target user (Philippines), and allows a clean reusable display formatter. The existing `parseSalaryLower()` / `parseSalaryRange()` logic in `filterSort.js` can be simplified once salary is always numeric.

**Alternatives considered**:
- Keep strings and parse at display time: fragile and harder to filter accurately.
- Store cents (e.g., `15000000`): unnecessary precision for salary at this domain scale.
- Numeric integer chosen as simplest correct approach with clean migration path.

---

## Decision 3: Favorites Filter Persistence

**Decision**: Persist the full filter state (including the new `favoritesOnly` boolean) to `localStorage` under the key `'apptracker_filters'` in `src/pages/Tracker.js`. Load on mount; write on every filter state change.

**Rationale**: The application already has a `store.js` that historically used localStorage for application records (now deprecated in favor of the server API). Filter preferences are purely local UI state — they do not belong on the server for a local-first single-user app. localStorage is sufficient, already available, and requires no API changes.

**Alternatives considered**:
- Server-side filter state: over-engineered for a single-user local-first app.
- Session storage: does not survive tab close or page reload.
- URL query params: adds URL management complexity not needed for this scope.

---

## Decision 4: Archive Confirmation / Undo Pattern

**Decision**: Implement archive as an immediate action with a toast-based undo affordance rather than a confirmation modal. Extend `Toast.js` to accept an optional `undoCallback` that renders an "Undo" button within the auto-dismiss window (2400ms). If undo is not activated, the archive is committed via `PATCH /api/applications/:id`.

**Rationale**: A confirmation modal adds an extra interaction for a reversible action and blocks the UI. The toast-with-undo pattern (widely familiar from Gmail, Slack) is lower-friction — it proceeds immediately and gives a short recoverability window. The existing Toast component (`src/components/Toast.js`) already has the dismiss timer and z-index infrastructure; an optional callback button is a minimal extension.

**Alternatives considered**:
- `window.confirm()` dialog: blocking, unstyled, inconsistent across browsers.
- Custom confirmation modal: extra component, extra interaction, not needed for a reversible action.
- Persistent undo button in the overlay: requires overlay to remain open during the undo window.

---

## Decision 5: Slider Label Overlap Fix

**Decision**: Show the value label only on the thumb currently being dragged (active thumb). At rest, show both labels only when they are far enough apart to avoid overlap; otherwise show only the upper-bound value. This is implemented entirely within `RangeSlider.js` with a pixel-distance threshold check.

**Rationale**: Overlap occurs when both thumbs are close together. Showing only the active thumb's label during drag is the smallest change to `RangeSlider.js` that eliminates overlap at all positions. It matches common slider UX patterns without requiring CSS layout restructuring or precision-reducing step snapping.

**Alternatives considered**:
- Reposition labels above the slider track: requires CSS rework and may clip at slider edges.
- Snap to predefined steps (e.g., ₱10,000 increments): reduces overlap but restricts user control.
- Show-on-active approach chosen as cleanest minimal fix.

---

## Decision 6: FAB Scope (Mobile Breakpoint Only)

**Decision**: Render the FAB only at mobile viewport widths (≤ 768px) via CSS media query. At those widths, the "New Application" button in the subheader is hidden and the FAB replaces it. On desktop, no change.

**Rationale**: The FAB is a mobile-native pattern. The desktop layout already works well with the subheader button. Toggling via CSS media query avoids any JavaScript viewport detection and is instantly responsive to resize events.

**Alternatives considered**:
- FAB on all screen sizes: disrupts the well-established desktop layout.
- JavaScript-driven show/hide: adds runtime overhead unnecessarily.

---

## Decision 7: Copy Link Icon (SVG from Existing Set)

**Decision**: Replace the emoji currently used for the copy-link action in `Card.js` with an inline SVG icon. The project already uses inline SVG icons in several components; the same pattern and size convention will be applied to the copy icon.

**Rationale**: Emoji render inconsistently across platforms (especially Windows vs. macOS vs. Android) and cannot be styled with CSS (color, hover states, size normalization). Inline SVG is already the project's icon pattern and carries zero new dependencies.

**Alternatives considered**:
- External icon library (Font Awesome, Heroicons via CDN): introduces a new dependency with no benefit given inline SVG already works.
- Unicode symbols: same platform-inconsistency problem as emoji.
