# Contracts: Compatibility Engine

## No new endpoints

Scoring is internal. It reuses the existing `applications` and `profile` routes; no new routes, no changes under `api/` beyond what the existing rewrite already covers. The "contracts" below are the **behavioral changes** to existing endpoints.

---

## `POST /api/applications` (create)

- **Request body**: same as today **minus `compat`**. `compat` is no longer accepted from the client (removed from the write schema); if sent, it is ignored/stripped.
- **New optional field**: `minYearsExperience` — non-negative integer or `null`. Invalid values (negative, non-integer, non-numeric) → `400 VALIDATION_ERROR` with a field message; never coerced.
- **Server behavior**: the route loads the current profile, calls `computeCompatibility(profile, newApplication, { asOf: resolveRequestDate(req) })`, and persists the resulting score into `compat`.
- **Response** (`201`): `{ data: <application> }` where `data.compat` is the **server-computed** score and `data.minYearsExperience` echoes the stored value.

## `PATCH /api/applications/:id` (update)

- **Request body**: partial; `compat` ignored if present. `minYearsExperience` accepted (same validation as create).
- **Server behavior**: after applying the update, `compat` is recomputed from the current profile + the updated JD fields. Status-transition rules are unchanged. **If the application is archived**, editing its own JD recomputes its score; profile-wide recompute does **not** touch it.
- **Response** (`200`): `{ data: <application> }` with the recomputed `compat`.

## `GET /api/applications` and `GET /api/applications/:id`

- Unchanged shape. `data[].compat` is the persisted computed score; `data[].minYearsExperience` is included in the projection.

## `PUT /api/profile` (save)

- **Request body**: unchanged (whole-profile payload; validated by `validateProfile`).
- **Server behavior**: after `upsert`, the server **recomputes `compat` for all active applications** against the new profile and persists changed scores. **Archived applications are excluded** (frozen snapshots, FR-009). Only changed scores are written.
- **Response** (`200`): `{ data: <profile> }` — unchanged. (The client refetches applications, or re-renders from subsequent reads, to see updated scores.)

---

## Pure module contract (`src/models/compatibility.js`)

```js
import { computeCompatibility, getCompatLabel, COMPAT_WEIGHTS, COMPAT_BANDS }
  from '../models/compatibility.js';

const { score, label } = computeCompatibility(profile, application, {
  weights = COMPAT_WEIGHTS,  // optional override
  asOf,                      // optional 'YYYY-MM-DD'; defaults to today (server passes request date)
});
// score: integer 0–100 (clamped); label: 'Low' | 'Medium' | 'High' | 'Great'
```

**Guarantees**:
- **Deterministic** — identical `(profile, application, weights, asOf)` → identical result. No randomness, no network, no LLM.
- **Total** — never throws on sparse/empty inputs; returns a deterministic low score (0 when no category is active).
- **Pure** — no I/O; does not mutate its arguments.

---

## Error → behavior

| Condition | Result |
| --- | --- |
| `minYearsExperience` negative / non-integer / non-numeric | `400 VALIDATION_ERROR` (field message) |
| Client sends `compat` | Silently ignored (server computes) |
| Empty profile and/or empty JD | `200` with a deterministic low `compat` (no error) |
| Profile save with many applications | `200`; active scores recomputed; archived untouched |
