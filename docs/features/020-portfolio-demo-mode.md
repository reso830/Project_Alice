# Feature Brief — 020-portfolio-demo-mode

## Summary
Add a public interactive demo mode for Project Alice that allows visitors to explore and interact with the application without creating an account.

Demo mode should feel realistic and interactive while remaining fully non-persistent.

---

## Goals
- Allow public visitors to explore the application interactively.
- Preserve privacy and hosted data isolation.
- Prevent demo interactions from persisting to Supabase.
- Showcase the product effectively as a portfolio/demo experience.

---

## Scope

### Demo Dataset
Public visitors should receive seeded demo data including:
- Sample applications
- Example statuses
- Sample profile information
- Representative UI states

Goals:
- Demonstrate realistic usage
- Avoid empty states
- Showcase major features visually

---

## Interactive Demo Behavior
Visitors should be able to:
- Create/edit applications
- Archive/unarchive applications
- Change statuses
- Edit profile information
- Use filters and sorting
- Navigate normally through the app

Requirements:
- Interactions should feel fully functional.
- Demo behavior should not appear read-only.

---

## Non-Persistent Session Behavior
Demo changes must never persist to Supabase.

Requirements:
- Demo state should remain session-only.
- Session reset strategy should be defined clearly.
- Refresh/reset behavior should feel intentional rather than broken.

Potential reset strategies:
- reset on browser refresh
- reset on tab close/session expiration
- reset on explicit demo reset action

Final strategy should be defined during implementation planning.

---

## Demo Isolation
Requirements:
- Demo users should never access real hosted user data.
- Demo sessions should remain isolated from authenticated accounts.
- Demo behavior should not leak into authenticated persistence flows.

---

## Resume Import Restrictions
Resume import functionality should be:
- hidden
or
- disabled with clear messaging

for demo/public users.

Requirements:
- Demo users should not access hosted parsing endpoints.
- UI messaging should explain authentication requirements cleanly.

---

## UX Expectations

### Public Portfolio Experience
The demo should:
- feel polished
- feel interactive
- showcase core functionality quickly
- avoid requiring signup for exploration

### Authenticated Experience
Signed-in users should still:
- use persistent hosted data
- retain their saved changes
- access resume import

---

## Non-Goals
Out of scope:
- Public account creation
- Demo save/export functionality
- Shared collaborative demos
- Analytics/tracking systems
- Persistent anonymous accounts

---

## Validation And Testing
Include:
- Demo session lifecycle tests
- Demo reset behavior tests
- Persistence isolation tests
- Resume import restriction tests
- Authenticated vs demo routing tests
- Browser refresh/session handling tests

---

## Acceptance Criteria
- Public visitors can explore the app interactively.
- Demo interactions never persist to Supabase.
- Demo sessions reset according to the defined strategy.
- Demo users cannot access protected hosted functionality.
- Resume import is unavailable in demo mode.
- Authenticated users still receive persistent behavior.