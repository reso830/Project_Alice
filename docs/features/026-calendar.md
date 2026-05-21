# `024-calendar-dashboard`

## Summary

Introduce a dedicated Calendar page that acts as a visualization and operational dashboard for application activity over time.

The Calendar is not intended to function as a generic productivity planner or standalone event system. Instead, it serves as a timeline-driven projection layer for application activity, surfacing interviews, deadlines, follow-ups, and contextual workflow suggestions derived from application Timeline entries.

This feature introduces:

- Month-view calendar visualization
- Today / Suggested Actions / Upcoming dashboard panels
- Timeline-to-calendar projection
- Rule-based workflow suggestions
- Smart inactivity nudges
- Status-aware activity aggregation
- Application overlay integration

The Calendar becomes a lightweight operational companion to the Tracker while preserving the Application Overlay as the single editing experience.

Design reference provided in: `calendar.md` :contentReference[oaicite:0]{index=0}

Related references:
- `tracker.md`
- `application_timeline.md`

---

# Goals

- Add a dedicated Calendar page for temporal application tracking
- Visualize application Timeline activity over time
- Surface actionable follow-ups and deadlines
- Improve visibility into application momentum and pipeline activity
- Reuse Timeline entries as the canonical data source
- Keep the Calendar lightweight and operational
- Avoid duplicate event-management systems

---

# Core Architectural Direction

## Timeline-Centric Calendar

The Calendar should not maintain its own event database.

Instead:

```txt
Application
└── Timeline Entries
    └── Calendar Projection
```

Timeline entries remain canonical.

Calendar events are derived at render time from application timelines.

The Calendar should:
- never become a standalone editor
- never create duplicate CRUD paths
- never desynchronize from application data

All edits continue to happen through the existing Application Overlay.

---

# Calendar Layout

The Calendar page contains two primary sections:

## 1. Action Panel

Operational dashboard area containing:

- Greeting header
- Today section
- Suggested Actions section
- Upcoming section

This panel is intended to carry the primary day-to-day usability of the page.

---

## 2. Month Grid

A traditional month-view calendar used for:

- activity visualization
- temporal scanning
- status density overview
- date-based navigation

The grid is secondary to the Action Panel from a workflow perspective.

---

# Responsive Layout

## Wide Desktop / Landscape Tablet

Two-column layout:

```txt
[ Action Panel ] [ Month Grid ]
```

Recommended ratio:
- 40 / 60 split

---

## Narrow Desktop / Portrait Tablet

Stack vertically:

```txt
[ Action Panel ]
[ Month Grid ]
```

---

## Mobile

Stack vertically with:

- compact spacing
- reduced cell sizes
- bottom-sheet popovers
- simplified calendar interactions

The Action Panel should remain prioritized over the month grid on mobile.

---

# Greeting Header

The Action Panel begins with a contextual greeting area containing:

- Time-aware greeting
- Current date
- Lightweight conversational tone

Examples:
- Good morning
- Good afternoon
- Evening
- Welcome back

Greeting generation remains deterministic and local.

---

# Today Section

Displays Timeline events scheduled for the current day.

Examples:
- Interviews
- Technical assessments
- Recruiter calls
- Follow-ups
- Offer discussions

Rows should display:
- Application ID
- Activity title
- Company
- Role
- Open action

Rows open the Application Overlay when interacted with.

---

# Upcoming Section

Displays future Timeline activity.

Grouping:

- Tomorrow
- Rest of Week

Examples:
- Upcoming interviews
- Technical deadlines
- Follow-ups
- Scheduled recruiter discussions

Upcoming items are informational only and cannot be dismissed.

---

# Suggested Actions System

## Philosophy

Suggested Actions should feel:

- assistive
- operational
- lightweight
- non-judgmental

Avoid:
- alert-style warnings
- aggressive reminders
- productivity guilt
- emotionally loaded language

No AI/LLM integration is planned.

Suggestions remain:
- deterministic
- rule-based
- locally computed

---

# Suggested Actions Visibility Rules

Suggestions should only appear if they are:

- Newly triggered today
- Relevant today
- Relevant tomorrow

Older suggestions should automatically disappear to prevent panel overcrowding.

---

# Suggested Actions Suppression Rules

Suggestions should NOT appear if:

- A future Timeline entry already exists
- The application is in a terminal state
- The suggestion was previously dismissed

Dismissals should persist.

---

# Terminal Statuses

The following statuses are terminal:

- Accepted
- Rejected
- Withdrawn / Declined
- Ghosted

Terminal statuses suppress future suggestions.

---

# Suggestion Rules

## Applied

Trigger:
- Last activity = Applied
- No updates for >= 7 days

Suggestion:
```txt
Follow up with recruiter?
```

---

## Phone Screen

Trigger:
- Phone screen completed
- No updates for >= 5 business days

Suggestion:
```txt
Check interview feedback status?
```

---

## Interview

Trigger:
- Interview completed
- No updates for >= 7 days

Suggestion:
```txt
Consider sending a follow-up message
```

---

## Technical Assessment

Trigger:
- Assessment due today or tomorrow

Suggestion:
```txt
Technical assessment due tomorrow
```

---

## Offer

Trigger:
- Offer active
- Nearing expiry
- No accepted/rejected outcome

Suggestion:
```txt
Offer response may be needed soon
```

---

## Ghosted Suggestion

Trigger:
- No updates for >= 14 days
- No future Timeline entries
- Status not terminal
- Suggestion not previously dismissed

Suggested wording:

```txt
No updates for 14 days.
Would you like to mark this application as Ghosted?
```

Avoid:
- “You got ghosted”
- emotionally loaded language
- definitive assumptions

---

# Suggestion Actions

## Standard Suggestions

Primary action:
- Open Application Overlay

Secondary action:
- Dismiss suggestion

---

## Ghosted Suggestion

Actions:
- Mark Ghosted
- Dismiss

Archive is intentionally excluded from the suggestion surface.

---

# Mark Ghosted Behavior

When user selects:
## Mark Ghosted

Then:

1. Application status updates to `ghosted`
2. Timeline entry is automatically appended:

```txt
[Ghosted] Marked as ghosted after prolonged inactivity.
```

3. Changes persist immediately

No draft/save flow required.

---

# Calendar Month Grid

The month grid remains month-view only.

Week-view is explicitly out of scope for v1.

The grid should:

- Always render 6 weeks
- Use ISO Monday-start layout
- Include ISO calendar week numbers
- Respect responsive sizing rules

---

# Date Cell Behavior

Each date cell visualizes Timeline activity through compact status chips.

Example:

```txt
[Applied ×3]
[Interview ×1]
[Offer ×1]
```

Chips:
- Use tracker status colors
- Show activity counts only
- Do not contain status labels
- Display status labels through tooltips/popovers

---

# Chip Priority Order

Higher-priority statuses render first:

1. Accepted
2. Offer
3. Interview
4. Technical Assessment
5. Phone Screen
6. Wishlisted
7. Applied
8. Rejected
9. Withdrawn
10. Ghosted

---

# Cell Overflow

Maximum:
- 3 visible chips per cell

Overflow:
```txt
+N
```

Overflow interaction opens the day popover.

---

# Day Popover

Clicking:
- date cell
- overflow chip
- status chip

opens a day popover.

Two modes:

## All Activity Mode
Displays all activity for the day grouped by status.

---

## Status Mode
Displays activity filtered to the clicked status.

---

# Calendar Interactions

## Clicking Calendar Activity

Should:
- Open the Application Overlay
- Reuse the existing overlay system
- Optionally auto-focus Timeline

The Calendar never becomes its own editor.

---

# Status Filter

Add status filter support for the Month Grid.

Requirements:

- Filter only affects the grid
- Action Panel remains unaffected
- Filtered-out cells become visually muted instead of hidden

---

# Date Constraints

Supported year range:

- Minimum: 2020
- Maximum: Current year + 5

Navigation controls and pickers must respect these limits.

---

# Mobile Behavior

On mobile:

- Action Panel remains prioritized
- Popovers become bottom sheets
- Calendar cells shrink appropriately
- Chips become more compact
- Month grid remains readable

Potential future enhancement:
- collapsible Action Panel summary bar

This is out of scope for v1.

---

# Data Projection

Calendar activity should be derived from application Timeline entries.

Suggested projection model:

```ts
type DayActivity = {
  id: number
  title: string
  company: string
  status: StatusKey
}
```

Calendar data must never be manually edited directly.

---

# Persistence

Persist:

- Suggestion dismissals

Do not persist:
- current viewed month
- current viewed year
- active filters

These remain session-local.

---

# Accessibility

Requirements include:

- Keyboard-accessible cells and chips
- Escape-to-close popovers
- Screen-reader labels
- Non-color-only status communication
- Focus-visible states
- ISO week labels hidden from screen readers

---

# Out of Scope

The following are intentionally excluded from v1:

- Week view
- Drag-to-create events
- External calendar integrations
- AI-generated suggestions
- Timeline attachments
- Per-day notes
- Mobile collapsible summary bar
- URL-persisted filters
- Calendar-native CRUD flows

---

# Additional Notes

- The Calendar is intended to feel like an operational companion, not a productivity suite
- The Action Panel should carry most of the practical daily value
- The Application Overlay remains the single editing experience
- Suggestions should remain lightweight and respectful
- The Calendar should reinforce application momentum and workflow visibility without overwhelming the user