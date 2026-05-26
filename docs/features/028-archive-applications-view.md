# Feature Brief: 028 - Archive Applications View

## Summary
Introduce a dedicated Archived Applications view that allows users to review, search, filter, restore, and permanently manage applications that were previously archived.

This feature completes the application lifecycle loop by ensuring archived applications remain accessible without cluttering the primary active tracker experience.

Archived applications are excluded from active workflows, analytics, suggestions, and calendar visibility unless explicitly restored.

---

## Goals

- Provide visibility into archived applications
- Prevent archived items from polluting active tracking workflows
- Allow users to restore archived applications when needed
- Maintain consistent filtering, sorting, and viewing behaviors
- Improve long-term application management and organization

---

## Non-Goals

- Permanent deletion of individual applications
- Bulk archive/restore operations
- Separate archive analytics
- Archive tagging/categories
- Auto-archive logic

---

## User Experience

### Navigation
Users can access archived applications through:
- Sidebar navigation item
- Filter toggle
- Dedicated archive page/tab

---

### Archived Application Behavior

Archived applications:
- Are hidden from the main tracker by default
- Do not appear in:
  - active application counts
  - calendar suggestions
  - follow-up recommendations
  - compatibility analytics
  - dashboard metrics
- Retain complete application history and timeline information

---

### Application Card Behavior

Archived application cards should:
- Remain visually recognizable
- Use subdued/desaturated styling compared to active applications
- Continue supporting:
  - view/edit
  - timeline access
  - restore action

---

### Restore Flow

Users may restore archived applications.

Restored applications:
- Return to the active tracker
- Reappear in analytics and workflow systems
- Retain prior timeline/history data

---

### Empty State

If no archived applications exist:
- Show a meaningful empty state
- Explain what archived applications are used for

Example:
> “Archived applications are hidden from active tracking but remain accessible for future reference.”

---

## Functional Requirements

### Archive Visibility
- Archived applications must be queryable separately from active applications
- Archive filtering must remain compatible with:
  - quick filters
  - sorting
  - search
  - pagination

---

### Data Persistence
- Archive status must persist across:
  - sessions
  - hosted mode
  - local mode

---

### Compatibility Rules
Archived applications must be excluded from:
- active workflow calculations
- suggestions engine
- follow-up systems
- future analytics calculations

unless restored.

---

## Technical Notes

### Suggested Data Model
Current archive boolean/status field may be reused.

No separate archive table is required.

---

### Query Behavior
Archive filtering should occur server-side when possible.

---

### UI Consistency
Archived application overlays should reuse the existing inline edit overlay system.

---

## Edge Cases

- Restoring a previously terminal-status application
- Searching within large archived datasets
- Archived applications with pending follow-ups
- Archived applications imported from demo mode

---

## Success Criteria

- Users can reliably access archived applications
- Archived applications no longer clutter active workflows
- Restore operations work predictably
- UX remains consistent with active tracker flows

---

## Assumptions

- Archive functionality already exists at the application level
- Existing tracker filters/sorting can be reused
- Timeline/history system already supports archived items
- Archive is implemented as a persisted application property