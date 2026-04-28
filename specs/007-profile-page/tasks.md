# Tasks: Profile Page

**Input**: Design documents from `specs/007-profile-page/`  
**Branch**: `007-profile-page`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: `tests/models/profile.test.js`, `tests/server/profile.test.js`, and `tests/services/api.test.js` profile coverage are REQUIRED by the project constitution � this feature introduces form validation and SQLite-backed profile persistence. Write tests before implementing the functions they cover.

**Note on nav**: The topbar already has a Profile button (`data-page="profile"`) and `Navbar.setActive()` already handles the active state. No nav changes are needed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1–US5)
- Exact file paths are included in every description

---

## Phase 1: Setup

**Purpose**: Extend the router and wire the navigate callback that every page depends on.

- [X] T001 Extend `src/main.js`: import `ProfileEdit` from `./pages/ProfileEdit.js`; update the existing `Profile.mount(appRoot)` call to `Profile.mount(appRoot, { navigate })`; add a `'profile-edit'` branch that calls `ProfileEdit.mount(appRoot, { navigate })` and `return`s before `Navbar.setActive()` — the navigate function is already in scope as a local function and can be passed by reference

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure-function logic, SQLite-backed profile persistence, API client coverage, and CSS layout tokens. All user stories depend on this phase.

**CRITICAL**: Write the test files (T002, T064, T067) and make them fail before implementing the model, server persistence, and API client changes they cover.

- [X] T002 [P] Write `tests/models/profile.test.js`: unit tests for `validateProfile` (missing firstName, missing lastName, bad email format, valid full object), `normaliseProfile` (trimming, undefined arrays → `[]`), `computeAppCounts` (counts each status slug), and `computeStats` (`phone_screen + interview + assessment` = active; `applied` = pending; `offer` = offer; `wishlisted` counts toward total; empty input = all zeros) — tests MUST FAIL before T003
- [X] T003 Create `src/models/profile.js`: implement `validateProfile`, `normaliseProfile`, `computeAppCounts`, `computeStats` to make T002 pass; also export `STATUS_COLORS` (`{ wishlisted: '#9333ea', applied: '#3b82f6', phone_screen: '#ea580c', interview: '#d97706', assessment: '#7c3aed', offer: '#16a34a', rejected: '#dc2626', withdrawn: '#64748b', ghosted: '#94a3b8' }`) and `STATUS_LABELS` (`{ phone_screen: 'Screening', wishlisted: 'Wishlist', applied: 'Applied', interview: 'Interview', assessment: 'Assessment', offer: 'Offer', rejected: 'Rejected', withdrawn: 'Withdrawn', ghosted: 'Ghosted' }`)
- [X] T004 [P] Create SQLite-backed profile persistence and routes: add `server/db/profile.js` with get/upsert helpers, add `server/routes/profile.js` with `GET /api/profile` and `PUT /api/profile`, wire the route in `server/index.js`, validate with `validateProfile()` before writes, return `null` when no profile exists, and do not use browser `localStorage` or `sessionStorage` for profile data
- [X] T064 [P] Write `tests/server/profile.test.js`: tests for missing profile returning `null`, valid profile save/read round trip through SQLite/API, invalid missing `firstName` returning `{ ok: false, errors }` without writing, and profile persistence after reopening the SQLite database � tests MUST FAIL before T004 implementation is complete
- [X] T067 [P] Update `src/services/api.js` and `tests/services/api.test.js`: add `getProfile()` and `saveProfile(data)` wrappers for `/api/profile`; tests verify request methods, JSON handling, validation error propagation, and no browser storage use � tests MUST FAIL before API wrapper implementation is complete
- [X] T005 [P] Add CSS layout foundation in `src/styles/main.css`: `.profile-page` (max-width 1120px, margin auto, horizontal padding 28px desktop / 14px mobile), `.profile-edit-page` (max-width 680px), `.section-card` (background `#fff`, border `1px solid #e0ddd8`, border-radius 10px, padding 22px desktop / 16px mobile), `.section-card__header` (flex row, align-items center), gap between section cards 24px desktop / 18px mobile; add `@media (max-width: 639px)` rules for responsive switching

**Checkpoint**: Run `npm run test:run` � `tests/models/profile.test.js`, `tests/server/profile.test.js`, and profile API service tests must pass before proceeding.

---

## Phase 3: User Story 1 — First-time user, no-profile state (Priority: P1) 🎯 MVP

**Goal**: A user with no profile saved sees the Profile page: welcome heading without name, an applications summary showing counts from the API, and a profile card with an empty state and a "Set Up Profile" CTA.

**Independent Test**: Run the app with `GET /api/profile` returning no saved profile. Navigate to Profile. Heading must read "Welcome back.", applications card must show stat chips with counts matching the Tracker (including wishlisted in Total), profile card must show empty state with "Set Up Profile" button. Clicking "Set Up Profile" must open the edit page.

- [X] T006 [US1] Create `src/pages/Profile.js` (full rewrite): `mount(container, { navigate })` fetches `api.getAll()` and `api.getProfile()`, renders `.profile-page` wrapper, then calls internal render helpers; module-level `_container = null` and `_dismissTimer = null`; `unmount()` clears `_container` and cancels `_dismissTimer`; all user-supplied text rendered via `textContent` only
- [X] T007 [P] [US1] Add welcome heading in `src/pages/Profile.js`: if no profile, render `<h1>Welcome back.</h1>`; if profile exists, render `<h1>Welcome back, {firstName}.</h1>` with `<p class="profile-subline">Here's where things stand today.</p>` below it (font Sora 28px/22px mobile, weight 700; subline 13px muted `#999`)
- [X] T008 [US1] Add Applications section card in `src/pages/Profile.js`: `.section-card` with header row (`APPLICATIONS` label 11px uppercase weight 700 + right-aligned "Go to Tracker" primary button); below header, a stat chips row — call `computeAppCounts(applications)` then `computeStats(counts)` and render four `.stat-chip` elements for Total (navy, includes wishlisted), Active (amber `#d97706`), Pending (blue `#3b82f6`), Offer (green `#16a34a`) with numeric value and label; while `api.getAll()` is in flight, show a loading indicator in place of stat chips
- [X] T009 [US1] Wire "Go to Tracker" button in `src/pages/Profile.js`: button click calls `navigate('tracker')` using the injected callback received in `mount`
- [X] T010 [US1] Add Profile section card skeleton in `src/pages/Profile.js`: `.section-card` with header row (`PROFILE` label 11px uppercase weight 700; right side empty when no profile, "Edit Profile" outline button when profile exists)
- [X] T011 [US1] Render empty state inside profile section card when the profile API returns `null` in `src/pages/Profile.js`: 52px circle muted person icon, `<p>No profile set up yet.</p>` (weight 700), `<p>Add your background to strengthen your applications.</p>` (muted), primary "Set Up Profile" button; center all items; render text via `textContent`
- [X] T012 [US1] Wire "Set Up Profile" and "Edit Profile" buttons in `src/pages/Profile.js` to call `navigate('profile-edit')` via the injected callback
- [X] T013 [US1] Handle `api.getAll()` failure in `src/pages/Profile.js`: if the fetch rejects or returns an empty array, show stat chips with zeros and a brief empty-state message in the chart area; do not crash or leave the applications card blank

**Checkpoint**: User Story 1 is independently testable. Stat chips show API counts (wishlisted included in Total). Empty profile card + CTA visible. Loading state shows while API is in flight. "Go to Tracker" and "Set Up Profile" navigate correctly.

---

## Phase 4: User Story 3 — Application pipeline summary visualization (Priority: P1)

**Goal**: The applications section shows a donut chart with hover interactions on desktop and a horizontal stacked bar with tap interactions on mobile. Counts and colours match the spec. Both are rendered in the DOM simultaneously; CSS media queries control which is visible.

**Independent Test**: With applications across multiple statuses, open Profile on desktop (≥640px) — donut chart is visible; hover a slice — tooltip appears near cursor and others dim; hover a legend item — matching slice highlights. On mobile (<640px) — stacked bar is visible; tap a segment — inline label appears and auto-dismisses after 2s.

- [X] T065 [P] [US3] Write `tests/components/DonutChart.test.js`: unit tests for arc path helpers — single 100% segment (must render as two arcs per SVG convention to avoid degenerate path), two equal segments (each ~50%), rounding (segment percentages must sum to exactly 100%), zero-count status is skipped (not rendered as a path) — MUST FAIL before T014 arc implementation
- [X] T014 [P] [US3] Create `src/components/DonutChart.js`: `render(options)` accepts `{ counts, colors, labels, size=160, holeRatio=0.55, onHover }`; compute arc paths from percentage of total (skip zero-count statuses; handle the 100% single-segment case as two arcs); render SVG `<path>` elements per status; attach `mouseover` and `mousemove` listeners that fire `onHover(status, el, pct, event)` and a `mouseleave` on `<svg>` that fires `onHover(null, null, 0, null)`; return `{ el: SVGElement, update(hoveredStatus) }` where `update()` applies highlight (full opacity) / dim (opacity 0.4) styling
- [X] T015 [P] [US3] Create `src/components/StackedBar.js`: `render(options)` accepts `{ counts, colors, labels, onTap }`; render a flex row of `<div>` segments sized by percentage; each segment has `click` and `touchend` listeners that call `onTap(status, count, pct)`; skip zero-count statuses; return the container `HTMLElement`; render segment label text via `textContent`
- [X] T016 [US3] Add two-column desktop applications layout in `src/pages/Profile.js`: wrap in `.apps-desktop-vis`; left column = stat chips (with right border separator); right column = `DonutChart.render(...)` + legend grid (2-column, color swatch + label per status); `.apps-desktop-vis` is shown by default and hidden at `@media (max-width: 639px)`
- [X] T017 [US3] Add mobile applications layout in `src/pages/Profile.js`: wrap in `.apps-mobile-vis`; stat chips in a row, then `StackedBar.render(...)` at full width (28px tall), then 2-column legend grid; `.apps-mobile-vis` is hidden by default and shown at `@media (max-width: 639px)`
- [X] T018 [US3] Add responsive display rules in `src/styles/main.css`: `.apps-desktop-vis { display: flex; }` and `.apps-mobile-vis { display: none; }` at base; inside `@media (max-width: 639px)`: `.apps-desktop-vis { display: none; }` and `.apps-mobile-vis { display: block; }` — no JS resize listener needed; both components remain mounted
- [X] T019 [US3] Implement `DonutChart.js` hover: `mouseover` and `mousemove` on `<path>` fire `onHover(status, el, pct, event)`; `mouseleave` on `<svg>` fires `onHover(null, null, 0, null)`; `update(hoveredStatus)` sets hovered path to full opacity and all others to 0.4; `update(null)` resets all to full opacity
- [X] T020 [US3] Implement floating tooltip in `src/pages/Profile.js`: on `onHover(status, el, pct, event)` when status is non-null, position a `.chart-tooltip` div using `event.clientX + 12` and `event.clientY - 28` (relative to viewport via `position: fixed`); content `"{Label} · {count} ({pct}%)"` set via `textContent`; hide tooltip when `onHover(null, ...)` fires; tooltip must be appended to `document.body` and removed in `unmount()`
- [X] T021 [US3] Implement `DonutChart.js` legend cross-highlight in `src/pages/Profile.js`: `mouseover` on a legend row calls `donutChart.update(status)`; `mouseleave` calls `donutChart.update(null)`
- [X] T022 [US3] Implement `StackedBar.js` `onTap` handler in `src/pages/Profile.js`: show a `.bar-tap-label` div below the bar with `"{Label} · {count} ({pct}%)"` set via `textContent`; store timer ref in `_dismissTimer`; cancel previous timer before setting new one; auto-dismiss after 2000ms
- [X] T023 [US3] Implement `StackedBar.js` legend tap in `src/pages/Profile.js`: legend item click fires the same `onTap` callback as tapping the corresponding bar segment

**Checkpoint**: User Story 3 fully functional. Desktop chart hover + cursor-tracked tooltip work. Mobile tap label appears and dismisses. Both layouts rendered; CSS controls visibility. All counts match Tracker data.

---

## Phase 5: User Story 2 — Profile-exists state (Priority: P1)

**Goal**: When a profile is saved, the page shows "Welcome back, {firstName}.", the profile section renders the basic info block and all populated sub-sections. "Edit Profile" button is visible.

**Independent Test**: Save a profile through `PUT /api/profile` or a mocked `api.getProfile()` response. Reload Profile page. Heading reads "Welcome back, Alex." All non-empty profile sub-sections render with correct content. "Edit Profile" button is visible.

- [X] T024 [US2] Refactor profile section rendering in `src/pages/Profile.js` to branch on API profile result: in the profile-exists path, render the Basic Info block and all sub-sections; in the no-profile path, render the existing empty state from T011
- [X] T025 [US2] Build Basic Info block in `src/pages/Profile.js`: 52×52px initials avatar (`.profile-avatar`, `background #4F46E5`, `border-radius 50%`, `DM Mono` weight 700 uppercase initials from `firstName[0] + lastName[0]`); name set via `textContent` (16px weight 700); city (📍), phone (📞), email (✉) each set via `textContent` (11px `DM Mono` muted); omit any field that is empty
- [X] T026 [P] [US2] Build reusable sub-section renderer in `src/pages/Profile.js`: function `renderSubSection(label, contentEl)` returns a `.profile-subsection` div with a `.profile-subsection__label` row (label text set via `textContent`, 11px uppercase weight 700 Sora) and a `.profile-subsection__content` area; add `1px solid #f5f3f0` top border between sub-sections
- [X] T027 [P] [US2] Render Summary sub-section using `renderSubSection()`: content is a `<p>` with `textContent = profile.summary`; skip section if `profile.summary` is empty
- [X] T028 [P] [US2] Render Professional Experience sub-section using `renderSubSection()`: content is a list of entries, each showing role (weight 700), company, period, and desc — all set via `textContent`; skip section if `profile.experience` array is empty
- [X] T029 [P] [US2] Render Education sub-section using `renderSubSection()`: content is a list of entries showing degree, school, year — all via `textContent`; skip if `profile.education` is empty
- [X] T030 [P] [US2] Render Skills sub-section using `renderSubSection()`: content is a flex-wrap row of `.pill-tag` spans for each string in `profile.skills` — text via `textContent`; skip if empty
- [X] T031 [P] [US2] Render Certifications sub-section using `renderSubSection()`: content is a `<ul>` with indigo bullet dots (`color: #4F46E5`) for each string in `profile.certifications` — text via `textContent`; skip if empty
- [X] T032 [P] [US2] Render Awards sub-section using `renderSubSection()`: content is a `<ul>` with amber bullet dots (`color: #d97706`) for each string in `profile.awards` — text via `textContent`; skip if empty
- [X] T033 [P] [US2] Render Languages sub-section using `renderSubSection()`: content is a flex-wrap row of `.pill-tag` spans for each string in `profile.languages` — text via `textContent`; skip if empty
- [X] T034 [US2] Render Links sub-section using `renderSubSection()`: content is a flex-wrap row of `.link-chip` anchors for each `{ platform, label, url }` entry; platform text via `textContent` (9px uppercase muted `#bbb`), URL label via `textContent` (11px `DM Mono`); `target="_blank" rel="noopener noreferrer"`; skip if `profile.links` is empty
- [X] T035 [US2] Wire "Edit Profile" outline button in `src/pages/Profile.js` profile section header to call `navigate('profile-edit')` via the injected callback
- [X] T036 [US2] Verify welcome heading switches correctly: run Profile.js with a mocked or API-backed saved profile � heading uses `{firstName}`; run with no saved profile � heading reverts to "Welcome back." with no sub-line; no console errors in either state

**Checkpoint**: User Story 2 fully functional. Profile-exists state renders all sections. Empty sub-sections are hidden. All text rendered via textContent. "Edit Profile" navigates correctly.

---

## Phase 6: User Story 4 — Edit / Setup Profile page (Priority: P2)

**Goal**: Both "Set Up Profile" and "Edit Profile" navigate to the same Edit Profile page with a custom topbar (back button + title), stacked section cards, and real inputs for Basic Info and Summary. Saving any card uses the read-merge-write pattern so other profile fields are never overwritten.

**Independent Test**: Navigate to Edit Profile from both CTA buttons. Custom topbar renders (no primary nav visible). Fill First Name + Last Name in Basic Info card, click Save � profile is written through `PUT /api/profile` and the page stays. Click "Back to Profile" � returns to Profile page. Profile page now shows "Welcome back, {firstName}."

- [X] T037 [US4] Create `src/pages/ProfileEdit.js` skeleton: `mount(container, { navigate })` hides `document.querySelector('.navbar')` (set `style.display = 'none'`), inserts `<header class="profile-edit-nav">` as `document.body.insertBefore(header, document.querySelector('#app'))`, renders edit page body into `container`; `unmount()` removes the custom header, restores navbar display, clears container
- [X] T038 [US4] Build edit-page custom topbar in `src/pages/ProfileEdit.js`: `<header class="profile-edit-nav">` with ghost button `← Back to Profile` (left-aligned, text via `textContent`) and `<span>Edit Profile</span>` title text; match navbar height (48px) and dark navy background (`#1a1a2e`)
- [X] T039 [US4] Wire "← Back to Profile" button in `src/pages/ProfileEdit.js` to call `navigate('profile')` via the injected callback
- [X] T040 [US4] Add edit page body in `src/pages/ProfileEdit.js`: `.profile-edit-page` wrapper (max-width 680px, centered); `<div class="edit-notice">` with text set via `textContent`: "This page is a placeholder — details to be designed in a later iteration."; stacked `.section-card` elements below
- [X] T041 [US4] Create Basic Info form card in `src/pages/ProfileEdit.js`: `.section-card` with 11px uppercase title "BASIC INFO"; labeled `<input>` fields for First Name, Last Name, City/Location, Email, Phone; pre-populate input `.value` from `api.getProfile()` if a profile exists
- [X] T042 [US4] Create Summary form card in `src/pages/ProfileEdit.js`: `.section-card` with title "SUMMARY"; `<textarea>` with `.value` pre-populated from `profile.summary`
- [X] T043 [P] [US4] Create Skills form card in `src/pages/ProfileEdit.js`: `.section-card` with title "SKILLS"; `<input type="text">` pre-populated from `profile.skills.join(', ')`
- [X] T044 [P] [US4] Create Languages form card in `src/pages/ProfileEdit.js`: `.section-card` with title "LANGUAGES"; `<input type="text">` pre-populated from `profile.languages.join(', ')`
- [X] T045 [P] [US4] Create placeholder section cards in `src/pages/ProfileEdit.js` for Professional Experience, Education, Certifications, Awards, and Links: each card shows title + placeholder text via `textContent`
- [X] T046 [US4] Add Cancel and Save buttons to Basic Info and Summary cards in `src/pages/ProfileEdit.js`: Save uses the **read-merge-write** pattern � read `api.getProfile()` (default to `{}`), spread it, overwrite only this card's fields (e.g. `{ ...existing, firstName, lastName, city, email, phone }` for Basic Info), call `api.saveProfile(merged)`; show field-level errors inline on failure; show no-op feedback on success (no navigation); Cancel resets input `.value` to stored profile values (or empty if none)
- [X] T047 [US4] Validate Basic Info Save in `src/pages/ProfileEdit.js`: show `.field-error` (text via `textContent`) below First Name when blank, below Last Name when blank, below Email when non-empty and invalid format; clear all field errors before re-validating on each Save attempt
- [X] T048 [P] [US4] Add Cancel and Save buttons (no-op Save, reset-to-stored Cancel) to Skills and Languages cards in `src/pages/ProfileEdit.js` (placeholder behavior per spec constraint — skills/languages parsing deferred)
- [X] T049 [P] [US4] Add Cancel and Save buttons (no-op) to all placeholder section cards in `src/pages/ProfileEdit.js`

**Checkpoint**: User Story 4 functional. Both CTAs reach the edit page. Basic Info Save reads-merges-writes correctly. Validation errors appear on bad input. Back button returns to Profile page.

---

## Phase 7: User Story 5 — Mobile profile sub-section collapsibles (Priority: P3)

**Goal**: On mobile viewports (<640px), each profile sub-section label row is tappable to collapse/expand the section content, with a chevron indicator. On desktop, sub-sections are always expanded.

**Independent Test**: On a viewport <640px with a profile saved, tap a sub-section header — content collapses and chevron rotates. Tap again — expands. Switch to ≥640px — no chevron, all sections always expanded.

- [ ] T050 [US5] Add collapse toggle to sub-section label rows in `src/pages/Profile.js`: clicking a `.profile-subsection__label` toggles `.is-collapsed` class on the parent `.profile-subsection`; the toggle listener is always attached (CSS handles the desktop no-op via force-expand rule in T053)
- [ ] T051 [US5] Add chevron indicator to sub-section label rows in `src/pages/Profile.js`: append a `<span class="subsection-chevron" aria-hidden="true">›</span>` inside each label row; CSS controls its visibility and rotation
- [ ] T052 [US5] Add CSS collapse animation in `src/styles/main.css`: `.profile-subsection__content { max-height: 600px; overflow: hidden; transition: max-height 0.25s ease; }`; `.profile-subsection.is-collapsed .profile-subsection__content { max-height: 0; }`; `.subsection-chevron { display: inline-block; transition: transform 0.2s; transform: rotate(90deg); }`; `.profile-subsection.is-collapsed .subsection-chevron { transform: rotate(0deg); }`
- [ ] T053 [US5] Add desktop guard in `src/styles/main.css`: inside `@media (min-width: 640px)`, `.profile-subsection.is-collapsed .profile-subsection__content { max-height: 600px; }` (force-expand overrides is-collapsed) and `.subsection-chevron { display: none; }`

**Checkpoint**: User Story 5 functional. Mobile collapse/expand works on all sub-sections. Desktop sub-sections always show regardless of is-collapsed state.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Typography tokens, component styles, edge-case validation, regression checks, and final quality gates.

- [ ] T054 [P] Apply profile page typography in `src/styles/main.css`: `.profile-page h1` (Sora 28px 700; 22px on mobile), `.profile-subline` (Sora 13px `#999`), `.section-card__header .section-label` (Sora 11px 700 uppercase `#aaa`), `.profile-subsection__label` (Sora 11px 700 uppercase), `.profile-basic__name` (Sora 16px 700), `.profile-basic__meta` (DM Mono 11px `#999`)
- [ ] T055 [P] Apply stat chip styles in `src/styles/main.css`: `.stat-chip` (display flex, flex-direction column, border-radius 7px, padding 10px 14px); `.stat-chip__value` (Sora 22px 700 navy); `.stat-chip__label` (Sora 11px uppercase muted)
- [ ] T056 [P] Apply pill tag styles in `src/styles/main.css`: `.pill-tag` (background `#f0eeff`, color `#4F46E5`, border-radius 4px, padding 3px 8px, font-size 12px Sora)
- [ ] T057 [P] Apply link chip styles in `src/styles/main.css`: `.link-chip` (display inline-flex, flex-direction column, background `#f7f6f3`, border `1.5px solid #e0ddd8`, border-radius 6px, padding 6px 10px, text-decoration none, cursor pointer); `.link-chip:hover` (border-color `#4F46E5`, background `#f0eeff`); `.link-chip__platform` (9px uppercase `#bbb`); `.link-chip__url` (11px DM Mono `#555`)
- [ ] T058 [P] Apply avatar styles in `src/styles/main.css`: `.profile-avatar` (width/height 52px, border-radius 50%, background `#4F46E5`, color `#fff`, display flex, align-items center, justify-content center, font DM Mono 700 16px)
- [ ] T059 Verify no horizontal overflow on mobile: test all three page states — no-profile Profile, profile-exists Profile, and ProfileEdit — at 375px width; fix any overflow in `src/styles/main.css`
- [ ] T060 Validate edge cases in `src/pages/Profile.js` and `src/pages/ProfileEdit.js`: empty Tracker (all stats = 0, no chart crash); profile with only firstName+lastName set (missing optional fields omitted from basic info block); profile with empty arrays (sub-sections hidden); pre-population of edit form when no profile saved (all inputs empty); read-merge-write on a second API save preserves fields from the first save
- [ ] T061 Verify Tracker and Calendar pages still work: navigate to Tracker — applications list loads; navigate to Calendar — calendar renders; navigate back to Profile — page works; no console errors across pages
- [ ] T066 [P] Write `tests/pages/Profile.test.js`: page-level tests for Profile mount/unmount covering no-profile state, profile-exists state, injected navigation callbacks for "Go to Tracker" and "Set Up Profile" / "Edit Profile", and graceful handling when `api.getAll()` rejects
- [ ] T062 Run `npm run test:run` � all tests pass including `tests/models/profile.test.js`, `tests/server/profile.test.js`, profile coverage in `tests/services/api.test.js`, `tests/components/DonutChart.test.js`, `tests/pages/Profile.test.js`, and the existing test suite
- [ ] T063 Run `npm run lint` — no lint errors across all modified and new files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story phases; tests (T002, T064) must fail before T003/T004
- **Phases 3–5 (US1, US3, US2)**: All depend on Phase 2 completion; can proceed in declared order or with overlap once Phase 2 is done
- **Phase 6 (US4)**: Depends on Phase 2 and T001 (routing) — ProfileEdit.js is independent of US1/US2/US3
- **Phase 7 (US5)**: Depends on Phase 5 (US2 profile sub-sections must exist)
- **Phase 8 (Polish)**: Depends on all desired user story phases being complete

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 — no story dependencies
- **US3 (P1)**: Requires US1 (applications section card from T008 is the container) — DonutChart and StackedBar (T065, T014, T015) can be written in parallel with US1
- **US2 (P1)**: Requires Phase 2 — can be worked independently of US3
- **US4 (P2)**: Requires Phase 2 and T001 — fully independent of US1/US2/US3
- **US5 (P3)**: Requires US2 (sub-sections must exist before collapse is added)

### Within Each Phase

- T002, T064, and T067 (tests) must be written and failing before T003, T004, and API wrapper implementation
- T003 (model) before T004 (server persistence) � server route imports validateProfile from model
- T065 (DonutChart tests) must fail before T014 implements arc math
- T066 (Profile page tests) depends on T006 Profile.js skeleton and can be written before or alongside the Profile.js behavior tasks it covers
- Profile.js skeleton (T006) before adding content (T007–T013)
- DonutChart (T014) and StackedBar (T015) before wiring into Profile.js (T016, T017)
- `renderSubSection` helper (T026) before individual sub-section renderers (T027–T034)
- Profile sub-sections (T026–T034) before collapse behavior (T050–T053)

### Parallel Opportunities

- T002 (model tests), T064 (server profile tests), T067 (API service tests), and T005 (CSS) all parallel in Phase 2
- T065 (DonutChart tests), T014 (DonutChart), T015 (StackedBar) parallel in Phase 4
- T027–T033 (profile sub-sections) all parallel once T026 helper exists
- T043, T044, T045, T048, T049 (edit cards) parallel within US4
- T054–T058 and T066 (style tasks and Profile page test) parallel within Phase 8

---

## Parallel Examples

### Phase 4 (US3)
```
Parallel start:
  T065 — Write DonutChart arc tests (fail first)
  T015 — Create src/components/StackedBar.js

Then (once T065 exists):
  T014 — Create src/components/DonutChart.js (make T065 pass)

Then (once T014/T015 done):
  T016 — Wire DonutChart into Profile.js desktop layout  (.apps-desktop-vis)
  T017 — Wire StackedBar into Profile.js mobile layout (.apps-mobile-vis)
  T018 — Add CSS visibility toggle in main.css

Then:
  T019 — DonutChart segment hover
  T020 — Cursor-tracked tooltip (event.clientX/clientY)
  T021 — Legend cross-highlight
  T022 — StackedBar onTap handler
  T023 — StackedBar legend tap
```

### Phase 5 (US2)
```
Parallel start (once T026 renderSubSection helper exists):
  T027 — Summary
  T028 — Professional Experience
  T029 — Education
  T030 — Skills
  T031 — Certifications
  T032 — Awards
  T033 — Languages
  (T034 Links — sequential, has rel="noopener" requirement to verify)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 + Phase 2 (routing + foundational logic + tests)
2. Complete Phase 3 (US1 — no-profile state, stat chips, empty profile card, navigation)
3. **STOP and validate**: Profile page loads; stat chips show correct counts (wishlisted in Total); loading state shows; empty state + CTA visible; navigation works
4. Demo or deploy if ready

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready ✓
2. Phase 3 → US1: no-profile state + basic stats (MVP) ✓
3. Phase 4 → US3: chart visualizations (desktop + mobile, CSS-controlled) ✓
4. Phase 5 → US2: profile-exists state + all sub-sections ✓
5. Phase 6 → US4: edit/setup page with read-merge-write saves ✓
6. Phase 7 → US5: mobile collapsibles ✓
7. Phase 8 → Polish and final validation ✓

---

## Non-Goals (verified not implemented)

- Full CRUD for Experience / Education entries (placeholder cards only in US4)
- Avatar photo upload (initials avatar only)
- Multi-user authentication or remote sync for profile data
- Unsaved-change confirmation dialog on Edit page
- Advanced entry row management (add/remove rows with date pickers etc.)

---

## Notes

- Total tasks: **67** (+4 from original: T064 profile persistence tests, T065 DonutChart arc tests, T066 Profile page tests, T067 profile API client tests)
- Tasks by phase: Setup 1, Foundational 6, US1 8, US3 11, US2 13, US4 13, US5 4, Polish 11
- Parallel opportunities: 26 tasks marked [P]
- Constitution-required tests: T002 (models/profile.test.js), T064 (server/profile.test.js), T067 (services/api profile tests)
- Architectural-safety tests: T065 (DonutChart arc math), T066 (Profile page mount/navigation/error states)
- Suggested MVP: Complete through Phase 3 (US1) — 14 tasks for a fully navigable Profile page with real stats
