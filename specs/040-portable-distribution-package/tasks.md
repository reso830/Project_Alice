# Tasks: Portable Distribution Package

**Feature**: `040-portable-distribution-package` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small and ordered; `[P]` marks tasks that can run in parallel with their siblings (different files, no shared edits). Commands: `npm run test:run`, `npm run lint`. (ESLint is the style/format gate — the project has no separate `npm run format` script.)

Status legend: `[x]` done · `[ ]` pending · `[~]` skipped.

Phase dependency: 01 → 02 → 03 → 04 → 05 → 06; **07** (amendment, 2026-06-22 — single-instance launch).

**Additive rule**: every phase leaves `npm run test:run` green. Each phase's change is additive and gated (static serving defaults off; the bootstrap/build/CI are new files), so no existing behavior breaks at a phase boundary.

**Validation-logic note**: this feature changes **no** application validation, data model, schema, migration, `createRepositories`, or `/api` route behavior. The constitution's required-area tests (status transitions, required-field enforcement, URL validation, date handling) are therefore **unaffected and need no new tasks** — the existing suites must stay green throughout (verified each phase and in Release Prep). The only server code change is gated single-origin static serving (Phase 01).

**User-story coverage**: Phase 01 → enables US1/US8 (serving); Phase 02 → **US1, US2, US3, US4, US6** (launch, persistence, stop, errors, localhost, port-select, AI-gating preserved); Phase 03 → **US5, US7** (reproducible build, version marker, separation) + assembles US1–US4/US6 into the package; Phase 04 → **US5** (release publication); Phase 06 Package Smoke Test walks **all** stories against the built ZIP. US8 (hosted compatibility) is preserved by gating and verified in 01 + Release Prep. **Note**: the constitution's *Browser Smoke Test* (UI-rendering verification, Amendment 1.1.0) is **N/A** for 040 — it changes no UI (no components, CSS, rendering, keyboard, or viewport behavior); Phase 06 is instead a packaging/integration smoke that exercises what automated tests cannot (the bundled runtime, native binary, and real launch).

## Phase summary

| Phase | Focus | Tasks | Stories |
|---|---|---|---|
| 01 | Single-origin static serving (gated to local) | T001–T002 | enables US1, US8 (no hosted/dev regression) |
| 02 | Portable bootstrap (`server/portable.js`) + helpers | T003–T009 | US1, US2, US3, US4, US6 |
| 03 | Build script + standardized layout | T010–T014 | US5, US7 |
| 04 | CI release workflow (tag/dispatch only) | T015–T016 | US5 |
| 05 | Release Prep | T017–T022 | — |
| 06 | Package Smoke Test (built package) — UI-rendering smoke N/A (no UI change) | T023 | all |
| 07 | Amendment — single-instance launch (health-probe reuse) | T024–T025 | US4, FR-033 |

---

## Phase 01 — Single-origin static serving (gated)

**Purpose**: Let the Express app serve the built `dist/` + SPA fallback in portable/local mode only, so one origin serves UI + `/api`. Gated off by default → hosted (Vercel) and local dev (Vite) are untouched. The frontend already uses relative `/api/` URLs, so **no frontend change**.

### T001 `[x]` — Add gated `serveStatic` branch to `createApp`
- **Target**: [server/index.js](../../server/index.js) (`createApp`)
- **Expected behavior**: Add an opt-in option `serveStatic` (and a `distDir`, default resolved to the package `dist/`). When truthy, after the `/api/*` routers and **before** the error handler, register: (1) `express.static(distDir)`; (2) an SPA fallback that, for **GET** requests whose path does **not** start with `/api`, returns `distDir/index.html` (200). When falsy/unset, register none of this (behavior byte-for-byte unchanged).
- **Constraints**: `/api/*` MUST never be shadowed by static or the fallback; non-GET and `/api` requests MUST NOT be rewritten to `index.html`. No new dependency (use `express.static` + `res.sendFile`). Do not alter existing routers, the health route, or the error handler. Per [contracts/api.md §1](contracts/api.md).
- **Validation/test**: T002.
- **Out of scope**: localhost binding, port selection, browser open (Phase 02); any hosted/`api/index` change.

### T002 `[x]` [P] — Unit tests for static serving + serving-off safety
- **Target**: `tests/server/staticServing.test.js` (new)
- **Expected behavior**: Build the app via `createApp({ repositories: wrapAsDispatcher(...), config, serveStatic, distDir })` against a temp `distDir` containing `index.html` + an asset. Start with `app.listen(0)` and assert via global `fetch` (no supertest): with `serveStatic:true` → `GET /asset` serves the file, `GET /some/spa/route` returns `index.html` (200), `GET /api/health` returns the health JSON (not index.html), `POST /not-api` is **not** rewritten to index.html; with `serveStatic` unset → `GET /some/spa/route` does **not** return index.html (404/next). Close the server in `afterEach`.
- **Constraints**: Vitest + Node `http`/`fetch`; ephemeral port `0`; use `wrapAsDispatcher` from [tests/server/helpers.js](../../tests/server/helpers.js) with a memory DB repo bundle. No network beyond loopback.
- **Validation/test**: this is the test task.
- **Out of scope**: bootstrap/launcher behavior.

**Checkpoint**: `npm run test:run` + `npm run lint` green. Serving is available but only when explicitly enabled.

---

## Phase 02 — Portable bootstrap + helpers

**Purpose**: A dedicated local-only entry that reads `config/` launch settings, wires env to the package's `data/`, selects a localhost port (pinned default, auto-increment on conflict), starts the server with static serving, opens the browser, and stops cleanly on console close. Leaves [server/index.js](../../server/index.js)'s dev/hosted CLI boot intact.

### T003 `[x]` — Settings reader module
- **Target**: `server/portable/settings.js` (new)
- **Expected behavior**: Export `readLaunchSettings(configDir)` returning `{ port:number, openBrowser:boolean }`. Read `<configDir>/settings.json`; apply defaults `port:3001`, `openBrowser:true`. Missing file → all defaults. Malformed JSON, non-integer/out-of-range `port` (not 1024–65535) → default port + a non-fatal warning; never throw. Unknown keys ignored. Per [data-model.md §2](data-model.md).
- **Constraints**: Pure (filesystem-read only); no server/network. No new dependency.
- **Validation/test**: T006.
- **Out of scope**: writing settings; UI for settings.

### T004 `[x]` — Port-selection helper
- **Target**: `server/portable/listen.js` (new)
- **Expected behavior**: Export `listenWithFallback(app, { host:'127.0.0.1', port, maxTries })` that attempts `app.listen(port, host)`, and on `EADDRINUSE` increments the port (bounded by `maxTries`, default ~10) and retries; resolves with the bound `{ server, port }` or rejects after exhausting tries. Always binds the given host (localhost).
- **Constraints**: No new dependency; use the `error`/`listening` events. Must not bind any non-loopback interface.
- **Validation/test**: T007.
- **Out of scope**: browser open; settings parsing.

### T005 `[x]` — Portable bootstrap entry
- **Target**: `server/portable.js` (new)
- **Expected behavior**: When run as the main module, call an exported `run({ root, open })`. Inside `run`: resolve the **package root** from `import.meta.url` (not CWD); set `process.env.APP_RUNTIME='local'` and `process.env.ALICE_DB_PATH=<root>/data/alice.db`; read launch settings (T003) — these top-level helpers are safe to static-import; **then** load the env-dependent modules via **dynamic `import()`** (`./config.js`, `./repositories/index.js` → `createRepositories`, `./index.js` → `createApp`) so they evaluate *after* the env is set; build `createApp({ repositories, config, serveStatic:true, distDir:<root>/app/dist })`; `listenWithFallback` (T004) on `127.0.0.1`; after listening, if `openBrowser` open `http://127.0.0.1:<port>` via the injected `open` (default: Windows `start` through `child_process`), else print the URL; log to console + `<root>/logs/alice.log`. Handle `SIGINT`/console close → close the server and exit cleanly (no orphaned process). On a missing `dist/`/required file, print a clear error and exit non-zero (US4).
- **Constraints**: Local-only; do not change `server/index.js`'s boot block. **No top-level static import of `./config.js`, `./db.js`, `./repositories/index.js`, or `./index.js`** — they must be loaded via dynamic `import()` only after env is set, because `config.js` evaluates `loadConfig()` at module load ([server/config.js:44](../../server/config.js#L44)) and `db.js` resolves `ALICE_DB_PATH` **and opens the database** at module load ([server/db.js:13](../../server/db.js#L13)). The browser `open` MUST be injectable so tests don't spawn a browser. No new dependency (`child_process` only). Unexecutable/missing **runtime** errors are owned by the launcher (T010), not here.
- **Validation/test**: T008 (bootstrap wiring with injected opener + temp root; asserts env set before dynamic loads); manual launch covered by the build dry run (T014) and Phase 06.
- **Out of scope**: assembling the package layout (Phase 03); detecting an unexecutable Node runtime (T010).

### T006 `[x]` [P] — Tests: settings reader
- **Target**: `tests/server/portableSettings.test.js` (new)
- **Expected behavior**: Assert defaults when file absent; valid JSON parsed; malformed JSON → defaults (no throw); out-of-range/non-integer `port` → default 3001; unknown keys ignored; `openBrowser` boolean coercion.
- **Constraints**: Vitest; temp dir for config fixtures; no network.
- **Validation/test**: this is the test task.
- **Out of scope**: bootstrap.

### T007 `[x]` [P] — Tests: port-selection helper
- **Target**: `tests/server/portableListen.test.js` (new)
- **Expected behavior**: Occupy a port with a throwaway loopback server, then assert `listenWithFallback` increments to the next free port and resolves with the higher port; assert the bound address is `127.0.0.1`; assert rejection after `maxTries` exhausted. Close all servers in cleanup.
- **Constraints**: Vitest + Node `http`; loopback only.
- **Validation/test**: this is the test task.
- **Out of scope**: full bootstrap.

### T008 `[x]` — Tests: bootstrap wiring (injected opener, no real browser)
- **Target**: `tests/server/portableBootstrap.test.js` (new)
- **Expected behavior**: Import the bootstrap's run function with an injected fake opener and a temp package root containing a minimal `app/dist/index.html` and writable `data/`/`logs/`. Assert: `APP_RUNTIME` and `ALICE_DB_PATH` are set to the package `data/`; **the SQLite file is created under `<root>/data/` (proving env was applied before the dynamic `db.js` load, i.e. the finding-1 ordering holds)**; the server binds `127.0.0.1`; the opener is called with `http://127.0.0.1:<port>` when `openBrowser:true` and **not** called when `false` (URL printed instead); a clear error + non-zero exit path when `dist/index.html` is missing. Shut the server down in cleanup.
- **Constraints**: Refactor `server/portable.js` so its run logic is exported and accepts injectable `{ open, root }` for testability (the main-module guard calls it with real defaults). No real browser spawned. No network beyond loopback.
- **Validation/test**: this is the test task.
- **Out of scope**: download/zip (Phase 03).

### T009 `[x]` — Lint pass for new bootstrap modules
- **Target**: `server/portable.js`, `server/portable/*.js`
- **Expected behavior**: `npm run lint` passes for the new files (imports, `process`/`globalThis` usage consistent with existing server modules).
- **Constraints**: Match existing ESLint config; no disables without reason.
- **Validation/test**: `npm run lint`.
- **Out of scope**: behavior changes.

**Checkpoint**: `npm run test:run` + `npm run lint` green. The app can be launched locally via `node server/portable.js` from a checkout (serving `dist/` after a `vite build`), binding localhost with port fallback and browser open.

---

## Phase 03 — Build script + standardized layout

**Purpose**: A repeatable `npm run build:portable` that assembles the standardized `alice/` layout, bundles a pinned Node runtime + ABI-matched `better-sqlite3`, writes the version marker, zips, and emits a checksum. Reproducible from source.

### T010 `[x]` — Layout templates (committed)
- **Target**: `config/settings.default.json` (new), `scripts/portable/Start-Alice.cmd` (new template)
- **Expected behavior**: `settings.default.json` = `{ "port": 3001, "openBrowser": true }`. `Start-Alice.cmd` = a launcher that, from the extracted package root (`%~dp0`), **owns runtime-launch error handling (FR-021)**: (1) if `"%~dp0runtime\node.exe"` does not exist → print a clear error ("bundled runtime missing — the package may be incomplete") and `pause` (do not vanish); (2) run `"%~dp0runtime\node.exe" "%~dp0app\server\portable.js"`; (3) on a non-zero `errorlevel` (runtime failed to execute, or the bootstrap exited with an error) → print a meaningful error and `pause`. The window title indicates "close this window to stop Alice" (US3). The build copies these into the package (`config/settings.json`, root `Start-Alice.cmd`).
- **Constraints**: Templates are reviewable in source control. The `.cmd` must work regardless of extraction path (quoted `%~dp0`-relative paths; no hard-coded absolute path). The runtime existence/executability check lives here because if `node.exe` cannot run, `portable.js` never executes and cannot report it (the contracts/api §4 owner for the "runtime cannot execute" case is the launcher).
- **Validation/test**: exercised by T014 dry run + Phase 06.
- **Out of scope**: the build orchestration (T011).

### T011 `[x]` — Portable build script
- **Target**: `scripts/build-portable.mjs` (new)
- **Expected behavior**: (1) run `vite build` → `dist/`; (2) stage `alice/`: `app/` = `server/`, `src/`, `shared/` (if present), `dist/`, prod `node_modules/`, `package.json`, plus a root `VERSION` (from `package.json` version) and `app/package.json`; `runtime/` = a **pinned** `node-win-x64` (version constant) downloaded via Node built-in `fetch`/`https` and verified against the official `SHASUMS256`; empty `data/` + `logs/`; `config/settings.json` from the template; root `Start-Alice.cmd`; (3) ensure the staged `better-sqlite3` native `.node` matches the pinned Node ABI (prefer the matching prebuilt; rebuild against the pinned runtime if absent) and run a quick DB-open smoke check; (4) zip via Windows `Compress-Archive` → `alice-v<version>-win-x64.zip`; (5) write `alice-v<version>-win-x64.zip.sha256` (SHA-256 via `node:crypto`). Exclude `.env`, Supabase creds, AI keys, and dev-only files from `app/`.
- **Constraints**: **No new dependency** — Node built-ins + `Compress-Archive`. Deterministic enough to reproduce an equivalent layout/ZIP from a clean checkout. Pin the Node version as a single constant (Node 24 LTS line per [research.md R-2](research.md)). Fail loudly if the Node download checksum mismatches or the DB smoke fails.
- **Validation/test**: T014 (dry run).
- **Out of scope**: CI (Phase 04); self-update (041).

### T012 `[x]` — Add `build:portable` npm script
- **Target**: [package.json](../../package.json) (`scripts`)
- **Expected behavior**: Add `"build:portable": "node scripts/build-portable.mjs"`.
- **Constraints**: Do not alter existing scripts.
- **Validation/test**: `npm run build:portable` resolves (T014).
- **Out of scope**: version bump (Release Prep).

### T013 `[x]` [P] — Exclude build output from VCS
- **Target**: [.gitignore](../../.gitignore)
- **Expected behavior**: Ignore the portable build output dir and artifacts (`alice/` staging, `*.zip`, `*.zip.sha256`) so generated packages are not committed.
- **Constraints**: Do not ignore the committed templates (`config/settings.default.json`, `scripts/portable/Start-Alice.cmd`) or `scripts/build-portable.mjs`.
- **Validation/test**: `git status` clean after a build (checked in T014).
- **Out of scope**: other ignore rules.

### T014 `[x]` — Build dry-run verification (manual)
- **Target**: build output (no source change)
- **Expected behavior**: From a clean checkout run `npm ci` then `npm run build:portable`; verify per [quickstart.md §A](quickstart.md): ZIP extracts to `alice/` with all five dirs + launcher + `VERSION`; `app/` excludes `.env`/secrets; `runtime\node.exe -v` prints the pinned version; checksum matches the ZIP; launching the staged `alice/` opens `data/alice.db` without a native-module error; `git status` shows no stray committed artifacts.
- **Constraints**: Run on Windows. This is verification, not an automated test (downloads Node + runs Vite).
- **Validation/test**: this is the verification task; results recorded in the PR.
- **Out of scope**: publishing (Phase 04).

**Checkpoint**: `npm run test:run` + `npm run lint` green (build tooling doesn't touch the suite); a portable ZIP + checksum is produced locally and verified.

---

## Phase 04 — CI release workflow

**Purpose**: Build and publish the artifact to GitHub Releases automatically, but only on a deliberate version tag or manual dispatch — never per-feature merge (free-tier quota).

### T015 `[x]` — Release workflow
- **Target**: `.github/workflows/release-portable.yml` (new)
- **Expected behavior**: Triggers: `push` of `tags: ['v*']` and `workflow_dispatch` **only**. Runner: `windows-latest`. Steps: checkout → setup Node (pinned line) → `npm ci` → `npm run build:portable` → attach `alice-v<version>-win-x64.zip` + `.sha256` to the GitHub Release for the tag (`gh release upload` or an equivalent action). Per [research.md R-8](research.md) / [contracts/api.md §5](contracts/api.md).
- **Constraints**: MUST NOT trigger on ordinary `push`/`pull_request`. Do not modify the existing `.github/workflows/node-ci.yml`. Use `GITHUB_TOKEN`; no extra secrets.
- **Validation/test**: T016.
- **Out of scope**: changing the test CI.

### T016 `[x]` — Verify trigger discipline (review)
- **Target**: `.github/workflows/release-portable.yml`
- **Expected behavior**: Confirm by inspection that `on:` contains only `push.tags: ['v*']` and `workflow_dispatch`; no `branches`, `pull_request`, or schedule triggers; the upload step is the only publish action. Record the confirmation in the PR.
- **Constraints**: Static review against the file.
- **Validation/test**: this is the review task.
- **Out of scope**: live release execution (done at actual release time).

**Checkpoint**: `npm run test:run` + `npm run lint` green; release automation present and trigger-gated.

---

## Phase 05 — Release Prep

**Purpose**: Mandatory pre-merge housekeeping (constitution Amendment 1.3.0). Target version: **1.9.0** (new feature; confirm the exact bump against the current `package.json` at execution).

### T017 `[ ]` — Version bump
- **Target**: [package.json](../../package.json), [package-lock.json](../../package-lock.json) (root `version`), any in-app version display
- **Expected behavior**: Bump `version` (e.g. 1.8.0 → 1.9.0) in `package.json` and the **root** `version` in `package-lock.json`; update any in-app version string if one exists. This version flows into the build's `VERSION` marker and ZIP name.
- **Constraints**: Keep `package.json` and `package-lock.json` root versions in sync.
- **Validation/test**: `npm run test:run` green; build name reflects the new version.
- **Out of scope**: tagging (release time).

### T018 `[ ]` [P] — CHANGELOG entry
- **Target**: [CHANGELOG.md](../../CHANGELOG.md)
- **Expected behavior**: Add a 1.9.0 entry summarizing the portable Windows package (bundled runtime, single-action launcher, localhost-only serving, local data persistence, repeatable build + checksum, CI release; 041 foundation; AI unchanged client-side BYOK).
- **Constraints**: Match existing CHANGELOG format/voice.
- **Validation/test**: docs sanity.
- **Out of scope**: other versions.

### T019 `[ ]` [P] — Roadmap reconcile (numbering drift fix)
- **Target**: [docs/feature_roadmap.md](../../docs/feature_roadmap.md)
- **Expected behavior**: Reconcile the drifted 3.0.0 numbering per the 2026-06-22 decision (040/041 are operational features belonging to **v2.0.0**; ats-resume-quality-checks is **043** in **v3.0.0**). Concretely:
  1. **v2.0.0 — Smart Intake & AI Assistance**: append `- [x] 040-portable-distribution-package  ·  shipped v1.9.0` (this feature) and `- [ ] 041-self-update-support` (planned), so v2.0.0 spans 031–041.
  2. **v3.0.0 — Preference & Insight Engine**: delete the obsolete `040-profile-page-refresh` row (already shipped as **034**, line 84) and the moved/duplicate `040`/`041` rows, then renumber the remaining planned features sequentially **from 042**, anchored so ats lands on 043:
     `042-preference-engine-foundation`, `043-ats-resume-quality-checks`, `044-role-based-salary-preferences`, `045-shift-setup-employment-preferences`, `046-salary-match-indicators`, `047-preference-based-compatibility`, `048-analytics-dashboard-foundation`, `049-funnel-response-analytics`, `050-source-platform-insights`, `051-compatibility-analytics`, `052-role-skill-insights`, `053-activity-analytics`, `054-suggested-actions-engine`, `055-ghosting-detection-suggestions`.
  3. **v4.0.0 — Job Hunt OS**: cascade to avoid collision with the new 053+: `056-new-user-onboarding`, `057-contextual-first-time-hints`, `058-about-page-philosophy`, `059-local-privacy-processing-mode`, `060-job-hunt-os-polish`.
- **Constraints**: Match existing roadmap format (`- [ ]`/`- [x]`, ` · shipped vX.Y.Z`). Preserve feature *names*; only fix numbers/placement and the obsolete row. Keep 1.0.0/2.0.0 shipped rows (031–039) untouched except the two additions in step 1. The roadmap is "directional" — this is a numbering-hygiene pass, not a re-scoping.
- **Validation/test**: docs sanity — no duplicate numbers remain across 2.0.0–4.0.0; ats = 043; 040 = portable-distribution under v2.0.0.
- **Out of scope**: changing feature names, themes, or milestone goals; implementing any listed future feature.

### T020 `[ ]` [P] — README portable instructions
- **Target**: [README.md](../../README.md)
- **Expected behavior**: Add an end-user "Run the portable package" section (download → extract → double-click `Start-Alice.cmd` → browser opens; close console to stop; optional OpenRouter BYOK in Settings; localhost-only; SmartScreen one-time prompt note). Add a maintainer "Build the portable package" note (`npm run build:portable`).
- **Constraints**: Concise; align with [quickstart.md](quickstart.md).
- **Validation/test**: docs sanity.
- **Out of scope**: deep architecture docs.

### T021 `[ ]` [P] — Deployment docs
- **Target**: [docs/deployment.md](../../docs/deployment.md)
- **Expected behavior**: Document the new **local/portable runtime**: the `server/portable.js` entry, env wiring (`APP_RUNTIME=local`, `ALICE_DB_PATH`), localhost-only binding, the gated `serveStatic` single-origin serving, `config/settings.json` (port/openBrowser), and that hosted (Vercel) is unchanged. Note the build/release flow and tag/dispatch-only CI.
- **Constraints**: This feature adds runtime modes/env → deployment docs update is required.
- **Validation/test**: docs sanity.
- **Out of scope**: hosted env changes (none).

### T022 `[ ]` [P] — REPO_MAP update
- **Target**: [docs/REPO_MAP.md](../../docs/REPO_MAP.md)
- **Expected behavior**: Add the new files/dirs: `server/portable.js`, `server/portable/`, `scripts/build-portable.mjs`, `scripts/portable/Start-Alice.cmd`, `config/settings.default.json`, `.github/workflows/release-portable.yml`.
- **Constraints**: Match existing REPO_MAP structure.
- **Validation/test**: docs sanity (paths exist).
- **Out of scope**: unrelated entries.

**Checkpoint**: `npm run test:run` + `npm run lint` green; version + docs consistent.

---

## Phase 06 — Package Smoke Test (built package)

**Purpose**: Walk each user story's Independent Test against the **actual built package** on a clean Windows path with no global Node (final phase, after Release Prep, so it exercises the merge state). Per [quickstart.md §D](quickstart.md).

**Constitution note — UI-rendering Browser Smoke Test is N/A.** Amendment 1.1.0 mandates a Browser Smoke Test "for features with user-facing UI" to verify rendering, CSS layout, keyboard interaction, and mobile viewports. Feature 040 changes **no** UI — no components, styles, rendering, interaction, or viewport behavior; it only packages and serves the *existing* UI. The UI-rendering smoke is therefore documented as a **skip (N/A)**. **Residual risk**: low — any incidental UI regression would be caught by the unchanged Vitest component suite and by simply loading the app during this package smoke. What *cannot* be covered by automated tests — the bundled Node runtime, the ABI-matched native `better-sqlite3`, and a real extract→launch on clean Windows — **is** verified here.

### T023 `[x]` — Package smoke-test the portable build
- **Target**: the `alice-v1.9.0-win-x64.zip` produced by `npm run build:portable`
- **Expected behavior**: On a Windows machine/profile with **no** global Node and no repo checkout, extract the ZIP and verify each story (packaging/integration behavior, not UI rendering):
  - **US1**: double-click `Start-Alice.cmd` → server starts on bundled runtime, browser opens, add an application works.
  - **US2**: data persists — add data, close (console window), relaunch → data present; `data/alice.db` is under `data/`.
  - **US3**: single double-click starts everything + opens browser; closing the console (or Ctrl+C) stops Alice with no orphaned `node.exe`.
  - **US4**: remove an `app/` file → clear error (no silent exit); occupy port 3001 with a non-Alice process → auto-recovers on next port and opens browser there; launch a **second** time while Alice is already running → focuses the existing instance (opens browser to it), no second server/window (FR-033).
  - **US6**: AI features disabled without a key; enter an OpenRouter key in Settings → AI works; no key on disk.
  - **US7**: `VERSION` readable; `data/`+`config/`+`logs/` separate from `app/`+`runtime/`.
  - **US8**: confirm hosted build unaffected (`vercel.json`/`api/index` unchanged) and `npm run test:run` + `npm run lint` green.
- **Constraints**: Real browser, real package, clean machine/path. Record results in the PR. Localhost-only reachability confirmed (not reachable from another device).
- **Validation/test**: this is the smoke-test task.
- **Out of scope**: self-update behavior (041).

**Checkpoint**: all stories verified against the built package; `npm run test:run` + `npm run lint` green.

---

## Phase 07 — Amendment: single-instance launch (2026-06-22)

**Purpose**: A second launch while Alice is already running should focus the existing instance, not start a second server on a different port (which orphans the `localStorage` AI key on a new origin and opens a second SQLite connection). Adds **FR-033**; refines **FR-032** (next-port fallback now applies only when a *non-Alice* process holds the port). Per [research R-9](research.md) and the spec's 2026-06-22 amendment clarification.

### T024 `[x]` — Health-probe single-instance reuse in the bootstrap
- **Target**: [server/portable.js](../../server/portable.js)
- **Expected behavior**: Add an injectable `probe(baseUrl)` (default: `fetch(<base>/api/health)` with a 1s `AbortController` timeout, true only when the body is `{ status:'ok', runtime:<string> }`). In `run()`, after reading settings and before setting env / dynamic imports, probe `http://127.0.0.1:<configured-port>`; if it reports a running Alice, log it, open the browser to that URL (or print it when `openBrowser:false`), and return `{ alreadyRunning: true, port }` without starting a server. Otherwise proceed exactly as before (env → dynamic imports → `createApp` → `listenWithFallback`).
- **Constraints**: No new dependency (bundled Node 24 global `fetch`). A non-Alice port / refused connection / timeout MUST be treated as "not running" so FR-032 fallback still applies. `probe` injectable for tests like `open`.
- **Validation/test**: T025.
- **Out of scope**: lock files / OS mutexes (rejected, research R-9); changing the non-Alice fallback.

### T025 `[x]` [P] — Tests for single-instance reuse
- **Target**: [tests/server/portableBootstrap.test.js](../../tests/server/portableBootstrap.test.js)
- **Expected behavior**: New test — with an injected `probe` returning `true`, `run()` probes the configured-port `/api/health`, returns `{ alreadyRunning: true, port }` with **no** `server`, opens the browser to the configured URL, creates **no** `data/alice.db`, and logs "Existing instance detected". Existing start-a-server tests inject `probe: async () => false` for determinism.
- **Constraints**: Vitest; injected `probe`/`open`; no real browser/network.
- **Validation/test**: this is the test task.
- **Out of scope**: build/CI changes (none needed).

**Checkpoint**: `npm run test:run` + `npm run lint` green; single-instance verified by unit test and exercised in the Phase 06 package smoke (second launch focuses the running instance).
