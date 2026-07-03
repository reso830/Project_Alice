# Alice Roadmap

> Canonical product roadmap and development direction for Project Alice.

---

# Vision

Alice is an AI-assisted Job Hunt OS focused on reducing the friction, mental overhead, and operational complexity of job hunting while keeping users in control of their decisions.

Core philosophy:
- AI assists, users decide
- Practical workflows over AI hype
- Transparency over black-box automation
- Human review before persistence
- Operational clarity and consistency

---

# Product Direction

Alice is evolving through four major phases:

| Version | Theme | Status |
|---|---|---|
| 1.0.0 | Operational Core | ✅ Shipped (2026-05-29) |
| 2.0.0 | Smart Intake & AI Assistance | 🚧 In progress |
| 3.0.0 | Preference & Insight Engine | Planned |
| 4.0.0 | Job Hunt OS | Planned |

---

# 1.0.0 — Operational Core  ·  ✅ Shipped (2026-05-29)

> Track and manage the job hunt.

## Goals
- Establish stable tracking workflows
- Support hosted persistence
- Build operational foundations
- Create a polished application lifecycle

## Features
- [x] 001-app-tracker-ui
- [x] 002-backend-persistence
- [x] 005-pagination-footer
- [x] 006-quick-filter-sort
- [x] 007-profile-page
- [x] 008-edit-profile-full
- [x] 009-profile-page-refinement
- [x] 010-tracker-ux-refinement
- [x] 012-inline-edit-overlay
- [x] 013-application-smart-parser
- [x] 014-resume-parser-profile
- [x] 015-application-state-machine
- [x] 017-hosted-foundation
- [x] 018-auth-user-access
- [x] 019-supabase-persistence
- [x] 020-portfolio-demo-mode
- [x] 021-hosted-resume-import-security
- [x] 022-deployment-polish-docs
- [x] 025-application-timeline
- [x] 026-calendar
- [x] 028-archive-applications-view
- [x] 029-loading-async-states
- [x] 030-delete-profile-data

---

# 2.0.0 — Smart Intake & AI Assistance

> Reduce job-hunt friction.

## Goals
- Improve AI-assisted workflows
- Reduce manual data entry
- Improve parsing quality and trust
- Expand compatibility intelligence

## Features
- [x] 031-skill-proficiency-system  ·  shipped v1.1.0
- [x] 032-profile-schema-refactor  ·  shipped v1.2.0
- [x] 033-llm-resume-cv-parser  ·  shipped v1.3.0
- [x] 034-profile-page-refresh  ·  shipped v1.4.0
- [x] 035-llm-jd-parser  ·  shipped v1.5.0
- [x] 036-compatibility-engine  ·  shipped v1.6.0
- [x] 037-compatibility-insights-panel  ·  shipped v1.7.0
- [x] 038-ai-provider-abstraction  ·  shipped v1.7.1
- [x] 039-desktop-workspace-refresh  ·  shipped v1.8.0
- [x] 040-portable-distribution-package  ·  shipped v1.9.0
- [x] 041-self-update-support  ·  shipped v1.10.0
- [ ] 042-welcome-brand-refresh
- [ ] 043-legal-and-footer

---

# 3.0.0 — Preference & Insight Engine

> Help users evaluate opportunities.

## Goals
- Support personalized decision-making
- Introduce preference-aware insights
- Improve operational visibility
- Expand analytics capabilities

## Features
- [ ] 044-preference-engine-foundation
- [ ] 045-ats-resume-quality-checks
- [ ] 046-role-based-salary-preferences
- [ ] 047-shift-setup-employment-preferences
- [ ] 048-salary-match-indicators
- [ ] 049-preference-based-compatibility
- [ ] 050-analytics-dashboard-foundation
- [ ] 051-funnel-response-analytics
- [ ] 052-source-platform-insights
- [ ] 053-compatibility-analytics
- [ ] 054-role-skill-insights (incl. #60 standardized skill names — data foundation)
- [ ] 055-activity-analytics
- [ ] 056-suggested-actions-engine
- [ ] 057-ghosting-detection-suggestions

---

# 4.0.0 — Job Hunt OS

> A personalized operational system for job hunting.

## Goals
- Improve onboarding and product guidance
- Strengthen product identity
- Expand intelligent workflow support
- Improve long-term usability

## Features
- [ ] 058-new-user-onboarding
- [ ] 059-contextual-first-time-hints
- [ ] 060-about-page-philosophy
- [ ] 061-local-privacy-processing-mode
- [ ] 062-job-hunt-os-polish

---

# Guiding Principles

## AI Assists, Users Decide
Alice should support decision-making, not replace it.

The system may:
- suggest
- analyze
- summarize
- highlight mismatches

But users remain in control of:
- applications
- career choices
- final decisions

---

## Human Review Before Persistence
AI-generated or AI-parsed information should not be silently persisted without user review.

---

## Transparency Matters
Users should understand:
- when AI is being used
- when third-party processing may occur
- what information is stored
- what information is temporary

Manual alternatives should remain available where possible.

---

## Practical Over Hype
Alice prioritizes:
- operational clarity
- useful workflows
- grounded insights
- realistic UX

over:
- fake precision
- excessive gamification
- black-box automation
- AI hype features

---

# Notes

- This roadmap is directional, not contractual.
- Feature ordering may evolve as implementation progresses.
- Smaller polish or maintenance tasks may exist outside this roadmap.
- Future versions may be adjusted based on product direction and technical constraints.
