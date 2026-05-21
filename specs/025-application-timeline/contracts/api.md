# API Contract: Application Timeline (025)

**Branch**: `025-application-timeline`
**Spec**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

This feature is a pure additive change to the existing applications
API. No new endpoints. No new error codes. No new auth.

---

## 1. Affected endpoints

| Method | Path | Change |
|---|---|---|
| `POST` | `/api/applications` | Body MAY include `timeline: TimelineEntry[]`. Default `[]`. |
| `GET` | `/api/applications` | Response items include `timeline: TimelineEntry[]`. |
| `GET` | `/api/applications/:id` | Response includes `timeline: TimelineEntry[]`. |
| `PATCH` | `/api/applications/:id` | Body MAY include `timeline: TimelineEntry[]`. Replaces the array atomically with the rest of the patch. |
| `POST` | `/api/applications/:id/archive` | Unchanged. |

Auth model: unchanged. Hosted mode requires `requireAuth`; local mode
does not. Demo mode bypasses the network entirely (see
[src/data/demoStore.js](../../../src/data/demoStore.js)).

---

## 2. `TimelineEntry` schema

```ts
TimelineEntry = {
  id:     number,   // positive integer, unique within the array
  date:   string,   // ISO YYYY-MM-DD; past, today, future all valid
  status: string,   // member of STATUS_VALUES
  text:   string    // free-form; may be ""
}
```

Validation lives in [server/validation/application.js](../../../server/validation/application.js)
and is shared by `createSchema` and `updateSchema`.

---

## 3. Request examples

### 3.1 Create an application with seeded timeline

```http
POST /api/applications
Authorization: Bearer <jwt>            ← hosted only
Content-Type: application/json

{
  "companyName": "Acme Corp",
  "jobTitle": "Frontend Engineer",
  "status": "applied",
  "responsibilities": "Build the design system.",
  "applicationDate": "2026-05-21",
  "timeline": [
    { "id": 1, "date": "2026-05-21", "status": "applied",
      "text": "Submitted via referral." }
  ]
}
```

Response `201 Created`:

```json
{
  "data": {
    "id": 17,
    "companyName": "Acme Corp",
    "jobTitle": "Frontend Engineer",
    "status": "applied",
    "lastStatusUpdate": "2026-05-21",
    "responsibilities": "Build the design system.",
    "applicationDate": "2026-05-21",
    "timeline": [
      { "id": 1, "date": "2026-05-21", "status": "applied",
        "text": "Submitted via referral." }
    ],
    "...other fields...": "..."
  }
}
```

### 3.2 Add an entry via PATCH (replace-array semantics)

```http
PATCH /api/applications/17
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "timeline": [
    { "id": 1, "date": "2026-05-21", "status": "applied",
      "text": "Submitted via referral." },
    { "id": 2, "date": "2026-05-23", "status": "phone_screen",
      "text": "Recruiter call scheduled." }
  ]
}
```

The client always sends the full timeline array. There is no
per-entry PATCH endpoint.

### 3.3 Status change with auto-appended timeline entry

The client packages the status change and the auto-entry into one
PATCH:

```http
PATCH /api/applications/17
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "status": "interview",
  "timeline": [
    { "id": 1, "date": "2026-05-21", "status": "applied",  "text": "..." },
    { "id": 2, "date": "2026-05-23", "status": "phone_screen", "text": "..." },
    { "id": 3, "date": "2026-05-24", "status": "interview",     "text": "" }
  ]
}
```

Server-side semantics (unchanged from 015 / 019):

1. Status guard runs: terminal-state check + `isValidTransition()` from
   `shared/constants.js`. Rejection returns `400 VALIDATION_ERROR` with
   `fields.status`.
2. Repository `update()` writes both `status` and `timeline` in one
   statement. The SQLite path also bumps `last_status_update`. The
   Supabase path bumps `last_status_update` after fetching the previous
   status. Atomic per backend.

### 3.4 Future-dated entry

```http
PATCH /api/applications/17
Content-Type: application/json

{
  "timeline": [
    { "id": 4, "date": "2026-06-30", "status": "phone_screen",
      "text": "Recruiter callback." }
  ]
}
```

Accepted — no future-date restriction at the API.

---

## 4. Response shape

`GET /api/applications/:id` and `GET /api/applications`:

```json
{
  "data": {
    "...existing fields...",
    "timeline": [
      { "id": <number>, "date": "<YYYY-MM-DD>",
        "status": "<status>", "text": "<string>" }
    ]
  }
}
```

For records persisted before the feature shipped (and therefore stored
with `timeline = '[]'`), the response payload's `timeline` is the
synthesized default produced by `normalizeApplication`. See
[../data-model.md §5](../data-model.md). The server normalizes
on read so clients see a non-empty array whenever
`applicationDate` or `lastStatusUpdate` is set.

---

## 5. Error responses

No new error codes. Existing envelope is reused:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "timeline": "Required",
      "<other>": "..."
    }
  }
}
```

| Trigger | Status | `code` | `fields.timeline` |
|---|---|---|---|
| `timeline` is not an array | `400` | `VALIDATION_ERROR` | `"Expected array"` (Zod default) |
| Entry missing `id` | `400` | `VALIDATION_ERROR` | `"Required"` |
| Entry `date` not YYYY-MM-DD | `400` | `VALIDATION_ERROR` | `"Timeline entry date must use YYYY-MM-DD format"` |
| Entry `status` not in `STATUS_VALUES` | `400` | `VALIDATION_ERROR` | `"Timeline entry status must be one of: ..."` |
| Status guard rejection (e.g., terminal → other) | `400` | `VALIDATION_ERROR` | `fields.status` only — `timeline` is not touched |
| Unauthenticated hosted request | `401` | `UNAUTHENTICATED` | unchanged |
| Forbidden cross-user access | `404` | `NOT_FOUND` | unchanged (RLS scopes to user) |

---

## 6. Idempotency

PATCH semantics are unchanged — last write wins. The client always sends
the full `timeline` array, so a retried PATCH is idempotent in the same
way it was for `skills` / `preferredSkills` arrays today.

---

## 7. Demo mode

[src/data/demoStore.js](../../../src/data/demoStore.js)'s `update()`
already spreads `fields` over the existing record, so `timeline` rides
through without code changes. Validation is the same client-side
`validateApplication` already used. No network call.

---

## 8. Pagination

Out of scope. `timeline` is a per-row inline array. The collection
endpoint (`GET /api/applications`) is not paginated today, and this
feature does not add pagination.

---

## 9. Backwards compatibility

| Caller | Behavior |
|---|---|
| Pre-025 client against post-025 server | Ignores the new `timeline` field; sends payloads without it; server defaults to `[]`. Works. |
| Post-025 client against pre-025 server | Sends `timeline` in PATCH; pre-025 Zod schema strips unknown fields (`.strip()`), so `timeline` is silently dropped. UI surface is broken because the field never round-trips. Acceptable only during a deploy window; recommend pinning frontend/backend versions together. |
