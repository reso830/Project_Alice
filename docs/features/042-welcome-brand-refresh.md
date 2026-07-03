# Feature Brief: 042 - Welcome Page & Brand Refresh

## Summary
Modernize Project Alice's unauthenticated welcome/login page and brand assets using the new "midnight galaxy" visual theme. This includes redesigning the layout, integrating updated logo assets, replacing all application icons with a new unified SVG set, and implementing a high-fidelity animated showcase carousel.

---

## Goals
- Redesign the welcome page layout to support desktop (2-column diagonal/split/stack grid), tablet portrait, and mobile portrait modes.
- Integrate the new brand logo assets (`Alice_Colored.png` and `Alice_White.png`) across all pages, footers, navbars, and welcome scenes.
- Update all system SVG icons (`src/assets/icons/` and `src/utils/icons.js`) with the new unified icon paths.
- Recreate the animated showcase carousel (with 5 storytelling scenes: Constellation, Parse, Pipeline, Momentum, Deck) and progress/dot navigation.
- Implement responsive, height-locked (`100dvh`, no-scroll) layouts for mobile and tablet screens.
- Enhance the Auth overlay forms (sign-in, registration, demo) with modern visuals (glassmorphism), clean error boundaries, and transitions.

---

## Non-Goals
- Introducing a client-side URL-path router (continue using standard tab/state-switching).
- Incorporating bloated external icon libraries (e.g. FontAwesome, Lucide) if not already used; keep SVG icons inline or locally defined.
- Porting the Babel/React Tweaks panel from the reference prototype into the production bundle.

---

## User Experience
- **Desktop Grid**: Displays brand signature, main headline with gradient underline, and CTA buttons (Sign in, Create account, Try the demo) next to the animated showcase stage.
- **Showcase Carousel**: Cycles through 5 high-fidelity scenes with a duration of 8.6 seconds each, synced to progress indicator dots.
- **Tablet / Mobile Viewports**: Enforces a height-locked viewport (`100dvh`) without page scroll, scaling layout elements cleanly.
- **Auth Overlay Modal**: A modal dialogue that opens for Sign in or Sign up, displaying validation feedback and transitioning to success or mail verification instructions.

---

## Functional Requirements
- **Logo Integration**: Replace existing header and welcome logo placeholders with `Alice_White.png` and `Alice_Colored.png`.
- **Favicon Integration**: Replace `public/favicon-32x32.png` with the new design.
- **SVG Asset Replacement**: Update SVG paths for:
  - `src/assets/icons/compatibility.svg`
  - `src/assets/icons/empty-pane-icon.svg`
  - `src/assets/icons/notes-links.svg`
  - `src/assets/icons/overview.svg`
  - `src/assets/icons/skills.svg`
  - `src/assets/icons/timeline.svg`
- **Utility SVG Updates**: Update `createClipboardIcon()`, `createArchiveIcon()`, and `createSvgIcon()` in `src/utils/icons.js` to match the new icon set style.

---

## Technical Notes
- Follow existing Vanilla JS + Vite component patterns.
- Reuse CSS custom properties for styling tokens.
- Support a motion toggle or media query detection for users requesting reduced motion.

---

## Edge Cases
- Viewports with extremely short heights (height-locking must adjust spacing or scale components down to prevent vertical clipping).
- Stale or cached favicons and image assets in browser storage.
- Form inputs containing invalid email addresses or passwords under 8 characters showing proper touch-based validation warnings.

---

## Success Criteria
- Deployed welcome page looks pixel-perfect and responds cleanly to resizing.
- All logo and icon assets render correctly without broken links or style mismatches.
- Keyboard navigation and accessibility tags are intact across the welcome page and forms.
- All unit, integration, and build tests pass cleanly.
