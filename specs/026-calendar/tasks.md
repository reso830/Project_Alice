# Tasks: Calendar (026)

**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Data model**: [data-model.md](data-model.md)
**Contracts**: [contracts/api.md](contracts/api.md)
**Research**: [research.md](research.md)
**Quickstart**: [quickstart.md](quickstart.md)
**Plan review**: [checklists/plan-review.md](checklists/plan-review.md)
**Branch**: `026-calendar`

---

## Phase Map

| Phase | Theme | Blocks |
|---|---|---|
| 01 | Foundation: pure utilities (date math, projection, suggestion rules, dismissals) + model helper (`applyStatusChange`) | 02–08 |
| 02 | `anchoredDropdown.js` primitive — positioning + outside-click + Escape + bottom-sheet conversion | 03, 04, 05, 06 |
| 03 | Action Panel (US-1, US-2, US-3, US-9) — Greeting, Today, Suggested Actions, Upcoming | 07 |
| 04 | Month Grid (US-4, US-6) — header, DOW row + CW gutter, day cells, chips, overflow, filter behavior | 07 |
| 05 | Pickers — Month Picker, Year Picker, Status Filter Dropdown (US-7, US-6) | 07 |
| 06 | Day Popover (US-5) — status + all modes, bottom-sheet variant | 07 |
| 07 | Page orchestrator — full rewrite of `src/pages/Calendar.js`; wires data + handlers (US-8 Mark Ghosted; US-9 Dismiss; Open Overlay) | 08, 09 |
| 08 | Styling — `src/styles/main.css` Calendar block + mobile reflow | 10 |
| 09 | Seed augmentation — demo seed + local SQLite seed + canonical RPC doc; suggestion-coverage seed test | 10 |
| 10 | **Release Prep (REQUIRED)** — version bump, CHANGELOG, README, deployment.md, REPO_MAP.md | 11 |
| 11 | **Browser Smoke Test (REQUIRED — UI feature)** — every User Story walked in a real browser against the merge state | 12 |
| 12 | **Post-smoke Fixes + v2 Inline Panel** — design changes from Phase 11 feedback: v2 inline day panel (replaces DayPopover); status label rename (`Technical Assessment` → `Technical`); greeting name injection; picker header cleanup; text-style month/year buttons; mobile single-row nav; dismiss toast; filter dims empty cells; CSS polish (typography weights, empty-state styling, weekend/out-of-month hues); picker anchoring bug fix | 13 |
| 13 | **Release Prep v2 + Re-smoke (REQUIRED)** — patch version bump (`0.13.1`), CHANGELOG appendix, re-walk Phase 11 checklist on the merge state. Picker-anchoring (obs #5) deferred — see CHANGELOG `[0.13.1] § Known limitations` | 14 |
| 14 | **Post-re-smoke Fixes** — Phase 13 re-smoke surfaced 11 follow-up observations. Three are spec changes already applied to `docs/design/calendar.md`: filter popup unified with Tracker `QuickFiltersToolbar` (§6.12), controlled grid-header wrap <375px (§6.6.1 + §11), DayPanel row meta `{Company} · {Job title}` (§17.5). Eight are implementation/CSS fixes: picker anchoring root-cause fix; DayPanel status pill font; group-header dash extra line; Action Panel ID pill alignment with Tracker; weekend-vs-out-of-month tint cascade; selection ring restoration; seed fixture with 4+ statuses on a single day. | 15 |
| 15 | **Action Panel Collapse (`<1200px`)** — promote the v1-deferred collapsible-summary-bar provision (`docs/design/calendar.md §11.1`, formerly in §11 Open question / §15 Out of Scope) to a real implementation. Three tasks: summary bar + toggle in `ActionPanel.js`, collapse CSS in `main.css`, test sweep. | 16 |
| 16 | **Release Prep v3 + Re-smoke (REQUIRED)** — patch version bump (`0.13.2`), CHANGELOG appendix covering Phase 14 + Phase 15, remove the v0.13.1 picker-anchoring `Known limitations` entry (Task 14.5 fixed it), REPO_MAP audit, re-walk the smoke checklist on the merge state. | merge |

**Sequencing notes:**

- Phase 01 sub-tasks are mutually independent (pure functions) and may
  be implemented in parallel.
- Phase 02 must complete before any of Phases 03–06 because every
  popover/picker depends on `anchoredDropdown`.
- Phases 03–06 may proceed in parallel once 02 is done. Each builds an
  isolated component module with its own tests.
- Phase 07 depends on every component being ready.
- Phase 08 (styling) can land in parallel with 07 — the components in
  03–06 already use the class names that 08 styles. Components are
  visually broken until 08 lands, but functionally testable.
- Phase 09 (seeds) can land any time after Phase 01.4 because the
  seed-coverage test depends on `evaluateSuggestions`.
- Phase 10 (Release Prep) was second-to-last for the v1 cut per
  Amendment 1.3.0; Phase 13 reprises that role for the v2 patch cut.
- Phase 11 (Browser Smoke Test) was the v1 final phase per
  Amendment 1.3.0. It surfaced 22 observations that drive Phase 12;
  Phase 13 then re-runs the same checklist against the v2 merge state
  to honor the amendment for the patch cut as well.
- Phase 12 is a single combined phase covering both the v2 inline-panel
  rewrite and the polish items from the smoke feedback — they touch the
  same files (Calendar.js, MonthGrid.js, main.css) and splitting them
  would force two coordinated CSS passes.
- Phase 14 mirrors Phase 12's structure: one combined phase for the
  v0.13.1 re-smoke follow-ups. The filter-popup unification (Task 14.1)
  is the heaviest item — it touches both Calendar and Tracker
  source and likely requires extracting a shared component. The
  picker-anchoring fix (Task 14.5) finally addresses the deferred
  obs #5 from v0.13.1's known-limitations note.
- Phase 15 promotes a long-deferred design provision — the
  collapsible Action Panel summary bar at `<1200px` stacked layouts
  — out of v1's §11 Open question / §15 Out of Scope and into a
  real spec (`docs/design/calendar.md §11.1`). Scoped as its own
  phase rather than appended to Phase 14 because Phase 14 was
  already closed when the provision was rediscovered.
- Phase 16 mirrors the Phase 10 / Phase 13 release-prep template
  for the v0.13.2 patch. It covers Phase 14 + Phase 15 changes in
  one CHANGELOG appendix; the smoke walk is treated as a re-smoke
  (not a fresh one) since the v0.13.1 quickstart `§6` checklist is
  the same shape and the deferred picker-anchoring rows are now
  ticked.

**CSS class-naming rule (load-bearing across Phases 03–08):**
The design doc uses bare class names like `.row`, `.section`, `.empty`,
`.title`, `.picker` that would collide with other pages. **Every
Calendar-introduced class MUST be `cal-`-prefixed** (or use an
existing feature-prefix like `upc-`, `dow-`, `filter-`, `num-`,
`day-`, `bs-`). The full design-doc → implementation rename mapping
lives in [Task 08.1](#-task-081--add-calendar-css-block-to-srcstylesmaincss);
component tasks must apply the same names when constructing the DOM.

**Shared status priority constant:**
`STATUS_DISPLAY_PRIORITY` is exported from
[src/models/application.js](../../src/models/application.js) and
consumed by MonthGrid (chip ordering), StatusFilterDropdown (row
ordering), DayPopover (all-mode grouping), and the seed-coverage test.
See Task 01.1 for its definition.

---

## Phase 01 — Foundation

### [X] Task 01.1 — Add `applyStatusChange` + `STATUS_DISPLAY_PRIORITY` to the application model

**Target file**: [src/models/application.js](../../src/models/application.js)

**What to do**:

**1. Add the status display priority constant** (per spec review i4):

```js
// Display-priority order for status-aware UI sorting:
//   chip stacking in MonthGrid cells, row order in
//   StatusFilterDropdown, group order in DayPopover all-mode.
// Most-actionable statuses first; terminal statuses last.
// Do NOT use this for state-machine logic — use TRANSITIONS.
export const STATUS_DISPLAY_PRIORITY = Object.freeze([
  'accepted',
  'offer',
  'interview',
  'assessment',
  'phone_screen',
  'wishlisted',
  'applied',
  'rejected',
  'withdrawn',
  'ghosted',
]);
```

**2. Add the `applyStatusChange` pure helper** alongside the existing
model helpers:

```js
export function applyStatusChange(application, newStatus, options = {}) {
  const date = options.date ?? toISODate();
  const text = options.text ?? '';
  const timeline = [...(application.timeline ?? [])];
  const id = allocateTimelineEntryId(timeline);
  timeline.push({ id, date, status: newStatus, text });
  return {
    ...application,
    status: newStatus,
    lastStatusUpdate: date,
    timeline,
  };
}
```

Import `toISODate` from `../utils/date.js` (already used elsewhere in
this file). `allocateTimelineEntryId` is already exported from this
file — no re-import needed.

**Expected behavior**:
- `STATUS_DISPLAY_PRIORITY` is a frozen array of 10 status keys in
  the documented order; every entry exists in `STATUS_VALUES`.
- `applyStatusChange`:
  - Returns a new application object; input is **not** mutated.
  - New timeline entry is appended at the end of the array; existing
    entries are copied by reference into the new array.
  - `lastStatusUpdate` is bumped to the new entry's date (today by
    default).
  - Does NOT validate the transition — caller responsibility (per
    [data-model.md §7](data-model.md)).

**Constraints**:
- No new imports beyond `toISODate` (already imported).
- Do not touch `appendStatusChangeTimelineEntry` in
  [src/components/Timeline.js](../../src/components/Timeline.js).
  That helper has a different contract (mutates a draft owned by
  Modal); it remains as-is per [research.md §3](research.md).
- Do not mutate the input's `timeline` array.
- `STATUS_DISPLAY_PRIORITY` is for **display ordering only**. Do not
  use it as a state-machine check or as a "sort applications by
  priority" key elsewhere in the codebase without re-review — the
  ordering is a UX choice that may evolve.

**Validation**:
- Extend [tests/models/application.test.js](../../tests/models/application.test.js):
  - `describe('STATUS_DISPLAY_PRIORITY', ...)`:
    - Length is 10.
    - Every entry is in `STATUS_VALUES` (use `expect(new
      Set(STATUS_DISPLAY_PRIORITY)).toEqual(new Set(STATUS_VALUES))`).
    - The array is frozen (`expect(Object.isFrozen(
      STATUS_DISPLAY_PRIORITY)).toBe(true)`).
    - Order matches the documented one (snapshot the array literal).
  - `describe('applyStatusChange', ...)`:
    - Returns a new object (`expect(result).not.toBe(input)`).
    - Input not mutated (`expect(input.status).not.toBe(newStatus)`).
    - `lastStatusUpdate` bumped to the new entry's date.
    - Entry id allocated via `allocateTimelineEntryId` (max+1 of
      existing ids; 1 for an empty array).
    - `text` defaults to `''`; honors override via `options.text`.
  - `date` defaults to `toISODate()`; honors override via `options.date`.
  - Existing timeline entries preserved in order before the new entry.

**Out of scope**:
- Validating the transition (server still owns this guard).
- Refactoring `appendStatusChangeTimelineEntry`.

---

### [X] Task 01.2 — `src/utils/calendar.js` (date math + ISO week)

**Target file**: `src/utils/calendar.js` (NEW)

**What to do**:
Create a new pure-function utility module with the contracts from
[contracts/api.md §3.1](contracts/api.md):

```js
export const YEAR_MIN = 2020;
export const YEAR_MAX = new Date().getFullYear() + 5;

export function isoWeekNumber(year, month /* 0..11 */, day) { /* ... */ }
export function dayOfWeekIso(date) { /* (getDay() + 6) % 7 */ }
export function daysBetween(aISO, bISO) { /* whole calendar days */ }
export function businessDaysBetween(aISO, bISO) { /* Mon–Fri only */ }
export function weeksInMonthGrid(viewYear, viewMonth) { /* 6×7 cells + CW per row */ }
```

`isoWeekNumber` implementation: copy verbatim from
[docs/design/calendar.md §6.8.2](../../docs/design/calendar.md) (UTC-based
shift to Thursday; based on Jan 4 anchor).

`weeksInMonthGrid(viewYear, viewMonth)` returns an array of 6 weeks,
each week containing 7 day cells:
```ts
type DayCell = {
  year: number;
  month: number;       // 0..11
  day: number;         // 1..31
  iso: string;         // YYYY-MM-DD
  isoWeek: number;     // shared by all days in the same row
  isCurrentMonth: boolean;
  isWeekend: boolean;  // Sat or Sun in ISO terms
  isToday: boolean;    // computed against today (local)
};
```

The first day of the grid is the Monday of the week containing the 1st
of the month (back-fill with previous-month days if needed). Always
emits exactly 42 day cells across 6 rows.

`businessDaysBetween(a, b)`: walk from `a` to `b` exclusive of `a`,
inclusive of `b`, counting only Mon–Fri. Returns 0 if `b <= a`. Half-open
on the start so that `businessDaysBetween('2026-05-15', '2026-05-22')`
(Fri → Fri) returns 5 (Mon–Fri of that week).

`daysBetween(a, b)`: floor of `(parseISO(b) - parseISO(a)) / 86_400_000`.
Returns 0 if `b <= a`.
This intentionally clamps future/reverse dates so stale-activity rules never
produce negative "days since" values for future-dated entries.

**Expected behavior**:
- `isoWeekNumber(2025, 11, 30)` (Dec 30 2025) === 1 (W01 of 2026).
- `isoWeekNumber(2027, 0, 2)` (Jan 2 2027) === 53 (W53 of 2026).
- `isoWeekNumber(2020, 11, 31)` (Dec 31 2020) === 53.
- `dayOfWeekIso(new Date('2026-05-21'))` === 3 (Thursday — Mon=0).
- `weeksInMonthGrid(2026, 4)` (May 2026) returns 6 rows; first row
  starts with Mon Apr 27; last row ends with Sun Jun 7.
- `businessDaysBetween('2026-05-15', '2026-05-22')` === 5.
- `businessDaysBetween('2026-05-15', '2026-05-18')` === 1 (Sat/Sun
  skipped; Mon May 18 counted).
- `daysBetween('2026-05-21', '2026-05-21')` === 0.
- `YEAR_MIN === 2020` and `YEAR_MAX === new Date().getFullYear() + 5`
  evaluated once at module load.

**Constraints**:
- All date inputs are `YYYY-MM-DD` strings or JS `Date`. Never accept
  arbitrary "Date-like" types.
- Use `Date.UTC(...)` constructors for the ISO week algorithm so DST
  doesn't perturb the math. Local-time `Date` is fine for everything
  else.
- No third-party date library imports.
- No DOM access.

**Validation**:
- New test file `tests/utils/calendar.test.js`. One describe block per
  exported function. Include these explicit edge cases:
  - `isoWeekNumber`: Dec 28 2026 → W53; Dec 30 2025 → W01 of 2026;
    Jan 2 2027 → W53 of 2026; Jan 4 2026 → W01 (anchor day).
  - `weeksInMonthGrid`: returns exactly 42 day cells across 6 rows;
    first day of the grid is a Monday; cells outside the current
    month have `isCurrentMonth: false`; today flag matches local
    date.
  - `businessDaysBetween`: a full Sat+Sun returns 0; a Mon→Fri (5
    days) returns 5; bisecting a weekend skips it.
  - `daysBetween`: same-day → 0; reverse order → 0.

**Out of scope**:
- Tweaks for non-Gregorian calendars (locale defaults retained).
- Holiday calendar.
- Time-of-day precision.

---

### [X] Task 01.3 — `src/utils/calendarProjection.js`

**Target file**: `src/utils/calendarProjection.js` (NEW)

**What to do**:
Create a pure module that projects applications + timelines into the
shapes the Calendar UI consumes. Match [contracts/api.md §3.2](contracts/api.md)
exactly:

```js
import { STATUS_CONFIG } from '../models/application.js';

export function projectTimelineToCalendar(apps) { /* see data-model §1.2 */ }
export function deriveActivityTitle(entry, app) { /* see data-model §1.3 */ }
export function todayRowsFor(apps, todayISO) { /* PanelRow[] */ }
export function upcomingRowsFor(apps, todayISO) {
  return { tomorrow: PanelRow[], restOfWeek: PanelRow[] };
}
```

Implementation rules:
- `projectTimelineToCalendar` walks every application's `timeline`,
  pushes `DayActivity` records into a `Record<"YYYY-MM-DD",
  DayActivity[]>`. Skips applications whose `timeline` is not an
  array.
- `deriveActivityTitle` per the fallback chain in [data-model.md §1.3](data-model.md):
  trimmed text (truncated at 77 chars + "…" if >80) → status label
  via `STATUS_CONFIG[entry.status].label` → `app.jobTitle` → literal
  `"Activity"`.
- `todayRowsFor` returns rows for any timeline entry whose `date ===
  todayISO`. Sort by application id ascending. Each row carries
  `{ id, title, company, role }` where `role = app.jobTitle`.
- `upcomingRowsFor` partitions future entries into:
  - `tomorrow`: entries with `date === todayISO + 1d`.
  - `restOfWeek`: entries with `date > todayISO + 1d` and `date <=
    endOfIsoWeek(todayISO)` (Sunday of the current ISO week, computed
    by adding `6 - dayOfWeekIso(today)` days to today).
- Both panel-row functions sort by `(date asc, id asc)`.

`endOfIsoWeek` is a local helper inside this module; do not export.

**Expected behavior**:
- For an app with two timeline entries on the same date, both
  `DayActivity`s appear in `dayActivities[date]` preserving insertion
  order.
- `deriveActivityTitle({ text: '', status: 'interview' }, app)` →
  `'Interview'` (via `STATUS_CONFIG`).
- `todayRowsFor` returns `[]` when no entries match today.
- `upcomingRowsFor` returns `{ tomorrow: [], restOfWeek: [] }` when no
  future entries exist within the current ISO week.
- Entries dated *after* the current ISO week's Sunday do NOT appear in
  `restOfWeek`.

**Constraints**:
- Pure — no module-level state, no caching.
- No DOM access.
- Do not consume terminal-status applications differently — the
  projection includes every application's timeline regardless of
  status. Filtering by terminal status is a suggestion-engine
  concern, not a projection concern.
- Use `dayOfWeekIso` from `src/utils/calendar.js` to compute end-of-week.

**Validation**:
- New test file `tests/utils/calendarProjection.test.js`:
  - `projectTimelineToCalendar`: groups entries by date; handles
    multiple apps; handles an app with no timeline; preserves
    insertion order within a day.
  - `deriveActivityTitle`: text wins; text >80 chars truncated;
    blank text falls back to status label; missing status falls
    back to jobTitle; missing or blank jobTitle falls back to literal
    `"Activity"`.
  - `todayRowsFor`: includes only today; excludes past and future;
    sorted by id ascending.
  - `upcomingRowsFor`: use a pinned Thursday fixture (for example
    `todayISO = "2026-05-21"`) or otherwise compute expectations
    from the ISO weekday; `tomorrow` is populated, `restOfWeek` includes
    entries through the current ISO-week Sunday, and entries after Sunday
    are excluded.

**Out of scope**:
- Suggestion logic (Task 01.4).
- Sort stability across renders (assume single-pass at render time).

---

### [X] Task 01.4 — `src/utils/calendarSuggestions.js`

**Target file**: `src/utils/calendarSuggestions.js` (NEW)

**What to do**:
Implement the 5 suggestion rules + the composite evaluator per
[data-model.md §2](data-model.md) and [contracts/api.md §3.3](contracts/api.md):

```js
import { TERMINAL_STATES } from '../models/application.js';
import { daysBetween, businessDaysBetween } from './calendar.js';

export const OFFER_WINDOW_DAYS = 5;
export const OFFER_NEAR_EXPIRY_DAYS = 3;
export const GHOST_RULE_STATUSES = Object.freeze([
  'applied', 'phone_screen', 'interview', 'assessment', 'offer',
]);

export function ruleFollowup(app, todayISO)            { /* ... */ }
export function ruleFeedback(app, todayISO)            { /* ... */ }
export function ruleInterviewFollowup(app, todayISO)   { /* ... */ }
export function ruleOfferExpiry(app, todayISO)         { /* ... */ }
export function ruleGhost(app, todayISO)               { /* ... */ }

export function evaluateSuggestions(apps, todayISO, dismissals) { /* ... */ }
```

Each rule returns `Suggestion | null`. Each rule's trigger condition
exactly matches [data-model.md §2.1–2.5](data-model.md):

- `ruleFollowup`: latest timeline entry has status `applied` AND
  `daysBetween(latestEntry.date, todayISO) >= 7`. Returns
  `{ id, kind: 'followup', title: 'Follow up with recruiter?',
    meta: '{N}d since application', primary: 'open' }`.
- `ruleFeedback`: latest entry is `phone_screen` AND
  `businessDaysBetween(latestEntry.date, todayISO) >= 5`.
- `ruleInterviewFollowup`: latest entry is `interview` AND
  `daysBetween >= 7`.
- `ruleOfferExpiry`: `app.status === 'offer'`; find the latest
  timeline entry with `status === 'offer'`; return null if no such
  timeline entry exists; trigger when
  `daysBetween(offerEntry.date, todayISO) >= OFFER_NEAR_EXPIRY_DAYS
  && daysBetween <= OFFER_WINDOW_DAYS`. Meta:
  `"Offer extended {N}d ago"`.
- `ruleGhost`: `GHOST_RULE_STATUSES.includes(app.status)` AND
  `daysBetween(latestEntry.date, todayISO) >= 14` AND no future
  entry exists. Returns `primary: 'mark_ghosted'`. Meta:
  `"{N}d \u00b7 last touched {prettyDate}"` where `prettyDate` is
  `new Date(latestEntry.date + 'T00:00:00').toLocaleDateString('en-US',
  { month:'short', day:'numeric' })`.

Composite `evaluateSuggestions(apps, todayISO, dismissals)`:

1. For each application:
   a. If `TERMINAL_STATES.has(app.status)` -> skip.
   b. If `app.timeline.some(e => e.date > todayISO)` (future entry
      exists) -> skip.
   c. Run each rule. Collect non-null returns.
   d. Filter out any kind that appears in `dismissals` for this app.
2. Flatten all per-app results. Sort by `(app.id asc, kindPriority)`
   where kindPriority is `ghost -> offer_expiry -> interview_followup
   -> feedback -> followup` (most actionable first).
3. Return the resulting `Suggestion[]`.

Helper `latestTimelineEntry(timeline)`:
- Returns null when `timeline` is empty or not an array; otherwise
  returns the entry with the maximum `(date, id)` lexicographic sort.

**Expected behavior**:
- `ruleFollowup` returns null when latest entry is not `applied`,
  even if `app.status === 'applied'`.
- `ruleGhost` returns null when `app.status === 'wishlisted'`
  (excluded per [spec.md §Clarifications Q3](spec.md)).
- `ruleOfferExpiry` returns null when today is `offerDate + 6` or
  later (window closed).
- `evaluateSuggestions` returns `[]` for an app that has any future
  timeline entry, even if the suggestion rule itself would otherwise
  fire.
- `evaluateSuggestions` returns `[]` for terminal-status apps.
- Order: ghost suggestions appear before followup suggestions for
  the same application (rare but possible if both trigger).
- A dismissal for `{appId: 12, kind: 'followup'}` suppresses the
  followup rule on app 12 but not the ghost rule on the same app.

**Constraints**:
- No mutation of `dismissals` array.
- No I/O. No localStorage access (Task 01.5 owns that).
- `daysBetween` and `businessDaysBetween` come from `./calendar.js`;
  do not duplicate the math.
- The composite evaluator must not call rules on terminal-status
  apps (short-circuit at step 1a).

**Validation**:
- New test file `tests/utils/calendarSuggestions.test.js`. One
  describe block per rule, plus one for the composite. Include:
  - `ruleFollowup`: positive at +7d; negative at +6d; negative if
    a newer non-applied entry exists; negative if status is
    accepted/rejected/withdrawn/ghosted (composite guards this).
  - `ruleFeedback`: positive after 5 business days (e.g. Mon→Mon
    skipping a weekend); negative after 5 calendar days that
    include weekends (only 3 business days).
  - `ruleInterviewFollowup`: positive at +7d; symmetric to followup.
  - `ruleOfferExpiry`: fires inside [+3d, +5d]; silent at +2 and +6;
    requires `app.status === 'offer'` (not just an offer entry in
    the timeline).
  - `ruleGhost`: includes the 5 whitelisted statuses; excludes
    wishlisted; excludes terminal; requires 14d gap; suppressed by
    future entry; uses `primary: 'mark_ghosted'`.
  - `evaluateSuggestions`: filters dismissals; sorts correctly;
    suppresses on future entry across rules.
  - Use `vi.setSystemTime` to fix "today" deterministically for
    every test.

**Out of scope**:
- Per-day visibility "newly triggered today" tracking
  ([spec.md §Data Considerations](spec.md): rules re-fire every
  day the condition holds; no separate timestamp).
- Holiday-aware business days.
- Localization of meta strings.

---

### [X] Task 01.5 — `src/utils/calendarDismissals.js`

**Target file**: `src/utils/calendarDismissals.js` (NEW)

**What to do**:
Implement dismissal storage per [data-model.md §3](data-model.md) and
[contracts/api.md §2.1](contracts/api.md). Two storage paths, switched
by `authState.status`:

```js
const KEY_PREFIX = 'alice:calendar:dismissals:';

function tokenFor(authState) {
  if (authState?.status === 'authenticated' && authState.user?.id) {
    return authState.user.id;
  }
  if (authState?.status === 'demo') {
    return 'demo';
  }
  return 'local';
}

function keyFor(authState) { return `${KEY_PREFIX}${tokenFor(authState)}`; }
function isDemoSession(authState) { return authState?.status === 'demo'; }

let _warned = false;
const _memoryFallback = new Map();  // key → SuggestionDismissal[]

export function load(authState) { /* see below */ }
export function add(authState, appId, kind) { /* see below */ }
export function isDismissed(list, appId, kind) { /* O(n) scan */ }
export function _resetForTesting() { _warned = false; _memoryFallback.clear(); }
```

Behavior:

- **Demo session** (`isDemoSession(authState) === true`):
  - `load`: return `_memoryFallback.get(keyFor(authState)) ?? []`
    directly. **Never** call `localStorage.getItem`. No warn.
  - `add`: read current list from `_memoryFallback`, drop any
    existing `{appId, kind}`, push the new record, write back to
    `_memoryFallback`. **Never** call `localStorage.setItem`.
    Honors feature 020 FR-004 — no persistent client-side state
    for demo visitors.
- **Hosted + local** (every other auth state):
  - `load`: try `JSON.parse(localStorage.getItem(key))`. On any
    error (missing key, parse failure, exception), return
    `_memoryFallback.get(key) ?? []`. On the first failure per
    session, emit `console.warn('Calendar dismissals: localStorage
    unavailable; suggestions will reappear next session.')`.
    Subsequent failures silent.
  - `add`: read current list (via `load`), drop existing `{appId,
    kind}`, push `{ appId, kind, dismissedAt: toISODate() }`,
    best-effort `localStorage.setItem`. Also update
    `_memoryFallback.set(key, newList)` so in-session state
    remains correct even if `setItem` silently fails.
- `isDismissed` (mode-independent):
  `list.some(d => d.appId === appId && d.kind === kind)`.

`toISODate` imported from `../utils/date.js`.

**Expected behavior**:
- `load({ status: 'local-mode' })` with no prior writes → `[]`, key
  `alice:calendar:dismissals:local` not yet in localStorage.
- After `add({ status: 'local-mode' }, 7, 'followup')`, `load`
  returns `[{ appId: 7, kind: 'followup', dismissedAt: <today ISO> }]`,
  and `localStorage.getItem('alice:calendar:dismissals:local')` is
  populated.
- After `add({ status: 'demo' }, 7, 'followup')`, `load` returns
  the same record, but `localStorage.getItem('alice:calendar:dismissals:demo')`
  is `null` AND `localStorage.getItem('alice:calendar:dismissals:local')`
  is unchanged. **localStorage MUST NOT contain any `:demo` key.**
- Calling `add` twice with same `{appId, kind}` results in one entry
  (the second overwrites `dismissedAt`).
- Hosted state with user UUID `'abc-123'` → key
  `alice:calendar:dismissals:abc-123`.
- When localStorage throws (mock `setItem` to throw, hosted/local
  mode), `add` still succeeds in-session via `_memoryFallback`;
  `load` returns the same list; `console.warn` fires exactly once
  per session.
- Demo `add` does not trigger the `console.warn` even when localStorage
  is unavailable (because demo never touches it).

**Constraints**:
- Demo path **MUST NOT** call any localStorage API (`getItem`,
  `setItem`, `removeItem`, `length`, etc.) — this is the load-bearing
  invariant for feature 020 FR-004 compliance.
- No JSON parsing errors thrown to the caller — all errors swallowed.
- The module-level `_warned` and `_memoryFallback` persist across
  calls. Reset only via `_resetForTesting`.
- Do not deserialize keys other than the current user's — never
  iterate `Object.keys(localStorage)`.

**Validation**:
- New test file `tests/utils/calendarDismissals.test.js`:
  - Key scoping: `local` for `local-mode` / `unauthenticated` /
    `initializing`; `demo` for `demo`; `user.id` for `authenticated`.
  - `load` returns `[]` on missing key.
  - `add` is idempotent per `{appId, kind}`.
  - `add` + `load` round-trips an entry.
  - `isDismissed` finds an existing entry; returns false otherwise.
  - When `localStorage.setItem` throws (hosted/local), `add`
    survives and `load` returns the in-memory fallback list;
    `console.warn` is called once.
  - `_resetForTesting()` clears the warning flag and fallback.
  - **Demo isolation** (load-bearing tests for feature 020
    compliance): `add({ status: 'demo' }, ...)` does NOT call
    `localStorage.setItem` (use a spy); `load({ status: 'demo' })`
    does NOT call `localStorage.getItem`; after a demo `add`, the
    `:demo`-suffixed key is absent from `localStorage`, and the
    `:local`-suffixed key is also unchanged (no cross-bucket bleed);
    `console.warn` is NOT called in demo even when `localStorage`
    is unavailable (spy never sees the demo `add`).
  - Use `vi.stubGlobal('localStorage', ...)` to swap the storage in
    tests; use `vi.spyOn(globalThis.localStorage, 'setItem')` and
    `'getItem'` to assert the demo path never calls them.
  - Clear JSDOM localStorage in `beforeEach`/`afterEach`; `_resetForTesting()`
    clears only module state, not the browser storage stub.

**Out of scope**:
- Cross-tab sync (no `storage` event listener).
- Migration / versioning of the stored array.
- Cleanup of orphaned dismissals (an entry whose app no longer
  exists).

---

## Phase 02 — Anchored Dropdown Primitive

### [X] Task 02.1 — `src/components/calendar/anchoredDropdown.js`

**Target file**: `src/components/calendar/anchoredDropdown.js` (NEW)

**What to do**:
Implement the shared anchored-dropdown primitive per
[contracts/api.md §3.6](contracts/api.md) and [docs/design/calendar.md §6.13](../../docs/design/calendar.md).

Signature:

```js
export function mountAnchoredDropdown({
  anchorEl,
  contentEl,
  align = 'start',         // 'start' | 'end'
  asBottomSheet = false,
  scrim = false,
  onClose,
}) {
  // returns { unmount() }
}
```

Behavior:
- Append a wrapper div (`.cal-dropdown` or `.cal-bottom-sheet`)
  containing `contentEl` to `document.body`. The wrapper sets
  `role="dialog"`, `aria-modal="true"`, and an `aria-label` supplied
  by the caller (default: `Calendar dialog`). On unmount, remove it
  and any event listeners.
- **Desktop (>=640px)**: position absolutely.
  - `top = anchorRect.bottom + 6` (px).
  - `left = align === 'start' ? anchorRect.left : anchorRect.right - dropdownWidth`.
  - Clamp horizontally to `[8, viewportWidth - dropdownWidth - 8]`.
  - If `top + dropdownHeight > viewportHeight - 8`, flip above:
    `top = anchorRect.top - dropdownHeight - 6`.
  - Add a transparent fixed-position backdrop behind the dropdown so
    outside clicks can be captured. Backdrop z-index uses
    `calc(var(--z-dropdown) - 1)`; wrapper z-index uses
    `var(--z-dropdown)` so Toast (`--z-toast`) remains above.
- **Mobile (<640px) AND `asBottomSheet`**: render as a bottom sheet.
  - Wrapper: `position: fixed; left: 0; right: 0; bottom: 0;
    border-radius: 14px 14px 0 0; max-height: 80vh;
    animation: bsIn .22s cubic-bezier(.2,.7,.3,1.05);`.
  - Prepend a `.bs-handle` element (38x4 round, `--border` color)
    automatically.
  - If `scrim`, the backdrop uses `rgba(8,8,24,.42)` instead of
    transparent.
- Event listeners:
  - `keydown` on `document` for Escape - calls `onClose`.
  - `mousedown` on the backdrop (or anywhere outside `contentEl`) -
    calls `onClose`.
    `mousedown` is intentional so close runs before a downstream click
    can re-trigger the anchor.
  - `resize` on `window` - re-measures and re-positions (desktop only).
- All listeners are added on mount and removed on unmount.
- The `.bs-handle` is created by this module; the caller's `contentEl`
  must not include one.

CSS class names are reused from [docs/design/calendar.md section 6.13](../../docs/design/calendar.md);
this task is purely structural - the CSS for `.cal-dropdown`,
`.cal-bottom-sheet`, `.bs-handle`, `.cal-dropdown-backdrop` lives in
Phase 08.

**Expected behavior**:
- A dropdown anchored to a button near the top-right of the viewport
  positions itself just below the button by default.
- A dropdown that would overflow the viewport bottom flips above the
  anchor.
- On a mobile viewport (window.innerWidth < 640), `asBottomSheet:
  true` produces a sheet at the bottom with a drag handle.
- Escape closes the dropdown.
- Clicking outside `contentEl` (anywhere on the backdrop) closes it.
- Calling `unmount()` removes the DOM nodes and all event listeners.

**Constraints**:
- No focus trap in v1 (design doesn't require one; popovers are
  short-lived).
- Do not call `onClose` more than once per close event. Keep an
  internal `closed`/`active` guard so duplicate close events are ignored
  even if the caller delays `unmount()`.
- Window resize handling on bottom-sheet is a no-op (the sheet's
  width is 100%). Known v1 edge: rotating from mobile to desktop while
  a sheet is open leaves it in sheet mode until closed.
- No body scroll lock in v1; behind-sheet scrolling is an accepted
  mobile UX paper-cut for this short-lived primitive.

**Validation**:
- New test file `tests/components/calendar/anchoredDropdown.test.js`
  using JSDOM:
  - Mounts; positions below anchor; `unmount()` removes wrapper.
  - Escape key fires `onClose`.
  - Backdrop click fires `onClose`.
  - With small viewport (stub `window.innerWidth = 320`) and
    `asBottomSheet: true`, wrapper has `.cal-bottom-sheet`, contains
    a `.bs-handle` element, and carries `role="dialog"`, `aria-modal`,
    and an accessible label.
  - With `align: 'end'`, the dropdown's right edge aligns with the
    anchor's right edge.
  - When anchored near the viewport bottom (stub `getBoundingClientRect`),
    flips above.

**Out of scope**:
- Focus trap / focus restoration.
- Animations beyond the bottom-sheet entrance.
- Touch-drag dismiss on the bottom sheet.

---

## Phase 03 — Action Panel (US-1, US-2, US-3, US-9)

### [X] Task 03.1 — `src/components/calendar/ActionPanel.js` — shell + greeting + empty states

**Target file**: `src/components/calendar/ActionPanel.js` (NEW)

**What to do**:
Create the Action Panel component module per
[contracts/api.md §3.6](contracts/api.md) and [docs/design/calendar.md §6.1–6.5](../../docs/design/calendar.md).
Public API:

```js
export const ActionPanel = {
  render(container, props) { /* builds & appends DOM */ },
  destroy() { /* removes DOM and listeners */ },
};
```

Props (from contracts/api.md §3.6):
`{ today, suggestions, upcoming, todayISO, greeting, dateLabel, onOpenApp,
   onDismiss, onMarkGhosted }`.

This task ships:
- Outer container `.cal-action-panel`.
- Greeting header: `.cal-greeting-h` headline (the greeting string) +
  `.cal-greeting-sub` (the date label like `Wed · May 20, 2026`).
- Three section blocks (`.cal-section` with `.cal-section-h` header):
  - `data-section="today"` — heading "Today".
  - `data-section="suggestions"` — heading "Suggested actions".
  - `data-section="upcoming"` — heading "Upcoming".
- Section header layout: `.cal-section__lbl` (the heading text) + `.cal-section__count` pill
  (hidden when empty) + `.cal-section__hint` (right-aligned tiny meta) per design §6.2.
- Empty state markup per design §6.5: a centered `.cal-empty` block with
  `.cal-empty__glyph`, `.cal-empty__h` headline, `.cal-empty__sub` subtext. Section-specific copy from
  design §6.5:
  - Today: glyph `○`, headline `Quiet day`, sub
    `Nothing on today. Enjoy the breather.`
  - Suggested: glyph `⊙`, headline `You're caught up`, sub
    `No suggestions right now. We'll surface new ones as activity ages.`
  - Upcoming: glyph `—`, headline `Nothing scheduled`, sub
    `No upcoming timeline events tomorrow through end of week.`

This task does NOT yet render activity rows or upcoming sub-groups —
those land in 03.2 and 03.3.

For now, the body of each section renders the empty state.

The `greeting` string is computed by the caller (page orchestrator,
Task 07.1). The Action Panel does not own time/random logic.

**Expected behavior**:
- `ActionPanel.render(container, props)` appends one `.cal-action-panel`
  node to `container`.
- Headline reads exactly the value of `props.greeting`.
- Sub reads exactly `props.dateLabel`.
- All three sections render their empty state (until rows land).
- `ActionPanel.destroy()` removes the panel and clears event
  listeners.

**Constraints**:
- No imports from `src/services/api.js` — the Action Panel is a
  presentational component.
- No localStorage / dismissal logic here — handled by the page
  orchestrator.
- Use semantic class names from [docs/design/calendar.md §6](../../docs/design/calendar.md);
  do not invent new ones.
- All HTML created via `document.createElement` + `append`. No
  `innerHTML` writes (consistent with the existing codebase).

**Validation**:
- New test file `tests/components/calendar/ActionPanel.test.js`:
  - Renders the greeting and date label verbatim.
  - All three sections present.
  - With empty `today`, `suggestions`, `upcoming` arrays, all three
    empty states render with the design's exact copy.
  - `destroy()` removes the panel and a second `render` is idempotent.

**Out of scope**:
- Activity rows (Task 03.2).
- Upcoming sub-groups (Task 03.3).
- CSS (Phase 08).

---

### [X] Task 03.2 — Activity row + action buttons

**Target file**: [src/components/calendar/ActionPanel.js](../../src/components/calendar/ActionPanel.js) (extend)

**What to do**:
Extend the Action Panel to render activity rows in the Today and
Suggestions sections per [docs/design/calendar.md §6.3](../../docs/design/calendar.md).

Row grid: `48px | minmax(0, 1fr) | auto` (ID pill, body, actions).
Each row has:
- `.cal-id-pill` — text `#024` (zero-padded 3 digits via
  `String(id).padStart(3, '0')`), DM Mono 10/500, `--navy` bg,
  white text.
- `.cal-row__title` — Sora 13.5/500, the row's `title` value.
- `.cal-row__meta` — DM Mono 10.5, format `{company} · {role}` with a
  `.cal-row__sep` separator. Single-line truncate.
- `.cal-actions` — action buttons.

Action buttons:
- `.cal-act-icon` (30×30): for `↗ Open` (SVG arrow up-right) and
  `× Dismiss` (SVG cross).
- `.cal-act-btn` (text, `6px 11px`): for `Mark Ghosted`.

Action mapping (per design §6.3):
- **Today rows**: `[open ↗]` only.
- **Suggestion rows**: `[primary] [dismiss ×]`.
  - `primary === 'open'` → `↗ Open` icon.
  - `primary === 'mark_ghosted'` → `Mark Ghosted` text button.
- Row body is **NOT** clickable (per [spec.md §Clarifications Q5](spec.md)).
  Only action buttons fire callbacks.

Click handlers wire to props:
- `↗ Open` on Today: `onOpenApp(row.id)`.
- `↗ Open` on Suggestion: `onOpenApp(suggestion.id)`.
- `× Dismiss` on Suggestion: `onDismiss(suggestion.id, suggestion.kind)`.
- `Mark Ghosted` on ghost Suggestion: `onMarkGhosted(suggestion.id)`.

The Today and Suggestions sections now switch between the empty
state (from 03.1) and a `.cal-row-list` of rows based on whether the
input array is non-empty. The count pill in `.cal-section-h` becomes
visible and shows the array length when non-empty.

Suggestion rows also render a `.cal-row__meta` line that is the suggestion's
`meta` string (e.g. `"7d since application"`) — same DM Mono 10.5
treatment, single-line.

**Expected behavior**:
- An empty `today` array → empty state.
- A non-empty `today` array → `.cal-row-list` with one `.cal-row` per item;
  count pill in header shows the number.
- Suggestion of kind `followup` renders with `↗ Open` + `× Dismiss`.
- Suggestion of kind `ghost` renders with `Mark Ghosted` text button
  + `× Dismiss`.
- Clicking `↗ Open` calls `onOpenApp(id)` exactly once.
- Clicking on the `.cal-row` body (not the buttons) does nothing —
  no callback fires.
- Clicking `× Dismiss` calls `onDismiss(id, kind)` exactly once.

**Constraints**:
- Buttons have `type="button"` to prevent any accidental form
  submission.
- Icon-only buttons have `aria-label` ("Open application", "Dismiss
  suggestion").
- Truncation on `.cal-row__meta` is via CSS only (Phase 08).
- Use `STATUS_CONFIG[status].label` from
  [src/models/application.js](../../src/models/application.js) only
  for popovers (status mode), not for action panel rows. Action panel
  rows display the suggestion / activity title, not the status label.
- ID pill format is exactly 3-digit zero-padded.

**Validation**:
- Extend `tests/components/calendar/ActionPanel.test.js`:
  - Today with 2 rows renders 2 `.cal-row` nodes; count pill reads `2`.
  - Each row has the correct `#NNN` ID pill, title, meta.
  - Suggestion row with `primary: 'open'` renders an `.cal-act-icon`
    (not an `.cal-act-btn`).
  - Suggestion row with `primary: 'mark_ghosted'` renders an
    `.cal-act-btn` with text "Mark Ghosted".
  - Clicking the `↗` icon fires `onOpenApp` with the correct id.
  - Clicking the `×` icon fires `onDismiss` with `(id, kind)`.
  - Clicking on the row body fires nothing.

**Out of scope**:
- Upcoming sub-groups (Task 03.3).
- Disabled state during in-flight requests (handled in Task 07.2).

---

### [X] Task 03.3 — Upcoming sub-groups

**Target file**: [src/components/calendar/ActionPanel.js](../../src/components/calendar/ActionPanel.js) (extend)

**What to do**:
Implement the Upcoming section's two sub-groups (`Tomorrow`, `Rest
of week`) per [docs/design/calendar.md §6.4](../../docs/design/calendar.md).

Structure:
- Section body contains zero or more `.upc-group` blocks.
- Each `.upc-group` has a `.upc-group-h` row:
  - `.cal-section__lbl` — uppercase label, e.g. `TOMORROW · THU MAY 21`.
  - `.cal-dash` — flex-grow dashed rule.
- Below the header: a `.cal-row-list` of activity rows (same row shape
  as Today, primary action `↗ Open` only).

Group labels:
- `Tomorrow`: `Tomorrow · {Pretty weekday} {Mon DD}`
  where pretty is `toLocaleDateString('en-US', { weekday: 'short',
  month: 'short', day: 'numeric' })`. Example: `Tomorrow · Thu May 21`.
- `Rest of week`: `Rest of week · thru {weekday} {Mon DD}` where the
  end is Sunday of the current ISO week. Example: `Rest of week ·
  thru Sun May 24`.

Both labels are intentionally case-cased in the data (mixed); CSS
applies `text-transform: uppercase` in Phase 08.

The count pill on the Upcoming section header shows
`tomorrow.length + restOfWeek.length` (omit if zero).

Render rules:
- If both `tomorrow` and `restOfWeek` are empty → empty state.
- If only one is non-empty → render only that group's header + rows.
- If both are non-empty → render both groups in order
  (Tomorrow first).

**Expected behavior**:
- An Upcoming with `tomorrow: 2 rows, restOfWeek: 0` renders one
  `.upc-group` with the Tomorrow header and 2 rows.
- An Upcoming with both populated renders two `.upc-group` blocks in
  the correct order.
- An Upcoming with both empty renders the empty state.
- Count pill reads the combined total.
- Each row's primary action is `↗ Open`; no Dismiss (these are real
  events, not suggestions).

**Constraints**:
- Date formatting uses `toLocaleDateString('en-US', ...)` with the
  exact options above for consistency.
- `Tomorrow` date is computed by the caller (page orchestrator);
  the component receives the prepared label string from the page or
  computes it from `todayISO`. To keep the component pure, accept
  `today` and `endOfWeek` as ISO strings via the props payload OR
  compute them inside `render` from a single `todayISO` prop. (Pick
  one in implementation — the choice is yours; preference: compute
  inside, derive once at render time.)

**Validation**:
- Extend `tests/components/calendar/ActionPanel.test.js`:
  - Both groups populated → two `.upc-group` blocks in correct order.
  - Only Tomorrow → one group.
  - Both empty → empty state.
  - Group label format matches `Tomorrow · Thu May 21` exactly for a
    stubbed `todayISO`.
  - Count pill shows combined total.

**Out of scope**:
- Mobile reflow (CSS-only, Phase 08).

---

## Phase 04 — Month Grid (US-4, US-6)

### [X] Task 04.1 — `src/components/calendar/MonthGrid.js` — header

**Target file**: `src/components/calendar/MonthGrid.js` (NEW)

**What to do**:
Create the MonthGrid component per [contracts/api.md §3.6](contracts/api.md)
and [docs/design/calendar.md §6.6](../../docs/design/calendar.md).

This task lands ONLY the header strip. Day cells and chips are in 04.2/04.3.

Public API:
```js
export const MonthGrid = {
  render(container, props) { /* ... */ },
  destroy() { /* ... */ },
};
```

Header layout (`.cal-grid-header`):
- `.cal-nav-btn` Prev (30×30, SVG `‹`).
- `.cal-title` group:
  - `button.yr.cal-month-btn` showing the month name (e.g. `May`).
  - `button.yr.cal-year-btn` showing the year + chevron icon.
- `.cal-nav-btn` Next (30×30, SVG `›`).
- `.cal-today-btn` (conditional — present only when the view is off
  the current month).
- `.filter-area` (right-aligned via `margin-left: auto`):
  - `.filter-chip` (idle: text `Status: All`; active: shows the
    selected status with a swatch dot).
  - `.filter-clear` (×) icon button visible only when filter is
    active.

Disabling rules:
- Prev disabled when `viewYear === YEAR_MIN && viewMonth === 0`.
- Next disabled when `viewYear === YEAR_MAX && viewMonth === 11`.

Event wiring:
- Prev/Next → `props.onNavigatePrev()` / `props.onNavigateNext()`.
- Month button → `props.onOpenMonthPicker(buttonEl)`.
- Year button → `props.onOpenYearPicker(buttonEl)`.
- Today → `props.onJumpToToday()`.
- Filter chip → `props.onOpenFilter(buttonEl)`.
- Filter clear → `props.onClearFilter()`.

The Month/Year/Filter buttons pass their own DOM element to the
callbacks so the page orchestrator can anchor the dropdowns.

**Expected behavior**:
- Header renders with the correct month name (`new Date(year,
  month, 1).toLocaleString('en-US', { month: 'long' })`).
- Today button is absent when viewing the current month.
- Today button is present when viewing a different month; clicking
  fires `onJumpToToday`.
- Prev is `disabled` at Jan 2020; Next is `disabled` at Dec
  (currentYear+5).
- Filter chip swatch is hidden when `filter === null` and shown
  with the status's `STATUS_CONFIG[status].borderAccent` color when
  filtered.
- Filter clear button is hidden when `filter === null`.

**Constraints**:
- All buttons have `type="button"`.
- Status filter swatch uses inline `style="background: <color>"` to
  pull from `STATUS_CONFIG` without needing a CSS-class explosion.
- Use the existing year-range constants from `src/utils/calendar.js`
  (`YEAR_MIN`, `YEAR_MAX`); do not redefine.

**Validation**:
- New test file `tests/components/calendar/MonthGrid.test.js`:
  - Header renders month name + year correctly for May 2026.
  - Prev disabled at boundary; Next disabled at boundary.
  - Today button hidden in current month; visible in a different
    month; clicking fires `onJumpToToday`.
  - Header controls call `onNavigatePrev`, `onNavigateNext`,
    `onOpenMonthPicker(anchor)`, `onOpenYearPicker(anchor)`,
    `onOpenFilter(anchor)`, and `onClearFilter`.
  - Filter chip shows "Status: All" when `filter === null`.
  - Filter chip shows the status label + swatch when filtered.
  - Filter clear button appears only when filtered.

**Out of scope**:
- Day cells (Task 04.2).
- Chips (Task 04.3).

---

### [X] Task 04.2 — DOW row + CW gutter + day cells

**Target file**: [src/components/calendar/MonthGrid.js](../../src/components/calendar/MonthGrid.js) (extend)

**What to do**:
Add the DOW header row and the 6×7 day-cell grid per [docs/design/calendar.md §6.7–6.8](../../docs/design/calendar.md).

DOW row (`.dow-row`):
- 8-column grid (`auto` + `repeat(7, 1fr)`).
- First column: `.dow-cell` with label `CW`, `aria-hidden="true"`.
- Columns 2–8: `.dow-cell` labels `Mon Tue Wed Thu Fri Sat Sun`.

Day grid (`.cal-grid`):
- 8-column grid: `[CW cell][7 day cells]` × 6 rows = 48 children.
- Compute the 6×7 day matrix via `weeksInMonthGrid(viewYear, viewMonth)`
  from `src/utils/calendar.js`.
- Each row begins with a `.cal-cw` element showing the ISO week
  number (Task 01.2 verified the algorithm). `.cal-cw` is `aria-hidden`,
  has a tooltip `title="Week N, {year}"` honoring boundary year
  rollovers.
- Day cells (`.cal-cell`):
  - Always render the day number in a `.cal-num` pill.
  - Apply state classes from [docs/design/calendar.md §6.8](../../docs/design/calendar.md):
    - `.cal-cell--out` if `!isCurrentMonth`.
    - `.cal-cell--weekend` if `isWeekend`.
    - `.cal-cell--today` if `isToday`.
  - Cell is `role="button"` + `tabIndex="0"` ONLY if the cell has
    activities (computed from `props.dayActivities[iso]`). Otherwise
    no role and `cursor: default`.
  - `aria-label` for active cells: `"{Pretty date}, {N} activity/activities"`.

This task does NOT yet render chips inside the cells. That's Task 04.3.

Click handler on cells with activities: `props.onOpenDayPopover('all',
iso, null, cellEl)`.

**Expected behavior**:
- Grid always renders 6 rows × 8 cells = 48 children.
- First grid cell is the CW gutter for the first row's Monday.
- DOW row first label is "CW".
- A cell representing today has the `.cal-cell--today` class.
- A cell from the previous month has `.cal-cell--out`.
- A Saturday cell has `.cal-cell--weekend`.
- A cell with zero activities has no `role`, `tabIndex`, or pointer
  cursor.
- A cell with activities is keyboard-focusable, has the correct
  `aria-label`, and a click fires `onOpenDayPopover('all', iso, null,
  cellEl)`.

**Constraints**:
- The CW gutter is computed from the Monday of each row (per design
  §6.8 canonical mapping).
- The day number is rendered even on out-of-month cells (the design
  shows them).
- Cells must NOT include role/tabindex when they have no activities
  (accessibility).

**Validation**:
- Extend `tests/components/calendar/MonthGrid.test.js`:
  - DOW row has 8 cells; first cell text is "CW"; days are in
    Mon-first order.
  - `.cal-grid` has 48 children.
  - First row's first non-gutter cell is the Monday of the week
    containing the 1st of the month.
  - Today cell has `.cal-cell--today`.
  - Out-of-month cells have `.cal-cell--out`.
  - Cells with no activities have no `role` and no click handler.
  - Cells with activities (stub `dayActivities`) have `role="button"`
    and fire `onOpenDayPopover` on click.
  - ISO week boundary case: navigate to Dec 2026 → Dec 28 row's CW
    cell shows `53`; Jan 2027 view → Jan 4 row's CW cell shows `1`.

**Out of scope**:
- Chips (Task 04.3).
- Filter dimming (Task 04.4).

---

### [X] Task 04.3 — Numbered chips + overflow

**Target file**: [src/components/calendar/MonthGrid.js](../../src/components/calendar/MonthGrid.js) (extend)

**What to do**:
Render status chips inside each day cell per [docs/design/calendar.md §6.8 → Numbered chip](../../docs/design/calendar.md).

For each day cell, compute the chips:
1. From `props.dayActivities[iso]` (the `DayActivity[]` for that date).
2. Group by `status` and count.
3. Sort by `STATUS_DISPLAY_PRIORITY` (imported from
   [src/models/application.js](../../src/models/application.js); see
   Task 01.1). The order is:
   ```
   accepted, offer, interview, assessment, phone_screen,
   wishlisted, applied, rejected, withdrawn, ghosted
   ```
4. Take the first 3 statuses; if more, render a 4th element `.num-more`
   with text `+N` where `N` is the count of remaining distinct statuses.

Each chip (`.num-chip`):
- `role="button"`, `tabIndex="0"`.
- Background: `STATUS_CONFIG[status].borderAccent`.
- Text color: `STATUS_CONFIG[status].badgeText`.
- Inner text: the activity count for that status (number only —
  the color carries identity).
- `aria-label`: `"{Status label}, N entries. Click to view."`
- `title`: same as aria-label so hover reveals the status.
- Click: `stopPropagation()` then `props.onOpenDayPopover('status',
  iso, status, chipEl)`.

`.num-more` chip:
- Class `.num-chip.num-more`.
- Background neutral (no inline style); CSS handles the dashed border.
- Text: `+N`.
- Click: `stopPropagation()` then `props.onOpenDayPopover('all', iso,
  null, chipEl)`.

The chip priority constant is `STATUS_DISPLAY_PRIORITY` from
[src/models/application.js](../../src/models/application.js)
(introduced in Task 01.1). Do **not** re-declare it in any
Calendar-feature module; do **not** hardcode the array inline in
MonthGrid / StatusFilterDropdown / DayPopover.

**Expected behavior**:
- A day with 1 `interview` + 2 `applied` renders 2 chips: interview
  (count 1) on the left, applied (count 2) on the right.
- A day with 4 distinct statuses renders 3 chips + 1 `+1` overflow.
- Clicking a chip fires `onOpenDayPopover('status', iso, status,
  chipEl)`. The cell's own click handler does NOT also fire (verify
  `stopPropagation`).
- Clicking `+N` fires `onOpenDayPopover('all', iso, null, chipEl)`.

**Constraints**:
- Stop propagation MUST work — the cell's all-mode click and the
  chip's status-mode click are independent.
- Chip text is the count only (no status label).
- Chip background is via inline style (status color); no CSS class
  per status.

**Validation**:
- Extend `tests/components/calendar/MonthGrid.test.js`:
  - With `dayActivities` containing 2 interview + 1 applied + 1
    offer + 1 wishlisted on the same date, the cell renders 3 chips
    (offer, interview, wishlisted — in priority order) + 1 `+1`
    overflow chip… wait: re-check priority. From the priority list:
    Offer (2) > Interview (3) > Wishlisted (6) > Applied (7). So
    chips are Offer (1), Interview (2), Wishlisted (1); `+1` covers
    Applied.
  - Verify chip text reads the count.
  - Verify `aria-label` and `title` are present.
  - Click chip → `onOpenDayPopover` called with `('status', iso,
    status, anchor)`; the cell's `onOpenDayPopover('all', ...)` is
    NOT also called (propagation stopped).
  - Click +N → `onOpenDayPopover('all', iso, null, anchor)`.

**Out of scope**:
- Filter dimming (Task 04.4).

---

### [X] Task 04.4 — Filter behavior (dimmed cells)

**Target file**: [src/components/calendar/MonthGrid.js](../../src/components/calendar/MonthGrid.js) (extend)

**What to do**:
Apply the status filter per [docs/design/calendar.md §8 → Filter behavior on the grid](../../docs/design/calendar.md).

When `props.filter` is a status key (not null):
- For each cell that has activities:
  - Compute the cell's "matching activities" = activities whose
    `status === filter`.
  - If matching is non-empty → render chips for the matching
    statuses only (re-use the existing rendering, but feed the
    filtered set).
  - If matching is empty → still render chips for ALL the cell's
    activities (so the cell is recognizable) but add the
    `.cal-cell--filter-hidden` class to the cell (35% opacity per CSS).
- Cells with no activities are unaffected.

The cell remains clickable in the filtered-hidden state; the day
popover opens in `all` mode showing every activity for that day —
the filter does not affect the popover (per [spec.md §Scope](spec.md)).

**Expected behavior**:
- With `filter: 'interview'`, cells that have an interview activity
  render only the interview chip (other chips suppressed).
- Cells with activities but no interview activity render their
  normal chips and have `.cal-cell--filter-hidden`.
- The cell's click handler still fires when filter-hidden.
- The Action Panel is unaffected (smoke-tested in Phase 11).

**Constraints**:
- Do NOT remove cells from the DOM — opacity only. The layout must
  not reflow.
- Filtered chip rendering reuses the existing chip pipeline; overflow
  naturally does not trigger for a single-status filter.

**Validation**:
- Extend `tests/components/calendar/MonthGrid.test.js`:
  - With `filter: 'interview'`:
    - A cell with [interview, applied] shows ONLY the interview chip.
    - A cell with [applied, offer] gets `.cal-cell--filter-hidden`
      and still shows both chips.
    - The cell's click still works (popover opens in all mode).

**Out of scope**:
- Filter chip UI (Task 04.1).
- Status filter dropdown (Task 05.3).

---

## Phase 05 — Pickers

### [X] Task 05.1 — `src/components/calendar/MonthPicker.js`

**Target file**: `src/components/calendar/MonthPicker.js` (NEW)

**What to do**:
Per [docs/design/calendar.md §6.10](../../docs/design/calendar.md):

Public API:
```js
export const MonthPicker = {
  open({ anchor, viewYear, viewMonth, onSelect, onClose }) { /* ... */ },
  close() { /* ... */ },
};
```

Renders a `.cal-picker` (260px desktop / bottom-sheet mobile) with:
- `.cal-picker-h` header: `.cal-picker__lbl` left label "Jump to month" + `.cal-picker__yr` right label
  showing the current view year.
- `.cal-picker-grid` 3-column grid of 12 `.cal-picker-item` buttons
  (Jan..Dec).
- States:
  - default
  - hover (CSS-only, Phase 08)
  - `.cal-picker-item--current` if `index === currentMonthLocal()` AND
    `viewYear === currentYearLocal()`.
  - `.cal-picker-item--selected` if `index === viewMonth`.

Selecting a month:
- Calls `onSelect(monthIndex)`.
- Calls `onClose()`.

Mounts via `mountAnchoredDropdown` from `anchoredDropdown.js` with
`align: 'start'`, `asBottomSheet: true`, `scrim: false`.

**Expected behavior**:
- Picker opens anchored to the trigger button (passed in `anchor`).
- 12 month buttons.
- Current month (system today) has `.cal-picker-item--current` only when
  viewing the current year.
- Selected month has `.cal-picker-item--selected`.
- Clicking a month fires `onSelect` then `onClose`.

**Validation**:
- New test file `tests/components/calendar/MonthPicker.test.js`:
  - 12 buttons in the grid.
  - Selection highlights the correct button.
  - Current month highlight is absent when `viewYear !== currentYearLocal()`.
  - Mount options use `align: 'start'`, `asBottomSheet: true`, and `scrim: false`.
  - Click fires `onSelect(idx)` and `onClose()` in that order.
  - Bottom-sheet variant present at `window.innerWidth = 320`.

**Out of scope**:
- Year picker (05.2).
- Disabled month entries; every month is valid for an in-range year, so the out-of-range disable rule is handled by YearPicker.

---

### [X] Task 05.2 — `src/components/calendar/YearPicker.js`

**Target file**: `src/components/calendar/YearPicker.js` (NEW)

**What to do**:
Per [docs/design/calendar.md §6.11](../../docs/design/calendar.md):

Public API:
```js
export const YearPicker = {
  open({ anchor, viewYear, onSelect, onClose }) { /* ... */ },
  close() { /* ... */ },
};
```

12-year grid with decade navigation:
- Initial `start = clamp(viewYear - 5, YEAR_MIN, YEAR_MAX - 11)`.
- Header right: `[‹] {start} – {start+11} [›]`.
- Body: 12 `.cal-picker-item` buttons.
- Year states:
  - `.cal-picker-item--current` if `year === currentYearLocal()`.
  - `.cal-picker-item--selected` if `year === viewYear`.
  - `.cal-picker-item--disabled` if `year < YEAR_MIN || year > YEAR_MAX`
    (out-of-range; `cursor: not-allowed`, no click).
- Range nav buttons:
  - Prev disabled when `start <= YEAR_MIN`.
  - Next disabled when `start + 12 > YEAR_MAX`.

Click on a valid year:
- Calls `onSelect(year)`.
- Calls `onClose()`.

Mounts via `mountAnchoredDropdown` with `align: 'start'`,
`asBottomSheet: true`, `scrim: false`.

**Expected behavior**:
- Picker initially centers `viewYear` mid-grid (or as close as
  YEAR_MIN/MAX allow).
- Out-of-range years render disabled.
- Prev/Next page buttons disable correctly at boundaries.
- Click on a valid year fires `onSelect` + `onClose`.
- Click on a disabled year is a no-op.

**Validation**:
- New test file `tests/components/calendar/YearPicker.test.js`:
  - Initial range centers `viewYear`.
  - Prev disabled at `start === YEAR_MIN`.
  - Next disabled near `YEAR_MAX`.
  - Out-of-range years have `.cal-picker-item--disabled` and ignore
    clicks.
  - Valid year click fires `onSelect(year)` + `onClose()`.
  - Mount options use `align: 'start'`, `asBottomSheet: true`, and `scrim: false`.

**Out of scope**:
- (none)

---

### [X] Task 05.3 — `src/components/calendar/StatusFilterDropdown.js`

**Target file**: `src/components/calendar/StatusFilterDropdown.js` (NEW)

**What to do**:
Per [docs/design/calendar.md §6.12](../../docs/design/calendar.md):

Public API:
```js
export const StatusFilterDropdown = {
  open({ anchor, filter, onSelect, onClose }) { /* ... */ },
  close() { /* ... */ },
};
```

Renders a `.filter-dd` with:
- First row: "All statuses" + `.none-glyph` (empty-circle outline) +
  `IconCheck` shown only when `filter === null`.
- Following rows: one per status, ordered by `STATUS_DISPLAY_PRIORITY`
  from [src/models/application.js](../../src/models/application.js)
  (Task 01.1). Each row:
  - grid `14px | auto | 1fr`: check column, swatch (8×8 round, inline
    background-color), label.
  - Swatch for `ghosted` uses an inline `border: 1px solid --border`
    so it reads on white (the `#ced4da` would otherwise vanish).

Hover state via CSS (Phase 08). Active row text + check use
`--indigo`.

Click on "All statuses" → `onSelect(null)` + `onClose()`.
Click on a status row → `onSelect(statusKey)` + `onClose()`.

Mounts via `mountAnchoredDropdown` with `align: 'end'`,
`asBottomSheet: true`, `scrim: false`.

**Expected behavior**:
- All 10 statuses + the "All statuses" sentinel render.
- Statuses appear in `STATUS_DISPLAY_PRIORITY` order.
- Active status (or "All" when `filter === null`) has the check
  icon visible.
- Click fires `onSelect(value)` + `onClose()`.

**Validation**:
- New test file `tests/components/calendar/StatusFilterDropdown.test.js`:
  - `STATUS_DISPLAY_PRIORITY.length + 1` rows present (statuses + "All statuses").
  - Order matches `STATUS_DISPLAY_PRIORITY` exactly (import the
    constant in the test; do NOT redeclare it).
  - With `filter: null`, the "All statuses" row has the check.
  - With `filter: 'interview'`, the Interview row has the check; no
    other row does.
  - Click "All statuses" → `onSelect(null)`.
  - Mount options use `align: 'end'`, `asBottomSheet: true`, and `scrim: false`.
  - Click "Interview" → `onSelect('interview')`.

**Out of scope**:
- Multi-select (out of scope; spec is single-select).

---

## Phase 06 — Day Popover (US-5)

### [X] Task 06.1 — `src/components/calendar/DayPopover.js`

**Target file**: `src/components/calendar/DayPopover.js` (NEW)

**What to do**:
Per [docs/design/calendar.md §6.9](../../docs/design/calendar.md):

Public API:
```js
export const DayPopover = {
  open({ mode, date, status, activities, anchor, onOpenApp, onClose }) { /* ... */ },
  close() { /* ... */ },
};
```

Renders a `.day-pop` with:
- `.day-pop-h` header:
  - `.day-pop__ttl` title:
    - Status mode: `"{Pretty date} · {Status label} ({N})"` where
      pretty is `toLocaleDateString('en-US', { weekday: 'short',
      month: 'short', day: 'numeric' })`.
    - All mode: `"{Pretty date} · All activity ({N})"`.
  - `.day-pop__count` span wraps `({N})` for color treatment.
  - `.day-pop__close` button (26×26, ×) → `onClose()`.
- `.day-pop-body` (scrollable):
  - Status mode: one `.day-row` per activity, with a `.cal-id-pill`
    on the left (same `#NNN` format as Action Panel rows).
  - All mode: rows grouped by status, ordered per
    `STATUS_DISPLAY_PRIORITY` from
    [src/models/application.js](../../src/models/application.js)
    (Task 01.1). Each row's left cell is a status badge
    (`.cal-status-badge`) using `STATUS_CONFIG[status]` colors +
    label, then ID, title, company.
  - Every `.day-row` ends with a `.day-row__arrow` element in the third grid column; it is visual only and the whole row remains the click target.
- `.day-pop-foot` (fixed bottom of the popover): static text `"Row click →
  opens application"` and `"View in Tracker →"` text.

Row click handler: `onOpenApp(activity.id)` then `onClose()`.

Mounts via `mountAnchoredDropdown({
  anchorEl: anchor, contentEl: popoverEl, align: 'start',
  asBottomSheet: true, scrim: true, onClose })`.

**Expected behavior**:
- Status mode with 3 activities renders 3 rows and the title reads
  `"Tue, May 19 · Applied (3)"` (for date 2026-05-19, status applied).
- All mode renders activities grouped by status priority; group
  ordering is stable across renders.
- Click on a row fires `onOpenApp(id)` and then closes the popover (`onClose()`).
- Empty `activities` renders a `.day-pop-empty` message instead of rows; it has no click behavior.
- Escape closes the popover.
- Backdrop click closes the popover.
- On mobile (window.innerWidth < 640), popover renders as a
  bottom-sheet variant with the drag handle.

**Constraints**:
- Row click does close + open via `onOpenApp(id); onClose();` in
  exactly that order (so the page orchestrator can sequence them).
- All mode groups by status — implement as: pre-sort `activities`
  by `STATUS_DISPLAY_PRIORITY`, then render in order. No need for
  explicit group headers in v1 (design's structure does not show
  them; the visual grouping comes from color clustering).
- The footer `View in Tracker` text is non-interactive in Phase 06; the row click is the only open action.
- Pretty date format uses `'en-US'` locale explicitly to match the
  design copy.

**Validation**:
- New test file `tests/components/calendar/DayPopover.test.js`:
  - Status-mode title format matches `"Tue, May 19 · Applied (3)"`.
  - All-mode title format matches `"Tue, May 19 · All activity (5)"`.
  - Row count matches `activities.length`.
  - Empty `activities` renders `.day-pop-empty` and no `.day-row` elements.
  - Click on a row fires `onOpenApp(id)` then `onClose()`.
  - Rows include the visual `.day-row__arrow` third column.
  - Click on `×` fires `onClose()`.
  - Escape fires `onClose()`.
  - Backdrop fires `onClose()`.
  - All-mode rows are sorted by `STATUS_DISPLAY_PRIORITY` (import
    the constant in the test; do NOT redeclare).

**Out of scope**:
- Optional `data-comment-anchor` markers (design §16 — none required
  in v1).

---

## Phase 07 — Page Orchestrator (US-8 Mark Ghosted; wires everything)

### [X] Task 07.1 — Rewrite `src/pages/Calendar.js` (mount + state + render)

**Target file**: [src/pages/Calendar.js](../../src/pages/Calendar.js) (REWRITE)

**What to do**:
Replace the existing placeholder implementation. The new module has:

```js
import * as api from '../services/api.js';
import * as authStore from '../data/authStore.js';
import { Toast } from '../components/Toast.js';
import { Modal } from '../components/Modal.js';
import { ActionPanel } from '../components/calendar/ActionPanel.js';
import { MonthGrid } from '../components/calendar/MonthGrid.js';
import { MonthPicker } from '../components/calendar/MonthPicker.js';
import { YearPicker } from '../components/calendar/YearPicker.js';
import { StatusFilterDropdown } from '../components/calendar/StatusFilterDropdown.js';
import { DayPopover } from '../components/calendar/DayPopover.js';
import { projectTimelineToCalendar, todayRowsFor, upcomingRowsFor }
  from '../utils/calendarProjection.js';
import { evaluateSuggestions } from '../utils/calendarSuggestions.js';
import * as dismissals from '../utils/calendarDismissals.js';
import { applyStatusChange } from '../models/application.js';
import { toISODate } from '../utils/date.js';

export function mount(container) { /* ... */ }
export function unmount() { /* ... */ }
export const Calendar = { mount, unmount };
```

Module state (variables, not classes):
- `_container`
- `_applications` (array)
- `_viewYear`, `_viewMonth`
- `_filter` (StatusKey | null)
- `_greeting` (string, computed once at mount)
- `_dismissals` (array)

Mount flow:
1. Save container; clear it.
2. Compute `_greeting` via local helper `chooseGreeting(new Date())`
   (see Task 07.5).
3. Set `_viewYear` and `_viewMonth` from `new Date()` (local).
4. `_filter = null`.
5. Render a top-level `.calendar-page` shell with two child slots:
   `.calendar-page__panel` (left) and `.calendar-page__grid` (right).
6. Render an inline "Loading…" placeholder inside both slots.
7. Call `await api.getAll()`. On success: `_applications = result;
   _dismissals = dismissals.load(authStore.getAuthState());
   _render()`. On failure: `Toast.show('Could not load calendar',
   'failure')` and call `_render()` with the in-memory empty
   `_applications = []`.

The `_render()` helper rebuilds:
- Derived data: `todayISO`, `dayActivities`, `today`,
  `upcoming`, `suggestions`.
- Mounts `ActionPanel.render(panelSlot, { greeting: _greeting, todayISO,
  dateLabel: …, today, suggestions, upcoming, onOpenApp:_onOpenApp,
  onDismiss:_onDismiss, onMarkGhosted:_onMarkGhosted })`.
- Mounts `MonthGrid.render(gridSlot, { viewYear, viewMonth,
  dayActivities, filter, onNavigatePrev, onNavigateNext,
  onJumpToToday, onOpenMonthPicker, onOpenYearPicker, onOpenFilter,
  onClearFilter, onOpenDayPopover })`.

Each handler is a local closure that updates state and calls
`_render()`. Pickers/popovers are opened by their respective
component modules with an `onClose` that nulls a local `_activeOverlay`
flag (used only to prevent reopening the same overlay).

Unmount:
- `ActionPanel.destroy(); MonthGrid.destroy();
   DayPopover.close(); MonthPicker.close(); YearPicker.close();
   StatusFilterDropdown.close();`
- Clear container.

**Expected behavior**:
- Mount renders the page shell immediately, then asynchronously
  loads applications and re-renders.
- Both columns render the loading placeholder until data arrives.
- On `api.getAll()` failure, the page renders empty states + a
  failure toast.
- Each navigation handler updates `_viewYear` / `_viewMonth`
  appropriately and re-renders.
- Filter handlers update `_filter` and re-render.
- Each picker handler opens the picker anchored to the trigger;
  picking a value updates state, closes the picker, re-renders.
- Day popover handler opens the popover with the correct mode and
  filtered/full activity list.

**Constraints**:
- Module-level singleton pattern (mirrors the existing `Calendar.js`
  + `Tracker.js`).
- No global / window writes.
- Greeting is computed ONCE at mount; subsequent re-renders reuse
  the same string.
- Loading placeholder text: literal `"Loading…"` in each slot —
  simple text, not a spinner.
- All handlers must be idempotent on repeated rapid calls (e.g.
  clicking Prev twice quickly is fine).
- Use `replaceChildren()` to clear slots before re-render.

**Validation**:
- New test file `tests/pages/Calendar.test.js`:
  - Mount renders the page shell.
  - `api.getAll()` mock resolving to a populated list → page renders
    Action Panel + Month Grid with that data.
  - `api.getAll()` mock rejecting → empty render + Toast.show called
    with 'failure'.
  - Clicking the Prev nav arrow updates the grid header to the
    previous month.
  - Picking a month from the Month Picker updates the grid.
  - Setting a filter updates the grid (cells dimmed) without
    affecting the Action Panel.
  - `unmount()` clears the container and destroys components.

**Out of scope**:
- Mark Ghosted handler (Task 07.2).
- Dismiss handler (Task 07.3).
- Open Overlay handler (Task 07.4).
- Greeting picker (Task 07.5).

---

### [X] Task 07.2 — Mark Ghosted handler (US-8)

**Target file**: [src/pages/Calendar.js](../../src/pages/Calendar.js) (extend)

**What to do**:
Implement the `_onMarkGhosted(applicationId)` handler:

1. Find `app = _applications.find(a => a.id === applicationId)`.
   If missing, log a warning and return (defensive).
2. Compute `next = applyStatusChange(app, 'ghosted', { text:
   'Marked as ghosted after prolonged inactivity.' })`.
3. Call `const updated = await api.update(applicationId, {
     status: next.status,
     lastStatusUpdate: next.lastStatusUpdate,
     timeline: next.timeline,
   })`.
4. Replace the application in `_applications` with the response.
5. Re-render.
6. `Toast.show('Marked #' + String(applicationId).padStart(3, '0') +
   ' as Ghosted', 'success')`.

Failure:
- Network / validation / transition error → `Toast.show('Could not
  mark as ghosted', 'failure')`. No state change.

**Expected behavior**:
- After a successful Mark Ghosted, the application's status is
  `ghosted` in `_applications`, a new timeline entry is appended,
  `lastStatusUpdate` matches today, and the ghost suggestion has
  disappeared from the panel.
- Failure leaves `_applications` untouched.
- Toast fires exactly once per click.

**Constraints**:
- Use `applyStatusChange` from `src/models/application.js`. Do NOT
  re-implement the merge here.
- Pass the full new timeline in the PATCH body (do not rely on the
  server to derive it).
- Do NOT optimistically update the UI before the response.

**Validation**:
- Extend `tests/pages/Calendar.test.js`:
  - Mock `api.update` to resolve with the next application.
    Trigger a ghost suggestion's Mark Ghosted button → assert
    `api.update` called with the expected body; assert
    `_applications` updated; assert Toast.show called with success;
    assert the suggestion no longer renders.
  - Mock `api.update` to reject → assert Toast.show called with
    failure; assert state unchanged.

**Out of scope**:
- Disabling the button during the in-flight request (acceptable
  to add as a small refinement if convenient; not required by spec).

---

### [X] Task 07.3 — Dismiss handler (US-9)

**Target file**: [src/pages/Calendar.js](../../src/pages/Calendar.js) (extend)

**What to do**:
Implement `_onDismiss(applicationId, kind)`:

1. `dismissals.add(authStore.getAuthState(), applicationId, kind)`.
2. `_dismissals = dismissals.load(authStore.getAuthState())` (re-load
   to capture the latest list).
3. Re-render.

No toast. The row exits silently per [docs/design/calendar.md §8](../../docs/design/calendar.md).

**Expected behavior**:
- After dismiss, the suggestion is no longer in the Action Panel.
- In hosted + local modes, the `localStorage` key contains the new
  dismissal record; re-mounting the page preserves the dismissal.
- **In demo mode**, the dismissal is preserved in memory for the
  page lifetime but `localStorage` is unchanged (page refresh exits
  demo and resets the bucket per feature 020).

**Constraints**:
- Do not show a toast.
- Do not call `api.update` (dismissals are client-only).
- The handler is the same code path for all auth states — the
  storage divergence lives entirely inside `calendarDismissals.js`.

**Validation**:
- Extend `tests/pages/Calendar.test.js`:
  - With a local-mode authState, trigger a dismiss → assert
    `localStorage.setItem` called with the correct key + body;
    assert the suggestion disappears from the rendered Action
    Panel; assert no Toast.show.
  - Re-mount the page after dismiss → assert the suggestion still
    suppressed (load picks up the dismissal).
  - With a demo authState, trigger a dismiss → assert
    `localStorage.setItem` is NOT called; assert the suggestion
    disappears; assert a second mount on the same JS context still
    suppresses (in-memory bucket persists); assert
    `_resetForTesting()` + re-mount restores the suggestion.

---

### [X] Task 07.4 — Open Application Overlay handler

**Target file**: [src/pages/Calendar.js](../../src/pages/Calendar.js) (extend)

**What to do**:
Implement `_onOpenApp(applicationId)`:

1. Close any open popover.
2. `try { const application = await api.getById(applicationId); }`
   `catch { Toast.show('Application details failed to load',
   'failure'); return; }`.
3. `Modal.open(application, {
       onApplicationUpdate: (updated) => {
         _applications = _applications.map(a => a.id === updated.id ? updated : a);
         _render();
       },
       onArchiveSuccess: (updated) => {
         _applications = _applications.filter(a => a.id !== updated.id);
         _render();
       },
     })`.

The handler is shared between Action Panel rows and Day Popover
rows.

**Expected behavior**:
- Clicking `↗ Open` on any panel row closes any open popover, then
  refetches the application, then opens the overlay.
- Clicking a row inside a popover closes the popover (popover does
  this itself), then opens the overlay.
- Edits saved via the overlay update `_applications` and re-render
  the page.
- Archive from the overlay removes the application and re-renders.

**Constraints**:
- ALWAYS refetch via `api.getById` (do not pass the in-memory copy).
  Per [research.md §8](research.md).
- The overlay handles its own lifecycle; the page only provides
  callbacks.

**Validation**:
- Extend `tests/pages/Calendar.test.js`:
  - Mock `api.getById` to resolve. Trigger an Open click → assert
    `api.getById` called; assert `Modal.open` called with the
    returned application and callbacks.
  - Mock `api.getById` to reject → assert Toast.show called with
    failure; `Modal.open` NOT called.
  - Invoke the `onApplicationUpdate` callback → assert
    `_applications` reflects the update.

---

### [X] Task 07.5 — Greeting selection

**Target file**: [src/pages/Calendar.js](../../src/pages/Calendar.js) (extend)

**What to do**:
Implement `chooseGreeting(date)` as a local helper inside Calendar.js
(not exported, but exportable for tests):

```js
const POOLS = {
  morning:    ['Good morning,', 'Morning,', 'Rise and shine,', 'Bright and early,'],
  afternoon:  ['Good afternoon,', 'Afternoon,', 'Mid-day check-in,'],
  evening:    ['Good evening,', 'Evening,', 'Winding down,'],
  lateNight:  ['Burning the midnight oil?', 'Late night session,', 'Night owl mode,'],
};
const NEUTRAL = ['Here\'s what we have today,', 'Today at a glance,', 'Welcome back,'];

function chooseGreeting(date, randomFn = Math.random) {
  const hour = date.getHours();
  let pool;
  if (hour >= 5 && hour <= 11)        pool = POOLS.morning;
  else if (hour >= 12 && hour <= 16)  pool = POOLS.afternoon;
  else if (hour >= 17 && hour <= 21)  pool = POOLS.evening;
  else                                 pool = POOLS.lateNight; // 22–04
  const merged = [...pool, ...NEUTRAL];
  return merged[Math.floor(randomFn() * merged.length)];
}

export { chooseGreeting };  // for tests
```

Compute the date label (e.g. `Wed · May 20, 2026`):
```js
function formatDateLabel(date) {
  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
  const rest = date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return `${day} · ${rest}`;
}
```

Both helpers are called once at mount; their outputs are stored in
`_greeting` and used in every subsequent `_render()`.

**Expected behavior**:
- At hour 8, the greeting is one of `['Good morning,', 'Morning,',
  'Rise and shine,', 'Bright and early,', 'Here\'s what we have
  today,', 'Today at a glance,', 'Welcome back,']` (the merged
  morning pool).
- At hour 14, the greeting is from the afternoon merged pool.
- At hour 23, from the late-night merged pool.
- At hour 4, from the late-night merged pool.

**Constraints**:
- Accept an optional `randomFn` so tests can inject deterministic
  picks.
- `Math.random` is called exactly once per mount (do not re-roll
  on re-renders).
- The greeting string is included in the props passed to
  `ActionPanel`.

**Validation**:
- Extend `tests/pages/Calendar.test.js`:
  - Stub `Math.random` to return `0` → expect the first entry of
    the time-window pool.
  - Stub `Math.random` to return `0.999…` → expect the last entry
    of the merged pool (a neutral entry).
  - Use `vi.setSystemTime` to fix `new Date()` to specific hours
    and assert the pool selection.

**Out of scope**:
- Greeting re-rolling on hour change (intentionally not done).

---

## Phase 08 — Styling

### [X] Task 08.1 — Add Calendar CSS block to `src/styles/main.css`

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Append a single `/* === Calendar === */` section to `main.css`.
Implement every selector referenced in [docs/design/calendar.md §4–6](../../docs/design/calendar.md)
and used by the components from Phases 03–06.

**Class-naming rule (load-bearing — per spec review m2):**
Every Calendar-introduced class MUST be prefixed `cal-` (or use an
already-feature-prefixed name like `upc-`, `dow-`, `filter-`, `num-`,
`day-`, `bs-`). This matches the existing project pattern (Timeline
uses `tl-*`; StatusDropdown uses `status-dropdown-*`). The design
doc's bare class names (`.row`, `.section`, `.empty`, `.title`,
`.meta`, `.picker`) are prototype names — they MUST be renamed to
`cal-*` equivalents in the implementation. This is the only way to
prevent collisions with Tracker / Profile / future pages, because
the day popover and pickers mount under `document.body` (NOT under
`.calendar-page`) and so cannot be safely scoped via descendant
selectors.

Class-name mapping (design doc name → implementation name):

| Design doc | Implementation |
|---|---|
| `.row` | `.cal-row` |
| `.section` | `.cal-section` |
| `.section-h` | `.cal-section-h` |
| `.empty` | `.cal-empty` |
| `.glyph`, `.h`, `.sub` (children of `.empty`) | `.cal-empty__glyph`, `.cal-empty__h`, `.cal-empty__sub` |
| `.lbl`, `.count`, `.hint` (children of section header) | `.cal-section__lbl`, `.cal-section__count`, `.cal-section__hint` |
| `.id-pill` | `.cal-id-pill` |
| `.title`, `.meta`, `.sep` (children of `.cal-row`) | `.cal-row__title`, `.cal-row__meta`, `.cal-row__sep` |
| `.actions`, `.act-icon`, `.act-btn` | `.cal-actions`, `.cal-act-icon`, `.cal-act-btn` |
| structural ActionPanel wrappers | `.cal-greeting`, `.cal-section-h__left`, `.cal-row-list`, `.cal-row__body` |
| `.act-icon.danger` modifier | `.cal-act-icon.danger` and `.cal-act-icon--danger` |
| `.dash` (in `.upc-group-h`) | `.cal-dash` |
| `.greeting-h`, `.greeting-sub` | `.cal-greeting-h`, `.cal-greeting-sub` |
| `.grid-header` | `.cal-grid-header` |
| `.today-btn` | `.cal-today-btn` |
| `.filter-area`, `.filter-chip`, `.filter-clear` | keep (already `filter-` prefixed; no collision in this codebase) |
| `.dow-row`, `.dow-cell` | keep |
| `.upc-group`, `.upc-group-h` | keep |
| `.num-chip`, `.num-more` | keep |
| `.cal-grid`, `.cal-cell`, `.cal-cw`, `.cal-num`, `.cal-nav-btn`, `.cal-title`, `.cal-month-btn`, `.cal-year-btn` | keep (already `cal-` prefixed) |
| `.day-pop`, `.day-pop-h`, `.day-pop-body`, `.day-pop-foot`, `.day-row` | keep (already `day-` prefixed and very specific) |
| `.ttl`, `.close` (children of `.day-pop-h`) | `.day-pop__ttl`, `.day-pop__close` |
| `.status-badge` (in all-mode rows) | `.cal-status-badge` |
| `.picker`, `.picker-h`, `.picker-grid`, `.picker-item`, `.picker-item--current`, `.picker-item--selected`, `.picker-item--disabled` | `.cal-picker`, `.cal-picker-h`, `.cal-picker-grid`, `.cal-picker-item`, `.cal-picker-item--current`, `.cal-picker-item--selected`, `.cal-picker-item--disabled` |
| `.lbl`, `.yr`, `.yr-nav` (in picker headers) | `.cal-picker__lbl`, `.cal-picker__yr`, `.cal-picker__yr-nav` |
| `.filter-dd`, `.filter-dd-row`, `.none-glyph` | keep |
| `.cal-dropdown`, `.cal-dropdown-backdrop`, `.cal-bottom-sheet`, `.bs-handle` | keep |

This mapping must be honored consistently across all Phase 03–06
component tasks. The implementer applying Phase 08 should not
introduce design-doc bare names anywhere in main.css.

Section structure:

```css
/* === Calendar === */
.calendar-page { /* container max-width, padding, layout grid */ }
.calendar-page__panel { /* ActionPanel host: border, radius, padding, shadow */ }
.calendar-page__grid  { /* MonthGrid host: same panel styling */ }

/* Greeting */
.cal-greeting-h, .cal-greeting-sub { /* §6.1 */ }

/* Sections + rows (shared shape, used by Action Panel and Day Popover) */
.cal-section, .cal-section-h,
.cal-section__lbl, .cal-section__count, .cal-section__hint,
.cal-empty, .cal-empty__glyph, .cal-empty__h, .cal-empty__sub { /* §6.2, §6.5 */ }
.cal-row { /* row grid, padding, border-bottom — §6.3 */ }
.cal-id-pill, .cal-row__title, .cal-row__meta, .cal-row__sep,
.cal-actions, .cal-act-icon, .cal-act-icon--danger, .cal-act-btn,
.cal-greeting, .cal-section-h__left, .cal-row-list, .cal-row__body { /* §6.3 */ }

/* Upcoming groups */
.upc-group, .upc-group-h, .cal-dash { /* §6.4 */ }

/* Month grid header */
.cal-grid-header, .cal-nav-btn, .cal-title, .cal-month-btn, .cal-year-btn,
.cal-today-btn, .filter-area, .filter-chip, .filter-clear { /* §6.6 */ }

/* DOW row + CW gutter */
.dow-row, .dow-cell, .cal-cw { /* §6.7, §6.8.1 */ }

/* Cells + chips */
.cal-grid, .cal-cell, .cal-cell--out, .cal-cell--weekend,
.cal-cell--today, .cal-cell--filter-hidden, .cal-num,
.num-chip-list, .num-chip, .num-more { /* §6.8 */ }

/* Day popover */
.day-pop, .day-pop-h, .day-pop__ttl, .day-pop__close,
.day-pop-body, .day-row, .day-row__arrow, .day-pop-empty,
.day-pop-foot, .day-pop-foot__hint, .day-pop-foot__link,
.cal-status-badge { /* §6.9 */ }

/* Pickers */
.cal-picker, .cal-picker-h, .cal-picker-grid, .cal-picker-item,
.cal-picker-item--current, .cal-picker-item--selected,
.cal-picker-item--disabled, .cal-picker-nav, .cal-picker__lbl,
.cal-picker__yr, .cal-picker__yr-nav { /* sections 6.10, 6.11 */ }

/* Status filter dropdown */
.filter-dd, .filter-dd-row, .filter-dd-check, .filter-dd-swatch,
.filter-dd-label, .none-glyph { /* section 6.12 */ }

/* Anchored dropdown / bottom sheet */
.cal-dropdown, .cal-dropdown-backdrop, .cal-bottom-sheet, .bs-handle { /* section 6.13; z-index uses --z-dropdown / calc(var(--z-dropdown) - 1), below --z-toast */ }

/* Mobile overrides */
@media (max-width: 1199px) { /* narrow desktop: stack columns */ }
@media (max-width: 639px)  { /* mobile: compact + bottom-sheet variant */ }
```

Use existing design tokens from `main.css` (the `--bg`, `--surface`,
`--border`, `--indigo`, `--navy`, `--t1..4`, `--shadow-*`, `--r-*`
variables defined for the rest of the app). If a token referenced
by [docs/design/calendar.md §4](../../docs/design/calendar.md) does
not yet exist in `main.css` (e.g. `--indigo-dim`, `--indigo-soft`,
`--indigo-hover`, `--border-2`), add it under the existing
`:root { … }` block alongside the other variables. The design's
weekend tints (`#FBF9F4` in-month, `#F7F3EC` out-of-month) and
out-of-month bg (`#FAF7F1`) may be used inline in selectors (no
new tokens needed if they are used only once).

Animations: `bsIn` keyframes for the bottom sheet entrance.

**Expected behavior**:
- Tracker and Profile pages remain visually unchanged.
- Calendar page renders matching the design spec on:
  - Wide desktop (≥1200px): two-column layout.
  - Narrow desktop (640–1199px): stacked.
  - Mobile (<640px): stacked + compact + popovers as bottom sheets.

**Constraints**:
- **No bare design-doc class names at any selector level.** Every
  introduced class is `cal-*` or an existing feature-prefixed name
  per the mapping table above.
- No `@import` of new CSS files.
- No utility frameworks (no Tailwind, etc.).
- Animations under `@media (prefers-reduced-motion: reduce)` should
  shorten to ~0s.

**Validation**:
- No automated CSS tests beyond the snapshot effects validated in
  Phase 11 (manual smoke).
- Run the dev server and confirm the page visually matches the
  design.
- Run the full Vitest suite to confirm no other page broke.

**Out of scope**:
- Refactoring existing main.css selectors.
- Splitting main.css into per-page files (deferred per [research.md §9](research.md)).

---

## Phase 09 — Seed Augmentation

### [X] Task 09.1 — Augment `src/data/demoSeed.js` for suggestion coverage

**Target file**: [src/data/demoSeed.js](../../src/data/demoSeed.js)

**What to do**:
Adjust 5 demo records (or add 5 new ones — implementer's choice;
prefer adjusting existing ones to keep the demo dataset small) so
that against `toISODate()` (today, computed at seed build time),
each of the following suggestion kinds fires:

- `followup`: an application with status `applied` whose latest
  timeline entry is `applied` dated 8 days ago.
- `feedback`: an application with status `phone_screen` whose latest
  timeline entry is `phone_screen` dated 6 business days ago.
- `interview_followup`: an application with status `interview` whose
  latest timeline entry is `interview` dated 8 days ago.
- `offer_expiry`: an application with status `offer` whose latest
  `offer` timeline entry is dated 4 days ago.
- `ghost`: an application with status `applied` (or any of the 5
  ghost-rule statuses) whose latest timeline entry is dated 16 days
  ago and no future entries exist.

Use the existing date-shift pattern in [src/data/demoSeed.js](../../src/data/demoSeed.js)
— dates derived from `Date.now()` so the seed stays "current" across
days.

Ensure these adjustments do NOT break the existing parity test
([tests/data/demoStore.test.js](../../tests/data/demoStore.test.js))
which compares demo seed vs. SQLite seed. Task 09.2 mirrors these
changes to the SQLite seed.

**Expected behavior**:
- After running `buildDemoSeed()`, calling
  `evaluateSuggestions(demoApps, toISODate(), [])` returns at least
  one suggestion of each kind.

**Constraints**:
- Demo seed should remain visually coherent — the augmented
  applications should look like realistic demo applications, not
  test fixtures.
- Do not exceed the existing seed count by more than 5 records.

**Validation**:
- Manual: run `npm run dev`, click "Try the demo" on the welcome
  page, navigate to Calendar, confirm all 5 suggestion kinds render.
- Automated: see Task 09.4.

**Out of scope**:
- SQLite seed (Task 09.2).
- Hosted starter (Task 09.3).

---

### [X] Task 09.2 — Augment `server/seeds/applicationsData.js`

**Target file**: [server/seeds/applicationsData.js](../../server/seeds/applicationsData.js)

**What to do**:
Mirror the demo seed adjustments from 09.1. Same 5 suggestion kinds
must fire on the SQLite seed. Use the same dynamic-date pattern (the
SQLite seed today already uses ISO strings; either compute dates
relative to `Date.now()` at module load — same pattern as demoSeed
— or accept that the SQLite seed dates drift over time and document
that local dev users may need to re-seed periodically).

Recommended approach: compute dates relative to `Date.now()` (matches
demoSeed; keeps the parity test happy; eliminates drift). The
existing seed has a mix of hardcoded ISO strings and date-shifted
ones; adopt the shift pattern for the 5 new records.

**Expected behavior**:
- After `npm run db:clear && npm run db:seed`, calling
  `evaluateSuggestions(loadedApps, toISODate(), [])` returns at
  least one suggestion of each kind.
- The existing demo/SQLite parity test in
  [tests/data/demoStore.test.js](../../tests/data/demoStore.test.js)
  still passes (because both seeds were augmented in lockstep).

**Constraints**:
- Maintain the SQLite seed's "storage shape" — JSON-stringified
  `timeline` per [src/models/application.js](../../src/models/application.js)
  normalization conventions.

**Validation**:
- Run `npm run db:clear && npm run db:seed && npm run test:run`.
  All seed tests green.

---

### [X] Task 09.3 — Update canonical `claim_and_seed_starter` RPC body

**Target file**: [docs/db/claim_and_seed_starter.md](../../docs/db/claim_and_seed_starter.md)

**What to do**:
Extend the canonical RPC body (the canonical source per feature 025)
so the two starter applications inserted on first hosted login
include timelines that trigger at least one suggestion kind on day
1 (most likely a `followup` on the older starter row).

Do NOT increase the count beyond 2 starter rows. The two starter
rows already exist; this task adjusts their timeline JSONB literals
so the `followup` rule fires for the older row.

Document the migration in the same file under a "v3 (feature 026)"
heading (the file already has a v2 from feature 025).

**Expected behavior**:
- The canonical RPC body in `docs/db/claim_and_seed_starter.md`
  shows the new starter timelines.
- Operators can copy the SQL block from this doc into Supabase to
  apply the update.

**Constraints**:
- Do NOT modify the live Supabase database. This task only updates
  the doc.
- The two starter rows' top-level fields (companyName, jobTitle,
  status, etc.) are unchanged — only `timeline` JSON is adjusted.

**Validation**:
- Manual review of the doc. No automated test (the RPC body is
  text-only at this level; live execution is a hosted-mode smoke
  test in Phase 11).

**Out of scope**:
- Auto-applying the migration during deploy.
- Backfilling existing hosted users' starter rows.

---

### [X] Task 09.4 — Add seed-coverage assertion

**Target file**: [tests/seed-data.test.js](../../tests/seed-data.test.js)

**What to do**:
Extend the existing seed-data test with an assertion that the
demo seed (and, if reachable, the SQLite seed) triggers at least
one suggestion of each of the 5 kinds against a frozen "today".

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildDemoSeed } from '../src/data/demoSeed.js';
import { evaluateSuggestions } from '../src/utils/calendarSuggestions.js';
import { toISODate } from '../src/utils/date.js';

describe('demo seed — suggestion coverage', () => {
  beforeEach(() => { vi.setSystemTime(new Date('2026-05-21T10:00:00')); });
  afterEach(() => { vi.useRealTimers(); });

  it('triggers all five suggestion kinds', () => {
    const { applications } = buildDemoSeed();
    const todayISO = toISODate();
    const suggestions = evaluateSuggestions(applications, todayISO, []);
    const kinds = new Set(suggestions.map(s => s.kind));
    expect(kinds).toContain('followup');
    expect(kinds).toContain('feedback');
    expect(kinds).toContain('interview_followup');
    expect(kinds).toContain('offer_expiry');
    expect(kinds).toContain('ghost');
  });
});
```

If the local SQLite seed is importable as a plain JS module (it is —
`server/seeds/applicationsData.js` exports `DEMO_RECORDS`), add an
analogous test against that array (translated to frontend shape via
the existing parity helper, if any).

**Expected behavior**:
- The test fails before Task 09.1 + 09.2 are complete.
- The test passes once both seeds are augmented.

**Constraints**:
- Use `vi.setSystemTime` to a stable date — the seed dynamically
  shifts dates relative to `Date.now()`, so the test "today" must
  match.

**Validation**:
- The test must pass on the merge state.

**Out of scope**:
- Validating the hosted starter (it's RPC SQL, not a JS module).

---

## Phase 10 — Release Prep (REQUIRED)

### [x] Task 10.1 — Version bump

**Target files**: [package.json](../../package.json), [src/pages/welcome/shared/appMeta.js](../../src/pages/welcome/shared/appMeta.js)

**What to do**:
- Bump the version in `package.json` per semver (minor — new feature,
  no breaking changes). Current version is in `package.json`; the
  next minor.
- Update `APP_VERSION` in `src/pages/welcome/shared/appMeta.js` to
  match.

**Expected behavior**:
- `package.json` `version` field and `APP_VERSION` literal match.

**Constraints**:
- Do not bump major or patch; this is a feature add.
- Do not add a pre-release suffix.

**Validation**:
- Existing `tests/release-metadata.test.js` (added in feature 025)
  asserts the two values match. Run it.

---

### [x] Task 10.2 — CHANGELOG entry

**Target file**: [CHANGELOG.md](../../CHANGELOG.md)

**What to do**:
Add a new entry for the bumped version, under a header like
`## [0.13.0] — 2026-05-21` (adjust to match the project's CHANGELOG
format). Include:

- A one-line summary of the Calendar feature.
- A bullet list of user-facing surface additions:
  - Calendar page with Action Panel + Month Grid
  - Today, Suggested Actions, Upcoming sections
  - Status filter, month/year navigation, day popovers
  - Mark Ghosted from suggestion rows
- A note on operator action required (hosted only): see
  `quickstart.md §4` for the `claim_and_seed_starter` RPC update.

Keep the entry concise. Style should match prior feature entries.

**Expected behavior**:
- CHANGELOG.md has the new section at the top under "Unreleased" or
  the latest version header.

**Validation**:
- Visual review.

---

### [x] Task 10.3 — README updates

**Target file**: [README.md](../../README.md)

**What to do**:
Add a brief mention of the Calendar page in the feature overview /
screenshots section if such a section exists. Link to the design
doc for visual reference. Add a one-line note under the "What this
app does" section.

If README has a "Pages" table or list, add Calendar with a short
description.

**Expected behavior**:
- README references the new page where it surfaces other pages.

**Constraints**:
- Do not duplicate spec / design content. README is high-level.

---

### [x] Task 10.4 — Deployment doc update

**Target file**: [docs/deployment.md](../../docs/deployment.md)

**What to do**:
Append a "Calendar (feature 026)" subsection to the hosted-mode
section of `docs/deployment.md`. Reference
[docs/db/claim_and_seed_starter.md](../../docs/db/claim_and_seed_starter.md)
for the RPC update operators must apply. Explain that:

- No new env vars are introduced.
- No new tables / columns / migrations.
- The single operator action is the RPC update for starter timelines
  (optional — old hosted users are unaffected; new hosted users
  benefit).

**Expected behavior**:
- Operators reading `docs/deployment.md` see the Calendar entry and
  know there's a one-time RPC follow-up.

---

### [x] Task 10.5 — REPO_MAP updates

**Target file**: [docs/REPO_MAP.md](../../docs/REPO_MAP.md)

**What to do**:
Add entries for every new file introduced in this feature:

- `src/pages/Calendar.js` — update the existing entry; it's no
  longer a placeholder.
- `src/components/calendar/ActionPanel.js`
- `src/components/calendar/MonthGrid.js`
- `src/components/calendar/DayPopover.js`
- `src/components/calendar/MonthPicker.js`
- `src/components/calendar/YearPicker.js`
- `src/components/calendar/StatusFilterDropdown.js`
- `src/components/calendar/anchoredDropdown.js`
- `src/utils/calendar.js`
- `src/utils/calendarProjection.js`
- `src/utils/calendarSuggestions.js`
- `src/utils/calendarDismissals.js`
- All new test files under `tests/utils/`, `tests/components/calendar/`,
  and `tests/pages/Calendar.test.js`.
- New spec package row for `specs/026-calendar/` (mirror the
  `025-application-timeline/` row).

For the `src/models/application.js` entry, append a note about
`applyStatusChange`.

**Constraints**:
- Keep the table format consistent with existing rows.
- One line per file. Avoid prose.

---

### [x] Task 10.6 — Docs sanity check

**Target file**: (cross-cutting)

**What to do**:
Final pre-merge sweep:

- All new spec artifacts under `specs/026-calendar/` link correctly.
- No broken markdown links in any updated file.
- Lint: `npm run lint` passes.
- Format: `npm run format -- --check` passes.
- Tests: `npm run test:run` passes (all suites green).

**Expected behavior**:
- All three commands exit 0.

**Validation**:
- Run the three commands.

**Out of scope**:
- Refactoring tests for style.

---

## Phase 11 — Browser Smoke Test (REQUIRED — UI feature)

This phase is the constitution's mandatory final phase for UI features.
Per Amendment 1.3.0, it is ordered AFTER Release Prep so the smoke
test exercises the to-be-merged state.

### [X] Task 11.1 — Layout & responsive smoke

**What to do**:
Following [quickstart.md §6](quickstart.md) **Layout & responsiveness**:

- Wide desktop (≥1200px): Action Panel + Month Grid side-by-side.
- Narrow desktop (640–1199px): stacked.
- Mobile (<640px): stacked, compact, popovers become bottom sheets.

**Validation**:
- Tick each row in quickstart.md §6 Layout block.

---

### [X] Task 11.2 — Action Panel smoke (US-1, US-2, US-3)

**What to do**:
Walk the Action Panel checklist in [quickstart.md §6](quickstart.md).
Confirm Today, Suggested Actions, Upcoming sections each render
correctly, including empty states, count pills, and the 5 suggestion
kinds.

**Validation**:
- All quickstart Action Panel rows ticked.

---

### [X] Task 11.3 — Month Grid smoke (US-4)

**What to do**:
Walk the Month Grid checklist: always-6-weeks, ISO Monday start, CW
gutter (year-boundary spot-check), today highlighting, chips +
overflow, out-of-month tint, weekend tint.

**Validation**:
- All quickstart Month Grid rows ticked.

---

### [ ] Task 11.4 — Day Popover smoke (US-5) → superseded by Phase 12 v2

**What to do**:
Walking this checklist on v1 surfaced obs #2 (desktop popover does
not anchor under the click target) and obs #3 (static help-text
footer). Rather than patching the v1 popover, Phase 12 replaces it
with the **v2 Inline Day Details Panel** (`docs/design/calendar.md` §17).

This task therefore stays `[ ]` against v1 and is replaced by
**Task 13.X — Inline Day Panel smoke (v2)** in `quickstart.md §6`. Do
not attempt to re-tick this v1 checklist after Phase 12 ships.

**Validation**:
- Marked superseded in Phase 13 re-smoke; the v2 inline-panel
  checklist replaces it.

---

### [X] Task 11.5 — Navigation smoke (US-7)

**What to do**:
Walk the Navigation checklist: arrows, month/year pickers, Today
button, year-range clamps.

**Validation**:
- All quickstart Navigation rows ticked.

---

### [X] Task 11.6 — Status filter smoke (US-6)

**What to do**:
Walk the Status filter checklist: filter chip, dropdown, dimmed
cells, clear button, Action Panel unaffected, popovers unaffected.

**Validation**:
- All quickstart Status filter rows ticked.

---

### [X] Task 11.7 — Mark Ghosted smoke (US-8)

**What to do**:
Walk the Mark Ghosted checklist: trigger a ghost suggestion, click
Mark Ghosted, confirm toast + row exits, open the application in
Tracker and verify status + timeline entry + lastStatusUpdate.

**Validation**:
- All quickstart Mark Ghosted rows ticked.

---

### [X] Task 11.8 — Dismiss smoke (US-9)

**What to do**:
Walk the Dismiss checklist: dismiss row, no toast, reload preserves
dismissal, dismiss a different kind without affecting the first.

**Validation**:
- All quickstart Dismiss rows ticked.

---

### [X] Task 11.9 — Open Application Overlay smoke

**What to do**:
Walk the Open Overlay checklist: click `↗` on Today/Upcoming/Suggestion
rows and inside Day Popover rows; edit + save → Calendar reflects
the change.

**Validation**:
- All quickstart Open Overlay rows ticked.

---

### [X] Task 11.10 — Accessibility smoke

**What to do**:
Walk the Accessibility checklist: keyboard-only traversal, focus
rings, Escape closes popovers, CW gutter is aria-hidden, status
conveyed by label/count not color alone (verify with a colorblind
simulator).

**Validation**:
- All quickstart Accessibility rows ticked.

---

### [X] Task 11.11 — Mobile-specific smoke

**What to do**:
On a mobile viewport (DevTools device emulator or a real device <640px):
- Action Panel stacks above the Grid.
- Popovers / pickers become bottom sheets.
- Cells/chips compact.
- Tap targets reachable.
- Navigation still works.

**Validation**:
- Mobile rows in quickstart §6 ticked.

---

### [X] Task 11.12 — Cross-page regression

**What to do**:
Visit Tracker — cards, badges, modal unchanged.
Visit Profile — layout unchanged.
Trigger a Change-Status from the Tracker modal — feature 025's
auto-entry behavior still works.

**Validation**:
- Cross-page regression rows in quickstart §6 ticked.

---

### [ ] Task 11.13 — localStorage behavior smoke

**What to do**:
Inspect DevTools → Application → Local Storage:
- After dismissing a suggestion, the
  `alice:calendar:dismissals:{userIdentityToken}` key exists with
  the expected JSON.
- In hosted mode, sign out + sign in as a different user → that
  user has a separate dismissals key; no cross-user bleed.
- Manually clear the key → reload → dismissals are gone, suggestion
  reappears.

**Validation**:
- localStorage rows in quickstart §6 ticked.

---

### [ ] Task 11.14 — Hosted-mode smoke (operator dry-run)

**What to do**:
On a hosted environment (or a hosted-mode local test):
- Apply the `claim_and_seed_starter` RPC update from
  [docs/db/claim_and_seed_starter.md](../../docs/db/claim_and_seed_starter.md).
- Sign up as a new user.
- Confirm the two starter rows are present in Tracker.
- Confirm at least one suggestion fires on the Calendar.
- Confirm Mark Ghosted persists to Supabase (refresh the page;
  status remains ghosted).
- Confirm dismissals persist across reloads for that user; do NOT
  bleed when a different user signs in on the same browser.

**Validation**:
- All hosted smoke steps complete.

**Out of scope**:
- Load testing.
- Penetration testing.

---

## Phase 12 — Post-smoke Fixes + v2 Inline Panel

Phase 11 surfaced 22 browser observations. The user reviewed and
clustered them: (1) the day-popover anchoring + empty-cell-feedback
gap is structural and prompts the v2 design pivot in
[docs/design/calendar.md §17](../../docs/design/calendar.md); (2) the
remaining items are UX/CSS polish that can ship in the same patch.
Phase 12 is a single combined phase covering both.

The phase order is deliberate: design changes that drive new copy +
constants land first (12.1), then the v2 panel structural rewrite
(12.2–12.5), then polish (12.6–12.13), then tests (12.14). Phase 13
handles release prep + re-smoke.

### [X] Task 12.1 — Rename `Technical Assessment` → `Technical` (global)

**Target files**:
- [src/models/application.js](../../src/models/application.js) — `STATUS_CONFIG.assessment.label`
- Existing tests that snapshot the old label string

**What to do**:
Per [docs/design/calendar.md §5 "Status label"](../../docs/design/calendar.md):
update `STATUS_CONFIG.assessment.label` from `'Technical Assessment'`
to `'Technical'`. Update every test that snapshots the literal
"Technical Assessment" string (search the repo).

**Constraints**:
- The status **key** (`'assessment'`) does NOT change. Only the human
  label. No DB migration, no API change, no client/server contract
  change.
- The Tracker quick-filter row, Tracker badges, Calendar chips,
  Calendar filter dropdown, and the v2 inline-panel pills all inherit
  this label automatically because they read `STATUS_CONFIG[k].label`.

**Validation**:
- `npm run test:run` passes; any snapshot mismatch is updated to the
  new label.

---

### [X] Task 12.2 — Build v2 Inline Day Details Panel component

**Target file**: `src/components/calendar/DayPanel.js` (NEW)

**What to do**:
Implement the **Inline Day Details Panel** per [docs/design/calendar.md §17](../../docs/design/calendar.md).
The design doc's prototype uses bare class names like `.details-panel`
and `.dp-row`; for production we rename to the project's `cal-`
prefix convention. **Class contract** (single source of truth — both
the CSS in Task 12.13 and the tests below must use these exact names):

| Design §17 prototype | Production class | Purpose |
|---|---|---|
| `.details-panel` (root) | `.cal-day-panel` | Root wrapper, always present |
| `.details-panel--prompt` | `.cal-day-panel--prompt` | Modifier when `selectedDate === null` |
| (implicit empty state) | `.cal-day-panel--empty` | Modifier when date selected but no activities |
| (implicit populated)   | `.cal-day-panel--populated` | Modifier when activities present |
| `.dp-prompt`, `.dp-prompt-glyph`, `.dp-prompt-h`, `.dp-prompt-sub` | `.cal-dp-prompt`, `.cal-dp-prompt-glyph`, `.cal-dp-prompt-h`, `.cal-dp-prompt-sub` | Prompt-state body |
| `.dp-header`, `.dp-date`, `.dp-count`, `.is-today` | `.cal-dp-header`, `.cal-dp-date`, `.cal-dp-count`, `.cal-dp-today-pill` | Shared header |
| `.dp-body` | `.cal-dp-body` | Populated-state body container |
| `.dp-empty`, `.dp-empty-h` | `.cal-dp-empty`, `.cal-dp-empty-h` | Empty-day body |
| `.dp-group`, `.dp-group-h`, `.dp-group-count`, `.dp-group-dash` | `.cal-dp-group`, `.cal-dp-group-h`, `.cal-dp-group-count`, `.cal-dp-group-dash` | Variant-A subheaders |
| `.dp-row.dp-row--simple`, `.body`, `.job`, `.co`, `.arrow` | `.cal-dp-row.cal-dp-row--simple`, `.cal-dp-row__body`, `.cal-dp-row__job`, `.cal-dp-row__co`, `.cal-dp-row__arrow` | Variant-A rows |

Public API:
```js
export const DayPanel = {
  render(container, props) { /* builds & appends DOM */ },
  update(props) { /* re-renders body when selectedDate changes */ },
  destroy() { /* removes DOM and listeners */ },
};
```

Props: `{ selectedDate /* ISO|null */, activities /* DayActivity[]|undefined */, onOpenApp }`.

**Variant scope for v0.13.1:** Ship **Variant A (Grouped) only.**
Variants B (Flat) and C (Summary) from design §17.5 and the
`detailsVariant` tweak from §17.8 are explicitly deferred to a future
iteration. Do not add a `variant` prop and do not surface the tweak
control; if and when B/C are wanted, file a separate spec/task. This
keeps Phase 12 scoped and the production component lean.

Render three top-level states per §17.4 (root always gets the
matching modifier from the table above):
- **Prompt** (`selectedDate === null`): root gets
  `.cal-day-panel--prompt`; body is a centered `.cal-dp-prompt` block
  with glyph + headline + sub. No CTA.
- **Empty day** (`selectedDate` set, `activities` empty/undefined):
  root gets `.cal-day-panel--empty`; renders `.cal-dp-header` +
  `.cal-dp-empty` with the plain "No events" headline.
- **Populated** (`activities.length > 0`): root gets
  `.cal-day-panel--populated`; renders `.cal-dp-header` +
  `.cal-dp-body` with Variant-A grouping.

Header per §17.4:
- Left: `.cal-dp-date` — `{MMM} {D}` (no weekday prefix). Append the
  `.cal-dp-today-pill` ("Today") when `selectedDate === todayISO`.
- Right: `.cal-dp-count` — `{N} entr{y|ies}` for populated,
  `"No events"` for empty.

Variant A body (the only variant in v0.13.1; §17.5 Variant A):
- For each status in `STATUS_DISPLAY_PRIORITY` order that has
  activities for this date: render `.cal-dp-group` with subheader
  (`<StatusBadge>` + `.cal-dp-group-count` `(N)` + `.cal-dp-group-dash`
  rule) and one `.cal-dp-row.cal-dp-row--simple` per activity.
- Row grid `minmax(0, 1fr) auto` with `.cal-dp-row__job` (Sora 12.5/500)
  + `.cal-dp-row__co` (DM Mono 10.5, company only) + `.cal-dp-row__arrow`.
- Row activation:
  - Mouse: `click` on the row → `props.onOpenApp(activity.id)`.
  - Keyboard: row is `role="button" tabIndex="0"`; **both `Enter` and
    `Space`** activate the row (matches native button semantics — Space
    must `preventDefault` to suppress page scroll).
  - Hover/focus-visible bg `--indigo-soft`.

Root element gets `aria-live="polite"` per §17.9 so screen readers
announce selection changes.

The component lives **inside** the Month Grid card (it's appended to
the same panel slot as the grid), not as a sibling panel. See Task
12.4 for orchestration.

**Validation**:
- New test file `tests/components/calendar/DayPanel.test.js`:
  - Prompt state with `selectedDate: null` — root has
    `.cal-day-panel--prompt`; renders `.cal-dp-prompt`.
  - Empty-day state with `selectedDate: '2026-05-20', activities: []`
    — root has `.cal-day-panel--empty`; renders `.cal-dp-empty` and
    the date header "May 20".
  - Populated state — root has `.cal-day-panel--populated`; renders
    one `.cal-dp-group` per distinct status, in
    `STATUS_DISPLAY_PRIORITY` order.
  - Mouse click on a `.cal-dp-row` fires `onOpenApp(id)`.
  - **Keyboard activation**: dispatching `keydown` with `key: 'Enter'`
    on a focused row fires `onOpenApp(id)`; dispatching `key: ' '`
    (Space) likewise fires `onOpenApp(id)` and calls
    `event.preventDefault()`.
  - Today's date adds the `.cal-dp-today-pill`.
  - `aria-live="polite"` on the `.cal-day-panel` root.
  - `update({ selectedDate: <new> })` swaps the body and the root's
    state modifier class without recreating the root element.
  - No `variant`/`detailsVariant` prop is accepted (B/C deferred).

---

### [X] Task 12.3 — Make all in-month cells selectable; remove chip interactivity

**Target file**: [src/components/calendar/MonthGrid.js](../../src/components/calendar/MonthGrid.js)

**What to do**:
Per [docs/design/calendar.md §17.2](../../docs/design/calendar.md):

- Every in-month cell becomes selectable (with or without activities).
  `role="button" tabIndex="0"`; `aria-label` extends to
  `"{Pretty date}, no activity"` when activities are empty.
  `aria-pressed={isSelected || undefined}` reflects selection.
- Out-of-month cells remain non-selectable (cursor default, no click,
  no keydown handler).
- Numbered chips (`.num-chip`) become **non-interactive**: remove
  `role`, `tabIndex`, and `onClick`. Remove `stopPropagation`. Keep the
  `title` attribute for status-name discovery. Apply `cursor: default`
  in the Task 12.13 CSS pass.
- `+N` overflow chip (`.num-more`) same treatment — non-interactive,
  bubbles into cell selection.
- Add `.cal-cell--selected` class to the cell when its `iso` matches
  `props.selectedDate`. Style per §17.3 (navy ring; indigo ring if also
  today).
- Cell activation is now `props.onSelectDate(iso, cellEl)` (not the
  popover-opener). Empty cells fire too. Bind both:
  - `click` on the cell.
  - `keydown` on the cell, activating on **`Enter`** and **`Space`**
    (Space must `preventDefault` to suppress page scroll). Mirrors
    native button semantics; required because the cell is no longer a
    real `<button>` and we cannot inherit free keyboard behavior.

The v1 `onOpenDayPopover` prop is replaced by `onSelectDate`. Update
all MonthGrid call sites in Task 12.4.

**Validation**:
- Extend `tests/components/calendar/MonthGrid.test.js`:
  - Empty in-month cell has `role="button"`, `tabIndex="0"`,
    `aria-label` ending in `"no activity"`.
  - Chip click bubbles to cell — `onSelectDate` fires with the cell's
    ISO date.
  - **Keyboard activation**: dispatching `keydown` with `key: 'Enter'`
    on a focused in-month cell (with or without activities) fires
    `onSelectDate(iso, cellEl)`; same for `key: ' '` (Space), which
    also calls `event.preventDefault()`.
  - Out-of-month cell ignores both click and `Enter`/`Space` keydown.
  - Selected cell has `.cal-cell--selected`.
  - Today + selected stacks (both classes present).
  - Numbered chip has no `role` / `tabIndex` / `onClick` in v2.

---

### [X] Task 12.4 — Wire DayPanel into Calendar page orchestrator

**Target file**: [src/pages/Calendar.js](../../src/pages/Calendar.js)

**What to do**:
- Add module-level `_selectedDate = null` state.
- Import `DayPanel` from `src/components/calendar/DayPanel.js`.
- Remove all `DayPopover` **imports and call sites** from
  `src/pages/Calendar.js` only. The popover source file +
  test file are deleted in Task 12.5; this task only un-wires them
  from the orchestrator so 12.5 can verify zero remaining references.
- Restructure the grid slot to render: MonthGrid (existing) **above**
  DayPanel (new), inside the same `.cal-grid-panel` card. The two
  components share a card; the panel is separated from the grid by a
  1px solid `--border` per §17.4.
- Pass `onSelectDate: _onSelectDate` to MonthGrid; the handler updates
  `_selectedDate` and calls `DayPanel.update({ selectedDate,
  activities: _dayActivities[selectedDate] ?? [] })`. **Do not** trigger
  a full `_render()` — DayPanel.update is targeted.
- DayPanel's `onOpenApp` → existing `_onOpenApp` handler.

**Validation**:
- Extend `tests/pages/Calendar.test.js`:
  - Mount renders MonthGrid + DayPanel in the grid slot.
  - DayPanel starts in prompt state (`selectedDate === null`).
  - Clicking a cell with activities populates DayPanel.
  - Clicking an empty in-month cell shows the empty-day state.
  - Clicking a different cell replaces panel body.
  - `unmount()` destroys DayPanel.

---

### [X] Task 12.5 — Delete DayPopover files; finalize quickstart swap

**Target files** (this task owns all DayPopover file deletions):
- [src/components/calendar/DayPopover.js](../../src/components/calendar/DayPopover.js) — **delete**
- [tests/components/calendar/DayPopover.test.js](../../tests/components/calendar/DayPopover.test.js) — **delete**
- [specs/026-calendar/quickstart.md](quickstart.md) — already swapped to
  the "Inline Day Panel (v2)" block in the v0.13.1 doc pass; re-verify
  during this task that no "Day Popover" rows remain in §6.

**What to do**:
1. Confirm Task 12.4 has already un-wired DayPopover from
   `src/pages/Calendar.js`. If `rg DayPopover src` still returns hits
   inside `src/pages/`, finish 12.4 first.
2. Delete the two files above.
3. Re-read `quickstart.md §6` and confirm the "Inline Day Panel (v2)"
   block is the only day-detail smoke surface present.

**Validation**:
- `rg DayPopover src tests` returns no matches.
- `npm run test:run` passes.

---

### [X] Task 12.6 — Fix picker anchoring on desktop/tablet

**Target files**:
- [src/components/calendar/anchoredDropdown.js](../../src/components/calendar/anchoredDropdown.js)
- [src/components/calendar/MonthPicker.js](../../src/components/calendar/MonthPicker.js)
- [src/components/calendar/YearPicker.js](../../src/components/calendar/YearPicker.js)
- [src/components/calendar/StatusFilterDropdown.js](../../src/components/calendar/StatusFilterDropdown.js)

**What to do**:
Investigate obs #5 (desktop/tablet pickers do not appear under the
clicked trigger). Likely causes to check first:
- Wrong anchor element passed (the grid header container instead of
  the specific button).
- `anchorRect` captured before the dropdown content is measured — the
  positioning math then uses the wrong width, especially for
  `align: 'end'`.
- `transform`/`overflow` on a parent of the anchor breaking
  `getBoundingClientRect` coordinate basis.

Fix at the root cause; do not patch over with magic offsets.

Mobile bottom-sheet behavior is correct and must not regress.

**Validation**:
- Manually verified by ticking the relevant rows in
  `quickstart.md §6` during Phase 13 re-smoke.
- `tests/components/calendar/anchoredDropdown.test.js` — add a case
  asserting that when the anchor has a non-zero `getBoundingClientRect().left`,
  the dropdown's positioned `left` equals (or aligns to) that value.

---

### [X] Task 12.7 — Picker UI updates (remove header labels, unify range font)

**Target files**:
- [src/components/calendar/MonthPicker.js](../../src/components/calendar/MonthPicker.js)
- [src/components/calendar/YearPicker.js](../../src/components/calendar/YearPicker.js)
- [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Per [docs/design/calendar.md §6.10 + §6.11](../../docs/design/calendar.md):
- Remove the "Jump to month" / "Jump to year" left-side labels from
  both picker headers.
- Year picker: render the `{start} – {start+11}` range with the same
  Sora 11.5/500 / `--t2` styling as the 12 year buttons in the grid
  below. Remove any DM Mono on the range label.

**Validation**:
- Extend `tests/components/calendar/MonthPicker.test.js` +
  `tests/components/calendar/YearPicker.test.js`:
  - Header does NOT contain the literal "Jump to month" / "Jump to year"
    text.
  - Year range label is rendered (`{start} – {start+11}` format).

---

### [X] Task 12.8 — Month/Year buttons as text-style triggers

**Target files**:
- [src/components/calendar/MonthGrid.js](../../src/components/calendar/MonthGrid.js)
- [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Per [docs/design/calendar.md §6.6](../../docs/design/calendar.md):
- Remove the bordered button look from `.cal-month-btn` and
  `.cal-year-btn`. No border, transparent background, padding `4px 6px`.
- Both buttons use **Sora**; do not mix Sora + DM Mono in this pair.
- Remove the chevron-down caret after the year (the caret was added in
  error and made the year look like a `<select>`).
- Hover: text color → `--indigo`; `.cal-month-btn` adds a faint
  `--indigo-soft` background, `.cal-year-btn` color-only.

---

### [X] Task 12.9 — Status filter icon button (mirror Tracker quick-filter)

**Target files**:
- [src/components/calendar/MonthGrid.js](../../src/components/calendar/MonthGrid.js)
- [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Per [docs/design/calendar.md §6.6](../../docs/design/calendar.md):
Replace the `.filter-chip` ("Status: All" / "Interview" text chip) with
a 30×30 **icon button** (`.cal-status-filter-btn`) that mirrors the
Tracker `QuickFiltersToolbar` status control:
- Idle: neutral funnel/filter SVG glyph, `--t3` color, border
  `--border`.
- Active: glyph replaced by an 8×8 round swatch using
  `STATUS_CONFIG[status].borderAccent`; border + ring `--indigo`.
- Same control on desktop and mobile.
- Clear `×` button still appears adjacent when active.
- The `align: 'end'` anchoring (Task 12.6) targets this icon button.

**Class-family scope (do NOT rename the dropdown shell):**
This task only renames the **trigger** (chip → `.cal-status-filter-btn`)
and its **clear** companion (`.filter-clear` → `.cal-filter-clear` if
you want consistency, otherwise leave). The dropdown shell and rows
keep their existing `.filter-dd*` feature-prefix names
(`.filter-dd`, `.filter-dd-row`, `.filter-dd-check`,
`.filter-dd-swatch`, `.filter-dd-label`, `.none-glyph`) — see
[docs/design/calendar.md §6.12 class-naming note](../../docs/design/calendar.md).
The existing CSS, component, and test files already standardize on
`.filter-dd*`; do not rewrite them in this phase.

---

### [X] Task 12.10 — Single-row grid header layout

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Per [docs/design/calendar.md §6.6.1 + §11](../../docs/design/calendar.md):
The grid header must be a single flex row at every breakpoint. Retire
the previous 3-row mobile layout. Left cluster (`‹ Month Year ›`) tight
(2px gaps), `[Today*]` 12px to the right of the cluster,
`[Filter]` pushed to the far right via `margin-left: auto`. Font sizes
drop on mobile per §6.6 but the row does not wrap.

---

### [X] Task 12.11 — Greeting name injection + comma handling

**Target file**: [src/pages/Calendar.js](../../src/pages/Calendar.js) (or its `chooseGreeting` helper)

**What to do**:
Per [docs/design/calendar.md §6.1 "Name injection"](../../docs/design/calendar.md):
- Read the user's display name from the active profile (hosted: Supabase
  user metadata; local: profile store; demo: demo profile name if set).
- Move every greeting entry in the pool from "Good morning," (with
  comma) → "Good morning" (no comma). Comma is owned by the formatter.
- Formatter composes:
  - With name: `"{Greeting}, {Name}"`.
  - With name + question form ("Burning the midnight oil?"): insert
    the `, {Name}` **before** the punctuation → `"Burning the midnight
    oil, Alice?"`.
  - Without name: `"{Greeting}"` — no trailing comma.
- Demo mode follows the same rule (use the demo profile name if one
  is configured; otherwise no comma).

**Validation**:
- Extend `tests/pages/Calendar.test.js` (or a new helper test):
  - With a name in the profile, headline contains `, Alice`.
  - Without a name, headline does NOT contain a trailing comma.
  - Question-form greetings put `, Alice` before the `?`.

---

### [X] Task 12.12 — Dismiss toast + filter dims empty cells

**Target files**:
- [src/pages/Calendar.js](../../src/pages/Calendar.js) — `_onDismiss` handler
- [src/components/calendar/MonthGrid.js](../../src/components/calendar/MonthGrid.js) — cell rendering pass
- [tests/pages/Calendar.test.js](../../tests/pages/Calendar.test.js)
- [tests/components/calendar/MonthGrid.test.js](../../tests/components/calendar/MonthGrid.test.js)

**What to do**:
Per [docs/design/calendar.md §8](../../docs/design/calendar.md):
- `_onDismiss(applicationId, kind)` now calls `Toast.show('Suggestion
  dismissed', 'success')` after the row exits.
- MonthGrid cell pass: when `props.filter !== null`, add
  `.cal-cell--filter-hidden` to **every** non-matching cell — including
  cells with zero activities. Only cells with at least one activity
  matching `filter` remain at full opacity.

**Validation**:
- Dismiss handler test asserts Toast.show called with the new string.
- MonthGrid test: with `filter: 'interview'`, an empty in-month cell
  also has `.cal-cell--filter-hidden`.

---

### [X] Task 12.13 — CSS polish pass (typography, empty state, hues, ID pill)

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Fix the visual mismatches surfaced in Phase 11 where the design doc
already specifies the right value but the implementation diverged:

| Obs | Fix |
|-----|-----|
| #1  | Job ID pill in Calendar matches Tracker's ID treatment (no `#` prefix, same font weight). Single source of truth: define `.cal-id-pill` to inherit Tracker's ID styling. |
| #4  | Month / Year buttons both use Sora (already addressed in 12.8 — verify). |
| #11 | Section subheaders (`Today` / `Suggested Actions` / `Upcoming`) and their count pills sized up — `.cal-section__lbl` Sora 14/600 (was 13); `.cal-section__count` font 11 (was 10). |
| #12 | `.dow-cell` font-weight 500 (was 600/700); `.cal-cw` text-align center; vertically center the CW number to the day-cell row middle (`align-items: center`). |
| #13 | `.upc-group-h .cal-section__lbl` font-weight 500 (was 600). |
| #16 | `.cal-num` font-weight 500 (was 600). |
| #18 | Empty `.cal-empty` block: remove dashed border / brown-tinted background that crept in. Plain `transparent` bg, no border. |
| #19 | `.cal-cell--weekend` and `.cal-cell--out` background hues distinct enough to read at a glance — bump weekend in-month to `#FBF9F4`, out-of-month general to `#F4F0E6` so the contrast against `--surface` (`#FFFFFF`) is visible. |

Each line above is a small, scoped CSS change. Confirm against the
design tokens in §4 of the design doc.

**Validation**:
- Visual inspection in browser (Phase 13 re-smoke).
- No new tests required for pure CSS; existing snapshot tests should
  still pass.

---

### [X] Task 12.14 — Test sweep

**Target**: all `tests/` updates from Tasks 12.1–12.13.

**What to do**:
Run `npm run test:run` and `npm run lint`. Address any regressions
that surfaced from the rename, the popover deletion, the chip
non-interactivity change, the dismiss toast, and the v2 panel.

**Validation**:
- Both `npm run lint` and `npm run test:run` exit 0. The repo has no
  `format` script (see `package.json`); the format check called out in
  the Phase 10 Task 10.6 copy was inherited boilerplate and is dropped
  here.

---

## Phase 13 — Release Prep v2 + Re-smoke (REQUIRED)

The Phase 12 changes constitute a patch release on top of v0.13.0.
Re-apply Phase 10's release-prep workflow at the patch level, then
re-walk Phase 11's smoke checklist against the v2 merge state.

### [X] Task 13.1 — Version bump to 0.13.1

**Target files**: [package.json](../../package.json),
[src/pages/welcome/shared/appMeta.js](../../src/pages/welcome/shared/appMeta.js).

**What to do**:
Bump `version` and `APP_VERSION` to `0.13.1` / `v0.13.1`. Patch — no
new feature surfaces, only design + bug-fix changes on the same v0.13
feature.

**Validation**:
- `tests/release-metadata.test.js` updated to assert `0.13.1`; passes.

---

### [X] Task 13.2 — CHANGELOG entry

**Target file**: [CHANGELOG.md](../../CHANGELOG.md).

**What to do**:
Add `## [0.13.1] — <date>` under Unreleased, summarizing:
- v2 Inline Day Details Panel replaces the popover.
- "Technical Assessment" globally renamed to "Technical".
- Greeting includes profile name; trailing comma removed when no name.
- Picker headers cleaned; month/year as text-style triggers.
- Status filter is now an icon button mirroring Tracker quick-filter.
- Single-row grid header on all breakpoints.
- Dismiss feedback toast; filter dims empty cells.
- CSS polish (typography, empty state, weekend hues, ID pill).

Update the link-definition block at the bottom of CHANGELOG.md
(`[Unreleased]` pointer + new `[0.13.1]` link).

---

### [X] Task 13.3 — REPO_MAP entry for DayPanel; remove DayPopover row

**Target file**: [docs/REPO_MAP.md](../../docs/REPO_MAP.md).

**What to do**:
- Add a row for `src/components/calendar/DayPanel.js` (replaces the
  DayPopover row).
- Add a row for `tests/components/calendar/DayPanel.test.js`.
- Remove the rows for `DayPopover.js` + `DayPopover.test.js`.

---

### [X] Task 13.4 — Docs sanity check

**What to do**: `npm run lint` and `npm run test:run` both exit 0.
(There is no `format` script — the Phase 10 Task 10.6 copy was wrong
on that line; do not re-introduce it here.)

**Resolution**: Both commands ran clean during the Phase 12 review
(88 files / 1054 tests, lint with zero output). Phase 13's doc-only
edits (CHANGELOG, README, REPO_MAP, version bumps, release-metadata
test bump) do not touch source code; `tests/release-metadata.test.js`
was updated in lockstep with the version bump so its assertions
match the new `0.13.1` strings in `package.json`, `appMeta.js`,
`README.md`, and `CHANGELOG.md`. Per user direction, the post-edit
re-run was skipped — trust the prior green run + lockstep test edit.

---

### [X] Task 13.5 — Browser re-smoke

**What to do**:
Re-walk the **full** smoke checklist in [quickstart.md §6](quickstart.md)
against the v0.13.1 merge state. Tick every row. The Day Popover block
has been replaced by an Inline Day Panel block during Task 12.5.

Pay special attention to the items that failed or were untestable on
v0.13.0:
- Numbered chips — verify priority order and `+N` overflow (was
  unticked).
- Inline Day Panel — selection updates the panel in place; empty days
  show "No events"; today gets the "Today" pill.
- Mobile single-row header — no wrap; filter is the icon button.
- Picker anchoring — month/year/filter dropdowns sit under their
  trigger button on desktop and tablet.
- Dismiss toast — "Suggestion dismissed" appears.
- Filter dims empty cells — full opacity only on matching days.
- Greeting — your profile name appears (or no trailing comma without
  one).

**Validation**:
- All quickstart §6 rows ticked **except** three picker-anchoring rows
  (Month Picker, Year Picker, Status filter dropdown). Those drift
  off their triggers in the live browser on some viewports despite
  the JSDOM positioning math being correct (regression test passes
  in `tests/components/calendar/anchoredDropdown.test.js`). Root
  cause is browser-only — likely an ancestor `transform` or
  `overflow` breaking `getBoundingClientRect` basis. Documented as a
  known limitation in `CHANGELOG.md §[0.13.1]` and deferred to a
  future patch. Mobile bottom-sheet behavior is unaffected.

---

### [X] Task 13.6 — Hosted-mode + localStorage smoke (carryover)

**What to do**:
Complete the two Phase 11 tasks that were not exercisable on v0.13.0
(11.13 hosted-mode user-switch and 11.14 hosted starter RPC dry-run).
The v3 RPC body still lives in
[docs/db/claim_and_seed_starter.md](../../docs/db/claim_and_seed_starter.md);
no SQL changes were required for v0.13.1.

**Validation**:
- The hosted smoke steps in [quickstart.md §4 + §6 localStorage](quickstart.md)
  complete; cross-user bleed test passes. All three localStorage rows
  in §6 are ticked, including the hosted user-switch row that was
  unchecked in the v0.13.0 smoke.

---

## Phase 14 — Post-re-smoke Fixes

The Phase 13 browser re-smoke surfaced 11 observations against the
v0.13.1 build. Three drove spec changes that are now live in
`docs/design/calendar.md` (§6.12 filter popup, §6.6.1+§11 narrow-viewport
wrap, §17.5 DayPanel row meta). Eight are CSS / implementation fixes
where the spec was already correct.

Task order: spec-driven structural work first (14.1–14.3), then the
deferred picker-anchoring root-cause fix (14.4–14.5), then CSS polish
(14.6–14.10), then the seed enhancement and test sweep (14.11–14.12).

### [X] Task 14.1 — Filter popup unified with Tracker `QuickFiltersToolbar`

**Target files**:
- [src/components/calendar/StatusFilterDropdown.js](../../src/components/calendar/StatusFilterDropdown.js) — gut + rewrite as a thin wrapper, or delete entirely if the Tracker popup can be opened directly
- [src/components/QuickFiltersToolbar.js](../../src/components/QuickFiltersToolbar.js) — extract the status popup if it is still embedded; expose a `mountStatusFilterPopup({ anchor, value, onSelect, onClose })` or equivalent
- [src/pages/Calendar.js](../../src/pages/Calendar.js) — `_onOpenFilter` opens the shared popup, not the legacy dropdown
- [src/styles/main.css](../../src/styles/main.css) — retire `.filter-dd*` selectors from the Calendar context (keep them if still used by the Tracker; otherwise delete)
- [tests/pages/Calendar.test.js](../../tests/pages/Calendar.test.js) — update the filter-interaction test path

**What to do**:
Per [docs/design/calendar.md §6.12](../../docs/design/calendar.md):
the Calendar's filter trigger opens the **same** status-filter popup
that the Tracker exposes via `QuickFiltersToolbar`. Same chrome, same
control across desktop, tablet, and mobile.

- Inspect `QuickFiltersToolbar` to determine whether the status popup
  is already a standalone surface that can be mounted from elsewhere,
  or whether it is currently entangled with toolbar state. If the
  latter, extract it to a shared component (suggested location:
  `src/components/QuickFiltersStatusPopup.js`); keep the Tracker side
  using the extracted component too — no parallel implementations.
- The Calendar's `_onOpenFilter(anchor)` handler in `Calendar.js`
  mounts the shared popup with single-select semantics: `onSelect`
  receives the next status (or `null` for "All statuses") and the
  Calendar updates `_filter` and re-renders. "All statuses" maps to
  `filter: null`.
- Status options render in `STATUS_DISPLAY_PRIORITY` order. The
  assessment label is "Technical" per §5; that is owned by
  `STATUS_CONFIG`, so no per-page override.
- Retire the `asBottomSheet: true` configuration on the Calendar
  side. The Tracker popup's responsive form is canonical.
- Remove `StatusFilterDropdown` references from the rest of the
  Calendar codebase (orchestrator + tests). Delete the file once
  zero references remain.

**Constraints**:
- Do NOT branch the Tracker filter popup with Calendar-specific
  styling, class names, or behavior. New variants are forbidden by
  spec — both pages must share the surface.
- The trigger element (`.cal-status-filter-btn` icon button)
  unchanged from Phase 12.
- Class-prefix scoping: extracted popup uses the Tracker's existing
  class family. Do not introduce `cal-` prefixes on inherited
  surfaces.

**Validation**:
- `tests/pages/Calendar.test.js` — the existing "filters the grid
  without changing the Action Panel" case still passes against the
  new popup chrome (update the selector from `.filter-dd-row` to
  whatever the shared popup uses; assert the same filter outcome).
- Extend the test to confirm the Calendar popup is the **same**
  DOM surface the Tracker mounts (snapshot a distinctive class or
  data attribute that the Tracker popup carries).
- `npm run lint` + `npm run test:run` exit 0.

**Out of scope**:
- Multi-select on the Calendar. Single-select stays the
  contract per [spec.md §Clarifications](../../specs/026-calendar/spec.md).

---

### [X] Task 14.2 — Controlled wrap at <375px (grid header)

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Per [docs/design/calendar.md §6.6.1 sub-breakpoint exception + §11](../../docs/design/calendar.md):
add an `@media (max-width: 374px)` block that allows the
`.cal-grid-header` to wrap into a controlled two-row layout:

- Row 1 — nav cluster (`‹ Month Year ›`). Pin with `flex: 1 1 100%`
  on the cluster so it consumes the entire first row.
- Row 2 — `[Today*]` (left) and `[Filter*]` (right via
  `margin-left: auto` on the filter area). Both, one, or neither —
  Row 2 collapses to zero height when both are absent.
- Above 375px, the existing single-row layout still applies. Do
  NOT generalize the wrap upward.

**Constraints**:
- `flex-wrap: wrap` activates **only** in the `<375px` media query.
  Above that, the header is `flex-wrap: nowrap` (or implicit).
- No additional JS. This is a pure CSS change.
- The 3-row mobile layout (nav · today · filter on separate lines)
  remains retired. The new two-row layout groups elements differently
  (nav alone vs. today+filter together).

**Validation**:
- Manual: emulate iPhone SE (320×568) and Galaxy Z Fold 5 cover
  (344×882) in DevTools; confirm Row 1 = nav, Row 2 = Today+Filter
  share a row.
- Manual: emulate 376×600; confirm header is single row (regression
  guard for the breakpoint boundary).
- No unit test required for pure CSS; the existing MonthGrid layout
  tests must still pass.

---

### [X] Task 14.3 — DayPanel row meta `{Company} · {Job title}`

**Target files**:
- [src/components/calendar/DayPanel.js](../../src/components/calendar/DayPanel.js) — rename `.cal-dp-row__co` → `.cal-dp-row__meta`; emit `{Company} · {Job title}` with a `.cal-dp-row__sep` separator
- [src/styles/main.css](../../src/styles/main.css) — restyle the renamed class; add separator color treatment
- [tests/components/calendar/DayPanel.test.js](../../tests/components/calendar/DayPanel.test.js) — assert new content and class names

**What to do**:
Per [docs/design/calendar.md §17.5 Variant A](../../docs/design/calendar.md):
- `createRow` now appends `.cal-dp-row__meta` (replacing
  `.cal-dp-row__co`) containing `{Company}` + `.cal-dp-row__sep`
  with `·` + `{Job title}`.
- The activity object received from the projection layer already
  exposes `company`; `jobTitle` may need to be added — confirm the
  current `DayActivity` projection in
  `src/utils/calendarProjection.js` carries the role; if not, add it
  (it is already present on the parent application object, so the
  projection just needs to copy it through).
- Use ellipsis truncation via CSS (`overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap`) on
  `.cal-dp-row__meta`. The job title text in `.cal-dp-row__job`
  keeps its existing ellipsis treatment.
- Use the same `.cal-row__sep` color and spacing pattern from the
  Action Panel for visual consistency.

**Constraints**:
- Do NOT add the ID pill back into Variant A rows. Status is still
  implied by the group; the ID stays suppressed for visual rest.
- Do NOT mutate the company name to include the role inline (no
  `"Company - Role"` concat) — the separator element carries the
  styling.

**Validation**:
- Update `tests/components/calendar/DayPanel.test.js`:
  - `cal-dp-row__co` is no longer in the DOM.
  - `cal-dp-row__meta` is present and contains the company name
    followed by `·` followed by the job title.
  - `cal-dp-row__sep` is a child of `cal-dp-row__meta`.

---

### [X] Task 14.4 — Investigate the picker-anchoring root cause in the browser

**Target file**: TBD — investigation first, source change second.

**What to do**:
The deferred obs #5 from v0.13.1 needs a real fix. Phase 12 Task
12.6 only added a JSDOM regression test; the live browser still
drifts the Month, Year, and Status filter popups off their triggers
on desktop/tablet.

Investigate in a real browser (DevTools "Inspect element" on a
mid-flight dropdown):
1. Capture the trigger button's `getBoundingClientRect()` and the
   dropdown's computed `left` / `top`.
2. Walk up the trigger's ancestor chain. Identify any element with
   `transform`, `filter`, `perspective`, `contain: layout`, or
   `position: fixed` — any of these creates a new containing block
   for fixed/absolute descendants and breaks the viewport-relative
   coordinate basis the dropdown's positioner uses.
3. Check whether the dropdown is mounted on `document.body` (as the
   primitive should) or has been inadvertently attached to a styled
   ancestor.
4. Inspect `window.scrollX` / `window.scrollY` handling — if the
   primitive uses page coordinates but the trigger rect is
   viewport-relative, they will diverge as the page scrolls.

Report findings; the fix lands in Task 14.5. Do not change
production code in 14.4 — this is the diagnosis step.

**Validation**:
- A short write-up (inline comment in `anchoredDropdown.js` or a
  paragraph in the Task 14.5 PR description) naming the offending
  ancestor / coordinate-basis bug, with the DevTools evidence.

---

### [X] Task 14.5 — Fix picker anchoring

**Target file**: [src/components/calendar/anchoredDropdown.js](../../src/components/calendar/anchoredDropdown.js)

**What to do**:
Apply the fix the Task 14.4 investigation prescribes. Likely
candidates:

- If the issue is an ancestor `transform`: switch the dropdown to
  `position: fixed` with viewport-relative `top` / `left` (the
  primitive already uses `position: fixed` per design §6.13; verify
  that's still true in implementation and that the ancestor's
  containing-block influence is genuinely bypassed).
- If the issue is a coordinate basis mismatch: ensure
  `getBoundingClientRect()` is used consistently (which is
  viewport-relative) and that scroll offsets are not double-added.
- If the issue is a stale rect captured before content measurement:
  re-measure the trigger after content mount and reposition once
  on first render.

**Constraints**:
- The mobile bottom-sheet variant is unaffected and must NOT
  regress. The fix scopes to the desktop/tablet positioning path.
- Do NOT add per-popup positioning offsets ("magic numbers"); fix
  the root cause. If you find yourself adding `top + 12`, you have
  not understood the bug.
- The existing JSDOM regression test in
  `tests/components/calendar/anchoredDropdown.test.js` must still
  pass.

**Validation**:
- Manual browser smoke at desktop (≥1200px), tablet portrait
  (~768px), and tablet landscape (~1024px): open Month picker,
  Year picker, Status filter popup. Each appears under its trigger
  with no horizontal or vertical drift.
- Update the three deferred quickstart §6 rows from `[ ]` to
  `[X]` (Month Picker anchor, Year Picker anchor, Filter dropdown
  anchor) once the manual smoke confirms the fix.
- The v0.13.1 CHANGELOG "Known limitations" entry is removed in
  the Phase 15 release-prep CHANGELOG note (not in this phase).

---

### [X] Task 14.6 — DayPanel status badge font fix

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Per [docs/design/calendar.md §4 Typography + §17.5](../../docs/design/calendar.md):
the `.cal-status-badge` inside the DayPanel (and the
`<StatusBadge>` shared from Tracker) must use **Sora**, not DM Mono.
Locate the CSS rule that is forcing mono on `.cal-status-badge`
(likely a stale rule from the v1 popover, or a too-broad selector
in the Calendar block) and remove it. The badge should inherit
Sora from the page typography.

**Validation**:
- Visual: status badges in the DayPanel group headers render in
  Sora.
- No new unit test required; existing DayPanel test continues to
  pass (it asserts text content, not font).

---

### [X] Task 14.7 — DayPanel group header — remove extra line

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:
The `.cal-dp-group-h` subheader is rendering an extra full-width
line under itself. Likely cause: `.cal-dp-group-dash` is laying out
as a block element instead of a `flex: 1` flex item, so the dashed
border appears as its own row rather than a hairline that extends
from the badge to the row's right edge.

Fix the CSS:
- `.cal-dp-group-h` is `display: flex; align-items: center; gap: 10px;`.
- `.cal-dp-group-dash` is `flex: 1; height: 0; border-top: 1px
  dashed var(--border);`.
- No other children of `.cal-dp-group-h` should default to
  `display: block` and stretch to 100% width.

**Validation**:
- Visual: the subheader is one line, with the dashed rule extending
  to the right edge.

---

### [X] Task 14.8 — Action Panel ID pill alignment with Tracker

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Per obs #7 (re-smoke). Phase 12 Task 12.13 removed the `#` prefix
from the Action Panel ID pill string (`.cal-id-pill` content is now
`024`, not `#024`). However, the pill's **styling** (background,
font, padding, border-radius) still does not match the Tracker's
application ID pill.

- Audit Tracker's ID pill class (likely `.app-id-pill` or similar in
  Tracker components) and unify visual treatment.
- Either inherit from the Tracker pill class directly (preferred) or
  duplicate the design tokens in `.cal-id-pill` so the two surfaces
  read as the same component.
- Do not re-introduce the `#` prefix.

**Validation**:
- Visual: a `.cal-id-pill` in the Action Panel and the Tracker's ID
  pill on the same card are visually indistinguishable side-by-side.

---

### [X] Task 14.9 — Weekend tint should not override out-of-month tint

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Per [docs/design/calendar.md §6.8](../../docs/design/calendar.md):
out-of-month weekend cells should render with the **out-of-month
weekend** tint (`#F7F3EC`), not the in-month weekend tint
(`#FBF9F4`). The spec is already correct; the cascade is wrong.

- The current CSS likely has `.cal-cell--weekend` after
  `.cal-cell--out`, so weekend wins.
- Fix by either (a) re-ordering the rules so `.cal-cell--out` wins
  the unmodified base case AND
  `.cal-cell--out.cal-cell--weekend` exists as a combined selector
  with the out-of-month-weekend tint, or (b) using a specificity
  bump on the combined selector.

**Validation**:
- Visual: out-of-month weekend cells (e.g. the trailing days of
  the previous month that fall on Sat/Sun) render in `#F7F3EC`, not
  `#FBF9F4`.

---

### [X] Task 14.10 — Restore cell selection ring

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Per [docs/design/calendar.md §17.3](../../docs/design/calendar.md):
the selected cell must show a **navy** border ring + drop shadow,
or an **indigo** ring when also today. Currently only the drop
shadow renders; the border-color is being lost.

- Verify `.cal-cell--selected { border-color: var(--navy);
  box-shadow: 0 0 0 2px rgba(26,26,46,.08); }` is present in
  `main.css`.
- Verify the combined selector `.cal-cell--selected.cal-cell--today
  { border-color: var(--indigo); box-shadow: 0 0 0 2px
  rgba(79,70,229,.18); }` exists.
- Check that `.cal-cell--today` (alone) or `.cal-cell--weekend`
  isn't overriding the border-color via a later rule with higher
  specificity. If they are, raise the `.cal-cell--selected` rule's
  specificity OR re-order rules.

**Validation**:
- Visual: clicking a non-today cell shows a clear navy ring.
- Clicking today's cell shows an indigo ring (not navy).
- The quickstart §6 Inline Day Panel row "Selecting a different
  date replaces the panel body in place. The cell selection ring
  (navy) moves with you." passes browser inspection.

---

### [X] Task 14.11 — Seed fixture with 4+ statuses on a single day

**Target files**:
- [server/seeds/applicationsData.js](../../server/seeds/applicationsData.js)
- [src/data/demoSeed.js](../../src/data/demoSeed.js)
- (optional) [tests/seed-data.test.js](../../tests/seed-data.test.js) — add an assertion that some day has ≥4 distinct statuses

**What to do**:
Per obs #6 (re-smoke). There is no seeded date with more than 3
distinct statuses, so the `+N` overflow chip is unverifiable in
default seeded data. Add a fixture:

- Pick a day (e.g. today minus 2) in the seed data; ensure 4+
  different statuses fire on that day across the seeded
  applications.
- Mirror the same fixture in `demoSeed.js` so demo mode covers it
  too.
- Optionally extend `tests/seed-data.test.js` with a Calendar
  coverage assertion: `expect(maxDistinctStatusesPerDay(seedApps))
  .toBeGreaterThanOrEqual(4);` (the helper can be a 5-line
  reduce over `applicationsData`).

**Constraints**:
- Do NOT inflate the seed count just to hit 4 — re-distribute
  existing seeded timeline entries onto the same date when
  possible.
- The fixture should still pass all existing seed-coverage tests
  (suggestion-coverage etc.).

**Validation**:
- Reload Calendar after `npm run db:clear && npm run db:seed` and
  confirm at least one cell shows a `+N` overflow chip.

---

### [X] Task 14.12 — Test sweep

**Target**: all `tests/` updates from Tasks 14.1–14.11.

**What to do**:
Run `npm run lint` and `npm run test:run`. Address any regressions
from the StatusFilterDropdown removal, the DayPanel row meta
rename, the seed fixture change, the picker-anchoring fix, and any
CSS-only changes that cascaded into JS test expectations.

**Validation**:
- Both `npm run lint` and `npm run test:run` exit 0.

---

## Phase 15 — Action Panel Collapse (`<1200px`)

Phase 14 closed before Task 14.13 was scoped. The collapsible
Action Panel summary bar (a long-deferred design provision from
the v1 `§11` Open question + `§15` Out of Scope row, now promoted
to a real spec in `docs/design/calendar.md §11.1`) lives in this
phase instead. Single feature, three small tasks: component, CSS,
test sweep.

### [X] Task 15.1 — Render summary bar + toggle behavior in ActionPanel.js

**Target files**:
- [src/components/calendar/ActionPanel.js](../../src/components/calendar/ActionPanel.js) — emit `.cal-action-summary` + wrap the existing greeting and sections in `.cal-action-panel__body`; add the `.cal-action-panel--expanded` modifier toggle
- [tests/components/calendar/ActionPanel.test.js](../../tests/components/calendar/ActionPanel.test.js) — assertions for summary copy, singular/plural counts, default-collapsed render, click/keyboard toggle, `aria-expanded` + `aria-controls`, Esc collapse

**What to do**:
Per [docs/design/calendar.md §11.1 Action Panel collapse](../../docs/design/calendar.md):

1. **DOM structure** — `ActionPanel.render` now always emits both the
   summary bar **and** the full panel content into the DOM:
   ```
   .cal-action-panel
   ├── .cal-action-summary       ← always emitted; CSS controls visibility
   │   ├── .cal-action-summary__counts   (DM Mono 11/500, --t2)
   │   └── .cal-action-summary__toggle   (chevron glyph, aria-hidden)
   └── .cal-action-panel__body
       ├── .cal-greeting-h       (existing)
       ├── .cal-greeting-sub
       ├── .cal-section[data-section="today"]
       ├── .cal-section[data-section="suggestions"]
       └── .cal-section[data-section="upcoming"]
   ```
   Wrap the three sections (and the greeting block) in a new
   `.cal-action-panel__body` container so CSS can hide/show the
   expandable region with one selector.

2. **Summary copy** —
   - Default: `"Today · {Nt} events · {Ns} suggestions · {Nu} upcoming"`.
   - Singular/plural: drop the trailing `s` when a count is exactly 1
     (`1 event`, `1 suggestion`, `1 upcoming`).
   - All-zero state: `"Quiet day — nothing on your plate"`.
   - `Nu = tomorrow.length + restOfWeek.length` (same total the
     existing Upcoming count pill uses).

3. **Toggle behavior** — the summary bar is a
   `<button type="button" class="cal-action-summary">`. Click /
   Enter / Space toggles `.cal-action-panel--expanded` on the panel
   root. `aria-expanded` reflects the state; `aria-controls` points
   at the `.cal-action-panel__body` element's `id` (assign a stable
   `id` on render). Esc, while focus is anywhere inside the
   expanded body, collapses and returns focus to the summary bar.

4. **Default state on render** — `_collapsed = true` every time
   `ActionPanel.render` is called. Do NOT persist toggle state
   across re-renders, across `Calendar` page remounts, or to
   localStorage.

5. **No viewport resize listener.** Task 15.2 handles the breakpoint
   crossover via CSS alone. The component does not measure
   `window.innerWidth`; `_collapsed` is the only JS-owned state.

**Constraints**:
- Render order: summary bar **above** the greeting + sections so
  it stays at the top of the panel when expanded.
- Do not duplicate the count derivation logic — read counts from
  the same `today`, `suggestions`, `tomorrow`, `restOfWeek` arrays
  the existing sections consume.
- Do not introduce a `localStorage` key for the toggle state.

**Validation**:
- Extend `tests/components/calendar/ActionPanel.test.js`:
  - With non-zero counts, `.cal-action-summary__counts` reads
    `"Today · 2 events · 3 suggestions · 1 upcoming"` (use a 2/3/1
    fixture). Singular form: render with 1/1/1 and assert
    `"1 event · 1 suggestion · 1 upcoming"`.
  - With zero counts everywhere, summary reads `"Quiet day —
    nothing on your plate"`.
  - On render, `.cal-action-panel` does NOT have
    `cal-action-panel--expanded` (collapsed default).
  - `.cal-action-summary` has `aria-expanded="false"` initially.
  - Clicking `.cal-action-summary` adds the modifier class and
    flips `aria-expanded` to `"true"`. A second click removes it
    and flips back.
  - Keyboard: dispatching `keydown` with `key: 'Enter'` activates
    the toggle; same for `key: ' '` (Space, with
    `event.preventDefault()`).
  - With the panel expanded, dispatching `keydown` with
    `key: 'Escape'` on a child element collapses the panel and
    refocuses the summary bar.
  - `aria-controls` matches the `.cal-action-panel__body`
    element's `id`.

**Out of scope**:
- Persisting the toggle state across page loads.
- A `?expanded=1` URL parameter or any deep-link behavior.
- Sticky-positioning the summary bar over the grid while scrolled
  (the bar lives inside the panel container; the page scrolls
  underneath).

---

### [X] Task 15.2 — Collapse CSS rules (`@media (max-width: 1199px)`)

**Target file**: [src/styles/main.css](../../src/styles/main.css)

**What to do**:
Add the CSS that drives the collapse behavior. Defaults at all
breakpoints hide the summary bar and show the body; the media query
inverts both at `<1200px`.

```css
.cal-action-summary { display: none; }
.cal-action-panel__body { display: block; }

@media (max-width: 1199px) {
  .cal-action-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    /* + typography, padding, border per design §11.1 */
  }

  .cal-action-panel:not(.cal-action-panel--expanded)
    .cal-action-panel__body { display: none; }

  .cal-action-panel.cal-action-panel--expanded
    .cal-action-panel__body { display: block; }

  .cal-action-summary__toggle {
    /* chevron */
    transition: transform .14s ease;
  }

  .cal-action-panel.cal-action-panel--expanded
    .cal-action-summary__toggle { transform: rotate(180deg); }
}

@media (prefers-reduced-motion: reduce) {
  .cal-action-summary__toggle { transition: none; }
}
```

The exact typography / padding / border tokens come from
`docs/design/calendar.md §4` (DM Mono 11/500 for the count text,
`--t2` color, surface bg, etc.). Do not invent new tokens.

**Constraints**:
- The summary bar must NOT render at `≥1200px`. Its `display: none`
  default is the cleanest way to enforce this; do not gate it on a
  JS class.
- Do not animate the chevron rotation when
  `prefers-reduced-motion: reduce` is active.
- The body-show/hide transition does not need to be animated in
  v0.13.2 — instant toggle is acceptable. If a height animation is
  added later, it must also be gated by the reduced-motion query.

**Validation**:
- Manual: at desktop ≥1200px, confirm `.cal-action-summary` is not
  rendered (or has `display: none`); the panel always shows the
  greeting + sections.
- Manual: at narrow desktop (1024px), tablet portrait (768px), and
  mobile (375px), confirm the summary bar appears and the body is
  hidden until clicked.
- Pure CSS — no new unit tests required.

---

### [X] Task 15.3 — Test sweep

**Target**: all `tests/` updates from Tasks 15.1–15.2.

**What to do**:
Run `npm run lint` and `npm run test:run`. Address any regressions
the collapse work introduced — likely candidates: existing
`ActionPanel.test.js` cases that assume the greeting / sections sit
directly under `.cal-action-panel` may need a one-line selector
update for the new `.cal-action-panel__body` wrapper.

**Validation**:
- Both `npm run lint` and `npm run test:run` exit 0.

---

## Phase 16 — Release Prep v3 + Re-smoke (REQUIRED)

The Phase 14 + Phase 15 changes constitute a second patch release
on top of `v0.13.0`. Re-apply the Phase 10 / Phase 13 release-prep
workflow at the patch level. The browser re-smoke walks the same
`quickstart.md §6` checklist; the v0.13.1 deferred picker-anchoring
rows are now in scope and must close in this pass (Task 14.5
addressed the production code; the smoke verifies the user-visible
behavior).

### [X] Task 16.1 — Version bump to 0.13.2

**Target files**: [package.json](../../package.json),
[src/pages/welcome/shared/appMeta.js](../../src/pages/welcome/shared/appMeta.js),
[tests/release-metadata.test.js](../../tests/release-metadata.test.js).

**What to do**:
Bump `version` and `APP_VERSION` to `0.13.2` / `v0.13.2`. Patch —
no new feature surfaces, only design + bug-fix changes built on the
same v0.13 feature.

Update `tests/release-metadata.test.js` in lockstep: bump every
literal `0.13.1` → `0.13.2`; add a new assertion for the
`[0.13.2]: …/compare/v0.13.1...v0.13.2` link line; keep the prior
`[0.13.1]` and `[0.13.0]` link assertions.

**Validation**:
- `tests/release-metadata.test.js` passes after the bump.

---

### [X] Task 16.2 — CHANGELOG entry + README version bump

**Target files**: [CHANGELOG.md](../../CHANGELOG.md),
[README.md](../../README.md).

**What to do**:
Add `## [0.13.2] — <date>` under Unreleased, covering both Phase 14
and Phase 15 changes in one appendix. Suggested section split
(Keep a Changelog format):

- **Added** — Collapsible Action Panel summary bar at every stacked
  layout (`<1200px`); shared `QuickFiltersStatusPopup` component;
  seed fixture with 4+ statuses on a single day.
- **Changed** — Calendar status filter uses the shared Tracker
  popup (retires `.filter-dd` chrome); DayPanel row meta is now
  `{Company} · {Job title}`; controlled two-row header wrap below
  375px; status badge font corrected to Sora; DayPanel group-header
  dashed rule renders inline; Action Panel ID pill matches Tracker;
  out-of-month weekend cells render with the correct tint; selected
  cell border ring restored.
- **Fixed** — Picker anchoring on desktop/tablet (resolves the
  v0.13.1 `Known limitations` entry). Month, Year, and Status
  filter popups now sit directly under their triggers.
- **Removed** — `src/components/calendar/StatusFilterDropdown.js`
  and its tests — superseded by the shared `QuickFiltersStatusPopup`.

Update the link-definition block at the bottom of CHANGELOG.md
(`[Unreleased]` pointer + new `[0.13.2]` link).

Update [README.md](../../README.md) `Current version: **0.13.1**`
→ `**0.13.2**` line.

**Validation**:
- `tests/release-metadata.test.js` passes (covers CHANGELOG link
  block + README version line in lockstep with Task 16.1).

---

### [X] Task 16.3 — REPO_MAP audit

**Target file**: [docs/REPO_MAP.md](../../docs/REPO_MAP.md).

**What to do**:
The Phase 14 REPO_MAP edits already added the `QuickFiltersStatusPopup`
row, the `DayPanel` row, removed the `StatusFilterDropdown` +
`DayPopover` rows, and refreshed the MonthGrid description. This task
is a smaller audit — confirm:

- `src/components/calendar/ActionPanel.js` row mentions the
  collapsible summary bar (Phase 15 addition). If not, append
  `· collapsible summary bar at <1200px stacked layouts`.
- No stale `StatusFilterDropdown` / `DayPopover` references remain
  anywhere in the file.

No other rows should need to change for v0.13.2.

**Validation**:
- `rg StatusFilterDropdown docs/REPO_MAP.md` and
  `rg DayPopover docs/REPO_MAP.md` both return no matches.
- `ActionPanel.js` row mentions the collapse.

---

### [X] Task 16.4 — Docs sanity check

**What to do**: `npm run lint` and `npm run test:run` both exit 0.
(No `format` script — see Phase 13 Task 13.4 note.)

**Validation**:
- Both commands exit 0.

**Resolution**: Phase 15 Task 15.3 already ran the full lint + test
sweep clean. Phase 16's doc-only edits (CHANGELOG, README, REPO_MAP,
version bump) do not touch source; `tests/release-metadata.test.js`
was updated in lockstep with the Task 16.1 bump so its assertions
match the new `0.13.2` strings in `package.json`, `appMeta.js`,
`README.md`, and `CHANGELOG.md`. Per the Phase 13 precedent, the
post-edit re-run is skipped — trust the prior green run + lockstep
test edit. Re-run at merge time per [quickstart.md §8](quickstart.md).

---

### [X] Task 16.5 — Browser re-smoke

**What to do**:
Re-walk the `quickstart.md §6` checklist against the v0.13.2 merge
state. The same checklist used for v0.13.1 is still the canonical
shape; the only delta is that the three deferred picker-anchoring
rows are now in scope.

Pay special attention to:
- Picker anchoring (Month, Year, Filter dropdown) — closes the
  three rows that were `[ ]` in v0.13.1.
- Action Panel collapse — full panel collapsed by default at
  narrow desktop / tablet / mobile; summary bar reads
  `"Today · N events · N suggestions · N upcoming"`; click/tap
  toggle works; `≥1200px` shows the full panel as before.
- Shared filter popup — same popup chrome on Calendar and Tracker;
  no `.filter-dd` chrome anywhere on the Calendar.
- DayPanel row meta — `{Company} · {Job title}` format.
- `<375px` header wrap — Month/Year on row 1, Today + Filter on
  row 2 at iPhone SE / Galaxy Z Fold cover-screen widths.
- `+N` overflow chip on a seeded day with 4+ statuses.

**Validation**:
- All `quickstart.md §6` rows ticked, including the three
  picker-anchoring rows from v0.13.1.

**Resolution**: User-confirmed complete prior to Phase 16 drafting.
All `quickstart.md §6` rows are now `[X]` — the v0.13.1 deferred
picker-anchoring rows (Month, Year, Status filter) closed cleanly,
and the new v0.13.2 surfaces (collapsible Action Panel summary bar,
shared Tracker filter popup, `{Company} · {Job title}` DayPanel
meta, `<375px` two-row header wrap, `+N` overflow chip on the
seeded 4-status day) all behaved as spec'd.

---

## Phase Completion Criteria

A phase is complete when:

- Every `[ ]` task in the phase is marked `[X]`.
- The validation step(s) listed in each task pass.
- No regressions in earlier phases (run `npm run test:run` after
  every phase).

The branch is ready to merge when **all** phases are complete and
the latest release-prep phase's re-smoke is signed off in
[quickstart.md §6](quickstart.md). Phase 11 task 11.4 stays `[ ]` by
design — it is superseded by the v2 Inline Day Panel smoke section,
not retro-checked. Phase 16 is the final phase; merge follows once
Phase 16 closes.
