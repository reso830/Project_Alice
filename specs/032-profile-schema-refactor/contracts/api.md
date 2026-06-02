# Contracts: Profile Schema Refactor (032)

## 1. Public HTTP API — UNCHANGED

The wire contract is identical to pre-032. This is the whole point of the
feature (transparent refactor, FR-004 / FR-012).

### `GET /api/profile`

- **Response** `200`: `{ "data": <profile> }` where `<profile>` is the full
  profile object with an embedded `skills` array of `{ name, level }`,
  ordered by insertion order. `null` when no profile exists yet.
- Skills are reassembled from the `profile_skill` store; clients cannot tell
  the difference.

### `PUT /api/profile`

- **Request body**: the full profile object, including an embedded `skills`
  array (`[{ name, level }]`) — unchanged.
- **Validation**: `validateProfile(body)` runs first (unchanged). On failure →
  `400 { error: { code: 'VALIDATION_ERROR', message, fields } }` (including
  unrated/blank/duplicate/50-max skill errors from 031).
- **Response** `200`: `{ "data": <profile> }` — the reassembled profile after
  the document + skill rows are written transactionally.

No new endpoints. Per-skill add/edit/delete endpoints are explicitly deferred
to the consuming features (033–037).

## 2. Internal model contract (`src/models/profile.js`)

New pure, exported helpers (centralized business logic, constitution):

```
splitProfileForStorage(profile) -> { document, skills }
  // document: normaliseProfile(profile) with the `skills` key removed
  // skills:   the normalised skills array ([{ name, level }])

joinProfileWithSkills(document, skills) -> profile
  // returns { ...document, skills } — the reassembled read/API shape
```

`normaliseProfile` and `validateProfile` are unchanged and still operate on
the embedded shape.

**Save vs. migration document handling**: a normal `upsert` persists
`splitProfileForStorage(profile).document` (the fully-normalised document —
unchanged save behavior). The read-time **migration** path uses only
`splitProfileForStorage(document).skills` and writes back the stored document
with just the `skills` key removed (non-skill sections verbatim), so migration
never alters fields the user did not edit (FR-008).

## 3. Internal hosted RPC contract (Supabase)

```
save_profile_with_skills(p_data jsonb, p_skills jsonb) RETURNS jsonb
```

- `p_data`: profile document jsonb **without** a `skills` key.
- `p_skills`: jsonb array of `{ "name", "level" }` in payload (Custom) order.
- Atomically upserts the caller's `profile` row and replaces their
  `profile_skill` rows (insert in array order). Returns the stored `data`.
- `SECURITY INVOKER`; `EXECUTE` granted to `authenticated` only. Full
  definition in [data-model.md §3.2](../data-model.md).

## 4. Repository adapter contract — UNCHANGED surface

Both adapters keep the existing `ProfileRepository` shape
([server/repositories/profile.js](../../../server/repositories/profile.js)):

```
get()            -> profile | null      // now reassembles skills from rows
upsert(profile)  -> profile             // now splits skills into rows (txn/RPC)
```

Route handlers and the dispatcher are unaffected.
