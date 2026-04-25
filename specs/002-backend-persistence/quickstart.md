# Quickstart: Local Persistence & Backend Support

**Branch**: `002-backend-persistence`

---

## Prerequisites

- Node.js 18 or later
- npm

---

## First-time Setup (clean checkout)

```bash
# 1. Install dependencies
npm install

# 2. Initialize the database
npm run db:init
```

`db:init` runs `server/db-init.js`, which calls the explicit `initSchema()` function and logs `"Database initialized successfully"`. It is safe to re-run — all DDL statements use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.

---

## Running the App

Two processes must run simultaneously:

```bash
# Terminal 1 — backend API server (port 3001)
npm run server:dev

# Terminal 2 — frontend dev server (port 5173)
npm run dev
```

Open `http://localhost:5173` in your browser. The frontend dev server proxies all `/api/*` requests to the backend automatically.

---

## Running Tests

```bash
# All tests (frontend + backend)
npm run test:run

# Watch mode
npm test
```

---

## Lint

```bash
npm run lint
```

---

## Directory Reference

```
shared/           ← STATUS_VALUES (imported by both src/ and server/)
  constants.js
data/             ← SQLite database file (git-ignored)
server/           ← Express backend
  index.js        ← server entry point
  db.js           ← database connection + initSchema()
  db-init.js      ← standalone init script (run via db:init)
  db/
    applications.js  ← SQL queries (repository)
  routes/
    applications.js  ← Express route handlers
  validation/
    application.js   ← Zod schemas
src/              ← Vite frontend
  services/
    api.js        ← fetch-based API client (new)
tests/
  server/         ← backend unit + integration tests
    helpers.js    ← makeTestDb() (temp file) + makeMemoryDb()
```

---

## Environment

No `.env` file is required. The backend port (`3001`) and database path (`./data/alice.db`) are defined as constants in `server/index.js` and `server/db.js`.

---

## Database Reset

To wipe and recreate the database from scratch:

```bash
# Delete the database file and re-initialize
rm data/alice.db && npm run db:init
```
