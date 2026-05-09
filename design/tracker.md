# AppTracker — Design Spec

## Overview

A responsive web application for tracking job applications. Built with **Sora** (UI) and **DM Mono** (data/code) typefaces on a warm off-white background with a dark navy + indigo palette.

---

## Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `--navy` | `#1A1A2E` | Top bar background, ID pills, footer |
| `--navy-2` | `#232342` | (reserved) |
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
| Modal title (job title) | Sora | 24px | 600 | click-to-edit inline in header |
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

### Detail Modal (Edit / Create)

> Full spec: [`design/application_overlay.md`](application_overlay.md)

- Overlay: `rgba(8,8,24,.52)` + `backdrop-filter: blur(4px)`; body scroll locked while open; `z-index: var(--z-modal)` (300)
- Entrance: scale `0.97→1` + `translateY(8px→0)` + fade in, 200ms ease
- **Header background:** status `borderAccent` color — NOT `--navy`

---

## Responsive Breakpoints

| Breakpoint | Layout changes |
|---|---|
| **Desktop** `> 1024px` | 3-row card, compat bar 30%, 2-col modal, toolbar single row |
| **Tablet** `640–1023px` | Compat bar 36%, Responsibilities spans full detail row, modal 1-col |
| **Mobile** `< 640px` | Card collapses to flex-column via CSS `order` (ID/badge/date → title → company → responsibilities → skills → salary → compat bar → actions); compat bar full-width; modal is bottom-sheet; toolbar is 2-row grid; filter panels expand inline |

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
| Click card body | Opens Detail Modal in Edit mode |
| ✎ button (card) | Opens Detail Modal in Edit mode (same as card click) |
| + New application | Opens Detail Modal in Create mode — empty draft, status defaults to Wishlisted |
| ⇄ button (card or modal) | Opens Status Dropdown anchored below button |
| 🔗 button | Copies `jobPostingUrl` to clipboard; fires toast |
| ★ button | Toggles favorite state (gold / default); persisted immediately, bypasses draft |
| × button (card) | Archives application after confirmation; removes from active list |
| 🗄 button (modal) | Archives application after confirmation; modal closes |
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
| `jobPostingUrl` | String (URL) | Inline-editable in modal; clipboard copy button shown when non-empty |
| `location` | String \| null | Optional free text; filter dimension (Location filter) |
| `shift` | Enum \| null | `Day` · `Mid` · `Night` · `Flexible`; modal dropdown; filter dimension |
| `workSetup` | Enum \| null | `Remote` · `Hybrid` · `On-site` · `Field`; modal dropdown; filter dimension |
| `compatNotes` | String \| null | Editable notes alongside the read-only compatibility bar |
| `generalNotes` | String \| null | Free-text notes; full-span field at bottom of modal body |
| `preferredSkills` | String[] | Chip editor in modal; separate from `skills` (required skills); starts empty for all records |
| `_corrupt` | Boolean | Validation flag — set when `id`, `jobTitle`, or `companyName` is invalid |
