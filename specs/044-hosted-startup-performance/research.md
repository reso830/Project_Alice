# Research & Technical Decisions: Hosted Startup Performance

**Feature**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Date**: 2026-07-04

This records the design decisions behind the plan and the evidence for them. Findings are drawn from `src/main.js`, `src/services/healthApi.js`, `index.html`, and the design handoffs.

---

## D1 — Loader must be inlined static markup, not a JS component

**Decision**: Put loader markup + critical CSS directly inside `<div id="app">` in `index.html`; inline the sigil as `<svg>`.
**Why**: The FCP win comes entirely from painting *before* `main.js` downloads/executes. A JS-rendered `isBooting` component (as the handoff's `State Management` note suggests) would paint only after the bundle runs — defeating the purpose.
**Evidence**: `index.html` ships `<div id="app"></div>` empty; nothing paints until the module script executes.
**Consequence**: The sigil is inlined (no fetch, not an LCP candidate); the loader wordmark stays 26px so it never becomes a distorting LCP hero.

## D2 — The loader must survive the boot handshake, with a real teardown mechanism

**Decision**: Stop removing `#app` at the top of `bootstrap()`; keep the loader visible until the first destination mounts, then tear it down via a deferred-removal fade — apply an exiting/fade CSS class and delay the actual `clearBody()` call until the transition ends (`transitionend`, with a `setTimeout` fallback), not an immediate `clearBody()` underneath the fade.
**Why**: `bootstrap()` currently calls `existingRoot?.remove()` *before* `await runtimeHandshake()`, which would delete an inlined loader immediately and leave a blank body for the entire handshake. Separately, `mountWelcome()` / `mountAppShell()` / `mountConfigError()` all call `clearBody()` **synchronously** — a fade cannot play if the element is destroyed in the same tick it starts fading (flagged in plan review).
**Evidence**: `src/main.js` `bootstrap()` — `existingRoot?.remove()` precedes the first `await`; `mountWelcome()`/`mountAppShell()`/`mountConfigError()` each call `clearBody()` with no transition hook.
**Consequence**: A single loader-teardown path invoked by the first of `mountWelcome` / `mountAppShell` / `mountConfigError`, with `clearBody()` deferred to transition-end. Under `prefers-reduced-motion`, the transition duration is zero, so removal is effectively immediate.

## D3 — Optimistic routing is safe *only* for the two network-backed outcomes (revised after plan review)

**Original decision (Option 1, session 2026-07-04)**: Run `getHealth()` and `authStore.init()` concurrently; route signed-out → Welcome as soon as the session resolves, without awaiting health. The safety argument at the time: ConfigError fires only when `health.runtime === 'hosted' && !hostedAuthAvailable`, and when env vars are missing, `authStore.init()` also "fails" — so ConfigError would still be reached independently.

**Plan-review finding (critical, confirmed against code)**: that "fails" assumption was wrong. `authStore.init()` (`authStore.js:44-49`) does not fail when `isHostedAuthAvailable` is false — it **synchronously** sets `state = { status: 'local-mode' }` and notifies, with **no network call at all**. `render()` (`main.js:219-226`) mounts the **app shell** for `local-mode`, exactly like `authenticated`/`demo`. Because `local-mode` resolves before `getHealth()` has any chance to, treating "session resolved" as the all-clear signal would mount the real app shell (with local seed data) on a **hosted deploy that's simply missing its build-time env vars**, and only several hundred ms–seconds later would `getHealth()` resolve and override to ConfigError. That is precisely the flash-of-app-before-ConfigError the loader (and Task 08.3's original sequential ordering) exists to prevent.

**Revised decision**: split the routing logic by whether the outcome is network-backed:
- `authenticated` / `unauthenticated` — reached only via a genuine `supabase.auth.getSession()` call, which only runs when `isHostedAuthAvailable === true`. These get the no-health-wait treatment: route immediately on session resolve.
- `local-mode` — reached synchronously whenever `isHostedAuthAvailable === false`. This outcome **continues to wait for `getHealth()`** before mounting, exactly as today. This is safe and cheap: local-mode is definitionally not the hosted-cold-start scenario this feature targets (a genuine local/portable build's own health check resolves near-instantly), so gating it costs nothing for real local users, while correctly protecting the misconfigured-hosted-deploy case.
- `demo` — entered explicitly via `enterDemo()` post-boot, not part of the initial boot race at all; unaffected.

**Guardrails**: route `authenticated`/`unauthenticated` only *after* `getSession()` resolves; never mount the shell for `local-mode` before health resolves; keep the `render()` `_configErrorMounted` guard so a late `configError` can still override an already-mounted Welcome/shell.
**Rejected**: the original unqualified "signed-out/signed-in skip the wait" framing (missed the `local-mode` branch); strict "wait for both" for every outcome (still pays the cold start for `authenticated`/`unauthenticated` on a correctly configured deploy — negates the brief's goal); fully optimistic with no health check at all (loses ConfigError for the misconfig edge).

## D4 — Footer/UpdateToast require an explicit remount, not an in-place patch

**Decision**: `mountAppShell()` renders the shell + skeleton without waiting on health for the network-backed outcomes. When health resolves — whether before or after the shell has mounted — `main.js` **replaces** the footer element with a fresh `Footer.render({ runtime })` call and **re-invokes** `UpdateToast.mount({ health })` (after `destroy()`), rather than assuming either component can be patched in place.
**Why**: Plan review confirmed neither component supports patching. `Footer.render({runtime})` (`Footer.js`) is a one-shot factory — `createModeControl(runtime)` bakes the runtime-dependent link into the DOM at creation time, and the module exports only `{ render }`, no update method. `UpdateToast.mount({health})` (`UpdateToast.js:392-396`) explicitly early-returns with **no subscriptions set up** whenever `!health?.updateSupported` — which is `true` when `health` is null. So mounting once with null health and expecting it to "pick up" a later-resolved health silently does nothing; the update-toast system would just never activate.
**Consequence**: Footer runtime label / UpdateToast / update-controller subscription (`_runtimeHealth?.updateSupported ? subscribeUpdateController() : null`) are all re-evaluated via an explicit remount step when health resolves, not a passive "tolerate null" patch. (Hosted `updateSupported` is typically false, limiting how often this remount actually fires in practice.)

## D5 — Retry = full page reload

**Decision**: Boot timeout (~10s) → "taking longer… / Retry"; Retry calls `window.location.reload()`.
**Why**: Simplest, guarantees clean state, gives the serverless function a fresh cold-start attempt, and — because it re-fetches the bundle — also recovers the WS4 stale-chunk case. In-place handshake replay is more code and can't recover a failed/stale bundle.

## D6 — WS4: dynamic-import non-landing routes, keep Tracker eager, update nav state before the await

**Decision**: Convert the static imports of `Calendar` / `Profile` / `ProfileEdit` (main.js:10–13) to dynamic `import()` inside `navigate()`; keep `Tracker` (landing route) eager; make `navigate()` async. Update `_currentPage`/`Navbar.setActive`/`BottomTabBar.setActive` and show the WS3 skeleton in the workspace **immediately, before awaiting the `import()`** — not after it resolves.
**Why**: `Tracker` is the first paint after the shell — lazy-loading it would add a chunk fetch to the critical path. The other three are only reached on navigation. **Plan-review finding (confirmed)**: today's `navigate()` (`main.js:319-355`) clears `#app` and unmounts the previous page synchronously, but only updates `_currentPage`/Navbar/BottomTabBar highlighting *after* the new page mounts (at the end of the function). If mounting is deferred behind an awaited `import()`, the workspace goes blank while the nav bar still highlights the *previous* tab as active — a disorienting state during any non-trivial chunk download time.
**Guardrails**: keep `!appRoot || page === _currentPage` and `ProfileEdit.confirmNavigation(page)` early-returns **before any `await`** (they mutate/guard navigation intent); update the active-tab highlight and render the skeleton **before** the `await` so nav and workspace stay in sync during the fetch; add a latest-wins token so a slow chunk can't clobber a newer navigation; wrap `import()` in try/catch → reload fallback, reverting the optimistic active-tab state if the import fails.
**Evidence**: `navigate()` is currently synchronous with those exact early-returns, static route mounts, and end-of-function nav-state updates.
**Note**: This is the phase most likely to split into its own feature if the race/chunk-failure handling balloons.

## D9 — WS3 skeleton reuses `src/utils/skeletons.js`; WS1 CSS classes are scoped

**Decision (skeleton)**: Add a Tracker-boot skeleton builder to the **existing** `src/utils/skeletons.js` rather than creating a new `Skeleton.js` component.
**Why**: Plan review found that `src/utils/skeletons.js` already exists and already ships `buildApplicationListSkeleton` / `buildProfileSkeleton` / `buildCalendarSkeleton` — presentational, `aria-busy`/`aria-live`-carrying builders used today by `Tracker.js`, `Profile.js`, and `Calendar.js`, styled via existing `loading-skeleton`/`skeleton-*` classes in `main.css`. Introducing a parallel `Skeleton.js` primitive would duplicate an established pattern, contradicting the constitution's "simple, readable code over clever abstractions."
**Consequence**: Issue #109 consumes the skeleton from `skeletons.js` as well, not a separate component.

**Decision (CSS scoping)**: WS1's loader uses scoped class names (e.g. `.startup-loader__edge-glow`, `.startup-loader__edge-glow-base`) rather than the bare `.edge-glow`/`.edge-glow__base` names both design handoffs (startup loader and in-app loader) independently prototype.
**Why**: Not currently reproducible in checked-in code (neither `main` nor the current `042` branch tip defines `.edge-glow` anywhere; 042's committed `JobPostingImport.js`/`ResumeImport.js` overlays use `.job-posting-import-processing`/`.resume-import-processing`, no glow class yet). But both handoffs prescribe the identical literal name for visually different treatments (044: static; in-app: rotating, different z-index/layout), and 042's in-app-loader implementation may still be in flight in a separate, concurrent session — so scoping ours is cheap insurance against a future global-CSS collision.

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
- WS3 Tracker **skeleton visuals** — no dedicated design handoff exists (the handoffs cover the startup loader and the in-app processing overlay). Derive from the existing `skeletons.js` visual language (see D9); confirm at WS3 design.
- WS5 font strategy (D7).
- Metrics artifact granularity/format (WS0) — start simple (a Markdown table), extend if needed.
- Loader **copy**: using the handoff placeholder "Getting things ready…"; staged/progress copy not decided.
