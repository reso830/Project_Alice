# Feature Specification: Profile Schema Refactor

**Feature Branch**: `032-profile-schema-refactor`  
**Created**: 2026-06-02  
**Status**: Draft  
**Input**: Feature brief `docs/features/2.0.0-smart-intake-ai-assistance/032-profile-schema-refactor.md`. Builds directly on feature 031 (Skill Proficiency System) and the dual-mode persistence layer (features 018–022).

## Problem Statement

Today the entire profile — including the skills list — is stored as a single JSON document in the `profile` table (`data` column): one row keyed by `id = 1` in local SQLite, one row per `user_id` in hosted Supabase. Skills live *inside* that blob as `skills: [{ name, level }]` (the structured shape introduced by feature 031).

As Alice grows into a career-intelligence platform, skills stop being purely profile-display data: they become a queryable signal consumed by compatibility scoring (035), ATS checks (037), and AI-assisted population (033/034). A value buried inside a JSON blob cannot be queried, indexed, joined, or aggregated independently, and every downstream feature would otherwise re-parse the whole document.

This feature promotes **skills** to first-class, independently-persisted records while keeping the rest of the profile (summary, experience, education, certifications, awards, languages, links, preferences) document-oriented. It is a **persistence refactor only**: existing profiles must keep working with no user-visible behavior change and no data loss.

## Scope

**In scope**
- Add a dedicated `skill` store (one row per profile skill) in **both** persistence modes — local SQLite and hosted Supabase — keeping the two backends at parity (local-first principle).
- Make the `skill` store the **sole source of truth** for skills: skills are removed from the profile JSON document.
- On read, the profile repository reassembles skills into the existing `profile.skills` array so the API and UI see the same shape as today.
- On save, the profile repository writes the document (without `skills`) and replaces that profile's skill rows transactionally.
- Auto-migrate existing profiles idempotently (no operator step, no user action): move any skills still embedded in the JSON document into the `skill` store, populating proficiency defaults where required, then drop `skills` from the document.
- Centralize the skill ↔ row mapping and reuse feature 031's existing normalization/validation so the migration is loss-free.
- Automated tests covering the new repository behavior and migration across both backends and the demo mode.

**Non-goals** (carried from the brief)
- Full normalization of other profile sections (experience, education, etc. stay document-oriented).
- Resume / CV parsing (033), JD parsing (034), the compatibility engine (035), the insights panel (036), and ATS quality checks (037). This feature only readies the schema for them.
- Analytics dashboards or skill-recommendation systems.
- **New skill API endpoints.** The refactor is transparent: skills are still read and written through the existing whole-profile contract; dedicated add/edit/delete skill endpoints are deferred to the features that need them.
- Any UI change. The Profile and Profile-Edit pages are untouched.
- Changing the skill model itself — the 1–5 proficiency scale, labels, validation rules, and the 50-skill maximum from feature 031 are unchanged.

## User Behavior

This feature has **no intended user-visible impact**. Users continue to view profiles, edit profiles, add/edit/delete skills, and save changes exactly as before. The only observable guarantee is a negative one: after deployment and migration, every existing profile still shows the same data — same fields, same skills, same proficiency levels.

The change is internal to the persistence layer:

- **Reading a profile** returns one profile object whose `skills` array is reassembled from the skill store, indistinguishable from the previous embedded shape.
- **Saving a profile** accepts the same whole-profile payload; the layer splits skills out to the skill store and persists the rest as the document.

## Clarifications

### Session 2026-06-02

- Q: Promote skills in both persistence modes, or hosted only? → A: **Both** SQLite (local) and Supabase (hosted), kept at parity, so local-first behavior and downstream AI features are consistent across modes.
- Q: After the refactor, where is the authoritative copy of skills? → A: **The skill store only.** Skills are removed from the profile JSON document (single source of truth). The read path reassembles them into the profile object; there is no dual-write.
- Q: Should the refactor be transparent to the API/UI, or expose new skill endpoints now? → A: **Transparent.** `GET` returns a profile with an embedded `skills[]` array; saving takes the whole profile. No new endpoints, no UI change.
- Q: How should existing profiles migrate? → A: **Auto-migrate, idempotent.** Migration runs automatically (no operator/user step), is safe to run repeatedly, populates proficiency defaults where missing, and never requires manual intervention.
- Q: How is the user's custom skill order preserved once skills become rows? → A: **Implicit insertion order** — no dedicated position column. Reads sort by creation/insertion order (e.g. ascending row id); saves replace a profile's rows in payload order, so the re-inserted order matches the array the user saved (which is the Profile page's "Custom" order from feature 031).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Existing profiles keep working with no visible change (Priority: P1)

A user who already has a profile (with skills) opens the app after this feature ships and sees everything exactly as before — same skills, same proficiency levels — and can edit and save without noticing any difference.

**Why this priority**: The entire value of the feature is "promote skills to first-class storage *without* disrupting users." If existing profiles regress, the refactor has failed regardless of the schema improvement.

**Independent Test**: Take a profile whose stored document contains an embedded `skills` array (e.g. `[{ name: "Jira", level: 3 }]`). After migration, load the profile via the normal read path and confirm the returned profile object still contains `skills: [{ name: "Jira", level: 3 }]`, all other fields intact, and that editing + saving round-trips with no data loss.

**Acceptance Scenarios**:

1. **Given** a profile with embedded skills stored under the pre-032 schema, **When** the profile is read after migration, **Then** the returned object contains the identical `skills` array (same names, same levels, same order) and identical document fields.
2. **Given** a migrated profile, **When** the user edits a skill's name or level and saves, **Then** the change persists to the skill store and is reflected on the next read.
3. **Given** a migrated profile, **When** the user adds a new skill and saves, **Then** a new skill row is created and returned on read; **When** the user removes a skill and saves, **Then** its row is deleted.
4. **Given** any non-skill profile field (summary, experience, education, certifications, awards, languages, links), **When** a profile is read after migration, **Then** that field is preserved unchanged (same value as before migration) — migration removes only the `skills` key and does not re-normalize other sections.

### User Story 2 - Skills are independently persisted and queryable (Priority: P2)

A downstream feature (e.g. a future compatibility engine) can read a profile's skills as discrete records — name + proficiency — without parsing the whole profile document.

**Why this priority**: This is the structural payoff that justifies the refactor. It is independently demonstrable at the data layer even though no consumer ships in this feature.

**Independent Test**: For a profile with N skills, query the skill store directly and confirm exactly N rows exist, each carrying the profile reference, skill name, and proficiency, with no skills remaining inside the profile JSON document.

**Acceptance Scenarios**:

1. **Given** a saved profile with N skills, **When** the skill store is queried for that profile, **Then** exactly N rows are returned, each with the profile reference, `skill_name`, and `proficiency`.
2. **Given** a saved profile, **When** its JSON document is inspected, **Then** it contains **no** `skills` key (skills live only in the skill store).
3. **Given** two skills with proficiency 5 and 2, **When** the store is queried, **Then** each row's persisted proficiency matches the value set in the editor.

### User Story 3 - Migration is safe, idempotent, and loss-free (Priority: P3)

The first time the app runs against an un-migrated profile, its embedded skills move into the skill store automatically; running the migration again changes nothing.

**Why this priority**: Protects existing data (constitution: no silent corruption / no data loss) and makes deployment safe to retry. Required before release.

**Independent Test**: Start from a profile whose document still embeds skills. Run the migration; confirm the skill store is populated and the document's `skills` key is removed. Run the migration a second time; confirm no duplicate rows are created and no data changes.

**Acceptance Scenarios**:

1. **Given** a profile with embedded `skills`, **When** migration runs, **Then** each skill becomes one row in the skill store and the document's `skills` key is removed.
2. **Given** a profile that has already been migrated, **When** migration runs again, **Then** no rows are added, removed, or altered (idempotent).
3. **Given** a legacy embedded skill stored as a bare string, **When** migration runs, **Then** it is normalized to `{ name, level: 2 }` (Basic) — consistent with feature 031 — before being written as a row, with no skill dropped.
4. **Given** a profile with no skills (or an empty skills array), **When** migration runs, **Then** it completes successfully and the skill store has zero rows for that profile.
5. **Given** a failure partway through migrating a single profile's skills, **When** the operation aborts, **Then** that profile is left in a consistent state (either fully migrated or unchanged), never half-migrated, and a retry completes it.

### Edge Cases

- **Profile with no skills**: migration and reads produce an empty `skills: []`; zero rows in the store.
- **Empty / whitespace skill names**: handled exactly as feature 031 — blank-name rows are preserved through normalization so save-validation can reject them; empty legacy strings are dropped as migration junk and never become rows.
- **Duplicate skills**: case-insensitive, whitespace-collapsed duplicate names are blocked at save by existing 031 validation, so the store never receives duplicates from a normal save. The migration de-duplicates defensively (first occurrence wins) so legacy data that predates dedupe cannot create duplicate rows.
- **Missing proficiency values**: a saved profile never contains an unrated skill (031 gates save on `level: null`), so persisted rows always carry a 1–5 proficiency. Legacy bare-string skills encountered during migration default to level 2 (Basic) per 031. The transient unrated (`null`) editor state is never written to the store.
- **Legacy profile formats**: a document that still embeds `skills` (string[] or object[]) is normalized via the existing model before rows are written.
- **Partial migration failures**: each profile's skill migration is atomic (transactional) — a mid-flight failure leaves the profile unchanged, and the idempotent design lets a later run finish it.
- **Demo mode**: skills are returned embedded in the in-memory profile object so the demo/portfolio runtime renders identically; the demo seed data is **already** in the `{ name, level }` shape (feature 031), so no demo seed change is required.
- **Concurrent save vs. migration**: a save that arrives mid-migration must not duplicate or lose skill rows (save replaces a profile's rows wholesale within a transaction).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST persist each profile skill as an independent record carrying a reference to its owning profile, the skill name, and the proficiency level — separate from the profile JSON document.
- **FR-002**: The skill store MUST be the **sole source of truth** for skills. The profile JSON document MUST NOT contain a `skills` key after a save or migration.
- **FR-003**: The skill store MUST exist in **both** local (SQLite) and hosted (Supabase) modes, with equivalent behavior; the demo mode MUST also return skills in the embedded shape (it keeps them in memory and has no persistent store to reassemble from).
- **FR-004**: Reading a profile MUST return a profile object whose `skills` array is reassembled from the skill store, identical in shape to the pre-032 embedded array (`[{ name, level }]`) and ordered by insertion order, so the existing API contract, the Profile page's "Custom" sort, and the UI are unchanged.
- **FR-005**: Saving a profile MUST accept the existing whole-profile payload (with an embedded `skills` array), persist the non-skill data as the document, and replace that profile's skill rows to match the payload — within a single transaction so the profile is never left partially saved. Rows MUST be (re)written in payload order so that reads sorted by insertion order reproduce the user's custom skill order.
- **FR-006**: The system MUST auto-migrate existing profiles whose document still embeds skills into the skill store, with **no operator step and no user action required**.
- **FR-007**: Migration MUST be idempotent — running it on an already-migrated profile MUST NOT create, alter, or delete rows.
- **FR-008**: Migration MUST be loss-free for every **distinct, named** skill: each surviving skill MUST be written as a row with its name preserved exactly and its proficiency preserved (or defaulted per FR-009). Collapsing case-insensitive duplicate names (FR-010, first occurrence wins) and dropping blank-name / structurally-junk entries (FR-009) are intentional de-duplication and cleanup — **not** data loss, since a duplicate or blank carries no distinct skill. No profile document field other than `skills` may be altered: migration MUST strip only the `skills` key and normalize only the extracted skills — it MUST NOT re-normalize other document sections on read; the non-skill document is written back verbatim.
- **FR-009**: During migration, legacy bare-string skills MUST be normalized to `{ name, level: 2 }` (Basic) per feature 031; structurally-junk elements (empty legacy strings, non-object/non-string values) MUST be dropped, not written as rows.
- **FR-010**: Migration MUST de-duplicate skills defensively (case-insensitive, whitespace-collapsed; first occurrence wins) so legacy data cannot produce duplicate rows.
- **FR-011**: Per-profile skill *migration* MUST be transactional — a failure MUST leave the profile fully un-migrated (not partial), and a retry MUST be able to complete it. (This is the migration-path counterpart to FR-005's save-path atomicity; both use the same transactional write.)
- **FR-012**: The feature MUST NOT introduce new skill API endpoints or any UI change; reads and writes continue through the existing whole-profile contract.
- **FR-013**: The skill model — the 1–5 proficiency scale, labels, blank-name / duplicate / unrated / 50-maximum validation, and the unrated (`null`) transient state — MUST remain unchanged from feature 031, and MUST stay centralized in the shared profile model with automated test coverage.
- **FR-014**: An unrated skill (`level: null`) MUST NOT be persisted to the skill store; the existing save-gating from 031 continues to prevent saving a profile with an unrated skill.
- **FR-015**: The migration and the new repository behavior MUST be covered by automated tests for local SQLite, hosted Supabase, and demo mode, including the idempotency, loss-free, empty-skills, and legacy-format cases.

### Key Entities *(include if feature involves data)*

- **Profile (document)**: the existing per-profile JSON document — `summary`, `experience`, `education`, `certifications`, `awards`, `languages`, `links`, and identity/preference fields. After this feature it **no longer contains** `skills`. Keyed by `id = 1` (local) or `user_id` (hosted).
- **Skill (record)**: a single profile skill, independently stored. Attributes: a reference to the owning profile (`profile_id` / `user_id`), `skill_name` (required and non-blank — enforced by application validation (031) and migration cleanup, not a store-level CHECK; unique within a profile case-insensitively — enforced by a store-level unique index), and `proficiency` (integer 1–5, mapping to feature 031's `level`). Unrated (`null`) is a transient editor state only and is never stored. Replaces the per-skill entries previously held in `Profile.skills`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing profiles load after migration with their **distinct** skills intact — zero distinct skills dropped, preserving the same names, levels, and order as before (case-insensitive duplicate names are collapsed and blank-name junk is removed by design — see FR-008/FR-010).
- **SC-002**: After any save or migration, the profile document contains **no** `skills` key, and every persisted skill exists as an independent record (verifiable by inspecting storage).
- **SC-003**: The profile read/write contract is unchanged — the returned profile shape (with an embedded `skills[]` array) is identical to pre-032, so no client/UI change is required.
- **SC-004**: Migration is idempotent — running it any number of times produces the same rows with no duplicates and no data change.
- **SC-005**: Non-skill profile fields are unchanged by migration (same values before and after).
- **SC-006**: A profile's skills can be read as discrete records without parsing the profile document, demonstrating readiness for downstream features (033–037).

## Data Considerations

- **Mapping**: the application model keeps feature 031's `{ name, level }` shape. The persistence layer maps `name ↔ skill_name` and `level ↔ proficiency` at the repository boundary; the rest of the app is unaware of the column names.
- **Source of truth**: skills are stored only in the skill store. The read path is responsible for reassembling them onto `profile.skills`; nothing downstream reads skills from the document.
- **Local (SQLite)**: a new `skill` table referencing the single profile row (`id = 1`); skill writes happen inside the same transaction as the profile-document upsert. A new local migration creates the table and backfills from any embedded `skills`.
- **Hosted (Supabase)**: a new `skill` table scoped to `user_id` (or a profile FK) with row-level security so a user can only read/write their own skills, consistent with the existing `profile` RLS. A Supabase migration creates the table and indexes; an idempotent backfill moves embedded skills into rows. The boot-time hosted schema check (`assertHostedSchema`) is extended to assert the new table.
- **Uniqueness / indexing**: a store-level **case-insensitive unique index** on (profile, `lower(skill_name)`) enforces the no-duplicate invariant in the database (backstopping the application-level dedupe), so no code path — current or future — can create duplicate skill rows that would corrupt downstream scoring. A separate index on the profile reference supports efficient per-profile reads and future queries. **Non-blank** is enforced at the application layer (031 save validation) plus migration cleanup (blank-name entries are dropped before insert), not via a store-level CHECK — consistent with the existing `profile`/`applications` tables. Because the unique index would otherwise abort a migration insert, the migration MUST drop blank names and collapse duplicates before writing rows (FR-008/FR-009/FR-010).
- **Proficiency column**: stores integers 1–5; since unrated skills are never saved, the column does not need to store `null` for normal operation (final nullability/constraint is a plan/data-model decision).
- **Ordering**: skill order is preserved **implicitly** via insertion order, with no dedicated position column (Clarification 2026-06-02). Reads return skills sorted by creation/insertion order (ascending row id) so the reassembled `skills` array reproduces the Profile page's "Custom" order from feature 031. Because a save replaces a profile's rows wholesale, re-inserting them in payload order keeps insertion order aligned with the array the user saved.
- **No data loss**: migration reuses the existing model normalization so legacy formats are converted exactly as feature 031 already does on load.

## Assumptions

- The dual-mode persistence layer (SQLite + Supabase + demo), the profile CRUD flow, and feature 031's skill proficiency system already exist; this feature changes *where* skills are stored, not the skill model or the UI.
- Saved profiles never contain unrated skills (031 gates save), so persisted proficiency is always 1–5; the migration only needs to default legacy bare strings.
- Downstream features (033–037) will consume skill records directly from the new store; their design is out of scope here.
- Profile data remains private and local-first; this feature adds no external service, analytics, or tracking.
- The existing whole-profile API contract is the integration surface; no client changes are required.
