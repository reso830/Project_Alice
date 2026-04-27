# Design Spec — Quick Filters & Sort
**Project Alice · Wireframe v0.1.0 · Apr 2026**

---

## 1. Overview

Quick Filters and Sort are inline toolbar controls that let users narrow and reorder the application card list without leaving the main view. They live in the toolbar row alongside the subheader count. All filters stack with AND logic — multiple active filters narrow the result set cumulatively.

---

## 2. Toolbar Layout

### 2.1 Desktop (≥ 640px)

```
[ All Applications (23) ]  [⏱][💰][📈][🏢]  [✕]?  [↕]       [ + Add Application ]
  subheader                 filter icons        erase  sort        primary action
```

- Filter icons sit immediately to the right of the subheader label.
- Erase-all button appears **only** when ≥ 1 filter is active, between filter icons and sort icon.
- Sort icon is always visible, to the right of the erase button (or filter icons if no active filters).
- Primary action button is flush right.

### 2.2 Mobile (< 640px)

Two-row toolbar:

**Row 1:** Subheader label | Primary action button (compact)
**Row 2:** Filter icons + erase (if active) + sort icon

Tapping any filter or sort icon expands an **inline panel** directly below row 2 (no floating popup). The panel retracts when:
- The same icon is tapped again (toggle)
- The clear button inside the panel is tapped
- Settings are applied (user taps away or clears)

---

## 3. Subheader Label

| State | Label |
|---|---|
| No filters active | `All Applications (N)` where N = total entry count |
| Any filter active | `Results (X)` where X = count of filtered entries |

Font: Sora, 13px, weight 500. Count is `<strong>` weight 600.

---

## 4. Filter Icons

### 4.1 Spec

| Filter | Icon description | Tooltip |
|---|---|---|
| Status | Clock / circle with hand | "Filter by Status" |
| Salary | Bag / currency icon | "Filter by Salary" |
| Compatibility | Line-chart / trend upward | "Filter by Compatibility" |
| Company | Building / briefcase | "Filter by Company" |

Each icon is rendered as an inline SVG, 13×13px, `currentColor`.

**Button dimensions:** 28×28px  
**Border radius:** 5px

**States:**

| State | Style |
|---|---|
| Default | `border: 1.5px solid #e0ddd8`, `background: #fff`, `color: #888` |
| Hover | `border-color: #4F46E5`, `color: #4F46E5`, `background: #f4f2ff` |
| Active (filter applied) | `border-color: #4F46E5`, `color: #4F46E5`, `background: #eef2ff` |
| Open (popup visible) | Active styles + `box-shadow: 0 0 0 2px rgba(79,70,229,0.15)` |

### 4.2 Tooltip

Appears on hover, above the icon (`bottom: calc(100% + 6px)`).

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

## 5. Filter Pop-ups (Desktop)

### 5.1 Container

```css
position: absolute;
top: calc(100% + 8px);
left: 0;              /* anchored below the icon */
background: #ffffff;
border: 1.5px solid #e0ddd8;
border-radius: 8px;
box-shadow: 0 4px 20px rgba(0,0,0,0.12);
min-width: 220px;
z-index: 500;
```

Closed by clicking outside (backdrop listener on `document`). The icon's open state is a toggle — tapping the same icon again closes it.

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
- Selected: filled `#4F46E5`, white checkmark SVG inside
- Color dot: 7px circle, color matches status badge color
- Row height: ~34px; hover `background: #f4f2ff`
- Scrollable at `max-height: 220px` when list overflows

> **Implementation note:** The list should only show statuses that exist among the currently visible (non-archived) entries. This is a backend/logic concern — design assumes full list for the wireframe.

### 5.4 Company Filter

Identical structure to Status Filter — multi-select checklist of company names.

> **Implementation note:** List should be derived from non-archived entries in the dataset. Alphabetically sorted.

### 5.5 Salary Filter — Dual Range Slider

Displays a two-handle range slider for filtering by salary range.

**Bounds:** `$0` (or dataset minimum) → dataset maximum (rounded to nearest $1k)  
**Step:** $1,000 (snapped on release)  
**Display format:** Abbreviated — `$90k`, `$160k`

**Layout:**
```
  $95k                              $180k     ← current range labels
  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●         ← track + thumbs
$90k                                      $240k  ← min/max bounds
```

**Behavior:**
- Thumbs follow the pointer **smoothly in real-time** — no snapping during drag.
- Values snap to the nearest $1k **only on mouseup/touchend**.
- Parent component (filter state) is updated only on release, not during drag, to avoid re-renders affecting drag responsiveness.
- Min thumb cannot exceed `maxValue − $1k`; max thumb cannot go below `minValue + $1k`.

**Track fill:**
```css
background: #4F46E5;
height: 4px;
border-radius: 2px;
```

**Thumb:**
```css
width: 18px; height: 18px;
border-radius: 50%;
background: #ffffff;
border: 2px solid #4F46E5;
box-shadow: 0 1px 4px rgba(0,0,0,0.15);
cursor: grab;
```

Hover: `box-shadow: 0 0 0 4px rgba(79,70,229,0.12)`  
Active drag: `cursor: grabbing`, `box-shadow: 0 0 0 5px rgba(79,70,229,0.18)`

**Z-index:** The dragging thumb is elevated to `z-index: 4`; the idle thumb sits at `z-index: 2–3`.

### 5.6 Compatibility Filter — Dual Range Slider

Identical to Salary slider with these differences:

| Property | Value |
|---|---|
| Min | 0 |
| Max | 100 |
| Step | 1 (percent) |
| Display format | `0%` → `100%` |
| Label format | `{value}%` |

---

## 6. Erase-All Button

Appears **only** when ≥ 1 filter is active. Positioned between the filter icons and the sort icon.

```css
width: 28px; height: 28px;
border: 1.5px solid #fca5a5;
border-radius: 5px;
background: #fff5f5;
color: #ef4444;
```

Hover: `background: #fee2e2`, `border-color: #ef4444`

**Action:** Clears all active filters simultaneously, resets page to 1, restores subheader to "All Applications (N)".

---

## 7. Sort

### 7.1 Sort Icon Button

Same 28×28px icon button spec as filter icons. Active state (non-default sort applied) uses the same indigo active style.

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
min-width: 200px;
z-index: 500;
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
  [✕] Restore default
```

- Section labels: 8px, uppercase, `color: #ccc`, `letter-spacing: 0.8px`
- Options: 11px, `color: #333`; selected: `color: #4F46E5`, weight 500, prefixed with `✓`
- Row hover: `background: #f4f2ff`
- Dividers: `border-top: 1px solid #f0ede8`

**Sort fields:**

| Key | Label |
|---|---|
| `id` | Job ID |
| `status` | Status |
| `compat` | Compatibility |
| `salary` | Salary (sorts by lower bound of range) |
| `company` | Company |

**Restore default:** Resets to `field = id`, `direction = asc`. Styled in `color: #ccc`, turns red on hover. Closes the pop-up.

**Default sort:** ID ascending. This is the implicit state — no sort icon active styling when default is in effect.

---

## 8. Active Filter Persistence & Page Reset

- Changing any filter resets the current page to `1`.
- Filters are local UI state — they do not persist across sessions (implementation may add persistence later).
- Sort state persists for the session alongside filters.

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

- Each filter icon button requires `aria-label` (e.g. `aria-label="Filter by Status"`).
- When a filter is active, add `aria-pressed="true"` to the icon button.
- Pop-ups should be `role="dialog"` or `role="listbox"` as appropriate, with `aria-label` matching the filter name.
- Checkboxes in Status/Company filters should use `role="checkbox"` with `aria-checked`.
- Slider thumbs require `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-label`.
- Erase-all: `aria-label="Clear all filters"`.
- Sort restore: `aria-label="Restore default sort"`.
- Keyboard: pop-ups should be closeable with `Escape`; focus should return to the triggering icon button.
