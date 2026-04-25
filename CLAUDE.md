# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project State

This project uses the **Specify framework** for specification-driven development. Application code does not exist yet — the workflow runs from specification → planning → tasks → implementation.

## Specify Workflow

Skills are defined in `.agents/skills/` and mirrored to `.claude/skills/`. Run them in order:

| Skill | Purpose |
|---|---|
| `/speckit.specify` | Create or update a feature spec from natural language |
| `/speckit.clarify` | Resolve ambiguities in a spec |
| `/speckit.plan` | Generate `plan.md` — tech stack, architecture, file structure |
| `/speckit.tasks` | Generate `tasks.md` — phased implementation tasks |
| `/speckit.implement` | Execute tasks phase-by-phase (reads `tasks.md`) |
| `/speckit.checklist` | Validate quality gates before accepting a phase |
| `/speckit.constitution` | Check compliance with the project constitution |
| `/speckit.analyze` | Analyze design quality of a spec or plan |
| `/speckit.taskstoissues` | Convert tasks to GitHub issues |

Feature branches follow sequential numbering: `###-feature-name` (e.g. `001-core-tracker`), configured in `.specify/init-options.json`.

## Project Constitution (v1.0.0)

Ratified 2026-04-25. Full text in `.specify/memory/constitution.md`. Summary of governing rules:

**Required data fields**: company name, job title, status, created date.  
**Optional fields**: source, URL, application date, salary, notes, follow-up action/date.

**Architecture constraints**:
- Simple, readable code over clever abstractions
- Separate business logic from UI
- Centralized, reusable validation rules
- New dependencies require justification
- Local-first; no external analytics or tracking

**Validation rules**:
- Required fields validated before save
- URLs validated; consistent date format enforced
- No silent data corruption or overwrites

**UX requirements**:
- Operations: add, edit, search, filter, review
- Surface status, company, role, and date as primary
- Identify stale applications and pending follow-ups
- Handle empty, loading, and error states explicitly
- Desktop and mobile browsers required
- Labeled forms, keyboard navigation, non-color-only status indicators

**Testing requirements**:
- Core validation logic must have automated tests
- Cover: status transitions, required field enforcement, URL validation, date handling

**Review gates** (must pass before accepting a plan or completing a phase):
- Constitution compliance check
- Tasks include validation, state handling, and quality-gate work
- Lint/format checks pass
- Any skipped check documented with reason and residual risk

## Git & Worktrees

Remote: `https://github.com/reso830/Project_Alice.git` (main branch: `main`)  
Active worktrees live under `.claude/worktrees/`. PowerShell setup scripts are in `.specify/scripts/powershell/`.
