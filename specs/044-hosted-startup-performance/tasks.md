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

- [ ] T001 Create `metrics.md` and record the hosted baseline
  - **Target**: [specs/044-hosted-startup-performance/metrics.md](metrics.md) (new)
  - **Expected behavior**: Capture field (Speed Insights p75 FCP/LCP/CLS/INP/TTFB) and lab (segmented cold DevTools trace: TTFB, bundle download, parse/exec, `/api/health`, `getSession`, Tracker fetch), with **cold vs. warm** `/api/health` isolated. Write the `baseline` row using the table shape in [data-model.md](data-model.md) §4.
  - **Constraints**: hosted deployment only; local mode does not reproduce cold-start behavior.
  - **Validation/test**: `metrics.md` exists with a populated `baseline` row.
  - **Out of scope**: any source change.

- [ ] T002 Confirm the 042 brand-asset dependency is present
  - **Target**: inspect `src/assets/logo/alice-sigil-full.svg` and the Sora font setup in [index.html](../../index.html)
  - **Expected behavior**: The sigil asset and Sora are available on this branch (042 merged). If absent, WS1 is blocked — stop and surface that 042 has not merged.
  - **Validation/test**: `src/assets/logo/alice-sigil-full.svg` exists.
  - **Out of scope**: re-exporting or modifying brand assets (they come from 042).

---

## Phase 02: Inlined Startup Loader (WS1)

**Purpose**: Kill the blank white page — paint a branded loader before `main.js`, hosted only. Boot handshake stays sequential this phase; only the loader lifecycle changes. Local dev and portable are scoped out at the serving layer (Vite plugin / Express catch-all respectively): the loader markup never appears in their response body (see T003), so there is nothing to fast-path past in either.

- [ ] T003 Inline the loader markup + critical CSS into `index.html`, delimited for hosted-only delivery
  - **Target**: [index.html](../../index.html) — inside `<div id="app">`; [server/index.js](../../server/index.js) — the `serveStatic` catch-all (portable); [vite.config.js](../../vite.config.js) — new dev-server plugin (local dev)
  - **Expected behavior**: Recreate the `HostedAlice_StartupLoader/` handoff: centered sigil + "Project Alice" wordmark + status line ("Getting things ready…") over `#F4F1ED`, with a **static** two-layer inset `box-shadow` edge glow. Sigil inlined as `<svg>` (from `src/assets/logo/alice-sigil-full.svg`) — no network fetch, not an LCP candidate. Status line carries `role="status"` / `aria-live="polite"`. Critical CSS inlined so it paints before the module bundle. Wrap the loader block in HTML comment markers (`<!-- STARTUP-LOADER:START -->` / `<!-- STARTUP-LOADER:END -->`). Two separate strip mechanisms, one per non-hosted serving path: (a) change `server/index.js`'s `serveStatic` catch-all (currently a plain `res.sendFile(path.join(distDir, 'index.html'))`) to read the file once (cached in memory), strip the marked block when `!config.isHosted`, and send the stripped HTML — covers portable; (b) add a `stripStartupLoaderInDev` Vite plugin (`apply: 'serve'`) using `transformIndexHtml` to strip the same block — covers `npm run dev`, which serves the source `index.html` directly via Vite and goes through neither Vercel's CDN nor `server/index.js`. Hosted's CDN-served static file (per `vercel.json`, never routed through Express) and the `vite build` output (consumed by both hosted and portable) are both untouched by either mechanism.
  - **Constraints**: **no motion on the glow at any breakpoint** (per updated handoff); wordmark stays 26px desktop (LCP hygiene); no large full-screen splash. **Use scoped class names** (e.g. `.startup-loader__edge-glow`, `.startup-loader__edge-glow-base`) — do **not** use the bare `.edge-glow`/`.edge-glow__base` names from the handoff verbatim, since the separate in-app-loader handoff (042) independently prototypes the same literal names for a visually different (rotating) treatment; a global-scope collision is avoidable at zero cost by prefixing. Local dev and portable must each receive **zero** loader markup in the response body — not a client-side hide, a server/build-side strip in both.
  - **Validation/test**: build succeeds; a cold hosted load shows the loader before the bundle finishes (verified in Phase 08); a local dev (`vite dev`) response and a portable request for `/` each contain neither loader marker. Unit coverage in T007.
  - **Out of scope**: bootstrap handshake parallelization (Phase 03); skeleton (Phase 04).

- [ ] T004 Add responsive breakpoint styling for the loader
  - **Target**: [index.html](../../index.html) critical `<style>` (and/or `src/styles/main.css`)
  - **Expected behavior**: Desktop / tablet-portrait / mobile-portrait per the handoff table — icon 140/120/92px, wordmark 26/22/18px, subtitle 14/13/13px, glow shadow scaled (purple `90/34/22`, gold `150/58/40`). Loader stays centered with no clipping/overflow.
  - **Constraints**: values come from the handoff README table (the prototype HTML only renders desktop).
  - **Validation/test**: manual resize at three widths (Phase 08 US1); no test asserts pixel sizes.
  - **Out of scope**: landscape-specific tuning (handoff specifies portrait breakpoints only).

- [ ] T005 Rework `bootstrap()` / mount teardown so the loader survives the handshake, with a real (deferred) fade
  - **Target**: [src/main.js](../../src/main.js) — `bootstrap()` (remove the eager `existingRoot?.remove()`), and the first-mount teardown in `mountWelcome` / `mountAppShell` / `mountConfigError`
  - **Expected behavior**: The inlined loader stays visible through the handshake and is torn down exactly once, at the first destination mount. Teardown applies an exiting/fade CSS class to the loader and **defers** the actual `clearBody()` call until the transition ends (`transitionend`, with a `setTimeout` fallback in case the event doesn't fire) — `clearBody()` must **not** run synchronously in the same tick the fade starts, or there is nothing left to fade. No blank frame between loader and first UI.
  - **Constraints**: do **not** change the handshake ordering yet (still sequential `runtimeHandshake()` → `authStore.init()`); single teardown path only; under `prefers-reduced-motion` the transition duration is zero (immediate `clearBody()`).
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) — loader present during handshake, torn down once on first mount, `clearBody()` deferred until transition-end (or immediate under reduced-motion).
  - **Out of scope**: parallelization (Phase 03).

- [ ] T006 Suppress the loader→app transition under `prefers-reduced-motion`
  - **Target**: [index.html](../../index.html) critical CSS / `src/styles/main.css`
  - **Expected behavior**: Under `prefers-reduced-motion: reduce`, the loader→app fade is disabled (instant swap). The glow is already static, so nothing else to disable.
  - **Validation/test**: T007 asserts no animated transition under the reduced-motion query.

- [ ] T007 [P] Loader render + a11y + lifecycle tests, plus local-dev/portable stripping tests
  - **Target**: [tests/main.test.js](../../tests/main.test.js) (+ a new loader test if cleaner); a `server/index.js` static-serving test; a `vite.config.js` plugin test
  - **Expected behavior**: Assert the loader renders with `role="status"`/`aria-live`, the glow layer has no animation, the loader is torn down once on first mount, and reduced-motion disables the crossfade. Separately, assert `createApp({ serveStatic: true, config: { isHosted: false } })`'s served HTML excludes both loader markers entirely, while `{ isHosted: true }` includes them (portable/hosted). Separately, assert `stripStartupLoaderInDev`'s `transformIndexHtml` strips both markers from a sample HTML string (local dev), and that the plugin's `apply: 'serve'` means it does not run during `vite build`.
  - **Validation/test**: `npm run test:run` green.

- [ ] T008 Re-measure after WS1 and record
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: Append a `WS1` row. Expect FCP to collapse (~8s → ~1s); LCP roughly unchanged.
  - **Validation/test**: `WS1` row present.

---

## Phase 03: Bootstrap Rework — Parallel + Optimistic Handshake (WS2)

**Purpose**: Cut the real wait. Run the two boot calls concurrently and stop making signed-out/signed-in visitors pay the health cold start — **without** reintroducing the flash-of-app-before-ConfigError bug that plan review found in the original "Option 1" design. Preserve the boot-handshake contract in [contracts/api.md](contracts/api.md) §2 (C1–C6).

- [ ] T009 Run `getHealth()` and `authStore.init()` concurrently, routing only the two network-backed outcomes immediately
  - **Target**: [src/main.js](../../src/main.js) — `bootstrap()`
  - **Expected behavior**: Start both calls concurrently. `authStore.subscribe(render)` so `unauthenticated`/`authenticated` — both reached **only** via a genuine `supabase.auth.getSession()` call, which only runs when `isHostedAuthAvailable === true` — mount Welcome/shell as soon as the session resolves, **without awaiting health** (C1, C2). The `local-mode` outcome (which `authStore.init()` sets **synchronously, with no network call**, whenever `isHostedAuthAvailable` is false) does **not** mount anything yet — see T010.
  - **Constraints**: do not generalize "route on session resolve" to `local-mode` — that was the plan-review's critical finding (a misconfigured hosted deploy resolves `local-mode` faster than `getHealth()` and would otherwise flash the app shell before ConfigError overrides it).
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) — `authenticated`/`unauthenticated` do not await health; `local-mode` does not mount immediately.
  - **Out of scope**: skeleton (Phase 04).

- [ ] T010 Hold `local-mode` behind `getHealth()`, then preserve ConfigError correctness for a misconfigured deploy
  - **Target**: [src/main.js](../../src/main.js) — `render()`/`bootstrap()` handling of the `local-mode` status; `runtimeHandshake()` result handling
  - **Expected behavior**: When `authStore`'s state is `local-mode`, do **not** mount the shell until `getHealth()` has also resolved. Once health resolves: if `health.runtime === 'hosted' && !hostedAuthAvailable`, mount ConfigError (C3) — this is the case where `local-mode` meant "hosted deploy missing its build-time env vars." Otherwise (genuine local/portable build), proceed to mount the shell for `local-mode` exactly as today. Either way, **no flash of Welcome or the app shell** precedes the correct outcome.
  - **Constraints**: this is the fix for the plan-review CRITICAL finding — do not let `local-mode` mount before health resolves, under any circumstance.
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) — `local-mode` + health confirms misconfig → ConfigError only, no shell flash; `local-mode` + health confirms a genuine local build → shell mounts (after health, not before).

- [ ] T011 Make `mountAppShell()` tolerate a null health result and explicitly remount Footer/UpdateToast on late resolve
  - **Target**: [src/main.js](../../src/main.js) — `mountAppShell()`; consumers `Footer.render({ runtime })`, `UpdateToast.mount({ health })`, `subscribeUpdateController` (gated on `updateSupported`)
  - **Expected behavior**: For the `authenticated` fast path, the shell mounts without waiting on health (`_runtimeHealth` may be null at that point). When health resolves afterward, `main.js` **replaces** the existing footer element with a fresh `Footer.render({ runtime })` call and **re-invokes** `UpdateToast.mount({ health })` (after `UpdateToast.destroy()`), re-evaluating the update-controller subscription (C5). Do **not** rely on an in-place "patch" — neither `Footer.js` nor `UpdateToast.js` exposes one (confirmed in plan review: `Footer.render()` is a one-shot factory; `UpdateToast.mount()` bails with no subscriptions when `health` is null).
  - **Constraints**: no regression to demo/local shell mounting; the `local-mode` path (T010) already has health resolved by the time it mounts, so this remount step is specific to the `authenticated` fast path.
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) — shell mounts with null health for `authenticated`, then the footer element is replaced and `UpdateToast.mount()` is re-invoked once health resolves.

- [ ] T012 Add the boot-timeout Retry affordance
  - **Target**: [src/main.js](../../src/main.js) — `bootstrap()`; loader markup in [index.html](../../index.html) (hidden Retry element)
  - **Expected behavior**: If nothing has mounted ~10s after boot starts, the loader reveals "taking longer than expected" + a Retry control; Retry calls `window.location.reload()` (C6). Never an indefinite wait.
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) with fake timers — timeout reveals Retry; Retry triggers reload.

- [ ] T013 WS2 boot-handshake test suite
  - **Target**: [tests/main.test.js](../../tests/main.test.js)
  - **Expected behavior**: Cover C1–C6 — `authenticated`/`unauthenticated` route without a health wait; `local-mode` waits for health before mounting anything; ConfigError-no-flash for the misconfigured (`local-mode` + hosted + missing env vars) case; null-health tolerance + explicit Footer replace/UpdateToast remount on late resolve; boot timeout/Retry.
  - **Validation/test**: `npm run test:run` green.

- [ ] T014 Re-measure after WS2 and record
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: Append a `WS2` row. Expect LCP to drop (signed-out especially).
  - **Validation/test**: `WS2` row present.

---

## Phase 04: App-shell + Tracker Skeleton (WS3)

**Purpose**: Make the signed-in handoff feel instant — shell + skeleton before data — by extending the **existing** skeleton system, not building a parallel one.

- [ ] T015 Add a Tracker-boot skeleton builder to the existing `src/utils/skeletons.js`
  - **Target**: [src/utils/skeletons.js](../../src/utils/skeletons.js) (extend — **not** a new component file)
  - **Expected behavior**: Add a new builder function (alongside the existing `buildApplicationListSkeleton` / `buildProfileSkeleton` / `buildCalendarSkeleton`) that renders placeholder shapes for the Tracker boot handoff, following the same pattern: presentational DOM builder, `aria-busy="true"`, `aria-live="polite"`, `aria-label`, no application data (see [data-model.md](data-model.md) §3).
  - **Constraints**: plan review found `skeletons.js` already exists and is already used by `Tracker.js`/`Profile.js`/`Calendar.js` — do **not** introduce a new `Skeleton.js` component; reuse the established pattern and its existing `loading-skeleton`/`skeleton-*` CSS classes. Reduced-motion-safe (no shimmer that violates the motion rule, or shimmer disabled under reduced-motion).
  - **Validation/test**: T017.
  - **Out of scope**: issue #109 click-feedback (separate ticket; only the builder is shipped here, for #109 to consume from `skeletons.js` later).

- [ ] T016 Render the Tracker skeleton on the signed-in handoff
  - **Target**: [src/main.js](../../src/main.js) — `mountAppShell()` / `navigate('tracker')`; seam in [src/pages/Tracker.js](../../src/pages/Tracker.js)
  - **Expected behavior**: The shell + Tracker skeleton (from T015) render before data; real application rows replace the skeleton when data arrives — no blank gap between loader and shell.
  - **Constraints**: minimal Tracker touch (a hydrate seam, not a rewrite).
  - **Validation/test**: [tests/main.test.js](../../tests/main.test.js) — skeleton before data, rows replace it on resolve.

- [ ] T017 [P] Skeleton builder test
  - **Target**: [tests/utils/skeletons.test.js](../../tests/utils/skeletons.test.js) (extend existing file — not a new test file)
  - **Expected behavior**: New builder renders the expected placeholder shape; exposes `role`/`aria-busy`/`aria-live`; no data dependency.
  - **Validation/test**: `npm run test:run` green.

- [ ] T018 Re-measure after WS3 and record
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: Append a `WS3` row (signed-in LCP/feel).
  - **Validation/test**: `WS3` row present.

---

## Phase 05: Route-level Lazy Loading (WS4)

**Purpose**: Trim the initial bundle by code-splitting non-landing routes. *Final feature phase; may split to its own feature if the race/chunk handling balloons.*

- [ ] T019 Record the pre-split bundle baseline
  - **Target**: build + [metrics.md](metrics.md)
  - **Expected behavior**: Run the bundle visualizer; record initial bundle size in a `WS4-pre` note so the split is evidence-driven.
  - **Validation/test**: bundle size recorded.

- [ ] T020 Dynamic-import `Calendar` / `Profile` / `ProfileEdit`; keep `Tracker` eager; update nav state before the `await`
  - **Target**: [src/main.js](../../src/main.js) — remove the static imports at lines 10–13 for those three; `import()` them inside `navigate()`; make `navigate()` async
  - **Expected behavior**: Non-landing routes load as separate chunks on navigation; `Tracker` stays in the initial bundle (N5). `_currentPage`/`Navbar.setActive`/`BottomTabBar.setActive` update, and the T015 skeleton renders in the workspace, **immediately — before the `import()` is awaited** (N6), not after it resolves as today's code does.
  - **Constraints**: keep the `!appRoot || page === _currentPage` and `ProfileEdit.confirmNavigation(page)` early-returns **before any `await`** (N1, N2). Plan-review finding: today's `navigate()` only updates nav-highlight state *after* mounting the new page — deferring the mount behind an awaited import without also moving the nav-state update earlier would leave the nav bar showing the *previous* tab as active while the workspace is blank.
  - **Validation/test**: T022; build test asserts the split.
  - **Out of scope**: lazy-loading `Tracker`.

- [ ] T021 Add latest-wins guard + chunk-load-failure fallback (with active-state revert)
  - **Target**: [src/main.js](../../src/main.js) — `navigate()`
  - **Expected behavior**: A slow chunk cannot mount over a newer navigation (latest-wins token, N3); an `import()` rejection (stale/failed chunk) is caught, offers a reload fallback (N4, same affordance as the boot Retry), and **reverts** the optimistic tab-highlight/skeleton from T020 back to the previous page.
  - **Validation/test**: T022.

- [ ] T022 WS4 navigation + chunk tests
  - **Target**: [tests/main.test.js](../../tests/main.test.js) + a build/chunk assertion test
  - **Expected behavior**: Nav highlight/skeleton update before the `await`, not after (N6); early-returns run before any `await`; latest-wins holds under rapid navigation; `import()` rejection → reload fallback + active-state revert; build shows `Calendar`/`Profile`/`ProfileEdit` split out and `Tracker` eager.
  - **Validation/test**: `npm run test:run` green.

- [ ] T023 Re-measure after WS4 and record
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: Append a `WS4` row with the post-split bundle size (parse/download tail).
  - **Validation/test**: `WS4` row present.

---

## Phase 06: Font Loading (WS5)

**Purpose**: Get the render-blocking Google Fonts request off the critical path.

- [ ] T024 Remove the render-blocking font request from the critical path
  - **Target**: [index.html](../../index.html) lines 8–10 (Google Fonts `preconnect` + stylesheet); `package.json` if self-hosting
  - **Expected behavior**: Self-host **or** preload Sora (400;500;600;700) **and** DM Mono so no render-blocking third-party font stylesheet remains on the critical path; the loader background + sigil paint independent of Sora (text may swap in).
  - **Constraints**: if a self-hosted font package is added (e.g. `@fontsource/sora`), record the dependency justification (constitution — see [plan.md](plan.md) Constitution Check). Preload adds no dependency.
  - **Validation/test**: T025.
  - **Out of scope**: changing the app's typefaces.

- [ ] T025 [P] Assert no render-blocking font request
  - **Target**: a build/DOM test (e.g. `tests/build/…`)
  - **Expected behavior**: The built `index.html` has no render-blocking `fonts.googleapis.com` stylesheet on the critical path.
  - **Validation/test**: `npm run test:run` green.

- [ ] T026 Re-measure after WS5 and record
  - **Target**: [metrics.md](metrics.md)
  - **Expected behavior**: Append a `WS5` row (FCP tail). Confirm the documented, measured FCP/LCP improvement vs. baseline; note the free-tier cold-start floor where it caps LCP.
  - **Validation/test**: `WS5` row present; before/after summary written.

---

## Phase 07: Release Prep

**Purpose**: Ship-readiness per constitution Amendment 1.3.0.

- [ ] T027 Version bump (SemVer minor)
  - **Target**: `package.json` + `package-lock.json` root `version`, and the in-app version in `src/pages/welcome/shared/appMeta.js` (`APP_VERSION`)
  - **Expected behavior**: Bump from the post-042 baseline (expected **1.11.0 → 1.12.0**; confirm the actual merged-042 version at release time).
  - **Validation/test**: [tests/release-metadata.test.js](../../tests/release-metadata.test.js) updated + green.

- [ ] T028 CHANGELOG entry
  - **Target**: `CHANGELOG.md`
  - **Expected behavior**: Add the 044 hosted-startup-performance entry (loader, parallel handshake, skeleton, lazy-loading, fonts) with the measured FCP/LCP improvement.
  - **Validation/test**: entry present under the new version.

- [ ] T029 Tick the roadmap
  - **Target**: `docs/feature_roadmap.md`
  - **Expected behavior**: Mark the 044 row done.
  - **Validation/test**: row updated.

- [ ] T030 README + deployment docs
  - **Target**: `README.md`; `docs/deployment.md` **only if** WS5 self-hosting or any runtime/env change warrants it
  - **Expected behavior**: Document the hosted startup loader surface; note the font strategy in deployment docs if a dependency/runtime detail changed (no env-var changes are expected).
  - **Validation/test**: docs reflect the shipped surface.

- [ ] T031 REPO_MAP for new files
  - **Target**: `docs/REPO_MAP.md`
  - **Expected behavior**: Add new paths — the loader-lifecycle helper (WS1), `specs/044-hosted-startup-performance/` (incl. `metrics.md`), and `HostedAlice_StartupLoader/`. Note `src/utils/skeletons.js` is an existing file being extended, not a new path.
  - **Validation/test**: entries present.

- [ ] T032 Docs sanity check + full suite
  - **Target**: repo docs; `npm run test:run`, `npm run lint`
  - **Expected behavior**: Cross-links resolve; constitution required-area suites (status/required-field/URL/date) remain green (this feature added none); lint clean.
  - **Validation/test**: `npm run test:run` and `npm run lint` both green.

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
