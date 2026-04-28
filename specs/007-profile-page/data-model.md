# Data Model: Profile Page

**Branch**: `007-profile-page` | **Date**: 2026-04-28

---

## Entities

### Profile

Stored in `localStorage` under key `apptracker_profile`. The value is a JSON-serialised object or `null` when no profile exists.

| Field           | Type                  | Required | Notes                                      |
|-----------------|-----------------------|----------|--------------------------------------------|
| `firstName`     | `string`              | Yes      | Non-empty after trim                       |
| `lastName`      | `string`              | Yes      | Non-empty after trim                       |
| `city`          | `string`              | No       | Display-only location text                 |
| `phone`         | `string`              | No       | No format enforcement in this iteration    |
| `email`         | `string`              | No       | Validated as valid email format when set   |
| `summary`       | `string`              | No       | Free-form paragraph                        |
| `experience`    | `ExperienceEntry[]`   | No       | Empty array when none                      |
| `education`     | `EducationEntry[]`    | No       | Empty array when none                      |
| `skills`        | `string[]`            | No       | Trimmed, non-empty strings                 |
| `certifications`| `string[]`            | No       | Trimmed, non-empty strings                 |
| `awards`        | `string[]`            | No       | Trimmed, non-empty strings                 |
| `languages`     | `string[]`            | No       | Trimmed, non-empty strings                 |
| `links`         | `LinkEntry[]`         | No       | Empty array when none                      |

### ExperienceEntry

| Field     | Type     | Required | Notes                          |
|-----------|----------|----------|--------------------------------|
| `role`    | `string` | No       | Job title for the entry        |
| `company` | `string` | No       | Employer name                  |
| `period`  | `string` | No       | Free-form, e.g. "2021–Present" |
| `desc`    | `string` | No       | Role description               |

### EducationEntry

| Field    | Type     | Required | Notes               |
|----------|----------|----------|---------------------|
| `degree` | `string` | No       | Credential name     |
| `school` | `string` | No       | Institution name    |
| `year`   | `string` | No       | Graduation year     |

### LinkEntry

| Field      | Type     | Required | Notes                                              |
|------------|----------|----------|----------------------------------------------------|
| `platform` | `string` | No       | e.g. "LinkedIn", "GitHub", "Portfolio"             |
| `label`    | `string` | No       | Display URL text shown in the chip                 |
| `url`      | `string` | No       | Full href; opened in new tab on click              |

---

## AppCounts (Derived)

Not stored — computed at runtime from the array returned by `api.getAll()`.

```
AppCounts = { [status: string]: number }
```

**Derivation**:

```
Total   = sum of all counts (including wishlisted)
Active  = counts['phone_screen'] + counts['interview'] + counts['assessment']
Pending = counts['applied']
Offer   = counts['offer']
```

**Status slug ↔ display label mapping** (for chart labels and legend):

| Internal slug   | Display label |
|-----------------|---------------|
| `wishlisted`    | Wishlist      |
| `applied`       | Applied       |
| `phone_screen`  | Screening     |
| `interview`     | Interview     |
| `assessment`    | Assessment    |
| `offer`         | Offer         |
| `rejected`      | Rejected      |
| `withdrawn`     | Withdrawn     |
| `ghosted`       | Ghosted       |

**Status colour mapping** (from design spec):

| Slug            | Hex       |
|-----------------|-----------|
| `applied`       | `#3b82f6` |
| `phone_screen`  | `#ea580c` |
| `interview`     | `#d97706` |
| `assessment`    | `#7c3aed` |
| `offer`         | `#16a34a` |
| `rejected`      | `#dc2626` |
| `withdrawn`     | `#64748b` |
| `ghosted`       | `#94a3b8` |
| `wishlisted`    | `#9333ea` |

---

## Validation Rules

Defined in `src/models/profile.js` and enforced in `src/data/profileStore.js` before writing.

| Field       | Rule                                                             |
|-------------|------------------------------------------------------------------|
| `firstName` | Required; non-empty string after `trim()`                       |
| `lastName`  | Required; non-empty string after `trim()`                       |
| `email`     | When non-empty: must match basic email regex (`/^[^@]+@[^@]+\.[^@]+$/`) |
| All strings | Trimmed before save                                              |
| Array fields| Empty arrays allowed; `undefined` normalised to `[]`            |

**Validation return shape** (from `validateProfile(data)`):

```
{ valid: boolean, errors: { [field]: string } }
```

---

## Write Pattern (Read-Merge-Write)

`profileStore.save()` always receives the **complete** Profile object. When a single edit card (e.g. Basic Info) saves, the edit page must:

1. Read the current stored profile via `profileStore.get()` (may be `null` for a first save).
2. Spread the existing profile (or an empty default object if `null`).
3. Overwrite only the fields belonging to that card's form inputs.
4. Call `profileStore.save(mergedProfile)` with the full merged object.

This ensures that saving Basic Info never discards an already-saved Summary, and that saving Skills never clears existing experience entries.

---

## State Transitions

Profile has no status machine. The only state transition is:

- `null` → `Profile` (first save via Edit page)
- `Profile` → `Profile` (subsequent saves update fields)
- No delete operation in this iteration.

---

## Storage Location Summary

| Data             | Storage          | Key / Endpoint             |
|------------------|------------------|----------------------------|
| Profile object   | `localStorage`   | `apptracker_profile`       |
| Application list | SQLite via API   | `GET /api/applications`    |
