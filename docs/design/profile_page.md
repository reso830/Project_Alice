# Profile Page — Design Specification
**Project Alice** · Last updated: June 4, 2026

> **Doc split (June 4, 2026):** the Edit / Setup Profile page now has its own
> specification — see **[`edit_profile_page.md`](edit_profile_page.md)**. This
> document covers the read-only **Profile** page only. §5 below is a pointer.

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
   - 4.5 [Settings Section](#45-settings-section)
     - 4.5.1 [AI sub-group](#451-ai-sub-group)
     - 4.5.2 [Updates sub-group](#452-updates-sub-group)
     - 4.5.3 [Account sub-group](#453-account-sub-group)
5. [Edit / Setup Profile Page → separate doc](#5-edit--setup-profile-page)
6. [Interactions & Behaviour](#6-interactions--behaviour)
7. [Data Model](#7-data-model)
8. [Design Tokens](#8-design-tokens)
9. [Open Questions](#9-open-questions)

---

## 1. Overview

The **Profile** page is one of three top-level pages in Project Alice (alongside Tracker and Calendar). It serves two purposes:

- **At-a-glance summary** — shows the user their application pipeline status and key personal/professional information in one place.
- **Profile management** — allows the user to set up and edit their professional profile, which may be used to power compatibility scoring and auto-fill in the Tracker.

> Profile **editing and setup** are documented separately in **[`edit_profile_page.md`](edit_profile_page.md)**. This page links into that flow via the **Edit Profile** / **Set Up Profile** buttons (§4.4).

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

> Both states also render the **Settings** section (§4.5) last, regardless of whether a profile exists — it hosts AI configuration, app-update controls, and a runtime-mode-aware account control, none of which is tied to profile setup.

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
  └── Settings Section Card   (AI sub-group + Updates sub-group + Account sub-group)
[Footer]   ← global chrome, see footer.md
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
| Profile exists  | `Edit Profile` — outline button → opens [Edit page](edit_profile_page.md) |

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

> The same proficiency scale powers the **Skills editor** in [`edit_profile_page.md`](edit_profile_page.md#skills-editor). This section describes the **read-only display** only.

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
Clicking **Set Up Profile** navigates to the [Edit / Setup Profile page](edit_profile_page.md).

---

### 4.5 Settings Section

The final card on the page. A single **`Settings`** card that folds three labelled sub-groups into one surface — **Artificial Intelligence** (AI configuration), **Updates** (app update controls), and **Account** (the destructive lifecycle control). It replaces the two separate cards that earlier builds shipped (a standalone "AI Resume Parsing" card + an "Account" card). Rendered regardless of whether a profile exists.

#### Card structure
```
SETTINGS                                    ← card header (13px / 600)
├── ARTIFICIAL INTELLIGENCE                  ← sub-group label
│   ┌─ AI features ───────────────[ ⃝]┐     ← master toggle (gates everything below)
│   │  Connection ──────────[● Connected]│   ← inset panel + status pill
│   │   OpenRouter API key  •••• + 👁 + Test/Replace/Delete
│   │   Model               provider/model-slug  (free text)
│   │   helper: stored only in this browser…    │
│   │  ── Enabled features ──                    │
│   │   Resume parsing            [ ⃝]           │
│   │   Job-description parsing   [ ⃝]           │
│   │   Compatibility analysis    [⃝ ]           │
│   └────────────────────────────────────────────┘
├── UPDATES                                  ← sub-group label
│   {status block: current version / available / progress}
│   ── rule ──
│   Check for updates automatically  [ ⃝]
│   Update mode            Ask before installing  ⌄   (collapsible)
└── ACCOUNT                                  ← sub-group label
    {mode-specific description copy}
    [ Destructive button ]
```

- Card: reuses `.section-card` chrome (white surface, `--border`, `--r-md`, `--shadow-sm`) with a single `.section-header` reading **Settings**.
- Sub-groups: `.set-group`, `20px 22px` padding (`16px` on mobile), separated by a `1px solid #F2EFE9` top border. Each opens with an uppercase 9px label (`--t3`).

---

#### 4.5.1 AI sub-group (feature 033)

Label: **`ARTIFICIAL INTELLIGENCE`**. Configures the user's own **OpenRouter** key and which AI-powered features are active. The user supplies and owns the key; it is stored **only in this browser** and never sent to our servers.

##### Master toggle
```
AI features                                            [ ⃝]
Power resume & job-description parsing and compatibility
scoring with your own OpenRouter key.
```
- A single master switch (`.master-row` + `.sw`) at the top of the sub-group.
- When **off**, the entire AI body (`.ai-body`) below is gated: `opacity .42`, `pointer-events: none`, `filter: saturate(.6)` — the connection panel and all feature toggles read as disabled but stay visible.
- When **on**, the body is fully interactive.

##### Connection panel
An inset panel (`.conn-panel`, light `#FBFAF6` surface, `--r-md`) grouping the key + model + live status.

| Element | Detail |
|---------|--------|
| Panel header | `Connection` title (12px / 600) + **status pill**, right-aligned |
| Status pill | One clear state (replaces the old two-line "Key saved / Consent granted"): `● Connected` (green, `--ok` on `--ok-dim`), `Not connected` (grey), `Testing…` (amber, pulsing dot), `Key invalid` (red) |
| API key — unsaved | Masked text input (`type=password`) + **show/hide eye** icon-button + **Save key** (primary, disabled until non-empty) |
| API key — saved | Masked code `sk-or-v1-••••••••••••{last4}` + **eye** (reveals full key) + **Test** (re-validates → `Testing…` → resolves) + **Replace** (swap for a new key) + **Delete** (muted button that turns destructive-red on hover; clears the key and resets status to `Not connected`) |
| Model | **Free-text slug field** (`provider/model-slug`, e.g. `anthropic/claude-sonnet-4`) with a `datalist` of suggested models + a hint line. Lets users type any OpenRouter model rather than picking from a fixed dropdown. |
| Helper | `Stored only in this browser — never sent to our servers. Using your own OpenRouter key is your responsibility.` (`DM Mono` 10.5px) |

Suggested model slugs (datalist, not a hard list): `anthropic/claude-sonnet-4` · `openai/gpt-4o-mini` · `google/gemini-2.0-flash` · `meta-llama/llama-3.3-70b`.

> **Consent is folded into the key flow.** Saving a key *is* the consent to use it for AI features — there is no separate "Clear Consent" button. Removing consent = **Delete** the key.

##### Enabled features
A list of per-feature toggles (`.feat-list`), each a title + one-line description + switch. All are gated by the master toggle.

| Feature key | Title | Description |
|-------------|-------|-------------|
| `cv`     | Resume parsing          | Extract structured fields from uploaded resumes. |
| `jd`     | Job-description parsing | Pull role, skills, and salary from pasted listings. |
| `compat` | Compatibility analysis  | Score how well each role matches your profile. |

- Each toggle independently enables/disables that AI feature without removing the key.
- With the master toggle off, all three render disabled (dimmed, not interactive).

##### Responsive behaviour
Verified at Tablet (768px), Mobile (390px), and slim Mobile (344px). The card itself has no horizontal overflow at 344px: the saved-key action row (`key · eye · Test · Replace · Delete`) wraps cleanly to multiple lines via `flex-wrap`, the model field + helper reflow, and every hit target stays ≥ 32px. Compact `16px` sub-group padding applies < 640px.

---

#### 4.5.2 Updates sub-group

Label: **`UPDATES`**. The middle sub-group (AI → **Updates** → Account). The durable control centre for the **app update** flow — current version, manual check, an auto-check toggle, and a collapsible update-mode picker. Its status block mirrors the transient **update notification** toast; the two are views of the same available → downloading → installing state machine.

> **Full spec:** [`updates.md`](updates.md) is canonical for the whole update feature — the footer **Download** control (hosted vs. local), the update **notifications** (3 states + responsive placement), and this Settings sub-group. Reference drawing: [`mockups/Updates Mockups.html`](../mockups/Updates%20Mockups.html).

Key rules (see the full spec for detail):
- **Status above, controls below**, split by a `1px solid #F2EFE9` rule. Contextual info (available banner, download/install progress) sits **above** the rule with the version — never beneath it.
- **No redundant status pill** — the green **● Up to date** pill shows only in the calm idle state; active states convey status through the block title itself.
- **Current version** binds to `APP_VERSION` (`v1.9.0`); **Check now** is always reachable.
- **Update mode** is **collapsed by default** to one row (label + current choice + chevron) and expands to three radio cards (Notify only / Ask before installing / Install automatically) only while choosing.

---

#### 4.5.3 Account sub-group (feature 030)

Label: **`ACCOUNT`**. A mode-aware sub-group hosting a single **destructive control** that closes the account lifecycle. Present in **every** runtime mode (hosted, local, demo) and independent of whether a profile exists.

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

> **Moved.** The Edit / Setup Profile page is documented in its own
> specification: **[`edit_profile_page.md`](edit_profile_page.md)**.
>
> It covers the page chrome (sticky sub-header, Cancel/Save), the nine editable
> sections, the Skills editor and entry-overlay modals, and the **proposed**
> entry flow (smart vs. manual mode gate, résumé import, processing, review &
> merge, and AI-filled provenance markers).
>
> **Entry points from this page:** the **Edit Profile** button (§4.4 header,
> profile exists) and the **Set Up Profile** button (§4.4 empty state) both
> navigate to the `profile-edit` page.

---

## 6. Interactions & Behaviour

> Interactions that occur **inside the Edit / Setup Profile page** (level-segment
> editing, entry-overlay add/edit, the proposed import flow, etc.) live in
> [`edit_profile_page.md` §6](edit_profile_page.md#6-interactions--behaviour).

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
| Toggle "AI features" master   | On → enables the AI sub-group; Off → gates the connection panel + all feature toggles (dimmed, inert) |
| Toggle a feature (CV/JD/Compat)| Enables/disables that single AI feature without removing the key   |
| Click eye (API key)           | Reveals / re-masks the OpenRouter key in place                     |
| Click "Save key"              | Stores the key (browser-only) and sets status → `Connected`        |
| Click "Test" (API key)        | Re-validates the saved key: status → `Testing…` then resolves       |
| Click "Replace" (API key)     | Swaps the saved key back to an editable input                      |
| Click "Delete" (API key)      | Clears the key (= revokes consent); status → `Not connected`       |
| Edit Model slug field         | Free-text entry of any `provider/model-slug`; datalist suggests common models |
| Click "Go to Tracker"         | Navigates to Tracker page                                         |
| Click "Archived applications" | Navigates to Tracker in the Archived view (`/?view=archived`)     |
| Click "Edit Profile"          | Navigates to Edit Profile page                                    |
| Click "Set Up Profile"        | Navigates to Edit Profile page (same destination)                 |
| Click link chip               | Opens URL in new tab                                              |
| Click "Delete account" (hosted)| Opens DeleteAccountModal; password gate → permanent account deletion → sign out → Welcome |
| Click "Clear all data" (local)| Opens DeleteAccountModal; typed-`DELETE` gate → clears local data → re-mounts empty states |
| Click "Delete account" (demo) | No-op — control is disabled                                       |

---

## 7. Data Model

> This is the canonical Profile model, rendered read-only by this page and
> edited by [`edit_profile_page.md`](edit_profile_page.md). The edit doc documents
> only the editing-specific deltas (unrated-skill gate, the résumé-parse payload).

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

### Settings — AI sub-group state
The AI sub-group keeps its own browser-local settings (no server persistence; consistent with the "stored only in this browser" contract). Suggested shape:
```ts
interface AiSettings {
  // ── Persisted (browser storage) ──
  enabled:    boolean;                 // master "AI features" toggle
  apiKey:     string | null;           // OpenRouter key; null = not connected. Presence = consent.
  model:      string;                  // free-text slug, e.g. "anthropic/claude-sonnet-4"
  features: {
    cv:     boolean;                   // Resume parsing
    jd:     boolean;                   // Job-description parsing
    compat: boolean;                   // Compatibility analysis
  };
}

// ── Derived at runtime, NOT persisted ──
// Computed live so it can never go stale: no key → 'none'; mid-test → 'testing';
// last Test failed → 'error'; otherwise → 'connected'. A saved 'connected' value
// could be wrong the moment a key is revoked OpenRouter-side, so it is never stored.
type AiConnectionStatus = 'connected' | 'none' | 'testing' | 'error';
```
> The key is held only in browser storage and sent directly to OpenRouter at call time — never to Project Alice servers. There is no separate consent flag: a non-null `apiKey` *is* consent, and **Delete** (clearing it) withdraws consent. Feature toggles are independent of the key and only take effect while `enabled` is true.

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
| `--ok`            | `#16a34a` | AI `Connected` status dot          |
| `--ok-dim`        | `#E6F4EA` | AI `Connected` status-pill background |
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
| 2 | How are Experience / Education entries added and removed (row management)?| **Resolved** — inline entry overlay modal (desktop) / bottom-sheet (mobile). See [`edit_profile_page.md`](edit_profile_page.md). |
| 3 | Should unsaved edits prompt a confirmation before navigating back?       | **Resolved** — yes; discard-confirmation overlay. See [`edit_profile_page.md`](edit_profile_page.md). |
| 4 | Is the Profile used to power Tracker compatibility scores?               | Open     |
| 5 | What additional link platforms should be supported (e.g. Indeed, Xing)? | **Resolved** — links are free-form URL + optional friendlyName; no platform list |
| 6 | Should the avatar support a photo upload, or remain initials-only?       | Open (currently initials-only) |
| 7 | Should the Calendar page have access to Profile data?                    | Open     |
| 8 | How are archived applications surfaced on the Profile page?              | **Resolved** (028) — always-visible "Archived applications · N →" link in the Applications section; stats/chart exclude archived rows |
| 9 | How does a user delete their account / clear their data?                 | **Resolved** (030) — mode-aware Account section (§4.5) with a gated confirmation modal; hosted deletes the account, local clears data, demo is disabled |
| 10 | How are skills captured beyond flat tags?                               | **Resolved** — 1–5 proficiency scale; graded meter rows on the Profile page (§4.4 Skills); the gated inline editor lives in [`edit_profile_page.md`](edit_profile_page.md#skills-editor) |
| 11 | How does a user start a profile — guided vs. blank form?                | **In design** — proposed smart/manual entry gate + résumé import. See [`edit_profile_page.md` §3](edit_profile_page.md#3-entry-flow--states-proposed) |
| 12 | How are AI features configured and consented to?                        | **Resolved (feature 033)** — unified Settings card (§4.5.1): a master toggle, browser-local OpenRouter key (consent folded into the key flow), free-text model slug, single connection status, and per-feature toggles (CV / JD / Compatibility) |
| 13 | How does a user keep the app up to date?                                | **In design** — Updates sub-group (§4.5.2): current version + manual check, auto-check toggle, collapsible update mode; paired with a footer **Download** control and update notifications. See [`design/updates.md`](design/updates.md) |
