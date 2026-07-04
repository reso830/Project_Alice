# Feature Brief: 044 - Hosted Startup Performance

## Summary
Fix the slow first-load experience of **hosted** Project Alice. Vercel Speed Insights currently reports roughly **FCP ~8s** and **LCP ~13.5s**. The root cause is architectural, not just free-tier hosting: `index.html` ships an empty `<div id="app">`, so nothing paints until the JS bundle loads and executes — and then `bootstrap()` blocks first paint behind **two sequential network round-trips** (`getHealth()` → `/api/health`, which pays a serverless cold start, then `authStore.init()` → `supabase.auth.getSession()`) before the Tracker data fetch even begins.

This feature replaces the blank white boot screen with a branded loader that paints **before any JS**, decouples first paint from the boot round-trips, and hands off cleanly to the Welcome page (signed-out) or the app shell (signed-in). Local and portable modes are already fast and are explicitly out of scope for the runtime changes.

---

## Goals
- Meaningfully reduce hosted **FCP** and **LCP** against a measured baseline (FCP 8s / LCP 13.5s today), and document the before/after numbers.
- Replace the blank white boot page with an inlined, branded **startup loader** that paints before the JS bundle loads.
- Decouple first *content* paint from the sequential boot round-trips so the loader is **brief**, not a prettier 13-second wait.
- Stop the signed-out path from paying the `/api/health` cold start it does not need before the Welcome page.
- Introduce a reusable **loading-skeleton primitive** for the signed-in handoff (shared with issue #109).
- Establish a repeatable measurement discipline (field + lab) run before and after each phase.

---

## Non-Goals
- **No change to local / portable / demo boot** — those are local-first and already fast; the loader and parallelization target hosted only.
- Not introducing a client-side URL-path router (continue standard tab/state switching, consistent with 042).
- Not fixing in-app application-card click latency — that is **issue #109**, a separate interaction-latency concern. This feature only *provides the shared skeleton primitive* #109 will consume.
- Not migrating hosting tier or database provider. The free-tier serverless cold-start is treated as a floor to design around, not to eliminate.
- Not a visual redesign beyond the loader itself (brand assets come from 042).

---

## User Experience
- **On hosted open**: an instant branded loader (Alice sigil + "Project Alice" wordmark + status line, over the cream background with a **static** ambient purple/gold edge glow — no motion at any breakpoint) appears immediately, replacing today's blank white page. Responsive across desktop/tablet/mobile; `prefers-reduced-motion` governs only the loader→app transition.
- **Signed out** → loader hands off to the **Welcome page** as soon as the session resolves, without waiting on the health check / cold start.
- **Signed in** → loader hands off to the **app shell with a Tracker skeleton**; real application data hydrates into the skeleton when it arrives.
- **Misconfigured hosted deploy** → ConfigError (unchanged behavior), reached without a flash of Welcome/app.
- **Boot stalls or fails** (e.g. cold-start error) → after a short wait the loader shows a "taking longer than expected / Retry" affordance instead of spinning forever.

---

## Functional Requirements
- **Inlined static loader**: loader markup + critical CSS live directly inside `<div id="app">` in `index.html` so first paint does not wait on `main.js`. The sigil is inlined as `<svg>` (or data URI) — no extra network fetch, and not an LCP candidate. Status line carries `role="status"` / `aria-live="polite"`.
- **Parallel + optimistic handshake**: `bootstrap()` runs `getHealth()` and `authStore.init()` concurrently instead of sequentially, deciding the destination once both resolve. The loader covering the window removes the "flash of Welcome before ConfigError" concern that currently forces the sequential ordering (Task 08.3).
- **App-shell skeleton**: signed-in handoff renders the shell + Tracker skeleton before data lands; Tracker data hydrates in. Introduce this skeleton as a **reusable primitive** (#109 dependency).
- **Boot timeout / error state**: a loader timeout (~8–10s) surfaces a retry/error affordance wired to the existing network-error / ConfigError paths — no infinite spinner.
- **Hosted-only scoping**: the loader and handshake parallelization apply to the hosted runtime; local/demo boot is unchanged (or fast-pathed past the loader).
- **(Optional phase) Route-level lazy loading**: dynamic-import `Calendar`, `Profile`, `ProfileEdit` in `navigate()`; keep `Tracker` (landing route) eager. Requires latest-wins race guarding and chunk-load-failure handling.
- **(Optional phase) Font loading**: self-host or preload Sora so the render-blocking Google Fonts request leaves the critical path.

---

## Technical Notes
- **Boot path today**: `DOMContentLoaded` → `bootstrap()` → `await runtimeHandshake()` (`getHealth`) → `await authStore.init()` (`getSession`) → `render()` → `mountAppShell()` → `navigate('tracker')` → Tracker data fetch. FCP ≈ everything up to `render()`; LCP ≈ + Tracker data.
- **Proposed phasing** (dependency-ordered; WS1+WS2 are one deliverable in two commits). Impact / effort noted per phase:
  - **WS0 — Baseline measurement** — prerequisite; re-run after each phase.
  - **WS1 — Startup loader inlined in `index.html`** (FCP, perceived) — *High impact / Low effort*; depends on WS0.
  - **WS2 — Bootstrap rework: parallel + optimistic handshake, handoff to Welcome / shell / ConfigError** (LCP, real wait — esp. signed-out) — *High / Med*; unlocked by WS1.
  - **WS3 — App-shell + Tracker skeleton primitive** (signed-in LCP/feel) — *Med-High / Med*; depends on WS2, coordinates with #109.
  - **WS4 — Route-level lazy loading via async `navigate()`** (bundle/parse) — *Med / Med*; independent; may split to its own feature if it balloons.
  - **WS5 — Font loading (self-host / preload Sora)** (FCP tail) — *Low / Low*; independent.
- **Expected per-phase movement** (what WS0 measurement must confirm): WS1 → FCP collapses (~8s → ~1s), LCP roughly unchanged (the loader now covers the same real wait); WS2 → LCP drops, signed-out especially (parallel `max(...)` instead of a sequential sum, and the signed-out path skips the health cold start); WS3 → signed-in LCP/feel improves (skeleton paints before data); WS4 → parse/download tail shrinks.
- **Measurement**: Speed Insights p75 (FCP/LCP/CLS/INP/TTFB); DevTools Performance trace on a **cold** load, segmenting TTFB / bundle download / parse-exec / `/api/health` / `getSession` / Tracker fetch; **cold vs warm** `/api/health` isolated to separate architecture from the free-tier floor; bundle visualizer before WS4.
- **Constitution alignment**: no new analytics/tracking (loader is client-only); explicit loading/error states; a11y (`role="status"`, reduced-motion, keyboard/labels intact); local-first preserved (hosted-only runtime change).
- **LCP hygiene**: keep the loader wordmark modest (26px) so it never becomes a distorting LCP candidate; inline SVG is not a candidate; a large full-screen splash is explicitly avoided.

---

## Edge Cases
- **Cold-start failure or hang** → timeout/retry state; never an infinite spinner.
- **Deploy mid-session** invalidating hashed chunks (if WS4 ships) → `import()` rejection handled with retry / full-reload fallback.
- **Rapid navigation races** once `navigate()` is async → latest-wins guard; dirty-check (`ProfileEdit.confirmNavigation`) and `page === _currentPage` early-return must run *before* any `await`.
- **`prefers-reduced-motion`** → loader glow is already static (no motion at any breakpoint); suppress any loader→app crossfade (instant swap).
- **Handoff branches** → loader must resolve correctly to signed-out (Welcome), signed-in (shell), demo/local (fast path), and config-error, with no flash.
- **Font swap / FOUT** → loader background + sigil paint independent of Sora; text may swap in.
- **Very slow / flaky networks** → loader + timeout must degrade gracefully.

---

## Success Criteria
- Hosted **FCP** and **LCP** show a meaningful, measured reduction vs. the documented baseline (aspirational p75 targets: FCP < ~1.5s, LCP < ~4s), with the free-tier cold-start floor called out explicitly where it caps results.
- The blank white boot page is eliminated on hosted; a branded loader paints near-instantly.
- Boot failure surfaces a retry/error affordance — no infinite spinner.
- Signed-out visitors reach Welcome without blocking on the `/api/health` cold start.
- Local and portable boot behavior is unchanged.
- Accessibility intact (loading state announced, reduced-motion respected, keyboard/labels preserved).
- Before/after metrics captured and recorded in the feature docs.
- All unit, integration, and build tests pass; lint clean.

---

## Related
- **Issue #109** (application-card click latency) — **stays a separate issue**, not folded into 044: different journey (a warm click, not a cold boot), different latency source (the detail-fetch round-trip on click), and different metric (interaction latency / INP, not FCP/LCP). The *only* real overlap is the **loading-state primitive**: WS3 owns and ships the reusable skeleton; #109 consumes it for the card→detail pending state and should wait for (or explicitly reuse) it, so the two never diverge into separate skeleton systems. Caveat: #109 may turn out lighter than a skeleton — an instant row-highlight + inline spinner — in which case the shared-component link is nice-to-have, not a blocker; if #109 is already mid-flight on its own approach, don't retrofit it onto 044's timeline.
- **042 Welcome & Brand Refresh** — source of brand assets (sigil, wordmark) used by the loader.
- Design handoff prototype: `HostedAlice_StartupLoader/design_handoff_startup_loader/` (visuals final; integration guidance superseded by this brief — inline in HTML, not a JS-rendered component).
