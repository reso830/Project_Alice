# Quickstart: Calendar (026)

Local setup and manual smoke validation for the Calendar feature.
This document is operator-facing and assumes the reader already has
the repo running locally (per the root `README.md`).

---

## 1. Prerequisites

- Feature 025 (Application Timeline) is merged. Every application row
  must have a `timeline` field (the Calendar projection has nothing
  to render otherwise).
- Local SQLite or hosted Supabase backend already booted.
- `npm install` already run.

If you are running against an existing hosted environment, see
§4 below for the one-time `claim_and_seed_starter` RPC update so new
hosted users see suggestion-triggering starter rows.

---

## 2. Run locally

```sh
npm run dev              # starts the Express API on :3001
                         # and Vite dev server on :5173
```

Open `http://localhost:5173`, navigate to **Calendar** in the top
nav (or the bottom tab on mobile).

You should see:

- A greeting line ("Good morning, …" or similar) and today's date.
- Today / Suggested Actions / Upcoming sections — each populated or
  showing its empty state.
- A month grid showing the current month with 6 rows of cells.
- An ISO week column on the left labeled `CW`.

---

## 3. Reset the local SQLite seed (optional)

The local seed (`server/seeds/applicationsData.js`) was augmented in
this feature so that each of the 5 suggestion kinds fires for at
least one application. If you have an older local DB, re-seed:

```sh
npm run db:clear
npm run db:seed
```

Then reload the Calendar page. You should now see at least one row
in **Suggested Actions** for each of:

- `followup` (Applied + 7d+)
- `feedback` (Phone Screen + 5 business days+)
- `interview_followup` (Interview + 7d+)
- `offer_expiry` (Offer + 3-5d ago)
- `ghost` (any non-terminal non-wishlisted status + 14d+)

---

## 4. Hosted environment — RPC update

Operators on hosted Supabase need to apply one additional SQL block
to refresh the `claim_and_seed_starter()` function. This is the
**only** server-side change in feature 026, and it is **only**
needed for hosted environments that want new users to see
suggestion-triggering starter rows.

The canonical RPC body lives in
[`docs/db/claim_and_seed_starter.md`](../../docs/db/claim_and_seed_starter.md)
(established as the canonical home by feature 025).

Procedure:

1. Open the Supabase project SQL editor.
2. Paste the updated `CREATE OR REPLACE FUNCTION
   claim_and_seed_starter() …` block from
   `docs/db/claim_and_seed_starter.md`.
3. Execute.
4. Verify with:

   ```sql
   SELECT proname, prosrc
   FROM pg_proc
   WHERE proname = 'claim_and_seed_starter';
   ```

5. Old hosted users (already seeded) are unaffected. New hosted
   users on their first authenticated request will get the updated
   starter rows automatically.

If you skip this step, hosted-mode new users will see the
feature-025 starter rows without any suggestion-triggering data.
The Calendar still renders correctly; it just may show empty
Suggested Actions until the user logs more activity.

---

## 5. Demo mode

Demo mode reuses `src/data/demoSeed.js`, which was augmented in
lockstep with the local SQLite seed. The portfolio demo automatically
shows all five suggestion kinds without any operator action.

Open `http://localhost:5173`, click **Try the demo** on the welcome
page, then navigate to **Calendar**. Suggestions should populate.

---

## 6. Manual smoke test (final phase per constitution)

Walk these scenarios in a real browser against the to-be-merged
state (NOT against a dev build). Per Amendment 1.3.0, this test
runs AFTER Release Prep, so the build under test is the same build
that will be promoted.

> **v0.13.1 note:** This checklist was last walked in full for v0.13.0
> and surfaced 22 observations. The unchecked (`[ ]`) rows below are
> the items that either (a) failed on v0.13.0, (b) are new acceptance
> criteria from the v0.13.1 design changes, or (c) were untestable on
> v0.13.0 (the Day Popover block was retired in favor of the Inline
> Day Panel — see `docs/design/calendar.md §17`). Tick them during
> Phase 13's re-smoke (`tasks.md §13.5`).

### Layout & responsiveness

- [X] Wide desktop (≥1200px): Action Panel + Month Grid side-by-side,
      ~40/60 split.
- [X] Narrow desktop (640–1199px): stacked vertically, Action Panel
      above Grid.
- [X] Mobile (<640px): stacked vertically, compact spacing, smaller
      cells/chips.

### Action Panel

- [X] Greeting line shows a time-appropriate phrase. Refresh — phrase
      may change (uniform random per page-load).
- [X] Greeting includes the active profile's display name
      (`"{Greeting}, {Name}"`); without a name, no trailing comma.
- [X] Today section: lists every application with a timeline entry
      dated today. Empty state shows when none.
- [X] Suggested Actions: lists rows for each of the 5 suggestion
      kinds (seeded). Each row's primary action is `↗` except the
      ghost row, which is `Mark Ghosted` (text button).
- [X] Upcoming: shows `Tomorrow` and `Rest of week` groups. Entries
      beyond this Sunday don't appear.
- [X] Empty state copy matches design §6.5.
- [X] Empty `.cal-empty` block has no dashed border and no
      brown-tinted background.
- [X] Count pill is hidden when a section is empty; visible otherwise.

### Month Grid

- [X] Always exactly 6 weeks visible.
- [X] ISO Monday-start. Verify: the leftmost day column is `Mon`.
- [X] ISO calendar-week column on the far left shows correct week
      numbers. Spot-check: navigate to a Dec/Jan boundary month and
      confirm Dec 30 and similar boundary days show the *next* year's
      week number (W01 etc.).
- [X] DOW labels and CW numbers render at weight 500 (not bold); CW
      numbers center-align horizontally and middle-align vertically
      to each day-row.
- [X] Today's cell is highlighted (indigo border + filled day pill).
- [X] Day numbers render at Sora 11 / weight 500 (not bold).
- [X] Numbered chips render in priority order; max 3 chips + `+N`
      overflow. Chips are **non-interactive** in v2 (no role/tab/click);
      only the cell is selectable.
- [X] Out-of-month cells render with subdued background and grey day
      number; chips still visible.
- [X] Weekend cells have a slightly different background tint.
- [X] Out-of-month vs. weekend hues are distinguishable at a glance
      against the white in-month background.

### Inline Day Panel (v2 — replaces the Day Popover)

The day-popover surface from v0.13.0 was retired in v0.13.1. Day
detail is now an **inline panel** below the Month Grid in the same
card (see `docs/design/calendar.md §17`). Walk these instead:

- [X] On first load, the panel renders the **prompt** state
      ("Select a date / Tap any date to see activity"); no row is
      selected.
- [X] Clicking an in-month cell with activities populates the panel
      with that day's activities, grouped by status priority (variant A).
- [X] Clicking an in-month cell with **no** activities shows the
      **empty-day** state with a plain "No events" headline (no glyph,
      no sub-line, no dashed border).
- [X] Clicking a numbered chip selects the cell (chip is not its own
      target); the panel updates to the full day.
- [X] Clicking the `+N` overflow chip selects the cell (same — chip
      is decorative; cell is the selectable surface).
- [X] Selecting a different date replaces the panel body in place.
      The cell selection ring (navy) moves with you.
- [X] Today + selected stacks: the cell ring is indigo (not navy).
- [X] Clicking a row in the panel opens the Application Overlay.
- [X] Out-of-month cells stay non-selectable (cursor default; no
      ring on click).
- [X] On mobile, the panel is **inline** below the grid (no bottom
      sheet for day details).

### Navigation

- [X] Prev / Next month arrows shift the view.
- [X] At Jan 2020, Prev arrow is disabled.
- [X] At Dec (currentYear+5), Next arrow is disabled.
- [X] Month name renders as a **text-style trigger** (no border, no
      box), Sora; hover changes the color. No chevron-down caret after
      the year.
- [X] Year renders in the same text-style treatment as the month
      name (both Sora; no font mixing).
- [X] Click the month name → Month Picker opens. Pick another month
      → grid updates; year unchanged.
- [X] Month Picker anchors **directly under** the month-name trigger
      on desktop and tablet (was off-anchor on v0.13.0).
- [X] Month Picker header has **no** "Jump to month" label.
- [X] Click the year → Year Picker opens. Navigate decades; out-of-range
      years are disabled. Picking a year updates the grid; month
      unchanged.
- [X] Year Picker anchors directly under the year trigger on
      desktop and tablet.
- [X] Year Picker header has **no** "Jump to year" label; the
      `{start} – {start+11}` range label uses the same font/weight as
      the year buttons below it.
- [X] Today button: visible only when viewing a non-current month.
      Clicking it returns to today.
- [X] Grid header renders as a **single row** at every breakpoint
      (desktop, tablet, mobile). No wrapping on mobile.

### Status filter

- [X] Filter trigger is a **30×30 icon button** (funnel glyph when
      idle, status swatch when active) — same control on desktop and
      mobile. Mirrors Tracker's quick-filter status button.
- [X] Open the dropdown, pick `Interview`. The icon button switches
      to the active variant (indigo ring + status swatch); a small
      clear (×) button appears next to it.
- [X] Dropdown anchors directly under the filter icon button on
      desktop and tablet.
- [X] Month Grid: only days with at least one matching activity stay
      at full opacity. Every other cell (non-matching days AND empty
      days) dims to ~35% opacity. Layout does not shift.
- [X] **Action Panel remains unaffected** by the filter.
- [X] **Inline Day Panel remains unaffected** by the filter
      (selecting a date shows all of that day's activities regardless
      of the grid filter).
- [X] Click the clear (×) button → filter resets.
- [X] Status labels: the assessment status reads **"Technical"**
      (not "Technical Assessment") in chips, status badges, the inline
      panel, the filter dropdown, and the Tracker.

### Mark Ghosted

- [X] Find a ghost suggestion row (seeded; status applied/phone_screen/
      interview/assessment/offer with 14+ days of inactivity).
- [X] Click `Mark Ghosted`.
- [X] Toast appears: "Marked #{ID} as Ghosted".
- [X] Row disappears from Suggested Actions.
- [X] Open the application in the Tracker — status is now `ghosted`,
      a new timeline entry exists at today's date with text
      "Marked as ghosted after prolonged inactivity.",
      `lastStatusUpdate` is bumped to today.

### Dismiss

- [X] Dismiss any suggestion via the `×` button.
- [X] Row exits immediately. Toast appears: **"Suggestion dismissed"**
      (was silent in v0.13.0).
- [X] Reload the page. The same suggestion does **not** reappear.
- [X] Dismiss a different kind on the same application. The first
      kind is still suppressed; the second kind is now also
      suppressed.

### Open Application Overlay

- [X] Click `↗` on a Today / Upcoming / Suggestion row → overlay
      opens for the correct application.
- [X] Click a row inside the **Inline Day Panel** → overlay opens
      for that application. (The cell selection ring stays — the panel
      does not collapse.)
- [X] Edit something in the overlay, save → Calendar's Action Panel,
      Grid, and inline panel reflect the change (the application list
      refreshes).

### Accessibility

- [X] Tab traversal reaches every action button, **every in-month
      cell** (with or without activity, per v2), picker controls, and
      panel rows.
- [X] Numbered chips are **not** in the tab order in v2 (they're
      decorative); cells are the keyboard target.
- [X] Visible focus ring on every focused element.
- [X] Escape closes any open picker/bottom-sheet.
- [X] ISO week gutter cells are not in the tab order (aria-hidden).
- [X] Cell `aria-label` includes "no activity" for empty in-month
      cells; `aria-pressed` reflects selection.
- [X] Inline Day Panel root has `aria-live="polite"` — screen reader
      announces the date + entry count when selection changes.
- [X] Status is communicated by BOTH color and label/count (chip
      shows count; panel row shows status badge) — verified with a
      colorblind-simulation browser extension or by inspecting the
      DOM.

### Cross-page regression pass

- [X] Visit the Tracker — cards render unchanged, status badges
      unchanged, modal opens unchanged.
- [X] Trigger a status change from the Tracker's modal — Timeline
      auto-entry behavior from feature 025 still works.
- [X] Visit the Profile page — layout unchanged.

### localStorage behavior

- [X] Open dev tools → Application → Local Storage. After dismissing
      one suggestion, a key `alice:calendar:dismissals:{userIdentityToken}`
      exists with a JSON array containing the dismissal record.
- [X] Hosted mode: log out and log in as a different user. The new
      user's Calendar should not show the previous user's dismissals.
      Confirm by inspecting the keys — each user has their own.
- [X] Manually clear the key in dev tools. Reload the Calendar — the
      dismissed suggestion reappears.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Calendar page is blank | `api.getAll()` failed | Check the Express server is running on :3001; check the network tab for errors. |
| No suggestions appear at all | Local DB has not been re-seeded since feature 026, or all applications are in terminal states | Run `npm run db:clear && npm run db:seed`. |
| Suggestions reappear after dismissal + reload | `localStorage` is unavailable (private mode, quota) | Exit private mode, or accept the limitation per spec edge case. A `console.warn` should be visible in the browser console. |
| Mark Ghosted shows a failure toast | The application's status changed in another tab/session, or the transition is invalid | Refresh the page to pick up the current server state. |
| ISO week column shows wrong numbers near year boundaries | Implementation regression in `isoWeekNumber` | Run `npm run test -- tests/utils/calendar.test.js` — boundary test cases should catch this. |
| Hosted new users don't see suggestion-triggering starter rows | The `claim_and_seed_starter` RPC was not updated | Apply the SQL block from `docs/db/claim_and_seed_starter.md`. |

---

## 8. Out-of-band verification (one-shot at merge time)

```sh
npm run lint
npm run test:run
```

Both must pass before promoting the deploy. (No `format` script
exists in this repo — earlier docs that referenced
`npm run format -- --check` were inherited boilerplate.)
