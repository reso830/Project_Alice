# Plan Review Checklist: LLM JD Parser

Gate before accepting the plan and moving to `/speckit.tasks`.

## Alignment
- [ ] Plan addresses every functional requirement (FR-001…FR-022) in `spec.md`.
- [ ] Clarifications honored: AI-off → Smart card **locked** (not keyless basic parse);
      successful AI parse is the **sole source** (no cross-parser backfill); "years of
      experience" is an **explicit non-goal** (no output field); three-outcome routing —
      ≥1 field → pre-fill, unparseable/non-object → recoverable (basic offered), empty →
      NO_TEXT dead-end.
- [ ] Random 0–100 compat and never-parsed `wishlisted` status reflected.
- [ ] Full §13 realization covered (gate, smart input, processing, failure dialogs,
      provenance markers).

## Architecture
- [ ] Reuses `llmParser` transport without altering the shipped resume path behavior.
- [ ] Reuses `jobPostParser.parseJobPost` as the basic-parser fallback (unchanged).
- [ ] Gating triple is correct: `isEnabled() && getFeature('jd') && hasKey()`.
- [ ] Output validated via `normalizeApplication` + `validateApplication` before pre-fill.
- [ ] Provenance ported into `Modal.js` Create mode; Manual create path unchanged when
      no `aiFields`/`fillSource` are passed.
- [ ] No backend/`api/` changes; no server-side persistence of key or JD text.

## Risks & validation
- [ ] Highest-risk change (Modal provenance) has explicit mitigation + tests.
- [ ] `llmParser` refactor covered by existing regression tests.
- [ ] Validation approach covers AI path, basic fallback, locked state, dead-end, and
      text preservation across retries.

## Constitution
- [ ] Local-first preserved (Manual entry needs no key); no analytics/telemetry added.
- [ ] No new dependencies (or justified if any appear).
- [ ] Non-color-only provenance indicators (glyph + text); keyboard nav; desktop+mobile.
- [ ] Core validation has automated tests.
- [ ] Release Prep + Browser Smoke Test planned as the final two phases of `tasks.md`.

## Affected Areas section
- [ ] Inspect-only vs. modify distinction is accurate.
- [ ] No unrelated files listed; out-of-scope areas stated.
