# Feature Brief: 033 - LLM Resume / CV Parser

## Summary
Upgrade resume parsing from rule-based extraction to AI-assisted parsing using LLMs.

Alice will accept pasted or uploaded resume/CV content and transform it into structured profile data using LLM-generated JSON.

---

## Goals

- Improve profile extraction quality
- Reduce manual profile setup friction
- Better identify technologies, responsibilities, and achievements
- Normalize inconsistent resume formatting
- Improve downstream compatibility calculations

---

## Non-Goals

- Resume rewriting
- Resume beautification/redesign
- Auto-saving parsed data
- Conversational AI editing
- Permanent resume storage

---

## User Experience

### Entry Point
Users can:
- upload a resume/CV
- paste resume text manually

from the profile setup/edit flow.

---

### Parsing Flow

1. User uploads or pastes resume
2. Alice extracts raw text
3. Raw text is sent to the LLM
4. LLM returns structured JSON
5. Alice populates profile fields automatically
6. User reviews/edits before saving

---

### Review Experience
AI-generated fields remain fully editable.

Suggested UX behaviors:
- subtle AI-generated indicators
- graceful handling of missing data
- lightweight review flow

---

### Failure Handling
If parsing fails:
- allow retry
- allow manual continuation
- avoid losing existing form data

---

## Functional Requirements

### Supported Extraction Areas
The parser should support:
- profile summary
- skills
- experience
- certifications
- education
- awards
- languages

---

### Structured Output
The LLM should return JSON matching Alice’s profile schema.

---

### Manual Review
Users must review/edit parsed data before save.

No automatic profile persistence should occur.

---

### File Support
Support:
- pasted text
- uploaded resumes/CVs

---

## Technical Notes

### Parsing Architecture
Suggested flow:
- extract raw text
- send raw text to LLM
- receive structured JSON
- validate JSON before population

---

### Model Strategy
Target compatibility with:
- OpenRouter
- open/free models

Avoid excessive multi-step prompting or chained AI calls.

---

### Validation
Parsed data should pass schema validation before being persisted.

---

## Edge Cases

- Poorly formatted resumes
- Multi-column resumes
- Incomplete resumes
- Extremely long resumes
- Unsupported file formats
- Hallucinated extractions
- Missing experience dates

---

## Success Criteria

- Parsing quality improves over rule-based extraction
- Users spend less time manually filling profiles
- Parsing remains reasonably fast
- Failures degrade gracefully
- Users remain fully in control of saved data

---

## Assumptions

- Existing profile schema already exists
- Existing profile edit flow already exists
- LLM providers are configurable
- Uploaded files are processed temporarily only