# Feature Brief: 037 - Compatibility Insights Panel

## Summary
Generate concise human-readable compatibility insights using structured profile data, JD data, and compatibility results.

This feature explains compatibility scores using lightweight AI-generated notes.

---

## Goals

- Make compatibility understandable
- Explain strengths and gaps clearly
- Improve usefulness beyond raw scores
- Provide lightweight AI-assisted guidance

---

## Non-Goals

- Career coaching
- Resume rewriting
- Salary advice
- Interview coaching
- AI chat assistant functionality

---

## User Experience

### Insights Display
Users can view concise compatibility notes for applications.

Example outputs:
- Strong Agile and stakeholder management alignment.
- Missing direct cloud platform experience.
- Leadership background aligns well with role expectations.

---

### Tone
Insights should:
- remain concise
- avoid sounding authoritative
- avoid excessive verbosity
- feel practical and grounded

---

### Refresh Behavior
Insights refresh automatically when:
- profile changes
- JD changes
- compatibility recalculates

---

## Functional Requirements

### Inputs
Alice sends:
- structured profile JSON
- structured JD JSON
- compatibility results

to the LLM.

---

### Generated Output
Generate:
- strengths
- gaps
- alignment observations

---

### Failure Handling
If insight generation fails:
- compatibility scoring still works
- applications remain usable
- graceful fallback messaging appears

---

## Technical Notes

### AI Usage Philosophy
LLMs generate explanations only.

Compatibility scoring itself remains deterministic.

---

### Cost Considerations
Keep prompts:
- concise
- efficient
- compatible with open/free models

Avoid excessively long context windows where possible.

---

### Prompting Strategy
Prompts should encourage:
- concise outputs
- structured reasoning
- grounded observations
- minimal hallucinations

---

## Edge Cases

- Extremely sparse profiles
- Very short JDs
- Contradictory extracted data
- Hallucinated recommendations
- Overly generic AI responses

---

## Success Criteria

- Users understand why compatibility scores exist
- Notes feel useful and readable
- AI responses remain concise
- LLM costs remain manageable

---

## Context carried over from 036 (post-smoke-test, 2026-06-16)

The 036 scoring rework ("Group B") made scores intentionally **conservative** — pooled
skill coverage counts every missing required skill, and "Great" is hard to reach. During
036's browser smoke test we flagged a product risk: **a low number with no context can
discourage users from applying** to roles that might still be worth a shot.

037 is the natural place to address this — not by softening the math, but by making the
score **explainable and actionable**:

- Turn a low score into a **to-do list, not a verdict** — surface the per-category breakdown
  036 deliberately did *not* expose (e.g. "you match 4 of 6 required skills; missing X, Y"),
  so the user sees *why* and *what would move it*.
- Keep the score framed as **broad fit, explicitly not "should you apply."**

Lower-risk levers, if scoring is ever revisited (track here, do **not** re-open the category
math casually): the **band thresholds** (is 65 the right floor for "High"?) and the
score's **framing/copy**. The engine is deterministic and explainable by design, which is
exactly what makes this insights layer possible.

---

## Assumptions

- Compatibility engine already exists
- Structured profile/JD data already exists
- LLM provider abstraction already exists