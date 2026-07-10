# `025-application-timeline`

## Summary

Introduce a Timeline system inside the Application Detail Overlay (modal on desktop, bottom sheet on mobile) to allow users to track the progress and history of each job application through chronological entries.

The Timeline replaces the previous static “Last Updated” field and becomes the central activity log for application progress tracking. Users can manually add updates, document recruiter interactions, log interviews, schedule future follow-ups, and automatically track status transitions.

This feature improves long-term tracking visibility and gives applications a more realistic CRM-style workflow without significantly increasing interaction complexity.

Design reference provided in: application_timeline.md

---

# Goals

- Add a dedicated Timeline section to the Application Detail Overlay
- Support chronological application tracking through structured entries
- Allow both retroactive logging and future scheduled events
- Automatically log status changes into the timeline
- Keep Timeline interactions lightweight and inline
- Improve realism and usability of demo and seeded datasets

---

# Core Functionality

## Timeline Section

A new full-width “Timeline” section will be added to the Application Detail Overlay.

This replaces the old static “Last Updated” field entirely.

The Timeline supports:

- Manual activity logging
- Automatic status transition logging
- Editable notes
- Status tagging per entry
- Chronological history display

---

# Timeline Entry Structure

Each Timeline entry contains:

- Date
- Status
- Optional note / activity text

Example:

```txt
Apr 22 — [Interview] Tech round with frontend lead.
```

Entries are always displayed:

- Newest first
- Descending by date
- Latest inserted first for same-day entries

---

# Timeline States

## Collapsed State (Default)

When opening the overlay, the Timeline starts collapsed.

Collapsed mode displays:

- Latest timeline entry
- Status badge
- Short preview text
- Empty-state prompt if no entries exist

Example:

```txt
Apr 22 — [Interview] Tech round with frontend lead.
```

If empty:

```txt
No entries yet — click to add
```

---

## Expanded State

Expanding the Timeline reveals:

- Inline add-entry row
- Full activity history
- Existing editable entries
- Inline status editing
- Entry deletion controls

Expanded mode is session-local only and resets to collapsed when reopening the overlay.

---

# Add Timeline Entry

Users can add timeline entries inline directly from the expanded Timeline.

Fields:

- Date picker
- Status selector
- Optional notes field

The date field must use a proper date input control.

Requirements:

- Allow past dates for retroactive logging
- Allow future dates for scheduled events or reminders
- Default date should be today
- Status defaults to current application status

Unlike the initial design draft, future dates should NOT be blocked.

---

# Entry Editing

Users can:

- Edit entry text inline
- Change entry status inline
- Delete entries inline

Entry editing should remain lightweight and immediate.

No confirmation modal is required for deleting entries while still inside unsaved draft state.

---

# Automatic Timeline Entries

When application status changes through the existing Change Status action:

1. Application status updates normally
2. `lastStatusUpdate` updates normally
3. A new Timeline entry is automatically appended

Auto-generated entries should:

- Use the current date
- Use the newly selected status
- Start with an empty note field

This preserves a historical audit trail of application progression.

---

# Data Model

Add a new Timeline structure to the Application model.

Suggested structure:

```ts
type TimelineEntry = {
  id: number
  date: string
  status: StatusKey
  text: string
}
```

Application model gains:

```ts
timeline: TimelineEntry[]
```

---

# Sorting Rules

Timeline entries should always render:

1. Newest date first
2. Latest created first for entries on the same date

This ensures recent activity is always immediately visible.

---

# Seeding & Demo Data

Update all local/demo datasets to heavily utilize Timeline functionality.

## Local DB Seed

Add realistic Timeline histories to seeded applications, including:

- Applied entries
- Recruiter outreach
- Interview schedules
- Technical exams
- Offers
- Rejections
- Ghosting gaps
- Follow-up reminders
- Future scheduled events

---

## Demo Mode

Demo applications should showcase varied Timeline usage patterns so users immediately understand the feature.

Include:

- Minimal timelines
- Dense timelines
- Empty timelines
- Future follow-up entries
- Accepted applications
- Rejected applications

---

## New User Starter Cards

The two starter/example cards for first-time users should include rich Timeline examples demonstrating:

- Automatic status progression
- Manual notes
- Scheduled follow-ups
- Inline notes usage

This helps onboard users into the Timeline workflow naturally.

---

# Modal Layout Update

Timeline becomes a dedicated full-width section positioned between:

- Compatibility Notes
- Responsibilities

Updated order:

1. Company
2. Recruiter
3. Location
4. Salary
5. Shift
6. Work Setup
7. Compatibility
8. Compatibility Notes
9. Timeline
10. Responsibilities
11. Required Skills
12. Preferred Skills
13. URL
14. General Notes

---

# Mobile Behavior

Timeline rows should adapt cleanly for mobile bottom-sheet layouts.

Requirements:

- Preserve readability
- Keep delete/add actions accessible
- Prevent horizontal overflow
- Keep newest-first readability intact

Collapsed preview behavior remains unchanged on mobile.

---

# Keyboard & Accessibility

Timeline interactions should support keyboard accessibility.

Requirements include:

- Expand/collapse via keyboard
- Inline editing support
- Enter-to-save behavior
- Escape-to-cancel behavior
- Proper focus states
- Proper button semantics

---

# Status System Update

Include the previously approved Accepted status across Timeline surfaces.

Status:

- `accepted`
- Accent color: `#2EC4B6`
- Dark text for contrast (`#212529`)

Accepted should appear consistently in:

- Timeline nodes
- Status pills
- Dropdowns
- Filters
- Modal headers

---

# Additional Notes

- Timeline entries are independent from the application's current status
- Timeline should not replace the application's primary status field
- Automatic status-change entries should still be editable or removable by the user
- Timeline expansion state should not persist after modal close
- Timeline interactions should follow existing overlay save/discard behavior

---

# Out of Scope

The following are intentionally excluded for this feature:

- Timeline attachments/files
- Email parsing
- Calendar integrations
- Bulk timeline import
- Auto-generated entries from favorite/archive actions
- Timeline analytics/reporting
- External notifications/reminders