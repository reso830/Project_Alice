# Plan Review Checklist: Self-Update Support

**Purpose**: Verify implementation plan soundness, architecture correctness, and alignment with the constitution before code is written.
**Created**: 2026-06-26
**Plan Reference**: [plan.md](../plan.md)

## Spec & Plan Scope Alignment

- [x] All 18 functional requirements (FR-001 through FR-018) are mapped to architecture components.
- [x] All 3 P1/P2 user stories have clear validation flows.
- [x] Explicit non-goals (e.g. silent foreground restarts, auto-rollback in v1) are respected.

## Architecture Soundness & File Locks

- [x] Staging folder layout cleanly separates incoming code from the user's running process.
- [x] The file-swap process runs in the batch file interpreter outside of the Node runtime, avoiding Windows DLL/EXE file lock errors.
- [x] Stale lockfile recovery logic uses PID validation plus health probes to prevent startup false-positives.
- [x] The update coordination mechanism is stable and forward-compatible.

## Data Safety & Model Risks

- [x] A pre-migration backup copy of `alice.db` is created before starting schema migrations.
- [x] Automatic database restoration to pre-migration state is specified upon schema update failure.
- [x] Local update configuration is stored in `config/settings.json`, ensuring settings survive code-swapping.
- [x] Absolute path resolving is relative to package root (`ROOT=%~dp0`), avoiding hardcoded paths.

## Constitution Compliance

- [x] Local-first privacy is respected (GitHub query sends no PII or tracking telemetry).
- [x] No new external libraries or packages are added without justification (system relies on node-native `crypto`, `https`, `fs`, `child_process`).
- [x] Single-instance lockfile uses local files only.
- [x] Updates subgroup settings are hidden in Hosted/Demo modes to avoid UI pollution.
