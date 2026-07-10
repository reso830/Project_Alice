# Feature Specification: Hosted Startup Performance

**Feature Branch**: `044-hosted-startup-performance`  
**Created**: 2026-07-04  
**Status**: Draft  
**Input**: docs/features/2.0.0-smart-intake-ai-assistance/044-hosted-startup-performance.md

---

## Clarifications

### Session 2026-07-04

- **Q: Workstream scope for this feature** → A: **WS0–WS5 are all phases of feature 044**, dependency-ordered, with **WS4 (route-level lazy loading) as the final phase**. WS4 is split into its own feature only if its phase review shows it ballooning. WS4 is **not** issue #109 — WS4 trims the initial JS bundle (dynamic-import of `Calendar` / `Profile` / `ProfileEdit`), whereas #109 is warm, post-boot application-card click latency (a separate INP concern).
- **Q: Parallel handshake vs. the signed-out `/api/health` cold start** → A: **Optimistic signed-out routing (Option 1)**. `bootstrap()` starts `getHealth()` and `authStore.init()` concurrently. As soon as the session resolves as **signed-out**, hand off to Welcome **without requiring the health result** — signed-out visitors never wait on the health cold start. Rationale grounded in current code (`runtimeHandshake`, `main.js`): ConfigError fires only when `health.runtime === 'hosted' && !hostedAuthAvailable`; `hostedAuthAvailable` is a synchronous client-side env-var check, so the health round-trip only affects routing when env vars are **missing** — and in that case `authStore.init()` also fails to construct a Supabase client, so ConfigError is still reached independently. Guardrails: route signed-out → Welcome only *after* the session resolves; never mount the app shell before the session confirms signed-in; Welcome must remain backend-independent (revisit if it ever gains an `/api/health` dependency).
- **Q: Boot-timeout Retry affordance behavior** → A: **Full page reload** (`window.location.reload()`), timeout **~10s**. Chosen for robustness (clean state, another cold-start attempt) and because a reload fetches a fresh bundle, which also recovers the WS4 "deploy mid-session invalidated hashed chunks" case. Re-running the handshake in place was rejected as more complex and unable to recover from a stale/failed bundle.
- **Q: Relationship to 042 (Welcome & Brand Refresh) brand assets** → A: **044 assumes 042 merges first.** The inlined loader reuses 042's `alice-sigil-full.svg` and its Sora font setup rather than re-introducing its own copies. This sequencing dependency is a documented prerequisite for WS1.
- **Q: Are the FCP < ~1.5s / LCP < ~4s targets hard acceptance gates?** → A: **Directional, not hard gates.** The hard acceptance criterion is a **documented, measured improvement** in hosted FCP and LCP against the recorded baseline (FCP ~8s / LCP ~13.5s). The free-tier serverless cold-start floor is called out explicitly wherever it caps results.

### Session 2026-07-05

- **Design update — startup-loader glow is now STATIC.** The revised `HostedAlice_StartupLoader/` handoff drops the rotating conic-gradient edge glow in favor of a **static two-layer inset `box-shadow`, with no motion at any breakpoint** (rotation was rejected for seaming on portrait aspect ratios and degrading at 4K/ultrawide). Consequence for requirements: `prefers-reduced-motion` no longer "disables the glow spin" (there is none) — it now governs only the loader→app transition (instant swap vs. crossfade). The handoff also specifies **three responsive breakpoints**: icon 140/120/92px, wordmark 26/22/18px, subtitle 14/13/13px, with scaled glow shadows (desktop / tablet-portrait / mobile-portrait).

### Session 2026-07-05 (plan-review pass)

- **Q: Plan review found that "Option 1" optimistic routing can leak the real app shell on a misconfigured hosted deploy — how is it fixed?** → A: **Scope the no-health-wait behavior to the `authenticated` and `unauthenticated` outcomes only** — the two outcomes reached via a genuine `supabase.auth.getSession()` network call, only possible when `isHostedAuthAvailable === true`. The `local-mode` outcome — which `authStore.init()` sets **synchronously, with no network call**, whenever `isHostedAuthAvailable` is false — continues to **wait for `getHealth()` to resolve** before mounting the shell, exactly as today. Rationale: `local-mode` is the one outcome that's genuinely ambiguous (it fires both for an intentional local/portable build *and* for a hosted deploy missing its build-time env vars), and only the server-side health response can disambiguate the two; gating it costs nothing for real local/portable users since local health resolves near-instantly and this feature doesn't target that runtime anyway.
- **Q: WS3 skeleton — new component or reuse an existing one?** → A: **Reuse.** `src/utils/skeletons.js` already ships `buildApplicationListSkeleton` / `buildProfileSkeleton` / `buildCalendarSkeleton`, used today by Tracker/Profile/Calendar. WS3 adds a boot-skeleton builder to this same file rather than introducing a new component, avoiding a duplicate skeleton system.
- **Q: How do Footer/UpdateToast pick up the health result if it resolves after the shell has already mounted?** → A: **Explicit remount, not an in-place patch.** Neither exposes an update API today (`Footer.render()` is a one-shot factory; `UpdateToast.mount({health})` bails out entirely when `health` is null/`updateSupported` is falsy). When health resolves after the shell is already mounted, `main.js` replaces the footer element with a fresh `Footer.render({runtime})` call and re-invokes `UpdateToast.mount()` (after `destroy()`) with the resolved health, re-evaluating the update-controller subscription.
- **Q: WS4 — what does the workspace/nav show while a route chunk is loading?** → A: **Optimistic tab highlight + interim loading state.** `navigate()` updates `_currentPage` / `Navbar.setActive` / `BottomTabBar.setActive` immediately, before awaiting the dynamic import, and shows the WS3 skeleton in the workspace while the chunk downloads; the real page swaps in on resolve, or the active state reverts with a retry affordance on `import()` failure.
- **Q: Any risk from the loader's CSS class names?** → A: **Scope them.** Both the startup-loader and in-app-loader design handoffs independently prototype the bare class name `.edge-glow`. WS1 uses scoped names (e.g. `.startup-loader__edge-glow`) rather than the bare handoff names, to avoid a future collision if 042's in-app loader implementation adopts the same literal name.
- **Q: How does the loader's fade-out actually play, given `mountWelcome()` / `mountAppShell()` / `mountConfigError()` call `clearBody()` synchronously?** → A: **Deferred removal.** Loader teardown applies an exiting/fade CSS class and defers the actual `clearBody()` call until the transition completes (`transitionend`, with a timeout fallback); under `prefers-reduced-motion` the transition duration is zero and removal is immediate.

### Session 2026-07-07

- **Q: `index.html` is a single shared static file — how is the inlined loader actually kept hosted-only, given local/portable serve the same build output?** → A: **Strip it server/build-side for every non-hosted path, don't just accept a flash.** There are **three** serving paths, not two: (1) hosted (Vercel) serves the built `dist/index.html` straight from the CDN per `vercel.json` (only `/api/:path*` is rewritten to the function) — Express never touches it; (2) portable serves the built `dist/index.html` through `server/index.js`'s `serveStatic` catch-all (`res.sendFile(path.join(distDir, 'index.html'))`); (3) local dev (`npm run dev`, the primary GitHub-checkout workflow) serves the **source** `index.html` directly via Vite's dev server, bypassing both Vercel and `server/index.js` entirely — a first pass at this fix covered only (1)/(2) and missed (3). WS1 wraps the loader markup in `index.html` with HTML comment markers (e.g. `<!-- STARTUP-LOADER:START -->…<!-- STARTUP-LOADER:END -->`) and addresses each: hosted's CDN copy is untouched; `server/index.js`'s catch-all strips the marked block when `!config.isHosted` (portable); a Vite `transformIndexHtml` plugin with `apply: 'serve'` strips the same block for `npm run dev` (local dev) — it never runs during `vite build`, so the build output (consumed by both hosted and portable) is unaffected. Result: local dev and portable never receive the loader markup at all — no flash, no client-side teardown race, in either.
- **Q: Are WS3 (Tracker skeleton), WS4 (lazy-loaded routes), and WS5 (font loading) also hosted-only?** → A: **No — shared across all runtimes, by design.** Unlike WS1/WS2, none of WS3–WS5 reintroduce a network wait or otherwise slow local/portable: the skeleton is a presentational placeholder shown for the same near-instant local data fetch, the lazy-loaded chunks are served from local disk in portable mode, and the font-loading change only removes a render-blocking third-party request (a strict improvement everywhere). Scoping them hosted-only would require runtime branching in `navigate()`, `mountAppShell()`, and the font `<link>` for no behavioral benefit.

- **Q: WS5 font strategy — self-host or preload?** → A: **Self-host**, via `@fontsource/sora` + `@fontsource/dm-mono`. Chosen over `<link rel=preload>` because it removes the third-party `fonts.googleapis.com`/`fonts.gstatic.com` origin entirely (not just makes it non-blocking) and is more consistent with the local-first principle. Imported through `src/styles/main.css`, bundled by Vite into the same CSS output already loaded asynchronously relative to first paint — no new render-blocking resource. No open clarifications remain.

---

## Problem Statement

On a cold load of **hosted** Project Alice, nothing paints until the JS bundle downloads and executes, and then `bootstrap()` blocks first paint behind **two sequential network round-trips** — `runtimeHandshake()` → `getHealth()` (which pays a serverless cold start) followed by `authStore.init()` → `supabase.auth.getSession()` — before the Tracker data fetch even begins. Vercel Speed Insights reports roughly **FCP ~8s** and **LCP ~13.5s**. The cause is architectural (an empty `<div id="app">` plus sequential boot gating), not merely free-tier hosting.

This feature (1) replaces the blank white boot screen with a branded loader inlined into `index.html` that paints **before any JS**, (2) reworks the boot handshake so first *content* arrives sooner and the signed-out path stops paying a cold start it does not need, (3) introduces a reusable loading-skeleton primitive for the signed-in handoff, and (4) — as later phases — trims the initial bundle and removes the render-blocking font request. Local, portable, and demo boot are already fast and are explicitly out of scope for the runtime changes.

---

## Scope

### In Scope

- **WS0 — Baseline measurement**: capture hosted field metrics (Speed Insights p75 FCP/LCP/CLS/INP/TTFB) and a lab DevTools Performance trace on a **cold** load, segmented (TTFB, bundle download, parse/exec, `/api/health`, `getSession`, Tracker fetch), with **cold vs. warm** `/api/health` isolated. Re-run after each subsequent phase. Record before/after numbers in the feature docs.
- **WS1 — Inlined startup loader**: loader markup + critical CSS live directly inside `<div id="app">` in `index.html` so first paint does not wait on `main.js`. Recreates the high-fidelity startup-loader handoff (centered sigil + "Project Alice" wordmark + status line over `#F4F1ED`, with a **static** ambient purple/gold edge glow — a plain inset box-shadow, **no motion at any breakpoint**). Responsive across desktop / tablet-portrait / mobile-portrait breakpoints (icon 140/120/92px, wordmark 26/22/18px). The sigil is inlined as `<svg>` (or data URI) — no extra fetch, not an LCP candidate. Status line carries `role="status"` / `aria-live="polite"`. Reuses 042's brand sigil (see Clarifications). The loader markup is delimited by HTML comment markers so `server/index.js`'s portable static-serving route and a Vite dev-server plugin can each strip it before responding — hosted's CDN-served static file is untouched (see Clarifications, 2026-07-07).
- **WS2 — Bootstrap rework (parallel + optimistic handshake)**: `bootstrap()` runs `getHealth()` and `authStore.init()` concurrently. **Only the two network-backed outcomes** — signed-out (`unauthenticated`) and signed-in (`authenticated`), both reached via a genuine `getSession()` call — route immediately without requiring health. The `local-mode` outcome (which resolves synchronously with no network call) continues to **wait for health** before mounting, preserving ConfigError safety for a misconfigured hosted deploy (env-var/session-failure path). The inlined loader covering the window removes the "flash of Welcome before ConfigError" concern that currently forces the sequential ordering (Task 08.3).
- **WS3 — App-shell + Tracker skeleton**: the signed-in handoff renders the shell + a Tracker skeleton before data lands; real application data hydrates in. The skeleton is added to the **existing** `src/utils/skeletons.js` builder set (alongside `buildApplicationListSkeleton` etc.) — not a new component — and issue #109 will later consume it from there.
- **WS4 — Route-level lazy loading** *(final phase; may split to its own feature if it balloons)*: dynamic-import `Calendar`, `Profile`, `ProfileEdit` in `navigate()`; keep `Tracker` (landing route) eager. `navigate()` updates the active-tab highlight immediately (before awaiting the import) and shows the WS3 skeleton in the workspace while the chunk loads. Requires latest-wins race guarding and chunk-load-failure handling.
- **WS5 — Font loading**: self-host or preload Sora so the render-blocking Google Fonts request leaves the critical path.
- **Boot timeout / error state**: a ~10s loader timeout surfaces a "taking longer than expected / Retry" affordance; Retry performs a full page reload. Wired to the existing network-error / ConfigError paths — no infinite spinner.
- **Measurement discipline** (WS0) re-run before/after each phase; bundle visualizer before WS4.

### Non-Goals

- **No change to local / portable / demo boot** — those are local-first and already fast; the loader and handshake parallelization target the **hosted** runtime only. Local dev and portable never receive the loader markup at all (stripped at the Vite dev-server and Express-serving layers respectively, see Clarifications 2026-07-07) — there is no flash to fast-path past in either. WS3–WS5 are shared across all runtimes by design (see Clarifications 2026-07-07), not scoped hosted-only.
- **Issue #109 (application-card click latency) is out of scope** — a separate issue with a different journey (warm click), latency source (detail-fetch round-trip), and metric (INP). 044 only *ships* the WS3 skeleton (added to `src/utils/skeletons.js`) #109 will consume; it does not implement #109's click feedback.
- **No client-side URL-path router** — continue standard tab/state switching, consistent with 042.
- **No hosting-tier or database-provider migration** — the free-tier serverless cold-start is a floor to design around, not to eliminate.
- **No visual redesign beyond the loader itself** — brand assets come from 042.
- **No new analytics or tracking** — the loader is client-only; Vercel Speed Insights is unchanged (page-level metrics only, no application data/PII).

---

## User Behavior & Stories

Each story has an **Independent Test** exercised in the final Browser Smoke Test phase.

- **US0 — Baseline is measured (WS0).** As the team, before any change I capture the hosted FCP/LCP baseline and a segmented cold trace so later gains are provable.
  - **Independent Test**: On the current hosted deploy, record Speed Insights p75 FCP/LCP and a cold DevTools trace; confirm the numbers are written into the feature docs as the baseline.

- **US1 — Branded first paint (WS1).** As a hosted visitor, on first open I immediately see a branded loader instead of a blank white page.
  - **Independent Test**: Cold-load the hosted URL with cache disabled; confirm the branded loader (sigil + wordmark + status line + static edge glow) paints near-instantly, before the JS bundle finishes, and that no blank white screen precedes it. Repeat at **desktop, tablet-portrait, and mobile-portrait** widths and confirm the loader stays centered and scales per the handoff breakpoints (icon 140/120/92px, wordmark 26/22/18px, subtitle 14/13/13px, glow shadow scaled) with no clipping or overflow.

- **US2 — Signed-out reaches Welcome fast (WS2).** As a signed-out visitor (with hosted auth properly configured), the loader hands off to Welcome without waiting on the `/api/health` cold start.
  - **Independent Test**: Signed-out cold load on a **correctly configured** hosted deploy; confirm handoff to Welcome occurs once the session resolves via `getSession()` and does **not** block on health; confirm a measured LCP improvement vs. baseline.

- **US3 — Signed-in sees a skeleton, then data (WS3).** As a signed-in user, the loader hands off to the app shell with a Tracker skeleton, and real data hydrates into it.
  - **Independent Test**: Signed-in cold load; confirm the shell + Tracker skeleton (built via `src/utils/skeletons.js`) render before data, then application rows replace the skeleton when data arrives — with no blank gap between loader and shell. Confirm the Footer/UpdateToast reflect the health result once it resolves, even if it resolves after the shell has already mounted.

- **US4 — Boot failure is recoverable (timeout).** As a visitor hitting a stalled/failed cold start, after a short wait I get a Retry affordance instead of an endless spinner.
  - **Independent Test**: Simulate a boot stall/failure (e.g. block `/api/health` and the session call); confirm that after ~10s the loader shows "taking longer than expected / Retry" and that Retry reloads the page.

- **US5 — Misconfigured deploy still shows ConfigError.** As a visitor to a hosted deploy that's missing its build-time Supabase env vars, I reach ConfigError without a flash of Welcome or the (local-mode) app shell — even though `authStore.init()` resolves to `local-mode` **synchronously**, faster than `getHealth()`.
  - **Independent Test**: With hosted env vars removed at build time, cold-load; confirm the loader stays up until `getHealth()` resolves (it does **not** mount the shell for the fast-resolving `local-mode` state), then ConfigError mounts with neither Welcome nor the app shell flashing first.

- **US6 — Reduced motion respected.** As a visitor with `prefers-reduced-motion`, the loader presents no motion — its glow is static by design, and the loader→app transition does not animate.
  - **Independent Test**: Enable reduced-motion at the OS/browser level; cold-load hosted; confirm the loader renders with a static glow (no motion) and that the handoff to Welcome/shell uses no motion (instant swap rather than a crossfade).

- **US7 — Lighter initial bundle (WS4).** As a hosted visitor, the initial download excludes routes I have not visited yet.
  - **Independent Test**: Inspect the network panel / bundle visualizer; confirm `Calendar` / `Profile` / `ProfileEdit` load as separate chunks on navigation while `Tracker` is in the initial bundle; confirm the target tab highlights immediately and a skeleton shows while the chunk loads (no blank workspace with a stale active tab); confirm navigation still works and a failed chunk load degrades gracefully (active state reverts / retry offered).

- **US8 — Non-blocking fonts (WS5).** As a hosted visitor, the render-blocking Google Fonts request is off the critical path.
  - **Independent Test**: Confirm Sora is self-hosted or preloaded and that no render-blocking third-party font stylesheet sits on the critical path; confirm the loader background + sigil paint independent of Sora (text may swap in).

---

## Acceptance Criteria

- Hosted **FCP** and **LCP** show a meaningful, **measured** reduction vs. the documented baseline (aspirational p75 targets FCP < ~1.5s, LCP < ~4s), with the free-tier cold-start floor called out where it caps results. Before/after metrics are recorded in the feature docs.
- The blank white boot page is **eliminated** on hosted; a branded loader paints near-instantly (WS1).
- The signed-out and signed-in paths (both reached via a genuine `getSession()` call) route **without blocking on** the `/api/health` cold start, and the app shell never mounts before the session confirms signed-in via that network call (WS2).
- The synchronously-resolving `local-mode` outcome **continues to wait for `getHealth()`** before mounting, so a hosted deploy missing its build-time env vars cannot flash the local-mode shell before ConfigError takes over.
- The signed-in path renders the app shell + Tracker skeleton (via `src/utils/skeletons.js`) before data, then hydrates real data in; Footer/UpdateToast reflect the health result whenever it resolves, including after the shell has already mounted (WS3).
- Boot failure surfaces a Retry affordance (full page reload) after ~10s — **never an infinite spinner**.
- A misconfigured hosted deploy still reaches **ConfigError** with no flash of Welcome/app, including the local-mode shell.
- The loader glow is static (no motion) at every breakpoint; under `prefers-reduced-motion` the loader→app transition also does not animate.
- The loader renders correctly across **desktop, tablet-portrait, and mobile-portrait** breakpoints — centered, scaled per the handoff (icon 140/120/92px, wordmark 26/22/18px, subtitle 14/13/13px, glow shadow scaled), with no clipping or overflow.
- (WS4) `Calendar` / `Profile` / `ProfileEdit` are code-split out of the initial bundle; `Tracker` stays eager; navigation races are latest-wins guarded and chunk-load failures handled.
- (WS5) No render-blocking third-party font request remains on the critical path.
- **Local / portable / demo boot behavior is unchanged.**
- Accessibility intact: loading state announced (`role="status"` / `aria-live`), reduced-motion respected, keyboard navigation and labels preserved.
- All unit, integration, and build tests pass; lint clean.

---

## Edge Cases

- **Cold-start failure or hang** → ~10s timeout → Retry (full reload); never an infinite spinner.
- **Misconfigured hosted deploy (env vars missing at build time)** → `authStore.init()` resolves to `local-mode` **synchronously** (no network call), faster than `getHealth()` — this outcome is explicitly held behind the health result rather than mounted immediately, so the shell/local-mode UI cannot flash before ConfigError overrides.
- **Signed-out visitor + misconfigured deploy** → since `isHostedAuthAvailable` is false, `authStore.init()` cannot reach `unauthenticated` via a real session call either — it resolves `local-mode` and is covered by the case above; ConfigError is reached, not a leaked Welcome/shell.
- **Health resolves after the shell has already mounted (signed-in/authenticated path)** → Footer and UpdateToast do not have an in-place patch API; `main.js` replaces the footer element and re-invokes `UpdateToast.mount()`/the update-controller subscription once health resolves.
- **Deploy mid-session invalidates hashed chunks** (WS4) → `import()` rejection handled with a retry / full-reload fallback (the Retry reload also fetches fresh chunks); the optimistically-highlighted tab reverts if the import fails.
- **Rapid navigation races** once `navigate()` is async (WS4) → latest-wins guard; the dirty-check (`ProfileEdit.confirmNavigation`) and `page === _currentPage` early-return must run **before** any `await`; the active-tab highlight and workspace skeleton update immediately (before the `await`), not after the chunk resolves.
- **`prefers-reduced-motion`** → the loader glow is already static (no motion at any breakpoint); reduced-motion additionally suppresses any loader→app crossfade (instant swap, zero-duration transition, immediate `clearBody()`).
- **Handoff branches** → the loader must resolve correctly to signed-out (Welcome, via `getSession()`), signed-in (shell + skeleton, via `getSession()`), local/demo (fast path, gated behind health per above), and config-error, with no flash between states.
- **Loader teardown vs. synchronous `clearBody()`** → `mountWelcome()` / `mountAppShell()` / `mountConfigError()` defer the actual `clearBody()` call until the loader's exit transition completes, rather than clearing immediately underneath a CSS fade.
- **Font swap / FOUT** (WS5) → loader background + sigil paint independent of Sora; text may swap in.
- **Very slow / flaky networks** → loader + timeout degrade gracefully; the loader never hides real content it is still waiting for.
- **Loader LCP hygiene** → keep the wordmark modest (26px) so it never becomes a distorting LCP candidate; the inline SVG is not a candidate; a large full-screen splash is avoided.

---

## Data Considerations

- **No application data is created, read, or mutated** by this feature; the constitution's required fields (company name, job title, status, `lastStatusUpdate`, responsibilities) are untouched. The changes are confined to the boot path, first paint, bundle splitting, and font loading.
- **No new analytics or tracking.** The loader is client-only. Vercel Speed Insights (already sanctioned under constitution Amendment 1.5.0) continues to report page-level Core Web Vitals from the hosted production deployment only — no application data or PII — and is not expanded by this feature.
- **Measurement artifact** stores only aggregate performance numbers (FCP/LCP/CLS/INP/TTFB and trace timings); it contains no user or application data.
- **Auth/session handling is unchanged in substance** — parallelizing `getHealth()` and `authStore.init()` reorders *when* the existing calls run, not *what* they send; server-side RLS and the session gate remain the authority for any authenticated data access. No authenticated content is rendered before the session resolves.
- **Local-first preserved**: all runtime changes are hosted-only; a local/GitHub checkout boots unchanged.

---

## Dependencies & Sequencing

- **042 (Welcome & Brand Refresh) must merge first** — WS1's inlined loader reuses 042's `alice-sigil-full.svg` and Sora setup. Building 044 on top of un-merged 042 would duplicate or diverge those assets.
- **Issue #109** depends on **044/WS3's skeleton builder in `src/utils/skeletons.js`** — coordinate so only one skeleton system exists; #109 waits for or explicitly reuses it. (#109 may prove lighter than a skeleton — an instant row-highlight + spinner — in which case the shared-component link is nice-to-have, not a blocker.)

---

## Related

- **docs/features/2.0.0-smart-intake-ai-assistance/044-hosted-startup-performance.md** — feature brief (source of this spec).
- **Design reference**: `HostedAlice_StartupLoader/design_handoff_startup_loader/` (startup loader — WS1) and `design_handoffs/Alice_InAppLoader/` (in-app loader pattern, informs the WS3 skeleton feel). Visuals are final; integration guidance is superseded by this spec (inline in HTML, not a JS-rendered component).
- **042 Welcome & Brand Refresh** — source of the brand sigil + Sora.
- **Issue #109** — application-card click latency (separate; consumes the WS3 skeleton builder from `src/utils/skeletons.js`).
