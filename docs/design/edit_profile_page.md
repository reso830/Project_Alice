# Edit / Setup Profile Page — Design Specification
**Project Alice** · Last updated: June 5, 2026

> **Companion to [`profile_page.md`](profile_page.md).** That document covers the
> read-only Profile page; this one covers the full-page **Edit / Setup Profile**
> form reached from it.
>
> **Status legend** — each section is tagged:
> - **[SHIPPED]** — implemented in the codebase as of this revision.
> - **[PROPOSED]** — designed and prototyped (`Edit Profile Flow.html`), **not yet
>   implemented**. Subject to change.

> **For engineers / coding agents.** §0 below tells you how to run the reference
> prototype and drive every state. Treat §3, §5, §10 (Acceptance criteria) and
> §11 (Reason codes) as the build contract for the new flow; §4 documents the
> already-shipped form so the new flow plugs into it unchanged. Where copy is in
> quotes, treat it as the intended string.

---

## 0. Reference prototype & previewing states

The reference implementation is **`Edit Profile Flow.html`** (React + Babel,
single file plus `epf-data.jsx`, `epf-screens.jsx`, `epf-form.jsx`, and the
shared `profile-skills.jsx`). It has **no on-screen debug controls** — every state
is reached with URL params so reviewers and tests can deep-link them:

| URL param | Effect |
|-----------|--------|
| *(none)* | First-time setup: split-card gate over an empty form, AI on, happy path |
| `?mode=existing` | Editing an existing (populated) profile: no gate, Smart-import bar at top |
| `?ai=off` | AI features off — Smart entry locked, "Enable AI in Settings →" |
| `?fail=1` | Next AI parse is **unavailable** (recoverable; basic parser can take over) |
| `?fail=hard` | Résumé is **unreadable** by either parser (dead-end error) |
| `?reason=<key>` | Which AI-down reason to show (see §11): `rate_limit` · `invalid_key` · `quota` · `timeout` · `server` · `network` |

Params compose, e.g. `?mode=existing&fail=1&reason=quota`.

> The prototype simulates parsing with timers and fixed fixtures (`EPF_PARSED`,
> `EPF_APPEND` in `epf-data.jsx`). Real implementation swaps those for the parser
> calls; all UI states, copy, provenance, and merge rules are the contract.

---

## Table of Contents
0. [Reference prototype & previewing states](#0-reference-prototype--previewing-states)
1. [Overview & Entry Points](#1-overview--entry-points)
2. [Page Chrome & Layout](#2-page-chrome--layout) **[SHIPPED]**
3. [Entry Flow & States](#3-entry-flow--states-proposed) **[PROPOSED]**
   - 3.1 [First-time vs. returning rule](#31-first-time-vs-returning-rule)
   - 3.2 [Mode gate — split cards](#32-mode-gate--split-cards)
   - 3.3 [Smart input — upload / paste](#33-smart-input--upload--paste)
   - 3.4 [Processing state](#34-processing-state)
     - 3.4.1 [Two-parser model](#341-two-parser-model)
     - 3.4.2 [Failure / fallback states](#342-failure--fallback-states)
   - 3.5 [Smart import for existing profiles](#35-smart-import-for-existing-profiles)
   - 3.6 [Merge behaviour](#36-merge-behaviour)
   - 3.7 [AI dependency & disabled states](#37-ai-dependency--disabled-states)
4. [Form Sections](#4-form-sections-shipped) **[SHIPPED]**
   - 4.1 [Section & field reference](#41-section--field-reference)
   - 4.2 [Skills editor](#skills-editor)
   - 4.3 [Entry overlay (add/edit modal)](#43-entry-overlay-addedit-modal)
   - 4.4 [Validation & save gating](#44-validation--save-gating)
5. [AI-filled Provenance Markers](#5-ai-filled-provenance-markers-proposed) **[PROPOSED]**
6. [Interactions & Behaviour](#6-interactions--behaviour)
7. [Data Model (deltas)](#7-data-model-deltas)
8. [Design Tokens (additions)](#8-design-tokens-additions)
9. [Open Questions](#9-open-questions)
10. [Acceptance Criteria](#10-acceptance-criteria-proposed-flow) **[PROPOSED]**
11. [Reason Codes (enum)](#11-reason-codes-enum-proposed-flow) **[PROPOSED]**

---

## 1. Overview & Entry Points

A dedicated full-page form for setting up and editing the user's professional
profile (the model rendered read-only on the [Profile page](profile_page.md)).
Entered from either:

- **Set Up Profile** button — Profile page empty state (no profile yet)
- **Edit Profile** button — Profile page header (profile exists)

Both navigate to the same `profile-edit` page. The two entry points differ only
in the **proposed entry flow** (§3): first-time setup opens a mode gate; editing
an existing profile goes straight to the form with an import affordance at the top.

---

## 2. Page Chrome & Layout **[SHIPPED]**

### Sticky sub-header
- Same dark navy bar (`background: var(--navy)`), sticky directly below the main
  topbar (`top: 52px`).
- **Left:** **← Back** ghost button.
- **Centre:** `Edit Profile` title text (13px / 700).
- **Right:** **Cancel** (outline) + **Save** (primary) page-level controls.
- **Save** is disabled until the form is **dirty** (has unsaved changes).
- Clicking **Back** (or **Cancel**) with unsaved changes shows an in-overlay
  **discard-confirmation** dialog.

> The page-level Cancel/Save live in this sticky sub-header — there is **no**
> separate floating bottom save bar.

### Body layout
- Max-width **900px**, centred, padding `28px` (desktop) / `14px` (mobile).
- Stacked section cards, gap `24px`.

---

## 3. Entry Flow & States **[PROPOSED]**

> Everything in §3 is **proposed / not yet implemented**. It layers an
> entry-mode choice and résumé import on top of the shipped form (§4); the form
> itself is the shared destination of every path.

### 3.1 First-time vs. returning rule

The choice gate is shown **only when there is no profile yet** (the *Set Up
Profile* path). When a profile already exists (*Edit Profile* path), the gate is
**suppressed** — the user lands directly on the populated form, with the
**Smart import** affordance available, collapsed, at the top (§3.5). This keeps
the gate out of the way of users who just want to tweak a field.

**State machine**

```
                       ┌──────────── first-time (empty) ────────────┐
  open Edit/Setup ─────┤                                            │
                       └──── existing profile ──→ [FORM] ←──────────┘
                                                    ▲ (import bar, §3.5)
  [FORM] is the shared destination.

  First-time:
    [GATE] ──"Manual entry"──────────────→ [FORM] (empty)
    [GATE] ──"Smart entry"──→ [SMART INPUT] ──Process──→ [PROCESSING] ──→ [FORM] (filled, all sections marked)
    [GATE] ──X / Esc / backdrop──────────→ [FORM] (empty)   // dismiss defaults to manual

  Existing profile:
    [FORM] ──expand Import Bar──→ [SMART INPUT] ──Process──→ [PROCESSING] ──→ [FORM] (parsed items appended, affected sections marked)
```

### 3.2 Mode gate — split cards

A centered modal over the (empty) form. Backdrop `rgba(26,26,46,.42)` with a
slight blur; dialog max-width ~660px, `border-radius --r-lg`. Dismiss (X / Esc /
backdrop click) defaults to **manual** (opens the blank form).

Two equal cards, side by side (stack on < 600px):

| Card | Icon | Badge | Copy | Bullets | CTA |
|------|------|-------|------|---------|-----|
| **Smart entry** | AI sparkle (`assets/AI_sparkle.png`) on a light indigo tile | `Fastest` | "Upload your résumé and we'll fill in your profile automatically." | ✓ Parses experience, skills & more · ✓ Review before saving | `Choose →` |
| **Manual entry** | pencil glyph on a neutral tile | — | "Type your details into the form, section by section." | ✓ Full control over every field · ✓ No résumé needed | `Choose →` |

- The **Smart entry** card carries a faint indigo wash (`--indigo-soft`) to mark
  it as the recommended/AI path; the AI sparkle is the single, consistent "AI"
  signifier used across the whole flow (gate card, import bar, Process button,
  and the AI-filled markers in §5).
- **Title:** "Let's build your profile." **Sub:** "Start from a résumé, or fill
  it in yourself. You can edit everything afterward."

> **Decision (locked):** the gate uses the **split-card** layout. (Two other
> directions — a single "recommended" hero and a dropzone-first modal — were
> prototyped and set aside.)

### 3.3 Smart input — upload / paste

Reached from the Smart entry card (first-time) or the Import Bar (existing, §3.5).
A segmented control switches between two input modes:

- **Upload file** — a dropzone supporting **drag-and-drop or browse**. Accepts
  **PDF, DOCX, or TXT, up to 5 MB**. Once a file is chosen it shows a file chip
  (doc icon + name + size + "ready to parse") with a remove (×) control.
- **Paste text** — a textarea ("Paste the full text of your résumé here…").

Footer: a muted note ("Auto-parsing isn't perfect — you can edit everything
before it's saved.") and a primary **Process résumé** button (AI sparkle icon),
**disabled** until input is present (a file is chosen, or > ~20 chars pasted).

In first-time setup the smart input is presented as its own modal step
(`Import from your résumé`) after choosing Smart entry; for existing profiles it
appears inline inside the Import Bar (§3.5).

### 3.4 Processing state

After **Process résumé**, a full-screen scrim (`--bg` at ~86% with blur) shows a
**simple spinner** with:

- Title: "Reading your résumé…"
- Sub: "Extracting your experience, skills, and details"

> Per decision, this is a **plain spinner** — no staged progress / field-by-field
> reveal. On completion the form is populated and the relevant sections are
> marked (§5).

#### 3.4.1 Two-parser model

The system has **two parsers**: the **AI (LLM) parser** (richer extraction) and a
**basic rule-based parser** (the existing code's built-in fallback — faster, less
detailed). When the LLM parser is unavailable, the basic parser can usually still
fill the form. This distinction drives the failure design: an LLM outage is
**recoverable** (fall back to basic), whereas a genuinely unreadable file is a
dead-end because *neither* parser can read it.

#### 3.4.2 Failure / fallback states

| Kind | When | Treatment |
|------|------|-----------|
| **AI parser unavailable** *(recoverable)* | LLM endpoint unreachable / timeout / rate-limited; the basic parser is still available | **Ask-first** info dialog (see below). **Icon:** indigo cloud-off (informational, not alarming). |
| **Unreadable file** *(dead-end)* | File opened but **neither** parser can extract structured data (scanned / image-only PDF, gibberish, exotic layout) | Amber alert dialog: *"We couldn't read that résumé"* + tip (*a text-based PDF or pasting the text usually works better*). Actions — first-time: **Try again** · **Use a different file** · **Enter manually instead**; existing: **Try again** · **Cancel**. |

**AI-down handling — ASK FIRST (decision locked).** When the AI parser is
unavailable, the system **does not silently fall back**. It surfaces an info
dialog so the user understands what went wrong and chooses how to proceed:

- *"Smart parsing is unavailable right now"* — "You can switch to the basic
  (rule-based) parser…". Actions:
  - **Use basic parser** (primary) — fills/append via the basic parser; results
    carry the **neutral "Auto-filled" provenance tag** (§5), *not* the AI sparkle.
  - **Try AI again** — re-attempts the LLM parser. *(For `settings`-type reasons —
    invalid key / out of credits — this is replaced by **Update key in Settings →**,
    since a retry is futile; see §11.)*
  - **Enter manually instead** (first-time) / **Cancel** (existing).

> **Rationale:** the extra step is intentional — it gives the user explicit
> feedback about the failure (and its reason code, below) and a deliberate choice,
> rather than quietly substituting a lower-quality parse. A silent auto-fallback
> was prototyped and **set aside** for this reason.

**Invariants (all failure paths):**
- The overlay shows the **offending file name** as a chip for context.
- **Specific reason line.** Every error surfaces *why* it failed — a mono **code
  chip** (e.g. `HTTP 429`, `HTTP 401`, `TIMEOUT`, `NO_TEXT`) plus a plain-language
  cause, so the user isn't left guessing. The reason also **shapes the recovery
  action**:

  | Reason | Code | Recovery emphasis |
  |--------|------|-------------------|
  | Rate limit | `HTTP 429` | **Try AI again** (wait a moment) |
  | Request timeout | `TIMEOUT` | **Try AI again** |
  | Provider unavailable | `HTTP 503` | **Try AI again** |
  | Network error | `NETWORK` | **Try AI again** |
  | Invalid API key | `HTTP 401` | **Update key in Settings** (retry won't help) |
  | Out of credits | `HTTP 402` | **Update key in Settings** |
  | Unreadable file | `NO_TEXT` | **Use a different file** / paste text |

  For *settings*-type reasons the dialog replaces "Try AI again" with **Update key
  in Settings →**, since retrying a rejected key or empty balance is futile. "Use
  basic parser" remains available for every reason.
- **No partial writes.** Nothing is filled or appended until a parse (AI *or*
  basic) fully succeeds; a failure is all-or-nothing. For existing profiles,
  **Cancel leaves the form completely untouched** — a failed import must never
  partially mutate a real profile.
- **Partial extraction is _not_ a failure.** If a parser returns only some fields,
  that is success — the user completes the rest in the form. The dead-end error is
  reserved for "nothing usable from either parser."
- **Provenance follows the parser:** AI fill → "✦ AI filled" tag; basic fill →
  neutral "⚙ Auto-filled" tag (§5).

### 3.5 Smart import for existing profiles

When a profile already exists, the form carries a collapsed **Import Bar** at the
very top (above Basic Info):

```
[✦ sparkle]  Smart import
             Refresh your profile from a newer résumé          ⌄
```

- Indigo-outlined bar with a faint wash; the AI sparkle tile on the left.
- Clicking it **expands** to reveal the smart input (§3.3) inline; the chevron
  rotates. **Process résumé** runs the same processing state (§3.4), then appends
  parsed items per §3.6.
- **AI off:** the bar is non-expandable and shows a lock with an
  **"Enable AI in Settings →"** deep-link instead of the chevron (§3.7).

### 3.6 Merge behaviour

How parsed data is applied depends on whether the profile was empty:

- **First-time (empty profile) → fill all.** Every field the parser returns
  populates the form directly. The user then reviews and edits inline before
  **Save**. All sections are marked as AI-filled (§5).
- **Existing profile → append.** Parsed entries are **appended to the end of each
  list section** — Experience, Education, Skills, Certifications, Awards,
  Languages, Links. **Nothing existing is overwritten, removed, or reordered.**
  Only the sections that received new entries are marked (§5).
  - **Summary:** the parsed summary is appended as a **new paragraph** beneath any
    existing summary text (never replaces it).
  - **Basic Info (singular fields — name, city, phone, email):** filled **only if
    currently empty**; an existing value is never overwritten.

> This append-only model is intentionally **non-destructive**: a résumé import can
> only add to an existing profile, so re-importing is safe and reversible by hand.
> De-duplication of near-identical entries is an [open question](#9-open-questions). The
> prototype surfaces an **Undo** action on the post-import toast as a lightweight reversal.

> **Note:** an earlier prototype iteration showed a per-field **review/overwrite**
> modal for existing profiles. That is replaced by the append model above, and the
> prototype (`Edit Profile Flow.html`) has been updated to match.

### 3.7 AI dependency & disabled states

Smart entry depends on the **AI provider key** being enabled in Settings. When
AI is **off**:

- **Gate:** the Smart entry card is shown but **disabled**, replacing its CTA with
  an **"Enable AI in Settings →"** link (with a lock glyph). The Manual entry card
  is unaffected.
- **Import Bar (existing):** non-expandable; shows the lock + Settings link.
- The link is a deep-link into the Settings surface where the key is entered.

---

## 4. Form Sections **[SHIPPED]**

The form is the shared destination of every entry path. It renders nine stacked
section cards.

### 4.1 Section & field reference

| # | Section | Fields |
|---|---------|--------|
| 1 | Basic Info | First Name\*, Last Name\*, City/Location, Email, Phone. 2-col grid on desktop. |
| 2 | Summary | Textarea (resizable) |
| 3 | Professional Experience | Entry list with inline add/edit modal. Fields: Role\*, Company\*, Responsibilities\*, Date Started\* (MM/YYYY), Date Ended (MM/YYYY), "Currently working here" checkbox. |
| 4 | Education | Entry list. Fields: Degree & Major\*, University\*, Year Completed\*. |
| 5 | Skills | Inline rows: skill **name** field + **level picker** (tap segments 1–5) + remove (×); an **Add skill** button appends a row. New skills start **unrated**, and **Save is gated** until every skill has a level. See [Skills editor](#skills-editor) below. |
| 6 | Certifications | Entry list. Fields: Name\*, Issuing Body\*, Issuance Date\* (MM/YYYY), Expiry Date (MM/YYYY), Certificate ID. |
| 7 | Awards | Entry list. Fields: Award Name\*, Issuing Body\*, Award Date (MM/YYYY), Details. |
| 8 | Languages | Entry list. Fields: Language\*, Proficiency\* (dropdown: Beginner/Intermediate/Professional/Fluent). |
| 9 | Links | Entry list. Fields: URL\* (http/https), Friendly Name. |

\* = required field (validated on save)

> **Editing pattern (canonical):** the structured "entry list" sections
> (Experience, Education, Certifications, Awards, Languages, Links) use the
> **entry-overlay add/edit modal** described in §4.3 — *not* inline continuous
> editing. (The `Edit Profile Flow.html` prototype sketched these sections as
> inline cards to demonstrate the import flow; that was a simplification, and the
> entry-overlay pattern remains canonical.)

##### Skills editor

The Skills section uses inline rows rather than an entry-overlay modal:

```
[ Skill name            ]  [1][2][3][4][5]   ×
                            3 · Intermediate
[ + Add skill ]
```

- Each row: a **name** text input, a **level picker** (five tappable segments
  numbered 1–5), and a **remove** (×) control.
- **Level picker:** tapping segment `n` sets the level to `n` and fills segments
  1…n in that level's colour; tapping the active level again clears it. Hovering
  previews the fill in a lighter tint. A caption below reads `"{n} · {Label}"`, or
  `"Tap to set a level"` when unset.
- **Add skill** appends a new blank, **unrated** row.
- **Validation gate:** a new skill must be given a level. Rows missing a level are
  highlighted (warning tint) and the footer shows `"Set a level for every skill to
  save · {n} missing"`. The **Save** button is disabled until every named skill
  has a level and no name is blank.
- On narrow screens (< 560px) the level picker drops to its own line beneath the
  name field so the input keeps room.
- The same **"?" scale popover** is available in the editor header.

**Proficiency scale** (shared with the read-only display in
[`profile_page.md` §4.4](profile_page.md#skills-proficiency)):

| Level | Label        | Segment colour    | Flavor text                              |
|-------|--------------|-------------------|------------------------------------------|
| 1     | Beginner     | `#E07B39` orange  | Aware of the basics; needs guidance.     |
| 2     | Basic        | `#B5830C` gold    | Can handle simple tasks independently.   |
| 3     | Intermediate | `#1E9D57` green   | Productive day-to-day without help.      |
| 4     | Strong       | `#3076E8` blue    | Deep, reliable command of the skill.     |
| 5     | Expert       | `#4F46E5` indigo  | Sets direction; mentors others.          |

### 4.3 Entry overlay (add/edit modal)

Used by the structured entry-list sections (Experience, Education, Certifications,
Awards, Languages, Links).

- **Desktop:** centered modal `min(560px, 90vw)`, `max-height: 85vh`,
  `border-radius: 12px`, `box-shadow: 0 8px 32px rgba(0,0,0,.18)`.
- **Mobile:** bottom-sheet `border-radius: 16px 16px 0 0`, slides up 250ms ease-out.
- **Backdrop:** `rgba(0,0,0,.45)`, `z-index: 200`.
- **Header:** title + optional **discard-confirmation** overlay (appears when
  closing with unsaved changes).
- **Footer:** Cancel + Save buttons (right-aligned, `gap: 10px`).

### 4.4 Validation & save gating

- Required fields (\* in §4.1) are validated on save.
- **Skills:** Save is gated until every named skill has a level and no name is
  blank (§4.2).
- The page-level **Save** is disabled until the form is dirty (§2).
- Closing the page or an entry overlay with unsaved changes triggers a
  discard-confirmation dialog.

---

## 5. AI-filled Provenance Markers **[PROPOSED]**

When the form is populated or extended by the parser, the affected sections carry
a lightweight provenance signal so the user can see **what was auto-filled and by
which parser**:

- **AI fill → "✦ AI filled" tag** — a small pill beside the affected section's
  title: `[✦ AI FILLED]` (AI sparkle + label, `DM Mono` 9px uppercase, indigo on
  `--indigo-dim`).
- **Basic-parser fill → "⚙ Auto-filled" tag** — same pill shape but **neutral**
  (cog glyph, grey text on `--bg` with a hairline border, **no AI sparkle**). The
  neutral styling signals "machine-filled, lower confidence — worth a closer
  look" and keeps the AI sparkle honest (reserved for genuine LLM output).
- Both persist for the session until the user edits/saves that section.
- **Transient flash** — on import completion, the affected rows briefly flash
  indigo (`epfFlash`, ~2.6s, `--indigo-dim → --surface`) to draw the eye to what
  changed, then settle.
- **Scope:** first-time fill marks **all** sections; an existing-profile append
  marks **only** the sections that received new entries (§3.6).
- The AI sparkle (`assets/AI_sparkle.png`) is the single, consistent AI signifier
  across the gate card, the Import Bar, the Process button, and the AI-filled
  markers — and is **deliberately absent** from basic-parser results.

---

## 6. Interactions & Behaviour

| Interaction | Behaviour | Status |
|-------------|-----------|--------|
| Click **Set Up Profile** / **Edit Profile** (Profile page) | Navigates to this page (same destination) | Shipped |
| Open with **no profile** | Shows the mode gate (§3.2) over an empty form | Proposed |
| Open with **existing profile** | Goes straight to the populated form; Import Bar collapsed at top | Proposed |
| Choose **Manual entry** / dismiss gate | Opens the blank form | Proposed |
| Choose **Smart entry** | Opens the smart input step (upload / paste) | Proposed |
| **Process résumé** | Runs the processing spinner, then fills (first-time) or appends (existing) | Proposed |
| **AI parser unavailable** | **Ask-first** dialog: surfaces the reason, then Use basic parser / Try AI again (or Update key in Settings) / manual·cancel (§3.4.2) | Proposed |
| **Unreadable file** | Amber dead-end dialog; Try again / different file / manual (first-time) or Try again / Cancel (existing) | Proposed |
| **Fill via basic parser** | Sections marked with the neutral "⚙ Auto-filled" tag instead of the AI sparkle (§5) | Proposed |
| Expand **Import Bar** (existing) | Reveals smart input inline; chevron rotates | Proposed |
| Tap a **level segment** (Skills editor) | Sets that skill's level (1–5); tapping the active level clears it | Shipped |
| Click **"?"** (Skills editor) | Opens the proficiency-scale popover; closes on outside-click / Esc | Shipped |
| Click **Add skill** | Appends a blank, unrated skill row | Shipped |
| Open an **entry overlay** (Experience/Education/etc.) | Centered modal (desktop) / bottom-sheet (mobile) for add/edit | Shipped |
| Close overlay / page with **unsaved changes** | Shows discard-confirmation dialog | Shipped |
| Click **Save** | Validates required fields + skill-level gate; persists; returns to Profile | Shipped |
| Click **Back** / **Cancel** | Returns to Profile (discard-confirm if dirty) | Shipped |
| **AI off** — Smart card / Import Bar | Disabled with **"Enable AI in Settings →"** deep-link | Proposed |

---

## 7. Data Model (deltas)

> The canonical `Profile` model lives in
> [`profile_page.md` §7](profile_page.md#7-data-model). Only editing-specific
> deltas are noted here.

### Unrated skills (editor only)
```ts
// SkillEntry.level may be null while editing — a newly added skill is unrated.
// Save is blocked until every named skill has a level ∈ 1..5.
interface SkillEntry { name: string; level: 1|2|3|4|5|null; }
```

### Résumé-parse payload **[PROPOSED]**
```ts
// Produced by the LLM from an uploaded file or pasted text. Same shape as
// Profile, but every field is optional — the parser returns only what it finds.
type ParsedProfile = Partial<Profile>;

// Applied per §3.6:
//   first-time  → fields populate the empty form (fill all)
//   existing    → list sections appended; Summary appended as a paragraph;
//                 singular Basic Info fields filled only if empty
```

Accepted upload formats: **PDF, DOCX, TXT** (≤ 5 MB). Pasted text is accepted as
a raw string.

---

## 8. Design Tokens (additions)

> Inherits the Profile page token set
> ([`profile_page.md` §8](profile_page.md#8-design-tokens)). The proposed flow adds:

| Token / asset        | Value                    | Usage                                            |
|----------------------|--------------------------|--------------------------------------------------|
| `--indigo-dim`       | `#EEF2FF`                | AI-filled tag background; import flash colour     |
| `--indigo-soft`      | `#F4F2FF`                | Smart entry card wash; hover tints; parse-error tip box |
| `#FBEEDB` / `#B5830C` | amber tint / gold        | Unreadable-file (dead-end) error icon badge (warning, non-destructive) |
| `--indigo-dim` / `--indigo` | indigo tint / indigo | AI-unavailable (recoverable) info icon badge — cloud-off glyph |
| "⚙ Auto-filled" tag  | grey on `--bg` + hairline border | Neutral basic-parser provenance tag (no AI sparkle) |
| `assets/AI_sparkle.png` | image (navy + amber star) | The single AI signifier (gate card, import bar, Process button, AI-filled tags) |
| `epfFlash`           | keyframes (~2.6s)        | Transient indigo flash on freshly imported rows   |

Editing-page chrome reuses shipped tokens: `--navy` (sub-header), `--indigo` /
`--indigo-hover` (Save / primary), `--border` (cards/inputs), `--color-danger`
(discard-confirm affordances where destructive).

---

## 9. Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Should the import **de-duplicate** near-identical appended entries (e.g. the same role imported twice)? | Open (proposed flow) |
| 2 | Exact handling of **singular Basic Info fields** on existing-profile import — fill-if-empty (current proposal) vs. prompt the user? | Open (proposed flow) |
| 3 | Should an existing-profile append offer an **Undo** (toast action) rather than relying on manual removal? | **Resolved** (proposed flow) — post-import toast carries an Undo action |
| 4 | **Ask-first dialog** vs **silent auto-fallback** when the AI parser is unavailable? | **Resolved** — **ask-first**. The extra step gives explicit failure feedback (incl. reason code) and a deliberate choice; silent auto-fallback was set aside. |
| 5 | Should processing show **staged progress** instead of a simple spinner if parse latency is high? | Deferred (simple spinner chosen for v1) |
| 6 | Are **PDF / DOCX / TXT** the final accepted formats, or also LinkedIn / profile-URL import? | Open (file + paste only for v1) |
| 7 | Should unsaved edits prompt a confirmation before navigating back? | **Resolved** — yes; discard-confirmation overlay (§2, §4.3) |
| 8 | How are Experience / Education entries added and removed? | **Resolved** — entry-overlay modal (desktop) / bottom-sheet (mobile) (§4.3) |
| 9 | Reconcile the **prototype's review/overwrite screen** with the chosen **append** model (§3.6). | **Resolved** — prototype (`Edit Profile Flow.html`) updated to the append model: list sections append, touched sections marked, with an Undo toast; the review/overwrite screen was removed. |

---

## 10. Acceptance Criteria (proposed flow)

Build is complete when all of the following hold. Each maps to a state reachable
via the §0 params.

**Entry & routing**
- [ ] Opening with **no profile** shows the split-card gate (§3.2) centered over an empty form. Dismissing it (X / Esc / backdrop) opens the blank form (manual).
- [ ] Opening with an **existing profile** shows **no gate** — the populated form with a collapsed Smart-import bar at the top.
- [ ] **Manual entry** opens the blank form; **Smart entry** opens the upload/paste step.

**Smart input**
- [ ] Upload accepts **PDF/DOCX/TXT ≤ 5 MB** via drag-drop or browse; a chosen file shows a chip with a remove control. Paste accepts raw text.
- [ ] **Process résumé** is disabled until a file is chosen or > ~20 chars are pasted.

**Processing & success**
- [ ] Process shows the plain spinner, then resolves to the form.
- [ ] **First-time success:** all returned fields fill the form; **every** populated section shows the **✦ AI filled** tag; rows flash once.
- [ ] **Existing success:** parsed list items are **appended to the end** of each section; existing entries are untouched and in order; Summary appends as a new paragraph; singular Basic Info fields fill only if empty; **only** touched sections are tagged; a toast offers **Undo** that fully restores the pre-import state.

**AI-down (recoverable) — ask-first (canonical)**
- [ ] On AI-down an info dialog (indigo cloud-off) titled *"Smart parsing is unavailable right now"* appears with **Use basic parser**, a retry/settings action, and manual/cancel. (No silent fallback.)
- [ ] **Use basic parser** fills/appends and tags sections with the **neutral ⚙ Auto-filled** tag — **never** the AI sparkle.
- [ ] The reason line shows the correct **code chip + cause** (§11); **wait**-type reasons offer **Try AI again**, **settings**-type reasons offer **Update key in Settings** instead.

**Unreadable file (dead-end)**
- [ ] Amber alert dialog titled *"We couldn't read that résumé"* with `NO_TEXT` reason; actions **Try again / Use a different file / Enter manually** (first-time) or **Try again / Cancel** (existing). No "Use basic parser".

**Safety invariants**
- [ ] No partial writes: nothing is filled/appended until a parse fully succeeds. On an existing profile, **Cancel** leaves the form byte-for-byte unchanged.
- [ ] Provenance always follows the parser (AI → sparkle tag; basic → neutral tag).

**AI off**
- [ ] **`?ai=off`**: Smart entry card disabled with **"Enable AI in Settings →"**; Manual unaffected. Import bar non-expandable with the same link.

---

## 11. Reason Codes (enum, proposed flow)

The error overlay surfaces a specific reason. The backend's parser-call errors map
to these keys; UI copy and recovery action are driven by the table. (Prototype
source of truth: `EPF_LLM_REASONS` / `EPF_PARSE_REASON` in `epf-data.jsx`.)

| Key | Code chip | Message | `fix` → recovery action |
|-----|-----------|---------|--------------------------|
| `rate_limit`  | `HTTP 429` | "Rate limit reached — too many requests in a short time." | `wait` → **Try AI again** |
| `timeout`     | `TIMEOUT`  | "The AI model took too long to respond." | `wait` → **Try AI again** |
| `server`      | `HTTP 503` | "The AI provider is temporarily unavailable." | `wait` → **Try AI again** |
| `network`     | `NETWORK`  | "Couldn't reach the AI service — check your connection." | `wait` → **Try AI again** |
| `invalid_key` | `HTTP 401` | "Invalid API key — your AI provider key was rejected." | `settings` → **Update key in Settings** |
| `quota`       | `HTTP 402` | "Out of credits — your AI provider account has no remaining balance." | `settings` → **Update key in Settings** |
| `NO_TEXT` (parse) | `NO_TEXT` | "No machine-readable text found — the file looks scanned or image-only." | dead-end → **Use a different file** / paste |

- **Code chip** styling: solid red (`#D92D20`) rounded-rect, white `DM Mono`,
  regular weight; sits left of the cause text on a soft-red inset (`#FEF3F2` /
  border `#FECDCA`, text `#B42318`).
- Copy is **provider-agnostic** ("your AI provider key") so the same strings hold
  whether the backend uses OpenRouter, Anthropic, or OpenAI. Map each provider's
  HTTP/SDK error to the nearest key above; default unknown failures to
  `rate_limit`-style **wait** handling (retryable) rather than a dead-end.
