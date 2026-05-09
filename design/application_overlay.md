# Application Edit Modal — Design Spec

Spec captures the modal that opens when a user clicks an application card in the Tracker, **and** when "+ New application" is clicked. One component, two modes.

---

## 1 · Modes

| Mode  | Trigger              | Footer button | Archive icon | Initial state                          |
| ----- | -------------------- | ------------- | ------------ | -------------------------------------- |
| Edit  | Click any card       | **Save**      | Visible      | All fields populated from row          |
| Create| `+ New application`  | **Create**    | Hidden       | Empty draft, status defaults to `Wishlisted` |

Both modes share identical layout, validation, dirty-state tracking, and discard flow.

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
