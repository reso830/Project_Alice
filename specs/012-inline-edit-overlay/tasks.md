# Implementation Tasks: Enhanced Job Metadata & Inline Editing Overlay

**Feature Branch**: `012-inline-edit-overlay`  
**Created**: 2026-05-08  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data model**: [data-model.md](./data-model.md)

Phases are ordered by dependency. Each phase produces a working, testable state before the next begins. Run `npm test` after completing each phase.

---

## Phase 01 — Backend Data Pipeline

Goal: new fields exist in the database, flow through the server data layer, and are accepted/rejected correctly by the API. No frontend changes yet.

---

### [X] Task 01.1 — Add schema columns

**Target files**
- `server/db.js` — inside `initSchema()`, after the existing `ensureColumn` call for `archived`

**Expected behavior**
Six new TEXT columns are added to the `applications` table when the server starts. Existing rows are unaffected (SQLite sets NULL). The operation is idempotent — running `initSchema()` twice does not error.

**What to add**
```js
ensureColumn(targetDb, 'applications', 'location',         'TEXT');
ensureColumn(targetDb, 'applications', 'shift',            'TEXT');
ensureColumn(targetDb, 'applications', 'work_setup',       'TEXT');
ensureColumn(targetDb, 'applications', 'compat_notes',     'TEXT');
ensureColumn(targetDb, 'applications', 'general_notes',    'TEXT');
ensureColumn(targetDb, 'applications', 'preferred_skills', 'TEXT');
```

**Constraints**
- Do not add NOT NULL constraints — all six are optional
- Do not alter any existing column definitions
- Do not touch the `profile` table

**Validation**
- `tests/server/persistence.test.js` — add a test that calls `initSchema()` on a fresh in-memory DB and asserts that `PRAGMA table_info(applications)` includes all six column names
- Manual: restart dev server, run `sqlite3 data/alice.db ".schema applications"`, confirm columns are present

---

### [X] Task 01.2 — Update server data layer mappings

**Target files**
- `server/db/applications.js`

**Changes**
1. `FIELD_TO_COLUMN` — add six entries:
   ```js
   location:       'location',
   shift:          'shift',
   workSetup:      'work_setup',
   compatNotes:    'compat_notes',
   generalNotes:   'general_notes',
   preferredSkills: 'preferred_skills',
   ```
2. `INSERTABLE_COLUMNS` — append six column names: `'location'`, `'shift'`, `'work_setup'`, `'compat_notes'`, `'general_notes'`, `'preferred_skills'`
3. `toRecord(row)` — add six fields to the returned object:
   - `location: row.location` (may be null — leave as-is; client normalizes)
   - `shift: row.shift`
   - `workSetup: row.work_setup`
   - `compatNotes: row.compat_notes`
   - `generalNotes: row.general_notes`
   - `preferredSkills: parseJson(row.preferred_skills, [])` — uses the existing `parseJson` helper
4. `toRow(fields)` — handle `preferredSkills` serialization in the `reduce`:
   ```js
   } else if (field === 'preferredSkills') {
     row[column] = JSON.stringify(Array.isArray(value) ? value : []);
   }
   ```
   All other new text fields pass through the existing `else` branch unchanged.

**Constraints**
- Do not rename or remove any existing entries in `FIELD_TO_COLUMN` or `INSERTABLE_COLUMNS`
- Do not change `skills` serialization — it uses the same `parseJson` / `JSON.stringify` pattern already in place
- `UPDATABLE_COLUMNS` is derived from `Object.values(FIELD_TO_COLUMN)` — it picks up new entries automatically; do not touch it

**Validation**
- `tests/server/applications.test.js` — add tests:
  - `create()` with all six new fields returns a record containing those values
  - `create()` without the new fields returns a record where `preferredSkills` is `[]` and text fields are `null`
  - `update()` can set and clear each new field
  - `getById()` on an existing record (pre-migration) returns `preferredSkills: []` and null for text fields

---

### [X] Task 01.3 — Add server validation rules

**Target files**
- `server/validation/application.js`

**Changes**  
Add six entries to the `writableFields` object, after the existing `followUpDate` entry:

```js
location:        optionalText,
shift:           z.enum(['Day', 'Mid', 'Night', 'Flexible']).or(emptyString).optional(),
workSetup:       z.enum(['Remote', 'Hybrid', 'On-site', 'Field']).or(emptyString).optional(),
compatNotes:     optionalText,
generalNotes:    optionalText,
preferredSkills: z.array(z.string()).optional(),
```

`optionalText` and `emptyString` are already defined in the file — reuse them.

**Constraints**
- Do not touch `createSchema`, `updateSchema`, `toApiError`, or the route handlers — they automatically pick up `writableFields` changes
- Do not make `shift` or `workSetup` required; they must remain optional
- Do not add the enum values as a shared constant in this file — client-side constants are defined separately in Task 02.1

**Validation**
- `tests/server/validation.test.js` — add tests:
  - `createSchema` accepts valid `shift` values: `'Day'`, `'Mid'`, `'Night'`, `'Flexible'`
  - `createSchema` rejects invalid `shift` value (e.g., `'Morning'`)
  - `createSchema` accepts empty string `''` for `shift` and `workSetup`
  - `createSchema` accepts valid `workSetup` values: `'Remote'`, `'Hybrid'`, `'On-site'`, `'Field'`
  - `createSchema` rejects invalid `workSetup` value
  - `createSchema` accepts `preferredSkills: ['React', 'Node']`
  - `createSchema` rejects `preferredSkills` when it is a non-array (e.g., `'React'`)
  - All six new fields are accepted when omitted (optional)
  - `updateSchema` allows partial updates with only new fields present

---

### [X] Task 01.4 — Update seeder with new field sample data

**Target files**
- `server/db-seed.js`

**Expected behavior**
Add sample values for the six new optional fields to at least a subset of the seed records. Ensure that the sample data includes a variety of Shift and Work Setup values so Phase 08 filter behavior can be tested immediately with seeded data.

Example additions to at least two seed records:
```js
location: 'Manila',
shift: 'Day',
workSetup: 'Remote',
compatNotes: 'Strong React match',
generalNotes: 'Applied via referral.',
preferredSkills: ['TypeScript', 'GraphQL'],
```
Use all four `shift` values (`Day`, `Mid`, `Night`, `Flexible`) and all four `workSetup` values (`Remote`, `Hybrid`, `On-site`, `Field`) across the seed set — at least one record per enum value so filter results are non-trivial during manual testing.

**Constraints**
- Do not change the structure of the seeder or the `COLUMNS` array layout — only append the 6 new columns at the end and add the corresponding keys to each record
- The seeder bypasses `toRow` and writes raw column names directly — `preferred_skills` must be stored as a pre-serialized JSON string: `JSON.stringify([...])` or `null`; do NOT pass a JS array directly
- Records that do not have new field values must explicitly set each of the 6 keys to `null` — omitting the keys causes a missing named-parameter error in better-sqlite3
- New fields are optional — not all seed records need values; records with all six set to `null` are valid and demonstrate optionality

**Validation**
- Manual: run `node server/db-seed.js`, open the app, click the Shift filter — all four values (Day, Mid, Night, Flexible) should appear in the filter panel
- Manual: click the Work Setup filter — all four values (Remote, Hybrid, On-site, Field) should appear
- No automated test required for this task

---

## Phase 02 — Client Model

Goal: the frontend model knows about the new fields and constants. No UI changes yet.

---

### [X] Task 02.1 — Add constants and update normalizeApplication / validateApplication

**Target files**
- `src/models/application.js`

**Changes**
1. Export two new constants near the top of the file (after `STATUS_VALUES`):
   ```js
   export const SHIFT_VALUES = ['Day', 'Mid', 'Night', 'Flexible'];
   export const WORK_SETUP_VALUES = ['Remote', 'Hybrid', 'On-site', 'Field'];
   ```

2. `normalizeApplication(record)` — extend the normalization loop to cover the six new fields. String fields default to `''`; `preferredSkills` defaults to `[]`:
   ```js
   for (const field of ['responsibilities', 'recruiter', 'jobPostingUrl',
                         'location', 'shift', 'workSetup', 'compatNotes', 'generalNotes']) {
     if (typeof normalized[field] !== 'string') normalized[field] = '';
   }
   if (!Array.isArray(normalized.preferredSkills)) normalized.preferredSkills = [];
   ```

3. `validateApplication(record)` — coerce invalid `shift` and `workSetup` to `''` (same approach as `status` coercion to `'wishlisted'`):
   ```js
   if (!SHIFT_VALUES.includes(validated.shift) && validated.shift !== '') {
     validated.shift = '';
   }
   if (!WORK_SETUP_VALUES.includes(validated.workSetup) && validated.workSetup !== '') {
     validated.workSetup = '';
   }
   ```

**Constraints**
- Do not remove the existing normalization loop — extend it
- Do not change the existing `STATUS_VALUES`, `STATUS_CONFIG`, or any existing validation rule
- `_corrupt` flag logic is unchanged

**Validation**
- `tests/models/application.test.js` — add tests:
  - `SHIFT_VALUES` and `WORK_SETUP_VALUES` are exported arrays with correct members
  - `normalizeApplication` sets string fields to `''` when absent
  - `normalizeApplication` sets `preferredSkills` to `[]` when absent or non-array
  - `validateApplication` coerces an invalid `shift` to `''`
  - `validateApplication` coerces an invalid `workSetup` to `''`
  - `validateApplication` does not corrupt a valid `shift` or `workSetup` value

---

### [X] Task 02.2 — Add parseSalaryInput utility

**Target files**
- `src/utils/currency.js`

Range inputs such as `50000-80000`, `50k-80k`, and `PHP 50,000 - PHP 80,000` are accepted and return the lower bound.

**Expected behavior**
Add and export `parseSalaryInput(value)` — converts a user-typed salary string to a positive integer or `null`. Mirrors the logic in `server/db/applications.js:parseSalaryLower`.

Accepted formats: `'80000'`, `'80,000'`, `'80k'`, `'80K'`, `'₱80,000'`, `'₱80k'`. Unrecognised input returns `null`.

**Constraints**
- Do not modify `formatPeso` — display and parsing are separate concerns
- Do not import server code — this is a client-side standalone function
- Return `null` (not `0`) for empty or unparseable input
- Add range parsing tests: `parseSalaryInput('50000-80000')`, `parseSalaryInput('50k-80k')`, and `parseSalaryInput('PHP 50,000 - PHP 80,000')` all return `50000`

**Validation**
- `tests/utils/currency.test.js` — add tests:
  - `parseSalaryInput('80000')` → `80000`
  - `parseSalaryInput('80,000')` → `80000`
  - `parseSalaryInput('80k')` → `80000`
  - `parseSalaryInput('₱80k')` → `80000`
  - `parseSalaryInput('')` → `null`
  - `parseSalaryInput('abc')` → `null`
  - `parseSalaryInput(null)` → `null`

---

## Phase 03 — Modal Layout & View Mode

Goal: the overlay renders all new fields in the correct 2-column layout and has a close button. No editing yet — fields are still display-only. Existing behaviors (status, favorite, archive, focus trap) must be fully preserved.

---

### [X] Task 03.1 — Add close button to header

**Target files**
- `src/components/Modal.js`

**Expected behavior**
A ✕ Close button is added to `quickActions` in the header, after the Archive button. Clicking it calls `Modal.close()` (no dirty check yet — that comes in Phase 06).

**Constraints**
- Do not change existing button behavior (Favorite, Status, Archive) 
- Use the same `createQuickButton` helper with class `modal-quick-action--close`
- Set `aria-label="Close"` on the button
- Do not add `_draft` or dirty state in this task — close is unconditional here

**Validation**
- `tests/components/Modal.test.js` — add test: after `Modal.open()`, a button with `aria-label="Close"` is present; clicking it removes the modal from the DOM

---

### [X] Task 03.2 — Rebuild modal body with 2-column layout and new fields

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Replace the current flat list of `createField()` calls in `body.append(...)` with the 9-row layout from the design spec. All fields remain display-only (no click-to-edit yet). Add `CompatBar` import.

Body field order (grid children, in DOM order):

| # | Element | Span | Notes |
|---|---------|------|-------|
| 1 | Company | half | existing |
| 2 | Recruiter | half | existing |
| 3 | Location | half | **new** — empty state shows `—` |
| 4 | Salary | half | existing |
| 5 | Shift | half | **new** — empty state shows `—` |
| 6 | Work Setup | half | **new** — empty state shows `—` |
| 7 | Compat bar (CompatBar.render) | half | replaces the old "Compatibility: X%" text field |
| 8 | Compat Notes | half | **new** — empty state shows `—` |
| 9 | Last Updated | half | existing — **read-only**, displays `application.lastStatusUpdate`; the adjacent grid cell (col 2) is empty |
| 10 | Responsibilities | full | existing |
| 11 | Required Skills (was "Skills") | full | label change only |
| 12 | Preferred Skills | full | **new** chip display (read-only tags) |
| 13 | URL | full | existing |
| 14 | General Notes | full | **new** |

The body element uses CSS class `modal-body` (existing). A `modal-body--grid` modifier or inline `display: grid; grid-template-columns: 1fr 1fr` can be added. Half-span fields use `modal-field`; full-span fields use `modal-field modal-field--full` (existing pattern).

**Constraints**
- Do not add click handlers to any field — display only in this task
- Do not import or use `parseSalaryInput` yet — salary is display only
- The `CompatBar.render(application.compat)` output replaces the `createField('Compatibility', ...)` call; it is read-only
- `Last Updated` (item 9) is read-only — render it with `createField('Last Updated', formatDate(application.lastStatusUpdate))` or equivalent; do not wrap it in any edit helper
- `Preferred Skills` row renders existing chip tag elements (`skill-tag` class) for any values, or `—` if empty — reuse the existing `createSkills` helper or inline equivalent
- Do not change header, footer (none exists yet), focus trap, backdrop, or keyboard handling

**Validation**
- `tests/components/Modal.test.js` — add tests:
  - Modal body contains elements with labels: Location, Shift, Work Setup, Compat Notes, General Notes, Preferred Skills, Last Updated
  - "Skills" label is now "Required Skills"
  - Full-span fields (Responsibilities, Required Skills, Preferred Skills, URL, General Notes) have `modal-field--full` class
  - Last Updated element is present and not interactive (no click handler / input)

---

### [X] Task 03.3 — Status change routes through draft (visual only)

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Status changes via the status badge click or the Change Status quick button update `_draft.status` and refresh the header color and badge — but do **not** call `api.update()` immediately. This is the behavioral change documented in research.md §2.

Introduce the minimal draft state needed for status tracking: add `let _draft = null` and `let _original = null` at the module level. On `Modal.open()`, initialize:

```js
_draft = { ...application };
_original = {
  ...application,
  skills: [...(application.skills ?? [])],
  preferredSkills: [...(application.preferredSkills ?? [])],
};
```

`_original` uses a partial deep copy for array fields so that `_draft.skills` and `_original.skills` are never the same array reference. Without this, chip editor mutations to `_draft.skills` (in-place `.push`/`.splice`) would also mutate `_original`, causing `_isDirty()` to always return `false` for those fields.

The StatusDropdown callback now does:
```js
_draft.status = newStatus;
applyHeaderStatus(header, newStatus);
updateStatusBadge(statusBadge, newStatus);
```
It does **not** call `api.update()`.

**Constraints**
- Favorite and Archive still call `api.update()` / `api.archive()` immediately — do not change them
- After a Favorite toggle API call succeeds, sync both `_draft.fav` and `_original.fav` to `updated.fav` from the response — a subsequent Save must not overwrite the toggled state with the pre-toggle draft value
- `_isDirty()` and footer logic are not added yet — that is Phase 05
- Do not add `_mode` or create mode logic yet

**Validation**
- `tests/components/Modal.test.js` — update the existing status-change test: after clicking Change Status and selecting a new status, `api.update` is NOT called for the status change (spy on `api.update`)
- Add test: after Favorite toggle succeeds (mock `api.update` resolving with `{ fav: true }`), `_draft.fav` equals `true`; then if Save is clicked, `api.update` is called with `fav: true`
- Verify that Archive still calls the API immediately (existing tests should pass)

---

### [X] Task 03.4 — Mobile bottom sheet styling

**Target files**
- `src/components/Modal.js` (inline styles or class additions)
- `src/styles/modal.css` (or wherever modal styles live)

**Expected behavior**
At viewport widths below 640px the overlay becomes a bottom sheet:
- Full viewport width (`width: 100%`; no horizontal margin)
- `border-radius: 16px 16px 0 0` (rounded top corners only)
- Anchored to the bottom of the viewport (`position: fixed; bottom: 0; left: 0`)
- `max-height: 92vh`; body scrolls internally (header and footer remain pinned)
- Body grid collapses to a single column (`grid-template-columns: 1fr`) — all half-span fields stack vertically in document order

**Constraints**
- Desktop layout (≥ 640px) is unchanged: centered, `min(720px, calc(100vw - 32px))` width, 14px radius
- Implement via CSS media query (`@media (max-width: 639px)`) — no JavaScript viewport detection
- The single-column collapse applies automatically from the CSS change; no JS field reordering required
- Backdrop behavior (click → attempt close) is unchanged on mobile

**Validation**
- Manual: open the app in Chrome DevTools, set device width to 375px; confirm the overlay slides up from the bottom, fields stack single-column, header and footer are pinned, body scrolls
- `tests/components/Modal.test.js` — this is a CSS-only change; no JS behavior test required; add a comment in the test file noting the mobile layout is validated manually

---

## Phase 04 — Inline Editing

Goal: every field in the modal body becomes click-to-edit. Outside-click commits the value to `_draft`. Esc reverts the field. No footer or save logic yet.

---

### [X] Task 04.1 — Inline text field helper

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Add a private `makeInlineText({ label, key, multiline, fullSpan })` helper function. It returns a DOM element that:
- Displays the current `_draft[key]` value (or `—` if empty)
- On click: replaces the display span with an `input` (single-line) or `textarea` (multiline)
- On `blur` of the input: writes `input.value.trim()` to `_draft[key]`; re-renders the display element
- On `Esc` keydown inside the input: reverts `input.value` to the pre-edit value (the value of `_draft[key]` at the moment the field was activated); does not commit
- Single-line `Enter` keydown: commits (same as blur)
- Multi-line `Cmd/Ctrl+Enter` keydown: commits (same as blur)

For the Salary field specifically: on blur, run `parseSalaryInput(input.value)` and write the result (number or null) to `_draft.salary`; display the formatted value via `formatPeso`.

**Constraints**
- Do not call `api.update()` or check dirty state in this helper — only write to `_draft`
- Do not add footer show/hide here — that is Task 05.2
- Salary field uses `parseSalaryInput` (from `src/utils/currency.js`) on commit, not on each keystroke

**Validation**
- `tests/components/Modal.test.js` — for a text field (e.g., Location):
  - Clicking the field renders an input
  - Blurring the input with a new value updates `_draft.location`
  - Pressing Esc reverts the input value without updating `_draft`
  - Pressing Enter commits the value
  - Salary blur parses `'80k'` → `_draft.salary === 80000`

---

### [X] Task 04.2 — Inline select field helper

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Add a private `makeInlineSelect({ label, key, options, fullSpan })` helper. It returns a DOM element that:
- Displays the current `_draft[key]` value (or `—` if empty/falsy)
- On click: replaces display with a `<select>` element; options include an empty `<option value="">—</option>` plus one `<option>` per value in `options`
- `<select>` pre-selects the current `_draft[key]` value
- On `change` event: writes `select.value` to `_draft[key]`; re-renders the display element (no blur needed — change is immediate for selects)
- On `Esc` keydown: reverts to pre-edit value, re-renders display

Use for Shift (`options: SHIFT_VALUES`) and Work Setup (`options: WORK_SETUP_VALUES`).

**Constraints**
- Do not add custom dropdown styling — use native `<select>`
- Do not add footer logic here

**Validation**
- `tests/components/Modal.test.js` — for Shift:
  - Clicking renders a `<select>` with options Day, Mid, Night, Flexible plus empty
  - Changing the select value updates `_draft.shift`
  - Pressing Esc reverts without updating `_draft`

---

### [X] Task 04.3 — Chip editor helper

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Add a private `makeChipEditor({ label, key, fullSpan })` helper. It returns a `<div class="modal-field modal-field--full">` wrapper containing:
- A `<span class="modal-field__label">` with the label text (e.g., `"Required Skills"`) as the first child — matching the label pattern used by all other `modal-field` elements
- One chip per value in `_draft[key]` (array of strings), each with a `×` remove button, using the existing `.skill-tag` class
- A text `input` at the end for adding new chips
- On remove button click: assigns a new array (`_draft[key] = _draft[key].filter(...)`) — do NOT mutate in place; re-renders the chip list
- On input `blur`, `Enter` keydown, or `,` keydown: if input value is non-empty, trims and assigns a new array (`_draft[key] = [..._draft[key], trimmedValue]`) — do NOT push to the existing array; clears the input, re-renders chips
- On `Backspace` keydown in empty input: assigns `_draft[key] = _draft[key].slice(0, -1)`; re-renders

The chip editor is always in "edit mode" (not click-to-activate like text fields).

Use for Required Skills (`key: 'skills'`) and Preferred Skills (`key: 'preferredSkills'`).

**Constraints**
- Do not add a separate "activate on click" outer wrapper — the chip editor is always interactive
- Do not add footer logic in this helper
- Do not allow duplicate chip values — if the typed value already exists in `_draft[key]`, discard without adding

**Validation**
- `tests/components/Modal.test.js`:
  - Initial render shows existing chips from `_draft.skills`
  - Remove button click removes a chip and updates `_draft.skills`
  - Entering a value and pressing Enter appends to `_draft.skills`
  - Backspace on empty input removes the last chip
  - Duplicate values are rejected

---

### [X] Task 04.4 — Define _renderBody() and wire all body fields to inline edit helpers

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Define a private `_renderBody()` function that clears the body element's contents and rebuilds all field elements from the current `_draft`. `Modal.open()` calls `_renderBody()` after initializing `_draft` — field creation is no longer inline in `Modal.open()`.

`_renderBody()` appends children in this order:

| Field | Builder |
|-------|---------|
| Company | `makeInlineText({ label: 'Company', key: 'companyName' })` |
| Recruiter | `makeInlineText({ label: 'Recruiter', key: 'recruiter' })` |
| Location | `makeInlineText({ label: 'Location', key: 'location' })` |
| Salary | `makeInlineText({ label: 'Salary', key: 'salary' })` with salary parse/format |
| Shift | `makeInlineSelect({ label: 'Shift', key: 'shift', options: SHIFT_VALUES })` |
| Work Setup | `makeInlineSelect({ label: 'Work Setup', key: 'workSetup', options: WORK_SETUP_VALUES })` |
| Compat bar | `CompatBar.render(_draft.compat)` — **stays read-only**, no helper |
| Compat Notes | `makeInlineText({ label: 'Compat Notes', key: 'compatNotes' })` |
| Last Updated | `createField('Last Updated', formatDate(_draft.lastStatusUpdate))` — **read-only**, no helper, half-span; the adjacent grid cell is left empty by CSS auto-placement — no filler div needed |
| Responsibilities | `makeInlineText({ label: 'Responsibilities', key: 'responsibilities', multiline: true, fullSpan: true })` |
| Required Skills | `makeChipEditor({ label: 'Required Skills', key: 'skills', fullSpan: true })` |
| Preferred Skills | `makeChipEditor({ label: 'Preferred Skills', key: 'preferredSkills', fullSpan: true })` |
| URL | `makeInlineText({ label: 'URL', key: 'jobPostingUrl', fullSpan: true })` — **no validation on blur** |
| General Notes | `makeInlineText({ label: 'General Notes', key: 'generalNotes', multiline: true, fullSpan: true })` |

Job Title stays in the header: make it click-to-edit using the same `makeInlineText` pattern but rendering an `<h2>` input inline in the header title row.

**Constraints**
- Compat bar and Last Updated are read-only — do not wrap them in any inline edit helper
- URL field blur commits the raw value to `_draft.jobPostingUrl` without validation — URL validation runs at Save time (Task 05.3) and Create time (Task 07.2)
- Do not add footer logic yet
- `_renderBody()` is called in `Modal.open()` (this task), Task 05.4 (after draft reset), Task 07.1 (create mode open), and Task 07.2 (after successful create)

**Validation**
- Manual: open an application, click each field, verify it activates, commit changes to `_draft`, verify Esc reverts; Last Updated should be non-interactive
- `tests/components/Modal.test.js` — spot-check at least: Company, Shift, Required Skills, General Notes, Last Updated (non-interactive)

---

## Phase 05 — Draft State & Footer

Goal: the footer appears when `_draft` differs from `_original`. Save writes to the API. Discard resets the draft.

---

### [X] Task 05.1 — Add footer element and _isDirty()

**Target files**
- `src/components/Modal.js`

**Expected behavior**
1. Add `_isDirty()` function (see `data-model.md` for implementation). Uses shallow comparison with `JSON.stringify` for array fields.
2. Add `_footer` module-level variable. Build a footer element inside `Modal.open()` with two buttons: **Discard** and **Save** (or **Create** — determined in Phase 07).
3. Append `_footer` to `_panel` below the body.
4. In Edit mode: `_footer.hidden = true` initially (draft equals original).
5. Add `_syncFooter()` helper that sets `_footer.hidden = !_isDirty()`.

**Constraints**
- Save and Discard buttons are wired in Tasks 05.2 and 05.3
- Create mode footer logic (always visible, disabled Create button) is Phase 07
- Do not connect keyboard shortcuts yet

**Validation**
- `tests/components/Modal.test.js`:
  - Footer is present in the DOM after `Modal.open()`
  - Footer has `hidden` attribute initially (edit mode with no changes)
  - `_isDirty()` returns false when draft equals original
  - `_isDirty()` returns true when any text field differs
  - `_isDirty()` returns true when an array field differs (skills array)

---

### [X] Task 05.2 — Show/hide footer on each field commit

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Call `_syncFooter()` at the end of every commit path — after blur commits a text field, after select change commits a dropdown, after chip add/remove in chip editor, after status change routes through `_draft`.

**Constraints**
- `_syncFooter()` is a no-op if `_footer` is null
- Do not sync footer inside Esc (revert) paths — Esc should not trigger dirty detection on the reverted value

**Validation**
- `tests/components/Modal.test.js`:
  - After editing Company and blurring, footer becomes visible
  - After changing Shift dropdown, footer becomes visible
  - After adding a chip to Required Skills, footer becomes visible
  - Footer does not appear when Esc reverts a field with no prior draft change

---

### [X] Task 05.3 — Implement Save

**Target files**
- `src/components/Modal.js`

**Expected behavior**
The Save button's click handler:
1. Validate required fields before any API call: `_draft.jobTitle.trim()` and `_draft.companyName.trim()` must both be non-empty. If either is missing, show a clear inline error on the corresponding field and abort — do not call `api.update`
2. If `_draft.jobPostingUrl` is non-empty, call `validateUrl(_draft.jobPostingUrl)` (from `src/utils/validate.js`); if invalid, show a brief inline error on the URL field and abort — do not call `api.update`
3. Calls `api.update(_draft.id, _draft)` (sends the full draft as the PATCH body)
4. On success:
   - Update `_draft.lastStatusUpdate = updated.lastStatusUpdate` from the server response (status changes on the server set a new timestamp)
   - Sets `_original = { ..._draft, skills: [..._draft.skills], preferredSkills: [..._draft.preferredSkills] }` (same partial deep copy as Task 03.3)
   - Calls `_syncFooter()` (hides footer)
   - Refreshes the Last Updated display: call `_renderBody()`, or update the Last Updated element in-place if a reference is available
   - Shows `Toast.show('Saved.', 'success')`
   - Calls `onApplicationUpdate(updated)` callback
5. On failure: shows `Toast.show('Failed to save', 'failure')`, retains `_draft` unchanged

**Constraints**
- Do not close the modal on save — it stays open
- Required field validation is mandatory here to comply with the project constitution; do not rely on historical stored validity
- Do not call `Modal.close()` in the success path

**Validation**
- `tests/components/Modal.test.js`:
  - Edit a field, click Save; `api.update` is called with the updated draft values
  - With blank Job Title or Company, clicking Save shows an inline error and does not call `api.update`
  - On success, footer becomes hidden and toast "Saved." is shown
  - On success, `_draft.lastStatusUpdate` is updated from the `updated` record
  - On failure (`api.update` rejects), toast "Failed to save" is shown and footer remains visible
  - With invalid URL in `_draft.jobPostingUrl`, clicking Save shows inline error and does not call `api.update`

---

### [X] Task 05.4 — Implement footer Discard

**Target files**
- `src/components/Modal.js`

**Expected behavior**
The Discard button's click handler calls `_attemptDiscardDraft()`:
1. Shows `ConfirmDialog.show('Discard changes?\nYour edits will be lost.', { confirmLabel: 'Discard', cancelLabel: 'Keep editing' })`
2. If confirmed:
   - Resets `_draft = { ..._original, skills: [..._original.skills], preferredSkills: [..._original.preferredSkills] }` (same partial deep copy pattern as Task 03.3)
   - Calls `_renderBody()` to rebuild the body DOM from the reset `_draft` — this is required because inline field elements hold internal state that is not updated by reassigning `_draft` alone
   - Calls `_syncFooter()` (hides footer)
   - Modal stays open
3. If not confirmed: does nothing

**Constraints**
- Do not close the modal after discarding via the footer button — that is the Discard button in the dialog triggered by ✕ / backdrop / Esc (Phase 06)
- `_renderBody()` must be called after the draft is reset, not before — the rebuild reads from the new `_draft`

**Validation**
- `tests/components/Modal.test.js`:
  - Edit a field; click footer Discard; ConfirmDialog shows with "Discard" and "Keep editing" labels; confirm; field reverts to original value, footer hidden
  - Click footer Discard; cancel (Keep editing) in dialog; draft unchanged, footer remains visible

---

### [X] Task 05.5 — Keyboard shortcuts

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Inside the existing `_keydownHandler`:
1. `Cmd/Ctrl+S`: if `_isDirty()`, trigger the same save logic as the Save button; otherwise no-op
2. Esc at the modal level (not inside a field) is handled in Phase 06 — skip here; the existing `Escape` branch in `_keydownHandler` currently calls `close()` and will be replaced then

**Constraints**
- `Cmd/Ctrl+S` must not fire while a field is in edit mode (the field's own keydown handler should call `event.stopPropagation()` for Enter/Esc, but `Cmd+S` should still propagate — this is acceptable)
- Do not add Esc dirty-guard logic in this task

**Validation**
- `tests/components/Modal.test.js`:
  - After editing a field and committing (blur), pressing `Ctrl+S` triggers `api.update`
  - Pressing `Ctrl+S` with no edits does not call `api.update`

---

## Phase 06 — Discard Guard

Goal: all close triggers check for unsaved changes before closing.

---

### [X] Task 06.1 — Implement _attemptClose()

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Add `async function _attemptClose()`:
1. If `_isDirty()`: shows `ConfirmDialog.show('Discard changes?\nYour edits will be lost.', { confirmLabel: 'Discard', cancelLabel: 'Keep editing' })`
   - Confirmed → `Modal.close()`
   - Cancelled → return (modal stays open)
2. If not dirty: calls `Modal.close()` directly

**Constraints**
- `_attemptClose` is async — callers must `await` it or use `.then()` where needed
- Do not reset `_draft` in this path — close removes the whole modal

**Validation**
- `tests/components/Modal.test.js`:
  - When dirty: `_attemptClose()` shows the confirm dialog with "Discard" / "Keep editing" labels; confirming closes the modal
  - When dirty: `_attemptClose()` shows the confirm dialog; cancelling (Keep editing) leaves the modal open
  - When not dirty: `_attemptClose()` closes immediately with no dialog

---

### [X] Task 06.2 — Wire all close triggers to _attemptClose()

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Replace all three existing close triggers with `_attemptClose()`:

1. **✕ Close button** (added in Task 03.1): `button.addEventListener('click', _attemptClose)`
2. **Backdrop click**: replace `close()` call with `_attemptClose()`
3. **Esc key** in `_keydownHandler`: replace the existing `close()` call with `_attemptClose()`; apply two guards before calling:
   - Guard A: if the event target is inside an inline input/select/textarea, return — field-level Esc is handled by the field helper (which calls `event.stopPropagation()`)
   - Guard B: if a ConfirmDialog is currently open (`document.querySelector('.confirm-backdrop')` is non-null), return — Esc in that context dismisses the dialog via its own handler and must NOT also trigger `_attemptClose()` on the modal

**Constraints**
- Guard B (ConfirmDialog open check) ensures Esc correctly dismisses only the dialog and leaves the modal open — without it, the dialog Esc handler resolves `false` and returns control to the modal's keydown handler, which would then call `_attemptClose()` and show a second dialog
- Do not change Archive or Favorite behavior — they do not use `_attemptClose()`

**Validation**
- `tests/components/Modal.test.js`:
  - With dirty draft: clicking ✕, clicking backdrop, pressing Esc each show the confirm dialog with "Discard" / "Keep editing" labels
  - Without dirty draft: clicking ✕, clicking backdrop, pressing Esc each close immediately
  - Pressing Esc inside an active text input closes the field only, not the modal
  - Pressing Esc while ConfirmDialog is open dismisses the dialog only — modal remains open, no second dialog appears

---

## Phase 07 — Create Mode

Goal: the "+ New application" button opens the overlay in Create mode with an empty draft. Saving creates a new record.

---

### [X] Task 07.1 — Extend Modal.open() for Create mode

**Target files**
- `src/components/Modal.js`

**Expected behavior**
`Modal.open()` gains a `mode` option. When `mode === 'create'` (or application is `null`):
- `_mode = 'create'`
- `_draft` is initialized using `normalizeApplication` (import from `src/models/application.js`) so all fields are present and normalized without manually enumerating them:
  ```js
  _draft = { ...normalizeApplication({}), status: 'wishlisted' };
  ```
  This is self-updating: any new optional field added to `normalizeApplication` in a future feature is automatically included in Create mode without requiring a change here.
- `_original = null`
- The ID pill in the header shows `#—` or is hidden
- The Archive quick button is hidden (`archiveButton.hidden = true`)
- `_isDirty()` always returns `true` in create mode
- `_syncFooter()` does not hide the footer in create mode (`_footer.hidden = false` always)
- The Save button label changes to **Create**
- The Create button is disabled when `_draft.jobTitle.trim() === ''` or `_draft.companyName.trim() === ''`; enabled otherwise — update this check after each field commit on jobTitle and companyName
- Call `_renderBody()` after initializing `_draft` to build the body DOM (same as Edit mode in Task 04.4)

**Constraints**
- Existing `mode: 'edit'` (default) behavior is unchanged
- `_attemptClose()` still works in create mode: since `_isDirty()` is always true, closing always prompts

**Validation**
- `tests/components/Modal.test.js`:
  - `Modal.open(null, { mode: 'create' })` opens the modal with empty fields
  - Status badge shows "Wishlisted"
  - Footer is visible immediately
  - Create button is disabled initially
  - Filling Job Title and Company enables the Create button
  - Archive button is not present in the DOM

---

### [X] Task 07.2 — Implement create flow

**Target files**
- `src/components/Modal.js`

**Expected behavior**
The Create button click handler:
1. Validates `_draft.jobTitle.trim()` and `_draft.companyName.trim()` are non-empty; if not, does nothing (button should already be disabled, but guard anyway)
2. If `_draft.jobPostingUrl` is non-empty, call `validateUrl(_draft.jobPostingUrl)` (from `src/utils/validate.js`); if invalid, show inline error and abort
3. Calls `api.create(_draft)` (sends full draft as POST body)
4. On success:
   - Calls `onApplicationCreate(newRecord)` callback
   - Shows `Toast.show('Application created.', 'success')`
   - Switches modal to Edit mode: `_mode = 'edit'`, `_original = { ...newRecord, skills: [...newRecord.skills], preferredSkills: [...newRecord.preferredSkills] }`, `_draft = { ...newRecord }`, updates ID pill with `newRecord.id`, shows Archive button
   - Calls `_renderBody()` to rebuild body DOM from the new record's data
   - Calls `_syncFooter()` (footer hides since draft now equals original)
5. On failure: shows `Toast.show('Failed to create application', 'failure')`, retains draft

**Constraints**
- Do not close the modal on success — it stays open in Edit mode
- Do not call `Modal.close()` in the success path

**Validation**
- `tests/components/Modal.test.js`:
  - Fill Job Title and Company; click Create; `api.create` is called with draft values
  - On success: toast "Application created.", `onApplicationCreate` called, footer hidden, Archive button appears, ID pill updated
  - On failure: toast shown, draft unchanged, modal stays in Create mode

---

### [X] Task 07.3 — Wire Tracker to open Create mode

**Target files**
- `src/pages/Tracker.js`

**Expected behavior**
Replace the empty `onAddApplication()` function body:

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

**Constraints**
- Do not change the FAB or toolbar "+ New application" button — they already call `onAddApplication()`
- `onApplicationUpdate` and `onArchiveSuccess` callbacks in `createCallbacks()` are unchanged

**Validation**
- `tests/pages/Tracker.test.js`:
  - Clicking "+ New application" calls `Modal.open` with `mode: 'create'`
  - After `onApplicationCreate` fires, the new record appears in `_applications` and `renderPage` is called

---

## Phase 08 — Filter Expansion

Goal: Location, Shift, and Work Setup appear as filter options in the toolbar. Filtering works and persists to localStorage.

---

### [X] Task 08.1 — Add filter functions to filterSort.js

**Target files**
- `src/utils/filterSort.js`

**Expected behavior**

1. Extend `DEFAULT_FILTER_STATE`:
   ```js
   shifts:    [],
   workSetups: [],
   locations: [],
   ```

2. Add three filter functions following the `filterByStatus` pattern:
   ```js
   export function filterByShift(apps, shifts) { ... }
   export function filterByWorkSetup(apps, workSetups) { ... }
   export function filterByLocation(apps, locations) { ... }
   ```
   All: empty array = no filter; otherwise `apps.filter(app => values.includes(app.field))`.

3. Add `getAvailableLocations(apps, filterState)` — returns sorted distinct non-empty `location` values from `apps`, excluding apps filtered out by all other active filters (same cross-filter pattern as `getAvailableCompanies`).

4. Update `applyFilters(apps, filterState)` — chain `filterByLocation`, `filterByShift`, `filterByWorkSetup` into the existing pipeline.

5. Update `isAnyFilterActive(filterState)` — add checks: `|| hasSelections(filterState.shifts) || hasSelections(filterState.workSetups) || hasSelections(filterState.locations)`.

6. Update `syncDynamicSelections(filterState, apps)` — add location sync (same pattern as companies; Shift and Work Setup are static so no sync needed for those).

**Constraints**
- Do not change existing filter functions (`filterByStatus`, `filterByCompany`, etc.)
- `getAvailableLocations` must filter out empty/null location values — only return non-empty strings

**Validation**
- `tests/utils/filterSort.test.js`:
  - `filterByShift` returns only matching apps; empty array returns all
  - `filterByWorkSetup` returns only matching apps
  - `filterByLocation` returns only matching apps
  - `isAnyFilterActive` returns true when any of the three new arrays is non-empty
  - `getAvailableLocations` returns sorted distinct non-empty locations
  - `syncDynamicSelections` drops stale location values that no longer exist in apps
  - `applyFilters` chains the new filters correctly

---

### [X] Task 08.2 — Add filter buttons to QuickFiltersToolbar

**Target files**
- `src/components/QuickFiltersToolbar.js`

**Expected behavior**

1. Add three module-level button references: `_shiftButton`, `_workSetupButton`, `_locationButton`.

2. Add private panel render functions:
   - `renderShiftPanel()` — uses `FilterPanel.render({ title: 'Shift', options: SHIFT_VALUES, selected: _filterState.shifts, onChange, onClear })`
   - `renderWorkSetupPanel()` — uses `FilterPanel.render({ title: 'Work Setup', options: WORK_SETUP_VALUES, selected: _filterState.workSetups, ... })`
   - `renderLocationPanel()` — uses `FilterPanel.render({ title: 'Location', options: getAvailableLocations(_allApps, _filterState), selected: _filterState.locations, ... })`

3. Create three filter buttons via `createFilterButton()` and append them to `filters` in `render()`, after the existing five buttons.

4. Update `getActiveFilterCount()`:
   ```js
   + (filterState.shifts?.length ?? 0)
   + (filterState.workSetups?.length ?? 0)
   + (filterState.locations?.length ?? 0)
   ```

5. Update `refreshOpenPanel()` to handle `'shift'`, `'workSetup'`, `'location'` panel types.

6. Update `updateButtons()` to call `setButtonDisabled` and `setPressed` for the three new buttons.

7. Import `SHIFT_VALUES`, `WORK_SETUP_VALUES` from `src/models/application.js` and `getAvailableLocations` from `src/utils/filterSort.js`.

**Constraints**
- Do not change existing button layout or existing panel render functions
- Location button disabled when `totalCount === 0` (same as Status, Company buttons)

**Validation**
- `tests/components/QuickFiltersToolbar.test.js`:
  - Three new filter buttons are present after `render()`
  - Clicking Shift button opens a panel with options Day, Mid, Night, Flexible
  - Selecting a Shift value calls `onFilterChange` with `shifts` updated
  - `getActiveFilterCount` includes new filter arrays in the count

---

### [X] Task 08.3 — Update Tracker filter state normalization

**Target files**
- `src/pages/Tracker.js`

**Expected behavior**
Update `normalizeStoredFilterState(value)` to validate and include the three new filter arrays:

```js
const shifts = Array.isArray(stored.shifts)
  ? stored.shifts.filter((s) => SHIFT_VALUES.includes(s))
  : [];
const workSetups = Array.isArray(stored.workSetups)
  ? stored.workSetups.filter((w) => WORK_SETUP_VALUES.includes(w))
  : [];
const locations = Array.isArray(stored.locations)
  ? stored.locations.filter((l) => typeof l === 'string')
  : [];
```

Add `shifts`, `workSetups`, `locations` to the returned object.

Import `SHIFT_VALUES` and `WORK_SETUP_VALUES` from `src/models/application.js`.

**Constraints**
- Do not change existing normalization logic for `statuses`, `companies`, salary, compat, or `favoritesOnly`
- Old stored filter state (without `shifts`/`workSetups`/`locations`) must load cleanly — the missing keys fall back to `[]`

**Validation**
- `tests/pages/Tracker.test.js`:
  - `normalizeStoredFilterState({ shifts: ['Day', 'InvalidValue'] })` returns `shifts: ['Day']`
  - `normalizeStoredFilterState({ workSetups: ['Remote', 'Bad'] })` returns `workSetups: ['Remote']`
  - `normalizeStoredFilterState({})` returns `shifts: [], workSetups: [], locations: []`
  - Existing normalization behavior is unchanged

---

## Phase 09 — Tests

Goal: automated test coverage for all changes. Each sub-task targets a specific test file.

---

### [X] Task 09.1 — Server validation tests

**Target file**: `tests/server/validation.test.js`

**Tests to add**
- `createSchema` accepts each valid `shift` value
- `createSchema` rejects an invalid `shift` value; error includes the `shift` field
- `createSchema` accepts `shift: ''`
- `createSchema` accepts each valid `workSetup` value
- `createSchema` rejects an invalid `workSetup`; error includes the `workSetup` field
- `createSchema` accepts `workSetup: ''`
- `createSchema` accepts `preferredSkills: ['GraphQL']`
- `createSchema` rejects `preferredSkills: 'GraphQL'` (non-array)
- `createSchema` accepts all six new fields omitted (all optional)
- `updateSchema` allows patching with only new fields present

---

### [X] Task 09.2 — Server persistence and application tests

**Target files**: `tests/server/persistence.test.js`, `tests/server/applications.test.js`

**Persistence tests to add**
- `initSchema()` on a fresh DB creates all six new columns
- `initSchema()` on a DB that already has the columns does not error (idempotent)
- A record created before the migration (simulate by inserting without new columns) is returned with `preferredSkills: []` and text fields as `null`

**Application tests to add**
- `create()` with all six new fields stores and returns them correctly
- `create()` without new fields returns `preferredSkills: []` and null text fields
- `update()` sets `location`, `shift`, `workSetup`, `compatNotes`, `generalNotes`
- `update()` sets and clears `preferredSkills` (from populated array to `[]`)
- `getById()` on a record with new fields returns them in camelCase

---

### [X] Task 09.3 — Client model tests

**Target file**: `tests/models/application.test.js`

**Tests to add**
- `SHIFT_VALUES` is exported and equals `['Day', 'Mid', 'Night', 'Flexible']`
- `WORK_SETUP_VALUES` is exported and equals `['Remote', 'Hybrid', 'On-site', 'Field']`
- `normalizeApplication` sets `location`, `shift`, `workSetup`, `compatNotes`, `generalNotes` to `''` when absent
- `normalizeApplication` sets `preferredSkills` to `[]` when absent or non-array
- `validateApplication` coerces invalid `shift` to `''`
- `validateApplication` coerces invalid `workSetup` to `''`
- `validateApplication` does not modify a valid `shift` or `workSetup`

---

### [X] Task 09.4 — filterSort tests

**Target file**: `tests/utils/filterSort.test.js`

**Tests to add**
- `filterByShift(apps, [])` returns all apps
- `filterByShift(apps, ['Day'])` returns only Day-shift apps
- `filterByWorkSetup` — same pattern
- `filterByLocation(apps, ['Manila'])` returns only Manila apps (case-sensitive)
- `getAvailableLocations` returns sorted distinct non-empty locations
- `getAvailableLocations` excludes apps filtered out by other active filters
- `isAnyFilterActive({ ...DEFAULT, shifts: ['Day'] })` returns `true`
- `isAnyFilterActive({ ...DEFAULT, workSetups: ['Remote'] })` returns `true`
- `isAnyFilterActive({ ...DEFAULT, locations: ['Manila'] })` returns `true`
- `syncDynamicSelections` removes stale location from `filterState.locations`
- `applyFilters` with `shifts: ['Day']` returns only Day-shift apps

---

### [X] Task 09.5 — Modal tests

**Target file**: `tests/components/Modal.test.js`

**Tests to add / update**

_Layout_
- Modal body contains all new field labels after `Modal.open()`
- "Skills" label is now "Required Skills"
- New fields use correct span (half vs full)

_Inline edit — text_
- Clicking Location renders an input; blurring with value updates draft
- Pressing Esc reverts without updating draft

_Inline edit — select_
- Clicking Shift renders a `<select>`; changing value updates `_draft.shift`

_Chip editor_
- Entering a skill and pressing Enter adds it to `_draft.skills`
- Clicking × on a chip removes it

_Draft & footer_
- Footer hidden initially (edit mode)
- Footer visible after any field change
- `Ctrl+S` saves when dirty; no-op when clean
- Save success: footer hidden, toast "Saved.", `onApplicationUpdate` called
- Save failure: footer visible, draft unchanged

_Discard guard_
- Dirty draft + ✕ click: dialog shown; confirm closes modal
- Dirty draft + Esc: dialog shown; cancel leaves modal open
- Clean draft + ✕: closes immediately

_Create mode_
- `Modal.open(null, { mode: 'create' })`: empty fields, footer always visible, Archive button absent
- Create button disabled with empty Job Title or Company
- Create button enabled with both filled
- Create success: `onApplicationCreate` called, toast, modal switches to Edit mode

_Status as draft_
- Status change does not call `api.update` (regression guard)
- Favorite still calls `api.update` immediately (regression guard)

---

### [X] Task 09.6 — Tracker tests

**Target file**: `tests/pages/Tracker.test.js`

**Tests to add**
- `normalizeStoredFilterState` with `shifts: ['Day', 'Bad']` returns `shifts: ['Day']`
- `normalizeStoredFilterState` with `workSetups: ['Remote', 'Invalid']` returns `workSetups: ['Remote']`
- `normalizeStoredFilterState` with missing new keys returns `shifts: [], workSetups: [], locations: []`
- Clicking "+ New application" opens the modal in create mode (spy on `Modal.open`)
- `onApplicationCreate` callback prepends new record to `_applications` and re-renders

---

### [X] Task 09.7 — Filter localStorage round-trip tests

**Target file**: `tests/utils/filterSort.test.js` (or `tests/pages/Tracker.test.js`)

**Tests to add**

These tests verify that new filter values persist correctly through `localStorage` and are restored on next load:

1. Apply a `shifts: ['Day']` filter → serialize with `JSON.stringify` → call `normalizeStoredFilterState(JSON.parse(...))` → assert result contains `shifts: ['Day']`
2. Apply a `workSetups: ['Remote']` filter → same round-trip → assert `workSetups: ['Remote']`
3. Apply a `locations: ['Manila']` filter → same round-trip → assert `locations: ['Manila']`
4. Stored `shifts: ['Day', 'InvalidValue']` survives round-trip as `shifts: ['Day']` (invalid value stripped by normalization)
5. Old stored filter state without `shifts`/`workSetups`/`locations` keys → `normalizeStoredFilterState` returns all three as `[]` (backward compat)

**Constraints**
- These tests do not require a real `localStorage` implementation — serialize/deserialize manually using `JSON.stringify`/`JSON.parse` and pass the result to `normalizeStoredFilterState`
- No browser mocking required

---

## Phase 10 — Browser Smoke Test

Goal: verify the full feature end-to-end in a real browser against a running server. Catches rendering, CSS layout, real keyboard interaction, and mobile viewport issues that automated tests cannot detect.

**Setup**: start the dev server (`npm run dev`) and the backend, then run `node server/db-seed.js` to populate seed data with all shift and work setup variants.

---

### [X] Task 10.1 — Extended metadata layout (User Story 1)

**Steps**
1. Open any seeded application card. Confirm the overlay shows all new fields: Location, Shift, Work Setup, Compat Notes, General Notes, Preferred Skills, and the read-only Last Updated date, arranged in the 2-column grid.
2. Open a second application that has no values in the new fields. Confirm each empty field shows `—` with no broken layout.
3. Edit the Location field, blur, click Save. Refresh the page, reopen the application. Confirm the Location value is retained.

**Pass criteria**
- All new fields visible in the correct 2-column grid layout.
- Empty fields show `—` without layout breakage.
- Saved values persist after a full browser refresh.

---

### [X] Task 10.2 — Inline editing behavior (User Story 2)

**Steps**
1. Click a text field (e.g., Company). Confirm it becomes an `<input>`. Type a value and press Enter; confirm the field commits and the Save/Discard footer appears.
2. Click a text field, type, then press Esc. Confirm the value reverts and the footer does not appear.
3. Click the Shift field. Confirm a `<select>` with options Day, Mid, Night, Flexible plus an empty option appears. Select a value; confirm it commits and the footer appears.
4. In the Required Skills chip editor, type a skill and press Enter — chip appears. Click ×; chip removes. Type a duplicate skill; confirm it is not added.
5. Edit a multiline field (e.g., General Notes), then press Ctrl+Enter (or Cmd+Enter on Mac). Confirm the edit commits.
6. With a dirty draft, press Ctrl+S (or Cmd+S). Confirm a "Saved." toast appears and the footer hides.
7. Edit a field and blur it. Click the footer Discard button; confirm the discard confirmation dialog appears. Click "Keep editing"; overlay stays open with the edit intact. Discard again and confirm; field reverts and footer hides.

**Pass criteria**
- All field types (text, multiline, select, chip editor, header title) activate inline on click.
- Esc reverts without committing; Enter / Ctrl+Enter commits.
- Footer appears on first edit, hides after save or confirmed discard.
- Ctrl+S / Cmd+S saves correctly.

---

### [X] Task 10.3 — Create mode (User Story 3)

**Steps**
1. Click "+ New application" (FAB on mobile, toolbar button on desktop). Confirm: all fields empty, status badge reads "Wishlisted", footer is visible, Create button is disabled, Archive quick action is absent.
2. Fill in Job Title only. Confirm the Create button remains disabled.
3. Fill in Company Name. Confirm the Create button enables.
4. Click Create. Confirm: "Application created." toast, overlay switches to Edit mode (Save button label, Archive button visible, ID pill shows new record's ID), and the new card appears in the tracker list.
5. Open create mode again, fill in required fields, then click ✕ or the backdrop. Confirm the discard dialog appears — create mode is always dirty.

**Pass criteria**
- Create mode opens with empty/Wishlisted state and no Archive action.
- Create button disabled until both required fields are filled.
- Successful create: toast, edit-mode switch, new card in tracker list.
- Closing create mode always prompts discard confirmation.

---

### [X] Task 10.4 — Discard guard on all close triggers (User Story 4)

**Steps**
1. Open an application, edit a field, blur (footer visible). Click ✕. Confirm dialog appears. Click "Keep editing"; overlay stays open. Click ✕ again; click "Discard"; overlay closes.
2. Repeat step 1 using backdrop click instead of ✕.
3. Repeat using Esc (not inside a field).
4. Open an application with no edits. Click ✕; confirm overlay closes immediately with no dialog.
5. Open an application, click into a text field (input visible), press Esc. Confirm the field reverts but the overlay stays open and no dialog appeared.
6. With a dirty overlay, click the footer Discard button, wait for the dialog, then press Esc. Confirm only the dialog is dismissed — no second dialog appears, overlay stays open.

**Pass criteria**
- All three close triggers (✕, backdrop, Esc) show discard dialog when dirty; close immediately when clean.
- Esc inside an active field reverts the field only — does not close the overlay.
- Esc while the confirm dialog is open dismisses only the dialog.

---

### [X] Task 10.5 — New field filters (User Story 5)

**Steps**
1. Click the Shift filter button. Confirm a panel opens with Day, Mid, Night, Flexible options. Select "Day"; confirm only Day-shift applications are visible.
2. Clear the Shift filter. Confirm all applications return.
3. Click the Work Setup filter. Select "Remote"; confirm only Remote applications are visible.
4. Click the Location filter. Confirm only non-empty distinct location values are listed. Select a location; confirm the list filters correctly.
5. Combine two filters (e.g., Shift = Day and Work Setup = Remote). Confirm only applications matching both criteria are shown.
6. Reload the page. Confirm the active filters are restored from localStorage.

**Pass criteria**
- All three filter panels open with correct options.
- Single and combined filters produce correct results.
- Active filters survive a page reload.

---

### [X] Task 10.6 — Mobile bottom-sheet layout

**Steps**
1. Open Chrome DevTools and set device width to 375px (e.g., iPhone SE preset).
2. Open an application overlay. Confirm it slides up from the bottom with rounded top corners, full viewport width, and no horizontal margin.
3. Confirm body fields stack in a single column.
4. Scroll the body; confirm the header and footer remain pinned.
5. Tap/click a field; confirm inline editing works at mobile width.

**Pass criteria**
- At ≤ 639px the overlay is a bottom sheet, not a centered dialog.
- Single-column body layout.
- Header and footer stay fixed while body scrolls.
- Inline editing functions correctly at mobile width.

---

## Phase 11 — Post-Launch Manual Testing Fixes

Goal: Address all findings from manual browser testing of Phase 10. Three priority groups executed as a single implementation phase. Run `npm test` and full browser smoke-test after completing all groups.

---

### Group A — Required Field Compliance (Constitution v1.2.0)

---

### [X] Task 11.1 — Promote responsibilities to required in server validation

**Target files**
- `server/validation/application.js`

**Expected behavior**
Change `responsibilities` from `optionalText` to a required non-empty string:

```js
responsibilities: z.string().min(1, 'Responsibilities is required'),
```

Both `createSchema` and `updateSchema` pick this up automatically through `writableFields`.

**Constraints**
- DB column stays TEXT nullable — no schema migration. Enforcement is at the API layer only.
- Do not change any other field's validation rule.

**Validation**
- `tests/server/validation.test.js`:
  - `createSchema` rejects a record with `responsibilities: ''`
  - `createSchema` rejects a record with `responsibilities` omitted
  - `createSchema` accepts a record with a non-empty `responsibilities` value
  - `updateSchema` rejects `responsibilities: ''` when present in the patch

---

### [X] Task 11.2 — Promote responsibilities to required in client model

**Target files**
- `src/models/application.js`

**Expected behavior**
Add `responsibilities` to the `validateApplication` required-field guard (same pattern as `jobTitle` and `companyName`):

```js
if (!validated.responsibilities?.trim()) {
  validated._corrupt = true;
}
```

**Constraints**
- `normalizeApplication` already ensures `responsibilities` defaults to `''` — do not change that.
- `_corrupt` flag behavior is unchanged.

**Validation**
- `tests/models/application.test.js`:
  - `validateApplication({ ...valid, responsibilities: '' })` sets `_corrupt: true`
  - `validateApplication({ ...valid, responsibilities: 'Some duties' })` does not set `_corrupt`

---

### [X] Task 11.3 — Add responsibilities to modal Save/Create validation guards

**Target files**
- `src/components/Modal.js`

**Expected behavior**
In the Save button handler (Task 05.3) and Create button handler (Task 07.2), extend the required-field check to include `responsibilities`:

```js
if (!_draft.responsibilities?.trim()) {
  showFieldError(responsibilitiesRow, 'Responsibilities is required');
  hasError = true;
}
```

If any required field is empty, show its inline error and abort — do not call `api.update` or `api.create`.

**Constraints**
- Show errors for all missing required fields simultaneously, not just the first one found.
- Inline error display must match the existing pattern used for jobTitle and companyName errors.

**Validation**
- `tests/components/Modal.test.js`:
  - In Edit mode: Save with empty responsibilities shows inline error, does not call `api.update`
  - In Create mode: Create with empty responsibilities shows inline error, does not call `api.create`
  - With all three required fields non-empty, save proceeds normally

---

### [X] Task 11.4 — Add required field visual indicators to modal

**Target files**
- `src/components/Modal.js`
- `src/styles/main.css` (or `src/styles/modal.css` if modal has its own stylesheet)

**Expected behavior**
Pass a `required: true` option to `makeInlineText` for `jobTitle`, `companyName`, and `responsibilities`. The helper appends a `<span class="modal-field__required" aria-hidden="true">*</span>` after the label text when `required` is true. CSS styles it as a small red/accent asterisk.

**Constraints**
- `required` option is false by default — no other field should show an indicator.
- The asterisk is `aria-hidden` — the required state is communicated via the inline error message on validation failure, not the indicator alone.
- **Optional enhancement** *(skip if complex)*: hide the indicator in pure display mode and only show it while the field is in edit state (i.e., when the inline input/textarea is active). If this adds significant complexity, always-visible is acceptable.

**Validation**
- `tests/components/Modal.test.js`:
  - Job Title, Company, and Responsibilities field labels each contain a `*` indicator element
  - No other field label contains the indicator

---

### Group B — Rendering & Filter Fixes

---

### [X] Task 11.5 — Fix newline rendering in multi-line display fields

**Target files**
- `src/styles/main.css` (or modal stylesheet)
- `src/components/Modal.js` (only if CSS alone is insufficient)

**Expected behavior**
Multi-line text fields (responsibilities, compatNotes, generalNotes) render with `white-space: pre-wrap` in display mode so that `\n` characters produce visible line breaks. No content escaping required — `textContent` assignment already prevents XSS.

Add to the display span element inside `makeInlineText` when `multiline: true`:

```css
.modal-field__display--multiline {
  white-space: pre-wrap;
}
```

Or add the class directly on the display element in the `makeInlineText` helper.

**Constraints**
- Single-line fields must not be affected.
- The `<textarea>` edit element is unaffected — it already handles newlines correctly.

**Validation**
- `tests/components/Modal.test.js`:
  - A `responsibilities` value containing `\n` renders a display element with `white-space: pre-wrap` (check the computed style or class)
- Manual: enter a multi-line value in Responsibilities, save, reopen — confirm line breaks are visible.

---

### [X] Task 11.6 — Add "(Not set)" option to optional field filter panels

**Target files**
- `src/utils/filterSort.js`
- `src/components/FilterPanel.js`
- `src/components/QuickFiltersToolbar.js`

**Expected behavior**
1. `filterSort.js` — update `filterByShift`, `filterByWorkSetup`, and `filterByLocation` to treat a sentinel value `''` (empty string) as "Not set": if the selected values include `''`, also include applications where the field is null or empty string.

2. `FilterPanel.js` — when rendering a filter panel, prepend a "(Not set)" option (value `''`) above the enum/text options when the panel type supports it (Shift, Work Setup, Location).

3. `QuickFiltersToolbar.js` — pass the `includeNotSet: true` flag (or equivalent) to the three new filter panel render calls.

**Constraints**
- Status, Company, Salary, Compat, and Favorites filters are unaffected.
- "(Not set)" must appear as the first option in the panel, above all enum values.
- `isAnyFilterActive` treats `['']` as active (user explicitly selected "Not set").

**Validation**
- `tests/utils/filterSort.test.js`:
  - `filterByShift(apps, [''])` returns only apps with null or empty shift
  - `filterByShift(apps, ['Day', ''])` returns Day-shift apps AND apps with no shift
  - Same pattern for `filterByWorkSetup` and `filterByLocation`
- `tests/components/FilterPanel.test.js` (or equivalent):
  - Filter panel rendered with `includeNotSet: true` has "(Not set)" as first option

---

### [X] Task 11.7 — Fix sort popup positioning on desktop scroll

**Target files**
- `src/components/SortPanel.js` or `src/components/QuickFiltersToolbar.js` (whichever opens the sort panel)
- `src/styles/main.css`

**Expected behavior**
When the sort panel opens, calculate its position using `getBoundingClientRect()` on the trigger button and apply `position: fixed` with a computed `top` value — the same strategy already used by filter popups. The panel must not clip above the visible viewport when the user has scrolled down.

**Constraints**
- Fix must not affect filter popup positioning (those already work correctly).
- On mobile the panel either follows the same fixed-position approach or uses the bottom-sheet pattern — do not regress mobile sort behavior.

**Validation**
- Manual: scroll to the page footer, click the sort button — confirm the panel is visible on screen.
- `tests/components/QuickFiltersToolbar.test.js`: no regression in sort panel open/close behavior.

---

### [X] Task 11.8 — Move quick filter icons to third row on mobile

**Target files**
- `src/styles/main.css`
- `src/components/QuickFiltersToolbar.js` (only if DOM restructuring is needed)

**Expected behavior**
On mobile (≤639px), the toolbar uses three rows:
1. Row 1: "+ New application" button and active filter count badge
2. Row 2: "X applications / Y results" count text
3. Row 3: filter icon buttons, left-aligned, wrapping as needed

CSS approach: wrap the filter icon buttons in a dedicated container (`.toolbar-filters`) that renders as its own row (`flex-wrap` or `flex-direction: column` on the outer toolbar, then `flex-basis: 100%` on the count row and the filters row).

**Constraints**
- Desktop layout (≥640px) is unchanged.
- No filter functionality changes.
- Filter buttons must remain accessible by keyboard and touch.

**Validation**
- Manual: open Chrome DevTools, set width to 375px — confirm three distinct rows with no text/icon overlap.
- No automated test required; note the manual verification in the test file.

---

### [X] Task 11.9 — Update footer version to match current release

**Target files**
- `src/components/Footer.js` (or wherever the version string is rendered)

**Expected behavior**
Update the version string to `0.6.0` (or whatever the current `package.json` version is). Add a comment or convention note that this string must be updated on every release.

**Constraints**
- Do not pull `package.json` dynamically at runtime — keep it a static string.

**Validation**
- Manual: confirm footer displays the correct version.

---

### Group C — UI/UX Polish

---

### [X] Task 11.10 — Move quick action buttons to overlay header row 3

**Target files**
- `src/components/Modal.js`
- `src/styles/main.css`

**Expected behavior**
The `quickActions` container (Favorite, Change Status, Archive, Close buttons) appears as a third row in the modal header — below the ID pill / title row and below any subtitle row. On very narrow viewports (e.g. Galaxy Z Fold at ~280px) placing actions on row 1 caused them to wrap and overlap the title. Row 3 gives each row enough horizontal space.

> **⚠ Revision note**: An earlier version of this task specified "row 1, right-aligned". That caused icon overflow on narrow mobile viewports. The correct placement is row 3.

**Constraints**
- All quick action button behaviors (Favorite, Status, Archive, Close) are unchanged.
- Desktop layout must also place quick actions below the title (row 3), not inline with it.
- Ensure the header does not become excessively tall on desktop — use compact padding.

**Validation**
- Manual: open the overlay at 375px viewport — confirm quick actions are on a separate row, no overlap with title.
- Manual: open on desktop — confirm layout is compact and buttons are accessible.
- `tests/components/Modal.test.js`: quick action buttons are still present in the DOM (regression guard only).

---

### [X] Task 11.11 — Update Archive icon to filing box in overlay and card

**Target files**
- `src/utils/icons.js` (or wherever SVG icon helpers are defined)
- `src/components/Modal.js`
- `src/components/Card.js`

**Expected behavior**
Replace the current Archive button icon with a filing-box SVG (📦 or a simplified box-with-slot SVG). The same icon must be used in both the card's quick-action area and the overlay header Archive button to ensure visual consistency.

Add `iconArchive()` to `icons.js` (or update the existing archive icon helper) with the filing-box SVG markup, then reference it in both Modal.js and Card.js.

**Constraints**
- Do not change Archive button behavior.
- Close button icon (✕) is unchanged.
- Accessible `aria-label="Archive"` must remain on both buttons.

**Validation**
- Manual: confirm archive icon is a filing box in both the card and the overlay, and differs clearly from the Close icon.

---

### [X] Task 11.12 — Add tooltips to overlay quick action buttons

**Target files**
- `src/components/Modal.js`

**Expected behavior**
Each overlay quick action button must show exactly one tooltip on hover. Use the `title` attribute:
- Favorite: `title="Favorite"`
- Change Status: `title="Change status"`
- Archive: `title="Archive"`
- Close: `title="Close"`

The fix for double-tooltip is to **remove `aria-label`** on these buttons, not to remove `title`. The `title` attribute is what produces the visible tooltip and MUST remain. `aria-label` was the source of the duplicate — remove it where `title` already provides the accessible name.

**Do NOT remove `title`** — doing so leaves buttons with zero tooltips, which is wrong. The end state must be: `title` present, `aria-label` absent, exactly one tooltip visible on hover.

> **⚠ Revision notes**:
> - Favorite label corrected from "Star / Unstar" to "Favorite".
> - Double tooltip was caused by `aria-label` + `title` both set. Fix = remove `aria-label`, keep `title`.
> - Over-removing both attributes (leaving zero tooltips) is also incorrect — `title` must stay.

**Constraints**
- Quick filter toolbar buttons (Shift, Work Setup, etc.) are unaffected — do not touch QuickFiltersToolbar.js.
- Each button must have `title` set and must NOT have `aria-label` set.
- Hovering any overlay quick action button must show exactly one tooltip.

**Validation**
- Manual: hover each overlay quick action button — confirm exactly one tooltip appears.
- Manual: confirm Favorite tooltip reads "Favorite".
- Manual: confirm no button shows two tooltips simultaneously.

---

### [X] Task 11.13 — Increase FAB drop-shadow on mobile

**Target files**
- `src/styles/main.css`

**Expected behavior**
At mobile viewport (≤639px), increase the `.fab` button's `box-shadow` to clearly lift it above the page content. Suggested value: `0 4px 16px rgba(0,0,0,0.28)` or equivalent — adjust to match the design aesthetic.

**Constraints**
- Desktop FAB shadow is unchanged.
- Do not change FAB size, position, or behavior.

**Validation**
- Manual: open the app on a 375px viewport — confirm the FAB is visually distinct from the content behind it.

---

### [X] Task 11.14 — Fix chip editor blur/Enter race condition

**Target files**
- `src/components/Modal.js`

**Expected behavior**
When the user types a skill and presses Enter, `addChip` is called which internally calls `input.blur()`. This triggers the blur handler which also calls `renderChips`, replacing the chip DOM. Then `addChip` calls `renderChips` again on the now-orphaned node, throwing:

```
NotFoundError: Failed to execute 'replaceChildren' on 'Element':
The node to be removed is no longer a child of this node.
```

Fix: prevent the blur handler from calling `renderChips` when the Enter keydown handler is already handling the commit. Use a flag:

```js
let _committingByEnter = false;

// In Enter keydown handler:
_committingByEnter = true;
input.blur();
_committingByEnter = false;

// In blur handler:
if (_committingByEnter) return;
// ... rest of blur handler
```

Alternatively, call `addChip` logic directly in the Enter handler without relying on `blur()` to trigger commit, then manually clear and refocus the input.

> **Note**: A prior fix attempt (commit `a379645`) did not fully resolve this. The error was reproduced at `Modal.js:397` after that commit. The race condition must be eliminated, not just guarded.

**Constraints**
- The fix must work for both the Enter keydown path and the blur path independently.
- Comma (`,`) keydown chip commit must also be guarded against the same race.
- Do not introduce a debounce or setTimeout — the fix must be synchronous.

**Validation**
- `tests/components/Modal.test.js`:
  - Simulate Enter on the chip input — no error thrown; chip appears in DOM; `_draft.skills` updated
  - Simulate blur on the chip input with a value — chip appears; no double-render error
- Manual: open any application, type a skill, press Enter repeatedly — no console errors.

---

### [X] Task 11.15 — Fix text overflow on narrow viewports

**Target files**
- `src/styles/main.css` (or modal stylesheet)

**Expected behavior**
On very narrow viewports (e.g. Galaxy Z Fold ~280px), long text values in modal fields (especially URLs and multi-line fields) overflow the container's right edge and get clipped. Apply:

```css
.modal-field__display {
  overflow-wrap: break-word;
  word-break: break-word;
  min-width: 0;
}
```

`min-width: 0` is needed on flex children to allow shrinking below content size. Apply to all field display elements inside the modal body.

**Constraints**
- Desktop layout must be unaffected.
- URL field: breaking is preferable to overflowing — URLs with no natural break points must wrap.
- Do not truncate (`text-overflow: ellipsis`) — full content must remain readable.

**Validation**
- Manual: open Chrome DevTools, set width to 280px (Galaxy Z Fold), open an application with a long URL and long Responsibilities — confirm text wraps inside the container, no overflow into the margin.

---

### [X] Task 11.16 — Fix status pill wrapping and centering on narrow viewport

**Target files**
- `src/styles/main.css` (or modal stylesheet)

**Expected behavior**
On very narrow viewports (≤320px), the status pill text in the overlay header can wrap to two lines. When this happens, the text must remain centered within the pill. Ensure:

```css
.modal-status-badge {   /* or whichever class the status pill uses */
  text-align: center;
  white-space: normal;   /* allow wrap — do not clip */
}
```

If possible, prefer keeping the pill on one line by reducing font size or padding at narrow breakpoints (`@media (max-width: 360px)`). Only fall back to centered two-line wrap if single-line is not achievable without truncation.

**Constraints**
- Desktop and standard mobile (375px+) appearance is unchanged.
- Do not truncate the status text — "Phone Screen", "Assessment" must remain fully readable.

**Validation**
- Manual: open Chrome DevTools, set width to 280px, open the overlay — confirm status pill text either stays on one line or wraps with centered text.

---

### [ ] Task 11.17 — Fix Salary field empty-state display in overlay

**Spec reference**: FR-037

**Target files**
- `src/components/Modal.js` — salary field display rendering

**Background**
The Salary field renders a completely blank area when the application has no salary value. All other optional fields display "-" as a neutral placeholder. On mobile, where overlay fields are stacked vertically, the blank salary area causes the "Salary" label to appear directly above the "Shift" label with nothing between them — misleading users into thinking Salary is not a separate editable field.

**Expected behavior**
In display mode (non-edit state), the salary field MUST show "-" when its value is empty, null, or zero. This is consistent with how other optional fields (Location, Work Setup, Shift, etc.) are already rendered.

**What to change**
Locate the salary field's display-mode render path in `Modal.js`. Where the salary display value is set, apply the same "-" fallback used for other optional text fields. For example:

```js
// before
const displaySalary = formatSalaryDisplay(app.salary);

// after
const displaySalary = formatSalaryDisplay(app.salary) || '–';
```

Confirm the same fallback pattern used by Location, Shift, and Work Setup fields is applied consistently.

**Constraints**
- Only the display-mode render is affected — the edit-mode input field is unchanged.
- Do not change `formatSalaryDisplay` itself; apply the fallback at the render call site in `Modal.js`.
- Formatted salary values (e.g. "₱50,000") must continue to display normally.

**Validation**
- Open any application with no salary set — Salary field must show "–" in the overlay.
- Open any application with a salary value set — Salary field must show the formatted value normally.
- Manual mobile check (≤640px): Salary field now shows "–", making the label clearly belong to its own row above Shift.
