# Feature Brief: 042 - Welcome Page & Brand Refresh

## Summary
Modernize Project Alice's unauthenticated welcome/login page, brand assets, and in-app processing loaders using the new "midnight galaxy" visual theme. This includes redesigning the layout, integrating updated logo assets, replacing all application icons with a new unified SVG set, implementing a high-fidelity animated showcase carousel, and upgrading the full-screen in-app LLM processing loaders.

---

## Included Issues & Design Handoffs

| Issue | Title | Claude Design Handoff Package | Extracted Source Path |
| :--- | :--- | :--- | :--- |
| **#104** | Enhancement: Replace all icons with the newly designed one | `Alice_Icons_Graphics.zip` | `design_handoffs/Alice_Icons_Graphics/handoff/` |
| **#105** | Enhancement: Update Alice's logo | `Alice_new_logo.zip` | `design_handoffs/Alice_new_logo/favicon/` |
| **#106** | Enhancement: Redesign deployed welcome page for modern aesthetics and interactivity | `Alice_Welcome_Redesign.zip` | `design_handoffs/Alice_Welcome_Redesign/design_handoff_welcome_page/` |
| **#110** | Enhancement: Update the design of the full-screen loaders | `Alice_InAppLoader.zip` | `design_handoffs/Alice_InAppLoader/design_handoff_inapp_loaders/` |

---

## Goals
- Redesign the welcome page layout to support desktop, tablet portrait, and mobile portrait modes.
- Integrate the new brand logo assets (`alice-sigil-full.svg` and `alice-sigil-full-white.svg`) across all pages, footers, navbars, and welcome scenes.
- Update all system SVG icons (`src/assets/icons/` and `src/utils/icons.js`) with the new unified icon paths.
- Integrate new empty-state illustrations (`calendar-quiet.svg`, `calendar-empty.svg`, `profile-empty.svg`) into their designated places across ActionPanel, DayPanel, and Profile.
- Recreate the animated showcase carousel (with 5 storytelling scenes: Constellation, Parse, Pipeline, Momentum, Deck) and progress/dot navigation.
- Implement responsive, height-locked (`100dvh`, no-scroll) layouts for mobile and tablet screens.
- Enhance the Auth overlay forms (sign-in, registration, demo) with modern visuals (glassmorphism), clean error boundaries, and transitions.
- Recreate the in-app LLM processing overlays (for resume/job description parsing) to match the new visual patterns (centered gold spinner orbiting the Alice sigil, status line, and desktop-only rotating edge glow).
- Ensure loader elements support dynamic status reporting and accessibility (`role="status"`, `aria-live="polite"`, `aria-busy="true"`).

---

## Non-Goals
- Introducing a client-side URL-path router (continue using standard tab/state-switching).
- Incorporating bloated external icon libraries (e.g. FontAwesome, Lucide); keep SVG icons inline or locally defined.
- Porting the Babel/React Tweaks panel from the reference prototype into the production bundle.
- Redesigning the startup boot loader screen (that is covered by Feature 044).

---

## User Experience
- **Desktop Grid**: Displays brand signature, main headline with gradient underline, and CTA buttons (Sign in, Create account, Try the demo) next to the animated showcase stage.
- **Showcase Carousel**: Cycles through 5 high-fidelity scenes with a duration of 8.6 seconds each, synced to progress indicator dots.
- **Tablet / Mobile Viewports**: Enforces a height-locked viewport (`100dvh`) without page scroll, scaling layout elements cleanly.
- **Auth Overlay Modal**: A modal dialogue that opens for Sign in or Sign up, displaying validation feedback and transitioning to success or mail verification instructions.
- **In-App Processing Overlay**: Appears as a full-screen dimmed/blurred backdrop (`rgba(244, 241, 236, .96)` + 6px blur) blocking interaction during LLM parsing. Features a centered 96px hit area with the static Alice sigil and a gold partial-ring spinner orbiting it (0.6s rotation). Shows warm status text ("Getting to know your background", etc.). Supports the desktop-only rotating edge glow (disabled on tablet/mobile and reduced motion).

---

## Functional Requirements

### 1. Logo & Favicon Integration (Issue #105)
- Replace existing header and welcome logo placeholders with the new designs:
  - `alice-sigil-full.svg` (supersedes `Alice_Colored.png`)
  - `alice-sigil-full-white.svg` (supersedes `Alice_White.png`)
- Replace `public/favicon-32x32.png` with the new design, selecting the best-matching dimensions from the favicon set.

### 2. SVG Asset & Empty-State Replacement (Issue #104)
- Update SVG paths for:
  - `src/assets/icons/compatibility.svg`
  - `src/assets/icons/empty-pane-icon.svg`
  - `src/assets/icons/notes-links.svg`
  - `src/assets/icons/overview.svg`
  - `src/assets/icons/skills.svg`
  - `src/assets/icons/timeline.svg`
- Update `createClipboardIcon()`, `createArchiveIcon()`, and `createSvgIcon()` in `src/utils/icons.js` to match the new icon set style.
- Wire new empty-state illustrations across app files (preventing inline duplicates):
  - **`illustrations/calendar-quiet.svg`**: Use for `ActionPanel.js` dashboard empty states (today, suggestions, upcoming).
  - **`illustrations/calendar-empty.svg`**: Use for `DayPanel.js` compact empty states (select a day, no events prompt).
  - **`illustrations/profile-empty.svg`**: Use for `Profile.js` empty avatar placeholder, deleting old head/body span styles.

### 3. In-App Processing Loader (Issue #110)
- Update `src/components/ResumeImport.js` and `src/components/JobPostingImport.js` to render the redesigned full-screen overlay during LLM operations.
- Implement the dimmed/blurred backdrop (`rgba(244, 241, 236, .96)` + 6px blur).
- Build the SVG spinner ring: a gold partial-ring (dasharray `"52 155"`) orbiting the 64px sigil with a 6px blurred glow copy and a 2px core arc (0.6s linear rotation).
- Apply desktop-only (viewport ≥ 900px) rotating edge glow; fallback to static box-shadow on tablet/mobile viewports to prevent diagonal line folding.
- Update status messages to use warm, non-mechanical copy.

---

## Technical Notes
- Follow existing Vanilla JS + Vite component patterns.
- Reuse CSS custom properties for styling tokens.
- Support a motion toggle or media query detection for users requesting reduced motion, disabling both spinner-ring and edge-glow rotation.
- Do not apply the rotating conic-gradient glow below ~900px viewport width (verified to produce a hard diagonal seam on portrait aspect ratios).
- Do not switch the desktop mask from `circle` to `ellipse` to keep the circular-mask implementation consistent.

---

## Edge Cases
- Viewports with extremely short heights (height-locking must adjust spacing or scale components down to prevent vertical clipping).
- Stale or cached favicons and image assets in browser storage.
- Form inputs containing invalid email addresses or passwords under 8 characters showing proper touch-based validation warnings.
- Hard diagonal seams or folding of the rotating conic-gradient glow on tablet/mobile portrait aspect ratios (resolved by disabling rotation below 900px).
- Assistive technology readability of dynamic initialization steps.

---

## Success Criteria
- Deployed welcome page looks pixel-perfect and responds cleanly to resizing.
- All logo and icon assets render correctly without broken links or style mismatches.
- Keyboard navigation and accessibility tags are intact across the welcome page and forms.
- In-app loaders transition and animate correctly, honoring reduced-motion.
- Status updates are announced properly by screen readers (`aria-live`).
- All unit, integration, and build tests pass cleanly.
