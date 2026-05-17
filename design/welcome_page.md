# Project Alice — Welcome Page Design Spec

> Authoritative spec for the Welcome / sign-in page across **desktop, tablet, and mobile**. Written for coding agents (Claude, Codex). Source of truth wins over any rendered file when they disagree.

> **Implementation note (2026-05-16; updated 2026-05-17).** This document was drafted against a React/JSX prototype. The production project is **Vanilla JS + Vite**. The `.jsx`/`.html` filenames below (`welcome-app.jsx`, `Welcome.html`, `Welcome Mobile.html`, `ios-frame.jsx`) refer to the prototype; the production implementation lives in `src/pages/welcome/*.js` as a single responsive Vanilla JS module. Design intent (tokens, behavior, scene composition) carries over; the prototype Tweaks panel does not.
>
> Specific resolved divergences from the prototype, applied in Phase 14 of feature 018:
> - **License** in the mini footer is **PolyForm Noncommercial 1.0.0**, not MIT. Source the value from the same constant used by [Footer.js](../src/components/Footer.js); do not hard-code "MIT".
> - **Version** in the mini footer is sourced from the same `APP_VERSION` constant used by [Footer.js](../src/components/Footer.js), not hard-coded `v 0.4.0`. The mini footer shows whatever the rest of the app shows (currently `v0.8.0`; becomes `v0.8.1` after Phase 15).
> - **Report an issue / Request a feature** in the mini footer are real `<a>` links pointing at the `ISSUE_URL` constant from [Footer.js](../src/components/Footer.js) (currently `https://github.com/reso830/Project_Alice/issues/new`), opened in a new tab with `rel="noopener noreferrer"`. Same pattern as the site footer's `createFeedbackLink`.
> - **Try the demo** surfaces a "Demo coming soon" toast in Phase 14 via the existing `src/components/Toast.js` — **never** `window.alert()` (see tasks.md Task 14.14). Actual demo behavior is owned by feature 020 (see 018 spec.md FR-011 + Out-of-Scope). The CTA renders enabled (matching this design's visual), but clicking it surfaces the toast rather than navigating to a pre-seeded Tracker.
> - **Auth modal name field is omitted** — 018 Supabase signup is email + password only. The `AuthModal` body in §4.6 reads: email → password for both modes. Display-name capture is out of scope and may live in a future profile feature.
> - **"Forgot?" link is deferred** — Phase 14 does not ship a forgot-password trigger. The 018 spec mandates "no custom in-app reset UI"; Phase 14 adds a "no new auth API" guardrail. While the allowlist-controlled user base stays small, password reset is operator-driven (the operator triggers a reset email from the Supabase dashboard). A follow-up feature can wire `supabase.auth.resetPasswordForEmail` with a defined redirect URL.
> - **Mobile is a `<760px` breakpoint inside the single `WelcomePage.js` module**, not a separate `Welcome Mobile.html` artboard. The visual + behavior from §3.3 still applies — the production module simply branches on viewport rather than swapping HTML files.

**Files referenced from the prototype** (kept for visual reference; not literal paths in the codebase):
- `Welcome.html` — desktop entry point (also drives tablet via iframe + URL param)
- `welcome-app.jsx` — React app (mounts `<App>` into `#root`)
- `Welcome Mobile.html` — standalone mobile-portrait artboard (iPhone bezel)
- `Welcome Tablet.html` — tablet artboards (iPad portrait + landscape bezels embedding `Welcome.html?layout=centered`)
- `ios-frame.jsx` — prototype-only visual framing utility

---

## 1. Purpose

Public, unauthenticated landing page. Three jobs:

1. **Brand introduction** — first impression of Project Alice.
2. **Auth entry** — two CTAs open a single modal in `signin` or `signup` mode.
3. **Trial path** — third CTA ("Try the demo") renders enabled. In Phase 14 it surfaces a "Demo coming soon" toast; routing to a pre-seeded Tracker is owned by feature 020 (see header note). Treat this CTA as a visible-but-placeholder affordance for now.

No global nav bar. The brand block at the top of the pitch column carries identity.

---

## 2. Design Tokens

Defined as CSS custom properties on `:root` in `Welcome.html`. Use these — do not invent new colors.

| Token             | Value         | Usage                                           |
|-------------------|---------------|-------------------------------------------------|
| `--navy`          | `#1A1A2E`     | Primary dark; preview slab; primary text        |
| `--navy-2`        | `#232342`     | Hover/secondary dark                            |
| `--navy-deep`     | `#0E0E20`     | Slab on navy-theme background                   |
| `--indigo`        | `#4F46E5`     | Primary action, accents on light themes         |
| `--indigo-hover`  | `#4338CA`     | Primary action hover                            |
| `--indigo-dim`    | `#EEF2FF`     | Icon backplate, skill pill                      |
| `--indigo-soft`   | `#F4F2FF`     | Subtle indigo wash                              |
| `--indigo-mid`    | `#818CF8`     | Indigo accent on navy theme                     |
| `--gold`          | `#F2B544`     | Pipeline "current stage" highlight              |
| `--warm`          | `#F4F1ED`     | Warm off-white page background (default)        |
| `--surface`       | `#FFFFFF`     | Pure white page background                      |
| `--border`        | `#E8E3DA`     | 1px borders on warm/white                       |
| `--border-2`      | `#D1CCB9`     | Stronger borders / outline buttons              |
| `--t1`…`--t4`     | (greys)       | Text tiers (1 darkest → 4 lightest)             |

**Typography**
- **Sora** 300/400/500/600/700/800 — UI font (headlines, body, buttons)
- **DM Mono** 400/500 — eyebrows, IDs, timestamps, footer chrome
- System fallback chain: `-apple-system, "SF Pro", "Sora", system-ui, sans-serif`

**Radii:** 6 (chip) · 8 (button, input) · 10–12 (card) · 14 (modal) · 999 (pill)
**Shadows:**
- Card: `0 24px 60px -20px rgba(0,0,0,.45), 0 8px 22px rgba(0,0,0,.18)` (over navy)
- Primary button: `0 1px 2px rgba(79,70,229,.3), 0 4px 14px rgba(79,70,229,.18)`
- Modal: `0 12px 40px rgba(26,26,46,.22)`

---

## 3. Layouts

The page has **four** layout modes selectable via the `layout` Tweak (`diagonal` | `split` | `centered` | `hero`). The mode also drives the responsive strategy described below.

### 3.1 Desktop (≥ 1100px) — `diagonal` (default)

```
┌────────────────────────────┬────────────────────────┐
│                            │                        │
│  [logo]  Project Alice     │   ╱  Hero slideshow    │
│                            │  ╱   (navy slab)       │
│  Your job search,          │ ╱                      │
│  organized.                │╱                       │
│                            │                        │
│  [Sign in →][Create][Demo] │                        │
│                            │                        │
│  v0.8.1 · PolyForm NC · …          │                        │
└────────────────────────────┴────────────────────────┘
```

- **Pitch column** — `position: relative; z-index: 2`. Width 55% (`max-width: 760px`). Padding `6vw 5vw 6vw 6vw`. Min-height `100vh`. Vertically centred content.
- **Preview slab** — `position: absolute; inset: 0; left: auto`. Width 62%. Background `--navy` (or `--navy-deep` on navy theme). `clip-path: polygon(22% 0, 100% 0, 100% 100%, 6% 100%)`.
- Slab overlaps the pitch column behind the headline — pitch text always sits left of the diagonal.
- Mini footer (`.w-foot`) absolute, `bottom: clamp(20px, 3vw, 32px)`, `left: clamp(22px, 6vw, 64px)`.

**Other desktop modes (Tweak only):**
- `split` — straight vertical 55/45 split, no diagonal.
- `centered` — pitch centred top, preview as a 280px-tall horizontal band beneath (also used for tablet — see §3.2).
- `hero` — pitch overlays a full-bleed preview that gradient-fades into the page.

### 3.2 Tablet (760–1100px) — `centered`

Rendered in `Welcome Tablet.html` by embedding `Welcome.html?layout=centered` inside iPad bezels. Two artboards: **Portrait 820×1180** and **Landscape 1180×820**.

```
┌──────────────────────────────────────┐
│                                      │
│            [logo]                    │
│        Project Alice                 │
│                                      │
│       Your job search,               │
│         organized.                   │
│                                      │
│   [Sign in →] [Create] [Demo]        │
│                                      │
│  ┌───── Hero slideshow band ─────┐   │
│  │  (280px tall, full-width)     │   │
│  └───────────────────────────────┘   │
│                                      │
│         v0.8.1 · PolyForm NC · …             │
└──────────────────────────────────────┘
```

- **Container** — `.w-stage.layout-centered`: `flex-direction: column; align-items: center; justify-content: center; padding: 56px 24px 64px`.
- **Pitch** — `max-width: 640px; text-align: center; align-items: center`. Brand block, headline, CTAs all centre-aligned. CTA row centred.
- **Preview band** — `width: 100%; max-width: 1100px; height: 280px; margin-top: 56px; border-radius: 16px; overflow: hidden`. Same navy background.
- **Mini footer** — moves to bottom-centre, full-width (`left: 0; right: 0; bottom: 18px; justify-content: center`).

**Tablet-specific slideshow tweaks** (applied via `.w-stage.layout-centered` selectors):
- Scene 1 (stack) renders **only 2 cards** in a flat row (`PREVIEW_CARDS.slice(0, 2)`), not 4. Cards are flexed `flex: 1` with 14px gap.
- Scene 4 (logo) inner is **fixed 200×200** (not the width-based 70%/360px default) so it fits within the 280px preview band without cropping.

### 3.3 Mobile (< 760px) — responsive branch of `WelcomePage.js`

> **Production mapping (see header note).** The prototype modelled mobile as a separate `Welcome Mobile.html` artboard inside an iPhone bezel for visual reference. In the production Vanilla JS module this is a `<760px` **breakpoint branch inside the single `WelcomePage.js`**, gated by a `matchMedia('(max-width: 759px)')` listener that toggles a `.welcome--mobile` class on the welcome root. The visual + behavior below applies one-for-one; only the file structure differs.

A simplified portrait screen — **not** a squished desktop. No slideshow, no diagonal split. Sized for an iPhone-class viewport (≈ 402×874).

```
┌────────────────────┐
│  ··· status bar    │  ← cleared by 96px top padding
│                    │
│   [logo, 68px]     │  ← brand stack (left-aligned)
│   Project Alice    │
│                    │
│   Your job search, │  ← headline
│   organized.       │
│                    │
│                    │  ← flex spacer (margin-top: auto)
│                    │
│  ┌──────────────┐  │
│  │  Sign in  →  │  │  ← primary
│  └──────────────┘  │
│  ┌──────────────┐  │
│  │Create account│  │  ← outline
│  └──────────────┘  │
│  ┌──────────────┐  │
│  │● Try the demo│  │  ← ghost
│  └──────────────┘  │
│                    │
│       ▬▬▬          │  ← home indicator
└────────────────────┘
```

- **Container** — `.mw`: `width: 100%; height: 100%; background: var(--warm); display: flex; flex-direction: column; padding: 96px 28px 56px`. The 96px top padding clears the dynamic island + status bar.
- **Brand stack** — left-aligned column, `gap: 18px`. Logo 68×68 (`Alice_Colored.png`), wordmark Sora 700 / 32px / `-.6px` tracking.
- **Headline** — 38px / `-1.2px` tracking / line-height 1.04 / `text-wrap: balance`. "organized." rendered in indigo with the same underline-glow `::after` as desktop.
- **CTA group** — `margin-top: auto` anchors it to the lower half. Buttons are **full-width**, 12px radius, 16px / 20px padding, 15px font, vertical stack with 10px gap. Pulsing green dot on the ghost "Try the demo" button (`mw-pulse` 1.8s infinite).
- No slideshow and no prototyping controls at this viewport. The mini footer remains visible. The Auth Modal is still mounted — tapping Sign in / Create account opens it in the same overlay used on desktop.

> Mobile is intentionally a different *layout*, not a squished desktop. In production, the difference is implemented as a `.welcome--mobile` branch inside `WelcomePage.js`, not as a separate page module. Do not fork into a second module to satisfy this section.

---

## 4. Components

### 4.1 Brand Block
- Logo: `assets/Alice_Colored.png` on warm/white themes, `assets/Alice_White.png` on navy theme. `clamp(56px, 6vw, 84px)` square on desktop; 68px on mobile.
- Wordmark: Sora 700, `clamp(28px, 3vw, 40px)` on desktop, 32px on mobile, `-.6px` tracking.
- Gap 14px (desktop) / 18px (mobile, stacked).

### 4.2 Headline
- Copy: `Your job search,\n<em>organized.</em>`
- Sora 700; desktop `clamp(40px, 5.8vw, 84px)`, mobile 38px.
- Line-height `1.02`, tracking `-2px` (desktop) / `-1.2px` (mobile).
- `text-wrap: balance`.
- `<em>` is the indigo accent + underline-glow (`::after` 12% height, 22% opacity, indigo, radius 999px). `white-space: nowrap` to keep the underline whole.

### 4.3 CTA Row

| Button         | Class                  | Style                                | Action                       |
|----------------|------------------------|--------------------------------------|------------------------------|
| **Sign in →**  | `w-btn--primary`       | Indigo fill, white text, indigo glow | Open Auth Modal `signin`     |
| Create account | `w-btn--outline`       | Transparent + 1.5px border-2 outline | Open Auth Modal `signup`     |
| ● Try the demo | `w-btn--ghost`         | Transparent, muted, pulsing dot      | Phase 14: fire "Demo coming soon" toast (placeholder). Real demo route owned by feature 020. |

- Desktop padding `13px 24px`, 13px font, 8px radius, 10px gap.
- Mobile padding `16px 20px`, 15px font, 12px radius, full-width.
- Hover (primary): `translateY(-1px)` + deeper shadow.

### 4.4 Hero Slideshow (`HeroSlideshow`)

Auto-cycles four scenes. 5.5s per scene, 0.7s cross-fade. Click any of the 4 bottom dots to jump; the active dot shows a 0→1 progress bar matching scene duration.

#### Scene 1 — Tilted card stack (`SceneStack`)
- **Diagonal/split:** 4 `PreviewCard` instances stacked with rotation `-4° → +4°`, alternating ghost opacities (42% / 100% / 100% / 55%). Cards enter from `scale(.55) opacity(0)` with 90ms stagger via `cubic-bezier(.2,.7,.3,1.05)`.
- **Centered/hero (tablet):** 2 cards in a flat horizontal row, `flex: 1`, 14px gap. No rotation, no ghosting.

#### Scene 2 — Pipeline animation (`ScenePipeline`)
- One straight `PreviewCard` ("J024 · UX Engineer · Vertex AI", compat 94).
- Status cycles `applied → phone_screen → interview → assessment → offer` every 1100ms.
- Card is re-keyed on stage change so the status badge does a `0.55s` pop-in (`pipeline-badge` keyframes).
- **No bottom progress pips or `Stage N/5` caption** — those were removed by request. The badge change in the card is the only progress signal.

#### Scene 3 — Profile donut (`SceneProfile`)
- Two stacked rows with **44px gap** between them (the parent must be `display: flex` for the gap to apply — bug already fixed).
  - **Top:** 4 stat chips (Total, Active, Pending, Offer) in `rgba(255,255,255,.06)` cards with 1px hairline borders.
  - **Bottom:** SVG donut (168×168, 22px ring thickness) + 2-column legend.
- Donut animates from `0 → strokeDasharray` with 0.7s transitions, staggered by 120ms per segment.
- Mid-scene (2700ms), `DONUT_INITIAL → DONUT_AFTER` swap: segments re-allocate, numbers tick up via `AnimatedNumber` (700ms cubic ease-out).

#### Scene 4 — Big logo (`SceneLogo`)
- `assets/Alice_White.png` floating with a 6s `scene-logo-float` ease-in-out loop.
- 4 gold sparkle stars positioned at corners of the logo box, each with a 2.4s `scene-sparkle` scale/fade loop, staggered 0.6s.
- **No tagline below the logo** — only the mark + sparkles.
- Sizing:
  - Default (diagonal/split/hero): `width: min(360px, 70%); aspect-ratio: 1`.
  - **Centered (tablet): fixed `200×200`** so it fits the 280px preview band.

### 4.5 Mini Footer (`.w-foot`)
- DM Mono 10px. Items: `{APP_VERSION} · PolyForm Noncommercial 1.0.0 · ⊙ Report an issue · ✦ Request a feature`.
- 3px round separators between items at 35% opacity.
- Hover on link items: indigo accent.
- Position varies by layout (see §3).

### 4.6 Auth Modal (`AuthModal`)
- Mounted into `<body>`, fixed overlay `rgba(8,8,24,.55)` with `backdrop-filter: blur(6px)`.
- Modal: 440px max-width, 14px radius, white surface.
- Header: 40px Alice logo + title + close button.
- Body: email → password. (Per Phase 14 header note: name field is omitted, and the "Forgot?" link is **deferred** — operator-driven reset only until a follow-up feature wires `supabase.auth.resetPasswordForEmail`. Do not ship a placeholder/inert Forgot link.)
- Footer: primary submit → `or` divider → demo button (warm fill, green pulse dot) → swap-mode link → legal copy (signup only).
- Mode is controlled by the CTA that opens the modal (`Sign In` or `Create Account`) and by the modal's in-place swap link.

---

## 5. Production Defaults

Production uses `layout=diagonal` on desktop, forces `layout=centered` at tablet width, uses the `warm` theme, `copyIntensity=none`, and `heroScene=auto`. The old floating Tweaks panel and its URL-param overrides were prototype-only and MUST NOT render in production.

### Retired Prototype Tweaks

The floating Tweaks panel from the React prototype is not part of the production welcome page. Production uses the defaults below; URL parameters do not configure layout, theme, copy, auth mode, or hero scene.

| Setting         | Production value |
|-----------------|------------------|
| `layout`        | `diagonal` · `split` · `centered` · `hero`                      | `diagonal`  |
| `theme`         | `warm` · `white` · `navy`                                       | `warm`      |
| `copyIntensity` | `none` · `minimal` · `pitch`                                    | `none`      |
| `authState`     | `signin` · `signup`                                             | `signin`    |
| `heroScene`     | `auto` · `stack` · `pipeline` · `profile` · `logo`              | `auto`      |

### Retired URL-param override
`welcome-app.jsx` reads `window.location.search` at load and overlays any matching query param onto `TWEAK_DEFAULTS`. Used by `Welcome Tablet.html` to embed `Welcome.html?layout=centered`. Pattern:

```
Welcome.html?layout=centered&theme=warm&heroScene=stack
```

---

## 6. Behaviour & Interactions

- **Scene auto-cycle** — `setInterval` at 5500ms; `heroScene !== "auto"` pins to a single scene.
- **Auth modal open** — body scroll lock (`overflow: hidden` on `<body>`) while open; clicking the overlay (but not the modal itself) closes.
- **Auth swap** — clicking "Sign in" / "Create an account" at the bottom of the modal swaps mode without closing.
- **Demo button** — Phase 14 implementation surfaces the shared "Demo coming soon" toast (`showDemoComingSoon()` from `src/pages/welcome/demoStub.js`); both the welcome-page CTA and the auth-modal demo button share this single call site. Feature 020 will replace the stub with the real route. Do **not** use `window.alert()`.
- **Hover/focus rings** — primary uses translateY + shadow; outline button darkens border; ghost recolors to indigo. Inputs use 3px `rgba(79,70,229,.12)` focus ring.

---

## 7. Assets

| Path                          | Purpose                                          |
|-------------------------------|--------------------------------------------------|
| `assets/Alice_Colored.png`    | Brand mark on warm/white themes                  |
| `assets/Alice_White.png`      | Brand mark on navy theme, scene-4 hero logo      |

No other raster assets are required. Icons (`IconArrow`, `IconClose`, `IconCheck`, `IconBolt`, `IconChart`, `IconBug`, `IconSpark`, `SparkStar`) are inline SVGs defined in `welcome-app.jsx`.

---

## 8. Implementation Notes for Agents

> The bullets below are normalized for the production Vanilla JS module (`src/pages/welcome/*.js`). Prototype-only guidance (React/JSX, separate HTML artboards, Babel quirks) is annotated as such.

- **Do not** add a top nav bar to Welcome — identity comes from the brand block.
- **Mobile (`<760px`) is a responsive branch inside the single `WelcomePage.js` module**, not a separate page. Implement it via the `.welcome--mobile` class toggled by a `matchMedia` listener (see §3.3 + FR-025 + Task 14.15). The "do not make Welcome.html responsive" guidance from the React prototype does **not** apply to the production module; the prototype split into HTML artboards because the design tool couldn't switch layouts at one viewport, the Vite SPA can.
- **Tablet (760–1099px) uses the `centered` layout** — implemented as a CSS branch on the same root element, not a forked module or iframe. The prototype's "embed `Welcome.html?layout=centered` inside iPad bezels" approach is a design-tool artifact; production just applies the `welcome--layout-centered` class at this viewport range.
- The `EDITMODE-BEGIN/END` JSON block and floating Tweaks panel from the prototype are React-host/prototyping concepts; production does not include a Tweaks store, Tweaks panel, or URL-param overlay for design variants.
- **Style object naming** (`mwStyles`, etc.) is a prototype-only constraint from the multi-file Babel setup. Production uses plain CSS (`src/styles/main.css`); ignore this bullet.
- The slideshow's parent container must have an explicit `display: flex` on any child that relies on percentage heights or `gap` (this caused the donut-spacing bug in the prototype). Carries over to production CSS.
- Preserve any `data-comment-anchor` attribute encountered when porting from the prototype — they're used by the design-review tool.
