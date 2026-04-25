# API Contract: Applications

**Branch**: `002-backend-persistence`  
**Base URL**: `http://localhost:3001`  
**Prefix**: `/api`  
**Content-Type**: `application/json` for all requests and responses  
**Last updated**: 2026-04-26 (architect review — full field set, metadata type correction)

---

## Response Envelope

All responses use a consistent envelope.

**Success (single record)**:
```json
{ "data": { ...application } }
```

**Success (list)**:
```json
{ "data": [ ...applications ] }
```

**Error**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "companyName": "Required",
      "jobPostingUrl": "Must be a valid http or https URL"
    }
  }
}
```

`fields` is only present on `VALIDATION_ERROR`. All other errors omit it.

---

## Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | One or more fields failed validation |
| `NOT_FOUND` | 404 | No record with the given id |
| `NETWORK_ERROR` | — | Frontend-only: backend unreachable (TypeError from fetch) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

`NETWORK_ERROR` is never returned by the server — it is produced by `src/services/api.js` when `fetch()` throws a `TypeError` (e.g., connection refused). The frontend must surface a specific message: _"Cannot connect to the backend — is the server running?"_

---

## Endpoints

### `GET /api/health`

Health check. Returns 200 when the server is running.

**Response 200**:
```json
{ "status": "ok" }
```

---

### `GET /api/applications`

Returns all active (non-archived) application records, ordered by `createdAt` descending.

**Response 200**:
```json
{
  "data": [
    {
      "id": 1,
      "companyName": "Acme Corp",
      "jobTitle": "Software Engineer",
      "status": "applied",
      "compat": 72,
      "fav": false,
      "sourcePlatform": "LinkedIn",
      "applicationDate": "2026-04-20",
      "jobPostingUrl": "https://example.com/jobs/123",
      "recruiter": "Jane Smith",
      "notes": "Referred by a friend",
      "salary": "$120k–$140k",
      "responsibilities": "Build and maintain core product features",
      "skills": ["JavaScript", "Node.js", "SQLite"],
      "followUpAction": "Send thank-you email",
      "followUpDate": "2026-04-27",
      "lastStatusUpdate": "2026-04-20",
      "createdAt": "2026-04-20T10:00:00.000Z",
      "updatedAt": "2026-04-20T10:00:00.000Z",
      "archived": false,
      "metadata": null
    }
  ]
}
```

---

### `GET /api/applications/:id`

Returns a single application by `id` (integer).

**Response 200**: same shape as a single item in the list above.

**Response 404**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Application not found"
  }
}
```

---

### `POST /api/applications`

Creates a new application record.

**Request body**:
```json
{
  "companyName": "Acme Corp",
  "jobTitle": "Software Engineer",
  "status": "wishlisted",
  "compat": 72,
  "fav": false,
  "sourcePlatform": "LinkedIn",
  "applicationDate": "2026-04-20",
  "jobPostingUrl": "https://example.com/jobs/123",
  "recruiter": "Jane Smith",
  "notes": "Referred by a friend",
  "salary": "$120k–$140k",
  "responsibilities": "Build and maintain core product features",
  "skills": ["JavaScript", "Node.js"],
  "followUpAction": "Send thank-you email",
  "followUpDate": "2026-04-27",
  "metadata": null
}
```

- `companyName`, `jobTitle`, `status` are **required**.
- All other fields are optional; omitting them leaves them as their defaults.
- `id`, `createdAt`, `updatedAt`, `lastStatusUpdate`, `archived` must NOT be sent — they are server-managed and will be ignored if present.

**Response 201**:
```json
{ "data": { ...full application record } }
```

**Response 400**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "companyName": "Required",
      "status": "Must be one of: wishlisted, applied, phone_screen, interview, assessment, offer, rejected, withdrawn, ghosted"
    }
  }
}
```

---

### `PATCH /api/applications/:id`

Partially updates an existing application. Only fields present in the request body are updated. Unspecified fields retain their current values.

**Request body** (any subset of writable fields):
```json
{
  "status": "interview",
  "fav": true,
  "notes": "Phone screen went well",
  "skills": ["JavaScript", "Node.js", "React"]
}
```

- `id`, `createdAt`, `archived` are stripped silently if sent.
- `updatedAt` is always updated by the server.
- `lastStatusUpdate` is updated by the server only when `status` changes to a different value.

**Response 200**:
```json
{ "data": { ...full updated application record } }
```

**Response 404**: same as GET /:id not-found shape.

**Response 400**: same as POST validation error shape.

---

### `POST /api/applications/:id/archive`

Archives an application (soft delete). Removes it from the active list. No request body required.

**Response 200**:
```json
{ "data": { ...full application record with archived: true } }
```

**Response 404**: same as GET /:id not-found shape.

---

## Validation Rules

| Field | Rule |
|---|---|
| `companyName` | Required; non-empty string |
| `jobTitle` | Required; non-empty string |
| `status` | Required; must be one of the 9 controlled values from `shared/constants.js` |
| `compat` | Optional integer; clamped to 0–100; defaults to 0 |
| `fav` | Optional boolean; defaults to false |
| `jobPostingUrl` | Optional; if provided, must be a valid `http` or `https` URL |
| `applicationDate` | Optional; if provided, must match `YYYY-MM-DD` format |
| `followUpDate` | Optional; if provided, must match `YYYY-MM-DD` format |
| `skills` | Optional; if provided, must be an array of strings |
| `metadata` | Optional; if provided, must be any valid JSON value (object, array, or null) |

All other text fields (`sourcePlatform`, `recruiter`, `notes`, `salary`, `responsibilities`, `followUpAction`) accept any string value without additional format constraints.

---

## ID Handling

The API returns `id` as an **integer** (e.g., `1`, `42`). The frontend stores this in `card.dataset.id`, which the DOM always exposes as a string. All API call sites in `src/services/api.js` accept the id as received from API responses (integer) and serialize it directly into the URL path. Tracker.js and Card.js must coerce `card.dataset.id` back to integer before passing to API functions: `parseInt(card.dataset.id, 10)`.
