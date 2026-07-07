# Implementation Plan: Hosted Startup Performance

**Branch**: `044-hosted-startup-performance` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/044-hosted-startup-performance/spec.md`

---

## Summary

Cut hosted first-load time (baseline FCP ~8s / LCP ~13.5s) by attacking two causes: (1) an empty `<div id="app">` that paints nothing until the JS bundle executes, and (2) `bootstrap()` gating first paint behind two **sequential** network round-trips (`runtimeHandshake()` → `getHealth()`, then `authStore.init()` → `getSession()`). The work ships as six dependency-ordered phases (WS0–WS5): baseline measurement, an inlined branded loader, a parallel+optimistic boot handshake, a reusable app-shell/Tracker skeleton, route-level lazy loading, and non-blocking fonts. All runtime changes are **hosted-only**; local/portable/demo boot is unchanged. No data-layer, schema, or `createRepositories` change is involved.

---

## Technical Context

**Language/Version**: JavaScript (ES6+), Vanilla JS
**Primary Dependencies**: Vite, standard DOM APIs, `@vercel/speed-insights` (existing), dynamic `import()` (WS4). WS5 may add a self-hosted font package (see Constitution Check / research).
**Storage**: N/A — no persistence change. `store`/`authStore` calls are **reordered**, not modified.
**Testing**: Vitest (unit/integration) + build assertions; DevTools Performance traces + Speed Insights for the perf gate.
**Target Platform**: Hosted web (Vercel serverless + Supabase). Local/portable/demo runtimes explicitly out of scope for runtime behavior.
**Performance Goals**: Directional p75 targets FCP < ~1.5s, LCP < ~4s; hard gate = documented, measured improvement vs. the WS0 baseline, with the free-tier cold-start floor called out where it caps results.
**Constraints**: Loader must paint before `main.js`; no flash of Welcome/app before ConfigError; loader glow is **static** (no motion at any breakpoint, per the updated handoff) and responsive across 3 breakpoints, with `prefers-reduced-motion` governing only the loader→app transition; loader LCP hygiene (26px wordmark, inline SVG non-candidate); 042 must merge first (brand sigil + Sora).

---

## Constitution Check

- **Data Fields**: No persistence models or required fields (company, job title, status, `lastStatusUpdate`, responsibilities) are added or modified. The change is confined to the boot path, first paint, bundle splitting, and font loading.
- **Separation of Logic**: The loader is static markup/CSS (no business logic). Boot orchestration stays in `main.js`; routing logic stays in `navigate()`. The boot skeleton is a presentational builder added to the existing `src/utils/skeletons.js`, with no data coupling.
- **Validation**: No new validation rules; existing centralized validation is untouched. The runtime handshake continues to be the authority for ConfigError; server-side RLS + the session gate remain the authority for authenticated data.
- **Workflows / States**: Explicit loading (branded loader + skeleton), error (boot timeout → Retry), and config-error states are all planned.
- **Local-First Privacy**: All runtime changes are hosted-only; a local/GitHub checkout boots unchanged. No new analytics/tracking; `@vercel/speed-insights` is unchanged (page-level metrics only, prod-hosted only, no PII).
- **New Dependencies**: Only potential addition is a **self-hosted Sora font package** in WS5 (e.g. `@fontsource/sora`), *if* self-hosting is chosen over `<link rel=preload>`. Justification: removes a render-blocking third-party request from the critical path (a direct FCP win) and eliminates the runtime dependency on `fonts.googleapis.com`. The preload alternative adds no dependency; the choice is deferred to the WS5 plan (see research.md). No other new dependencies.

---

## Architecture

### Current boot path (verified in `src/main.js`)

```
DOMContentLoaded
  → bootstrap()
      injectSpeedInsights()
      #app removed immediately            ← blank body during the handshake
      await runtimeHandshake() → getHealth() → /api/health   ← cold start (sequential)
      if configError → mountConfigError(); return
      authStore.subscribe(render)
      await authStore.init() → getSession()                  ← sequential, after health
  → render(state)  →  mountWelcome() | mountAppShell() | (initializing → unmount)
        mountAppShell() → store warm-up → navigate('tracker') → Tracker data fetch
```

FCP ≈ everything up to the first mount; LCP ≈ + Tracker data. Two facts drive the design:

1. **`bootstrap()` removes `#app` up front** (`existingRoot?.remove()`), so any inlined loader would vanish immediately. WS1/WS2 must let the loader **persist through the handshake** and be torn down only when a destination mounts.
2. **ConfigError only fires when `health.runtime === 'hosted' && !hostedAuthAvailable`.** `hostedAuthAvailable` (`isHostedAuthAvailable`) is a **synchronous, client-side env-var check**.
3. **`authStore.init()` has two distinct resolution modes, not one.** When `isHostedAuthAvailable` is true, it **awaits** `supabase.auth.getSession()` — a genuine network call — and resolves to `authenticated` or `unauthenticated`. When `isHostedAuthAvailable` is **false**, it resolves to `local-mode` **synchronously, with no network call at all** (`authStore.js:44-49`). `render()` mounts the app shell for `local-mode` exactly like `authenticated`/`demo` (`main.js:219-226`). Because `local-mode` fires both for a genuine local/portable build *and* for a hosted deploy missing its build-time env vars, and it resolves before `getHealth()` ever has a chance to, **it cannot be treated as "safe to mount immediately" the way a real `getSession()`-backed outcome can** — only `getHealth()`'s server-side `runtime` field can disambiguate the two cases. This is why today's code awaits health *first*, before `authStore.init()` runs at all (Task 08.3), and why the parallel handshake below only relaxes the wait for the two network-backed outcomes.

### Hosted-only delivery of the loader markup

`index.html` is a single source file, but there are **three** distinct serving paths for it, not two:

1. **Hosted (Vercel)** — serves the *built* `dist/index.html` straight from the CDN per `vercel.json` (only `/api/:path*` rewrites to the function); Express never sees the request.
2. **Portable** (`npm run build` + `server:start`, `serveStatic: true`) — serves the *built* `dist/index.html` through `server/index.js`'s `serveStatic` catch-all (`res.sendFile(path.join(distDir, 'index.html'))`, `server/index.js:94-96`).
3. **Local dev** (`npm run dev`, the primary GitHub-checkout workflow per README) — Vite's dev server serves the **source** `index.html` directly, with HMR. This bypasses both Vercel's CDN and `server/index.js` entirely — a first re-review pass on this plan missed this third path and only covered #1/#2.

WS1 wraps the loader markup in `index.html` with HTML comment markers (`<!-- STARTUP-LOADER:START -->` / `<!-- STARTUP-LOADER:END -->`) and addresses each path:

- **Hosted** (#1): untouched — the CDN serves the built file with the loader intact.
- **Portable** (#2): `server/index.js`'s `serveStatic` catch-all reads the file once (cached in memory), strips the marked block when `!config.isHosted`, and sends the stripped HTML.
- **Local dev** (#3): a Vite plugin (`stripStartupLoaderInDev`, `apply: 'serve'`) uses the `transformIndexHtml` hook to strip the same marked block. It only applies under `vite dev`/`serve`, never `vite build` — `vite dev` is never used for a hosted build (hosted always goes through `vite build`), so unconditionally stripping there is safe and needs no runtime-config check.

All three runtimes that are meant to never see the loader (local dev, portable) now have an explicit, server/build-side mechanism ensuring that — not a client-side flash-then-hide in any of them.

### Target boot path

```
index.html: <div id="app"> now contains inlined loader markup + critical CSS  ← paints before main.js (FCP)
  → bootstrap()
      injectSpeedInsights()
      DO NOT remove the loader up front; start a ~10s boot-timeout timer
      start getHealth() and authStore.init() CONCURRENTLY
      authStore.subscribe(render)
      render(state) on auth resolution:
        unauthenticated  → tear down loader (deferred fade, see below) → mountWelcome()      ← no health wait (network-backed)
        authenticated    → tear down loader → mountAppShell() + Tracker SKELETON             ← no health wait (network-backed)
        local-mode        → DO NOT mount yet; hold behind the loader until getHealth() also resolves,
                             then mount (or let configError override) — same safety as today, just concurrent
        demo              → unchanged (entered explicitly via enterDemo(), not part of the boot race)
      when health resolves:
        if configError (only possible when env vars missing) → mountConfigError() (overrides Welcome/shell if already mounted)
        else → patch Footer (re-render, replace element) and UpdateToast (destroy + re-mount) with the resolved health
               if the shell mounted before health resolved
      on boot timeout with nothing mounted → loader shows "taking longer… / Retry" (full reload)
```

**Loader teardown mechanics** (addresses the fade-vs-`clearBody()` conflict): `mountWelcome()` / `mountAppShell()` / `mountConfigError()` currently call `clearBody()` synchronously. The rework applies an exiting/fade class to the loader and **defers** the actual `clearBody()` call until the transition ends (`transitionend`, with a `setTimeout` fallback in case the event doesn't fire); under `prefers-reduced-motion` the transition duration is zero, so removal is effectively immediate.

Phasing (each phase re-runs WS0 measurement):

- **WS0 — Baseline measurement.** Capture field (Speed Insights p75) + lab (segmented cold DevTools trace, cold-vs-warm `/api/health`) numbers into `metrics.md`. Prerequisite; no code.
- **WS1 — Inlined loader.** Add loader markup + critical CSS inside `<div id="app">` in `index.html` using scoped class names (e.g. `.startup-loader__edge-glow`, not the bare `.edge-glow` both design handoffs use, to avoid colliding with 042's in-app loader); inline the sigil `<svg>`; delimit the loader block with HTML comment markers. Change `server/index.js`'s local/portable static-serving catch-all to strip the marked block when `!config.isHosted`, and add a Vite `transformIndexHtml` plugin (`apply: 'serve'`) to strip the same block for `npm run dev` (see Hosted-only delivery above) — so no non-hosted runtime ever receives the loader markup. Rework `bootstrap()`/mount teardown so the loader survives until a destination mounts, with a deferred-removal fade (see Architecture). FCP win; LCP roughly unchanged.
- **WS2 — Parallel + optimistic handshake.** Run `getHealth()` and `authStore.init()` concurrently. Route `unauthenticated`/`authenticated` (the two `getSession()`-backed outcomes) on session resolve without awaiting health; hold `local-mode` behind health resolution exactly as today, since it's the only outcome ambiguous between "genuine local build" and "misconfigured hosted deploy." Patch Footer/UpdateToast via explicit re-render/remount if health resolves after the shell has mounted. Real-wait (LCP) win for signed-out/signed-in visitors on a correctly configured deploy. *Unlocked by WS1 (loader removes the flash that forces today's sequential order — Task 08.3).*
- **WS3 — App-shell + Tracker skeleton.** Signed-in handoff mounts the shell + a Tracker skeleton before data; data hydrates in. The skeleton is added to the **existing** `src/utils/skeletons.js` (alongside `buildApplicationListSkeleton`/`buildProfileSkeleton`/`buildCalendarSkeleton`, already used by Tracker/Profile/Calendar) rather than a new component — #109 later consumes it from there.
- **WS4 — Route-level lazy loading** *(final phase; split to its own feature only if it balloons).* Convert the static imports of `Calendar`/`Profile`/`ProfileEdit` (main.js:10–13) to dynamic `import()` inside `navigate()`; keep `Tracker` eager. Make `navigate()` async: update `_currentPage`/`Navbar.setActive`/`BottomTabBar.setActive` and show the WS3 skeleton **immediately, before awaiting the import** (not after) so the workspace and nav stay in sync during the chunk fetch; add a latest-wins guard and chunk-load-failure handling (revert active state / offer reload on failure).
- **WS5 — Fonts.** Self-host or preload Sora + DM Mono so the render-blocking `fonts.googleapis.com` stylesheet (index.html:8–10) leaves the critical path.

---

## Data Flow

- **No application data flow changes.** `store.load()`, `authStore.init()`/`getSession()`, and Tracker's data fetch send the same payloads; only their **ordering and gating** relative to first paint change.
- **Loader → destination handoff** is driven by the existing `authStore.subscribe(render)` mechanism; render() gains loader-teardown and skeleton-mount branches, plus a hold-for-health branch for `local-mode`.
- **Health result** (`_runtimeHealth`) becomes available asynchronously; `mountAppShell()` (Footer runtime label, `UpdateToast`, `subscribeUpdateController`) must tolerate `_runtimeHealth === null` at mount time for the network-backed outcomes. Neither `Footer` nor `UpdateToast` exposes an update API today (`Footer.render()` is a one-shot factory; `UpdateToast.mount({health})` bails without subscribing when `health` is null/`updateSupported` is falsy) — so "patch on resolve" means `main.js` **replaces** the footer element with a fresh `Footer.render({runtime})` call and **re-invokes** `UpdateToast.mount()` (after `destroy()`), not an in-place update.
- **Metrics** flow one-way into `metrics.md` (aggregate perf numbers only; no user/application data).

See [data-model.md](./data-model.md) for the boot/loader state machine and the metrics artifact shape; [contracts/api.md](./contracts/api.md) for the `/api/health` response contract and the boot-handshake contract.

---

## Affected Components (overview)

- `index.html` — inlined loader markup + critical CSS (scoped class names, HTML comment markers delimiting the loader block) + sigil `<svg>`; font strategy (WS5).
- `server/index.js` — `serveStatic` catch-all strips the marked loader block from the served HTML when `!config.isHosted` (portable).
- `vite.config.js` — a `transformIndexHtml` plugin (serve-mode only) strips the marked loader block for `npm run dev` (local dev — the one path neither Vercel's CDN nor `server/index.js` cover).
- `src/main.js` — `bootstrap()` (parallel handshake with the `local-mode` hold, loader lifecycle, timeout), `render()` (deferred loader teardown, skeleton branch, Footer/UpdateToast remount-on-late-health), `mountAppShell()` (tolerate null health), `navigate()` (async + optimistic tab-highlight + lazy imports, WS4).
- `src/utils/skeletons.js` — **extend** with a Tracker-boot skeleton builder (not a new component).
- New: a loader-lifecycle helper (deferred-removal fade) for WS1.
- `src/styles/main.css` — loader fade-out (exit-transition class), skeleton styles, reduced-motion rules.
- `src/services/healthApi.js` — inspected; likely unchanged (contract consumer).
- New doc: `specs/044-hosted-startup-performance/metrics.md` — before/after numbers.

Full inventory in **Affected Areas** below.

---

## Risks and Tradeoffs

- **Loader lifecycle vs. existing teardown.** `bootstrap()` and the mount functions call `clearBody()` / remove `#app` eagerly, which would also cut a fade-out transition short. Mitigation: a single loader-teardown path invoked at the first destination mount, with `clearBody()` **deferred** until the exit transition ends (`transitionend` + timeout fallback; zero-duration under reduced-motion); assert no blank frame in tests.
- **`local-mode` is not safe for optimistic (no-health-wait) routing — this was the plan-review's critical finding.** `authStore.init()` resolves `local-mode` **synchronously**, with no network call, whenever `isHostedAuthAvailable` is false — including when a hosted deploy is simply missing its build-time env vars. `render()` mounts the app shell for `local-mode` the same as `authenticated`/`demo`, so treating it as "safe to mount immediately" would flash the real app shell (with local seed data) before `getHealth()` resolves and overrides to ConfigError. Mitigation: **only** `authenticated`/`unauthenticated` (both backed by a real `getSession()` call) get the no-health-wait treatment; `local-mode` continues to wait for `getHealth()` before mounting, exactly as today. Preserve the `render()` `_configErrorMounted` guard so a late `configError` can still override an already-mounted Welcome/shell. Test the env-vars-missing path explicitly (local-mode + health confirming misconfig → ConfigError, no shell flash).
- **Signed-in mount before health (network-backed outcomes only).** `mountAppShell()` reads `_runtimeHealth` synchronously (Footer, UpdateToast, `updateSupported`), and neither component has an update API. Mitigation: mount with null health tolerated; when health resolves after the fact, **replace** the footer element via a fresh `Footer.render()` call and **re-invoke** `UpdateToast.mount()` (after `destroy()`) rather than assuming an in-place patch exists.
- **WS4 async navigation races.** Making `navigate()` async introduces interleaving, and naively awaiting the import before updating nav state leaves a blank workspace with the *previous* tab still highlighted. Mitigation: keep the `!appRoot || page === _currentPage` and `ProfileEdit.confirmNavigation` early-returns **before any `await`** (spec edge case); update the active-tab highlight and show the WS3 skeleton **immediately, before the `await`**; add a latest-wins token; handle `import()` rejection with a retry/full-reload fallback and revert the optimistic active state on failure.
- **WS4 chunk invalidation on redeploy.** Hashed chunks can 404 after a mid-session deploy. Mitigation: catch `import()` rejection → offer reload (same affordance as the boot Retry) and revert the tab highlight.
- **CSS class-name collision.** Both the startup-loader and in-app-loader design handoffs independently use the bare class name `.edge-glow` for visually different treatments (044: static; in-app: rotating). Mitigation: WS1 scopes its classes (e.g. `.startup-loader__edge-glow`) rather than using the handoff's literal names verbatim.
- **Loader-stripping mechanism (portable).** `server/index.js`'s catch-all currently does a plain `res.sendFile()`; switching to a read-and-strip means the file content must be cached in memory rather than re-read and re-parsed per request. Mitigation: read + strip once at server start (or lazily on first request, memoized), keyed off `config.isHosted` which is fixed for the process lifetime — no per-request cost beyond a string send. Test asserts the local/portable HTML response excludes the loader markers entirely.
- **Loader-stripping mechanism (local dev) — missed in the first pass.** `server/index.js`'s fix only covers portable's `serveStatic` path; `npm run dev` serves `index.html` through Vite's own dev server, never through Express, so it needed a separate fix. Mitigation: a Vite plugin using `transformIndexHtml` with `apply: 'serve'` (never runs during `vite build`, so it can't accidentally strip the loader from the hosted/portable build output). Test asserts a `vite dev`-served response excludes the loader markers.
- **WS5 dependency.** Self-hosting adds a package; preloading does not but keeps a third-party origin. Tradeoff captured in research; decision deferred to the WS5 plan.
- **042 sequencing.** Building on un-merged 042 would duplicate/diverge the sigil + Sora. Mitigation: 044 assumes 042 merged; WS1 references 042's assets.
- **Measurement noise.** Free-tier cold starts vary run-to-run. Mitigation: report p75 field data + multiple cold lab traces; isolate cold-vs-warm `/api/health`; call out the floor.

---

## Validation Approach

- **Unit/integration (Vitest):** loader persists through the handshake and is torn down exactly once on first mount (deferred `clearBody()` after the exit transition); `authenticated`/`unauthenticated` mount without awaiting health; `local-mode` **waits for health** before mounting; env-vars-missing (`local-mode` + health confirms misconfig) still reaches ConfigError with no Welcome/app flash; `mountAppShell()` tolerates null health then triggers an explicit Footer replace + `UpdateToast` remount on late resolve; boot timeout surfaces Retry (reload) and never an indefinite wait; the loader glow is static (no motion) and reduced-motion suppresses the loader→app transition; (WS4) `navigate()` updates the active-tab/skeleton before the `await`, early-returns run before `await`, latest-wins holds, chunk-load failure is handled (with active-state revert).
- **Build:** bundle visualizer before WS4 to justify code-splitting; assert `Calendar`/`Profile`/`ProfileEdit` are split and `Tracker` stays in the initial chunk after WS4; assert no render-blocking font request after WS5.
- **Perf gate (WS0 discipline):** re-run field + lab after each phase; record before/after in `metrics.md`; the feature passes on a documented, measured FCP/LCP improvement vs. baseline (targets directional).
- **Browser Smoke Test (final phase):** walk each user story's Independent Test (US0–US8) against the to-be-merged state.

---

## Persistence Runtimes

This feature does **not** touch the data layer routed through `createRepositories(config)`. Both **local** (SQLite) and **hosted** (Supabase) runtimes are unaffected at the persistence level; the boot handshake only reorders *when* the existing `getHealth`/`getSession`/`store` calls run. **Demo mode** runs on the local path and is out of scope for the WS1/WS2 runtime changes (the loader markup is stripped server-side and the handshake hold is unaffected); the only demo touch-point is ensuring `mountAppShell()`'s demo branch still works when `_runtimeHealth` is null at mount. WS3 (skeleton), WS4 (lazy loading), and WS5 (font loading) are shared code paths that do apply to local/portable/demo — see spec.md Clarifications (2026-07-07) for why that's an intentional, non-regressive scope choice.

---

## Affected Areas

### Files/Components to Inspect
- `src/services/healthApi.js` (contract consumer; confirm response shape — inspect only)
- `src/services/supabaseClient.js` (`isHostedAuthAvailable` — the synchronous env-var gate; inspect only)
- `src/data/authStore.js` (`init()` / `getSession()` timing and the `initializing`→resolved transition; inspect only)
- `src/pages/Tracker.js` (skeleton→hydrate handoff seam; inspect, minimal touch)
- `src/components/Footer.js`, `src/components/UpdateToast.js`, `src/data/updateController.js` (null-`_runtimeHealth` tolerance; inspect, minimal touch)
- `src/data/demoStore.js` / demo seed (verify demo boot unaffected — inspect only)

### Files/Components to Modify
- `index.html` (inlined loader markup + critical CSS, scoped class names, HTML comment markers delimiting the loader block, + sigil `<svg>`; WS5 font strategy)
- `server/index.js` (`serveStatic` catch-all strips the marked loader block from the response when `!config.isHosted` — WS1, portable)
- `vite.config.js` (new `stripStartupLoaderInDev` plugin, `apply: 'serve'`, strips the marked loader block for `npm run dev` — WS1, local dev)
- `src/main.js` (`bootstrap()` — parallel handshake with `local-mode` held behind health; `render()` — deferred loader teardown, skeleton branch, Footer/UpdateToast remount-on-late-health; `mountAppShell()`; `navigate()` — async, optimistic tab-highlight before await, lazy imports — WS1/WS2/WS3/WS4)
- `src/utils/skeletons.js` (add a Tracker-boot skeleton builder — WS3; **not** a new component file)
- `src/components/Footer.js` (no code change expected — confirm `render()` can be safely re-invoked/replaced; inspect for any mount-time-only side effects)
- `src/components/UpdateToast.js` (no code change expected — confirm `destroy()` + re-`mount()` is side-effect-safe when called a second time)
- `src/styles/main.css` (loader fade-out/exit-transition class, skeleton styles, reduced-motion)
- **New**: a loader-lifecycle helper in `main.js` (deferred teardown/fade) — WS1
- `package.json` / `package-lock.json` / `README.md` / `src/pages/welcome/shared/appMeta.js` (version bump at Release Prep — from the post-042 baseline, expected 1.11.0 → 1.12.0)
- `docs/feature_roadmap.md`, `CHANGELOG.md`, `docs/REPO_MAP.md`, `docs/deployment.md` if runtime modes/env change (Release Prep)
- **New**: `specs/044-hosted-startup-performance/metrics.md` (WS0 baseline + per-phase results)
- WS5 only: `package.json`/`package-lock.json` if a self-hosted font package is added

### Tests to Add or Update
- `tests/main.test.js` (boot: loader lifecycle with deferred teardown, parallel handshake — `authenticated`/`unauthenticated` no-wait vs. `local-mode` held-for-health, ConfigError-no-flash for the `local-mode`-misconfig case, null-health tolerance + explicit Footer/UpdateToast remount on late resolve, boot timeout/Retry, reduced-motion)
- `tests/utils/skeletons.test.js` (extend for the new Tracker-boot builder; WS3 — not a new test file for a new component)
- **New**: loader render/a11y test (`role="status"`/`aria-live`, reduced-motion, scoped class names) — WS1
- **New**: portable static-serving test asserting the served HTML excludes the loader markers entirely, and hosted's response includes them — WS1
- **New**: `vite.config.js` dev-server test (or build-output assertion) confirming `stripStartupLoaderInDev` removes the loader block under `serve` and leaves it intact under `build` — WS1
- WS4: `navigate()` tests for optimistic tab-highlight-before-await, async race/latest-wins + chunk-load-failure fallback (including active-state revert)
- `tests/release-metadata.test.js` (version assertion at Release Prep)
- Build test asserting code-split chunks (WS4) and no render-blocking font request (WS5)

### Areas Explicitly Out of Scope
- Data layer / `createRepositories` / schema / required fields (untouched).
- Issue #109 (application-card click latency) — separate; 044 only ships the WS3 skeleton it will consume.
- Client-side URL-path router.
- Hosting-tier or database-provider migration (free-tier cold-start floor is a design constraint, not a target).
- Visual redesign beyond the loader (brand assets come from 042).
- Local / portable / demo runtime behavior changes.
