# API Contracts: Application Workflow State Machine (015)

No new routes. One existing endpoint gains new error cases.

---

## PATCH /api/applications/:id

### Existing behavior (unchanged)

```
PATCH /api/applications/42
Content-Type: application/json

{ "status": "phone_screen" }

→ 200 { "data": { ...updatedApplication } }
→ 400 { "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "fields": { ... } } }
→ 404 { "error": { "code": "NOT_FOUND", "message": "Application not found" } }
```

### New error cases (state machine gate)

**Terminal state — cannot change status of a completed application:**

```
PATCH /api/applications/42
{ "status": "applied" }
// application 42 is currently "rejected" (terminal)

→ 400
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "status": "Cannot change status of a completed application"
    }
  }
}
```

**Invalid transition — status not reachable from current state:**

```
PATCH /api/applications/42
{ "status": "wishlisted" }
// application 42 is currently "applied"

→ 400
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "status": "Invalid transition from applied to wishlisted"
    }
  }
}
```

### Evaluation order

1. Zod schema validation (`STATUS_VALUES` membership check) — existing, returns 400
2. Fetch current record — if not found, returns 404
3. Terminal state check — new, returns 400
4. Valid transition check — new, returns 400
5. `update()` call → 200

### POST /api/applications (creation)

Unchanged. Any status in `STATUS_VALUES` is accepted at creation time.
`accepted` is now in `STATUS_VALUES` and is therefore a valid creation status.

---

## No other route changes

`POST /:id/archive`, `GET /`, `GET /:id` are unaffected.
