# 041 - Self-Update Support

## Summary

Enable portable Alice installations to detect, download, and install new releases without requiring users to manually replace files, clone repositories, or perform application maintenance.

This feature builds upon the Portable Distribution Package and provides a seamless update experience while preserving local user data, application settings, and historical records.

Users should be able to update Alice with minimal effort while maintaining Alice's local-first philosophy.

The solution should leverage GitHub Releases as the initial release distribution mechanism.

---

## Problem Statement

Following the introduction of portable distribution, users can run Alice without installing development tools.

However, users must still manually:

* Monitor for new releases.
* Download updated packages.
* Replace existing application files.
* Ensure local data is preserved.

This process creates friction and increases the likelihood that users remain on outdated versions.

Alice requires a self-update mechanism that keeps local installations current while preserving user data and configuration.

---

## Goals

### Primary Goals

* Detect newer Alice releases.
* Notify users when updates are available.
* Download updates directly from the release source.
* Install updates with minimal user interaction.
* Preserve user data during updates.
* Preserve application settings during updates.
* Support safe database schema upgrades.
* Maintain compatibility with portable deployments.
* Allow users to configure update behavior.

### Secondary Goals

* Reduce manual maintenance.
* Encourage adoption of new releases.
* Simplify future feature delivery.
* Improve long-term usability of local deployments.

---

## Non-Goals

The following items are explicitly out of scope:

* Fully silent background updates.
* Automatic updates without user consent.
* Multi-channel release management.
* Enterprise deployment tooling.
* Cloud synchronization.
* Rollback functionality.
* Multi-user installation support.
* Mobile deployment support.

---

## User Stories

### Local User

As a user,

I want Alice to notify me when a new version is available,

so that I can stay current without manually checking GitHub.

### Existing User

As a user,

I want my data and settings preserved during updates,

so that I can continue using Alice without reconfiguration.

### Returning User

As a user,

I want updates to be simple and reliable,

so that maintaining Alice requires little effort.

---

## Functional Requirements

### Release Detection

The system shall determine the currently installed application version.

The system shall check for newer releases from the configured release source.

The system shall compare installed and available versions.

The system shall identify when a newer version exists.

---

### Update Notifications

When a newer version is available, the system shall notify the user.

The notification shall provide:

* Current version.
* Available version.
* Summary information about the release.

The user shall be able to initiate the update process.

The user shall be able to defer the update.

---

### Release Notes

The update experience should display release information whenever available.

Release notes may be sourced from GitHub Releases or equivalent future mechanisms.

---

### Update Download

The system shall download the selected release package.

The system shall validate successful completion of the download process.

The system shall prevent incomplete downloads from being installed.

---

### Package Validation

Downloaded update packages shall be validated before installation.

The validation mechanism may include checksums, signatures, or equivalent integrity checks.

Invalid packages shall not be installed.

Users shall receive an appropriate error message when validation fails.

---

### Update Installation

The system shall install validated update packages.

The installation process shall not require manual file replacement.

The installation process shall minimize user involvement.

The application shall restart when required.

---

### Data Preservation

The update process shall preserve:

* SQLite database contents.
* User profile information.
* Application settings.
* User-generated records.

Application updates shall not overwrite user data.

---

### Database Migration Support

The system shall support database schema upgrades.

When required, database migrations shall execute automatically.

Database migrations shall occur as part of the update process.

Users shall not be required to manually upgrade databases.

Completed migrations shall not execute more than once.

---

### Startup Validation

Application startup shall verify compatibility between:

* Installed application version.
* Current database schema.

The system shall execute pending migrations before normal operation when required.

---

### Update Failure Handling

Failed updates shall not leave the application in an unusable state.

The system shall provide meaningful update failure messages.

Users shall be informed when updates cannot be completed successfully.

---

### Update Preferences

The system shall provide user-configurable update behavior.

The system shall persist update preferences across application restarts.

Supported update behaviors may include:

- Notify only.
- Download and install after user confirmation.
- Automatic updates.

The exact implementation and available options may vary.

The default behavior shall prioritize user awareness and user control.

Users shall be able to modify update preferences through the application settings experience.

---

## UX Requirements

### Update Experience

Expected workflow:

```text
Alice Launches
    ↓
Update Available
    ↓
User Selects Update
    ↓
Download Update
    ↓
Install Update
    ↓
Restart Alice
    ↓
Continue Working
```

The process should feel simple and predictable.

---

### User Control

Users shall retain control over when updates are installed.

Updates shall not interrupt active application usage without user consent.

The application shall respect user-configured update preferences.

Automatic updates shall not occur unless explicitly enabled by the user.

---

### Visibility

Users shall be able to view:

* Current version.
* Available version.
* Update status.

Final placement may vary.

---

## Technical Considerations

### Release Source

Initial implementation shall use GitHub Releases.

The architecture should allow future replacement of the release source if required.

---

### Deployment Compatibility

The feature applies only to portable deployments.

Hosted deployments are expected to be updated through normal deployment workflows.

No hosted deployment update experience is required.

---

### Data Safety

Application files and user data should remain logically separated.

This separation should support safe updates without risking user-generated content.

---

### Future Compatibility

The architecture should support future enhancements including:

* Rollback support.
* Background downloads.
* Silent updates.
* Alternative release channels.

These enhancements are not required for this feature.

---

## Acceptance Criteria

### AC-001

Alice can determine whether a newer release exists.

### AC-002

Users receive notification when updates are available.

### AC-003

Users can initiate updates from within Alice.

### AC-004

Alice downloads update packages without requiring manual file replacement.

### AC-005

Downloaded packages are validated before installation.

### AC-006

User data is preserved during updates.

### AC-007

Application settings are preserved during updates.

### AC-008

Required database migrations execute automatically.

### AC-009

Alice restarts successfully after completing an update.

### AC-010

Failed updates do not permanently prevent Alice from launching.

### AC-011

The update experience functions without requiring Git, Node.js, or command-line interaction.

### AC-012

Users can configure update behavior through application settings.

### AC-013

Configured update preferences persist across application restarts.

---

## Success Metrics

* Users can update Alice without downloading replacement packages manually.
* Application updates preserve user data and settings.
* Database upgrades occur automatically when required.
* The majority of local installations remain on supported versions.
* Update-related support requests are minimized.
* Users can move between releases without technical intervention.
