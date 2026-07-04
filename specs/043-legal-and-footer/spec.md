# Feature Specification: Legal Docs & Footer

**Feature Branch**: `043-legal-and-footer`  
**Created**: 2026-07-04  
**Status**: Draft  
**Input**: docs/features/043-legal-and-footer.md

---

## Clarifications

### Session 2026-07-04

- **Q: Should we remove the STACK column entirely as specified in Claude design's handoff (which reduces height), or keep it?** $\rightarrow$ A: **Remove the STACK column entirely** as shown in the design handoff mockup to reduce the vertical footprint.
- **Q: What placeholder text should we use for Terms of Use and Privacy Policy?** $\rightarrow$ A: **Writing realistic developer-drafted placeholder copy with prominent legal disclaimers is in-scope** for this feature. We will research and draft realistic copies that respect Project Alice's local-first, privacy-respecting, and non-commercial nature.
- **Q: Should the welcome page mini-footer be updated?** $\rightarrow$ A: **Yes**, update the welcome page mini-footer in `WelcomePage.js` to also include active links to the Terms & Conditions and Privacy Policy.
- **Q: How should the legal pages be routed?** $\rightarrow$ A: **In-app modal dialogs**. Clicking "Terms & Conditions" or "Privacy Policy" in the footer (or signup overlay / welcome mini-footer) opens a responsive centered modal dialog (or bottom sheet on mobile) mounted directly on the DOM rather than navigating to static HTML pages in new tabs.

---

## Problem Statement

Project Alice needs to fulfill standard compliance and user transparency goals by providing native, readable Terms & Conditions and Privacy Policy documents. Rather than navigating away to external static pages, these documents must be displayable inside the single-page application as accessible, responsive modals (or mobile bottom sheets) from any page.

Additionally, the existing global footer has a large vertical footprint and displays static tech stack listings that do not fully align with the current architecture. It also lacks a direct GitHub repository link. Recreating the footer to match Claude's visual refresh will reduce height, utilize the vector sigil, dynamically group the metadata, and introduce a premium visual spotlight-and-grid background.

---

## Scope

### In Scope
- **Legal Content Drafting**: Research and write realistic, static (pre-written, non-dynamically generated) developer-drafted placeholder copy with prominent legal-review disclaimers (structured as high-contrast dark text `#4B5563` on a white surface `#FFFFFF` with a navy `#1A1A2E` header) for both the Terms & Conditions (`v0.3.0 · Effective Apr 1, 2026`) and the Privacy Policy (`v0.2.1 · Effective Mar 15, 2026`) reflecting Project Alice's local-first data storage (SQLite/localStorage), private data ownership, and non-commercial scope. These documents are completely static resources and must not be dynamically built by code.
- **Global Legal Modal Component**: Implement `src/components/LegalModal.js` to render the legal content:
  - **Desktop/Tablet View (>=640px)**: Centered overlay modal (`max-width: 660px` on desktop, `max-width: 480px` on tablet), rounded corners (`14px`), backdrop blur overlay (`rgba(8,8,24,.52)`, `backdrop-filter: blur(3px)`), custom header with close button (✕), scrollable body content, and footer bar containing a close action button and metadata hint.
  - **Mobile View (<640px)**: Bottom sheet pinned to the bottom edge (`max-height: 82vh`, `max-width: 100%`), rounded top corners (`14px 14px 0 0`), drag handle pill (`36x4px`, `#ffffff` at 35% opacity) centered in the header.
- **Keyboard & Focus Handling**: Focus trapping inside the active modal, keyboard tabbing, modal closing via `Escape` key, and restoring focus to the triggering element upon closure.
- **Scroll Locking**: Lock background body scroll (`overflow: hidden` on `document.body`) while either modal is open.
- **Auth Overlay Legal Notice**: Refactor the notice in `src/pages/welcome/AuthOverlay.js` to render "terms of use" and "privacy policy" as active, styled triggers that open the corresponding modal dialogs.
- **Welcome Mini-Footer Links**: Refactor the mini-footer in `src/pages/welcome/WelcomePage.js` to render clickable "Terms & Conditions" and "Privacy Policy" triggers that open the modal dialogs.
- **Global Footer Redesign**: Re-create `src/components/Footer.js` and update `src/styles/main.css` to implement the Claude Design handoff:
  - Swap the raster logo for the color vector sigil (`alice-sigil-full.svg` at `64x64px`).
  - Vertically center the brand details and place the version inline below the tagline.
  - Remove the `STACK` section and the horizontal separator rule.
  - Add a new `GitHub` link to the Feedback section (pointing to the repository root).
  - Add clickable triggers to `Terms & Conditions` and `Privacy Policy` in the License section.
  - Structure copyright into 3 stacked lines with an active link to `alvinresoso.com`.
  - Display the layered spotlight and grid background on the `--navy-deep` base.
  - Update the download/hosted buttons text, font sizes, and hide them below `1024px`.
- **Footer Unit Tests**: Update `tests/components/Footer.test.js` to assert the updated DOM layout, Feedback section links, License section links, version placement, and copyright lines.

### Non-Goals
- Finalized, legally binding contracts in this phase (realistic developer-drafted placeholder copy with prominent legal disclaimers is used; formal attorney review is out-of-scope).
- Integrating user terms-acceptance logging in the SQLite or Supabase databases (consent is expressed via signup UI notice).
- Client-side URL routing (e.g. `/terms` path routing) for the modals (state is managed dynamically within the SPA via DOM injection).

---

## User Behavior

### 1. Signup Form Consent & Review
- A new user clicks "Sign Up" on the Welcome page.
- The `AuthOverlay` modal displays. Below the signup form, the user sees: *"By creating an account, you agree to the terms of use and privacy policy."*
- Clicking "terms of use" or "privacy policy" overlays the corresponding `LegalModal` dialog on top of the AuthOverlay.
- Body scroll on the background page remains locked. The user traps focus inside the legal modal, reviews the text, and dismisses it using the close button (✕), bottom close button, backdrop click, or pressing `Escape`.
- Upon dismissal, the `LegalModal` unmounts. Focus returns to the clicked link inside `AuthOverlay`, and the user's populated form inputs remain intact.

### 2. General Footer Review
- A user scrolls to the bottom of the Tracker, Calendar, or Profile page and clicks "Terms & Conditions" or "Privacy Policy" in the footer.
- The `LegalModal` opens, locking body scroll.
- The user reads the document and closes it. Focus returns to the footer link.

### 3. Welcome Page Landing Review
- A visitor on the Welcome page scrolls to the mini-footer metadata line and clicks "Terms & Conditions" or "Privacy Policy".
- The `LegalModal` opens, locking body scroll.
- The user reads the document and closes it. Focus returns to the mini-footer link.

---

## Acceptance Criteria

### User Story 1 - Auth Consent Modal Trigger (Priority: P1)
As a new user signing up, I want to review the Terms of Use and Privacy Policy directly from the signup overlay without losing my entered form data.
- **Independent Test**: Open AuthOverlay, select Signup, click "terms of use" and "privacy policy", verify the modal displays on top, close it, and verify that signup form inputs are preserved and focus returns to the clicked link.
- **Acceptance Scenarios**:
  - **Given** the user is viewing the signup form in `AuthOverlay`, **When** the modal renders, **Then** the legal consent line MUST be displayed at the bottom.
  - **Given** the terms/privacy links in `AuthOverlay`, **When** clicked, **Then** the corresponding legal modal MUST open on top, preserving the underlying `AuthOverlay` state.

### User Story 2 - Redesigned Footer (Priority: P2)
As any user, I want a premium and compact global footer that displays system info, feedback routes, and legal modal triggers on all main pages.
- **Independent Test**: Log into the application, view the footer, verify that version details are inline, check that STACK is removed, check that clicking Terms & Conditions/Privacy Policy opens the respective modal, and ensure the download button disappears when viewport is <= 1023px.
- **Acceptance Scenarios**:
  - **Given** the global footer is rendered, **When** viewed on desktop (>=1024px), **Then** it MUST display three grid columns (Feedback, License, Copyright) with the spotlight background and vector sigil.
  - **Given** the Feedback column, **When** inspected, **Then** it MUST show GitHub as the first link, followed by Report an issue and Request a feature.
  - **Given** the License column, **When** inspected, **Then** it MUST show PolyForm Noncommercial 1.0.0, Terms & Conditions, and Privacy Policy links.
  - **Given** viewport width <= 1023px, **When** the footer renders, **Then** the download/hosted button MUST be hidden (`display: none`).
  - **Given** viewport width <= 640px, **When** the footer renders, **Then** the column count MUST reflow to 2 columns (Feedback and License side-by-side, brand row and copyright spanning full-width).

### User Story 3 - Welcome Page Mini-Footer Links (Priority: P3)
As a visitor on the welcome/landing page, I want to find links to the Terms & Conditions and Privacy Policy at the bottom of the page, so I can review them easily.
- **Independent Test**: Open the welcome page, scroll to the bottom metadata line, verify "Terms & Conditions" and "Privacy Policy" are rendered, click them, and verify they open the modal dialogs.
- **Acceptance Scenarios**:
  - **Given** the welcome page is loaded, **When** the mini-footer renders, **Then** it MUST display active links for "Terms & Conditions" and "Privacy Policy" next to the license and feedback links.
  - **Given** the welcome page mini-footer links, **When** clicked, **Then** they MUST open the corresponding modal dialog.

### User Story 4 - Responsive Legal Modals (Priority: P2)
As a user reviewing terms, I want to read clean, high-contrast documents (dark text on a white surface, navy header) formatted for readability across desktop, tablet, and mobile screens.
- **Independent Test**: Open terms or privacy modal, check typography and colors, scale viewport width to tablet (768px) and mobile (375px), and verify the layout conforms to the design specifications (centered modal vs bottom sheet).
- **Acceptance Scenarios**:
  - **Given** a screen width >= 640px, **When** the legal modal opens, **Then** it MUST display as a centered dialog with rounded corners (14px), max-width (660px desktop, 480px tablet), and max-height (90vh desktop, 86vh tablet) with a viewport split at 1024px width.
  - **Given** the modal dialog component, **When** rendered, **Then** it MUST include standard ARIA attributes: `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` linking to the header title.
  - **Given** the trigger buttons and links, **When** rendered, **Then** they MUST have accessible names and support keyboard focus outline styling.
  - **Given** a screen width < 640px, **When** the legal modal opens, **Then** it MUST display as a bottom sheet pinned to the bottom edge with rounded top corners, a centered drag handle (`36x4px` at 35% opacity), and max-height of 82vh.
  - **Given** the modal body, **When** rendered, **Then** it MUST display the detailed legal clauses (including Acceptance, Account, Collection, and Storage sections) using high-contrast dark text (#4B5563) on a white background (#FFFFFF) with a navy header (#1A1A2E).

---

## Edge Cases

- **Body Scroll Lock / Unlock**: Body scroll MUST be locked (`overflow: hidden` on `body`) while a modal is open, and restored when all modals are closed.
- **Modal Closure Paths**: The modal MUST close via: close button (✕) in header, "Close" button in footer, clicking the backdrop, or pressing `Escape`.
- **Keyboard Focus Trapping**: Tabbing MUST cycle only through focusable elements inside the active modal dialog (header close ✕ and footer close button).
- **Multiple Modals**: If a legal modal is opened while another modal is active, the active modal must not break or cause styling/overlay conflicts.

---

## Data Considerations

- No database schemas, columns, or data models are introduced.
- The legal documents MUST be static text or static assets, and are not dynamically parameterized or built at runtime.
- In compliance with the Project Constitution, the legal modal script and content MUST NOT run any external analytics, load non-local scripts, or use tracking cookies.
