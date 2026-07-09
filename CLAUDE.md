# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project State

This project uses the **Specify framework** for specification-driven development. The application is implemented: Vite + Vanilla JS frontend and an Express backend.

**Dual-mode persistence** (since features 018–022): the data layer is selected at runtime by `createRepositories(config)` based on `config.isHosted`:
- **Local mode** — SQLite via `better-sqlite3`, file-based, local-first (honors the constitution's local-first principle; runnable from a GitHub checkout).
- **Hosted mode** — Supabase (Postgres) via `@supabase/supabase-js`. A boot-time schema check (`assertHostedSchema`) early-returns in local + demo modes.
- **Demo mode** — portfolio/demo runtime (feature 020).

**Deployment**: hosted on **Vercel**. The Vite build outputs to `dist` (static frontend); the entire Express app is wrapped as a single serverless function in `api/index.js`, with `vercel.json` rewriting `/api/:path*` → `/api/index`.

New features follow the Speckit workflow: specification → planning → tasks → implementation.

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

## Project Constitution (v1.7.0)

Ratified 2026-04-25, last amended 2026-07-09. Full text in `.specify/memory/constitution.md`. Summary of governing rules:

**Required data fields**: company name, job title, status, last_status_update / lastStatusUpdate, responsibilities (Amendment 1.2.0).  
**Optional fields**: source, URL, application date, salary, notes, follow-up action/date.

**Architecture constraints**:
- Simple, readable code over clever abstractions
- Separate business logic from UI
- Centralized, reusable validation rules
- New dependencies require justification
- Local-first; no external analytics or tracking by default. Two scoped exceptions: Vercel Speed Insights (Amendment 1.5.0) reports anonymized Core Web Vitals, and Vercel Web Analytics (Amendment 1.7.0) reports anonymized visitor/traffic stats — both from the hosted deployment only (prod-only, no app data/PII; local mode reports nothing).

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

**Mandatory final phases for every feature** (Amendments 1.1.0 + 1.3.0):
1. **Release Prep** (second-to-last phase) — version bump, CHANGELOG entry, README updates, `docs/deployment.md` when env vars/runtime modes change, `docs/REPO_MAP.md` for new files, docs sanity check
2. **Browser Smoke Test** (final phase, UI features only) — walk each user story's Independent Test in a real browser against the to-be-merged state; ordered AFTER Release Prep so the smoke test exercises the actual merge state

**Review gates** (must pass before accepting a plan or completing a phase):
- Constitution compliance check
- Tasks include validation, state handling, and quality-gate work
- Tasks include Release Prep + Browser Smoke Test as the final two phases (in that order)
- Lint/format checks pass
- Any skipped check documented with reason and residual risk

## Git & Worktrees

Remote: `https://github.com/reso830/Project_Alice.git` (main branch: `main`)  
Active worktrees live under `.claude/worktrees/`. PowerShell setup scripts are in `.specify/scripts/powershell/`.

**Commit attribution.** This repo is built collaboratively by three AI agents — Claude, Codex, and Antigravity (Gemini-based). End every commit message with all three co-author trailers (after a blank line). Antigravity is credited via Google's `gemini-code-assist[bot]` account so it links on GitHub:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Co-Authored-By: Codex <noreply@openai.com>
Co-Authored-By: gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>
```
