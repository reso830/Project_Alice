# Project Alice — Calendar Design Spec

> Authoritative spec for the **Calendar** page across desktop, tablet, and mobile. Written for coding agents (Claude, Codex). Source of truth wins over any rendered file when they disagree.

**Files:**
- `Calendar.html` — HTML shell, design tokens, CSS, tweak defaults, mounts `<CalendarPage>`
- `calendar-app.jsx` — full React app (data, components, state)
- `tweaks-panel.jsx` — shared Tweaks UI

**Related specs (read first):**
- [`docs/design/tracker.md`](tracker.md) — chrome (topbar / footer), color tokens, status system
- [`docs/design/application_timeline.md`](application_timeline.md) — the Timeline data model the Calendar projects from

---

## 1. Purpose & Architectural Direction

The Calendar is **not** a generic productivity planner or a Google-Calendar clone. It serves four roles:

1. A **visualization layer** for application activity over time
2. A **temporal view** of Timeline entries
3. A lightweight **operational dashboard** (Today / Upcoming / Suggested actions)
4. A **contextual workflow assistant** (rule-based suggestions)

### Timeline-centric data flow

```
Application
└── Timeline Entries (canonical)
    └── Calendar Projection (derived; no separate CRUD)
```

- Timeline entries remain the only canonical record.
- Calendar "events" are derived from Timeline entries at render time.
- **No separate event CRUD.** Adding, editing, or deleting always happens through the Application Overlay; the Calendar is never an editor.
- This avoids sync issues, duplicate editing paths, and stale data.

---

## 2. Page Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ Topbar  (shared chrome — see tracker.md)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌── Action Panel ─────┐  ┌── Month Grid ───────────────┐   │
│  │ Greeting + date     │  │ Month nav · Today · Filter  │   │
│  │ ─                   │  │ Mon Tue Wed Thu Fri Sat Sun │   │
│  │ Today               │  │ ┌──┐┌──┐┌──┐┌──┐...        │   │
│  │  • #024  Final Int  │  │ │  ││ 1││ 2││ 3│...        │   │
│  │  • #017  Tech Asses │  │ └──┘└──┘└──┘└──┘           │   │
│  │ ─                   │  │ ... 6 weeks always ...      │   │
│  │ Suggested Actions   │  └─────────────────────────────┘   │
│  │ ─                   │                                    │
│  │ Upcoming            │                                    │
│  │  Tomorrow           │                                    │
│  │  Rest of week       │                                    │
│  └─────────────────────┘                                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Footer (shared chrome)                                      │
└─────────────────────────────────────────────────────────────┘
```

The Action Panel carries more practical day-to-day value than the grid; the grid is the visual / scanning layer.

---

## 3. Layouts & Breakpoints

| Breakpoint            | Width            | Layout                                                                                  |
|-----------------------|------------------|-----------------------------------------------------------------------------------------|
| **Wide desktop / landscape tablet** | `≥ 1200px` | Action Panel + Month Grid **side-by-side**, `minmax(0, 40fr) minmax(0, 60fr)`, 28px gap. Page max-width `1440px`. |
| **Narrow desktop / portrait tablet** | `640–1199px` | **Stacked** vertically (Action Panel above Month Grid). Page max-width `1180px`.        |
| **Mobile**            | `< 640px`        | Stacked. Compact panel padding. Smaller chips. Popovers become **bottom sheets**.       |

- Both columns are panels: `background: --surface`, `border: 1px solid --border`, `border-radius: 14px`, `padding: 22px 24px` (mobile: `18px 16px`), `box-shadow: --shadow-xs`.
- Container is `.main-grid` inside `.page-body` (max-width clamp depends on breakpoint).

---

## 4. Design Tokens

Uses tokens defined in [`docs/design/tracker.md`](tracker.md) (re-listed below for convenience).

| Token              | Value      | Calendar usage                                          |
|--------------------|------------|---------------------------------------------------------|
| `--navy`           | `#1A1A2E`  | Topbar, footer, ID pill background                      |
| `--indigo`         | `#4F46E5`  | Today cell border, picker selection, active filter, ID pill on day-row hover |
| `--indigo-hover`   | `#4338CA`  | (selected picker item hover)                            |
| `--indigo-dim`     | `#EEF2FF`  | Count badges, today cell text bg, filter active bg      |
| `--indigo-soft`    | `#F4F2FF`  | Hover backgrounds (picker items, day rows, today cell field) |
| `--bg`             | `#F4F1ED`  | Page background                                         |
| `--surface`        | `#FFFFFF`  | Panels, cells, popovers, pickers                        |
| `--border`         | `#E8E3DA`  | Cell + panel + chip borders, dividers                   |
| `--border-2`       | `#D1CCB9`  | Cell border on hover                                    |
| `--t1` … `--t4`    | (greys)    | Text tiers                                              |
| `--danger`         | `#EF4444`  | Dismiss icon hover, clear-filter button hover           |
| `--danger-bg`      | `#FFF5F5`  | Dismiss / clear-filter hover backgrounds                |

Cell weekend tint: `#FBF9F4` (in-month) / `#F7F3EC` (out-of-month).
Out-of-month cells (general): `#FAF7F1`.

### Typography
- **Sora** 500/600/700 — UI, headings, row titles, picker months/years
- **DM Mono** 400/500 — meta lines, dates, IDs, counts, DOW labels, chip numbers

### Radii / Shadows
| Token | Value |
|---|---|
| `--r-xs` | 4px |
| `--r-sm` | 6px |
| `--r-md` | 10px |
| `--r-lg` | 14px |
| `--shadow-xs` | `0 1px 2px rgba(26,26,46,.05)` |
| `--shadow-sm` | `0 1px 4px rgba(26,26,46,.06), 0 2px 8px rgba(26,26,46,.04)` |
| `--shadow-md` | `0 4px 16px rgba(26,26,46,.09), 0 1px 4px rgba(26,26,46,.05)` |
| `--shadow-lg` | `0 12px 40px rgba(26,26,46,.14), 0 4px 12px rgba(26,26,46,.06)` |

---

## 5. Status System

Reuses the canonical palette from [`docs/design/tracker.md § Status System`](tracker.md). The Calendar exposes statuses in:

- Cell **numbered chips** (background = `borderAccent`, text = badge text color)
- Day popover **status badges** (full label pill, same colors)
- Status **filter dropdown** swatches
- Filter chip swatch when active

### Chip priority order (highest visual priority first)

```
1. Accepted
2. Offer
3. Interview
4. Technical Assessment
5. Phone Screen
6. Wishlisted
7. Applied
8. Rejected
9. Withdrawn
10. Ghosted
```

This drives **both** the in-cell chip order and the order in the filter dropdown. Sorting must be stable on this exact array.

---

## 6. Components

### 6.1 Greeting Header

Top of the Action Panel.

- Headline (`.greeting-h`): Sora 600, `22px` (mobile 19px), letter-spacing `-.2px`, color `--t1`.
- Subline (`.greeting-sub`): DM Mono 11px, `--t3`, formatted `Wed · May 20, 2026`.
- **Time-aware greeting** computed once at mount via `getTimeAwareGreeting()`:
  | Hour range | Pool                                                              |
  |------------|-------------------------------------------------------------------|
  | 05–11      | "Good morning,", "Morning,", "Rise and shine,", "Bright and early," |
  | 12–16      | "Good afternoon,", "Afternoon,", "Mid-day check-in,"              |
  | 17–21      | "Good evening,", "Evening,", "Winding down,"                      |
  | 22–04      | "Burning the midnight oil?", "Late night session,", "Night owl mode," |
  Plus three neutral entries appended to every pool: "Here's what we have today,", "Today at a glance,", "Welcome back,". Final selection is uniform-random across the merged pool.

### 6.2 Section Header (Today / Suggested Actions / Upcoming)

`.section-h` — flex row:
- Left: `.lbl` (Sora 13/600) followed by `.count` pill (DM Mono 10/500, `--indigo-dim` bg, `--indigo` text, `2px 8px`, `border-radius: 999px`).
- Right: `.hint` (DM Mono 10, `--t3`).

The count pill is **suppressed when the section is empty**.

### 6.3 Activity Row (`.row`)

Used in Today, Suggestions, Upcoming, and (visually echoed) the day-popover status-mode rows.

```
grid-template-columns: 48px  minmax(0, 1fr)  auto
                       ID    body            actions
gap: 12px
border-bottom: 1px solid --border
padding: 11px 0
```

- **ID pill** (`.id-pill`): `#024` format (zero-padded 3 digits), DM Mono 10/500, `--navy` bg, white text, `border-radius: 999px`, padding `3px 9px`. `width: fit-content` so it sits flush left in its 48px column.
- **Body**:
  - `.title` — Sora 13.5/500, `--t1`, line-height 1.35
  - `.meta` — DM Mono 10.5, `--t3`, single-line truncate (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`). Format: `Company · Role`. The separator uses `.sep` with `--t4` color, `0 6px` margin.
- **Actions** — see below.

#### Action buttons

| Variant | Class | Size | Use |
|---|---|---|---|
| Icon-only | `.act-icon` | 30×30 | `open` (↗), `dismiss` (×) |
| Text | `.act-btn` | `6px 11px` | `Mark ghosted` |

Default state: `border: 1px solid --border`, `background: --surface`, `color: --t3` (icon) / `--t2` (text).
Hover: border + color → `--indigo`, bg → `--indigo-dim` (icon) / `--indigo-soft` (text), `transition: all .14s ease`.
Danger modifier (`.act-icon.danger`): hover border + color → `--danger`, bg → `--danger-bg`.

Action mapping:
- **Today / Upcoming rows** → `[open ↗]` only. These are real Timeline events; they cannot be dismissed.
- **Suggestion rows** → `[primary] [dismiss ×]`.
  - Default primary: `[open ↗]` opens the Application Overlay.
  - Ghosted-conversion suggestion only: primary is `[Mark ghosted]` text button (specific destructive action — deserves explicit affordance).
- Row click does **not** open the application. Only the action button does.

### 6.4 Upcoming Sub-groups

Two groups only — `Tomorrow` and `Rest of week`. No "Next Week" / "Later".

- `.upc-group-h` — flex row with `.lbl` (DM Mono 10 uppercase 0.8px tracking, `--t3`) and `.dash` (dashed flex-grow rule).
- Group labels format:
  - `Tomorrow · Thu May 21`
  - `Rest of week · thru Sun May 24`

### 6.5 Empty States

When a section has zero items, render `<EmptyState>` instead of the row list:

```
.empty {
  text-align: center;
  padding: 24px 16px;
  flex column, gap 6px, items center
}
.glyph: 36×36 round, --indigo-soft bg, --indigo color, 16px symbol
.h:    Sora 13/500, --t1
.sub:  DM Mono 10.5, --t3, line-height 1.55, max-width 280px
```

| Section          | Glyph | Headline                 | Sub                                                                 |
|------------------|-------|--------------------------|---------------------------------------------------------------------|
| Today            | `○`   | "Quiet day"              | "Nothing on today. Enjoy the breather."                             |
| Suggested        | `⊙`   | "You're caught up"       | "No suggestions right now. We'll surface new ones as activity ages." |
| Upcoming         | `—`   | "Nothing scheduled"      | "No upcoming timeline events tomorrow through end of week."         |

The count pill in the section header is hidden when empty.

### 6.6 Month Grid Header (`.grid-header`)

Flex row, wraps on narrow widths:

```
[ ‹ ]   [ May ] [ 2026 ▾ ]   [ › ]    [Today*]    ←gap→    [Status: All ▾]
```

- **Prev / Next month** (`.cal-nav-btn`): 30×30 square, border `--border`, hover ring `--indigo` + bg `--indigo-soft`. Disabled at `YEAR_MIN, Jan` (prev) and `YEAR_MAX, Dec` (next).
- **Month name** (`button.yr` inside `.cal-title`): Sora 18/600 (mobile 16), padding `4px 8px`, hover bg `--indigo-soft`, color → `--indigo`. Click opens **Month Picker**.
- **Year** (`button.yr` with `.yr` class): same control, Sora 18/500, color `--t3`. Click opens **Year Picker**.
- **Caret** glyph (`IconChevDown` 9px) sits after the year only, color `--t3`.
- **Today button** (`.today-btn`): conditional, visible **only when the viewed month is not the current month**. `padding: 6px 14px`, font 11/500 (mobile 10), border `--border`, hover ring `--indigo`. Clicking it returns the view to `TODAY.y, TODAY.m`.
- **Status Filter chip** (`.filter-chip`): right-aligned via `.filter-area { margin-left: auto }`. Two states:
  - Idle (`Status: All`) — neutral border + text.
  - Active (`{Status}` + swatch dot) — border + text `--indigo`, bg `--indigo-dim`.
  - When active, an adjacent **clear** button (`.filter-clear`) appears: 30×30 icon button, hover `--danger` ring + `--danger-bg`.

### 6.7 Day-of-week Header (`.dow-row`)

8-column grid (`auto` for the leading CW column + `repeat(7, 1fr)` for the days), `gap: 6px` (mobile 3px). Each `.dow-cell` is DM Mono 10 uppercase 0.7px tracking, `--t3`, centered. 

- **Column 1 — `CW`** label (the calendar-week gutter, see §6.8.1). Right-aligned, same typographic treatment as the day labels.
- **Columns 2–8** — ISO Monday-start day labels: `Mon Tue Wed Thu Fri Sat Sun`.

### 6.8 Month Grid (`.cal-grid`)

- 8-column grid (`auto` CW gutter + `repeat(7, 1fr)` days), `gap: 6px`.
- **Always renders exactly 6 weeks** (6 CW cells + 42 day cells = 48 children) so the layout doesn't reflow when month length changes.
- Leading cells from previous month and trailing cells from next month both render with `.cal-cell--out` styling.
- ISO Monday-start. Convert `Date.getDay()` (Sun=0..Sat=6) to ISO (Mon=0..Sun=6) via `(getDay() + 6) % 7`.
- Each row is composed as: `[CW cell] [day] [day] [day] [day] [day] [day] [day]`. CW cells repeat once per week, derived from any one of the 7 days in that row (use the Monday for canonical mapping).

#### 6.8.1 Calendar Week column (`.cal-cw`)

A thin gutter on the leftmost side showing the **ISO 8601** week number for each row.

```
display: flex; align-items: flex-start; justify-content: flex-end
padding-top: 10px
padding-right: 4px
min-width: 28px (mobile 22px)
font: DM Mono 10/500 (mobile 9px)
color: --t4
background: transparent
user-select: none
```

- Content: the ISO week number for that row, e.g. `18`, `19`, `20`. Just the digits — the `CW` header in the DOW row explains the label.
- **Year boundary handling:** ISO week numbers can roll over inside a month (e.g. Dec 30 belongs to W01 of the next year; Jan 2 may belong to W52 of the previous year). The cell shows the correct ISO week number even when it differs from the displayed view year. No year prefix; the surrounding day cells already disambiguate.
- **Tooltip (optional):** `title="Week N, {year}"` so a hover surfaces the year for ambiguous boundary weeks.
- Non-interactive. No hover state, no click target.

#### 6.8.2 ISO Week Number Algorithm

```ts
function isoWeekNumber(year: number, month: number, day: number): number {
  // First week of the year = the week containing the first Thursday (≡ the week
  //   containing Jan 4 ≡ the first week with at least 4 days in the new year).
  // Mon=1 … Sun=7 (per ISO 8601).
  const d = new Date(Date.UTC(year, month, day));
  const dayNum = d.getUTCDay() || 7;        // JS Sun=0 → treat as 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // shift to the Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}
```

Use this for both the column labels and any future week-scoped queries. Do **not** use locale-dependent week numbering libraries that fall back to US (Sunday-start, week-1-contains-Jan-1) conventions — those are wrong here.

#### Cell (`.cal-cell`)

```
min-height: 96px (mobile 64px)
padding: 8px (mobile 5px 5px 6px)
border: 1px solid --border
border-radius: --r-sm (6px) (mobile 5px)
background: --surface
display: flex column, gap: 6px (mobile 3px)
cursor: pointer (only when activities > 0)
transition: border-color .14s, box-shadow .14s, transform .14s
```

States:
| State | Treatment |
|---|---|
| Hover (default cell w/ activity) | border `--border-2`, shadow `--shadow-sm`, `translateY(-1px)` |
| `.cal-cell--out` (out-of-month) | bg `#FAF7F1`. Day number color `--t4`. Chips still render. |
| `.cal-cell--weekend` | bg `#FBF9F4` (in-month) / `#F7F3EC` (out-of-month). |
| `.cal-cell--today` | border `--indigo`, bg `--indigo-soft`. Day number = solid `--indigo` pill with white text. |
| `.cal-cell--filter-hidden` | When a filter is active and the cell has activities but **none** match the filter: `opacity: 0.35` (cell still scrolls into view but feels muted). |

Cells with **zero activities** are non-interactive (no hover lift, no click handler, no `role`).

#### Day number (`.cal-num`)

DM Mono 11/500, `--t2`, `align-self: flex-start`. Round pill shape (22×22 min, padding `0 4px`) so the today indicator slots cleanly into the same chrome.

#### Numbered chip (`.num-chip`)

The **primary status indicator inside a cell**. One chip per distinct status present that day.

```
min-width: 22px (mobile 18px)
height: 18px (mobile 14px)
padding: 0 6px (mobile 0 4px)
border-radius: 999px
font: DM Mono 10.5/600 (mobile 9px)
background: STATUSES[k].bg
color:      STATUSES[k].fg
border: 1px solid rgba(0,0,0,.04)   ← faint contour so light chips read on white
cursor: pointer
transition: transform .12s, box-shadow .12s
hover: translateY(-1px), shadow 0 2px 6px rgba(26,26,46,.18)
```

Chip content = the count of activities for that status that day. No text label inside the chip — the color carries the identity (tooltip on hover gives the status name).

**Order within a cell:** sorted by the priority list from §5. Max **3** visible chips per cell. If more statuses are present, render a 4th element: `.num-more` chip = `+N` (dashed neutral). `+N` overflow click opens the **full day popover** (same surface as clicking the date number).

### 6.9 Day Popover (`.day-pop`)

Anchored to the trigger element (cell or chip) on desktop, becomes a bottom sheet on mobile (< 640px).

Two modes:

| Mode | Trigger | Content |
|---|---|---|
| `status` | Clicking a numbered chip | All activities for that day **filtered to that status**. Rows use `IdPill` on the left. |
| `all`    | Clicking the date number OR the `+N` overflow chip | All activities for that day, grouped by status priority. Rows use the full `StatusBadge` on the left. |

Structure:
```
.day-pop  (width 360px desktop, 100% mobile bottom-sheet, max-height 460px desktop / 80vh mobile)
├── .day-pop-h   (14/16 padding, bottom border)
│   ├── .ttl    Sora 14/600 — e.g. "Tue, May 19 · Applied (5)"
│   │   └── .count  --t3, weight 500 — the "(N)" portion
│   └── .close  26×26, --bg bg, hover --border bg
├── .day-pop-body  (scrolls; padding 6px 0)
│   └── .day-row × N  (grid: auto | 1fr | auto = badge/id | body | arrow)
│       Row click → opens Application Overlay (TBD wiring)
│       hover bg --indigo-soft
└── .day-pop-foot  (#FAFAF8 bg, top border)
    "Row click → opens application"   "View in Tracker →"
```

Title format:
- Status mode: `{Pretty date} · {Status} (N)` — e.g. `Tue, May 19 · Applied (5)`
- All mode:    `{Pretty date} · All activity (N)`
  Pretty date = `toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })` → `Tue, May 19`.

### 6.10 Month Picker (`.picker`)

```
width: 260px desktop, 100% (bottom sheet) mobile
padding: 12px 14px
```

Header (`.picker-h`):
- Left: `.lbl` — "Jump to month" (DM Mono 10 uppercase)
- Right: `.yr` — current year (DM Mono 11, `--t2`)

Body (`.picker-grid`):
- 3-column grid of `.picker-item` buttons, one per month (Jan…Dec).
- States:
  - default — DM Mono 11.5/500, `--t2`, transparent
  - hover — bg `--indigo-soft`, color `--indigo`
  - `--picker-item--current` — the system's actual current month (when `viewYear === currentY && index === currentM`), bordered + bg `--bg`, weight 600
  - `--picker-item--selected` — the month currently being viewed, solid `--indigo` bg, white text, weight 600
- Selecting a month updates `view.m`, **keeps the year**, and closes the picker.

### 6.11 Year Picker (`.picker`)

Same shell as the month picker but the body shows **12 years at a time** with decade navigation.

Header:
- Left: `.lbl` — "Jump to year"
- Right: `.yr-nav` — `[‹] {startYear} – {startYear+11} [›]`

Range navigation buttons:
- Each `22×22` icon button (`<` `>`), border `--border`, hover ring `--indigo`.
- Prev disabled when `start ≤ YEAR_MIN`.
- Next disabled when `start + 12 > YEAR_MAX`.

Initial `start` = `clamp(viewYear - 5, YEAR_MIN, YEAR_MAX - 11)`. So the current view year sits roughly mid-grid.

Body — `.picker-grid` of 12 years:
- Same states as Month Picker (`current`, `selected`).
- Years outside `[YEAR_MIN, YEAR_MAX]` render `.picker-item--disabled` (`opacity: .5`, `cursor: not-allowed`).

Selecting a year updates `view.y`, **keeps the month**, and closes the picker.

### 6.12 Status Filter Dropdown (`.filter-dd`)

Anchored to the filter chip with `align: "end"` (right-aligned). On mobile becomes a bottom sheet.

- Padding `6px`, min-width `196px`.
- First row: **"All statuses"** with `.none-glyph` (an empty circle outline) and the `IconCheck` showing only when nothing is selected.
- Following rows: one per status, in **priority order**. Each row:
  ```
  grid-template-columns: 14px auto 1fr
                         check | swatch | label
  ```
  Swatch = 8×8 round, `background: STATUSES[k].bg`. (Ghosted's `#ced4da` swatch gets a 1px `--border` so it doesn't disappear on white.)

Hover bg `--indigo-soft`. Active row uses `--indigo` for text + check.

### 6.13 Anchored Dropdown (`<AnchoredDropdown>`)

A shared positioning + outside-click + Escape primitive used by the four popovers above.

Props:
| Prop | Type | Notes |
|---|---|---|
| `anchorRect` | `DOMRect` | Bounding rect of the trigger element. Used for positioning on desktop. |
| `align` | `"start" \| "end"` | Horizontal alignment relative to the anchor. Default `start`. |
| `asBottomSheet` | `boolean` | When true, the dropdown switches to a bottom sheet at `< 640px`. |
| `scrim` | `boolean` | Adds a semi-transparent backdrop on mobile bottom-sheet form. |
| `onClose` | `() => void` | Closes the dropdown. Wired to backdrop click + Escape key. |

Behavior:
- After mount, measures itself and the anchor. Positions `top = anchorRect.bottom + 6`. Clamps horizontally to viewport (8px margin). If it would overflow the viewport bottom, flips above the anchor.
- Backdrop is `position: fixed; inset: 0`, transparent by default, scrim variant on mobile uses `rgba(8,8,24,.42)`.
- Escape key (`keydown`) closes.
- On mobile (`< 640px`) + `asBottomSheet`, switches to:
  ```
  position: fixed; left: 0; right: 0; bottom: 0;
  border-radius: 14px 14px 0 0
  max-height: 80vh
  animation: bsIn .22s cubic-bezier(.2,.7,.3,1.05)   ← translateY(100%) → 0
  ```
  Drag handle (`.bs-handle`) — 38×4 round, `--border` color, 8px top margin / 6px bottom margin — rendered automatically by the dropdown when in bottom-sheet mode.

### 6.14 Toast

Reuses the toast pattern from [`docs/design/tracker.md § Toast`](tracker.md): pill at bottom-center, `--navy` bg, white text, green dot, 2200ms auto-dismiss. Used for action confirmations (e.g. "Marked #011 as Ghosted", "Open application #024 (overlay TBD)").

---

## 7. Suggested Actions — Engine Rules

Suggestions are **deterministic**, **rule-based**, and **locally computed**. No LLM. The Calendar reads them from a synchronous computation over the application list.

### Visibility rules

A suggestion is shown only if it is:
- **Newly triggered today**, OR
- **Relevant today**, OR
- **Relevant tomorrow**

Anything older or further out is suppressed.

### Suppression

A suggestion is **not** shown if any of:
- A future Timeline entry already exists on that application
- The user has dismissed it before (persistent, see §10)
- The application is in a terminal state (Accepted / Rejected / Withdrawn / Ghosted)

### Rules

| Status        | Trigger                                                | Suggestion copy                                       | Primary action      |
|---------------|--------------------------------------------------------|-------------------------------------------------------|---------------------|
| Applied       | Last activity = Applied, ≥ 7 days old, no newer updates | "Follow up with recruiter?"                          | `open`              |
| Phone Screen  | Phone Screen completed, ≥ 5 business days, no updates  | "Check interview feedback status?"                   | `open`              |
| Interview     | Interview completed, ≥ 7 days, no updates              | "Consider sending a follow-up message"               | `open`              |
| Assessment    | Deadline today or tomorrow                             | "Technical assessment due tomorrow"                  | `open`              |
| Offer         | Offer active, nearing expiry, no accepted/rejected     | "Offer response may be needed soon"                  | `open`              |
| **Ghost-flag** | No updates ≥ 14 days · status not terminal · no future entry · not previously dismissed | "No updates for 14 days. Mark as Ghosted?" | **`Mark ghosted`** (text) |

#### Mark Ghosted action

Clicking `Mark Ghosted`:
1. Updates the application's `status` → `ghosted`
2. Appends a Timeline entry: `{ date: today, status: "ghosted", text: "Marked as ghosted after prolonged inactivity." }`
3. Persists immediately (no draft, no Save step)

Note: **Archive is not offered** in the Ghost suggestion. The user can archive later from the Tracker if they want; the Calendar refuses to pile decisions into one prompt.

#### Tone / Copywriting rules

Avoid:
- Red banners, alert visuals
- "You got ghosted" or other emotionally loaded language
- Definitive assumptions about outcomes

Prefer:
- Compact rows, neutral styling
- Question form ("Follow up with recruiter?", "Mark as Ghosted?")
- Factual meta ("7d since application", "14 days · last touched May 6")

---

## 8. Interactions

| Surface | Trigger | Behavior |
|---|---|---|
| Action Panel row (any) | Click `open ↗` icon | Opens **Application Overlay** for that `id`. Row body itself is not clickable — only the action button. |
| Suggestion row | Click `× dismiss` | Marks suggestion dismissed permanently; row exits with no toast (or quiet toast — TBD). |
| Suggestion row (Ghost flag) | Click `Mark ghosted` text button | Runs the Mark Ghosted action (§7). Toast: "Marked {ID} as Ghosted". |
| Month grid cell (has activities) | Click anywhere in the cell, **but not on a chip** | Opens day-popover in `all` mode anchored to the cell. |
| Month grid cell (zero activities) | Click | No-op (cursor stays `default`, no hover lift). |
| Numbered chip | Click | Opens day-popover in `status` mode anchored to the chip. `stopPropagation()` so the cell's all-mode handler doesn't also fire. |
| `+N` overflow chip | Click | Opens day-popover in `all` mode (same as clicking the date number). |
| Day-popover row | Click | Closes popover and opens Application Overlay for that `id`. |
| Day-popover close | Click `×` or backdrop | Closes popover. |
| Month name | Click | Opens Month Picker anchored to the title. |
| Year | Click | Opens Year Picker anchored to the title. |
| Month Picker / Year Picker | Pick a value | Updates `view.{y/m}`, **keeps the other dimension**, closes picker. |
| Today button | Click | Sets `view = { y: TODAY.y, m: TODAY.m }`. Only visible off-current-month. |
| Prev / Next month arrows | Click | Walks `view` by ±1 month. Clamped to `[YEAR_MIN, Jan]` / `[YEAR_MAX, Dec]`. |
| Filter chip | Click | Opens Status Filter dropdown anchored to the chip. |
| Filter dropdown row | Click | Sets `statusFilter`, closes dropdown. Filter chip re-renders in active state. |
| Filter Clear (×) | Click | Sets `statusFilter = null`. Hides itself. |
| Backdrop | Click | Closes whichever popover/picker is open. |
| Esc key | Press | Closes whichever popover/picker is open. |
| Topbar nav | Click | Standard cross-page navigation (see tracker.md). |

### Filter behavior on the grid

- When `statusFilter` is non-null, each cell's chip set is computed against the filtered activity list.
- Cells where the day has *some* activities but **none** match the filter render `.cal-cell--filter-hidden` (35% opacity). They remain present so the layout is stable; they're just visually demoted.
- The Action Panel is **not** affected by the grid filter — the filter only narrows the grid.

### Filter behavior on the day popover

Independent of the global filter:
- The `status` mode popover is always scoped to the clicked chip's status (regardless of grid filter).
- The `all` mode popover always shows every activity for that day (regardless of grid filter).

---

## 9. Date Constraints

- `YEAR_MIN = 2020`
- `YEAR_MAX = currentYear + 5` (resolves to `2031` in this build)
- All navigation surfaces (arrows, pickers) must respect this range. Out-of-range years in the Year Picker render disabled. Out-of-range months on the boundaries (e.g. Dec 2031 → Jan 2032) disable the next-month arrow.

---

## 10. Persistence

### `lastSuggestionDismissals`

Permanent record of dismissed suggestions, keyed `{appId}_{suggestionKind}`:

```ts
type SuggestionDismissal = {
  appId: number;
  kind: "followup" | "feedback" | "interview_followup" | "assessment_due" | "offer_expiry" | "ghost";
  dismissedAt: string; // ISO date
};
```

Once dismissed, the rule that produced it is **suppressed forever** for that application — until the underlying state changes enough that the rule's trigger condition no longer matches (e.g. status moves off Applied), at which point a new dismissal record is needed if the rule re-fires.

### View state

`view.y`, `view.m`, and `statusFilter` are **session-local**. They do not persist across page loads. Default to `{ TODAY.y, TODAY.m }` and `null`.

---

## 11. Mobile (< 640px)

- Action Panel + Month Grid stack vertically (panel first).
- Panels reduce to `18px 16px` padding, `border-radius: 10px`.
- Greeting headline drops to 19px.
- Cell `min-height: 64px`; padding `5px 5px 6px`; gap `3px`. Day number 10px in an 18×18 pill.
- Chips: `min-width: 18px; height: 14px; font-size: 9px`. `+N` overflow ditto.
- DOW labels drop to 9px.
- Topbar pads to 14px.
- Popovers and pickers all become **bottom sheets** (see §6.13).

> **Open question:** On very narrow viewports, the Action Panel can be long. Per earlier wireframe discussion the intended pattern is a **collapsible summary bar** ("Today · 2 events · 3 suggestions · tap to expand") pinned at the top. This is **not yet implemented in v1** — the panel currently flows inline. Add this in v2 if the panel turns out to dominate the viewport.

---

## 12. Tweaks

Exposed via the floating Tweaks panel (toggle in the top toolbar). Defaults live in the `EDITMODE-BEGIN/END` block in `Calendar.html`.

| Key                  | Type    | Default | What it does                                                |
|----------------------|---------|---------|-------------------------------------------------------------|
| `todayEmpty`         | boolean | `false` | Renders the Today section in its empty state                |
| `suggestionsEmpty`   | boolean | `false` | Renders the Suggested Actions section in its empty state    |
| `upcomingEmpty`      | boolean | `false` | Renders the Upcoming section in its empty state             |
| `filterActive`       | boolean | `false` | Sets `statusFilter = "interview"` so the grid shows filtered/faded cells |
| `offCurrentMonth`    | boolean | `false` | Jumps `view.m` to the next month so the Today button appears |

These are **review-only**. They do not gate production behavior — when shipping, every section will compute its empty state from real data.

---

## 13. Data Model

### `DAY_ACTIVITIES`

```ts
type DayActivity = {
  id: number;          // application id (links back to the canonical row)
  title: string;       // event/activity title (e.g. "Final Interview", "Take-home submitted")
  company: string;     // denormalized for display
  status: StatusKey;   // the activity's status — drives the chip color + popover badge
};

type DayActivities = Record<string /* "YYYY-MM-DD" */, DayActivity[]>;
```

This is the **projection layer**. It is computed from `application.timeline[]` (see [`application_timeline.md`](application_timeline.md)) — never written to directly. A naive projection:

```ts
function projectTimelineToCalendar(apps: Application[]): DayActivities {
  const out: DayActivities = {};
  for (const app of apps) {
    for (const entry of app.timeline) {
      (out[entry.date] ??= []).push({
        id: app.id,
        title: deriveActivityTitle(entry, app),  // see below
        company: app.companyName,
        status: entry.status,
      });
    }
  }
  return out;
}
```

`deriveActivityTitle()` falls back through:
1. The timeline entry's `text` if non-empty and short enough
2. A canned label for the entry's `status` ("Interview", "Phone Screen", "Take-home submitted", …)
3. The application's `jobTitle`

### `TODAY_EVENTS`, `UPCOMING_TOMORROW`, `UPCOMING_WEEK`

Same shape, plus a `role` field (the job title used in the meta line):

```ts
type PanelRow = {
  id: number;
  title: string;
  company: string;
  role: string;
};
```

### `SUGGESTIONS`

```ts
type Suggestion = {
  id: number;          // application id
  kind: SuggestionKind;
  title: string;       // primary copy
  meta: string;        // secondary copy (e.g. "7d since application")
};

type SuggestionKind = "followup" | "feedback" | "interview_followup" | "assessment_due" | "offer_expiry" | "ghost";
```

The `kind` field is what powers the action selection (Mark ghosted vs. open) and the persistent dismissal key.

---

## 14. Accessibility

- All interactive surfaces are reachable by keyboard. Cells with activities are `role="button" tabIndex={0}`; chips are `role="button" tabIndex={0}`; pickers and popovers are focusable buttons inside a `role="dialog" aria-modal="true"` shell.
- `aria-label` on cells: `"{Pretty date}, {N} activity/activities"` when activities exist, otherwise no label (the day number is the visible text).
- `aria-label` on chips: `"{Status label}, N entries. Click to view."`
- CW gutter cells: `aria-hidden="true"` — they're a navigational hint, not content; screen readers should skip them. The `CW` header label is also `aria-hidden="true"`.
- Active page in the topbar nav: `aria-current="page"`.
- Esc closes any open popover regardless of focus location.
- Status colors are **never** the only encoder of meaning — every chip carries the count number and the popover row carries the status label. Colorblind users can still distinguish via the popover.

---

## 15. Out of Scope (Future Iterations)

- **Week view** — explicitly punted. Month-only for v1.
- **Drag-to-create events** — Calendar is not an editor; this would violate the timeline-centric principle.
- **External calendar integration** (Google / Outlook / iCal export) — out of scope. Today rows show no "video link" or external-event metadata.
- **AI / LLM-driven suggestions** — explicitly not planned. Suggestions must remain deterministic.
- **Attachment per timeline entry** — see `application_timeline.md § Open items`.
- **Per-day note** — distinct from per-entry notes. Punted.
- **Mobile collapsible summary bar** for the Action Panel (mentioned in §11).
- **Filter URL persistence** — would let users share a "Calendar with Interview filter" link. Nice-to-have, not v1.

---

## 16. Implementation Notes for Agents

- **Do not** make the Calendar a separate event store. All reads project from `application.timeline[]`.
- **Do not** add a year-range >`current + 5`. Anything beyond is unrealistic for a job-search app and breaks the picker.
- **Do not** change the chip priority order without updating both the in-cell sort *and* the filter dropdown order — they must match.
- **Do not** introduce additional row actions (`archive`, `star`, etc.) into Action Panel rows. Those belong to the Application Overlay. Calendar rows have at most one primary + one dismiss.
- **Do not** localize the Mon-start week. ISO 8601 is the explicit choice; respect it even if the user's OS locale defaults to Sunday-first.
- **Do** preserve the `data-comment-anchor` attribute on any element that has one (none in v1, but future edits may add some).
- **Do** keep the `EDITMODE-BEGIN/END` JSON block valid (double-quoted keys/strings) — the host rewrites it on tweak changes.
- Style objects: when adding new components, give them component-specific names (e.g. `dayPopStyles`) — never a bare `const styles = {}`.
- **Application Overlay wiring** is the single biggest TODO. The current `onOpenApp(id)` handler fires a toast. Replace with `openApplicationOverlay(id, { focusTimeline: true })` once the overlay is mounted at the app shell level.
