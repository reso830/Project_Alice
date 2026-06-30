# Implementation Plan: Self-Update Support

**Branch**: `041-self-update-support` | **Date**: 2026-06-26 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/041-self-update-support/spec.md`

---

## Summary

This feature implements a self-update mechanism for portable Project Alice installations on Windows. The application will query the GitHub Releases API for newer releases, download and verify the zip archive, and extract files to a staging directory. When the user confirms the update, the Express backend halts, allowing the CMD launcher (`Start-Alice.cmd`) to copy the new binaries (releasing Windows file locks on Node and native SQLite modules), delete the staging folder, and restart. 

Additionally, this feature replaces the simple port-only health probe from 040 with a robust PID-and-port-based lockfile (`data/alice.lock`) to prevent concurrent instances and database corruption. It also introduces a greenfield database migration subsystem for SQLite using a `schema_migrations` ledger table and version compatibility verification.

**Increment 2 (Git Channel for Clone Installs)** extends the feature beyond the Windows portable package: `git clone` installs get an in-app self-update, cross-platform, via a distinct **git channel**. A new `npm start` launcher (`scripts/start-alice.mjs`) builds and serves `dist/` and, on the update signal, runs `git fetch --tags` → `git checkout <release-tag>` → `npm install` → `npm run build` → relaunch — the cross-platform analogue of `Start-Alice.cmd`. The capability gate (`/api/health`) is revised to resolve an update **channel** (`portable` | `git`) from a launcher-set flag, so the updater renders only for the portable package on Windows or a launcher-run clone, and is hidden for raw `npm run dev` / `server:start`, Hosted, and Demo (this also corrects the prior false-positive on a raw Windows clone). The portable ZIP-swap path is unchanged. See spec "Git-Channel Self-Update (Clone Installs)" and `tasks.md` Phases 09–11.

---

## Technical Context

- **Language/Version**: Node.js v24.14.1 (bundled in portable runtime).
- **Primary Dependencies**: Native Node modules (`fs`, `path`, `crypto`, `https`, `child_process`) and `better-sqlite3`. No new libraries are introduced.
- **Storage**: 
  - **Local (SQLite)**: Active database migrations run automatically on startup. The database file `data/alice.db` is backed up to `data/alice.db.migration-backup` before running migrations, and restored if a migration fails. We will implement a greenfield migration registry and ledger table (`schema_migrations`) in SQLite. Existing pre-041 databases (which already contain core tables like `applications` or `profile` but lack `schema_migrations`) will be baselined on startup: the runner will initialize the ledger and insert the initial migration version (`001-init`) as already applied, bypassing execution of the setup scripts. Update configuration settings (`autoCheckUpdates`, `updateMode`) are stored in `config/settings.json`.
  - **Hosted (Supabase)**: Out of scope. Deployed via regular Vercel pipeline; updater and settings are hidden on hosted deployments. Supabase schema migrations are managed independently and are out of scope.
  - **Demo Mode**: Settings subgroup is hidden. No updates checks are performed.
- **Testing**: Vitest (unit tests) and manual browser walkthroughs (smoke tests).
- **Target Platform**: Windows x64 (portable distribution environment). *Increment 2 adds the git channel for clone installs on macOS, Linux, and Windows (requires Git + Node.js, inherent to running from a clone).*
- **Project Type**: Desktop-local web service / portable bundle.
- **Performance Goals**: Update checks must complete in <1.5s (excluding GitHub network latency). Startup instance checks must verify PID in <50ms.
- **Version Source of Truth**: The version source of truth is `package.json` for the backend (read at runtime relative to the server script) and `src/pages/welcome/shared/appMeta.js` for the frontend. For testing and mocking purposes, the backend supports overriding the version using the `ALICE_VERSION_OVERRIDE` environment variable. The launcher script (`Start-Alice.cmd`) performs the update by swapping the `app/` and `runtime/` directories, which replaces these files.
- **Constraints**: Local-first compliance (no user tracking or diagnostic metrics sent in GitHub API requests). Windows file locks must be released before swapping.

---

## Restart Handoff & Shutdown Contract

To cleanly update files on Windows, the running Node process must fully release all locks on files (like `better-sqlite3` native bindings and the `node.exe` executable).

1. **createApp Options**: The Express app creator `createApp({ ..., onShutdown })` in `server/index.js` accepts an optional `onShutdown` callback function.
2. **Update Router**: The router factory `createUpdateRouter({ onShutdown })` is created and mounted under `/api/update`.
3. **POST /api/update/restart**:
   - The route handler writes `data/update-pending.json` (specifying that the launcher should run the file-swap loop).
   - The route handler returns a `200 OK` JSON response to the client.
   - After responding, the route handler schedules a 500ms timeout to invoke `onShutdown()`.
4. **onShutdown Callback**:
   - In `server/portable.js`, the `onShutdown` callback is defined. It invokes the returned `stop()` function, which closes the HTTP `server` listener (`server.close()`) and the SQLite database (`db.close()`).
   - Once all resources are cleanly released, the callback calls `process.exit(0)`.
5. **Testing**: 
   - A mock `onShutdown` callback is passed during unit tests for the `/api/update/restart` route. The test asserts that the route handler writes the pending file, returns 200 OK, and triggers the `onShutdown` callback.

---

## Development & Test Update Mocking

To support testing the end-to-end update process (download -> integrity check -> staging extraction -> restart -> script folder replacement) before any release is actually published to GitHub:

1. **API Redirection**: When the `ALICE_UPDATE_SOURCE_OVERRIDE` environment variable is set, the update check logic in `/api/update/check` will fetch release metadata from that URL (or local server endpoint) instead of `api.github.com`.
2. **Local Test Fixture**:
   - A mock update package `tests/fixtures/update-v1.10.0.zip` containing a dummy update version and a modified launcher script, alongside its SHA256 checksum file `update-v1.10.0.zip.sha256`.
   - The test script or development setup uses this override to point to the local server hosting these mock assets, testing the full staging flow without external network dependencies.

---

## Constitution Check

- **Data Fields**: Not adding new application business models. Configuration schemas are restricted to update behaviors.
- **Architecture**: Separates staging extraction from file replacement. The launcher performs file movements to bypass locks, keeping Express application logic simple and maintainable.
- **Centralized Validation**: Uses existing schema-based validation for `config/settings.json`.
- **Testing**: Unit tests will cover version string comparison (`v1.9.0` < `v1.10.0`), checksum verification, lockfile validation, and stale lock cleanups.
- **UI Verification**: A browser smoke test will verify the settings page layout (updates settings section hidden on hosted, visible on local) and the toast update notification.
- **Privacy & Telemetry**: Checks are client-to-server proxied and send no cookies, PII, or tracking tokens to GitHub.

---

## Affected Areas

### Files to Inspect
- `package.json`
- `src/pages/welcome/shared/appMeta.js` (holds the SemVer string variable)
- `server/portable/listen.js` (port fallback handling)

### Files to Modify
- `scripts/portable/Start-Alice.cmd` (add staging checks, folder moves, and script self-re-execution)
- `server/portable.js` (implement lockfile checks and PID kill checks)
- `server/portable/settings.js` (add defaults and parsing for `autoCheckUpdates` and `updateMode`)
- `server/health.js` (implement and export the health response payload generator including version and updates capability)
- `server/index.js` (mount update route handlers, accept `onShutdown` callback in `createApp` options, and import and query the payload generator from `server/health.js` to serve `/api/health` response)
- `server/routes/update.js` (new endpoints for check, download status, restart command, settings)
- `server/db.js` (integrate migration initialization, ledger checks, and pre-migration backup triggers)
- `server/db/migrations/` (new directory for SQLite schema version scripts)
- `src/components/Footer.js` (hosted: show latest release download button; local: show link back to hosted)
- `src/components/Navbar.js` (render persistent update notification badge on Profile nav button)
- `src/components/BottomTabBar.js` (render persistent update notification badge on Profile tab button)
- `src/pages/Profile.js` (hide Updates subgroup on Hosted/Demo mode, show on Local mode; handle Connection Error and Update Failed states)
- `src/components/UpdateToast.js` (new toast notification covering Available, Downloading, Installing, and Error/Failed states)

### Tests to Add/Update
- `tests/unit/update.test.js` (unit tests covering lockfile write/delete, version comparison, and staging path recovery)
- `tests/unit/migration.test.js` (unit tests covering migration ledger tracking, transaction rollbacks, and downgrade safety)
- Manual browser walkthroughs (smoke tests for toast container, settings card, and error visual states)

### Areas Explicitly Out of Scope
- Auto-updating in Hosted (Vercel) or Demo mode.
- Database migrations on Hosted/Vercel (Supabase schema migrations are managed through external migration pipelines).

---

## Project Structure

Concrete layout for files added by this feature:

```text
specs/041-self-update-support/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    ├── requirements.md
    └── plan-review.md

server/
├── db.js                 # Modified to integrate migrations and registry
├── db/
│   └── migrations/       # Greenfield migration folder
│       └── [migration-scripts].js
├── routes/
│   └── update.js         # New update routes
└── portable/
    └── settings.js       # Modified to support update settings

src/
├── components/
│   └── UpdateToast.js    # New update toast component
└── pages/
    └── Profile.js        # Modified to include updates settings
```

**Structure Decision**: Modified Express backend and added UI components under `src/components/` and `src/pages/`. Follows the single codebase layout of Project Alice.

---

## Complexity Tracking

*No constitutional violations identified. Plan complies fully with v1.5.0 principles.*
