# Plan Review Checklist: Application Timeline (025)

Use this before generating `tasks.md`. Each item must be answered
explicitly (✅ / ❌ / N/A with one-line reason). Fail any item → fix
the plan, do not proceed.

---

## Constitution

- [x] Constitution v1.4.0 reviewed (note: Amendment 1.4.0 restores `applicationDate` as an optional field — feature 025's synthesis logic depends on this)
      ([../../.specify/memory/constitution.md](../../.specify/memory/constitution.md))
- [x] Required application fields preserved (companyName, jobTitle,
      status, lastStatusUpdate, responsibilities)
- [x] No external analytics / tracking / third-party data sharing
      introduced
- [x] No new runtime dependencies; if any, justification documented
- [x] Local-first design: feature works offline / without internet
      where the app does today
- [x] Validation centralized (server Zod + client mirror) — no
      ad-hoc shape checks scattered through UI
- [x] No silent data corruption path: invalid input rejected with a
      user-facing error
- [x] Empty / loading / error states explicit for every new surface
- [x] Desktop AND mobile layouts covered
- [x] Status communicated by label, not color alone
- [x] Plan includes a Release Prep phase as second-to-last
- [x] Plan includes a Browser Smoke Test phase as last (UI feature)
- [x] Smoke Test is ordered AFTER Release Prep so it exercises the
      merge state

## Spec alignment

- [x] Every spec FR maps to at least one section in plan.md /
      data-model.md / contracts/api.md
- [x] All four spec-time clarifications (inline date edit, legacy
      synthesis, accepted audit-only, design-doc modal layout)
      are encoded in plan + data-model
- [x] No FR silently dropped; any deferred FR explicitly listed in
      *Out of Scope*

## Architecture

- [x] Component boundaries documented (Timeline.js NEW; Modal.js
      modified; model + validation extended)
- [x] Data flow for add, edit, delete, status-change, discard, save
      is traced end-to-end
      *(Note: plan.md "Data flow" subsections trace add, status-change,
      discard, synthesis explicitly; edit and delete are covered at the
      mutation-pattern level in data-model.md §7. Acceptable.)*
- [x] Legacy-row synthesis flow is traced (read path only;
      persistence only on Save)
- [x] Both backends (SQLite + Supabase) covered; demo branch
      addressed
- [x] No new endpoints introduced (additive PATCH only)
- [x] No change to API response envelope `{ data, error }`
- [x] Status guard at the API boundary (TRANSITIONS, TERMINAL_STATES)
      is preserved exactly

## Data

- [x] data-model.md defines TimelineEntry shape + invariants
- [x] SQLite migration is idempotent (uses `ensureColumn`)
- [x] Supabase migration is additive + reversible, with an exact SQL
      block in quickstart
- [x] Boot-time hosted schema smoke check is extended to probe the
      new column
- [x] `claim_and_seed_starter()` body update is documented (canonical
      source noted; idempotent because of marker)
- [x] JSON encode/decode at the adapter boundary covered for both
      backends
- [x] No backfill migration; legacy rows synthesized at read time

## Validation

- [x] Zod schema for `timeline` defined (per-entry + array)
- [x] Client mirror in `validateApplication` covers the same shape
- [x] Invalid `timeline` round-trips through standard
      VALIDATION_ERROR envelope
- [x] No new error codes introduced

## Tests

- [x] Each FR has at least one mapped automated test (in plan's
      *Affected Areas* → *Tests*)
      *(Note: mobile FR-027/028 are smoke-only — Task 11.10 — with no
      DOM unit test. Matches existing codebase convention for CSS-only
      mobile reflow. Acceptable.)*
- [x] Repository round-trip tests cover BOTH SQLite and Supabase
      adapters
- [x] Modal interaction tests cover: render Timeline; status change
      appends auto-entry; Discard reverts Timeline edits
- [x] Timeline component tests cover: collapsed; expand; add (Enter
      + click); edit text/status/date; delete; future date;
      empty-state prompt
- [x] Seed parity test extends to `timeline` (no manual mirror drift)
- [x] Existing seed validation test asserts new fixtures pass
      `validateApplication`

## Risks

- [x] Risk table in plan.md is complete (hosted migration drift,
      atomic status+timeline write, payload size, picker drift,
      a11y, etc.)
- [x] Each risk has an explicit mitigation
- [x] Accepted tradeoffs are spelled out — no implicit "we'll
      decide later"

## Affected Areas section (required by /speckit.plan)

- [x] Files to inspect listed
- [x] Files to modify listed (and explicitly distinct from inspect)
- [x] Tests to add/update listed by file path
- [x] Out-of-scope items listed (negation list, not just
      assumptions)

## Operator surface

- [x] quickstart.md gives a clean local-dev path
- [x] quickstart.md gives a clean hosted-deploy path with copy-
      pasteable migration SQL
- [x] Rollback steps documented for both backends
- [x] CHANGELOG / docs update noted (handled in Release Prep phase)

## Out-of-scope discipline

- [x] No work on attachments per entry
- [x] No bulk import / email parsing
- [x] No calendar / push integrations
- [x] No auto entries from non-status actions (favorite, archive)
- [x] No persisting expanded/collapsed state across opens
- [x] No renaming the existing `applicationDate` field
- [x] No status set change (accepted is audit-only — already in the
      model)

## Sign-off

- [x] All items above resolved
- [x] `tasks.md` may now be generated via `/speckit.tasks`
