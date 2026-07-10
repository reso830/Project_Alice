# Feature Specification: Welcome Page & Brand Refresh

**Feature Branch**: `042-welcome-brand-refresh`  
**Created**: 2026-07-04  
**Status**: Draft  
**Input**: docs/features/2.0.0-smart-intake-ai-assistance/042-welcome-brand-refresh.md

---

## Clarifications

### Session 2026-07-04

- **Q: Startup Loader Scope** $\rightarrow$ A: **In-app loaders only**. Startup loader is out of scope for Issue #110 and will be covered under Feature 044 (Hosted Startup Performance). Issue #110 in Feature 042 strictly covers the in-app full-screen loaders displayed during JD/resume parsing.
- **Q: Dynamic In-App Loader Status Messages** $\rightarrow$ A: **Option A (Informal & Tone-focused)**:
  - **Resume Import**: Title: *"Getting to know your background"*, Subtitle: *"Alice is reading through your experience"*
  - **Job Posting Import**: Title: *"Making sense of the posting"*, Subtitle: *"Alice is pulling out the role details"*
- **Q: Logo Usage Rules & Dimensions** $\rightarrow$ A:
  - **Footer**: Always uses the full-color, full-sized logo/sigil (`alice-sigil-full.svg`) scaled to **40×40px** (`object-fit: contain`).
  - **Navbar**: Uses the all-white version of the sigil (`alice-sigil-full-white.svg`) scaled to **38×38px**.
  - **Favicon**: Replaces `public/favicon-32x32.png` (browser-tab icon) with the 32×32 variant, and additionally adds `public/favicon.ico` (legacy bare `/favicon.ico` requests), `public/favicon.svg` (scalable / pinned-tab icon), and `public/apple-touch-icon.png` (iOS home screen). All are sourced from the handoff favicon set — the purpose-built **simplified** marks, **not** the full sigil (`alice-sigil-full.svg`), which is too detailed to remain legible at favicon sizes.
  - **Welcome Page**: Displays the full-color sigil (`alice-sigil-full.svg`) across all welcome themes (warm/white/navy) and mobile viewports. Per the design prototype the color emblem reads on both light and dark backgrounds (`sigilPitch = SIGIL_COLOR` — "Enchanted emblem reads on both light & dark"), so the navy theme keeps the color sigil rather than a white variant. (Supersedes the earlier white-sigil-on-navy + `SceneDeck.js` white-sigil rule — the redesigned showcase scenes embed no sigil.)
  - **Auth Overlay Modal**: Uses the full-color sigil (`alice-sigil-full.svg`) in the header scaled to **40×40px**.
  - **Config Error Page**: Uses the white sigil (`alice-sigil-full-white.svg`) scaled to **40×40px**.
- **Q: Asset Housekeeping & Directory Cleanup** $\rightarrow$ A: Create separate `logo` and `graphics` directories under `src/assets/` to organize brand mark and illustration assets properly:
  - Brand logo vector SVGs go under `src/assets/logo/`
  - Empty-state illustrations go under `src/assets/graphics/`
  - System utility SVG icons remain in `src/assets/icons/`
- **Q: Mobile Showcase Layout (≤620px)** $\rightarrow$ A: **Responsive Capped Stage**:
  - **Mobile Landscape**: Allowed to scroll vertically to prevent clipping.
  - **Mobile Portrait (width ≤620px)**:
    - If viewport height is **< 600px**: Scale down the showcase carousel stage frame height to **110px**, condense margins/paddings, and hide the mini-footer links to ensure the height-locked `100dvh` layout does not clip.
    - If viewport height is **≥ 600px**: Keep the showcase carousel stage frame height at **158px** (Option B from handoff).

---

## Problem Statement

Project Alice's current welcome and login page, brand logo assets, system icons, and in-app loading indicators need a visual refresh to transition from early prototyping styles to a premium, production-ready "midnight galaxy" visual theme.

Specifically, the welcome page lacks responsiveness and visual branding depth. Icons across the application are hardcoded and inconsistent. Finally, full-screen in-app loaders displayed during long-running LLM JD/resume parsing are light-only, lack dark-mode compatibility, and feature static or repetitive animations.

To establish visual excellence, this feature will standardize icons across the codebase, replace png placeholders with vector logo designs, rebuild the welcome page with a responsive layout and storytelling showcase carousel, and update the full-screen in-app loaders with ambient animations, accessible live-status reporting, and smooth fade-out exit transitions.

---

## Scope

### In Scope

- **Asset Housekeeping**:
  - Re-organize assets under `src/assets/`:
    - `src/assets/logo/alice-sigil-full.svg` (supersedes `Alice_Colored.png`)
    - `src/assets/logo/alice-sigil-full-white.svg` (supersedes `Alice_White.png`)
    - `src/assets/graphics/` (empty-state illustrations: `calendar-quiet.svg`, `calendar-empty.svg`, `profile-empty.svg`)
    - `src/assets/icons/` (standard utility SVG icons)
- **Responsive Welcome Layout**: Update `src/pages/welcome/WelcomePage.js` to support:
  - **Desktop (>900px)**: Two-column grid (left pitch, right animated showcase).
  - **Tablet Portrait (621–900px)**: Height-locked flex column with a scaled-down showcase.
  - **Mobile Portrait (≤620px)**: Height-locked flex-column layout with a capped showcase stage frame (158px height on viewports ≥600px, scaled down to 110px on viewports <600px with condensed margins/paddings and hidden footer) and stacked buttons. Mobile landscape allows vertical scrolling.
- **Brand Logo & Favicon Refresh**:
  - Replace instances of `Alice_Colored.png` and `Alice_White.png` in global views (Navbar, Footer, welcome page, auth overlay, config error, and hero slideshow) with the new vector designs.
  - Replace `public/favicon-32x32.png` (tab icon) and add `public/favicon.ico`, `public/favicon.svg`, and `public/apple-touch-icon.png` for legacy, scalable/pinned-tab, and iOS surfaces respectively. Wire all four into `index.html`'s `<head>`. Use the handoff's simplified favicon marks, not the full sigil.
- **Showcase Carousel**:
  - Implement an auto-cycling carousel (8.6s per scene) with 5 high-fidelity scenes: Constellation, Parse, Pipeline, Momentum, and Deck.
  - Include navigation dots displaying active sweep progress and a toggle for reduced motion.
- **Auth Overlay Modal**:
  - Redesign email/password login and signup forms with glassmorphism, password peek, touched validation, and success/verification transitions.
- **Standardized Line Icons**:
  - Replace hardcoded SVG icon paths across `Card.js`, `Modal.js`, `QuickFiltersToolbar.js`, and `ProfileEdit.js` with the unified 24x24 line-icon registry from the new `src/utils/icons.js`.
  - Wire empty-state illustrations (`calendar-quiet.svg`, `calendar-empty.svg`, `profile-empty.svg`) across designated app views.
- **In-App LLM Processing Overlays**:
  - Implement full-screen dimmed/blurred backdrops with a centered gold spinner (0.6s linear rotation around a 64px sigil) for `ResumeImport.js` and `JobPostingImport.js`.
  - Constrain rotating edge glow to desktop viewports (≥900px) only.

### Non-Goals

- **No Client-Side URL-Path Router**: Standard tab/state-switching remains active; no router library will be introduced.
- **No External Icon Libraries**: Do not add FontAwesome, Lucide, or other external icon dependencies.
- **No Tweaks Panel**: The design-review Tweaks panel from the prototype must not be compiled or shipped in the production bundle.
- **No Startup Loader Redesign**: Redesign of the startup boot loader screen is covered by Feature 044.

---

## User Behavior

### 1. Welcome Page Navigation
- The user lands on the welcome page.
- On desktop, they see the brand wordmark, an em-underlined headline, CTAs, and a cycling showcase of features. Hovering on buttons triggers smooth translateY and lift animations.
- On smaller viewports (tablet/mobile), the layout locking keeps the CTAs visible and eliminates vertical page scrolling.
- Clicking "Sign in" or "Create account" slides the Auth modal into view. If they click "Try the demo", a toast message (or demo redirection) is shown.

### 2. In-App Loading
- When uploading a resume or pasting a job posting, the user is presented with a full-screen blurred backdrop containing a gold ring spinner and status line. Interaction with the app is disabled until processing completes.

---

## Acceptance Criteria

### User Story 1: Brand Refresh & Responsive Welcome Layout (Priority: P1)
- **As a** visitor, **I want** to view a responsive, modern welcome page, **so that** I can sign in or explore the application on any device.
- **Why this priority**: Core landing page and brand identity.
- **Independent Test**: Open the welcome page in a browser. Resize the window across breakpoints (>900px, 621–900px, and ≤620px) to verify responsive layouts, height-locking, asset scaling, and the logo file updates.
- **Acceptance Scenarios**:
  - **Given** the welcome page loads, **When** the viewport width is >900px, **Then** the page renders as a two-column grid with grid line decorations and the showcase carousel.
  - **Given** the welcome page loads, **When** the viewport width is ≤620px (mobile), **Then** it renders a single-column layout, stacks buttons, allows vertical scrolling if in landscape, and locks portrait viewport height to `100dvh` (scaling the showcase stage to 158px for heights ≥600px, and scaling it to 110px with condensed margins and hidden footer links for heights <600px).
  - **Given** the navbar or welcome header renders, **When** loading brand marks, **Then** the vector files `alice-sigil-full.svg` and `alice-sigil-full-white.svg` are displayed with correct CSS dimensions.

### User Story 2: Standardized Line Icons & Illustrations (Priority: P2)
- **As an** active user, **I want** to see consistent icons and illustrations across the application, **so that** I can intuitively navigate features.
- **Why this priority**: Improves visual consistency and usability of core tracking controls.
- **Independent Test**: Open the Tracker and Profile pages. Verify all status, action, sorting, and filter icons match the new 24x24 line-icon family and that no two filters share the same icon.
- **Acceptance Scenarios**:
  - **Given** a job card or application details modal, **When** rendering actions, **Then** icons for Edit, Change Status, Copy URL, Star, Archive, Unarchive, and Close are built from `src/utils/icons.js` paths.
  - **Given** the `src/components/calendar/ActionPanel.js`, `src/components/calendar/DayPanel.js`, or `src/pages/Profile.js` has no data / needs illustration, **When** rendering empty states, **Then** the designated SVGs (`calendar-quiet.svg`, `calendar-empty.svg`, or `profile-empty.svg`) render at their correct target dimensions.

### User Story 3: High-Fidelity Showcase Carousel (Priority: P2)
- **As a** visitor, **I want** to see an animated showcase of Project Alice's features, **so that** I can quickly understand the product value.
- **Why this priority**: Key brand onboarding and narrative element.
- **Independent Test**: View the showcase carousel. Let it cycle through all 5 scenes, click navigation dots to manual-jump, and toggle reduced motion in system settings to confirm all animations pause.
- **Acceptance Scenarios**:
  - **Given** the welcome page is active, **When** motion is enabled, **Then** the showcase cycles through Constellation, Parse, Pipeline, Momentum, and Deck every 8.6s, and the active dot displays sweep progress.
  - **Given** a scene is active, **When** a user clicks a dot, **Then** the carousel immediately jumps to that scene, resets the timer, and pauses auto-advance until the next interval.
  - **Given** `prefers-reduced-motion: reduce` is detected, **When** the showcase renders, **Then** all animations, card transformations, and slides are disabled, showing only the static settled state.

### User Story 4: Dynamic Full-Screen Loaders (Priority: P3)
- **As a** user, **I want** to see a responsive, premium loader screen during LLM processing, **so that** I know the app is active.
- **Why this priority**: Essential to cover long-running parser operations without losing user trust.
- **Independent Test**: Trigger a resume upload or a job posting paste. Verify the blurred backdrop, centered gold spinner orbiting the Alice sigil, status text updates, and desktop-only rotating edge glow.
- **Acceptance Scenarios**:
  - **Given** an in-app LLM parse is triggered, **When** rendering the overlay, **Then** the rotating edge glow is rendered only if the viewport is ≥900px wide.
  - **Given** the in-app loader is active, **When** status updates are pushed, **Then** the text updates inline and is announced via screen readers using `aria-live="polite"`.
  - **Given** parsing completes, **When** transitioning back to the form, **Then** the loader overlay fades out over 400ms using a CSS opacity transition, and then unmounts once the opacity reaches 0.

---

## Edge Cases

- **Viewports with extremely short heights**: The CSS layout must use media queries to scale spacing, decrease logo sizes, or hide less critical copy (e.g. sub-copy or footer elements) to prevent vertical layout clipping.
- **Reduced Motion Settings**: Ensure that setting `prefers-reduced-motion` immediately disables both the 0.6s spinner-ring and 9s edge-glow rotation on loader screens.
- **Diagonal Glow Seam on Mobile**: Conic-gradient rotation produces diagonal seams on narrow viewport aspect ratios. The rotating edge glow must be disabled on tablet (≤900px) and mobile.

---

## Data Considerations

- **Local-First Privacy**: No user credentials, session info, or parsed document data should be sent to third-party analytics or tracker services.
- **Metadata Configuration**: System version and legal issue links must be sourced from the centralized `src/pages/welcome/shared/appMeta.js` settings to prevent configuration drift.
