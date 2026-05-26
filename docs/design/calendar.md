# Project Alice — Calendar Design Spec

> Authoritative spec for the **Calendar** page across desktop, tablet, and mobile. Written for coding agents (Claude, Codex). Source of truth wins over any rendered file when they disagree.

**Files:**
- `Calendar.html` — HTML shell, design tokens, CSS, tweak defaults, mounts `<CalendarPage>`
- `calendar-app.jsx` — full React app (data, components, state)
- `tweaks-panel.jsx` — shared Tweaks UI

**Related specs (read first):**
- [`design/tracker.md`](tracker.md) — chrome (topbar / footer), color tokens, status system
- [`design/application_timeline.md`](application_timeline.md) — the Timeline data model the Calendar projects from

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

Uses tokens defined in [`design/tracker.md`](tracker.md) (re-listed below for convenience).

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

Reuses the canonical palette from [`design/tracker.md § Status System`](tracker.md). The Calendar exposes statuses in:

- Cell **numbered chips** (background = `borderAccent`, text = badge text color)
- Day popover **status badges** (full label pill, same colors)
- Status **filter dropdown** swatches
- Filter chip swatch when active

### Chip priority order (highest visual priority first)

```
1. Accepted
2. Offer
3. Interview
4. Technical          (status key: assessment)
5. Phone Screen
6. Wishlisted
7. Applied
8. Rejected
9. Withdrawn
10. Ghosted
```

This drives **both** the in-cell chip order and the order in the filter dropdown. Sorting must be stable on this exact array.

### Status label: "Technical" (was "Technical Assessment")

The `assessment` status displays as **"Technical"** in every UI surface (chips, popover/panel rows, status badges, filter dropdown, Tracker badges, Tracker quick-filter). The full phrase "Technical Assessment" overflowed in narrow chips and Tracker cards and dominated visual space. The shorter label is the **global** copy — `STATUS_CONFIG.assessment.label` is the single source of truth and must read `"Technical"`. Do not maintain a separate "long" form.

---

## 6. Components

### 6.1 Greeting Header

Top of the Action Panel.

- Headline (`.greeting-h`): Sora 600, `22px` (mobile 19px), letter-spacing `-.2px`, color `--t1`.
- Subline (`.greeting-sub`): DM Mono 11px, `--t3`, formatted `Wed · May 20, 2026`.
- **Time-aware greeting** computed once at mount via `getTimeAwareGreeting()`:
  | Hour range | Pool                                                              |
  |------------|-------------------------------------------------------------------|
  | 05–11      | "Good morning", "Morning", "Rise and shine", "Bright and early"   |
  | 12–16      | "Good afternoon", "Afternoon", "Mid-day check-in"                 |
  | 17–21      | "Good evening", "Evening", "Winding down"                         |
  | 22–04      | "Burning the midnight oil?", "Late night session", "Night owl mode" |
  Plus three neutral entries appended to every pool: "Here's what we have today", "Today at a glance", "Welcome back". Final selection is uniform-random across the merged pool. Entries are stored **without trailing punctuation** — the formatter adds the comma + name only when a name is available.

- **Name injection.** The page orchestrator reads the user's display name from the active profile (hosted: Supabase user metadata; local: profile store; demo: the demo profile's name if one is set). The formatter then composes the headline:
  - **With name**: `"{Greeting}, {Name}"` — e.g. `"Good morning, Alice"`. Question-form greetings ("Burning the midnight oil?") render as `"Burning the midnight oil, Alice?"` — comma + name inserted before the punctuation.
  - **Without name** (no profile set, hosted user with no display name, demo with no name): `"{Greeting}"` — e.g. `"Good morning"`. **No trailing comma.** A bare comma reads as a typo to the user.
  - This rule applies uniformly across hosted, local, and demo sessions.

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
Danger modifier (`.cal-act-icon--danger`): hover border + color → `--danger`, bg → `--danger-bg`.

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

### 6.6 Month Grid Header (`.cal-grid-header`)

Single flex row at every breakpoint (no wrap):

```
[ ‹ ]  [ May ]  [ 2026 ]  [ › ]    [Today*]    ←gap→    [Filter icon*]
```

- **Prev / Next month** (`.cal-nav-btn`): 30×30 square, border `--border`, hover ring `--indigo` + bg `--indigo-soft`. Disabled at `YEAR_MIN, Jan` (prev) and `YEAR_MAX, Dec` (next).
- **Month name** (`button.cal-month-btn` inside `.cal-title`): **text-style trigger** — no border, transparent background, Sora 18/600 (mobile 16), `--t1` color, padding `4px 6px`. Hover: color → `--indigo` and a subtle `--indigo-soft` bg. Click opens **Month Picker**.
- **Year** (`button.cal-year-btn`): same text-style treatment — no border, transparent bg, Sora 18/500 (mobile 16), `--t2` color, padding `4px 6px`. Hover: color → `--indigo`. Click opens **Year Picker**.
- **No caret glyph** after the year. The hover affordance is enough; the chevron caret was added in error and read as a dropdown form control.
- Month and Year are both **Sora** for visual consistency. Do not mix Sora + DM Mono in this control pair.
- **Today button** (`.cal-today-btn`): conditional, visible **only when the viewed month is not the current month**. `padding: 6px 14px`, font Sora 11/500 (mobile 10), border `--border`, hover ring `--indigo`. Clicking it returns the view to `TODAY.y, TODAY.m`.
- **Status Filter button** (`.cal-status-filter-btn`): mirrors the **Tracker quick-filter status button** (`QuickFiltersToolbar` status control). Same control across desktop and mobile:
  - Idle: 30×30 icon button with a neutral funnel/filter SVG glyph, border `--border`, `--t3` color.
  - Active: same 30×30 shape, but the glyph is replaced by an 8×8 round status swatch (`STATUS_CONFIG[status].borderAccent`); border + ring use `--indigo`.
  - Hover/focus matches `.cal-nav-btn`.
  - When active, an adjacent **clear** button (`.cal-filter-clear`) appears: 30×30 icon button, hover `--danger` ring + `--danger-bg`.
  - Right-aligned via `.cal-filter-area { margin-left: auto }`.
  - The old `.filter-chip` ("Status: All" / "Interview" text chip) is **removed** — the icon button is the only filter trigger now, on both desktop and mobile.

### 6.6.1 Header layout — single row above 375px, controlled wrap below

The header is a single row at every breakpoint **≥ 375px**:

```
[‹] [May] [2026] [›]   [Today*]                 ⟵ gap ⟶                 [Filter*]
```

- `[Today*]` is only present when the view is off the current month.
- `[Filter*]` is the icon button described above (idle = funnel glyph; active = swatch).
- The left cluster (`‹ Month Year ›`) is grouped tightly with 2px gaps; `[Today]` sits 12px to its right; `[Filter]` is pushed to the far right via `margin-left: auto`.
- On mobile (<640px and ≥375px), font sizes drop (Sora 16 for month/year; Today 10/500) and gaps tighten to 4px in the left cluster, but the row **does not wrap**.

#### Sub-breakpoint exception (<375px)

At very narrow viewports — `iPhone SE` (320px), `Galaxy Z Fold 5` cover screen (~344px), and similar — the single-row constraint breaks down: with Today visible and a status filter selected, the Month/Year text overflows under the nav arrows. Below 375px the header switches to a **controlled two-row layout**:

```
Row 1:  [‹] [May] [2026] [›]
Row 2:  [Today*]                    ⟵ gap ⟶                    [Filter*]
```

- Implementation: `.cal-grid-header { flex-wrap: wrap; }` activated only under the `@media (max-width: 374px)` query.
- Row 1 always contains the **nav cluster** (`‹ Month Year ›`) and nothing else. To pin this, the nav cluster gets `flex: 1 1 100%` at <375px so it consumes the full first row.
- Row 2 holds `[Today*]` (left) and `[Filter*]` (right, via `margin-left: auto` on the filter area). When both are present, they share the row; when only Filter is present, it floats right alone; when neither is present (current month, no active filter), Row 2 collapses to zero height.
- This is the **only** breakpoint where the header wraps. Above 375px the single-row rule still applies — do not generalize the wrap pattern upward.
- The previous 3-row mobile layout (nav · today · filter on separate lines) remains retired; the new two-row layout is narrower in scope (only <375px) and groups elements differently (nav alone vs. today+filter together).

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

> **Status:** This whole §6.9 is **superseded by §17 (v2 Inline Day Details Panel)** on desktop and mobile. The popover is no longer the production day-detail surface. The structure below is retained as the historical v1 reference for the existing implementation in `src/components/calendar/DayPopover.js`; new work should follow §17.

Structure:
```
.day-pop  (width 360px desktop, 100% mobile bottom-sheet, max-height 460px desktop / 80vh mobile)
├── .day-pop-h   (14/16 padding, bottom border)
│   ├── .ttl    Sora 14/600 — e.g. "Tue, May 19 · Applied (5)"
│   │   └── .count  --t3, weight 500 — the "(N)" portion
│   └── .close  26×26, --bg bg, hover --border bg
└── .day-pop-body  (scrolls; padding 6px 0)
    └── .day-row × N  (grid: auto | 1fr | auto = badge/id | body | arrow)
        Row click → opens Application Overlay
        hover bg --indigo-soft
```

The `.day-pop-foot` static-help footer ("Row click → opens application" / "View in Tracker →") is **removed**. The behavior is self-evident from the row hover state and arrow glyph; the footer added clutter without information.

Title format:
- Status mode: `{Pretty date} · {Status} (N)` — e.g. `Tue, May 19 · Applied (5)`
- All mode:    `{Pretty date} · All activity (N)`
  Pretty date = `toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })` → `Tue, May 19`.

### 6.10 Month Picker (`.cal-picker`)

```
width: 260px desktop, 100% (bottom sheet) mobile
padding: 12px 14px
```

Header (`.cal-picker-h`):
- **No left label.** The "Jump to month" copy was removed — the grid of months is self-evident and the label only added vertical noise.
- Right: `.cal-picker__yr` — current view year (Sora 13/500, `--t2`). Visually anchors the grid to a specific year context.

Body (`.cal-picker-grid`):
- 3-column grid of `.picker-item` buttons, one per month (Jan…Dec).
- States:
  - default — DM Mono 11.5/500, `--t2`, transparent
  - hover — bg `--indigo-soft`, color `--indigo`
  - `--picker-item--current` — the system's actual current month (when `viewYear === currentY && index === currentM`), bordered + bg `--bg`, weight 600
  - `--picker-item--selected` — the month currently being viewed, solid `--indigo` bg, white text, weight 600
- Selecting a month updates `view.m`, **keeps the year**, and closes the picker.

### 6.11 Year Picker (`.cal-picker`)

Same shell as the month picker but the body shows **12 years at a time** with decade navigation.

Header (`.cal-picker-h`):
- **No left label.** The "Jump to year" copy was removed — same reason as §6.10.
- Right: `.cal-picker__yr-nav` — `[‹] {startYear} – {startYear+11} [›]`. The `{startYear} – {startYear+11}` range text uses the **same typography as the year buttons in the grid below** — Sora 11.5/500, `--t2` — so the header range and grid options read as one continuous control. Do not use DM Mono here; mixing DM Mono in the range with Sora in the options was the source of the "messy" look.

Range navigation buttons:
- Each `22×22` icon button (`<` `>`), border `--border`, hover ring `--indigo`.
- Prev disabled when `start ≤ YEAR_MIN`.
- Next disabled when `start + 12 > YEAR_MAX`.

Initial `start` = `clamp(viewYear - 5, YEAR_MIN, YEAR_MAX - 11)`. So the current view year sits roughly mid-grid.

Body — `.picker-grid` of 12 years:
- Same states as Month Picker (`current`, `selected`).
- Years outside `[YEAR_MIN, YEAR_MAX]` render `.picker-item--disabled` (`opacity: .5`, `cursor: not-allowed`).

Selecting a year updates `view.y`, **keeps the month**, and closes the picker.

### 6.12 Status Filter Popup (shares Tracker's `QuickFiltersToolbar` status popup)

> **Surface change in v0.13.2.** The Calendar's filter trigger no
> longer opens a Calendar-specific `.filter-dd` dropdown. It opens
> the **same status-filter popup the Tracker uses** via
> `QuickFiltersToolbar` (see `design/tracker.md § Quick Filters`),
> on **all breakpoints** — desktop, tablet, and mobile. One filter
> chrome across both pages. The legacy `.filter-dd` family
> (`.filter-dd`, `.filter-dd-row`, `.filter-dd-check`,
> `.filter-dd-swatch`, `.filter-dd-label`, `.none-glyph`) is retired
> from the Calendar's filter surface as part of this change.

#### Behavior

- Triggered by the `.cal-status-filter-btn` icon button (§6.6).
  The button's `aria-expanded` reflects open/closed state and matches
  the Tracker trigger's a11y pattern.
- The popup chrome (header, scrollable option list, apply/clear
  footer, focus-trap, Esc / backdrop close) is owned by the Tracker
  filter popup component — the Calendar does **not** maintain a
  parallel implementation. New visual or behavioral changes to the
  filter popup must be made in the shared component, never branched.
- Single-select semantics on the Calendar: the popup exposes the
  same status list it shows on the Tracker, but the Calendar only
  consumes one selection (the next `onSelect` value replaces the
  previous one). "All statuses" maps to `filter: null`.
- Status options render in `STATUS_DISPLAY_PRIORITY` order with the
  Tracker-style swatch + label rows. The assessment status reads
  **"Technical"** per §5.

#### Implementation note

If `QuickFiltersToolbar`'s status popup is currently embedded inside
the Tracker page rather than a standalone shared module, the Phase
14 implementation must extract it to a shared component (placement:
`src/components/QuickFiltersStatusPopup.js` or similar) so both
pages can mount the same surface. Style-prefix scoping for the
extracted component continues to follow the Tracker's existing
class family — do not invent a new `cal-` prefix for surfaces the
Calendar inherits wholesale.

#### Mobile

No bottom-sheet variant. The Tracker popup's responsive form (which
already adapts to narrow viewports) is the canonical mobile surface.
This retires the `asBottomSheet: true` configuration the
`StatusFilterDropdown` used in v0.13.1.

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

Reuses the toast pattern from [`design/tracker.md § Toast`](tracker.md): pill at bottom-center, `--navy` bg, white text, green dot, 2200ms auto-dismiss. Used for action confirmations (e.g. "Marked #011 as Ghosted", "Open application #024 (overlay TBD)").

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
| Suggestion row | Click `× dismiss` | Marks suggestion dismissed permanently; row exits and a toast `"Suggestion dismissed"` fires (same toast component as Mark Ghosted, success variant). Closing this gap from v1 — without feedback the click felt swallowed. |
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
- Cells where the day has *some* activities but **none** match the filter render `.cal-cell--filter-hidden` (35% opacity).
- **Cells with zero activities also render `.cal-cell--filter-hidden`** when a filter is active. Originally only "has activities but none match" cells were dimmed; in practice this left empty days at full opacity while filtered-out days were dim, which read as random. With the filter active, only days that match the filter are at full opacity — every other cell (empty or non-matching) is muted.
- All cells remain present so the layout is stable; they're just visually demoted. Today, weekend, and out-of-month styling still apply underneath the dim.
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
- **Grid header is a single row** at and above 375px — same control set as desktop (`‹ Month Year › [Today*] … [Filter*]`); compact spacing only. The previous 3-row mobile header (nav line · today line · status filter line) is retired (§6.6.1).
- **Below 375px** (iPhone SE / Galaxy Z Fold 5 cover-screen class), the header wraps to **two rows**: nav cluster (`‹ Month Year ›`) on row 1, `[Today*]` + `[Filter*]` on row 2. See §6.6.1 sub-breakpoint exception for the precise rule.

### 11.1 Action Panel collapse (`<1200px` — every stacked layout)

When the Action Panel and Month Grid are stacked vertically (any viewport `<1200px` — narrow desktop, tablet portrait, mobile, folded phones), the Action Panel renders **collapsed by default**. The greeting and date stay anchored at the top; the Today / Suggested Actions / Upcoming sections fold into a single chip row that previews the counts. The full sections are one tap away.

#### Activation

- Active for **every stacked layout** at `<1200px`. The breakpoint is the same as the layout-stack breakpoint (§3) — no separate threshold.
- At `≥1200px`, the side-by-side layout applies; the collapse UI is hidden via CSS and the full panel is always visible. No collapse / expand control is rendered.
- Activation is viewport-driven, not container-driven. A `resize` listener (or `matchMedia`) gates rendering of the collapse UI.

#### Default state

- **Collapsed on every page render** at `<1200px`. Toggle state does NOT persist across reloads, route changes, or remount — held only in component state.
- If the viewport crosses the breakpoint mid-session (resize from `≥1200px` → `<1200px`), the panel re-enters its collapsed default state. Crossing the other way leaves the side-by-side layout fully expanded as always.

#### Collapsed state — anatomy

The collapsed panel has exactly two regions:

1. **Greeting toggle row** — the entire row is the expand affordance.
2. **Chip row** — section previews, one chip per non-empty section. Replaced by italic caught-up text when every section is empty.

##### Greeting toggle row (`.ap-greeting-btn`)

A single `<button type="button">` wrapping the greeting block and a chevron icon. The whole row is the click target, including the date subline.

```
.ap-greeting-btn {
  width: 100%;
  display: flex; align-items: center; gap: 14px;
  background: none; border: none;
  padding: 8px 10px; margin: -8px -10px;       /* negative margin so the
                                                  hover bg extends to the
                                                  panel's inner edge */
  text-align: left; font-family: inherit; color: inherit;
  cursor: pointer;
  border-radius: var(--r-sm);
  transition: background .14s ease;
}
.ap-greeting-btn:hover         { background: var(--bg); }
.ap-greeting-btn:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; }
```

Children, in order:

| Child | Class | Notes |
|---|---|---|
| Greeting + date block | `.ap-greeting-block` | `flex: 1; min-width: 0`. Holds `<h2 class="greeting-h">` and `<div class="greeting-sub">` from §6.1. `min-width: 0` is required so text wraps **inside this column** — long greetings (e.g. `"Good morning, Alexandra,"` with a long first name) must never flow under the chevron. |
| Chevron icon | `.ap-chev` | `flex-shrink: 0; width: 32px; height: 32px; border-radius: 999px;` centered inline-flex. Color `--t3`. SVG down-chevron glyph. Hover: color `--indigo`, background `--indigo-soft`. |

Chevron rotation:

```
.ap-greeting-btn .ap-chev               { transform: rotate(180deg); transition: transform .2s ease; }
.ap-greeting-btn.is-collapsed .ap-chev  { transform: rotate(0deg); }
```

Default state has `.is-collapsed`; chevron points down (▾). Expanded removes the modifier; chevron points up (▴).

##### Chip row (`.ap-chips`)

Horizontal flex row of pills, one per non-empty section. Rendered only when `collapsed === true` AND at least one section has a non-zero count.

```
.ap-chips {
  margin-top: 16px;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.ap-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  cursor: pointer;
  transition: all .14s ease;
}
.ap-chip:hover { border-color: var(--indigo); background: var(--indigo-soft); }
```

Chip children:

| Child | Class | Treatment |
|---|---|---|
| Section dot | `.dot` | 6×6 round colored marker. Color per section (table below). |
| Section label | `.lbl` | Sora 12/500, `--t1`. One of `"Today"`, `"Suggested"`, `"Upcoming"`. |
| Count badge | `.n` | DM Mono 10.5/600, `--indigo` text on `--indigo-dim` background, `padding: 2px 8px`, `border-radius: 999px`. |

Section-specific modifiers and dot colors:

| Section   | Modifier class      | Dot color  | Count source                                |
|-----------|---------------------|------------|---------------------------------------------|
| Today     | `.ap-chip.today`    | `#f9c74f`  | `today.length`                              |
| Suggested | `.ap-chip.suggest`  | `#818CF8`  | `suggestions.length`                        |
| Upcoming  | `.ap-chip.upcoming` | `#2EC4B6`  | `tomorrow.length + restOfWeek.length`       |

Empty-chip rule: if a section's count is `0`, its chip is **omitted entirely** from the row. There is no zeroed-out variant. With one or two sections empty, the remaining chips wrap normally.

##### All-empty fallback (`.ap-caughtup`)

When all three counts are `0`, the chip row is replaced with a single line of italic text. Quiet by design — no glyph, no border, no pill.

```
.ap-caughtup {
  margin-top: 16px;
  font-style: italic;
  font-size: 13px;
  color: var(--t3);
  letter-spacing: .1px;
  padding: 6px 2px;
}
```

Copy: `You're all caught up!`. The greeting-row chevron is still active in this state; tapping expands to show the three empty-state sub-panels in full (§6.5).

#### Expanded state — anatomy

When `collapsed === false`:

1. **Greeting toggle row** — same row, `.is-collapsed` removed, chevron rotated to point up.
2. **Full section content** — Today, Suggested Actions, and Upcoming sections rendered exactly as in the desktop side-by-side layout (§6.1–§6.5). Section headers, count pills, row chrome, action buttons, sub-groups, and empty states are all unchanged.
3. **Bottom collapse chip** — a second collapse affordance at the foot of the panel.

The chip row and caught-up fallback are **never** rendered when expanded.

##### Bottom collapse chip (`.ap-collapse-row` + `.ap-collapse-chip`)

```
.ap-collapse-row {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px dashed var(--border);
  display: flex; justify-content: center;
}
.ap-collapse-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--t2);
  font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: .2px;
  cursor: pointer;
  transition: all .14s ease;
}
.ap-collapse-chip:hover {
  border-color: var(--indigo); color: var(--indigo); background: var(--indigo-soft);
}
```

Content: up-chevron glyph (11×11) followed by the word `Collapse`. Triggers the same toggle as the greeting-row chevron. Renders only in expanded state.

#### Interactions

| Surface | Trigger | Behavior |
|---|---|---|
| `.ap-greeting-btn` | Click / Tap / `Enter` / `Space` | Toggle collapsed ↔ expanded. |
| `.ap-chip` (any) | Click / Tap / `Enter` / `Space` | Expand the panel. Does not filter, scroll-into-view, or pre-focus the corresponding section — opening the panel is the disclosure that satisfies the user's intent. |
| `.ap-collapse-chip` | Click / Tap / `Enter` / `Space` | Collapse the panel. |
| `Esc` (focus inside expanded panel) | Press | Collapse the panel; return focus to `.ap-greeting-btn`. |
| Viewport resize across the 1200px boundary | — | Crossing into `<1200px` re-enters collapsed default. Crossing into `≥1200px` reveals the always-expanded side-by-side layout. |

#### Accessibility

- `.ap-greeting-btn` carries `aria-expanded="true" | "false"` and `aria-controls={id-of-panel-body}`.
- The chevron and dot glyphs are `aria-hidden="true"` (decorative).
- The greeting headline retains `id="action-panel-heading"`; the panel `<section>` keeps `aria-labelledby="action-panel-heading"`.
- Each chip carries an `aria-label` of the form `"Expand panel — {Section}, {N} {entry|entries}"`. The visible label/count is decorative for SR purposes; the `aria-label` is the canonical string.
- The all-empty `.ap-caughtup` text is non-interactive plain text. The greeting-row toggle is the only interactive surface in that state.
- Chevron rotation honours `prefers-reduced-motion: reduce` — the `transition` is wrapped in `@media (prefers-reduced-motion: no-preference)`. Reduced-motion users get an instant rotation.
- `Esc` collapse behaviour returns focus to `.ap-greeting-btn` so keyboard users keep their place.

#### Wiring

- Owned by the existing `<ActionPanel>` component in `calendar-app-v2.jsx`. No new top-level component.
- Local state: one boolean `collapsed` (default `true`) and one boolean `isStacked` (default computed from `window.innerWidth < 1200`, refreshed via a `resize` listener).
- Render branches on `isStacked`:
  - `isStacked === false` — return the original always-expanded layout (greeting + three sections). The collapse UI never mounts.
  - `isStacked === true` — render `.ap-greeting-btn` at the top of the panel; below it, render either the chip row / caught-up text (collapsed) or the three sections + `.ap-collapse-row` (expanded).
- No persistence. No localStorage. No URL hash. No SSR cookie.
- Counts come straight from the existing data props (`TODAY_EVENTS`, `SUGGESTIONS`, `UPCOMING_TOMORROW`, `UPCOMING_WEEK`). The existing `*Empty` tweaks override them to `0` for review.
- The greeting headline uses the user's first name only when a name is available (`"{Greeting}, {FirstName}"`); the name-injection convention from §6.1 still applies. Stress-test wrap behavior with long first names — `min-width: 0` on `.ap-greeting-block` is what keeps long wraps safe.

#### Tweaks (additions to §12)

| Key | Type | Default | What it does |
|---|---|---|---|
| `panelCollapsed` | boolean | `true` | At `<1200px`, forces the Action Panel into its collapsed state so the design can be reviewed without resizing. Inert at `≥1200px`. Composes with `todayEmpty` / `suggestionsEmpty` / `upcomingEmpty` — setting all four toggles previews the "You're all caught up!" fallback. |

#### Constraints for agents

- Do **not** absolute-position the chevron over the greeting. The greeting must wrap within its own flex column, never under the chevron. `.ap-greeting-block { flex: 1; min-width: 0 }` and `.ap-chev { flex-shrink: 0 }` are non-negotiable.
- Do **not** persist the collapsed state across reloads. Every page load at `<1200px` starts collapsed by design.
- Do **not** introduce a third collapse affordance (corner X, swipe-up, etc.). The top chevron + bottom Collapse chip cover keyboard, pointer, and touch.
- Do **not** add per-status or per-application chips to `.ap-chips`. The chip row is a section summary, not a filter surface. Status filtering lives on the grid (§6.6 / §6.12).
- Do **not** render the chip row, the caught-up text, or `.ap-collapse-row` at `≥1200px`. Those elements exist only inside the stacked layout.

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
- `aria-label` on cells: `"{Pretty date}, {N} activities"` when activities exist, otherwise no label (the day number is the visible text).
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

---

## 17. v2 — Inline Day Details Panel

> **Status:** Implemented in `Calendar v2.html` + `calendar-app-v2.jsx`. v1 files (`Calendar.html` + `calendar-app.jsx`) remain untouched as the baseline so the two can be compared side-by-side.

### 17.0 Why v2

The v1 day popover (anchored on desktop, bottom-sheet on mobile) is a transient surface — it occludes the grid on desktop and forces the user out of context on mobile. v2 replaces that pattern with a **persistent inline details panel** stitched to the bottom of the calendar card. Selecting a date stays "sticky" — the panel updates in place. The user can keep the grid and the day's activity in view together.

### 17.1 Sections superseded by v2

These v1 sections are **replaced** when running on v2:

| v1 section | v2 replacement |
|---|---|
| §6.9 — Day Popover | §17.4 — Day Details Panel |
| §8 — interactions for cell / chip / `+N` / day-popover rows | §17.6 — Updated interactions |
| §11 — "Popovers and pickers all become bottom sheets" (the day popover row) | §17.7 — Mobile is inline everywhere |
| §12 — Tweaks table | §17.8 — adds `detailsVariant` and `preselectToday` |
| §14 — chip aria-label "Click to view." | §17.9 — chips are no longer interactive |

The Month Picker, Year Picker, Status Filter dropdown, `<AnchoredDropdown>` primitive, scrim/bottom-sheet behavior for those three remain **unchanged** from v1.

### 17.2 Interaction model

| Surface | v2 behavior |
|---|---|
| Day cell with any activity OR an empty day | Single click selects the date. The Details Panel below the grid updates. |
| Day cell already selected | Click is a no-op. Selection persists; the only way to change it is to click a different cell. |
| Out-of-month cell | Not selectable (cursor stays default, no click handler). |
| Numbered chip (`.num-chip`) | **Non-interactive.** Purely visual. No `role`, no `tabIndex`, no `onClick`. `cursor: default`. Hover lift / shadow removed. Tooltip via `title` attribute preserved for status-name discovery. |
| `+N` overflow chip (`.num-more`) | **Non-interactive.** Same treatment as `.num-chip`. The cell's own click still selects the date. |
| Date selection | Stays in component state. No URL persistence, no localStorage. Defaults to `null` ("nothing selected") unless the `preselectToday` tweak is on, in which case the initial value is `isoKey(TODAY)`. |

The popover state machine (`day-status` / `day-all` modes from v1) is removed entirely.

### 17.3 Cell selection state — `.cal-cell--selected`

New cell state, distinct from `--today`:

```
.cal-cell--selected {
  border-color: var(--navy);
  box-shadow: 0 0 0 2px rgba(26,26,46,.08);
}
.cal-cell--selected.cal-cell--today {
  border-color: var(--indigo);
  box-shadow: 0 0 0 2px rgba(79,70,229,.18);
}
```

Stacks with `--today` (today + selected = indigo ring instead of navy). Stacks with `--weekend` and `--out` (though `--out` is never selectable, so that combination shouldn't occur).

### 17.4 Day Details Panel (`.details-panel`)

Sits **inside the calendar card**, below the month grid, separated by a 1px solid border. Renders three top-level states:

| State | Trigger | Shell class |
|---|---|---|
| **Prompt** — no date selected | `selectedDate === null` | `.details-panel .details-panel--prompt` (top border becomes dashed) |
| **Empty day** — selected date has zero activities | `DAY_ACTIVITIES[selectedDate]` is missing or `[]` | `.details-panel` |
| **Populated** — selected date has activities | one or more activity rows | `.details-panel` |

#### Prompt state (no selection)

```
.dp-prompt    text-center, 26px 16px 18px padding, flex column gap 4px items-center
  .dp-prompt-glyph     36×36 round, 1px dashed --border-2, --t4, centered "○"
  .dp-prompt-h         Sora 13/500, --t2 — "Select a date"
  .dp-prompt-sub       DM Mono 10.5, --t3 — "Tap any date to see activity"
```

Quiet. No CTA. Not a card — sits inline.

#### Header (`.dp-header`) — populated & empty-day

Flex row, baseline-aligned:

- **Left** — `.dp-date` (Sora 15/600, `--t1`, letter-spacing -0.1px):
  - `{MMM} {D}` only — e.g. `May 20`. No day-of-week prefix.
  - If the selected date is today: append the `.is-today` pill (DM Mono 10/500, `--indigo` text on `--indigo-dim`, `2px 8px`, `border-radius: 999px`).
- **Right** — `.dp-count`:
  - Populated: `{N} entry` or `{N} entries` with the count in DM Mono `--t1` weight 600, rest in `--t3`.
  - Empty day: literal text "No events" in `--t3`.

#### Body (`.dp-body`) — populated only

Scroll behavior:
- **Desktop (≥ 640px):** `max-height: 320px; overflow-y: auto`. Thin styled scrollbar (`6px wide, --border-2 thumb`).
- **Mobile (< 640px):** `max-height: none; overflow-y: visible`. The panel grows; the page scrolls.

Body content depends on **variant** — see §17.5.

#### Empty-day placeholder (`.dp-empty`)

```
.dp-empty       text-center, padding 28px 16px 22px
.dp-empty-h     Sora 16/500, --t3, letter-spacing -0.1px — "No events"
```

No background, no border, no glyph, no sub-line. Just the words "No events" in a generous size. Differs deliberately from the v1 `.empty` block (which has a glyph + headline + sub-line and a `--bg` container).

### 17.5 Layout variants

Exposed via the `detailsVariant` tweak. All three share `.dp-header` and `.dp-body`; only the body rendering differs.

#### Variant A — "Grouped" (default)

Groups activities by status (priority order per §5). Each group is a section with a subheader followed by its rows.

```
.cal-dp-group
├── .cal-dp-group-h                 flex, gap 10, padding 2 0
│   ├── <StatusBadge>                full status pill (shared Tracker component)
│   ├── .cal-dp-group-count         DM Mono 10.5, --t3 — "(N)"
│   └── .cal-dp-group-dash          flex:1, top border 1px dashed --border
└── .cal-dp-row.cal-dp-row--simple × N
    ├── .cal-dp-row__body
    │   ├── .cal-dp-row__job        Sora 12.5/500, --t1, ellipsis    — timeline entry title
    │   └── .cal-dp-row__meta       DM Mono 10.5, --t3, ellipsis     — "{Company} · {Job title}"
    │       └── .cal-dp-row__sep    --t4 color, 0 6px margin         — the "·" separator
    └── .cal-dp-row__arrow          → glyph, --t4 (→ --indigo on row hover)
```

- The subheader uses the **full StatusBadge** (e.g. a solid `Interview` pill), not a swatch + label.
- Rows in this variant do **not** show an `IdPill`. Grid template is `minmax(0, 1fr) auto` (`.cal-dp-row--simple` modifier).
- Meta line is **`{Company} · {Job title}`** — mirrors the Action Panel `.cal-row__meta` pattern (§6.3) so the two surfaces feel cohesive. The application's company alone was ambiguous when a user had several roles at the same employer; the role disambiguates without forcing the ID pill back into the row. The separator uses the same `.cal-dp-row__sep` color treatment as the Action Panel's `.cal-row__sep`.
- The `.cal-dp-row__meta` line truncates with ellipsis (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`) when the combined string is wider than the row body.

#### Variant B — "Flat"

Flat sorted list. One row per activity, sorted by status priority. Status badge is the leading cell, so the row carries its own status identity.

```
.dp-row × N (default grid: auto | 1fr | auto)
├── <StatusBadge>
├── .body
│   ├── .job        Sora 12.5/500, --t1
│   └── .co         DM Mono 10.5, --t3 — "Company · #024"
└── .arrow
```

The ID is appended to the meta line for traceability (since there's no grouping context).

#### Variant C — "Summary"

A condensed status-count strip at the top, followed by a flat list (identical to Variant B's row treatment, but with `IdPill` instead of `StatusBadge` since the strip already encodes status).

```
.dp-summary             flex wrap, gap 6, padding-bottom 14, dashed bottom border
  .dp-summary-pill × N
    .swatch             8×8 round, STATUSES[k].bg, 1px subtle border
    .lbl                Sora 10.5, --t2 — status label
    .n                  DM Mono 10.5/600, --t1 — count

.dp-body
  .dp-row × N
    <IdPill>
    .body
      .job
      .co               Company only
    .arrow
```

The summary strip is **not** interactive — it's a quick visual census. Filtering by clicking a strip pill is **out of scope for v2**.

### 17.6 Updated interactions (replaces §8 rows)

| Surface | v2 behavior |
|---|---|
| Month grid cell (any in-month, with or without activity) | Click selects the date. Details Panel updates. No popover, no overlay. |
| Month grid cell (already selected) | Click is a no-op. |
| Month grid cell (out-of-month) | Click is a no-op. |
| Numbered chip | Not interactive. Click events on chips bubble into the cell's selection handler (because there's no `stopPropagation` anymore). |
| `+N` overflow chip | Not interactive. Same bubbling. |
| Details Panel row | Click opens Application Overlay for that `id`. Row hover bg `--indigo-soft`. Keyboard: `Enter` triggers. |
| Details Panel prompt / empty state | Non-interactive. |
| Today button | Unchanged from v1 (jumps `view` to `TODAY.y, TODAY.m`). **Does not** auto-select today — the user still has to click the cell. |
| Month / Year / Filter pickers | Unchanged from v1. Still use `<AnchoredDropdown>`, still become bottom sheets on mobile. |

### 17.7 Mobile (< 640px) — inline everywhere

The Details Panel is **inline at all viewports**. There is no bottom sheet for day details on mobile in v2.

- Panel sits below the grid in the same `<section className="panel">` container, gets the same `18px 16px` panel padding.
- `.dp-body` removes its `max-height` and `overflow` — the list grows naturally and the page scrolls. This is intentional: on a narrow viewport an internal-scroll region inside a page that already scrolls is a usability tax.
- `.dp-header` margin-bottom reduces to 12px; `.dp-date` font-size drops to 14px.
- The narrow `CW` column shrinks: `.dow-row` and `.cal-grid` switch their leading track from `28px` → `22px`; `.cw-cell` font 9px; `.dow-cw` 8.5px.
- Month Picker, Year Picker, Status Filter — still bottom sheets on mobile (unchanged).

### 17.8 Tweaks (additions to §12)

| Key | Type | Default | What it does |
|---|---|---|---|
| `detailsVariant` | `"A" \| "B" \| "C"` | `"A"` | Switches the body layout of the Details Panel. Surfaced as a 3-up `TweakRadio` ("Grouped" / "Flat" / "Summary"). |
| `preselectToday` | boolean | `false` | When true, the page mounts with `selectedDate = isoKey(TODAY)` so the panel is populated on first load. Otherwise mounts in the Prompt state. |

The original v1 tweaks (`todayEmpty`, `suggestionsEmpty`, `upcomingEmpty`, `filterActive`, `offCurrentMonth`) carry over unchanged.

### 17.9 Accessibility deltas (additions to §14)

- Cells gain `aria-pressed={isSelected || undefined}` so screen readers announce selection state.
- Cells are now always `role="button" tabIndex={0}` when in-month, even with zero activities (because they're all selectable in v2). The `aria-label` extends to `"{Pretty date}, no activity"` for empty days.
- Numbered chips lose `role="button"` and `tabIndex` — they're decorative. `aria-label` simplifies to `"{Status label}, {N} entries"` (no "Click to view.").
- Details Panel root gets `aria-live="polite"` so a screen reader announces "May 20, 3 entries" / "No events" when the selection changes.
- Subheaders in Variant A use a visible `<StatusBadge>` — sufficient for visual users; status is still announced in the row order. Variant B announces the status badge on every row.

### 17.10 Implementation notes for v2

- **Single source of truth.** Keep `Calendar.html` + `calendar-app.jsx` (v1) as-is. v2 lives entirely in `Calendar v2.html` + `calendar-app-v2.jsx`. If/when v2 is promoted, copy `Calendar v2.html → Calendar.html` and `calendar-app-v2.jsx → calendar-app.jsx`, then delete the v2 files.
- **No state migration needed** — `selectedDate` is session-local; `detailsVariant` and `preselectToday` are tweak defaults the host owns.
- **Do not** re-introduce the day popover or bottom sheet for day details — that's the entire point of v2. If a use case appears that needs more space than the inline panel can give, route it through the Application Overlay instead.
- **Do not** make the chips clickable again "as a shortcut" — it splits the click target on a 22×18 element and confuses the cell-is-the-target model. If status filtering on a chip click becomes desirable, surface it through the existing top-of-grid Status Filter, not by re-arming the chip.
- **Do not** auto-scroll the Details Panel into view on selection. The cell-then-panel scan pattern is the design intent on desktop; an auto-scroll forces a vertical jump that defeats keeping both in view. (On mobile the panel is already below the grid in source order; native scrolling carries the user to it naturally if they tap a date near the bottom of the viewport.)
- Style object naming: the v2 file uses no top-level style objects, but if you add one for the panel later, name it `dayDetailsStyles` — never `styles`.
