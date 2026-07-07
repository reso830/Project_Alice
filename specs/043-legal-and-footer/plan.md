# Implementation Plan: Legal Docs & Footer

**Branch**: `043-legal-and-footer` | **Date**: 2026-07-04 | **Spec**: [spec.md](file:///D:/Alvin/_CodeProjects/Project_Alice/.antigravity/worktrees/043-legal-and-footer/specs/043-legal-and-footer/spec.md)\
**Input**: Feature specification from `/specs/043-legal-and-footer/spec.md`

---

## Summary
Implement a global `LegalModal` component to render static Terms & Conditions and Privacy Policy documents inside the Vanilla JS application, with layout options matching desktop/tablet modals and mobile bottom sheets. Re-create the application's global footer according to Claude's high-fidelity design specifications (vector brand sigil, 3-column layout, removal of the STACK section, and spotlight-grid CSS background). Connect the legal triggers in both the global footer, signup auth overlay, and welcome page mini-footer, and verify correctness with updated unit tests.

> [!IMPORTANT]
> **Branch & Merge Sequencing Plan (MAJOR-2):**\
> Since Feature 043 modifies files with active uncommitted changes in Feature 042 (`Footer.js`, `AuthOverlay.js`, `WelcomePage.js`, `main.css`), implementation of Feature 043 must be held until Feature 042 is merged to the main branch. Once 042 merges, this worktree/branch MUST be rebased onto `main` before starting tasks.

---

## Technical Context
- **Language/Version**: JavaScript (ES6+), Vanilla DOM API
- **Primary Dependencies**: Vite, PostCSS/Vanilla CSS
- **Storage**: N/A (this feature does not touch the data persistence layer)
- **Testing**: Vitest
- **Target Platform**: Desktop and Mobile browsers (Chrome, Safari, Firefox, Edge)
- **Project Type**: Web application frontend

---

## Constitution Check

- **Required-field impact**: This feature does not modify, add, or retrieve any job application records or profile data, meaning there is zero impact on constitution-mandated fields (`companyName`, `jobTitle`, `status`, `lastStatusUpdate`, `responsibilities`).
- ** Centralized validation**: N/A. No input forms or data modifications are introduced.
- **Dependency justification**: No new external dependencies are added. All icons, layout controls, and styles are implemented natively using CSS and standard Vanilla JS elements, satisfying the bloat-free and local-first requirements.
- **Privacy check**: The legal documents and scripts contain no remote pixels, telemetry trackers, or external CDN integrations. All assets and content are served locally, adhering strictly to the local-first privacy rule.
- **Responsiveness & Accessibility**: Modals implement CSS breakpoints, mobile bottom sheet reflows, and keyboard focus trapping. Buttons and links support visible focus indicators.

---

## Architecture & Data Flow

### 1. Global Shell-Level State & `LegalModal` Component
To achieve global availability and coordinate modal stacking safely, dialog visibility is managed via shell-level state rather than direct, ad-hoc DOM mutation:
- **Central State Manager**: The app-shell controllers (specifically `src/main.js` for authenticated views, and `src/pages/welcome/WelcomePage.js` for landing/auth views) will maintain a state variable: `let _activeLegalDialog = null; // 'terms' | 'privacy' | null`.
- **Global Actions**: Expose a standard dispatch mechanism or shared function (`setLegalDialog(type)`) to update this state.
- **Stateless Renderer (`LegalModal.js`)**: A new component `src/components/LegalModal.js` will act as a stateless renderer. When the shell state changes:
  - If a dialog is selected, `LegalModal.render(type, onClose)` builds the modal markup (injecting static legal text), locks body scroll, configures ARIA attributes, binds focus traps, and appends the elements.
  - If state becomes `null`, the active dialog is unmounted, body scroll is restored, and focus is returned to the element that triggered it.

```text
[User Action: Click Link]
    │
    ▼
[State Change Dispatcher] ──► setLegalDialog('terms' | 'privacy') updates shell state
    │
    ▼
[App-Shell Controller] (src/main.js or WelcomePage.js)
    ├── 1. Tracks active dialog state
    ├── 2. Mounts/updates LegalModal with onClose callback
    └── 3. Unmounts LegalModal when state is set to null
            │
            ▼
      [LegalModal Render]
          ├── 1. Locks body scroll (overflow: hidden)
          ├── 2. Builds modal markup (dialog or mobile bottom sheet)
          ├── 3. Injects static pre-written disclaimer & legal text
          └── 4. Traps keyboard focus / binds Escape close listener
```

### 2. Static Content Definitions
The text content for both documents will be written as a static JS object constant inside `src/data/legalContent.js`:
- **Terms & Conditions**: Composed of 4 main sections (Acceptance of terms, Your account, Acceptable use, Changes to the service).
- **Privacy Policy**: Composed of 4 main sections (What we collect, How we use it, Storage & retention, Your choices).
- **Attorney Review Disclaimer**: A standard notice will be prepended to the top of both files explicitly stating that the document is developer-drafted placeholder copy and requires professional legal review before production use.

### 3. Welcome Page Mini-Footer & Auth Overlay Integration
- **`WelcomePage.js`**: Refactor `renderFooterMeta()` to render "Terms & Conditions" and "Privacy Policy" links. Clicking them calls `setLegalDialog('terms' | 'privacy')` on the Welcome Page's shell state.
- **`AuthOverlay.js`**: Replace the static legal text line with clickable anchors. Clicking them updates the parent page's shell state, rendering the modal on top of the auth overlay.
- **Page Context Isolation**: Closing the legal modal returns focus to the trigger link without unmounting `AuthOverlay` or clearing form inputs.

### 4. Global Footer Redesign
- Replace standard columns inside `src/components/Footer.js`.
- Remove STACK section and horizontal rule.
- Render version inline within the logo/brand block.
- Wire license section links to update the shell state by calling `setLegalDialog('terms' | 'privacy')`.
- Add spotlight styling, radial gradients, and faint grid overlays to `.site-footer` in `src/styles/main.css`.

---

## Project Structure

### Documentation (this feature)
```text
specs/043-legal-and-footer/
├── plan.md              # This file
├── research.md          # Technology decisions
└── checklists/
    └── plan-review.md   # Pre-implementation checklist
```

### Source Code
```text
src/
├── components/
│   ├── Footer.js                  # Updated footer layout, brand, and columns
│   └── LegalModal.js              # NEW global modal component for Terms & Privacy
├── data/
│   └── legalContent.js            # NEW static legal text definitions for Terms & Privacy
├── pages/
│   └── welcome/
│       ├── AuthOverlay.js         # Updated legal consent triggers
│       └── WelcomePage.js         # Updated mini-footer metadata links
└── styles/
    └── main.css                   # Added background spotlight, modal overlay, and bottom-sheet CSS

tests/
├── components/
│   ├── Footer.test.js             # Updated assertions matching the redesigned DOM
│   └── LegalModal.test.js         # NEW unit tests verifying modal mounting, scroll-lock, and close paths
```

---

## Affected Areas

### Files/Components to Inspect
- `src/main.js` (App shell mounting layout)
- `src/assets/logo/alice-sigil-full.svg` (Reuse 042's existing vector sigil; do not duplicate)
- `docs/design/footer.md` (Redesign reference specifications)
- `docs/design/updates.md` (Updates and Download button layout details)

### Files/Components to Modify
- `src/components/Footer.js` (Footer layout and links)
- `src/pages/welcome/AuthOverlay.js` (Signup terms text)
- `src/pages/welcome/WelcomePage.js` (Welcome landing mini-footer metadata)
- `src/styles/main.css` (Background and Modal styling)

### New Files to Add
- `src/data/legalContent.js` (Static Terms and Privacy document structure definitions)
- `src/components/LegalModal.js` (Interactive modal container and static legal copy)
- `tests/components/LegalModal.test.js` (Unit tests for the legal modal)

### Tests to Update
- `tests/components/Footer.test.js` (Update assertions for removed columns, GitHub feedback link, and legal link stubs)

### Areas Explicitly Out of Scope
- Server-side routes or SPA clean-URL path routing for the legal modals.
- Backend, SQLite persistence, or Supabase schema adjustments.
- Acceptance consent checkbox and DB logging tracking.

---

## Risks and Tradeoffs

1. **Scroll-Locking Conflicts**:
   - *Risk*: When a legal modal is opened from inside `AuthOverlay` (which is already a modal), closing the legal modal might unlock body scroll prematurely while `AuthOverlay` is still visible.
   - *Mitigation*: The scroll-lock helper should track a stack count of open modals or conditionally verify if `AuthOverlay` (or any other dialog) remains open in the DOM before restoring body scroll.
2. **Focus Management**:
   - *Risk*: Tabbing out of the modal can occur if keyboard events aren't strictly intercepted.
   - *Mitigation*: Trap focus programmatically by listening to the `keydown` Tab event on the modal container, cycling focus exclusively between the close button (✕) in the header and the Close button in the footer. Also, verify that triggers have accessible names, proper focus rings, and correct ARIA roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).
3. **Mockup CSS Breakpoints**:
   - *Risk*: The mockup HTML uses `@container` queries pure visualization boxes, which are container-width dependent.
   - *Mitigation*: The production app must translate these container-width queries into standard `@media` viewport queries (e.g. `@media (max-width: 1023px)`, `@media (max-width: 640px)`) to adapt correctly to the actual browser viewport width.
4. **Version Regression and Bump sequencing (MAJOR-1)**:
   - *Risk*: Bumping to a hardcoded patch version (e.g. `v1.10.9`) will conflict with Feature 042 which bumps the project to `v1.11.0`.
   - *Mitigation*: Dynamically target the next patch/minor version directly following 042's final release state (e.g. retarget version to `v1.11.1`).

---

## Validation Approach

1. **Unit Testing (`Footer.test.js`)**:
   - Update assertions to check that the vector sigil (`alice-sigil-full.svg`) is rendered, the STACK column is absent, a new GitHub feedback route exists, and Terms & Conditions and Privacy Policy links exist.
2. **Unit Testing (`LegalModal.test.js`)**:
   - Write tests to verify:
     - Opening modal appends `.legal-overlay` to `document.body` and sets `overflow: hidden` on the body.
     - Document contains correct static headers and section elements for the selected type.
     - Clicking backdrop, close button (✕), or pressing Escape removes overlay from the body.
3. **Manual Responsive Check**:
   - Load WelcomePage and Tracker Page. Inspect footers and overlays at:
     - Desktop (>1024px)
     - Tablet (640px - 1023px)
     - Mobile (<640px)
   - Ensure the modal transitions correctly into a bottom sheet on mobile screens.
