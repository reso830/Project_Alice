# Feature Brief — Smart Application Creation Flow

## Overview
Introduce a smarter and lower-friction application creation experience by allowing users to either:
1. Paste a job posting and let the app auto-populate fields using parsing logic, or
2. Continue using the existing manual application form flow.

The feature should reduce the time and effort required to add new applications while still allowing users to review and edit parsed information before saving.

---

# Problem Statement

Creating applications manually introduces repetitive data entry and increases friction when tracking multiple job applications.

Most job posts already contain structured information that users repeatedly encode manually:
- Company name
- Job title
- Location
- Salary
- Employment type
- Work setup
- Description
- Skills
- Tech stack
- Job URLs

The current flow works, but it is optimized only for manual entry.

---

# Goals

## Primary Goals
- Reduce friction when creating applications
- Minimize repetitive manual typing
- Speed up application tracking workflow
- Maintain full user control before saving parsed data

## Secondary Goals
- Introduce a more modern and intelligent UX
- Create a foundation for future AI-assisted features
- Improve perceived app polish and usability

---

# User Experience Flow

## Entry Point
When the user clicks the:
- "New Application" button

Instead of immediately opening the manual form, the overlay first presents two creation options.

---

# Initial Overlay Selection Screen

## Layout
### Desktop
- Split vertically into 2 equal sections/cards

### Mobile
- Split horizontally into 2 stacked sections/cards

---

# Option 1 — Smart Parser

## Visual Direction
- Sparkles / magic wand style icon
- More visually emphasized than manual option

## Title
Paste the job post and the app will parse

## Description
Paste a job description and the app will automatically extract and populate application details for review.

## Action
Selecting this option transitions the overlay into Parser Mode.

---

# Option 2 — Manual Entry

## Visual Direction
- Pencil/edit icon

## Title
Enter it manually instead

## Description
Use the standard application form and manually input all details.

## Action
Selecting this option opens the existing manual application form unchanged.

---

# Smart Parser Flow

## Step 1 — Paste Job Post

### UI
Display:
- Large multiline text input
- "Process" button

### Behavior
User pastes:
- Full job posting text
- Partial posting text
- Recruiter message
- Structured or unstructured content

---

## Step 2 — Processing State

### Behavior
When the user clicks:
- "Process"

The app:
- Parses the pasted content
- Extracts recognizable fields
- Maps values into the application schema

### Suggested UX
- Loading indicator/spinner
- Temporary disabled state
- Processing message:
  - "Analyzing job post..."
  - "Extracting application details..."

---

## Step 3 — Parsed Result Review

Once processing completes:
- The standard application form appears
- Fields are now pre-populated using parsed values

The user can:
- Review values
- Edit any field
- Save application
- Discard changes

This should reuse the existing editable form behavior already implemented in the project.

---

# Parsing Scope

## Expected Extracted Fields

### High Confidence Fields
- Company Name
- Job Title
- Location
- Employment Type
- Work Setup
- Salary
- Job Posting URL (if present)
- Description / Notes
- Skills / Keywords
- Tech Stack

### Optional / Best Effort
- Seniority Level
- Department
- Recruiter Name
- Shift Details
- Benefits
- Visa Sponsorship Mention

---

# Compatibility Behavior

## Compatibility Score
Temporary implementation:
- Randomized generated value

## Compatibility Notes
Temporary implementation:
- Leave blank or "-"
- No AI-generated reasoning yet

---

# Error Handling

## Empty Input
If the pasted text area is empty:
- Disable Process button
OR
- Show validation message

---

## Parsing Failure
If parsing fails:
- Show non-blocking error state
- Allow retry
- Allow switching to manual entry

Suggested message:
> Unable to extract application details. Please review the pasted content or enter details manually.

---

# Technical Notes

## Initial Scope
The parser does NOT need:
- Real AI integration
- LLM APIs
- NLP pipelines
- Semantic understanding

Simple extraction logic and heuristics are acceptable for MVP:
- Regex
- Keyword matching
- Pattern extraction
- Section detection

---

# Suggested Parsing Heuristics

## Examples
### Company Name
Detect:
- "Company:"
- "About [Company]"
- Known job board structures

### Job Title
Usually:
- Topmost heading
- Largest line
- First meaningful title

### Salary
Regex:
- Currency symbols
- Ranges
- Annual/monthly indicators

### Work Setup
Keywords:
- Remote
- Hybrid
- Onsite

### Employment Type
Keywords:
- Full-time
- Contract
- Freelance
- Part-time

---

# Reusability Requirements

The parser flow should:
- Reuse the existing application form component
- Reuse existing validation logic
- Reuse save/update functionality
- Avoid duplicate form implementations

---

# UX Considerations

## Important
The parser should feel:
- Fast
- Assistive
- Non-destructive

Users should always:
- Review before saving
- Be able to manually correct fields
- Retain full control over final data

---

# Future Expansion Opportunities

## Potential Future Enhancements
- Real LLM parsing
- Resume-to-job compatibility analysis
- AI-generated compatibility notes
- Auto-tagging
- Duplicate detection
- Smart company recognition
- Direct URL parsing
- LinkedIn/JobStreet parser support
- "Improve resume for this role" integration

---

# Acceptance Criteria

## Functional
- New Application button opens selection overlay
- User can choose Smart Parser or Manual Entry
- Manual Entry opens existing form
- Smart Parser accepts pasted text
- Clicking Process extracts data
- Parsed values populate the existing form
- User can edit parsed values
- User can save normally

## UX
- Overlay layouts adapt for desktop/mobile
- Clear visual distinction between options
- Processing state exists
- Error states handled gracefully

## Technical
- Existing form reused
- No duplicated save logic
- Parsing layer separated from UI layer
- Compatible with future AI enhancement work

---

# Out of Scope

## Not Included
- Real AI/LLM integration
- External API integrations
- URL scraping
- Browser automation
- Resume analysis
- Auto-apply functionality
- Confidence scoring system
- Background parsing jobs