# Data Model: Resume Auto-Parser

**Feature**: `014-resume-parser-profile`

---

## ParsedProfileData (transient, server → client)

The server returns this shape from `POST /api/resume/parse`. It is never persisted.
All fields are nullable or empty-array when not found. Null means "not extracted".

```
ParsedProfileData
  firstName       string | null
  lastName        string | null
  email           string | null
  phone           string | null
  city            string | null
  summary         string | null   — only set when explicit About/Summary section found
  experience      ParsedExperience[]
  education       ParsedEducation[]
  skills          string[]
  certifications  ParsedCertification[]
  awards          ParsedAward[]
  languages       ParsedLanguage[]
  links           ParsedLink[]

ParsedExperience
  role            string          — position title
  company         string
  responsibilities string         — concatenated description/bullet points
  dateStarted     string          — MM/YYYY or '' if not found
  dateEnded       string          — MM/YYYY or '' if currentWork
  currentWork     boolean

ParsedEducation
  degreeMajor     string          — "B.S. Computer Science" etc.
  university      string
  yearCompleted   string          — 4-digit year or ''

ParsedCertification
  name            string
  issuingBody     string          — '' if not found (incomplete; user must fill)
  issuanceDate    string          — MM/YYYY or ''
  expiryDate      string          — MM/YYYY or ''

ParsedAward
  awardName       string
  issuingBody     string          — '' if not found
  details         string
  date            string          — MM/YYYY or ''

ParsedLanguage
  language        string
  proficiency     string          — stated level mapped to valid level, else 'Intermediate'

ParsedLink
  url             string          — full https:// URL
  friendlyName    string          — 'LinkedIn', 'Portfolio', or derived from hostname
```

### "Complete parse failure" definition

A result is considered a complete parse failure when ALL of the following are true:
- `firstName`, `lastName`, `email`, `phone`, `city`, `summary` are all null
- `experience`, `education`, `skills`, `certifications`, `awards`, `languages`,
  `links` are all empty arrays

The server still returns 200 in this case. The client detects the empty result
and shows the error state with Retry and Continue Manually options.

---

## Merge Rules (client-side, spec FR-025 to FR-028)

`mergeResumeData(currentProfile, parsedData)` → new profile object

### Singular fields
Fields: `firstName`, `lastName`, `email`, `phone`, `city`, `summary`

```
if (currentProfile[field]) → keep currentProfile[field]
else if (parsedData[field]) → use parsedData[field]
else → keep '' (empty)
```

### Collection fields
Fields: `experience`, `education`, `certifications`, `skills`, `languages`,
        `awards`, `links`

For each parsed entry, check duplicate key before appending:

| Field | Duplicate key |
|---|---|
| experience | `company + role + dateStarted` (normalized, lowercased) |
| education | `university + degreeMajor + yearCompleted` (normalized, lowercased) |
| certifications | `name + issuingBody` (normalized, lowercased) |
| skills | skill string (lowercased) |
| languages | `language` (lowercased) |
| links | normalized URL (lowercased, trailing slash removed) |
| awards | `awardName + issuingBody` (normalized, lowercased) |

"Normalized" means: `trim().replace(/\s+/g, ' ').toLowerCase()`

Entries that pass the duplicate check are appended to the end of the existing array.
Existing array order is preserved.

---

## Date Normalization (server-side parser)

Resume dates come in many formats. The parser normalizes to `MM/YYYY` for experience
and certifications, and to `YYYY` for education `yearCompleted`.

Month name → number mapping (full and abbreviated, case-insensitive):
```
January / Jan → 01
February / Feb → 02
March / Mar → 03
April / Apr → 04
May → 05
June / Jun → 06
July / Jul → 07
August / Aug → 08
September / Sep / Sept → 09
October / Oct → 10
November / Nov → 11
December / Dec → 12
```

Recognized date patterns and their output:
| Input example | Output |
|---|---|
| `Jan 2022` / `January 2022` | `01/2022` |
| `01/2022` | `01/2022` |
| `2022-01` | `01/2022` |
| `2022` (year only) | `01/2022` (assumed January) |
| `Present` / `Current` / `–` / `now` | → `currentWork: true`, `dateEnded: ''` |
| Unrecognized | `''` (left blank) |

---

## Field Mapping: Resume → Profile Model

| Resume concept | Profile field | Notes |
|---|---|---|
| Full name (first token) | `firstName` | Single token → firstName only |
| Full name (remaining tokens) | `lastName` | |
| Email | `email` | |
| Phone | `phone` | |
| City / Location | `city` | |
| LinkedIn URL | `links[].url` | friendlyName: "LinkedIn" |
| Portfolio / personal site | `links[].url` | friendlyName: "Portfolio" or hostname |
| Summary / About section | `summary` | Only if section header found |
| Current role/title | *(not extracted in V1)* | No profile field exists |
| Position title | `experience[].role` | |
| Company name | `experience[].company` | |
| Role description | `experience[].responsibilities` | Concatenated bullets |
| Start date | `experience[].dateStarted` | MM/YYYY |
| End date | `experience[].dateEnded` | MM/YYYY; blank if currentWork |
| "Present" / active role | `experience[].currentWork` | true |
| School | `education[].university` | |
| Degree + field | `education[].degreeMajor` | Combined |
| Graduation year | `education[].yearCompleted` | 4-digit year |
| Certification name | `certifications[].name` | |
| Issuing org | `certifications[].issuingBody` | |
| Issue date | `certifications[].issuanceDate` | MM/YYYY |
| Expiry date | `certifications[].expiryDate` | MM/YYYY |
| Skill | `skills[]` | Skills section only |
| Award name | `awards[].awardName` | |
| Award issuer | `awards[].issuingBody` | |
| Award details | `awards[].details` | |
| Award date | `awards[].date` | MM/YYYY |
| Language | `languages[].language` | |
| Proficiency level | `languages[].proficiency` | Defaults to "Intermediate" |
