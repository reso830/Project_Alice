# Implementation Plan: Welcome Page & Brand Refresh

**Branch**: `042-welcome-brand-refresh` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/042-welcome-brand-refresh/spec.md`

---

## Summary
Modernize Project Alice's unauthenticated welcome page, brand assets, and in-app loading overlays. The layout will adapt to desktop, tablet, and mobile breakpoints using height-locked CSS. PNG logos will be replaced by newly structured SVGs under `src/assets/logo/`. System icons will be standardized through `src/utils/icons.js` in five target files, and empty-state illustrations will be staged under `src/assets/graphics/`. Finally, the in-app LLM loaders in `ResumeImport.js` and `JobPostingImport.js` will receive blurred backdrops, orbital spinner rings, accessible status text, and a desktop-only rotating edge glow.

---

## Technical Context

**Language/Version**: JavaScript (ES6+), Vanilla JS  
**Primary Dependencies**: Vite, standard DOM APIs, CSS Variables, `window.matchMedia`  
**Storage**: N/A (No database schema changes)  
**Testing**: Vitest  
**Target Platform**: Web browsers (Desktop, Tablet, Mobile)  
**Project Type**: Single Page Web Application (SPA)  
**Performance Goals**: Smooth 60fps animations; zero layout shifts during responsive viewport changes; fast unmount on LLM overlay completion.  
**Constraints**: Height-locked viewports (`100dvh`); no external icon libraries; prefers-reduced-motion accessibility; edge glow restricted to ≥900px.

---

## Constitution Check

- **Data Fields**: No database fields or persistence models are added or modified. Required job application fields remain unchanged.
- **Separation of Logic**: Carousel story logic is separated from DOM state templates. CSS custom properties drive visual accents.
- **Validation**: Touch-based forms validation in the AuthOverlay checks email patterns and password lengths before submission.
- **Workflows**: Visual updates cover empty, loading, and error states across the Tracker, Profile, and Action views.
- **Automated Tests**: Vitest suites cover brand asset re-routing, responsive navbar elements, and mock image verification.
- **Local-First Privacy**: Gated local-first operation; no user data or parsed documents are shared with external analytics.
- **UX Standards**: Height-locked layouts, form labels, assistive screen-reader compatibility (`aria-live`), and reduced motion styling are fully planned.

---

## Project Structure

### Documentation (this feature)
```text
specs/042-welcome-brand-refresh/
├── plan.md              # This file
├── research.md          # Technical decisions and details
├── data-model.md        # Asset folder organization structure
├── quickstart.md        # Staging and test walkthrough commands
└── checklists/
    ├── requirements.md  # Spec quality checklist
    └── plan-review.md   # Pre-implementation review checklist
```

### Source Code
```text
public/
├── favicon-32x32.png      # Updated vector favicon (32x32)
├── favicon.ico            # Fallback legacy favicon
├── favicon.svg            # Scalable SVG favicon
└── apple-touch-icon.png   # iOS home screen icon

src/
├── assets/
│   ├── logo/              # Brand logos (alice-sigil-full.svg / alice-sigil-full-white.svg)
│   ├── graphics/          # Illustrations (calendar-quiet.svg, profile-empty.svg, pencil-add.svg, etc.)
│   └── icons/             # System SVGs (compatibility.svg, timeline.svg, etc.)
├── components/
│   ├── Card.js            # Hardcoded SVGs replaced
│   ├── Footer.js          # SVG logo integration
│   ├── Modal.js           # Hardcoded SVGs replaced
│   ├── Navbar.js          # SVG logo integration
│   ├── CreationPicker.js  # Illustration integration (pencil-add.svg)
│   ├── QuickFiltersToolbar.js
│   ├── JobPostingImport.js # In-app LLM loader update
│   ├── ResumeImport.js     # In-App LLM loader update
│   └── calendar/
│       ├── ActionPanel.js  # Dashboard empty-state illustration
│       └── DayPanel.js     # Compact empty events illustration
├── pages/
│   ├── ConfigError.js     # SVG logo integration
│   ├── Profile.js         # Profile empty-state illustration
│   ├── ProfileEdit.js     # Hardcoded SVGs replaced
│   └── welcome/
│       ├── WelcomePage.js  # Responsive layout and grid
│       ├── AuthOverlay.js  # Redesigned overlays
│       ├── HeroSlideshow.js # Vanilla JS carousel orchestrator
│       └── scenes/         # Showcase scenes (reconciled/updated)
│           ├── SceneConstellation.js (formerly SceneStack.js)
│           ├── SceneParse.js         (new)
│           ├── ScenePipeline.js      (updated)
│           ├── SceneMomentum.js      (formerly SceneProfile.js)
│           └── SceneDeck.js          (formerly SceneLogo.js)
└── utils/
    └── icons.js           # Standardized registry drop-in

tests/
├── components/
│   ├── welcome.test.js
│   ├── navbar.test.js
│   └── Navbar.demo.test.js
├── pages/
│   ├── configError.test.js
│   └── welcome/
│       ├── heroSlideshow.test.js
│       └── scenes/
│           └── sceneDeck.test.js
├── main.test.js
├── release-metadata.test.js # Release version verification test
└── build/
    └── favicon.test.js
```

---

## Affected Areas

### Files/Components to Inspect
- `src/data/demoSeed.js` (verify demo mode rendering matches new layout)

### Files/Components to Modify
- `package.json` (version bump: 1.10.8 → 1.11.0)
- `package-lock.json` (version bump: 1.10.8 → 1.11.0)
- `README.md` (version bump: 1.10.8 → 1.11.0)
- `src/pages/welcome/shared/appMeta.js` (version bump: APP_VERSION 'v1.10.8' → 'v1.11.0')
- `src/pages/welcome/WelcomePage.js` (responsive layouts & logo replacement)
- `src/pages/welcome/AuthOverlay.js` (form glassmorphism styling & validation warnings)
- `src/components/Footer.js` (SVG full-color sigil scaled to 40x40px)
- `src/components/Navbar.js` (SVG all-white sigil scaled to 38x38px)
- `src/pages/ConfigError.js` (SVG all-white sigil scaled to 40x40px)
- `src/utils/icons.js` (registry registration drop-in)
- `src/components/QuickFiltersToolbar.js` (registry icons swap)
- `src/components/Card.js` (registry icons swap)
- `src/components/Modal.js` (registry icons swap)
- `src/pages/ProfileEdit.js` (registry icons swap)
- `src/components/CreationPicker.js` (pencil-add.svg illustration integration)
- `src/components/calendar/ActionPanel.js` (calendar-quiet.svg illustration integration)
- `src/components/calendar/DayPanel.js` (calendar-empty.svg illustration integration)
- `src/pages/Profile.js` (profile-empty.svg and pencil-add.svg illustrations)
- `src/components/JobPostingImport.js` (in-app loader redesign & exit transition fade-out)
- `src/components/ResumeImport.js` (in-app loader redesign & exit transition fade-out)
- `public/favicon-32x32.png` & favicons set (`favicon.ico`, `favicon.svg`, `apple-touch-icon.png`)
- `src/pages/welcome/scenes/SceneStack.js` (renamed to SceneConstellation.js)
- `src/pages/welcome/scenes/SceneParse.js` (new scene)
- `src/pages/welcome/scenes/ScenePipeline.js` (updated layout)
- `src/pages/welcome/scenes/SceneProfile.js` (renamed to SceneMomentum.js)
- `src/pages/welcome/scenes/SceneLogo.js` (renamed to SceneDeck.js)

### Tests to Add or Update
- `tests/components/welcome.test.js`
- `tests/components/navbar.test.js`
- `tests/components/Navbar.demo.test.js`
- `tests/pages/configError.test.js`
- `tests/pages/welcome/heroSlideshow.test.js`
- `tests/pages/welcome/scenes/sceneDeck.test.js` (renamed from `sceneLogo.test.js`)
- `tests/main.test.js`
- `tests/release-metadata.test.js` (version synchronization assertion update)
- `tests/pages/Profile.account.test.js` (v1.10.8 → v1.11.0 assertion update)
- `tests/pages/profile.aiSettings.test.js` (v1.10.8 → v1.11.0 assertion update)
- `tests/build/favicon.test.js`

### Areas Explicitly Out of Scope
- Redesigning the startup boot loader screen (covered by Feature 044).
- Introducing a client-side URL-path router.
- Adding third-party icon libraries (FontAwesome, Lucide).
