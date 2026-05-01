# Local AI Workflow Guide

This guide explains how to run the Claude + Codex workflow locally for Project Alice.

## Overview

This setup automates your existing manual workflow:

- Claude → Spec generation + architecture review
- Codex → Requirements validation + implementation
- You → Approval and decision gates

The script orchestrates the flow, but **you stay in control**.

---

## Prerequisites

Install the following:

- Claude CLI (`claude`)
- Codex CLI (`codex`)
- GitHub CLI (`gh`) (for PR comment automation)

Authenticate:

```bash
gh auth login
```

---

## Project Structure

Add these folders:

```text
scripts/
  ai-flow.ps1
  prompts/

features/
  <feature>.md

specs/
  <feature>/

# Design files (already present)
design/
```

---

## Step 1 — Create Feature Brief

Create a file:

```text
features/profile-page-improvements.md
```

This contains your raw requirements (like what you gave ChatGPT earlier).

---

## Step 2 — Use Existing Design Files

Design files are already here:

```text
design/<feature>.md
```

These are passed into Claude automatically.

---

## Step 3 — Generate Spec Kit

```powershell
./scripts/ai-flow.ps1 spec profile-page-improvements \
  features/profile-page-improvements.md \
  -DesignDoc design/profile_page.md
```

This runs:

1. `/speckit.specify`
2. `/speckit.plan`
3. `/speckit.tasks`
4. Claude architect review

Output:

```text
specs/profile-page-improvements/
  spec.md
  plan.md
  tasks.md
  logs/
```

---

## Step 4 — Requirements Review (Codex)

```powershell
./scripts/ai-flow.ps1 req-review profile-page-improvements
```

Codex checks for:

- unclear requirements
- blockers
- missing edge cases

---

## Step 5 — Implementation (Phase-based)

```powershell
./scripts/ai-flow.ps1 implement profile-page-improvements -Phase 1
```

Then:

```powershell
./scripts/ai-flow.ps1 check-implementation profile-page-improvements -Phase 1
```

Repeat per phase.

---

## Step 6 — Final PR Reviews

Claude:

```powershell
./scripts/ai-flow.ps1 claude-pr-review profile-page-improvements
```

Codex:

```powershell
./scripts/ai-flow.ps1 codex-pr-review profile-page-improvements
```

Both will post comments to the PR thread via `gh` CLI.

---

## Workflow Summary

```text
Feature brief + design
   ↓
Claude (spec → plan → tasks)
   ↓
Claude architect review
   ↓
You approve
   ↓
Codex requirement review
   ↓
Codex implement phase N
   ↓
Claude checks implementation
   ↓
Repeat
   ↓
PR reviews (Claude + Codex)
   ↓
Manual testing
```

---

## Notes

- Do NOT skip approval gates
- Tasks.md is the most important file
- Keep phases small and testable
- Let Codex implement, not design

---

## Recommended Next Improvements

- Auto-detect phases from tasks.md
- Auto-create branches per feature
- Auto-create PR from logs

---

## Bottom Line

This setup:

- removes copy-paste work
- preserves Spec Kit discipline
- keeps you in control

It complements the existing Specify workflow — it does not replace it.
