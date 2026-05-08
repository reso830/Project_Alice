# Profile Page — Design Specification
**Project Alice** · Last updated: April 28, 2026

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
  └── Profile Section Card
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
| 4 | Skills                   | Pill tags (`background: #F0EEFF`, `color: #4F46E5`, `border-radius: 4px`)           |
| 5 | Certifications           | Structured entries: name (title), issuingBody (meta), issuanceDate–expiryDate (meta), certificateId (secondary meta, `10px`) |
| 6 | Awards                   | Structured entries: awardName (title), `issuingBody \| date` (meta), details (body text) |
| 7 | Languages                | Pill tags showing `"Language \| Proficiency"` (Proficiency levels: Beginner, Intermediate, Professional, Fluent) |
| 8 | Links                    | Chip-style anchor tags — single line showing `friendlyName` or hostname of URL; no platform label |

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
| 5 | Skills | Pill tag input — type and press Enter/comma to add; × to remove each pill. |
| 6 | Certifications | Entry list. Fields: Name\*, Issuing Body\*, Issuance Date\* (MM/YYYY), Expiry Date (MM/YYYY), Certificate ID. |
| 7 | Awards | Entry list. Fields: Award Name\*, Issuing Body\*, Award Date (MM/YYYY), Details. |
| 8 | Languages | Entry list. Fields: Language\*, Proficiency\* (dropdown: Beginner/Intermediate/Professional/Fluent). |
| 9 | Links | Entry list. Fields: URL\* (http/https), Friendly Name. |

\* = required field (validated on save)

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
| Click "Go to Tracker"         | Navigates to Tracker page                                         |
| Click "Edit Profile"          | Navigates to Edit Profile page                                    |
| Click "Set Up Profile"        | Navigates to Edit Profile page (same destination)                 |
| Click "← Back to Profile"     | Returns to Profile page; unsaved changes are discarded (TBD)      |
| Click link chip               | Opens URL in new tab                                              |

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
  skills:         string[];           // array of skill name strings
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
| `--indigo`        | `#4F46E5` | Primary buttons, active nav, avatar|
| `--indigo-hover`  | `#4338CA` | Primary button hover               |
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
