# API Contracts: 012-inline-edit-overlay

Documents the request and response shapes affected by this feature. The base URL is `/api/applications`. All requests use `Content-Type: application/json`.

---

## Application record (full shape)

The response record from `GET /api/applications/:id`, `POST /`, and `PATCH /:id`. Fields added by this feature are marked **NEW**.

```jsonc
{
  "id": 42,
  "companyName": "Acme Corp",
  "jobTitle": "Frontend Engineer",
  "status": "interview",
  "compat": 78,
  "fav": false,
  "sourcePlatform": "",
  "applicationDate": "2026-04-01",
  "jobPostingUrl": "https://example.com/job/42",
  "recruiter": "Jane Doe",
  "notes": "",
  "salary": 80000,
  "responsibilities": "Build UI components...",
  "skills": ["React", "TypeScript"],          // labelled "Required Skills" in UI
  "followUpAction": "",
  "followUpDate": null,
  "lastStatusUpdate": "2026-05-01",
  "createdAt": "2026-04-01",
  "updatedAt": "2026-05-08",
  "archived": false,
  "metadata": null,

  // NEW fields
  "location": "Manila",
  "shift": "Day",
  "workSetup": "Hybrid",
  "compatNotes": "Strong React match; no Go experience",
  "generalNotes": "Referral from a friend at the company.",
  "preferredSkills": ["GraphQL", "Figma"]
}
```

New fields are `null` / `[]` for records created before this feature.

Salary range text is a UI input convenience only. Before POST/PATCH, the client parses values such as `"50000-80000"` or `"50k-80k"` and sends the lower bound as the numeric `salary` value.

---

## POST /api/applications — Create

### Request body

All fields from `writableFields`. Required: `companyName`, `jobTitle`. New fields are all optional.

```jsonc
{
  "companyName": "Acme Corp",         // required
  "jobTitle": "Frontend Engineer",    // required
  "status": "wishlisted",             // defaults to "wishlisted" if omitted

  // optional existing fields
  "recruiter": "Jane Doe",
  "salary": 80000,
  "jobPostingUrl": "https://example.com/job/42",
  "responsibilities": "...",
  "skills": ["React"],
  "compat": 0,

  // NEW optional fields
  "location": "Manila",
  "shift": "Day",                     // one of: Day, Mid, Night, Flexible — or ""
  "workSetup": "Hybrid",              // one of: Remote, Hybrid, On-site, Field — or ""
  "compatNotes": "...",
  "generalNotes": "...",
  "preferredSkills": ["GraphQL"]
}
```

### Success response — `201 Created`

```jsonc
{
  "data": { /* full application record */ }
}
```

### Validation error — `400 Bad Request`

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "shift": "Invalid enum value. Expected 'Day' | 'Mid' | 'Night' | 'Flexible'",
      "workSetup": "Invalid enum value. Expected 'Remote' | 'Hybrid' | 'On-site' | 'Field'"
    }
  }
}
```

---

## PATCH /api/applications/:id — Update

All fields are optional. The client sends only the fields that changed. Unchanged fields are omitted; the server merges with the stored record.

### Request body (partial update — inline save)

```jsonc
{
  "jobTitle": "Senior Frontend Engineer",
  "location": "Cebu",
  "shift": "Flexible",
  "workSetup": "Remote",
  "compatNotes": "Updated notes.",
  "generalNotes": "Had first call.",
  "preferredSkills": ["GraphQL", "Figma"],
  "salary": 95000
}
```

### Request body (status change — goes through draft, saved with full draft)

Status changes now accumulate in the draft and are sent as part of a full Save, not as an immediate single-field PATCH. The request body will include `status` alongside any other changed fields.

### Request body (favorite toggle — still immediate, bypasses draft)

```jsonc
{ "fav": true }
```

### Request body (archive — still immediate, bypasses draft)

Handled by `POST /api/applications/:id/archive` — no change to this endpoint.

### Success response — `200 OK`

```jsonc
{
  "data": { /* full updated application record */ }
}
```

### Not found — `404`

```jsonc
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Application not found"
  }
}
```

---

## Enum allowed values

| Field      | Allowed values                          | Empty allowed? |
|------------|-----------------------------------------|----------------|
| `shift`    | `Day`, `Mid`, `Night`, `Flexible`       | Yes (`""`)     |
| `workSetup`| `Remote`, `Hybrid`, `On-site`, `Field` | Yes (`""`)     |
| `status`   | see `STATUS_VALUES` in `shared/constants.js` | No        |

Empty string (`""`) for `shift` and `workSetup` is accepted by the server and stored as `''` (not null). Client normalizes null → `''` when reading.

---

## No new endpoints

This feature adds no new API routes. All changes are additive to the existing `/api/applications` resource.
