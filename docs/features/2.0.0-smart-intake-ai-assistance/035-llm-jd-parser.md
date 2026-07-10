# Feature Brief: 034 - LLM JD Parser

## Summary
Upgrade job description parsing from rule-based extraction to AI-assisted parsing using LLMs.

Alice will transform pasted job descriptions into structured application/JD data for compatibility analysis and application tracking.

---

## Goals

- Improve JD extraction quality
- Reduce manual application entry friction
- Improve compatibility engine input quality
- Normalize inconsistent job post formatting
- Improve extracted requirement accuracy

---

## Non-Goals

- Auto-applying to jobs
- Browser scraping extensions
- Live job board syncing
- Continuous JD monitoring
- Recruiter outreach automation

---

## User Experience

### Entry Point
Users can:
- paste a job description manually

during application creation.

---

### Parsing Flow

1. User pastes JD text
2. Alice sends raw text to the LLM
3. LLM returns structured JSON
4. Alice populates application fields automatically
5. User reviews/edits before saving

---

### Review Experience
AI-generated fields remain editable before save.

Users can:
- modify extracted values
- remove incorrect information
- continue manually if needed

---

### Failure Handling
If parsing fails:
- allow retry
- allow manual continuation
- preserve existing user input

---

## Functional Requirements

### Supported Extraction Areas
The parser should support:
- company name
- role title
- skills
- responsibilities
- years of experience
- work setup
- salary range (if present)
- location

---

### Structured Output
The LLM should return JSON matching Alice’s application/JD schema.

---

### Manual Review
Users remain fully in control before saving parsed applications.

---

## Technical Notes

### Parsing Architecture
Suggested flow:
- send raw JD text
- receive structured JSON
- validate output
- populate application form

---

### Model Strategy
Target lightweight usage patterns suitable for:
- OpenRouter
- open/free models

Avoid excessive AI chaining.

---

### Schema Validation
All parsed outputs should pass validation before persistence.

---

## Edge Cases

- Extremely short JDs
- Very long JDs
- Multi-role job postings
- Missing salary/location information
- Ambiguous skill naming
- Non-English postings
- Duplicate extracted skills

---

## Success Criteria

- Users can create applications faster
- Extraction quality improves over rule-based parsing
- Compatibility engine receives better structured data
- Parsing failures degrade gracefully

---

## Assumptions

- Existing application schema already exists
- Existing application edit flow already exists
- Compatibility engine will consume parsed JD data later