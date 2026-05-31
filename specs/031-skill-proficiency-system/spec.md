# Feature Specification: Skill Proficiency System

**Feature Branch**: `031-skill-proficiency-system`  
**Created**: 2026-05-31  
**Status**: Draft  
**Input**: Feature brief `docs/features/031-skill-proficiency-system.md` + design reference `docs/design/profile_page.md` (§4.4 Skills, §5 Skills editor, §7 Data Model)

## Problem Statement

Profile skills are stored as a flat list of strings (`skills: string[]`). A skill the user is expert in is indistinguishable from one they have only touched, so the profile cannot express *strength* — and a future compatibility engine has no weighting signal to consume. This feature adds a structured **1–5 proficiency level** to every skill, captured and edited manually by the user, persisted alongside the skill name, and displayed subtly on the profile. Existing profiles must keep working without data loss.

## Scope

**In scope**
- Capture a proficiency level (1–5) when a skill is added or edited.
- Persist each skill as a structured `{ name, level }` object.
- Display proficiency on the Profile page (per the design doc: graded meter rows, hover/tap reveal, scale popover, sort, collapse-past-10).
- Safely migrate legacy `string[]` skills on load so existing profiles render immediately.
- Enforce validation (level required before save, no blank names, no duplicate names, a maximum skill count).

**Non-goals** (carried from the brief)
- Skill endorsements, social/recruiter-facing ratings, gamification, or "expert badges".
- Skill testing, certification, or validation of claimed levels.
- AI-generated / auto-estimated proficiency.
- **Building the weighted compatibility calculation itself.** 031 makes the data *ready* for weighting (structured `{ name, level }`); the engine that consumes it is a later feature. There is no compatibility engine in the codebase today, and Profile-page Open Question #4 remains open.
- A feature flag / staged rollout. The migration is backward-compatible, so the change ships directly (no new flag dependency).

## User Behavior

The work lives entirely on the Profile page and its Edit/Setup form; no other page changes.

- **Editing** (`profile-edit`, §5 Skills editor): the Skills section is inline rows — a name field, a 1–5 level picker (five tappable segments), and a remove (×) control, plus an **Add skill** button. New rows start **unrated**. A `?` opens the proficiency-scale reference.
- **Viewing** (`Profile`, §4.4 Skills): each skill is its own row — name on the left, a 5-segment graded meter (filled to `level`) on the right. Hover/tap cross-fades the meter to the `"{level} · {Label}"` word in place. A `?` opens the scale popover; a sort control toggles Custom / By level; lists longer than 10 collapse behind **Show all {N} skills**.

### Proficiency scale (fixed)

| Level | Label        |
|-------|--------------|
| 1     | Beginner     |
| 2     | Basic        |
| 3     | Intermediate |
| 4     | Strong       |
| 5     | Expert       |

This scale is distinct from `LanguageEntry.proficiency` (Beginner / Intermediate / Professional / Fluent), which is unchanged.

## Clarifications

### Session 2026-05-31

- Q: When a skill is added via resume import, what proficiency level should it receive? → A: Unrated (`level: null`) — Save is gated until the user rates it; no auto-assignment (distinct from stored-data migration, which defaults to level 2 so existing users are never locked out).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assign and edit proficiency when managing skills (Priority: P1)

A user adds a skill in the profile editor and assigns how proficient they are; later they re-open the editor and adjust the level, rename, or remove it.

**Why this priority**: This is the core capability — without manual level capture there is no proficiency data. It is the minimum slice that delivers value.

**Independent Test**: In the profile editor, add a skill, set a level via the picker, save; reload the editor and confirm the level persists; change it, save, confirm again.

**Acceptance Scenarios**:

1. **Given** the Skills editor, **When** the user clicks "Add skill", **Then** a new blank, **unrated** row appears.
2. **Given** an unrated new skill row, **When** the user taps level segment `n` (1–5), **Then** the level is set to `n` and the caption reads `"{n} · {Label}"`.
3. **Given** a skill at level `n`, **When** the user taps the active segment `n` again, **Then** the level clears (back to unrated).
4. **Given** a skill with a name but no level, **When** the user attempts to save, **Then** Save is disabled, the row is flagged, and the footer reports the count of skills missing a level.
5. **Given** a saved skill, **When** the user edits its name or level and saves, **Then** the change persists; **When** the user removes it (×) and saves, **Then** it no longer appears.

### User Story 2 - See proficiency at a glance on the profile (Priority: P2)

A user views their profile and can read each skill's proficiency level without it feeling like a gamified dashboard.

**Why this priority**: Display makes the captured data useful to the user immediately. Depends on P1 data existing but is independently demonstrable.

**Independent Test**: With a profile containing rated skills, open the Profile page and confirm each skill renders a meter filled to its level, the hover/tap reveal shows the level word, and the scale popover lists all five levels.

**Acceptance Scenarios**:

1. **Given** a rated skill at level `n`, **When** the Profile renders, **Then** the meter fills exactly `n` of 5 segments in that level's colour.
2. **Given** a skill row, **When** the user hovers (desktop) or taps (mobile), **Then** the meter cross-fades to `"{level} · {Label}"` in place without the row reflowing; on tap it auto-reverts after 2.5s.
3. **Given** more than 10 skills, **When** the Profile renders, **Then** only the first 10 show, followed by a **Show all {N} skills** toggle.
4. **Given** the sort control, **When** the user selects "By level", **Then** skills order by level (repeat clicks toggle highest-first / lowest-first); "Custom" restores entry order.
5. **Given** the `?` control, **When** clicked, **Then** a popover lists all five levels with swatch, label, and flavor text; it closes on outside-click / Esc.

### User Story 3 - Existing profiles migrate safely (Priority: P3)

A user whose profile predates this feature opens the app and sees their skills intact, now showing a default proficiency they can re-rate.

**Why this priority**: Protects existing data (constitution: no silent corruption). Not needed for new users but required before release.

**Independent Test**: Load a profile whose stored `skills` is a `string[]`; confirm each renders as a named skill at level 2 (Basic) and is editable.

**Acceptance Scenarios**:

1. **Given** a stored profile with `skills: ["Jira", "Scrum"]`, **When** loaded, **Then** each normalises to `{ name, level: 2 }` and renders at Basic.
2. **Given** a migrated skill, **When** the user opens the editor, **Then** it shows as rated (level 2) and can be re-rated and saved.
3. **Given** a stored legacy skill string, or a stored skill object whose level is missing/out-of-range, **When** loaded, **Then** it normalises to the safe default (level 2) rather than being dropped. (Skills freshly added via resume import are handled separately — they arrive unrated; see FR-014.)

### Edge Cases

- **Duplicate names**: a second skill whose name matches an existing one (case-insensitive, whitespace-normalised) is **blocked** in the editor — flagged, and Save is gated — consistent with the existing resume-merge dedupe key.
- **Blank name**: a row with a blank name gates Save (existing behaviour: empty-name skills are not persisted).
- **Unrated on save**: any named skill without a level gates Save with a count of missing levels.
- **Too many skills**: saving is rejected when the skill count exceeds the maximum (see FR-009); the user is told to remove some.
- **Out-of-range / non-integer level** in a stored skill object: coerced to the nearest valid 1–5 integer; never persisted as-is. A `null` level is preserved as "unrated" (transient editor/import state), not coerced to a default.
- **Legacy mixed array** (some strings, some objects): each element normalises independently — bare strings migrate to level 2, objects keep their valid/coerced level.
- **Resume-imported skills**: arrive **unrated** (`level: null`), so the user must rate each before the next save (FR-014); the system never auto-assigns a level. An import that would push the total past the 50-skill maximum is blocked like a manual edit, and a duplicate of an existing skill is dropped (the existing level is kept) per the existing merge dedupe.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each skill MUST be stored as a structured object `{ name: string, level: 1|2|3|4|5 }`. `name` is required and non-blank.
- **FR-002**: Users MUST be able to assign a proficiency level (1–5) to a skill when adding it and change it later.
- **FR-003**: Newly added skills MUST start **unrated** (`level: null`); a profile MUST NOT be savable while any named skill is unrated.
- **FR-004**: The system MUST reject saving a profile that contains a skill with a blank name.
- **FR-005**: The system MUST prevent duplicate skill names within a profile, compared case-insensitively with collapsed whitespace.
- **FR-006**: On load, the system MUST migrate legacy `skills: string[]` elements to `{ name, level: 2 }` (**Basic**) so existing data renders without loss; persisted skill names MUST be preserved exactly. A stored skill object with an out-of-range/non-integer level is coerced to the nearest valid level; a `null` level is preserved as "unrated" (transient editor/import state), not defaulted.
- **FR-007**: The Profile page MUST display each skill's level via a non-color-only indicator (a graded meter plus a textual `"{level} · {Label}"` reveal and accessible label), with a reference to the full scale.
- **FR-008**: The skill editor and display MUST be operable by keyboard and labeled for assistive tech (skill rows are real buttons with `aria-label="{name}: {Label}, level {n} of 5"`; level pickers are reachable/operable).
- **FR-009**: The system MUST reject saving when the number of skills exceeds the maximum of **50**, with a clear user-facing message; counts at or below 50 save normally.
- **FR-010**: Proficiency capture MUST remain fully manual — the system MUST NOT auto-generate, estimate, or infer levels.
- **FR-011**: The structured skill data MUST be persisted identically across all runtime modes (local SQLite, hosted Supabase, demo) since skills live in the profile JSON blob; no database schema change is required.
- **FR-012**: The feature MUST NOT introduce a compatibility-scoring calculation; it only produces the weighted-ready `{ name, level }` data for a later consumer.
- **FR-013**: Validation logic for skill level, blank names, duplicates, and the maximum count MUST be centralized in the shared profile model and covered by automated tests.
- **FR-014**: Skills added via resume import MUST arrive **unrated** (`level: null`); the system MUST NOT auto-assign or estimate their level. Imported skills are then subject to the same Save gating as manual ones (unrated, blank-name, duplicate, and 50-skill-maximum rules); a duplicate of an existing skill is dropped with the existing skill's level preserved, and an import that would exceed the maximum is blocked.

### Key Entities *(include if feature involves data)*

- **SkillEntry**: a single profile skill. `name` (required, non-blank, unique within the profile) and `level` (integer 1–5; `null` only transiently in the editor before save). Stored inside the existing `Profile.skills` array (JSON blob). Replaces the prior `string` element type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a skill and assign its level in under 10 seconds, with no separate modal.
- **SC-002**: 100% of pre-existing profiles load with their skills intact (zero dropped skills) after migration, each shown at Basic by default.
- **SC-003**: Every skill on the Profile page communicates its level without relying on color alone (meter + word + accessible label), verifiable by keyboard-only and screen-reader walkthrough.
- **SC-004**: It is impossible to save a profile with an unrated skill, a blank skill name, a duplicate skill name, or more than 50 skills — each is blocked with a specific message.
- **SC-005**: Stored skills are structured `{ name, level }` ready for weighted consumption, with no scoring logic shipped in this feature.

## Assumptions

- The profile system, skill persistence, and the Profile/Edit pages already exist; this feature evolves the `skills` field and its UI only.
- Skills are persisted as part of the profile JSON blob (`data` column) in both SQLite and Supabase, so migration is a normalise-on-load concern with no schema migration.
- The 1–5 scale and its labels are fixed for this feature and shared between editor and display.
- The maximum of 50 skills is a guard against pathological lists; the design doc's "collapse past 10" handles ordinary long-list display.
- A compatibility engine will consume `level` later; its design is out of scope here.
- Profile data remains private and local-first; this feature adds no external service or tracking.
