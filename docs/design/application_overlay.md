# Application Edit Modal — Design Spec

Spec captures the modal that opens when a user clicks an application card in the Tracker, **and** when "+ New application" is clicked. One component, two modes.

> **➥ 2026-06 redesign — Compatibility & Skills.** The old §4 row-4 layout (a half-width Compatibility bar beside a half-width "Compatibility Notes" textarea) is **removed**. Compatibility is now a **full-width, collapsible module** (§14) that separates a deterministic, always-live **score** from **LLM-written notes** that carry their own freshness state. Skills are now **proficiency-coded** against the user's profile (§14.5). Field order changed (§4). **Timeline** also became collapsible but its detailed spec is intentionally **out of scope here** and lands in a separate update. Every type/color/spacing value in §14 is normative — implement to the number.

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

> **Status pill border (2026-06):** since the header background and the status badge are the same accent color, the header badge would blend in. The badge inside `.modal-pills` carries a **1px defining border** — `rgba(33,37,41,.32)` on light headers, `rgba(255,255,255,.45)` on dark headers. Header pill only; card/timeline badges stay unbordered.

> **Render variants:** this overlay renders in two forms from one component — the centered **`modal`** variant (dimmed backdrop, body-scroll lock; used on tablet ≤1099px and mobile bottom-sheet) and a borderless **`pane`** variant that fills the desktop docked detail pane at ≥1100px (no backdrop, no scroll-lock; its body scrolls internally). See [`tracker.md`](tracker.md) § *Desktop Detail Pane*. Editing behavior is identical across both.

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

## 4 · Body — collapsible panels

> **⚠ Structural rewrite (2026-06).** The body is **no longer a flat two-column field grid.** It is a vertical stack of **five collapsible panels** ("the panelled overlay"), live in both the centered modal and the docked detail pane (Tracker `pane` variant). The old field-grid layout is fully retired. Implementation: `Modal` → `.pbody` → five `OPanel` components.

### 4.1 · Body container

- Root: `.pbody` — `display:flex; flex-direction:column; gap:13px; padding:16px; overflow-y:auto; flex:1; background:#FAF8F4` (a hair warmer than `--surface` so the white panels lift off it).
- Mobile (< 640px): padding `12px 12px 18px`; every panel's inner 2-column grid collapses to one column.
- Panel **order is normative — DO NOT reorder without updating this doc:** **Overview → Skills → Compatibility → Timeline → Notes & Links.** (Skills now sits **before** Compatibility — reversed from the retired grid spec.)

### 4.2 · The `OPanel` component (one collapsible panel)

Every panel is rendered by the shared `OPanel({ icon, title, tone, open, onToggle, preview, children })`. Anatomy:

- `<section class="panel">` — white card: `border:1px solid rgba(26,26,46,.05); border-radius:--r-md (10px); box-shadow:0 1px 2px rgba(26,26,46,.05), 0 8px 20px rgba(26,26,46,.07); padding:14px 16px`. The Compatibility panel passes `tone="ai"` → `.panel.panel-ai` (purple-glow AI card, §14.3).
- `.panel-head.clickable` — the whole header row is the toggle (`role="button"`, `tabIndex=0`, `aria-expanded`; click and Enter/Space fire `onToggle`):
  - Left `.panel-head-l`: a 15px line **icon** (`PanelIcon`, `currentColor` `--t3`, 1.5 stroke) + **title** `.panel-title` (Sora 11px / 600, uppercase, letter-spacing .6px, color `--t2`).
  - Right `.panel-head-r`: the **Expand/Collapse toggle** `.sec-toggle` — a `.sec-chev` "›" that rotates 90° when open, then **"Expand"** (collapsed) / **"Collapse"** (open). Identical control to Timeline's (§14.9).
- `.panel-body` — renders **`children` when `open`**, otherwise the **`preview`** node (a compact one-line summary).

**Default open/closed state** (`pOpen` initial value): `{ overview:true, compat:false, skills:false, timeline:<archived>, notes:false }`. On open **only Overview is expanded**; Timeline is *also* expanded **when the row is archived**. Toggling is local UI state — **not** part of the draft; it never marks the modal dirty.

### 4.3 · Panel inventory

| # | Panel | `icon` | Expanded content | Collapsed `preview` |
| - | ----- | ------ | ---------------- | ------------------- |
| 1 | **Overview** | `overview` | Inner `.panel-grid` (2-col): **Company, Recruiter, Location, Salary, Shift, Work Setup, Min Years** — then **Responsibilities** full-width below the grid. | `{Company} · {Location} · {Salary}` (location/salary only when present). |
| 2 | **Skills** | `skills` | `.skills-grid` (2-col): **Required Skills** + **Preferred Skills**, each a `SkillChips` editor (§4.5). | `{n} required · {m} preferred` (live counts). |
| 3 | **Compatibility** | `compat` | `CompatPanelBody` — score ring + verdict + summary + analysis + footer. Full spec §14. Panel uses `tone="ai"`. | Mini ring (30px) + verdict text in tier ink + `{summary}` when present. |
| 4 | **Timeline** | `timeline` | `TimelineField` in **`bare`** mode (the panel header replaces the field's own header). Full spec: [`application_timeline.md`](application_timeline.md). | `TimelinePreviewLine` — latest entry: `{date} — {status badge} {text} (+N earlier)`, else "No entries yet". |
| 5 | **Notes & Links** | `notes` | `.stacked-fields`: **Job Posting URL** (single-line, validates `https://`) + **General Notes** (multiline). | First non-empty of `{General Notes}` / `{URL}`, else "Add notes & links…". |

- **Field widgets:** Company/Recruiter/Location/Min Years = single-line `EditableText`; Salary = `EditableSalary` (PHP ₱; accepts `50k`, `50,000`, `50000-80000`); Shift/Work Setup = `EditableSelect`; Responsibilities/General Notes = multiline `EditableText` (`mono`); URL = single-line `EditableText` (`mono`).
- **Dropdown values:** Shift = Day · Mid · Night · Flexible; Work Setup = Remote · Hybrid · On-site · Field.
- **Min Years** (`minYears`, string, e.g. "5+ years") lives in the Overview grid. The retired "Last Updated" field stays removed — the Timeline surfaces the latest status-change date.

### 4.4 · Inline editing inside panels

Editing is identical to §5 — every field is click-to-edit, outside-click commits to draft, `Esc` reverts, `Enter` / `Cmd-Ctrl+Enter` commit. **The panel chrome does not interfere:** clicking a field inside an open panel edits it; only the header row toggles collapse. This holds in both render variants — the docked **`pane`** variant is fully editable, exactly like the centered modal.

> **Exception — Compatibility summary & analysis are read-only.** The `compatSummary` headline and `compatNotes` analysis are **not** click-to-edit; they are AI output and change only via Regenerate/Refresh (decided 2026-06, §14.0 / §14.10). Every other field across the panels is click-to-edit.

### 4.5 · `SkillChips` editor (Required / Preferred)

- Container `.cx-chips.skill-edit-row`: wraps; existing skills render as `.chip` with a `.chip-x` "×" remove button; a trailing `.skill-add-pill` ("**+ Add**") reveals an inline `.skill-add-input`.
- Commit a new skill on **Enter** or **comma**; **Esc** cancels; duplicates (case-insensitive) ignored. Removing a chip commits immediately.
- **As-built:** chips are **neutral** (no proficiency color) — profile-matching data is not yet wired.
- **Target:** chips are **proficiency-coded** against the user profile (Proficient / Learning / Missing) with a legend — full normative spec in §14.5. Build the neutral chips now; proficiency coding is the planned end state.

### Provenance (smart-filled Create)
When Create mode is reached via a parse, filled fields carry provenance markers (fill banner, per-field **✦ AI** / **⚙ Auto** tag, one-time flash, clear-on-edit). Full rules in §13.6. Markers attach to the field inside whichever panel holds it; panels containing smart-filled fields should open so the markers are visible.

### Mobile collapse
At < 640px each panel's inner grid collapses to a single column; panel order and the collapsible behavior are unchanged.

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

- Compat score editability — score is **computed, read-only** (never user-editable); see §14.2
- Attachments (resume version, cover letter) — not in this spec; future addition probably as a section under Notes
- Activity / timeline log — Timeline is now a collapsible section; its detailed spec is pending a separate doc update

### Resolved decisions from the 2026-06 Compatibility redesign
- **D1 · Stale-notes refresh trigger** — ✓ **RESOLVED: manual.** Notes go stale when the profile/application changes after the notes' `generatedAt`; the user clicks **Refresh**. No automatic LLM call on edit. (§14.6)
- **D2 · No-profile visibility** — ✓ **RESOLVED: dormant.** Show the module in the **"Compatibility unavailable"** state with a *Complete profile →* CTA (not hidden). (§14.7)
- **D3 · "Last Updated" field** — ✓ **RESOLVED: removed** (absent from current code; Timeline covers the date). **New field added: "Min Years"** (numeric, half-width) sits directly above Responsibilities — now body row 4 (§4).
- **D4 · Skill proficiency source** — ✓ **RESOLVED.** Each skill resolves against the profile to {proficient = rating **≥ 3**, learning = rating **< 3**, missing = not on profile}. (§14.5)
- **D5 · Auto-scoring scope** — ✓ **RESOLVED: the score cannot fail by design.** With sparse/missing data it defaults to **0 / a very low score** rather than erroring. The only error surface is an **LLM notes** call failing → handled in the *notes* region, not the module (§14.6). The module-level availability is therefore just `scored | no-profile`.

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
- This gate and the **Set up profile** gate ([`edit_profile_page.md`](edit_profile_page.md) § Mode gate — split cards) share the exact same `.creation-picker-card` visual styling — hover state, whole-card click target, and silent (non-solid) CTA — as well as the same behavioral pattern: the gate resolves fully before any navigation or Create-mode state is entered.

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

---

## 14 · Compatibility module (2026-06 redesign)

The Compatibility **collapsible panel** — panel **#3** of the panelled body (§4.3), between Skills and Timeline. Rendered by `CompatPanelBody` inside an `OPanel` with `tone="ai"`. **All values below are normative — implement to the number.** Type: **Sora** for UI/labels/buttons, **DM Mono** for numbers/meta/chips.

### 14.0 · As-built vs target (read first)

This section specifies the **target** Compatibility module — a deterministic score plus an LLM-written analysis with a full freshness/state machine. The **live `CompatPanelBody`** implements the spine of that design; several states are **not yet wired**. Build toward the target; treat the table below as the current ground truth.

| Aspect | As-built (live `CompatPanelBody`) | Target (this §14) |
| --- | --- | --- |
| Score ring + verdict pill | ✅ Live, deterministic, ramp §14.4 | Same |
| Deterministic score / LLM notes split | ✅ Conceptually (score is computed; notes/headline are LLM output) | §14.1 |
| Headline / summary (`compatSummary`) | ⚠ Inline-editable today (interim) | **Read-only** LLM output — DECIDED (§14.10) |
| Analysis prose (`compatNotes`) | ⚠ Inline-editable today (interim) + clamp + Show more/less | **Read-only** LLM output; Regenerate/Refresh only — DECIDED (§14.10) |
| Footer meta | ✅ `✦ Generated {compatGeneratedOn}` + `↻ Regenerate` button | Same, plus freshness-aware label (§14.6) |
| Regenerate action | ⚠ **Stub** — toasts "AI scoring isn't connected in this prototype." | Calls the LLM (§14.6) |
| Freshness states (fresh/stale/none/generating/error) | ❌ Not implemented (always renders the "fresh-like" body) | §14.6 |
| AI-off / empty / unavailable states | ❌ Not implemented | §14.6a, §14.7 |
| Skill proficiency coding | ❌ Neutral chips (§4.5) | §14.5 |

> **Editability — DECIDED (2026-06): read-only.** The AI summary (`compatSummary`) and analysis (`compatNotes`) are **read-only output**. Users do **not** hand-edit them; the only way to change them is **Regenerate / Refresh** (§14.10). No manual-edit override. The live prototype still renders them as inline-editable purely as an interim stand-in (AI generation isn't wired yet); when the LLM is connected, **remove the inline editors** (the `editingSummary` / `editingNotes` click-to-edit affordances in `CompatPanelBody`) and serve both fields read-only.

### 14.1 · Core concept — two things, two lifecycles

The module renders **two distinct data products** with different freshness guarantees. Do not conflate them:

| Part | Source | Freshness | Editable |
| --- | --- | --- | --- |
| **Score** (ring + verdict pill, skill chips) | Deterministic scorer | **Always live** — recomputed automatically whenever the profile or the application changes | No (computed, read-only) |
| **Notes** (headline + prose) | LLM | **Manually refreshed** — does *not* auto-regenerate; can lag behind the score | No (read-only output; regenerate, don’t hand-edit) |

Because the score recomputes but the notes don’t, the notes can describe an older state. The UI **never shows a stale number** — only stale *prose*, explicitly labelled (§14.6).

### 14.2 · Data model

```ts
type Compatibility = {
  score: number;                 // 0–100, computed, deterministic, READ-ONLY
  required: SkillMatch[];        // resolved against the user profile
  preferred: SkillMatch[];
  notes: CompatNotes | null;     // null = never generated
};

type SkillMatch = {
  name: string;
  level: 'proficient' | 'learning' | 'missing';   // see §14.5
};

type CompatNotes = {
  summary: string;               // headline, ≤ 34 chars (§14.11)
  body: string;                  // prose; may contain **bold** runs and paragraphs
  generatedAt: string;           // ISO timestamp; basis for staleness
};

// ── derived UI state ──
type CompatAvailability = 'scored' | 'no-profile' | 'unsaved';  // 'unsaved' = Create mode, no id yet; score never errors (D5)
type NotesState = 'fresh' | 'stale' | 'none' | 'generating' | 'error';  // 'error' = LLM call failed
// none      = notes === null
// stale     = notes != null && (profile.updatedAt > notes.generatedAt || application.updatedAt > notes.generatedAt)
// fresh     = notes != null && !stale
// generating= an LLM regenerate/generate call is in flight
// error     = the last LLM generate/refresh call failed (retryable)
```

> **As-built field shape (live `draft`).** The prototype stores Compatibility as **flat row fields**, not the nested `Compatibility` object above. Map target → as-built when wiring:
>
> | Target | As-built field | Type | Notes |
> | --- | --- | --- | --- |
> | `score` | `compat` | `number` 0–100 | Deterministic; drives ring + verdict + card CompatBar |
> | `notes.summary` | `compatSummary` | `string` | One-line headline; **inline-editable** in the live build |
> | `notes.body` | `compatNotes` | `string` | Analysis prose; **inline-editable**; clamp + Show more/less |
> | `notes.generatedAt` | `compatGeneratedOn` | `string` | Display string (e.g. "Jun 9") shown in the footer meta; not yet an ISO timestamp, so staleness can't be derived yet |
> | `required`/`preferred` (`SkillMatch[]`) | `skills` / `preferredSkills` | `string[]` | Neutral chips; no `level` resolved yet (§4.5) |
>
> Reaching the target requires promoting `compatGeneratedOn` to an ISO timestamp (for staleness) and resolving skills into `SkillMatch` against the profile.

### 14.3 · Container & section frame

- **The Compatibility module is panel #3 of the panelled body** (§4.2), not a free-standing `.mfield.full`. Its container is the standard `OPanel` `<section class="panel panel-ai">`.
- **`.panel-ai` is the AI affordance** — same white card as the other panels but with a soft purple glow: `border-color:#DCD4F3; box-shadow:0 0 0 1px rgba(79,70,229,0.08), 0 2px 10px rgba(79,70,229,0.12), 0 14px 36px rgba(79,70,229,0.18)`. Only the Compatibility panel gets it; ordinary panels stay neutral.
- **Header** is the shared `OPanel` header (§4.2): `compat` icon + title **"Compatibility"** on the left, the **Expand/Collapse** `.sec-toggle` on the right. (No ✦ AI chip in the header — the score is deterministic; the ✦ AI tag appears only beside the "Analysis" sub-label, §14.10.)
- **Expanded body** is `CompatPanelBody` wrapped in `.cx-flow` (`display:flex; flex-direction:column; gap:11px`). Internal vertical order: **(1)** `.cx-score-row` (ring + meta) → **(2)** divider `.cx-rule` (`border-top:1px solid rgba(79,70,229,0.12); margin:1px 0`) → **(3)** `ANALYSIS` sub-head + notes → **(4)** `.cx-foot` footer (Show more · Generated meta · Regenerate).
- **Collapsed preview** (`.op-preview`): 30px mini score ring + verdict text in tier ink + the `compatSummary` one-liner when present.

### 14.4 · Score block (always live)

**Layout** `.cx-score-row` — `display:flex; gap:14px; align-items:center`. Left = ring; right = `.cx-score-meta` (`flex-direction:column; gap:6px`) holding the verdict pill then the headline.

**Score ring** (SVG donut, number only — no "%"):
- Diameter (as-built): **60px**, fixed across breakpoints (`ScoreRing size={60}`). Collapsed mini-ring: **30px / stroke 4 / number 11px** (§14.8). *(Target: 64px desktop / 58px mobile; the live component currently uses one 60px ring.)*
- Stroke width: **8px** (mini-ring 4px). Two stacked circles; arc starts at **12 o’clock** (`rotate(-90)`), sweeps **clockwise**, `stroke-linecap:round`.
- **Track circle** color: `#EDE8DF`. **Progress arc** color: the tier color from the ramp below.
- **Center number**: DM Mono, weight 500, color `--t1` `#1A1A2E`, font-size `round(diameter × 0.32)` (60→19px; mini-ring forced to 11px). Integer score, no suffix.
- **The score never errors (D5).** With sparse or missing application data the deterministic scorer defaults to **0 / a very low score** (rendered as a Low-tier red ring) rather than failing — so the score block always renders.

**Compatibility ramp** (normative — drives ring arc, verdict-pill dot, and verdict label):

| Tier | Range | Arc / dot color | Pill text (ink) | Pill background | Label |
| --- | --- | --- | --- | --- | --- |
| Low | 0–39 | `#EF4444` | `#DC2626` | `rgba(239,68,68,0.12)` | **Low match** |
| Medium | 40–64 | `#EAB308` | `#A16207` | `rgba(234,179,8,0.16)` | **Medium match** |
| High | 65–84 | `#15803D` | `#15803D` | `rgba(21,128,61,0.12)` | **High match** |
| Great | 85–100 | `#2563EB` | `#2563EB` | `rgba(37,99,235,0.12)` | **Great match** |

> Boundaries are inclusive lower bounds: `>=85` Great, else `>=65` High, else `>=40` Medium, else Low. Track is always `#EDE8DF`. Medium uses a darker ink (`#A16207`) than its dot for text contrast on the pale fill.

**Verdict pill** `.verdict-pill`: `display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px (--r-pill); width:max-content; max-width:100%`. **No border.** Sora 11px / 600, text = tier ink, background = tier background. Leading dot `.vd` = 6px circle in tier arc color. `align-self:flex-start` so it hugs its label and never stretches.

**Headline** `.cx-headline` (the LLM `summary`): Sora 14px / 600, color `--t1`, line-height 1.4, **single line** (`white-space:nowrap; overflow:hidden; text-overflow:ellipsis`). Only rendered when notes exist (`fresh`/`stale`). Stale variant: color `--t3` `#9CA3AF`. Constraints in §14.11.

### 14.5 · Skill proficiency coding (body row #6)

Required & Preferred skill chips are colored by how the user’s profile resolves each skill. Chip `.chip`: `display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:999px`, **no border**, DM Mono 10.5px; leading glyph `.ck` 9px. Container gap 5px, wraps.

| `level` | Meaning | Glyph | Text | Background | Class |
| --- | --- | --- | --- | --- | --- |
| `proficient` | On profile, rating **≥ 3** | `✓` | `#15803D` | `#E7F6EC` | `.chip.lvl-high` |
| `learning` | On profile, rating **< 3** | `●` | `#A16207` | `#FBF1D9` | `.chip.lvl-low` |
| `missing` | **Not** on profile | `✕` | `#DC2626` | `#FCE9E9` | `.chip.miss` |

**Legend** `.skills-legend` (below the two skill columns, full-width): DM Mono 10px, color `--t3`, gaps `4px 14px`, `padding-top:9px`. Three entries: `✓ Proficient` (glyph `#16A34A`), `● Learning` (glyph `#D97706`), `✕ Missing` (glyph `#DC2626`).

> Skill chips render identically for Required and Preferred. A *missing* preferred skill is currently styled as loud (red) as a missing required one — if that should be softened, raise it as a follow-up; the current spec keeps one scale for both. (Legend glyph hues `#16A34A`/`#D97706` are intentionally one step brighter than the chip text hues `#15803D`/`#A16207`.)

### 14.6 · Notes region & freshness states

The notes region sits below the divider and swaps by `NotesState`. The score block above is identical in all four.

**`fresh`** — (a) notes header `.cx-notes-head`: label **"Analysis"** (`.cx-notes-h`, Sora 11px / 600, color `--t3`, letter-spacing .2px) + a small **✦ AI** tag at 9px. (b) prose `.cx-notes`: Sora 13px, line-height 1.62, color `--t2` `#4B5563`; `strong` → `--t1` / 600; paragraph margin-bottom 7px. **Collapsed by default** to `max-height:62px` (≈ 3 lines) with a 28px bottom fade to `--box-bg`. (c) footer `.cx-foot` (flex, gap 8px): **Show more ▾ / Show less ▴** toggle (`.cx-showmore`, Sora 11.5px / 600, indigo) on the left; right cluster = `.cx-meta` "**✦ Generated {Mon D}**" (DM Mono 10px, color `--t4`) · separator "·" · **↻ Regenerate** (`.cx-regen`, Sora 11px / 600 indigo, underline on hover).

**`stale`** — same as fresh, plus:
- An amber **stale bar** `.cx-stale-bar` pinned above the analysis: `display:flex; gap:9px; padding:8px 10px; border-radius:6px; background:#FFFBEB; border:1px solid #FDE68A`. Leading `⚠` icon `--amber-ink` 13px. Text `.cx-stale-txt` 11.5px, color `#92600A`, line-height 1.45 — copy: *"Your profile changed on {date}, after these notes were written. The score above is current — refresh the notes to match."* Trailing button `.cx-stale-btn` **↻ Refresh notes** (Sora 11.5px / 600, padding 5px 11px, radius 6px, border `1.5px solid #FDE68A`, bg `#fff`, color `--amber-ink`; hover bg `#FEF3C7`, border `#FCD34D`).
- Prose dims to `opacity:.5` (`.cx-notes.stale`); headline dims to `--t3`.
- Footer action label changes **Regenerate → Refresh**.

**`none`** (score present, notes never written) — no header/prose/footer; instead an inline prompt `.cx-gen-inline`: `display:flex; gap:11px; padding:11px 12px; border:1px dashed rgba(79,70,229,0.3); border-radius:6px; background:rgba(79,70,229,0.03)`. Text `.cx-gen-txt` 12px `--t2`: *"No written analysis yet. Generate notes to explain this score and surface gaps."* Primary button `.cx-gen-btn` **✦ Generate notes** (Sora 11.5px / 600, padding 6px 13px, radius 6px, bg `--indigo`, color `#fff`; hover `--indigo-hover`).

**`generating`** (LLM call in flight) — score present; notes area is a skeleton `.cx-skel`: header `.cx-skel-h` (11.5px / 600 indigo) with a 12px spinner `.cx-skel-spin` (2px ring, top `--indigo`, `spin .7s linear infinite`) + **"Writing analysis…"**, then 3 shimmer lines `.cx-skel-line` (height 10px, radius 4px, gradient `#E9E6F6`↔`#F4F2FB`, `shimmer 1.4s`) at widths **96% / 88% / 70%**.

**`error`** (last LLM generate/refresh failed) — score present and trustworthy; the notes region shows a compact retry row styled like the stale bar but red-tinted: background `#FEF2F2`, border `1px solid #FECACA`, a `⚠` icon in `#DC2626`, text *"Couldn’t write the analysis. The score above is unaffected."*, and a **↻ Try again** button (same metrics as `.cx-stale-btn`, red palette). Never blocks or hides the score.

> **Refresh policy (decision D1, §11):** stale never auto-regenerates — the user clicks Refresh. The score stays trustworthy regardless; only the prose waits.

### 14.6a · AI provider OFF (notes locked, score intact) — added 2026-06-18

> **Gap resolution.** Closes the undefined case where `hasAiConfigured()` is false (AI provider disabled, no key, or the `compat` feature toggled off) **but the score and/or notes already exist**. Today `renderNoneState` swaps in the "Enable AI in Settings →" link, but `renderFreshLikeState` does **not** — so Regenerate/Refresh buttons render yet silently no-op (gated by `hasAiConfigured()` in `generate()`). This section defines the locked presentation. Reference drawing: [`mockups/Compatibility States.html`](../mockups/Compatibility%20States.html) §D.

**Governing principle:** the **score is deterministic** (§14.1, `computeCompatibility`) and is **never** affected by the AI setting — it always renders normally when a profile exists. AI-off **only** locks *written-analysis generation*. Every AI action (Generate / Regenerate / Refresh / Try again) is replaced by the **`.cx-enable-ai` link** — Sora 11.5px / 600, `color:--indigo`, text **"Enable AI →"** (shortened from the §13.1 "Enable AI in Settings →" to fit the footer/inline rows without crowding the meta line), click → `actions.openSettings()`.

Behavior per `NotesState` when `!hasAiConfigured()`:

| `NotesState` | Notes body | Replaces the AI action with… | Other changes |
| --- | --- | --- | --- |
| `fresh` | shown, **read-only**, slightly muted (`.cx-notes.muted`, `opacity:.62`) | footer **Regenerate** → `.cx-enable-ai` link | `✦ Generated {date}` meta stays |
| `stale` | shown, dimmed (`.cx-notes.stale`, `opacity:.5`) | the amber **stale bar is replaced** by a neutral **`.cx-aioff-bar`** | footer **Refresh** action removed (meta only) |
| `none` | — | inline prompt **Generate** → `.cx-enable-ai` link *(already shipped)* | dashed `.cx-gen-inline` retained |
| `generating` | n/a — can't start while AI is off; never reached | — | — |
| `error` | n/a — implies a prior attempt; once AI is off, fall back to `fresh`/`stale`/`none` rules | — | — |

**`.cx-aioff-bar`** (neutral replacement for the amber stale bar): `display:flex; align-items:center; gap:9px; padding:9px 11px; border-radius:6px; background:#F6F6F8; border:1px solid var(--border)`. Lock glyph `.cx-aioff-ic` (15px inline SVG, `--t3`) · text `.cx-aioff-txt` (Sora 11.5px, `--t2`): *"These notes are out of date and can't be refreshed while AI is off. The score above is current."* · trailing `.cx-enable-ai` link. **Neutral, not amber** — amber implies a one-tap fix, but the action is two steps away (enable AI first), so it must not read as an urgent in-place action.

**Collapsed preview is unchanged by the AI setting.** AI-off + `stale` collapses **identically to normal stale** (keeps the `● Update available` marker); AI-off + `fresh` shows the normal summary. The AI-off notice surfaces **only on expand** (the `.cx-aioff-bar` / locked footer above) — expanding is exactly how the user discovers they must enable AI to refresh, so the collapsed marker needs no special variant.

### 14.7 · Empty / unavailable states (no score)

When `CompatAvailability === 'no-profile'` the whole module is **non-collapsible** (no Expand/Collapse toggle — nothing to expand) and keeps the section label only — the **✦ AI** header tag was **removed** (2026-06-18, see §15.4 note); the score is deterministic, not AI-written, so no panel-header AI chip is shown in any Compatibility state. Body is a single `.cx-empty` block: `display:flex; align-items:center; gap:13px; padding:14px; border-radius:10px; border:1px dashed --border-2 (#D1CCB9); background:#FBFAF8`. Icon `.cx-empty-ic` = 34px circle (mobile 30px), bg `#fff`, border `1px solid --border`, holding an 18px inline SVG (stroke `--t3`). For `no-profile` the glyph is a **person/profile outline** (head circle + shoulders) — it echoes the "add your profile" CTA rather than a plain ring that would read as an empty score donut. (A `.warn` red/amber icon variant also exists for notes-level errors, §14.6.) Title `.cx-empty-title` Sora 13px / 600 `--t1`; sub `.cx-empty-sub` Sora 12px `--t3` line-height 1.5. Action `.cx-empty-act` Sora 12px / 600, padding 7px 13px, radius 6px.

| Availability | Box | Icon | Title | Sub-copy | Action (style) |
| --- | --- | --- | --- | --- | --- |
| `no-profile` | neutral dashed | profile glyph (person outline, `--t3`) | **Compatibility unavailable** | "Add your profile so Alice can score how well you match this role." | **Complete profile →** (secondary) |
| `unsaved` | neutral dashed | **AI sparkle** (`assets/AI_sparkle.png`, ~19px, in an indigo-soft `.cx-empty-ic--ai` circle) | **Scored after you save** | "Create this application and Alice scores it against your profile." | **none** — the modal footer **Create** is the only action |
| `not-generated`* | `.gen` solid indigo (`border rgba(79,70,229,0.18)`, `bg rgba(79,70,229,0.04)`) | `✦` (`--indigo`) | **Not scored yet** | "Run Alice to analyze this posting against your profile." | **✦ Generate** (primary) |

Secondary action: border `1.5px solid --border`, bg `#fff`, color `--t2`; hover → indigo border/text + `--indigo-soft` bg. Primary action: bg `--indigo`, color `#fff`; hover `--indigo-hover`.

> **`unsaved` (Create mode, added 2026-06-18).** When the modal is in Create mode and the draft has no `id` yet (`availability === 'unsaved'`, code: `renderUnsavedState`), the score can't be computed against a non-existent record, so the module is **non-collapsible** and shows the empty box with the **AI-sparkle glyph** and **no button** — the score appears automatically once the user hits the footer **Create**. Do **not** add a "Create →" affordance; it duplicates the footer action and misleads (the box isn't what saves). Matches `renderUnsavedState`, which appends `createSparkleIcon()` + copy only.

> *`not-generated` is the empty-state equivalent of the inline `none` notes prompt. Because the score auto-computes (and never errors — D5), the score is normally present and the *notes* use the inline `none` prompt (§14.6); reserve this full-module `not-generated` state for the rare case where scoring itself has not yet run. A failed LLM notes call is **not** a module-empty state — it is the notes-level `error` state (§14.6).

### 14.8 · Collapsed state (default)

Compatibility opens **collapsed** by default. Collapsed body `.cx-collapsed-content`: `display:flex; align-items:center; gap:9px; padding:9px 11px; border-radius:10px; background:rgba(79,70,229,0.045); border:1px solid rgba(79,70,229,0.14)` (same indigo box as expanded). Contents, left→right:
1. **Mini score ring** 30px / stroke 4px / number 11px (always shown — the live score).
2. **Verdict text** `.cx-verdict-text` (Sora 12px / 600) in the tier **ink** color.
3. Em-dash "—" in `--t4`.
4. **Freshness-dependent trailing content**:
   - `fresh` → headline summary `.cx-summary` (Sora 12px / **600**, color `--t1`, single-line ellipsis).
   - `stale` → summary in `--t3` **plus** an amber **"● Update available"** marker `.cx-update-dot` (DM Mono 10px, `--amber-ink`, 6px `#EAB308` dot).
   - `none` → italic "Notes not generated" in `--t4`.
   - `generating` → "Writing analysis…" in `--indigo`.

### 14.9 · Section toggle (shared with Timeline)

Single right-aligned control `.sec-toggle` that morphs in place — **no** left-edge chevron. Sora 11px / 500, color `--t3`, padding 2px 7px, radius 4px; hover color `--indigo`, bg `--indigo-soft`. Leading chevron `.sec-chev` (DM Mono 13px) points right when collapsed, **rotates 90°** when open. Label: **"Expand"** (collapsed) / **"Collapse"** (open). Lives in the section header’s right cluster (which holds **only** this toggle — the ✦ AI header tag was removed 2026-06-18, see §15.4 Panel 3). Timeline uses the identical control.

### 14.10 · AI provenance, actions & copy

- **✦ AI tag** `.ai-tag`: Sora 10px / 600, letter-spacing .2px, color `--indigo` `#4F46E5`, bg `--indigo-dim` `#EEF2FF`, padding 2px 8px, radius 999px. The sparkle marks **machine-written content**, never an action (consistent with §13.2). It appears **only** at 9px beside the "Analysis" sub-label (the score is deterministic, not AI-written). **It is no longer shown in the panel header** — that chip was removed 2026-06-18 in every Compatibility state (§14.7, §15.4 Panel 3).
- **Actions are buttons, not the sparkle.** Regenerate / Refresh / Generate notes / Try again carry a `↻` or `✦` glyph on the button itself.
- Meta line uses `✦ Generated {Mon D}` (e.g. `✦ Generated Jun 9`) in DM Mono 10px `--t4`.
- The notes are **read-only AI output** — there is no inline text editor; the only way to change them is Regenerate/Refresh (consistent with the answered design question).

### 14.11 · Headline (LLM `summary`) constraints

- **Hard cap: 34 characters** (≈ 6 words), one short clause. Rationale: on mobile-expanded the headline shares its row with the 58px ring (≈ 260px free), so 34 chars guarantees a single line in every layout.
- The model should return `summary` already within budget; the UI is a safety net only — `.cx-headline` is single-line with ellipsis and will **truncate, never wrap**.
- Prose `body` targets a medium length (a few sentences or a short bulleted analysis); the 62px clamp + Show more handles longer output without growing the modal.

### 14.12 · Responsive

- **Desktop / tablet (≥ 640px):** ring 64px; score row is ring + meta inline; skills row is 2 columns.
- **Mobile bottom sheet (< 640px, `.compact`):** ring 58px; the body grid is single-column so the module is full width regardless. Within the panel: the stale bar wraps and pushes **Refresh notes** to `margin-left:auto`; the `none` generate prompt stacks vertically with a **full-width** button; empty-state `.cx-empty` stacks vertically (icon → text → full-width action); skills grid collapses to 1 column. Collapsed mini-ring stays 30px.

### 14.13 · Design tokens used (from the live Tracker `:root`)

| Token | Value | Used for |
| --- | --- | --- |
| `--indigo` | `#4F46E5` | AI tag text, primary buttons, links |
| `--indigo-hover` | `#4338CA` | primary button hover |
| `--indigo-dim` | `#EEF2FF` | AI tag background |
| `--indigo-soft` | `#F4F2FF` | secondary button / toggle hover bg |
| `--t1` | `#1A1A2E` | primary text, ring number, headline |
| `--t2` | `#4B5563` | notes prose, secondary button text |
| `--t3` | `#9CA3AF` | labels, sub-copy, stale headline |
| `--t4` | `#C4BDB5` | meta, em-dash, placeholder italics |
| `--amber-ink` | `#A16207` | stale + learning ink |
| `--border` | `#E8E3DA` | empty-icon / secondary button border |
| `--border-2` | `#D1CCB9` | dashed empty-state border |
| `--surface` | `#FFFFFF` | modal / icon background |
| `--r-sm` `--r-md` `--r-pill` | `6px` `10px` `999px` | button / panel / pill radii |

Indigo panel tints (`rgba(79,70,229,…)`) are derived from `--indigo`; keep them as literal rgba so the box reads as a soft wash rather than a solid fill.

### 14.14 · Class → purpose quick reference

`.cx-header` section title row · `.sec-head-r` right cluster · `.sec-toggle`/`.sec-chev` expand control · `.cx-panel` expanded box · `.cx-score-row`/`.cx-score-meta` live score · `.ring-wrap`/`.ring-num` donut · `.verdict-pill`/`.vd` tier pill · `.cx-headline` LLM summary · `.cx-rule` divider · `.cx-notes-head`/`.cx-notes-h` Analysis label · `.cx-notes` prose (`.clamp`, `.stale`) · `.cx-foot`/`.cx-showmore`/`.cx-meta`/`.cx-regen` notes footer · `.cx-stale-bar`/`.cx-stale-txt`/`.cx-stale-btn` staleness · `.cx-gen-inline`/`.cx-gen-btn` generate prompt · `.cx-skel`/`.cx-skel-line` generating · `.cx-collapsed-content`/`.cx-verdict-text`/`.cx-summary`/`.cx-update-dot` collapsed bar · `.cx-empty`/`.cx-empty-ic`/`.cx-empty-act` unavailable · `.chip.lvl-high`/`.lvl-low`/`.miss` skill coding · `.skills-legend` legend.

---

## 15 · Panelized body redesign (2026-06-18)

> **History-preserving revision.** This section is **normative and authoritative** for the modal **body** as built in `Application Overlay - Panels.html` / `overlay-panels.jsx`. Where it conflicts with earlier sections it **wins**; the superseded text is left in place as history. Specifically it **supersedes**:
> - **§4 · Body — field order & layout** — the flat two-column field grid (`.modal-body`, `grid-template-columns:1fr 1fr`) is **replaced** by a single vertical column of **5 cards** (`.pbody` → `.panel`). The §4 field *table* still defines which fields exist, their input types, dropdown values, validation, and inline-edit behavior (§5) — only their **grouping and container** change.
> - **§14.3 · Layout & containers (Compatibility)** — the compat module is no longer a bare `.mfield.full` with an inner indigo-wash `.cx-panel` box. It is now a **panel card** (`.panel.panel-ai`) whose header is a `.panel-head` and whose body renders the §14.4–14.6 score/notes content **directly** (the inner `.cx-panel` wash box is dropped). §14.4 (score ring + ramp), §14.5 (skill coding), §14.6 (notes lifecycle), §14.7 (empty states), §14.10 (✦ AI tag), §14.11 (copy budget) are **unchanged**.
>
> **The header, footer, modes (§1), frame width (§2), header rows (§3), inline-edit (§5), save/discard (§6–7), quick actions (§8), keyboard (§9), archived mode (§12), and Create/smart-fill (§13) are NOT changed by this revision.**

### 15.1 · Body container

The scrollable body is `.pbody` (replaces `.modal-body`):

| Property | Desktop (`.pbody`) | Mobile (`.pbody.compact`) |
| --- | --- | --- |
| `display` | `flex` | `flex` |
| `flex-direction` | `column` | `column` |
| `gap` (between panels) | `13px` | `11px` |
| `padding` | `16px` | `12px 12px 18px` |
| `background` | `#FAF8F4` (warm off-white, one step warmer than `--surface`; makes the white cards read as raised) | same |
| `overflow-y` | `auto` (real modal). *In the design-canvas demo only, `.modal{height:auto}` + `.pbody{overflow:visible}` let the card grow — production keeps the modal height-clamped per `application_timeline.md › Modal vertical sizing` and scrolls inside `.pbody`.* | same |

### 15.2 · Panel card — the shared shell

Every body section is a `<section class="panel panel--elevated">`. **Elevated is the chosen and only production card style** (the `--fill` and `--outline` variants explored on the canvas are **not** shipped — do not implement them).

`.panel` (base): `display:flex; flex-direction:column; gap:11px; border-radius:var(--r-md)` (= **10px**); CSS var `--box-bg:#fff` (consumed by the notes fade-gradient in §14.6).

`.panel--elevated`:
- `background: var(--surface)` (`#FFFFFF`)
- `border: 1px solid rgba(26,26,46,0.05)`
- `box-shadow: 0 1px 2px rgba(26,26,46,0.05), 0 8px 20px rgba(26,26,46,0.07)`
- `padding: 14px 16px`

### 15.3 · Panel header — `.panel-head`

`display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:18px`.

- **Left cluster** `.panel-head-l` (`display:flex; align-items:center; gap:8px; min-width:0`):
  - **Icon** `.panel-ic`: `15×15px`, `color:var(--t3)`. Inline `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">`. One per panel (§15.4).
  - **Title** `.panel-title`: **Sora 11px / 600**, `color:var(--t2)`, `letter-spacing:0.6px`, `text-transform:uppercase`, `white-space:nowrap`. **Note:** this is heavier/uppercase and **supersedes** the old `.mfield-label`-style section labels (Sora 11px/500, `--t3`, sentence case) used in §14.3 and the Timeline doc's collapsed-label.
- **Right cluster** `.panel-head-r` (`display:flex; align-items:center; gap:8px; flex-shrink:0`): an optional **accessory** slot then, on collapsible panels, the **Expand/Collapse** toggle. *(The Compatibility panel's accessory slot is empty — its former ✦ AI tag was removed; see §15.4 Panel 3.)*

**Collapsible header** adds `.clickable`: the *entire header* is the hit target — `cursor:pointer; margin:-3px -6px; padding:3px 6px; border-radius:var(--r-sm)`; `role="button"`, `tabIndex=0`; `Enter`/`Space` toggle. Hover `background:rgba(79,70,229,0.06)`; `focus-visible` outline `2px solid var(--indigo)` offset `1px`. The inner `.sec-toggle` button stops propagation so it doesn't double-fire.

**Toggle control** `.sec-toggle` (reused from §14.9, unchanged): `background:none; border:none; cursor:pointer`; **Sora 11px / 500**, `color:var(--t3)`; label text **"Expand"** (collapsed) / **"Collapse"** (open). Chevron `.sec-chev`: DM Mono `›`, 13px; `transform:rotate(90deg)` when open (`.open`); transitions `.15s`. Hover (whole header or button) recolors chevron + label to `--indigo`.

### 15.4 · The 5 panels — order, contents, collapse behavior

Fixed top-to-bottom order. **Do not reorder without updating this section.**

> **Order correction (2026-06-21, feature 039 as-built).** **Skills precedes Compatibility** — matching §4.1 and the shipped `Modal._renderBody()`. An earlier 2026-06-18 draft of this table listed Compatibility as panel #2 and Skills as #3; that ordering was never built and is superseded. Normative order: **Overview → Skills → Compatibility → Timeline → Notes & Links.**

| # | Panel | `.panel-title` | Icon (20×20, stroke 1.5) | Collapsible? | Default state |
| - | ----- | -------------- | ------------------------ | ------------ | ------------- |
| 1 | **Overview** | `OVERVIEW` | rounded rect + 3 text lines | **Yes** | **Expanded** |
| 2 | **Skills** | `SKILLS` | two check-marks + two lines | **Yes** | **Collapsed** |
| 3 | **Compatibility** | `COMPATIBILITY` | two concentric circles (target) | **Yes** | **Collapsed** |
| 4 | **Timeline** | `TIMELINE` | clock (circle + hands) | **Yes** | **Collapsed** |
| 5 | **Notes & Links** | `NOTES & LINKS` | document with folded corner | **Yes** | **Collapsed** |

> **Collapsibility is uniform across viewports (updated 2026-06-18):**
> - **All five panels are collapsible on both desktop (≥ 640px) and mobile (< 640px).** Every panel renders the Expand/Collapse header toggle; there is no longer any viewport-conditional collapsibility.
> - **Default-open set = Overview only**, on every viewport. The modal/bottom-sheet **opens with only Overview expanded**; Skills, Compatibility, Timeline, and Notes & Links all start **collapsed** to their one-line previews. Rationale: uniform behavior across breakpoints, maximally compact by default, while the most-scanned facts (Overview) stay visible.
>
> This supersedes **both** the original "Overview & Notes never collapsible" wording **and** the interim 2026-06-18 "collapsibility differs by viewport" note (desktop-keeps-Overview/Notes-open). Implementation: every panel passes `collapsible` unconditionally; `overviewOpen` defaults `true`, all four others default `false`, regardless of the `compact` flag.

**Collapsed previews for Overview & Notes (all viewports).** When collapsed, each shows a single-line preview in the panel body (same `.tl-collapsed-content` container as the other previews):
- **Overview** → `OverviewPreview`: `Company` (Sora 12px / 600, `--t1`) · `Location` (12px, `--t2`) · `Salary` (DM Mono 11px, `--t2`), middot-separated.
- **Notes & Links** → `NotesPreview`: the General Notes text on one line, ellipsis-truncated (`.tl-text-line`).

#### Panel 1 · Overview

Wrapper `.stacked-fields` (`display:flex; flex-direction:column; gap:12px`) holding, in order:

1. A `.panel-grid` (`display:grid; grid-template-columns:1fr 1fr; gap:13px 22px`; mobile `.compact` → `gap:12px 16px`; **stays 2-column on mobile** — it does not collapse to 1 column) containing **7 fields**, filling left-to-right, top-to-bottom:

   | Row | Left | Right |
   | --- | ---- | ----- |
   | 1 | Company | Recruiter |
   | 2 | Location | Salary *(mono)* |
   | 3 | Shift | Work Setup |
   | 4 | **Min Years** | *(empty cell)* |

   `Min Years` is the **new** field resolved in §11 · D3 — here it lands as the **left cell of row 4**, last in the grid, directly above Responsibilities. Salary value uses `.mfield-val.mono` (DM Mono 12px); all others `.mfield-val` (Sora 13px, `--t1`, line-height 1.5; inside a panel `min-height:0; padding:1px 0`). Labels `.mfield-label` (Sora 11px / 500, `--t3`).

2. **Responsibilities** — a full-width `.mfield` **moved out of its own row and into Overview** (supersedes §4 row #5 placement). Label `Responsibilities`; value rendered via the **`ClampText`** primitive (§15.5): clamps to **2 lines desktop / 4 lines mobile**, with a **Show more / Show less** toggle.

#### Panel 2 · Skills

Collapsible, **default collapsed**.

- **Collapsed preview** `.skills-preview` (`display:flex; align-items:center; gap:14px; flex-wrap:wrap`): three count chips `.skp` (Sora 12px, `--t2`; count in `<b>` 600 `--t1`): **`✓ N proficient`** (`✓` `.hi` `#16A34A`) · **`● N learning`** (`●` `.lo` `#D97706`) · **`✕ N missing`** (`✕` `.ms` `#DC2626`). Counts aggregate Required + Preferred.
- **Expanded body** = the §14.5 skills content: `.skills-grid` (`grid-template-columns:1fr 1fr; gap:13px 24px`; mobile → 1 column) with **Required Skills** / **Preferred Skills** columns of proficiency-coded `.chip`s, followed by `.skills-legend`.

#### Panel 3 · Compatibility

`.panel.panel-ai` (the AI-signal glow — §15.6). Collapsible, **default collapsed**.

> **No header AI chip (2026-06-18).** The Compatibility panel header carries **no ✦ AI tag** — its `.panel-head-r` accessory slot is empty (only the Expand/Collapse toggle renders). Rationale: the **score is deterministic** (computed from profile vs. posting, §14.1), not AI-written, so an AI badge on the whole panel would be misleading; the only machine-written content is the **Analysis prose**, which already carries its own inline ✦ AI tag in `.cx-notes-head` (§14.6). This holds in **every** Compatibility state (fresh / stale / generating / error / no-profile), superseding §14.7's "keeps the ✦ AI tag" and §15.4's earlier "Header accessory = ✦ AI tag."

- **Collapsed preview** (`.tl-collapsed-content`, `display:flex; align-items:center; gap:8px`): a **30px** mini score ring (stroke 4, number 11px) · verdict label in tier **ink** color · em-dash · the LLM `summary` (`.cx-summary`, single-line ellipsis). This replaces the §14.8 `.cx-collapsed-content` indigo-wash bar — in the panelized layout the surrounding card already carries the AI styling, so the preview sits directly in the panel body with no inner box.
- **Expanded body** = the §14.4–14.6 content (`.cx-score-row` → `.cx-rule` → `.cx-notes-head` "Analysis" + ✦ AI → `.cx-notes` clamped prose with Show more → `.cx-foot` meta + Regenerate), rendered **directly in the panel body** (no inner `.cx-panel` wash box).

#### Panel 4 · Timeline

Collapsible, **default collapsed**. Full normative spec lives in [`application_timeline.md`](application_timeline.md) (and its 2026-06-18 revision). In this layout the Timeline is **its own panel** — this supersedes that doc's "row 5 of the modal body grid" placement. The Expand/Collapse control is the panel header toggle (§15.3).

- **Collapsed preview** (`.tl-collapsed-content`): latest entry — `.tl-date-text` · status `.badge` · note `.tl-text-line` (single-line ellipsis) · `.tl-more-hint` `+N earlier` (DM Mono 10px, `--t4`) when >1 entry.

#### Panel 5 · Notes & Links

Collapsible; default **collapsed** (all viewports). `.stacked-fields` with:
1. **Job Posting URL** — `.mfield` rendered as `.url-val` (indigo, DM Mono 12px, underlined, `word-break:break-all`).
2. **General Notes** — `.mfield` whose value uses **`ClampText`** clamped to **3 lines on both desktop and mobile** (`lines=3, mlines=3`), with Show more / Show less.

> **Renamed:** the cluster previously sketched as "Description & Notes" is shipped as **"Notes & Links"**, and it holds **only** URL + General Notes — Responsibilities moved up into Overview (above).

### 15.5 · `ClampText` primitive (Responsibilities + General Notes)

A reusable line-clamp + toggle. Markup: `.clamp-wrap` (`display:flex; flex-direction:column; align-items:flex-start; gap:2px`) → value div `.mfield-val.clamp-text` + optional `.clamp-toggle` button.

- Clamped state adds `.clamped`: `display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; -webkit-line-clamp:var(--lines, 2)`. Inside `.compact` (mobile) the clamp uses `-webkit-line-clamp:var(--mlines, 4)` instead. `--lines` / `--mlines` are set per instance: Responsibilities `2 / 4`, General Notes `3 / 3`.
- **Toggle** `.clamp-toggle`: **Sora 11.5px / 600**, `color:var(--indigo)`, `background:none; border:none; padding:2px 0; margin-top:2px`; label **"Show more"** (clamped) / **"Show less"** (expanded); hover `text-decoration:underline`.
- **Visibility rule:** the toggle renders **only when the text actually overflows** the clamp (measured on mount: `scrollHeight − clientHeight > 2`) **or** once expanded. Short values that fit show no toggle.

### 15.6 · Compatibility AI glow — `.panel.panel-ai`

The single visual cue that marks Compatibility as the AI-generated panel. Applied **in addition to** `.panel--elevated`, on the Compatibility card only:

- `background: var(--surface)` (stays white — **not** a fill)
- `border-color: #DCD4F3` (soft lavender hairline)
- `box-shadow: 0 0 0 1px rgba(79,70,229,0.10), 0 2px 10px rgba(79,70,229,0.16), 0 16px 40px rgba(79,70,229,0.26)` — a layered indigo **glow/halo** (`--indigo` = `#4F46E5`).

> **Supersedes** the §14.3 "indigo wash `.cx-panel` box" and the §14.13 note to "keep tints as a soft wash" **for the panel container**: the AI signal is now a *white card with a purple glow*, not a tinted fill. (The score ring, verdict pill, and chip tints inside the panel are unchanged.) Design intent landed after iterating from a heavy purple fill → whisper tint → this glow; treat the glow values as final.

### 15.7 · Mobile bottom-sheet

At `< 640px` the modal is a bottom-sheet; the body is `.pbody.compact`. Differences from desktop:
- **Grab handle** `.sheet-grab` at the top of the header: `36×4px`, `border-radius:99px`, `margin:0 auto 4px`; `background:rgba(255,255,255,.55)` on dark headers, `rgba(0,0,0,.18)` on light (`.hdr-dark`).
- Tighter `.pbody` gap/padding (§15.1); `.panel-grid` keeps 2 columns; `.skills-grid` → 1 column.
- `ClampText` uses the `--mlines` budget (Responsibilities 4 lines).
- **Collapse behavior is identical to desktop** — all five panels collapsible, only Overview open by default (§15.4). No mobile-specific collapse logic remains: `Modal` passes `collapsible` unconditionally to every panel, and the default open-state is `overviewOpen = true` with Compatibility/Skills/Timeline/Notes all `false`, regardless of the `compact` flag.
- Timeline rows reflow to two lines — see the timeline doc's 2026-06-18 revision.
