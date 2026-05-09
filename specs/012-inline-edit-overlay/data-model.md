# Data Model: 012-inline-edit-overlay

Field mapping across all three layers for the six new fields added by this feature. Existing fields are omitted unless they change behaviour.

---

## New fields — full layer map

| JS field (camelCase) | API JSON key   | DB column          | DB type | Default    | Validation                                          |
|----------------------|----------------|--------------------|---------|------------|-----------------------------------------------------|
| `location`           | `location`     | `location`         | TEXT    | NULL       | Optional free text; no format constraint            |
| `shift`              | `shift`        | `shift`            | TEXT    | NULL       | Enum: `Day`, `Mid`, `Night`, `Flexible`; or empty   |
| `workSetup`          | `workSetup`    | `work_setup`       | TEXT    | NULL       | Enum: `Remote`, `Hybrid`, `On-site`, `Field`; or empty |
| `compatNotes`        | `compatNotes`  | `compat_notes`     | TEXT    | NULL       | Optional free text                                  |
| `generalNotes`       | `generalNotes` | `general_notes`    | TEXT    | NULL       | Optional free text                                  |
| `preferredSkills`    | `preferredSkills` | `preferred_skills` | TEXT | `'[]'`  | JSON array of strings; serialized like `skills`     |

---

## Existing fields with UI label changes

| JS field  | DB column | Old UI label | New UI label     | Notes                               |
|-----------|-----------|--------------|------------------|-------------------------------------|
| `skills`  | `skills`  | Skills        | Required Skills  | No data or schema change; label only |

---

## Field defaults (client-side normalization)

`normalizeApplication()` ensures these types are always present, regardless of whether the server returns them:

```js
location:       '' (empty string when null/undefined)
shift:          '' (empty string when null/undefined)
workSetup:      '' (empty string when null/undefined)
compatNotes:    '' (empty string when null/undefined)
generalNotes:   '' (empty string when null/undefined)
preferredSkills: [] (empty array when null/undefined)
```

---

## Enum constants (exported from `src/models/application.js`)

```js
export const SHIFT_VALUES    = ['Day', 'Mid', 'Night', 'Flexible'];
export const WORK_SETUP_VALUES = ['Remote', 'Hybrid', 'On-site', 'Field'];
```

Used by:
- Server Zod schema (`z.enum(SHIFT_VALUES)`) — import from shared or duplicate (project uses separate server/client)
- Client `normalizeApplication()` to coerce invalid stored values to `''`
- Filter panel to populate dropdown options (static, no dynamic fetch needed)

---

## Serialization rules

| Field            | DB storage      | `toRow()` write          | `toRecord()` read                     |
|------------------|-----------------|--------------------------|---------------------------------------|
| `preferredSkills`| JSON text `'[]'`| `JSON.stringify(array)`  | `parseJson(row.preferred_skills, [])`  |
| `skills`         | JSON text `'[]'`| `JSON.stringify(array)`  | `parseJson(row.skills, [])` (unchanged)|
| All text fields  | TEXT or NULL    | value passed as-is       | value passed as-is (may be null)      |
| `shift`/`workSetup` | TEXT or NULL | value passed as-is       | value passed as-is (null → '' client) |

---

## Filter state additions

`DEFAULT_FILTER_STATE` in `src/utils/filterSort.js` gains three new keys:

```js
shifts:    [],   // multi-select from SHIFT_VALUES
workSetups: [],  // multi-select from WORK_SETUP_VALUES
locations: [],   // multi-select from distinct location values in loaded applications
```

These are persisted to localStorage alongside existing filter keys. `normalizeStoredFilterState()` validates them on load:
- `shifts` — values filtered against `SHIFT_VALUES`
- `workSetups` — values filtered against `WORK_SETUP_VALUES`
- `locations` — values kept if `typeof value === 'string'` (same as `companies`)

---

## Draft state (Modal-local)

The modal's draft is a plain JS object with the same shape as a full application record. It is **never written to storage** until the user confirms Save or Create.

```js
// Equality check for dirty detection
function _isDirty() {
  if (_mode === 'create') return true;
  for (const key of Object.keys(_draft)) {
    const a = _draft[key];
    const b = _original[key];
    if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) return true;
    } else if (a !== b) {
      return true;
    }
  }
  return false;
}
```
