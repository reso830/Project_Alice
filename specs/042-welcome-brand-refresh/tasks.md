# Tasks: Welcome Page & Brand Refresh

**Feature**: `042-welcome-brand-refresh` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small, ordered, and specific. `[P]` marks parallelizable tasks. Status legend: `[x]` done · `[ ]` pending · `[~]` skipped.
Commands: `npm run test:run`, `npm run lint`.

Phase dependency: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09

## Phase summary

| Phase | Focus | Tasks | Stories |
|---|---|---|---|
| 01 | Setup (Assets Staging & Housekeeping) | T001–T002 | Initialize folder structure & stage handoff files |
| 02 | Foundational (Icon Registry Utility) | T003–T004 | Update line-icon registry factory & back-compat helpers |
| 03 | User Story 1 (Welcome Page Layout & Logos) | T005–T011 | P1 (Responsive viewports, Navbar/Footer, and config logo routes) |
| 04 | User Story 2 (Icons & Illustrations Swaps) | T012–T017b | P2 (Toolbar, Card, Modal, Profile, CreationPicker, and empty-state graphics) |
| 05 | User Story 3 (Showcase Carousel) | T018–T020 | P2 (Animated scenes cycles, SceneDeck SVG, and reduced-motion) |
| 06 | User Story 4 (Auth Redesign & LLM Loaders) | T021–T024 | P3 (Auth form validation, and full-screen in-app loader overlays) |
| 07 | Polish & Test Suite Updates | T025–T026 | Visual alignments & Vitest mocking updates |
| 08 | Release Prep | T027–T031 | SemVer bump, roadmaps, changelogs, and REPO_MAP refresh |
| 09 | Browser Smoke Test | T032–T035 | Verify user journeys on physical browser |

---

## Phase 01: Setup (Assets Staging & Housekeeping)

**Purpose**: Create asset subfolders and stage vector designs and illustrations from Claude Design handoffs.

- [ ] T001 Initialize logo and graphics directories under `src/assets/`
  - **Target**: `src/assets/logo/` and `src/assets/graphics/` (new directories)
  - **Expected behavior**: Directories are created to isolate branding marks and graphics illustrations.
  - **Validation/test**: Verify directories exist on disk.
  - **Out of scope**: Modifying existing png logos.

- [ ] T002 Copy brand marks, empty-states, and favicons from `design_handoffs/`
  - **Target**: `src/assets/logo/`, `src/assets/graphics/`, and `public/`
  - **Expected behavior**: 
    - Copy `design_handoffs/Alice_new_logo/favicon/alice-sigil-full.svg` to `src/assets/logo/`
    - Copy `design_handoffs/Alice_new_logo/favicon/alice-sigil-full-white.svg` to `src/assets/logo/`
    - Copy `design_handoffs/Alice_Icons_Graphics/handoff/illustrations/*.svg` to `src/assets/graphics/`
    - Copy `design_handoffs/Alice_new_logo/favicon/favicon-32.png` to `public/favicon-32x32.png` (overwrite existing)
    - Copy `design_handoffs/Alice_new_logo/favicon/favicon.ico` to `public/favicon.ico` (new file — `public/favicon.ico` does not currently exist)
    - Copy `design_handoffs/Alice_new_logo/favicon/favicon.svg` to `public/favicon.svg` (new file)
    - Copy `design_handoffs/Alice_new_logo/favicon/apple-touch-icon.png` to `public/apple-touch-icon.png` (new file)
    - Do **not** copy the full sigil as a favicon; only the simplified favicon marks above.
  - **Validation/test**: Verify all files exist in their target directories.

- [ ] T002a Wire the favicon set into `index.html`'s `<head>`
  - **Target**: [index.html](../../index.html)
  - **Expected behavior**: Replace the single `favicon-32x32.png` link with the four-asset block, ordered as fallback-first:
    ```html
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    ```
  - **Validation/test**: Load the app; confirm the tab icon renders and there is no `GET /favicon.ico` 404 in the network log.

---

## Phase 02: Foundational (Icon Registry Utility)

**Purpose**: Drop in the new standardized line-icon registry factory in `icons.js`.

- [ ] T003 Integrate standardized line-icon registry in `src/utils/icons.js`
  - **Target**: [src/utils/icons.js](../../src/utils/icons.js)
  - **Expected behavior**: Replace `src/utils/icons.js` with the contents of `design_handoffs/Alice_Icons_Graphics/handoff/icons.js`. Expose `createSvgIcon`, `ICON_PATHS`, `icon(name)` registry, and back-compat shim functions.
  - **Constraints**: Ensure no compiler/module errors are thrown.
  - **Validation/test**: Check exports resolve correctly.

- [ ] T004 Validate line-icon registry shim exports
  - **Target**: [src/utils/icons.js](../../src/utils/icons.js)
  - **Expected behavior**: Backwards-compatible `createArchiveIcon()` and `createClipboardIcon()` export shims return valid SVG elements with correct classes.
  - **Validation/test**: Verify existing components calling the shims compile without errors.

---

## Phase 03: User Story 1 (Welcome Page Layout & Logos)

**Purpose**: Rebuild the welcome page layout responsiveness and integrate brand vector logos across global views.

- [ ] T005 [P] [US1] Update global navigation bar logo
  - **Target**: [src/components/Navbar.js](../../src/components/Navbar.js)
  - **Expected behavior**: Replace `Alice_White.png` import with `src/assets/logo/alice-sigil-full-white.svg`. Render the SVG image at a fixed **38×38px** size.
  - **Validation/test**: Verify Navbar logo renders correctly in development browser.

- [ ] T006 [P] [US1] Update global footer brand logo
  - **Target**: [src/components/Footer.js](../../src/components/Footer.js)
  - **Expected behavior**: Replace `Alice_White.png` import with `src/assets/logo/alice-sigil-full.svg`. Render the full-color SVG at **40×40px** (`object-fit: contain`).
  - **Validation/test**: Verify Footer logo matches visual specs.

- [ ] T007 [P] [US1] Update Config Error page logo
  - **Target**: [src/pages/ConfigError.js](../../src/pages/ConfigError.js)
  - **Expected behavior**: Replace `Alice_White.png` import with `src/assets/logo/alice-sigil-full-white.svg` at **40×40px**.
  - **Validation/test**: Verify configuration error screen renders with the new SVG logo.

- [ ] T008 [US1] Update welcome page layout viewports in `WelcomePage.js`
  - **Target**: [src/pages/welcome/WelcomePage.js](../../src/pages/welcome/WelcomePage.js)
  - **Expected behavior**: Update layout structures to align with responsive spec:
    - Desktop (`>900px`): Two-column layout grid (left pitch, right animated showcase).
    - Tablet (`621–900px`): Height-locked flex column with a scaled-down showcase.
    - Mobile (`≤620px` width):
      - **Landscape**: Allow standard vertical scrolling.
      - **Portrait**: Lock height at `100dvh` (no scrolling). If height is **≥600px**, render showcase stage at **158px**. If height is **<600px**, scale showcase stage to **110px**, condense grid margins/paddings, and hide the footer links to prevent clipping.
  - **Constraints**: Apply height-locking (`100dvh`, no-scroll) layouts below 900px in portrait orientation.
  - **Validation/test**: Check page rendering at various widths and heights in browser.

- [ ] T009 [P] [US1] Integrate full-color vector logo into welcome page headers
  - **Target**: [src/pages/welcome/WelcomePage.js](../../src/pages/welcome/WelcomePage.js)
  - **Expected behavior**: Replace colored png reference with `src/assets/logo/alice-sigil-full.svg` for warm/white themes and mobile view. Import `alice-sigil-full-white.svg` for the navy theme welcome screen.
  - **Validation/test**: Toggle themes in dev and verify correct logo renders.

- [ ] T010 [P] [US1] Refactor Welcome Page CSS breakpoints and layouts
  - **Target**: [src/styles/main.css](../../src/styles/main.css)
  - **Expected behavior**: Update media query breakpoints to match redesign spec:
    - Desktop (`>900px`): two-column diagonal grid layout.
    - Tablet (`621–900px`): height-locked flex-column layout.
    - Mobile (`≤620px` width):
      - Landscape: Allow vertical scrolling, clear height constraints.
      - Portrait: Height-locked `100dvh` (no-scroll). Add height-based media query (`@media (max-height: 599px)`) to scale the showcase stage height to `110px`, condense grid layout gap/paddings, and hide the footer.
  - **Validation/test**: Verify CSS compiles and layout adjusts correctly under resize testing.

- [ ] T011 [US1] Build mini footer with version and repository details
  - **Target**: [src/pages/welcome/WelcomePage.js](../../src/pages/welcome/WelcomePage.js)
  - **Expected behavior**: Render the welcome page footer using centralized settings from `appMeta.js`. On desktop (`>900px`), append the repository link and Alice Portable Download chip. Hide both on tablet/mobile views.
  - **Validation/test**: Inspect footer elements on desktop vs mobile.

---

## Phase 04: User Story 2 (Icons & Illustrations Swaps)

**Purpose**: Replace local hardcoded SVG definitions with standard line-icon registry calls and wire empty-state illustrations.

- [ ] T012 [P] [US2] Update QuickFiltersToolbar to use registry icons
  - **Target**: [src/components/QuickFiltersToolbar.js](../../src/components/QuickFiltersToolbar.js)
  - **Expected behavior**: Import `{ icon }` from `src/utils/icons.js`. Delete local factory and replace inline filter paths with semantic registry calls: status, salary, compatibility, company, shift, workSetup, location, and sort.
  - **Validation/test**: Check toolbar filters render unique icons.

- [ ] T013 [P] [US2] Update Card and Modal to use registry icons
  - **Target**: [src/components/Card.js](../../src/components/Card.js) and [src/components/Modal.js](../../src/components/Modal.js)
  - **Expected behavior**: Replace duplicate inline path strings for Edit, Change Status, Star, Archive, Unarchive, and Close with `icon('edit')`, `icon('changeStatus')`, `icon('star')`, `icon('archive')`, `icon('unarchive')`, and `icon('close')` respectively.
  - **Validation/test**: Verify card action buttons and modal controls render correctly.

- [ ] T014 [P] [US2] Update ProfileEdit form to use registry icons
  - **Target**: [src/pages/ProfileEdit.js](../../src/pages/ProfileEdit.js)
  - **Expected behavior**: Import `{ icon }` from `src/utils/icons.js` and replace local factory paths for Edit and Close buttons.
  - **Validation/test**: Verify profile edit form controls load registry icons.

- [ ] T015 [P] [US2] Integrate ActionPanel empty states illustration
  - **Target**: [src/components/calendar/ActionPanel.js](../../src/components/calendar/ActionPanel.js)
  - **Expected behavior**: Update `EMPTY_STATES` mapping. Replace text-only glyphs with `<img src="/src/assets/graphics/calendar-quiet.svg" />` inside the dashboard panels.
  - **Validation/test**: Verify "Quiet day", "You're caught up", and "Nothing scheduled" empty panels display the illustration.

- [ ] T016 [P] [US2] Integrate DayPanel compact empty states illustration
  - **Target**: [src/components/calendar/DayPanel.js](../../src/components/calendar/DayPanel.js)
  - **Expected behavior**: Replace text glyph `◌` in prompt and empty events with `<img src="/src/assets/graphics/calendar-empty.svg" />` at a compact **44×44px** dimension.
  - **Validation/test**: Verify "Select a day" and "No events" render the small monochrome illustration.

- [ ] T017 [US2] Integrate Profile empty-state and add illustrations
  - **Target**: [src/pages/Profile.js](../../src/pages/Profile.js)
  - **Expected behavior**: Replace CSS-drawn avatar body/head spans in `renderEmptyProfile()` with a single `<img src="/src/assets/graphics/profile-empty.svg" />`. Add `<img src="/src/assets/graphics/pencil-add.svg" />` above the "Set Up Profile" CTA button.
  - **Validation/test**: Check empty profile view layout renders illustrations correctly.

- [ ] T017b [P] [US2] Integrate CreationPicker pencil-add illustration
  - **Target**: [src/components/CreationPicker.js](../../src/components/CreationPicker.js)
  - **Expected behavior**: Import and render `src/assets/graphics/pencil-add.svg` at **110×110px** inside the header section of the CreationPicker modal view.
  - **Validation/test**: Verify "New Application" picker overlay displays the graphic.

---

## Phase 05: User Story 3 (Showcase Carousel)

**Purpose**: Build the high-fidelity animated showcase carousel on the welcome page.

- [ ] T018 [US3] Reconcile and update showcase scene modules under src/pages/welcome/scenes/
  - **Target**: `src/pages/welcome/scenes/` (SceneStack.js, ScenePipeline.js, SceneProfile.js, SceneLogo.js)
  - **Expected behavior**: Rename and rewrite existing scene files to fit the redesigned showcase specs:
    1. Rename `SceneStack.js` $\rightarrow$ `SceneConstellation.js` (draws twinkling pipeline star coordinates).
    2. Create `SceneParse.js` (scans a paste window with a horizontal gold beam animation).
    3. Update `ScenePipeline.js` (cycles status badges Applied $\rightarrow$ Phone $\rightarrow$ Interview $\rightarrow$ Offer).
    4. Rename `SceneProfile.js` $\rightarrow$ `SceneMomentum.js` (animates progress segments donut).
    5. Rename `SceneLogo.js` $\rightarrow$ `SceneDeck.js` (renders a tilted 3D fanned deck).
    Orchestrate these inside `src/pages/welcome/HeroSlideshow.js`. Cycle duration is 8600ms per scene, synced with progress dots. Manual jumps reset the auto-advance timer.
  - **Validation/test**: Verify carousel cycles automatically and dots jump to the correct scene.

- [ ] T019 [P] [US3] Update brand white sigil path inside SceneDeck.js
  - **Target**: [src/pages/welcome/scenes/SceneDeck.js](../../src/pages/welcome/scenes/SceneDeck.js) (formerly SceneLogo.js)
  - **Expected behavior**: Replace `Alice_White.png` import with `src/assets/logo/alice-sigil-full-white.svg` as the vector brand sigil inside the deck stack.
  - **Validation/test**: Verify the deck scene renders the SVG white sigil.

- [ ] T020 [US3] Implement prefers-reduced-motion accessibility rules
  - **Target**: [src/pages/welcome/HeroSlideshow.js](../../src/pages/welcome/HeroSlideshow.js)
  - **Expected behavior**: Detect `prefers-reduced-motion: reduce` query. If true, disable auto-cycle interval timers, pause rotation/glow animations, and render settled scene layouts immediately.
  - **Validation/test**: Toggle reduced-motion in OS settings and verify animations stop.

---

## Phase 06: User Story 4 (Auth Redesign & LLM Loaders)

**Purpose**: Update Auth modal forms styles and implement the in-app LLM processing loader overlays.

- [ ] T021 [US4] Redesign Auth Overlay modal shell and forms
  - **Target**: [src/pages/welcome/AuthOverlay.js](../../src/pages/welcome/AuthOverlay.js)
  - **Expected behavior**: Update login/signup forms with glassmorphism styles, password visibility peek, touched-based validation validation warnings, and swap-mode link transitions. Render `alice-sigil-full.svg` at 40×40px in the header.
  - **Validation/test**: Open sign-in modal, input invalid strings, and verify touched warnings appear.

- [ ] T022 [US4] Rebuild Resume Import in-app LLM processing overlay
  - **Target**: [src/components/ResumeImport.js](../../src/components/ResumeImport.js)
  - **Expected behavior**: Replace processing loader with full-screen dimmed/blurred backdrop overlay. Include central Alice sigil `src/assets/logo/alice-sigil-full.svg`, gold circle spinner ring (0.6s rotation), and status text: Title: *"Getting to know your background"*, Subtitle: *"Alice is reading through your experience"*. Enable rotating conic-gradient edge glow only for desktop (≥900px). Upon parsing completion, transition the overlay opacity to 0 over 400ms using CSS ease-out before unmounting.
  - **Constraints**: Apply accessibility attributes (`role="status"`, `aria-live="polite"`, `aria-busy="true"`).
  - **Validation/test**: Trigger resume parse and verify visual overlay.

- [ ] T023 [US4] Rebuild Job Posting Import in-app LLM processing overlay
  - **Target**: [src/components/JobPostingImport.js](../../src/components/JobPostingImport.js)
  - **Expected behavior**: Replace loader with same full-screen overlay backdrop. Set status text: Title: *"Making sense of the posting"*, Subtitle: *"Alice is pulling out the role details"*. Restrict conic rotation to desktop widths. Upon parsing completion, transition the overlay opacity to 0 over 400ms using CSS ease-out before unmounting.
  - **Validation/test**: Trigger JD parse and verify visual overlay.

- [ ] T024 [P] [US4] Disable in-app loader animations for reduced motion
  - **Target**: [src/components/ResumeImport.js](../../src/components/ResumeImport.js) and [src/components/JobPostingImport.js](../../src/components/JobPostingImport.js)
  - **Expected behavior**: If reduced motion is requested, stop spinner-ring and edge-glow rotation animations.
  - **Validation/test**: Verify loaders do not spin under reduced motion.

---

## Phase 07: Polish & Test Suite Updates

**Purpose**: Align visual issues and update Vitest suites to map new logo/icon paths.

- [ ] T025 Update affected Vitest test files to reflect brand asset path changes, scene file renames, and version bump sync
  - **Target**: 
    - `tests/components/welcome.test.js`
    - `tests/components/navbar.test.js`
    - `tests/components/Navbar.demo.test.js`
    - `tests/pages/configError.test.js`
    - `tests/pages/welcome/heroSlideshow.test.js`
    - `tests/pages/welcome/scenes/sceneDeck.test.js` (renamed from `sceneLogo.test.js`)
    - `tests/main.test.js`
    - `tests/build/favicon.test.js`
    - `tests/release-metadata.test.js`
    - `tests/pages/Profile.account.test.js`
    - `tests/pages/profile.aiSettings.test.js`
  - **Expected behavior**:
    - Rename `tests/pages/welcome/scenes/sceneLogo.test.js` to `tests/pages/welcome/scenes/sceneDeck.test.js`, and update its import statement to load the new reconciled `SceneDeck.js`.
    - Modify Vitest mock import references across components to load `logo/alice-sigil-full.svg` or `logo/alice-sigil-full-white.svg` instead of `Alice_Colored.png` or `Alice_White.png`.
    - In `tests/build/favicon.test.js`, extend assertions to cover new favicon links (`/favicon.ico`, `/favicon.svg`, `/favicon-32x32.png`, `/apple-touch-icon.png`) and confirm each destination exists.
    - In `tests/release-metadata.test.js`:
      - Bump version sync assertions for `pkg.version`, `APP_VERSION`, `lock.version`, `lock.packages['']?.version`, and `README.md` to expect `1.11.0` (or `v1.11.0`).
      - Update the test description to mention `1.11.0`.
      - Update the `[Unreleased]` compare link assertion to expect `compare/v1.11.0...HEAD`.
      - Add assertions verifying that the new `## [1.11.0]` section exists in `CHANGELOG.md` and the comparison link `[1.11.0]` resolves to `compare/v1.10.8...v1.11.0`.
      - **CRITICAL**: Do NOT modify or perform search-and-replace on historical changelog headers (like `## [1.10.8]`) or historical comparison link assertions (like `[1.10.8]: ...`); these must be preserved exactly as-is.
    - In `tests/pages/Profile.account.test.js` and `profile.aiSettings.test.js`, update version chip assertions from `v1.10.8` to `v1.11.0`.
  - **Validation/test**: Run `npm run test:run` and verify all tests pass.

- [ ] T026 Audit HTML5 semantic layout structure & accessibility tags
  - **Target**: [src/pages/welcome/WelcomePage.js](../../src/pages/welcome/WelcomePage.js) and [src/pages/welcome/AuthOverlay.js](../../src/pages/welcome/AuthOverlay.js)
  - **Expected behavior**: Ensure all forms use associated labels, keyboard tab-indices are trapped within the Auth modal when open, and aria roles match requirements.
  - **Validation/test**: Run `npm run lint` to confirm clean formatting.

---

## Phase 08: Release Prep

**Purpose**: Bump SemVer version and update project documentation to complete the feature branch.

- [ ] T027 Bump version across all project surfaces (from 1.10.8 to 1.11.0)
  - **Target**: [package.json](../../package.json), [package-lock.json](../../package-lock.json), [src/pages/welcome/shared/appMeta.js](../../src/pages/welcome/shared/appMeta.js), and [README.md](../../README.md)
  - **Expected behavior**: Bump version from `1.10.8` to `1.11.0` in `package.json`, `package-lock.json` (`version` fields), and `README.md` (`v1.10.8` $\rightarrow$ `v1.11.0`). In `appMeta.js`, bump `APP_VERSION` from `v1.10.8` to `v1.11.0`.
  - **Validation/test**: Verify versions match and run `npm run test:run` to confirm the metadata test passes.

- [ ] T028 Update Project Alice feature roadmap status
  - **Target**: [docs/feature_roadmap.md](../../docs/feature_roadmap.md)
  - **Expected behavior**: Mark Feature 042 status checkbox as complete: `- [x] 042-welcome-brand-refresh  ·  shipped v1.11.0`.
  - **Validation/test**: Verify roadmap displays checked feature.

- [ ] T029 Add release entries to CHANGELOG
  - **Target**: [CHANGELOG.md](../../CHANGELOG.md)
  - **Expected behavior**: Add a new section `## [1.11.0] — 2026-07-04` detailing Feature 042 improvements: brand refresh, logo replacements, standardized utility icons, showcase scenes, and in-app loaders redesign. At the bottom, update the `[Unreleased]` compare link to `compare/v1.11.0...HEAD`, and append a new `[1.11.0]` link pointing to `compare/v1.10.8...v1.11.0`.
  - **Constraints**: **Do NOT modify or overwrite any historical changelog headers (like `## [1.10.8]`) or historical comparison link entries.**
  - **Validation/test**: Verify formatting matches standard changelog entries.

- [ ] T030 Update repository file map references
  - **Target**: [docs/REPO_MAP.md](../../docs/REPO_MAP.md)
  - **Expected behavior**: Update paths to reflect newly introduced `logo/` and `graphics/` asset directories.
  - **Validation/test**: Verify links navigate correctly.

- [ ] T031 Complete documentation sanity checks
  - **Target**: [README.md](../../README.md) and [docs/deployment.md](../../docs/deployment.md)
  - **Expected behavior**: Confirm user documentation accurately reflects visual welcome modifications.

---

## Phase 09: Browser Smoke Test

**Purpose**: Walk through each user story's Independent Test in a real browser to guarantee production readiness before merge.

- [ ] T032 Verify Welcome Page responsive viewports
  - **Expected behavior**: Open local dev server. Validate desktop diagonal grid (`>900px`), tablet portrait layout (`621–900px`), and mobile portrait stacked buttons (`≤620px`) adjust without clipping or layout shifts.
  - **Validation/test**: Physical browser resizing verification.

- [ ] T033 Verify Icon Standardization & Empty States
  - **Expected behavior**: Navigate to Tracker and Profile views. Check that toolbar filters display distinct line icons, empty states render graphics (`calendar-quiet.svg`, `calendar-empty.svg`, `profile-empty.svg`) at correct sizes, and old head/body spans are removed.
  - **Validation/test**: Visual browser verification.

- [ ] T034 Verify Showcase Carousel & Reduced Motion
  - **Expected behavior**: Observe the showcase carousel loops every 8.6s. Verify clicking progress dots jumps instantly. Toggle prefers-reduced-motion and verify all carousel slides freeze.
  - **Validation/test**: Visual browser verification.

- [ ] T035 Verify Auth Modal & In-App LLM Loaders
  - **Expected behavior**: Open Auth Modal, verify glassmorphism and password peek. Trigger a mock resume upload and mock JD parse. Check that blurred overlays with gold spin rings block interaction, status copy matches Option A, and edge glows rotate only on desktop viewports.
  - **Validation/test**: Visual browser verification.
