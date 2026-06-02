# Feature Brief: 031 - Skill Proficiency System

## Summary
Introduce structured proficiency levels for user skills to improve compatibility evaluation quality and overall profile intelligence.

The current profile system stores skills as flat entries only. This feature adds weighted proficiency scoring to allow Alice to better understand user strengths and improve future compatibility calculations.

---

## Goals

- Add structured proficiency levels to profile skills
- Improve compatibility engine input quality
- Support weighted compatibility calculations
- Improve overall profile richness
- Keep the UX lightweight and practical

---

## Non-Goals

- Skill endorsements
- Social/recruiter-facing ratings
- Gamification systems
- Skill testing or certification validation
- AI-generated proficiency estimation

---

## User Experience

### Skill Creation
Users can:
- add a skill
- assign a proficiency level
- edit proficiency later

Suggested scale:
- 1 — Beginner
- 2 — Basic
- 3 — Intermediate
- 4 — Strong
- 5 — Expert

---

### Skill Editing
Existing skill pills remain editable/removable.

Users can:
- adjust proficiency
- rename skills
- remove skills entirely

---

### Visual Design
Skill proficiency indicators should remain subtle.

Avoid:
- gamified meters
- large progress bars
- “expert badges”
- LinkedIn-style endorsement energy

---

## Functional Requirements

### Skill Persistence
Each skill stores:
- skill name
- proficiency value

---

### Compatibility Integration
Compatibility calculations can consume weighted skill values.

Example:
- Expert-level Scrum Mastery weighs more heavily than beginner-level exposure.

---

### Manual Control
Users remain fully in control of:
- skill naming
- proficiency assignment
- edits/removals

---

## Technical Notes

### Suggested Data Structure
Skills may evolve from:
- string arrays

to:
- structured objects

Example:
```json
{
  "name": "Jira",
  "proficiency": 4
}
```

---

### Migration Considerations
Existing skills without proficiency values should receive safe defaults.

---

## Edge Cases

- Duplicate skills with different proficiencies
- Empty skill names
- Excessively large skill lists
- Imported skills without proficiency values

---

## Success Criteria

- Users can assign/edit proficiency values easily
- Compatibility calculations improve meaningfully
- UX remains lightweight and non-gameified
- Existing profiles migrate safely

---

## Assumptions

- Profile system already exists
- Skills are already persisted
- Compatibility engine will consume weighted skills later