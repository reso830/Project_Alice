# Plan Review Quality Checklist: Hosted Startup Performance

**Gate result**: PASS (revised 2026-07-07 — see "Re-review 2026-07-07 (part 3)" below; original FAIL record preserved unchanged)

**Purpose**: Validate technical plan completeness and sound design **before** any code is written.
**Created**: 2026-07-04
**Feature**: [plan.md](../plan.md)

> Pre-implementation gate only. Items are checkable against the spec/plan/contracts themselves. Post-implementation checks (tests pass, grep confirms, Release Prep done) belong to the final verification step, not here.

---

## Antagonistic Design Review 2026-07-07

Fresh review against `scripts/prompts/codex-check-requirements.md`, including the feature brief, spec, plan, tasks, contracts, data model, quickstart, roadmap, `docs/design/loading.md`, `docs/design/welcome_page.md`, and `design_handoffs/Alice_StartupLoader.zip`.

- [x] 1. Hosted-only scoping is implementable and testable: the current plan inlines the loader into the shared `index.html`, which will paint before JS in any runtime using that HTML, while the artifacts still require local/portable/demo boot to be unchanged or fast-pathed. Resolve by documenting the intended runtime/build-time scoping mechanism and adding verification for local/portable/demo behavior beyond a final spot-check.
- [x] 2. The feature brief's handshake requirement matches the spec/plan/contracts: the brief still says `bootstrap()` decides the destination "once both resolve", while the accepted design routes `authenticated`/`unauthenticated` before health and only holds `local-mode` behind health. Resolve by updating the brief so implementers are not sent toward the rejected wait-for-both behavior.

---

## Re-review 2026-07-07 (after addressing both antagonistic-review findings)

Both findings above were verified against the actual serving architecture, then fixed:

- **Finding 1 (hosted-only scoping unimplementable)** — confirmed and fixed: `index.html` is indeed a single shared build output, but the two runtimes' serving paths are already asymmetric — hosted serves it straight from Vercel's CDN (`vercel.json` only rewrites `/api/:path*`), while local/portable serve it through `server/index.js`'s `serveStatic` catch-all (`res.sendFile`). WS1 now delimits the loader markup with HTML comment markers and strips it server-side in that catch-all when `!config.isHosted`, so local/portable never receive the loader in the response body at all — not a client-side flash-then-hide, a server-side omission. See spec.md Clarifications (2026-07-07), plan.md "Hosted-only delivery of the loader markup", tasks.md T003/T007. Verification beyond the final spot-check is now an explicit task (T007: assert the local/portable response excludes both loader markers; T033 out-of-scope note updated to confirm no loader markup present, not just that boot still works).
- **Finding 2 (brief handshake language stale)** — confirmed and fixed: `docs/features/044-hosted-startup-performance.md`'s "Parallel + optimistic handshake" bullet was rewritten to match spec.md/tasks.md exactly — `authenticated`/`unauthenticated` route immediately on `getSession()` resolution without awaiting health; `local-mode` continues to wait for `getHealth()`. The brief's Non-Goals and "Hosted-only scoping" bullets were also updated to describe the real stripping mechanism and to state explicitly that WS3–WS5 are shared across all runtimes (a scope decision made in this pass, not implied by the prior wording).

Additional decision made in this pass (not a plan-review finding, but recorded here since it changes scope): **WS3 (Tracker skeleton), WS4 (lazy-loaded routes), and WS5 (font loading) are explicitly shared across all runtimes**, not scoped hosted-only — none of them reintroduce a network wait or otherwise regress local/portable. See spec.md Clarifications (2026-07-07).

Follow-up finding from this re-review (now resolved, see below): item 1 was reopened because the server-side stripping plan covered only portable's `serveStatic:true` path, while README/deployment docs define local development as `npm run dev` (Vite serves `index.html` directly in that workflow, bypassing `server/index.js`'s catch-all entirely).

Previously-open item 2 re-checked above (now `[x]`).

---

## Re-review 2026-07-07 (part 2 — local-dev serving path)

The follow-up finding above was verified (confirmed: `npm run dev` runs Vite's dev server directly on the source `index.html`, proxying only `/api` to a separate Express process per `vite.config.js`'s `server.proxy` and README's documented dev workflow — `server/index.js`'s `serveStatic` path is never invoked in that workflow) and fixed: a third serving path is now documented and closed. `vite.config.js` gets a `stripStartupLoaderInDev` plugin using the `transformIndexHtml` hook, scoped with `apply: 'serve'` so it never runs during `vite build` (meaning the build output consumed by both hosted and portable is unaffected — only the live dev-server response is stripped). See plan.md "Hosted-only delivery of the loader markup" (now documents all three paths), spec.md Clarifications (2026-07-07), tasks.md T003/T007 (updated to cover the Vite plugin and its test).

- [x] 1. (re-confirmed) All three serving paths for `index.html` — hosted CDN, portable's Express catch-all, and Vite's local dev server — now have an explicit mechanism ensuring only hosted ever receives the loader markup, each with test coverage (T007).

Follow-up finding from this re-review (now resolved, see below): item 1 was reopened a second time because `docs/features/044-hosted-startup-performance.md`'s "Hosted-only scoping" bullet still said local/portable were handled by "local/portable's own Express static-serving route" — true for portable, false for the documented local source-checkout workflow (`npm run dev`), where Vite serves `index.html` directly.

---

## Re-review 2026-07-07 (part 3 — feature brief catch-up)

The brief's "Hosted-only scoping" bullet (line 43) was the one remaining artifact still describing only the two-path (hosted/portable) mechanism after spec.md/plan.md/tasks.md were already updated in part 2. Fixed: the bullet now names both non-hosted mechanisms — portable's Express static-serving route and the Vite dev-server plugin for `npm run dev` — matching plan.md's "Hosted-only delivery of the loader markup" section exactly.

- [x] 1. (re-confirmed) All artifacts — spec.md, plan.md, tasks.md, and the feature brief — now consistently describe all three serving paths and their respective strip mechanisms; no remaining artifact describes only two.

## Re-review 2026-07-05 (after addressing all six plan-review findings)

All six findings from the 2026-07-05 review (preserved below) were verified against the actual code, then fixed across spec.md, plan.md, research.md, data-model.md, contracts/api.md, and tasks.md. Summary:

- **CRITICAL (local-mode leak)** — confirmed and fixed: optimistic no-health-wait routing is now scoped to `authenticated`/`unauthenticated` only (both backed by a real `getSession()` call); the synchronously-resolving `local-mode` outcome continues to wait for `getHealth()` before mounting, exactly as today. See spec.md Clarifications (2026-07-05 plan-review pass), plan.md Architecture, research.md D3, contracts/api.md C1–C3, data-model.md §1–2, tasks.md T009–T010.
- **MAJOR (redundant skeleton)** — confirmed and fixed: WS3 now extends the existing `src/utils/skeletons.js` (already used by Tracker/Profile/Calendar) instead of introducing a new `Skeleton.js` component. See research.md D9, data-model.md §3, tasks.md T015/T017.
- **MAJOR (Footer/UpdateToast "patch")** — confirmed and fixed: neither component has an in-place update API; the plan now specifies an explicit Footer element replace + `UpdateToast.destroy()`/`mount()` re-invocation when health resolves after the shell has mounted. See research.md D4, contracts/api.md C5, tasks.md T011.
- **MAJOR (navigate() stale nav highlight)** — confirmed and fixed: `navigate()` now updates the active-tab highlight and workspace skeleton *before* awaiting the dynamic import, not after. See research.md D6, contracts/api.md N6, tasks.md T020–T022.
- **MINOR (CSS collision)** — not reproducible in checked-in code (no `.edge-glow` exists in `main.css` on `main` or the current `042` branch tip), but addressed as a forward-looking guard: WS1 uses scoped class names. See research.md D9, tasks.md T003.
- **MINOR (fade vs. synchronous `clearBody()`)** — confirmed and fixed: loader teardown now defers `clearBody()` until the exit transition ends (zero-duration under reduced-motion). See research.md D2, tasks.md T005.

Previously-open items re-checked below (now `[x]`); no item is checked without a corresponding doc change cited above.

- [x] The optimistic-routing safety argument is grounded in `hostedAuthAvailable` being synchronous **and correctly scoped** — the argument now explicitly excludes `local-mode` (which resolves synchronously and is *not* safe to route optimistically) rather than incorrectly assuming `authStore.init()` "fails" when env vars are missing.
- [x] `mountAppShell()` null-`_runtimeHealth` tolerance is called out, **with an explicit remount mechanism** for Footer/UpdateToast (not an assumed in-place patch).
- [x] The boot/loader state machine (`booting` → `local-mode-pending` → `welcome` / `shell-skeleton` / `config-error` / `boot-timeout`) has a single, deferred loader-teardown invariant and no authed-content-**or-local-mode**-before-session/health flash.
- [x] The skeleton is presentational (no application data) and specified as an addition to the existing `src/utils/skeletons.js` builder set for #109 to consume — not a new reusable-component prop contract.
- [x] ConfigError condition `runtime==='hosted' && !hostedAuthAvailable` is preserved, including a late-`configError` override of Welcome/shell, **and now explicitly covers the `local-mode` path** (the case the original review found unguarded).
- [x] `navigate()` contract (WS4): early-returns run before any `await`; latest-wins; `import()` rejection → reload fallback + active-state revert; `Tracker` stays eager; **active-tab highlight and skeleton update before the `await`**, not after.

---

## Original Review 2026-07-05 (preserved, unmodified)

**Gate result**: FAIL — open: 8, 9, 11, 12, 15, 16 (Reviewed on 2026-07-05)

## Spec/Plan Alignment
- [x] Plan covers all six phases WS0–WS5, with WS4 (route lazy-loading) as the final phase and the "split if it balloons" caveat.
- [x] Every spec user story (US0–US8) maps to a phase in the plan.
- [x] Non-goals match the spec: no data-layer change, #109 out of scope (only the WS3 skeleton is shared), no router, no tier migration, local/demo boot unchanged.
- [x] The 042-merges-first dependency is stated as a WS1 prerequisite.
- [x] WS1 loader matches the **updated** handoff: static edge glow (no motion at any breakpoint) and the three responsive breakpoints (icon 140/120/92px, wordmark 26/22/18px).

## Architecture Soundness
- [x] Plan addresses that `bootstrap()` removes `#app` up front, and specifies keeping the loader alive until the first destination mounts (single teardown path).
- [x] Parallel handshake design routes signed-out on session resolve without awaiting health, and never mounts the shell before the session confirms signed-in.
- [ ] The optimistic-routing safety argument is grounded in `hostedAuthAvailable` being synchronous and in `authStore.init()` failing when env vars are missing.
- [ ] `mountAppShell()` null-`_runtimeHealth` tolerance (Footer / UpdateToast / `updateSupported`) is called out.
- [x] Boot timeout (~10s) → full-reload Retry is specified; no infinite-spinner path remains.

## Data-Model & State Risks
- [ ] The boot/loader state machine (booting → welcome / shell-skeleton / config-error / boot-timeout) has a single loader-teardown invariant and no authed-content-before-session flash.
- [ ] The skeleton primitive is presentational (no application data) and specified with a reusable prop contract for #109.
- [x] The metrics artifact holds aggregate perf numbers only — no user/application data/PII.

## Contract Correctness
- [x] `/api/health` consumer contract is preserved: failed/slow health is non-fatal (`{ configError:false, health:null }`) and must not block first paint.
- [ ] ConfigError condition `runtime==='hosted' && !hostedAuthAvailable` is preserved, including a late-`configError` override of Welcome.
- [ ] `navigate()` contract (WS4): early-returns (`page===_currentPage`, `ProfileEdit.confirmNavigation`) run before any `await`; latest-wins; `import()` rejection → reload fallback; `Tracker` stays eager.

## Test & Measurement Strategy
- [x] Validation approach names unit/integration coverage for: loader lifecycle, optimistic signed-out routing, ConfigError-no-flash, null-health tolerance, boot timeout/Retry, reduced-motion, and (WS4) async-navigate races + chunk-load failure.
- [x] WS0 measurement discipline (field + lab, cold-vs-warm health, bundle visualizer before WS4) is defined and re-run per phase, recorded in metrics.md.
- [x] The perf gate is a documented measured improvement vs. baseline (targets directional; cold-start floor acknowledged).

## Constitution Compliance
- [x] No required-field / persistence / `createRepositories` impact (both local + hosted runtimes unaffected at the data layer; demo boot unchanged).
- [x] No new analytics/tracking; Speed Insights unchanged (page-level, prod-hosted, no PII); local-first preserved (hosted-only runtime change).
- [x] Any new dependency is justified — WS5 self-hosted font (if chosen) has a stated rationale; WS4 uses native dynamic `import()` (no dependency).
- [x] Accessibility planned: loader `role="status"`/`aria-live`, reduced-motion, keyboard/labels preserved.
