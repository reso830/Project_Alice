# Application Edit Modal — Design Spec

Spec captures the modal that opens when a user clicks an application card in the Tracker, **and** when "+ New application" is clicked. One component, two modes.

> **Create entry:** "+ New application" no longer opens this modal directly — it opens the **Add-application gate** (Smart vs Manual entry), which can pre-fill Create mode by parsing a pasted job posting. See §13 for the full entry & smart-fill flow.

---

## 1 · Modes

| Mode  | Trigger              | Footer button | Archive icon | Initial state                          |
| ----- | -------------------- | ------------- | ------------ | -------------------------------------- |
| Edit  | Click any card       | **Save**      | Visible      | All fields populated from row          |
| Create| Add-application gate (§13) | **Create**    | Hidden       | Empty draft **or** parsed prefill; status defaults to `Wishlisted` |

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

### Provenance (smart-filled Create)
When Create mode is reached via a parse, filled fields carry provenance markers (fill banner, per-field **✦ AI** / **⚙ Auto** tag, one-time flash, clear-on-edit). Full rules in §13.6.

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
- In Create mode the footer is **always visible** since an empty draft is by definition dirty; the button reads **Create** and is disabled until at least Job Title + Company are filled. A smart-parsed draft typically arrives with both already populated, so **Create** is enabled on open.

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

  // Create-mode smart fill (see §13):
  prefill?: Partial<Application>;   // parsed values seeded into draft
  aiFields?: string[];             // field keys to mark + flash
  fillSource?: 'ai' | 'basic';     // selects ✦ AI vs ⚙ Auto styling
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

---

## 13 · Entry & smart fill (Create mode)

Create mode has **two entry paths**, chosen up front via the **Add-application gate**. The gate, smart-input, and failure surfaces reuse the pattern documented for the profile setup flow — see [`edit_profile_page.md`](../edit_profile_page.md) § Mode gate — adapted from résumé import to job-posting parsing. The flow always terminates in this modal (Create mode); nothing persists until **Create** is clicked.

### 13.1 · Add-application gate

Opened by **+ New application** (desktop toolbar) and the **FAB** (mobile). A centered modal (`max 660px`; cards stack < 600px) titled **"Let's add this application"** with two choice cards:

| Card | Leading | Description | Result |
| --- | --- | --- | --- |
| **Smart entry** (badge: *Fastest*) | AI sparkle | "Paste a job posting and we'll fill in the details automatically." | → Smart input (§13.2) |
| **Manual entry** | Pencil | "Type the details into the form, field by field." | → Create modal, empty draft |

- Backdrop click / ✕ / `Esc` dismiss the gate — no application is created.
- **AI provider off:** the Smart card is **locked** (no *Fastest* badge, dimmed sparkle) and shows an **"Enable AI in Settings →"** link in place of its CTA. Manual entry is unaffected.

### 13.2 · Smart input — paste a job posting

Centered modal (`max 540px`), title **"Paste the job posting."**

- A single auto-focused multi-line paste area. Helper: *"Auto-parsing isn't perfect — you can review & edit everything before saving."*
- Live character count.
- **Parse posting** (primary) is disabled until the pasted text passes a minimum length (≈ 40 chars). **Back** returns to the gate.
- The button is **text-only — no AI glyph**. The sparkle signifies *provenance* (what the AI wrote), never an action.

### 13.3 · Processing

Full-cover solid scrim with a spinner — **"Reading the job posting…"** / *"Extracting title, company, skills, and details."* On success the Create modal opens **pre-filled** with provenance (§13.6).

### 13.4 · AI unavailable (recoverable)

When the AI parser can't be reached, an **ask-first** dialog appears (cloud-off glyph) — **"Smart parsing is unavailable right now."** It surfaces a **reason-code** chip (§13.7) plus the pasted-context label. Actions:

| Action | Behavior |
| --- | --- |
| **Use basic parser** | Falls back to the rule-based parser — faster, fewer fields. Fills Create mode with **⚙ Auto** provenance. |
| **Try AI again** *(wait-type reasons)* | Retries the AI parse. |
| **Update key in Settings** *(key / credit reasons)* | Routes to provider settings instead of a pointless retry. |
| **Enter manually instead** | Abandons parsing → empty Create modal. |

Whether the secondary button is *Try AI again* vs *Update key in Settings* is driven by the reason's `fix` class (§13.7).

### 13.5 · Unreadable posting (dead-end)

When neither parser can extract structure (e.g. an image-only listing), a terminal error appears (alert glyph) — **"We couldn't read that posting"** — with the `NO_TEXT` reason and a plain-text tip. There is **no basic-parser option** here. Actions: **Try again** / **Enter manually instead**.

### 13.6 · Provenance markers

When the Create modal opens from a parse, filled fields are marked so the user can see — then verify — what the machine wrote:

- **Fill banner** atop the body: *"Filled from the job posting"* (AI) or *"Filled by the basic parser"* (⚙ Auto). Dismissible.
- **Per-field tag** beside each filled label: **✦ AI** (indigo) for the AI parser, **⚙ Auto** (neutral) for the basic parser.
- **One-time flash** on each filled field/value as the modal opens.
- A tag **clears the moment the user edits that field** — once you've touched it, it's yours, not the machine's.
- The **Job Title** header carries the same flash when prefilled; the title editor does **not** auto-open when a parsed value is present (so the flash is visible).

Fields the parsers populate: Job Title, Company, Recruiter, Location, Salary, Shift, Work Setup, Responsibilities, Required Skills, Preferred Skills, URL. The basic parser fills a **subset** (typically no Recruiter / Shift / Preferred Skills). **Status is never parsed** — it stays `Wishlisted`.

### 13.7 · AI-down reason codes

| Key | Code | Meaning | `fix` → secondary action |
| --- | --- | --- | --- |
| `rate_limit` | `HTTP 429` | Too many requests in a short window | wait → **Try AI again** |
| `invalid_key` | `HTTP 401` | Provider key rejected | settings → **Update key** |
| `quota` | `HTTP 402` | No remaining provider credits | settings → **Update key** |
| `timeout` | `TIMEOUT` | Model took too long to respond | wait → **Try AI again** |
| `server` | `HTTP 503` | Provider temporarily unavailable | wait → **Try AI again** |
| `network` | `NETWORK` | Couldn't reach the AI service | wait → **Try AI again** |

The unreadable-posting dead-end (§13.5) uses a separate `NO_TEXT` reason and is **not** recoverable by retry alone — it needs different input.

### 13.8 · State

```ts
// Create mode gains an entry sub-flow + provenance metadata:
type AddFlowState = {
  phase: null | 'gate' | 'smart' | 'processing';
  error: null | { kind: 'llm' | 'parse'; reason: ReasonCode; contextLabel: string };
};

// The resulting ModalState (Create) carries the provenance fields from §10:
//   prefill, aiFields, fillSource
```
