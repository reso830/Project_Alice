# Local AI Workflow Guide

This guide explains how to run the Claude + Codex workflow locally for Project Alice.

## Overview

This setup automates your existing manual workflow while keeping approval gates under your control.

- Claude generates Spec Kit artifacts and reviews architecture
- Codex checks requirements and implements phases
- Claude checks Codex phase output
- Claude and Codex can both review the final PR
- You approve the major gates and perform final manual testing

The script is an orchestrator. It does not replace your judgment.

---

## Prerequisites

Install and authenticate:

- Claude CLI (`claude`)
- Codex CLI (`codex`)
- GitHub CLI (`gh`)
- Git

Authenticate GitHub CLI:

```bash
gh auth login
```

The final PR review prompts expect `gh` to be available so review comments can be posted to the PR thread.

---

## Project Structure

Relevant folders:

```text
scripts/
  ai-flow.ps1
  prompts/
    claude-specify.md
    claude-plan.md
    claude-tasks.md
    claude-spec-review.md
    codex-check-requirements.md
    codex-implement-phase.md
    claude-check-implementation.md
    claude-pr-review.md
    codex-pr-review.md

features/
  <feature>.md

specs/
  <feature>/
    spec.md
    plan.md
    tasks.md
    .ai-phase
    logs/

design/
  <design-reference>.md
```

Design files are expected under:

```text
design/*
```

---

## Step 1 — Create a Feature Brief

Create a feature brief file under `features/`:

```text
features/profile-page-improvements.md
```

This is where you put the raw feature requirements you would normally give to ChatGPT or Claude.

Example content:

```md
# Profile Page Improvements

Improve the Profile page layout and Profile edit/create experience.

Requirements:
- Certifications should match the Education visual style.
- Awards should match the Professional Experience visual style.
- Edit/Create Profile sections should follow the View Profile ordering.
- Add buttons should be right-aligned in each section header.
- Add/Edit actions should open a modal on desktop and bottom sheet on mobile.
```

---

## Step 2 — Reference the Claude Design File

Use the matching design file from `design/`.

Example:

```text
design/profile_page_improvements.md
```

The feature brief is the behavioral source of truth. The design file is the UI/layout reference.

---

## Step 3 — Generate Spec Kit Artifacts

Run:

```powershell
./scripts/ai-flow.ps1 spec profile-page-improvements `
  features/profile-page-improvements.md `
  -DesignDoc design/profile_page_improvements.md
```

This runs, in order:

1. Claude specify prompt
2. Claude plan prompt
3. Claude tasks prompt
4. Claude architect review of the generated Spec Kit output

Expected output:

```text
specs/profile-page-improvements/
  spec.md
  plan.md
  tasks.md
  .ai-phase
  logs/
    01-claude-specify.log
    02-claude-plan.log
    03-claude-tasks.log
    04-claude-spec-review.log
```

`.ai-phase` tracks the current implementation phase detected from `tasks.md`.

---

## Step 4 — Review the Spec Kit Output

Review:

```text
specs/<feature>/spec.md
specs/<feature>/plan.md
specs/<feature>/tasks.md
specs/<feature>/logs/04-claude-spec-review.log
```

If Claude raises clarification questions, update the feature brief/spec files as needed before moving forward.

---

## Step 5 — Codex Requirements Review

Run:

```powershell
./scripts/ai-flow.ps1 req-review profile-page-improvements
```

Codex checks the requirements as an engineer for:

- unclear implementation details
- blockers
- missing acceptance criteria
- contradictions between spec/plan/tasks
- missing validation or test expectations

If Codex says `Not Ready`, fix the requirements before implementing.

---

## Step 6 — Check the Current Phase

Run:

```powershell
./scripts/ai-flow.ps1 next-phase profile-page-improvements
```

This reads `tasks.md`, detects phase headings, and shows the current phase tracked in:

```text
specs/profile-page-improvements/.ai-phase
```

Expected phase heading format:

```md
## Phase 01: Foundation
## Phase 02: UI Integration
## Phase 03: Tests and Polish
```

---

## Step 7 — Implement the Next Phase

Run:

```powershell
./scripts/ai-flow.ps1 implement-next profile-page-improvements
```

This tells Codex to implement only the current phase from `tasks.md`.

Codex is instructed to:

- follow the constitution
- avoid unrequested features
- keep changes small and testable
- add or update tests for core logic
- stop after the current task batch
- push changes if the prompt/tooling allows it

---

## Step 8 — Claude Checks the Implementation

Run:

```powershell
./scripts/ai-flow.ps1 check-next profile-page-improvements
```

Claude reviews Codex's implementation for the current phase.

After this completes, the script advances `.ai-phase` to the next detected phase, if one exists.

Repeat:

```powershell
./scripts/ai-flow.ps1 implement-next profile-page-improvements
./scripts/ai-flow.ps1 check-next profile-page-improvements
```

until all phases are done.

---

## Manual Phase Override

If you need to run a specific phase manually:

```powershell
./scripts/ai-flow.ps1 implement profile-page-improvements -Phase 2
./scripts/ai-flow.ps1 check-implementation profile-page-improvements -Phase 2
```

This is useful if you need to rerun a phase after fixes.

---

## Step 9 — Create the Pull Request

Checkout the feature branch you want to open as a PR, then run:

```powershell
./scripts/ai-flow.ps1 create-pr profile-page-improvements
```

Optional draft PR:

```powershell
./scripts/ai-flow.ps1 create-pr profile-page-improvements -Draft
```

Optional non-main base branch:

```powershell
./scripts/ai-flow.ps1 create-pr profile-page-improvements -BaseBranch develop
```

The script will:

1. detect the current branch
2. refuse to create a PR from `main` to `main`
3. push the branch
4. create the PR with `gh pr create`
5. include links/references to the Spec Kit files and logs

---

## Step 10 — Final PR Reviews

Claude final review:

```powershell
./scripts/ai-flow.ps1 claude-pr-review profile-page-improvements
```

Codex final review:

```powershell
./scripts/ai-flow.ps1 codex-pr-review profile-page-improvements
```

These prompts instruct each tool to identify the active PR with:

```bash
gh pr view --json number,url,headRefName,baseRefName
```

and post findings to the PR thread for tracking.

---

## Common Commands

| Task | Command |
|---|---|
| Generate Spec Kit + Claude review | `./scripts/ai-flow.ps1 spec <feature> features/<feature>.md -DesignDoc design/<file>.md` |
| Codex requirement review | `./scripts/ai-flow.ps1 req-review <feature>` |
| Show current phase | `./scripts/ai-flow.ps1 next-phase <feature>` |
| Implement current phase | `./scripts/ai-flow.ps1 implement-next <feature>` |
| Claude check current phase | `./scripts/ai-flow.ps1 check-next <feature>` |
| Implement specific phase | `./scripts/ai-flow.ps1 implement <feature> -Phase 2` |
| Claude check specific phase | `./scripts/ai-flow.ps1 check-implementation <feature> -Phase 2` |
| Create PR | `./scripts/ai-flow.ps1 create-pr <feature>` |
| Claude PR review | `./scripts/ai-flow.ps1 claude-pr-review <feature>` |
| Codex PR review | `./scripts/ai-flow.ps1 codex-pr-review <feature>` |

---

## Workflow Summary

```text
Feature brief + design
   ↓
Claude: specify → plan → tasks
   ↓
Claude architect review
   ↓
You approve / clarify
   ↓
Codex requirement review
   ↓
You approve / clarify
   ↓
Codex implement current phase
   ↓
Claude checks Codex implementation
   ↓
Repeat until all phases complete
   ↓
Create PR
   ↓
Claude PR review + Codex PR review
   ↓
Manual testing and final sign-off
```

---

## Guardrails

Do not skip these unless you are deliberately experimenting:

- Review Claude's spec review before Codex requirement review
- Fix `Not Ready` findings before implementation
- Keep phases small
- Keep `tasks.md` implementation-grade
- Manually test before merge

The `-SkipApproval` switch exists, but should be used carefully.

---

## Troubleshooting

### `Prompt template not found`

Check that the expected file exists under:

```text
scripts/prompts/
```

### `No phase headings found`

Update `tasks.md` headings to use this format:

```md
## Phase 01: <name>
```

### PR review does not post comments

Check:

```bash
gh auth status
gh pr view
```

### Claude or Codex command not found

Confirm the CLIs are installed and available in your PATH:

```bash
claude --version
codex --version
```

---

## Bottom Line

This local workflow removes copy-paste ceremony while preserving the Spec Kit flow and your manual approval gates.
