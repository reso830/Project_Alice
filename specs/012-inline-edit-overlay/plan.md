# Technical Plan: Enhanced Job Metadata & Inline Editing Overlay

**Feature Branch**: `012-inline-edit-overlay`  
**Created**: 2026-05-08  
**Spec**: [spec.md](./spec.md)  
**Status**: Draft

---

## Architecture

This feature touches five distinct layers, each independently deployable in phase order:

```
┌─────────────────────────────────────────────────────┐
│  Layer 5 · Filter Expansion                          │
│  filterSort.js · QuickFiltersToolbar.js · Tracker.js │
├─────────────────────────────────────────────────────┤
│  Layer 4 · Modal Overlay (largest change)            │
│  src/components/Modal.js                             │
├─────────────────────────────────────────────────────┤
│  Layer 3 · Client Model                              │
│  src/models/application.js                           │
├─────────────────────────────────────────────────────┤
│  Layer 2 · Server Data + Validation                  │
│  server/db/applications.js · validation/application  │
├─────────────────────────────────────────────────────┤
│  Layer 1 · Database Schema                           │
│  server/db.js (ensureColumn pattern)                 │
└─────────────────────────────────────────────────────┘
```

---

## Data Model

### New DB columns (all optional TEXT, nullable)

| JS field          | DB column         | Type | Notes                                      |
|-------------------|-------------------|------|--------------------------------------------|
| `location`        | `location`        | TEXT | Free-text                                  |
| `shift`           | `shift`           | TEXT | Enum: Day, Mid, Night, Flexible            |
| `workSetup`       | `work_setup`      | TEXT | Enum: Remote, Hybrid, On-site, Field       |
| `compatNotes`     | `compat_notes`    | TEXT | Free-text                                  |
| `generalNotes`    | `general_notes`   | TEXT | Free-text                                  |
| `preferredSkills` | `preferred_skills`| TEXT | JSON array, same serialization as `skills` |

**Note on `skills`:** The existing `skills` column is kept as-is; it is labelled "Required Skills" in the UI. No data migration is needed.

### Migration strategy

The project already uses `ensureColumn(targetDb, table, column, definition)` in `server/db.js`. Six new `ensureColumn` calls are added inside `initSchema()`. SQLite sets NULL for new columns on existing rows — safe, no backfill required.

---

## Data Flow

### Edit flow (open existing application)

```
User clicks card
  → Tracker.onOpen(id) calls api.getById(id)
  → Modal.open(application, { mode: 'edit', ... })
  → Modal renders body with all fields (display mode)

User clicks a field
  → field swaps to input/select/textarea
  → outside-click (blur) commits value to _draft
  → _isDirty() → footer shown

User clicks Save (or Cmd/Ctrl+S)
  → api.update(id, _draft)
  → on success: onApplicationUpdate(updated), toast "Saved.", modal stays open
  → on failure: error toast, _draft retained

User attempts close (✕ / backdrop / Esc) while dirty
  → ConfirmDialog.show("Discard changes?")
  → "Keep editing" → dialog dismissed
  → "Discard" → Modal.close()
```

### Create flow (new application)

```
User clicks "+ New application"
  → Tracker.onAddApplication() calls Modal.open(null, { mode: 'create', ... })
  → _draft = empty application, status = 'wishlisted'
  → footer always visible, Create button disabled until jobTitle + companyName filled

User fills fields, clicks Create
  → api.create(_draft)
  → on success: onApplicationCreate(newRecord), toast "Application created."
  → modal switches to Edit mode with the saved record as _original
  → on failure: error toast, _draft retained
```

### Filter flow (new fields)

```
User clicks Shift / Work Setup / Location filter button
  → FilterPanel rendered with available values from _applications
  → user selects value → onFilterChange callback
  → filterState updated with shifts/workSetups/locations arrays
  → applyFilters() chains new filter steps
  → Tracker re-renders card list + updates toolbar
  → filterState persisted to localStorage
```

---

## Component Changes

### Layer 1 — `server/db.js`

Add six `ensureColumn` calls after the CREATE TABLE statement:

```js
ensureColumn(targetDb, 'applications', 'location',         'TEXT');
ensureColumn(targetDb, 'applications', 'shift',            'TEXT');
ensureColumn(targetDb, 'applications', 'work_setup',       'TEXT');
ensureColumn(targetDb, 'applications', 'compat_notes',     'TEXT');
ensureColumn(targetDb, 'applications', 'general_notes',    'TEXT');
ensureColumn(targetDb, 'applications', 'preferred_skills', 'TEXT');
```

---

### Layer 2 — `server/db/applications.js`

**`FIELD_TO_COLUMN`** — add six new mappings.

**`INSERTABLE_COLUMNS`** — add six new column names.

**`toRecord(row)`** — add six new fields. `preferred_skills` uses `parseJson(row.preferred_skills, [])`.

**`toRow(fields)`** — `preferredSkills` serialized with `JSON.stringify(Array.isArray(value) ? value : [])`, same as `skills`.

---

### Layer 2 — `server/validation/application.js`

Add to `writableFields`:

```js
location:       optionalText,
shift:          z.enum(['Day', 'Mid', 'Night', 'Flexible']).or(emptyString).optional(),
workSetup:      z.enum(['Remote', 'Hybrid', 'On-site', 'Field']).or(emptyString).optional(),
compatNotes:    optionalText,
generalNotes:   optionalText,
preferredSkills: z.array(z.string()).optional(),
```

No changes to route handlers — the generic `create`/`update` functions pass validated fields through.

---

### Layer 3 — `src/models/application.js`

**New exports:**

```js
export const SHIFT_VALUES = ['Day', 'Mid', 'Night', 'Flexible'];
export const WORK_SETUP_VALUES = ['Remote', 'Hybrid', 'On-site', 'Field'];
```

**`normalizeApplication()`** — add defaults for all six new fields. String fields default to `''`; `preferredSkills` defaults to `[]`.

**`validateApplication()`** — coerce `shift` and `workSetup` to `''` when value is not in the allowed set (same approach as status coercion).

---

### Layer 4 — `src/components/Modal.js` *(largest change)*

The current module (~370 lines, view-only) is substantially reworked. The public API is extended:

```js
Modal.open(application | null, {
  mode: 'edit' | 'create',   // 'edit' when application is provided, default
  onApplicationUpdate,        // called after successful save
  onApplicationCreate,        // called after successful create
  onArchiveSuccess,
})
Modal.close()
```

#### Module-level state

```js
let _draft      = null;   // local working copy
let _original   = null;   // null in create mode
let _mode       = null;   // 'edit' | 'create'
let _backdrop   = null;
let _footer     = null;
let _panel      = null;
let _editingField = null;
```

#### `_isDirty()`

Shallow comparison of `_draft` vs `_original`. Arrays (`skills`, `preferredSkills`) compared via `JSON.stringify`. Returns `true` always in Create mode.

#### Inline edit mechanism

Each field in the body is built as a **display element** with a click handler. On click:
1. A replacement `input` / `textarea` / `select` is rendered in place of the display element.
2. `blur` (outside-click) commits the input value to `_draft` and re-renders the display element.
3. `Esc` reverts the input to its pre-edit display value (not `_original`, but the current `_draft` value).
4. `Enter` (single-line) or `Cmd/Ctrl+Enter` (multi-line) also commits.

The footer visibility is updated on every commit: `footer.hidden = !_isDirty()` (except Create mode where `footer.hidden = false` always).

#### Chip editor (for Required Skills / Preferred Skills)

A minimal chip editor is built inline within Modal.js:
- Shows existing chips with a remove (×) button per chip.
- A small text input at the end; `Enter`, comma, or `blur` adds a new chip.
- Backspace on empty input removes the last chip.
- Value committed to `_draft.skills` / `_draft.preferredSkills` on any change.

#### Close / Discard guard

All close triggers (✕ button, backdrop click, Esc key at modal level) call `_attemptClose()`:

```js
async function _attemptClose() {
  if (_isDirty()) {
    const confirmed = await ConfirmDialog.show('Discard changes?\nYour edits will be lost.');
    if (!confirmed) return;
  }
  Modal.close();
}
```

The footer Discard button calls a separate `_attemptDiscardDraft()` which resets `_draft` to a copy of `_original` and hides the footer without closing the modal.

#### Header

- Row 1: ID pill + status badge (clickable → StatusDropdown) + quick actions (★ Favorite, ⇄ Change Status, 🗄 Archive, ✕ Close).
- Archive button hidden in Create mode.
- ✕ Close button added (currently absent from the existing implementation).
- Status changes via badge/button count as draft changes (update `_draft.status`, call `_isDirty()`, update footer).
- Favorite and Archive still call the API immediately, bypassing draft.

#### Body layout

Two-column CSS grid (1fr / 1fr), collapsing to single column at <640px. Field order per design spec:

| Row | Col 1              | Col 2               |
|-----|--------------------|---------------------|
| 1   | Company            | Recruiter           |
| 2   | Location           | Salary              |
| 3   | Shift (dropdown)   | Work Setup (dropdown)|
| 4   | Compat bar (R/O)   | Compat Notes        |
| 5   | Last Updated (R/O) | *(empty)*           |
| 6   | Responsibilities (full-width textarea) |
| 7   | Required Skills (full-width chip editor)|
| 8   | Preferred Skills (full-width chip editor)|
| 9   | URL (full-width, validated)            |
| 10  | General Notes (full-width textarea)    |

Row 1 (Job Title) lives in the header (row 2 of header).

#### Footer

Conditionally rendered (always present in DOM, toggled with `hidden`):

```
[ Discard ]  [ Save / Create ]
```

- Save disabled state: never (dirty check already gates visibility).
- Create disabled until `_draft.jobTitle.trim() && _draft.companyName.trim()`.
- On successful Save: toast "Saved.", modal stays open, `_original = { ..._draft }`, footer hidden.
- On successful Create: toast "Application created.", modal switches to Edit mode with the new record.

#### Keyboard

| Scope        | Key            | Action                                            |
|--------------|----------------|---------------------------------------------------|
| Inside field | Esc            | Revert field, restore display element             |
| Inside field | Enter          | Commit single-line field                          |
| Inside field | Cmd/Ctrl+Enter | Commit multi-line field                           |
| Modal        | Esc            | Attempt close (dirty check)                       |
| Modal        | Cmd/Ctrl+S     | Save if dirty, no-op otherwise                    |
| Modal        | Tab/Shift+Tab  | Focus trap within panel                           |

---

### Layer 5 — `src/utils/filterSort.js`

**`DEFAULT_FILTER_STATE`** — add three new keys:

```js
shifts: [],
workSetups: [],
locations: [],
```

**New filter functions:**

```js
export function filterByShift(apps, shifts) { ... }
export function filterByWorkSetup(apps, workSetups) { ... }
export function filterByLocation(apps, locations) { ... }
```

All follow the existing `filterByStatus` pattern (empty array = no filter).

**`applyFilters()`** — chain the three new functions into the existing pipeline.

**`isAnyFilterActive()`** — add checks for `shifts`, `workSetups`, `locations`.

**`getAvailableLocations(apps, filterState)`** — returns distinct non-empty location values (like `getAvailableCompanies`). Used to populate the Location filter panel.

**`syncDynamicSelections()`** — add location sync (same pattern as companies). Shift and Work Setup values are static enums so no dynamic sync needed for those.

---

### Layer 5 — `src/components/QuickFiltersToolbar.js`

Add three new filter buttons (Shift, Work Setup, Location) alongside existing buttons in the toolbar.

Add render functions: `renderShiftPanel()`, `renderWorkSetupPanel()`, `renderLocationPanel()` — all use existing `FilterPanel.render()`.

Update `getActiveFilterCount()` to sum `shifts`, `workSetups`, `locations` arrays.

Update `refreshOpenPanel()` to handle `'shift'`, `'workSetup'`, `'location'` panel types.

---

### Layer 5 — `src/pages/Tracker.js`

**`onAddApplication()`** — currently empty. Wire to:

```js
function onAddApplication() {
  Modal.open(null, {
    mode: 'create',
    onApplicationCreate: (newRecord) => {
      _applications = [newRecord, ..._applications];
      _salaryBounds = getSalaryBounds(_applications);
      renderPage();
      updateToolbar();
    },
  });
}
```

**`normalizeStoredFilterState()`** — add normalization for `shifts` and `workSetups` (filter against `SHIFT_VALUES` / `WORK_SETUP_VALUES` constants), and `locations` (allow any string array, strip non-strings).

**`Modal.open()` callback** — the existing `onApplicationUpdate` wiring is unchanged.

---

## Risks and Tradeoffs

### 1. Modal.js complexity
**Risk**: The rewrite is the largest change in this feature. The existing behavior (status update, favorite, archive, focus trap) must all be preserved. Regression surface is high.  
**Mitigation**: The existing `tests/components/Modal.test.js` suite covers these behaviors. Run after each sub-task. Introduce inline editing incrementally — get field display right before wiring commit logic.

### 2. Chip editor (new UI pattern)
**Risk**: No chip editor exists anywhere in the project. Building one inline in Modal.js adds novel UI code that is harder to test in isolation.  
**Mitigation**: Keep the chip editor implementation minimal and self-contained within Modal.js. Avoid premature extraction. Test the chip logic via Modal tests directly.

### 3. Salary input parsing
**Risk**: The design allows flexible user input ("50k", "₱80,000"). The server Zod schema only accepts a numeric `salary`. A mismatch causes a validation error visible to the user.  
**Mitigation**: Add a `parseSalaryInput(string) → number | null` helper in the frontend (mirror of the server's `parseSalaryLower`). Apply it before sending the PATCH/POST request. Display the raw string in the input; send the parsed integer.

Range inputs such as `50000-80000` and `50k-80k` are accepted by the parser and stored as their lower bound in the existing single-value `salary` field.

### 4. Outside-click event ordering
**Risk**: The existing backdrop click listener (`if event.target === backdrop → close()`) fires when a user clicks outside an inline input. With a dirty draft, this should trigger the discard dialog — but if the field's blur commits first and then the backdrop fires, two dialogs could appear or state could be inconsistent.  
**Mitigation**: Backdrop click calls `_attemptClose()` (which checks `_isDirty()` at the time of the event, after blur has already committed the last field change). This ordering is correct as long as blur fires before click, which is the standard browser behavior.

### 5. Filter state localStorage compatibility
**Risk**: Users with existing stored filter state (no `shifts`/`workSetups`/`locations` keys) could see undefined behavior on next load.  
**Mitigation**: `normalizeStoredFilterState()` already uses `DEFAULT_FILTER_STATE` as the base and merges. New keys with array defaults will be filled in automatically for old stored states.

### 6. Status change as draft change
**Risk**: Currently, status changes in the modal call `api.update()` immediately. The new design routes status changes through the draft. This is a behavioral change: status is no longer saved until Save is clicked.  
**Mitigation**: This is explicitly required by the spec (FR-021 / design §8). The archive and favorite actions remain immediate. The status badge and header color update immediately to reflect the draft value visually.

---

## Validation Approach

### Server-side
- Zod schemas extended for new fields; no changes to route handlers.
- `shift` and `workSetup` use `.enum([...]).or(emptyString).optional()` — empty string accepted and stored as `null`/`''` after transform.
- All new fields strip on `updateSchema.strip()` like all others.

### Client-side
- Required field validation (jobTitle, companyName) fires on Save/Create click, not on each field blur.
- URL validation fires on Save/Create (use `validateUrl` from `src/utils/validate.js`), not on blur — blur commits the raw value to `_draft.jobPostingUrl` without clearing it.
- Salary is parsed client-side; if unparseable, store `null` and show a subtle inline error.
- Enum fields (Shift, Work Setup) use `<select>` elements — invalid values are not typeable.

### Automated tests
- Enum constraint validation for `shift` and `workSetup` in `tests/server/validation.test.js`.
- Schema migration with new columns in `tests/server/persistence.test.js`.
- Backward compat (existing records unaffected) in `tests/server/applications.test.js`.
- `filterByShift`, `filterByWorkSetup`, `filterByLocation` in `tests/utils/filterSort.test.js`.
- Draft state, dirty detection, save/discard flows in `tests/components/Modal.test.js`.
- Create mode, `normalizeStoredFilterState` new fields in `tests/pages/Tracker.test.js`.

---

## Affected Areas

### Files to modify

| File | Change |
|------|--------|
| `server/db.js` | Add 6 `ensureColumn` calls in `initSchema()` |
| `server/db/applications.js` | `FIELD_TO_COLUMN`, `INSERTABLE_COLUMNS`, `toRecord()`, `toRow()` |
| `server/validation/application.js` | Add 6 new optional fields to `writableFields` |
| `server/db-seed.js` | Add 6 new columns to `COLUMNS` array; add new field values to `DEMO_RECORDS` covering all 4 Shift and Work Setup enum values; some records intentionally left with `null` new fields to demonstrate optionality |
| `src/models/application.js` | Add `SHIFT_VALUES`, `WORK_SETUP_VALUES`; update `normalizeApplication()`, `validateApplication()` |
| `src/components/Modal.js` | Substantial rework: inline edit, draft state, create mode, discard flow, new fields layout, chip editor, close button |
| `src/utils/filterSort.js` | `DEFAULT_FILTER_STATE`, `applyFilters()`, `isAnyFilterActive()`, add `filterByShift`, `filterByWorkSetup`, `filterByLocation`, `getAvailableLocations`, update `syncDynamicSelections()` |
| `src/components/QuickFiltersToolbar.js` | Add Shift, Work Setup, Location filter buttons and panel renderers; update `getActiveFilterCount()`, `refreshOpenPanel()` |
| `src/pages/Tracker.js` | Wire `onAddApplication()`, add `onApplicationCreate` callback, update `normalizeStoredFilterState()` |

### Files to inspect (no modification expected)

| File | Reason |
|------|--------|
| `src/components/CompatBar.js` | Use in Modal body for read-only compat bar |
| `src/components/ConfirmDialog.js` | Reuse for discard confirmation |
| `src/components/Toast.js` | Used for save/create/error toasts |
| `src/components/StatusDropdown.js` | Reused for status badge click |
| `src/utils/currency.js` | `formatPeso()` for salary display in Modal |
| `src/utils/dom.js` | Utility functions used in Modal |
| `shared/constants.js` | `STATUS_VALUES` import source |
| `src/services/api.js` | No changes needed; `create()` and `update()` are already generic |

### Tests to add or update

| Test file | What changes |
|-----------|--------------|
| `tests/server/validation.test.js` | New field rules, enum constraints for shift/workSetup |
| `tests/server/applications.test.js` | Create/update with new fields, backward compat |
| `tests/server/persistence.test.js` | Schema migration: new columns added without data loss |
| `tests/models/application.test.js` | `normalizeApplication` with new fields, new constants |
| `tests/utils/filterSort.test.js` | New filter functions, updated `DEFAULT_FILTER_STATE`, `isAnyFilterActive` |
| `tests/components/Modal.test.js` | Inline edit, draft state, save/fail, create mode, discard flow |
| `tests/pages/Tracker.test.js` | Create-via-overlay callback, new filter state normalization |

### Explicitly out of scope

- `src/components/Card.js` — card display unchanged; new fields not shown on cards
- `src/components/SortPanel.js` — no new sort fields
- `src/pages/Profile.js`, `ProfileEdit.js` — unrelated
- `src/pages/Calendar.js` — unrelated
- `server/routes/profile.js`, `server/db/profile.js` — unrelated
- Compatibility score computation — read-only, unchanged
- `src/data/store.js` — not used by the affected flows
