# Research: Local Persistence & Backend Support

**Branch**: `002-backend-persistence` | **Phase**: 0 — Research

---

## Decision 1: Backend Framework

**Decision**: Node.js + Express

**Rationale**: Express is the most widely documented, most familiar Node.js HTTP framework. The project is already JavaScript (no TypeScript), so Express's straightforward routing and middleware model is the lowest-friction choice. It works cleanly with ESM modules (Node.js 18+) and requires no build step for the server.

**Alternatives considered**:

| Option | Verdict |
|---|---|
| **Hono** | ESM-native, very lightweight, good DX — but newer ecosystem, less documentation, and adds no meaningful benefit for a 5-endpoint local API |
| **Fastify** | Built-in JSON schema validation is appealing, but the schema registration model adds setup complexity that Zod covers more cleanly |
| **Bare Node.js `http`** | Too low-level; would require hand-rolling routing, body parsing, and error handling |

---

## Decision 2: Database

**Decision**: SQLite via `better-sqlite3`

**Rationale**: SQLite is a single file, zero-configuration, embedded database. It requires no server process, persists reliably on disk, supports JSON text fields for metadata extensibility, and is trivially repeatable from a clean checkout (run one schema creation script). `better-sqlite3` is the recommended Node.js driver — it uses a synchronous API which eliminates async/await boilerplate for database operations and matches the simplicity goal.

**Alternatives considered**:

| Option | Verdict |
|---|---|
| **PostgreSQL** | Requires a running server process, installation, and configuration — far more setup than needed for a local personal tool |
| **MongoDB (local)** | Also requires a server process; BSON format adds complexity without meaningful benefit over SQLite's JSON text field |
| **Knex + SQLite** | Knex is a useful query builder but adds abstraction. Direct `better-sqlite3` queries are readable and sufficient for this API surface |

---

## Decision 3: Validation

**Decision**: Zod

**Rationale**: The constitution requires centralized, reusable validation. Zod provides typed schema definitions that can be shared between route handlers and tests, produce clear field-level error messages, and validate URL format, ISO 8601 dates, and required fields cleanly. Manual validation functions would work but are harder to test in isolation and tend to diverge over time.

**Alternatives considered**:

| Option | Verdict |
|---|---|
| **Joi** | Mature and capable, but larger bundle and older API style |
| **express-validator** | Middleware-coupled; harder to reuse schemas in tests |
| **Manual validation** | Simple to start, but diverges and duplicates logic across routes and tests |

---

## Decision 4: ORM vs Direct Queries

**Decision**: Direct SQL queries via `better-sqlite3` — no ORM

**Rationale**: The data model is a single table with straightforward CRUD operations. An ORM would add abstraction, a learning curve, and migration tooling overhead that isn't justified for this scope. Direct prepared statements in `better-sqlite3` are fast, readable, and easy to test. A thin repository module isolates the query logic from routes without a full ORM.

**Alternatives considered**:

| Option | Verdict |
|---|---|
| **Drizzle ORM** | TypeScript-first; awkward in a pure JS project |
| **Prisma** | Excellent DX but requires a schema file, code generation step, and migration engine — too heavy for a local single-table app |
| **Knex** | Query builder (not full ORM) — reasonable but adds a dependency and abstraction layer not needed here |

---

## Decision 5: Soft Delete vs Hard Delete

**Decision**: Soft delete (archive flag)

**Rationale**: Archived records are retained in the database with an `archived = 1` flag and excluded from the default list query. This preserves historical data, is reversible if needed in the future, and was documented as the explicit choice in the spec Assumptions. Hard delete is not implemented in this phase.

---

## Decision 6: Frontend Integration

**Decision**: Vite dev proxy + fetch-based API service module

**Rationale**: The existing Vite dev server supports a `proxy` config that forwards `/api/*` requests to the backend port. This eliminates CORS concerns in development without adding a `cors` package. The frontend will have a new `src/services/api.js` module that wraps `fetch` calls. The existing `src/data/store.js` (localStorage) will be replaced by this service module.

---

## Decision 7: Port & Process Management

**Decision**: Backend on port 3001; `nodemon` for development auto-restart

**Rationale**: Vite uses port 5173 by default; port 3001 is conventional for a local API companion. `nodemon` watches the `server/` directory and restarts the Express server on changes, matching the DX of Vite's HMR for the frontend.

---

## Dependencies Summary

| Package | Type | Purpose |
|---|---|---|
| `express` | runtime | HTTP server and routing |
| `better-sqlite3` | runtime | SQLite driver (synchronous API) |
| `zod` | runtime | Schema validation |
| `nodemon` | devDependency | Server auto-restart in development |

No CORS package needed (Vite proxy handles it). No ORM. No migration framework.
