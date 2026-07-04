# Plan Review Quality Checklist: Hosted Startup Performance

**Purpose**: Validate technical plan completeness and sound design **before** any code is written.
**Created**: 2026-07-04
**Feature**: [plan.md](../plan.md)

> Pre-implementation gate only. Items are checkable against the spec/plan/contracts themselves. Post-implementation checks (tests pass, grep confirms, Release Prep done) belong to the final verification step, not here.

## Spec/Plan Alignment
- [ ] Plan covers all six phases WS0–WS5, with WS4 (route lazy-loading) as the final phase and the "split if it balloons" caveat.
- [ ] Every spec user story (US0–US8) maps to a phase in the plan.
- [ ] Non-goals match the spec: no data-layer change, #109 out of scope (only the WS3 skeleton is shared), no router, no tier migration, local/demo boot unchanged.
- [ ] The 042-merges-first dependency is stated as a WS1 prerequisite.

## Architecture Soundness
- [ ] Plan addresses that `bootstrap()` removes `#app` up front, and specifies keeping the loader alive until the first destination mounts (single teardown path).
- [ ] Parallel handshake design routes signed-out on session resolve without awaiting health, and never mounts the shell before the session confirms signed-in.
- [ ] The optimistic-routing safety argument is grounded in `hostedAuthAvailable` being synchronous and in `authStore.init()` failing when env vars are missing.
- [ ] `mountAppShell()` null-`_runtimeHealth` tolerance (Footer / UpdateToast / `updateSupported`) is called out.
- [ ] Boot timeout (~10s) → full-reload Retry is specified; no infinite-spinner path remains.

## Data-Model & State Risks
- [ ] The boot/loader state machine (booting → welcome / shell-skeleton / config-error / boot-timeout) has a single loader-teardown invariant and no authed-content-before-session flash.
- [ ] The skeleton primitive is presentational (no application data) and specified with a reusable prop contract for #109.
- [ ] The metrics artifact holds aggregate perf numbers only — no user/application data/PII.

## Contract Correctness
- [ ] `/api/health` consumer contract is preserved: failed/slow health is non-fatal (`{ configError:false, health:null }`) and must not block first paint.
- [ ] ConfigError condition `runtime==='hosted' && !hostedAuthAvailable` is preserved, including a late-`configError` override of Welcome.
- [ ] `navigate()` contract (WS4): early-returns (`page===_currentPage`, `ProfileEdit.confirmNavigation`) run before any `await`; latest-wins; `import()` rejection → reload fallback; `Tracker` stays eager.

## Test & Measurement Strategy
- [ ] Validation approach names unit/integration coverage for: loader lifecycle, optimistic signed-out routing, ConfigError-no-flash, null-health tolerance, boot timeout/Retry, reduced-motion, and (WS4) async-navigate races + chunk-load failure.
- [ ] WS0 measurement discipline (field + lab, cold-vs-warm health, bundle visualizer before WS4) is defined and re-run per phase, recorded in metrics.md.
- [ ] The perf gate is a documented measured improvement vs. baseline (targets directional; cold-start floor acknowledged).

## Constitution Compliance
- [ ] No required-field / persistence / `createRepositories` impact (both local + hosted runtimes unaffected at the data layer; demo boot unchanged).
- [ ] No new analytics/tracking; Speed Insights unchanged (page-level, prod-hosted, no PII); local-first preserved (hosted-only runtime change).
- [ ] Any new dependency is justified — WS5 self-hosted font (if chosen) has a stated rationale; WS4 uses native dynamic `import()` (no dependency).
- [ ] Accessibility planned: loader `role="status"`/`aria-live`, reduced-motion, keyboard/labels preserved.
