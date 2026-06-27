# Tasks: Self-Update Support

**Feature**: `041-self-update-support` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Conventions: tasks are small, ordered, and specific. `[P]` marks parallelizable tasks. Status legend: `[x]` done · `[ ]` pending · `[~]` skipped.
Commands: `npm run test:run`, `npm run lint`.

Phase dependency: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08

## Phase summary

| Phase | Focus | Tasks | Stories |
|---|---|---|---|
| 01 | Setup (Shared Infrastructure) | T001–T002 | Skeleton & route registration |
| 02 | Foundational (Lockfile, Version Health, Migrations) | T003–T009 | Single-instance lock file & greenfield SQLite migrations |
| 03 | User Story 1 (Discovery & Update Staging) | T010–T017 | P1 (Discover & trigger updates) |
| 04 | User Story 2 (Launcher Staging Swap & End-to-End Safety) | T018–T019 | P1 (Lock-aware single instance & safe exit) |
| 05 | User Story 3 (Settings Interface) | T020–T022 | P2 (Configure update preferences) |
| 06 | Polish & Cross-Cutting Concerns | T023–T024 | Accessibility & style gates |
| 07 | Release Prep | T025–T031 | SemVer metadata & operator docs |
| 08 | Browser Smoke Test | T032–T035 | Walkthroughs in real browser |

---

## Phase 01: Setup (Shared Infrastructure)

**Purpose**: Register endpoints and set up route skeletons for updates.

- [ ] T001 [P] Mount update router in `server/index.js`
  - **Target**: [server/index.js](../../server/index.js)
  - **Expected behavior**: Import and mount a new update router under `/api/update` routes. The `createApp` factory accepts `onShutdown` in its options, passing it down to the update router factory (`createUpdateRouter({ repos, onShutdown })`).
  - **Constraints**: Gated to local mode only (`process.env.APP_RUNTIME === 'local'`) and Windows (`process.platform === 'win32'`). Pass a no-op fallback callback if `onShutdown` is omitted.
  - **Validation/test**: `tests/unit/update.test.js`
  - **Out of scope**: Update logic implementation.

- [ ] T002 Create empty routes skeleton file at `server/routes/update.js`
  - **Target**: [server/routes/update.js](../../server/routes/update.js) (new)
  - **Expected behavior**: Create the file, export an Express router, and add empty route placeholders for checks, status, settings, downloads, and restarts.
  - **Constraints**: Return empty templates or 501 Not Implemented for v1 placeholders.
  - **Validation/test**: Verification of server startup.

---

## Phase 02: Foundational (Lockfile, Version Health, Migrations)

**Purpose**: Implement single-instance locks, inject version in health checks, and build the greenfield SQLite migration subsystem.

- [ ] T003 Create lockfile management helper in `server/portable/lock.js`
  - **Target**: [server/portable/lock.js](../../server/portable/lock.js) (new)
  - **Expected behavior**: Create helper functions:
    - `writeLock(port)`: writes a JSON lockfile to `data/alice.lock` containing schema `version: 1`, `pid: process.pid`, `port`, `appVersion: APP_VERSION`, and `launchTime: ISOString`.
    - `checkLock()`: checks if `alice.lock` exists. Validates if the written PID is active using `process.kill(pid, 0)` on Windows, and probes the port's health. Returns status object.
    - `removeLock()`: deletes `alice.lock`.
  - **Constraints**: Use Node-native `fs` and `process.kill`. Must handle stale PIDs gracefully.
  - **Validation/test**: `tests/unit/portable-lock.test.js`

- [ ] T004 Integrate single-instance lock file checks into `server/portable.js`
  - **Target**: [server/portable.js](../../server/portable.js)
  - **Expected behavior**: Replace the port-only health probe check at startup with a call to the new lock manager. Write lockfile on bind success, and remove it on process exit/SIGINT/SIGTERM.
  - **Constraints**: Must fallback to subsequent ports if the port is bound by a non-Alice process. Lock must survive file replacements.
  - **Validation/test**: Double launch validation in development environment.
  - **Out of scope**: Staging file-swaps.

- [ ] T004b [US2] Implement `onShutdown` callback in `server/portable.js`
  - **Target**: [server/portable.js](../../server/portable.js)
  - **Expected behavior**: Define an `onShutdown` callback function and pass it when calling `createApp({ repositories, config, onShutdown })`. The callback must invoke the portable server's `stop()` function (which closes the HTTP listener and database connection) and then call `process.exit(0)`.
  - **Constraints**: Must ensure all locks and files are cleanly released on shutdown.
  - **Validation/test**: Verify process exits cleanly during a simulated shutdown.

- [ ] T005 Update health endpoint to expose app version in `server/health.js`
  - **Target**: [server/health.js](../../server/health.js)
  - **Expected behavior**: Include the `version` field mapped to the `APP_VERSION` constant in the JSON health payload.
  - **Constraints**: Safe for both hosted and local runtimes.
  - **Validation/test**: `tests/server/health.test.js` or manual curl checks.

- [ ] T006 [P] Create unit tests for SQLite migrations in `tests/unit/migration.test.js`
  - **Target**: `tests/unit/migration.test.js` (new)
  - **Expected behavior**: Assert database migration runner correctly applies unapplied scripts, runs migrations sequentially, logs to `schema_migrations` table, rolls back transactions on failure, and blocks startup on downgrade attempts.
  - **Constraints**: Uses database mocks where appropriate.
  - **Validation/test**: Run tests and verify they fail before implementation.

- [ ] T007 Create database migration registry in `server/db/migration.js`
  - **Target**: [server/db/migration.js](../../server/db/migration.js) (new)
  - **Expected behavior**: Implement migration setup, parsing of schema folder scripts, run-once sequential checking, transaction boundaries, and the version downgrade check. The runner MUST support legacy baselining: if `schema_migrations` does not exist but target tables (`applications` or `profile`) already exist, create `schema_migrations` and insert `001-init` as applied to skip running the initial schema creation script.
  - **Constraints**: Keep SQLite-specific methods clean.
  - **Validation/test**: `tests/unit/migration.test.js`

- [ ] T008 Integrate migrations runner and pre-migration backups in `server/db.js`
  - **Target**: [server/db.js](../../server/db.js)
  - **Expected behavior**: Wrap database initialization to: (1) copy db to `.migration-backup` before migrations; (2) trigger `migration.js` runner; (3) delete backup on success; (4) restore backup on error and throw exception.
  - **Constraints**: Scoped to local mode only.
  - **Validation/test**: `tests/unit/migration.test.js`

- [ ] T009 Move portable database schema creation to the first migration script
  - **Target**: [server/db/migrations/001-init.js](../../server/db/migrations/001-init.js) (new) and [server/db.js](../../server/db.js)
  - **Expected behavior**: Relocate the base database layout schema setup (which is currently hardcoded inside `db.js` as CREATE TABLE statements) to the first migrations script `001-init.js`, so it is applied via the migrations runner.
  - **Constraints**: Must not break initial local seeded database state.
  - **Validation/test**: Local application startup verification.

---

## Phase 03: User Story 1 - Discover and Trigger Updates (Priority: P1) 🎯 MVP

**Goal**: Query GitHub for updates, download files to staging, compute validation checksums, and trigger restarts.

- [ ] T010 [P] [US1] Create unit tests for release parsing and checksum check in `tests/unit/update.test.js`
  - **Target**: `tests/unit/update.test.js` (new)
  - **Expected behavior**: Test release tag comparisons (e.g. `'v1.9.0'` < `'v1.10.0'`), zip package integrity checks (comparing computed SHA256 hashes against checksum files), and settings validation. Must explicitly test normalization of the 'v' prefix (verifying that comparing `'v1.10.0'` against `'1.9.0'` or `'1.10.0'` against `'v1.10.1'` handles prefixes correctly by stripping them).
  - **Constraints**: Unit tests run locally using mock payloads.
  - **Validation/test**: Verify that tests run and fail.

- [ ] T011 [US1] Implement version check endpoint `GET /api/update/check` in `server/routes/update.js`
  - **Target**: [server/routes/update.js](../../server/routes/update.js)
  - **Expected behavior**: Query the GitHub API (`GET /repos/reso830/Project_Alice/releases/latest`) on demand, compare with current `APP_VERSION` (normalizing 'v' prefixes on both strings prior to SemVer comparison), cache results for 1 hour in-memory on the backend, and return update payload.
  - **Constraints**: No tracking tokens or telemetry transmitted. Rate limits handled gracefully.
  - **Validation/test**: Unit tests in `tests/unit/update.test.js`.

- [ ] T012 [US1] Implement update download and staging in `server/routes/update.js`
  - **Target**: [server/routes/update.js](../../server/routes/update.js)
  - **Expected behavior**: Route `POST /api/update/download` triggers background download of release ZIP and SHA256 checksum file to `data/update-staging/`. Extracts archive to `data/update-staging/alice/` and verifies hash. Reports progress via status object.
  - **Constraints**: Staging folder cleared on failure.
  - **Validation/test**: `tests/unit/update.test.js`.

- [ ] T013 [US1] Implement status query endpoint `GET /api/update/status` in `server/routes/update.js`
  - **Target**: [server/routes/update.js](../../server/routes/update.js)
  - **Expected behavior**: Return the current state of download/staging progress (`idle`, `downloading`, `ready-to-restart`, `failed`).
  - **Constraints**: Synchronous reads from active staging memory.
  - **Validation/test**: `tests/unit/update.test.js`.

- [ ] T014 [US1] Implement update restart command route `POST /api/update/restart` in `server/routes/update.js`
  - **Target**: [server/routes/update.js](../../server/routes/update.js)
  - **Expected behavior**: Writes a pending update metadata file (`data/update-pending.json`), returns a `200 OK` response to the client, and delegates the shutdown sequence by calling a registered `onShutdown` callback after a 500ms delay.
  - **Constraints**: The router factory function must accept an options object containing `onShutdown`.
  - **Validation/test**: Unit tests in `tests/unit/update.test.js` using a mocked callback.

- [ ] T015 [US1] Create toast component `src/components/UpdateToast.js`
  - **Target**: `src/components/UpdateToast.js` (new)
  - **Expected behavior**: Toast popup rendering in the bottom-right (desktop) or card at the bottom (mobile), managing status changes, progress bar, error states (rendering a warning icon, error description, and "Manage in Settings" link), and primary actions (What's new ↗ link, Install now, Restart to finish).
  - **Constraints**: Mobile view wraps buttons, primary button becomes full-width. Accessible labels included.
  - **Validation/test**: Browser visual checks and error state simulation.

- [ ] T016 [US1] Mount `UpdateToast` in global layout `src/main.js`
  - **Target**: [src/main.js](../../src/main.js)
  - **Expected behavior**: Render the `UpdateToast` component in the main application layout.
  - **Constraints**: Gated by local-mode and Windows platform client verification.
  - **Validation/test**: Verification of toast rendering on mock available version.

- [ ] T017 [US1] Update `src/components/Footer.js` to render mode-aware controls
  - **Target**: [src/components/Footer.js](../../src/components/Footer.js)
  - **Expected behavior**: 
    - Hosted: show latest release download button (`https://github.com/reso830/Project_Alice/releases/latest`).
    - Local: show link back to hosted site (`Open hosted version ↗`).
  - **Constraints**: Follow exact styling tokens.
  - **Validation/test**: Verification of footer states in dev (local) and production (hosted) configurations.

- [ ] T017b [US1] Render persistent update notification badge on Navbar and BottomTabBar
  - **Target**: [src/components/Navbar.js](../../src/components/Navbar.js) and [src/components/BottomTabBar.js](../../src/components/BottomTabBar.js)
  - **Expected behavior**: If an update check indicates that a new version is available, downloading, or ready-to-restart, render a subtle colored dot on the "Profile" nav/tab button (amber for available/downloading, indigo for ready-to-restart).
  - **Constraints**: Only active in Local mode. The badge must update dynamically as the update status changes and must disappear once the system restarts.
  - **Validation/test**: Manual and visual checks of the nav buttons under simulated update states.

---

## Phase 04: User Story 2 - Lock-Aware Single Instance & Safe Exit (Priority: P1)

**Goal**: Update CMD launcher to swap staging folders and verify database backup rollback safety end-to-end.

- [ ] T018 [US2] Update launcher script `scripts/portable/Start-Alice.cmd` to perform updates swap
  - **Target**: [scripts/portable/Start-Alice.cmd](../../scripts/portable/Start-Alice.cmd)
  - **Expected behavior**: Add script block at startup: if `data/update-staging/alice` exists, replace `app/` and `runtime/` directories, overwrite `Start-Alice.cmd` itself, delete the staging folder, and re-execute `Start-Alice.cmd`.
  - **Constraints**: Overwriting of `.cmd` script must be the final action, followed by absolute path invocation to avoid CMD parser errors.
  - **Validation/test**: Manual file swap verification.

- [ ] T019 [US2] Verify database rollback restore safety end-to-end by provoking a schema migration error
  - **Target**: Local SQLite database and runtime logs
  - **Expected behavior**: Create a temporary migration script with syntax errors, boot the app, and assert that the startup sequence halts, the logs report the failure, and `data/alice.db` is restored to its exact pre-migration state.
  - **Constraints**: Verification only.
  - **Validation/test**: This is the validation task.

---

## Phase 05: User Story 3 - Configure Update Preferences (Priority: P2)

**Goal**: Save and read update settings and render Updates settings panel.

- [ ] T020 [US3] Implement settings endpoints `GET /api/update/settings` and `POST /api/update/settings`
  - **Target**: [server/routes/update.js](../../server/routes/update.js)
  - **Expected behavior**: Read/write config values (`autoCheckUpdates`, `updateMode`) from/to `config/settings.json`.
  - **Constraints**: central schema verification of values.
  - **Validation/test**: Verification of local settings file contents.

- [ ] T021 [US3] Add Updates subgroup to `src/pages/Profile.js`
  - **Target**: [src/pages/Profile.js](../../src/pages/Profile.js)
  - **Expected behavior**: Renders `UPDATES` section containing current version, manual "Check now" button, auto-check toggle, collapsible update mode cards (Notify only, Ask, Auto), and explicit error layouts: Checking Failure (Connection Error amber status pill) and Download Failure (Update Failed red status pill with Retry button).
  - **Constraints**: Subgroup is hidden entirely on Hosted/Demo mode.
  - **Validation/test**: Verification of layout and error states in Local mode.

- [ ] T022 [US3] Hide the Updates subgroup entirely on Hosted/Demo modes and non-Windows platforms
  - **Target**: [src/pages/Profile.js](../../src/pages/Profile.js)
  - **Expected behavior**: Ensure the subgroup is completely omitted from render in Hosted/Demo modes and non-Windows platform local environments to avoid UI clutter.
  - **Constraints**: Must not throw errors when accessing profile page.
  - **Validation/test**: Verify hidden state in demo/hosted mode and on non-Windows platforms.

---

## Phase 06: Polish & Cross-Cutting Concerns

**Purpose**: Verify styling, lint rules, and baseline test suite.

- [ ] T023 Accessibility and responsive review
  - **Target**: [src/components/UpdateToast.js](../../src/components/UpdateToast.js), [src/pages/Profile.js](../../src/pages/Profile.js)
  - **Expected behavior**: Confirm contrast, keyboard navigation tab-stops, form labels, and mobile stacking wrap behavior.

- [ ] T024 Run project lint and format checks
  - **Target**: Workspace root
  - **Expected behavior**: Run `npm run lint` and confirm code styling passes the project gates.

---

## Phase 07: Release Prep (REQUIRED for every feature)

**Purpose**: Set SemVer versions, write changelogs, update roadmaps, and verify documentation files.

- [ ] T025 Bump version in `package.json`
  - **Target**: [package.json](../../package.json)
  - **Expected behavior**: Increment version to `v1.10.0` or matching version bump.
  - **Validation/test**: File check.

- [ ] T026 Sync root fields in `package-lock.json`
  - **Target**: [package-lock.json](../../package-lock.json)
  - **Expected behavior**: Update top-level version field and root package block version.
  - **Validation/test**: File check.

- [ ] T027 Mark feature Roadmap status in `docs/feature_roadmap.md`
  - **Target**: [docs/feature_roadmap.md](../../docs/feature_roadmap.md)
  - **Expected behavior**: Tick the row for feature 041 to shipped (`[x]`).
  - **Validation/test**: File check.

- [ ] T028 Document changes in `CHANGELOG.md`
  - **Target**: [CHANGELOG.md](../../CHANGELOG.md)
  - **Expected behavior**: Add SemVer heading block with merge date, documenting added check endpoints, lockfile logic, and settings.
  - **Validation/test**: File check.

- [ ] T029 Update `README.md` features
  - **Target**: [README.md](../../README.md)
  - **Expected behavior**: Update features list noting self-update capability.
  - **Validation/test**: File check.

- [ ] T030 Update `docs/REPO_MAP.md` entries
  - **Target**: [docs/REPO_MAP.md](../../docs/REPO_MAP.md)
  - **Expected behavior**: Register new update router routes, lock manager files, and components.
  - **Validation/test**: File check.

- [ ] T031 Verify docs clean references
  - **Target**: `docs/` and `src/` directories
  - **Expected behavior**: Grep workspace to verify no outdated version strings remain.

---

## Phase 08: Browser Smoke Test (REQUIRED for UI features)

**Purpose**: Walk the spec's independent tests in a real browser session against the final state.

- [ ] T032 [US1] Discover and Trigger Updates Browser Smoke Walkthrough
  - **Expected behavior**: Mock old version tag `1.9.0` using environment variable `ALICE_VERSION_OVERRIDE=1.9.0` and start server. Observe Available toast display, click Install, verify downloading progress bar, and click Restart. App should exit and relaunch showing version `v1.10.0` in footer, keeping applications database intact.
  - **Validation/test**: Walk independent test.

- [ ] T033 [US2] Single Instance Lock Browser Smoke Walkthrough
  - **Expected behavior**: Attempt to launch the portable package a second time. Verify the browser opens the active instance's tab and exits without starting a second node process.
  - **Validation/test**: Walk independent test.

- [ ] T034 [US3] Settings updates panel Browser Smoke Walkthrough
  - **Expected behavior**: Navigate to Profile > Settings. Verify Updates card layout, including: (1) Connection Error state (amber pill on check failure); (2) Update Failed state (red pill and Retry button on download failure); and (3) Already on Latest state (triggering a manual check displays the green "Up to date" pill and pops up a transient "You're on the latest version" success toast). Disable autocheck, verify settings persistence. Toggle through update modes. Verify that the Updates section is hidden on hosted Vercel deployments.
  - **Validation/test**: Walk independent test.

- [ ] T035 Mobile Viewport layout check
  - **Expected behavior**: Open DevTools, switch to Mobile viewport (390px). Confirm that Toast controls wrap cleanly with full-width primary buttons ordered last.
  - **Validation/test**: Human browser check.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks all user stories.
- **User Stories (Phase 3+)**: Depends on Foundational completion.
- **Polish (Phase 6)**: Depends on Phase 3, 4, 5.
- **Release Prep (Phase 7)**: Depends on Polish.
- **Browser Smoke Test (Phase 8)**: Depends on Release Prep.

### Parallel Opportunities

- **T001** and **T002** can run in parallel.
- Once Phase 2 is complete, **US1**, **US2**, and **US3** phases can be implemented in parallel if staffed separately, as they touch distinct modules.
- Unit tests **T006**, **T010**, and **T013** can run in parallel with sibling tasks.

---

## Parallel Example: User Story 1

```bash
# Developer A implements the backend route queries:
Task: "Implement version check endpoint GET /api/update/check in server/routes/update.js"

# Developer B implements the Toast container frontend layout:
Task: "Create toast component src/components/UpdateToast.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL - setting up lockfile and migration schema registry).
3. Complete Phase 3: User Story 1 (Discovery & Update Staging).
4. **STOP and VALIDATE**: Verify that update detection, downloading, and manual staging checks succeed.

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready.
2. Add US1 -> Check and download ZIP functionality works.
3. Add US2 -> Staging file swap launcher logic and pre-migration backups work.
4. Add US3 -> UI settings options integrated.
