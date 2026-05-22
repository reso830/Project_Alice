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

### Layout & responsiveness

- [ ] Wide desktop (≥1200px): Action Panel + Month Grid side-by-side,
      ~40/60 split.
- [ ] Narrow desktop (640–1199px): stacked vertically, Action Panel
      above Grid.
- [ ] Mobile (<640px): stacked vertically, compact spacing, smaller
      cells/chips.

### Action Panel

- [ ] Greeting line shows a time-appropriate phrase. Refresh — phrase
      may change (uniform random per page-load).
- [ ] Today section: lists every application with a timeline entry
      dated today. Empty state shows when none.
- [ ] Suggested Actions: lists rows for each of the 5 suggestion
      kinds (seeded). Each row's primary action is `↗` except the
      ghost row, which is `Mark Ghosted` (text button).
- [ ] Upcoming: shows `Tomorrow` and `Rest of week` groups. Entries
      beyond this Sunday don't appear.
- [ ] Empty state copy matches design §6.5.
- [ ] Count pill is hidden when a section is empty; visible otherwise.

### Month Grid

- [ ] Always exactly 6 weeks visible.
- [ ] ISO Monday-start. Verify: the leftmost day column is `Mon`.
- [ ] ISO calendar-week column on the far left shows correct week
      numbers. Spot-check: navigate to a Dec/Jan boundary month and
      confirm Dec 30 and similar boundary days show the *next* year's
      week number (W01 etc.).
- [ ] Today's cell is highlighted (indigo border + filled day pill).
- [ ] Numbered chips render in priority order; max 3 chips + `+N`
      overflow.
- [ ] Out-of-month cells render with subdued background and grey day
      number; chips still visible.
- [ ] Weekend cells have a slightly different background tint.

### Day Popover

- [ ] Click a status chip → popover opens in **status mode**, listing
      only that status's activities for that day.
- [ ] Click the date number → popover opens in **all mode**, listing
      every activity for that day.
- [ ] Click the `+N` overflow chip → popover opens in **all mode**.
- [ ] Click a row in the popover → popover closes and the Application
      Overlay opens.
- [ ] Escape closes the popover.
- [ ] Backdrop click closes the popover.
- [ ] Mobile: popover becomes a bottom sheet with drag handle.

### Navigation

- [ ] Prev / Next month arrows shift the view.
- [ ] At Jan 2020, Prev arrow is disabled.
- [ ] At Dec (currentYear+5), Next arrow is disabled.
- [ ] Click the month name → Month Picker opens. Pick another month
      → grid updates; year unchanged.
- [ ] Click the year → Year Picker opens. Navigate decades; out-of-range
      years are disabled. Picking a year updates the grid; month
      unchanged.
- [ ] Today button: visible only when viewing a non-current month.
      Clicking it returns to today.

### Status filter

- [ ] Filter chip starts at "Status: All", neutral styling.
- [ ] Open the dropdown, pick `Interview`. Filter chip switches to
      active styling (indigo); a small clear (×) button appears
      next to it.
- [ ] Month Grid cells without `Interview` activity dim to ~35%
      opacity. Layout does not shift.
- [ ] **Action Panel remains unaffected** by the filter.
- [ ] **Day popovers remain unaffected** by the filter (all-mode
      still shows everything; status-mode is always the clicked
      chip's status).
- [ ] Click the clear (×) button → filter resets.

### Mark Ghosted

- [ ] Find a ghost suggestion row (seeded; status applied/phone_screen/
      interview/assessment/offer with 14+ days of inactivity).
- [ ] Click `Mark Ghosted`.
- [ ] Toast appears: "Marked #{ID} as Ghosted".
- [ ] Row disappears from Suggested Actions.
- [ ] Open the application in the Tracker — status is now `ghosted`,
      a new timeline entry exists at today's date with text
      "Marked as ghosted after prolonged inactivity.",
      `lastStatusUpdate` is bumped to today.

### Dismiss

- [ ] Dismiss any suggestion via the `×` button.
- [ ] Row exits immediately. No toast.
- [ ] Reload the page. The same suggestion does **not** reappear.
- [ ] Dismiss a different kind on the same application. The first
      kind is still suppressed; the second kind is now also
      suppressed.

### Open Application Overlay

- [ ] Click `↗` on a Today / Upcoming / Suggestion row → overlay
      opens for the correct application.
- [ ] Click a row inside a Day Popover → popover closes, overlay
      opens for that application.
- [ ] Edit something in the overlay, save → Calendar's Action Panel
      and Grid reflect the change (the application list refreshes).

### Accessibility

- [ ] Tab traversal reaches every action button, chip, cell-with-
      activity, and popover/picker control.
- [ ] Visible focus ring on every focused element.
- [ ] Escape closes any open popover/picker/bottom-sheet.
- [ ] ISO week gutter cells are not in the tab order (aria-hidden).
- [ ] Status is communicated by BOTH color and label/count (chip
      shows count; popover row shows status label) — verified with
      a colorblind-simulation browser extension or by inspecting the
      DOM.

### Cross-page regression pass

- [ ] Visit the Tracker — cards render unchanged, status badges
      unchanged, modal opens unchanged.
- [ ] Trigger a status change from the Tracker's modal — Timeline
      auto-entry behavior from feature 025 still works.
- [ ] Visit the Profile page — layout unchanged.

### localStorage behavior

- [ ] Open dev tools → Application → Local Storage. After dismissing
      one suggestion, a key `alice:calendar:dismissals:{userIdentityToken}`
      exists with a JSON array containing the dismissal record.
- [ ] Hosted mode: log out and log in as a different user. The new
      user's Calendar should not show the previous user's dismissals.
      Confirm by inspecting the keys — each user has their own.
- [ ] Manually clear the key in dev tools. Reload the Calendar — the
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
npm run format -- --check
npm run test:run
```

All three must pass before promoting the deploy.
