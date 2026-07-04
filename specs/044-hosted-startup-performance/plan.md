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
**Constraints**: Loader must paint before `main.js`; no flash of Welcome/app before ConfigError; `prefers-reduced-motion` honored; loader LCP hygiene (26px wordmark, inline SVG non-candidate); 042 must merge first (brand sigil + Sora).

---

## Constitution Check

- **Data Fields**: No persistence models or required fields (company, job title, status, `lastStatusUpdate`, responsibilities) are added or modified. The change is confined to the boot path, first paint, bundle splitting, and font loading.
- **Separation of Logic**: The loader is static markup/CSS (no business logic). Boot orchestration stays in `main.js`; routing logic stays in `navigate()`. The skeleton primitive is a presentational component with no data coupling.
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
2. **ConfigError only fires when `health.runtime === 'hosted' && !hostedAuthAvailable`.** `hostedAuthAvailable` (`isHostedAuthAvailable`) is a **synchronous, client-side env-var check** — the health round-trip changes routing *only* when env vars are missing, and that same condition also fails `authStore.init()`. This is what makes optimistic signed-out routing safe (spec Clarifications).

### Target boot path

```
index.html: <div id="app"> now contains inlined loader markup + critical CSS  ← paints before main.js (FCP)
  → bootstrap()
      injectSpeedInsights()
      DO NOT remove the loader up front; start a ~10s boot-timeout timer
      start getHealth() and authStore.init() CONCURRENTLY
      authStore.subscribe(render)
      render(state) on auth resolution:
        unauthenticated → tear down loader → mountWelcome()          ← no health wait (signed-out win)
        authenticated/local/demo → tear down loader → mountAppShell() + Tracker SKELETON  ← data hydrates in
        (health resolves in parallel; patches _runtimeHealth for Footer/UpdateToast)
      if health → configError (only possible when env vars missing) → mountConfigError() (overrides)
      on boot timeout with nothing mounted → loader shows "taking longer… / Retry" (full reload)
```

Phasing (each phase re-runs WS0 measurement):

- **WS0 — Baseline measurement.** Capture field (Speed Insights p75) + lab (segmented cold DevTools trace, cold-vs-warm `/api/health`) numbers into `metrics.md`. Prerequisite; no code.
- **WS1 — Inlined loader.** Add loader markup + critical CSS inside `<div id="app">` in `index.html`; inline the sigil `<svg>`. Rework `bootstrap()`/mount teardown so the loader survives until a destination mounts (fade-out on swap). FCP win; LCP roughly unchanged.
- **WS2 — Parallel + optimistic handshake.** Run `getHealth()` and `authStore.init()` concurrently; route signed-out to Welcome on session resolve without awaiting health; keep ConfigError correctness via the env-var/session-failure path. Real-wait (LCP) win, signed-out especially. *Unlocked by WS1 (loader removes the flash that forces today's sequential order — Task 08.3).*
- **WS3 — App-shell + Tracker skeleton primitive.** Signed-in handoff mounts the shell + a reusable Tracker skeleton before data; data hydrates in. Skeleton built as a shared primitive (#109 later consumes it).
- **WS4 — Route-level lazy loading** *(final phase; split to its own feature only if it balloons).* Convert the static imports of `Calendar`/`Profile`/`ProfileEdit` (main.js:10–13) to dynamic `import()` inside `navigate()`; keep `Tracker` eager. Make `navigate()` async with a latest-wins guard and chunk-load-failure handling.
- **WS5 — Fonts.** Self-host or preload Sora + DM Mono so the render-blocking `fonts.googleapis.com` stylesheet (index.html:8–10) leaves the critical path.

---

## Data Flow

- **No application data flow changes.** `store.load()`, `authStore.init()`/`getSession()`, and Tracker's data fetch send the same payloads; only their **ordering and gating** relative to first paint change.
- **Loader → destination handoff** is driven by the existing `authStore.subscribe(render)` mechanism; render() gains loader-teardown and skeleton-mount branches.
- **Health result** (`_runtimeHealth`) becomes available asynchronously; `mountAppShell()` (Footer runtime label, `UpdateToast`, `subscribeUpdateController`) must tolerate `_runtimeHealth === null` at mount time and patch when it resolves (today it reads `_runtimeHealth` synchronously at mount).
- **Metrics** flow one-way into `metrics.md` (aggregate perf numbers only; no user/application data).

See [data-model.md](./data-model.md) for the boot/loader state machine and the metrics artifact shape; [contracts/api.md](./contracts/api.md) for the `/api/health` response contract and the boot-handshake contract.

---

## Affected Components (overview)

- `index.html` — inlined loader markup + critical CSS + sigil `<svg>`; font strategy (WS5).
- `src/main.js` — `bootstrap()` (parallel handshake, loader lifecycle, timeout), `render()` (loader teardown, skeleton branch), `mountAppShell()` (tolerate null health), `navigate()` (async + lazy imports, WS4).
- New: a loader-lifecycle helper and a reusable **skeleton primitive** component (+ styles).
- `src/styles/main.css` — loader fade-out, skeleton styles, reduced-motion rules.
- `src/services/healthApi.js` — inspected; likely unchanged (contract consumer).
- New doc: `specs/044-hosted-startup-performance/metrics.md` — before/after numbers.

Full inventory in **Affected Areas** below.

---

## Risks and Tradeoffs

- **Loader lifecycle vs. existing teardown.** `bootstrap()` and the mount functions call `clearBody()` / remove `#app` eagerly. Reworking this risks a blank frame or a double-mount if teardown ordering is wrong. Mitigation: a single loader-teardown path invoked at the first destination mount; assert no blank frame in tests.
- **Optimistic routing correctness.** Mounting Welcome before health resolves is only safe because the misconfig case also fails `authStore.init()`. Mitigation: preserve the `render()` `_configErrorMounted` guard and let a late `configError` override via `mountConfigError()` (which unmounts Welcome). Test the env-vars-missing path explicitly.
- **Signed-in mount before health.** `mountAppShell()` reads `_runtimeHealth` synchronously (Footer, UpdateToast, `updateSupported`). Mitigation: make these null-tolerant and patch on health resolve; do not block the shell/skeleton on health.
- **WS4 async navigation races.** Making `navigate()` async introduces interleaving. Mitigation: keep the `!appRoot || page === _currentPage` and `ProfileEdit.confirmNavigation` early-returns **before any `await`** (spec edge case); add a latest-wins token; handle `import()` rejection with a retry/full-reload fallback.
- **WS4 chunk invalidation on redeploy.** Hashed chunks can 404 after a mid-session deploy. Mitigation: catch `import()` rejection → offer reload (same affordance as the boot Retry).
- **WS5 dependency.** Self-hosting adds a package; preloading does not but keeps a third-party origin. Tradeoff captured in research; decision deferred to the WS5 plan.
- **042 sequencing.** Building on un-merged 042 would duplicate/diverge the sigil + Sora. Mitigation: 044 assumes 042 merged; WS1 references 042's assets.
- **Measurement noise.** Free-tier cold starts vary run-to-run. Mitigation: report p75 field data + multiple cold lab traces; isolate cold-vs-warm `/api/health`; call out the floor.

---

## Validation Approach

- **Unit/integration (Vitest):** loader persists through the handshake and is torn down exactly once on first mount; signed-out mounts Welcome without awaiting health; env-vars-missing still reaches ConfigError with no Welcome/app flash; `mountAppShell()` tolerates null health then patches; boot timeout surfaces Retry (reload) and never an infinite spinner; reduced-motion disables the glow; (WS4) `navigate()` early-returns run before `await`, latest-wins holds, chunk-load failure is handled.
- **Build:** bundle visualizer before WS4 to justify code-splitting; assert `Calendar`/`Profile`/`ProfileEdit` are split and `Tracker` stays in the initial chunk after WS4; assert no render-blocking font request after WS5.
- **Perf gate (WS0 discipline):** re-run field + lab after each phase; record before/after in `metrics.md`; the feature passes on a documented, measured FCP/LCP improvement vs. baseline (targets directional).
- **Browser Smoke Test (final phase):** walk each user story's Independent Test (US0–US8) against the to-be-merged state.

---

## Persistence Runtimes

This feature does **not** touch the data layer routed through `createRepositories(config)`. Both **local** (SQLite) and **hosted** (Supabase) runtimes are unaffected at the persistence level; the boot handshake only reorders *when* the existing `getHealth`/`getSession`/`store` calls run. **Demo mode** runs on the local path and is out of scope for the runtime changes (it is fast-pathed past the hosted loader/handshake); the only demo touch-point is ensuring `mountAppShell()`'s demo branch still works when `_runtimeHealth` is null at mount.

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
- `index.html` (inlined loader markup + critical CSS + sigil `<svg>`; WS5 font strategy)
- `src/main.js` (`bootstrap()`, `render()`, `mountAppShell()`, `navigate()` — WS1/WS2/WS3/WS4)
- `src/styles/main.css` (loader fade-out, skeleton styles, reduced-motion)
- **New**: `src/components/Skeleton.js` (or similar) — reusable skeleton primitive (WS3)
- **New**: `src/components/StartupLoader.js` helper *or* a loader-lifecycle function in `main.js` (teardown/fade) — WS1
- `package.json` / `package-lock.json` / `README.md` / `src/pages/welcome/shared/appMeta.js` (version bump at Release Prep — from the post-042 baseline, expected 1.11.0 → 1.12.0)
- `docs/feature_roadmap.md`, `CHANGELOG.md`, `docs/REPO_MAP.md`, `docs/deployment.md` if runtime modes/env change (Release Prep)
- **New**: `specs/044-hosted-startup-performance/metrics.md` (WS0 baseline + per-phase results)
- WS5 only: `package.json`/`package-lock.json` if a self-hosted font package is added

### Tests to Add or Update
- `tests/main.test.js` (boot: loader lifecycle, parallel handshake, optimistic signed-out routing, ConfigError-no-flash, null-health tolerance, boot timeout/Retry, reduced-motion)
- **New**: `tests/components/skeleton.test.js` (skeleton primitive; WS3)
- **New**: loader render/a11y test (`role="status"`/`aria-live`, reduced-motion) — WS1
- WS4: `navigate()` tests for async race/latest-wins + chunk-load-failure fallback
- `tests/release-metadata.test.js` (version assertion at Release Prep)
- Build test asserting code-split chunks (WS4) and no render-blocking font request (WS5)

### Areas Explicitly Out of Scope
- Data layer / `createRepositories` / schema / required fields (untouched).
- Issue #109 (application-card click latency) — separate; 044 only ships the WS3 skeleton it will consume.
- Client-side URL-path router.
- Hosting-tier or database-provider migration (free-tier cold-start floor is a design constraint, not a target).
- Visual redesign beyond the loader (brand assets come from 042).
- Local / portable / demo runtime behavior changes.
