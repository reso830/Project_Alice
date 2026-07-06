# Feature Brief: 043 - Legal Docs & Footer

## Summary
Add native legal documents (Terms of Use and Privacy Policy) to Project Alice, link them directly from the signup overlay, and update the application's global footer to list the expanded system tech stack and provide persistent links to the new legal pages.

---

## Goals
- Add standard Terms of Use and Privacy Policy document files into the application workspace.
- Refactor the signup form in `AuthOverlay.js` to render the legal notice as clickable anchors that open the legal documents in new tabs.
- Update the global `Footer.js` to include SQLite (specifically `better-sqlite3`) in the listed technology stack.
- Integrate active links to the Terms of Use and Privacy Policy directly within the global footer.
- Ensure the layout of these new documents and links is fully responsive across desktop, tablet, and mobile viewports.

---

## Non-Goals
- Drafting finalized, legally binding contracts in this phase (placeholder templates will be used).
- Redesigning the entire footer visual layout (this is a content and link alignment update).

---

## User Experience
- **Signup Overlay**: The text *"By creating an account, you agree to the terms of use and privacy policy."* becomes active with underline/accent-colored links that open the respective pages in a new tab.
- **Global Footer**: A new section or links under a "Legal" label are added for direct access to Terms of Use and Privacy Policy. The "Stack" section gets updated to list SQLite / better-sqlite3.
- **Legal Pages**: Clean, scrollable text views displaying the Terms of Use and Privacy Policy documents, formatted to match the app's typography and color scheme.

---

## Functional Requirements
- **Legal Links in Auth**: Link to the legal pages in `src/pages/welcome/AuthOverlay.js` using `target="_blank" rel="noopener noreferrer"`.
- **Footer Updates**: Add the legal links and SQLite details in `src/components/Footer.js`.
- **Legal Content**: Place Terms of Use and Privacy Policy documents under a static or asset-serving directory.

---

## Technical Notes
- Follow the Vanilla JS + Vite project setup.
- Follow Project Constitution constraints regarding local-first architecture and no tracking/analytics.

---

## Edge Cases
- Styling of long-form legal text on narrow mobile viewport widths.
- Ensuring links correctly navigate when running under both Local (SQLite) and Hosted (Supabase/Vercel) runtimes.

---

## Success Criteria
- Active, correct legal document links exist on both the signup form and global footer.
- The footer accurately reflects the database persistence stack.
- All unit, integration, and build tests pass successfully.
