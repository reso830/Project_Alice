# Research: Portable Distribution Package

**Feature**: 040-portable-distribution-package | **Date**: 2026-06-22

Decision log for the technical unknowns behind the plan. Each entry: **Decision → Rationale → Alternatives rejected**.

---

## R-1 — Packaging model: official `node.exe` + `node_modules`

**Decision**: Ship the official, code-signed `node-win-x64` runtime plus the app source and its `node_modules` (including an ABI-matched `better-sqlite3`). Launch via a `.cmd` that runs `runtime\node.exe app\server\portable.js`.

**Rationale**: Antivirus/SmartScreen false positives are a real risk with single self-extracting executables (`pkg`/`nexe`/Node SEA); the official `node.exe` is signed and trusted. This option adds **no new tooling or dependencies**, and `better-sqlite3` "just works." Confirmed (spec clarification) not to disadvantage feature 041.

**Alternatives rejected**: single EXE (AV risk, native-module bundling fragility); esbuild-bundled server (smaller `app/` but adds an esbuild step + native "externals" handling — more risk for no required benefit at this scale).

---

## R-2 — Bundled Node version & `better-sqlite3` ABI

**Decision**: Pin an **exact Node 24 LTS** `node-win-x64` version as a constant in the build script. The build downloads that exact version (verified against the official `SHASUMS256`) and ensures the staged `better-sqlite3` native `.node` matches its ABI — preferring the matching prebuilt, and running a rebuild against the pinned runtime if the prebuilt is absent. The build performs a quick DB-open smoke check before zipping.

**Rationale**: `engines` requires `>=20.19.0`; dev/test runs Node 24.14.1; `better-sqlite3@^12.9.0` publishes prebuilds across Node 20/22/24. Pinning to the **same major line the project develops and tests on** minimizes ABI drift between the test runtime and the shipped runtime. An exact pin makes the build reproducible.

**Alternatives rejected**: "use whatever Node is on the CI runner" (non-reproducible; ABI could drift); bundling Node 20/22 (would diverge from the dev/test ABI for no gain).

---

## R-3 — Single-origin static serving, gated to local/portable

**Decision**: Add an opt-in `serveStatic` branch to `createApp` that mounts `express.static(dist)` + an SPA fallback for non-`/api` GETs, ordered after the `/api` routers and before the error handler. Only the portable bootstrap enables it.

**Rationale**: The portable server must serve UI + API from one origin (no Vite in production). The frontend already uses **relative `/api/`** URLs, so same-origin serving needs **no frontend change**. Gating keeps hosted (Vercel serves `dist`) and local dev (Vite serves `dist`) untouched.

**Alternatives rejected**: always-on static serving (would risk interfering with hosted/Vercel and dev/Vite); a second static-only process (defeats the single-action, single-process goal).

---

## R-4 — Port selection, host binding & browser open

**Decision**: The portable bootstrap binds to **`127.0.0.1`**, tries a **pinned default port (3001)** from `config/settings.json`, and on `EADDRINUSE` increments through a small bounded range. After a successful `listen`, it opens the default browser to `http://127.0.0.1:<port>` using Windows `start` via `child_process` (no dependency); if the open fails, it prints the URL.

**Rationale**: Localhost-only binding keeps private data off the network (no auth in local mode). A pinned default keeps the `localStorage` origin stable (preserving the BYOK key); auto-increment prevents a hard failure when the port is busy. `start` is built into Windows — no new dependency.

**Alternatives rejected**: bind all interfaces (network exposure without auth — rejected in spec clarify); fixed port with hard error on conflict (worse UX for non-technical users); a browser-open npm package like `open` (unneeded dependency).

---

## R-5 — Zipping & checksum with zero dependencies

**Decision**: Create the archive with Windows-native `Compress-Archive` (invoked from the Node build script via `child_process`), and compute a **SHA-256** checksum with `node:crypto`, written to `<zip>.sha256`.

**Rationale**: Node has no built-in archive *creation* (zlib is gzip only). On a Windows-only v1 with `windows-latest` CI, `Compress-Archive` avoids adding `archiver`/`adm-zip`. The checksum is an explicit 041 prerequisite (integrity validation before install).

**Alternatives rejected**: `archiver`/`adm-zip` (new dev dependency, unjustified for Windows-only v1); shipping without a checksum (blocks 041's validation step).

---

## R-6 — Portable bootstrap as a separate entry (not edits to `server/index.js` boot)

**Decision**: Add `server/portable.js` that imports `createApp` + `createRepositories` and owns the portable orchestration (config read, env wiring, port retry, browser open, shutdown). Leave `server/index.js`'s existing dev/hosted CLI boot block intact.

**Rationale**: Keeps the hosted/dev boot path (with its `assertHostedSchema` + lazy Supabase import discipline) unchanged and uncluttered, and isolates desktop-only concerns (browser open, console lifecycle) behind a clearly-local entry — easier to test and reason about.

**Alternatives rejected**: overloading `server/index.js` with env-flag branches (bloats the shared boot path, risks regressing hosted).

---

## R-7 — Version marker for 041

**Decision**: Write a `VERSION` marker into the package (sourced from `package.json` `version`) and keep `app/package.json` in the bundle, so the installed version is readable from a stable location.

**Rationale**: 041 must compare installed vs latest release. A dedicated marker is unambiguous and survives independent of how the app reads its own version.

**Alternatives rejected**: relying solely on a build-time constant in JS (less discoverable for an external updater).

---

## R-8 — CI release trigger discipline

**Decision**: `release-portable.yml` triggers **only** on `push` of `v*` tags and `workflow_dispatch`, on `windows-latest`; it builds and attaches the ZIP + `.sha256` to the GitHub Release.

**Rationale**: The user runs the GitHub free tier; a release per feature merge would waste Actions minutes and clutter Releases. Tag/dispatch-only means one release per shipped version, deliberately cut.

**Alternatives rejected**: build-on-every-push or on-PR (quota waste, noisy releases); manual-only local build with no CI (loses reproducible, attributable release artifacts).

---

## Open items deferred to implementation/tasks

- Exact bounded retry count and default port constant (pick during implementation; 3001 default).
- Whether `serveStatic`/host are threaded through `loadConfig()` or passed directly by the bootstrap (inspect `config.js` ergonomics during Phase 1).
- Precise set of `node-win-x64` files to include beyond `node.exe` (validate the minimal set during the build dry run).
