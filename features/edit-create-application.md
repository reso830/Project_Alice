# Feature Brief: Enhanced Job Metadata & Inline Editing

## What I want

I want to expand job applications with additional metadata and allow inline editing directly from the application overlay.

The new fields for this phase are:
- Location
- Shift
- Work Setup
- Compatibility Notes
- General Notes
- Preferred Skills

The same overlay should support:
- creating a new application
- viewing an existing application
- editing an existing application

Users should be able to interact directly with fields instead of navigating to a separate edit screen.

---

## Why

The current application model is too minimal for meaningful evaluation and tracking.

Additional metadata improves:
- filtering and prioritization
- relocation evaluation
- work-life balance assessment
- long-term job hunt organization

Inline editing improves usability by:
- reducing navigation friction
- making updates feel faster and more natural
- encouraging users to keep application data updated
- avoiding large edit forms and mode switching

Using a shared overlay for create/edit/view flows also improves consistency and reduces maintenance complexity.

---

## User behavior

1. User opens an application or creates a new one
2. User sees application details and metadata fields
3. User can click/tap editable fields directly
4. System enables editing for the selected field
5. User modifies one or more values
6. Overlay enters a dirty state when unsaved changes exist
7. Save and Discard actions become available
8. User can:
   - save changes
   - discard changes
   - continue editing
9. If the user attempts to close or dismiss the overlay with unsaved changes, the system asks for confirmation before discarding edits

Examples:
- Clicking Location enables text editing
- Clicking Shift enables value editing
- Clicking notes enables multiline editing
- New applications use the same interaction flow with empty/default values

---

## Acceptance criteria

- [ ] Applications support a Location field
- [ ] Applications support a Shift field
- [ ] Applications support a Work Setup field
- [ ] Applications support Compatibility Notes
- [ ] Applications support General Notes
- [ ] Applications support Preferred Skills
- [ ] All new fields are optional
- [ ] Existing applications remain compatible after schema updates
- [ ] New fields appear in application overlays
- [ ] User can filter applications by Location, Shift, and Work Setup
- [ ] User can edit fields directly from the overlay
- [ ] Inline editing works on desktop and mobile
- [ ] Notes fields support multiline editing
- [ ] Unsaved changes trigger a dirty state
- [ ] Save and Discard actions appear when edits exist
- [ ] Attempting to dismiss the overlay with unsaved changes triggers a discard confirmation flow
- [ ] New application creation uses the same overlay system as viewing/editing existing applications
- [ ] Changes persist correctly after refresh/navigation

---

## Out of scope

- AI-generated compatibility analysis
- Automatic scoring systems
- Timeline/history tracking
- Recruiter tracking
- Real-time collaborative editing
- Version history
- Auto-save conflict resolution
- JD auto-parsing
- Advanced analytics

---

## Notes / constraints

- Keep the overall experience lightweight and low-friction
- Avoid turning the overlay into a large traditional form
- Existing behaviors and workflows must remain compatible
- Work Setup values are enum-only for this phase:
  - Remote
  - Hybrid
  - On-site
  - Field
- Location should remain flexible free-text input for now
- Shift values are enum-only for this phase: Day, Mid, Night, Flexible
- Future phases may add:
  - application timeline/history
  - compatibility scoring
  - relocation intelligence
  - AI summaries
  - recruiter tracking
