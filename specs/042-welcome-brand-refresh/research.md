# Research & Tech Decisions: Welcome Page & Brand Refresh

This document records the technical investigations and architectural decisions for implementing Feature 042.

---

## 1. Icon Standardization Strategy (Issue #104)

### Decision
Standardize all application icons into a unified 24x24 viewBox, line-drawing format using a drop-in replacement for `src/utils/icons.js`. Remove duplicate inline SVG definitions scattered across multiple component files and replace them with standard calls to `icon(name)`.

### Rationale
- Today, `QuickFiltersToolbar.js`, `Card.js`, `Modal.js`, and `ProfileEdit.js` duplicate raw SVG path data locally. This leads to configuration drift and visual inconsistency.
- The new `src/utils/icons.js` provides:
  - An array-aware SVG path generator (`createSvgIcon(paths)`) to support complex multi-path line art.
  - A clean lookup table `ICON_PATHS` containing standard paths.
  - A convenience function `icon(name)` which constructs the DOM node dynamically.
- Performance: Clean, programmatically-generated SVGs are lightweight and inherit their styling color via `stroke="currentColor"`, maintaining full theme flexibility.

### Alternatives Considered
- *Using Lucide or FontAwesome*: Rejected. Introducing external icon packages adds bundle overhead and goes against Feature Non-Goals (FR-010 local-first/no external bloat).
- *Keeping Inline SVGs*: Rejected. Keeping local SVG paths leads to visual drift and blocks standard styling updates.

---

## 2. Brand Asset Restructuring (Issue #105)

### Decision
Create two new subfolders `logo/` and `graphics/` under `src/assets/` to organize logo vector files and empty-state illustrations cleanly:
- `src/assets/logo/alice-sigil-full.svg` (replaces `Alice_Colored.png`)
- `src/assets/logo/alice-sigil-full-white.svg` (replaces `Alice_White.png`)
- `src/assets/graphics/` (contains empty-state illustrations: `calendar-quiet.svg`, `calendar-empty.svg`, `profile-empty.svg`)
Update all component imports (`Navbar.js`, `Footer.js`, `ConfigError.js`, `WelcomePage.js`, `SceneDeck.js`, `AuthOverlay.js`) and tests to load from these structured directories.

### Rationale
- Keeping all PNG and SVG files in a flat `src/assets/` folder is hard to maintain.
- Separation of concerns: `logo` stores corporate branding marks, `graphics` stores user-facing illustrations, and `icons` stores system controls line-icons.
- SVGs scale pixel-perfectly without pixelation and have a much smaller file footprint than PNGs.

---

## 3. Showcase Carousel Porting (Issue #106)

### Decision
Port the React-based carousel prototype (`prototype/wr-hero.jsx`) into the production Vanilla JS module `src/pages/welcome/HeroSlideshow.js`. 
- Structure: Recreate the 5 scenes (Constellation, Parse, Pipeline, Momentum, Deck) as Vanilla JS template generators.
- Cycle Logic: Use standard `setInterval` at 8600ms.
- Progress Sweep: Set CSS animation custom variables or keyframe progress matching `animation-duration: 8600ms`.
- Dot Jump: Clicking a dot clears the interval, transitions to the selected scene, and resets the auto-advance timer.
- Motion Control: Read the system `prefers-reduced-motion` media query. If reduced-motion is active, disable all intervals, progress sweeps, and slide transitions, rendering the carousel immediately in its settled/final states.

### Rationale
- Recreating the prototype pixel-for-pixel keeps the premium "midnight galaxy" aesthetics intact.
- Gating carousel actions to a global motion checker ensures accessibility compliance (FR-011).

---

## 4. In-App LLM Processing Overlays (Issue #110)

### Decision
Standardize full-screen loaders for LLM processing operations in `ResumeImport.js` and `JobPostingImport.js`.
- Layout: Dimmed, blurred background overlay (`rgba(244, 241, 236, .96)` + 6px backdrop blur).
- Centered Spinner: A 96px container hosting the static 64px Alice sigil, encircled by a gold spinner ring (SVG circle with stroke-dasharray `"52 155"`) rotating continuously at 0.6s per revolution.
- Edge Glow: Layer a static box-shadow (`3D1A8A` purple + `F4A71F` gold) along the edges. For desktop viewports (≥900px), overlay a rotating conic-gradient layer. Remove the rotating conic layer on tablet and mobile viewports to prevent diagonal line folding.
- Status Text: Accessible title (16px, Sora 700) and subtitle (13px, Sora 400). Title and subtitles map to the selected Option A (warm/conversational copy).
- Accessibility: Apply `role="status"` and `aria-live="polite"` to the status line, and `aria-busy="true"` on the overlay container.

### Rationale
- The edge glow conic-gradient looks great on desktop but folds awkwardly on portrait viewports. Disabling rotation below 900px avoids visual bugs.
- Incorporating `aria-live` ensures assistive readers are immediately notified of background progress changes.
