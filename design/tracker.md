# AppTracker — Design Spec

## Overview

A responsive web application for tracking job applications. Built with **Sora** (UI) and **DM Mono** (data/code) typefaces on a warm off-white background with a dark navy + indigo palette.

---

## Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `--navy` | `#1A1A2E` | Top bar background, ID pills, modal header |
| `--navy-2` | `#232342` | Hover state for navy elements |
| `--indigo` | `#4F46E5` | Primary accent, active nav, primary buttons |
| `--indigo-hover` | `#4338CA` | Button hover state |
| `--indigo-dim` | `#EEF2FF` | Hover backgrounds, count badge bg |
| `--indigo-mid` | `#818CF8` | Soft accents, calendar highlights |
| `--bg` | `#F4F1ED` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | Card and modal backgrounds |
| `--border` | `#E8E3DA` | Default borders |
| `--border-2` | `#D1CCB9` | Stronger borders on hover |
| `--t1` | `#1A1A2E` | Primary text |
| `--t2` | `#4B5563` | Secondary text |
| `--t3` | `#9CA3AF` | Muted / placeholder text |
| `--t4` | `#C4BDB5` | Ghost labels, separators |

---

## Typography

### Typefaces
| Role | Family | Import |
|---|---|---|
| UI / Headlines | **Sora** | `https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700` |
| Data / Code | **DM Mono** | `https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500` |

### Scale
| Element | Font | Size | Weight |
|---|---|---|---|
| App title (topbar) | Sora | 14px | 600 |
| Nav buttons | Sora | 12px | 500 |
| Card — Position | Sora | 14px | 600 |
| Card — Company | Sora | 13px | 400 |
| Card — Field label | Sora | 8px | 600 (uppercase, 0.8px tracking) |
| Card — Resp / Skills / Salary | DM Mono | 9px | 400 |
| ID Pill | DM Mono | 9px | 500 (0.5px tracking) |
| Status badge | Sora | 10px | 500 |
| Compat bar label | DM Mono | 9px | 500 |
| Modal title | Sora | 17px | 600 |
| Modal field label | Sora | 9px | 600 (uppercase) |
| Modal field value | Sora | 13px | 400 |
| Modal field value (mono) | DM Mono | 11px | 400 |
| Toolbar label | Sora | 13px | 500 |
| Button (primary) | Sora | 12px | 600 |
| Button (secondary) | Sora | 13px | 500 |
| Toast | Sora | 12px | 500 |

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

## Status System

Each status has a color (for left-border accent and dropdown dot) and a badge style.

| Status | Label | Accent Color | Badge bg | Badge text |
|---|---|---|---|---|
| `wishlist` | Wishlist | `#9333EA` | `#F3E8FF` | `#6B21A8` |
| `applied` | Applied | `#3B82F6` | `#DBEAFE` | `#1E40AF` |
| `screen` | Phone Screen | `#F97316` | `#FFEDD5` | `#9A3412` |
| `interview` | Interview | `#EAB308` | `#FEF9C3` | `#854D0E` |
| `assessment` | Technical Assessment | `#8B5CF6` | `#EDE9FE` | `#5B21B6` |
| `offer` | Offer | `#22C55E` | `#DCFCE7` | `#166534` |
| `rejected` | Rejected | `#EF4444` | `#FEE2E2` | `#991B1B` |
| `withdrawn` | Withdrawn | `#64748B` | `#F1F5F9` | `#475569` |
| `ghosted` | Ghosted | `#94A3B8` | `#F8FAFC` | `#64748B` (dashed border) |

Badge shape: `border-radius: 999px`, padding `3px 9px`, font `10px / 500`.

---

## Components

### Top Bar
- Height: `52px`
- Background: `--navy`
- Logo mark: `28×28px`, `border-radius: 7px`, background `--indigo`
- Sticky, `z-index: 100`
- Nav buttons: no border by default, active state fills `--indigo`

### Toolbar
- Height: auto, padding `11px 24px`
- Background: `--surface`
- Bottom border: `1px solid --border`
- Sticky below topbar, `z-index: 90`
- Count badge: `--indigo-dim` bg, `--indigo` text, pill shape

### Card
- Background: `--surface`
- Border: `1px solid --border`
- Border-radius: `--r-md` (10px)
- Left accent bar: `4px wide`, full height, color = status accent color
- Default shadow: `--shadow-xs`
- Hover: `--shadow-md` + `translateY(-1px)`
- Padding: `12px 16px`
- Cursor: pointer

**Card layout (3 rows):**

```
Row 1: [ID Pill]  [Status Badge]  [Updated date]  →  [Edit] [Status⇄] [Copy🔗] [Star]
Row 2: Position · Company                         →  [Compat Bar 30%]
Row 3: Responsibilities (2-line clamp) | Skills tags | Salary
```

### ID Pill
- Background: `--navy`, text: white
- Font: DM Mono 9px / 500, letter-spacing 0.5px
- Shape: `border-radius: 999px`, padding `2px 9px`

### Compatibility Bar
- Height: `18px`, full border-radius (pill)
- Background track: `#EDE8DF`
- Fill colors: `#22C55E` (≥80%), `#EAB308` (≥60%), `#4F46E5` (<60%)
- Label text color: **white** when fill ≥ 50%, `--t2` (`#4B5563`) when fill < 50%
- Label: `DM Mono 9px / 500`, centered absolutely over bar

### Quick Action Buttons
- Size: `28×28px`
- Border: `1px solid --border`, radius `--r-sm`
- Default color: `--t3`
- Hover: border `--indigo`, color `--indigo`, bg `--indigo-dim`
- Starred state: color `#D97706`, border `#FDE68A`, bg `#FFFBEB`

### Status Dropdown
- Background: `--surface`
- Border: `1px solid --border`, radius `--r-md`
- Shadow: `--shadow-lg`
- Min-width: `196px`, padding `5px`
- Each option: `8px 10px` padding, `border-radius: --r-sm`
- Color dot: `8×8px` circle in status accent color
- Active item: `--indigo` text, weight 600, checkmark on right
- Backdrop: full-screen transparent div to close on outside click

### Toast
- Fixed, bottom `24px`, horizontally centered
- Background: `--navy`, text: white
- Shape: pill (`border-radius: 999px`), padding `10px 18px`
- Shadow: `--shadow-lg`
- Green dot (✓): `16×16px` circle, `#22C55E`
- Auto-dismiss: 2400ms
- Entrance: `translateY(8px)` → `translateY(0)` + fade, 180ms ease

### Detail Modal
- Overlay: `rgba(8,8,24,.52)` + `backdrop-filter: blur(4px)`
- Max-width: `740px`, max-height: `90vh`, scrollable
- Border-radius: `--r-lg` (14px)
- Entrance: scale `0.97→1` + `translateY(8px→0)` + fade, 200ms
- Header: `--navy` background, 2-row layout (pills row + title row)
- Body: 2-column CSS grid, `gap: 16px 28px`, padding `22px`
- Full-span rows for: Responsibilities, Skills, URL, footer

### Add / Edit Form Modal
- Same modal shell as Detail
- Form grid: 2 columns on desktop, 1 column on mobile
- Input focus ring: `box-shadow: 0 0 0 3px rgba(79,70,229,.08)` + indigo border
- Compat slider: native `<input type="range">`, `accent-color: --indigo`, with live bar preview

---

## Responsive Breakpoints

| Breakpoint | Layout changes |
|---|---|
| **Desktop** `> 1024px` | Full 3-row card, compat bar 30% width, 2-col modal grid |
| **Tablet** `640–1023px` | Compat bar 36%, Responsibilities wraps to own row, modal becomes 1-col |
| **Mobile** `< 640px` | Cards stack vertically (each section per row), compat bar full-width, modal is bottom-sheet (slides from bottom, rounded top corners only) |

### Mobile card layout (stacked):
```
[ID Pill]  [Status Badge]        [Updated date]
Position (bold)
Company (muted)
[Compat Bar — full width]
Responsibilities (2-line clamp)
Skills tags
Salary                           [Edit][Status⇄][Copy][Star]
```

---

## Navigation Pages

| Page | Status |
|---|---|
| **Tracker** | Full implementation — card list, add/edit, modals |
| **Calendar** | Stub — month grid showing applied dates |
| **Profile** | Stub — stat cards (total, active, offers, rejections) |

---

## Interaction Patterns

| Interaction | Behavior |
|---|---|
| Click card | Opens Detail Modal |
| Edit button (card or modal) | Opens Edit Form Modal (pre-filled) |
| Status ⇄ button | Opens inline Status Dropdown |
| Copy URL button | Fires toast "URL copied to clipboard" |
| Star button | Toggles favorite state (gold fill) |
| Click URL in modal | Fires toast (no new tab) |
| Change Status (modal) | Dropdown opens above button |
| Click outside dropdown | Backdrop closes it |
| Click outside modal | Closes modal |
| Body scroll when modal open | Locked (`overflow: hidden`) |
| Add Application | Opens blank Form Modal, prepends new row on save |
| Save edits | Updates row in-place, re-syncs open modal |

---

## Data Fields (per application)

| Field | Type | Display |
|---|---|---|
| `id` | String (`J001`) | ID pill, DM Mono |
| `pos` | String | Card headline, modal title |
| `company` | String | Card row 2 (secondary) |
| `status` | Enum (see Status System) | Badge + left border |
| `resp` | Long string | DM Mono, 2-line clamp in card, full in modal |
| `skills` | Comma-separated string | Rendered as pill tags |
| `salary` | String | DM Mono |
| `compat` | Integer 0–100 | Compat bar |
| `date` | ISO date (`YYYY-MM-DD`) | "Apr 18" format |
| `updated` | ISO date | "Updated Apr 22" |
| `recruiter` | String | Modal only |
| `url` | String | Modal, click-to-copy |
| `fav` | Boolean | Star state |
