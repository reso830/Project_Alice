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

---

## 2. Boot-handshake contract (internal, WS2)

The rework MUST preserve these observable guarantees:

| # | Guarantee | Rationale |
|---|---|---|
| C1 | Signed-out routing does **not** await `getHealth()` | signed-out cold-start win |
| C2 | The app shell is **never** mounted before the session confirms signed-in | no flash of authed content |
| C3 | A misconfigured deploy (`runtime==='hosted' && !hostedAuthAvailable`) reaches **ConfigError**, never a stuck Welcome/app | ConfigError correctness (Task 08.3 intent) |
| C4 | A late `configError` can still override an already-mounted Welcome | `render()` keeps the `_configErrorMounted` guard |
| C5 | `mountAppShell()` tolerates `_runtimeHealth === null` at mount and patches Footer/UpdateToast/update-controller when health resolves | shell mounts without waiting on health |
| C6 | On boot timeout (~10s) with nothing mounted, the loader shows Retry (full reload); never an infinite spinner | error state |

## 3. `navigate()` contract (internal, WS4)

Making `navigate(page, options)` async MUST preserve:

| # | Guarantee | Rationale |
|---|---|---|
| N1 | `!appRoot || page === _currentPage` early-return runs **before any `await`** | no-op navigations stay synchronous no-ops |
| N2 | `ProfileEdit.confirmNavigation(page)` dirty-check runs **before any `await`** | unsaved-edit guard must not be bypassed by async timing |
| N3 | Latest-wins: a slow route chunk cannot mount over a newer navigation | correctness under rapid nav |
| N4 | `import()` rejection (stale/failed chunk) is caught → reload fallback | mid-session redeploy recovery |
| N5 | `Tracker` remains eagerly imported (no chunk fetch on landing) | protect first-paint LCP |
