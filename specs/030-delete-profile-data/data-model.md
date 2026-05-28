# Data Model: Delete Profile & User Data (030)

**Branch**: `030-delete-profile-data` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

This feature introduces **no schema change** — no new tables, columns, indexes, or RLS policies. It exercises the cascade relationships established by [019](../019-supabase-persistence/data-model.md). This document records the data graph the deletion relies on and the per-mode removal scope, so the implementer can confirm coverage without re-reading 019.

---

## 1. Hosted: deletion via cascade

All user-owned tables reference the Supabase auth user with `ON DELETE CASCADE`:

```text
auth.users (id)
   ▲   ▲   ▲
   │   │   └──── public.user_seed_state.user_id   (PK, ON DELETE CASCADE)
   │   └──────── public.profile.user_id           (UNIQUE, ON DELETE CASCADE)
   └──────────── public.applications.user_id      (FK + index, ON DELETE CASCADE)
```

Deleting the `auth.users` row (via `auth.admin.deleteUser(userId)`) cascades to:

| Table | Rows removed | What that covers |
|---|---|---|
| `public.applications` | all rows where `user_id = <deleted>` | every application, including the `timeline` JSON column (025 Timeline) — Calendar (026) is a pure projection of these rows, so it clears implicitly (spec D4) |
| `public.profile` | the single row where `user_id = <deleted>` | the user's profile / resume-derived data (007/019) |
| `public.user_seed_state` | the marker row where `user_id = <deleted>` | the 019 seed marker — its removal is why a stale-token re-seed attempt later fails the FK constraint (research.md R-3/R-4) |

**No other persistent user data exists.** Resume parsing writes nothing server-side (in-memory `multer` — spec D3). There is no separate calendar, timeline, analytics, or preferences table.

**Atomicity**: the cascade is a single database operation triggered by the auth-user delete — partial deletion is not possible (FR-008, FR-023).

---

## 2. Local (SQLite): clear scope

Local mode is single-user with no `user_id` ownership column and no `auth.users` (019 §4). "Clear all data" removes:

| Table | Operation |
|---|---|
| `applications` | `DELETE FROM applications` |
| `profile` | `DELETE FROM profile` |

Run inside **one transaction** so the clear is all-or-nothing. After clearing, the Tracker and Profile render their existing empty states; no re-seed (spec D2).

---

## 3. Demo (in-memory): no operation

Demo data lives in module-level variables in [`src/data/demoStore.js`](../../src/data/demoStore.js) and is never persisted. The Account control is disabled in demo, so no clear/delete operation runs. (`demoStore.clear()` already exists and is used by `exitDemo()`, but this feature does not invoke it from the Account section.)

---

## 4. Entities introduced by this feature

None at the persistence layer. The only new "entities" are transient client/runtime concepts, already enumerated in [spec.md § Key Entities](spec.md):

- **Account section** — a Profile-page UI section (no persistence).
- **Confirmation modal** — collects the gate (hosted: password; local: typed `DELETE`) (no persistence).
- **`account` repository concern** — a server-side adapter exposing a uniform `delete(body)` method (hosted reads `body.password`; local reads `body.confirm` and clears all data), not a stored entity.

---

## 5. Migration

**None.** No SQL is shipped. The cascade FKs already exist from 019; this feature depends on them but does not alter them. If a deployment predates 019's cascade FKs, deletion would orphan rows — but 019 is a hard dependency of the hosted runtime, so the FKs are guaranteed present (assumption recorded in [spec.md § Assumptions](spec.md)).
