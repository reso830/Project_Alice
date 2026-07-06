# Tasks: Legal Docs & Footer

**Feature**: `043-legal-and-footer` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small, ordered, and specific. `[P]` marks parallelizable tasks. Status legend: `[x]` done · `[ ]` pending · `[~]` skipped.
Commands: `npm run test:run`, `npm run lint`.

Phase dependency: 01 → 02 → 03 → 04 → 05 → 06 → 07

## Phase summary

| Phase | Focus | Tasks | Stories |
|---|---|---|---|
| 00 | Hold & Rebase | T000 | Hold implementation until 042 merges, then rebase worktree onto main |
| 01 | Setup & Content (Drafting legal texts) | T001–T002 | Write static Terms and Privacy Policy content with attorney reviews notes |
| 02 | Foundational Components & Styles | T003–T004 | Build stateless LegalModal component (dimensions/ARIA) & add styles |
| 03 | UI Trigger Wiring | T005–T006 | Connect triggers in AuthOverlay signup form and WelcomePage mini-footer |
| 04 | Footer Refactoring | T007 | Refactor global Footer columns, brand mark, version line, and background |
| 05 | Unit Testing & Verification | T008–T009 | Write unit tests for LegalModal and update Footer unit tests |
| 06 | Release Prep | T010–T014 | SemVer bump, CHANGELOG entry, tick roadmap, and REPO_MAP update |
| 07 | Browser Smoke Test | T015–T018 | Verify modal overlays, bottom sheet reflows, and tabbing focus on browser |

---

## Phase 00: Hold & Rebase

**Purpose**: Sequence work safely after Feature 042 merges to prevent visual and layout styling regressions.

- [ ] T000 Hold implementation & rebase worktree onto main
  - **Target**: Git repository branch
  - **Expected behavior**: 043 branch work held until Feature 042 is merged to the main branch. Once 042 merges, fetch main and rebase the worktree branch (`git rebase origin/main`) to absorb all 042 changes.
  - **Validation/test**: Verify git log shows 042 commits below 043.

---

## Phase 01: Setup & Content (Drafting legal texts)

**Purpose**: Draft the pre-written static legal documents reflecting Project Alice's architecture, including disclaimer notices.

- [x] T001 Draft static Terms & Conditions copy
  - **Target**: `src/data/legalContent.js` (new file)
  - **Expected behavior**: Define and export a static JavaScript structure representing the 4 sections of the Terms & Conditions (`v0.3.0 · Effective Apr 1, 2026`):
    - Title: "Terms & Conditions"
    - Version/Effective Date: "v0.3.0 · Effective Apr 1, 2026"
    - Section 1: "1. Acceptance of terms" (Details organization bind and acceptance).
    - Section 2: "2. Your account" (Details user responsibility for credentials and SQLite/local data).
    - Section 3: "3. Acceptable use" (Details acceptable storage bounds and system safety).
    - Section 4: "4. Changes to the service" (Details feature evolution and releases notes notification).
    - **Notice**: Injected header calling out that this document is developer-drafted placeholder content and requires professional attorney review.
  - **Validation/test**: Verify the file is correctly created and exports the data structures.

- [x] T002 Draft static Privacy Policy copy
  - **Target**: `src/data/legalContent.js`
  - **Expected behavior**: Define and export a static JavaScript structure representing the 4 sections of the Privacy Policy (`v0.2.1 · Effective Mar 15, 2026`):
    - Title: "Privacy Policy"
    - Version/Effective Date: "v0.2.1 · Effective Mar 15, 2026"
    - Section 1: "1. What we collect" (Details tracking entries, profile records, and local stats).
    - Section 2: "2. How we use it" (Details usage solely to operate the product on client-side).
    - Section 3: "3. Storage & retention" (Details local-first storage posture, no cloud synchronization unless Supabase is configured).
    - Section 4: "4. Your choices" (Details data export and profile deletion capabilities).
    - **Notice**: Injected header calling out that this document is developer-drafted placeholder content and requires professional attorney review.
  - **Validation/test**: Verify the file is correctly created and exports the data structures.

---

## Phase 02: Foundational Components & Styles

**Purpose**: Build the global `LegalModal` Vanilla JS class/component and integrate styles for layouts, mobile bottom sheets, and the spotlight background.

- [x] T003 Implement `LegalModal.js` component
  - **Target**: `src/components/LegalModal.js` (new file)
  - **Expected behavior**: Implement a stateless modal renderer displaying Terms & Conditions or Privacy Policy:
    - `render(type, onClose)`: Builds and returns the modal wrapper DOM tree (overlay backdrop, centered container or bottom sheet layout depending on viewport width, close button ✕, scrollable container, disclaimer header, and bottom Close button). Configures ARIA attributes, sets `overflow: hidden` on body, binds ESC key, and traps focus.
    - Dismissal calls the `onClose` callback to clear shell state.
  - **Constraints**: 
    - Vanilla DOM createElement APIs, no external packages.
    - Desktop/tablet widths (660px desktop, 480px tablet) and max-height constraints (90vh desktop, 86vh tablet) split at 1024px width.
    - Accessibility ARIA attributes: modal root must have `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` referencing the title node ID.
  - **Validation/test**: Verify DOM elements render correctly on call.

- [x] T004 Write Modal Dialog & spotlight CSS styles
  - **Target**: `src/styles/main.css`
  - **Expected behavior**: Add styles for:
    - Overlay backdrop (`rgba(8,8,24,.52)` + `backdrop-filter: blur(3px)`).
    - Modal container (rounded corners, white background `#FFFFFF`, dark text `#4B5563`, navy header `#1A1A2E`, box-shadow, height/width properties).
    - Mobile bottom sheet reflow (`@media (max-width: 639px)` pinning to bottom, `border-radius: 14px 14px 0 0`, drag handle pill `36x4px` at 35% opacity, max-height 82vh).
    - Spotlight background recipe on `.site-footer` (radial gradients and linear-gradients on `--navy-deep`).
    - Grid columns layout media queries.
  - **Validation/test**: Layout compiles and matches visual specs.

---

## Phase 03: UI Trigger Wiring

**Purpose**: Integrate the modal triggers inside the Welcome page mini-footer and the signup form modal overlay.

- [x] T005 Refactor AuthOverlay Signup Consent
  - **Target**: `src/pages/welcome/AuthOverlay.js`
  - **Expected behavior**:
    - Under the signup form, replace plain-text with HTML nodes rendering clickable links for "terms of use" and "privacy policy".
    - Attach click listeners updating parent shell state (e.g. `setLegalDialog('terms')` / `setLegalDialog('privacy')`) rather than direct mounting.
    - Ensure modal opening does not close the AuthOverlay or clear its email/password inputs.
    - Verify interactive elements support visible focus indicators.
  - **Validation/test**: Click links from AuthOverlay signup; verify legal modal opens on top.

- [x] T006 Refactor WelcomePage Mini-Footer Links
  - **Target**: `src/pages/welcome/WelcomePage.js`
  - **Expected behavior**:
    - Modify `renderFooterMeta()` to render active buttons/links for "Terms & Conditions" and "Privacy Policy" next to version and license.
    - Wire click handlers to update shell state (`setLegalDialog('terms' | 'privacy')`).
  - **Validation/test**: Verify clicking links launches the appropriate modal overlay.

---

## Phase 04: Footer Refactoring

**Purpose**: Re-create the global footer layout, assets, column groups, version details, and spotlight background according to high-fidelity mockups.

- [x] T007 Refactor global `Footer.js` columns & brand row
  - **Target**: `src/components/Footer.js`
  - **Expected behavior**:
    - Render 042's existing vector sigil `alice-sigil-full.svg` (64x64px) imported from `../assets/logo/alice-sigil-full.svg` instead of the raster PNG.
    - Dissolve Version section; render inline below tagline.
    - Remove STACK section and horizontal rule (`.footer__rule`).
    - Structure Feedback section: add GitHub repository root link as the first item.
    - Structure License section: add active links for Terms & Conditions and Privacy Policy that update the shell-level state (`setLegalDialog('terms' | 'privacy')`).
    - Structure Copyright section: 3 stacked lines of text with an active link to `alvinresoso.com`.
    - Hide download/hosted buttons under 1024px.
  - **Validation/test**: Verify footer elements and responsive media classes display on Tracker page.

---

## Phase 05: Unit Testing & Verification

**Purpose**: Update existing unit tests and write new ones to assert modal lifecycle and footer layout correctness.

- [x] T008 Update `Footer.test.js` unit assertions
  - **Target**: `tests/components/Footer.test.js`
  - **Expected behavior**: Refactor test suite assertions to check for vector sigil image source (`alice-sigil-full.svg`), inline version, Feedback repo link, License terms/privacy triggers, and 3-line copyright. STACK column check is removed.
  - **Validation/test**: Run `npm run test:run` or `vitest run tests/components/Footer.test.js`.

- [x] T009 Implement `LegalModal.test.js` unit tests
  - **Target**: `tests/components/LegalModal.test.js` (new file)
  - **Expected behavior**: Assert:
    - Shell state changes mount the overlay wrapper, configure ARIA attributes, and set body `overflow: hidden`.
    - Modal body contains headers, static copy, and disclaimer notes.
    - Full close path coverage: close button (✕) click, footer close button click, backdrop click, and Escape key press successfully clear state/unmount modal and restore body scroll.
    - Closing the modal successfully returns focus to the active DOM element that triggered the open state.
  - **Validation/test**: Run `npm run test:run` or `vitest run tests/components/LegalModal.test.js`.

---

## Phase 06: Release Prep

**Purpose**: Increment version numbering across the project, update documentation maps, and complete code-quality checks.

- [x] T010 Bump application version dynamically
  - **Target**: `package.json`, `package-lock.json`, and `src/pages/welcome/shared/appMeta.js`
  - **Expected behavior**: Target the next sequential version following Feature 042's final release state (e.g. bump to `v1.11.1` assuming 042 released as `v1.11.0`).
  - **Validation/test**: Verify `APP_VERSION` matches package manifest version exactly.

- [x] T011 Update `CHANGELOG.md`
  - **Target**: [CHANGELOG.md](../../CHANGELOG.md)
  - **Expected behavior**: Add release notes for version bump documenting the footer redesign, SVG logo reuse, and legal modal updates.
  - **Validation/test**: Verify changelog formatting.

- [x] T012 Tick Feature roadmap row
  - **Target**: [docs/feature_roadmap.md](../../docs/feature_roadmap.md)
  - **Expected behavior**: Update feature `043-legal-and-footer` status to `[x]` and add metadata referencing the shipped version.
  - **Validation/test**: Verify roadmap formatting.

- [x] T013 Update repo directories map
  - **Target**: [docs/REPO_MAP.md](../../docs/REPO_MAP.md)
  - **Expected behavior**: Document the new file `src/components/LegalModal.js` under the component directory structure.
  - **Validation/test**: Verify file link works.

- [x] T014 Run validation check suite
  - **Target**: Codebase
  - **Expected behavior**: Verify code passes syntax, formatting, and formatting rules.
  - **Validation/test**: Run `npm run lint` and `npm run test:run`. All checks must return green.

---

## Phase 07: Browser Smoke Test (UI features only)

**Purpose**: Walk through each user journey's independent test on a physical browser to verify visual layout and input state stability.

- [ ] T015 Verify AuthOverlay Signup links
  - **Expected behavior**: Open welcome page, open Sign Up modal, click legal links, modal displays on top with navy header and white body, trap focus, dismiss, check input text is kept.
  - **Validation/test**: Manual browser walk.

- [ ] T016 Verify global Footer triggers
  - **Expected behavior**: Log in, view footer, click Terms & Conditions / Privacy Policy, check centered modal overlays correctly (respecting the 660px desktop / 480px tablet / 90vh desktop / 86vh tablet boundaries), close, verify focus returns to link.
  - **Validation/test**: Manual browser walk.

- [ ] T017 Verify Welcome Page mini-footer links
  - **Expected behavior**: Open welcome page, click Terms & Conditions / Privacy Policy in mini-footer, check modal overlays correctly, close.
  - **Validation/test**: Manual browser walk.

- [ ] T018 Verify responsive breakpoints reflow
  - **Expected behavior**: Rescale browser window from desktop to mobile (375px). Confirm:
    - Global footer reflows to 2 columns and download buttons hide.
    - Legal modal displays as a bottom sheet with top rounded corners and drag handle.
  - **Validation/test**: Manual responsive design inspection.
