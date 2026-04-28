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

Shared across all pages. Sticky, `48px` tall, dark navy background (`#1a1a2e`).

| Element         | Detail                                                       |
|-----------------|--------------------------------------------------------------|
| Logo + wordmark | Left-aligned; indigo checkmark icon + "Project Alice" label  |
| Nav buttons     | Right-aligned; three items: Tracker, Calendar, **Profile**   |
| Active state    | Filled indigo background (`#4F46E5`), white text             |
| Inactive state  | Transparent, 25% white border, 65% white text                |

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

Two-column layout inside the card:

```
┌──────────────┬────────────────────────────────────┐
│  23  Total   │                                     │
│   9  Active  │   [Donut chart]    [Legend grid]    │
│   5  Pending │                                     │
│   1  Offer   │                                     │
└──────────────┴────────────────────────────────────┘
```

- **Left column:** 4 stat chips stacked vertically, separated by a right border
  - Total (dark navy), Active (amber `#d97706`), Pending (blue `#3b82f6`), Offer (green `#16a34a`)
- **Right column:** donut chart (160×160px, 55% hole) + 2-column legend, right-aligned as a group
- **Hover behaviour:**
  - Hovering a pie slice highlights that slice and dims all others (opacity 0.4)
  - Hovering a legend item cross-highlights the corresponding slice
  - A floating tooltip appears near the cursor: `"{Label} · {count} ({pct}%)`

#### Mobile layout (< 640px)

```
[4 stat chips in a row]
[Horizontal stacked bar — 28px tall, full width]
[Tap label — inline, appears on tap, auto-dismisses after 2s]
[2-column legend grid]
```

- Tap a bar segment or legend item to reveal an inline label showing label, count, percentage
- Label auto-dismisses after 2 seconds

#### Status colour mapping

| Status     | Colour    |
|------------|-----------|
| Applied    | `#3b82f6` |
| Screening  | `#ea580c` |
| Interview  | `#d97706` |
| Assessment | `#7c3aed` |
| Offer      | `#16a34a` |
| Rejected   | `#dc2626` |
| Withdrawn  | `#64748b` |
| Ghosted    | `#94a3b8` |
| Wishlist   | `#9333ea` |

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
                   📍 {City}   📞 {Phone}   ✉ {Email}
```

- Avatar: 52×52px circle, indigo tint background, initials in `DM Mono` weight 700
- Name: 16px, weight 700
- Meta items: 11px, `DM Mono`, muted grey; icon + label inline

#### Sub-sections

Each sub-section has a label row and content area. On **mobile**, labels are tappable to collapse/expand (chevron indicator). On **desktop**, always expanded — no collapse.

Sections are separated by a subtle `1px solid #f5f3f0` top border (not a full-width rule). No additional divider chrome.

| # | Sub-section              | Content type                                          |
|---|--------------------------|-------------------------------------------------------|
| 1 | Summary                  | Plain paragraph text                                  |
| 2 | Professional Experience  | Entries: role, company, period, description           |
| 3 | Education                | Entries: degree, school, year                         |
| 4 | Skills                   | Pill tags                                             |
| 5 | Certifications           | Bullet list (indigo dot)                              |
| 6 | Awards                   | Bullet list (amber dot)                               |
| 7 | Languages                | Pill tags                                             |
| 8 | Links                    | Chip-style anchor tags with platform label + URL      |

##### Links chips
```
[LinkedIn · linkedin.com/in/...]   [GitHub · github.com/...]
[Seek · seek.com.au/...]           [Portfolio · alexrivera.dev]
```
- Chip: `background #f7f6f3`, `border 1.5px solid #e0ddd8`, `border-radius 6px`
- Hover: border and text shift to indigo, background to `#f0eeff`
- Platform label: 9px, uppercase, muted (`#bbb`)
- URL text: 11px, `DM Mono`

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

Both entry points open the same page.

### Topbar
- Same dark navy bar; replaces nav with a **← Back to Profile** ghost button (left) and `Edit Profile` title text
- Clicking back returns to the Profile page without saving

### Body layout
- Max-width 680px, centred
- Stacked cards, one per section
- Top: an inline notice: `"This page is a placeholder — details to be designed in a later iteration."`

### Sections (in order)

1. **Basic Info** — First Name, Last Name, City/Location, Email, Phone (fully designed)
2. **Summary** — Textarea
3. **Professional Experience** — placeholder
4. **Education** — placeholder
5. **Skills** — comma-separated text input
6. **Certifications** — placeholder
7. **Awards** — placeholder
8. **Languages** — comma-separated text input
9. **Links** — placeholder

Each card has:
- A section title header (`11px uppercase`)
- Form body
- Footer with **Cancel** (outline) + **Save** (primary) buttons

> ⚠️ The detailed design for Experience, Education, Certifications, Awards, and Links entry flows (add/remove rows, date pickers, etc.) is **deferred** to a future design session.

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
  skills:         string[];
  certifications: string[];
  awards:         string[];
  languages:      string[];
  links:          LinkEntry[];
}

interface ExperienceEntry {
  role:    string;
  company: string;
  period:  string;   // e.g. "2021 – Present"
  desc:    string;
}

interface EducationEntry {
  degree: string;
  school: string;
  year:   string;
}

interface LinkEntry {
  platform: string;  // e.g. "LinkedIn", "GitHub", "Seek", "Portfolio"
  label:    string;  // display URL
  url:      string;  // href
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
- **Active** = `interview + screen + assessment`
- **Pending** = `applied`
- **Offer** = `offer`

---

## 8. Design Tokens

### Colours
| Token             | Value     | Usage                              |
|-------------------|-----------|------------------------------------|
| `color-bg`        | `#f0ede8` | Page background                    |
| `color-surface`   | `#ffffff` | Cards, inputs                      |
| `color-border`    | `#e0ddd8` | Card borders, input borders        |
| `color-border-sub`| `#f5f3f0` | Sub-section dividers               |
| `color-navy`      | `#1a1a2e` | Topbar, headings, key numbers      |
| `color-accent`    | `#4F46E5` | Primary buttons, active nav, links |
| `color-accent-hov`| `#4338ca` | Primary button hover               |
| `color-muted`     | `#999999` | Sub-headings, secondary text       |
| `color-label`     | `#aaaaaa` | Section labels, field labels       |

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

| # | Question                                                                 | Status  |
|---|--------------------------------------------------------------------------|---------|
| 1 | Should "Go to Tracker" filter the tracker to a specific status?          | Open    |
| 2 | How are Experience / Education entries added and removed (row management)?| Deferred|
| 3 | Should unsaved edits prompt a confirmation before navigating back?       | Open    |
| 4 | Is the Profile used to power Tracker compatibility scores?               | Open    |
| 5 | What additional link platforms should be supported (e.g. Indeed, Xing)? | Open    |
| 6 | Should the avatar support a photo upload, or remain initials-only?       | Open    |
| 7 | Should the Calendar page have access to Profile data?                    | Open    |
