# Plan Review Checklist: Calendar (026)

Use this before generating `tasks.md` via `/speckit.tasks`. Each item
must be answered explicitly (✅ / ❌ / N/A with one-line reason). Fail
any item → fix the plan, do not proceed.

**Status: signed off by plan author 2026-05-21** (after spec review
sweep — Codex MAJOR M1 + MINOR m1–m3 + INFO i1, i4, i5 all
resolved; Codex follow-up batch on plan.md:540 staleness +
assessment-due deferral record + this checklist also resolved).

---

## Constitution

- [x] Constitution v1.4.0 reviewed (Amendment 1.4.0 — 2026-05-21 —
      restores `applicationDate` as an optional field; not used by this
      feature, but cited here so future readers know the version baseline)
      ([../../../.specify/memory/constitution.md](../../../.specify/memory/constitution.md))
- [x] Required application fields preserved (companyName, jobTitle,
      status, lastStatusUpdate, responsibilities). The Mark Ghosted
      path bumps `lastStatusUpdate` per the constitution.
- [x] No external analytics / tracking / third-party data sharing
      introduced.
- [x] No new runtime dependencies; if any, justification documented.
- [x] Local-first design: the Calendar works offline / without
      internet. Reads come from the local DB or in-memory demo store.
      Dismissals live in `localStorage` (hosted + local) or
      in-module memory (demo, per feature 020 FR-004).
- [x] Validation centralized — Mark Ghosted PATCH passes through the
      existing server-side Zod schema + state machine guard. No
      ad-hoc shape checks scattered through UI.
- [x] No silent data corruption path: a failed Mark Ghosted shows a
      toast and leaves state untouched; a malformed timeline rejected
      by server validation.
- [x] Empty / loading / error states explicit for every new surface
      (3 empty states; loading placeholder on mount; error toasts on
      load + write failures).
- [x] Desktop AND mobile layouts covered (wide, narrow, <640px
      bottom-sheet variant).
- [x] Status communicated by label / count, not color alone (chips
      carry counts; popover rows carry status labels).
- [x] Plan includes a Release Prep phase as second-to-last (Phase 10).
- [x] Plan includes a Browser Smoke Test phase as last (Phase 11; UI
      feature).
- [x] Smoke Test is ordered AFTER Release Prep so it exercises the
      merge state (Amendment 1.3.0 compliance).

## Spec alignment

- [x] Every spec Acceptance Criteria (AC1–AC21) maps to at least one
      section in plan.md / data-model.md / contracts/api.md.
- [x] All five spec-time clarifications (userIdentityToken; "newer
      entry" semantics; ghost rule excludes wishlisted; random
      greeting selection; row-body non-clickable) are encoded in
      plan + data-model + contracts. Plus four spec-review M1/m1–m3
      decisions encoded in the same artifacts.
- [x] No spec AC silently dropped; any deferred AC explicitly listed
      in *Out of Scope*. Assessment-due rule deferral recorded in
      both `spec.md` Non-Goals AND `research.md §2a` with a
      documented re-add path.
- [x] All nine spec User Stories (US-1..US-9) have a corresponding
      manual-test entry in quickstart.md §6.

## Architecture

- [x] Component boundaries documented (page orchestrator vs.
      sub-components vs. pure utils vs. model helper). See plan.md
      §Architecture "Layered view".
- [x] Data flow for mount, Mark Ghosted, Dismiss, Open Overlay, and
      filter/navigation are each traced end-to-end in plan.md.
- [x] Pure-function utils explicitly separated from DOM-touching
      components (testability) — `src/utils/calendar*.js` (4 files,
      pure) vs. `src/components/calendar/*.js` (DOM).
- [x] Module subdirectory pattern (`src/components/calendar/`)
      justified in research.md §4.
- [x] Existing Modal.js is NOT touched (boundary respected).
      `focusTimeline` deferred to v2 per research.md §11.
- [x] Existing Timeline.js `appendStatusChangeTimelineEntry` is NOT
      refactored or reused from the Calendar (separate concerns;
      research.md §3).

## Data model

- [x] No new application field introduced.
- [x] No new server-side data store, table, column, or migration.
- [x] New client-side storage (localStorage / in-module memory)
      shape and key scoping documented in data-model.md §3 (with
      the demo carve-out from spec review M1).
- [x] `applyStatusChange` helper contract documented (pure, returns
      new object, does not validate transition). Task 01.1.
- [x] `STATUS_DISPLAY_PRIORITY` constant home settled in
      `src/models/application.js` (research.md §16) and consumed by
      MonthGrid / StatusFilterDropdown / DayPopover via single
      import.
- [x] Year range constants (`YEAR_MIN = 2020`, `YEAR_MAX = currentYear
      + 5`) defined in exactly one place (`src/utils/calendar.js`).
- [x] Date format is `YYYY-MM-DD` strings throughout; no Date object
      shape leaks across module boundaries.

## Suggestion engine

- [x] All five v1 rules (`followup`, `feedback`,
      `interview_followup`, `offer_expiry`, `ghost`) have a precise
      trigger spec in data-model.md §2.
- [x] Sixth rule (`assessment_due`) explicitly deferred and recorded
      in research.md §2a; not present in `SuggestionKind` union.
- [x] Suppression rules (future entry, dismissal, terminal state)
      are uniform across all five rules — data-model.md §2.6.
- [x] Ghost rule's status whitelist (applied/phone_screen/interview/
      assessment/offer) is explicit, not inferred.
- [x] Offer-expiry window constants (`OFFER_WINDOW_DAYS = 5`,
      `OFFER_NEAR_EXPIRY_DAYS = 3`) are named, exported, and tested
      (Task 01.4).
- [x] Each rule has at least one positive-trigger unit test and one
      suppression unit test queued in plan.md Affected Areas
      (Task 01.4 Validation).

## API contracts

- [x] No new server endpoint introduced. Mark Ghosted reuses
      `PATCH /api/applications/:id`.
- [x] Mark Ghosted PATCH body is a single payload with `status`,
      `lastStatusUpdate`, and `timeline` (atomicity at the route
      level). contracts/api.md §1.3.
- [x] Failure modes for each consumed endpoint mapped to a UX
      response (toast text, state effect) in contracts/api.md §4.
- [x] localStorage failure modes documented (silent in-memory
      fallback; one warn per session) in contracts/api.md §2.1.
- [x] Demo-mode storage carve-out documented in contracts/api.md
      §2.1 (post-M1).

## Testing

- [x] Each pure-function module has a dedicated test file queued
      (`tests/utils/calendar*.test.js` × 4).
- [x] Each new component has a dedicated test file queued
      (`tests/components/calendar/*.test.js` × 7).
- [x] Page-level integration test queued for Calendar.js
      (`tests/pages/Calendar.test.js`).
- [x] Existing `tests/data/demoStore.test.js` parity assertion will
      catch demo / SQLite seed divergence — no code change required
      to that test (Task 09.2 explicitly notes this).
- [x] `tests/seed-data.test.js` extended with a new assertion that
      the seed corpus triggers every suggestion kind (uses
      `vi.setSystemTime` to freeze "today"). Task 09.4.
- [x] `tests/models/application.test.js` extended with
      `applyStatusChange` cases (purity, atomicity, ID allocation)
      AND `STATUS_DISPLAY_PRIORITY` cases (length, set equality with
      `STATUS_VALUES`, frozen, order). Task 01.1.
- [x] Greeting selection test plan acknowledges `Math.random` +
      `Date` stubbing requirement (Task 07.5).
- [x] Demo-mode localStorage-isolation tests queued (Task 01.5
      Validation): assert `localStorage.setItem` and `getItem` are
      never called on the demo path.

## Risks

- [x] At least one mitigation listed per risk in plan.md §Risks.
- [x] Seed augmentation risk includes the parity test as the
      safety net.
- [x] ISO week boundary risk includes explicit test cases for the
      four edge dates (Task 01.2 Validation).
- [x] localStorage failure risk includes the fallback path
      (Task 01.5).
- [x] CSS collision risk addressed by class-naming prefix rule
      (Task 08.1 + the global note at top of tasks.md, per spec
      review m2).

## Release Prep coverage (preview — confirms tasks.md will include
the right work in the penultimate phase)

- [x] Version bump planned (semver minor — new feature, no breaking
      changes). Task 10.1.
- [x] CHANGELOG entry planned. Task 10.2.
- [x] `docs/REPO_MAP.md` updates planned for every new file:
      `src/pages/Calendar.js` (rewrite),
      `src/components/calendar/*.js` (7 files),
      `src/utils/calendar*.js` (4 files), plus all new test files.
      Task 10.5.
- [x] `docs/deployment.md` appendix planned for the hosted
      `claim_and_seed_starter` follow-up. Task 10.4.
- [x] `docs/db/claim_and_seed_starter.md` (canonical RPC doc, owned
      since 025) update planned. Task 09.3.
- [x] No edits to `docs/features/026-calendar.md` (the brief is input,
      not output). Confirmed in Task 09.3 + research.md §2a.

## Browser Smoke Test coverage (preview)

- [x] One smoke step per User Story (US-1..US-9) in quickstart.md §6
      → mapped to Phase 11 tasks 11.2–11.9 in tasks.md.
- [x] Mobile bottom-sheet pass included. Task 11.11.
- [x] Accessibility pass included. Task 11.10.
- [x] Cross-page regression pass included (Tracker + Profile).
      Task 11.12.
- [x] localStorage behavior verification included. Task 11.13.
- [x] Smoke test is ordered AFTER Release Prep in tasks.md (Phase
      11 follows Phase 10).
- [x] Hosted-mode operator dry-run included. Task 11.14.

---

## Sign-off

| Role | Status | Notes |
|---|---|---|
| Plan author | ✅ 2026-05-21 | All checklist items green after spec-review sweep (M1, m1–m3, i1, i4, i5) and Codex follow-up (plan.md:540 stale paragraph fixed; assessment-due deferral recorded in research.md §2a + spec.md Non-Goals). Ready for reviewer pass. |
| Reviewer (human or AI) | _pending_ | A second pass after the author's check; any ❌ blocks implementation. |

When the reviewer slot is also ✅, run:

```
/speckit.implement
```

(Or hand off to Codex per the AI workflow guide.)
