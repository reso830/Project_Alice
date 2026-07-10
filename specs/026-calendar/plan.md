# Implementation Plan: Calendar (026)

**Branch**: `026-calendar` | **Date**: 2026-05-21
**Spec**: [spec.md](spec.md)
**Inputs**: [docs/features/1.0.0-operational-core/026-calendar.md](../../docs/features/1.0.0-operational-core/026-calendar.md),
[docs/design/calendar.md](../../docs/design/calendar.md)
**Depends on**: [025-application-timeline](../025-application-timeline/spec.md)
(canonical Timeline data, `timeline` field on every application, demo seed
variety), [019-supabase-persistence](../019-supabase-persistence/spec.md)
(per-request Supabase adapter — the Calendar reads applications via the same
`api.getAll()` path as the Tracker, and Mark Ghosted writes via the same
`api.update()` path), [015-application-state-machine](../015-application-state-machine/spec.md)
(`TRANSITIONS`, `TERMINAL_STATES` — used by the ghost suggestion rule).

---

## Summary

Replace the existing Calendar placeholder page with a real Calendar feature.
The page projects each application's `timeline[]` array (introduced by 025)
into a month-grid + operational dashboard. No new server endpoints, no new
DB tables, no new application fields, no migration. All edits continue to
flow through the Application Overlay; the Calendar itself is read-only
except for one well-defined write path (Mark Ghosted), which reuses the
existing `PATCH /api/applications/:id` route.

Concretely this introduces:

1. A new `src/pages/Calendar.js` (full rewrite of the placeholder) that
   orchestrates the page: fetches applications, computes the projection
   + suggestion list, owns view state, and mounts the sub-components.
2. A new `src/components/calendar/` directory containing focused
   sub-components: `ActionPanel.js`, `MonthGrid.js`, `DayPopover.js`,
   `MonthPicker.js`, `YearPicker.js`, `StatusFilterDropdown.js`, and a
   shared `anchoredDropdown.js` positioning primitive.
3. New pure-function utility modules under `src/utils/`:
   - `calendar.js` — date math (ISO week number, weeks-in-month grid,
     Monday-start day-of-week shift), business-day diff.
   - `calendarProjection.js` — `projectTimelineToCalendar(applications)`
     and `deriveActivityTitle(entry, application)`.
   - `calendarSuggestions.js` — five pure rule functions
     (`followup`, `feedback`, `interview_followup`, `offer_expiry`,
     `ghost`) plus a composite evaluator that returns the deduped list
     of `Suggestion` records, taking dismissals into account.
   - `calendarDismissals.js` — read / write / merge dismissals to
     `localStorage` under the per-user key.
4. A new pure helper in `src/models/application.js`:
   `applyStatusChange(application, newStatus, { date, text })` — returns
   a new application record with `status`, `lastStatusUpdate`, and a
   newly-appended timeline entry. Used by Calendar's Mark Ghosted path.
   Modal.js's existing in-place helper in `src/components/Timeline.js`
   (`appendStatusChangeTimelineEntry`) is **not** changed — it has a
   different contract (mutates a draft owned by Modal) and is unrelated
   to this feature. Both helpers use the existing
   `allocateTimelineEntryId` + `toISODate()` primitives, so the entry
   shape is identical across both paths.
5. CSS additions in `src/styles/main.css` for all Calendar-scoped
   selectors per [docs/design/calendar.md](../../docs/design/calendar.md)
   (panels, grid, chips, popovers, pickers, filter dropdown, bottom-sheet
   variant, mobile reflow). All tokens are reused from the existing token
   set; no new design tokens.
6. Seed augmentation (demo + local SQLite + hosted starter) so the five
   suggestion kinds each fire on at least one application — required
   for the portfolio demo and for `/speckit.checklist` smoke validation.

The feature does **not** change:

- The Calendar route mapping in `src/main.js → navigate()` — already
  wired (`case 'calendar': → Calendar.mount(appRoot)`).
- The Navbar / BottomTabBar Calendar entries — already present.
- Any server route, validation schema, or repository adapter.
- The `applications` table schema (local or hosted) or any migration.
- The Application Overlay (`Modal.js`) — Calendar imports `Modal.open()`
  unchanged.
- The status set, state machine, or `STATUS_CONFIG`.
- The runtime mode set or auth model.

---

## Architecture

### Layered view

```
┌─ src/main.js ────────────────────────────────────────────────┐
│  navigate('calendar') → Calendar.mount(appRoot)              │
│  (already wired; placeholder Calendar.js replaced)           │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ src/pages/Calendar.js  (REWRITE)                             │
│  • mount(container) → fetch api.getAll() → render            │
│  • Owns: _applications, _viewMonth, _viewYear, _filter,      │
│    _openPopover, _dismissals (loaded once at mount)          │
│  • Re-renders on Mark Ghosted success or Dismiss             │
│  • Delegates to: ActionPanel, MonthGrid, DayPopover, etc.    │
└──────────┬────────────────────────────────────┬──────────────┘
           │ uses                               │ uses
┌──────────▼─────────────────┐  ┌───────────────▼──────────────┐
│ src/components/calendar/   │  │ src/utils/                   │
│   ActionPanel.js            │  │   calendar.js                │
│     • Greeting              │  │     • isoWeekNumber          │
│     • Today section         │  │     • weeksInMonthGrid       │
│     • Suggested Actions     │  │     • dayOfWeekIso           │
│     • Upcoming (Tomorrow +  │  │     • businessDaysBetween    │
│       Rest of Week)         │  │   calendarProjection.js      │
│     • EmptyState glyphs     │  │     • projectTimelineToCal   │
│   MonthGrid.js              │  │     • deriveActivityTitle    │
│     • Grid header (nav +    │  │     • todayRows / upcoming   │
│       month/year buttons +  │  │   calendarSuggestions.js     │
│       filter chip)          │  │     • evaluateSuggestions    │
│     • DOW row + CW gutter   │  │     • 5 rule functions       │
│     • 42 day cells          │  │     • dismissal filtering    │
│     • Numbered chips +N     │  │   calendarDismissals.js      │
│   DayPopover.js             │  │     • load / save / add /    │
│   MonthPicker.js            │  │       isDismissed            │
│   YearPicker.js             │  │     • per-user key scoping   │
│   StatusFilterDropdown.js   │  │                              │
│   anchoredDropdown.js (lib) │  │ src/models/application.js    │
│                             │  │   applyStatusChange (NEW)    │
└──────────┬──────────────────┘  └───────────────┬──────────────┘
           │                                     │
           └───────────────┬─────────────────────┘
                           │ writes via
┌──────────────────────────▼──────────────────────────────────┐
│ src/services/api.js (UNCHANGED)                             │
│  • api.getAll()             — initial application load      │
│  • api.update(id, fields)   — Mark Ghosted persistence      │
│  • api.getById(id)          — opening Application Overlay   │
│  Local / hosted / demo dispatch is already handled.         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ src/components/Modal.js (UNCHANGED)                         │
│  Calendar calls Modal.open(application, callbacks)          │
│  exactly the way Tracker does today.                        │
└─────────────────────────────────────────────────────────────┘
```

### Data flow — page mount

1. `Calendar.mount(container)` is invoked by `navigate('calendar')` (`src/main.js`).
2. Mount fetches applications via `await api.getAll()` (returns the same
   shape Tracker uses; in demo mode, returns the in-memory list).
3. Mount loads dismissals from `localStorage` via
   `calendarDismissals.load(authStore.getAuthState())`.
4. Mount initializes `_viewMonth`, `_viewYear` to "today" (local), and
   `_filter = null`.
5. Mount computes derived data (pure functions over `_applications`):
   - `dayActivities = projectTimelineToCalendar(_applications)`
   - `todayRows = todayRowsFor(_applications, todayISO)`
   - `upcoming = upcomingRowsFor(_applications, todayISO)`
   - `suggestions = evaluateSuggestions(_applications, todayISO, _dismissals)`
6. Mount renders the page shell, then mounts `ActionPanel` + `MonthGrid`,
   passing the derived data.

### Data flow — Mark Ghosted

1. User clicks `Mark Ghosted` on a ghost-flag suggestion row in
   `ActionPanel.js`.
2. `ActionPanel` calls `Calendar.onMarkGhosted(applicationId)`.
3. Page handler looks up the application from `_applications`, then
   computes the next state with the pure helper:
   ```js
   const next = applyStatusChange(application, 'ghosted', {
     text: 'Marked as ghosted after prolonged inactivity.',
   });
   ```
4. Handler calls `await api.update(applicationId, {
     status: next.status,
     lastStatusUpdate: next.lastStatusUpdate,
     timeline: next.timeline,
   })`.
   - SQLite path: existing `update()` does one transaction, writes all
     three fields atomically.
   - Hosted path: Supabase adapter sends one PATCH with all three fields.
   - Demo path: `demoStore.update()` spread-merges all three fields.
5. On success, handler replaces the application in `_applications` with
   the response, then re-evaluates derived data and re-renders.
6. `Toast.show('Marked #{ID} as Ghosted', 'success')`.
7. On failure (validation, network, transition rejected), handler shows
   `Toast.show('Could not mark as ghosted', 'failure')`. No state
   change client-side.

### Data flow — Dismiss a suggestion

1. User clicks `× Dismiss` on a suggestion row.
2. `ActionPanel` calls `Calendar.onDismiss(applicationId, kind)`.
3. Handler calls `calendarDismissals.add(applicationId, kind)` which
   merges the new record into the existing `localStorage` array and
   re-saves.
4. Handler updates `_dismissals` in memory, re-evaluates
   `suggestions = evaluateSuggestions(...)`, and re-renders the Action
   Panel.
5. No toast. The row exits silently per design §8.

### Data flow — Open Application Overlay

1. User clicks `↗ Open` on a row (Action Panel) or a row in a Day
   Popover.
2. Calendar's `onOpenApp(applicationId)` handler:
   - Closes any open popover.
   - Fetches the fresh application via `await api.getById(applicationId)`
     (matches Tracker's behavior — ensures the overlay sees the latest
     server state, not just Calendar's local copy).
   - Calls `Modal.open(application, { onApplicationUpdate: …,
     onArchiveSuccess: … })` with callbacks that re-sync Calendar's
     `_applications` and re-render on save.
3. Overlay closes via its own controls. On save, the callback updates
   `_applications` and re-runs the derived-data pass.

### Data flow — Date cell / chip clicks

- Click chip → opens `DayPopover` in **status mode** for that chip's
  status, anchored to the chip.
- Click date number or `+N` overflow → opens `DayPopover` in **all mode**
  for that date, anchored to the cell.
- Click outside / press Escape → closes the popover. State is
  session-local — closing a popover does not persist anything.
- Click a row inside the popover → closes the popover, then runs the
  same `onOpenApp` path as Action Panel rows.

### Data flow — Filter / pickers / navigation

All session-local. Clicking the filter chip opens
`StatusFilterDropdown` anchored to the chip; picking a status (or
"All statuses") sets `_filter` and re-renders the Month Grid only (the
Action Panel does not depend on the filter, per spec §Scope). Month /
year pickers behave the same way for `_viewMonth` / `_viewYear`. Prev
/ Next month arrows shift `_viewMonth` by ±1 with year-rollover, clamped
to `[2020, currentYear + 5]`. The Today button (visible only when the
viewed month is not the current month) resets `_viewMonth` and
`_viewYear` to today.

### Data flow — Greeting

Computed once at `Calendar.mount` time:

1. Read the local browser hour (`new Date().getHours()`).
2. Select one of four time-window pools per design §6.1 (05–11 / 12–16
   / 17–21 / 22–04).
3. Concatenate the three neutral entries.
4. Pick uniform-random from the merged pool.

The selection persists for the lifetime of the mount. It is NOT
re-evaluated when the local clock crosses an hour boundary mid-session
(spec edge case). Tests stub `Math.random` and `Date` to assert specific
selections.

---

## Affected Areas

### Files / components to inspect (read-only context)

- [src/main.js](../../src/main.js) — confirm `navigate('calendar')`
  already mounts `Calendar`; the new page replaces the existing module
  one-for-one (no main.js change required).
- [src/components/Navbar.js](../../src/components/Navbar.js) +
  [src/components/BottomTabBar.js](../../src/components/BottomTabBar.js)
  — confirm Calendar nav entries are present and active-state handling
  works (no changes expected).
- [src/components/Modal.js](../../src/components/Modal.js) — confirm
  `Modal.open(application, opts)` signature matches what Calendar will
  call (no Modal change for v1; `focusTimeline` deferred per spec
  clarification).
- [src/services/api.js](../../src/services/api.js) — confirm
  `api.getAll`, `api.getById`, `api.update` shape (no signature change).
- [src/data/authStore.js](../../src/data/authStore.js) — confirm
  `getAuthState().user.id` is the Supabase user UUID in hosted mode
  (clarified in spec §Clarifications).
- [src/data/demoStore.js](../../src/data/demoStore.js) — confirm
  `update()` spreads arbitrary fields including `status`,
  `lastStatusUpdate`, `timeline` (already verified in 025; no change
  expected).
- [src/models/application.js](../../src/models/application.js) — confirm
  `STATUS_CONFIG`, `TERMINAL_STATES`, `TRANSITIONS`, and
  `allocateTimelineEntryId` are available for reuse.
- [src/utils/date.js](../../src/utils/date.js) — confirm `toISODate()`
  format matches what Calendar will compare against.

### Files / components to modify

**New files (created by this feature):**

- [src/components/calendar/ActionPanel.js](../../src/components/calendar/ActionPanel.js) (NEW)
- [src/components/calendar/MonthGrid.js](../../src/components/calendar/MonthGrid.js) (NEW)
- [src/components/calendar/DayPopover.js](../../src/components/calendar/DayPopover.js) (NEW)
- [src/components/calendar/MonthPicker.js](../../src/components/calendar/MonthPicker.js) (NEW)
- [src/components/calendar/YearPicker.js](../../src/components/calendar/YearPicker.js) (NEW)
- [src/components/calendar/StatusFilterDropdown.js](../../src/components/calendar/StatusFilterDropdown.js) (NEW)
- [src/components/calendar/anchoredDropdown.js](../../src/components/calendar/anchoredDropdown.js) (NEW)
- [src/utils/calendar.js](../../src/utils/calendar.js) (NEW) — date math
  + ISO week number + business-day diff.
- [src/utils/calendarProjection.js](../../src/utils/calendarProjection.js) (NEW)
- [src/utils/calendarSuggestions.js](../../src/utils/calendarSuggestions.js) (NEW)
- [src/utils/calendarDismissals.js](../../src/utils/calendarDismissals.js) (NEW)

**Existing files modified:**

- [src/pages/Calendar.js](../../src/pages/Calendar.js) — full rewrite
  (replaces the legacy placeholder that uses `store.js`).
- [src/models/application.js](../../src/models/application.js) — add
  `applyStatusChange(application, newStatus, { date, text })` pure
  helper. No changes to existing exports.
- [src/styles/main.css](../../src/styles/main.css) — add Calendar
  selectors under a `/* === Calendar === */` section banner. All new
  selectors are scoped under `.calendar-page` (or its descendants) to
  avoid leaking into other pages.
- [src/data/demoSeed.js](../../src/data/demoSeed.js) — adjust 5 records
  (or add new ones) so each suggestion kind fires for the portfolio
  demo. Existing seed parity test will enforce alignment with the
  SQLite seed.
- [server/seeds/applicationsData.js](../../server/seeds/applicationsData.js)
  — mirror the demo seed changes so local SQLite dev mode also
  demonstrates each suggestion kind.
- [server/auth/seedHostedUser.js](../../server/auth/seedHostedUser.js)
  + the canonical `claim_and_seed_starter` RPC body at
  [docs/db/claim_and_seed_starter.md](../../docs/db/claim_and_seed_starter.md)
  — extend the 2 starter applications so a freshly-onboarded hosted
  user immediately sees at least one suggestion (likely a `followup`
  on the older starter row). The plan does **not** add a third
  starter row — keep the count at 2.

### Tests likely to be added or updated

**New test files:**

- [tests/utils/calendar.test.js](../../tests/utils/calendar.test.js) —
  `isoWeekNumber` (incl. year-boundary edge cases: Dec 30 → W01 next
  year, Jan 2 → W52 prev year, leap-year W53), `weeksInMonthGrid`
  (always 6, always Mon-start), `dayOfWeekIso`, `businessDaysBetween`
  (Mon–Fri only).
- [tests/utils/calendarProjection.test.js](../../tests/utils/calendarProjection.test.js) —
  `projectTimelineToCalendar` groups entries by date; multiple entries
  same day same status accumulate; `deriveActivityTitle` falls back
  text → status label → jobTitle.
- [tests/utils/calendarSuggestions.test.js](../../tests/utils/calendarSuggestions.test.js) —
  one describe block per rule with positive trigger, suppression by
  newer entry, suppression by future entry, suppression by terminal
  status, suppression by dismissal; ghost rule excludes `wishlisted`;
  offer rule honors 3-day-of-5-day window.
- [tests/utils/calendarDismissals.test.js](../../tests/utils/calendarDismissals.test.js) —
  key scoping by user identity; `load` returns empty on missing key;
  `add` is idempotent per `{appId, kind}`; localStorage exception
  swallowed (in-memory fallback).
- [tests/components/calendar/ActionPanel.test.js](../../tests/components/calendar/ActionPanel.test.js) —
  empty states for each section; count pill hidden when empty;
  greeting selection determinism under stubbed RNG; row body NOT
  clickable; action buttons fire correct callbacks; ghost row uses
  `Mark Ghosted` text button.
- [tests/components/calendar/MonthGrid.test.js](../../tests/components/calendar/MonthGrid.test.js) —
  always 6 weeks; ISO Monday start; CW gutter shows ISO week numbers;
  chip priority order; max 3 chips + `+N` overflow; cell states
  (today / weekend / out-of-month / filter-muted); cells with no
  activity are non-interactive; click chip → status-mode popover;
  click date number → all-mode popover; click +N → all-mode popover.
- [tests/components/calendar/DayPopover.test.js](../../tests/components/calendar/DayPopover.test.js) —
  title format for both modes; row click closes popover and calls
  `onOpenApp(id)`; Escape closes; backdrop closes; bottom-sheet variant
  at <640px.
- [tests/components/calendar/anchoredDropdown.test.js](../../tests/components/calendar/anchoredDropdown.test.js) —
  positions below anchor; flips above when overflow; clamps to viewport
  horizontally; Escape closes; backdrop click closes; bottom-sheet
  conversion at <640px when `asBottomSheet: true`.
- [tests/pages/Calendar.test.js](../../tests/pages/Calendar.test.js) —
  page-level integration: mount → render → Mark Ghosted → application
  reflects in `_applications` and the suggestion disappears; dismiss
  flow persists; status filter affects only the grid; navigation
  arrows respect year clamp.

**Existing tests updated:**

- [tests/models/application.test.js](../../tests/models/application.test.js)
  — add cases for `applyStatusChange`: appends entry, bumps
  `lastStatusUpdate`, returns new object (does not mutate input),
  preserves all other fields.
- [tests/data/demoStore.test.js](../../tests/data/demoStore.test.js)
  — existing parity assertion will catch demoSeed / SQLite seed
  divergence automatically (no test code change expected). Add one
  assertion: every seeded record validates after Calendar's seed
  augmentation.
- [tests/seed-data.test.js](../../tests/seed-data.test.js) — add an
  assertion that at least one seeded record triggers each of the 5
  suggestion kinds when `evaluateSuggestions` runs against today's
  date (frozen for the test via `vi.setSystemTime`).

### Out of scope

- Week / day / year views.
- External calendar integrations (Google / Outlook / iCal).
- Per-day notes or attachments.
- AI- or LLM-generated suggestions.
- New application fields (no `offerExpiryDate`, no `assessmentDueDate`).
- A separate suggestion-dismissals server table or migration.
- Cross-device sync of dismissals (localStorage is per-device by design).
- A new server route (Mark Ghosted reuses `PATCH /api/applications/:id`).
- Changes to the Application Overlay (`Modal.js`) — including the
  `focusTimeline` option (deferred per spec clarification).
- Changes to the Tracker page.
- Refactoring `appendStatusChangeTimelineEntry` out of Timeline.js
  (different contract from the new pure helper; both retained).
- Holiday-aware business-day calculation.
- URL-persisted filter or month/year state.
- Mobile collapsible Action Panel summary bar.

---

## Risks and Tradeoffs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Suggestion engine semantic drift across implementations.** The five rules each have a "newer entry suppresses" leg and the spec's "no newer entries" was clarified in /clarify Q2. A fresh contributor could re-introduce the older interpretation. | Medium | Suggestions that shouldn't fire start firing on stale data. | Pure rule functions in `calendarSuggestions.js` with one describe-block per rule covering positive trigger + every suppression case. Comment block at top of file cites spec §Clarifications and forbids re-interpretation. |
| **ISO week number edge cases (year boundary, leap weeks).** Naive implementations using `Date.getDay()` or locale week-numbering fail at Dec 30 → W01 and Jan 2 → W52. | Medium | Wrong week number in the CW gutter for ~3 days/year. | Implement per design §6.8.2 exactly (UTC-based shift to Thursday). Unit-test the four boundary cases explicitly. Do NOT use locale libraries. |
| **Greeting random selection breaks deterministic tests.** | Low | Flaky test re-runs in CI. | Tests stub `Math.random` via `vi.spyOn(Math, 'random')` and `Date` via `vi.setSystemTime` before any Calendar mount. Calendar imports `Math.random` directly (no indirection) so the spy is sufficient. |
| **localStorage unavailable (private mode, quota exhausted, ITP).** | Low | Dismissals fail to persist; suggestions reappear. | `calendarDismissals.load/save` wraps `localStorage` access in try/catch and falls back to a module-scoped in-memory array for the session. A single `console.warn` is emitted on the first failure. No user-facing dialog. |
| **Demo seed augmentation breaks the existing seed parity test.** | Low | `tests/data/demoStore.test.js` red. | Add seed records to both `src/data/demoSeed.js` and `server/seeds/applicationsData.js` in the same commit so the parity test stays green. Where ages need to be "X days ago" relative to today, derive dates from `toISODate(new Date(Date.now() - N * DAY_MS))` (matches the existing seed convention). |
| **Mark Ghosted race**: user clicks Mark Ghosted, network is slow, user clicks Dismiss before the response returns. | Low | UI inconsistency for ~1 second. | Disable the row's buttons during the in-flight request (`disabled` attribute + `aria-busy`). If the response fails, re-enable. If success, the row exits via the normal re-evaluation pass — Dismiss can no longer be clicked. |
| **The hosted seed adjustment requires a follow-up RPC migration.** Operators who applied 019 (and 025's update) must run yet another migration to pick up the new starter timelines. | Medium | Hosted starter users see stale starter rows until the migration is run, but suggestions still compute correctly from whatever's in the row. | Quickstart includes a copy-pasteable `CREATE OR REPLACE FUNCTION` block for the new RPC body. Document under [docs/db/claim_and_seed_starter.md](../../docs/db/claim_and_seed_starter.md) (canonical source per 025). Old hosted users (already seeded) are unaffected — the RPC is idempotent and only runs on new seeds. |
| **Many new CSS selectors in main.css** could collide with existing names. The day popover and pickers mount under `document.body` (not under `.calendar-page`), so descendant-scoping alone is not sufficient. | Low | Visual regression on Tracker / Profile. | **Class-naming prefix rule (per spec review m2):** every Calendar-introduced class is `cal-` prefixed (or uses an existing feature prefix like `upc-`, `dow-`, `filter-`, `num-`, `day-`, `bs-`). The design doc's bare names (`.row`, `.section`, `.empty`, `.title`, `.picker`) are explicitly renamed per the mapping table in [tasks.md Task 08.1](tasks.md). Smoke test (Task 11.12) must visit Tracker and Profile to confirm no regression. |
| **Module size: pages/Calendar.js + sub-components could grow large during implementation.** | Low | Harder to review the PR. | Component split is intentional (one concern per file). If a single component file exceeds ~400 LOC during implementation, factor a sub-component out rather than expanding the file. |
| **Application Overlay open from Calendar refetches via `api.getById`**, which is an extra round-trip the Tracker doesn't always need. | Low | ~1 extra HTTP call per click; demo mode is in-memory and free. | Acceptable: matches Tracker's existing behavior and ensures the overlay never opens with stale Calendar data. The alternative (passing the in-memory copy directly) would risk the overlay over-writing a newer version from another tab. |

### Tradeoffs accepted

- **One Mark Ghosted = one PATCH with three fields** (`status`,
  `lastStatusUpdate`, `timeline`). The existing `api.update` and server
  validation already accept all three in a single payload; no
  endpoint-level atomicity work needed.
- **Greeting selection is uniform-random** (per design §6.1 and spec
  /clarify Q4), accepting test brittleness in exchange for a less
  static page. Tests stub the RNG.
- **No keyboard focus restoration after popover close.** The design
  doesn't specify it; the existing app-shell pattern is to let focus
  fall back to the body. If a screen-reader user complains, add
  focus-return in v2.
- **No optimistic UI** for Mark Ghosted or Dismiss. Mark Ghosted waits
  for the server response (one toast on success / failure). Dismiss
  is purely client-side so it's effectively instant anyway.
- **No virtualization** in the month grid or popover. 42 cells × max
  ~10 entries each is trivially small.

---

## Validation Approach

### Automated (CI gate)

1. **Pure-function unit tests** — `tests/utils/calendar*.test.js` cover
   every rule, every projection edge case, every dismissal edge case.
   Vitest `vi.setSystemTime` freezes "today" for deterministic
   assertions.
2. **Component unit tests** — `tests/components/calendar/*.test.js`
   cover DOM structure, state transitions, and click handlers. JSDOM
   sufficient (no real browser needed).
3. **Page integration** — `tests/pages/Calendar.test.js` mounts the
   page against a stubbed `api.js` and asserts: mount renders, Mark
   Ghosted persists + re-renders, Dismiss persists + re-renders,
   filter affects grid only, navigation respects year clamp.
4. **Model unit test** — `tests/models/application.test.js` covers
   `applyStatusChange` purity, atomicity (all three fields updated),
   entry id allocation, and that the input is not mutated.
5. **Seed validity** — `tests/seed-data.test.js` asserts every seeded
   record validates AND that the seed corpus triggers at least one
   instance of each of the 5 suggestion kinds against a frozen "today".
6. **Demo / SQLite seed parity** — existing
   `tests/data/demoStore.test.js` enforces that both seeds agree on
   the records and their timelines.

### Manual (Browser Smoke Test phase — final phase, per constitution)

Walk each User Story's Independent Test in a real browser against the
to-be-merged state:

- **US-1 Today**: open the Calendar with at least one application that
  has a timeline entry dated today; confirm Today section lists it
  with correct ID/title/company/role.
- **US-2 Upcoming**: confirm `Tomorrow` and `Rest of Week` groups
  populate; entries beyond Sunday do not appear.
- **US-3 Suggestions (all 5 kinds)**: confirm each kind renders with
  correct copy and correct primary action (icon `↗` for four; text
  `Mark Ghosted` for the ghost kind).
- **US-4 Month scanning**: navigate forward 3 months and backward 6
  months; confirm always-6-weeks layout, ISO Monday start, CW gutter,
  chip priority, `+N` overflow.
- **US-5 Drill into a day**: click a chip → status-mode popover; click
  date number → all-mode popover; click `+N` → all-mode popover;
  click a row → Application Overlay opens.
- **US-6 Filter**: select Interview → only Interview chips remain at
  100% opacity; other cells dim; Action Panel unchanged.
- **US-7 Navigation**: walk to Jan 2020 and Dec currentYear+5; confirm
  arrows disable at the boundaries; pickers respect range; Today
  button appears/disappears correctly.
- **US-8 Mark Ghosted**: trigger a ghost suggestion, click Mark
  Ghosted, confirm toast, confirm row disappears, open the
  application in the Tracker and verify the new timeline entry +
  `ghosted` status.
- **US-9 Dismiss**: dismiss a suggestion, reload, confirm it stays
  dismissed; dismiss a different kind, confirm only the dismissed one
  is suppressed.
- **Mobile (<640px)**: popovers become bottom sheets; Action Panel
  stacks above grid; cells shrink; chips compact; navigation works.
- **Accessibility pass**: keyboard-only navigation through cells +
  chips + pickers + popover; Escape closes; focus rings visible;
  no information conveyed by color alone (chip count + popover label
  carry status identity).
- **Regression pass**: visit Tracker and Profile to confirm no CSS
  bleed; trigger a status change from the Tracker's modal to confirm
  feature 025's Change-Status path is unchanged.

### Quality gates (per constitution v1.4.0)

- Lint + format (`npm run lint`, `npm run format -- --check`) pass.
- Test suite green (`npm run test:run`).
- **Release Prep** (second-to-last phase): version bump,
  CHANGELOG entry, README updates if any, `docs/REPO_MAP.md` entries
  for every new component / util / test file, `docs/deployment.md`
  appended with the hosted `claim_and_seed_starter` follow-up SQL,
  `docs/features/1.0.0-operational-core/026-calendar.md` left as-is (brief is input, not
  output).
- **Browser Smoke Test** (final phase): ordered AFTER Release Prep
  so the smoke test exercises the merge state per Amendment 1.3.0.
- **Plan-review checklist** ([checklists/plan-review.md](checklists/plan-review.md))
  passes before `/speckit.tasks` is run.

---

## Technical Context

**Language/Version**: Node.js ≥ 20.19.0, JavaScript (ESM), no TypeScript.

**Primary Dependencies**: Existing only — Vite 8, Express 4 (untouched
in this feature), Vitest 4, better-sqlite3 (untouched), `@supabase/supabase-js`
(untouched), JSDOM (already used). **No new runtime or dev dependencies.**

**Storage**:
- No schema changes to SQLite, Supabase, or any persistence layer.
- New client-side storage: browser `localStorage` for suggestion
  dismissals, key `alice:calendar:dismissals:{userIdentityToken}`
  in hosted + local modes.
- **Demo mode**: dismissals live in an in-module memory bucket keyed
  by `"demo"`; `localStorage` is **never** written during demo
  (honors feature 020 FR-004 — "no persistent client-side state for
  the visitor"). The bucket lives for the JS context lifetime;
  page refresh exits demo and resets it.
- Nothing new in `demoStore` itself — the demo carve-out is fully
  inside `src/utils/calendarDismissals.js`.

**Frontend storage**: `localStorage` for dismissals only (hosted +
local modes; demo never touches it). No `sessionStorage`, no
`IndexedDB`, no service worker.

**Testing**: Vitest + JSDOM, mirroring feature 025.

**Target Platform**: Browsers (desktop + mobile, evergreen). Server-side
not affected.

**Project Type**: Web application — Vite SPA frontend. This feature
touches only the frontend bundle and the two seed modules (one of
which is server-side data only, not server logic).

**Constraints**:
- Local-first; no analytics; no third-party calls (constitution).
- Required application fields preserved (`companyName`, `jobTitle`,
  `status`, `lastStatusUpdate`, `responsibilities`).
- API response envelope `{ data, error }` unchanged.
- Status set and state machine unchanged.
- The Calendar must work identically across local / hosted / demo
  modes, with the only behavioral difference being the
  `userIdentityToken` value baked into the dismissal key.

---

## Constitution Compliance

| Constitution rule | Compliance |
|---|---|
| Required fields preserved | Yes — no field changes. |
| Simple, readable code | Yes — one new page, one util cluster, one model helper, several small components. No frameworks introduced. |
| Centralized validation | Yes — no new fields; existing Zod + client mirror cover the Mark Ghosted PATCH. |
| No new dependencies w/o justification | Yes — none added. |
| Local-first | Yes — Calendar reads existing local DB rows; dismissals are localStorage. |
| Validation before save | Yes — Mark Ghosted passes through existing PATCH validation. |
| URL / date validation | N/A — no URL inputs; dates are ISO strings generated by `toISODate()`. |
| No silent corruption | Yes — failed Mark Ghosted shows a toast, leaves state untouched. |
| Operations: add, edit, search, filter, review | Review (Calendar dashboard), filter (status filter on grid), edit (via Application Overlay link-out). Add unaffected. |
| Status, company, role, date primary | Yes — every Calendar row surfaces all four. |
| Stale apps / pending follow-ups | Core purpose of the feature. |
| Empty / loading / error states | Empty states explicit (3 sections × empty state); loading state on mount uses placeholder text "Loading…" until `api.getAll()` resolves; error state via Toast if the fetch fails. |
| Desktop + mobile | Yes — three breakpoints specified. |
| Labeled forms, keyboard, non-color status | No forms; keyboard reachable surfaces explicit; status communicated by label + count, not color alone. |
| Tests for status transitions, required fields, URL, dates | `applyStatusChange` is tested; transition validation lives in existing model/server layers (unchanged). |
| Mandatory Release Prep (penultimate phase) | Plan calls it out; tasks phase will include it. |
| Mandatory Browser Smoke Test (final phase, UI features) | Plan calls it out; tasks phase will include it. |

---

## Open Questions

None remaining. The five spec-time clarifications (user identity token
source; "newer entry" semantics; ghost rule excludes `wishlisted`;
random greeting selection; row-body non-clickability) are encoded in
this plan's *Architecture* and *Affected Areas* sections. The one
remaining low-impact spec deferred question (ISO Monday-start vs
locale) is settled in the design and reflected in `src/utils/calendar.js`
implementation notes.
