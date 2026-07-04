# Research & Tech Decisions: Legal Docs & Footer

This document records the technical investigations and architectural decisions for implementing Feature 043.

---

## 1. Modular In-App Legal Dialogs (Issue #107)

### Decision
Implement the Terms & Conditions and Privacy Policy as a globally importable component `src/components/LegalModal.js` that dynamically builds and returns the modal dialog (or bottom sheet on mobile) DOM tree under app-shell state control when triggered.

### Rationale
- Today, the application contains overlays such as `AuthOverlay.js` and `ConfirmDialog.js`. The legal document handoff package (`Alice_Legal.zip`) specifies that Terms & Conditions and Privacy Policy should be displayed inside a centered modal (desktop/tablet) or bottom sheet (mobile), rather than navigating away to static HTML files.
- Servicing this inside the single-page application (SPA) ensures the user never loses their current tab, page route, or populated registration details.
- To ensure ease of integration and keep state management clean:
  - The modal rendering is decoupled and managed under the shell-level state controller.
  - It will support scroll-locking by toggling `overflow: hidden` on the body.
  - It will support standard modal interactions: closing via backdrop click, the close button (✕) in the header, the "Close" button in the footer, or pressing `Escape`.
  - Tabbing focus will be trapped inside the modal to meet the accessibility rules in the Project Constitution.

### Alternatives Considered
- *Static HTML Pages in New Tabs*: Rejected. Although simple, it breaks the SPA experience and violates the high-fidelity designs provided in the Claude Design handoff, which specifies centered dialog containers and mobile bottom sheets with rounded corners.
- *Client-Side Router Routes (e.g. `/terms` path)*: Rejected. Introducing router libraries or client-side hash routing for read-only legal modals adds unnecessary complexity and violates the non-goal of keeping the app routing simple (no router library).

---

## 2. Global Footer Layout & Background Refresh (Issue #108)

### Decision
Refactor `src/components/Footer.js` and update `src/styles/main.css` to align with the compact 3-column layout, vector sigil, and spotlight-grid background specified in the Claude Design handoff (`Alice_FooterUpdate.zip`).

### Rationale
- Swapping the raster brand icon `Alice_White.png` for the color vector `alice-sigil-full.svg` at `64x64px` improves sharpness and legibility across high-density retina displays.
- Removing the STACK column and dissolving the version info into the brand row block significantly reduces the footer's vertical footprint.
- The Feedback section gains a direct GitHub repository link as the primary link.
- The License section replaces stub indicators with interactive triggers that update the shell-level dialog state by calling `setLegalDialog('terms' | 'privacy')`.
- Removing the horizontal rule (`.footer__rule`) simplifies the visual hierarchy, relying on grid row spacing instead.
- Pushing the copyright block to three stacked rows and changing the download/hosted buttons to hide on tablet/mobile screens (below `1024px`) ensures a clean, uncluttered layout on smaller viewports.
- The spotlight background uses radial-gradient overlays and grid-line CSS to give the app a premium, visual consistency matching the main hero section of the Welcome page.

### Alternatives Considered
- *Retaining the STACK column*: Rejected. While the original issue #108 asked to include SQLite in the stack list, the design review concluded that removing the STACK section entirely is necessary to achieve a compact, modernized design footprint.
