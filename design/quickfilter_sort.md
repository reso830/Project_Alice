# Design Spec — Quick Filters & Sort
**Project Alice · v0.2.0 · Apr 2026**

---

## 1. Overview

Quick Filters and Sort are inline toolbar controls that let users narrow and reorder the application card list without leaving the main view. They live in the toolbar row alongside the subheader count. All filters stack with AND logic — multiple active filters narrow the result set cumulatively.

---

## 2. Toolbar Layout

### 2.1 Desktop (≥ 640px)

```
[ Applications (23) ]  [⏱][💰][📈][🏢][★][⏰][🏠][📍]  [✕]?  [↕]       [ + New application ]
  subheader + count badge        filter icons               erase  sort        primary action
```

- Filter icons sit immediately to the right of the subheader label.
- Eight filter icons: Status (⏱), Salary (💰), Compatibility (📈), Company (🏢), Favorites (★), Shift (⏰), Work Setup (🏠), Location (📍).
- Erase-all button appears **only** when ≥ 1 filter is active, between filter icons and sort icon.
- Sort icon is always visible, to the right of the erase button (or filter icons if no active filters).
- Primary action button (`+ New application`) is flush right via `margin-left: auto`.
- On mobile (`≤ 768px`): primary action button is hidden; a floating action button (FAB) `56×56px` circle appears fixed at bottom-right.

**Count badge** — the application count is a separate pill element (`.count-badge`):
```css
display: inline-flex;
align-items: center;
border-radius: 999px;
padding: 3px 10px;
background: #eef2ff;   /* --indigo-dim */
color: #4F46E5;        /* --indigo */
font-size: 12px;
font-weight: 500;
```

### 2.2 Mobile (≤ 768px)

The toolbar stays a single-row flex layout but condenses:
- Primary action button (`.new-app-btn`) is hidden; FAB takes over.
- Filter/sort buttons remain visible in the toolbar.

Filter and sort panels use the same `position: fixed` popup approach as desktop — they are **not** expanded inline. Panels are appended to `document.body` and positioned via JavaScript based on the button's `getBoundingClientRect()`. The `RangeSlider` width expands to `100%` on mobile.

---

## 3. Subheader Label

| State | Label |
|---|---|
| No filters active | `Applications` + count badge showing total N |
| Any filter active | `Results` + count badge showing filtered count X |

Font: Sora, 13px, weight 500. Label text color: `#FFFFFF` (white on toolbar).

---

## 4. Filter Icons

### 4.1 Spec

| Filter | Tooltip |
|---|---|
| Status | "Status" |
| Salary | "Salary" |
| Compatibility | "Compatibility" |
| Company | "Company" |
| Favorites | "Favorites" |
| Shift | "Shift" |
| Work Setup | "Work Setup" |
| Location | "Location" |

Each icon is an inline SVG, **15×15px**, `currentColor`, `aria-hidden="true"`.

**Button dimensions:** 28×28px  
**Border radius:** 5px

**States:**

| State | Style |
|---|---|
| Default | `border: 1.5px solid #e0ddd8`, `background: #fff`, `color: #888` |
| Hover | `border-color: #4F46E5`, `color: #4F46E5`, `background: #f4f2ff` |
| Active (filter applied) | `border-color: #4F46E5`, `color: #4F46E5`, `background: #eef2ff`, `aria-pressed="true"` |
| Open (popup visible) | Active styles + `box-shadow: 0 0 0 2px rgba(79,70,229,0.15)`, class `filter-btn--open` |
| Disabled (no data) | `opacity: 0.4`, `pointer-events: none`, `aria-disabled="true"` |

### 4.2 Tooltip

Appears **below** the icon on hover (`top: calc(100% + 6px)`). Tooltip text comes from the `title` attribute via CSS `::before` pseudo-element.

```css
background: #1a1a2e;
color: #fff;
font-family: 'DM Mono', monospace;
font-size: 10px;
padding: 3px 8px;
border-radius: 4px;
white-space: nowrap;
```

---

## 5. Filter Pop-ups

### 5.1 Container

```css
position: fixed;      /* appended to document.body, positioned via JS */
background: #ffffff;
border: 1.5px solid #e0ddd8;
border-radius: 8px;
box-shadow: 0 4px 20px rgba(0,0,0,0.12);
min-width: 220px;
z-index: 200;         /* var(--z-dropdown) */
```

Position calculated from the trigger button's `getBoundingClientRect()`: `top = rect.bottom + 8`, `left = rect.left` (clamped so panel doesn't overflow the right edge of the viewport).

Closed by clicking outside (document click listener) or pressing Escape. The icon is a toggle — tapping the same icon again closes the panel.

### 5.2 Header (all pop-ups)

```
[ FILTER TITLE ]                    [ ✕ ]
```

- Title: 10px, weight 600, uppercase, letter-spacing 0.7px, color `#aaa`
- Clear (✕) button: right-aligned, resets this filter only, closes pop-up
- Separator: `border-bottom: 1px solid #f0ede8`

### 5.3 Status Filter

Multi-select checklist. Each row:

```
[ ☐ ] ● Applied
```

- Checkbox: 14×14px, `border: 1.5px solid #e0ddd8`, `border-radius: 3px`
- Selected: filled `#4F46E5`
- Color dot: 7×7px circle, color = status `borderAccent` color (same single color used for badge/border/header)
- Row height: 34px; hover `background: #f4f2ff`
- Scrollable at `max-height: 220px` when list overflows
- List is limited to statuses present in the current (non-archived) dataset

### 5.4 Company Filter

Identical structure to Status Filter — multi-select checklist of company names, alphabetically sorted, derived from the current dataset.

### 5.5 Salary Filter — Dual Range Slider

Displays a two-handle range slider for filtering by salary range. Salary values are Philippine peso integers.

**Fixed range:** `₱50,000 – ₱250,000`. Button is disabled when no applications have salary data.  
**Step:** `SALARY_STEP` (from `filterSort.js`), snapped on mouseup/touchend.  
**Display format:** Abbreviated with peso sign — `₱90k`, `₱160k`. At the max (`₱250k`), shows `₱250k+`.

**Layout:**
```
  $95k                              $180k     ← current range labels (float above track)
  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●         ← track + thumbs
$90k                                      $240k  ← min/max bounds (below track)
```

**Behavior:**
- Thumbs follow pointer smoothly in real-time — no snapping during drag.
- Values snap to nearest $1k **only on mouseup/touchend**.
- Filter state updates on release only (avoids re-renders during drag).
- Min thumb cannot exceed `maxValue − $1k`; max thumb cannot go below `minValue + $1k`.

**Track**
```css
height: 4px;
border-radius: 2px;
background: #e0ddd8;   /* track */
/* fill segment: */
background: #4F46E5;   /* --color-accent */
```

**Thumb**
```css
width: 18px;
height: 18px;
border-radius: 50%;
background: #ffffff;
border: 2px solid #4F46E5;
box-shadow: 0 1px 4px rgba(0,0,0,0.15);
cursor: grab;
```

Hover: `box-shadow: 0 0 0 4px rgba(79,70,229,0.12)`  
Active drag: `cursor: grabbing`, `box-shadow: 0 0 0 5px rgba(79,70,229,0.18)`, class `range-thumb--active`

### 5.6 Compatibility Filter — Dual Range Slider

Identical to Salary slider with these differences:

| Property | Value |
|---|---|
| Min | 0 |
| Max | 100 |
| Step | 1 (percent) |
| Display format | `0%` → `100%` |

### 5.7 Favorites Filter

A toggle — no popup. Clicking the ★ button sets `favoritesOnly: true` in the filter state, showing only starred applications. Clicking again clears it. No panel is opened; the button's `aria-pressed` state reflects whether the filter is active.

### 5.8 Shift Filter

Identical structure to Status Filter — multi-select checklist. Fixed options (not derived from data):

| Value | Label |
|---|---|
| `Day` | Day |
| `Mid` | Mid |
| `Night` | Night |
| `Flexible` | Flexible |

Button is disabled when no applications exist (`totalCount === 0`).

### 5.9 Work Setup Filter

Identical structure to Status Filter — multi-select checklist. Fixed options (not derived from data):

| Value | Label |
|---|---|
| `Remote` | Remote |
| `Hybrid` | Hybrid |
| `On-site` | On-site |
| `Field` | Field |

Button is disabled when no applications exist (`totalCount === 0`).

### 5.10 Location Filter

Identical structure to Company Filter — multi-select checklist derived from the current dataset. Only non-empty, distinct `location` values from applications passing all other active filters are listed, sorted alphabetically. Empty and null location values are excluded.

Button is disabled when no applications exist (`totalCount === 0`).

---

## 6. Erase-All Button

Appears **only** when ≥ 1 filter is active. Inserted between filter icons and sort icon. Removed from DOM when no filters active.

**Icon:** X cross SVG (two diagonal lines), 15×15px.

```css
width: 28px;
height: 28px;
border: 1.5px solid #fca5a5;
border-radius: 5px;
background: #fff5f5;
color: #ef4444;
```

Hover: `background: #fee2e2`, `border-color: #ef4444`

**Action:** Clears all active filters simultaneously, resets page to 1, restores subheader to "All Applications".

---

## 7. Sort

### 7.1 Sort Icon Button

Same 28×28px icon button spec as filter icons. Active state (non-default sort applied) uses the same indigo active style (`aria-pressed="true"`).

Tooltip: `"Sort"`

### 7.2 Sort Pop-up

```css
position: absolute;
top: calc(100% + 8px);
left: 0;
background: #ffffff;
border: 1.5px solid #e0ddd8;
border-radius: 8px;
box-shadow: 0 4px 20px rgba(0,0,0,0.12);
min-width: 220px;
z-index: 500;
padding: 5px 0;
```

**Structure:**

```
  SORT BY
  ○ Job ID
  ○ Status
  ○ Compatibility
  ○ Salary
  ○ Company
  ─────────────
  ORDER
  ○ Ascending ↑
  ○ Descending ↓
  ─────────────
  Restore default
```

- Section labels: 8px, uppercase, `color: #ccc`, `letter-spacing: 0.8px`, padding `7px 10px 4px`
- Options: 11px, `color: #333`; selected: `color: #4F46E5`, weight 500, prefixed with `✓ `
- Row height: 32px; hover: `background: #f4f2ff`
- Dividers: `border-top: 1px solid #f0ede8`, `margin-top: 5px`

**Sort fields:**

| Key | Label |
|---|---|
| `id` | Job ID |
| `status` | Status (sorted by enum order) |
| `compat` | Compatibility |
| `salary` | Salary (sorts by lower bound of range) |
| `companyName` | Company |

**Default sort:** `field = id`, `direction = asc`. Sort icon shows no active styling when default is in effect.

**Restore default:** Resets to default sort state and closes the panel. Styled `color: #ccc` normally; turns red (`#ef4444`) on hover.

---

## 8. Active Filter Persistence & Page Reset

- Changing any filter resets the current page to `1`.
- **Filter state persists to `localStorage`** (key: `apptracker_filters`) and is restored on page load. Invalid or out-of-range values are discarded on restore. This includes the `shifts`, `workSetups`, and `locations` arrays — invalid enum values are stripped on restore; unrecognised location strings are kept as-is since location is free text.
- Sort state is session-only (not persisted to localStorage).
- Salary filter button is disabled when no applications have salary data.

---

## 9. Empty State

When active filters return 0 results, display in place of the card list:

```
No applications match
the active filters.
```

```css
text-align: center;
padding: 48px 20px;
color: #bbbbbb;
font-family: 'DM Mono', monospace;
font-size: 12px;
line-height: 1.8;
```

---

## 10. Tokens Reference

| Token | Value | Usage |
|---|---|---|
| `--color-accent` | `#4F46E5` | Active filter icons, track fill, thumb border |
| `--color-accent-light` | `#f4f2ff` | Hover background |
| `--color-accent-tint` | `#eef2ff` | Active filter icon background |
| `--color-border` | `#e0ddd8` | Default button borders, popup borders |
| `--color-danger` | `#ef4444` | Erase-all button, restore-default hover |
| `--color-danger-bg` | `#fff5f5` | Erase-all button background |
| `--color-bg-dark` | `#1a1a2e` | Tooltip background |
| `--font-ui` | `'Sora', sans-serif` | Subheader, option labels |
| `--font-mono` | `'DM Mono', monospace` | Tooltips, section labels, slider values |

---

## 11. Accessibility Notes

- Each filter icon button requires `aria-label` (e.g. `aria-label="Filter by Status"`, `aria-label="Filter by Shift"`, `aria-label="Filter by Work Setup"`, `aria-label="Filter by Location"`).
- When a filter is active, add `aria-pressed="true"` to the icon button.
- The erase-all button: `aria-label="Clear all filters"`.
- Slider thumbs require `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-label`.
- Sort restore: `aria-label="Restore default sort"`.
- Keyboard: panels are closeable with `Escape`; focus returns to the triggering button.
- When all apps are disabled (empty list), filter and sort buttons use `aria-disabled="true"` and `disabled`.
