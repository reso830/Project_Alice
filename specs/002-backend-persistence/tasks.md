# Tasks: Local Persistence & Backend Support

**Input**: Design documents from `/specs/002-backend-persistence/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api-contract.md ✅  
**Branch**: `002-backend-persistence`  
**Last updated**: 2026-04-26 (architect review applied — 12 issues resolved)

**Tests**: Required by the constitution — this feature touches records, persistence, validation, URLs, and dates.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story this task belongs to (US1–US5); SP = System Property

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, create server skeleton, configure dev environment.

- [X] T001 Create `server/` directory with subdirectories `db/`, `routes/`, `validation/`
- [X] T002 Install runtime dependencies: `express`, `better-sqlite3`, `zod` — add to `package.json` dependencies
- [X] T003 [P] Install dev dependency: `nodemon` — add to `package.json` devDependencies
- [X] T004 Add npm scripts to `package.json`: `server:dev` (`nodemon server/index.js`), `server:start` (`node server/index.js`), `db:init` (`node server/db-init.js`)
- [X] T005 Create `server/index.js` — Express app with `express.json()` middleware, mounts `/api/applications` router from `server/routes/applications.js`, serves `GET /api/health` returning `{ status: "ok" }`, registers global error handler that returns `{ error: { code: "INTERNAL_ERROR", message: "..." } }`, listens on port 3001
- [X] T006 Create `server/routes/applications.js` — empty Express Router, exported; imported and mounted in `server/index.js` at `/api/applications`
- [X] T007 Configure Vite proxy in `vite.config.js` — proxy all `/api` requests to `http://localhost:3001`
- [X] T008 [P] Add `data/` and `data/*.db` to `.gitignore`; create `data/.gitkeep` to track the empty directory
- [X] T009 [P] Create `tests/server/helpers.js` — exports `makeTestDb()` that opens a temp-file SQLite database (using `os.tmpdir()` path), runs schema DDL, and returns `{ db, cleanup }` where `cleanup()` closes and deletes the file; also exports `makeMemoryDb()` (`:memory:`) for tests that do not need restart simulation
- [X] T010 Create `server/db-init.js` — imports and calls an explicit `initSchema()` function from `server/db.js`, logs `"Database initialized successfully"` on success, exits with code 0; exits with code 1 and prints the error on failure

**Checkpoint**: `npm run server:dev` starts without error. `GET /api/health` returns `{ "status": "ok" }`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Single source of truth for status values, database schema, and validation schemas.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T011 Create `shared/constants.js` at the project root — exports `STATUS_VALUES` array with all 9 status strings (`wishlisted`, `applied`, `phone_screen`, `interview`, `assessment`, `offer`, `rejected`, `withdrawn`, `ghosted`); update `src/models/application.js` to import `STATUS_VALUES` from `shared/constants.js` instead of deriving it locally
- [X] T012 Create `server/db.js` — opens `data/alice.db` via `better-sqlite3`; exports `db` instance and `initSchema()` function; `initSchema()` runs the full DDL
- [X] T013 Add `CREATE TABLE IF NOT EXISTS applications` DDL inside `initSchema()` in `server/db.js` with all 21 columns per `data-model.md`: `id`, `company_name`, `job_title`, `status`, `compat`, `fav`, `source_platform`, `application_date`, `job_posting_url`, `recruiter`, `notes`, `salary`, `responsibilities`, `skills`, `follow_up_action`, `follow_up_date`, `last_status_update`, `created_at`, `updated_at`, `archived`, `metadata` — types and constraints as specified
- [X] T014 [P] Add `CREATE INDEX IF NOT EXISTS` statements inside `initSchema()` for `idx_applications_status`, `idx_applications_archived`, `idx_applications_created`
- [X] T015 Verify `npm run db:init` runs without error and creates `data/alice.db`; confirm schema via SQLite CLI or a smoke test
- [X] T016 Create `server/validation/application.js` — imports `STATUS_VALUES` from `shared/constants.js`; defines `toApiError(zodError)` that converts Zod issues to a `fields` object keyed by camelCase field name with human-readable messages
- [X] T017 Add `createSchema` (Zod object) to `server/validation/application.js` — `companyName` (required, min 1), `jobTitle` (required, min 1), `status` (required, enum of `STATUS_VALUES`); `jobPostingUrl` (optional, valid http/https URL when present); `applicationDate` and `followUpDate` (optional, `YYYY-MM-DD` when present); `compat` (optional, integer, clamped 0–100); `fav` (optional boolean); `skills` (optional array of strings); `responsibilities`, `recruiter`, `notes`, `salary`, `sourcePlatform`, `followUpAction` (optional strings); `metadata` (optional, any valid JSON value or null)
- [X] T018 [P] Add `updateSchema` to `server/validation/application.js` — all fields optional, same format rules as `createSchema`; strip `id`, `createdAt`, `updatedAt`, `lastStatusUpdate`, `archived` silently via `.strip()`
- [X] T019 Create `server/db/applications.js` — imports `db` from `server/db.js`; imports `STATUS_VALUES` from `shared/constants.js`; defines `toRecord(row)` helper (camelCase mapping, `Boolean(row.fav)`, `Boolean(row.archived)`, `JSON.parse(row.skills ?? '[]')`, `row.metadata ? JSON.parse(row.metadata) : null`); defines `toRow(fields)` helper (reverse mapping with `fav ? 1 : 0`, `compat` clamped, `JSON.stringify(skills)`, `JSON.stringify(metadata)`). **Note**: `toRow()` must only be called with fields that are actually present in the input — passing absent optional fields will produce `undefined` values (e.g. `JSON.stringify(undefined)`) that `better-sqlite3` rejects as parameter bindings; see T044 for the partial-update usage pattern

**Checkpoint**: Foundation ready — schema initializes cleanly, `shared/constants.js` imported by both frontend model and backend validation, Zod schemas importable. User story phases can now begin.

---

## Phase 3: System Property Verification + US1 — Create (Priority: P1) 🎯 MVP

**Goal**: Implement the create endpoint and the read endpoints needed to verify the persistence system property. After this phase: `POST` a record, restart the server, `GET` the list — the record is still there.

**Independent Test (US1)**: `POST /api/applications` with valid body → 201. Restart server → `GET /api/applications` → record present with all correct field values.

**System Property Test (SP)**: Uses `makeTestDb()` with a temp file — inserts a record, closes the DB connection, reopens it, queries — record still present.

### Tests

- [X] T020 [SP] Create `tests/server/persistence.test.js` — uses `makeTestDb()` (temp file); inserts one record; calls `cleanup()` to close the connection; opens a new `better-sqlite3` connection to the same temp file path; queries the record; asserts all field values match; deletes the temp file
- [X] T021 [P] [US1] Create `tests/server/applications.test.js` — add test: `GET /api/health` returns 200 with `{ status: "ok" }`
- [X] T022 [P] [US1] Add test: `GET /api/applications` returns `{ data: [] }` on a fresh empty database
- [X] T023 [P] [US1] Add test: `POST /api/applications` with valid minimal body (`companyName`, `jobTitle`, `status`) returns 201 with a record containing server-set `id` (integer), `createdAt`, `updatedAt`, `lastStatusUpdate`
- [X] T024 [P] [US1] Add test: `GET /api/applications` after a successful POST returns the created record in the `data` array
- [X] T025 [P] [US1] Add test: `GET /api/applications/:id` with a valid integer id returns `{ data: { ...record } }`
- [X] T026 [P] [US1] Add test: `GET /api/applications/:id` with an unknown id returns 404 with `{ error: { code: "NOT_FOUND" } }`

### Implementation

- [X] T027 [US1] Add `create(fields)` to `server/db/applications.js` — maps input via `toRow()`; sets `created_at`, `updated_at`, `last_status_update` to current ISO date (YYYY-MM-DD); runs `INSERT INTO applications`; returns the inserted row via `getById(info.lastInsertRowid)`
- [X] T028 [P] [US1] Add `getAll()` to `server/db/applications.js` — `SELECT * FROM applications WHERE archived = 0 ORDER BY created_at DESC`; maps each row with `toRecord()`
- [X] T029 [P] [US1] Add `getById(id)` to `server/db/applications.js` — `SELECT * FROM applications WHERE id = ?`; returns `toRecord(row)` or `null` if not found
- [X] T030 [US1] Add `POST /` handler to `server/routes/applications.js` — parse body; validate with `createSchema` (return 400 `{ error: { code: "VALIDATION_ERROR", fields: toApiError(result.error) } }` on failure); call `create()`; return 201 `{ data: record }`
- [X] T031 [P] [US1] Add `GET /` handler to `server/routes/applications.js` — call `getAll()`; return 200 `{ data: [...] }`
- [X] T032 [P] [US1] Add `GET /:id` handler to `server/routes/applications.js` — call `getById(parseInt(req.params.id, 10))`; return 200 `{ data: record }` or 404 `{ error: { code: "NOT_FOUND", message: "Application not found" } }`

**Checkpoint**: Persistence system property verified. MVP backend running. `POST` → restart → `GET` returns the original record.

---

## Phase 4: US1 Refinement — Full Validation & Frontend Create Client (Priority: P1)

**Goal**: Full validation error responses on `POST`, validation unit tests, and the frontend API client function for creating records.

**Independent Test**: `POST` with missing `companyName` returns 400 with `error.fields.companyName`. `POST` with invalid URL returns 400 with `error.fields.jobPostingUrl`. `POST` with `compat: 150` stores it clamped to 100.

### Tests

- [X] T033 [US1] Create `tests/server/validation.test.js` — unit test `createSchema`: valid full payload passes; missing `companyName` fails with field error; missing `jobTitle` fails; invalid `status` fails; `jobPostingUrl` with `"ftp://x"` fails; `applicationDate` with `"2026/04/20"` fails; `compat: 150` is clamped to 100; `skills: "JavaScript"` (not array) fails; `metadata: "string"` (not JSON object/array/null) fails; all optional fields omitted passes
- [X] T034 [P] [US1] Add integration test: `POST /api/applications` with empty body returns 400 `VALIDATION_ERROR` with `fields` containing `companyName`, `jobTitle`, `status`
- [X] T035 [P] [US1] Add integration test: `POST /api/applications` with `jobPostingUrl: "not-a-url"` returns 400 with `fields.jobPostingUrl`

### Implementation

- [X] T036 [US1] Verify `toApiError()` in `server/validation/application.js` produces camelCase field keys matching the API contract (e.g., `companyName` not `company_name`)
- [X] T037 [US1] Create `src/services/api.js` — defines `request(method, path, body)` using `fetch`; on network error (`TypeError`) throws `{ code: "NETWORK_ERROR", message: "Cannot connect to the backend — is the server running?" }`; on non-2xx HTTP response throws `{ code, message, fields }` extracted from the error envelope; exports named API functions
- [X] T038 [P] [US1] Add `api.create(fields)` to `src/services/api.js` — `POST /api/applications`, returns `data` from success response

**Checkpoint**: Full create flow working with correct validation errors. Frontend `api.create()` callable.

---

## Phase 5: US4 — Update an Existing Application Record (Priority: P2)

**Goal**: PATCH endpoint with partial update semantics. `lastStatusUpdate` auto-updates only on actual status change. Frontend wires status changes through the API.

**Independent Test**: `PATCH` with `{ status: "interview" }` updates `status` and `lastStatusUpdate`, leaves all other fields unchanged. PATCH with same status does NOT change `lastStatusUpdate`. PATCH on unknown id returns 404.

### Tests

- [X] T039 [US4] Add unit tests in `tests/server/validation.test.js` for `updateSchema`: partial payload with only `status` passes; payload with `id` is stripped silently; payload with `createdAt` is stripped silently; invalid `followUpDate` format fails; empty object `{}` passes (valid no-op)
- [X] T040 [P] [US4] Add integration test: `PATCH /api/applications/:id` with `{ status: "interview" }` returns 200 with updated `status` and changed `lastStatusUpdate`; all other fields unchanged
- [X] T041 [P] [US4] Add integration test: `PATCH` with the same `status` as current returns 200 but does NOT change `lastStatusUpdate`
- [X] T042 [P] [US4] Add integration test: `PATCH` with `jobPostingUrl: "bad-url"` returns 400 `VALIDATION_ERROR`
- [X] T043 [P] [US4] Add integration test: `PATCH /api/applications/9999` returns 404 `NOT_FOUND`

### Implementation

- [X] T044 [US4] Add `update(id, fields)` to `server/db/applications.js` — fetches current record via `getById()`; returns `null` if not found; merges only supplied fields (no overwrite of unspecified fields); always sets `updated_at` to now; sets `last_status_update` to now only when `status` is present in the update AND differs from the current value; builds dynamic `UPDATE SET` from supplied keys only, validated against a fixed `UPDATABLE_COLUMNS` whitelist; returns updated row via `getById()`. **Note**: call `toRow()` only on the supplied subset of fields — do NOT pass the full merged record through `toRow()`, because `JSON.stringify(undefined)` on absent optional fields (e.g. `skills`) produces `undefined`, which `better-sqlite3` will reject as a parameter binding
- [X] T045 [US4] Add `PATCH /:id` handler to `server/routes/applications.js` — validates body with `updateSchema`; returns 400 on validation failure; calls `update(parseInt(req.params.id, 10), validatedFields)`; returns 404 if `null`; returns 200 `{ data: updatedRecord }`
- [X] T046 [P] [US4] Add `api.update(id, fields)` to `src/services/api.js` — `PATCH /api/applications/:id`, returns `data` from response
- [X] T047 [US4] Update `src/pages/Tracker.js` — wire `onStatusChange` callback to call `api.update(id, { status })` instead of `store.updateStatus()`; show failure toast if API call throws

**Checkpoint**: US1 + US4 functional. Status changes persisted to DB. `lastStatusUpdate` logic verified.

---

## Phase 6: US2 + US3 — View All & View Single (Priority: P2)

**Goal**: Frontend fully reads from the backend API. Update all field name references in Card.js and Modal.js to match the new API names. Handle integer IDs. Handle backend-unreachable state.

**Independent Test**: Start the server with records in DB, open the browser — all records appear with correct fields rendered. Refresh — records still there. Stop the server, reload — clear "backend unreachable" message shown.

### Tests

- [X] T048 [P] [US2] Add integration test: `GET /api/applications` returns only non-archived records
- [X] T049 [P] [US3] Add integration test: `GET /api/applications/:id` for an archived record still returns the full record (direct lookup is not filtered)

### Implementation

- [X] T050 [US2] Add `api.getAll()` to `src/services/api.js` — `GET /api/applications`, returns `data` array
- [X] T051 [P] [US3] Add `api.getById(id)` to `src/services/api.js` — `GET /api/applications/:id`, returns `data` object
- [X] T052 [US2] Update `src/pages/Tracker.js` — replace `store.getAll()` with `await api.getAll()`; add loading state (disable toolbar while fetching); on `NETWORK_ERROR` show a persistent error message "Cannot connect to the backend — is the server running?" instead of the card list; on other errors show a failure toast; render empty state correctly when `data` is an empty array
- [X] T053 [US3] Update `src/components/Modal.js` — replace `store.getById(id)` with `await api.getById(id)` where applicable; show error toast if fetch fails
- [X] T054 [US2] Update `src/components/Card.js` — rename all field references: `application.position` → `application.jobTitle`; `application.company` → `application.companyName`; `application.url` → `application.jobPostingUrl`; `application.last_status_update` → `application.lastStatusUpdate`; `application.fav` and `application.compat` and `application.skills` and `application.responsibilities` already match — verify they render correctly with real data
- [X] T055 [P] [US2] Update `src/components/Modal.js` field references to match new API names: `position` → `jobTitle`, `company` → `companyName`, `url` → `jobPostingUrl`, `last_status_update` → `lastStatusUpdate`, `recruiter` already matches
- [X] T056 [US2] Update `src/pages/Tracker.js` — fix copy-URL action: `application.url` → `application.jobPostingUrl`; add integer ID coercion for all `api.*` call sites: `parseInt(card.dataset.id, 10)` — and update `store.getById(id)` references to `api.getById()`
- [X] T057 [P] [US2] Update `src/models/application.js` — replace `position`, `company`, `url` references in `normalizeApplication` and `validateApplication` with `jobTitle`, `companyName`, `jobPostingUrl` to match the new API field names; update `isDigitString(id)` check to also accept integers (or remove it, since the backend now owns ID assignment)

**Checkpoint**: Frontend fully reads from API. localStorage is no longer the source of truth for reads. All field names aligned.

---

## Phase 7: US5 — Archive an Application Record (Priority: P3)

**Goal**: Soft-delete via archive endpoint. Star (fav) toggle wired through API since `fav` is now a first-class database column.

**Independent Test**: Archive a record → `GET /api/applications` excludes it. `GET /api/applications/:id` still returns it with `archived: true`. Star a record → reload → still starred.

### Tests

- [X] T058 [US5] Add integration test in `tests/server/applications.test.js`: `POST /api/applications/:id/archive` returns 200 with `archived: true`
- [X] T059 [P] [US5] Add integration test: `GET /api/applications` after archive does NOT include the archived record
- [X] T060 [P] [US5] Add integration test: `GET /api/applications/:id` after archive returns the record with `archived: true`
- [X] T061 [P] [US5] Add integration test: `POST /api/applications/9999/archive` returns 404 `NOT_FOUND`

### Implementation

- [X] T062 [US5] Add `archive(id)` to `server/db/applications.js` — `UPDATE applications SET archived = 1, updated_at = ? WHERE id = ?`; returns updated row via `getById()` or `null` if not found
- [X] T063 [US5] Add `POST /:id/archive` handler to `server/routes/applications.js` — calls `archive(parseInt(req.params.id, 10))`; returns 404 if `null`; returns 200 `{ data: archivedRecord }`
- [X] T064 [P] [US5] Add `api.archive(id)` to `src/services/api.js` — `POST /api/applications/:id/archive`, returns `data`
- [X] T065 [US5] Update `src/components/Card.js` — wire `onFavToggle` callback to call `api.update(id, { fav: !application.fav })` (fav is now a first-class DB column); show failure toast on error
- [X] T066 [US5] Update `src/pages/Tracker.js` — wire the delete/remove card action to call `api.archive(id)` and remove the card from the rendered list on success; show failure toast if API call throws

**Checkpoint**: All 5 user stories fully functional. Star state and archive state persisted in DB.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Missing test coverage, dead code annotated, lint passes, quickstart validated.

- [ ] T067 Add `@deprecated` JSDoc comment to `src/data/store.js` pointing to `src/services/api.js`; do not delete the file
- [ ] T068 [P] Add missing test: `PATCH {}` (empty body) returns 200 with the record fully unchanged
- [ ] T069 [P] Add missing test: `PATCH` never changes `createdAt`, even if client sends `createdAt` in the body
- [ ] T070 [P] Add missing test: `PATCH` with `archived: false` in the body silently strips it — the record's archived state is unchanged
- [ ] T071 [P] Add test for `src/services/api.js` network error: mock `fetch` to throw a `TypeError`; confirm `request()` throws `{ code: "NETWORK_ERROR", message: "Cannot connect to the backend..." }`
- [ ] T072 [P] Confirm all existing frontend Vitest tests still pass after the field name renames in Card.js, Modal.js, Tracker.js, and application.js — fix any broken mocks or import paths
- [ ] T073 [P] Run `npm run lint` — resolve all ESLint errors across `src/`, `server/`, `shared/`, and `tests/`
- [ ] T074 Run `npm run test:run` — confirm all tests (frontend + server) pass with no failures
- [ ] T075 Validate `specs/002-backend-persistence/quickstart.md` — follow the steps on a clean checkout; confirm `npm run db:init` → `npm run server:dev` → `npm run dev` works end-to-end; update quickstart if any step is out of date

**Checkpoint**: `npm run test:run` exits 0. `npm run lint` exits 0. Quickstart instructions accurate.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (SP + US1 base)**: Depends on Phase 2
- **Phase 4 (US1 refinement)**: Depends on Phase 3 infrastructure
- **Phase 5 (US4 Update)**: Depends on Phase 3; can start in parallel with Phase 4
- **Phase 6 (US2+US3 View)**: Depends on Phase 3 (needs getAll/getById) and Phase 4 (needs api.js base)
- **Phase 7 (US5 Archive)**: Depends on Phase 3 infrastructure; can start in parallel with Phase 5
- **Phase 8 (Polish)**: Depends on all prior phases

### User Story Dependencies

| Story | Depends on | Notes |
|---|---|---|
| US1 Create (P1) | Phase 2 | First deliverable; validates persistence system property |
| US4 Update (P2) | Phase 3 infrastructure | New PATCH endpoint; parallel-safe with US1 refinement |
| US2 View All (P2) | Phase 3 + Phase 4 | Frontend read path; needs api.js base |
| US3 View Single (P2) | Phase 3 + Phase 4 | Delivered alongside US2 |
| US5 Archive (P3) | Phase 3 infrastructure | New archive endpoint |

---

## Implementation Strategy

### MVP (Phases 1–4 only)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: Create endpoint + persistence system property verified
4. Phase 4: Full validation + frontend `api.create()`
5. **STOP and VALIDATE**: persistence test passes; `POST` → restart → `GET` returns the record

### Incremental Delivery

1. Phases 1–4 → Create works, data persists ✅
2. Phase 5 (US4) → Update + status tracking ✅
3. Phase 6 (US2+US3) → Frontend fully reads from API ✅
4. Phase 7 (US5) → Archive ✅
5. Phase 8 → Polish ✅

---

## Notes

- [P] = different files, no incomplete-task dependencies — safe to run in parallel
- [USn] maps every task to its user story for traceability; [SP] = system property validation
- `shared/constants.js` is the single source of truth for `STATUS_VALUES` — imported by both `src/` and `server/`
- `makeTestDb()` uses a temp file (not `:memory:`) so connection-close-reopen tests accurately reflect SQLite persistence behaviour
- `src/data/store.js` is deprecated but not deleted — it serves as a reference for legacy field names and behaviour during the migration
- Total tasks: **75** across 8 phases
