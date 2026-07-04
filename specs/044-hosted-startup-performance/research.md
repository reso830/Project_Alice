# Research & Technical Decisions: Hosted Startup Performance

**Feature**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Date**: 2026-07-04

This records the design decisions behind the plan and the evidence for them. Findings are drawn from `src/main.js`, `src/services/healthApi.js`, `index.html`, and the design handoffs.

---

## D1 — Loader must be inlined static markup, not a JS component

**Decision**: Put loader markup + critical CSS directly inside `<div id="app">` in `index.html`; inline the sigil as `<svg>`.
**Why**: The FCP win comes entirely from painting *before* `main.js` downloads/executes. A JS-rendered `isBooting` component (as the handoff's `State Management` note suggests) would paint only after the bundle runs — defeating the purpose.
**Evidence**: `index.html` ships `<div id="app"></div>` empty; nothing paints until the module script executes.
**Consequence**: The sigil is inlined (no fetch, not an LCP candidate); the loader wordmark stays 26px so it never becomes a distorting LCP hero.

## D2 — The loader must survive the boot handshake

**Decision**: Stop removing `#app` at the top of `bootstrap()`; keep the loader visible until the first destination mounts, then tear it down (opacity fade).
**Why**: `bootstrap()` currently calls `existingRoot?.remove()` *before* `await runtimeHandshake()`, which would delete an inlined loader immediately and leave a blank body for the entire handshake.
**Evidence**: `src/main.js` `bootstrap()` — `existingRoot?.remove()` precedes the first `await`.
**Consequence**: A single loader-teardown path invoked by the first of `mountWelcome` / `mountAppShell` / `mountConfigError`.

## D3 — Optimistic signed-out routing is safe (Option 1)

**Decision**: Run `getHealth()` and `authStore.init()` concurrently; route signed-out → Welcome as soon as the session resolves, without awaiting health.
**Why it's safe**: ConfigError fires only when `health.runtime === 'hosted' && !hostedAuthAvailable`. `hostedAuthAvailable` (`isHostedAuthAvailable`, `supabaseClient.js`) is a **synchronous client-side env-var check**. So:
- Env vars present (healthy deploy): `configError` is always false regardless of health → health is pure critical-path latency for routing → safe to skip the wait.
- Env vars missing (misconfig): `authStore.init()` cannot construct a Supabase client and fails → we never get a clean `unauthenticated` → ConfigError is reached independently.
**Evidence**: `runtimeHandshake()` returns `configError` only on the combined condition; network failure in `getHealth` is already swallowed as non-fatal.
**Guardrails**: route signed-out only *after* the session resolves; never mount the shell before the session confirms signed-in; keep the `render()` `_configErrorMounted` guard so a late `configError` can still override Welcome.
**Rejected**: strict "wait for both" (still pays the cold start for signed-out — negates a brief goal); fully optimistic with no health check at all (loses ConfigError for the env-vars-missing edge).

## D4 — Signed-in mount must tolerate a null health result

**Decision**: `mountAppShell()` renders the shell + skeleton without waiting on health; patch `_runtimeHealth`-dependent UI when health resolves.
**Why**: With the parallel handshake, `_runtimeHealth` may be null when the shell mounts. Today `mountAppShell()` reads it synchronously (`Footer.render({ runtime })`, `UpdateToast.mount({ health })`, `subscribeUpdateController` gated on `updateSupported`).
**Consequence**: Footer runtime label / UpdateToast / update-controller subscription become null-tolerant and update on health resolve. (Hosted `updateSupported` is typically false, limiting churn.)

## D5 — Retry = full page reload

**Decision**: Boot timeout (~10s) → "taking longer… / Retry"; Retry calls `window.location.reload()`.
**Why**: Simplest, guarantees clean state, gives the serverless function a fresh cold-start attempt, and — because it re-fetches the bundle — also recovers the WS4 stale-chunk case. In-place handshake replay is more code and can't recover a failed/stale bundle.

## D6 — WS4: dynamic-import non-landing routes, keep Tracker eager

**Decision**: Convert the static imports of `Calendar` / `Profile` / `ProfileEdit` (main.js:10–13) to dynamic `import()` inside `navigate()`; keep `Tracker` (landing route) eager; make `navigate()` async.
**Why**: `Tracker` is the first paint after the shell — lazy-loading it would add a chunk fetch to the critical path. The other three are only reached on navigation.
**Guardrails**: keep `!appRoot || page === _currentPage` and `ProfileEdit.confirmNavigation(page)` early-returns **before any `await`** (they mutate/guard navigation intent); add a latest-wins token so a slow chunk can't clobber a newer navigation; wrap `import()` in try/catch → reload fallback.
**Evidence**: `navigate()` is currently synchronous with those exact early-returns and static route mounts.
**Note**: This is the phase most likely to split into its own feature if the race/chunk-failure handling balloons.

## D7 — WS5 font strategy: self-host vs. preload (OPEN, deferred to WS5 plan)

**Context**: `index.html` loads DM Mono + Sora via a render-blocking `fonts.googleapis.com` stylesheet with `preconnect`.
**Option A — self-host** (e.g. `@fontsource/sora` + a DM Mono package): removes the third-party origin entirely; adds a dependency (needs constitution justification — provided in plan).
**Option B — preload**: `<link rel=preload as=style>` + async-swap the stylesheet; no dependency, but keeps the third-party origin.
**Decision**: deferred to the WS5 plan; both satisfy "no render-blocking font request on the critical path." Note both DM Mono **and** Sora are in play (Sora weights 400;500;600;700).

## D8 — Measurement methodology (WS0)

**Field**: Vercel Speed Insights p75 FCP/LCP/CLS/INP/TTFB.
**Lab**: DevTools Performance trace on a **cold** load, segmented into TTFB / bundle download / parse-exec / `/api/health` / `getSession` / Tracker fetch. Isolate **cold vs. warm** `/api/health` to separate the fixable architecture from the free-tier floor. Bundle visualizer before WS4.
**Recording**: `specs/044-hosted-startup-performance/metrics.md`, baseline + one row per phase.

---

## Open Questions (non-blocking; resolve at the owning phase)
- WS3 Tracker **skeleton visuals** — no dedicated design handoff exists (the handoffs cover the startup loader and the in-app processing overlay). Derive from brand tokens; confirm at WS3 design.
- WS5 font strategy (D7).
- Metrics artifact granularity/format (WS0) — start simple (a Markdown table), extend if needed.
- Loader **copy**: using the handoff placeholder "Getting things ready…"; staged/progress copy not decided.
