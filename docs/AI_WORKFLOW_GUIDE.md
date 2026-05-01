# Local AI Workflow Guide

## NEW: Phase Review Gate

After each implementation phase, Claude must explicitly PASS the phase before moving forward.

A file is created per phase inside the feature directory:

```
specs/<feature>/.ai-phase-01-review
specs/<feature>/.ai-phase-02-review
```

Values:

```
PASS
NEEDS_CHANGES
PENDING_REVIEW
```

### Behavior

- Codex implements → gate = PENDING_REVIEW
- Claude reviews:
  - PASS → next phase unlocked
  - NEEDS_CHANGES → blocked

### If blocked

1. Read:
   ```
   specs/<feature>/logs/07-claude-check-phase-XX.log
   ```

2. Fix code

3. Re-run:

```powershell
./scripts/ai-flow.ps1 check-next <feature>
```

Only PASS allows moving forward.

---

## Updated Pipeline

```
Spec → Review → Req Gate → Implement → Phase Gate → Next Phase
```

Both gates must pass:

- Requirements gate (Codex)
- Phase gate (Claude)

---

## Bottom Line

- Codex cannot implement unclear specs
- Claude cannot let bad implementation pass
- Script enforces both
