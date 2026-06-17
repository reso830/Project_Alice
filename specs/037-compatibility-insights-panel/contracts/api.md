# API Contract: Compatibility Insights Panel

One new endpoint. All existing endpoints are unchanged except for column additions to the application response shape.

---

## New endpoint

### `POST /api/applications/:id/compat-notes`

Persists AI-generated compatibility notes for an application.

The LLM call is made **client-side** (consistent with the 035 JD parser pattern). This endpoint receives the generated text, validates it, adds `generatedAt`, and saves to `compat_analysis`.

**Auth**: Same `requireAuth` middleware as all other application routes (hosted mode). Local mode: no auth.

**Route params**

| Param | Type | Description |
|---|---|---|
| `id` | integer | Application ID |

**Request body**

```json
{
  "summary": "Strong React match, gaps in infra",
  "body": "Your React and TypeScript proficiency aligns well with the core requirements..."
}
```

| Field | Type | Constraints |
|---|---|---|
| `summary` | string | Required. 1–34 characters. |
| `body` | string | Required. Non-empty. |

**Success response — `200 OK`**

```json
{
  "data": {
    "summary": "Strong React match, gaps in infra",
    "body": "Your React and TypeScript proficiency aligns well with the core requirements...",
    "generatedAt": "2026-06-17T10:34:56.789Z"
  }
}
```

`generatedAt` is set server-side to `new Date().toISOString()` — the client value is ignored.

**Error responses**

| Status | Code | Condition |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `summary` missing, empty, or > 34 chars; `body` missing or empty |
| `404` | `NOT_FOUND` | Application with `id` does not exist (or does not belong to the authenticated user in hosted mode) |

**Error body shape** (same as all routes):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "summary": "Must be 1–34 characters"
    }
  }
}
```

---

## Changed: application response shape

The following fields are **added** to every application response (all existing endpoints: `GET /api/applications`, `GET /api/applications/:id`, `POST /api/applications`, `PATCH /api/applications/:id`):

| Field | Type | Notes |
|---|---|---|
| `compatAnalysis` | `object \| null` | `{ summary, body, generatedAt }` or `null` |
| `compatScoredAt` | `string \| null` | ISO timestamp of last score computation |

The following field is **removed** from all write surfaces (still returned on reads as `null` after migration):

| Field | Change |
|---|---|
| `compatNotes` | Removed from `createSchema` and `updateSchema`; POST/PATCH will ignore it if sent |

---

## Client-side `api.js` additions

```js
// Persist client-generated notes on the server
export function saveCompatNotes(id, { summary, body }) {
  return request('POST', `/api/applications/${id}/compat-notes`, { summary, body });
}
```

Demo path: calls `demoStore.saveCompatNotes(id, { summary, body })` directly (no fetch).

---

## Notes generation flow (client-side)

The following is NOT an HTTP endpoint — it is the client-side LLM call made before calling `saveCompatNotes`:

```
compatNotesService.generateNotes(application, profile, aiSettings)
  → llmClient.requestChatCompletion({
      key: aiSettings.getKey(),
      model: aiSettings.getModel(),
      systemPrompt: buildCompatSystemPrompt(),
      userContent: buildCompatUserContent(application, profile),
    })
  → { summary: string, body: string }
  → api.saveCompatNotes(id, { summary, body })
  → { data: CompatNotes }
```

Errors from `llmClient.requestChatCompletion` are mapped via `mapErrorToReason` (from `llmClient.js`) and surfaced as the `error` notes state in the UI.
