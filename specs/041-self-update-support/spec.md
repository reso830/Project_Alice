# Feature Specification: Self-Update Support

**Feature Branch**: `041-self-update-support`  
**Created**: 2026-06-26  
**Status**: Draft  
**Input**: docs/features/2.0.0-smart-intake-ai-assistance/041-self-update-support.md

---

## Clarifications

### Session 2026-06-26

- Q: Where should the 'What's new' link display release notes? → A: **External GitHub link**. Clicking "What's new" opens the official GitHub Releases page for that version in a new browser tab (`target="_blank" rel="noopener noreferrer"`).
- Q: Should an available update surface a badge on the Profile nav item / topbar, independent of the toast being dismissed? → A: **Yes**. When an update is available (status is `available`, `downloading`, or `ready-to-restart`), a subtle notification badge (colored dot) is rendered on the Profile button in both the desktop Topbar Navbar and the mobile Bottom Tab Bar. This badge remains visible as a persistent reminder until the update is applied and the application restarts.
- Q: Should the Updates settings sub-group be visible in Hosted/Demo modes? → A: **Hide entirely**. The Updates sub-group in Profile > Settings is hidden entirely in Hosted and Demo modes, leaving only the "Download" footer button to acquire the portable package.
- Q: What is the behavior of 'Install automatically' mode? → A: **Background stage only**. The updater downloads and extracts update packages in the background silently, then displays a non-disruptive "Restart to finish" prompt. The application never restarts automatically.
- Q: What changed in #85 after implementation review? → A: **'Install automatically' was removed**. The persisted `updateMode` enum is now `notify | ask`; legacy `auto` settings normalize to `ask` on read and are rejected on write because automatic updates without user consent are outside the feature non-goals.
- Q: What is the frequency of the automatic update checks when "Check for updates automatically" is enabled? → A: **On application startup, and then once every 24 hours of continuous execution**.
- Q: Should the application create a temporary backup copy of the database before applying schema migrations? → A: **Yes, always copy the database to a backup file before starting migrations, delete it on success, and restore it if migrations fail**.
- Q: How can the end-to-end update process be tested before a release is published on GitHub? → A: **Using the `ALICE_UPDATE_SOURCE_OVERRIDE` env var**. Setting this environment variable instructs the backend to query a local or mock URL for release metadata. A static test release ZIP and its SHA256 checksum are placed under `tests/fixtures/update-v1.10.0.zip` and `tests/fixtures/update-v1.10.0.zip.sha256` to allow local staging, extraction, and launcher-swapping walkthroughs in smoke tests without making external network calls.
- Q: Is the self-update mechanism supported on macOS/Linux local installs? → A: **No, Windows-portable-only**. The backend updates API endpoints and the frontend updates UI settings/notifications are only active on Windows (`process.platform === 'win32'`) local/portable mode. The backend `/api/health` endpoint exposes an `updateSupported` capability boolean flag (true only in local mode on Windows). The frontend inspects this flag to hide or disable all updates features (toasts, badges, settings card sub-group) on unsupported configurations.

---

## Problem Statement

Following the introduction of portable distributions (040), Project Alice can run locally without dev tools. However, users must still manually monitor GitHub for updates, download ZIP archives, copy files, and ensure local data is not overwritten or corrupted. 

To improve usability and maintain security, Alice needs a self-update mechanism. The solution must detect, download, and apply updates directly from GitHub Releases in a local-first manner, while strictly preserving local SQLite databases and settings. Additionally, on Windows, active binaries (Node runtime and the native SQLite driver) are file-locked while running. The update flow must cleanly stop the active process, swap code files, and restart the application without data loss, database corruption, or double-instance collisions.

---

## Scope

### In Scope

- **Release Detection**: Periodically query GitHub Releases (via client/server API) to compare the local version (from package.json) against the latest release.
- **Durable Settings Control Panel**: A dedicated Profile > Settings > Updates sub-group containing version information, update toggles, auto-check options, and manual checks.
- **Toast / Card Notifications**: Mode-aware bottom-right toasts (desktop/tablet) or bottom cards (mobile) informing the user of available updates and staging progress.
- **Background Downloading & Staging**: Safe downloading of release ZIPs, validation of package integrity (via SHA256 checksums), and staging extraction into a separate directory (`data/update-staging/`).
- **Swap-on-Restart Launcher Sequence**: Safe replacement of program directories (`app/`, `runtime/`) and root launcher scripts, triggered when the main process exits.
- **Robust Single-Instance Lockfile**: A pid-and-port-aware lockfile (`data/alice.lock`) to prevent concurrent executions and ensure the old server releases database and file locks before update swapping occurs.
- **Auto-Migration of Database**: Automatic execution of pending SQLite migrations upon new version startup.
- **Update Preferences**: User settings specifying whether to "Notify only" or "Ask before installing" (default). Amended by #85: "Install automatically" was removed because automatic updates without consent are outside the feature non-goals.

### Runtime Mode Matrix

To ensure consistency across the user brief and design specifications, the availability of update-related surfaces is strictly governed by the application's runtime mode (Local, Hosted, or Demo) as defined in the matrix below:

| UI Surface / Component | Local Mode | Hosted Mode | Demo Mode |
|---|---|---|---|
| **Footer Download Control** | Renders as `Open hosted version ↗` link. Functional (opens hosted URL). | Renders as `[↓ Download vX.Y.Z]` button. Functional (points to latest GitHub Release). | Renders as `[↓ Download vX.Y.Z]` button. Functional (points to latest GitHub Release). |
| **Update Notification Toast** | Renders when updates are available, downloading, or ready. Functional. | Does NOT render (hidden). | Does NOT render (hidden). |
| **Settings: Updates Sub-group** | Renders (middle sub-group in Settings). | Does NOT render (hidden). | Does NOT render (hidden). |
| **Settings: Status Block** | Renders version info and check/install progress. Functional. | Does NOT render (hidden). | Does NOT render (hidden). |
| **Settings: Auto-check Toggle** | Renders within Updates sub-group. Functional. | Does NOT render (hidden). | Does NOT render (hidden). |
| **Settings: Update-mode Picker** | Renders within Updates sub-group. Functional. | Does NOT render (hidden). | Does NOT render (hidden). |

### Restart and Install Action Semantics

The "Install now" and "Restart to finish" actions have distinct, concrete semantics depending on the application runtime mode:

- **Local (Portable) Mode**:
  1. **Install now**: Downloads the update archive, verifies its SHA256 checksum, extracts it into `data/update-staging/`, and transitions the UI state to "ready-to-restart".
  2. **Restart to finish**: Triggers a request to `/api/update/restart` which writes `data/update-pending.json` and delegates server shutdown to a registered callback. The Express application creation factory (`createApp`) in `server/index.js` accepts an optional `onShutdown` callback. The update router invokes this callback after writing `data/update-pending.json` and returning a `200 OK` response. In `server/portable.js`, this callback closes the active HTTP listener (`server.close()`), closes the active SQLite database connection (`db.close()`), and exits the Node process (`process.exit(0)`). The launcher script (`Start-Alice.cmd`) detects the staged files, copies them to replace `app/` and `runtime/` directories, deletes the staging folder, and boots the new version. The frontend client polls the server, detects when it is back online, and automatically executes a full page reload (`window.location.reload(true)`) to fetch the new static assets.
- **Hosted and Demo Modes**:
  - The in-app self-update installer actions ("Install now", "Restart to finish") are **disabled/hidden** and do not execute. Deployed hosted versions are updated exclusively via standard git-push/Vercel hosting pipelines. If the client browser session detects new deployed assets (e.g. index hash changes), it may display a standard reload prompt ("A new version of Alice is available. Reload to update ↗") which simply triggers `window.location.reload()`, bypassing any process restart.

### Non-Goals

- **Cloud/Remote Synchronization**: No sharing of database files across external sync servers.
- **Rollback Functionality**: Support for automatically reverting to a previous version is out of scope for v1.
- **Silent Foreground Restarts**: Updates will never force-restart the application mid-use without confirmation.
- **Multi-channel / Beta Release Tracks**: Updates will target only the standard release channel.
- **Automatic updates in Hosted/Demo modes**: Deployed Vercel versions are updated via regular hosting pipelines.
- **Non-Windows Portable Support**: The self-update mechanism is designed exclusively for Windows portable distributions (matching `040` packaging scope). Updating manual checkouts or other installations on macOS/Linux is out of scope.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover and Trigger Updates (Priority: P1)

As a local user, I want Alice to notify me when a new update is available and let me install it in one click, so that I can easily keep my application updated without terminal commands.

**Why this priority**: Core value proposition. Keeps the user cohort up-to-date with bug fixes and new features with minimal friction.

**Independent Test**:
1. Run Alice locally with an overridden version (e.g. by setting `ALICE_VERSION_OVERRIDE=v1.9.0` in the environment).
2. Verify that an "update available" toast appears showing `v1.10.0` is ready.
3. Click **Install now**. Verify that the progress bar updates from downloading (`determinate`) to installing (`indeterminate`).
4. Click **Restart to finish**. Verify the app exits, the console helper applies the update, and a new browser tab opens automatically showing version `v1.10.0` in the footer.
5. Verify that previously entered job application records are still intact.

**Acceptance Scenarios**:
- **Given** an old application version is running locally, **When** a new release is detected on GitHub, **Then** an available update toast is shown displaying the current version, the target version, and a link to the changelog.
- **Given** the user clicks "Install now", **When** the zip is downloading, **Then** a determinate progress bar and estimated time remaining are shown on the toast and in Settings.
- **Given** the download completes successfully and passes checksum verification, **When** the files are staged, **Then** the primary action changes to "Restart to finish".
- **Given** the user triggers the restart, **When** the application restarts, **Then** the server swaps the old `app/` and `runtime/` directories, deletes the staging folder, and boots the new version.

---

### User Story 2 - Lock-Aware Single Instance & Safe Exit (Priority: P1)

As an existing user, I want the update process to prevent database conflicts and ensure file locks are released, so that my database never suffers corruption during version upgrades.

**Why this priority**: Required for data safety. Without proper lock coordination, Windows file locks prevent files from being overwritten, causing partial/broken updates.

**Independent Test**:
1. Start the Alice local server.
2. Attempt to run `Start-Alice.cmd` a second time. Verify that the second instance detects the lockfile, opens the existing running port in the browser, and terminates itself without starting a new server.
3. Trigger an update in the running instance. Verify that the launcher successfully waits for the first process to exit completely, performs the file swap, and then boots the new version.

**Acceptance Scenarios**:
- **Given** an Alice instance is running, **When** a second launcher execution occurs, **Then** the launcher reads `data/alice.lock`, verifies the active process ID is alive, opens the browser to that port, and exits.
- **Given** a stale lockfile exists (e.g., from an abrupt power loss/kill), **When** Alice is started, **Then** the startup routine verifies the PID is dead, removes the stale lockfile, and proceeds to start normally.
- **Given** the update restart sequence is initiated, **When** the Express server shuts down, **Then** the native database connection is explicitly closed and the process ID is released before the file swap begins.

---

### User Story 3 - Configure Update Preferences (Priority: P2)

As a user, I want to control how and when updates are checked and applied, so that background downloads do not consume my bandwidth or interrupt my workflow.

**Why this priority**: User control and transparency. Respects the local-first, low-maintenance philosophy of the application.

**Independent Test**:
1. Navigate to Profile > Settings > Updates.
2. Turn off "Check for updates automatically". Verify that no background update checks occur.
3. Select "Notify only" update mode. Verify that when a new version is detected, the app displays the persistent Profile nav badge but suppresses the passive update-available toast; no archive downloads until explicitly requested.
4. Select "Ask before installing" update mode. Mock a new release and verify that the app displays the update-available toast with an explicit install prompt.

**Acceptance Scenarios**:
- **Given** update preferences are changed in Settings, **When** the application is restarted, **Then** the update preferences persist and are respected.
- **Given** "Check for updates automatically" is disabled, **When** the user clicks "Check now" manually, **Then** the system checks for updates and updates the status block immediately.

---

### Edge Cases

- **Windows binary lock**: The launcher handles the file-swap execution *outside* of the main running Node process to ensure no DLLs or EXEs are locked.
- **Stale lockfile**: If the system crashed, the lockfile remains. The system must verify the PID is active before assuming another instance is running.
- **Download/integrity failure**: If the zip file is corrupted or the checksum validation fails, the staging directory is cleared, the update is aborted, and a user-friendly error is displayed. The app must remain fully usable.
- **Network loss during download**: If connectivity is lost during staging, the system pauses/fails gracefully without breaking the current installation.
- **Incompatible DB schemas**: If a database migration fails during version startup, the system restores the pre-migration database backup, logs the failure, and halts startup with a clear error message to prevent data loss or corruption.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST check the GitHub Releases API for newer releases comparing against the local version. When automatic checks are enabled, this MUST occur on application startup and then once every 24 hours of continuous execution.
- **FR-002**: The system MUST show an update toast notification when a newer release is detected, displaying current and target versions.
- **FR-003**: The system MUST support two update behaviors: "Notify only" and "Ask before installing" (default). Amended by #85: "Install automatically" was removed because automatic updates without user consent are outside the feature non-goals.
- **FR-004**: The system MUST persist update configuration preferences inside the server-side configuration file (`config/settings.json`). This ensures preferences are retained across port modifications and origin changes, surviving program-file replacements since the `config/` directory is logically separated from `app/` and `runtime/` directories.
- **FR-005**: The system MUST support manual update checks via a "Check now" button in the Settings interface.
- **FR-006**: The system MUST download update packages to a temporary staging folder (`data/update-staging/`) and verify their SHA256 integrity.
- **FR-007**: The system MUST prevent installation of any package that fails integrity verification.
- **FR-008**: The system MUST implement a robust lock file (`data/alice.lock`) containing PID, active port, and app version.
- **FR-009**: The launcher script MUST inspect the lock file on startup to determine if a live instance is already running.
- **FR-010**: The update swapping mechanism MUST execute only after the active server process has fully exited and released all locks on Windows binaries.
- **FR-011**: The system MUST preserve the SQLite database (`data/alice.db`) and settings (`config/settings.json`) untouched during file replacement.
- **FR-012**: The system MUST execute database migrations automatically during the startup phase of the newly installed version. The system MUST copy the database to a temporary backup (e.g., `data/alice.db.migration-backup`) before running migrations; it MUST delete the backup on migration success, and restore the backup if migration fails to prevent corruption.
- **FR-013**: The system MUST gracefully roll back staging files and report failure if the download or extraction fails, leaving the existing app running.
- **FR-014**: The system MUST hide or disable update check triggers and preferences when running in Hosted or Demo modes.
- **FR-015**: The system MUST render mode-aware update control links in the global footer brand row: it MUST render as a platform-agnostic "Download vX.Y.Z" button pointing to the latest GitHub Releases page in Hosted and Demo modes, and as an "Open hosted version ↗" link leading to the hosted application URL in Local mode.
- **FR-016**: The system MUST render a subtle notification badge (colored dot) on the "Profile" navigation button (in both desktop `Navbar` and mobile `BottomTabBar`) when an update is available, downloading, or ready-to-restart, providing a persistent update reminder even if the user has dismissed the toast notification.
- **FR-017**: The version comparison engine MUST normalize and compare version strings robustly. It MUST handle both prefixed versions (e.g., `v1.10.0`) and raw SemVer strings (e.g., `1.10.0`) by stripping any leading `v` character prior to parsing. The comparison logic MUST strictly compare major, minor, and patch numeric values (following Semantic Versioning rules) to verify if the fetched release version is strictly newer than the currently running version.
- **FR-018**: The self-update API endpoints (`/api/update/*`) and updates configuration settings/toasts MUST be restricted to the Windows platform. The system `/api/health` endpoint MUST return an `updateSupported` boolean flag indicating whether self-updates are supported (which MUST evaluate to `true` only if `runtime === 'local'` and `process.platform === 'win32'`). The frontend MUST inspect this `updateSupported` capability flag from the health response to dynamically hide/disable all update notifications, badges, and settings UI on unsupported local and non-local environments.
- **FR-019**: The server shutdown sequence MUST follow a loose coupling model via a registered `onShutdown` callback contract in the application factory (`createApp`). The update router MUST invoke this callback after responding to `/api/update/restart` to close the active HTTP listener and SQLite database before exiting the process.
- **FR-020**: The system MUST support a testable local update source override for development and testing. If the `ALICE_UPDATE_SOURCE_OVERRIDE` environment variable is set, the update check engine MUST query the specified custom URL instead of the live GitHub Releases API. Additionally, a static test fixture (`tests/fixtures/update-v1.10.0.zip` and its `.sha256` checksum) MUST be defined in the repository, enabling end-to-end local updates, staging, and file-swap verification without requiring active GitHub API connections or actual published releases.

---

## Key Entities *(include if feature involves data)*

- **Update Preference**: A persisted configuration object stored in the server-side `config/settings.json` file to survive port and origin changes, containing:
  - `autoCheckUpdates` (Boolean)
  - `updateMode` (String: `notify` | `ask`; amended by #85: legacy `auto` normalizes to `ask`)
- **Instance Lock**: A temporary file (`data/alice.lock`) containing:
  - `version` (Integer schema version)
  - `appVersion` (String application version)
  - `pid` (Integer process ID)
  - `port` (Integer bound port)
  - `launchTime` (String ISO timestamp)

---

## UI Failure & Error States

To satisfy the update failure handling requirements, both the transient update toast and the durable Settings panel MUST support explicit visual states for network failures, rate limiting, and verification check errors.

### 1. Update Toast Notification Error State
- **Trigger**: Fired if an active download, checksum verification, or staging extraction fails.
- **Icon**: Warning triangle glyph (amber/red).
- **Title**: "Update failed".
- **Sub-line**: `vX.Y.Z` version chip · Error description (e.g. "Network timeout" or "Checksum verification failed").
- **Body**: "The current installation remains fully functional. You can retry the update from Settings."
- **Actions**: **Manage in Settings** (primary link), *Dismiss* (ghost button), and `✕` close button.

### 2. Settings Updates Sub-group Error States
The Settings Updates panel status block (above the horizontal divider) supports two distinct failure states:

#### A. Checking Failure (Network Offline / Rate Limiting)
- **Trigger**: Occurs if a background or manual check (`Check now`) fails to fetch release info.
- **Title**: "Check failed".
- **Sub-line**: Description of failure (e.g. "Network offline" or "GitHub API rate limit exceeded").
- **Status Pill**: **● Connection Error** (amber, replacing the green "Up to date" pill).
- **Action Button**: **Check now** (outline button, allowing immediate retry).

#### B. Installation / Verification Failure
- **Trigger**: Occurs if a download or checksum validation fails mid-flow.
- **Title**: "Update failed".
- **Sub-line**: "Verification failed: integrity check mismatch." (or other specific staging error).
- **Status Pill**: **● Update Failed** (red).
- **Action Button**: **Retry Download** (primary button, resetting the download state).

### 3. Check-now Edge States & Outcomes

When a manual update check ("Check now") or automatic check executes, the system MUST handle the following edge scenarios:

| Scenario | Local API / Route Response | Settings Panel UI State | Toast Notification Behavior |
|---|---|---|---|
| **Already on Latest (Up to date)** | Returns version match (`updateAvailable: false`). | Transitions to/retains **Up to date** status block with green **● Up to date** pill. | **Manual Check**: Displays a transient success toast "You're on the latest version." (Green checkmark, auto-dismisses). <br>**Automatic Check**: No toast is displayed. |
| **Offline / Connection Timeout** | Network query fails or times out (1.5s timeout). | Transitions to **Check failed** state showing amber **● Connection Error** pill and "Network offline / timeout" message. | **Manual Check**: Displays a transient warning toast "Check failed: connection timeout." <br>**Automatic Check**: Silently logs error; no toast is displayed. |
| **GitHub Rate-Limited** | Returns 403 / 429 status from GitHub. | Transitions to **Check failed** state showing amber **● Connection Error** pill and "Rate limit exceeded. Try again later." message. | **Manual Check**: Displays transient warning toast "Check failed: API rate limit exceeded." <br>**Automatic Check**: Silently logs error; no toast is displayed. |

---

## Database Migration Subsystem (SQLite Only)

This feature introduces a greenfield database migration subsystem for the local/portable (SQLite) environment. Hosted (Supabase) deployments manage their database schema independently via Supabase migration pipelines and are out of scope for this subsystem.

### Migration Ledger & Versioning
- The system MUST track schema versioning using a dedicated ledger table inside SQLite:
  ```sql
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
  ```
- Migration files are stored inside `server/db/migrations/` as numbered scripts (e.g., `001-init.js`, `002-add-update-preferences.js`).
- Migrations MUST follow a run-once guarantee: the system reads `schema_migrations` on startup, compares it against the local migrations directory, and runs only the unapplied migrations in sequential order.
- **Baseline Adoption Rule for Pre-041 Databases**: If a database contains pre-existing tables (specifically, the `applications` or `profile` table) but does NOT yet contain the `schema_migrations` ledger table, the migration system MUST:
  1. Create the `schema_migrations` table.
  2. Write a baseline entry for the initial schema version `001-init` (or equivalent legacy migration version) into the ledger table, marking it as applied without executing the migration script itself.
  3. This ensures that the migration script for initial layout setup is skipped on existing databases, preventing collision errors and enabling correct run-once tracking.

### Version Compatibility & Downgrade Safety
- On startup, the system MUST inspect the database to verify compatibility between the running application version and the database schema version.
- **Downgrade Gate**: If the database contains migrations that are *newer* than the current application version (e.g. if a user downgrades their installation), startup MUST halt with a clear error preventing running an older codebase against a newer database schema.
- **Pending Migrations**: If there are pending migrations, they MUST be executed under a transaction. The transaction is committed and the ledger is updated only if the migration succeeds.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A local user can complete a full update download and install sequence with exactly one click (plus one click to restart).
- **SC-002**: 100% of successful updates preserve all user profiles, settings, and job application database entries.
- **SC-003**: If an update fails due to network loss or checksum mismatch, the existing application remains 100% functional on the next launch.
- **SC-004**: Running the launcher while another instance is alive opens the existing app in the browser within 2 seconds instead of creating an overlapping instance.
- **SC-005**: The global footer brand row dynamically renders the correct, functional download button or hosted link depending on the resolved runtime mode.

---

## Assumptions

- **A-001**: The user has internet access to query GitHub Releases and download updates.
- **A-002**: The portable directory is writable by the running process without administrative privileges.
- **A-003**: The update packages hosted on GitHub Releases have a matching directory layout and contain a valid version manifest.
