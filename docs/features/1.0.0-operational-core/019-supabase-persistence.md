# Feature Brief — 019-supabase-persistence

## Summary
Add Supabase-backed hosted persistence while preserving the existing SQLite-based local workflow.

This feature introduces repository adapters for hosted data storage and runtime-based persistence routing.

Hosted authenticated users should now have persistent cloud-backed data storage.

---

## Goals
- Add hosted persistence using Supabase Postgres.
- Preserve existing SQLite local behavior.
- Keep repository implementations interchangeable.
- Support runtime-based repository selection.
- Seed initial starter data for newly approved hosted users.

---

## Scope

### Supabase Repository Adapters
Implement Supabase-backed persistence adapters for:
- Applications
- Profile

Requirements:
- Repository contracts should remain aligned with existing SQLite behavior where practical.
- Business rules remain in the API layer.
- Persistence adapters should focus on storage responsibilities only.

---

## Runtime-Based Repository Routing
Runtime configuration should determine repository usage.

Expected behavior:
- Local mode → SQLite repositories
- Hosted authenticated mode → Supabase repositories
- Demo mode → session-only data handling

Requirements:
- Repository selection should be centralized.
- Frontend should remain unaware of persistence implementation details.

---

## Hosted Starter Data
Newly approved hosted users should receive seeded starter content.

Starter content may include:
- Sample applications
- Example statuses
- Basic seeded profile information

Goals:
- Make first-time hosted experience feel populated.
- Improve portfolio/demo presentation.
- Avoid empty-state overload for new users.

Requirements:
- Starter data should belong to the signed-in user.
- Seed data should only happen once per account creation flow.

---

## Data Ownership
All hosted persistence must respect:
- authenticated ownership
- API authorization rules
- RLS policies

Requirements:
- Users must never access another user's data.
- Ownership enforcement should remain server-side first.

---

## SQLite Preservation
Existing local SQLite mode remains fully supported.

Requirements:
- Local development workflow should remain usable offline.
- Existing SQLite repositories should not be removed.
- No forced hosted dependency for local development.

---

## Migration Policy
No automated migration from local SQLite to hosted Supabase is included in v1.

Requirements:
- Existing local data remains untouched.
- Hosted users start from seeded/starter data instead.
- Migration tooling is future work.

---

## UX Expectations
Hosted authenticated users should now experience:
- Persistent application tracking
- Persistent profile editing
- Cross-session hosted data retention

Local users should continue experiencing:
- Existing SQLite persistence behavior

---

## Non-Goals
Out of scope:
- SQLite-to-Supabase migration tooling
- Cross-device sync for local mode
- Offline hosted sync
- Multi-user sharing
- Conflict resolution systems

---

## Validation And Testing
Include:
- Repository adapter tests
- Runtime routing tests
- Ownership validation tests
- Hosted persistence CRUD tests
- SQLite regression tests
- Seed-data initialization tests
- Cross-session persistence verification

---

## Acceptance Criteria
- Hosted authenticated users have persistent Supabase-backed data.
- Local SQLite mode still functions correctly.
- Repository routing works by runtime mode.
- Starter data is seeded for new hosted users.
- Ownership protections remain enforced.
- No automated local-data migration is introduced.