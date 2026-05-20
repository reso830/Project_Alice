# Data Model — Portfolio Demo Mode (020)

The demo introduces **no server-side schema and no persistent storage**.
This document describes the in-memory shapes the demo operates on, all of
which mirror the existing post-019 client data shapes so the page layer
remains unaware that it is running against a demo.

---

## 1. `authStore` state machine

`src/data/authStore.js` exports a single state object. The finite set of
`status` values today is `'initializing' | 'local-mode' | 'authenticated'
| 'unauthenticated'`. Feature 020 adds **one new value**:

| Status              | Pre-020 | Post-020 | Meaning                                                  |
|---------------------|:-------:|:--------:|----------------------------------------------------------|
| `initializing`      |   ✓     |    ✓     | Boot in progress, no decision yet                        |
| `local-mode`        |   ✓     |    ✓     | Local SQLite dev, no Supabase auth                       |
| `authenticated`    |   ✓     |    ✓     | Hosted, signed in with a valid Supabase session          |
| `unauthenticated`   |   ✓     |    ✓     | Hosted, no session — welcome page is shown               |
| `demo`              |         |    ✓     | Hosted, no session — visitor opted into the portfolio demo |

### Transitions added by 020

```
                ┌──────────────────────────┐
                │       unauthenticated     │
                └─────────────┬─────────────┘
                              │  enterDemo()
                              ▼
                ┌──────────────────────────┐
                │           demo            │
                └─────────────┬─────────────┘
                              │  exitDemo() | signOut()
                              ▼
                ┌──────────────────────────┐
                │       unauthenticated     │
                └──────────────────────────┘

                refresh / bundle reload:
                    `demo` is unreachable from `init()` (no persistence)
                    → init() chooses `unauthenticated` | `authenticated`
                      based on Supabase session presence
```

### State object shape in demo

```js
{
  status: 'demo',
  user: null,          // no Supabase user
  accessToken: null,   // no JWT — services/api.js will not attach Authorization
}
```

---

## 2. Demo applications shape (`demoStore._applications`)

Each demo application is the same shape returned by the post-019 hosted
`GET /api/applications` endpoint (i.e. the SQLite-compatible shape; no
`user_id` exposed). See `src/models/application.js` for the authoritative
field list. Required fields per Constitution v1.3.0:

- `id` *(number)* — assigned by `demoStore.create` as `max(existing ids) +
  1`. Seeded ids are stable per build (1, 2, 3, …).
- `companyName` *(string, required)*
- `jobTitle` *(string, required)*
- `status` *(enum: `STATUS_VALUES` from `shared/constants.js`, required)*
- `lastStatusUpdate` *(ISO date string, required — set on create and on
  every status change)*
- `responsibilities` *(string, required)*

Optional fields used by the seed (all already supported by the model and
the existing tracker UI):

- `compat` *(0–100)*
- `fav` *(boolean)*
- `salary` *(number)*
- `recruiter` *(string)*
- `jobPostingUrl` *(URL string)*
- `skills` *(string[])*
- `shift`, `workSetup`, `location` *(controlled enums per
  `src/models/application.js`)*

Validation: every demo `create` / `update` runs the application through
`normalizeApplication()` then `validateApplication()` from
`src/models/application.js`. Errors surface in the same shape as the
network path (`{ code, message, fields }`), so `Modal.js` and
`Tracker.js` handle them unchanged.

---

## 3. Demo seed fixture (`src/data/demoSeed.js`)

`buildDemoSeed()` returns `{ applications, profile }` and is called once
per demo entry via `demoStore.loadSeed()`. Dates on the applications are
computed relative to `Date.now()` at call time so the seed always reads
as current; profile dates (employment / education history) stay static
because they represent the demo persona's biography, not the moment of
seeding.

### Seed applications — 23 records mirrored from the SQLite seed

The demo applications mirror the **same 23 records** present in
`server/db-seed.js` (the `DEMO_RECORDS` export), translated from the
SQLite storage shape to the frontend shape:

| SQLite column          | Frontend field        | Transformation                                 |
|------------------------|-----------------------|------------------------------------------------|
| `company_name`         | `companyName`         | camelCase                                      |
| `job_title`            | `jobTitle`            | camelCase                                      |
| `status`               | `status`              | unchanged                                      |
| `compat`               | `compat`              | unchanged                                      |
| `fav`                  | `fav`                 | `0 \| 1` → `false \| true`                     |
| `salary`               | `salary`              | unchanged                                      |
| `source_platform`      | `sourcePlatform`      | camelCase                                      |
| `job_posting_url`      | `jobPostingUrl`       | camelCase                                      |
| `recruiter`            | `recruiter`           | unchanged                                      |
| `notes`                | `notes`               | unchanged                                      |
| `responsibilities`     | `responsibilities`    | unchanged                                      |
| `skills`               | `skills`              | `JSON.parse(...)` → array                      |
| `application_date`     | `applicationDate`     | camelCase; shifted (see "Dates" below)         |
| `last_status_update`   | `lastStatusUpdate`    | camelCase; shifted (see "Dates" below)         |
| `created_at`           | —                     | dropped (frontend doesn't see it)              |
| `updated_at`           | —                     | dropped                                        |
| `archived`             | —                     | dropped (only `0` rows are seeded; archive is a removal in demo) |
| `location`             | `location`            | unchanged                                      |
| `shift`                | `shift`               | unchanged                                      |
| `work_setup`           | `workSetup`           | camelCase                                      |
| `compat_notes`         | `compatNotes`         | camelCase                                      |
| `general_notes`        | `generalNotes`        | camelCase                                      |
| `preferred_skills`     | `preferredSkills`     | camelCase + `JSON.parse(...)` → array          |

Each record also receives a sequential `id` (1 through 23) assigned in
the same array order as `DEMO_RECORDS`.

### Dates — shift to relative-from-now

The SQLite seed uses hard-coded calendar dates (`2026-03-28`,
`2026-04-12`, etc.) that will drift into the past over time. The demo
fixture preserves the **relative spacing** between records — i.e. the
difference in days between any two SQLite dates — but anchors the most
recent `last_status_update` to "today" (`toISODate(new Date())`).
Older records' dates are computed by subtracting their original offset
from today.

Concretely, `buildDemoSeed()`:
1. Identifies the maximum `last_status_update` across `DEMO_RECORDS`
   (the most recent date in the seed).
2. Computes `offsetMs = today - maxOriginal` once.
3. For each record, sets `lastStatusUpdate = toISODate(originalDate +
   offsetMs)` and similarly for `applicationDate`.

This preserves the "this app is 3 days old / that one is 5 weeks old"
relative texture of the SQLite seed without anchoring the demo to a
specific calendar week.

### Seed profile — mirrors the SQLite profile seed

The profile fixture mirrors `DEMO_PROFILE` from
`server/db-seed-profile.js` **verbatim** (Alex Rivera, Austin TX, full
experience / education / skills / languages / certifications / awards /
links arrays). That seed is already in frontend shape (camelCase keys,
arrays) because it is fed through `saveProfile` directly, so no
transformation is needed.

Profile dates (`dateStarted`, `dateEnded`, `yearCompleted`, certification
`issuanceDate` / `expiryDate`, award `date`) remain **static**: they are
the demo persona's biographical timeline, not metadata about the demo
session.

### Parity guarantee

The demo applications and profile MUST stay in content-parity with the
SQLite seeds. To make this a hard contract rather than a documentation
hope, 020 does a **partial extraction** (Task 02.0): the raw constants
`DEMO_RECORDS` and `DEMO_PROFILE` move out of the side-effect-laden
seed scripts into side-effect-free modules under `server/seeds/`. The
demo fixture (`src/data/demoSeed.js`) still keeps its own
frontend-shape copy of the records — the camelCase + array-skills
transformation lives there — but the parity test (Task 02.3) imports
the `server/seeds/` constants and asserts the demo fixture matches by
index (company / title / status triples), so any drift between the
two surfaces fails the build.

A **full `shared/` source-of-truth refactor** — where one camelCase
constant is consumed by both a transformer in the server seed (to
produce SQLite shape) and by the client demo fixture directly — is
**out of scope for 020** and is documented in
[research.md §13](research.md) as future work to consider if drift
between `server/seeds/applicationsData.js` and `src/data/demoSeed.js`
ever recurs.

Updates to either side of the parity SHOULD land in the same PR.

### Non-PII / fictional content

The SQLite seed already uses fictional companies, recruiters, and the
"alex.rivera@example.com" demo persona. The demo fixture inherits this;
no further sanitization is required.

---

## 4. Demo store internals (`src/data/demoStore.js`)

Module-level state (intentionally not exported, accessed only via the
exported methods):

```js
let _applications = [];   // array of demo applications, in display order
let _profile = null;      // populated by loadSeed; mutated by saveProfile
```

Exported API (mirrors `src/services/api.js` so the service-layer switch
is a simple delegate):

| Function                      | Returns                                  | Notes |
|-------------------------------|------------------------------------------|-------|
| `loadSeed()`                  | `void`                                   | Replaces `_applications` and `_profile` with `buildDemoSeed()`. Idempotent: safe to call again to reset. |
| `clear()`                     | `void`                                   | Sets `_applications = []` and `_profile = null`. Used by `exitDemo()`. |
| `getAll()`                    | `Application[]` (deep clones)            | Defensive copy; mutating the result does not affect the store. |
| `getById(id)`                 | `Application \| undefined`               | Deep clone. |
| `create(fields)`              | `Application` (the created row, cloned)  | Assigns new id, normalizes, validates, prepends. |
| `update(id, fields)`          | `Application` (the updated row, cloned)  | Merges fields, normalizes, validates. Sets `lastStatusUpdate` on `status` change (parity with server adapter behavior). |
| `archive(id)`                 | `Application` (the archived row, cloned) | Removes the row from `_applications`. |
| `getProfile()`                | `Profile \| null` (deep clone)           | |
| `saveProfile(profile)`        | `Profile` (the saved profile, cloned)    | Normalizes, validates, replaces `_profile`. |

### Why deep clones on read

The page layer mutates the data it receives (e.g. `Tracker.js` does
`_applications = [newRecord, ..._applications]`, then sorts and filters
in place over the array). Returning the underlying objects directly
would let UI mutations corrupt the demo store. Deep clones on read
match the network path's behavior (the server returns fresh JSON every
time) and avoid surprises.

### Concurrency

No async work happens inside the demo store. JS is single-threaded, so
the create→prepend→return sequence is atomic. No locking is needed.

---

## 5. Browser-side storage audit

The demo MUST NOT introduce any new browser-side persistence. The
following audits are part of the manual smoke test (quickstart.md §3):

| Storage                    | Before demo session | After several demo writes | Notes                                                       |
|----------------------------|---------------------|----------------------------|-------------------------------------------------------------|
| `localStorage`             | possibly contains `apptracker_filters` (filter prefs) and `apptracker_applications` (legacy local-mode only) | unchanged (no new keys) | `apptracker_filters` is filter prefs, not demo data; OK     |
| `sessionStorage`           | empty for this app  | empty                      | demo MUST NOT write here                                    |
| IndexedDB                  | empty for this app  | empty                      | demo MUST NOT use IDB                                       |
| Cookies                    | only Supabase auth cookies (if any), or none | unchanged | demo doesn't authenticate, so it MUST NOT issue or write any cookie |

If a future feature needs to *opt in* to demo persistence (e.g. carrying
filter prefs through a refresh deliberately), the change is out of scope
for this feature and requires a spec amendment.

---

## 6. Cross-feature data interactions

- **019 Supabase tables**: untouched. The demo never authenticates, so
  RLS on `applications` / `profile` / `user_seed_state` is never
  reached. The 019 first-call seed never runs for a demo visitor (the
  seed runs on a hosted user's first authenticated API call — which
  demo never makes).
- **018 `requireAuth`**: defense in depth. If a future change
  accidentally routes a demo network call through the service layer
  switch, `requireAuth` rejects it with 401. The 401 is observable in
  tests as a clear signal of a regression.
- **017 hosted runtime**: unchanged. The hosted Vercel deploy runs the
  same way; demo just adds a client-side branch that takes the visitor
  off the network path.
