# Feature Specification: Hosted Startup Performance

**Feature Branch**: `044-hosted-startup-performance`  
**Created**: 2026-07-04  
**Status**: Draft  
**Input**: docs/features/044-hosted-startup-performance.md

---

## Clarifications

### Session 2026-07-04

- **Q: Workstream scope for this feature** → A: **WS0–WS5 are all phases of feature 044**, dependency-ordered, with **WS4 (route-level lazy loading) as the final phase**. WS4 is split into its own feature only if its phase review shows it ballooning. WS4 is **not** issue #109 — WS4 trims the initial JS bundle (dynamic-import of `Calendar` / `Profile` / `ProfileEdit`), whereas #109 is warm, post-boot application-card click latency (a separate INP concern).
- **Q: Parallel handshake vs. the signed-out `/api/health` cold start** → A: **Optimistic signed-out routing (Option 1)**. `bootstrap()` starts `getHealth()` and `authStore.init()` concurrently. As soon as the session resolves as **signed-out**, hand off to Welcome **without requiring the health result** — signed-out visitors never wait on the health cold start. Rationale grounded in current code (`runtimeHandshake`, `main.js`): ConfigError fires only when `health.runtime === 'hosted' && !hostedAuthAvailable`; `hostedAuthAvailable` is a synchronous client-side env-var check, so the health round-trip only affects routing when env vars are **missing** — and in that case `authStore.init()` also fails to construct a Supabase client, so ConfigError is still reached independently. Guardrails: route signed-out → Welcome only *after* the session resolves; never mount the app shell before the session confirms signed-in; Welcome must remain backend-independent (revisit if it ever gains an `/api/health` dependency).
- **Q: Boot-timeout Retry affordance behavior** → A: **Full page reload** (`window.location.reload()`), timeout **~10s**. Chosen for robustness (clean state, another cold-start attempt) and because a reload fetches a fresh bundle, which also recovers the WS4 "deploy mid-session invalidated hashed chunks" case. Re-running the handshake in place was rejected as more complex and unable to recover from a stale/failed bundle.
- **Q: Relationship to 042 (Welcome & Brand Refresh) brand assets** → A: **044 assumes 042 merges first.** The inlined loader reuses 042's `alice-sigil-full.svg` and its Sora font setup rather than re-introducing its own copies. This sequencing dependency is a documented prerequisite for WS1.
- **Q: Are the FCP < ~1.5s / LCP < ~4s targets hard acceptance gates?** → A: **Directional, not hard gates.** The hard acceptance criterion is a **documented, measured improvement** in hosted FCP and LCP against the recorded baseline (FCP ~8s / LCP ~13.5s). The free-tier serverless cold-start floor is called out explicitly wherever it caps results.

#### Open clarifications (do not block WS0–WS3; resolve before the phase that needs them)
- **WS5 font strategy** — self-host Sora vs. `<link rel=preload>` of the Google Fonts stylesheet is left to the WS5 plan; either satisfies "remove render-blocking font request from the critical path."

---

## Problem Statement

On a cold load of **hosted** Project Alice, nothing paints until the JS bundle downloads and executes, and then `bootstrap()` blocks first paint behind **two sequential network round-trips** — `runtimeHandshake()` → `getHealth()` (which pays a serverless cold start) followed by `authStore.init()` → `supabase.auth.getSession()` — before the Tracker data fetch even begins. Vercel Speed Insights reports roughly **FCP ~8s** and **LCP ~13.5s**. The cause is architectural (an empty `<div id="app">` plus sequential boot gating), not merely free-tier hosting.

This feature (1) replaces the blank white boot screen with a branded loader inlined into `index.html` that paints **before any JS**, (2) reworks the boot handshake so first *content* arrives sooner and the signed-out path stops paying a cold start it does not need, (3) introduces a reusable loading-skeleton primitive for the signed-in handoff, and (4) — as later phases — trims the initial bundle and removes the render-blocking font request. Local, portable, and demo boot are already fast and are explicitly out of scope for the runtime changes.

---

## Scope

### In Scope

- **WS0 — Baseline measurement**: capture hosted field metrics (Speed Insights p75 FCP/LCP/CLS/INP/TTFB) and a lab DevTools Performance trace on a **cold** load, segmented (TTFB, bundle download, parse/exec, `/api/health`, `getSession`, Tracker fetch), with **cold vs. warm** `/api/health` isolated. Re-run after each subsequent phase. Record before/after numbers in the feature docs.
- **WS1 — Inlined startup loader**: loader markup + critical CSS live directly inside `<div id="app">` in `index.html` so first paint does not wait on `main.js`. Recreates the high-fidelity startup-loader handoff (centered sigil + "Project Alice" wordmark + status line over `#F4F1ED`, ambient purple/gold edge glow). The sigil is inlined as `<svg>` (or data URI) — no extra fetch, not an LCP candidate. Status line carries `role="status"` / `aria-live="polite"`. Respects `prefers-reduced-motion`. Reuses 042's brand sigil (see Clarifications).
- **WS2 — Bootstrap rework (parallel + optimistic handshake)**: `bootstrap()` runs `getHealth()` and `authStore.init()` concurrently. Signed-out routes to Welcome on session resolve without requiring health; signed-in routes to the app shell; ConfigError is still reached for a misconfigured deploy (env-var/session-failure path). The inlined loader covering the window removes the "flash of Welcome before ConfigError" concern that currently forces the sequential ordering (Task 08.3).
- **WS3 — App-shell + Tracker skeleton primitive**: the signed-in handoff renders the shell + a Tracker skeleton before data lands; real application data hydrates in. The skeleton is built as a **reusable primitive** that issue #109 will later consume.
- **WS4 — Route-level lazy loading** *(final phase; may split to its own feature if it balloons)*: dynamic-import `Calendar`, `Profile`, `ProfileEdit` in `navigate()`; keep `Tracker` (landing route) eager. Requires latest-wins race guarding and chunk-load-failure handling.
- **WS5 — Font loading**: self-host or preload Sora so the render-blocking Google Fonts request leaves the critical path.
- **Boot timeout / error state**: a ~10s loader timeout surfaces a "taking longer than expected / Retry" affordance; Retry performs a full page reload. Wired to the existing network-error / ConfigError paths — no infinite spinner.
- **Measurement discipline** (WS0) re-run before/after each phase; bundle visualizer before WS4.

### Non-Goals

- **No change to local / portable / demo boot** — those are local-first and already fast; the loader and handshake parallelization target the **hosted** runtime only (local/demo boot is unchanged or fast-pathed past the loader).
- **Issue #109 (application-card click latency) is out of scope** — a separate issue with a different journey (warm click), latency source (detail-fetch round-trip), and metric (INP). 044 only *ships* the WS3 skeleton primitive #109 will consume; it does not implement #109's click feedback.
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
  - **Independent Test**: Cold-load the hosted URL with cache disabled; confirm the branded loader (sigil + wordmark + status line + edge glow) paints near-instantly, before the JS bundle finishes, and that no blank white screen precedes it.

- **US2 — Signed-out reaches Welcome fast (WS2).** As a signed-out visitor, the loader hands off to Welcome without waiting on the `/api/health` cold start.
  - **Independent Test**: Signed-out cold load; confirm handoff to Welcome occurs once the session resolves and does **not** block on health; confirm a measured LCP improvement vs. baseline.

- **US3 — Signed-in sees a skeleton, then data (WS3).** As a signed-in user, the loader hands off to the app shell with a Tracker skeleton, and real data hydrates into it.
  - **Independent Test**: Signed-in cold load; confirm the shell + Tracker skeleton render before data, then application rows replace the skeleton when data arrives — with no blank gap between loader and shell.

- **US4 — Boot failure is recoverable (timeout).** As a visitor hitting a stalled/failed cold start, after a short wait I get a Retry affordance instead of an endless spinner.
  - **Independent Test**: Simulate a boot stall/failure (e.g. block `/api/health` and the session call); confirm that after ~10s the loader shows "taking longer than expected / Retry" and that Retry reloads the page.

- **US5 — Misconfigured deploy still shows ConfigError.** As a visitor to a misconfigured hosted deploy, I reach ConfigError without a flash of Welcome or the app.
  - **Independent Test**: With hosted env vars removed, cold-load; confirm ConfigError mounts and neither Welcome nor the app shell flashes first.

- **US6 — Reduced motion respected.** As a visitor with `prefers-reduced-motion`, the loader does not spin the ambient glow.
  - **Independent Test**: Enable reduced-motion at the OS/browser level; cold-load hosted; confirm the edge-glow rotation is disabled while the loader still renders.

- **US7 — Lighter initial bundle (WS4).** As a hosted visitor, the initial download excludes routes I have not visited yet.
  - **Independent Test**: Inspect the network panel / bundle visualizer; confirm `Calendar` / `Profile` / `ProfileEdit` load as separate chunks on navigation while `Tracker` is in the initial bundle; confirm navigation still works and a failed chunk load degrades gracefully.

- **US8 — Non-blocking fonts (WS5).** As a hosted visitor, the render-blocking Google Fonts request is off the critical path.
  - **Independent Test**: Confirm Sora is self-hosted or preloaded and that no render-blocking third-party font stylesheet sits on the critical path; confirm the loader background + sigil paint independent of Sora (text may swap in).

---

## Acceptance Criteria

- Hosted **FCP** and **LCP** show a meaningful, **measured** reduction vs. the documented baseline (aspirational p75 targets FCP < ~1.5s, LCP < ~4s), with the free-tier cold-start floor called out where it caps results. Before/after metrics are recorded in the feature docs.
- The blank white boot page is **eliminated** on hosted; a branded loader paints near-instantly (WS1).
- The signed-out path reaches Welcome **without blocking on** the `/api/health` cold start, and never mounts the app shell before the session confirms signed-in (WS2).
- The signed-in path renders the app shell + Tracker skeleton before data, then hydrates real data in (WS3).
- Boot failure surfaces a Retry affordance (full page reload) after ~10s — **never an infinite spinner**.
- A misconfigured hosted deploy still reaches **ConfigError** with no flash of Welcome/app.
- `prefers-reduced-motion` disables the edge-glow rotation.
- (WS4) `Calendar` / `Profile` / `ProfileEdit` are code-split out of the initial bundle; `Tracker` stays eager; navigation races are latest-wins guarded and chunk-load failures handled.
- (WS5) No render-blocking third-party font request remains on the critical path.
- **Local / portable / demo boot behavior is unchanged.**
- Accessibility intact: loading state announced (`role="status"` / `aria-live`), reduced-motion respected, keyboard navigation and labels preserved.
- All unit, integration, and build tests pass; lint clean.

---

## Edge Cases

- **Cold-start failure or hang** → ~10s timeout → Retry (full reload); never an infinite spinner.
- **Signed-out visitor + misconfigured deploy** → session init fails to construct a Supabase client → ConfigError is reached (not Welcome), so optimistic signed-out routing does not leak a broken Welcome.
- **Deploy mid-session invalidates hashed chunks** (WS4) → `import()` rejection handled with a retry / full-reload fallback (the Retry reload also fetches fresh chunks).
- **Rapid navigation races** once `navigate()` is async (WS4) → latest-wins guard; the dirty-check (`ProfileEdit.confirmNavigation`) and `page === _currentPage` early-return must run **before** any `await`.
- **`prefers-reduced-motion`** → disable the edge-glow spin (loader still renders statically).
- **Handoff branches** → the loader must resolve correctly to signed-out (Welcome), signed-in (shell + skeleton), local/demo (fast path), and config-error, with no flash between states.
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
- **Issue #109** depends on **044/WS3's skeleton primitive** — coordinate so only one skeleton system exists; #109 waits for or explicitly reuses it. (#109 may prove lighter than a skeleton — an instant row-highlight + spinner — in which case the shared-component link is nice-to-have, not a blocker.)

---

## Related

- **docs/features/044-hosted-startup-performance.md** — feature brief (source of this spec).
- **Design reference**: `HostedAlice_StartupLoader/design_handoff_startup_loader/` (startup loader — WS1) and `design_handoffs/Alice_InAppLoader/` (in-app loader pattern, informs the WS3 skeleton feel). Visuals are final; integration guidance is superseded by this spec (inline in HTML, not a JS-rendered component).
- **042 Welcome & Brand Refresh** — source of the brand sigil + Sora.
- **Issue #109** — application-card click latency (separate; consumes the WS3 skeleton primitive).
