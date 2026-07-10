# Research: Calendar (026)

Design decisions made during planning, paired with the alternatives
that were considered and rejected. Each section names the decision,
the alternatives, and the reasoning. The five spec-time clarifications
from `/speckit.clarify` are listed at the top so subsequent decisions
can reference them.

---

## 0. Spec-time clarifications (settled in /speckit.clarify)

| # | Decision | Reference |
|---|---|---|
| C1 | `userIdentityToken`: hosted → Supabase `auth.user.id` UUID; local / unauthenticated → `"local"`; **demo → `"demo"` AND localStorage is never written** (per spec review M1, honoring feature 020 FR-004). | [spec.md §Clarifications Q1](spec.md#clarifications) |
| C2 | "No newer entries" in the follow-up / feedback / interview-followup rules means **any** newer Timeline entry, regardless of status or text. | spec.md Q2 |
| C3 | The ghost suggestion rule excludes `wishlisted`. Triggers only for `applied`, `phone_screen`, `interview`, `assessment`, `offer`. | spec.md Q3 |
| C4 | Greeting selection is uniform-random across the merged pool, computed once at mount from the local browser hour. Tests stub `Math.random`. | spec.md Q4 |
| C5 | Action Panel row body is **not** clickable. Only the explicit action button triggers an open. Day Popover row body **is** clickable (single semantic action). | spec.md Q5 |

These are not rediscussed below. Anything that contradicts them is
out of scope.

---

## 1. Storage for suggestion dismissals — `localStorage` vs server table

**Decision:** Browser `localStorage`, keyed by `userIdentityToken`.

**Rejected alternatives:**

- **New `calendar_suggestion_dismissals` SQLite + Supabase table.**
  Cleanest separation, but introduces a migration in two backends, RLS
  policies, a new repository, validation, and tests — for a UX
  preference. Considered overkill for v1.
- **Field on the application row** (e.g.
  `application.dismissedSuggestions: SuggestionKind[]`). Cheap in
  terms of new infrastructure, but pollutes the application model
  with a UX concern that has nothing to do with the application
  itself. Also means orphan cleanup happens "for free" when an
  application is deleted — a benefit, but a marginal one.
- **Timeline-embedded record** (a `kind: "dismissal"` Timeline
  entry). Stretches the semantic of the Timeline (which is the
  history of *what happened to the application*, not *what the
  user dismissed*). Would also be visible in the Application
  Overlay, which is the wrong surface.

**Tradeoffs accepted:**

- No cross-device sync of dismissals. The user dismissing a
  suggestion on their phone won't suppress it on their laptop.
  Documented in spec §Non-Goals.
- Dismissals do not survive a `localStorage.clear()` or browser
  cache wipe. Documented in spec §Edge Cases.
- Orphan dismissals stay forever (no cleanup when an application
  is deleted). Harmless — they match nothing. Cleanup deferred to
  v2 if storage size becomes a concern.
- **Demo mode carve-out (spec review M1, 2026-05-21)**: demo
  sessions DO NOT write to `localStorage`. Per feature 020 FR-004
  ("no persistent client-side state for the visitor"), demo
  dismissals live only in an in-module memory bucket keyed by
  `"demo"`. Page refresh (which exits demo per FR-005) resets the
  bucket. An intra-tab demo re-entry without refresh inherits the
  prior session's in-memory dismissals — an accepted minor edge,
  preferred over coupling `authStore.exitDemo()` to a Calendar
  utility module just to clear it.

---

## 2. Offer-expiry suggestion — date source

**Decision:** Infer the expiry window from the most recent
`status: "offer"` Timeline entry. Assume a 5-day response window;
fire the suggestion when `daysBetween(offerEntry.date, today) >= 3
and <= 5`.

**Rejected alternatives:**

- **Add an `offerExpiryDate` field to the Application model.** Most
  accurate, but requires schema migration in both backends, Zod
  schema changes, modal UI for entering the date, and form
  validation. Out of scope for v1 (spec /clarify decision).
- **Use a future-dated Timeline entry as the implied deadline.**
  Works without new fields, but conflates "the offer has a
  deadline" with "the user scheduled a follow-up reminder" —
  semantically muddy, and the user might add a "call recruiter
  back" reminder that gets mistaken for the offer deadline.
- **Drop the rule entirely from v1.** Considered, but the offer
  window is the most time-sensitive of the five suggestion kinds —
  ghosting and follow-ups can wait a day, but a missed offer
  response can lose the candidate the job. Inferring is better
  than nothing.

**Tradeoffs accepted:**

- 5 days is a guess. Some offers expire in 24 hours; some in 2
  weeks. The rule will be wrong in both directions. Acceptable
  trade for not adding a data field. Document the assumption in
  data-model.md §2.4 so users (and future maintainers) know it.
- The window is a single hardcoded constant
  (`OFFER_WINDOW_DAYS = 5`, `OFFER_NEAR_EXPIRY_DAYS = 3`). Easy
  to tune later if we add a field; trivially removable if we ever
  add a real `offerExpiryDate`.

---

## 2a. Technical-assessment due suggestion — deferred from v1

**Decision:** Drop the assessment-due rule from v1. Record as an
explicit accepted scope reduction; revisit when an
`assessmentDueDate` (or equivalent) field is added to the
Application data model.

**Sources requiring this rule** (predate the deferral; treat the
references below as superseded by this decision):
- [docs/features/1.0.0-operational-core/026-calendar.md line 300](../../docs/features/1.0.0-operational-core/026-calendar.md)
  — feature brief lists "Technical Assessment due today or tomorrow"
  as one of the suggestion rules.
- [docs/design/calendar.md §7 (line 510)](../../docs/design/calendar.md)
  — design's Suggestion Engine rules table includes the
  `Assessment` row.
- [docs/design/calendar.md §15 (line 593)](../../docs/design/calendar.md)
  — design's out-of-scope list does **not** call this out, implying
  inclusion.

**Trigger (per the brief/design, for future reference):** assessment
due today or tomorrow → suggestion "Technical assessment due
tomorrow".

**Why deferred:**

The rule requires a deadline date on the application. The current
data model has no `assessmentDueDate` field, and feature 025's
Timeline entries don't structurally encode "this is a deadline" —
they're just `{ date, status, text }` records. Two ways forward
were considered:

1. **Add `assessmentDueDate` field**: schema migration in both
   backends, Zod schema changes, modal UI for entering the date,
   form validation. Out of scope for 026 (the Calendar feature is
   meant to ship without data-model changes).
2. **Use a future-dated timeline entry as the implied deadline**:
   considered for offer expiry (research.md §2) but rejected
   there as semantically muddy. Same objection here — a future
   `assessment` Timeline entry could mean "I have an assessment
   scheduled" OR "this is the deadline"; we can't distinguish.

Either path makes the rule a larger scope addition than the other
four v1 rules. Spec /clarify Q2 (recorded in
[spec.md §Clarifications](../spec.md#clarifications)) settled the
deferral by user choice.

**Where the deferral is recorded:**
- [spec.md §Non-Goals](../spec.md): "Technical-assessment due-date
  suggestion (deferred; needs a deadline data field this codebase
  does not have)."
- This research entry.
- [data-model.md §2](../data-model.md): only four rules are
  documented; assessment-due intentionally absent.
- [contracts/api.md §3.3](../contracts/api.md): `SuggestionKind`
  union omits `assessment_due`.

**Tradeoffs accepted:**

- Hosted + local + demo users will not see assessment-due nudges
  for v1. Users with imminent assessments must rely on their own
  external reminders or the Timeline's future-dated entry view.
- Brief and design references in `docs/features/` and `docs/design/`
  remain unchanged (they are inputs and represent the original
  scope vision); this research entry is the authoritative
  superseding record per the AI workflow precedence rule
  ([memory: project_ai_workflow_alignment](../../../memory/project_ai_workflow_alignment.md)).

**Re-add path:**

When a future feature adds `assessmentDueDate` to the Application
model, the rule slots back in trivially:
- Add `'assessment_due'` to `SuggestionKind`.
- Add `ruleAssessmentDue(app, todayISO)` to
  `src/utils/calendarSuggestions.js`.
- Wire into `evaluateSuggestions`'s rule list.
- Seed augmentation gets a 6th case.

---

## 3. Mark Ghosted write path — shared helper vs server endpoint

**Decision:** Pure helper `applyStatusChange(application, newStatus,
{ date, text })` added to `src/models/application.js`. Calendar's
Mark Ghosted handler calls it, then `api.update(id, { status,
lastStatusUpdate, timeline })`. Reuses the existing
`PATCH /api/applications/:id` route.

**Rejected alternatives:**

- **Inline helper local to Calendar.** Considered. Avoids any model
  change, but duplicates logic that could drift from Modal.js's
  Change-Status flow (e.g., entry-id allocation, date format). The
  pure helper sits at the model layer where allocation /
  date-format invariants already live (`allocateTimelineEntryId`,
  `toISODate`).
- **New `POST /api/applications/:id/ghost` endpoint.** Most robust
  (server-owned transition + audit), but largest scope: route,
  Zod schema, both repository adapters, route tests, integration
  tests. Considered and rejected because the existing PATCH route
  already accepts the three-field write atomically, and atomicity
  is the only real concern. No defense-in-depth gain.
- **Refactor `src/components/Timeline.js`'s
  `appendStatusChangeTimelineEntry` into a shared pure function
  and use it from both Modal and Calendar.** Considered, but the
  two contracts differ — Modal mutates a draft; Calendar wants a
  pure return. Refactoring Timeline.js would force Modal.js
  changes (re-wrap the call site to assign the returned object).
  Out of scope for this feature; documented as a future cleanup.

**Tradeoffs accepted:**

- Modal.js and Calendar.js both build "append a status-change
  entry" objects, in two places. Risk of divergence (e.g., one
  starts using a different `text` default) mitigated by both
  paths sharing `allocateTimelineEntryId` and `toISODate` and by
  a unit test on `applyStatusChange` that asserts the exact entry
  shape.
- Mark Ghosted is not optimistic. The user sees a ~100ms loading
  state on the button until the PATCH returns. Acceptable; the
  cost of optimistic UX (showing success then having to revert on
  failure) outweighs the latency win here.

---

## 4. Component split — monolith vs sub-components

**Decision:** Split into `src/components/calendar/` directory with
focused sub-components (ActionPanel, MonthGrid, DayPopover,
MonthPicker, YearPicker, StatusFilterDropdown, anchoredDropdown).
`src/pages/Calendar.js` is the page orchestrator only — it holds
state and delegates rendering to the sub-components.

**Rejected alternatives:**

- **One large `Calendar.js` page module** containing all components
  inline (matches the design prototype's `calendar-app.jsx`).
  Considered for parity with the prototype. Rejected because the
  existing codebase strongly favors small focused component files
  (`Timeline.js`, `StatusDropdown.js`, etc.), unit tests are easier
  to write per-component, and the design's components have
  meaningfully different responsibilities (grid vs. popover vs.
  picker) that benefit from isolation.
- **Sub-components flat in `src/components/`** (e.g.
  `CalendarActionPanel.js`, `CalendarMonthGrid.js`). Considered.
  Rejected because seven new files in a single directory clutters
  the existing component list; a subdirectory groups them logically
  without disturbing the existing naming.

**Tradeoffs accepted:**

- A new subdirectory pattern (`src/components/calendar/`) sets a
  precedent. If we add another grouped feature later (e.g.
  `src/components/profile/`), we should follow the same pattern
  for consistency.
- Slightly more import noise from `Calendar.js` (seven sub-imports
  vs. one). Acceptable.

---

## 5. ISO week numbering implementation

**Decision:** Hand-rolled UTC-based algorithm exactly as specified in
design §6.8.2. No locale library.

**Rejected alternatives:**

- **`Intl.DateTimeFormat` with `week: "numeric"`** (ICU-backed).
  Locale-dependent — defaults to US conventions (Sunday-start,
  week-1 contains Jan 1) in `en-US`, which is wrong for the
  Calendar's ISO 8601 mandate. Not portable across user locales.
- **Third-party library (`date-fns`, `dayjs`, `luxon`).** Would
  add a runtime dependency for ~40 lines of code. The constitution
  forbids new dependencies without justification, and one helper
  function is not justification.
- **Naive `Math.floor((day-of-year - 1) / 7)`.** Wrong at every
  year boundary — fails to put Dec 30 in W01 of the next year.

**Tradeoffs accepted:**

- We own the implementation forever. Mitigated by four explicit
  unit-test cases covering the edge cases (Jan 1 W52/W53 of prev
  year, Dec 30 W01 of next year, leap-year W53, mid-year sanity
  check).

---

## 6. Business-day calculation for the `feedback` rule

**Decision:** Mon–Fri only. No holiday calendar. Implementation
walks days between the two ISO dates, skipping Saturdays and Sundays.

**Rejected alternatives:**

- **Holiday-aware (per-locale)**. Would require a holiday table or
  third-party data feed. Vast scope creep for a UX nudge. Spec
  §Non-Goals explicitly excludes this.
- **Calendar days only (drop "business" from the rule).** Considered.
  The 5-business-day window for phone-screen feedback is industry
  standard (a Monday phone screen → expect feedback by the
  following Monday); calendar-days would push it to Saturday, which
  feels too aggressive. Stick with business days.

---

## 7. Greeting determinism

**Decision:** Uniform-random per page-load, time-window selected from
the local browser hour at mount, plus three neutral entries appended.
Tests stub `Math.random` via `vi.spyOn(Math, "random")`.

**Rejected alternatives:**

- **Deterministic seeded by local date.** Same greeting all day,
  rotates next morning. More test-friendly without stubbing.
  Considered, but the design explicitly says "uniform random",
  and the feel-good benefit of slow rotation is small.
- **Deterministic seeded by `{date, userIdentityToken}`.** Same
  rotation but per-user. Marginal benefit; same drawbacks as
  above.
- **Static first entry of the time-window pool.** Dullest option;
  rejected as boring.

See spec /clarify Q4.

---

## 8. Open Application Overlay — fresh fetch vs. in-memory copy

**Decision:** On `↗ Open`, refetch via `api.getById(id)` before
calling `Modal.open(application, …)`. Matches the existing Tracker
behavior.

**Rejected alternatives:**

- **Pass Calendar's in-memory `_applications[id]` directly.** Saves
  one HTTP round-trip. Considered. Rejected because the overlay
  could end up with a stale view if another tab (or the Modal's
  own actions across tabs) has updated the application. The
  Tracker already accepts this round-trip cost, and Calendar
  should not have a looser consistency model.

---

## 9. CSS — where do the styles live?

**Decision:** All new Calendar selectors in `src/styles/main.css`
under a single `/* === Calendar === */` section banner. All selectors
scoped under `.calendar-page` (or descendant containers) to prevent
collision with Tracker / Profile classes.

**Rejected alternatives:**

- **Separate `src/styles/calendar.css` file**, imported by
  `Calendar.js`. Would introduce a new style-import pattern not
  used elsewhere in the codebase. Considered for size — adding
  ~500 lines to main.css is a meaningful diff. Rejected for
  consistency with existing patterns (Modal, Timeline, etc.
  all live in main.css).
- **CSS-in-JS via template strings**. Inconsistent with the
  codebase. Rejected.

**Tradeoffs accepted:**

- main.css grows. Mitigated by the section banner so future
  contributors can locate the Calendar block quickly. If main.css
  becomes unmanageable in v2, factor it into per-page files in a
  separate cleanup feature — not as part of 026.

---

## 10. Seed data augmentation — depth

**Decision:** Augment all three seeds (demo, local SQLite, hosted
starter via `claim_and_seed_starter`) so each suggestion kind fires
for at least one application against `toISODate()` (today).

**Rejected alternatives:**

- **Demo seed only.** Local-dev users wouldn't see all suggestion
  kinds; hosted starter wouldn't either. Demo would diverge from
  what a fresh local install shows. Rejected (user picked
  full augmentation in plan-time question 2).
- **No augmentation.** Some suggestion kinds might not surface in
  the demo, weakening the portfolio narrative. Rejected.

**Tradeoffs accepted:**

- Three seed files change in lockstep. The existing demo-store
  parity test enforces alignment between demo and SQLite; the
  hosted starter (RPC body) is a separate file and is enforced
  by manual smoke test only.
- "Today" is computed at seed-load time relative to the current
  date. For the demo seed (which dynamically shifts dates based on
  `Date.now()` — pattern established in feature 020), this works
  automatically. For the local SQLite seed, dates are hardcoded
  ISO strings; they will drift relative to "today" as time
  passes. Acceptable for a dev convenience seed (the dev can
  re-run `npm run db:seed`); not acceptable for the demo (which
  visitors see).
- **Hosted starter is intentionally degraded relative to
  demo/local-dev**: the hosted `claim_and_seed_starter` RPC seeds
  exactly two starter applications per [019-supabase-persistence](../019-supabase-persistence/spec.md),
  and we are NOT increasing that count for 026. With two rows we
  commit to firing at least one suggestion kind on day 1 (most
  likely `followup` on the older starter row) — not all five.
  A freshly-onboarded hosted user therefore sees a thinner
  Suggested Actions section than a demo visitor does, until they
  log their own activity. Rationale: the starter rows are a
  bootstrap, not a curriculum; growing them to 5+ records to
  cover every suggestion kind would clutter the new user's first
  view of the Tracker. The demo seed (23 records) is the proper
  home for full suggestion-kind coverage.

---

## 11. Defer `focusTimeline` to v2

**Decision:** Calendar-originated overlay opens behave identically
to Tracker-originated opens (Timeline section collapsed by default).
Spec's "optionally auto-focus Timeline" language permits deferring;
this saves a Modal.js change.

**Rejected alternatives:**

- **Add `focusTimeline` option to `Modal.open`.** ~30 lines of
  Modal.js change plus a test. Considered. Rejected for v1 to
  keep Modal.js out of this feature's blast radius (Modal is
  already complex; touching it has cascading risk on existing
  tests in feature 025).

User explicitly chose this option in plan-time question 3.

---

## 12. Page-level data load — single fetch vs. polling

**Decision:** Single fetch on mount. No polling, no auto-refresh.

**Rejected alternatives:**

- **Periodic polling** (every N seconds) to pick up changes from
  other tabs. Considered. Rejected — adds complexity, battery
  drain, and the Tracker doesn't do this either. Multi-tab users
  who care can refresh manually.
- **`BroadcastChannel` cross-tab sync.** Same as polling but
  cleaner. Still rejected — multi-tab consistency is not a v1
  requirement.

**Tradeoffs accepted:**

- A user who marks an application accepted in one tab and then
  visits the Calendar in another tab will see stale data until
  refresh. Documented in spec §Edge Cases.

---

## 13. Loading state on mount

**Decision:** Render the page chrome immediately (header, panel
shells, grid shell). Show a small "Loading…" placeholder inside the
sections until `api.getAll()` resolves. On failure, show the empty
states + a toast.

**Rejected alternatives:**

- **Render nothing until data arrives.** Bad UX on slow networks.
- **Full-page skeleton.** Larger scope; pattern not used elsewhere.
  Rejected for v1.

---

## 14. Suggestion meta-line wording

**Decision:** Use design §7's voice — factual, neutral, lower-case
day shorthand: "7d since application", "14d · last touched May 6".
Strings live in `src/utils/calendarSuggestions.js` so they're
testable and centrally findable.

**Rejected alternatives:**

- **Long-form** ("It has been 7 days since you applied"). Verbose.
- **i18n abstraction.** Out of scope; the app has no i18n
  infrastructure today.

---

## 15. Status-filter UX

**Decision:** Single-select status filter affecting the Month Grid
only. Filtered-out cells render at 35% opacity (still clickable to
view full-day popover). Action Panel and Day Popover are
filter-independent.

**Rejected alternatives:**

- **Multi-select filter.** More flexible, more UI complexity, and
  the design picks single-select.
- **Filter affects Action Panel too.** Would tightly couple the
  two surfaces and break the "Action Panel is the operational
  dashboard, grid is the visualization" separation the design
  establishes.
- **Hide filtered cells.** Layout would reflow, breaking the
  always-6-weeks invariant. 35% opacity is a deliberate compromise.

---

## 16. Status display-priority constant — home (spec review i4)

**Decision:** `STATUS_DISPLAY_PRIORITY` lives in
[src/models/application.js](../../src/models/application.js)
alongside the existing status taxonomy (`STATUS_VALUES`,
`STATUS_CONFIG`, `TRANSITIONS`, `TERMINAL_STATES`). Imported by
MonthGrid (chip ordering), StatusFilterDropdown (filter row
ordering), DayPopover (all-mode grouping), and the seed-coverage
test.

**Rejected alternatives:**

- **`src/utils/calendar.js`** — co-locates with date math + year
  range. Considered, rejected because the constant is a
  status-taxonomy fact, not a Calendar-feature concept. Burying a
  status-taxonomy fact inside a date util module makes future
  reuse awkward (e.g. a Tracker-side "sort by status priority"
  feature would have to cross-import a Calendar util).
- **`src/utils/calendarProjection.js`** — co-locates with
  `projectTimelineToCalendar`. Considered, rejected for the same
  reason — too feature-scoped.
- **`src/utils/statusPriority.js` (new module)** — single-
  responsibility module. Rejected as over-decomposition; a 10-item
  constant doesn't deserve its own file.

**Tradeoffs accepted:**

- Slightly broadens `src/models/application.js`'s footprint (model
  file now exports a UX-priority concept). Mitigated by:
  - Naming: `STATUS_DISPLAY_PRIORITY` signals "for UI ordering",
    not "for state-machine logic" — guards against accidental
    misuse as a transition key.
  - JSDoc comment block at the export site reiterates the intent.
  - `Object.freeze` prevents accidental mutation by importers.
