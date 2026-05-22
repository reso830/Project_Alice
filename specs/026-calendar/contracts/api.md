# API Contracts: Calendar (026)

This feature introduces **no new server endpoints**, **no new request /
response shapes**, and **no new validation schemas**. It is a
client-only feature that consumes existing contracts.

This document records the contracts the Calendar relies on, the
client-side data contracts the Calendar introduces (localStorage), and
the failure-mode expectations for each touchpoint.

---

## 1. Server endpoints consumed (unchanged)

### 1.1 `GET /api/applications`

Used by `Calendar.mount()` to load the initial application list.

- **Auth**: existing — `requireAuth` middleware (hosted) or pass-through
  (local). No new permissions.
- **Request shape**: unchanged (no query params used by Calendar).
- **Response shape**: unchanged — `{ data: Application[], error: null }`.
  Each `Application` carries a `timeline: TimelineEntry[]` array from
  feature 025.
- **Failure handling**: if the request fails, Calendar shows
  `Toast.show('Could not load calendar', 'failure')` and renders the
  page shell with empty sections (Today empty state, Suggested empty
  state, Upcoming empty state, and a blank month grid).

### 1.2 `GET /api/applications/:id`

Used when the user clicks an `↗ Open` action button on a row, or clicks
a row inside a Day Popover. Calendar refetches the application before
opening the Application Overlay (matches the Tracker's existing
behavior).

- **Auth, request, response**: unchanged.
- **Failure handling**: `Toast.show('Application details failed to
  load', 'failure')`. Popover stays closed if it was about to close;
  the overlay is not opened.

### 1.3 `PATCH /api/applications/:id`

Used by the Mark Ghosted write path. The Calendar sends one PATCH with
three fields in a single body:

```jsonc
{
  "status": "ghosted",
  "lastStatusUpdate": "2026-05-21",
  "timeline": [ /* the existing timeline + one new appended entry */ ]
}
```

- **Auth, validation, response**: unchanged. Server-side Zod schema
  (`server/validation/application.js`) already accepts all three fields
  in the update schema (feature 025 added `timeline`; `status` and
  `lastStatusUpdate` were already there). The state-machine guard
  (`TRANSITIONS`) is applied server-side as it is today.
- **Atomicity**: the SQLite adapter writes all three columns in one
  transaction. The Supabase adapter sends one PATCH that updates all
  three columns in one row update. Either path either fully succeeds
  or fully fails — there is no partial-write window.
- **Failure handling**:
  - `VALIDATION_ERROR` (rare; would only happen if the
    `applyStatusChange` helper produced a malformed entry, which it
    cannot under its current implementation): `Toast.show('Could not
    mark as ghosted', 'failure')`. No client state change.
  - `INVALID_TRANSITION` (would happen only if the application's
    status changed between Calendar's load and the user's click —
    e.g. another tab marked it accepted): same toast. The next page
    reload picks up the new state.
  - `NETWORK_ERROR`: same toast. No state change.

### 1.4 Endpoints **NOT** introduced

The Calendar does **not** introduce:

- A dedicated "ghost" endpoint (`POST /api/applications/:id/ghost`).
  Considered and rejected in [research.md §3](../research.md).
- A "suggestions" endpoint. Suggestions are computed client-side and
  cannot meaningfully be centralized on the server in v1 (dismissals
  are local-only).
- A "dismissals" endpoint. Dismissals live in `localStorage` (spec
  /clarify Q1 + research.md §4).
- A "day activities" endpoint. Projection happens client-side from
  the existing application list.

---

## 2. Client-side data contracts (introduced by this feature)

### 2.1 Suggestion dismissals — storage

Two storage paths, switched by auth state:

```
Key (hosted + local):    alice:calendar:dismissals:{userIdentityToken}
Storage:                 localStorage (JSON-serialized SuggestionDismissal[])

Demo mode:               in-module memory bucket keyed by "demo"
                         (localStorage is NEVER touched in demo)

SuggestionDismissal = {
  appId: number,
  kind: "followup" | "feedback" | "interview_followup"
      | "offer_expiry" | "ghost",
  dismissedAt: string  // ISO date YYYY-MM-DD
}
```

`userIdentityToken` resolution:

| Auth state | Token | Storage |
|---|---|---|
| `authenticated` (hosted) | `authState.user.id` (Supabase auth UUID) | localStorage |
| `local-mode` | `"local"` | localStorage |
| `demo` | `"demo"` | **In-module memory only — no localStorage** (honors feature 020 FR-004) |
| `unauthenticated` / `initializing` | `"local"` (defensive fallback) | localStorage (Calendar not reachable from these states in practice) |

**Uniqueness**: at most one record per `{appId, kind}`. `add()`
overwrites an existing record (it does not error and does not
duplicate).

**Read semantics**:
- Hosted + local: `load()` returns `[]` on any of: key absent, JSON
  parse failure, `localStorage` unavailable (private mode, quota,
  ITP). A single `console.warn` is emitted per session on the first
  failure.
- Demo: `load()` reads from the in-module `"demo"` bucket; cannot
  fail; never warns.

**Write semantics**:
- Hosted + local: `add()` reads the current list, replaces or
  appends, best-effort writes back via `localStorage.setItem`. On
  failure, the in-module memory state is updated and the suggestion
  does not reappear during the current session, but persistence is
  lost.
- Demo: `add()` writes to the in-module `"demo"` bucket only.
  `localStorage.setItem` is **never called**. Cannot fail.

**Demo lifecycle**: the `"demo"` bucket lives for the JS context
lifetime. Page refresh exits demo (per feature 020 FR-005) and the
bucket resets. Intra-tab demo re-entry without refresh inherits the
prior demo session's bucket (accepted minor edge — research.md §1).

**Versioning**: the JSON value is an array, not an object. If a future
version needs to add fields, the new fields go on each
`SuggestionDismissal` record and the loader treats missing fields as
defaults. No schema version key in v1.

### 2.2 No other client-side persistence

- No `sessionStorage` writes.
- No `IndexedDB` writes.
- No cookies written by the client.
- No service worker registration.
- Viewed month / year / filter / open popover are session-local module
  variables only — not persisted anywhere.

---

## 3. Module contracts (new code surfaces)

These are the public function signatures of the new modules. They are
**internal to the bundle**, but documenting them here gives `/speckit.tasks`
a contract to write tests against.

### 3.1 `src/utils/calendar.js`

```ts
// Year range
export const YEAR_MIN: 2020;
export const YEAR_MAX: number;  // currentYear + 5, computed once at load

// ISO 8601 week number (per design §6.8.2)
export function isoWeekNumber(year: number, month: number /* 0..11 */, day: number): number;

// Returns the 42 ISO-Monday-start day cells (6 weeks) for the given month.
// Each cell: { year, month, day, isCurrentMonth, isWeekend, isToday, isoWeek }
export function weeksInMonthGrid(viewYear: number, viewMonth: number): DayCell[][];

// Convert JS getDay() (Sun=0..Sat=6) to ISO (Mon=0..Sun=6)
export function dayOfWeekIso(date: Date): number;

// Mon–Fri only, half-open: businessDaysBetween("2026-05-15","2026-05-21") === 4
export function businessDaysBetween(aISO: string, bISO: string): number;

// Calendar days between two ISO dates. Used by every "≥ N days" rule.
export function daysBetween(aISO: string, bISO: string): number;
```

### 3.2 `src/utils/calendarProjection.js`

```ts
export function projectTimelineToCalendar(apps: Application[]): DayActivities;
export function deriveActivityTitle(entry: TimelineEntry, app: Application): string;
export function todayRowsFor(apps: Application[], todayISO: string): PanelRow[];
export function upcomingRowsFor(apps: Application[], todayISO: string): {
  tomorrow: PanelRow[];
  restOfWeek: PanelRow[];
};
```

### 3.3 `src/utils/calendarSuggestions.js`

```ts
export function evaluateSuggestions(
  apps: Application[],
  todayISO: string,
  dismissals: SuggestionDismissal[],
): Suggestion[];

// Each rule, exported for direct unit testing:
export function ruleFollowup(app, todayISO): Suggestion | null;
export function ruleFeedback(app, todayISO): Suggestion | null;
export function ruleInterviewFollowup(app, todayISO): Suggestion | null;
export function ruleOfferExpiry(app, todayISO): Suggestion | null;
export function ruleGhost(app, todayISO): Suggestion | null;

// Constants exposed for tests + components:
export const GHOST_RULE_STATUSES: ReadonlyArray<StatusKey>;  // applied..offer
export const OFFER_WINDOW_DAYS: 5;
export const OFFER_NEAR_EXPIRY_DAYS: 3;
```

### 3.4 `src/utils/calendarDismissals.js`

```ts
export function load(authState: AuthState): SuggestionDismissal[];
export function add(authState: AuthState, appId: number, kind: SuggestionKind): void;
export function isDismissed(list: SuggestionDismissal[], appId: number, kind: SuggestionKind): boolean;

// Test-only:
export function _resetForTesting(): void;
```

### 3.5 `src/models/application.js` (new exports)

```ts
export function applyStatusChange(
  application: Application,
  newStatus: StatusKey,
  options?: { date?: string; text?: string },
): Application;

export const STATUS_DISPLAY_PRIORITY: ReadonlyArray<StatusKey>;
//   ['accepted', 'offer', 'interview', 'assessment', 'phone_screen',
//    'wishlisted', 'applied', 'rejected', 'withdrawn', 'ghosted']
```

`applyStatusChange` contract (repeated from data-model.md §7 for the
test-writer):
- Pure — input not mutated.
- Returns a new `Application` with updated `status`,
  `lastStatusUpdate`, and a new `timeline` array (existing entries
  copied by reference; one new entry appended).
- Date defaults to `toISODate()` (today, local time).
- Text defaults to `""`.
- Does **not** validate the transition. Caller is responsible.

`STATUS_DISPLAY_PRIORITY` contract:
- Frozen `Object.freeze([...])` array of all 10 status keys in
  most-actionable-first order.
- The canonical source for UI ordering: chip stacking
  (MonthGrid §6.8), filter dropdown rows (StatusFilterDropdown),
  all-mode popover grouping (DayPopover).
- **Display-priority only** — do NOT use for state-machine logic;
  use `TRANSITIONS` for that.

### 3.6 Component public surfaces

Each new component module exposes a render-style API consistent with
the existing codebase (see `Timeline.js`, `StatusDropdown.js`):

```ts
// src/components/calendar/ActionPanel.js
export const ActionPanel: {
  render(container: HTMLElement, props: {
    today: PanelRow[];
    suggestions: Suggestion[];
    upcoming: { tomorrow: PanelRow[]; restOfWeek: PanelRow[] };
    todayISO: string;
    greeting: string;
    dateLabel: string;
    onOpenApp: (id: number) => void;
    onDismiss: (id: number, kind: SuggestionKind) => void;
    onMarkGhosted: (id: number) => void;
  }): void;
  destroy(): void;
};

// src/components/calendar/MonthGrid.js
export const MonthGrid: {
  render(container: HTMLElement, props: {
    viewYear: number;
    viewMonth: number;
    dayActivities: DayActivities;
    filter: StatusKey | null;
    onNavigatePrev: () => void;
    onNavigateNext: () => void;
    onJumpToToday: () => void;
    onOpenMonthPicker: (anchor: HTMLElement) => void;
    onOpenYearPicker: (anchor: HTMLElement) => void;
    onOpenFilter: (anchor: HTMLElement) => void;
    onClearFilter: () => void;
    onOpenDayPopover: (mode: "all" | "status",
                       date: string,
                       status: StatusKey | null,
                       anchor: HTMLElement) => void;
  }): void;
  destroy(): void;
};

// src/components/calendar/DayPopover.js
export const DayPopover: {
  open(props: {
    mode: "all" | "status";
    date: string;
    status?: StatusKey;
    activities: DayActivity[];   // already filtered to the mode
    anchor: HTMLElement;
    onOpenApp: (id: number) => void;
    onClose: () => void;
  }): void;
  close(): void;
};

// src/components/calendar/MonthPicker.js, YearPicker.js,
// StatusFilterDropdown.js — same open/close pattern as DayPopover.

// src/components/calendar/anchoredDropdown.js — primitive used by
// every popover/picker. Manages positioning, outside-click,
// Escape key, and bottom-sheet conversion at <640px.
export function mountAnchoredDropdown(props: {
  anchorEl: HTMLElement;
  contentEl: HTMLElement;
  align: "start" | "end";
  asBottomSheet: boolean;
  scrim: boolean;
  onClose: () => void;
}): { unmount: () => void };
```

---

## 4. Failure-mode summary

| Touchpoint | Failure | UX |
|---|---|---|
| `api.getAll()` on mount | Network / 500 / parse error | Page renders with empty sections; toast: "Could not load calendar". |
| `api.getById(id)` on row click | Any error | Toast: "Application details failed to load"; overlay not opened. |
| `api.update(id, …)` on Mark Ghosted | Validation / network / transition error | Toast: "Could not mark as ghosted"; no client state change. |
| `localStorage` unavailable | Quota / private mode / ITP | First failure: `console.warn`. Subsequent failures: silent. Dismissals fall back to in-module memory; the user sees no error dialog. |
| `Math.random` / `Date` stubbing in tests | N/A | Tests must stub both before mounting the page; otherwise greeting is random. |
| Suggestion rule trigger on an application with a malformed `timeline` (corrupt rows) | Should never happen (server validation rejects malformed timelines) | Rule functions short-circuit on `Array.isArray(timeline) === false`; return `null`. |

---

## 5. Backward compatibility

The Calendar relies on three feature-025 invariants:

1. Every application row has a `timeline` array (possibly empty) after
   `normalizeApplication`. Legacy rows are auto-synthesized at read
   time per 025's spec — the Calendar treats the synthesized array
   the same as a user-edited one.
2. The `update` route accepts a `timeline` array in the same PATCH
   that updates `status` and `lastStatusUpdate`.
3. `STATUS_CONFIG` includes `accepted` (feature 025 audit; the
   Calendar's chip colors and popover badges depend on this).

If any of these is regressed by a future feature, the Calendar will
break visibly (no chips render; PATCH rejected). There is no silent
degradation path.
