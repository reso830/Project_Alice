# Implementation Plan: Portable Distribution Package

**Branch**: `040-portable-distribution-package` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/040-portable-distribution-package/spec.md`

---

## Summary

Package Alice as a **portable Windows ZIP** that a non-technical user extracts and double-clicks — no Node.js install, no repo clone, no installer. The same single codebase still deploys to hosted (Vercel) unchanged; all portable behavior is gated to local mode.

The work splits into four mostly-independent tracks:

1. **Runtime serving** (small code change) — in portable/local mode the Express app additionally serves the built Vite `dist/` (static + SPA fallback) and binds to **`127.0.0.1`**, so one process/origin serves UI + `/api`. The frontend already uses relative `/api/` URLs, so **no frontend change** is required.
2. **Portable bootstrap** (new entry) — a dedicated launcher entry that reads `config/` launch settings, sets `APP_RUNTIME=local` + `ALICE_DB_PATH` into the package's `data/`, selects a port (pinned default, auto-increment on conflict), starts the server bound to localhost, opens the default browser, and runs in a visible console window the user closes to stop.
3. **Build & layout** (new tooling) — a repeatable `npm run build:portable` Node script that runs the Vite build, assembles the standardized `alice/` layout (`app/ runtime/ data/ config/ logs/` + launcher), bundles a pinned official `node-win-x64` and an ABI-matched `better-sqlite3`, writes a version marker, zips it, and emits a SHA-256 checksum.
4. **Release automation** (CI) — a GitHub Actions workflow that builds and attaches the ZIP + checksum to a GitHub Release, triggered **only** on a `v*` tag or manual `workflow_dispatch` (never per-feature merge).

AI is **unchanged**: it uses the existing client-side `localStorage` OpenRouter BYOK (browser → OpenRouter direct); the server is never in the AI path and no key ships on disk. `config/` holds **launch settings only** (a pinned port). This is the **foundation for feature 041 (self-update)** — version marker, checksum, and strict `app`/`runtime` ↔ `data`/`config`/`logs` separation — but ships **no** update logic.

`createRepositories(config)` is untouched: portable runs the **local SQLite** path; **hosted Supabase** and **demo** are unaffected.

---

## Technical Context

**Language/Version**: Vanilla JS (ES modules); Vite frontend, Express backend. Bundled runtime pinned to a specific **Node 24 LTS** `node-win-x64` (satisfies `engines: >=20.19.0`; matches the dev/test ABI so the `better-sqlite3` native binary lines up).
**Primary Dependencies**: none new at runtime — existing `express`, `better-sqlite3@^12.9.0`. Build/CI use **only Node built-ins** (`node:https`/`fetch`, `node:crypto`, `node:fs`) and Windows-native `Compress-Archive` for zipping — **no new npm dependency**.
**Storage**: local SQLite via `better-sqlite3`, path resolved from `ALICE_DB_PATH` → package `data/alice.db`. No schema/column change; existing `initSchema()` runs as-is.
**Testing**: Vitest (`npm run test:run`); lint via `npm run lint` (no `format` script). Unit-test the new port-selection, config parsing, and static-serving gate; the build script is validated by a dry-run/quickstart, not a heavy unit test.
**Target Platform**: **Windows x64** portable (v1); same codebase still builds for hosted (Vercel) and local dev.
**Project Type**: Web app (Vite frontend + Express backend, dual-mode persistence) — **local/portable-only** change plus build/CI tooling.
**Performance Goals**: download → first launch < 5 min (SC-001); server start + browser open feels immediate.
**Constraints**: local-first; **localhost-only binding** (no network exposure); no analytics; no installer; no single self-extracting EXE (AV safety); single shared codebase (no desktop fork).

---

## Constitution Check

*GATE: must pass before design. Re-checked after design below.*

- **Required fields preserved** — company, job title, status, `last_status_update`, responsibilities unchanged. No data model, schema, or validation change; `initSchema()` and all routes behave identically. ✅
- **Business logic separated from UI** — this feature touches packaging, a server static-serving gate, and a bootstrap entry; no business rule moves. ✅
- **Centralized, reusable validation** — untouched; existing server/`src` validation paths run unchanged in portable mode. ✅
- **No silent corruption / overwrite** — `data/` (SQLite) is separated from replaceable program files; the build never writes into a user's `data/`/`config/`; relaunch reuses existing stores (FR-013). ✅
- **Workflows + empty/loading/error states** — add/edit/search/filter/review all preserved; startup errors (missing files, unlaunchable runtime) are explicit and never silent (US4); busy-port auto-recovers. ✅
- **Automated tests** — unit tests for port auto-select, config-settings parsing, and the static-serving/host gate; existing suites stay green. ✅
- **Privacy local-first** — localhost-only binding *strengthens* privacy; no analytics added; AI key never leaves the browser/never hits disk. ✅
- **Responsive / a11y** — no UI surface change; the existing responsive app is served as-is. ✅
- **New dependency justification** — **none introduced** (runtime or build). Zipping uses Windows `Compress-Archive`; node download/checksum use Node built-ins. If a future maintainer prefers `archiver`/`adm-zip` for cross-platform builds, that is a separate, justified decision — not required here. ✅

No violations → Complexity Tracking table omitted.

---

## Architecture & Data Flow

### Decision 1 — Single-origin static serving, gated to local/portable

`createApp()` gains an opt-in static-serving branch enabled by a new config flag (`appConfig.serveStatic`, default off). When on, after the `/api/*` routers and **before** the error handler, it mounts:
- `express.static(distDir)` for built assets, then
- an SPA fallback for **non-`/api` GET** requests → `dist/index.html`.

Gating: only the **portable bootstrap** sets `serveStatic: true`. Hosted (`api/index`) and local dev (Vite) never set it, so Vercel's static serving and the Vite dev server are unaffected. The frontend's relative `/api/` calls ([src/services/api.js:24](src/services/api.js#L24)) resolve to the same origin automatically — no frontend edit.

### Decision 2 — localhost binding + port auto-select live in the portable bootstrap

A new entry (`server/portable.js`) imports `createApp` + `createRepositories` and owns portable orchestration, leaving `server/index.js`'s dev/hosted CLI boot intact:
1. Resolve launch settings from `config/settings.json` (preferred port; default **3001**).
2. Set `process.env.APP_RUNTIME='local'` and `process.env.ALICE_DB_PATH=<package>/data/alice.db` before importing config/db.
3. Build the app with `serveStatic: true`; `listen(port, '127.0.0.1')`.
4. On `EADDRINUSE`, increment the port (bounded retries) and try again — staying localhost-bound.
5. After listening, open the default browser to `http://127.0.0.1:<port>` via Windows `start` (no dep); if that fails, print the URL.
6. Keep the process in the foreground console; `SIGINT`/window-close stops it cleanly.

### Decision 3 — Standardized layout assembled by a Node build script

`scripts/build-portable.mjs` (run by `npm run build:portable`):
1. `vite build` → `dist/`.
2. Stage `alice/` →
   - `app/` = `server/`, `src/`, `shared/` (runtime-imported modules), `dist/`, prod `node_modules/`, `package.json`, plus a `VERSION` marker (from `package.json` version).
   - `runtime/` = pinned `node-win-x64` (`node.exe` + required files), downloaded by version via Node built-in `fetch`/`https`, verified against the official SHASUMS.
   - `data/`, `logs/` = empty (created/used at first run); `config/` = a default `settings.json`.
   - root launcher (`Start-Alice.cmd`) that runs `runtime\node.exe app\server\portable.js` from the package root and keeps the console open.
3. Ensure `better-sqlite3`'s native `.node` matches the pinned Node ABI (prefer the matching prebuilt; rebuild against the pinned runtime if needed — see research R-2).
4. Zip via `Compress-Archive` → `alice-v<version>-win-x64.zip`; write `<zip>.sha256`.

### Decision 4 — CI release gated to tags/dispatch

`.github/workflows/release-portable.yml` runs on `push: tags: ['v*']` and `workflow_dispatch` only, on `windows-latest`: `npm ci` → `npm run build:portable` → attach ZIP + `.sha256` to the GitHub Release. No trigger on ordinary pushes/PRs, conserving free-tier minutes (one release per shipped version).

### Data flow (portable launch)

```
User double-clicks Start-Alice.cmd
  → runtime\node.exe app\server\portable.js
      → read config/settings.json (port)
      → set APP_RUNTIME=local, ALICE_DB_PATH=data/alice.db
      → createRepositories(local) → better-sqlite3 opens data/alice.db (initSchema)
      → createApp({ serveStatic:true }) → listen(127.0.0.1, port [+retry])
      → open default browser → http://127.0.0.1:<port>
  Browser → GET / → dist/index.html (+ static assets)
  Browser → /api/* → Express routers → SQLite
  Browser → openrouter.ai (direct, BYOK from localStorage)   [server NOT involved]
Close console window / Ctrl+C → server stops, no orphaned process
```

---

## Phasing (high level — detailed tasks come from `/speckit.tasks`)

1. **Runtime serving** — `serveStatic` branch in `createApp`; localhost host param; unit tests for the gate and SPA fallback (non-`/api` GET → index.html; `/api` untouched; hosted/dev unaffected).
2. **Portable bootstrap** — `server/portable.js`: config read, env wiring, port auto-select, browser open, clean shutdown; unit tests for port-selection and config parsing.
3. **Build script + layout** — `scripts/build-portable.mjs`, default `config/settings.json`, `VERSION` marker, launcher `.cmd`, checksum; verified via quickstart dry run.
4. **CI release workflow** — tag/dispatch-gated `release-portable.yml`.
5. **Release Prep** (second-to-last) — version bump, CHANGELOG, README (portable run instructions), `docs/deployment.md` (new local runtime/env: `ALICE_DB_PATH`, localhost binding, `serveStatic`), `docs/REPO_MAP.md` (new files), `package-lock.json` root version sync, `docs/feature_roadmap.md` tick.
6. **Package Smoke Test** (final) — walk each user story's Independent Test against the **built package** on a clean Windows path with no global Node. The constitution's UI-rendering Browser Smoke Test (Amendment 1.1.0) is **N/A** — 040 changes no UI; this phase verifies packaging/integration (bundled runtime, native binary, real launch/persist/stop) that automated tests cannot.

---

## Affected Areas

**Likely inspected (read-only)**
- [server/index.js](../../server/index.js) — CLI boot pattern reused by the new portable entry (not modified).
- [server/config.js](../../server/config.js) — confirm `APP_RUNTIME`/`PORT`; may add an optional `serveStatic`/host pass-through if cleaner than bootstrap-only wiring (inspect first).
- [server/db.js](../../server/db.js) — confirms `ALICE_DB_PATH` override and `data/` resolution (no change).
- [src/services/api.js](../../src/services/api.js), [src/data/aiSettings.js](../../src/data/aiSettings.js) — confirm relative `/api/` and client-side BYOK (no change).
- [vercel.json](../../vercel.json), `api/index.js` — confirm hosted path stays untouched.

**Likely modified / added**
- `server/index.js` **or** `createApp` in it — add the gated `serveStatic` static + SPA-fallback branch (minimal, gated off by default).
- **New** `server/portable.js` — portable bootstrap (port/host/browser/config/shutdown).
- **New** `scripts/build-portable.mjs` — build + layout + zip + checksum.
- **New** `config/settings.default.json` (template) and packaged `config/settings.json`.
- **New** root launcher template `Start-Alice.cmd`.
- **New** `.github/workflows/release-portable.yml`.
- `package.json` — add `"build:portable"` script; version bump at Release Prep.
- Docs at Release Prep: `README.md`, `docs/deployment.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `docs/feature_roadmap.md`.
- **New** tests: `tests/server/staticServing.test.js`, `tests/server/portableBootstrap.test.js` (port-select + config parse).

**Explicitly out of scope**
- Any change to `createRepositories`, Supabase repos, hosted routing, or demo seeding.
- Any AI server route or `config/` AI key (AI stays client-side BYOK).
- Any data model / schema / migration change.
- macOS/Linux launchers, runtimes, or native binaries.
- Self-update detection/download/install/migration (feature 041).

---

## Risks & Tradeoffs

- **R-1 `better-sqlite3` ABI mismatch** — the bundled native binary must match the pinned Node ABI, or the app crashes on DB open. *Mitigation*: pin an exact Node version; ensure the matching prebuilt is staged (rebuild against the pinned runtime if absent); smoke-test DB open in the build. (research R-2)
- **R-2 Port drift orphaning `localStorage`** — if the default port is busy and Alice shifts ports, the browser origin changes and the stored AI key/UI prefs appear gone (SQLite data is safe). *Mitigation*: stable default port + `config/` pinned port; document. (spec edge case)
- **R-3 Windows SmartScreen / mark-of-the-web** — the `.cmd` may prompt once on first run. Acceptable (no self-extracting EXE; official signed `node.exe`); document the expected one-time prompt.
- **R-4 ZIP size** — shipping `node_modules` makes a larger archive than an esbuild bundle. Accepted per spec clarification (simplicity + AV safety + 041 parity over size).
- **R-5 Build only validated on Windows** — `Compress-Archive` and `node-win-x64` are Windows-specific by design (v1 is Windows-only). CI uses `windows-latest`. Cross-platform build is a future concern.
- **R-6 Opening a browser from a server process** — coupling is contained: only the portable bootstrap (not `createApp`, not hosted) opens the browser, behind the foreground launcher.

---

## Validation Approach

- **Unit (Vitest)**: SPA-fallback routing (non-`/api` GET → `index.html`; `/api` and static assets unaffected; serving stays off when `serveStatic` is unset → hosted/dev safe); port auto-select increments on `EADDRINUSE` and binds `127.0.0.1`; `config/settings.json` parsing (valid, missing, malformed → default port).
- **Build dry run (quickstart)**: `npm run build:portable` produces the standardized layout, ZIP, `.sha256`, and `VERSION`; the staged `app/` excludes `.env`/secrets; checksum verifies.
- **Manual Package Smoke Test (final phase)**: on a clean Windows path with no global Node, extract → double-click → add an application → close → relaunch (data persists) → confirm localhost-only, busy-port recovery, clear startup errors, console-close shutdown, and AI gating/enable via Settings. (The constitution's UI-rendering Browser Smoke Test is N/A — no UI change; see tasks.md Phase 06.)
- **Regression**: full `npm run test:run` + `npm run lint` green; hosted build unaffected (inspect `vercel.json`/`api/index`).

### Dual persistence runtimes

- **Local (SQLite)** — the only runtime portable exercises; `ALICE_DB_PATH` points at the package `data/`. Covered above.
- **Hosted (Supabase)** — untouched; `serveStatic` stays off in hosted, Vercel continues to serve `dist` and route `/api` → `api/index`. Verified by inspection (no code path change for hosted).
- **Demo** — runs on the local path with seeded data; the portable build is local non-demo and does not alter demo seeding or auth state.
