# Data Model & Asset Specifications: Welcome Page & Brand Refresh

This document outlines the directory structuring, asset specifications, and mappings introduced in Feature 042.

---

## 1. Database Model Status

- **Runtimes Affected**: Local (SQLite) and Hosted (Supabase/Vercel) databases.
- **Table Schema Changes**: None. This feature introduces no changes to SQLite database tables or Supabase PostgreSQL tables.
- **Seeding/Migrations**: No new database migrations or seed data files are required.

---

## 2. Brand Logo Vector Assets

All raster brand images (`.png`) in global layout views are replaced with scalable vector graphics (`.svg`) for pixel-perfect display across high-density screens.

### Housekeeping Paths
All brand vector marks are moved to `src/assets/logo/`:

| Source File | Destination File | Target Usage |
| :--- | :--- | :--- |
| `design_handoffs/Alice_new_logo/favicon/alice-sigil-full.svg` | `src/assets/logo/alice-sigil-full.svg` | **Full-Color Sigil**: Used on the welcome brand header across all themes (warm/white/navy — the emblem reads on both light and dark backgrounds per the design prototype), mobile welcome header, auth modal header, and global footer. |
| `design_handoffs/Alice_new_logo/favicon/alice-sigil-full-white.svg` | `src/assets/logo/alice-sigil-full-white.svg` | **All-White Sigil**: Used on the desktop/mobile navigation bar and the config error screen. (The earlier navy-theme welcome header and scene-4 showcase-logo usages were superseded — the welcome header uses the color sigil across themes and the redesigned scenes embed no sigil.) |

---

## 3. Empty-State & Moment Illustrations

Unified graphical assets replace unicode glyphs and CSS-drawn shapes across multiple pages.

### Housekeeping Paths
All empty-state vector illustrations are placed in `src/assets/graphics/`:

| Source File | Destination File | Target Usage | Dimensions |
| :--- | :--- | :--- | :--- |
| `design_handoffs/Alice_Icons_Graphics/handoff/illustrations/calendar-quiet.svg` | `src/assets/graphics/calendar-quiet.svg` | **Quiet Calendar (Dashboard)**: Wide empty state in `src/components/calendar/ActionPanel.js`. | 110×110px |
| `design_handoffs/Alice_Icons_Graphics/handoff/illustrations/calendar-empty.svg` | `src/assets/graphics/calendar-empty.svg` | **Empty Calendar (Inline)**: Compact prompt/empty events in `src/components/calendar/DayPanel.js`. | 44×44px |
| `design_handoffs/Alice_Icons_Graphics/handoff/illustrations/profile-empty.svg` | `src/assets/graphics/profile-empty.svg` | **Empty Avatar**: Replaces CSS-drawn avatar shape on `src/pages/Profile.js`. | 110×110px |

---

## 4. Favicon Vector & Cache Mappings

Webpage favicons are updated using the custom brand marks. These are the handoff's **simplified** favicon marks — not the full sigil (`alice-sigil-full.svg`), which is too detailed to render legibly at favicon sizes. All four are wired into `index.html`'s `<head>`, ordered `.ico` → `.svg` → 32px PNG → apple-touch.

| Source File | Destination File | Op | Target Usage |
| :--- | :--- | :--- | :--- |
| `design_handoffs/Alice_new_logo/favicon/favicon-32.png` | `public/favicon-32x32.png` | overwrite | Browser-tab icon (bookmarks, history). |
| `design_handoffs/Alice_new_logo/favicon/favicon.ico` | `public/favicon.ico` | create | Legacy fallback for bare `GET /favicon.ico` requests. |
| `design_handoffs/Alice_new_logo/favicon/favicon.svg` | `public/favicon.svg` | create | Scalable / pinned-tab icon (modern browsers). |
| `design_handoffs/Alice_new_logo/favicon/apple-touch-icon.png` | `public/apple-touch-icon.png` | create | iOS home-screen / Safari icon. |

> The 16/48/64/128/256/512 PNGs in the handoff are **out of scope** for Feature 042 — they are only needed if a PWA `manifest.webmanifest` is later introduced.

---

## 5. System Icons Vector Registry

Standardized line icon paths used across global buttons, sort controls, and quick filters. Replaces hardcoded SVG path strings.

### Housekeeping Paths
All standard icon files reside in `src/assets/icons/` and are registered in `src/utils/icons.js`:

| Key | Vector File | Target Control / Usage |
| :--- | :--- | :--- |
| `edit` | (Registered Inline) | Edit application card actions. |
| `changeStatus` | (Registered Inline) | Cycle status actions. |
| `copyUrl` | (Registered Inline) | Copy URL link sharing. |
| `star` | (Registered Inline) | Favorite / Star controls. |
| `archive` | (Registered Inline) | Archive application actions. |
| `unarchive` | (Registered Inline) | Unarchive actions. |
| `close` | (Registered Inline) | Close button on overlays/modals. |
| `status` | `src/assets/icons/timeline.svg` (re-mapped) | Status filter chip. |
| `salary` | `src/assets/icons/overview.svg` (re-mapped) | Salary filter chip. |
| `compatibility` | `src/assets/icons/compatibility.svg` | Compatibility filter chip. |
| `company` | `src/assets/icons/empty-pane-icon.svg` (re-mapped) | Company filter chip. |
| `shift` | `src/assets/icons/timeline.svg` | Shift filter chip. |
| `workSetup` | `src/assets/icons/skills.svg` (re-mapped) | Work Setup filter chip. |
| `location` | `src/assets/icons/notes-links.svg` (re-mapped) | Location filter chip. |
| `sort` | (Registered Inline) | Sort toolbar actions. |
