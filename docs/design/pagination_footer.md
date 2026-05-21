# Design Spec — Pagination & Footer
**Project Alice · v0.3.0 · Apr 2026**

---

## 1. Pagination

### 1.1 Overview
A page navigation control rendered below the application card list whenever the total number of entries exceeds 10. Allows the user to move between fixed-size pages of results.

### 1.2 Trigger Condition
Render pagination **only** when `totalEntries > PAGE_SIZE` (PAGE_SIZE = 10).  
When 10 or fewer entries exist, the pagination block is fully hidden — no rule, no buttons.

### 1.3 Layout
```
[cards list]
────────────────────────────────────  ← <hr> separator
        [page buttons]                ← centered horizontally
```
- `<hr>` is a full-width horizontal rule separating cards from the nav.
- Page buttons are centered in the container (flexbox, `justify-content: center`, `gap: 6px`).

### 1.4 Page Window Algorithm

**Constants**
- `PAGE_SIZE = 10`
- `totalPages = Math.ceil(totalEntries / PAGE_SIZE)`

**Window calculation** (always 3 consecutive pages)
```
winStart = clamp(currentPage - 1, 1, totalPages - 2)
winEnd   = winStart + 2
```

**Render sequence**
| Condition | Items prepended/appended |
|---|---|
| `winStart > 1` | Prepend page `1` button |
| `winStart > 2` | Prepend `···` ellipsis (non-clickable) after page 1 |
| *(window pages)* | Render pages `winStart` → `winEnd` |
| `winEnd < totalPages - 1` | Append `···` ellipsis (non-clickable) |
| `winEnd < totalPages` | Append page `totalPages` button |

**Examples — 10 total pages**
| Current page | Rendered sequence |
|---|---|
| 1 | `1` `2` `3` `···` `10` |
| 2 | `1` `2` `3` `···` `10` |
| 3 | `1` `2` `3` `4` `···` `10` |
| 4 | `1` `···` `3` `4` `5` `···` `10` |
| 5 | `1` `···` `4` `5` `6` `···` `10` |
| 9 | `1` `···` `8` `9` `10` |
| 10 | `1` `···` `8` `9` `10` |

### 1.5 Behaviour
- Clicking a page button sets the current page, **scrolls the view to the top**, and moves keyboard focus to the top of the list region.
- The active page button is visually distinguished (filled accent background).
- Ellipsis items (`···`) are non-interactive — no cursor pointer, no hover state.
- Page state is local UI state. If the dataset changes, preserve the current page when it is still valid; otherwise move to the highest valid page, or page `1` when pagination is no longer needed.

### 1.6 Visual Spec

**HR separator**
```css
border: none;
border-top: 1.5px solid #e0ddd8;
margin-bottom: 14px;
```

**Page button (default)**
```css
min-width: 32px;
height: 32px;
border: 1.5px solid #e0ddd8;
border-radius: 5px;
background: #ffffff;
font-family: 'DM Mono', monospace;
font-size: 11px;
color: #555555;
```

**Page button (hover)**
```css
border-color: #4F46E5;
color: #4F46E5;
background: #f4f2ff;   /* --indigo-soft */
```

**Page button (active / current)**
```css
background: #4F46E5;
border-color: #4F46E5;
color: #ffffff;
font-weight: 600;
```

**Ellipsis (`···`)**
```css
min-width: 28px;
height: 32px;
font-family: 'DM Mono', monospace;
font-size: 12px;
color: #bbbbbb;
user-select: none;
letter-spacing: 1px;
/* content: "···" (middle-dot × 3) */
```

**Wrapper padding**
```css
padding: 0 20px 20px;
```

---

## 2. Footer

### 2.1 Overview
A persistent site footer rendered at the bottom of every page view. Dark-themed to match the topbar. Contains four sections: brand identity, version/build info, tech stack credits, and feedback links.

### 2.2 Layout

**Desktop (≥ 640px)** — 3-column grid inside a max-width container:
```
┌─────────────────────────────────────────────────────┐
│  [Alice icon] Project Alice  Your job search, org…  │  ← brand (full width)
│ ─────────────────────────────────────────────────── │  ← <hr>
│  VERSION         STACK            FEEDBACK          │
│  v0.3.0          Vanilla JS · Vite Report an issue  │
│  Built Apr 2026  Vitest · ESLint   Request a feature│
│ ─────────────────────────────────────────────────── │
│  © 2026 Project Alice. All rights reserved. · Part of reso's Project Series.  │
└─────────────────────────────────────────────────────┘
```

**Mobile (< 640px)** — 2-column grid; brand, rule, and copyright span full width.

**Max-width container:** `900px`, centered with `margin: 0 auto`.

### 2.3 Content Sections

| Section | Label | Content | Interactive? |
|---|---|---|---|
| Brand | — | Alice icon + "Project Alice" + "Your job search, organized." | No |
| Version | `VERSION` | `v0.3.0`, `Built Apr 2026` | No |
| Stack | `STACK` | `Vanilla JS · Vite`, `Vitest · ESLint` | No |
| Feedback | `FEEDBACK` | "Report an issue", "Request a feature" | Yes (links) |
| Copyright | — | `© 2026 Project Alice. All rights reserved. · Part of reso's Project Series.` | No |

> **Implementation note:** feedback links open `https://github.com/reso830/Project_Alice/issues/new` in a new tab.

> **Brand attribution:** "Part of reso's Project Series" is appended to the copyright line, separated by a `·` middot. Keep it on the same line — do not promote it to the brand section.

### 2.4 Visual Spec

**Footer container**
```css
background: #1a1a2e;
color: rgba(255, 255, 255, 0.5);
padding: 28px 20px 24px;
```

**Inner grid**
```css
display: grid;
grid-template-columns: 1fr 1fr 1fr;   /* 2-col on mobile */
gap: 20px 32px;
max-width: 900px;
margin: 0 auto;
```

**Brand row** — spans full grid width (`grid-column: 1 / -1`):
```css
display: flex;
align-items: center;
gap: 8px;
```

**Brand — icon**

`<img>` tag using `Alice_White.png`, `40×40px`, `object-fit: contain`, `aria-hidden="true"`. `flex-shrink: 0`.

```css
width: 40px;
height: 40px;
flex-shrink: 0;
object-fit: contain;
```

**Brand — name**
```css
color: #ffffff;
font-size: 13px;
font-weight: 600;
letter-spacing: 0.4px;
```

**Brand — tagline**
```css
font-size: 11px;
color: rgba(255, 255, 255, 0.38);
```

**Section label (e.g. "VERSION")**
```css
font-size: 8px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.9px;
color: rgba(255, 255, 255, 0.28);
margin-bottom: 2px;
```

**Section value text**
```css
font-family: 'DM Mono', monospace;
font-size: 10px;
color: rgba(255, 255, 255, 0.45);
line-height: 1.6;
```

**Feedback links (default)**
```css
font-family: 'DM Mono', monospace;
font-size: 10px;
color: rgba(255, 255, 255, 0.38);
background: none;
border: none;
padding: 0;
text-decoration: none;
display: block;
cursor: pointer;
line-height: 1.6;
```

**Feedback links (hover)**
```css
color: rgba(255, 255, 255, 0.75);
```

**Internal HR rule**
```css
border: none;
border-top: 1px solid rgba(255, 255, 255, 0.08);
grid-column: 1 / -1;
```

**Copyright line**
```css
font-family: 'DM Mono', monospace;
font-size: 9px;
color: rgba(255, 255, 255, 0.22);
grid-column: 1 / -1;
padding-top: 4px;
```
Content: `© 2026 Project Alice. All rights reserved. · Part of reso's Project Series.`

---

## 3. Tokens Reference

| Token | Value | Usage |
|---|---|---|
| `--navy` | `#1a1a2e` | Topbar, footer background |
| `--indigo` | `#4F46E5` | Active states, primary buttons |
| `--indigo-soft` | `#F4F2FF` | Pagination hover background |
| `--bg` | `#F4F1ED` | Page background |
| `--surface` | `#FFFFFF` | Card background |
| `--border` | `#E8E3DA` | Card borders |
| `--color-border` | `#E0DDD8` | HR rules, pagination/filter button borders |
| `--color-accent-light` | `#F4F2FF` | Pagination hover, filter hover background |
| `--pagination-text` | `#555555` | Pagination button default text |
| `--pagination-muted` | `#BBBBBB` | Ellipsis color |
| `--font-ui` | `'Sora', sans-serif` | All UI labels and body text |
| `--font-mono` | `'DM Mono', monospace` | IDs, dates, code values, pagination, footer |

---

## 4. Accessibility Notes

- Pagination `<button>` elements must have descriptive `aria-label` attributes: e.g. `aria-label="Go to page 4"`, `aria-label="Current page, page 5"` (with `aria-current="page"`).
- Ellipsis spans should use `aria-hidden="true"` — they carry no navigational meaning.
- Footer feedback links require `aria-label` for full context (e.g. `"Report an issue on GitHub"`).
- Brand icon (`<img>`) uses `alt=""` and `aria-hidden="true"` — it is decorative.
- Ensure 4.5:1 contrast ratio on all footer text against `#1a1a2e`.
