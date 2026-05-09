# Quickstart: 012-inline-edit-overlay

How to get the dev environment running and verify the feature end-to-end.

---

## Switch to the feature branch

```powershell
git checkout 012-inline-edit-overlay
```

---

## Install dependencies (if needed)

```powershell
npm install
```

---

## Start the dev server

```powershell
npm run dev
```

Opens the app at `http://localhost:5173` (Vite) with the Express backend on port `3001` (or as configured). Both run concurrently via the dev script.

---

## Reset the database (optional — clean slate)

```powershell
node server/db-clear.js
node server/db-seed.js     # re-seeds with sample data
```

After running `db-clear.js`, the new columns will be created on the next server start because `initSchema()` is called on boot and `ensureColumn` is idempotent.

The updated seed includes new field values across all 23 records:
- All four `shift` values (Day, Mid, Night, Flexible) are represented
- All four `workSetup` values (Remote, Hybrid, On-site, Field) are represented
- Several records intentionally have `null` for new fields — this is valid and shows optionality
- `preferredSkills` values are present on 6 records; the rest have `null`

---

## Verify the schema migration

Open the SQLite DB and check the new columns exist:

```powershell
# requires sqlite3 CLI
sqlite3 data/alice.db ".schema applications"
```

Expected output includes:
```
location TEXT
shift TEXT
work_setup TEXT
compat_notes TEXT
general_notes TEXT
preferred_skills TEXT
```

---

## Manual test: new fields round-trip

1. Open the app → click any application card.
2. The overlay opens. Verify the new fields are visible (Location, Shift, Work Setup, Compatibility Notes, General Notes, Required Skills, Preferred Skills).
3. Click Location → type a value → click outside. Footer appears.
4. Click Shift → select a value from dropdown.
5. Click Save. Toast "Saved." should appear.
6. Close and reopen the same card. Verify values persist.

---

## Manual test: Create mode

1. Click "+ New application" in the toolbar.
2. Overlay opens with empty fields, status "Wishlisted", footer visible, Create button disabled.
3. Fill Job Title and Company. Create button enables.
4. Fill optional fields including Location and Shift.
5. Click Create. Toast "Application created." New card appears in the list.

---

## Manual test: Discard confirmation

1. Open any application card.
2. Edit a field (e.g., Location).
3. Click ✕ or the backdrop or press Esc.
4. Confirm dialog appears. Click "Keep editing" — dialog closes, edits intact.
5. Repeat, then click "Discard" — modal closes, no changes saved.

---

## Manual test: new filters

1. Ensure at least two applications have different Shift or Work Setup values (edit via overlay).
2. Click the Shift filter button in the toolbar.
3. Select "Day". Only applications with Shift = Day should appear.
4. Clear the filter. All applications return.

---

## Run the test suite

```powershell
npm test
```

Key test files for this feature:

```
tests/server/validation.test.js       # new field Zod rules
tests/server/applications.test.js     # create/update with new fields
tests/server/persistence.test.js      # schema migration
tests/models/application.test.js      # normalizeApplication, new constants
tests/utils/filterSort.test.js        # new filter functions
tests/components/Modal.test.js        # inline edit, draft state, create/discard
tests/pages/Tracker.test.js           # onAddApplication, filter state normalization
```

---

## Common issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| New columns missing in DB | Server not restarted after schema change | Restart dev server; `initSchema()` runs on boot |
| Filter buttons not appearing | `QuickFiltersToolbar` not updated | Check that new buttons are appended in `render()` |
| Create button always disabled | Required field check not wired | Verify `_draft.jobTitle` and `_draft.companyName` are checked on each field commit |
| Discard dialog appears twice | Backdrop click + Esc both firing | Check that `_attemptClose()` is idempotent and dialog is singleton |
