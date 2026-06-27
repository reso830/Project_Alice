# Updates (App Update Flow) — Design Specification
**Project Alice** · Last updated: June 22, 2026

> **Companion to [`profile_page.md`](profile_page.md).** This document is the canonical
> spec for the **app update** feature: the footer **Download** control, the
> **update notifications** (toasts), and the Profile › Settings **Updates**
> sub-group ([`profile_page.md` §4.5.2](profile_page.md#452-updates-sub-group)
> points here). Canonical reference drawing:
> [`../mockups/Updates Mockups.html`](../mockups/Updates%20Mockups.html).

---

## Table of Contents
1. [Overview](#1-overview)
2. [Runtime modes](#2-runtime-modes)
3. [Footer download control](#3-footer-download-control)
4. [Update notifications (toast)](#4-update-notifications-toast)
   - 4.1 [States](#41-states)
   - 4.2 [Placement & responsive](#42-placement--responsive)
5. [Settings — Updates sub-group](#5-settings--updates-sub-group)
6. [Versioning](#6-versioning)
7. [Design tokens](#7-design-tokens)
8. [Open questions](#8-open-questions)

---

## 1. Overview

Project Alice ships as a **hosted web app** and can also be **run locally** from
source. The update feature keeps a local install current and gives the hosted
build a path to download a local copy. It has three surfaces:

| Surface | Where | Purpose |
|---------|-------|---------|
| **Footer download control** | Global footer, brand row | Hosted → download a local build; Local → link back to the hosted version |
| **Update notification** | Bottom-right toast (desktop/tablet) / bottom card (mobile) | Announce an available update and report download / install progress |
| **Settings › Updates** | Profile › Settings card | Persistent control centre: current version, manual check, auto-check toggle, update mode |

The notification and the Settings sub-group are **two views of the same state
machine** (available → downloading → installing). The toast is the transient,
attention-grabbing surface; Settings is the durable one. Both expose **What's
new** and a route to the other (the toast's *Manage in Settings* link).

---

## 2. Runtime modes

The footer control is **mode-aware**, resolved the same way as the Account
sub-group (`authStore` → hosted / local / demo):

| Mode | Footer control |
|------|----------------|
| **Hosted** | **Download** button — offers the latest release to run locally |
| **Local** | **Open hosted version ↗** link — no download (already running from source) |
| **Demo** | Treated as hosted for the footer (download offered) |

> **Why no download when local:** a user already running the source has nothing
> to download. Surfacing a dead "Download" button there is noise; a link back to
> the shareable hosted instance is the useful affordance instead.

---

## 3. Footer download control

Lives in the footer **brand row**, right-aligned (`margin-left: auto`), beside
the logo + tagline. Everything else in the footer is unchanged from
`src/components/Footer.js` (Version / Stack / Feedback / License columns +
copyright line) — see [`footer.md`](footer.md) for the full footer spec.

### Hosted — Download button
```
[Alice logo] Project Alice  Your job search, organized.        [ ↓ Download  v1.8.0 ]
```
- Element: `<a class="fdl-btn">`, OS-agnostic — points to the **latest GitHub
  release** (`https://github.com/reso830/Project_Alice/releases/latest`).
- Label is simply **Download** + a muted mono version chip (`v1.8.0`, bound to
  `APP_VERSION`). A download glyph leads.
- Style: translucent white surface (`rgba(255,255,255,.06)`), `1px` hairline
  border (`rgba(255,255,255,.14)`), `--r-sm`. **Hover → indigo** fill + border.
- The version chip dims to `rgba(255,255,255,.55)` (→ `.8` on hover).

> **OS handling:** a single link, deliberately platform-agnostic. Because Alice
> is a web app, there are no per-OS binaries to disambiguate — the release page
> hosts whatever artifacts exist. No macOS/Windows/Linux split.

### Local — hosted link
```
[Alice logo] Project Alice  Your job search, organized.        Open hosted version ↗
```
- Element: `<a class="fhosted">` — mono, muted (`rgba(255,255,255,.5)`), external
  arrow glyph; **hover → white**. No button chrome.
- Replaces the download button entirely (not shown alongside it).

---

## 4. Update notifications (toast)

A single component renders all three states. It announces a release and then
reports progress; it is **not** where long-term preferences live (that's
Settings). Width `380px` on desktop/tablet; full-width on mobile.

### 4.1 States

| State | Icon | Title | Sub-line | Body | Actions |
|-------|------|-------|----------|------|---------|
| **Available** | Alice logo | "A new version is available" | `v1.8.0` chip · "released today" | — (no release-note list) | **What's new ↗** (link) · *Remind me later* (ghost) · **Install now** (primary) · ✕ |
| **Downloading** | Download glyph | "Downloading update" | `v1.8.0` chip · "12.4 MB" | Determinate progress bar — `64%` / "~18s left" | **Manage in Settings** (link) · *Cancel* (ghost) · ✕ |
| **Installing** | Spinner | "Installing update" | `v1.8.0` chip · "applying changes…" | Indeterminate bar — "Almost done" / "Restart to finish" | **Manage in Settings** (link) · *Later* (ghost) · **Restart to finish** (primary) |

Rules:
- **Available carries no bulleted release notes** — a single **What's new ↗**
  link replaces them. (Earlier drafts listed 3 bullets; removed to keep the card
  compact, especially on mobile.)
- **The Alice logo** is the brand signifier for the *available* state; the other
  two use functional glyphs (download, spinner).
- **Manage in Settings** appears on downloading + installing so the user can jump
  to the durable control centre mid-flow.
- Secondary actions are **ghost** buttons (low emphasis); the primary action
  carries the weight. Available/Installing have a primary; Downloading does not.

### 4.2 Placement & responsive

| Viewport | Placement |
|----------|-----------|
| **Desktop / tablet** | Fixed **bottom-right** toast (`right/bottom: 16px`) |
| **Mobile** | Full-width **card pinned to the bottom**, above the tab bar (`left/right: 12px`, `bottom: 64px`) |

**Mobile action wrapping:** three buttons don't fit one row at phone widths, so
the actions row **wraps** — secondary actions (e.g. *What's new* + *Remind me
later*) sit on the top row and the **primary action goes full-width below**
(`flex-basis: 100%`, ordered last). This prevents the long "Restart to finish"
/ "Install now" labels from clipping. Desktop/tablet keep a single inline row.

### 4.3 Navigation badge

To ensure users do not miss updates after dismissing the transient toast notification, a subtle navigation badge is rendered on the **Profile** navigation button:
- **Desktop Navbar**: A small colored dot (`6px` diameter, absolute positioned on the top-right of the "Profile" nav button text).
- **Mobile BottomTabBar**: A small colored dot (`6px` diameter, absolute positioned on the top-right of the "Profile" tab icon).
- **Color Coding**: 
  - Amber (`#F59E0B`) when updates are `available` or `downloading`.
  - Indigo (`--indigo` / `#4F46E5`) when updates are staged and `ready-to-restart`.
- **Visibility**: Only rendered in Local mode. The badge appears as soon as an update check returns a newer version, and disappears only after the system restart is completed.

---

## 5. Settings — Updates sub-group

The durable control centre. Lives in the Profile **Settings** card as the
**middle** sub-group (AI → **Updates** → Account). Structure splits cleanly into
**status (info)** above a horizontal rule and **controls** below it.

```
UPDATES
┌─ status block (contextual, single source of truth) ───────────┐
│  Current version v1.8.0   [● Up to date]          [Check now]  │   ← idle
│  …or…                                                          │
│  Update available v1.8.0                              [Install]│   ← available
│  You're on v1.7.1 · What's new ↗                               │
│  …or progress block (downloading / installing)…               │
└────────────────────────────────────────────────────────────────┘
────────────────────────────────────────────────────────────────   ← rule
Check for updates automatically                            [ ⃝]    ← toggle
Update mode                              Ask before installing  ⌄   ← collapsed control
```

### Status block (above the rule)
One block, state-driven — **no redundant status pill** repeating the title:

| State | Content | Action |
|-------|---------|--------|
| **Up to date** | "Current version" + `v1.8.0` chip + **● Up to date** pill (green) | **Check now** (outline) |
| **Available** | "Update available `v1.8.0`" title; "You're on v1.7.1 · **What's new ↗**" sub-line | **Install** (primary) |
| **Downloading** | "Downloading `v1.8.0`" + "64% · ~18s"; determinate bar; **What's new ↗** | **Cancel** (ghost) |
| **Installing** | "Installing `v1.8.0`" + "applying changes…"; indeterminate bar; "Restart to apply the update." | **Restart to finish** (primary) |

- The **status pill is reserved for the calm idle state**; the active states
  convey status through the block title itself, so nothing is said twice.
- All contextual content (available banner, progress) sits **above** the rule
  with the version info — never stranded below it.
- **Check now** is always reachable from the idle state (and works even when
  auto-check is off).

### Controls (below the rule)
1. **Check for updates automatically** — a row (title + one-line description) with
   the standard Settings toggle switch (`.sw`), matching the AI sub-group's
   controls. Default **on**.
2. **Update mode** — a **collapsible** control. Collapsed, it's a single row:
   an uppercase "UPDATE MODE" label, the current choice (e.g. "Ask before
   installing"), and a chevron. Expanding reveals three selectable radio cards:

   | Mode | Description |
   |------|-------------|
   | **Notify only** | Show a badge when a new version is ready. |
   | **Ask before installing** | Confirm each update before it downloads. *(default)* |
   | **Install automatically** | Keep Alice up to date in the background. |

   Collapsing the mode keeps the card calm by default and only expands the three
   options when the user is actively choosing.

---

## 6. Versioning

- **Current version** binds to `APP_VERSION` (`src/pages/welcome/shared/appMeta.js`),
  currently **`v1.9.0`** — the same constant the footer renders.
- The available / downloading / installing depictions show an **upgrade to the
  next release**. The reference drawing uses **v1.7.1 → v1.8.0** as an
  illustrative pair; in production the "available" version is whatever the latest
  release reports, and "current" stays bound to `APP_VERSION`.

---

## 7. Design tokens

Reuses the global token set (see [`profile_page.md` §8](profile_page.md#8-design-tokens)).
Notable usages:

| Token | Usage |
|-------|-------|
| `--indigo` `#4F46E5` | Primary actions, selected mode radio, progress fill, footer button hover |
| `--ok` `#16a34a` / `--ok-dim` `#E6F4EA` | "Up to date" status pill |
| `--bg` `#F4F1ED` | Version chip background, progress track |
| `--border` `#E8E3DA` | Toast border, mode-card border, chip border |
| `--shadow-lg` | Toast elevation |
| `--r-lg` `14px` / `--r-md` `10px` / `--r-sm` `6px` | Toast / cards / chips & buttons |

Typography per the global scale: **Sora** for titles/labels, **DM Mono** for
version chips and progress meta.

---

## 8. Open questions

| # | Question | Status |
|---|----------|--------|
| 1 | For a web app, does "Restart to finish" / "Install" map to a real action, or should the copy be reframed (e.g. "Reload to update")? Service-worker-style reload vs. literal install is unresolved. | **Open** |
| 2 | Does "Install automatically" make sense for a hosted web app (which updates on deploy), or is it only meaningful for local builds? Possibly hide the mode on hosted. | **Open** |
| 3 | Should the footer **Download** also appear in demo mode, or only authenticated hosted? Currently treated as hosted. | **Resolved** (Yes. Demo mode behaves like Hosted mode: the global footer brand row renders the platform-agnostic "Download vX.Y.Z" button pointing to GitHub Releases). |
| 4 | Where do release notes ("What's new") live — a modal, the GitHub release page, or an in-app changelog? | **Resolved** (Link opens official GitHub Releases page in a new browser tab with target="_blank" rel="noopener noreferrer") |
| 5 | Should an available update surface a badge on the Profile nav item / topbar, independent of the toast being dismissed? | **Resolved** (Yes, a subtle colored dot badge is rendered on the Profile button in Navbar and BottomTabBar) |
