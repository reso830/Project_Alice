# Feature Brief: 043 - Legal Docs & Footer

## Summary
Add native legal documents (Terms of Use and Privacy Policy) to Project Alice, link them directly from the signup overlay, and recreate the global site footer based on Claude's high-fidelity design handoff (issue #108). This redesign reduces the footer's vertical footprint, incorporates a new full-color brand sigil, integrates the version details into the brand row, adds a new GitHub link, reorganizes the links into a new 3-column layout, and introduces a layered spotlight background.

---

## Goals
- Add standard Terms of Use and Privacy Policy document files into the application workspace.
- Refactor the signup form in `AuthOverlay.js` to render the legal notice as clickable anchors. (Note: Originally specified to open in new tabs; superseded by `Alice_Legal` handoff which mandates in-app modal overlays).
- Implement the redesigned global `Footer.js` following the high-fidelity design handoff from issue #108:
  - Swap the raster logo for the full-color vector `Alice-Sigil-color.svg` at `64x64px`.
  - Dissolve the version number into the brand text block (vertically centered, below name/tagline).
  - Reorganize the footer columns: remove the STACK column, and structure Feedback, License (including Terms & Conditions and Privacy Policy stubs), and Copyright into 3 columns.
  - Remove the horizontal separator rule.
  - Apply the layered spotlight background (radial-gradients + faint grid over `--navy-deep`).
  - Update the download/hosted control label, style, and responsiveness (hide below `1024px`).
- Update unit tests in `tests/components/Footer.test.js` to ensure they match the redesigned DOM structure, new links, and stack details.
- Ensure the layout of these new documents, signup changes, and footer elements is fully responsive across desktop, tablet, and mobile viewports.

---

## Non-Goals
- Drafting finalized, legally binding contracts in this phase (placeholder templates will be used).
- Creating fully interactive in-app content routers for terms and privacy (Note: Originally specified to open in new tabs; superseded by in-app modal overlays).

---

## User Experience
- **Signup Overlay**: The text *"By creating an account, you agree to the terms of use and privacy policy."* becomes active with underline/accent-colored links that open the respective pages as in-app modal overlays (retaining form state).
- **Global Footer**: 
  - Refreshed with a premium spotlight-grid background and a larger full-color Alice sigil.
  - No longer displays a redundant separate version/stack section.
  - Section **FEEDBACK** features a direct GitHub link (pointing to repo root) followed by Report an issue and Request a feature.
  - Section **LICENSE** features the PolyForm Noncommercial 1.0.0 license link, followed by stubs for Terms & Conditions and Privacy Policy.
  - **Copyright** displays three stacked lines of text and links, including a link to `alvinresoso.com`.
  - The download or hosted-version buttons are clean and automatically hide on tablet/mobile screens (below `1024px`).
- **Legal Pages**: Clean, scrollable in-app modal views (or bottom sheets on mobile) displaying the Terms of Use and Privacy Policy documents, formatted to match the app's typography and color scheme.

---

## Functional Requirements
- **Legal Links in Auth**: In `src/pages/welcome/AuthOverlay.js`, wire the legal consent links to trigger in-app `LegalModal` overlays (preserving registration form state) rather than opening in new tabs.
- **Footer Redesign**: Re-create the layout, styling, and background of `src/components/Footer.js` to match the specifications in `docs/design/footer.md` and `docs/design/updates.md` (remove STACK section, place version inline, add GitHub feedback link, and wire legal stubs to launch in-app modals).
- **Asset Integration**: Reuse 042's existing full-color vector brand asset `alice-sigil-full.svg` at `src/assets/logo/alice-sigil-full.svg` (do not add duplicate assets).
- **Legal Content**: Render the Terms & Conditions and Privacy Policy inside the Vanilla JS application as static, read-only content defined in `src/data/legalContent.js` (including disclaimer banners requiring professional attorney review).
- **Unit Tests**: Update the assertions in `tests/components/Footer.test.js` to verify the presence of the new brand text, version display, GitHub link, stubs, and copyright block, and write a new unit test suite `LegalModal.test.js` to assert overlay mounting and scroll locking.

---

## Technical Notes
- Follow the Vanilla JS + Vite project setup.
- Follow Project Constitution constraints regarding local-first architecture and no tracking/analytics.
- Apply the following CSS background recipe to `.site-footer` in `src/styles/main.css`:
  ```css
  background:
    radial-gradient(circle at 12% 10%, rgba(129, 140, 248, 0.38), transparent 52%),
    radial-gradient(circle at 90% 90%, rgba(129, 140, 248, 0.28), transparent 50%),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.05) 0px, rgba(255, 255, 255, 0.05) 1px, transparent 1px, transparent 40px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0px, rgba(255, 255, 255, 0.05) 1px, transparent 1px, transparent 40px),
    var(--navy-deep);
  ```

---

## Edge Cases
- Styling of the legal text inside modal containers on narrow mobile screen viewports (reflowing into a bottom sheet with rounded top corners and a centered drag handle).
- Scroll lock conflict prevention when the legal modal opens on top of an existing overlay (e.g. `AuthOverlay`).
- Focus trapping and keyboard navigation cycle inside the active dialog, restoring focus to the triggering element on escape or close.
- Branch sequencing: holding 043 implementation until 042 merges, then rebasing 043 onto `main` to align file modifications.

---

## Success Criteria
- Active, correct legal document links exist on both the signup form and global footer.
- The footer matches the visual, layout, and background styles outlined in the Claude Design handoff.
- The unit tests in `tests/components/Footer.test.js` pass successfully with updated assertions matching the new layout and link structure.
- All unit, integration, and build tests pass successfully.
