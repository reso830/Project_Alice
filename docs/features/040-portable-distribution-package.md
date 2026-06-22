# 040 - Portable Distribution Package

## Summary

Enable Alice to be distributed and executed as a portable local application without requiring users to install Node.js, clone the repository, or perform any developer-oriented setup steps.

This feature introduces a production-ready portable package that bundles the application runtime and provides a consistent local deployment experience while preserving Alice's existing architecture and future compatibility with hosted deployments.

The resulting package should allow users to:

1. Download a release archive.
2. Extract the archive to any location.
3. Launch Alice using a provided startup script.
4. Persist all application data locally.

No installer, administrative privileges, or registry modifications should be required.

---

## Problem Statement

Alice currently assumes a developer-oriented deployment model where users must clone the repository, install dependencies, and execute the application manually.

While suitable during development, this creates unnecessary friction for local-first users who simply want to run Alice as a personal job tracking tool.

To support broader adoption and future public releases, Alice requires a portable distribution mechanism that:

* Removes the Node.js installation requirement.
* Removes repository cloning requirements.
* Minimizes setup complexity.
* Preserves local-first principles.
* Maintains architectural alignment with hosted deployments.

---

## Goals

### Primary Goals

* Distribute Alice as a portable ZIP package.
* Bundle a compatible Node.js runtime.
* Eliminate the need for Node.js installation.
* Eliminate the need for GitHub repository cloning.
* Provide a one-click startup experience.
* Preserve local SQLite data between application launches.
* Establish a stable distribution structure for future update capabilities.

### Secondary Goals

* Standardize local deployment layout.
* Simplify onboarding for non-technical users.
* Prepare the foundation for future release management and update functionality.

---

## Non-Goals

The following items are explicitly out of scope:

* Self-updating functionality.
* Automatic update downloads.
* Release version checking.
* Rollback mechanisms.
* Installer packages.
* Desktop application conversion (Electron, Tauri, etc.).
* Cloud synchronization.
* Multi-user deployments.
* Cross-machine synchronization.

---

## User Stories

### Local User

As a user,

I want to download Alice and immediately use it,

so that I do not need development tools or setup knowledge.

### Returning User

As a user,

I want my application data to remain available after restarting Alice,

so that my tracking history is preserved.

### Future Maintainer

As a maintainer,

I want a standardized package structure,

so that future update and release features can build on a stable foundation.

---

## Functional Requirements

### Distribution Package

The system shall produce a portable release artifact.

The release artifact shall be distributed as a ZIP archive.

The release artifact shall contain all required application components.

The release artifact shall not require additional dependency installation.

---

### Bundled Runtime

The package shall include a compatible Node.js runtime.

The bundled runtime shall be used when launching Alice.

The user shall not be required to install Node.js separately.

The application shall not depend on globally installed Node.js versions.

---

### Startup Experience

The package shall provide a startup mechanism suitable for the target operating system.

The startup mechanism shall launch the backend server and frontend experience.

The startup mechanism shall require a single user action.

The startup mechanism shall not require command-line interaction.

---

### Local Data Persistence

Application data shall remain outside application source files whenever practical.

The SQLite database shall persist between application launches.

Configuration data shall persist between application launches.

Application updates shall not be assumed to replace local user data.

---

### Standardized Directory Structure

The package shall implement a standardized deployment layout.

Example structure:

```text
alice/
├── app/
├── runtime/
├── data/
├── config/
├── logs/
└── launch script
```

Final naming and implementation details may vary.

The structure shall support future update-related features.

---

### Build and Release Process

The project shall provide a repeatable mechanism for generating portable release artifacts.

The generated artifact shall be suitable for publication through GitHub Releases.

The generated artifact shall be reproducible from source control.

---

## UX Requirements

### Installation Experience

User workflow:

```text
Download ZIP
    ↓
Extract ZIP
    ↓
Launch Alice
    ↓
Use Application
```

No additional setup steps should be required.

---

### Error Handling

If required application files are missing, the system shall display a clear startup error.

If the bundled runtime cannot be launched, the system shall provide a meaningful error message.

Startup failures shall not silently terminate the application.

---

## Technical Considerations

### Architecture Alignment

The portable deployment model must preserve compatibility with Alice's existing architecture.

The same application codebase should remain deployable through:

* Local portable deployment.
* Hosted deployment.

No separate desktop application codebase should be introduced.

---

### Runtime Isolation

The packaged runtime should be isolated from system-installed Node.js versions.

The application should behave consistently across supported environments.

---

### Future Compatibility

The resulting package structure should support future features including:

* Release version management.
* Update notifications.
* Self-update capabilities.
* Rollback and recovery mechanisms.

No future update functionality is required as part of this feature.

---

## Acceptance Criteria

### AC-001

A user can download a release archive and launch Alice without installing Node.js.

### AC-002

A user can run Alice without cloning the GitHub repository.

### AC-003

A user can launch Alice using a provided startup mechanism without opening a terminal.

### AC-004

Alice persists application data across restarts.

### AC-005

The release package includes all required runtime dependencies.

### AC-006

The project provides a repeatable process for generating portable release artifacts.

### AC-007

The generated artifact is suitable for distribution through GitHub Releases.

### AC-008

The portable deployment remains compatible with Alice's hosted deployment strategy.

---

## Success Metrics

* Users can launch Alice without installing development tools.
* Time from download to first launch is reduced to less than five minutes.
* No manual dependency installation is required.
* Portable releases can be generated consistently through the project release workflow.
* Local data remains intact across application restarts.
