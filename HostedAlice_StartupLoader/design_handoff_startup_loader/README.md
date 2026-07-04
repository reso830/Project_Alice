# Handoff: Hosted-App Startup Loader

## Overview
Full-page loading screen shown when a user visits the hosted (web) version of Project Alice and the app is still booting. Centered brand lockup (sigil + wordmark + status line) over the app's cream background, with a soft ambient purple/gold glow hugging the edges. **Static — no motion on the glow itself** at any breakpoint; the visual is deliberately calm for what can be an open-ended cold-boot wait.

## About the Design Files
`startup-loader.html` (+ `alice-sigil-full.svg`) is a **design reference built in HTML** — a prototype of the intended look, not production code to copy verbatim. Recreate this in the target codebase's existing environment (the app appears to be a JS/web app — use its existing component patterns, e.g. React) using its established styling approach. If no such pattern exists yet, plain CSS as shown is fine.

## Fidelity
**High-fidelity.** Colors, typography, spacing are final. Recreate pixel-for-pixel using the codebase's existing tooling. Includes 3 breakpoint variants (desktop, tablet portrait, mobile portrait) — all share the same static-glow treatment, scaled.

## Screen: Startup / Boot Loader
- **Purpose**: Cover the screen while the hosted app's JS/assets/initial data load on first visit. Replace with the real app once boot completes.
- **Layout**: Full viewport, single centered flex column (`align-items: center; justify-content: center`) on top of the app's standard background color `#F4F1ED`.

### Components
1. **Edge glow** (`.edge-glow`) — decorative background layer, full-bleed, `z-index` below the content. **Static only — no animation, no conic-gradient/rotation layer.**
   - Implementation: a single `box-shadow` (inset, two layers) on a full-bleed absolutely-positioned div:
     `box-shadow: inset 0 0 90px 10px rgba(61,26,138,.5), inset 0 0 150px 30px rgba(244,167,31,.35);` (deep purple `#3D1A8A` + gold `#F4A71F`).
   - That's it — no mask, no conic-gradient, no rotation. This was deliberately simplified after testing: a rotating gradient looked good on a landscape desktop viewport but produced hard diagonal seams once masked to portrait tablet/mobile aspect ratios, and a fixed-px glow shrinks to nearly nothing at 4K/high-res displays or renders unevenly on ultrawide monitors. A static, resolution-safe box-shadow sidesteps all of that with negligible visual cost — the icon and copy plus the app's own boot progress carry the "in progress" feeling.
2. **Sigil icon** (`.splash-icon`) — full-color Alice sigil (gold star + broken ring + purple road, `alice-sigil-full.svg`). Static — no pulse/scale animation. Size: 140×140px desktop, 120×120px tablet, 92×92px mobile.
3. **Wordmark** — "Project Alice", Sora 700, size: 26px desktop, 22px tablet, 18px mobile. Color `#1A1A2E`.
4. **Status line** — "Getting things ready…", Sora 400, size: 14px desktop, 13px tablet/mobile. Color `#4B5563`.
   - Content/copy is a placeholder; swap for real boot-progress copy if the app has discrete stages.

### Breakpoint sizing reference
| | Desktop | Tablet (portrait) | Mobile (portrait) |
|---|---|---|---|
| Glow base shadow (purple) | `inset 0 0 90px 10px` | `inset 0 0 34px 4px` | `inset 0 0 22px 3px` |
| Glow base shadow (gold) | `inset 0 0 150px 30px` | `inset 0 0 58px 10px` | `inset 0 0 40px 8px` |
| Icon size | 140px | 120px | 92px |
| Wordmark | 26px | 22px | 18px |
| Subtitle | 14px | 13px | 13px |

## Interactions & Behavior
- No user interaction — purely a loading/wait state.
- On boot complete, cross-fade or swap this screen out for the real app shell (not specified/prototyped here — designer's call, a simple opacity fade is reasonable).
- No animation on the glow at any breakpoint. (If a future iteration wants motion back, keep it desktop-only and validate at 4K/ultrawide first — see Known Constraints.)

## State Management
- Single boolean state in the app shell, e.g. `isBooting` — render this loader while true, real app once app-ready fires (auth check, initial data fetch, etc. — whatever currently gates first paint).
- No other state needed for the loader itself.

## Known Constraints / Do Not Regress
- Do **not** reintroduce a rotating conic-gradient glow on tablet/mobile — it was tested and produces a visible hard diagonal fold once masked to a portrait aspect ratio (see `Desktop Glow Stress Test.html` and iteration history if available).
- Do **not** size the glow with fixed px values if you ever revisit desktop-only motion — fixed-px blur/shadow becomes imperceptible at 4K and renders unevenly (concentrated only at corners) on ultrawide monitors when combined with a circular mask. This iteration deliberately avoids the issue entirely by keeping the glow static and shadow-based across all breakpoints.

## Design Tokens
- Background: `#F4F1ED` (warm off-white, app's standard bg)
- Text primary: `#1A1A2E`
- Text secondary: `#4B5563`
- Brand purple (glow): `#3D1A8A`
- Brand gold (glow): `#F4A71F`
- Font: Sora (400, 700), loaded via Google Fonts `family=Sora:wght@400;700`

## Assets
- `alice-sigil-full.svg` — full-color Project Alice sigil (gold star, broken ring, purple road). Sourced from the project's existing brand assets — use the app's existing brand-asset copy rather than re-exporting.

## Files
- `startup-loader.html` — standalone, self-contained reference implementation (desktop layout; open directly in a browser).
