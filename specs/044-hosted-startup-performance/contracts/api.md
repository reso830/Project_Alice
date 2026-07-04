# Contracts: Hosted Startup Performance

**Feature**: [plan.md](./plan.md) · **Date**: 2026-07-04

> **No new API endpoints and no changed request/response payloads.** This feature reorders *when* existing calls run relative to first paint. The contracts below are (1) the existing `/api/health` response this feature depends on, and (2) the internal **boot-handshake contract** the rework must preserve. Documented here because getting the handshake semantics wrong is the primary risk.

---

## 1. `GET /api/health` (existing — consumer contract, unchanged)

Consumed by `getHealth()` (`src/services/healthApi.js`).

**Success `200`** → `runtimeHandshake()` reads `health.runtime`:
```jsonc
{
  "runtime": "hosted" | "local" | "demo",
  "updateSupported": boolean,     // gates subscribeUpdateController()
  "...": "other health fields (unchanged)"
}
```

**Failure behavior (unchanged, and load-bearing for this feature):**
- `TypeError` (fetch/network) → throws `{ code: 'NETWORK_ERROR' }`.
- `!response.ok` → throws `{ code: 'INTERNAL_ERROR' }`.
- `runtimeHandshake()` **swallows both** in its `catch` and returns `{ configError: false, health: null }` — i.e. a failed/slow health check is **non-fatal** and must not block first paint. WS2 relies on this: the signed-out path proceeds to Welcome regardless of health.

**ConfigError condition (must be preserved):**
```
configError === (health?.runtime === 'hosted' && !hostedAuthAvailable)
```
`hostedAuthAvailable` = `isHostedAuthAvailable` (synchronous env-var check, `supabaseClient.js`). No network.

**Load-bearing nuance (plan-review finding, see research D3)**: `!hostedAuthAvailable` is *also* exactly the condition under which `authStore.init()` resolves `local-mode` **synchronously, with no network call**. So `local-mode` is the one session outcome that can mean either "genuine local/portable build" or "hosted deploy missing its env vars" — and only this `configError` check (which needs `health`) can tell them apart. Any routing logic that treats `local-mode` as safe to mount immediately (without waiting for `health`) reintroduces the flash-before-ConfigError bug this contract exists to prevent.

---

## 2. Boot-handshake contract (internal, WS2)

The rework MUST preserve these observable guarantees. **C1/C2 apply only to the two network-backed session outcomes** (`authenticated`/`unauthenticated`) — this scoping is the fix for the plan-review's critical finding that an unqualified "don't wait for health" rule also covered the synchronously-resolving `local-mode` outcome and could leak the app shell on a misconfigured deploy.

| # | Guarantee | Rationale |
|---|---|---|
| C1 | `unauthenticated`/`authenticated` routing (both reached only via a real `getSession()` call) does **not** await `getHealth()` | cold-start win, only where a real network round-trip is actually happening |
| C2 | The app shell is **never** mounted for `authenticated` before `getSession()` confirms it, and **never** mounted for `local-mode` before `getHealth()` also resolves | no flash of authed *or* local-mode content ahead of a possible ConfigError |
| C3 | A misconfigured deploy (`runtime==='hosted' && !hostedAuthAvailable`) reaches **ConfigError**, never a stuck Welcome/app — including via the fast-resolving `local-mode` path | ConfigError correctness (Task 08.3 intent), now explicitly covering `local-mode` |
| C4 | A late `configError` can still override an already-mounted Welcome/shell | `render()` keeps the `_configErrorMounted` guard |
| C5 | `mountAppShell()` tolerates `_runtimeHealth === null` at mount (for the network-backed outcomes); when health resolves after the fact, `main.js` **replaces** the Footer element and **re-invokes** `UpdateToast.mount()`/the update-controller subscription — neither component has an in-place patch API | shell mounts without waiting on health, without silently dropping the update-toast/Footer runtime label |
| C6 | On boot timeout (~10s) with nothing mounted, the loader shows Retry (full reload); never an infinite spinner | error state |

## 3. `navigate()` contract (internal, WS4)

Making `navigate(page, options)` async MUST preserve:

| # | Guarantee | Rationale |
|---|---|---|
| N1 | `!appRoot || page === _currentPage` early-return runs **before any `await`** | no-op navigations stay synchronous no-ops |
| N2 | `ProfileEdit.confirmNavigation(page)` dirty-check runs **before any `await`** | unsaved-edit guard must not be bypassed by async timing |
| N3 | Latest-wins: a slow route chunk cannot mount over a newer navigation | correctness under rapid nav |
| N4 | `import()` rejection (stale/failed chunk) is caught → reload fallback, and the optimistic tab highlight (N6) reverts | mid-session redeploy recovery |
| N5 | `Tracker` remains eagerly imported (no chunk fetch on landing) | protect first-paint LCP |
| N6 | `_currentPage`/`Navbar.setActive`/`BottomTabBar.setActive` update, and the WS3 skeleton renders in the workspace, **before** the `import()` is awaited — not after it resolves | plan-review finding: today's code updates nav state only *after* mounting, which would leave a blank workspace with the *previous* tab highlighted during any non-trivial chunk-download time |
