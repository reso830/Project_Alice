# Research: Pagination & Footer UI

**Feature**: 005-pagination-footer | **Date**: 2026-04-26

No external research was required. All decisions were resolved by reading the existing codebase (`src/`, `tests/`, `src/styles/main.css`) and the design specification (`design/pagination_footer.md`).

---

## Decision Log

### 1. Component authoring pattern

**Decision**: Follow the existing module pattern — a named export object with a `render()` factory method that returns a DOM element.

**Rationale**: Every existing component in the project uses this pattern (`Card`, `Navbar`, `Toolbar`, `Modal`, etc.). Consistency reduces cognitive load and keeps all components interchangeable.

**Alternatives considered**: Returning a class instance with lifecycle hooks — rejected because none of the existing components use this approach and it would introduce unnecessary overhead.

---

### 2. Pagination logic placement

**Decision**: Pure function `getPaginationModel(currentPage, totalEntries, pageSize)` in `src/utils/pagination.js`.

**Rationale**: The windowing algorithm in the design spec is a deterministic computation (given inputs → fixed output). Isolating it as a pure function makes it trivially unit-testable and keeps the `Pagination` component a thin renderer. This directly satisfies the constitution's separation-of-business-logic-from-UI requirement.

**Alternatives considered**: Embedding the algorithm inside the `Pagination.render()` function — rejected because it would make unit testing the algorithm impossible without rendering DOM nodes.

---

### 3. Pagination state ownership

**Decision**: `_currentPage` lives as a module-level variable in `src/pages/Tracker.js`, alongside the existing `_applications` variable.

**Rationale**: `_currentPage` is tightly coupled to the application list in the Tracker page — it has no meaning outside that context. The existing pattern uses module-level variables for page state (`_container`, `_cardList`, `_applications`). Keeping the same pattern avoids introducing a state management abstraction that no other page needs.

**Alternatives considered**: A shared state object or event bus — rejected because this feature only involves one page and adds complexity with no benefit.

---

### 4. Re-render strategy for pagination

**Decision**: Extract a `renderPage()` function in `Tracker.js`. On page change, this function removes the existing card list and pagination element and re-renders both from the current `_currentPage` and `_applications` state.

**Rationale**: The current `mount()` function builds the card list imperatively and has no re-render path. Adding a `renderPage()` function that can be called on both initial mount and page changes avoids duplicating the card-rendering logic and keeps the change localized to Tracker.js.

**Alternatives considered**: Surgical DOM update (remove/append individual cards) — rejected because it does not cleanly handle the pagination component appearing/disappearing as the window shifts.

---

### 5. Footer placement

**Decision**: `Footer.render()` is called once in `src/main.js` and appended to `document.body` after the `<main>` element.

**Rationale**: The footer is persistent across all pages (Tracker, Calendar, Profile). It does not participate in the page mount/unmount lifecycle. The app shell in `main.js` already mounts the `<navbar>` and `<main>` elements; mounting the footer there keeps all shell-level components in one place.

**Alternatives considered**: Rendering footer inside each page's `mount()` — rejected because it would duplicate the footer and require each page to remember to include it.

---

### 6. CSS strategy

**Decision**: Extend `src/styles/main.css` with pagination and footer styles. Use existing CSS custom properties where they match the design tokens. Add new custom properties (e.g. `--color-footer-bg`, `--color-footer-dim`) for tokens not already defined.

**Rationale**: The project has one global stylesheet with CSS custom properties and BEM-style naming. Introducing a separate stylesheet or CSS modules would split the styling without any benefit at this project scale.

**Alternatives considered**: CSS modules — rejected because no existing component uses them and Vite would need to be configured to handle them differently.

---

### 7. Scroll and focus mechanism

**Decision**: `window.scrollTo(0, 0)` is paired with programmatic focus movement to the top of the list region when `renderPage()` is triggered by a page change.

**Rationale**: `window.scrollTo(0, 0)` is already used in the existing `Tracker.mount()` function, making this the established scroll pattern in the codebase. Moving keyboard focus as well keeps keyboard and assistive-technology users aligned with the visible page change.

**Alternatives considered**: Element `ref.scrollIntoView()` — rejected for consistency with the existing implementation.

---

### 8. Dataset change page preservation

**Decision**: Preserve `_currentPage` when the displayed dataset changes and the page still exists. If the current page becomes invalid, clamp to the highest valid page; if pagination disappears, use page `1`.

**Rationale**: This avoids unnecessary jumps for users who are reviewing a page that remains valid, while preventing empty pages after archives, filters, or reloads shrink the result set.

**Alternatives considered**: Resetting to page `1` on every dataset change — rejected because it loses useful user context when the current page remains valid.

---

### 9. Testing approach

**Decision**: Vitest unit tests cover `getPaginationModel()` in `tests/utils/pagination.test.js`, and jsdom component tests cover the Pagination and Footer DOM renderers. Pagination model cases cover all page positions documented in the design spec (page 1, 2, 3, 4, 5, 9, 10 of a 10-page set), boundary conditions (exactly 10 entries, exactly 11 entries), and the `hasPagination` flag. Component tests cover pagination visibility, active-page accessibility attributes, non-interactive ellipses, footer links, and footer copyright text.

**Rationale**: The windowing algorithm is the highest-risk logic and needs deterministic unit coverage. Lightweight jsdom tests add confidence that the new DOM factories expose the required accessibility attributes and links without requiring a browser for every assertion.

**Alternatives considered**: Manual-only DOM verification — rejected because footer link targets and pagination accessibility attributes are cheap to verify automatically once `jsdom` is installed as a dev-only dependency.
