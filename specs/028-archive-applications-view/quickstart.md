# Quickstart â€” 028 Archive Applications View

Walks a developer through the smallest viable verification of this feature in a real running app. Use this after the implementation phases conclude, in tandem with the constitution-mandated Browser Smoke Test (Amendment 1.1.0).

## Prerequisites

- Node, npm, and the project's existing local toolchain are installed (see root README).
- You are on the `028-archive-applications-view` branch.
- Tests pass: `npm test`.
- Lint/format pass: `npm run lint` and `npm run format:check` (or whatever the project's standard verbs are â€” confirm against `package.json`).

## 1 Â· Local mode (SQLite)

### 1.1 Â· Reset the local database (optional, for a clean slate)

```bash
node server/db-clear.js
node server/db-seed.js
```

This gives you a known seed set of active applications.

### 1.2 Â· Start the app

```bash
npm run dev
```

The Tracker should load with several active applications and no archived rows yet.

### 1.3 Â· Archive a row

1. On any card, click the `Ã—` (Archive) button. Confirm the dialog. The row should disappear from the Active list and a toast should appear.
2. **Verify `fav` preservation:** if you star a row first (â˜… button) and *then* archive it, the row's `fav` should remain `true` in the database. Open `server/db.js`'s SQLite DB in a viewer (or `sqlite3 server/data.db 'SELECT id, fav, archived, archived_date FROM applications WHERE archived = 1;'`) and confirm `fav = 1` for the just-archived row.

### 1.4 Â· Open the Archived view

- Click the toolbar chip labeled `Applications â–¾`. A popup opens listing `Applications` and `Archived` with their counts.
- Click `Archived`. The URL changes to `//?view=archived`. The list shows only the archived row. The chip now reads `Archived â–¾`.
- The `+ New application` button is hidden in the toolbar.

### 1.5 Â· Open the archived overlay

- Click the body of the archived card (not the â†º button). The Application Overlay opens.
- Verify: an `ARCHIVED` chip appears in the header next to the status badge. Only â†º and âœ• are present in the header action cluster. No â˜…, â‡„, or ðŸ—„. No Save/Discard footer.
- Click any field (Company, Salary, etc.) â€” nothing happens.
- Press Esc. The overlay closes immediately (no discard confirmation).

### 1.6 Â· Unarchive from the card

- Click the â†º button on the archived card.
- The row disappears from the Archived list. A toast reads `Unarchived.`. No confirmation dialog appeared.
- Switch back to the Active view (toolbar chip). The row is present.
- Verify in SQLite: `archived = 0`, `archived_date = NULL`, `fav = 1` (preserved through the round-trip), `status` unchanged from pre-archive.

### 1.7 Â· Unarchive from the overlay

- Archive a row again. Switch to Archived view. Click the card body (not â†º). The overlay opens in archived mode.
- Click â†º in the overlay header. The overlay closes, the row leaves the Archived list, toast `Unarchived.` appears.

### 1.8 Â· Verify Profile entry point

- Navigate to the Profile page.
- Confirm the `Archived applications Â· N â†’` link is present and the count `N` matches your current archived row count (try with 0, 1, 2 â€” the link should always render even at 0).
- Click the link. The URL becomes `//?view=archived` and the Archived view is the initial state (no flash of the Active view).

### 1.9 Â· Verify Calendar exclusion

- Archive a row that has a Timeline entry dated today (you can use the Modal in Edit mode to add a timeline entry to a row before archiving).
- Open the Calendar. The row should **not** appear in the Today section, Suggested Actions, Upcoming, or the Month Grid's status chips for that day.
- Unarchive the row. Reload the Calendar. The row's activity reappears.

### 1.10 Â· URL deep link

- Manually navigate to `//?view=archived`. The Archived view loads as the initial state, not after a flash of Active.
- Reload the page. The Archived view remains active.

## 2 Â· Demo mode

### 2.1 Â· Enter demo mode

From the Welcome page, click the `Try the demo` CTA. The Tracker loads with demo seed data.

### 2.2 Â· Verify seed archived rows

- The Active list shows the active seed rows.
- Switch to the Archived view (toolbar chip). Two seeded archived rows should be visible.
- Open one â€” overlay opens in archived mode (read-only).
- Unarchive one â€” it disappears from the Archived list and reappears in the Active list.

### 2.3 Â· Verify no persistence

- Archive an active row. Reload the page.
- The archived row reverts to its seeded active state (demo mode does not persist; feature 020 FR-004).

## 3 Â· Hosted mode (Supabase)

### 3.1 Â· Apply the migration

The Supabase migration adds `archived_date date NULL` to the `applications` table. Paste the SQL block from [data-model.md Â§ 1.3](data-model.md#13--migration-supabase-hosted) into the Supabase SQL editor (this project does not use Supabase CLI migration files â€” see [025-application-timeline/data-model.md Â§ 4.1](../025-application-timeline/data-model.md#L165-L175) for the canonical inline-SQL pattern).

### 3.2 Â· Sign in

Sign in with a test account on the preview deploy.

### 3.3 Â· Repeat sections 1.3â€“1.10

Hosted-mode behavior must be identical to local mode. Pay particular attention to:

- The `archived_date` column populates after archive (inspect via the Supabase dashboard or `SELECT archived_date FROM applications WHERE id = ...;` in the SQL editor).
- `fav` is preserved across archive â†” unarchive (FR-009).
- A second user signing in cannot see the first user's archived rows.

### 3.4 Â· Pre-feature archived rows (legacy)

If the hosted dataset contains rows that were archived *before* this feature deployed (and therefore have `archived_date = NULL`):

- Switch to the Archived view.
- Confirm the card date-stamp reads `Archived ${lastStatusUpdate}` (not literal "null").

## 4 Â· Test commands

```bash
# Server-side: routes, repos, validation
npm test -- tests/server

# Client-side: components, pages, services, data
npm test -- tests

# Full suite
npm test
```

Per the project constitution (V), tests must pass before the Release Prep phase is considered complete.

## 5 Â· Acceptance gate

The feature is ready for the constitution-mandated Browser Smoke Test (Amendment 1.1.0 + 1.3.0) when all of the following hold:

- [X] `npm test` passes.
- [X] Lint and format checks pass.
- [X] Steps 1.3â€“1.10 pass on local mode in a real browser.
- [X] Steps 2.1â€“2.3 pass on demo mode in a real browser.
- [X] Steps 3.1â€“3.4 pass on a hosted preview deploy in a real browser, on desktop AND mobile viewports.
- [X] `CHANGELOG.md` lists the feature with the `fav` behavior change called out.
- [X] `docs/REPO_MAP.md` is updated for any new files (Modal mode addition, view-chip component, etc.).
- [X] `docs/deployment.md` documents the Supabase migration if env-vars or migration steps are required.

After all boxes are checked, proceed to the final Browser Smoke Test phase against the to-be-merged branch state (per Amendment 1.3.0, smoke test follows Release Prep).
