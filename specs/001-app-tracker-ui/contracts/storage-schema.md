# Contract: Storage Schema

**Feature**: `001-app-tracker-ui`  
**Storage mechanism**: Browser `localStorage`  
**Key**: `"apptracker_applications"`  
**Value type**: JSON-serialised `JobApplication[]`

---

## Read Contract

```
store.load() → JobApplication[]
```

Called once at app startup. If the key is absent, returns `[]`. If the value is invalid JSON, returns `[]` and does not throw. Each record is validated on read; invalid fields are coerced or flagged (see data-model.md validation rules).

## Write Contract

```
store.save(applications: JobApplication[]) → void
```

Serialises the full in-memory array to JSON and writes to `localStorage`. Called after every mutation (status change, star toggle). Callers must validate records before calling `save()` — the store does not re-validate on write.

## Mutation Methods (store.js public interface)

| Method | Arguments | Returns | Side Effects |
|--------|-----------|---------|--------------|
| `updateStatus(id, newStatus)` | `string, StatusEnum` | `void` | Updates `status` + `last_status_update` on matching record; calls `save()` |
| `toggleFav(id)` | `string` | `void` | Flips `fav` on matching record; calls `save()` |
| `getAll()` | — | `JobApplication[]` | Returns in-memory array; no storage read |
| `getById(id)` | `string` | `JobApplication \| null` | Lookup from in-memory array |

## Error Conditions

| Condition | Behaviour |
|-----------|-----------|
| `localStorage` unavailable (private mode, storage full) | `save()` fails silently; in-memory state still reflects the change for the current session |
| JSON parse failure on load | Store initialises with `[]`; user sees empty state |
| `id` not found in `updateStatus` / `toggleFav` | No-op; no error thrown |
