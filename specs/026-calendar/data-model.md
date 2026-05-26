# Data Model: Calendar (026)

This feature introduces **no new persisted data shapes**. Every Calendar
data structure is either:

- a **projection** computed at render time from the existing
  `application.timeline[]` array (introduced by feature 025), or
- a **client-side cache** kept in `localStorage` (suggestion dismissals).

The application row itself is unchanged — no new fields, no schema
migration, no validation changes.

---

## 1. Computed Types

### 1.1 `DayActivity`

The atomic unit of the calendar projection. One Timeline entry maps to
one `DayActivity`. Multiple `DayActivity`s for the same `date` aggregate
into a `Day`.

```ts
type DayActivity = {
  id: number;          // application.id — used to open the overlay
  title: string;       // see deriveActivityTitle() below
  company: string;     // application.companyName
  status: StatusKey;   // entry.status — drives chip color + popover badge
};
```

Sort order within a day: stable by application.id ascending. Multiple
activities for the same application on the same day (rare; possible if
a user logs two events on one date) preserve insertion order from the
underlying `timeline[]`.

### 1.2 `DayActivities`

A keyed projection over all applications:

```ts
type DayActivities = Record<"YYYY-MM-DD", DayActivity[]>;
```

Computed via:

```ts
function projectTimelineToCalendar(apps: Application[]): DayActivities {
  const out: DayActivities = {};
  for (const app of apps) {
    if (!Array.isArray(app.timeline)) continue;
    for (const entry of app.timeline) {
      (out[entry.date] ??= []).push({
        id: app.id,
        title: deriveActivityTitle(entry, app),
        company: app.companyName,
        status: entry.status,
      });
    }
  }
  return out;
}
```

`projectTimelineToCalendar` is **pure**: no caching, no memoization
inside the function. The Calendar page calls it once per render cycle.
At realistic dataset sizes (≤ 200 apps × ≤ 50 entries each), the
projection is ~10k operations — sub-millisecond on any modern device.

### 1.3 `deriveActivityTitle()`

```ts
function deriveActivityTitle(entry: TimelineEntry, app: Application): string {
  // 1. Non-empty entry text wins (user-authored)
  const trimmed = (entry.text ?? "").trim();
  if (trimmed.length > 0 && trimmed.length <= 80) return trimmed;
  if (trimmed.length > 80) return trimmed.slice(0, 77) + "…";

  // 2. Fall back to the status label (e.g. "Interview", "Phone Screen")
  const label = STATUS_CONFIG[entry.status]?.label;
  if (label) return label;

  // 3. Last resort: the job title (ensures something always renders)
  return app.jobTitle ?? "Activity";
}
```

The 80-char cap is for the Today / Upcoming row's `.title` line —
single-line layout, truncates anyway via CSS, but the data should not
push extreme text into the DOM.

### 1.4 `PanelRow`

Row shape for the Action Panel's Today / Upcoming sections. Extends
`DayActivity` with the `role` field used in the meta line.

```ts
type PanelRow = {
  id: number;
  title: string;
  company: string;
  role: string;    // application.jobTitle
};
```

Computed via `todayRowsFor(apps, todayISO)` and `upcomingRowsFor(apps,
todayISO)` in `src/utils/calendarProjection.js`. Both return
`PanelRow[]` sorted by `(date asc, id asc)`. `upcomingRowsFor` returns
two arrays (`tomorrow`, `restOfWeek`) computed against today's ISO week.

### 1.5 `Suggestion`

```ts
type SuggestionKind =
  | "followup"
  | "feedback"
  | "interview_followup"
  | "offer_expiry"
  | "ghost";

type Suggestion = {
  id: number;          // application.id
  kind: SuggestionKind;
  title: string;       // primary user-facing copy
  meta: string;        // secondary copy (e.g. "7d since application")
  primary: "open" | "mark_ghosted";  // drives the action button variant
};
```

Computed via `evaluateSuggestions(apps, todayISO, dismissals)` in
`src/utils/calendarSuggestions.js`. Returns `Suggestion[]` containing
at most one entry per `{id, kind}`. Order is stable: applications
sorted by id ascending, suggestions within an application by the
priority order Ghost → Offer-expiry → Interview-followup → Feedback →
Followup (so the most actionable items show first).

---

## 2. Suggestion Rule Specifications

Each rule is a pure function `(application, todayISO) => Suggestion | null`.
The composite `evaluateSuggestions` runs every rule for every
application, drops nulls, then applies suppression (future entry,
dismissal, terminal status). Below: each rule's spec, derived from
spec.md §Scope and the /clarify decisions.

Helpers used:
- `daysBetween(aISO, bISO)` — calendar days, no time component.
- `businessDaysBetween(aISO, bISO)` — Mon–Fri only, no holiday calendar.
- `hasFutureEntry(timeline, todayISO)` — any entry with `date > todayISO`.
- `latestTimelineEntry(timeline)` — sorted by `(date desc, id desc)`,
  returns the first.

### 2.1 `followup`

```
Trigger:
  - latestTimelineEntry(timeline).status === "applied"
  - daysBetween(latestEntry.date, todayISO) >= 7

Implied "no newer entries" (spec /clarify Q2):
  satisfied by the "most recent entry" check above — there is by
  definition no newer entry.
```

Copy: `"Follow up with recruiter?"`
Meta: `"{N}d since application"` where `N = daysBetween(latestEntry.date, todayISO)`.
Primary: `"open"`.

### 2.2 `feedback`

```
Trigger:
  - latestTimelineEntry(timeline).status === "phone_screen"
  - businessDaysBetween(latestEntry.date, todayISO) >= 5
```

Copy: `"Check interview feedback status?"`
Meta: `"{N} business days since phone screen"` where `N = businessDaysBetween(...)`.
Primary: `"open"`.

### 2.3 `interview_followup`

```
Trigger:
  - latestTimelineEntry(timeline).status === "interview"
  - daysBetween(latestEntry.date, todayISO) >= 7
```

Copy: `"Consider sending a follow-up message"`
Meta: `"{N}d since interview"`.
Primary: `"open"`.

### 2.4 `offer_expiry`

```
Trigger:
  - application.status === "offer"
  - Let offerEntry = the latest timeline entry with status === "offer"
    (may not be the most recent entry overall — user may have logged
    a recruiter call after the offer; that's fine)
  - daysBetween(offerEntry.date, todayISO) >= 3
  - daysBetween(offerEntry.date, todayISO) <= 5    ← "last 3 days of the
                                                     assumed 5-day window"
  - Note: if today exceeds offerEntry.date + 5, the suggestion stops
    firing. By that point the user has either accepted/rejected (rule
    suppressed by terminal status) or visibly let it lapse — the
    Calendar does not nag past the window.
```

Copy: `"Offer response may be needed soon"`
Meta: `"Offer extended {N}d ago"`.
Primary: `"open"`.

### 2.5 `ghost`

```
Trigger:
  - application.status ∈ { "applied", "phone_screen", "interview",
                           "assessment", "offer" }
  - daysBetween(latestTimelineEntry(timeline).date, todayISO) >= 14
  - !hasFutureEntry(timeline, todayISO)
```

Spec /clarify Q3: `wishlisted` is explicitly excluded — the user
hasn't applied, so the application cannot have been ghosted by an
external party.

Copy: `"No updates for 14 days. Mark as Ghosted?"`
Meta: `"{N}d · last touched {prettyDate}"`.
Primary: `"mark_ghosted"`.

### 2.6 Composite suppression

For every rule above, after the rule's positive trigger, suppress if
ANY of:

- `hasFutureEntry(timeline, todayISO)` — a future-dated entry exists
  (the user has already scheduled their own follow-up).
- `isDismissed(dismissals, app.id, kind)` — see §3.
- `TERMINAL_STATES.has(application.status)` — `accepted` / `rejected`
  / `withdrawn` / `ghosted`. Note: a terminal status by definition
  cannot trigger any rule except via the `application.status` check
  in §2.4/2.5, but this is the catch-all guard for any rule that uses
  only `latestTimelineEntry.status` (rules 2.1, 2.2, 2.3 — the
  application's overall status might be terminal even though the most
  recent timeline entry is one of `applied`/`phone_screen`/`interview`;
  this happens when a user re-status'd the app, and the auto-entry has
  not yet aged out of the trigger window).

### 2.7 Visibility window

A suggestion that passes the trigger + suppression checks is only
**shown** in the Action Panel if it is:

- Newly triggered today (the trigger condition first became true on or
  after `todayISO - 1`), OR
- Relevant today (the trigger condition is currently true), OR
- Relevant tomorrow (the trigger condition will become true on
  `todayISO + 1`, e.g. an offer extended 2 days ago has tomorrow as
  the first day of its window).

In practice, rules 2.1–2.5 all evaluate to "relevant today" once they
trigger. Older relevance is decayed implicitly because the rule
re-fires every day the trigger is still true — there is no separate
"newness" timestamp to track.

---

## 3. Suggestion Dismissal Storage

### 3.1 Schema

```ts
type SuggestionDismissal = {
  appId: number;
  kind: SuggestionKind;
  dismissedAt: string;  // ISO date YYYY-MM-DD; not used for logic, only
                        // for debug visibility
};
```

Stored in `localStorage` as a JSON array:

```
key:   "alice:calendar:dismissals:{userIdentityToken}"
value: SuggestionDismissal[]
```

### 3.2 Key scoping

Spec /clarify Q1 settled the user identity source. Spec review M1
(2026-05-21) added the demo carve-out:

```js
function userIdentityToken(authState) {
  if (authState.status === "authenticated") {
    return authState.user.id;   // Supabase auth UUID
  }
  if (authState.status === "demo") {
    return "demo";              // in-memory only (never written to localStorage)
  }
  // local-mode, unauthenticated, initializing
  return "local";
}

function dismissalKey(authState) {
  return `alice:calendar:dismissals:${userIdentityToken(authState)}`;
}

function isDemoSession(authState) {
  return authState?.status === "demo";
}
```

Rationale:
- **Hosted authenticated users**: dismissals isolated per Supabase
  account (multi-user device safety).
- **Demo mode**: dismissals live in a dedicated `"demo"`-keyed
  in-memory bucket. `localStorage` is **never written** during
  demo. This honors feature 020 FR-004 ("no persistent client-side
  state for the visitor"). The bucket lives for the JS context
  lifetime; page refresh (which exits demo per feature 020) resets
  it. An intra-tab demo re-entry without refresh inherits the
  previous demo session's in-memory dismissals — an accepted minor
  edge.
- **Local mode**: dismissals go to `localStorage` under
  `alice:calendar:dismissals:local`. Single-user dev box, so the
  shared bucket is safe.
- **Unauthenticated / initializing**: the Calendar is not reachable
  from these states; the `"local"` bucket label is a defensive
  fallback.

### 3.3 Read / write API

`src/utils/calendarDismissals.js`:

```js
export function load(authState) { /* returns SuggestionDismissal[] */ }
export function add(authState, appId, kind) { /* idempotent per {appId, kind} */ }
export function isDismissed(list, appId, kind) { /* O(n) scan */ }
```

- `load` for hosted/local: try `localStorage.getItem(key)`; on any
  failure (missing key, parse error, `localStorage` unavailable),
  return the in-module memory fallback for that key (default `[]`).
  A single `console.warn` is emitted on the first failure per
  session.
- `load` for demo: read directly from the in-module memory bucket
  keyed by `"demo"`. **Never** call `localStorage.getItem`. No
  warning is emitted because no failure can occur.
- `add` for hosted/local: read current list (via `load`), drop any
  existing `{appId, kind}`, push `{ appId, kind, dismissedAt: today }`,
  best-effort `localStorage.setItem`. Also update the in-module
  memory fallback so the in-session state remains correct even if
  the write silently fails.
- `add` for demo: read current list from memory, mutate, write back
  to memory. **Never** call `localStorage.setItem`.
- Both `load` and `add` are synchronous.
- All `localStorage` errors (when applicable) are swallowed silently
  after the first warning; dismissals fall back to in-module-state
  for the session.

### 3.4 Lifecycle

- Created when the user clicks `× Dismiss` on a suggestion.
- Never deleted programmatically. An orphaned record (application
  later deleted from the DB) is harmless — it matches no application
  and so suppresses nothing.
- **Hosted + local**: survives page reload. Does **not** survive
  `localStorage.clear()` or browser cache wipe (acceptable, per
  spec edge cases).
- **Demo**: lives only for the JS context lifetime. Page refresh
  (which exits demo per feature 020 FR-005) discards everything.
- Does **not** sync across devices (spec non-goal).

---

## 4. View State (Session-local, Not Persisted)

The Calendar page owns four pieces of state held in module variables
on `src/pages/Calendar.js`:

| Variable | Type | Default | Persisted? |
|---|---|---|---|
| `_viewYear` | `number` | `todayLocalYear()` | No |
| `_viewMonth` | `number` (0..11) | `todayLocalMonth()` | No |
| `_filter` | `StatusKey \| null` | `null` | No |
| `_openPopover` | `{ kind, anchor, ... } \| null` | `null` | No |

These reset on every page mount. Defaults are recomputed from
`new Date()` at mount time. Closing the page (unmount) discards them.

---

## 5. Date Handling

- All Calendar date comparisons use **local-time `YYYY-MM-DD` strings**
  (no Date objects passed around). This matches the format used by
  `TimelineEntry.date` from feature 025.
- "Today" is computed from `new Date()` at the moment the comparison
  is made. Mid-session midnight rollovers do **not** auto-refresh the
  page (spec edge case — accepted).
- Year range constants:
  ```js
  export const YEAR_MIN = 2020;
  export const YEAR_MAX = new Date().getFullYear() + 5;
  ```
  Defined once in `src/utils/calendar.js` and imported by every
  navigation surface.

---

## 6. Application Data Shape (Read-Only Reference)

For completeness — this is the existing shape the Calendar reads. No
changes:

```ts
type StatusKey =
  | "wishlisted" | "applied" | "phone_screen" | "interview"
  | "assessment" | "offer"  | "accepted"     | "rejected"
  | "withdrawn"  | "ghosted";

type TimelineEntry = {
  id: number;
  date: string;       // YYYY-MM-DD
  status: StatusKey;
  text: string;       // may be ""
};

type Application = {
  id: number;
  jobTitle: string;
  companyName: string;
  status: StatusKey;
  lastStatusUpdate: string;     // YYYY-MM-DD
  responsibilities: string;
  timeline: TimelineEntry[];    // introduced by feature 025
  // ...other fields (compat, skills, fav, salary, etc.) —
  // not used by the Calendar
};
```

All Calendar projections depend on `timeline[]` being sorted by
`(date desc, id desc)` at the projection boundary, which feature 025's
`sortTimelineEntries` guarantees on every read from `normalizeApplication`.

---

## 7. The `applyStatusChange` Helper

Added to `src/models/application.js` for the Mark Ghosted write path.
Pure, returns a new application record:

```js
import { allocateTimelineEntryId } from "./application.js";
import { toISODate } from "../utils/date.js";

export function applyStatusChange(application, newStatus, options = {}) {
  const date = options.date ?? toISODate();
  const text = options.text ?? "";
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

Contract:

- Pure: input not mutated; returns a new object with new `timeline`
  array.
- Always bumps `lastStatusUpdate` to the entry's date.
- Always appends (never replaces) a timeline entry.
- Does **not** validate the transition — the caller is responsible
  (the Calendar Mark Ghosted path already gates by the ghost
  suggestion's status whitelist, which is a subset of `applied →
  ghosted` etc. — all valid in `TRANSITIONS`).
- Server-side validation (Zod) catches any malformed result before
  persistence.

This helper does **not** replace `appendStatusChangeTimelineEntry`
in `src/components/Timeline.js` — the two have different contracts
(mutating draft vs. pure return), and Modal.js owns the mutating
variant. Future cleanup could unify them, but it's out of scope for
this feature.
