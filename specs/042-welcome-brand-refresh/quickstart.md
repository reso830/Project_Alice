# Quickstart Guide: Welcome Page & Brand Refresh

This guide details steps to configure, run, and verify the Feature 042 visual implementation.

---

## 1. Asset Staging (Housekeeping)

First, stage the vector and illustration assets from the design handoff packages into the repository:

1. Create the logo and graphics asset directories:
   ```powershell
   New-Item -ItemType Directory -Force -Path "src/assets/logo"
   New-Item -ItemType Directory -Force -Path "src/assets/graphics"
   ```
2. Copy the logo files:
   - Copy `alice-sigil-full.svg` to `src/assets/logo/alice-sigil-full.svg`
   - Copy `alice-sigil-full-white.svg` to `src/assets/logo/alice-sigil-full-white.svg`
3. Copy the empty-state illustrations:
   - Copy `calendar-quiet.svg`, `calendar-empty.svg`, and `profile-empty.svg` to `src/assets/graphics/`
4. Copy the standard favicons:
   - Copy `favicon-32.png` to `public/favicon-32x32.png`
   - Copy `favicon.ico` to `public/favicon.ico`
   - Copy `favicon.svg` to `public/favicon.svg`
   - Copy `apple-touch-icon.png` to `public/apple-touch-icon.png`

---

## 2. Running the Development Server

Start the local development server to test page routing and visual components:
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your web browser. 

---

## 3. Running Automated Tests

Run the Vitest test suites to check brand asset overrides, mocks, and welcome view changes:

- Run the full test suite:
  ```bash
  npm run test:run
  ```
- Run specific tests affected by the brand asset refactoring:
  ```bash
  npx vitest run tests/components/welcome.test.js
  npx vitest run tests/components/navbar.test.js
  npx vitest run tests/pages/configError.test.js
  npx vitest run tests/pages/welcome/heroSlideshow.test.js
  npx vitest run tests/pages/welcome/scenes/sceneDeck.test.js
  npx vitest run tests/main.test.js
  ```

---

## 4. Quality Gates Checklist

Before submitting changes for review:
1. Verify keyboard navigation and ARIA roles exist on all welcome page forms.
2. Confirm the in-app LLM loader spinner disables its rotation animation when reduced motion is toggled.
3. Verify page sizing height-locks correctly across viewport breakpoints:
   - Desktop (`>900px`)
   - Tablet (`621–900px`)
   - Mobile (`≤620px`)
4. Ensure no lint or format errors occur:
   ```bash
   npm run lint
   ```
