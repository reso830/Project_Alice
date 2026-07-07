# Tasks: Hosted Startup Performance

**Feature**: `044-hosted-startup-performance` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small, ordered, and specific. `[P]` marks parallelizable tasks (different files, no shared edits). Status legend: `[x]` done · `[ ]` pending · `[~]` skipped.
Commands: `npm run test:run`, `npm run lint`.

Phase dependency: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08

**Additive rule**: phases are ordered so `npm run test:run` passes after every phase, not just at the end. WS1 (loader) ships before WS2 (handshake) reorders the boot calls; each later phase builds on green.

**Measurement discipline (WS0)**: after every code phase (02–06), re-run the field + lab measurement and append a dated row to [metrics.md](metrics.md). Explicit re-measure tasks are included where a phase is expected to move a metric.

**Constitution validation areas**: this feature introduces **no** data-validation logic — it does not touch status transitions, required-field enforcement, URL validation, or date handling. Those required test areas are therefore N/A here; existing suites covering them must stay green (verified in Release Prep). No new tasks are invented for areas the feature does not change.

**Prerequisite**: 042 (Welcome & Brand Refresh) is merged — WS1 reuses its `src/assets/logo/alice-sigil-full.svg` and Sora setup (see T002).

## Phase summary

| Phase | Focus (Workstream) | Tasks | Stories |
|---|---|---|---|
| 01 | Baseline measurement (WS0) | T001–T002 | US0 |
| 02 | Inlined startup loader (WS1) | T003–T008 | US1, US6 |
| 03 | Bootstrap rework — parallel + optimistic handshake (WS2) | T009–T014 | US2, US4, US5 |
| 04 | App-shell + Tracker skeleton (WS3, extends `skeletons.js`) | T015–T018 | US3 |
| 05 | Route-level lazy loading (WS4) | T019–T023 | US7 |
| 06 | Font loading (WS5) | T024–T026 | US8 |
| 07 | Release Prep | T027–T032 | — |
| 08 | Browser Smoke Test | T033–T034 | US0–US8 |

---

## Phase 01: Baseline Measurement (WS0)

**Purpose**: Establish the before-numbers so every later phase's gain is provable. No code changes.

- [~] T001 Create `metrics.md` and record the hosted baseline
  - **Target**: [specs/044-hosted-startup-performance/metrics.md](metrics.md) (new)
  - **Expected behavior**: Capture field (Speed Insights p75 FCP/LCP/CLS/INP/TTFB) and lab (segmented cold DevTools trace: TTFB, bundle download, parse/exec, `/api/health`, `getSession`, Tracker fetch), with **cold vs. warm** `/api/health` isolated. Write the `baseline` row using the table shape in [data-model.md](data-model.md) §4.
  - **Constraints**: hosted deployment only; local mode does not reproduce cold-start behavior.
  - **Validation/test**: `metrics.md` exists with a populated `baseline` row.
  - **Out of scope**: any source change.
  - **Skipped/blocked note (2026-07-07)**: `metrics.md` was created with the known rough FCP/LCP baseline from the approved feature brief/spec, but the exact Vercel Speed Insights p75 values and hosted cold DevTools trace were not available in-repo. Do not treat WS0 as fully measured until the pending baseline cells are replaced with direct hosted measurements.

- [x] T002 Confirm the 042 brand-asset dependency is present
  - **Target**: inspect `src/assets/logo/alice-sigil-full.svg` and the Sora font setup in [index.html](../../index.html)
  - **Expected behavior**: The sigil asset and Sora are available on this branch (042 merged). If absent, WS1 is blocked — stop and surface that 042 has not merged.
  - **Validation/test**: `src/assets/logo/alice-sigil-full.svg` exists.
  - **Out of scope**: re-exporting or modifying brand assets (they come from 042).
  - **Implementation note (2026-07-07)**: Verified `src/assets/logo/alice-sigil-full.svg` exists and `index.html` loads Sora from Google Fonts.

---

## Phase 02: Inlined Startup Loader (WS1)

**Purpose**: Kill the blank white page — paint a branded loader before `main.js`, hosted only. Boot handshake stays sequential this phase; only the loader lifecycle changes. Local dev and portable are scoped out at the serving layer (Vite plugin / Express catch-all respectively): the loader markup never appears in their response body (see T003), so there is nothing to fast-path past in either.

- [x] T003 Inline the loader markup + critical CSS into `index.html`, delimited for hosted-only delivery
  - **Target**: [index.html](../../index.html) — inside `<div id="app">`; [server/index.js](../../server/index.js) — the `serveStatic` catch-all (portable); [vite.config.js](../../vite.config.js) — new dev-server plugin (local dev)
  - **Expected behavior**: Recreate the `HostedAlice_StartupLoader/` handoff: centered sigil + "Project Alice" wordmark + status line ("Getting things ready…") over `#F4F1ED`, with a **static** two-layer inset `box-shadow` edge glow. Sigil inlined as `<svg>` (from `src/assets/logo/alice-sigil-full.svg`) — no network fetch, not an LCP candidate. Status line carries `role="status"` / `aria-live="polite"`. Critical CSS inlined so it paints before the module bundle. Wrap the loader block in HTML comment markers (`<!-- STARTUP-LOADER:START -->` / `<!-- STARTUP-LOADER:END -->`). Two separate strip mechanisms, one per non-hosted serving path: (a) change `server/index.js`'s `serveStatic` catch-all (currently a plain `res.sendFile(path.join(distDir, 'index.html'))`) to read the file once (cached in memory), strip the marked block when `!config.isHosted`, and send the stripped HTML — covers portable; (b) add a `stripStartupLoaderInDev` Vite plugin (`apply: 'serve'`) using `transformIndexHtml` to strip the same block — covers `npm run dev`, which serves the source `index.html` directly via Vite and goes through neither Vercel's CDN nor `server/index.js`. Hosted's CDN-served static file (per `vercel.json`, never routed through Express) and the `vite build` output (consumed by both hosted and portable) are both untouched by either mechanism.
  - **Constraints**: **no motion on the glow at any breakpoint** (per updated handoff); wordmark stays 26px desktop (LCP hygiene); no large full-screen splash. **Use scoped class names** (e.g. `.startup-loader__edge-glow`, `.startup-loader__edge-glow-base`) — do **not** use the bare `.edge-glow`/`.edge-glow__base` names from the handoff verbatim, since the separate in-app-loader handoff (042) independently prototypes the same literal names for a visually different (rotating) treatment; a global-scope collision is avoidable at zero cost by prefixing. Local dev and portable must each receive **zero** loader markup in the response body — not a client-side hide, a server/build-side strip in both.
  - **Validation/test**: build succeeds; a cold hosted load shows the loader before the bundle finishes (verified in Phase 08); a local dev (`vite dev`) response and a portable request for `/` each contain neither loader marker. Unit coverage in T007.
  - **Out of scope**: bootstrap handshake parallelization (Phase 03); skeleton (Phase 04).

- [x] T004 Add responsive breakpoint styling for the loader
  - **Target**: [index.html](../../index.html) critical `<style>` (and/or `src/styles/main.css`)
  - **Expected behavior**: Desktop / tablet-portrait / mobile-portrait per the handoff table — icon 140/120/92px, wordmark 26/22/18px, subtitle 14/13/13px, glow shadow scaled (purple `90/34/22`, gold `150/58/40`). Loader stays centered with no clipping/overflow.
  - **Constraints**: values come from the handoff README table (the prototype HTML only renders desktop).
  - **Validation/test**: manual resize at three widths (Phase 08 US1); no test asserts pixel sizes.
  - **Out of scope**: landscape-specific tuning (handoff specifies portrait breakpoints only).

- [x] T005 Rework `bootstrap()` / mount teardown so the loader survives the handshake, with a real (deferred) fade
  - **Target**: [src/main.js](../../src/main.js) — `bootstrap()` (remove the eager `existingRoot?.remove()`), and the first-mount teardown in `mountWelcome` / `mountAppShell` / `mountConfigError`
  - **Expected behavior**: The inlined loader stays visible through the handshake and is torn down exactly once, at the first destination mount. Teardown applies an exiting/fade CSS class to the loader and **defers** the actual `clearBody()` call until the transition ends (`transitionend`, with a `setTimeout` fallback in case the event doesn't fire) — `clearBody()` must **not** run synchronously in the same tick the fade starts, or there is nothing left to fade. No blank frame between loader and first UI.
  - **Constraints**: do **not** change the handshake ordering yet (still sequential `runtimeHandshake()` → `authStore.init()`); single teardown path only; under `prefers-reduced-motion` the transition duration is zero (immediate `clearBody()`).
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) — loader present during handshake, torn down once on first mount, `clearBody()` deferred until transition-end (or immediate under reduced-motion).
  - **Out of scope**: parallelization (Phase 03).

- [x] T006 Suppress the loader→app transition under `prefers-reduced-motion`
  - **Target**: [index.html](../../index.html) critical CSS / `src/styles/main.css`
  - **Expected behavior**: Under `prefers-reduced-motion: reduce`, the loader→app fade is disabled (instant swap). The glow is already static, so nothing else to disable.
  - **Validation/test**: T007 asserts no animated transition under the reduced-motion query.

- [x] T007 [P] Loader render + a11y + lifecycle tests, plus local-dev/portable stripping tests
  - **Target**: [tests/main.test.js](../../tests/main.test.js) (+ a new loader test if cleaner); a `server/index.js` static-serving test; a `vite.config.js` plugin test
  - **Expected behavior**: Assert the loader renders with `role="status"`/`aria-live`, the glow layer has no animation, the loader is torn down once on first mount, and reduced-motion disables the crossfade. Separately, assert `createApp({ serveStatic: true, config: { isHosted: false } })`'s served HTML excludes both loader markers entirely, while `{ isHosted: true }` includes them (portable/hosted). Separately, assert `stripStartupLoaderInDev`'s `transformIndexHtml` strips both markers from a sample HTML string (local dev), and that the plugin's `apply: 'serve'` means it does not run during `vite build`.
  - **Validation/test**: `npm run test:run` green.

- [~] T008 Re-measure after WS1 and record
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: Append a `WS1` row. Expect FCP to collapse (~8s → ~1s); LCP roughly unchanged.
  - **Validation/test**: `WS1` row present.
  - **Skipped/blocked note (2026-07-07)**: `metrics.md` now has a `WS1` row, but exact hosted Speed Insights p75 values and a cold hosted DevTools trace require deployment/dashboard/browser access that is not available in-repo. Do not use the pending row for a quantitative perf claim until those cells are replaced with direct measurements.

---

## Phase 03: Bootstrap Rework — Parallel + Optimistic Handshake (WS2)

**Purpose**: Cut the real wait. Run the two boot calls concurrently and stop making signed-out/signed-in visitors pay the health cold start — **without** reintroducing the flash-of-app-before-ConfigError bug that plan review found in the original "Option 1" design. Preserve the boot-handshake contract in [contracts/api.md](contracts/api.md) §2 (C1–C6).

- [x] T009 Run `getHealth()` and `authStore.init()` concurrently, routing only the two network-backed outcomes immediately
  - **Target**: [src/main.js](../../src/main.js) — `bootstrap()`
  - **Expected behavior**: Start both calls concurrently. `authStore.subscribe(render)` so `unauthenticated`/`authenticated` — both reached **only** via a genuine `supabase.auth.getSession()` call, which only runs when `isHostedAuthAvailable === true` — mount Welcome/shell as soon as the session resolves, **without awaiting health** (C1, C2). The `local-mode` outcome (which `authStore.init()` sets **synchronously, with no network call**, whenever `isHostedAuthAvailable` is false) does **not** mount anything yet — see T010.
  - **Constraints**: do not generalize "route on session resolve" to `local-mode` — that was the plan-review's critical finding (a misconfigured hosted deploy resolves `local-mode` faster than `getHealth()` and would otherwise flash the app shell before ConfigError overrides it).
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) — `authenticated`/`unauthenticated` do not await health; `local-mode` does not mount immediately.
  - **Out of scope**: skeleton (Phase 04).
  - **Implementation note (2026-07-07)**: `bootstrap()` now kicks off `runtimeHandshake(deps)` and `authStore.subscribe(render)` + `authStore.init()` concurrently (no longer `await`ing the handshake first). `render()` mounts `authenticated`/`unauthenticated`/`demo` immediately.

- [x] T010 Hold `local-mode` behind `getHealth()`, then preserve ConfigError correctness for a misconfigured deploy
  - **Target**: [src/main.js](../../src/main.js) — `render()`/`bootstrap()` handling of the `local-mode` status; `runtimeHandshake()` result handling
  - **Expected behavior**: When `authStore`'s state is `local-mode`, do **not** mount the shell until `getHealth()` has also resolved. Once health resolves: if `health.runtime === 'hosted' && !hostedAuthAvailable`, mount ConfigError (C3) — this is the case where `local-mode` meant "hosted deploy missing its build-time env vars." Otherwise (genuine local/portable build), proceed to mount the shell for `local-mode` exactly as today. Either way, **no flash of Welcome or the app shell** precedes the correct outcome.
  - **Constraints**: this is the fix for the plan-review CRITICAL finding — do not let `local-mode` mount before health resolves, under any circumstance.
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) — `local-mode` + health confirms misconfig → ConfigError only, no shell flash; `local-mode` + health confirms a genuine local build → shell mounts (after health, not before).
  - **Implementation note (2026-07-07)**: `render()` queues a `local-mode` state in `_pendingLocalModeState` and returns (no mount) while `!_healthSettled`. The health-resolution handler in `bootstrap()` clears the pending state and either mounts `ConfigError` or re-renders the pending `local-mode` state (now `_healthSettled === true`, so it proceeds to `mountAppShell()`).

- [x] T011 Make `mountAppShell()` tolerate a null health result and explicitly remount Footer/UpdateToast on late resolve
  - **Target**: [src/main.js](../../src/main.js) — `mountAppShell()`; consumers `Footer.render({ runtime })`, `UpdateToast.mount({ health })`, `subscribeUpdateController` (gated on `updateSupported`)
  - **Expected behavior**: For the `authenticated` fast path, the shell mounts without waiting on health (`_runtimeHealth` may be null at that point). When health resolves afterward, `main.js` **replaces** the existing footer element with a fresh `Footer.render({ runtime })` call and **re-invokes** `UpdateToast.mount({ health })` (after `UpdateToast.destroy()`), re-evaluating the update-controller subscription (C5). Do **not** rely on an in-place "patch" — neither `Footer.js` nor `UpdateToast.js` exposes one (confirmed in plan review: `Footer.render()` is a one-shot factory; `UpdateToast.mount()` bails with no subscriptions when `health` is null).
  - **Constraints**: no regression to demo/local shell mounting; the `local-mode` path (T010) already has health resolved by the time it mounts, so this remount step is specific to the `authenticated` fast path.
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) — shell mounts with null health for `authenticated`, then the footer element is replaced and `UpdateToast.mount()` is re-invoked once health resolves.
  - **Implementation note (2026-07-07)**: added `refreshHealthDependentChrome()`, invoked from the health-resolution handler when `_shellMounted` is already true — swaps `.site-footer` via `oldFooter.replaceWith(newFooter)`, re-subscribes `subscribeUpdateController()` if `updateSupported`, and re-invokes `UpdateToast.mount()` (which self-destroys any prior instance).

- [x] T012 Add the boot-timeout Retry affordance
  - **Target**: [src/main.js](../../src/main.js) — `bootstrap()`; loader markup in [index.html](../../index.html) (hidden Retry element)
  - **Expected behavior**: If nothing has mounted ~10s after boot starts, the loader reveals "taking longer than expected" + a Retry control; Retry calls `window.location.reload()` (C6). Never an indefinite wait.
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) with fake timers — timeout reveals Retry; Retry triggers reload.
  - **Implementation note (2026-07-07)**: added `.startup-loader__retry` (hidden button) to `index.html`'s loader markup. `startBootTimeout()`/`markBootSettled()` in `main.js` start a 10s timer at the top of `bootstrap()` and clear it the moment any destination calls `prepareBodyForFirstMount()`; on fire, the status text swaps to "Taking longer than expected…" and the Retry button is revealed, focused, and wired to a (test-injectable) `reloadPage`.

- [x] T013 WS2 boot-handshake test suite
  - **Target**: [tests/main.test.js](../../tests/main.test.js)
  - **Expected behavior**: Cover C1–C6 — `authenticated`/`unauthenticated` route without a health wait; `local-mode` waits for health before mounting anything; ConfigError-no-flash for the misconfigured (`local-mode` + hosted + missing env vars) case; null-health tolerance + explicit Footer replace/UpdateToast remount on late resolve; boot timeout/Retry.
  - **Validation/test**: `npm run test:run` green.
  - **Implementation note (2026-07-07)**: added/updated coverage for C1 (authenticated mounts before a pending health call resolves), C2/C3 (local-mode + deferred health — no flash of Welcome/shell, ConfigError-only outcome), C5 (Footer element replaced + `UpdateToast.mount()` re-invoked on late health resolve), C6 (fake-timer boot-timeout reveal + Retry→reload, and a no-timeout-after-mount case). Two pre-existing tests encoded the old *sequential* guarantee (`authStore.subscribe`/`init()` never called on the ConfigError path) and one paired an unrealistic `isHostedAuthAvailable: false` with `state: 'unauthenticated'` (real `authStore.init()` never produces that combination) — both rewritten to assert the correct WS2 guarantee (concurrent subscribe/init, but still no flash) against a realistic `local-mode` fixture. `npm run test:run` (136 files / 1810 tests) and `npm run lint` both green.

- [~] T014 Re-measure after WS2 and record
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: Append a `WS2` row. Expect LCP to drop (signed-out especially).
  - **Validation/test**: `WS2` row present.
  - **Skipped/blocked note (2026-07-07)**: `metrics.md` has a `WS2` row, but exact hosted Speed Insights p75 values and a cold hosted DevTools trace require deployment/dashboard/browser access not available in-repo — same residual risk already recorded for `baseline`/`WS1`. Do not use the pending row for a quantitative perf claim until those cells are replaced with direct measurements.

---

## Phase 04: App-shell + Tracker Skeleton (WS3)

**Purpose**: Make the signed-in handoff feel instant — shell + skeleton before data — by extending the **existing** skeleton system, not building a parallel one.

- [x] T015 Add a Tracker-boot skeleton builder to the existing `src/utils/skeletons.js`
  - **Target**: [src/utils/skeletons.js](../../src/utils/skeletons.js) (extend — **not** a new component file)
  - **Expected behavior**: Add a new builder function (alongside the existing `buildApplicationListSkeleton` / `buildProfileSkeleton` / `buildCalendarSkeleton`) that renders placeholder shapes for the Tracker boot handoff, following the same pattern: presentational DOM builder, `aria-busy="true"`, `aria-live="polite"`, `aria-label`, no application data (see [data-model.md](data-model.md) §3).
  - **Constraints**: plan review found `skeletons.js` already exists and is already used by `Tracker.js`/`Profile.js`/`Calendar.js` — do **not** introduce a new `Skeleton.js` component; reuse the established pattern and its existing `loading-skeleton`/`skeleton-*` CSS classes. Reduced-motion-safe (no shimmer that violates the motion rule, or shimmer disabled under reduced-motion).
  - **Validation/test**: T017.
  - **Out of scope**: issue #109 click-feedback (separate ticket; only the builder is shipped here, for #109 to consume from `skeletons.js` later).
  - **Implementation note (2026-07-07)**: added `buildTrackerBootSkeleton()`, reusing a factored-out `appendSkeletonCards()` helper shared with `buildApplicationListSkeleton()` (no visual/DOM change to the existing builder — verified against its exact-`outerHTML` test). Distinct `loading-skeleton--tracker-boot` modifier class + `aria-label="Loading your applications"` so it's identifiable separately from the plain reload/retry skeleton. No shimmer/animation on either builder, so no reduced-motion concern.

- [x] T016 Render the Tracker skeleton on the signed-in handoff
  - **Target**: [src/main.js](../../src/main.js) — `mountAppShell()` / `navigate('tracker')`; seam in [src/pages/Tracker.js](../../src/pages/Tracker.js)
  - **Expected behavior**: The shell + Tracker skeleton (from T015) render before data; real application rows replace the skeleton when data arrives — no blank gap between loader and shell.
  - **Constraints**: minimal Tracker touch (a hydrate seam, not a rewrite).
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) — skeleton before data, rows replace it on resolve.
  - **Implementation note (2026-07-07)**: investigated first — `Tracker.mount()` already renders its toolbar + a skeleton **synchronously**, before its first `await` (`loadInitialLists()`), and `navigate()`/`mountAppShell()` call it without awaiting, so there is no actual blank-gap bug today; everything happens in one synchronous tick. Per user decision, kept this a Tracker.js-only seam (no `main.js` change): `renderApplicationListSkeleton(buildSkeleton = buildApplicationListSkeleton)` now takes an optional builder, and `mount()`'s one initial (pre-load) call passes `buildTrackerBootSkeleton` — `retryInitialLoad()`/`reloadCurrentView()` are untouched and keep the plain skeleton. Real test target ended up being `tests/pages/Tracker.test.js` (where this behavior is actually observable), not `tests/main.test.js` (which mocks `Tracker` as a complete no-op) — task doc's stated test target was imprecise on this point.

- [x] T017 [P] Skeleton builder test
  - **Target**: [tests/utils/skeletons.test.js](../../tests/utils/skeletons.test.js) (extend existing file — not a new test file)
  - **Expected behavior**: New builder renders the expected placeholder shape; exposes `role`/`aria-busy`/`aria-live`; no data dependency.
  - **Validation/test**: `npm run test:run` green.
  - **Implementation note (2026-07-07)**: added a test asserting class/`aria-busy`/`aria-live`/`aria-label`, 3 skeleton cards, ≥9 skeleton lines, and empty `textContent` (no application data). Also extended `tests/pages/Tracker.test.js`'s existing skeleton/retry/view-switch tests to assert the boot skeleton appears only on the initial mount, not on retry or view-switch.

- [x] T018 Re-measure after WS3 and record
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: Append a `WS3` row (signed-in LCP/feel).
  - **Validation/test**: `WS3` row present.
  - **Skipped/blocked note (2026-07-07)**: `metrics.md` has a `WS3` row, but real hosted Speed Insights/DevTools numbers require deployment/dashboard/browser access not available in-repo (same residual risk as `baseline`/`WS1`/`WS2`). Noted in the row itself: since the handoff was already gap-free, this phase is not expected to move LCP much — its value is the dedicated, #109-reusable boot skeleton and its distinct a11y label, not a new real-wait reduction.

---

## Phase 05: Route-level Lazy Loading (WS4)

**Purpose**: Trim the initial bundle by code-splitting non-landing routes. *Final feature phase; may split to its own feature if the race/chunk handling balloons.*

- [x] T019 Record the pre-split bundle baseline
  - **Target**: build + [metrics.md](metrics.md)
  - **Expected behavior**: Run the bundle visualizer; record initial bundle size in a `WS4-pre` note so the split is evidence-driven.
  - **Validation/test**: bundle size recorded.
  - **Implementation note (2026-07-07)**: ran `vite build` locally (dummy `VITE_SUPABASE_*` env vars) instead of adding a bundle-visualizer dependency — Vite's own build output already reports per-chunk sizes, and its own warning ("Some chunks are larger than 500 kB... consider dynamic import()") independently confirms the phase's motivation. `WS4-pre` row recorded in metrics.md: single main chunk, 600.88 kB raw / 169.05 kB gzip.

- [x] T020 Dynamic-import `Calendar` / `Profile` / `ProfileEdit`; keep `Tracker` eager; update nav state before the `await`
  - **Target**: [src/main.js](../../src/main.js) — remove the static imports at lines 10–13 for those three; `import()` them inside `navigate()`; make `navigate()` async
  - **Expected behavior**: Non-landing routes load as separate chunks on navigation; `Tracker` stays in the initial bundle (N5). `_currentPage`/`Navbar.setActive`/`BottomTabBar.setActive` update, and the T015 skeleton renders in the workspace, **immediately — before the `import()` is awaited** (N6), not after it resolves as today's code does.
  - **Constraints**: keep the `!appRoot || page === _currentPage` and `ProfileEdit.confirmNavigation(page)` early-returns **before any `await`** (N1, N2). Plan-review finding: today's `navigate()` only updates nav-highlight state *after* mounting the new page — deferring the mount behind an awaited import without also moving the nav-state update earlier would leave the nav bar showing the *previous* tab as active while the workspace is blank.
  - **Validation/test**: T022; build test asserts the split.
  - **Out of scope**: lazy-loading `Tracker`.
  - **Implementation note (2026-07-07)**: `navigate()` is now `async`; N1/N2 guards run first (no `await` before them). `_currentPage`/`Navbar.setActive`/`BottomTabBar.setActive` update immediately, then (for non-Tracker pages) the WS3 `buildTrackerBootSkeleton()` is appended to the workspace as a generic placeholder — the destination page's own layout doesn't exist yet since its module isn't loaded, so its own page-specific skeleton isn't available at this point. One real design snag: `ProfileEdit.confirmNavigation(page)` (N2) must run synchronously, but `ProfileEdit` is no longer statically imported — resolved by caching the resolved module in `_profileEditModule` on first successful mount (guaranteed populated before `_currentPage` could ever be `'profile-edit'`).

- [x] T021 Add latest-wins guard + chunk-load-failure fallback (with active-state revert)
  - **Target**: [src/main.js](../../src/main.js) — `navigate()`
  - **Expected behavior**: A slow chunk cannot mount over a newer navigation (latest-wins token, N3); an `import()` rejection (stale/failed chunk) is caught, offers a reload fallback (N4, same affordance as the boot Retry), and **reverts** the optimistic tab-highlight/skeleton from T020 back to the previous page.
  - **Validation/test**: T022.
  - **Implementation note (2026-07-07)**: a monotonically-incrementing `_navToken` is captured synchronously right after the N1/N2 guards (i.e. on *every* committed navigation, eager or lazy) and re-checked after the `import()` settles — this covers a subtle case: an eager navigation to `tracker` must also invalidate an earlier lazy navigation's in-flight token, so the token bump can't be scoped only to the lazy branch. On rejection, "same affordance as the boot Retry" is implemented via the existing `renderInlineError()` (`src/utils/asyncUI.js`, already used by Tracker's own load-failure state) rather than reusing the startup loader's DOM (long gone by the time in-app navigation happens) — message + "Reload" button, calling `location.reload()`.

- [x] T022 WS4 navigation + chunk tests
  - **Target**: [tests/main.test.js](../../tests/main.test.js) + a build/chunk assertion test
  - **Expected behavior**: Nav highlight/skeleton update before the `await`, not after (N6); early-returns run before any `await`; latest-wins holds under rapid navigation; `import()` rejection → reload fallback + active-state revert; build shows `Calendar`/`Profile`/`ProfileEdit` split out and `Tracker` eager.
  - **Validation/test**: `npm run test:run` green.
  - **Implementation note (2026-07-07)**: real dynamic-`import()` timing/rejection is impractical to control precisely against a `vi.mock`'ed page module (ES module resolution is cached per specifier across tests), so added a test-only `_setLazyPageImporterForTesting(page, importer)` seam (mirroring the existing `_resetForTesting()` convention) letting tests swap in deferred/rejecting importers. Added `tests/main.test.js` coverage for N1 (no-op on same-page nav), N6 (nav highlight + skeleton before the import resolves), N3 (a later eager nav wins over an earlier pending lazy import), and N4 (rejection reverts the highlight and shows the inline-error Reload affordance). Added `tests/build/code-splitting.test.js` — spawns a real `vite build` (dummy env vars, scratch `--outDir`) and asserts `Calendar-*.js`/`Profile-*.js`/`ProfileEdit-*.js` chunks exist and a Tracker-only string marker is present only in the main `index-*.js` chunk.

- [x] T023 Re-measure after WS4 and record
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: Append a `WS4` row with the post-split bundle size (parse/download tail).
  - **Validation/test**: `WS4` row present.
  - **Implementation note (2026-07-07)**: unlike other WS rows, bundle size doesn't require hosted deployment access — it's a real, measured local build result, not a placeholder. Main chunk: 600.88 kB → 489.27 kB raw (−18.6%), 169.05 kB → 136.68 kB gzip (−19.1%). New chunks: `Calendar` 34.70 kB, `Profile` 34.99 kB, `ProfileEdit` 44.19 kB (gzip 10.77/11.46/13.84 kB respectively). Hosted FCP/LCP impact from the smaller initial download is still pending live Speed Insights/DevTools access, consistent with prior rows' residual risk.

---

## Phase 06: Font Loading (WS5)

**Purpose**: Get the render-blocking Google Fonts request off the critical path.

- [x] T024 Remove the render-blocking font request from the critical path
  - **Target**: [index.html](../../index.html) lines 8–10 (Google Fonts `preconnect` + stylesheet); `package.json` if self-hosting
  - **Expected behavior**: Self-host **or** preload Sora (400;500;600;700) **and** DM Mono so no render-blocking third-party font stylesheet remains on the critical path; the loader background + sigil paint independent of Sora (text may swap in).
  - **Constraints**: if a self-hosted font package is added (e.g. `@fontsource/sora`), record the dependency justification (constitution — see [plan.md](plan.md) Constitution Check). Preload adds no dependency.
  - **Validation/test**: T025.
  - **Out of scope**: changing the app's typefaces.
  - **Implementation note (2026-07-07)**: self-hosting chosen (per user decision — removes the third-party origin entirely, more consistent with local-first, vs. preload which keeps it). Added `@fontsource/sora` (^5.2.8) and `@fontsource/dm-mono` (^5.2.7); removed the `preconnect` + `<link rel=stylesheet href="fonts.googleapis.com/...">` from `index.html`; added `@import '@fontsource/sora/{400,500,600,700}.css'` and `@import '@fontsource/dm-mono/{400,500}.css'` to the top of `src/styles/main.css`. Verified via a real build: Vite bundles the `@font-face` rules (all `font-display: swap`) into the same CSS output already loaded async relative to first paint — no new render-blocking resource, and the fully self-contained inline startup loader is unaffected either way. Dependency justification recorded in plan.md's Constitution Check.

- [x] T025 [P] Assert no render-blocking font request
  - **Target**: a build/DOM test (e.g. `tests/build/…`)
  - **Expected behavior**: The built `index.html` has no render-blocking `fonts.googleapis.com` stylesheet on the critical path.
  - **Validation/test**: `npm run test:run` green.
  - **Implementation note (2026-07-07)**: added `tests/build/font-loading.test.js` — one test spawns a real `vite build` (scratch `--outDir`, matching the `code-splitting.test.js` convention from Phase 05) and asserts no `fonts.googleapis.com`/`fonts.gstatic.com` in the built `index.html`, that the bundled CSS contains the self-hosted `@font-face` rules (`font-display: swap`), and that `.woff2` files for both typefaces are emitted; two lighter tests assert the source `index.html` is clean and `main.css` imports the exact weights actually used (Sora 400/500/600/700, DM Mono 400/500).

- [x] T026 Re-measure after WS5 and record
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: Append a `WS5` row (FCP tail). Confirm the documented, measured FCP/LCP improvement vs. baseline; note the free-tier cold-start floor where it caps LCP.
  - **Validation/test**: `WS5` row present; before/after summary written.
  - **Implementation note (2026-07-07)**: `WS5` row present (added during Phase 06 implementation; checkbox update here was retroactive bookkeeping). Structurally verified: 3 third-party `<head>` resources removed entirely (2 `preconnect` + 1 render-blocking stylesheet), confirmed absent from the built `index.html`. CSS bundle 175.46 kB → 180.06 kB raw (+4.6 kB for the self-hosted `@font-face` rules), already loaded async relative to first paint. Hosted FCP delta from removing the third-party round-trip still requires live Speed Insights/DevTools access, consistent with every other WS row's residual risk — no per-phase FCP/LCP numbers are available in any row yet (see Phase 08's final perf-gate task, T034).

---

## Phase 07: Release Prep

**Purpose**: Ship-readiness per constitution Amendment 1.3.0.

- [x] T027 Version bump (SemVer minor)
  - **Target**: `package.json` + `package-lock.json` root `version`, and the in-app version in `src/pages/welcome/shared/appMeta.js` (`APP_VERSION`)
  - **Expected behavior**: Bump from the post-042 baseline (expected **1.11.0 → 1.12.0**; confirm the actual merged-042 version at release time).
  - **Validation/test**: [tests/release-metadata.test.js](../../tests/release-metadata.test.js) updated + green.
  - **Implementation note (2026-07-07)**: actual baseline was **1.11.1**, not the task doc's assumed 1.11.0 — 043 (legal-and-footer) landed as a patch bump after 042's 1.11.0 minor bump. Bumped **1.11.1 → 1.12.0** (minor), matching the original intent. Updated `package.json`, both `version` fields in `package-lock.json`, and `APP_VERSION` in `appMeta.js`. Two other test files (`tests/pages/Profile.account.test.js`, `tests/pages/profile.aiSettings.test.js`) hardcoded the old `v1.11.1` version-chip text and needed updating too — caught by the full-suite run, not by `release-metadata.test.js` itself.

- [x] T028 CHANGELOG entry
  - **Target**: `CHANGELOG.md`
  - **Expected behavior**: Add the 044 hosted-startup-performance entry (loader, parallel handshake, skeleton, lazy-loading, fonts) with the measured FCP/LCP improvement.
  - **Validation/test**: entry present under the new version.
  - **Implementation note (2026-07-07)**: added `## [1.12.0] — 2026-07-07` with Added (branded startup loader, Tracker-boot skeleton) and Changed (parallel handshake, route-level code-splitting with the measured bundle-size delta, self-hosted fonts) sections, plus the `[1.12.0]`/updated `[Unreleased]` compare links. No hosted FCP/LCP number is included — none is available yet (see T034); the bundle-size reduction is cited instead since it's the one directly-measured number this feature has.

- [x] T029 Tick the roadmap
  - **Target**: `docs/feature_roadmap.md`
  - **Expected behavior**: Mark the 044 row done.
  - **Validation/test**: row updated.
  - **Implementation note (2026-07-07)**: `- [x] 044-hosted-startup-performance  ·  shipped v1.12.0`.

- [x] T030 README + deployment docs
  - **Target**: `README.md`; `docs/deployment.md` **only if** WS5 self-hosting or any runtime/env change warrants it
  - **Expected behavior**: Document the hosted startup loader surface; note the font strategy in deployment docs if a dependency/runtime detail changed (no env-var changes are expected).
  - **Validation/test**: docs reflect the shipped surface.
  - **Implementation note (2026-07-07)**: added a Features bullet + bumped the "Current version" line in `README.md`. Added a "Hosted Startup Performance — no new env vars" section to `docs/deployment.md` (matching the existing per-feature sub-section convention), noting the hosted-only scoping mechanism and that no env/runtime/schema change is required.

- [x] T031 REPO_MAP for new files
  - **Target**: `docs/REPO_MAP.md`
  - **Expected behavior**: Add new paths — the loader-lifecycle helper (WS1), `specs/044-hosted-startup-performance/` (incl. `metrics.md`), and `HostedAlice_StartupLoader/`. Note `src/utils/skeletons.js` is an existing file being extended, not a new path.
  - **Validation/test**: entries present.
  - **Implementation note (2026-07-07)**: no separate "loader-lifecycle helper" file exists — the loader lifecycle (`prepareBodyForFirstMount`, boot-timeout, etc.) lives as functions inside `src/main.js`, which doesn't have its own REPO_MAP row (referenced inline from other rows only), so there was no single row to update for that specifically. Updated the existing `src/utils/skeletons.js` row to mention `buildTrackerBootSkeleton` (not a new path, per the task's own note); added new rows for `shared/startupLoader.js`, `specs/044-hosted-startup-performance/`, and `HostedAlice_StartupLoader/design_handoff_startup_loader/`; updated the `tests/build/` and `tests/main.test.js` summary rows to mention the new/changed test coverage.

- [x] T032 Docs sanity check + full suite
  - **Target**: repo docs; `npm run test:run`, `npm run lint`
  - **Expected behavior**: Cross-links resolve; constitution required-area suites (status/required-field/URL/date) remain green (this feature added none); lint clean.
  - **Validation/test**: `npm run test:run` and `npm run lint` both green.
  - **Implementation note (2026-07-07)**: verified every path newly referenced in README/deployment.md/REPO_MAP/release-metadata.test.js actually exists on disk. Added a dedicated `it('documents the Hosted Startup Performance release surfaces...')` block to `tests/release-metadata.test.js`, matching the pattern used by earlier substantial features (034–041; 042/043 had skipped this convention). `npm run test:run` (138 files, 1824 tests) and `npm run lint` both green.

---

## Phase 08: Browser Smoke Test

**Purpose**: Walk each user story's Independent Test in a real browser against the to-be-merged state (ordered after Release Prep).

- [ ] T033 Walk US0–US8 on a hosted deployment
  - **Target**: hosted deploy of the merge state
  - **Expected behavior**: Execute each Independent Test in [spec.md](spec.md): US0 baseline recorded; US1 branded loader before bundle **at desktop, tablet-portrait, and mobile-portrait** (centered, scaled, no clipping); US2 signed-out (correctly configured deploy) → Welcome without health wait; US3 signed-in shell + skeleton → data, with Footer/UpdateToast reflecting health even if it resolves late; US4 boot-timeout → Retry (reload); US5 hosted deploy with **env vars removed** → loader stays up through the fast-resolving `local-mode` signal, waits for health, then ConfigError mounts with **no shell/Welcome flash** (this is the plan-review's critical fix — verify explicitly, not just the surface ConfigError outcome); US6 reduced-motion → static glow + instant swap; US7 split chunks / Tracker eager / active-tab highlights immediately while chunk loads / chunk-fail reverts highlight gracefully; US8 no render-blocking font request.
  - **Validation/test**: each story passes in-browser; note results.
  - **Out of scope**: local/portable/demo boot (unchanged — spot-check that they still boot, and confirm no loader markup is present in the served HTML).

- [ ] T034 Confirm the perf gate against baseline
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: The recorded before/after shows a measured FCP/LCP improvement vs. the WS0 baseline; the cold-start floor is called out where it caps LCP. Targets are directional, not hard gates.
  - **Validation/test**: metrics summary present and consistent with the smoke test.
