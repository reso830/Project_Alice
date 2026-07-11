# Footer (Global Chrome) — Design Specification
**Project Alice** · Last updated: June 22, 2026

> Canonical for the **site footer** rendered at the bottom of every top-level
> page (Tracker, Calendar, Profile). Structure and content mirror
> `src/components/Footer.js`; metadata comes from
> `src/pages/welcome/shared/appMeta.js`. The **proposed Download control** is a
> design addition specced in [`updates.md` §3](updates.md#3-footer-download-control).

---

## 1. Overview

A single, shared footer component (`Footer.render()`) appended below the main
content of each page. It is **informational chrome** — brand identity, build
metadata, feedback links, and license — on the dark navy surface that bookends
the app against the navy topbar.

It is **static** in the shipped build (no interactive controls). The only
proposed interactive element is the mode-aware **Download / Open hosted version**
control in the brand row — see [`updates.md`](updates.md).

---

## 2. Structure

Source order inside `.footer__inner` (`src/components/Footer.js → render()`):

```
[Footer · .site-footer]
  └── .footer__inner
        ├── .footer__brand        ── logo + name + tagline   (full-width row)
        │     └── [proposed] Download control, right-aligned  (see updates.md §3)
        ├── <hr .footer__rule>    ── single rule under the brand row
        ├── VERSION   section
        ├── STACK     section
        ├── FEEDBACK  section
        ├── LICENSE   section
        └── .footer__copyright    ── full-width copyright line
```

> **One rule only.** There is a single `.footer__rule` between the brand row and
> the columns. There is **no** second rule before the copyright (the copyright
> sits directly under the column grid).

---

## 3. Content

All copy is verbatim from source; version/license values resolve from `appMeta.js`.

### Brand (`.footer__brand`)
| Element | Class | Content |
|---------|-------|---------|
| Logo | `.footer__brand-icon` | `alice-sigil-full.svg` (`alt=""`, `aria-hidden="true"`) |
| Name | `.footer__brand-name` | "Project Alice" |
| Tagline | `.footer__tagline` | "Your Career OS." |

### Sections (`.footer__section`)
Each is a `<section>` with an uppercase `.footer__label` and one or more
`.footer__value` / `.footer__link` lines.

| Label | Lines | Source |
|-------|-------|--------|
| **VERSION** | `APP_VERSION` (**v1.9.0**) · "Built May 2026" | `appMeta.APP_VERSION` |
| **STACK** | "Vanilla JS · Vite" · "Vercel · Supabase" · "Vitest · ESLint · Speckit" | literal |
| **FEEDBACK** | "Report an issue" · "Request a feature" (both `.footer__link`) | `appMeta.ISSUE_URL` |
| **LICENSE** | "PolyForm Noncommercial 1.0.0" (`.footer__link`) | `appMeta.LICENSE_NAME` / `LICENSE_URL` |

- **Feedback links** both point to `ISSUE_URL`
  (`https://github.com/reso830/Project_Alice/issues/new`), open in a new tab
  (`target="_blank"`, `rel="noopener noreferrer"`), and carry distinct
  accessible names: `aria-label="Report an issue on GitHub"` /
  `"Request a feature on GitHub"`. The FEEDBACK section also carries a
  `.footer__feedback` modifier class.
- **License link** points to `LICENSE_URL`
  (`https://polyformproject.org/licenses/noncommercial/1.0.0`), same new-tab rel.

### Copyright (`.footer__copyright`)
> © 2026 Project Alice. All rights reserved. · Part of reso's Project Series.

---

## 4. Styling

Dark navy surface matching the topbar; mono data lines, low-emphasis text.
(Values below are the design reference from the mockups; the canonical metadata
+ DOM structure are from `Footer.js`.)

| Element | Treatment |
|---------|-----------|
| Footer surface | `--navy` `#1A1A2E` background, generous top/bottom padding |
| `.footer__inner` | Grid; brand row, rule, and copyright span all columns; the four sections form the column grid |
| `.footer__rule` | `1px solid rgba(255,255,255,.08)`, full width |
| `.footer__brand-icon` | ~`30–40px` square, `object-fit: contain` |
| `.footer__brand-name` | `#fff`, 13px / 600, `letter-spacing .4px` |
| `.footer__tagline` | `rgba(255,255,255,.38)`, 11px |
| `.footer__label` | `rgba(255,255,255,.28)`, 8px / 600, uppercase, `letter-spacing .9px` |
| `.footer__value` | DM Mono, 10px, `rgba(255,255,255,.45)`, `line-height 1.6` |
| `.footer__link` | DM Mono, 10px, `rgba(255,255,255,.4)`; hover → `rgba(255,255,255,.8)` |
| `.footer__copyright` | DM Mono, 9px, `rgba(255,255,255,.22)` |

Typography uses the global typefaces — **Sora** for the brand name / labels,
**DM Mono** for values, links, and copyright. Tokens per
[`profile_page.md` §8](profile_page.md#8-design-tokens).

---

## 5. Responsive

- **Desktop / tablet:** brand row full width; the four sections sit in a
  multi-column grid below the rule.
- **Mobile:** sections reflow to fewer columns (or stack); the brand row and
  copyright remain full-width. No content is hidden.

---

## 6. Metadata source

Footer constants live in **`src/pages/welcome/shared/appMeta.js`** so a release
bump touches one file (plus `package.json` / `package-lock.json`):

```js
export const APP_VERSION = 'v1.9.0';
export const ISSUE_URL    = 'https://github.com/reso830/Project_Alice/issues/new';
export const LICENSE_NAME = 'PolyForm Noncommercial 1.0.0';
export const LICENSE_URL  = 'https://polyformproject.org/licenses/noncommercial/1.0.0';
```

> Keep app-chrome constants here rather than re-introducing per-component
> versions — the footer and the Welcome mini-footer both read from this module.

---

## 7. Proposed additions

| Addition | Status | Reference |
|----------|--------|-----------|
| Mode-aware **Download** button (hosted) / **Open hosted version** link (local) in the brand row | **In design** | [`updates.md` §3](updates.md#3-footer-download-control) |

---

## 8. Open questions

| # | Question | Status |
|---|----------|--------|
| 1 | Should "Built May 2026" be derived from a build timestamp rather than a hardcoded string? | Open |
| 2 | Does the footer need a mobile-specific column count, or is the natural grid reflow sufficient? | Open |
| 3 | Should the brand-row Download control ship as part of the footer component, or be injected by the page shell (so it can read runtime mode)? | Open — see [`updates.md` §2](updates.md#2-runtime-modes) |
