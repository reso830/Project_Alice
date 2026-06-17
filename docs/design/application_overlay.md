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

18px padding (desktop) / 14px padding (mobile). 14px row gap, 24px column gap. Two-column grid: `grid-template-columns: 1fr 1fr`.

**Order matches the spec — DO NOT reorder without updating this doc.** (Reordered in the 2026-06 redesign.)

| # | Col 1                   | Col 2                   | Notes                                                              |
| - | ----------------------- | ----------------------- | ------------------------------------------------------------------ |
| 1 | Company                 | Recruiter               | Both single-line text                                              |
| 2 | Location                | Salary                  | Salary parsed as PHP (₱); accepts `50k`, `50,000`, `50000-80000`   |
| 3 | Shift                   | Work Setup              | Both dropdowns                                                     |
| 4 | Min Years (half)        |                         | Numeric — minimum years of experience the role asks for; single-line. Sits directly above Responsibilities. |
| 5 | Responsibilities (full) |                         | `grid-column: 1 / -1`; multiline textarea                          |
| 6 | Required Skills         | Preferred Skills        | **2-column skills grid + legend, full-width** (`grid-column: 1 / -1`; inner grid `1fr 1fr`, 13px row / 24px col gap). Chips are **proficiency-coded** against the user profile — see §14.5. Stacks to one column < 640px. |
| 7 | Compatibility (full)    |                         | **Collapsible module** — full normative spec in §14. Replaces the old bar + notes cells. |
| 8 | Timeline (full)         |                         | Collapsible. **Detailed spec out of scope this round** (separate doc update). |
| 9 | URL (full)              |                         | Single-line, validates `https://`                                  |
| 10 | General Notes (full)   |                         | Multiline; longest field, anchors bottom of body                   |

> **✓ Removed (confirmed 2026-06):** the old **"Last Updated"** half-width read-only field is gone — it is not present in the current code, and the Timeline already surfaces the most-recent status-change date. A new **"Min Years"** field (row 4) takes the slot above Responsibilities.

### Dropdown values
- **Shift:** Day · Mid · Night · Flexible
- **Work Setup:** Remote · Hybrid · On-site · Field

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

Full-width, collapsible module at body order #7 (between Skills and Timeline). Replaces the retired half-width bar + "Compatibility Notes" textarea. **All values below are normative — implement to the number.** Type: **Sora** for UI/labels/buttons, **DM Mono** for numbers/meta/chips (same two families as the rest of the Tracker).

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
type CompatAvailability = 'scored' | 'no-profile';        // score never errors (D5)
type NotesState = 'fresh' | 'stale' | 'none' | 'generating' | 'error';  // 'error' = LLM call failed
// none      = notes === null
// stale     = notes != null && (profile.updatedAt > notes.generatedAt || application.updatedAt > notes.generatedAt)
// fresh     = notes != null && !stale
// generating= an LLM regenerate/generate call is in flight
// error     = the last LLM generate/refresh call failed (retryable)
```

### 14.3 · Container & section frame

- Wrapper is a full-width body field: `.mfield.full` (`grid-column: 1 / -1`).
- **Section header row** (`.cx-header`, `display:flex; justify-content:space-between; align-items:center; margin-bottom:2px`):
  - Left: label **"Compatibility"** — Sora 11px / 500, color `--t3` `#9CA3AF` (matches every other `.mfield-label`).
  - Right (`.sec-head-r`, gap 8px): the **✦ AI** provenance tag (§14.10) then the **Expand/Collapse** toggle (§14.9).
- **Expanded panel** (`.cx-panel`): `display:flex; flex-direction:column; gap:11px; padding:14px; border-radius:10px (--r-md);` background `rgba(79,70,229,0.045)`, border `1px solid rgba(79,70,229,0.14)`. This soft indigo box is the **AI-content affordance** — only the Compatibility module gets it; ordinary fields stay borderless. Inner fade var `--box-bg:#F8F8FE`.
- Internal vertical order inside the panel: **(1)** score row → **(2)** divider `.cx-rule` (`border-top:1px solid rgba(79,70,229,0.14); margin:1px 0`) → **(3)** notes region.

### 14.4 · Score block (always live)

**Layout** `.cx-score-row` — `display:flex; gap:14px; align-items:center`. Left = ring; right = `.cx-score-meta` (`flex-direction:column; gap:6px`) holding the verdict pill then the headline.

**Score ring** (SVG donut, number only — no "%"):
- Diameter: **64px desktop**, **58px mobile** (`.compact`). Collapsed mini-ring: **30px** (§14.8).
- Stroke width: **8px** (mini-ring 4px). Two stacked circles; arc starts at **12 o’clock** (`rotate(-90)`), sweeps **clockwise**, `stroke-linecap:round`.
- **Track circle** color: `#EDE8DF`. **Progress arc** color: the tier color from the ramp below.
- **Center number**: DM Mono, weight 500, color `--t1` `#1A1A2E`, font-size `round(diameter × 0.32)` (64→20px, 58→19px); mini-ring forced to 11px. Integer score, no suffix.
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

### 14.7 · Empty / unavailable states (no score)

When `CompatAvailability === 'no-profile'` the whole module is **non-collapsible** (no Expand/Collapse toggle — nothing to expand) but keeps the section label and the **✦ AI** tag (dimmed to `opacity:.5` for `no-profile`). Body is a single `.cx-empty` block: `display:flex; align-items:center; gap:13px; padding:14px; border-radius:10px; border:1px dashed --border-2 (#D1CCB9); background:#FBFAF8`. Icon `.cx-empty-ic` = 34px circle (mobile 30px), bg `#fff`, border `1px solid --border`. (A `.warn` red/amber icon variant also exists for notes-level errors, §14.6.) Title `.cx-empty-title` Sora 13px / 600 `--t1`; sub `.cx-empty-sub` Sora 12px `--t3` line-height 1.5. Action `.cx-empty-act` Sora 12px / 600, padding 7px 13px, radius 6px.

| Availability | Box | Icon | Title | Sub-copy | Action (style) |
| --- | --- | --- | --- | --- | --- |
| `no-profile` | neutral dashed | `○` (`--t3`) | **Compatibility unavailable** | "Add your profile so Alice can score how well you match this role." | **Complete profile →** (secondary) |
| `not-generated`* | `.gen` solid indigo (`border rgba(79,70,229,0.18)`, `bg rgba(79,70,229,0.04)`) | `✦` (`--indigo`) | **Not scored yet** | "Run Alice to analyze this posting against your profile." | **✦ Generate** (primary) |

Secondary action: border `1.5px solid --border`, bg `#fff`, color `--t2`; hover → indigo border/text + `--indigo-soft` bg. Primary action: bg `--indigo`, color `#fff`; hover `--indigo-hover`.

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

Single right-aligned control `.sec-toggle` that morphs in place — **no** left-edge chevron. Sora 11px / 500, color `--t3`, padding 2px 7px, radius 4px; hover color `--indigo`, bg `--indigo-soft`. Leading chevron `.sec-chev` (DM Mono 13px) points right when collapsed, **rotates 90°** when open. Label: **"Expand"** (collapsed) / **"Collapse"** (open). Lives in the section header’s right cluster, after the ✦ AI tag. Timeline uses the identical control.

### 14.10 · AI provenance, actions & copy

- **✦ AI tag** `.ai-tag`: Sora 10px / 600, letter-spacing .2px, color `--indigo` `#4F46E5`, bg `--indigo-dim` `#EEF2FF`, padding 2px 8px, radius 999px. The sparkle marks **machine-written content**, never an action (consistent with §13.2). It appears in the section header (both states) and again at 9px beside the "Analysis" sub-label.
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
