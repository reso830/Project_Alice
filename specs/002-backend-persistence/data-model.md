# Data Model: Local Persistence & Backend Support

**Branch**: `002-backend-persistence` | **Phase**: 1 — Design  
**Last updated**: 2026-04-26 (architect review — added missing UI fields, resolved field name alignment)

---

## Table: `applications`

All application records are stored in a single SQLite table. Column names use snake_case (SQL convention). The API layer maps to/from camelCase for JSON responses.

### Schema

```sql
CREATE TABLE IF NOT EXISTS applications (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name        TEXT    NOT NULL,
  job_title           TEXT    NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'wishlisted',
  compat              INTEGER NOT NULL DEFAULT 0,
  fav                 INTEGER NOT NULL DEFAULT 0,
  source_platform     TEXT,
  application_date    TEXT,
  job_posting_url     TEXT,
  recruiter           TEXT,
  notes               TEXT,
  salary              TEXT,
  responsibilities    TEXT,
  skills              TEXT,
  follow_up_action    TEXT,
  follow_up_date      TEXT,
  last_status_update  TEXT    NOT NULL,
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL,
  archived            INTEGER NOT NULL DEFAULT 0,
  metadata            TEXT
);
```

---

### Field Reference

| Column | JS Field (API) | Type | Required | Notes |
|---|---|---|---|---|
| `id` | `id` | INTEGER | system | Auto-increment primary key; returned as integer; never client-supplied |
| `company_name` | `companyName` | TEXT | ✅ | Must be non-empty string |
| `job_title` | `jobTitle` | TEXT | ✅ | Must be non-empty string |
| `status` | `status` | TEXT | ✅ | Must be one of the 9 controlled status values |
| `compat` | `compat` | INTEGER | — | Compatibility score 0–100; defaults to 0; validated and clamped on write |
| `fav` | `fav` | INTEGER (bool) | — | Starred/favourite flag; defaults to false; stored as 0/1 |
| `source_platform` | `sourcePlatform` | TEXT | — | Free text; where user found the posting |
| `application_date` | `applicationDate` | TEXT | — | ISO 8601 date (YYYY-MM-DD) when provided |
| `job_posting_url` | `jobPostingUrl` | TEXT | — | Must be valid http/https URL when provided |
| `recruiter` | `recruiter` | TEXT | — | Free text recruiter name or contact |
| `notes` | `notes` | TEXT | — | Free text general notes |
| `salary` | `salary` | TEXT | — | Free text salary range or value |
| `responsibilities` | `responsibilities` | TEXT | — | Free text job responsibilities description |
| `skills` | `skills` | TEXT (JSON array) | — | Array of skill strings; stored as JSON; returned as string array |
| `follow_up_action` | `followUpAction` | TEXT | — | Free text next action |
| `follow_up_date` | `followUpDate` | TEXT | — | ISO 8601 date (YYYY-MM-DD) when provided |
| `last_status_update` | `lastStatusUpdate` | TEXT | system | ISO 8601 date; set on create, updated on status change only |
| `created_at` | `createdAt` | TEXT | system | ISO 8601 datetime; set once on create; immutable |
| `updated_at` | `updatedAt` | TEXT | system | ISO 8601 datetime; updated on every write |
| `archived` | `archived` | INTEGER (bool) | system | 0 = active, 1 = archived; default 0 |
| `metadata` | `metadata` | TEXT (JSON) | — | Unstructured JSON value (object, array, or null); reserved for future AI/parsed data |

---

### Controlled Status Values

Defined in `shared/constants.js` — the single source of truth imported by both the backend validation layer and the frontend model layer.

```
wishlisted | applied | phone_screen | interview | assessment | offer | rejected | withdrawn | ghosted
```

---

### System Field Behavior

| Field | Set on create | Set on update | Set on archive | Client-editable |
|---|---|---|---|---|
| `id` | Auto (DB) | Never | Never | No |
| `created_at` | Yes (server) | Never | Never | No |
| `updated_at` | Yes (server) | Yes (server) | Yes (server) | No |
| `last_status_update` | Yes (server) | Only if `status` changes | Never | No |
| `archived` | Default 0 | Never via PATCH | Set to 1 | No |

---

### Special Field Handling in `toRecord()`

The repository's `toRecord(row)` function applies these transformations when mapping a database row to a JSON-ready object:

| Field | Storage | JSON output | Transformation |
|---|---|---|---|
| `fav` | INTEGER 0/1 | boolean | `Boolean(row.fav)` |
| `archived` | INTEGER 0/1 | boolean | `Boolean(row.archived)` |
| `compat` | INTEGER | number | Returned as-is (already a number) |
| `skills` | TEXT (JSON string) | string[] or [] | `JSON.parse(row.skills ?? '[]')` |
| `metadata` | TEXT (JSON string) | any JSON value or null | `row.metadata ? JSON.parse(row.metadata) : null` |

The `toRow(fields)` function applies the reverse when writing:

| JSON field | Storage transformation |
|---|---|
| `fav` | `fields.fav ? 1 : 0` |
| `compat` | `Math.max(0, Math.min(100, Number(fields.compat) \|\| 0))` |
| `skills` | `JSON.stringify(Array.isArray(fields.skills) ? fields.skills : [])` |
| `metadata` | `fields.metadata != null ? JSON.stringify(fields.metadata) : null` |

---

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_applications_status   ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_archived ON applications(archived);
CREATE INDEX IF NOT EXISTS idx_applications_created  ON applications(created_at);
```

---

### Field Mapping: SQL → JSON (full)

| SQL column | JSON key |
|---|---|
| `id` | `id` (integer) |
| `company_name` | `companyName` |
| `job_title` | `jobTitle` |
| `status` | `status` |
| `compat` | `compat` (number) |
| `fav` | `fav` (boolean) |
| `source_platform` | `sourcePlatform` |
| `application_date` | `applicationDate` |
| `job_posting_url` | `jobPostingUrl` |
| `recruiter` | `recruiter` |
| `notes` | `notes` |
| `salary` | `salary` |
| `responsibilities` | `responsibilities` |
| `skills` | `skills` (string[]) |
| `follow_up_action` | `followUpAction` |
| `follow_up_date` | `followUpDate` |
| `last_status_update` | `lastStatusUpdate` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |
| `archived` | `archived` (boolean) |
| `metadata` | `metadata` (any JSON or null) |

---

### Frontend Field Name Migration

The existing frontend (`src/`) uses different field names inherited from the localStorage schema. The following renames apply when the frontend is updated to consume the API:

| Old frontend field | New API field | Component(s) affected |
|---|---|---|
| `position` | `jobTitle` | Card.js, Modal.js |
| `company` | `companyName` | Card.js, Modal.js |
| `url` | `jobPostingUrl` | Tracker.js (copy action), Modal.js |
| `last_status_update` | `lastStatusUpdate` | Card.js, Modal.js |
| `id` (string `"001"`) | `id` (integer `1`) | Card.js, Tracker.js, Modal.js |

Fields that keep the same name: `status`, `fav`, `compat`, `salary`, `recruiter`, `notes`, `responsibilities`, `skills`, `sourcePlatform`, `applicationDate`, `followUpAction`, `followUpDate`.

**ID handling**: The API returns `id` as an integer. The frontend stores it in `card.dataset.id` (which the DOM always exposes as a string). All API call sites must coerce back to integer: `parseInt(card.dataset.id, 10)`.
