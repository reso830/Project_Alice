# Feature Brief: 045 - ATS Resume Quality Checks

## Summary
Analyze resumes for ATS-friendliness and common resume quality issues using lightweight deterministic checks.

This feature helps users improve resume structure and parseability before applying.

---

## Goals

- Improve ATS compatibility awareness
- Surface common resume weaknesses
- Help users improve resume quality
- Provide lightweight resume diagnostics

---

## Non-Goals

- Automatic resume rewriting
- Resume redesign generation
- Recruiter simulation
- Guaranteed ATS scoring
- AI-generated resume optimization

---

## User Experience

### Resume Checks
Users can run ATS checks against their parsed profile/resume data.

Suggested outputs:
- missing sections
- weak keyword coverage
- formatting concerns
- missing measurable achievements

---

### Feedback Style
Feedback should:
- remain actionable
- avoid sounding overly critical
- feel advisory rather than judgmental

---

### Severity Levels
Optional severity grouping:
- informational
- recommendation
- warning

---

## Functional Requirements

### Supported Checks
Potential checks include:
- missing summary
- weak keyword coverage
- incomplete experience entries
- missing measurable achievements
- excessive graphics/tables
- sparse skill coverage

---

### Deterministic Rules
Checks should remain primarily deterministic and heuristic-based.

Avoid heavy AI dependence.

---

### Structured Feedback
Generate structured recommendations that can be displayed cleanly in the UI.

---

## Technical Notes

### Architecture Philosophy
Prefer lightweight deterministic analysis over expensive AI evaluation.

---

### Parsing Dependency
This feature relies heavily on:
- structured profile data
- parsed resume information

---

### Extensibility
Checks should support future expansion without major rewrites.

---

## Edge Cases

- Minimalist resumes
- Career shifters
- Fresh graduates
- Highly visual resumes
- Sparse experience histories
- Non-traditional career paths

---

## Success Criteria

- Users receive actionable ATS guidance
- Feedback remains understandable
- Checks run quickly
- False positives remain manageable

---

## Assumptions

- Resume parsing already exists
- Structured profile data already exists
- Users remain fully responsible for final resumes