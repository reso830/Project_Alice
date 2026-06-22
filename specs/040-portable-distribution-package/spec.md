# Feature Specification: Portable Distribution Package

**Feature Branch**: `040-portable-distribution-package`
**Created**: 2026-06-22
**Status**: Draft
**Input**: Feature brief `docs/features/040-portable-distribution-package.md`. Establishes the foundation that feature `041-self-update-support` builds on (app/runtime ↔ data/config separation, a readable installed-version marker, and a release checksum) — but implements **no** update detection/download/install logic itself.

---

## Clarifications

### Session 2026-06-22

- Q: Which operating systems must the v1 portable package support? The brief says "suitable for the target OS" but never names it. → A: **Windows only** for v1 (primary development and runtime environment). One Windows launcher, a bundled `node-win-x64` runtime, and the matching Windows prebuilt `better-sqlite3` native binary. macOS/Linux portability is explicitly deferred to a later feature.
- Q: How should the Node runtime + app be packaged, given that `better-sqlite3` is a native (compiled) module whose binary must match the bundled Node version and platform/arch? → A: **Bundle the official, code-signed `node.exe` plus the application and its `node_modules`** (including the matching prebuilt `better-sqlite3` `.node`). No single self-extracting executable (those commonly trip antivirus/SmartScreen false positives; the official `node.exe` does not) and no esbuild server bundling (avoids native-module "externals" risk). This honors the constitution's "simple over clever / new dependencies require justification."
- Q: Feature 038 added AI provider abstraction. How should AI provider config & secrets be handled in the portable package, where there is no repo `.env`? → A: **Use the existing client-side BYOK exactly as today** — the OpenRouter key and AI settings live in browser `localStorage` (`alice.ai.*`) and the browser calls OpenRouter directly; the Express server is never in the AI path. AI-dependent features are already gracefully gated (`hasKey()`/`isEnabled()`), so portable mode needs **no** server-side AI config and **no** key on disk. (See the 2026-06-22 plan-phase correction below.) The **hosted deployment is unaffected** — it runs the latest Alice with the same client-side BYOK.
- Q: (Plan-phase correction, 2026-06-22) The spec originally proposed a server-side `config/` AI-key file, but the real 038 implementation is client-side `localStorage` BYOK (browser → OpenRouter direct). How is this resolved? → A: **Align to the existing client-side BYOK; do not add any server-side AI key file or proxy.** Repurpose the `config/` directory for **local launch settings only** (e.g. a pinned preferred port). Because `localStorage` is keyed by origin (`127.0.0.1:<port>`), a pinned port keeps the stored key/prefs stable across launches; auto-port fallback (FR-032) only shifts the origin in the rare default-port-busy case, which never affects server-side SQLite data.
- Q: What should this feature deliver as the "repeatable mechanism for generating portable release artifacts"? → A: **A repeatable build script (`npm run build:portable`) that produces the layout + ZIP + an integrity checksum, plus a GitHub Actions workflow** that builds and attaches the artifact to a GitHub Release. The workflow MUST trigger **only on a version tag (`v*`) or manual dispatch — never on per-feature merges** — so releases stay deliberate and infrequent and do not consume the free-tier Actions/Releases quota. One release per shipped version, not one per feature.
- Q: Does choosing "bundle Node + node_modules" (over an esbuild-bundled server) disadvantage the future self-update feature (041)? → A: **No.** What 041 depends on — strict separation of replaceable code from preserved user state, a determinable installed version, and a release checksum — is orthogonal to the bundling style. Both ship the official `node.exe`. The simpler option is retained, and the three 041-enabling foundations are made explicit in this spec's scope (without implementing any update logic).
- Q: How does a non-technical user stop/shut down portable Alice? → A: The launcher runs in a **visible console window** (titled e.g. "Alice — close this window to stop"); **closing the window or pressing Ctrl+C terminates the server**. No separate stop script and no system-tray icon in v1.
- Q: What network interface should the portable server bind to? → A: **`127.0.0.1` (localhost only)** — not reachable from other devices on the network. LAN / multi-device access is deferred to a future feature and should ship together with authentication, since local mode currently has none.
- Q: What happens when the configured port is already in use? → A: **Auto-select the next available port** (try the default, then increment) and open the browser to the chosen port. Because binding stays localhost-only, auto-selecting another local port introduces no privacy/security exposure.

---

## Problem Statement

Alice currently assumes a developer-oriented deployment model: to run it locally a user must install Node.js, clone the Git repository, install dependencies, build the frontend, and start the server (and, in dev, a separate Vite process). That is appropriate while building Alice but is a significant barrier for a local-first, personal job-tracking tool — the very audience the constitution's local-first principle targets cannot reasonably be asked to use a terminal or a toolchain.

Alice needs a **portable distribution package**: a downloadable ZIP that a non-technical user can extract anywhere and launch with a single double-click, with no Node.js installation, no repository clone, no dependency install, no installer, no administrative privileges, and no registry changes. The package bundles a compatible Node.js runtime and all application components, persists the user's data locally between launches, and lays down a stable, standardized directory structure that a later self-update feature (041) can build on.

This is a packaging, runtime-bootstrapping, and build/release feature. It changes **no application data model, database schema, or business logic**, and it preserves the single shared codebase so the same application still deploys to the hosted (Vercel) target unchanged.

---

## Scope

**In scope**

- A **portable Windows release artifact**: a single ZIP that extracts to a self-contained `alice/` directory and runs with no prior Node.js install and no repository clone.
- A **bundled Node.js runtime** (official `node-win-x64`) used to launch Alice, isolated from any system-installed Node, with the matching prebuilt `better-sqlite3` native binary included.
- A **single-action Windows launcher** (a double-clickable script) that starts the backend server, makes the frontend available, opens the user's default browser to the local URL, and requires no command-line interaction.
- **Single-origin serving in portable/local mode**: the Express server serves the pre-built Vite `dist/` static assets (with SPA fallback) and the `/api` routes from one process and one port, so no separate Vite/dev server is needed. (Hosted serving via Vercel is unchanged.)
- A **standardized deployment layout** that separates replaceable program files (`app/`, `runtime/`) from preserved user state (`data/`, `config/`, `logs/`), with the launcher at the root.
- **Local data persistence** across launches: the SQLite database and user configuration live under `data/` and `config/` (outside `app/`), and re-launching reuses them.
- **AI via the existing client-side BYOK, unchanged**: AI-dependent features (resume/JD parsing, AI compatibility) use the current `localStorage` OpenRouter BYOK and are already gracefully gated — the user enters their key in the existing Settings UI exactly as in dev/hosted today. No new AI config, no key on disk, no server-side AI proxy. `config/` instead holds **local launch settings** (e.g. a pinned preferred port) so the `127.0.0.1:<port>` origin — and therefore the stored key/prefs — stays stable across launches.
- **Explicit startup error handling**: missing application files, an unlaunchable bundled runtime, or an unavailable port produce clear, visible error messages and never a silent termination.
- A **repeatable build mechanism** (`npm run build:portable`) that assembles the layout, produces the ZIP, and emits an integrity **checksum**, reproducibly from source control.
- A **GitHub Actions release workflow** that builds and attaches the artifact to a GitHub Release, triggered **only** on a version tag (`v*`) or manual `workflow_dispatch`.
- **041 foundations only**: a readable installed-**version marker** in the package, the **checksum** alongside the ZIP, and the **app/runtime ↔ data/config separation** — the structural prerequisites a future updater needs.

**Non-goals**

- **No self-update functionality** — no update detection, download, installation, version checking, release-notes display, automatic migration-on-update, or update preferences. All of that is feature **041**; 040 only lays the foundation.
- **No rollback or recovery mechanism.**
- **No installer** (MSI/EXE/setup), no administrative privileges, no registry modification, no PATH changes, no Start-Menu/shortcut registration.
- **No single self-extracting executable** (`pkg`/`nexe`/Node SEA) — avoided deliberately for antivirus/SmartScreen safety.
- **No desktop-app conversion** (Electron, Tauri, WebView wrapper) and **no separate desktop codebase**.
- **No macOS or Linux package** in v1 (deferred; the layout should not preclude it later, but no cross-platform launcher/runtime/native binary is produced here).
- **No cloud synchronization, multi-user, or cross-machine synchronization.**
- **No LAN / multi-device access.** The portable server binds to localhost only; reaching Alice from another device on the network is deferred to a future feature and must ship together with authentication (local mode has none today).
- **No system-tray, background-service, or auto-start-on-boot behavior.** Alice runs in a visible console window the user closes to stop it.
- **No change to the hosted (Vercel) deployment** experience, its build, its routing, or its BYOK scheme. Hosted is mentioned only to assert it stays compatible.
- **No change to the application data model, database schema, validation rules, or any backend route's behavior.** The only server change is adding static `dist/` serving in local/portable mode.
- **No external analytics or tracking** added to the portable build (consistent with the constitution; the one Speed-Insights exception is hosted-prod only and is not part of the portable package).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Launch with zero prerequisites (Priority: P1)

A non-technical user downloads the Alice ZIP, extracts it to any folder (e.g. their Desktop), and double-clicks the launcher. Alice starts and opens in their default browser, ready to use — without installing Node.js, cloning a repository, installing dependencies, or typing any command.

**Why this priority**: This is the entire point of the feature — removing developer setup. If a clean machine can't go from download to a working app, nothing else matters.

**Independent Test**: On a Windows machine (or clean user profile) with **no global Node.js on `PATH`** and no repository checkout, extract the release ZIP to an arbitrary folder and double-click the launcher. Confirm Alice's UI loads in the default browser at the local URL and a core action (add an application) works end-to-end — with no terminal interaction and no dependency-install step.

**Acceptance Scenarios**:

1. **Given** a machine with no system Node.js and no Alice repo, **When** the user extracts the ZIP and double-clicks the launcher, **Then** the backend starts using the bundled runtime and the frontend opens in the default browser.
2. **Given** the running app, **When** the user adds an application (company name, job title, status, last status update, responsibilities), **Then** it saves and appears in the list — the full local workflow functions.
3. **Given** the package, **When** the user inspects it, **Then** no separate Node install, no `npm install`, and no Git clone were required at any point.

---

### User Story 2 — Local data persists across restarts (Priority: P1)

A returning user closes Alice and launches it again later. Everything they entered — applications, profile, settings — is still there, because their data lives in the package's `data/`/`config/` directories rather than inside the program files.

**Why this priority**: A tracker that forgets data on restart is useless. Persistence is co-equal with first launch.

**Independent Test**: Launch Alice, add at least one application and edit the profile, then fully close Alice (stop the launcher/process). Relaunch via the launcher and confirm the previously entered application and profile are present. Confirm the SQLite database file resides under `data/` (outside `app/`).

**Acceptance Scenarios**:

1. **Given** data entered in a prior session, **When** Alice is closed and relaunched, **Then** all previously saved applications and profile data are present and unchanged.
2. **Given** the running package, **When** the database file is located, **Then** it is under `data/` (not under `app/` or `runtime/`).
3. **Given** a relaunch, **When** the server starts, **Then** it reuses the existing local database rather than creating a new empty one.

---

### User Story 3 — Single action to start, obvious way to stop (Priority: P2)

A user launches Alice with one action — double-clicking the launcher — and never uses a command line. Both backend and frontend come up from that single action and the browser opens automatically. The launcher runs in a visible console window labelled so the user knows that closing it stops Alice.

**Why this priority**: The brief requires "a single user action" and "no command-line interaction." A long-lived local server also needs an obvious shutdown path, or users leave it running unknowingly. Builds on US1 but is independently verifiable as a UX guarantee.

**Independent Test**: From the extracted package, perform exactly one action — double-click the launcher. Confirm that, without further input, the server starts and the default browser opens to the running app, and that if the browser does not auto-open the launcher surfaces the URL. Then close the launcher's console window (or press Ctrl+C) and confirm the server stops and the app is no longer reachable.

**Acceptance Scenarios**:

1. **Given** the extracted package, **When** the user double-clicks the launcher, **Then** the backend server starts and the frontend is served from the same origin.
2. **Given** the launcher has started the server, **When** startup completes, **Then** the user's default browser is opened to the local URL automatically.
3. **Given** the browser cannot be opened automatically, **When** startup completes, **Then** the launcher clearly displays the URL to open instead of failing silently.
4. **Given** Alice is running, **When** the user closes the launcher's console window or presses Ctrl+C, **Then** the server process terminates and the app is no longer reachable, with no orphaned process left running.
5. **Given** the launcher's console window, **When** it is displayed, **Then** it clearly indicates that closing it stops Alice (e.g. a titled "close this window to stop" message).

---

### User Story 4 — Clear startup error handling (Priority: P2)

When something is wrong — a required file is missing, the bundled runtime can't launch, or the port is already in use — the user sees a clear, human-readable message explaining the problem, rather than a window that flashes and disappears.

**Why this priority**: The brief mandates that startup failures are explicit and never silent. For non-technical users, a silent exit is the worst possible failure.

**Independent Test**: Induce each failure in turn — (a) remove/rename a required application file, (b) make the bundled runtime unlaunchable, and (c) occupy the default port with another process — then launch. Confirm (a) and (b) produce a clear, persistent error message identifying the problem (no silent vanish), and that (c) auto-recovers onto the next free port and opens the browser there.

**Acceptance Scenarios**:

1. **Given** a required application file is missing, **When** the user launches, **Then** a clear startup error names the problem and the process does not silently terminate.
2. **Given** the bundled runtime cannot be executed, **When** the user launches, **Then** a meaningful error message is shown.
3. **Given** the default port is already in use, **When** the user launches, **Then** Alice automatically selects the next available local port, opens the browser to that port, and indicates the port in use — rather than failing.

---

### User Story 5 — Repeatable, reproducible release artifact (Priority: P2)

A maintainer can generate the portable artifact on demand from a clean checkout with a single command, producing a consistent ZIP plus an integrity checksum suitable for upload to GitHub Releases — and a tagged release builds and attaches the same artifact automatically without consuming quota on every feature merge.

**Why this priority**: Without a repeatable, source-controlled build, the package can't be trusted or reproduced, and the 041 updater has nothing stable to download.

**Independent Test**: From a clean checkout, run `npm run build:portable` twice and confirm each run produces the standardized layout, a ZIP, and a checksum file, with equivalent contents. Inspect the GitHub Actions workflow and confirm it triggers **only** on a `v*` tag or manual dispatch (not on ordinary pushes/merges) and attaches the ZIP + checksum to a Release.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** `npm run build:portable` runs, **Then** it produces the standardized `alice/` layout, a distributable ZIP, and an integrity checksum, all reproducibly from source control.
2. **Given** the build output, **When** it is examined, **Then** it contains everything needed to run (app, bundled runtime, dependencies) and no developer-only or secret material.
3. **Given** the release workflow, **When** its triggers are reviewed, **Then** it runs only on a version tag (`v*`) or manual dispatch and never on per-feature merges, and it publishes the ZIP + checksum to a GitHub Release.

---

### User Story 6 — AI via the existing client-side BYOK (Priority: P3)

A user who wants AI-assisted features (resume/JD parsing, AI compatibility) enters their own OpenRouter key in Alice's existing Settings UI, exactly as in the dev/hosted app. The key is stored in the browser (`localStorage`) for the `127.0.0.1:<port>` origin; until it is set, those features are gracefully disabled and the rest of Alice works fully.

**Why this priority**: AI features (033/035/036/038) must remain reachable in portable mode, but they are optional and BYOK — core tracking must not depend on them. The portable build must not regress the existing BYOK flow, but it adds no new AI mechanism.

**Independent Test**: Launch the package with no AI key set and confirm AI-dependent features are disabled with a clear, non-blocking message while core tracking works. Then enter an OpenRouter key in Settings and confirm AI-dependent features become available. Confirm no key ships in the package and the server is never in the AI request path.

**Acceptance Scenarios**:

1. **Given** a fresh package with no AI key, **When** the user opens an AI-dependent feature, **Then** it is gracefully disabled with a clear explanation (existing `hasKey()`/`isEnabled()` gating) and the rest of the app is unaffected.
2. **Given** the user enters an OpenRouter key in Settings, **When** they use an AI-dependent feature, **Then** it works — the browser calls OpenRouter directly, with no server involvement.
3. **Given** the AI key lives in browser `localStorage`, **When** the program files (`app/`) are replaced on a future update, **Then** the key is unaffected (it was never part of `app/`), provided the origin (pinned port) is unchanged.

---

### User Story 7 — Foundation for future self-update (Priority: P3)

A maintainer building the future self-update feature (041) finds the package already exposes a determinable installed version and keeps program files separate from user data — so an updater can compare versions and replace `app/`/`runtime/` without touching `data/`/`config/`.

**Why this priority**: 040 explicitly establishes 041's foundation. It is a structural guarantee, not user-facing behavior, so it ranks below the user-facing stories — but it must be verified so 041 isn't blocked.

**Independent Test**: Inspect the package and confirm (a) the installed application version is readable from a stable location within the package, and (b) the layout cleanly separates replaceable program files (`app/`, `runtime/`) from preserved user state (`data/`, `config/`, `logs/`), such that replacing the former would not disturb the latter. Confirm no update detection/download/install logic is present (that is 041).

**Acceptance Scenarios**:

1. **Given** an installed package, **When** the installed version is queried, **Then** it can be determined from a stable, documented location.
2. **Given** the layout, **When** program directories are distinguished from user-state directories, **Then** `data/`, `config/`, and `logs/` are outside `app/` and `runtime/`.
3. **Given** this feature's scope, **When** the package is inspected, **Then** it contains no self-update detection, download, or installation behavior.

---

### User Story 8 — Hosted deployment stays compatible (Priority: P3)

The same single codebase that produces the portable package still builds and deploys to the hosted (Vercel) target unchanged — there is no fork, no separate desktop build path, and the portable-only behaviors (bundled runtime, static `dist/` serving, local data paths, BYOK config) are gated to local mode.

**Why this priority**: A core constitutional/architectural constraint. It's verified by inspection and existing tests rather than new user behavior, so it's P3, but a regression here would be serious.

**Independent Test**: Confirm the hosted build/deploy path (Vercel `vercel.json`, `api/index`, `dist` static) is unchanged and that portable-specific behavior (single-origin static serving, bundled-runtime launch, local data/config paths) does not activate in hosted mode. Confirm the existing test suite and lint pass.

**Acceptance Scenarios**:

1. **Given** the shared codebase, **When** it is deployed to hosted, **Then** hosted behavior (Supabase persistence, Vercel static + function routing, hosted BYOK) is unchanged.
2. **Given** the new static-serving behavior, **When** the app runs in hosted mode, **Then** the portable single-origin static serving does not interfere with Vercel's serving of `dist`.
3. **Given** the feature, **When** the codebase is reviewed, **Then** there is one application codebase and no separate desktop application.

---

### Edge Cases

- **Default port already in use**: the launcher auto-selects the next available local port and opens the browser to it (US4); it never silently fails. The chosen port stays bound to localhost only.
- **Alice already running / double launch**: a second launch finds the first instance's port busy and starts on a different local port; both share the same `data/` SQLite database (single writer; SQLite serializes writes), and neither corrupts the other's data. (Concurrent multi-instance use is not a supported workflow, but must not corrupt data.)
- **Stopping Alice / orphaned process**: closing the launcher's console window (or Ctrl+C) terminates the server cleanly with no orphaned `node.exe` left holding the port; the next launch can reuse the default port.
- **Extraction path with spaces or non-ASCII characters**: the launcher must operate correctly regardless of where the user extracts (quoted paths, no hard-coded absolute paths).
- **Windows SmartScreen / mark-of-the-web on the launcher**: because the package ships only the official signed `node.exe` and plain scripts (no self-extracting executable), it does not trip antivirus heuristics; the user may still see a one-time SmartScreen prompt for the downloaded script, which is expected and documented, not a defect.
- **Corrupted or partially extracted package** (missing `app/`, `runtime/`, or required files): startup detects the missing pieces and shows a clear error (US4).
- **First launch vs. subsequent launch**: first launch creates `data/` (and an empty database via existing schema init) and may create a default `config/`; subsequent launches reuse them without overwriting (US2).
- **No AI key configured**: AI-dependent features are disabled gracefully; core tracking is fully usable (US6).
- **Port drift vs. browser-local state**: because the AI key and UI prefs live in `localStorage` keyed to `127.0.0.1:<port>`, a launch that falls back to a different port (default busy) presents a different origin and the stored key/prefs appear absent until re-entered. Server-side SQLite data is unaffected. Mitigation: keep a stable default port and let `config/` pin a preferred port; document this behavior.
- **Browser fails to auto-open** (no default browser, headless context): the launcher prints/shows the URL for manual opening (US3).
- **User relocates the extracted folder between launches**: because data/config are relative to the package root and the DB path is resolved within the package, moving the whole `alice/` folder keeps data intact; the launcher must not depend on a fixed absolute install path.
- **Antivirus quarantine of `node.exe`**: documented as an environmental possibility with guidance, not something the feature can fully prevent; the launcher surfaces a clear runtime-launch error if it occurs (US4).

---

## Requirements *(mandatory)*

### Functional Requirements

**Distribution package**

- **FR-001**: The project MUST produce a portable Windows release artifact distributed as a single **ZIP** archive that extracts to a self-contained `alice/` directory.
- **FR-002**: The artifact MUST contain all components required to run Alice locally (application, bundled runtime, and all runtime dependencies) and MUST NOT require any additional dependency installation by the user.
- **FR-003**: Running Alice from the artifact MUST NOT require installing Node.js, cloning the repository, running a package manager, an installer, administrative privileges, or registry modifications.

**Bundled runtime**

- **FR-004**: The package MUST include a bundled official Node.js runtime (`node-win-x64`) used to launch Alice, and the bundled runtime MUST be used in preference to (and independently of) any system-installed Node.js.
- **FR-005**: The package MUST include the prebuilt `better-sqlite3` native binary matching the bundled Node version and Windows x64 architecture, so the database layer works without any local compilation step.
- **FR-006**: The package MUST NOT be a single self-extracting executable; it ships the official signed `node.exe` and plain application files to avoid antivirus/SmartScreen false positives.

**Startup experience**

- **FR-007**: The package MUST provide a Windows launcher that starts Alice with a **single user action** (double-click) and MUST NOT require command-line interaction.
- **FR-008**: The launcher MUST start the backend server and make the frontend available, and MUST open the user's default browser to the local application URL for the actual port in use; if the browser cannot be opened automatically, the launcher MUST display the URL for manual opening.
- **FR-009**: In portable/local mode the Express server MUST serve the pre-built Vite `dist/` static assets (with single-page-app fallback) and the `/api` routes from the same process and origin, so no separate frontend/dev server is required.
- **FR-010**: The launcher MUST set the runtime mode to local and configure the local data, config, and log locations within the package before starting the server.
- **FR-030**: The launcher MUST run in a **visible console window** that clearly indicates closing it (or pressing Ctrl+C) stops Alice, and doing so MUST terminate the server cleanly with no orphaned process holding the port. No separate stop script or system-tray control is provided in v1.
- **FR-031**: In portable/local mode the server MUST bind to **`127.0.0.1` (localhost only)** and MUST NOT be reachable from other devices on the network. (LAN/multi-device access is out of scope and deferred to a future, authentication-gated feature.)
- **FR-032**: When the default port is unavailable, the launcher MUST automatically select the next available **local** port and open the browser to it, rather than failing; the auto-selected port MUST remain bound to localhost only.

**Local data persistence**

- **FR-011**: The SQLite database MUST persist between launches and MUST be stored under the package's `data/` directory, outside `app/` and `runtime/`.
- **FR-012**: User configuration MUST persist between launches and MUST be stored under the package's `config/` directory, outside `app/` and `runtime/`.
- **FR-013**: Relaunching Alice MUST reuse existing local data and configuration rather than creating new empty stores, and MUST NOT overwrite or corrupt existing user data.
- **FR-014**: The package layout MUST keep user data logically separated from program files so that replacing `app/`/`runtime/` would not disturb `data/`/`config/`/`logs/` (foundation for 041; no update logic implemented here).

**Standardized layout**

- **FR-015**: The package MUST implement a standardized deployment layout with distinct directories for program files (`app/`, `runtime/`) and user state (`data/`, `config/`, `logs/`) plus the root launcher. (Exact directory names and internal arrangement are an implementation detail; the separation is the requirement.)
- **FR-016**: The package MUST write runtime logs to the `logs/` directory (or otherwise make startup/runtime diagnostics retrievable) to support troubleshooting without a terminal.

**AI (existing client-side BYOK) & local launch settings**

- **FR-017**: The package MUST NOT introduce any server-side AI key file or AI proxy. AI-dependent features MUST continue to use the existing client-side `localStorage` OpenRouter BYOK, with the browser calling the provider directly; no AI key MUST ship in the package.
- **FR-018**: When no AI key is set, AI-dependent features MUST remain gracefully disabled (existing `hasKey()`/`isEnabled()` gating) and all non-AI functionality MUST remain fully usable; when the user sets a key in Settings, those features MUST become available with no relaunch required.
- **FR-019**: The `config/` directory MAY hold optional **local launch settings** (e.g. a pinned preferred port) that the launcher reads at startup; these settings persist across launches and across program-file replacement, and pinning the port keeps the `localStorage` origin (and thus the stored AI key/prefs) stable.

**Error handling**

- **FR-020**: If required application files are missing or the package is incomplete, startup MUST display a clear error identifying the problem and MUST NOT terminate silently.
- **FR-021**: If the bundled runtime cannot be launched, the launcher MUST provide a meaningful error message.
- **FR-022**: If the default port is unavailable, the server MUST NOT fail invisibly; it MUST auto-recover onto the next available local port (per FR-032) and indicate the port actually in use.

**Build & release process**

- **FR-023**: The project MUST provide a repeatable build command (`npm run build:portable`) that assembles the standardized layout, produces the distributable ZIP, and emits an integrity **checksum**, reproducibly from source control.
- **FR-024**: The build output MUST be suitable for publication through GitHub Releases and MUST NOT include developer-only material or secrets (no AI keys, no `.env`, no Supabase credentials).
- **FR-025**: The project MUST provide a GitHub Actions workflow that builds and attaches the artifact (ZIP + checksum) to a GitHub Release, triggered **only** on a version tag (`v*`) or manual `workflow_dispatch`, and MUST NOT trigger a release build on ordinary per-feature merges/pushes.
- **FR-026**: The package MUST expose the installed application version from a stable, documented location so a future updater can determine it (foundation for 041).

**Architecture & compatibility**

- **FR-027**: This feature MUST preserve a single shared application codebase deployable to both the portable local target and the hosted (Vercel) target; it MUST NOT introduce a separate desktop application or codebase.
- **FR-028**: Portable-only behaviors (bundled-runtime launch, single-origin static serving, local data/config/log paths, BYOK config) MUST be gated to local mode and MUST NOT change hosted (Vercel) build, routing, persistence, or BYOK behavior.
- **FR-029**: This feature MUST NOT change the application data model, database schema, validation rules, or the behavior of any existing backend route; the only server change permitted is adding static `dist/` serving in local/portable mode (FR-009).

### Key Entities

This feature introduces **no new persisted application entities** and changes no existing application fields. The constitution's required application fields (company name, job title, status, `lastStatusUpdate`, responsibilities) and the existing SQLite schema are unaffected. It defines packaging/runtime artifacts:

- **Release artifact** — the distributable ZIP plus its integrity checksum, produced reproducibly from source and published to GitHub Releases.
- **Standardized package layout** — the on-disk structure separating program files (`app/`, `runtime/`) from preserved user state (`data/`, `config/`, `logs/`) with the root launcher.
- **Bundled runtime** — the official `node-win-x64` binary plus the matching prebuilt `better-sqlite3` native binary, shipped inside the package.
- **Local launch settings** — optional user-editable settings under `config/` (e.g. a pinned preferred port) read by the launcher at startup, persisted across launches and surviving program-file replacement. (The AI key is not here — it lives in browser `localStorage`.)
- **Installed-version marker** — a stable, readable indicator of the packaged application version (foundation for 041).

---

## Data Considerations

- **No schema or data-model changes.** No columns added, removed, or repurposed; no migration introduced; no backend route behavior changed. The existing local schema-init path (`server/db.js` `initSchema`) runs as today.
- **Local-only data location.** In portable mode the SQLite database is resolved within the package's `data/` directory (via the existing `ALICE_DB_PATH` override), not under program files — so updates and folder moves never risk user data.
- **Configuration as data.** Local **launch settings** (e.g. a pinned preferred port) live under `config/`, are treated as preserved user state, and are never bundled with program files or committed to source control. The AI key is **not** here — it stays in browser `localStorage` per the existing BYOK.
- **AI key never on disk.** The OpenRouter key lives only in browser `localStorage` for the `127.0.0.1:<port>` origin; the portable package ships no key and the server never reads, stores, or proxies it. A pinned port keeps that origin (and the stored key) stable across launches.
- **Required-field validation unchanged.** Existing required-field and URL/date validation continues to run before save exactly as today; portable mode introduces no separate validation path.
- **No secrets in the artifact.** The build MUST exclude `.env`, Supabase credentials, and any AI keys. The user's only secret — their OpenRouter key — lives in browser `localStorage` (not on disk in the package); `config/` holds non-secret launch settings only.
- **No network exposure.** The portable server binds to `127.0.0.1` only, so a user's private application data is never reachable from other devices on the network. Local mode ships no authentication, which is acceptable precisely because nothing is exposed beyond the local machine.
- **Hosted persistence untouched.** Supabase (hosted) and demo modes are unaffected; portable mode is strictly local SQLite.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a Windows machine with no system Node.js and no repository checkout, a user goes from downloaded ZIP to a working Alice in the browser in **under five minutes**, using only extract + double-click.
- **SC-002**: A user can run Alice with **zero** manual dependency installs and **zero** repository clones (100% of launches require neither).
- **SC-003**: Launching Alice requires exactly **one user action** (double-click) and **no** command-line interaction, and the default browser opens automatically (or the URL is shown if it cannot).
- **SC-004**: Application data (applications, profile, settings) persists across **100%** of normal restarts, with the database located under `data/` outside program files.
- **SC-005**: Every induced startup failure (missing file, unlaunchable runtime, busy port) produces a **clear, visible** error and **never** a silent exit.
- **SC-006**: `npm run build:portable` produces the standardized layout, ZIP, and checksum **reproducibly** from a clean checkout, and the release workflow publishes them while triggering **only** on a version tag or manual dispatch.
- **SC-007**: With no AI key set, **100%** of non-AI functionality remains usable and AI-dependent features are disabled gracefully; after the user enters an OpenRouter key in Settings, AI features become available — with no key on disk and no server in the AI path.
- **SC-008**: The same codebase still deploys to hosted (Vercel) with **no** change to hosted behavior, and the existing test suite and lint pass.
- **SC-009**: The package exposes a determinable installed version and a clean program-vs-data separation, satisfying the structural prerequisites for feature 041 — with **no** update logic shipped in 040.
- **SC-010**: The portable server is reachable **only** from `127.0.0.1` and never from another device on the network; a busy default port auto-recovers onto another local port in 100% of cases (no silent failure).
- **SC-011**: A user can stop Alice by closing the launcher's console window (or Ctrl+C) in 100% of cases, leaving no orphaned process holding the port.

---

## Assumptions

- **Windows-only v1.** The launcher, bundled runtime (`node-win-x64`), and prebuilt `better-sqlite3` binary target Windows x64; macOS/Linux portability is deferred. The layout is chosen so it does not preclude future cross-platform support, but no non-Windows assets are produced here.
- **Bundling approach is "official Node + node_modules"** (clarified 2026-06-22): ship the signed `node.exe` plus the application and its `node_modules` (including the prebuilt native binary). No single self-extracting executable and no esbuild server bundling — chosen for antivirus safety and simplicity, and verified not to disadvantage feature 041.
- **Single-origin local serving.** Portable mode adds static serving of the built `dist/` (with SPA fallback) to the existing Express server so one process/port serves both UI and API. Hosted continues to serve `dist` via Vercel static + `api/index`; the static-serving addition is gated to local mode.
- **Existing env-based wiring is reused.** The launcher sets `APP_RUNTIME=local`, the port, and `ALICE_DB_PATH` (and AI/config values) so the package self-contains its data without code changes to config resolution.
- **AI uses the existing client-side BYOK** (clarified/corrected 2026-06-22). The OpenRouter key and AI settings live in browser `localStorage` (`alice.ai.*`); the browser calls OpenRouter directly and the server is never in the AI path. Portable mode adds no AI config and ships no key; `config/` holds launch settings (e.g. a pinned port) instead. Hosted is unaffected — same client-side BYOK.
- **Release cadence is deliberate.** Releases (and the Actions workflow that builds them) are cut per shipped version via tag/dispatch, not per feature merge, to conserve free-tier quota.
- **041 is the consumer of this foundation.** Self-update detection, download, validation-before-install, automatic migration, restart, and update preferences are entirely out of scope for 040 and owned by 041; 040 provides only the version marker, the checksum, and the program-vs-data separation.
- **Localhost-only, no network exposure.** The portable server binds to `127.0.0.1` (clarified 2026-06-22); LAN/multi-device access is a deferred, authentication-gated future feature.
- **Visible console window is the stop control.** Alice runs in a console window the user closes (or Ctrl+C) to stop it (clarified 2026-06-22); no tray, service, or auto-start in v1.
- **Busy port auto-recovers.** The launcher tries the default port and increments to the next free local port, opening the browser to whichever it chose (clarified 2026-06-22) — staying localhost-bound throughout.
- **Local-first and privacy preserved.** The portable package adds no external analytics or tracking; the constitution's one Speed-Insights exception is hosted-prod only and is not part of this package.
