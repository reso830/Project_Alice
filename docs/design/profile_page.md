# Profile Page — Design Specification
**Project Alice** · Last updated: May 30, 2026

---

## Table of Contents
1. [Overview](#1-overview)
2. [Page States](#2-page-states)
3. [Layout & Breakpoints](#3-layout--breakpoints)
4. [Components](#4-components)
   - 4.1 [Topbar / Navigation](#41-topbar--navigation)
   - 4.2 [Welcome Heading](#42-welcome-heading)
   - 4.3 [Applications Section](#43-applications-section)
   - 4.4 [Profile Section](#44-profile-section)
   - 4.5 [Account Section](#45-account-section)
5. [Edit / Setup Profile Page](#5-edit--setup-profile-page)
6. [Interactions & Behaviour](#6-interactions--behaviour)
7. [Data Model](#7-data-model)
8. [Design Tokens](#8-design-tokens)
9. [Open Questions](#9-open-questions)

---

## 1. Overview

The **Profile** page is one of three top-level pages in Project Alice (alongside Tracker and Calendar). It serves two purposes:

- **At-a-glance summary** — shows the user their application pipeline status and key personal/professional information in one place.
- **Profile management** — allows the user to set up and edit their professional profile, which may be used to power compatibility scoring and auto-fill in the Tracker.

---

## 2. Page States

The page has two primary states driven by whether a profile has been set up.

### 2A — No Profile
- Welcome heading renders without a first name: `"Welcome back."`
- Applications section renders normally (data is independent of profile).
- Profile section renders an **empty state** with a call-to-action to set up a profile.

### 2B — Profile Exists
- Welcome heading renders with first name: `"Welcome back, {firstName}."`
- Profile section renders all filled sub-sections.
- An **Edit Profile** button appears right-aligned in the Profile section header.

> Both states also render the **Account** section (§4.5) last, regardless of whether a profile exists — it is a runtime-mode-aware surface, not tied to profile setup.

---

## 3. Layout & Breakpoints

| Breakpoint | Label    | Min width | Notes                                      |
|------------|----------|-----------|--------------------------------------------|
| Mobile     | `sm`     | —         | < 640px                                    |
| Desktop    | `lg`     | 640px+    | Single-column, max-width 1120px, centred   |

### Page structure (top → bottom)
```
[Topbar]
[Page body — max-width 1120px, centred, 36px vertical padding]
  ├── Welcome Heading
  ├── Applications Section Card
  ├── Profile Section Card
  └── Account Section Card
[Footer]
```

### Grid & spacing
- Page body horizontal padding: `28px` (desktop) / `14px` (mobile)
- Gap between sections: `24px` (desktop) / `18px` (mobile)
- Section card internal padding: `22px` (desktop) / `16px` (mobile)

---

## 4. Components

### 4.1 Topbar / Navigation

Shared across all pages. Sticky, **`52px`** tall, dark navy background (`#1a1a2e`).

| Element         | Detail                                                       |
|-----------------|--------------------------------------------------------------|
| Logo + wordmark | Left-aligned; `Alice_White.png` image (`38×38px`) + "Project Alice" label (15px / 600) |
| Nav buttons     | Right-aligned; three items: Tracker, Calendar, **Profile**   |
| Active state    | Filled indigo background (`#4F46E5`), white text             |
| Inactive state  | Transparent background, white text                           |

---

### 4.2 Welcome Heading

```
Welcome back, Alex.          ← State 2B (profile exists)
Welcome back.                ← State 2A (no profile)
```

- Font: `Sora`, 28px (desktop) / 22px (mobile), weight 700
- Sub-line: `"Here's where things stand today."` — 13px, muted grey (`#999`)

---

### 4.3 Applications Section

A card with a header row and a chart body. Data is sourced from the Tracker.

#### Header row
| Element            | Detail                                              |
|--------------------|-----------------------------------------------------|
| Section label      | `APPLICATIONS` — 11px, uppercase, weight 700        |
| Go to Tracker btn  | Primary button, right-aligned; navigates to Tracker |

#### Desktop layout (≥ 640px)

Two-column layout inside the card (`.apps-desktop-vis`):

```
┌──────────────────┬────────────────────────────────────┐
│  [Total] [Active]│                                     │
│  [Pending][Offer]│   [Donut chart]    [Legend grid]    │
│  (right border)  │                                     │
└──────────────────┴────────────────────────────────────┘
```

- **Left column (`.apps-desktop-vis__stats`):** 2×2 grid of stat chips (`grid-template-columns: repeat(2, minmax(0, 1fr))`), separated from chart column by `border-right: 1px solid #F0ECE5`
  - Total (dark navy value), Active (amber `#D97706`), Pending (blue `#3B82F6`), Offer (green `#16A34A`)
  - Each chip: `background: #F7F6F3`, value `22px / 700`, label `11px uppercase`
- **Right column (`.apps-desktop-vis__chart`):** donut chart (160×160px) + 2-column legend grid, laid out as `grid-template-columns: auto minmax(160px, 1fr)`
- **Hover behaviour:**
  - Hovering a pie slice highlights that slice and dims all others (opacity 0.4)
  - Hovering a legend item cross-highlights the corresponding slice
  - A floating tooltip appears near the cursor: `"{Label} · {count} ({pct}%)"`
  - Tooltip: `position: fixed`, navy bg, `font-size: 11px`, `border-radius: --r-sm`

#### Mobile layout (< 640px)

```
[2×2 stat chip grid]
[Horizontal stacked bar — 28px tall, full width, border-radius --r-sm]
[Tap label — min-height 18px, auto-dismisses after 2s]
[2-column legend grid]
```

- Desktop vis (`.apps-desktop-vis`) is hidden; mobile vis (`.apps-mobile-vis`) is shown
- Tapping a bar segment or legend item shows an inline label with label, count, percentage
- Label auto-dismisses after 2 seconds

#### Archived applications link (feature 028)

Rendered at the bottom of the applications body (below the desktop/mobile vis), in both layouts:

```
Archived applications · {N} →
```

- Element: `<a class="profile-archived-link">`, `href="/?view=archived"`
- Text: `Archived applications · {count} →` — count is the number of archived rows for the current user
- Style: inline-flex, `margin-top: 14px`, indigo (`var(--indigo)`), 13px / 600, no underline; hover/focus → `--indigo-hover` + underline
- **Always rendered**, even when the count is `0` (keeps the surface discoverable; layout stays stable)
- Accessible name: `aria-label="View archived applications, {N} item(s)"`
- Click is intercepted for SPA navigation: `pushState('/?view=archived')` then `navigate('tracker', { view: 'archived' })`. The absolute `/?view=archived` href keeps middle-click / copy-paste / refresh routable on hosted builds
- **Count source**: a separate `getAll({ view: 'archived' })` fetch, run in parallel with the active-applications fetch. On fetch failure it degrades to `0` rather than blocking the Profile render (the Archived view itself is the canonical place to report list-fetch errors)
- The four stat chips (Total / Active / Pending / Offer) and the donut/bar **exclude** archived rows — only this link reports archived counts

#### Status colour mapping

Derived from `STATUS_CONFIG.borderAccent` in `src/models/application.js` (same single color used across badge, card border, and modal header):

| Status key   | Label                | Colour (borderAccent) |
|--------------|----------------------|-----------------------|
| `wishlisted` | Wishlisted           | `#ffafcc`             |
| `applied`    | Applied              | `#003049`             |
| `phone_screen`| Phone Screen        | `#f4a259`             |
| `interview`  | Interview            | `#f9c74f`             |
| `assessment` | Technical Assessment | `#e0aaff`             |
| `offer`      | Offer                | `#09bc8a`             |
| `rejected`   | Rejected             | `#9d0208`             |
| `withdrawn`  | Withdrawn            | `#343a40`             |
| `ghosted`    | Ghosted              | `#ced4da`             |

---

### 4.4 Profile Section

A card with:
1. A **header row** (section label + Edit Profile / empty)
2. A **Basic Info block**
3. A list of **sub-sections**

#### Header row
| State           | Right-aligned element                             |
|-----------------|---------------------------------------------------|
| No profile      | _(nothing)_                                       |
| Profile exists  | `Edit Profile` — outline button → opens Edit page |

#### Basic Info block
Sits between the header and the sub-sections. Always visible when a profile exists.

```
[Avatar initials]  {First} {Last}
                   📍 {City}
                   📞 {Phone}
                   ✉ {Email}
```

- Avatar: 52×52px circle, solid indigo background (`#4F46E5`), white initials in `DM Mono` 16px / 700
- Name: Sora 16px / 700
- Meta items: each on its own line, `DM Mono` 11px, color `#999999`; emoji icon + value inline

#### Sub-sections

Each sub-section has a label row and content area. On **mobile**, labels are tappable to collapse/expand (chevron indicator). On **desktop**, always expanded — no collapse.

Sections are separated by a subtle `1px solid #f5f3f0` top border (not a full-width rule). No additional divider chrome.

| # | Sub-section              | Content type                                                                        |
|---|--------------------------|-------------------------------------------------------------------------------------|
| 1 | Summary                  | Plain paragraph text (`white-space: pre-wrap`)                                      |
| 2 | Professional Experience  | Structured entries: role (title), `company \| dateStarted – dateEnded/Present` (meta), responsibilities (body text) |
| 3 | Education                | Structured entries: degreeMajor (title), `university \| yearCompleted` (meta)       |
| 4 | Skills                   | **Proficiency rows** — each skill on its own row with a 5-segment graded meter showing its level (1–5). See [Skills (proficiency)](#skills-proficiency) below. |
| 5 | Certifications           | Structured entries: name (title), issuingBody (meta), issuanceDate–expiryDate (meta), certificateId (secondary meta, `10px`) |
| 6 | Awards                   | Structured entries: awardName (title), `issuingBody \| date` (meta), details (body text) |
| 7 | Languages                | Pill tags showing `"Language \| Proficiency"` (Proficiency levels: Beginner, Intermediate, Professional, Fluent) |
| 8 | Links                    | Chip-style anchor tags — single line showing `friendlyName` or hostname of URL; no platform label |

##### Skills (proficiency)

Skills are no longer flat tags. Each skill is rated on a **5-level proficiency scale** and rendered as its own row: the skill name on the left, a **5-segment graded meter** on the right.

**Proficiency scale**

| Level | Label        | Segment colour    | Flavor text                              |
|-------|--------------|-------------------|------------------------------------------|
| 1     | Beginner     | `#E07B39` orange  | Aware of the basics; needs guidance.     |
| 2     | Basic        | `#B5830C` gold    | Can handle simple tasks independently.   |
| 3     | Intermediate | `#1E9D57` green   | Productive day-to-day without help.      |
| 4     | Strong       | `#3076E8` blue    | Deep, reliable command of the skill.     |
| 5     | Expert       | `#4F46E5` indigo  | Sets direction; mentors others.          |

- The meter fills `level` of 5 segments in that level's colour; remaining segments are empty (`--sk-empty #E7E3DA`). Each segment: `17×9px` (`15px` wide on mobile), `border-radius 3px`, `4px` gap.
- **Reveal on hover / tap:** hovering (desktop) or tapping (mobile) a skill row **cross-fades the meter out and the level word in, in place** — `"{level} · {Label}"` in the level's colour (`DM Mono` 11px). The word occupies the same right-aligned slot as the bars, so the row never reflows. On tap it auto-reverts after **2.5s**.
- The row is a real `<button>` (focusable, keyboard-operable; `aria-label="{name}: {Label}, level {n} of 5"`).
- **Long names** truncate with an ellipsis (full text kept in `title` / `aria-label`); they never collide with the meter or the revealed word.
- **"?" scale popover:** a small `?` button beside the SKILLS label opens a popover listing all five levels (segment swatch + bold `Sora` label, normal case + `DM Mono` flavor text). Closes on outside-click / Esc.
- **Sort control** (right of the header): `Custom` (the order the user entered them) and `By level` (repeat clicks toggle highest-first ▾ / lowest-first ▴).
- **Collapse past 10:** when a profile has more than **10** skills, only the first 10 render, followed by a `Show all {N} skills ▾` toggle (collapses back via `Show less`) — keeps long lists from becoming a long scroll.

##### Links chips
```
[linkedin.com/in/...]   [github.com/...]
[alexrivera.dev]
```
- Chip: `background #F7F6F3`, `border 1.5px solid #E0DDD8`, `border-radius 6px`, `max-width: 220px`
- Hover: `border-color: #4F46E5`, `background: #F0EEFF`
- Single line of text: `friendlyName` if set, otherwise the URL's `hostname`. Font: `DM Mono` 11px, color `#555555`
- No platform label is shown in the current implementation. The `link-chip__platform` CSS class exists but the JS does not render a platform element.
- Link schema: `{ url: string, friendlyName: string }` — `friendlyName` is optional display text

#### Empty state (no profile)
```
      [Person icon — 52px circle, muted]
      No profile set up yet.
      Add your background to strengthen your applications.
      [Set Up Profile — primary button]
```
Clicking **Set Up Profile** navigates to the Edit / Setup Profile page.

---

### 4.5 Account Section (feature 030)

The final card on the page. A mode-aware section hosting a single **destructive control** that closes the account lifecycle. Rendered in **every** runtime mode (hosted, local, demo) and independent of whether a profile exists.

#### Layout
```
ACCOUNT
{mode-specific description copy}
[ Destructive button ]
```
- Container: `.account-section` — column flex, `gap: 12px`
- Description: `.account-section__desc` — 13px, `line-height 1.5`, `var(--color-text)`
- Button: `.profile-btn--danger.account-section__btn` — left-aligned (`align-self: flex-start`); red (`#c1121f`, hover `#a00e19`); disabled → `opacity .55`, `not-allowed`

#### Mode matrix

| Mode    | Button label     | Enabled? | Description copy |
|---------|------------------|----------|------------------|
| Hosted  | `Delete account` | Yes      | "Permanently delete your account and all associated data." |
| Local   | `Clear all data` | Yes      | "Permanently clear all locally stored applications and profile data." |
| Demo    | `Delete account` | **No** (disabled, `aria-disabled`) | "Account deletion applies to a real hosted account and isn't available in the demo." |

Mode is resolved from `authStore` state: `authenticated` → hosted, demo status → demo, otherwise local. The demo button is inert — clicking it opens no modal and fires no network request.

#### Confirmation modal (`DeleteAccountModal`)

Clicking an enabled control opens a centered `alertdialog` (`role="alertdialog"`, `aria-modal`, labelled by title + body). The modal **collects the gate value and reports loading/error only** — it performs no deletion itself; the caller's `onConfirm(value)` runs the network call.

| Element        | Detail |
|----------------|--------|
| Backdrop       | `rgba(0,0,0,.45)`, `z-index: calc(--z-modal + 10)`; locks background scroll |
| Dialog         | `max-width: 420px`, `padding: 24px`, `border-radius --r-md`, `box-shadow 0 8px 32px rgba(0,0,0,.18)` |
| Title          | `⚠ {title}` — warning glyph is a non-color destructive signal; `var(--color-danger)`, 17px / 700 |
| Body           | Permanence warning copy (cannot be undone) |
| Input          | Hosted: password field (`autocomplete="current-password"`), label "Enter your password to confirm". Local: text field, label "Type DELETE to confirm" |
| Inline error   | `role="alert"`, hidden until a failed attempt; `var(--color-danger)` |
| Actions        | **Cancel** (outline) + **danger confirm** button, right-aligned |

**Gate / behaviour**
- The confirm button is **disabled** until the gate is satisfied: hosted → non-empty password; local → input is exactly `DELETE`
- On confirm: button shows a busy label ("Deleting…" / "Clearing…"), input + Cancel disable, `aria-busy` set
- **Focus trap** (Tab/Shift+Tab cycle within the dialog); focus returns to the previously-focused element on close
- Cancel / Esc / backdrop click all close the modal and delete nothing (disabled while a request is in flight)
- Enter in the input submits

**onConfirm contract**
- Resolves → modal closes (success)
- Rejects with `code === 'INVALID_PASSWORD'` → modal **stays open**, shows the inline error, re-enables the input (hosted: wrong password)
- Any other rejection → modal closes (the caller surfaces its own error toast)

#### Post-action behaviour by mode

| Mode    | On success |
|---------|-----------|
| Hosted  | Server deletes the auth user (service-role admin call); `ON DELETE CASCADE` removes the user's `applications`, `profile`, and `user_seed_state` rows. Client stages an `Account deleted.` notice, signs out, and routes to the Welcome page (where the notice toast is shown). |
| Local   | Server clears local `applications` + `profile`; a `All data cleared.` toast fires and the Profile **re-mounts in place** so the Tracker/Profile empty states render without a full reload. No sign-out. |
| Demo    | N/A — control is disabled. |

> **Cross-session note (hosted):** `deleteUser` revokes refresh tokens, but an already-issued access token on another device stays valid until expiry. Other sessions reroute to Welcome either eventually (token expiry + `onAuthStateChange`) or on their next failed authenticated request via a one-shot `getUser()` revalidation. See `specs/030-delete-profile-data/spec.md` (FR-011a/b) for the full session-invalidation contract.

---

## 5. Edit / Setup Profile Page

A dedicated full-page form. Entered from either:
- **Set Up Profile** button (empty state)
- **Edit Profile** button (profile exists, header row)

Both entry points navigate to the same `profile-edit` page.

### Sticky Sub-header
- Same dark navy bar (`background: var(--navy)`), sticky below the main topbar (`top: 48px`, but adjusted to `52px` in practice since topbar is `52px`)
- Left: **← Back** ghost button
- Centre: `Edit Profile` title text (13px / 700)
- Right: **Cancel** (outline) + **Save** (primary) page-level controls
- Save button is disabled until the form is dirty (has unsaved changes)
- Clicking back with unsaved changes shows an in-overlay discard-confirmation dialog

### Body layout
- Max-width **900px**, centred, padding `28px` (desktop) / `14px` (mobile)
- Stacked section cards, gap `24px`

### Sections (fully implemented)

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

##### Skills editor

The Skills section uses inline rows rather than an entry-overlay modal:

```
[ Skill name            ]  [1][2][3][4][5]   ×
                            3 · Intermediate
[ + Add skill ]
```

- Each row: a **name** text input, a **level picker** (five tappable segments numbered 1–5), and a **remove** (×) control.
- **Level picker:** tapping segment `n` sets the level to `n` and fills segments 1…n in that level's colour; tapping the active level again clears it. Hovering previews the fill in a lighter tint. A caption below reads `"{n} · {Label}"`, or `"Tap to set a level"` when unset.
- **Add skill** appends a new blank, **unrated** row.
- **Validation gate:** a new skill must be given a level. Rows missing a level are highlighted (warning tint) and the footer shows `"Set a level for every skill to save · {n} missing"`. The **Save** button is disabled until every named skill has a level and no name is blank.
- On narrow screens (< 560px) the level picker drops to its own line beneath the name field so the input keeps room.
- The same **"?" scale popover** is available in the editor header.

### Entry overlay (add/edit modal)

- Desktop: centered modal `min(560px, 90vw)`, `max-height: 85vh`, `border-radius: 12px`, `box-shadow: 0 8px 32px rgba(0,0,0,.18)`
- Mobile: bottom-sheet `border-radius: 16px 16px 0 0`, slides up 250ms ease-out
- Backdrop: `rgba(0,0,0,.45)`, `z-index: 200`
- Header: title + optional discard-confirmation overlay (appears when closing with unsaved changes)
- Footer: Cancel + Save buttons (right-aligned, `gap: 10px`)

---

## 6. Interactions & Behaviour

| Interaction                   | Behaviour                                                         |
|-------------------------------|-------------------------------------------------------------------|
| Hover pie slice (desktop)     | Highlights slice, dims others; shows floating tooltip             |
| Hover legend item (desktop)   | Cross-highlights corresponding pie slice                          |
| Tap bar segment (mobile)      | Shows inline label; auto-dismisses after 2s                       |
| Tap legend item (mobile)      | Same as tapping corresponding bar segment                         |
| Tap sub-section header (mob.) | Toggles collapse/expand with chevron animation                    |
| Hover / tap skill row         | Cross-fades the proficiency meter to the `{level} · {Label}` word in place; tap auto-reverts after 2.5s |
| Click "?" (skills)            | Opens the proficiency-scale popover; closes on outside-click / Esc |
| Click "Custom" / "By level"   | Sorts skills by entered order, or by level (repeat clicks toggle highest- / lowest-first) |
| Click "Show all / Show less"  | Expands / collapses the skills list past the 10-item limit         |
| Tap a level segment (editor)  | Sets that skill's proficiency level (1–5); tapping the active level clears it |
| Click "Go to Tracker"         | Navigates to Tracker page                                         |
| Click "Archived applications" | Navigates to Tracker in the Archived view (`/?view=archived`)     |
| Click "Edit Profile"          | Navigates to Edit Profile page                                    |
| Click "Set Up Profile"        | Navigates to Edit Profile page (same destination)                 |
| Click "← Back to Profile"     | Returns to Profile page; unsaved changes are discarded (TBD)      |
| Click link chip               | Opens URL in new tab                                              |
| Click "Delete account" (hosted)| Opens DeleteAccountModal; password gate → permanent account deletion → sign out → Welcome |
| Click "Clear all data" (local)| Opens DeleteAccountModal; typed-`DELETE` gate → clears local data → re-mounts empty states |
| Click "Delete account" (demo) | No-op — control is disabled                                       |

---

## 7. Data Model

### Profile object
```ts
interface Profile {
  firstName:      string;
  lastName:       string;
  city:           string;
  phone:          string;
  email:          string;
  summary:        string;
  experience:     ExperienceEntry[];
  education:      EducationEntry[];
  skills:         SkillEntry[];        // each skill carries a 1–5 proficiency level
  certifications: CertificationEntry[];
  awards:         AwardEntry[];
  languages:      LanguageEntry[];
  links:          LinkEntry[];
}

interface ExperienceEntry {
  role:             string;   // required
  company:          string;   // required
  responsibilities: string;   // required
  dateStarted:      string;   // MM/YYYY format, required
  dateEnded:        string;   // MM/YYYY format, required if !currentWork
  currentWork:      boolean;  // "currently working here"
}

interface EducationEntry {
  degreeMajor:   string;  // required (e.g. "B.Sc. Computer Science")
  university:    string;  // required
  yearCompleted: string;  // YYYY format, required
}

interface SkillEntry {
  name:  string;                    // skill name, required
  level: 1 | 2 | 3 | 4 | 5 | null;  // proficiency; null = unrated (editor only — must be set before save)
}
// Proficiency scale: 1 Beginner · 2 Basic · 3 Intermediate · 4 Strong · 5 Expert
// (distinct from LanguageEntry.proficiency, which is its own enum)

interface CertificationEntry {
  name:          string;  // required
  issuingBody:   string;  // required
  issuanceDate:  string;  // MM/YYYY format, required
  expiryDate:    string;  // MM/YYYY format, optional
  certificateId: string;  // optional
}

interface AwardEntry {
  awardName:   string;  // required
  issuingBody: string;  // required
  date:        string;  // MM/YYYY format, optional
  details:     string;  // optional
}

interface LanguageEntry {
  language:    string;  // required
  proficiency: 'Beginner' | 'Intermediate' | 'Professional' | 'Fluent';  // required
}

interface LinkEntry {
  url:          string;  // required, must be http/https
  friendlyName: string;  // optional display label (falls back to hostname)
}
```

> **Migration (skill proficiency):** legacy profiles stored `skills` as `string[]`. On load, each string is normalised to `{ name, level: 2 }` (**2 · Basic**) so existing data renders immediately; users can re-rate on the next edit. Newly added skills start `level: null` (unrated) and cannot be saved until rated.

### Application counts (sourced from Tracker)
```ts
interface AppCounts {
  [status: string]: number;   // keyed by status slug
}
```

Derived stats:
- **Total** = sum of all counts
- **Active** = `phone_screen + interview + assessment`
- **Pending** = `applied`
- **Offer** = `offer`

All four stats and the chart are computed from the **active** application list only (`getAll()` excludes `archived` rows server-side). The archived count comes from a separate `getAll({ view: 'archived' })` fetch and surfaces solely on the Archived applications link (§4.3). Each application carries `archived: boolean` and `archivedDate: ISO date | null` (set server-side when archived, cleared on unarchive — feature 028); the Profile page reads only the archived **count**, not individual fields.

### Account section state (feature 030)
The Account section has no persisted model of its own. Its behaviour is derived at render time from the runtime `mode` (hosted / local / demo, resolved from `authStore`), which selects the control label, description copy, enabled state, confirmation gate (password vs typed `DELETE`), and post-success path. The destructive backend operations act on existing entities — the Supabase `auth.users` row (cascade-deletes the user's data) in hosted mode, or the local `applications` + `profile` tables in local mode.

---

## 8. Design Tokens

### Colours
| Token             | Value     | Usage                              |
|-------------------|-----------|------------------------------------|
| `--bg`            | `#F4F1ED` | Page background (warm off-white)   |
| `--surface`       | `#ffffff` | Cards, inputs                      |
| `--border`        | `#E8E3DA` | Card borders                       |
| `--color-border`  | `#E0DDD8` | Input borders, sub-section dividers|
| `--navy`          | `#1A1A2E` | Topbar, headings, key numbers      |
| `--indigo`        | `#4F46E5` | Primary buttons, active nav, avatar, Archived link|
| `--indigo-hover`  | `#4338CA` | Primary button hover, Archived link hover |
| `--sk-empty`      | `#E7E3DA` | Empty proficiency-meter segments   |
| `--color-danger`  | `#c1121f` | Account destructive button + delete modal (hover `#a00e19`) |
| `--t2`            | `#4B5563` | Body text, muted content           |
| `--t3`            | `#9CA3AF` | Muted / secondary text             |
| `#999999`         | —         | Profile sub-line, basic info meta  |
| `#AAAAAA`         | —         | Section label text                 |

### Typography
| Role              | Font    | Size | Weight |
|-------------------|---------|------|--------|
| Page heading      | Sora    | 28px | 700    |
| Section label     | Sora    | 11px | 700    |
| Sub-section label | Sora    | 11px | 700    |
| Body text         | Sora    | 13px | 400    |
| Small text        | Sora    | 11px | 400    |
| Monospace / data  | DM Mono | 11px | 400    |

### Border radius
| Context         | Value |
|-----------------|-------|
| Section cards   | 10px  |
| Buttons         | 6px   |
| Pill tags       | 4px   |
| Link chips      | 6px   |
| Avatar circle   | 50%   |
| Stat chips      | 7px   |

---

## 9. Open Questions

| # | Question                                                                 | Status   |
|---|--------------------------------------------------------------------------|----------|
| 1 | Should "Go to Tracker" filter the tracker to a specific status?          | Open     |
| 2 | How are Experience / Education entries added and removed (row management)?| **Resolved** — inline entry overlay modal (desktop) / bottom-sheet (mobile) |
| 3 | Should unsaved edits prompt a confirmation before navigating back?       | **Resolved** — yes; discard-confirmation overlay appears inside the entry overlay |
| 4 | Is the Profile used to power Tracker compatibility scores?               | Open     |
| 5 | What additional link platforms should be supported (e.g. Indeed, Xing)? | **Resolved** — links are free-form URL + optional friendlyName; no platform list |
| 6 | Should the avatar support a photo upload, or remain initials-only?       | Open (currently initials-only) |
| 7 | Should the Calendar page have access to Profile data?                    | Open     |
| 8 | How are archived applications surfaced on the Profile page?              | **Resolved** (028) — always-visible "Archived applications · N →" link in the Applications section; stats/chart exclude archived rows |
| 9 | How does a user delete their account / clear their data?                 | **Resolved** (030) — mode-aware Account section (§4.5) with a gated confirmation modal; hosted deletes the account, local clears data, demo is disabled |
| 10 | How are skills captured beyond flat tags?                               | **Resolved** — 1–5 proficiency scale; graded meter rows with hover/tap reveal, "?" scale popover, sort, and collapse-past-10 (§4.4 Skills), plus a gated inline editor (§5 Skills editor) |
