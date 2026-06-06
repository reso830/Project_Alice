# Feature Brief: 035 - Compatibility Engine

## Summary
Introduce a deterministic compatibility engine that evaluates alignment between a user profile and a job description.

The engine uses structured profile and JD data to calculate repeatable compatibility scores and match levels.

---

## Goals

- Replace placeholder compatibility scoring
- Create explainable and repeatable scoring logic
- Improve application evaluation usefulness
- Support weighted compatibility calculations
- Avoid AI-generated scoring instability

---

## Non-Goals

- Recruiter prediction
- Hiring probability estimation
- Interview prediction
- Personality analysis
- AI-generated scoring logic

---

## User Experience

### Compatibility Results
Applications display:
- compatibility score
- compatibility label

Suggested labels:
- Low Compatibility
- Medium Compatibility
- High Compatibility
- Great Compatibility

---

### Recalculation
Compatibility updates automatically when:
- profile data changes
- JD data changes
- skill proficiencies change

---

### Presentation
Scores should feel informative rather than authoritative.

Avoid:
- fake precision
- exaggerated certainty
- “AI knows your future” vibes

---

## Functional Requirements

### Comparison Inputs
The engine compares:
- skills
- skill proficiency
- experience alignment
- certifications
- role alignment
- keywords

---

### Scoring Output
Generate:
- numerical score
- compatibility label

---

### Deterministic Logic
Compatibility scoring must remain deterministic and repeatable.

Same inputs should always produce the same output.

---

### Weighted Skills
Support weighted scoring based on proficiency values.

---

## Technical Notes

### Architecture Philosophy
LLMs should NOT determine compatibility scores directly.

LLMs may assist with:
- extraction
- explanations

but scoring logic remains deterministic.

---

### Suggested Engine Design
Possible weighted categories:
- skills
- experience
- certifications
- keywords
- role alignment

Weights should remain configurable.

---

### Future Extensibility
The engine should support future recalculation without architectural rewrites.

---

## Edge Cases

- Sparse profiles
- Extremely short JDs
- Overloaded keyword-heavy JDs
- Duplicate skills
- Ambiguous technologies
- Profiles with minimal experience

---

## Success Criteria

- Compatibility scoring feels useful and believable
- Same inputs always produce same outputs
- Scores react meaningfully to profile changes
- Users understand broad fit quickly

---

## Assumptions

- Structured profile data already exists
- Structured JD data already exists
- Skill proficiency system already exists