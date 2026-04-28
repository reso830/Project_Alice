# Data Model: Edit / Create Profile — Full Implementation

**Branch**: `008-edit-profile-full` | **Date**: 2026-04-28

---

## Profile (root object)

Stored as a JSON string in `profile.data` (SQLite, single row, `id = 1`). Serialized and deserialized by `server/db/profile.js`.

| Field           | Type                  | Required | Validation                          |
|-----------------|-----------------------|----------|-------------------------------------|
| `firstName`     | `string`              | Yes      | Non-empty after trim                |
| `lastName`      | `string`              | Yes      | Non-empty after trim                |
| `city`          | `string`              | No       | Trimmed                             |
| `phone`         | `string`              | No       | Trimmed                             |
| `email`         | `string`              | No       | Must match email format if provided |
| `summary`       | `string`              | No       | Trimmed                             |
| `experience`    | `ExperienceEntry[]`   | No       | Array of valid ExperienceEntry      |
| `education`     | `EducationEntry[]`    | No       | Array of valid EducationEntry       |
| `skills`        | `string[]`            | No       | Non-empty strings, deduplicated     |
| `certifications`| `CertificationEntry[]`| No       | Array of valid CertificationEntry   |
| `awards`        | `AwardEntry[]`        | No       | Array of valid AwardEntry           |
| `languages`     | `LanguageEntry[]`     | No       | Array of valid LanguageEntry        |
| `links`         | `LinkEntry[]`         | No       | Array of valid LinkEntry            |

---

## ExperienceEntry

| Field              | Type      | Required | Validation                              |
|--------------------|-----------|----------|-----------------------------------------|
| `role`             | `string`  | Yes      | Non-empty after trim                    |
| `company`          | `string`  | Yes      | Non-empty after trim                    |
| `responsibilities` | `string`  | Yes      | Non-empty after trim                    |
| `dateStarted`      | `string`  | Yes      | MM/YYYY format, month 01–12, year ≥ 1900 |
| `dateEnded`        | `string`  | Conditional | Required if `currentWork` is false; MM/YYYY format |
| `currentWork`      | `boolean` | Yes      | Must be `true` or `false`               |

**Sort order**: `currentWork === true` first; then by `dateEnded` descending (YYYY*100+MM); then by `dateStarted` descending as fallback.

**Backward compatibility**: Old entries may have `{ role, company, period, desc }`. The normaliser maps `desc → responsibilities`, drops `period`, sets `dateStarted: ''`, `dateEnded: ''`, `currentWork: false`.

---

## EducationEntry

| Field          | Type     | Required | Validation           |
|----------------|----------|----------|----------------------|
| `degreeMajor`  | `string` | Yes      | Non-empty after trim |
| `university`   | `string` | Yes      | Non-empty after trim |
| `yearCompleted`| `string` | Yes      | Non-empty after trim (numeric preferred; non-numeric sorts to end) |

**Sort order**: `parseInt(yearCompleted)` descending. Non-numeric values sort to the end.

**Backward compatibility**: Old entries may have `{ degree, school, year }`. The normaliser maps `degree → degreeMajor`, `school → university`, `year → yearCompleted`.

---

## CertificationEntry

| Field          | Type     | Required | Validation                                   |
|----------------|----------|----------|----------------------------------------------|
| `name`         | `string` | Yes      | Non-empty after trim                         |
| `issuingBody`  | `string` | No       | Trimmed                                      |
| `certificateId`| `string` | No       | Trimmed                                      |
| `issuanceDate` | `string` | Yes      | MM/YYYY format, month 01–12, year ≥ 1900     |
| `expiryDate`   | `string` | No       | MM/YYYY format if provided; month 01–12, year ≥ 1900 |

**Backward compatibility**: Old values were plain strings. The normaliser maps a plain string → `{ name: string, issuingBody: '', certificateId: '', issuanceDate: '', expiryDate: '' }`.

---

## AwardEntry

| Field        | Type     | Required | Validation                                         |
|--------------|----------|----------|----------------------------------------------------|
| `awardName`  | `string` | Yes      | Non-empty after trim                               |
| `issuingBody`| `string` | Yes      | Non-empty after trim                               |
| `details`    | `string` | No       | Trimmed                                            |
| `date`       | `string` | No       | If provided, MM/YYYY format, month 01–12, year ≥ 1900 |

**Backward compatibility**: Old values were plain strings. Normaliser maps plain string → `{ awardName: string, issuingBody: '', details: '', date: '' }`. Because `issuingBody` is required, migrated entries will have an empty required field — validation will fail at save time, prompting the user to fill it in before saving.

---

## LanguageEntry

| Field         | Type              | Required | Validation                                                          |
|---------------|-------------------|----------|---------------------------------------------------------------------|
| `language`    | `string`          | Yes      | Non-empty after trim                                                |
| `proficiency` | `ProficiencyLevel`| Yes      | One of: `'Beginner'`, `'Intermediate'`, `'Professional'`, `'Fluent'` |

**Proficiency enum**: `PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Professional', 'Fluent']`

**Backward compatibility**: Old values were plain strings. Normaliser maps plain string → `{ language: string, proficiency: '' }`. Empty proficiency is treated as unset (will not pass validation on new entries but allows existing data to load without crashing).

---

## LinkEntry

| Field          | Type     | Required | Validation                                                   |
|----------------|----------|----------|--------------------------------------------------------------|
| `url`          | `string` | Yes      | Valid URL; protocol must be `http:` or `https:`              |
| `friendlyName` | `string` | No       | Trimmed; if empty, display uses URL hostname                 |

**Backward compatibility**: Old entries had `{ platform, label, url }`. Normaliser maps `label → friendlyName`, drops `platform`.

---

## Validation Functions (client-side — `src/utils/validate.js`)

| Function                         | Signature                          | Returns                       |
|----------------------------------|------------------------------------|-------------------------------|
| `validateRequired(value)`        | `(string) → string \| null`       | Error string or null          |
| `validateMonthYear(value)`       | `(string) → string \| null`       | Error string or null          |
| `validateUrl(value)`             | `(string) → string \| null`       | Error string or null          |
| `validateEmail(value)`           | `(string) → string \| null`       | Error string or null          |

---

## Sorting Functions (`src/utils/sort.js`)

| Function                    | Signature                              | Description                                     |
|-----------------------------|----------------------------------------|-------------------------------------------------|
| `sortEducation(entries)`    | `(EducationEntry[]) → EducationEntry[]`| By `yearCompleted` descending                   |
| `sortExperience(entries)`   | `(ExperienceEntry[]) → ExperienceEntry[]`| Current first, then `dateEnded` desc, `dateStarted` desc fallback |

---

## Profile Model Changes Summary (`src/models/profile.js`)

**Modified**:
- `normaliseProfile` — updated to call new per-type normalisers for each array field
- `validateProfile` — extended to validate structured entry fields (role, company, responsibilities required in experience; degreeMajor, university, yearCompleted required in education; etc.)

**New normalisers** (private functions within the module):
- `normaliseExperienceEntry(entry)`
- `normaliseEducationEntry(entry)`
- `normaliseCertificationEntry(entry)`
- `normaliseAwardEntry(entry)`
- `normaliseLanguageEntry(entry)`
- `normaliseLinkEntry(entry)`

The existing `normaliseStringArray` continues to handle `skills` (unchanged).

---

## Database Schema

No schema changes. Profile is stored as a JSON blob in the existing `profile` table:

```sql
CREATE TABLE IF NOT EXISTS profile (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  data       TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
```

The JSON structure stored in `data` changes shape (new entry types), but the table schema is unchanged. Old data is migrated transparently by `normaliseProfile` on first read.
