# Plan Review Checklist: LLM JD Parser

Gate before accepting the plan and starting implementation.

**Reviewed 2026-06-08** — all items verified against `spec.md`, `plan.md`, and
`tasks.md` (post-Codex-findings reconciliation). Gate passed; implementation unblocked.

## Alignment
- [x] Plan addresses every functional requirement (FR-001…FR-022) in `spec.md`.
- [x] Clarifications honored: AI-off → Smart card **locked** (not keyless basic parse);
      successful AI parse is the **sole source** (no cross-parser backfill); "years of
      experience" is an **explicit non-goal** (no output field); three-outcome routing —
      ≥1 field → pre-fill, unparseable/non-object → recoverable (basic offered), empty →
      NO_TEXT dead-end.
- [x] Random 0–100 compat and never-parsed `wishlisted` status reflected.
- [x] Full §13 realization covered (gate, smart input, processing, failure dialogs,
      provenance markers).

## Architecture
- [x] Reuses `llmParser` transport without altering the shipped resume path behavior.
- [x] Reuses `jobPostParser.parseJobPost` as the basic-parser fallback (unchanged).
- [x] Gating triple is correct: `isEnabled() && getFeature('jd') && hasKey()`.
- [x] Output validated via `normalizeApplication` + `validateApplication` before pre-fill.
- [x] Provenance ported into `Modal.js` Create mode; Manual create path unchanged when
      no `aiFields`/`fillSource` are passed.
- [x] No backend/`api/` changes; no server-side persistence of key or JD text.

## Risks & validation
- [x] Highest-risk change (Modal provenance) has explicit mitigation + tests.
- [x] `llmParser` refactor covered by existing regression tests.
- [x] Validation approach covers AI path, basic fallback, locked state, dead-end, and
      text preservation across retries.

## Constitution
- [x] Local-first preserved (Manual entry needs no key); no analytics/telemetry added.
- [x] No new dependencies (or justified if any appear).
- [x] Non-color-only provenance indicators (glyph + text); keyboard nav; desktop+mobile.
- [x] Core validation has automated tests.
- [x] Release Prep + Browser Smoke Test planned as the final two phases of `tasks.md`.

## Affected Areas section
- [x] Inspect-only vs. modify distinction is accurate.
- [x] No unrelated files listed; out-of-scope areas stated.
