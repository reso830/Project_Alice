# AppTracker — Design Spec

## Overview

A responsive web application for tracking job applications. Built with **Sora** (UI) and **DM Mono** (data/code) typefaces on a warm off-white background with a dark navy + indigo palette.

The top of the application is a single unified navy band composed of two stacked rows:

1. **Top Bar** — brand + primary page nav + identity / sign-out
2. **Toolbar** — subheader label, filter chips, sort, and the primary "+ New application" action

Both rows share the `--navy` background; their content uses light-on-dark styling.

---

## Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `--navy` | `#1A1A2E` | Top bar + toolbar background, ID pills, footer, bottom tab bar |
| `--navy-2` | `#232342` | (reserved) |
| `--indigo` | `#4F46E5` | Primary accent, active nav, primary buttons, FAB |
| `--indigo-hover` | `#4338CA` | Button hover state |
| `--indigo-dim` | `#EEF2FF` | Skill tag bg, light count-badge bg |
| `--indigo-mid` | `#818CF8` | Calendar day dot color; hover border on dark-toolbar chips |
| `--indigo-soft` | `#F4F2FF` | Pagination button hover background |
| `--bg` | `#F4F1ED` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | Card and modal backgrounds |
| `--border` | `#E8E3DA` | Default borders |
| `--border-2` | `#D1CCB9` | Stronger border on card hover |
| `--t1` | `#1A1A2E` | Primary text |
| `--t2` | `#4B5563` | Secondary text |
| `--t3` | `#9CA3AF` | Muted / placeholder text |
| `--t4` | `#C4BDB5` | Ghost labels, separators |
| `--color-accent` | `#4F46E5` | Alias for `--indigo` |
| `--color-border` | `#E0DDD8` | (legacy — borders on light surfaces) |
| `--color-accent-light` | `#F4F2FF` | Filter/sort hover background (light context only) |
| `--color-accent-tint` | `#EEF2FF` | (legacy — light context active filter bg) |
| `--color-danger` | `#EF4444` | Erase-all button, error indicators |
| `--color-danger-bg` | `#FFF5F5` | Erase-all button background (light context) |
| `--color-bg-dark` | `#1A1A2E` | Tooltip background |
| `--pagination-text` | `#555555` | Pagination button text |
| `--pagination-muted` | `#BBBBBB` | Pagination ellipsis color |

### Toolbar-on-navy tints
Filter chips, count badge, and the erase button live on the navy toolbar surface and use translucent white / indigo tints rather than the light-context tokens:

| Element | Background | Border | Foreground |
|---|---|---|---|
| Subheader label | — | — | `rgba(255,255,255,0.8)` |
| Count badge | `rgba(129,140,248,0.18)` | — | `#C7CCFE` |
| Filter chip (idle) | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.16)` | `rgba(255,255,255,0.7)` |
| Filter chip (hover) | `rgba(129,140,248,0.18)` | `--indigo-mid` | `#FFFFFF` |
| Filter chip (active) | `rgba(79,70,229,0.40)` | `--indigo-mid` | `#FFFFFF` |
| Filter chip (open) | `rgba(79,70,229,0.32)` | `--indigo-mid` | `#FFFFFF` |
| Erase-all | `rgba(239,68,68,0.18)` | `rgba(252,165,165,0.45)` | `#FCA5A5` |

---

## Typography

### Typefaces
| Role | Family |
|---|---|
| UI / Headlines | **Sora** |
| Data / Code | **DM Mono** |

### Scale
| Element | Font | Size | Weight | Notes |
|---|---|---|---|---|
| App title (topbar) | Sora | 15px | 600 | letter-spacing −0.3px |
| Nav buttons (top bar) | Sora | 12px | 500 | |
| User email (top bar) | DM Mono | 11px | 400 | `rgba(255,255,255,0.7)`, truncates at 220px |
| Sign-out button | Sora | 12px | 500 | |
| Bottom tab label (mobile) | Sora | 10px | 500 | |
| Card — Position | Sora | 14px | 600 | |
| Card — Company | Sora | 13px | 400 | |
| Card — Field label | Sora | 9px | 500 | uppercase, 0.3px tracking |
| Card — Resp / Skills / Salary | DM Mono | 11px | 400 | line-height 1.45 |
| ID Pill | DM Mono | 10px | 500 | format `#NNN` zero-padded |
| Status badge | Sora | 10px | 500 | |
| Compat bar label | DM Mono | 9px | 500 | |
| Modal title (job title) | Sora | 24px | 600 | click-to-edit inline in header |
| Modal field label | Sora | 11px | 500 | |
| Modal field value | Sora | 13px | 400 | line-height 1.5 |
| Toolbar label | Sora | 13px | 500 | white on navy |
| Count badge | Sora | 12px | 500 | |
| Button (primary) | Sora | 12px | 600 | |

---

## Spacing & Shape

| Token | Value |
|---|---|
| `--r-xs` | `4px` |
| `--r-sm` | `6px` |
| `--r-md` | `10px` |
| `--r-lg` | `14px` |
| `--r-pill` | `999px` |

### Shadows
| Token | Value |
|---|---|
| `--shadow-xs` | `0 1px 2px rgba(26,26,46,.05)` |
| `--shadow-sm` | `0 1px 4px rgba(26,26,46,.06), 0 2px 8px rgba(26,26,46,.04)` |
| `--shadow-md` | `0 4px 16px rgba(26,26,46,.09), 0 1px 4px rgba(26,26,46,.05)` |
| `--shadow-lg` | `0 12px 40px rgba(26,26,46,.14), 0 4px 12px rgba(26,26,46,.06)` |
| FAB | `0 6px 16px rgba(79,70,229,0.42), 0 2px 6px rgba(0,0,0,0.12)` |

---

## Z-Index Stack

| Layer | Token | Value |
|---|---|---|
| Navigation (topbar, bottom tabs) | `--z-nav` | 100 |
| FAB | — | `calc(--z-nav + 1)` (101) |
| Toolbar | `--z-toolbar` | 90 |
| Dropdown | `--z-dropdown` | 200 |
| Modal | `--z-modal` | 300 |
| Toast | `--z-toast` | 400 |
| Confirm dialog | — | `calc(--z-modal + 10)` (310) |

---

## Status System

Each status drives the card's left accent border, the status badge background, the status dropdown color dot, and the **detail modal header background**.

A single `borderAccent` color is used for all three surfaces (badge bg = left border = modal header bg). Badge text is `#212529` (dark) for light accent colors, or `#ffffff` for dark accent colors, chosen automatically based on contrast.

| Status key | Label | `borderAccent` | Badge text |
|---|---|---|---|
| `wishlisted` | Wishlisted | `#ffafcc` | `#212529` |
| `applied` | Applied | `#003049` | `#ffffff` |
| `phone_screen` | Phone Screen | `#f4a259` | `#212529` |
| `interview` | Interview | `#f9c74f` | `#212529` |
| `assessment` | Technical | `#e0aaff` | `#212529` |
| `offer` | Offer | `#09bc8a` | `#212529` |
| `rejected` | Rejected | `#9d0208` | `#ffffff` |
| `withdrawn` | Withdrawn | `#343a40` | `#ffffff` |
| `ghosted` | Ghosted | `#ced4da` | `#212529` |

Badge shape: `border-radius: 999px`, padding `3px 9px`, font `10px / 500`.

> **Note on modal header contrast:** The modal header background is the status `borderAccent` color. The header text/icon color is determined at runtime via relative-luminance contrast calculation — not hard-coded — and resolves to either `modal-header--light` (white text) or `modal-header--dark` (black text).

> **Header status pill border (2026-06):** Because the header background and the status badge share the same accent color, the badge would otherwise disappear into the header. The badge inside `.modal-pills` therefore carries a **1px defining border** — `rgba(33,37,41,.32)` on light (`hdr-dark`) headers, `rgba(255,255,255,.45)` on dark (`hdr-light`) headers. This applies to the header pill only; badges on cards / timeline rows stay unbordered.

---

## Components

### Top Bar
- Height: `52px`
- Background: `--navy`
- Sticky, `z-index: 100`
- Layout (desktop): horizontal flex, `padding: 0 24px`, `gap: 28px` between brand cluster and nav, identity cluster pushed right via `margin-left: auto`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🟦 Project Alice   [Tracker] [Calendar] [Profile]      reso@…   [→ Sign out]│
└─────────────────────────────────────────────────────────────────────────────┘
```

**Brand cluster (left)**
- Logo mark: `38×38px` SVG image (`alice-sigil-full-white.svg`), no border or background styling
- Logo text: "Project Alice", white, 15px / 600, letter-spacing −0.3px
- Mark and text wrapped together; text-only span is `.topbar-brand-text` (hidden at < 380px)

**Page nav (immediately after brand)**
- Nav buttons: `padding: 7px 11px`, radius `--r-sm`, no border by default
- Default state: `rgba(255,255,255,0.65)` text, transparent background
- Hover: `rgba(255,255,255,0.08)` bg, white text
- Active: `--indigo` background, white text
- Hidden on mobile — page nav moves to the bottom tab bar (see below)

**Identity cluster (right, `margin-left: auto`)**
- **Email** (`.topbar-email`): DM Mono 11px / `rgba(255,255,255,0.7)`; `max-width: 220px`, single-line truncate with ellipsis; `title` attribute carries the full address.
- **Sign out button** (`.signout-btn`):
  - Background `rgba(255,255,255,0.08)`, border `1px solid rgba(255,255,255,0.14)`, radius `--r-sm`
  - Inline-flex with door-arrow SVG icon (13×13) + "Sign out" label, `gap: 6px`, `padding: 6px 12px`
  - Hover: background `rgba(255,255,255,0.14)`, border `rgba(255,255,255,0.24)`, label `#fff`
  - On mobile the label is hidden — only the icon is shown (`32px` square hit target)

### Toolbar
- Height: auto, padding `11px 24px`
- Background: `--navy` (unified with the top bar)
- Bottom border: `1px solid rgba(255,255,255,0.06)` (hairline separator only)
- Sticky below topbar, `z-index: 90`
- Subheader label: 13px / 500, `rgba(255,255,255,0.8)`
- Count badge: pill shape, `rgba(129,140,248,0.18)` bg, `#C7CCFE` text, 12px / 500, padding `3px 10px`
- Filter chips, sort, erase-all: dark-toolbar tints (see Color Tokens § Toolbar-on-navy tints)
- Primary action (`.btn-primary.new-app-btn`): standard indigo button, flush right via `margin-left: auto`. **Hidden on mobile** — replaced by the FAB. **Also hidden whenever the Archived view is active** (in both desktop and mobile, the FAB hides as well).

#### View switcher (Active / Archived)

The leading toolbar element is a single pill-shaped chip that wraps **both** the current view label and its count. Clicking the label opens a small popup menu listing the two views with their respective counts.

```
┌────────────────────┐
│ Applications ▾  22 │     ← chip border wraps both halves
└────────────────────┘
```

**Chip container (`.view-chip`)**
- Border: `1px solid rgba(255,255,255,0.18)`
- Background: `rgba(255,255,255,0.04)`
- Radius: `--r-pill`
- Padding: `3px 4px 3px 0`, gap `4px`
- Hover / open: border `rgba(255,255,255,0.32)`, background `rgba(255,255,255,0.08)`

**Title trigger (`.app-title-trigger`)**
- Sora 13px / 500, color `rgba(255,255,255,0.88)` → `#fff` on hover/open
- Chevron `▾` to the right of the label (DM Mono 11px, 55% opacity → 100% on open, rotates 180° when popup is open)
- Label reads **"Applications"** in the Active view, **"Archived"** in the Archived view

**Count badge inside the chip**
- Retains the standard purple count-badge styling (`rgba(129,140,248,0.18)` bg, `#C7CCFE` text)
- Reflects the **filtered** count of whichever view is active (not the unfiltered total)

**View popup (`.view-popup`)**
- Anchored below the chip, `top: calc(100% + 8px)`, `left: 0`
- Background `--surface`, border `1.5px solid --color-border`, radius `--r-md`, shadow `--shadow-lg`
- Min-width `220px`, padding `5px`
- Header label "View" (8px uppercase, 0.8px tracking, `--t4`)
- Each option: 3-col grid (dot | label | count pill)
  - Idle: `--t2` text, `--t4` dot, light count pill `--bg` background
  - Selected: `--indigo` text + dot, `--indigo-dim` count pill
  - Hover row: `--indigo-soft` background
- Closes on outside click or option select
- Switching views resets pagination to page 1
- Active filters and sort **persist** across the view switch

**URL synchronization**
- The selected view writes to the URL search params: Active = no param, Archived = `?view=archived`
- On load, the value of `?view=` initialises the view (deep-link from Profile's Archived tile, or refresh-safe)

### Card
- Background: `--surface`
- Border: `1px solid --border`, radius `--r-md` (10px)
- Left accent: `border-left: 4px solid <status accent color>` (inline style)
- Default shadow: `--shadow-xs`
- Hover: border `--border-2`, shadow `--shadow-md`, `translateY(-1px)`, 160ms ease
- Padding: `12px 16px`; grid gap `10px`
- Cursor: pointer; keyboard accessible (`tabIndex=0`)

**Corrupt card variant:** border `#FECACA`, background `#FEF2F2`; shows `⚠` icon (`.card-warning`, `#DC2626`) in meta row.

**Archived card variant (`.card.card-archived`):**
- Background, border, shadow, and status badge are **identical to active cards** — the card itself receives no muted treatment so the status accent reads at full strength
- Differentiated only by three signals in row 1:
  1. A small `.card-archived-stamp` chip — DM Mono 9px / 600, uppercase 0.7px tracking, color `--t3`, background `--bg`, border `1px solid --border`, padding `2px 7px`, pill radius. Reads simply **"Archived"** (no date — the date already lives in the date-stamp slot).
  2. The date-stamp slot reads **"Archived [date]"** instead of **"Updated [date]"** (using the row's `archivedDate`, with `lastStatusUpdate` as fallback)
  3. Quick actions row collapses to a single button — see Quick Action Buttons § Unarchive

For archived cards, Row 1 reads:

```
[ID Pill]  [Status Badge]  [Archived]    Archived [date]    →   [↺]
```

**Card layout (3 rows, desktop):**

```
Row 1: [ID Pill]  [Status Badge]  [Updated date]  →  [edit] [status] [copy] [star] [archive]  (SVG icon buttons)
Row 2: Position · Company                         →  [Compat Bar — 30%]
Row 3: Responsibilities (2-line clamp) | Skills tags | Salary
```

Row 3 grid: `minmax(0, 2fr) minmax(140px, 1fr) minmax(90px, .6fr)`

### ID Pill
- Background: `--navy`, text: white
- Font: DM Mono 10px / 500
- Shape: `border-radius: 999px`, padding `3px 9px`
- Format: `#NNN` (zero-padded to 3 digits)

### Compatibility Bar
- Height: `18px`, pill border-radius
- Background track: `#EDE8DF`
- Fill color follows the shared compatibility ramp (see table below) — a single source of truth used by both the card bar and the detail overlay's score ring

| Score | Fill | Verdict (overlay ring) |
|---|---|---|
| ≥ 85 | `#2563EB` (blue) | Great match |
| 65–84 | `#15803D` (green) | High match |
| 40–64 | `#EAB308` (amber) | Medium match |
| 1–39 | `#EF4444` (red) | Low match |
| 0 | `#C4BDB5` (grey) | Not scored |

> Supersedes the earlier 3-stop ramp (`#22C55E`/`#EAB308`/`#4F46E5` at ≥80/≥60/<60), which did not match the overlay's score ring. Both surfaces now read from `compatRamp(pct)`.
- Label text color: `#4B5563` when score < 50; `#212529` in the amber band (50–64); `#FFFFFF` when score ≥ 65
- Label: DM Mono 9px / 500, centered absolutely over bar
- Width: 30% of middle row on desktop (min 150px); 36% on tablet; 100% on mobile

### Quick Action Buttons
- Size: `28×28px`
- Border: `1px solid --border`, radius `--r-sm`
- Default color: `--t3`
- Hover: border `--indigo`, color `--indigo`, bg `--indigo-dim`
- **Icons are inline SVG line icons** (14px, `1.4` stroke, `currentColor`) — they replace the earlier text-glyph set (✎ ⇄ 🔗 ★ ×), which rendered inconsistently across platforms. The table below names each icon; glyphs are shown only as shorthand.

| Button | Icon | `aria-label` |
|---|---|---|
| Open details | ✎ | "Open application details" |
| Change status | ⇄ | "Change status" |
| Copy job URL | 🔗 | "Copy job URL" |
| Star / favorite | ★ | "Star application" |
| Archive | × | "Archive application permanently from active list" |
| Unarchive (archived view) | ↺ | "Unarchive application" |

> **Archive confirm dialog:** Archiving (from card × or modal × button) triggers a `ConfirmDialog` before proceeding. The dialog is a centered modal at `z-index: var(--z-modal) + 10`, max-width `380px`, with "Archive this application?" message and Cancel / Confirm buttons.

> **Unarchive action:** When viewing the Archived list, the row of quick actions collapses to a **single** Unarchive button (↺). It uses an elevated styling: border `--indigo-dim`, color `--indigo`, background `--indigo-soft`; hover lifts to border `--indigo`, background `--indigo-dim`. Unlike Archive, Unarchive does **not** trigger a confirmation — it is a non-destructive restore. On click the row's `archived` flag is cleared (and `archivedDate` nulled) and a toast fires (`Unarchived.`).

Starred state: color `#D97706`, border `#FDE68A`, bg `#FFFBEB`.

### Status Dropdown
- Background: `--surface`
- Border: `1px solid --border`, radius `--r-md`
- Shadow: `--shadow-lg`
- Position: `fixed` (viewport-relative), appended to `document.body`, below anchor; smart collision avoidance near viewport edges
- Min-width: `196px`, padding `5px`
- Each option: `8px 10px` padding, `border-radius: --r-sm`; 3-column grid (dot | label | check)
- Color dot: `8×8px` circle in status `borderAccent` color
- Active item: `--indigo` text, weight 600, `✓` checkmark on right
- Hover: `--indigo-dim` background
- Backdrop: full-screen transparent `div` closes on outside click; Escape key also closes
- Inside modal: z-index elevates above `--z-modal` (z-index 301)

### Toast
- Fixed, bottom `24px`, horizontally centered (`translateX(-50%)`)
- Background: `--navy`, text: white, padding `10px 18px`, gap `9px`
- Shape: pill (`border-radius: 999px`)
- Shadow: `--shadow-lg`
- Color dot: `16×16px` circle — `#22C55E` for success, `#EF4444` for failure
- Auto-dismiss: 2400ms
- Entrance: `translateY(8px) → translateY(0)` + fade in, 180ms ease
- Exit: same in reverse, 180ms ease, `forwards` fill

### Detail Modal (Edit / Create)

> Full spec: [`docs/design/application_overlay.md`](application_overlay.md)

> **Create entry:** reached through the **Add-application gate** (Smart vs Manual entry → optional job-posting parse), not by opening this modal directly. See [`application_overlay.md`](application_overlay.md) §13.

- Overlay: `rgba(0,0,0,.55)` + `backdrop-filter: blur(4px)`; body scroll locked while open; `z-index: var(--z-modal)` (300)
- Entrance: scale `0.97→1` + `translateY(8px→0)` + fade in, 200ms ease
- **Header background:** status `borderAccent` color — NOT `--navy`
- **Two render variants, one component:** the centered overlay above (`modal` variant, used on tablet/mobile) and a borderless in-column **`pane` variant** used by the desktop docked detail pane (see below). The pane variant drops the dimmed backdrop and body-scroll lock and fills its column; editing behavior is identical.

---

### Desktop Detail Pane (docked master–detail, ≥ 1100px)

On wide desktops the Tracker switches from "list + centered modal" to a persistent **master–detail split**, modelled on a mail client's reading pane. The centered modal is retained for narrower viewports.

**Activation**
- Engaged at viewport width **≥ 1100px**.
- **640–1099px (tablet):** the centered Detail Modal is still used — clicking a card opens the modal, not a pane.
- **< 640px (mobile):** the modal renders as a bottom-sheet (unchanged).

**Layout**
- Two columns in a flex row, `gap: 18px`, padding `16px 24px 0`:
  - **Master column (left, ~60%)** — the application list. Cards render in their normal rich form. (A denser one-line `compact` row variant exists in code but is off by default, pending a future Settings toggle.)
  - **Detail pane (right, ~40%, `--pane-w: 40%`)** — the overlay component in its `pane` variant. The 60/40 ratio keeps the list the primary scanning surface while giving the detail room to breathe. The pane body is the **5-panel collapsible stack** (Overview / Skills / Compatibility / Timeline / Notes & Links) — full spec in [`application_overlay.md`](application_overlay.md) §4.
- The page **scrolls naturally** (no fixed-height workspace). The detail pane is **`position: sticky`**, pinned at `top: calc(--header-h + 16px)` (`--header-h` = 106px = topbar 52 + toolbar ~54), so its top edge never collides with the sticky topbar+toolbar; the pane's own body scrolls internally while it's pinned.
- **Pagination** spans the **full width below both columns** (`.split-pagination`), not nested inside the list column.
- The site footer remains reachable at the bottom of the page.

**Selection**
- Clicking a card **selects** it (it does not open a separate modal). The selected card carries an **indigo glow**: `border-color: --indigo` plus a soft `0 0 0 4px rgba(79,70,229,.06)` halo (matched to the resume-import card treatment).
- Editing happens inline in the pane exactly as in the modal (click-to-edit fields, status dropdown, timeline add/remove, Save / Discard).

**Empty state (`.empty-pane`)**
- When nothing is selected the pane shows a friendly placeholder: a layered-cards illustration with a cursor, title **"Nothing open yet"**, and the line *"Pick an application on the left and its full breakdown — compatibility, skills, timeline and notes — lands right here."* No call-to-action button (a "+ New application" button was removed — creation already lives in the toolbar).

> **Consistency note:** the master–detail split is the desktop counterpart to the Calendar page's two-column layout. The Tracker uses a **60/40 list-forward** ratio (vs. Calendar's 40/60 context-forward ratio) because the application list is the primary surface here.

### Bottom Tab Bar (mobile-only)

Mobile replacement for the top-bar page nav. Visible only at ≤ 639px.

- `position: fixed; left: 0; right: 0; bottom: 0`
- Background: `--navy`, top border `1px solid rgba(255,255,255,0.08)`
- Padding: `6px 8px calc(6px + env(safe-area-inset-bottom))` (honors home-indicator safe area)
- z-index: `--z-nav` (100)
- Each tab: flex column (icon over label), `padding: 6px 4px`, radius `--r-sm`, 10px label, 18×18 SVG icon
- Default: `rgba(255,255,255,0.55)`; Hover: `#fff`; Active: `rgba(79,70,229,0.32)` bg + white text
- Cards-list adds `padding-bottom: 86px` (with FAB clearance) on mobile to prevent the bottom tab bar from covering content.

### FAB (mobile-only)

Floating action button that replaces the toolbar "+ New application" on mobile.

- Visible only at ≤ 639px
- Size: `56×56px`, `border-radius: 50%`
- Background: `--indigo` (hover: `--indigo-hover`)
- Icon: `+` glyph, 24×24 SVG, white, stroke 2.4
- Position: `position: fixed; right: 16px; bottom: calc(72px + env(safe-area-inset-bottom))` — stacks **above** the bottom tab bar
- Shadow: `0 6px 16px rgba(79,70,229,0.42), 0 2px 6px rgba(0,0,0,0.12)`
- Active press: `transform: scale(0.96)`
- z-index: `calc(--z-nav + 1)` so it floats above the tab bar
- `aria-label="New application"`; opens the **Add-application gate** (Smart vs Manual; see [`application_overlay.md`](application_overlay.md) §13), which leads into the Detail Modal in Create mode
- **Hidden when the Archived view is active** — creation is suppressed at every entry point (toolbar button + FAB) while viewing archived items.

---

## Authentication / Identity

The Top Bar's right-side cluster is the canonical surface for the signed-in user's identity and session controls.

| Element | Purpose | Notes |
|---|---|---|
| Email | Identity readout | Truncates at 220px on desktop; hidden on mobile |
| Sign-out button | Ends the session | Icon-only on mobile; icon + label on desktop |

When signed out, the identity cluster is **not rendered** on the Tracker — unauthenticated visitors are routed to the Welcome page instead (see `docs/design/welcome_page.md`), which is the sole sign-in surface. The Tracker chrome therefore only ever renders the cluster in its signed-in form.

The user's `email` is the only identity field shown in chrome. Avatar, display name, and account dropdown are deferred.

---

## Responsive Breakpoints

| Breakpoint | Layout changes |
|---|---|
| **Wide desktop** `≥ 1100px` | **Master–detail split:** rich card list (~60%) beside a sticky docked **detail pane** (~40%); clicking a card selects it and opens its detail **inline in the pane** (no centered modal); selected card carries an indigo glow; pagination spans full width below both columns; empty pane shows the "Nothing open yet" placeholder |
| **Desktop** `1025–1099px` | 3-row card, compat bar 30%, **2-col centered modal** (no pane yet), toolbar single row, top-bar nav inline beside brand |
| **Tablet** `640–1099px` | Compat bar 36%, Responsibilities spans full detail row, modal 1-col (centered modal retained — the docked pane does **not** apply below 1100px) |
| **Mobile** `< 640px` | Card collapses to flex-column via CSS `order` (ID/badge/date → title → company → responsibilities → skills → salary → compat bar → actions); compat bar full-width; modal is bottom-sheet; toolbar is 2-row grid; filter panels expand inline; **page nav moves to bottom tab bar**; **+ New application becomes a FAB**; sign-out collapses to icon-only; email hidden; thin scrollbar (4px) on `<html>` |
| **Fold-narrow** `< 380px` | "Project Alice" wordmark hides — only the 38px logo mark remains beside the sign-out icon |

---

## Navigation Pages

| Page | Key | Description |
|---|---|---|
| Tracker | `tracker` | Card list with filters, sort, detail modal |
| Calendar | `calendar` | Current month grid with applied-date markers |
| Profile | `profile` | Stat cards: Total, Active, Offers, Rejections; also surfaces an "Archived applications · N →" link that deep-links to `Tracker.html?view=archived` |

Mobile bottom-tab icons:
- **Tracker** — list / clipboard glyph (rect + 3 lines)
- **Calendar** — month-grid glyph (rect + header rule + tick marks)
- **Profile** — person glyph (circle head + shoulders arc)

---

## Interaction Patterns

| Interaction | Behavior |
|---|---|
| Click card body | Opens Detail Modal in Edit mode |
| ✎ button (card) | Opens Detail Modal in Edit mode (same as card click) |
| + New application (desktop toolbar) | Opens the **Add-application gate** (Smart vs Manual entry → optional job-posting parse; see `application_overlay.md` §13), landing in the Detail Modal in Create mode — empty draft or parsed prefill, status defaults to Wishlisted |
| FAB (mobile) | Same as + New application |
| ⇄ button (card or modal) | Opens Status Dropdown anchored below button |
| 🔗 button | Copies `jobPostingUrl` to clipboard; fires toast |
| ★ button | Toggles favorite state (gold / default); persisted immediately, bypasses draft |
| × button (card) | Archives application after confirmation; removes from active list |
| ↺ button (archived card) | Unarchives application immediately (no confirm); row leaves the archived list, toast: `Unarchived.` |
| Click "Applications ▾" / "Archived ▾" chip | Opens the View popup (Active / Archived) |
| Select view in popup | Switches between active and archived lists; resets pagination; persists filters/sort; updates URL `?view=` param |
| 🗄 button (modal) | Archives application after confirmation; modal closes |
| ↺ button (modal, archived) | Unarchives application immediately (no confirm); modal closes; toast: `Unarchived.` |
| ✕ button (modal) | Attempts close — shows discard confirmation if draft has unsaved changes |
| Status change (modal) | Dropdown appears; on select, updates badge + header bg color immediately; counts as a draft change (date updates only on Save) |
| Click outside modal (backdrop) | Attempts close — shows discard confirmation if draft has unsaved changes |
| Click outside dropdown | Backdrop closes it |
| Escape (in field) | Reverts that field's edit without committing to draft |
| Escape (modal level) | Attempts close — shows discard confirmation if draft is dirty |
| Escape (dropdown / confirm dialog) | Closes dropdown or confirmation dialog only |
| `Cmd/Ctrl + S` | Saves modal draft if any changes are present; no-op when clean |
| `Cmd/Ctrl + Enter` | Commits a multi-line field edit and returns focus to modal |
| Body scroll with modal open | Locked (`overflow: hidden`) |
| Page navigation tabs (desktop top / mobile bottom) | Mounts/unmounts page; resets scroll to top |
| Sign out button | Calls `authStore.signOut()` (terminates the Supabase session) and fires a "Signed out." toast; the auth-state transition routes the user to the Welcome page |

---

## Empty & Error States

| State | CSS class | Message | Style |
|---|---|---|---|
| No applications | `.empty-state` | "No applications yet. Add your first one!" | Centered, `--t2`, `padding: 48px 24px` |
| Filter no results | `.empty-state.empty-state--filter` | "No applications match / the active filters." | DM Mono 12px, `#BBBBBB`, centered, line-height 1.8 |
| Archived view, no archived items | `.empty-state` | "Nothing archived yet. / Archived applications will appear here." | Same as `.empty-state` |
| Archived view, filters return nothing | `.empty-state.empty-state--filter` | "No archived items match / the active filters." | Same as filter no results |
| Load / network error | `.empty-state.empty-state--error` | "Cannot connect to the backend…" | Same as `.empty-state` |

---

## Data Fields (per application)

| Field | Type | Notes |
|---|---|---|
| `id` | Integer | Primary key; shown in ID pill, format `#NNN` zero-padded |
| `jobTitle` | String | Card headline, modal title |
| `companyName` | String | Card secondary text, company filter |
| `status` | Enum | See Status System; drives badge + left border |
| `lastStatusUpdate` | ISO date (`YYYY-MM-DD`) | Displayed as "Mon DD" format |
| `compat` | Integer 0–100 | Compat-bar fill + percentage label (card) and score ring (overlay). Deterministic score — see `application_overlay.md` §14.1. |
| `fav` | Boolean | Star button state |
| `responsibilities` | String | DM Mono, 2-line clamp in card, full in modal |
| `skills` | String[] | Rendered as pill tags |
| `salary` | Integer \| null | Stored as raw integer (e.g. `110000`). Displayed as `₱{value.toLocaleString('en-PH')}` (Philippine peso). `null` when no salary data. Lower bound used for sort/filter. |
| `recruiter` | String | Modal only |
| `jobPostingUrl` | String (URL) | Inline-editable in modal; clipboard copy button shown when non-empty |
| `location` | String \| null | Optional free text; filter dimension (Location filter) |
| `shift` | Enum \| null | `Day` · `Mid` · `Night` · `Flexible`; modal dropdown; filter dimension |
| `workSetup` | Enum \| null | `Remote` · `Hybrid` · `On-site` · `Field`; modal dropdown; filter dimension |
| `compatNotes` | String \| null | Compatibility **analysis prose** (LLM-written, target). Shown in the Compatibility panel; inline-editable in the live build. |
| `compatSummary` | String \| null | Compatibility **one-line headline** (LLM-written, target). Shown beside the verdict and in the collapsed panel preview; inline-editable in the live build. |
| `compatGeneratedOn` | String \| null | Display string (e.g. "Jun 9") for when the analysis was generated; rendered in the Compatibility footer meta. Not yet an ISO timestamp (so staleness isn't derived yet). |
| `minYears` | String | Minimum years of experience the role asks for (free text, e.g. "5+ years"); lives in the Overview panel. |
| `generalNotes` | String \| null | Free-text notes; full-span field at bottom of modal body |
| `preferredSkills` | String[] | Chip editor in modal; separate from `skills` (required skills); starts empty for all records |
| `_corrupt` | Boolean | Validation flag — set when `id`, `jobTitle`, or `companyName` is invalid |
| `archived` | Boolean | When `true`, row is hidden from the Active view and shown in the Archived view. Defaults to `false`. |
| `archivedDate` | ISO date (`YYYY-MM-DD`) \| null | Date the row was archived; populated automatically when `archived` flips to `true`. Cleared on unarchive. Displayed in the card's date-stamp slot as "Archived [date]". |

---

## Session Data (per user)

| Field | Type | Notes |
|---|---|---|
| `email` | String | Displayed in top-bar identity cluster (desktop only); truncated at 220px via CSS `max-width` |
| `signedIn` | Boolean | When `true`, the identity cluster renders (email + sign-out). When `false`, the identity cluster is **not rendered** — unauthenticated visitors never reach the Tracker; they're routed to the Welcome page (see `docs/design/welcome_page.md`). The Tracker chrome has no signed-out "Sign in" affordance. |

> Auth flow (sign-in, sign-up, password reset, gated routes) is owned by feature 018 (`specs/018-auth-user-access/spec.md`).
