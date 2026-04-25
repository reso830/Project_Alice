# Tasks: Responsive Job Application Tracker Web App

**Input**: Design documents from `/specs/001-app-tracker-ui/`  
**Branch**: `001-app-tracker-ui`  
**Tech**: Vanilla JS (ES2022 modules), Vite 5, Vitest 1, ESLint, localStorage

**Tests**: Constitutional validation tests (T013, T014) are REQUIRED — they cover
application records, status coercion, required fields, URL validation, and date handling.
No additional unit tests are generated for UI-only stories (US2–US5) as their behaviour
is covered by the foundational model tests.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in all descriptions

---

## Phase 1: Setup

**Purpose**: Project initialisation and directory skeleton

- [ ] T001 Create directory structure: `src/styles/`, `src/data/`, `src/models/`, `src/components/`, `src/pages/`, `src/utils/`, `tests/models/`, `tests/utils/`
- [ ] T002 Create `package.json` — add Vite 5, Vitest 1, ESLint as devDependencies; add scripts: `dev` (vite), `build` (vite build), `preview` (vite preview), `test` (vitest), `test:run` (vitest run), `lint` (eslint src tests)
- [ ] T003 [P] Create `vite.config.js` — Vite config with Vitest test block: `{ test: { environment: 'node', include: ['tests/**/*.test.js'] } }`
- [ ] T004 [P] Create `eslint.config.js` — ESLint flat config targeting browser globals, ES2022 modules; no-unused-vars, no-undef rules enabled
- [ ] T005 [P] Create `index.html` — HTML5 boilerplate; `<link>` tags for Sora and DM Mono from Google Fonts; `<div id="app"></div>` as app root; `<script type="module" src="/src/main.js"></script>`
- [ ] T006 Run `npm install` then `npm run dev` — confirm dev server starts at `localhost:5173` and serves `index.html` without errors

**Checkpoint**: Dev server running, directory structure confirmed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data layer, design tokens, and validation that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Create `src/styles/main.css` — declare all CSS custom properties from `Tracker_Design.md`: 14 color tokens (`--navy`, `--indigo`, `--bg`, `--surface`, `--border`, `--t1`…), 5 radius tokens (`--r-xs` through `--r-pill`), 4 shadow tokens (`--shadow-xs` through `--shadow-lg`); add z-index variables (`--z-nav: 100`, `--z-toolbar: 90`, `--z-dropdown: 200`, `--z-modal: 300`, `--z-toast: 400`); add CSS reset (box-sizing: border-box, margin: 0, font-family: Sora); set `body { background: var(--bg); }`
- [ ] T008 Create `src/models/application.js` — export `STATUS_CONFIG` object: keys are the 9 enum string values (`'wishlisted'`, `'applied'`, `'phone_screen'`, `'interview'`, `'assessment'`, `'offer'`, `'rejected'`, `'withdrawn'`, `'ghosted'`); each entry has `{ label, badgeBg, badgeText, borderAccent }` with hex values from `data-model.md`; export `STATUS_VALUES` array (the 9 keys) for validation
- [ ] T009 Add `validateApplication(record)` and `normalizeApplication(record)` to `src/models/application.js` — `validateApplication`: check `id` is a non-empty string of digit characters (if not, set `record._corrupt = true`); coerce unrecognised `status` to `'wishlisted'`; replace invalid `last_status_update` (non-`YYYY-MM-DD` format, or invalid calendar date such as month 13 or day 30 in February) with today's ISO date; clamp `compat` to 0–100 (`Math.max(0, Math.min(100, …))`); coerce non-array `skills` to `[]`; default non-boolean `fav` to `false`; treat non-empty invalid `url` as absent (set to `''`); `normalizeApplication`: fill absent optional string fields (`responsibilities`, `salary`, `recruiter`, `url`) with `''`; return normalised record
- [ ] T010 Create `src/utils/date.js` — export `toISODate(date = new Date())`: returns `YYYY-MM-DD` string for given Date; export `toDisplayDate(isoString)`: parses `YYYY-MM-DD`, returns `"Apr 25"` (omit year if current year) or `"Apr 25, 2025"` (include year if different); return `"—"` for empty/invalid input
- [ ] T011 Create `src/data/store.js` — `STORAGE_KEY = 'apptracker_applications'`; private `_applications = []`; `load()`: read from `localStorage`, JSON.parse (catch errors → use `[]`), run `normalizeApplication` then `validateApplication` on each record, sort: valid records by `id` ascending (numeric compare), corrupt records appended at end; `save()`: `localStorage.setItem(STORAGE_KEY, JSON.stringify(_applications))`; `getAll()`: return shallow copy of `_applications`; `getById(id)`: find by `id`; `updateStatus(id, newStatus)`: find record, update `status` and `last_status_update` (today via `toISODate()`), call `save()`; `toggleFav(id)`: flip `fav`, call `save()`
- [ ] T012 Add seed data initialisation to `src/main.js` — define `SEED_DATA` array of 5 `JobApplication` records: IDs `"001"–"005"`, varied statuses (wishlisted, applied, interview, offer, rejected), one record with all optional fields populated, one minimal (required fields only), one with `fav: true`; add one additional record with `id: ""` (invalid) to exercise corrupt handling; use dynamic `last_status_update` values: at least two records MUST use dates within the current calendar month (e.g. `toISODate(new Date(Date.now() - 2 * 86400000))`) and at least one record MUST use a date from a prior month (e.g. `toISODate(new Date(Date.now() - 40 * 86400000))`); on `DOMContentLoaded`: call `store.load()`; if `store.getAll().length === 0`, inject seed records and call `store.save()`

### Foundational Tests (REQUIRED by constitution — covers records, status, validation, dates)

- [ ] T013 Write `tests/models/application.test.js` *(requires T009 complete)* — `validateApplication` tests: missing `id` sets `_corrupt: true`; `id: "abc"` (non-digit) sets `_corrupt: true`; `id: "003"` passes; unrecognised status coerced to `"wishlisted"`; valid status unchanged; `last_status_update` invalid string replaced with today; `compat: -5` clamped to `0`; `compat: 120` clamped to `100`; `skills: "React"` (string) coerced to `[]`; `fav: "yes"` defaulted to `false`; invalid `url` set to `""`; valid record's required fields unchanged
- [ ] T014 [P] Write `tests/utils/date.test.js` — `toISODate()` returns `YYYY-MM-DD` for today; `toISODate(new Date('2025-01-15'))` returns `"2025-01-15"`; `toDisplayDate("2026-04-25")` returns `"Apr 25"` (current year omitted); `toDisplayDate("2025-01-01")` returns `"Jan 1, 2025"` (past year included); `toDisplayDate("")` returns `"—"`; `toDisplayDate("not-a-date")` returns `"—"`; `toDisplayDate("2026-02-30")` returns `"—"` (invalid calendar date)
- [ ] T013b [P] Write `tests/data/store.test.js` *(requires T011 complete)* — `load()` on JSON parse failure returns `[]` and does not throw; `updateStatus('002', 'applied')` updates `status` to `'applied'` and `last_status_update` to today's ISO date; `updateStatus` with a non-existent ID is a no-op (no throw, no state change); `toggleFav('001')` flips `fav` from `false` to `true`; `toggleFav` called twice on the same ID restores original value; `getById('003')` returns the correct record; `getById('999')` returns `undefined`
- [ ] T015 Run `npm run test:run` — confirm T013, T013b, and T014 pass with zero failures; fix any issues before proceeding to user story phases

**Checkpoint**: Data model, store, utilities, and validation tests all green — user story implementation can begin

---

## Phase 3: User Story 1 — Browse Job Applications at a Glance (Priority: P1) 🎯 MVP

**Goal**: User lands on the Tracker page and sees all application cards ordered by ID, each showing all required fields with — for absent optional fields; corrupt records at bottom with red highlight; count badge in toolbar; empty state when no data

**Independent Test**: Load the app in the browser with seed data → cards appear in ID order → all card fields visible → absent optional fields show — → corrupt record at bottom with red highlight + warning icon → count badge matches card count → clear localStorage and reload → empty state message appears

- [ ] T016 [P] [US1] Create `src/components/CompatBar.js` — `render(score)` returns `HTMLElement`; outer `div.compat-bar` (pill, full-width container, background `#EDE8DF`); inner `div.compat-bar__fill` with `width: score%`; fill colour: `score >= 80` → `#22C55E`, `score >= 60` → `#EAB308`, else `#4F46E5`; centred `span.compat-bar__label` text `"{score}%"`; label colour: white when `score >= 50`, `#4B5563` when `< 50`; renders correctly at `score = 0` (label still visible) and `score = 100` (no overflow)
- [ ] T017 [P] [US1] Create `src/components/Navbar.js` — `render(activePage)` returns `HTMLElement`; `header.navbar` with `background: var(--navy)`, height 52px, sticky top 0, `z-index: var(--z-nav)`; left: logo mark (`div` 28×28px, `border-radius: 7px`, `background: var(--indigo)`); right: three `button.nav-btn` elements (Tracker, Calendar, Profile), Sora 12px/500, no border by default; active button gets class `.nav-btn--active` (background: `var(--indigo)`, color: white); `setActive(page)`: removes active class from all buttons, adds to matching page button
- [ ] T018 [P] [US1] Create `src/components/Toolbar.js` — `render(count)` returns `HTMLElement`; `div.toolbar` sticky below navbar (`top: 52px`, `z-index: var(--z-toolbar)`), background `var(--surface)`, border-bottom `1px solid var(--border)`, padding `11px 24px`; count badge `span.count-badge` with text `"{count} Applications"`, background `var(--indigo-dim)`, color `var(--indigo)`, border-radius `var(--r-pill)`, padding `3px 10px`, Sora 12px/500; `updateCount(count)`: updates badge text content
- [ ] T019 [US1] Create `src/components/Card.js` — `render(application, callbacks)` returns `article.card`; left border `4px solid {STATUS_CONFIG[status].borderAccent}`; background `var(--surface)`, border `1px solid var(--border)`, border-radius `var(--r-md)`, padding `12px 16px`, cursor pointer, default shadow `var(--shadow-xs)`, hover `var(--shadow-md)` + `translateY(-1px)`; **Row 1**: `span.id-pill` (DM Mono 9px/500, navy bg, white text, pill shape, text `application.id`), `span.status-badge` (label from `STATUS_CONFIG`, badgeBg, badgeText, pill, 10px/500), `span.date` (`toDisplayDate(last_status_update)`, Sora 11px, `var(--t3)`), right-aligned action buttons (Edit `✎`, Status `⇄`, Copy `🔗`, Star `★` — all four always rendered); **Row 2**: `span.position` (Sora 14px/600, `var(--t1)`), `span.company` (Sora 13px/400, `var(--t2)`), `CompatBar.render(compat)` at 30% width; **Row 3**: `div.responsibilities` (DM Mono 9px, 2-line clamp, value or "—"), skills as `span.skill-tag` pills (or "—" if empty array), `span.salary` (DM Mono 9px, value or "—"), `span.url-display` (DM Mono 9px, plain text — shows `application.url` when set, "—" when absent, never rendered as `<a>` link); absent optional string fields render "—"; if `application._corrupt`: add class `.card--corrupt` (soft red bg `#FEF2F2`, border `#FECACA`) + `⚠` warning icon in Row 1; star button: class `.card-btn--starred` (color `#D97706`, border `#FDE68A`, bg `#FFFBEB`) when `fav: true`; **callbacks and pointer disambiguation are wired in T019b**
- [ ] T019b [US1] Wire `Card.js` event callbacks and pointer disambiguation — Edit button `click`: call `callbacks.onOpen(application.id)`; Status `⇄` button `click`: call `callbacks.onStatusChange(application.id, null)` (dropdown opened by caller); Star `★` button `click`: call `callbacks.onFavToggle(application.id)`; Copy `🔗` button `click`: call `callbacks.onCopyUrl(application.id)`; ensure action button `click` events call `event.stopPropagation()` so they do not bubble to the card body; **Pointer disambiguation on card body**: on `pointerdown` record `{x, y}`; on `pointerup` measure Euclidean distance from `pointerdown`; if distance `< 5px` AND `event.target` is not any action button (Edit, Status, Star, Copy), call `callbacks.onOpen(application.id)`
- [ ] T020 [US1] Add US1 component styles to `src/styles/main.css` — `/* CompatBar */` section: pill container, fill div, label centred absolutely over bar; `/* Navbar */` section: sticky header, logo mark, nav button base, `.nav-btn--active`; `/* Toolbar */` section: sticky positioning, count badge pill; `/* Card */` section: card layout (CSS grid or flex for 3 rows), ID pill (navy bg, pill, DM Mono), status badge (pill, Sora 10px), skill tag pills, 2-line clamp (`-webkit-line-clamp: 2`), action button base style (28×28px, border, rounded), action button hover (indigo border+color+bg), `.card-btn--starred` gold style, `.card--corrupt` red bg, card hover transition
- [ ] T021 [US1] Create `src/pages/Tracker.js` — `mount(container)`: clear `container`; append `Toolbar.render(store.getAll().length)`; append `div.card-list`; for each app from `store.getAll()` (already sorted by store) append `Card.render(app, { onOpen: id => console.log('open', id), onStatusChange: (id, _) => openStatusDropdown(id), onFavToggle: id => { store.toggleFav(id); refreshCard(id); }, onCopyUrl: id => console.log('copy', id) })`; if `store.getAll().length === 0` append `div.empty-state` with message "No applications yet. Add your first one!"; `window.scrollTo(0, 0)` on mount; `unmount()`: remove all children from container; internal `refreshCard(id)`: replace card DOM node with fresh `Card.render` for updated record
- [ ] T022 [US1] Update `src/main.js` — import `store`, `Navbar`, `Tracker`; on `DOMContentLoaded`: after seed init, create `header` element and append to body, mount `Navbar.render('tracker')` into it; create `main#app` and append to body; call `Tracker.mount(document.querySelector('#app'))`; wire Navbar button clicks: each button calls `navigate(page)` stub function (console.log for now)
- [ ] T023 [US1] Checkpoint — `npm run dev`; browser at `localhost:5173`; verify: 5+ seed cards visible; cards in ID ascending order; corrupt seed record (empty id) at bottom with red highlight and ⚠; status badges show correct label and colour; absent optional fields (including url-display) show —; Copy URL button visible on all cards regardless of URL presence; fav:true card shows gold star; count badge matches card count; clear localStorage in DevTools and reload → empty state message appears

**Checkpoint**: US1 independently functional — read-only tracker dashboard working

---

## Phase 4: User Story 2 — View Full Application Details (Priority: P2)

**Goal**: Deliberate click on card body (or Edit button) opens a detail modal with all application fields; background scroll locks; scroll position preserved on close; status can be changed from within the modal header

**Independent Test**: Click any card → modal opens → all fields shown (absent ones show —) → try scrolling background → locked → close by clicking outside → list at same scroll position as before → click Edit button → same modal opens → change status in modal header → badge in header updates immediately

- [ ] T024 [US2] Create `src/components/Modal.js` — module-level `let _savedScrollY = 0`; `open(application, { onStatusChange })`: save `window.scrollY` to `_savedScrollY`; `document.body.style.overflow = 'hidden'`; create `div.modal-backdrop` (full-screen fixed, `z-index: var(--z-modal)`, `rgba(8,8,24,.52)`, `backdrop-filter: blur(4px)`); create `div.modal-panel` (white bg, `border-radius: var(--r-lg)`, `max-width: 740px`, `max-height: 90vh`, `overflow-y: auto`); **modal header** (`div.modal-header`, navy bg): ID pill, status badge (re-renderable `span#modal-status-badge`), position title, status change button `⇄` that calls `onStatusChange`; **modal body** (`div.modal-body`, 2-col CSS grid, `gap: 16px 28px`, padding `22px`): field rows for company, recruiter, salary, compat score, last_status_update; full-span rows for responsibilities, skills (as pill tags), url (click calls `Toast.show` — wire in later), footer; absent optional fields render "—"; backdrop click calls `Modal.close()`; on `open()`: add `document` `keydown` listener; if key is `'Escape'`, call `Modal.close()`; `close()`: `document.body.style.overflow = ''`; `window.scrollTo(0, _savedScrollY)`; remove backdrop and panel from DOM; remove the `keydown` listener; export `{ open, close }`
- [ ] T025 [US2] Add Modal CSS to `src/styles/main.css` — `/* Modal */` section: `.modal-backdrop` (fixed full-screen, z-index `var(--z-modal)`); `.modal-panel` (white bg, border-radius 14px, max-w 740px, max-h 90vh, overflow-y auto, `box-shadow: var(--shadow-lg)`); `.modal-header` (navy bg, padding `16px 22px`); `.modal-body` (2-col CSS grid, gap `16px 28px`, padding `22px`); full-span class for responsibilities/skills/url rows; entrance animation keyframe (`scale(0.97) translateY(8px) opacity(0)` → `scale(1) translateY(0) opacity(1)`, 200ms ease)
- [ ] T026 [US2] Wire Modal into `src/pages/Tracker.js` — import `Modal`; replace `console.log('open', id)` stub in `onOpen` callback with `Modal.open(store.getById(id), { onStatusChange: (id, newStatus) => { store.updateStatus(id, newStatus); refreshCard(id); } })`; the `onStatusChange` callback in `Card.js` remains wired to `console.log` until T032
- [ ] T027 [US2] Verify pointer disambiguation in `Card.js` — confirm `pointerdown`/`pointerup` tracking is implemented: on mobile-simulated scroll in browser DevTools, rapidly dragging through a card must NOT open the modal; a stationary tap/click must open it; Edit button standard `click` listener must still fire independently of disambiguation logic
- [ ] T028 [US2] Checkpoint — scroll Tracker list partway; click card body → modal opens; check all fields present; absent optional fields show —; try scrolling page → background locked; click outside modal → modal closes, list back at pre-open scroll position; click Edit button → same modal opens; change status via ⇄ in modal header → badge in modal header updates (StatusDropdown stub may just console.log for now)

**Checkpoint**: US1 + US2 both independently functional

---

## Phase 5: User Story 3 — Quick Actions Directly from a Card (Priority: P3)

**Goal**: Status dropdown, star toggle, and copy URL all work from the card without opening the modal; Toast confirms clipboard success/failure; status changes update badge and date immediately; all actions also work from within the open detail modal

**Independent Test**: Click ⇄ on card → dropdown shows 9 statuses; select one → badge + border + date update immediately; click outside → dropdown closes, no change; click star → gold, persists on reload; click copy on card with URL → success toast; block clipboard in browser settings → failure toast; status change from within open modal updates modal header badge

- [ ] T029 [P] [US3] Create `src/components/StatusDropdown.js` — `open(anchorEl, currentStatus, onChange)`: create `div.status-dropdown-backdrop` (full-viewport fixed, transparent, `z-index: calc(var(--z-dropdown) - 1)`) that calls `close()` on click; create `div.status-dropdown` (white bg, `border-radius: var(--r-md)`, `min-width: 196px`, `padding: 5px`, `box-shadow: var(--shadow-lg)`, `z-index: var(--z-dropdown)`); position panel: get `anchorEl.getBoundingClientRect()`, place below anchor; if panel bottom would exceed `window.innerHeight`, place above anchor instead; if `(anchorRect.left + panelWidth) > window.innerWidth`, right-align panel so its right edge aligns with the anchor's right edge instead of left-aligning; render nine `div.status-option` rows for each `STATUS_VALUES` entry: left `span.status-dot` (8×8px circle, colour `STATUS_CONFIG[v].borderAccent`), label text, right `✓` checkmark if `v === currentStatus`; option click: call `onChange(v)` then `close()`; on `open()`: add `document` `keydown` listener; if key is `'Escape'`, call `StatusDropdown.close()`; `close()`: remove backdrop and panel from DOM; remove the `keydown` listener; export `{ open, close }`
- [ ] T030 [P] [US3] Create `src/components/Toast.js` — module-level `let _activeToast = null, _timer = null`; `show(message, type)`: if `_activeToast` exists, cancel `_timer` and remove from DOM; create `div.toast` (fixed, `bottom: 24px`, `left: 50%`, `transform: translateX(-50%)`, `z-index: var(--z-toast)`, pill shape, `background: var(--navy)`, white text, `box-shadow: var(--shadow-lg)`, padding `10px 18px`); prepend `span.toast-dot` (16×16px circle: `#22C55E` for success, `#EF4444` for failure); append message text; append to `document.body`; apply entrance animation (`translateY(8px)→translateY(0)` + `opacity(0)→1`, 180ms ease); set `_timer = setTimeout(() => dismiss(), 2400)`; `dismiss()`: play exit animation then remove; export `{ show }`
- [ ] T031 [US3] Add StatusDropdown and Toast CSS to `src/styles/main.css` — `/* StatusDropdown */`: `.status-dropdown` (white, border, radius, shadow, padding, absolute positioning); `.status-option` (padding `8px 10px`, radius `var(--r-sm)`, hover bg `var(--indigo-dim)`); `.status-dot` (8×8px inline-block circle); `/* Toast */`: `.toast` (fixed, pill, navy bg, white, shadow, flex row, gap, padding); `.toast-dot` (16×16px circle, flex-shrink 0); `@keyframes toast-in` (`translateY(8px)→0`, `opacity 0→1`); `@keyframes toast-out` (reverse)
- [ ] T032 [US3] Wire StatusDropdown into `Card.js` — import `StatusDropdown`; status `⇄` button `click` listener: call `StatusDropdown.open(buttonEl, application.status, (newStatus) => { callbacks.onStatusChange(application.id, newStatus) })`; ensure click does not also trigger card-body `onOpen`
- [ ] T033 [US3] Update `Tracker.js` `onStatusChange` callback — after `store.updateStatus(id, newStatus)`: call `refreshCard(id)` to re-render the card element in-place (replace old card node with fresh `Card.render` for updated record); update `Toolbar` count (count unchanged on status change, but call `updateCount` defensively)
- [ ] T034 [US3] Wire star toggle in `Card.js` and `Tracker.js` — `Card.js`: star button `click`: call `callbacks.onFavToggle(id)`; update star button classes immediately (optimistic UI — toggle `.card-btn--starred` before store confirms); `Tracker.js` `onFavToggle`: call `store.toggleFav(id)`; call `refreshCard(id)` to sync persisted state
- [ ] T035 [US3] Wire copy URL in `Tracker.js` — `Tracker.js` `onCopyUrl`: get `application.url` from `store.getById(id)`; if `url` is empty: call `Toast.show('No URL on file', 'failure')`; else: call `navigator.clipboard.writeText(url).then(() => Toast.show('URL copied to clipboard', 'success')).catch(() => Toast.show('Copy failed — check browser permissions', 'failure'))`; import `Toast`; the Copy `🔗` button is always rendered (wired in T019b) — no visibility change needed here
- [ ] T036 [US3] Wire StatusDropdown into `Modal.js` — import `StatusDropdown`; status `⇄` button in modal header: call `StatusDropdown.open(buttonEl, currentStatus, (newStatus) => { onStatusChange(application.id, newStatus); currentStatus = newStatus; update `#modal-status-badge` text and colours from `STATUS_CONFIG[newStatus]` })`; this updates the badge in the modal header in-place without closing the modal; also update the `last_status_update` display element in the modal body to today's date via `toDisplayDate(toISODate())`; the `onStatusChange` callback already refreshes the card behind the modal
- [ ] T037 [US3] Checkpoint — click ⇄ on card → dropdown shows all 9 statuses with dots and current status checked; select new status → dropdown closes, card badge and left border update immediately, date refreshes to today; click outside open dropdown → closes, no status change; click star → gold fill; reload page → star still gold; click copy on card with URL → success toast appears within 500ms, dismisses ~2.4s later; open browser DevTools → Application → revoke clipboard permission → click copy → failure toast; open modal, change status via ⇄ in header → modal badge and last updated date in modal body both update without closing

**Checkpoint**: US1 + US2 + US3 all independently functional

---

## Phase 6: User Story 4 — Responsive Layout Across Devices (Priority: P4)

**Goal**: Cards adapt from 3-row desktop layout to stacked mobile layout; modal becomes a bottom-sheet on mobile; no horizontal scrolling at any breakpoint; all three breakpoints (desktop/tablet/mobile) render correctly

**Independent Test**: Resize browser to >1024px → 3-row card, compat bar at 30% width, actions right-aligned; resize to <640px → card sections stack vertically, compat bar full-width; click card on <640px → modal slides up from bottom with rounded top corners; resize to 640–1023px → responsibilities on own row, modal 1-column; no horizontal scrollbar at any size

- [ ] T038 [US4] Add desktop breakpoint card layout to `src/styles/main.css` — `@media (min-width: 1024px)` block: `.card` uses CSS grid layout (3 explicit rows); Row 1: ID pill + status badge + date left-aligned, action buttons right-aligned (flex justify-between); Row 2: position + company left, `.compat-bar` constrained to 30% width right-aligned; Row 3: responsibilities, skills, salary in a row
- [ ] T039 [US4] Add tablet breakpoint layout to `src/styles/main.css` — `@media (min-width: 640px) and (max-width: 1023px)` block: `.compat-bar` constrained to 36% width; `.responsibilities` wraps to its own row below position+company; `.modal-body` overrides to single-column grid
- [ ] T040 [US4] Add mobile card layout to `src/styles/main.css` — `@media (max-width: 639px)` block: `.card` switches to vertical flex-column; Row order: ID+badge+date row, position, company, compat-bar (full width), responsibilities, skills tags wrap, salary + action buttons row at bottom
- [ ] T041 [US4] Implement mobile bottom-sheet Modal variant in `src/components/Modal.js` — in `open()`: check `window.innerWidth < 640`; if true: apply class `.modal-panel--bottom-sheet` to panel (fixed `bottom: 0`, `left: 0`, `right: 0`, `max-width: 100%`, `border-radius: 14px 14px 0 0`, `max-height: 90vh`); else use existing centred `.modal-panel` styles; entrance animation for bottom-sheet: `translateY(100%) → translateY(0)`, 250ms ease-out
- [ ] T042 [US4] Add bottom-sheet CSS to `src/styles/main.css` — `.modal-panel--bottom-sheet` class: `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`, `border-radius: 14px 14px 0 0`, `max-width: none`, `max-height: 90vh`, `overflow-y: auto`; `@keyframes sheet-up` (`translateY(100%) → translateY(0)`, 250ms ease-out)
- [ ] T043 [US4] Checkpoint — DevTools mobile device simulation (<640px): card rows stack vertically, compat bar full-width, actions on last row; click card → panel slides up from bottom with rounded top only; tablet simulation (640–1023px): responsibilities on own row, modal 1-column; desktop (>1024px): 3-row layout, compat bar 30%; no horizontal scrollbar at any simulated size

**Checkpoint**: US1–US4 all independently functional across device sizes

---

## Phase 7: User Story 5 — Navigate Between App Sections (Priority: P5)

**Goal**: Navbar buttons switch between Tracker, Calendar (stub month grid), and Profile (stub stats); active button visually highlighted; returning to Tracker always resets scroll to top

**Independent Test**: Click Calendar → month grid stub with status update date markers; click Profile → four stat cards (total, active, offers, rejections) with correct counts; active nav button is visually distinct; scroll Tracker list, navigate to Calendar, click Tracker → list at top of page

- [ ] T044 [P] [US5] Create `src/pages/Calendar.js` — `mount(container)`: render `div.calendar-page`; show current month/year heading; render a 7-column CSS grid month grid with day cells; for each `store.getAll()` record whose `last_status_update` falls in the current month, mark that day cell with a `span.day-dot` (small indigo circle); no click interaction; `unmount()`: clear container
- [ ] T045 [P] [US5] Create `src/pages/Profile.js` — `mount(container)`: derive stats from `store.getAll()`: `total` (all records), `active` (status not in `['rejected','withdrawn','ghosted']`), `offers` (status `=== 'offer'`), `rejections` (status `=== 'rejected'`); render `div.profile-page` with four `div.stat-card` elements each showing label + count; `unmount()`: clear container
- [ ] T046 [P] [US5] Add Calendar and Profile page CSS to `src/styles/main.css` — `/* Calendar */`: `.calendar-page` padding; `.month-grid` (CSS grid 7 columns, auto rows); `.day-cell` (padding, centered, border-radius); `.day-dot` (8×8px indigo circle, centered below day number); `/* Profile */`: `.profile-page` padding; `.stat-cards` (CSS grid 2×2 or flex-wrap); `.stat-card` (white bg, border, radius, padding, shadow-sm); `.stat-card__value` (large Sora number, indigo colour); `.stat-card__label` (Sora 12px, t2 colour)
- [ ] T047 [US5] Implement router in `src/main.js` — module-level `let _currentPage = null, _currentUnmount = null`; `navigate(page)`: if `_currentUnmount` call it; clear `#app`; mount new page (`Tracker`, `Calendar`, or `Profile`) into `document.querySelector('#app')`; store unmount ref in `_currentUnmount`; call `Navbar.setActive(page)`; replace Navbar button stub listeners with calls to `navigate(page)`; default `navigate('tracker')` on `DOMContentLoaded`
- [ ] T048 [US5] Checkpoint — click Calendar button → Calendar stub with month grid, indigo dots on days matching seed data `last_status_update`; click Profile → four stat cards with correct counts from seed data; active nav button highlighted in indigo; click Tracker after scrolling → list resets to top; back to Calendar → active state updates

**Checkpoint**: All five user stories independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, keyboard navigation, lint, final test run, and privacy audit

- [ ] T049 Keyboard navigation — add `tabIndex="0"` to any non-button interactive elements (card body if needed); confirm all action buttons are natively focusable; add `focus-visible` CSS outline styles (indigo `box-shadow: 0 0 0 3px rgba(79,70,229,.3)`) to all interactive elements in `src/styles/main.css`; modal focus trap: on `Modal.open()` move focus to first focusable element in panel; confirm `Escape` closes modal (wired in T024) and status dropdown (wired in T029)
- [ ] T050 Accessibility pass — verify each status badge renders label text alongside colour (no colour-only status); add `aria-label` to all icon-only action buttons in `Card.js` (e.g. `aria-label="Change status"`, `aria-label="Copy job URL"`, `aria-label="Star application"`); add `aria-live="polite"` to Toolbar count badge element; add `role="dialog"` and `aria-modal="true"` to modal panel; verify empty state text is meaningful and not hidden from screen readers
- [ ] T051 [P] Privacy audit — search `src/` for any `fetch(`, `XMLHttpRequest`, `navigator.sendBeacon`, `gtag`, `analytics` calls → confirm zero results; confirm `index.html` only loads external resources from `fonts.googleapis.com` and `fonts.gstatic.com`; no other third-party scripts
- [ ] T052 [P] Run `npm run lint` — resolve all ESLint warnings and errors in `src/` and `tests/`; commit fixes
- [ ] T053 [P] Run `npm run test:run` — confirm all tests (T013, T014) still pass after all story implementations; fix any regressions
- [ ] T054 Quickstart validation — follow `specs/001-app-tracker-ui/quickstart.md` step-by-step in a fresh terminal: `npm install` → `npm run dev` (verify app loads with seed data) → `npm run test:run` (all pass) → `npm run lint` (zero errors) → `npm run build` (dist/ created without errors); confirm all steps documented in quickstart succeed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 complete — BLOCKS all user stories
- **US1 (Phase 3)**: Requires Phase 2 complete — no other story dependencies
- **US2 (Phase 4)**: Requires Phase 2 complete — builds on US1 Card component (T019)
- **US3 (Phase 5)**: Requires Phase 2 complete — builds on US1 Card (T019) and US2 Modal (T024)
- **US4 (Phase 6)**: Requires Phase 2 complete — CSS-only changes over existing components; can start after T020/T025
- **US5 (Phase 7)**: Requires Phase 2 complete — can start after T022 (main.js structure exists)
- **Polish (Phase 8)**: Requires all desired stories complete

### User Story Dependencies (within stories)

- US1: T016/T017/T018 [P] → T019 → T019b → T020 → T021 → T022 → T023
- US2: T024 → T025 → T026 → T027 → T028
- US3: T029/T030 [P] → T031 → T032 → T033 → T034 → T035 → T036 → T037
- US4: T038/T039/T040 [P] → T041 → T042 → T043
- US5: T044/T045/T046 [P] → T047 → T048

### Parallel Opportunities

- T003, T004, T005 can run in parallel (different files, no dependencies)
- T013b, T014 can run in parallel (different test files; T013 is sequential after T009)
- T016, T017, T018 can run in parallel (different component files)
- T029, T030 can run in parallel (different component files)
- T044, T045, T046 can run in parallel (different page files)
- T051, T052, T053 can run in parallel (search, lint, test — independent tools)
- T038, T039, T040 modify `main.css` — run sequentially despite covering different breakpoints

---

## Parallel Example: User Story 1

```
# Run in parallel (different files, no dependencies):
T016: Create src/components/CompatBar.js
T017: Create src/components/Navbar.js
T018: Create src/components/Toolbar.js

# Then sequentially (Card depends on CompatBar):
T019: Create src/components/Card.js (DOM structure and field rendering)
T019b: Wire Card.js event callbacks and pointer disambiguation
T020: Add all US1 CSS to src/styles/main.css
T021: Create src/pages/Tracker.js
T022: Wire main.js
T023: Browser checkpoint
```

## Parallel Example: User Story 3

```
# Run in parallel (different files):
T029: Create src/components/StatusDropdown.js
T030: Create src/components/Toast.js

# Then sequentially:
T031: Add StatusDropdown + Toast CSS
T032: Wire StatusDropdown into Card.js
T033: Update Tracker.js onStatusChange
T034: Wire star toggle
T035: Wire copy URL + Toast
T036: Wire StatusDropdown into Modal.js
T037: Browser checkpoint
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test US1 independently in browser
5. Demo-able: read-only tracker dashboard with seed data

### Incremental Delivery

1. Setup + Foundational → Foundation verified (tests green)
2. US1 → scannable card list (MVP demo)
3. US2 → detail modal with scroll lock
4. US3 → inline status, star, copy URL, toasts
5. US4 → responsive layout, mobile bottom-sheet
6. US5 → navigation, Calendar stub, Profile stub
7. Polish → accessibility, lint, final tests

---

## Notes

- `[P]` tasks can run in parallel — different files, no incomplete dependencies
- `[Story]` label maps each task to its user story for traceability
- `main.css` is a shared file — CSS tasks within the same phase are sequential even when JS tasks are parallel
- Commit after each checkpoint (T023, T028, T037, T043, T048) to mark story completion
- Each checkpoint is a browser verification step — do not skip
- Run `npm run test:run` before every commit to catch regressions
