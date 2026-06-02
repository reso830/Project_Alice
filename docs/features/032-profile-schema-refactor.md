# Feature Brief: 032 - Profile Schema Refactor

## Summary

Refactor Alice's profile persistence model to support future AI-powered parsing, compatibility calculations, and skill-based intelligence while maintaining a simple and maintainable data structure.

The current profile structure was designed primarily for profile storage and editing. As Alice evolves into a career intelligence platform, certain profile data now participates in compatibility scoring, ATS analysis, and AI-generated insights.

This feature introduces a semi-normalized profile schema that promotes skills into first-class entities while retaining profile-centric information in a document-oriented structure.

---

## Goals

- Establish a long-term profile persistence strategy
- Support future AI-powered profile population
- Support compatibility calculations
- Support skill proficiency tracking
- Reduce future migration effort
- Keep profile CRUD operations simple

---

## Non-Goals

- Full profile normalization
- Resume parsing
- Compatibility scoring
- ATS analysis
- JD parsing
- Analytics dashboards
- Skill recommendation systems

---

## User Experience

### Visible User Impact

This feature should have little to no visible user-facing impact.

Users should continue to:
- view profiles
- edit profiles
- manage skills
- save profile changes

without behavioral changes.

---

### Data Integrity

Existing profile data should remain intact after migration.

Users should not be required to:
- recreate profiles
- re-enter skills
- rebuild profile sections

---

## Proposed Data Model

### Profile Record

Profile information should remain primarily document-oriented.

Suggested examples:
- summary
- experience history
- education
- certifications
- awards
- languages
- preferences

These sections primarily behave as profile-owned documents and are rarely queried independently.

---

### Skills

Skills should become first-class entities.

Suggested fields:

- profile_id
- skill_name
- proficiency

Skills participate in:
- compatibility calculations
- ATS analysis
- AI-generated profile population
- future skill analytics

and therefore justify independent storage.

---

## Functional Requirements

### Profile Persistence

The system must continue supporting:

- profile creation
- profile editing
- profile retrieval
- profile deletion

without user-facing regressions.

---

### Skill Persistence

The system must support:

- adding skills
- editing skills
- deleting skills
- storing proficiency values

independently from profile document data.

---

### Profile Loading

Profile retrieval should return a complete profile representation including:

- profile document data
- associated skills
- skill proficiency values

for use by the UI.

---

### Backward Compatibility

Existing profiles must remain usable after migration.

Migration paths should preserve:

- profile information
- skills
- user preferences

where applicable.

---

## Technical Notes

### Design Philosophy

Normalize data only when it is expected to be queried independently.

Keep document-oriented data in profile storage when it primarily exists as part of a user's profile.

---

### Semi-Normalized Strategy

Recommended separation:

Profile Document:
- summary
- experience
- education
- certifications
- awards
- languages
- preferences

Skill Records:
- skill name
- proficiency
- profile ownership

---

### Future Dependencies

This feature establishes the foundation for:

- 033 LLM Resume / CV Parser
- 034 LLM JD Parser
- 035 Compatibility Engine
- 036 Compatibility Insights Panel
- 037 ATS Resume Quality Checks

---

### Migration Considerations

Migration should:

- preserve existing profiles
- preserve existing skills
- populate proficiency defaults where necessary
- avoid manual user intervention

---

## Edge Cases

- Profiles with no skills
- Duplicate skills
- Empty skill lists
- Missing proficiency values
- Legacy profile formats
- Partial migration failures

---

## Success Criteria

- Existing profiles remain functional
- Skills become independently persisted
- Profile editing remains simple
- Future AI features can target a stable schema
- No user data is lost during migration

---

## Assumptions

- Hosted Supabase persistence already exists
- Profile editing functionality already exists
- Skill proficiency system already exists
- Future AI-powered features will consume profile data
- Alice remains a profile-centric application rather than a talent marketplace