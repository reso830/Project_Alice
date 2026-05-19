# Tasks: Portfolio Demo Mode (020)

**Spec**: `specs/020-portfolio-demo-mode/spec.md`
**Plan**: `specs/020-portfolio-demo-mode/plan.md`
**Branch**: `020-portfolio-demo-mode`

---

## Phase Map

| Phase | Theme                                                                 | Blocks         |
|-------|-----------------------------------------------------------------------|----------------|
| 01    | Server-side cleanup — delete the dead `APP_RUNTIME=demo` scaffolding from 019 (FR-016) | — (parallel)   |
| 02    | Client demo data layer — extract SQLite seed data to side-effect-free modules (Task 02.0); `demoSeed`, `demoStore`, CRUD + parity tests | 03, 04         |
| 03    | `authStore` demo state machine — `'demo'` status, `enterDemo`, `exitDemo` | 04, 05, 06, 07 |
| 04    | Service-layer mode switch — `services/api.js` + `services/resumeApi.js` early-return demo branches | 08             |
| 05    | Welcome CTA rewiring + `main.js` routing for the new status + filter-persistence gate + legacy-store skip in demo | 08             |
| 06    | Navbar Exit demo affordance + Demo mode badge                          | 08             |
| 07    | ProfileEdit inline note + Resume Import `VISIBLE_STATUSES` export + regression test | 08             |
| 08    | Regression + integration verification (network discipline, storage audit, post-019 tests) | 09             |
| 09    | Release Prep — version bump, CHANGELOG, README, deployment docs, REPO_MAP | 10             |
| 10    | Browser Smoke Test — walk each user story's Independent Test against the merged state | Merge         |

Phase 01 is independent of all other phases and may run in parallel.
Phases 05, 06, 07 each depend on 03 but are independent of each other and may
run in parallel. Phase 08 is the regression gate before Release Prep.

This feature has user-facing UI; per constitution Amendment 1.3.0 the final two
phases MUST be Release Prep followed by Browser Smoke Test.

---

## Phase 01 — Server-side cleanup (delete dead 019 demo scaffolding)

This phase implements spec **FR-016**. It deletes the `APP_RUNTIME=demo`
routing slot reserved by 019. No new code; no new tests; deletions only,
plus three doc edits. Independent of the client work and can run in
parallel with Phase 02+.

### [X] Task 01.1 — Remove `'demo'` from `VALID_RUNTIMES` and drop `isDemo`

**Target file**: `server/config.js`

**What to do**:
- Change `const VALID_RUNTIMES = ['local', 'hosted', 'demo'];` to
  `const VALID_RUNTIMES = ['local', 'hosted'];`.
- Remove the `isDemo: runtime === 'demo'` line from the frozen config
  return object.
- Leave the `HOSTED_REQUIRED` check, `config.supabase`, and the
  rest of the file unchanged.

**Expected behavior**:
- `APP_RUNTIME=local` and `APP_RUNTIME=hosted` work exactly as today.
- `APP_RUNTIME=demo` is rejected at boot with the existing
  `Invalid APP_RUNTIME: "demo". Valid values: "local", "hosted".`
  error (string updated to match the new set).

**Constraints**:
- No new env vars, no shape changes beyond the removal of `isDemo`.
- Do not touch the hosted env-var checks.

**Validation**: covered by Task 01.4 (`tests/server/config.test.js`).

**Out of scope**: dispatcher changes (Task 01.2), health changes
(Task 01.3).

---

### [X] Task 01.2 — Remove `DemoRepositoryNotImplementedError` + `createDemoStub` + the demo branch in the dispatcher

**Target file**: `server/repositories/index.js`

**What to do**:
- Delete the exported `DemoRepositoryNotImplementedError` class.
- Delete the `createDemoStub(name)` helper function.
- Delete the `if (config.isDemo) { … return { forRequest: () => demo }; }`
  branch inside `createRepositories`.
- Update the top-of-file comment block: drop the sentence that mentions
  demo-mode lazy imports; keep the local + hosted commentary.
- Update the `createRepositories` JSDoc: drop the `demo` bullet from the
  list of runtime modes; keep `local` and `hosted`.

**Expected behavior**: `createRepositories({ runtime: 'hosted' })` returns the
Supabase forRequest factory exactly as today; `createRepositories({ runtime:
'local' })` returns the SQLite bundle exactly as today; no third branch.

**Constraints**:
- Do not change the local or hosted branches.
- Do not introduce a default-return fallthrough — if `config` is somehow
  neither hosted nor local (caught earlier by config validation, but
  belt-and-suspenders), let the local branch run as today (it is the
  fallthrough already).

**Validation**: covered by Task 01.4 (dispatcher + stubs tests).

**Out of scope**: server/health.js changes (Task 01.3).

---

### [X] Task 01.3 — Remove the `config.isDemo` short-circuit in `assertHostedSchema`

**Target file**: `server/health.js`

**What to do**:
- Find the early-return in `assertHostedSchema` that returns immediately
  when `config.isDemo === true`.
- Remove that branch. The function continues to be a no-op for any
  `!config.isHosted` runtime (i.e. `local`), so the local short-circuit
  stays.

**Expected behavior**: `assertHostedSchema({ isHosted: false })` returns
immediately (unchanged); `assertHostedSchema({ isHosted: true, … })` runs
the three PostgREST probes (unchanged). The demo case no longer exists.

**Validation**: covered by Task 01.4 (health test).

---

### [X] Task 01.4 — Update server-side tests to drop demo coverage

**Target files**:
- `tests/server/config.test.js`
- `tests/server/repositories/dispatcher.test.js`
- `tests/server/repositories/stubs.test.js`
- `tests/server/health.test.js`

**What to do**:

In `tests/server/config.test.js`:
- Remove the test "accepts demo mode without requiring any hosted env vars".
- Remove the test "demo mode ignores hosted env vars when they happen to be set".
- Remove the three `isDemo: false` field assertions from the local/hosted/(other)
  config cases.
- Update the "lists all valid runtimes" test: the error string now reads
  `local.*hosted` (no `demo`). Adjust the regex.

In `tests/server/repositories/dispatcher.test.js`:
- Remove the test "demo-mode createRepositories does NOT load Supabase modules".
- Remove the test "demo runtime returns { forRequest } that yields demo stubs".
- Remove the test "demo takes precedence over hosted when both flags are set".
- Remove any remaining `isDemo: false` setup lines that were only there to
  exercise the deleted branch.

In `tests/server/repositories/stubs.test.js`:
- Delete the entire `describe('demo repository stubs', …)` block.
- Remove the `DemoRepositoryNotImplementedError` import.
- Leave the two cold-start invariant tests (`local dispatcher cold-start
  invariants`, `hosted dispatcher cold-start invariants`) untouched.

In `tests/server/health.test.js`:
- Remove the test "does nothing for demo runtime (isDemo true, isHosted false)".

**Expected behavior**: `npm test` passes after the deletions. The
remaining tests still cover local and hosted exhaustively.

**Constraints**:
- Do not weaken the hosted or local assertions.
- Do not introduce any new tests in this phase.

---

### [X] Task 01.5 — Update server docs to drop demo references

**Target files**:
- `docs/deployment.md`
- `docs/REPO_MAP.md`

**What to do**:

In `docs/deployment.md`:
- Remove the `**Demo mode** (`APP_RUNTIME=demo`)` bullet that names
  `DemoRepositoryNotImplementedError`.
- Adjust the surrounding sentence (if it lists three modes) to mention
  only `local` and `hosted`.

In `docs/REPO_MAP.md`:
- Update the `server/repositories/index.js` row: remove the "demo" mode
  mention and the `DemoRepositoryNotImplementedError` reference.
  Replace with something like: "`createRepositories(config)` returns
  uniform `{ forRequest(req) }` across `local` and `hosted` runtimes.
  Hosted lazy-imports the Supabase modules; local never loads
  `@supabase/supabase-js`."
- Update the `src/pages/welcome/demoStub.js` row in advance to reflect
  the post-020 behavior (the entry point for the real demo, not a
  toast stub). If preferred, defer the demoStub row update to Phase 09
  — both placements satisfy the constitution. (Default: update it
  here so Phase 09 only adds rows for genuinely new files.)

**Constraints**:
- Do not change the structure of either doc; only the lines that mention
  demo-runtime scaffolding.
- Do not preemptively add rows for files that don't exist yet
  (`demoSeed.js`, `demoStore.js`); those are added in Phase 09.

**Validation**: visual review during plan review; `grep -rin demo
docs/deployment.md docs/REPO_MAP.md` post-edit reveals no surviving
references to `APP_RUNTIME=demo` or `DemoRepositoryNotImplementedError`.

---

## Phase 02 — Client demo data layer

Foundation for the demo. Pure modules, no DOM, no async.

### [X] Task 02.0 — Extract SQLite seed data to side-effect-free modules

**Target files**:
- `server/seeds/applicationsData.js` (NEW)
- `server/seeds/profileData.js` (NEW)
- `server/db-seed.js` (MODIFIED)
- `server/db-seed-profile.js` (MODIFIED)

**What to do**:

Both `server/db-seed.js` and `server/db-seed-profile.js` currently mix
the seed data with side effects (DB open via `import { db } from './db.js'`,
`initSchema()` at module load, `process.exit(...)` at the bottom of
`db-seed-profile.js`). The demo seed and its parity test need the **data**
but must not trigger the side effects.

1. **Create `server/seeds/applicationsData.js`** — a side-effect-free
   module that exports the `DEMO_RECORDS` array (the same 23 records,
   in the same order, in the same SQLite storage shape: snake_case
   keys, JSON-stringified `skills` and `preferred_skills`, `fav: 0/1`,
   `archived: 0`, `created_at` / `updated_at` columns). No imports of
   `./db.js` or any other server module. Pure constants only.

2. **Create `server/seeds/profileData.js`** — a side-effect-free module
   that exports the `DEMO_PROFILE` constant (frontend shape; the file
   is already in camelCase). No `initSchema()`, no `saveProfile(...)`,
   no `process.exit(...)`. Pure constant only.

3. **Update `server/db-seed.js`** to `import { DEMO_RECORDS } from
   './seeds/applicationsData.js'` and remove the inline definition.
   The `seedApplications()` function and the `if (process.argv[1]
   === ...)` guard remain unchanged.

4. **Update `server/db-seed-profile.js`** to
   `import { DEMO_PROFILE } from './seeds/profileData.js'`. **Wrap
   the side effects** (currently top-level `initSchema()`,
   `saveProfile(...)`, `process.exit(...)`) in an
   `if (import.meta.url === pathToFileURL(process.argv[1]).href)`
   guard so they only fire when the file is run as a CLI script
   (matching the pattern `db-seed.js` already uses). Add the
   `pathToFileURL` import from `node:url` at the top.

**Expected behavior**:
- `npm run seed` and `npm run seed:profile` (or however the operator
  runs these scripts today) continue to populate the local SQLite DB
  byte-for-byte identically.
- `import { DEMO_RECORDS } from 'server/seeds/applicationsData.js'`
  and `import { DEMO_PROFILE } from 'server/seeds/profileData.js'`
  from a test file produces the constants with **no DB open, no
  process.exit, no other side effects**.

**Constraints**:
- Do not change the contents of `DEMO_RECORDS` or `DEMO_PROFILE`.
- Do not change the SQLite storage shape produced by the seed scripts.
- New files MUST have zero imports from `./db.js`, `./db/*`, or any
  module that opens a database connection or calls `process.exit`.

**Validation**:
- Run the seed scripts manually against a local dev DB and confirm
  they still populate identically (one quick `sqlite3 ... 'SELECT
  COUNT(*) FROM applications'` after each run is enough).
- Task 02.3's parity test will now be able to import these modules
  without killing vitest or mutating the dev DB — this is the
  unblocking move for that test.

**Out of scope**: refactoring the demo seed to share the *same shape*
as the new modules (the demo still needs camelCase + array `skills` —
which is exactly the transformation Task 02.1's `shiftDates`/SOURCE_RECORDS
already documents). The new server-side modules retain the SQLite
storage shape because the seed scripts need it that way. A future
refactor to converge the shapes is the "shared/" extraction flagged
in [research.md §13](research.md).

---

### [X] Task 02.1 — Create `src/data/demoSeed.js`

**Target file**: `src/data/demoSeed.js` (NEW)

**What to do**:
Export a single function `buildDemoSeed()` that returns
`{ applications, profile }`, mirroring the SQLite seeds per
[data-model.md §3](data-model.md).

#### Applications — mirror the 23 records from `server/db-seed.js`

The 23 records in `DEMO_RECORDS` (server/db-seed.js) MUST be reproduced
in `demoSeed.js` in the **same order**, translated to the frontend shape:

| SQLite column          | Frontend field        | Transformation                                 |
|------------------------|-----------------------|------------------------------------------------|
| `company_name`         | `companyName`         | rename                                         |
| `job_title`            | `jobTitle`            | rename                                         |
| `status`               | `status`              | unchanged                                      |
| `compat`               | `compat`              | unchanged                                      |
| `fav`                  | `fav`                 | `0/1` → `false/true`                           |
| `salary`               | `salary`              | unchanged                                      |
| `source_platform`      | `sourcePlatform`      | rename                                         |
| `job_posting_url`      | `jobPostingUrl`       | rename                                         |
| `recruiter`            | `recruiter`           | unchanged                                      |
| `notes`                | `notes`               | unchanged                                      |
| `responsibilities`     | `responsibilities`    | unchanged                                      |
| `skills`               | `skills`              | parse JSON string → array                      |
| `application_date`     | `applicationDate`     | rename + shift (see "Dates" below)             |
| `last_status_update`   | `lastStatusUpdate`    | rename + shift (see "Dates" below)             |
| `created_at`           | —                     | drop                                           |
| `updated_at`           | —                     | drop                                           |
| `archived`             | —                     | drop (seed only contains `archived: 0` rows)   |
| `location`             | `location`            | unchanged                                      |
| `shift`                | `shift`               | unchanged                                      |
| `work_setup`           | `workSetup`           | rename                                         |
| `compat_notes`         | `compatNotes`         | rename                                         |
| `general_notes`        | `generalNotes`        | rename                                         |
| `preferred_skills`     | `preferredSkills`     | rename + parse JSON string → array             |

Each record receives a sequential `id` (1 … 23) in `DEMO_RECORDS` order.

**Dates**: at call time, the function computes the most recent
`last_status_update` in the SQLite seed (call it `maxOriginalDate`) and
the current ISO date (`today`), then `offsetMs = today.getTime() -
maxOriginalDate.getTime()`. Every record's `applicationDate` and
`lastStatusUpdate` are shifted by `offsetMs` and re-rendered through
`toISODate(...)`. This preserves the relative spacing between records
(e.g. "5 weeks between application and current status" stays 5 weeks)
while anchoring the most recent record to "today."

#### Profile — mirror `DEMO_PROFILE` from `server/db-seed-profile.js`

Reproduce `DEMO_PROFILE` verbatim:

- Top-level fields: `firstName`, `lastName`, `city`, `email`, `phone`,
  `summary`.
- `experience` array (3 entries: Acme Corp / Bright Labs / Pixel Studio
  with their original dates and `currentWork` flags).
- `education` array (1 entry: B.S. Computer Science, UT Austin, 2018).
- `skills` array (10 entries: JavaScript, TypeScript, React, Node.js,
  Python, PostgreSQL, SQLite, Docker, AWS, Git).
- `languages` array (English / Spanish).
- `certifications` array (AWS / GCP).
- `awards` array (Hackathon / Dean's List).
- `links` array (GitHub / LinkedIn / Portfolio).

Profile biographical dates (`dateStarted`, `dateEnded`, `yearCompleted`,
certification `issuanceDate` / `expiryDate`, award `date`) MUST stay
**static** — they represent the persona's history, not the demo session.

#### Implementation shape

```js
// src/data/demoSeed.js
import { toISODate } from '../utils/date.js';

const SOURCE_RECORDS = [
  // 23 records mirroring server/db-seed.js DEMO_RECORDS, in same order,
  // in frontend shape. Dates here are the ORIGINAL SQLite dates; they
  // are shifted at call time.
  {
    companyName: 'Acme Corp',
    jobTitle: 'Frontend Engineer',
    status: 'applied',
    // ... (full record)
    applicationDate: '2026-04-10',
    lastStatusUpdate: '2026-04-12',
  },
  // ... 22 more records
];

const SOURCE_PROFILE = {
  firstName: 'Alex',
  lastName: 'Rivera',
  // ... (verbatim from server/db-seed-profile.js)
};

function shiftDates(records) {
  const maxOriginal = records.reduce((acc, r) => {
    const t = new Date(r.lastStatusUpdate).getTime();
    return t > acc ? t : acc;
  }, 0);
  const todayMs = new Date(toISODate(new Date())).getTime();
  const offsetMs = todayMs - maxOriginal;

  return records.map((r, i) => ({
    ...r,
    id: i + 1,
    applicationDate: toISODate(new Date(new Date(r.applicationDate).getTime() + offsetMs)),
    lastStatusUpdate: toISODate(new Date(new Date(r.lastStatusUpdate).getTime() + offsetMs)),
  }));
}

export function buildDemoSeed() {
  return {
    applications: shiftDates(structuredClone(SOURCE_RECORDS)),
    profile: structuredClone(SOURCE_PROFILE),
  };
}
```

(Use `structuredClone` or hand-rolled deep clone; both are fine.)

**Expected behavior**: calling `buildDemoSeed()` twice returns
independent deep-copied object graphs; the most recent `lastStatusUpdate`
in the returned `applications` equals today's ISO date.

**Constraints**:
- No imports from `src/data/store.js` (the legacy local store).
- No imports from `server/...` — the file lives in `server/` and would
  drag `better-sqlite3` into the client bundle.
- Reuse `src/utils/date.js#toISODate` for date formatting.
- Field shapes MUST satisfy `validateApplication` (from
  `src/models/application.js`) and the profile normalize/validate
  functions in `src/models/profile.js`. Run one record through the
  validator during implementation as a quick sanity check.

**Validation**: covered by Task 02.3.

**Out of scope**: extracting the SQLite seed data to a shared module —
deliberate duplication for 020, see
[research.md §13](research.md).

---

### [X] Task 02.2 — Create `src/data/demoStore.js`

**Target file**: `src/data/demoStore.js` (NEW)

**What to do**:
Implement the demo store per [contracts/api.md §1](contracts/api.md):

- Module-level state: `let _applications = [];` and `let _profile = null;`.
  Not exported.
- Exported functions: `loadSeed`, `clear`, `getAll`, `getById`, `create`,
  `update`, `archive`, `getProfile`, `saveProfile`. Signatures and
  return shapes per [contracts/api.md §1](contracts/api.md).
- All reads return deep clones (use `structuredClone` or a small
  hand-rolled clone — `JSON.parse(JSON.stringify(x))` is acceptable for
  this shape since values are JSON-serializable).
- `create` assigns `nextId = max(existing ids) + 1` (or `1` if the
  list is empty), runs the input through `normalizeApplication` then
  `validateApplication` from `src/models/application.js`, prepends to
  `_applications`, returns a clone.
- `update` finds by id; if not found, throws
  `{ code: 'NOT_FOUND', message: 'Application not found' }` matching the
  shape `src/services/api.js` throws today. Merges fields, sets
  `lastStatusUpdate = toISODate()` when `fields.status` differs from the
  existing row's status, normalizes, validates.
- `archive` removes the row and returns the pre-removal copy; throws
  `NOT_FOUND` if the id doesn't exist.
- `saveProfile` runs the input through the profile normalize/validate
  pair (whatever pattern `src/models/profile.js` exposes), replaces
  `_profile`, returns a clone.

**Expected behavior**: see [data-model.md §4](data-model.md) and
[contracts/api.md §1](contracts/api.md).

**Constraints**:
- MUST NOT call `localStorage.setItem`, `sessionStorage.setItem`, or
  `indexedDB.open`. (Verified by Task 02.3.)
- MUST NOT import `src/services/api.js` or `src/services/resumeApi.js`.
- Validation logic is reused from `src/models/application.js` and
  `src/models/profile.js` — no demo-specific rules.

**Validation**: Task 02.3.

---

### [X] Task 02.3 — Add tests for `demoStore`

**Target file**: `tests/data/demoStore.test.js` (NEW)

**What to do**:

Cover (Vitest, jsdom environment):

1. `loadSeed()` populates `_applications` with **exactly 23** records
   and `_profile` with the seeded profile; calling it twice does not
   duplicate (count stays at 23).
2. **Parity with SQLite seed**: import `DEMO_RECORDS` from
   `server/seeds/applicationsData.js` and `DEMO_PROFILE` from
   `server/seeds/profileData.js` (the side-effect-free modules
   introduced by Task 02.0 — importing from the legacy `db-seed.js` /
   `db-seed-profile.js` would open the SQLite DB and, in the case of
   `db-seed-profile.js`, run `saveProfile` and `process.exit`).
   `_applications` and `_profile` are module-private (Task 02.2) and
   not exported, so the parity assertions go through the public
   readers (`getAll()` and `getProfile()`):
   - `const apps = demoStore.getAll(); expect(apps.length).toBe(DEMO_RECORDS.length);`
     (both are 23).
   - For each index `i`: `apps[i].companyName === DEMO_RECORDS[i].company_name`
     and `apps[i].jobTitle === DEMO_RECORDS[i].job_title` and
     `apps[i].status === DEMO_RECORDS[i].status`. (Catches reordering
     or missing rows.)
   - `expect(demoStore.getProfile()).toEqual(DEMO_PROFILE)` (since
     `DEMO_PROFILE` is already in frontend shape, no transform needed
     for comparison).
   - The most recent `lastStatusUpdate` across `getAll()` equals
     today's ISO date (proves the date-shift logic ran).
3. `getAll()` returns deep clones — mutating the result does not affect
   the next `getAll()` result.
4. `create({...validFields})` returns the created row with an assigned
   id one higher than the max seeded id; the new row is at the head of
   the list.
5. `create({...invalidFields})` throws the standard
   `{ code, message, fields? }` shape.
6. `update(id, { status: 'interview' })` updates the row, returns the
   updated clone, and sets `lastStatusUpdate` to today's ISO date when
   the status actually changes.
7. `archive(id)` removes the row; `getAll()` no longer contains it.
8. `archive(unknownId)` throws `NOT_FOUND`.
9. `getProfile()` returns a deep clone of the seeded profile;
   `saveProfile({...})` replaces it.
10. **Storage discipline**: spy on `globalThis.localStorage.setItem`,
    `globalThis.sessionStorage.setItem`, and (if available)
    `globalThis.indexedDB.open`. After running every CRUD operation in
    one test, assert all three spies have zero calls.
11. `clear()` resets both lists to their initial state.

**Constraints**:
- No real DOM; jsdom only for storage spies.
- Stub `Date.now()` if needed for deterministic dates on the status-
  change test.

---

## Phase 03 — `authStore` demo state machine

### [X] Task 03.1 — Extend `authStore` with `'demo'` status + transitions

**Target file**: `src/data/authStore.js`

**What to do**:

Per [contracts/api.md §2](contracts/api.md):

- Add `export const DEMO_STATUS = 'demo';` near the top.
- Add `export function enterDemo()` that:
  1. Imports `loadSeed` from `src/data/demoStore.js` and calls it.
  2. Sets internal state to
     `{ status: 'demo', user: null, accessToken: null }`.
  3. Calls `notify()`.
- Add `export function exitDemo()` that:
  1. Calls `demoStore.clear()`.
  2. Sets internal state to
     `{ status: 'unauthenticated', user: null, accessToken: null }`.
  3. Calls `notify()`.
- Leave `init()`, `signOut()`, `applySession()`, `subscribe()`, and
  `getAccessToken()` unchanged. (Note: `init()` deliberately has no demo
  restore path — refresh always ends the demo per spec FR-005.)

**Constraints**:
- Static import of `demoStore` is fine; demoStore has no problematic
  transitive dependencies. (No lazy-import discipline applies here.)
- Do not introduce a fourth state for "exiting demo" — the transition is
  synchronous.

**Validation**: Task 03.2.

---

### [X] Task 03.2 — Add tests for `authStore` demo transitions

**Target file**: `tests/data/authStore.demo.test.js` (NEW)

**What to do**:

Cover:

1. `enterDemo()` transitions a fresh `unauthenticated` state to
   `{ status: 'demo', user: null, accessToken: null }` and notifies
   subscribers exactly once.
2. `enterDemo()` calls `demoStore.loadSeed()` (spy / mock).
3. `exitDemo()` transitions from `demo` to
   `{ status: 'unauthenticated', user: null, accessToken: null }` and
   calls `demoStore.clear()`.
4. `init()` with `isHostedAuthAvailable = false` returns `local-mode`
   regardless of any prior demo state (proves no demo restore path).
5. `init()` in hosted mode with no Supabase session returns
   `unauthenticated`, not `demo`.
6. `getAccessToken()` returns `null` while status is `demo`.

**Constraints**:
- Mock `src/services/supabaseClient.js` (already done in existing
  authStore tests — reuse the same pattern).
- Mock `src/data/demoStore.js` so the test does not exercise the real
  store.

---

## Phase 04 — Service-layer mode switch

### [X] Task 04.1 — Add demo branch to every export in `src/services/api.js`

**Target file**: `src/services/api.js`

**What to do**:

Per [contracts/api.md §3](contracts/api.md):

- Import `DEMO_STATUS, getAuthState` from `../data/authStore.js` and
  `import * as demoStore from '../data/demoStore.js'`.
- Add a top-level helper `function isDemo() { return getAuthState().status === DEMO_STATUS; }`.
- Wrap each exported function with the demo early-return:
  - `getAll()` → `if (isDemo()) return Promise.resolve(demoStore.getAll());`
  - `getById(id)` → `if (isDemo()) return Promise.resolve(demoStore.getById(id));`
  - `create(fields)` → demo branch wraps the synchronous demoStore call
    in a Promise (resolve or reject on throw — see the contract).
  - `update(id, fields, opts?)` → same pattern. The `opts.signal` is
    ignored in demo (no async work to abort).
  - `archive(id)` → same.
  - `getProfile()` → returns a Promise of the demo profile.
  - `saveProfile(profile)` → same.
- Leave the `request()` helper unchanged.

**Constraints**:
- MUST NOT call `globalThis.fetch` when `isDemo()` returns true. The
  Phase 04.3 test asserts this.
- Demo errors thrown from `demoStore` MUST surface to callers in the
  same `{ code, message, fields? }` shape the network branch already
  throws.

**Validation**: Task 04.3.

---

### [X] Task 04.2 — Add demo throw to `src/services/resumeApi.js`

**Target file**: `src/services/resumeApi.js`

**What to do**:

- Import `DEMO_STATUS, getAuthState` from `../data/authStore.js`.
- At the top of `parseResume(file)`, add:
  ```js
  if (getAuthState().status === DEMO_STATUS) {
    throw {
      code: 'DEMO_FEATURE_UNAVAILABLE',
      message: 'Resume import is available after signing in.',
    };
  }
  ```
- Leave the rest of the function unchanged.

**Constraints**:
- MUST NOT call `globalThis.fetch` when status is `demo`.

**Validation**: Task 04.3.

---

### [X] Task 04.3 — Add network-discipline tests for the service-layer switch

**Target files**:
- `tests/services/api.demo.test.js` (NEW)
- `tests/services/resumeApi.demo.test.js` (NEW)

**What to do**:

In `api.demo.test.js`:

1. Mock `src/data/authStore.js` so `getAuthState()` returns
   `{ status: 'demo' }`.
2. Mock `src/data/demoStore.js` so each method returns a sentinel.
3. Spy on `globalThis.fetch`.
4. For each exported function (`getAll`, `getById`, `create`, `update`,
   `archive`, `getProfile`, `saveProfile`), assert:
   - It returns the demoStore sentinel (after resolving the Promise).
   - `globalThis.fetch` is **never** called across all of them combined.

In `resumeApi.demo.test.js`:

1. Mock authStore to `'demo'` status.
2. Spy on `globalThis.fetch`.
3. Assert `parseResume(new File([], 'r.pdf'))` rejects with
   `{ code: 'DEMO_FEATURE_UNAVAILABLE', message: ... }` and that
   `fetch` is not called.

**Constraints**:
- The fetch spy assertion is the canonical "no network in demo"
  regression guard. Do not weaken it (e.g. checking only some methods).
- Do not test the network branches here; existing `api.test.js` tests
  cover those.

---

## Phase 05 — Welcome CTA + main routing

### [X] Task 05.1 — Rewrite `src/pages/welcome/demoStub.js`

**Target file**: `src/pages/welcome/demoStub.js`

**What to do**:

Per [contracts/api.md §8](contracts/api.md):

- Remove the `showDemoComingSoon()` export and the `Toast` import.
- Add `import { enterDemo as authEnterDemo } from '../../data/authStore.js';`.
- Export `function enterDemo() { authEnterDemo(); }`. The wrapper exists
  so tests can stub at this boundary independently of `authStore`.
- Update the top-of-file comment to describe the new role (entry point
  for the portfolio demo CTA).

**Constraints**:
- Do not also call `demoStore.loadSeed()` here — that runs inside
  `authStore.enterDemo()`. Single source of truth.

**Validation**: Task 05.5.

---

### [X] Task 05.2 — Update `AuthOverlay.js` import + welcome page CTA wiring

**Target files**:
- `src/pages/welcome/AuthOverlay.js`
- `src/pages/welcome/WelcomePage.js`

**What to do**:

In `AuthOverlay.js`:
- Change `import { showDemoComingSoon } from './demoStub.js';` to
  `import { enterDemo } from './demoStub.js';`.
- Change the `onDemo: () => showDemoComingSoon()` line in
  `buildFooter` to `onDemo: () => enterDemo()`.
- Adjust the file's header comment to drop the "wired by …
  `showDemoComingSoon`" sentence; replace with "wired to
  `demoStub.enterDemo` (feature 020 entry)".

In `WelcomePage.js`:
- Change `import { showDemoComingSoon } from './demoStub.js';` to
  `import { enterDemo } from './demoStub.js';`.
- Inside `renderCtaGroup`, change the Try-the-demo button's onClick
  from `() => { showDemoComingSoon(); }` to `() => { enterDemo(); }`.
- Adjust the surrounding `// Phase 14 / 17` comment to point at
  feature 020 instead of describing the placeholder.

**Constraints**:
- Do not change the visual treatment of the CTA or the modal demo
  button.
- Do not move the CTA placement.

**Validation**: Task 05.5 plus the manual smoke test in Phase 10.

---

### [X] Task 05.3 — Route `'demo'` status to the app shell in `src/main.js`

**Target file**: `src/main.js`

**What to do**:

- In `render(state)`, change the condition that mounts the app shell
  from `state.status === 'local-mode' || state.status === 'authenticated'`
  to also include `state.status === 'demo'`.
- Inside `mountAppShell`, **skip the entire legacy `store` warm-up
  block when in demo**. Today the function calls
  `store.hasStoredApplications()`, `store.load()`, and conditionally
  `store.save(SEED_DATA)`. The legacy store is deprecated
  (`src/data/store.js` header explicitly says so) and is not the data
  source for demo (demo uses `demoStore` via the service-layer switch).
  Wrap the three calls:
  ```js
  if (authStore.getAuthState().status !== 'demo') {
    const hasStoredApplications = store.hasStoredApplications();
    store.load();
    if (!hasStoredApplications && store.getAll().length === 0) {
      store.save(SEED_DATA);
    }
  }
  ```
  `authStore` is already imported at the top of `main.js` per the
  existing `import * as authStore` line. This ensures (a) no reads
  from `localStorage` for the legacy `apptracker_applications` key
  during a demo session, and (b) no writes to it.

**Constraints**:
- Do not introduce additional behavior into `mountAppShell` for demo —
  the shell renders identically regardless of which of the three "shell"
  statuses brought it up.
- Do not change `mountWelcome` or `mountConfigError`.

**Validation**: Task 05.5 plus manual smoke (Phase 10).

---

### [X] Task 05.4 — Gate `apptracker_filters` localStorage write on non-demo status

**Target file**: `src/pages/Tracker.js`

**What to do**:

The tracker currently writes the filter state to `localStorage` via
`persistFilterState(filterState)` ([Tracker.js](../../src/pages/Tracker.js)).
Gate that write on the visitor not being in demo so a demo session
makes **zero** writes to `localStorage` under any project key.

- Add `import * as authStore from '../data/authStore.js';` at the top
  if not already imported.
- Inside `persistFilterState`, early-return when
  `authStore.getAuthState().status === 'demo'`:
  ```js
  function persistFilterState(filterState) {
    if (authStore.getAuthState().status === 'demo') {
      return;
    }
    try {
      window.localStorage?.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
    } catch {
      // localStorage can be unavailable in private or restricted browser contexts.
    }
  }
  ```
- Also early-return `loadPersistedFilterState` in demo so a prior
  authenticated session's filter prefs don't leak into the demo's
  initial filter state. Default filter state is the cleaner starting
  point for the demo anyway:
  ```js
  function loadPersistedFilterState() {
    if (authStore.getAuthState().status === 'demo') {
      return { ...DEFAULT_FILTER_STATE };
    }
    // ... existing implementation
  }
  ```

**Expected behavior**:
- Authenticated and local-mode behavior unchanged — filter prefs still
  persist and reload exactly as today.
- In demo, `localStorage` receives no writes for `apptracker_filters`
  and the initial filter state is the default (no leak from a prior
  signed-in session in the same browser). Task 08.2's storage audit
  confirms zero writes.

**Constraints**:
- Do not change the filter UI or default filter state behavior.
- Do not introduce a new storage key.

**Validation**:
- Manual via Task 08.2 storage audit (asserting zero `localStorage`
  setItem calls during the demo).
- Optional unit test: with `authStore` stubbed to `'demo'`, simulate
  a filter change and assert `localStorage.setItem` is not called.

---

### [X] Task 05.5 — Update `demoStub.test.js`; cover the welcome CTA path

**Target files**:
- `tests/pages/welcome/demoStub.test.js` (UPDATED — existing file)
- Optional: `tests/pages/welcome/AuthOverlay.test.js` if it currently
  asserts `showDemoComingSoon` is called.

**What to do**:

In `demoStub.test.js`:
- Remove the existing `showDemoComingSoon` toast assertion (or rename
  the test).
- Add a test: `enterDemo()` calls `authStore.enterDemo()` (spied).
- Mock `authStore` and assert one call to `enterDemo()` per CTA click.

In `AuthOverlay.test.js`:
- If a test currently expects the demo button to trigger
  `showDemoComingSoon`, update it to expect `demoStub.enterDemo` (or
  more directly, to call `authStore.enterDemo`).

**Constraints**:
- Do not duplicate the demoStore tests here; the seed loading is
  asserted at the authStore boundary in Task 03.2.

---

## Phase 06 — Navbar Exit demo affordance

### [X] Task 06.1 — Render Exit demo button + Demo mode badge in `Navbar.js`

**Target file**: `src/components/Navbar.js`

**What to do**:

Per [contracts/api.md §7](contracts/api.md):

In `renderIdentityCluster(state)`:

1. Add a branch above the existing `'authenticated'` block:
   ```js
   if (state?.status === 'demo') {
     _identityCluster.hidden = false;

     const badge = document.createElement('span');
     badge.className = 'topbar-demo-badge';
     badge.textContent = 'Demo mode';
     badge.setAttribute('aria-label', 'Demo mode active');

     const exit = document.createElement('button');
     exit.type = 'button';
     exit.className = 'signout-btn';
     exit.setAttribute('aria-label', 'Exit demo');

     const label = document.createElement('span');
     label.className = 'signout-btn__label';
     label.textContent = 'Exit demo';
     exit.append(createDoorArrowIcon(), label);

     exit.addEventListener('click', () => {
       authStore.exitDemo();
       Toast.show('Exited demo', 'success');
     });

     _identityCluster.append(badge, exit);
     return;
   }
   ```
2. Leave the `'authenticated'` and default (`hidden = true`) branches
   unchanged.

Add CSS for `.topbar-demo-badge` in `src/styles/main.css`:
- Inline-block, small padding, subtle background distinct from the
  primary topbar tone, readable contrast ratio for AA.
- Final visual treatment is implementer's choice; the rule is that the
  badge MUST be visually distinguishable from the regular topbar text
  on both light and dark themes.

**Constraints**:
- Reuse `createDoorArrowIcon()` so the Exit demo button visually
  matches the Sign-out button.
- Do not use color alone to convey the demo state (constitution: §IV).
  The textual "Demo mode" label satisfies this.

**Validation**: Task 06.2.

---

### [X] Task 06.2 — Test Navbar demo state

**Target file**: `tests/components/Navbar.demo.test.js` (NEW)

**What to do**:

1. With `authStore` stubbed to `{ status: 'demo' }`, render the Navbar
   and assert:
   - The identity cluster is visible.
   - A `.topbar-demo-badge` element is present with text "Demo mode".
   - An "Exit demo" button is present with `aria-label="Exit demo"`.
   - No email span is rendered.
2. Click the Exit demo button; assert `authStore.exitDemo` is called
   exactly once.
3. With `authStore` stubbed to `{ status: 'authenticated', user: …}`,
   confirm the demo badge is NOT present (regression guard).
4. With `authStore` stubbed to `{ status: 'unauthenticated' }`, confirm
   the identity cluster is hidden (existing behavior).

---

## Phase 07 — ProfileEdit inline note + ResumeImport regression

### [X] Task 07.1 — Add the demo inline note in `ProfileEdit.js`

**Target file**: `src/pages/ProfileEdit.js`

**What to do**:

In the layout slot where `ResumeImport` currently mounts:

1. Add a new import at the top of the file:
   `import * as authStore from '../data/authStore.js';`
   (Verified absent from the current file — must be added, not reused.)
2. Inside the mount function, read `authStore.getAuthState().status`
   once at mount time. A subscription is **not** required: the `'demo'`
   flag is set once before this page mounts (via `enterDemo()` →
   `main.js#render` → `mountAppShell` → navigate to ProfileEdit) and
   does not toggle while the page is live — toggling it would tear
   down and re-mount the entire shell.
3. Branch:
   ```js
   if (authState.status === 'demo') {
     slot.append(renderResumeImportDemoNote());
   } else {
     ResumeImport.mount(slot, …); // existing call
   }
   ```
3. Implement `function renderResumeImportDemoNote()` returning a small
   DOM node:
   ```js
   const note = document.createElement('p');
   note.className = 'profile-edit__resume-demo-note';
   note.setAttribute('role', 'note');
   note.textContent = 'Resume import is available after signing in.';
   return note;
   ```

Add the matching CSS class in `src/styles/main.css` (single rule;
muted text colour, small inline padding, accessible contrast).

**Constraints**:
- Do not modify `src/components/ResumeImport.js` — its existing
  `VISIBLE_STATUSES` exclusion already hides the upload UI in demo.
- The note text MUST be a single short sentence. Decided wording:
  "Resume import is available after signing in." (plan-review
  default; revise in plan-review checklist if a different sentence
  is preferred).

**Validation**: Task 07.2.

---

### [X] Task 07.2 — Test ProfileEdit demo behavior + ResumeImport visibility

**Target files**:
- `tests/pages/ProfileEdit.demo.test.js` (NEW)
- `tests/components/ResumeImport.demo.test.js` (NEW)

**What to do**:

In `ProfileEdit.demo.test.js`:
1. Mount `ProfileEdit` with `authStore` stubbed to
   `{ status: 'demo' }`.
2. Assert the slot contains an element with class
   `profile-edit__resume-demo-note` and the expected text.
3. Assert `ResumeImport.mount` (spied or mocked) is **not** called.

In `ResumeImport.demo.test.js`:
1. Mount `ResumeImport` directly with `authStore` stubbed to
   `{ status: 'demo' }`.
2. Assert the component renders nothing (or renders an empty
   container; match the component's existing hidden-state output).
3. **Mandatory design-by-contract guard**: `src/components/ResumeImport.js`
   MUST export `VISIBLE_STATUSES` (a small modification to the existing
   file — promote the current internal const to an export). The test
   MUST import `VISIBLE_STATUSES` and `DEMO_STATUS` and assert
   `expect(VISIBLE_STATUSES.has(DEMO_STATUS)).toBe(false)`. This makes
   the demo's resume-import isolation a **design contract** rather than
   an incidental side effect of the existing set's membership — a
   future maintainer who adds `'demo'` to the set fails the test
   immediately.

---

## Phase 08 — Regression + integration verification

### [X] Task 08.1 — Run the full automated test suite **and** lint

**What to do**: run **both** quality-gate commands and confirm each
exits clean.

1. **`npm test`** — confirm:
   - All new tests added in Phases 01–07 pass.
   - All pre-existing tests pass without modification — except the
     four server test files updated in Task 01.4 and the two seed
     scripts modified in Task 02.0. No silent skips.
   - No new warnings about deprecated APIs introduced by the demo
     paths.
2. **`npm run lint`** — confirm zero lint errors and no new warnings
   beyond what already exists on `main` (a small allowlist of
   pre-existing warnings is acceptable; new warnings introduced by
   020 are not). Constitution §V mandates that lint/format checks
   run before completion when those commands exist; `package.json`
   defines `npm run lint`, so this is required. (No format command
   exists, so no format check is required.)

**Validation**: green run on both. If either fails, do not proceed to
Phase 09; fix the failure root-cause first.

**Result** (2026-05-19):
- `npm run test:run` — **72 files / 856 tests passing**. No new warnings.
  (First-run vitest worker-pool startup flake hit on the initial invocation;
  immediate re-run was instantly clean. Same flake observed at the start of
  Phases 03 and 05 — not a regression.)
- `npm run lint` — **clean**. No errors, no new warnings.

---

### [X] Task 08.2 — Manual browser-storage audit

**Target context**: run the dev server (`npm run dev`) or hit a preview
deploy. Use a fresh private window.

**What to do**:

1. Click **Try the demo** on the welcome page.
2. Open DevTools → Application → Storage. Note the current `localStorage`,
   `sessionStorage`, IndexedDB, and Cookies state.
3. Inside the demo: create an application, edit an application, archive
   one, change a status, save the profile, **change a tracker filter
   and a sort order** (to exercise the gated `persistFilterState`
   path).
4. Re-inspect Storage. Confirm:
   - **Zero new or modified `localStorage` keys under any project
     namespace.** Specifically, `apptracker_filters` MUST NOT have
     been written during the demo session (Task 05.4 gates that
     write on `status !== 'demo'`). Any pre-existing
     `apptracker_filters` value from a prior authenticated session
     in the same browser remains unchanged.
   - `sessionStorage` is empty for this app.
   - IndexedDB is empty for this app.
   - No new cookies set under the project's domain.

**Validation**: visual confirmation. Record observations in the
Phase 10 smoke test artefact.

**Result** (2026-05-19): **Pass.** No storage used during the demo session.
Quick filters working as expected; changing an application's state in the
tracker is reflected in the donut chart on the profile page; profile edits
can be made and saved within the session but are lost on refresh
(refresh-as-reset, per spec FR-005).

---

### [X] Task 08.3 — Manual network-discipline spot check

**What to do**:

1. With DevTools → Network open and filtered to `fetch` + `xhr`, enter
   the demo from a fresh window.
2. Perform every demo write available (create, edit, status change,
   archive, profile save).
3. Confirm zero requests to `/api/applications`, `/api/applications/*`,
   `/api/profile`, `/api/resume/parse`, or any Supabase host.
4. Navigate to ProfileEdit. Confirm no `/api/resume/parse` request is
   triggered (the upload is hidden + the inline note replaces it).
5. Click **Exit demo**. Confirm the welcome page renders and no network
   call is fired by the exit transition.

**Validation**: visual confirmation in DevTools Network panel.

**Result** (2026-05-19): **Pass.** No Supabase calls and no API requests
observed during demo writes (create, edit, status change, archive, profile
save) or on Exit demo.

---

## Phase 09 — Release Prep

Required by constitution Amendment 1.3.0 — second-to-last phase.

### [X] Task 09.1 — Version bump

**Target files**:
- `package.json` — bump `"version"` from `0.9.0` to `0.10.0` (MINOR
  bump per SemVer: feature addition, no breaking changes from a user's
  perspective; the `APP_RUNTIME=demo` removal is a behavior-change for
  operators and is documented but is not a public-API break).
- `src/pages/welcome/shared/appMeta.js` — bump `APP_VERSION` from
  `'v0.9.0'` to `'v0.10.0'` to match.
- `package-lock.json` — regenerate via `npm install --package-lock-only`
  or accept the natural update from `npm install` during testing.

**Constraints**: do not bump to 0.10.0 if a different version is
already on `main` ahead of this branch (rebase + re-decide).

**Validation**: `npm test` still passes; the about-/footer-displayed
version in the welcome footer reads `v0.10.0`.

---

### [X] Task 09.2 — `CHANGELOG.md` entry

**Target file**: `CHANGELOG.md`

**What to do**: add an entry following the existing style. Summary:

- **Added**: portfolio demo mode — public visitors can click "Try the
  demo" on the welcome page to explore the tracker and profile with
  seeded sample data; demo state is in-memory only and resets on
  browser refresh; resume import is unavailable in demo with an
  inline sign-in note.
- **Changed**: server-side runtime config now accepts only `local`
  and `hosted` (the reserved `demo` slot from 019 is removed; setting
  `APP_RUNTIME=demo` now fails at boot).
- **Internal**: new `src/data/demoStore.js` + `src/data/demoSeed.js`;
  `authStore` gains `enterDemo` / `exitDemo`; `services/api.js` and
  `services/resumeApi.js` route to `demoStore` when in demo.

**Constraints**: keep the entry concise; mirror the format of the 019
entry.

---

### [X] Task 09.3 — `README.md` updates

**Target file**: `README.md`

**What to do**: add (or extend) a short section describing the demo
surface:

- One paragraph: portfolio visitors can preview the tracker via the
  "Try the demo" CTA on the welcome page; changes are not saved.
- A note (if appropriate to the README's audience) that demo is
  always-on in hosted deployments and requires no configuration.

**Constraints**: keep additions short (≤ 6 lines).

---

### [X] Task 09.4 — `docs/deployment.md` updates

**Target file**: `docs/deployment.md`

**What to do**:

Beyond the cleanup done in Task 01.5:

- If the document enumerates valid `APP_RUNTIME` values anywhere
  besides the demo bullet (e.g. a setup table), update those to list
  only `local` and `hosted`.
- Add a one-line note under the hosted-mode section that the welcome
  page's demo CTA is enabled by default and requires no configuration.

**Constraints**: do not document a kill-switch for the demo (none
exists per plan).

---

### [X] Task 09.5 — `docs/REPO_MAP.md` updates

**Target file**: `docs/REPO_MAP.md`

**What to do**:

- Add rows for the new files:
  - `src/data/demoStore.js` — "In-memory demo data adapter; CRUD over
    seeded applications + profile; no persistence."
  - `src/data/demoSeed.js` — "Demo seed fixture; `buildDemoSeed()`
    returns fresh applications + profile with relative dates."
- Update the `src/pages/welcome/demoStub.js` row (if not already done in
  Task 01.5) to reflect the post-020 behavior.
- Update the `src/data/authStore.js` row to mention the new
  `enterDemo` / `exitDemo` exports if the row is granular enough to
  warrant it; otherwise leave.
- Add brief mentions of `src/components/Navbar.js`'s demo branch and
  `src/pages/ProfileEdit.js`'s inline note if those files have rows.

**Constraints**: alphabetical / sectional ordering consistent with the
existing file.

---

### [X] Task 09.6 — Docs sanity check

**What to do**: read [spec.md](spec.md), [plan.md](plan.md), the four
supporting artefacts, and the updated README / deployment / REPO_MAP.
Confirm no remaining "feature 020 will…" forward-references; everything
is in past/present tense for the merged state.

**Validation**: visual review.

---

## Phase 10 — Browser Smoke Test

Required by constitution Amendment 1.1.0. Walk each user story's
Independent Test from [spec.md](spec.md) in a real browser against the
to-be-merged state (e.g. a preview deploy).

### [X] Task 10.1 — US1: Visitor opts into demo from the welcome page

Open the deploy in a fresh private window. Click **Try the demo**.
Verify the welcome page unmounts and the Tracker mounts with **23
seeded applications** matching the SQLite seed (same companies and
roles, dates shifted so the most recent record reads as "today").
Navigate to Profile and verify the seeded persona (Alex Rivera, Austin
TX, with experience / education / skills / certifications / awards /
links populated) renders. Verify no sign-in or sign-up is presented as
a condition of entry.

**Pass criterion**: SC-001.

---

### [X] Task 10.2 — US2: Visitor interacts and changes feel real

Inside the demo: create an application (fill all required fields),
edit a card, change a status, archive one, edit and save the profile.
Verify each operation reflects immediately on the tracker / profile.

**Pass criterion**: SC-002.

---

### [X] Task 10.3 — US3: Demo never persists

DevTools Network panel open. Repeat write actions. Confirm zero
requests to `/api/applications`, `/api/profile`, `/api/resume/parse`,
or any Supabase host. DevTools Application → Storage: confirm no new
demo data in `localStorage`, `sessionStorage`, IndexedDB, or cookies.

**Pass criterion**: SC-003, SC-010.

---

### [X] Task 10.4 — US4: Refresh resets

Inside demo with edits, press Ctrl+R / Cmd+R. Verify the welcome page
renders fresh. Re-enter the demo; verify the seed is back to the
starting state.

**Pass criterion**: SC-004.

---

### [X] Task 10.5 — US5: Resume Import unavailable in demo

Inside demo, navigate to Profile → Edit profile. Verify the upload
widget is absent and the inline "Resume import is available after
signing in." note appears. Confirm no `/api/resume/parse` request is
attempted. Exit demo, sign in as a real hosted user, navigate to
ProfileEdit, verify the full Resume Import flow is restored.

**Pass criterion**: SC-006.

---

### [X] Task 10.6 — US6: Authenticated user is unaffected

In a separate browser, sign in as a real hosted user (post-019 setup).
Note their applications and profile. In a private window in the first
browser, enter the demo and perform several writes. Return to the
second browser; refresh the tracker and reload the profile. Verify
the authenticated user's data is byte-equivalent to the pre-demo
state.

**Pass criterion**: SC-007, SC-008.

---

### [X] Task 10.7 — Verify `APP_RUNTIME=demo` is rejected at boot

(Server-side cleanup verification — quick, no UI.)

In a local terminal, run the server with `APP_RUNTIME=demo`:

```bash
APP_RUNTIME=demo npm run server:start
```

Verify the process exits with the standard config error naming the
two valid values (`local`, `hosted`). Reverify `APP_RUNTIME=hosted`
(with the required env vars) and `APP_RUNTIME=local` still boot
normally.

**Pass criterion**: FR-016 fully enforced at boot.

---

### Task 10.8 — Record smoke test outcomes

Append the smoke-test results to the PR description (one bullet per
task above). Note any deviation from expected behavior. If any
smoke-test step fails, do **not** merge — return to the
corresponding implementation phase and fix the root cause.

---

## Done criteria

A feature is ready to merge when:

- Phase 01 + 02 + 03 + 04 + 05 + 06 + 07 + 08 all complete with green
  `npm test` **and** green `npm run lint` (Task 08.1; constitution §V).
- Phase 09 has bumped the version, written CHANGELOG, and updated docs.
- Phase 10 has all eight tasks marked pass.
- The plan-review checklist has every P0 item ticked.
