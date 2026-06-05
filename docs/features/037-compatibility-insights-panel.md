# Feature Brief: 036 - Compatibility Insights Panel

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

## Assumptions

- Compatibility engine already exists
- Structured profile/JD data already exists
- LLM provider abstraction already exists