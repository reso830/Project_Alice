# Application Edit Modal — Design Spec

Spec captures the modal that opens when a user clicks an application card in the Tracker, **and** when "+ New application" is clicked. One component, two modes.

---

## 1 · Modes

| Mode  | Trigger              | Footer button | Archive icon | Initial state                          |
| ----- | -------------------- | ------------- | ------------ | -------------------------------------- |
| Edit  | Click any card       | **Save**      | Visible      | All fields populated from row          |
| Create| `+ New application`  | **Create**    | Hidden       | Empty draft, status defaults to `Wishlisted` |

Both modes share identical layout, validation, dirty-state tracking, and discard flow.

> **Archived mode:** A third mode opens when the user clicks any card in the Archived view. It uses the same frame, header, and body grid, but every field is read-only and the footer is hidden. See §12 for the full set of differences.

---

## 2 · Frame

- **Width:** `min(720px, calc(100vw - 32px))`
- **Max height:** `calc(100vh - 64px)`, body scrolls; header + footer stay pinned
- **Radius:** 14px desktop
- **Backdrop:** `rgba(0,0,0,0.55)`, click outside = attempt close (see §7)
- **Mobile (< 640px):** Becomes a bottom sheet — full width, `border-radius: 16px 16px 0 0`, slides up from bottom, max-height `92vh`

---

## 3 · Header (2 rows)

The header background uses the **status accent color** for the active status (same palette as the card left-border / status badge in the Tracker spec). Foreground auto-picks light/dark for contrast.

### Row 1 — meta + actions
```
┌──────────────────────────────────────────────────────────────────┐
│  [#A-0042]  [● Interview]                  ★   ⇄   🗄   ✕         │
└──────────────────────────────────────────────────────────────────┘
```
- **Left:** ID pill (DM Mono, 10px, `#A-0042`) + status badge (clickable → opens StatusDropdown anchored under the badge)
- **Right:** Icon-only quick actions, 28×28 hit targets, 8px gap
  - **★ Favorite** — toggles `favorite` on the row immediately (no draft); filled when active
  - **⇄ Change Status** — opens StatusDropdown (alternative entry point to clicking the badge)
  - **🗄 Archive** — opens archive confirm; hidden in Create mode
  - **✕ Close** — attempts to close (see §7 dirty-check)

### Row 2 — editable title
- **Job Title** — large (24px / 600), click anywhere on it to edit, auto-grows, single-line clamp at edit-time
- Placeholder in Create mode: *"Job title…"*

---

## 4 · Body — field order & layout

12px padding, 14px row gap, 24px column gap. Two-column grid: `grid-template-columns: 1fr 1fr`.

**Order matches the spec — DO NOT reorder without updating this doc.**

| # | Col 1                   | Col 2                   | Notes                                                              |
| - | ----------------------- | ----------------------- | ------------------------------------------------------------------ |
| 1 | Company                 | Recruiter               | Both single-line text                                              |
| 2 | Location                | Salary                  | Salary parsed as PHP (₱); accepts `50k`, `50,000`, `50000-80000`   |
| 3 | Shift                   | Work Setup              | Both dropdowns                                                     |
| 4 | Compatibility (bar)     | Compatibility Notes     | **Both cells live on the SAME 1fr/1fr grid as the rows above** so the notes textarea aligns flush to the second column. No wrapper sub-grid — the cells are direct children of the body grid. |
| 5 | Last Updated (read-only)|                         | Half-width; displays the date of the most recent status change; not editable; updates to reflect the post-save value after clicking Save |
| 6 | Responsibilities (full) |                         | `grid-column: 1 / -1`; multiline textarea                          |
| 7 | Required Skills (full)  |                         | Chip editor; existing `skills` data flows here as fallback         |
| 8 | Preferred Skills (full) |                         | Chip editor; starts empty in both modes                            |
| 9 | URL (full)              |                         | Single-line, validates `https://`                                  |
| 10 | General Notes (full)   |                         | Multiline; longest field, anchors bottom of body                   |

### Dropdown values
- **Shift:** Day · Mid · Night · Flexible
- **Work Setup:** Remote · Hybrid · On-site · Field

### Compatibility cell
- Read-only horizontal bar with the percentage overlaid as text (e.g. `78%`)
- Color follows the Tracker compat ramp (red < 40, amber 40–69, green ≥ 70)
- The score itself is computed; only **Compatibility Notes** is editable here

### Mobile collapse
At < 640px the body grid collapses to single column. All 2-up rows stack; field order is preserved top-to-bottom.

---

## 5 · Inline edit behavior

- Each field is a plain display element until clicked → swaps to input/textarea/dropdown
- **Outside-click commits** the change to draft state (NOT to the row)
- `Esc` while editing a field reverts that field to its pre-edit value
- `Enter` commits single-line fields; `Cmd/Ctrl+Enter` commits multi-line
- Chip editors commit on blur, comma, or `Enter`; backspace on empty input removes the last chip

Draft state is local to the modal. Nothing persists to the row until **Save** / **Create** is clicked.

---

## 6 · Save / Discard footer

The footer is **conditionally rendered** — hidden when the draft equals the original row, visible when any field diverges.

```
┌──────────────────────────────────────────────────────────────────┐
│                                  [ Discard ]   [ Save ]           │
└──────────────────────────────────────────────────────────────────┘
```

- **Save** (or **Create** in Create mode): commits draft → row, fires toast (`Saved.` / `Application created.`), modal stays open in Edit mode
- **Discard:** opens discard confirmation (§7)
- In Create mode the footer is **always visible** since an empty draft is by definition dirty; the button reads **Create** and is disabled until at least Job Title + Company are filled

---

## 7 · Discard confirmation

Triggered by:
1. Clicking **Discard** in the footer
2. Clicking **✕ Close** when the draft is dirty
3. Clicking the backdrop when the draft is dirty
4. Pressing `Esc` at the modal level (not inside a field) when dirty

Dialog (centered over the modal, smaller frame):
```
Discard changes?
Your edits will be lost.

           [ Keep editing ]   [ Discard ]
```
- **Keep editing** — closes the dialog, returns focus to the modal
- **Discard** — drops draft, closes the modal (or in Discard-button case, resets draft to original and stays open)

If the draft is **not** dirty, ✕ / backdrop / Esc close immediately with no dialog.

---

## 8 · Quick action behaviors

| Action          | Acts on        | Confirms? | Side effects                                            |
| --------------- | -------------- | --------- | ------------------------------------------------------- |
| ★ Favorite      | Row (live)     | No        | Toast: `Favorited.` / `Unfavorited.`                    |
| ⇄ Change Status | Draft          | No        | Header bg recolors immediately; counts as dirty change  |
| 🗄 Archive      | Row (live)     | Yes       | Confirm: *"Archive this application?"* → row leaves the visible list, modal closes, toast with **Undo** |
| ↺ Unarchive     | Row (live)     | No        | Archived mode only. Clears `archived` + nulls `archivedDate`; modal closes; toast: `Unarchived.` |
| ✕ Close         | Modal          | If dirty  | See §7                                                  |

**Note:** Favorite and Archive bypass the draft because they're meta-state, not field edits — the user expects them to take effect instantly the way they do on the card.

---

## 9 · Keyboard

| Key                | Effect                                                  |
| ------------------ | ------------------------------------------------------- |
| `Esc` (in field)   | Cancels that field's edit                               |
| `Esc` (modal)      | Attempts close (with dirty check)                       |
| `Cmd/Ctrl + S`     | Save (if dirty)                                         |
| `Cmd/Ctrl + Enter` | Commits multi-line field, returns focus to modal        |
| `Tab` / `Shift+Tab`| Standard focus traversal; trapped within the modal      |

---

## 10 · State summary

```ts
type ModalState = {
  mode: 'edit' | 'create';
  rowId: string | null;            // null in create mode until saved
  draft: Application;              // local working copy
  original: Application | null;    // null in create mode
  editingField: string | null;     // which field is in input mode
  confirmDiscard: boolean;
  confirmArchive: boolean;
};

const isDirty = !shallowEqual(draft, original);
```

---

## 11 · Open items / decisions still pending

- Compat score editability — currently read-only; revisit if scoring becomes manual
- Attachments (resume version, cover letter) — not in this spec; future addition probably as a section under Notes
- Activity / timeline log — not in this spec; would live as a separate tab in the modal if added

---

## 12 · Archived mode

The modal opens in Archived mode when the user clicks any card from the Tracker's Archived view (see [`tracker.md`](tracker.md) § View switcher). It is a third mode alongside Edit and Create, sharing the same frame, header layout, and body grid — but read-only.

### 12.1 · Header (Row 1)

```
┌──────────────────────────────────────────────────────────────────┐
│  [#A-0042]  [● Interview]  [ARCHIVED]                  ↺    ✕     │
└──────────────────────────────────────────────────────────────────┘
```

**ARCHIVED chip (`.archived-stamp`)** — appended to the meta cluster immediately after the status badge. It uses a neutral translucent fill that adapts to the header's light/dark contrast class so the chip never fights the status accent.

| Header contrast class | Background | Text |
| --- | --- | --- |
| `modal-header--light` (dark accents like `applied`, `rejected`, `withdrawn`) | `rgba(255,255,255,0.16)` | `rgba(255,255,255,0.95)` |
| `modal-header--dark`  (light accents like `wishlisted`, `interview`, `offer`) | `rgba(0,0,0,0.10)` | `rgba(0,0,0,0.72)` |

- Shape: pill (`--r-pill`), padding `4px 10px`
- Type: DM Mono 9px / 600, uppercase, 0.8px letter-spacing
- Leading icon: a small 11×11 archive-box SVG glyph, opacity 0.85
- Label: simply **"Archived"** — no date (the row's `archivedDate` already appears in the card's date-stamp slot and is not duplicated here)

**Quick action collapse.** The right-side cluster collapses to **two** buttons only:

| Button | Behavior |
| --- | --- |
| **↺ Unarchive** | Clears `archived` (and nulls `archivedDate`) immediately; modal closes; toast: `Unarchived.` No confirmation dialog — unarchive is a non-destructive restore. |
| **✕ Close** | Closes immediately. No dirty-check is needed (the modal cannot be dirty in archived mode). |

The **★ Favorite**, **⇄ Change Status**, and **🗄 Archive** icons are hidden in archived mode.

### 12.2 · Header (Row 2)

Job Title is rendered as plain text — same size and weight as in Edit mode (24px / 600), but **not click-to-edit**. No caret cursor, no background hover lift. The status badge in Row 1 is likewise non-interactive — clicking it does nothing.

### 12.3 · Body — read-only behavior

All body fields render with the same layout and order documented in §4, but with editing affordances suppressed:

- **No field swap to input.** Display elements do not become editable on click.
- **No hover lift.** Field-value backgrounds stay transparent on hover (no `--indigo-soft` tint, no cursor change).
- **Chip editors** (Required Skills, Preferred Skills) render chips but omit the `×` remove buttons and the trailing input.
- **Dropdowns** (Shift, Work Setup) render the current value as plain text; no caret or open-on-click.
- **Status dropdown** is unavailable (the header badge is no longer a trigger).
- **URL field** is rendered as a link/value, not as an inline editor.

### 12.4 · Footer

The Save / Discard footer is **hidden entirely** in archived mode. There is no draft state — nothing can be committed.

### 12.5 · Discard / keyboard

Because archived mode has no draft:

- **✕ Close**, backdrop click, and **Esc** all close immediately. No discard confirmation is ever shown.
- **`Cmd/Ctrl + S`** is a no-op.
- All other field-level shortcuts (`Esc` in field, `Cmd/Ctrl + Enter`) are inert because no field is in edit mode.

### 12.6 · State

```ts
type ModalState = {
  mode: 'edit' | 'create' | 'archived';   // ← archived added
  rowId: string | null;
  draft: Application;                     // mirror of original; never mutated in archived mode
  original: Application | null;
  editingField: null;                     // always null in archived mode
  confirmDiscard: false;                  // never set in archived mode
  confirmArchive: false;                  // archive icon is hidden, never triggers
};
```

`isDirty` is always `false` in archived mode by construction.

### 12.7 · Mode entry / exit

- **Opening:** clicking a card with `row.archived === true` resolves to Archived mode (independent of which view is active).
- **Exiting:** closing the modal returns to the Archived list unchanged. Clicking **↺ Unarchive** clears the flag on the row, closes the modal, the row immediately disappears from the Archived list, and the toolbar chip count updates.
