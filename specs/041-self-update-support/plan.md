# Implementation Plan: Self-Update Support

**Branch**: `041-self-update-support` | **Date**: 2026-06-26 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/041-self-update-support/spec.md`

---

## Summary

This feature implements a self-update mechanism for portable Project Alice installations on Windows. The application will query the GitHub Releases API for newer releases, download and verify the zip archive, and extract files to a staging directory. When the user confirms the update, the Express backend halts, allowing the CMD launcher (`Start-Alice.cmd`) to copy the new binaries (releasing Windows file locks on Node and native SQLite modules), delete the staging folder, and restart. 

Additionally, this feature replaces the simple port-only health probe from 040 with a robust PID-and-port-based lockfile (`data/alice.lock`) to prevent concurrent instances and database corruption. It also introduces a greenfield database migration subsystem for SQLite using a `schema_migrations` ledger table and version compatibility verification.

---

## Technical Context

- **Language/Version**: Node.js v24.14.1 (bundled in portable runtime).
- **Primary Dependencies**: Native Node modules (`fs`, `path`, `crypto`, `https`, `child_process`) and `better-sqlite3`. No new libraries are introduced.
- **Storage**: 
  - **Local (SQLite)**: Active database migrations run automatically on startup. The database file `data/alice.db` is backed up to `data/alice.db.migration-backup` before running migrations, and restored if a migration fails. We will implement a greenfield migration registry and ledger table (`schema_migrations`) in SQLite. Update configuration settings (`autoCheckUpdates`, `updateMode`) are stored in `config/settings.json`.
  - **Hosted (Supabase)**: Out of scope. Deployed via regular Vercel pipeline; updater and settings are hidden on hosted deployments. Supabase schema migrations are managed independently and are out of scope.
  - **Demo Mode**: Settings subgroup is hidden. No updates checks are performed.
- **Testing**: Jest (unit tests) and Playwright/Puppeteer (browser smoke tests).
- **Target Platform**: Windows x64 (portable distribution environment).
- **Project Type**: Desktop-local web service / portable bundle.
- **Performance Goals**: Update checks must complete in <1.5s (excluding GitHub network latency). Startup instance checks must verify PID in <50ms.
- **Constraints**: Local-first compliance (no user tracking or diagnostic metrics sent in GitHub API requests). Windows file locks must be released before swapping.

---

## Constitution Check

- **Data Fields**: Not adding new application business models. Configuration schemas are restricted to update behaviors.
- **Architecture**: Separates staging extraction from file replacement. The launcher performs file movements to bypass locks, keeping Express application logic simple and maintainable.
- **Centralized Validation**: Uses existing schema-based validation for `config/settings.json`.
- **Testing**: Unit tests will cover version string comparison (`v1.7.0` < `v1.8.0`), checksum verification, lockfile validation, and stale lock cleanups.
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
- `server/portable.js` (implement lockfile checks, PID kill checks, and health version injection)
- `server/portable/settings.js` (add defaults and parsing for `autoCheckUpdates` and `updateMode`)
- `server/index.js` (mount update route handlers)
- `server/routes/update.js` (new endpoints for check, download status, restart command, settings)
- `server/db.js` (integrate migration initialization, ledger checks, and pre-migration backup triggers)
- `server/db/migrations/` (new directory for SQLite schema version scripts)
- `src/components/Footer.js` (hosted: show latest release download button; local: show link back to hosted)
- `src/components/Navbar.js` (render persistent update notification badge on Profile nav button)
- `src/components/BottomTabBar.js` (render persistent update notification badge on Profile tab button)
- `src/pages/profile/ProfilePage.js` (hide Updates subgroup on Hosted/Demo mode, show on Local mode; handle Connection Error and Update Failed states)
- `src/components/UpdateToast.js` (new toast notification covering Available, Downloading, Installing, and Error/Failed states)

### Tests to Add/Update
- `tests/unit/update.test.js` (unit tests covering lockfile write/delete, version comparison, and staging path recovery)
- `tests/unit/migration.test.js` (unit tests covering migration ledger tracking, transaction rollbacks, and downgrade safety)
- `tests/browser/update-flow.smoke.js` (browser smoke tests for toast container, settings card, and error visual states)

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
├── routes/
│   └── update.js         # New update routes
├── db/
│   ├── migrations/       # Greenfield migration folder
│   │   └── [migration-scripts].js
│   └── db.js             # Modified to integrate migrations and registry
└── portable/
    └── settings.js       # Modified to support update settings

src/
├── components/
│   └── UpdateToast.js    # New update toast component
└── pages/
    └── profile/
        └── SettingsCard.js # Modified to include updates settings
```

**Structure Decision**: Modified Express backend and added React UI components under `src/components/` and `src/pages/profile/`. Follows the single codebase layout of Project Alice.

---

## Complexity Tracking

*No constitutional violations identified. Plan complies fully with v1.5.0 principles.*
