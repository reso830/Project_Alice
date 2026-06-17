# Feature Specification: Compatibility Insights Panel

**Feature Branch**: `037-compatibility-insights-panel`  
**Created**: 2026-06-17  
**Status**: Draft  
**Input**: Feature brief `docs/features/037-compatibility-insights-panel.md`. Design reference `docs/design/application_overlay.md` §14. Consumes compatibility scores from Feature 036. Depends on skill proficiency data from Feature 032 and structured JD data from Feature 035.

---

## Clarifications

### Session 2026-06-17

- Q: What should trigger notes staleness — any application save, only compat-relevant field changes + any profile change, or only when the score value changes? → A: **Option B** — only compat-relevant application fields (`skills`, `preferredSkills`, `responsibilities`, `jobTitle`, `minYearsExperience`) plus any profile change.
- Q: In Create mode, how should the Generate notes button appear before the application has been saved (has no ID)? → A: **Option B** — visible but disabled, with hint text *"Save the application first"*.
- Q: Should the AI prompt include the computed score and tier as grounding context? → A: **Option A** — full context: score, tier, resolved skill match results (`proficient`/`learning`/`missing`), JD data, and relevant profile data.
- Q: What copy should the stale bar show when triggered by a compat-relevant application field change (not profile)? → A: **Option A** — single generic message: *"Your profile or job data changed after these notes were written. The score above is current — refresh the notes to match."*

---

## Problem Statement

The existing compatibility surface in the Application Edit Modal is a two-piece placeholder: a read-only `CompatBar` showing a percentage and a free-text `compatNotes` textarea. The bar conveys the score as a raw number with no context; the textarea is a manual, unstructured field with no connection to actual profile or job data.

Users cannot tell *why* a score was assigned, which skills they have or lack, or how current any notes are. Feature 036 introduced a deterministic, meaningful score — but that score remains unexplained. This feature replaces the existing bar + textarea with a unified **Compatibility Insights Panel**: a collapsible module that presents the live deterministic score, profile-aware skill proficiency indicators, and optionally AI-generated analysis, each with clearly communicated freshness.

---

## Scope

**In scope**

- **Compatibility module** (body row 7): full-width, collapsible section replacing the existing `CompatBar` and `compatNotes` textarea, rendered inside the Application Edit Modal in both Edit and Create modes.
- **Score presentation**: ring visualization, tier-colored verdict pill, headline summary — always live from the 036-computed `compat` value.
- **Skill proficiency indicators** (body row 6): upgrade the existing plain-text skill chips (Required Skills, Preferred Skills) to profile-aware proficiency-coded chips (`proficient` / `learning` / `missing`) with a legend.
- **AI-generated compatibility analysis**: headline + prose generated on demand; displayed inside the expanded module with freshness state.
- **Notes lifecycle management**: `none`, `generating`, `fresh`, `stale`, `error` states — each with a dedicated UI.
- **Manual generation and refresh**: users trigger notes generation; notes never auto-regenerate.
- **Staleness tracking**: notes become stale when a compat-relevant application field or the profile has changed since `notes.generatedAt` (triggering a 036 score recompute that stamps `compat_scored_at`); non-compat fields (URL, General Notes, recruiter) do not cause staleness; the score remains live regardless.
- **Empty and unavailable states**: `no-profile` (score unavailable) and `no-analysis` (score present, no notes yet).
- **Responsive layout**: desktop, tablet, and mobile/bottom-sheet.
- **New backend route**: `POST /api/applications/:id/compat-notes` for AI notes generation.
- **New data column**: `compat_analysis TEXT` (JSON) on the applications table; `compat_notes` retired (nulled, not removed).

**Non-goals**

- Changes to the compatibility scoring algorithm (owned by 036).
- Career coaching, resume rewriting, salary advice, interview preparation.
- Conversational AI assistance.
- User-editable compatibility scores or AI-generated analysis.
- ATS / resume quality checks (038).
- Semantic or fuzzy skill matching for proficiency resolution (v1 is normalized-exact, same rule as 036).
- A user-facing configuration for AI prompts or model selection.

---

## Compatibility Philosophy

The panel is informational, not prescriptive. Scores indicate broad alignment; they do not determine whether a user should apply. Low scores with strong experience signals and high scores with sparse data are both normal and should not discourage or guarantee action. The deterministic score is authoritative; AI notes exist to explain it.

---

## User Scenarios & Testing

### User Story 1 — See score and skills at a glance (Priority: P1)

A user opens an application and immediately sees the compatibility score, tier label, and proficiency-coded skill chips without needing to expand anything.

**Why this priority**: The collapsed module and row-6 chips are always visible. This is the minimum viable compatibility surface for every user on every application — no AI, no expansion required.

**Independent Test**: Open an application with a computed score and profile skills. Confirm the collapsed module shows the mini ring with the correct score, a tier-colored verdict label, and the row-6 skill chips showing `✓ / ● / ✕` coded correctly against the profile. Verify without expanding the module.

**Acceptance Scenarios**:

1. **Given** an application with `compat = 72`, **When** the modal opens, **Then** the collapsed module displays `72` in the mini ring and the label **"High match"** in the High tier color.
2. **Given** score boundaries (39, 40, 64, 65, 84, 85), **When** rendered, **Then** labels are Low / Medium / Medium / High / High / Great respectively.
3. **Given** a required skill present on the profile with rating ≥ 3, **When** the skill chip renders, **Then** it shows `✓` with the proficient style.
4. **Given** a required skill present on the profile with rating < 3, **When** rendered, **Then** chip shows `●` with the learning style.
5. **Given** a required skill absent from the profile entirely, **When** rendered, **Then** chip shows `✕` with the missing style.
6. **Given** both required and preferred skills on an application, **When** rendered, **Then** a legend below the skill columns identifies `✓ Proficient`, `● Learning`, `✕ Missing`.
7. **Given** fit is displayed, **When** inspected, **Then** level is communicated via number + text label — not color alone.

---

### User Story 2 — Expand for full context (Priority: P1)

A user expands the module to read the score visualization, skill breakdown detail, and any existing AI analysis.

**Why this priority**: The expanded view is the primary way users access the explanation layer. Depends on US1 rendering the collapsed state correctly.

**Independent Test**: Click Expand on the module. Confirm the full score ring (64px), verdict pill, any existing notes headline and body, skill sections, and the expand/collapse toggle all render correctly. Click Collapse and confirm the module returns to the compact state.

**Acceptance Scenarios**:

1. **Given** the collapsed module, **When** the user clicks "Expand", **Then** the panel opens showing the full score ring, verdict pill, and — if notes exist — the notes headline and body.
2. **Given** the expanded panel, **When** the user clicks "Collapse", **Then** the panel returns to the compact bar.
3. **Given** the module starts collapsed by default, **When** the modal opens, **Then** the module is collapsed; the user must explicitly expand it.
4. **Given** AI notes in `fresh` state, **When** the notes body exceeds ~3 lines, **Then** it is clamped with a "Show more" toggle; clicking it reveals the full body.

---

### User Story 3 — Generate AI analysis (Priority: P2)

A user with no existing notes sees a prompt inside the expanded module and chooses to generate an AI-written analysis.

**Why this priority**: Notes generation is user-driven and optional. Score and skills (US1/US2) are available regardless. This adds the explanation layer.

**Independent Test**: Open an application where `compat_analysis` is null. Expand the module. Confirm the `none` state prompt is visible with a "✦ Generate notes" button. Click it, confirm the `generating` skeleton appears, and — on success — confirm the notes transition to `fresh` with a headline and prose body.

**Acceptance Scenarios**:

1. **Given** no existing analysis (`compat_analysis` null), **When** the module is expanded, **Then** the `none` state renders a dashed-border prompt: *"No written analysis yet. Generate notes to explain this score and surface gaps."* with a **✦ Generate notes** button.
2. **Given** the user clicks Generate notes, **When** the LLM call is in flight, **Then** the `generating` skeleton replaces the prompt (spinner + "Writing analysis…" + shimmer lines); the score block remains visible above.
3. **Given** successful generation, **When** notes arrive, **Then** the state transitions to `fresh` — headline, prose, and meta footer (generated date + Regenerate button) render correctly.
4. **Given** notes exist in `fresh` state, **When** the user clicks "↻ Regenerate", **Then** a new generation cycle begins and the result replaces the prior notes.
5. **Given** notes are never generated automatically, **When** the application is opened or the modal is re-opened, **Then** no LLM call is triggered without user action.
6. **Given** the modal is in Create mode (application not yet saved), **When** the module is expanded, **Then** the Generate notes button is visible but disabled with hint *"Save the application first"*.

---

### User Story 4 — Recognize and refresh stale notes (Priority: P2)

After changing profile or application data, a user is shown that their existing notes are outdated and can choose to refresh them.

**Why this priority**: Stale notes mislead users about their current fit. The score is always live; this story ensures the notes state clearly communicates when they're behind.

**Independent Test**: Generate fresh notes. Then change a skill on the profile (or edit the application's responsibilities) and save. Reopen the modal. Confirm the stale bar appears, notes prose is dimmed, the score ring still shows the current value, and "↻ Refresh notes" generates new content.

**Acceptance Scenarios**:

1. **Given** `fresh` notes, **When** the user saves a profile change after the notes' `generatedAt`, **Then** the notes transition to `stale` on next modal open.
2. **Given** `fresh` notes, **When** the user saves an application data change after the notes' `generatedAt`, **Then** the notes transition to `stale`.
3. **Given** `stale` notes, **When** the module is expanded, **Then** an amber stale bar appears: *"Your profile or job data changed after these notes were written. The score above is current — refresh the notes to match."* with a **↻ Refresh notes** button.
4. **Given** `stale` notes, **When** the user clicks Refresh notes, **Then** a new generation cycle begins and on success transitions to `fresh`.
5. **Given** `stale` notes, **When** the collapsed state is shown, **Then** the headline is dimmed and an amber **"● Update available"** marker appears.
6. **Given** the score is live and notes are stale, **When** displayed, **Then** the score ring still shows the current computed value — notes staleness does NOT affect score display.

---

### User Story 5 — Handle AI failure gracefully (Priority: P2)

AI generation fails; the user sees a retryable error — the score and skills remain fully available.

**Why this priority**: AI failures must never block core compatibility tracking. Score + skills must work with AI unavailable.

**Independent Test**: Simulate a failed LLM call (network off or API error). Click Generate notes. Confirm the `error` state renders with a retry button and that the score ring and skill chips remain fully interactive.

**Acceptance Scenarios**:

1. **Given** a failed generation attempt, **When** the LLM call returns an error, **Then** the notes region shows the `error` state: *"Couldn't write the analysis. The score above is unaffected."* with a **↻ Try again** button (red-tinted bar).
2. **Given** the `error` state, **When** the user has not retried, **Then** the score ring, verdict pill, and skill chips all remain fully visible and readable.
3. **Given** the `error` state, **When** the user clicks Try again, **Then** the flow re-enters `generating` and proceeds to `fresh` or `error` based on the result.
4. **Given** AI is unavailable, **When** the modal opens, **Then** the modal opens normally — AI failure is never a modal-blocking error.

---

### User Story 6 — No-profile state (Priority: P3)

A user with insufficient profile data sees the module in a dormant state with a prompt to complete their profile.

**Why this priority**: The module must always render — never hidden — even when it cannot function. This is the graceful degradation path.

**Independent Test**: Open the app with an effectively empty profile (no skills, no experience, no summary). Open any application. Confirm the module shows the "Compatibility unavailable" state with a "Complete profile →" link and no score ring or notes.

**Acceptance Scenarios**:

1. **Given** a profile with insufficient data to compute a score, **When** the modal opens, **Then** the module renders in the `no-profile` state: title **"Compatibility unavailable"**, sub-copy *"Add your profile so Alice can score how well you match this role."*, **Complete profile →** action.
2. **Given** the `no-profile` state, **When** rendered, **Then** the module has no Expand/Collapse toggle (nothing to expand) and no score ring.
3. **Given** the `no-profile` state, **When** the AI tag renders, **Then** it appears dimmed (`opacity: .5`) — AI analysis is not available in this state.

---

### Edge Cases

- **Empty profile**: module renders `no-profile` state; no score ring, no skill chips to resolve.
- **Sparse profile** (some data, but no skills matching the JD): score renders (likely Low); all skill chips show `missing`; `none` notes state is shown.
- **Very short or empty JD** (no skills extracted, no responsibilities): score is 0 (Low per 036 FR-015); skill chip lists are empty (no chips to render); notes generation is still available.
- **Large skill lists**: chip containers wrap; scroll behavior governed by the modal body scroll, not the module itself.
- **Notes generated on sparse data then profile filled out**: notes immediately transition to `stale`; score updates live; stale bar appears on next open.
- **Notes generated on a high score then skills removed**: notes become stale; score drops; user sees current (lower) score alongside the old optimistic prose (clearly stale).
- **Low score with strong experience signals**: module renders the Low score honestly; AI notes may call out strengths that don't appear in the deterministic score. This is expected and acceptable.
- **High score with sparse profile**: score renders; notes (if generated) may surface the thinness of the profile data as a gap. Notes add nuance; the score remains authoritative.
- **LLM returns `summary` > 34 characters**: the UI truncates via CSS single-line ellipsis — never wraps.
- **Concurrent generation requests**: second click while `generating` is in flight is a no-op (button disabled during generation).
- **Archived applications**: score is displayed read-only; Generate/Refresh/Regenerate buttons are hidden (archived mode is read-only per §12).
- **Create mode (new application)**: module renders; score is 0 until the application is saved for the first time and the engine runs. The Generate notes button is visible but disabled with hint text *"Save the application first"*; it becomes active after the application is saved and has an ID.
- **`compat_analysis` contains malformed JSON**: treated as null (notes state = `none`); no error surfaced to the user.

---

## Requirements

### Functional Requirements

**Module**

- **FR-001**: The Compatibility module SHALL replace the existing `CompatBar` component and the `compatNotes` textarea in the Application Edit Modal.
- **FR-002**: The module SHALL render in both Edit and Create modes of the modal.
- **FR-003**: The module SHALL be collapsed by default on modal open.
- **FR-004**: The module SHALL support Expand and Collapse states toggled by a single right-aligned control.
- **FR-005**: The compatibility score SHALL always be visible in the collapsed state (mini ring + verdict label).

**Score presentation**

- **FR-006**: The score SHALL be read-only and sourced from the persisted `compat` value (never user-editable).
- **FR-007**: The module SHALL derive the tier label from the score using fixed bands: Low 0–39, Medium 40–64, High 65–84, Great 85–100.
- **FR-008**: The score ring, verdict pill, and tier coloring SHALL follow the normative ramp defined in `docs/design/application_overlay.md` §14.4.
- **FR-009**: The score SHALL always display the current live value. It SHALL NOT be hidden or dimmed when notes are stale or absent.

**Skill proficiency indicators**

- **FR-010**: Required Skills and Preferred Skills chips SHALL be resolved against the user's profile at render time and displayed with proficiency states: `proficient` (rating ≥ 3), `learning` (rating < 3), `missing` (not on profile).
- **FR-011**: Resolution SHALL use normalized-exact matching (case-insensitive, whitespace-collapsed) — no fuzzy matching.
- **FR-012**: A legend SHALL be rendered below the skill columns identifying the three states.
- **FR-013**: Proficiency coding SHALL apply identically to Required and Preferred skill chips.

**Notes lifecycle**

- **FR-014**: The module SHALL support five notes states: `none`, `generating`, `fresh`, `stale`, `error`.
- **FR-015**: Notes SHALL NOT be generated automatically on modal open, on save, or on any data change. Generation MUST be user-initiated.
- **FR-016**: Notes SHALL transition to `stale` when the compatibility score has been recomputed after `notes.generatedAt` — i.e. `notes.generatedAt < application.compat_scored_at`. Because 036 recomputes on every compat-relevant field change (application or profile), staleness propagates naturally through that event. Unrelated application edits (General Notes, URL, recruiter) do not trigger a score recompute and therefore do not trigger staleness.
- **FR-017**: The score SHALL update independently of notes. Notes staleness SHALL NOT affect score display.
- **FR-018**: Stale notes SHALL display an amber stale bar with the copy: *"Your profile or job data changed after these notes were written. The score above is current — refresh the notes to match."* The bar SHALL also include a **↻ Refresh notes** action. A single generic message is used regardless of whether a profile change or a compat-relevant application field change triggered staleness.
- **FR-019**: The user SHALL be able to generate (first time), regenerate (replace existing fresh notes), and refresh (replace stale notes). All three produce a new AI call.
- **FR-020**: During generation, a skeleton state SHALL be shown in the notes region; the score block SHALL remain visible above it.
- **FR-021**: On generation failure, the `error` state SHALL render with a retryable "↻ Try again" action. The error SHALL NOT block the score, skill chips, or any other field in the modal.
- **FR-022**: Fresh notes prose SHALL be clamped to ~3 lines with a Show more / Show less toggle.

**Backend**

- **FR-023**: A new route `POST /api/applications/:id/compat-notes` SHALL be introduced for AI notes persistence. The LLM call is made **client-side** (consistent with 035/033); the route SHALL accept `{ summary: string, body: string }` from the client, validate the values, add a server-set `generatedAt` timestamp, and persist to `compat_analysis`. The route SHALL NOT call OpenRouter or any LLM provider.
- **FR-024**: The route SHALL return the persisted `CompatNotes` object: `{ summary: string, body: string, generatedAt: string }`.
- **FR-025**: On success, the route SHALL persist the result in the new `compat_analysis` column (JSON-encoded) and return it to the client. `generatedAt` is always server-set; any client-supplied value SHALL be ignored.

**Data**

- **FR-026**: A new `compat_analysis TEXT` column SHALL be added to the applications table (SQLite + Supabase). It stores a JSON-encoded `CompatNotes` or `null`.
- **FR-027**: The existing `compat_notes TEXT` column SHALL be retired: its value is nulled for all rows during migration and the field is removed from the writable API surface. The column is NOT dropped (additive-only migration policy).
- **FR-028**: `compat_analysis` SHALL persist at parity across local SQLite, hosted Supabase, and demo (in-memory) modes.

**AI generation quality**

- **FR-029**: The AI prompt SHALL include the computed score, tier label, resolved skill match results (each skill with its `proficient`/`learning`/`missing` state), relevant JD fields (`jobTitle`, `responsibilities`, `skills`, `preferredSkills`, `minYearsExperience`), and relevant profile fields (`skills` with ratings, `experience` roles, `summary`). The prompt SHALL ground the model on the deterministic score so the generated prose is consistent with — and explains — the number rather than independently assessing fit. The prompt SHALL encourage concise, practical analysis (strengths, gaps, alignment observations) and SHALL NOT request career advice, hiring predictions, application recommendations, or speculative claims.
- **FR-030**: The generated `summary` SHALL be constrained to ≤ 34 characters (enforced both in the prompt and by UI truncation as a safety net).

**Responsive / accessibility**

- **FR-031**: All module functionality SHALL be available on desktop (≥ 640px) and mobile bottom-sheet (< 640px) viewports.
- **FR-032**: Compatibility level SHALL be communicated via number + text (not color alone).
- **FR-033**: The module and skill chips SHALL support keyboard navigation within the modal's existing focus trap.

**Constitution**

- **FR-034**: AI generation costs SHALL be minimized by strictly user-driven triggers; no background or automatic AI calls are permitted.
- **FR-035**: AI failures SHALL never block application management workflows (save, edit, archive, create).

---

### Key Entities

- **CompatNotes** — `{ summary: string (≤ 34 chars), body: string, generatedAt: ISO string }`. Stored as JSON in `compat_analysis`. `null` = notes have never been generated.
- **SkillMatch** — `{ name: string, level: 'proficient' | 'learning' | 'missing' }`. Derived at render time from the application's `skills` / `preferredSkills` arrays resolved against `profile.skills`. Not stored.
- **NotesState** — `'none' | 'generating' | 'fresh' | 'stale' | 'error'`. Derived UI state; not stored.
- **CompatAvailability** — `'scored' | 'no-profile'`. Derived from whether the profile has sufficient data to compute a score.

---

## Data Considerations

- **New column `compat_analysis TEXT`**: added to `applications` in both SQLite (`ensureColumn`) and Supabase (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Default `null`. Stores JSON-encoded `CompatNotes` or `null`.
- **New column `compat_scored_at TEXT`**: ISO timestamp written by 036's recompute path on every score computation. Default `null` (pre-036 rows). Used as the staleness signal: `notes.generatedAt < compat_scored_at → stale`. To be backfilled for existing rows during 037's migration (set to `created_at` as a safe default for rows that were scored by 036).
- **Retired column `compat_notes TEXT`**: existing values nulled during migration. Column stays in schema (additive-only policy) but is removed from `INSERTABLE_COLUMNS`, `FIELD_TO_COLUMN`, `toRecord`, `toRow`, and the writable Zod schema. The "Compat Notes" inline text editor is removed from the modal.
- **Staleness detection**: notes go stale via a one-way cascade — any compat-relevant change triggers 036 to recompute the score, and that recompute event is what marks notes stale. 037 does NOT independently monitor which application fields changed. Instead, 036 stamps a `compat_scored_at` timestamp on every recompute (a new field alongside `compat`); 037's staleness check is then simply `notes.generatedAt < application.compat_scored_at`. Profile changes are already captured because 036 recomputes all active applications on profile save (036 FR-009). `application.updated_at` is NOT used for staleness. The `compat_scored_at` field is to be introduced in this feature's data migration and kept in sync by 036's recompute path.
- **SkillMatch resolution**: resolved on the client at render time from `application.skills`, `application.preferredSkills`, and the profile's skill array (already available in the app context for the compatibility module). Not persisted.
- **Score source**: `application.compat` — unchanged from 036. The module reads it directly; no new field needed for the score.
- **AI context for generation**: prompt context is assembled **client-side** in `compatNotesService.js` — the modal already holds the full application and profile objects. Context includes: computed `compat` score and derived tier label, resolved skill match results (each skill resolved to `proficient`/`learning`/`missing` against the profile), application JD fields (`jobTitle`, `responsibilities`, `skills`, `preferredSkills`, `minYearsExperience`), and profile fields (`skills` with ratings, `experience[].role`, `summary`). The score and tier are included so the model explains the deterministic result rather than independently re-assessing fit. The backend route only receives the generated `{ summary, body }` text — it does not assemble context or call any LLM. No new fields required beyond what 036 and 032 already produce.
- **Demo mode**: `compat_analysis` stored in-memory on the demo application object at parity with local/hosted.

---

## Success Criteria

- **SC-001**: Users can see the compatibility score and verdict without expanding the module or scrolling.
- **SC-002**: Skill chips in row 6 accurately reflect each skill's proficiency state against the current profile, verified by adding/removing a skill on the profile and reopening the modal.
- **SC-003**: Notes are never generated without an explicit user action — confirmed by opening the modal, waiting, and observing no network call to the notes endpoint.
- **SC-004**: After profile or application data changes, notes transition to `stale` on next modal open and the stale bar communicates the reason clearly.
- **SC-005**: An AI generation failure leaves the score, skill chips, and all other modal fields fully functional.
- **SC-006**: All module states (none, generating, fresh, stale, error, no-profile) render correctly and no state is reachable without the expected trigger.
- **SC-007**: The module renders and functions correctly on a mobile viewport (< 640px) bottom-sheet layout.

---

## Assumptions

- Feature 036 (Compatibility Engine) is merged and the `compat` field on every active application holds a real computed score before 037 ships.
- Feature 032 (Profile Skill Ratings) is merged; `profile.skills` includes `{ name, level: 1–5 }` entries.
- Feature 035 (LLM JD Parser) is merged; applications have structured `skills`, `preferredSkills`, `jobTitle`, `responsibilities`.
- The user's AI provider is already configured (same settings surface as 035); if no provider is configured, the Generate button is locked with an "Enable AI in Settings →" prompt (same pattern as the Smart Entry gate in §13.1).
- `application.updated_at` and `profile.updated_at` are maintained on every save operation — both confirmed in the current schema.
- `compat_analysis` is not user-editable via the standard PATCH route and is not accepted in application create/update payloads. It is written only by the dedicated `POST /api/applications/:id/compat-notes` route, which receives `{ summary, body }` generated client-side and adds `generatedAt` server-side.
- Archived mode is read-only (§12); no Generate/Refresh/Regenerate actions appear in archived mode.
