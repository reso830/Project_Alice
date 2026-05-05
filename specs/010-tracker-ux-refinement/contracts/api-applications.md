# API Contract: Applications

**Feature**: Application Tracker UX & Data Refinement Pack  
**Branch**: `010-tracker-ux-refinement` | **Date**: 2026-04-30

Only endpoints that change or gain new behavior for this feature are documented here.

---

## PATCH /api/applications/:id

Updates one or more fields on an existing application record. Used by: favorite toggle, archive action, status change from overlay quick actions, salary update.

### Request body (all fields optional)

```json
{
  "fav": true,
  "archived": true,
  "status": "offer",
  "salary": 150000
}
```

| Field | Type | Constraints |
|---|---|---|
| `fav` | boolean | `true` or `false`; server forces to `false` when `archived: true` is also sent |
| `archived` | boolean | `true` or `false` |
| `status` | string | Must be a valid STATUS_VALUES key |
| `salary` | integer \| null | Positive integer or `null` |

### Response 200 — updated record

```json
{
  "id": "abc123",
  "company_name": "Acme Corp",
  "job_title": "Frontend Engineer",
  "status": "offer",
  "fav": true,
  "archived": false,
  "salary": 150000,
  "last_status_update": "2026-04-30T00:00:00.000Z"
}
```

### Response 400 — validation failure

```json
{ "error": "Invalid status value: 'foo'" }
{ "error": "Salary must be a positive integer or null" }
```

### Response 404 — not found

```json
{ "error": "Application not found" }
```

---

## GET /api/applications

Returns all application records. **Existing behavior unchanged** except for the salary field type.

### Salary field change

| Before (legacy) | After |
|---|---|
| `"salary": "$120,000 – $140,000"` | `"salary": 120000` |
| `"salary": null` | `"salary": null` |

Consumers (`Card.js`, `Modal.js`) must call `formatPeso(salary)` from `src/utils/currency.js` for display. Do not render the raw integer directly.

---

## Field normalization (server-side, on read)

| Field | Legacy value | Normalized to |
|---|---|---|
| `fav` | `null`, `undefined`, `0`, `1` | `false` or `true` (boolean coercion) |
| `archived` | absent / `null` | `false` |
| `salary` | string (legacy) | integer via `parseSalaryLower()`, or `null` on parse failure |

These normalizations guard against stale records and must be applied in the server's data-access layer before returning records to the client.
