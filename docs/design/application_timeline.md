# Application Timeline — Design Spec

> Supplements [`tracker.md`](tracker.md) and the Detail Modal in [`application_overlay.md`](application_overlay.md). This spec defines the **Timeline** field — the progress log that lives inside the Detail Modal and replaces the previous *Last Updated* read-only line.

---

## Overview

The Timeline is a chronological, user-editable log of progress events for a single application. It sits inside the Detail Modal as a **full-width** field that toggles between a one-line **collapsed** preview and a vertical **expanded** log with an inline add-entry row at the top.

Each entry is `{ date, status, text }`. Entries are sorted **latest first**. The latest entry powers the collapsed preview; the modal header still derives its `status` and accent color from the application's current `status` (not the latest entry).

This field replaces the previous static *Last Updated* cell. The `lastStatusUpdate` field on the row is still bumped automatically when status changes — but it is no longer shown verbatim in the modal; the Timeline supersedes it.

---

## Modes

| Mode | Trigger | Display |
|---|---|---|
| **Collapsed** | Default state when modal opens | Single-line preview of the latest entry (or "No entries yet" placeholder) |
| **Expanded** | Click the row, the chevron, or `Enter`/`Space` while focused | Add-entry row + full vertical log, latest first |

Mode is **session-local** — it does not persist to the row. Reopening the modal starts collapsed.

---

## Frame placement

The Timeline cell occupies row 5 of the modal body grid as a **full-width** field (`grid-column: 1 / -1`). On the previous spec this slot was the *Last Updated* / blank pair; both are replaced by a single Timeline cell.

Updated field order in the modal body:

| # | Col 1                   | Col 2                   |
| - | ----------------------- | ----------------------- |
| 1 | Company                 | Recruiter               |
| 2 | Location                | Salary                  |
| 3 | Shift                   | Work Setup              |
| 4 | Compatibility (bar)     | Compatibility Notes     |
| **5** | **Timeline (full)** | — |
| 6 | Responsibilities (full) | — |
| 7 | Required Skills (full)  | — |
| 8 | Preferred Skills (full) | — |
| 9 | URL (full)              | — |
| 10| General Notes (full)    | — |

---

## Collapsed state

```
TIMELINE
›  Apr 22  —  [● Interview]  Tech round 1 with frontend lead.
```

- Label: `mfield-label` (Sora 11px / 500, `--t3`) — reads **"Timeline"**.
- Row container (`.tl-collapsed`):
  - Flex row, `gap: 8px`, `padding: 6px 8px`, `margin: 0 -8px`, `border-radius: 4px`
  - Cursor `pointer`; hover bg `--indigo-soft`; focus-visible outline 2px `--indigo`
  - `role="button"`, `tabIndex={0}`; `Enter` / `Space` expand
- Chevron (`.tl-chev`): DM Mono `›` glyph, 14px, `--t3`
  - On hover: translates `+2px` and recolors to `--indigo`
  - In expanded state, the collapse button uses a rotated 90° version (`.tl-chev-down`)
- Date (`.tl-date-text`): DM Mono 11px / 500, `--t2`, formatted `Mon D` (e.g. `Apr 22`)
- Em-dash separator (`.tl-dash`): `--t4`, 11px
- Status pill: standard `.badge` for the entry's `status` (latest entry's status — may differ from the row's current status)
- Note text (`.tl-text-line`): Sora 12px, `--t2`; flex-grows, single-line ellipsis truncate. Omitted when entry has empty text.

**Empty state:** when the timeline array is empty, the preview shows a single italic `--t4` line:
```
TIMELINE
›  No entries yet — click to add
```

---

## Expanded state

```
TIMELINE                                                              ›̌ Collapse

⊙ ──  [2026-04-25 ▾] —  [● Status ▾]  What happened? (optional)        [+ Add]
│
●  Apr 22  —  [● Interview]   Tech round 1 with frontend lead.            ×
│
●  Apr 21  —  [● Phone Screen] 30-min chat with Jane Kim — strong vibes.  ×
│
●  Apr 19  —  [● Phone Screen] Recruiter screen scheduled.                ×
│
●  Apr 18  —  [● Applied]      Submitted via referral from Marie.         ×
```

### Header row

A flex row with the label on the left and a **Collapse** button on the right.

- `.tl-header`: `display: flex; justify-content: space-between; align-items: center`
- Collapse button (`.tl-collapse-btn`):
  - Sora 11px / 500, `--t3`, padding `2px 6px`, radius `4px`
  - Hover: `--indigo` text, `--indigo-soft` bg
  - Left glyph is a 90°-rotated `›` (DM Mono 12px)
  - `aria-label="Collapse timeline"`

### Entry row layout

Each entry (including the add-entry row) is a CSS grid:

```
grid-template-columns: 16px  auto  auto  auto  minmax(0, 1fr)  auto
                       node  date  dash  pill  text             del/add
gap: 0 8px
align-items: center
padding: 7px 0
```

The vertical connector line is drawn with `::after` on every row except the last:

```css
.tl-row::after {
  content: '';
  position: absolute;
  left: 7px; top: 28px; bottom: -7px;
  width: 2px; background: var(--border);
  z-index: 0;
}
```

### Node circle

- `width: 14px; height: 14px; border-radius: 50%`
- `border: 2.5px solid <accent>` — accent is the entry's status `borderAccent`
- `background: --surface`
- `z-index: 1` (sits above connector line)
- Justify-self centered in its 16px column

**New-entry node variant** (`.tl-node-new`):
- `border-style: dashed`
- `border-color: --t4`
- `background: --bg`

### Add-entry row (always topmost)

- Date input (`.tl-date-input`): native `<input type="date">`, DM Mono 11px, `1.5px solid --border`, radius 4px, width 130px. `max={today}` prevents future-dating.
- Em-dash separator (`.tl-dash`)
- Status picker: see **Inline status picker** below; defaults to the row's current `status`.
- Text input (`.tl-text-input`): Sora 12px, full-width within its cell, placeholder *"What happened? (optional)"*. `--t4` placeholder color.
- Add button (`.tl-add`): `--indigo` bg, white, 11px / 600, padding `5px 12px`, radius 4px. Label is **"+ Add"**. Hover → `--indigo-hover`. Disabled (no date selected) → `--t4` bg, opacity 0.6, `cursor: not-allowed`.
- Pressing `Enter` inside the text input commits the entry (same as clicking + Add).
- On commit: the entry is appended to the timeline, text resets to empty, date resets to today, status resets to the row's current `status`, and focus returns to the text input for rapid sequential logging.

### Existing entries

- Date (`.tl-date-text`): DM Mono 11px / 500, `--t2`, formatted `Mon D`
- Em-dash separator
- Status pill: clickable — opens the inline status picker, lets the user re-classify an entry without deleting it
- Note text: rendered via the shared `EditableText` primitive (the same one used elsewhere in the modal). Click to edit inline; `Enter` commits, `Esc` reverts.
- Delete button (`.tl-del`):
  - Default `opacity: 0`; revealed on `.tl-row:hover` and `.tl-row:focus-within`
  - `--t4`, padding `4px 6px`, radius `4px`
  - Hover: `--color-danger` text, `--color-danger-bg` background
  - No confirmation dialog — single click removes the entry. (Rationale: entries are user-authored log lines, not records; the modal is still in a draft / unsaved state until Save.)

---

## Inline status picker

A scoped variant of the existing Status Dropdown used purely inside Timeline rows.

- Trigger: the standard `.badge` element with `cursor: pointer`
- Popover (`.tl-status-pop`):
  - `position: absolute; top: calc(100% + 6px); left: 0`
  - Same visual treatment as the global Status Dropdown (surface bg, `1.5px solid --border`, radius `--r-md`, `--shadow-lg`, min-width 196px, padding 5px)
  - Z-index 360 (above the modal at 300; below toast at 400)
- A transparent backdrop (`position: fixed; inset: 0; z-index: 355`) catches outside clicks and closes the popover
- Option rows reuse `.status-dd-opt` styling — color dot + label + active-check column
- Selecting an option fires `onChange(statusKey)` and closes; cancel via outside click

---

## Data model

The timeline lives on the application row as a new field:

```ts
type TimelineEntry = {
  id: number;            // stable identity for React keys and edit/delete operations
  date: string;          // ISO calendar date YYYY-MM-DD
  status: StatusKey;     // member of STATUSES — independent of row.status
  text: string;          // free-form note; may be empty
};

type Application = {
  …existing fields…
  timeline: TimelineEntry[];   // unsorted on disk; sorted descending at render time
};
```

### Sort

Render-time sort: `date` descending, then `id` descending as tiebreaker (so entries logged on the same day stay in insertion order, latest first).

### Seeding rules (existing rows without a timeline)

When a row arrives with no `timeline` array, a default is synthesized once at load:

1. If `dateApplied` is set, prepend:
   `{ date: dateApplied, status: 'applied', text: 'Submitted application.' }`
2. If `lastStatusUpdate` differs from `dateApplied` **and** the row's current status is not `applied`, append:
   `{ date: lastStatusUpdate, status: row.status, text: '' }`

This guarantees every row has at least one entry to render in the collapsed preview.

### `lastStatusUpdate` relationship

`lastStatusUpdate` is still maintained — it tracks the date of the most recent **status change**, not the most recent timeline entry. When the user changes status from the modal header dropdown (`⇄`), both `lastStatusUpdate` and a new timeline entry get written in the same draft mutation (see Interaction below).

---

## Interaction

| Interaction | Behavior |
|---|---|
| Click collapsed row / chevron | Expands the timeline |
| `Enter` / `Space` on collapsed row | Same as click (row has `role="button"`, `tabIndex={0}`) |
| Click **Collapse** button (expanded) | Collapses the timeline |
| Modify date / status / text in add-entry row | Local component state only; not yet committed to the draft |
| Click **+ Add** or press `Enter` in text input | Commits a new entry to `draft.timeline`; resets the add-entry row; refocuses the text input |
| Click a status pill on an existing entry | Opens inline status picker; selecting a status mutates that entry's `status` in the draft |
| Click an entry's note text | Switches it to an inline text input (`EditableText`); commits on blur / `Enter`, reverts on `Esc` |
| Click `×` on an entry | Removes the entry from the draft immediately (no confirm) |
| Change status from modal header `⇄` dropdown | Atomically: sets `draft.status` → new status, bumps `draft.lastStatusUpdate` → today, **appends** a new timeline entry `{ date: today, status: newStatus, text: '' }` |
| Save modal | Persists `timeline` along with the rest of the draft to the row |
| Discard modal | Reverts `timeline` to the original row's array |

> **Note on header status changes:** the auto-appended entry has an empty `text` by design — it documents the transition without forcing the user to write a note. The user can later click the entry's note area and add context, or delete it if redundant.

---

## Mobile (< 640px)

At the mobile breakpoint the entry rows reflow to a stacked layout. The grid is restructured via `grid-template-areas`:

```
grid-template-columns: 16px 1fr auto
grid-template-areas:
  "node  date  del"
  "line  badge ."
  "line  text  text"
gap: 4px 8px
padding: 8px 0 10px
```

- Node remains in the leftmost column; date sits to its right on the top row, with the delete (or add) button right-aligned
- The em-dash `.tl-dash` is hidden on mobile (`display: none`)
- Status pill drops to the second row, left-aligned
- Text / text-input spans the third row, full-width
- Delete button is **always visible** (`opacity: 1`) — hover affordance doesn't translate to touch
- Connector line `::after` is re-anchored: `top: 22px; bottom: -8px`
- Date input stretches to fill its cell (`max-width: 150px`)

The collapsed state is unchanged on mobile — still a single line, truncated.

---

## Keyboard

| Key | Context | Effect |
|---|---|---|
| `Tab` / `Shift+Tab` | Modal | Standard focus traversal; chevron row, add-entry inputs, status pills, note text, delete buttons all participate |
| `Enter` / `Space` | Focused collapsed row | Expands |
| `Enter` | Add-entry text input | Commits new entry (if date is set) |
| `Enter` | Editable entry note | Commits the edit |
| `Esc` | Editable entry note | Reverts to pre-edit value, exits edit |
| `Esc` | Inline status picker open | Closes picker (modal-level `Esc` handler still fires the close-attempt; the picker's outside-click backdrop intercepts first) |

---

## Theming

The Timeline reuses existing tokens — no new colors are introduced.

| Element | Token |
|---|---|
| Connector line | `--border` |
| Node fill | `--surface` |
| Node border | Status `borderAccent` (per-entry) |
| New-entry node border | `--t4` (dashed) |
| Hover bg (collapsed) | `--indigo-soft` |
| Hover bg (Collapse button) | `--indigo-soft` |
| Delete icon hover | `--color-danger` on `--color-danger-bg` |
| Add button | `--indigo` / `--indigo-hover` |

---

## Modal vertical sizing

To keep the modal from sprawling vertically when the Timeline expands with many entries, the modal max-height is clamped:

```css
.modal { max-height: min(860px, calc(100vh - 64px)); }
```

The modal body (`.modal-body`) retains `overflow-y: auto; flex: 1;`, so a tall Timeline scrolls inside the modal rather than pushing the footer offscreen. The header and footer remain pinned.

---

## Status System addendum

The Accepted status is added to the canonical Status table (see `tracker.md` § *Status System*):

| Status key | Label | `borderAccent` | Badge text |
|---|---|---|---|
| `accepted` | Accepted | `#2EC4B6` | `#212529` |

Inserted in the canonical order **after `offer`, before `rejected`** so the dropdown reads:

> Wishlisted · Applied · Phone Screen · Interview · Technical Assessment · Offer · **Accepted** · Rejected · Withdrawn · Ghosted

`accepted` participates in all status surfaces (badge, left border, modal header bg, dropdown dot, timeline node, status filter). No special handling beyond the standard contrast pick.

---

## Open items / decisions pending

- **Attachments per entry** (file, email screenshot, link) — not in this spec; would extend `TimelineEntry` with an optional `attachments: Attachment[]`.
- **Edit date inline** — currently the date on existing entries is read-only display. To re-date, the user must delete and re-add. Revisit if users frequently log entries retroactively.
- **Bulk import** — paste-multiple or email-forward parsing is out of scope. Track separately.
- **Visibility of empty-text entries** — currently they render as the placeholder *"Add note…"* via `EditableText`. If users complain it looks like a TODO, switch the placeholder to a quieter dash `—` only for entries auto-generated by status changes.
- **Auto-derived activity** (e.g. star toggle, archive) — should these emit timeline entries? Currently no, only manual log + auto status-change entry. Revisit after usage.
