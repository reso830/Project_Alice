# Feature Specification: Calendar

**Feature Branch**: `026-calendar`
**Created**: 2026-05-21
**Status**: Draft
**Input**: [`docs/features/026-calendar.md`](../../docs/features/026-calendar.md), [`docs/design/calendar.md`](../../docs/design/calendar.md)
**Depends on**: [`025-application-timeline`](../025-application-timeline/spec.md) (canonical Timeline data)

---

## Clarifications

### Session 2026-05-21

- Q: In hosted mode, what value should be the `userIdentityToken` suffix for the dismissal `localStorage` key? → A: The Supabase `auth.user.id` UUID (stable per account, non-PII, already used as the per-user scoping key in feature 019). **In demo mode, dismissals are never written to `localStorage`** — they live in a separate in-memory bucket keyed by the literal `"demo"` so feature 020's "no persistent client-side state for the visitor" rule (FR-004) is honored.
- Q: For the `followup`, `feedback`, and `interview_followup` rules, what counts as a "newer entry" that suppresses the suggestion? → A: Any newer Timeline entry suppresses, regardless of status or text content — the user has demonstrably touched the application.
- Q: How should the ghost suggestion handle applications still in `wishlisted` (a status the state machine does not allow to transition to `ghosted`)? → A: Exclude `wishlisted` from the ghost trigger. The ghost rule fires only on statuses that imply an external party owes a response (`applied`, `phone_screen`, `interview`, `assessment`, `offer`). You can't be ghosted if you didn't apply.
- Q: Greeting selection — deterministic (per the brief) or uniform-random (per the design §6.1)? → A: Uniform-random per page-load from the merged pool, where the pool is selected from the four time-window pools (05–11 / 12–16 / 17–21 / 22–04) using the local browser clock at mount, plus the three neutral entries appended to every pool. Tests stub the RNG.
- Q: Row click affordance — should Action Panel row bodies open the overlay, or only the explicit action button? → A: Keep the design's asymmetry. Action Panel row body is **not** clickable; only the `↗ Open` / `Mark Ghosted` / `× Dismiss` buttons trigger actions. Day-popover row body **is** clickable (single semantic action — open the application).

---

## Problem Statement

The Tracker (feature 001) is row-centric: users see *which* applications exist
and *what status they're in*, but not *what's happening when*. Activity is
locked inside each application's Timeline (feature 025) — useful in context,
invisible at a glance. A user opening the app on a Monday morning has no
operational view that answers:

- What's on my plate today?
- What's coming up this week?
- Which applications have gone quiet and need a nudge?
- When was my month busy or empty?

The Calendar page introduces a **temporal projection** of Timeline activity
plus a lightweight **operational dashboard**. It is explicitly **not** a
productivity planner, a separate event store, or a CRUD surface — every edit
still flows through the Application Overlay, and every "event" is a Timeline
entry derived at render time. The page also surfaces rule-based **Suggested
Actions** (deterministic, local, no LLM) to gently flag stale applications,
pending offers, and prolonged silence without becoming alert-style noise.

The Calendar's nav slots already exist (top Navbar + mobile Bottom Tab Bar)
and currently render a placeholder. This feature replaces that placeholder
with the real page.

---

## Scope

### Page layout

- Replace the existing Calendar placeholder route with a real Calendar page.
- Two primary sections: **Action Panel** (greeting, Today, Suggested Actions,
  Upcoming) and **Month Grid** (visual scanning + drill-down).
- Responsive layout per design §3:
  - Wide (≥1200px): side-by-side, ~40/60 split.
  - Narrow (640–1199px): stacked, Action Panel above Month Grid.
  - Mobile (<640px): stacked, compact spacing, popovers become bottom sheets.
- Action Panel is prioritized over the grid on mobile.

### Action Panel

- **Greeting header**: time-aware greeting + current date. Greeting is
  locally computed (no network, no LLM). At mount, the local browser
  hour selects one of four time-window pools (05–11 morning, 12–16
  afternoon, 17–21 evening, 22–04 late-night) per design §6.1; the
  three neutral entries are appended to the selected pool; the final
  greeting is picked uniform-random from the merged pool. Selection is
  computed once per page-load and does not refresh as the local clock
  crosses an hour boundary.
- **Today**: rows for Timeline entries dated today (local date).
- **Suggested Actions**: rule-driven suggestions (see Suggestion Engine).
- **Upcoming**: future Timeline entries grouped into `Tomorrow` and
  `Rest of Week` (through Sunday of the current ISO week).
- Each section shows a count pill (hidden when empty) and an empty state
  when the section has zero items (design §6.5 copy).
- Rows show `#ID` pill, title, `Company · Role` meta, and action button(s).
- Row body is not clickable — only the action button opens an overlay.

### Month Grid

- Month-view only. Always renders 6 weeks (48 cells: 6 ISO week labels +
  42 day cells).
- ISO 8601 Monday-start. ISO calendar week column on the leftmost gutter.
- Date cells show `[N]`-shaped status chips, one per distinct status that
  day, ordered by priority (Accepted → Offer → Interview → Technical
  Assessment → Phone Screen → Wishlisted → Applied → Rejected → Withdrawn
  → Ghosted). Max 3 chips; overflow renders `+N`.
- Cell states: today, weekend tint, out-of-month, filter-muted.
- Cells with zero activities are non-interactive (no hover, no click).
- Month/year picker controls, Prev/Next month arrows, Today button (visible
  only when the viewed month is not the current month).
- Year range: **2020 ≤ year ≤ currentYear + 5**. Out-of-range navigation
  is disabled.

### Day popover

- Two modes (design §6.9):
  - **status mode** — clicking a status chip; lists that day's activity
    filtered to that status.
  - **all mode** — clicking the date number or `+N` overflow; lists every
    activity that day, grouped by status priority.
- Popover row click closes the popover and opens the Application Overlay.
- On mobile (<640px), popover becomes a bottom sheet (drag handle, scrim,
  swipe/tap-out to dismiss).

### Status filter

- Single-status filter affecting the Month Grid only.
- Filter chip on the grid header opens a status dropdown (priority order).
- Filtered-out cells stay laid out but render at ~35% opacity (the layout
  must not reflow).
- Action Panel is unaffected by the grid filter.
- Day popover is unaffected by the grid filter (status mode always shows
  the chip's status; all mode always shows the full day).

### Suggestion Engine

Suggestions are **deterministic**, **rule-based**, **locally computed**, and
operate over the in-memory application list. No LLM, no network.

A suggestion is shown only if it is newly triggered today, relevant today,
or relevant tomorrow. A suggestion is suppressed if:

- A future Timeline entry already exists on that application, OR
- The user has dismissed it before (persistent), OR
- The application is in a terminal state (`accepted`, `rejected`,
  `withdrawn`, `ghosted`).

V1 rules:

| Kind                  | Trigger                                                                 | Copy                                            | Primary action |
|-----------------------|-------------------------------------------------------------------------|-------------------------------------------------|----------------|
| `followup`            | Most recent Timeline entry has status = `applied` and is ≥ 7 days old; no newer Timeline entries of any kind exist on that application | "Follow up with recruiter?"                     | Open overlay   |
| `feedback`            | Most recent Timeline entry has status = `phone_screen` and is ≥ 5 business days old; no newer Timeline entries of any kind exist | "Check interview feedback status?"              | Open overlay   |
| `interview_followup`  | Most recent Timeline entry has status = `interview` and is ≥ 7 days old; no newer Timeline entries of any kind exist | "Consider sending a follow-up message"          | Open overlay   |
| `offer_expiry`        | Status = `offer`; ≥ 3 days since latest `offer` timeline entry; not yet `accepted`/`rejected`/`withdrawn` | "Offer response may be needed soon"             | Open overlay   |
| `ghost`               | Status ∈ {`applied`, `phone_screen`, `interview`, `assessment`, `offer`}; no timeline entries in ≥ 14 days; no future entries; not previously dismissed | "No updates for 14 days. Mark as Ghosted?"      | **Mark Ghosted** (text button) |

- "Business days" = Mon–Fri in the user's local timezone. No holiday calendar.
- "Offer expiry" assumes a 5-day response window (`offerEntryDate + 5d`).
  Suggestion fires in the last ~3 days of the window (i.e. when `today ≥
  offerEntryDate + 3` and status is still `offer`).
- Ghost suggestion's primary action is the destructive text button
  `Mark Ghosted`; standard suggestions use the icon-only `↗ Open`. All
  suggestions also expose a `× Dismiss` action.

### Mark Ghosted action

When invoked from a ghost suggestion:

1. Application `status` transitions to `ghosted` via the existing state
   machine (`src/models/application.js`). Transition must be valid.
2. A Timeline entry is appended:
   `{ date: today (ISO), status: 'ghosted', text: 'Marked as ghosted after prolonged inactivity.' }`
   via the existing Timeline persistence path (feature 025).
3. `lastStatusUpdate` is bumped to today (constitution-required).
4. Persistence happens immediately — no draft, no Save dialog.
5. Toast confirmation: `Marked #{ID} as Ghosted`.
6. The suggestion disappears from the panel (the application is now terminal).

### Persistence

- **Suggestion dismissals**: stored in browser `localStorage`, keyed by user
  identity (hosted mode: Supabase `auth.user.id` UUID; local mode: the
  constant `"local"`). **Demo mode never writes to `localStorage`** —
  dismissals live in an in-memory bucket keyed by `"demo"` for the page
  lifetime, honoring feature 020's FR-004 ("no persistent client-side
  state for the visitor"). Storage shape per design §10.
- **Session-local state** (NOT persisted): viewed month, viewed year, active
  status filter, open popover/picker, current greeting selection.
- No new server-side data store, table, or schema migration.
- No new application fields. No changes to the Application data model
  beyond reading existing timeline entries and triggering the existing
  status-change path for Mark Ghosted.

### Accessibility

- Cells, chips, popover/picker triggers, action buttons, and dismiss/open
  buttons are keyboard-reachable with visible focus rings.
- ISO week gutter cells and the `CW` header are `aria-hidden`.
- Status is never communicated by color alone — chips carry a count number
  and popover rows carry a status label.
- Escape key closes the active popover, picker, or bottom sheet.

---

## Non-Goals

- Technical-assessment due-date suggestion (deferred; needs a deadline
  data field this codebase does not have). The original brief
  ([docs/features/026-calendar.md line 300](../../docs/features/026-calendar.md))
  and design ([docs/design/calendar.md §7 line 510](../../docs/design/calendar.md))
  both include this rule; the deferral was decided at
  `/speckit.clarify` (Q2) and is recorded as an explicit accepted
  scope reduction in [research.md §2a](research.md). Re-add path is
  documented there for the future feature that introduces an
  `assessmentDueDate` field.
- Week view, day view, year view.
- Drag-to-create, drag-to-move, calendar-native event CRUD.
- External calendar integrations (Google / Outlook / iCal export or import).
- AI- or LLM-generated suggestions; any non-deterministic suggestion logic.
- Per-day notes, attachments, or links.
- Mobile collapsible Action Panel summary bar.
- URL-persisted filters or deep-linkable Calendar state.
- Cross-device sync of suggestion dismissals (localStorage is per-device
  by design).
- Holiday-aware business-day calculation.
- New application fields (offer expiry, assessment deadline, etc.).
- Navigation/router changes beyond replacing the placeholder page contents
  (the Calendar route already exists).

---

## User Behavior

### US-1 — See what's on today's plate
A user opens the Calendar and immediately sees a Today section listing every
Timeline entry dated today across all applications.

*Independent test*: with two applications having a Timeline entry dated
today and one with no entry today, the Today section shows exactly the two
matching rows with correct ID, title, company, and role.

### US-2 — See what's coming up
A user scans the Upcoming section to see future Timeline entries grouped
into `Tomorrow` and `Rest of Week`.

*Independent test*: with timeline entries dated +1, +3, +6, and +9 days,
the Tomorrow group shows the +1 entry; Rest-of-Week shows +3 and +6 (if
within the current ISO week through Sunday); the +9 entry does not appear.

### US-3 — Get gentle nudges
A user sees Suggested Actions for stale or pending applications according
to the v1 rules.

*Independent test*: seed one application that triggers each suggestion kind
(`followup`, `feedback`, `interview_followup`, `offer_expiry`, `ghost`);
verify each row renders with the correct copy and correct primary action.

### US-4 — Scan a month for activity density
A user navigates between months and visually scans status chips per day.

*Independent test*: with applications producing activity across multiple
days and statuses, verify chips render in priority order, cells with no
activity are non-interactive, and the `+N` overflow appears when >3
statuses are present in one cell.

### US-5 — Drill into a day's activity
A user clicks a date cell or a status chip and sees the full day's
activity in a popover, with rows that open the Application Overlay.

*Independent test*: click the date number of a day with multiple status
activities → all-mode popover lists every activity. Click an individual
status chip → status-mode popover lists only that status's activities.
Click a popover row → popover closes and the Application Overlay opens
for the correct application.

### US-6 — Filter the grid by status
A user filters the Month Grid to a single status.

*Independent test*: select `Interview` from the filter; cells with no
matching status activity render at ~35% opacity (still laid out); cells
with matching activity remain at full opacity. Confirm the Action Panel
rows are unchanged.

### US-7 — Navigate months and years
A user moves between months using the prev/next arrows, jumps to a
specific month via the month picker, jumps to a year via the year picker,
or jumps back to the current month using the Today button.

*Independent test*: from the current month, navigate forward 12 months;
verify Today button appears once off the current month and disappears when
the view returns. Navigate to year 2020 and to year currentYear+5;
verify Prev/Next arrows disable at the boundaries.

### US-8 — Mark an application Ghosted
A user clicks `Mark Ghosted` on a ghost-flag suggestion.

*Independent test*: a suggestion for an application that has gone 14+ days
without updates appears; clicking `Mark Ghosted` updates status to
`ghosted`, appends the expected Timeline entry, bumps `lastStatusUpdate`,
shows the confirmation toast, and removes the suggestion from the panel
(application is now terminal).

### US-9 — Dismiss a suggestion permanently
A user clicks `× Dismiss` on a suggestion and the suggestion does not
return on subsequent visits.

*Independent test*: dismiss a suggestion; reload the page; verify the
suggestion does not reappear even though its triggering condition still
holds. Verify only that suggestion kind for that application is suppressed
— other kinds and other applications are unaffected.

---

## Acceptance Criteria

1. The Calendar page renders at the existing Calendar route, replacing the
   placeholder.
2. The Action Panel and Month Grid layouts respond to the three breakpoints
   per design §3.
3. The Today section lists every Timeline entry dated today (local date)
   from non-deleted applications, sorted by application ID ascending; empty
   state renders when there are none.
4. The Upcoming section lists future Timeline entries in two groups —
   `Tomorrow` and `Rest of Week` (through Sunday of the current ISO week);
   entries beyond Sunday do not appear; empty state renders when there
   are none.
5. The Suggested Actions section lists at most one row per
   `{appId, suggestionKind}` pair according to the v1 rules above; each
   row exposes the correct primary action and a Dismiss action.
6. Dismissing a suggestion removes the row immediately and prevents the
   same `{appId, kind}` from reappearing on future page loads (until the
   triggering condition changes such that the rule no longer matches).
7. Clicking `Mark Ghosted` transitions the application to `ghosted` via
   the existing state machine, appends a Timeline entry with today's date
   and the prescribed text, bumps `lastStatusUpdate`, persists immediately,
   and shows a toast.
8. The Month Grid renders exactly 6 weeks for every month, ISO Monday-start,
   with an ISO week number gutter on the left.
9. Each day cell shows up to 3 status chips in priority order; a 4th
   element (`+N`) appears when more statuses are present.
10. Today's cell is visually distinct (per design §6.8 cell states).
11. Clicking a status chip opens the day popover in `status` mode for that
    status; clicking the date number or `+N` opens the popover in `all`
    mode; clicking a popover row opens the Application Overlay for the
    correct application and closes the popover.
12. Clicking the `↗ Open` action on any Action Panel row (Today,
    Suggested Actions, or Upcoming) opens the Application Overlay for
    the correct application. The row body itself is not clickable —
    only the action button triggers the overlay.
13. When a status filter is active, the Month Grid renders only chips
    whose status matches the filter on cells that have a matching
    activity; cells with no matching activity dim to ~35% opacity (still
    visible, still clickable). Layout does not reflow. The Action Panel
    is unaffected by the filter. Day popovers are unaffected by the
    filter (`all` mode always shows every activity; `status` mode is
    always scoped to the clicked chip's status).
14. Prev/Next month arrows are disabled at the year boundaries
    (Jan 2020 / Dec currentYear+5); the Year Picker disables
    out-of-range year entries. Month Picker entries remain enabled because
    every month is valid within an in-range year.
15. The Today button is visible only when the viewed month is not the
    current month; clicking it returns the view to today.
16. View state (month, year, status filter, open popover) does not persist
    across page loads.
17. Suggestion dismissals persist in `localStorage` keyed by user identity
    in hosted + local modes; in hosted mode, dismissals on a different
    account on the same device do not bleed across users. **In demo
    mode, dismissals are in-memory only — `localStorage` is never
    written** (feature 020 FR-004).
18. All interactive surfaces are keyboard-reachable with a visible focus
    ring; Escape closes the active popover/picker/bottom sheet.
19. Status is conveyed by both color and label/count — no information is
    encoded by color alone.
20. No new server-side schema, table, or migration is introduced.
21. No new fields are added to the Application data model.

---

## Edge Cases

- **No timeline entries anywhere**: Today, Upcoming, and Suggested Actions
  all render their empty states; the Month Grid renders blank cells; no
  errors.
- **Application with empty timeline + terminal status**: produces no
  Calendar projection and no suggestions.
- **Application with only future entries**: appears in Upcoming and on
  future month cells; nothing in Today; suggestions suppressed (future
  entry exists).
- **Timeline entry dated before 2020**: still projected into the grid
  but unreachable via navigation (the user cannot scroll back past 2020).
  Confirm the entry is reachable via the Application Overlay regardless.
- **Timeline entry dated beyond currentYear+5**: still projected into
  data but unreachable via month navigation; document as known limitation.
- **ISO week year boundary**: late-December dates may belong to ISO week
  01 of the next year, and early-January dates to ISO week 52/53 of the
  previous year; the gutter shows the correct ISO week number regardless
  of the viewed month/year.
- **DST transitions**: dates are stored as `YYYY-MM-DD` strings;
  "today" is computed from local browser time. A DST shift does not skip
  or duplicate a calendar day.
- **More than 3 statuses on a single day**: render the top 3 in priority
  order plus a `+N` overflow chip; clicking the overflow opens the
  all-mode popover.
- **Cell with activities but filtered out**: rendered at 35% opacity, not
  hidden; cursor remains pointer so the cell remains clickable to view
  the (full) day popover.
- **Suggestion race**: user clicks `× Dismiss` and `Mark Ghosted` in quick
  succession on the same row; only one action takes effect (whichever
  fires first), and the row is removed.
- **Wishlisted application going stale**: the ghost suggestion does **not**
  fire on `wishlisted` applications by design — wishlisted means the user
  hasn't applied yet, so they cannot be ghosted. The state machine
  enforces this (`wishlisted → ghosted` is not a permitted transition).
  If a race causes `Mark Ghosted` to be called on a wishlisted application
  anyway, the transition fails safely with no state change.
- **Application deleted while a dismissal record exists**: the orphaned
  dismissal stays in localStorage; it has no UI effect (the application
  no longer exists to suggest against). No cleanup required in v1.
- **Multiple users on the same device** (hosted mode): each user's
  dismissals are isolated by the user-identity component of the
  localStorage key.
- **Browser localStorage unavailable** (private mode, quota): dismissals
  do not persist across reloads; the page still functions; suggestions
  re-appear. Surface this only as a console warning, not a user dialog.
- **Greeting at midnight rollover**: greeting is computed at mount and
  does not re-evaluate as the local clock crosses an hour boundary mid-
  session; the page does not auto-refresh the date line either. Closing
  and reopening the page picks up the new date.
- **All sections empty simultaneously**: Today, Upcoming, and Suggested
  Actions each render their distinct empty state side-by-side; greeting
  still renders.
- **An application with a future-dated `applied` timeline entry**: that
  entry projects into the Upcoming list and the appropriate future cell;
  it does not affect the `followup` suggestion's "≥ 7 days old" trigger
  because that rule only counts past `applied` entries.

---

## Data Considerations

### Projection (read-only, computed at render time)

The Calendar reads `application.timeline[]` from every non-deleted
application and projects each entry into a `DayActivity`:

```
DayActivity = {
  id:      Application.id,
  title:   derived from timeline entry text → status label → application jobTitle,
  company: Application.companyName,
  status:  TimelineEntry.status,
}
```

`DayActivities` is a `Record<"YYYY-MM-DD", DayActivity[]>` computed once
per render cycle. The Calendar never writes to this structure and never
caches it across application data changes; mutations come through the
Application Overlay and re-trigger the render.

### Required application fields used

Read-only access to existing fields only:

- `id` (positive integer; constitution-required)
- `companyName` (constitution-required)
- `jobTitle` (constitution-required)
- `status` (constitution-required)
- `lastStatusUpdate` (constitution-required, used by Mark Ghosted)
- `timeline[]` (from feature 025)

No new required fields. No new optional fields.

### Mark Ghosted write path

Mark Ghosted is the only write path the Calendar exposes. It must:

- Validate `current status → ghosted` via the existing `TRANSITIONS` map
  in `src/models/application.js`. If invalid, the action fails safely
  with a non-disruptive notice.
- Reuse the existing application-update path (local SQLite + hosted
  Supabase) — no Calendar-specific persistence code.
- Reuse the existing Timeline append path (feature 025) — same
  validation, same ID allocation, same sort order.
- Bump `lastStatusUpdate` to today (`YYYY-MM-DD`, local time).
- Be atomic: if any part fails, no partial state is persisted.

### Suggestion dismissals

Stored in browser `localStorage` under a single key per user identity:

```
key:   "alice:calendar:dismissals:{userIdentityToken}"
value: JSON array of { appId: number, kind: SuggestionKind, dismissedAt: "YYYY-MM-DD" }
```

- In hosted mode, `userIdentityToken` is the authenticated user's
  Supabase `auth.user.id` UUID — the same per-user scoping key used by
  feature 019. In local mode, the token is the constant `"local"`.
- **In demo mode**, `userIdentityToken` is the literal `"demo"` AND
  `localStorage` is never touched — dismissals are written to an
  in-module memory bucket only, scoped to the `"demo"` key. This
  honors feature 020's FR-004 ("no persistent client-side state for
  the visitor"). The bucket lives for the JS context lifetime; page
  refresh (which exits demo per feature 020) resets it. Intra-tab
  re-entries of demo without refresh may inherit the prior demo
  session's in-memory dismissals — accepted minor edge.
- Dismissals are write-once-per-{appId,kind}; re-dismissing a re-fired
  suggestion overwrites the existing record's `dismissedAt`.
- Dismissals are never displayed to the user and never round-tripped
  through the server. Cross-device sync is **explicitly out of scope**.
- If `localStorage` is unavailable or throws, dismissal state is
  in-memory only for the session; no error dialog is shown.

### Date handling

- All Calendar date arithmetic uses local-time `YYYY-MM-DD` strings,
  consistent with the Timeline data model (feature 025).
- ISO 8601 week numbering for the gutter — implementation must not fall
  back to a locale-dependent (US Sunday-start) week numbering scheme.
- Year range: `[2020, currentYear + 5]`. Activities outside this range
  exist in data but are not reachable via Calendar navigation.

### No new server-side data

- No new SQLite tables, columns, or indexes.
- No new Supabase tables, columns, or RLS rules.
- No migration. No seed changes (existing demo / hosted-starter timelines
  from feature 025 are sufficient to populate the Calendar).

---

## Deferred Questions

These are deferred — low impact, not blocking `/speckit.plan`.

1. ISO Monday-start vs locale: design §16 mandates ISO 8601 Monday-start
   regardless of browser locale. Confirm there are no locales / regions
   for which a Sunday-start would be required. (Design explicitly mandates
   ISO; brief agrees; no evidence of a locale requirement to the contrary.)
