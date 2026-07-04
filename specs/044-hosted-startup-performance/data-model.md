# Data Model: Hosted Startup Performance

**Feature**: [plan.md](./plan.md) · **Date**: 2026-07-04

> **No persistence / database model changes.** This feature does not add, remove, or modify any entity, table, or `createRepositories`-routed store. The constitution's required fields (company, job title, status, `lastStatusUpdate`, responsibilities) are untouched. What follows models the **runtime boot state** and the **measurement artifact** — the only "data" this feature introduces, both client-only and PII-free.

---

## 1. Boot / Loader State Machine

The boot sequence transitions through these states. Today they are implicit; this feature makes the loader and skeleton explicit stops.

| State | Enter condition | UI shown | Exit → |
|---|---|---|---|
| `booting` | `index.html` parsed | **Inlined loader** (in `#app`) | on session resolve, or timeout |
| `config-error` | health resolves `configError` (env vars missing) | ConfigError page | terminal |
| `welcome` | session resolves **unauthenticated** | Welcome page | terminal (until sign-in) |
| `shell-skeleton` | session resolves **authenticated / local / demo** | App shell + Tracker skeleton | → `shell-ready` |
| `shell-ready` | Tracker data resolves | App shell + data | terminal |
| `boot-timeout` | ~10s elapsed, still `booting` | loader + "Retry" (full reload) | reload → `booting` |

**Invariants**
- Exactly one loader-teardown occurs, at the first mount of `welcome` / `shell-skeleton` / `config-error`.
- No `shell-*` state renders before the session confirms signed-in (no flash of authed content).
- `config-error` can override `welcome` if health resolves late (guarded by `_configErrorMounted`), but in practice the env-vars-missing condition also blocks a clean `unauthenticated`.
- `booting` never persists indefinitely — `boot-timeout` is the escape hatch.

## 2. Concurrent boot signals (WS2)

Two async signals resolve independently and are no longer sequential:

| Signal | Source | Consumed for | Blocking? |
|---|---|---|---|
| `session` | `authStore.init()` → `getSession()` | routing decision (welcome vs shell) | drives the primary handoff |
| `health` (`_runtimeHealth`) | `getHealth()` → `/api/health` | ConfigError decision; Footer runtime label; `updateSupported` | **non-blocking** for signed-out; patched into shell UI when it resolves |

`health` is decision-relevant to routing **only** when `!hostedAuthAvailable` (env vars missing) — see research D3.

## 3. Skeleton primitive (WS3)

A presentational component with **no data model** — it renders placeholder shapes matching the Tracker layout and carries no application data. Shared contract so issue #109 can reuse it:

| Prop | Type | Purpose |
|---|---|---|
| `variant` | string (e.g. `tracker-list`) | which placeholder layout to render |
| `count` | number | number of placeholder rows/cards |
| `aria` | `role`/`aria-busy` passthrough | accessible "loading" semantics |

## 4. Metrics artifact (`metrics.md`)

Client/lab-measured aggregate numbers only — **no user or application data, no PII**.

| Field | Example | Notes |
|---|---|---|
| `phase` | `baseline`, `WS1`, `WS2`, … | one row per measured phase |
| `fcp_p75_ms` | 8000 | Speed Insights field p75 |
| `lcp_p75_ms` | 13500 | Speed Insights field p75 |
| `cls` / `inp_ms` / `ttfb_ms` | — | Speed Insights field p75 |
| `health_cold_ms` / `health_warm_ms` | — | lab; isolates the free-tier floor |
| `session_ms` | — | lab; `getSession` segment |
| `bundle_kb` | — | lab; before/after WS4 |
| `notes` | "cold-start floor caps LCP" | qualitative caveats |
