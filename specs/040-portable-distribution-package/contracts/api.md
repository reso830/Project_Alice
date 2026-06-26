# Contracts: Portable Distribution Package

**Feature**: 040-portable-distribution-package | **Date**: 2026-06-22

This feature adds **no new HTTP API routes** and changes **no existing route's request/response shape**. The contracts here are the **interfaces** the feature introduces: the single-origin serving behavior, the launcher↔server runtime contract, the `config/` file format, the launcher behavior, and the release-artifact contract.

---

## 1. HTTP serving contract (portable/local mode, `serveStatic: true`)

Request handling order within `createApp` when serving is enabled:

| Order | Match | Behavior |
|---|---|---|
| 1 | `GET /api/health` | `{ status: 'ok', runtime: 'local' }` (unchanged) |
| 2 | `/api/applications`, `/api/profile`, `/api/resume`, `/api/account` | existing routers (unchanged) |
| 3 | `GET` non-`/api` matching a built asset in `dist/` | served by `express.static(dist)` |
| 4 | `GET` non-`/api`, no static match | **SPA fallback** → `dist/index.html` (200) |
| 5 | errors | existing error handler (unchanged) |

**Invariants**:
- `/api/*` is **never** shadowed by static serving or the SPA fallback.
- When `serveStatic` is **unset/false** (hosted via Vercel, local dev via Vite), none of rows 3–4 are registered → behavior is byte-for-byte unchanged.
- Non-GET requests to non-`/api` paths are **not** rewritten to `index.html`.

---

## 2. Launcher → server runtime contract

Responsibilities are split between the **launcher** (`Start-Alice.cmd`) and the **bootstrap** (`server/portable.js`), because if `runtime\node.exe` cannot execute, the bootstrap never runs.

**The launcher (`Start-Alice.cmd`) guarantees:**

| Guarantee | Value |
|---|---|
| Paths | resolved relative to the **package root** (`%~dp0`), not a fixed install path |
| Runtime present/executable | if `runtime\node.exe` is missing or cannot run → clear error + console stays open (`pause`); **no** silent vanish (FR-021) |
| Invocation | runs `"%~dp0runtime\node.exe" "%~dp0app\server\portable.js"`; surfaces a non-zero `errorlevel` with a meaningful message |
| Console lifecycle | window stays open while running; closing it (or Ctrl+C) stops Alice (US3) |

**The bootstrap (`server/portable.js`) guarantees** — establishing these *before* `config.js`/`db.js` evaluate, by setting env then loading those modules via dynamic `import()` (see [tasks T005](../tasks.md)):

| Guarantee | Value |
|---|---|
| `APP_RUNTIME` | `local` |
| `ALICE_DB_PATH` | `<package>/data/alice.db` |
| Static serving | `createApp({ serveStatic: true, distDir: <root>/app/dist })` |
| Bind host | `127.0.0.1` (localhost only) |
| Port | preferred port from `config/settings.json` if free, else next free local port (bounded retry) |

The bootstrap, in return:
- **single instance**: before binding, probes `http://127.0.0.1:<configured-port>/api/health`; if it returns `{ status:'ok', runtime }`, opens the browser to that instance and exits without starting a second server (FR-033). A non-Alice port / refused connection / timeout → treated as "not running";
- opens/creates `data/alice.db` via the existing `initSchema()` (no schema change);
- after `listen`, opens the default browser to `http://127.0.0.1:<port>` (when `openBrowser`), else prints the URL;
- on `SIGINT`/console close, shuts down cleanly with no orphaned process holding the port;
- on a missing `dist/`/required app file, prints a clear error and exits non-zero (the launcher surfaces the `errorlevel`).

---

## 3. `config/settings.json` contract

See [data-model.md §2](../data-model.md). Summary:

```jsonc
{
  "port": 3001,        // integer; default 3001; invalid → default + warning
  "openBrowser": true  // boolean; default true
}
```

- Absent file → all defaults. Malformed → defaults + non-fatal warning (never crash). Unknown keys → ignored.
- MUST NOT contain secrets; the AI key is **not** represented here (client-side `localStorage` only).

---

## 4. Startup error contract (US4)

| Condition | Owner | Required behavior |
|---|---|---|
| Bundled runtime missing / cannot execute | **launcher** (`.cmd`) | clear error + `pause`; **no** silent exit (the bootstrap can't run, so the launcher must report) |
| Required `app/` file(s) missing (e.g. `portable.js`) | launcher via `errorlevel` | node exits non-zero → launcher surfaces a meaningful message + `pause` |
| Missing `dist/`/required app file at startup | **bootstrap** (`portable.js`) | clear error, exit non-zero (launcher surfaces the `errorlevel`) |
| Configured port already serving **Alice** (second launch) | bootstrap | **single instance** — open browser to the existing instance and exit; do not start a second server (FR-033) |
| Default port busy with a **non-Alice** process | bootstrap | **auto-select** next free local port and open browser there (no failure); indicate the port in use (FR-032) |

Errors are surfaced in the visible console window and/or `logs/alice.log`.

---

## 5. Release artifact contract

| Item | Contract |
|---|---|
| ZIP | `alice-v<version>-win-x64.zip`, extracts to `alice/` with the §1 layout of [data-model.md](../data-model.md); excludes `.env`/secrets/dev-only files |
| Checksum | `<zip>.sha256` containing the SHA-256 of the ZIP |
| Version marker | root `VERSION` (and `app/package.json`) readable as the installed version |
| Reproducibility | `npm run build:portable` from a clean checkout produces an equivalent layout/ZIP/checksum |
| Publication | CI attaches ZIP + checksum to a GitHub Release; CI triggers **only** on `v*` tag or `workflow_dispatch` |

---

## 6. Non-contract (explicitly unchanged)

- `createRepositories(config)` selection logic, Supabase repositories, and hosted routing (`vercel.json`, `api/index`) — unchanged.
- Existing `/api/*` request/response schemas — unchanged.
- AI request path — unchanged (browser → OpenRouter direct; server not involved).
- Application DB schema and validation — unchanged.
