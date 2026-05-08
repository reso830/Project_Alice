# AppTracker — Design Spec

## Overview

A responsive web application for tracking job applications. Built with **Sora** (UI) and **DM Mono** (data/code) typefaces on a warm off-white background with a dark navy + indigo palette.

---

## Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `--navy` | `#1A1A2E` | Top bar background, ID pills, modal header, footer |
| `--navy-2` | `#232342` | Modal status button background |
| `--indigo` | `#4F46E5` | Primary accent, active nav, primary buttons |
| `--indigo-hover` | `#4338CA` | Button hover state |
| `--indigo-dim` | `#EEF2FF` | Hover backgrounds, count badge bg, skill tag bg |
| `--indigo-mid` | `#818CF8` | Calendar day dot color |
| `--indigo-soft` | `#F4F2FF` | Pagination button hover background |
| `--bg` | `#F4F1ED` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | Card and modal backgrounds |
| `--border` | `#E8E3DA` | Default borders |
| `--border-2` | `#D1CCB9` | Stronger border on card hover |
| `--t1` | `#1A1A2E` | Primary text |
| `--t2` | `#4B5563` | Secondary text |
| `--t3` | `#9CA3AF` | Muted / placeholder text |
| `--t4` | `#C4BDB5` | Ghost labels, separators |
| `--color-accent` | `#4F46E5` | Alias for `--indigo` (used in filter/toolbar components) |
| `--color-border` | `#E0DDD8` | Filter button and panel borders |
| `--color-accent-light` | `#F4F2FF` | Filter/sort hover background |
| `--color-accent-tint` | `#EEF2FF` | Active filter button background |
| `--color-danger` | `#EF4444` | Erase-all button, error indicators |
| `--color-danger-bg` | `#FFF5F5` | Erase-all button background |
| `--color-bg-dark` | `#1A1A2E` | Tooltip background |
| `--pagination-text` | `#555555` | Pagination button text |
| `--pagination-muted` | `#BBBBBB` | Pagination ellipsis color |

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
| Nav buttons | Sora | 12px | 500 | |
| Card — Position | Sora | 14px | 600 | |
| Card — Company | Sora | 13px | 400 | |
| Card — Field label | Sora | 9px | 500 | uppercase, 0.3px tracking |
| Card — Resp / Skills / Salary | DM Mono | 11px | 400 | line-height 1.45 |
| ID Pill | DM Mono | 10px | 500 | |
| Status badge | Sora | 10px | 500 | |
| Compat bar label | DM Mono | 9px | 500 | |
| Modal title | Sora | 18px | 600 | |
| Modal field label | Sora | 11px | 500 | |
| Modal field value | Sora | 13px | 400 | line-height 1.5 |
| Toolbar label | Sora | 13px | 500 | |
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

---

## Z-Index Stack

| Layer | Token | Value |
|---|---|---|
| Navigation | `--z-nav` | 100 |
| Toolbar | `--z-toolbar` | 90 |
| Dropdown | `--z-dropdown` | 200 |
| Modal | `--z-modal` | 300 |
| Toast | `--z-toast` | 400 |

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
| `assessment` | Technical Assessment | `#e0aaff` | `#212529` |
| `offer` | Offer | `#09bc8a` | `#212529` |
| `rejected` | Rejected | `#9d0208` | `#ffffff` |
| `withdrawn` | Withdrawn | `#343a40` | `#ffffff` |
| `ghosted` | Ghosted | `#ced4da` | `#212529` |

Badge shape: `border-radius: 999px`, padding `3px 9px`, font `10px / 500`.

> **Note on modal header contrast:** The modal header background is the status `borderAccent` color. The header text/icon color is determined at runtime via relative-luminance contrast calculation — not hard-coded — and resolves to either `modal-header--light` (white text) or `modal-header--dark` (black text).

---

## Components

### Top Bar
- Height: `52px`
- Background: `--navy`
- Logo mark: `38×38px` PNG image (`Alice_White.png`), no border or background styling
- Logo text: "Project Alice", white, 15px / 600, letter-spacing −0.3px
- Sticky, `z-index: 100`
- Nav buttons: `padding: 7px 11px`, radius `--r-sm`, no border by default; active state fills `--indigo`
- Mobile (`< 640px`): navbar padding `0 14px`, nav button padding `7px 8px`, gap `4px`

### Toolbar
- Height: auto, padding `11px 24px`
- Background: `--surface`
- Bottom border: `1px solid --border`
- Sticky below topbar, `z-index: 90`
- Count badge: pill shape, `--indigo-dim` bg, `--indigo` text, 12px / 500, padding `3px 10px`

### Card
- Background: `--surface`
- Border: `1px solid --border`, radius `--r-md` (10px)
- Left accent: `border-left: 4px solid <status accent color>` (inline style)
- Default shadow: `--shadow-xs`
- Hover: border `--border-2`, shadow `--shadow-md`, `translateY(-1px)`, 160ms ease
- Padding: `12px 16px`; grid gap `10px`
- Cursor: pointer; keyboard accessible (`tabIndex=0`)

**Corrupt card variant:** border `#FECACA`, background `#FEF2F2`; shows `⚠` icon (`.card-warning`, `#DC2626`) in meta row.

**Card layout (3 rows, desktop):**

```
Row 1: [ID Pill]  [Status Badge]  [Updated date]  →  [✎] [⇄] [🔗] [★] [×]
Row 2: Position · Company                         →  [Compat Bar — 30%]
Row 3: Responsibilities (2-line clamp) | Skills tags | Salary
```

Row 3 grid: `minmax(0, 2fr) minmax(140px, 1fr) minmax(90px, .6fr)`

### ID Pill
- Background: `--navy`, text: white
- Font: DM Mono 10px / 500
- Shape: `border-radius: 999px`, padding `3px 9px`

### Compatibility Bar
- Height: `18px`, pill border-radius
- Background track: `#EDE8DF`
- Fill colors: `#22C55E` (score ≥ 80), `#EAB308` (score ≥ 60), `#4F46E5` (score < 60)
- Label text color: `#FFFFFF` when score ≥ 50, `#4B5563` when score < 50
- Label: DM Mono 9px / 500, centered absolutely over bar
- Width: 30% of middle row on desktop (min 150px); 36% on tablet; 100% on mobile

### Quick Action Buttons
- Size: `28×28px`
- Border: `1px solid --border`, radius `--r-sm`
- Default color: `--t3`
- Hover: border `--indigo`, color `--indigo`, bg `--indigo-dim`

| Button | Icon | `aria-label` |
|---|---|---|
| Open details | ✎ | "Open application details" |
| Change status | ⇄ | "Change status" |
| Copy job URL | 🔗 | "Copy job URL" |
| Star / favorite | ★ | "Star application" |
| Archive | × | "Archive application permanently from active list" |

> **Archive confirm dialog:** Archiving (from card × or modal × button) triggers a `ConfirmDialog` before proceeding. The dialog is a centered modal at `z-index: var(--z-modal) + 10`, max-width `380px`, with "Archive this application?" message and Cancel / Confirm buttons.

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

### Detail Modal
- Overlay: `rgba(8,8,24,.52)` + `backdrop-filter: blur(4px)`
- Max-width: `740px`, max-height: `90vh`, scrollable
- Border-radius: `--r-lg` (14px)
- Entrance: scale `0.97→1` + `translateY(8px→0)` + fade in, 200ms ease
- **Header background: status `borderAccent` color** (NOT `--navy`; changes dynamically when status is updated)
- Header structure (3 rows):
  - Row 1 (`.modal-header__meta`): ID pill + status badge
  - Row 2 (`.modal-header__title-row`): job title (`<h2>`)
  - Row 3 (`.modal-quick-actions`): ★ Favorite · ⇄ Change Status · × Archive — each a `modal-quick-action` button with `background: rgba(255,255,255,.14)`, `border: 1px solid currentColor`
- Body: 2-column CSS grid, `gap: 16px 28px`, padding `22px`
- Full-span fields (`grid-column: 1 / -1`): Responsibilities, Skills, URL
- Closes on: backdrop click, Escape key; body scroll locked (`overflow: hidden`) while open

**Modal fields:** Company · Recruiter · Salary · Compatibility (%) · Last status update · Responsibilities · Skills · URL (clickable copy button)

**URL field behavior:** URL is rendered as a `<button>` (`modal-link-field`) that copies to clipboard. Disabled + dimmed (`opacity: 0.4`) when no URL is on file.

**Mobile modal:** bottom-sheet — fixed to bottom edge, `border-radius: 14px 14px 0 0`, max-height 90vh, slides up (`translateY(100%) → 0`, 250ms ease-out). Body becomes 1-column.

---

## Responsive Breakpoints

| Breakpoint | Layout changes |
|---|---|
| **Desktop** `> 1024px` | 3-row card, compat bar 30%, 2-col modal, toolbar single row |
| **Tablet** `640–1023px` | Compat bar 36%, Responsibilities spans full detail row, modal 1-col |
| **Mobile** `< 640px` | Card becomes flex-column via CSS `order`, compat bar full-width, modal is bottom-sheet, toolbar is 2-row grid, filter panels expand inline |

### Mobile card stacking order (CSS `order` property):
```
1: [ID Pill] [Status Badge] [Updated date]
2: Position (job title)
3: Company
4: Responsibilities (2-line clamp)
5: Skills tags
6: Salary
7: [Compat Bar — full width]
8: action buttons (right-aligned) [✎] [⇄] [🔗] [★] [×]
```

---

## Navigation Pages

| Page | Key | Description |
|---|---|---|
| Tracker | `tracker` | Card list with filters, sort, detail modal |
| Calendar | `calendar` | Current month grid with applied-date markers |
| Profile | `profile` | Stat cards: Total, Active, Offers, Rejections |

---

## Interaction Patterns

| Interaction | Behavior |
|---|---|
| Click card body | Opens Detail Modal |
| ✎ button (card) | Opens Detail Modal (same behavior as card click) |
| ⇄ button (card or modal) | Opens Status Dropdown anchored below button |
| 🔗 button | Copies `jobPostingUrl` to clipboard; fires toast |
| ★ button | Toggles favorite state (gold / default); persisted |
| × button | Archives application; removes from list; updates count |
| Status change (modal) | Dropdown appears; on select, updates badge + date in modal header |
| Click outside modal | Closes modal |
| Click outside dropdown | Backdrop closes it |
| Escape | Closes modal or dropdown |
| Body scroll with modal open | Locked (`overflow: hidden`) |
| Page navigation tabs | Mounts/unmounts page; resets scroll to top |

---

## Empty & Error States

| State | CSS class | Message | Style |
|---|---|---|---|
| No applications | `.empty-state` | "No applications yet. Add your first one!" | Centered, `--t2`, `padding: 48px 24px` |
| Filter no results | `.empty-state.empty-state--filter` | "No applications match / the active filters." | DM Mono 12px, `#BBBBBB`, centered, line-height 1.8 |
| Load / network error | `.empty-state.empty-state--error` | "Cannot connect to the backend…" | Same as `.empty-state` |

---

## Data Fields (per application)

| Field | Type | Notes |
|---|---|---|
| `id` | Integer | Primary key; shown in ID pill |
| `jobTitle` | String | Card headline, modal title |
| `companyName` | String | Card secondary text, company filter |
| `status` | Enum | See Status System; drives badge + left border |
| `lastStatusUpdate` | ISO date (`YYYY-MM-DD`) | Displayed as "Mon DD" format |
| `compat` | Integer 0–100 | Compat bar fill + percentage label |
| `fav` | Boolean | Star button state |
| `responsibilities` | String | DM Mono, 2-line clamp in card, full in modal |
| `skills` | String[] | Rendered as pill tags |
| `salary` | Integer \| null | Stored as raw integer (e.g. `110000`). Displayed as `₱{value.toLocaleString('en-PH')}` (Philippine peso). `null` when no salary data. Lower bound used for sort/filter. |
| `recruiter` | String | Modal only |
| `jobPostingUrl` | String (URL) | Copy URL button; displayed in modal |
| `_corrupt` | Boolean | Validation flag — set when `id`, `jobTitle`, or `companyName` is invalid |
