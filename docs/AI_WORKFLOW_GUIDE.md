# Local AI Workflow Guide

This guide explains how to run the Claude + Codex workflow locally for Project Alice.

## Overview

This setup automates your existing manual workflow while keeping approval gates under your control.

- Speckit remains the source of truth for branches and spec directories
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

---

## Important Behavior (Speckit-first)

You pass a feature *slug* (e.g. `profile-page-improvements`).

Speckit will:

- create a branch like: `007-profile-page-improvements`
- create a directory like:

```text
specs/007-profile-page-improvements/
```

The script automatically detects and uses this directory.

You do NOT need to pass the numbered name.

---

## Step 1 — Create a Feature Brief

Create:

```text
features/profile-page-improvements.md
```

---

## Step 2 — Reference the Design File

```text
design/profile_page_improvements.md
```

---

## Step 3 — Generate Spec Kit Artifacts

```powershell
./scripts/ai-flow.ps1 spec profile-page-improvements `
  features/profile-page-improvements.md `
  -DesignDoc design/profile_page_improvements.md
```

Output (example):

```text
specs/007-profile-page-improvements/
  spec.md
  plan.md
  tasks.md
  research.md (if generated)
  data-model.md (if generated)
  quickstart.md (if generated)
  checklists/
  contracts/
  .ai-phase
  .ai-requirements-ready
  logs/
```

---

## Step 4 — Codex Requirements Review (HARD GATE)

```powershell
./scripts/ai-flow.ps1 req-review profile-page-improvements
```

This step now sets a gate file:

```text
.ai-requirements-ready
```

Values:

```text
READY
NOT_READY
```

### Behavior

- If NOT_READY → implementation is BLOCKED
- If READY → implementation allowed

---

## Step 5 — Check Phase

```powershell
./scripts/ai-flow.ps1 next-phase profile-page-improvements
```

---

## Step 6 — Implement Phase (ENFORCED)

```powershell
./scripts/ai-flow.ps1 implement-next profile-page-improvements
```

If requirements are NOT_READY, you will get:

```text
Requirements are not marked READY. Resolve Codex blockers first.
```

---

## Step 7 — Fixing NOT_READY

If blocked:

1. Read:
   ```text
   specs/<feature>/logs/05-codex-requirements-review.log
   ```

2. Fix:
   - spec.md
   - plan.md
   - tasks.md

3. Re-run:

```powershell
./scripts/ai-flow.ps1 req-review <feature>
```

Only proceed when READY.

---

## Step 8 — Implementation Loop

```powershell
./scripts/ai-flow.ps1 implement-next <feature>
./scripts/ai-flow.ps1 check-next <feature>
```

---

## Step 9 — Create PR

```powershell
./scripts/ai-flow.ps1 create-pr <feature>
```

---

## Step 10 — PR Reviews

```powershell
./scripts/ai-flow.ps1 claude-pr-review <feature>
./scripts/ai-flow.ps1 codex-pr-review <feature>
```

---

## Guardrails

- You cannot implement unless requirements are READY
- Do not bypass this unless debugging
- Tasks.md must be implementation-grade

---

## Bottom Line

- Speckit owns structure
- Script enforces flow
- Codex cannot implement unclear requirements anymore
