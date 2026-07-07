# Data Model: Hosted Startup Performance

**Feature**: [plan.md](./plan.md) · **Date**: 2026-07-04

> **No persistence / database model changes.** This feature does not add, remove, or modify any entity, table, or `createRepositories`-routed store. The constitution's required fields (company, job title, status, `lastStatusUpdate`, responsibilities) are untouched. What follows models the **runtime boot state** and the **measurement artifact** — the only "data" this feature introduces, both client-only and PII-free.

---

## 1. Boot / Loader State Machine

The boot sequence transitions through these states. Today they are implicit; this feature makes the loader and skeleton explicit stops.

| State | Enter condition | UI shown | Exit → |
|---|---|---|---|
| `booting` | `index.html` parsed | **Inlined loader** (in `#app`) | on `authenticated`/`unauthenticated` resolve, on `local-mode-pending` clearing, or timeout |
| `local-mode-pending` | `authStore.init()` resolves `local-mode` **synchronously** (no network — `isHostedAuthAvailable === false`) | still the loader (not yet mounted) | on `getHealth()` resolve → `config-error` (if misconfig) or `shell-skeleton` (genuine local build) |
| `config-error` | health resolves `configError` (`runtime==='hosted' && !hostedAuthAvailable`) | ConfigError page | terminal |
| `welcome` | session resolves **unauthenticated** (via a real `getSession()` call) | Welcome page | terminal (until sign-in) |
| `shell-skeleton` | session resolves **authenticated** (via a real `getSession()` call), **or** `local-mode-pending` clears without a `config-error` override, **or demo** (`enterDemo()`, out-of-band) | App shell + Tracker skeleton | → `shell-ready` |
| `shell-ready` | Tracker data resolves | App shell + data | terminal |
| `boot-timeout` | ~10s elapsed, still `booting`/`local-mode-pending` | loader + "Retry" (full reload) | reload → `booting` |

**Invariants**
- Exactly one loader-teardown occurs, at the first mount of `welcome` / `shell-skeleton` / `config-error`, and teardown **defers** the actual DOM removal until the exit transition ends (zero-duration under reduced-motion).
- No `shell-*` state renders before **either** a real `getSession()` confirms `authenticated`, **or** `local-mode-pending` has been held until `getHealth()` also resolved. `local-mode` never mounts the shell purely on its own (synchronous) resolution — that was the plan-review's critical finding (see research D3): `local-mode` is ambiguous between a genuine local build and a hosted deploy missing its build-time env vars, and only `getHealth()` can disambiguate it.
- `config-error` can override `welcome`/`shell-skeleton` if health resolves late relative to the network-backed outcomes (guarded by `_configErrorMounted`); for `local-mode-pending` there's nothing to override since it never mounted anything in the first place.
- `booting`/`local-mode-pending` never persist indefinitely — `boot-timeout` is the escape hatch.
- When health resolves **after** `shell-skeleton` has already mounted (the `authenticated` fast path), Footer and UpdateToast are not silently "patched" — `main.js` explicitly replaces the footer element and re-invokes `UpdateToast.mount()`, since neither exposes an in-place update API (see research D4).

## 2. Concurrent boot signals (WS2)

Two async signals resolve independently and are no longer strictly sequential — but one outcome of the session signal is deliberately still gated on health:

| Signal | Source | Consumed for | Blocking? |
|---|---|---|---|
| `session` → `authenticated` / `unauthenticated` | `authStore.init()` → real `getSession()` network call (only when `isHostedAuthAvailable`) | routing decision (welcome vs shell) | **non-blocking** on health — routes immediately |
| `session` → `local-mode` | `authStore.init()`, **synchronous**, no network (when `!isHostedAuthAvailable`) | routing decision, but held pending | **blocking** — waits for `health` before mounting anything (see invariant above) |
| `health` (`_runtimeHealth`) | `getHealth()` → `/api/health` | ConfigError decision; resolves `local-mode-pending`; Footer runtime label; `updateSupported` | drives `local-mode-pending`'s exit; explicit remount for Footer/UpdateToast if it resolves after `authenticated` already mounted the shell |

`health` is decision-relevant to routing whenever the session signal resolved `local-mode` (env vars missing is the only case where `!hostedAuthAvailable`) — see research D3.

## 3. Skeleton builder (WS3)

**Not a new component.** Plan review found `src/utils/skeletons.js` already exists and already ships `buildApplicationListSkeleton` / `buildProfileSkeleton` / `buildCalendarSkeleton` (used today by `Tracker.js`, `Profile.js`, `Calendar.js`), each a presentational DOM-builder function with **no data model** — placeholder shapes only, `aria-busy="true"` / `aria-live="polite"` / `aria-label`, no application data. WS3 adds a Tracker-boot variant to this same file rather than introducing a parallel component system.

| Function (existing pattern) | Returns | Purpose |
|---|---|---|
| `buildApplicationListSkeleton()` | `HTMLElement` | existing — Tracker's in-page loading state |
| *new* Tracker-boot builder (name TBD at WS3, e.g. `buildTrackerBootSkeleton()`) | `HTMLElement` | the boot-time shell skeleton shown before Tracker data hydrates |

Issue #109 consumes whichever builder shape fits from `skeletons.js` — not a separate primitive.

## 4. Metrics artifact (`metrics.md`)

Client/lab-measured aggregate numbers only — **no user or application data, no PII**.

| Field | Example | Notes |
|---|---|---|
| `phase` | `baseline`, `WS1`, `WS2`, … | one row per measured phase |
| `measured_on` | `2026-07-07` | date the row was captured or updated |
| `field_source` | `Vercel Speed Insights` | provenance for field p75 metrics |
| `lab_source` | `Chrome DevTools cold trace` | provenance for lab segment timings |
| `fcp_p75_ms` | 8000 | Speed Insights field p75 |
| `lcp_p75_ms` | 13500 | Speed Insights field p75 |
| `cls` / `inp_ms` / `ttfb_ms` | — | Speed Insights field p75 |
| `health_cold_ms` / `health_warm_ms` | — | lab; isolates the free-tier floor |
| `session_ms` | — | lab; `getSession` segment |
| `bundle_kb` | — | lab; before/after WS4 |
| `notes` | "cold-start floor caps LCP" | qualitative caveats |
