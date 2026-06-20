# Local AI Workflow Guide

A two-agent pipeline where Claude owns specification and review, and Codex owns requirements validation and implementation. The orchestrator script (`scripts/ai-flow.ps1`) wires them together with hard gates that block forward progress until each stage passes.

---

## Prerequisites

- [`claude`](https://claude.ai/code) CLI available on PATH
- [`codex`](https://openai.com/codex) CLI available on PATH
- [`gh`](https://cli.github.com) CLI available on PATH (for `create-pr` only)
- PowerShell 5.1+ (Windows) or PowerShell 7+ (cross-platform)
- An active Speckit feature directory under `specs/` with at least `spec.md`

---

## Role Division

| Stage | Agent |
|-------|-------|
| Write spec, plan, tasks | Claude |
| Architect review of spec package | Claude |
| Requirements validation | Codex |
| Implementation | Codex |
| Phase implementation review | Claude |
| PR review | Claude + Codex |

Requirement blockers always route back to Claude or the user. Codex does not edit `spec.md` or `tasks.md` directly.

---

## Full Pipeline

```
spec → req-review → implement → check-next → [repeat per phase] → create-pr → claude-pr-review → codex-pr-review
```

Two gates control forward progress:

1. **Requirements gate** — must pass before Codex can implement any phase; Codex reviews the spec package and declares `Ready` or `Not Ready`
2. **Phase gate** — must pass before advancing to the next phase; Claude reviews each phase's implementation and declares `Pass` or `Needs Changes`

---

## Actions Reference

Run from the repo root:

```powershell
./scripts/ai-flow.ps1 <action> <feature> [brief] [-DesignDoc <path>] [-Phase <n>] [-BaseBranch <branch>] [-Draft] [-SkipApproval]
```

| Action | Who runs | What it does |
|--------|----------|--------------|
| `spec` | Claude | Runs specify → plan → tasks → spec-review in sequence. Produces Speckit artifacts. Sets requirements gate to NOT_READY. |
| `req-review` | Codex | Reviews spec/plan/tasks for implementation blockers. Sets requirements gate to READY or NOT_READY. |
| `next-phase` | — | Displays current phase status, gate states, and phase list. No AI run. |
| `implement` | Codex | Implements the current phase. Requires requirements gate = READY. |
| `implement-next` | Codex | Same as `implement`. |
| `check-next` | Claude | Reviews Codex's implementation of the current phase. Sets phase gate to PASS or NEEDS_CHANGES. Advances phase pointer on PASS. |
| `check-implementation` | Claude | Same as `check-next`. |
| `create-pr` | — | Pushes branch and opens a GitHub PR via `gh`. |
| `claude-pr-review` | Claude | Final PR review. Logs to `08-claude-pr-review.log`. |
| `codex-pr-review` | Codex | Final PR review. Logs to `09-codex-pr-review.log`. |
| `run-all` | Codex + Claude | Loops through every phase automatically: implement → check-next for each. Skips phases already at PASS. Stops on NEEDS_CHANGES. Requires requirements gate = READY. |

### Parameters

| Parameter | Required | Default | Notes |
|-----------|----------|---------|-------|
| `Action` | Yes | — | One of the actions above |
| `FeatureName` | Yes | — | Feature slug or `###-feature-name`; resolved against `specs/` |
| `FeatureBrief` | For `spec` | — | Path to a brief/description file passed to Claude |
| `-DesignDoc` | No | — | Path to a design doc; injected into spec and plan prompts |
| `-Phase` | No | Auto | Override the current phase number |
| `-BaseBranch` | No | `main` | Target branch for `create-pr` |
| `-Draft` | No | Off | Create a draft PR |
| `-SkipApproval` | No | Off | Skip `Read-Host` approval prompts (use in automated runs) |

---

## Gate System

### Requirements Gate

Stored in `specs/<feature>/.ai-requirements-ready` (gitignored).

| Value | Meaning |
|-------|---------|
| `READY` | Codex reviewed and found no blockers — implementation can proceed |
| `NOT_READY` | Blockers exist — resolve them before running `implement` |

The gate is set automatically by parsing the first line of Codex's output:
- Starts with `Ready` → READY
- Starts with `Not Ready` → NOT_READY

### Phase Gate

Stored in `specs/<feature>/.ai-phase-XX-review` (gitignored).

| Value | Meaning |
|-------|---------|
| `PENDING_REVIEW` | Codex finished; Claude review not yet run |
| `PASS` | Claude approved — next phase unlocked |
| `NEEDS_CHANGES` | Claude found issues — implementation blocked |

The gate is set automatically by parsing the first line of Claude's output:
- Starts with `Pass` → PASS
- Starts with `Needs Changes` → NEEDS_CHANGES

### Phase Pointer

`specs/<feature>/.ai-phase` (gitignored) — stores the current phase number as a plain integer. Automatically advanced by `check-next` on PASS.

---

## Log Files

All logs are gitignored. Two locations:

| Location | Contains |
|----------|---------|
| `logs/ai-flow/` | Bootstrap logs from `spec` action before the feature directory exists |
| `specs/<feature>/logs/` | All subsequent logs for the feature |

| Log file | Stage |
|----------|-------|
| `logs/ai-flow/<feature>-01-claude-specify.log` | Claude: spec creation |
| `specs/<feature>/logs/02-claude-plan.log` | Claude: plan |
| `specs/<feature>/logs/03-claude-tasks.log` | Claude: tasks |
| `specs/<feature>/logs/04-claude-spec-review.log` | Claude: architect spec review |
| `specs/<feature>/logs/05-codex-requirements-review.log` | Codex: requirements check |
| `specs/<feature>/logs/06-codex-phase-XX.log` | Codex: phase implementation |
| `specs/<feature>/logs/07-claude-check-phase-XX.log` | Claude: phase review |
| `specs/<feature>/logs/08-claude-pr-review.log` | Claude: PR review |
| `specs/<feature>/logs/09-codex-pr-review.log` | Codex: PR review |

Temp prompt files (the actual text sent to each agent) are written to `logs/ai-flow/prompts/` with a UUID suffix so you can inspect exactly what was dispatched.

---

## Prompt Templates

Stored in `scripts/prompts/`. Each is a Markdown file with `{{PLACEHOLDER}}` tokens that the script fills in before dispatch.

| Template | Used by | Output token |
|----------|---------|--------------|
| `claude-specify.md` | `spec` | — |
| `claude-plan.md` | `spec` | — |
| `claude-tasks.md` | `spec` | — |
| `claude-spec-review.md` | `spec` | `Ready` / `Not Ready` |
| `codex-check-requirements.md` | `req-review` | `Ready` / `Not Ready` |
| `codex-implement-phase.md` | `implement` | — |
| `claude-check-implementation.md` | `check-next` | `Pass` / `Needs Changes` |
| `pr-review.md` | `claude-pr-review`, `codex-pr-review` | `Pass` / `Needs Changes` |

Available placeholders: `{{FEATURE_NAME}}`, `{{FEATURE_ID}}`, `{{SPEC_DIR}}`, `{{FEATURE_BRIEF}}`, `{{DESIGN_DOC}}`, `{{PHASE}}`, `{{BASE_BRANCH}}`.

---

## Typical Run

```powershell
# 1. Generate spec, plan, tasks, and architect review
./scripts/ai-flow.ps1 spec my-feature docs/features/my-feature-brief.md -DesignDoc docs/design/my_feature.md

# 2. Review Claude's output in specs/###-my-feature/; fix anything needed

# 3. Codex reviews requirements — blocks if unclear
./scripts/ai-flow.ps1 req-review my-feature

# 4. Check gate and phase list
./scripts/ai-flow.ps1 next-phase my-feature

# 5. Implement Phase 01
./scripts/ai-flow.ps1 implement my-feature

# 6. Claude reviews Phase 01 — advances pointer on PASS
./scripts/ai-flow.ps1 check-next my-feature

# 7. Repeat steps 5–6 for each phase

# 8. Open PR
./scripts/ai-flow.ps1 create-pr my-feature

# 9. Final reviews
./scripts/ai-flow.ps1 claude-pr-review my-feature
./scripts/ai-flow.ps1 codex-pr-review my-feature
```

---

## Recovery Flows

### Requirements gate stuck at NOT_READY

1. Read `specs/<feature>/logs/05-codex-requirements-review.log` for Codex's blockers
2. Update `spec.md`, `plan.md`, or `tasks.md` to resolve them
3. Re-run `req-review` — the gate will be re-evaluated

### Phase gate stuck at NEEDS_CHANGES

1. Read `specs/<feature>/logs/07-claude-check-phase-XX.log` for Claude's findings
2. Fix only the specific findings in the implementation (do not rewrite the full phase unless the scope is large)
3. Re-run `check-next` — the gate will be re-evaluated

### Wrong phase is current

Pass `-Phase <n>` to override: `./scripts/ai-flow.ps1 implement my-feature -Phase 2`

---

## FAQ

**Q: Do I need to pass the full `###-feature-name` or just the slug?**
The script accepts both. It first tries the exact name, then a `###-<slug>` prefix match, then the current branch name as a fallback. If nothing matches, it throws — there is no silent fallback to the latest spec directory. Verify the feature name matches a directory under `specs/` or pass the full numbered form (e.g. `005-my-feature`).

**Q: `implement` and `implement-next` look identical — which do I use?**
They are currently identical. Use either. `implement-next` was added for naming clarity in a multi-phase flow.

**Q: Same question for `check-implementation` vs `check-next`.**
Also identical. `check-next` is preferred as it signals intent (review and advance).

**Q: Why are gate files and logs gitignored?**
Gate files (`.ai-phase`, `.ai-phase-XX-review`, `.ai-requirements-ready`) are ephemeral workflow state. Logs can be large and contain redundant output. Neither belongs in source history.

**Q: What are the files in `logs/ai-flow/prompts/`?**
The script writes every prompt to a temp file before dispatching it. This lets you inspect exactly what was sent to Claude or Codex and replay or debug a run. They are gitignored.

**Q: Codex can't find my feature directory.**
Make sure you ran `spec` first (Speckit creates the directory). If the directory exists but the name doesn't match, pass the full `###-feature-name` directly.

**Q: Can I run this in CI without interactive prompts?**
Yes — pass `-SkipApproval`. All `Read-Host` gates are bypassed. Intended for automated pipelines.

**Q: When should I use `-DesignDoc`?**
When a design file exists (e.g., `docs/design/pagination_footer.md`). It is injected into the specify and plan prompts so Claude can use it as implementation guidance. If it affects behavior or data model, Claude should update the Speckit artifacts before Codex implements.

**Q: Claude or Codex exited with a non-zero code. What now?**
The script throws immediately and prints the exit code and log path. Read the log, fix the underlying issue (bad prompt, missing file, auth problem), and re-run the same action.

**Q: How do I see all phases and their current gate states?**
`./scripts/ai-flow.ps1 next-phase my-feature` — prints each phase with its gate value and marks the current one with `*`.

**Q: What does `run-all` do exactly?**
It loops through every phase in `tasks.md` in order, running `implement` then `check-next` for each. Phases already at PASS are skipped so it's safe to re-run after a partial failure. Approval prompts are bypassed automatically. It stops immediately if any phase gate returns NEEDS_CHANGES — at that point read the log, fix the findings, and re-run `run-all` (it will skip the already-passed phases and retry from where it stopped).
